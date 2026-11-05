;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The per-frame simulation: dispatches by state, runs the bird physics, timers, ground
     and biome changes, power-ups, the boss arena, then the gate, pickup and hazard
     systems, the trail and the autosave. Reads and writes G. */

  const {
    CANVAS_W, GRAVITY, FLAP_IMPULSE, TERMINAL_VELOCITY, BIRD_X, BIRD_H, GROUND_Y, MENU_STATES, STATE_CINE,
    STATE_READY, STATE_PLAYING, STATE_DYING, STATE_DEAD, STATE_CLEAR
  } = NS.C;
  const { particles, screenShake, floatingText, sfx } = NS.services;
  const G = NS.state;
  const Rules = NS.rules;
  const View = NS.view;
  const Run = NS.run;
  const Fx = NS.fx;
  const Contact = NS.contact;
  const Powers = NS.powers;
  const Boss = NS.bossfight;
  const Goals = NS.goals;
  const Autosave = NS.autosave;

  let goalsT = 2;
  let zenAcc = 0;
  let zenChord = 2;

  function update(dt) {
    G.globalTime += dt;
    Goals.updateToasts(dt);

    // Hit-stop — one frozen beat right after damage lands, drawing continues
    if (G.hitStop > 0) {
      G.hitStop -= dt;
      return;
    }

    G.fade = Math.max(0, G.fade - dt * 3.5);
    G.flash = Math.max(0, G.flash - dt * 2.5);

    if (G.state === STATE_CINE) {
      NS.cine.update(dt);
      return;
    }

    if (MENU_STATES.indexOf(G.state) >= 0) {
      Fx.updateWeather(dt, View.sceneFor(SZ.FlappyCourse.BIOME_ORDER[G.menuBiomeIndex]), true, 0.5);
      particles.update(dt);
      floatingText.update();
      return;
    }

    if (G.state === STATE_READY) {
      G.readyBobT += dt * 3;
      G.bird.y = 300 + Math.sin(G.readyBobT) * 8;
      G.bird.angle = 0;
      G.wingFrame += dt * 9;
      Fx.updateWeather(dt, G.scene, true);
      particles.update(dt);
      return;
    }

    if (G.state === STATE_DYING) {
      G.dyingTimer += dt;
      screenShake.update(dt * 1000);
      // The first half second of the tumble plays in slow motion
      const slow = G.dyingTimer < 0.45 ? 0.35 : 1;
      const step = dt * slow * 60;
      G.bird.vy += GRAVITY * step;
      G.bird.vy = Math.min(G.bird.vy, TERMINAL_VELOCITY);
      G.bird.y += G.bird.vy * step;
      G.bird.angle = Math.min(Math.PI / 2, G.bird.angle + 0.1 * step);
      particles.update(dt * slow);
      floatingText.update();
      Fx.updateFeathers(dt * slow);
      Fx.updateDebris(dt * slow);
      Fx.updateWeather(dt, G.scene, false);
      Fx.updateRings(dt);
      if (G.dyingTimer > 0.6)
        Run.finishRun('dead');
      return;
    }

    if (G.state === STATE_DEAD || G.state === STATE_CLEAR) {
      particles.update(dt);
      floatingText.update();
      Fx.updateFeathers(dt);
      Fx.updateDebris(dt);
      Fx.updateRings(dt);
      if (G.state === STATE_CLEAR)
        Fx.updateClearStars();
      return;
    }

    if (G.state !== STATE_PLAYING)
      return;

    updatePlaying(dt);
  }

  /* One frame of a running flight */
  function updatePlaying(dt) {
    // dt * 60 normalizes all per-frame values to 60 fps behaviour
    const step = dt * 60;
    const speed = Rules.runSpeed();
    const frozen = G.power.freeze > 0;

    G.runTime += dt;
    if (!frozen)
      G.worldT += dt * (G.power.slow > 0 ? 0.6 : 1);
    G.dist += speed * (G.power.slow > 0 ? 0.6 : 1) * step;
    G.course.ensure(G.dist + CANVAS_W);
    G.course.prune(G.dist);
    if (G.mode === 'zen') {
      if (Math.random() < dt * 6)
        particles.trail(BIRD_X + 200 + Math.random() * 800, 80 + Math.random() * 480,
          { color: Math.random() < 0.5 ? '#bff4ff' : '#fff3c0', size: 3 + Math.random() * 3, life: 1, decay: 0.006, vx: -0.6, vy: -0.2, shape: 'glow', shrink: 1 });
      zenChord -= dt;
      if (zenChord <= 0) {
        zenChord = 4 + Math.random() * 3;
        const root = NS.contact.ZEN_SCALE[Math.floor(Math.random() * 4)];
        sfx('blip', { pitch: root * 0.25, volume: 0.08 });
        sfx('select', { pitch: root * 0.5, volume: 0.05 });
      }
      zenAcc += dt;
      if (zenAcc >= 6) {
        Goals.bump('zenMin', zenAcc / 60);
        zenAcc = 0;
      }
    }

    Powers.update(dt, step);

    // Bird physics
    G.bird.vy += Rules.gravityNow() * step;
    G.bird.vy = Math.min(G.bird.vy, TERMINAL_VELOCITY);
    G.bird.y += G.bird.vy * step;

    // Gliding leaves a faint white trail under the wings
    if (Rules.glideActive()) {
      ++G.glideTick;
      if (G.glideTick % 4 === 0)
        particles.trail(BIRD_X - 6, G.bird.y + 9, { color: 'rgba(255,255,255,0.6)', size: 2, life: 0.4 });
    }

    // Ceiling clamp — bird does not die from ceiling
    G.bird.y = Math.max(BIRD_H / 2, G.bird.y);
    if (G.bird.y <= BIRD_H / 2)
      G.bird.vy = Math.max(0, G.bird.vy);

    // Bird rotation based on velocity
    const rotTarget = (G.bird.vy / TERMINAL_VELOCITY) * (Math.PI / 2);
    G.bird.angle += (rotTarget - G.bird.angle) * (1 - Math.pow(0.85, step));
    G.bird.angle = Math.max(-Math.PI / 6, Math.min(Math.PI / 2, G.bird.angle));

    G.invuln = Math.max(0, G.invuln - dt);
    G.squash = Math.max(0, G.squash - dt);

    // Wing animation — fast right after a flap, lazy cruise otherwise
    G.flapAnim = Math.max(0, G.flapAnim - dt);
    G.wingFrame += dt * (G.flapAnim > 0 || G.power.rush > 0 ? 26 : 9);

    // Time attack countdown
    if (G.mode === 'time') {
      G.timeLeft -= dt;
      if (G.timeLeft <= 0) {
        G.timeLeft = 0;
        Run.finishRun('time');
        return;
      }
    }

    Contact.updateGates();

    if (G.state === STATE_PLAYING) {
      Contact.updateCoins(step);
      Contact.updateBubbles();
      Contact.updateTokens();
      updateGround();
      updateBiomeChange();

      // the end of the course: a boss arena or the finish line
      if (G.course.finishX !== Infinity && G.dist + BIRD_X >= G.course.finishX && !G.boss && !G.bossBeaten) {
        const kind = Boss.arenaKind();
        if (kind)
          Boss.begin(kind);
        else {
          Run.finishRun('clear');
          return;
        }
      }
      if (G.boss)
        Boss.update(dt);
      if (G.state !== STATE_PLAYING)
        return;

      Contact.updateHazards(frozen ? 0 : dt, frozen ? 0 : step);
    }
    if (G.state !== STATE_PLAYING)
      return;

    if (G.scorePopTimer > 0)
      G.scorePopTimer -= dt;
    if (G.coinBump > 0)
      G.coinBump -= dt;
    if (G.coinsRun !== G.lastCoinsShown) {
      G.lastCoinsShown = G.coinsRun;
      G.coinBump = 0.2;
    }
    G.biomeBanner = Math.max(0, G.biomeBanner - dt);

    // Afterimage trail while the combo is hot, the world runs in slow-mo or the bird rushes
    if (G.combo >= 10 || G.power.slow > 0 || G.power.rush > 0 || G.feverT > 0) {
      ++G.afterimageTick;
      if (G.afterimageTick % 2 === 0) {
        if (G.afterimages.length >= 6)
          G.afterimages.shift();
        G.afterimages.push({ x: BIRD_X, y: G.bird.y, angle: G.bird.angle, frame: G.wingFrame });
      }
    } else {
      G.afterimages.length = 0;
    }

    Fx.emitTrail(dt, BIRD_X, G.bird.y, speed);
    Fx.updateFeathers(dt);
    Fx.updateDebris(dt);
    Fx.updateWeather(dt, G.scene, true);
    Fx.updateRings(dt);

    particles.update(dt);
    floatingText.update();
    screenShake.update(dt * 1000);

    Autosave.tick(dt);
    goalsT -= dt;
    if (goalsT <= 0) {
      goalsT = 2;
      Goals.check();
    }
  }

  function updateGround() {
    const birdR = Rules.birdRadius();
    if (G.bird.y + birdR < GROUND_Y)
      return;
    if (G.mode === 'zen' || G.power.rush > 0) {
      G.bird.y = GROUND_Y - birdR;
      G.bird.vy = FLAP_IMPULSE * 0.8;
      if (G.mode === 'zen')
        Run.takeHit('ground');
      return;
    }
    if (G.mode === 'classic' || G.mode === 'daily' || (G.hearts <= 1 && G.mode !== 'time')) {
      Run.takeHit('ground');
    } else {
      // A spare heart (or time attack) lets the bird bounce off the ground
      G.bird.y = GROUND_Y - birdR;
      G.bird.vy = FLAP_IMPULSE * 0.9;
      particles.burst(BIRD_X, GROUND_Y - 4, 14, { color: G.scene.theme.groundTop, speed: 3, gravity: 0.15, life: 0.5 });
      Run.takeHit('ground');
    }
  }

  function updateBiomeChange() {
    // Biome change in the endless modes — the next gate ahead decides the scenery
    if (G.mode === 'adventure' || G.mode === 'bossrush')
      return;
    for (const gate of G.course.gates) {
      if (gate.x - G.dist > BIRD_X - 40) {
        if (gate.biome !== G.sceneBiome) {
          G.sceneBiome = gate.biome;
          G.scene = View.sceneFor(G.sceneBiome);
          G.biomeBanner = 2.5;
          G.biomeBannerText = SZ.FlappyCourse.BIOMES[G.sceneBiome].name;
          G.fade = 0.5;
          sfx('whoosh', { pitch: 0.8 });
        }
        break;
      }
    }
  }

  Object.assign(NS.flight, { update, updatePlaying, updateGround, updateBiomeChange });
})();
