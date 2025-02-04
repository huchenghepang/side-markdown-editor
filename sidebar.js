// 在文件开头添加初始化代码
if (!window.mymarkdowneditor) {
    window.mymarkdowneditor = {
        currentFileName: null
    };
}

// 在开头添加检查
function ensureFileExplorer() {
    if (!window.fileExplorer && window.FileExplorer) {
        console.log("执行")
        window.fileExplorer = new FileExplorer();
    }
}


/* 全局控制显示悬浮按钮 点击切换是否需要全局显示 还是通过浏览器工具栏图标切换显示 */
function toggleGlobalSettingFloatingButton() {

}

function initialize() {
    const container = document.getElementById('markdown-sidebar-container');
    const notepad = document.getElementById('notepad');
    const preview = document.getElementById('preview');
    const saveBtn = document.getElementById('saveBtn');

    // 获取所有控制按钮和区域
    const toggleFileExplorer = document.getElementById('toggleFileExplorer');
    const toggleEditor = document.getElementById('toggleEditor');
    const togglePreview = document.getElementById('togglePreview');

    const fileExplorerSection = document.getElementById('fileExplorerSection');
    const editorSection = document.getElementById('editorSection');
    const previewSection = document.getElementById('previewSection');
    const createNewArticle = document.getElementById('createNewArticle');
    const toggleFloatingBallBtn = document.getElementById("toggleFloatingBallGlobal");
    /* 可拖动元素 */
    const dragableElements = document.getElementsByClassName("dragable-md-editor")
    // 尺寸控制
    const sizeButtons = {
        small: document.getElementById('sizeSmall'),
        medium: document.getElementById('sizeMedium'),
        large: document.getElementById('sizeLarge'),
        full: document.getElementById('sizeFull')
    };

    const sizes = {
        small: 30,
        medium: 50,
        large: 70,
        full: 90
    };

    // 设置初始宽度
    const mainContainer = document.querySelector('.main-container');
    if (mainContainer) {
        const totalWidth = mainContainer.offsetWidth;
        const fileExplorerWidth = 250; // 默认宽度
        const remainingWidth = totalWidth - fileExplorerWidth;

        fileExplorerSection.style.width = `${fileExplorerWidth}px`;
        editorSection.style.width = `${remainingWidth * 0.5}px`;
        previewSection.style.width = `${remainingWidth * 0.5}px`;
    }

    // 绑定事件监听器
    if (toggleFileExplorer) {
        toggleFileExplorer.addEventListener('click', () => {
            toggleSection(toggleFileExplorer, fileExplorerSection);
        });
    }

    if (toggleEditor) {
        toggleEditor.addEventListener('click', () => {
            toggleSection(toggleEditor, editorSection);
        });
    }

    if (togglePreview) {
        togglePreview.addEventListener('click', () => {
            toggleSection(togglePreview, previewSection);
        });
    }

    // 绑定尺寸按钮事件
    Object.keys(sizeButtons).forEach(size => {
        if (sizeButtons[size]) {
            sizeButtons[size].addEventListener('click', () => {
                setSidebarSize(size, container, sizeButtons, sizes);
            });
        }
    });

    // Markdown 预览功能
    if (notepad && preview) {
        notepad.addEventListener('input', function () {
            const content = this.value;
            preview.innerHTML = marked.parse(content);
        });
    }

    // 加载保存的设置
    loadSavedSettings(container, toggleFileExplorer, toggleEditor, togglePreview,
        fileExplorerSection, editorSection, previewSection,
        notepad, preview, sizeButtons, sizes);

    // 通知页面 sidebar 已加载
    window.parent.postMessage({ type: 'sidebarLoaded' }, '*');

    // 添加新的保存按钮事件监听
    if (saveBtn) {
        saveBtn.removeEventListener('click', handleSave);  // 先移除可能存在的监听器
        saveBtn.addEventListener('click', handleSave);
    }

    // 添加新的另存为按钮事件监听
    const saveAsBtn = document.getElementById('saveAsBtn');
    if (saveAsBtn) {
        saveAsBtn.removeEventListener('click', handleSaveAs);  // 先移除可能存在的监听器
        saveAsBtn.addEventListener('click', handleSaveAs);
    }

    if (createNewArticle) {
        createNewArticle.removeEventListener('click', createNewArticleHandler)
        createNewArticle.addEventListener('click', createNewArticleHandler)
    }


    /* 切换全局悬浮按钮设置 */


    // 读取 storage 中保存的 floatingBallVisible 值
    chrome.storage.local.get(['floatingBallVisible'], function (result) {
        const isFloatingBallVisible = result.floatingBallVisible !== undefined ? result.floatingBallVisible : true;

        // 设置按钮的初始状态（根据 chrome.storage.local 中的值）
        if (isFloatingBallVisible) {
            toggleFloatingBallBtn.textContent = "隐藏悬浮按钮";
        } else {
            toggleFloatingBallBtn.textContent = "显示悬浮按钮";
        }

        // 监听按钮点击，切换浮动按钮的显示状态
        toggleFloatingBallBtn.addEventListener("click", function () {
            const newVisibility = !isFloatingBallVisible;
            chrome.storage.local.set({ "floatingBallVisible": newVisibility }, function () {
                // 切换按钮文本
                toggleFloatingBallBtn.textContent = newVisibility ? "隐藏悬浮按钮" : "显示悬浮按钮";

                // 发送事件，通知其他页面（或背景脚本）更新悬浮按钮的显示状态
                window.dispatchEvent(new Event('toggleFloatingButton'));
            });
        });
    });

    /* 拖动效果 */
    if(dragableElements){
        Array.from(dragableElements).forEach(dragableElement=>{
            dragableElement.onmousedown = dragableEventHandler;
            dragableElement.ondragstart  = function(){
                return false
            }
        })
    }

    // 初始化拖动调整功能
    initializeResizers();

    initializeToolbar();
    initializeTopResizer()
}
/* 拖动函数 */
function dragableEventHandler(event) {
    const header = event.target;
    header.classList.add("dragging-md-editor")
    const parentElement = header.closest("#markdown-sidebar-container");
    if (!parentElement) return;

    // 确保 parentElement 采用 fixed 定位（以视口为参考系）
    if (window.getComputedStyle(parentElement).position !== "fixed") {
        parentElement.style.position = "fixed";
    }
    parentElement.style.zIndex = 1000;


    // 获取元素当前位置，计算鼠标点击时相对于元素左上角的偏移量
    const parentRect = parentElement.getBoundingClientRect();
    const shiftX = event.clientX - parentRect.left;
    const shiftY = event.clientY - parentRect.top;

    function moveAt(clientX, clientY) {
        // 直接用鼠标 client 坐标计算新的 left 和 top
        const newLeft = clientX - shiftX;
        let newTop = clientY - shiftY;
        parentElement.style.left = newLeft + "px";
        parentElement.style.top = newTop + "px";
    }

    // 初次点击时更新位置
    moveAt(event.clientX, event.clientY);

    function onMouseMove(e) {
        moveAt(e.clientX, e.clientY);
    }

    document.addEventListener("mousemove", onMouseMove);

    function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        header.classList.remove("dragging-md-editor")
        if (parentElement.getBoundingClientRect().top < 0) {
            parentElement.style.top = 0
        }

        if(parentElement.getBoundingClientRect().left <0){
            parentElement.style.left = 0
        }
        
    }

    document.addEventListener("mouseup", onMouseUp);
}



