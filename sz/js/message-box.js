;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  // Modal message box of the desktop, with the button sets and return values
  // of the Win32 MessageBox (MB_* flags in, ID* values out). Keyboard: Tab
  // cycles the buttons, Enter presses the focused one, Escape cancels.

  const IDOK = 1, IDCANCEL = 2, IDYES = 6, IDNO = 7;

  const BUTTON_SETS = {
    0: [['OK', IDOK]],
    1: [['OK', IDOK], ['Cancel', IDCANCEL]],
    3: [['Yes', IDYES], ['No', IDNO], ['Cancel', IDCANCEL]],
    4: [['Yes', IDYES], ['No', IDNO]],
  };

  const ICONS = {
    0x10: ['sz-mb-icon-error', '✖'],
    0x20: ['sz-mb-icon-question', '?'],
    0x30: ['sz-mb-icon-warning', '!'],
    0x40: ['sz-mb-icon-information', 'i'],
  };

  const queue = [];
  let showing = false;

  function show(text, caption, flags) {
    return new Promise((resolve) => {
      queue.push({ text: String(text ?? ''), caption: String(caption || 'Message'), flags: flags | 0, resolve });
      if (!showing)
        next();
    });
  }

  function next() {
    const item = queue.shift();
    if (!item) {
      showing = false;
      return;
    }
    showing = true;
    const buttons = BUTTON_SETS[item.flags & 0x0F] || BUTTON_SETS[0];
    const cancelValue = buttons.some(b => b[1] === IDCANCEL) ? IDCANCEL : buttons.length === 1 ? buttons[0][1] : null;
    const previousFocus = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'sz-dlg-overlay sz-mb-overlay';

    const win = document.createElement('div');
    win.className = 'sz-dlg-window sz-mb-window';
    win.setAttribute('role', 'alertdialog');
    win.setAttribute('aria-modal', 'true');

    const titlebar = document.createElement('div');
    titlebar.className = 'sz-dlg-titlebar';
    const title = document.createElement('span');
    title.className = 'sz-dlg-title';
    title.id = 'sz-mb-title-' + Date.now();
    title.textContent = item.caption;
    win.setAttribute('aria-labelledby', title.id);
    titlebar.appendChild(title);
    if (cancelValue !== null) {
      const close = document.createElement('button');
      close.className = 'sz-dlg-close-btn';
      close.setAttribute('aria-label', 'Close');
      close.tabIndex = -1;
      close.textContent = '×';
      close.addEventListener('click', () => finish(cancelValue));
      titlebar.appendChild(close);
    }

    const body = document.createElement('div');
    body.className = 'sz-mb-body';
    const icon = ICONS[item.flags & 0xF0];
    if (icon) {
      const i = document.createElement('div');
      i.className = 'sz-mb-icon ' + icon[0];
      i.setAttribute('aria-hidden', 'true');
      i.textContent = icon[1];
      body.appendChild(i);
    }
    const message = document.createElement('div');
    message.className = 'sz-mb-text';
    message.id = 'sz-mb-text-' + Date.now();
    message.textContent = item.text;
    win.setAttribute('aria-describedby', message.id);
    body.appendChild(message);

    const footer = document.createElement('div');
    footer.className = 'sz-dlg-footer-buttons sz-mb-buttons';
    const els = buttons.map(([label, value]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', () => finish(value));
      footer.appendChild(b);
      return b;
    });

    win.append(titlebar, body, footer);
    overlay.appendChild(win);
    document.body.appendChild(overlay);
    els[0].focus();

    function onKey(e) {
      if (e.key === 'Escape' && cancelValue !== null) {
        e.preventDefault();
        finish(cancelValue);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const i = els.indexOf(document.activeElement);
        els[(i + (e.shiftKey ? els.length - 1 : 1) + els.length) % els.length].focus();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const i = els.indexOf(document.activeElement);
        els[(i + (e.key === 'ArrowLeft' ? els.length - 1 : 1) + els.length) % els.length].focus();
      }
    }
    // keep focus inside while the box is open
    function onFocusIn(e) {
      if (!win.contains(e.target))
        els[0].focus();
    }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn, true);

    function finish(value) {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocusIn, true);
      overlay.remove();
      if (previousFocus && previousFocus.focus)
        try { previousFocus.focus(); } catch (_) {}
      item.resolve(value);
      next();
    }
  }

  SZ.MessageBox = Object.freeze({ show, IDOK, IDCANCEL, IDYES, IDNO });
})();
