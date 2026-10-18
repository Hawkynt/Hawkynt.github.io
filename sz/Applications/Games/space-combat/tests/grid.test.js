'use strict';

/* Spatial grid: circle and segment queries agree with brute force; compaction and pools. */
const H = require('./harness');
H.installEnv();
const NS = H.load('systems/grid.js');
const { check, done } = H;
const { createGrid, compact, createPool } = NS.grid;
const { makeRng, segPointDist2 } = NS.rng;

const rng = makeRng(42);
const W = 3000;
const grid = createGrid(W, W, 160);
const objs = [];
for (let i = 0; i < 400; ++i)
  objs.push({ x: rng() * W, y: rng() * W, r: 5 + rng() * 80, alive: true, id: i });
for (const o of objs) grid.insert(o);

let missing = 0, dupes = 0;
const out = [];
for (let q = 0; q < 300; ++q) {
  const x = rng() * W, y = rng() * W, r = 10 + rng() * 300;
  grid.query(x, y, r, out);
  const set = new Set(out.map(o => o.id));
  if (set.size !== out.length) ++dupes;
  for (const o of objs) {
    const d = Math.hypot(o.x - x, o.y - y);
    if (d <= r + o.r && !set.has(o.id)) ++missing;
  }
}
check('circle query finds every overlapping object', missing === 0, missing + ' missed');
check('circle query returns each object once', dupes === 0, dupes + ' queries with duplicates');

let segMissing = 0;
for (let q = 0; q < 200; ++q) {
  const x0 = rng() * W, y0 = rng() * W, x1 = rng() * W, y1 = rng() * W;
  grid.querySegment(x0, y0, x1, y1, 80, out);
  const set = new Set(out.map(o => o.id));
  for (const o of objs) {
    if (o.r > 80) continue;
    if (Math.sqrt(segPointDist2(x0, y0, x1, y1, o.x, o.y)) <= o.r && !set.has(o.id)) ++segMissing;
  }
}
check('segment query finds objects touching the segment', segMissing === 0, segMissing + ' missed');

/* objects outside the sector are clamped into border cells, not lost */
grid.clear();
const outside = { x: -500, y: W + 900, r: 10, id: 'out' };
grid.insert(outside);
grid.query(-500, W + 900, 5, out);
check('objects beyond the edge are still found', out.indexOf(outside) >= 0);
grid.clear();
grid.query(W / 2, W / 2, W, out);
check('clear empties every bucket', out.length === 0, out.length);

/* a broad query costs far less than brute force on a sparse field */
grid.clear();
for (const o of objs) grid.insert(o);
grid.query(100, 100, 50, out);
check('small queries return a small candidate set', out.length < 40, out.length);

const list = [{ alive: true, n: 1 }, { alive: false, n: 2 }, { alive: true, n: 3 }, { alive: false, n: 4 }];
const removed = [];
compact(list, o => removed.push(o.n));
check('compact keeps live entries in order', list.length === 2 && list[0].n === 1 && list[1].n === 3);
check('compact reports removed entries', removed.join() === '2,4');

const pool = createPool(() => ({ fresh: true }));
const a = pool.get();
pool.put(a);
check('pool reuses released objects', pool.get() === a);

done();