function toggleSection(button, section) {
    if (!button || !section) return;

    console.log('Toggling section:', section.id);
    button.classList.toggle('active');
    section.classList.toggle('hidden');
    adjustLayout();

    saveViewState();
}

function adjustLayout() {
    const fileExplorerSection = document.getElementById('fileExplorerSection');
    const editorSection = document.getElementById('editorSection');
    const previewSection = document.getElementById('previewSection');

    const visibleSections = [fileExplorerSection, editorSection, previewSection]
        .filter(section => section && !section.classList.contains('hidden'));

    console.log('Visible sections:', visibleSections.length);

    if (visibleSections.length === 0) {
        // 至少保持一个区域可见
        editorSection.classList.remove('hidden');
        toggleEditor.classList.add('active');
        return;
    }

    // 调整各区域的宽度
    visibleSections.forEach(section => {
        if (section === fileExplorerSection) {
            section.style.width = '250px';
        } else {
            section.style.flex = `1 1 ${100 / (visibleSections.length - (visibleSections.includes(fileExplorerSection) ? 1 : 0))}%`;
        }
    });
}

function setSidebarSize(size, container, sizeButtons, sizes) {
    if (!container) return;

    console.log('Setting sidebar size:', size);
    const width = `${sizes[size]}%`;
    container.style.width = width;

    updateSizeButtons(size, sizeButtons);
    saveSidebarSize(size);
}

