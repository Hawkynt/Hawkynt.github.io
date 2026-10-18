;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Progression for the Physics Puzzle: the v2 save and its migration,
   * coins, the five-branch tech tree and the stats it grants, the three
   * stars of a level, rewards, world unlocks, ball skins and trails.
   * Pure data and math; the controller stores the save.
   */

  const SAVE_VERSION = 2;
  const STAR_GATES = [0, 10, 26, 42, 58];   // stars needed to open each world

  const BRANCHES = Object.freeze({
    launcher: { id: 'launcher', name: 'Launcher', color: '#ffb84a', icon: 'launcher' },
    parts: { id: 'parts', name: 'Parts', color: '#5ad1ff', icon: 'gear' },
    physics: { id: 'physics', name: 'Physics', color: '#8aff9a', icon: 'atom' },
    fortune: { id: 'fortune', name: 'Fortune', color: '#ffe066', icon: 'coin' },
    style: { id: 'style', name: 'Style', color: '#d08aff', icon: 'star' }
  });
  const BRANCH_ORDER = ['launcher', 'parts', 'physics', 'fortune', 'style'];

  /* costs[i] buys rank i + 1; req = [[nodeId, rank], ...] */
  const TREE = [
    { id: 'power', branch: 'launcher', name: 'Power Cell', costs: [90, 220, 420], req: [],
      desc: ['The launcher shoots 8 % harder.', 'The launcher shoots 16 % harder.', 'The launcher shoots 24 % harder.'] },
    { id: 'sight', branch: 'launcher', name: 'Long Sight', costs: [70, 180, 360], req: [],
      desc: ['A longer aiming guide.', 'An even longer aiming guide.', 'The aiming guide follows most of the flight.'] },
    { id: 'ricochet', branch: 'launcher', name: 'Ricochet Sight', costs: [320], req: [['sight', 2]],
      desc: ['The aiming guide shows bounces off walls and parts.'] },
    { id: 'multi', branch: 'launcher', name: 'Twin Shot', costs: [260, 520], req: [['power', 1]],
      desc: ['Fire two balls at once (toggle with M).', 'Fire three balls at once (toggle with M).'] },

    { id: 'sparePlank', branch: 'parts', name: 'Spare Plank', costs: [150], req: [],
      desc: ['One extra plank in every level.'] },
    { id: 'spareSpring', branch: 'parts', name: 'Spare Spring', costs: [280], req: [['sparePlank', 1]],
      desc: ['One extra spring pad in every level.'] },
    { id: 'machinist', branch: 'parts', name: 'Machinist', costs: [120], req: [],
      desc: ['Fans, conveyors and magnets in the Sandbox.'] },
    { id: 'demolition', branch: 'parts', name: 'Demolition Kit', costs: [160], req: [['machinist', 1]],
      desc: ['Crates, glass panes and TNT in the Sandbox.'] },
    { id: 'blueprint', branch: 'parts', name: 'Blueprint', costs: [200, 400], req: [['sparePlank', 1]],
      desc: ['Press B in a level to see where one part of a known solution goes.', 'The Blueprint shows every part and the shot.'] },

    { id: 'bullet', branch: 'physics', name: 'Bullet Time', costs: [140, 300], req: [],
      desc: ['Hold Space mid-flight for 2 s of slow motion per shot.', 'Hold Space mid-flight for 4 s of slow motion per shot.'] },
    { id: 'rubber', branch: 'physics', name: 'Rubber Core', costs: [180, 380], req: [],
      desc: ['The ball bounces 15 % livelier.', 'The ball bounces 30 % livelier.'] },
    { id: 'replay', branch: 'physics', name: 'Ghost Trail', costs: [110], req: [],
      desc: ['Your last shot leaves a faint trail to aim against.'] },
    { id: 'steady', branch: 'physics', name: 'Steady Hand', costs: [160], req: [['replay', 1]],
      desc: ['Fine aim: the angle and power read out, and Shift + arrows nudge in tiny steps.'] },

    { id: 'purse', branch: 'fortune', name: 'Coin Purse', costs: [120, 280, 520], req: [],
      desc: ['Levels pay 20 % more coins.', 'Levels pay 45 % more coins.', 'Levels pay 75 % more coins.'] },
    { id: 'bounty', branch: 'fortune', name: 'Star Bounty', costs: [150, 330], req: [],
      desc: ['Every star picked up in the air pays 4 coins.', 'Every star picked up in the air pays 8 coins.'] },
    { id: 'dailyBonus', branch: 'fortune', name: 'Daily Ticket', costs: [200], req: [['purse', 1]],
      desc: ['The Daily challenge pays double.'] },
    { id: 'trickBonus', branch: 'fortune', name: 'Showman', costs: [220], req: [['bounty', 1]],
      desc: ['Trick Shots pay 50 % more.'] },

    { id: 'skinCopper', branch: 'style', name: 'Copper Ball', costs: [80], req: [], skin: 'copper',
      desc: ['A warm, polished copper ball.'] },
    { id: 'skinMarble', branch: 'style', name: 'Glass Marble', costs: [180], req: [['skinCopper', 1]], skin: 'marble',
      desc: ['A clear marble with a swirl of colour.'] },
    { id: 'skinGold', branch: 'style', name: 'Gold Ball', costs: [360], req: [['skinMarble', 1]], skin: 'gold',
      desc: ['Solid gold, for show-offs.'] },
    { id: 'skinPlasma', branch: 'style', name: 'Plasma Orb', costs: [520], req: [['skinGold', 1]], skin: 'plasma',
      desc: ['A crackling orb of light.'] },
    { id: 'trailSpark', branch: 'style', name: 'Spark Trail', costs: [90], req: [], trail: 'spark',
      desc: ['Golden sparks stream behind the ball.'] },
    { id: 'trailComet', branch: 'style', name: 'Comet Trail', costs: [220], req: [['trailSpark', 1]], trail: 'comet',
      desc: ['A blazing comet tail.'] },
    { id: 'trailRainbow', branch: 'style', name: 'Rainbow Trail', costs: [380], req: [['trailComet', 1]], trail: 'rainbow',
      desc: ['A ribbon of every colour.'] }
  ];

  const TREE_BY_ID = {};
  for (const n of TREE)
    TREE_BY_ID[n.id] = n;

  const SKINS = Object.freeze([
    { id: 'steel', name: 'Steel', node: null, base: '#c8d0dc', dark: '#4a5466', glow: '#ffffff' },
    { id: 'copper', name: 'Copper', node: 'skinCopper', base: '#f0a060', dark: '#7a3818', glow: '#ffd0a0' },
    { id: 'marble', name: 'Marble', node: 'skinMarble', base: '#bfe8ff', dark: '#3a78b0', glow: '#ffffff' },
    { id: 'gold', name: 'Gold', node: 'skinGold', base: '#ffd84a', dark: '#9a6a10', glow: '#fff4b0' },
    { id: 'plasma', name: 'Plasma', node: 'skinPlasma', base: '#e0a0ff', dark: '#6a20c0', glow: '#ffd0ff' }
  ]);

  const TRAILS = Object.freeze([
    { id: 'none', name: 'None', node: null },
    { id: 'spark', name: 'Sparks', node: 'trailSpark' },
    { id: 'comet', name: 'Comet', node: 'trailComet' },
    { id: 'rainbow', name: 'Rainbow', node: 'trailRainbow' }
  ]);

  const SANDBOX_BASE = ['plank', 'block', 'spring', 'bumper'];

  function defaultSave() {
    return {
      version: SAVE_VERSION,
      coins: 0,
      levels: {},
      tricks: {},
      tree: {},
      skin: 'steel', trail: 'none', multiOn: true,
      daily: { date: '', cleared: false, best: 0, stars: 0 },
      stats: { shots: 0, wins: 0, starsTaken: 0, glass: 0, tnt: 0, coins: 0, bounces: 0 },
      tutorialSeen: false
    };
  }

  function int(v, lo, hi) {
    v = Math.floor(Number(v) || 0);
    return Math.max(lo, Math.min(hi, v));
  }

  /* any stored object -> a clean v2 save; unknown or older versions start fresh */
  function migrate(raw) {
    const s = defaultSave();
    if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION)
      return s;
    s.coins = int(raw.coins, 0, 1e9);
    if (raw.levels && typeof raw.levels === 'object') {
      for (const id of Object.keys(raw.levels)) {
        const l = raw.levels[id];
        if (!l || typeof l !== 'object')
          continue;
        const st = Array.isArray(l.stars) ? l.stars : [];
        s.levels[id] = { stars: [!!st[0], !!st[1], !!st[2]], best: int(l.best, 0, 999), plays: int(l.plays, 0, 1e6) };
      }
    }
    if (raw.tricks && typeof raw.tricks === 'object')
      for (const id of Object.keys(raw.tricks))
        if (raw.tricks[id])
          s.tricks[id] = true;
    if (raw.tree && typeof raw.tree === 'object') {
      for (const id of Object.keys(raw.tree))
        if (TREE_BY_ID[id])
          s.tree[id] = int(raw.tree[id], 0, TREE_BY_ID[id].costs.length);
    }
    if (SKINS.some(k => k.id === raw.skin) && skinOwned(s, raw.skin))
      s.skin = raw.skin;
    if (TRAILS.some(k => k.id === raw.trail) && trailOwned(s, raw.trail))
      s.trail = raw.trail;
    s.multiOn = raw.multiOn !== false;
    if (raw.daily && typeof raw.daily === 'object') {
      s.daily.date = typeof raw.daily.date === 'string' ? raw.daily.date.slice(0, 10) : '';
      s.daily.cleared = !!raw.daily.cleared;
      s.daily.best = int(raw.daily.best, 0, 999);
      s.daily.stars = int(raw.daily.stars, 0, 3);
    }
    if (raw.stats && typeof raw.stats === 'object')
      for (const k of Object.keys(s.stats))
        s.stats[k] = int(raw.stats[k], 0, 1e9);
    s.tutorialSeen = !!raw.tutorialSeen;
    return s;
  }

  /* ── tree ── */

  function level(save, id) {
    return save.tree[id] || 0;
  }

  /* 'maxed' | 'locked' | 'expensive' | 'available' */
  function nodeState(save, id) {
    const n = TREE_BY_ID[id];
    const lv = level(save, id);
    if (lv >= n.costs.length)
      return 'maxed';
    for (const r of n.req)
      if (level(save, r[0]) < r[1])
        return 'locked';
    return save.coins >= n.costs[lv] ? 'available' : 'expensive';
  }

  function nextCost(save, id) {
    const n = TREE_BY_ID[id];
    const lv = level(save, id);
    return lv < n.costs.length ? n.costs[lv] : 0;
  }

  function buy(save, id) {
    if (nodeState(save, id) !== 'available')
      return false;
    save.coins -= nextCost(save, id);
    save.tree[id] = level(save, id) + 1;
    return true;
  }

  function treeProgress(save) {
    let have = 0, total = 0;
    for (const n of TREE) {
      have += level(save, n.id);
      total += n.costs.length;
    }
    return { have: have, total: total };
  }

  function totalTreeCost() {
    return TREE.reduce((a, n) => a + n.costs.reduce((b, c) => b + c, 0), 0);
  }

  /* everything the tree changes in play, as plain numbers and flags */
  function computeStats(save) {
    const lv = (id) => level(save, id);
    const sandbox = SANDBOX_BASE.slice();
    if (lv('machinist'))
      sandbox.push('fan', 'conveyor', 'magnet');
    if (lv('demolition'))
      sandbox.push('crate', 'glass', 'tnt');
    return {
      powerMul: 1 + 0.08 * lv('power'),
      sight: [0.42, 0.7, 1.05, 1.6][lv('sight')],
      ricochet: lv('ricochet') > 0,
      extraBalls: save.multiOn === false ? 0 : lv('multi'),
      multiOwned: lv('multi'),
      spare: { plank: lv('sparePlank'), spring: lv('spareSpring') },
      sandboxParts: sandbox,
      blueprint: lv('blueprint'),
      bulletTime: [0, 2, 4][lv('bullet')],
      rubber: [0, 0.075, 0.15][lv('rubber')],
      ghostTrail: lv('replay') > 0,
      steady: lv('steady') > 0,
      coinMul: [1, 1.2, 1.45, 1.75][lv('purse')],
      starBonus: [0, 4, 8][lv('bounty')],
      dailyMul: lv('dailyBonus') ? 2 : 1,
      trickMul: lv('trickBonus') ? 1.5 : 1
    };
  }

  function skinOwned(save, id) {
    const k = SKINS.find(s => s.id === id);
    return !!k && (!k.node || level(save, k.node) > 0);
  }

  function trailOwned(save, id) {
    const k = TRAILS.find(s => s.id === id);
    return !!k && (!k.node || level(save, k.node) > 0);
  }

  /* ── stars, rewards and unlocks ── */

  /* stars of one finished run: [solved, within par, every star taken] */
  function runStars(level, result) {
    const nStars = (level.stars || []).length;
    return [!!result.win, !!result.win && result.shots <= level.par, !!result.win && result.starsTaken >= nStars];
  }

  function levelRecord(save, id) {
    return save.levels[id] || { stars: [false, false, false], best: 0, plays: 0 };
  }

  function starCount(save, id) {
    return levelRecord(save, id).stars.filter(Boolean).length;
  }

  function totalStars(save, levels) {
    return levels.reduce((a, l) => a + starCount(save, l.id), 0);
  }

  function cleared(save, id) {
    return levelRecord(save, id).stars[0];
  }

  /*
   * The coins a finished campaign run pays and the records it sets. A first
   * clear pays the most, each newly earned star pays a bonus, replays pay a
   * little. Mutates the save and returns { coins, newStars, first, stars }.
   */
  function applyLevelResult(save, level, result, stats) {
    const rec = levelRecord(save, level.id);
    const stars = runStars(level, result);
    const before = rec.stars.slice();
    const first = stars[0] && !before[0];
    let newStars = 0;
    for (let i = 0; i < 3; ++i)
      if (stars[i] && !before[i])
        ++newStars;
    let coins = 0;
    if (stars[0]) {
      const base = 40 + 10 * (level.world || 0);
      coins = first ? base : Math.round(base * 0.3);
      coins += newStars * 20;
      coins = Math.round(coins * stats.coinMul);
    }
    coins += (result.starsTaken || 0) * stats.starBonus;
    const out = {
      stars: [before[0] || stars[0], before[1] || stars[1], before[2] || stars[2]],
      best: stars[0] ? (rec.best ? Math.min(rec.best, result.shots) : result.shots) : rec.best,
      plays: rec.plays + 1
    };
    save.levels[level.id] = out;
    save.coins += coins;
    save.stats.coins += coins;
    if (stars[0])
      ++save.stats.wins;
    return { coins: coins, newStars: newStars, first: first, stars: stars };
  }

  function applyTrickResult(save, trick, win, stats) {
    if (!win)
      return { coins: 0, first: false };
    const first = !save.tricks[trick.id];
    save.tricks[trick.id] = true;
    const coins = Math.round((first ? 60 : 12) * stats.trickMul);
    save.coins += coins;
    save.stats.coins += coins;
    return { coins: coins, first: first };
  }

  function applyDailyResult(save, dateKey, result, level, stats) {
    if (!result.win)
      return { coins: 0, first: false };
    if (save.daily.date !== dateKey)
      save.daily = { date: dateKey, cleared: false, best: 0, stars: 0 };
    const stars = runStars(level, result).filter(Boolean).length;
    const first = !save.daily.cleared;
    let coins = first ? 50 + 10 * stars : 0;
    if (!first && stars > save.daily.stars)
      coins = 10 * (stars - save.daily.stars);
    coins *= stats.dailyMul;
    save.daily.cleared = true;
    save.daily.best = save.daily.best ? Math.min(save.daily.best, result.shots) : result.shots;
    save.daily.stars = Math.max(save.daily.stars, stars);
    save.coins += coins;
    save.stats.coins += coins;
    return { coins: coins, first: first, stars: stars };
  }

  /* a world opens with enough stars and the previous world's first level cleared */
  function worldUnlocked(save, levels, w) {
    if (w === 0)
      return true;
    const prev = levels.filter(l => l.world === w - 1);
    return totalStars(save, levels) >= STAR_GATES[w] && prev.length > 0 && cleared(save, prev[prev.length - 1].id);
  }

  /* inside a world, each level needs the one before it */
  function levelUnlocked(save, levels, id) {
    const i = levels.findIndex(l => l.id === id);
    if (i < 0)
      return false;
    const l = levels[i];
    if (!worldUnlocked(save, levels, l.world))
      return false;
    const prev = levels[i - 1];
    return !prev || prev.world !== l.world || cleared(save, prev.id);
  }

  function trickUnlocked(save, trick) {
    return cleared(save, trick.base);
  }

  SZ.PhysicsPuzzleProgress = Object.freeze({
    SAVE_VERSION: SAVE_VERSION, STAR_GATES: STAR_GATES,
    BRANCHES: BRANCHES, BRANCH_ORDER: BRANCH_ORDER, TREE: TREE, TREE_BY_ID: TREE_BY_ID,
    SKINS: SKINS, TRAILS: TRAILS, SANDBOX_BASE: SANDBOX_BASE,
    defaultSave: defaultSave, migrate: migrate,
    level: level, nodeState: nodeState, nextCost: nextCost, buy: buy, treeProgress: treeProgress, totalTreeCost: totalTreeCost,
    computeStats: computeStats, skinOwned: skinOwned, trailOwned: trailOwned,
    runStars: runStars, levelRecord: levelRecord, starCount: starCount, totalStars: totalStars, cleared: cleared,
    applyLevelResult: applyLevelResult, applyTrickResult: applyTrickResult, applyDailyResult: applyDailyResult,
    worldUnlocked: worldUnlocked, levelUnlocked: levelUnlocked, trickUnlocked: trickUnlocked
  });
})();
