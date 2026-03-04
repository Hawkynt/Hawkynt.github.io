;(function() {
  'use strict';
  const SS = window.SpreadsheetApp || (window.SpreadsheetApp = {});

  let ctx;

  function init(c) { ctx = c; }

  const DEFAULT_PROTECTION_OPTIONS = {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertColumns: false,
    insertRows: false,
    deleteColumns: false,
    deleteRows: false,
    sort: false,
    autoFilter: false,
  };

  function isCellLocked(col, row) {
    const fmt = ctx.getFormat(col, row);
    return fmt.locked !== false; // Default is locked (Excel convention)
  }

  function toggleCellLock() {
    const rect = ctx.getSelectionRect();
    const actions = [];
    for (let r = rect.r1; r <= rect.r2; ++r)
      for (let c = rect.c1; c <= rect.c2; ++c) {
        const oldFmt = Object.assign({}, ctx.getFormat(c, r));
        const newLocked = oldFmt.locked === false ? true : false;
        const newFmt = Object.assign({}, oldFmt, { locked: newLocked });
        actions.push({
          type: 'cell', col: c, row: r,
          oldVal: ctx.getCellRaw(c, r), newVal: ctx.getCellRaw(c, r),
          oldFmt, newFmt,
        });
        ctx.setFormat(c, r, newFmt);
      }
    if (actions.length) ctx.pushUndo({ type: 'multi', actions });
    ctx.rebuildGrid();
    ctx.setDirty();
  }

  function isActionBlocked(action) {
    const sheet = ctx.S();
    if (!sheet.protected) return false;

    const opts = sheet.protectionOptions || DEFAULT_PROTECTION_OPTIONS;

    switch (action) {
      // Cell editing
      case 'edit':
      case 'delete':
      case 'paste':
      case 'cut': {
        const ac = ctx.getActiveCell();
        return isCellLocked(ac.col, ac.row);
      }

      // Format operations
      case 'bold': case 'italic': case 'underline': case 'strikethrough':
      case 'font-color': case 'bg-color': case 'format-cells':
      case 'align-left': case 'align-center': case 'align-right':
      case 'valign-top': case 'valign-middle': case 'valign-bottom':
      case 'wrap-text': case 'merge-cells': case 'decimal-increase':
      case 'decimal-decrease': case 'thousands-sep':
      case 'borders-all': case 'borders-outer': case 'borders-none': case 'borders-bottom':
        return !opts.formatCells && isCellLocked(ctx.getActiveCell().col, ctx.getActiveCell().row);

      // Column operations
      case 'col-width': case 'col-autofit': case 'col-hide': case 'col-unhide':
        return !opts.formatColumns;

      // Row operations
      case 'row-height': case 'row-autofit': case 'row-hide': case 'row-unhide':
        return !opts.formatRows;

      // Insert/delete
      case 'insert-col': case 'insert-row':
        return action === 'insert-col' ? !opts.insertColumns : !opts.insertRows;
      case 'delete-col': case 'delete-row':
        return action === 'delete-col' ? !opts.deleteColumns : !opts.deleteRows;

      // Sort/filter
      case 'sort-asc': case 'sort-desc': case 'custom-sort':
        return !opts.sort;
      case 'auto-filter': case 'clear-filter':
        return !opts.autoFilter;

      default:
        return false;
    }
  }

  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function showProtectSheetDialog() {
    const sheet = ctx.S();

    if (sheet.protected) {
      // Show unprotect dialog
      return showUnprotectSheetDialog();
    }

    const overlay = document.getElementById('dlg-protect-sheet');
    if (!overlay) return;

    // Reset dialog
    document.getElementById('ps-password').value = '';
    document.getElementById('ps-confirm').value = '';

    // Reset checkboxes to defaults
    for (const [key, val] of Object.entries(DEFAULT_PROTECTION_OPTIONS)) {
      const cb = document.getElementById('ps-' + key.replace(/([A-Z])/g, '-$1').toLowerCase());
      if (cb) cb.checked = val;
    }

    const result = await SZ.Dialog.show(overlay.id);
    if (result !== 'ok') return;

    const password = document.getElementById('ps-password').value;
    const confirm = document.getElementById('ps-confirm').value;

    if (password && password !== confirm) {
      await ctx.User32.MessageBox('Passwords do not match.', 'Protect Sheet', 0);
      return;
    }

    sheet.protected = true;
    sheet.protectionPassword = password ? await hashPassword(password) : null;

    // Read protection options from checkboxes
    const opts = { ...DEFAULT_PROTECTION_OPTIONS };
    for (const key of Object.keys(opts)) {
      const cb = document.getElementById('ps-' + key.replace(/([A-Z])/g, '-$1').toLowerCase());
      if (cb) opts[key] = cb.checked;
    }
    sheet.protectionOptions = opts;

    updateProtectButton();
    ctx.setDirty();
  }

  async function showUnprotectSheetDialog() {
    const sheet = ctx.S();

    if (sheet.protectionPassword) {
      const overlay = document.getElementById('dlg-unprotect-sheet');
      if (!overlay) return;

      document.getElementById('ups-password').value = '';

      const result = await SZ.Dialog.show(overlay.id);
      if (result !== 'ok') return;

      const password = document.getElementById('ups-password').value;
      const hash = await hashPassword(password);

      if (hash !== sheet.protectionPassword) {
        await ctx.User32.MessageBox('Incorrect password.', 'Unprotect Sheet', 0);
        return;
      }
    }

    sheet.protected = false;
    sheet.protectionPassword = null;
    sheet.protectionOptions = null;

    updateProtectButton();
    ctx.setDirty();
  }

  function updateProtectButton() {
    const btn = document.querySelector('[data-action="protect-sheet"]');
    if (!btn) return;
    const label = btn.querySelector('.rb-label');
    if (label)
      label.textContent = ctx.S().protected ? 'Unprotect' : 'Protect';
  }

  SS.Protection = { init, isCellLocked, toggleCellLock, isActionBlocked, showProtectSheetDialog, updateProtectButton };
})();
