'use strict';

/* The shared soundtrack engine: songs in a style arranged into an endless form (intro once, then
   groove, build-up, drop and breakdown, every pass a little different), the same music for the
   same song every time, gameplay pushing toward the drop, a unique song per level from one theme,
   the old plain songs still composing as before, and every instrument scheduled on a stand-in
   Web Audio context without an error. Run: node sz/Applications/shared/tests/game-music.test.js */
const path = require('path');

let passes = 0, failures = 0;
function check(name, ok, details) {
  if (ok) { ++passes; console.log('PASS ' + name); }
  else { ++failures; console.log('FAIL ' + name + (details !== undefined ? ': ' + details : '')); }
}

/* a stand-in Web Audio context that records what is built */
function fakeAudio() {
  const made = { nodes: 0, sources: 0, errors: [] };
  const param = () => {
    const p = { value: 1 };
    for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues'])
      p[m] = (v, t) => {
        if (!Number.isFinite(v) || (t !== undefined && !Number.isFinite(t))) made.errors.push(m + '(' + v + ', ' + t + ')');
        if (m === 'exponentialRampToValueAtTime' && v <= 0) made.errors.push('exponential ramp to ' + v);
        return p;
      };
    return p;
  };
  const node = (extra) => {
    ++made.nodes;
    const n = Object.assign({ connect: (d) => d || n, disconnect() {}, gain: param(), frequency: param(), detune: param(), Q: param(),
      threshold: param(), ratio: param(), attack: param(), release: param(), knee: param(), pan: param() }, extra || {});
    return n;
  };
  const source = () => node({ start(t) { ++made.sources; if (!Number.isFinite(t)) made.errors.push('start ' + t); }, stop(t) { if (!Number.isFinite(t)) made.errors.push('stop ' + t); }, type: 'sine', buffer: null, loop: false });
  const ctx = {
    currentTime: 0, sampleRate: 8000, state: 'running', destination: node(),
    createGain: () => node(), createBiquadFilter: () => node({ type: 'lowpass' }), createDynamicsCompressor: () => node(),
    createStereoPanner: () => node(), createOscillator: source, createBufferSource: source,
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return { ctx, made };
}

const audio = fakeAudio();
const store = {};
global.window = global;
global.localStorage = { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); } };
const buses = {};
window.SZ = { GameAudio: { running: true, muted: false, context: audio.ctx, bus: n => buses[n] || (buses[n] = audio.ctx.createGain()) } };
window.AudioContext = function() {};
let ticker = null;
global.setInterval = (fn) => { ticker = fn; return 1; };
require(path.join(__dirname, '..', 'game-music.js'));
const M = window.SZ.GameMusic;

/* ── the old plain songs compose exactly as before ── */
const legacy = { id: 'old', bpm: 100, root: 57, scale: 'dorian', prog: [0, 3, 4, 3], swing: 0.1, seed: 19,
  layers: { pad: { vol: 0.04 }, bass: { vol: 0.06, pattern: 'pulse' }, arp: { vol: 0.02, rate: 2, pattern: 'up', oct: 2 }, lead: { vol: 0.03, density: 0.35, min: 0.4 }, drums: { vol: 0.04, style: 'soft', min: 0.35 } } };
const sig = (notes) => notes.map(n => n.t + ':' + n.dur + ':' + n.midi + ':' + n.inst).join(',');
let legacySig = '';
for (let b = 0; b < 16; ++b) legacySig += sig(M.compose(legacy, b, 0.8)) + '|';
check('a plain song (no style) composes the same notes as the old engine', require('crypto').createHash('md5').update(legacySig).digest('hex') === LEGACY_MD5(), require('crypto').createHash('md5').update(legacySig).digest('hex'));
function LEGACY_MD5() { return '94c6a0b9e4a6ad4724f4dd3060f915c3'; }

/* ── styles ── */
const STYLES = Object.keys(M.STYLES);
check('at least eight styles (house, trance, electro, dnb, dubstep, chip, synthwave, funk, epic, ambient)',
  ['house', 'trance', 'electro', 'dnb', 'dubstep', 'chip', 'synthwave', 'funk', 'epic', 'ambient'].every(s => STYLES.indexOf(s) >= 0), STYLES.join());

