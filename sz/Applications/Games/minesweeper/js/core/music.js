/* The soundtrack through the shared SZ.GameMusic: a theme per land (a pastoral lilt in Meadowmere,
   music-box bells over Frostfen, a dry driving tune in the Badlands, a watery swing in the
   Archive, a ticking minor march in the Citadel), a faster, darker theme for each guardian, a
   menu theme, a sparse thinking theme for Classic, calm Zen and a driving theme for Rush and
   Versus. A guardian's burning fuse and a close race raise the intensity so drums and lead come
   in. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const G = NS.state;

  const pad = (vol, wave) => ({ vol: vol, wave: wave || 'triangle' });
  const WORLD = [
    { id: 'ms-meadow', bpm: 104, root: 60, scale: 'major', prog: [0, 3, 4, 0], swing: 0.12, seed: 17,
      layers: { pad: pad(0.035, 'sine'), bass: { vol: 0.06, pattern: 'fifths', wave: 'sine' }, arp: { vol: 0.022, wave: 'triangle', rate: 2, pattern: 'updown', oct: 2 }, lead: { vol: 0.035, wave: 'triangle', density: 0.4, min: 0.35 }, drums: { vol: 0.04, style: 'soft', min: 0.4 } } },
    { id: 'ms-frost', bpm: 96, root: 62, scale: 'lydian', prog: [0, 1, 4, 3], seed: 31,
      layers: { pad: pad(0.04, 'sine'), bass: { vol: 0.055, pattern: 'root', wave: 'sine' }, bells: { vol: 0.04 }, arp: { vol: 0.025, wave: 'sine', rate: 4, pattern: 'up', oct: 2 }, lead: { vol: 0.03, wave: 'sine', min: 0.45 }, drums: { vol: 0.035, style: 'soft', min: 0.5 } } },
    { id: 'ms-ember', bpm: 118, root: 52, scale: 'harmonic', prog: [0, 5, 3, 4], seed: 43,
      layers: { pad: pad(0.03, 'sawtooth'), bass: { vol: 0.08, pattern: 'pulse' }, arp: { vol: 0.022, wave: 'square', rate: 2, pattern: 'down', oct: 1, min: 0.3 }, lead: { vol: 0.04, wave: 'square', density: 0.5, min: 0.3 }, drums: { vol: 0.055, style: 'back', min: 0.25 } } },
    { id: 'ms-archive', bpm: 92, root: 55, scale: 'dorian', prog: [0, 3, 1, 4], swing: 0.2, seed: 59,
      layers: { pad: pad(0.045, 'triangle'), bass: { vol: 0.07, pattern: 'walk', wave: 'sine' }, arp: { vol: 0.02, wave: 'triangle', rate: 4, pattern: 'random', oct: 1 }, lead: { vol: 0.03, wave: 'sine', density: 0.35, min: 0.35 }, drums: { vol: 0.045, style: 'shuffle', min: 0.3 } } },
    { id: 'ms-rust', bpm: 112, root: 53, scale: 'minor', prog: [0, 6, 5, 4], seed: 73,
      layers: { pad: pad(0.035, 'sawtooth'), bass: { vol: 0.08, pattern: 'octave', wave: 'square' }, arp: { vol: 0.025, wave: 'square', rate: 2, pattern: 'up', oct: 2 }, lead: { vol: 0.04, wave: 'square', density: 0.55, min: 0.25 }, drums: { vol: 0.06, style: 'four', min: 0.2 } } },
  ];
  const BOSS = WORLD.map(s => Object.assign(JSON.parse(JSON.stringify(s)), { id: s.id + '-boss', bpm: Math.round(s.bpm * 1.18), scale: s.scale === 'lydian' || s.scale === 'major' ? 'harmonic' : s.scale,
    layers: Object.assign(JSON.parse(JSON.stringify(s.layers)), { drums: { vol: 0.065, style: 'break' }, lead: { vol: 0.045, wave: 'square', density: 0.65 } }) }));
  const MENU = { id: 'ms-menu', bpm: 96, root: 57, scale: 'major', prog: [0, 4, 5, 3], swing: 0.1, seed: 5,
    layers: { pad: pad(0.035), bass: { vol: 0.055, pattern: 'fifths' }, arp: { vol: 0.02, wave: 'triangle', rate: 4, pattern: 'updown' }, lead: { vol: 0.03, wave: 'triangle', density: 0.4, min: 0.3 }, bells: { vol: 0.025 } } };
  const CLASSIC = { id: 'ms-classic', bpm: 84, root: 57, scale: 'penta', prog: [0, 4, 3, 4], seed: 11, volume: 0.85,
    layers: { pad: pad(0.035, 'sine'), bass: { vol: 0.045, pattern: 'root', wave: 'sine' }, bells: { vol: 0.025 }, arp: { vol: 0.015, wave: 'sine', rate: 2, pattern: 'up', oct: 1, min: 0.5 }, drums: { vol: 0.03, style: 'soft', min: 0.6 } } };
  const ZEN = { id: 'ms-zen', bpm: 70, root: 55, scale: 'penta', prog: [0, 3, 1, 4], seed: 7, volume: 0.8,
    layers: { pad: pad(0.04, 'sine'), bells: { vol: 0.03 }, lead: { vol: 0.025, wave: 'sine', density: 0.25 } } };
  const RUSH = { id: 'ms-rush', bpm: 144, root: 57, scale: 'minor', prog: [0, 5, 6, 4], seed: 63,
    layers: { pad: pad(0.025), bass: { vol: 0.08, pattern: 'octave', wave: 'square' }, arp: { vol: 0.025, wave: 'square', rate: 2 }, lead: { vol: 0.04, wave: 'square', density: 0.6 }, drums: { vol: 0.065, style: 'break' } } };

  function themeFor() {
    const s = G.screen, r = G.run;
    if (G.cine) return r && r.bossState ? BOSS[r.bossState.w] : r ? WORLD[r.world || 0] : MENU;
    if ((s === 'game' || s === 'paused' || s === 'results') && r) {
      if (r.mode === 'zen') return ZEN;
      if (r.mode === 'classic') return CLASSIC;
      if (r.mode === 'rush' || r.mode === 'versus') return RUSH;
      if (r.bossState) return BOSS[r.bossState.w];
      return WORLD[(r.world || 0) % WORLD.length];
    }
    if (s === 'map') return WORLD[G.ui.world];
    return MENU;
  }

  function intensity() {
    const r = G.run;
    if (G.screen !== 'game' || !r || !r.game) return 0.3;
    if (r.mode === 'zen' || r.mode === 'classic') return 0.3;
    let k = 0.45;
    if (r.bossState) k = r.bossState.fuse < 60 || r.bossState.rage ? 1 : 0.8;
    if (r.vs) k = Math.max(0.7, Math.min(1, 0.6 + r.rival.opened / Math.max(1, NS.engine.safeCount(r.rival))));
    if (r.timeLimit && r.timeLimit - r.t < 30) k = 1;
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

  Object.assign(NS.music, { WORLD, BOSS, MENU, CLASSIC, ZEN, RUSH, themeFor, intensity, update });
})();
