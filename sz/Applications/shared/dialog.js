;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});

  // In-app modal dialogs. show() opens a dialog from the page's markup;
  // alert(), confirm() and prompt() build one on the fly and replace the
  // browser's blocking boxes. All of them focus their first field, keep Tab
  // inside, press the default button on Enter, cancel on Escape, give the
  // focus back when closed and are announced as dialogs.

  const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

  function visible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }

  function annotate(overlay) {
    const box = overlay.querySelector('.dialog, .pp-dialog') || overlay;
    box.setAttribute('role', box.getAttribute('role') || 'dialog');
    box.setAttribute('aria-modal', 'true');
    const title = box.querySelector('.dialog-title, .pp-dialog-title, h1, h2, h3');
    if (title && !box.hasAttribute('aria-labelledby') && !box.hasAttribute('aria-label')) {
      if (!title.id)
        title.id = (overlay.id || 'dialog') + '-title';
      box.setAttribute('aria-labelledby', title.id);
    }
    return box;
  }

  let uid = 0;

  const Dialog = {

    show(dialogId) {
      const overlay = typeof dialogId === 'string'
        ? document.getElementById(dialogId) || document.querySelector(`[data-dialog="${dialogId}"]`)
        : dialogId;
      if (!overlay) return Promise.resolve(null);

      const returnFocus = document.activeElement;
      annotate(overlay);
      overlay.hidden = false;
      overlay.classList.add('visible');

      const fields = () => [...overlay.querySelectorAll(FOCUSABLE)].filter(visible);
      const first = overlay.querySelector('[autofocus]') || fields().find(f => f.matches('input, select, textarea'))
        || overlay.querySelector('[data-default][data-result]') || fields()[0];
      if (first)
        setTimeout(() => {
          if (!overlay.classList.contains('visible'))
            return;
          first.focus();
          if (first.select && first.matches('input[type="text"], input:not([type])'))
            first.select();
        }, 0);

      return new Promise((resolve) => {
        function done(result) {
          overlay.classList.remove('visible');
          overlay.hidden = true;
          overlay.removeEventListener('click', onClick);
          document.removeEventListener('keydown', onKey, true);
          delete overlay._dialogDone;
          if (returnFocus && returnFocus.focus && returnFocus.isConnected)
            try { returnFocus.focus(); } catch (_) {}
          resolve(result);
        }
        function onClick(e) {
          const closeBtn = e.target.closest('[data-dialog-close]');
          if (closeBtn) { done(null); return; }
          const btn = e.target.closest('[data-result]');
          if (btn)
            done(btn.dataset.result);
        }
        function onKey(e) {
          if (!overlay.classList.contains('visible'))
            return;
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            const cancel = overlay.querySelector('[data-result="cancel"]');
            done(cancel ? 'cancel' : null);
            return;
          }
          if (e.key === 'Tab') {
            const list = fields();
            if (!list.length)
              return;
            const i = list.indexOf(document.activeElement);
            if (e.shiftKey && (i <= 0)) {
              e.preventDefault();
              list[list.length - 1].focus();
            } else if (!e.shiftKey && (i === list.length - 1 || i < 0)) {
              e.preventDefault();
              list[0].focus();
            }
            return;
          }
          if (e.key !== 'Enter')
            return;
          // Enter keeps its meaning in text areas and on buttons
          const t = e.target;
          if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON' || t.isContentEditable))
            return;
          const btn = overlay.querySelector('[data-default][data-result]')
            || overlay.querySelector('[data-result]');
          if (!btn)
            return;
          e.preventDefault();
          done(btn.dataset.result);
        }
        overlay._dialogDone = done;
        overlay.addEventListener('click', onClick);
        document.addEventListener('keydown', onKey, true);
      });
    },

    close(dialogId) {
      const overlay = document.getElementById(dialogId)
        || document.querySelector(`[data-dialog="${dialogId}"]`);
      if (!overlay)
        return;
      if (overlay._dialogDone)
        overlay._dialogDone(null);
      else
        overlay.classList.remove('visible');
    },

    open(dialogId) { return this.show(dialogId); },

    // ── on-the-fly dialogs ─────────────────────────────────────────

    // Resolves once dismissed.
    alert(message, title) {
      return this._quick({ title: title || document.title || 'Message', message, buttons: [['OK', 'ok', true]] }).then(() => undefined);
    },

    // Resolves to true for OK, false otherwise.
    confirm(message, title) {
      return this._quick({ title: title || document.title || 'Confirm', message, buttons: [['OK', 'ok', true], ['Cancel', 'cancel']] }).then(r => r.result === 'ok');
    },

    // Resolves to the entered text, or null when cancelled.
    prompt(message, defaultValue, title) {
      return this._quick({ title: title || document.title || 'Input', message, input: defaultValue == null ? '' : String(defaultValue), buttons: [['OK', 'ok', true], ['Cancel', 'cancel']] })
        .then(r => r.result === 'ok' ? r.value : null);
    },

    _quick({ title, message, input, buttons }) {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay sz-quick-dialog';
      overlay.id = 'sz-quick-dialog-' + (++uid);
      const box = document.createElement('div');
      box.className = 'dialog';
      box.setAttribute('role', input === undefined && buttons.length === 1 ? 'alertdialog' : 'dialog');
      const head = document.createElement('div');
      head.className = 'dialog-title';
      head.textContent = title;
      const body = document.createElement('div');
      body.className = 'dialog-body';
      const text = document.createElement('p');
      text.id = overlay.id + '-text';
      text.style.whiteSpace = 'pre-wrap';
      text.textContent = message == null ? '' : String(message);
      box.setAttribute('aria-describedby', text.id);
      body.appendChild(text);
      let field = null;
      if (input !== undefined) {
        field = document.createElement('input');
        field.type = 'text';
        field.value = input;
        field.setAttribute('aria-labelledby', text.id);
        body.appendChild(field);
      }
      const row = document.createElement('div');
      row.className = 'dialog-buttons';
      for (const [label, result, isDefault] of buttons) {
        const b = document.createElement('button');
        b.textContent = label;
        b.dataset.result = result;
        if (isDefault)
          b.dataset.default = '';
        row.appendChild(b);
      }
      box.append(head, body, row);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      return this.show(overlay).then((result) => {
        const value = field ? field.value : undefined;
        overlay.remove();
        return { result, value };
      });
    },

    wireAll() {
      for (const overlay of document.querySelectorAll('.dialog-overlay, .dialog, [data-dialog]'))
        overlay.addEventListener('click', function(e) {
          if (e.target.closest('[data-dialog-close]') || e.target.closest('[data-result]')) {
            this.classList.remove('visible');
            this.hidden = true;
          }
        });
    },

  };

  SZ.Dialog = Dialog;
})();
