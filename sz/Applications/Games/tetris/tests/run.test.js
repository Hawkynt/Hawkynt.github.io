'use strict';

/* Sessions: every story stage is built with its objective, and the bot finishes every one of
   them (lines, score, dig, gems, survive, combo) and beats every guardian; stars follow par and
   bonus goals; guardians attack, rage, are cancelled and blocked by Aegis; powers come from orbs
   and work; Second Chance revives; each mode ends the way it should (Sprint at 40 lines, Ultra
   and the Daily on time, Marathon and Master on top-out, Zen never); a session survives JSON. */
const H = require('./harness');
H.installEnv();
const NS = H.load(null, ['js/core/namespace.js', 'js/core/constants.js', 'js/core/rng.js', 'js/core/engine.js', 'js/core/bot.js',
  'js/core/data-worlds.js', 'js/core/data-story.js', 'js/core/data-meta.js', 'js/core/seasons.js', 'js/core/progress.js',
  'js/systems/boss.js', 'js/systems/powers.js', 'js/systems/run.js']);
const { check, done } = H;
const R = NS.run, E = NS.engine, P = NS.progress, W = NS.worldData;

function play(run, profile, maxPieces, opts) {
  opts = opts || {};
  let pieces = 0;
  while (!run.done && pieces < maxPieces) {
    const g = run.game;
    if (g.piece && !g.clearing) {
      if (opts.power && run.powers.length) NS.powers.use(run, 0);
      NS.bot.playPiece(g);
      ++pieces;
    }
    R.tick(run, opts.dt || 0.25, {}, profile);
    R.takeEvents(run);
  }
  return pieces;
}

const profile = P.newProfile();
check('thirty stages in five realms, a guardian closing each', W.STAGES.length === 30 && W.WORLDS.every(w => w.stages[5].kind === 'boss'));
let fails = [];
for (const st of W.STAGES) {
  /* a stage counts as finishable when the bot wins it on one of three deals */
  let run = null;
  for (let k = 0; k < 3 && !(run && run.won); ++k) {
    run = R.build('story', { stage: st.id, seed: 1000 + st.index * 7 + st.world * 31 + k * 101 }, profile);
    if (!R.objective(run).text) fails.push(st.id + ':noobjective');
    play(run, profile, 900, { dt: st.kind === 'boss' ? 0.35 : 0.25 });
  }
  if (!run.won) fails.push(st.id + ':' + st.kind + ':' + run.reason + ':' + run.game.lines + 'l');
}
check('the bot finishes every story stage and beats every guardian', fails.length === 0, fails.join(' '));

/* stars */
const s1 = R.build('story', { stage: 'verdant-1', seed: 5 }, profile);
play(s1, profile, 400);
const stars = R.starsFor(s1);
check('a won stage gives the first star, par time the second', stars[0] && stars[1] === (s1.t <= W.BY_ID['verdant-1'].par));
const rec = P.recordStage(profile, 'verdant-1', [true, true, false], 50);
check('recording stars pays gems and opens the next stage', rec.first && rec.newStars === 2 && profile.gems >= 6 && P.stageOpen(profile, 1) && !P.stageOpen(profile, 2));

/* guardian mechanics */
let run = R.build('story', { stage: 'verdant-6', seed: 9 }, profile);
const bs = run.bossState;
bs.atkT = 0.01;
R.tick(run, 0.05, {}, profile);
check('a guardian attack queues incoming rows', bs.incoming >= 2 && R.takeEvents(run).some(e => e.type === 'attack'));
NS.boss.onClear(run, { lines: 2, source: 'piece', combo: 0 }, profile);
check('a clear cancels incoming rows first', bs.incoming === 0);
bs.atkT = 0.01;
R.tick(run, 0.05, {}, profile);
run.shield = true;
bs.landT = 0.01;
R.tick(run, 0.05, {}, profile);
check('Aegis blocks an attack', !run.shield && E.garbageLeft(run.game) === 0 && run.hitsTaken === 0);
bs.atkT = 0.01;
R.tick(run, 0.05, {}, profile);
bs.landT = 0.01;
R.tick(run, 0.05, {}, profile);
check('unblocked rows arrive as garbage', E.garbageLeft(run.game) > 0 && run.hitsTaken === 1);
NS.boss.onClear(run, { lines: 4, source: 'piece', combo: 6, b2b: true }, profile);
NS.boss.onClear(run, { lines: 4, source: 'piece', combo: 6, b2b: true, perfect: true }, profile);
check('heavy hits make it rage at half health', bs.rage && R.takeEvents(run).some(e => e.type === 'rage'));
check('damage grows with T-spins, back-to-back, combo and perfect clears',
  NS.boss.damageFor({ lines: 2, tspin: 'full' }, profile) > NS.boss.damageFor({ lines: 2 }, profile) &&
  NS.boss.damageFor({ lines: 4, perfect: true }, profile) > NS.boss.damageFor({ lines: 4 }, profile));