/* ── the arranger ── */
const song = { id: 'test-electro', style: 'electro', root: 50, scale: 'minor', prog: [0, 5, 6, 4], seed: 11 };
const c0 = M.planCycle(song, 0), c1 = M.planCycle(song, 1);
const names = c => c.map(s => s.name).join(' ');
check('the first pass opens with an intro', c0[0].name === 'intro', names(c0));
check('later passes skip the intro', c1.every(s => s.name !== 'intro'), names(c1));
let buildBeforeDrop = true;
for (let k = 0; k < 12; ++k) {
  const p = M.planCycle(song, k);
  for (let i = 0; i < p.length; ++i) if (p[i].name === 'drop' && (i === 0 || p[i - 1].name !== 'build' && p[i - 1].name !== 'drop')) buildBeforeDrop = false;
}
check('every drop is set up by a build-up', buildBeforeDrop);
check('the plan is the same every time', JSON.stringify(M.planCycle(song, 3)) === JSON.stringify(M.planCycle(Object.assign({}, song), 3)));
const passSigs = new Set();
for (let k = 1; k < 9; ++k) passSigs.add(JSON.stringify(M.planCycle(song, k)));
check('the passes differ from each other (melody, harmony, form, key)', passSigs.size >= 6, passSigs.size);

/* ten minutes without a loop: no 8-bar stretch is heard twice in a row and most are new */
const bars = Math.round(600 / (240 / M.resolve(song).bpm));
const windows = [];
let pos = M.start(song);
const seq = [];
for (let b = 0; b < bars; ++b) {
  seq.push(sig(M.compose(song, b, 0.5, pos)));
  pos = M.advance(song, pos, 0.5);
}
for (let b = 0; b + 8 <= seq.length; b += 8) windows.push(seq.slice(b, b + 8).join('|'));
const distinct = new Set(windows).size;
check('ten minutes of music: most 8-bar stretches are new', distinct / windows.length > 0.7, distinct + ' of ' + windows.length);
let twice = false;
for (let i = 1; i < windows.length; ++i) if (windows[i] === windows[i - 1]) twice = true;
check('and none repeats straight after itself', !twice);

/* sections sound like themselves */
function sectionBars(name) {
  let p = M.start(song);
  const out = [];
  for (let b = 0; b < 400 && out.length < 1; ++b) {
    const sec = M.sectionOf(song, p);
    if (sec.name === name && p.sb === 0) {
      const notes = [];
      let q = p;
      for (let k = 0; k < sec.bars; ++k) { notes.push(M.compose(song, 0, 0.5, q)); q = M.advance(song, q, 0.5); }
      out.push({ sec: sec, notes: notes });
    }
    p = M.advance(song, p, 0.5);
  }
  return out[0];
}
const build = sectionBars('build'), drop = sectionBars('drop'), brk = sectionBars('break'), intro = sectionBars('intro');
const has = (bar, inst) => bar.some(n => n.inst === inst);
check('a build-up rises (a riser) and rolls the snare faster toward the end',
  has(build.notes[0], 'riser') && build.notes[build.notes.length - 1].filter(n => n.inst === 'snare').length > build.notes[0].filter(n => n.inst === 'snare').length);
check('the last beat before the drop holds its breath', build.notes[build.notes.length - 1].every(n => n.t < 14 || n.inst === 'riser'));
check('the drop lands with a crash, the kick and the full band', has(drop.notes[0], 'crash') && has(drop.notes[0], 'kick') && has(drop.notes[0], 'lead') && has(drop.notes[0], 'bass'));
check('the breakdown drops the kick', brk.notes.every(bar => !has(bar, 'kick')));
check('the intro starts thin (no bass, no lead)', !has(intro.notes[0], 'bass') && !has(intro.notes[0], 'lead'));
check('the drop melody sits on the chord on strong beats', (() => {
  const R = M.resolve(song);
  let ok = 0, all = 0;
  let q = M.start(song);
  for (let b = 0; b < 300; ++b) {
    const sec = M.sectionOf(song, q);
    if (sec.name === 'drop') {
      const tones = M.chordOf(song, q).map(s => (M.noteOf(R, s) - R.root) % 12);
      for (const n of M.compose(song, 0, 0.5, q)) if (n.inst === 'lead' && n.t % 8 === 0) {
        ++all;
        if (tones.indexOf((((n.midi - R.root - (sec.transpose || 0)) % 12) + 12) % 12) >= 0) ++ok;
      }
    }
    q = M.advance(song, q, 0.5);
  }
  return all > 0 && ok / all > 0.9;
})(), 'chord tones on strong beats');

