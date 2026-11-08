'use strict';

/* Versus: the attack table; a match deals both boards the same pieces; a clear sends rows that
   land on the other board after the warning and first cancel your own incoming rows; the rival
   steers its pieces step by step and plays on its own; both boards speed up; a fast player
   beats the Rookie, the Legend beats a slow player; topping out decides the match; a match
   survives JSON and replays the same from its seed. */
const H = require('./harness');
H.installEnv();
const NS = H.load(null, ['js/core/namespace.js', 'js/core/constants.js', 'js/core/rng.js', 'js/core/engine.js', 'js/core/bot.js',
  'js/core/data-worlds.js', 'js/core/data-story.js', 'js/core/data-meta.js', 'js/core/seasons.js', 'js/core/progress.js',
  'js/systems/boss.js', 'js/systems/powers.js', 'js/systems/versus.js', 'js/systems/run.js']);
const { check, done } = H;
const R = NS.run, E = NS.engine, P = NS.progress, V = NS.versus;
const profile = P.newProfile();

/* attack table */
const atk = (o) => V.attackFor(Object.assign({ source: 'piece', lines: 0, tspin: '', b2b: false, combo: 0, perfect: false }, o));
check('a single sends nothing, a double one, a triple two, a quad four', atk({ lines: 1 }) === 0 && atk({ lines: 2 }) === 1 && atk({ lines: 3 }) === 2 && atk({ lines: 4 }) === 4);
check('T-spin single two, double four, triple six, mini double one', atk({ lines: 1, tspin: 'full' }) === 2 && atk({ lines: 2, tspin: 'full' }) === 4
  && atk({ lines: 3, tspin: 'full' }) === 6 && atk({ lines: 2, tspin: 'mini' }) === 1 && atk({ lines: 1, tspin: 'mini' }) === 0);
check('back-to-back adds one, combos add up to five, a perfect clear adds ten', atk({ lines: 4, b2b: true }) === 5 && atk({ lines: 1, combo: 4 }) === 2
  && atk({ lines: 1, combo: 30 }) === 5 && atk({ lines: 1, perfect: true }) === 10);
check('power clears send nothing', V.attackFor({ source: 'sweep', lines: 4 }) === 0);

/* a match */
const run = R.build('versus', { seed: 4242, cpu: 'pro' }, profile);
check('a match has a rival board, the chosen CPU and no orbs', run.rival && run.vs.cpu === 'pro' && run.kind === 'versus' && run.game.orbChance === 0 && run.rival.orbChance === 0);
check('both boards are dealt the same pieces', run.game.piece.t === run.rival.piece.t && run.game.queue.join('') === run.rival.queue.join(''));
check('the objective names the rival', /Pro/.test(R.objective(run).text));

/* sending and cancelling */
const quad = { type: 'clear', source: 'piece', lines: 4, tspin: '', b2b: false, combo: 0, perfect: false };
let sent = V.onClear(run, 'you', quad);
check('a quad sends four rows to the rival', sent === 4 && V.pending(run, 'rival') === 4 && run.vs.you.sent === 4);
const before = E.stackHeight(run.rival);
V.landing(run, 'rival', V.LAND / 2);
check('they wait during the warning', V.pending(run, 'rival') === 4 && E.stackHeight(run.rival) === before);
V.landing(run, 'rival', V.LAND);
check('then land as garbage with one hole', V.pending(run, 'rival') === 0 && E.garbageLeft(run.rival) === 4 * 9 && run.vs.rival.received === 4);
V.onClear(run, 'rival', quad);
check('the rival hits back', V.pending(run, 'you') === 4);
sent = V.onClear(run, 'you', Object.assign({}, quad, { lines: 3 }));
check('your triple cancels two of the four incoming rows', sent === 0 && V.pending(run, 'you') === 2 && run.vs.you.cancelled === 2);
V.onClear(run, 'you', quad);
check('a quad cancels the rest and sends two on', V.pending(run, 'you') === 0 && V.pending(run, 'rival') === 2);

/* the rival plays on its own, one step at a time */
const r2 = R.build('versus', { seed: 99, cpu: 'pro' }, profile);
let moves = 0, drops = 0;
for (let i = 0; i < 120 * 8; ++i) {
  R.tick(r2, 1 / 120, {}, profile);
  for (const e of R.takeEvents(r2)) if (e.type === 'rival') { if (e.ev.type === 'move' || e.ev.type === 'rotate') ++moves; if (e.ev.type === 'harddrop') ++drops; }
  if (r2.done) break;
}
check('the rival turns and slides its pieces before dropping them', moves > 5 && drops >= 5 && r2.rival.pieces >= 5);

/* speeding up */
const r3 = R.build('versus', { seed: 7, cpu: 'legend' }, profile);
for (let i = 0; i < 120 * 30 && !r3.done; ++i) {
  if (r3.game.piece && !r3.game.clearing) NS.bot.playPiece(r3.game);
  R.tick(r3, 1 / 120, {}, profile);
  R.takeEvents(r3);
}
check('both boards speed up every 25 seconds', r3.game.level >= 2 && r3.rival.level === r3.game.level);

/* who wins */
function match(cpu, seed, every) {
  const m = R.build('versus', { seed: seed, cpu: cpu }, profile);
  let t = 0, next = 0;
  while (!m.done && t < 600) {
    if (m.game.piece && !m.game.clearing && t >= next) { NS.bot.playPiece(m.game, { deep: true }); next = t + every; }
    R.tick(m, 1 / 30, {}, profile);
    R.takeEvents(m);
    t += 1 / 30;
  }
  return m;
}
let fastWins = 0, slowLosses = 0;
for (let k = 0; k < 3; ++k) {
  const a = match('rookie', 300 + k, 0.2);
  if (a.done && a.won && a.reason === 'ko' && a.rival.over) ++fastWins;
  const b = match('legend', 400 + k, 1.6);
  if (b.done && !b.won && b.reason === 'topout' && b.game.over) ++slowLosses;
}
check('a quick player beats the Rookie', fastWins >= 2, fastWins);
check('the Legend beats a slow player', slowLosses >= 2, slowLosses);

/* saving and replay */
const r4 = R.build('versus', { seed: 555, cpu: 'ace' }, profile);
for (let i = 0; i < 240; ++i) { R.tick(r4, 1 / 60, {}, profile); R.takeEvents(r4); }
const copy = JSON.parse(JSON.stringify(r4));
for (let i = 0; i < 600; ++i) { R.tick(r4, 1 / 60, {}, profile); R.takeEvents(r4); R.tick(copy, 1 / 60, {}, profile); R.takeEvents(copy); }
check('a match survives JSON and plays on the same', r4.rival.board.join('') === copy.rival.board.join('') && r4.rival.pieces === copy.rival.pieces && r4.rival.pieces > 5);
check('every CPU has a name and a colour', V.CPUS.length === 4 && V.CPUS.every(c => c.name && c.color));
done();
