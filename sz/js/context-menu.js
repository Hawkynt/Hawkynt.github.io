;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /** Viewport-edge padding in px. */
  const EDGE_PAD = 4;

  /** Scroll-arrow repeat interval in ms. */
  const SCROLL_INTERVAL = 50;

  /** Pixels scrolled per tick. */
  const SCROLL_STEP = 24;

  // Small inline SVG icons for context menu items
  const _CTX = {
    arrange: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="5" height="5" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/><rect x="9" y="2" width="5" height="5" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/><rect x="2" y="9" width="5" height="5" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/><rect x="9" y="9" width="5" height="5" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/></svg>',
    name:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><line x1="2" y1="4" x2="14" y2="4" stroke="#6b7280" stroke-width="1"/><line x1="2" y1="8" x2="10" y2="8" stroke="#6b7280" stroke-width="1"/><line x1="2" y1="12" x2="12" y2="12" stroke="#6b7280" stroke-width="1"/></svg>',
    size:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="2" width="10" height="12" rx="1" fill="#e5e7eb" stroke="#6b7280" stroke-width=".6"/><line x1="5" y1="5" x2="11" y2="5" stroke="#6b7280" stroke-width=".6"/><line x1="5" y1="7.5" x2="9" y2="7.5" stroke="#6b7280" stroke-width=".6"/><line x1="5" y1="10" x2="11" y2="10" stroke="#6b7280" stroke-width=".6"/></svg>',
    type:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M3 1H10L13 4V14Q13 15 12 15H4Q3 15 3 14Z" fill="#fff" stroke="#6b7280" stroke-width=".6"/><path d="M10 1V4H13" fill="#e5e7eb" stroke="#6b7280" stroke-width=".4"/></svg>',
    auto:    '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="2" fill="#bbf7d0" stroke="#22c55e" stroke-width=".6"/><path d="M4 8L7 11L12 5" fill="none" stroke="#166534" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    refresh: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M13 8A5 5 0 1 1 8 3" fill="none" stroke="#16a34a" stroke-width="1.2"/><path d="M8 1L11 3L8 5" fill="none" stroke="#16a34a" stroke-width="1.2" stroke-linejoin="round"/></svg>',
    newMenu: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#dcfce7" stroke="#22c55e" stroke-width=".8"/><line x1="8" y1="5" x2="8" y2="11" stroke="#22c55e" stroke-width="1.5"/><line x1="5" y1="8" x2="11" y2="8" stroke="#22c55e" stroke-width="1.5"/></svg>',
    folder:  '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="14" height="10" rx="1" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/><path d="M1 4V3Q1 2 2 2H6L8 4" fill="#f59e0b" stroke="#b45309" stroke-width=".6"/><line x1="8" y1="7" x2="8" y2="12" stroke="#fff" stroke-width="1.5"/><line x1="5.5" y1="9.5" x2="10.5" y2="9.5" stroke="#fff" stroke-width="1.5"/></svg>',
    shortcut:'<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M3 4L10 4L10 12L3 12Z" fill="#dbeafe" stroke="#3b82f6" stroke-width=".6"/><path d="M6 8L10 4L13 7L9 11Z" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/></svg>',
    textDoc: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M3 1H10L13 4V14Q13 15 12 15H4Q3 15 3 14Z" fill="#fff" stroke="#6b7280" stroke-width=".6"/><path d="M10 1V4H13" fill="#e5e7eb" stroke="#6b7280" stroke-width=".4"/><line x1="5" y1="7" x2="11" y2="7" stroke="#9ca3af" stroke-width=".6"/><line x1="5" y1="9" x2="11" y2="9" stroke="#9ca3af" stroke-width=".6"/><line x1="5" y1="11" x2="9" y2="11" stroke="#9ca3af" stroke-width=".6"/></svg>',
    props:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6" fill="#e0f2fe" stroke="#0284c7" stroke-width=".8"/><line x1="8" y1="7" x2="8" y2="12" stroke="#0284c7" stroke-width="1.2"/><circle cx="8" cy="5" r="1" fill="#0284c7"/></svg>',
    cascade: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="8" height="6" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".5"/><rect x="4" y="4" width="8" height="6" rx=".5" fill="#bfdbfe" stroke="#3b82f6" stroke-width=".5"/><rect x="7" y="7" width="8" height="6" rx=".5" fill="#dbeafe" stroke="#3b82f6" stroke-width=".5"/></svg>',
    tileH:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="6" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/><rect x="1" y="9" width="14" height="6" rx=".5" fill="#bfdbfe" stroke="#3b82f6" stroke-width=".6"/></svg>',
    tileV:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="6" height="14" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/><rect x="9" y="1" width="6" height="14" rx=".5" fill="#bfdbfe" stroke="#3b82f6" stroke-width=".6"/></svg>',
    showDsk: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="10" rx="1" fill="#6baed6" stroke="#2171b5" stroke-width=".8"/><rect x="2" y="2" width="12" height="8" fill="#deebf7"/><rect x="5" y="12" width="6" height="1" fill="#999"/><rect x="4" y="13" width="8" height="1.5" rx=".5" fill="#bbb"/></svg>',
    taskMgr: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="14" rx="1" fill="#e5e7eb" stroke="#6b7280" stroke-width=".6"/><rect x="3" y="4" width="2" height="8" fill="#22c55e"/><rect x="7" y="6" width="2" height="6" fill="#3b82f6"/><rect x="11" y="3" width="2" height="9" fill="#ef4444"/></svg>',
    toolbar: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="14" height="10" rx="1" fill="#e5e7eb" stroke="#6b7280" stroke-width=".6"/><rect x="2" y="1" width="4" height="3" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".4"/><rect x="7" y="1" width="4" height="3" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".4"/></svg>',
    paste:   '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="1" width="8" height="2.5" rx=".5" fill="#e5e7eb" stroke="#6b7280" stroke-width=".5"/><rect x="1" y="3" width="10" height="12" rx=".8" fill="#fef3c7" stroke="#d97706" stroke-width=".6"/><rect x="6" y="2" width="9" height="11" rx=".8" fill="#fff" stroke="#6b7280" stroke-width=".6"/><line x1="8" y1="5" x2="13" y2="5" stroke="#9ca3af" stroke-width=".5"/><line x1="8" y1="7" x2="13" y2="7" stroke="#9ca3af" stroke-width=".5"/><line x1="8" y1="9" x2="11" y2="9" stroke="#9ca3af" stroke-width=".5"/></svg>',
  };

  class ContextMenu {
    #desktopEl;
    #windowManager;
    #appLauncher;
    #menuEl = null;
    #subMenuEl = null;
    #kernel = null;

    constructor(desktopEl, windowManager, appLauncher, kernel) {
      this.#desktopEl = desktopEl;
      this.#windowManager = windowManager;
      this.#appLauncher = appLauncher;
      this.#kernel = kernel;
      this.#init();
    }

    /**
     * Launch the Task Manager (called from taskbar context menu too).
     */
    launchTaskManager() {
      if (this.#appLauncher?.getApp('task-manager'))
        this.#appLauncher.launch('task-manager');
    }

    async #pasteToDesktop() {
      const cb = window._szClipboard;
      if (!cb?.items?.length || !this.#kernel) return;
      try {
        for (const ci of cb.items) {
          const src = ci.path.startsWith('/vfs') ? ci.path.slice(4) : ci.path;
          const dest = '/user/desktop/' + ci.name;
          if (src === dest) continue;
          if (cb.mode === 'copy') {
            const bytes = await this.#kernel.ReadAllBytes(src);
            await this.#kernel.WriteAllBytes(dest, bytes);
          } else
            await this.#kernel.Move(src, dest);
        }
        if (cb.mode === 'cut') window._szClipboard = null;
        window.postMessage({ type: 'sz:desktopRefresh' }, '*');
      } catch (err) {
        console.warn('[SZ] Desktop paste failed:', err);
      }
    }

    /**
     * Show a context menu with the given items at the given position.
     * Reusable by any caller (e.g., title bar icon menu).
     */
    showAt(items, x, y, { fromBottom = false } = {}) {
      this.#close();
      this.#renderMenu(this.#menuEl, items, x, y, fromBottom);
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

      // Taskbar right-click (skip when inside the start menu)
      const taskbar = document.getElementById('sz-taskbar');
      if (taskbar) {
        taskbar.addEventListener('contextmenu', (e) => {
          if (e.target.closest('#sz-start-menu, .sz-start-flyout'))
            return;
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
          icon: _CTX.arrange,
          submenu: [
            { label: 'Name', icon: _CTX.name, action: () => {} },
            { label: 'Size', icon: _CTX.size, action: () => {} },
            { label: 'Type', icon: _CTX.type, action: () => {} },
            { separator: true },
            { label: 'Auto Arrange', checked: true, action: () => {} },
          ]
        },
        { separator: true },
        { label: 'Refresh', icon: _CTX.refresh, action: () => location.reload() },
        { separator: true },
        {
          label: 'Paste',
          icon: _CTX.paste,
          disabled: !window._szClipboard,
          action: () => this.#pasteToDesktop(),
        },
        { separator: true },
        {
          label: 'New',
          icon: _CTX.newMenu,
          submenu: [
            { label: 'Folder', icon: _CTX.folder, action: () => {} },
            { label: 'Shortcut', icon: _CTX.shortcut, action: () => {} },
            { label: 'Text Document', icon: _CTX.textDoc, action: () => {} },
          ]
        },
        { separator: true },
        {
          label: 'Properties',
          icon: _CTX.props,
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
          icon: _CTX.toolbar,
          submenu: [
            { label: 'Quick Launch', checked: false, action: () => {} },
            { label: 'Desktop', checked: false, action: () => {} },
          ]
        },
        { separator: true },
        {
          label: 'Cascade Windows',
          icon: _CTX.cascade,
          action: () => this.#windowManager.cascadeWindows()
        },
        {
          label: 'Tile Windows Horizontally',
          icon: _CTX.tileH,
          action: () => this.#windowManager.tileHorizontally()
        },
        {
          label: 'Tile Windows Vertically',
          icon: _CTX.tileV,
          action: () => this.#windowManager.tileVertically()
        },
        {
          label: 'Tile Windows Grid',
          icon: _CTX.arrange,
          action: () => this.#windowManager.tileGrid()
        },
        {
          label: 'Show the Desktop',
          icon: _CTX.showDsk,
          action: () => {
            for (const win of this.#windowManager.allWindows)
              if (win.state !== 'minimized')
                this.#windowManager.minimizeWindow(win.id);
          }
        },
        { separator: true },
        {
          label: 'Task Manager',
          icon: _CTX.taskMgr,
          bold: true,
          action: () => this.launchTaskManager()
        },
        { separator: true },
        {
          label: 'Properties',
          icon: _CTX.props,
          action: () => {
            if (this.#appLauncher?.getApp('control-panel'))
              this.#appLauncher.launch('control-panel', { tab: 'taskbar' });
          }
        },
      ];

      this.#renderMenu(this.#menuEl, items, x, y, true);
    }

    /**
     * Build the DOM for a menu, position it within the viewport, and add
     * scroll arrows when the item list exceeds the available space.
     *
     * @param {HTMLElement} menuEl   The menu container element.
     * @param {Array}       items    Menu-item descriptors.
     * @param {number}      x        Desired left position (CSS px).
     * @param {number}      y        Desired top position (CSS px).
     * @param {boolean}     fromBottom  When true the menu opens upward from y.
     * @param {string}      preferSide  'right' (default) or 'left' for submenus.
     */
    #renderMenu(menuEl, items, x, y, fromBottom = false, preferSide = 'right') {
      menuEl.innerHTML = '';

      // -- Scroll-arrow helpers (added only when needed) ----------------------
      let scrollContainer = null;
      let upArrow = null;
      let downArrow = null;
      let scrollTimer = null;

      const stopScrollTimer = () => {
        if (scrollTimer != null) {
          clearInterval(scrollTimer);
          scrollTimer = null;
        }
      };

      const updateArrowVisibility = () => {
        if (!scrollContainer)
          return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        upArrow.classList.toggle('sz-ctx-arrow-hidden', scrollTop <= 0);
        downArrow.classList.toggle('sz-ctx-arrow-hidden', scrollTop + clientHeight >= scrollHeight - 1);
      };

      const startScroll = (direction) => {
        stopScrollTimer();
        scrollTimer = setInterval(() => {
          scrollContainer.scrollTop += direction * SCROLL_STEP;
          updateArrowVisibility();
        }, SCROLL_INTERVAL);
      };

      // -- Build item elements ------------------------------------------------
      const fragment = document.createDocumentFragment();

      for (const item of items) {
        if (item.separator) {
          const sep = document.createElement('div');
          sep.className = 'sz-ctx-separator';
          fragment.appendChild(sep);
          continue;
        }

        const el = document.createElement('div');
        el.className = 'sz-ctx-item';
        if (item.disabled)
          el.classList.add('sz-ctx-disabled');
        if (item.bold)
          el.style.fontWeight = 'bold';

        // Icon or check column
        if (item.checked) {
          const check = document.createElement('span');
          check.className = 'sz-ctx-check';
          check.textContent = '\u2713';
          el.appendChild(check);
        } else {
          const iconSpan = document.createElement('span');
          iconSpan.className = 'sz-ctx-icon';
          if (item.icon) iconSpan.innerHTML = item.icon;
          el.appendChild(iconSpan);
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
            const menuRect = menuEl.getBoundingClientRect();
            // Decide which side: if parent opened to the left, prefer left again
            let subX, subSide;
            if (preferSide === 'left' || rect.right + 2 > window.innerWidth - EDGE_PAD) {
              // Open to the left of the parent menu
              subX = menuRect.left + 2;
              subSide = 'left';
            } else {
              subX = rect.right - 2;
              subSide = 'right';
            }
            this.#renderMenu(
              this.#subMenuEl,
              item.submenu,
              subX,
              rect.top,
              false,
              subSide,
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

        fragment.appendChild(el);
      }

      menuEl.appendChild(fragment);

      // -- Measure natural size (visible but off-screen) ----------------------
      menuEl.style.left = '0px';
      menuEl.style.top = '0px';
      menuEl.style.maxHeight = 'none';
      menuEl.style.display = 'block';

      const naturalWidth = menuEl.offsetWidth;
      const naturalHeight = menuEl.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // -- Horizontal placement -----------------------------------------------
      let finalX;
      if (preferSide === 'left')
        // Submenu opening to the left: place right edge at x
        finalX = x - naturalWidth;
      else
        finalX = x;

      // Clamp: keep fully inside viewport
      if (finalX + naturalWidth > vw - EDGE_PAD)
        finalX = vw - naturalWidth - EDGE_PAD;
      if (finalX < EDGE_PAD)
        finalX = EDGE_PAD;

      // -- Vertical placement -------------------------------------------------
      let finalY;
      const availDown = vh - y - EDGE_PAD;
      const availUp = y - EDGE_PAD;

      if (fromBottom) {
        // Taskbar menu: prefer opening upward from the click point
        finalY = y - naturalHeight;
        if (finalY < EDGE_PAD)
          finalY = EDGE_PAD;
      } else if (naturalHeight <= availDown) {
        // Fits below the cursor
        finalY = y;
      } else if (naturalHeight <= availUp) {
        // Flip upward
        finalY = y - naturalHeight;
      } else {
        // Doesn't fit either way -- anchor to whichever side has more room
        finalY = availDown >= availUp ? EDGE_PAD : vh - naturalHeight - EDGE_PAD;
        if (finalY < EDGE_PAD)
          finalY = EDGE_PAD;
      }

      // -- Max-height and scroll arrows if needed -----------------------------
      const maxAvail = vh - EDGE_PAD * 2;
      if (naturalHeight > maxAvail) {
        // Wrap existing children in a scrollable container
        scrollContainer = document.createElement('div');
        scrollContainer.className = 'sz-ctx-scroll-container';
        while (menuEl.firstChild)
          scrollContainer.appendChild(menuEl.firstChild);

        upArrow = document.createElement('div');
        upArrow.className = 'sz-ctx-scroll-arrow sz-ctx-scroll-up sz-ctx-arrow-hidden';
        upArrow.textContent = '\u25B2';

        downArrow = document.createElement('div');
        downArrow.className = 'sz-ctx-scroll-arrow sz-ctx-scroll-down';
        downArrow.textContent = '\u25BC';

        menuEl.appendChild(upArrow);
        menuEl.appendChild(scrollContainer);
        menuEl.appendChild(downArrow);

        // Height budget for the scroll container: total available minus arrows
        const arrowH = 20; // matches CSS .sz-ctx-scroll-arrow min-height
        scrollContainer.style.maxHeight = `${maxAvail - arrowH * 2}px`;

        // Pointer-driven auto-scroll on hover
        upArrow.addEventListener('pointerenter', () => startScroll(-1));
        upArrow.addEventListener('pointerleave', stopScrollTimer);
        downArrow.addEventListener('pointerenter', () => startScroll(1));
        downArrow.addEventListener('pointerleave', stopScrollTimer);

        scrollContainer.addEventListener('scroll', updateArrowVisibility);
        updateArrowVisibility();

        finalY = EDGE_PAD;
      }

      menuEl.style.left = `${finalX}px`;
      menuEl.style.top = `${finalY}px`;
    }

    #close() {
      this.#menuEl.style.display = 'none';
      this.#subMenuEl.style.display = 'none';
    }
  }

  SZ.ContextMenu = ContextMenu;
})();
