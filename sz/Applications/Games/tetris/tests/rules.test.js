'use strict';

/* Rule sets: Blast, Pairs and Jewels are modes of their own on the right engine; a Blast bomb in
   a clearing row blows away the blocks around it and the stack collapses; the solo modes run
   until the well tops out and count as score runs; Versus takes any rule set - both boards run
   it, bombs add rows, bursts send stones, a quick player beats the Rookie and the Legend beats
   a slow player in Pairs and Jewels; matches survive JSON. */
const H = require('./harness');
H.installEnv();
const NS = H.load(null, ['js/core/namespace.js', 'js/core/constants.js', 'js/core/rng.js', 'js/core/engine.js', 'js/core/bot.js', 'js/core/match.js',
  'js/core/data-worlds.js', 'js/core/data-story.js', 'js/core/data-meta.js', 'js/core/seasons.js', 'js/core/progress.js',
  'js/systems/boss.js', 'js/systems/powers.js', 'js/systems/versus.js', 'js/systems/run.js']);
const { check, done } = H;
const R = NS.run, E = NS.engine, M = NS.match, V = NS.versus, P = NS.progress, C = NS.constants;
const profile = P.newProfile();

/* modes on their engines */
const bl = R.build('blast', { seed: 1 }, profile), pa = R.build('pairs', { seed: 1 }, profile), je = R.build('jewels', { seed: 1 }, profile);
check('Blast runs on the block engine with bombs and no orbs', !bl.game.match && bl.game.bombChance > 0 && bl.game.orbChance === 0 && bl.rule === 'blast');
check('Pairs and Jewels run on the match engine', pa.game.match && pa.game.rule === 'pairs' && je.game.match && je.game.rule === 'jewels' && R.engineOf(pa.game) === M);
check('each has its own objective', /bomb/i.test(R.objective(bl).text) && /four/.test(R.objective(pa).text) && /three/.test(R.objective(je).text));
check('no powers or revives in the match rules', pa.slots === 0 && pa.revives === 0);

/* a blast */
const g = E.create({ seed: 2, bombChance: 0 });
const COLS = C.COLS, ROWS = C.ROWS;
for (let x = 0; x < COLS; ++x) if (x !== 4) g.board[(ROWS - 1) * COLS + x] = 1;
g.tags[(ROWS - 4) * COLS + 3] = 3;
for (let y = ROWS - 4; y < ROWS - 1; ++y) for (let x = 0; x < COLS; ++x) if (x !== 4) g.board[y * COLS + x] = 2;
/* blocks on top of the three left columns, two rows above the bomb's row and higher */
for (let y = ROWS - 7; y < ROWS - 4; ++y) for (let x = 0; x < 3; ++x) g.board[y * COLS + x] = 5;
g.piece = { t: 'I', r: 1, x: 2, y: ROWS - 4 - 2, orb: -1, bomb: -1 };
E.hardDrop(g);
const evs = [];
for (let i = 0; i < 120; ++i) { E.step(g, 1 / 120, {}); evs.push.apply(evs, E.takeEvents(g)); }
const bang = evs.find(e => e.type === 'blast');
check('a bomb in a clearing row goes off', bang && bang.cells > 0 && g.stats.blasts === 1, bang && bang.cells);
check('and the stack falls into the hole', evs.some(e => e.type === 'cascade'));
check('the clear reports its bomb for Versus', V.attackFor({ type: 'clear', source: 'piece', lines: 2, bombs: 1 }) === 2);

/* solo runs end as score runs */
for (const mode of ['blast', 'pairs', 'jewels']) {
  const r = R.build(mode, { seed: 5 }, profile);
  let t = 0;
  while (!r.done && t < 900) {
    R.tick(r, 1 / 30, { soft: true }, profile);
    R.takeEvents(r);
    t += 1 / 30;
  }
  check(mode + ' runs until the well tops out, as a score run', r.done && r.won && r.reason === 'topout');
}
const pb = R.build('pairs', { seed: 6 }, profile);
for (let i = 0; i < 30 * 40 && !pb.done; ++i) { if (M.active(pb.game)) M.playPiece(pb.game); R.tick(pb, 1 / 30, {}, profile); R.takeEvents(pb); }
check('playing well in Pairs scores and earns festival tokens', pb.game.score > 1000 && pb.tokens > 0);

/* versus with every rule */
for (const rule of R.RULES) {
  const m = R.build('versus', { seed: 9, cpu: 'pro', rule: rule }, profile);
  check('Versus ' + rule + ' puts both boards on the same rule', m.rule === rule && !!m.rival.match === !!m.game.match && (m.rival.rule || '') === (m.game.rule || '') && m.rival.bombChance === m.game.bombChance);
}
check('Pairs bursts send a stone per blob past the third and four per link', V.attackFor({ type: 'burst', cleared: 4, chain: 1 }, 'pairs') === 1 && V.attackFor({ type: 'burst', cleared: 4, chain: 3 }, 'pairs') === 9);
check('Jewels bursts send a stone per jewel past the second and three per link', V.attackFor({ type: 'burst', cleared: 3, chain: 1 }, 'jewels') === 1 && V.attackFor({ type: 'burst', cleared: 5, chain: 2 }, 'jewels') === 6);
const ms = R.build('versus', { seed: 11, cpu: 'pro', rule: 'pairs' }, profile);
V.onClear(ms, 'you', { type: 'burst', cleared: 6, chain: 2 });
V.landing(ms, 'rival', V.LAND + 0.1);
let st = 0;
for (const v of ms.rival.board) if (v === M.STONE) ++st;
check('stones land on the rival well', st === 7 && ms.vs.rival.received === 7);

function match(rule, cpu, seed, every) {
  const m = R.build('versus', { seed: seed, cpu: cpu, rule: rule }, profile);
  const EN = R.engineOf(m.game);
  let t = 0, next = 0;
  while (!m.done && t < 900) {
    if (EN.active(m.game) && t >= next) {
      if (m.game.match) M.playPiece(m.game); else NS.bot.playPiece(m.game, { deep: true });
      next = t + every;
    }
    R.tick(m, 1 / 30, {}, profile);
    R.takeEvents(m);
    t += 1 / 30;
  }
  return m;
}
for (const rule of ['blast', 'pairs', 'jewels']) {
  let wins = 0, losses = 0, sent = 0;
  for (let k = 0; k < 3; ++k) {
    const a = match(rule, 'rookie', 500 + k, 0.15);
    if (a.won && a.reason === 'ko') ++wins;
    sent += a.vs.you.sent;
    const b = match(rule, 'legend', 600 + k, 2.4);
    if (b.done && !b.won && b.reason === 'topout') ++losses;
  }
  check('Versus ' + rule + ': a quick player beats the Rookie', wins >= 2 && sent > 0, wins + ' ' + sent);
  check('Versus ' + rule + ': the Legend beats a slow player', losses >= 2, losses);
}
const j1 = R.build('versus', { seed: 13, cpu: 'ace', rule: 'jewels' }, profile);
for (let i = 0; i < 300; ++i) { R.tick(j1, 1 / 60, {}, profile); R.takeEvents(j1); }
const j2 = JSON.parse(JSON.stringify(j1));
for (let i = 0; i < 600; ++i) for (const x of [j1, j2]) { R.tick(x, 1 / 60, {}, profile); R.takeEvents(x); }
check('a Jewels match survives JSON and plays on the same', j1.rival.board.join() === j2.rival.board.join() && j1.rival.pieces === j2.rival.pieces && j1.rival.pieces > 3);
done();
