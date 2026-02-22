;(function() {
  'use strict';

  // =========================================================================
  //  Model
  // =========================================================================

  let _currentSkin = null;
  let _processedBorders = null;
  let _isActive = true;
  let _animEnabled = true;
  let _droppedSkins = {};
  let _unrarLoaded = false;
  let _unrarLoadFailed = false;

  // =========================================================================
  //  DOM refs
  // =========================================================================

  const openBtn = document.getElementById('open-btn');
  const fileInput = document.getElementById('file-input');
  const skinSelect = document.getElementById('skin-select');
  const subSkinSelect = document.getElementById('subskin-select');
  const activeToggle = document.getElementById('active-toggle');
  const animToggle = document.getElementById('anim-toggle');
  const mainArea = document.getElementById('main-area');
  const frameGrid = document.getElementById('frame-grid');
  const infoContent = document.getElementById('info-content');

  const cells = {
    nw: document.getElementById('cell-nw'),
    n:  document.getElementById('cell-n'),
    ne: document.getElementById('cell-ne'),
    w:  document.getElementById('cell-w'),
    e:  document.getElementById('cell-e'),
    sw: document.getElementById('cell-sw'),
    s:  document.getElementById('cell-s'),
    se: document.getElementById('cell-se'),
    content: document.getElementById('cell-content'),
  };

  // =========================================================================
  //  Image processing (self-contained, mirrors skin-css-generator.js)
  // =========================================================================

  function _loadImage(src) {
    if (!src)
      return Promise.resolve(null);
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function _applyMagentaTransparency(ctx, w, h) {
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4)
      if (px[i] === 255 && px[i + 1] === 0 && px[i + 2] === 255)
        px[i + 3] = 0;
    ctx.putImageData(data, 0, 0);
  }

  function _applyMask(ctx, maskImg, fw, fh, sx, sy) {
    const mc = document.createElement('canvas');
    mc.width = fw;
    mc.height = fh;
    const mctx = mc.getContext('2d');
    mctx.drawImage(maskImg, sx, sy, fw, fh, 0, 0, fw, fh);
    const maskData = mctx.getImageData(0, 0, fw, fh);
    const mp = maskData.data;
    for (let i = 0; i < mp.length; i += 4) {
      const grey = Math.round(mp[i] * 0.299 + mp[i + 1] * 0.587 + mp[i + 2] * 0.114);
      mp[i] = mp[i + 1] = mp[i + 2] = 255;
      mp[i + 3] = grey;
    }
    mctx.putImageData(maskData, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mc, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  function _extractFrameCanvas(img, frameIndex, frameCount, isVerticalStack, useTrans, maskImg) {
    const canvas = document.createElement('canvas');
    let fw, fh, sx, sy;
    if (isVerticalStack) {
      fw = img.width;
      fh = Math.floor(img.height / frameCount);
      sx = 0;
      sy = frameIndex * fh;
    } else {
      fw = Math.floor(img.width / frameCount);
      fh = img.height;
      sx = frameIndex * fw;
      sy = 0;
    }
    canvas.width = fw;
    canvas.height = fh;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, sx, sy, fw, fh, 0, 0, fw, fh);
    if (useTrans)
      _applyMagentaTransparency(ctx, fw, fh);
    if (maskImg)
      _applyMask(ctx, maskImg, fw, fh, sx, sy);
    return canvas;
  }

  function _extractZoneURL(frameCanvas, start, size, isHorizontalCut) {
    if (size <= 0)
      return null;
    const c = document.createElement('canvas');
    if (isHorizontalCut) {
      c.width = size;
      c.height = frameCanvas.height;
      c.getContext('2d').drawImage(frameCanvas, start, 0, size, frameCanvas.height, 0, 0, size, frameCanvas.height);
    } else {
      c.width = frameCanvas.width;
      c.height = size;
      c.getContext('2d').drawImage(frameCanvas, 0, start, frameCanvas.width, size, 0, 0, frameCanvas.width, size);
    }
    return c.toDataURL();
  }

  async function _processBorder(border, useTrans) {
    const { name, path, mask, frameCount, zoneA, zoneC, stretch, horizontal } = border;
    const [img, maskImg] = await Promise.all([_loadImage(path), _loadImage(mask)]);

    const result = {
      name, horizontal, stretch, frameCount,
      imgWidth: img?.width || 0, imgHeight: img?.height || 0,
      frameWidth: 0, frameHeight: 0,
      zoneA: 0, zoneB: 0, zoneC: 0,
      frames: [], canvasOk: false, error: null
    };

    if (!img) {
      result.error = 'Image failed to load: ' + path;
      return result;
    }

    const isVerticalStack = horizontal;
    let fw, fh;
    if (isVerticalStack) {
      fw = img.width;
      fh = Math.floor(img.height / frameCount);
    } else {
      fw = Math.floor(img.width / frameCount);
      fh = img.height;
    }

    result.frameWidth = fw;
    result.frameHeight = fh;

    const dim = horizontal ? fw : fh;
    const aSize = Math.min(zoneA, dim);
    const cSize = Math.min(zoneC, Math.max(0, dim - aSize));
    const bSize = Math.max(0, dim - aSize - cSize);
    result.zoneA = aSize;
    result.zoneB = bSize;
    result.zoneC = cSize;

    try {
      for (let i = 0; i < frameCount; ++i) {
        const fc = _extractFrameCanvas(img, i, frameCount, isVerticalStack, useTrans, maskImg);
        result.frames.push({
          full: fc.toDataURL(),
          a: _extractZoneURL(fc, 0, aSize, horizontal),
          b: _extractZoneURL(fc, aSize, bSize, horizontal),
          c: _extractZoneURL(fc, aSize + bSize, cSize, horizontal),
        });
      }
      result.canvasOk = true;
    } catch (e) {
      result.error = 'Canvas tainted: ' + e.message;
      result.canvasOk = false;
      for (let i = 0; i < frameCount; ++i)
        result.frames.push({ full: path, a: null, b: null, c: null });
    }

    return result;
  }

  // =========================================================================
  //  UIS Parser (inline, same logic as skin-loader.js)
  // =========================================================================

  const _PERSONALITY_INT_KEYS = new Set([
    'usestran', 'buttoncount', 'mouseover', 'tripleimages',
    'textalignment', 'textshift', 'textshiftvert', 'textrightclip',
    'toptopheight', 'topbotheight', 'lefttopheight', 'leftbotheight',
    'righttopheight', 'rightbotheight', 'bottomtopheight', 'bottombotheight',
    'topstretch', 'leftstretch', 'rightstretch', 'bottomstretch',
    'topframe', 'leftframe', 'rightframe', 'bottomframe',
    'menulefttile', 'tileleftmenu', 'tilerightmenu', 'tilemenu',
    'anirate', 'rollupsize', 'dynamicframe', 'fadelinkedbuttons', 'faderate',
    'topheight',
  ]);

  const _PERSONALITY_PATH_KEYS = new Set([
    'top', 'topmask', 'left', 'leftmask', 'right', 'rightmask',
    'bottom', 'bottommask', 'menubar', 'menuborders',
    'explorerbmp', 'dialogbmp', 'mdibmp', 'mdibmpmask',
  ]);

  const _COLOUR_MAP = {
    scrollbar: 'scrollbar', background: 'background',
    activetitle: 'activeTitle', inactivetitle: 'inactiveTitle',
    menu: 'menu', window: 'window', windowframe: 'windowFrame',
    menutext: 'menuText', windowtext: 'windowText', titletext: 'titleText',
    activeborder: 'activeBorder', inactiveborder: 'inactiveBorder',
    appworkspace: 'appWorkspace', hilight: 'highlight', hilighttext: 'highlightText',
    buttonface: 'buttonFace', buttonshadow: 'buttonShadow',
    graytext: 'grayText', buttontext: 'buttonText',
    inactivetitletext: 'inactiveTitleText', buttonhilight: 'buttonHighlight',
    buttondkshadow: 'buttonDarkShadow', buttonlight: 'buttonLight',
    infotext: 'infoText', infowindow: 'infoWindow',
    buttonalternateface: 'buttonAlternateFace', hottrackingcolor: 'hotTrackingColor',
    gradientactivetitle: 'gradientActiveTitle', gradientinactivetitle: 'gradientInactiveTitle',
  };

  function _parseUIS(text) {
    const skin = {
      name: '', author: '', email: '', url: '', wbVersion: 0,
      personality: {}, buttons: {}, titleButtons: [], comboButton: {},
      startButton: {}, colors: {}, fonts: {},
    };

    let currentSection = null;
    let currentButtonIndex = -1;

    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith(';') || line.startsWith('#'))
        continue;

      const sectionMatch = line.match(/^\[(.+)]$/);
      if (sectionMatch) {
        const sec = sectionMatch[1].toLowerCase();
        currentSection = sec;
        const btnMatch = sec.match(/^button(\d+)$/);
        if (btnMatch) {
          currentButtonIndex = parseInt(btnMatch[1], 10);
          if (!skin.titleButtons[currentButtonIndex])
            skin.titleButtons[currentButtonIndex] = {};
        } else {
          currentButtonIndex = -1;
        }
        continue;
      }

      const eqIdx = line.indexOf('=');
      if (eqIdx < 0)
        continue;

      const key = line.slice(0, eqIdx).trim().toLowerCase();
      const val = line.slice(eqIdx + 1).trim();

      if (currentSection === 'titlebarskin') {
        switch (key) {
          case 'skinname': skin.name = val; break;
          case 'skinauthor': skin.author = val; break;
          case 'authoremail': skin.email = val; break;
          case 'authorsurl': skin.url = val; break;
          case 'wbver': skin.wbVersion = parseInt(val, 10); break;
        }
      } else if (currentSection === 'personality') {
        if (_PERSONALITY_INT_KEYS.has(key))
          skin.personality[key] = parseInt(val, 10);
        else if (_PERSONALITY_PATH_KEYS.has(key))
          skin.personality[key] = val.replace(/\\/g, '/').replace(/^\/+/, '');
        else
          skin.personality[key] = val;
      } else if (currentSection === 'buttons') {
        const intKeys = new Set(['topheight', 'bottomheight', 'leftwidth', 'rightwidth', 'mouseover']);
        const pathKeys = new Set(['checkbutton', 'checkbuttonmask', 'radiobutton', 'bitmap', 'bitmapmask']);
        if (intKeys.has(key))
          skin.buttons[key] = parseInt(val, 10);
        else if (pathKeys.has(key))
          skin.buttons[key] = val.replace(/\\/g, '/').replace(/^\/+/, '');
        else
          skin.buttons[key] = val;
      } else if (currentButtonIndex >= 0) {
        const btn = skin.titleButtons[currentButtonIndex] || (skin.titleButtons[currentButtonIndex] = {});
        const intKeys = new Set(['align', 'xcoord', 'ycoord', 'action', 'linkedto']);
        if (key === 'buttonimage')
          btn.image = val ? val.replace(/\\/g, '/').replace(/^\/+/, '') : '';
        else if (key === 'buttonimagemask')
          btn.mask = val ? val.replace(/\\/g, '/').replace(/^\/+/, '') : '';
        else if (intKeys.has(key))
          btn[key] = parseInt(val, 10);
        else if (key.startsWith('visibility'))
          btn[key] = parseInt(val, 10);
      } else if (currentSection === 'combobutton') {
        const intKeys = new Set(['leftwidth', 'rightwidth', 'topheight', 'bottomheight', 'mouseover']);
        if (key === 'image')
          skin.comboButton.image = val.replace(/\\/g, '/').replace(/^\/+/, '');
        else if (intKeys.has(key))
          skin.comboButton[key] = parseInt(val, 10);
      } else if (currentSection === 'startbutton') {
        if (key === 'image')
          skin.startButton.image = val.replace(/\\/g, '/').replace(/^\/+/, '');
      } else if (currentSection === 'colours') {
        const parts = val.split(/\s+/).map(Number);
        const mapped = _COLOUR_MAP[key];
        if (mapped)
          skin.colors[mapped] = parts;
      } else if (currentSection && currentSection.startsWith('font')) {
        switch (key) {
          case 'fontname': skin.fonts.family = val; break;
          case 'fontheight': skin.fonts.height = parseInt(val, 10); break;
          case 'fontweight': skin.fonts.weight = parseInt(val, 10); break;
          case 'antialias': skin.fonts.antialias = parseInt(val, 10) === 1; break;
        }
      }
    }

    return skin;
  }

  // =========================================================================
  //  Archive Parsers
  // =========================================================================

  /** Detect archive format from magic bytes. Returns 'zip', 'rar', or null. */
  function _detectFormat(buffer) {
    const view = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
    // ZIP: PK\x03\x04
    if (view[0] === 0x50 && view[1] === 0x4B && view[2] === 0x03 && view[3] === 0x04)
      return 'zip';
    // RAR: Rar!\x1a\x07
    if (view[0] === 0x52 && view[1] === 0x61 && view[2] === 0x72 && view[3] === 0x21)
      return 'rar';
    return null;
  }

  /**
   * Parse a ZIP archive. Returns Map<filename, Uint8Array>.
   * Uses DecompressionStream for deflated entries.
   */
  async function _parseZip(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const files = new Map();

    // Find End of Central Directory record
    let eocdOffset = -1;
    for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); --i) {
      if (view.getUint32(i, true) === 0x06054B50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset < 0)
      throw new Error('Invalid ZIP: EOCD not found');

    const cdEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);

    let pos = cdOffset;
    for (let i = 0; i < cdEntries; ++i) {
      if (pos + 46 > buffer.byteLength || view.getUint32(pos, true) !== 0x02014B50)
        break;

      const method = view.getUint16(pos + 10, true);
      const compSize = view.getUint32(pos + 20, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localHeaderOffset = view.getUint32(pos + 42, true);

      const nameBytes = bytes.slice(pos + 46, pos + 46 + nameLen);
      const name = new TextDecoder().decode(nameBytes);

      // Skip directories
      if (!name.endsWith('/')) {
        const lfhPos = localHeaderOffset;
        if (lfhPos + 30 <= buffer.byteLength) {
          const lfhNameLen = view.getUint16(lfhPos + 26, true);
          const lfhExtraLen = view.getUint16(lfhPos + 28, true);
          const dataStart = lfhPos + 30 + lfhNameLen + lfhExtraLen;
          const compData = bytes.slice(dataStart, dataStart + compSize);

          let data = null;
          if (method === 0) {
            // Stored
            data = compData;
          } else if (method === 8) {
            // Deflated — use DecompressionStream
            try {
              data = await _inflateRaw(compData);
            } catch (e) {
              console.warn(`ZIP inflate failed for ${name}:`, e.message);
            }
          }

          if (data)
            files.set(name, data);
        }
      }

      pos += 46 + nameLen + extraLen + commentLen;
    }

    return files;
  }

  /** Inflate raw deflate data using DecompressionStream API. */
  async function _inflateRaw(compData) {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    const reader = ds.readable.getReader();

    writer.write(compData).catch(() => {});
    writer.close().catch(() => {});

    const chunks = [];
    let totalLen = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done)
        break;
      chunks.push(value);
      totalLen += value.length;
    }

    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // RAR extraction via dynamically-loaded library
  // -------------------------------------------------------------------------

  const _UNRAR_CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/js-unrar@latest/dist/js-unrar.min.js',
    'https://cdn.jsdelivr.net/npm/unrar.js@latest/dist/unrar.min.js',
  ];

  async function _loadUnrarLibrary() {
    if (_unrarLoaded || _unrarLoadFailed)
      return _unrarLoaded;

    for (const url of _UNRAR_CDN_URLS) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = url;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        _unrarLoaded = true;
        return true;
      } catch (_) {
        continue;
      }
    }

    _unrarLoadFailed = true;
    return false;
  }

  /**
   * Extract RAR archive. Returns Map<filename, Uint8Array> or null.
   * Tries to use dynamically-loaded library; falls back to manual parsing for
   * stored (uncompressed) entries.
   */
  async function _parseRar(buffer) {
    // Try dynamic library first
    if (typeof window.unrar === 'function') {
      const entries = window.unrar(new Uint8Array(buffer));
      const files = new Map();
      for (const entry of entries)
        if (entry.filename && entry.fileData)
          files.set(entry.filename, new Uint8Array(entry.fileData));
      return files;
    }

    // Try loading from CDN
    const loaded = await _loadUnrarLibrary();
    if (loaded && typeof window.unrar === 'function') {
      const entries = window.unrar(new Uint8Array(buffer));
      const files = new Map();
      for (const entry of entries)
        if (entry.filename && entry.fileData)
          files.set(entry.filename, new Uint8Array(entry.fileData));
      return files;
    }

    // Try manual stored-entry extraction (RAR 2.x uncompressed)
    return _parseRarStored(buffer);
  }

  /**
   * Minimal RAR parser — extracts only stored (method 0x30) entries.
   * RAR 2.x/3.x header format.
   */
  function _parseRarStored(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const files = new Map();

    // Verify RAR signature: "Rar!\x1a\x07\x00" (RAR 4.x) or "Rar!\x1a\x07\x01\x00" (RAR 5.x)
    if (buffer.byteLength < 7)
      return null;
    const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (sig !== 'Rar!')
      return null;

    // RAR 4.x: signature is 7 bytes
    let pos = 7;

    while (pos + 7 < buffer.byteLength) {
      // Block header: HEAD_CRC(2) HEAD_TYPE(1) HEAD_FLAGS(2) HEAD_SIZE(2)
      const headType = bytes[pos + 2];
      const headFlags = view.getUint16(pos + 3, true);
      const headSize = view.getUint16(pos + 5, true);

      if (headSize < 7 || pos + headSize > buffer.byteLength)
        break;

      if (headType === 0x74) {
        // File header
        const packSize = view.getUint32(pos + 7, true);
        const unpackSize = view.getUint32(pos + 11, true);
        const method = bytes[pos + 18]; // 0x30 = store
        const nameLen = view.getUint16(pos + 19, true);
        const nameStart = pos + 32; // Fixed part of file header is 32 bytes (within HEAD_SIZE)

        if (nameStart + nameLen <= pos + headSize) {
          const nameBytes = bytes.slice(nameStart, nameStart + nameLen);
          const name = new TextDecoder().decode(nameBytes).replace(/\\/g, '/');
          const dataStart = pos + headSize;

          if (method === 0x30 && dataStart + packSize <= buffer.byteLength) {
            // Stored — data is uncompressed
            files.set(name, bytes.slice(dataStart, dataStart + packSize));
          }
          // Skip to next block (header + packed data)
          pos = dataStart + packSize;
          continue;
        }
      }

      // Skip block
      if (headFlags & 0x8000) {
        // Block has ADD_SIZE
        const addSize = pos + 7 < buffer.byteLength ? view.getUint32(pos + 7, true) : 0;
        pos += headSize + addSize;
      } else {
        pos += headSize;
      }
    }

    return files.size > 0 ? files : null;
  }

  // =========================================================================
  //  Archive / File Processing Pipeline
  // =========================================================================

  /**
   * Process an archive buffer (WBA/ZIP/RAR) or a single file.
   * Extracts files, finds UIS, parses it, resolves BMP paths to blob URLs.
   */
  async function _processArchive(buffer, fileName) {
    const format = _detectFormat(buffer);
    let fileMap; // Map<path, Uint8Array>

    if (format === 'zip') {
      _info('Extracting ZIP archive...');
      fileMap = await _parseZip(buffer);
    } else if (format === 'rar') {
      _info('Extracting RAR archive...');
      fileMap = await _parseRar(buffer);
      if (!fileMap) {
        _info('<span class="info-warn">RAR decompression failed.</span>\n' +
          'RAR support requires an online connection to load the decompression library,\n' +
          'or the archive must contain stored (uncompressed) entries.\n\n' +
          '<b>Workaround:</b> Extract the .wba file manually (it\'s a RAR archive)\n' +
          'and drop the extracted folder here instead.');
        return;
      }
    } else {
      _info(`<span class="info-warn">Unknown archive format.</span>\nFile: ${fileName}\nMagic: ${_hexDump(buffer, 0, 8)}`);
      return;
    }

    if (!fileMap || fileMap.size === 0) {
      _info('<span class="info-warn">Archive is empty or could not be read.</span>');
      return;
    }

    // Log extracted files
    const fileList = [...fileMap.keys()].sort();
    _info(`Extracted ${fileList.length} files:\n${fileList.map(f => '  ' + f).join('\n')}\n\nProcessing...`);

    // Find UIS file
    let uisText = null;
    let uisName = null;
    for (const [path, data] of fileMap) {
      if (path.toLowerCase().endsWith('.uis')) {
        uisText = new TextDecoder('windows-1252').decode(data);
        uisName = path;
        break;
      }
    }

    if (!uisText) {
      _info(`<span class="info-warn">No .uis file found in archive.</span>\nFiles: ${fileList.join(', ')}`);
      return;
    }

    // Parse UIS
    const skin = _parseUIS(uisText);
    skin._uisSource = uisName;

    // Build BMP name → blob URL map
    const blobMap = {};
    for (const [path, data] of fileMap) {
      const lower = path.toLowerCase();
      if (lower.endsWith('.bmp') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.tga')) {
        const justName = path.split('/').pop().toLowerCase();
        const blob = new Blob([data], { type: _mimeForExt(justName) });
        blobMap[justName] = URL.createObjectURL(blob);
      }
    }

    // Resolve image paths in the parsed skin to blob URLs
    _resolvePathsToBlobs(skin.personality, blobMap);
    _resolvePathsToBlobs(skin.buttons, blobMap);
    _resolvePathsToBlobs(skin.comboButton, blobMap);
    _resolvePathsToBlobs(skin.startButton, blobMap);
    for (const btn of skin.titleButtons)
      if (btn)
        _resolvePathsToBlobs(btn, blobMap);

    // Store and select
    const skinId = fileName.replace(/\.[^.]+$/, '');
    _droppedSkins[skinId] = skin;
    _populateSkinList();
    skinSelect.value = 'dropped:' + skinId;
    await _loadSkin('dropped:' + skinId);
  }

  /** Resolve path values in an object to blob URLs by matching filename. */
  function _resolvePathsToBlobs(obj, blobMap) {
    if (!obj || typeof obj !== 'object')
      return;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower.endsWith('.bmp') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.tga')) {
          const justName = val.replace(/\\/g, '/').split('/').pop().toLowerCase();
          if (blobMap[justName])
            obj[key] = blobMap[justName];
        }
      }
    }
  }

  function _mimeForExt(name) {
    if (name.endsWith('.bmp')) return 'image/bmp';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    return 'application/octet-stream';
  }

  function _hexDump(buffer, start, len) {
    const bytes = new Uint8Array(buffer, start, Math.min(len, buffer.byteLength - start));
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join(' ');
  }

  /** Process a single UIS text file with associated BMPs from a file list. */
  async function _processUISWithFiles(uisText, fileList, sourceLabel) {
    const skin = _parseUIS(uisText);
    skin._uisSource = sourceLabel;

    // Build BMP blob map from associated files
    const blobMap = {};
    for (const file of fileList) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.bmp') || lower.endsWith('.png') || lower.endsWith('.jpg')) {
        const dataURL = await _fileToDataURL(file);
        blobMap[lower] = dataURL;
      }
    }

    _resolvePathsToDataURLs(skin.personality, blobMap);
    _resolvePathsToDataURLs(skin.buttons, blobMap);
    _resolvePathsToDataURLs(skin.comboButton, blobMap);
    _resolvePathsToDataURLs(skin.startButton, blobMap);
    for (const btn of skin.titleButtons)
      if (btn)
        _resolvePathsToDataURLs(btn, blobMap);

    const skinId = sourceLabel.replace(/\.[^.]+$/, '');
    _droppedSkins[skinId] = skin;
    _populateSkinList();
    skinSelect.value = 'dropped:' + skinId;
    await _loadSkin('dropped:' + skinId);
  }

  function _resolvePathsToDataURLs(obj, blobMap) {
    if (!obj || typeof obj !== 'object')
      return;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        const lower = val.replace(/\\/g, '/').split('/').pop().toLowerCase();
        if (blobMap[lower])
          obj[key] = blobMap[lower];
      }
    }
  }

  // =========================================================================
  //  Skin Loading
  // =========================================================================

  function _getParentSkins() {
    try {
      return window.parent.SZ?.skins || {};
    } catch (_) {
      return {};
    }
  }

  function _populateSkinList() {
    skinSelect.innerHTML = '<option value="">-- select --</option>';
    const skins = _getParentSkins();
    for (const [key, skin] of Object.entries(skins)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = skin.name || key;
      skinSelect.appendChild(opt);
    }
    for (const [key, skin] of Object.entries(_droppedSkins)) {
      const opt = document.createElement('option');
      opt.value = 'dropped:' + key;
      opt.textContent = (skin.name || key) + ' (loaded)';
      skinSelect.appendChild(opt);
    }
  }

  function _populateSubSkins(skin) {
    subSkinSelect.innerHTML = '<option value="">Default</option>';
    if (!skin?.subSkins)
      return;
    for (const sub of skin.subSkins) {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = sub.name || sub.id;
      subSkinSelect.appendChild(opt);
    }
  }

  function _getSkin(key) {
    if (key.startsWith('dropped:'))
      return _droppedSkins[key.slice(8)] || null;
    return _getParentSkins()[key] || null;
  }

  async function _loadSkin(skinKey) {
    const skin = _getSkin(skinKey);
    if (!skin) {
      _currentSkin = null;
      _processedBorders = null;
      _clearDisplay();
      return;
    }

    _currentSkin = skin;
    _populateSubSkins(skin);

    const p = skin.personality || {};
    const useTrans = !!p.usestran;

    const borders = [
      { name: 'top', path: p.top, mask: p.topmask, frameCount: p.topframe || 1, zoneA: p.toptopheight || 0, zoneC: p.topbotheight || 0, stretch: !!p.topstretch, horizontal: true },
      { name: 'left', path: p.left, mask: p.leftmask, frameCount: p.leftframe || 1, zoneA: p.lefttopheight || 0, zoneC: p.leftbotheight || 0, stretch: !!p.leftstretch, horizontal: false },
      { name: 'right', path: p.right, mask: p.rightmask, frameCount: p.rightframe || 1, zoneA: p.righttopheight || 0, zoneC: p.rightbotheight || 0, stretch: !!p.rightstretch, horizontal: false },
      { name: 'bottom', path: p.bottom, mask: p.bottommask, frameCount: p.bottomframe || 1, zoneA: p.bottomtopheight || 0, zoneC: p.bottombotheight || 0, stretch: !!p.bottomstretch, horizontal: true },
    ];

    _processedBorders = await Promise.all(borders.map(b => _processBorder(b, useTrans)));
    _updateDisplay();
    _updateInfo();
  }

  // =========================================================================
  //  Display update
  // =========================================================================

  function _clearDisplay() {
    for (const cell of Object.values(cells)) {
      cell.style.backgroundImage = '';
      cell.style.animation = '';
    }
    frameGrid.style.removeProperty('--grid-left');
    frameGrid.style.removeProperty('--grid-right');
    frameGrid.style.removeProperty('--grid-top');
    frameGrid.style.removeProperty('--grid-bottom');
    frameGrid.style.removeProperty('--grid-nw-ext');
    frameGrid.style.removeProperty('--grid-ne-ext');
    infoContent.textContent = 'Select a skin to inspect.';
    const old = document.getElementById('sz-tester-anim');
    if (old)
      old.remove();
  }

  const _CELL_MAP = {
    'top-a': 'nw', 'top-b': 'n', 'top-c': 'ne',
    'bottom-a': 'sw', 'bottom-b': 's', 'bottom-c': 'se',
    'left-a': 'nw', 'left-b': 'w', 'left-c': 'sw',
    'right-a': 'ne', 'right-b': 'e', 'right-c': 'se',
  };

  const _CORNER_POSITION = {
    nw: '0 0',
    ne: 'right 0',
    sw: '0 bottom',
    se: 'right bottom',
  };

  function _updateDisplay() {
    if (!_processedBorders)
      return;

    const top = _processedBorders.find(b => b.name === 'top');
    const left = _processedBorders.find(b => b.name === 'left');
    const right = _processedBorders.find(b => b.name === 'right');
    const bottom = _processedBorders.find(b => b.name === 'bottom');

    const topZA = top?.zoneA || 0;
    const topZC = top?.zoneC || 0;
    const botZA = bottom?.zoneA || 0;
    const botZC = bottom?.zoneC || 0;
    const leftFW = left?.frameWidth || 4;
    const rightFW = right?.frameWidth || 4;
    const nwExt = Math.max(0, Math.max(topZA, botZA) - leftFW);
    const neExt = Math.max(0, Math.max(topZC, botZC) - rightFW);

    frameGrid.style.setProperty('--grid-left', leftFW + 'px');
    frameGrid.style.setProperty('--grid-right', rightFW + 'px');
    frameGrid.style.setProperty('--grid-top', (top?.frameHeight || 30) + 'px');
    frameGrid.style.setProperty('--grid-bottom', (bottom?.frameHeight || 4) + 'px');
    frameGrid.style.setProperty('--grid-nw-ext', nwExt + 'px');
    frameGrid.style.setProperty('--grid-ne-ext', neExt + 'px');

    const frameIdx = _isActive ? 0 : (_processedBorders[0]?.frameCount || 1) - 1;

    for (const [id, cell] of Object.entries(cells)) {
      if (id === 'content')
        continue;
      cell.style.backgroundImage = '';
      cell.style.backgroundPosition = '';
      cell.style.backgroundSize = '';
      cell.style.backgroundRepeat = '';
      cell.style.animation = '';
    }

    let animStyle = document.getElementById('sz-tester-anim');
    if (animStyle)
      animStyle.remove();

    const cellData = {};
    const anirate = _currentSkin?.personality?.anirate || 300;

    for (const border of _processedBorders) {
      if (!border.frames.length)
        continue;
      for (const zone of ['a', 'b', 'c']) {
        const cellName = _CELL_MAP[`${border.name}-${zone}`];
        if (!cellName)
          continue;
        if (!cellData[cellName])
          cellData[cellName] = { layers: [] };
        cellData[cellName].layers.push({ border, zone });
      }
    }

    const animRules = [];

    for (const [cellName, data] of Object.entries(cellData)) {
      const cell = cells[cellName];
      if (!cell)
        continue;
      const isCorner = ['nw', 'ne', 'sw', 'se'].includes(cellName);
      if (isCorner)
        _applyCornerCell(cell, cellName, data.layers, frameIdx, anirate, animRules);
      else {
        const layer = data.layers[0];
        if (layer)
          _applyEdgeCell(cell, cellName, layer, frameIdx, anirate, animRules);
      }
    }

    if (animRules.length && _animEnabled) {
      animStyle = document.createElement('style');
      animStyle.id = 'sz-tester-anim';
      animStyle.textContent = animRules.join('\n\n');
      document.head.appendChild(animStyle);
    }

    _updateLabels();
  }

  function _applyEdgeCell(cell, cellName, layer, frameIdx, anirate, animRules) {
    const { border, zone } = layer;
    const fc = border.frameCount;
    const frame = border.frames[frameIdx] || border.frames[0];
    const url = frame?.[zone];

    let bgSize, bgRepeat;
    if (zone === 'a' || zone === 'c') {
      bgRepeat = 'no-repeat';
      bgSize = '100% 100%';
    } else if (border.stretch) {
      bgRepeat = 'no-repeat';
      bgSize = '100% 100%';
    } else {
      bgRepeat = border.horizontal ? 'repeat-x' : 'repeat-y';
      bgSize = 'auto';
    }

    if (url && border.canvasOk) {
      cell.style.backgroundImage = `url('${url}')`;
      cell.style.backgroundSize = bgSize;
      cell.style.backgroundRepeat = bgRepeat;

      if (_animEnabled && _isActive && fc > 2) {
        const activeCount = fc - 1;
        const dur = anirate * activeCount;
        const animName = `tester-${cellName}`;
        let kf = `@keyframes ${animName} {\n`;
        for (let i = 0; i < activeCount; ++i) {
          const pct = ((i / activeCount) * 100).toFixed(2);
          const u = border.frames[i]?.[zone];
          if (u)
            kf += `  ${pct}% { background-image: url('${u}'); }\n`;
        }
        kf += '}';
        animRules.push(kf);
        cell.style.animation = `${animName} ${dur}ms steps(1) infinite`;
      }
    } else if (!border.canvasOk && border.frames[0]?.full) {
      cell.style.backgroundImage = `url('${border.frames[0].full}')`;
      cell.style.backgroundSize = 'auto';
      cell.style.backgroundRepeat = 'no-repeat';
      const zoneA = border.zoneA;
      if (border.horizontal)
        cell.style.backgroundPosition = zone === 'c' ? 'right 0' : zone === 'b' ? `-${zoneA}px 0` : '0 0';
      else
        cell.style.backgroundPosition = zone === 'c' ? `0 bottom` : zone === 'b' ? `0 -${zoneA}px` : '0 0';
    }
  }

  function _applyCornerCell(cell, cellName, layers, frameIdx, anirate, animRules) {
    const horizLayer = layers.find(l => l.border.horizontal);
    const vertLayer = layers.find(l => !l.border.horizontal);
    const pos = _CORNER_POSITION[cellName] || '0 0';

    const hFrame = horizLayer?.border.frames[frameIdx] || horizLayer?.border.frames[0];
    const vFrame = vertLayer?.border.frames[frameIdx] || vertLayer?.border.frames[0];
    const hURL = hFrame?.[horizLayer?.zone];
    const vURL = vFrame?.[vertLayer?.zone];

    const images = [];
    const positions = [];
    const sizes = [];
    const repeats = [];

    if (hURL) {
      images.push(`url('${hURL}')`);
      positions.push(pos);
      sizes.push('auto');
      repeats.push('no-repeat');
    }
    if (vURL) {
      images.push(`url('${vURL}')`);
      positions.push(pos);
      sizes.push('auto');
      repeats.push('no-repeat');
    }

    if (images.length) {
      cell.style.backgroundImage = images.join(', ');
      cell.style.backgroundPosition = positions.join(', ');
      cell.style.backgroundSize = sizes.join(', ');
      cell.style.backgroundRepeat = repeats.join(', ');
    }

    const primary = horizLayer || vertLayer;
    if (_animEnabled && _isActive && primary && primary.border.frameCount > 2) {
      const fc = primary.border.frameCount;
      const activeCount = fc - 1;
      const dur = anirate * activeCount;
      const animName = `tester-${cellName}`;

      let kf = `@keyframes ${animName} {\n`;
      for (let i = 0; i < activeCount; ++i) {
        const pct = ((i / activeCount) * 100).toFixed(2);
        const hf = horizLayer?.border.frames[i]?.[horizLayer?.zone];
        const vf = vertLayer?.border.frames[i]?.[vertLayer?.zone];
        const imgs = [];
        if (hf)
          imgs.push(`url('${hf}')`);
        if (vf)
          imgs.push(`url('${vf}')`);
        if (imgs.length)
          kf += `  ${pct}% { background-image: ${imgs.join(', ')}; }\n`;
      }
      kf += '}';
      animRules.push(kf);
      cell.style.animation = `${animName} ${dur}ms steps(1) infinite`;
    }
  }

  function _updateLabels() {
    if (!_processedBorders)
      return;
    const top = _processedBorders.find(b => b.name === 'top');
    const left = _processedBorders.find(b => b.name === 'left');
    const right = _processedBorders.find(b => b.name === 'right');
    const bottom = _processedBorders.find(b => b.name === 'bottom');

    const fmt = (name, w, h) => `${name} ${w}\u00D7${h}`;

    const topFH = top?.frameHeight || 0;
    const leftFW = left?.frameWidth || 0;
    const rightFW = right?.frameWidth || 0;
    const botFH = bottom?.frameHeight || 0;

    cells.nw.querySelector('.cell-label').textContent = fmt('NW', Math.max(top?.zoneA || 0, leftFW), topFH);
    cells.n.querySelector('.cell-label').textContent = fmt('N', top?.zoneB || 0, topFH) + (top?.stretch ? ' stretch' : ' tile');
    cells.ne.querySelector('.cell-label').textContent = fmt('NE', Math.max(top?.zoneC || 0, rightFW), topFH);
    cells.w.querySelector('.cell-label').textContent = fmt('W', leftFW, left?.zoneB || 0) + (left?.stretch ? ' stretch' : ' tile');
    cells.e.querySelector('.cell-label').textContent = fmt('E', rightFW, right?.zoneB || 0) + (right?.stretch ? ' stretch' : ' tile');
    cells.sw.querySelector('.cell-label').textContent = fmt('SW', Math.max(bottom?.zoneA || 0, leftFW), botFH);
    cells.s.querySelector('.cell-label').textContent = fmt('S', bottom?.zoneB || 0, botFH) + (bottom?.stretch ? ' stretch' : ' tile');
    cells.se.querySelector('.cell-label').textContent = fmt('SE', Math.max(bottom?.zoneC || 0, rightFW), botFH);
  }

  // =========================================================================
  //  Info panel
  // =========================================================================

  function _info(html) {
    infoContent.innerHTML = html;
  }

  function _updateInfo() {
    if (!_processedBorders || !_currentSkin) {
      infoContent.textContent = 'No skin loaded.';
      return;
    }

    const skin = _currentSkin;
    const p = skin.personality || {};
    const lines = [];

    lines.push(`<div class="info-section"><b>Skin:</b> ${skin.name || '?'} by ${skin.author || '?'}</div>`);
    if (skin._uisSource)
      lines.push(`<div class="info-section"><b>Source:</b> ${skin._uisSource} (parsed from UIS)</div>`);
    lines.push(`<div class="info-section"><b>usestran:</b> ${p.usestran ? 'Yes' : 'No'}  <b>anirate:</b> ${p.anirate || 300}ms  <b>tripleimages:</b> ${p.tripleimages ? 'Yes' : 'No'}</div>`);

    for (const b of _processedBorders) {
      const status = b.canvasOk
        ? '<span class="info-ok">canvas OK</span>'
        : b.error
          ? `<span class="info-warn">${b.error}</span>`
          : '<span class="info-warn">no frames</span>';

      lines.push(`<div class="info-section"><b>${b.name.toUpperCase()}</b>: ` +
        `img ${b.imgWidth}\u00D7${b.imgHeight}, ` +
        `${b.frameCount} frames ${b.horizontal ? '(vert stack)' : '(horiz stack)'}, ` +
        `frame ${b.frameWidth}\u00D7${b.frameHeight}, ` +
        `zones A=${b.zoneA} B=${b.zoneB} C=${b.zoneC}, ` +
        `${b.stretch ? 'stretch' : 'tile'} ` +
        `[${status}]</div>`);

      // Sanity checks
      const dim = b.horizontal ? b.frameWidth : b.frameHeight;
      if (b.zoneA + b.zoneB + b.zoneC !== dim && dim > 0)
        lines.push(`  <span class="info-warn">WARNING: zones sum ${b.zoneA + b.zoneB + b.zoneC} \u2260 dim ${dim}</span>`);
      if (b.horizontal && b.imgHeight % b.frameCount !== 0 && b.imgHeight > 0)
        lines.push(`  <span class="info-warn">WARNING: height ${b.imgHeight} not evenly divisible by ${b.frameCount} frames</span>`);
      if (!b.horizontal && b.imgWidth % b.frameCount !== 0 && b.imgWidth > 0)
        lines.push(`  <span class="info-warn">WARNING: width ${b.imgWidth} not evenly divisible by ${b.frameCount} frames</span>`);
    }

    // Grid sizing
    const top = _processedBorders.find(b => b.name === 'top');
    const left = _processedBorders.find(b => b.name === 'left');
    const right = _processedBorders.find(b => b.name === 'right');
    const bottom = _processedBorders.find(b => b.name === 'bottom');
    const leftFW = left?.frameWidth || 4;
    const rightFW = right?.frameWidth || 4;
    const nwExt = Math.max(0, Math.max(top?.zoneA || 0, bottom?.zoneA || 0) - leftFW);
    const neExt = Math.max(0, Math.max(top?.zoneC || 0, bottom?.zoneC || 0) - rightFW);

    lines.push(`<div class="info-section"><b>Grid:</b> ` +
      `cols: ${leftFW}px ${nwExt}px 1fr ${neExt}px ${rightFW}px, ` +
      `rows: ${top?.frameHeight || 30}px 1fr ${bottom?.frameHeight || 4}px</div>`);

    // Compare with skin.js values if this is a UIS-parsed skin and we have a
    // matching skin.js in the parent frame
    if (skin._uisSource) {
      const match = _findMatchingSkinJs(skin.name);
      if (match)
        lines.push(_compareWithSkinJs(skin, match));
    }

    // Sub-skins
    if (skin.subSkins?.length)
      lines.push(`<div class="info-section"><b>Sub-skins:</b> ${skin.subSkins.map(s => s.name || s.id).join(', ')}</div>`);

    // All personality keys for reference
    const personalityKeys = Object.entries(p).filter(([, v]) => typeof v === 'number' || typeof v === 'string');
    if (personalityKeys.length)
      lines.push(`<div class="info-section"><b>Personality keys:</b>\n${personalityKeys.map(([k, v]) => `  ${k} = ${v}`).join('\n')}</div>`);

    infoContent.innerHTML = lines.join('\n');
  }

  /** Find a registered skin.js that matches by name. */
  function _findMatchingSkinJs(name) {
    if (!name)
      return null;
    const parentSkins = _getParentSkins();
    for (const [, skin] of Object.entries(parentSkins))
      if (skin.name && skin.name.toLowerCase() === name.toLowerCase())
        return skin;
    return null;
  }

  /** Compare UIS-parsed values with skin.js values and highlight mismatches. */
  function _compareWithSkinJs(uisSkin, jsSkin) {
    const lines = ['<div class="info-section"><b>UIS vs skin.js comparison:</b>'];
    const uisP = uisSkin.personality || {};
    const jsP = jsSkin.personality || {};

    const keys = [
      'topframe', 'leftframe', 'rightframe', 'bottomframe',
      'toptopheight', 'topbotheight', 'lefttopheight', 'leftbotheight',
      'righttopheight', 'rightbotheight', 'bottomtopheight', 'bottombotheight',
      'topstretch', 'leftstretch', 'rightstretch', 'bottomstretch',
      'usestran', 'anirate', 'tripleimages', 'mouseover', 'buttoncount',
      'textalignment', 'textshift', 'textshiftvert', 'textrightclip',
    ];

    let mismatches = 0;
    for (const key of keys) {
      const uisVal = uisP[key];
      const jsVal = jsP[key];
      if (uisVal == null && jsVal == null)
        continue;
      if (uisVal !== jsVal) {
        lines.push(`  <span class="info-warn">MISMATCH ${key}: UIS=${uisVal ?? '(unset)'} vs JS=${jsVal ?? '(unset)'}</span>`);
        ++mismatches;
      } else {
        lines.push(`  <span class="info-ok">\u2713 ${key}: ${uisVal}</span>`);
      }
    }

    if (mismatches === 0)
      lines.push('  <span class="info-ok">All values match!</span>');
    else
      lines.push(`  <span class="info-warn">${mismatches} mismatch(es) found</span>`);

    lines.push('</div>');
    return lines.join('\n');
  }

  // =========================================================================
  //  Drag & Drop
  // =========================================================================

  function _setupDragDrop() {
    let dragCount = 0;

    mainArea.addEventListener('dragenter', e => {
      e.preventDefault();
      ++dragCount;
      mainArea.classList.add('dragging');
    });

    mainArea.addEventListener('dragleave', e => {
      e.preventDefault();
      if (--dragCount <= 0) {
        dragCount = 0;
        mainArea.classList.remove('dragging');
      }
    });

    mainArea.addEventListener('dragover', e => e.preventDefault());

    mainArea.addEventListener('drop', async e => {
      e.preventDefault();
      dragCount = 0;
      mainArea.classList.remove('dragging');
      await _handleDrop(e.dataTransfer);
    });
  }

  async function _handleDrop(dataTransfer) {
    const items = dataTransfer.items;
    const files = dataTransfer.files;

    // Check for directory entry (Chrome/Edge)
    if (items?.length) {
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          await _loadDroppedFolder(entry);
          return;
        }
      }
    }

    // Handle dropped files
    if (files?.length)
      await _handleFiles(files);
  }

  async function _handleFiles(files) {
    // Check for archive files first
    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.wba') || lower.endsWith('.zip') || lower.endsWith('.rar')) {
        _info(`Loading archive: ${file.name}...`);
        const buffer = await file.arrayBuffer();
        await _processArchive(buffer, file.name);
        return;
      }
    }

    // Check for UIS file
    let uisFile = null;
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.uis')) {
        uisFile = file;
        break;
      }
    }
    if (uisFile) {
      const uisText = await _fileToText(uisFile);
      await _processUISWithFiles(uisText, [...files], uisFile.name);
      return;
    }

    // Check for skin.js
    let skinJsFile = null;
    for (const file of files)
      if (file.name.toLowerCase() === 'skin.js') {
        skinJsFile = file;
        break;
      }
    if (skinJsFile) {
      const fileMap = {};
      for (const file of files) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.bmp') || lower.endsWith('.png') || lower.endsWith('.jpg'))
          fileMap[lower] = await _fileToDataURL(file);
        else if (lower === 'skin.js')
          fileMap['skin.js'] = await _fileToText(file);
      }
      _parseSkinJs(fileMap, 'dropped');
      return;
    }

    _info('<span class="info-warn">No recognized skin file found.</span>\n' +
      'Supported formats:\n' +
      '  \u2022 .wba / .zip / .rar archive containing a .uis file + BMPs\n' +
      '  \u2022 .uis file (drop with BMP files)\n' +
      '  \u2022 skin.js file (drop with BMP files)\n' +
      '  \u2022 Folder containing skin.js or .uis + BMPs');
  }

  // =========================================================================
  //  Folder handling (existing, improved)
  // =========================================================================

  async function _readDirectoryEntries(dirEntry) {
    return new Promise((resolve, reject) => {
      const reader = dirEntry.createReader();
      const allEntries = [];
      const readBatch = () => {
        reader.readEntries(entries => {
          if (!entries.length) {
            resolve(allEntries);
            return;
          }
          allEntries.push(...entries);
          readBatch();
        }, reject);
      };
      readBatch();
    });
  }

  async function _entryToFile(entry) {
    return new Promise((resolve, reject) => entry.file(resolve, reject));
  }

  function _fileToDataURL(file) {
    // Use blob URLs instead of data URLs to avoid size limits on large BMPs
    return URL.createObjectURL(file);
  }

  async function _fileToText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  async function _loadDroppedFolder(dirEntry) {
    _info(`Loading folder: ${dirEntry.name}...`);

    const entries = await _readDirectoryEntries(dirEntry);
    const fileMap = {};
    const fileList = [];

    for (const entry of entries) {
      if (!entry.isFile)
        continue;
      const file = await _entryToFile(entry);
      fileList.push(file);
      const nameLower = entry.name.toLowerCase();
      if (nameLower.endsWith('.bmp') || nameLower.endsWith('.png') || nameLower.endsWith('.jpg'))
        fileMap[nameLower] = await _fileToDataURL(file);
      else if (nameLower === 'skin.js')
        fileMap['skin.js'] = await _fileToText(file);
      else if (nameLower.endsWith('.uis'))
        fileMap['uis'] = { text: await _fileToText(file), name: entry.name };
    }

    // Prefer UIS over skin.js for direct parsing
    if (fileMap['uis']) {
      await _processUISWithFiles(fileMap['uis'].text, fileList, fileMap['uis'].name);
    } else if (fileMap['skin.js']) {
      _parseSkinJs(fileMap, dirEntry.name);
    } else {
      _info('No skin.js or .uis found in dropped folder.\n' +
        'Files found: ' + entries.map(e => e.name).join(', '));
    }
  }

  function _parseSkinJs(fileMap, folderName) {
    const code = fileMap['skin.js'];
    if (!code) {
      _info('skin.js is empty.');
      return;
    }

    try {
      const evalFn = new Function('window', `
        const SZ = { skins: {} };
        window.SZ = SZ;
        ${code}
        return SZ.skins;
      `);
      const result = evalFn({ SZ: { skins: {} } });

      const skinKeys = Object.keys(result);
      if (!skinKeys.length) {
        _info('skin.js did not register any skins.');
        return;
      }

      const skinKey = skinKeys[0];
      const skin = result[skinKey];

      _replacePathsWithDataURLs(skin, fileMap);

      _droppedSkins[folderName] = skin;
      _populateSkinList();
      skinSelect.value = 'dropped:' + folderName;
      _loadSkin('dropped:' + folderName);
    } catch (e) {
      _info('Error parsing skin.js: ' + e.message);
    }
  }

  function _replacePathsWithDataURLs(obj, fileMap) {
    if (!obj || typeof obj !== 'object')
      return;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower.endsWith('.bmp') || lower.endsWith('.png') || lower.endsWith('.jpg')) {
          const fileName = val.split('/').pop().toLowerCase();
          if (fileMap[fileName])
            obj[key] = fileMap[fileName];
        }
      } else if (Array.isArray(val)) {
        for (const item of val)
          _replacePathsWithDataURLs(item, fileMap);
      } else if (typeof val === 'object' && val !== null) {
        _replacePathsWithDataURLs(val, fileMap);
      }
    }
  }

  // =========================================================================
  //  Events
  // =========================================================================

  function _init() {
    _populateSkinList();
    _setupDragDrop();

    openBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      if (fileInput.files?.length)
        await _handleFiles(fileInput.files);
      fileInput.value = '';
    });

    skinSelect.addEventListener('change', () => {
      if (skinSelect.value)
        _loadSkin(skinSelect.value);
      else
        _clearDisplay();
    });

    subSkinSelect.addEventListener('change', () => {
      _updateInfo();
    });

    activeToggle.addEventListener('click', () => {
      _isActive = !_isActive;
      activeToggle.textContent = _isActive ? 'Active' : 'Inactive';
      activeToggle.classList.toggle('toggled', !_isActive);
      _updateDisplay();
    });

    animToggle.addEventListener('click', () => {
      _animEnabled = !_animEnabled;
      animToggle.textContent = _animEnabled ? 'Anim' : 'Static';
      animToggle.classList.toggle('toggled', !_animEnabled);
      _updateDisplay();
    });

    // Auto-select current skin if available
    try {
      const currentSkinName = window.parent.document.querySelector('#sz-skin-frames')
        ? window.parent.SZ?.currentSkinName
        : null;
      if (currentSkinName && skinSelect.querySelector(`option[value="${currentSkinName}"]`)) {
        skinSelect.value = currentSkinName;
        _loadSkin(currentSkinName);
      }
    } catch (_) {}
  }

  _init();

  // ===== Menu system =====
  new SZ.MenuBar({
    onAction(action) {
      if (action === 'about')
        SZ.Dialog.show('dlg-about');
    }
  });

  SZ.Dialog.wireAll();

})();
