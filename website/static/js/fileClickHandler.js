// Ensure all content is loaded before setting up handlers
document.addEventListener('DOMContentLoaded', function () {
    setupClickHandlers();
});

function setupClickHandlers() {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const openEvent = 'click'; // Use click for both mobile and desktop for simplicity

    document.querySelectorAll('.grid-item.folder, .grid-item.file').forEach(item => {
        item.removeEventListener('dblclick', openFolder); // Clean up previous event listeners
        item.removeEventListener('click', openFolder);
        item.removeEventListener('dblclick', openFile);
        item.removeEventListener('click', openFile);

        item.addEventListener(openEvent, function() {
            if (this.classList.contains('folder')) {
                openFolder.call(this);
            } else if (this.classList.contains('file')) {
                openFile.call(this);
            }
        });
    });
}

function openFolder() {
    let path = (getCurrentPath() + '/' + this.getAttribute('data-id') + '/').replaceAll('//', '/');
    const auth = getFolderAuthFromPath();
    if (auth) {
        path += '&auth=' + auth;
    }
    window.location.href = `/?path=${path}`;
}

function openFile() {
    const fileName = this.getAttribute('data-name').toLowerCase();
    const path = '/file?path=' + this.getAttribute('data-path') + '/' + this.getAttribute('data-id');
    
    // Check if file is media
    if (isMediaFile(fileName)) {
        openMediaModal(path, fileName);
    } else {
        window.open(path, '_blank');
    }
}

function isMediaFile(fileName) {
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const videoExts = ['.mp4', '.webm', '.mkv', '.mov', '.avi'];
    
    return [...imageExts, ...videoExts].some(ext => fileName.endsWith(ext));
}

function openMediaModal(path, fileName) {
    const modal = document.getElementById('mediaModal');
    const container = modal.querySelector('.media-container');
    const isVideo = fileName.match(/\.(mp4|webm|mkv|mov|avi)$/i);
    
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
    
    // Clear previous content
    container.innerHTML = `
        <div class="loading-background"></div>
        <div class="loading-spinner"></div>
    `;
    
    // Add download button
    const downloadBtn = document.createElement('div');
    downloadBtn.className = 'download-modal-btn';
    downloadBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
    `;
    
    // Add touch event handlers
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadMedia(path, fileName);
    });
    downloadBtn.addEventListener('touchend', (e) => {
        e.stopPropagation();
        downloadMedia(path, fileName);
    });
    
    modal.querySelector('.modal-content').appendChild(downloadBtn);

    // Show modal
    modal.style.display = 'block';
    setTimeout(() => modal.style.opacity = '1', 10);

    if (isVideo) {
        const video = document.createElement('video');
        video.controls = true;
        video.autoplay = false;
        video.playsInline = true; // Better mobile video handling
        video.classList.add('media-loading');
        
        video.onloadeddata = () => {
            container.querySelector('.loading-spinner')?.remove();
            container.querySelector('.loading-background')?.remove();
            video.style.opacity = '1';
        };

        video.onerror = () => {
            handleMediaError(container, 'Failed to load video');
        };

        video.src = path;
        container.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.classList.add('media-loading');
        
        img.onload = () => {
            container.querySelector('.loading-spinner')?.remove();
            container.querySelector('.loading-background')?.remove();
            img.style.opacity = '1';
        };

        img.onerror = () => {
            handleMediaError(container, 'Failed to load image');
        };

        img.src = path;
        container.appendChild(img);
    }

    // Update close handlers for better mobile support
    const closeBtn = modal.querySelector('.close-modal');
    const closeModal = (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeMediaModal();
    };
    
    closeBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('touchend', closeModal);

    // Close on outside click/touch
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeMediaModal();
    });
    modal.addEventListener('touchend', (e) => {
        if (e.target === modal) closeMediaModal();
    });

    // Handle escape key
    document.addEventListener('keydown', handleEscKey);
}

function handleMediaError(container, message) {
    container.innerHTML = `
        <div style="
            text-align: center;
            color: #dc3545;
            padding: 20px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1)
        ">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <p style="margin-top: 10px">${message}</p>
        </div>
    `;
}

function closeMediaModal() {
    const modal = document.getElementById('mediaModal');
    const container = modal.querySelector('.media-container');
    
    // Re-enable body scrolling
    document.body.style.overflow = '';
    
    modal.style.opacity = '0';
    
    const video = container.querySelector('video');
    if (video) {
        video.pause();
        video.src = '';
    }
    
    setTimeout(() => {
        modal.style.display = 'none';
        container.innerHTML = '';
        const downloadBtn = modal.querySelector('.download-modal-btn');
        if (downloadBtn) {
            downloadBtn.remove();
        }
    }, 300);

    document.removeEventListener('keydown', handleEscKey);
}

function handleEscKey(e) {
    if (e.key === 'Escape') {
        closeMediaModal();
    }
}


// File More Button Handler Start

function openMoreButton(div) {
    const id = div.getAttribute('data-id')
    const moreDiv = document.getElementById(`more-option-${id}`)

    const rect = div.getBoundingClientRect();
    const x = rect.left + window.scrollX - 40;
    const y = rect.top + window.scrollY;

    moreDiv.style.zIndex = 2
    moreDiv.style.opacity = 1
    moreDiv.style.left = `${x}px`
    moreDiv.style.top = `${y}px`

    const isTrash = getCurrentPath().includes('/trash')

    moreDiv.querySelector('.more-options-focus').focus()
    moreDiv.querySelector('.more-options-focus').addEventListener('blur', closeMoreBtnFocus);
    moreDiv.querySelector('.more-options-focus').addEventListener('focusout', closeMoreBtnFocus);
    if (!isTrash) {
        moreDiv.querySelector(`#rename-${id}`).addEventListener('click', renameFileFolder)
        moreDiv.querySelector(`#trash-${id}`).addEventListener('click', trashFileFolder)
        try {
            moreDiv.querySelector(`#share-${id}`).addEventListener('click', shareFile)
        }
        catch { }
        try {
            moreDiv.querySelector(`#folder-share-${id}`).addEventListener('click', shareFolder)
        }
        catch { }
    }
    else {
        moreDiv.querySelector(`#restore-${id}`).addEventListener('click', restoreFileFolder)
        moreDiv.querySelector(`#delete-${id}`).addEventListener('click', deleteFileFolder)
    }
}

