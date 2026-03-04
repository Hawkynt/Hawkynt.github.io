;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let ctx;

  // Template library - each generates HTML using flexbox layout
  const EQUATION_TEMPLATES = [
    {
      label: 'Fraction',
      category: 'Structures',
      html: '<span class="eq-frac"><span class="eq-num" contenteditable="true">a</span><span class="eq-den" contenteditable="true">b</span></span>'
    },
    {
      label: 'Square Root',
      category: 'Structures',
      html: '<span class="eq-sqrt"><span class="eq-radical">&radic;</span><span class="eq-radicand" contenteditable="true">x</span></span>'
    },
    {
      label: 'Nth Root',
      category: 'Structures',
      html: '<span class="eq-nthroot"><span class="eq-index" contenteditable="true">n</span><span class="eq-radical">&radic;</span><span class="eq-radicand" contenteditable="true">x</span></span>'
    },
    {
      label: 'Superscript',
      category: 'Structures',
      html: '<span class="eq-base" contenteditable="true">x</span><sup class="eq-sup" contenteditable="true">2</sup>'
    },
    {
      label: 'Subscript',
      category: 'Structures',
      html: '<span class="eq-base" contenteditable="true">x</span><sub class="eq-sub" contenteditable="true">i</sub>'
    },
    {
      label: 'Integral',
      category: 'Structures',
      html: '<span class="eq-bigop"><span class="eq-limit-sup" contenteditable="true">b</span><span class="eq-op">&int;</span><span class="eq-limit-sub" contenteditable="true">a</span></span><span class="eq-body" contenteditable="true">f(x)dx</span>'
    },
    {
      label: 'Sum',
      category: 'Structures',
      html: '<span class="eq-bigop"><span class="eq-limit-sup" contenteditable="true">n</span><span class="eq-op">&sum;</span><span class="eq-limit-sub" contenteditable="true">i=0</span></span><span class="eq-body" contenteditable="true">a_i</span>'
    },
    {
      label: 'Product',
      category: 'Structures',
      html: '<span class="eq-bigop"><span class="eq-limit-sup" contenteditable="true">n</span><span class="eq-op">&prod;</span><span class="eq-limit-sub" contenteditable="true">i=1</span></span><span class="eq-body" contenteditable="true">x_i</span>'
    },
    {
      label: '2\u00d72 Matrix',
      category: 'Structures',
      html: '<span class="eq-bracket">[</span><span class="eq-matrix"><span contenteditable="true">a</span><span contenteditable="true">b</span><span contenteditable="true">c</span><span contenteditable="true">d</span></span><span class="eq-bracket">]</span>'
    },
    {
      label: 'Parentheses',
      category: 'Structures',
      html: '<span class="eq-paren">(</span><span class="eq-body" contenteditable="true">x + y</span><span class="eq-paren">)</span>'
    },
    {
      label: 'Absolute',
      category: 'Structures',
      html: '<span class="eq-paren">|</span><span class="eq-body" contenteditable="true">x</span><span class="eq-paren">|</span>'
    },
  ];

  // Symbol library
  const EQUATION_SYMBOLS = {
    'Greek': [
      '\u03B1', '\u03B2', '\u03B3', '\u03B4', '\u03B5', '\u03B6', '\u03B7', '\u03B8',
      '\u03B9', '\u03BA', '\u03BB', '\u03BC', '\u03BD', '\u03BE', '\u03BF', '\u03C0',
      '\u03C1', '\u03C3', '\u03C4', '\u03C5', '\u03C6', '\u03C7', '\u03C8', '\u03C9',
      '\u0393', '\u0394', '\u0398', '\u039B', '\u039E', '\u03A0', '\u03A3', '\u03A6', '\u03A8', '\u03A9'
    ],
    'Operators': [
      '\u00B1', '\u00D7', '\u00F7', '\u2260', '\u2264', '\u2265', '\u226A', '\u226B',
      '\u2248', '\u2261', '\u221D', '\u2282', '\u2283', '\u2286', '\u2287', '\u222A',
      '\u2229', '\u2208', '\u2209', '\u2205', '\u221E', '\u2200', '\u2203'
    ],
    'Arrows': [
      '\u2190', '\u2191', '\u2192', '\u2193', '\u2194', '\u21D0', '\u21D2', '\u21D4', '\u21A6'
    ]
  };

  let editingEquation = null; // Currently editing equation span (for re-editing)

  function init(c) {
    ctx = c;

    // Build dialog content
    buildEquationDialog();

    // Double-click to edit existing equations
    ctx.editor.addEventListener('dblclick', (e) => {
      const eq = e.target.closest('.equation');
      if (!eq) return;
      editingEquation = eq;
      showEquationDialog(eq.innerHTML);
    });
  }

  function buildEquationDialog() {
    const dlg = document.getElementById('dlg-equation');
    if (!dlg) return;

    const body = dlg.querySelector('.dialog-body');
    if (!body) return;

    // Structures row
    const structDiv = document.createElement('div');
    structDiv.className = 'eq-templates';
    const structLabel = document.createElement('div');
    structLabel.className = 'eq-section-label';
    structLabel.textContent = 'Structures';
    structDiv.appendChild(structLabel);

    const templateBar = document.createElement('div');
    templateBar.className = 'eq-template-bar';

    for (const tpl of EQUATION_TEMPLATES) {
      const btn = document.createElement('button');
      btn.className = 'eq-tpl-btn';
      btn.title = tpl.label;
      btn.textContent = tpl.label;
      btn.addEventListener('click', () => {
        const preview = document.getElementById('eq-preview');
        if (preview) {
          // Insert at cursor in preview, or append
          preview.focus();
          document.execCommand('insertHTML', false, tpl.html);
        }
      });
      templateBar.appendChild(btn);
    }
    structDiv.appendChild(templateBar);
    body.insertBefore(structDiv, body.firstChild);

    // Symbols row
    const symDiv = document.createElement('div');
    symDiv.className = 'eq-symbols';
    const symLabel = document.createElement('div');
    symLabel.className = 'eq-section-label';
    symLabel.textContent = 'Symbols';
    symDiv.appendChild(symLabel);

    const symToolbar = document.createElement('div');
    symToolbar.className = 'eq-sym-toolbar';

    const catSelect = document.createElement('select');
    catSelect.className = 'eq-cat-select';
    for (const cat of Object.keys(EQUATION_SYMBOLS)) {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catSelect.appendChild(opt);
    }
    symToolbar.appendChild(catSelect);

    const symGrid = document.createElement('div');
    symGrid.className = 'eq-sym-grid';

    function populateSymbols(category) {
      symGrid.innerHTML = '';
      const symbols = EQUATION_SYMBOLS[category] || [];
      for (const sym of symbols) {
        const cell = document.createElement('button');
        cell.className = 'eq-sym-cell';
        cell.textContent = sym;
        cell.title = 'U+' + sym.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
        cell.addEventListener('click', () => {
          const preview = document.getElementById('eq-preview');
          if (preview) {
            preview.focus();
            document.execCommand('insertText', false, sym);
          }
        });
        symGrid.appendChild(cell);
      }
    }

    catSelect.addEventListener('change', () => populateSymbols(catSelect.value));
    populateSymbols('Greek');

    symDiv.appendChild(symToolbar);
    symDiv.appendChild(symGrid);
    body.insertBefore(symDiv, body.querySelector('.eq-preview-container') || body.lastChild);
  }

  function showEquationDialog(initialContent) {
    const preview = document.getElementById('eq-preview');
    if (preview) {
      preview.innerHTML = initialContent || '';
      setTimeout(() => preview.focus(), 50);
    }

    SZ.Dialog.show('dlg-equation').then((result) => {
      if (result !== 'ok') {
        editingEquation = null;
        return;
      }

      if (!preview) return;
      const content = preview.innerHTML.trim();
      if (!content) {
        editingEquation = null;
        return;
      }

      if (editingEquation) {
        editingEquation.innerHTML = content;
        editingEquation = null;
      } else {
        const eqSpan = '<span class="equation" contenteditable="false">' + content + '</span>&nbsp;';
        ctx.editor.focus();
        document.execCommand('insertHTML', false, eqSpan);
      }

      ctx.markDirty();
    });
  }

  function insertEquation() {
    editingEquation = null;
    showEquationDialog('');
  }

  WP.EquationEditor = { init, insertEquation, showEquationDialog };
})();
