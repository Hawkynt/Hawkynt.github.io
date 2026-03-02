;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  class FormatPainter {

    #buttonEl;
    #cursorTarget;
    #cursorClass;
    #activeClass;
    #onCapture;
    #onApply;
    #onDeactivate;
    #data = null;
    #sticky = false;
    #onKeyDown;

    constructor({ buttonEl, cursorTarget, cursorClass, activeClass, onCapture, onApply, onDeactivate }) {
      this.#buttonEl = buttonEl;
      this.#cursorTarget = cursorTarget;
      this.#cursorClass = cursorClass || 'format-painter-cursor';
      this.#activeClass = activeClass || 'active';
      this.#onCapture = onCapture;
      this.#onApply = onApply;
      this.#onDeactivate = onDeactivate || (() => {});

      this.#onKeyDown = (e) => {
        if (e.key === 'Escape' && this.#data) {
          e.preventDefault();
          this.deactivate();
        }
      };

      if (buttonEl) {
        buttonEl.addEventListener('click', () => {
          if (this.#data)
            this.deactivate();
          else
            this.activate(false);
        });
        buttonEl.addEventListener('dblclick', (e) => {
          e.preventDefault();
          if (!this.#data)
            this.activate(true);
          else
            this.#sticky = true;
        });
      }

      document.addEventListener('keydown', this.#onKeyDown);
    }

    get isActive() { return this.#data !== null; }
    get isSticky() { return this.#sticky; }

    activate(sticky) {
      const data = this.#onCapture();
      if (!data)
        return;
      this.#data = data;
      this.#sticky = !!sticky;
      if (this.#cursorTarget)
        this.#cursorTarget.classList.add(this.#cursorClass);
      if (this.#buttonEl)
        this.#buttonEl.classList.add(this.#activeClass);
    }

    deactivate() {
      this.#data = null;
      this.#sticky = false;
      if (this.#cursorTarget)
        this.#cursorTarget.classList.remove(this.#cursorClass);
      if (this.#buttonEl)
        this.#buttonEl.classList.remove(this.#activeClass);
      this.#onDeactivate();
    }

    tryApply() {
      if (!this.#data)
        return false;
      this.#onApply(this.#data);
      if (!this.#sticky)
        this.deactivate();
      return true;
    }
  }

  SZ.FormatPainter = FormatPainter;
})();
