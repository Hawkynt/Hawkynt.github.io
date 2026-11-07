/* The soundtrack through the shared SZ.GameMusic: one theme per era that grows from a cosy
   kitchen tune into a cosmic anthem, a calm Zen Kitchen theme, a driving Bake-Off theme, a
   garden theme and a tense trial theme. The season colours every theme (bells in winter and at
   year end, a spooky scale at Halloween); Frenzies and storms raise the intensity so drums and
   lead come in. The theme follows the screen once every half second. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;

  const pad = (vol, wave) => ({ vol: vol, wave: wave || 'triangle' });
  const ERA = [
    { id: 'cc-era1', bpm: 92, root: 53, scale: 'major', prog: [0, 3, 4, 3], swing: 0.12, seed: 11,
      layers: { pad: pad(0.035), bass: { vol: 0.07, pattern: 'root' }, lead: { vol: 0.04, wave: 'triangle', density: 0.35, min: 0.2 }, bells: { vol: 0.03 }, drums: { vol: 0.05, style: 'soft', min: 0.5 } } },
    { id: 'cc-era2', bpm: 100, root: 60, scale: 'mixolydian', prog: [0, 6, 3, 4], swing: 0.15, seed: 23,
      layers: { pad: pad(0.03), bass: { vol: 0.07, pattern: 'fifths' }, arp: { vol: 0.025, wave: 'square', rate: 4, min: 0.3 }, lead: { vol: 0.04, wave: 'triangle', min: 0.2 }, drums: { vol: 0.05, style: 'shuffle', min: 0.45 } } },
    { id: 'cc-era3', bpm: 108, root: 55, scale: 'lydian', prog: [0, 1, 4, 3], swing: 0.1, seed: 37,
      layers: { pad: pad(0.03), bass: { vol: 0.07, pattern: 'pulse' }, arp: { vol: 0.025, wave: 'triangle', rate: 2, pattern: 'updown', oct: 2, min: 0.25 }, bells: { vol: 0.03 }, lead: { vol: 0.035, wave: 'square', min: 0.4 }, drums: { vol: 0.05, style: 'four', min: 0.5 } } },
    { id: 'cc-era4', bpm: 112, root: 62, scale: 'major', prog: [0, 4, 5, 3], swing: 0.08, seed: 41,
      layers: { pad: pad(0.03), bass: { vol: 0.08, pattern: 'octave' }, arp: { vol: 0.02, wave: 'square', rate: 2, min: 0.35 }, lead: { vol: 0.04, wave: 'square', density: 0.55, min: 0.2 }, drums: { vol: 0.055, style: 'back', min: 0.4 } } },
    { id: 'cc-era5', bpm: 104, root: 58, scale: 'major', prog: [0, 5, 1, 4], swing: 0.22, seed: 53,
      layers: { pad: pad(0.03, 'sine'), bass: { vol: 0.08, pattern: 'walk' }, lead: { vol: 0.04, wave: 'triangle', density: 0.6, min: 0.2 }, bells: { vol: 0.025, min: 0.3 }, drums: { vol: 0.05, style: 'shuffle', min: 0.35 } } },
    { id: 'cc-era6', bpm: 96, root: 51, scale: 'major', prog: [0, 3, 5, 4], swing: 0.05, seed: 67,
      layers: { pad: pad(0.04, 'sine'), bass: { vol: 0.07, pattern: 'root' }, arp: { vol: 0.02, wave: 'triangle', rate: 2, pattern: 'updown', oct: 2 }, lead: { vol: 0.045, wave: 'triangle', density: 0.5, min: 0.2 }, bells: { vol: 0.035 }, drums: { vol: 0.05, style: 'march', min: 0.5 } } },
    { id: 'cc-era7', bpm: 84, root: 57, scale: 'dorian', prog: [0, 3, 6, 4], swing: 0, seed: 79,
      layers: { pad: pad(0.045, 'sawtooth'), bass: { vol: 0.06, pattern: 'root', wave: 'sine' }, arp: { vol: 0.025, wave: 'sine', rate: 1, pattern: 'random', oct: 2 }, lead: { vol: 0.035, wave: 'sine', density: 0.4, min: 0.3 }, drums: { vol: 0.045, style: 'soft', min: 0.4 } } },
    { id: 'cc-era8', bpm: 120, root: 52, scale: 'lydian', prog: [0, 4, 5, 1], swing: 0.05, seed: 97,
      layers: { pad: pad(0.035, 'sawtooth'), bass: { vol: 0.08, pattern: 'octave' }, arp: { vol: 0.025, wave: 'square', rate: 2, pattern: 'updown', oct: 2 }, lead: { vol: 0.045, wave: 'square', density: 0.6, min: 0.15 }, bells: { vol: 0.03 }, drums: { vol: 0.06, style: 'four', min: 0.3 } } },
  ];
  const ZEN = { id: 'cc-zen', bpm: 66, root: 55, scale: 'penta', prog: [0, 3, 1, 4], seed: 5, volume: 0.8,
    layers: { pad: pad(0.04, 'sine'), bells: { vol: 0.035 }, lead: { vol: 0.025, wave: 'sine', density: 0.25 } } };
  const BAKE = { id: 'cc-bake', bpm: 144, root: 57, scale: 'minor', prog: [0, 5, 6, 4], seed: 131,
    layers: { pad: pad(0.025), bass: { vol: 0.08, pattern: 'octave', wave: 'square' }, arp: { vol: 0.025, wave: 'square', rate: 2 }, lead: { vol: 0.04, wave: 'square', density: 0.6 }, drums: { vol: 0.065, style: 'break' } } };
  const GARDEN = { id: 'cc-garden', bpm: 88, root: 60, scale: 'penta', prog: [0, 2, 3, 1], swing: 0.18, seed: 17,
    layers: { pad: pad(0.03, 'sine'), bass: { vol: 0.06, pattern: 'fifths' }, arp: { vol: 0.03, wave: 'triangle', rate: 4, pattern: 'up', oct: 1 }, bells: { vol: 0.03 }, lead: { vol: 0.03, wave: 'triangle', density: 0.3, min: 0.3 } } };
  const TRIAL = { id: 'cc-trial', bpm: 116, root: 50, scale: 'harmonic', prog: [0, 5, 3, 4], seed: 151,
    layers: { pad: pad(0.035, 'sawtooth'), bass: { vol: 0.08, pattern: 'pulse' }, arp: { vol: 0.02, wave: 'square', rate: 2, pattern: 'down' }, lead: { vol: 0.04, wave: 'square', min: 0.3 }, drums: { vol: 0.055, style: 'march', min: 0.3 } } };

  const cache = {};
  /* a theme coloured by the season, built once per pair */
  function flavour(song, season) {
    const key = song.id + ':' + season;
    if (cache[key]) return cache[key];
    const s = JSON.parse(JSON.stringify(song));
    s.id = key;
    if (season === 'winter' || season === 'yearend') s.layers.bells = { vol: (s.layers.bells ? s.layers.bells.vol : 0.025) * 1.3 };
    if (season === 'halloween' && s.scale !== 'penta') s.scale = s.scale === 'major' || s.scale === 'lydian' || s.scale === 'mixolydian' ? 'harmonic' : 'phrygian';
    if (season === 'summer') s.bpm = Math.round(s.bpm * 1.05);
    if (season === 'spring' && !s.layers.bells) s.layers.bells = { vol: 0.02 };
    return (cache[key] = s);
  }

  function themeFor() {
    const s = G.screen;
    if (s === 'zen') return ZEN;
    if (s === 'garden') return GARDEN;
    if (G.bake && (s === 'game' || s === 'paused')) return BAKE;
    if (G.run && G.run.trial && s !== 'title') return TRIAL;
    const run = G.run;
    const stage = s === 'title' ? Math.max(G.profile.stageMax, run ? run.stage : 0) : run ? run.stage : 0;
    return ERA[Math.max(0, Math.min(ERA.length - 1, stage))];
  }

  function intensity() {
    const s = G.screen;
    if (s === 'title' || s === 'zen') return 0.25;
    if (s !== 'game') return 0.3;
    const run = G.active();
    if (!run) return 0.4;
    let k = 0.45;
    if (run.buffs.length) k = 0.8;
    if (G.storm || run.buffs.length >= 2) k = 1;
    if (G.bake) k = Math.max(k, 0.9);
    return k;
  }

  let acc = 1;
  function update(dt) {
    const M = SZ.GameMusic;
    if (!M) return null;
    acc += dt;
    if (acc < 0.5) return null;
    acc = 0;
    const song = flavour(themeFor(), G.season);
    M.setIntensity(intensity());
    if (M.current !== song) M.play(song);
    return song;
  }

  Object.assign(NS.music, { ERA, ZEN, BAKE, GARDEN, TRIAL, flavour, themeFor, intensity, update });
})();
