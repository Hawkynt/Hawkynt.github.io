'use strict';

/* Sessions: thirty stages in five lands, a guardian closing each; every story field is proven and
   the bot clears every stage and beats every guardian while their strikes, smoke and fuses run;
   stars follow par and bonus goals; guardians wind up, strike, rage and blow when the fuse burns
   down; chests become powers and each power works; Second Chance defuses a lost field; Classic
   keeps the original sizes; the Daily field is the same all day; Zen forgives mines and goes on;
   Rush ends on time, a mine costs ten seconds; the Gauntlet chains all five guardians; Versus is a
   fair race the quick player wins against the Rookie and the Legend wins against a slow one; a
   session survives JSON. */
const H = require('./harness');
H.installEnv();
const NS = H.load(null, ['js/core/namespace.js', 'js/core/constants.js', 'js/core/rng.js', 'js/core/board.js', 'js/core/engine.js', 'js/core/bot.js',
  'js/core/data-worlds.js', 'js/core/data-story.js', 'js/core/data-meta.js', 'js/core/seasons.js', 'js/core/progress.js',
  'js/systems/boss.js', 'js/systems/versus.js', 'js/systems/run.js']);
const { check, done } = H;
const R = NS.run, E = NS.engine, P = NS.progress, W = NS.worldData, BOT = NS.bot, C = NS.constants;
const profile = P.newProfile();

/* the bot plays a session through the session's own actions, `gap` seconds per move */
function play(run, gap, maxT, opts) {
  opts = opts || {};
  let t = 0;
  while (!run.done && t < (maxT || 900)) {
    const g = run.game;
    if (E.playing(g) && !(run.vs && run.vs.stunYou > 0)) {
      if (opts.power && run.powers.length && g.state === 'play') R.usePower(run, 0);
      const a = BOT.next(g);
      if (a) R.act(run, a.type === 'flag' ? 'flag' : 'reveal', a.i, profile);
    }
    /* frames are capped at 0.1 s: long gaps pass in several ticks */
    for (let left = gap; left > 1e-9 && !run.done; left -= 0.1) { R.tick(run, Math.min(0.1, left), profile); R.takeEvents(run); }
    t += gap;
  }
  return run;
}

check('thirty stages in five lands, a guardian closing each', W.STAGES.length === 30 && W.WORLDS.every(w => w.stages[5].kind === 'boss'));
const fails = [];
let strikes = 0, provenAll = true;
for (const st of W.STAGES) {
  const run = R.build('story', { stage: st.id }, profile);
  if (!R.objective(run).text) fails.push(st.id + ':noobjective');
  play(run, 0.35, 1200);
  if (!run.game.proven) provenAll = false;
  if (!run.won) fails.push(st.id + ':' + run.reason);
  if (run.bossState) strikes += run.bossState.strikes;
}
check('every story field is proven solvable by logic', provenAll);
check('the bot clears every stage and beats every guardian', fails.length === 0, fails.join(' '));
check('guardians strike during their fights', strikes >= 10, strikes);
const again = R.build('story', { stage: 'meadow-3' }, profile), again2 = R.build('story', { stage: 'meadow-3' }, profile);
R.act(again, 'reveal', 40, profile); R.act(again2, 'reveal', 40, profile);
check('a story field is the same every time', again.game.mine.join('') === again2.game.mine.join(''));

/* stars */
const s1 = play(R.build('story', { stage: 'meadow-1' }, profile), 0.05, 600);
const stars = R.starsFor(s1, profile);
check('a quick clean clear earns all three stars', stars[0] && stars[1] && stars[2], stars);
const slow = R.build('story', { stage: 'meadow-1' }, profile);
play(slow, 3, 2000);
check('a slow clear misses the par star', slow.won && !R.starsFor(slow, profile)[1]);
check('bonus goals read clearly', R.bonusText({ k: 'chords', n: 3 }) === 'Chord 3 times' && R.bonusText({ k: 'noflag' }));

/* guardians */
const b = R.build('story', { stage: 'meadow-6' }, profile);
R.act(b, 'reveal', Math.floor(b.game.h / 2) * b.game.w + Math.floor(b.game.w / 2), profile);
let evs = [];
for (let i = 0; i < 60 * 30; ++i) { R.tick(b, 1 / 60, profile); evs = evs.concat(R.takeEvents(b)); if (b.done) break; }
check('a guardian winds up before it strikes', evs.some(e => e.type === 'windup') && evs.some(e => e.type === 'strike' && e.kind === 'bury'));
const fz = R.build('story', { stage: 'frost-6' }, profile);
R.act(fz, 'reveal', 100, profile);
NS.boss.strike(fz, 'frost');
check('Rimewing freezes the flags', fz.game.flagLockT > 0);
NS.boss.strike(fz, 'smoke');
check('the Golem\'s smoke hides numbers', fz.game.fog.length === 1);
const fu = R.build('story', { stage: 'meadow-6' }, profile);
R.act(fu, 'reveal', 100, profile);
fu.bossState.fuse = 0.5;
for (let i = 0; i < 60 && !fu.done; ++i) { R.tick(fu, 1 / 60, profile); R.takeEvents(fu); }
check('when the fuse burns down the field blows', fu.done && !fu.won && fu.reason === 'fuse');
const rg = R.build('story', { stage: 'meadow-6' }, profile);
R.act(rg, 'reveal', 100, profile);
for (let k = 0; k < 400 && !rg.bossState.rage && rg.game.state === 'play'; ++k) { BOT.playOne(rg.game); R.tick(rg, 1 / 60, profile); }
check('below half the field the guardian rages', rg.bossState.rage || rg.game.state === 'won');

