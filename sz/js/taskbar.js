;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const DEFAULT_MRU_APPS = ['calculator', 'notepad', 'explorer'];

  // menu labels may come from file and folder names: always set them as text
  function _span(text, className) {
    const s = document.createElement('span');
    if (className)
      s.className = className;
    s.textContent = text;
    return s;
  }

  class Taskbar {
    #element;
    #windowList;
    #clock;
    #startButton;
    #startMenu;
    #buttons = new Map();
    #windowManager;
    #onAppLaunch = null;
    #startButtonFrameCount = 5;
    #startButtonHoverPos = '50%';
    #startButtonPressedPos = '25%';

    // Start menu state
    #leftCol;
    #flyout;
    #allItems = [];
    #categories = null;
    #appLauncher = null;
    #showingAllPrograms = false;

    constructor(element, windowManager) {
      this.#element = element;
      this.#windowList = element.querySelector('#sz-window-list');
      this.#clock = element.querySelector('#sz-clock');
      this.#startButton = element.querySelector('#sz-start-button');
      this.#windowManager = windowManager;
      this.#startClock();
      this.#buildStartMenu();

      this.#windowList.addEventListener('wheel', (e) => {
        if (this.#windowList.scrollWidth > this.#windowList.clientWidth) {
          e.preventDefault();
          this.#windowList.scrollLeft += e.deltaY;
        }
      }, { passive: false });

      new ResizeObserver(() => this.#updateOverflow()).observe(this.#windowList);
    }

    addWindow(windowId, title, icon, appId) {
      const btn = document.createElement('button');
      btn.className = 'sz-taskbar-button';
      if (icon) {
        const img = document.createElement('img');
        img.className = 'sz-taskbar-button-icon';
        img.src = icon;
        img.alt = '';
        img.draggable = false;
        btn.appendChild(img);
      }
      const span = document.createElement('span');
      span.textContent = title;
      btn.appendChild(span);
      btn.dataset.windowId = windowId;
      if (appId)
        btn.dataset.appId = appId;
      btn.addEventListener('pointerup', (e) => { e.stopPropagation(); this.#onButtonClick(windowId); });
      // Enter or Space on a focused button (a pointer click came as pointerup)
      btn.addEventListener('click', (e) => { if (e.detail === 0) this.#onButtonClick(windowId); });
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.#showButtonContextMenu(windowId, e.clientX, e.clientY);
      });
      this.#windowList.appendChild(btn);
      this.#buttons.set(windowId, btn);
      this.#updateOverflow();
    }

    removeWindow(windowId) {
      const btn = this.#buttons.get(windowId);
      if (btn) { btn.remove(); this.#buttons.delete(windowId); }
      this.#updateOverflow();
    }

    updateTitle(windowId, title) {
      const btn = this.#buttons.get(windowId);
      if (!btn) return;
      const span = btn.querySelector('span');
      if (span)
        span.textContent = title;
      else
        btn.textContent = title;
    }

    setActive(windowId) {
      for (const [id, btn] of this.#buttons)
        btn.classList.toggle('active', id === windowId);
    }

    /**
     * Populate the start menu with MRU + All Programs flyout.
     * @param {ShellItem[]} items - All non-hidden apps from FileSystem.startMenu
     * @param {Function} onLaunch - callback(appId) to launch an app
     * @param {Object} opts - { mru, categories: Map<string, ShellFolder>, appLauncher }
     */
    populateStartMenu(items, onLaunch, opts = {}) {
      this.#onAppLaunch = onLaunch;
      this.#allItems = items;
      this.#categories = opts.categories || null;
      this.#appLauncher = opts.appLauncher || null;
      this.#startMenu.innerHTML = '';
      this.#showingAllPrograms = false;

      // Header with user avatar
      const header = document.createElement('div');
      header.className = 'sz-start-header';
      header.innerHTML = '<img class="sz-start-avatar" src="assets/icons/sz-logo.svg" onerror="this.outerHTML=\'<div class=sz-start-avatar>SZ</div>\'" alt="User"><span class="sz-start-username">User</span>';
      this.#startMenu.appendChild(header);

      // Two-column body
      const body = document.createElement('div');
      body.className = 'sz-start-body';

      // Left column with scroll arrows
      const leftWrap = this.#buildScrollCol();
      this.#leftCol = leftWrap.content;
      this.#leftCol.className = 'sz-start-left';
      body.appendChild(leftWrap.wrapper);

      // Right column with scroll arrows
      const rightWrap = this.#buildScrollCol();
      const rightCol = rightWrap.content;
      rightCol.className = 'sz-start-right';
      this.#buildRightColumn(rightCol);
      body.appendChild(rightWrap.wrapper);

      // Flyout for category submenus — appended to taskbar element
      // (outside start menu to avoid overflow:hidden clipping)
      this.#flyout = document.createElement('div');
      this.#flyout.className = 'sz-start-flyout';
      this.#flyout.addEventListener('pointerenter', () => {
        this.#flyout.classList.add('visible');
      });
      this.#flyout.addEventListener('pointerleave', () => {
        this.#flyout.classList.remove('visible');
        for (const c of this.#leftCol.querySelectorAll('.sz-menu-category'))
          c.classList.remove('active');
      });
      this.#element.appendChild(this.#flyout);

      this.#startMenu.appendChild(body);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'sz-start-footer';
      footer.innerHTML = '<button class="sz-start-logoff">Log Off</button><button class="sz-start-shutdown">Turn Off Computer</button>';

      footer.querySelector('.sz-start-logoff').addEventListener('pointerup', (e) => {
        e.stopPropagation();
        this.#closeStartMenu();
        if (confirm('Are you sure you want to log off?'))
          location.reload();
      });

      footer.querySelector('.sz-start-shutdown').addEventListener('pointerup', (e) => {
        e.stopPropagation();
        this.#closeStartMenu();
        if (confirm('Are you sure you want to shut down?')) {
          document.body.style.transition = 'opacity 1s';
          document.body.style.opacity = '0';
          setTimeout(() => {
            document.body.innerHTML = '';
            document.body.style.background = '#000';
            document.body.style.opacity = '1';
          }, 1000);
        }
      });

      this.#startMenu.appendChild(footer);

      // Show MRU view initially
      this.#showMRUView(opts.mru || []);
    }

    /**
     * Refresh MRU section after launching an app.
     */
    refreshMRU(settings, appLauncher) {
      if (!this.#leftCol) return;
      this.#appLauncher = appLauncher;
      const mru = settings.get('mru') || [];
      if (!this.#showingAllPrograms)
        this.#showMRUView(mru);
    }

    // -----------------------------------------------------------------
    // MRU view (default left column)
    // -----------------------------------------------------------------

    #showMRUView(mruData) {
      this.#showingAllPrograms = false;
      this.#leftCol.innerHTML = '';
      this.#flyout.classList.remove('visible');

      // Build MRU items
      let mruItems = [];
      for (const entry of mruData) {
        const app = this.#appLauncher?.getApp(entry.appId);
        if (!app || app.hidden) continue;
        mruItems.push({
          appId: entry.appId,
          name: app.title,
          icon: this.#appLauncher.resolveIconPath(app),
        });
      }

      // Seed with defaults if MRU is empty
      if (mruItems.length === 0 && this.#appLauncher) {
        for (const id of DEFAULT_MRU_APPS) {
          const app = this.#appLauncher.getApp(id);
          if (app && !app.hidden)
            mruItems.push({ appId: id, name: app.title, icon: this.#appLauncher.resolveIconPath(app) });
        }
      }

      // Render MRU items
      const mruSection = document.createElement('div');
      mruSection.className = 'sz-mru-section';
      for (const item of mruItems.slice(0, 6)) {
        const el = this.#createMenuItem(item.name, item.icon, () => {
          this.#closeStartMenu();
          if (this.#onAppLaunch) this.#onAppLaunch(item.appId);
        }, item.appId);
        mruSection.appendChild(el);
      }
      this.#leftCol.appendChild(mruSection);

      // Separator
      const sep = document.createElement('div');
      sep.className = 'sz-menu-separator';
      this.#leftCol.appendChild(sep);

      // "All Programs ▶" button
      const allProg = document.createElement('div');
      allProg.className = 'sz-menu-item sz-all-programs';
      allProg.innerHTML = '<span>All Programs</span><span class="sz-menu-arrow">\u25B6</span>';
      allProg.addEventListener('pointerup', (e) => { if (e.button !== 0) return; e.stopPropagation(); this.#showAllProgramsView(); });
      this.#leftCol.appendChild(allProg);
    }

    // -----------------------------------------------------------------
    // All Programs view (replaces left column content)
    // -----------------------------------------------------------------

    #showAllProgramsView() {
      this.#showingAllPrograms = true;
      this.#leftCol.innerHTML = '';
      this.#flyout.classList.remove('visible');

      if (this.#categories) {
        // Sort categories alphabetically
        const sorted = [...this.#categories.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        for (const [catName, folder] of sorted) {
          const catEl = document.createElement('div');
          catEl.className = 'sz-menu-item sz-menu-category';
          catEl.append(_span('\uD83D\uDCC1', 'sz-menu-category-icon'), _span(catName), _span('\u25B6', 'sz-menu-arrow'));

          const showFlyout = () => {
            // Remove active from other categories
            for (const c of this.#leftCol.querySelectorAll('.sz-menu-category'))
              c.classList.remove('active');
            catEl.classList.add('active');
            this.#showCategoryFlyout(folder, catEl);
          };
          catEl.addEventListener('pointerenter', showFlyout);
          catEl.addEventListener('pointerup', (e) => { if (e.button !== 0) return; e.stopPropagation(); showFlyout(); });

          this.#leftCol.appendChild(catEl);
        }
      }

      // Separator
      const sep = document.createElement('div');
      sep.className = 'sz-menu-separator';
      this.#leftCol.appendChild(sep);

      // "← Back" item
      const backItem = document.createElement('div');
      backItem.className = 'sz-menu-item sz-menu-back';
      backItem.innerHTML = '<span class="sz-menu-arrow">\u25C4</span><span>Back</span>';
      backItem.addEventListener('pointerup', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        this.#flyout.classList.remove('visible');
        const mru = SZ.system?.settings?.get('mru') || [];
        this.#showMRUView(mru);
      });
      this.#leftCol.appendChild(backItem);
    }

    // -----------------------------------------------------------------
    // Category flyout submenu
    // -----------------------------------------------------------------

    #showCategoryFlyout(folder, anchorEl) {
      this.#flyout.innerHTML = '';
      const items = folder.getItems();

      for (const item of items) {
        if (item.type === 'separator') continue;
        const el = this.#createMenuItem(item.name, item.icon, () => {
          this.#closeStartMenu();
          if (item.appId && this.#onAppLaunch)
            this.#onAppLaunch(item.appId);
        }, item.appId);
        this.#flyout.appendChild(el);
      }

      // Position the flyout — prefer right of menu, fall back to overlap/left
      const menuRect = this.#startMenu.getBoundingClientRect();
      const anchorRect = anchorEl.getBoundingClientRect();
      const flyoutWidth = Math.min(200, window.innerWidth - 20);

      // Try right side first
      let flyoutLeft = menuRect.right;
      // If it would overflow the viewport, shift left to fit
      if (flyoutLeft + flyoutWidth > window.innerWidth - 5)
        flyoutLeft = Math.max(5, window.innerWidth - flyoutWidth - 5);

      // Vertical positioning: align with anchor, clamp to viewport
      let flyoutBottom = window.innerHeight - anchorRect.bottom;
      this.#flyout.style.left = flyoutLeft + 'px';
      this.#flyout.style.bottom = Math.max(5, flyoutBottom) + 'px';
      this.#flyout.style.top = '';
      this.#flyout.classList.add('visible');

      // After rendering, check if flyout overflows top of viewport
      requestAnimationFrame(() => {
        const flyoutRect = this.#flyout.getBoundingClientRect();
        if (flyoutRect.top < 5) {
          this.#flyout.style.bottom = '';
          this.#flyout.style.top = '5px';
        }
      });
    }

    // -----------------------------------------------------------------
    // Right column (system items)
    // -----------------------------------------------------------------

    #buildRightColumn(rightCol) {
      const systemItems = [
        { label: 'My Computer', appId: 'explorer' },
        { label: 'My Documents', appId: 'explorer', urlParams: { path: '/vfs/user/documents' } },
        { separator: true },
        { label: 'Control Panel', appId: 'control-panel' },
        { separator: true },
        { label: 'Task Manager', appId: 'task-manager' },
        { separator: true },
        { label: 'Search', action: () => alert('Search is not yet available.') },
        {
          label: 'Run...',
          action: () => {
            const appId = prompt('Enter application ID to launch:');
            if (appId && this.#onAppLaunch)
              this.#onAppLaunch(appId.trim());
          }
        },
      ];

      for (const si of systemItems) {
        if (si.separator) {
          const s = document.createElement('div');
          s.className = 'sz-menu-separator';
          rightCol.appendChild(s);
          continue;
        }
        const el = document.createElement('div');
        el.className = 'sz-menu-item sz-menu-system-item';
        el.append(_span(si.label));
        const launch = () => {
          this.#closeStartMenu();
          if (si.appId && this.#onAppLaunch)
            this.#onAppLaunch(si.appId, si.urlParams);
          else if (si.action)
            si.action();
        };
        el.addEventListener('pointerup', (e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          launch();
        });
        if (si.appId)
          el.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.#showItemContextMenu(si.appId, launch, e.clientX, e.clientY);
          });
        rightCol.appendChild(el);
      }
    }

    // -----------------------------------------------------------------
    // Helper: create a standard menu item
    // -----------------------------------------------------------------

    #createMenuItem(name, icon, onClick, appId) {
      const el = document.createElement('div');
      el.className = 'sz-menu-item';
      if (icon) {
        const img = document.createElement('img');
        img.src = icon;
        img.alt = '';
        el.append(img);
      }
      el.append(_span(name));
      el.addEventListener('pointerup', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        onClick();
      });
      if (appId)
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.#showItemContextMenu(appId, onClick, e.clientX, e.clientY);
        });
      return el;
    }

    #buildScrollCol() {
      const wrapper = document.createElement('div');
      wrapper.className = 'sz-scroll-col';

      const arrowUp = document.createElement('div');
      arrowUp.className = 'sz-scroll-arrow';
      arrowUp.textContent = '\u25B2';

      const content = document.createElement('div');

      const arrowDown = document.createElement('div');
      arrowDown.className = 'sz-scroll-arrow';
      arrowDown.textContent = '\u25BC';

      wrapper.appendChild(arrowUp);
      wrapper.appendChild(content);
      wrapper.appendChild(arrowDown);

      const updateArrows = () => {
        const canUp = content.scrollTop > 0;
        const canDown = content.scrollTop + content.clientHeight < content.scrollHeight - 1;
        arrowUp.classList.toggle('visible', canUp);
        arrowDown.classList.toggle('visible', canDown);
      };

      content.addEventListener('scroll', updateArrows);

      let scrollInterval = null;
      const startScroll = (dir) => {
        if (scrollInterval) return;
        scrollInterval = setInterval(() => content.scrollBy(0, dir * 40), 100);
      };
      const stopScroll = () => {
        if (scrollInterval) {
          clearInterval(scrollInterval);
          scrollInterval = null;
        }
      };

      arrowUp.addEventListener('pointerdown', (e) => { e.stopPropagation(); startScroll(-1); });
      arrowDown.addEventListener('pointerdown', (e) => { e.stopPropagation(); startScroll(1); });
      arrowUp.addEventListener('pointerup', stopScroll);
      arrowDown.addEventListener('pointerup', stopScroll);
      arrowUp.addEventListener('pointerleave', stopScroll);
      arrowDown.addEventListener('pointerleave', stopScroll);

      // Observe size/content changes to update arrows
      const observer = new ResizeObserver(updateArrows);
      observer.observe(content);

      // Also re-check after DOM mutations (items added/removed)
      const mutObserver = new MutationObserver(updateArrows);
      mutObserver.observe(content, { childList: true, subtree: true });

      return { wrapper, content, arrowUp, arrowDown, updateArrows };
    }

    #showItemContextMenu(appId, onLaunch, x, y) {
      const ctxMenu = SZ.contextMenu;
      if (!ctxMenu) return;

      const app = this.#appLauncher?.getApp(appId);
      const launchIcon = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M5 3L13 8L5 13Z" fill="#22c55e" stroke="#166534" stroke-width=".6"/></svg>';
      const linkIcon = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M6.5 9.5L9.5 6.5" stroke="#3b82f6" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M8 5L10 3A2.12 2.12 0 0 1 12.83 5.83L10.5 8" stroke="#3b82f6" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M8 11L6 13A2.12 2.12 0 0 1 3.17 10.17L5.5 8" stroke="#3b82f6" stroke-width="1.2" fill="none" stroke-linecap="round"/></svg>';

      const items = [
        {
          label: 'Launch',
          icon: launchIcon,
          bold: true,
          action: () => {
            this.#closeStartMenu();
            onLaunch();
          },
        },
        { separator: true },
        {
          label: 'Copy URL',
          icon: linkIcon,
          disabled: !app?.entry,
          action: () => {
            if (!app) return;
            const url = new URL('Applications/' + app.entry, location.href).href;
            if (navigator.clipboard?.writeText)
              navigator.clipboard.writeText(url).catch(() => this.#fallbackCopy(url));
            else
              this.#fallbackCopy(url);
          },
        },
      ];

      ctxMenu.showAt(items, x, y);
    }

    #fallbackCopy(text) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }

    /**
     * Toggle small icons in start menu.
     */
    setSmallIcons(enabled) {
      if (this.#startMenu)
        this.#startMenu.classList.toggle('sz-small-icons', !!enabled);
    }

    /**
     * Show or hide the clock in the system tray.
     */
    setShowClock(enabled) {
      if (this.#clock)
        this.#clock.style.display = enabled ? '' : 'none';
    }

    /**
     * Auto-hide: the taskbar slides away and returns when the pointer
     * touches the bottom edge or the start menu opens; windows get the
     * whole screen.
     */
    setAutoHide(enabled) {
      document.documentElement.classList.toggle('sz-taskbar-autohide', !!enabled);
    }

    /**
     * Apply skin colours and start button image.
     */
    applySkin(skin) {
      const c = skin.colors || {};
      const at = c.activeTitle || c.background || [15, 92, 190];
      const gt = c.gradientActiveTitle || at;
      this.#element.style.background = `linear-gradient(to bottom,
        rgb(${Math.min(255, gt[0] + 40)}, ${Math.min(255, gt[1] + 40)}, ${Math.min(255, gt[2] + 40)}),
        rgb(${at[0]}, ${at[1]}, ${at[2]}),
        rgb(${Math.max(0, at[0] - 20)}, ${Math.max(0, at[1] - 20)}, ${Math.max(0, at[2] - 20)})
      )`;
      this.#element.style.borderTopColor =
        `rgb(${Math.min(255, gt[0] + 80)}, ${Math.min(255, gt[1] + 80)}, ${Math.min(255, gt[2] + 80)})`;

      const luma = at[0] * 0.299 + at[1] * 0.587 + at[2] * 0.114;
      const txtColor = luma < 128 ? 'white' : 'black';

      const trayEl = this.#element.querySelector('#sz-system-tray');
      if (trayEl)
        trayEl.style.color = txtColor;

      const bright = luma < 128;
      this.#element.style.setProperty('--sz-taskbar-btn-bg',
        bright ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)');
      this.#element.style.setProperty('--sz-taskbar-btn-border',
        bright ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)');
      this.#element.style.setProperty('--sz-taskbar-btn-text', txtColor);
      this.#element.style.setProperty('--sz-taskbar-btn-active-bg',
        bright ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.15)');
      this.#element.style.setProperty('--sz-taskbar-btn-active-border',
        bright ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.25)');
      this.#element.style.setProperty('--sz-taskbar-btn-hover-bg',
        bright ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.12)');
    }

    applyStartButtonImage(imageURL, personality) {
      if (!this.#startButton) return;
      const btn = this.#startButton;

      if (!imageURL) {
        btn.style.backgroundImage = '';
        btn.style.backgroundSize = '';
        btn.style.backgroundPosition = '';
        btn.style.backgroundRepeat = '';
        btn.style.width = '';
        btn.style.height = '';
        btn.style.border = '';
        btn.style.padding = '';
        btn.style.backgroundColor = '';
        btn.textContent = 'Start';
        this.#element.style.height = '';
        return;
      }

      const img = new Image();
      img.onload = () => {
        const frameCount = this.#detectStartButtonFrames(img);
        const fw = Math.floor(img.width / frameCount);

        btn.style.backgroundImage = `url('${imageURL}')`;
        btn.style.backgroundSize = `${frameCount * 100}% 100%`;
        btn.style.backgroundPosition = '0% 0%';
        btn.style.backgroundRepeat = 'no-repeat';
        btn.style.width = `${fw}px`;
        btn.style.height = `${img.height}px`;
        btn.style.border = 'none';
        btn.style.padding = '0';
        btn.style.backgroundColor = 'transparent';
        btn.textContent = '';

        this.#element.style.height = `${img.height + 6}px`;
        this.#startButtonFrameCount = frameCount;

        if (frameCount === 5) {
          this.#startButtonHoverPos = '50%';
          this.#startButtonPressedPos = '75%';
        } else {
          this.#startButtonHoverPos = '50%';
          this.#startButtonPressedPos = '100%';
        }

        this.#ensureStartButtonListeners();
      };
      img.src = imageURL;
    }

    #detectStartButtonFrames(img) {
      if (img.width % 5 === 0) return 5;
      if (img.width % 3 === 0) return 3;
      return 2;
    }

    #ensureStartButtonListeners() {
      const btn = this.#startButton;
      if (btn.dataset.szSkinned) return;
      btn.dataset.szSkinned = '1';
      btn.addEventListener('pointerenter', () => {
        if (!btn.classList.contains('active'))
          btn.style.backgroundPosition = `${this.#startButtonHoverPos} 0%`;
      });
      btn.addEventListener('pointerleave', () => {
        if (!btn.classList.contains('active'))
          btn.style.backgroundPosition = '0% 0%';
      });
    }

    // -----------------------------------------------------------------
    // Start menu
    // -----------------------------------------------------------------

    #buildStartMenu() {
      this.#startMenu = document.createElement('div');
      this.#startMenu.id = 'sz-start-menu';
      this.#element.appendChild(this.#startMenu);

      this.#startButton.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        this.#toggleStartMenu();
      });
      this.#startButton.addEventListener('click', (e) => {
        if (e.detail === 0)
          this.toggleStartMenuFromKeyboard();
      });
      this.#startButton.setAttribute('aria-haspopup', 'menu');
      this.#startButton.setAttribute('aria-expanded', 'false');
      this.#startButton.setAttribute('aria-label', 'Start');
      this.#startMenu.setAttribute('role', 'menu');
      this.#startMenu.setAttribute('aria-label', 'Start menu');
      document.addEventListener('keydown', (e) => this.#onStartMenuKey(e));

      document.addEventListener('pointerdown', (e) => {
        if (this.#startMenu.classList.contains('open') &&
            !this.#startMenu.contains(e.target) &&
            !this.#startButton.contains(e.target) &&
            !this.#flyout?.contains(e.target))
          this.#closeStartMenu();
      });
    }

    // Ctrl+Esc, or Enter on the start button: open with the first entry focused
    toggleStartMenuFromKeyboard() {
      this.#toggleStartMenu();
      if (!this.#startMenu.classList.contains('open')) {
        this.#startButton.focus();
        return;
      }
      // the menu fades in: focus can only land once it is shown
      const tryFocus = (left) => {
        const first = this.#menuItems(this.#startMenu)[0];
        this.#focusMenuItem(first);
        if (first && document.activeElement !== first && left > 0 && this.#startMenu.classList.contains('open'))
          setTimeout(() => tryFocus(left - 1), 30);
      };
      tryFocus(10);
    }

    #menuItems(scope) {
      const items = [...scope.querySelectorAll('.sz-menu-item')].filter(el => el.getClientRects().length > 0);
      for (const el of items) {
        if (!el.hasAttribute('tabindex'))
          el.tabIndex = -1;
        if (!el.getAttribute('role'))
          el.setAttribute('role', 'menuitem');
      }
      return items;
    }

    #focusMenuItem(el) {
      if (!el)
        return;
      el.focus({ preventScroll: false });
      // categories show their programs as the focus reaches them, like on hover
      if (el.classList.contains('sz-menu-category'))
        el.dispatchEvent(new PointerEvent('pointerenter'));
    }

    #activateMenuItem(el) {
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
    }

    #onStartMenuKey(e) {
      if (e.key === 'Escape' && e.ctrlKey && !e.altKey) {
        e.preventDefault();
        this.toggleStartMenuFromKeyboard();
        return;
      }
      if (!this.#startMenu.classList.contains('open'))
        return;
      const active = document.activeElement;
      const inFlyout = !!(this.#flyout && this.#flyout.contains(active));
      const items = this.#menuItems(inFlyout ? this.#flyout : this.#startMenu);
      const i = items.indexOf(active);
      const n = items.length;
      let handled = true;
      switch (e.key) {
        case 'ArrowDown': this.#focusMenuItem(items[(i + 1) % n]); break;
        case 'ArrowUp': this.#focusMenuItem(items[(i - 1 + n) % n]); break;
        case 'Home': this.#focusMenuItem(items[0]); break;
        case 'End': this.#focusMenuItem(items[n - 1]); break;
        case 'ArrowRight':
          if (active && active.classList.contains('sz-menu-category')) {
            this.#activateMenuItem(active);
            if (this.#flyout && this.#flyout.classList.contains('visible'))
              this.#focusMenuItem(this.#menuItems(this.#flyout)[0]);
          }
          break;
        case 'ArrowLeft':
          if (inFlyout) {
            this.#flyout.classList.remove('visible');
            this.#focusMenuItem(this.#startMenu.querySelector('.sz-menu-category.active') || this.#menuItems(this.#startMenu)[0]);
          }
          break;
        case 'Enter':
        case ' ':
          if (i >= 0) {
            const isCategory = active.classList.contains('sz-menu-category');
            const isView = active.classList.contains('sz-all-programs') || active.classList.contains('sz-menu-back');
            this.#activateMenuItem(active);
            if (isCategory && this.#flyout && this.#flyout.classList.contains('visible'))
              this.#focusMenuItem(this.#menuItems(this.#flyout)[0]);
            else if (isView)
              this.#focusMenuItem(this.#menuItems(this.#startMenu)[0]);
          }
          break;
        case 'Escape':
          this.#closeStartMenu();
          this.#startButton.focus();
          break;
        case 'Tab':
          this.#closeStartMenu();
          handled = false;
          break;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && n) {
            const letter = e.key.toLowerCase();
            for (let k = 1; k <= n; ++k) {
              const cand = items[(i + k + n) % n];
              if (cand.textContent.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase().startsWith(letter)) {
                this.#focusMenuItem(cand);
                break;
              }
            }
          } else
            handled = false;
      }
      if (handled)
        e.preventDefault();
    }

    #toggleStartMenu() {
      const isOpen = this.#startMenu.classList.toggle('open');
      this.#startButton.classList.toggle('active', isOpen);
      this.#element.classList.toggle('sz-taskbar-peek', isOpen);
      this.#startButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) {
        this.#startButton.style.backgroundPosition = `${this.#startButtonPressedPos} 0%`;
        // Reset to MRU view when opening
        if (this.#showingAllPrograms) {
          this.#flyout?.classList.remove('visible');
          const mru = SZ.system?.settings?.get('mru') || [];
          this.#showMRUView(mru);
        }
      } else {
        this.#startButton.style.backgroundPosition = '0% 0%';
        this.#flyout?.classList.remove('visible');
      }
    }

    #closeStartMenu() {
      this.#startMenu.classList.remove('open');
      this.#startButton.classList.remove('active');
      this.#element.classList.remove('sz-taskbar-peek');
      this.#startButton.setAttribute('aria-expanded', 'false');
      this.#startButton.style.backgroundPosition = '0% 0%';
      this.#flyout?.classList.remove('visible');
    }

    // -----------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------

    #showButtonContextMenu(windowId, x, y) {
      const ctxMenu = SZ.contextMenu;
      if (!ctxMenu)
        return;

      const wm = this.#windowManager;
      const btn = this.#buttons.get(windowId);
      const appId = btn?.dataset.appId;
      const hasSameApp = appId && [...this.#buttons.values()].filter(b => b.dataset.appId === appId).length > 1;

      const closeIcon = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><line x1="4" y1="4" x2="12" y2="12" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="4" x2="4" y2="12" stroke="#ef4444" stroke-width="1.5" stroke-linecap="round"/></svg>';
      const closeAllIcon = '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><line x1="3" y1="3" x2="9" y2="9" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/><line x1="9" y1="3" x2="3" y2="9" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/><line x1="7" y1="7" x2="13" y2="13" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/><line x1="13" y1="7" x2="7" y2="13" stroke="#ef4444" stroke-width="1.2" stroke-linecap="round"/></svg>';

      const items = [
        { label: 'Close', icon: closeIcon, bold: true, action: () => wm.requestClose(windowId) },
        { label: 'Close All Windows', icon: closeAllIcon, action: () => { for (const id of [...this.#buttons.keys()]) wm.requestClose(id); } },
      ];

      if (hasSameApp)
        items.push({ label: 'Close All of Same App', icon: closeAllIcon, action: () => this.#closeAllSameApp(appId) });

      items.push({ separator: true });
      items.push({ label: 'Cascade Windows', icon: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="8" height="6" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".5"/><rect x="4" y="4" width="8" height="6" rx=".5" fill="#bfdbfe" stroke="#3b82f6" stroke-width=".5"/><rect x="7" y="7" width="8" height="6" rx=".5" fill="#dbeafe" stroke="#3b82f6" stroke-width=".5"/></svg>', action: () => wm.cascadeWindows() });
      items.push({ label: 'Tile Horizontally', icon: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="6" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/><rect x="1" y="9" width="14" height="6" rx=".5" fill="#bfdbfe" stroke="#3b82f6" stroke-width=".6"/></svg>', action: () => wm.tileHorizontally() });
      items.push({ label: 'Tile Vertically', icon: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="6" height="14" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/><rect x="9" y="1" width="6" height="14" rx=".5" fill="#bfdbfe" stroke="#3b82f6" stroke-width=".6"/></svg>', action: () => wm.tileVertically() });
      items.push({ label: 'Tile Grid', icon: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="5" height="5" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/><rect x="9" y="2" width="5" height="5" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/><rect x="2" y="9" width="5" height="5" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/><rect x="9" y="9" width="5" height="5" rx=".5" fill="#93c5fd" stroke="#3b82f6" stroke-width=".6"/></svg>', action: () => wm.tileGrid() });
      items.push({
        label: 'Show Desktop',
        icon: '<svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="14" height="10" rx="1" fill="#6baed6" stroke="#2171b5" stroke-width=".8"/><rect x="2" y="2" width="12" height="8" fill="#deebf7"/><rect x="5" y="12" width="6" height="1" fill="#999"/><rect x="4" y="13" width="8" height="1.5" rx=".5" fill="#bbb"/></svg>',
        action: () => { for (const win of wm.allWindows) if (win.state !== 'minimized') wm.minimizeWindow(win.id); }
      });

      ctxMenu.showAt(items, x, y, { fromBottom: true });
    }

    #closeAllSameApp(appId) {
      for (const [winId, btn] of this.#buttons)
        if (btn.dataset.appId === appId)
          this.#windowManager.requestClose(winId);
    }

    #updateOverflow() {
      const needed = this.#buttons.size * 120 > this.#windowList.clientWidth;
      this.#windowList.classList.toggle('sz-overflow', needed);
    }

    #onButtonClick(windowId) {
      const win = this.#windowManager.getWindow(windowId);
      if (!win) return;
      if (win.state === 'minimized')
        this.#windowManager.focusWindow(windowId);
      else if (win.id === this.#windowManager.activeWindow?.id)
        this.#windowManager.minimizeWindow(windowId);
      else
        this.#windowManager.focusWindow(windowId);
    }

    #startClock() {
      const getCalendarWeek = (d) => {
        const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
        return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
      };

      const update = () => {
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const date = now.toLocaleDateString([], { year: 'numeric', month: '2-digit', day: '2-digit' });
        const cw = getCalendarWeek(now);
        this.#clock.innerHTML = `${time}<br><span class="sz-clock-date">${date} CW${cw}</span>`;
      };
      update();
      setInterval(update, 1000);

      this.#clock.style.cursor = 'default';
      this.#clock.addEventListener('dblclick', () => {
        window.postMessage({ type: 'sz:launchApp', appId: 'clock' }, '*');
      });
    }
  }

  SZ.Taskbar = Taskbar;
})();
