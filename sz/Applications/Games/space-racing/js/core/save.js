/*
 * Persistence: high scores, the versioned career save (v2), migration of the old
 * credits/upgrades save, and the old upgrade cost formula used by that migration.
 * Owns the localStorage format; reads and writes G.save and G.highScores.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { STORAGE_HIGHSCORES, STORAGE_CREDITS, STORAGE_UPGRADES, STORAGE_SELECTED_SHIP, STORAGE_SAVE,
    MAX_HIGH_SCORES } = NS.constants;
  const { SHIP_DEFS, UPGRADE_DEFS } = NS.defs;
  const { formatTime } = NS.util;
  const { highScoresBody } = NS.runtime;

  let shipUpgrades = {};

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw)
        G.highScores = JSON.parse(raw);
    } catch (_) {
      G.highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(G.highScores));
    } catch (_) {}
  }

  function defaultSave() {
    return {
      version: 2,
      credits: 0,
      selectedShip: 'falcon',
      unlockedShips: ['falcon'],
      tree: {},
      trophies: {},
      cupProgress: null,
      bestLaps: {},
      unlockedTracks: [],
      stats: { races: 0, wins: 0 }
    };
  }

  /* The old save kept credits, per-ship upgrade levels and a ship index; the
     upgrade levels are paid back as credits so nothing is lost. */
  function migrateOldSave() {
    const fresh = defaultSave();
    let oldCredits = 0;
    try {
      const raw = localStorage.getItem(STORAGE_CREDITS);
      if (raw)
        oldCredits = Number(JSON.parse(raw)) || 0;
    } catch (_) {}

    let oldUpgrades = {};
    try {
      const raw = localStorage.getItem(STORAGE_UPGRADES);
      if (raw)
        oldUpgrades = JSON.parse(raw) || {};
    } catch (_) {}

    let refund = 0;
    for (const key in oldUpgrades) {
      const colon = key.indexOf(':');
      if (colon < 0) continue;
      const upg = UPGRADE_DEFS.find(u => u.id === key.slice(colon + 1));
      if (!upg) continue;
      const level = oldUpgrades[key] | 0;
      for (let l = 0; l < level; ++l)
        refund += getUpgradeCost(upg, l);
    }

    let oldShipIndex = 0;
    try {
      const raw = localStorage.getItem(STORAGE_SELECTED_SHIP);
      if (raw != null)
        oldShipIndex = JSON.parse(raw);
    } catch (_) {}

    fresh.credits = Math.max(0, Math.round(oldCredits + refund));
    const usedShip = SHIP_DEFS[oldShipIndex];
    if (usedShip) {
      fresh.selectedShip = usedShip.id;
      if (usedShip.id !== 'falcon')
        fresh.unlockedShips.push(usedShip.id);
    }
    return fresh;
  }

  function loadSave() {
    let stored = null;
    try {
      const raw = localStorage.getItem(STORAGE_SAVE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.version === 2)
          stored = parsed;
      }
    } catch (_) {
      stored = null;
    }
    if (stored) {
      G.save = Object.assign(defaultSave(), stored);
      return;
    }
    G.save = migrateOldSave();
    writeSave();
  }

  function writeSave() {
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(G.save));
    } catch (_) {}
  }

  function getUpgradeLevel(shipId, upgradeId) {
    const key = shipId + ':' + upgradeId;
    return shipUpgrades[key] || 0;
  }

  function getUpgradeCost(upgradeDef, currentLevel) {
    return Math.floor(upgradeDef.costBase * Math.pow(upgradeDef.costScale, currentLevel));
  }

  function addHighScore(time, trackName) {
    G.highScores.push({ time, track: trackName });
    G.highScores.sort((a, b) => a.time - b.time);
    if (G.highScores.length > MAX_HIGH_SCORES)
      G.highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < G.highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${formatTime(G.highScores[i].time)}</td><td>${G.highScores[i].track}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!G.highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  Object.assign(NS.module('save'), {
    loadHighScores, saveHighScores, defaultSave, loadSave, writeSave, addHighScore, renderHighScores
  });
})();
