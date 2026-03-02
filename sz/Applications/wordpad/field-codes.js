;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let _editor, _markDirty, _escapeHtml;
  let _updateTimer = null;
  const _seqCounters = {};

  // ═══════════════════════════════════════════════════════════════
  // Init
  // ═══════════════════════════════════════════════════════════════

  function init(ctx) {
    _editor = ctx.editor;
    _markDirty = ctx.markDirty;
    _escapeHtml = ctx.escapeHtml;

    _editor.addEventListener('input', () => {
      clearTimeout(_updateTimer);
      _updateTimer = setTimeout(updateAllFields, 600);
    });

    // Allow clicking REF fields to scroll to target
    _editor.addEventListener('click', (e) => {
      const field = e.target.closest('.wp-field[data-field-type="REF"]');
      if (!field)
        return;
      const param = field.getAttribute('data-field-param');
      if (!param)
        return;
      const target = _editor.querySelector('#' + CSS.escape(param))
        || _editor.querySelector('[name="' + CSS.escape(param) + '"]')
        || _editor.querySelector('h1, h2, h3, h4, h5, h6');
      if (target)
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Date/Time Formatting
  // ═══════════════════════════════════════════════════════════════

  function formatDate(fmt) {
    const now = new Date();
    if (!fmt || fmt === 'short')
      return now.toLocaleDateString();
    if (fmt === 'long')
      return now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    if (fmt === 'iso')
      return now.toISOString().slice(0, 10);

    // Simple pattern replacement
    const pad = (n) => String(n).padStart(2, '0');
    return fmt
      .replace(/YYYY/g, String(now.getFullYear()))
      .replace(/YY/g, String(now.getFullYear()).slice(-2))
      .replace(/MM/g, pad(now.getMonth() + 1))
      .replace(/DD/g, pad(now.getDate()))
      .replace(/M(?!M)/g, String(now.getMonth() + 1))
      .replace(/D(?!D)/g, String(now.getDate()));
  }

  function formatTime(fmt) {
    const now = new Date();
    if (!fmt || fmt === 'short')
      return now.toLocaleTimeString();
    if (fmt === 'hm')
      return now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (fmt === '24')
      return now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });

    const pad = (n) => String(n).padStart(2, '0');
    return fmt
      .replace(/HH/g, pad(now.getHours()))
      .replace(/mm/g, pad(now.getMinutes()))
      .replace(/ss/g, pad(now.getSeconds()))
      .replace(/H(?!H)/g, String(now.getHours()))
      .replace(/h/g, String(now.getHours() % 12 || 12));
  }

  // ═══════════════════════════════════════════════════════════════
  // Numbering Helpers
  // ═══════════════════════════════════════════════════════════════

  function toRoman(num) {
    const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let result = '';
    let n = Math.max(1, Math.floor(num));
    for (let i = 0; i < vals.length; ++i) {
      while (n >= vals[i]) {
        result += syms[i];
        n -= vals[i];
      }
    }
    return result;
  }

  function toAlpha(num) {
    let result = '';
    let n = Math.max(1, Math.floor(num));
    while (n > 0) {
      --n;
      result = String.fromCharCode(65 + (n % 26)) + result;
      n = Math.floor(n / 26);
    }
    return result;
  }

  function formatSeqNumber(num, format) {
    if (format === 'alpha')
      return toAlpha(num);
    if (format === 'roman')
      return toRoman(num);
    return String(num);
  }

  // ═══════════════════════════════════════════════════════════════
  // Page Estimation
  // ═══════════════════════════════════════════════════════════════

  function estimatePageHeight() {
    const pageSizeEl = document.getElementById('rb-page-size');
    const orientEl = document.getElementById('rb-page-orient');
    const sizes = {
      a4: { w: 210 * 96 / 25.4, h: 297 * 96 / 25.4 },
      letter: { w: 8.5 * 96, h: 11 * 96 },
      legal: { w: 8.5 * 96, h: 14 * 96 },
      custom: { w: 8.5 * 96, h: 11 * 96 }
    };
    const sizeVal = pageSizeEl ? pageSizeEl.value : 'letter';
    const orientVal = orientEl ? orientEl.value : 'portrait';
    const size = sizes[sizeVal] || sizes.letter;
    return orientVal === 'landscape' ? size.w : size.h;
  }

  function estimatePageNumber(el) {
    if (!el || !_editor)
      return 1;
    const pageH = estimatePageHeight();
    if (pageH <= 0)
      return 1;
    const rect = el.getBoundingClientRect();
    const editorRect = _editor.getBoundingClientRect();
    const offsetTop = rect.top - editorRect.top + _editor.scrollTop;
    return Math.max(1, Math.ceil((offsetTop + 1) / pageH));
  }

  function estimateTotalPages() {
    if (!_editor)
      return 1;
    const pageH = estimatePageHeight();
    if (pageH <= 0)
      return 1;
    return Math.max(1, Math.ceil(_editor.scrollHeight / pageH));
  }

  // ═══════════════════════════════════════════════════════════════
  // Formula Evaluation
  // ═══════════════════════════════════════════════════════════════

  function evaluateFormula(expr) {
    if (!expr)
      return '?';
    // Only allow safe math expressions: digits, operators, parens, decimal
    const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '');
    if (!sanitized.trim())
      return '?';
    try {
      // Use Function constructor for a sandboxed eval
      const result = new Function('return (' + sanitized + ')')();
      if (typeof result !== 'number' || !isFinite(result))
        return 'Error';
      return String(Math.round(result * 1000000) / 1000000);
    } catch (e) {
      return 'Error';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Sequence Counters
  // ═══════════════════════════════════════════════════════════════

  function rebuildSequenceCounters() {
    for (const key of Object.keys(_seqCounters))
      delete _seqCounters[key];

    const fields = _editor.querySelectorAll('.wp-field[data-field-type="SEQ"]');
    for (const field of fields) {
      const param = field.getAttribute('data-field-param') || 'default';
      const parts = param.split(':');
      const label = parts[0] || 'default';
      const format = parts[1] || 'decimal';
      if (!_seqCounters[label])
        _seqCounters[label] = 0;
      ++_seqCounters[label];
      field.textContent = formatSeqNumber(_seqCounters[label], format);
    }
  }

  function getSequenceValue(label) {
    return _seqCounters[label] || 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // Field Evaluation
  // ═══════════════════════════════════════════════════════════════

  function evaluateField(span) {
    const type = span.getAttribute('data-field-type');
    const param = span.getAttribute('data-field-param') || '';

    switch (type) {
      case 'PAGE':
        return String(estimatePageNumber(span));
      case 'NUMPAGES':
        return String(estimateTotalPages());
      case 'DATE':
        return formatDate(param);
      case 'TIME':
        return formatTime(param);
      case 'SEQ':
        // SEQ fields are updated in batch by rebuildSequenceCounters
        return span.textContent || '0';
      case 'REF': {
        if (!param)
          return '[?ref]';
        // Look for bookmark or heading
        const target = _editor.querySelector('#' + CSS.escape(param))
          || _editor.querySelector('[name="' + CSS.escape(param) + '"]');
        if (target) {
          // If it's a bookmark anchor, get its parent text
          if (target.tagName === 'A' && !target.textContent.trim()) {
            const parent = target.parentElement;
            return parent ? parent.textContent.trim().slice(0, 60) : param;
          }
          return target.textContent.trim().slice(0, 60) || param;
        }
        // Try finding heading by text
        const headings = _editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (const h of headings) {
          if (h.textContent.trim() === param)
            return h.textContent.trim();
        }
        return '[' + param + ']';
      }
      case 'FORMULA':
        return evaluateFormula(param);
      default:
        return '[?]';
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Update All Fields
  // ═══════════════════════════════════════════════════════════════

  function updateAllFields() {
    if (!_editor)
      return;

    // Rebuild sequence counters first (order-dependent)
    rebuildSequenceCounters();

    // Update non-SEQ fields
    const fields = _editor.querySelectorAll('.wp-field');
    for (const field of fields) {
      const type = field.getAttribute('data-field-type');
      if (type === 'SEQ')
        continue; // already handled
      field.textContent = evaluateField(field);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Insert Field
  // ═══════════════════════════════════════════════════════════════

  function insertField(type, param) {
    if (!_editor)
      return;

    const span = document.createElement('span');
    span.className = 'wp-field';
    span.setAttribute('data-field-type', type);
    if (param)
      span.setAttribute('data-field-param', param);
    span.contentEditable = 'false';

    // Set initial display value
    const tempDisplay = evaluateField(span);
    span.textContent = tempDisplay || '[' + type + ']';

    const sel = window.getSelection();
    if (sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(span);
      // Move cursor after the field
      range.setStartAfter(span);
      range.setEndAfter(span);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      _editor.appendChild(span);
    }

    if (_markDirty)
      _markDirty();

    // Rebuild all counters after insertion
    updateAllFields();
  }

  // ═══════════════════════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════════════════════

  WP.FieldCodes = {
    init,
    insertField,
    updateAllFields,
    evaluateField,
    getSequenceValue,
    formatSeqNumber,
    toRoman,
    toAlpha
  };
})();
