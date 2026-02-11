;(function() {
  'use strict';

  // ===== Unicode character names (ASCII subset 32-126) =====

  const CHAR_NAMES = {
    32: 'SPACE', 33: 'EXCLAMATION MARK', 34: 'QUOTATION MARK', 35: 'NUMBER SIGN',
    36: 'DOLLAR SIGN', 37: 'PERCENT SIGN', 38: 'AMPERSAND', 39: 'APOSTROPHE',
    40: 'LEFT PARENTHESIS', 41: 'RIGHT PARENTHESIS', 42: 'ASTERISK', 43: 'PLUS SIGN',
    44: 'COMMA', 45: 'HYPHEN-MINUS', 46: 'FULL STOP', 47: 'SOLIDUS',
    48: 'DIGIT ZERO', 49: 'DIGIT ONE', 50: 'DIGIT TWO', 51: 'DIGIT THREE',
    52: 'DIGIT FOUR', 53: 'DIGIT FIVE', 54: 'DIGIT SIX', 55: 'DIGIT SEVEN',
    56: 'DIGIT EIGHT', 57: 'DIGIT NINE', 58: 'COLON', 59: 'SEMICOLON',
    60: 'LESS-THAN SIGN', 61: 'EQUALS SIGN', 62: 'GREATER-THAN SIGN', 63: 'QUESTION MARK',
    64: 'COMMERCIAL AT', 65: 'LATIN CAPITAL LETTER A', 66: 'LATIN CAPITAL LETTER B',
    67: 'LATIN CAPITAL LETTER C', 68: 'LATIN CAPITAL LETTER D', 69: 'LATIN CAPITAL LETTER E',
    70: 'LATIN CAPITAL LETTER F', 71: 'LATIN CAPITAL LETTER G', 72: 'LATIN CAPITAL LETTER H',
    73: 'LATIN CAPITAL LETTER I', 74: 'LATIN CAPITAL LETTER J', 75: 'LATIN CAPITAL LETTER K',
    76: 'LATIN CAPITAL LETTER L', 77: 'LATIN CAPITAL LETTER M', 78: 'LATIN CAPITAL LETTER N',
    79: 'LATIN CAPITAL LETTER O', 80: 'LATIN CAPITAL LETTER P', 81: 'LATIN CAPITAL LETTER Q',
    82: 'LATIN CAPITAL LETTER R', 83: 'LATIN CAPITAL LETTER S', 84: 'LATIN CAPITAL LETTER T',
    85: 'LATIN CAPITAL LETTER U', 86: 'LATIN CAPITAL LETTER V', 87: 'LATIN CAPITAL LETTER W',
    88: 'LATIN CAPITAL LETTER X', 89: 'LATIN CAPITAL LETTER Y', 90: 'LATIN CAPITAL LETTER Z',
    91: 'LEFT SQUARE BRACKET', 92: 'REVERSE SOLIDUS', 93: 'RIGHT SQUARE BRACKET',
    94: 'CIRCUMFLEX ACCENT', 95: 'LOW LINE', 96: 'GRAVE ACCENT',
    97: 'LATIN SMALL LETTER A', 98: 'LATIN SMALL LETTER B', 99: 'LATIN SMALL LETTER C',
    100: 'LATIN SMALL LETTER D', 101: 'LATIN SMALL LETTER E', 102: 'LATIN SMALL LETTER F',
    103: 'LATIN SMALL LETTER G', 104: 'LATIN SMALL LETTER H', 105: 'LATIN SMALL LETTER I',
    106: 'LATIN SMALL LETTER J', 107: 'LATIN SMALL LETTER K', 108: 'LATIN SMALL LETTER L',
    109: 'LATIN SMALL LETTER M', 110: 'LATIN SMALL LETTER N', 111: 'LATIN SMALL LETTER O',
    112: 'LATIN SMALL LETTER P', 113: 'LATIN SMALL LETTER Q', 114: 'LATIN SMALL LETTER R',
    115: 'LATIN SMALL LETTER S', 116: 'LATIN SMALL LETTER T', 117: 'LATIN SMALL LETTER U',
    118: 'LATIN SMALL LETTER V', 119: 'LATIN SMALL LETTER W', 120: 'LATIN SMALL LETTER X',
    121: 'LATIN SMALL LETTER Y', 122: 'LATIN SMALL LETTER Z', 123: 'LEFT CURLY BRACKET',
    124: 'VERTICAL LINE', 125: 'RIGHT CURLY BRACKET', 126: 'TILDE'
  };

  // ===== Sample presets =====

  const PRESETS = {
    pangram: 'The quick brown fox jumps over the lazy dog. 0123456789',
    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789',
    numbers: '0123456789\n+-*/=%$#@!?\n.,;:\'"()[]{}',
    lorem: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    custom: ''
  };

  // ===== System font candidates =====

  const FONT_CANDIDATES = [
    // Serif
    'Times New Roman', 'Georgia', 'Palatino Linotype', 'Book Antiqua', 'Garamond',
    'Cambria', 'Constantia', 'Baskerville', 'Bodoni MT', 'Calisto MT',
    'Century', 'Century Schoolbook', 'Didot', 'Goudy Old Style',
    'Hoefler Text', 'Lucida Bright', 'Perpetua', 'Rockwell',
    'Sylfaen', 'Charter',
    // Sans-serif
    'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS',
    'Century Gothic', 'Candara', 'Calibri', 'Segoe UI', 'Segoe UI Light',
    'Segoe UI Semibold', 'Gill Sans', 'Gill Sans MT', 'Franklin Gothic Medium',
    'Lucida Sans', 'Lucida Sans Unicode', 'Optima', 'Futura',
    'Myriad Pro', 'Corbel', 'Geneva', 'Noto Sans', 'Open Sans',
    'Roboto', 'Lato', 'Ubuntu', 'Source Sans Pro', 'Liberation Sans',
    'DejaVu Sans', 'Cantarell', 'Droid Sans', 'Fira Sans',
    'Helvetica Neue', 'San Francisco', 'Apple SD Gothic Neo',
    'Malgun Gothic', 'Microsoft YaHei', 'Yu Gothic',
    // Monospace
    'Courier New', 'Consolas', 'Lucida Console', 'Monaco',
    'Menlo', 'Liberation Mono', 'DejaVu Sans Mono', 'Source Code Pro',
    'Fira Mono', 'Fira Code', 'JetBrains Mono', 'Ubuntu Mono',
    'Droid Sans Mono', 'Cascadia Code', 'Cascadia Mono',
    'SF Mono', 'Andale Mono',
    // Cursive
    'Comic Sans MS', 'Brush Script MT', 'Lucida Handwriting',
    'Segoe Script', 'Monotype Corsiva', 'Palace Script MT',
    'Mistral', 'Papyrus', 'Freestyle Script', 'Bradley Hand',
    'Snell Roundhand', 'Apple Chancery',
    // Fantasy / Display
    'Impact', 'Copperplate', 'Copperplate Gothic Bold', 'Harrington',
    'Algerian', 'Bauhaus 93', 'Stencil', 'Jokerman',
    'Showcard Gothic', 'Ravie', 'Playbill', 'Wide Latin',
    // System UI
    'system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'
  ];

  // ===== Classification heuristics =====

  const SERIF_FONTS = new Set([
    'times new roman', 'georgia', 'palatino linotype', 'book antiqua', 'garamond',
    'cambria', 'constantia', 'baskerville', 'bodoni mt', 'calisto mt',
    'century', 'century schoolbook', 'didot', 'goudy old style',
    'hoefler text', 'lucida bright', 'perpetua', 'rockwell',
    'sylfaen', 'charter', 'serif'
  ]);

  const SANS_FONTS = new Set([
    'arial', 'helvetica', 'verdana', 'tahoma', 'trebuchet ms',
    'century gothic', 'candara', 'calibri', 'segoe ui', 'segoe ui light',
    'segoe ui semibold', 'gill sans', 'gill sans mt', 'franklin gothic medium',
    'lucida sans', 'lucida sans unicode', 'optima', 'futura',
    'myriad pro', 'corbel', 'geneva', 'noto sans', 'open sans',
    'roboto', 'lato', 'ubuntu', 'source sans pro', 'liberation sans',
    'dejavu sans', 'cantarell', 'droid sans', 'fira sans',
    'helvetica neue', 'san francisco', 'apple sd gothic neo',
    'malgun gothic', 'microsoft yahei', 'yu gothic',
    'sans-serif', 'system-ui'
  ]);

  const MONO_FONTS = new Set([
    'courier new', 'consolas', 'lucida console', 'monaco',
    'menlo', 'liberation mono', 'dejavu sans mono', 'source code pro',
    'fira mono', 'fira code', 'jetbrains mono', 'ubuntu mono',
    'droid sans mono', 'cascadia code', 'cascadia mono',
    'sf mono', 'andale mono', 'monospace'
  ]);

  const CURSIVE_FONTS = new Set([
    'comic sans ms', 'brush script mt', 'lucida handwriting',
    'segoe script', 'monotype corsiva', 'palace script mt',
    'mistral', 'papyrus', 'freestyle script', 'bradley hand',
    'snell roundhand', 'apple chancery', 'cursive'
  ]);

  const FANTASY_FONTS = new Set([
    'impact', 'copperplate', 'copperplate gothic bold', 'harrington',
    'algerian', 'bauhaus 93', 'stencil', 'jokerman',
    'showcard gothic', 'ravie', 'playbill', 'wide latin', 'fantasy'
  ]);

  const SYSTEM_FONTS = new Set([
    'system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'
  ]);

  function classifyFont(name) {
    const lower = name.toLowerCase();
    if (MONO_FONTS.has(lower)) return 'monospace';
    if (SERIF_FONTS.has(lower)) return 'serif';
    if (SANS_FONTS.has(lower)) return 'sans-serif';
    if (CURSIVE_FONTS.has(lower)) return 'cursive';
    if (FANTASY_FONTS.has(lower)) return 'fantasy';
    return 'unknown';
  }

  function isSystemFont(name) {
    return SYSTEM_FONTS.has(name.toLowerCase());
  }

  // ===== Font detection via canvas =====

  const _detectCanvas = document.createElement('canvas');
  const _detectCtx = _detectCanvas.getContext('2d');
  const _testString = 'mmmmmmmmmmlli1WWW@#$';
  const _baseFonts = ['monospace', 'sans-serif', 'serif'];

  const _baseWidths = {};
  for (const base of _baseFonts) {
    _detectCtx.font = '72px ' + base;
    _baseWidths[base] = _detectCtx.measureText(_testString).width;
  }

  function isFontAvailable(fontName) {
    if (_baseFonts.includes(fontName))
      return true;

    for (const base of _baseFonts) {
      _detectCtx.font = '72px "' + fontName + '", ' + base;
      const w = _detectCtx.measureText(_testString).width;
      if (w !== _baseWidths[base])
        return true;
    }
    return false;
  }

  // ===== Detect available weights =====

  function detectAvailableWeights(fontName) {
    const weights = [100, 200, 300, 400, 500, 600, 700, 800, 900];
    const available = [];
    const baseCtx = _detectCtx;
    const testStr = 'AaBbCcDd01';

    const measured = {};
    for (const w of weights) {
      baseCtx.font = w + ' 48px "' + fontName + '", sans-serif';
      measured[w] = baseCtx.measureText(testStr).width;
    }

    // 400 is always "available" as the base
    available.push(400);
    for (const w of weights) {
      if (w === 400) continue;
      if (measured[w] !== measured[400])
        available.push(w);
    }

    available.sort((a, b) => a - b);
    return [...new Set(available)];
  }

  // ===== Discover fonts =====

  function discoverFonts() {
    const found = new Set();
    const result = [];

    // Try document.fonts API first
    if (document.fonts && typeof document.fonts.forEach === 'function') {
      document.fonts.forEach(face => {
        const name = face.family.replace(/^["']|["']$/g, '');
        if (!found.has(name)) {
          found.add(name);
          result.push(name);
        }
      });
    }

    // Probe system fonts
    for (const name of FONT_CANDIDATES) {
      if (!found.has(name) && isFontAvailable(name)) {
        found.add(name);
        result.push(name);
      }
    }

    result.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    return result;
  }

  // ===== State =====

  let allFonts = [];
  let filteredFonts = [];
  let selectedFont = '';
  let currentCategory = 'all';
  let currentPreset = 'pangram';
  let customText = '';
  let fontSize = 32;
  let fontWeight = 400;
  let isBold = false;
  let isItalic = false;
  let textColor = '#000000';
  let selectedCharCode = -1;

  // ===== DOM refs =====

  const fontListEl = document.getElementById('font-list');
  const fontCountEl = document.getElementById('font-count');
  const searchInput = document.getElementById('search-input');
  const sizeSlider = document.getElementById('size-slider');
  const sizeNum = document.getElementById('size-num');
  const weightSelect = document.getElementById('weight-select');
  const btnBold = document.getElementById('btn-bold');
  const btnItalic = document.getElementById('btn-italic');
  const textColorInput = document.getElementById('text-color');
  const sampleTextEl = document.getElementById('sample-text');
  const charGridEl = document.getElementById('char-grid');
  const glyphInspector = document.getElementById('glyph-inspector');

  // ===== Build font list =====

  function filterFonts() {
    const query = searchInput.value.trim().toLowerCase();
    filteredFonts = allFonts.filter(name => {
      if (query && !name.toLowerCase().includes(query))
        return false;

      if (currentCategory === 'all')
        return true;
      if (currentCategory === 'system')
        return isSystemFont(name);

      const cls = classifyFont(name);
      return cls === currentCategory;
    });
  }

  function renderFontList() {
    fontListEl.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (const name of filteredFonts) {
      const div = document.createElement('div');
      div.className = 'font-item';
      if (name === selectedFont)
        div.classList.add('selected');

      div.textContent = name;
      div.dataset.font = name;

      // Render each font name in its own font
      if (!isSystemFont(name))
        div.style.fontFamily = '"' + name + '", sans-serif';
      else
        div.style.fontFamily = name;

      fragment.appendChild(div);
    }

    fontListEl.appendChild(fragment);
    fontCountEl.textContent = filteredFonts.length + ' font' + (filteredFonts.length !== 1 ? 's' : '');
  }

  function selectFont(name) {
    selectedFont = name;

    // Update selection highlight
    const items = fontListEl.querySelectorAll('.font-item');
    for (const item of items) {
      if (item.dataset.font === name)
        item.classList.add('selected');
      else
        item.classList.remove('selected');
    }

    updatePreview();
    updateCharGrid();
    updateInfoPanel();
  }

  // ===== Preview =====

  function getFontFamily() {
    if (!selectedFont) return 'sans-serif';
    if (isSystemFont(selectedFont)) return selectedFont;
    return '"' + selectedFont + '", sans-serif';
  }

  function getFontStyle() {
    return isItalic ? 'italic' : 'normal';
  }

  function getEffectiveWeight() {
    if (isBold) return Math.max(fontWeight, 700);
    return fontWeight;
  }

  function updatePreview() {
    const family = getFontFamily();
    const style = getFontStyle();
    const weight = getEffectiveWeight();

    sampleTextEl.style.fontFamily = family;
    sampleTextEl.style.fontSize = fontSize + 'px';
    sampleTextEl.style.fontWeight = weight;
    sampleTextEl.style.fontStyle = style;
    sampleTextEl.style.color = textColor;
  }

  // ===== Character grid =====

  function buildCharGrid() {
    charGridEl.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let code = 32; code <= 126; ++code) {
      const cell = document.createElement('div');
      cell.className = 'char-cell';
      cell.dataset.code = code;
      cell.textContent = code === 32 ? '\u2423' : String.fromCharCode(code);
      cell.title = CHAR_NAMES[code] || ('U+' + code.toString(16).toUpperCase().padStart(4, '0'));
      fragment.appendChild(cell);
    }

    charGridEl.appendChild(fragment);
  }

  function updateCharGrid() {
    const family = getFontFamily();
    const cells = charGridEl.querySelectorAll('.char-cell');
    for (const cell of cells) {
      cell.style.fontFamily = family;
      cell.style.color = textColor;
    }
  }

  function inspectGlyph(code) {
    selectedCharCode = code;
    const ch = String.fromCharCode(code);
    const hex = code.toString(16).toUpperCase().padStart(4, '0');

    document.getElementById('glyph-char').textContent = code === 32 ? '\u2423' : ch;
    document.getElementById('glyph-char').style.fontFamily = getFontFamily();
    document.getElementById('glyph-char').style.color = textColor;

    document.getElementById('glyph-name').textContent = CHAR_NAMES[code] || 'UNKNOWN';
    document.getElementById('glyph-unicode').textContent = 'U+' + hex;
    document.getElementById('glyph-html').textContent = '&#' + code + '; (' + ch + ')';
    document.getElementById('glyph-css').textContent = "'\\00" + hex.toLowerCase() + "'";
    document.getElementById('glyph-decimal').textContent = code;

    glyphInspector.classList.add('visible');

    // Highlight selected cell
    const cells = charGridEl.querySelectorAll('.char-cell');
    for (const cell of cells) {
      if (parseInt(cell.dataset.code, 10) === code)
        cell.classList.add('selected');
      else
        cell.classList.remove('selected');
    }
  }

  // ===== Info panel =====

  function updateInfoPanel() {
    if (!selectedFont) {
      document.getElementById('info-family').textContent = '--';
      document.getElementById('info-class').textContent = '--';
      document.getElementById('info-weights').textContent = '--';
      document.getElementById('info-css').textContent = '--';
      return;
    }

    document.getElementById('info-family').textContent = selectedFont;

    const cls = classifyFont(selectedFont);
    document.getElementById('info-class').textContent = cls === 'unknown' ? 'Unclassified' : cls;

    const weights = detectAvailableWeights(selectedFont);
    const weightNames = {
      100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Normal',
      500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black'
    };
    document.getElementById('info-weights').textContent =
      weights.map(w => w + ' (' + (weightNames[w] || '') + ')').join(', ');

    const cssFamily = isSystemFont(selectedFont)
      ? selectedFont
      : "'" + selectedFont + "'";
    document.getElementById('info-css').textContent =
      'font-family: ' + cssFamily + ';';
  }

  // ===== Event: font list click =====

  fontListEl.addEventListener('pointerdown', (e) => {
    const item = e.target.closest('.font-item');
    if (!item) return;
    e.preventDefault();
    selectFont(item.dataset.font);
  });

  // ===== Event: search =====

  searchInput.addEventListener('input', () => {
    filterFonts();
    renderFontList();
  });

  // ===== Event: category buttons =====

  document.getElementById('category-bar').addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    e.preventDefault();

    for (const b of document.querySelectorAll('.cat-btn'))
      b.classList.remove('active');
    btn.classList.add('active');

    currentCategory = btn.dataset.cat;
    filterFonts();
    renderFontList();
  });

  // ===== Event: size slider =====

  sizeSlider.addEventListener('input', () => {
    fontSize = parseInt(sizeSlider.value, 10);
    sizeNum.value = fontSize;
    updatePreview();
  });

  sizeNum.addEventListener('input', () => {
    let v = parseInt(sizeNum.value, 10);
    if (isNaN(v)) return;
    v = Math.max(8, Math.min(120, v));
    fontSize = v;
    sizeSlider.value = v;
    updatePreview();
  });

  sizeNum.addEventListener('blur', () => {
    sizeNum.value = fontSize;
  });

  // ===== Event: weight selector =====

  weightSelect.addEventListener('change', () => {
    fontWeight = parseInt(weightSelect.value, 10);
    updatePreview();
    updateCharGrid();
  });

  // ===== Event: bold / italic toggles =====

  btnBold.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isBold = !isBold;
    btnBold.classList.toggle('active', isBold);
    updatePreview();
    updateCharGrid();
  });

  btnItalic.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    isItalic = !isItalic;
    btnItalic.classList.toggle('active', isItalic);
    updatePreview();
    updateCharGrid();
  });

  // ===== Event: color picker =====

  textColorInput.addEventListener('input', () => {
    textColor = textColorInput.value;
    updatePreview();
    updateCharGrid();
    if (selectedCharCode >= 0)
      document.getElementById('glyph-char').style.color = textColor;
  });

  // ===== Event: sample presets =====

  document.getElementById('sample-presets').addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.preset-btn');
    if (!btn) return;
    e.preventDefault();

    for (const b of document.querySelectorAll('.preset-btn'))
      b.classList.remove('active');
    btn.classList.add('active');

    const preset = btn.dataset.preset;
    currentPreset = preset;

    if (preset === 'custom')
      sampleTextEl.textContent = customText;
    else
      sampleTextEl.textContent = PRESETS[preset];
  });

  // ===== Event: save custom text on edit =====

  sampleTextEl.addEventListener('input', () => {
    if (currentPreset === 'custom')
      customText = sampleTextEl.textContent;
  });

  // ===== Event: tab switching =====

  document.getElementById('tab-bar').addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;

    for (const t of document.querySelectorAll('#tab-bar .tab-btn'))
      t.classList.remove('active');
    btn.classList.add('active');

    for (const p of document.querySelectorAll('.tab-panel'))
      p.classList.remove('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });

  // ===== Event: character grid click =====

  charGridEl.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.char-cell');
    if (!cell) return;
    e.preventDefault();
    const code = parseInt(cell.dataset.code, 10);
    inspectGlyph(code);
  });

  // ===== Keyboard navigation in font list =====

  document.addEventListener('keydown', (e) => {
    // Only handle arrow keys when search is focused or font list area
    if (document.activeElement === searchInput) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    } else if (document.activeElement === sampleTextEl)
      return;

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = filteredFonts.indexOf(selectedFont);
      let newIdx;
      if (e.key === 'ArrowDown')
        newIdx = idx < filteredFonts.length - 1 ? idx + 1 : idx;
      else
        newIdx = idx > 0 ? idx - 1 : 0;

      if (newIdx !== idx && filteredFonts[newIdx]) {
        selectFont(filteredFonts[newIdx]);
        // Scroll into view
        const items = fontListEl.querySelectorAll('.font-item');
        if (items[newIdx])
          items[newIdx].scrollIntoView({ block: 'nearest' });
      }
    }
  });

  // ===== Init =====

  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    allFonts = discoverFonts();
    filterFonts();
    renderFontList();
    buildCharGrid();

    // Select first font
    if (filteredFonts.length > 0)
      selectFont(filteredFonts[0]);

    updatePreview();
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    requestAnimationFrame(init);

})();