// 添加缺失的函数
function loadSavedSettings(container, toggleFileExplorer, toggleEditor, togglePreview,
    fileExplorerSection, editorSection, previewSection,
    notepad, preview, sizeButtons, sizes) {
    // 加载保存的尺寸
    chrome.storage.local.get(['sidebarSize'], function (result) {
        if (result.sidebarSize) {
            setSidebarSize(result.sidebarSize, container, sizeButtons, sizes);
        } else {
            setSidebarSize('medium', container, sizeButtons, sizes); // 默认中等尺寸
        }
    });

    // 加载保存的视图状态
    chrome.storage.local.get(['viewState'], function (result) {
        if (result.viewState) {
            const { fileExplorer, editor, preview: previewVisible } = result.viewState;
            if (!fileExplorer && toggleFileExplorer && fileExplorerSection) {
                toggleSection(toggleFileExplorer, fileExplorerSection);
            }
            if (!editor && toggleEditor && editorSection) {
                toggleSection(toggleEditor, editorSection);
            }
            if (!previewVisible && togglePreview && previewSection) {
                toggleSection(togglePreview, previewSection);
            }
        }
        adjustLayout();
    });

    // 加载保存的笔记内容
    chrome.storage.local.get(['notes'], function (result) {
        if (result.notes && notepad && preview) {
            notepad.value = result.notes;
            preview.innerHTML = marked.parse(result.notes);
        }
    });
}

function updateSizeButtons(size, sizeButtons) {
    if (!sizeButtons) return;

    Object.keys(sizeButtons).forEach(key => {
        if (sizeButtons[key]) {
            sizeButtons[key].classList.toggle('active', key === size);
        }
    });
}

function saveSidebarSize(size) {
    try {
        chrome.storage.local.set({ sidebarSize: size });
    } catch (error) {
        console.error
    }

}

function saveViewState() {
    const fileExplorerSection = document.getElementById('fileExplorerSection');
    const editorSection = document.getElementById('editorSection');
    const previewSection = document.getElementById('previewSection');

    if (!fileExplorerSection || !editorSection || !previewSection) return;

    const viewState = {
        fileExplorer: !fileExplorerSection.classList.contains('hidden'),
        editor: !editorSection.classList.contains('hidden'),
        preview: !previewSection.classList.contains('hidden')
    };
    chrome.storage.local.set({ viewState });
}

// 确保 FileExplorer 存在
ensureFileExplorer();

// 初始化
initialize();

