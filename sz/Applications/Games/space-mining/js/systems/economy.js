/* The economy: fluctuating market prices, cargo bookkeeping, selling at the
   station and the upgrade shop math. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.economy;

  /* ── Market Prices ── */
  E.randomizePrices = function randomizePrices() {
    for (const key of T.ORE_KEYS) {
      const base = T.ORE_TYPES[key].basePrice;
      const priceMultiplier = 0.7 + Math.random() * 0.6;
      S.marketPrices[key] = Math.round(base * priceMultiplier);
    }
  };

  /* ── Cargo ── */
  E.resetCargo = function resetCargo() {
    S.cargo = {};
    for (const key of T.ORE_KEYS)
      S.cargo[key] = 0;
  };

  E.totalCargo = function totalCargo() {
    let sum = 0;
    for (const key of T.ORE_KEYS)
      sum += S.cargo[key];
    return Math.round(sum * 10) / 10;
  };

  E.cargoIsFull = function cargoIsFull() {
    return E.totalCargo() >= S.cargoMax;
  };

  /* ── Upgrades ── */
  E.getUpgradeCost = function getUpgradeCost(type) {
    const def = T.UPGRADE_DEFS[type];
    return Math.round(def.baseCost * Math.pow(def.costMult, S.upgradeLevels[type]));
  };

  E.canAffordUpgrade = function canAffordUpgrade(type) {
    return S.credits >= E.getUpgradeCost(type) && S.upgradeLevels[type] < T.UPGRADE_DEFS[type].maxLevel;
  };

  E.isMaxLevel = function isMaxLevel(type) {
    return S.upgradeLevels[type] >= T.UPGRADE_DEFS[type].maxLevel;
  };

  E.buyUpgrade = function buyUpgrade(type) {
    if (!E.canAffordUpgrade(type)) {
      SZ.GameAudio.play('error');
      return false;
    }
    const cost = E.getUpgradeCost(type);
    S.credits -= cost;
    ++S.upgradeLevels[type];
    E.applyUpgrades();
    D.floatingText.add(C.CANVAS_W / 2, C.CANVAS_H / 2 - 60, T.UPGRADE_DEFS[type].label + ' upgraded!', { color: '#4af', font: 'bold 14px sans-serif' });
    SZ.GameAudio.play('levelup');
    return true;
  };

  E.applyUpgrades = function applyUpgrades() {
    S.drillSpeed = C.BASE_DRILL_RATE * (1 + S.upgradeLevels.drillSpeed * 0.4);
    S.cargoMax = C.BASE_CARGO_MAX + S.upgradeLevels.cargoCapacity * 5;
    S.thrustPower = C.BASE_THRUST * (1 + S.upgradeLevels.enginePower * 0.3);
    S.hullMax = C.BASE_HULL + S.upgradeLevels.hullStrength * 20;
    S.scannerLevel = S.upgradeLevels.scannerRange;
  };

  /* ── Sell ── */
  E.sellCargo = function sellCargo() {
    if (E.totalCargo() <= 0) return;
    let profit = 0;
    for (const key of T.ORE_KEYS) {
      if (S.cargo[key] > 0) {
        const value = Math.round(S.cargo[key] * S.marketPrices[key]);
        profit += value;
        S.cargo[key] = 0;
      }
    }
    S.credits += profit;
    if (profit > 0) {
      D.floatingText.add(C.CANVAS_W / 2, C.CANVAS_H / 2 - 30, '+' + profit + ' credits', { color: '#0f0', font: 'bold 18px sans-serif' });
      SZ.GameAudio.play('coin');
    }
    E.randomizePrices();
  };
})();
