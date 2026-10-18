'use strict';

/*
 * Solution finder for the Physics Puzzle.
 *
 * For every campaign level and trick shot it searches part layouts and shots
 * with the game's own deterministic physics and writes the best solution it
 * finds to solutions.js. Layouts tried, in order: the level's designer plan,
 * no parts, then seeded jitters of the plan and seeded random layouts from
 * the inventory. Shots are swept over the barrel's aim range (1 degree) and
 * the launch speed (20 px/s); a shot is kept only when its neighbours on the
 * grid give the same outcome, so a replay is not balanced on a knife edge.
 * Multi-target levels are solved greedily one shot after the other in the
 * same attempt, like a player would.
 *
 * With --stars the stars of each solved level are re-hung along the
 * solution's flight path (so collecting them all stays possible) and written
 * back into levels-data.js.
 *
 * With --direct it only reports which levels with parts in the tray can also
 * be solved without placing any (nothing is written).
 *
 * Run: node sz/Applications/Games/physics-puzzle/tools/solve-levels.js [--only=w1-1,w1-2] [--stars] [--tricks] [--direct]
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const ROOT = path.join(__dirname, '..');

function load() {
  global.window = {};
  require(path.join(ROOT, 'physics.js'));
  require(path.join(ROOT, 'parts.js'));
  require(path.join(ROOT, 'sim.js'));
  require(path.join(ROOT, 'levels-data.js'));
  return window.SZ;
}

const SZ = load();
const Sim = SZ.PhysicsPuzzleSim;
const Parts = SZ.PhysicsPuzzleParts;
const Lv = SZ.PhysicsPuzzleLevels;
const Ph = SZ.PhysicsPuzzlePhysics;

function levelById(id) {
  if (id.indexOf('trick-') === 0) {
    const t = Lv.TRICKS.find(x => 'trick-' + x.id === id);
    return Lv.trickLevel(t);
  }
  return Lv.BY_ID[id];
}

function ruleOpts(level) {
  const r = level.rule || {};
  return { oneShot: !!r.oneShot, minBounces: r.minBounces || 0 };
}

/* replays prefix shots, then fires (a, s); returns the outcome summary */
function evaluate(level, parts, prefix, a, s) {
  const theme = Lv.WORLDS[level.world];
  const placed = parts.map(p => ({ type: p[0], x: p[1], y: p[2], a: p[3] || 0 }));
  const att = Sim.createAttempt(level, placed, Object.assign({ theme: theme }, ruleOpts(level)));
  for (const sh of prefix)
    Sim.runShot(att, sh[0], sh[1]);
  const before = att.world.bodies.filter(b => b.alive && b.type === 'dynamic' && b.tag !== 'ball').map(b => [b, b.x, b.y]);
  const aliveBefore = att.world.bodies.filter(b => b.alive && !b.sensor).length;
  const shot = Sim.runShot(att, a, s);
  let tm = 0, sm = 0;
  att.targets.forEach((t, i) => { if (t.lit) tm |= 1 << i; });
  att.stars.forEach((t, i) => { if (t.got) sm |= 1 << i; });
  /* how much the shot changed the world: moved crates, broken glass, spent TNT */
  let ch = 0;
  for (const [b, x, y] of before)
    if (!b.alive || Math.hypot(b.x - x, b.y - y) > 30)
      ++ch;
  ch += Math.max(0, aliveBefore - att.world.bodies.filter(b => b.alive && !b.sensor && b.tag !== 'ball').length);
  return { win: shot.done === 'win', tm: tm, sm: sm, b: shot.maxBounces, ch: ch };
}

if (!isMainThread) {
  parentPort.on('message', (job) => {
    const level = levelById(job.id);
    const out = [];
    for (const [a, s] of job.cells)
      out.push(evaluate(level, job.parts, job.prefix, a, s));
    parentPort.postMessage(out);
  });
  return;
}

/* ── main thread: a worker pool ── */

const N = Math.max(1, Math.min(16, os.cpus().length));
const workers = [];
for (let i = 0; i < N; ++i)
  workers.push(new Worker(__filename));

