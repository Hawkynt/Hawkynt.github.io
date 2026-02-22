;(function() {
  'use strict';

  const User32 = window.SZ && SZ.Dlls && SZ.Dlls.User32;

  // ===== Font catalog =====

  const ALL_FONTS = [
    { name: 'Playfair Display', category: 'serif', weights: [400, 500, 700] },
    { name: 'Source Sans Pro', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Montserrat', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Merriweather', category: 'serif', weights: [400, 700] },
    { name: 'Oswald', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Quattrocento', category: 'serif', weights: [400, 700] },
    { name: 'Raleway', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Lato', category: 'sans-serif', weights: [400, 700] },
    { name: 'Roboto Slab', category: 'serif', weights: [400, 500, 700] },
    { name: 'Roboto', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Libre Baskerville', category: 'serif', weights: [400, 700] },
    { name: 'Open Sans', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Poppins', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Inter', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Lora', category: 'serif', weights: [400, 500, 700] },
    { name: 'Nunito', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Work Sans', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Bitter', category: 'serif', weights: [400, 500, 700] },
    { name: 'Space Grotesk', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'IBM Plex Serif', category: 'serif', weights: [400, 500, 700] },
    { name: 'DM Serif Display', category: 'serif', weights: [400] },
    { name: 'DM Sans', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Crimson Pro', category: 'serif', weights: [400, 500, 700] },
    { name: 'PT Serif', category: 'serif', weights: [400, 700] },
    { name: 'PT Sans', category: 'sans-serif', weights: [400, 700] },
    { name: 'Cormorant Garamond', category: 'serif', weights: [400, 500, 700] },
    { name: 'Fira Sans', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Josefin Sans', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Archivo', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Spectral', category: 'serif', weights: [400, 500, 700] },
    { name: 'Cabin', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Barlow', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Quicksand', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Vollkorn', category: 'serif', weights: [400, 500, 700] },
    { name: 'Karla', category: 'sans-serif', weights: [400, 500, 700] },
    { name: 'Inconsolata', category: 'monospace', weights: [400, 700] },
    { name: 'Source Code Pro', category: 'monospace', weights: [400, 500, 700] },
    { name: 'Abril Fatface', category: 'display', weights: [400] },
    { name: 'Bebas Neue', category: 'display', weights: [400] },
    { name: 'Pacifico', category: 'handwriting', weights: [400] },
    { name: 'Dancing Script', category: 'handwriting', weights: [400, 700] },
    { name: 'Caveat', category: 'handwriting', weights: [400, 700] }
  ];

  // ===== Curated pairs =====

  const CURATED_PAIRS = [
    // Classic
    { heading: 'Playfair Display', body: 'Source Sans Pro', category: 'Classic', mood: 'Elegant editorial' },
    { heading: 'Libre Baskerville', body: 'Open Sans', category: 'Classic', mood: 'Timeless readability' },
    { heading: 'PT Serif', body: 'PT Sans', category: 'Classic', mood: 'Balanced traditional' },
    { heading: 'Cormorant Garamond', body: 'Fira Sans', category: 'Classic', mood: 'Refined literary' },
    { heading: 'Vollkorn', body: 'Lato', category: 'Classic', mood: 'Warm bookish' },
    // Modern
    { heading: 'Montserrat', body: 'Merriweather', category: 'Modern', mood: 'Geometric meets serif' },
    { heading: 'Poppins', body: 'Inter', category: 'Modern', mood: 'Clean SaaS' },
    { heading: 'DM Serif Display', body: 'DM Sans', category: 'Modern', mood: 'Sharp contrast' },
    { heading: 'Archivo', body: 'Spectral', category: 'Modern', mood: 'Bold digital' },
    { heading: 'Barlow', body: 'Crimson Pro', category: 'Modern', mood: 'Minimalist editorial' },
    // Playful
    { heading: 'Pacifico', body: 'Quicksand', category: 'Playful', mood: 'Fun and friendly' },
    { heading: 'Caveat', body: 'Nunito', category: 'Playful', mood: 'Handwritten warmth' },
    { heading: 'Dancing Script', body: 'Cabin', category: 'Playful', mood: 'Whimsical charm' },
    { heading: 'Josefin Sans', body: 'Lora', category: 'Playful', mood: 'Retro geometric' },
    // Technical
    { heading: 'Roboto Slab', body: 'Roboto', category: 'Technical', mood: 'Google Material' },
    { heading: 'Space Grotesk', body: 'IBM Plex Serif', category: 'Technical', mood: 'Developer docs' },
    { heading: 'Work Sans', body: 'Source Code Pro', category: 'Technical', mood: 'Code + prose' },
    { heading: 'Fira Sans', body: 'Inconsolata', category: 'Technical', mood: 'Mozilla toolkit' },
    // Elegant
    { heading: 'Crimson Pro', body: 'Work Sans', category: 'Elegant', mood: 'Sophisticated layout' },
    { heading: 'Lora', body: 'Nunito', category: 'Elegant', mood: 'Warm storytelling' },
    { heading: 'Raleway', body: 'Lato', category: 'Elegant', mood: 'Light and airy' },
    { heading: 'Abril Fatface', body: 'Karla', category: 'Elegant', mood: 'High contrast display' },
    { heading: 'Bebas Neue', body: 'Open Sans', category: 'Elegant', mood: 'Bold poster style' },
    { heading: 'Oswald', body: 'Quattrocento', category: 'Elegant', mood: 'Condensed headline' },
    { heading: 'Playfair Display', body: 'Raleway', category: 'Elegant', mood: 'Luxury branding' }
  ];

  const CATEGORIES = ['All', 'Classic', 'Modern', 'Playful', 'Technical', 'Elegant'];

  // ===== State =====

  const state = {
    headingFont: 'Playfair Display',
    bodyFont: 'Source Sans Pro',
    headingSize: 42,
    bodySize: 16,
    lineHeight: 1.6,
    letterSpacing: 0,
    headingWeight: 700,
    darkMode: false,
    activeCategory: 'All',
    activePairIndex: 0
  };

  // ===== Font loading =====

  const loadedFonts = new Set();

  function loadFont(fontName) {
    if (loadedFonts.has(fontName))
      return;
    loadedFonts.add(fontName);
    const info = ALL_FONTS.find(f => f.name === fontName);
    const weights = info ? info.weights.join(';') : '400;700';
    const family = fontName.replace(/ /g, '+');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + family + ':wght@' + weights + '&display=swap';
    document.head.appendChild(link);
  }

  function getFontFallback(fontName) {
    const info = ALL_FONTS.find(f => f.name === fontName);
    if (!info)
      return 'sans-serif';
    switch (info.category) {
      case 'serif': return 'serif';
      case 'monospace': return 'monospace';
      case 'handwriting': return 'cursive';
      case 'display': return 'sans-serif';
      default: return 'sans-serif';
    }
  }

  // ===== DOM refs =====

  const $selHeadingFont = document.getElementById('sel-heading-font');
  const $selBodyFont = document.getElementById('sel-body-font');
  const $slHeadingSize = document.getElementById('sl-heading-size');
  const $valHeadingSize = document.getElementById('val-heading-size');
  const $slBodySize = document.getElementById('sl-body-size');
  const $valBodySize = document.getElementById('val-body-size');
  const $slLineHeight = document.getElementById('sl-line-height');
  const $valLineHeight = document.getElementById('val-line-height');
  const $slLetterSpacing = document.getElementById('sl-letter-spacing');
  const $valLetterSpacing = document.getElementById('val-letter-spacing');
  const $selHeadingWeight = document.getElementById('sel-heading-weight');

  const $categoryTabs = document.getElementById('category-tabs');
  const $pairsList = document.getElementById('pairs-list');

  const $previewContainer = document.getElementById('preview-container');
  const $previewHeading = document.getElementById('preview-heading');
  const $previewBody = document.getElementById('preview-body');
  const $weightTexts = document.querySelectorAll('.heading-weight');
  const $previewWeights = document.getElementById('preview-weights');
  const $showWeights = document.getElementById('rb-show-weights');

  // ===== Populate font selects =====

  function populateSelects() {
    const sorted = [...ALL_FONTS].sort((a, b) => a.name.localeCompare(b.name));
    for (const font of sorted) {
      const optH = document.createElement('option');
      optH.value = font.name;
      optH.textContent = font.name;
      $selHeadingFont.appendChild(optH);

      const optB = document.createElement('option');
      optB.value = font.name;
      optB.textContent = font.name;
      $selBodyFont.appendChild(optB);
    }
    $selHeadingFont.value = state.headingFont;
    $selBodyFont.value = state.bodyFont;
  }

  // ===== Populate category tabs =====

  function populateCategoryTabs() {
    for (const cat of CATEGORIES) {
      const btn = document.createElement('button');
      btn.className = 'cat-tab' + (cat === state.activeCategory ? ' active' : '');
      btn.textContent = cat;
      btn.dataset.category = cat;
      $categoryTabs.appendChild(btn);
    }
  }

  // ===== Render pairs list =====

  function renderPairsList() {
    $pairsList.innerHTML = '';
    const filtered = state.activeCategory === 'All'
      ? CURATED_PAIRS
      : CURATED_PAIRS.filter(p => p.category === state.activeCategory);

    for (let i = 0; i < filtered.length; ++i) {
      const pair = filtered[i];
      const globalIndex = CURATED_PAIRS.indexOf(pair);
      const el = document.createElement('div');
      el.className = 'pair-item' + (globalIndex === state.activePairIndex ? ' active' : '');
      el.dataset.index = globalIndex;
      el.innerHTML =
        '<div class="pair-item-names">' + pair.heading + ' + ' + pair.body + '</div>' +
        '<div class="pair-item-tag">' + pair.category + ' \u2014 ' + pair.mood + '</div>' +
        '<div class="pair-item-preview">' +
          '<span class="pair-preview-heading" style="font-family:\'' + pair.heading + '\',' + getFontFallback(pair.heading) + '">The Quick Brown Fox</span>' +
          '<span class="pair-preview-body" style="font-family:\'' + pair.body + '\',' + getFontFallback(pair.body) + '">jumps over the lazy dog</span>' +
        '</div>';
      $pairsList.appendChild(el);

      // Ensure fonts for preview thumbnails are loaded
      loadFont(pair.heading);
      loadFont(pair.body);
    }
  }

  // ===== Update preview =====

  function updatePreview() {
    // Load fonts
    loadFont(state.headingFont);
    loadFont(state.bodyFont);

    // Heading
    const headingFamily = "'" + state.headingFont + "', " + getFontFallback(state.headingFont);
    $previewHeading.style.fontFamily = headingFamily;
    $previewHeading.style.fontSize = state.headingSize + 'px';
    $previewHeading.style.fontWeight = state.headingWeight;

    // Body
    const bodyFamily = "'" + state.bodyFont + "', " + getFontFallback(state.bodyFont);
    $previewBody.style.fontFamily = bodyFamily;
    $previewBody.style.fontSize = state.bodySize + 'px';
    $previewBody.style.lineHeight = state.lineHeight;
    $previewBody.style.letterSpacing = state.letterSpacing + 'px';

    // Weight samples
    for (const el of $weightTexts) {
      el.style.fontFamily = headingFamily;
      const w = el.closest('.weight-sample').dataset.weight;
      el.style.fontWeight = w;
    }

    // Dark mode
    $previewContainer.classList.toggle('dark', state.darkMode);
    document.getElementById('btn-dark-toggle').textContent = state.darkMode ? 'Light' : 'Dark';

    // Sync selects
    $selHeadingFont.value = state.headingFont;
    $selBodyFont.value = state.bodyFont;
    $selHeadingWeight.value = String(state.headingWeight);

    // Slider labels
    $valHeadingSize.textContent = state.headingSize + 'px';
    $valBodySize.textContent = state.bodySize + 'px';
    $valLineHeight.textContent = state.lineHeight.toFixed(1);
    $valLetterSpacing.textContent = state.letterSpacing.toFixed(1) + 'px';

    // Slider values
    $slHeadingSize.value = state.headingSize;
    $slBodySize.value = state.bodySize;
    $slLineHeight.value = Math.round(state.lineHeight * 10);
    $slLetterSpacing.value = Math.round(state.letterSpacing * 10);
  }

  // ===== Apply a curated pair =====

  function applyPair(index) {
    const pair = CURATED_PAIRS[index];
    if (!pair)
      return;
    state.headingFont = pair.heading;
    state.bodyFont = pair.body;
    state.activePairIndex = index;
    updatePreview();
    renderPairsList();
  }

  // ===== CSS generation =====

  function generateImportURL(fontName) {
    const info = ALL_FONTS.find(f => f.name === fontName);
    const weights = info ? info.weights.join(';') : '400;700';
    return 'https://fonts.googleapis.com/css2?family=' + fontName.replace(/ /g, '+') + ':wght@' + weights + '&display=swap';
  }

  function generateCSS() {
    const h = state.headingFont;
    const b = state.bodyFont;
    const hFB = getFontFallback(h);
    const bFB = getFontFallback(b);
    const importH = '@import url(\'' + generateImportURL(h) + '\');';
    const importB = h === b ? '' : '\n@import url(\'' + generateImportURL(b) + '\');';
    return importH + importB + '\n\n' +
      'h1, h2, h3, h4, h5, h6 {\n' +
      '  font-family: \'' + h + '\', ' + hFB + ';\n' +
      '  font-weight: ' + state.headingWeight + ';\n' +
      '}\n\n' +
      'body, p, li, td {\n' +
      '  font-family: \'' + b + '\', ' + bFB + ';\n' +
      '  font-size: ' + state.bodySize + 'px;\n' +
      '  line-height: ' + state.lineHeight.toFixed(1) + ';\n' +
      (state.letterSpacing !== 0 ? '  letter-spacing: ' + state.letterSpacing.toFixed(1) + 'px;\n' : '') +
      '}';
  }

  function generateHTML() {
    const h = state.headingFont;
    const b = state.bodyFont;
    const hFam = h.replace(/ /g, '+');
    const bFam = b.replace(/ /g, '+');
    const hInfo = ALL_FONTS.find(f => f.name === h);
    const bInfo = ALL_FONTS.find(f => f.name === b);
    const hWeights = hInfo ? hInfo.weights.join(';') : '400;700';
    const bWeights = bInfo ? bInfo.weights.join(';') : '400;700';

    let link = '<link rel="preconnect" href="https://fonts.googleapis.com">\n';
    link += '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n';
    link += '<link href="https://fonts.googleapis.com/css2?family=' + hFam + ':wght@' + hWeights;
    if (h !== b)
      link += '&family=' + bFam + ':wght@' + bWeights;
    link += '&display=swap" rel="stylesheet">';

    const hFB = getFontFallback(h);
    const bFB = getFontFallback(b);

    return link + '\n\n' +
      '<h1 style="font-family: \'' + h + '\', ' + hFB + '; font-weight: ' + state.headingWeight + ';">Your Heading Here</h1>\n' +
      '<p style="font-family: \'' + b + '\', ' + bFB + '; font-size: ' + state.bodySize + 'px; line-height: ' + state.lineHeight.toFixed(1) + ';">Your body text here.</p>';
  }

  // ===== Clipboard =====

  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(function() {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('copy-flash');
      setTimeout(function() {
        btn.textContent = orig;
        btn.classList.remove('copy-flash');
      }, 1200);
    }).catch(function() {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function() { btn.textContent = orig; }, 1200);
    });
  }

  // ===== Event wiring =====

  // Font selects
  $selHeadingFont.addEventListener('change', function() {
    state.headingFont = this.value;
    state.activePairIndex = -1;
    updatePreview();
    renderPairsList();
  });

  $selBodyFont.addEventListener('change', function() {
    state.bodyFont = this.value;
    state.activePairIndex = -1;
    updatePreview();
    renderPairsList();
  });

  // Sliders
  $slHeadingSize.addEventListener('input', function() {
    state.headingSize = +this.value;
    updatePreview();
  });

  $slBodySize.addEventListener('input', function() {
    state.bodySize = +this.value;
    updatePreview();
  });

  $slLineHeight.addEventListener('input', function() {
    state.lineHeight = +this.value / 10;
    updatePreview();
  });

  $slLetterSpacing.addEventListener('input', function() {
    state.letterSpacing = +this.value / 10;
    updatePreview();
  });

  // Weight
  $selHeadingWeight.addEventListener('change', function() {
    state.headingWeight = +this.value;
    updatePreview();
  });

  // Category tabs
  $categoryTabs.addEventListener('click', function(e) {
    const tab = e.target.closest('.cat-tab');
    if (!tab)
      return;
    state.activeCategory = tab.dataset.category;
    for (const t of $categoryTabs.querySelectorAll('.cat-tab'))
      t.classList.toggle('active', t === tab);
    renderPairsList();
  });

  // Pairs list
  $pairsList.addEventListener('click', function(e) {
    const item = e.target.closest('.pair-item');
    if (!item)
      return;
    const idx = +item.dataset.index;
    applyPair(idx);
  });

  // Show/hide weight samples
  $showWeights.addEventListener('change', function() {
    $previewWeights.style.display = this.checked ? '' : 'none';
  });

  // ===== Ribbon system =====

  function handleMenuAction(action) {
    switch (action) {
      case 'about': SZ.Dialog.show('dlg-about'); break;
      case 'copy-css': copyToClipboard(generateCSS(), document.querySelector('[data-action="copy-css"]')); break;
      case 'copy-html': copyToClipboard(generateHTML(), document.querySelector('[data-action="copy-html"]')); break;
      case 'shuffle': {
        const idx = Math.floor(Math.random() * CURATED_PAIRS.length);
        applyPair(idx);
        break;
      }
      case 'swap': {
        const tmp = state.headingFont;
        state.headingFont = state.bodyFont;
        state.bodyFont = tmp;
        state.activePairIndex = -1;
        updatePreview();
        renderPairsList();
        break;
      }
      case 'dark-toggle':
        state.darkMode = !state.darkMode;
        updatePreview();
        break;
      case 'exit':
        if (SZ.Dlls && SZ.Dlls.User32 && SZ.Dlls.User32.DestroyWindow)
          SZ.Dlls.User32.DestroyWindow();
        else
          window.close();
        break;
    }
  }

  new SZ.Ribbon({ onAction: handleMenuAction });
  SZ.Dialog.wireAll();

  // ===== Init =====

  function init() {
    if (User32)
      SZ.Dlls.User32.EnableVisualStyles();
    populateSelects();
    populateCategoryTabs();
    renderPairsList();
    applyPair(0);
  }

  init();

})();
