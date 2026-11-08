'use strict';

/* Boards, logic and the engine: mines never land on the first click or (with room) next to it;
   numbers count the neighbours; the three solver rules find certain cells and never a wrong one;
   proven boards clear by logic alone and come out the same from the same seed; the first reveal
   floods; flags cycle through question marks (or not); chording opens a satisfied number's
   neighbours; a mine ends the game unless a shield defuses it; winning flags every mine; gems
   and chests collect; scan, sonar and the lantern never touch a mine wrongly; reburied cells,
   knocked-off flags, fog and frozen flags behave; the bot clears proven boards without a single
   guess and finishes classic ones; a game survives JSON. */
const H = require('./harness');
H.installEnv();
const NS = H.load(null, ['js/core/namespace.js', 'js/core/constants.js', 'js/core/rng.js', 'js/core/board.js', 'js/core/engine.js', 'js/core/bot.js']);
const { check, done } = H;
const B = NS.board, E = NS.engine, BOT = NS.bot;
const { makeRng } = NS.rng;

/* placement */
let ok = true;
for (let s = 0; s < 50; ++s) {
  const m = B.placeMines(9, 9, 10, 40, makeRng(s + 1));
  const n = m.reduce((a, b) => a + b, 0);
  if (n !== 10 || m[40] || B.neighbours(9, 9)[40].some(j => m[j])) ok = false;
}
check('ten mines, never on the first click or around it', ok);
const crowded = B.placeMines(4, 4, 12, 5, makeRng(3));
check('a crowded board still keeps the first click itself safe', crowded.reduce((a, b) => a + b, 0) === 12 && !crowded[5]);
const num = B.numbers(3, 3, [1, 0, 0, 0, 0, 0, 0, 0, 1]);
check('numbers count the neighbouring mines', num[4] === 2 && num[1] === 1 && num[2] === 0 && num[0] === -1);

/* the rules */
const view = (w, h, mines, cells) => ({ w: w, h: h, mines: mines, state: cells.map(c => c === '#' ? 0 : c === '*' ? 2 : 1), num: cells.map(c => /\d/.test(c) ? +c : 0) });
/* a 1 in a corner with one unknown neighbour left: it is a mine */
let d = B.deduce(view(2, 2, 1, ['1', '1', '1', '#']));
check('rule 1: a number with as many unknown cells as mines left makes them mines', d.rule === 1 && d.mine.join() === '3');
d = B.deduce(view(3, 2, 1, ['1', '*', '#', '1', '1', '#']));
check('rule 1: a satisfied number makes the rest safe', d.safe.indexOf(2) >= 0 && d.safe.indexOf(5) >= 0);
/* 1-2 pattern on an edge: unknown row below */
let v121 = view(3, 2, 2, ['1', '2', '1', '#', '#', '#']);
d = B.deduce(v121);
for (const i of d.mine) v121.state[i] = 2;
const d2 = B.deduce(v121);
check('rule 2 (subsets) solves the 1-2-1 pattern: both mines, then the middle is safe', d.rule === 2 && d.mine.sort().join() === '3,5' && d2.safe.join() === '4', [d, d2]);
d = B.deduce(view(2, 1, 0, ['0', '#']));
check('rule 3: no mines left makes every unknown cell safe', d.safe.join() === '1');
let honest = true;
for (let s = 0; s < 40; ++s) {
  const w = 12, h = 10, m = B.placeMines(w, h, 22, 55, makeRng(100 + s)), nm = B.numbers(w, h, m);
  const v = { w: w, h: h, mines: 22, state: new Array(w * h).fill(0), num: new Array(w * h).fill(0) };
  B.openIn(v, nm, 55);
  for (let k = 0; k < 200; ++k) {
    const r = B.deduce(v);
    if (!r.rule) break;
    if (r.safe.some(i => m[i]) || r.mine.some(i => !m[i])) { honest = false; break; }
    for (const i of r.mine) v.state[i] = 2;
    for (const i of r.safe) B.openIn(v, nm, i);
  }
}
check('the solver never calls a mine safe or a safe cell a mine', honest);

