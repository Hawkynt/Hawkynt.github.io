;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const _RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  let _nextId = 0;

  class SzWindow {
    #id;
    #title;
    #icon;
    #state = 'normal';
    #config;
    #element;
    #titleTextEl;
    #contentEl;
    #iframeEl = null;
    #titleBarEl;
    #x = 0;
    #y = 0;
    #savedRect = null;
    #active = true;
    #rolledUp = false;
    #alwaysOnTop = false;
    #opacity = 1.0;
    #rolledUpSavedHeight = null;
    #appId = null;

    constructor({ id, title, icon, appId, datasource, width = 512, height = 412, resizable = true, minimizable = true, maximizable = true, skin = null }) {
      this.#id = id || `sz-win-${++_nextId}`;
      this.#title = title || '';
      this.#icon = icon || null;
      this.#appId = appId || null;
      this.#config = { datasource, width, height, resizable, minimizable, maximizable };
      this.#element = this.#buildDOM();
      if (skin)
        this.applySkin(skin);
    }

    get element() { return this.#element; }
    get id() { return this.#id; }
    get title() { return this.#title; }
    get icon() { return this.#icon; }
    get appId() { return this.#appId; }
    get state() { return this.#state; }
    get iframe() { return this.#iframeEl; }
    get contentElement() { return this.#contentEl; }
    get isRolledUp() { return this.#rolledUp; }
    get alwaysOnTop() { return this.#alwaysOnTop; }
    get opacity() { return this.#opacity; }
    get resizable() { return this.#config.resizable; }
    get minimizable() { return this.#config.minimizable; }
    get maximizable() { return this.#config.maximizable; }

    setTitle(title) {
      this.#title = title;
      this.#titleTextEl.textContent = title;
    }

    setActive(active) {
      this.#active = !!active;
      this.#element.classList.toggle('sz-window-active', this.#active);
    }

    moveTo(x, y) {
      this.#x = x;
      this.#y = y;
      const style = this.#element.style;
      style.transform = `translate3d(${x}px, ${y}px, 0)`;
      style.setProperty('--sz-x', `${x}px`);
      style.setProperty('--sz-y', `${y}px`);
    }

    resizeTo(w, h) {
      this.#element.style.width = `${w}px`;
      this.#element.style.height = `${h}px`;
    }

    resizeContentTo(w, h) {
      const cw = this.#contentEl.offsetWidth;
      const ch = this.#contentEl.offsetHeight;
      const chromeW = this.#element.offsetWidth - cw;
      const chromeH = this.#element.offsetHeight - ch;
      this.resizeTo(w + chromeW, h + chromeH);
    }

    getPosition() { return { x: this.#x, y: this.#y }; }

    getSize() {
      return {
        width: this.#element.offsetWidth,
        height: this.#element.offsetHeight,
      };
    }

    get savedRect() { return this.#savedRect; }

    minimize() {
      if (this.#state === 'minimized' || this.#state === 'closed')
        return;
      this.#savedRect ??= this.#captureRect();
      this.#state = 'minimized';
      this.#element.dataset.state = 'minimized';
    }

    maximize() {
      if (this.#state === 'maximized' || this.#state === 'closed')
        return;
      if (this.#rolledUp)
        this.rollDown();
      if (this.#state === 'normal')
        this.#savedRect = this.#captureRect();
      this.#state = 'maximized';
      this.#element.dataset.state = 'maximized';
    }

    restore() {
      if (this.#state === 'closed')
        return;
      if (this.#rolledUp)
        this.rollDown();
      const prevState = this.#state;
      this.#state = 'normal';
      this.#element.dataset.state = 'normal';
      if (this.#savedRect) {
        this.moveTo(this.#savedRect.x, this.#savedRect.y);
        this.resizeTo(this.#savedRect.width, this.#savedRect.height);
        this.#savedRect = null;
      }
      return prevState;
    }

    close() {
      if (this.#state === 'closed')
        return;
      this.#state = 'closed';
      this.#element.classList.add('sz-closing');
    }

    // -----------------------------------------------------------------
    // Roll up / Roll down, Always on Top, Opacity
    // -----------------------------------------------------------------

    rollUp() {
      if (this.#rolledUp || this.#state === 'minimized' || this.#state === 'closed' || this.#state === 'maximized')
        return;
      this.#rolledUpSavedHeight = this.#element.offsetHeight;
      this.#rolledUp = true;
      this.#element.dataset.state = 'rolled-up';
    }

    rollDown() {
      if (!this.#rolledUp)
        return;
      this.#rolledUp = false;
      this.#element.dataset.state = 'normal';
      if (this.#rolledUpSavedHeight != null) {
        this.#element.style.height = `${this.#rolledUpSavedHeight}px`;
        this.#rolledUpSavedHeight = null;
      }
    }

    setAlwaysOnTop(value) {
      this.#alwaysOnTop = !!value;
      this.#element.classList.toggle('sz-window-always-on-top', this.#alwaysOnTop);
    }

    setOpacity(value) {
      this.#opacity = Math.max(0.1, Math.min(1.0, value));
      this.#element.style.opacity = this.#opacity < 1.0 ? String(this.#opacity) : '';
    }

    // -----------------------------------------------------------------
    // Animation helpers
    // -----------------------------------------------------------------

    /** Set CSS custom properties for the minimize/restore animation target. */
    setAnimationTarget(tx, ty) {
      this.#element.style.setProperty('--sz-anim-tx', `${tx}px`);
      this.#element.style.setProperty('--sz-anim-ty', `${ty}px`);
    }

    /** Add an animation class; returns a Promise that resolves when animation ends. */
    playAnimation(className) {
      return new Promise((resolve) => {
        const el = this.#element;
        el.classList.add(className);
        const cleanup = () => {
          el.classList.remove(className);
          resolve();
        };
        el.addEventListener('animationend', cleanup, { once: true });
        // Fallback in case no CSS animation fires (e.g. animations disabled)
        setTimeout(cleanup, 300);
      });
    }

    /** Remove any lingering animation classes. */
    clearAnimations() {
      const el = this.#element;
      el.classList.remove('sz-minimizing', 'sz-restoring-from-min', 'sz-restoring-from-max', 'sz-maximizing');
    }

    // -----------------------------------------------------------------
    // Skin application
    // -----------------------------------------------------------------

    applySkin(skin) {
      if (!skin?.personality)
        return;
      this.#applySkinButtons(skin);

      // Enable sub-skin color tinting overlay when a non-default sub-skin is
      // active.  The overlay uses mix-blend-mode: color on frame cell ::after
      // pseudo-elements so that CSS custom property changes from sub-skin
      // selection immediately recolor the BMP frame images.
      const hasNonDefaultSubSkin = !!skin._activeSubSkinId;
      this.#element.classList.toggle('sz-subskin-tint', hasNonDefaultSubSkin);
    }

    // -----------------------------------------------------------------
    // DOM construction — 9-cell grid
    // -----------------------------------------------------------------

    #buildDOM() {
      const el = document.createElement('div');
      el.className = 'sz-window sz-window-active';
      el.dataset.windowId = this.#id;
      el.dataset.state = 'normal';
      el.style.width = `${this.#config.width}px`;
      el.style.height = `${this.#config.height}px`;

      // Row 1: nw, n, ne
      el.appendChild(this.#createCell('nw'));
      el.appendChild(this.#createCell('n'));
      el.appendChild(this.#createCell('ne'));

      // Row 2: w, content, e
      el.appendChild(this.#createCell('w'));

      this.#contentEl = document.createElement('div');
      this.#contentEl.className = 'sz-window-content';
      this.#buildContent();
      el.appendChild(this.#contentEl);

      el.appendChild(this.#createCell('e'));

      // Row 3: sw, s, se
      el.appendChild(this.#createCell('sw'));
      el.appendChild(this.#createCell('s'));
      el.appendChild(this.#createCell('se'));

      // Title bar overlays the full top row (grid placement via CSS)
      this.#titleBarEl = this.#buildTitleBar();
      el.appendChild(this.#titleBarEl);

      // Resize handles
      if (this.#config.resizable)
        for (const dir of _RESIZE_DIRECTIONS) {
          const handle = document.createElement('div');
          handle.className = `sz-resize-handle sz-resize-${dir}`;
          handle.dataset.resize = dir;
          el.appendChild(handle);
        }

      return el;
    }

    #createCell(name) {
      const div = document.createElement('div');
      div.className = `sz-frame-${name}`;
      return div;
    }

    #buildTitleBar() {
      const titleBar = document.createElement('div');
      titleBar.className = 'sz-title-bar';

      if (this.#icon) {
        const iconEl = document.createElement('img');
        iconEl.className = 'sz-title-icon';
        iconEl.src = this.#icon;
        iconEl.alt = '';
        iconEl.draggable = false;
        titleBar.appendChild(iconEl);
      }

      this.#titleTextEl = document.createElement('span');
      this.#titleTextEl.className = 'sz-title-text';
      this.#titleTextEl.textContent = this.#title;
      titleBar.appendChild(this.#titleTextEl);

      const btnContainer = document.createElement('div');
      btnContainer.className = 'sz-title-buttons';

      if (this.#config.minimizable)
        btnContainer.appendChild(this.#createButton('minimize', 'Minimize'));
      if (this.#config.maximizable)
        btnContainer.appendChild(this.#createButton('maximize', 'Maximize'));
      btnContainer.appendChild(this.#createButton('close', 'Close'));
      titleBar.appendChild(btnContainer);

      return titleBar;
    }

    #createButton(action, tooltip) {
      const btn = document.createElement('button');
      btn.dataset.action = action;
      btn.title = tooltip;
      return btn;
    }

    #buildContent() {
      const ds = this.#config.datasource;
      if (!ds) return;

      if (typeof ds === 'string') {
        const iframe = document.createElement('iframe');
        iframe.className = 'sz-app-frame';
        iframe.src = ds;
        this.#iframeEl = iframe;
        this.#contentEl.appendChild(iframe);
      } else if (ds.type === 'hosted' && ds.element) {
        this.#contentEl.appendChild(ds.element);
      }
    }

    // -----------------------------------------------------------------
    // Skin helpers — title buttons only (frames are CSS-driven)
    // -----------------------------------------------------------------

    #applySkinButtons(skin) {
      const btns = this.#titleBarEl.querySelectorAll('.sz-title-buttons button');
      const titleButtons = skin.titleButtons;

      for (const btn of btns) {
        // Always clear old inline styles first
        btn.style.backgroundImage = '';
        btn.style.backgroundSize = '';
        btn.style.backgroundRepeat = '';
        btn.style.backgroundPosition = '';
        btn.style.position = '';
        btn.style.left = '';
        btn.style.right = '';
        btn.style.top = '';
        btn.style.width = '';
        btn.style.height = '';

        if (!titleButtons?.length)
          continue;

        const action = btn.dataset.action;
        const entry = this.#findSkinButton(titleButtons, action);
        if (!entry?.image)
          continue;

        btn.style.backgroundImage = `url('${entry.image}')`;
        btn.style.backgroundSize = '600% 100%';
        btn.style.backgroundRepeat = 'no-repeat';

        // Position button using skin coordinates (absolute within window border)
        // xcoord is the distance from the alignment edge to the button's left edge
        btn.style.position = 'absolute';
        btn.style.top = `${entry.ycoord || 0}px`;
        if (entry.align === 1) {
          btn.style.left = `calc(100% - ${entry.xcoord || 0}px)`;
          btn.style.right = 'auto';
        } else {
          btn.style.left = `${entry.xcoord || 0}px`;
          btn.style.right = 'auto';
        }

        // Load image to determine button dimensions from sprite
        const b = btn;
        const img = new Image();
        img.onload = function() {
          b.style.width = `${Math.floor(this.naturalWidth / 6)}px`;
          b.style.height = `${this.naturalHeight}px`;
        };
        img.src = entry.image;
      }
    }

    #findSkinButton(titleButtons, action) {
      const actionMap = { close: 0, maximize: 22, minimize: 23 };
      const code = actionMap[action];
      if (code == null)
        return null;

      for (const tb of titleButtons)
        if (tb.action === code && tb.image)
          return tb;

      return null;
    }

    #captureRect() {
      return {
        x: this.#x,
        y: this.#y,
        width: this.#element.offsetWidth,
        height: this.#element.offsetHeight,
      };
    }
  }

  SZ.SzWindow = SzWindow;
})();
