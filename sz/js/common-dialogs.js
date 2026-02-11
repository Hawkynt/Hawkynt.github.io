;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const SIDEBAR_SHORTCUTS = [
    { label: 'Documents', icon: '\uD83D\uDCC4', path: '/user/documents' },
    { label: 'Desktop', icon: '\uD83D\uDDA5', path: '/user/desktop' },
    { label: 'Computer', icon: '\uD83D\uDCBB', path: '/' },
    { label: 'Temp', icon: '\uD83D\uDCC1', path: '/tmp' },
  ];

  class CommonDialogs {
    #vfs;
    #overlay = null;
    #currentPath = '/user/documents';
    #history = [];
    #selectedFile = null;
    #resolve = null;
    #mode = 'open'; // 'open' or 'save'
    #filters = [];
    #activeFilterIdx = 0;
    #multiSelect = false;
    #selectedFiles = new Set();

    // DOM refs
    #titleEl;
    #pathBar;
    #fileList;
    #filenameInput;
    #filterSelect;
    #okBtn;
    #backBtn;
    #upBtn;
    #uploadBtn;
    #uploadInput;
    #downloadBtn;

    constructor(vfs) {
      this.#vfs = vfs;
      this.#buildDOM();
    }

    async showOpen({ filters, initialDir, multiSelect, title } = {}) {
      this.#mode = 'open';
      this.#filters = filters || [{ name: 'All Files', ext: ['*'] }];
      this.#activeFilterIdx = 0;
      this.#multiSelect = multiSelect || false;
      this.#selectedFile = null;
      this.#selectedFiles.clear();
      this.#currentPath = initialDir || '/user/documents';
      this.#history = [];

      this.#titleEl.textContent = title || 'Open';
      this.#okBtn.textContent = 'Open';
      this.#filenameInput.value = '';
      this.#uploadBtn.style.display = '';
      this.#downloadBtn.style.display = 'none';
      this.#populateFilters();

      return new Promise((resolve) => {
        this.#resolve = resolve;
        this.#overlay.style.display = 'flex';
        this.#navigateTo(this.#currentPath);
        this.#filenameInput.focus();
      });
    }

    async showSave({ filters, initialDir, defaultName, title } = {}) {
      this.#mode = 'save';
      this.#filters = filters || [{ name: 'All Files', ext: ['*'] }];
      this.#activeFilterIdx = 0;
      this.#multiSelect = false;
      this.#selectedFile = null;
      this.#selectedFiles.clear();
      this.#currentPath = initialDir || '/user/documents';
      this.#history = [];

      this.#titleEl.textContent = title || 'Save As';
      this.#okBtn.textContent = 'Save';
      this.#filenameInput.value = defaultName || '';
      this.#uploadBtn.style.display = 'none';
      this.#downloadBtn.style.display = '';
      this.#populateFilters();

      return new Promise((resolve) => {
        this.#resolve = resolve;
        this.#overlay.style.display = 'flex';
        this.#navigateTo(this.#currentPath);
        this.#filenameInput.focus();
        this.#filenameInput.select();
      });
    }

    // ── DOM construction ────────────────────────────────────────────

    #buildDOM() {
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
      titlebar.appendChild(this.#titleEl);

      const closeBtn = document.createElement('span');
      closeBtn.className = 'sz-dlg-close-btn';
      closeBtn.textContent = '\u00D7';
      closeBtn.addEventListener('click', () => this.#cancel());
      titlebar.appendChild(closeBtn);
      win.appendChild(titlebar);

      // Toolbar
      const toolbar = document.createElement('div');
      toolbar.className = 'sz-dlg-toolbar';

      this.#backBtn = document.createElement('button');
      this.#backBtn.textContent = '\u25C4';
      this.#backBtn.title = 'Back';
      this.#backBtn.disabled = true;
      this.#backBtn.addEventListener('click', () => this.#goBack());
      toolbar.appendChild(this.#backBtn);

      this.#upBtn = document.createElement('button');
      this.#upBtn.textContent = '\u2191';
      this.#upBtn.title = 'Up one level';
      this.#upBtn.addEventListener('click', () => this.#goUp());
      toolbar.appendChild(this.#upBtn);

      this.#uploadInput = document.createElement('input');
      this.#uploadInput.type = 'file';
      this.#uploadInput.multiple = true;
      this.#uploadInput.style.display = 'none';
      this.#uploadInput.addEventListener('change', () => this.#handleUpload());

      this.#uploadBtn = document.createElement('button');
      this.#uploadBtn.textContent = 'Upload\u2026';
      this.#uploadBtn.title = 'Upload files from your computer into this folder';
      this.#uploadBtn.addEventListener('click', () => {
        this.#uploadInput.value = '';
        this.#uploadInput.click();
      });
      toolbar.appendChild(this.#uploadBtn);
      toolbar.appendChild(this.#uploadInput);

      this.#pathBar = document.createElement('div');
      this.#pathBar.className = 'sz-dlg-path-bar';
      this.#pathBar.addEventListener('click', () => this.#editPath());
      toolbar.appendChild(this.#pathBar);
      win.appendChild(toolbar);

      // Body
      const body = document.createElement('div');
      body.className = 'sz-dlg-body';

      // Sidebar
      const sidebar = document.createElement('div');
      sidebar.className = 'sz-dlg-sidebar';
      for (const sc of SIDEBAR_SHORTCUTS) {
        const item = document.createElement('div');
        item.className = 'sz-dlg-sidebar-item';
        item.innerHTML = `<span class="sz-dlg-sidebar-icon">${sc.icon}</span><span>${sc.label}</span>`;
        item.addEventListener('click', () => this.#navigateTo(sc.path));
        sidebar.appendChild(item);
      }
      body.appendChild(sidebar);

      // File list
      this.#fileList = document.createElement('div');
      this.#fileList.className = 'sz-dlg-file-list';
      body.appendChild(this.#fileList);
      win.appendChild(body);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'sz-dlg-footer';

      // Row 1: filename
      const row1 = document.createElement('div');
      row1.className = 'sz-dlg-footer-row';
      const fnLabel = document.createElement('label');
      fnLabel.textContent = 'File name:';
      row1.appendChild(fnLabel);
      this.#filenameInput = document.createElement('input');
      this.#filenameInput.type = 'text';
      this.#filenameInput.className = 'sz-dlg-filename-input';
      this.#filenameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.#confirm();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          this.#cancel();
        }
      });
      row1.appendChild(this.#filenameInput);
      footer.appendChild(row1);

      // Row 2: filter + buttons
      const row2 = document.createElement('div');
      row2.className = 'sz-dlg-footer-row';
      const ftLabel = document.createElement('label');
      ftLabel.textContent = 'Files of type:';
      row2.appendChild(ftLabel);
      this.#filterSelect = document.createElement('select');
      this.#filterSelect.className = 'sz-dlg-filter-select';
      this.#filterSelect.addEventListener('change', () => {
        this.#activeFilterIdx = this.#filterSelect.selectedIndex;
        this.#navigateTo(this.#currentPath);
      });
      row2.appendChild(this.#filterSelect);

      const btnWrap = document.createElement('div');
      btnWrap.className = 'sz-dlg-footer-buttons';
      this.#okBtn = document.createElement('button');
      this.#okBtn.textContent = 'Open';
      this.#okBtn.addEventListener('click', () => this.#confirm());
      btnWrap.appendChild(this.#okBtn);

      this.#downloadBtn = document.createElement('button');
      this.#downloadBtn.textContent = 'Download to PC';
      this.#downloadBtn.title = 'Save to VFS and also download a copy to your computer';
      this.#downloadBtn.style.display = 'none';
      this.#downloadBtn.addEventListener('click', () => this.#confirmAndDownload());
      btnWrap.appendChild(this.#downloadBtn);

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => this.#cancel());
      btnWrap.appendChild(cancelBtn);
      row2.appendChild(btnWrap);
      footer.appendChild(row2);

      win.appendChild(footer);
      this.#overlay.appendChild(win);

      // Keyboard handler on overlay
      this.#overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.#cancel();
        }
        if (e.key === 'Backspace' && document.activeElement !== this.#filenameInput) {
          e.preventDefault();
          this.#goUp();
        }
      });

      document.body.appendChild(this.#overlay);
    }

    // ── Navigation ──────────────────────────────────────────────────

    async #navigateTo(path) {
      if (path !== this.#currentPath)
        this.#history.push(this.#currentPath);
      this.#currentPath = path;
      this.#backBtn.disabled = this.#history.length === 0;
      this.#upBtn.disabled = path === '/';
      this.#pathBar.textContent = path;
      this.#selectedFile = null;
      this.#selectedFiles.clear();

      // Update sidebar active state
      for (const item of this.#overlay.querySelectorAll('.sz-dlg-sidebar-item'))
        item.classList.remove('active');
      const sidebarItems = this.#overlay.querySelectorAll('.sz-dlg-sidebar-item');
      for (let i = 0; i < SIDEBAR_SHORTCUTS.length; ++i) {
        if (SIDEBAR_SHORTCUTS[i].path === path)
          sidebarItems[i]?.classList.add('active');
      }

      this.#fileList.innerHTML = '';
      const emptyEl = document.createElement('div');
      emptyEl.className = 'sz-dlg-empty';
      emptyEl.textContent = 'Loading\u2026';
      this.#fileList.appendChild(emptyEl);

      try {
        const entries = await this.#vfs.list(path);
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

      // Apply filter to files (not dirs)
      const filter = this.#filters[this.#activeFilterIdx];
      const showAll = !filter || filter.ext.includes('*');

      const filtered = entries.filter(e => {
        if (e.type === 'dir') return true;
        if (showAll) return true;
        const ext = e.name.includes('.') ? e.name.split('.').pop().toLowerCase() : '';
        return filter.ext.some(fe => fe.toLowerCase() === ext);
      });

      if (filtered.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'sz-dlg-empty';
        emptyEl.textContent = 'This folder is empty.';
        this.#fileList.appendChild(emptyEl);
        return;
      }

      for (const entry of filtered) {
        const item = document.createElement('div');
        item.className = 'sz-dlg-file-item';

        const icon = document.createElement('span');
        icon.className = 'sz-dlg-file-icon';
        icon.textContent = entry.type === 'dir' ? '\uD83D\uDCC1' : '\uD83D\uDCC4';
        item.appendChild(icon);

        const name = document.createElement('span');
        name.className = 'sz-dlg-file-name';
        name.textContent = entry.name;
        item.appendChild(name);

        if (entry.type !== 'dir') {
          const size = document.createElement('span');
          size.className = 'sz-dlg-file-size';
          size.textContent = entry.size != null ? this.#formatSize(entry.size) : '';
          item.appendChild(size);
        }

        item.addEventListener('click', (e) => {
          if (entry.type === 'dir') {
            // Single click on dir: just select it
            this.#clearSelection();
            item.classList.add('selected');
            this.#filenameInput.value = entry.name;
            this.#selectedFile = null;
            return;
          }
          if (this.#multiSelect && e.ctrlKey) {
            item.classList.toggle('selected');
            if (item.classList.contains('selected'))
              this.#selectedFiles.add(entry.name);
            else
              this.#selectedFiles.delete(entry.name);
            this.#filenameInput.value = [...this.#selectedFiles].join('; ');
          } else {
            this.#clearSelection();
            item.classList.add('selected');
            this.#selectedFile = entry.name;
            this.#selectedFiles.clear();
            this.#selectedFiles.add(entry.name);
            this.#filenameInput.value = entry.name;
          }
        });

        item.addEventListener('dblclick', () => {
          if (entry.type === 'dir') {
            this.#navigateTo(this.#joinPath(this.#currentPath, entry.name));
            return;
          }
          this.#selectedFile = entry.name;
          this.#filenameInput.value = entry.name;
          this.#confirm();
        });

        this.#fileList.appendChild(item);
      }
    }

    #clearSelection() {
      for (const el of this.#fileList.querySelectorAll('.sz-dlg-file-item'))
        el.classList.remove('selected');
    }

    // ── Actions ─────────────────────────────────────────────────────

    async #confirm() {
      const filename = this.#filenameInput.value.trim();
      if (!filename) return;

      // Check if it's a directory name
      const fullPath = this.#joinPath(this.#currentPath, filename);
      try {
        const entries = await this.#vfs.list(fullPath);
        if (entries.length > 0 || filename.indexOf('.') === -1) {
          // Might be a directory, try navigating
          const exists = await this.#vfs.exists(fullPath);
          if (exists) {
            const listing = await this.#vfs.list(fullPath);
            if (listing.length >= 0 && filename.indexOf('.') === -1) {
              this.#navigateTo(fullPath);
              return;
            }
          }
        }
      } catch (_) {
        // Not a dir, treat as file
      }

      if (this.#mode === 'open') {
        const path = this.#joinPath(this.#currentPath, filename);
        try {
          const content = await this.#vfs.read(path);
          this.#close();
          this.#resolve({ cancelled: false, path, content });
        } catch (err) {
          // File might not exist
          this.#close();
          this.#resolve({ cancelled: false, path, content: null, error: err.message });
        }
      } else {
        // Save mode
        let name = filename;
        if (!name.includes('.')) {
          // Add default extension from current filter
          const filter = this.#filters[this.#activeFilterIdx];
          if (filter && filter.ext.length > 0 && filter.ext[0] !== '*')
            name += '.' + filter.ext[0];
        }
        const path = this.#joinPath(this.#currentPath, name);
        this.#close();
        this.#resolve({ cancelled: false, path });
      }
    }

    #cancel() {
      this.#close();
      if (this.#resolve)
        this.#resolve({ cancelled: true });
    }

    #close() {
      this.#overlay.style.display = 'none';
    }

    #goBack() {
      if (this.#history.length > 0) {
        const prev = this.#history.pop();
        this.#currentPath = prev; // avoid re-pushing in navigateTo
        this.#backBtn.disabled = this.#history.length === 0;
        this.#navigateWithoutHistory(prev);
      }
    }

    async #navigateWithoutHistory(path) {
      this.#currentPath = path;
      this.#upBtn.disabled = path === '/';
      this.#pathBar.textContent = path;
      this.#selectedFile = null;
      this.#selectedFiles.clear();

      this.#fileList.innerHTML = '';
      try {
        const entries = await this.#vfs.list(path);
        this.#renderEntries(entries);
      } catch (err) {
        const errEl = document.createElement('div');
        errEl.className = 'sz-dlg-empty';
        errEl.textContent = 'Error: ' + err.message;
        this.#fileList.appendChild(errEl);
      }
    }

    #goUp() {
      if (this.#currentPath === '/') return;
      const parts = this.#currentPath.split('/').filter(Boolean);
      parts.pop();
      const parent = parts.length > 0 ? '/' + parts.join('/') : '/';
      this.#navigateTo(parent);
    }

    async #handleUpload() {
      const files = this.#uploadInput.files;
      if (!files || files.length === 0) return;

      let lastName = null;
      for (const file of files) {
        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          if (file.type.startsWith('text/') || /\.(txt|html?|css|js|json|xml|csv|md|svg|ini|cfg|conf|log|sh|bat|ps1|py|rb|pl|java|cs|cpp|c|h|ts|tsx|jsx)$/i.test(file.name))
            reader.readAsText(file);
          else
            reader.readAsArrayBuffer(file);
        });

        const path = this.#joinPath(this.#currentPath, file.name);
        await this.#vfs.write(path, content);
        lastName = file.name;
      }

      await this.#navigateTo(this.#currentPath);

      if (lastName && !this.#multiSelect) {
        this.#filenameInput.value = lastName;
        this.#selectedFile = lastName;
        this.#selectedFiles.clear();
        this.#selectedFiles.add(lastName);
        for (const el of this.#fileList.querySelectorAll('.sz-dlg-file-item')) {
          const nameEl = el.querySelector('.sz-dlg-file-name');
          if (nameEl && nameEl.textContent === lastName)
            el.classList.add('selected');
        }
      }
    }

    async #confirmAndDownload() {
      const filename = this.#filenameInput.value.trim();
      if (!filename) return;

      let name = filename;
      if (!name.includes('.')) {
        const filter = this.#filters[this.#activeFilterIdx];
        if (filter && filter.ext.length > 0 && filter.ext[0] !== '*')
          name += '.' + filter.ext[0];
      }

      const path = this.#joinPath(this.#currentPath, name);

      // Attempt to read the file content for download; it may have just been
      // written by the calling app (Save dialogs resolve first, then content
      // is written).  We resolve with an extra flag so the caller can write
      // the file, and we schedule the download for the next microtask so the
      // VFS write from the caller has time to complete.
      this.#close();
      this.#resolve({ cancelled: false, path, downloadRequested: true });

      // Give the caller a tick to write the file, then trigger the download.
      await new Promise(r => setTimeout(r, 100));
      try {
        const content = await this.#vfs.read(path);
        const blob = content instanceof ArrayBuffer
          ? new Blob([content])
          : new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (_) {
        // If the file hasn't been written yet, silently skip -- the caller
        // received the path and can still save normally.
      }
    }

    #editPath() {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'sz-dlg-path-input';
      input.value = this.#currentPath;
      this.#pathBar.textContent = '';
      this.#pathBar.appendChild(input);
      input.focus();
      input.select();

      const finish = () => {
        const val = input.value.trim();
        input.remove();
        this.#pathBar.textContent = this.#currentPath;
        if (val && val !== this.#currentPath)
          this.#navigateTo(val);
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(); }
        if (e.key === 'Escape') { e.preventDefault(); input.remove(); this.#pathBar.textContent = this.#currentPath; }
      });
      input.addEventListener('blur', finish);
    }

    // ── Helpers ─────────────────────────────────────────────────────

    #populateFilters() {
      this.#filterSelect.innerHTML = '';
      for (const f of this.#filters) {
        const opt = document.createElement('option');
        opt.textContent = f.name + ' (' + f.ext.map(e => e === '*' ? '*.*' : '*.' + e).join(', ') + ')';
        this.#filterSelect.appendChild(opt);
      }
      this.#filterSelect.selectedIndex = this.#activeFilterIdx;
    }

    #joinPath(base, name) {
      if (base === '/') return '/' + name;
      return base + '/' + name;
    }

    #formatSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1048576).toFixed(1) + ' MB';
    }

    // ── MessageBox dialog ────────────────────────────────────────────

    showMessageBox(text, caption, flags) {
      const MB_TYPEMASK = 0x0F;
      const MB_ICONMASK = 0xF0;
      const btnType = flags & MB_TYPEMASK;
      const iconType = flags & MB_ICONMASK;

      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'sz-msgbox-overlay';

        const box = document.createElement('div');
        box.className = 'sz-msgbox';

        // Title bar
        const titlebar = document.createElement('div');
        titlebar.className = 'sz-msgbox-titlebar';
        const titleSpan = document.createElement('span');
        titleSpan.textContent = caption || '';
        titlebar.appendChild(titleSpan);

        const closeBtn = document.createElement('span');
        closeBtn.className = 'sz-msgbox-close';
        closeBtn.textContent = '\u00D7';
        closeBtn.addEventListener('click', () => finish(2)); // IDCANCEL
        titlebar.appendChild(closeBtn);
        box.appendChild(titlebar);

        // Body
        const body = document.createElement('div');
        body.className = 'sz-msgbox-body';

        // Icon
        const iconEl = document.createElement('span');
        iconEl.className = 'sz-msgbox-icon';
        if (iconType === 0x10)      iconEl.textContent = '\u274C';  // error
        else if (iconType === 0x20) iconEl.textContent = '\u2753';  // question
        else if (iconType === 0x30) iconEl.textContent = '\u26A0';  // warning
        else if (iconType === 0x40) iconEl.textContent = '\u2139';  // info
        else                        iconEl.style.display = 'none';
        body.appendChild(iconEl);

        const textEl = document.createElement('span');
        textEl.className = 'sz-msgbox-text';
        textEl.textContent = text || '';
        body.appendChild(textEl);
        box.appendChild(body);

        // Buttons
        const btnBar = document.createElement('div');
        btnBar.className = 'sz-msgbox-buttons';

        const addBtn = (label, id) => {
          const btn = document.createElement('button');
          btn.textContent = label;
          btn.addEventListener('click', () => finish(id));
          btnBar.appendChild(btn);
          return btn;
        };

        let firstBtn;
        switch (btnType) {
          case 1: // MB_OKCANCEL
            firstBtn = addBtn('OK', 1);
            addBtn('Cancel', 2);
            break;
          case 3: // MB_YESNOCANCEL
            firstBtn = addBtn('Yes', 6);
            addBtn('No', 7);
            addBtn('Cancel', 2);
            break;
          case 4: // MB_YESNO
            firstBtn = addBtn('Yes', 6);
            addBtn('No', 7);
            break;
          default: // MB_OK
            firstBtn = addBtn('OK', 1);
            break;
        }

        box.appendChild(btnBar);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        if (firstBtn)
          firstBtn.focus();

        // Keyboard
        overlay.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            finish(2); // IDCANCEL
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            finish(btnType === 4 ? 6 : btnType === 3 ? 6 : 1); // default button
          }
        });

        function finish(result) {
          overlay.remove();
          resolve(result);
        }
      });
    }
  }

  SZ.CommonDialogs = CommonDialogs;
})();