/* gameplay pushes the music */
let p = M.start(song);
let sawBreak = false, injected = false;
for (let b = 0; b < 200; ++b) {
  const sec = M.sectionOf(song, p);
  if (b > 40 && sec.name === 'break') sawBreak = true;
  if (sec.injected) injected = true;
  p = M.advance(song, p, 1);
}
check('at full intensity the breakdowns are skipped', !sawBreak);
check('and a calm groove jumps into a build-up', injected);
p = M.start(song);
for (let b = 0; b < 200; ++b) { if (M.sectionOf(song, p).injected) injected = 'calm'; p = M.advance(song, p, 0.3); }
check('calm play never forces a build-up', injected !== 'calm');

/* every style and form composes cleanly */
let bad = [];
for (const st of STYLES) {
  const s = { id: 'x-' + st, style: st, root: 52, scale: 'minor', prog: [0, 3, 4, 5], seed: 5 };
  let q = M.start(s);
  for (let b = 0; b < 120; ++b) {
    for (const n of M.compose(s, b, b % 3 / 2, q)) {
      if (!(n.t >= 0 && n.t < 16) || !(n.dur > 0) || !Number.isFinite(n.midi) || !(n.vol > 0) || n.vol > 0.3) bad.push(st + ' ' + JSON.stringify(n));
    }
    q = M.advance(s, q, b % 3 / 2);
  }
}
check('every style composes valid notes in every section', bad.length === 0, bad.slice(0, 3).join(' | '));
const calm = { id: 'calm', style: 'ambient', root: 60, scale: 'major', prog: [0, 4, 5, 3], seed: 2 };
const calmNames = new Set();
for (let k = 0; k < 4; ++k) for (const s of M.planCycle(calm, k)) calmNames.add(s.name);
check('calm styles never build or drop', !calmNames.has('build') && !calmNames.has('drop'), [...calmNames].join());

/* a unique song per level */
const base = { id: 'tt-realm', style: 'chip', root: 55, scale: 'major', prog: [0, 4, 5, 3], seed: 3, bpm: 140 };
const v1 = M.variant(base, 'stage-1'), v2 = M.variant(base, 'stage-2');
check('a level variant is the same object every time (games compare songs by identity)', M.variant(base, 'stage-1') === v1);
check('levels get different songs', v1.id !== v2.id && (v1.seed !== v2.seed) && sig(M.compose(v1, 20, 0.6)) !== sig(M.compose(v2, 20, 0.6)));
check('in the theme\'s style and close to its tempo and key', v1.style === 'chip' && Math.abs(v1.bpm - 140) <= 12 && Math.abs(v1.root - 55) <= 7);
let uniq = new Set();
for (let i = 0; i < 40; ++i) { const v = M.variant(base, 'lv' + i); uniq.add(v.root + ':' + v.prog.join('') + ':' + v.seed % 97 + ':' + v.scale); }
check('forty levels, forty different songs', uniq.size === 40, uniq.size);

/* playback on a stand-in context: every style, every section, the chain and the sidechain */
for (const st of STYLES) {
  M.play({ id: 'play-' + st, style: st, root: 50, scale: 'minor', prog: [0, 5, 6, 4], seed: 9 });
  for (let k = 0; k < 400; ++k) { audio.ctx.currentTime += 0.2; ticker(); }
}
check('every style plays through every section without a Web Audio error', audio.made.errors.length === 0, audio.made.errors.slice(0, 4).join(' | '));
check('it really schedules sound', audio.made.sources > 10000, audio.made.sources);
check('the player reports where it is in the form', M.position && typeof M.position.section === 'string' && M.position.bars > 0, JSON.stringify(M.position));
M.play(legacy);
for (let k = 0; k < 40; ++k) { audio.ctx.currentTime += 0.2; ticker(); }
check('a plain song still plays', audio.made.errors.length === 0 && M.current === legacy);
const before = audio.made.sources;
M.stinger('win');
check('stingers still play in the current key', audio.made.sources > before);
M.play(null);

console.log(passes + ' passed, ' + failures + ' failed');
if (failures) process.exitCode = 1;