function closeMoreBtnFocus() {
    const moreDiv = this.parentElement
    moreDiv.style.opacity = '0'
    setTimeout(() => {
        moreDiv.style.zIndex = '-1'
    }, 300)
}

// Rename File Folder Start
function renameFileFolder() {
    const id = this.getAttribute('id').split('-')[1]
    console.log(id)

    document.getElementById('rename-name').value = this.parentElement.getAttribute('data-name');
    document.getElementById('bg-blur').style.zIndex = '2';
    document.getElementById('bg-blur').style.opacity = '0.1';

    document.getElementById('rename-file-folder').style.zIndex = '3';
    document.getElementById('rename-file-folder').style.opacity = '1';
    document.getElementById('rename-file-folder').setAttribute('data-id', id);
    setTimeout(() => {
        document.getElementById('rename-name').focus();
    }, 300)
}

document.getElementById('rename-cancel').addEventListener('click', () => {
    document.getElementById('rename-name').value = '';
    document.getElementById('bg-blur').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('bg-blur').style.zIndex = '-1';
    }, 300)
    document.getElementById('rename-file-folder').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('rename-file-folder').style.zIndex = '-1';
    }, 300)
});

document.getElementById('rename-create').addEventListener('click', async () => {
    const name = document.getElementById('rename-name').value;
    if (name === '') {
        alert('Name cannot be empty')
        return
    }

    const id = document.getElementById('rename-file-folder').getAttribute('data-id')

    const path = document.getElementById(`more-option-${id}`).getAttribute('data-path') + '/' + id

    const data = {
        'name': name,
        'path': path
    }

    const response = await postJson('/api/renameFileFolder', data)
    if (response.status === 'ok') {
        alert('File/Folder Renamed Successfully')
        window.location.reload();
    } else {
        alert('Failed to rename file/folder')
        window.location.reload();
    }
});


// Rename File Folder End

async function trashFileFolder() {
    const id = this.getAttribute('id').split('-')[1]
    console.log(id)
    const path = document.getElementById(`more-option-${id}`).getAttribute('data-path') + '/' + id
    const data = {
        'path': path,
        'trash': true
    }
    const response = await postJson('/api/trashFileFolder', data)

    if (response.status === 'ok') {
        alert('File/Folder Sent to Trash Successfully')
        window.location.reload();
    } else {
        alert('Failed to Send File/Folder to Trash')
        window.location.reload();
    }
}

async function restoreFileFolder() {
    const id = this.getAttribute('id').split('-')[1]
    const path = this.getAttribute('data-path') + '/' + id
    const data = {
        'path': path,
        'trash': false
    }
    const response = await postJson('/api/trashFileFolder', data)

    if (response.status === 'ok') {
        alert('File/Folder Restored Successfully')
        window.location.reload();
    } else {
        alert('Failed to Restored File/Folder')
        window.location.reload();
    }
}

async function deleteFileFolder() {
    const id = this.getAttribute('id').split('-')[1]
    const path = this.getAttribute('data-path') + '/' + id
    const data = {
        'path': path
    }
    const response = await postJson('/api/deleteFileFolder', data)

    if (response.status === 'ok') {
        alert('File/Folder Deleted Successfully')
        window.location.reload();
    } else {
        alert('Failed to Delete File/Folder')
        window.location.reload();
    }
}

async function shareFile() {
    const fileName = this.parentElement.getAttribute('data-name').toLowerCase()
    const id = this.getAttribute('id').split('-')[1]
    const path = document.getElementById(`more-option-${id}`).getAttribute('data-path') + '/' + id
    const root_url = getRootUrl()

    let link
    if (fileName.endsWith('.mp4') || fileName.endsWith('.mkv') || fileName.endsWith('.webm') || fileName.endsWith('.mov') || fileName.endsWith('.avi') || fileName.endsWith('.ts') || fileName.endsWith('.ogv')) {
        link = `${root_url}/stream?url=${root_url}/file?path=${path}`
    } else {
        link = `${root_url}/file?path=${path}`

    }

    copyTextToClipboard(link)
}


async function shareFolder() {
    const id = this.getAttribute('id').split('-')[2]
    console.log(id)
    let path = document.getElementById(`more-option-${id}`).getAttribute('data-path') + '/' + id
    const root_url = getRootUrl()

    const auth = await getFolderShareAuth(path)
    path = path.slice(1)

    let link = `${root_url}/?path=/share_${path}&auth=${auth}`
    console.log(link)

    copyTextToClipboard(link)
}

// File More Button Handler  End

// Add this new function for handling downloads
function downloadMedia(path, fileName) {
    // Create temporary link
    const link = document.createElement('a');
    link.href = path;
    link.download = fileName; // Set suggested filename
    
    // Append to document temporarily
    document.body.appendChild(link);
    
    // Show loading toast
    showToast('Starting download...');
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
}