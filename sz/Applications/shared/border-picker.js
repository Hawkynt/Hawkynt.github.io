;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const BORDER_STYLES = [
    { name: 'None', css: 'none' },
    { name: 'Thin', css: '1px solid' },
    { name: 'Medium', css: '2px solid' },
    { name: 'Thick', css: '3px solid' },
    { name: 'Double', css: '3px double' },
    { name: 'Dotted', css: '1px dotted' },
    { name: 'Dashed', css: '1px dashed' }
  ];

  const BORDER_POSITIONS = [
    { name: 'All Borders', icon: '\u2610', key: 'all' },
    { name: 'Outside Borders', icon: '\u25A1', key: 'outside' },
    { name: 'Top Border', icon: '\u2594', key: 'top' },
    { name: 'Bottom Border', icon: '\u2581', key: 'bottom' },
    { name: 'Left Border', icon: '\u258F', key: 'left' },
    { name: 'Right Border', icon: '\u2595', key: 'right' },
    { name: 'No Border', icon: '\u2715', key: 'none' }
  ];

  class BorderPicker {

    #containerEl;
    #panelEl;
    #callback = null;
    #selectedStyle = BORDER_STYLES[1];
    #selectedColor = '#000000';
    #colorPalette = null;

    constructor(containerEl) {
      this.#containerEl = containerEl;
      this.#build();
    }

    #build() {
      this.#panelEl = document.createElement('div');
      this.#panelEl.className = 'sz-border-picker';

      const posGrid = document.createElement('div');
      posGrid.className = 'sz-border-positions';
      for (const pos of BORDER_POSITIONS) {
        const btn = document.createElement('button');
        btn.className = 'sz-border-pos-btn';
        btn.textContent = pos.icon;
        btn.title = pos.name;
        btn.addEventListener('click', () => this.#pick(pos.key));
        posGrid.appendChild(btn);
      }
      this.#panelEl.appendChild(posGrid);

      const sep1 = document.createElement('div');
      sep1.className = 'sz-border-sep';
      this.#panelEl.appendChild(sep1);

      const styleLabel = document.createElement('div');
      styleLabel.className = 'sz-border-label';
      styleLabel.textContent = 'Style:';
      this.#panelEl.appendChild(styleLabel);

      const styleList = document.createElement('div');
      styleList.className = 'sz-border-styles';
      for (const style of BORDER_STYLES) {
        const row = document.createElement('div');
        row.className = 'sz-border-style-row';
        if (style === this.#selectedStyle)
          row.classList.add('selected');

        const preview = document.createElement('div');
        preview.className = 'sz-border-style-preview';
        if (style.css !== 'none')
          preview.style.borderBottom = style.css + ' #000';
        else
          preview.style.borderBottom = '1px solid transparent';

        const label = document.createElement('span');
        label.textContent = style.name;

        row.appendChild(preview);
        row.appendChild(label);
        row.addEventListener('click', () => {
          this.#selectedStyle = style;
          for (const r of styleList.querySelectorAll('.sz-border-style-row'))
            r.classList.remove('selected');
          row.classList.add('selected');
        });
        styleList.appendChild(row);
      }
      this.#panelEl.appendChild(styleList);

      const sep2 = document.createElement('div');
      sep2.className = 'sz-border-sep';
      this.#panelEl.appendChild(sep2);

      const colorRow = document.createElement('div');
      colorRow.className = 'sz-border-color-row';
      const colorLabel = document.createElement('span');
      colorLabel.textContent = 'Color:';
      const colorSwatch = document.createElement('div');
      colorSwatch.className = 'sz-color-swatch sz-border-color-swatch';
      colorSwatch.style.backgroundColor = this.#selectedColor;
      colorRow.appendChild(colorLabel);
      colorRow.appendChild(colorSwatch);
      this.#panelEl.appendChild(colorRow);

      colorSwatch.addEventListener('click', () => {
        if (SZ.ColorPalette && !this.#colorPalette) {
          const wrapper = document.createElement('div');
          wrapper.style.position = 'relative';
          colorRow.appendChild(wrapper);
          this.#colorPalette = new SZ.ColorPalette(wrapper, { storageKey: 'sz-border-colors' });
        }
        if (this.#colorPalette)
          this.#colorPalette.show(colorSwatch, (color) => {
            this.#selectedColor = color;
            colorSwatch.style.backgroundColor = color;
          });
      });

      this.#containerEl.appendChild(this.#panelEl);

      document.addEventListener('pointerdown', (e) => {
        if (this.#panelEl.classList.contains('visible') && !this.#panelEl.contains(e.target) && !e.target.closest('.sz-border-trigger'))
          this.hide();
      });
    }

    #pick(positionKey) {
      this.hide();
      if (this.#callback)
        this.#callback({
          position: positionKey,
          style: this.#selectedStyle,
          color: this.#selectedColor
        });
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

    static toCss(borderObj) {
      if (!borderObj || !borderObj.style || borderObj.style.css === 'none')
        return 'none';
      return borderObj.style.css + ' ' + (borderObj.color || '#000');
    }
  }

  SZ.BorderPicker = BorderPicker;
  SZ.BORDER_STYLES = BORDER_STYLES;
})();
