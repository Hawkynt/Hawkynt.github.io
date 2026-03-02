;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const FONT_FAMILIES = [
    'Arial', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas',
    'Courier New', 'Georgia', 'Impact', 'Lucida Console',
    'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman',
    'Trebuchet MS', 'Verdana'
  ];

  const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

  class FontPicker {

    #familySelectEl;
    #sizeSelectEl;
    #onFamilyChange;
    #onSizeChange;

    constructor({ familySelectEl, sizeSelectEl, defaultFamily, defaultSize, onFamilyChange, onSizeChange }) {
      this.#familySelectEl = familySelectEl;
      this.#sizeSelectEl = sizeSelectEl;
      this.#onFamilyChange = onFamilyChange || (() => {});
      this.#onSizeChange = onSizeChange || (() => {});

      if (familySelectEl) {
        for (const family of FONT_FAMILIES) {
          const opt = document.createElement('option');
          opt.value = family;
          opt.textContent = family;
          opt.style.fontFamily = family;
          familySelectEl.appendChild(opt);
        }
        if (defaultFamily)
          familySelectEl.value = defaultFamily;
        familySelectEl.addEventListener('change', () => this.#onFamilyChange(familySelectEl.value));
      }

      if (sizeSelectEl) {
        for (const size of FONT_SIZES) {
          const opt = document.createElement('option');
          opt.value = size;
          opt.textContent = size;
          sizeSelectEl.appendChild(opt);
        }
        if (defaultSize)
          sizeSelectEl.value = String(defaultSize);
        sizeSelectEl.addEventListener('change', () => this.#onSizeChange(Number(sizeSelectEl.value)));
      }
    }

    get family() { return this.#familySelectEl ? this.#familySelectEl.value : ''; }
    set family(val) {
      if (this.#familySelectEl)
        this.#familySelectEl.value = val;
    }

    get size() { return this.#sizeSelectEl ? Number(this.#sizeSelectEl.value) : 0; }
    set size(val) {
      if (this.#sizeSelectEl)
        this.#sizeSelectEl.value = String(val);
    }
  }

  SZ.FontPicker = FontPicker;
  SZ.FONT_FAMILIES = FONT_FAMILIES;
  SZ.FONT_SIZES = FONT_SIZES;
})();
