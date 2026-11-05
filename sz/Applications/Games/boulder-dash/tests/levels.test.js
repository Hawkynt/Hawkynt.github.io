'use strict';

/* Completability: every story cave must pass the static safety analysis (enough gems and the
   exit reachable by digging that never loosens a boulder or opens a creature pocket) AND be
   finished by the autopilot within its clock without dying. Endless modes are checked on
   sampled seeds: statically always, by the autopilot on the large majority. */
const H = require('./harness.js');
const { playCave } = require('./play.js');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const C = NS.constants;
const L = NS.levels;

let storyTime = 0;
for (let ch = 0; ch < 5; ++ch)
  for (let lv = 0; lv < 8; ++lv) {
    const p = L.storyParams(ch, lv);
    const cv = L.build(p);
    const name = 'story ' + (ch + 1) + '-' + (lv + 1) + ' ' + NS.story.CHAPTERS[ch].levels[lv];
    if (p.kind !== 'boss') {
      check(name + ': static route to quota and exit', NS.solver.isSolvable(cv), 'required ' + cv.required);
      check(name + ': quota close to design', cv.required >= Math.ceil(p.required * 0.85), cv.required + ' of ' + p.required);
    } else check(name + ': boss arena has a boss and dynamite', !!cv.boss && cv.cells.some((t, i) => t === C.ITEM && cv.item[i] === 1));
    const res = playCave(NS, cv, p.time);
    storyTime += res.seconds;
    check(name + ': autopilot finishes it alive', res.won && res.alive, (res.alive ? 'stuck' : 'died') + ' after ' + res.seconds.toFixed(1) + ' s with ' + res.gems + '/' + res.required);
    check(name + ': within the clock', res.seconds <= p.time, res.seconds.toFixed(1) + ' s of ' + p.time);
  }
console.log('autopilot story total ' + storyTime.toFixed(0) + ' s');

/* the same seed always gives the same cave */
const a = L.build(L.storyParams(2, 3)), b = L.build(L.storyParams(2, 3));
check('story caves are deterministic', a.cells.join() === b.cells.join());

let staticOk = 0, botOk = 0, total = 0;
function sample(p) {
  const cv = L.build(p);
  ++total;
  if (NS.solver.isSolvable(cv) || p.kind === 'boss') ++staticOk;
  if (p.zen) cv.zen = true;
  if (playCave(NS, cv, p.time || 400).won) ++botOk;
}
for (const rs of [11, 22]) for (let n = 1; n <= 20; ++n) sample(L.arcadeParams(n, rs));
for (let n = 1; n <= 6; ++n) sample(L.zenParams(n, 5));
for (let n = 1; n <= 8; ++n) sample(L.timeParams(n, 9));
for (let d = 1; d <= 14; ++d) {
  const key = '2026-03-' + String(d).padStart(2, '0');
  sample(L.dailyParams(key, NS.progression.dailyModifier(key)));
}
check('endless and daily caves: static route always exists', staticOk === total, staticOk + ' / ' + total);
check('endless and daily caves: autopilot clears at least 90%', botOk >= total * 0.9, botOk + ' / ' + total);
console.log('sampled ' + total + ' caves, autopilot cleared ' + botOk);
done();
