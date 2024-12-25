let sidebarStates = new Map(); // 存储每个标签页的侧边栏状态

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(async function (tab) {
    try {
        // 获取当前标签页的状态
        let state = sidebarStates.get(tab.id) || { injected: false, visible: false };

        if (!state.injected) {
            // 注入所有必要的资源
            await injectResources(tab);
            state.injected = true;
            state.visible = true;
        } else {
            // 切换侧边栏显示状态 切换隐藏 
            state.visible = !state.visible;
            await toggleSidebar(tab, state.visible);
        }

        // 更新状态
        sidebarStates.set(tab.id, state);
    } catch (error) {
        console.error('Error handling sidebar:', error);
    }
});

// 监听标签页关闭事件，清理状态
chrome.tabs.onRemoved.addListener((tabId) => {
    sidebarStates.delete(tabId);
});

// 监听标签页更新事件，重置状态
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading') {
        sidebarStates.delete(tabId);
    }
});

async function injectResources(tab) {
    // 注入HTML
    const response = await fetch(chrome.runtime.getURL('sidebar.html'));
    const html = await response.text();

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (htmlContent) => {
            const div = document.createElement('div');
            div.id = 'markdown-sidebar-container';
            // div.style.display = ''; // 确保初始可见
            div.innerHTML = htmlContent;
            document.body.appendChild(div);
            const closeButton = document.getElementById('md-sidebar-close');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    chrome.runtime.sendMessage({ type: 'toggleSidebar', visible: false });
                });
            }
        },
        args: [html]
    });

    // 注入CSS
    await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['styles.css', 'github-markdown.css']
    });

    // 注入JavaScript
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['marked.min.js']
    });


    /* 判断当前网站是否是chatgpt官网，如果是则注入资源 */
    const url = window.location.href;
    if (url.includes('chatgpt.com')) {
        /* 注入turndown转化html为markdown的脚本 */
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['turndown.js'],
        })
    }


    // 注入主要功能代码
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            class FileExplorer {
                constructor() {
                    this.initializeWhenReady();
                }

                initializeWhenReady() {
                    if (this.checkElementsExist()) {
                        this.initialize();
                        return;
                    }

                    const observer = new MutationObserver((mutations, obs) => {
                        if (this.checkElementsExist()) {
                            obs.disconnect();
                            this.initialize();
                        }
                    });

                    observer.observe(document.body, {
                        childList: true,
                        subtree: true
                    });
                }

                checkElementsExist() {
                    return document.getElementById('fileTree') &&
                        document.getElementById('contextMenu');
                }

                initialize() {
                    this.currentPath = null;
                    this.fileTree = document.getElementById('fileTree');
                    this.openFolderBtn = document.getElementById('openFolderBtn');
                    this.notepad = document.getElementById('notepad');
                    this.preview = document.getElementById('preview');
                    this.saveBtn = document.getElementById('saveBtn');
                    this.saveAsBtn = document.getElementById('saveAsBtn');
                    this.currentFile = null;

                    // 确保所有元素都存在
                    if (!this.fileTree || !this.openFolderBtn || !this.notepad ||
                        !this.preview || !this.saveBtn || !this.saveAsBtn) {
                        console.error('找不到必要的DOM元素');
                        return;
                    }

                    this.setupEventListeners();
                    console.log('FileExplorer initialized'); // 添加调试日志

                    // 添加右键菜单事件处理
                    document.addEventListener('contextmenu', async (e) => {
                        const fileItem = e.target.closest('.file-item, .folder-item');
                        if (fileItem) {
                            e.preventDefault();
                            e.stopPropagation();

                            const contextMenu = document.getElementById('contextMenu');
                            if (contextMenu) {
                                // 移除所有项目的激活状态
                                document.querySelectorAll('.file-item, .folder-item').forEach(item => {
                                    item.classList.remove('active');
                                });

                                // 添加当前项目的激活状态
                                fileItem.classList.add('active');

                                // 获取文件/文件夹信息
                                const entry = {
                                    name: fileItem.dataset.name,
                                    kind: fileItem.dataset.type
                                };

                                // 如果是文件，获取文件内容
                                if (entry.kind === 'file') {
                                    try {
                                        const fileHandle = await this.currentPath.getFileHandle(entry.name);
                                        const file = await fileHandle.getFile();
                                        entry.content = await file.text();
                                    } catch (err) {
                                        console.error('获取文件内容失败:', err);
                                    }
                                }

                                // 计算菜单位置，确保不超出视口
                                const menuWidth = contextMenu.offsetWidth;
                                const menuHeight = contextMenu.offsetHeight;
                                const viewportWidth = window.innerWidth;
                                const viewportHeight = window.innerHeight;

                                let x = e.clientX;
                                let y = e.clientY;

                                // 如果菜单会超出右边界，则向左显示
                                if (x + menuWidth > viewportWidth) {
                                    x = viewportWidth - menuWidth;
                                }

                                // 如果菜单会超出下边界，则向上显示
                                if (y + menuHeight > viewportHeight) {
                                    y = viewportHeight - menuHeight;
                                }

                                // 显示菜单
                                contextMenu.style.display = 'block';
                                contextMenu.style.left = `${x}px`;
                                contextMenu.style.top = `${y}px`;

                                // 绑定菜单项点击事件
                                contextMenu.querySelectorAll('.menu-item').forEach(item => {
                                    const action = item.dataset.action;
                                    item.onclick = () => {
                                        contextMenu.style.display = 'none';
                                        chrome.runtime.sendMessage({
                                            type: 'handleMenuAction',
                                            action: action,
                                            entry: entry
                                        });
                                    };
                                });
                            }
                        }
                    });

                    // 点击其他区域关闭菜单
                    document.addEventListener('click', (e) => {
                        const contextMenu = document.getElementById('contextMenu');
                        if (contextMenu && !e.target.closest('.context-menu')) {
                            contextMenu.style.display = 'none';
                            // 移除所有项目的激活状态
                            document.querySelectorAll('.file-item, .folder-item').forEach(item => {
                                item.classList.remove('active');
                            });
                        }
                    });
                }

                setupEventListeners() {
                    console.log('Setting up event listeners'); // 添加调试日志

                    // 打开文件夹按钮事件
                    this.openFolderBtn.addEventListener('click', async () => {
                        console.log('Open folder button clicked'); // 添加调试日志
                        try {
                            const dirHandle = await window.showDirectoryPicker();
                            this.currentPath = dirHandle;
                            await this.displayFileTree(dirHandle, this.fileTree);
                        } catch (err) {
                            console.error('打开文件夹失败:', err);
                            alert('打开文件夹失败: ' + err.message);
                        }
                    });





                    // 编辑器内容变化时更新预览
                    this.notepad.addEventListener('input', () => {
                        this.preview.innerHTML = marked.parse(this.notepad.value);
                    });

                    console.log('Event listeners setup completed'); // 添加调试日志
                }

                async displayFileTree(dirHandle, parentElement) {
                    try {
                        parentElement.innerHTML = '';

                        const entries = [];
                        for await (const entry of dirHandle.values()) {
                            entries.push(entry);
                        }

                        // 排序：文件夹在前，文件在后
                        entries.sort((a, b) => {
                            if (a.kind !== b.kind) {
                                return a.kind === 'directory' ? -1 : 1;
                            }
                            return a.name.localeCompare(b.name);
                        });

                        for (const entry of entries) {
                            const item = document.createElement('div');
                            item.classList.add(entry.kind === 'file' ? 'file-item' : 'folder-item');
                            item.dataset.name = entry.name;

                            const itemContent = document.createElement('div');
                            itemContent.className = 'item-content';

                            const icon = document.createElement('span');
                            icon.className = entry.kind === 'file' ? 'file-icon' : 'folder-icon';
                            icon.textContent = entry.kind === 'file' ? '📄' : '📁';
                            itemContent.appendChild(icon);

                            const name = document.createElement('span');
                            name.className = 'item-name';
                            name.textContent = entry.name;
                            itemContent.appendChild(name);

                            item.appendChild(itemContent);

                            if (entry.kind === 'directory') {
                                const folderContent = document.createElement('div');
                                folderContent.className = 'folder-content';
                                item.appendChild(folderContent);

                                // 添加点击事件处理文件夹的展开/折叠
                                itemContent.addEventListener('click', async (e) => {
                                    e.stopPropagation();
                                    const isExpanded = item.classList.contains('expanded');

                                    if (!isExpanded) {
                                        try {
                                            // 展开文件夹
                                            item.classList.add('expanded');
                                            // 递归显示子文件夹内容
                                            await this.displayFileTree(entry, folderContent);
                                        } catch (err) {
                                            console.error('展开文件夹失败:', err);
                                            item.classList.remove('expanded');
                                        }
                                    } else {
                                        // 折叠文件夹
                                        item.classList.remove('expanded');
                                        folderContent.innerHTML = '';
                                    }
                                });
                            } else {
                                // 添加点击事件处理文件的打开
                                itemContent.addEventListener('click', async (e) => {
                                    e.stopPropagation();
                                    try {
                                        // 获取文件内容
                                        const file = await entry.getFile();
                                        const content = await file.text();

                                        // 更新编辑器和预览
                                        const notepad = document.getElementById('notepad');
                                        const preview = document.getElementById('preview');

                                        if (notepad && preview) {
                                            notepad.value = content;
                                            preview.innerHTML = marked.parse(content);

                                            // 保存当前文件信息到全局对象
                                            window.mymarkdowneditor.currentFileName = entry.name;
                                            window.fileExplorer.currentFile = entry;

                                            // 移除其他文件的活动状态
                                            document.querySelectorAll('.file-item').forEach(item => {
                                                item.classList.remove('active');
                                            });
                                            // 添加当前文件的活动状态
                                            item.classList.add('active');
                                        }
                                    } catch (err) {
                                        console.error('读���文件失败:', err);
                                        await showMessageDialog('读取文件失败: ' + err.message);
                                    }
                                });
                            }

                            parentElement.appendChild(item);
                        }
                    } catch (err) {
                        console.error('显示文件树失败:', err);
                        parentElement.innerHTML = `<div class="error">无法读取目录内容: ${err.message}</div>`;
                    }
                }


            }

            window.FileExplorer = FileExplorer;
            window.fileExplorer = new FileExplorer();
        }
    });

    // 最后注入 sidebar.js
    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['sidebar.js']
    });


}

