;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  const DEFAULTS = {
    skin: 'LUNAX',
    background: { src: '/system/wallpapers/default.jpg', mode: 'cover' },
    animations: true,
    taskbarPosition: 'bottom',
    'cursor.shadow': false,
    'cursor.trail': false,
    'cursor.trailLen': 5,
    'cursor.theme': 'default',
    'snap.enabled': true,
    'snap.mode': 'aquasnap',
    'snap.magnetEnabled': true,
    'snap.magnetDistance': 10,
    'snap.magnetScreenEdges': true,
    'snap.magnetOuterEdges': true,
    'snap.magnetInnerEdges': false,
    'snap.magnetCorners': true,
    'snap.magnetDisableFast': false,
    'snap.magnetSpeedThreshold': 1500,
    'snap.stretchMode': 'aquastretch',
    'snap.stretchVertical': true,
    'snap.stretchHorizontal': true,
    'snap.stretchDiagonal': true,
    'snap.stretchTarget': 'nearest',
    'snap.glueEnabled': true,
    'snap.glueCtrlDrag': true,
    'snap.glueCtrlResize': true,
    'snap.tabEnabled': true,
    'snap.tabAutoHide': true,
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
