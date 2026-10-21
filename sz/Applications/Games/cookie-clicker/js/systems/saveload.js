/* Persistence: the localStorage save, the load with capped offline progress, and
   the New Game reset. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  const { STORAGE_KEY, MAX_OFFLINE_SECONDS, OFFLINE_EFFICIENCY, CANVAS_W, CANVAS_H } = NS.constants;
  const BUILDING_DEFS = NS.buildingDefs;
  const UPGRADE_DEFS = NS.upgradeDefs;
  const ACHIEVEMENT_DEFS = NS.achievementDefs;
  const floatingText = NS.dom.floatingText;
  /* ── Save / Load ── */
  function saveGame() {
    try {
      const data = {
        cookies: S.cookies, cookiesBaked: S.cookiesBaked, cookiesBakedAllTime: S.cookiesBakedAllTime, totalClicks: S.totalClicks,
        clickMultiplier: S.clickMultiplier, globalMultiplier: S.globalMultiplier, heavenlyChips: S.heavenlyChips, prestigeCount: S.prestigeCount,
        buildings: { ...S.buildings },
        buildingMultipliers: { ...S.buildingMultipliers },
        upgradePurchased: { ...S.upgradePurchased },
        achievementUnlocked: { ...S.achievementUnlocked },
        lastMilestone: S.lastMilestone,
        lastSaveTime: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }
  function loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw)
        return;
      const data = JSON.parse(raw);
      S.cookies = data.cookies || 0;
      S.cookiesBaked = data.cookiesBaked || 0;
      S.cookiesBakedAllTime = data.cookiesBakedAllTime || 0;
      S.totalClicks = data.totalClicks || 0;
      S.clickMultiplier = data.clickMultiplier || 1;
      S.globalMultiplier = data.globalMultiplier || 1;
      S.heavenlyChips = data.heavenlyChips || 0;
      S.prestigeCount = data.prestigeCount || 0;
      S.lastMilestone = data.lastMilestone || 0;
      if (data.buildings)
        for (const k of Object.keys(data.buildings))
          if (k in S.buildings)
            S.buildings[k] = data.buildings[k];
      if (data.buildingMultipliers)
        for (const k of Object.keys(data.buildingMultipliers))
          if (k in S.buildingMultipliers)
            S.buildingMultipliers[k] = data.buildingMultipliers[k];
      if (data.upgradePurchased)
        for (const k of Object.keys(data.upgradePurchased))
          if (k in S.upgradePurchased)
            S.upgradePurchased[k] = data.upgradePurchased[k];
      if (data.achievementUnlocked)
        for (const k of Object.keys(data.achievementUnlocked))
          if (k in S.achievementUnlocked)
            S.achievementUnlocked[k] = data.achievementUnlocked[k];

      NS.economy.recalcCPS();
      NS.economy.recalcClickValue();
      S.displayCookies = S.cookies;

      if (data.lastSaveTime) {
        const elapsed = Math.min((Date.now() - data.lastSaveTime) / 1000, MAX_OFFLINE_SECONDS);
        if (elapsed > 10) {
          const offlineCookies = elapsed * S.cps * OFFLINE_EFFICIENCY;
          S.cookies += offlineCookies;
          S.cookiesBaked += offlineCookies;
          S.cookiesBakedAllTime += offlineCookies;
          if (offlineCookies > 0)
            floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Welcome back! +' + NS.format.formatNumber(offlineCookies), { color: '#7ec8e3', decay: 0.007 });
        }
      }
    } catch (_) {}
  }
  /* ── New Game ── */
  function newGame() {
    S.cookies = 0;
    S.displayCookies = 0;
    S.cookiesBaked = 0;
    S.cookiesBakedAllTime = 0;
    S.totalClicks = 0;
    S.clickValue = 1;
    S.clickMultiplier = 1;
    S.globalMultiplier = 1;
    S.heavenlyChips = 0;
    S.prestigeCount = 0;
    S.cps = 0;
    S.lastMilestone = 0;
    S.buildingScrollOffset = 0;
    for (const def of BUILDING_DEFS) {
      S.buildings[def.id] = 0;
      S.buildingMultipliers[def.id] = 1;
    }
    for (const def of UPGRADE_DEFS)
      S.upgradePurchased[def.id] = false;
    for (const def of ACHIEVEMENT_DEFS)
      S.achievementUnlocked[def.id] = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    NS.economy.recalcCPS();
    NS.economy.recalcClickValue();
  }

  Object.assign(NS.saveload, { saveGame, loadGame, newGame });
})();
