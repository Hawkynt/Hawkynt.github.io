;(function() {
  'use strict';

  // ===== Design Presets (style overrides only) =====

  const DESIGN_PRESETS = {
    'minimal-clean': {
      bannerBg: '#ffffff', textColor: '#333333', acceptBg: '#111111', acceptText: '#ffffff',
      rejectBg: '#e0e0e0', rejectText: '#333333', linkColor: '#111111',
      borderRadius: 0, shadow: 'none', backdrop: 'none'
    },
    'material': {
      bannerBg: '#ffffff', textColor: '#212121', acceptBg: '#1976d2', acceptText: '#ffffff',
      rejectBg: '#e0e0e0', rejectText: '#212121', linkColor: '#1976d2',
      borderRadius: 4, shadow: 'medium', backdrop: 'none'
    },
    'glassmorphism': {
      bannerBg: '#ffffff80', textColor: '#ffffff', acceptBg: '#ffffff40', acceptText: '#ffffff',
      rejectBg: '#ffffff20', rejectText: '#ffffff', linkColor: '#aaddff',
      borderRadius: 16, shadow: 'light', backdrop: 'blur'
    },
    'dark-elegant': {
      bannerBg: '#1a1a2e', textColor: '#e0e0e0', acceptBg: '#e94560', acceptText: '#ffffff',
      rejectBg: '#333355', rejectText: '#e0e0e0', linkColor: '#e94560',
      borderRadius: 8, shadow: 'heavy', backdrop: 'dim'
    },
    'corporate-blue': {
      bannerBg: '#1e3a5f', textColor: '#ffffff', acceptBg: '#4a90d9', acceptText: '#ffffff',
      rejectBg: '#2c4f7c', rejectText: '#ffffff', linkColor: '#7ab8ff',
      borderRadius: 4, shadow: 'medium', backdrop: 'none'
    },
    'warm-toast': {
      bannerBg: '#fef3c7', textColor: '#78350f', acceptBg: '#d97706', acceptText: '#ffffff',
      rejectBg: '#fde68a', rejectText: '#78350f', linkColor: '#b45309',
      borderRadius: 12, shadow: 'light', backdrop: 'none'
    },
    'neon-accent': {
      bannerBg: '#0f0f0f', textColor: '#e0e0e0', acceptBg: '#00ff88', acceptText: '#0f0f0f',
      rejectBg: '#333333', rejectText: '#e0e0e0', linkColor: '#00ff88',
      borderRadius: 2, shadow: 'heavy', backdrop: 'dim'
    },
    'retro-pixel': {
      bannerBg: '#c0c0c0', textColor: '#000000', acceptBg: '#000080', acceptText: '#ffffff',
      rejectBg: '#808080', rejectText: '#ffffff', linkColor: '#000080',
      borderRadius: 0, shadow: 'none', backdrop: 'none'
    }
  };

  // ===== Compliance Presets (content + category overrides) =====

  const COMPLIANCE_PRESETS = {
    'gdpr': {
      heading: 'We Value Your Privacy',
      body: 'We use cookies and similar technologies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.',
      acceptLabel: 'Accept All',
      rejectLabel: 'Reject All',
      settingsLabel: 'Cookie Settings',
      showReject: true,
      showSettings: true,
      categories: [
        { name: 'Essential', description: 'Required for basic site functionality', required: true },
        { name: 'Analytics', description: 'Help us understand how visitors use our site', required: false },
        { name: 'Marketing', description: 'Used to deliver personalized advertisements', required: false },
        { name: 'Preferences', description: 'Remember your settings and choices', required: false }
      ]
    },
    'ccpa': {
      heading: 'Your Privacy Choices',
      body: 'We collect personal information as described in our Privacy Policy. You have the right to opt out of the sale of your personal information.',
      acceptLabel: 'Accept',
      rejectLabel: 'Do Not Sell My Info',
      settingsLabel: 'Settings',
      showReject: true,
      showSettings: false,
      categories: [
        { name: 'Essential', description: 'Required for site operation', required: true },
        { name: 'Sale of Personal Info', description: 'Data shared with third parties for targeted advertising', required: false }
      ]
    },
    'eprivacy': {
      heading: 'Cookie Consent',
      body: 'This website uses cookies that require your prior consent. Please review the categories below and choose which cookies you allow.',
      acceptLabel: 'Accept Selected',
      rejectLabel: 'Reject All',
      settingsLabel: 'Manage Preferences',
      showReject: true,
      showSettings: true,
      categories: [
        { name: 'Essential', description: 'Strictly necessary for site function', required: true },
        { name: 'Functional', description: 'Enable enhanced features and personalization', required: false },
        { name: 'Analytics', description: 'Measure site usage and performance', required: false },
        { name: 'Advertising', description: 'Deliver relevant advertisements', required: false }
      ]
    },
    'minimal': {
      heading: 'Cookie Notice',
      body: 'This website uses cookies to ensure you get the best experience.',
      acceptLabel: 'Got It',
      rejectLabel: 'Decline',
      settingsLabel: 'Settings',
      showReject: false,
      showSettings: false,
      categories: [
        { name: 'Essential', description: 'Required for basic site functionality', required: true }
      ]
    }
  };

  // ===== Default State =====

  const DEFAULT_STATE = {
    heading: 'We Value Your Privacy',
    body: 'We use cookies and similar technologies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.',
    acceptLabel: 'Accept All',
    rejectLabel: 'Reject All',
    settingsLabel: 'Cookie Settings',
    linkText: 'Privacy Policy',
    linkUrl: '/privacy',
    showReject: true,
    showSettings: true,
    position: 'bottom-bar',
    animation: 'slide-up',
    bannerBg: '#ffffff',
    textColor: '#333333',
    acceptBg: '#1976d2',
    acceptText: '#ffffff',
    rejectBg: '#e0e0e0',
    rejectText: '#333333',
    linkColor: '#1976d2',
    borderRadius: 8,
    fontSize: 14,
    padding: 20,
    maxWidth: 900,
    shadow: 'medium',
    backdrop: 'none',
    customCSS: '',
    categories: [
      { name: 'Essential', description: 'Required for basic site functionality', required: true },
      { name: 'Analytics', description: 'Help us understand how visitors use our site', required: false },
      { name: 'Marketing', description: 'Used to deliver personalized advertisements', required: false },
      { name: 'Preferences', description: 'Remember your settings and choices', required: false }
    ],
    compliance: 'gdpr',
    responsiveMode: 'desktop',
    pageMode: 'light'
  };

  const SHADOW_MAP = {
    none: 'none',
    light: '0 2px 8px rgba(0,0,0,0.1)',
    medium: '0 4px 16px rgba(0,0,0,0.15)',
    heavy: '0 8px 32px rgba(0,0,0,0.25)'
  };

  const STORAGE_KEY = 'sz-cookie-banner-state';

  // ===== DOM References =====

  const inpHeading = document.getElementById('inp-heading');
  const inpBody = document.getElementById('inp-body');
  const inpAcceptLabel = document.getElementById('inp-accept-label');
  const inpRejectLabel = document.getElementById('inp-reject-label');
  const inpSettingsLabel = document.getElementById('inp-settings-label');
  const inpLinkText = document.getElementById('inp-link-text');
  const inpLinkUrl = document.getElementById('inp-link-url');
  const chkShowReject = document.getElementById('chk-show-reject');
  const chkShowSettings = document.getElementById('chk-show-settings');

  const selCompliance = document.getElementById('sel-compliance');
  const selPosition = document.getElementById('sel-position');
  const selAnimation = document.getElementById('sel-animation');
  const selShadow = document.getElementById('sel-shadow');
  const selBackdrop = document.getElementById('sel-backdrop');

  const clrBannerBg = document.getElementById('clr-banner-bg');
  const hexBannerBg = document.getElementById('hex-banner-bg');
  const clrText = document.getElementById('clr-text');
  const hexText = document.getElementById('hex-text');
  const clrAcceptBg = document.getElementById('clr-accept-bg');
  const hexAcceptBg = document.getElementById('hex-accept-bg');
  const clrAcceptText = document.getElementById('clr-accept-text');
  const hexAcceptText = document.getElementById('hex-accept-text');
  const clrRejectBg = document.getElementById('clr-reject-bg');
  const hexRejectBg = document.getElementById('hex-reject-bg');
  const clrRejectText = document.getElementById('clr-reject-text');
  const hexRejectText = document.getElementById('hex-reject-text');
  const clrLink = document.getElementById('clr-link');
  const hexLink = document.getElementById('hex-link');

  const rngRadius = document.getElementById('rng-radius');
  const valRadius = document.getElementById('val-radius');
  const rngFontSize = document.getElementById('rng-font-size');
  const valFontSize = document.getElementById('val-font-size');
  const rngPadding = document.getElementById('rng-padding');
  const valPadding = document.getElementById('val-padding');
  const rngMaxWidth = document.getElementById('rng-max-width');
  const valMaxWidth = document.getElementById('val-max-width');

  const inpCustomCSS = document.getElementById('inp-custom-css');
  const a11yScore = document.getElementById('a11y-score');

  const categoryList = document.getElementById('category-list');
  const btnAddCategory = document.getElementById('btn-add-category');

  const codeOutput = document.getElementById('code-output');
  const btnCopyCode = document.getElementById('btn-copy-code');
  const btnDownloadCode = document.getElementById('btn-download-code');

  const btnDesktop = document.getElementById('btn-desktop');
  const btnMobile = document.getElementById('btn-mobile');
  const btnLight = document.getElementById('btn-light');
  const btnDark = document.getElementById('btn-dark');
  const btnReplay = document.getElementById('btn-replay');

  const simulatedPage = document.getElementById('simulated-page');
  const bannerContainer = document.getElementById('banner-preview-container');
  const splitter = document.getElementById('splitter');
  const appEl = document.getElementById('app');

  // ===== State =====

  let state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  let debounceTimer = null;
  let optionsPanelHeight = 220;
  let activeCodeTab = 'combined';
  const DEBOUNCE_MS = 120;

  // ===== Utility =====

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    let r, g, b;
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16);
      g = parseInt(h[1] + h[1], 16);
      b = parseInt(h[2] + h[2], 16);
    } else {
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
    }
    return { r, g, b };
  }

  function relativeLuminance(hex) {
    const { r, g, b } = hexToRgb(hex);
    const srgb = [r, g, b].map(c => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }

  function contrastRatio(hex1, hex2) {
    const l1 = relativeLuminance(hex1);
    const l2 = relativeLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function normalizeHex(hex) {
    const h = hex.replace('#', '');
    if (/^[0-9a-fA-F]{3}$/.test(h))
      return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (/^[0-9a-fA-F]{6}$/.test(h))
      return '#' + h;
    return null;
  }

  // ===== State Management =====

  function loadState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        state = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* ignore */ }
  }

  function encodeToHash() {
    try {
      const hash = '#' + btoa(unescape(encodeURIComponent(JSON.stringify(state))));
      history.replaceState(null, '', hash);
    } catch { /* ignore */ }
  }

  function decodeFromHash() {
    const hash = location.hash.slice(1);
    if (!hash)
      return false;
    try {
      const json = decodeURIComponent(escape(atob(hash)));
      const parsed = JSON.parse(json);
      state = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
      return true;
    } catch { /* ignore */ }
    return false;
  }

  // ===== Accessibility =====

  function updateA11yScore() {
    const bgHex = normalizeHex(state.bannerBg);
    const textHex = normalizeHex(state.textColor);
    if (!bgHex || !textHex) {
      a11yScore.textContent = '-';
      a11yScore.className = '';
      a11yScore.title = '';
      return;
    }

    const ratio = contrastRatio(bgHex, textHex);
    const ratioStr = ratio.toFixed(2) + ':1';

    let label, cls;
    if (ratio >= 7) {
      label = 'AAA';
      cls = 'pass';
    } else if (ratio >= 4.5) {
      label = 'AA';
      cls = 'aa';
    } else if (ratio >= 3) {
      label = 'AA Large';
      cls = 'aa-large';
    } else {
      label = 'FAIL';
      cls = 'fail';
    }

    a11yScore.textContent = label + ' (' + ratioStr + ')';
    a11yScore.className = cls;

    // Button contrast tooltip
    const acceptBgHex = normalizeHex(state.acceptBg);
    const acceptTextHex = normalizeHex(state.acceptText);
    let btnInfo = '';
    if (acceptBgHex && acceptTextHex) {
      const btnRatio = contrastRatio(acceptBgHex, acceptTextHex);
      btnInfo = 'Accept button contrast: ' + btnRatio.toFixed(2) + ':1';
      if (btnRatio >= 7) btnInfo += ' (AAA)';
      else if (btnRatio >= 4.5) btnInfo += ' (AA)';
      else if (btnRatio >= 3) btnInfo += ' (AA Large)';
      else btnInfo += ' (FAIL)';
    }
    a11yScore.title = 'Banner bg vs text: ' + ratioStr + '\n' + btnInfo;
  }

  // ===== Banner Preview =====

  function renderBannerPreview() {
    const s = state;
    const shadow = SHADOW_MAP[s.shadow] || 'none';

    let html = '<div class="cb-preview" style="' +
      'background:' + escapeHtml(s.bannerBg) + ';' +
      'color:' + escapeHtml(s.textColor) + ';' +
      'border-radius:' + s.borderRadius + 'px;' +
      'font-size:' + s.fontSize + 'px;' +
      'padding:' + s.padding + 'px;' +
      'max-width:' + s.maxWidth + 'px;' +
      'box-shadow:' + shadow + ';' +
      'margin:0 auto;' +
      '">';

    if (s.heading)
      html += '<h3 style="font-size:' + (s.fontSize + 2) + 'px;">' + escapeHtml(s.heading) + '</h3>';

    html += '<p>' + escapeHtml(s.body);
    if (s.linkText)
      html += ' <a href="javascript:void(0)" style="color:' + escapeHtml(s.linkColor) + ';">' + escapeHtml(s.linkText) + '</a>';
    html += '</p>';

    // Categories with toggles (when settings visible)
    if (s.showSettings && s.categories.length > 0) {
      html += '<div class="cb-categories">';
      for (const cat of s.categories) {
        html += '<div class="cb-cat-row">';
        html += '<div class="cb-cat-info"><span class="cb-cat-name">' + escapeHtml(cat.name) + '</span>';
        if (cat.description)
          html += ' <span class="cb-cat-desc">' + escapeHtml(cat.description) + '</span>';
        html += '</div>';
        html += '<label class="cb-toggle">';
        html += '<input type="checkbox"' + (cat.required ? ' checked disabled' : '') + '>';
        html += '<span class="cb-toggle-slider"></span>';
        html += '</label>';
        html += '</div>';
      }
      html += '</div>';
    }

    // Buttons
    html += '<div class="cb-buttons">';
    html += '<button class="cb-btn" style="background:' + escapeHtml(s.acceptBg) + ';color:' + escapeHtml(s.acceptText) + ';border-radius:' + Math.max(2, s.borderRadius - 4) + 'px;">' + escapeHtml(s.acceptLabel) + '</button>';
    if (s.showReject)
      html += '<button class="cb-btn" style="background:' + escapeHtml(s.rejectBg) + ';color:' + escapeHtml(s.rejectText) + ';border-radius:' + Math.max(2, s.borderRadius - 4) + 'px;">' + escapeHtml(s.rejectLabel) + '</button>';
    if (s.showSettings)
      html += '<button class="cb-btn" style="background:transparent;color:' + escapeHtml(s.textColor) + ';border:1px solid ' + escapeHtml(s.textColor) + ';border-radius:' + Math.max(2, s.borderRadius - 4) + 'px;">' + escapeHtml(s.settingsLabel) + '</button>';
    html += '</div>';

    html += '</div>';
    bannerContainer.innerHTML = html;

    positionBanner();
    playAnimation();
  }

  function positionBanner() {
    const pos = state.position;
    bannerContainer.className = 'pos-' + pos;

    if (state.backdrop !== 'none')
      bannerContainer.classList.add('backdrop-' + state.backdrop);
  }

  function playAnimation() {
    const anim = state.animation;
    if (anim === 'none')
      return;

    const isCenter = state.position === 'center-modal';
    let cls;
    if (anim === 'slide-up')
      cls = isCenter ? 'anim-slide-up-center' : 'anim-slide-up';
    else if (anim === 'fade-in')
      cls = 'anim-fade-in';
    else if (anim === 'scale-up')
      cls = isCenter ? 'anim-scale-up-center' : 'anim-scale-up';

    if (!cls)
      return;

    bannerContainer.classList.remove('anim-slide-up', 'anim-fade-in', 'anim-scale-up', 'anim-slide-up-center', 'anim-scale-up-center');
    // Trigger reflow to restart animation
    void bannerContainer.offsetWidth;
    bannerContainer.classList.add(cls);
  }

  // ===== Simulated Page =====

  function updatePageMode() {
    simulatedPage.classList.toggle('dark-page', state.pageMode === 'dark');
    btnLight.classList.toggle('active', state.pageMode === 'light');
    btnDark.classList.toggle('active', state.pageMode === 'dark');
  }

  function updateResponsive() {
    simulatedPage.classList.toggle('mobile', state.responsiveMode === 'mobile');
    btnDesktop.classList.toggle('active', state.responsiveMode === 'desktop');
    btnMobile.classList.toggle('active', state.responsiveMode === 'mobile');
  }

  // ===== Code Generation =====

  function generateCSS() {
    const s = state;
    const shadow = SHADOW_MAP[s.shadow] || 'none';
    const lines = [];

    lines.push('.cookie-banner-overlay {');
    lines.push('  position: fixed;');
    if (s.position === 'center-modal')
      lines.push('  inset: 0;');
    else if (s.position === 'top-bar')
      lines.push('  top: 0; left: 0; right: 0;');
    else if (s.position === 'bottom-bar')
      lines.push('  bottom: 0; left: 0; right: 0;');
    else if (s.position === 'bottom-left')
      lines.push('  bottom: 16px; left: 16px;');
    else if (s.position === 'bottom-right')
      lines.push('  bottom: 16px; right: 16px;');
    lines.push('  z-index: 99999;');
    if (s.position === 'center-modal') {
      lines.push('  display: flex;');
      lines.push('  align-items: center;');
      lines.push('  justify-content: center;');
    }
    if (s.backdrop === 'dim')
      lines.push('  background: rgba(0, 0, 0, 0.4);');
    else if (s.backdrop === 'blur') {
      lines.push('  background: rgba(0, 0, 0, 0.2);');
      lines.push('  backdrop-filter: blur(4px);');
      lines.push('  -webkit-backdrop-filter: blur(4px);');
    }
    lines.push('}');
    lines.push('');

    lines.push('.cookie-banner {');
    lines.push('  background: ' + s.bannerBg + ';');
    lines.push('  color: ' + s.textColor + ';');
    lines.push('  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;');
    lines.push('  font-size: ' + s.fontSize + 'px;');
    lines.push('  padding: ' + s.padding + 'px;');
    lines.push('  max-width: ' + s.maxWidth + 'px;');
    if (s.position === 'center-modal' || s.position === 'bottom-bar' || s.position === 'top-bar')
      lines.push('  margin: 0 auto;');
    lines.push('  border-radius: ' + s.borderRadius + 'px;');
    if (shadow !== 'none')
      lines.push('  box-shadow: ' + shadow + ';');
    lines.push('  line-height: 1.5;');
    lines.push('}');
    lines.push('');

    lines.push('.cb-heading {');
    lines.push('  margin: 0 0 8px;');
    lines.push('  font-size: ' + (s.fontSize + 2) + 'px;');
    lines.push('}');
    lines.push('');

    lines.push('.cb-body {');
    lines.push('  margin: 0 0 12px;');
    lines.push('}');
    lines.push('');

    lines.push('.cb-link {');
    lines.push('  color: ' + s.linkColor + ';');
    lines.push('  text-decoration: underline;');
    lines.push('}');
    lines.push('');

    lines.push('.cb-buttons {');
    lines.push('  display: flex;');
    lines.push('  gap: 8px;');
    lines.push('  flex-wrap: wrap;');
    lines.push('}');
    lines.push('');

    const btnRadius = Math.max(2, s.borderRadius - 4);
    lines.push('.cb-btn {');
    lines.push('  padding: 8px 20px;');
    lines.push('  border: none;');
    lines.push('  border-radius: ' + btnRadius + 'px;');
    lines.push('  cursor: pointer;');
    lines.push('  font-size: inherit;');
    lines.push('  font-family: inherit;');
    lines.push('  font-weight: 600;');
    lines.push('}');
    lines.push('');

    lines.push('.cb-btn-accept {');
    lines.push('  background: ' + s.acceptBg + ';');
    lines.push('  color: ' + s.acceptText + ';');
    lines.push('}');
    lines.push('');

    if (s.showReject) {
      lines.push('.cb-btn-reject {');
      lines.push('  background: ' + s.rejectBg + ';');
      lines.push('  color: ' + s.rejectText + ';');
      lines.push('}');
      lines.push('');
    }

    if (s.showSettings) {
      lines.push('.cb-btn-settings {');
      lines.push('  background: transparent;');
      lines.push('  color: ' + s.textColor + ';');
      lines.push('  border: 1px solid ' + s.textColor + ';');
      lines.push('}');
      lines.push('');

      lines.push('.cb-categories { margin: 12px 0 0; }');
      lines.push('.cb-cat-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 0; font-size: 0.9em; }');
      lines.push('.cb-cat-name { font-weight: 600; }');
      lines.push('.cb-cat-desc { opacity: 0.7; font-size: 0.9em; }');
      lines.push('.cb-toggle { position: relative; width: 36px; height: 18px; flex-shrink: 0; }');
      lines.push('.cb-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }');
      lines.push('.cb-toggle-slider { position: absolute; inset: 0; background: #ccc; border-radius: 9px; cursor: pointer; transition: background 0.2s; }');
      lines.push('.cb-toggle-slider::before { content: ""; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; background: #fff; border-radius: 50%; transition: transform 0.2s; }');
      lines.push('.cb-toggle input:checked + .cb-toggle-slider { background: #4caf50; }');
      lines.push('.cb-toggle input:checked + .cb-toggle-slider::before { transform: translateX(18px); }');
      lines.push('.cb-toggle input:disabled + .cb-toggle-slider { opacity: 0.5; cursor: not-allowed; }');
      lines.push('');
    }

    // Animation keyframes
    if (s.animation !== 'none') {
      if (s.animation === 'slide-up') {
        lines.push('@keyframes cb-slide-up {');
        lines.push('  from { transform: translateY(100%); opacity: 0; }');
        lines.push('  to { transform: translateY(0); opacity: 1; }');
        lines.push('}');
        lines.push('.cookie-banner { animation: cb-slide-up 0.4s ease-out both; }');
      } else if (s.animation === 'fade-in') {
        lines.push('@keyframes cb-fade-in {');
        lines.push('  from { opacity: 0; }');
        lines.push('  to { opacity: 1; }');
        lines.push('}');
        lines.push('.cookie-banner { animation: cb-fade-in 0.4s ease-out both; }');
      } else if (s.animation === 'scale-up') {
        lines.push('@keyframes cb-scale-up {');
        lines.push('  from { transform: scale(0.9); opacity: 0; }');
        lines.push('  to { transform: scale(1); opacity: 1; }');
        lines.push('}');
        lines.push('.cookie-banner { animation: cb-scale-up 0.3s ease-out both; }');
      }
      lines.push('');
    }

    if (s.customCSS)
      lines.push(s.customCSS);

    return lines.join('\n');
  }

  function generateHTML() {
    const s = state;
    const lines = [];

    lines.push('<div class="cookie-banner-overlay" id="cookie-banner-overlay" role="dialog" aria-label="Cookie consent">');
    lines.push('  <div class="cookie-banner">');

    if (s.heading)
      lines.push('    <h3 class="cb-heading">' + escapeHtml(s.heading) + '</h3>');

    lines.push('    <p class="cb-body">');
    lines.push('      ' + escapeHtml(s.body));
    if (s.linkText && s.linkUrl)
      lines.push('      <a href="' + escapeHtml(s.linkUrl) + '" class="cb-link" target="_blank" rel="noopener">' + escapeHtml(s.linkText) + '</a>');
    lines.push('    </p>');

    if (s.showSettings && s.categories.length > 0) {
      lines.push('    <div class="cb-categories" id="cb-categories">');
      for (const cat of s.categories) {
        lines.push('      <div class="cb-cat-row">');
        lines.push('        <div>');
        lines.push('          <span class="cb-cat-name">' + escapeHtml(cat.name) + '</span>');
        if (cat.description)
          lines.push('          <span class="cb-cat-desc">' + escapeHtml(cat.description) + '</span>');
        lines.push('        </div>');
        const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        lines.push('        <label class="cb-toggle">');
        lines.push('          <input type="checkbox" data-category="' + escapeHtml(slug) + '"' + (cat.required ? ' checked disabled' : '') + '>');
        lines.push('          <span class="cb-toggle-slider"></span>');
        lines.push('        </label>');
        lines.push('      </div>');
      }
      lines.push('    </div>');
    }

    lines.push('    <div class="cb-buttons">');
    lines.push('      <button class="cb-btn cb-btn-accept" id="cb-accept">' + escapeHtml(s.acceptLabel) + '</button>');
    if (s.showReject)
      lines.push('      <button class="cb-btn cb-btn-reject" id="cb-reject">' + escapeHtml(s.rejectLabel) + '</button>');
    if (s.showSettings)
      lines.push('      <button class="cb-btn cb-btn-settings" id="cb-settings">' + escapeHtml(s.settingsLabel) + '</button>');
    lines.push('    </div>');

    lines.push('  </div>');
    lines.push('</div>');

    return lines.join('\n');
  }

  function generateJS() {
    const s = state;
    const lines = [];

    lines.push('(function() {');
    lines.push('  var CONSENT_KEY = "cookie_consent";');
    lines.push('  var overlay = document.getElementById("cookie-banner-overlay");');
    lines.push('');
    lines.push('  // Check for existing consent');
    lines.push('  var existing = null;');
    lines.push('  try { existing = JSON.parse(localStorage.getItem(CONSENT_KEY)); } catch(e) {}');
    lines.push('  if (existing) { overlay.remove(); return; }');
    lines.push('');

    lines.push('  function saveConsent(categories) {');
    lines.push('    var consent = { timestamp: new Date().toISOString(), categories: categories };');
    lines.push('    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(consent)); } catch(e) {}');
    lines.push('    overlay.remove();');
    lines.push('    window.dispatchEvent(new CustomEvent("cookieConsent", { detail: consent }));');
    lines.push('  }');
    lines.push('');

    lines.push('  function getSelectedCategories() {');
    lines.push('    var cats = {};');
    if (s.showSettings && s.categories.length > 0) {
      lines.push('    var toggles = overlay.querySelectorAll("[data-category]");');
      lines.push('    for (var i = 0; i < toggles.length; i++)');
      lines.push('      cats[toggles[i].getAttribute("data-category")] = toggles[i].checked;');
    }
    lines.push('    return cats;');
    lines.push('  }');
    lines.push('');

    lines.push('  document.getElementById("cb-accept").addEventListener("click", function() {');
    if (s.showSettings && s.categories.length > 0) {
      lines.push('    var cats = {};');
      lines.push('    var toggles = overlay.querySelectorAll("[data-category]");');
      lines.push('    for (var i = 0; i < toggles.length; i++)');
      lines.push('      cats[toggles[i].getAttribute("data-category")] = true;');
      lines.push('    saveConsent(cats);');
    } else {
      lines.push('    saveConsent({ all: true });');
    }
    lines.push('  });');
    lines.push('');

    if (s.showReject) {
      lines.push('  document.getElementById("cb-reject").addEventListener("click", function() {');
      if (s.showSettings && s.categories.length > 0) {
        lines.push('    var cats = {};');
        lines.push('    var toggles = overlay.querySelectorAll("[data-category]");');
        lines.push('    for (var i = 0; i < toggles.length; i++)');
        lines.push('      cats[toggles[i].getAttribute("data-category")] = toggles[i].disabled ? true : false;');
        lines.push('    saveConsent(cats);');
      } else {
        lines.push('    saveConsent({ all: false });');
      }
      lines.push('  });');
      lines.push('');
    }

    if (s.showSettings) {
      lines.push('  var categoriesEl = document.getElementById("cb-categories");');
      lines.push('  var settingsVisible = true;');
      lines.push('  document.getElementById("cb-settings").addEventListener("click", function() {');
      lines.push('    settingsVisible = !settingsVisible;');
      lines.push('    if (categoriesEl) categoriesEl.style.display = settingsVisible ? "" : "none";');
      lines.push('  });');
      lines.push('');
    }

    lines.push('})();');

    return lines.join('\n');
  }

  function generateCombined() {
    const lines = [];

    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="en">');
    lines.push('<head>');
    lines.push('<meta charset="UTF-8">');
    lines.push('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    lines.push('<style>');
    lines.push(generateCSS());
    lines.push('</style>');
    lines.push('</head>');
    lines.push('<body>');
    lines.push('');
    lines.push(generateHTML());
    lines.push('');
    lines.push('<script>');
    lines.push(generateJS());
    lines.push('</' + 'script>');
    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }

  // ===== Syntax Highlighting =====

  function highlightCode(code) {
    // Escape HTML first
    let html = escapeHtml(code);

    // HTML tags
    html = html.replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="hl-tag">$2</span>');
    // HTML attributes
    html = html.replace(/([\w-]+)(=)(&quot;)/g, '<span class="hl-attr">$1</span>$2$3');
    // Strings in quotes
    html = html.replace(/(&quot;)(.*?)(&quot;)/g, '<span class="hl-str">$1$2$3</span>');
    // CSS properties
    html = html.replace(/([\w-]+)(\s*:\s*)(?=[^;{]*[;}])/g, '<span class="hl-prop">$1</span>$2');
    // CSS selectors (lines starting with . or # or element name before {)
    html = html.replace(/^(\s*)([\.\#]?[\w\-\:\[\]&gt;=\*\+\~\,\s]+)(\s*\{)/gm, '$1<span class="hl-sel">$2</span>$3');
    // JS keywords
    html = html.replace(/\b(var|const|let|function|return|if|else|for|new|try|catch|null|true|false|this|typeof|void)\b/g, '<span class="hl-kw">$1</span>');
    // JS function calls
    html = html.replace(/\b([\w]+)\s*\(/g, '<span class="hl-fn">$1</span>(');
    // Comments
    html = html.replace(/(\/\/.*$)/gm, '<span class="hl-comment">$1</span>');
    html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$1</span>');

    return html;
  }

  function updateCodeOutput() {
    let code;
    if (activeCodeTab === 'combined')
      code = generateCombined();
    else if (activeCodeTab === 'html')
      code = generateHTML();
    else if (activeCodeTab === 'css')
      code = generateCSS();
    else
      code = generateJS();

    codeOutput.innerHTML = highlightCode(code);
  }

  // ===== Presets =====

  function applyDesignPreset(name) {
    const preset = DESIGN_PRESETS[name];
    if (!preset)
      return;
    Object.assign(state, preset);
    syncStateToControls();
    updateAll();
  }

  function applyCompliancePreset(name) {
    const preset = COMPLIANCE_PRESETS[name];
    if (!preset)
      return;
    state.compliance = name;
    state.heading = preset.heading;
    state.body = preset.body;
    state.acceptLabel = preset.acceptLabel;
    state.rejectLabel = preset.rejectLabel;
    state.settingsLabel = preset.settingsLabel;
    state.showReject = preset.showReject;
    state.showSettings = preset.showSettings;
    state.categories = JSON.parse(JSON.stringify(preset.categories));
    selCompliance.value = name;
    syncStateToControls();
    updateAll();
  }

  // ===== Category Editor =====

  function renderCategoryList() {
    categoryList.innerHTML = '';
    for (let i = 0; i < state.categories.length; ++i) {
      const cat = state.categories[i];
      const item = document.createElement('div');
      item.className = 'category-item';

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = cat.name;
      nameInput.placeholder = 'Name';
      nameInput.title = 'Category name';
      nameInput.addEventListener('input', ((idx) => (e) => {
        state.categories[idx].name = e.target.value;
        debouncedUpdate();
      })(i));

      const descInput = document.createElement('input');
      descInput.type = 'text';
      descInput.value = cat.description;
      descInput.placeholder = 'Description';
      descInput.title = 'Category description';
      descInput.style.flex = '2';
      descInput.addEventListener('input', ((idx) => (e) => {
        state.categories[idx].description = e.target.value;
        debouncedUpdate();
      })(i));

      const reqLabel = document.createElement('label');
      const reqCheck = document.createElement('input');
      reqCheck.type = 'checkbox';
      reqCheck.checked = cat.required;
      reqCheck.addEventListener('change', ((idx) => (e) => {
        state.categories[idx].required = e.target.checked;
        debouncedUpdate();
      })(i));
      reqLabel.appendChild(reqCheck);
      reqLabel.appendChild(document.createTextNode(' Req'));

      const delBtn = document.createElement('span');
      delBtn.className = 'cat-del';
      delBtn.textContent = '\u00D7';
      delBtn.title = 'Remove category';
      delBtn.addEventListener('pointerdown', ((idx) => (e) => {
        e.preventDefault();
        state.categories.splice(idx, 1);
        renderCategoryList();
        debouncedUpdate();
      })(i));

      item.appendChild(nameInput);
      item.appendChild(descInput);
      item.appendChild(reqLabel);
      item.appendChild(delBtn);
      categoryList.appendChild(item);
    }
  }

  btnAddCategory.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    state.categories.push({ name: 'New Category', description: '', required: false });
    renderCategoryList();
    debouncedUpdate();
  });

  // ===== Splitter =====

  splitter.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    splitter.setPointerCapture(e.pointerId);
    const startY = e.clientY;
    const startHeight = optionsPanelHeight;

    function onMove(ev) {
      const delta = startY - ev.clientY;
      optionsPanelHeight = Math.max(100, Math.min(appEl.clientHeight - 80, startHeight + delta));
      applyGridLayout();
    }

    function onUp(ev) {
      splitter.releasePointerCapture(ev.pointerId);
      splitter.removeEventListener('pointermove', onMove);
      splitter.removeEventListener('pointerup', onUp);
    }

    splitter.addEventListener('pointermove', onMove);
    splitter.addEventListener('pointerup', onUp);
  });

  function applyGridLayout() {
    appEl.style.gridTemplateRows = '1fr 4px ' + optionsPanelHeight + 'px';
  }

  // ===== State Sync =====

  function syncControlsToState() {
    state.heading = inpHeading.value;
    state.body = inpBody.value;
    state.acceptLabel = inpAcceptLabel.value;
    state.rejectLabel = inpRejectLabel.value;
    state.settingsLabel = inpSettingsLabel.value;
    state.linkText = inpLinkText.value;
    state.linkUrl = inpLinkUrl.value;
    state.showReject = chkShowReject.checked;
    state.showSettings = chkShowSettings.checked;

    state.position = selPosition.value;
    state.animation = selAnimation.value;
    state.shadow = selShadow.value;
    state.backdrop = selBackdrop.value;

    state.bannerBg = hexBannerBg.value || clrBannerBg.value;
    state.textColor = hexText.value || clrText.value;
    state.acceptBg = hexAcceptBg.value || clrAcceptBg.value;
    state.acceptText = hexAcceptText.value || clrAcceptText.value;
    state.rejectBg = hexRejectBg.value || clrRejectBg.value;
    state.rejectText = hexRejectText.value || clrRejectText.value;
    state.linkColor = hexLink.value || clrLink.value;

    state.borderRadius = parseInt(rngRadius.value, 10);
    state.fontSize = parseInt(rngFontSize.value, 10);
    state.padding = parseInt(rngPadding.value, 10);
    state.maxWidth = parseInt(rngMaxWidth.value, 10);

    state.customCSS = inpCustomCSS.value;
  }

  function syncStateToControls() {
    inpHeading.value = state.heading;
    inpBody.value = state.body;
    inpAcceptLabel.value = state.acceptLabel;
    inpRejectLabel.value = state.rejectLabel;
    inpSettingsLabel.value = state.settingsLabel;
    inpLinkText.value = state.linkText;
    inpLinkUrl.value = state.linkUrl;
    chkShowReject.checked = state.showReject;
    chkShowSettings.checked = state.showSettings;

    selCompliance.value = state.compliance;
    selPosition.value = state.position;
    selAnimation.value = state.animation;
    selShadow.value = state.shadow;
    selBackdrop.value = state.backdrop;

    // Color pairs
    const colorPairs = [
      [clrBannerBg, hexBannerBg, state.bannerBg],
      [clrText, hexText, state.textColor],
      [clrAcceptBg, hexAcceptBg, state.acceptBg],
      [clrAcceptText, hexAcceptText, state.acceptText],
      [clrRejectBg, hexRejectBg, state.rejectBg],
      [clrRejectText, hexRejectText, state.rejectText],
      [clrLink, hexLink, state.linkColor],
    ];

    for (const [clr, hex, val] of colorPairs) {
      hex.value = val;
      const norm = normalizeHex(val);
      if (norm)
        clr.value = norm;
    }

    rngRadius.value = state.borderRadius;
    valRadius.textContent = state.borderRadius;
    rngFontSize.value = state.fontSize;
    valFontSize.textContent = state.fontSize;
    rngPadding.value = state.padding;
    valPadding.textContent = state.padding;
    rngMaxWidth.value = state.maxWidth;
    valMaxWidth.textContent = state.maxWidth;

    inpCustomCSS.value = state.customCSS;
  }

  function updateAll() {
    syncControlsToState();
    renderBannerPreview();
    updateCodeOutput();
    updateA11yScore();
    updatePageMode();
    updateResponsive();
    renderCategoryList();
    saveState();
  }

  function debouncedUpdate() {
    if (debounceTimer)
      clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncControlsToState();
      renderBannerPreview();
      updateCodeOutput();
      updateA11yScore();
      saveState();
    }, DEBOUNCE_MS);
  }

  // ===== Event Wiring =====

  // Content inputs
  const contentInputs = [inpHeading, inpBody, inpAcceptLabel, inpRejectLabel, inpSettingsLabel, inpLinkText, inpLinkUrl, inpCustomCSS];
  for (const el of contentInputs)
    el.addEventListener('input', debouncedUpdate);

  chkShowReject.addEventListener('change', debouncedUpdate);
  chkShowSettings.addEventListener('change', debouncedUpdate);

  // Select controls
  selPosition.addEventListener('change', () => {
    syncControlsToState();
    renderBannerPreview();
    updateCodeOutput();
    saveState();
  });

  selAnimation.addEventListener('change', () => {
    syncControlsToState();
    playAnimation();
    updateCodeOutput();
    saveState();
  });

  selShadow.addEventListener('change', debouncedUpdate);
  selBackdrop.addEventListener('change', debouncedUpdate);

  selCompliance.addEventListener('change', () => {
    applyCompliancePreset(selCompliance.value);
  });

  // Color + hex bidirectional sync
  const colorPairElements = [
    [clrBannerBg, hexBannerBg],
    [clrText, hexText],
    [clrAcceptBg, hexAcceptBg],
    [clrAcceptText, hexAcceptText],
    [clrRejectBg, hexRejectBg],
    [clrRejectText, hexRejectText],
    [clrLink, hexLink],
  ];

  for (const [clr, hex] of colorPairElements) {
    clr.addEventListener('input', () => {
      hex.value = clr.value;
      debouncedUpdate();
    });
    hex.addEventListener('input', () => {
      const norm = normalizeHex(hex.value);
      if (norm)
        clr.value = norm;
      debouncedUpdate();
    });
  }

  // Range sliders
  const rangePairs = [
    [rngRadius, valRadius],
    [rngFontSize, valFontSize],
    [rngPadding, valPadding],
    [rngMaxWidth, valMaxWidth],
  ];

  for (const [rng, val] of rangePairs) {
    rng.addEventListener('input', () => {
      val.textContent = rng.value;
      debouncedUpdate();
    });
  }

  // Toolbar buttons
  btnDesktop.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    state.responsiveMode = 'desktop';
    updateResponsive();
    saveState();
  });

  btnMobile.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    state.responsiveMode = 'mobile';
    updateResponsive();
    saveState();
  });

  btnLight.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    state.pageMode = 'light';
    updatePageMode();
    saveState();
  });

  btnDark.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    state.pageMode = 'dark';
    updatePageMode();
    saveState();
  });

  btnReplay.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    playAnimation();
  });

  // Tab switching
  document.querySelector('.tabs').addEventListener('pointerdown', (e) => {
    const tab = e.target.closest('.tab');
    if (!tab)
      return;
    const tabName = tab.dataset.tab;

    for (const t of document.querySelectorAll('.tab'))
      t.classList.toggle('active', t === tab);
    for (const tb of document.querySelectorAll('.tab-body'))
      tb.classList.toggle('active', tb.id === 'tab-' + tabName);

    if (tabName === 'code')
      updateCodeOutput();
  });

  // Code sub-tab switching
  document.querySelector('.code-sub-tabs').addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.code-sub-tab');
    if (!btn)
      return;
    activeCodeTab = btn.dataset.codetab;
    for (const b of document.querySelectorAll('.code-sub-tab'))
      b.classList.toggle('active', b === btn);
    updateCodeOutput();
  });

  // Copy code
  btnCopyCode.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    let code;
    if (activeCodeTab === 'combined')
      code = generateCombined();
    else if (activeCodeTab === 'html')
      code = generateHTML();
    else if (activeCodeTab === 'css')
      code = generateCSS();
    else
      code = generateJS();
    navigator.clipboard.writeText(code).catch(() => {});
  });

  // Download code
  btnDownloadCode.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const code = generateCombined();
    const blob = new Blob([code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cookie-banner.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ===== Menu System =====

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
        } else if (action === 'new' || action === 'reset') {
          state = JSON.parse(JSON.stringify(DEFAULT_STATE));
          syncStateToControls();
          updateAll();
        } else if (action === 'export-file') {
          btnDownloadCode.dispatchEvent(new PointerEvent('pointerdown'));
        } else if (action && action.startsWith('preset-')) {
          const presetName = action.replace('preset-', '');
          applyDesignPreset(presetName);
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

  // Dialog
  document.getElementById('dlg-about')?.addEventListener('click', function(e) {
    if (e.target.closest('[data-result]'))
      this.classList.remove('visible');
  });

  // ===== Hash update =====

  let hashTimer = null;
  function debouncedHashUpdate() {
    if (hashTimer)
      clearTimeout(hashTimer);
    hashTimer = setTimeout(encodeToHash, 500);
  }

  for (const el of contentInputs)
    el.addEventListener('input', debouncedHashUpdate);
  for (const [clr] of colorPairElements)
    clr.addEventListener('input', debouncedHashUpdate);

  // ===== Init =====

  function init() {
    SZ.Dlls.User32.EnableVisualStyles();

    // Load state
    if (!decodeFromHash())
      loadState();

    syncStateToControls();
    updateAll();
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    requestAnimationFrame(init);

})();
