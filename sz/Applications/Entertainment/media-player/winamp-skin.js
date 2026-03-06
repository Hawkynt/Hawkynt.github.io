;(function() {
  'use strict';

  // -----------------------------------------------------------------------
  // Winamp Skin Parser & Compact Mode Renderer
  //
  // Loads .wsz (ZIP) files containing classic Winamp 2.x skin BMP sprites,
  // extracts them, and renders a fully skinned compact player UI.
  //
  // Reference: Webamp sprite coordinates (captbaritone/webamp)
  // Main window: 275x116 pixels (classic Winamp 2.x)
  // -----------------------------------------------------------------------

  const SZ = window.SZ || (window.SZ = {});

  // -----------------------------------------------------------------------
  // Constants -- Classic Winamp main window dimensions
  // -----------------------------------------------------------------------
  const SKIN_W = 275;
  const SKIN_H = 116;
  const STORAGE_KEY = 'sz-media-player-winamp-skin';

  // -----------------------------------------------------------------------
  // Sprite map -- pixel coordinates for each element in the BMP sheets
  // Based on the official Winamp 2.x skin specification
  // -----------------------------------------------------------------------
  const SPRITES = {
    MAIN: {
      BACKGROUND: { x: 0, y: 0, w: 275, h: 116 }
    },
    CBUTTONS: {
      PREV:        { x: 0, y: 0, w: 23, h: 18 },
      PREV_ACTIVE: { x: 0, y: 18, w: 23, h: 18 },
      PLAY:        { x: 23, y: 0, w: 23, h: 18 },
      PLAY_ACTIVE: { x: 23, y: 18, w: 23, h: 18 },
      PAUSE:       { x: 46, y: 0, w: 23, h: 18 },
      PAUSE_ACTIVE:{ x: 46, y: 18, w: 23, h: 18 },
      STOP:        { x: 69, y: 0, w: 23, h: 18 },
      STOP_ACTIVE: { x: 69, y: 18, w: 23, h: 18 },
      NEXT:        { x: 92, y: 0, w: 23, h: 18 },
      NEXT_ACTIVE: { x: 92, y: 18, w: 22, h: 18 },
      EJECT:       { x: 114, y: 0, w: 22, h: 16 },
      EJECT_ACTIVE:{ x: 114, y: 16, w: 22, h: 16 }
    },
    TITLEBAR: {
      BAR:           { x: 27, y: 15, w: 275, h: 14 },
      BAR_SELECTED:  { x: 27, y: 0, w: 275, h: 14 },
      OPTIONS:       { x: 0, y: 0, w: 9, h: 9 },
      OPTIONS_PRESS: { x: 0, y: 9, w: 9, h: 9 },
      MINIMIZE:      { x: 9, y: 0, w: 9, h: 9 },
      MINIMIZE_PRESS:{ x: 9, y: 9, w: 9, h: 9 },
      SHADE:         { x: 0, y: 18, w: 9, h: 9 },
      SHADE_PRESS:   { x: 9, y: 18, w: 9, h: 9 },
      CLOSE:         { x: 18, y: 0, w: 9, h: 9 },
      CLOSE_PRESS:   { x: 18, y: 9, w: 9, h: 9 },
      CLUTTER:       { x: 304, y: 0, w: 8, h: 43 },
      CLUTTER_DIS:   { x: 312, y: 0, w: 8, h: 43 }
    },
    POSBAR: {
      BG:           { x: 0, y: 0, w: 248, h: 10 },
      THUMB:        { x: 248, y: 0, w: 29, h: 10 },
      THUMB_ACTIVE: { x: 278, y: 0, w: 29, h: 10 }
    },
    VOLUME: {
      // Volume background is a tall strip of 28 frames stacked vertically
      // Each frame is 68x13, total height 420. Frame 0 = min, frame 27 = max
      BG:           { x: 0, y: 0, w: 68, h: 420, frames: 28, frameH: 13 },
      THUMB:        { x: 15, y: 422, w: 14, h: 11 },
      THUMB_ACTIVE: { x: 0, y: 422, w: 14, h: 11 }
    },
    BALANCE: {
      BG:           { x: 9, y: 0, w: 38, h: 420, frames: 28, frameH: 13 },
      THUMB:        { x: 15, y: 422, w: 14, h: 11 },
      THUMB_ACTIVE: { x: 0, y: 422, w: 14, h: 11 }
    },
    MONOSTER: {
      STEREO:          { x: 0, y: 12, w: 29, h: 12 },
      STEREO_SELECTED: { x: 0, y: 0, w: 29, h: 12 },
      MONO:            { x: 29, y: 12, w: 27, h: 12 },
      MONO_SELECTED:   { x: 29, y: 0, w: 27, h: 12 }
    },
    NUMBERS: {
      // Each digit is 9x13. Digits 0-9 starting at x=0
      DIGIT_W: 9, DIGIT_H: 13,
      MINUS:    { x: 20, y: 6, w: 5, h: 1 },
      NO_MINUS: { x: 9, y: 6, w: 5, h: 1 }
    },
    PLAYPAUS: {
      PLAYING: { x: 0, y: 0, w: 9, h: 9 },
      PAUSED:  { x: 9, y: 0, w: 9, h: 9 },
      STOPPED: { x: 18, y: 0, w: 9, h: 9 },
      WORKING: { x: 39, y: 0, w: 9, h: 9 },
      NOT_WORKING: { x: 36, y: 0, w: 9, h: 9 }
    },
    SHUFREP: {
      SHUFFLE:          { x: 28, y: 0, w: 47, h: 15 },
      SHUFFLE_PRESS:    { x: 28, y: 15, w: 47, h: 15 },
      SHUFFLE_ON:       { x: 28, y: 30, w: 47, h: 15 },
      SHUFFLE_ON_PRESS: { x: 28, y: 45, w: 47, h: 15 },
      REPEAT:           { x: 0, y: 0, w: 28, h: 15 },
      REPEAT_PRESS:     { x: 0, y: 15, w: 28, h: 15 },
      REPEAT_ON:        { x: 0, y: 30, w: 28, h: 15 },
      REPEAT_ON_PRESS:  { x: 0, y: 45, w: 28, h: 15 },
      EQ:               { x: 0, y: 61, w: 23, h: 12 },
      EQ_ON:            { x: 0, y: 73, w: 23, h: 12 },
      EQ_PRESS:         { x: 46, y: 61, w: 23, h: 12 },
      EQ_ON_PRESS:      { x: 46, y: 73, w: 23, h: 12 },
      PL:               { x: 23, y: 61, w: 23, h: 12 },
      PL_ON:            { x: 23, y: 73, w: 23, h: 12 },
      PL_PRESS:         { x: 69, y: 61, w: 23, h: 12 },
      PL_ON_PRESS:      { x: 69, y: 73, w: 23, h: 12 }
    },
    TEXT: {
      // 5x6 per character, arranged in rows:
      // Row 0: A-Z + extras (31 chars)
      // Row 1: 0-9 + symbols (31 chars)
      // Row 2: extended chars
      CHAR_W: 5, CHAR_H: 6
    }
  };

  // Text.bmp character lookup: maps char -> [row, col]
  const TEXT_LOOKUP = {};
  'abcdefghijklmnopqrstuvwxyz'.split('').forEach((c, i) => TEXT_LOOKUP[c] = [0, i]);
  TEXT_LOOKUP['"'] = [0, 26];
  TEXT_LOOKUP['@'] = [0, 27];
  TEXT_LOOKUP[' '] = [0, 30];
  '0123456789'.split('').forEach((c, i) => TEXT_LOOKUP[c] = [1, i]);
  TEXT_LOOKUP['.'] = [1, 11];
  TEXT_LOOKUP[':'] = [1, 12];
  TEXT_LOOKUP['('] = [1, 13];
  TEXT_LOOKUP[')'] = [1, 14];
  TEXT_LOOKUP['-'] = [1, 15];
  TEXT_LOOKUP["'"] = [1, 16];
  TEXT_LOOKUP['!'] = [1, 17];
  TEXT_LOOKUP['_'] = [1, 18];
  TEXT_LOOKUP['+'] = [1, 19];
  TEXT_LOOKUP['\\'] = [1, 20];
  TEXT_LOOKUP['/'] = [1, 21];
  TEXT_LOOKUP['['] = [1, 22];
  TEXT_LOOKUP[']'] = [1, 23];
  TEXT_LOOKUP['^'] = [1, 24];
  TEXT_LOOKUP['&'] = [1, 25];
  TEXT_LOOKUP['%'] = [1, 26];
  TEXT_LOOKUP[','] = [1, 27];
  TEXT_LOOKUP['='] = [1, 28];
  TEXT_LOOKUP['$'] = [1, 29];
  TEXT_LOOKUP['#'] = [1, 30];
  TEXT_LOOKUP['?'] = [2, 3];
  TEXT_LOOKUP['*'] = [2, 4];

  // -----------------------------------------------------------------------
  // Positions on the main window where each element is placed
  // Based on the Winamp 2.x layout
  // -----------------------------------------------------------------------
  const LAYOUT = {
    TITLEBAR: { x: 0, y: 0, w: 275, h: 14 },
    TITLE_BUTTONS: {
      OPTIONS:  { x: 6, y: 3 },
      MINIMIZE: { x: 244, y: 3 },
      SHADE:    { x: 254, y: 3 },
      CLOSE:    { x: 264, y: 3 }
    },
    CLUTTER_BAR: { x: 10, y: 22 },
    STATUS:       { x: 24, y: 28 },      // playpaus indicator 9x9
    MINUTES_TENS: { x: 48, y: 26 },      // first digit of minutes
    MINUTES_ONES: { x: 60, y: 26 },      // second digit of minutes
    SECONDS_TENS: { x: 78, y: 26 },      // first digit of seconds
    SECONDS_ONES: { x: 90, y: 26 },      // second digit of seconds
    MONOSTER:     { x: 212, y: 41 },
    KBPS:         { x: 111, y: 43 },
    KHZ:          { x: 156, y: 43 },
    TEXT_DISPLAY: { x: 112, y: 27, w: 154, h: 6 },  // scrolling text area
    VOLUME: {
      BG:    { x: 107, y: 57, w: 68, h: 13 },
      THUMB: { x: 107, y: 57, trackW: 51 }    // thumb slides across 51px
    },
    BALANCE: {
      BG:    { x: 177, y: 57, w: 38, h: 13 },
      THUMB: { x: 177, y: 57, trackW: 24 }
    },
    EQ_TOGGLE:    { x: 219, y: 58 },
    PL_TOGGLE:    { x: 242, y: 58 },
    POSBAR: {
      BG:    { x: 16, y: 72, w: 248, h: 10 },
      THUMB: { x: 16, y: 72, trackW: 219 }   // thumb slides across 219px
    },
    CBUTTONS: {
      PREV:  { x: 16, y: 88 },
      PLAY:  { x: 39, y: 88 },
      PAUSE: { x: 62, y: 88 },
      STOP:  { x: 85, y: 88 },
      NEXT:  { x: 108, y: 88 },
      EJECT: { x: 136, y: 89 }
    },
    SHUFFLE: { x: 164, y: 89 },
    REPEAT:  { x: 210, y: 89 }
  };

  // -----------------------------------------------------------------------
  // BMP file names to look for in the WSZ archive (case-insensitive)
  // -----------------------------------------------------------------------
  const SKIN_FILES = [
    'main.bmp', 'cbuttons.bmp', 'titlebar.bmp', 'posbar.bmp',
    'volume.bmp', 'balance.bmp', 'monoster.bmp', 'playpaus.bmp',
    'shufrep.bmp', 'text.bmp', 'nums_ex.bmp', 'numbers.bmp'
  ];

  // -----------------------------------------------------------------------
  // WinampSkin class -- parses a .wsz file and stores data URLs
  // -----------------------------------------------------------------------
  class WinampSkin {
    #images = {};
    #name = '';
    #loaded = false;

    get name() { return this.#name; }
    get loaded() { return this.#loaded; }

    getImage(name) {
      return this.#images[name.toLowerCase()] || null;
    }

    /**
     * Load a WSZ file from an ArrayBuffer.
     * Uses the built-in archive system's ZIP decompression (no JSZip needed)
     * or falls back to JSZip if available.
     */
    async load(arrayBuffer, name) {
      this.#name = name || 'Untitled Skin';
      this.#images = {};
      this.#loaded = false;

      const bytes = new Uint8Array(arrayBuffer);

      // Try using JSZip if available
      if (typeof JSZip !== 'undefined') {
        await this.#loadWithJSZip(bytes);
      } else {
        // Fallback: minimal ZIP extraction
        await this.#loadWithMinimalZip(bytes);
      }

      this.#loaded = Object.keys(this.#images).length > 0;
      return this.#loaded;
    }

    async #loadWithJSZip(bytes) {
      const zip = await JSZip.loadAsync(bytes);
      const promises = [];

      zip.forEach((relativePath, file) => {
        if (file.dir)
          return;

        const fileName = relativePath.split('/').pop().toLowerCase();
        if (!this.#isSkinFile(fileName))
          return;

        promises.push(
          file.async('blob').then(blob => {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                this.#images[fileName] = reader.result;
                resolve();
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          })
        );
      });

      await Promise.all(promises);
    }

    async #loadWithMinimalZip(bytes) {
      // Minimal ZIP extraction -- reads local file headers
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let offset = 0;

      while (offset + 30 < bytes.length) {
        // Look for local file header signature PK\x03\x04
        if (view.getUint32(offset, true) !== 0x04034b50)
          break;

        const compressionMethod = view.getUint16(offset + 8, true);
        const compressedSize = view.getUint32(offset + 18, true);
        const uncompressedSize = view.getUint32(offset + 22, true);
        const nameLength = view.getUint16(offset + 26, true);
        const extraLength = view.getUint16(offset + 28, true);
        const nameBytes = bytes.slice(offset + 30, offset + 30 + nameLength);
        const name = new TextDecoder().decode(nameBytes);
        const dataOffset = offset + 30 + nameLength + extraLength;

        const fileName = name.split('/').pop().toLowerCase();

        if (this.#isSkinFile(fileName)) {
          let fileData;
          if (compressionMethod === 0) {
            // Stored (no compression)
            fileData = bytes.slice(dataOffset, dataOffset + uncompressedSize);
          } else if (compressionMethod === 8) {
            // Deflate -- use DecompressionStream
            try {
              const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
              const ds = new DecompressionStream('deflate-raw');
              const writer = ds.writable.getWriter();
              writer.write(compressed);
              writer.close();
              const reader = ds.readable.getReader();
              const chunks = [];
              while (true) {
                const { done, value } = await reader.read();
                if (done)
                  break;
                chunks.push(value);
              }
              const totalLength = chunks.reduce((s, c) => s + c.length, 0);
              fileData = new Uint8Array(totalLength);
              let pos = 0;
              for (const chunk of chunks) {
                fileData.set(chunk, pos);
                pos += chunk.length;
              }
            } catch (_) {
              // Skip files that fail to decompress
              offset = dataOffset + compressedSize;
              continue;
            }
          } else {
            // Unknown compression, skip
            offset = dataOffset + compressedSize;
            continue;
          }

          // Convert to data URL
          const blob = new Blob([fileData], { type: 'image/bmp' });
          const url = await new Promise(resolve => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.readAsDataURL(blob);
          });
          this.#images[fileName] = url;
        }

        offset = dataOffset + compressedSize;
      }
    }

    #isSkinFile(name) {
      return SKIN_FILES.includes(name.toLowerCase());
    }
  }

  // -----------------------------------------------------------------------
  // WinampRenderer -- renders the compact Winamp UI into a container
  // -----------------------------------------------------------------------
  class WinampRenderer {
    #container = null;
    #skin = null;
    #elements = {};
    #scrollOffset = 0;
    #scrollTimer = null;
    #titleText = '';
    #titleCanvas = null;
    #titleCtx = null;
    #textImage = null;
    #numbersImage = null;
    #posThumbDragging = false;
    #volThumbDragging = false;

    // Callbacks set by the media player controller
    onPlay = null;
    onPause = null;
    onStop = null;
    onPrev = null;
    onNext = null;
    onEject = null;
    onSeek = null;         // (fraction 0..1)
    onVolume = null;       // (fraction 0..1)
    onShuffle = null;
    onRepeat = null;
    onClose = null;

    constructor() {
      this.#titleCanvas = document.createElement('canvas');
      this.#titleCanvas.width = 154;
      this.#titleCanvas.height = 6;
      this.#titleCtx = this.#titleCanvas.getContext('2d');
    }

    get active() { return !!this.#container; }

    /**
     * Build the DOM elements for the Winamp compact UI.
     */
    create(parentEl) {
      if (this.#container)
        this.destroy();

      const c = document.createElement('div');
      c.className = 'winamp-skin';
      c.style.width = SKIN_W + 'px';
      c.style.height = SKIN_H + 'px';
      c.style.position = 'relative';
      c.style.overflow = 'hidden';
      c.style.imageRendering = 'pixelated';

      // Main background
      const bg = this.#makeEl(c, 'winamp-bg', 0, 0, SKIN_W, SKIN_H);
      this.#elements.bg = bg;

      // Title bar
      const titlebar = this.#makeEl(c, 'winamp-titlebar', LAYOUT.TITLEBAR.x, LAYOUT.TITLEBAR.y, LAYOUT.TITLEBAR.w, LAYOUT.TITLEBAR.h);
      titlebar.style.cursor = 'default';
      this.#elements.titlebar = titlebar;

      // Title bar buttons
      this.#elements.btnClose = this.#makeButton(c, 'winamp-btn-close',
        LAYOUT.TITLE_BUTTONS.CLOSE.x, LAYOUT.TITLE_BUTTONS.CLOSE.y, 9, 9,
        () => { if (this.onClose) this.onClose(); });

      // Status indicator (play/pause/stop)
      this.#elements.status = this.#makeEl(c, 'winamp-status',
        LAYOUT.STATUS.x, LAYOUT.STATUS.y, 9, 9);

      // Time digits
      this.#elements.minTens = this.#makeEl(c, 'winamp-digit',
        LAYOUT.MINUTES_TENS.x, LAYOUT.MINUTES_TENS.y, 9, 13);
      this.#elements.minOnes = this.#makeEl(c, 'winamp-digit',
        LAYOUT.MINUTES_ONES.x, LAYOUT.MINUTES_ONES.y, 9, 13);
      this.#elements.secTens = this.#makeEl(c, 'winamp-digit',
        LAYOUT.SECONDS_TENS.x, LAYOUT.SECONDS_TENS.y, 9, 13);
      this.#elements.secOnes = this.#makeEl(c, 'winamp-digit',
        LAYOUT.SECONDS_ONES.x, LAYOUT.SECONDS_ONES.y, 9, 13);

      // Mono/Stereo indicator
      this.#elements.mono = this.#makeEl(c, 'winamp-mono',
        LAYOUT.MONOSTER.x + 29, LAYOUT.MONOSTER.y, 27, 12);
      this.#elements.stereo = this.#makeEl(c, 'winamp-stereo',
        LAYOUT.MONOSTER.x, LAYOUT.MONOSTER.y, 29, 12);

      // Text display (scrolling title) -- use a canvas
      const textDisp = this.#makeEl(c, 'winamp-text-display',
        LAYOUT.TEXT_DISPLAY.x, LAYOUT.TEXT_DISPLAY.y, LAYOUT.TEXT_DISPLAY.w, LAYOUT.TEXT_DISPLAY.h);
      textDisp.style.overflow = 'hidden';
      this.#elements.textDisplay = textDisp;

      // Volume slider
      const volBg = this.#makeEl(c, 'winamp-vol-bg',
        LAYOUT.VOLUME.BG.x, LAYOUT.VOLUME.BG.y, LAYOUT.VOLUME.BG.w, LAYOUT.VOLUME.BG.h);
      this.#elements.volBg = volBg;
      const volThumb = this.#makeEl(c, 'winamp-vol-thumb',
        LAYOUT.VOLUME.BG.x, LAYOUT.VOLUME.BG.y + 1, 14, 11);
      volThumb.style.cursor = 'pointer';
      this.#elements.volThumb = volThumb;
      this.#setupVolumeDrag(volThumb);

      // Position (seek) bar
      const posBg = this.#makeEl(c, 'winamp-pos-bg',
        LAYOUT.POSBAR.BG.x, LAYOUT.POSBAR.BG.y, LAYOUT.POSBAR.BG.w, LAYOUT.POSBAR.BG.h);
      this.#elements.posBg = posBg;
      const posThumb = this.#makeEl(c, 'winamp-pos-thumb',
        LAYOUT.POSBAR.BG.x, LAYOUT.POSBAR.BG.y, 29, 10);
      posThumb.style.cursor = 'pointer';
      this.#elements.posThumb = posThumb;
      this.#setupPosDrag(posThumb);

      // Transport buttons (prev, play, pause, stop, next, eject)
      this.#elements.btnPrev = this.#makeButton(c, 'winamp-btn-prev',
        LAYOUT.CBUTTONS.PREV.x, LAYOUT.CBUTTONS.PREV.y, 23, 18,
        () => { if (this.onPrev) this.onPrev(); });
      this.#elements.btnPlay = this.#makeButton(c, 'winamp-btn-play',
        LAYOUT.CBUTTONS.PLAY.x, LAYOUT.CBUTTONS.PLAY.y, 23, 18,
        () => { if (this.onPlay) this.onPlay(); });
      this.#elements.btnPause = this.#makeButton(c, 'winamp-btn-pause',
        LAYOUT.CBUTTONS.PAUSE.x, LAYOUT.CBUTTONS.PAUSE.y, 23, 18,
        () => { if (this.onPause) this.onPause(); });
      this.#elements.btnStop = this.#makeButton(c, 'winamp-btn-stop',
        LAYOUT.CBUTTONS.STOP.x, LAYOUT.CBUTTONS.STOP.y, 23, 18,
        () => { if (this.onStop) this.onStop(); });
      this.#elements.btnNext = this.#makeButton(c, 'winamp-btn-next',
        LAYOUT.CBUTTONS.NEXT.x, LAYOUT.CBUTTONS.NEXT.y, 23, 18,
        () => { if (this.onNext) this.onNext(); });
      this.#elements.btnEject = this.#makeButton(c, 'winamp-btn-eject',
        LAYOUT.CBUTTONS.EJECT.x, LAYOUT.CBUTTONS.EJECT.y, 22, 16,
        () => { if (this.onEject) this.onEject(); });

      // Shuffle button
      this.#elements.btnShuffle = this.#makeButton(c, 'winamp-btn-shuffle',
        LAYOUT.SHUFFLE.x, LAYOUT.SHUFFLE.y, 47, 15,
        () => { if (this.onShuffle) this.onShuffle(); });

      // Repeat button
      this.#elements.btnRepeat = this.#makeButton(c, 'winamp-btn-repeat',
        LAYOUT.REPEAT.x, LAYOUT.REPEAT.y, 28, 15,
        () => { if (this.onRepeat) this.onRepeat(); });

      this.#container = c;
      parentEl.appendChild(c);

      return c;
    }

    destroy() {
      if (this.#scrollTimer) {
        clearInterval(this.#scrollTimer);
        this.#scrollTimer = null;
      }
      if (this.#container && this.#container.parentNode)
        this.#container.parentNode.removeChild(this.#container);
      this.#container = null;
      this.#elements = {};
    }

    /**
     * Apply a loaded WinampSkin to the renderer.
     */
    applySkin(skin) {
      this.#skin = skin;
      if (!skin || !skin.loaded || !this.#container)
        return;

      // Load images for sprite extraction
      this.#loadSpriteImage('text.bmp', (img) => { this.#textImage = img; this.#renderTitle(); });
      this.#loadSpriteImage('nums_ex.bmp', (img) => { this.#numbersImage = img; this.#renderTime(0, 0); });
      if (!this.#numbersImage)
        this.#loadSpriteImage('numbers.bmp', (img) => { this.#numbersImage = img; this.#renderTime(0, 0); });

      // Apply background
      this.#setSpriteBg(this.#elements.bg, 'main.bmp', SPRITES.MAIN.BACKGROUND);

      // Title bar (selected = focused)
      this.#setSpriteBg(this.#elements.titlebar, 'titlebar.bmp', SPRITES.TITLEBAR.BAR_SELECTED);

      // Close button
      this.#setSpriteStates(this.#elements.btnClose, 'titlebar.bmp',
        SPRITES.TITLEBAR.CLOSE, SPRITES.TITLEBAR.CLOSE_PRESS);

      // Status
      this.#setSpriteBg(this.#elements.status, 'playpaus.bmp', SPRITES.PLAYPAUS.STOPPED);

      // Mono/Stereo
      this.#setSpriteBg(this.#elements.stereo, 'monoster.bmp', SPRITES.MONOSTER.STEREO);
      this.#setSpriteBg(this.#elements.mono, 'monoster.bmp', SPRITES.MONOSTER.MONO);

      // Transport buttons
      this.#setSpriteStates(this.#elements.btnPrev, 'cbuttons.bmp',
        SPRITES.CBUTTONS.PREV, SPRITES.CBUTTONS.PREV_ACTIVE);
      this.#setSpriteStates(this.#elements.btnPlay, 'cbuttons.bmp',
        SPRITES.CBUTTONS.PLAY, SPRITES.CBUTTONS.PLAY_ACTIVE);
      this.#setSpriteStates(this.#elements.btnPause, 'cbuttons.bmp',
        SPRITES.CBUTTONS.PAUSE, SPRITES.CBUTTONS.PAUSE_ACTIVE);
      this.#setSpriteStates(this.#elements.btnStop, 'cbuttons.bmp',
        SPRITES.CBUTTONS.STOP, SPRITES.CBUTTONS.STOP_ACTIVE);
      this.#setSpriteStates(this.#elements.btnNext, 'cbuttons.bmp',
        SPRITES.CBUTTONS.NEXT, SPRITES.CBUTTONS.NEXT_ACTIVE);
      this.#setSpriteStates(this.#elements.btnEject, 'cbuttons.bmp',
        SPRITES.CBUTTONS.EJECT, SPRITES.CBUTTONS.EJECT_ACTIVE);

      // Shuffle / Repeat (default: off)
      this.#setSpriteStates(this.#elements.btnShuffle, 'shufrep.bmp',
        SPRITES.SHUFREP.SHUFFLE, SPRITES.SHUFREP.SHUFFLE_PRESS);
      this.#setSpriteStates(this.#elements.btnRepeat, 'shufrep.bmp',
        SPRITES.SHUFREP.REPEAT, SPRITES.SHUFREP.REPEAT_PRESS);

      // Position bar
      this.#setSpriteBg(this.#elements.posBg, 'posbar.bmp', SPRITES.POSBAR.BG);
      this.#setSpriteBg(this.#elements.posThumb, 'posbar.bmp', SPRITES.POSBAR.THUMB);

      // Volume (frame 0 = lowest)
      this.#setVolumeFrame(0.8);
      this.#setSpriteBg(this.#elements.volThumb, 'volume.bmp', SPRITES.VOLUME.THUMB);

      // Init digits to 0:00
      this.#renderTime(0, 0);
    }

    /**
     * Update the time display digits.
     */
    updateTime(currentSeconds, totalSeconds) {
      if (!this.#skin || !this.#skin.loaded)
        return;
      const current = Math.floor(currentSeconds);
      const m = Math.floor(current / 60);
      const s = current % 60;
      this.#renderTime(m, s);
    }

    /**
     * Update playback status indicator.
     */
    updateStatus(state) {
      if (!this.#skin || !this.#skin.loaded)
        return;
      let sprite;
      switch (state) {
        case 'playing': sprite = SPRITES.PLAYPAUS.PLAYING; break;
        case 'paused':  sprite = SPRITES.PLAYPAUS.PAUSED; break;
        default:        sprite = SPRITES.PLAYPAUS.STOPPED; break;
      }
      this.#setSpriteBg(this.#elements.status, 'playpaus.bmp', sprite);
    }

    /**
     * Update the seek position thumb.
     */
    updatePosition(fraction) {
      if (!this.#elements.posThumb || this.#posThumbDragging)
        return;
      const trackW = LAYOUT.POSBAR.THUMB.trackW;
      const x = LAYOUT.POSBAR.BG.x + Math.round(fraction * trackW);
      this.#elements.posThumb.style.left = x + 'px';
    }

    /**
     * Update volume slider.
     */
    updateVolume(fraction) {
      if (!this.#elements.volThumb || this.#volThumbDragging)
        return;
      this.#setVolumeFrame(fraction);
      const trackW = LAYOUT.VOLUME.THUMB.trackW;
      const x = LAYOUT.VOLUME.BG.x + Math.round(fraction * trackW);
      this.#elements.volThumb.style.left = x + 'px';
    }

    /**
     * Update shuffle toggle visual.
     */
    updateShuffle(enabled) {
      if (!this.#skin || !this.#skin.loaded)
        return;
      if (enabled)
        this.#setSpriteStates(this.#elements.btnShuffle, 'shufrep.bmp',
          SPRITES.SHUFREP.SHUFFLE_ON, SPRITES.SHUFREP.SHUFFLE_ON_PRESS);
      else
        this.#setSpriteStates(this.#elements.btnShuffle, 'shufrep.bmp',
          SPRITES.SHUFREP.SHUFFLE, SPRITES.SHUFREP.SHUFFLE_PRESS);
    }

    /**
     * Update repeat toggle visual.
     */
    updateRepeat(mode) {
      if (!this.#skin || !this.#skin.loaded)
        return;
      const on = mode !== 'off';
      if (on)
        this.#setSpriteStates(this.#elements.btnRepeat, 'shufrep.bmp',
          SPRITES.SHUFREP.REPEAT_ON, SPRITES.SHUFREP.REPEAT_ON_PRESS);
      else
        this.#setSpriteStates(this.#elements.btnRepeat, 'shufrep.bmp',
          SPRITES.SHUFREP.REPEAT, SPRITES.SHUFREP.REPEAT_PRESS);
    }

    /**
     * Set the scrolling title text.
     */
    setTitle(text) {
      this.#titleText = text || '';
      this.#scrollOffset = 0;
      this.#renderTitle();

      if (this.#scrollTimer)
        clearInterval(this.#scrollTimer);

      if (this.#titleText.length > 0) {
        const paddedText = this.#titleText + '   ***   ';
        const textWidth = paddedText.length * SPRITES.TEXT.CHAR_W;
        if (textWidth > LAYOUT.TEXT_DISPLAY.w) {
          this.#scrollTimer = setInterval(() => {
            ++this.#scrollOffset;
            if (this.#scrollOffset >= textWidth)
              this.#scrollOffset = 0;
            this.#renderTitle();
          }, 150);
        }
      }
    }

    // -- Private helpers --

    #makeEl(parent, cls, x, y, w, h) {
      const el = document.createElement('div');
      el.className = cls;
      el.style.position = 'absolute';
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      el.style.overflow = 'hidden';
      parent.appendChild(el);
      return el;
    }

    #makeButton(parent, cls, x, y, w, h, onClick) {
      const el = this.#makeEl(parent, cls, x, y, w, h);
      el.style.cursor = 'pointer';
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        el.classList.add('active');
        // Switch to pressed sprite
        if (el.dataset.activePos)
          el.style.backgroundPosition = el.dataset.activePos;
        el.setPointerCapture(e.pointerId);
      });
      el.addEventListener('pointerup', (e) => {
        el.classList.remove('active');
        // Restore normal sprite
        if (el.dataset.normalPos)
          el.style.backgroundPosition = el.dataset.normalPos;
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom)
          onClick();
      });
      el.addEventListener('lostpointercapture', () => {
        el.classList.remove('active');
        if (el.dataset.normalPos)
          el.style.backgroundPosition = el.dataset.normalPos;
      });
      return el;
    }

    #setSpriteBg(el, file, sprite) {
      if (!el || !this.#skin)
        return;
      const img = this.#skin.getImage(file);
      if (!img)
        return;
      el.style.backgroundImage = 'url("' + img + '")';
      el.style.backgroundPosition = (-sprite.x) + 'px ' + (-sprite.y) + 'px';
      el.style.backgroundSize = 'auto';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.imageRendering = 'pixelated';
    }

    #setSpriteStates(el, file, normalSprite, activeSprite) {
      if (!el || !this.#skin)
        return;
      const img = this.#skin.getImage(file);
      if (!img)
        return;

      const url = 'url("' + img + '")';
      el.style.backgroundImage = url;
      el.style.backgroundPosition = (-normalSprite.x) + 'px ' + (-normalSprite.y) + 'px';
      el.style.backgroundSize = 'auto';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.imageRendering = 'pixelated';

      // Store active state data for CSS class toggle
      el.dataset.normalPos = (-normalSprite.x) + 'px ' + (-normalSprite.y) + 'px';
      el.dataset.activePos = (-activeSprite.x) + 'px ' + (-activeSprite.y) + 'px';
    }

    #setVolumeFrame(fraction) {
      if (!this.#elements.volBg || !this.#skin)
        return;
      const frameIndex = Math.min(27, Math.max(0, Math.round(fraction * 27)));
      const img = this.#skin.getImage('volume.bmp');
      if (!img)
        return;
      this.#elements.volBg.style.backgroundImage = 'url("' + img + '")';
      this.#elements.volBg.style.backgroundPosition = '0px ' + (-(frameIndex * 15)) + 'px';
      this.#elements.volBg.style.backgroundSize = 'auto';
      this.#elements.volBg.style.backgroundRepeat = 'no-repeat';
      this.#elements.volBg.style.imageRendering = 'pixelated';
    }

    #renderTime(minutes, seconds) {
      if (!this.#numbersImage)
        return;
      const mTens = Math.floor(minutes / 10) % 10;
      const mOnes = minutes % 10;
      const sTens = Math.floor(seconds / 10) % 10;
      const sOnes = seconds % 10;

      this.#renderDigit(this.#elements.minTens, mTens);
      this.#renderDigit(this.#elements.minOnes, mOnes);
      this.#renderDigit(this.#elements.secTens, sTens);
      this.#renderDigit(this.#elements.secOnes, sOnes);
    }

    #renderDigit(el, digit) {
      if (!el || !this.#numbersImage)
        return;
      const x = digit * SPRITES.NUMBERS.DIGIT_W;
      el.style.backgroundImage = 'url("' + this.#numbersImage.src + '")';
      el.style.backgroundPosition = (-x) + 'px 0px';
      el.style.backgroundSize = 'auto';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.imageRendering = 'pixelated';
    }

    #renderTitle() {
      if (!this.#textImage || !this.#elements.textDisplay)
        return;

      const canvas = this.#titleCanvas;
      const ctx = this.#titleCtx;
      const charW = SPRITES.TEXT.CHAR_W;
      const charH = SPRITES.TEXT.CHAR_H;
      const displayW = LAYOUT.TEXT_DISPLAY.w;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const text = this.#titleText.length > 0
        ? (this.#titleText + '   ***   ').toLowerCase()
        : '';

      if (text.length === 0)
        return;

      const textW = text.length * charW;
      const startChar = Math.floor(this.#scrollOffset / charW);
      const pixelOff = this.#scrollOffset % charW;

      for (let i = 0; i < Math.ceil(displayW / charW) + 2; ++i) {
        const charIdx = (startChar + i) % text.length;
        const ch = text[charIdx];
        const lookup = TEXT_LOOKUP[ch] || TEXT_LOOKUP[' '];
        const sx = lookup[1] * charW;
        const sy = lookup[0] * charH;
        const dx = i * charW - pixelOff;

        ctx.drawImage(this.#textImage, sx, sy, charW, charH, dx, 0, charW, charH);
      }

      this.#elements.textDisplay.style.backgroundImage = 'url("' + canvas.toDataURL() + '")';
      this.#elements.textDisplay.style.backgroundSize = displayW + 'px ' + charH + 'px';
      this.#elements.textDisplay.style.backgroundRepeat = 'no-repeat';
    }

    #loadSpriteImage(file, callback) {
      if (!this.#skin)
        return;
      const dataUrl = this.#skin.getImage(file);
      if (!dataUrl)
        return;
      const img = new Image();
      img.onload = () => callback(img);
      img.src = dataUrl;
    }

    #setupPosDrag(thumb) {
      let startX = 0;
      let startLeft = 0;

      thumb.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.#posThumbDragging = true;
        thumb.setPointerCapture(e.pointerId);
        startX = e.clientX;
        startLeft = parseInt(thumb.style.left) || LAYOUT.POSBAR.BG.x;
        this.#setSpriteBg(thumb, 'posbar.bmp', SPRITES.POSBAR.THUMB_ACTIVE);
      });

      thumb.addEventListener('pointermove', (e) => {
        if (!this.#posThumbDragging)
          return;
        const dx = e.clientX - startX;
        let newLeft = startLeft + dx;
        const minX = LAYOUT.POSBAR.BG.x;
        const maxX = LAYOUT.POSBAR.BG.x + LAYOUT.POSBAR.THUMB.trackW;
        if (newLeft < minX) newLeft = minX;
        if (newLeft > maxX) newLeft = maxX;
        thumb.style.left = newLeft + 'px';
      });

      const endDrag = () => {
        if (!this.#posThumbDragging)
          return;
        this.#posThumbDragging = false;
        this.#setSpriteBg(thumb, 'posbar.bmp', SPRITES.POSBAR.THUMB);
        const currentLeft = parseInt(thumb.style.left) || LAYOUT.POSBAR.BG.x;
        const fraction = (currentLeft - LAYOUT.POSBAR.BG.x) / LAYOUT.POSBAR.THUMB.trackW;
        if (this.onSeek)
          this.onSeek(Math.max(0, Math.min(1, fraction)));
      };

      thumb.addEventListener('pointerup', endDrag);
      thumb.addEventListener('lostpointercapture', endDrag);
    }

    #setupVolumeDrag(thumb) {
      let startX = 0;
      let startLeft = 0;

      thumb.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.#volThumbDragging = true;
        thumb.setPointerCapture(e.pointerId);
        startX = e.clientX;
        startLeft = parseInt(thumb.style.left) || LAYOUT.VOLUME.BG.x;
        this.#setSpriteBg(thumb, 'volume.bmp', SPRITES.VOLUME.THUMB_ACTIVE);
      });

      thumb.addEventListener('pointermove', (e) => {
        if (!this.#volThumbDragging)
          return;
        const dx = e.clientX - startX;
        let newLeft = startLeft + dx;
        const minX = LAYOUT.VOLUME.BG.x;
        const maxX = LAYOUT.VOLUME.BG.x + LAYOUT.VOLUME.THUMB.trackW;
        if (newLeft < minX) newLeft = minX;
        if (newLeft > maxX) newLeft = maxX;
        thumb.style.left = newLeft + 'px';
        const fraction = (newLeft - minX) / LAYOUT.VOLUME.THUMB.trackW;
        this.#setVolumeFrame(fraction);
        if (this.onVolume)
          this.onVolume(Math.max(0, Math.min(1, fraction)));
      });

      const endDrag = () => {
        if (!this.#volThumbDragging)
          return;
        this.#volThumbDragging = false;
        this.#setSpriteBg(thumb, 'volume.bmp', SPRITES.VOLUME.THUMB);
      };

      thumb.addEventListener('pointerup', endDrag);
      thumb.addEventListener('lostpointercapture', endDrag);
    }
  }

  // -----------------------------------------------------------------------
  // Expose on SZ namespace
  // -----------------------------------------------------------------------
  SZ.WinampSkin = WinampSkin;
  SZ.WinampRenderer = WinampRenderer;
  SZ.WINAMP_SPRITES = SPRITES;
  SZ.WINAMP_LAYOUT = LAYOUT;
  SZ.WINAMP_SKIN_STORAGE_KEY = STORAGE_KEY;

})();
