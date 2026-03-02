;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  class SpellCheckCore {

    #dictionaries = new Map();
    #customDictionary = new Set();
    #storageKey;
    #activeLanguage;

    constructor({ storageKey, activeLanguage }) {
      this.#storageKey = storageKey || 'sz-custom-dict';
      this.#activeLanguage = activeLanguage || 'auto';

      if (window.SZ_DICT_EN) {
        const words = Array.isArray(window.SZ_DICT_EN)
          ? window.SZ_DICT_EN.map(w => w.toLowerCase())
          : String(window.SZ_DICT_EN).split('\n').filter(w => w).map(w => w.toLowerCase());
        this.#dictionaries.set('en', new Set(words));
      }

      if (window.SZ_DICT_DE) {
        const words = Array.isArray(window.SZ_DICT_DE)
          ? window.SZ_DICT_DE.map(w => w.toLowerCase())
          : String(window.SZ_DICT_DE).split('\n').filter(w => w).map(w => w.toLowerCase());
        this.#dictionaries.set('de', new Set(words));
      }

      try {
        const saved = localStorage.getItem(this.#storageKey);
        if (saved)
          JSON.parse(saved).forEach(w => this.#customDictionary.add(w));
      } catch (_e) { /* ignore */ }
    }

    get activeLanguage() { return this.#activeLanguage; }
    set activeLanguage(lang) { this.#activeLanguage = lang; }

    get customWords() { return [...this.#customDictionary]; }

    get hasDictionary() { return this.#dictionaries.size > 0; }

    isWordMisspelled(word) {
      if (!word || word.length <= 1)
        return false;
      if (/^\d+$/.test(word))
        return false;
      if (/[A-Z]/.test(word) && word === word.toUpperCase() && word.length <= 5)
        return false;

      const lower = word.toLowerCase();

      if (this.#customDictionary.has(lower))
        return false;

      if (this.#activeLanguage === 'auto') {
        for (const [, dict] of this.#dictionaries)
          if (dict.has(lower))
            return false;
        return this.#dictionaries.size > 0;
      }

      const dict = this.#dictionaries.get(this.#activeLanguage);
      if (!dict)
        return false;
      return !dict.has(lower);
    }

    levenshtein(a, b) {
      const m = a.length, n = b.length;
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 0; i <= m; ++i)
        dp[i][0] = i;
      for (let j = 0; j <= n; ++j)
        dp[0][j] = j;
      for (let i = 1; i <= m; ++i)
        for (let j = 1; j <= n; ++j) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
      return dp[m][n];
    }

    getSuggestions(word, max = 5) {
      const lower = word.toLowerCase();
      const candidates = [];

      const dicts = this.#activeLanguage === 'auto'
        ? [...this.#dictionaries.values()]
        : [this.#dictionaries.get(this.#activeLanguage)].filter(Boolean);

      for (const dict of dicts) {
        for (const entry of dict) {
          if (Math.abs(entry.length - lower.length) > 2)
            continue;
          const dist = this.levenshtein(lower, entry);
          if (dist <= 2 && dist > 0)
            candidates.push({ word: entry, dist });
        }
      }

      candidates.sort((a, b) => a.dist - b.dist);
      return candidates.slice(0, max).map(c => c.word);
    }

    addToCustomDictionary(word) {
      const lower = word.toLowerCase();
      this.#customDictionary.add(lower);
      this.#persistCustomDict();
    }

    removeFromCustomDictionary(word) {
      const lower = word.toLowerCase();
      this.#customDictionary.delete(lower);
      this.#persistCustomDict();
    }

    #persistCustomDict() {
      try {
        localStorage.setItem(this.#storageKey, JSON.stringify([...this.#customDictionary]));
      } catch (_e) { /* ignore */ }
    }
  }

  SZ.SpellCheckCore = SpellCheckCore;
})();
