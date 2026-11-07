'use strict';

/* In-level turns. The story data is valid (every world turns at least twice, all four
   directions appear, a guardian fight runs vertically, lines name the cast); the view maths
   resolves each direction without needless mirror flips, turns smoothly and maps arrows and
   swipes so that away from the floor is always a jump; every story stage places its scripted
   turns, and every turn - scripted, seeded or added for Boss Rush - sits on a stretch with no
   obstacle, pit, pad or ledge from the run-in to the run-out; the planner clears the stretches
   around each turn; seeded turns come out the same for the same seed. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/solver.js');
const { check, done } = H;
const CO = NS.course, SO = NS.solver, PH = NS.physics, C = NS.constants, WD = NS.worlds, OR = NS.orient;
const { TURNS, BOSS_DIRS, BOSS_TURN_LINES, TURN_LINES, CAST } = NS.story;
const mods = { maxJumps: 2 };

/* ── data ── */
const bad = [];
const perWorld = [0, 0, 0, 0, 0];
const used = {};
for (const id in TURNS) {
  const st = WD.stageById(id);
  if (!st || st.boss) { bad.push(id + ': not a run stage'); continue; }
  const list = TURNS[id];
  let prev = 'right', lastM = 0;
  for (const t of list) {
    if (OR.DIRS.indexOf(t.dir) < 0) bad.push(id + ': bad dir ' + t.dir);
    if (t.dir === prev) bad.push(id + ': turns to the way it already runs at ' + t.m);
    if (t.m < 200 || t.m - lastM < 150 || t.m > st.lenM - 120) bad.push(id + ': badly spaced at ' + t.m);
    if (!CAST[t.who] || !t.text || t.text.length > 90) bad.push(id + ': bad line at ' + t.m);
    prev = t.dir; lastM = t.m;
    used[t.dir] = 1;
    ++perWorld[st.w];
  }
}
check('story turns are valid (directions, spacing, lines)', !bad.length, bad.join('; '));
check('every world turns at least twice (' + perWorld.join(', ') + ')', perWorld.every(n => n >= 2));
check('the campaign uses all four directions', OR.DIRS.every(d => used[d]));
check('every guardian has a direction and a line, and one fights vertically',
  Object.keys(BOSS_DIRS).length === 5 && WD.WORLDS.every(w => OR.DIRS.indexOf(BOSS_DIRS[w.boss]) >= 0 && BOSS_TURN_LINES[w.boss]) &&
  WD.WORLDS.some(w => OR.VERT[BOSS_DIRS[w.boss]]));
check('the seeded line pool covers every direction', OR.DIRS.every(d => TURN_LINES[d] && TURN_LINES[d].length >= 2));

/* ── view maths ── */
const r0 = OR.resolve(null, 'right');
const up = OR.resolve({ dir: 'right', q: 0, m: 1 }, 'up');
const down = OR.resolve({ dir: 'right', q: 0, m: 1 }, 'down');
const upL = OR.resolve({ dir: 'left', q: 0, m: -1 }, 'up');
const rev = OR.resolve({ dir: 'up', q: up.q, m: up.m }, 'down');
check('right to up or down is a pure quarter turn; from left it keeps the mirror', r0.q === 0 && r0.m === 1 && up.q === -1 && up.m === 1 &&
  down.q === 1 && down.m === 1 && upL.q === 1 && upL.m === -1);
check('turning right round (up to down) flips instead of spinning half way', rev.q === up.q && rev.m === -up.m);

function moves(q, m) {
  return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].map(k => OR.arrowMove(k, q, m) || '-').join(',');
}
check('arrows when running right: up jumps, down slides, right dashes', moves(0, 1) === 'jump,slide,-,dash');
check('arrows when running left: left dashes', moves(0, -1) === 'jump,slide,dash,-');
check('arrows when climbing (floor on the right): left jumps, right slides, up dashes', moves(-1, 1) === 'dash,-,jump,slide');
check('arrows when dropping (floor on the left): right jumps, left slides, down dashes', moves(1, 1) === '-,dash,slide,jump');
check('swipes follow the same rule; a swipe against the run slides',
  OR.swipeMove(-60, 4, -1, 1) === 'jump' && OR.swipeMove(0, -60, -1, 1) === 'dash' && OR.swipeMove(0, 60, -1, 1) === 'slide' && OR.swipeMove(0, -60, 0, 1) === 'jump');

/* a turn sampled finely: angle, mirror and anchor move smoothly and land exactly */
{
  const list = [OR.first('right', 0)];
  list.push(OR.entry(list, 1000, 600, 'up', null));
  list.push(OR.entry(list, 3000, 600, 'left', null));
  let jump = 0, prev = null;
  for (let x = 900; x < 3700; x += 4) {
    const o = OR.at(list, x);
    if (prev) jump = Math.max(jump, Math.abs(o.a - prev.a), Math.abs(o.m - prev.m), Math.abs(o.ax - prev.ax) / 400, Math.abs(o.ay - prev.ay) / 400);
    prev = Object.assign({}, o);
  }
  const mid = OR.at(list, 1300), end = OR.at(list, 1600), flip = OR.at(list, 3300);
  check('a turn is smooth: under 0.03 rad and 12 px of anchor per 4 px run (largest ' + jump.toFixed(3) + ')', jump < 0.03);
  check('half way through the turn the view is half turned; after it, exactly up', Math.abs(mid.a + Math.PI / 4) < 1e-9 && end.a === -Math.PI / 2 && end.vert === 1 && end.dir === 'up');
  check('up to left turns back and flips the mirror through zero', Math.abs(flip.m) < 1e-9 && OR.at(list, 3700).m === -1 && OR.at(list, 3700).a === 0);
}

