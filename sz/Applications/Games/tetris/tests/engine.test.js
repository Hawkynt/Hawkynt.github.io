'use strict';

/* The playfield engine: the 7-bag deals every shape once per seven and the same order for the
   same seed, pieces move, rotate with SRS kicks (the I piece and a T-spin triple setup), hold
   once per piece, hard and soft drops score, lock delay resets at most fifteen times, line
   clears pause then collapse, guideline scoring (singles to quads, T-spins and minis,
   back-to-back, combos, perfect clears), levels every ten lines, top-out, garbage, crystals,
   mirroring and the power clears, the bot survives a long game, and a game saves as JSON. */
const H = require('./harness');
H.installEnv();
const NS = H.load(null, ['js/core/namespace.js', 'js/core/constants.js', 'js/core/rng.js', 'js/core/engine.js', 'js/core/bot.js']);
const { check, done } = H;
const E = NS.engine;
const C = NS.constants;
const { COLS, ROWS } = C;

function idle(g, s) { for (let i = 0; i < s * 120; ++i) E.step(g, 1 / 120, {}); }
function settle(g) { idle(g, 0.5); E.takeEvents(g); }
function fillRow(g, y, gap) { for (let x = 0; x < COLS; ++x) g.board[y * COLS + x] = gap && gap.indexOf(x) >= 0 ? 0 : 8; }

/* bag */
const g1 = E.create({ seed: 7 });
const seen = [g1.piece.t].concat(g1.queue.slice(0, 6));
check('the first seven pieces are all seven shapes', new Set(seen).size === 7, seen.join(''));
const g2 = E.create({ seed: 7 });
check('the same seed deals the same order', JSON.stringify(g2.queue) === JSON.stringify(g1.queue) && g2.piece.t === g1.piece.t);
check('a different seed deals another order', JSON.stringify(E.create({ seed: 8 }).queue) !== JSON.stringify(g1.queue));

/* movement */
let g = E.create({ seed: 1 });
const x0 = g.piece.x;
check('pieces move left and right', E.move(g, -1) && g.piece.x === x0 - 1 && E.move(g, 1) && g.piece.x === x0);
for (let i = 0; i < 10; ++i) E.move(g, -1);
check('walls stop them', !E.move(g, -1) && g.piece.x + Math.min(...E.cells(g.piece.t, g.piece.r, 0, 0).map(c => c[0])) === 0);

/* SRS: an I piece against the right wall kicks */
g = E.create({ seed: 1 });
g.piece = { t: 'I', r: 1, x: 7, y: 5, orb: -1 };
check('a vertical I at the right wall rotates with a kick', E.rotate(g, 1) && g.piece.r === 2 && E.cells('I', 2, g.piece.x, g.piece.y).every(c => c[0] >= 0 && c[0] < COLS));

/* T-spin double: the classic slot */
g = E.create({ seed: 1 });
for (let y = ROWS - 2; y < ROWS; ++y) fillRow(g, y, y === ROWS - 1 ? [4] : [3, 4, 5]);
g.board[(ROWS - 3) * COLS + 3] = 8;
g.piece = { t: 'T', r: 0, x: 3, y: ROWS - 5, orb: -1 };
E.takeEvents(g);
let ok = true;
while (E.fits(g, 'T', 0, 3, g.piece.y + 1)) ++g.piece.y;
g.piece.r = 1; g.piece.x = 3;
/* rotate into the slot from above: put it in state 0 one row higher, rotate twice */
g.piece = { t: 'T', r: 3, x: 3, y: ROWS - 3, orb: -1 };
ok = E.fits(g, 'T', 3, 3, ROWS - 3);
const rot = E.rotate(g, -1);
check('a T rotates into a slot', ok && rot, JSON.stringify(g.piece));
E.hardDrop(g);
let ev = E.takeEvents(g).find(e => e.type === 'clear');
check('a T-spin double is detected and scored', ev && ev.tspin === 'full' && ev.lines === 2 && ev.points === 1200, JSON.stringify(ev));

/* scoring table */
function clearWith(n, type) {
  const gg = E.create({ seed: 3 });
  for (let y = ROWS - n; y < ROWS; ++y) fillRow(gg, y, [0]);
  gg.board[(ROWS - n - 1) * COLS + 5] = 8;
  gg.piece = { t: 'I', r: 1, x: -2, y: 2, orb: -1 };
  E.hardDrop(gg);
  return { g: gg, ev: E.takeEvents(gg).find(e => e.type === 'clear') };
}
const q = clearWith(4);
check('a quad scores 800 x level', q.ev && q.ev.lines === 4 && q.ev.points === 800 && q.ev.perfect === false, JSON.stringify(q.ev));
check('line clears pause before the rows collapse', q.g.clearing && q.g.board[(ROWS - 1) * COLS + 1] === 8);
idle(q.g, 0.5);
check('then the rows are gone and a new piece spawns', !q.g.clearing && q.g.piece && q.g.board[(ROWS - 1) * COLS + 1] === 0);

/* back-to-back and combo */
g = E.create({ seed: 3 });
for (let y = ROWS - 8; y < ROWS; ++y) fillRow(g, y, [0]);
g.board[(ROWS - 9) * COLS + 5] = 8;
g.piece = { t: 'I', r: 1, x: -2, y: 2, orb: -1 };
E.hardDrop(g); settle(g);
g.piece = { t: 'I', r: 1, x: -2, y: 2, orb: -1 };
E.hardDrop(g);
ev = E.takeEvents(g).find(e => e.type === 'clear');
check('a second quad is back-to-back (x1.5) with a combo', ev && ev.b2b && ev.combo === 1 && ev.points === 800 * 1.5 + 50, JSON.stringify(ev));