async function handleMenuAction(action, entry) {
    console.log('handleMenuAction', action, entry);
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.display = 'none';

    try {
        switch (action) {
            case 'rename':
                const newName = await showInputDialog('重命名', entry.name);
                if (!newName || newName === entry.name) return;

                const renameResult = await chrome.runtime.sendMessage({
                    type: 'fileOperation',
                    action: 'rename',
                    data: { entry, newName }
                });

                if (renameResult.error) {
                    throw new Error(renameResult.error);
                }
                break;

            case 'duplicate':
                const duplicateResult = await chrome.runtime.sendMessage({
                    type: 'fileOperation',
                    action: 'duplicate',
                    data: { entry }
                });

                if (duplicateResult.error) {
                    throw new Error(duplicateResult.error);
                }
                break;

            case 'delete':
                if (!await showConfirmDialog(`确定要删除 "${entry.name}" 吗？`)) {
                    return;
                }

                const deleteResult = await chrome.runtime.sendMessage({
                    type: 'fileOperation',
                    action: 'delete',
                    data: { entry }
                });

                if (deleteResult.error) {
                    throw new Error(deleteResult.error);
                }
                break;
        }
    } catch (err) {
        console.error('操作失败:', err);
        await showMessageDialog('操作失败: ' + err.message);
    }
}




