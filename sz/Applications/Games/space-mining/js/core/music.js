/* The soundtrack through the shared SZ.GameMusic: a theme per belt (a steady prospecting groove in
   the Kessler Drift, cold bells in the outer ice belts, a dusty pulse in the amber fields, a tense
   minor drive near the Lattice and a grand, slow theme at the Crown), a station theme for the hub,
   a menu theme, a driving theme for Gold Rush and the Daily Belt and a battle theme for Siege.
   Pirates and invaders on screen raise the intensity so drums and lead come in. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;

  const pad = (vol, wave) => ({ vol: vol, wave: wave || 'triangle' });
  const BELT = [
    { id: 'sm-kessler', bpm: 96, root: 57, scale: 'dorian', prog: [0, 3, 4, 3], swing: 0.1, seed: 19,
      layers: { pad: pad(0.04, 'sawtooth'), bass: { vol: 0.06, pattern: 'pulse', wave: 'sine' }, arp: { vol: 0.02, wave: 'triangle', rate: 2, pattern: 'up', oct: 2 }, lead: { vol: 0.03, wave: 'sine', density: 0.35, min: 0.4 }, drums: { vol: 0.04, style: 'soft', min: 0.35 } } },
    { id: 'sm-ice', bpm: 88, root: 62, scale: 'lydian', prog: [0, 1, 4, 3], seed: 37,
      layers: { pad: pad(0.045, 'sine'), bass: { vol: 0.05, pattern: 'root', wave: 'sine' }, bells: { vol: 0.035 }, arp: { vol: 0.022, wave: 'sine', rate: 4, pattern: 'random', oct: 2 }, drums: { vol: 0.035, style: 'soft', min: 0.45 } } },
    { id: 'sm-amber', bpm: 104, root: 52, scale: 'harmonic', prog: [0, 5, 3, 4], seed: 53,
      layers: { pad: pad(0.035, 'sawtooth'), bass: { vol: 0.075, pattern: 'octave' }, arp: { vol: 0.022, wave: 'square', rate: 2, pattern: 'down', oct: 1, min: 0.3 }, lead: { vol: 0.035, wave: 'square', density: 0.45, min: 0.3 }, drums: { vol: 0.05, style: 'back', min: 0.25 } } },
    { id: 'sm-lattice', bpm: 112, root: 50, scale: 'minor', prog: [0, 6, 5, 4], seed: 67,
      layers: { pad: pad(0.04, 'sawtooth'), bass: { vol: 0.08, pattern: 'pulse', wave: 'square' }, arp: { vol: 0.025, wave: 'square', rate: 4, pattern: 'updown', oct: 2 }, lead: { vol: 0.04, wave: 'square', density: 0.5, min: 0.25 }, drums: { vol: 0.06, style: 'four', min: 0.2 } } },
    { id: 'sm-crown', bpm: 80, root: 55, scale: 'major', prog: [0, 5, 3, 4], seed: 83,
      layers: { pad: pad(0.05, 'sawtooth'), bass: { vol: 0.065, pattern: 'fifths', wave: 'sine' }, bells: { vol: 0.03 }, lead: { vol: 0.04, wave: 'triangle', density: 0.4, min: 0.3 }, drums: { vol: 0.05, style: 'back', min: 0.3 } } },
  ];
  const STATION = { id: 'sm-station', bpm: 84, root: 57, scale: 'major', prog: [0, 4, 5, 3], swing: 0.12, seed: 7,
    layers: { pad: pad(0.04), bass: { vol: 0.05, pattern: 'walk', wave: 'sine' }, bells: { vol: 0.025 }, arp: { vol: 0.018, wave: 'triangle', rate: 2, pattern: 'updown' } } };
  const MENU = { id: 'sm-menu', bpm: 76, root: 53, scale: 'lydian', prog: [0, 4, 1, 4], seed: 3,
    layers: { pad: pad(0.05, 'sine'), bass: { vol: 0.045, pattern: 'root', wave: 'sine' }, arp: { vol: 0.02, wave: 'sine', rate: 4, pattern: 'up', oct: 2 }, bells: { vol: 0.02 } } };
  const RUSH = { id: 'sm-rush', bpm: 138, root: 57, scale: 'minor', prog: [0, 5, 6, 4], seed: 61,
    layers: { pad: pad(0.025), bass: { vol: 0.08, pattern: 'octave', wave: 'square' }, arp: { vol: 0.025, wave: 'square', rate: 2 }, lead: { vol: 0.04, wave: 'square', density: 0.6 }, drums: { vol: 0.065, style: 'break' } } };
  const SIEGE = { id: 'sm-siege', bpm: 126, root: 50, scale: 'harmonic', prog: [0, 5, 3, 4], seed: 71,
    layers: { pad: pad(0.04, 'sawtooth'), bass: { vol: 0.085, pattern: 'pulse', wave: 'square' }, arp: { vol: 0.025, wave: 'square', rate: 2, pattern: 'down', oct: 2 }, lead: { vol: 0.045, wave: 'square', density: 0.6, min: 0.2 }, drums: { vol: 0.07, style: 'break', min: 0.1 } } };

  function themeFor() {
    const run = G.run;
    if (run && (G.screen === 'playing' || G.screen === 'paused' || G.screen === 'cine')) {
      if (run.mode === 'siege') return SIEGE;
      if (run.mode === 'rush' || run.mode === 'daily') return RUSH;
      return BELT[Math.max(0, Math.min(BELT.length - 1, run.zoneIndex || 0))];
    }
    if (G.screen === 'station' || G.screen === 'results' || G.screen === 'tree' || G.screen === 'colonies') return STATION;
    return MENU;
  }

  function threats() {
    let n = G.pirates ? G.pirates.length : 0;
    if (G.enemies) n += G.enemies.length;
    return n;
  }

  function intensity() {
    if (!G.run || G.screen !== 'playing') return 0.3;
    const n = threats();
    if (G.run.mode === 'siege') return Math.min(1, 0.6 + n * 0.04);
    return Math.min(1, 0.4 + n * 0.12);
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

  Object.assign(NS.music, { BELT, STATION, MENU, RUSH, SIEGE, themeFor, intensity, update });
})();
