;(function() {
  'use strict';

  // ---- Minimal Markdown → HTML renderer ----

  function renderMarkdown(md) {
    const lines = md.split('\n');
    const out = [];
    let inList = false;

    for (let i = 0; i < lines.length; ++i) {
      let line = lines[i];

      // Headings
      const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
      if (headingMatch) {
        if (inList) { out.push('</ul>'); inList = false; }
        const level = headingMatch[1].length;
        out.push(`<h${level}>${inlineFormat(headingMatch[2])}</h${level}>`);
        continue;
      }

      // Checkbox list items
      const checkMatch = line.match(/^\s*-\s+\[([ xX])\]\s+(.*)/);
      if (checkMatch) {
        if (!inList) { out.push('<ul class="vision-checklist">'); inList = true; }
        const checked = checkMatch[1] !== ' ';
        const cls = checked ? 'checked' : '';
        out.push(`<li class="${cls}"><span class="vision-check">${checked ? '\u2611' : '\u2610'}</span> ${inlineFormat(checkMatch[2])}</li>`);
        continue;
      }

      // Plain list items
      const listMatch = line.match(/^\s*-\s+(.*)/);
      if (listMatch) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${inlineFormat(listMatch[1])}</li>`);
        continue;
      }

      // Close list if we hit a non-list line
      if (inList) { out.push('</ul>'); inList = false; }

      // Blank line
      if (line.trim() === '') continue;

      // Paragraph
      out.push(`<p>${inlineFormat(line)}</p>`);
    }

    if (inList) out.push('</ul>');
    return out.join('\n');
  }

  function inlineFormat(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>');
  }

  // ---- Parse vision.md structure ----

  function parseVision(md) {
    const lines = md.split('\n');
    let title = '';
    let description = '';
    let bodyStart = 0;

    // Extract H1 title
    for (let i = 0; i < lines.length; ++i) {
      const m = lines[i].match(/^#\s+(.*)/);
      if (m) {
        title = m[1];
        bodyStart = i + 1;
        break;
      }
    }

    // Extract first non-empty paragraph after H1 as description
    for (let i = bodyStart; i < lines.length; ++i) {
      const line = lines[i].trim();
      if (line === '') continue;
      if (line.startsWith('#') || line.startsWith('-')) break;
      description = line;
      bodyStart = i + 1;
      break;
    }

    // Skip trailing blank lines after description
    while (bodyStart < lines.length && lines[bodyStart].trim() === '')
      ++bodyStart;

    const bodyMd = lines.slice(bodyStart).join('\n');
    return { title, description, bodyMd };
  }

  // ---- Dialog drag support ----

  function makeDraggable(dialog, titleBar) {
    let dragging = false;
    let startX = 0, startY = 0;
    let dx = 0, dy = 0;

    titleBar.style.cursor = 'default';

    titleBar.addEventListener('pointerdown', function(e) {
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX - dx;
      startY = e.clientY - dy;
      titleBar.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    titleBar.addEventListener('pointermove', function(e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      dialog.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    });

    titleBar.addEventListener('pointerup', function(e) {
      if (!dragging) return;
      dragging = false;
      titleBar.releasePointerCapture(e.pointerId);
    });
  }

  // ---- Dialog management ----

  function ensureDialogCSS() {
    if (document.getElementById('vision-styles'))
      return;
    const style = document.createElement('style');
    style.id = 'vision-styles';
    style.textContent = `
      /* ---- Base menu bar (zero specificity — app CSS overrides) ---- */
      :where(.menu-bar) { display: flex; align-items: center; padding: 0; background: var(--sz-color-menu); border-bottom: 1px solid var(--sz-color-button-shadow); user-select: none; flex-shrink: 0; z-index: 100; font-size: 11px; }
      :where(.menu-item) { position: relative; padding: 3px 8px; cursor: default; color: var(--sz-color-menu-text); }
      :where(.menu-item:hover), :where(.menu-item.open) { background: var(--sz-color-highlight); color: var(--sz-color-highlight-text); }
      :where(.menu-dropdown) { display: none; position: absolute; top: 100%; left: 0; min-width: 180px; background: var(--sz-color-menu); border: 1px solid var(--sz-color-button-shadow); box-shadow: 2px 2px 4px rgba(0,0,0,0.2); z-index: 1000; padding: 2px 0; }
      :where(.menu-item.open > .menu-dropdown) { display: block; }
      :where(.menu-entry) { padding: 4px 24px; cursor: default; color: var(--sz-color-menu-text); white-space: nowrap; display: flex; justify-content: space-between; align-items: center; }
      :where(.menu-entry:hover) { background: var(--sz-color-highlight); color: var(--sz-color-highlight-text); }
      :where(.menu-entry.disabled) { color: var(--sz-color-gray-text); pointer-events: none; }
      :where(.menu-entry .shortcut) { margin-left: 24px; font-size: 10px; opacity: 0.7; }
      :where(.menu-entry.checkbox::before), :where(.menu-entry.radio::before) { content: ''; display: inline-block; width: 16px; margin-left: -16px; text-align: center; }
      :where(.menu-entry.checkbox.checked::before) { content: '\\2713'; }
      :where(.menu-entry.radio.checked::before) { content: '\\2022'; }
      :where(.menu-separator) { height: 1px; background: var(--sz-color-button-shadow); margin: 2px 4px; }

      /* ---- Base dialog overlay (zero specificity) ---- */
      :where(.dialog-overlay) { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); z-index: 2000; justify-content: center; align-items: center; }
      :where(.dialog-overlay.visible) { display: flex; }
      :where(.dialog) { background: var(--sz-color-button-face); border: 2px outset var(--sz-color-button-shadow); min-width: 280px; max-width: 450px; box-shadow: 3px 3px 8px rgba(0,0,0,0.3); }
      :where(.dialog-title) { background: var(--sz-color-highlight); color: var(--sz-color-highlight-text); padding: 4px 8px; font-weight: bold; font-size: 11px; user-select: none; }
      :where(.dialog-body) { padding: 12px 16px; font-size: 11px; line-height: 1.6; }
      :where(.dialog-buttons) { display: flex; justify-content: center; gap: 8px; padding: 8px 16px 12px; }
      :where(.dialog-buttons button) { min-width: 75px; height: 23px; border: 2px outset var(--sz-color-button-face); background: var(--sz-color-button-face); font-family: inherit; font-size: 11px; cursor: default; }
      :where(.dialog-buttons button:active) { border-style: inset; }

      /* ---- Vision about dialog (higher specificity overrides base) ---- */
      .dialog-overlay.vision-dialog .dialog { min-width: 420px; max-width: 620px; position: relative; }
      .dialog-overlay.vision-dialog .dialog-body { padding: 0; text-align: left; overflow: hidden; display: flex; flex-direction: column; max-height: 70vh; }
      .vision-header { padding: 14px 16px 10px; border-bottom: 1px solid var(--sz-color-button-shadow); flex-shrink: 0; }
      .vision-app-title { font-size: 14px; font-weight: bold; margin: 0 0 2px; }
      .vision-version { font-size: 10px; color: var(--sz-color-gray-text); margin: 0 0 1px; }
      .vision-author { font-size: 10px; color: var(--sz-color-gray-text); margin: 0 0 6px; }
      .vision-description { font-size: 11px; line-height: 1.4; margin: 0; }
      .vision-content { overflow-y: auto; padding: 10px 16px 14px; font-size: 11px; line-height: 1.5; flex: 1; min-height: 0; }
      .vision-content h2 { font-size: 12px; margin: 10px 0 4px; }
      .vision-content h3 { font-size: 11px; margin: 8px 0 3px; }
      .vision-content h4 { font-size: 11px; margin: 6px 0 2px; font-style: italic; }
      .vision-content p { margin: 0 0 6px; }
      .vision-content ul { margin: 0 0 6px; padding-left: 6px; list-style: none; }
      .vision-content li { margin: 1px 0; }
      .vision-content code { background: rgba(0,0,0,0.06); padding: 0 3px; font-size: 10px; }
      .vision-checklist li { padding-left: 2px; }
      .vision-checklist .vision-check { font-size: 12px; margin-right: 2px; }
      .vision-checklist li.checked { opacity: 0.75; }
    `;
    document.head.appendChild(style);
  }

  function ensureAboutDialog(appTitle) {
    const overlay = document.getElementById('dlg-about');
    if (!overlay)
      return null;

    overlay.classList.add('vision-dialog');
    return overlay;
  }

  // ---- Show helper ----

  function showAboutDialog() {
    const overlay = document.getElementById('dlg-about');
    if (overlay)
      overlay.classList.add('visible');
  }

  // ---- Main ----

  function applyMarkdown(md) {
    const { title, description, bodyMd } = parseVision(md);
    const appTitle = title || document.title || 'Application';
    const bodyHtml = renderMarkdown(bodyMd);

    const overlay = ensureAboutDialog(appTitle);
    if (!overlay)
      return;

    const dialogTitle = overlay.querySelector('.dialog-title');
    if (dialogTitle)
      dialogTitle.textContent = 'About ' + appTitle;

    const body = overlay.querySelector('.dialog-body');
    if (!body)
      return;

    // Clear any inline styles that may override our CSS (e.g. text-align:center)
    body.removeAttribute('style');

    body.innerHTML =
      '<div class="vision-header">' +
        '<div class="vision-app-title">' + inlineFormat(appTitle) + '</div>' +
        '<div class="vision-version">Version 6.0</div>' +
        '<div class="vision-author">\u00A9 1995\u20132026 \u00BBSynthelicZ\u00AB</div>' +
        (description ? '<div class="vision-description">' + inlineFormat(description) + '</div>' : '') +
      '</div>' +
      '<div class="vision-content">' + bodyHtml + '</div>';

    // Ensure drag support on existing dialogs too
    const dialog = overlay.querySelector('.dialog');
    const titleEl = overlay.querySelector('.dialog-title');
    if (dialog && titleEl && !titleEl._visionDrag) {
      makeDraggable(dialog, titleEl);
      titleEl._visionDrag = true;
    }
  }

  function init() {
    ensureDialogCSS();

    // Prefer embedded data (works on file://), fall back to fetch
    if (window.__visionMd)
      applyMarkdown(window.__visionMd);
    else
      fetch('vision.md')
        .then(function(r) { return r.ok ? r.text() : Promise.reject(); })
        .then(applyMarkdown)
        .catch(function() {});

    // F1 opens about/vision dialog in any app
    document.addEventListener('keydown', function(e) {
      if (e.key === 'F1') {
        e.preventDefault();
        showAboutDialog();
      }
    });
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init);
  else
    init();

})();
