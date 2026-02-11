;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  class ContextMenu {
    #desktopEl;
    #windowManager;
    #appLauncher;
    #menuEl = null;
    #subMenuEl = null;

    constructor(desktopEl, windowManager, appLauncher) {
      this.#desktopEl = desktopEl;
      this.#windowManager = windowManager;
      this.#appLauncher = appLauncher;
      this.#init();
    }

    /**
     * Launch the Task Manager (called from taskbar context menu too).
     */
    launchTaskManager() {
      if (this.#appLauncher?.getApp('task-manager'))
        this.#appLauncher.launch('task-manager');
    }

    #init() {
      this.#menuEl = document.createElement('div');
      this.#menuEl.className = 'sz-context-menu';
      document.body.appendChild(this.#menuEl);

      this.#subMenuEl = document.createElement('div');
      this.#subMenuEl.className = 'sz-context-menu sz-context-submenu';
      document.body.appendChild(this.#subMenuEl);

      this.#subMenuEl.addEventListener('pointerleave', () => {
        this.#subMenuEl.style.display = 'none';
      });

      // Desktop right-click
      this.#desktopEl.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.sz-window') || e.target.closest('#sz-taskbar'))
          return;
        e.preventDefault();
        this.#showDesktopMenu(e.clientX, e.clientY);
      });

      // Taskbar right-click
      const taskbar = document.getElementById('sz-taskbar');
      if (taskbar) {
        taskbar.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.#showTaskbarMenu(e.clientX, e.clientY);
        });
      }

      // Close on click outside
      document.addEventListener('pointerdown', (e) => {
        if (!this.#menuEl.contains(e.target) && !this.#subMenuEl.contains(e.target))
          this.#close();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape')
          this.#close();
      });
    }

    #showDesktopMenu(x, y) {
      this.#close();

      const items = [
        {
          label: 'Arrange Icons By',
          submenu: [
            { label: 'Name', action: () => {} },
            { label: 'Size', action: () => {} },
            { label: 'Type', action: () => {} },
            { separator: true },
            { label: 'Auto Arrange', checked: true, action: () => {} },
          ]
        },
        { separator: true },
        { label: 'Refresh', action: () => location.reload() },
        { separator: true },
        {
          label: 'New',
          submenu: [
            { label: 'Folder', action: () => {} },
            { label: 'Shortcut', action: () => {} },
            { label: 'Text Document', action: () => {} },
          ]
        },
        { separator: true },
        {
          label: 'Properties',
          action: () => {
            if (this.#appLauncher?.getApp('control-panel'))
              this.#appLauncher.launch('control-panel', { tab: 'background' });
          }
        },
      ];

      this.#renderMenu(this.#menuEl, items, x, y);
    }

    #showTaskbarMenu(x, y) {
      this.#close();

      const items = [
        {
          label: 'Toolbars',
          submenu: [
            { label: 'Quick Launch', checked: false, action: () => {} },
            { label: 'Desktop', checked: false, action: () => {} },
          ]
        },
        { separator: true },
        {
          label: 'Cascade Windows',
          action: () => this.#windowManager.cascadeWindows()
        },
        {
          label: 'Tile Windows Horizontally',
          action: () => this.#windowManager.tileHorizontally()
        },
        {
          label: 'Tile Windows Vertically',
          action: () => this.#windowManager.tileVertically()
        },
        {
          label: 'Show the Desktop',
          action: () => {
            for (const win of this.#windowManager.allWindows)
              if (win.state !== 'minimized')
                this.#windowManager.minimizeWindow(win.id);
          }
        },
        { separator: true },
        {
          label: 'Task Manager',
          bold: true,
          action: () => this.launchTaskManager()
        },
        { separator: true },
        {
          label: 'Properties',
          action: () => {
            if (this.#appLauncher?.getApp('control-panel'))
              this.#appLauncher.launch('control-panel', { tab: 'taskbar' });
          }
        },
      ];

      this.#renderMenu(this.#menuEl, items, x, y, true);
    }

    #renderMenu(menuEl, items, x, y, fromBottom = false) {
      menuEl.innerHTML = '';

      for (const item of items) {
        if (item.separator) {
          const sep = document.createElement('div');
          sep.className = 'sz-ctx-separator';
          menuEl.appendChild(sep);
          continue;
        }

        const el = document.createElement('div');
        el.className = 'sz-ctx-item';
        if (item.bold)
          el.style.fontWeight = 'bold';

        if (item.checked) {
          const check = document.createElement('span');
          check.className = 'sz-ctx-check';
          check.textContent = '\u2713';
          el.appendChild(check);
        }

        const label = document.createElement('span');
        label.className = 'sz-ctx-label';
        label.textContent = item.label;
        el.appendChild(label);

        if (item.submenu) {
          const arrow = document.createElement('span');
          arrow.className = 'sz-ctx-arrow';
          arrow.textContent = '\u25B6';
          el.appendChild(arrow);

          el.addEventListener('pointerenter', () => {
            const rect = el.getBoundingClientRect();
            this.#renderMenu(
              this.#subMenuEl,
              item.submenu,
              rect.right - 2,
              rect.top,
            );
          });
        } else {
          el.addEventListener('pointerenter', () => {
            setTimeout(() => {
              if (!this.#subMenuEl.matches(':hover'))
                this.#subMenuEl.style.display = 'none';
            }, 50);
          });
        }

        el.addEventListener('click', () => {
          if (!item.submenu) {
            this.#close();
            if (item.action) item.action();
          }
        });

        menuEl.appendChild(el);
      }

      menuEl.style.display = 'block';
      const menuRect = menuEl.getBoundingClientRect();
      const finalX = Math.min(x, window.innerWidth - menuRect.width - 4);
      let finalY;
      if (fromBottom)
        finalY = Math.max(0, y - menuRect.height);
      else
        finalY = Math.min(y, window.innerHeight - menuRect.height - 4);

      menuEl.style.left = `${Math.max(0, finalX)}px`;
      menuEl.style.top = `${Math.max(0, finalY)}px`;
    }

    #close() {
      this.#menuEl.style.display = 'none';
      this.#subMenuEl.style.display = 'none';
    }
  }

  SZ.ContextMenu = ContextMenu;
})();
