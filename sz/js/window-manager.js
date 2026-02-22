;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  class WindowManager {
    #container;
    #windows = new Map();
    #zStack = [];
    #nextId = 0;
    #skin = null;
    #cascadeOffset = { x: 40, y: 40 };

    onWindowCreated = null;
    onWindowClosed = null;
    onWindowFocused = null;
    onWindowTitleChanged = null;

    constructor(containerElement) {
      this.#container = containerElement;
    }

    async setSkin(skin) {
      this.#skin = skin;
      await SZ.generateSkinCSS(skin);
      for (const win of this.#windows.values())
        win.applySkin(skin);
    }

    updateSkinReference(skin) {
      this.#skin = skin;
      for (const win of this.#windows.values())
        win.applySkin(skin);
    }

    createWindow(config) {
      const id = 'win-' + (++this.#nextId);
      const win = new SZ.SzWindow({ ...config, id });

      if (this.#skin)
        win.applySkin(this.#skin);

      this.#container.appendChild(win.element);

      const maxX = this.#container.clientWidth - (config.width || 512) - 20;
      const maxY = this.#container.clientHeight - (config.height || 412) - 20;

      win.moveTo(
        Math.max(0, this.#cascadeOffset.x),
        Math.max(0, this.#cascadeOffset.y)
      );

      this.#cascadeOffset.x += 30;
      this.#cascadeOffset.y += 30;

      if (this.#cascadeOffset.x > maxX || this.#cascadeOffset.y > maxY)
        this.#cascadeOffset = { x: 40, y: 40 };

      this.#windows.set(id, win);
      this.#zStack.push(id);
      this.focusWindow(id);

      if (this.onWindowCreated)
        this.onWindowCreated(win);

      return win;
    }

    closeWindow(id) {
      const win = this.#windows.get(id);
      if (!win)
        return;

      // Close is always instant (Windows XP style) -- no animation
      win.close();

      const el = win.element;
      // Remove immediately on the next microtask so any current event
      // handlers finish first.
      queueMicrotask(() => {
        el.remove();
        this.#windows.delete(id);
        this.#zStack = this.#zStack.filter(wid => wid !== id);
        this.#updateZIndices();

        if (this.onWindowClosed)
          this.onWindowClosed(win);

        const topId = this.#findTopmostVisible();
        if (topId)
          this.focusWindow(topId);
        else if (this.onWindowFocused)
          this.onWindowFocused(null);
      });
    }

    focusWindow(id) {
      const win = this.#windows.get(id);
      if (!win)
        return;

      if (win.state === 'minimized')
        this.#restoreFromMinimize(id, win);

      for (const w of this.#windows.values())
        w.setActive(false);

      win.setActive(true);

      this.#zStack = this.#zStack.filter(wid => wid !== id);
      this.#zStack.push(id);
      this.#updateZIndices();

      if (this.onWindowFocused)
        this.onWindowFocused(win);
    }

    minimizeWindow(id) {
      const win = this.#windows.get(id);
      if (!win || win.state === 'minimized' || win.state === 'closed')
        return;

      if (this.#animationsEnabled()) {
        // Calculate target position: the center of the corresponding taskbar button
        this.#setTaskbarTarget(win, id);

        // Deactivate this window and focus the next one immediately
        // so the user sees the next window while the minimize animation plays.
        win.setActive(false);
        this.#focusNextVisibleExcluding(id);

        // Play the minimize animation, then actually hide the window
        win.playAnimation('sz-minimizing').then(() => {
          win.clearAnimations();
          win.minimize();
        });
      } else {
        win.minimize();
        this.#focusNextAfterMinimize();
      }
    }

    maximizeWindow(id) {
      const win = this.#windows.get(id);
      if (!win)
        return;

      if (win.state === 'maximized') {
        // Restore from maximized
        if (this.#animationsEnabled()) {
          win.restore();
          win.playAnimation('sz-restoring-from-max').then(() => {
            win.clearAnimations();
          });
        } else {
          win.restore();
        }
      } else {
        // Maximize
        if (this.#animationsEnabled()) {
          win.maximize();
          win.playAnimation('sz-maximizing').then(() => {
            win.clearAnimations();
          });
        } else {
          win.maximize();
        }
      }

      this.focusWindow(id);
    }

    deactivateAll() {
      for (const win of this.#windows.values())
        win.setActive(false);

      if (this.onWindowFocused)
        this.onWindowFocused(null);
    }

    getWindow(id) {
      return this.#windows.get(id) || null;
    }

    getWindowByIframe(contentWindow) {
      for (const win of this.#windows.values())
        if (win.iframe && win.iframe.contentWindow === contentWindow)
          return win;
      return null;
    }

    get activeWindow() {
      for (let i = this.#zStack.length - 1; i >= 0; --i) {
        const win = this.#windows.get(this.#zStack[i]);
        if (win && win.state !== 'minimized')
          return win;
      }
      return null;
    }

    get allWindows() {
      return [...this.#windows.values()];
    }

    cascadeWindows() {
      let i = 0;
      for (const win of this.#windows.values()) {
        if (win.state === 'minimized' || win.state === 'closed')
          continue;
        if (win.state === 'maximized')
          win.restore();
        win.moveTo(20 + i * 30, 20 + i * 30);
        ++i;
      }
      this.#cascadeOffset = { x: 20 + i * 30, y: 20 + i * 30 };
    }

    tileHorizontally() {
      const visible = [...this.#windows.values()].filter(w => w.state !== 'minimized' && w.state !== 'closed');
      if (!visible.length)
        return;
      const areaW = this.#container.clientWidth;
      const areaH = this.#container.clientHeight;
      const h = Math.floor(areaH / visible.length);
      for (let i = 0; i < visible.length; ++i) {
        const win = visible[i];
        if (win.state === 'maximized')
          win.restore();
        win.moveTo(0, i * h);
        win.resizeTo(areaW, h);
      }
    }

    tileVertically() {
      const visible = [...this.#windows.values()].filter(w => w.state !== 'minimized' && w.state !== 'closed');
      if (!visible.length)
        return;
      const areaW = this.#container.clientWidth;
      const areaH = this.#container.clientHeight;
      const w = Math.floor(areaW / visible.length);
      for (let i = 0; i < visible.length; ++i) {
        const win = visible[i];
        if (win.state === 'maximized')
          win.restore();
        win.moveTo(i * w, 0);
        win.resizeTo(w, areaH);
      }
    }

    tileGrid() {
      const visible = [...this.#windows.values()].filter(w => w.state !== 'minimized' && w.state !== 'closed');
      if (!visible.length)
        return;
      const n = visible.length;
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const areaW = this.#container.clientWidth;
      const areaH = this.#container.clientHeight;
      const cellW = Math.floor(areaW / cols);
      const cellH = Math.floor(areaH / rows);
      for (let i = 0; i < n; ++i) {
        const win = visible[i];
        if (win.state === 'maximized')
          win.restore();
        const col = i % cols;
        const row = Math.floor(i / cols);
        win.moveTo(col * cellW, row * cellH);
        win.resizeTo(cellW, cellH);
      }
    }

    handleButtonAction(windowId, action) {
      switch (action) {
        case 'close': this.closeWindow(windowId); break;
        case 'minimize': this.minimizeWindow(windowId); break;
        case 'maximize': this.maximizeWindow(windowId); break;
      }
    }

    rollUpWindow(id) {
      const win = this.#windows.get(id);
      if (win)
        win.rollUp();
    }

    rollDownWindow(id) {
      const win = this.#windows.get(id);
      if (win)
        win.rollDown();
    }

    setWindowAlwaysOnTop(id, value) {
      const win = this.#windows.get(id);
      if (!win)
        return;
      win.setAlwaysOnTop(value);
      this.#updateZIndices();
    }

    setWindowOpacity(id, value) {
      const win = this.#windows.get(id);
      if (win)
        win.setOpacity(value);
    }

    getVisibleWindowRects(excludeId) {
      const rects = [];
      for (const [id, win] of this.#windows) {
        if (id === excludeId || win.state === 'minimized' || win.state === 'closed')
          continue;
        const pos = win.getPosition();
        const size = win.getSize();
        rects.push({ id, x: pos.x, y: pos.y, width: size.width, height: size.height });
      }
      return rects;
    }

    get container() { return this.#container; }

    // -----------------------------------------------------------------
    // Animation helpers
    // -----------------------------------------------------------------

    /** Check if window animations are enabled (default true). */
    #animationsEnabled() {
      return !document.documentElement.classList.contains('sz-animations-off');
    }

    /**
     * Calculate the taskbar button center position and set it as the
     * animation target on the window so the CSS animation can use it.
     */
    #setTaskbarTarget(win, id) {
      const btn = document.querySelector(`.sz-taskbar-button[data-window-id="${id}"]`);
      if (!btn) {
        // Fallback: aim at center-bottom of the screen (taskbar area)
        const pos = win.getPosition();
        const size = win.getSize();
        const cx = pos.x + size.width / 2;
        win.setAnimationTarget(cx, window.innerHeight);
        return;
      }

      const btnRect = btn.getBoundingClientRect();
      const containerRect = this.#container.getBoundingClientRect();

      // Target = center of the taskbar button, relative to the window-area container
      const targetX = btnRect.left + btnRect.width / 2 - containerRect.left;
      const targetY = btnRect.top + btnRect.height / 2 - containerRect.top;

      win.setAnimationTarget(targetX, targetY);
    }

    /** Restore a window from minimized state with animation. */
    #restoreFromMinimize(id, win) {
      if (this.#animationsEnabled()) {
        // Set taskbar target so the "from" position in the animation matches
        this.#setTaskbarTarget(win, id);
        win.restore();
        win.playAnimation('sz-restoring-from-min').then(() => {
          win.clearAnimations();
        });
      } else {
        win.restore();
      }
    }

    /** Focus the next visible window after a minimize, or deactivate all. */
    #focusNextAfterMinimize() {
      const nextId = this.#findTopmostVisible();
      if (nextId) {
        this.focusWindow(nextId);
      } else {
        for (const w of this.#windows.values())
          w.setActive(false);
        if (this.onWindowFocused)
          this.onWindowFocused(null);
      }
    }

    /** Focus the next visible window excluding a specific id (used during animation). */
    #focusNextVisibleExcluding(excludeId) {
      for (let i = this.#zStack.length - 1; i >= 0; --i) {
        const wid = this.#zStack[i];
        if (wid === excludeId)
          continue;
        const w = this.#windows.get(wid);
        if (w && w.state !== 'minimized') {
          this.focusWindow(wid);
          return;
        }
      }
      // No other visible window found
      if (this.onWindowFocused)
        this.onWindowFocused(null);
    }

    #updateZIndices() {
      let normalIdx = 0;
      let onTopIdx = 0;
      for (let i = 0; i < this.#zStack.length; ++i) {
        const win = this.#windows.get(this.#zStack[i]);
        if (!win)
          continue;
        if (win.alwaysOnTop)
          win.element.style.zIndex = 10000 + (++onTopIdx);
        else
          win.element.style.zIndex = 100 + (++normalIdx);
      }
    }

    #findTopmostVisible() {
      for (let i = this.#zStack.length - 1; i >= 0; --i) {
        const win = this.#windows.get(this.#zStack[i]);
        if (win && win.state !== 'minimized')
          return this.#zStack[i];
      }
      return null;
    }
  }

  SZ.WindowManager = WindowManager;
})();
