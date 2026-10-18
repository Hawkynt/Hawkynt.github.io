/*
 * Progression rules: Workshop tree levels, requirements and purchases, tree bonuses
 * on ship stats, ship unlocks and purchases. Reads and writes G.save / G.credits.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { SHIP_DEFS, TREE } = NS.defs;
  const { writeSave } = NS.save;

  /* Hook for the tech tree: it adds its bonuses to the ship's own stats here. */
  function applyTreeBonuses(stats) {
    stats.speed *= 1 + 0.04 * treeLevel('e_speed') + 0.06 * treeLevel('e_fusion');
    stats.accel *= 1 + 0.05 * treeLevel('e_accel') + 0.06 * treeLevel('e_fusion');
    stats.handling *= 1 + 0.05 * treeLevel('h_gyro');
    stats.boost *= 1 + 0.06 * treeLevel('b_tank');
    return stats;
  }

  /* ── Tree queries: level, requirements, purchasability ── */

  function treeLevel(id) {
    return G.save.tree[id] || 0;
  }

  function treeNodeById(id) {
    return TREE.nodes.find(n => n.id === id) || null;
  }

  function treeReqMet(node) {
    for (let i = 0; i < node.req.length; ++i)
      if (treeLevel(node.req[i][0]) < node.req[i][1])
        return false;
    return true;
  }

  function treeTrophyMet(node) {
    return !node.trophy || !!G.save.trophies[node.trophy];
  }

  function nodeState(node) {
    const level = treeLevel(node.id);
    if (level >= node.costs.length)
      return 'maxed';
    if (!treeReqMet(node) || !treeTrophyMet(node))
      return 'locked';
    if (G.save.credits < node.costs[level])
      return 'expensive';
    return level > 0 ? 'owned' : 'available';
  }

  function buyNode(node) {
    const st = nodeState(node);
    if (st !== 'available' && st !== 'owned') {
      SZ.GameAudio.play('error');
      return false;
    }
    const level = treeLevel(node.id);
    G.save.credits -= node.costs[level];
    G.credits = G.save.credits;
    G.save.tree[node.id] = level + 1;
    writeSave();
    SZ.GameAudio.play('coin');
    SZ.GameAudio.play('powerup');
    return true;
  }

  function getEffectiveStats(shipDef) {
    const stats = { speed: shipDef.stats.speed, accel: shipDef.stats.accel, handling: shipDef.stats.handling, boost: shipDef.stats.boost };
    return applyTreeBonuses(stats);
  }

  /* ── Ship unlocks ── */

  function isShipUnlocked(def) {
    if (!def) return false;
    const req = def.unlock;
    if (!req || req.free) return true;
    if (G.save.unlockedShips.indexOf(def.id) >= 0) return true;
    if (req.trophy && G.save.trophies[req.trophy]) return true;
    return false;
  }

  function buyShip(def) {
    if (!def || isShipUnlocked(def)) return false;
    const price = def.unlock ? def.unlock.price : 0;
    if (!price || G.save.credits < price) return false;
    G.save.credits -= price;
    G.credits = G.save.credits;
    G.save.unlockedShips.push(def.id);
    writeSave();
    return true;
  }

  function getPlayerShipDef() {
    return SHIP_DEFS[G.selectedShipIndex];
  }

  Object.assign(NS.module('progress'), {
    treeLevel, treeNodeById, nodeState, buyNode, getEffectiveStats, isShipUnlocked, buyShip, getPlayerShipDef
  });
})();