// 添加自定义对话框函数
function showInputDialog(title, defaultValue = '') {
    return new Promise((resolve) => {
        const dialogHTML = `
            <div class="dialog-overlay">
                <div class="dialog-box">
                    <h3 class="dialog-title">${title}</h3>
                    <div class="dialog-content">
                        <input type="text" class="dialog-input" placeholder="输入文件名" value="${defaultValue}">
                        <div class="dialog-error" style="display: none; color: #ff4444; font-size: 12px; margin-top: 5px;">
                            请输入文件名
                        </div>
                    </div>
                    <div class="dialog-buttons">
                        <button class="dialog-btn dialog-btn-secondary" data-action="cancel">取消</button>
                        <button class="dialog-btn dialog-btn-primary" data-action="confirm">确定</button>
                    </div>
                </div>
            </div>
        `;

        const dialogElement = document.createElement('div');
        dialogElement.innerHTML = dialogHTML;
        document.body.appendChild(dialogElement.firstElementChild);

        const overlay = document.querySelector('.dialog-overlay');
        const input = overlay.querySelector('.dialog-input');
        const errorText = overlay.querySelector('.dialog-error');
        const buttons = overlay.querySelectorAll('.dialog-btn');

        input.focus();

        function closeDialog(value) {
            overlay.remove();
            resolve(value);
        }

        function validateAndClose() {
            const value = input.value.trim();
            if (!value) {
                errorText.style.display = 'block';
                input.focus();
                return;
            }
            closeDialog(value);
        }

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                if (button.dataset.action === 'confirm') {
                    validateAndClose();
                } else {
                    closeDialog(null);
                }
            });
        });

        // 按Enter确认，按Esc取消
        input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                validateAndClose();
            } else if (e.key === 'Escape') {
                closeDialog(null);
            }
            // 输入时隐藏错误提示
            errorText.style.display = 'none';
        });

        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog(null);
            }
        });
    });
}

// 添加显示消息对话框函数
function showMessageDialog(message) {
    return new Promise((resolve) => {
        const dialogHTML = `
            <div class="dialog-overlay">
                <div class="dialog-box">
                    <div class="dialog-content">
                        <p class="dialog-message">${message}</p>
                    </div>
                    <div class="dialog-buttons">
                        <button class="dialog-btn dialog-btn-primary" data-action="confirm">确定</button>
                    </div>
                </div>
            </div>
        `;

        const dialogElement = document.createElement('div');
        dialogElement.innerHTML = dialogHTML;
        document.body.appendChild(dialogElement.firstElementChild);

        const overlay = document.querySelector('.dialog-overlay');
        const confirmBtn = overlay.querySelector('.dialog-btn');

        function closeDialog() {
            overlay.remove();
            resolve();
        }

        confirmBtn.addEventListener('click', closeDialog);

        // 按Enter或Esc关闭
        document.addEventListener('keyup', function handler(e) {
            if (e.key === 'Enter' || e.key === 'Escape') {
                document.removeEventListener('keyup', handler);
                closeDialog();
            }
        });

        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeDialog();
            }
        });
    });
}

// 添加内容验证函数
function validateContent(content) {
    if (!content || !content.trim()) {
        showMessageDialog('笔记内容不能为空！');
        return false;
    }
    return true;
}

async function createNewArticleHandler(params) {
    try {
        const notepad = document.getElementById('notepad');
        const preview = document.getElementById('preview');
        /* 清空编辑区域内容 */
        notepad.value = '';
        /* 清空当前选择的文件*/
        if (window.fileExplorer && window.fileExplorer.currentFile) {
            window.fileExplorer.currentFile = null;
        }

        if (window.mymarkdowneditor.currentFileName) {
            window.mymarkdowneditor.currentFileName = null;
        }
        if (preview) {
            preview.innerHTML = '';
        }
    } catch (error) {
        console.error('清空编辑区域内容失败:', err);
    }

}

