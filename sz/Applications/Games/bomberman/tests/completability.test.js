'use strict';

/* Completability: every story stage passes the structural validator, and a bot clears every
   one of the 35 story stages (and the first arcade arenas, Zen gardens, the daily set and the
   boss rush) in the real simulation. The proof run keeps the bot alive (hurt is disabled), so
   a failure means the stage itself cannot be finished; a second pass with damage on reports
   how far an honest bot gets. */
const H = require('./harness');
const { createBot } = require('./bot');
H.installEnv({ date: '2026-11-05T12:00:00' });
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const C = NS.constants;

G.save.seen.intro = true;
for (let w = 0; w < 5; ++w) { G.save.seen.chapters[w] = true; G.save.seen.bosses[w] = true; }
G.save.seen.finale = true;

const realHurt = NS.player.hurt;
let bot = null;
NS.input.sample = () => { if (bot) bot.step(); };

/* plays the current stage until it is cleared, the run ends or the time runs out */
function playStage(limitSeconds, fearless) {
  bot = createBot(NS, { fearless: fearless });
  if (G.screen === 'results' && G.run && !G.run.over) NS.run.begin();
  while (G.screen === 'cine') NS.cine.skip();
  const steps = limitSeconds * 60;
  for (let i = 0; i < steps; ++i) {
    NS.sim.update(C.STEP);
    if (G.screen === 'results') return G.ui.results;
    if (G.screen === 'cine') NS.cine.skip();
  }
  if (process.env.BOT_DEBUG) { const r = G.run, p = r.player; console.log('TIMEOUT', r.mode, r.level.name, 'screen', G.screen, 'phase', r.phase, 'p', p.x.toFixed(2), p.y.toFixed(2), 'dead', p.dead, 'en', r.enemies.map(e => e.type + '@' + e.x.toFixed(1) + ',' + e.y.toFixed(1)).join(' '), 'boss', r.boss && r.boss.state + ' ' + r.boss.hp, 'exit', r.exitShown, r.exitOpen, r.exitAt, 'lives', r.lives); }
  return null;
}

/* structural validation of every story stage */
let invalid = [];
for (let w = 0; w < 5; ++w)
  for (let l = 0; l < 7; ++l) {
    const lv = NS.levelgen.storyLevel(w, l);
    const p = NS.levelgen.validate(lv);
    if (p.length) invalid.push(w + '-' + l + ': ' + p.join(', '));
  }
check('all 35 story stages pass the validator', invalid.length === 0, invalid.join(' | '));

/* the validator itself catches broken maps */
{
  const lv = NS.levelgen.storyLevel(0, 1);
  const g = lv.grid.slice();
  for (let c = 1; c < C.COLS - 1; ++c) g[5 * C.COLS + c] = C.T_HARD;
  check('the validator rejects a sealed half', NS.levelgen.validate(Object.assign({}, lv, { grid: g })).some(p => p.startsWith('sealed')));
  const g2 = lv.grid.slice();
  g2[lv.exit] = C.T_EMPTY;
  check('the validator rejects an exposed exit', NS.levelgen.validate(Object.assign({}, lv, { grid: g2 })).some(p => p.startsWith('exit')));
}

/* proof pass: the bot cannot die; each world is played start to finish as one run (power-ups
   carry over within a world, as for a player) and every stage must be cleared */
NS.player.hurt = () => false;
const proof = [];
for (let w = 0; w < 5; ++w) {
  NS.run.newRun('story', { world: w, level: 0 });
  for (let l = 0; l < 7; ++l) {
    const res = playStage(900, true);
    const ok = !!(res && res.cleared);
    proof.push({ id: (w + 1) + '-' + (l + 1), ok: ok, t: res ? Math.round(res.time) : -1 });
    if (!ok) break;
  }
}
const failed = proof.filter(p => !p.ok).map(p => p.id);
console.log('story clear times (s): ' + proof.map(p => p.id + '=' + p.t).join(' '));
check('the bot clears all 35 story stages', failed.length === 0, 'not cleared: ' + failed.join(', '));

NS.run.newRun('arcade', { seed: 4242 });
let arcadeCleared = 0;
for (let s = 0; s < 10; ++s) {
  const res = playStage(900, true);
  if (!res || !res.cleared) break;
  ++arcadeCleared;
}
check('the bot clears the first 10 arcade arenas (two bosses)', arcadeCleared === 10, arcadeCleared);

NS.run.newRun('zen', { seed: 99 });
let zen = 0;
for (let s = 0; s < 3; ++s) { const res = playStage(900, true); if (!res || !res.cleared) break; ++zen; }
check('the bot empties three Zen gardens', zen === 3, zen);

NS.run.newRun('daily');
let daily = 0;
for (let s = 0; s < 3; ++s) { const res = playStage(900, true); if (!res || !res.cleared) break; ++daily; }
check("the bot clears today's three daily arenas", daily === 3, daily);

NS.run.newRun('rush');
let rush = 0;
for (let s = 0; s < 5; ++s) { const res = playStage(900, true); if (!res || !res.cleared) break; ++rush; }
check('the bot defeats all five bosses in the rush', rush === 5, rush);

/* honest pass: damage on, lives count; each world as one run - reported, not asserted */
NS.player.hurt = realHurt;
let honest = 0, tried = 0;
for (let w = 0; w < 5; ++w) {
  NS.run.newRun('story', { world: w, level: 0 });
  for (let l = 0; l < 7; ++l) {
    ++tried;
    const res = playStage(600, false);
    if (!res || !res.cleared) break;
    ++honest;
  }
}
console.log('honest bot (can die, three lives per world) cleared ' + honest + ' of ' + tried + ' stages attempted');
check('the honest pass runs to its end', tried >= 5);

done();
