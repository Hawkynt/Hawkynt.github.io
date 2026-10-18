/* world/towers.js -- tower stats, the tower grid, placement, upgrades, selling, repair and targeting mode.
   Owns state: G.towerVersion
   Reads: constants, towerTypes, env, text, effects, research, bossRewards and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, COLS, ROWS, MAX_TIER, BRANCH_TIER, STATE_BUILD } = NS.constants;
  const { MUL_KEYS, TOWER_TYPES, TIER_COST, TARGET_MODES } = NS.towerTypes;
  const { screenShake, audio } = NS.env;
  const { toRoman } = NS.text;
  const { PK_PIXEL, emit, rnd, particles, floatingText, explosionFx, coinFly, addShake } = NS.effects;
  const { techLevel, towerUnlocked, masteryUnlocked, techDamageMul, techRangeMul } = NS.research;
  const { hasRelic } = NS.bossRewards;

  /* ══════════════════════════════════════════════════════════════════
     TOWER STATS
     ══════════════════════════════════════════════════════════════════ */

  // Effective stats of a tower type at a tier / branch (range and splash in px)
  function computeStats(def, tier, branch) {
    const s = {};
    for (const k in def)
      if (typeof def[k] === 'number' || typeof def[k] === 'boolean')
        s[k] = def[k];
    s.kind = def.kind;
    s.hits = def.hits;
    let mods;
    if (tier <= 3)
      mods = def.tiers[tier - 1] || {};
    else {
      const b = def.branches[branch] || def.branches[0];
      mods = tier >= 5 ? b.t5 : b.t4;
    }
    for (const k in mods)
      s[k] = MUL_KEYS[k] ? def[k] * mods[k] : mods[k];
    // Research and relic bonuses
    const relicDmg = hasRelic('steel') ? 1.1 : 1;
    s.damage *= techDamageMul(def) * relicDmg;
    s.range *= techRangeMul(def);
    if (s.cloudDps) s.cloudDps *= techDamageMul(def) * relicDmg;
    if (s.burn) s.burn *= techDamageMul(def) * relicDmg * (hasRelic('ember') ? 1.5 : 1);
    if (s.lava && hasRelic('ember')) s.lava *= 1.5;
    if (def.id === 'arrow' && hasRelic('quiver')) s.multishot = (s.multishot || 1) + 1;
    if (def.id === 'tesla' && hasRelic('coil')) s.chains += 2;
    if ((def.id === 'arrow' || def.id === 'sniper') && hasRelic('lens')) {
      s.crit = (s.crit || 0) + 0.1;
      s.critMul = s.critMul || 2;
    }
    s.damage = Math.round(s.damage * 10) / 10;
    s.rangePx = s.range * CELL;
    s.splashPx = (s.splash || 0) * CELL;
    s.chainPx = (s.chainRange || 0) * CELL;
    s.cloudPx = (s.cloud || 0) * CELL;
    return s;
  }

  function towerStats(t) {
    if (!t.stats)
      t.stats = computeStats(TOWER_TYPES[t.type], t.tier, t.branch);
    return t.stats;
  }

  function towerDef(t) {
    return TOWER_TYPES[t.type];
  }

  // Display name: the branch name once a branch is chosen
  function towerName(t) {
    const def = towerDef(t);
    return t.branch >= 0 ? def.branches[t.branch].name : def.name;
  }
  let towerGridVersion = -1;
  const towerGrid = new Array(COLS * ROWS).fill(null);

  function towerAt(col, row) {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) {
      for (const t of G.towers)
        if (t.col === col && t.row === row) return t;
      return null;
    }
    if (towerGridVersion !== G.towerVersion) {
      towerGrid.fill(null);
      for (const t of G.towers)
        if (t.col >= 0 && t.row >= 0 && t.col < COLS && t.row < ROWS && !towerGrid[t.row * COLS + t.col])
          towerGrid[t.row * COLS + t.col] = t;
      towerGridVersion = G.towerVersion;
    }
    return towerGrid[row * COLS + col];
  }

  function canPlace(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    const key = `${col},${row}`;
    if (G.pathCells.has(key) || G.blockedCells.has(key)) return false;
    return !towerAt(col, row);
  }

  function canPlaceTrap(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    if (!G.pathCells.has(`${col},${row}`)) return false;
    return !towerAt(col, row);
  }

  function canBuildAt(typeIndex, col, row) {
    return TOWER_TYPES[typeIndex].trap ? canPlaceTrap(col, row) : canPlace(col, row);
  }

  function makeTower(col, row, typeIndex, tier, branch) {
    return {
      col, row,
      x: col * CELL + CELL / 2,
      y: row * CELL + CELL / 2,
      type: typeIndex,
      tier: tier || 1,
      branch: branch === undefined ? -1 : branch,
      target: TOWER_TYPES[typeIndex].target || 'first',
      cooldown: 0,
      angle: -Math.PI / 2,
      kills: 0,
      dealt: 0,
      hp: 100,
      maxHp: 100,
      spent: 0,
      builtWave: -1,
      flash: 0,
      recoil: 0,
      beamTarget: null,
      beamTime: 0,
      beamTargets: [],
      stats: null
    };
  }

  function placeTower(col, row, typeIndex) {
    const def = TOWER_TYPES[typeIndex];
    if (!towerUnlocked(typeIndex) || !canBuildAt(typeIndex, col, row))
      return false;
    if (G.gold < def.cost) {
      audio.play('error');
      return false;
    }
    G.gold -= def.cost;
    const startTier = 1;
    const tower = makeTower(col, row, typeIndex, startTier, -1);
    tower.spent = def.cost;
    tower.maxHp = tower.hp = towerMaxHp(startTier);
    tower.builtWave = G.state === STATE_BUILD ? G.currentWave : -1;
    tower.bornAt = G.animTime;
    G.towers.push(tower);
    ++G.towerVersion;
    particles.smoke(tower.x, tower.y + 10, 5, '#b8a080', 7);
    particles.debris(tower.x, tower.y + 8, 6, ['#8a7050', '#6a5038', '#a89070'], 0.7);
    particles.sparkle(tower.x, tower.y, 8, { color: def.color, speed: 2 });
    addShake(1.5, 80);
    audio.play(def.trap ? 'click' : 'drop', def.trap ? { pitch: 0.8 } : undefined);
    floatingText.add(tower.x, tower.y - 22, `-${def.cost}`, { color: '#ffd75a', font: 'bold 11px sans-serif' });
    return true;
  }

  function getUpgradeCost(tower) {
    if (tower.tier >= MAX_TIER) return 0;
    return Math.round(TOWER_TYPES[tower.type].cost * TIER_COST[tower.tier + 1] * (hasRelic('hammer') ? 0.8 : 1) / 5) * 5;
  }

  // branch: required when going from tier 3 to 4
  function towerMaxHp(tier) {
    return (100 + (tier - 1) * 25) * (1 + techLevel('masonry') * 0.4);
  }

  function upgradeTower(tower, branch) {
    if (tower.tier >= MAX_TIER) return false;
    if (tower.tier + 1 === MAX_TIER && !masteryUnlocked(tower.type)) return false;
    if (tower.tier + 1 === BRANCH_TIER && branch !== 0 && branch !== 1) return false;
    const def = TOWER_TYPES[tower.type];
    const cost = getUpgradeCost(tower);
    if (G.gold < cost) return false;
    G.gold -= cost;
    tower.spent += cost;
    ++tower.tier;
    if (tower.tier === BRANCH_TIER)
      tower.branch = branch;
    tower.stats = null;
    ++G.towerVersion;
    const hpBefore = tower.hp / tower.maxHp;
    tower.maxHp = towerMaxHp(tower.tier);
    tower.hp = tower.maxHp * hpBefore;
    tower.upAt = G.animTime;
    for (let i = 0; i < 14; ++i)
      emit(tower.x + rnd(-10, 10), tower.y + rnd(-4, 12), 0, -rnd(40, 110), rnd(0.5, 0.9), rnd(1.5, 2.5), i % 3 ? '#ffd75a' : '#fff6c0', PK_PIXEL, 0, 1);
    particles.glow(tower.x, tower.y - 8, 34, '#ffd75a', 0.45);
    particles.sparkle(tower.x, tower.y, 10, { color: def.color, speed: 3 });
    floatingText.add(tower.x, tower.y - 30, tower.tier === BRANCH_TIER ? towerName(tower) + '!' : tower.tier === MAX_TIER ? 'Mastered!' : `Tier ${toRoman(tower.tier)}!`, { color: '#ffd75a', font: 'bold 13px sans-serif' });
    screenShake.trigger(2, 80);
    audio.play('powerup', { pitch: 0.85 + tower.tier * 0.08 });
    return true;
  }

  function getSellValue(tower) {
    // Full refund for a tower built during this build phase
    if (G.state === STATE_BUILD && tower.builtWave === G.currentWave)
      return tower.spent;
    return Math.floor(tower.spent * (techLevel('salvage') ? 0.75 : 0.6));
  }

  function sellTower(tower) {
    const refund = getSellValue(tower);
    G.gold += refund;
    const idx = G.towers.indexOf(tower);
    if (idx !== -1) G.towers.splice(idx, 1);
    ++G.towerVersion;
    floatingText.add(tower.x, tower.y - 22, `+${refund}`, { color: '#ffd75a', font: 'bold 12px sans-serif' });
    particles.debris(tower.x, tower.y, 10, ['#7a7a8a', '#5a4a3a', '#9a9aa8'], 1);
    particles.smoke(tower.x, tower.y + 6, 5, '#8a8078', 8);
    coinFly(tower.x, tower.y, Math.min(8, 2 + Math.floor(refund / 40)));
    audio.play('coin');
    if (G.selectedTower === tower)
      G.selectedTower = null;
  }

  function repairCost(t) {
    return t.hp >= t.maxHp ? 0 : Math.max(1, Math.floor((t.maxHp - t.hp) * 0.3));
  }

  function repairTower(tower) {
    const cost = repairCost(tower);
    if (cost <= 0 || G.gold < cost) return false;
    G.gold -= cost;
    tower.hp = tower.maxHp;
    particles.sparkle(tower.x, tower.y, 8, { color: '#4f4', speed: 2 });
    audio.play('pickup');
    floatingText.add(tower.x, tower.y - 16, `Repaired -${cost}`, { color: '#8f8', font: 'bold 9px sans-serif' });
    return true;
  }

  function destroyTower(tower) {
    const idx = G.towers.indexOf(tower);
    if (idx === -1) return;
    G.towers.splice(idx, 1);
    ++G.towerVersion;
    if (G.selectedTower === tower)
      G.selectedTower = null;
    explosionFx(tower.x, tower.y, CELL, '#ff6a3a');
    particles.debris(tower.x, tower.y, 14, ['#7a7a8a', '#5a4a3a', '#9a9aa8', '#3a3a44'], 1.3);
    floatingText.add(tower.x, tower.y - 20, 'DESTROYED!', { color: '#ff5a5a', font: 'bold 12px sans-serif' });
    screenShake.trigger(4, 200);
    audio.play('explode', { pitch: 1.3, volume: 0.7 });
  }

  function cycleTargeting(tower, dir) {
    const i = TARGET_MODES.indexOf(tower.target);
    tower.target = TARGET_MODES[(i + (dir || 1) + TARGET_MODES.length) % TARGET_MODES.length];
    audio.play('click', { pitch: 1.1 });
  }

  NS.towers = { computeStats, towerStats, towerName, towerAt, canBuildAt, makeTower, placeTower,
      getUpgradeCost, towerMaxHp, upgradeTower, getSellValue, sellTower, repairCost, repairTower,
      destroyTower, cycleTargeting };

})();