// 修改保存处理函数
async function handleSave() {
    const notepad = document.getElementById('notepad');
    const content = notepad.value;

    // 验证内容
    if (!validateContent(content)) {
        return;
    }

    try {
        // 如果当前正在编辑某个文件，直接更新该文件
        if (window.fileExplorer && window.fileExplorer.currentFile) {
            try {
                await window.fileExplorer.currentFile.requestPermission({ mode: 'readwrite' });
                const writable = await window.fileExplorer.currentFile.createWritable();
                await writable.write(content);
                await writable.close();
                await showMessageDialog('文件保存成功！');
                return;
            } catch (err) {
                console.warn('文件句柄无效，尝试重新保存:', err);
                window.fileExplorer.currentFile = null;
            }
        }

        // 如果有打开的文件夹，保存在当前文件夹
        if (window.fileExplorer && window.fileExplorer.currentPath) {
            try {
                await window.fileExplorer.currentPath.requestPermission({ mode: 'readwrite' });

                // 获取默认文件名：优先使用全局保存的文件名
                let defaultFileName = window.mymarkdowneditor.currentFileName ?
                    window.mymarkdowneditor.currentFileName.replace(/\.md$/, '') : 'note';

                const fileName = await showInputDialog('保存文件', defaultFileName);
                if (!fileName) return;

                const fileHandle = await window.fileExplorer.currentPath.getFileHandle(fileName + '.md', { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();

                window.fileExplorer.currentFile = fileHandle;
                window.mymarkdowneditor.currentFileName = fileName + '.md';  // 更新全局文件名
                await window.fileExplorer.displayFileTree(window.fileExplorer.currentPath, window.fileExplorer.fileTree);
                await showMessageDialog('文件保存成功！');
                return;
            } catch (err) {
                console.error('保存到文件夹失败:', err);
                if (err.name === 'InvalidStateError') {
                    window.fileExplorer.currentPath = null;
                    window.fileExplorer.currentFile = null;
                    window.mymarkdowneditor.currentFileName = null;  // 清全局文件名
                } else {
                    throw err;
                }
            }
        }

        // 如果没有有效的文件夹句柄，则下载文件
        // 同样使用全局文件名作为默认值
        let defaultFileName = window.mymarkdowneditor.currentFileName ?
            window.mymarkdowneditor.currentFileName.replace(/\.md$/, '') : 'note';
        const fileName = await showInputDialog('保存文件', defaultFileName);
        if (fileName) {
            saveToFile(fileName + '.md', content);
            await showMessageDialog('文件下载成功！');
        }
    } catch (err) {
        console.error('保存失败:', err);
        await showMessageDialog('保存失败: ' + err.message);
    }
}

// 修改另存为处理函数
async function handleSaveAs() {
    const notepad = document.getElementById('notepad');
    const content = notepad.value;

    // 验证内容
    if (!validateContent(content)) {
        return;
    }

    try {
        // 如果有打开的文件夹，保存在当前文件夹
        if (window.fileExplorer && window.fileExplorer.currentPath) {
            try {
                await window.fileExplorer.currentPath.requestPermission({ mode: 'readwrite' });
                const fileName = await showInputDialog('另存为', 'new_note');
                if (!fileName) return;

                const fileHandle = await window.fileExplorer.currentPath.getFileHandle(fileName + '.md', { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();

                window.fileExplorer.currentFile = fileHandle;
                await window.fileExplorer.displayFileTree(window.fileExplorer.currentPath, window.fileExplorer.fileTree);
                await showMessageDialog('文件保存成功！');
                return;
            } catch (err) {
                console.error('保存到文件夹失败:', err);
                if (err.name === 'InvalidStateError') {
                    window.fileExplorer.currentPath = null;
                    window.fileExplorer.currentFile = null;
                } else {
                    throw err;
                }
            }
        }

        // 如果没有有效的文件夹句柄，则下载文件
        const fileName = await showInputDialog('另存为', 'new_note');
        if (fileName) {
            saveToFile(fileName + '.md', content);
            await showMessageDialog('文件下载成功！');
        }
    } catch (err) {
        console.error('另存为失败:', err);
        await showMessageDialog('另存为失败: ' + err.message);
    }
}

// 保存文件的通用函数
function saveToFile(fileName, content) {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 添加拖动调整功能
function initializeResizers() {
    const fileExplorerResizer = document.querySelector('.file-explorer-resizer');
    const editorResizer = document.querySelector('.editor-resizer');
    const sidebarResizer = document.querySelector('.sidebar-resizer');
    const editorLeftResizer = document.querySelector('.editor-left-resizer');
    const previewLeftResizer = document.querySelector('.preview-left-resizer');

    const fileExplorerSection = document.getElementById('fileExplorerSection');
    const editorSection = document.getElementById('editorSection');
    const previewSection = document.getElementById('previewSection');
    const sidebar = document.querySelector('.md-sidebar');
    const mdChatgptTomarkdown = document.getElementById('md-chatgptTomarkdown');

    /*  */

    let isResizing = false;
    let currentResizer = null;
    let startX = 0;
    let startWidth = 0;
    let startWidthEditor = 0;
    let startWidthFileExplorer = 0;
    let startWidthPreview = 0;

    // 处理开始拖动
    function startResize(e, resizer, element) {
        isResizing = true;
        currentResizer = resizer;
        startX = e.clientX;

        // 添加禁用文本选择的类
        document.body.classList.add('disable-selection');

        if (resizer === editorLeftResizer) {
            startWidthEditor = editorSection.offsetWidth;
            startWidthFileExplorer = fileExplorerSection.offsetWidth;
        } else if (resizer === previewLeftResizer) {
            startWidthPreview = previewSection.offsetWidth;
            startWidthEditor = editorSection.offsetWidth;
        } else {
            startWidth = element.offsetWidth;
        }

        document.body.style.cursor = 'ew-resize';
        element.classList.add('resizing');

        // 阻止默认事件和冒泡
        e.preventDefault();
        e.stopPropagation();

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResize);
    }

    // 处理拖动过程
    function handleMouseMove(e) {
        if (!isResizing) return;

        // 阻止默认事件和冒泡
        e.preventDefault();
        e.stopPropagation();

        const delta = e.clientX - startX;

        if (currentResizer === editorLeftResizer) {
            const newFileExplorerWidth = startWidthFileExplorer + delta;
            const newEditorWidth = startWidthEditor - delta;

            if (newFileExplorerWidth >= 100 && newFileExplorerWidth <= 500 &&
                newEditorWidth >= 100) {
                fileExplorerSection.style.width = `${newFileExplorerWidth}px`;
                editorSection.style.width = `${newEditorWidth}px`;
            }
        } else if (currentResizer === previewLeftResizer) {
            const newEditorWidth = startWidthEditor + delta;
            const newPreviewWidth = startWidthPreview - delta;

            // 确保两个区域都不小于最小宽度
            if (newEditorWidth >= 100 && newPreviewWidth >= 100) {
                // 使用 flex-basis 而不是 width 来调整大小
                editorSection.style.width = `${newEditorWidth}px`;
                previewSection.style.width = `${newPreviewWidth}px`;

                // 强制重新计算布局
                editorSection.style.flexBasis = `${newEditorWidth}px`;
                previewSection.style.flexBasis = `${newPreviewWidth}px`;
            }
        } else if (currentResizer === fileExplorerResizer) {
            const newWidth = startWidth + delta;
            fileExplorerSection.style.width = `${Math.max(100, Math.min(100, newWidth))}px`;
        } else if (currentResizer === editorResizer) {
            const newWidth = startWidth + delta;
            editorSection.style.width = `${Math.max(200, Math.min(window.innerWidth * 0.8, newWidth))}px`;
        } else if (currentResizer === sidebarResizer) {
            const container = document.getElementById('markdown-sidebar-container');
            const newWidth = window.innerWidth - e.clientX;
            container.style.width = `${Math.max(100, Math.min(window.innerWidth * 0.9, newWidth))}px`;
        }
    }

    // 处理结束拖动
    function stopResize() {
        if (!isResizing) return;

        isResizing = false;

        // 移除禁用文本选择的类
        document.body.classList.remove('disable-selection');

        document.body.style.cursor = 'default';

        if (currentResizer === fileExplorerResizer) {
            fileExplorerSection.classList.remove('resizing');
        } else if (currentResizer === editorResizer) {
            editorSection.classList.remove('resizing');
        } else if (currentResizer === editorLeftResizer) {
            editorSection.classList.remove('resizing');
        } else if (currentResizer === previewLeftResizer) {
            previewSection.classList.remove('resizing');
        }

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResize);
        currentResizer = null;
    }

    // 绑定事件监听器时添加阻止默认行为
    if (fileExplorerResizer) {
        fileExplorerResizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startResize(e, fileExplorerResizer, fileExplorerSection);
        });
    }

    if (editorResizer) {
        editorResizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startResize(e, editorResizer, editorSection);
        });
    }

    if (sidebarResizer) {
        sidebarResizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startResize(e, sidebarResizer, sidebar);
        });
    }

    if (editorLeftResizer) {
        editorLeftResizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startResize(e, editorLeftResizer, editorSection);
        });
    }

    if (previewLeftResizer) {
        previewLeftResizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startResize(e, previewLeftResizer, previewSection);
        });
    }

    /* 绑定点击chatgpt转markdown的事件 */
    if (mdChatgptTomarkdown) {
        mdChatgptTomarkdown.addEventListener('click', chatgptCovrtMarkdown);
    }
}

