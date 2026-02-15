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

  // -- Sub-tab switching (Window Mgmt tab) ---------------------------------
  for (const subtab of document.querySelectorAll('.subtab')) {
    subtab.addEventListener('click', () => {
      for (const st of document.querySelectorAll('.subtab')) st.classList.toggle('active', st === subtab);
      for (const sp of document.querySelectorAll('.subtab-body')) sp.classList.toggle('active', sp.id === 'subpanel-' + subtab.dataset.subtab);
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

  async function updateBgPreview() {
    let resolvedSrc = '';
    if (selectedBg.src) {
      if (selectedBg.src.startsWith('/')) {
        // It's a VFS path, resolve it to a URI via the VFS bridge
        try {
          const result = await SZ.Dlls.User32.SendMessage('sz:vfs:ReadUri', { path: selectedBg.src });
          resolvedSrc = _resolveAssetPath(result.uri);
        } catch (e) {
          console.error('VFS ReadUri error for preview:', e);
        }
      } else {
        // It's already a data URI or relative path
        resolvedSrc = _resolveAssetPath(selectedBg.src);
      }
    }

    pvBgImg.src = resolvedSrc;
    pvBgImg.style.display = resolvedSrc ? '' : 'none';
    const screen = document.getElementById('pv-bg-screen');
    const mode = bgModeEl.value;

    if (mode === 'tile') {
      pvBgImg.style.display = 'none';
      screen.style.backgroundImage = resolvedSrc ? `url('${resolvedSrc}')` : '';
      screen.style.backgroundRepeat = 'repeat';
      screen.style.backgroundSize = 'auto';
      screen.style.backgroundPosition = 'top left';
    } else {
      screen.style.backgroundImage = '';
      pvBgImg.style.objectFit = mode === 'fill' ? 'fill'
        : mode === 'center' ? 'none'
        : mode; // 'cover' or 'contain'
      
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

  bgModeEl.addEventListener('change', async () => {
    selectedBg.mode = bgModeEl.value;
    await updateBgPreview();
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
        // Add to list as a custom entry
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
  ;(function() {
    const menuBar = document.querySelector('.menu-bar');
    if (!menuBar) return;
    let openMenu = null;
    function closeMenus() {
      if (openMenu) { openMenu.classList.remove('open'); openMenu = null; }
    }
    menuBar.addEventListener('pointerdown', function(e) {
      const item = e.target.closest('.menu-item');
      if (!item) return;
      const entry = e.target.closest('.menu-entry');
      if (entry) {
        const action = entry.dataset.action;
        closeMenus();
        if (action === 'about') {
          const dlg = document.getElementById('dlg-about');
          if (dlg) dlg.classList.add('visible');
        }
        return;
      }
      if (openMenu === item) { closeMenus(); return; }
      closeMenus();
      item.classList.add('open');
      openMenu = item;
    });
    menuBar.addEventListener('pointerenter', function(e) {
      if (!openMenu) return;
      const item = e.target.closest('.menu-item');
      if (item && item !== openMenu) { closeMenus(); item.classList.add('open'); openMenu = item; }
    }, true);
    document.addEventListener('pointerdown', function(e) {
      if (openMenu && !e.target.closest('.menu-bar')) closeMenus();
    });
  })();

  document.getElementById('dlg-about')?.addEventListener('click', function(e) {
    if (e.target.closest('[data-result]'))
      this.classList.remove('visible');
  });
})();
