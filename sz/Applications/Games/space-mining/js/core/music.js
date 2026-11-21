/* The soundtrack through the shared SZ.GameMusic, in the style of the 16-bit consoles: FM bass,
   brass, leads and bells, PSG square arpeggios and punchy drums with tom fills (every theme is
   original). One theme per belt - a dorian prospecting groove in the Kessler Drift, harmonic-
   minor heat in the Amber Reach, a dark minor drive in the Verdant Shoals, phrygian dread at the
   Crimson Maw, a wide harmonic theme at the Void Crown - a theme each for the station, the menus,
   Gold Rush and the Daily Belt and Siege, and a variant of the belt theme for every career trip.
   In flight the theme follows the mood read from the game (calm, explore, tension, combat,
   boss), each mood an arrangement of the same theme in the calm, song or war style; the music
   climbs at once but calms only after quiet seconds, and changes land on the next bar line.
   Pause-and-plan thins the band. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;

  const T = (id, style, root, scale, prog, seed, bpm) => ({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed, bpm: bpm });
  const BELTS = [
    T('sm-kessler', 'fm16', 57, 'dorian', [0, 3, 4, 3], 19, 112),
    T('sm-amber', 'fm16', 52, 'harmonic', [0, 5, 3, 4], 53, 116),
    T('sm-verdant', 'fm16', 50, 'minor', [0, 6, 5, 4], 67, 118),
    T('sm-crimson', 'fm16', 48, 'phrygian', [0, 1, 6, 4], 71, 120),
    T('sm-void', 'fm16', 55, 'harmonic', [0, 5, 6, 4], 83, 108),
  ];
  const STATION = T('sm-station', 'fm16', 57, 'major', [0, 4, 5, 3], 7, 104);
  const MENU = T('sm-menu', 'fm16calm', 53, 'lydian', [0, 4, 1, 4], 3, 84);
  const RUSH = T('sm-rush', 'fm16war', 57, 'minor', [0, 5, 6, 4], 61, 150);
  const SIEGE = T('sm-siege', 'fm16war', 50, 'harmonic', [0, 5, 3, 4], 71, 140);

  /* what each mood plays: which arrangement of the theme, where a switch enters it, how hard */
  const ARRANGE = {
    calm: { song: 'calm', from: 'groove', intensity: 0.35 },
    explore: { song: 'explore', from: 'groove', intensity: 0.5 },
    tension: { song: 'war', from: 'groove', intensity: 0.6 },
    combat: { song: 'war', from: 'drop', intensity: 1 },
    boss: { song: 'boss', from: 'drop', intensity: 1 },
  };
  const RANK = { calm: 0, explore: 1, tension: 2, combat: 3, boss: 4 };
  /* seconds a quieter mood must last before the music steps down from this one */
  const HOLD = { calm: 5, explore: 5, tension: 8, combat: 8, boss: 8 };
  const NEAR = 1500, CONTACT = 3000;

  /* the calm, explore, war and boss arrangements of one theme: same key, chords and motif */
  const sets = new Map();
  function moodSongs(base) {
    let s = sets.get(base);
    if (s) return s;
    const b = base.bpm || 116;
    const mk = (mood, style, bpm, extra) => Object.assign({ id: base.id + ':' + mood, style: style, bpm: bpm,
      root: base.root, scale: base.scale, prog: base.prog, seed: base.seed }, extra || {});
    s = {
      calm: mk('calm', 'fm16calm', Math.round(b * 0.78)),
      explore: mk('explore', 'fm16', b),
      war: mk('war', 'fm16war', Math.round(b * 1.18)),
      boss: mk('boss', 'fm16war', Math.round(b * 1.06), { scale: 'phrygian' }),
    };
    if (sets.size > 64) sets.clear();
    sets.set(base, s);
    return s;
  }

  function baseTheme() {
    const run = G.run;
    if (run.mode === 'siege') return SIEGE;
    if (run.mode === 'rush' || run.mode === 'daily') return RUSH;
    return BELTS[Math.max(0, Math.min(BELTS.length - 1, run.zoneIndex || 0))];
  }

  /* the trip's songs: every career trip plays a variant of its belt's theme */
  function songsFor() {
    const run = G.run;
    let base = baseTheme();
    if (run.mode === 'career' && run.seed && SZ.GameMusic) base = SZ.GameMusic.variant(base, 'trip-' + run.seed);
    return moodSongs(base);
  }

  function screenTheme() {
    if (G.screen === 'station' || G.screen === 'results' || G.screen === 'tree' || G.screen === 'colonies') return STATION;
    return MENU;
  }

  /* ── the mood ── */
  let mineT = 0;
  function signals() {
    const o = { mining: false, cruising: false, docked: false, threats: 0, raid: false, waveSoon: false, storm: false, ambush: false, boss: false };
    const run = G.run, s = G.ship;
    if (!run || !s) return o;
    o.docked = !!run.docked;
    o.mining = mineT > 0;
    o.cruising = Math.sqrt(s.vx * s.vx + s.vy * s.vy) > 140;
    const h = G.base && NS.base.hub ? NS.base.hub() : null;
    const near = (x, y, r) => (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y) < r * r || (h && (x - h.x) * (x - h.x) + (y - h.y) * (y - h.y) < r * r);
    for (let i = 0; i < G.pirates.length; ++i) {
      const p = G.pirates[i];
      if (!p.alive) continue;
      if (near(p.x, p.y, NEAR)) ++o.threats;
      else if (near(p.x, p.y, CONTACT)) o.ambush = true;
    }
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive || e.dormant || e.def.target === 'static') continue;
      if (e.def.boss) o.boss = true;
      if (near(e.x, e.y, NEAR)) ++o.threats;
      else if (near(e.x, e.y, CONTACT)) o.ambush = true;
    }
    if (G.base && NS.base.claimed && NS.base.claimed()) {
      o.raid = !!G.base.active;
      o.waveSoon = !G.base.active && G.base.waveT > 0 && G.base.waveT < 30;
    }
    o.storm = !!G.storm && (G.storm.phase === 'warn' || G.storm.phase === 'active');
    const op = run.op, def = NS.operation.def ? NS.operation.def() : null;
    if (op && op.status === 'active' && def && def.threat && op.waveT < 8) o.ambush = true;
    return o;
  }

  function decide(sig) {
    if (sig.boss) return 'boss';
    if (sig.threats > 0 || sig.raid) return 'combat';
    if (sig.waveSoon || sig.storm || sig.ambush) return 'tension';
    if (sig.docked || sig.mining) return 'calm';
    return sig.cruising ? 'explore' : 'calm';
  }

  function newMood() {
    return { cur: 'calm', want: '', wait: 0 };
  }

  /* climb at once; step down only when the quieter mood has lasted HOLD seconds */
  function step(m, target, dt) {
    if (target === m.cur) { m.want = ''; m.wait = 0; return m.cur; }
    if (RANK[target] > RANK[m.cur]) { m.cur = target; m.want = ''; m.wait = 0; return m.cur; }
    if (m.want !== target) { m.want = target; m.wait = 0; }
    m.wait += dt;
    if (m.wait >= HOLD[m.cur]) { m.cur = target; m.want = ''; m.wait = 0; }
    return m.cur;
  }

  const mood = newMood();
  function inFlight() {
    return !!G.run && (G.screen === 'playing' || G.screen === 'paused' || G.screen === 'cine' || G.screen === 'supply');
  }

  let acc = 1;
  function update(dt) {
    const Mu = SZ.GameMusic;
    if (!Mu) return null;
    if (G.run && G.run.lasering) mineT = 3;
    else mineT = Math.max(0, mineT - dt);
    acc += dt;
    if (acc < 0.25) return null;
    const elapsed = acc;
    acc = 0;
    let song, opts, intensity;
    if (inFlight()) {
      const set = songsFor();
      if (G.screen === 'playing') step(mood, decide(signals()), elapsed);
      const a = ARRANGE[mood.cur];
      song = set[a.song];
      intensity = G.cmd.on && G.cmd.plan ? 0.2 : a.intensity;
      const cur = Mu.current;
      /* within the trip's songs a change waits for the bar line and enters at the mood's section */
      if (cur && (cur === set.calm || cur === set.explore || cur === set.war || cur === set.boss)) opts = { onBar: true, from: a.from };
    } else {
      mood.cur = 'calm';
      mood.want = '';
      mood.wait = 0;
      song = screenTheme();
      intensity = 0.3;
    }
    Mu.setIntensity(intensity);
    if (Mu.current !== song) Mu.play(song, opts);
    return song;
  }

  /* the theme the game is in: the belt's (before its trip variant), the mode's or the screen's */
  function themeFor() {
    return inFlight() ? baseTheme() : screenTheme();
  }

  /* a short phrase over the music: win, lose, level, rare, unlock */
  function cue(name) {
    if (SZ.GameMusic && SZ.GameMusic.stinger) SZ.GameMusic.stinger(name);
  }

  Object.assign(NS.music, {
    BELTS, STATION, MENU, RUSH, SIEGE, ARRANGE, moodSongs, songsFor, themeFor, signals, decide, newMood, step, update, cue,
    state: () => mood
  });
})();
