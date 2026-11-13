;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Level packs: collectible remixes of the campaign. A Looking-Glass pack mirrors a world's levels
   * left to right - every wall, ramp, belt, fan, portal and swing turned around, the launcher on
   * the other side - and opens once that world is cleared. Only remixes whose mirrored solution
   * replays to a win in the game's own physics are listed (tools/build-packs.js finds them,
   * tests/levels-data.test.js replays them), so every pack level is proven solvable. Pure data and
   * functions: no DOM, no storage.
   */
  const FIELD_W = 1280;
  const mx = (x) => FIELD_W - x;
  const ma = (a) => -(a || 0);

  /* one fixture mirrored, by its kind's argument layout (see engine/parts.js) */
  function mirrorItem(it) {
    const k = it[0], o = it.slice();
    switch (k) {
      case 'ground': o[1] = mx(it[2]); o[2] = mx(it[1]); break;
      case 'water': case 'lava': o[1] = mx(it[3]); o[3] = mx(it[1]); break;
      case 'ramp': o[1] = mx(it[1] + it[3]); o[5] = -(it[5] || 1); break;
      case 'wall': case 'ice': case 'glass': case 'crate': o[1] = mx(it[1]); if (it.length > 5) o[5] = ma(it[5]); break;
      case 'spring': o[1] = mx(it[1]); if (it.length > 3) o[3] = ma(it[3]); break;
      case 'conveyor': o[1] = mx(it[1]); o[4] = ma(it[4]); o[5] = -(it[5] !== undefined ? it[5] : 320); break;
      case 'paddle': o[1] = mx(it[1]); o[4] = -it[4]; if (it.length > 5) o[5] = ma(it[5]); break;
      case 'swing': o[1] = mx(it[1]); o[4] = -it[4]; if (it.length > 6) o[6] = ma(it[6]); break;
      case 'fan': o[1] = mx(it[1]); o[3] = 180 - (it[3] || 0); break;
      case 'portal': o[1] = mx(it[1]); o[3] = 180 - it[3]; o[4] = mx(it[4]); o[6] = 180 - it[6]; break;
      case 'pendulum': o[1] = mx(it[1]); o[4] = ma(it[4]); break;
      default: o[1] = mx(it[1]);
    }
    return o;
  }

  /* a player part mirrored: belts and fans turned around, the rest flipped */
  function mirrorPart(p) {
    const a = p[3] || 0;
    const turned = p[0] === 'conveyor' || p[0] === 'fan' ? 180 - a : -a;
    return [p[0], mx(p[1]), p[2], turned];
  }

  function mirrorLevel(l, id, name) {
    const out = Object.assign({}, l, {
      id: id, name: name, mirror: l.id,
      launcher: [mx(l.launcher[0]), l.launcher[1]],
      items: l.items.map(mirrorItem),
      targets: l.targets.map(t => [mx(t[0]), t[1]]),
      stars: l.stars.map(s => [mx(s[0]), s[1]]),
      tip: 'Looking-glass remix of ' + l.name + ': everything the other way round.',
    });
    if (l.aim) out.aim = [180 - l.aim[1], 180 - l.aim[0]];
    if (l.plan) out.plan = l.plan.map(mirrorPart);
    return out;
  }

  function mirrorSolution(sol) {
    return { parts: sol.parts.map(mirrorPart), shots: sol.shots.map(s => [180 - s[0], s[1]]) };
  }

  /* the remixes proven by tools/build-packs.js, per world */
  const PROVEN = {"0":["w1-1","w1-2","w1-3","w1-4","w1-5","w1-6","w1-7","w1-8"],"1":["w2-1","w2-2","w2-3","w2-4","w2-5","w2-6","w2-7","w2-8"],"2":["w3-1","w3-2","w3-3","w3-4","w3-5","w3-6","w3-7","w3-8"],"3":["w4-1","w4-2","w4-3","w4-5","w4-6","w4-7","w4-8"],"4":["w5-1","w5-2","w5-3","w5-4","w5-5","w5-6","w5-7","w5-8"]};

  const PACK_NAMES = ['Looking-Glass Workshop', 'Looking-Glass Garden', 'Looking-Glass Cryo Lab', 'Looking-Glass Forge', 'Looking-Glass Orbit'];

  function build(Lv, Sol) {
    const packs = [], byId = {};
    for (let w = 0; w < Lv.WORLDS.length; ++w) {
      const ids = PROVEN[w] || [];
      if (ids.length < 3) continue;
      const levels = ids.map((src, i) => {
        const l = mirrorLevel(Lv.BY_ID[src], 'm' + (w + 1) + '-' + (i + 1), Lv.BY_ID[src].name + ' (Mirrored)');
        byId[l.id] = l;
        return l;
      });
      packs.push({ id: 'mirror-' + Lv.WORLDS[w].id, name: PACK_NAMES[w], world: w, unlock: { world: w }, levels: levels,
        solutions: ids.reduce((m, src, i) => { m[levels[i].id] = mirrorSolution(Sol[src]); return m; }, {}) });
    }
    return { packs, byId };
  }

  SZ.PhysicsPuzzlePacks = Object.freeze({ mirrorItem, mirrorPart, mirrorLevel, mirrorSolution, PROVEN, build });
})();
