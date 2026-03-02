;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  class FindReplace {

    #panelEl;
    #findInput;
    #replaceInput;
    #replaceRow;
    #statusEl;
    #caseSensitive;
    #wholeWord;
    #regexToggle;
    #callbacks;
    #matchCount = 0;
    #currentMatch = -1;

    constructor({ panelEl, callbacks }) {
      this.#panelEl = panelEl;
      this.#callbacks = callbacks || {};

      this.#findInput = panelEl.querySelector('[data-fr="find-input"]');
      this.#replaceInput = panelEl.querySelector('[data-fr="replace-input"]');
      this.#replaceRow = panelEl.querySelector('[data-fr="replace-row"]');
      this.#statusEl = panelEl.querySelector('[data-fr="status"]');
      this.#caseSensitive = panelEl.querySelector('[data-fr="case-sensitive"]');
      this.#wholeWord = panelEl.querySelector('[data-fr="whole-word"]');
      this.#regexToggle = panelEl.querySelector('[data-fr="regex"]');

      this.#wireButtons();
    }

    #wireButtons() {
      const wire = (sel, fn) => {
        const el = this.#panelEl.querySelector(sel);
        if (el)
          el.addEventListener('click', fn);
      };

      wire('[data-fr="find-next"]', () => this.findNext());
      wire('[data-fr="find-prev"]', () => this.findPrev());
      wire('[data-fr="replace-one"]', () => this.replaceOne());
      wire('[data-fr="replace-all"]', () => this.replaceAll());
      wire('[data-fr="close"]', () => this.hide());

      const tabs = this.#panelEl.querySelectorAll('[data-fr-tab]');
      for (const tab of tabs)
        tab.addEventListener('click', () => this.show(tab.dataset.frTab));

      if (this.#findInput)
        this.#findInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.findNext();
          } else if (e.key === 'Escape')
            this.hide();
        });

      if (this.#replaceInput)
        this.#replaceInput.addEventListener('keydown', (e) => {
          if (e.key === 'Escape')
            this.hide();
        });
    }

    get matchCount() { return this.#matchCount; }
    get currentMatch() { return this.#currentMatch; }

    get searchTerm() { return this.#findInput ? this.#findInput.value : ''; }
    get replaceTerm() { return this.#replaceInput ? this.#replaceInput.value : ''; }

    get options() {
      return {
        caseSensitive: this.#caseSensitive ? this.#caseSensitive.checked : false,
        wholeWord: this.#wholeWord ? this.#wholeWord.checked : false,
        regex: this.#regexToggle ? this.#regexToggle.checked : false
      };
    }

    buildRegex(flags) {
      const term = this.searchTerm;
      if (!term)
        return null;
      const opts = this.options;
      try {
        let pattern = opts.regex ? term : term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (opts.wholeWord)
          pattern = '\\b' + pattern + '\\b';
        let f = flags || 'g';
        if (!opts.caseSensitive && !f.includes('i'))
          f += 'i';
        return new RegExp(pattern, f);
      } catch (e) {
        this.#setStatus('Invalid regex: ' + e.message);
        return null;
      }
    }

    show(mode) {
      mode = mode || 'find';
      this.#panelEl.classList.add('visible');
      if (this.#replaceRow) {
        const isReplace = mode === 'replace';
        this.#replaceRow.style.display = isReplace ? '' : 'none';
        const replaceOne = this.#panelEl.querySelector('[data-fr="replace-one"]');
        const replaceAll = this.#panelEl.querySelector('[data-fr="replace-all"]');
        if (replaceOne)
          replaceOne.style.display = isReplace ? '' : 'none';
        if (replaceAll)
          replaceAll.style.display = isReplace ? '' : 'none';
      }

      const tabs = this.#panelEl.querySelectorAll('[data-fr-tab]');
      for (const tab of tabs)
        tab.classList.toggle('active', tab.dataset.frTab === mode);

      if (this.#findInput)
        this.#findInput.focus();
    }

    hide() {
      this.#panelEl.classList.remove('visible');
      this.#matchCount = 0;
      this.#currentMatch = -1;
      this.#setStatus('');
      if (this.#callbacks.onClose)
        this.#callbacks.onClose();
    }

    findNext() {
      const term = this.searchTerm;
      if (!term) {
        this.#setStatus('');
        return;
      }
      if (this.#callbacks.search) {
        const matches = this.#callbacks.search(term, this.options);
        this.#matchCount = matches ? matches.length : 0;
        if (this.#matchCount > 0) {
          this.#currentMatch = Math.min(this.#currentMatch + 1, this.#matchCount - 1);
          if (this.#callbacks.highlightMatch)
            this.#callbacks.highlightMatch(matches[this.#currentMatch]);
          this.#setStatus('Match ' + (this.#currentMatch + 1) + ' of ' + this.#matchCount);
        } else {
          this.#currentMatch = -1;
          this.#setStatus('No matches found');
        }
      }
    }

    findPrev() {
      const term = this.searchTerm;
      if (!term) {
        this.#setStatus('');
        return;
      }
      if (this.#callbacks.search) {
        const matches = this.#callbacks.search(term, this.options);
        this.#matchCount = matches ? matches.length : 0;
        if (this.#matchCount > 0) {
          this.#currentMatch = Math.max(this.#currentMatch - 1, 0);
          if (this.#callbacks.highlightMatch)
            this.#callbacks.highlightMatch(matches[this.#currentMatch]);
          this.#setStatus('Match ' + (this.#currentMatch + 1) + ' of ' + this.#matchCount);
        } else {
          this.#currentMatch = -1;
          this.#setStatus('No matches found');
        }
      }
    }

    replaceOne() {
      const term = this.searchTerm;
      const replacement = this.replaceTerm;
      if (!term)
        return;
      if (this.#callbacks.replaceMatch) {
        const matches = this.#callbacks.search ? this.#callbacks.search(term, this.options) : [];
        if (matches && matches.length > 0 && this.#currentMatch >= 0 && this.#currentMatch < matches.length) {
          this.#callbacks.replaceMatch(matches[this.#currentMatch], replacement);
          this.findNext();
        } else
          this.findNext();
      }
    }

    replaceAll() {
      const term = this.searchTerm;
      const replacement = this.replaceTerm;
      if (!term)
        return;
      if (this.#callbacks.replaceAll) {
        const count = this.#callbacks.replaceAll(term, replacement, this.options);
        this.#setStatus('Replaced ' + (count || 0) + ' occurrence(s)');
        this.#matchCount = 0;
        this.#currentMatch = -1;
      }
    }

    #setStatus(text) {
      if (this.#statusEl)
        this.#statusEl.textContent = text;
    }
  }

  SZ.FindReplace = FindReplace;
})();
