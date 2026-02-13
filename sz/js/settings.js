;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const DEFAULTS = {
    skin: 'LUNAX',
    background: { src: 'assets/backgrounds/default.jpg', mode: 'cover' },
    animations: true,
    taskbarPosition: 'bottom',
    'cursor.shadow': false,
    'cursor.trail': false,
    'cursor.trailLen': 5,
    'cursor.theme': 'default',
  };

  class Settings {
    #prefix = 'sz-';

    get(key) {
      const raw = localStorage.getItem(this.#prefix + key);
      if (raw === null)
        return DEFAULTS[key] ?? null;

      try { return JSON.parse(raw); } catch { return raw; }
    }

    set(key, value) {
      localStorage.setItem(this.#prefix + key, JSON.stringify(value));
    }

    getAll() {
      const result = { ...DEFAULTS };
      for (const key of Object.keys(DEFAULTS)) {
        const stored = this.get(key);
        if (stored !== null && stored !== undefined)
          result[key] = stored;
      }
      return result;
    }
  }

  SZ.Settings = Settings;
})();