function initializeToolbar() {
    const notepad = document.getElementById('notepad');
    const toolbar = document.querySelector('.editor-toolbar');

    if (!toolbar || !notepad) return;

    const formats = {
        heading: {
            action: (level = 3) => {
                const prefix = '#'.repeat(level) + ' ';
                insertFormat(prefix, '标题');
            }
        },
        bold: () => wrapFormat('**', '**', '粗体文本'),
        italic: () => wrapFormat('*', '*', '斜体文本'),
        link: () => wrapFormat('[', '](url)', '链接文本'),
        image: () => insertFormat('![图片描述](图片URL)\n'),
        code: () => wrapFormat('\n```\n', '\n```\n', '代码块'),
        ul: () => insertFormat('- ', '列表项'),
        ol: () => insertFormat('1. ', '列表项'),
        task: () => insertFormat('- [ ] ', '任务项'),
        table: () => insertFormat(`| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容 | 内容 | 内容 |\n`),
        quote: () => insertFormat('> ', '引用文本'),
        hr: () => insertFormat('\n---\n')
    };

    function getSelection() {
        return {
            start: notepad.selectionStart,
            end: notepad.selectionEnd,
            text: notepad.value.substring(notepad.selectionStart, notepad.selectionEnd)
        };
    }

    function insertText(text, start, end) {
        notepad.focus();
        notepad.setSelectionRange(start, end);
        document.execCommand('insertText', false, text);
    }

    function wrapFormat(prefix, suffix, placeholder) {
        const sel = getSelection();
        const text = sel.text || placeholder;
        const newText = prefix + text + suffix;
        insertText(newText, sel.start, sel.start + newText.length);
    }

    function insertFormat(prefix, placeholder = '') {
        const sel = getSelection();
        const text = sel.text || placeholder;
        const newText = prefix + text;
        insertText(newText, sel.start, sel.start + newText.length);
    }

    toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.toolbar-btn, .heading-item');
        if (!btn) return;

        if (btn.classList.contains('heading-item')) {
            const level = parseInt(btn.dataset.level);
            formats.heading.action(level);
        } else {
            const format = btn.dataset.format;
            const formatter = formats[format];

            if (typeof formatter === 'function') {
                formatter();
            } else if (formatter && formatter.action) {
                formatter.action();
            }
        }

        // 触发预览更新
        notepad.dispatchEvent(new Event('input'));
    });

    // 添加标题快捷键
    notepad.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            const num = parseInt(e.key);
            if (num >= 1 && num <= 6) {
                e.preventDefault();
                formats.heading.action(num);
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    formats.bold();
                    break;
                case 'i':
                    e.preventDefault();
                    formats.italic();
                    break;
                case 'k':
                    e.preventDefault();
                    formats.link();
                    break;
            }
        }
    });
}

