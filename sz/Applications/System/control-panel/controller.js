;(function() {
  'use strict';

  // -- Mode mapping ---------------------------------------------------------
  // Dropdown value -> postMessage mode value
  // cover   = Stretch  (scales to fill, may crop)
  // contain = Fit      (scales to fit, may letterbox)
  // fill    = Fill     (stretches exactly to dimensions)
  // center  = Center   (natural size, centered)
  // tile    = Tile     (repeating pattern)

  // State
  let allSkins = [];
  let currentSkinName = '';
  let currentSubSkin = '';
  let selectedSkinName = '';
  let selectedSubSkin = '';
  let currentBg = { baseColor: '#3A6EA5', pattern: null, type: 'image', src: '', mode: 'cover' };
  let selectedBg = { baseColor: '#3A6EA5', pattern: null, type: 'image', src: '', mode: 'cover' };
  let availableBackgrounds = [];
  let selectedThemeId = '';
  let onlineServicesAvailable = false;
  let dirty = false;

  // Pattern editor state
  let patternBits = null; // Uint8Array of 0/1
  let patternWidth = 8;
  let patternHeight = 8;

  // Pattern presets (classic Windows 95/98 style)
  const PATTERN_PRESETS = [
    { name: 'None', w: 8, h: 8, fg: '#FFFFFF', bits: null },
    { name: 'Dots', w: 8, h: 8, fg: '#FFFFFF', bits: '8000000000000000' },
    { name: 'Checker', w: 2, h: 2, fg: '#FFFFFF', bits: '9' }, // 1001
    { name: 'Crosshatch', w: 8, h: 8, fg: '#FFFFFF', bits: 'FF808080FF080808' },
    { name: 'Diagonal L', w: 8, h: 8, fg: '#FFFFFF', bits: '0102040810204080' },
    { name: 'Diagonal R', w: 8, h: 8, fg: '#FFFFFF', bits: '8040201008040201' },
    { name: 'H Lines', w: 8, h: 4, fg: '#FFFFFF', bits: 'FF000000' },
    { name: 'V Lines', w: 4, h: 8, fg: '#FFFFFF', bits: '88888888' },
    { name: 'Grid', w: 8, h: 8, fg: '#FFFFFF', bits: 'FF01010101010101' },
    { name: 'Bricks', w: 8, h: 8, fg: '#FFFFFF', bits: 'FF01010180808080' },
    { name: 'Weave', w: 8, h: 8, fg: '#FFFFFF', bits: '8844221188442211' },
  ];

  // Resolve asset paths relative to the OS root (2 levels up from this iframe)
  const _resolveAssetPath = (src) => src && !src.startsWith('data:') && !src.startsWith('http') && !src.startsWith('blob:') && !src.startsWith('/') ? '../../' + src : src;

  // Theme presets
  const THEME_PRESETS = [
    { id: 'default', name: 'SynthelicZ Default', desc: 'LUNAX skin with Bliss background', skinId: 'LUNAX', bgSrc: 'assets/backgrounds/bliss.svg' },
    { id: 'classic', name: 'Classic', desc: 'Windows 98 retro look', skinId: 'WIN98', bgSrc: '' },
    { id: 'aquarium', name: 'Aquarium', desc: 'Underwater theme', skinId: 'AQUARIUM', bgSrc: '' },
    { id: 'nature', name: 'Nature', desc: 'XP Nature skin', skinId: 'XPNATURE', bgSrc: '' },
  ];

  // Elements
  const skinListEl = document.getElementById('skin-list');
  const subskinRow = document.getElementById('subskin-row');
  const subskinSelect = document.getElementById('subskin-select');
  const skinFontInfo = document.getElementById('skin-font-info');
  const bgListEl = document.getElementById('bg-list');
  const bgModeEl = document.getElementById('bg-mode');
  const pvBgImg = document.getElementById('pv-bg-img');
  const pvBgScreen = document.getElementById('pv-bg-screen');
  const pvBgPattern = document.getElementById('pv-bg-pattern');
  const pvBgVideo = document.getElementById('pv-bg-video');
  const themeListEl = document.getElementById('theme-list');

  // Background extended elements
  const bgBaseColorEl = document.getElementById('bg-base-color');
  const bgColorSwatch = document.getElementById('bg-color-swatch');
  const chkPattern = document.getElementById('chk-pattern');
  const btnEditPattern = document.getElementById('btn-edit-pattern');
  const bgSourceTypeEl = document.getElementById('bg-source-type');

  // Slideshow elements
  const slideshowFolderEl = document.getElementById('slideshow-folder');
  const slideshowIntervalEl = document.getElementById('slideshow-interval');
  const slideshowIntervalValueEl = document.getElementById('slideshow-interval-value');
  const chkSlideshowShuffle = document.getElementById('chk-slideshow-shuffle');
  const slideshowTransitionEl = document.getElementById('slideshow-transition');
  const slideshowDurationEl = document.getElementById('slideshow-duration');
  const slideshowDurationValueEl = document.getElementById('slideshow-duration-value');
  const slideshowModeEl = document.getElementById('slideshow-mode');
  const chkSlideshowRecursive = document.getElementById('chk-slideshow-recursive');
  const pvBgImgAlt = document.getElementById('pv-bg-img-alt');

  // Video elements
  const videoFileEl = document.getElementById('video-file');
  const chkVideoLoop = document.getElementById('chk-video-loop');
  const videoSpeedEl = document.getElementById('video-speed');
  const videoSpeedValueEl = document.getElementById('video-speed-value');

  // Online elements
  const onlineServiceEl = document.getElementById('online-service');
  const onlineQueryEl = document.getElementById('online-query');
  const onlineModeEl = document.getElementById('online-mode');
  const onlineThumbnailsEl = document.getElementById('online-thumbnails');

  // Pattern editor dialog elements
  const patternCanvas = document.getElementById('pattern-canvas');
  const patternCtx = patternCanvas?.getContext('2d');
  const patternFgColorEl = document.getElementById('pattern-fg-color');
  const patternWidthEl = document.getElementById('pattern-width');
  const patternHeightEl = document.getElementById('pattern-height');
  const patternPresetsEl = document.getElementById('pattern-presets');

  // Preview elements
  const pvScreen = document.getElementById('pv-screen');
  const pvWindow = document.getElementById('pv-window');
  const pvTitlebar = document.getElementById('pv-titlebar');
  const pvContent = document.getElementById('pv-content');
  const pvInactiveBar = document.getElementById('pv-inactive-bar');
  const pvTaskbar = document.getElementById('pv-taskbar');
  const pvStart = document.getElementById('pv-start');

  // Theme preview elements
  const pvThemeScreen = document.getElementById('pv-theme-screen');
  const pvThemeWindow = document.getElementById('pv-theme-window');
  const pvThemeTitlebar = document.getElementById('pv-theme-titlebar');
  const pvThemeMenubar = document.getElementById('pv-theme-menubar');
  const pvThemeBody = document.getElementById('pv-theme-body');
  const pvThemeTaskbar = document.getElementById('pv-theme-taskbar');
  const pvThemeStart = document.getElementById('pv-theme-start');

  // -- Helpers --------------------------------------------------------------
  const rgb = (arr) => arr ? `rgb(${arr[0]},${arr[1]},${arr[2]})` : '';

  function skinColorSwatch(colors) {
    if (!colors) return '';
    const at = colors.activeTitle || [0, 82, 222];
    const gt = colors.gradientActiveTitle || at;
    return `linear-gradient(to right, ${rgb(at)}, ${rgb(gt)})`;
  }

  // -- Tab switching --------------------------------------------------------
  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t === tab);
      for (const p of document.querySelectorAll('.tab-body')) p.classList.toggle('active', p.id === 'panel-' + tab.dataset.tab);
    });
  }

  // -- Sub-tab switching (Window Mgmt tab) ---------------------------------
  for (const subtab of document.querySelectorAll('#panel-windowmgmt .subtab')) {
    subtab.addEventListener('click', () => {
      for (const st of subtab.parentElement.querySelectorAll('.subtab')) st.classList.toggle('active', st === subtab);
      for (const sp of document.querySelectorAll('#panel-windowmgmt .subtab-body')) sp.classList.toggle('active', sp.id === 'subpanel-' + subtab.dataset.subtab);
    });
  }

  // -- Themes list ----------------------------------------------------------
  function renderThemeList() {
    themeListEl.innerHTML = '';
    for (const theme of THEME_PRESETS) {
      const skin = allSkins.find(s => s.id === theme.skinId);
      const colors = skin?.colors || {};

      const li = document.createElement('li');
      li.dataset.themeId = theme.id;
      if (theme.id === selectedThemeId)
        li.classList.add('selected');

      // Color swatch preview
      const swatch = document.createElement('div');
      swatch.className = 'theme-swatch';

      const titleRow = document.createElement('div');
      titleRow.className = 'theme-swatch-titlebar';
      titleRow.style.background = skinColorSwatch(colors);

      const bodyRow = document.createElement('div');
      bodyRow.className = 'theme-swatch-body';

      const windowPart = document.createElement('div');
      windowPart.className = 'theme-swatch-window';
      windowPart.style.background = rgb(colors.window || [255, 255, 255]);

      const facePart = document.createElement('div');
      facePart.className = 'theme-swatch-face';
      facePart.style.background = rgb(colors.buttonFace || [238, 237, 227]);

      bodyRow.appendChild(windowPart);
      bodyRow.appendChild(facePart);
      swatch.appendChild(titleRow);
      swatch.appendChild(bodyRow);

      const info = document.createElement('div');
      info.className = 'theme-info';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'theme-info-name';
      nameSpan.textContent = theme.name;
      const descSpan = document.createElement('span');
      descSpan.className = 'theme-info-desc';
      descSpan.textContent = theme.desc;
      info.appendChild(nameSpan);
      info.appendChild(descSpan);

      li.appendChild(swatch);
      li.appendChild(info);

      li.addEventListener('click', () => selectTheme(theme));
      themeListEl.appendChild(li);
    }
  }

  function selectTheme(theme) {
    selectedThemeId = theme.id;
    for (const li of themeListEl.querySelectorAll('li'))
      li.classList.toggle('selected', li.dataset.themeId === theme.id);

    // Update appearance tab selection to match
    selectedSkinName = theme.skinId;
    selectedSubSkin = theme.subSkin || '';
    selectedBg.src = theme.bgSrc;

    // Update theme preview
    const skin = allSkins.find(s => s.id === theme.skinId);
    if (skin)
      updateThemePreview(skin);

    dirty = true;
  }

  function updateThemePreview(skin) {
    if (!skin?.colors) return;
    const c = skin.colors;

    pvThemeScreen.style.background = rgb(c.background || [58, 110, 165]);

    const at = c.activeTitle || [0, 82, 222];
    const gt = c.gradientActiveTitle || at;
    pvThemeTitlebar.style.background = `linear-gradient(to right, ${rgb(at)}, ${rgb(gt)})`;
    pvThemeTitlebar.style.color = rgb(c.titleText || [255, 255, 255]);

    pvThemeWindow.style.background = rgb(c.window || [255, 255, 255]);
    pvThemeWindow.style.borderColor = rgb(c.windowFrame || [0, 0, 0]);
    pvThemeBody.style.color = rgb(c.windowText || [0, 0, 0]);

    pvThemeMenubar.style.background = rgb(c.menu || [238, 237, 227]);
    pvThemeMenubar.style.color = rgb(c.menuText || [0, 0, 0]);

    const taskAt = c.activeTitle || [15, 92, 190];
    pvThemeTaskbar.style.background = `linear-gradient(to bottom, ${rgb(taskAt)}, ${rgb([Math.max(0, taskAt[0] - 30), Math.max(0, taskAt[1] - 30), Math.max(0, taskAt[2] - 30)])})`;

    pvThemeStart.style.background = rgb(c.highlight || [49, 106, 197]);
    pvThemeStart.style.color = rgb(c.highlightText || [255, 255, 255]);

    if (skin.fonts)
      pvThemeTitlebar.style.fontFamily = skin.fonts.family || 'Tahoma';
  }

  // -- Skin list ------------------------------------------------------------
  function renderSkinList() {
    skinListEl.innerHTML = '';
    for (const skin of allSkins) {
      const li = document.createElement('li');
      li.dataset.skin = skin.id;

      // Color swatch strip showing title bar gradient
      const swatch = document.createElement('span');
      swatch.className = 'skin-color-swatch';
      swatch.style.background = skinColorSwatch(skin.colors);
      li.appendChild(swatch);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = skin.displayName || skin.id;
      li.appendChild(nameSpan);

      if (skin.id === selectedSkinName)
        li.classList.add('selected');
      li.addEventListener('click', () => selectSkin(skin.id));
      skinListEl.appendChild(li);
    }
  }

  function scrollToSelectedSkin() {
    const selected = skinListEl.querySelector('li.selected');
    if (selected)
      selected.scrollIntoView({ block: 'nearest' });
  }

  function _populateSubSkinDropdown(skin, activeSubSkinId) {
    if (skin?.subSkins?.length) {
      subskinRow.classList.add('visible');
      subskinSelect.innerHTML = '';
      for (const ss of skin.subSkins) {
        const opt = document.createElement('option');
        opt.value = ss.id;
        opt.textContent = ss.name || ss.id;
        if (ss.id === activeSubSkinId)
          opt.selected = true;
        subskinSelect.appendChild(opt);
      }
      selectedSubSkin = activeSubSkinId || skin.subSkins[0].id;
    } else {
      subskinRow.classList.remove('visible');
      selectedSubSkin = '';
    }
  }

  function selectSkin(skinId) {
    selectedSkinName = skinId;
    for (const li of skinListEl.querySelectorAll('li'))
      li.classList.toggle('selected', li.dataset.skin === skinId);

    const skin = allSkins.find(s => s.id === skinId);

    // Sub-skins: when switching to a new skin, select the first (default) sub-skin
    _populateSubSkinDropdown(skin, skin?.subSkins?.[0]?.id || '');

    updatePreviewWithSubSkin(skin, selectedSubSkin);
    updateFontInfo(skin);
    dirty = true;
  }

  subskinSelect.addEventListener('change', () => {
    selectedSubSkin = subskinSelect.value;
    const skin = allSkins.find(s => s.id === selectedSkinName);
    if (skin)
      updatePreviewWithSubSkin(skin, selectedSubSkin);
    dirty = true;
  });

  function updatePreview(skin) {
    if (!skin?.colors) return;
    const c = skin.colors;

    // Background
    pvScreen.style.background = rgb(c.background || [58, 110, 165]);

    // Active title bar gradient
    const at = c.activeTitle || [0, 82, 222];
    const gt = c.gradientActiveTitle || at;
    pvTitlebar.style.background = `linear-gradient(to right, ${rgb(at)}, ${rgb(gt)})`;
    pvTitlebar.style.color = rgb(c.titleText || [255, 255, 255]);

    // Inactive title bar gradient
    const it = c.inactiveTitle || [128, 128, 128];
    const git = c.gradientInactiveTitle || it;
    pvInactiveBar.style.background = `linear-gradient(to right, ${rgb(it)}, ${rgb(git)})`;

    // Window
    pvWindow.style.background = rgb(c.window || [255, 255, 255]);
    pvWindow.style.borderColor = rgb(c.windowFrame || [0, 0, 0]);
    pvWindow.querySelector('.preview-body').style.color = rgb(c.windowText || [0, 0, 0]);

    // Button face color on content area border
    const buttonFaceColor = rgb(c.buttonFace || [238, 237, 227]);
    pvContent.style.borderTop = `1px solid ${buttonFaceColor}`;

    // Menu bar
    const menubar = pvWindow.querySelector('.preview-menubar');
    menubar.style.background = rgb(c.menu || [238, 237, 227]);
    menubar.style.color = rgb(c.menuText || [0, 0, 0]);

    // Taskbar
    const taskAt = c.activeTitle || [15, 92, 190];
    pvTaskbar.style.background = `linear-gradient(to bottom, ${rgb(taskAt)}, ${rgb([Math.max(0, taskAt[0] - 30), Math.max(0, taskAt[1] - 30), Math.max(0, taskAt[2] - 30)])})`;

    // Start button
    pvStart.style.background = rgb(c.highlight || [49, 106, 197]);
    pvStart.style.color = rgb(c.highlightText || [255, 255, 255]);

    // Font
    if (skin.fonts)
      pvTitlebar.style.fontFamily = skin.fonts.family || 'Tahoma';
  }

  function resolveSubSkinColors(skin, subSkinId) {
    if (!subSkinId || subSkinId === 'default' || !skin?.subSkins)
      return skin?.colors || {};
    const sub = skin.subSkins.find(s => s.id === subSkinId);
    if (!sub?.colors)
      return skin?.colors || {};
    return { ...skin.colors, ...sub.colors };
  }

  function updatePreviewWithSubSkin(skin, subSkinId) {
    if (!skin) return;
    const resolved = resolveSubSkinColors(skin, subSkinId);
    updatePreview({ ...skin, colors: resolved });
  }

  function updateFontInfo(skin) {
    if (skin?.fonts)
      skinFontInfo.textContent = `${skin.fonts.family || '?'}, ${skin.fonts.height || '?'}px, weight ${skin.fonts.weight || '?'}`;
    else
      skinFontInfo.textContent = '--';
  }

  // -- Background list ------------------------------------------------------
  function renderBackgroundList() {
    bgListEl.innerHTML = '';

    // "(None)" option
    const noneItem = document.createElement('li');
    noneItem.textContent = '(None)';
    noneItem.dataset.src = '';
    if (!selectedBg.src)
      noneItem.classList.add('selected');
    noneItem.addEventListener('click', () => selectBackground('', ''));
    bgListEl.appendChild(noneItem);

    for (const bg of availableBackgrounds) {
      const li = document.createElement('li');
      li.textContent = bg.name;
      li.dataset.src = bg.src;
      if (bg.src === selectedBg.src)
        li.classList.add('selected');
      li.addEventListener('click', () => selectBackground(bg.src, bg.name));
      bgListEl.appendChild(li);
    }
  }

  async function selectBackground(src, name) {
    selectedBg.src = src;
    for (const li of bgListEl.querySelectorAll('li'))
      li.classList.toggle('selected', li.dataset.src === src);
    await updateBgPreview();
    dirty = true;
  }

  const _localBlobUrls = new Set();

  function _revokeLocalBlobs() {
    for (const url of _localBlobUrls)
      URL.revokeObjectURL(url);
    _localBlobUrls.clear();
  }

  async function _resolveVfsSrc(src) {
    if (!src) return '';
    if (src.startsWith('/')) {
      try {
        const Kernel32 = SZ.Dlls.Kernel32;
        const uri = await Kernel32.ReadUri(src);
        if (!uri) return '';
        // Non-blob URIs (relative paths, http://, data:) work directly
        if (!uri.startsWith('blob:'))
          return _resolveAssetPath(uri);
        // Blob URLs from parent frame may not be accessible in this iframe
        // (file:// origin isolation). Re-read as bytes and create a local blob URL.
        const bytes = await Kernel32.ReadAllBytes(src);
        const ext = src.split('.').pop().toLowerCase();
        const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm' }[ext] || 'application/octet-stream';
        const localUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
        _localBlobUrls.add(localUrl);
        return localUrl;
      } catch (e) {
        console.error('VFS read error for preview:', e);
        return '';
      }
    }
    return _resolveAssetPath(src);
  }

  async function updateBgPreview() {
    const baseColor = bgBaseColorEl.value || '#3A6EA5';
    pvBgScreen.style.backgroundColor = baseColor;

    // Pattern preview
    _updatePatternPreview();

    // Hide video preview by default
    pvBgVideo.style.display = 'none';
    pvBgVideo.pause();

    const sourceType = bgSourceTypeEl.value;

    if (sourceType === 'none') {
      pvBgImg.style.display = 'none';
      pvBgImg.src = '';
      pvBgScreen.style.backgroundImage = '';
      return;
    }

    if (sourceType === 'video') {
      pvBgImg.style.display = 'none';
      pvBgImg.src = '';
      pvBgScreen.style.backgroundImage = '';
      const videoSrc = videoFileEl.value;
      if (videoSrc) {
        const resolved = await _resolveVfsSrc(videoSrc);
        if (resolved) {
          pvBgVideo.src = resolved;
          pvBgVideo.style.display = '';
          pvBgVideo.muted = true;
          pvBgVideo.play().catch(() => {});
        }
      }
      return;
    }

    if (sourceType === 'online') {
      // Show cached URL if any
      const cachedUrl = selectedBg.online?.cachedUrl;
      if (cachedUrl) {
        const resolved = await _resolveVfsSrc(cachedUrl);
        _showPreviewImage(resolved, onlineModeEl.value);
      } else {
        pvBgImg.style.display = 'none';
        pvBgScreen.style.backgroundImage = '';
      }
      return;
    }

    if (sourceType === 'slideshow') {
      if (slideshowFolderEl.value)
        _startSlideshowPreview();
      else {
        _stopSlideshowPreview();
        pvBgImg.style.display = 'none';
        pvBgImg.src = '';
      }
      return;
    }

    // image -- show the selected image
    let resolvedSrc = '';
    if (selectedBg.src)
      resolvedSrc = await _resolveVfsSrc(selectedBg.src);

    _showPreviewImage(resolvedSrc, bgModeEl.value);
  }

  function _showPreviewImage(resolvedSrc, mode) {
    pvBgImg.src = resolvedSrc;
    pvBgImg.style.display = resolvedSrc ? '' : 'none';

    if (mode === 'tile') {
      pvBgImg.style.display = 'none';
      pvBgScreen.style.backgroundImage = resolvedSrc ? `url('${resolvedSrc}')` : '';
      pvBgScreen.style.backgroundRepeat = 'repeat';
      pvBgScreen.style.backgroundSize = 'auto';
      pvBgScreen.style.backgroundPosition = 'top left';
    } else {
      pvBgScreen.style.backgroundImage = '';
      pvBgImg.style.objectFit = mode === 'fill' ? 'fill' : mode === 'center' ? 'none' : mode;
      if (mode === 'center') {
        pvBgImg.style.width = 'auto';
        pvBgImg.style.height = 'auto';
        pvBgImg.style.top = '50%';
        pvBgImg.style.left = '50%';
        pvBgImg.style.transform = 'translate(-50%, -50%)';
      } else {
        pvBgImg.style.width = '100%';
        pvBgImg.style.height = '100%';
        pvBgImg.style.top = '0';
        pvBgImg.style.left = '0';
        pvBgImg.style.transform = '';
      }
    }
  }

  function _updatePatternPreview() {
    if (!chkPattern.checked || !selectedBg.pattern) {
      pvBgPattern.style.display = 'none';
      return;
    }
    const { width, height, fg, bits } = selectedBg.pattern;
    const ctx = pvBgPattern.getContext('2d');
    const cw = pvBgPattern.width;
    const ch = pvBgPattern.height;
    ctx.clearRect(0, 0, cw, ch);

    const baseColor = bgBaseColorEl.value || '#3A6EA5';
    const bitString = bits.split('').map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
    const scale = 2;

    for (let py = 0; py < ch; py += height * scale)
      for (let px = 0; px < cw; px += width * scale)
        for (let y = 0; y < height; ++y)
          for (let x = 0; x < width; ++x) {
            const bitIndex = y * width + x;
            const bit = bitString[bitIndex] === '1';
            ctx.fillStyle = bit ? fg : baseColor;
            ctx.fillRect(px + x * scale, py + y * scale, scale, scale);
          }

    pvBgPattern.style.display = '';
  }

  // -- Slideshow preview engine ---------------------------------------------

  function _shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  let _pvSlideshowTimer = null;
  let _pvSlideshowImages = [];
  let _pvSlideshowIndex = 0;
  let _pvSlideshowFront = true; // true = pvBgImg is front
  let _pvPreloadPromise = null;
  const _pvSubTimers = new Set();
  const _pvPendingLaters = [];
  const _pvPendingRAFs = [];

  // Preload the next slide's image URL and fully decode it before use
  function _pvPreloadNext() {
    if (!_pvSlideshowTimer || _pvSlideshowImages.length < 2) return;
    const nextIdx = (_pvSlideshowIndex + 1) % _pvSlideshowImages.length;
    _pvPreloadPromise = (async () => {
      const url = await _resolveVfsSrc(_pvSlideshowImages[nextIdx]);
      if (!url || !_pvSlideshowTimer) return null;
      const img = new Image();
      img.src = url;
      try { await img.decode(); } catch {}
      if (!_pvSlideshowTimer) return null;
      return { url, idx: nextIdx };
    })();
  }

  async function _startSlideshowPreview() {
    _stopSlideshowPreview();

    const folder = slideshowFolderEl.value;
    if (!folder) return;

    const recursive = chkSlideshowRecursive.checked;
    const Kernel32 = SZ.Dlls.Kernel32;

    try {
      const entries = await Kernel32.FindFirstFile(folder, recursive ? Kernel32.SearchOption.BreadthFirst : 0);
      const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'];
      _pvSlideshowImages = entries
        .filter(name => { const ext = name.split('.').pop().toLowerCase(); return imageExts.includes(ext); })
        .map(name => folder + '/' + name);
    } catch (e) {
      console.warn('[CP] Slideshow preview folder read error:', e);
      return;
    }

    if (_pvSlideshowImages.length === 0) {
      pvBgImg.style.display = 'none';
      pvBgImgAlt.style.display = 'none';
      return;
    }

    // Shuffle before showing the first image so even the starting image is random
    if (chkSlideshowShuffle.checked)
      _shuffleArray(_pvSlideshowImages);

    _pvSlideshowIndex = 0;
    _pvSlideshowFront = true;

    // Show first image (source)
    const firstSrc = await _resolveVfsSrc(_pvSlideshowImages[0]);
    const mode = slideshowModeEl.value;
    _showPreviewImage(firstSrc, mode);
    pvBgImgAlt.style.display = 'none';
    pvBgImgAlt.style.opacity = '0';

    // Start preloading the target image immediately
    _pvPreloadNext();

    // Schedule first tick
    _pvScheduleTick();
  }

  function _pvScheduleTick() {
    _pvSlideshowTimer = setTimeout(() => _pvSlideshowTick(), 3000);
  }

  async function _pvSlideshowTick() {
    // 1. Advance index
    ++_pvSlideshowIndex;
    if (_pvSlideshowIndex >= _pvSlideshowImages.length) {
      _pvSlideshowIndex = 0;
      if (chkSlideshowShuffle.checked)
        _shuffleArray(_pvSlideshowImages);
    }

    // 2. Wait for target image to be ready
    let nextSrc;
    if (_pvPreloadPromise) {
      const result = await _pvPreloadPromise;
      _pvPreloadPromise = null;
      if (result && result.idx === _pvSlideshowIndex)
        nextSrc = result.url;
    }
    // Fallback: resolve + decode on the spot
    if (!nextSrc) {
      nextSrc = await _resolveVfsSrc(_pvSlideshowImages[_pvSlideshowIndex]);
      if (nextSrc) {
        const tmp = new Image();
        tmp.src = nextSrc;
        try { await tmp.decode(); } catch {}
      }
    }
    if (!_pvSlideshowTimer || !nextSrc) return;

    const front = _pvSlideshowFront ? pvBgImg : pvBgImgAlt;
    const back = _pvSlideshowFront ? pvBgImgAlt : pvBgImg;

    back.src = nextSrc;
    try { await back.decode(); } catch {};
    if (!_pvSlideshowTimer) return;

    back.style.objectFit = slideshowModeEl.value === 'tile' ? 'cover' : (slideshowModeEl.value === 'fill' ? 'fill' : slideshowModeEl.value === 'center' ? 'none' : slideshowModeEl.value);
    back.style.display = '';

    // 3. Start transition animation (source → target)
    const duration = parseFloat(slideshowDurationEl.value) || 1;
    _applyPreviewTransition(front, back);

    // 4. Wait for animation to complete, THEN swap and load next
    _pvSlideshowTimer = setTimeout(() => {
      if (!_pvSlideshowTimer) return;

      // Cancel remaining transition callbacks
      for (const id of _pvPendingLaters) clearTimeout(id);
      for (const id of _pvPendingRAFs) cancelAnimationFrame(id);
      _pvPendingLaters.length = 0;
      _pvPendingRAFs.length = 0;
      _pvClearAllSubTimers();

      // Reset old source (the element that was animated out)
      const _r = (el) => { el.style.transition = ''; el.style.clipPath = ''; el.style.filter = ''; el.style.transform = ''; el.style.opacity = ''; el.style.transformOrigin = ''; el.style.zIndex = ''; };
      _r(front);

      // 5. Swap: target becomes the new source
      _pvSlideshowFront = !_pvSlideshowFront;

      // 6. Preload next target
      _pvPreloadNext();

      // 7. Restart interval
      _pvScheduleTick();
    }, duration * 1000);
  }

  // All non-random transition keys for random picker
  const _ALL_TRANSITIONS = [
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

  function _applyPreviewTransition(front, back) {
    let transition = slideshowTransitionEl.value || 'fade';
    const duration = parseFloat(slideshowDurationEl.value) || 1;
    if (transition === 'random')
      transition = _ALL_TRANSITIONS[Math.floor(Math.random() * _ALL_TRANSITIONS.length)];
    _runTransition(front, back, transition, duration);
  }

  function _pvTrackedInterval(fn, ms) {
    const id = setInterval(() => fn(id), ms);
    _pvSubTimers.add(id);
    return id;
  }

  function _pvClearSubTimer(id) {
    clearInterval(id);
    _pvSubTimers.delete(id);
  }

  function _pvClearAllSubTimers() {
    for (const id of _pvSubTimers)
      clearInterval(id);
    _pvSubTimers.clear();
  }

  // Transitions where the front element must be on top (it animates out to reveal back)
  const _FRONT_ON_TOP = new Set([
    'uncover-left','uncover-right','uncover-up','uncover-down',
    'circle-out','diamond-out',
    'split-horizontal-in','split-vertical-in',
    'flip-horizontal','flip-vertical',
    'glitch',
  ]);

  function _runTransition(front, back, transition, duration) {
    // Reset any previous clip-path / filter / transform state
    const _reset = (el) => {
      el.style.transition = '';
      el.style.clipPath = '';
      el.style.filter = '';
      el.style.transform = '';
      el.style.opacity = '';
      el.style.transformOrigin = '';
      el.style.zIndex = '';
    };
    // Cancel pending timers/RAFs from any previous transition
    for (const id of _pvPendingLaters) clearTimeout(id);
    for (const id of _pvPendingRAFs) cancelAnimationFrame(id);
    _pvPendingLaters.length = 0;
    _pvPendingRAFs.length = 0;
    for (const id of _pvSubTimers) clearInterval(id);
    _pvSubTimers.clear();
    const _later = (fn, ms) => { const id = setTimeout(fn, ms); _pvPendingLaters.push(id); };
    const _rAF = (fn) => { const id = requestAnimationFrame(fn); _pvPendingRAFs.push(id); };
    _reset(front);
    _reset(back);

    // Set z-order: some transitions need front on top (it departs), others need back on top (it arrives)
    if (_FRONT_ON_TOP.has(transition)) {
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

      // ── Subtle ───────────────────────────────────────────────────
      case 'cut':
        back.style.opacity = '1';
        front.style.opacity = '0';
        break;

      case 'fade-black':
        front.style.transition = `opacity ${d * 0.5}s ${ease}`;
        front.style.opacity = '0';
        back.style.opacity = '0';
        _later(() => {
          back.style.transition = `opacity ${d * 0.5}s ${ease}`;
          back.style.opacity = '1';
        }, d * 500);
        break;

      case 'fade-white':
        front.style.transition = `opacity ${d * 0.5}s ${ease}`;
        front.style.opacity = '0';
        back.style.opacity = '0';
        back.style.filter = 'brightness(5)';
        _later(() => {
          back.style.transition = `opacity ${d * 0.4}s ${ease}, filter ${d * 0.6}s ${ease}`;
          back.style.opacity = '1';
          back.style.filter = 'brightness(1)';
        }, d * 400);
        break;

      case 'dissolve':
        back.style.opacity = '0';
        _rAF(() => {
          back.style.transition = `opacity ${d * 1.5}s ${ease}`;
          back.style.opacity = '1';
          front.style.transition = `opacity ${d * 1.5}s ${ease}`;
          front.style.opacity = '0';
        });
        break;

      case 'crossfade':
        back.style.opacity = '0';
        _rAF(() => {
          back.style.transition = `opacity ${d}s linear`;
          back.style.opacity = '1';
          front.style.transition = `opacity ${d}s linear`;
          front.style.opacity = '0';
        });
        break;

      // ── Push ─────────────────────────────────────────────────────
      case 'push-left':
        back.style.opacity = '1';
        back.style.transform = 'translateX(100%)';
        _rAF(() => {
          const t = `transform ${d}s ${easeIO}`;
          front.style.transition = t;
          back.style.transition = t;
          front.style.transform = 'translateX(-100%)';
          back.style.transform = 'translateX(0)';
          _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000);
        });
        break;
      case 'push-right':
        back.style.opacity = '1';
        back.style.transform = 'translateX(-100%)';
        _rAF(() => {
          const t = `transform ${d}s ${easeIO}`;
          front.style.transition = t;
          back.style.transition = t;
          front.style.transform = 'translateX(100%)';
          back.style.transform = 'translateX(0)';
          _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000);
        });
        break;
      case 'push-up':
        back.style.opacity = '1';
        back.style.transform = 'translateY(100%)';
        _rAF(() => {
          const t = `transform ${d}s ${easeIO}`;
          front.style.transition = t;
          back.style.transition = t;
          front.style.transform = 'translateY(-100%)';
          back.style.transform = 'translateY(0)';
          _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000);
        });
        break;
      case 'push-down':
        back.style.opacity = '1';
        back.style.transform = 'translateY(-100%)';
        _rAF(() => {
          const t = `transform ${d}s ${easeIO}`;
          front.style.transition = t;
          back.style.transition = t;
          front.style.transform = 'translateY(100%)';
          back.style.transform = 'translateY(0)';
          _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000);
        });
        break;

      // ── Cover (new slides over old) ──────────────────────────────
      case 'cover-left':
        back.style.opacity = '1';
        back.style.transform = 'translateX(100%)';
        _rAF(() => {
          back.style.transition = `transform ${d}s ${easeIO}`;
          back.style.transform = 'translateX(0)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;
      case 'cover-right':
        back.style.opacity = '1';
        back.style.transform = 'translateX(-100%)';
        _rAF(() => {
          back.style.transition = `transform ${d}s ${easeIO}`;
          back.style.transform = 'translateX(0)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;
      case 'cover-up':
        back.style.opacity = '1';
        back.style.transform = 'translateY(100%)';
        _rAF(() => {
          back.style.transition = `transform ${d}s ${easeIO}`;
          back.style.transform = 'translateY(0)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;
      case 'cover-down':
        back.style.opacity = '1';
        back.style.transform = 'translateY(-100%)';
        _rAF(() => {
          back.style.transition = `transform ${d}s ${easeIO}`;
          back.style.transform = 'translateY(0)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;

      // ── Uncover (old slides away revealing new) ──────────────────
      case 'uncover-left':
        back.style.opacity = '1';
        _rAF(() => {
          front.style.transition = `transform ${d}s ${easeIO}`;
          front.style.transform = 'translateX(-100%)';
          _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000);
        });
        break;
      case 'uncover-right':
        back.style.opacity = '1';
        _rAF(() => {
          front.style.transition = `transform ${d}s ${easeIO}`;
          front.style.transform = 'translateX(100%)';
          _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000);
        });
        break;
      case 'uncover-up':
        back.style.opacity = '1';
        _rAF(() => {
          front.style.transition = `transform ${d}s ${easeIO}`;
          front.style.transform = 'translateY(-100%)';
          _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000);
        });
        break;
      case 'uncover-down':
        back.style.opacity = '1';
        _rAF(() => {
          front.style.transition = `transform ${d}s ${easeIO}`;
          front.style.transform = 'translateY(100%)';
          _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000);
        });
        break;

      // ── Wipe (clip-path reveal) ──────────────────────────────────
      case 'wipe-left':
        back.style.opacity = '1';
        back.style.clipPath = 'inset(0 100% 0 0)';
        _rAF(() => {
          back.style.transition = `clip-path ${d}s ${easeIO}`;
          back.style.clipPath = 'inset(0 0 0 0)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;
      case 'wipe-right':
        back.style.opacity = '1';
        back.style.clipPath = 'inset(0 0 0 100%)';
        _rAF(() => {
          back.style.transition = `clip-path ${d}s ${easeIO}`;
          back.style.clipPath = 'inset(0 0 0 0)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;
      case 'wipe-up':
        back.style.opacity = '1';
        back.style.clipPath = 'inset(100% 0 0 0)';
        _rAF(() => {
          back.style.transition = `clip-path ${d}s ${easeIO}`;
          back.style.clipPath = 'inset(0 0 0 0)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;
      case 'wipe-down':
        back.style.opacity = '1';
        back.style.clipPath = 'inset(0 0 100% 0)';
        _rAF(() => {
          back.style.transition = `clip-path ${d}s ${easeIO}`;
          back.style.clipPath = 'inset(0 0 0 0)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;

      // ── Split ────────────────────────────────────────────────────
      case 'split-horizontal-out':
        back.style.opacity = '1';
        back.style.clipPath = 'inset(50% 0 50% 0)';
        _rAF(() => {
          back.style.transition = `clip-path ${d}s ${easeIO}`;
          back.style.clipPath = 'inset(0 0 0 0)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;
      case 'split-horizontal-in':
        back.style.opacity = '1';
        front.style.clipPath = 'inset(0 0 0 0)';
        _rAF(() => {
          front.style.transition = `clip-path ${d}s ${easeIO}`;
          front.style.clipPath = 'inset(50% 0 50% 0)';
          _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000);
        });
        break;
      case 'split-vertical-out':
        back.style.opacity = '1';
        back.style.clipPath = 'inset(0 50% 0 50%)';
        _rAF(() => {
          back.style.transition = `clip-path ${d}s ${easeIO}`;
          back.style.clipPath = 'inset(0 0 0 0)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;
      case 'split-vertical-in':
        back.style.opacity = '1';
        front.style.clipPath = 'inset(0 0 0 0)';
        _rAF(() => {
          front.style.transition = `clip-path ${d}s ${easeIO}`;
          front.style.clipPath = 'inset(0 50% 0 50%)';
          _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000);
        });
        break;

      // ── Reveal (wipe + slide) ────────────────────────────────────
      case 'reveal-left':
        back.style.opacity = '1';
        back.style.clipPath = 'inset(0 100% 0 0)';
        _rAF(() => {
          back.style.transition = `clip-path ${d}s ${easeIO}`;
          front.style.transition = `transform ${d}s ${easeIO}`;
          back.style.clipPath = 'inset(0 0 0 0)';
          front.style.transform = 'translateX(-100%)';
          _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000);
        });
        break;
      case 'reveal-right':
        back.style.opacity = '1';
        back.style.clipPath = 'inset(0 0 0 100%)';
        _rAF(() => {
          back.style.transition = `clip-path ${d}s ${easeIO}`;
          front.style.transition = `transform ${d}s ${easeIO}`;
          back.style.clipPath = 'inset(0 0 0 0)';
          front.style.transform = 'translateX(100%)';
          _later(() => { front.style.opacity = '0'; _reset(front); }, d * 1000);
        });
        break;

      // ── Shape (clip-path polygons & circles) ─────────────────────
      case 'circle-in':
        back.style.opacity = '1';
        back.style.clipPath = 'circle(0% at 50% 50%)';
        _rAF(() => {
          back.style.transition = `clip-path ${d}s ${easeIO}`;
          back.style.clipPath = 'circle(75% at 50% 50%)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;
      case 'circle-out':
        back.style.opacity = '1';
        front.style.clipPath = 'circle(75% at 50% 50%)';
        _rAF(() => {
          front.style.transition = `clip-path ${d}s ${easeIO}`;
          front.style.clipPath = 'circle(0% at 50% 50%)';
          _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000);
        });
        break;
      case 'diamond-in':
        back.style.opacity = '1';
        back.style.clipPath = 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)';
        _rAF(() => {
          back.style.transition = `clip-path ${d}s ${easeIO}`;
          back.style.clipPath = 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)';
          _later(() => { front.style.opacity = '0'; }, d * 1000);
        });
        break;
      case 'diamond-out':
        back.style.opacity = '1';
        front.style.clipPath = 'polygon(50% -50%, 150% 50%, 50% 150%, -50% 50%)';
        _rAF(() => {
          front.style.transition = `clip-path ${d}s ${easeIO}`;
          front.style.clipPath = 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%)';
          _later(() => { front.style.opacity = '0'; front.style.clipPath = ''; }, d * 1000);
        });
        break;

      // ── Clock / Wedge (animated via JS keyframes) ────────────────
      case 'clock-cw':
      case 'clock-ccw':
      case 'wedge': {
        back.style.opacity = '1';
        const ccw = transition === 'clock-ccw';
        const isWedge = transition === 'wedge';
        const steps = 60;
        const stepTime = (d * 1000) / steps;
        let step = 0;
        _pvTrackedInterval((clockTimer) => {
          ++step;
          const progress = step / steps;
          if (isWedge) {
            const angle = progress * 180;
            back.style.clipPath = `polygon(50% 50%, ${50 + _clockX(angle)}% ${50 + _clockY(angle)}%, 50% 0%, ${50 + _clockX(-angle)}% ${50 + _clockY(-angle)}%)`;
            if (progress > 0.5)
              back.style.clipPath = `polygon(50% 50%, ${50 + _clockX(angle)}% ${50 + _clockY(angle)}%, ${50 + _clockX(angle - 30)}% ${50 + _clockY(angle - 30)}%, 50% 0%, ${50 + _clockX(-angle + 30)}% ${50 + _clockY(-angle + 30)}%, ${50 + _clockX(-angle)}% ${50 + _clockY(-angle)}%)`;
          } else {
            const angle = (ccw ? -1 : 1) * progress * 360;
            const pts = _clockPolygon(angle, ccw);
            back.style.clipPath = `polygon(${pts})`;
          }
          if (step >= steps) {
            _pvClearSubTimer(clockTimer);
            back.style.clipPath = '';
            front.style.opacity = '0';
          }
        }, stepTime);
        break;
      }

      // ── Blinds ───────────────────────────────────────────────────
      case 'blinds-horizontal': {
        back.style.opacity = '1';
        const n = 8;
        const h = 100 / n;
        back.style.clipPath = _blindsClip(n, true, 0);
        _rAF(() => {
          const steps = 30;
          const stepTime = (d * 1000) / steps;
          let step = 0;
          _pvTrackedInterval((timer) => {
            ++step;
            back.style.clipPath = _blindsClip(n, true, step / steps);
            if (step >= steps) {
              _pvClearSubTimer(timer);
              back.style.clipPath = '';
              front.style.opacity = '0';
            }
          }, stepTime);
        });
        break;
      }
      case 'blinds-vertical': {
        back.style.opacity = '1';
        back.style.clipPath = _blindsClip(10, false, 0);
        _rAF(() => {
          const steps = 30;
          const stepTime = (d * 1000) / steps;
          let step = 0;
          _pvTrackedInterval((timer) => {
            ++step;
            back.style.clipPath = _blindsClip(10, false, step / steps);
            if (step >= steps) {
              _pvClearSubTimer(timer);
              back.style.clipPath = '';
              front.style.opacity = '0';
            }
          }, stepTime);
        });
        break;
      }

      // ── Checkerboard ─────────────────────────────────────────────
      case 'checkerboard': {
        back.style.opacity = '1';
        const cols = 8, rows = 6;
        const cells = [];
        for (let r = 0; r < rows; ++r)
          for (let c = 0; c < cols; ++c)
            cells.push({ r, c, delay: ((r + c) % 2) * 0.3 + Math.random() * 0.4 });
        cells.sort((a, b) => a.delay - b.delay);
        const cw = 100 / cols, ch = 100 / rows;
        const revealed = new Set();
        const steps = 20;
        const stepTime = (d * 1000) / steps;
        let step = 0;
        _pvTrackedInterval((timer) => {
          ++step;
          const progress = step / steps;
          for (const cell of cells)
            if (progress >= cell.delay / 1.1 && !revealed.has(`${cell.r},${cell.c}`))
              revealed.add(`${cell.r},${cell.c}`);
          back.style.clipPath = _checkerClip(cols, rows, cw, ch, revealed);
          if (step >= steps) {
            _pvClearSubTimer(timer);
            back.style.clipPath = '';
            front.style.opacity = '0';
          }
        }, stepTime);
        break;
      }

      // ── Comb ─────────────────────────────────────────────────────
      case 'comb-horizontal': {
        back.style.opacity = '1';
        const n = 10;
        const stepTime = (d * 1000) / 30;
        let step = 0;
        _pvTrackedInterval((timer) => {
          ++step;
          const p = step / 30;
          back.style.clipPath = _combClip(n, true, p);
          if (step >= 30) {
            _pvClearSubTimer(timer);
            back.style.clipPath = '';
            front.style.opacity = '0';
          }
        }, stepTime);
        break;
      }
      case 'comb-vertical': {
        back.style.opacity = '1';
        const n = 8;
        const stepTime = (d * 1000) / 30;
        let step = 0;
        _pvTrackedInterval((timer) => {
          ++step;
          const p = step / 30;
          back.style.clipPath = _combClip(n, false, p);
          if (step >= 30) {
            _pvClearSubTimer(timer);
            back.style.clipPath = '';
            front.style.opacity = '0';
          }
        }, stepTime);
        break;
      }

      // ── Pixelate ─────────────────────────────────────────────────
      case 'pixelate':
        back.style.opacity = '0'; back.style.filter = 'blur(20px)'; front.style.filter = 'blur(0px)';
        _rAF(() => {
          front.style.transition = `filter ${d * 0.4}s ${ease}`;
          front.style.filter = 'blur(20px)';
          _later(() => {
            front.style.transition = `opacity ${d * 0.2}s ${ease}`;
            front.style.opacity = '0';
            back.style.transition = `opacity ${d * 0.2}s ${ease}`;
            back.style.opacity = '1';
            _later(() => {
              back.style.transition = `filter ${d * 0.4}s ${ease}`;
              back.style.filter = 'blur(0px)';
            }, d * 200);
          }, d * 400);
        });
        break;

      // ── Random Bars ──────────────────────────────────────────────
      case 'bars-random': {
        back.style.opacity = '1';
        const n = 20;
        const order = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; --i) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
        const bw = 100 / n;
        const revealed = new Set();
        const steps = n;
        const stepTime = (d * 1000) / steps;
        let step = 0;
        _pvTrackedInterval((timer) => {
          revealed.add(order[step]);
          ++step;
          const rects = [];
          for (const idx of revealed) {
            const x = idx * bw;
            rects.push(`${x}% 0%, ${x + bw}% 0%, ${x + bw}% 100%, ${x}% 100%`);
          }
          back.style.clipPath = rects.length ? `polygon(evenodd, ${rects.join(', ')})` : '';
          if (step >= steps) {
            _pvClearSubTimer(timer);
            back.style.clipPath = '';
            front.style.opacity = '0';
          }
        }, stepTime);
        break;
      }

      // ── Zoom & Spin ──────────────────────────────────────────────
      case 'zoom-in':
        back.style.opacity = '0';
        back.style.transform = 'scale(1.5)';
        _rAF(() => {
          back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${ease}`;
          back.style.opacity = '1';
          back.style.transform = 'scale(1)';
          front.style.transition = `opacity ${d}s ${ease}`;
          front.style.opacity = '0';
        });
        break;
      case 'zoom-out':
        back.style.opacity = '0';
        back.style.transform = 'scale(0.5)';
        _rAF(() => {
          back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${ease}`;
          back.style.opacity = '1';
          back.style.transform = 'scale(1)';
          front.style.transition = `opacity ${d * 0.8}s ${ease}, transform ${d}s ${ease}`;
          front.style.opacity = '0';
          front.style.transform = 'scale(1.5)';
          _later(() => _reset(front), d * 1000);
        });
        break;
      case 'zoom-rotate':
        back.style.opacity = '0';
        back.style.transform = 'scale(0.3) rotate(90deg)';
        _rAF(() => {
          back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${ease}`;
          back.style.opacity = '1';
          back.style.transform = 'scale(1) rotate(0deg)';
          front.style.transition = `opacity ${d * 0.7}s ${ease}, transform ${d}s ${ease}`;
          front.style.opacity = '0';
          front.style.transform = 'scale(2) rotate(-45deg)';
          _later(() => _reset(front), d * 1000);
        });
        break;
      case 'spin-cw':
        back.style.opacity = '0';
        back.style.transform = 'rotate(-180deg) scale(0.5)';
        _rAF(() => {
          back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${easeIO}`;
          back.style.opacity = '1';
          back.style.transform = 'rotate(0deg) scale(1)';
          front.style.transition = `opacity ${d * 0.6}s ${ease}`;
          front.style.opacity = '0';
        });
        break;
      case 'spin-ccw':
        back.style.opacity = '0';
        back.style.transform = 'rotate(180deg) scale(0.5)';
        _rAF(() => {
          back.style.transition = `opacity ${d}s ${ease}, transform ${d}s ${easeIO}`;
          back.style.opacity = '1';
          back.style.transform = 'rotate(0deg) scale(1)';
          front.style.transition = `opacity ${d * 0.6}s ${ease}`;
          front.style.opacity = '0';
        });
        break;

      // ── 3D-like (perspective transforms) ─────────────────────────
      case 'flip-horizontal':
        back.style.opacity = '0';
        front.style.transformOrigin = '50% 50%';
        back.style.transformOrigin = '50% 50%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${ease}, opacity ${d * 0.5}s ${ease}`;
          front.style.transform = 'perspective(800px) rotateY(90deg)';
          front.style.opacity = '0';
          _later(() => {
            back.style.transform = 'perspective(800px) rotateY(-90deg)';
            back.style.opacity = '1';
            back.style.transition = `transform ${d * 0.5}s ${ease}`;
            _rAF(() => { back.style.transform = 'perspective(800px) rotateY(0deg)'; });
          }, d * 500);
        });
        break;
      case 'flip-vertical':
        back.style.opacity = '0';
        front.style.transformOrigin = '50% 50%';
        back.style.transformOrigin = '50% 50%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${ease}, opacity ${d * 0.5}s ${ease}`;
          front.style.transform = 'perspective(800px) rotateX(-90deg)';
          front.style.opacity = '0';
          _later(() => {
            back.style.transform = 'perspective(800px) rotateX(90deg)';
            back.style.opacity = '1';
            back.style.transition = `transform ${d * 0.5}s ${ease}`;
            _rAF(() => { back.style.transform = 'perspective(800px) rotateX(0deg)'; });
          }, d * 500);
        });
        break;
      case 'cube-left':
        back.style.opacity = '0';
        front.style.transformOrigin = '100% 50%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${easeIO}`;
          front.style.transform = 'perspective(800px) rotateY(90deg)';
          _later(() => {
            front.style.opacity = '0';
            back.style.transformOrigin = '0% 50%';
            back.style.transform = 'perspective(800px) rotateY(-90deg)';
            back.style.opacity = '1';
            back.style.transition = `transform ${d * 0.5}s ${easeIO}`;
            _rAF(() => { back.style.transform = 'perspective(800px) rotateY(0deg)'; });
          }, d * 500);
        });
        break;
      case 'cube-right':
        back.style.opacity = '0';
        front.style.transformOrigin = '0% 50%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${easeIO}`;
          front.style.transform = 'perspective(800px) rotateY(-90deg)';
          _later(() => {
            front.style.opacity = '0';
            back.style.transformOrigin = '100% 50%';
            back.style.transform = 'perspective(800px) rotateY(90deg)';
            back.style.opacity = '1';
            back.style.transition = `transform ${d * 0.5}s ${easeIO}`;
            _rAF(() => { back.style.transform = 'perspective(800px) rotateY(0deg)'; });
          }, d * 500);
        });
        break;
      case 'cube-up':
        back.style.opacity = '0';
        front.style.transformOrigin = '50% 100%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${easeIO}`;
          front.style.transform = 'perspective(800px) rotateX(-90deg)';
          _later(() => {
            front.style.opacity = '0';
            back.style.transformOrigin = '50% 0%';
            back.style.transform = 'perspective(800px) rotateX(90deg)';
            back.style.opacity = '1';
            back.style.transition = `transform ${d * 0.5}s ${easeIO}`;
            _rAF(() => { back.style.transform = 'perspective(800px) rotateX(0deg)'; });
          }, d * 500);
        });
        break;
      case 'cube-down':
        back.style.opacity = '0';
        front.style.transformOrigin = '50% 0%';
        _rAF(() => {
          front.style.transition = `transform ${d * 0.5}s ${easeIO}`;
          front.style.transform = 'perspective(800px) rotateX(90deg)';
          _later(() => {
            front.style.opacity = '0';
            back.style.transformOrigin = '50% 100%';
            back.style.transform = 'perspective(800px) rotateX(-90deg)';
            back.style.opacity = '1';
            back.style.transition = `transform ${d * 0.5}s ${easeIO}`;
            _rAF(() => { back.style.transform = 'perspective(800px) rotateX(0deg)'; });
          }, d * 500);
        });
        break;

      // ── Effects ──────────────────────────────────────────────────
      case 'blur':
        back.style.opacity = '0'; back.style.filter = 'blur(30px)'; front.style.filter = 'blur(0px)';
        _rAF(() => {
          front.style.transition = `filter ${d * 0.4}s ${ease}`;
          front.style.filter = 'blur(30px)';
          _later(() => {
            front.style.transition = `opacity ${d * 0.2}s ${ease}`;
            front.style.opacity = '0';
            back.style.transition = `opacity ${d * 0.2}s ${ease}`;
            back.style.opacity = '1';
            _later(() => {
              back.style.transition = `filter ${d * 0.4}s ${ease}`;
              back.style.filter = 'blur(0px)';
            }, d * 200);
          }, d * 400);
        });
        break;
      case 'glitch': {
        back.style.opacity = '1';
        const steps = 12;
        const stepTime = (d * 1000) / steps;
        let step = 0;
        _pvTrackedInterval((timer) => {
          ++step;
          const rx = (Math.random() - 0.5) * 10;
          const ry = (Math.random() - 0.5) * 6;
          const skew = (Math.random() - 0.5) * 5;
          const show = Math.random() > step / steps;
          front.style.transform = `translate(${rx}px, ${ry}px) skewX(${skew}deg)`;
          front.style.opacity = show ? '1' : '0';
          front.style.filter = show ? `hue-rotate(${Math.random() * 90}deg) saturate(${1 + Math.random() * 2})` : '';
          if (step >= steps) {
            _pvClearSubTimer(timer);
            front.style.opacity = '0';
            _reset(front);
          }
        }, stepTime);
        break;
      }
      case 'morph':
        back.style.opacity = '0';
        back.style.transform = 'scale(1.1)';
        back.style.filter = 'blur(10px) brightness(1.2)';
        _rAF(() => {
          const t = `opacity ${d}s ${ease}, transform ${d}s ${ease}, filter ${d}s ${ease}`;
          front.style.transition = t;
          front.style.opacity = '0';
          front.style.transform = 'scale(0.95)';
          front.style.filter = 'blur(10px) brightness(1.2)';
          back.style.transition = t;
          back.style.opacity = '1';
          back.style.transform = 'scale(1)';
          back.style.filter = 'blur(0px) brightness(1)';
          _later(() => _reset(front), d * 1000);
        });
        break;

      // ── Default / fade ───────────────────────────────────────────
      case 'fade':
      default:
        back.style.opacity = '0';
        _rAF(() => {
          back.style.transition = `opacity ${d}s ${ease}`;
          back.style.opacity = '1';
          front.style.transition = `opacity ${d}s ${ease}`;
          front.style.opacity = '0';
        });
        break;
    }
  }

  // ── Transition helper functions ──────────────────────────────────

  function _clockX(angleDeg) {
    return Math.sin(angleDeg * Math.PI / 180) * 75;
  }

  function _clockY(angleDeg) {
    return -Math.cos(angleDeg * Math.PI / 180) * 75;
  }

  function _clockPolygon(angle, ccw) {
    const pts = ['50% 50%', '50% 0%'];
    const a = ccw ? -angle : angle;
    const absA = Math.abs(a);
    if (absA > 45) pts.push(ccw ? '0% 0%' : '100% 0%');
    if (absA > 135) pts.push(ccw ? '0% 100%' : '100% 100%');
    if (absA > 225) pts.push(ccw ? '100% 100%' : '0% 100%');
    if (absA > 315) pts.push(ccw ? '100% 0%' : '0% 0%');
    const ex = 50 + _clockX(a);
    const ey = 50 + _clockY(a);
    pts.push(`${ex}% ${ey}%`);
    return pts.join(', ');
  }

  function _blindsClip(n, horizontal, progress) {
    const rects = [];
    const size = 100 / n;
    for (let i = 0; i < n; ++i) {
      const start = i * size;
      const revealed = size * progress;
      if (horizontal)
        rects.push(`${0}% ${start}%, ${100}% ${start}%, ${100}% ${start + revealed}%, ${0}% ${start + revealed}%`);
      else
        rects.push(`${start}% ${0}%, ${start + revealed}% ${0}%, ${start + revealed}% ${100}%, ${start}% ${100}%`);
    }
    return `polygon(evenodd, ${rects.join(', ')})`;
  }

  function _checkerClip(cols, rows, cw, ch, revealed) {
    if (revealed.size === 0) return 'polygon(0 0, 0 0, 0 0)';
    const rects = [];
    for (const key of revealed) {
      const [r, c] = key.split(',').map(Number);
      const x = c * cw, y = r * ch;
      rects.push(`${x}% ${y}%, ${x + cw}% ${y}%, ${x + cw}% ${y + ch}%, ${x}% ${y + ch}%`);
    }
    return `polygon(evenodd, ${rects.join(', ')})`;
  }

  function _combClip(n, horizontal, progress) {
    const rects = [];
    const size = 100 / n;
    for (let i = 0; i < n; ++i) {
      const start = i * size;
      const fromLeft = i % 2 === 0;
      if (horizontal) {
        const revealed = 100 * progress;
        const x0 = fromLeft ? 0 : 100 - revealed;
        const x1 = fromLeft ? revealed : 100;
        rects.push(`${x0}% ${start}%, ${x1}% ${start}%, ${x1}% ${start + size}%, ${x0}% ${start + size}%`);
      } else {
        const revealed = 100 * progress;
        const y0 = fromLeft ? 0 : 100 - revealed;
        const y1 = fromLeft ? revealed : 100;
        rects.push(`${start}% ${y0}%, ${start + size}% ${y0}%, ${start + size}% ${y1}%, ${start}% ${y1}%`);
      }
    }
    return `polygon(evenodd, ${rects.join(', ')})`;
  }

  function _stopSlideshowPreview() {
    // Cancel pending transition timers/RAFs
    for (const id of _pvPendingLaters) clearTimeout(id);
    for (const id of _pvPendingRAFs) cancelAnimationFrame(id);
    _pvPendingLaters.length = 0;
    _pvPendingRAFs.length = 0;
    if (_pvSlideshowTimer) {
      clearTimeout(_pvSlideshowTimer);
      _pvSlideshowTimer = null;
    }
    _pvClearAllSubTimers();
    _pvSlideshowImages = [];
    _pvPreloadPromise = null;
    _revokeLocalBlobs();
    for (const el of [pvBgImg, pvBgImgAlt]) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.clipPath = '';
      el.style.filter = '';
      el.style.opacity = '';
      el.style.transformOrigin = '';
      el.style.zIndex = '';
    }
    pvBgImgAlt.style.display = 'none';
    pvBgImgAlt.src = '';
  }

  // Source type switching via subtabs
  function _switchBgSource(type) {
    bgSourceTypeEl.value = type;
    for (const panel of document.querySelectorAll('.source-panel'))
      panel.classList.toggle('active', panel.id === 'source-' + type);
    for (const st of document.querySelectorAll('.bg-subtabs .subtab')) {
      const isActive = st.dataset.bgtab === type;
      st.classList.toggle('active', isActive);
      const chk = st.querySelector('.bg-source-chk');
      if (chk) chk.checked = isActive;
    }

    if (selectedBg.sourceType === 'slideshow' && type !== 'slideshow')
      _stopSlideshowPreview();

    selectedBg.sourceType = type;

    if (type === 'online') {
      document.getElementById('online-unavailable').style.display = onlineServicesAvailable ? 'none' : '';
      document.getElementById('online-controls').style.display = onlineServicesAvailable ? '' : 'none';
    }

    updateBgPreview();
    dirty = true;
  }

  for (const st of document.querySelectorAll('.bg-subtabs .subtab'))
    st.addEventListener('click', () => _switchBgSource(st.dataset.bgtab));

  bgSourceTypeEl.addEventListener('change', () => _switchBgSource(bgSourceTypeEl.value));

  bgModeEl.addEventListener('change', async () => {
    selectedBg.mode = bgModeEl.value;
    await updateBgPreview();
    dirty = true;
  });

  // Base color picker — launches color-picker app
  let colorPickerRequest = null;

  function updateBgColorSwatch() {
    bgColorSwatch.style.backgroundColor = bgBaseColorEl.value || '#3A6EA5';
  }
  updateBgColorSwatch();

  function setBgBaseColor(hex) {
    bgBaseColorEl.value = hex;
    selectedBg.baseColor = hex;
    updateBgColorSwatch();
    updateBgPreview();
    dirty = true;
  }

  bgColorSwatch.addEventListener('click', () => {
    const returnKey = 'sz:control-panel:colorpick:' + Date.now() + ':' + Math.random().toString(36).slice(2);
    colorPickerRequest = { returnKey };
    try {
      SZ.Dlls.User32.PostMessage('sz:launchApp', {
        appId: 'color-picker',
        urlParams: { returnKey, hex: bgBaseColorEl.value || '#3A6EA5' }
      });
    } catch (_) {
      colorPickerRequest = null;
    }
  });

  window.addEventListener('storage', (e) => {
    if (!colorPickerRequest || !e || e.key !== colorPickerRequest.returnKey || !e.newValue)
      return;
    let payload = null;
    try { payload = JSON.parse(e.newValue); } catch { return; }
    if (!payload || payload.type !== 'color-picker-result')
      return;
    const r = Math.max(0, Math.min(255, payload.r || 0));
    const g = Math.max(0, Math.min(255, payload.g || 0));
    const b = Math.max(0, Math.min(255, payload.b || 0));
    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    setBgBaseColor(hex);
    try { localStorage.removeItem(colorPickerRequest.returnKey); } catch {}
    colorPickerRequest = null;
  });

  // Pattern checkbox
  chkPattern.addEventListener('change', () => {
    btnEditPattern.disabled = !chkPattern.checked;
    if (!chkPattern.checked)
      selectedBg.pattern = null;
    updateBgPreview();
    dirty = true;
  });

  // -- Pattern editor -------------------------------------------------------

  btnEditPattern.addEventListener('click', () => {
    _openPatternEditor();
  });

  function _openPatternEditor() {
    const existing = selectedBg.pattern;
    patternWidth = existing?.width || 8;
    patternHeight = existing?.height || 8;
    patternFgColorEl.value = existing?.fg || '#FFFFFF';
    patternWidthEl.value = patternWidth;
    patternHeightEl.value = patternHeight;

    // Decode bits into array
    patternBits = new Uint8Array(patternWidth * patternHeight);
    if (existing?.bits) {
      const bitString = existing.bits.split('').map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
      for (let i = 0; i < patternBits.length && i < bitString.length; ++i)
        patternBits[i] = bitString[i] === '1' ? 1 : 0;
    }

    _renderPatternPresets();
    _drawPatternGrid();
    document.getElementById('dlg-pattern').classList.add('visible');
  }

  function _renderPatternPresets() {
    patternPresetsEl.innerHTML = '';
    for (const preset of PATTERN_PRESETS) {
      const li = document.createElement('li');
      li.textContent = preset.name;
      li.addEventListener('click', () => {
        if (!preset.bits) {
          patternBits = new Uint8Array(patternWidth * patternHeight);
        } else {
          patternWidth = preset.w;
          patternHeight = preset.h;
          patternWidthEl.value = preset.w;
          patternHeightEl.value = preset.h;
          patternFgColorEl.value = preset.fg;
          patternBits = new Uint8Array(patternWidth * patternHeight);
          const bitString = preset.bits.split('').map(c => parseInt(c, 16).toString(2).padStart(4, '0')).join('');
          for (let i = 0; i < patternBits.length && i < bitString.length; ++i)
            patternBits[i] = bitString[i] === '1' ? 1 : 0;
        }
        _drawPatternGrid();
        for (const l of patternPresetsEl.querySelectorAll('li'))
          l.classList.toggle('selected', l === li);
      });
      patternPresetsEl.appendChild(li);
    }
  }

  function _drawPatternGrid() {
    if (!patternCtx) return;
    const cw = patternCanvas.width;
    const ch = patternCanvas.height;
    patternCtx.clearRect(0, 0, cw, ch);

    const cellW = Math.floor(cw / patternWidth);
    const cellH = Math.floor(ch / patternHeight);
    const cellSize = Math.min(cellW, cellH, 24);

    const offsetX = Math.floor((cw - cellSize * patternWidth) / 2);
    const offsetY = Math.floor((ch - cellSize * patternHeight) / 2);

    const fg = patternFgColorEl.value;
    const bg = bgBaseColorEl.value;

    for (let y = 0; y < patternHeight; ++y)
      for (let x = 0; x < patternWidth; ++x) {
        const bit = patternBits[y * patternWidth + x];
        patternCtx.fillStyle = bit ? fg : bg;
        patternCtx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        patternCtx.strokeStyle = '#666';
        patternCtx.lineWidth = 0.5;
        patternCtx.strokeRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
      }

    // Store grid layout for click handling
    patternCanvas._gridInfo = { offsetX, offsetY, cellSize };
  }

  // Pattern canvas click/drag
  let _patternPainting = false;
  let _patternPaintValue = 1;

  patternCanvas.addEventListener('pointerdown', (e) => {
    _patternPainting = true;
    const pos = _getPatternCell(e);
    if (pos) {
      _patternPaintValue = patternBits[pos.y * patternWidth + pos.x] ? 0 : 1;
      patternBits[pos.y * patternWidth + pos.x] = _patternPaintValue;
      _drawPatternGrid();
    }
    patternCanvas.setPointerCapture(e.pointerId);
  });

  patternCanvas.addEventListener('pointermove', (e) => {
    if (!_patternPainting) return;
    const pos = _getPatternCell(e);
    if (pos) {
      patternBits[pos.y * patternWidth + pos.x] = _patternPaintValue;
      _drawPatternGrid();
    }
  });

  patternCanvas.addEventListener('pointerup', () => { _patternPainting = false; });

  function _getPatternCell(e) {
    const rect = patternCanvas.getBoundingClientRect();
    const scaleX = patternCanvas.width / rect.width;
    const scaleY = patternCanvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    const info = patternCanvas._gridInfo;
    if (!info) return null;
    const x = Math.floor((px - info.offsetX) / info.cellSize);
    const y = Math.floor((py - info.offsetY) / info.cellSize);
    if (x < 0 || x >= patternWidth || y < 0 || y >= patternHeight) return null;
    return { x, y };
  }

  // Pattern width/height changes
  patternWidthEl.addEventListener('change', () => {
    const nw = parseInt(patternWidthEl.value, 10) || 8;
    const oldBits = patternBits;
    const oldW = patternWidth;
    patternWidth = Math.max(1, Math.min(16, nw));
    patternWidthEl.value = patternWidth;
    patternBits = new Uint8Array(patternWidth * patternHeight);
    for (let y = 0; y < patternHeight; ++y)
      for (let x = 0; x < Math.min(patternWidth, oldW); ++x)
        patternBits[y * patternWidth + x] = oldBits[y * oldW + x] || 0;
    _drawPatternGrid();
  });

  patternHeightEl.addEventListener('change', () => {
    const nh = parseInt(patternHeightEl.value, 10) || 8;
    const oldBits = patternBits;
    const oldH = patternHeight;
    patternHeight = Math.max(1, Math.min(16, nh));
    patternHeightEl.value = patternHeight;
    patternBits = new Uint8Array(patternWidth * patternHeight);
    for (let y = 0; y < Math.min(patternHeight, oldH); ++y)
      for (let x = 0; x < patternWidth; ++x)
        patternBits[y * patternWidth + x] = oldBits[y * patternWidth + x] || 0;
    _drawPatternGrid();
  });

  patternFgColorEl.addEventListener('input', () => _drawPatternGrid());

  // Pattern dialog OK/Cancel
  document.getElementById('dlg-pattern')?.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-result]');
    if (!btn) return;
    this.classList.remove('visible');
    if (btn.dataset.result === 'ok') {
      // Encode bits to hex
      const totalBits = patternWidth * patternHeight;
      let binStr = '';
      for (let i = 0; i < totalBits; ++i)
        binStr += patternBits[i] ? '1' : '0';
      // Pad to multiple of 4
      while (binStr.length % 4 !== 0)
        binStr += '0';
      let hexStr = '';
      for (let i = 0; i < binStr.length; i += 4)
        hexStr += parseInt(binStr.substring(i, i + 4), 2).toString(16).toUpperCase();
      selectedBg.pattern = { width: patternWidth, height: patternHeight, fg: patternFgColorEl.value, bits: hexStr };
      chkPattern.checked = true;
      btnEditPattern.disabled = false;
      updateBgPreview();
      dirty = true;
    }
  });

  // -- Slideshow controls ---------------------------------------------------

  slideshowIntervalEl.addEventListener('input', () => {
    slideshowIntervalValueEl.textContent = slideshowIntervalEl.value + 's';
    dirty = true;
  });

  slideshowDurationEl.addEventListener('input', () => {
    slideshowDurationValueEl.textContent = parseFloat(slideshowDurationEl.value).toFixed(1) + 's';
    dirty = true;
  });

  slideshowTransitionEl.addEventListener('change', () => {
    if (bgSourceTypeEl.value === 'slideshow' && slideshowFolderEl.value)
      _startSlideshowPreview();
    dirty = true;
  });

  slideshowModeEl.addEventListener('change', () => {
    if (bgSourceTypeEl.value === 'slideshow' && slideshowFolderEl.value)
      _startSlideshowPreview();
    dirty = true;
  });

  chkSlideshowRecursive.addEventListener('change', () => {
    if (bgSourceTypeEl.value === 'slideshow' && slideshowFolderEl.value)
      _startSlideshowPreview();
    dirty = true;
  });

  document.getElementById('btn-slideshow-browse')?.addEventListener('click', async () => {
    const result = await SZ.Dlls.ComDlg32.BrowseForFolder({ title: 'Select Slideshow Folder' });
    if (result && !result.cancelled && result.path) {
      slideshowFolderEl.value = result.path;
      if (bgSourceTypeEl.value === 'slideshow')
        _startSlideshowPreview();
      dirty = true;
    }
  });

  // -- Video controls -------------------------------------------------------

  videoSpeedEl.addEventListener('input', () => {
    videoSpeedValueEl.textContent = parseFloat(videoSpeedEl.value).toFixed(2) + 'x';
    dirty = true;
  });

  document.getElementById('btn-video-browse')?.addEventListener('click', async () => {
    const result = await SZ.Dlls.ComDlg32.GetOpenFileName({
      title: 'Select Video File',
      filters: [
        { name: 'Video Files', extensions: ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'mkv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result && !result.cancelled && result.path) {
      videoFileEl.value = result.path;
      updateBgPreview();
      dirty = true;
    }
    input.click();
  });

  // -- Online service controls -----------------------------------------------

  const ONLINE_SERVICES = {
    picsum: {
      name: 'Lorem Picsum',
      supportsList: true,
      supportsQuery: false,
      fetchList: async () => {
        const resp = await fetch('https://picsum.photos/v2/list?page=' + Math.floor(Math.random() * 10 + 1) + '&limit=12');
        const data = await resp.json();
        return data.map(item => ({
          thumb: `https://picsum.photos/id/${item.id}/120/90`,
          full: `https://picsum.photos/id/${item.id}/1920/1080`,
          author: item.author,
        }));
      },
      fetchSingle: async () => {
        return `https://picsum.photos/1920/1080?random=${Date.now()}`;
      },
    },
    nasa: {
      name: 'NASA APOD',
      supportsList: false,
      supportsQuery: false,
      fetchSingle: async () => {
        const resp = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
        const data = await resp.json();
        return data.hdurl || data.url;
      },
    },
    bing: {
      name: 'Bing Daily',
      supportsList: true,
      supportsQuery: false,
      fetchList: async () => {
        // Bing HPImageArchive API is CORS-blocked; use the peapix.com wrapper
        try {
          const resp = await fetch('https://peapix.com/bing/feed?country=us');
          const data = await resp.json();
          return (data || []).slice(0, 8).map(item => ({
            thumb: item.thumbUrl || item.imageUrl,
            full: item.fullUrl || item.imageUrl,
            author: item.title || '',
          }));
        } catch {
          // Fallback: direct Bing thumbnail URLs for recent days
          const results = [];
          for (let i = 0; i < 4; ++i)
            results.push({
              thumb: `https://www.bing.com/th?id=OHR.Random${i}_EN-US&w=320&h=180`,
              full: `https://www.bing.com/th?id=OHR.Random${i}_EN-US&w=1920&h=1080`,
            });
          return results;
        }
      },
      fetchSingle: async () => {
        try {
          const resp = await fetch('https://peapix.com/bing/feed?country=us');
          const data = await resp.json();
          if (data?.length)
            return data[0].fullUrl || data[0].imageUrl;
        } catch { /* fall through */ }
        return 'https://www.bing.com/th?id=OHR.DefaultImage_EN-US&w=1920&h=1080';
      },
    },
    giphy: {
      name: 'Giphy',
      supportsList: true,
      supportsQuery: true,
      fetchList: async (query) => {
        const q = encodeURIComponent(query || 'nature');
        const resp = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=dc6zaTOxFJmzC&q=${q}&limit=12&rating=g`);
        const data = await resp.json();
        return (data.data || []).map(item => ({
          thumb: item.images.fixed_height_small.url,
          full: item.images.original.url,
        }));
      },
    },
  };

  onlineServiceEl.addEventListener('change', () => {
    const service = ONLINE_SERVICES[onlineServiceEl.value];
    const filterRow = document.getElementById('online-filter-row');
    if (filterRow)
      filterRow.style.display = service?.supportsQuery ? '' : 'none';
    onlineThumbnailsEl.innerHTML = '';
    dirty = true;
  });

  document.getElementById('btn-online-fetch')?.addEventListener('click', async () => {
    const serviceKey = onlineServiceEl.value;
    const service = ONLINE_SERVICES[serviceKey];
    if (!service) return;

    const btn = document.getElementById('btn-online-fetch');
    btn.disabled = true;
    btn.textContent = 'Fetching...';

    try {
      if (service.supportsList) {
        const items = await service.fetchList(onlineQueryEl.value);
        onlineThumbnailsEl.innerHTML = '';
        for (const item of items) {
          const img = document.createElement('img');
          img.className = 'online-thumb';
          img.src = item.thumb;
          img.title = item.author || '';
          img.addEventListener('click', () => {
            for (const t of onlineThumbnailsEl.querySelectorAll('.online-thumb'))
              t.classList.remove('selected');
            img.classList.add('selected');
            selectedBg.online = { ...(selectedBg.online || {}), service: serviceKey, cachedUrl: item.full };
            _showPreviewImage(item.full, onlineModeEl.value);
            dirty = true;
          });
          onlineThumbnailsEl.appendChild(img);
        }
      } else {
        const url = await service.fetchSingle();
        selectedBg.online = { ...(selectedBg.online || {}), service: serviceKey, cachedUrl: url };
        onlineThumbnailsEl.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'online-thumb selected';
        img.src = url;
        img.style.width = '120px';
        img.style.height = '90px';
        onlineThumbnailsEl.appendChild(img);
        _showPreviewImage(url, onlineModeEl.value);
        dirty = true;
      }
    } catch (err) {
      console.error('Online fetch error:', err);
      onlineThumbnailsEl.innerHTML = '<span style="font-size:10px;color:red;">Fetch failed: ' + err.message + '</span>';
    }

    btn.disabled = false;
    btn.textContent = 'Fetch Now';
  });

  onlineModeEl.addEventListener('change', () => {
    updateBgPreview();
    dirty = true;
  });

  // -- Browse for custom background ----------------------------------------
  document.getElementById('btn-bg-browse').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        const name = file.name;
        const existing = availableBackgrounds.find(b => b.name === name);
        if (!existing)
          availableBackgrounds.push({ name, src: dataUrl });
        selectedBg.src = dataUrl;
        renderBackgroundList();
        await updateBgPreview();
        dirty = true;
      };
      reader.readAsDataURL(file);
    });
    input.click();
  });

  // -- Apply / OK / Cancel --------------------------------------------------
  function applySkin() {
    if (!selectedSkinName)
      return;
    const skinChanged = selectedSkinName !== currentSkinName;
    const subSkinChanged = selectedSubSkin !== currentSubSkin;
    if (skinChanged || subSkinChanged) {
      const msg = { skinName: selectedSkinName };
      if (selectedSubSkin)
        msg.subSkin = selectedSubSkin;
      SZ.Dlls.User32.PostMessage('sz:setSkin', msg);
      currentSkinName = selectedSkinName;
      currentSubSkin = selectedSubSkin;
    }
  }

  function applyBackground() {
    _stopSlideshowPreview(); // stop preview — the desktop engine takes over
    const sourceType = bgSourceTypeEl.value;
    const mode = sourceType === 'slideshow' ? slideshowModeEl.value
      : sourceType === 'online' ? onlineModeEl.value
      : bgModeEl.value;

    const bgSettings = {
      baseColor: bgBaseColorEl.value || '#3A6EA5',
      pattern: chkPattern.checked ? selectedBg.pattern : null,
      sourceType,
      src: selectedBg.src || '',
      mode,
    };

    if (sourceType === 'slideshow')
      bgSettings.slideshow = {
        folder: slideshowFolderEl.value,
        interval: parseInt(slideshowIntervalEl.value, 10) || 30,
        shuffle: chkSlideshowShuffle.checked,
        recursive: chkSlideshowRecursive.checked,
        transition: slideshowTransitionEl.value,
        transitionDuration: parseFloat(slideshowDurationEl.value) || 1,
      };

    if (sourceType === 'video')
      bgSettings.video = {
        src: videoFileEl.value,
        loop: chkVideoLoop.checked,
        playbackRate: parseFloat(videoSpeedEl.value) || 1,
      };

    if (sourceType === 'online')
      bgSettings.online = selectedBg.online || null;

    SZ.Dlls.User32.PostMessage('sz:setBackground', bgSettings);
  }

  function applyAll() {
    applySkin();
    applyBackground();
    dirty = false;
  }

  document.getElementById('btn-apply').addEventListener('click', applyAll);

  document.getElementById('btn-ok').addEventListener('click', () => {
    applyAll();
    SZ.Dlls.User32.DestroyWindow();
  });

  document.getElementById('btn-cancel').addEventListener('click', () => {
    SZ.Dlls.User32.DestroyWindow();
  });

  // -- Receive settings from parent ----------------------------------------
  async function requestSettings() {
    try {
      const data = await SZ.Dlls.User32.SendMessage('sz:getSettings');
      handleSettings(data);
    } catch (_) {
      // timeout or error
    }
  }

  async function handleSettings(data) {
    if (!data) return;

    allSkins = data.availableSkins || [];
    currentSkinName = data.skin || '';
    currentSubSkin = data.subSkin || '';
    selectedSkinName = currentSkinName;
    selectedSubSkin = currentSubSkin;

    renderSkinList();
    renderThemeList();

    // Find and preview current skin (with sub-skin applied)
    const curSkin = allSkins.find(s => s.id === currentSkinName);
    if (curSkin) {
      // Populate sub-skin dropdown for the current skin
      _populateSubSkinDropdown(curSkin, currentSubSkin);

      // Preview with sub-skin colors applied
      updatePreviewWithSubSkin(curSkin, currentSubSkin);
      updateFontInfo(curSkin);
      const resolvedColors = resolveSubSkinColors(curSkin, currentSubSkin);
      updateThemePreview({ ...curSkin, colors: resolvedColors });
    }

    // Auto-scroll skin list to current selection
    requestAnimationFrame(() => scrollToSelectedSkin());

    // Online services availability
    onlineServicesAvailable = !!data.onlineServicesAvailable;

    // Background
    if (data.background) {
      const bg = data.background;
      // Normalize legacy 'none' mode to 'center'
      let mode = bg.mode || 'cover';
      if (mode === 'none')
        mode = 'center';
      currentBg = {
        baseColor: bg.baseColor || '#3A6EA5',
        pattern: bg.pattern || null,
        sourceType: bg.sourceType || bg.type || 'image',
        src: bg.src || '',
        mode,
        slideshow: bg.slideshow || null,
        video: bg.video || null,
        online: bg.online || null,
      };
      selectedBg = { ...currentBg };

      // Populate base layer controls
      bgBaseColorEl.value = currentBg.baseColor;
      updateBgColorSwatch();
      if (currentBg.pattern) {
        chkPattern.checked = true;
        btnEditPattern.disabled = false;
      } else {
        chkPattern.checked = false;
        btnEditPattern.disabled = true;
      }

      // Source type (drive subtabs + panels)
      _switchBgSource(currentBg.sourceType);

      bgModeEl.value = mode;

      // Slideshow settings
      if (currentBg.slideshow) {
        slideshowFolderEl.value = currentBg.slideshow.folder || '';
        slideshowIntervalEl.value = currentBg.slideshow.interval || 30;
        slideshowIntervalValueEl.textContent = (currentBg.slideshow.interval || 30) + 's';
        chkSlideshowShuffle.checked = !!currentBg.slideshow.shuffle;
        chkSlideshowRecursive.checked = !!currentBg.slideshow.recursive;
        slideshowTransitionEl.value = currentBg.slideshow.transition || 'fade';
        slideshowDurationEl.value = currentBg.slideshow.transitionDuration || 1;
        slideshowDurationValueEl.textContent = (currentBg.slideshow.transitionDuration || 1).toFixed(1) + 's';
        slideshowModeEl.value = mode;
      }

      // Video settings
      if (currentBg.video) {
        videoFileEl.value = currentBg.video.src || '';
        chkVideoLoop.checked = currentBg.video.loop !== false;
        videoSpeedEl.value = currentBg.video.playbackRate || 1;
        videoSpeedValueEl.textContent = (currentBg.video.playbackRate || 1).toFixed(2) + 'x';
      }

      // Online settings
      if (currentBg.online) {
        onlineServiceEl.value = currentBg.online.service || 'picsum';
      }
    }

    // Available backgrounds (system + user)
    const systemBgs = data.availableBackgrounds || [];
    let userBgEntries = [];
    try {
      const listResult = await SZ.Dlls.User32.SendMessage('sz:vfs:List', { path: '/user/pictures' });
      userBgEntries = (listResult.entries || []);
    } catch (_) {}
    const userBgs = userBgEntries.map(name => ({
      name: typeof name === 'string' ? name : name.name,
      src: `/user/pictures/${typeof name === 'string' ? name : name.name}`,
    }));
    
    const merged = new Map();
    for (const bg of systemBgs) merged.set(bg.name, bg);
    for (const bg of userBgs) merged.set(bg.name, bg);

    availableBackgrounds = [...merged.values()];
    
    renderBackgroundList();
    await updateBgPreview();

    // Animations checkbox
    const chkAnim = document.getElementById('chk-animations');
    if (chkAnim)
      chkAnim.checked = data.animations !== false;

    // Cursor settings
    if (data.cursor) {
      chkCursorShadow.checked = !!data.cursor.shadow;
      chkCursorTrail.checked = !!data.cursor.trail;
      cursorTrailLenEl.value = data.cursor.trailLen || 5;
      cursorTrailLenValueEl.textContent = data.cursor.trailLen || 5;
      _updateTrailOptionsVisibility();
    }

    // Snap/tab settings
    if (data.snap)
      _populateSnapSettings(data.snap);

    dirty = false;
  }

  // Clear MRU button
  document.getElementById('btn-clear-mru').addEventListener('click', () => {
    SZ.Dlls.User32.PostMessage('sz:clearMRU');
    alert('Recently used programs list has been cleared.');
  });

  // Show/hide clock checkbox
  document.getElementById('chk-show-clock').addEventListener('change', (e) => {
    SZ.Dlls.User32.PostMessage('sz:taskbarSetting', { key: 'showClock', value: e.target.checked });
    dirty = true;
  });

  // Auto-hide checkbox
  document.getElementById('chk-auto-hide').addEventListener('change', (e) => {
    SZ.Dlls.User32.PostMessage('sz:taskbarSetting', { key: 'autoHide', value: e.target.checked });
    dirty = true;
  });

  // Small icons checkbox
  document.getElementById('chk-small-icons').addEventListener('change', (e) => {
    SZ.Dlls.User32.PostMessage('sz:taskbarSetting', { key: 'smallIcons', value: e.target.checked });
    dirty = true;
  });

  // Window animations checkbox
  document.getElementById('chk-animations').addEventListener('change', (e) => {
    SZ.Dlls.User32.PostMessage('sz:animationSetting', { value: e.target.checked });
    dirty = true;
  });

  // -- Pointers tab ---------------------------------------------------------

  const chkCursorShadow = document.getElementById('chk-cursor-shadow');
  const chkCursorTrail = document.getElementById('chk-cursor-trail');
  const cursorTrailLenEl = document.getElementById('cursor-trail-len');
  const cursorTrailLenValueEl = document.getElementById('cursor-trail-len-value');
  const trailOptionsGroup = document.getElementById('trail-options-group');
  const cursorPreviewArea = document.getElementById('cursor-preview-area');

  // Inline cursor preview state
  let pvShadowEl = null;
  const pvTrailEls = [];
  const pvTrailPositions = [];
  let pvLastTrailTime = 0;

  const _cursorSvg = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 32 32">' +
    '<path d="M4 1 L4 27 L10 21 L16 31 L20 29 L14 19 L22 19 Z" ' +
    'fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/>' +
    '</svg>'
  )}`;

  function _initCursorPreview() {
    // Create shadow element inside preview
    pvShadowEl = document.createElement('div');
    pvShadowEl.className = 'cursor-preview-shadow';
    pvShadowEl.style.backgroundImage = `url("${_cursorSvg}")`;
    pvShadowEl.style.display = 'none';
    cursorPreviewArea.appendChild(pvShadowEl);

    cursorPreviewArea.addEventListener('pointermove', (e) => {
      const rect = cursorPreviewArea.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Update shadow
      if (chkCursorShadow.checked && pvShadowEl) {
        pvShadowEl.style.display = '';
        pvShadowEl.style.left = (x + 3) + 'px';
        pvShadowEl.style.top = (y + 3) + 'px';
      }

      // Update trail
      if (chkCursorTrail.checked) {
        const now = performance.now();
        if (now - pvLastTrailTime >= 50) {
          pvLastTrailTime = now;
          pvTrailPositions.push({ x, y });
          const maxLen = parseInt(cursorTrailLenEl.value, 10) || 5;
          while (pvTrailPositions.length > maxLen)
            pvTrailPositions.shift();
          _updatePreviewTrail();
        }
      }
    });

    cursorPreviewArea.addEventListener('pointerleave', () => {
      if (pvShadowEl)
        pvShadowEl.style.display = 'none';
      for (const el of pvTrailEls)
        el.style.opacity = '0';
    });
  }

  function _updatePreviewTrail() {
    const maxLen = parseInt(cursorTrailLenEl.value, 10) || 5;

    // Ensure correct number of trail elements
    while (pvTrailEls.length < maxLen) {
      const el = document.createElement('div');
      el.className = 'cursor-preview-trail';
      el.style.backgroundImage = `url("${_cursorSvg}")`;
      el.style.opacity = '0';
      cursorPreviewArea.appendChild(el);
      pvTrailEls.push(el);
    }
    while (pvTrailEls.length > maxLen) {
      const el = pvTrailEls.pop();
      el.remove();
    }

    const positions = pvTrailPositions;
    const len = positions.length;
    for (let i = 0; i < pvTrailEls.length; ++i) {
      const el = pvTrailEls[i];
      if (i < len) {
        const pos = positions[len - 1 - i];
        const ratio = 1 - (i / pvTrailEls.length);
        el.style.left = pos.x + 'px';
        el.style.top = pos.y + 'px';
        el.style.opacity = Math.max(0.05, ratio * 0.4);
      } else {
        el.style.opacity = '0';
      }
    }
  }

  function _updateTrailOptionsVisibility() {
    trailOptionsGroup.style.opacity = chkCursorTrail.checked ? '1' : '0.5';
    cursorTrailLenEl.disabled = !chkCursorTrail.checked;
  }

  chkCursorShadow.addEventListener('change', () => {
    SZ.Dlls.User32.PostMessage('sz:cursorSetting', { key: 'shadow', value: chkCursorShadow.checked });
    if (!chkCursorShadow.checked && pvShadowEl)
      pvShadowEl.style.display = 'none';
    dirty = true;
  });

  chkCursorTrail.addEventListener('change', () => {
    SZ.Dlls.User32.PostMessage('sz:cursorSetting', { key: 'trail', value: chkCursorTrail.checked });
    _updateTrailOptionsVisibility();
    if (!chkCursorTrail.checked)
      for (const el of pvTrailEls)
        el.style.opacity = '0';
    dirty = true;
  });

  cursorTrailLenEl.addEventListener('input', () => {
    const val = parseInt(cursorTrailLenEl.value, 10);
    cursorTrailLenValueEl.textContent = val;
    SZ.Dlls.User32.PostMessage('sz:cursorSetting', { key: 'trailLen', value: val });
    dirty = true;
  });

  _initCursorPreview();

  // -- Window Management tab ------------------------------------------------

  const snapModeEl = document.getElementById('snap-mode');
  const chkMagnetEnabled = document.getElementById('chk-magnet-enabled');
  const chkMagnetScreen = document.getElementById('chk-magnet-screen');
  const chkMagnetOuter = document.getElementById('chk-magnet-outer');
  const chkMagnetInner = document.getElementById('chk-magnet-inner');
  const chkMagnetCorners = document.getElementById('chk-magnet-corners');
  const magnetDistanceEl = document.getElementById('magnet-distance');
  const magnetDistanceValueEl = document.getElementById('magnet-distance-value');
  const chkMagnetFast = document.getElementById('chk-magnet-fast');
  const magnetSpeedEl = document.getElementById('magnet-speed');
  const magnetSpeedValueEl = document.getElementById('magnet-speed-value');
  const speedThresholdRow = document.getElementById('speed-threshold-row');
  const stretchModeEl = document.getElementById('stretch-mode');
  const chkStretchV = document.getElementById('chk-stretch-v');
  const chkStretchH = document.getElementById('chk-stretch-h');
  const chkStretchD = document.getElementById('chk-stretch-d');
  const stretchTargetEl = document.getElementById('stretch-target');
  const chkGlueEnabled = document.getElementById('chk-glue-enabled');
  const chkGlueDrag = document.getElementById('chk-glue-drag');
  const chkGlueResize = document.getElementById('chk-glue-resize');
  const chkTabEnabled = document.getElementById('chk-tab-enabled');
  const chkTabAutohide = document.getElementById('chk-tab-autohide');

  function _sendSnap(key, value) {
    SZ.Dlls.User32.PostMessage('sz:snapSetting', { key, value });
  }

  function _updateSpeedThresholdVisibility() {
    if (speedThresholdRow)
      speedThresholdRow.style.opacity = chkMagnetFast.checked ? '1' : '0.5';
    if (magnetSpeedEl)
      magnetSpeedEl.disabled = !chkMagnetFast.checked;
  }

  function _populateSnapSettings(snap) {
    if (!snap)
      return;
    if (snapModeEl) {
      snapModeEl.value = snap.mode || 'aquasnap';
      // Set enabled based on mode
      if (snap.mode === 'disabled')
        _sendSnap('enabled', false);
    }
    if (chkMagnetEnabled) chkMagnetEnabled.checked = snap.magnetEnabled !== false;
    if (chkMagnetScreen) chkMagnetScreen.checked = snap.magnetScreenEdges !== false;
    if (chkMagnetOuter) chkMagnetOuter.checked = snap.magnetOuterEdges !== false;
    if (chkMagnetInner) chkMagnetInner.checked = !!snap.magnetInnerEdges;
    if (chkMagnetCorners) chkMagnetCorners.checked = snap.magnetCorners !== false;
    if (magnetDistanceEl) {
      magnetDistanceEl.value = snap.magnetDistance || 10;
      magnetDistanceValueEl.textContent = (snap.magnetDistance || 10) + ' px';
    }
    if (chkMagnetFast) chkMagnetFast.checked = !!snap.magnetDisableFast;
    if (magnetSpeedEl) {
      magnetSpeedEl.value = snap.magnetSpeedThreshold || 1500;
      magnetSpeedValueEl.textContent = (snap.magnetSpeedThreshold || 1500) + ' px/s';
    }
    _updateSpeedThresholdVisibility();
    if (stretchModeEl) stretchModeEl.value = snap.stretchMode || 'aquastretch';
    if (chkStretchV) chkStretchV.checked = snap.stretchVertical !== false;
    if (chkStretchH) chkStretchH.checked = snap.stretchHorizontal !== false;
    if (chkStretchD) chkStretchD.checked = snap.stretchDiagonal !== false;
    if (stretchTargetEl) stretchTargetEl.value = snap.stretchTarget || 'nearest';
    if (chkGlueEnabled) chkGlueEnabled.checked = !!snap.glueEnabled;
    if (chkGlueDrag) chkGlueDrag.checked = snap.glueCtrlDrag !== false;
    if (chkGlueResize) chkGlueResize.checked = snap.glueCtrlResize !== false;
    if (chkTabEnabled) chkTabEnabled.checked = snap.tabEnabled !== false;
    if (chkTabAutohide) chkTabAutohide.checked = snap.tabAutoHide !== false;
  }

  // Wire up snap controls
  if (snapModeEl) snapModeEl.addEventListener('change', () => {
    const mode = snapModeEl.value;
    _sendSnap('mode', mode);
    _sendSnap('enabled', mode !== 'disabled');
  });
  if (chkMagnetEnabled) chkMagnetEnabled.addEventListener('change', () => _sendSnap('magnetEnabled', chkMagnetEnabled.checked));
  if (chkMagnetScreen) chkMagnetScreen.addEventListener('change', () => _sendSnap('magnetScreenEdges', chkMagnetScreen.checked));
  if (chkMagnetOuter) chkMagnetOuter.addEventListener('change', () => _sendSnap('magnetOuterEdges', chkMagnetOuter.checked));
  if (chkMagnetInner) chkMagnetInner.addEventListener('change', () => _sendSnap('magnetInnerEdges', chkMagnetInner.checked));
  if (chkMagnetCorners) chkMagnetCorners.addEventListener('change', () => _sendSnap('magnetCorners', chkMagnetCorners.checked));
  if (magnetDistanceEl) magnetDistanceEl.addEventListener('input', () => {
    const val = parseInt(magnetDistanceEl.value, 10);
    magnetDistanceValueEl.textContent = val + ' px';
    _sendSnap('magnetDistance', val);
  });
  if (chkMagnetFast) chkMagnetFast.addEventListener('change', () => {
    _sendSnap('magnetDisableFast', chkMagnetFast.checked);
    _updateSpeedThresholdVisibility();
  });
  if (magnetSpeedEl) magnetSpeedEl.addEventListener('input', () => {
    const val = parseInt(magnetSpeedEl.value, 10);
    magnetSpeedValueEl.textContent = val + ' px/s';
    _sendSnap('magnetSpeedThreshold', val);
  });
  if (stretchModeEl) stretchModeEl.addEventListener('change', () => _sendSnap('stretchMode', stretchModeEl.value));
  if (chkStretchV) chkStretchV.addEventListener('change', () => _sendSnap('stretchVertical', chkStretchV.checked));
  if (chkStretchH) chkStretchH.addEventListener('change', () => _sendSnap('stretchHorizontal', chkStretchH.checked));
  if (chkStretchD) chkStretchD.addEventListener('change', () => _sendSnap('stretchDiagonal', chkStretchD.checked));
  if (stretchTargetEl) stretchTargetEl.addEventListener('change', () => _sendSnap('stretchTarget', stretchTargetEl.value));
  if (chkGlueEnabled) chkGlueEnabled.addEventListener('change', () => _sendSnap('glueEnabled', chkGlueEnabled.checked));
  if (chkGlueDrag) chkGlueDrag.addEventListener('change', () => _sendSnap('glueCtrlDrag', chkGlueDrag.checked));
  if (chkGlueResize) chkGlueResize.addEventListener('change', () => _sendSnap('glueCtrlResize', chkGlueResize.checked));
  if (chkTabEnabled) chkTabEnabled.addEventListener('change', () => _sendSnap('tabEnabled', chkTabEnabled.checked));
  if (chkTabAutohide) chkTabAutohide.addEventListener('change', () => _sendSnap('tabAutoHide', chkTabAutohide.checked));

  // Switch to requested tab from URL parameter
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    const params = SZ.Dlls.Kernel32.GetCommandLine();
    const _initTab = params.tab;
    if (_initTab) {
      const tabEl = document.querySelector(`.tab[data-tab="${_initTab}"]`);
      if (tabEl) {
        for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t === tabEl);
        for (const p of document.querySelectorAll('.tab-body')) p.classList.toggle('active', p.id === 'panel-' + _initTab);
      }
    }

    // Request settings
    requestSettings();
  }

  init();

  // ===== Menu system =====
  new SZ.MenuBar({
    onAction(action) {
      if (action === 'about')
        SZ.Dialog.show('dlg-about');
    }
  });

  SZ.Dialog.wireAll();
})();
