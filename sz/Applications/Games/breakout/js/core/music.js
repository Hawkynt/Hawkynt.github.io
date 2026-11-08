/* The soundtrack through the shared SZ.GameMusic: a theme per fortress (a bright synth groove
   in the gardens, a glassy waltz-like line in the citadel, a clanking swing in the foundry, a
   slow deep swell in the abyss, a pulsing dark anthem in the engine), a faster guardian theme
   for each, a menu theme, calm Zen and driving Blitz. Combos, multiple balls and the last ball
   raise the intensity so drums and lead come in. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const G = NS.state;

  const pad = (vol, wave) => ({ vol: vol, wave: wave || 'triangle' });
  const WORLD = [
    { id: 'bo-neon', bpm: 118, root: 57, scale: 'mixolydian', prog: [0, 6, 3, 4], seed: 13,
      layers: { pad: pad(0.03, 'sawtooth'), bass: { vol: 0.08, pattern: 'octave', wave: 'square' }, arp: { vol: 0.025, wave: 'square', rate: 2, pattern: 'updown', oct: 2 }, lead: { vol: 0.04, wave: 'square', density: 0.5, min: 0.35 }, drums: { vol: 0.06, style: 'four', min: 0.25 } } },
    { id: 'bo-glacier', bpm: 104, root: 62, scale: 'lydian', prog: [0, 1, 4, 3], seed: 29,
      layers: { pad: pad(0.035, 'sine'), bass: { vol: 0.06, pattern: 'fifths', wave: 'sine' }, arp: { vol: 0.03, wave: 'sine', rate: 2, pattern: 'up', oct: 2 }, bells: { vol: 0.035 }, lead: { vol: 0.035, wave: 'triangle', min: 0.4 }, drums: { vol: 0.045, style: 'soft', min: 0.4 } } },
    { id: 'bo-foundry', bpm: 112, root: 52, scale: 'dorian', prog: [0, 3, 4, 3], swing: 0.22, seed: 41,
      layers: { pad: pad(0.025), bass: { vol: 0.08, pattern: 'walk' }, arp: { vol: 0.02, wave: 'square', rate: 2, min: 0.4 }, lead: { vol: 0.04, wave: 'square', density: 0.55, min: 0.25 }, drums: { vol: 0.06, style: 'shuffle', min: 0.2 } } },
    { id: 'bo-abyss', bpm: 88, root: 50, scale: 'minor', prog: [0, 5, 6, 4], seed: 57,
      layers: { pad: pad(0.045, 'sawtooth'), bass: { vol: 0.07, pattern: 'root', wave: 'sine' }, arp: { vol: 0.02, wave: 'triangle', rate: 4, pattern: 'random', oct: 1 }, lead: { vol: 0.035, wave: 'sine', density: 0.35, min: 0.35 }, drums: { vol: 0.045, style: 'soft', min: 0.3 } } },
    { id: 'bo-gloom', bpm: 124, root: 53, scale: 'harmonic', prog: [0, 5, 3, 4], seed: 71,
      layers: { pad: pad(0.04, 'sawtooth'), bass: { vol: 0.08, pattern: 'pulse' }, arp: { vol: 0.025, wave: 'square', rate: 2, pattern: 'down', oct: 2 }, lead: { vol: 0.045, wave: 'square', density: 0.6, min: 0.25 }, drums: { vol: 0.06, style: 'back', min: 0.2 } } },
  ];
  const BOSS = WORLD.map(s => Object.assign(JSON.parse(JSON.stringify(s)), { id: s.id + '-boss', bpm: Math.round(s.bpm * 1.15), scale: s.scale === 'lydian' ? 'harmonic' : s.scale,
    layers: Object.assign(JSON.parse(JSON.stringify(s.layers)), { drums: { vol: 0.065, style: 'break' }, lead: { vol: 0.045, wave: 'square', density: 0.65 } }) }));
  const MENU = { id: 'bo-menu', bpm: 100, root: 57, scale: 'major', prog: [0, 4, 5, 3], swing: 0.1, seed: 3,
    layers: { pad: pad(0.035), bass: { vol: 0.06, pattern: 'fifths' }, arp: { vol: 0.02, wave: 'triangle', rate: 4, pattern: 'updown' }, lead: { vol: 0.035, wave: 'triangle', density: 0.4, min: 0.3 }, bells: { vol: 0.025 } } };
  const ZEN = { id: 'bo-zen', bpm: 72, root: 55, scale: 'penta', prog: [0, 3, 1, 4], seed: 7, volume: 0.8,
    layers: { pad: pad(0.04, 'sine'), bells: { vol: 0.03 }, lead: { vol: 0.025, wave: 'sine', density: 0.25 } } };
  const BLITZ = { id: 'bo-blitz', bpm: 148, root: 57, scale: 'minor', prog: [0, 5, 6, 4], seed: 63,
    layers: { pad: pad(0.025), bass: { vol: 0.08, pattern: 'octave', wave: 'square' }, arp: { vol: 0.025, wave: 'square', rate: 2 }, lead: { vol: 0.04, wave: 'square', density: 0.6 }, drums: { vol: 0.065, style: 'break' } } };

  function themeFor() {
    const s = G.screen, r = G.run;
    if (G.cine) return r && r.game && r.game.boss ? BOSS[r.world] : r ? WORLD[r.world || 0] : MENU;
    if ((s === 'game' || s === 'paused' || s === 'results') && r) {
      if (r.mode === 'zen') return ZEN;
      if (r.mode === 'blitz' || r.mode === 'daily') return BLITZ;
      if (r.game.boss) return BOSS[r.world || 0];
      return WORLD[(r.world || 0) % WORLD.length];
    }
    if (s === 'map') return WORLD[G.ui.world];
    return MENU;
  }

  function intensity() {
    const r = G.run;
    if (G.screen !== 'game' || !r || !r.game) return 0.3;
    if (r.mode === 'zen') return 0.2;
    const g = r.game;
    let k = 0.45;
    if (g.combo >= 6 || g.balls.length >= 3) k = 0.8;
    if (g.boss || g.combo >= 15 || (!g.infinite && g.lives === 0)) k = 1;
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

  Object.assign(NS.music, { WORLD, BOSS, MENU, ZEN, BLITZ, themeFor, intensity, update });
})();