class FileExplorer {
    constructor() {
        this.initializeWhenReady();
    }

    async displayFileTree(dirHandle, parentElement) {
        try {
            parentElement.innerHTML = '';
            const entries = [];
            for await (const entry of dirHandle.values()) {
                entries.push(entry);
            }

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
                item.dataset.type = entry.kind;
                item.dataset.entry = JSON.stringify(entry);  // 存储条目信息

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

                parentElement.appendChild(item);
            }

            // 绑定右键菜单项的点击事件
            const contextMenu = document.getElementById('contextMenu');
            if (contextMenu) {
                contextMenu.querySelectorAll('.menu-item').forEach(menuItem => {
                    menuItem.addEventListener('click', async (e) => {
                        const action = menuItem.dataset.action;
                        const activeItem = document.querySelector('.file-item.active, .folder-item.active');
                        if (activeItem) {
                            const entry = JSON.parse(activeItem.dataset.entry);
                            await this.handleMenuAction(action, entry);
                            contextMenu.style.display = 'none';
                        }
                    });
                });
            }
        } catch (err) {
            console.error('显示文件树失败:', err);
            parentElement.innerHTML = `<div class="error">无法读取目录内容: ${err.message}</div>`;
        }
    }


}

function initializeTopResizer() {
    const sidebarContainer = document.querySelector('.md-sidebar');
    if (!sidebarContainer) return;

    // 创建顶部拖动条
    const topResizer = document.createElement('div');
    topResizer.classList.add('top-resizer');
    sidebarContainer.insertBefore(topResizer, sidebarContainer.firstChild);

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    topResizer.style.cursor = 'ns-resize'; 

    // 监听鼠标按下事件
    topResizer.addEventListener('mousedown', function (e) {
        isResizing = true;
        startY = e.clientY; // 鼠标初始位置
        startHeight = sidebarContainer.offsetHeight; // 初始高度
        document.body.classList.add('disable-selection'); // 防止页面文本选择
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResizing);
    });

    // 处理鼠标拖动
    function handleMouseMove(e) {
        if (!isResizing) return;

        const viewportHeight = window.innerHeight; // 获取视口高度
        const newHeight = startHeight + (startY - e.clientY); // 计算新的高度

        // 将高度限制在 100px 到视口高度之间
        sidebarContainer.style.height = `${Math.max(Math.min(newHeight, viewportHeight), 100)}px`;
    }

    // 停止拖动
    function stopResizing() {
        isResizing = false;
        document.body.classList.remove('disable-selection');
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResizing);
    }
}



