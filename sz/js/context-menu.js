;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /** Viewport-edge padding in px. */
  const EDGE_PAD = 4;

  /** Scroll-arrow repeat interval in ms. */
  const SCROLL_INTERVAL = 50;

  /** Pixels scrolled per tick. */
  const SCROLL_STEP = 24;

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
