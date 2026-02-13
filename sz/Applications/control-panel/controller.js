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
  let currentBg = { src: '', mode: 'cover' };
  let selectedBg = { src: '', mode: 'cover' };
  let availableBackgrounds = [];
  let selectedThemeId = '';
  let dirty = false;

  // Resolve asset paths relative to the OS root (2 levels up from this iframe)
  const _resolveAssetPath = (src) => src && !src.startsWith('data:') && !src.startsWith('http') && !src.startsWith('blob:') ? '../../' + src : src;

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
  const themeListEl = document.getElementById('theme-list');

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

  function selectBackground(src, name) {
    selectedBg.src = src;
    for (const li of bgListEl.querySelectorAll('li'))
      li.classList.toggle('selected', li.dataset.src === src);
    updateBgPreview();
    dirty = true;
  }

  function updateBgPreview() {
    if (selectedBg.src) {
      const resolvedSrc = _resolveAssetPath(selectedBg.src);
      pvBgImg.src = resolvedSrc;
      pvBgImg.style.display = '';
      const mode = bgModeEl.value;
      if (mode === 'tile') {
        pvBgImg.style.display = 'none';
        const screen = document.getElementById('pv-bg-screen');
        screen.style.backgroundImage = `url('${resolvedSrc}')`;
        screen.style.backgroundRepeat = 'repeat';
        screen.style.backgroundSize = 'auto';
        screen.style.backgroundPosition = 'top left';
      } else {
        const screen = document.getElementById('pv-bg-screen');
        screen.style.backgroundImage = '';
        pvBgImg.style.objectFit = mode === 'fill' ? 'fill'
          : mode === 'center' ? 'none'
          : mode; // cover, contain
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
    } else {
      pvBgImg.style.display = 'none';
      const screen = document.getElementById('pv-bg-screen');
      screen.style.backgroundImage = '';
    }
  }

  bgModeEl.addEventListener('change', () => {
    selectedBg.mode = bgModeEl.value;
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
      reader.onload = () => {
        const dataUrl = reader.result;
        // Add to list as a custom entry
        const name = file.name;
        const existing = availableBackgrounds.find(b => b.name === name);
        if (!existing)
          availableBackgrounds.push({ name, src: dataUrl });
        selectedBg.src = dataUrl;
        renderBackgroundList();
        updateBgPreview();
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
    const mode = bgModeEl.value;
    SZ.Dlls.User32.PostMessage('sz:setBackground', {
      src: selectedBg.src || 'assets/backgrounds/bliss.svg',
      mode: mode,
    });
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

  function handleSettings(data) {
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

    // Background
    if (data.background) {
      // Normalize legacy 'none' mode to 'center'
      let mode = data.background.mode || 'cover';
      if (mode === 'none')
        mode = 'center';
      currentBg = { src: data.background.src || '', mode };
      selectedBg = { ...currentBg };
      bgModeEl.value = mode;
    }

    // Available backgrounds
    availableBackgrounds = data.availableBackgrounds || [
      { name: 'Bliss', src: 'assets/backgrounds/bliss.svg' },
    ];
    renderBackgroundList();
    updateBgPreview();

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
})();
