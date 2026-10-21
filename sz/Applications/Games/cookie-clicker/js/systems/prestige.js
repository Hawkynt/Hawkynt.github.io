/* Prestige: heavenly chips from lifetime cookies and the reset that keeps the
   chips, achievements and lifetime counters while wiping the run. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  const { CANVAS_W } = NS.constants;
  const BUILDING_DEFS = NS.buildingDefs;
  const UPGRADE_DEFS = NS.upgradeDefs;
  const particles = NS.dom.particles;
  /* ── Prestige ── */
  function getHeavenlyChipsFromLifetime() {
    return Math.floor(Math.cbrt(S.cookiesBakedAllTime / 1e12));
  }

  function performPrestige() {
    const newChips = getHeavenlyChipsFromLifetime() - S.heavenlyChips;
    if (newChips <= 0)
      return;
    S.heavenlyChips += newChips;
    ++S.prestigeCount;

    S.cookies = 0;
    S.cookiesBaked = 0;
    S.displayCookies = 0;
    S.clickMultiplier = 1;
    S.globalMultiplier = 1;
    for (const def of BUILDING_DEFS) {
      S.buildings[def.id] = 0;
      S.buildingMultipliers[def.id] = 1;
    }
    for (const def of UPGRADE_DEFS)
      S.upgradePurchased[def.id] = false;

    S.buildingScrollOffset = 0;
    NS.economy.recalcCPS();
    NS.economy.recalcClickValue();
    S.confettiTimer = 2;
    SZ.GameAudio.play('win', { pitch: 1.5 });
    for (let i = 0; i < 40; ++i)
      particles.burst(Math.random() * CANVAS_W, -10, 2, { r: 200, g: 200, b: 255 }, 2);
  }

  Object.assign(NS.prestige, { getHeavenlyChipsFromLifetime, performPrestige });
})();
