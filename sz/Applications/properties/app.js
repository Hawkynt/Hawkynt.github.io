;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  SZ.Apps = SZ.Apps || {};

  // =========================================================================
  // Helpers
  // =========================================================================

  function formatSize(bytes) {
    if (bytes == null || isNaN(bytes)) return '';
    bytes = +bytes;
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDate(mtime) {
    if (!mtime) return '';
    try {
      const d = new Date(isNaN(+mtime) ? mtime : +mtime);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  function formatPath(path) {
    if (!path) return '';
    if (path === '/') return 'SZ:\\';
    return 'SZ:\\' + path.replace(/^\//, '').replace(/\//g, '\\');
  }

  function escapeHtml(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function loadScript(src) {
    if (document.querySelector('script[src="' + src + '"]'))
      return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  // =========================================================================
  // CSS (injected once)
  // =========================================================================

  const CSS = `
.sz-props-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  font: 11px/1.4 "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  color: var(--sz-color-window-text, #000);
  background: var(--sz-color-button-face, #ece9d8);
  user-select: text;
}

.sz-props-tabs {
  display: flex;
  gap: 0;
  background: var(--sz-color-button-face, #ece9d8);
  border-bottom: 1px solid var(--sz-color-button-shadow, #aca899);
  overflow-x: auto;
  flex-shrink: 0;
}

.sz-props-tab {
  padding: 4px 10px;
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  white-space: nowrap;
  color: inherit;
}

.sz-props-tab:hover { background: var(--sz-color-button-highlight, #fff); }

.sz-props-tab.active {
  background: var(--sz-color-window, #fff);
  border-color: var(--sz-color-button-shadow, #aca899);
  border-bottom: 1px solid var(--sz-color-window, #fff);
  margin-bottom: -1px;
  font-weight: bold;
}

.sz-props-content {
  flex: 1;
  padding: 8px;
  background: var(--sz-color-window, #fff);
  overflow: auto;
  min-height: 0;
}

.sz-props-table { width: 100%; border-collapse: collapse; }

.sz-props-table td {
  padding: 3px 6px;
  font-size: 11px;
  border-bottom: 1px solid var(--sz-color-button-highlight, #f0f0f0);
  vertical-align: top;
}

.sz-props-label {
  width: 35%;
  color: var(--sz-color-gray-text, #808080);
  font-size: 10px;
}

.sz-props-value { word-break: break-all; }

.sz-props-footer {
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  background: var(--sz-color-button-face, #ece9d8);
  border-top: 1px solid var(--sz-color-button-shadow, #aca899);
  flex-shrink: 0;
}

.sz-props-footer button {
  font: inherit;
  padding: 2px 16px;
  cursor: pointer;
}

.sz-props-footer .sz-props-spacer { flex: 1; }

.sz-props-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  color: var(--sz-color-gray-text, #808080);
  font-size: 10px;
}

@keyframes sz-props-spin {
  to { transform: rotate(360deg); }
}

.sz-props-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--sz-color-button-shadow, #aca899);
  border-top-color: var(--sz-color-highlight, #316ac5);
  border-radius: 50%;
  animation: sz-props-spin .8s linear infinite;
}
`;

  let _cssInjected = false;
  function injectCSS() {
    if (_cssInjected) return;
    _cssInjected = true;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  // =========================================================================
  // Application
  // =========================================================================

  class Application {
    #container;
    #params;
    #win = null;
    #tabs = [];
    #activeTab = 0;
    #tabsEl;
    #contentEl;
    #mvBtn;

    constructor(container, params) {
      this.#container = container;
      this.#params = params || {};
      injectCSS();
      this.#buildDOM();
      this.#buildGeneralTab();
      this.#render();

      if (this.#params.isVfs && !this.#params.isDir)
        this.#loadMetadataAsync();
      else if (this.#params.isVfs && this.#params.isDir)
        this.#loadFolderMetadataAsync();
    }

    onAttach(win) {
      this.#win = win;
      win.setTitle((this.#params.name || 'Properties') + ' - Properties');
    }

    // -- DOM ---------------------------------------------------------------

    #buildDOM() {
      const root = document.createElement('div');
      root.className = 'sz-props-app';

      this.#tabsEl = document.createElement('div');
      this.#tabsEl.className = 'sz-props-tabs';
      root.appendChild(this.#tabsEl);

      this.#contentEl = document.createElement('div');
      this.#contentEl.className = 'sz-props-content';
      root.appendChild(this.#contentEl);

      const footer = document.createElement('div');
      footer.className = 'sz-props-footer';

      this.#mvBtn = document.createElement('button');
      this.#mvBtn.textContent = 'Open in Metadata Viewer';
      this.#mvBtn.style.display = this.#params.isDir ? 'none' : '';
      this.#mvBtn.addEventListener('click', () => {
        if (SZ.os?.appLauncher)
          SZ.os.appLauncher.launch('metadata-viewer', { file: this.#params.file });
      });
      footer.appendChild(this.#mvBtn);

      const spacer = document.createElement('span');
      spacer.className = 'sz-props-spacer';
      footer.appendChild(spacer);

      const closeBtn = document.createElement('button');
      closeBtn.textContent = 'Close';
      closeBtn.addEventListener('click', () => {
        if (this.#win)
          SZ.os?.windowManager?.closeWindow(this.#win.id);
      });
      footer.appendChild(closeBtn);

      root.appendChild(footer);
      this.#container.appendChild(root);
    }

    // -- General tab -------------------------------------------------------

    #buildGeneralTab() {
      const p = this.#params;
      const fields = [
        { label: 'Name', value: p.name || '' },
        { label: 'Path', value: formatPath(p.file) },
        { label: 'Type', value: p.isDir ? 'Folder' : 'File' },
      ];
      if (!p.isDir && p.size)
        fields.push({ label: 'Size', value: formatSize(p.size) });
      if (p.mtime)
        fields.push({ label: 'Modified', value: formatDate(p.mtime) });
      fields.push({ label: 'Location', value: p.isVfs ? 'VFS (localStorage)' : 'SZ Object Tree' });

      this.#tabs = [{ name: 'General', fields }];
    }

    // -- Render ------------------------------------------------------------

    #render() {
      this.#renderTabs();
      this.#renderContent();
    }

    #renderTabs() {
      this.#tabsEl.innerHTML = '';
      this.#tabs.forEach((tab, i) => {
        const btn = document.createElement('button');
        btn.className = 'sz-props-tab' + (i === this.#activeTab ? ' active' : '');
        btn.textContent = tab.name;
        btn.addEventListener('click', () => {
          this.#activeTab = i;
          this.#render();
        });
        this.#tabsEl.appendChild(btn);
      });
    }

    #renderContent() {
      this.#contentEl.innerHTML = '';
      const tab = this.#tabs[this.#activeTab];
      if (!tab) return;
      const table = document.createElement('table');
      table.className = 'sz-props-table';
      for (const field of tab.fields) {
        const tr = document.createElement('tr');
        const tdL = document.createElement('td');
        tdL.className = 'sz-props-label';
        tdL.textContent = field.label;
        tr.appendChild(tdL);
        const tdV = document.createElement('td');
        tdV.className = 'sz-props-value';
        tdV.textContent = String(field.value);
        tr.appendChild(tdV);
        table.appendChild(tr);
      }
      this.#contentEl.appendChild(table);
    }

    // -- Metadata loading --------------------------------------------------

    async #loadMetadataAsync() {
      const loading = document.createElement('div');
      loading.className = 'sz-props-loading';
      loading.innerHTML = '<div class="sz-props-spinner"></div>Loading metadata\u2026';
      this.#contentEl.appendChild(loading);

      try {
        const kernel = SZ.os?.kernel;
        if (!kernel) return;

        const bytes = await kernel.ReadAllBytes(this.#params.file);
        if (!bytes || bytes.length === 0) {
          loading.remove();
          return;
        }

        await loadScript('Applications/metadata-viewer/parsers-core.js');
        await Promise.all([
          loadScript('Applications/metadata-viewer/parsers-image.js'),
          loadScript('Applications/metadata-viewer/parsers-audio.js'),
          loadScript('Applications/metadata-viewer/parsers-video.js'),
          loadScript('Applications/metadata-viewer/parsers-document.js'),
          loadScript('Applications/metadata-viewer/parsers-archive.js'),
          loadScript('Applications/metadata-viewer/parsers-executable.js'),
          loadScript('Applications/metadata-viewer/parsers-font.js'),
        ]);

        if (typeof SZ.MetadataParsers === 'undefined') {
          loading.remove();
          return;
        }

        const result = SZ.MetadataParsers.parse(bytes, this.#params.name);

        if (result.fileType) {
          const genFields = this.#tabs[0].fields;
          const typeIdx = genFields.findIndex(f => f.label === 'Type');
          if (typeIdx >= 0)
            genFields[typeIdx].value = result.fileType.name;
        }

        // Deep-inspection categories belong in Metadata Viewer, not Properties
        const _SKIP = /^(General|Resources|Strings|Sections|Imports|Exports|Contents|\.NET Assembly|Detection|Classes|Block Availability|Directory|Hunk Table|Signing|Segments|Linked Libraries|Compiler|DEX Header|Python Bytecode)/;

        for (const cat of result.categories) {
          if (_SKIP.test(cat.name)) continue;
          this.#tabs.push({
            name: cat.name,
            fields: cat.fields.map(f => ({ label: f.label, value: f.value })),
          });
        }

        loading.remove();
        this.#render();
      } catch (err) {
        console.warn('[Properties] metadata load failed:', err);
        loading.remove();
      }
    }

    // -- Folder metadata ---------------------------------------------------

    async #loadFolderMetadataAsync() {
      try {
        const kernel = SZ.os?.kernel;
        if (!kernel) return;

        const entries = await kernel.List(this.#params.file);
        const genFields = this.#tabs[0].fields;

        genFields.push({ label: 'Items', value: entries.length });

        let totalSize = 0;
        for (const name of entries) {
          try {
            const stat = await kernel.Stat(
              (this.#params.file === '/' ? '/' : this.#params.file + '/') + name
            );
            if (stat.kind !== 'dir' && stat.size != null)
              totalSize += stat.size;
          } catch {}
        }

        if (totalSize > 0)
          genFields.push({ label: 'Total file size', value: formatSize(totalSize) });

        this.#render();
      } catch (err) {
        console.warn('[Properties] folder metadata load failed:', err);
      }
    }
  }

  SZ.Apps['properties'] = { Application };
})();
