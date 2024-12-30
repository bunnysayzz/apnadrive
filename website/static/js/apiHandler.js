// Api Fuctions
async function postJson(url, data) {
    data['password'] = getPassword()
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    return await response.json()
}

function getPassword() {
    return document.cookie.split('; ').find(row => row.startsWith('admin_auth='))?.split('=')[1] || null;
}

document.getElementById('pass-login').addEventListener('click', async () => {
    const password = document.getElementById('auth-pass').value
    const data = { 'pass': password }
    const json = await postJson('/api/checkPassword', data)
    if (json.status === 'ok') {
        document.cookie = `admin_auth=${password};path=/;samesite=strict`;
        window.location.reload()
    }
    else {
        alert('Wrong Password')
    }
})

async function getCurrentDirectory() {
    let path = getCurrentPath()
    if (path === 'redirect') {
        return
    }
    try {
        const auth = getFolderAuthFromPath()
        console.log(path)

        const data = { 'path': path, 'auth': auth }
        const json = await postJson('/api/getDirectory', data)

        if (json.status === 'ok') {
            if (getCurrentPath().startsWith('/share')) {
                const sections = document.querySelector('.sidebar-menu').getElementsByTagName('a')
                console.log(path)

                if (removeSlash(json['auth_home_path']) === removeSlash(path.split('_')[1])) {
                    sections[0].setAttribute('class', 'selected-item')

                } else {
                    sections[0].setAttribute('class', 'unselected-item')
                }
                sections[0].href = `/?path=/share_${removeSlash(json['auth_home_path'])}&auth=${auth}`
                console.log(`/?path=/share_${removeSlash(json['auth_home_path'])}&auth=${auth}`)
            }

            console.log(json)
            showDirectory(json['data'])
        } else {
            alert('404 Current Directory Not Found')
        }
    }
    catch (err) {
        console.log(err)
        alert('404 Current Directory Not Found')
    }
}

async function createNewFolder() {
    const folderName = document.getElementById('new-folder-name').value;
    const path = getCurrentPath()
    if (path === 'redirect') {
        return
    }
    if (folderName.length > 0) {
        const data = {
            'name': folderName,
            'path': path
        }
        try {
            const json = await postJson('/api/createNewFolder', data)

            if (json.status === 'ok') {
                window.location.reload();
            } else {
                alert(json.status)
            }
        }
        catch (err) {
            alert('Error Creating Folder')
        }
    } else {
        alert('Folder Name Cannot Be Empty')
    }
}


async function getFolderShareAuth(path) {
    const data = { 'path': path }
    const json = await postJson('/api/getFolderShareAuth', data)
    if (json.status === 'ok') {
        return json.auth
    } else {
        alert('Error Getting Folder Share Auth')
    }
}

// File Uploader Start
const MAX_FILE_SIZE = MAX_FILE_SIZE__SDGJDG
const PROGRESS_INTERVAL = 1000; // Check progress every second

const fileInput = document.getElementById('fileInput');
const progressBar = document.getElementById('progress-bar');
const cancelButton = document.getElementById('cancel-file-upload');
const uploadPercent = document.getElementById('upload-percent');
let uploadRequest = null;
let uploadStep = 0;
let uploadID = null;
let isUploading = false;