async function toggleSidebar(tab, visible) {
    if (!tab || !tab.id) return;

    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (shouldShow, tab) => {
                const container = document.getElementById('markdown-sidebar-container');
                const sidebar = document.querySelector('.md-sidebar');
                /* 如果侧边栏已经存在 */
                if (sidebar && container) {
                    if (shouldShow) {
                        sidebar.classList.remove('collapsed');
                        chrome.runtime.sendMessage({ type: "updateIcon", visible: true });
                        if (container) container.style.display = '';
                    } else {
                        sidebar.classList.add('collapsed');
                        if (container) container.style.display = 'none';
                        // 发送消息标签页
                        chrome.runtime.sendMessage({ type: "updateIcon", visible: false });
                    }
                } else {
                    // 注入资源如果切换的时候不存在则注入资源 并修改sidebarstatus的状态

                    chrome.runtime.sendMessage({ type: 'injectResources', tab: tab });
                    chrome.runtime.sendMessage({ type: "setSidebarStatus", tabId: tab.id, state: { injected: true, visible: true } })

                }
            },
            args: [visible, tab]
        });
    } catch (error) {
        console.error('切换侧边栏失败:', error);
    }
}

// 添加消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'get-directory-handle') {
        chrome.storage.local.get(['lastDirHandle'], (result) => {
            sendResponse(result.lastDirHandle);
        });
        return true;
    }
    if (message.type === 'toggleSidebar') {
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab) {
                toggleSidebar(tab, message.visible);
            }
        });
        return true;
    }
    if (message.type === 'injectResources') {
        injectResources(message.tab);
        return true;
    }
    if (message.type === 'directory-selected') {
        // 广播消息给所有标签页
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'directory-selected',
                    dirHandle: message.dirHandle
                });
            });
        });
    }

    /* 切换图标 */
    if (message.type === 'updateIcon') {
        const iconPath = message.visible ? 'image_orange_red.png' : 'sidebarnote-disactive.png';
        chrome.action.setIcon({ path: iconPath });
    }


    if (message.type === 'handleMenuAction') {
        // 获取当前标签页的 FileExplorer 实例
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            func: async (action, entry) => {
                const explorer = window.fileExplorer;
                if (!explorer || !explorer.currentPath) {
                    throw new Error('文件浏览器未初始化');
                }

                try {
                    switch (action) {
                        case 'rename':
                            const newName = await showInputDialog('重命名', entry.name);
                            if (!newName || newName === entry.name) return;

                            if (entry.kind === 'file' && !newName.toLowerCase().endsWith('.md')) {
                                throw new Error('文件名必须以.md结尾');
                            }

                            // 获取原文件内容
                            const oldFileHandle = await explorer.currentPath.getFileHandle(entry.name);
                            const oldFile = await oldFileHandle.getFile();
                            const content = await oldFile.text();

                            // 创建新文件并写入内容
                            const newHandle = await explorer.currentPath.getFileHandle(newName, { create: true });
                            const writable = await newHandle.createWritable();
                            await writable.write(content);
                            await writable.close();

                            // 删除旧文件
                            await explorer.currentPath.removeEntry(entry.name);
                            await explorer.displayFileTree(explorer.currentPath, explorer.fileTree);
                            break;

                        case 'duplicate':
                            const baseName = entry.name.replace(/\.md$/, '');
                            const extension = entry.kind === 'file' ? '.md' : '';
                            let duplicateName = `${baseName} - 副本${extension}`;
                            let counter = 1;

                            // 确保文件名不重复
                            while (true) {
                                try {
                                    await explorer.currentPath.getFileHandle(duplicateName);
                                    duplicateName = `${baseName} - 副本 (${counter})${extension}`;
                                    counter++;
                                } catch {
                                    break;
                                }
                            }

                            // 获取原文件内容
                            const sourceFileHandle = await explorer.currentPath.getFileHandle(entry.name);
                            const sourceFile = await sourceFileHandle.getFile();
                            const sourceContent = await sourceFile.text();

                            // 创建副本并写入内容
                            const duplicateHandle = await explorer.currentPath.getFileHandle(duplicateName, { create: true });
                            const duplicateWritable = await duplicateHandle.createWritable();
                            await duplicateWritable.write(sourceContent);
                            await duplicateWritable.close();

                            await explorer.displayFileTree(explorer.currentPath, explorer.fileTree);
                            break;

                        case 'delete':
                            if (await showConfirmDialog(`确定要删除 "${entry.name}" 吗？`)) {
                                await explorer.currentPath.removeEntry(entry.name, { recursive: true });
                                await explorer.displayFileTree(explorer.currentPath, explorer.fileTree);
                            }
                            break;
                    }
                } catch (err) {
                    console.error('文件操作失败:', err);
                    alert('操作失败: ' + err.message);
                }
            },
            args: [message.action, message.entry]
        });
        return true;
    }

    if (message.type === 'getSidebarStatus') {
        // 获取指定 tabId 的状态
        const tabId = message.tabId;
        console.log(sidebarStates)
        const state = sidebarStates.get(tabId) || { injected: false, visible: false };
        sendResponse(state);
    } else if (message.type === 'setSidebarStatus') {
        // 设置指定 tabId 的状态
        const { tabId, state } = message;
        if (!sidebarStates.has(tabId)) {
            sidebarStates.set(tabId, { injected: false, visible: false });
        }
        // 合并更新状态
        sidebarStates.set(tabId, { ...sidebarStates.get(tabId), ...state });
        sendResponse({ success: true });
    }

    // 添加文件操作相关的消息处理
    switch (message.type) {
        case 'fileOperation':
            handleFileOperation(message.action, message.data, sender.tab.id)
                .then(sendResponse)
                .catch(error => sendResponse({ error: error.message }));
            return true;

        // ... 其他现有的消息处理 ...
    }
});

