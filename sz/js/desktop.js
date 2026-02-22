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

        // Cancel any remaining transition callbacks
        for (const id of Desktop.#pendingLaters) clearTimeout(id);
        for (const id of Desktop.#pendingRAFs) cancelAnimationFrame(id);
        Desktop.#pendingLaters.length = 0;
        Desktop.#pendingRAFs.length = 0;
        for (const id of this.#subTimers) clearInterval(id);
        this.#subTimers.clear();

        // Reset old source (the element that was animated out)
        const _r = (el) => { el.style.transition = ''; el.style.clipPath = ''; el.style.filter = ''; el.style.transform = ''; el.style.opacity = ''; el.style.transformOrigin = ''; el.style.zIndex = ''; };
        _r(front);

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
      // Cancel pending transition timers/RAFs
      for (const id of Desktop.#pendingLaters) clearTimeout(id);
      for (const id of Desktop.#pendingRAFs) cancelAnimationFrame(id);
      Desktop.#pendingLaters.length = 0;
      Desktop.#pendingRAFs.length = 0;
      if (this.#slideshowTimer) {
        clearTimeout(this.#slideshowTimer);
        this.#slideshowTimer = null;
      }
      for (const id of this.#subTimers) clearInterval(id);
      this.#subTimers.clear();
      this.#cachePromise = null;
      const _r = (el) => { el.style.transition = ''; el.style.transform = ''; el.style.clipPath = ''; el.style.filter = ''; el.style.opacity = ''; el.style.transformOrigin = ''; el.style.zIndex = ''; };
      _r(this.#bgElement);
      _r(this.#bgAltElement);
    }

    static #clearSlideshowCache() {
      for (const k of [SS_CACHE_A, SS_CACHE_B, SS_CACHE_FRONT, SS_CACHE_IDX, SS_CACHE_FOLDER])
        localStorage.removeItem(k);
    }

    #applySlideshowTransition(front, back, transition, duration) {
      // Backward compat for old config values
      const _compat = { 'slide-left': 'push-left', 'slide-right': 'push-right', zoom: 'zoom-in' };
      let t = _compat[transition] || transition;
      if (t === 'random')
        t = Desktop.#ALL_TRANSITIONS[Math.floor(Math.random() * Desktop.#ALL_TRANSITIONS.length)];
      Desktop.#runTransition(front, back, t, duration, this.#subTimers);
    }

    static #pendingLaters = [];
    static #pendingRAFs = [];

    static #ALL_TRANSITIONS = [
      'fade','cut','fade-black','fade-white','dissolve','crossfade',
      'push-left','push-right','push-up','push-down',
      'cover-left','cover-right','cover-up','cover-down',
      'uncover-left','uncover-right','uncover-up','uncover-down',
      'wipe-left','wipe-right','wipe-up','wipe-down',
      'split-horizontal-out','split-horizontal-in','split-vertical-out','split-vertical-in',
      'reveal-left','reveal-right',
      'circle-in','circle-out','diamond-in','diamond-out',
      'clock-cw','clock-ccw','wedge',
      'blinds-horizontal','blinds-vertical','checkerboard',
      'comb-horizontal','comb-vertical','pixelate','bars-random',
      'zoom-in','zoom-out','zoom-rotate','spin-cw','spin-ccw',
      'flip-horizontal','flip-vertical',
      'cube-left','cube-right','cube-up','cube-down',
      'blur','glitch','morph',
    ];

    // Transitions where the front element must be on top (it animates out to reveal back)
    static #FRONT_ON_TOP = new Set([
      'uncover-left','uncover-right','uncover-up','uncover-down',
      'circle-out','diamond-out',
      'split-horizontal-in','split-vertical-in',
      'flip-horizontal','flip-vertical',
      'glitch',
    ]);

    static #runTransition(front, back, transition, duration, subTimers) {
      const _reset = (el) => { el.style.transition = ''; el.style.clipPath = ''; el.style.filter = ''; el.style.transform = ''; el.style.opacity = ''; el.style.transformOrigin = ''; el.style.zIndex = ''; };
      const _trackedInterval = (fn, ms) => { const id = setInterval(() => fn(id), ms); subTimers?.add(id); return id; };
      const _clearSub = (id) => { clearInterval(id); subTimers?.delete(id); };
      // Cancel pending timers/RAFs from any previous transition
      for (const id of Desktop.#pendingLaters) clearTimeout(id);
      for (const id of Desktop.#pendingRAFs) cancelAnimationFrame(id);
      Desktop.#pendingLaters.length = 0;
      Desktop.#pendingRAFs.length = 0;
      if (subTimers) { for (const id of subTimers) clearInterval(id); subTimers.clear(); }
      const _later = (fn, ms) => { const id = setTimeout(fn, ms); Desktop.#pendingLaters.push(id); };
      const _rAF = (fn) => { const id = requestAnimationFrame(fn); Desktop.#pendingRAFs.push(id); };
      _reset(front);
      _reset(back);

      // Set z-order: some transitions need front on top (it departs), others need back on top (it arrives)
      if (Desktop.#FRONT_ON_TOP.has(transition)) {
        front.style.zIndex = '1';
        back.style.zIndex = '0';
      } else {
        back.style.zIndex = '1';
        front.style.zIndex = '0';
      }

      const d = duration;
      const ease = 'ease';
      const easeIO = 'ease-in-out';

      switch (transition) {

        // ── Subtle ───────────────────────────────────────────────
        case 'cut':
          back.style.opacity = '1';
          front.style.opacity = '0';
          break;
        case 'fade-black':
          front.style.transition = `opacity ${d * 0.5}s ${ease}`;
          front.style.opacity = '0';
          back.style.opacity = '0';
          _later(() => { back.style.transition = `opacity ${d * 0.5}s ${ease}`; back.style.opacity = '1'; }, d * 500);
          break;
        case 'fade-white':
          front.style.transition = `opacity ${d * 0.5}s ${ease}`;
          front.style.opacity = '0';
          back.style.opacity = '0';
          back.style.filter = 'brightness(5)';
          _later(() => { back.style.transition = `opacity ${d * 0.4}s ${ease}, filter ${d * 0.6}s ${ease}`; back.style.opacity = '1'; back.style.filter = 'brightness(1)'; }, d * 400);
          break;
        case 'dissolve':
          back.style.opacity = '0';
          _rAF(() => { back.style.transition = `opacity ${d * 1.5}s ${ease}`; back.style.opacity = '1'; front.style.transition = `opacity ${d * 1.5}s ${ease}`; front.style.opacity = '0'; });
          break;
        case 'crossfade':
          back.style.opacity = '0';
          _rAF(() => { back.style.transition = `opacity ${d}s linear`; back.style.opacity = '1'; front.style.transition = `opacity ${d}s linear`; front.style.opacity = '0'; });
          break;

        // ── Push ─────────────────────────────────────────────────
        case 'push-left':
          back.style.opacity = '1'; back.style.transform = 'translateX(100%)';
          _rAF(() => { const t = `transform ${d}s ${easeIO}`; front.style.transition = t; back.style.transition = t; front.style.transform = 'translateX(-100%)'; back.style.transform = 'translateX(0)'; _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000); });
          break;
        case 'push-right':
          back.style.opacity = '1'; back.style.transform = 'translateX(-100%)';
          _rAF(() => { const t = `transform ${d}s ${easeIO}`; front.style.transition = t; back.style.transition = t; front.style.transform = 'translateX(100%)'; back.style.transform = 'translateX(0)'; _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000); });
          break;
        case 'push-up':
          back.style.opacity = '1'; back.style.transform = 'translateY(100%)';
          _rAF(() => { const t = `transform ${d}s ${easeIO}`; front.style.transition = t; back.style.transition = t; front.style.transform = 'translateY(-100%)'; back.style.transform = 'translateY(0)'; _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000); });
          break;
        case 'push-down':
          back.style.opacity = '1'; back.style.transform = 'translateY(-100%)';
          _rAF(() => { const t = `transform ${d}s ${easeIO}`; front.style.transition = t; back.style.transition = t; front.style.transform = 'translateY(100%)'; back.style.transform = 'translateY(0)'; _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000); });
          break;

        // ── Cover ────────────────────────────────────────────────
        case 'cover-left':
          back.style.opacity = '1'; back.style.transform = 'translateX(100%)';
          _rAF(() => { back.style.transition = `transform ${d}s ${easeIO}`; back.style.transform = 'translateX(0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;
        case 'cover-right':
          back.style.opacity = '1'; back.style.transform = 'translateX(-100%)';
          _rAF(() => { back.style.transition = `transform ${d}s ${easeIO}`; back.style.transform = 'translateX(0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;
        case 'cover-up':
          back.style.opacity = '1'; back.style.transform = 'translateY(100%)';
          _rAF(() => { back.style.transition = `transform ${d}s ${easeIO}`; back.style.transform = 'translateY(0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;
        case 'cover-down':
          back.style.opacity = '1'; back.style.transform = 'translateY(-100%)';
          _rAF(() => { back.style.transition = `transform ${d}s ${easeIO}`; back.style.transform = 'translateY(0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;

        // ── Uncover ──────────────────────────────────────────────
        case 'uncover-left':
          back.style.opacity = '1';
          _rAF(() => { front.style.transition = `transform ${d}s ${easeIO}`; front.style.transform = 'translateX(-100%)'; _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000); });
          break;
        case 'uncover-right':
          back.style.opacity = '1';
          _rAF(() => { front.style.transition = `transform ${d}s ${easeIO}`; front.style.transform = 'translateX(100%)'; _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000); });
          break;
        case 'uncover-up':
          back.style.opacity = '1';
          _rAF(() => { front.style.transition = `transform ${d}s ${easeIO}`; front.style.transform = 'translateY(-100%)'; _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000); });
          break;
        case 'uncover-down':
          back.style.opacity = '1';
          _rAF(() => { front.style.transition = `transform ${d}s ${easeIO}`; front.style.transform = 'translateY(100%)'; _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000); });
          break;

        // ── Wipe ─────────────────────────────────────────────────
        case 'wipe-left':
          back.style.opacity = '1'; back.style.clipPath = 'inset(0 100% 0 0)';
          _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;
        case 'wipe-right':
          back.style.opacity = '1'; back.style.clipPath = 'inset(0 0 0 100%)';
          _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;
        case 'wipe-up':
          back.style.opacity = '1'; back.style.clipPath = 'inset(100% 0 0 0)';
          _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;
        case 'wipe-down':
          back.style.opacity = '1'; back.style.clipPath = 'inset(0 0 100% 0)';
          _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;

        // ── Split ────────────────────────────────────────────────
        case 'split-horizontal-out':
          back.style.opacity = '1'; back.style.clipPath = 'inset(50% 0 50% 0)';
          _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;
        case 'split-horizontal-in':
          back.style.opacity = '1'; front.style.clipPath = 'inset(0 0 0 0)';
          _rAF(() => { front.style.transition = `clip-path ${d}s ${easeIO}`; front.style.clipPath = 'inset(50% 0 50% 0)'; _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000); });
          break;
        case 'split-vertical-out':
          back.style.opacity = '1'; back.style.clipPath = 'inset(0 50% 0 50%)';
          _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;
        case 'split-vertical-in':
          back.style.opacity = '1'; front.style.clipPath = 'inset(0 0 0 0)';
          _rAF(() => { front.style.transition = `clip-path ${d}s ${easeIO}`; front.style.clipPath = 'inset(0 50% 0 50%)'; _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000); });
          break;

        // ── Reveal ───────────────────────────────────────────────
        case 'reveal-left':
          back.style.opacity = '1'; back.style.clipPath = 'inset(0 100% 0 0)';
          _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; front.style.transition = `transform ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; front.style.transform = 'translateX(-100%)'; _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000); });
          break;
        case 'reveal-right':
          back.style.opacity = '1'; back.style.clipPath = 'inset(0 0 0 100%)';
          _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; front.style.transition = `transform ${d}s ${easeIO}`; back.style.clipPath = 'inset(0 0 0 0)'; front.style.transform = 'translateX(100%)'; _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000); });
          break;

        // ── Shape ────────────────────────────────────────────────
        case 'circle-in':
          back.style.opacity = '1'; back.style.clipPath = 'circle(0% at 50% 50%)';
          _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'circle(75% at 50% 50%)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;
        case 'circle-out':
          back.style.opacity = '1'; front.style.clipPath = 'circle(75% at 50% 50%)';
          _rAF(() => { front.style.transition = `clip-path ${d}s ${easeIO}`; front.style.clipPath = 'circle(0% at 50% 50%)'; _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000); });
          break;
        case 'diamond-in':
          back.style.opacity = '1'; back.style.clipPath = 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)';
          _rAF(() => { back.style.transition = `clip-path ${d}s ${easeIO}`; back.style.clipPath = 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)'; _later(() => { front.style.opacity = '0'; }, d * 1000); });
          break;
        case 'diamond-out':
          back.style.opacity = '1'; front.style.clipPath = 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)';
          _rAF(() => { front.style.transition = `clip-path ${d}s ${easeIO}`; front.style.clipPath = 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)'; _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000); });
          break;

        // ── Clock / Wedge ────────────────────────────────────────
        case 'clock-cw':
        case 'clock-ccw':
        case 'wedge': {
          back.style.opacity = '1';
          const ccw = transition === 'clock-ccw';
          const isWedge = transition === 'wedge';
          const steps = 60, stepTime = (d * 1000) / steps;
          let step = 0;
          const _cx = (a) => Math.sin(a * Math.PI / 180) * 75;
          const _cy = (a) => -Math.cos(a * Math.PI / 180) * 75;
          const _poly = (angle) => {
            const pts = ['50% 50%', '50% 0%'];
            const aa = Math.abs(angle);
            if (aa > 45) pts.push(ccw ? '0% 0%' : '100% 0%');
            if (aa > 135) pts.push(ccw ? '0% 100%' : '100% 100%');
            if (aa > 225) pts.push(ccw ? '100% 100%' : '0% 100%');
            if (aa > 315) pts.push(ccw ? '100% 0%' : '0% 0%');
            pts.push(`${50 + _cx(angle)}% ${50 + _cy(angle)}%`);
            return pts.join(', ');
          };
          _trackedInterval((ct) => {
            ++step;
            const p = step / steps;
            if (isWedge) {
              const a = p * 180;
              back.style.clipPath = p > 0.5
                ? `polygon(50% 50%, ${50 + _cx(a)}% ${50 + _cy(a)}%, ${50 + _cx(a - 30)}% ${50 + _cy(a - 30)}%, 50% 0%, ${50 + _cx(-a + 30)}% ${50 + _cy(-a + 30)}%, ${50 + _cx(-a)}% ${50 + _cy(-a)}%)`
                : `polygon(50% 50%, ${50 + _cx(a)}% ${50 + _cy(a)}%, 50% 0%, ${50 + _cx(-a)}% ${50 + _cy(-a)}%)`;
            } else {
              back.style.clipPath = `polygon(${_poly((ccw ? -1 : 1) * p * 360)})`;
            }
            if (step >= steps) { _clearSub(ct); back.style.clipPath = ''; front.style.opacity = '0'; }
          }, stepTime);
          break;
        }

        // ── Blinds ───────────────────────────────────────────────
        case 'blinds-horizontal':
        case 'blinds-vertical': {
          const horiz = transition === 'blinds-horizontal';
          const n = horiz ? 8 : 10;
          back.style.opacity = '1';
          const steps = 30, stepTime = (d * 1000) / steps;
          let step = 0;
          _trackedInterval((bt) => {
            ++step;
            const rects = [], size = 100 / n;
            for (let i = 0; i < n; ++i) {
              const s = i * size, rev = size * (step / steps);
              rects.push(horiz ? `0% ${s}%, 100% ${s}%, 100% ${s + rev}%, 0% ${s + rev}%` : `${s}% 0%, ${s + rev}% 0%, ${s + rev}% 100%, ${s}% 100%`);
            }
            back.style.clipPath = `polygon(evenodd, ${rects.join(', ')})`;
            if (step >= steps) { _clearSub(bt); back.style.clipPath = ''; front.style.opacity = '0'; }
          }, stepTime);
          break;
        }

        // ── Checkerboard ─────────────────────────────────────────
        case 'checkerboard': {
          back.style.opacity = '1';
          const cols = 8, rows = 6, cw = 100 / cols, ch = 100 / rows;
          const cells = [];
          for (let r = 0; r < rows; ++r) for (let c = 0; c < cols; ++c) cells.push({ r, c, delay: ((r + c) % 2) * 0.3 + Math.random() * 0.4 });
          cells.sort((a, b) => a.delay - b.delay);
          const revealed = new Set(), steps = 20, stepTime = (d * 1000) / steps;
          let step = 0;
          _trackedInterval((ct) => {
            ++step;
            const p = step / steps;
            for (const cell of cells) if (p >= cell.delay / 1.1 && !revealed.has(`${cell.r},${cell.c}`)) revealed.add(`${cell.r},${cell.c}`);
            if (revealed.size === 0) { back.style.clipPath = 'polygon(0 0, 0 0, 0 0)'; }
            else {
              const rects = [];
              for (const key of revealed) { const [r, c] = key.split(',').map(Number); const x = c * cw, y = r * ch; rects.push(`${x}% ${y}%, ${x + cw}% ${y}%, ${x + cw}% ${y + ch}%, ${x}% ${y + ch}%`); }
              back.style.clipPath = `polygon(evenodd, ${rects.join(', ')})`;
            }
            if (step >= steps) { _clearSub(ct); back.style.clipPath = ''; front.style.opacity = '0'; }
          }, stepTime);
          break;
        }

        // ── Comb ─────────────────────────────────────────────────
        case 'comb-horizontal':
        case 'comb-vertical': {
          const horiz = transition === 'comb-horizontal';
          const n = horiz ? 10 : 8;
          back.style.opacity = '1';
          const steps = 30, stepTime = (d * 1000) / steps;
          let step = 0;
          _trackedInterval((ct) => {
            ++step;
            const p = step / steps, rects = [], sz = 100 / n;
            for (let i = 0; i < n; ++i) {
              const s = i * sz, fromLeft = i % 2 === 0, rev = 100 * p;
              if (horiz) { const x0 = fromLeft ? 0 : 100 - rev, x1 = fromLeft ? rev : 100; rects.push(`${x0}% ${s}%, ${x1}% ${s}%, ${x1}% ${s + sz}%, ${x0}% ${s + sz}%`); }
              else { const y0 = fromLeft ? 0 : 100 - rev, y1 = fromLeft ? rev : 100; rects.push(`${s}% ${y0}%, ${s + sz}% ${y0}%, ${s + sz}% ${y1}%, ${s}% ${y1}%`); }
            }
            back.style.clipPath = `polygon(evenodd, ${rects.join(', ')})`;
            if (step >= steps) { _clearSub(ct); back.style.clipPath = ''; front.style.opacity = '0'; }
          }, stepTime);
          break;
        }

        // ── Pixelate ─────────────────────────────────────────────
        case 'pixelate':
          back.style.opacity = '0'; back.style.filter = 'blur(20px)'; front.style.filter = 'blur(0px)';
          _rAF(() => {
            // Phase 1: front blurs
            front.style.transition = `filter ${d * 0.4}s ${ease}`;
            front.style.filter = 'blur(20px)';
            _later(() => {
              // Phase 2: cross-fade while both blurred (no black gap)
              front.style.transition = `opacity ${d * 0.2}s ${ease}`;
              front.style.opacity = '0';
              back.style.transition = `opacity ${d * 0.2}s ${ease}`;
              back.style.opacity = '1';
              _later(() => {
                // Phase 3: back unblurs
                back.style.transition = `filter ${d * 0.4}s ${ease}`;
                back.style.filter = 'blur(0px)';
              }, d * 200);
            }, d * 400);
          });
          break;

        // ── Random Bars ──────────────────────────────────────────
        case 'bars-random': {
          back.style.opacity = '1';
          const n = 20, bw = 100 / n;
          const order = Array.from({ length: n }, (_, i) => i);
          for (let i = n - 1; i > 0; --i) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
          const revealed = new Set(), stepTime = (d * 1000) / n;
          let step = 0;
          _trackedInterval((ct) => {
            revealed.add(order[step]); ++step;
            const rects = []; for (const idx of revealed) { const x = idx * bw; rects.push(`${x}% 0%, ${x + bw}% 0%, ${x + bw}% 100%, ${x}% 100%`); }
            back.style.clipPath = rects.length ? `polygon(evenodd, ${rects.join(', ')})` : '';
            if (step >= n) { _clearSub(ct); back.style.clipPath = ''; front.style.opacity = '0'; }
          }, stepTime);
          break;
        }

        // ── Zoom & Spin ──────────────────────────────────────────
        case 'zoom-in':
          back.style.opacity = '0'; back.style.transform = 'scale(1.5)';
          _rAF(() => { back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${ease}`; back.style.opacity = '1'; back.style.transform = 'scale(1)'; front.style.transition = `opacity ${d}s ${ease}`; front.style.opacity = '0'; });
          break;
        case 'zoom-out':
          back.style.opacity = '0'; back.style.transform = 'scale(0.5)';
          _rAF(() => { back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${ease}`; back.style.opacity = '1'; back.style.transform = 'scale(1)'; front.style.transition = `opacity ${d * 0.8}s ${ease}, transform ${d}s ${ease}`; front.style.opacity = '0'; front.style.transform = 'scale(1.5)'; _later(() => _reset(front), d * 1000); });
          break;
        case 'zoom-rotate':
          back.style.opacity = '0'; back.style.transform = 'scale(0.3) rotate(90deg)';
          _rAF(() => { back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${ease}`; back.style.opacity = '1'; back.style.transform = 'scale(1) rotate(0deg)'; front.style.transition = `opacity ${d * 0.7}s ${ease}, transform ${d}s ${ease}`; front.style.opacity = '0'; front.style.transform = 'scale(2) rotate(-45deg)'; _later(() => _reset(front), d * 1000); });
          break;
        case 'spin-cw':
          back.style.opacity = '0'; back.style.transform = 'rotate(-180deg) scale(0.5)';
          _rAF(() => { back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${easeIO}`; back.style.opacity = '1'; back.style.transform = 'rotate(0deg) scale(1)'; front.style.transition = `opacity ${d * 0.6}s ${ease}`; front.style.opacity = '0'; });
          break;
        case 'spin-ccw':
          back.style.opacity = '0'; back.style.transform = 'rotate(180deg) scale(0.5)';
          _rAF(() => { back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${easeIO}`; back.style.opacity = '1'; back.style.transform = 'rotate(0deg) scale(1)'; front.style.transition = `opacity ${d * 0.6}s ${ease}`; front.style.opacity = '0'; });
          break;

        // ── 3D-like ──────────────────────────────────────────────
        case 'flip-horizontal':
          back.style.opacity = '0'; front.style.transformOrigin = '50% 50%'; back.style.transformOrigin = '50% 50%';
          _rAF(() => {
            front.style.transition = `transform ${d * 0.5}s ${ease}, opacity ${d * 0.5}s ${ease}`; front.style.transform = 'perspective(800px) rotateY(90deg)'; front.style.opacity = '0';
            _later(() => { back.style.transform = 'perspective(800px) rotateY(-90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${ease}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateY(0deg)'; }); }, d * 500);
          });
          break;
        case 'flip-vertical':
          back.style.opacity = '0'; front.style.transformOrigin = '50% 50%'; back.style.transformOrigin = '50% 50%';
          _rAF(() => {
            front.style.transition = `transform ${d * 0.5}s ${ease}, opacity ${d * 0.5}s ${ease}`; front.style.transform = 'perspective(800px) rotateX(-90deg)'; front.style.opacity = '0';
            _later(() => { back.style.transform = 'perspective(800px) rotateX(90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${ease}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateX(0deg)'; }); }, d * 500);
          });
          break;
        case 'cube-left':
          back.style.opacity = '0'; front.style.transformOrigin = '100% 50%';
          _rAF(() => {
            front.style.transition = `transform ${d * 0.5}s ${easeIO}`; front.style.transform = 'perspective(800px) rotateY(90deg)';
            _later(() => { front.style.opacity = '0'; back.style.transformOrigin = '0% 50%'; back.style.transform = 'perspective(800px) rotateY(-90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${easeIO}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateY(0deg)'; }); }, d * 500);
          });
          break;
        case 'cube-right':
          back.style.opacity = '0'; front.style.transformOrigin = '0% 50%';
          _rAF(() => {
            front.style.transition = `transform ${d * 0.5}s ${easeIO}`; front.style.transform = 'perspective(800px) rotateY(-90deg)';
            _later(() => { front.style.opacity = '0'; back.style.transformOrigin = '100% 50%'; back.style.transform = 'perspective(800px) rotateY(90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${easeIO}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateY(0deg)'; }); }, d * 500);
          });
          break;
        case 'cube-up':
          back.style.opacity = '0'; front.style.transformOrigin = '50% 100%';
          _rAF(() => {
            front.style.transition = `transform ${d * 0.5}s ${easeIO}`; front.style.transform = 'perspective(800px) rotateX(-90deg)';
            _later(() => { front.style.opacity = '0'; back.style.transformOrigin = '50% 0%'; back.style.transform = 'perspective(800px) rotateX(90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${easeIO}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateX(0deg)'; }); }, d * 500);
          });
          break;
        case 'cube-down':
          back.style.opacity = '0'; front.style.transformOrigin = '50% 0%';
          _rAF(() => {
            front.style.transition = `transform ${d * 0.5}s ${easeIO}`; front.style.transform = 'perspective(800px) rotateX(90deg)';
            _later(() => { front.style.opacity = '0'; back.style.transformOrigin = '50% 100%'; back.style.transform = 'perspective(800px) rotateX(-90deg)'; back.style.opacity = '1'; back.style.transition = `transform ${d * 0.5}s ${easeIO}`; _rAF(() => { back.style.transform = 'perspective(800px) rotateX(0deg)'; }); }, d * 500);
          });
          break;

        // ── Effects ──────────────────────────────────────────────
        case 'blur':
          back.style.opacity = '0'; back.style.filter = 'blur(30px)'; front.style.filter = 'blur(0px)';
          _rAF(() => {
            // Phase 1: front blurs
            front.style.transition = `filter ${d * 0.4}s ${ease}`;
            front.style.filter = 'blur(30px)';
            _later(() => {
              // Phase 2: cross-fade while both blurred (no black gap)
              front.style.transition = `opacity ${d * 0.2}s ${ease}`;
              front.style.opacity = '0';
              back.style.transition = `opacity ${d * 0.2}s ${ease}`;
              back.style.opacity = '1';
              _later(() => {
                // Phase 3: back unblurs
                back.style.transition = `filter ${d * 0.4}s ${ease}`;
                back.style.filter = 'blur(0px)';
              }, d * 200);
            }, d * 400);
          });
          break;
        case 'glitch': {
          back.style.opacity = '1';
          const steps = 12, stepTime = (d * 1000) / steps;
          let step = 0;
          _trackedInterval((gt) => {
            ++step;
            const rx = (Math.random() - 0.5) * 10, ry = (Math.random() - 0.5) * 6, skew = (Math.random() - 0.5) * 5;
            const show = Math.random() > step / steps;
            front.style.transform = `translate(${rx}px, ${ry}px) skewX(${skew}deg)`;
            front.style.opacity = show ? '1' : '0';
            front.style.filter = show ? `hue-rotate(${Math.random() * 90}deg) saturate(${1 + Math.random() * 2})` : '';
            if (step >= steps) { _clearSub(gt); front.style.opacity = '0'; _reset(front); }
          }, stepTime);
          break;
        }
        case 'morph':
          back.style.opacity = '0'; back.style.transform = 'scale(1.1)'; back.style.filter = 'blur(10px) brightness(1.2)';
          _rAF(() => {
            const t = `opacity ${d}s ${ease}, transform ${d}s ${ease}, filter ${d}s ${ease}`;
            front.style.transition = t; front.style.opacity = '0'; front.style.transform = 'scale(0.95)'; front.style.filter = 'blur(10px) brightness(1.2)';
            back.style.transition = t; back.style.opacity = '1'; back.style.transform = 'scale(1)'; back.style.filter = 'blur(0px) brightness(1)';
            _later(() => _reset(front), d * 1000);
          });
          break;

        // ── Default / fade ───────────────────────────────────────
        case 'fade':
        default:
          back.style.opacity = '0';
          _rAF(() => { back.style.transition = `opacity ${d}s ${ease}`; back.style.opacity = '1'; front.style.transition = `opacity ${d}s ${ease}`; front.style.opacity = '0'; });
          break;
      }
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
