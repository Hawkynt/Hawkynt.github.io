/* world/research.js -- the persistent research tree: nodes, levels, buying and research points.
   Owns state: G.lastRp
   Reads: constants, towerTypes, enemyTypes, env, effects, progress, waves, researchScreen and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { WORLD_W, WORLD_H } = NS.constants;
  const { TOWER_TYPES, TOWER_BY_ID } = NS.towerTypes;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { audio } = NS.env;
  const { floatingText } = NS.effects;

  /* ══════════════════════════════════════════════════════════════════
     RESEARCH -- a persistent tree bought with research points earned
     by clearing waves and winning maps
     ══════════════════════════════════════════════════════════════════ */

  const TREE_BRANCHES = ['arsenal', 'economy', 'defense', 'abilities'];
  const TREE_BRANCH_INFO = {
    arsenal: { name: 'Arsenal', color: '#ff8a5a', icon: 'sword' },
    economy: { name: 'Economy', color: '#ffd75a', icon: 'coin' },
    defense: { name: 'Defense', color: '#5ab8ff', icon: 'shield' },
    abilities: { name: 'Abilities', color: '#c890ff', icon: 'bolt' }
  };

  // Families shown as lanes of the arsenal, with the unlock price of the locked ones
  const ARSENAL_LANES = [['arrow', 0], ['cannon', 0], ['frost', 0], ['spikes', 0], ['tesla', 4], ['poison', 4], ['flame', 5], ['laser', 7], ['sniper', 7],
    ['mortar', 5], ['wind', -1], ['storm', -1], ['missile', 6], ['beacon', 8], ['arcane', -1]];
  // Towers that only a boss can unlock (see BOSS_UNLOCKS)
  const BOSS_TOWER = { wind: 'slimeking', arcane: 'lich', storm: 'dragon' };

  const TREE = [];
  ARSENAL_LANES.forEach(([fam, unlockCost], row) => {
    const def = TOWER_BY_ID[fam];
    let col = 0;
    if (unlockCost < 0) {
      const boss = BOSS_TOWER[fam];
      TREE.push({ id: 'unlock_' + fam, branch: 'arsenal', col: 0, row, max: 1, cost: [0], req: [], tower: def.index, boss,
        name: def.name, desc: `Only defeating the ${ENEMY_TYPES[boss].name} unlocks the ${def.name}.`, effect: () => 'Can be built' });
      col = 1;
    } else if (unlockCost) {
      TREE.push({ id: 'unlock_' + fam, branch: 'arsenal', col: 0, row, max: 1, cost: [unlockCost], req: [], tower: def.index,
        name: def.name, desc: `Unlocks the ${def.name} for building.`, effect: () => 'Can be built' });
      col = 1;
    } else
      col = 1;
    TREE.push({ id: 'power_' + fam, branch: 'arsenal', col, row, max: 2, cost: [3, 6], req: unlockCost ? ['unlock_' + fam] : [], tower: def.index, icon: 'sword',
      name: def.name + ' Drills', desc: `Every ${def.name} hits harder and reaches a little further.`, effect: (l) => `+${l * 12}% damage, +${l * 4}% range` });
    TREE.push({ id: 'master_' + fam, branch: 'arsenal', col: col + 1, row, max: 1, cost: [10], req: ['power_' + fam], tower: def.index, icon: 'crown',
      name: def.name + ' Mastery', desc: `Lets both ${def.name} specializations reach tier V.`, effect: () => 'Tier V unlocked' });
  });

  TREE.push(
    { id: 'chest', branch: 'economy', col: 0, row: 0, max: 3, cost: [4, 7, 10], req: [], icon: 'coin',
      name: 'War Chest', desc: 'Start every map with more gold.', effect: (l) => `+${l * 25} starting gold` },
    { id: 'bounty', branch: 'economy', col: 1, row: 0, max: 2, cost: [5, 9], req: ['chest'], icon: 'skull',
      name: 'Bounty Hunters', desc: 'Defeated enemies drop more gold.', effect: (l) => `+${l * 10}% kill gold` },
    { id: 'interest', branch: 'economy', col: 2, row: 0, max: 2, cost: [6, 10], req: ['bounty'], icon: 'up',
      name: 'Treasury', desc: 'Gold you keep earns interest whenever a wave is cleared.', effect: (l) => `${l * 2}% interest (max ${l * 25})` },
    { id: 'mine', branch: 'economy', col: 1, row: 1, max: 1, cost: [6], req: ['chest'], tower: TOWER_BY_ID.mine.index,
      name: 'Gold Mine', desc: 'Unlocks the Gold Mine for building.', effect: () => 'Can be built' },
    { id: 'master_mine', branch: 'economy', col: 2, row: 1, max: 1, cost: [10], req: ['mine'], tower: TOWER_BY_ID.mine.index, icon: 'crown',
      name: 'Mine Mastery', desc: 'Lets the Bank and the Alchemist reach tier V.', effect: () => 'Tier V unlocked' },
    { id: 'salvage', branch: 'economy', col: 1, row: 2, max: 1, cost: [5], req: ['chest'], icon: 'hammer',
      name: 'Salvage', desc: 'Selling towers returns more of their cost.', effect: () => 'Refund 75% instead of 60%' },
    { id: 'early', branch: 'economy', col: 2, row: 2, max: 1, cost: [4], req: ['salvage'], icon: 'play',
      name: 'Eager Recruits', desc: 'Calling a wave early pays half as much again.', effect: () => '+50% call-early bonus' },

    { id: 'fortify', branch: 'defense', col: 0, row: 0, max: 3, cost: [4, 7, 10], req: [], icon: 'heart',
      name: 'Fortify', desc: 'Thicker walls: start every map with more lives.', effect: (l) => `+${l * 3} lives` },
    { id: 'masonry', branch: 'defense', col: 1, row: 0, max: 2, cost: [4, 8], req: ['fortify'], icon: 'wrench',
      name: 'Masonry', desc: 'Sturdier towers that patch themselves up between waves.', effect: (l) => `+${l * 40}% structure, repair ${l * 20}% after each wave` },
    { id: 'laststand', branch: 'defense', col: 2, row: 0, max: 1, cost: [8], req: ['masonry'], icon: 'sword',
      name: 'Last Stand', desc: 'With the walls about to fall, every tower fights harder.', effect: () => '+25% damage below 30% lives' },
    { id: 'medic', branch: 'defense', col: 1, row: 1, max: 1, cost: [7], req: ['fortify'], icon: 'heart',
      name: 'Field Medics', desc: 'Every defeated boss restores lives.', effect: () => '+2 lives per boss' },
    { id: 'scouts', branch: 'defense', col: 2, row: 1, max: 1, cost: [6], req: ['medic'], icon: 'range',
      name: 'Scouts', desc: 'All towers spot stealthed enemies close to them.', effect: () => 'Phantoms visible within 1.5 tiles' }
  );

  const TREE_BY_ID = {};
  for (const n of TREE) TREE_BY_ID[n.id] = n;

  function techLevel(id) {
    const v = G.meta && G.meta.tree ? G.meta.tree[id] : 0;
    return Number.isInteger(v) && v > 0 ? Math.min(v, TREE_BY_ID[id] ? TREE_BY_ID[id].max : v) : 0;
  }

  function towerUnlocked(typeIndex) {
    const id = TOWER_TYPES[typeIndex].id;
    if (id === 'mine') return techLevel('mine') > 0;
    const lane = ARSENAL_LANES.find(l => l[0] === id);
    return !lane || !lane[1] || techLevel('unlock_' + id) > 0;
  }

  function masteryUnlocked(typeIndex) {
    return techLevel('master_' + TOWER_TYPES[typeIndex].id) > 0;
  }

  function treeNodeState(n) {
    const lvl = techLevel(n.id);
    if (lvl >= n.max) return 'owned';
    if (n.boss || !n.req.every(r => techLevel(r) > 0)) return 'locked';
    return G.meta.rp >= n.cost[lvl] ? 'ready' : 'poor';
  }

  function buyTreeNode(n) {
    const st = treeNodeState(n);
    if (st !== 'ready') {
      audio.play('error');
      return false;
    }
    const lvl = techLevel(n.id);
    G.meta.rp -= n.cost[lvl];
    G.meta.tree[n.id] = lvl + 1;
    NS.progress.saveMeta();
    NS.researchScreen.applyResearchToRun();
    NS.researchScreen.treeFlash[n.id] = performance.now();
    audio.play('powerup', { pitch: 1 + lvl * 0.1 });
    return true;
  }
  function awardResearch(victory, newStars) {
    const waves = victory ? G.currentWave : Math.max(0, G.currentWave - 1);
    const rp = Math.round((waves + (victory ? 5 : 0) + newStars * 5) * NS.waves.mapResearchMul(G.currentMap));
    grantResearch(rp);
    G.lastRp = G.runStats.rp;
    return rp;
  }

  // Each wave held after the map is cleared pays its research right away
  function awardWaveResearch() {
    const rp = Math.max(1, Math.round(NS.waves.mapResearchMul(G.currentMap)));
    grantResearch(rp);
    floatingText.add(WORLD_W / 2, WORLD_H * 0.22, `+${rp} research`, { color: '#d8b8ff', font: 'bold 13px sans-serif' });
    return rp;
  }

  function grantResearch(rp) {
    G.meta.rp += rp;
    G.meta.rpEarned += rp;
    G.runStats.rp = (G.runStats.rp || 0) + rp;
    NS.progress.saveMeta();
  }

  /* ── Effects of the research on a match ── */
  function techDamageMul(def) {
    return 1 + techLevel('power_' + def.id) * 0.12;
  }

  function techRangeMul(def) {
    return 1 + techLevel('power_' + def.id) * 0.04;
  }

  NS.research = { TREE_BRANCHES, TREE_BRANCH_INFO, BOSS_TOWER, TREE, TREE_BY_ID, techLevel, towerUnlocked,
      masteryUnlocked, treeNodeState, buyTreeNode, awardResearch, awardWaveResearch, grantResearch,
      techDamageMul, techRangeMul };

})();
