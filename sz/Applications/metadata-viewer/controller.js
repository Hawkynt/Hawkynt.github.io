;(function() {
  'use strict';

  const { User32, Kernel32, Shell32, ComDlg32 } = SZ.Dlls;
  const Parsers = SZ.MetadataParsers;
  const Editors = SZ.MetadataEditors;

  // =========================================================================
  // State
  // =========================================================================
  let currentBytes = null;
  let currentFileName = null;
  let currentFilePath = null;
  let parseResult = null;
  let hashResults = null;
  let modifications = new Map();
  let activeCategory = 0;
  let dirty = false;
  let showPreviewPanel = true;
  let hashAbortFlag = false;

  const MP4_ILST_LABELS = {
    'mp4.ilst._nam': 'Title', 'mp4.ilst._ART': 'Artist', 'mp4.ilst._alb': 'Album',
    'mp4.ilst._day': 'Year', 'mp4.ilst._gen': 'Genre', 'mp4.ilst._cmt': 'Comment',
    'mp4.ilst._wrt': 'Composer', 'mp4.ilst.aART': 'Album Artist', 'mp4.ilst._too': 'Encoder',
    'mp4.ilst._grp': 'Grouping', 'mp4.ilst.desc': 'Description', 'mp4.ilst.ldes': 'Long Description',
    'mp4.ilst._lyr': 'Lyrics', 'mp4.ilst.cprt': 'Copyright',
  };

  // =========================================================================
  // DOM refs
  // =========================================================================
  const dropZone = document.getElementById('drop-zone');
  const fileHeader = document.getElementById('file-header');
  const fileTypeBadge = document.getElementById('file-type-badge');
  const fileNameEl = document.getElementById('file-name');
  const fileSizeEl = document.getElementById('file-size');
  const mainContent = document.getElementById('main-content');
  const categoryTabs = document.getElementById('category-tabs');
  const metadataTbody = document.getElementById('metadata-tbody');
  const rightPanel = document.getElementById('right-panel');
  const panelSplitter = document.getElementById('panel-splitter');
  const previewAccordion = document.getElementById('preview-accordion');
  const btnOpenArchiver = document.getElementById('btn-open-archiver');
  const statusType = document.getElementById('status-type');
  const statusSize = document.getElementById('status-size');
  const statusEntropy = document.getElementById('status-entropy');
  const statusModified = document.getElementById('status-modified');

  const ARCHIVE_TYPE_IDS = new Set([
    'zip', 'rar', '7z', 'gzip', 'tar', 'xz', 'lz4', 'lzip', 'zstd', 'bzip2',
    'arj', 'cab', 'xar', 'deb', 'rpm', 'iso', 'apk', 'jar', 'crx',
    'epub', 'docx', 'xlsx', 'pptx', 'odf',
  ]);

  // =========================================================================
  // Title
  // =========================================================================
  function updateTitle() {
    const prefix = dirty ? '*' : '';
    const name = currentFileName || 'Metadata Viewer';
    const title = prefix + name + ' - Metadata Viewer';
    document.title = title;
    User32.SetWindowText(title);
  }

  // =========================================================================
  // File loading
  // =========================================================================
  // Detect and decode data URL bytes returned from VFS value nodes
  function resolveVfsBytes(raw) {
    if (!(raw instanceof Uint8Array) || raw.length < 10) return raw;
    // Check for JSON-quoted data URL: "data:..."
    if (raw[0] === 0x22 && raw[raw.length - 1] === 0x22) {
      const inner = raw.subarray(1, raw.length - 1);
      if (inner[0] === 0x64 && inner[1] === 0x61 && inner[2] === 0x74 && inner[3] === 0x61 && inner[4] === 0x3A)
        return decodeDataUrlBytes(inner);
    }
    // Check for unquoted data URL: data:...
    if (raw[0] === 0x64 && raw[1] === 0x61 && raw[2] === 0x74 && raw[3] === 0x61 && raw[4] === 0x3A)
      return decodeDataUrlBytes(raw);
    return raw;
  }

  function decodeDataUrlBytes(urlBytes) {
    const text = new TextDecoder().decode(urlBytes);
    const match = text.match(/^data:([^,]*),(.*)$/);
    if (!match) return urlBytes;
    if (/;\s*base64/i.test(match[1])) {
      try {
        const binary = atob(match[2]);
        const result = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; ++i)
          result[i] = binary.charCodeAt(i);
        return result;
      } catch (_) { return urlBytes; }
    }
    // URL-encoded data URL
    try {
      const decoded = decodeURIComponent(match[2]);
      const result = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; ++i)
        result[i] = decoded.charCodeAt(i) & 0xFF;
      return result;
    } catch (_) { return urlBytes; }
  }

  function loadFromBytes(bytes, name, path) {
    hashAbortFlag = true; // cancel any pending hash computation
    currentBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    currentBytes = resolveVfsBytes(currentBytes);
    currentFileName = name || 'Unknown';
    currentFilePath = path || null;
    modifications.clear();
    dirty = false;
    hashResults = null;

    // Parse
    parseResult = Parsers.parse(currentBytes, currentFileName);

    // Show UI
    dropZone.classList.add('hidden');
    fileHeader.classList.add('visible');
    mainContent.classList.add('visible');

    // File header
    fileTypeBadge.textContent = parseResult.fileType.category;
    fileTypeBadge.className = 'file-type-badge ' + parseResult.fileType.category;
    fileNameEl.textContent = currentFileName;
    fileNameEl.title = parseResult.fileType.name;
    fileSizeEl.textContent = Parsers.formatSize(currentBytes.length);

    // Status bar
    statusType.textContent = parseResult.fileType.name;
    statusSize.textContent = Parsers.formatSize(currentBytes.length);
    statusEntropy.textContent = 'Entropy: ' + Parsers.computeEntropy(currentBytes).toFixed(2) + ' b/B';
    statusModified.textContent = '';

    // Enable menus
    enableMenus();

    // Render
    activeCategory = 0;
    renderCategoryTabs();
    renderMetadata();
    renderPreviewAccordion();
    updateArchiverButton();
    updateTitle();

    // Resolve deferred archive contents if async parse was needed
    if (parseResult.categories._archivePromise)
      parseResult.categories._archivePromise.then(contentsCat => {
        if (!contentsCat) return;
        // Replace the placeholder "Contents" category with the real one
        const idx = parseResult.categories.findIndex(c => c.fields && c.fields.some(f => f.key === 'archive.loading'));
        if (idx >= 0)
          parseResult.categories.splice(idx, 1, contentsCat);
        else
          parseResult.categories.push(contentsCat);
        renderCategoryTabs();
        renderMetadata();
      }).catch(() => { /* silently ignore failed archive parse */ });

    // Compute hashes async
    computeHashes();
  }

  function enableMenus() {
    document.getElementById('menu-copy-all').classList.remove('disabled');
    document.getElementById('menu-export').classList.remove('disabled');
    if (Editors.isEditable(parseResult.fileType.id))
      document.getElementById('menu-save').classList.remove('disabled');
  }

  // =========================================================================
  // Category tabs
  // =========================================================================
  function getAllCategories() {
    const cats = [...parseResult.categories];
    const ftId = parseResult.fileType.id;
    // Add virtual "Text Chunks" tab for PNG if there are new text modifications but no existing tab
    if (ftId === 'png' && !cats.some(c => c.name === 'Text Chunks')) {
      const hasTextMods = [...modifications.keys()].some(k => k.startsWith('png.text.') || k.startsWith('png.itext.'));
      if (hasTextMods)
        cats.push({ name: 'Text Chunks', icon: 'text', fields: [] });
    }
    // Add virtual "iTunes Metadata" tab for MP4 if there are new modifications but no existing tab
    if (ftId === 'mp4' && !cats.some(c => c.name === 'iTunes Metadata')) {
      const hasMp4Mods = [...modifications.keys()].some(k => k.startsWith('mp4.ilst.'));
      if (hasMp4Mods)
        cats.push({ name: 'iTunes Metadata', icon: 'music', fields: [] });
    }
    // Add virtual "Document Properties" tab for OOXML if there are new modifications but no existing tab
    if (['docx', 'xlsx', 'pptx', 'ooxml'].includes(ftId) && !cats.some(c => c.name === 'Document Properties')) {
      const hasOoxmlMods = [...modifications.keys()].some(k => k.startsWith('ooxml.'));
      if (hasOoxmlMods)
        cats.push({ name: 'Document Properties', icon: 'document', fields: [] });
    }
    cats.push({ name: 'Hashes & Checksums', icon: 'hash', fields: [] });
    return cats;
  }

  function renderCategoryTabs() {
    categoryTabs.innerHTML = '';
    const allCategories = getAllCategories();

    allCategories.forEach((cat, i) => {
      const tab = document.createElement('button');
      tab.className = 'category-tab' + (i === activeCategory ? ' active' : '');
      tab.textContent = cat.name;
      tab.addEventListener('click', () => {
        activeCategory = i;
        renderCategoryTabs();
        renderMetadata();
      });
      categoryTabs.appendChild(tab);
    });
  }

  // =========================================================================
  // Metadata table rendering
  // =========================================================================
  function renderMetadata() {
    metadataTbody.innerHTML = '';
    const allCategories = getAllCategories();
    const cat = allCategories[activeCategory];
    if (!cat) return;

    // Hashes tab
    if (cat.name === 'Hashes & Checksums') {
      renderHashesTab();
      return;
    }

    // Collect effective fields: originals + any added tags
    const effectiveFields = [...cat.fields];
    if (Editors.isEditable(parseResult.fileType.id)) {
      for (const [key, value] of modifications) {
        if (value === null) continue; // removal marker
        if (effectiveFields.some(f => f.key === key)) continue; // already shown
        // Check this key belongs in the current category
        const belongsHere = (cat.name === 'Text Chunks' && (key.startsWith('png.text.') || key.startsWith('png.itext.')))
          || (cat.name === 'ID3v2' && (key.startsWith('id3.') && !key.startsWith('id3v1.')))
          || (cat.name === 'ID3v1' && key.startsWith('id3v1.'))
          || (cat.name === 'iTunes Metadata' && key.startsWith('mp4.ilst.'))
          || (cat.name === 'Document Properties' && key.startsWith('ooxml.'));
        if (!belongsHere) continue;
        const label = key.startsWith('png.text.') ? key.substring(9)
          : key.startsWith('png.itext.') ? key.substring(10) + ' (iTXt)'
          : key.startsWith('mp4.ilst.') ? MP4_ILST_LABELS[key] || key.substring(9)
          : key.startsWith('ooxml.') ? key.substring(6).charAt(0).toUpperCase() + key.substring(7)
          : key.startsWith('id3.TXXX.') ? key.substring(9)
          : ID3_TAG_OPTIONS[key] || key;
        const editType = (key === 'id3.TCON' || key === 'id3.TCO') ? 'genre' : 'text';
        effectiveFields.push({ key, label, value, editable: true, editType, isNew: true });
      }
    }

    for (const field of effectiveFields) {
      const isRemoved = modifications.get(field.key) === null;
      const tr = document.createElement('tr');
      if (isRemoved)
        tr.classList.add('field-removed');
      else if (modifications.has(field.key))
        tr.classList.add('field-modified');

      const tdLabel = document.createElement('td');
      tdLabel.className = 'field-label';
      tdLabel.textContent = field.label;
      tr.appendChild(tdLabel);

      const tdValue = document.createElement('td');
      const displayValue = isRemoved ? '(removed)' : (modifications.has(field.key) ? modifications.get(field.key) : field.value);

      if (field.editable && Editors.isEditable(parseResult.fileType.id)) {
        tdValue.className = 'field-editable';
        const span = document.createElement('span');
        span.className = 'field-value';
        span.textContent = displayValue;
        if (isRemoved) span.classList.add('removed-text');
        tdValue.appendChild(span);

        if (!isRemoved) {
          const editBtn = document.createElement('button');
          editBtn.className = 'field-edit-btn';
          editBtn.textContent = '\u270E';
          editBtn.title = 'Edit';
          editBtn.addEventListener('click', () => startEdit(tr, field, span, editBtn));
          tdValue.appendChild(editBtn);

          const removeBtn = document.createElement('button');
          removeBtn.className = 'field-edit-btn field-remove-btn';
          removeBtn.textContent = '\u2715';
          removeBtn.title = 'Remove';
          removeBtn.addEventListener('click', () => removeField(field.key));
          tdValue.appendChild(removeBtn);
        } else {
          const restoreBtn = document.createElement('button');
          restoreBtn.className = 'field-edit-btn';
          restoreBtn.textContent = '\u21A9';
          restoreBtn.title = 'Restore';
          restoreBtn.addEventListener('click', () => restoreField(field.key));
          tdValue.appendChild(restoreBtn);
        }
      } else {
        tdValue.className = 'field-value';
        if (field.value && field.value.includes('\n')) {
          tdValue.style.whiteSpace = 'pre-wrap';
          tdValue.style.fontFamily = "'Cascadia Code', 'Consolas', monospace";
          tdValue.style.fontSize = '10px';
        }
        tdValue.textContent = displayValue;
      }

      tr.appendChild(tdValue);
      metadataTbody.appendChild(tr);

      // Expandable rows (e.g., PE imports with per-function children)
      if (field.expandable && field.children && field.children.length > 0) {
        const childRows = [];
        for (let ci = 0; ci < field.children.length; ++ci) {
          const childTr = document.createElement('tr');
          childTr.className = 'expandable-child';
          childTr.style.display = 'none';
          const childTdLabel = document.createElement('td');
          childTdLabel.className = 'field-label expandable-child-label';
          childTdLabel.textContent = '';
          const childTdValue = document.createElement('td');
          childTdValue.className = 'field-value expandable-child-value';
          childTdValue.textContent = field.children[ci];
          childTr.appendChild(childTdLabel);
          childTr.appendChild(childTdValue);
          metadataTbody.appendChild(childTr);
          childRows.push(childTr);
        }
        tr.classList.add('expandable-parent');
        const chevron = document.createElement('span');
        chevron.className = 'expand-chevron';
        chevron.textContent = '\u25B6';
        tdLabel.insertBefore(chevron, tdLabel.firstChild);
        tr.addEventListener('click', () => {
          const visible = childRows[0].style.display !== 'none';
          for (const cr of childRows) cr.style.display = visible ? 'none' : '';
          chevron.textContent = visible ? '\u25B6' : '\u25BC';
        });
      }
    }

    // "Add Tag" button for editable text chunks (PNG)
    const ftId = parseResult.fileType.id;
    if (Editors.isEditable(ftId)) {
      const showPngAdd = ftId === 'png' && (cat.name === 'Text Chunks' || (cat.name === 'Image' && !parseResult.categories.some(c => c.name === 'Text Chunks')));
      const showMp4Add = ftId === 'mp4' && cat.name === 'iTunes Metadata';
      const showOoxmlAdd = ['docx', 'xlsx', 'pptx', 'ooxml'].includes(ftId) && cat.name === 'Document Properties';
      const showId3Add = ftId === 'mp3' && cat.name === 'ID3v2';
      if (showPngAdd || showMp4Add || showOoxmlAdd || showId3Add) {
        const tr = document.createElement('tr');
        tr.className = 'add-tag-row';
        const td = document.createElement('td');
        td.colSpan = 2;
        const btn = document.createElement('button');
        btn.className = 'add-tag-btn';
        btn.textContent = showPngAdd ? '+ Add Text Tag' : '+ Add Tag';
        btn.addEventListener('click', () => showPngAdd ? showAddTagDialog() : showMp4Add ? showAddMp4Dialog() : showId3Add ? showAddId3Dialog() : showAddOoxmlDialog());
        td.appendChild(btn);
        tr.appendChild(td);
        metadataTbody.appendChild(tr);
      }
    }
  }

  function markDirty(key, value) {
    modifications.set(key, value);
    dirty = true;
    updateTitle();
    updateModifiedStatus();
    document.getElementById('menu-save').classList.remove('disabled');
    document.getElementById('menu-revert').classList.remove('disabled');
  }

  function startEdit(tr, field, span, btn) {
    const currentValue = modifications.has(field.key) ? modifications.get(field.key) : field.value;
    const parent = span.parentElement;
    parent.innerHTML = '';

    // --- Select (dropdown) edit type ---
    if (field.editType === 'select' && field.options) {
      const sel = document.createElement('select');
      sel.className = 'field-edit-input';
      for (const opt of field.options) {
        const o = document.createElement('option');
        o.value = opt.value != null ? opt.value : opt.label;
        o.textContent = opt.label;
        if (String(o.value) === String(currentValue) || opt.label === currentValue) o.selected = true;
        sel.appendChild(o);
      }
      parent.appendChild(sel);
      sel.focus();
      function commitSel() {
        if (sel.value !== field.value) markDirty(field.key, sel.value);
        renderMetadata();
      }
      sel.addEventListener('change', commitSel);
      sel.addEventListener('blur', commitSel);
      sel.addEventListener('keydown', (e) => { if (e.key === 'Escape') renderMetadata(); });
      return;
    }

    // --- Number edit type ---
    if (field.editType === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'field-edit-input';
      input.value = currentValue;
      if (field.min != null) input.min = field.min;
      if (field.max != null) input.max = field.max;
      if (field.step != null) input.step = field.step;
      parent.appendChild(input);
      input.focus();
      input.select();
      function commitNum() {
        if (input.value !== field.value) markDirty(field.key, input.value);
        renderMetadata();
      }
      input.addEventListener('blur', commitNum);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commitNum();
        if (e.key === 'Escape') renderMetadata();
      });
      return;
    }

    // --- Date edit type ---
    if (field.editType === 'date') {
      const input = document.createElement('input');
      input.type = 'datetime-local';
      input.className = 'field-edit-input';
      // Convert EXIF date format "YYYY:MM:DD HH:MM:SS" to ISO
      const isoVal = String(currentValue).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(/ /, 'T');
      input.value = isoVal.substring(0, 16);
      parent.appendChild(input);
      input.focus();
      function commitDate() {
        // Convert back to EXIF format
        const v = input.value.replace(/-/g, ':').replace('T', ' ');
        const exifDate = v.length >= 16 ? v.substring(0, 10).replace(/-/g, ':') + ' ' + v.substring(11) + ':00' : v;
        if (exifDate !== field.value) markDirty(field.key, exifDate);
        renderMetadata();
      }
      input.addEventListener('blur', commitDate);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commitDate();
        if (e.key === 'Escape') renderMetadata();
      });
      return;
    }

    // --- Image edit type (thumbnail / album art / cover) ---
    if (field.editType === 'image') {
      const toolbar = document.createElement('div');
      toolbar.className = 'image-edit-toolbar';

      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'field-edit-btn';
      replaceBtn.textContent = 'Replace\u2026';
      replaceBtn.title = 'Replace with new image';
      replaceBtn.addEventListener('click', () => {
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.accept = 'image/*';
        picker.addEventListener('change', () => {
          if (!picker.files.length) return;
          const reader = new FileReader();
          reader.onload = () => {
            const ab = new Uint8Array(reader.result);
            markDirty(field.key, { type: 'image', bytes: ab, mimeType: picker.files[0].type || 'image/jpeg' });
            renderMetadata();
          };
          reader.readAsArrayBuffer(picker.files[0]);
        });
        picker.click();
      });

      const removeBtn = document.createElement('button');
      removeBtn.className = 'field-edit-btn field-remove-btn';
      removeBtn.textContent = 'Remove';
      removeBtn.title = 'Remove image';
      removeBtn.addEventListener('click', () => {
        markDirty(field.key, null);
        renderMetadata();
      });

      toolbar.appendChild(replaceBtn);
      toolbar.appendChild(removeBtn);

      // Thumbnail regenerate button (EXIF thumbnails only)
      if (field.key === 'exif.thumbnail') {
        const regenBtn = document.createElement('button');
        regenBtn.className = 'field-edit-btn';
        regenBtn.textContent = 'Regenerate';
        regenBtn.title = 'Regenerate thumbnail from main image';
        regenBtn.addEventListener('click', () => {
          if (!currentBytes) return;
          const blob = new Blob([currentBytes], { type: 'image/jpeg' });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(160 / img.width, 120 / img.height, 1);
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((thumbBlob) => {
              URL.revokeObjectURL(url);
              if (!thumbBlob) return;
              const reader = new FileReader();
              reader.onload = () => {
                markDirty(field.key, { type: 'image', bytes: new Uint8Array(reader.result), mimeType: 'image/jpeg' });
                renderMetadata();
              };
              reader.readAsArrayBuffer(thumbBlob);
            }, 'image/jpeg', 0.85);
          };
          img.onerror = () => URL.revokeObjectURL(url);
          img.src = url;
        });
        toolbar.appendChild(regenBtn);
      }

      parent.appendChild(toolbar);
      return;
    }

    // --- Geo coordinate edit type ---
    if (field.editType === 'geo') {
      const toolbar = document.createElement('div');
      toolbar.className = 'geo-edit-toolbar';

      const latInput = document.createElement('input');
      latInput.type = 'number';
      latInput.step = '0.000001';
      latInput.className = 'field-edit-input geo-input';
      latInput.placeholder = 'Latitude';
      latInput.title = 'Latitude';

      const lngInput = document.createElement('input');
      lngInput.type = 'number';
      lngInput.step = '0.000001';
      lngInput.className = 'field-edit-input geo-input';
      lngInput.placeholder = 'Longitude';
      lngInput.title = 'Longitude';

      // Parse current value — try to extract decimal degrees
      const coordMatch = String(currentValue).match(/([-\d.]+)[°\s].*?([-\d.]+)[°\s]/);
      if (coordMatch) {
        latInput.value = coordMatch[1];
        lngInput.value = coordMatch[2];
      } else if (field.lat != null && field.lng != null) {
        latInput.value = field.lat;
        lngInput.value = field.lng;
      }

      const applyBtn = document.createElement('button');
      applyBtn.className = 'field-edit-btn';
      applyBtn.textContent = 'Apply';
      applyBtn.addEventListener('click', () => {
        const lat = parseFloat(latInput.value);
        const lng = parseFloat(lngInput.value);
        if (!isNaN(lat) && !isNaN(lng)) {
          markDirty(field.key, JSON.stringify({ lat, lng }));
          renderMetadata();
        }
      });

      const mapBtn = document.createElement('button');
      mapBtn.className = 'field-edit-btn';
      mapBtn.textContent = '\uD83D\uDDFA Pick on Map\u2026';
      mapBtn.addEventListener('click', () => openGeoPickerDialog(field, latInput, lngInput));

      toolbar.appendChild(latInput);
      toolbar.appendChild(lngInput);
      toolbar.appendChild(applyBtn);
      toolbar.appendChild(mapBtn);
      parent.appendChild(toolbar);
      return;
    }

    // --- Default text / genre edit type ---
    const input = document.createElement('input');
    input.className = 'field-edit-input';
    input.value = currentValue;

    // Genre fields get a datalist for autocomplete
    if (field.editType === 'genre') {
      let datalist = document.getElementById('genre-datalist');
      if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'genre-datalist';
        const genres = Parsers.ID3_GENRES || [];
        for (const g of genres) {
          const opt = document.createElement('option');
          opt.value = g;
          datalist.appendChild(opt);
        }
        document.body.appendChild(datalist);
      }
      input.setAttribute('list', 'genre-datalist');
    }

    parent.appendChild(input);
    input.focus();
    input.select();

    function commit() {
      const newValue = input.value;
      if (newValue !== field.value) markDirty(field.key, newValue);
      renderMetadata();
    }

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') renderMetadata();
    });
  }

  // ---- Geo Picker Dialog (simple tile map) ----
  function openGeoPickerDialog(field, latInput, lngInput) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay visible';
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.style.maxWidth = '600px';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Pick GPS Coordinates';
    dialog.appendChild(title);

    const body = document.createElement('div');
    body.className = 'dialog-body';
    body.style.padding = '8px';

    const mapDiv = document.createElement('div');
    mapDiv.style.cssText = 'width:100%;height:350px;position:relative;overflow:hidden;background:#e0e0e0;cursor:crosshair;';
    body.appendChild(mapDiv);

    const coordRow = document.createElement('div');
    coordRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;align-items:center;';
    const latEl = document.createElement('label');
    latEl.innerHTML = 'Lat: <input type="number" step="0.000001" style="width:120px;padding:2px 4px;" id="geo-dlg-lat">';
    const lngEl = document.createElement('label');
    lngEl.innerHTML = 'Lng: <input type="number" step="0.000001" style="width:120px;padding:2px 4px;" id="geo-dlg-lng">';
    coordRow.appendChild(latEl);
    coordRow.appendChild(lngEl);
    body.appendChild(coordRow);
    dialog.appendChild(body);

    const btnRow = document.createElement('div');
    btnRow.className = 'dialog-buttons';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Apply';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    btnRow.appendChild(okBtn);
    btnRow.appendChild(cancelBtn);
    dialog.appendChild(btnRow);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const dlgLat = overlay.querySelector('#geo-dlg-lat');
    const dlgLng = overlay.querySelector('#geo-dlg-lng');
    dlgLat.value = latInput.value || '0';
    dlgLng.value = lngInput.value || '0';

    // Simple slippy tile map using OSM tiles
    let zoom = 4;
    let centerLat = parseFloat(dlgLat.value) || 0;
    let centerLng = parseFloat(dlgLng.value) || 0;
    let markerLat = centerLat, markerLng = centerLng;

    function lon2tile(lon, z) { return ((lon + 180) / 360) * (1 << z); }
    function lat2tile(lat, z) { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << z); }
    function tile2lon(x, z) { return x / (1 << z) * 360 - 180; }
    function tile2lat(y, z) { const n = Math.PI - 2 * Math.PI * y / (1 << z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); }

    function renderMap() {
      mapDiv.innerHTML = '';
      const w = mapDiv.clientWidth || 560;
      const h = mapDiv.clientHeight || 350;
      const cx = lon2tile(centerLng, zoom);
      const cy = lat2tile(centerLat, zoom);
      const tileSize = 256;
      const halfW = w / 2, halfH = h / 2;
      const startTileX = Math.floor(cx - halfW / tileSize);
      const startTileY = Math.floor(cy - halfH / tileSize);
      const endTileX = Math.ceil(cx + halfW / tileSize);
      const endTileY = Math.ceil(cy + halfH / tileSize);
      const maxTile = 1 << zoom;

      for (let ty = startTileY; ty <= endTileY; ++ty) {
        for (let tx = startTileX; tx <= endTileX; ++tx) {
          if (ty < 0 || ty >= maxTile) continue;
          const wrappedTx = ((tx % maxTile) + maxTile) % maxTile;
          const img = document.createElement('img');
          img.src = 'https://tile.openstreetmap.org/' + zoom + '/' + wrappedTx + '/' + ty + '.png';
          img.style.cssText = 'position:absolute;width:256px;height:256px;pointer-events:none;';
          const px = halfW + (tx - cx) * tileSize;
          const py = halfH + (ty - cy) * tileSize;
          img.style.left = Math.round(px) + 'px';
          img.style.top = Math.round(py) + 'px';
          mapDiv.appendChild(img);
        }
      }

      // Marker
      const mx = halfW + (lon2tile(markerLng, zoom) - cx) * tileSize;
      const my = halfH + (lat2tile(markerLat, zoom) - cy) * tileSize;
      const marker = document.createElement('div');
      marker.style.cssText = 'position:absolute;width:12px;height:12px;background:red;border:2px solid white;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;box-shadow:0 1px 3px rgba(0,0,0,.4);';
      marker.style.left = Math.round(mx) + 'px';
      marker.style.top = Math.round(my) + 'px';
      mapDiv.appendChild(marker);
    }

    renderMap();

    mapDiv.addEventListener('click', (e) => {
      const rect = mapDiv.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const w = mapDiv.clientWidth, h = mapDiv.clientHeight;
      const cx = lon2tile(centerLng, zoom);
      const cy = lat2tile(centerLat, zoom);
      const tileX = cx + (px - w / 2) / 256;
      const tileY = cy + (py - h / 2) / 256;
      markerLat = tile2lat(tileY, zoom);
      markerLng = tile2lon(tileX, zoom);
      dlgLat.value = markerLat.toFixed(6);
      dlgLng.value = markerLng.toFixed(6);
      renderMap();
    });

    mapDiv.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom = Math.max(1, Math.min(18, zoom + (e.deltaY < 0 ? 1 : -1)));
      renderMap();
    });

    // Pan via drag
    let dragging = false, dragStartX, dragStartY, dragCLat, dragCLng;
    mapDiv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragCLat = centerLat;
      dragCLng = centerLng;
      mapDiv.setPointerCapture(e.pointerId);
    });
    mapDiv.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      const cx = lon2tile(dragCLng, zoom) - dx / 256;
      const cy = lat2tile(dragCLat, zoom) - dy / 256;
      centerLng = tile2lon(cx, zoom);
      centerLat = tile2lat(cy, zoom);
      renderMap();
    });
    mapDiv.addEventListener('pointerup', () => { dragging = false; });

    okBtn.addEventListener('click', () => {
      latInput.value = dlgLat.value;
      lngInput.value = dlgLng.value;
      document.body.removeChild(overlay);
    });
    cancelBtn.addEventListener('click', () => document.body.removeChild(overlay));
  }

  function removeField(key) {
    modifications.set(key, null);
    dirty = true;
    updateTitle();
    updateModifiedStatus();
    document.getElementById('menu-save').classList.remove('disabled');
    document.getElementById('menu-revert').classList.remove('disabled');
    renderMetadata();
  }

  function restoreField(key) {
    modifications.delete(key);
    dirty = modifications.size > 0;
    updateTitle();
    updateModifiedStatus();
    if (modifications.size === 0) {
      document.getElementById('menu-save').classList.add('disabled');
      document.getElementById('menu-revert').classList.add('disabled');
    }
    renderMetadata();
  }

  function showAddTagDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay visible';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.style.maxWidth = '400px';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Add Text Tag';
    dialog.appendChild(title);

    const body = document.createElement('div');
    body.className = 'dialog-body';
    body.innerHTML = '<div style="margin-bottom:8px;"><label style="display:block;font-size:11px;margin-bottom:2px;">Key:</label>'
      + '<input type="text" id="add-tag-key" style="width:100%;box-sizing:border-box;padding:3px 6px;" placeholder="e.g. Author, Description, Comment"></div>'
      + '<div><label style="display:block;font-size:11px;margin-bottom:2px;">Value:</label>'
      + '<input type="text" id="add-tag-value" style="width:100%;box-sizing:border-box;padding:3px 6px;" placeholder="Tag value"></div>';
    dialog.appendChild(body);

    const buttons = document.createElement('div');
    buttons.className = 'dialog-buttons';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Add';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    buttons.appendChild(okBtn);
    buttons.appendChild(cancelBtn);
    dialog.appendChild(buttons);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const keyInput = document.getElementById('add-tag-key');
    const valInput = document.getElementById('add-tag-value');
    keyInput.focus();

    function doAdd() {
      const key = keyInput.value.trim();
      const value = valInput.value;
      if (!key) return;
      const modKey = 'png.text.' + key;
      modifications.set(modKey, value);
      dirty = true;
      updateTitle();
      updateModifiedStatus();
      document.getElementById('menu-save').classList.remove('disabled');
      document.getElementById('menu-revert').classList.remove('disabled');
      overlay.remove();
      // Switch to Text Chunks tab or create it
      const allCategories = getAllCategories();
      const textIdx = allCategories.findIndex(c => c.name === 'Text Chunks');
      if (textIdx >= 0) {
        activeCategory = textIdx;
        renderCategoryTabs();
      }
      renderMetadata();
    }

    okBtn.addEventListener('click', doAdd);
    cancelBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') valInput.focus(); if (e.key === 'Escape') overlay.remove(); });
    valInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') overlay.remove(); });
  }

  function showAddMp4Dialog() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay visible';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.style.maxWidth = '400px';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Add iTunes Metadata';
    dialog.appendChild(title);

    const body = document.createElement('div');
    body.className = 'dialog-body';
    const options = Object.entries(MP4_ILST_LABELS)
      .map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('');
    body.innerHTML = '<div style="margin-bottom:8px;"><label style="display:block;font-size:11px;margin-bottom:2px;">Property:</label>'
      + '<select id="add-mp4-key" style="width:100%;box-sizing:border-box;padding:3px 6px;">' + options + '</select></div>'
      + '<div><label style="display:block;font-size:11px;margin-bottom:2px;">Value:</label>'
      + '<input type="text" id="add-mp4-value" style="width:100%;box-sizing:border-box;padding:3px 6px;" placeholder="Value"></div>';
    dialog.appendChild(body);

    const buttons = document.createElement('div');
    buttons.className = 'dialog-buttons';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Add';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    buttons.appendChild(okBtn);
    buttons.appendChild(cancelBtn);
    dialog.appendChild(buttons);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const valInput = document.getElementById('add-mp4-value');
    valInput.focus();

    function doAdd() {
      const key = document.getElementById('add-mp4-key').value;
      const value = valInput.value;
      if (!key) return;
      modifications.set(key, value);
      dirty = true;
      updateTitle();
      updateModifiedStatus();
      document.getElementById('menu-save').classList.remove('disabled');
      document.getElementById('menu-revert').classList.remove('disabled');
      overlay.remove();
      const allCategories = getAllCategories();
      const idx = allCategories.findIndex(c => c.name === 'iTunes Metadata');
      if (idx >= 0) {
        activeCategory = idx;
        renderCategoryTabs();
      }
      renderMetadata();
    }

    okBtn.addEventListener('click', doAdd);
    cancelBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    valInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') overlay.remove(); });
  }

  function showAddOoxmlDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay visible';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.style.maxWidth = '400px';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Add Document Property';
    dialog.appendChild(title);

    const body = document.createElement('div');
    body.className = 'dialog-body';
    body.innerHTML = '<div style="margin-bottom:8px;"><label style="display:block;font-size:11px;margin-bottom:2px;">Property:</label>'
      + '<select id="add-ooxml-key" style="width:100%;box-sizing:border-box;padding:3px 6px;">'
      + '<option value="ooxml.title">Title</option>'
      + '<option value="ooxml.subject">Subject</option>'
      + '<option value="ooxml.creator">Author</option>'
      + '<option value="ooxml.keywords">Keywords</option>'
      + '<option value="ooxml.description">Description</option>'
      + '<option value="ooxml.category">Category</option>'
      + '</select></div>'
      + '<div><label style="display:block;font-size:11px;margin-bottom:2px;">Value:</label>'
      + '<input type="text" id="add-ooxml-value" style="width:100%;box-sizing:border-box;padding:3px 6px;" placeholder="Property value"></div>';
    dialog.appendChild(body);

    const buttons = document.createElement('div');
    buttons.className = 'dialog-buttons';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Add';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    buttons.appendChild(okBtn);
    buttons.appendChild(cancelBtn);
    dialog.appendChild(buttons);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const valInput = document.getElementById('add-ooxml-value');
    valInput.focus();

    function doAdd() {
      const key = document.getElementById('add-ooxml-key').value;
      const value = valInput.value;
      if (!key) return;
      modifications.set(key, value);
      dirty = true;
      updateTitle();
      updateModifiedStatus();
      document.getElementById('menu-save').classList.remove('disabled');
      document.getElementById('menu-revert').classList.remove('disabled');
      overlay.remove();
      const allCategories = getAllCategories();
      const idx = allCategories.findIndex(c => c.name === 'Document Properties');
      if (idx >= 0) {
        activeCategory = idx;
        renderCategoryTabs();
      }
      renderMetadata();
    }

    okBtn.addEventListener('click', doAdd);
    cancelBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    valInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') overlay.remove(); });
  }

  const ID3_TAG_OPTIONS = {
    'id3.TIT2': 'Title', 'id3.TPE1': 'Artist', 'id3.TALB': 'Album', 'id3.TYER': 'Year',
    'id3.TCON': 'Genre', 'id3.TRCK': 'Track', 'id3.COMM': 'Comment', 'id3.TCOM': 'Composer',
    'id3.TPE2': 'Album Artist', 'id3.TPOS': 'Disc', 'id3.TIT1': 'Content Group',
    'id3.TIT3': 'Subtitle', 'id3.TPE3': 'Conductor', 'id3.TPE4': 'Remixed By',
    'id3.TBPM': 'BPM', 'id3.TCOP': 'Copyright', 'id3.TENC': 'Encoded By',
    'id3.TPUB': 'Publisher', 'id3.TKEY': 'Initial Key', 'id3.TLAN': 'Language',
    'id3.TOAL': 'Original Album', 'id3.TOPE': 'Original Artist', 'id3.TSRC': 'ISRC',
    'id3.TSOP': 'Performer Sort', 'id3.TSOA': 'Album Sort', 'id3.TSOT': 'Title Sort',
    'id3.TMOO': 'Mood', 'id3.TEXT': 'Lyricist', 'id3.USLT': 'Lyrics',
  };

  function showAddId3Dialog() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay visible';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.style.maxWidth = '400px';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Add ID3v2 Tag';
    dialog.appendChild(title);

    const body = document.createElement('div');
    body.className = 'dialog-body';
    const options = Object.entries(ID3_TAG_OPTIONS)
      .map(([k, l]) => '<option value="' + k + '">' + l + '</option>').join('');
    body.innerHTML = '<div style="margin-bottom:8px;"><label style="display:block;font-size:11px;margin-bottom:2px;">Tag:</label>'
      + '<select id="add-id3-key" style="width:100%;box-sizing:border-box;padding:3px 6px;">' + options
      + '<option value="__custom">Custom (TXXX)...</option></select></div>'
      + '<div id="add-id3-custom-row" style="margin-bottom:8px;display:none;"><label style="display:block;font-size:11px;margin-bottom:2px;">Description:</label>'
      + '<input type="text" id="add-id3-custom-desc" style="width:100%;box-sizing:border-box;padding:3px 6px;" placeholder="e.g. REPLAYGAIN_TRACK_GAIN"></div>'
      + '<div><label style="display:block;font-size:11px;margin-bottom:2px;">Value:</label>'
      + '<input type="text" id="add-id3-value" style="width:100%;box-sizing:border-box;padding:3px 6px;" placeholder="Value"></div>';
    dialog.appendChild(body);

    const buttons = document.createElement('div');
    buttons.className = 'dialog-buttons';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Add';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    buttons.appendChild(okBtn);
    buttons.appendChild(cancelBtn);
    dialog.appendChild(buttons);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const keySelect = document.getElementById('add-id3-key');
    const customRow = document.getElementById('add-id3-custom-row');
    const customDesc = document.getElementById('add-id3-custom-desc');
    const valInput = document.getElementById('add-id3-value');

    keySelect.addEventListener('change', () => {
      customRow.style.display = keySelect.value === '__custom' ? '' : 'none';
    });
    valInput.focus();

    function doAdd() {
      let key;
      if (keySelect.value === '__custom') {
        const desc = customDesc.value.trim();
        if (!desc) return;
        key = 'id3.TXXX.' + desc;
      } else
        key = keySelect.value;
      const value = valInput.value;
      if (!key) return;
      modifications.set(key, value);
      dirty = true;
      updateTitle();
      updateModifiedStatus();
      document.getElementById('menu-save').classList.remove('disabled');
      document.getElementById('menu-revert').classList.remove('disabled');
      overlay.remove();
      renderMetadata();
    }

    okBtn.addEventListener('click', doAdd);
    cancelBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    valInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') overlay.remove(); });
  }

  function updateModifiedStatus() {
    const count = [...modifications.values()].filter(v => v !== undefined).length;
    statusModified.textContent = count > 0 ? count + ' modification(s)' : '';
  }

  // =========================================================================
  // Hashes tab
  // =========================================================================
  const HASH_GROUPS = [
    {
      label: 'Cryptographic Hashes',
      algorithms: [
        { name: 'MD5', algoName: 'MD5' },
        { name: 'SHA-1', algoName: 'SHA-1' },
        { name: 'SHA-224', algoName: 'SHA-224' },
        { name: 'SHA-256', algoName: 'SHA-256' },
        { name: 'SHA-384', algoName: 'SHA-384' },
        { name: 'SHA-512', algoName: 'SHA-512' },
        { name: 'SHA-512/256', algoName: 'SHA-512/256' },
        { name: 'SHA3-256', algoName: 'SHA-3-256' },
        { name: 'SHA3-384', algoName: 'SHA-3-384' },
        { name: 'SHA3-512', algoName: 'SHA-3-512' },
        { name: 'BLAKE2b', algoName: 'BLAKE2b' },
        { name: 'BLAKE2s', algoName: 'BLAKE2s' },
        { name: 'BLAKE3', algoName: 'BLAKE3' },
        { name: 'RIPEMD-160', algoName: 'RIPEMD-160' },
        { name: 'Whirlpool', algoName: 'Whirlpool' },
        { name: 'Tiger', algoName: 'Tiger' },
        { name: 'SM3', algoName: 'SM3' },
        { name: 'Streebog-256', algoName: 'Streebog' },
      ],
    },
    {
      label: 'Non-Cryptographic Hashes',
      algorithms: [
        { name: 'xxHash32', algoName: 'xxHash32' },
        { name: 'xxHash3', algoName: 'xxHash3' },
        { name: 'MurmurHash3', algoName: 'MurmurHash3' },
      ],
    },
    {
      label: 'Checksums',
      algorithms: [
        { name: 'CRC-16-CCITT', algoName: 'CRC-16-KERMIT' },
        { name: 'CRC-32', algoName: 'CRC-32-IEEE' },
        { name: 'CRC-64', algoName: 'CRC-64-ECMA' },
        { name: 'Adler-32', algoName: 'Adler-32' },
        { name: 'Fletcher-32', algoName: 'Fletcher-32' },
        { name: 'BSD Checksum', algoName: 'BSD-Checksum' },
        { name: 'Sum-8', algoName: 'Sum-8' },
        { name: 'XOR-8', algoName: 'XOR-8' },
      ],
    },
  ];

  // Flat list for iteration
  const HASH_ALGORITHMS = HASH_GROUPS.flatMap(g => g.algorithms);

  function renderHashesTab() {
    metadataTbody.innerHTML = '';

    for (const group of HASH_GROUPS) {
      // Group header
      const headerTr = document.createElement('tr');
      headerTr.className = 'hash-category-header';
      const headerTd = document.createElement('td');
      headerTd.colSpan = 2;
      headerTd.textContent = group.label;
      headerTr.appendChild(headerTd);
      metadataTbody.appendChild(headerTr);

      for (const h of group.algorithms) {
        const tr = document.createElement('tr');
        const tdLabel = document.createElement('td');
        tdLabel.className = 'field-label';
        tdLabel.textContent = h.name;
        tr.appendChild(tdLabel);

        const tdValue = document.createElement('td');
        if (hashResults && hashResults[h.name]) {
          tdValue.className = 'field-value monospace hash';
          tdValue.innerHTML = '<span class="hash-done">\u2714</span>' + hashResults[h.name];
          tdValue.title = 'Click to copy';
          tdValue.addEventListener('click', () => copyToClipboard(hashResults[h.name], tdValue));
        } else if (hashResults && hashResults[h.name] === '') {
          tdValue.className = 'field-value monospace';
          tdValue.textContent = '(not available)';
        } else {
          tdValue.innerHTML = '<span class="hash-spinner"></span>Computing...';
        }
        tr.appendChild(tdValue);
        metadataTbody.appendChild(tr);
      }
    }
  }

  function bytesToHexString(byteArray) {
    let hex = '';
    for (let i = 0; i < byteArray.length; ++i)
      hex += byteArray[i].toString(16).padStart(2, '0');
    return hex.toUpperCase();
  }

  function computeHashes() {
    if (!currentBytes || typeof AlgorithmFramework === 'undefined') return;

    hashResults = {};
    hashAbortFlag = false;
    const bytes = currentBytes;
    let idx = 0;

    function computeNext() {
      if (hashAbortFlag || bytes !== currentBytes) return;
      if (idx >= HASH_ALGORITHMS.length) {
        // All done — re-render if still on hashes tab
        const allCategories = getAllCategories();
        if (activeCategory === allCategories.length - 1)
          renderMetadata();
        return;
      }

      const h = HASH_ALGORITHMS[idx];
      ++idx;

      try {
        const algo = AlgorithmFramework.Find(h.algoName);
        if (!algo) {
          hashResults[h.name] = '(algorithm not found)';
          setTimeout(computeNext, 0);
          return;
        }

        const inst = algo.CreateInstance();

        // Chunked processing for large files
        const CHUNK_SIZE = 524288; // 512KB
        if (bytes.length > CHUNK_SIZE) {
          let offset = 0;
          function processChunk() {
            if (hashAbortFlag || bytes !== currentBytes) return;
            const end = Math.min(offset + CHUNK_SIZE, bytes.length);
            const chunk = bytes.subarray(offset, end);
            inst.Feed(Array.from(chunk));
            offset = end;
            if (offset < bytes.length)
              setTimeout(processChunk, 0);
            else {
              const result = inst.Result();
              hashResults[h.name] = bytesToHexString(result);
              // Update UI if on hashes tab
              const allCategories = getAllCategories();
              if (activeCategory === allCategories.length - 1)
                renderMetadata();
              setTimeout(computeNext, 0);
            }
          }
          processChunk();
        } else {
          inst.Feed(Array.from(bytes));
          const result = inst.Result();
          hashResults[h.name] = bytesToHexString(result);
          setTimeout(computeNext, 0);
        }
      } catch (e) {
        hashResults[h.name] = '(error: ' + e.message + ')';
        setTimeout(computeNext, 0);
      }
    }

    computeNext();
  }

  // =========================================================================
  // Preview Accordion
  // =========================================================================

  function renderPreviewAccordion() {
    previewAccordion.innerHTML = '';
    if (!parseResult || !currentBytes) return;

    const ftCat = parseResult.fileType.category;
    const ftId = parseResult.fileType.id;
    const encoding = Parsers.computeEntropy ? detectTextEncodingLocal(currentBytes) : 'Binary';
    const hasImages = parseResult.images && parseResult.images.length > 0;
    const isAudio = ftCat === 'Audio';
    const isBinary = encoding === 'Binary';
    const isText = !isBinary;
    const hasBOM = currentBytes.length >= 2 && (
      (currentBytes[0] === 0xEF && currentBytes[1] === 0xBB) ||
      (currentBytes[0] === 0xFF && currentBytes[1] === 0xFE) ||
      (currentBytes[0] === 0xFE && currentBytes[1] === 0xFF)
    );

    const sections = [];

    if (hasImages)
      sections.push({ id: 'images', title: 'Embedded Images', render: renderImagesBody, defaultExpand: true });
    if (isAudio)
      sections.push({ id: 'waveform', title: 'Waveform', render: renderWaveformBody, defaultExpand: !hasImages });
    sections.push({ id: 'hex', title: 'Hex Preview', render: renderHexBody, defaultExpand: !hasImages && !isAudio && isBinary });
    if (isText)
      sections.push({ id: 'text', title: 'Text Preview', render: renderTextBody, defaultExpand: isText && !hasImages });
    if (hasBOM || (isText && encoding !== 'ASCII / UTF-8'))
      sections.push({ id: 'unicode', title: 'Unicode', render: renderUnicodeBody, defaultExpand: false });
    if (parseResult.disassembly && window.SZ && SZ.Disassembler)
      sections.push({ id: 'disasm', title: 'Disassembly', render: renderDisassemblyBody, defaultExpand: false });

    // Ensure exactly one is expanded by default
    const hasDefault = sections.some(s => s.defaultExpand);
    if (!hasDefault && sections.length > 0)
      sections[0].defaultExpand = true;

    for (const sec of sections) {
      const section = document.createElement('div');
      section.className = 'accordion-section' + (sec.defaultExpand ? '' : ' collapsed');
      section.dataset.sectionId = sec.id;

      const header = document.createElement('div');
      header.className = 'accordion-header';
      header.innerHTML = '<span class="accordion-chevron">\u25BC</span> ' + escapeHtml(sec.title);
      header.addEventListener('click', () => {
        section.classList.toggle('collapsed');
      });
      section.appendChild(header);

      const body = document.createElement('div');
      body.className = 'accordion-body';
      sec.render(body);
      section.appendChild(body);

      previewAccordion.appendChild(section);
    }
  }

  function detectTextEncodingLocal(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return 'UTF-8 (BOM)';
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return 'UTF-16 LE';
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return 'UTF-16 BE';
    let nullCount = 0;
    for (let i = 0; i < bytes.length; ++i)
      if (bytes[i] === 0) ++nullCount;
    if (nullCount / bytes.length > 0.3) return 'Binary';
    let ascii = 0;
    const limit = Math.min(bytes.length, 4096);
    for (let i = 0; i < limit; ++i)
      if ((bytes[i] >= 0x20 && bytes[i] <= 0x7E) || bytes[i] === 0x0A || bytes[i] === 0x0D || bytes[i] === 0x09)
        ++ascii;
    if (ascii / limit > 0.95) return 'ASCII / UTF-8';
    if (ascii / limit > 0.7) return 'Likely text';
    return 'Binary';
  }

  // ---- Images accordion body ----
  function renderImagesBody(container) {
    if (!parseResult.images || parseResult.images.length === 0) {
      container.innerHTML = '<div class="no-thumbnails">No embedded images</div>';
      return;
    }

    const panel = document.createElement('div');
    panel.className = 'thumbnail-panel';
    const grid = document.createElement('div');
    grid.className = 'thumbnail-grid';

    for (const img of parseResult.images) {
      const item = document.createElement('div');
      item.className = 'thumbnail-item';

      const imgEl = document.createElement('img');
      imgEl.className = 'thumbnail-img';
      imgEl.src = img.dataUrl;
      imgEl.alt = img.label;
      imgEl.addEventListener('click', () => showImagePreview(img));
      item.appendChild(imgEl);

      const label = document.createElement('div');
      label.className = 'thumbnail-label';
      label.textContent = img.label;
      item.appendChild(label);

      grid.appendChild(item);
    }

    panel.appendChild(grid);
    container.appendChild(panel);
  }

  function showImagePreview(img) {
    document.getElementById('image-preview-title').textContent = img.label;
    document.getElementById('image-preview-img').src = img.dataUrl;
    document.getElementById('dlg-image-preview').classList.add('visible');

    document.getElementById('btn-save-image').onclick = () => {
      const ext = img.mimeType.includes('png') ? '.png' : '.jpg';
      const name = (currentFileName || 'image').replace(/\.[^.]+$/, '') + '_' + img.label.replace(/\s+/g, '_') + ext;
      const binary = atob(img.dataUrl.split(',')[1]);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; ++i) array[i] = binary.charCodeAt(i);
      ComDlg32.ExportFile(array, name, img.mimeType);
    };
  }

  // ---- Waveform accordion body ----
  function renderWaveformBody(container) {
    if (!currentBytes) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'waveform-canvas';
    canvas.width = 600;
    canvas.height = 80;
    container.appendChild(canvas);

    const ftId = parseResult.fileType.id;
    const info = document.createElement('div');
    info.className = 'waveform-info';

    if (ftId === 'wav') {
      // Parse WAV fmt chunk for PCM waveform
      let sampleRate = 0, bitsPerSample = 16, numChannels = 1, dataOffset = 0, dataSize = 0;
      let pos = 12; // skip RIFF header
      while (pos + 8 <= currentBytes.length) {
        const chunkId = String.fromCharCode(currentBytes[pos], currentBytes[pos + 1], currentBytes[pos + 2], currentBytes[pos + 3]);
        const chunkSize = currentBytes[pos + 4] | (currentBytes[pos + 5] << 8) | (currentBytes[pos + 6] << 16) | (currentBytes[pos + 7] << 24);
        if (chunkId === 'fmt ' && chunkSize >= 16) {
          numChannels = currentBytes[pos + 10] | (currentBytes[pos + 11] << 8);
          sampleRate = currentBytes[pos + 12] | (currentBytes[pos + 13] << 8) | (currentBytes[pos + 14] << 16) | (currentBytes[pos + 15] << 24);
          bitsPerSample = currentBytes[pos + 22] | (currentBytes[pos + 23] << 8);
        }
        if (chunkId === 'data') {
          dataOffset = pos + 8;
          dataSize = chunkSize;
          break;
        }
        pos += 8 + chunkSize + (chunkSize & 1);
      }

      if (dataOffset > 0 && dataSize > 0) {
        drawPCMWaveform(canvas, currentBytes, dataOffset, dataSize, bitsPerSample, numChannels);
        info.textContent = sampleRate + ' Hz, ' + bitsPerSample + '-bit, ' + (numChannels === 1 ? 'mono' : numChannels === 2 ? 'stereo' : numChannels + 'ch');
      } else {
        drawByteAmplitude(canvas, currentBytes);
        info.textContent = 'Could not locate PCM data';
      }
    } else {
      // Byte-amplitude density for compressed audio
      drawByteAmplitude(canvas, currentBytes);
      info.textContent = 'Byte amplitude density (compressed audio)';
    }

    container.appendChild(info);
  }

  function drawPCMWaveform(canvas, bytes, dataOffset, dataSize, bitsPerSample, numChannels) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, h);

    const bytesPerSample = bitsPerSample / 8;
    const frameSize = bytesPerSample * numChannels;
    const totalSamples = Math.min(Math.floor(dataSize / frameSize), 500000);
    if (totalSamples === 0) return;

    const samplesPerPixel = Math.max(1, Math.floor(totalSamples / w));
    const mid = h / 2;
    const maxVal = (1 << (bitsPerSample - 1)) - 1;

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < w; ++x) {
      let minS = 0, maxS = 0;
      const start = x * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, totalSamples);
      for (let s = start; s < end; ++s) {
        const off = dataOffset + s * frameSize;
        let sample;
        if (bytesPerSample === 1)
          sample = (bytes[off] || 0) - 128;
        else if (bytesPerSample === 2)
          sample = ((bytes[off] || 0) | ((bytes[off + 1] || 0) << 8)) << 16 >> 16;
        else
          sample = 0;
        if (sample < minS) minS = sample;
        if (sample > maxS) maxS = sample;
      }
      const yMin = mid - (maxS / maxVal) * mid;
      const yMax = mid - (minS / maxVal) * mid;
      ctx.moveTo(x, yMin);
      ctx.lineTo(x, yMax);
    }

    ctx.stroke();

    // Center line
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
  }

  function drawByteAmplitude(canvas, bytes) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, w, h);

    const bytesPerPixel = Math.max(1, Math.floor(bytes.length / w));
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < w; ++x) {
      const start = x * bytesPerPixel;
      const end = Math.min(start + bytesPerPixel, bytes.length);
      let sum = 0, count = 0;
      for (let i = start; i < end; ++i) {
        sum += Math.abs(bytes[i] - 128);
        ++count;
      }
      const avg = count > 0 ? sum / count : 0;
      const y = h - (avg / 128) * h;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
  }

  // ---- Hex accordion body ----
  function renderHexBody(container) {
    if (!currentBytes) return;

    const hexDiv = document.createElement('div');
    hexDiv.className = 'hex-preview';

    const maxBytes = 256;
    const length = Math.min(currentBytes.length, maxBytes);
    const regionMap = buildRegionMap(parseResult.byteRegions, length);

    let html = '';
    for (let row = 0; row < length; row += 16) {
      const offset = row.toString(16).padStart(8, '0').toUpperCase();
      let hexPart = '';
      let asciiPart = '';

      for (let col = 0; col < 16; ++col) {
        const idx = row + col;
        if (idx < length) {
          const b = currentBytes[idx];
          const hex = b.toString(16).padStart(2, '0').toUpperCase();
          const ascii = (b >= 0x20 && b <= 0x7E) ? escapeHtml(String.fromCharCode(b)) : '.';
          const region = regionMap[idx];
          if (region) {
            const cls = 'hex-byte-span hex-region-' + region.color;
            hexPart += '<span class="' + cls + '" title="' + escapeHtml(region.label) + '">' + hex + '</span>';
            asciiPart += '<span class="' + cls + '" title="' + escapeHtml(region.label) + '">' + ascii + '</span>';
          } else {
            hexPart += hex;
            asciiPart += ascii;
          }
        } else {
          hexPart += '  ';
          asciiPart += ' ';
        }
        if (col < 15) hexPart += ' ';
        if (col === 7) hexPart += ' ';
      }

      html += '<span class="hex-offset">' + offset + '</span><span class="hex-bytes">' + hexPart + '</span><span class="hex-ascii">' + asciiPart + '</span>\n';
    }

    hexDiv.innerHTML = html;
    container.appendChild(hexDiv);
  }

  function buildRegionMap(byteRegions, maxOffset) {
    const map = {};
    if (!byteRegions) return map;
    for (const r of byteRegions) {
      const end = Math.min(r.offset + r.length, maxOffset);
      for (let i = r.offset; i < end; ++i)
        map[i] = { color: r.color, label: r.label };
    }
    return map;
  }

  // ---- Text accordion body ----
  function renderTextBody(container) {
    if (!currentBytes) return;

    const pre = document.createElement('div');
    pre.className = 'text-preview';

    const maxBytes = 4096;
    const length = Math.min(currentBytes.length, maxBytes);
    const regionMap = buildRegionMap(parseResult.byteRegions, length);
    let html = '';

    for (let i = 0; i < length; ++i) {
      const b = currentBytes[i];
      const region = regionMap[i];
      let ch;
      if (b >= 0x20 && b <= 0x7E)
        ch = escapeHtml(String.fromCharCode(b));
      else if (b === 0x0A)
        ch = '\n';
      else if (b === 0x0D)
        ch = '';
      else if (b === 0x09)
        ch = '\t';
      else
        ch = '<span class="text-nonprintable">\u00B7</span>';

      if (region) {
        const cls = 'hex-region-' + region.color;
        html += '<span class="' + cls + '" title="' + escapeHtml(region.label) + '">' + ch + '</span>';
      } else
        html += ch;
    }

    if (currentBytes.length > maxBytes)
      html += '\n\u2026 (' + Parsers.formatSize(currentBytes.length - maxBytes) + ' more)';

    pre.innerHTML = html;
    container.appendChild(pre);
  }

  // ---- Unicode accordion body ----
  function renderUnicodeBody(container) {
    if (!currentBytes) return;

    const div = document.createElement('div');
    div.className = 'unicode-preview';

    let decoded = '';
    let encoding = 'UTF-8';
    let startOffset = 0;

    if (currentBytes.length >= 3 && currentBytes[0] === 0xEF && currentBytes[1] === 0xBB && currentBytes[2] === 0xBF) {
      encoding = 'UTF-8 (BOM)';
      startOffset = 3;
    } else if (currentBytes.length >= 2 && currentBytes[0] === 0xFF && currentBytes[1] === 0xFE) {
      encoding = 'UTF-16 LE';
      startOffset = 2;
    } else if (currentBytes.length >= 2 && currentBytes[0] === 0xFE && currentBytes[1] === 0xFF) {
      encoding = 'UTF-16 BE';
      startOffset = 2;
    }

    const maxBytes = 4096;
    const slice = currentBytes.slice(startOffset, startOffset + maxBytes);

    try {
      const decoder = new TextDecoder(encoding.startsWith('UTF-16 LE') ? 'utf-16le' : encoding.startsWith('UTF-16 BE') ? 'utf-16be' : 'utf-8');
      decoded = decoder.decode(slice);
    } catch (_) {
      decoded = new TextDecoder('utf-8', { fatal: false }).decode(slice);
    }

    let html = '<div style="font-size:9px;color:var(--sz-color-gray-text);margin-bottom:6px;">Encoding: ' + escapeHtml(encoding) + '</div>';

    for (let i = 0; i < Math.min(decoded.length, 2000); ++i) {
      const ch = decoded[i];
      const code = decoded.codePointAt(i);
      if (code > 0xFFFF) ++i; // skip surrogate pair

      if (code === 0x0A) {
        html += '\n';
      } else if (code === 0x0D) {
        continue;
      } else if (code > 0x7F) {
        html += escapeHtml(ch) + '<span class="unicode-codepoint">U+' + code.toString(16).toUpperCase().padStart(4, '0') + '</span>';
      } else if (code >= 0x20) {
        html += escapeHtml(ch);
      } else {
        html += '<span class="text-nonprintable">\u00B7</span>';
      }
    }

    div.innerHTML = html;
    container.appendChild(div);
  }

  // ---- Disassembly accordion body ----
  function renderDisassemblyBody(container) {
    if (!parseResult || !parseResult.disassembly || !currentBytes) return;
    const D = window.SZ && SZ.Disassembler;
    if (!D) return;

    const info = parseResult.disassembly;
    const archId = info.archId;
    const offset = info.offset || 0;
    const count = 64;

    // Header info
    const header = document.createElement('div');
    header.style.cssText = 'font-size:9px;color:var(--sz-color-gray-text);margin-bottom:6px;';
    header.textContent = 'Architecture: ' + archId.toUpperCase()
      + (info.rva != null ? ' | Entry RVA: 0x' + info.rva.toString(16).toUpperCase() : '')
      + ' | File offset: 0x' + offset.toString(16).toUpperCase();
    container.appendChild(header);

    if (offset >= currentBytes.length) {
      const msg = document.createElement('div');
      msg.style.cssText = 'padding:8px;color:var(--sz-color-gray-text);font-style:italic;';
      msg.textContent = 'Entry point offset is outside the file.';
      container.appendChild(msg);
      return;
    }

    const instructions = D.disassemble(archId, currentBytes, offset, count, info.options || undefined);
    if (!instructions || instructions.length === 0) {
      const msg = document.createElement('div');
      msg.style.cssText = 'padding:8px;color:var(--sz-color-gray-text);font-style:italic;';
      msg.textContent = 'No instructions decoded.';
      container.appendChild(msg);
      return;
    }

    const pre = document.createElement('pre');
    pre.className = 'disasm-listing';
    if (D.formatDisassemblyHtml) {
      pre.innerHTML = D.formatDisassemblyHtml(instructions);
    } else {
      pre.textContent = D.formatDisassembly(instructions);
    }
    container.appendChild(pre);
  }

  // ---- Archiver button ----
  function updateArchiverButton() {
    if (!parseResult || !currentFilePath || !ARCHIVE_TYPE_IDS.has(parseResult.fileType.id)) {
      btnOpenArchiver.style.display = 'none';
      return;
    }
    btnOpenArchiver.style.display = '';
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // =========================================================================
  // Clipboard
  // =========================================================================
  function copyToClipboard(text, el) {
    navigator.clipboard.writeText(text).then(() => {
      showCopyTooltip(el, 'Copied!');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showCopyTooltip(el, 'Copied!');
    });
  }

  function showCopyTooltip(el, text) {
    const rect = el.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.className = 'copy-tooltip';
    tooltip.textContent = text;
    tooltip.style.left = rect.left + 'px';
    tooltip.style.top = (rect.top - 24) + 'px';
    document.body.appendChild(tooltip);
    setTimeout(() => tooltip.remove(), 1000);
  }

  function copyAllMetadata() {
    if (!parseResult) return;
    let text = 'File: ' + (currentFileName || '') + '\n';
    text += 'Type: ' + parseResult.fileType.name + '\n\n';

    for (const cat of parseResult.categories) {
      text += '--- ' + cat.name + ' ---\n';
      for (const field of cat.fields) {
        const val = modifications.has(field.key) ? modifications.get(field.key) : field.value;
        text += field.label + ': ' + val + '\n';
      }
      text += '\n';
    }

    if (hashResults) {
      for (const group of HASH_GROUPS) {
        text += '--- ' + group.label + ' ---\n';
        for (const h of group.algorithms)
          if (hashResults[h.name])
            text += h.name + ': ' + hashResults[h.name] + '\n';
        text += '\n';
      }
    }

    navigator.clipboard.writeText(text).catch(() => {});
  }

  // =========================================================================
  // Save / export
  // =========================================================================
  function saveModified() {
    if (!currentBytes || !parseResult || modifications.size === 0) return;

    const newBytes = Editors.rebuildFile(parseResult.fileType.id, currentBytes, modifications);
    const defaultName = currentFileName || 'modified_file';

    if (currentFilePath) {
      Kernel32.WriteAllBytes(currentFilePath, newBytes).then(() => {
        currentBytes = newBytes;
        modifications.clear();
        dirty = false;
        updateTitle();
        updateModifiedStatus();
        parseResult = Parsers.parse(currentBytes, currentFileName);
        renderCategoryTabs();
        renderMetadata();
      }).catch(() => {
        // Fall back to browser export
        ComDlg32.ExportFile(newBytes, defaultName, parseResult.fileType.mimeType);
      });
    } else {
      ComDlg32.ExportFile(newBytes, defaultName, parseResult.fileType.mimeType);
      modifications.clear();
      dirty = false;
      updateTitle();
      updateModifiedStatus();
    }
  }

  function exportFile() {
    if (!currentBytes) return;
    ComDlg32.ExportFile(currentBytes, currentFileName || 'file', parseResult?.fileType?.mimeType || 'application/octet-stream');
  }

  function revertChanges() {
    if (modifications.size === 0) return;
    modifications.clear();
    dirty = false;
    updateTitle();
    updateModifiedStatus();
    document.getElementById('menu-save').classList.add('disabled');
    document.getElementById('menu-revert').classList.add('disabled');
    renderMetadata();
  }

  // =========================================================================
  // Drag and drop
  // =========================================================================
  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
  });

  document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
  });

  document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => loadFromBytes(new Uint8Array(reader.result), file.name, null);
    reader.readAsArrayBuffer(file);
  });

  dropZone.addEventListener('click', () => doImport());

  // =========================================================================
  // Menu actions
  // =========================================================================
  document.querySelectorAll('.menu-entry').forEach(el => {
    el.addEventListener('click', (e) => {
      const action = el.dataset.action;
      if (el.classList.contains('disabled')) return;

      switch (action) {
        case 'open': doOpen(); break;
        case 'import': doImport(); break;
        case 'save': saveModified(); break;
        case 'export': exportFile(); break;
        case 'exit': User32.DestroyWindow(); break;
        case 'copy-all': copyAllMetadata(); break;
        case 'revert': revertChanges(); break;
        case 'toggle-preview':
          showPreviewPanel = !showPreviewPanel;
          updatePanelVisibility();
          break;
        case 'about':
          document.getElementById('dlg-about').classList.add('visible');
          break;
      }
    });
  });

  function updatePanelVisibility() {
    rightPanel.classList.toggle('hidden', !showPreviewPanel);
    panelSplitter.style.display = showPreviewPanel ? '' : 'none';
  }

  // =========================================================================
  // Splitter drag
  // =========================================================================
  let splitting = false;

  panelSplitter.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    splitting = true;
    panelSplitter.setPointerCapture(e.pointerId);
  });

  panelSplitter.addEventListener('pointermove', (e) => {
    if (!splitting) return;
    const rect = mainContent.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = 100 - (x / rect.width) * 100; // right panel grows from the right
    const clamped = Math.max(20, Math.min(80, pct));
    rightPanel.style.width = clamped + '%';
  });

  panelSplitter.addEventListener('pointerup', () => { splitting = false; });
  panelSplitter.addEventListener('lostpointercapture', () => { splitting = false; });

  // =========================================================================
  // Open in Archiver button
  // =========================================================================
  btnOpenArchiver.addEventListener('click', () => {
    if (!currentFilePath) return;
    Shell32.ShellExecute('archiver', { file: currentFilePath });
  });

  // =========================================================================
  // Dialog close handlers
  // =========================================================================
  document.querySelectorAll('.dialog-overlay').forEach(overlay => {
    overlay.querySelectorAll('button[data-result]').forEach(btn => {
      btn.addEventListener('click', () => overlay.classList.remove('visible'));
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('visible');
    });
  });

  // =========================================================================
  // File open
  // =========================================================================
  async function doOpen() {
    try {
      const result = await ComDlg32.GetOpenFileName({ title: 'Open File', filters: [{ name: 'All Files', pattern: '*' }] });
      if (result.cancelled) return;
      const path = result.path || result.filePath;
      if (!path) return;
      const bytes = await Kernel32.ReadAllBytes(path);
      const name = path.split('/').pop();
      loadFromBytes(bytes, name, path);
    } catch (_) {}
  }

  async function doImport() {
    const result = await ComDlg32.ImportFile({ accept: '*/*', readAs: 'arrayBuffer' });
    if (result.cancelled) return;
    loadFromBytes(new Uint8Array(result.data), result.name, null);
  }

  // =========================================================================
  // Keyboard shortcuts
  // =========================================================================
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'o') { e.preventDefault(); doOpen(); }
    if (e.ctrlKey && e.key === 'i') { e.preventDefault(); doImport(); }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveModified(); }
  });

  // =========================================================================
  // Command-line arguments (open file from VFS)
  // =========================================================================
  async function handleCommandLine() {
    const params = Kernel32.GetCommandLine();
    const path = params.file || params.path;
    if (path) {
      try {
        const bytes = await Kernel32.ReadAllBytes(path);
        const name = path.split('/').pop();
        loadFromBytes(bytes, name, path);
      } catch (_) {}
    }
  }

  // =========================================================================
  // Init
  // =========================================================================
  updateTitle();
  handleCommandLine();

})();