// 添加确认对话框函数
async function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const dialogHTML = `
            <div class="dialog-overlay">
                <div class="dialog-box">
                    <div class="dialog-content">
                        <p class="dialog-message">${message}</p>
                    </div>
                    <div class="dialog-buttons">
                        <button class="dialog-btn dialog-btn-secondary" data-action="cancel">取消</button>
                        <button class="dialog-btn dialog-btn-danger" data-action="confirm">删除</button>
                    </div>
                </div>
            </div>
        `;

        const dialogElement = document.createElement('div');
        dialogElement.innerHTML = dialogHTML;
        document.body.appendChild(dialogElement.firstElementChild);

        const overlay = document.querySelector('.dialog-overlay');
        const buttons = overlay.querySelectorAll('.dialog-btn');

        buttons.forEach(button => {
            button.addEventListener('click', () => {
                overlay.remove();
                resolve(button.dataset.action === 'confirm');
            });
        });
    });
}


/* 点击触发转换chatgpt转markdown */
async function chatgptCovrtMarkdown() {
    try {
        /* 判断当前网站是否是chatgpt官网 */
        const url = window.location.href;
        if (!url.includes('chatgpt.com')) {
            showMessageDialog("请在chatgpt官网进行转换")
            return
        }

        const htmlElements = document.querySelectorAll('.markdown');
        /* 排除的指定类名列表 */
        const excludeClasses = ["dark:border-token-text-secondary","border-token-text-secondary","first:mt-0"]; // 要排除的类名
        const content = batchHtmlConvertMarkdown(htmlElements, excludeClasses).join('\n\n');
        await createNewArticleHandler();
        const notepad = document.getElementById('notepad');
        const preview = document.getElementById('preview');
        if (notepad && preview) {
            notepad.value = content;
            preview.innerHTML = window.marked.parse(content);
        }
    } catch (error) {
        console.log(error)
        showConfirmDialog("转换失败")
    }

}





/* 批量转换html内容为markdown，排除指定类名的元素 */
function batchHtmlConvertMarkdown(htmlElements, excludeClassNames = []) {
    const markdownBlocks = Array.from(htmlElements).map((elem) => {
        // 检查元素是否包含排除的类名
        if (excludeClassNames.some(className => elem.classList.contains(className))) {
            return ''; // 如果包含指定类名，跳过转换，返回空字符串
        }
        // 否则进行转换
        return window.TurndownService.turndown(elem) + "\n\n";
    }).filter(block => block !== ''); // 过滤掉空字符串

    return markdownBlocks;
}

