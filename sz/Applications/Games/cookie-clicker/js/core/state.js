/* S, the one shared mutable state object: the game state string, the cookie and
   lifetime counters, the multiplier and prestige fields, the effect timers, the
   scroll/ripple/tooltip/mouse bookkeeping, the per-building count and multiplier
   maps, the purchased/unlocked maps and the background crumb particles (seeded
   once, at load). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const C = NS.constants;

  NS.state = NS.state || {
    state: C.STATE_PLAYING,
    cookies: 0,
    displayCookies: 0,
    cookiesBaked: 0,
    cookiesBakedAllTime: 0,
    totalClicks: 0,
    clickValue: 1,
    clickMultiplier: 1,
    globalMultiplier: 1,
    heavenlyChips: 0,
    prestigeCount: 0,
    cps: 0,
    animFrameId: null,
    lastTimestamp: 0,
    dpr: 1,
    cookieScale: 1,
    cookieScaleV: 0,
    achievementCheckTimer: 0,
    autoSaveTimer: 0,
    purchaseGlowTimer: 0,
    purchaseGlowIndex: -1,
    confettiTimer: 0,
    lastMilestone: 0,
    buildingScrollOffset: 0,
    clickRipple: null,
    tooltip: null,
    mouseX: 0,
    mouseY: 0,
    buildings: {},
    buildingMultipliers: {},
    upgradePurchased: {},
    achievementUnlocked: {},
    bgCrumbs: []
  };

  const S = NS.state;
  const BUILDING_DEFS = NS.buildingDefs;
  const UPGRADE_DEFS = NS.upgradeDefs;
  const ACHIEVEMENT_DEFS = NS.achievementDefs;
  const COOKIE_CX = C.COOKIE_CX;
  const CANVAS_H = C.CANVAS_H;

  const buildings = S.buildings;
  const buildingMultipliers = S.buildingMultipliers;
  for (const def of BUILDING_DEFS) {
    buildings[def.id] = 0;
    buildingMultipliers[def.id] = 1;
  }

  const upgradePurchased = S.upgradePurchased;
  for (const def of UPGRADE_DEFS)
    upgradePurchased[def.id] = false;

  const achievementUnlocked = S.achievementUnlocked;
  for (const def of ACHIEVEMENT_DEFS)
    achievementUnlocked[def.id] = false;

  /* ── Background crumb particles ── */
  const bgCrumbs = S.bgCrumbs;
  for (let i = 0; i < 15; ++i)
    bgCrumbs.push({
      x: COOKIE_CX + (Math.random() - 0.5) * 250,
      y: Math.random() * CANVAS_H,
      r: 1 + Math.random() * 2,
      speed: 8 + Math.random() * 12,
      alpha: 0.15 + Math.random() * 0.25
    });
})();
