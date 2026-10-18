/*
 * Race setup: builds the current track (geometry, art, features), puts the player
 * and the AI field on the start grid and resets every per-race value in G.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { STATE_PLAYING, COUNTDOWN_TIME, NUM_OPPONENTS, AI_SPEED_VARIANCE, AI_REACTION_DELAY,
    ITEM_LATERAL } = NS.constants;
  const { AI_PERSONALITIES, CUPS } = NS.defs;
  const { getEffectiveStats, getPlayerShipDef } = NS.progress;
  const { trackStateAt } = NS.track;
  const Effects = NS.module('effects');
  const Flow = NS.module('flow');

  /* Place all race features along the built track geometry */
  function buildRaceFeatures() {
    const L = G.geo.length;
    const at = (t, lateral) => {
      const p = G.geo.sampleAt(t * L);
      return { x: p.x + p.nx * lateral, y: p.y + p.ny * lateral, angle: p.angle };
    };

    G.raceBoostPads = G.track.boost.map(([t, lat]) => at(t, lat));

    G.raceHazards = G.track.hazards.map(([t, lat, type]) => ({
      ...at(t, lat),
      radius: { asteroid: 26, barrier: 30, flare: 34 }[type] || 26,
      type
    }));

    G.raceGravity = G.track.gravity.map(([t, side, mass, type]) => ({
      ...at(t, side * G.track.width),
      mass,
      radius: 22 + mass * 14,
      type,
      color: { planet: '#4a8', star: '#ff8', pulsar: '#8cf', quasar: '#f8f', blackhole: '#a6f' }[type] || '#4a8'
    }));

    G.raceWormholes = [];
    for (let k = 0; k < G.track.wormholes.length; ++k) {
      const [tFrom, tTo] = G.track.wormholes[k];
      const entryIndex = G.raceWormholes.length;
      G.raceWormholes.push({ ...at(tFrom, 0), color: '#f80', pairIndex: entryIndex + 1 });
      G.raceWormholes.push({ ...at(tTo, 0), color: '#08f', pairIndex: -1 });
    }

    G.raceItemBoxes = [];
    for (let k = 0; k < G.track.items.length; ++k) {
      for (let col = -1; col <= 1; ++col)
        G.raceItemBoxes.push({ ...at(G.track.items[k], col * ITEM_LATERAL * G.track.width), respawn: 0 });
    }
  }

  /* Build the current track geometry and place every racer on the start grid */
  function prepareTrack() {
    G.track = G.currentVariant;
    G.geo = SZ.RacingTrack.build(G.track);
    G.trackArt = SZ.RacingTrackArt.create(G.geo, G.track.theme);
    Effects.resetAmbience();
    G.skids = [];
    G.skidPrev = null;
    buildRaceFeatures();
    const shipDef = getPlayerShipDef();
    const stats = getEffectiveStats(shipDef);

    // Start grid: two columns of slots just behind the start line at s = 0
    const gridPos = (slot) => {
      const s = -90 - Math.floor(slot / 2) * 110;
      const lat = (slot % 2 ? -1 : 1) * G.track.width * 0.22;
      const p = G.geo.sampleAt(s);
      return { x: p.x + p.nx * lat, y: p.y + p.ny * lat, angle: p.angle };
    };

    const playerSlot = gridPos(2);
    G.ship.x = playerSlot.x;
    G.ship.y = playerSlot.y;
    G.ship.angle = playerSlot.angle;
    G.ship.speed = 0;
    G.ship.vx = 0;
    G.ship.vy = 0;
    G.ship.bank = 0;
    G.ship.spin = 0;
    G.ship.shieldTime = 0;
    G.ship.stats = stats;
    G.ship.def = shipDef;
    G.ship.ts = trackStateAt(G.ship.x, G.ship.y);
    G.boostTimer = 0;
    G.boostActive = false;
    G.prevBoostActive = false;
    G.ship.trail = [];
    G.playerItem = null;
    G.playerItem2 = null;
    G.projectiles = [];
    G.mines = [];
    G.shockwaves = [];

    G.camX = G.ship.x;
    G.camY = G.ship.y;
    G.camZoom = 1;

    // Pick NUM_OPPONENTS unique AI personalities -- a cup keeps its field for all four races
    let roster = null;
    const progress = G.raceCup !== null ? G.save.cupProgress : null;
    if (progress && progress.cup === G.raceCup && Array.isArray(progress.aiNames) && progress.aiNames.length) {
      roster = [];
      for (let i = 0; i < NUM_OPPONENTS; ++i) {
        const name = progress.aiNames[i % progress.aiNames.length];
        roster.push(AI_PERSONALITIES.find(p => p.name === name) || AI_PERSONALITIES[i % AI_PERSONALITIES.length]);
      }
    }
    if (!roster) {
      roster = AI_PERSONALITIES.slice();
      for (let i = roster.length - 1; i > 0; --i) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = roster[i];
        roster[i] = roster[j];
        roster[j] = tmp;
      }
    }
    const cupStrength = G.raceCup !== null ? CUPS[G.raceCup].ai : 1;

    G.opponents = [];
    const gridSlots = [0, 1, 3];
    for (let i = 0; i < NUM_OPPONENTS; ++i) {
      const personality = roster[i % roster.length];
      const speedFactor = (1 - AI_SPEED_VARIANCE + Math.random() * AI_SPEED_VARIANCE * 2) * personality.speedBias * cupStrength;
      const slot = gridPos(gridSlots[i]);
      const ai = {
        x: slot.x,
        y: slot.y,
        angle: slot.angle,
        speed: 0,
        vx: 0,
        vy: 0,
        lap: 0,
        speedFactor,
        personality,
        color: personality.color,
        accentColor: personality.accentColor,
        exhaustColor: personality.exhaustColor,
        shape: personality.shape,
        name: personality.name,
        finished: false,
        finishTime: 0,
        reactionTimer: AI_REACTION_DELAY * (0.8 + Math.random() * 0.4),
        mistakeTimer: 0,
        mistakeAngle: 0,
        throttle: 0,
        bank: 0,
        spin: 0,
        shieldTime: 0,
        item: null,
        itemCooldown: 2 + Math.random() * 2,
        turbo: 0,
        trail: []
      };
      ai.ts = trackStateAt(ai.x, ai.y);
      G.opponents.push(ai);
    }

    G.aiWormholeCooldowns = G.opponents.map(() => 0);
  }

  function resetGame() {
    prepareTrack();

    G.raceLaps = G.track.laps;
    G.playerLap = 0;
    G.wrongWay = false;
    G.raceTime = 0;
    G.playerPlace = 1;
    G.raceFinished = false;

    G.countdown = COUNTDOWN_TIME;
    G.raceStarted = false;
    G.launchWindow = 0;
    G.earlyThrottle = false;
    G.stallTimer = 0;
    G.boostMeter = 30;
    G.driftTime = 0;
    G.drifting = false;
    G.driftDir = 0;
    G.slipstream = 0;
    G.engineTick = 0;
    G.engineBeat = 0;
    G.driftTick = 0;
    G.scrapeTick = 0;
    G.slipstreamSounded = false;

    G.speedLines = [];
    G.skids = [];
    G.skidPrev = null;
    G.lapFlash = null;
    G.finalFlash = null;
    G.wormholeCooldown = 0;
    G.globalTime = 0;

    G.bonusPerfectStart = false;
    G.bonusMegaTurbos = 0;
    G.bonusHitsLanded = 0;
    G.bonusCleanRace = true;
    G.lastLapStamp = 0;
    G.placeDelta = 0;
    G.placeDeltaAt = -99;
    G.lapSplitAt = -99;
    G.lapSplitBest = false;
    G.raceBestLap = 0;

    G.state = STATE_PLAYING;
    G.hitAreas.length = 0;
    SZ.GameAudio.play('powerup', { pitch: 0.7 });
    Flow.updateWindowTitle();
  }

  Object.assign(NS.module('raceSetup'), {
    prepareTrack, resetGame
  });
})();
