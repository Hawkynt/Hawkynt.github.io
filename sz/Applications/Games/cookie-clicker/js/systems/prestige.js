/* Ascension: sugar crystals waiting from the lifetime total (cube root of trillions), whether
   the bakery may ascend, and the reset itself - a fresh run (with Heirloom Starter cookies and
   Family Decor kept), the crystals, the Oracle Notes bonus and the ascension cinematic. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const E = NS.economy;
  const { UPGRADES } = NS.upgradeData;

  function pending() {
    return Math.max(0, E.crystalsFor(G.profile.allTime) - G.profile.crystals);
  }

  /* lifetime total needed for the next crystal */
  function nextCrystalAt() {
    const have = E.crystalsFor(G.profile.allTime);
    return Math.pow(have + 1, 3) * 1e12;
  }

  function canAscend() {
    return pending() >= 1 && !G.bake;
  }

  function ascend() {
    if (!canAscend()) return false;
    const p = G.profile;
    const gained = pending();
    p.crystals += gained;
    ++p.ascensions;
    const bonus = Math.round(E.treeStat(p, 'ascendNotes'));
    p.notes += bonus;
    p.notesEarned += bonus;
    const old = G.run;
    G.run = E.newRun('classic', p);
    if (E.treeStat(p, 'keepDecor') > 0)
      for (let i = 0; i < UPGRADES.length; ++i)
        if (UPGRADES[i].kind === 'deco' && old.upgrades[UPGRADES[i].id]) G.run.upgrades[UPGRADES[i].id] = true;
    NS.golden.clearAll();
    NS.production.invalidate();
    NS.production.refresh(true);
    G.ui.displayCookies = G.run.cookies;
    NS.cinematics.play('ascend', { gained: gained, bonus: bonus });
    NS.save.write(G);
    return gained;
  }

  Object.assign(NS.prestige, { pending, nextCrystalAt, canAscend, ascend });
})();
