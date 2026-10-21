/* The economy: global bonus stacking (upgrades, heavenly chips, achievements),
   CPS recalculation and what-if previews for tooltips, click value, owned-count
   snapshots and exponential building costs. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  const { COST_SCALE } = NS.constants;
  const BUILDING_DEFS = NS.buildingDefs;
  /* ── CPS Calculation ── */
  function getGlobalBonus() {
    const achievementBonus = 1 + Object.values(S.achievementUnlocked).filter(Boolean).length * 0.01;
    return S.globalMultiplier * (1 + S.heavenlyChips * 0.01) * achievementBonus;
  }

  function recalcCPS() {
    let total = 0;
    for (const def of BUILDING_DEFS)
      total += S.buildings[def.id] * def.baseCPS * S.buildingMultipliers[def.id];
    total *= getGlobalBonus();
    S.cps = total;
  }

  /* ── Per-building CPS (for tooltip) ── */
  function getBuildingCPSPerUnit(def) {
    return def.baseCPS * S.buildingMultipliers[def.id] * getGlobalBonus();
  }

  function getBuildingTotalCPS(def) {
    return S.buildings[def.id] * getBuildingCPSPerUnit(def);
  }

  /* ── Simulate CPS after buying one more building ── */
  function getCPSAfterBuyingBuilding(defIndex) {
    const def = BUILDING_DEFS[defIndex];
    let total = 0;
    for (const d of BUILDING_DEFS) {
      const count = S.buildings[d.id] + (d.id === def.id ? 1 : 0);
      total += count * d.baseCPS * S.buildingMultipliers[d.id];
    }
    total *= getGlobalBonus();
    return total;
  }

  /* ── Simulate CPS after buying an upgrade ── */
  function getCPSAfterBuyingUpgrade(upgDef) {
    const savedMult = S.buildingMultipliers[upgDef.target];
    const savedClick = S.clickMultiplier;
    const savedGlobal = S.globalMultiplier;

    if (upgDef.target === 'click')
      S.clickMultiplier *= upgDef.multiplier;
    else if (upgDef.target === 'global')
      S.globalMultiplier *= upgDef.multiplier;
    else if (upgDef.target in S.buildingMultipliers)
      S.buildingMultipliers[upgDef.target] *= upgDef.multiplier;

    let total = 0;
    for (const d of BUILDING_DEFS)
      total += S.buildings[d.id] * d.baseCPS * S.buildingMultipliers[d.id];
    const bonus = getGlobalBonus();
    total *= bonus;

    // Restore
    if (upgDef.target === 'click')
      S.clickMultiplier = savedClick;
    else if (upgDef.target === 'global')
      S.globalMultiplier = savedGlobal;
    else if (upgDef.target in S.buildingMultipliers)
      S.buildingMultipliers[upgDef.target] = savedMult;

    return total;
  }

  function getClickValueAfterUpgrade(upgDef) {
    const savedClick = S.clickMultiplier;
    const savedGlobal = S.globalMultiplier;

    if (upgDef.target === 'click')
      S.clickMultiplier *= upgDef.multiplier;
    else if (upgDef.target === 'global')
      S.globalMultiplier *= upgDef.multiplier;

    const val = S.clickMultiplier * S.globalMultiplier * (1 + S.heavenlyChips * 0.01);

    S.clickMultiplier = savedClick;
    S.globalMultiplier = savedGlobal;
    return val;
  }

  /* ── Click Value Calculation ── */
  function recalcClickValue() {
    S.clickValue = S.clickMultiplier * S.globalMultiplier * (1 + S.heavenlyChips * 0.01);
  }

  /* ── Owned Counts Snapshot ── */
  function getOwnedCounts() {
    const counts = {};
    for (const def of BUILDING_DEFS)
      counts[def.id] = S.buildings[def.id];
    return counts;
  }

  /* ── Building Cost ── */
  function buildingCost(def) {
    return Math.ceil(def.baseCost * Math.pow(COST_SCALE, S.buildings[def.id]));
  }

  Object.assign(NS.economy, { getGlobalBonus, recalcCPS, getBuildingCPSPerUnit,
    getBuildingTotalCPS, getCPSAfterBuyingBuilding, getCPSAfterBuyingUpgrade,
    getClickValueAfterUpgrade, recalcClickValue, getOwnedCounts, buildingCost });
})();
