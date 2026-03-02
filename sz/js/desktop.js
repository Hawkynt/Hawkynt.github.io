;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const GRID_W = 80;
  const GRID_H = 80;
  const PADDING = 8;
  const STORAGE_KEY = 'sz-icon-positions';

  // Slideshow cache keys (localStorage)
  const SS_CACHE_A = 'sz-ss-a';
  const SS_CACHE_B = 'sz-ss-b';
  const SS_CACHE_FRONT = 'sz-ss-front'; // 'a' | 'b'
  const SS_CACHE_IDX = 'sz-ss-idx';     // last-shown image index
  const SS_CACHE_FOLDER = 'sz-ss-dir';  // folder for cache validation

  class Desktop {
    #element;
    #bgElement;
    #bgAltElement;
    #patternElement;
    #videoElement;
    #iconArea;
    #icons = [];
    #occupiedCells = new Map(); // "col,row" -> icon id
    #savedPositions = null;
    #slideshowTimer = null;
    #slideshowImages = [];
    #slideshowIndex = 0;
    #slideshowFront = true; // true = #bgElement is front, false = #bgAltElement is front
    #subTimers = new Set();
    #currentSettings = null;
    #cachePromise = null; // promise for the background cache-write of the next slot

    constructor(element) {
      this.#element = element;
      this.#bgElement = element.querySelector('#sz-background');
      this.#bgAltElement = element.querySelector('#sz-background-alt');
      this.#patternElement = element.querySelector('#sz-bg-pattern');
      this.#videoElement = element.querySelector('#sz-bg-video');
      this.#iconArea = element.querySelector('#sz-icon-area');
      this.#element.addEventListener('pointerdown', (e) => {
        if (e.target === this.#element || e.target === this.#bgElement || e.target === this.#bgAltElement || e.target === this.#patternElement || e.target === this.#iconArea)
          this.#deselectAll();
      });
      this.#loadPositions();
    }

    async setBackground(src, mode = 'cover') {
      // Legacy single-image API -- delegate to full API
      await this.setBackgroundFull({ sourceType: 'image', src, mode, baseColor: '#3A6EA5', pattern: null });
    }

    async setBackgroundFull(settings) {
      this.#currentSettings = settings;
      const baseColor = settings.baseColor || '#3A6EA5';
      this.#element.style.backgroundColor = baseColor;

      // Pattern overlay
      this.#applyPattern(settings.pattern, baseColor);

      // Clear persistent slideshow cache when switching away from slideshow
      const newType = settings.sourceType || 'image';
      if (newType !== 'slideshow')
        Desktop.#clearSlideshowCache();

      // Clear content layer first
      this.#clearContentLayer();

      switch (newType) {
        case 'none':
          break;
        case 'image':
          await this.#applyImageBackground(settings.src, settings.mode || 'cover');
          break;
        case 'slideshow':
          await this.#startSlideshow(settings.slideshow, settings.mode || 'cover');
          break;
        case 'video':
          this.#applyVideoBackground(settings.video);
          break;
        case 'online':
          if (settings.online?.cachedUrl)
            await this.#applyImageBackground(settings.online.cachedUrl, settings.mode || 'cover');
          break;
      }
    }

    setBaseColor(color) {
      this.#element.style.backgroundColor = color;
      // Re-render pattern if present since it uses baseColor for 0-bits
      if (this.#currentSettings?.pattern)
        this.#applyPattern(this.#currentSettings.pattern, color);
    }

    #clearContentLayer() {
      this.#stopSlideshow();
      this.#bgElement.style.display = 'none';
      this.#bgElement.src = '';
      this.#bgAltElement.style.display = 'none';
      this.#bgAltElement.src = '';
      this.#bgAltElement.style.opacity = '0';
      this.#videoElement.style.display = 'none';
      this.#videoElement.pause();
      this.#videoElement.removeAttribute('src');
      this.#videoElement.load();
      this.#element.style.backgroundImage = '';
    }

    // -- Pattern rendering ----------------------------------------------------

    #applyPattern(pattern, baseColor) {
      if (!pattern) {
        this.#patternElement.style.display = 'none';
        this.#patternElement.style.backgroundImage = '';
        return;
      }

      const { width, height, fg, bits } = pattern;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Parse hex bits into binary
      const bitString = bits.split('').map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');

      for (let y = 0; y < height; ++y)
        for (let x = 0; x < width; ++x) {
          const bitIndex = y * width + x;
          const bit = bitString[bitIndex] === '1';
          ctx.fillStyle = bit ? fg : baseColor;
          ctx.fillRect(x, y, 1, 1);
        }

      const dataUri = canvas.toDataURL('image/png');
      this.#patternElement.style.backgroundImage = `url('${dataUri}')`;
      this.#patternElement.style.backgroundRepeat = 'repeat';
      this.#patternElement.style.backgroundSize = `${width * 3}px ${height * 3}px`;
      this.#patternElement.style.display = 'block';
    }

    // -- Image background -----------------------------------------------------

    async #applyImageBackground(src, mode) {
      if (!src) return;

      const kernel = SZ.system?.kernel;
      const fallback = '/system/wallpapers/bliss.svg';
      let finalSrc = src;

      if (src.startsWith('/') && kernel) {
        try {
          const content = await kernel.ReadUri(src);
          finalSrc = content || await kernel.ReadUri(fallback);
        } catch (e) {
          console.error(`VFS read error for ${src}:`, e);
          try { finalSrc = await kernel.ReadUri(fallback); } catch {}
        }
      }

      this.#bgElement.onerror = async () => {
        this.#bgElement.onerror = null;
        if (!kernel) return;
        try {
          const fallbackContent = await kernel.ReadUri(fallback);
          if (this.#bgElement.src !== fallbackContent)
            this.#bgElement.src = fallbackContent;
        } catch {}
      };

      if (mode === 'tile') {
        this.#bgElement.style.display = 'none';
        this.#element.style.backgroundImage = `url('${finalSrc}')`;
        this.#element.style.backgroundRepeat = 'repeat';
        this.#element.style.backgroundSize = 'auto';
        this.#element.style.backgroundPosition = 'top left';
      } else {
        this.#bgElement.style.display = '';
        this.#element.style.backgroundImage = '';
        this.#bgElement.src = finalSrc;
        this.#applyImgMode(this.#bgElement, mode);
      }
    }

    #applyImgMode(img, mode) {
      img.style.objectFit = mode === 'center' ? 'none' : mode;
      if (mode === 'center' || mode === 'none') {
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.position = 'absolute';
        img.style.top = '50%';
        img.style.left = '50%';
        img.style.transform = 'translate(-50%, -50%)';
      } else {
        img.style.width = '';
        img.style.height = '';
        img.style.position = '';
        img.style.top = '';
        img.style.left = '';
        img.style.transform = '';
      }
    }

    // -- Slideshow engine -----------------------------------------------------
    //
    // Two localStorage cache slots (A / B) hold compressed data-URIs of the
    // "current" and "next" images.  On page load the cached current image is
    // displayed instantly — no VFS or mount-permission required.  Each tick
    // transitions to the other slot (which already holds the pre-loaded next
    // image), then starts resolving + compressing the NEXT-next image into the
    // freed slot in the background.  The two slots ping-pong every cycle.

    async #startSlideshow(config, mode) {
      if (!config?.folder) return;
      this.#stopSlideshow();

      const interval = (config.interval || 30) * 1000;
      const shuffle = !!config.shuffle;
      const transition = config.transition || 'fade';
      const transitionDuration = config.transitionDuration || 1;

      // -- 1. Try to show cached images instantly -----------------------------
      const cacheValid = localStorage.getItem(SS_CACHE_FOLDER) === config.folder;
      const cachedA = cacheValid ? localStorage.getItem(SS_CACHE_A) : null;
      const cachedB = cacheValid ? localStorage.getItem(SS_CACHE_B) : null;
      const cachedFront = localStorage.getItem(SS_CACHE_FRONT) || 'a';
      const cachedCurrent = cachedFront === 'a' ? cachedA : cachedB;
      const cachedNext = cachedFront === 'a' ? cachedB : cachedA;

      this.#slideshowFront = true; // bgElement = front on start

      if (cachedCurrent) {
        this.#bgElement.src = cachedCurrent;
        try { await this.#bgElement.decode(); } catch {}
        this.#bgElement.style.display = '';
        this.#bgElement.style.opacity = '1';
        this.#applyImgMode(this.#bgElement, mode);
      }
      if (cachedNext) {
        this.#bgAltElement.src = cachedNext;
        try { await this.#bgAltElement.decode(); } catch {}
        this.#bgAltElement.style.display = '';
        this.#applyImgMode(this.#bgAltElement, mode);
      }

      // -- 2. Build image list from VFS in background -------------------------
      try {
        const kernel = SZ.system?.kernel;
        if (!kernel) return;
        const entries = await kernel.List(config.folder, config.recursive ? 1 : 0);
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
        this.#slideshowImages = entries.filter(name => {
          const ext = name.split('.').pop().toLowerCase();
          return imageExts.includes(ext);
        }).map(name => config.folder + '/' + name);
      } catch (e) {
        console.warn('[SZ] Slideshow folder read error:', e);
        return; // keep showing cached images if available
      }

      if (this.#slideshowImages.length === 0) return;

      if (shuffle)
        this.#shuffleArray(this.#slideshowImages);

      // Resume from persisted index (or start at 0)
      const savedIdx = cacheValid ? parseInt(localStorage.getItem(SS_CACHE_IDX), 10) || 0 : 0;
      this.#slideshowIndex = savedIdx % this.#slideshowImages.length;

      // -- 3. Cold start: populate cache if empty -----------------------------
      if (!cachedCurrent) {
        const src = await this.#resolveVfsSrc(this.#slideshowImages[this.#slideshowIndex]);
        if (!src) return;
        this.#bgElement.src = src;
        try { await this.#bgElement.decode(); } catch {}
        this.#bgElement.style.display = '';
        this.#bgElement.style.opacity = '1';
        this.#applyImgMode(this.#bgElement, mode);
        this.#bgAltElement.style.display = '';
        this.#applyImgMode(this.#bgAltElement, mode);
        // Cache current slot (fire-and-forget)
        Desktop.#compressToDataUri(src).then(d => { if (d) try { localStorage.setItem(SS_CACHE_A, d); } catch {} });
        localStorage.setItem(SS_CACHE_FRONT, 'a');
        localStorage.setItem(SS_CACHE_FOLDER, config.folder);
        localStorage.setItem(SS_CACHE_IDX, String(this.#slideshowIndex));
      }

      // -- 4. Load target image into back slot, then start tick loop ----------
      this.#loadNextTarget(config.folder, mode);
      this.#scheduleTick(config, mode, transition, transitionDuration, shuffle, interval);
    }

    // Load the next image, compress it, store in the free cache slot,
    // and set it as the src of the back <img> element so it's ready to show.
    #loadNextTarget(folder, mode) {
      const nextIdx = (this.#slideshowIndex + 1) % this.#slideshowImages.length;
      const backEl = this.#slideshowFront ? this.#bgAltElement : this.#bgElement;
      const slotKey = this.#slideshowFront ? SS_CACHE_B : SS_CACHE_A;

      this.#cachePromise = (async () => {
        const src = await this.#resolveVfsSrc(this.#slideshowImages[nextIdx]);
        if (!src || !this.#slideshowTimer) return;

        const dataUri = await Desktop.#compressToDataUri(src);
        if (!this.#slideshowTimer) return;

        if (dataUri)
          try { localStorage.setItem(slotKey, dataUri); } catch {}

        backEl.src = dataUri || src;
        this.#applyImgMode(backEl, mode);
        try { await backEl.decode(); } catch {}
      })();
    }

    #scheduleTick(config, mode, transition, transitionDuration, shuffle, interval) {
      this.#slideshowTimer = setTimeout(
        () => this.#slideshowTick(config, mode, transition, transitionDuration, shuffle, interval),
        interval
      );
    }

    async #slideshowTick(config, mode, transition, transitionDuration, shuffle, interval) {
      // 1. Wait for target image to be ready
      if (this.#cachePromise) {
        await this.#cachePromise;
        this.#cachePromise = null;
      }
      if (!this.#slideshowTimer) return;

      // 2. Advance index
      ++this.#slideshowIndex;
      if (this.#slideshowIndex >= this.#slideshowImages.length) {
        this.#slideshowIndex = 0;
        if (shuffle)
          this.#shuffleArray(this.#slideshowImages);
      }

      const front = this.#slideshowFront ? this.#bgElement : this.#bgAltElement;
      const back = this.#slideshowFront ? this.#bgAltElement : this.#bgElement;

      // Ensure back element is decoded (should be instant — already cached)
      if (back.src && back.src !== 'about:blank')
        try { await back.decode(); } catch {}
      if (!this.#slideshowTimer) return;

      // 3. Start transition animation (source → target)
      this.#applySlideshowTransition(front, back, transition, transitionDuration);

      // 4. Wait for animation to complete, THEN swap and load next
      this.#slideshowTimer = setTimeout(() => {
        if (!this.#slideshowTimer) return;

        SZ.TransitionEngine.cancelPending(this.#subTimers);
        SZ.TransitionEngine.reset(front);

        // 5. Swap: target becomes the new source
        this.#slideshowFront = !this.#slideshowFront;
        localStorage.setItem(SS_CACHE_FRONT, this.#slideshowFront ? 'a' : 'b');
        localStorage.setItem(SS_CACHE_IDX, String(this.#slideshowIndex));

        // 6. Load next target into the freed slot
        this.#loadNextTarget(config.folder, mode);

        // 7. Restart interval — next tick after interval elapses
        this.#scheduleTick(config, mode, transition, transitionDuration, shuffle, interval);
      }, transitionDuration * 1000);
    }

    // Compress an image URL into a JPEG data URI sized to the screen.
    static #compressToDataUri(src) {
      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
            const maxW = screen.width || 1920;
            const maxH = screen.height || 1080;
            if (w > maxW || h > maxH) {
              const scale = Math.min(maxW / w, maxH / h);
              w = Math.round(w * scale);
              h = Math.round(h * scale);
            }
            if (w === 0 || h === 0) { resolve(null); return; }
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            c.getContext('2d').drawImage(img, 0, 0, w, h);
            resolve(c.toDataURL('image/jpeg', 0.85));
          } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = src;
      });
    }

    #stopSlideshow() {
      SZ.TransitionEngine.cancelPending(this.#subTimers);
      if (this.#slideshowTimer) {
        clearTimeout(this.#slideshowTimer);
        this.#slideshowTimer = null;
      }
      this.#cachePromise = null;
      SZ.TransitionEngine.reset(this.#bgElement);
      SZ.TransitionEngine.reset(this.#bgAltElement);
    }

    static #clearSlideshowCache() {
      for (const k of [SS_CACHE_A, SS_CACHE_B, SS_CACHE_FRONT, SS_CACHE_IDX, SS_CACHE_FOLDER])
        localStorage.removeItem(k);
    }

    #applySlideshowTransition(front, back, transition, duration) {
      const t = SZ.TransitionEngine.resolveTransition(transition);
      SZ.TransitionEngine.runTransition(front, back, t, duration, this.#subTimers);
    }

    async #resolveVfsSrc(path) {
      try {
        const kernel = SZ.system?.kernel;
        if (kernel && path.startsWith('/'))
          return await kernel.ReadUri(path) || path;
      } catch {}
      return path;
    }

    #shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; --i) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }

    // -- Video background -----------------------------------------------------

    #applyVideoBackground(config) {
      if (!config?.src) return;

      this.#videoElement.style.display = 'block';
      this.#videoElement.muted = true;
      this.#videoElement.loop = config.loop !== false;
      this.#videoElement.playbackRate = config.playbackRate || 1;

      // Resolve VFS path
      if (config.src.startsWith('/')) {
        const kernel = SZ.system?.kernel;
        if (kernel) {
          kernel.ReadUri(config.src).then(uri => {
            if (uri) {
              this.#videoElement.src = uri;
              this.#videoElement.play().catch(e => console.warn('[SZ] Video autoplay blocked:', e));
            }
          }).catch(e => console.warn('[SZ] Video VFS error:', e));
        }
      } else {
        this.#videoElement.src = config.src;
        this.#videoElement.play().catch(e => console.warn('[SZ] Video autoplay blocked:', e));
      }
    }

    addIcon(icon) {
      this.#icons.push(icon);
      this.#iconArea.appendChild(icon.element);

      // Wire up drag-end callback
      icon.onDragEnd = (ic, rawX, rawY) => this.#handleIconDrop(ic, rawX, rawY);

      // Restore saved position or assign next available cell
      const saved = this.#savedPositions?.[icon.id];
      if (saved != null) {
        const col = saved.col;
        const row = saved.row;
        const cellKey = col + ',' + row;
        if (!this.#occupiedCells.has(cellKey)) {
          this.#occupiedCells.set(cellKey, icon.id);
          icon.setPosition(this.#cellToPixel(col, row).x, this.#cellToPixel(col, row).y);
          return;
        }
      }

      // No saved position or cell taken -- assign next available
      const { col, row } = this.#nextAvailableCell();
      this.#occupiedCells.set(col + ',' + row, icon.id);
      icon.setPosition(this.#cellToPixel(col, row).x, this.#cellToPixel(col, row).y);
      this.#savePositions();
    }

    get icons() { return this.#icons; }
    get iconArea() { return this.#iconArea; }

    findIcon(id) { return this.#icons.find(ic => ic.id === id) || null; }

    removeIcon(id) {
      const idx = this.#icons.findIndex(ic => ic.id === id);
      if (idx < 0)
        return false;
      const icon = this.#icons[idx];
      icon.element.remove();
      this.#icons.splice(idx, 1);
      for (const [key, occupantId] of this.#occupiedCells)
        if (occupantId === id) {
          this.#occupiedCells.delete(key);
          break;
        }
      this.#savePositions();
      return true;
    }

    clearIcons() {
      this.#icons = [];
      this.#occupiedCells.clear();
      this.#iconArea.innerHTML = '';
    }

    // -- Grid helpers ---------------------------------------------------------

    #cellToPixel(col, row) {
      return {
        x: PADDING + col * GRID_W,
        y: PADDING + row * GRID_H,
      };
    }

    #pixelToCell(px, py) {
      return {
        col: Math.max(0, Math.round((px - PADDING) / GRID_W)),
        row: Math.max(0, Math.round((py - PADDING) / GRID_H)),
      };
    }

    #maxGridDimensions() {
      const areaW = this.#iconArea.clientWidth || this.#element.clientWidth;
      const areaH = this.#iconArea.clientHeight || this.#element.clientHeight;
      return {
        cols: Math.max(1, Math.floor((areaW - PADDING) / GRID_W)),
        rows: Math.max(1, Math.floor((areaH - PADDING) / GRID_H)),
      };
    }

    #nextAvailableCell() {
      const { cols, rows } = this.#maxGridDimensions();
      // Fill top-to-bottom, then left-to-right (like Windows)
      for (let col = 0; col < cols; ++col)
        for (let row = 0; row < rows; ++row)
          if (!this.#occupiedCells.has(col + ',' + row))
            return { col, row };

      // Overflow: extend columns beyond the visible area
      let col = cols;
      for (;;) {
        for (let row = 0; row < rows; ++row)
          if (!this.#occupiedCells.has(col + ',' + row))
            return { col, row };
        ++col;
      }
    }

    #findNearestEmptyCell(targetCol, targetRow, excludeId) {
      const { cols, rows } = this.#maxGridDimensions();
      // Clamp into visible area
      targetCol = Math.max(0, Math.min(targetCol, cols - 1));
      targetRow = Math.max(0, Math.min(targetRow, rows - 1));

      const key = targetCol + ',' + targetRow;
      const occupant = this.#occupiedCells.get(key);
      if (!occupant || occupant === excludeId)
        return { col: targetCol, row: targetRow };

      // Spiral outward to find the nearest empty cell
      for (let radius = 1; radius < cols + rows; ++radius)
        for (let dc = -radius; dc <= radius; ++dc)
          for (let dr = -radius; dr <= radius; ++dr) {
            if (Math.abs(dc) !== radius && Math.abs(dr) !== radius)
              continue;
            const c = targetCol + dc;
            const r = targetRow + dr;
            if (c < 0 || r < 0 || c >= cols || r >= rows)
              continue;
            const k = c + ',' + r;
            const occ = this.#occupiedCells.get(k);
            if (!occ || occ === excludeId)
              return { col: c, row: r };
          }

      // Fallback: find any free cell
      return this.#nextAvailableCell();
    }

    // -- Drag handling --------------------------------------------------------

    #handleIconDrop(icon, rawX, rawY) {
      // Remove from old cell
      for (const [key, id] of this.#occupiedCells)
        if (id === icon.id) {
          this.#occupiedCells.delete(key);
          break;
        }

      // Snap to nearest empty grid cell
      const { col: targetCol, row: targetRow } = this.#pixelToCell(rawX, rawY);
      const { col, row } = this.#findNearestEmptyCell(targetCol, targetRow, icon.id);

      this.#occupiedCells.set(col + ',' + row, icon.id);
      icon.setPosition(this.#cellToPixel(col, row).x, this.#cellToPixel(col, row).y);
      this.#savePositions();
    }

    // -- Persistence ----------------------------------------------------------

    #loadPositions() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw)
          this.#savedPositions = JSON.parse(raw);
      } catch { /* ignore corrupt data */ }
    }

    #savePositions() {
      const positions = {};
      for (const icon of this.#icons) {
        const { col, row } = this.#pixelToCell(icon.x, icon.y);
        positions[icon.id] = { col, row };
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
      } catch { /* storage full -- silently ignore */ }
    }

    // -- Selection ------------------------------------------------------------

    #deselectAll() {
      for (const icon of this.#icons) icon.deselect();
      this.#element.dispatchEvent(new CustomEvent('sz:desktop-click', { bubbles: true }));
    }
  }

  SZ.Desktop = Desktop;
})();
