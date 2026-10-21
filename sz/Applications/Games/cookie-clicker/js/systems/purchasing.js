/* Buying and clicking: building and upgrade purchases with their affordability
   feedback, and the big-cookie click with its ripple, squish and floating text. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  const { CANVAS_W, CANVAS_H, BLDG_ROW_TOTAL, COOKIE_CX, COOKIE_CY, COOKIE_R } = NS.constants;
  const BUILDING_DEFS = NS.buildingDefs;
  const UPGRADE_DEFS = NS.upgradeDefs;
  const particles = NS.dom.particles;
  const floatingText = NS.dom.floatingText;
  /* ── Buy Building ── */
  function buyBuilding(defIndex) {
    const def = BUILDING_DEFS[defIndex];
    const cost = NS.economy.buildingCost(def);
    if (S.cookies >= cost) {
      S.cookies -= cost;
      ++S.buildings[def.id];
      NS.economy.recalcCPS();
      S.purchaseGlowTimer = 0.6;
      S.purchaseGlowIndex = defIndex;
      particles.burst(650, 80 + defIndex * BLDG_ROW_TOTAL, 8, { r: 255, g: 215, b: 0 }, 0.6);
      SZ.GameAudio.play('coin');
    } else
      SZ.GameAudio.play('error', { volume: 0.5 });
  }

  /* ── Buy Upgrade ── */
  function buyUpgrade(defIndex) {
    const def = UPGRADE_DEFS[defIndex];
    if (S.upgradePurchased[def.id])
      return;
    if (S.cookies < def.cost) {
      SZ.GameAudio.play('error', { volume: 0.5 });
      return;
    }
    S.cookies -= def.cost;
    S.upgradePurchased[def.id] = true;
    if (def.target === 'click')
      S.clickMultiplier *= def.multiplier;
    else if (def.target === 'global')
      S.globalMultiplier *= def.multiplier;
    else
      S.buildingMultipliers[def.target] *= def.multiplier;
    NS.economy.recalcCPS();
    NS.economy.recalcClickValue();
    particles.burst(400, 300, 12, { r: 180, g: 100, b: 255 }, 0.8);
    SZ.GameAudio.play('powerup');
  }
  /* ── Cookie Click ── */
  function handleCookieClick(x, y) {
    S.cookies += S.clickValue;
    S.cookiesBaked += S.clickValue;
    S.cookiesBakedAllTime += S.clickValue;
    ++S.totalClicks;

    particles.burst(x || CANVAS_W / 2, y || CANVAS_H / 2, 8, { r: 210, g: 160, b: 60 }, 0.5);
    floatingText.add(x || CANVAS_W / 2, (y || CANVAS_H / 2) - 30, '+' + NS.format.formatNumber(S.clickValue), { color: '#fff' });
    S.clickRipple = { x: COOKIE_CX, y: COOKIE_CY, radius: COOKIE_R * 0.5, alpha: 0.7 };
    particles.burst(COOKIE_CX, COOKIE_CY, 5, { r: 160, g: 120, b: 60 }, 0.4);
    S.cookieScale = 0.95;
    S.cookieScaleV = 0.3;
    SZ.GameAudio.play('bounce', { pitch: 0.9 + Math.random() * 0.3, volume: 0.5 });
  }

  Object.assign(NS.purchasing, { buyBuilding, buyUpgrade, handleCookieClick });
})();
