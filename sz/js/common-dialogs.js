;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const SIDEBAR_SHORTCUTS = [
    { label: 'Documents', icon: '\uD83D\uDCC4', path: '/user/documents' },
    { label: 'Desktop', icon: '\uD83D\uDDA5\uFE0F', path: '/user/desktop' },
    { label: 'Pictures', icon: '\uD83D\uDDBC\uFE0F', path: '/user/pictures' },
    { label: 'System', icon: '\uD83D\uDCBB', path: '/system' },
  ];

  function _formatSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  const _FILE_TYPE_NAMES = {
    txt: 'Text Document', log: 'Log File', cfg: 'Configuration File', ini: 'Configuration File',
    js: 'JavaScript File', ts: 'TypeScript File', jsx: 'JSX File', tsx: 'TSX File',
    css: 'CSS Stylesheet', html: 'HTML Document', htm: 'HTML Document',
    json: 'JSON File', xml: 'XML Document', yml: 'YAML File', yaml: 'YAML File',
    md: 'Markdown Document', markdown: 'Markdown Document',
    py: 'Python Script', rb: 'Ruby Script', pl: 'Perl Script', php: 'PHP File',
    java: 'Java Source', cs: 'C# Source', cpp: 'C++ Source', c: 'C Source', h: 'Header File',
    go: 'Go Source', rs: 'Rust Source', sh: 'Shell Script', bat: 'Batch File',
    sql: 'SQL Script', csv: 'CSV File', tsv: 'TSV File',
    png: 'PNG Image', jpg: 'JPEG Image', jpeg: 'JPEG Image', gif: 'GIF Image',
    bmp: 'Bitmap Image', svg: 'SVG Image', webp: 'WebP Image', ico: 'Icon File',
    mp3: 'MP3 Audio', wav: 'WAV Audio', ogg: 'OGG Audio', flac: 'FLAC Audio',
    mp4: 'MP4 Video', webm: 'WebM Video', m4a: 'M4A Audio',
    pdf: 'PDF Document', rtf: 'Rich Text Document', doc: 'Word Document', docx: 'Word Document',
    xls: 'Excel Spreadsheet', xlsx: 'Excel Spreadsheet',
    bin: 'Binary File', dat: 'Data File', exe: 'Application', dll: 'DLL Library',
    ttf: 'TrueType Font', otf: 'OpenType Font', woff: 'Web Font', woff2: 'Web Font',
    diff: 'Diff File', patch: 'Patch File', cur: 'Cursor File',
    lnk: 'Shortcut',
  };

  function _getFileType(name) {
    const dot = name.lastIndexOf('.');
    if (dot < 0) return 'File';
    const ext = name.substring(dot + 1).toLowerCase();
    return _FILE_TYPE_NAMES[ext] || (ext.toUpperCase() + ' File');
  }

  class CommonDialogs {
    #kernel;
    #overlay = null;
    #currentPath = '/user/documents';
    #resolve = null;
    #mode = 'open'; // 'open' | 'save'
    #selectedEntry = null;
    #lastEntries = []; // unfiltered entries for re-filtering

    // DOM refs
    #titleEl;
    #pathInput;
    #sidebar;
    #fileList;
    #filenameInput;
    #filterSelect;
    #okBtn;
    #cancelBtn;
    #backBtn;
    #upBtn;
    #history = [];

    constructor(kernel) {
      this.#kernel = kernel;
      this.#buildDOM();
    }

    async showOpen(options = {}) {
      this.#mode = 'open';
      this.#titleEl.textContent = options.title || 'Open';
      this.#okBtn.textContent = 'Open';
      this.#filenameInput.value = '';
      this.#selectedEntry = null;
      this.#history = [];
      this.#populateFilters(options.filters);
      return new Promise(resolve => {
        this.#resolve = resolve;
        this.#overlay.style.display = 'flex';
        this.#navigateTo(options.initialDir || '/user/documents');
      });
    }

    async showSave(options = {}) {
      this.#mode = 'save';
      this.#titleEl.textContent = options.title || 'Save As';
      this.#okBtn.textContent = 'Save';
      this.#filenameInput.value = options.defaultName || '';
      this.#selectedEntry = null;
      this.#history = [];
      this.#populateFilters(options.filters);
      return new Promise(resolve => {
        this.#resolve = resolve;
        this.#overlay.style.display = 'flex';
        this.#navigateTo(options.initialDir || '/user/documents');
      });
    }

    #matchesFilter(name) {
      const pattern = this.#filterSelect.value;
      if (!pattern || pattern === '*.*' || pattern === '*')
        return true;
      // pattern is like "*.txt;*.md" or "*.json"
      const parts = pattern.split(';');
      const lower = name.toLowerCase();
      for (const p of parts) {
        const ext = p.trim().replace(/^\*\.?/, '').toLowerCase();
        if (!ext || ext === '*')
          return true;
        if (lower.endsWith('.' + ext))
          return true;
      }
      return false;
    }

    #getFirstExtension() {
      const pattern = this.#filterSelect.value;
      if (!pattern || pattern === '*.*' || pattern === '*')
        return '';
      const first = pattern.split(';')[0].trim().replace(/^\*\.?/, '');
      return (first && first !== '*') ? first : '';
    }

    #populateFilters(filters) {
      this.#filterSelect.innerHTML = '';
      if (filters && filters.length) {
        for (const f of filters) {
          const opt = document.createElement('option');
          // Support both { pattern: '*.txt' } and { ext: ['txt','md'] } formats
          if (f.ext) {
            const exts = Array.isArray(f.ext) ? f.ext : [f.ext];
            opt.value = exts.map(e => e === '*' ? '*.*' : '*.' + e).join(';');
            opt.textContent = (f.name || f.label || 'Files') + ' (' + opt.value + ')';
          } else {
            opt.value = f.pattern || '*.*';
            opt.textContent = f.label || f.pattern || 'All Files (*.*)';
          }
          this.#filterSelect.appendChild(opt);
        }
      } else {
        const opt = document.createElement('option');
        opt.value = '*.*';
        opt.textContent = 'All Files (*.*)';
        this.#filterSelect.appendChild(opt);
      }
    }

    #buildDOM() {
      // Overlay
      this.#overlay = document.createElement('div');
      this.#overlay.className = 'sz-dlg-overlay';
      this.#overlay.style.display = 'none';

      const win = document.createElement('div');
      win.className = 'sz-dlg-window';

      // Title bar
      const titlebar = document.createElement('div');
      titlebar.className = 'sz-dlg-titlebar';
      this.#titleEl = document.createElement('span');
      this.#titleEl.className = 'sz-dlg-title';
      this.#titleEl.textContent = 'Open';
      const closeBtn = document.createElement('span');
      closeBtn.className = 'sz-dlg-close-btn';
      closeBtn.textContent = '\u00D7';
      closeBtn.addEventListener('click', () => this.#cancel());
      titlebar.append(this.#titleEl, closeBtn);

      // Toolbar
      const toolbar = document.createElement('div');
      toolbar.className = 'sz-dlg-toolbar';
      this.#backBtn = document.createElement('button');
      this.#backBtn.textContent = '\u25C0';
      this.#backBtn.title = 'Back';
      this.#backBtn.disabled = true;
      this.#backBtn.addEventListener('click', () => this.#goBack());
      this.#upBtn = document.createElement('button');
      this.#upBtn.textContent = '\u2191';
      this.#upBtn.title = 'Up one level';
      this.#upBtn.addEventListener('click', () => this.#goUp());
      this.#pathInput = document.createElement('div');
      this.#pathInput.className = 'sz-dlg-path-bar';
      toolbar.append(this.#backBtn, this.#upBtn, this.#pathInput);

      // Body (sidebar + file list)
      const body = document.createElement('div');
      body.className = 'sz-dlg-body';

      this.#sidebar = document.createElement('div');
      this.#sidebar.className = 'sz-dlg-sidebar';
      for (const sc of SIDEBAR_SHORTCUTS) {
        const item = document.createElement('div');
        item.className = 'sz-dlg-sidebar-item';
        const icon = document.createElement('span');
        icon.className = 'sz-dlg-sidebar-icon';
        icon.textContent = sc.icon;
        const label = document.createElement('span');
        label.textContent = sc.label;
        item.append(icon, label);
        item.addEventListener('click', () => this.#navigateTo(sc.path));
        this.#sidebar.appendChild(item);
      }

      this.#fileList = document.createElement('div');
      this.#fileList.className = 'sz-dlg-file-list';
      body.append(this.#sidebar, this.#fileList);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'sz-dlg-footer';

      // Filename row
      const fnRow = document.createElement('div');
      fnRow.className = 'sz-dlg-footer-row';
      const fnLabel = document.createElement('label');
      fnLabel.textContent = 'File name:';
      this.#filenameInput = document.createElement('input');
      this.#filenameInput.className = 'sz-dlg-filename-input';
      this.#filenameInput.type = 'text';
      this.#filenameInput.spellcheck = false;
      this.#filenameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this.#confirm(); }
        else if (e.key === 'Escape') { e.preventDefault(); this.#cancel(); }
      });
      const btnGroup = document.createElement('div');
      btnGroup.className = 'sz-dlg-footer-buttons';
      this.#okBtn = document.createElement('button');
      this.#okBtn.textContent = 'Open';
      this.#okBtn.addEventListener('click', () => this.#confirm());
      this.#cancelBtn = document.createElement('button');
      this.#cancelBtn.textContent = 'Cancel';
      this.#cancelBtn.addEventListener('click', () => this.#cancel());
      btnGroup.append(this.#okBtn, this.#cancelBtn);
      fnRow.append(fnLabel, this.#filenameInput, btnGroup);

      // Filter row
      const ftRow = document.createElement('div');
      ftRow.className = 'sz-dlg-footer-row';
      const ftLabel = document.createElement('label');
      ftLabel.textContent = 'Files of type:';
      this.#filterSelect = document.createElement('select');
      this.#filterSelect.className = 'sz-dlg-filter-select';
      this.#filterSelect.addEventListener('change', () => {
        if (this.#lastEntries.length)
          this.#renderEntries(this.#lastEntries);
      });
      ftRow.append(ftLabel, this.#filterSelect);

      footer.append(fnRow, ftRow);

      // Assemble
      win.append(titlebar, toolbar, body, footer);
      this.#overlay.appendChild(win);
      document.body.appendChild(this.#overlay);

      // Click outside window to cancel
      this.#overlay.addEventListener('click', (e) => {
        if (e.target === this.#overlay)
          this.#cancel();
      });
    }

    async #navigateTo(path) {
      if (this.#currentPath !== path)
        this.#history.push(this.#currentPath);
      this.#currentPath = path;
      this.#pathInput.textContent = path;
      this.#backBtn.disabled = this.#history.length === 0;
      this.#upBtn.disabled = path === '/';
      this.#selectedEntry = null;

      // Highlight active sidebar
      for (const el of this.#sidebar.querySelectorAll('.sz-dlg-sidebar-item'))
        el.classList.remove('active');
      const idx = SIDEBAR_SHORTCUTS.findIndex(s => s.path === path);
      if (idx >= 0) {
        const items = this.#sidebar.querySelectorAll('.sz-dlg-sidebar-item');
        if (items[idx]) items[idx].classList.add('active');
      }

      this.#fileList.innerHTML = '';
      const loading = document.createElement('div');
      loading.className = 'sz-dlg-empty';
      loading.textContent = 'Loading\u2026';
      this.#fileList.appendChild(loading);

      try {
        const names = await this.#kernel.List(path);
        const entries = [];
        for (const name of names) {
          try {
            const stat = await this.#kernel.Stat(this.#joinPath(path, name));
            entries.push({ name, ...stat });
          } catch (e) {
            entries.push({ name, kind: 'file' });
          }
        }
        // Sort: dirs first, then alpha
        entries.sort((a, b) => {
          if (a.kind === 'dir' && b.kind !== 'dir') return -1;
          if (a.kind !== 'dir' && b.kind === 'dir') return 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
        this.#lastEntries = entries;
        this.#renderEntries(entries);
      } catch (err) {
        this.#fileList.innerHTML = '';
        const errEl = document.createElement('div');
        errEl.className = 'sz-dlg-empty';
        errEl.textContent = 'Error: ' + err.message;
        this.#fileList.appendChild(errEl);
      }
    }

    #renderEntries(entries) {
      this.#fileList.innerHTML = '';
      // Apply file type filter — directories always shown
      const filtered = entries.filter(e => e.kind === 'dir' || this.#matchesFilter(e.name));
      if (filtered.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'sz-dlg-empty';
        empty.textContent = 'This folder is empty.';
        this.#fileList.appendChild(empty);
        return;
      }
      for (const entry of filtered) {
        const item = document.createElement('div');
        item.className = 'sz-dlg-file-item';

        const icon = document.createElement('span');
        icon.className = 'sz-dlg-file-icon';
        icon.textContent = entry.kind === 'dir' ? '\uD83D\uDCC1' : '\uD83D\uDCC4';

        const name = document.createElement('span');
        name.className = 'sz-dlg-file-name';
        name.textContent = entry.name;

        const typeEl = document.createElement('span');
        typeEl.className = 'sz-dlg-file-type';
        typeEl.textContent = entry.kind === 'dir' ? 'Folder' : _getFileType(entry.name);

        const sizeEl = document.createElement('span');
        sizeEl.className = 'sz-dlg-file-size';
        sizeEl.textContent = entry.kind === 'dir' ? '' : _formatSize(entry.size);

        item.append(icon, name, typeEl, sizeEl);

        item.addEventListener('click', () => {
          // Deselect previous
          for (const el of this.#fileList.querySelectorAll('.selected'))
            el.classList.remove('selected');
          item.classList.add('selected');
          this.#selectedEntry = entry;
          if (entry.kind !== 'dir')
            this.#filenameInput.value = entry.name;
        });

        item.addEventListener('dblclick', () => {
          const newPath = this.#joinPath(this.#currentPath, entry.name);
          if (entry.kind === 'dir')
            this.#navigateTo(newPath);
          else {
            this.#filenameInput.value = entry.name;
            this.#confirm();
          }
        });

        this.#fileList.appendChild(item);
      }
    }

    #goBack() {
      if (this.#history.length === 0) return;
      const prev = this.#history.pop();
      const saveCurrent = this.#currentPath;
      this.#currentPath = prev; // Set before navigateTo to avoid re-pushing
      this.#pathInput.textContent = prev;
      this.#backBtn.disabled = this.#history.length === 0;
      this.#upBtn.disabled = prev === '/';
      // Navigate without pushing to history
      this.#fileList.innerHTML = '';
      const loading = document.createElement('div');
      loading.className = 'sz-dlg-empty';
      loading.textContent = 'Loading\u2026';
      this.#fileList.appendChild(loading);
      this.#kernel.List(prev).then(async (names) => {
        const entries = [];
        for (const name of names) {
          try {
            const stat = await this.#kernel.Stat(this.#joinPath(prev, name));
            entries.push({ name, ...stat });
          } catch { entries.push({ name, kind: 'file' }); }
        }
        entries.sort((a, b) => {
          if (a.kind === 'dir' && b.kind !== 'dir') return -1;
          if (a.kind !== 'dir' && b.kind === 'dir') return 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
        this.#lastEntries = entries;
        this.#renderEntries(entries);
      }).catch(err => {
        this.#fileList.innerHTML = '';
        const errEl = document.createElement('div');
        errEl.className = 'sz-dlg-empty';
        errEl.textContent = 'Error: ' + err.message;
        this.#fileList.appendChild(errEl);
      });
    }

    #goUp() {
      if (this.#currentPath === '/') return;
      const parts = this.#currentPath.split('/').filter(Boolean);
      parts.pop();
      const parent = parts.length > 0 ? '/' + parts.join('/') : '/';
      this.#navigateTo(parent);
    }

    async #confirm() {
      let filename = this.#filenameInput.value.trim();
      if (!filename) return;

      // In save mode, auto-append extension if the filename has none
      if (this.#mode === 'save' && !filename.includes('.')) {
        const ext = this.#getFirstExtension();
        if (ext)
          filename += '.' + ext;
      }

      const fullPath = this.#joinPath(this.#currentPath, filename);

      try {
        const stat = await this.#kernel.Stat(fullPath);
        if (stat.kind === 'dir') {
          this.#navigateTo(fullPath);
          return;
        }
      } catch (e) {
        // File doesn't exist — OK for save, check for open
        if (this.#mode === 'open') {
          // For open, the file must exist unless it's a new path
          // Let it through — caller handles the error
        }
      }

      this.#close();
      if (this.#resolve) {
        this.#resolve({ cancelled: false, path: fullPath });
        this.#resolve = null;
      }
    }

    #cancel() {
      this.#close();
      if (this.#resolve) {
        this.#resolve({ cancelled: true });
        this.#resolve = null;
      }
    }

    #close() {
      this.#overlay.style.display = 'none';
    }

    #joinPath(base, name) {
      if (base === '/') return '/' + name;
      return base + '/' + name;
    }
  }

  SZ.CommonDialogs = CommonDialogs;
})();
