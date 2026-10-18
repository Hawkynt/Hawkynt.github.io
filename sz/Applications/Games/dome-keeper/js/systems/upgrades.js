;(function() {
  'use strict';

  // Upgrade rules: node levels, prerequisites, purchasing, effective levels and stat effects.
  // Owns: NS.upgrades
  // Reads: constants, dom, rules, upgradeData, cargo, upgradeTree, drones
  // Reads state of: gameState, drones

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H } = NS.constants;
  const { particles, screenShake, floatingText } = NS.dom;
  const { BASE_DOME_HP, BASE_WEAPON_DAMAGE, BASE_FIRE_RATE, BASE_DRILL_SPEED, BASE_CARRY_CAPACITY,
    BASE_MOVE_INTERVAL, LEGACY_UPGRADE_CHAINS } = NS.rules;
  const { UPGRADE_TREE } = NS.upgradeData;

  /* ======================================================================
     UPGRADE SYSTEM
     ====================================================================== */

  function totalResources() {
    let total = 0;
    for (const key in G.resources)
      total += G.resources[key];
    return total;
  }

  /* ======================================================================
     UPGRADE TREE (full-screen dialog)
     ====================================================================== */

  function getTreeNodeLevel(id) {
    return G.upgradeTreeLevels[id] || 0;
  }

  const TREE_NODE_BY_ID = {};
  for (const n of UPGRADE_TREE)
    TREE_NODE_BY_ID[n.id] = n;

  function isTreeNodeMaxed(id) {
    const node = TREE_NODE_BY_ID[id];
    if (!node) return false;
    return getTreeNodeLevel(id) >= node.maxLevel;
  }

  // A prerequisite is 'id' (that node maxed) or 'id@N' (that node at level N or more)
  function prereqId(p) {
    const at = p.indexOf('@');
    return at < 0 ? p : p.slice(0, at);
  }

  function prereqLevel(p) {
    const at = p.indexOf('@');
    return at < 0 ? 0 : Math.max(1, parseInt(p.slice(at + 1), 10) || 1);
  }

  function isPrereqMet(p) {
    const lvl = prereqLevel(p);
    return lvl ? getTreeNodeLevel(prereqId(p)) >= lvl : isTreeNodeMaxed(p);
  }

  // 'Bag Size 2' for 'bag@2', the node name otherwise
  function prereqLabel(p) {
    const node = TREE_NODE_BY_ID[prereqId(p)];
    if (!node) return prereqId(p);
    const lvl = prereqLevel(p);
    return lvl ? NS.upgradeTree.getTreeNodeInfo(node).title + ' ' + lvl : node.name;
  }

  function arePrereqsMet(node) {
    for (const pid of node.prereqs)
      if (!isPrereqMet(pid))
        return false;
    return true;
  }

  function canAffordTreeNode(node) {
    const lvl = getTreeNodeLevel(node.id);
    if (lvl >= node.maxLevel) return false;
    const cost = node.costs[Math.min(lvl, node.costs.length - 1)];
    for (const key in cost)
      if ((cost[key] || 0) > 0 && (G.resources[key] || 0) < cost[key])
        return false;
    return true;
  }

  function isTreeNodeAvailable(node) {
    return !isTreeNodeMaxed(node.id) && arePrereqsMet(node);
  }

  function purchaseTreeNode(node) {
    const lvl = getTreeNodeLevel(node.id);
    if (lvl >= node.maxLevel) return;
    if (!arePrereqsMet(node)) return;
    const cost = node.costs[Math.min(lvl, node.costs.length - 1)];
    // Check affordability for all resource types in the cost
    for (const key in cost)
      if ((cost[key] || 0) > 0 && (G.resources[key] || 0) < cost[key]) {
        SZ.GameAudio.play('error');
        return;
      }

    // Deduct all costs
    for (const key in cost)
      if ((cost[key] || 0) > 0)
        G.resources[key] -= cost[key];
    G.upgradeTreeLevels[node.id] = lvl + 1;
    invalidateLevelCache();

    // Apply the upgrade effect
    if (node.type === 'gadget')
      applyGadgetUnlock(node.upgradeKey);
    else
      applyStatUpgrade(node.upgradeKey);
    if (node.branch === 'drone')
      NS.drones.syncDrones(true);

    SZ.GameAudio.play('levelup');
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `${node.name} purchased!`, { color: '#ffd700', font: 'bold 28px sans-serif' });
    particles.sparkle(CANVAS_W / 2, CANVAS_H / 2, 12, { color: '#ffd700', speed: 2.5 });
    screenShake.trigger(4, 120);
  }

  // Passive gadgets that don't need selection
  const PASSIVE_GADGETS = ['scanner', 'reinforcedDome', 'autoRepair', 'domeExpansion', 'energyShield', 'magnet', 'fortune', 'silkTouch', 'echoLocation', 'chainLightning', 'freezeRay', 'plasmaCannon', 'damageReflect', 'emergencyShield', 'fortifiedBase', 'lastStand', 'oreDetector', 'autoMine', 'tunnelBore', 'veinMiner', 'doubleJump', 'wallClimb', 'dash', 'undergroundRadar', 'multiShot', 'homingShots', 'criticalHit', 'explosiveRounds', 'droneBay', 'droneMiner', 'combatDrone', 'repairDrone', 'recipeBomb', 'recipeBig', 'recipeMega', 'recipeVoid', 'chainReaction', 'remoteDetonator', 'stickyBombs', 'blastSuit'];

  function applyGadgetUnlock(key) {
    G.unlockedTools[key] = true;
    // Apply immediate effects for certain gadgets
    if (key === 'domeExpansion' || key === 'fortifiedBase') {
      G.maxDomeHP = computeMaxDomeHP();
      G.domeHP = Math.min(G.domeHP + (key === 'domeExpansion' ? 75 : 50), G.maxDomeHP);
    }
    // Auto-select non-passive tools
    if (!PASSIVE_GADGETS.includes(key))
      G.activeToolKey = key;
  }

  // Summed tree levels per upgradeKey, rebuilt after any change to upgradeTreeLevels
  function invalidateLevelCache() {
    G.effectiveLevelCache = null;
  }

  function getEffectiveLevel(key) {
    if (!G.effectiveLevelCache || G.effectiveLevelSrc !== G.upgradeTreeLevels) {
      G.effectiveLevelCache = new Map();
      G.effectiveLevelSrc = G.upgradeTreeLevels;
      for (const n of UPGRADE_TREE)
        G.effectiveLevelCache.set(n.upgradeKey, (G.effectiveLevelCache.get(n.upgradeKey) || 0) + getTreeNodeLevel(n.id));
    }
    return G.effectiveLevelCache.get(key) || 0;
  }

  // One-level nodes of older runs that became level-up upgrades: new id -> old ids
  // and the factor of old levels to new ones
  const RETIRED_TREE_NODES = {
    bag: { ids: ['carry1', 'carry2', 'carry3', 'carry4', 'carry5'], k: 0.8 },
    droneCargo: { ids: ['droneCargo1', 'droneCargo2', 'droneCargo3'], k: 1 },
    droneSwarm: { ids: ['droneSwarm1', 'droneSwarm2'], k: 1 },
    gunSquad: { ids: ['combatDrone3'], k: 1 },
    repairSquad: { ids: ['repairDrone3'], k: 1 }
  };

  function migrateTreeLevels(levels) {
    for (const id in RETIRED_TREE_NODES) {
      const r = RETIRED_TREE_NODES[id];
      let sum = 0, found = false;
      for (const old of r.ids)
        if (old in levels) {
          found = true;
          sum += Math.max(0, Math.floor(Number(levels[old]) || 0));
          delete levels[old];
        }
      if (found)
        levels[id] = Math.min(TREE_NODE_BY_ID[id].maxLevel, Math.max(0, Math.floor(Number(levels[id]) || 0)) + Math.ceil(sum * r.k));
    }
    return levels;
  }

  // Map quick-upgrade levels of an old save onto the matching tree chain:
  // the chain is owned up to (tree levels + legacy levels) nodes
  function absorbLegacyUpgrades(levels) {
    for (const key in LEGACY_UPGRADE_CHAINS) {
      const extra = Math.max(0, Math.floor(Number(levels[key]) || 0));
      if (!extra) continue;
      // The carry chain became the Bag Size upgrade (old +20 steps, new +25 levels)
      if (key === 'carryCapacity') {
        const bag = TREE_NODE_BY_ID.bag;
        G.upgradeTreeLevels.bag = Math.min(bag.maxLevel, getTreeNodeLevel('bag') + Math.ceil(Math.min(5, extra) * 0.8));
        continue;
      }
      const prefix = LEGACY_UPGRADE_CHAINS[key];
      const chain = UPGRADE_TREE
        .filter(n => n.type === 'stat' && n.upgradeKey === key && new RegExp('^' + prefix + '\\d+$').test(n.id))
        .sort((a, b) => parseInt(a.id.slice(prefix.length), 10) - parseInt(b.id.slice(prefix.length), 10));
      let owned = 0;
      for (const n of chain)
        if (getTreeNodeLevel(n.id) >= n.maxLevel) ++owned;
      const target = Math.min(chain.length, owned + extra);
      for (let i = 0; i < target; ++i)
        G.upgradeTreeLevels[chain[i].id] = chain[i].maxLevel;
    }
    invalidateLevelCache();
  }

  // Dome capacity from every source: shield chain, dome gadgets and armour found in the mine
  function computeMaxDomeHP() {
    let hp = BASE_DOME_HP + getEffectiveLevel('domeHP') * 25;
    if (G.unlockedTools.domeExpansion) hp += 75;
    if (G.unlockedTools.fortifiedBase) hp += 50;
    hp += 50 * G.foundGadgets.filter(g => g === 'domeArmor').length;
    return hp;
  }

  function applyStatUpgrade(key) {
    const totalLevels = getEffectiveLevel(key);

    switch (key) {
      case 'weaponDamage':
        G.weaponDamage = BASE_WEAPON_DAMAGE + totalLevels * 5;
        break;
      case 'fireRate':
        G.fireRate = BASE_FIRE_RATE + totalLevels * 0.3;
        break;
      case 'domeHP':
        G.maxDomeHP = computeMaxDomeHP();
        G.domeHP = Math.min(G.domeHP + 25, G.maxDomeHP);
        break;
      case 'drillSpeed':
        G.drillSpeed = Math.max(0.1, BASE_DRILL_SPEED - totalLevels * 0.05);
        break;
      case 'carryCapacity':
        G.carryCapacity = BASE_CARRY_CAPACITY + totalLevels * 25;
        break;
      case 'compression':
        // Repack everything at the new tier
        G.carried = NS.cargo.bagSlots();
        for (const d of G.drones)
          d.cargo = NS.cargo.bagSlots(d.bag);
        break;
      case 'moveSpeed':
        G.moveStepInterval = BASE_MOVE_INTERVAL * Math.pow(0.85, totalLevels);
        break;
      case 'miningTools':
        // Applied dynamically in getMiningTime()
        break;
      case 'shieldRecharge':
        // Passive: reduces shield gadget recharge conceptually (already tracked by level count)
        break;
      case 'echoLocation':
        // Passive: extended scanner range (tracked by level count, applied in scanner code)
        break;
    }
  }

  NS.upgrades = { totalResources, getTreeNodeLevel, TREE_NODE_BY_ID, isTreeNodeMaxed, prereqId, isPrereqMet,
    prereqLabel, arePrereqsMet, canAffordTreeNode, isTreeNodeAvailable, purchaseTreeNode,
    invalidateLevelCache, getEffectiveLevel, migrateTreeLevels, absorbLegacyUpgrades, computeMaxDomeHP,
    applyStatUpgrade };
})();
