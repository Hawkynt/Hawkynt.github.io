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
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = document.getElementById('loading-text');

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

  // Yield to browser so it can paint before synchronous work
  function _yieldForPaint() {
    return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  }

  async function loadFromBytes(bytes, name, path) {
    hashAbortFlag = true; // cancel any pending hash computation
    currentBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    currentBytes = resolveVfsBytes(currentBytes);
    currentFileName = name || 'Unknown';
    currentFilePath = path || null;
    modifications.clear();
    dirty = false;
    hashResults = null;
    _disasmReset();

    // Show loading overlay and yield so the browser paints it
    loadingText.textContent = 'Parsing ' + currentFileName + '\u2026';
    loadingOverlay.classList.remove('hidden');
    await _yieldForPaint();

    // Parse
    parseResult = Parsers.parse(currentBytes, currentFileName);

    // Hide loading overlay
    loadingOverlay.classList.add('hidden');

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
    // Add virtual "GPS" tab for JPEG if there are GPS modifications but no existing tab
    if (ftId === 'jpeg' && !cats.some(c => c.name === 'GPS')) {
      const hasGpsMods = [...modifications.keys()].some(k => k.startsWith('gps.'));
      if (hasGpsMods)
        cats.push({ name: 'GPS', icon: 'location', fields: [] });
    }
    // Add virtual "IPTC" tab for JPEG if there are IPTC modifications but no existing tab
    if (ftId === 'jpeg' && !cats.some(c => c.name === 'IPTC')) {
      const hasIptcMods = [...modifications.keys()].some(k => k.startsWith('iptc.'));
      if (hasIptcMods)
        cats.push({ name: 'IPTC', icon: 'tag', fields: [] });
    }
    cats.push({ name: 'Hashes & Checksums', icon: 'hash', fields: [] });
    return cats;
  }

  const CATEGORY_ICON_MAP = {
    info: '\u2139\uFE0F',
    exe: '\u2699\uFE0F',
    image: '\uD83D\uDDBC\uFE0F',
    camera: '\uD83D\uDCF7',
    link: '\uD83D\uDD17',
    list: '\uD83D\uDCCB',
    hash: '#\uFE0F\u20E3',
    tag: '\uD83C\uDFF7\uFE0F',
    music: '\uD83C\uDFB5',
    text: '\uD83D\uDCC4',
    document: '\uD83D\uDCC3',
    cpu: '\uD83D\uDCBB',
    dotnet: '\uD83D\uDD35',
    java: '\u2615',
    resource: '\uD83D\uDDC2\uFE0F',
    strings: '\uD83D\uDD24',
    location: '\uD83D\uDCCD',
    waveform: '\uD83C\uDF0A',
  };

  function renderCategoryTabs() {
    categoryTabs.innerHTML = '';
    const allCategories = getAllCategories();

    allCategories.forEach((cat, i) => {
      const tab = document.createElement('button');
      tab.className = 'category-tab' + (i === activeCategory ? ' active' : '');
      const iconChar = CATEGORY_ICON_MAP[cat.icon] || '';
      if (iconChar) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'category-tab-icon';
        iconSpan.textContent = iconChar;
        tab.appendChild(iconSpan);
      }
      tab.appendChild(document.createTextNode(cat.name));
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
    // Remove leftover strings filter when leaving Strings tab
    const staleFilter = metadataTbody.parentElement.parentElement.querySelector('.strings-filter-row');
    if (staleFilter) staleFilter.remove();
    const allCategories = getAllCategories();
    const cat = allCategories[activeCategory];
    if (!cat) return;

    // Hashes tab
    if (cat.name === 'Hashes & Checksums') {
      renderHashesTab();
      return;
    }

    // Strings tab — add search/filter input above the table
    const isStringsTab = cat.icon === 'strings' && cat._stringData;
    if (isStringsTab) {
      renderStringsTab(cat);
      return;
    }

    // .NET Assembly tab — render tree view
    if (cat.icon === 'dotnet' && cat._assemblyTree) {
      renderAssemblyTree(cat);
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
          || (cat.name === 'Document Properties' && key.startsWith('ooxml.'))
          || (cat.name === 'EXIF' && key.startsWith('exif.'))
          || (cat.name === 'GPS' && key.startsWith('gps.'))
          || (cat.name === 'IPTC' && key.startsWith('iptc.'));
        if (!belongsHere) continue;
        let label, editType = 'text';
        if (key.startsWith('png.text.')) label = key.substring(9);
        else if (key.startsWith('png.itext.')) label = key.substring(10) + ' (iTXt)';
        else if (key.startsWith('mp4.ilst.')) label = MP4_ILST_LABELS[key] || key.substring(9);
        else if (key.startsWith('ooxml.')) label = key.substring(6).charAt(0).toUpperCase() + key.substring(7);
        else if (key.startsWith('id3.TXXX.')) label = key.substring(9);
        else if (key.startsWith('gps.coordinates')) { label = 'Coordinates'; editType = 'geo'; }
        else if (key.startsWith('gps.altitude')) { label = 'Altitude'; editType = 'number'; }
        else if (key.startsWith('gps.direction')) { label = 'Image Direction'; editType = 'compass'; }
        else if (key.startsWith('gps.destination')) { label = 'Destination'; editType = 'geo'; }
        else if (key.startsWith('gps.')) label = 'GPS ' + key.substring(4);
        else if (key.startsWith('iptc.')) label = IPTC_FIELD_LABELS[key] || key.substring(5);
        else if (key.startsWith('exif.')) label = EXIF_ADD_TAG_LABELS[key] || key;
        else label = ID3_TAG_OPTIONS[key] || key;
        if (key === 'id3.TCON' || key === 'id3.TCO') editType = 'genre';
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

        // Visual elements (bar charts, histograms)
        if (field.visual)
          _renderFieldVisual(tdValue, field.visual);
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

    // "Add Tag" button for editable formats
    const ftId = parseResult.fileType.id;
    if (Editors.isEditable(ftId)) {
      const showPngAdd = ftId === 'png' && (cat.name === 'Text Chunks' || (cat.name === 'Image' && !parseResult.categories.some(c => c.name === 'Text Chunks')));
      const showMp4Add = ftId === 'mp4' && cat.name === 'iTunes Metadata';
      const showOoxmlAdd = ['docx', 'xlsx', 'pptx', 'ooxml'].includes(ftId) && cat.name === 'Document Properties';
      const showId3Add = ftId === 'mp3' && cat.name === 'ID3v2';
      const showExifAdd = ftId === 'jpeg' && (cat.name === 'EXIF' || cat.name === 'GPS');
      if (showPngAdd || showMp4Add || showOoxmlAdd || showId3Add || showExifAdd) {
        const tr = document.createElement('tr');
        tr.className = 'add-tag-row';
        const td = document.createElement('td');
        td.colSpan = 2;
        const btn = document.createElement('button');
        btn.className = 'add-tag-btn';
        btn.textContent = showPngAdd ? '+ Add Text Tag' : '+ Add Tag';
        btn.addEventListener('click', () => showPngAdd ? showAddTagDialog() : showMp4Add ? showAddMp4Dialog() : showId3Add ? showAddId3Dialog() : showExifAdd ? showAddExifDialog() : showAddOoxmlDialog());
        td.appendChild(btn);
        tr.appendChild(td);
        metadataTbody.appendChild(tr);
      }
    }
  }

  // ---- Visual field renderers (inline bar charts, histograms) ----
  function _renderFieldVisual(container, visual) {
    if (visual.type === 'bar')
      _renderBarVisual(container, visual);
    else if (visual.type === 'histogram')
      _renderHistogramVisual(container, visual);
  }

  function _renderBarVisual(container, visual) {
    const bar = document.createElement('div');
    bar.className = 'visual-bar';
    for (const seg of visual.segments) {
      const section = document.createElement('div');
      section.className = 'visual-bar-segment';
      section.style.width = seg.pct + '%';
      section.style.background = seg.color;
      section.title = seg.label + ': ' + seg.pct.toFixed(1) + '%';
      if (seg.pct > 8) {
        const lbl = document.createElement('span');
        lbl.className = 'visual-bar-label';
        lbl.textContent = seg.label;
        section.appendChild(lbl);
      }
      bar.appendChild(section);
    }
    container.appendChild(bar);
  }

  function _renderHistogramVisual(container, visual) {
    const data = visual.data;
    if (!data || data.length === 0) return;
    const max = Math.max(...data);
    if (max === 0) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'visual-histogram';

    const canvas = document.createElement('canvas');
    canvas.className = 'visual-histogram-canvas';
    canvas.width = 256;
    canvas.height = 48;
    wrapper.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    // Background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 256, 48);
    // Bars
    for (let i = 0; i < 256; ++i) {
      if (data[i] === 0) continue;
      const h = Math.max(1, Math.round((data[i] / max) * 46));
      // Color: gradient from blue (low byte values) to teal (high)
      const hue = 200 + (i / 255) * 30;
      ctx.fillStyle = 'hsl(' + hue + ', 60%, 55%)';
      ctx.fillRect(i, 48 - h, 1, h);
    }
    // Axis labels
    const axisRow = document.createElement('div');
    axisRow.className = 'visual-histogram-axis';
    axisRow.innerHTML = '<span>0x00</span><span>0x40</span><span>0x80</span><span>0xC0</span><span>0xFF</span>';
    wrapper.appendChild(axisRow);

    // Tooltip on hover
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) / (rect.width / 256));
      if (x >= 0 && x < 256)
        canvas.title = '0x' + x.toString(16).toUpperCase().padStart(2, '0') + ': ' + data[x].toLocaleString() + ' occurrences';
    });

    container.appendChild(wrapper);
  }

  // ---- Strings tab with search/filter ----
  function renderStringsTab(cat) {
    const wrapper = metadataTbody.parentElement;
    // Insert filter above the table
    let filterRow = wrapper.parentElement.querySelector('.strings-filter-row');
    if (filterRow) filterRow.remove();

    filterRow = document.createElement('div');
    filterRow.className = 'strings-filter-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'strings-search';
    input.placeholder = 'Filter strings\u2026';
    const countEl = document.createElement('span');
    countEl.className = 'strings-count';
    filterRow.appendChild(input);
    filterRow.appendChild(countEl);
    wrapper.parentElement.insertBefore(filterRow, wrapper);

    function renderFiltered(filter) {
      metadataTbody.innerHTML = '';
      const lf = filter.toLowerCase();
      let shown = 0;
      for (const field of cat.fields) {
        if (lf && !field.value.toLowerCase().includes(lf) && !field.label.toLowerCase().includes(lf))
          continue;
        ++shown;
        const tr = document.createElement('tr');
        const tdLabel = document.createElement('td');
        tdLabel.className = 'field-label';
        tdLabel.textContent = field.label;
        const tdValue = document.createElement('td');
        tdValue.className = 'field-value';
        // Badge for encoding + section
        const badge = document.createElement('span');
        const enc = field.encoding || 'ANSI';
        const encClass = enc.startsWith('UTF-16') ? 'utf16' : 'ansi';
        badge.className = 'strings-badge strings-badge-' + encClass;
        badge.textContent = field.encoding || 'ANSI';
        badge.title = 'Section: ' + (field.section || '?');
        tdValue.appendChild(badge);
        tdValue.appendChild(document.createTextNode(' ' + field.value));
        tr.appendChild(tdLabel);
        tr.appendChild(tdValue);
        metadataTbody.appendChild(tr);
      }
      countEl.textContent = shown + ' / ' + cat.fields.length + ' strings';
    }

    input.addEventListener('input', () => renderFiltered(input.value));
    renderFiltered('');
    input.focus();
  }

  // ---- .NET Assembly tree view ----
  function renderAssemblyTree(cat) {
    metadataTbody.innerHTML = '';
    const tree = cat._assemblyTree;
    if (!tree || tree.length === 0) return;

    for (const ns of tree) {
      const nsTr = document.createElement('tr');
      nsTr.className = 'assembly-tree-ns expandable-parent';
      const nsTdLabel = document.createElement('td');
      nsTdLabel.className = 'field-label';
      nsTdLabel.colSpan = 2;
      const nsChevron = document.createElement('span');
      nsChevron.className = 'expand-chevron';
      nsChevron.textContent = '\u25B6';
      nsTdLabel.appendChild(nsChevron);
      nsTdLabel.appendChild(document.createTextNode(' ' + ns.namespace + ' (' + ns.types.length + ' types)'));
      nsTr.appendChild(nsTdLabel);
      metadataTbody.appendChild(nsTr);

      const typeRows = [];
      for (const type of ns.types) {
        const typeTr = document.createElement('tr');
        typeTr.className = 'assembly-tree-type expandable-child';
        typeTr.style.display = 'none';
        const typeTd = document.createElement('td');
        typeTd.className = 'field-label assembly-tree-indent';
        typeTd.colSpan = 2;
        const typeChevron = document.createElement('span');
        typeChevron.className = 'expand-chevron';
        typeChevron.textContent = '\u25B6';
        typeTd.appendChild(typeChevron);
        typeTd.appendChild(document.createTextNode(' ' + type.declaration));
        typeTr.appendChild(typeTd);
        metadataTbody.appendChild(typeTr);
        typeRows.push(typeTr);

        const memberRows = [];
        for (const member of type.members) {
          const memTr = document.createElement('tr');
          memTr.className = 'assembly-tree-member expandable-child';
          memTr.style.display = 'none';
          const memTd = document.createElement('td');
          memTd.className = 'field-value assembly-tree-indent2';
          memTd.colSpan = 2;
          const memText = typeof member === 'string' ? member : member.text;
          memTd.textContent = memText;
          // Make method members clickable — navigate to disassembly
          if (member.kind === 'method' && member.rva) {
            memTd.style.cursor = 'pointer';
            memTd.title = 'Click to view disassembly';
            memTd.addEventListener('click', e => {
              e.stopPropagation();
              _navigateToMethodRva(member.rva);
            });
          }
          memTr.appendChild(memTd);
          metadataTbody.appendChild(memTr);
          memberRows.push(memTr);
        }

        typeTr.addEventListener('click', (e) => {
          e.stopPropagation();
          const visible = memberRows.length > 0 && memberRows[0].style.display !== 'none';
          for (const mr of memberRows) mr.style.display = visible ? 'none' : '';
          typeChevron.textContent = visible ? '\u25B6' : '\u25BC';
        });
      }

      nsTr.addEventListener('click', () => {
        const visible = typeRows.length > 0 && typeRows[0].style.display !== 'none';
        for (const tr of typeRows) tr.style.display = visible ? 'none' : '';
        if (visible)
          for (const type of ns.types)
            for (const mr of metadataTbody.querySelectorAll('.assembly-tree-member'))
              mr.style.display = 'none';
        nsChevron.textContent = visible ? '\u25B6' : '\u25BC';
      });
    }
  }

  /** Navigate to a method's IL body in the MSIL disassembly panel by RVA. */
  function _navigateToMethodRva(rva) {
    // Find the MSIL disasm panel that has methods
    const st = _disasmPanels.find(p => p.info && p.info.archId === 'msil' && p.info.methods);
    if (!st) return;
    // Find the method with matching RVA
    const me = st.info.methods.find(m => m.rva === rva);
    if (!me) return;
    // Expand the disassembly accordion if collapsed
    const section = st.container && st.container.closest('.accordion-section');
    if (section && section.classList.contains('collapsed'))
      section.classList.remove('collapsed');
    // Decode the method body and navigate
    _disasmDecodeAndMerge(st, me.offset, Math.max(_DISASM_BATCH, Math.ceil((me.codeSection ? me.codeSection.size : 256) / 2)));
    _disasmRenderListing(st);
    _disasmUpdateStatus(st);
    // Update the method picker dropdown if present
    const toolbar = st.container && st.container.querySelector('.disasm-toolbar');
    if (toolbar) {
      const selects = toolbar.querySelectorAll('select');
      for (const sel of selects) {
        if (sel.style.maxWidth === '260px') {
          const idx = st.info.methods.indexOf(me);
          if (idx >= 0) sel.value = String(idx);
          break;
        }
      }
    }
    requestAnimationFrame(() => {
      _disasmScrollTo(st, me.offset, true);
      // Scroll the accordion body into view
      if (st.container) st.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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

      // Parse current value — prefer modification JSON, then field properties, then regex fallback
      let _initLat, _initLng;
      try { const j = JSON.parse(currentValue); _initLat = j.lat; _initLng = j.lng; } catch (_) {}
      if (_initLat == null && field.lat != null) { _initLat = field.lat; _initLng = field.lng; }
      if (_initLat == null) {
        const m = String(currentValue).match(/([-\d.]+)\s*°/g);
        if (m && m.length >= 2) { _initLat = parseFloat(m[0]); _initLng = parseFloat(m[1]); }
      }
      if (_initLat != null) { latInput.value = _initLat; lngInput.value = _initLng; }

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

    // --- Compass edit type ---
    if (field.editType === 'compass') {
      const toolbar = document.createElement('div');
      toolbar.className = 'compass-edit-toolbar';

      const numInput = document.createElement('input');
      numInput.type = 'number';
      numInput.min = '0';
      numInput.max = '360';
      numInput.step = '0.1';
      numInput.className = 'field-edit-input';
      numInput.style.width = '80px';
      const dirMatch = String(currentValue).match(/([\d.]+)/);
      numInput.value = dirMatch ? dirMatch[1] : '0';

      const canvas = document.createElement('canvas');
      canvas.className = 'compass-canvas';
      canvas.width = 60;
      canvas.height = 60;

      _drawCompass(canvas, parseFloat(numInput.value) || 0);
      numInput.addEventListener('input', () => _drawCompass(canvas, parseFloat(numInput.value) || 0));

      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const cx = rect.width / 2, cy = rect.height / 2;
        const dx = e.clientX - rect.left - cx;
        const dy = e.clientY - rect.top - cy;
        let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
        if (angle < 0) angle += 360;
        numInput.value = angle.toFixed(1);
        _drawCompass(canvas, angle);
      });

      const applyBtn = document.createElement('button');
      applyBtn.className = 'field-edit-btn';
      applyBtn.textContent = 'Apply';
      applyBtn.addEventListener('click', () => {
        markDirty(field.key, numInput.value);
        renderMetadata();
      });

      toolbar.appendChild(numInput);
      toolbar.appendChild(document.createTextNode('\u00B0'));
      toolbar.appendChild(canvas);
      toolbar.appendChild(applyBtn);
      parent.appendChild(toolbar);
      numInput.focus();
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

  // ---- Nominatim Geocoding ----
  let _geocodeTimer = null;
  let _lastGeocodeTime = 0;
  const _NOMINATIM_HEADERS = { 'User-Agent': 'SynthelicZ-MetadataViewer/1.0' };

  async function reverseGeocode(lat, lng) {
    const url = 'https://nominatim.openstreetmap.org/reverse?format=json'
      + '&lat=' + lat.toFixed(6) + '&lon=' + lng.toFixed(6)
      + '&zoom=18&addressdetails=1&accept-language=en';
    const resp = await fetch(url, { headers: _NOMINATIM_HEADERS });
    const data = await resp.json();
    return {
      country: data.address?.country || '',
      countryCode: (data.address?.country_code || '').toUpperCase(),
      state: data.address?.state || data.address?.region || '',
      city: data.address?.city || data.address?.town || data.address?.village || '',
      sublocation: data.address?.suburb || data.address?.neighbourhood || '',
    };
  }

  async function forwardGeocode(query) {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1'
      + '&q=' + encodeURIComponent(query);
    const resp = await fetch(url, { headers: _NOMINATIM_HEADERS });
    const results = await resp.json();
    if (results.length === 0) return null;
    return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), name: results[0].display_name };
  }

  const IPTC_FIELD_LABELS = {
    'iptc.65': 'Country', 'iptc.5f': 'Province/State',
    'iptc.5a': 'City', 'iptc.5c': 'Sub-Location', 'iptc.64': 'Country Code',
  };

  // ---- DMS formatting helper ----
  function _decToDms(dec) {
    const abs = Math.abs(dec);
    const d = Math.floor(abs);
    const mf = (abs - d) * 60;
    const m = Math.floor(mf);
    const s = ((mf - m) * 60).toFixed(2);
    return d + '\u00B0' + String(m).padStart(2, '0') + "'" + String(s).padStart(5, '0') + '"';
  }

  function _formatDmsLat(dec) { return _decToDms(dec) + (dec >= 0 ? ' N' : ' S'); }
  function _formatDmsLng(dec) { return _decToDms(dec) + (dec >= 0 ? ' E' : ' W'); }

  // ---- Compass drawing ----
  function _drawCompass(canvas, angle) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    const cx = w / 2, cy = h / 2, r = Math.min(cx, cy) - 4;
    ctx.clearRect(0, 0, w, h);
    // Circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = '#aca899';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Tick marks
    for (let a = 0; a < 360; a += 30) {
      const rad = (a - 90) * Math.PI / 180;
      const inner = a % 90 === 0 ? r - 10 : r - 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
      ctx.lineTo(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r);
      ctx.strokeStyle = '#808080';
      ctx.lineWidth = a % 90 === 0 ? 2 : 0.5;
      ctx.stroke();
    }
    // N/E/S/W labels
    const fs = Math.max(8, Math.round(r * 0.22));
    ctx.font = 'bold ' + fs + 'px Tahoma';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333';
    ctx.fillText('N', cx, cy - r + fs - 1);
    ctx.fillText('S', cx, cy + r - fs + 1);
    ctx.fillText('E', cx + r - fs + 1, cy);
    ctx.fillText('W', cx - r + fs - 1, cy);
    // Red arrow
    const aRad = (angle - 90) * Math.PI / 180;
    const arrowLen = r - Math.round(r * 0.2);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(aRad) * arrowLen, cy + Math.sin(aRad) * arrowLen);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Arrow tip
    ctx.beginPath();
    ctx.arc(cx + Math.cos(aRad) * arrowLen, cy + Math.sin(aRad) * arrowLen, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#333';
    ctx.fill();
  }

  // ---- Geodesic helpers (Haversine) ----
  const _R_EARTH_KM = 6371.0;
  const _deg2rad = d => d * Math.PI / 180;
  const _rad2deg = r => r * 180 / Math.PI;

  function _haversineDistance(lat1, lng1, lat2, lng2) {
    const dLat = _deg2rad(lat2 - lat1), dLng = _deg2rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(_deg2rad(lat1)) * Math.cos(_deg2rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return _R_EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function _bearing(lat1, lng1, lat2, lng2) {
    const dLng = _deg2rad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(_deg2rad(lat2));
    const x = Math.cos(_deg2rad(lat1)) * Math.sin(_deg2rad(lat2)) - Math.sin(_deg2rad(lat1)) * Math.cos(_deg2rad(lat2)) * Math.cos(dLng);
    return (_rad2deg(Math.atan2(y, x)) + 360) % 360;
  }

  function _destPoint(lat, lng, bearingDeg, distKm) {
    const brng = _deg2rad(bearingDeg);
    const lat1 = _deg2rad(lat), lng1 = _deg2rad(lng);
    const d = distKm / _R_EARTH_KM;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: _rad2deg(lat2), lng: _rad2deg(lng2) };
  }

  // ---- Geo Picker — MDI-style movable/resizable sub-window ----
  function openGeoPickerDialog(field, latInput, lngInput) {
    // Remove existing geo picker if open
    const existing = document.querySelector('.geo-mdi');
    if (existing) existing.remove();

    const win = document.createElement('div');
    win.className = 'geo-mdi';
    // Default position/size: centered, 780x560
    const appRect = document.querySelector('.app-container').getBoundingClientRect();
    const defW = Math.min(780, appRect.width - 20);
    const defH = Math.min(560, appRect.height - 20);
    win.style.width = defW + 'px';
    win.style.height = defH + 'px';
    win.style.left = Math.max(0, (appRect.width - defW) / 2) + 'px';
    win.style.top = Math.max(0, (appRect.height - defH) / 2) + 'px';

    // ---- Title bar (draggable) ----
    const titleBar = document.createElement('div');
    titleBar.className = 'geo-mdi-title';
    const titleText = document.createElement('span');
    titleText.className = 'geo-mdi-title-text';
    titleText.textContent = 'GPS & Location Editor';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'geo-mdi-close';
    closeBtn.textContent = '\u2715';
    closeBtn.addEventListener('click', () => win.remove());
    titleBar.appendChild(titleText);
    titleBar.appendChild(closeBtn);
    win.appendChild(titleBar);

    // Drag via title bar
    let _dragWin = false, _dwX, _dwY;
    titleBar.addEventListener('pointerdown', (e) => {
      if (e.target === closeBtn) return;
      _dragWin = true;
      _dwX = e.clientX - win.offsetLeft;
      _dwY = e.clientY - win.offsetTop;
      titleBar.setPointerCapture(e.pointerId);
    });
    titleBar.addEventListener('pointermove', (e) => {
      if (!_dragWin) return;
      win.style.left = Math.max(0, e.clientX - _dwX) + 'px';
      win.style.top = Math.max(0, e.clientY - _dwY) + 'px';
    });
    titleBar.addEventListener('pointerup', () => { _dragWin = false; });

    // ---- Body: map panel (left) + data panel (right) ----
    const body = document.createElement('div');
    body.className = 'geo-mdi-body';

    // ======= Left: Map panel =======
    const mapPanel = document.createElement('div');
    mapPanel.className = 'geo-mdi-map-panel';

    const mapDiv = document.createElement('div');
    mapDiv.className = 'geo-mdi-map';
    mapPanel.appendChild(mapDiv);

    // SVG overlay for FOV cone (drawn on top of tiles)
    const fovSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    fovSvg.setAttribute('class', 'geo-fov-overlay');
    mapDiv.appendChild(fovSvg);

    // Map bottom bar: direction info | search | coordinates
    const mapBar = document.createElement('div');
    mapBar.className = 'geo-mdi-map-bar';
    const dirDisplay = document.createElement('span');
    dirDisplay.className = 'geo-mdi-coord-display';
    const searchInput = _el('input', { type: 'text', placeholder: 'Search location\u2026' });
    const searchBtn = document.createElement('button');
    searchBtn.textContent = 'Search';
    const coordDisplay = document.createElement('span');
    coordDisplay.className = 'geo-mdi-coord-display';
    mapBar.appendChild(dirDisplay);
    mapBar.appendChild(searchInput);
    mapBar.appendChild(searchBtn);
    mapBar.appendChild(coordDisplay);
    mapPanel.appendChild(mapBar);

    body.appendChild(mapPanel);

    // ======= Right: Data panel =======
    const dataPanel = document.createElement('div');
    dataPanel.className = 'geo-mdi-data-panel';

    // --- GPS Data section ---
    const gpsSec = document.createElement('div');
    gpsSec.className = 'geo-mdi-section';
    const gpsTitle = document.createElement('div');
    gpsTitle.className = 'geo-mdi-section-title';
    gpsTitle.textContent = 'GPS Data';
    gpsSec.appendChild(gpsTitle);

    const dlgLat = _el('input', { type: 'number', step: '0.000001' });
    const dmsLat = document.createElement('span');
    dmsLat.className = 'geo-dms';
    const dlgLng = _el('input', { type: 'number', step: '0.000001' });
    const dmsLng = document.createElement('span');
    dmsLng.className = 'geo-dms';
    const dlgDir = _el('input', { type: 'number', min: '0', max: '360', step: '0.1' });
    const dirRefSel = _el('select');
    dirRefSel.innerHTML = '<option value="T">True North</option><option value="M">Magnetic North</option>';
    const dlgAlt = _el('input', { type: 'number', step: '0.01' });

    dlgLat.value = latInput.value || '0';
    dlgLng.value = lngInput.value || '0';
    dlgDir.value = '0';
    dlgAlt.value = '0';

    // Pre-fill from existing modifications
    const existingAlt = modifications.get('gps.altitude');
    if (existingAlt != null) { const m = String(existingAlt).match(/([\d.]+)/); if (m) dlgAlt.value = m[1]; }
    const existingDir = modifications.get('gps.direction');
    if (existingDir != null) { const m = String(existingDir).match(/([\d.]+)/); if (m) dlgDir.value = m[1]; }

    function updateDms() {
      const lat = parseFloat(dlgLat.value) || 0;
      const lng = parseFloat(dlgLng.value) || 0;
      dmsLat.textContent = _formatDmsLat(lat);
      dmsLng.textContent = _formatDmsLng(lng);
      coordDisplay.textContent = lat.toFixed(6) + ', ' + lng.toFixed(6);
    }
    updateDms();

    function _gpsField(label, input, extra) {
      const row = document.createElement('div');
      row.className = 'geo-mdi-field';
      const lbl = document.createElement('label');
      lbl.textContent = label;
      row.appendChild(lbl);
      row.appendChild(input);
      if (extra) row.appendChild(extra);
      return row;
    }

    gpsSec.appendChild(_gpsField('Latitude:', dlgLat, dmsLat));
    gpsSec.appendChild(_gpsField('Longitude:', dlgLng, dmsLng));

    // Direction row: input + compass canvas
    const dirFieldRow = _gpsField('Direction [\u00B0]:', dlgDir, dirRefSel);
    gpsSec.appendChild(dirFieldRow);

    const compassRow = document.createElement('div');
    compassRow.className = 'geo-mdi-compass-row';
    const compassCanvas = document.createElement('canvas');
    compassCanvas.className = 'compass-canvas';
    compassCanvas.width = 80;
    compassCanvas.height = 80;
    compassRow.appendChild(compassCanvas);
    // Instruction text next to compass
    const compassHint = document.createElement('span');
    compassHint.style.cssText = 'font-size:9px;color:var(--sz-color-gray-text);';
    compassHint.textContent = 'Click compass or map cone to set direction';
    compassRow.appendChild(compassHint);
    gpsSec.appendChild(compassRow);

    gpsSec.appendChild(_gpsField('Altitude [m]:', dlgAlt));

    dataPanel.appendChild(gpsSec);

    // --- Destination section ---
    const destSec = document.createElement('div');
    destSec.className = 'geo-mdi-section';
    const destTitle = document.createElement('div');
    destTitle.className = 'geo-mdi-section-title';
    destTitle.textContent = 'Destination (Target)';
    destSec.appendChild(destTitle);

    const destEnableCb = _el('input', { type: 'checkbox' });
    const destEnableRow = document.createElement('div');
    destEnableRow.className = 'geo-mdi-loc-field';
    const destEnableLbl = document.createElement('label');
    destEnableLbl.textContent = 'Show target on map';
    destEnableRow.appendChild(destEnableCb);
    destEnableRow.appendChild(destEnableLbl);
    destSec.appendChild(destEnableRow);

    const dlgDestLat = _el('input', { type: 'number', step: '0.000001' });
    const dmsDestLat = document.createElement('span');
    dmsDestLat.className = 'geo-dms';
    const dlgDestLng = _el('input', { type: 'number', step: '0.000001' });
    const dmsDestLng = document.createElement('span');
    dmsDestLng.className = 'geo-dms';
    const dlgDestDist = _el('input', { type: 'number', min: '0', step: '0.01' });

    dlgDestLat.value = '0';
    dlgDestLng.value = '0';
    dlgDestDist.value = '1';

    // Pre-fill from existing destination modification or parsed field
    const existingDest = modifications.get('gps.destination');
    if (existingDest) {
      try {
        const d = JSON.parse(existingDest);
        if (d.lat != null) dlgDestLat.value = d.lat;
        if (d.lng != null) dlgDestLng.value = d.lng;
        destEnableCb.checked = true;
      } catch (_) {}
    } else if (field.key === 'gps.destination' && field.lat != null) {
      dlgDestLat.value = field.lat;
      dlgDestLng.value = field.lng;
      destEnableCb.checked = true;
    } else {
      // Check if there's a parsed destination field in the current metadata
      const gpsCat = parseResult.categories.find(c => c.name === 'GPS');
      const destField = gpsCat && gpsCat.fields.find(f => f.key === 'gps.destination');
      if (destField && destField.lat != null) {
        dlgDestLat.value = destField.lat;
        dlgDestLng.value = destField.lng;
        destEnableCb.checked = true;
      }
    }

    const destFieldsDiv = document.createElement('div');
    destFieldsDiv.className = 'geo-mdi-dest-fields';
    destFieldsDiv.appendChild(_gpsField('Target Lat:', dlgDestLat, dmsDestLat));
    destFieldsDiv.appendChild(_gpsField('Target Lng:', dlgDestLng, dmsDestLng));
    destFieldsDiv.appendChild(_gpsField('Distance [km]:', dlgDestDist));

    const destHint = document.createElement('div');
    destHint.style.cssText = 'font-size:9px;color:var(--sz-color-gray-text);margin-top:2px;';
    destHint.textContent = 'Right-click map to place target; or enter coordinates';
    destFieldsDiv.appendChild(destHint);

    destSec.appendChild(destFieldsDiv);
    dataPanel.appendChild(destSec);

    function updateDestFields() {
      destFieldsDiv.style.display = destEnableCb.checked ? '' : 'none';
    }
    destEnableCb.addEventListener('change', () => { updateDestFields(); renderMap(); });
    updateDestFields();

    function updateDestDms() {
      const lat = parseFloat(dlgDestLat.value) || 0;
      const lng = parseFloat(dlgDestLng.value) || 0;
      dmsDestLat.textContent = _formatDmsLat(lat);
      dmsDestLng.textContent = _formatDmsLng(lng);
    }
    updateDestDms();

    // Sync distance from image-to-target coordinates
    function syncDestDistance() {
      const sLat = parseFloat(dlgLat.value) || 0, sLng = parseFloat(dlgLng.value) || 0;
      const dLat = parseFloat(dlgDestLat.value) || 0, dLng = parseFloat(dlgDestLng.value) || 0;
      dlgDestDist.value = _haversineDistance(sLat, sLng, dLat, dLng).toFixed(3);
    }

    // Sync target position from direction + distance
    function syncTargetFromDirDist() {
      const sLat = parseFloat(dlgLat.value) || 0, sLng = parseFloat(dlgLng.value) || 0;
      const dir = parseFloat(dlgDir.value) || 0;
      const dist = parseFloat(dlgDestDist.value) || 1;
      const pt = _destPoint(sLat, sLng, dir, dist);
      dlgDestLat.value = pt.lat.toFixed(6);
      dlgDestLng.value = pt.lng.toFixed(6);
      updateDestDms();
    }

    // Sync direction + distance from target position
    function syncDirDistFromTarget() {
      const sLat = parseFloat(dlgLat.value) || 0, sLng = parseFloat(dlgLng.value) || 0;
      const dLat = parseFloat(dlgDestLat.value) || 0, dLng = parseFloat(dlgDestLng.value) || 0;
      if (sLat === dLat && sLng === dLng) return;
      const b = _bearing(sLat, sLng, dLat, dLng);
      dlgDir.value = b.toFixed(1);
      syncDestDistance();
      _drawCompass(compassCanvas, b);
    }

    // If we have a destination but no direction, compute direction from source to dest
    if (destEnableCb.checked) {
      syncDestDistance();
      const dLat = parseFloat(dlgDestLat.value) || 0, dLng = parseFloat(dlgDestLng.value) || 0;
      const sLat = parseFloat(dlgLat.value) || 0, sLng = parseFloat(dlgLng.value) || 0;
      if ((dLat !== 0 || dLng !== 0) && (sLat !== dLat || sLng !== dLng)) {
        const b = _bearing(sLat, sLng, dLat, dLng);
        if (parseFloat(dlgDir.value) === 0) dlgDir.value = b.toFixed(1);
      }
    }

    // --- Location section ---
    const locSec = document.createElement('div');
    locSec.className = 'geo-mdi-section';
    const locTitle = document.createElement('div');
    locTitle.className = 'geo-mdi-section-title';
    locTitle.textContent = 'Location';
    locSec.appendChild(locTitle);

    const geoFields = {};
    for (const [id, label] of [['countryCode', 'Code'], ['country', 'Country'], ['state', 'State'], ['city', 'City'], ['sublocation', 'Place']]) {
      const row = document.createElement('div');
      row.className = 'geo-mdi-loc-field';
      const cb = _el('input', { type: 'checkbox', checked: true });
      const lbl = document.createElement('label');
      lbl.textContent = label + ':';
      const inp = _el('input', { type: 'text' });
      if (id === 'countryCode') inp.style.width = '50px';
      row.appendChild(cb);
      row.appendChild(lbl);
      row.appendChild(inp);
      locSec.appendChild(row);
      geoFields[id] = { cb, input: inp };
    }

    // Pre-fill from existing IPTC
    const iptcPrefill = { country: 'iptc.65', state: 'iptc.5f', city: 'iptc.5a', sublocation: 'iptc.5c', countryCode: 'iptc.64' };
    for (const [gk, mk] of Object.entries(iptcPrefill)) {
      const val = modifications.get(mk);
      if (val) geoFields[gk].input.value = val;
    }

    const gpsLookupRow = document.createElement('div');
    gpsLookupRow.style.cssText = 'margin-top:4px;';
    const gpsLookupBtn = document.createElement('button');
    gpsLookupBtn.className = 'action-btn';
    gpsLookupBtn.textContent = 'Look Up Location';
    gpsLookupRow.appendChild(gpsLookupBtn);
    locSec.appendChild(gpsLookupRow);

    const geoStatus = document.createElement('div');
    geoStatus.className = 'geo-mdi-status';
    locSec.appendChild(geoStatus);
    dataPanel.appendChild(locSec);

    body.appendChild(dataPanel);
    win.appendChild(body);

    // ---- Button row ----
    const btnRow = document.createElement('div');
    btnRow.className = 'geo-mdi-buttons';
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    btnRow.appendChild(okBtn);
    btnRow.appendChild(cancelBtn);
    win.appendChild(btnRow);

    // ---- Resize handle ----
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'geo-mdi-resize';
    win.appendChild(resizeHandle);

    let _resizing = false, _rsx, _rsy, _rsw, _rsh;
    resizeHandle.addEventListener('pointerdown', (e) => {
      _resizing = true;
      _rsx = e.clientX;
      _rsy = e.clientY;
      _rsw = win.offsetWidth;
      _rsh = win.offsetHeight;
      resizeHandle.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });
    resizeHandle.addEventListener('pointermove', (e) => {
      if (!_resizing) return;
      win.style.width = Math.max(520, _rsw + e.clientX - _rsx) + 'px';
      win.style.height = Math.max(400, _rsh + e.clientY - _rsy) + 'px';
      renderMap();
    });
    resizeHandle.addEventListener('pointerup', () => { _resizing = false; });

    // Mount into app container
    document.querySelector('.app-container').appendChild(win);

    // ======= Map engine =======
    const initLat = parseFloat(dlgLat.value) || 0;
    const initLng = parseFloat(dlgLng.value) || 0;
    let zoom = (initLat !== 0 || initLng !== 0) ? 14 : 4;
    let centerLat = initLat, centerLng = initLng;
    let markerLat = initLat, markerLng = initLng;

    function lon2tile(lon, z) { return ((lon + 180) / 360) * (1 << z); }
    function lat2tile(lat, z) { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * (1 << z); }
    function tile2lon(x, z) { return x / (1 << z) * 360 - 180; }
    function tile2lat(y, z) { const n = Math.PI - 2 * Math.PI * y / (1 << z); return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); }

    function renderMap() {
      // Clear tiles (keep SVG overlay)
      const children = [...mapDiv.children];
      for (const c of children) { if (c !== fovSvg) mapDiv.removeChild(c); }
      // Bring SVG to front
      mapDiv.appendChild(fovSvg);

      const w = mapDiv.clientWidth || 500;
      const h = mapDiv.clientHeight || 300;
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
          img.style.left = Math.round(halfW + (tx - cx) * tileSize) + 'px';
          img.style.top = Math.round(halfH + (ty - cy) * tileSize) + 'px';
          mapDiv.insertBefore(img, fovSvg);
        }
      }

      // Marker pixel position
      const mx = halfW + (lon2tile(markerLng, zoom) - cx) * tileSize;
      const my = halfH + (lat2tile(markerLat, zoom) - cy) * tileSize;

      // GeoSetter-style FOV cone via SVG
      const dir = parseFloat(dlgDir.value) || 0;
      fovSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      fovSvg.style.width = w + 'px';
      fovSvg.style.height = h + 'px';
      fovSvg.innerHTML = '';

      if (dir > 0) {
        // Large FOV triangle: 60-degree spread, length ~40% of map diagonal
        const fovHalf = 30 * Math.PI / 180; // 30 deg each side
        const coneLen = Math.max(w, h) * 0.6;
        const dirRad = (dir - 90) * Math.PI / 180;
        const x1 = mx + Math.cos(dirRad - fovHalf) * coneLen;
        const y1 = my + Math.sin(dirRad - fovHalf) * coneLen;
        const x2 = mx + Math.cos(dirRad + fovHalf) * coneLen;
        const y2 = my + Math.sin(dirRad + fovHalf) * coneLen;
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', mx + ',' + my + ' ' + x1 + ',' + y1 + ' ' + x2 + ',' + y2);
        polygon.setAttribute('fill', 'rgba(100, 80, 200, 0.25)');
        polygon.setAttribute('stroke', 'rgba(100, 80, 200, 0.6)');
        polygon.setAttribute('stroke-width', '1');
        fovSvg.appendChild(polygon);

        // Direction line (center of cone)
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', mx);
        line.setAttribute('y1', my);
        line.setAttribute('x2', mx + Math.cos(dirRad) * coneLen);
        line.setAttribute('y2', my + Math.sin(dirRad) * coneLen);
        line.setAttribute('stroke', 'rgba(100, 80, 200, 0.4)');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '4,3');
        fovSvg.appendChild(line);

        dirDisplay.textContent = 'Dir: ' + dir.toFixed(1) + '\u00B0';
      } else
        dirDisplay.textContent = '';

      // Target marker (blue dot) if destination enabled
      if (destEnableCb.checked) {
        const tLat = parseFloat(dlgDestLat.value) || 0;
        const tLng = parseFloat(dlgDestLng.value) || 0;
        const tx = halfW + (lon2tile(tLng, zoom) - cx) * tileSize;
        const ty = halfH + (lat2tile(tLat, zoom) - cy) * tileSize;

        // Dashed line from source to target
        const connLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        connLine.setAttribute('x1', mx);
        connLine.setAttribute('y1', my);
        connLine.setAttribute('x2', tx);
        connLine.setAttribute('y2', ty);
        connLine.setAttribute('stroke', 'rgba(59, 130, 246, 0.5)');
        connLine.setAttribute('stroke-width', '1.5');
        connLine.setAttribute('stroke-dasharray', '5,4');
        fovSvg.appendChild(connLine);

        // Target circle
        const targetCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        targetCircle.setAttribute('cx', tx);
        targetCircle.setAttribute('cy', ty);
        targetCircle.setAttribute('r', '7');
        targetCircle.setAttribute('fill', '#3b82f6');
        targetCircle.setAttribute('stroke', '#fff');
        targetCircle.setAttribute('stroke-width', '2');
        fovSvg.appendChild(targetCircle);
        // Target crosshair
        for (const [dx, dy] of [[0, -4], [0, 4], [-4, 0], [4, 0]]) {
          const ch = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          ch.setAttribute('x1', tx + dx * 0.5);
          ch.setAttribute('y1', ty + dy * 0.5);
          ch.setAttribute('x2', tx + dx * 1.8);
          ch.setAttribute('y2', ty + dy * 1.8);
          ch.setAttribute('stroke', '#fff');
          ch.setAttribute('stroke-width', '1.5');
          fovSvg.appendChild(ch);
        }
      }

      // Source marker dot (red, on top of everything)
      const markerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      markerCircle.setAttribute('cx', mx);
      markerCircle.setAttribute('cy', my);
      markerCircle.setAttribute('r', '7');
      markerCircle.setAttribute('fill', '#e11d48');
      markerCircle.setAttribute('stroke', '#fff');
      markerCircle.setAttribute('stroke-width', '2');
      fovSvg.appendChild(markerCircle);
      // Inner dot
      const innerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      innerDot.setAttribute('cx', mx);
      innerDot.setAttribute('cy', my);
      innerDot.setAttribute('r', '2.5');
      innerDot.setAttribute('fill', '#fff');
      fovSvg.appendChild(innerDot);
    }

    renderMap();
    _drawCompass(compassCanvas, parseFloat(dlgDir.value) || 0);
    updateDms();

    // ======= Map interactions =======
    function scheduleGeocode() {
      if (_geocodeTimer) clearTimeout(_geocodeTimer);
      _geocodeTimer = setTimeout(doReverseGeocode, 1200);
    }

    function _pixelToLatLng(px, py) {
      const w = mapDiv.clientWidth, h = mapDiv.clientHeight;
      const cx = lon2tile(centerLng, zoom);
      const cy = lat2tile(centerLat, zoom);
      return { lat: tile2lat(cy + (py - h / 2) / 256, zoom), lng: tile2lon(cx + (px - w / 2) / 256, zoom) };
    }

    mapDiv.addEventListener('click', (e) => {
      if (e.target.closest('.geo-mdi-map-bar') || e.target === fovSvg) return;
      const rect = mapDiv.getBoundingClientRect();
      const pt = _pixelToLatLng(e.clientX - rect.left, e.clientY - rect.top);
      markerLat = pt.lat;
      markerLng = pt.lng;
      dlgLat.value = markerLat.toFixed(6);
      dlgLng.value = markerLng.toFixed(6);
      updateDms();
      if (destEnableCb.checked) syncDirDistFromTarget();
      renderMap();
      scheduleGeocode();
    });

    // Right-click to place target
    mapDiv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (e.target.closest('.geo-mdi-map-bar')) return;
      const rect = mapDiv.getBoundingClientRect();
      const pt = _pixelToLatLng(e.clientX - rect.left, e.clientY - rect.top);
      destEnableCb.checked = true;
      updateDestFields();
      dlgDestLat.value = pt.lat.toFixed(6);
      dlgDestLng.value = pt.lng.toFixed(6);
      updateDestDms();
      syncDirDistFromTarget();
      _drawCompass(compassCanvas, parseFloat(dlgDir.value) || 0);
      renderMap();
    });

    mapDiv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const newZoom = Math.max(1, Math.min(18, zoom + (e.deltaY < 0 ? 1 : -1)));
      if (newZoom === zoom) return;

      // Zoom towards mouse position: keep the lat/lng under the cursor fixed
      const rect = mapDiv.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const w = mapDiv.clientWidth, h = mapDiv.clientHeight;

      // Lat/lng under the mouse at current zoom
      const cx = lon2tile(centerLng, zoom);
      const cy = lat2tile(centerLat, zoom);
      const mouseLng = tile2lon(cx + (mx - w / 2) / 256, zoom);
      const mouseLat = tile2lat(cy + (my - h / 2) / 256, zoom);

      // Adjust center so that same lat/lng stays under the mouse at new zoom
      centerLng = tile2lon(lon2tile(mouseLng, newZoom) - (mx - w / 2) / 256, newZoom);
      centerLat = tile2lat(lat2tile(mouseLat, newZoom) - (my - h / 2) / 256, newZoom);
      zoom = newZoom;
      renderMap();
    }, { passive: false });

    // Pan via drag
    let dragging = false, dragStartX, dragStartY, dragCLat, dragCLng;
    mapDiv.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.geo-mdi-map-bar')) return;
      dragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragCLat = centerLat;
      dragCLng = centerLng;
      mapDiv.setPointerCapture(e.pointerId);
    });
    mapDiv.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      centerLng = tile2lon(lon2tile(dragCLng, zoom) - (e.clientX - dragStartX) / 256, zoom);
      centerLat = tile2lat(lat2tile(dragCLat, zoom) - (e.clientY - dragStartY) / 256, zoom);
      renderMap();
    });
    mapDiv.addEventListener('pointerup', () => { dragging = false; });
    mapDiv.addEventListener('lostpointercapture', () => { dragging = false; });

    // ======= Data panel interactions =======
    dlgLat.addEventListener('change', () => {
      markerLat = parseFloat(dlgLat.value) || 0;
      centerLat = markerLat;
      updateDms();
      if (destEnableCb.checked) syncDirDistFromTarget();
      renderMap();
      scheduleGeocode();
    });
    dlgLng.addEventListener('change', () => {
      markerLng = parseFloat(dlgLng.value) || 0;
      centerLng = markerLng;
      updateDms();
      if (destEnableCb.checked) syncDirDistFromTarget();
      renderMap();
      scheduleGeocode();
    });

    dlgDir.addEventListener('input', () => {
      const a = parseFloat(dlgDir.value) || 0;
      _drawCompass(compassCanvas, a);
      if (destEnableCb.checked) syncTargetFromDirDist();
      renderMap();
    });

    compassCanvas.addEventListener('click', (e) => {
      const rect = compassCanvas.getBoundingClientRect();
      const ccx = rect.width / 2, ccy = rect.height / 2;
      const dx = e.clientX - rect.left - ccx;
      const dy = e.clientY - rect.top - ccy;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      if (angle < 0) angle += 360;
      dlgDir.value = angle.toFixed(1);
      _drawCompass(compassCanvas, angle);
      if (destEnableCb.checked) syncTargetFromDirDist();
      renderMap();
    });

    // Destination field interactions
    dlgDestLat.addEventListener('change', () => {
      updateDestDms();
      syncDirDistFromTarget();
      _drawCompass(compassCanvas, parseFloat(dlgDir.value) || 0);
      renderMap();
    });
    dlgDestLng.addEventListener('change', () => {
      updateDestDms();
      syncDirDistFromTarget();
      _drawCompass(compassCanvas, parseFloat(dlgDir.value) || 0);
      renderMap();
    });
    dlgDestDist.addEventListener('change', () => {
      syncTargetFromDirDist();
      renderMap();
    });

    // ======= Search (forward geocoding) =======
    function doSearch() {
      const q = searchInput.value.trim();
      if (!q) return;
      const now = Date.now();
      if (now - _lastGeocodeTime < 1200) return;
      _lastGeocodeTime = now;
      geoStatus.textContent = 'Searching...';
      forwardGeocode(q).then(result => {
        geoStatus.textContent = '';
        if (!result) { geoStatus.textContent = 'No results'; return; }
        markerLat = result.lat;
        markerLng = result.lng;
        centerLat = result.lat;
        centerLng = result.lng;
        zoom = 14;
        dlgLat.value = result.lat.toFixed(6);
        dlgLng.value = result.lng.toFixed(6);
        updateDms();
        renderMap();
        scheduleGeocode();
      }).catch(() => {
        geoStatus.textContent = 'Search failed (offline?)';
      });
    }

    searchBtn.addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

    // ======= Reverse geocode (location lookup) =======
    function doReverseGeocode() {
      const lat = parseFloat(dlgLat.value);
      const lng = parseFloat(dlgLng.value);
      if (isNaN(lat) || isNaN(lng)) return;
      const now = Date.now();
      if (now - _lastGeocodeTime < 1200) return;
      _lastGeocodeTime = now;
      geoStatus.textContent = 'Looking up...';
      reverseGeocode(lat, lng).then(result => {
        geoStatus.textContent = '';
        if (result.countryCode) { geoFields.countryCode.input.value = result.countryCode; geoFields.countryCode.cb.checked = true; }
        if (result.country) { geoFields.country.input.value = result.country; geoFields.country.cb.checked = true; }
        if (result.state) { geoFields.state.input.value = result.state; geoFields.state.cb.checked = true; }
        if (result.city) { geoFields.city.input.value = result.city; geoFields.city.cb.checked = true; }
        if (result.sublocation) { geoFields.sublocation.input.value = result.sublocation; geoFields.sublocation.cb.checked = true; }
      }).catch(() => {
        geoStatus.textContent = 'Offline or no results';
      });
    }

    gpsLookupBtn.addEventListener('click', doReverseGeocode);

    // ======= OK / Cancel =======
    okBtn.addEventListener('click', () => {
      const lat = parseFloat(dlgLat.value);
      const lng = parseFloat(dlgLng.value);
      const alt = parseFloat(dlgAlt.value);
      const dir = parseFloat(dlgDir.value);

      if (!isNaN(lat) && !isNaN(lng)) {
        latInput.value = dlgLat.value;
        lngInput.value = dlgLng.value;
        const coordObj = { lat, lng };
        if (!isNaN(alt)) coordObj.alt = alt;
        if (!isNaN(dir) && dir > 0) coordObj.direction = dir;
        markDirty(field.key, JSON.stringify(coordObj));
        if (!isNaN(alt)) markDirty('gps.altitude', String(alt));
        if (!isNaN(dir) && dir > 0) markDirty('gps.direction', String(dir));
      }

      // GPS Destination
      if (destEnableCb.checked) {
        const dLat = parseFloat(dlgDestLat.value);
        const dLng = parseFloat(dlgDestLng.value);
        if (!isNaN(dLat) && !isNaN(dLng)) {
          const destObj = { lat: dLat, lng: dLng };
          if (!isNaN(dir) && dir > 0) destObj.bearing = dir;
          const dist = parseFloat(dlgDestDist.value);
          if (!isNaN(dist) && dist > 0) destObj.distance = dist;
          markDirty('gps.destination', JSON.stringify(destObj));
        }
      }

      // IPTC location fields
      const iptcMap = { countryCode: 'iptc.64', country: 'iptc.65', state: 'iptc.5f', city: 'iptc.5a', sublocation: 'iptc.5c' };
      for (const [gk, mk] of Object.entries(iptcMap)) {
        const gf = geoFields[gk];
        if (gf.cb.checked && gf.input.value.trim())
          markDirty(mk, gf.input.value.trim());
      }

      win.remove();
      renderMetadata();
    });
    cancelBtn.addEventListener('click', () => win.remove());
  }

  // DOM helpers
  function _el(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (k === 'checked') el.checked = v;
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v);
    }
    return el;
  }

  function _label(text, input) {
    const lbl = document.createElement('label');
    lbl.style.cssText = 'font-size:11px;display:flex;align-items:center;gap:3px;';
    lbl.textContent = text;
    lbl.appendChild(input);
    return lbl;
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

  const EXIF_ADD_TAG_OPTIONS = {
    'exif.10e': { label: 'Image Description', type: 'text' },
    'exif.10f': { label: 'Make', type: 'text' },
    'exif.110': { label: 'Model', type: 'text' },
    'exif.112': { label: 'Orientation', type: 'select', options: [
      { value: '1', label: '1 - Normal' }, { value: '2', label: '2 - Mirrored' },
      { value: '3', label: '3 - Rotated 180' }, { value: '4', label: '4 - Mirrored 180' },
      { value: '5', label: '5 - Mirrored 90 CW' }, { value: '6', label: '6 - Rotated 90 CW' },
      { value: '7', label: '7 - Mirrored 90 CCW' }, { value: '8', label: '8 - Rotated 90 CCW' },
    ] },
    'exif.131': { label: 'Software', type: 'text' },
    'exif.132': { label: 'Date/Time', type: 'date' },
    'exif.13b': { label: 'Artist', type: 'text' },
    'exif.8298': { label: 'Copyright', type: 'text' },
    'exif.9003': { label: 'Date/Time Original', type: 'date' },
    'exif.9004': { label: 'Date/Time Digitized', type: 'date' },
  };

  const GPS_ADD_TAG_OPTIONS = {
    'gps.coordinates': { label: 'GPS Coordinates', type: 'geo' },
    'gps.altitude': { label: 'Altitude', type: 'number' },
    'gps.direction': { label: 'Image Direction', type: 'compass' },
    'gps.destination': { label: 'Destination', type: 'geo' },
  };

  const EXIF_ADD_TAG_LABELS = {};
  for (const [k, v] of Object.entries(EXIF_ADD_TAG_OPTIONS)) EXIF_ADD_TAG_LABELS[k] = v.label;
  for (const [k, v] of Object.entries(GPS_ADD_TAG_OPTIONS)) EXIF_ADD_TAG_LABELS[k] = v.label;

  function showAddExifDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay visible';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.style.maxWidth = '440px';

    const titleEl = document.createElement('div');
    titleEl.className = 'dialog-title';
    titleEl.textContent = 'Add EXIF Tag';
    dialog.appendChild(titleEl);

    const body = document.createElement('div');
    body.className = 'dialog-body';

    // Tag selector
    const selectLabel = document.createElement('label');
    selectLabel.style.cssText = 'display:block;font-size:11px;margin-bottom:2px;';
    selectLabel.textContent = 'Tag:';
    body.appendChild(selectLabel);

    const sel = document.createElement('select');
    sel.style.cssText = 'width:100%;box-sizing:border-box;padding:3px 6px;margin-bottom:8px;';

    const exifGroup = document.createElement('optgroup');
    exifGroup.label = 'EXIF';
    for (const [key, opt] of Object.entries(EXIF_ADD_TAG_OPTIONS)) {
      const o = document.createElement('option');
      o.value = key;
      o.textContent = opt.label;
      exifGroup.appendChild(o);
    }
    sel.appendChild(exifGroup);

    const gpsGroup = document.createElement('optgroup');
    gpsGroup.label = 'GPS';
    for (const [key, opt] of Object.entries(GPS_ADD_TAG_OPTIONS)) {
      const o = document.createElement('option');
      o.value = key;
      o.textContent = opt.label;
      gpsGroup.appendChild(o);
    }
    sel.appendChild(gpsGroup);
    body.appendChild(sel);

    // Dynamic value input area
    const valArea = document.createElement('div');
    valArea.style.cssText = 'margin-bottom:4px;';
    body.appendChild(valArea);

    let currentVal = null;

    function updateValueInput() {
      valArea.innerHTML = '';
      const key = sel.value;
      const tagInfo = EXIF_ADD_TAG_OPTIONS[key] || GPS_ADD_TAG_OPTIONS[key];
      if (!tagInfo) return;

      if (tagInfo.type === 'text') {
        const label = document.createElement('label');
        label.style.cssText = 'display:block;font-size:11px;margin-bottom:2px;';
        label.textContent = 'Value:';
        valArea.appendChild(label);
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.style.cssText = 'width:100%;box-sizing:border-box;padding:3px 6px;';
        inp.placeholder = 'Enter value';
        valArea.appendChild(inp);
        currentVal = () => inp.value;
      } else if (tagInfo.type === 'date') {
        const label = document.createElement('label');
        label.style.cssText = 'display:block;font-size:11px;margin-bottom:2px;';
        label.textContent = 'Date/Time:';
        valArea.appendChild(label);
        const inp = document.createElement('input');
        inp.type = 'datetime-local';
        inp.style.cssText = 'width:100%;box-sizing:border-box;padding:3px 6px;';
        valArea.appendChild(inp);
        currentVal = () => {
          const v = inp.value;
          if (!v) return '';
          return v.substring(0, 10).replace(/-/g, ':') + ' ' + v.substring(11) + ':00';
        };
      } else if (tagInfo.type === 'select') {
        const label = document.createElement('label');
        label.style.cssText = 'display:block;font-size:11px;margin-bottom:2px;';
        label.textContent = 'Value:';
        valArea.appendChild(label);
        const s = document.createElement('select');
        s.style.cssText = 'width:100%;box-sizing:border-box;padding:3px 6px;';
        for (const opt of tagInfo.options) {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          s.appendChild(o);
        }
        valArea.appendChild(s);
        currentVal = () => s.value;
      } else if (tagInfo.type === 'number') {
        const label = document.createElement('label');
        label.style.cssText = 'display:block;font-size:11px;margin-bottom:2px;';
        label.textContent = 'Value:';
        valArea.appendChild(label);
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.step = '0.01';
        inp.style.cssText = 'width:150px;padding:3px 6px;';
        inp.placeholder = '0.00';
        valArea.appendChild(inp);
        currentVal = () => inp.value;
      } else if (tagInfo.type === 'geo') {
        const info = document.createElement('div');
        info.style.cssText = 'font-size:11px;color:var(--sz-color-gray-text);';
        info.textContent = 'Coordinates will be set via the map picker after adding.';
        valArea.appendChild(info);
        currentVal = () => JSON.stringify({ lat: 0, lng: 0 });
      } else if (tagInfo.type === 'compass') {
        const label = document.createElement('label');
        label.style.cssText = 'display:block;font-size:11px;margin-bottom:2px;';
        label.textContent = 'Direction (degrees):';
        valArea.appendChild(label);
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.min = '0';
        inp.max = '360';
        inp.step = '0.1';
        inp.style.cssText = 'width:100px;padding:3px 6px;';
        inp.value = '0';
        valArea.appendChild(inp);
        currentVal = () => inp.value;
      }
    }

    sel.addEventListener('change', updateValueInput);
    updateValueInput();

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

    function doAdd() {
      const key = sel.value;
      const value = currentVal ? currentVal() : '';
      if (!key) return;
      markDirty(key, value);
      overlay.remove();

      // Switch to appropriate tab
      const allCategories = getAllCategories();
      const targetTab = key.startsWith('gps.') ? 'GPS' : 'EXIF';
      const idx = allCategories.findIndex(c => c.name === targetTab);
      if (idx >= 0) {
        activeCategory = idx;
        renderCategoryTabs();
      }
      renderMetadata();
    }

    okBtn.addEventListener('click', doAdd);
    cancelBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
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
        { name: 'Streebog-256', algoName: 'Streebog (GOST R 34.11-2012)' },
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
        { name: 'CRC-16-CCITT', algoName: 'CRC-16-CCITT' },
        { name: 'CRC-32', algoName: 'CRC-32-IEEE' },
        { name: 'CRC-64', algoName: 'CRC-64-ECMA182' },
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
    if (parseResult.disassembly && parseResult.disassembly.length > 0 && window.SZ && SZ.Disassembler) {
      const disasmArr = parseResult.disassembly;
      for (let di = 0; di < disasmArr.length; ++di) {
        const entry = disasmArr[di];
        const label = entry.label || entry.archId.toUpperCase();
        const suffix = disasmArr.length > 1 ? ' (' + label + ')' : '';
        const idx = di;
        sections.push({ id: 'disasm-' + di, title: 'Disassembly' + suffix, render: c => renderDisassemblyBody(c, idx), defaultExpand: false });
      }
    }

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

  // Seamless disassembly viewer: each accordion panel gets its own state object.
  // Multiple panels are created when a format has several code views (e.g. .NET = x86 + MSIL).
  const _DISASM_BATCH = 256;
  const _disasmPanels = [];  // array of per-panel state objects

  function _disasmCreateState() {
    return {
      insns: [],              // all decoded instructions, sorted by offset
      offsets: new Set(),     // quick dedup lookup
      nav: { stack: [], idx: -1 },
      container: null,        // accordion body
      pre: null,              // <pre> listing element
      statusEl: null,         // instruction count status line
      xrefPanel: null,        // cross-references container
      btnBack: null,
      btnFwd: null,
      addrInput: null,
      info: null,
      annotations: null,
      D: null,
      scrollTimer: null,
      viewMode: 'asm',
    };
  }

  function _disasmReset() {
    for (const st of _disasmPanels) {
      if (st.scrollTimer) clearTimeout(st.scrollTimer);
    }
    _disasmPanels.length = 0;
  }

  function renderDisassemblyBody(container, entryIndex) {
    if (!parseResult || !parseResult.disassembly || !currentBytes) return;
    const D = window.SZ && SZ.Disassembler;
    if (!D) return;

    const info = parseResult.disassembly[entryIndex];
    if (!info) return;
    const startOffset = info.offset || 0;

    if (startOffset >= currentBytes.length) {
      container.innerHTML = '<div style="padding:8px;color:var(--sz-color-gray-text);font-style:italic;">Entry point offset is outside the file.</div>';
      return;
    }

    // Create per-panel state
    const st = _disasmCreateState();
    _disasmPanels.push(st);
    st.container = container;
    st.info = info;
    st.D = D;
    st.annotations = _buildAnnotations(info);
    st.nav.stack = [startOffset];
    st.nav.idx = 0;

    // Decode initial batch (smart count from code section size)
    let initCount = _DISASM_BATCH;
    if (info.codeSection) {
      const maxBytes = info.codeSection.end - startOffset;
      initCount = Math.min(4096, Math.max(_DISASM_BATCH, Math.floor(maxBytes / 2)));
    }
    _disasmDecodeAndMerge(st, startOffset, initCount);

    if (st.insns.length === 0) {
      container.innerHTML = '<div style="padding:8px;color:var(--sz-color-gray-text);font-style:italic;">No instructions decoded.</div>';
      return;
    }

    // Build DOM once
    _disasmBuildUI(st, container, startOffset);
  }

  function _disasmBuildUI(st, container, initialOffset) {
    container.innerHTML = '';
    const info = st.info;
    const archId = info.archId;

    // --- Navigation toolbar ---
    const toolbar = document.createElement('div');
    toolbar.className = 'disasm-toolbar';

    const btnBack = document.createElement('button');
    btnBack.textContent = '\u25C0 Back';
    btnBack.disabled = true;
    btnBack.onclick = () => _disasmNavGo(st, -1);
    st.btnBack = btnBack;

    const btnFwd = document.createElement('button');
    btnFwd.textContent = 'Forward \u25B6';
    btnFwd.disabled = true;
    btnFwd.onclick = () => _disasmNavGo(st, 1);
    st.btnFwd = btnFwd;

    const btnEntry = document.createElement('button');
    btnEntry.textContent = 'Entry Point';
    btnEntry.onclick = () => _disasmNavigateTo(st, info.offset || 0);

    const sep = document.createElement('span');
    sep.textContent = ' | ';
    sep.style.cssText = 'color:var(--sz-color-gray-text);';

    const addrLabel = document.createElement('span');
    addrLabel.textContent = 'Address: ';
    addrLabel.style.cssText = 'color:var(--sz-color-gray-text);';

    const addrInput = document.createElement('input');
    addrInput.type = 'text';
    addrInput.value = '0x' + initialOffset.toString(16).toUpperCase();
    st.addrInput = addrInput;

    const btnGo = document.createElement('button');
    btnGo.textContent = 'Go';
    btnGo.onclick = () => {
      const val = parseInt(addrInput.value, 16);
      if (!isNaN(val) && val >= 0)
        _disasmNavigateTo(st, val);
    };
    addrInput.onkeydown = e => { if (e.key === 'Enter') btnGo.click(); };

    toolbar.append(btnBack, btnFwd, btnEntry, sep, addrLabel, addrInput, btnGo);

    // View mode combobox for multi-mode architectures
    const DISASM_MODES = {
      x86: [{ id: 'asm', label: 'Assembly' }, { id: 'pseudo-c', label: 'Pseudo-C' }],
      x64: [{ id: 'asm', label: 'Assembly' }, { id: 'pseudo-c', label: 'Pseudo-C' }],
      arm: [{ id: 'asm', label: 'Assembly' }, { id: 'pseudo-c', label: 'Pseudo-C' }],
      arm64: [{ id: 'asm', label: 'Assembly' }, { id: 'pseudo-c', label: 'Pseudo-C' }],
      msil: [{ id: 'il', label: 'MSIL/CIL' }, { id: 'csharp-low', label: 'Pseudo-C#' }, { id: 'vb', label: 'Pseudo-VB' }, { id: 'csharp', label: 'C# (simplified)' }],
      java: [{ id: 'jil', label: 'Java IL' }, { id: 'java-low', label: 'Low-level Java' }, { id: 'java', label: 'Java' }, { id: 'kotlin', label: 'Kotlin' }],
    };
    const modes = DISASM_MODES[archId];
    if (modes && modes.length > 1) {
      // Sync viewMode to this architecture's first mode if 'asm' isn't available
      if (!modes.some(m => m.id === st.viewMode))
        st.viewMode = modes[0].id;

      const modeSep = document.createElement('span');
      modeSep.textContent = ' | ';
      modeSep.style.cssText = 'color:var(--sz-color-gray-text);';

      const modeLabel = document.createElement('span');
      modeLabel.textContent = 'View: ';
      modeLabel.style.cssText = 'color:var(--sz-color-gray-text);';

      const modeSelect = document.createElement('select');
      modeSelect.className = 'disasm-mode-select';
      for (const m of modes) {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.label;
        if (m.id === st.viewMode)
          opt.selected = true;
        modeSelect.appendChild(opt);
      }
      modeSelect.addEventListener('change', () => {
        st.viewMode = modeSelect.value;
        _disasmRenderListing(st);
      });
      toolbar.append(modeSep, modeLabel, modeSelect);
    }

    // Method picker for .NET per-method IL bodies
    if (info.methods && info.methods.length > 0) {
      const mSep = document.createElement('span');
      mSep.textContent = ' | ';
      mSep.style.cssText = 'color:var(--sz-color-gray-text);';

      const mLabel = document.createElement('span');
      mLabel.textContent = 'Method: ';
      mLabel.style.cssText = 'color:var(--sz-color-gray-text);';

      const mSelect = document.createElement('select');
      mSelect.className = 'disasm-mode-select';
      mSelect.style.maxWidth = '260px';

      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '(Entry Point)';
      mSelect.appendChild(defaultOpt);

      for (let mi = 0; mi < info.methods.length; ++mi) {
        const me = info.methods[mi];
        const opt = document.createElement('option');
        opt.value = String(mi);
        opt.textContent = me.label || ('Method #' + mi);
        mSelect.appendChild(opt);
      }

      mSelect.addEventListener('change', () => {
        const idx = mSelect.value;
        if (idx === '') {
          _disasmNavigateTo(st, info.offset || 0);
          return;
        }
        const me = info.methods[parseInt(idx, 10)];
        if (!me) return;
        // Decode the method body region and navigate
        _disasmDecodeAndMerge(st, me.offset, Math.max(_DISASM_BATCH, Math.ceil((me.codeSection ? me.codeSection.size : 256) / 2)));
        _disasmRenderListing(st);
        _disasmUpdateStatus(st);
        requestAnimationFrame(() => _disasmScrollTo(st, me.offset, true));
      });

      toolbar.append(mSep, mLabel, mSelect);
    }

    container.appendChild(toolbar);

    // --- Header ---
    const header = document.createElement('div');
    header.style.cssText = 'font-size:9px;color:var(--sz-color-gray-text);margin-bottom:2px;';
    header.textContent = 'Architecture: ' + archId.toUpperCase()
      + (info.rva != null ? ' | Entry RVA: 0x' + info.rva.toString(16).toUpperCase() : '')
      + ' | File offset: 0x' + initialOffset.toString(16).toUpperCase();
    container.appendChild(header);

    // --- Status line (updates as more is decoded) ---
    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'font-size:9px;color:var(--sz-color-gray-text);margin-bottom:6px;';
    st.statusEl = statusEl;
    container.appendChild(statusEl);

    // --- Cross-references panel (above listing, collapsed by default) ---
    const xrefPanel = document.createElement('div');
    st.xrefPanel = xrefPanel;
    container.appendChild(xrefPanel);
    _disasmUpdateXrefs(st);

    // --- Listing ---
    const pre = document.createElement('pre');
    pre.className = 'disasm-listing';
    st.pre = pre;

    // Click handler for navigable addresses
    pre.addEventListener('click', e => {
      const addrEl = e.target.closest('[data-target]');
      if (!addrEl) return;
      e.preventDefault();
      const targetAddr = parseInt(addrEl.dataset.target, 16);

      // Import thunks are data, not code — don't navigate
      if (st.annotations && st.annotations.imports && st.annotations.imports[targetAddr])
        return;

      // Convert RVA to file offset (MSIL/Java targets are already file offsets)
      let fileOffset = targetAddr;
      const arch = (info.archId || '').toLowerCase();
      if (arch !== 'msil' && arch !== 'java' && info.codeSection && targetAddr >= info.codeSection.rva)
        fileOffset = targetAddr - info.codeSection.rva + info.codeSection.start;

      _disasmNavigateTo(st, fileOffset);
    });

    container.appendChild(pre);

    // Render initial content
    _disasmRenderListing(st);
    _disasmUpdateStatus(st);

    // Auto-load on scroll: when user nears bottom, decode more
    container.addEventListener('scroll', () => {
      if (st.scrollTimer) return;
      st.scrollTimer = setTimeout(() => {
        st.scrollTimer = null;
        const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (remaining < 400)
          _disasmLoadMore(st);
      }, 80);
    });
  }

  /** Decode instructions and merge into sorted dedup array. Returns count of new. */
  function _disasmDecodeAndMerge(st, offset, count) {
    if (offset >= currentBytes.length || !st.D) return 0;
    const insns = st.D.disassemble(st.info.archId, currentBytes, offset, count, st.info.options || undefined);
    if (!insns || insns.length === 0) return 0;
    let added = 0;
    for (const insn of insns) {
      if (!st.offsets.has(insn.offset)) {
        st.insns.push(insn);
        st.offsets.add(insn.offset);
        ++added;
      }
    }
    if (added > 0)
      st.insns.sort((a, b) => a.offset - b.offset);
    return added;
  }

  /** Full re-render of the listing from all accumulated instructions. */
  function _disasmRenderListing(st) {
    const D = st.D;
    if (!D || !st.pre) return;
    const mode = st.viewMode || 'asm';
    if (D.formatDisassemblyHtml)
      st.pre.innerHTML = D.formatDisassemblyHtml(st.insns, st.annotations, mode);
    else
      st.pre.textContent = D.formatDisassembly(st.insns);
  }

  /** Append new instructions at end without re-rendering existing content. */
  function _disasmAppendHtml(st, newInsns) {
    const D = st.D;
    if (!D || !st.pre || newInsns.length === 0) return;
    const mode = st.viewMode || 'asm';
    if (D.formatDisassemblyHtml)
      st.pre.insertAdjacentHTML('beforeend', '\n' + D.formatDisassemblyHtml(newInsns, st.annotations, mode));
    else {
      const node = document.createTextNode('\n' + D.formatDisassembly(newInsns));
      st.pre.appendChild(node);
    }
  }

  function _disasmUpdateStatus(st) {
    if (!st.statusEl) return;
    const n = st.insns.length;
    const first = n > 0 ? st.insns[0] : null;
    const last = n > 0 ? st.insns[n - 1] : null;
    let text = n + ' instructions decoded';
    if (first && last)
      text += ' | 0x' + first.offset.toString(16).toUpperCase() + ' \u2013 0x' + (last.offset + last.length).toString(16).toUpperCase();
    st.statusEl.textContent = text;
  }

  /** Scroll to offset in listing, highlight it. If not yet decoded, decode first. */
  function _disasmNavigateTo(st, offset) {
    // Push to nav stack
    st.nav.stack = st.nav.stack.slice(0, st.nav.idx + 1);
    st.nav.stack.push(offset);
    st.nav.idx = st.nav.stack.length - 1;
    _disasmUpdateNavButtons(st);

    // Already in listing? Just scroll.
    if (st.offsets.has(offset)) {
      _disasmScrollTo(st, offset, true);
      return;
    }

    // Decode from target, merge, re-render (full re-render for correct labels)
    const added = _disasmDecodeAndMerge(st, offset, _DISASM_BATCH);
    if (added > 0) {
      _disasmRenderListing(st);
      _disasmUpdateStatus(st);
      _disasmUpdateXrefs(st);
    }

    // Scroll after render
    requestAnimationFrame(() => _disasmScrollTo(st, offset, true));
  }

  function _disasmNavGo(st, direction) {
    const newIdx = st.nav.idx + direction;
    if (newIdx < 0 || newIdx >= st.nav.stack.length) return;
    st.nav.idx = newIdx;
    _disasmUpdateNavButtons(st);
    const offset = st.nav.stack[newIdx];
    // Already decoded (we decoded it when first visited)
    _disasmScrollTo(st, offset, true);
  }

  function _disasmScrollTo(st, offset, highlight) {
    const pre = st.pre;
    if (!pre) return;
    if (highlight)
      pre.querySelectorAll('.da-line.highlight').forEach(el => el.classList.remove('highlight'));
    const target = pre.querySelector('[data-offset="' + offset.toString(16) + '"]');
    if (target) {
      if (highlight)
        target.classList.add('highlight');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (st.addrInput)
      st.addrInput.value = '0x' + offset.toString(16).toUpperCase();
  }

  function _disasmUpdateNavButtons(st) {
    if (st.btnBack)
      st.btnBack.disabled = st.nav.idx <= 0;
    if (st.btnFwd)
      st.btnFwd.disabled = st.nav.idx >= st.nav.stack.length - 1;
  }

  /** Auto-load: decode next batch at end of current instructions, append HTML. */
  function _disasmLoadMore(st) {
    if (st.insns.length === 0) return;
    const last = st.insns[st.insns.length - 1];
    const nextOffset = last.offset + last.length;
    const codeEnd = st.info.codeSection ? st.info.codeSection.end : currentBytes.length;
    if (nextOffset >= codeEnd || nextOffset >= currentBytes.length) return;

    const prevLen = st.insns.length;
    _disasmDecodeAndMerge(st, nextOffset, _DISASM_BATCH);
    if (st.insns.length <= prevLen) return;

    // Append only the new tail (fast path — no full re-render)
    const newInsns = st.insns.slice(prevLen);
    _disasmAppendHtml(st, newInsns);
    _disasmUpdateStatus(st);
  }

  function _buildAnnotations(info) {
    if (!info.imports && !info.exports && !info.strings && !info.codeSection)
      return null;

    return {
      imports: info.imports || null,
      exports: info.exports || null,
      strings: info.strings || null,
      imageBase: info.imageBase || 0,
      metadata: info.options && info.options.metadata || null,
      codeRange: info.codeSection ? {
        rvaStart: info.codeSection.rva,
        rvaEnd: info.codeSection.rva + info.codeSection.size,
        fileStart: info.codeSection.start,
        fileEnd: info.codeSection.end,
      } : null,
    };
  }

  /** Build/rebuild the cross-references panel from current decoded instructions. */
  function _disasmUpdateXrefs(st) {
    const panel = st.xrefPanel;
    const annotations = st.annotations;
    if (!panel || !annotations) return;
    panel.innerHTML = '';

    const xrefs = { imports: [], strings: [], calls: [], exports: [] };
    for (const insn of st.insns) {
      const ops = insn.operands || '';
      for (const hm of ops.matchAll(/\b0[xX]([0-9A-Fa-f]+)\b/g)) {
        const addr = parseInt(hm[1], 16);
        if (annotations.imports && annotations.imports[addr])
          xrefs.imports.push({ addr, name: annotations.imports[addr] });
        if (annotations.exports && annotations.exports[addr])
          xrefs.exports.push({ addr, name: annotations.exports[addr] });
        if (annotations.strings && annotations.strings[addr])
          xrefs.strings.push({ addr, str: annotations.strings[addr] });
      }
      const mn = (insn.mnemonic || '').toLowerCase();
      if (/^(call|bl)$/.test(mn)) {
        const cm = ops.match(/\b0[xX]([0-9A-Fa-f]+)\b/);
        if (cm) {
          const cAddr = parseInt(cm[1], 16);
          if (!annotations.imports || !annotations.imports[cAddr])
            xrefs.calls.push({ addr: cAddr });
        }
      }
    }

    const total = xrefs.imports.length + xrefs.strings.length + xrefs.calls.length + xrefs.exports.length;
    if (total === 0) return;

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-bottom:6px;border:1px solid var(--sz-color-button-shadow,#aca899);background:var(--sz-color-button-face,#ece9d8);';

    const title = document.createElement('div');
    title.style.cssText = 'font-size:10px;font-weight:bold;padding:3px 6px;color:var(--sz-color-gray-text);cursor:pointer;';
    title.textContent = '\u25B6 Cross References (' + total + ')';
    const xrefBody = document.createElement('div');
    xrefBody.style.display = 'none';

    title.onclick = () => {
      const visible = xrefBody.style.display !== 'none';
      xrefBody.style.display = visible ? 'none' : '';
      title.textContent = (visible ? '\u25B6' : '\u25BC') + ' Cross References (' + total + ')';
    };

    wrapper.appendChild(title);

    const escH = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const makeSection = (label, items, formatter) => {
      if (items.length === 0) return;
      const sec = document.createElement('div');
      sec.style.cssText = 'padding:2px 6px 4px 12px;';
      const hdr = document.createElement('div');
      hdr.style.cssText = 'font-size:9px;font-weight:bold;color:var(--sz-color-gray-text);margin-bottom:1px;';
      hdr.textContent = label;
      sec.appendChild(hdr);
      const seen = new Set();
      for (const item of items) {
        if (seen.has(item.addr)) continue;
        seen.add(item.addr);
        const row = document.createElement('div');
        row.style.cssText = 'font-size:10px;font-family:monospace;cursor:pointer;padding:1px 4px;';
        row.innerHTML = formatter(item);
        row.onmouseover = () => row.style.background = 'rgba(49,106,197,0.1)';
        row.onmouseout = () => row.style.background = '';
        row.onclick = () => {
          let targetOffset = item.addr;
          if (annotations.codeRange && item.addr >= annotations.codeRange.rvaStart)
            targetOffset = item.addr - annotations.codeRange.rvaStart + annotations.codeRange.fileStart;
          _disasmNavigateTo(st, targetOffset);
        };
        sec.appendChild(row);
      }
      xrefBody.appendChild(sec);
    };

    makeSection('Imports Used', xrefs.imports,
      i => '<span style="color:#6e7681">0x' + i.addr.toString(16).toUpperCase().padStart(8, '0') + '</span> ' + escH(i.name));
    makeSection('Strings Referenced', xrefs.strings,
      i => '<span style="color:#6e7681">0x' + i.addr.toString(16).toUpperCase().padStart(8, '0') + '</span> "' + escH(i.str.length > 50 ? i.str.substring(0, 47) + '...' : i.str) + '"');
    makeSection('Internal Calls', xrefs.calls,
      i => '<span style="color:#6e7681">0x' + i.addr.toString(16).toUpperCase().padStart(8, '0') + '</span> sub_' + i.addr.toString(16).toUpperCase().padStart(8, '0'));
    makeSection('Exports', xrefs.exports,
      i => '<span style="color:#6e7681">0x' + i.addr.toString(16).toUpperCase().padStart(8, '0') + '</span> ' + escH(i.name));

    wrapper.appendChild(xrefBody);
    panel.appendChild(wrapper);
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

    loadingText.textContent = 'Loading file\u2026';
    loadingOverlay.classList.remove('hidden');
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
      loadingText.textContent = 'Loading file\u2026';
      loadingOverlay.classList.remove('hidden');
      const bytes = await Kernel32.ReadAllBytes(path);
      const name = path.split('/').pop();
      await loadFromBytes(bytes, name, path);
    } catch (_) { loadingOverlay.classList.add('hidden'); }
  }

  async function doImport() {
    const result = await ComDlg32.ImportFile({ accept: '*/*', readAs: 'arrayBuffer' });
    if (result.cancelled) return;
    loadingText.textContent = 'Loading file\u2026';
    loadingOverlay.classList.remove('hidden');
    await loadFromBytes(new Uint8Array(result.data), result.name, null);
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
        loadingText.textContent = 'Loading file\u2026';
        loadingOverlay.classList.remove('hidden');
        const bytes = await Kernel32.ReadAllBytes(path);
        const name = path.split('/').pop();
        await loadFromBytes(bytes, name, path);
      } catch (_) { loadingOverlay.classList.add('hidden'); }
    }
  }

  // =========================================================================
  // Init
  // =========================================================================
  updateTitle();
  handleCommandLine();

})();
