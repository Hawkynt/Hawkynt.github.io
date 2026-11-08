'use strict';

/* The colour-match engine: pieces spawn in the middle; pairs turn around their first blob and kick
   off walls, jewels cycle their colours; blobs fall on their own after landing; four touching
   blobs of a colour burst, three in a line of jewels shatter (across, down and diagonal); stones
   only break next to a burst; a fall that makes a new burst is the next chain link and scores far
   more; stones from a rival land on the columns and can top the well out; levels speed gravity;
   the bot plays long games of both rules and makes chains; a game survives JSON. */
const H = require('./harness');
H.installEnv();
const NS = H.load(null, ['js/core/namespace.js', 'js/core/constants.js', 'js/core/rng.js', 'js/core/match.js']);
const { check, done } = H;
const M = NS.match;
const { COLS, ROWS, HIDDEN, STONE } = M;
const I = (x, y) => y * COLS + x;
function run(g, s, inp) { const evs = []; for (let t = 0; t < s; t += 1 / 120) { M.step(g, 1 / 120, inp || {}); evs.push.apply(evs, M.takeEvents(g)); } return evs; }

/* pieces */
let g = M.create({ rule: 'pairs', seed: 3 });
check('a pair spawns in the middle with a preview queue', g.piece && g.piece.c.length === 2 && g.piece.x === 2 && g.queue.length === 3 && g.queue.every(q => q.length === 2));
check('pairs use four colours', [].concat.apply([], g.queue.concat([g.piece.c])).every(c => c >= 1 && c <= 4));
M.rotate(g, 1);
check('turning moves the second blob round the first', g.piece.r === 1 && M.cellsOf('pairs', g.piece)[1][0] === g.piece.x + 1);
while (M.move(g, 1));
const xr = g.piece.x;
M.rotate(g, 1); M.rotate(g, 1);
check('a turn against the wall kicks the pair back in', g.piece.r === 3 && g.piece.x === xr - 0 || g.piece.x === COLS - 1);
check('no holding in these rules', M.holdPiece(g) === false && !g.canHold);
let j = M.create({ rule: 'jewels', seed: 3 });
const before = M.cellsOf('jewels', j.piece).map(c => c[2]).join();
M.rotate(j, 1);
const after = M.cellsOf('jewels', j.piece).map(c => c[2]).join();
check('a jewel column has three jewels that cycle when turned', j.piece.c.length === 3 && before !== after && after.split(',').sort().join() === before.split(',').sort().join());
check('jewels use six colours', j.piece.c.every(c => c >= 1 && c <= 6));

/* falling apart */
g = M.create({ rule: 'pairs', seed: 4 });
g.board[I(2, ROWS - 1)] = 1;
g.piece = { c: [2, 3], x: 2, y: 3, r: 1 };
M.hardDrop(g);
check('after landing each blob falls on its own', g.board[I(2, ROWS - 2)] === 2 && g.board[I(3, ROWS - 1)] === 3);

/* bursting pairs */
g = M.create({ rule: 'pairs', seed: 5 });
g.board[I(0, ROWS - 1)] = 1; g.board[I(1, ROWS - 1)] = 1; g.board[I(2, ROWS - 1)] = 3;
g.board[I(3, ROWS - 1)] = STONE;
g.piece = { c: [1, 1], x: 2, y: 3, r: 3 };
let evs = [];
M.hardDrop(g);
evs = evs.concat(M.takeEvents(g), run(g, 1));
const b1 = evs.find(e => e.type === 'burst');
check('four touching blobs of one colour burst', b1 && b1.cleared === 4 && b1.chain === 1 && !g.board[I(0, ROWS - 1)] && !g.board[I(1, ROWS - 1)]);
check('three do not', !M.findBursts('pairs', (() => { const b = new Array(COLS * ROWS).fill(0); b[I(0, ROWS - 1)] = b[I(1, ROWS - 1)] = b[I(2, ROWS - 1)] = 2; return b; })()).length);
const sb = new Array(COLS * ROWS).fill(0);
for (let x = 0; x < 4; ++x) sb[I(x, ROWS - 1)] = 2;
sb[I(4, ROWS - 1)] = STONE; sb[I(5, ROWS - 1)] = STONE; sb[I(0, ROWS - 2)] = STONE;
const hit = M.findBursts('pairs', sb);
check('stones next to a burst break, stones further away stay', hit.indexOf(I(4, ROWS - 1)) >= 0 && hit.indexOf(I(0, ROWS - 2)) >= 0 && hit.indexOf(I(5, ROWS - 1)) < 0);

