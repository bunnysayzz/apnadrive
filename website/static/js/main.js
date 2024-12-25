function showDirectory(data) {
    data = data['contents']
    document.getElementById('directory-data').innerHTML = ''
    const isTrash = getCurrentPath().startsWith('/trash')

    let html = '<div class="grid-container">'

    // Sort entries
    let entries = Object.entries(data);
    let folders = entries.filter(([key, value]) => value.type === 'folder');
    let files = entries.filter(([key, value]) => value.type === 'file');

    folders.sort((a, b) => new Date(b[1].upload_date) - new Date(a[1].upload_date));
    files.sort((a, b) => new Date(b[1].upload_date) - new Date(a[1].upload_date));

    // Add folders first
    for (const [key, item] of folders) {
        if (item.type === 'folder') {
            html += `
                <div class="grid-item folder" data-path="${item.path}" data-id="${item.id}">
                    <div class="item-preview">
                        <img src="static/assets/folder-solid-icon.svg" class="folder-icon">
                    </div>
                    <div class="item-details">
                        <div class="item-name">${item.name}</div>
                        <button data-id="${item.id}" class="more-btn">
                            <img src="static/assets/more-icon.svg" class="rotate-90">
                        </button>
                    </div>
                </div>
            `

            // Add more options div
            if (isTrash) {
                html += `<div data-path="${item.path}" id="more-option-${item.id}" data-name="${item.name}" class="more-options">
                    <input class="more-options-focus" readonly="readonly" style="height:0;width:0;border:none;position:absolute">
                    <div id="restore-${item.id}" data-path="${item.path}"><img src="static/assets/load-icon.svg"> Restore</div>
                    <hr>
                    <div id="delete-${item.id}" data-path="${item.path}"><img src="static/assets/trash-icon.svg"> Delete</div>
                </div>`
            } else {
                html += `<div data-path="${item.path}" id="more-option-${item.id}" data-name="${item.name}" class="more-options">
                    <input class="more-options-focus" readonly="readonly" style="height:0;width:0;border:none;position:absolute">
                    <div id="rename-${item.id}"><img src="static/assets/pencil-icon.svg"> Rename</div>
                    <hr>
                    <div id="trash-${item.id}"><img src="static/assets/trash-icon.svg"> Trash</div>
                    <hr>
                    <div id="folder-share-${item.id}"><img src="static/assets/share-icon.svg"> Share</div>
                </div>`
            }
        }
    }

    // Add files with lazy-loaded thumbnails
    for (const [key, item] of files) {
        if (item.type === 'file') {
            const size = convertBytes(item.size)
            const fileExt = item.name.split('.').pop().toLowerCase()
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)
            const isVideo = ['mp4', 'webm', 'mkv', 'avi'].includes(fileExt)
            
            const thumbnailPlaceholder = isImage || isVideo ? 
                `<div class="file-thumbnail lazy ${isVideo ? 'video-thumbnail' : ''}" data-src="/api/thumbnail?path=${item.path}/${item.id}"></div>` :
                `<img src="static/assets/file-icon.svg" class="file-icon">`

            html += `
                <div class="grid-item file" data-path="${item.path}" data-id="${item.id}" data-name="${item.name}">
                    <div class="item-preview">
                        ${thumbnailPlaceholder}
                    </div>
                    <div class="item-details">
                        <div class="item-name" title="${item.name}">${item.name}</div>
                        <div class="item-info">
                            <span class="item-size">${size}</span>
                            <button data-id="${item.id}" class="more-btn">
                                <img src="static/assets/more-icon.svg" class="rotate-90">
                            </button>
                        </div>
                    </div>
                </div>
            `

            // Add more options div
            if (isTrash) {
                html += `<div data-path="${item.path}" id="more-option-${item.id}" data-name="${item.name}" class="more-options">
                    <input class="more-options-focus" readonly="readonly" style="height:0;width:0;border:none;position:absolute">
                    <div id="restore-${item.id}" data-path="${item.path}"><img src="static/assets/load-icon.svg"> Restore</div>
                    <hr>
                    <div id="delete-${item.id}" data-path="${item.path}"><img src="static/assets/trash-icon.svg"> Delete</div>
                </div>`
            } else {
                html += `<div data-path="${item.path}" id="more-option-${item.id}" data-name="${item.name}" class="more-options">
                    <input class="more-options-focus" readonly="readonly" style="height:0;width:0;border:none;position:absolute">
                    <div id="rename-${item.id}"><img src="static/assets/pencil-icon.svg"> Rename</div>
                    <hr>
                    <div id="trash-${item.id}"><img src="static/assets/trash-icon.svg"> Trash</div>
                    <hr>
                    <div id="share-${item.id}"><img src="static/assets/share-icon.svg"> Share</div>
                </div>`
            }
        }
    }

    html += '</div>'
    document.getElementById('directory-data').innerHTML = html

    // Initialize lazy loading
    initLazyLoading();

    if (!isTrash) {
        document.querySelectorAll('.grid-item.folder').forEach(div => {
            div.ondblclick = openFolder;
        });
        document.querySelectorAll('.grid-item.file').forEach(div => {
            div.ondblclick = openFile;
        });
    }

    document.querySelectorAll('.more-btn').forEach(div => {
        div.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            openMoreButton(div)
        });
    });
}

// Add lazy loading functionality
function initLazyLoading() {
    const lazyThumbnails = document.querySelectorAll('.lazy');
    
    const lazyLoad = target => {
        const io = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.style.backgroundImage = `url(${img.dataset.src})`;
                    img.classList.remove('lazy');
                    observer.disconnect();
                }
            });
        });

        io.observe(target);
    };

    lazyThumbnails.forEach(lazyLoad);
}

document.getElementById('search-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = document.getElementById('file-search').value;
    console.log(query)
    if (query === '') {
        alert('Search field is empty');
        return;
    }
    const path = '/?path=/search_' + encodeURI(query);
    console.log(path)
    window.location = path;
});

// Loading Main Page

document.addEventListener('DOMContentLoaded', async function () {
    const inputs = ['new-folder-name', 'rename-name', 'file-search']
    for (let i = 0; i < inputs.length; i++) {
        document.getElementById(inputs[i]).addEventListener('input', validateInput);
    }

    // Add event listener for page unload/close
    window.addEventListener('unload', async () => {
        try {
            // Send a synchronous request to logout
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/logout', false);  // false makes it synchronous
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send();
        } catch (err) {
            console.error('Logout failed:', err);
        }
    });

    if (getCurrentPath().includes('/share_')) {
        getCurrentDirectory()
    } else {
        const isLoggedIn = await checkSession()
        if (!isLoggedIn) {
            document.getElementById('bg-blur').style.zIndex = '2';
            document.getElementById('bg-blur').style.opacity = '0.1';
            document.getElementById('get-password').style.zIndex = '3';
            document.getElementById('get-password').style.opacity = '1';
        } else {
            getCurrentDirectory()
        }
    }
});