function runCells(id, parts, prefix, cells) {
  const per = Math.ceil(cells.length / N);
  const jobs = [];
  for (let i = 0; i < N; ++i) {
    const chunk = cells.slice(i * per, (i + 1) * per);
    if (!chunk.length)
      continue;
    jobs.push(new Promise((resolve) => {
      const w = workers[i];
      w.once('message', resolve);
      w.postMessage({ id: id, parts: parts, prefix: prefix, cells: chunk });
    }));
  }
  return Promise.all(jobs).then(parts => [].concat.apply([], parts));
}

function grid(level) {
  const aim = level.aim || [-10, 85];
  const angles = [], speeds = [];
  for (let a = aim[0]; a <= aim[1]; a += 1)
    angles.push(a);
  for (let s = 300; s <= Sim.BASE_MAX_SPEED; s += 20)
    speeds.push(s);
  const cells = [];
  for (const a of angles)
    for (const s of speeds)
      cells.push([a, s]);
  return { angles: angles, speeds: speeds, cells: cells };
}

function popcount(v) {
  let c = 0;
  while (v) { c += v & 1; v >>>= 1; }
  return c;
}

/*
 * score a cell: win first, then lit targets, then stars; among those the cell
 * with the most like neighbours (5 x 5 around it) wins
 */
function pickBest(g, res, wantStars, starTotal) {
  const nA = g.angles.length, nS = g.speeds.length;
  const at = (i, k) => res[i * nS + k];
  let best = null, bestScore = -1;
  for (let i = 0; i < nA; ++i) {
    for (let k = 0; k < nS; ++k) {
      const r = at(i, k);
      let robust = 0;
      for (let di = -2; di <= 2; ++di) {
        for (let dk = -2; dk <= 2; ++dk) {
          const ii = i + di, kk = k + dk;
          if ((!di && !dk) || ii < 0 || kk < 0 || ii >= nA || kk >= nS)
            continue;
          const o = at(ii, kk);
          if (o.win === r.win && o.tm === r.tm && (!wantStars || o.sm === r.sm))
            ++robust;
        }
      }
      const score = (r.win ? 1e6 : 0) + popcount(r.tm) * 1e4 + (wantStars ? popcount(r.sm) * 1e3 : 0) + robust * 10;
      if (score > bestScore) {
        bestScore = score;
        best = { a: g.angles[i], s: g.speeds[k], r: r, robust: robust };
      }
    }
  }
  return best;
}

async function solveLayout(level, parts, wantStars, depth) {
  const g = grid(level);
  const maxShots = Math.max(1, level.par);
  const nStars = (level.stars || []).length;
  async function search(prefix, lastTm) {
    const res = await runCells(level.id, parts, prefix, g.cells);
    const best = pickBest(g, res, wantStars, nStars);
    if (!best)
      return null;
    if (best.r.win)
      return { parts: parts, shots: prefix.concat([[best.a, best.s]]), robust: best.robust, stars: best.r.sm, b: best.r.b };
    if (prefix.length + 1 >= maxShots)
      return null;
    /* progress: more targets or stars, else shots that changed the world (cleared a door, broke glass) */
    const tries = [];
    if (best.r.tm !== lastTm || popcount(best.r.sm) > 0)
      tries.push([best.a, best.s]);
    const changers = [];
    for (let i = 0; i < res.length; ++i)
      if (res[i].ch > 0 && res[i].tm === best.r.tm)
        changers.push([res[i].ch, g.cells[i]]);
    changers.sort((x, y) => y[0] - x[0]);
    for (let i = 0; i < changers.length && tries.length < 4; i += Math.max(1, Math.floor(changers.length / 4)))
      tries.push(changers[i][1]);
    for (const t of tries) {
      const out = await search(prefix.concat([t]), best.r.tm);
      if (out)
        return out;
    }
    return null;
  }
  return search([], 0);
}

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

let ignoreStars = false;   // --stars: the stars will be hung afresh, so they may not block a layout

function validLayout(level, parts) {
  const theme = Lv.WORLDS[level.world];
  if (ignoreStars)
    level = Object.assign({}, level, { stars: [] });
  const placed = [];
  for (const p of parts) {
    const pl = { type: p[0], x: p[1], y: p[2], a: p[3] || 0 };
    if (!Parts.canPlace(level, theme, placed, pl).ok)
      return false;
    placed.push(pl);
  }
  return true;
}

