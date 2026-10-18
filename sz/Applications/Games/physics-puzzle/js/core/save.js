;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * Persistence and what derives from the save: loading and writing it to
   * localStorage, the stats the Tech Tree grants, the equipped ball skin and
   * the local date the Daily Challenge runs on. Owns G.save and G.stats;
   * reads G.run to refresh its Rubber Core.
   */

  const G = NS.G;
  const Prog = G.Prog;
  const STORAGE_SAVE = NS.C.STORAGE_SAVE;

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_SAVE);
      G.save = Prog.migrate(raw ? JSON.parse(raw) : null);
    } catch (_) {
      G.save = Prog.defaultSave();
    }
  }

  function writeSave() {
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(G.save));
    } catch (_) {}
  }

  function refreshStats() {
    G.stats = Prog.computeStats(G.save);
    if (G.run && G.run.att)
      G.run.att.rubber = G.stats.rubber;
  }

  function localDate() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function currentSkin() {
    return Prog.SKINS.find(s => s.id === G.save.skin) || Prog.SKINS[0];
  }

  G.writeSave = writeSave;
  G.refreshStats = refreshStats;
  G.localDate = localDate;
  G.currentSkin = currentSkin;

  NS.save = { loadSave: loadSave, writeSave: writeSave, refreshStats: refreshStats, localDate: localDate, currentSkin: currentSkin };
})();