/* proven boards */
let proven = 0, same = true;
for (const [w, h, m] of [[9, 9, 10], [16, 16, 40], [30, 16, 99]])
  for (let s = 0; s < 4; ++s) {
    const start = Math.floor(h / 2) * w + Math.floor(w / 2);
    const r = B.generate(w, h, m, 'p' + s, start, { noGuess: true });
    if (r.noGuess && B.solve(w, h, r.mine, start).solved) ++proven;
    if (B.generate(w, h, m, 'p' + s, start, { noGuess: true }).mine.join('') !== r.mine.join('')) same = false;
  }
check('proven boards clear by logic alone, up to Expert', proven === 12, proven);
check('and come out the same from the same seed and click', same);

/* the engine */
let g = E.create({ w: 9, h: 9, mines: 10, seed: 'e1', noGuess: true });
check('a new game waits for its first click', g.state === 'ready' && !g.mine);
E.reveal(g, 40);
check('the first reveal places the board and floods', g.state === 'play' && g.mine && !g.mine[40] && g.opened >= 1 && g.proven);
const closed = g.open.findIndex((o, i) => !o && !g.mine[i]);
const mineCell = g.mine.indexOf(1);
E.toggleFlag(g, mineCell);
check('right-click flags', g.flag[mineCell] === 1);
E.toggleFlag(g, mineCell);
check('again makes a question mark', g.flag[mineCell] === 2);
E.toggleFlag(g, mineCell);
check('and again clears it', g.flag[mineCell] === 0);
const nm = E.create({ w: 9, h: 9, mines: 10, seed: 'e1', marks: false });
E.reveal(nm, 40);
E.toggleFlag(nm, nm.mine.indexOf(1)); E.toggleFlag(nm, nm.mine.indexOf(1));
check('without marks a flag goes straight back to nothing', nm.flag[nm.mine.indexOf(1)] === 0);
E.setFlag(g, mineCell, true);
check('a flagged cell cannot be opened', E.reveal(g, mineCell) === '' && g.state === 'play');
/* chord */
const c = (() => { const nb = B.neighbours(9, 9); for (let i = 0; i < 81; ++i) if (g.open[i] && g.num[i] > 0 && nb[i].some(j => !g.open[j] && !g.mine[j])) return i; return -1; })();
if (c >= 0) {
  for (const j of B.neighbours(9, 9)[c]) if (g.mine[j]) E.setFlag(g, j, true);
  const before = g.opened;
  E.chord(g, c);
  check('chording a satisfied number opens its other neighbours', g.opened > before);
} else check('a board offers a number to chord', false);
/* a mine */
let lost = E.create({ w: 9, h: 9, mines: 10, seed: 'e2' });
E.reveal(lost, 0);
const m2 = lost.mine.indexOf(1);
check('a mine ends the game', E.reveal(lost, m2) === 'boom' && lost.state === 'lost' && lost.hit === m2);
let sh = E.create({ w: 9, h: 9, mines: 10, seed: 'e2', lives: 1 });
E.reveal(sh, 0);
check('a shield defuses the mine instead', E.reveal(sh, sh.mine.indexOf(1)) === 'shield' && sh.state === 'play' && sh.lives === 0 && sh.defused[sh.mine.indexOf(1)]);
/* winning */
const win = E.create({ w: 9, h: 9, mines: 10, seed: 'e3', noGuess: true });
const acts = BOT.playOut(win);
check('the bot clears a proven board without guessing and wins', win.state === 'won' && acts > 0);
check('winning flags every mine', win.mine.every((m, i) => !m || win.flag[i] === 1));
/* items */
const it = E.create({ w: 16, h: 16, mines: 40, seed: 'e4', noGuess: true, gems: 4, chests: 2 });
const evs = [];
E.reveal(it, 120);
evs.push.apply(evs, E.takeEvents(it));
let guard = 0;
while (it.state === 'play' && guard++ < 5000) { BOT.playOne(it); evs.push.apply(evs, E.takeEvents(it)); }
check('gems and chests on safe cells are collected as they open', evs.filter(e => e.type === 'gem').length === 4 && evs.filter(e => e.type === 'chest').length === 2 && it.stats.gems === 4);
/* powers */
let honestPowers = true;
for (let s = 0; s < 20; ++s) {
  const p = E.create({ w: 16, h: 16, mines: 40, seed: 'pw' + s });
  E.reveal(p, 0);
  if (p.state !== 'play') continue;
  const a = E.scan(p), b = E.sonar(p), l = E.lantern(p, -1);
  if (a >= 0 && p.mine[a]) honestPowers = false;
  if (b >= 0 && !p.mine[b]) honestPowers = false;
  if (p.state === 'lost') honestPowers = false;
  for (const j of [l].concat(B.neighbours(16, 16)[l])) if (p.mine[j] ? p.flag[j] !== 1 : !p.open[j]) honestPowers = false;
}
check('scan opens safe cells, sonar flags mines, the lantern lights a 3 x 3 - never a blast', honestPowers);
/* guardians */
const gd = E.create({ w: 16, h: 16, mines: 40, seed: 'gd', noGuess: true });
E.reveal(gd, 120);
for (let k = 0; k < 30; ++k) BOT.playOne(gd);
const opened0 = gd.opened;
const bur = E.rebury(gd, 3);
check('reburied number cells close again and can be reopened', bur.length === 3 && gd.opened === opened0 - 3 && bur.every(i => E.reveal(gd, i) === 'open'));
for (let i = 0; i < 256; ++i) if (gd.mine[i]) E.setFlag(gd, i, true);
check('a guardian can knock flags off', E.unflag(gd, 2).length === 2);
const patch = E.fog(gd, 4, 2);
const inside = patch.y * 16 + patch.x;
check('fog hides a patch for a while', E.fogged(gd, inside));
E.step(gd, 2.1);
check('then lifts', !E.fogged(gd, inside));
gd.flagLockT = 3;
const anyClosed = gd.open.findIndex((o, i) => !o && gd.flag[i] !== 1);
check('frozen flags cannot be planted', !E.toggleFlag(gd, anyClosed));
/* the bot on proven and classic boards */
let clean = 0;
for (let s = 0; s < 10; ++s) {
  const pg = E.create({ w: 30, h: 16, mines: 99, seed: 'x' + s, noGuess: true });
  let guessed = false, n = 0;
  while (E.playing(pg) && n++ < 3000) { const a = BOT.next(pg); if (a.guess) guessed = true; BOT.act(pg, a); }
  if (pg.state === 'won' && !guessed) ++clean;
}
check('the bot clears ten proven Expert boards without a single guess', clean === 10, clean);
let finished = 0, wins = 0;
for (let s = 0; s < 30; ++s) {
  const cg = E.create({ w: 30, h: 16, mines: 99, seed: 'c' + s });
  BOT.playOut(cg);
  if (cg.state === 'won' || cg.state === 'lost') ++finished;
  if (cg.state === 'won') ++wins;
}
check('on classic Expert boards it always finishes, guessing when it must', finished === 30 && wins > 3, wins);
/* saving */
const sv = E.create({ w: 16, h: 16, mines: 40, seed: 'sv', noGuess: true, gems: 3 });
E.reveal(sv, 100);
for (let k = 0; k < 10; ++k) BOT.playOne(sv);
const cp = JSON.parse(JSON.stringify(sv));
BOT.playOut(sv); BOT.playOut(cp);
check('a game survives JSON and plays on the same', sv.state === cp.state && sv.score === cp.score && sv.open.join('') === cp.open.join(''));
done();