function candidateLayouts(level, count) {
  const out = [];
  const plan = (level.plan || []).map(p => p.slice());
  if (plan.length && validLayout(level, plan))
    out.push(plan);
  out.push([]);
  const r = rng(Sim.hashString(level.id));
  const types = [];
  for (const t of Object.keys(level.inv || {}))
    for (let i = 0; i < level.inv[t]; ++i)
      types.push(t);
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    let parts;
    if (plan.length && r() < 0.5) {
      parts = plan.map(p => [p[0], Parts.snap(p[1] + (r() - 0.5) * 120), Parts.snap(p[2] + (r() - 0.5) * 80), Parts.snapAngle((p[3] || 0) + Math.round((r() - 0.5) * 4) * 15)]);
    } else {
      if (!types.length)
        break;
      const n = 1 + Math.floor(r() * Math.min(2, types.length));
      const bag = types.slice();
      parts = [];
      for (let i = 0; i < n; ++i) {
        const t = bag.splice(Math.floor(r() * bag.length), 1)[0];
        parts.push([t, Parts.snap(300 + r() * 940), Parts.snap(120 + r() * 460), Parts.PARTS[t].rotatable ? Parts.snapAngle(Math.round((r() - 0.5) * 12) * 15) : 0]);
      }
    }
    if (validLayout(level, parts))
      out.push(parts);
  }
  return out;
}

async function solveLevel(level, opts) {
  const layouts = candidateLayouts(level, opts.tries || 14);
  let best = null;
  for (const parts of layouts) {
    if (level.rule && level.rule.noParts && parts.length)
      continue;
    const sol = await solveLayout(level, parts, opts.wantStars);
    if (sol && (!best || sol.shots.length < best.shots.length || (sol.shots.length === best.shots.length && popcount(sol.stars) > popcount(best.stars))))
      best = sol;
    if (best && best.shots.length <= level.par && (!opts.wantStars || popcount(best.stars) === (level.stars || []).length))
      break;
  }
  return best;
}

/* stars along the flight path of a solution */
function hangStars(level, sol) {
  const theme = Lv.WORLDS[level.world];
  const out = Sim.playSolution(Object.assign({}, level, { stars: [] }), sol, { theme: theme, record: true });
  const scratch = Ph.createWorld({ gravity: [0, 0] });
  const partBodies = [];
  for (const p of sol.parts)
    for (const b of Parts.addSpecs(scratch, { bodies: Parts.partSpecs({ type: p[0], x: p[1], y: p[2], a: p[3] || 0 }).bodies, zones: [] }))
      partBodies.push(b);
  const pts = [];
  out.paths.forEach((p) => {
    for (let i = 0; i + 1 < p.length; i += 2) {
      const x = p[i], y = p[i + 1];
      if (Math.hypot(x - level.launcher[0], y - level.launcher[1]) < 160 || y < 70 || y > 590 || x < 30 || x > 1250)
        continue;
      if (level.targets.some(t => Math.hypot(x - t[0], y - t[1]) < 100))
        continue;
      /* a star must not sit on a part of the solution (parts may not cover stars) */
      const probe = Ph.addBody(scratch, { shape: 'circle', x: x, y: y, r: Parts.STAR_R + 3 });
      const hit = partBodies.some(b => Ph.overlap(probe, b, 2));
      probe.alive = false;
      if (hit)
        continue;
      pts.push([Math.round(x), Math.round(y)]);
    }
  });
  const want = 3;
  const stars = [];
  for (let k = 0; k < want && pts.length; ++k) {
    const idx = Math.floor(pts.length * (k + 0.5) / want);
    const p = pts[Math.min(pts.length - 1, idx)];
    if (!stars.some(s => Math.hypot(s[0] - p[0], s[1] - p[1]) < 110))
      stars.push(p);
  }
  return stars;
}

function writeStars(id, stars) {
  const file = path.join(ROOT, 'levels-data.js');
  let src = fs.readFileSync(file, 'utf8');
  const at = src.indexOf("id: '" + id + "'");
  const sAt = src.indexOf('stars: [', at);
  const end = src.indexOf('\n', sAt);
  src = src.slice(0, sAt) + 'stars: ' + JSON.stringify(stars).replace(/,/g, ', ') + ',' + src.slice(end);
  fs.writeFileSync(file, src);
}

