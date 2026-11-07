/* The soundtrack through the shared SZ.GameMusic: a theme per realm (a pastoral tune in the
   ruins, glassy arpeggios in the hollows, a slow swell in the temple, a hammering march in the
   forge, a starry anthem at the Spire), a guardian theme per realm, a menu theme, calm Zen,
   driving Sprint and Ultra, and a tense Master theme. The festival colours the menu theme;
   the stack height and danger raise the intensity so drums and lead come in. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;

  const pad = (vol, wave) => ({ vol: vol, wave: wave || 'triangle' });
  const REALM = [
    { id: 'tt-verdant', bpm: 104, root: 55, scale: 'major', prog: [0, 4, 5, 3], swing: 0.1, seed: 3,
      layers: { pad: pad(0.03), bass: { vol: 0.07, pattern: 'fifths' }, arp: { vol: 0.02, wave: 'triangle', rate: 2, min: 0.35 }, lead: { vol: 0.04, wave: 'triangle', density: 0.5 }, drums: { vol: 0.05, style: 'four', min: 0.3, hatMin: 0.6 } } },
    { id: 'tt-crystal', bpm: 112, root: 57, scale: 'dorian', prog: [0, 3, 6, 4], seed: 9,
      layers: { pad: pad(0.03, 'sine'), bass: { vol: 0.07, pattern: 'pulse', wave: 'sine' }, arp: { vol: 0.03, wave: 'sine', rate: 2, pattern: 'updown', oct: 2 }, bells: { vol: 0.03 }, lead: { vol: 0.035, wave: 'square', min: 0.4 }, drums: { vol: 0.05, style: 'back', min: 0.45 } } },
    { id: 'tt-sunken', bpm: 96, root: 50, scale: 'minor', prog: [0, 5, 3, 6], swing: 0.05, seed: 21,
      layers: { pad: pad(0.04, 'sawtooth'), bass: { vol: 0.07, pattern: 'root' }, arp: { vol: 0.02, wave: 'triangle', rate: 4, pattern: 'down' }, lead: { vol: 0.04, wave: 'sine', density: 0.4, min: 0.3 }, drums: { vol: 0.05, style: 'soft', min: 0.3 } } },
    { id: 'tt-ember', bpm: 128, root: 52, scale: 'phrygian', prog: [0, 1, 0, 6], seed: 33,
      layers: { pad: pad(0.03, 'sawtooth'), bass: { vol: 0.08, pattern: 'octave', wave: 'square' }, arp: { vol: 0.02, wave: 'square', rate: 2, min: 0.4 }, lead: { vol: 0.04, wave: 'square', density: 0.55, min: 0.25 }, drums: { vol: 0.06, style: 'march' } } },
    { id: 'tt-void', bpm: 118, root: 53, scale: 'lydian', prog: [0, 1, 4, 5], seed: 47,
      layers: { pad: pad(0.04, 'sawtooth'), bass: { vol: 0.07, pattern: 'octave' }, arp: { vol: 0.025, wave: 'square', rate: 2, pattern: 'updown', oct: 2 }, bells: { vol: 0.03 }, lead: { vol: 0.045, wave: 'triangle', density: 0.6 }, drums: { vol: 0.055, style: 'four', min: 0.35 } } },
  ];
  const BOSS = REALM.map((s, i) => Object.assign(JSON.parse(JSON.stringify(s)), { id: s.id + '-boss', bpm: Math.round(s.bpm * 1.18), scale: i === 4 ? 'harmonic' : 'harmonic',
    layers: Object.assign(JSON.parse(JSON.stringify(s.layers)), { drums: { vol: 0.065, style: 'break' }, lead: { vol: 0.045, wave: 'square', density: 0.65 } }) }));
  const MENU = { id: 'tt-menu', bpm: 96, root: 57, scale: 'major', prog: [0, 5, 3, 4], swing: 0.12, seed: 2,
    layers: { pad: pad(0.035), bass: { vol: 0.06, pattern: 'root' }, arp: { vol: 0.02, wave: 'triangle', rate: 4, pattern: 'up' }, lead: { vol: 0.035, wave: 'triangle', density: 0.4, min: 0.3 }, bells: { vol: 0.025 } } };
  const ZEN = { id: 'tt-zen', bpm: 70, root: 55, scale: 'penta', prog: [0, 3, 1, 4], seed: 5, volume: 0.8,
    layers: { pad: pad(0.04, 'sine'), bells: { vol: 0.03 }, lead: { vol: 0.025, wave: 'sine', density: 0.25 } } };
  const SPRINT = { id: 'tt-sprint', bpm: 150, root: 57, scale: 'minor', prog: [0, 5, 6, 4], seed: 61,
    layers: { pad: pad(0.025), bass: { vol: 0.08, pattern: 'octave', wave: 'square' }, arp: { vol: 0.025, wave: 'square', rate: 2 }, lead: { vol: 0.04, wave: 'square', density: 0.6 }, drums: { vol: 0.065, style: 'break' } } };
  const MASTER = { id: 'tt-master', bpm: 140, root: 50, scale: 'harmonic', prog: [0, 5, 3, 4], seed: 77,
    layers: { pad: pad(0.035, 'sawtooth'), bass: { vol: 0.08, pattern: 'pulse' }, arp: { vol: 0.025, wave: 'square', rate: 2, pattern: 'down' }, lead: { vol: 0.045, wave: 'square', density: 0.6 }, drums: { vol: 0.065, style: 'break' } } };

  function themeFor() {
    const s = G.screen;
    const r = G.run;
    if (G.cine) return r && r.boss ? BOSS[r.world] : r ? REALM[r.world || 0] : MENU;
    if ((s === 'game' || s === 'paused' || s === 'results') && r) {
      if (r.mode === 'zen') return ZEN;
      if (r.mode === 'sprint' || r.mode === 'ultra' || r.mode === 'daily') return SPRINT;
      if (r.mode === 'master') return MASTER;
      if (r.boss) return BOSS[r.world || 0];
      return REALM[(r.world || 0) % REALM.length];
    }
    if (s === 'map') return REALM[G.ui.world];
    return MENU;
  }

  function intensity() {
    const r = G.run;
    if (G.screen !== 'game' || !r || !r.game) return 0.3;
    if (r.mode === 'zen') return 0.2;
    const h = NS.engine.stackHeight(r.game);
    let k = 0.4 + Math.min(0.4, h / 30);
    if (r.boss || r.game.combo >= 2) k = Math.max(k, 0.8);
    if (h >= 14) k = 1;
    return k;
  }

  let acc = 1;
  function update(dt) {
    const Mu = SZ.GameMusic;
    if (!Mu) return null;
    acc += dt;
    if (acc < 0.4) return null;
    acc = 0;
    const song = themeFor();
    Mu.setIntensity(intensity());
    if (Mu.current !== song) Mu.play(song);
    return song;
  }

  Object.assign(NS.music, { REALM, BOSS, MENU, ZEN, SPRINT, MASTER, themeFor, intensity, update });
})();
