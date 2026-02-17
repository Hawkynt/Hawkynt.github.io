;(function() {
'use strict';

const SZ = window.SZ || (window.SZ = {});

// ── Inject CSS once ──────────────────────────────────────────────────────────
let _cssInjected = false;
function _injectCSS() {
  if (_cssInjected)
    return;
  _cssInjected = true;
  const style = document.createElement('style');
  style.textContent = `
.sz-zoom-control {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font: inherit;
  color: inherit;
  vertical-align: middle;
}

.sz-zoom-control .sz-zoom-btn {
  width: 20px;
  height: 18px;
  border: 1px solid transparent;
  background: transparent;
  cursor: default;
  font-size: 12px;
  line-height: 16px;
  text-align: center;
  color: inherit;
  border-radius: 2px;
  padding: 0;
  opacity: 0.8;
}

.sz-zoom-control .sz-zoom-btn:hover {
  border-color: var(--sz-color-button-shadow, #888);
  background: color-mix(in srgb, var(--sz-color-button-face, #eee) 60%, #ffffff 40%);
}

.sz-zoom-control .sz-zoom-btn:active {
  background: var(--sz-color-button-shadow, #888);
}

.sz-zoom-control .sz-zoom-slider {
  width: 80px;
  height: 12px;
  cursor: default;
}

.sz-zoom-control .sz-zoom-input {
  width: 44px;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: center;
  padding: 0 2px;
  border-radius: 2px;
  cursor: default;
}

.sz-zoom-control .sz-zoom-input:hover {
  border-color: var(--sz-color-button-shadow, #888);
}

.sz-zoom-control .sz-zoom-input:focus {
  border-color: var(--sz-color-highlight, #3399ff);
  background: var(--sz-color-window, #fff);
  outline: none;
  cursor: text;
}
`;
  document.head.appendChild(style);
}

// ── ZoomControl class ────────────────────────────────────────────────────────

class ZoomControl {

  #container;
  #slider;
  #input;
  #btnOut;
  #btnIn;
  #opts;
  #val;
  #handlers = {};

  constructor(containerEl, opts = {}) {
    _injectCSS();

    this.#opts = {
      min: opts.min ?? 0,
      max: opts.max ?? 100,
      step: opts.step ?? 1,
      value: opts.value ?? opts.min ?? 0,
      formatLabel: opts.formatLabel || (v => v + '%'),
      parseLabel: opts.parseLabel || (text => { const n = parseInt(text, 10); return isNaN(n) ? null : n; }),
      onChange: opts.onChange || null,
      onZoomIn: opts.onZoomIn || null,
      onZoomOut: opts.onZoomOut || null,
    };

    this.#val = this.#opts.value;

    // Build DOM
    const wrap = document.createElement('span');
    wrap.className = 'sz-zoom-control';

    this.#btnOut = document.createElement('button');
    this.#btnOut.className = 'sz-zoom-btn sz-zoom-out';
    this.#btnOut.textContent = '\u2212';
    this.#btnOut.title = 'Zoom Out';

    this.#slider = document.createElement('input');
    this.#slider.type = 'range';
    this.#slider.className = 'sz-zoom-slider';
    this.#slider.min = this.#opts.min;
    this.#slider.max = this.#opts.max;
    this.#slider.step = this.#opts.step;
    this.#slider.value = this.#val;

    this.#btnIn = document.createElement('button');
    this.#btnIn.className = 'sz-zoom-btn sz-zoom-in';
    this.#btnIn.textContent = '+';
    this.#btnIn.title = 'Zoom In';

    this.#input = document.createElement('input');
    this.#input.type = 'text';
    this.#input.className = 'sz-zoom-input';
    this.#input.value = this.#opts.formatLabel(this.#val);

    wrap.appendChild(this.#btnOut);
    wrap.appendChild(this.#slider);
    wrap.appendChild(this.#btnIn);
    wrap.appendChild(this.#input);

    containerEl.appendChild(wrap);
    this.#container = wrap;

    // Bind events
    this.#handlers.sliderInput = () => {
      this.#val = Number(this.#slider.value);
      this.#input.value = this.#opts.formatLabel(this.#val);
      if (this.#opts.onChange)
        this.#opts.onChange(this.#val);
    };

    this.#handlers.btnInClick = () => {
      if (this.#opts.onZoomIn) {
        this.#opts.onZoomIn();
        return;
      }
      const next = Math.min(this.#opts.max, this.#val + this.#opts.step);
      if (next !== this.#val) {
        this.#val = next;
        this.#slider.value = this.#val;
        this.#input.value = this.#opts.formatLabel(this.#val);
        if (this.#opts.onChange)
          this.#opts.onChange(this.#val);
      }
    };

    this.#handlers.btnOutClick = () => {
      if (this.#opts.onZoomOut) {
        this.#opts.onZoomOut();
        return;
      }
      const next = Math.max(this.#opts.min, this.#val - this.#opts.step);
      if (next !== this.#val) {
        this.#val = next;
        this.#slider.value = this.#val;
        this.#input.value = this.#opts.formatLabel(this.#val);
        if (this.#opts.onChange)
          this.#opts.onChange(this.#val);
      }
    };

    this.#handlers.inputFocus = () => {
      this.#input.select();
    };

    this.#handlers.inputKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.#input.blur();
      }
    };

    this.#handlers.inputBlur = () => {
      const parsed = this.#opts.parseLabel(this.#input.value);
      if (parsed != null && !isNaN(parsed)) {
        const clamped = Math.max(this.#opts.min, Math.min(this.#opts.max, parsed));
        this.#val = clamped;
        this.#slider.value = this.#val;
        this.#input.value = this.#opts.formatLabel(this.#val);
        if (this.#opts.onChange)
          this.#opts.onChange(this.#val);
      } else
        this.#input.value = this.#opts.formatLabel(this.#val);
    };

    this.#slider.addEventListener('input', this.#handlers.sliderInput);
    this.#btnIn.addEventListener('click', this.#handlers.btnInClick);
    this.#btnOut.addEventListener('click', this.#handlers.btnOutClick);
    this.#input.addEventListener('focus', this.#handlers.inputFocus);
    this.#input.addEventListener('keydown', this.#handlers.inputKeydown);
    this.#input.addEventListener('blur', this.#handlers.inputBlur);
  }

  get value() { return this.#val; }

  set value(v) {
    this.#val = v;
    this.#slider.value = v;
    this.#input.value = this.#opts.formatLabel(v);
  }

  destroy() {
    this.#slider.removeEventListener('input', this.#handlers.sliderInput);
    this.#btnIn.removeEventListener('click', this.#handlers.btnInClick);
    this.#btnOut.removeEventListener('click', this.#handlers.btnOutClick);
    this.#input.removeEventListener('focus', this.#handlers.inputFocus);
    this.#input.removeEventListener('keydown', this.#handlers.inputKeydown);
    this.#input.removeEventListener('blur', this.#handlers.inputBlur);
    this.#container.remove();
  }

}

SZ.ZoomControl = ZoomControl;

})();