// 添加存储权限处理
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.dirHandle) {
        const dirHandle = changes.dirHandle.newValue;
        // 通知所有标签页更新文件树
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: (handle) => {
                        const explorer = document.querySelector('.file-explorer');
                        if (explorer) {
                            explorer.dispatchEvent(new CustomEvent('directory-selected', {
                                detail: handle
                            }));
                        }
                    },
                    args: [dirHandle]
                });
            });
        });
    }
});

// 修改消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleSidebar') {
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
            if (tab) {
                toggleSidebar(tab, request.visible);
            }
        });
    }
    return true;
});

// 在新标签页加载完成时注入悬浮球
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url.startsWith('http')) {
        console.log('新标签页加载完成:', tabId);
        try {
            // 先注入样式
            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ['floatingBall.css']
            });

            // 注入 HTML
            const html = `
                <div id="floating-ball-container" data-tab-id="${tabId}">
                    <div id="md-floatingBall" class="floating-ball">
                        <span class="ball-icon">📝</span>
                    </div>
                </div>
            `;

            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (htmlContent, tab) => {
                    if (!document.getElementById('floating-ball-container')) {
                        const container = document.createElement('div');
                        container.innerHTML = htmlContent;
                        document.body.appendChild(container.firstElementChild);
                    }
                    const floatingBall = document.getElementById('md-floatingBall');
                    if (floatingBall) {
                        floatingBall.addEventListener('click', () => {
                            chrome.runtime.sendMessage({ action: 'toggleSidebar', visible: true });
                        });
                    }
                },
                args: [html, tab]
            });
        } catch (error) {
            console.error('注入悬浮球失败:', error);
        }
    }
});

