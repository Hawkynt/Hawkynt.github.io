/* Persistence in localStorage: the versioned save (profile, classic run and any Bake-Off in
   progress, with the time it was written), loading with defaults filled in for missing fields,
   and the migration of the original game's save (key sz-cookie-clicker: cookies, lifetime
   total, clicks, buildings, upgrades, achievements and heavenly chips become the new run,
   profile and sugar crystals). The old key is left untouched. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const C = NS.constants;
  const E = NS.economy;
  const { BY_ID: B_BY_ID } = NS.buildingData;
  const { BY_ID: U_BY_ID, LEGACY } = NS.upgradeData;
  const { BY_ID: A_BY_ID } = NS.achievementData;

  function storage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_) {
      return null;
    }
  }

  /* deep-fill missing keys of obj from defaults (objects only, arrays and values are kept) */
  function fill(obj, defaults) {
    if (!obj || typeof obj !== 'object') return JSON.parse(JSON.stringify(defaults));
    for (const k in defaults) {
      const d = defaults[k];
      if (!(k in obj) || obj[k] === null && d !== null) obj[k] = d && typeof d === 'object' ? JSON.parse(JSON.stringify(d)) : d;
      else if (d && typeof d === 'object' && !Array.isArray(d) && typeof obj[k] === 'object') fill(obj[k], d);
    }
    return obj;
  }

  function cleanRun(run, profile) {
    if (!run) return null;
    run = fill(run, E.newRun(run.mode || 'classic', null));
    for (const id in run.buildings) if (!B_BY_ID[id]) delete run.buildings[id];
    for (const id in run.upgrades) if (!U_BY_ID[id]) delete run.upgrades[id];
    run.buffs = (run.buffs || []).filter(b => b && b.t > 0);
    if (!isFinite(run.cookies)) run.cookies = 0;
    run.stage = Math.max(run.stage, E.stageFor(run.baked));
    if (profile) profile.stageMax = Math.max(profile.stageMax, run.stage);
    return run;
  }

  function serialize(G) {
    return JSON.stringify({ v: C.SAVE_VERSION, savedAt: Date.now(), profile: G.profile, run: G.run, bake: G.bake });
  }

  function write(G) {
    const ls = storage();
    if (!ls || !G.run) return false;
    try {
      ls.setItem(C.STORAGE_KEY, serialize(G));
      return true;
    } catch (_) {
      return false;
    }
  }

  /* the original game's save -> { profile, run, savedAt } */
  function migrateLegacy(old) {
    const profile = E.newProfile();
    const run = E.newRun('classic', null);
    const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
    run.cookies = num(old.cookies);
    run.baked = Math.max(num(old.cookiesBaked), 0);
    profile.allTime = Math.max(num(old.cookiesBakedAllTime), run.baked);
    profile.stats.clicks = num(old.totalClicks);
    run.clicks = 0;
    profile.ascensions = num(old.prestigeCount);
    profile.crystals = Math.max(num(old.heavenlyChips), 0);
    if (old.buildings)
      for (const id in old.buildings) if (B_BY_ID[id]) run.buildings[id] = Math.max(0, Math.floor(num(old.buildings[id])));
    if (old.upgradePurchased)
      for (const id in old.upgradePurchased) if (old.upgradePurchased[id] && LEGACY[id]) run.upgrades[LEGACY[id]] = true;
    if (old.achievementUnlocked)
      for (const id in old.achievementUnlocked) if (old.achievementUnlocked[id] && A_BY_ID[id]) profile.achievements[id] = true;
    run.stage = E.stageFor(run.baked);
    run.noteMark = E.noteMark(run.baked);
    profile.stageMax = run.stage;
    for (let s = 0; s <= run.stage; ++s) profile.stagesSeen[s] = true;
    /* a veteran's welcome: notes for the progress already made */
    const welcome = 5 + Math.floor(E.achievementCount(profile) / 2) + run.noteMark;
    profile.notes = welcome;
    profile.notesEarned = welcome;
    profile.seenIntro = true;
    profile.migrated = { notes: welcome, at: Date.now() };
    return { profile: profile, run: run, bake: null, savedAt: num(old.lastSaveTime) || 0, migrated: true };
  }

  /* -> { profile, run, bake, savedAt, migrated } or null for a first start */
  function load() {
    const ls = storage();
    if (!ls) return null;
    let raw = null;
    try {
      raw = ls.getItem(C.STORAGE_KEY);
    } catch (_) {}
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d && d.profile) {
          const profile = fill(d.profile, E.newProfile());
          return { profile: profile, run: cleanRun(d.run, profile) || E.newRun('classic', profile), bake: cleanRun(d.bake, null),
            savedAt: d.savedAt || 0, migrated: false };
        }
      } catch (_) {}
    }
    let legacy = null;
    try {
      legacy = ls.getItem(C.LEGACY_KEY);
    } catch (_) {}
    if (legacy) {
      try {
        return migrateLegacy(JSON.parse(legacy));
      } catch (_) {}
    }
    return null;
  }

  function wipe() {
    const ls = storage();
    if (ls) try { ls.removeItem(C.STORAGE_KEY); } catch (_) {}
  }

  Object.assign(NS.save, { fill, cleanRun, serialize, write, migrateLegacy, load, wipe });
})();
