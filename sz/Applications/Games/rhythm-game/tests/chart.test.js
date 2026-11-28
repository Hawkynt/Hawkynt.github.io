'use strict';

/* Charts from composed music: notes sit on onsets SZ.GameMusic.compose really plays (with swing),
   the same song and options give the same chart, density rises with the level, minimum gaps and
   the burst cap hold, holds never overlap a note in their lane, chords use two lanes, Hush and drift
   notes appear only where a district teaches them, star phrases sit in drops, pickups ride notes,
   duels get attack slots and every story stage charts. */
const H = require('./harness');
H.installEnv();
const NS = H.load('data-worlds.js');
const { check, done } = H;
const M = window.SZ.GameMusic;
const SD = NS.songData, W = NS.worldData;

const song = SD.stageSong(0, 2);
const R = M.resolve(song);
const c = NS.chart.build(song, { level: 0.6, bars: 24 });
/* every note's time is an onset of the composed bar at the scheduler's positions */
let pos = M.start(R, 'groove');
const onsets = new Set();
const six = 60 / R.bpm / 4;
for (let b = 0; b < 24; ++b) {
  for (const n of M.compose(R, b, 0.5, pos)) onsets.add(Math.round((b * 16 * six + n.t * six + (n.t % 2 ? (R.swing || 0) * six : 0)) * 1e4));
  pos = M.advance(R, pos, 0.5);
}
check('every note lies on an onset the music plays', c.notes.every(n => onsets.has(Math.round(n.t * 1e4))));
check('the same song and options chart the same notes', JSON.stringify(NS.chart.build(song, { level: 0.6, bars: 24 }).notes) === JSON.stringify(c.notes));

const counts = [0, 0.25, 0.5, 0.75, 1].map(L => NS.chart.build(song, { level: L, bars: 24 }).count);
check('density rises with the level', counts.every((v, i) => !i || v >= counts[i - 1]) && counts[4] > counts[0] * 3, counts.join(' '));

let gapOk = true, burstOk = true;
for (const L of [0.1, 0.5, 0.9]) {
  const ch = NS.chart.build(song, { level: L, bars: 24 });
  const times = [...new Set(ch.notes.map(n => n.t))].sort((a, b) => a - b);
  for (let i = 1; i < times.length; ++i) if (times[i] - times[i - 1] < 0.084 - 1e-6) gapOk = false;
  const cap = Math.max(1, Math.floor(ch.params.perBeat * 4 + 0.5)), span = ch.beat * 4;
  for (let i = 0, j = 0; i < times.length; ++i) { while (times[i] - times[j] > span - 1e-6) ++j; if (i - j + 1 > cap) burstOk = false; }
}
check('no two note times are closer than 84 ms', gapOk);
check('no four beats hold more notes than the level allows', burstOk);
check('plain charts have taps only', c.notes.every(n => n.kind === 'tap' && !n.chord));

const full = NS.chart.build(SD.stageSong(4, 3), { level: 0.8, bars: 40, kinds: { hold: 1, chord: 1, hush: 1, drift: 1 } });
const kinds = {};
for (const n of full.notes) kinds[n.kind] = (kinds[n.kind] || 0) + 1;
check('a Spire chart has holds, Hush notes and drift notes', kinds.hold > 0 && kinds.hush > 0 && kinds.drift > 0, JSON.stringify(kinds));
check('and chords on two different lanes', full.notes.some(n => n.chord && full.notes.some(m => m !== n && m.t === n.t && m.lane !== n.lane)));
const overlap = full.notes.some(h => h.end && full.notes.some(n => n !== h && n.lane === h.lane && n.t > h.t + 1e-6 && n.t < h.end + 0.05));
check('no note falls into a hold in its lane', !overlap);
check('drift notes come from a neighbour lane', full.notes.filter(n => n.kind === 'drift').every(n => Math.abs(n.from - n.lane) === 1));
check('Hush notes sit in lanes free around them', full.notes.filter(n => n.kind === 'hush').every(h => !full.notes.some(n => n !== h && n.kind !== 'hush' && n.lane === h.lane && Math.abs(n.t - h.t) < 0.2)));
check('star phrases sit in drops', full.phrases.length > 0 && full.phrases.every(p => full.sections[p.bar] === 'drop'));
check('pickups ride real notes', full.notes.filter(n => n.pickup).length >= 2 && full.notes.filter(n => n.pickup).every(n => n.kind !== 'hush'));
const mir = NS.chart.build(song, { level: 0.6, bars: 24, mirror: true });
check('Mirror flips the lanes', mir.notes.every((n, i) => n.lane === 3 - c.notes[i].lane));

const boss = W.stageChart(W.BY_ID['foundry-6']);
check('a duel has attack slots every four bars, majors every eight', boss.attacks.length >= 6 && boss.attacks.every(a => a.bar % 4 === 0) && boss.attacks.filter(a => a.major).every(a => a.bar % 8 === 0));
check('Hammerfall throws Hush notes into its slots', boss.notes.some(n => n.attack >= 0 && n.kind === 'hush'));

let errs = [];
for (const st of W.STAGES) {
  const ch = W.stageChart(st);
  if (!(ch.count > 30 && ch.length > 40)) errs.push(st.id);
  const has = k => ch.notes.some(n => n.kind === k);
  if (st.world < 1 && (has('hold') || has('hush') || has('drift'))) errs.push(st.id + ' early kinds');
  if (st.world === 1 && !has('hold')) errs.push(st.id + ' no holds');
  if (st.world < 3 && has('hush') && !st.boss) errs.push(st.id + ' hush');
}
check('every story stage charts, with only the kinds taught so far', errs.length === 0, errs.join(', '));
check('a practice speed slows the song and its chart', W.stageChart(W.BY_ID['docks-2'], { speed: 0.75 }).length > W.stageChart(W.BY_ID['docks-2']).length * 1.3);
done();
