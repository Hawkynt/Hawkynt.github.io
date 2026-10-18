/* Progression rules on a save object: the default save and its migration, tech tree levels,
   states and purchases, ships, weapons and styles, derived ship stats, stars, rewards, unlocks,
   combo multiplier and damage math. Pure functions; never touches the DOM or storage. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const { SHIPS, PRIMARIES, SECONDARIES, SKINS, TRAILS, ENGINES, byId } = NS.ships;
  const { TREE, TREE_BY_ID } = NS.treeData;
  const { MISSIONS, missionId } = NS.campaign;
  const { COMBO_STEPS } = NS.constants;

  const SAVE_VERSION = 2;

  function defaultSave() {
    return {
      v: SAVE_VERSION,
      credits: 0,
      stars: {},
      times: {},
      tree: {},
      ships: ['falcon'],
      ship: 'falcon',
      primaries: ['blaster'],
      secondaries: ['missiles'],
      loadout: { primary: 'blaster', secondary: 'missiles' },
      style: { skin: 'stock', trail: 'standard', engine: 'stock' },
      best: { endless: { score: 0, wave: 0 }, daily: { date: '', score: 0 }, bossRush: { score: 0, cleared: 0 } },
      highScores: [],
      stats: { runs: 0, kills: 0, bosses: 0, missions: 0, scrap: 0 },
      seenHelp: false,
      migrated: false,
    };
  }

  function isObj(o) {
    return !!o && typeof o === 'object' && !Array.isArray(o);
  }

  /* Normalise any stored value into a valid v2 save. `oldScores` is the raw high-score list of
     the first version of the game ([{ score, wave }]); it is folded in once, with a veteran bonus. */
  function migrateSave(stored, oldScores) {
    const save = defaultSave();
    if (isObj(stored)) {
      if (typeof stored.credits === 'number' && stored.credits >= 0) save.credits = Math.floor(stored.credits);
      ['stars', 'times', 'tree'].forEach(k => {
        if (isObj(stored[k]))
          for (const id in stored[k])
            if (typeof stored[k][id] === 'number' && stored[k][id] >= 0)
              save[k][id] = stored[k][id];
      });
      ['ships', 'primaries', 'secondaries'].forEach(k => {
        if (Array.isArray(stored[k]))
          save[k] = stored[k].filter(id => typeof id === 'string');
      });
      if (save.ships.indexOf('falcon') < 0) save.ships.unshift('falcon');
      if (save.primaries.indexOf('blaster') < 0) save.primaries.unshift('blaster');
      if (save.secondaries.indexOf('missiles') < 0) save.secondaries.unshift('missiles');
      if (typeof stored.ship === 'string' && save.ships.indexOf(stored.ship) >= 0) save.ship = stored.ship;
      if (isObj(stored.loadout)) {
        if (save.primaries.indexOf(stored.loadout.primary) >= 0) save.loadout.primary = stored.loadout.primary;
        if (save.secondaries.indexOf(stored.loadout.secondary) >= 0) save.loadout.secondary = stored.loadout.secondary;
      }
      if (isObj(stored.style)) {
        if (SKINS[stored.style.skin]) save.style.skin = stored.style.skin;
        if (TRAILS[stored.style.trail]) save.style.trail = stored.style.trail;
        if (ENGINES[stored.style.engine]) save.style.engine = stored.style.engine;
      }
      if (isObj(stored.best)) {
        const b = stored.best;
        if (isObj(b.endless)) save.best.endless = { score: +b.endless.score || 0, wave: +b.endless.wave || 0 };
        if (isObj(b.daily) && typeof b.daily.date === 'string') save.best.daily = { date: b.daily.date, score: +b.daily.score || 0 };
        if (isObj(b.bossRush)) save.best.bossRush = { score: +b.bossRush.score || 0, cleared: +b.bossRush.cleared || 0 };
      }
      if (Array.isArray(stored.highScores))
        save.highScores = stored.highScores.filter(s => isObj(s) && typeof s.score === 'number').slice(0, 10);
      if (isObj(stored.stats))
        for (const k in save.stats)
          if (typeof stored.stats[k] === 'number') save.stats[k] = stored.stats[k];
      save.seenHelp = !!stored.seenHelp;
      save.migrated = !!stored.migrated;
    }
    if (!save.migrated && Array.isArray(oldScores) && oldScores.length) {
      let best = 0;
      for (let i = 0; i < oldScores.length; ++i) {
        const s = oldScores[i];
        if (!isObj(s) || typeof s.score !== 'number') continue;
        save.highScores.push({ score: Math.floor(s.score), wave: +s.wave || 0, mode: 'endless' });
        best = Math.max(best, s.score);
      }
      save.highScores.sort((a, b) => b.score - a.score);
      save.highScores.length = Math.min(save.highScores.length, 10);
      save.credits += Math.min(1500, Math.floor(best / 40));
      if (best > save.best.endless.score) save.best.endless.score = Math.floor(best);
    }
    if (Array.isArray(oldScores) || save.migrated)
      save.migrated = true;
    return save;
  }

  /* ── tech tree ── */
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
      if (nodeLevel(save, n.req[i][0]) < n.req[i][1])
        return false;
    return true;
  }

  /* 'maxed' | 'locked' (prerequisites missing) | 'expensive' | 'available' */
  function nodeState(save, id) {
    const n = TREE_BY_ID[id];
    if (nodeLevel(save, id) >= n.costs.length) return 'maxed';
    if (!reqsMet(save, n)) return 'locked';
    if (save.credits < nodeCost(save, id)) return 'expensive';
    return 'available';
  }

  function buyNode(save, id) {
    if (nodeState(save, id) !== 'available') return false;
    save.credits -= nodeCost(save, id);
    save.tree[id] = nodeLevel(save, id) + 1;
    const n = TREE_BY_ID[id];
    if (n.style) save.style[n.style] = n.value;
    return true;
  }

  /* One level's effect as text */
  function nodeText(n, level) {
    const lv = Math.max(1, level);
    const v = (n.per || 0) * lv;
    return n.fmt.replace('{p}', String(Math.round(v * 100))).replace('{v}', String(Math.round(v * 10) / 10));
  }

  function styleOwned(save, kind, value) {
    if (value === 'stock' || value === 'standard') return true;
    for (let i = 0; i < TREE.length; ++i)
      if (TREE[i].style === kind && TREE[i].value === value)
        return nodeLevel(save, TREE[i].id) > 0;
    return false;
  }

  function equipStyle(save, kind, value) {
    if (!styleOwned(save, kind, value)) return false;
    save.style[kind] = save.style[kind] === value ? (kind === 'trail' ? 'standard' : 'stock') : value;
    return true;
  }

  /* ── hangar ── */
  function buyItem(save, listKey, catalogue, id) {
    const item = byId(catalogue, id);
    if (!item || save[listKey].indexOf(id) >= 0 || save.credits < item.cost) return false;
    save.credits -= item.cost;
    save[listKey].push(id);
    return true;
  }

  function buyShip(save, id) {
    if (!buyItem(save, 'ships', SHIPS, id)) return false;
    save.ship = id;
    return true;
  }

  function buyPrimary(save, id) {
    if (!buyItem(save, 'primaries', PRIMARIES, id)) return false;
    save.loadout.primary = id;
    return true;
  }

  function buySecondary(save, id) {
    if (!buyItem(save, 'secondaries', SECONDARIES, id)) return false;
    save.loadout.secondary = id;
    return true;
  }

  /* ── derived stats ── */
  function computeStats(save, shipId) {
    const ship = byId(SHIPS, shipId || save.ship) || SHIPS[0];
    const t = {};
    for (let i = 0; i < TREE.length; ++i) {
      const n = TREE[i];
      if (n.stat) t[n.stat] = (n.per || 0) * nodeLevel(save, n.id);
    }
    const g = k => t[k] || 0;
    const bonus = ship.bonus || {};
    return {
      ship: ship.id,
      hull: Math.round(ship.hull * (1 + g('hull'))),
      shield: Math.round(ship.shield * (1 + g('shield'))),
      regen: ship.regen * (1 + g('regen')),
      shieldDelay: Math.max(1.2, 3 - g('regen') * 1.5),
      thrust: ship.thrust * (1 + g('thrust')),
      speed: ship.speed * (1 + g('thrust') * 0.75),
      grip: 1 + g('grip'),
      boostCap: ship.boost * (1 + g('boostCap')),
      rollCd: ship.roll * (1 - g('rollCd')),
      dmgMul: ship.dmg * (1 + g('dmg')),
      rateMul: 1 + g('rate'),
      projSpeed: 1 + g('projSpeed'),
      crit: g('crit'),
      ammoMul: 1 + g('ammo'),
      secDmg: 1 + g('secDmg'),
      overTime: g('overTime'),
      armor: g('armor'),
      repair: g('repair'),
      lastStand: g('lastStand') > 0,
      ram: g('ram'),
      burn: g('burn') > 0,
      radar: 1 + g('radar') + (bonus.radar || 0),
      magnet: 1 + g('magnet'),
      salvage: 1 + g('salvage'),
      droneAi: g('droneAi'),
      escortDrones: (g('droneAi') >= 3 ? 1 : 0) + (bonus.drones || 0),
      abilityCd: 1 - g('abilityCd'),
      luck: 1 + g('luck'),
    };
  }

  /* Weapon damage after multipliers; `roll` in [0,1) decides the critical hit */
  function hitDamage(base, stats, roll, extraMul) {
    let d = base * stats.dmgMul * (extraMul || 1);
    const crit = roll < stats.crit;
    if (crit) d *= 2;
    return { dmg: d, crit: crit };
  }

  /* Hull damage after armour (shield damage is not reduced) */
  function armorDamage(amount, stats) {
    return amount * (1 - Math.min(0.6, stats.armor));
  }

  function comboMultiplier(combo) {
    let m = 1;
    for (let i = 1; i < COMBO_STEPS.length; ++i)
      if (combo >= COMBO_STEPS[i]) m = i + 1;
    return m;
  }

  /* ── campaign ── */
  function missionStars(won, hullFrac, time, par) {
    if (!won) return 0;
    let s = 1;
    if (hullFrac >= 0.5) ++s;
    if (time <= par) ++s;
    return s;
  }

  function missionReward(sector, index, stars, prevStars) {
    const base = 110 + sector * 55 + index * 18 + (index === 5 ? 260 + sector * 80 : 0);
    const newStars = Math.max(0, stars - (prevStars || 0));
    return stars > 0 ? Math.round(base * (prevStars > 0 ? 0.4 : 1) + newStars * (40 + sector * 15)) : Math.round(base * 0.2);
  }

  function sectorUnlocked(save, s) {
    return s === 0 || (save.stars[missionId(s - 1, 5)] || 0) > 0;
  }

  function missionUnlocked(save, s, i) {
    if (!sectorUnlocked(save, s)) return false;
    return i === 0 || (save.stars[missionId(s, i - 1)] || 0) > 0;
  }

  function totalStars(save) {
    let n = 0;
    for (let s = 0; s < MISSIONS.length; ++s)
      for (let i = 0; i < MISSIONS[s].length; ++i)
        n += save.stars[missionId(s, i)] || 0;
    return n;
  }

  function bossRushUnlocked(save) {
    return (save.stars[missionId(0, 5)] || 0) > 0;
  }

  /* Scrap paid for arcade-mode score (campaign pays per mission) */
  function scoreScrap(score, stats) {
    return Math.floor(score / 45 * (stats ? stats.salvage : 1));
  }

  function addHighScore(save, entry) {
    save.highScores.push(entry);
    save.highScores.sort((a, b) => b.score - a.score);
    save.highScores.length = Math.min(save.highScores.length, 10);
  }

  Object.assign(NS.rules, {
    SAVE_VERSION, defaultSave, migrateSave, nodeLevel, nodeCost, nodeState, buyNode, nodeText, reqsMet,
    styleOwned, equipStyle, buyShip, buyPrimary, buySecondary, computeStats, hitDamage, armorDamage,
    comboMultiplier, missionStars, missionReward, sectorUnlocked, missionUnlocked, totalStars,
    bossRushUnlocked, scoreScrap, addHighScore
  });
})();