// 文件操作处理函数
async function handleFileOperation(action, data, tabId) {
    try {
        console.log(data)
        switch (action) {
            case 'rename':
                return await renameFile(data.entry, data.newName, tabId);
            case 'duplicate':
                return await duplicateFile(data.entry, tabId);
            case 'delete':
                return await deleteFile(data.entry, tabId);
            default:
                throw new Error('未知的文件操作');
        }
    } catch (error) {
        console.error('文件操作失败:', error);
        throw error;
    }
}

// 文件操作具体实现
async function renameFile(entry, newName, tabId) {
    await chrome.scripting.executeScript({
        target: { tabId },
        func: async (entry, newName) => {
            const explorer = window.fileExplorer;
            if (!explorer || !explorer.currentPath) {
                throw new Error('文件浏览器未初始化');
            }

            try {
                // 验证新文件名
                if (entry.kind === 'file' && !newName.toLowerCase().endsWith('.md')) {
                    throw new Error('文件名必须以.md结尾');
                }

                const parentHandle = explorer.currentPath;

                // 先获取原文件内容
                if (entry.kind === 'file') {
                    // 获取原文件内容
                    const oldFileHandle = await parentHandle.getFileHandle(entry.name);
                    const oldFile = await oldFileHandle.getFile();
                    const content = await oldFile.text();

                    // 创建新文件并写入内容
                    const newHandle = await parentHandle.getFileHandle(newName, { create: true });
                    const writable = await newHandle.createWritable();
                    await writable.write(content);
                    await writable.close();

                    // 删除旧文件
                    await parentHandle.removeEntry(entry.name);
                } else {
                    // 处理文件夹重命名
                    const oldDirHandle = await parentHandle.getDirectoryHandle(entry.name);
                    const newDirHandle = await parentHandle.getDirectoryHandle(newName, { create: true });

                    // 递归复制文件夹内容
                    async function copyDirectory(source, target) {
                        for await (const [name, handle] of source) {
                            if (handle.kind === 'file') {
                                const file = await handle.getFile();
                                const content = await file.text();
                                const newFileHandle = await target.getFileHandle(name, { create: true });
                                const writable = await newFileHandle.createWritable();
                                await writable.write(content);
                                await writable.close();
                            } else {
                                const newSubDir = await target.getDirectoryHandle(name, { create: true });
                                await copyDirectory(handle, newSubDir);
                            }
                        }
                    }

                    await copyDirectory(oldDirHandle, newDirHandle);
                    await parentHandle.removeEntry(entry.name, { recursive: true });
                }

                // 刷新文件树
                await explorer.displayFileTree(explorer.currentPath, explorer.fileTree);
                return { success: true };
            } catch (error) {
                throw new Error(`重命名失败: ${error.message}`);
            }
        },
        args: [entry, newName]
    });
}