fileInput.addEventListener('change', async (e) => {
    if (isUploading) return;
    isUploading = true;
    
    const files = Array.from(fileInput.files);
    let successCount = 0;
    let failedFiles = [];
    let totalFiles = files.length;

    // Show file uploader UI
    document.getElementById('bg-blur').style.zIndex = '2';
    document.getElementById('bg-blur').style.opacity = '0.1';
    document.getElementById('file-uploader').style.zIndex = '3';
    document.getElementById('file-uploader').style.opacity = '1';

    // Create files list UI
    const filesListHTML = files.map(file => 
        `<div class="upload-file-item" id="file-${file.name.replace(/[^a-zA-Z0-9]/g, '_')}">
            <div class="file-info">
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
            </div>
            <div class="file-progress">
                <div class="progress-mini">
                    <div class="progress-bar-mini"></div>
                </div>
                <span class="status">Waiting...</span>
            </div>
        </div>`
    ).join('');

    document.getElementById('upload-filename').innerHTML = 
        `<div class="upload-files-list">${filesListHTML}</div>`;
    document.getElementById('upload-status').innerText = `Processing files one by one`;

    // Process files sequentially
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileElement = document.getElementById(`file-${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
        
        try {
            await uploadFile(file, fileElement);
            successCount++;
            
            // Update overall progress
            const overallProgress = (successCount / totalFiles) * 100;
            document.getElementById('progress-bar').style.width = `${overallProgress}%`;
            document.getElementById('upload-status').innerText = `Completed ${successCount}/${totalFiles} files`;
            document.getElementById('upload-percent').innerText = `${overallProgress.toFixed(1)}%`;
            
        } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error);
            failedFiles.push(file.name);
        }
    }

    // Show final status
    const finalMessage = successCount === totalFiles ? 
        `Successfully uploaded all ${totalFiles} files!` :
        `Uploaded ${successCount} out of ${totalFiles} files.\nFailed files: ${failedFiles.join(', ')}`;

    document.getElementById('upload-status').innerText = 'Upload Complete';
    document.getElementById('upload-percent').innerText = finalMessage;

    // Add reload button
    const btnDiv = document.querySelector('.btn-div');
    btnDiv.innerHTML = '<button onclick="window.location.reload()" class="reload-btn">Refresh Page</button>';
    
    isUploading = false;
});

async function uploadFile(file, element) {
    const fileProgressBar = element.querySelector('.progress-bar-mini');
    const fileStatus = element.querySelector('.status');

    if (file.size > MAX_FILE_SIZE) {
        fileStatus.innerHTML = `<span class="error">Exceeds ${(MAX_FILE_SIZE / (1024 * 1024 * 1024)).toFixed(2)} GB limit</span>`;
        throw new Error('File too large');
    }

    try {
        // Phase 1: Initial Upload with Parallel Processing
        fileStatus.textContent = 'Starting upload...';
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', getCurrentPath());
        formData.append('password', getPassword());
        const id = getRandomId();
        formData.append('id', id);
        formData.append('total_size', file.size);

        // Start monitoring both upload and processing progress immediately
        const uploadPromise = new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    fileProgressBar.style.width = `${percentComplete}%`;
                    fileStatus.textContent = `Uploading: ${percentComplete.toFixed(1)}%`;
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    resolve();
                } else {
                    reject(new Error('Upload failed'));
                }
            };

            xhr.onerror = () => reject(new Error('Upload failed'));
            
            xhr.open('POST', '/api/upload', true);
            xhr.send(formData);
        });

        // Monitor processing in parallel with upload
        const processPromise = new Promise((resolve, reject) => {
            let processingStarted = false;
            
            const checkProgress = async () => {
                try {
                    // Check save progress
                    const saveResponse = await postJson('/api/getSaveProgress', { 'id': id });
                    if (saveResponse?.status === 'ok') {
                        const saveData = saveResponse.data;
                        if (!processingStarted && saveData[0] === 'running') {
                            processingStarted = true;
                            fileStatus.textContent = 'Processing...';
                        }
                        
                        if (saveData[0] === 'completed') {
                            // Move to upload progress check
                            const uploadResponse = await postJson('/api/getUploadProgress', { 'id': id });
                            if (uploadResponse?.status === 'ok') {
                                const uploadData = uploadResponse.data;
                                if (uploadData[0] === 'completed') {
                                    fileProgressBar.style.width = '100%';
                                    fileStatus.textContent = 'Completed';
                                    resolve();
                                    return;
                                } else if (uploadData[0] === 'error') {
                                    reject(new Error('Processing failed'));
                                    return;
                                }
                            }
                        } else if (saveData[0] === 'error') {
                            reject(new Error('Processing failed'));
                            return;
                        }
                    }
                    
                    // Continue checking progress
                    setTimeout(checkProgress, 500); // Check every 500ms
                } catch (error) {
                    reject(error);
                }
            };
            
            // Start progress monitoring
            checkProgress();
        });

        // Wait for both upload and processing to complete
        await Promise.all([uploadPromise, processPromise]);
        
        element.classList.add('completed');
        showToast(`${file.name} uploaded successfully!`);

    } catch (error) {
        console.error('Upload error:', error);
        fileStatus.innerHTML = `<span class="error">${error.message}</span>`;
        throw error;
    }
}

// File Uploader End


// URL Uploader Start

async function get_file_info_from_url(url) {
    const data = { 'url': url }
    const json = await postJson('/api/getFileInfoFromUrl', data)
    if (json.status === 'ok') {
        return json.data
    } else {
        throw new Error(`Error Getting File Info : ${json.status}`)
    }

}

async function start_file_download_from_url(url, filename, singleThreaded) {
    const data = { 'url': url, 'path': getCurrentPath(), 'filename': filename, 'singleThreaded': singleThreaded }
    const json = await postJson('/api/startFileDownloadFromUrl', data)
    if (json.status === 'ok') {
        return json.id
    } else {
        throw new Error(`Error Starting File Download : ${json.status}`)
    }
}

async function download_progress_updater(id, file_name, file_size) {
    uploadID = id;
    uploadStep = 2
    // Showing file uploader
    document.getElementById('bg-blur').style.zIndex = '2';
    document.getElementById('bg-blur').style.opacity = '0.1';
    document.getElementById('file-uploader').style.zIndex = '3';
    document.getElementById('file-uploader').style.opacity = '1';

    document.getElementById('upload-filename').innerText = 'Filename: ' + file_name;
    document.getElementById('upload-filesize').innerText = 'Filesize: ' + (file_size / (1024 * 1024)).toFixed(2) + ' MB';

    const interval = setInterval(async () => {
        const response = await postJson('/api/getFileDownloadProgress', { 'id': id })
        const data = response['data']

        if (data[0] === 'error') {
            clearInterval(interval);
            alert('Failed To Download File From URL To Backend Server')
            window.location.reload()
        }
        else if (data[0] === 'completed') {
            clearInterval(interval);
            uploadPercent.innerText = 'Progress : 100%'
            progressBar.style.width = '100%';
            await handleUpload2(id)
        }
        else {
            const current = data[1];
            const total = data[2];

            const percentComplete = (current / total) * 100;
            progressBar.style.width = percentComplete + '%';
            uploadPercent.innerText = 'Progress : ' + percentComplete.toFixed(2) + '%';

            if (data[0] === 'Downloading') {
                document.getElementById('upload-status').innerText = 'Status: Downloading File From Url To Backend Server';
            }
            else {
                document.getElementById('upload-status').innerText = `Status: ${data[0]}`;
            }
        }
    }, 3000)
}


async function Start_URL_Upload() {
    try {
        document.getElementById('new-url-upload').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('new-url-upload').style.zIndex = '-1';
        }, 300)

        const file_url = document.getElementById('remote-url').value
        const singleThreaded = document.getElementById('single-threaded-toggle').checked

        const file_info = await get_file_info_from_url(file_url)
        const file_name = file_info.file_name
        const file_size = file_info.file_size

        if (file_size > MAX_FILE_SIZE) {
            throw new Error(`File size exceeds ${(MAX_FILE_SIZE / (1024 * 1024 * 1024)).toFixed(2)} GB limit`)
        }

        const id = await start_file_download_from_url(file_url, file_name, singleThreaded)

        await download_progress_updater(id, file_name, file_size)

    }
    catch (err) {
        alert(err)
        window.location.reload()
    }


}

// URL Uploader End

// Add toast notification function
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 2000);
    }, 100);
}

document.getElementById('logout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    // Delete the admin_auth cookie
    document.cookie = 'admin_auth=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    // Reload the page to show login prompt
    window.location.reload();
});