/* ── generation: scripted turns, safe stretches, the planner ── */
function safe(c, e) {
  const v = e.len / OR.TURN;
  const a = e.x - v * OR.PRE, b = e.x + e.len + v * OR.POST;
  for (const h of c.hz) if (!h.dead && h.x - (h.roll || 0) - (h.glide || 0) < b && h.x + Math.max(h.w, 60) > a) return 'obstacle ' + h.kind + ' at ' + Math.round(h.x);
  for (const q of c.pads) if (q.x < b && q.x + q.w > a) return 'pad';
  for (const q of c.plats) if (q.x < b && q.x + q.w > a) return 'ledge';
  if (!PH.onGroundSpan(c, a, a) || c.ground.some((g, i) => i && g.x > a && g.x < b)) return 'pit';
  return '';
}

function storyCfg(st) {
  return { mode: 'story', world: st.w, seed: NS.rng.hashString('runner-stage-' + st.id), v0: st.v0, v1: st.v1, vMax: st.v1 + 1, ramp: 2400,
    diff: st.diff, lenM: st.lenM, shards: 3, x0: 0, powerEvery: 3400, turns: TURNS[st.id] || null };
}

const unsafe = [], misplaced = [], unsolved = [];
let turnsSeen = 0, solveMs = 0;
for (const st of WD.allStages().filter(s => !s.boss)) {
  const cfg = storyCfg(st);
  const c = CO.create(cfg);
  CO.ensure(c, c.endX + 4000);
  const list = TURNS[st.id] || [];
  if (c.dirs.length - 1 !== list.length) misplaced.push(st.id + ' has ' + (c.dirs.length - 1));
  for (let i = 1; i < c.dirs.length; ++i) {
    const e = c.dirs[i], t = list[i - 1];
    ++turnsSeen;
    if (!t || e.dir !== t.dir || e.x < t.m * C.PX_PER_M || e.x > (t.m + 120) * C.PX_PER_M || e.text !== t.text) misplaced.push(st.id + '#' + i);
    const why = safe(c, e);
    if (why) unsafe.push(st.id + '#' + i + ': ' + why);
    /* the planner gets through the 1.5 s before and after the turn */
    const v = e.len / OR.TURN;
    const t0 = Date.now();
    const p = PH.newPlayer(Math.max(0, e.x - v * 2.2));
    const res = SO.run(c, { speedAt: x => CO.speedAt(cfg, x), mods: mods }, p, e.x + e.len + v * 2.2, {});
    solveMs += Date.now() - t0;
    if (!res.ok) unsolved.push(st.id + '#' + i + ': ' + res.why);
  }
}
check('every story stage places exactly its scripted turns, in order, with their lines', !misplaced.length, misplaced.join(', '));
check(turnsSeen + ' story turns sit on clear stretches (no obstacle, pit, pad or ledge)', !unsafe.length, unsafe.join('; '));
check('the planner clears the run-in and run-out of every story turn (' + solveMs + ' ms)', !unsolved.length, unsolved.join('; '));

/* seeded turns: safe, and the same for the same seed however the course is streamed */
for (const [label, cfg, toM] of [
  ['arcade', { mode: 'arcade', world: 0, cycle: 1200, seed: 11, v0: C.ARCADE_BASE, vMax: C.ARCADE_MAX, ramp: 1800, diff: 0.1, x0: 0, turnEvery: 900 }, 8000],
  ['daily', { mode: 'daily', world: 3, seed: 1234, v0: 11, v1: 15.5, diff: 0.32, lenM: 1500, x0: 0, turnEvery: 450 }, 1600],
  ['zen', { mode: 'zen', world: 1, cycle: 1500, seed: 3, diff: 0.15, x0: 0, turnEvery: 1000 }, 5000]]) {
  const a = CO.create(Object.assign({}, cfg)), b = CO.create(Object.assign({}, cfg));
  CO.ensure(a, toM * C.PX_PER_M);
  for (let x = 2000; x < toM * C.PX_PER_M; x += 1700) CO.ensure(b, x);
  CO.ensure(b, toM * C.PX_PER_M);
  const why = [];
  for (let i = 1; i < a.dirs.length; ++i) { const w = safe(a, a.dirs[i]); if (w) why.push(w); }
  const kinds = a.dirs.slice(1).map(e => e.dir);
  check(label + ': ' + kinds.length + ' seeded turns (' + kinds.join(' ') + '), all on clear stretches', kinds.length >= 2 && !why.length, why.join('; '));
  check(label + ': the same seed turns at the same places', JSON.stringify(a.dirs) === JSON.stringify(b.dirs));
}

/* a guardian stage starts the right way round and never turns */
{
  const c = CO.create({ mode: 'story', world: 2, seed: 9, v0: 12, v1: 14, vMax: 15, diff: 0.4, x0: 0, boss: true, dir0: BOSS_DIRS.avalanche });
  CO.ensure(c, 30000);
  check('a guardian stage keeps its direction (avalanche: down)', c.dirs.length === 1 && c.dirs[0].dir === 'down' && OR.at(c.dirs, 5000).vert === 1);
}
done();
