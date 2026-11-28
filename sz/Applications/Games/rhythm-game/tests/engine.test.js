'use strict';

/* The song engine over small hand-made charts: Perfect, Great and Good windows with Early/Late,
   misses let past, the combo multiplier steps, groove and fail (no-fail, Second Wind), holds kept and
   broken, Hush notes pressed and dodged, shields and the Safety Net, pickups, star phrases filling
   Surge and Surge doubling the score, boss health, rage, telegraphed attacks and Hammerfall's Hush
   notes, the grade, and the perfect bot clearing a duel. */
const H = require('./harness');
H.installEnv();
const NS = H.load('data-worlds.js');
const { check, done } = H;
const E = NS.engine, C = NS.constants;

function chart(notes, extra) {
  notes.forEach((n, i) => { n.id = i; n.kind = n.kind || 'tap'; if (n.attack == null) n.attack = -1; });
  return Object.assign({ notes: notes, phrases: [], attacks: [], params: { win: 1, drain: 0.1 }, length: 20, count: notes.filter(n => n.kind !== 'hush').length, beat: 0.5 }, extra || {});
}
const taps = (n, gap, lane) => Array.from({ length: n }, (_, i) => ({ t: 1 + i * (gap || 0.5), lane: lane == null ? i % 4 : lane }));

let c = chart(taps(4));
let s = E.create(c);
E.update(s, c, 0.98);
check('a press 20 ms early is Perfect', E.press(s, c, 0, 0.98) === 'perfect');
E.update(s, c, 1.56);
check('70 ms late is Great and counts as Late', E.press(s, c, 1, 1.57) === 'great' && s.late === 1);
check('120 ms early is Good and counts as Early', E.press(s, c, 2, 1.88) === 'good' && s.early === 1);
check('a press far from any note does nothing', E.press(s, c, 3, 2.1) === null && s.counts.miss === 0);
E.update(s, c, 3);
check('a note let past is a miss and breaks the combo', s.counts.miss === 1 && s.combo === 0 && s.maxCombo === 3);
check('the wrong lane does not hit', (() => { const c2 = chart(taps(1, 0.5, 2)), s2 = E.create(c2); E.update(s2, c2, 1); return E.press(s2, c2, 1, 1) === null; })());

c = chart(taps(60, 0.25));
s = E.create(c);
for (const n of c.notes) { E.update(s, c, n.t); E.press(s, c, n.lane, n.t); }
check('the multiplier steps at 10, 25 and 50', E.mult(s) === 4 && s.events.some(e => e.type === 'mult' && e.mult === 2));
check('a perfect run scores and grades S+', s.score > 60 * 300 * 2 && (E.update(s, c, 30), E.grade(s) === 'S+'));

c = chart(taps(30, 0.3));
s = E.create(c, { grooveStart: 0.3 });
E.update(s, c, 20);
check('misses drain the groove until the song fails', s.failed && s.done && s.events.some(e => e.type === 'fail'));
s = E.create(c, { grooveStart: 0.3, noFail: true });
E.update(s, c, 21);
check('a no-fail song keeps going', !s.failed && s.done);
s = E.create(c, { grooveStart: 0.3, rescue: true });
E.update(s, c, 3);
check('Second Wind rescues one fail at half groove', s.events.some(e => e.type === 'rescue') && !s.failed);

c = chart([{ t: 1, lane: 1, kind: 'hold', end: 2.5 }, { t: 3, lane: 2, kind: 'hold', end: 4.5 }]);
s = E.create(c);
E.update(s, c, 1); E.press(s, c, 1, 1); E.update(s, c, 2.6);
check('a hold kept to its tail completes and scores', s.holdsOk === 1 && s.events.some(e => e.type === 'hold-ok'));
E.update(s, c, 3); E.press(s, c, 2, 3); E.update(s, c, 3.5); E.release(s, c, 2, 3.5);
check('letting go early breaks it', s.holdsBroken === 1 && s.combo === 0);

