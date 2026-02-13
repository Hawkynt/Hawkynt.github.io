;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /**
   * SkinLoader — parses WindowBlinds UIS (INI) skin files at runtime and
   * returns a normalised skin object consumable by the window manager and
   * theme engine.
   *
   * Skins register themselves on SZ.skins via their own skin.js files
   * (loaded before this module).  getSkin(name) retrieves a registered skin.
   */

  const skins = SZ.skins || (SZ.skins = {});

  /** Return a registered skin by name (case-insensitive). */
  function getSkin(name) {
    if (!name)
      return null;
    return skins[name] || skins[name.toUpperCase()] || skins[name.toLowerCase()] || null;
  }

  /** Return an array of all registered skin names. */
  function getAvailableSkins() {
    return Object.keys(skins);
  }

  // ---------------------------------------------------------------------------
  // UIS INI parser
  // ---------------------------------------------------------------------------

  function parseUIS(text, basePath) {
    basePath = basePath || '';
    const skin = {
      name: '', author: '', email: '', url: '', wbVersion: 0,
      personality: {}, buttons: {}, titleButtons: [], comboButton: {},
      startButton: {}, colors: {}, fonts: {}, basePath,
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

      if (currentSection === 'titlebarskin')
        _parseTitleBarSkin(skin, key, val);
      else if (currentSection === 'personality')
        _parsePersonality(skin.personality, key, val, basePath);
      else if (currentSection === 'buttons')
        _parseControlButtons(skin.buttons, key, val, basePath);
      else if (currentButtonIndex >= 0)
        _parseTitleButton(skin.titleButtons, currentButtonIndex, key, val, basePath);
      else if (currentSection === 'combobutton')
        _parseComboButton(skin.comboButton, key, val, basePath);
      else if (currentSection === 'startbutton')
        _parseStartButton(skin.startButton, key, val, basePath);
      else if (currentSection === 'colours')
        _parseColour(skin.colors, key, val);
      else if (currentSection && currentSection.startsWith('font'))
        _parseFont(skin.fonts, key, val);
    }

    return skin;
  }

  function _parseTitleBarSkin(skin, key, val) {
    switch (key) {
      case 'skinname': skin.name = val; break;
      case 'skinauthor': skin.author = val; break;
      case 'authoremail': skin.email = val; break;
      case 'authorsurl': skin.url = val; break;
      case 'wbver': skin.wbVersion = parseInt(val, 10); break;
    }
  }

  const _PERSONALITY_INT_KEYS = new Set([
    'usestran', 'buttoncount', 'mouseover', 'tripleimages',
    'textalignment', 'textshift', 'textshiftvert', 'textrightclip',
    'toptopheight', 'topbotheight', 'lefttopheight', 'leftbotheight',
    'righttopheight', 'rightbotheight', 'bottomtopheight', 'bottombotheight',
    'topstretch', 'leftstretch', 'rightstretch', 'bottomstretch',
    'topframe', 'leftframe', 'rightframe', 'bottomframe',
    'menulefttile', 'tileleftmenu', 'tilerightmenu', 'tilemenu',
    'anirate', 'rollupsize', 'dynamicframe', 'fadelinkedbuttons', 'faderate',
  ]);

  const _PERSONALITY_PATH_KEYS = new Set([
    'top', 'topmask', 'left', 'leftmask', 'right', 'rightmask',
    'bottom', 'bottommask', 'menubar', 'menuborders',
    'explorerbmp', 'dialogbmp', 'mdibmp', 'mdibmpmask',
  ]);

  function _parsePersonality(p, key, val, base) {
    if (_PERSONALITY_INT_KEYS.has(key))
      p[key] = parseInt(val, 10);
    else if (_PERSONALITY_PATH_KEYS.has(key))
      p[key] = _resolvePath(val, base);
    else
      p[key] = val;
  }

  function _parseControlButtons(b, key, val, base) {
    const intKeys = new Set(['topheight', 'bottomheight', 'leftwidth', 'rightwidth', 'mouseover', 'framecount', 'mouseenterstartframe', 'mouseoverstartframe', 'mouseoverstopframe', 'animtimerrate', 'mouseleavemode', 'trans', 'alpha']);
    const pathKeys = new Set(['checkbutton', 'checkbuttonmask', 'radiobutton', 'bitmap', 'bitmapmask']);
    if (intKeys.has(key))
      b[key] = parseInt(val, 10);
    else if (pathKeys.has(key))
      b[key] = _resolvePath(val, base);
    else
      b[key] = val;
  }

  function _parseTitleButton(arr, idx, key, val, base) {
    if (!arr[idx])
      arr[idx] = {};
    const btn = arr[idx];
    const intKeys = new Set(['align', 'xcoord', 'ycoord', 'action', 'linkedto']);
    if (key === 'buttonimage')
      btn.image = val ? _resolvePath(val, base) : '';
    else if (key === 'buttonimagemask')
      btn.mask = val ? _resolvePath(val, base) : '';
    else if (intKeys.has(key))
      btn[key] = parseInt(val, 10);
    else if (key.startsWith('visibility'))
      btn[key] = parseInt(val, 10);
  }

  function _parseComboButton(cb, key, val, base) {
    const intKeys = new Set(['leftwidth', 'rightwidth', 'topheight', 'bottomheight', 'mouseover']);
    if (key === 'image')
      cb.image = _resolvePath(val, base);
    else if (intKeys.has(key))
      cb[key] = parseInt(val, 10);
  }

  function _parseStartButton(sb, key, val, base) {
    if (key === 'image')
      sb.image = _resolvePath(val, base);
  }

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

  function _parseColour(colors, key, val) {
    const parts = val.split(/\s+/).map(Number);
    const mapped = _COLOUR_MAP[key];
    if (mapped)
      colors[mapped] = parts;
  }

  function _parseFont(fonts, key, val) {
    switch (key) {
      case 'fontname': fonts.family = val; break;
      case 'fontheight': fonts.height = parseInt(val, 10); break;
      case 'fontweight': fonts.weight = parseInt(val, 10); break;
      case 'antialias': fonts.antialias = parseInt(val, 10) === 1; break;
    }
  }

  function _resolvePath(val, base) {
    if (!val)
      return '';
    const clean = val.replace(/\\/g, '/').replace(/^\/+/, '');
    return base ? `${base}/${clean}` : clean;
  }

  // ---------------------------------------------------------------------------
  // Load a skin folder that contains a skin.uis file + BMP assets
  // (requires HTTP — will not work on file:// protocol)
  // ---------------------------------------------------------------------------

  async function loadSkinFromFolder(basePath) {
    const resp = await fetch(`${basePath}/skin.uis`);
    if (!resp.ok)
      throw new Error(`No skin.uis found in ${basePath}`);

    const text = await resp.text();
    return parseUIS(text, basePath);
  }

  /**
   * Resolve a skin with an optional sub-skin applied.
   * Returns a shallow copy of the skin with colors overridden by the sub-skin.
   * If subSkinId is falsy or 'default', returns the original skin unmodified.
   */
  function resolveSkin(skin, subSkinId) {
    if (!skin || !subSkinId || subSkinId === 'default')
      return skin;

    const sub = skin.subSkins?.find(s => s.id === subSkinId);
    if (!sub?.colors)
      return skin;

    return {
      ...skin,
      colors: { ...skin.colors, ...sub.colors },
      _activeSubSkinId: subSkinId,
    };
  }

  SZ.parseUIS = parseUIS;
  SZ.loadSkinFromFolder = loadSkinFromFolder;
  SZ.getSkin = getSkin;
  SZ.getAvailableSkins = getAvailableSkins;
  SZ.resolveSkin = resolveSkin;
})();
