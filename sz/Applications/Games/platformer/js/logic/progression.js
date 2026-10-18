;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Progression for the Platformer: the v2 save, coins and gems, the
   * five-branch tech tree and the stats it grants, stars and rewards,
   * hero skins and trails, and the compact ghost encoding used by Time Trial.
   * Pure data and math; js/core/storage.js stores the save.
   */

  const SAVE_VERSION = 2;

  const BRANCHES = Object.freeze({
    movement: { id: 'movement', name: 'Movement', color: '#5ad1ff', icon: 'boot' },
    survival: { id: 'survival', name: 'Survival', color: '#ff6a86', icon: 'heart' },
    fortune: { id: 'fortune', name: 'Fortune', color: '#ffd75a', icon: 'coin' },
    arsenal: { id: 'arsenal', name: 'Arsenal', color: '#ff8a3a', icon: 'flame' },
    style: { id: 'style', name: 'Style', color: '#c88aff', icon: 'star' }
  });
  const BRANCH_ORDER = ['movement', 'survival', 'fortune', 'arsenal', 'style'];

  function c(coins, gems) {
    return { coins: coins, gems: gems || 0 };
  }

  /* costs[i] buys level i + 1; req = [[nodeId, level], ...] */
  const TREE = [
    { id: 'wallJump', branch: 'movement', name: 'Wall Kick', costs: [c(120)], req: [],
      desc: ['Slide down walls and kick off them to climb shafts.'] },
    { id: 'airControl', branch: 'movement', name: 'Air Control', costs: [c(80), c(200)], req: [],
      desc: ['Steer harder in mid-air.', 'Steer as freely in the air as on the ground.'] },
    { id: 'dash', branch: 'movement', name: 'Dash', costs: [c(180, 1), c(420, 4)], req: [['wallJump', 1]],
      desc: ['Burst sideways with Shift or X, once per jump. Smashes crates.', 'A longer dash, refreshed by every stomp.'] },
    { id: 'doubleJump', branch: 'movement', name: 'Cloud Step', costs: [c(260, 3)], req: [['airControl', 1]],
      desc: ['Jump a second time in mid-air.'] },

    { id: 'hearts', branch: 'survival', name: 'Heart Container', costs: [c(100), c(260, 2), c(520, 5)], req: [],
      desc: ['One more heart: 4 in total.', 'One more heart: 5 in total.', 'One more heart: 6 in total.'] },
    { id: 'mercy', branch: 'survival', name: 'Second Wind', costs: [c(120), c(260)], req: [],
      desc: ['Longer safety blink after a hit.', 'An even longer safety blink after a hit.'] },
    { id: 'mender', branch: 'survival', name: 'Hearth Flag', costs: [c(160)], req: [['hearts', 1]],
      desc: ['Checkpoints refill your hearts.'] },
    { id: 'shield', branch: 'survival', name: 'Bubble Shield', costs: [c(320, 2)], req: [['mercy', 1]],
      desc: ['A bubble that swallows one hit, restored at every checkpoint.'] },

    { id: 'magnet', branch: 'fortune', name: 'Coin Magnet', costs: [c(90), c(220), c(450, 2)], req: [],
      desc: ['Coins within 2 tiles fly to you.', 'Coins within 3.5 tiles fly to you.', 'Coins within 5 tiles fly to you.'] },
    { id: 'coinBonus', branch: 'fortune', name: 'Golden Touch', costs: [c(150), c(350, 1), c(700, 3)], req: [],
      desc: ['Coins are worth 25 % more.', 'Coins are worth 50 % more.', 'Coins are worth double.'] },
    { id: 'lucky', branch: 'fortune', name: 'Lucky Blocks', costs: [c(120), c(300, 1)], req: [['coinBonus', 1]],
      desc: ['Coin blocks pay out three coins.', 'Coin blocks pay out five coins.'] },
    { id: 'radar', branch: 'fortune', name: 'Gem Radar', costs: [c(200, 2)], req: [['magnet', 1]],
      desc: ['An arrow and a chime lead you to the nearest hidden gem.'] },

    { id: 'fire', branch: 'arsenal', name: 'Ember Heart', costs: [c(200), c(400, 2), c(700, 4)], req: [],
      desc: ['Start every level with fireballs (C or F).', 'Two fireballs at once, and they bounce higher.', 'Big piercing fireballs.'] },
    { id: 'shockwave', branch: 'arsenal', name: 'Stomp Shockwave', costs: [c(220), c(450, 2)], req: [],
      desc: ['Stomps send out a shockwave that flattens nearby foes.', 'A wider, stronger shockwave.'] },
    { id: 'slayer', branch: 'arsenal', name: 'Giant Slayer', costs: [c(350, 3)], req: [['fire', 1], ['shockwave', 1]],
      desc: ['Bosses take 50 % more damage from you.'] },

    { id: 'skinForest', branch: 'style', name: 'Ranger Cloak', costs: [c(150)], req: [], skin: 'forest',
      desc: ['A leaf-green ranger hood and cloak.'] },
    { id: 'skinFrost', branch: 'style', name: 'Frost Parka', costs: [c(250, 1)], req: [['skinForest', 1]], skin: 'frost',
      desc: ['A snow-white parka with ice-blue trim.'] },
    { id: 'skinEmber', branch: 'style', name: 'Ember Garb', costs: [c(350, 2)], req: [['skinFrost', 1]], skin: 'ember',
      desc: ['Smouldering black and orange forge leathers.'] },
    { id: 'skinStorm', branch: 'style', name: 'Storm Mantle', costs: [c(500, 3)], req: [['skinEmber', 1]], skin: 'storm',
      desc: ['A violet mantle crackling with gold.'] },
    { id: 'trailSpark', branch: 'style', name: 'Spark Trail', costs: [c(120)], req: [], trail: 'spark',
      desc: ['Golden sparks follow your every step.'] },
    { id: 'trailRainbow', branch: 'style', name: 'Prism Trail', costs: [c(300, 2)], req: [['trailSpark', 1]], trail: 'rainbow',
      desc: ['A ribbon of every colour streams behind you.'] },
    { id: 'trailShadow', branch: 'style', name: 'Shadow Trail', costs: [c(400, 3)], req: [['trailRainbow', 1]], trail: 'shadow',
      desc: ['Echoes of you hang in the air as you run.'] }
  ];

  const TREE_BY_ID = {};
  for (const n of TREE)
    TREE_BY_ID[n.id] = n;

  const SKINS = Object.freeze([
    { id: 'classic', name: 'Wanderer', tunic: '#3a6ed8', trim: '#ffd75a', scarf: '#e83a3a', hood: '#2a4ea8', skin: '#ffd2a8', boots: '#6a3a1e', node: null },
    { id: 'forest', name: 'Ranger', tunic: '#3e8a3a', trim: '#c8e070', scarf: '#8a5a2a', hood: '#2a6a2a', skin: '#f0c49a', boots: '#4a2e14', node: 'skinForest' },
    { id: 'frost', name: 'Frost', tunic: '#e8f2ff', trim: '#7ad8ff', scarf: '#4aa8ff', hood: '#c8dcf0', skin: '#ffe0c8', boots: '#4a6a8a', node: 'skinFrost' },
    { id: 'ember', name: 'Ember', tunic: '#2a2228', trim: '#ff8a3a', scarf: '#ffcf4a', hood: '#3a2a2a', skin: '#e8b08a', boots: '#1a1210', node: 'skinEmber' },
    { id: 'storm', name: 'Storm', tunic: '#5a3aa8', trim: '#ffe08a', scarf: '#c88aff', hood: '#3a2478', skin: '#ffd8b8', boots: '#2a1a4a', node: 'skinStorm' },
    { id: 'gold', name: 'Champion', tunic: '#e8b830', trim: '#fff2b0', scarf: '#ffffff', hood: '#c8901a', skin: '#ffd2a8', boots: '#7a4a10', node: null, stars: 90 }
  ]);

  const TRAILS = Object.freeze([
    { id: 'none', name: 'None', node: null },
    { id: 'spark', name: 'Sparks', node: 'trailSpark' },
    { id: 'rainbow', name: 'Prism', node: 'trailRainbow' },
    { id: 'shadow', name: 'Shadow', node: 'trailShadow' }
  ]);

  function defaultSave() {
    return {
      version: SAVE_VERSION,
      coins: 0, gems: 0,
      levels: {},
      tree: {},
      skin: 'classic', trail: 'none',
      endless: { best: 0, bestStage: 0 },
      daily: { date: '', bestTime: 0, cleared: false, rewarded: false },
      stats: { deaths: 0, stomps: 0, coins: 0, gems: 0, jumps: 0, playTime: 0, clears: 0 },
      tutorialSeen: false
    };
  }

  /* any stored object (v1 had no save at all, only high scores) -> a clean v2 save */
  function migrate(raw) {
    const s = defaultSave();
    if (!raw || typeof raw !== 'object' || raw.version !== SAVE_VERSION)
      return s;
    s.coins = Math.max(0, Math.floor(Number(raw.coins) || 0));
    s.gems = Math.max(0, Math.floor(Number(raw.gems) || 0));
    if (raw.levels && typeof raw.levels === 'object') {
      for (const id of Object.keys(raw.levels)) {
        const l = raw.levels[id];
        if (!l || typeof l !== 'object')
          continue;
        s.levels[id] = {
          done: !!l.done,
          gems: Array.isArray(l.gems) ? [!!l.gems[0], !!l.gems[1], !!l.gems[2]] : [false, false, false],
          bestTime: Number(l.bestTime) > 0 ? Number(l.bestTime) : 0,
          timeStar: !!l.timeStar,
          ghost: typeof l.ghost === 'string' ? l.ghost : ''
        };
      }
    }
    if (raw.tree && typeof raw.tree === 'object') {
      for (const id of Object.keys(raw.tree)) {
        const n = TREE_BY_ID[id];
        if (n)
          s.tree[id] = Math.max(0, Math.min(n.costs.length, Math.floor(Number(raw.tree[id]) || 0)));
      }
    }
    if (SKINS.some(k => k.id === raw.skin))
      s.skin = raw.skin;
    if (TRAILS.some(k => k.id === raw.trail))
      s.trail = raw.trail;
    if (raw.endless) {
      s.endless.best = Math.max(0, Number(raw.endless.best) || 0);
      s.endless.bestStage = Math.max(0, Number(raw.endless.bestStage) || 0);
    }
    if (raw.daily && typeof raw.daily.date === 'string') {
      s.daily.date = raw.daily.date;
      s.daily.bestTime = Number(raw.daily.bestTime) || 0;
      s.daily.cleared = !!raw.daily.cleared;
      s.daily.rewarded = !!raw.daily.rewarded;
    }
    if (raw.stats)
      for (const k of Object.keys(s.stats))
        s.stats[k] = Math.max(0, Number(raw.stats[k]) || 0);
    s.tutorialSeen = !!raw.tutorialSeen;
    return s;
  }

  /* ── tree ── */

  function level(save, id) {
    return save.tree[id] || 0;
  }

  function reqMet(save, node) {
    for (const r of node.req)
      if (level(save, r[0]) < r[1])
        return false;
    return true;
  }

  /* 'maxed' | 'locked' | 'expensive' | 'available' */
  function nodeState(save, id) {
    const n = TREE_BY_ID[id];
    const lv = level(save, id);
    if (lv >= n.costs.length)
      return 'maxed';
    if (!reqMet(save, n))
      return 'locked';
    const cost = n.costs[lv];
    if (save.coins < cost.coins || save.gems < cost.gems)
      return 'expensive';
    return 'available';
  }

  function buy(save, id) {
    if (nodeState(save, id) !== 'available')
      return false;
    const n = TREE_BY_ID[id];
    const cost = n.costs[level(save, id)];
    save.coins -= cost.coins;
    save.gems -= cost.gems;
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

  /* what the tree grants, read by the game every frame it matters */
  function computeStats(save) {
    const lv = id => level(save, id);
    return {
      wallJump: lv('wallJump') > 0,
      doubleJump: lv('doubleJump') > 0,
      dash: lv('dash'),
      airControl: lv('airControl'),
      maxHearts: 3 + lv('hearts'),
      mercy: 1.2 + 0.4 * lv('mercy'),
      mender: lv('mender') > 0,
      shield: lv('shield') > 0,
      magnet: [0, 2, 3.5, 5][lv('magnet')],
      coinMul: [1, 1.25, 1.5, 2][lv('coinBonus')],
      blockCoins: [1, 3, 5][lv('lucky')],
      radar: lv('radar') > 0,
      fire: lv('fire'),
      shockwave: lv('shockwave'),
      bossMul: lv('slayer') > 0 ? 1.5 : 1
    };
  }

  /* ── cosmetics ── */

  function totalStars(save) {
    let n = 0;
    for (const id of Object.keys(save.levels))
      n += starsOf(save.levels[id]).filter(Boolean).length;
    return n;
  }

  function skinOwned(save, id) {
    const k = SKINS.find(s => s.id === id);
    if (!k)
      return false;
    if (k.stars)
      return totalStars(save) >= k.stars;
    return !k.node || level(save, k.node) > 0;
  }

  function trailOwned(save, id) {
    const t = TRAILS.find(s => s.id === id);
    return !!t && (!t.node || level(save, t.node) > 0);
  }

  /* ── stars & rewards ── */

  function starsOf(rec) {
    if (!rec || !rec.done)
      return [false, false, false];
    return [true, rec.gems[0] && rec.gems[1] && rec.gems[2], !!rec.timeStar];
  }

  /*
   * Banks a finished campaign run. run = { coins, gems: [bool x3], time, ghost }
   * Returns { coins, newStars, firstClear, newBest, stars } for the results panel.
   */
  function completeLevel(save, id, timeTarget, run) {
    const prev = save.levels[id] || { done: false, gems: [false, false, false], bestTime: 0, timeStar: false, ghost: '' };
    const before = starsOf(prev).filter(Boolean).length;
    const rec = {
      done: true,
      gems: [prev.gems[0] || !!run.gems[0], prev.gems[1] || !!run.gems[1], prev.gems[2] || !!run.gems[2]],
      bestTime: prev.bestTime,
      timeStar: prev.timeStar || run.time <= timeTarget,
      ghost: prev.ghost
    };
    let newGems = 0;
    for (let k = 0; k < 3; ++k)
      if (run.gems[k] && !prev.gems[k])
        ++newGems;
    const newBest = !prev.bestTime || run.time < prev.bestTime;
    if (newBest) {
      rec.bestTime = run.time;
      if (run.ghost)
        rec.ghost = run.ghost;
    }
    save.levels[id] = rec;
    const stars = starsOf(rec);
    const after = stars.filter(Boolean).length;
    const newStars = Math.max(0, after - before);
    const bonus = (prev.done ? 0 : 50) + newStars * 25;
    save.coins += run.coins + bonus;
    save.gems += newGems;
    save.stats.coins += run.coins;
    save.stats.gems += newGems;
    save.stats.clears += 1;
    return { coins: run.coins, bonus: bonus, newStars: newStars, newGems: newGems, firstClear: !prev.done, newBest: newBest, stars: stars };
  }

  function levelDone(save, world, index) {
    const r = save.levels['w' + world + 'l' + index];
    return !!(r && r.done);
  }

  function worldUnlocked(save, world) {
    return world === 0 || levelDone(save, world - 1, 5);
  }

  function levelUnlocked(save, world, index) {
    return worldUnlocked(save, world) && (index === 0 || levelDone(save, world, index - 1));
  }

  function worldStars(save, world) {
    let n = 0;
    for (let i = 0; i < 6; ++i)
      n += starsOf(save.levels['w' + world + 'l' + i]).filter(Boolean).length;
    return n;
  }

  /* ── ghosts: 20 samples a second, delta coded into printable characters ── */

  const ALPHA = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_';
  const GHOST_HZ = 20;
  const POSES = ['idle', 'run', 'jump', 'fall', 'wall', 'dash', 'hurt'];

  function enc2(v) {
    /* two characters, range -2048..2047 */
    const u = Math.max(0, Math.min(4095, Math.round(v) + 2048));
    return ALPHA.charAt(u >> 6) + ALPHA.charAt(u & 63);
  }

  function dec2(s, i) {
    return (ALPHA.indexOf(s.charAt(i)) << 6 | ALPHA.indexOf(s.charAt(i + 1))) - 2048;
  }

  /* samples: [{ x, y, pose, facing }] -> string */
  function encodeGhost(samples) {
    if (!samples.length)
      return '';
    let px = Math.round(samples[0].x), py = Math.round(samples[0].y);
    let out = 'g1' + Math.round(samples[0].x) + ',' + Math.round(samples[0].y) + ':';
    for (let i = 0; i < samples.length; ++i) {
      const s = samples[i];
      const x = Math.round(s.x), y = Math.round(s.y);
      out += enc2(x - px) + enc2(y - py);
      const pose = Math.max(0, POSES.indexOf(s.pose));
      out += ALPHA.charAt(pose * 2 + (s.facing < 0 ? 1 : 0));
      px = x;
      py = y;
    }
    return out;
  }

  function decodeGhost(str) {
    const out = [];
    if (!str || str.slice(0, 2) !== 'g1')
      return out;
    const colon = str.indexOf(':');
    const head = str.slice(2, colon).split(',');
    let x = Number(head[0]), y = Number(head[1]);
    for (let i = colon + 1; i + 5 <= str.length; i += 5) {
      x += dec2(str, i);
      y += dec2(str, i + 2);
      const code = ALPHA.indexOf(str.charAt(i + 4));
      out.push({ x: x, y: y, pose: POSES[code >> 1] || 'idle', facing: code & 1 ? -1 : 1 });
    }
    return out;
  }

  /* where the ghost is at time t (seconds), interpolated */
  function ghostAt(samples, t, out) {
    if (!samples.length)
      return null;
    const f = t * GHOST_HZ;
    const i = Math.floor(f);
    if (i >= samples.length - 1) {
      const s = samples[samples.length - 1];
      out.x = s.x; out.y = s.y; out.pose = s.pose; out.facing = s.facing; out.done = true;
      return out;
    }
    const a = samples[Math.max(0, i)], b = samples[Math.max(0, i) + 1], k = f - i;
    out.x = a.x + (b.x - a.x) * k;
    out.y = a.y + (b.y - a.y) * k;
    out.pose = a.pose;
    out.facing = a.facing;
    out.done = false;
    return out;
  }

  SZ.PlatformerProgress = Object.freeze({
    SAVE_VERSION, BRANCHES, BRANCH_ORDER, TREE, TREE_BY_ID, SKINS, TRAILS, GHOST_HZ, POSES,
    defaultSave, migrate, level, reqMet, nodeState, buy, treeProgress, computeStats,
    totalStars, skinOwned, trailOwned, starsOf, completeLevel, levelDone, worldUnlocked, levelUnlocked, worldStars,
    encodeGhost, decodeGhost, ghostAt
  });
})();
