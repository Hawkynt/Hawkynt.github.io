/* Pure game rules: the save v2 shape and its migration from the first version (and from the
   pre-colony v2 saves: outposts start empty), tech tree and hangar maths (levels, costs, states,
   buying), hulls, station modules, belt licences, the derived ship and colony stats, cargo
   space per ore and achievement checks. No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const { TREE, TREE_BY_ID } = NS.treeData;
  const { HULLS, HULL_BY_ID, UPGRADES, UPGRADE_BY_ID, MODULES, MODULE_BY_ID } = NS.ships;
  const { ORES, ZONES, ZONE_BY_ID } = NS.ores;
  const { ACHIEVEMENTS, STAT_KEYS } = NS.goals;
  const { COMPONENTS } = NS.colonyData;
  const { CHAPTER_BY_ID } = NS.eventData;

  const START_CREDITS = 400;
  const START_RD = 3;

  function freshSave() {
    const stats = {};
    for (let i = 0; i < STAT_KEYS.length; ++i) stats[STAT_KEYS[i]] = 0;
    const upgrades = {};
    for (let i = 0; i < UPGRADES.length; ++i) upgrades[UPGRADES[i].id] = 0;
    const modules = {};
    for (let i = 0; i < MODULES.length; ++i) modules[MODULES[i].id] = 0;
    return {
      v: 2, migrated: false, credits: START_CREDITS, rd: START_RD,
      hull: 'prospector', hulls: ['prospector'], upgrades: upgrades, tree: {}, modules: modules,
      licenses: ['kessler'], visited: [], zone: 'kessler',
      store: { ore: {}, bar: {}, comp: {} }, market: null, contracts: [], cycle: 0, news: '',
      achievements: {}, stats: stats, best: { rush: 0, daily: { day: '', score: 0 }, siege: 0 }, highScores: [],
      seenIntro: false, seenHelp: false, crownDone: false,
      bases: {}, log: [], logSeen: [], daily: { day: '', streak: 0, last: '', week: '' }, cine: {}, resume: null,
      cosmetics: NS.cosmetics.blank(), festival: { event: '', tokens: 0, claimed: 0 },
    };
  }

  function num(v, lo, hi, def) {
    return typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def;
  }

  function count(map, keys) {
    const out = {};
    if (map && typeof map === 'object')
      for (const k in map)
        if ((!keys || keys[k]) && typeof map[k] === 'number' && isFinite(map[k]) && map[k] > 0) out[k] = Math.floor(map[k]);
    return out;
  }

  /* A repaired v2 save from anything stored; `old` is the first version's high-score list
     ([{ credits, ore }]): veterans keep their best run as starting credits (capped) */
  function migrateSave(stored, old) {
    const s = freshSave();
    const src = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : null;
    if (src) {
      s.migrated = !!src.migrated;
      s.credits = Math.floor(num(src.credits, 0, 1e12, s.credits));
      s.rd = Math.floor(num(src.rd, 0, 1e6, s.rd));
      if (Array.isArray(src.hulls)) s.hulls = ['prospector'].concat(src.hulls.filter(h => HULL_BY_ID[h] && h !== 'prospector'));
      s.hull = HULL_BY_ID[src.hull] && s.hulls.indexOf(src.hull) >= 0 ? src.hull : 'prospector';
      for (let i = 0; i < UPGRADES.length; ++i) {
        const u = UPGRADES[i];
        s.upgrades[u.id] = Math.floor(num(src.upgrades && src.upgrades[u.id], 0, u.max, 0));
      }
      if (src.tree && typeof src.tree === 'object')
        for (const id in src.tree) {
          const n = TREE_BY_ID[id];
          const lvl = Math.floor(num(src.tree[id], 0, n ? n.costs.length : 0, 0));
          if (n && lvl > 0) s.tree[id] = lvl;
        }
      for (let i = 0; i < MODULES.length; ++i) {
        const m = MODULES[i];
        s.modules[m.id] = Math.floor(num(src.modules && src.modules[m.id], 0, m.costs.length, 0));
      }
      if (Array.isArray(src.licenses)) s.licenses = ['kessler'].concat(src.licenses.filter(z => ZONE_BY_ID[z] && z !== 'kessler'));
      if (Array.isArray(src.visited)) s.visited = src.visited.filter((z, i, a) => ZONE_BY_ID[z] && a.indexOf(z) === i);
      s.zone = s.licenses.indexOf(src.zone) >= 0 ? src.zone : 'kessler';
      const oreKeys = {};
      for (let i = 0; i < ORES.length; ++i) oreKeys[ORES[i].id] = 1;
      const compKeys = {};
      for (let i = 0; i < COMPONENTS.length; ++i) compKeys[COMPONENTS[i].id] = 1;
      if (src.store) s.store = { ore: count(src.store.ore, oreKeys), bar: count(src.store.bar, oreKeys), comp: count(src.store.comp, compKeys) };
      if (src.market && typeof src.market === 'object') s.market = src.market;
      if (Array.isArray(src.contracts))
        s.contracts = src.contracts.filter(c => c && c.qty > 0 && c.reward > 0 && (((c.kind === 'ore' || c.kind === 'bar') && oreKeys[c.ore]) ||
          (c.kind === 'comp' && compKeys[c.ore]) || (c.kind === 'waves' && typeof c.start === 'number'))).slice(0, 10);
      s.cycle = Math.floor(num(src.cycle, 0, 1e9, 0));
      s.news = typeof src.news === 'string' ? src.news.slice(0, 160) : '';
      if (src.achievements && typeof src.achievements === 'object')
        for (let i = 0; i < ACHIEVEMENTS.length; ++i)
          if (src.achievements[ACHIEVEMENTS[i].id]) s.achievements[ACHIEVEMENTS[i].id] = true;
      if (src.stats)
        for (let i = 0; i < STAT_KEYS.length; ++i) s.stats[STAT_KEYS[i]] = num(src.stats[STAT_KEYS[i]], 0, 1e15, 0);
      if (src.best) {
        s.best.rush = Math.floor(num(src.best.rush, 0, 1e12, 0));
        if (src.best.daily && typeof src.best.daily.day === 'string')
          s.best.daily = { day: src.best.daily.day, score: Math.floor(num(src.best.daily.score, 0, 1e12, 0)) };
        s.best.siege = Math.floor(num(src.best.siege, 0, 1e12, 0));
      }
      s.bases = NS.colony.repairBases(src.bases);
      const known = (list) => Array.isArray(list) ? list.filter((id, i, a) => CHAPTER_BY_ID[id] && a.indexOf(id) === i) : [];
      s.log = known(src.log);
      s.logSeen = known(src.logSeen).filter(id => s.log.indexOf(id) >= 0);
      if (src.daily && typeof src.daily === 'object')
        s.daily = { day: typeof src.daily.day === 'string' ? src.daily.day.slice(0, 10) : '', streak: Math.floor(num(src.daily.streak, 0, 1e6, 0)),
          last: typeof src.daily.last === 'string' ? src.daily.last.slice(0, 10) : '', week: typeof src.daily.week === 'string' ? src.daily.week.slice(0, 8) : '' };
      if (src.cine && typeof src.cine === 'object')
        for (const k in src.cine) if (src.cine[k] === true && /^[a-zA-Z]{1,20}$/.test(k)) s.cine[k] = true;
      s.resume = src.resume && typeof src.resume === 'object' && src.resume.v === 1 ? src.resume : null;
      s.cosmetics = NS.cosmetics.repair(src.cosmetics);
      s.festival = NS.cosmetics.repairFestival(src.festival);
      if (Array.isArray(src.highScores))
        s.highScores = src.highScores.filter(h => h && typeof h.score === 'number' && isFinite(h.score)).slice(0, 10)
          .map(h => ({ score: Math.floor(h.score), mode: typeof h.mode === 'string' ? h.mode : 'career', detail: typeof h.detail === 'string' ? h.detail : '' }));
      s.seenIntro = !!src.seenIntro;
      s.seenHelp = !!src.seenHelp;
      s.crownDone = !!src.crownDone;
    }
    if (!s.migrated && Array.isArray(old)) {
      const valid = old.filter(h => h && typeof h.credits === 'number' && isFinite(h.credits) && h.credits >= 0);
      if (valid.length) {
        valid.sort((a, b) => b.credits - a.credits);
        s.credits += Math.min(5000, Math.floor(valid[0].credits / 2));
        for (let i = 0; i < valid.length && s.highScores.length < 10; ++i)
          s.highScores.push({ score: Math.floor(valid[i].credits), mode: 'classic', detail: (Math.floor(valid[i].ore) || 0) + ' ore' });
        s.highScores.sort((a, b) => b.score - a.score);
        s.migrated = true;
      }
    }
    return s;
  }

  /* ── tech tree (research data) ── */
  function nodeLevel(save, id) {
    return save.tree[id] || 0;
  }

  function nodeCost(save, id) {
    const n = TREE_BY_ID[id];
    const lvl = nodeLevel(save, id);
    return lvl < n.costs.length ? n.costs[lvl] : 0;
  }

  function reqsMet(save, n) {
    for (let i = 0; i < n.req.length; ++i)
      if (nodeLevel(save, n.req[i][0]) < n.req[i][1]) return false;
    return true;
  }

  /* 'maxed' | 'locked' | 'expensive' | 'available' */
  function nodeState(save, id) {
    const n = TREE_BY_ID[id];
    if (nodeLevel(save, id) >= n.costs.length) return 'maxed';
    if (!reqsMet(save, n)) return 'locked';
    return save.rd < nodeCost(save, id) ? 'expensive' : 'available';
  }

  function buyNode(save, id) {
    if (!TREE_BY_ID[id] || nodeState(save, id) !== 'available') return false;
    save.rd -= nodeCost(save, id);
    save.tree[id] = nodeLevel(save, id) + 1;
    return true;
  }

  function nodeText(n, lvl) {
    const v = n.per * lvl;
    return n.fmt.replace('{p}', String(Math.round(v * 100))).replace('{v}', String(Math.round(v * 100) / 100));
  }

  /* ── hangar upgrades (credits) ── */
  function upgradeCost(save, id) {
    const u = UPGRADE_BY_ID[id];
    const lvl = save.upgrades[id] || 0;
    return lvl >= u.max ? 0 : Math.round(u.base * Math.pow(u.growth, lvl) / 10) * 10;
  }

  function buyUpgrade(save, id) {
    const u = UPGRADE_BY_ID[id];
    if (!u || save.upgrades[id] >= u.max) return false;
    const cost = upgradeCost(save, id);
    if (save.credits < cost) return false;
    save.credits -= cost;
    save.upgrades[id] += 1;
    return true;
  }

  function buyHull(save, id) {
    const h = HULL_BY_ID[id];
    if (!h) return false;
    if (save.hulls.indexOf(id) >= 0) {
      save.hull = id;
      return true;
    }
    if (save.credits < h.cost) return false;
    save.credits -= h.cost;
    save.hulls.push(id);
    save.hull = id;
    return true;
  }

  function moduleCost(save, id) {
    const m = MODULE_BY_ID[id];
    const lvl = save.modules[id] || 0;
    return lvl >= m.costs.length ? 0 : m.costs[lvl];
  }

  function buildModule(save, id) {
    const m = MODULE_BY_ID[id];
    if (!m || save.modules[id] >= m.costs.length) return false;
    const cost = moduleCost(save, id);
    if (save.credits < cost) return false;
    save.credits -= cost;
    save.modules[id] += 1;
    return true;
  }

  /* ── belts ── */
  function zoneState(save, index) {
    const z = ZONES[index];
    if (!z) return 'locked';
    if (save.licenses.indexOf(z.id) >= 0) return 'open';
    const prev = ZONES[index - 1];
    if (prev && save.licenses.indexOf(prev.id) < 0) return 'locked';
    return save.stats.earned >= z.unlock.earned ? 'buyable' : 'locked';
  }

  function buyLicense(save, index) {
    const z = ZONES[index];
    if (zoneState(save, index) !== 'buyable' || save.credits < z.unlock.fee) return false;
    save.credits -= z.unlock.fee;
    save.licenses.push(z.id);
    return true;
  }

  /* ── derived stats ── */
  function treeSum(save, stat) {
    let s = 0;
    for (let i = 0; i < TREE.length; ++i) {
      const n = TREE[i];
      if (n.stat === stat) s += n.per * nodeLevel(save, n.id);
    }
    return s;
  }

  function upMul(save, id) {
    return 1 + UPGRADE_BY_ID[id].per * (save.upgrades[id] || 0);
  }

  /* The stats a trip flies with: hull base x hangar upgrades x tree bonuses x modules */
  function computeStats(save, hullId) {
    const h = HULL_BY_ID[hullId || save.hull] || HULLS[0];
    const t = (k) => treeSum(save, k);
    const thrustMul = upMul(save, 'thrust') * (1 + t('thrustMul'));
    return {
      hullId: h.id, scale: h.scale, colors: NS.cosmetics.colorsFor(save, h.colors),
      thrust: h.thrust * thrustMul,
      maxSpeed: h.maxSpeed * (1 + (thrustMul - 1) * 0.7),
      laser: h.laser * upMul(save, 'laser') * (1 + t('laserMul')),
      cargo: Math.round(h.cargo * upMul(save, 'cargo') * (1 + t('cargoMul'))),
      fuel: Math.round(h.fuel * upMul(save, 'fuel')),
      hull: Math.round(h.hull * upMul(save, 'hull')),
      shield: t('shield'),
      tractor: 170 * (1 + (upMul(save, 'tractor') - 1) * 0.6) * (1 + t('tractorMul')),
      tractorPull: 900 * upMul(save, 'tractor'),
      drones: Math.min(4, (save.modules.droneBay || 0) + h.drones + t('drones')),
      droneSpeed: 1 + t('droneSpeed'),
      droneLaser: 1 + t('droneLaser'),
      droneHaul: 4 + t('droneHaul'),
      droneArmor: 1 + t('droneArmor'),
      smartDrones: t('smartDrones') > 0,
      crit: t('crit'), yieldMul: 1 + t('yieldMul'), chip: 1 + t('chip'), twin: t('twin'), seismic: t('seismic'),
      fuelEff: Math.max(0.4, 1 - t('fuelEff')), boost: t('boost'), grip: 1 + t('grip'), jump: t('jump') > 0,
      compress: t('compress') > 0, priceMul: 1 + t('priceMul') + (save.modules.tradeHub || 0) * 0.04,
      contracts: 3 + t('contracts') + (save.modules.tradeHub || 0), contractMul: 1 + t('contracts') * 0.15,
      turret: t('turret'), radResist: Math.min(0.85, t('radResist')), impact: Math.min(0.8, t('impact')),
      blastResist: Math.min(0.8, t('blastResist')),
      scan: t('scan'), dataMul: 1 + t('dataMul'), rare: t('rare'), geode: t('geode'), salvage: 1 + t('salvage'),
      scanner: save.modules.scanner || 0, refinery: save.modules.refinery || 0, depot: save.modules.depot || 0,
      buildSpeed: 1 + t('buildSpeed'), buildingHp: 1 + t('buildingHp'), buildCost: Math.max(0.5, 1 - t('buildCost')),
      linkRange: t('linkRange'), turretDmg: 1 + t('turretDmg'), turretRange: 1 + t('turretRange'), shieldMul: 1 + t('shieldMul'),
      repairMul: 1 + t('repairMul'), unitHp: 1 + t('unitHp'), unitDmg: 1 + t('unitDmg'), unitSpeed: 1 + t('unitSpeed'),
      supply: t('supply'), vaccine: Math.min(0.85, t('vaccine')), firewall: Math.min(0.85, t('firewall')), cargoScan: t('cargoScan') > 0,
      emp: t('emp') > 0, extract: 1 + t('extract'), process: 1 + t('process'), storageMul: 1 + t('storageMul'), powerMul: 1 + t('powerMul'),
    };
  }

  /* The fixed loadout every Daily Belt pilot flies, so scores compare */
  function dailyLoadout() {
    const s = freshSave();
    for (let i = 0; i < UPGRADES.length; ++i) s.upgrades[UPGRADES[i].id] = 3;
    s.tree = { e_boost: 1, f_shield: 1, s_scan: 1, a_drone: 1, d_focus: 2, l_tractor: 1 };
    s.modules.scanner = 1;
    return s;
  }

  /* hold space one unit of an ore takes */
  function oreSpace(stats, oreId) {
    return stats.compress && (oreId === 'iron' || oreId === 'ice' || oreId === 'copper') ? 0.5 : 1;
  }

  /* Raise a counter; never lowers. Returns the new value */
  function bump(save, stat, amount) {
    save.stats[stat] = (save.stats[stat] || 0) + amount;
    return save.stats[stat];
  }

  function record(save, stat, value) {
    if (value > (save.stats[stat] || 0)) save.stats[stat] = value;
  }

  /* Newly earned achievements (marked and paid in research data) */
  function checkAchievements(save) {
    const out = [];
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) {
      const a = ACHIEVEMENTS[i];
      if (save.achievements[a.id] || (save.stats[a.stat] || 0) < a.need) continue;
      save.achievements[a.id] = true;
      save.rd += a.rd;
      out.push(a);
    }
    return out;
  }

  function achievementCount(save) {
    let n = 0;
    for (let i = 0; i < ACHIEVEMENTS.length; ++i) if (save.achievements[ACHIEVEMENTS[i].id]) ++n;
    return n;
  }

  function addHighScore(save, score, mode, detail) {
    save.highScores.push({ score: Math.floor(score), mode: mode, detail: detail || '' });
    save.highScores.sort((a, b) => b.score - a.score);
    save.highScores.length = Math.min(save.highScores.length, 10);
  }

  Object.assign(NS.rules, {
    START_CREDITS, START_RD, freshSave, migrateSave, nodeLevel, nodeCost, nodeState, buyNode, nodeText,
    upgradeCost, buyUpgrade, buyHull, moduleCost, buildModule, zoneState, buyLicense, computeStats, dailyLoadout,
    oreSpace, bump, record, checkAchievements, achievementCount, addHighScore
  });
})();
