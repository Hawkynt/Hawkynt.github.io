/* The live course of the open run: builds the physics environment for it (speed along the
   course, the current move modifiers, projectiles, what a smash does), keeps the course
   generated well ahead of the runner and trimmed behind it, inserts obstacles a guardian drops
   while keeping the lists sorted, notices when Arcade's course crosses into the next world, adds
   a turn on a freshly cleared stretch (Boss Rush handing over to a guardian that runs another
   way), and answers range queries over the sorted lists. Owns the environment object (rebuilt, never
   saved). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const CO = NS.course;
  const PH = NS.physics;

  let env = null;

  function build(run) {
    const cfg = run.course.cfg;
    env = {
      course: run.course,
      speedAt: x => CO.speedAt(cfg, x),
      mods: {},
      projs: run.projs,
      t: 0,
      onSmash: h => NS.hazards.smash(run, h, 'dash'),
    };
    run.envReady = 1;
    return env;
  }

  function get(run) {
    if (!env || env.course !== run.course || env.projs !== run.projs) build(run);
    return env;
  }

  function update(run) {
    const c = run.course;
    CO.ensure(c, run.p.x + C.GEN_AHEAD);
    if ((run.cullT = (run.cullT || 0) + 1) % 30 === 0) CO.cull(c, run.p.x - C.KEEP_BEHIND);
    const w = CO.worldAt(c.cfg, run.p.x + 200);
    if (w !== run.world) {
      run.worldFrom = run.world;
      run.world = w;
      run.worldFade = 1;
      if (!run.demo) {
        NS.fx.text(run.p.x + 260, C.GROUND_Y - 220, NS.worlds.WORLDS[w].name, NS.worlds.WORLDS[w].accent, 34, 2.2);
        NS.audio.sfx('levelup', { volume: 0.6 });
      }
    }
  }

  /* insert keeping .x order (guardian drops land ahead of the generated part rarely) */
  function insertSorted(arr, item) {
    const i = PH.lowerBound(arr, item.x);
    arr.splice(i, 0, item);
  }

  function addHazard(run, kind, x, props) {
    const def = NS.items.HAZARDS[kind];
    const h = { id: ++run.course.uid, kind: kind, x: x, w: def.w, h: def.h, base: C.GROUND_Y, smash: def.smash ? 1 : 0 };
    if (props) for (const k in props) h[k] = props[k];
    insertSorted(run.course.hz, h);
    return h;
  }

  function addItem(run, k, x, y, extra) {
    const it = { k: k, x: x, y: y };
    if (extra) for (const q in extra) it[q] = extra[q];
    insertSorted(run.course.items, it);
    return it;
  }

  /* clear a stretch for a turn: obstacles gone (moving ones included), pads lifted, pits filled */
  function clearZone(run, a, b) {
    const c = run.course;
    const hz = c.hz;
    for (let i = PH.lowerBound(hz, a - 900); i < hz.length && hz[i].x - (hz[i].roll || 0) - (hz[i].glide || 0) < b; ++i)
      if (hz[i].x + Math.max(hz[i].w, 60) > a) hz[i].dead = 1;
    for (let i = c.pads.length - 1; i >= 0; --i) if (c.pads[i].x < b && c.pads[i].x + c.pads[i].w > a) c.pads.splice(i, 1);
    const g = c.ground;
    for (let i = 0; i + 1 < g.length; ) {
      const g0 = g[i].x + g[i].w, g1 = g[i + 1].x;
      if (g1 > a && g0 < b) {
        g[i].w = g[i + 1].x + g[i + 1].w - g[i].x;
        g.splice(i + 1, 1);
      } else ++i;
    }
  }

  /* turn the view to dir a little ahead of the runner; null when it already runs that way */
  function addTurn(run, dir, say) {
    const c = run.course, p = run.p;
    const ds = c.dirs;
    if (ds[ds.length - 1].dir === dir) return null;
    const v = CO.speedAt(c.cfg, p.x);
    const xs = p.x + v * 0.9, len = v * NS.orient.TURN;
    clearZone(run, p.x + 40, xs + len + v * (NS.orient.POST + 0.4));
    const e = NS.orient.entry(ds, xs, len, dir, say);
    ds.push(e);
    return e;
  }

  /* is there ground (not a pit) under x? and where does the next ground start after x */
  function groundAt(run, x) {
    return PH.onGroundSpan(run.course, x - 10, x + 10);
  }

  function nextGround(run, x) {
    const g = run.course.ground;
    for (let i = 0; i < g.length; ++i) {
      const s = g[i];
      if (s.x + s.w < x + 40) continue;
      return Math.max(x, s.x + 60);
    }
    return x;
  }

  Object.assign(NS.stream, {
    build, get, update, insertSorted, addHazard, addItem, clearZone, addTurn, groundAt, nextGround
  });
})();
