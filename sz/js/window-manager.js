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

      win.close();

      const el = win.element;
      let cleaned = false;

      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
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
      };

      el.addEventListener('animationend', cleanup, { once: true });

      // Fallback timeout in case no CSS animation is defined
      setTimeout(cleanup, 200);
    }

    focusWindow(id) {
      const win = this.#windows.get(id);
      if (!win)
        return;

      if (win.state === 'minimized')
        win.restore();

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
      if (!win) return;

      win.minimize();

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

    maximizeWindow(id) {
      const win = this.#windows.get(id);
      if (!win) return;

      if (win.state === 'maximized')
        win.restore();
      else
        win.maximize();

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

    handleButtonAction(windowId, action) {
      switch (action) {
        case 'close': this.closeWindow(windowId); break;
        case 'minimize': this.minimizeWindow(windowId); break;
        case 'maximize': this.maximizeWindow(windowId); break;
      }
    }

    #updateZIndices() {
      for (let i = 0; i < this.#zStack.length; ++i) {
        const win = this.#windows.get(this.#zStack[i]);
        if (win)
          win.element.style.zIndex = 100 + i;
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
