// ============================================
// WINDOW MANAGER MODULE
// Handles window dragging and management
// ============================================

class WindowManager {
    constructor() {
        this.windows = new Map();
        this.zIndexCounter = 1000;
    }
    
    init() {
        // Make existing windows draggable
        const windows = document.querySelectorAll('.window');
        windows.forEach(win => {
            const titleBar = win.querySelector('.title-bar');
            if (titleBar) {
                this.makeWindowDraggable(win, titleBar);
            }
            this.makeWindowResizable(win);
            // Ensure inner body fills window height for proper resizing
            const body = win.querySelector('.window-body');
            if (body) {
                body.style.height = 'calc(100% - 24px)';
                body.style.boxSizing = 'border-box';
            }
        });
    }

    /**
     * Create a standard Win95-style window shell with title bar and body.
     * Returns { windowEl, titleBar, body, controls }.
     */
    createWindowShell({
        title = 'Window',
        className = '',
        width = '600px',
        height = '400px',
        top = '100px',
        left = '120px',
        controls = { minimize: true, maximize: true, close: true }
    } = {}) {
        const desktop = document.querySelector('.desktop') || document.body;
        const win = document.createElement('div');
        win.className = `window ${className}`.trim();
        Object.assign(win.style, { width, height, top, left, position: 'absolute', zIndex: (++this.zIndexCounter).toString() });

        const titleBar = document.createElement('div');
        titleBar.className = 'title-bar';
        const btnMin = controls.minimize ? '<button class="title-bar-btn" data-action="min">_</button>' : '';
        const btnMax = controls.maximize ? '<button class="title-bar-btn" data-action="max">□</button>' : '';
        const btnClose = controls.close ? '<button class="title-bar-btn" data-action="close">X</button>' : '';
        titleBar.innerHTML = `
            <div class="title-bar-text">
                <div class="title-bar-icon"></div>
                ${title}
            </div>
            <div class="title-bar-controls">${btnMin}${btnMax}${btnClose}</div>
        `;

        const body = document.createElement('div');
        body.className = 'window-body';
        body.style.height = 'calc(100% - 24px)';
        body.style.padding = '0';

        win.appendChild(titleBar);
        win.appendChild(body);
        desktop.appendChild(win);

        this.makeWindowDraggable(win, titleBar);
        this.makeWindowResizable(win);

        const controlsEls = titleBar.querySelectorAll('.title-bar-btn');
        return { windowEl: win, titleBar, body, controls: controlsEls };
    }
    
    makeWindowDraggable(windowElement, handleElement) {
        let isDragging = false;
        let currentX, currentY, initialX, initialY;
        
        const onMouseDown = (e) => {
            // Don't drag if clicking on buttons
            if (e.target.closest('.title-bar-btn')) return;
            
            isDragging = true;
            initialX = e.clientX - windowElement.offsetLeft;
            initialY = e.clientY - windowElement.offsetTop;
            
            // Bring window to front
            windowElement.style.zIndex = ++this.zIndexCounter;
            
            e.preventDefault();
        };
        
        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            // Keep window within viewport
            const maxX = window.innerWidth - windowElement.offsetWidth;
            const maxY = window.innerHeight - windowElement.offsetHeight - 28; // 28px for taskbar
            
            currentX = Math.max(0, Math.min(currentX, maxX));
            currentY = Math.max(0, Math.min(currentY, maxY));
            
            windowElement.style.left = currentX + 'px';
            windowElement.style.top = currentY + 'px';
        };
        
        const onMouseUp = () => {
            isDragging = false;
        };
        
        handleElement.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        // Store cleanup function
        this.windows.set(windowElement, {
            cleanup: () => {
                handleElement.removeEventListener('mousedown', onMouseDown);
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            }
        });
    }

    makeWindowResizable(windowElement) {
        if (!windowElement || windowElement.dataset.resizable === '1') return;
        windowElement.dataset.resizable = '1';

        const handles = [
            { dir: 'n', cursor: 'ns-resize' },
            { dir: 's', cursor: 'ns-resize' },
            { dir: 'e', cursor: 'ew-resize' },
            { dir: 'w', cursor: 'ew-resize' },
            { dir: 'ne', cursor: 'nesw-resize' },
            { dir: 'nw', cursor: 'nwse-resize' },
            { dir: 'se', cursor: 'nwse-resize' },
            { dir: 'sw', cursor: 'nesw-resize' },
        ];

        handles.forEach(h => {
            const el = document.createElement('div');
            el.className = `resize-handle resize-${h.dir}`;
            el.style.cursor = h.cursor;
            windowElement.appendChild(el);
        });

        const minW = 260;
        const minH = 160;
        let startX = 0, startY = 0, startW = 0, startH = 0, startL = 0, startT = 0, dir = '';
        const onMouseMove = (e) => {
            if (!dir) return;
            e.preventDefault();
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let newW = startW;
            let newH = startH;
            let newL = startL;
            let newT = startT;

            if (dir.includes('e')) newW = Math.max(minW, startW + dx);
            if (dir.includes('s')) newH = Math.max(minH, startH + dy);
            if (dir.includes('w')) {
                newW = Math.max(minW, startW - dx);
                newL = startL + (startW - newW);
            }
            if (dir.includes('n')) {
                newH = Math.max(minH, startH - dy);
                newT = startT + (startH - newH);
            }

            const maxW = window.innerWidth - newL;
            const maxH = window.innerHeight - 28 - newT;
            newW = Math.min(newW, maxW);
            newH = Math.min(newH, maxH);

            windowElement.style.width = `${newW}px`;
            windowElement.style.height = `${newH}px`;
            windowElement.style.left = `${Math.max(0, newL)}px`;
            windowElement.style.top = `${Math.max(0, newT)}px`;
        };

        const onMouseUp = () => {
            if (!dir) return;
            dir = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        windowElement.querySelectorAll('.resize-handle').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                dir = Array.from(handle.classList).find(c => c.startsWith('resize-')).replace('resize-', '');
                startX = e.clientX;
                startY = e.clientY;
                startW = windowElement.offsetWidth;
                startH = windowElement.offsetHeight;
                startL = windowElement.offsetLeft;
                startT = windowElement.offsetTop;
                windowElement.style.zIndex = ++this.zIndexCounter;
                e.preventDefault();
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }
    
    closeWindow(windowElement) {
        const windowData = this.windows.get(windowElement);
        if (windowData && windowData.cleanup) {
            windowData.cleanup();
        }
        this.windows.delete(windowElement);
        
        if (windowElement && windowElement.parentNode) {
            windowElement.remove();
        }
    }
    
    minimizeWindow(windowElement) {
        if (windowElement) {
            windowElement.style.display = 'none';
        }
    }
    
    restoreWindow(windowElement) {
        if (windowElement) {
            windowElement.style.display = 'block';
            windowElement.style.zIndex = ++this.zIndexCounter;
        }
    }
}

// Create global instance
const windowManager = new WindowManager();
