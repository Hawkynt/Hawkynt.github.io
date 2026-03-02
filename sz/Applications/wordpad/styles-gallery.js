;(function() {
  'use strict';
  const WP = window.WordPadApp || (window.WordPadApp = {});

  let ctx;
  let activeStyleId = 'normal';
  let stylesContextMenu = null;

  const DEFAULT_STYLES = [
    { id: 'normal', name: 'Normal', tag: 'p', css: { fontFamily: 'Calibri, sans-serif', fontSize: '11pt', fontWeight: 'normal', color: '#000000', fontStyle: 'normal', lineHeight: '1.15' } },
    { id: 'no-spacing', name: 'No Spacing', tag: 'p', css: { fontFamily: 'Calibri, sans-serif', fontSize: '11pt', fontWeight: 'normal', color: '#000000', fontStyle: 'normal', lineHeight: '1.0' } },
    { id: 'heading1', name: 'Heading 1', tag: 'h1', css: { fontFamily: 'Calibri Light, Calibri, sans-serif', fontSize: '24pt', fontWeight: 'bold', color: '#2e74b5', fontStyle: 'normal', lineHeight: '1.1' } },
    { id: 'heading2', name: 'Heading 2', tag: 'h2', css: { fontFamily: 'Calibri Light, Calibri, sans-serif', fontSize: '18pt', fontWeight: 'bold', color: '#2e74b5', fontStyle: 'normal', lineHeight: '1.15' } },
    { id: 'heading3', name: 'Heading 3', tag: 'h3', css: { fontFamily: 'Calibri Light, Calibri, sans-serif', fontSize: '14pt', fontWeight: 'bold', color: '#1f4d78', fontStyle: 'normal', lineHeight: '1.15' } },
    { id: 'heading4', name: 'Heading 4', tag: 'h4', css: { fontFamily: 'Calibri Light, Calibri, sans-serif', fontSize: '12pt', fontWeight: 'bold', color: '#1f4d78', fontStyle: 'italic', lineHeight: '1.15' } },
    { id: 'title', name: 'Title', tag: 'h1', css: { fontFamily: 'Calibri Light, Calibri, sans-serif', fontSize: '28pt', fontWeight: 'normal', color: '#000000', fontStyle: 'normal', lineHeight: '1.1' } },
    { id: 'subtitle', name: 'Subtitle', tag: 'h2', css: { fontFamily: 'Calibri, sans-serif', fontSize: '14pt', fontWeight: 'normal', color: '#5a5a5a', fontStyle: 'italic', lineHeight: '1.15' } },
    { id: 'quote', name: 'Quote', tag: 'blockquote', css: { fontFamily: 'Calibri, sans-serif', fontSize: '11pt', fontWeight: 'normal', color: '#404040', fontStyle: 'italic', lineHeight: '1.3' } },
    { id: 'code', name: 'Code', tag: 'pre', css: { fontFamily: 'Consolas, Courier New, monospace', fontSize: '10pt', fontWeight: 'normal', color: '#333333', fontStyle: 'normal', lineHeight: '1.4' } }
  ];

  let customStyles = [];

  function init(c) {
    ctx = c;
    loadCustomStylesFromStorage();

    // Create context menu
    stylesContextMenu = document.createElement('div');
    stylesContextMenu.className = 'popup-menu styles-context-menu';
    document.body.appendChild(stylesContextMenu);

    document.addEventListener('pointerdown', (e) => {
      if (stylesContextMenu && !stylesContextMenu.contains(e.target))
        stylesContextMenu.classList.remove('visible');
    });

    renderStylesGallery();
    wireManageStylesDialog();
  }

  function getAllStyles() {
    return [...DEFAULT_STYLES, ...customStyles];
  }

  function renderStylesGallery() {
    const gallery = document.getElementById('styles-gallery');
    if (!gallery)
      return;
    gallery.innerHTML = '';

    for (const style of getAllStyles()) {
      const tile = document.createElement('div');
      tile.className = 'style-tile';
      if (style.id === activeStyleId)
        tile.classList.add('active');
      tile.textContent = style.name;
      tile.title = style.name;

      // Apply preview styling
      tile.style.fontFamily = style.css.fontFamily;
      tile.style.fontWeight = style.css.fontWeight;
      tile.style.fontStyle = style.css.fontStyle;
      tile.style.color = style.css.color;

      tile.addEventListener('click', () => {
        applyDocumentStyle(style);
        activeStyleId = style.id;
        renderStylesGallery();
      });

      tile.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showStyleContextMenu(e, style);
      });

      gallery.appendChild(tile);
    }
  }

  function applyDocumentStyle(style) {
    document.execCommand('formatBlock', false, '<' + style.tag + '>');

    const sel = window.getSelection();
    if (!sel.rangeCount)
      return;

    let container = sel.focusNode;
    if (container && container.nodeType === 3)
      container = container.parentElement;

    const block = container ? container.closest('p, h1, h2, h3, h4, h5, h6, blockquote, pre, div') : null;
    if (block) {
      block.style.fontFamily = style.css.fontFamily;
      block.style.fontSize = style.css.fontSize;
      block.style.fontWeight = style.css.fontWeight;
      block.style.color = style.css.color;
      block.style.fontStyle = style.css.fontStyle;
      block.style.lineHeight = style.css.lineHeight;
    }

    ctx.editor.focus();
    ctx.markDirty();
  }

  function showStyleContextMenu(e, style) {
    stylesContextMenu.innerHTML = '';

    const applyItem = document.createElement('div');
    applyItem.className = 'popup-entry';
    applyItem.textContent = 'Apply Style';
    applyItem.addEventListener('click', () => {
      applyDocumentStyle(style);
      activeStyleId = style.id;
      renderStylesGallery();
      stylesContextMenu.classList.remove('visible');
    });
    stylesContextMenu.appendChild(applyItem);

    const modifyItem = document.createElement('div');
    modifyItem.className = 'popup-entry';
    modifyItem.textContent = 'Modify Style...';
    modifyItem.addEventListener('click', () => {
      stylesContextMenu.classList.remove('visible');
      showModifyStyleDialog(style);
    });
    stylesContextMenu.appendChild(modifyItem);

    const defaultItem = document.createElement('div');
    defaultItem.className = 'popup-entry';
    defaultItem.textContent = 'Set as Default';
    defaultItem.addEventListener('click', () => {
      activeStyleId = style.id;
      renderStylesGallery();
      stylesContextMenu.classList.remove('visible');
    });
    stylesContextMenu.appendChild(defaultItem);

    // Only allow deleting custom styles
    const isCustom = customStyles.some(s => s.id === style.id);
    if (isCustom) {
      const sep = document.createElement('div');
      sep.className = 'popup-separator';
      stylesContextMenu.appendChild(sep);

      const deleteItem = document.createElement('div');
      deleteItem.className = 'popup-entry';
      deleteItem.textContent = 'Delete';
      deleteItem.addEventListener('click', () => {
        customStyles = customStyles.filter(s => s.id !== style.id);
        saveCustomStylesToStorage();
        renderStylesGallery();
        stylesContextMenu.classList.remove('visible');
      });
      stylesContextMenu.appendChild(deleteItem);
    }

    stylesContextMenu.style.left = e.clientX + 'px';
    stylesContextMenu.style.top = e.clientY + 'px';
    stylesContextMenu.classList.add('visible');
  }

  function showModifyStyleDialog(style) {
    const nameInput = document.getElementById('ms-name');
    const tagSelect = document.getElementById('ms-tag');
    const fontInput = document.getElementById('ms-font');
    const sizeInput = document.getElementById('ms-size');
    const colorInput = document.getElementById('ms-color');
    const boldCheck = document.getElementById('ms-bold');
    const italicCheck = document.getElementById('ms-italic');
    const lineHeightInput = document.getElementById('ms-line-height');
    const addBtn = document.getElementById('ms-add');
    const updateBtn = document.getElementById('ms-update');
    const deleteBtn = document.getElementById('ms-delete');

    if (!nameInput)
      return;

    // Pre-fill
    nameInput.value = style ? style.name : '';
    tagSelect.value = style ? style.tag : 'p';
    fontInput.value = style ? style.css.fontFamily.split(',')[0].trim() : 'Calibri';
    sizeInput.value = style ? parseInt(style.css.fontSize, 10) : 11;
    colorInput.value = style ? style.css.color : '#000000';
    boldCheck.checked = style ? style.css.fontWeight === 'bold' : false;
    italicCheck.checked = style ? style.css.fontStyle === 'italic' : false;
    lineHeightInput.value = style ? style.css.lineHeight : '1.15';

    const isCustom = style ? customStyles.some(s => s.id === style.id) : false;
    const isBuiltIn = style ? DEFAULT_STYLES.some(s => s.id === style.id) : false;

    addBtn.style.display = (!style || isBuiltIn) ? '' : 'none';
    updateBtn.style.display = isCustom ? '' : 'none';
    deleteBtn.style.display = isCustom ? '' : 'none';

    SZ.Dialog.show('dlg-manage-styles').then((result) => {
      const css = {
        fontFamily: fontInput.value || 'Calibri, sans-serif',
        fontSize: (sizeInput.value || '11') + 'pt',
        fontWeight: boldCheck.checked ? 'bold' : 'normal',
        color: colorInput.value || '#000000',
        fontStyle: italicCheck.checked ? 'italic' : 'normal',
        lineHeight: lineHeightInput.value || '1.15'
      };

      if (result === 'add') {
        const name = nameInput.value.trim();
        if (!name)
          return;
        const id = 'custom-' + Date.now();
        customStyles.push({ id, name, tag: tagSelect.value, css });
        saveCustomStylesToStorage();
        renderStylesGallery();
      } else if (result === 'update' && isCustom) {
        const existing = customStyles.find(s => s.id === style.id);
        if (existing) {
          existing.name = nameInput.value.trim() || existing.name;
          existing.tag = tagSelect.value;
          existing.css = css;
          saveCustomStylesToStorage();
          renderStylesGallery();
        }
      } else if (result === 'delete' && isCustom) {
        customStyles = customStyles.filter(s => s.id !== style.id);
        saveCustomStylesToStorage();
        renderStylesGallery();
      }
    });
  }

  function showManageStylesDialog() {
    showModifyStyleDialog(null);
  }

  function wireManageStylesDialog() {
    // Dialog buttons are wired by SZ.Dialog.wireAll() already
  }

  function saveCustomStylesToStorage() {
    try {
      localStorage.setItem('sz-wordpad-custom-styles', JSON.stringify(customStyles));
    } catch (e) { /* ignore */ }
  }

  function loadCustomStylesFromStorage() {
    try {
      const saved = localStorage.getItem('sz-wordpad-custom-styles');
      if (saved)
        customStyles = JSON.parse(saved);
    } catch (e) {
      customStyles = [];
    }
  }

  WP.StylesGallery = { init, renderStylesGallery, applyDocumentStyle, showModifyStyleDialog, showManageStylesDialog };
})();