/* chains */
g = M.create({ rule: 'pairs', seed: 6 });
const B = (x, y, c) => { g.board[I(x, y)] = c; };
B(0, ROWS - 1, 2); B(1, ROWS - 1, 2); B(2, ROWS - 1, 2);
B(0, ROWS - 2, 1); B(1, ROWS - 2, 1); B(2, ROWS - 2, 1);
B(0, ROWS - 3, 2);
g.piece = { c: [1, 1], x: 3, y: 3, r: 0 };
M.hardDrop(g);
evs = M.takeEvents(g).concat(run(g, 2));
const bursts = evs.filter(e => e.type === 'burst');
check('a fall that makes a new burst is a chain', bursts.length === 2 && bursts[1].chain === 2 && g.stats.bestChain === 2, bursts.map(b => b.cleared + '@' + b.chain).join());
check('and its link scores far more', bursts.length === 2 && bursts[1].points > bursts[0].points * 4);

/* jewels */
const jb = new Array(COLS * ROWS).fill(0);
jb[I(0, ROWS - 1)] = jb[I(1, ROWS - 1)] = jb[I(2, ROWS - 1)] = 5;
check('three jewels across shatter', M.findBursts('jewels', jb).length === 3);
const jd = new Array(COLS * ROWS).fill(0);
jd[I(0, ROWS - 1)] = 4; jd[I(1, ROWS - 2)] = 4; jd[I(2, ROWS - 3)] = 4;
check('so do three on a diagonal', M.findBursts('jewels', jd).length === 3);
const jv = new Array(COLS * ROWS).fill(0);
jv[I(3, ROWS - 1)] = jv[I(3, ROWS - 2)] = jv[I(3, ROWS - 3)] = jv[I(3, ROWS - 4)] = 6;
check('and four down', M.findBursts('jewels', jv).length === 4);
j = M.create({ rule: 'jewels', seed: 9 });
j.piece = { c: [2, 2, 2], x: 4, y: 3, r: 0 };
M.hardDrop(j);
evs = M.takeEvents(j).concat(run(j, 1));
check('a column of one colour shatters itself on landing', evs.some(e => e.type === 'burst' && e.cleared === 3));

/* stones and speed */
g = M.create({ rule: 'pairs', seed: 10 });
M.addGarbage(g, 6);
let stones = 0;
for (let k = 0; k < COLS * ROWS; ++k) if (g.board[k] === STONE) ++stones;
check('rival stones land on the columns', stones === 6 && g.board.slice(I(0, ROWS - 1), I(0, ROWS - 1) + COLS).every(v => v === STONE));
const ok = M.addGarbage(g, COLS * ROWS);
check('too many top the well out', !ok && g.over && g.reason === 'garbage');
const slow = M.create({ rule: 'pairs', seed: 1, level: 1 }), fast = M.create({ rule: 'pairs', seed: 1, level: 10 });
check('levels speed up gravity', M.gravity(fast) > M.gravity(slow) * 3);
g = M.create({ rule: 'pairs', seed: 11 });
const y0 = g.piece.y;
run(g, 1.2);
check('pieces fall by themselves', g.piece && g.piece.y > y0 || g.pieces > 0);

/* the bot */
for (const rule of ['pairs', 'jewels']) {
  const bg = M.create({ rule: rule, seed: 77 });
  let n = 0;
  while (!bg.over && n < 300) {
    if (M.active(bg)) { M.playPiece(bg); ++n; }
    M.step(bg, 1 / 30, {});
    M.takeEvents(bg);
  }
  check('the bot plays 300 ' + rule + ' pieces without topping out and makes chains', !bg.over && bg.stats.bestChain >= 2 && bg.lines >= 100, bg.pieces + ' ' + bg.stats.bestChain + ' ' + bg.lines);
}
const sg = M.create({ rule: 'jewels', seed: 12 });
for (let i = 0; i < 40; ++i) { if (M.active(sg)) M.playPiece(sg); M.step(sg, 1 / 30, {}); M.takeEvents(sg); }
const cp = JSON.parse(JSON.stringify(sg));
for (let i = 0; i < 200; ++i) { for (const x of [sg, cp]) { if (M.active(x)) M.playPiece(x); M.step(x, 1 / 30, {}); M.takeEvents(x); } }
check('a game survives JSON and plays on the same', sg.board.join() === cp.board.join() && sg.score === cp.score && sg.pieces >= 15, sg.pieces + ' ' + sg.score + ' ' + cp.score + ' ' + sg.over);
done();