function writeSolutions(all) {
  const ids = Object.keys(all).sort((a, b) => {
    const ta = a.indexOf('trick-') === 0, tb = b.indexOf('trick-') === 0;
    if (ta !== tb) return ta ? 1 : -1;
    return a.localeCompare(b, 'en', { numeric: true });
  });
  const lines = ids.map(id => {
    const s = all[id];
    const parts = '[' + s.parts.map(p => "['" + p[0] + "', " + p[1] + ', ' + p[2] + ', ' + (p[3] || 0) + ']').join(', ') + ']';
    const shots = '[' + s.shots.map(x => '[' + x[0] + ', ' + x[1] + ']').join(', ') + ']';
    return "    '" + id + "': { parts: " + parts + ', shots: ' + shots + ' }';
  });
  const src = ";(function() {\n  'use strict';\n  const SZ = window.SZ || (window.SZ = {});\n\n" +
    '  /*\n   * Known solutions for every campaign level and trick shot, found by\n   * tools/solve-levels.js with the game\'s deterministic physics and replayed\n' +
    '   * by tests/solutions.test.js. parts: [type, x, y, angleDeg]; shots: [angleDeg, speed].\n' +
    '   * The game uses them for the Blueprint hint and to hang the Daily stars.\n   */\n' +
    '  SZ.PhysicsPuzzleSolutions = Object.freeze({\n' + lines.join(',\n') + '\n  });\n})();\n';
  fs.writeFileSync(path.join(ROOT, 'solutions.js'), src);
}

function readSolutions() {
  try {
    global.window.SZ.PhysicsPuzzleSolutions = undefined;
    delete require.cache[require.resolve(path.join(ROOT, 'solutions.js'))];
    require(path.join(ROOT, 'solutions.js'));
    return Object.assign({}, window.SZ.PhysicsPuzzleSolutions || {});
  } catch (_) {
    return {};
  }
}

(async () => {
  const args = process.argv.slice(2);
  const only = (args.find(a => a.indexOf('--only=') === 0) || '').slice(7).split(',').filter(Boolean);
  const doStars = args.includes('--stars');
  ignoreStars = doStars;
  const doTricks = args.includes('--tricks');
  const tries = Number((args.find(a => a.indexOf('--tries=') === 0) || '--tries=14').slice(8));
  if (args.includes('--direct')) {
    for (const l of Lv.LEVELS) {
      if (!Object.keys(l.inv).length || (only.length && !only.includes(l.id)))
        continue;
      const sol = await solveLayout(l, [], false);
      console.log(l.id.padEnd(10) + (sol ? 'solvable without parts in ' + sol.shots.length + ' shots' : 'needs its parts'));
    }
    for (const w of workers)
      w.terminate();
    return;
  }
  const all = readSolutions();
  let ids = Lv.LEVELS.map(l => l.id);
  if (doTricks)
    ids = ids.concat(Lv.TRICKS.map(t => 'trick-' + t.id));
  if (only.length)
    ids = ids.filter(id => only.includes(id));
  for (const id of ids) {
    const level = levelById(id);
    const t0 = Date.now();
    let sol = await solveLevel(level, { wantStars: !doStars && !level.trick, tries: tries });
    if (sol && doStars && !level.trick) {
      const stars = hangStars(level, sol);
      writeStars(id, stars);
      level.stars = stars;
    }
    if (sol) {
      all[id] = { parts: sol.parts, shots: sol.shots };
      const check = Sim.playSolution(level, all[id], Object.assign({ theme: Lv.WORLDS[level.world] }, ruleOpts(level)));
      console.log(id.padEnd(10) + ' shots ' + sol.shots.length + '/' + level.par + ' parts ' + sol.parts.length + ' stars ' + check.stars + '/' + check.starsTotal +
        ' robust ' + sol.robust + ' bounces ' + sol.b + (check.win ? '' : ' REPLAY-FAIL') + '  ' + JSON.stringify(all[id]) + '  ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
    } else {
      console.log(id.padEnd(10) + ' UNSOLVED  ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
    }
    writeSolutions(all);
  }
  for (const w of workers)
    w.terminate();
})();