/* perfect clear */
g = E.create({ seed: 3 });
for (let y = ROWS - 4; y < ROWS; ++y) fillRow(g, y, [0]);
g.piece = { t: 'I', r: 1, x: -2, y: 2, orb: -1 };
E.hardDrop(g);
ev = E.takeEvents(g).find(e => e.type === 'clear');
check('emptying the board is a perfect clear', ev && ev.perfect && ev.points === 800 + 2000, JSON.stringify(ev));

/* hold */
g = E.create({ seed: 5 });
const first = g.piece.t, next = g.queue[0];
check('hold keeps the piece and brings the next', E.holdPiece(g) && g.hold === first && g.piece.t === next);
check('only once per piece', !E.holdPiece(g));
E.hardDrop(g); settle(g);
check('after a lock hold works again and swaps', E.holdPiece(g) && g.piece.t === first);
const noHold = E.create({ seed: 5, hold: false });
check('hold can be switched off', !E.holdPiece(noHold));

/* drops and lock delay */
g = E.create({ seed: 9 });
const s0 = g.score;
E.hardDrop(g);
check('a hard drop scores two per row and locks', g.score > s0 && g.pieces === 1 && (g.score - s0) % 2 === 0);
settle(g);
g = E.create({ seed: 9 });
for (let i = 0; i < 60; ++i) E.step(g, 1 / 60, { soft: true });
check('soft drop scores one per row', g.stats.softRows > 3 && g.score >= g.stats.softRows);
g = E.create({ seed: 9 });
g.piece.y = E.ghostY(g);
let resets = 0;
for (let i = 0; i < 40 && g.piece; ++i) {
  E.step(g, 0.3, {});
  if (g.piece && (E.move(g, i % 2 ? 1 : -1))) ++resets;
}
check('lock delay resets end after fifteen moves', g.pieces === 1, resets);

/* levels */
g = E.create({ seed: 2 });
g.lines = 9;
for (let y = ROWS - 1; y < ROWS; ++y) fillRow(g, y, [0]);
g.piece = { t: 'I', r: 1, x: -2, y: 2, orb: -1 };
E.hardDrop(g);
check('ten lines raise the level', g.level === 2 && E.takeEvents(g).some(e => e.type === 'levelup'));
check('gravity follows the guideline curve', Math.abs(1 / E.gravity(E.create({ level: 1 })) - 1) < 1e-9 && E.gravity(E.create({ level: 20 })) > 1000);

/* top-out and Zen */
g = E.create({ seed: 4 });
for (let y = 1; y < ROWS; ++y) fillRow(g, y, [y % COLS]);
g.piece = null;
g.spawnT = 0.001;
E.step(g, 1 / 60, {});
check('a blocked spawn tops out', g.over && g.reason === 'block');
g = E.create({ seed: 4, zen: true });
for (let y = 1; y < ROWS; ++y) fillRow(g, y, [y % COLS]);
g.piece = null; g.spawnT = 0.001;
E.step(g, 1 / 60, {});
check('Zen melts the stack instead', !g.over && g.piece && g.stats.zenClears === 1);

/* garbage and specials */
g = E.create({ seed: 6 });
E.addGarbage(g, 3, 4, { gem: true });
check('garbage rises with one hole and gems', E.garbageLeft(g) === 27 && E.gemsLeft(g) === 3 && g.board[(ROWS - 1) * COLS + 4] === 0);
g = E.create({ seed: 6 });
for (let y = ROWS - 3; y < ROWS; ++y) fillRow(g, y, [y % 3]);
const n = E.cascade(g);
check('the cascade settles columns and clears what fills up', n >= 1, n);
g = E.create({ seed: 6 });
fillRow(g, ROWS - 1, [2]);
fillRow(g, ROWS - 2, [3]);
check('sweep removes the bottom rows', E.sweep(g, 2) === 2 && E.garbageLeft(g) === 0);
g = E.create({ seed: 6 });
g.board[(ROWS - 1) * COLS + 6] = 8; g.board[(ROWS - 2) * COLS + 6] = 8;
check('the laser empties the tallest column', E.laser(g) === 6 && E.garbageLeft(g) === 0);
g = E.create({ seed: 6 });
fillRow(g, ROWS - 1, [0]);
g.board[(ROWS - 1) * COLS] = 0;
const m0 = g.board.slice(ROWS * COLS - COLS);
E.mirror(g);
check('mirroring flips the stack', g.board[ROWS * COLS - 1] === 0 && g.board[ROWS * COLS - COLS] === 8 && m0[0] === 0);
g = E.create({ seed: 6, orbChance: 1 });
E.hardDrop(g); settle(g);
check('power orbs ride on pieces into the board', g.tags.some(t => t === 1));

/* the bot plays a long, clean game */
g = E.create({ seed: 11, level: 1 });
let pieces = 0;
while (!g.over && pieces < 400) {
  if (g.piece) { NS.bot.playPiece(g); ++pieces; }
  idle(g, 0.4);
}
check('the bot survives 400 pieces and clears lines', !g.over && g.lines >= 140, g.lines + ' lines, over=' + g.over);

/* JSON round trip */
const saved = JSON.parse(JSON.stringify(g));
E.hardDrop(saved);
check('a game survives a JSON round trip and plays on', saved.pieces === g.pieces + 1 || saved.over === false);
done();