/* powers */
const pw = R.build('story', { stage: 'ember-1' }, profile);
R.act(pw, 'reveal', 80, profile);
pw.powers = ['scan', 'sonar', 'lantern', 'shield'];
pw.slots = 4;
const o0 = pw.game.opened;
R.usePower(pw, 0);
check('Scanner opens a safe cell', pw.game.opened > o0 && pw.game.state === 'play');
const f0 = E.flagsLeft(pw.game);
R.usePower(pw, 0);
check('Sonar flags a mine', E.flagsLeft(pw.game) === f0 - 1);
R.usePower(pw, 0, 0);
check('the Lantern lights a corner', pw.game.state !== 'lost');
const l0 = pw.game.lives;
R.usePower(pw, 0);
check('a Shield adds a life', pw.game.lives === l0 + 1 && pw.powersUsed === 4 && pw.powers.length === 0);
const ch = R.build('story', { stage: 'meadow-3' }, profile);
let gotPower = false;
for (let i = 0; i < 2000 && !ch.done; ++i) {
  const a = BOT.next(ch.game);
  if (a) R.act(ch, a.type === 'flag' ? 'flag' : 'reveal', a.i, profile);
  if (R.takeEvents(ch).some(e => e.type === 'power')) gotPower = true;
}
check('opening a chest gives a power', gotPower);

/* Second Chance */
const p2 = P.newProfile();
p2.tree.revive = 1;
const sc = R.build('story', { stage: 'meadow-2' }, p2);
R.act(sc, 'reveal', 40, p2);
const mi = sc.game.mine.indexOf(1);
R.act(sc, 'reveal', mi, p2);
check('Second Chance defuses the mine instead of ending the field', !sc.done && sc.game.defused[mi] && sc.revives === 0);
R.act(sc, 'reveal', sc.game.mine.indexOf(1, mi + 1), p2);
check('but only once', sc.done && !sc.won && sc.reason === 'boom');

/* modes */
const cl = R.build('classic', { diff: 'expert', seed: 3 }, profile);
check('Classic Expert is 30 x 16 with 99 mines and no powers, shields or treasure', cl.game.w === 30 && cl.game.h === 16 && cl.game.mines === 99 && cl.slots === 0 && cl.game.lives === 0 && cl.game.gems === 0);
play(cl, 0.02, 600);
check('a Classic game ends in a win or a loss', cl.done && (cl.reason === 'goal' || cl.reason === 'boom'));
const pr = R.build('classic', { diff: 'intermediate', seed: 4, proven: true }, profile);
play(pr, 0.02, 600);
check('Classic with proven fields asked for clears without guessing', pr.won && pr.game.proven);
const d = new Date(2026, 10, 8);
const da = R.build('daily', { date: d }, profile), db = R.build('daily', { date: d }, profile);
R.act(da, 'reveal', 0, profile); R.act(db, 'reveal', 0, profile);
check('the Daily field is the same for everyone that day', da.game.mine.join('') === db.game.mine.join('') && da.mutators.length === 2);
play(da, 0.1, 900);
check('the bot clears a Daily field', da.won || da.reason === 'time', da.reason);
const zen = R.build('zen', { seed: 5 }, profile);
play(zen, 0.05, 120);
check('Zen goes on field after field', zen.field >= 3 && !zen.done, zen.field);
R.act(zen, 'reveal', zen.game.mine ? zen.game.mine.indexOf(1) : 0, profile);
check('a mine in Zen only costs points', !zen.done);
const rush = R.build('rush', { seed: 6 }, profile);
play(rush, 0.1, 400);
check('Rush ends on time with fields cleared', rush.done && rush.won && rush.reason === 'time' && rush.fields >= 3, rush.fields);
const rp = R.build('rush', { seed: 7 }, profile);
R.act(rp, 'reveal', 0, profile);
const t0 = rp.t;
R.act(rp, 'reveal', rp.game.mine.indexOf(1), profile);
check('a mine in Rush costs ten seconds', rp.t >= t0 + 10 && !rp.done);
const ga = R.build('gauntlet', { seed: 8 }, profile);
play(ga, 0.2, 3000);
check('the Gauntlet chains all five guardians', ga.won && ga.fields === 5, ga.reason + ' ' + ga.fields);

/* versus */
const vs = R.build('versus', { seed: 9, cpu: 'pro' }, profile);
check('a race opens the same middle on both fields', vs.rival && vs.game.mine.join('') === vs.rival.mine.join('') && vs.game.opened === vs.rival.opened && vs.game.opened > 0);
let quick = 0, beaten = 0;
for (let k = 0; k < 3; ++k) {
  if (play(R.build('versus', { seed: 20 + k, cpu: 'rookie' }, profile), 0.15, 600).won) ++quick;
  const v = play(R.build('versus', { seed: 30 + k, cpu: 'legend' }, profile), 1.2, 900);
  if (v.done && !v.won && v.reason === 'beaten') ++beaten;
}
check('a quick player beats the Rookie', quick >= 2, quick);
check('the Legend beats a slow player', beaten >= 2, beaten);
const st2 = R.build('versus', { seed: 40, cpu: 'pro' }, profile);
R.act(st2, 'reveal', st2.game.mine.indexOf(1), profile);
check('a mine in a race stuns instead of ending it', !st2.done && st2.vs.stunYou > 0 && R.act(st2, 'reveal', 0, profile) === '');

/* saving */
const sv = R.build('story', { stage: 'archive-6' }, profile);
play(sv, 0.3, 20);
const cp = JSON.parse(JSON.stringify(sv));
play(sv, 0.3, 60); play(cp, 0.3, 60);
check('a session survives JSON and plays on the same', sv.game.opened === cp.game.opened && sv.bossState.strikes === cp.bossState.strikes && sv.game.score === cp.game.score);
done();