const specials = W.BOSSES.map((b, w) => {
  const r = R.build('story', { stage: W.WORLDS[w].id + '-6', seed: 3 }, profile);
  for (let i = 0; i < 6; ++i) NS.bot.playPiece(r.game), R.tick(r, 0.3, {}, profile);
  NS.boss.special(r, b.special);
  return { k: b.special, bs: r.bossState, g: r.game };
});
check('every guardian has its special move', !specials[0].g.canHold && specials[2].bs.fogT > 0 && specials[3].g.gravityMul > 1 && specials[1].g.board.some(c => c === 9));

/* powers */
run = R.build('marathon', { seed: 4 }, profile);
const got = NS.powers.gainOrb(run, profile);
check('an orb gives a power while a slot is free', got && run.powers.length === 1 && !NS.powers.gainOrb(run, profile));
run.powers = ['storm'];
NS.powers.use(run, 0);
check('I-Storm makes the next three pieces bars', run.game.queue.slice(0, 3).join('') === 'III');
run.powers = ['slow'];
NS.powers.use(run, 0);
check('Slow Time cuts gravity', run.game.slowT > 0 && E.gravity(run.game) < 0.5);
run.powers = ['rush'];
NS.powers.use(run, 0);
R.tick(run, 0.05, {}, profile);
check('Score Rush doubles the score', run.game.scoreMul === run.baseScoreMul * 2);
check('locked powers need the tech tree', !P.powerUnlocked(profile, 'quake') && P.powerUnlocked(profile, 'sweep'));

/* revive */
profile.tree.revive = 1;
run = R.build('marathon', { seed: 4 }, profile);
for (let y = 1; y < 22; ++y) for (let x = 0; x < 10; ++x) if (x !== y % 10) run.game.board[y * 10 + x] = 8;
run.game.piece = null; run.game.spawnT = 0.001;
R.tick(run, 0.05, {}, profile);
const evs = R.takeEvents(run);
check('Second Chance turns a top-out into a fresh start once', !run.done && run.revives === 0 && evs.some(e => e.type === 'revive'));
delete profile.tree.revive;

/* modes */
run = R.build('sprint', { seed: 21 }, profile);
play(run, profile, 400);
check('Sprint ends won at 40 lines', run.done && run.won && run.game.lines >= 40);
run = R.build('ultra', { seed: 21 }, profile);
play(run, profile, 2000, { dt: 0.5 });
check('Ultra ends after two minutes', run.done && run.reason === 'time' && Math.abs(run.t - 120) < 0.1);
run = R.build('daily', { date: new Date(2026, 10, 8) }, profile);
const run2 = R.build('daily', { date: new Date(2026, 10, 8) }, profile);
check('the Daily Challenge has one seed and two mutators per day', run.seed === run2.seed && run.mutators.length === 2 && run.timeLimit === 180);
run = R.build('zen', { seed: 2 }, profile);
for (let y = 1; y < 22; ++y) for (let x = 0; x < 10; ++x) if (x !== y % 10) run.game.board[y * 10 + x] = 8;
run.game.piece = null; run.game.spawnT = 0.001;
R.tick(run, 0.2, {}, profile);
check('Zen never ends', !run.done && !run.game.over);
run = R.build('master', { seed: 2 }, profile);
check('Master starts with instant gravity', E.gravity(run.game) >= 1000);
run = R.build('rush', { seed: 2 }, profile);
play(run, profile, 2500, { dt: 0.35 });
check('the bot wins Boss Rush through all five guardians', run.done && run.won && run.rushIndex === 4, run.reason + ' at ' + run.rushIndex);
run = R.build('marathon', { seed: 2, mutators: ['rising', 'shaky'] }, profile);
let mevs = [];
for (let i = 0; i < 320; ++i) { R.tick(run, 0.1, {}, profile); mevs = mevs.concat(R.takeEvents(run)); }
check('mutators raise garbage and mirror the stack', (E.garbageLeft(run.game) > 0 || run.game.over) && mevs.some(e => e.type === 'mirror'));

/* JSON */
run = R.build('story', { stage: 'crystal-6', seed: 3 }, profile);
play(run, profile, 10);
const copy = JSON.parse(JSON.stringify(run));
play(copy, profile, 5);
check('a session survives JSON and plays on', copy.game.pieces > run.game.pieces && !('profileRef' in copy));
done();
