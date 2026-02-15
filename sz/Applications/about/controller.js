;(function() {
  'use strict';

  // ── Tab switching ──────────────────────────────────────────────
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');

  function switchTab(tabId) {
    for (const t of tabs)
      t.classList.toggle('active', t.dataset.tab === tabId);
    for (const p of panels)
      p.classList.toggle('active', p.id === 'tab-' + tabId);

    if (tabId === 'system')
      populateSystemInfo();
  }

  for (const t of tabs)
    t.addEventListener('click', () => switchTab(t.dataset.tab));

  // ── Close handlers ─────────────────────────────────────────────
  function closeWindow() {
    SZ.Dlls.User32.DestroyWindow();
  }

  document.getElementById('btn-ok').addEventListener('click', closeWindow);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'Enter')
      closeWindow();
  });

  SZ.Dlls.User32.RegisterWindowProc((msg) => {
    if (msg === WM_CLOSE)
      closeWindow();
  });

  // ── System info population ─────────────────────────────────────
  let _systemInfoLoaded = false;

  function detectBrowser() {
    const ua = navigator.userAgent;
    if (ua.includes('Edg/'))
      return 'Microsoft Edge';
    if (ua.includes('Chrome/') && !ua.includes('Edg/'))
      return 'Google Chrome';
    if (ua.includes('Firefox/'))
      return 'Mozilla Firefox';
    if (ua.includes('Safari/') && !ua.includes('Chrome/'))
      return 'Apple Safari';
    if (ua.includes('OPR/') || ua.includes('Opera/'))
      return 'Opera';
    return ua.split('/')[0] || 'Unknown';
  }

  function detectPlatform() {
    const uaData = navigator.userAgentData;
    if (uaData?.platform)
      return uaData.platform;

    const p = navigator.platform || '';
    if (p.startsWith('Win'))
      return 'Windows';
    if (p.startsWith('Mac'))
      return 'macOS';
    if (p.startsWith('Linux'))
      return 'Linux';
    return p || 'Unknown';
  }

  function formatBytes(bytes) {
    if (bytes < 1024)
      return bytes + ' B';
    if (bytes < 1048576)
      return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  async function populateSystemInfo() {
    if (_systemInfoLoaded)
      return;
    _systemInfoLoaded = true;

    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el)
        el.textContent = text;
    };

    // Resolution
    try {
      const metrics = await SZ.Dlls.User32.GetSystemMetrics(SM_CXSCREEN);
      const w = metrics;
      const h = await SZ.Dlls.User32.GetSystemMetrics(SM_CYSCREEN);
      setText('info-resolution', w + ' \u00D7 ' + h + ' px');
    } catch (_) {
      setText('info-resolution', screen.width + ' \u00D7 ' + screen.height + ' px (screen)');
    }

    // Memory
    const mem = navigator.deviceMemory;
    setText('info-memory', mem ? mem + ' GB (approximate)' : 'Not available');

    // Browser
    setText('info-browser', detectBrowser());

    // Platform
    setText('info-platform', detectPlatform());

    // Active skin
    try {
      const skinName = await SZ.Dlls.Advapi32.RegQueryValue('skin');
      setText('info-skin', skinName || 'Default');
    } catch (_) {
      setText('info-skin', 'Unknown');
    }

    // Color depth
    setText('info-colors', (screen.colorDepth || 24) + '-bit');

    // Language
    setText('info-language', navigator.language || 'Unknown');

    // Storage estimate
    if (navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const used = est.usage || 0;
        const quota = est.quota || 0;
        setText('info-storage', formatBytes(used) + (quota ? ' of ' + formatBytes(quota) : ''));
      } catch (_) {
        setText('info-storage', 'Not available');
      }
    } else
      setText('info-storage', 'Not available');
  }

  // ── Copy to clipboard ─────────────────────────────────────────
  document.getElementById('btn-copy').addEventListener('click', async function() {
    const rows = document.querySelectorAll('.sys-info tr');
    const lines = ['»SynthelicZ« Desktop — System Information', ''];
    for (const row of rows) {
      const th = row.querySelector('th')?.textContent || '';
      const td = row.querySelector('td')?.textContent || '';
      lines.push(th + ': ' + td);
    }
    lines.push('', 'Version 6.0 | © 1995–2026 »SynthelicZ«');

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      this.textContent = '\u2714 Copied!';
      setTimeout(() => this.textContent = '\uD83D\uDCCB Copy to clipboard', 2000);
    } catch (_) {
      this.textContent = '\u2718 Failed';
      setTimeout(() => this.textContent = '\uD83D\uDCCB Copy to clipboard', 2000);
    }
  });

  // ── Init ───────────────────────────────────────────────────────
  function init() {
    SZ.Dlls.User32.EnableVisualStyles();
    document.getElementById('btn-ok').focus();
  }

  init();
})();