async function duplicateFile(entry, tabId) {
    await chrome.scripting.executeScript({
        target: { tabId },
        func: async (entry) => {
            const explorer = window.fileExplorer;
            if (!explorer || !explorer.currentPath) {
                throw new Error('文件浏览器未初始化');
            }

            const baseName = entry.name.replace(/\.md$/, '');
            const extension = entry.kind === 'file' ? '.md' : '';
            let newName = `${baseName} - 副本${extension}`;
            let counter = 1;

            while (true) {
                try {
                    await explorer.currentPath.getFileHandle(newName);
                    newName = `${baseName} - 副本 (${counter})${extension}`;
                    counter++;
                } catch {
                    break;
                }
            }

            try {
                if (entry.kind === 'file') {
                    const file = await entry.getFile();
                    const newHandle = await explorer.currentPath.getFileHandle(newName, { create: true });
                    const writable = await newHandle.createWritable();
                    await writable.write(await file.text());
                    await writable.close();
                } else {
                    const newHandle = await explorer.currentPath.getDirectoryHandle(newName, { create: true });
                    await explorer.copyDirectoryContent(entry, newHandle);
                }

                await explorer.displayFileTree(explorer.currentPath, explorer.fileTree);
                return { success: true };
            } catch (error) {
                throw new Error(`复制失败: ${error.message}`);
            }
        },
        args: [entry]
    });
}

async function deleteFile(entry, tabId) {
    await chrome.scripting.executeScript({
        target: { tabId },
        func: async (entry) => {
            const explorer = window.fileExplorer;
            if (!explorer || !explorer.currentPath) {
                throw new Error('文件浏览器未初始化');
            }

            try {
                await explorer.currentPath.removeEntry(entry.name, { recursive: true });
                await explorer.displayFileTree(explorer.currentPath, explorer.fileTree);
                return { success: true };
            } catch (error) {
                throw new Error(`删除失败: ${error.message}`);
            }
        },
        args: [entry]
    });
}
