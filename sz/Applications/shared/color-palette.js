;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const STANDARD_COLORS = [
    '#000000','#993300','#333300','#003300','#003366','#000080','#333399','#333333',
    '#800000','#ff6600','#808000','#008000','#008080','#0000ff','#666699','#808080',
    '#ff0000','#ff9900','#99cc00','#339966','#33cccc','#3366ff','#800080','#999999',
    '#ff00ff','#ffcc00','#ffff00','#00ff00','#00ffff','#00ccff','#993366','#c0c0c0',
    '#ff99cc','#ffcc99','#ffff99','#ccffcc','#ccffff','#99ccff','#cc99ff','#ffffff',
  ];

  class ColorPalette {

    #containerEl;
    #storageKey;
    #callback = null;
    #recentColors = [];
    #panelEl;
    #recentRow;

    constructor(containerEl, { storageKey } = {}) {
      this.#containerEl = containerEl;
      this.#storageKey = storageKey || 'sz-recent-colors';

      try {
        const saved = localStorage.getItem(this.#storageKey);
        if (saved)
          this.#recentColors = JSON.parse(saved);
      } catch (_e) { /* ignore */ }

      this.#build();
    }

    #build() {
      this.#panelEl = document.createElement('div');
      this.#panelEl.className = 'sz-color-palette';

      const grid = document.createElement('div');
      grid.className = 'sz-color-grid';
      for (const color of STANDARD_COLORS) {
        const swatch = document.createElement('div');
        swatch.className = 'sz-color-swatch';
        swatch.style.backgroundColor = color;
        swatch.title = color;
        swatch.addEventListener('click', () => this.#pick(color));
        grid.appendChild(swatch);
      }
      this.#panelEl.appendChild(grid);

      this.#recentRow = document.createElement('div');
      this.#recentRow.className = 'sz-color-recent';
      this.#renderRecent();
      this.#panelEl.appendChild(this.#recentRow);

      const moreBtn = document.createElement('button');
      moreBtn.className = 'sz-color-more';
      moreBtn.textContent = 'More Colors\u2026';
      moreBtn.addEventListener('click', () => {
        const returnKey = 'sz:colorpalette:' + Date.now() + ':' + Math.random().toString(36).slice(2);
        const onStorage = (e) => {
          if (e.key !== returnKey || !e.newValue) return;
          window.removeEventListener('storage', onStorage);
          localStorage.removeItem(returnKey);
          try {
            const result = JSON.parse(e.newValue);
            if (result.hex) this.#pick(result.hex);
          } catch (_e) { /* ignore */ }
        };
        window.addEventListener('storage', onStorage);
        const User32 = window.SZ && SZ.Dlls && SZ.Dlls.User32;
        if (User32 && User32.PostMessage) {
          User32.PostMessage('sz:launchApp', { appId: 'color-picker', urlParams: { returnKey, hex: '#000000' } });
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'sz:launchApp', appId: 'color-picker', urlParams: { returnKey, hex: '#000000' } }, '*');
        } else {
          // Fallback to native picker when SZ is not available
          window.removeEventListener('storage', onStorage);
          const input = document.createElement('input');
          input.type = 'color';
          input.value = '#000000';
          input.addEventListener('input', () => this.#pick(input.value));
          input.click();
        }
      });
      this.#panelEl.appendChild(moreBtn);

      this.#containerEl.appendChild(this.#panelEl);

      document.addEventListener('pointerdown', (e) => {
        if (this.#panelEl.classList.contains('visible') && !this.#panelEl.contains(e.target) && !e.target.closest('.ribbon-color-btn, .sz-color-trigger'))
          this.hide();
      });
    }

    #renderRecent() {
      this.#recentRow.innerHTML = '';
      if (!this.#recentColors.length)
        return;
      const label = document.createElement('div');
      label.className = 'sz-color-recent-label';
      label.textContent = 'Recent:';
      this.#recentRow.appendChild(label);
      const row = document.createElement('div');
      row.className = 'sz-color-recent-swatches';
      for (const color of this.#recentColors) {
        const swatch = document.createElement('div');
        swatch.className = 'sz-color-swatch';
        swatch.style.backgroundColor = color;
        swatch.title = color;
        swatch.addEventListener('click', () => this.#pick(color));
        row.appendChild(swatch);
      }
      this.#recentRow.appendChild(row);
    }

    #pick(color) {
      this.#addRecent(color);
      this.hide();
      if (this.#callback)
        this.#callback(color);
    }

    #addRecent(color) {
      const lower = color.toLowerCase();
      this.#recentColors = this.#recentColors.filter(c => c.toLowerCase() !== lower);
      this.#recentColors.unshift(lower);
      if (this.#recentColors.length > 10)
        this.#recentColors.length = 10;
      this.#renderRecent();
      try {
        localStorage.setItem(this.#storageKey, JSON.stringify(this.#recentColors));
      } catch (_e) { /* ignore */ }
    }

    show(anchorEl, callback) {
      this.#callback = callback;
      const rect = anchorEl.getBoundingClientRect();
      this.#panelEl.style.left = rect.left + 'px';
      this.#panelEl.style.top = rect.bottom + 'px';
      this.#panelEl.classList.add('visible');
    }

    hide() {
      this.#panelEl.classList.remove('visible');
      this.#callback = null;
    }
  }

  SZ.ColorPalette = ColorPalette;
  SZ.STANDARD_COLORS = STANDARD_COLORS;
})();
