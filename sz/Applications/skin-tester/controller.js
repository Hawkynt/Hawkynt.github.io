;(function() {
  'use strict';

  // =========================================================================
  //  Model
  // =========================================================================

  let _currentSkin = null;
  let _currentSkinBase = null;  // before sub-skin resolution
  let _processedBorders = null;
  let _isActive = true;
  let _animEnabled = true;
  let _droppedSkins = {};
  let _unrarLoaded = false;
  let _unrarLoadFailed = false;
  let _magnifierActive = false;
  let _magnifierScale = 8;

  // =========================================================================
  //  DOM refs
  // =========================================================================

  const openBtn = document.getElementById('open-btn');
  const fileInput = document.getElementById('file-input');
  const skinSelect = document.getElementById('skin-select');
  const subSkinSelect = document.getElementById('subskin-select');
  const activeToggle = document.getElementById('active-toggle');
  const animToggle = document.getElementById('anim-toggle');
  const magToggle = document.getElementById('mag-toggle');
  const magZoomLabel = document.getElementById('mag-zoom-label');
  const magZoomSelect = document.getElementById('mag-zoom');
  const mainArea = document.getElementById('main-area');
  const frameGrid = document.getElementById('frame-grid');
  const infoContent = document.getElementById('info-content');
  const copyInfoBtn = document.getElementById('copy-info-btn');
  const magnifier = document.getElementById('magnifier');
  const magnifierCloneWrap = document.getElementById('magnifier-clone-wrap');
  const magnifierInfo = document.getElementById('magnifier-info');

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
  //  Path resolution
  // =========================================================================

  let _parentBaseURI = '';
  try { _parentBaseURI = window.parent.document.baseURI; } catch {}

  function _resolveToParentBase(path) {
    if (!path) return '';
    if (/^(blob:|data:|https?:\/\/)/.test(path)) return path;
    if (!_parentBaseURI) return path;
    try {
      return new URL(path, _parentBaseURI).href;
    } catch {
      return path;
    }
  }

  // =========================================================================
  //  Sub-skin resolution (mirrors SZ.resolveSkin from skin-loader.js)
  // =========================================================================

  function _resolveSubSkin(skin, subSkinId) {
    if (!skin || !subSkinId || subSkinId === 'default')
      return skin;
    const sub = skin.subSkins?.find(s => s.id === subSkinId);
    if (!sub?.colors)
      return skin;
    return { ...skin, colors: { ...skin.colors, ...sub.colors }, _activeSubSkinId: subSkinId };
  }

  function _applyColors(skin) {
    const c = skin?.colors;
    if (!c) return;
    const root = document.documentElement;
    for (const [key, value] of Object.entries(c)) {
      if (!Array.isArray(value)) continue;
      const prop = '--sz-color-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
      root.style.setProperty(prop, `rgb(${value[0]}, ${value[1]}, ${value[2]})`);
    }
  }

  // =========================================================================
  //  Resolve skin personality paths to absolute URLs
  //  (skin-css-generator.js loads images relative to the document, which is
  //   this iframe — not the root. So we must resolve all paths first.)
  // =========================================================================

  function _resolveSkinPaths(skin) {
    if (!skin) return skin;
    const result = { ...skin };

    // Personality image paths
    if (skin.personality) {
      const p = result.personality = { ...skin.personality };
      for (const key of ['top', 'topmask', 'left', 'leftmask', 'right', 'rightmask', 'bottom', 'bottommask', 'menubar', 'menuborders', 'explorerbmp', 'dialogbmp', 'mdibmp', 'mdibmpmask'])
        if (p[key])
          p[key] = _resolveToParentBase(p[key]);
    }

    // Title button images
    if (skin.titleButtons) {
      result.titleButtons = skin.titleButtons.map(btn => {
        if (!btn) return btn;
        const b = { ...btn };
        if (b.image) b.image = _resolveToParentBase(b.image);
        if (b.mask) b.mask = _resolveToParentBase(b.mask);
        return b;
      });
    }

    // Start button
    if (skin.startButton?.image)
      result.startButton = { ...skin.startButton, image: _resolveToParentBase(skin.startButton.image) };

    // Combo button
    if (skin.comboButton?.image)
      result.comboButton = { ...skin.comboButton, image: _resolveToParentBase(skin.comboButton.image) };

    // Buttons section (checkboxes, radios, push buttons)
    if (skin.buttons) {
      const btns = result.buttons = { ...skin.buttons };
      for (const key of ['checkbutton', 'checkbuttonmask', 'radiobutton', 'bitmap', 'bitmapmask'])
        if (btns[key])
          btns[key] = _resolveToParentBase(btns[key]);
    }

    // Task button
    if (skin.taskButton?.image) {
      result.taskButton = { ...skin.taskButton, image: _resolveToParentBase(skin.taskButton.image) };
      if (result.taskButton.mask)
        result.taskButton.mask = _resolveToParentBase(result.taskButton.mask);
    }

    return result;
  }

  // =========================================================================
  //  Image processing (for info panel analysis only — rendering uses
  //  skin-css-generator.js via SZ.generateSkinCSS)
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

  async function _processBorder(border, useTrans) {
    const { name, path, mask, frameCount, zoneA, zoneC, stretch, horizontal } = border;
    const [img, maskImg] = await Promise.all([_loadImage(path), _loadImage(mask)]);

    const result = {
      name, horizontal, stretch, frameCount,
      imgWidth: img?.width || 0, imgHeight: img?.height || 0,
      frameWidth: 0, frameHeight: 0,
      zoneA: 0, zoneB: 0, zoneC: 0,
      canvasOk: false, error: null
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

    // Test canvas taint
    try {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      c.getContext('2d').drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
      c.toDataURL();
      result.canvasOk = true;
    } catch (e) {
      result.error = 'Canvas tainted: ' + e.message;
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
  //  Archive Parsers (unchanged)
  // =========================================================================

  function _detectFormat(buffer) {
    const view = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
    if (view[0] === 0x50 && view[1] === 0x4B && view[2] === 0x03 && view[3] === 0x04) return 'zip';
    if (view[0] === 0x52 && view[1] === 0x61 && view[2] === 0x72 && view[3] === 0x21) return 'rar';
    return null;
  }

  async function _parseZip(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const files = new Map();
    let eocdOffset = -1;
    for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); --i)
      if (view.getUint32(i, true) === 0x06054B50) { eocdOffset = i; break; }
    if (eocdOffset < 0) throw new Error('Invalid ZIP: EOCD not found');
    const cdEntries = view.getUint16(eocdOffset + 10, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    let pos = cdOffset;
    for (let i = 0; i < cdEntries; ++i) {
      if (pos + 46 > buffer.byteLength || view.getUint32(pos, true) !== 0x02014B50) break;
      const method = view.getUint16(pos + 10, true);
      const compSize = view.getUint32(pos + 20, true);
      const nameLen = view.getUint16(pos + 28, true);
      const extraLen = view.getUint16(pos + 30, true);
      const commentLen = view.getUint16(pos + 32, true);
      const localHeaderOffset = view.getUint32(pos + 42, true);
      const name = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + nameLen));
      if (!name.endsWith('/')) {
        const lfhPos = localHeaderOffset;
        if (lfhPos + 30 <= buffer.byteLength) {
          const lfhNameLen = view.getUint16(lfhPos + 26, true);
          const lfhExtraLen = view.getUint16(lfhPos + 28, true);
          const dataStart = lfhPos + 30 + lfhNameLen + lfhExtraLen;
          const compData = bytes.slice(dataStart, dataStart + compSize);
          let data = null;
          if (method === 0) data = compData;
          else if (method === 8) { try { data = await _inflateRaw(compData); } catch {} }
          if (data) files.set(name, data);
        }
      }
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return files;
  }

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
      if (done) break;
      chunks.push(value);
      totalLen += value.length;
    }
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  }

  const _UNRAR_CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/js-unrar@latest/dist/js-unrar.min.js',
    'https://cdn.jsdelivr.net/npm/unrar.js@latest/dist/unrar.min.js',
  ];

  async function _loadUnrarLibrary() {
    if (_unrarLoaded || _unrarLoadFailed) return _unrarLoaded;
    for (const url of _UNRAR_CDN_URLS) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = url; script.onload = resolve; script.onerror = reject;
          document.head.appendChild(script);
        });
        _unrarLoaded = true;
        return true;
      } catch { continue; }
    }
    _unrarLoadFailed = true;
    return false;
  }

  async function _parseRar(buffer) {
    if (typeof window.unrar === 'function') {
      const entries = window.unrar(new Uint8Array(buffer));
      const files = new Map();
      for (const entry of entries)
        if (entry.filename && entry.fileData) files.set(entry.filename, new Uint8Array(entry.fileData));
      return files;
    }
    const loaded = await _loadUnrarLibrary();
    if (loaded && typeof window.unrar === 'function') {
      const entries = window.unrar(new Uint8Array(buffer));
      const files = new Map();
      for (const entry of entries)
        if (entry.filename && entry.fileData) files.set(entry.filename, new Uint8Array(entry.fileData));
      return files;
    }
    return _parseRarStored(buffer);
  }

  function _parseRarStored(buffer) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const files = new Map();
    if (buffer.byteLength < 7) return null;
    if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== 'Rar!') return null;
    let pos = 7;
    while (pos + 7 < buffer.byteLength) {
      const headType = bytes[pos + 2];
      const headFlags = view.getUint16(pos + 3, true);
      const headSize = view.getUint16(pos + 5, true);
      if (headSize < 7 || pos + headSize > buffer.byteLength) break;
      if (headType === 0x74) {
        const packSize = view.getUint32(pos + 7, true);
        const method = bytes[pos + 18];
        const nameLen = view.getUint16(pos + 19, true);
        const nameStart = pos + 32;
        if (nameStart + nameLen <= pos + headSize) {
          const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLen)).replace(/\\/g, '/');
          const dataStart = pos + headSize;
          if (method === 0x30 && dataStart + packSize <= buffer.byteLength)
            files.set(name, bytes.slice(dataStart, dataStart + packSize));
          pos = dataStart + packSize;
          continue;
        }
      }
      pos += (headFlags & 0x8000) ? headSize + (pos + 7 < buffer.byteLength ? view.getUint32(pos + 7, true) : 0) : headSize;
    }
    return files.size > 0 ? files : null;
  }

  // =========================================================================
  //  Archive / File Processing Pipeline
  // =========================================================================

  async function _processArchive(buffer, fileName) {
    const format = _detectFormat(buffer);
    let fileMap;
    if (format === 'zip') { _info('Extracting ZIP archive...'); fileMap = await _parseZip(buffer); }
    else if (format === 'rar') {
      _info('Extracting RAR archive...');
      fileMap = await _parseRar(buffer);
      if (!fileMap) {
        _info('<span class="info-warn">RAR decompression failed.</span>\n' +
          'RAR support requires an online connection or stored entries.\n\n' +
          '<b>Workaround:</b> Extract the .wba manually and drop the folder here.');
        return;
      }
    } else {
      _info(`<span class="info-warn">Unknown archive format.</span>\nFile: ${fileName}`);
      return;
    }
    if (!fileMap || fileMap.size === 0) { _info('<span class="info-warn">Archive is empty.</span>'); return; }
    const fileList = [...fileMap.keys()].sort();
    _info(`Extracted ${fileList.length} files:\n${fileList.map(f => '  ' + f).join('\n')}\n\nProcessing...`);
    let uisText = null, uisName = null;
    for (const [path, data] of fileMap) {
      if (path.toLowerCase().endsWith('.uis')) { uisText = new TextDecoder('windows-1252').decode(data); uisName = path; break; }
    }
    if (!uisText) { _info(`<span class="info-warn">No .uis file found.</span>\nFiles: ${fileList.join(', ')}`); return; }
    const skin = _parseUIS(uisText);
    skin._uisSource = uisName;
    const blobMap = {};
    for (const [path, data] of fileMap) {
      const lower = path.toLowerCase();
      if (lower.endsWith('.bmp') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.tga')) {
        const justName = path.split('/').pop().toLowerCase();
        blobMap[justName] = URL.createObjectURL(new Blob([data], { type: _mimeForExt(justName) }));
      }
    }
    _resolvePathsToBlobs(skin.personality, blobMap);
    _resolvePathsToBlobs(skin.buttons, blobMap);
    _resolvePathsToBlobs(skin.comboButton, blobMap);
    _resolvePathsToBlobs(skin.startButton, blobMap);
    for (const btn of skin.titleButtons) if (btn) _resolvePathsToBlobs(btn, blobMap);

    const skinId = fileName.replace(/\.[^.]+$/, '');
    _droppedSkins[skinId] = skin;
    await _populateSkinList();
    skinSelect.value = 'dropped:' + skinId;
    await _loadSkin('dropped:' + skinId);
  }

  function _resolvePathsToBlobs(obj, blobMap) {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower.endsWith('.bmp') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.tga')) {
          const justName = val.replace(/\\/g, '/').split('/').pop().toLowerCase();
          if (blobMap[justName]) obj[key] = blobMap[justName];
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

  async function _processUISWithFiles(uisText, fileList, sourceLabel) {
    const skin = _parseUIS(uisText);
    skin._uisSource = sourceLabel;
    const blobMap = {};
    for (const file of fileList) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.bmp') || lower.endsWith('.png') || lower.endsWith('.jpg'))
        blobMap[lower] = _fileToDataURL(file);
    }
    _resolvePathsToDataURLs(skin.personality, blobMap);
    _resolvePathsToDataURLs(skin.buttons, blobMap);
    _resolvePathsToDataURLs(skin.comboButton, blobMap);
    _resolvePathsToDataURLs(skin.startButton, blobMap);
    for (const btn of skin.titleButtons) if (btn) _resolvePathsToDataURLs(btn, blobMap);
    const skinId = sourceLabel.replace(/\.[^.]+$/, '');
    _droppedSkins[skinId] = skin;
    await _populateSkinList();
    skinSelect.value = 'dropped:' + skinId;
    await _loadSkin('dropped:' + skinId);
  }

  function _resolvePathsToDataURLs(obj, blobMap) {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        const lower = val.replace(/\\/g, '/').split('/').pop().toLowerCase();
        if (blobMap[lower]) obj[key] = blobMap[lower];
      }
    }
  }

  // =========================================================================
  //  Skin Loading
  // =========================================================================

  let _parentSkinCache = {};

  function _getParentSkinsDirect() {
    try {
      const s = window.parent.SZ?.skins;
      if (s && typeof s === 'object' && Object.keys(s).length > 0) return s;
    } catch {}
    return null;
  }

  function _requestSkinList() {
    return new Promise(resolve => {
      const handler = (e) => {
        if (e.data?.type === 'sz:getSkinListResult') {
          window.removeEventListener('message', handler);
          if (e.data.baseURI) _parentBaseURI = e.data.baseURI;
          resolve(e.data.skins || []);
        }
      };
      window.addEventListener('message', handler);
      window.parent.postMessage({ type: 'sz:getSkinList' }, '*');
      setTimeout(() => { window.removeEventListener('message', handler); resolve([]); }, 2000);
    });
  }

  function _requestSkinData(key) {
    return new Promise(resolve => {
      const handler = (e) => {
        if (e.data?.type === 'sz:getSkinDataResult') {
          window.removeEventListener('message', handler);
          if (e.data.baseURI) _parentBaseURI = e.data.baseURI;
          resolve(e.data.skin || null);
        }
      };
      window.addEventListener('message', handler);
      window.parent.postMessage({ type: 'sz:getSkinData', key }, '*');
      setTimeout(() => { window.removeEventListener('message', handler); resolve(null); }, 2000);
    });
  }

  async function _populateSkinList() {
    skinSelect.innerHTML = '<option value="">-- select --</option>';
    const direct = _getParentSkinsDirect();
    if (direct) {
      for (const [key, skin] of Object.entries(direct)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = skin.name || key;
        skinSelect.appendChild(opt);
      }
    } else {
      const list = await _requestSkinList();
      for (const { key, name } of list) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = name || key;
        skinSelect.appendChild(opt);
      }
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
    if (!skin?.subSkins) return;
    for (const sub of skin.subSkins) {
      const opt = document.createElement('option');
      opt.value = sub.id;
      opt.textContent = sub.name || sub.id;
      subSkinSelect.appendChild(opt);
    }
  }

  async function _getSkin(key) {
    if (key.startsWith('dropped:'))
      return _droppedSkins[key.slice(8)] || null;
    const direct = _getParentSkinsDirect();
    if (direct?.[key]) return direct[key];
    if (_parentSkinCache[key]) return _parentSkinCache[key];
    const skin = await _requestSkinData(key);
    if (skin) _parentSkinCache[key] = skin;
    return skin;
  }

  async function _loadSkin(skinKey) {
    const skin = await _getSkin(skinKey);
    if (!skin) {
      _currentSkin = null;
      _currentSkinBase = null;
      _processedBorders = null;
      _clearDisplay();
      return;
    }

    _currentSkinBase = skin;

    // Resolve sub-skin if one is selected
    const subId = subSkinSelect.value;
    const resolved = _resolveSubSkin(skin, subId);
    _currentSkin = resolved;

    _populateSubSkins(skin);

    // Resolve paths so images load correctly from this iframe's context
    const resolvedSkin = _resolveSkinPaths(resolved);

    // === Use the REAL rendering pipeline from skin-css-generator.js ===
    if (typeof SZ.generateSkinCSS === 'function') {
      _info('Rendering with skin-css-generator.js...');
      await SZ.generateSkinCSS(resolvedSkin);
    } else {
      _info('<span class="info-warn">skin-css-generator.js not loaded — rendering unavailable.</span>');
    }

    // Apply colors
    _applyColors(resolved);

    // Update active/inactive class
    frameGrid.classList.toggle('sz-window-active', _isActive);

    // Toggle sub-skin color tint overlay (same logic as window.js)
    frameGrid.classList.toggle('sz-subskin-tint', !!resolved._activeSubSkinId);

    // Update animation state
    frameGrid.classList.toggle('sz-anim-off', !_animEnabled);

    // Process borders for info panel analysis (not for rendering)
    const p = skin.personality || {};
    const useTrans = !!p.usestran;
    const r = _resolveToParentBase;
    const borders = [
      { name: 'top', path: r(p.top), mask: r(p.topmask), frameCount: p.topframe || 1, zoneA: p.toptopheight || 0, zoneC: p.topbotheight || 0, stretch: !!p.topstretch, horizontal: true },
      { name: 'left', path: r(p.left), mask: r(p.leftmask), frameCount: p.leftframe || 1, zoneA: p.lefttopheight || 0, zoneC: p.leftbotheight || 0, stretch: !!p.leftstretch, horizontal: false },
      { name: 'right', path: r(p.right), mask: r(p.rightmask), frameCount: p.rightframe || 1, zoneA: p.righttopheight || 0, zoneC: p.rightbotheight || 0, stretch: !!p.rightstretch, horizontal: false },
      { name: 'bottom', path: r(p.bottom), mask: r(p.bottommask), frameCount: p.bottomframe || 1, zoneA: p.bottomtopheight || 0, zoneC: p.bottombotheight || 0, stretch: !!p.bottomstretch, horizontal: true },
    ];
    _processedBorders = await Promise.all(borders.map(b => _processBorder(b, useTrans)));

    _updateLabels();
    _updateInfo();
    _updateMagnifierClone();
  }

  /** Re-render with current skin (used when sub-skin or active state changes). */
  async function _rerender() {
    if (!_currentSkinBase)
      return;

    const subId = subSkinSelect.value;
    const resolved = _resolveSubSkin(_currentSkinBase, subId);
    _currentSkin = resolved;

    const resolvedSkin = _resolveSkinPaths(resolved);

    if (typeof SZ.generateSkinCSS === 'function')
      await SZ.generateSkinCSS(resolvedSkin);

    _applyColors(resolved);
    frameGrid.classList.toggle('sz-window-active', _isActive);
    frameGrid.classList.toggle('sz-subskin-tint', !!resolved._activeSubSkinId);
    frameGrid.classList.toggle('sz-anim-off', !_animEnabled);
    _updateLabels();
    _updateInfo();
    _updateMagnifierClone();
  }

  // =========================================================================
  //  Display helpers
  // =========================================================================

  function _clearDisplay() {
    // Remove the generated skin CSS
    const old = document.getElementById('sz-skin-frames');
    if (old) old.remove();
    infoContent.textContent = 'Select a skin to inspect.';
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
    if (skin._activeSubSkinId)
      lines.push(`<div class="info-section"><b>Sub-skin:</b> ${skin._activeSubSkinId}</div>`);
    lines.push(`<div class="info-section"><b>Renderer:</b> ${typeof SZ.generateSkinCSS === 'function' ? '<span class="info-ok">skin-css-generator.js (WYSIWYG)</span>' : '<span class="info-warn">unavailable</span>'}</div>`);
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

    if (skin._uisSource) {
      const match = _findMatchingSkinJs(skin.name);
      if (match) lines.push(_compareWithSkinJs(skin, match));
    }

    if (skin.subSkins?.length)
      lines.push(`<div class="info-section"><b>Sub-skins:</b> ${skin.subSkins.map(s => s.name || s.id).join(', ')}</div>`);

    const personalityKeys = Object.entries(p).filter(([, v]) => typeof v === 'number' || typeof v === 'string');
    if (personalityKeys.length)
      lines.push(`<div class="info-section"><b>Personality keys:</b>\n${personalityKeys.map(([k, v]) => `  ${k} = ${v}`).join('\n')}</div>`);

    infoContent.innerHTML = lines.join('\n');
  }

  function _findMatchingSkinJs(name) {
    if (!name) return null;
    const parentSkins = _getParentSkinsDirect();
    if (!parentSkins) return null;
    for (const [, skin] of Object.entries(parentSkins))
      if (skin.name && skin.name.toLowerCase() === name.toLowerCase()) return skin;
    return null;
  }

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
      if (uisVal == null && jsVal == null) continue;
      if (uisVal !== jsVal) {
        lines.push(`  <span class="info-warn">MISMATCH ${key}: UIS=${uisVal ?? '(unset)'} vs JS=${jsVal ?? '(unset)'}</span>`);
        ++mismatches;
      } else {
        lines.push(`  <span class="info-ok">\u2713 ${key}: ${uisVal}</span>`);
      }
    }
    lines.push(mismatches === 0 ? '  <span class="info-ok">All values match!</span>' : `  <span class="info-warn">${mismatches} mismatch(es) found</span>`);
    lines.push('</div>');
    return lines.join('\n');
  }

  // =========================================================================
  //  Magnifier
  // =========================================================================

  function _updateMagnifierClone() {
    magnifierCloneWrap.innerHTML = '';
    if (!_magnifierActive) return;
    const clone = frameGrid.cloneNode(true);
    clone.removeAttribute('id');
    // Copy computed grid layout — #frame-grid CSS rules won't apply to
    // the clone since the ID was removed, so grid properties must be inlined.
    const cs = getComputedStyle(frameGrid);
    clone.style.display = cs.display;
    clone.style.gridTemplateColumns = cs.gridTemplateColumns;
    clone.style.gridTemplateRows = cs.gridTemplateRows;
    clone.style.gridTemplateAreas = cs.gridTemplateAreas;
    clone.style.gap = cs.gap;
    clone.style.position = 'absolute';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.width = frameGrid.offsetWidth + 'px';
    clone.style.height = frameGrid.offsetHeight + 'px';
    clone.style.transformOrigin = '0 0';
    clone.style.imageRendering = 'pixelated';
    clone.style.pointerEvents = 'none';
    magnifierCloneWrap.appendChild(clone);
  }

  function _onMagnifierMove(e) {
    if (!_magnifierActive) return;

    const gridRect = frameGrid.getBoundingClientRect();
    const areaRect = mainArea.getBoundingClientRect();

    // Cursor position relative to the frame grid
    const cx = e.clientX - gridRect.left;
    const cy = e.clientY - gridRect.top;

    // Position the magnifier near cursor (offset so it doesn't cover the point)
    const magW = 180, magH = 180;
    let magX = e.clientX - areaRect.left + mainArea.scrollLeft + 20;
    let magY = e.clientY - areaRect.top + mainArea.scrollTop - magH / 2;

    // Keep within view
    const areaW = mainArea.scrollWidth;
    const areaH = mainArea.scrollHeight;
    if (magX + magW > areaW) magX = e.clientX - areaRect.left + mainArea.scrollLeft - magW - 20;
    if (magY < 0) magY = 0;
    if (magY + magH > areaH) magY = areaH - magH;

    magnifier.style.left = magX + 'px';
    magnifier.style.top = magY + 'px';

    // Position the clone inside the magnifier so (cx,cy) is at center
    const scale = _magnifierScale;
    const clone = magnifierCloneWrap.firstElementChild;
    if (clone) {
      clone.style.transform = `scale(${scale})`;
      clone.style.left = (magW / 2 - cx * scale) + 'px';
      clone.style.top = (magH / 2 - cy * scale) + 'px';
    }

    // Show coordinates
    magnifierInfo.textContent = `${Math.floor(cx)}, ${Math.floor(cy)}`;
  }

  function _onMagnifierLeave() {
    magnifier.classList.remove('active');
  }

  function _onMagnifierEnter() {
    if (_magnifierActive)
      magnifier.classList.add('active');
  }

  // =========================================================================
  //  Drag & Drop
  // =========================================================================

  function _setupDragDrop() {
    let dragCount = 0;
    mainArea.addEventListener('dragenter', e => { e.preventDefault(); ++dragCount; mainArea.classList.add('dragging'); });
    mainArea.addEventListener('dragleave', e => { e.preventDefault(); if (--dragCount <= 0) { dragCount = 0; mainArea.classList.remove('dragging'); } });
    mainArea.addEventListener('dragover', e => e.preventDefault());
    mainArea.addEventListener('drop', async e => { e.preventDefault(); dragCount = 0; mainArea.classList.remove('dragging'); await _handleDrop(e.dataTransfer); });
  }

  async function _handleDrop(dataTransfer) {
    const items = dataTransfer.items;
    const files = dataTransfer.files;
    if (items?.length) {
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) { await _loadDroppedFolder(entry); return; }
      }
    }
    if (files?.length) await _handleFiles(files);
  }

  async function _handleFiles(files) {
    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.wba') || lower.endsWith('.zip') || lower.endsWith('.rar')) {
        _info(`Loading archive: ${file.name}...`);
        await _processArchive(await file.arrayBuffer(), file.name);
        return;
      }
    }
    let uisFile = null;
    for (const file of files) if (file.name.toLowerCase().endsWith('.uis')) { uisFile = file; break; }
    if (uisFile) {
      const uisText = await _fileToText(uisFile);
      await _processUISWithFiles(uisText, [...files], uisFile.name);
      return;
    }
    let skinJsFile = null;
    for (const file of files) if (file.name.toLowerCase() === 'skin.js') { skinJsFile = file; break; }
    if (skinJsFile) {
      const fileMap = {};
      for (const file of files) {
        const lower = file.name.toLowerCase();
        if (lower.endsWith('.bmp') || lower.endsWith('.png') || lower.endsWith('.jpg')) fileMap[lower] = _fileToDataURL(file);
        else if (lower === 'skin.js') fileMap['skin.js'] = await _fileToText(file);
      }
      await _parseSkinJs(fileMap, 'dropped');
      return;
    }
    _info('<span class="info-warn">No recognized skin file found.</span>\nSupported: .wba/.zip/.rar, .uis + BMPs, skin.js + BMPs, or folder');
  }

  // =========================================================================
  //  Folder handling
  // =========================================================================

  async function _readDirectoryEntries(dirEntry) {
    return new Promise((resolve, reject) => {
      const reader = dirEntry.createReader();
      const all = [];
      const readBatch = () => { reader.readEntries(entries => { if (!entries.length) { resolve(all); return; } all.push(...entries); readBatch(); }, reject); };
      readBatch();
    });
  }

  async function _entryToFile(entry) { return new Promise((resolve, reject) => entry.file(resolve, reject)); }
  function _fileToDataURL(file) { return URL.createObjectURL(file); }
  async function _fileToText(file) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsText(file); }); }

  async function _loadDroppedFolder(dirEntry) {
    _info(`Loading folder: ${dirEntry.name}...`);
    const entries = await _readDirectoryEntries(dirEntry);
    const fileMap = {};
    const fileList = [];
    for (const entry of entries) {
      if (!entry.isFile) continue;
      const file = await _entryToFile(entry);
      fileList.push(file);
      const nameLower = entry.name.toLowerCase();
      if (nameLower.endsWith('.bmp') || nameLower.endsWith('.png') || nameLower.endsWith('.jpg'))
        fileMap[nameLower] = _fileToDataURL(file);
      else if (nameLower === 'skin.js')
        fileMap['skin.js'] = await _fileToText(file);
      else if (nameLower.endsWith('.uis'))
        fileMap['uis'] = { text: await _fileToText(file), name: entry.name };
    }
    if (fileMap['uis']) await _processUISWithFiles(fileMap['uis'].text, fileList, fileMap['uis'].name);
    else if (fileMap['skin.js']) await _parseSkinJs(fileMap, dirEntry.name);
    else _info('No skin.js or .uis found.\nFiles: ' + entries.map(e => e.name).join(', '));
  }

  async function _parseSkinJs(fileMap, folderName) {
    const code = fileMap['skin.js'];
    if (!code) { _info('skin.js is empty.'); return; }
    try {
      const evalFn = new Function('window', `const SZ = { skins: {} }; window.SZ = SZ; ${code} return SZ.skins;`);
      const result = evalFn({ SZ: { skins: {} } });
      const skinKeys = Object.keys(result);
      if (!skinKeys.length) { _info('skin.js did not register any skins.'); return; }
      const skin = result[skinKeys[0]];
      _replacePathsWithDataURLs(skin, fileMap);
      _droppedSkins[folderName] = skin;
      await _populateSkinList();
      skinSelect.value = 'dropped:' + folderName;
      await _loadSkin('dropped:' + folderName);
    } catch (e) { _info('Error parsing skin.js: ' + e.message); }
  }

  function _replacePathsWithDataURLs(obj, fileMap) {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        const lower = val.toLowerCase();
        if (lower.endsWith('.bmp') || lower.endsWith('.png') || lower.endsWith('.jpg')) {
          const fileName = val.split('/').pop().toLowerCase();
          if (fileMap[fileName]) obj[key] = fileMap[fileName];
        }
      } else if (Array.isArray(val)) { for (const item of val) _replacePathsWithDataURLs(item, fileMap); }
      else if (typeof val === 'object' && val !== null) _replacePathsWithDataURLs(val, fileMap);
    }
  }

  // =========================================================================
  //  Events
  // =========================================================================

  async function _init() {
    await _populateSkinList();
    _setupDragDrop();

    openBtn.addEventListener('click', () => fileInput.click());

    copyInfoBtn.addEventListener('click', () => {
      const text = infoContent.textContent || '';
      navigator.clipboard.writeText(text).then(() => {
        copyInfoBtn.classList.add('copied');
        copyInfoBtn.title = 'Copied!';
        setTimeout(() => { copyInfoBtn.classList.remove('copied'); copyInfoBtn.title = 'Copy to clipboard'; }, 1500);
      }, () => {
        copyInfoBtn.title = 'Copy failed';
        setTimeout(() => { copyInfoBtn.title = 'Copy to clipboard'; }, 1500);
      });
    });

    fileInput.addEventListener('change', async () => {
      if (fileInput.files?.length) await _handleFiles(fileInput.files);
      fileInput.value = '';
    });

    skinSelect.addEventListener('change', () => {
      if (skinSelect.value) _loadSkin(skinSelect.value);
      else _clearDisplay();
    });

    subSkinSelect.addEventListener('change', () => _rerender());

    activeToggle.addEventListener('click', () => {
      _isActive = !_isActive;
      activeToggle.textContent = _isActive ? 'Active' : 'Inactive';
      activeToggle.classList.toggle('toggled', !_isActive);
      frameGrid.classList.toggle('sz-window-active', _isActive);
      _updateMagnifierClone();
    });

    animToggle.addEventListener('click', () => {
      _animEnabled = !_animEnabled;
      animToggle.textContent = _animEnabled ? 'Anim' : 'Static';
      animToggle.classList.toggle('toggled', !_animEnabled);
      frameGrid.classList.toggle('sz-anim-off', !_animEnabled);
      _updateMagnifierClone();
    });

    // Magnifier toggle
    magToggle.addEventListener('click', () => {
      _magnifierActive = !_magnifierActive;
      magToggle.classList.toggle('toggled', _magnifierActive);
      magZoomLabel.style.display = _magnifierActive ? '' : 'none';
      if (_magnifierActive) {
        _updateMagnifierClone();
        magnifier.classList.remove('active'); // shown on enter
      } else {
        magnifier.classList.remove('active');
        magnifierCloneWrap.innerHTML = '';
      }
    });

    magZoomSelect.addEventListener('change', () => {
      _magnifierScale = parseInt(magZoomSelect.value, 10) || 8;
      _updateMagnifierClone();
    });

    // Magnifier pointer tracking
    mainArea.addEventListener('pointermove', _onMagnifierMove);
    mainArea.addEventListener('pointerenter', _onMagnifierEnter);
    mainArea.addEventListener('pointerleave', _onMagnifierLeave);

    // Auto-select current skin if available
    try {
      const currentSkinName = window.parent.document.querySelector('#sz-skin-frames')
        ? window.parent.SZ?.currentSkinName : null;
      if (currentSkinName && skinSelect.querySelector(`option[value="${currentSkinName}"]`)) {
        skinSelect.value = currentSkinName;
        _loadSkin(currentSkinName);
      }
    } catch {}
  }

  _init();

  // ===== Menu system =====
  new SZ.MenuBar({
    onAction(action) {
      if (action === 'about') SZ.Dialog.show('dlg-about');
    }
  });

  SZ.Dialog.wireAll();

})();
