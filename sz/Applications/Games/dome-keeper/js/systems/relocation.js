;(function() {
  'use strict';

  // The Relocation Core, packing up, the landing / flight cinematic state and its confirmation.
  // Owns: NS.relocation and these state fields:
  //   G.relocationCore, G.cinematic, G.landingPending, G.relocateHover
  // Reads: constants, util, dom, rules, persistence, mineGen, run, time, mining, cargo, update, biomes,
  //   tooltip, app
  // Reads state of: gameState, time, weather, waves, weapon, bombs, artifacts, drones, biomes

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, VIEW_SURFACE, STATE_PLAYING, STATE_CINEMATIC, STATE_CONFIRM, STRATUM_ROWS,
    STRATUM_COUNT, GRID_COLS, TILE_GADGET, TILE_CORE } = NS.constants;
  const { makeRng } = NS.util;
  const { particles, screenShake, floatingText } = NS.dom;
  const { DOME_X, DOME_Y } = NS.rules;
  const { saveRun } = NS.persistence;
  const { generateUnderground } = NS.mineGen;
  const { initPrimaryGadgetState } = NS.run;
  const { isNight, computeSkyLight, announce } = NS.time;

  /* ======================================================================
     RELOCATION -- the Relocation Core, packing up, flight and landing
     ====================================================================== */

  const RELOCATE_KEEP = 0.75;        // share of every resource that comes along
  const THREAT_PER_SITE = 4;
  // Steps of the shared landing sequence; a relocation flies there first
  const CINEMATIC_STEPS = {
    relocate: [['pack', 2.0], ['liftoff', 2.4], ['flight', 3.6], ['descent', 2.6], ['touchdown', 0.5], ['unpack', 2.2]],
    arrive: [['descent', 2.6], ['touchdown', 0.5], ['unpack', 2.2]]
  };
  G.relocationCore = { r: 0, c: 0, revealed: false, found: false };
  G.cinematic = null;              // { steps, i, t, oldSite }
  G.landingPending = false;        // the dome is still on its way to the current site
  G.relocateHover = null;          // 'button' | 'yes' | 'no'

  // Hide the core in the lower strata (deeper on every new site)
  function placeRelocationCore(rand) {
    const stratum = Math.min(STRATUM_COUNT - 3, 6 + G.site.index);
    for (let attempt = 0; attempt < 200; ++attempt) {
      const r = stratum * STRATUM_ROWS + 2 + Math.floor(rand() * (STRATUM_ROWS * 2 - 4));
      const c = 8 + Math.floor(rand() * (GRID_COLS - 16));
      if (G.undergroundGrid[r][c] === TILE_GADGET) continue;
      G.undergroundGrid[r][c] = TILE_CORE;
      G.relocationCore = { r, c, revealed: false, found: false };
      return;
    }
  }

  function coreDepthHint() {
    return Math.floor(G.relocationCore.r / STRATUM_ROWS) * STRATUM_ROWS;
  }

  function collectRelocationCore(tx, ty) {
    G.relocationCore.found = true;
    G.relocationCore.revealed = true;
    SZ.GameAudio.play('powerup');
    SZ.GameAudio.play('win', { pitch: 1.2, volume: 0.6 });
    particles.burst(tx, ty, 40, { color: '#7ae8ff', speed: 4, life: 0.8 });
    particles.sparkle(tx, ty, 20, { color: '#ffe080', speed: 2.5 });
    screenShake.trigger(8, 300);
    floatingText.add(tx, ty - 50, 'RELOCATION CORE!', { color: '#7ae8ff', font: 'bold 30px sans-serif' });
    announce('Relocation Core recovered!', 'Relocate from the surface whenever you are ready - or stay and keep mining', '#7ae8ff', 'core');
    saveRun();
  }

  // Why the dome cannot leave right now (null when it can)
  function relocateBlocker() {
    if (G.enemies.length > 0)
      return 'Not while monsters attack the dome';
    if (isNight() && G.world.bursts < 3)
      return 'More monsters are coming tonight - wait for dawn';
    return null;
  }

  function relocateButtonRect() {
    return { x: 16, y: 140, w: 330, h: 54 };
  }

  function hitRelocateButton(mx, my) {
    if (!G.relocationCore.found || G.currentView !== VIEW_SURFACE || G.state !== STATE_PLAYING) return false;
    const b = relocateButtonRect();
    return mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h;
  }

  function requestRelocation() {
    if (!G.relocationCore.found || G.state !== STATE_PLAYING) return;
    const why = relocateBlocker();
    if (why) {
      SZ.GameAudio.play('error');
      announce('Cannot relocate yet', why, '#ff9a6a', 'flight');
      return;
    }
    if (G.currentView !== VIEW_SURFACE) {
      SZ.GameAudio.play('error');
      announce('Cannot relocate yet', 'Return to the dome first', '#ff9a6a', 'flight');
      return;
    }
    G.state = STATE_CONFIRM;
    G.relocateHover = null;
    NS.tooltip.clearTooltip();
    SZ.GameAudio.play('select');
  }

  function confirmButtons() {
    const w = 260, h = 58, y = CANVAS_H / 2 + 70;
    return [
      { id: 'yes', label: 'Lift off', x: CANVAS_W / 2 - w - 14, y, w, h },
      { id: 'no', label: 'Stay here', x: CANVAS_W / 2 + 14, y, w, h }
    ];
  }

  function answerRelocation(yes) {
    if (G.state !== STATE_CONFIRM) return;
    if (yes)
      beginRelocation();
    else {
      G.state = STATE_PLAYING;
      SZ.GameAudio.play('click');
    }
  }

  // Pack up: the new site is generated now; the flight and landing follow
  function beginRelocation() {
    const oldSite = G.site;
    for (const k in G.resources)
      G.resources[k] = Math.floor(G.resources[k] * RELOCATE_KEEP);
    G.score += 500 * (oldSite.index + 1);
    let seed = (Math.random() * 0x7fffffff) | 0;
    for (let i = 0; i < 12 && NS.biomes.newSite(0, seed).biome === oldSite.biome; ++i)
      seed = (seed * 48271 + 11) & 0x7fffffff;
    G.site = NS.biomes.newSite(oldSite.index + 1, seed);
    generateUnderground(makeRng(G.site.seed));

    // Everything that belonged to the old site stays behind
    NS.mining.cancelMining();
    NS.update.clearMoveTarget();
    G.drillX = Math.floor(GRID_COLS / 2);
    G.drillY = 0;
    G.cameraX = G.cameraY = 0;
    G.bag = {};
    G.carried = 0;
    NS.cargo.clearPiles();
    G.enemies = [];
    G.enemyShots = [];
    G.shockwaves = [];
    G.projectiles = [];
    G.meteorOre = [];
    G.meteors = [];
    G.bolts = [];
    G.placedBombs = [];
    G.surfaceBombs = [];
    G.pendingBlasts = [];
    G.blasts = [];
    G.bombThrowMode = false;
    G.keeperStun = 0;
    G.artifactState.phoenixUsed = false;
    G.artifactState.timeSlow = 0;
    G.stormArcs = [];
    G.reflected = [];
    G.combo = 0;
    G.charge = null;
    G.snowCover = 0;
    G.weather = { kind: 'clear', intensity: 1, timeLeft: 50 };
    G.waveActive = false;
    G.domeHP = G.maxDomeHP;
    G.siteNights = 0;
    G.world.day += 1;
    G.world.t = 0.03;
    G.world.bursts = 0;
    G.world.warned = false;
    computeSkyLight();
    for (const d of G.drones) {
      d.state = 'dock';
      d.job = null;
      d.path = null;
      d.cargo = 0;
      d.bag = {};
      d.timer = 1;
    }
    initPrimaryGadgetState();
    G.currentView = VIEW_SURFACE;
    G.landingPending = true;
    startCinematic('relocate', oldSite);
    saveRun();
    NS.app.updateWindowTitle();
  }

  function startCinematic(kind, oldSite) {
    G.cinematic = { kind, steps: CINEMATIC_STEPS[kind], i: 0, t: 0, oldSite: oldSite || null, sounds: {} };
    G.state = STATE_CINEMATIC;
    NS.tooltip.clearTooltip();
    G.banners = [];
  }

  function cinematicStep() {
    return G.cinematic ? G.cinematic.steps[G.cinematic.i][0] : null;
  }

  function finishCinematic() {
    if (!G.cinematic) return;
    const relocated = G.cinematic.kind === 'relocate';
    G.cinematic = null;
    G.landingPending = false;
    G.state = STATE_PLAYING;
    const B = NS.biomes.currentBiome();
    if (relocated)
      announce(`Site ${G.site.index + 1}: ${B.name}`, `Threat +${THREAT_PER_SITE} - the monsters here are tougher. Find this site's Relocation Core.`, '#ffe080', 'flight');
    else
      announce('Landing site: ' + B.name, 'Mine by day, defend the dome at night', '#ffe080', 'dome');
    SZ.GameAudio.play('select', { pitch: 1.2 });
    saveRun();
  }

  function skipCinematic() {
    if (G.state !== STATE_CINEMATIC) return;
    SZ.GameAudio.play('click');
    finishCinematic();
  }

  function updateCinematic(dt) {
    if (!G.cinematic) return;
    const c = G.cinematic;
    c.t += dt;
    const [name, dur] = c.steps[c.i];
    const k = Math.min(1, c.t / dur);
    const once = (id, fn) => {
      if (!c.sounds[id]) {
        c.sounds[id] = true;
        fn();
      }
    };
    const base = DOME_Y + 14;
    if (name === 'pack') {
      once('pack', () => SZ.GameAudio.sweep(500, 180, 1.2, 'square', 0.05));
      if (k > 0.55) once('legs', () => SZ.GameAudio.play('thud', { pitch: 1.4 }));
    } else if (name === 'liftoff') {
      once('lift', () => {
        SZ.GameAudio.noise(2.2, 0.18, 'lowpass', 300, 1800);
        SZ.GameAudio.sweep(60, 220, 2, 'sawtooth', 0.06);
      });
      screenShake.trigger(3 * (1 - k), 60);
      if (Math.random() < 0.8)
        particles.trail(DOME_X + (Math.random() - 0.5) * 260, base + 6, { vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 1.5, color: Math.random() < 0.5 ? '#9a8a7a' : '#6a5a4a', life: 0.9, size: 3 + Math.random() * 4, gravity: -0.01 });
    } else if (name === 'flight') {
      once('flight', () => SZ.GameAudio.play('whoosh', { pitch: 0.6 }));
    } else if (name === 'descent') {
      once('descent', () => {
        SZ.GameAudio.noise(2.4, 0.14, 'lowpass', 1600, 300);
        SZ.GameAudio.sweep(220, 70, 2.4, 'sawtooth', 0.05);
      });
      if (k > 0.6 && Math.random() < 0.9)
        particles.trail(DOME_X + (Math.random() - 0.5) * 300, base + 6, { vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 1.2, color: '#8a7a6a', life: 0.8, size: 3 + Math.random() * 4, gravity: -0.01 });
    } else if (name === 'touchdown') {
      once('touch', () => {
        SZ.GameAudio.play('thud', { pitch: 0.6 });
        SZ.GameAudio.play('explode', { pitch: 0.4, volume: 0.5 });
        screenShake.trigger(10, 320);
        for (const side of [-1, 1])
          for (let i = 0; i < 26; ++i)
            particles.trail(DOME_X + side * (60 + Math.random() * 90), base + 4, { vx: side * (2 + Math.random() * 6), vy: -Math.random() * 2.5, color: Math.random() < 0.5 ? '#a8987e' : '#7a6a58', life: 1 + Math.random() * 0.5, size: 3 + Math.random() * 5, gravity: 0.02 });
      });
    } else if (name === 'unpack') {
      if (k > 0.05) once('legs2', () => SZ.GameAudio.play('thud', { pitch: 1.5 }));
      if (k > 0.3) once('glass', () => SZ.GameAudio.sweep(200, 700, 0.8, 'triangle', 0.06));
      if (k > 0.62) once('turret', () => SZ.GameAudio.play('click', { pitch: 0.6 }));
      if (k > 0.8) once('lights', () => SZ.GameAudio.play('powerup', { pitch: 1.3, volume: 0.6 }));
    }
    if (c.t >= dur) {
      c.t = 0;
      ++c.i;
      if (c.i >= c.steps.length)
        finishCinematic();
    }
  }

  NS.relocation = { RELOCATE_KEEP, THREAT_PER_SITE, placeRelocationCore, coreDepthHint,
    collectRelocationCore, relocateBlocker, relocateButtonRect, hitRelocateButton, requestRelocation,
    confirmButtons, answerRelocation, startCinematic, cinematicStep, skipCinematic, updateCinematic };
})();
