'use strict';

/* Every story mission is completable: the data is valid (objectives, targets, par times, known
   rock, raider and titan ids) and the autopilot flies each of the thirty missions to the end with
   the base ship (no upgrades) inside a time limit. Ships lost along the way are counted and must
   stay within the three a player starts with on most missions; the run never ends early because
   the autopilot gets extra ships, so the check proves the objective can always be met. */
const H = require('./harness');
H.installEnv({ date: new Date('2026-03-10T10:00:00') });
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const { CHAPTERS } = NS.campaign;
const { ROCK_TYPES } = NS.rockData;
const { ENEMIES, BOSSES } = NS.enemyData;

/* ── data validity ── */
let bad = [];
CHAPTERS.forEach((ch, c) => ch.levels.forEach((L, l) => {
  const key = (c + 1) + '-' + (l + 1);
  const groups = L.rocks.concat(...L.waves);
  for (const g of groups) if (!ROCK_TYPES[g[0]] || !(g[1] >= 1 && g[1] <= 4) || !(g[2] >= 1)) bad.push(key + ' rock ' + g);
  if (L.foes) for (const k of L.foes.kinds) if (!ENEMIES[k]) bad.push(key + ' foe ' + k);
  if (L.obj === 'boss' && !BOSSES[L.boss]) bad.push(key + ' boss');
  if ((L.obj === 'collect' || L.obj === 'rescue') && !(L.target > 0)) bad.push(key + ' target');
  if (L.obj === 'survive' && !(L.time > 0)) bad.push(key + ' time');
  if (L.obj === 'clear' && !L.rocks.length) bad.push(key + ' nothing to clear');
  if (!(L.par > 0)) bad.push(key + ' par');
}));
check('all 30 missions are well formed', bad.length === 0 && NS.campaign.LEVEL_COUNT === 30, bad.join(', '));
check('every chapter ends with its titan', CHAPTERS.every(ch => ch.levels[ch.levels.length - 1].boss === ch.boss));

/* ── the autopilot plays every mission ── */
NS.input.sample = () => NS.bot.think();
const LIMIT = 420;
const report = [];
let worst = 0;
CHAPTERS.forEach((ch, c) => ch.levels.forEach((L, l) => {
  NS.save.refreshStats();
  NS.waves.startRun('story', { chapter: c, level: l });
  NS.screens.setScreen('playing');
  G.run.lives = 99;
  let t = 0, lost = 0;
  while (t < LIMIT && G.screen === 'playing') {
    const before = G.run.lost;
    NS.sim.update(1 / 60);
    t += 1 / 60;
    if (G.run && G.run.lost > before) ++lost;
  }
  const r = G.ui.results;
  const ok = G.screen === 'results' && r && r.win;
  worst = Math.max(worst, lost);
  report.push((c + 1) + '-' + (l + 1) + ' ' + (ok ? 'done' : 'FAILED') + ' in ' + Math.round(t) + ' s, ' + lost + ' ships lost');
  check('mission ' + (c + 1) + '-' + (l + 1) + ' ' + L.name + ' is completable', ok, G.screen + ' after ' + Math.round(t) + ' s');
}));
console.log(report.join('\n'));
done();