c = chart([{ t: 1, lane: 0, kind: 'hush' }, { t: 2, lane: 1, kind: 'hush' }, { t: 3, lane: 1 }]);
s = E.create(c);
E.update(s, c, 1); E.press(s, c, 0, 1.01);
check('pressing a Hush note costs groove', s.hushHit === 1 && s.groove < 0.5);
E.update(s, c, 2.5);
check('a Hush note let past is dodged', s.hushDodged === 1);

c = chart([{ t: 1, lane: 0, pickup: 'shield' }, { t: 1.5, lane: 1 }, { t: 2, lane: 2 }, { t: 2.5, lane: 3, pickup: 'magnet' }]);
s = E.create(c);
E.update(s, c, 1); E.press(s, c, 0, 1);
E.update(s, c, 1.5); E.press(s, c, 1, 1.5);
E.update(s, c, 2.3);
check('a shield keeps the combo through a miss', s.counts.miss === 1 && s.combo === 2 && s.shield === 0);
E.press(s, c, 3, 2.5);
check('the Magnet widens the windows', s.magnetT > 7 && E.windows(s).good > C.WINDOWS.good * 1.4);
c = chart(taps(4));
s = E.create(c, { net: 1 });
E.update(s, c, 1); E.press(s, c, 0, 1);
E.update(s, c, 1.5); E.press(s, c, 1, 1.5);
E.update(s, c, 2.4);
check('the Safety Net forgives a miss', s.combo === 2 && s.net === 0);
E.update(s, c, 2.9);
check('until it runs out', s.combo === 0);

c = chart(taps(8, 0.25), { phrases: [{ id: 1, n: 4 }, { id: 2, n: 4 }] });
c.notes.forEach((n, i) => { n.star = i < 4 ? 1 : 2; });
s = E.create(c);
for (const n of c.notes) { E.update(s, c, n.t); E.press(s, c, n.lane, n.t); }
check('two full star phrases make Surge ready', s.phrasesDone === 2 && s.surge >= 0.5 && s.events.some(e => e.type === 'surge-ready'));
const c3 = chart(taps(20, 0.25, 0).map((n, i) => ({ t: n.t, lane: i % 4 })));
const a = E.create(c3), b = E.create(c3);
b.surge = 1;
E.update(b, c3, 0.9);
check('Surge can be unleashed when ready', E.surge(b, c3));
for (const n of c3.notes) for (const x of [a, b]) { E.update(x, c3, n.t); E.press(x, c3, n.lane, n.t); }
check('and doubles the score while it lasts', b.score > a.score * 1.6);

/* duel */
const st = NS.worldData.BY_ID['foundry-6'];
const duel = NS.worldData.stageChart(st);
s = E.create(duel, { boss: st.boss });
check('a duel boss has health from the note count', s.boss.max === Math.round(duel.count * st.boss.hpShare));
check('attack-slot Hush notes wait for their slot', duel.notes.filter(n => n.attack >= 0).every(n => s.res[n.id] === 5));
const won = NS.bot.run(duel, { boss: st.boss }, 'perfect', 1);
check('the perfect bot brings the boss down', won.boss.down && !won.failed);
const ev = [];
const s2 = E.create(duel, { boss: st.boss });
const pl = NS.bot.plan(duel, 'perfect', 2);
for (let t = -1; !s2.done; t += 1 / 30) { NS.bot.step(s2, duel, pl, t); ev.push(...E.take(s2)); }
check('majors telegraph a bar before they strike, then end', ev.some(e => e.type === 'telegraph') && ev.some(e => e.type === 'attack') && ev.some(e => e.type === 'attack-end'));
check('the boss rages below half', ev.some(e => e.type === 'rage'));
check('Hammerfall throws live Hush notes', duel.notes.some(n => n.attack >= 0 && (s2.res[n.id] === 5 || s2.res[n.id] === 6) ));
const lost = NS.bot.run(duel, { boss: st.boss }, 'rookie', 1);
check('a rookie loses the duel', lost.failed);
check('the grade of a failed song is F', E.grade(lost) === 'F');
check('the state survives JSON', (() => { const j = JSON.parse(JSON.stringify(s2)); return j.score === s2.score && j.res.length === s2.res.length; })());
done();
