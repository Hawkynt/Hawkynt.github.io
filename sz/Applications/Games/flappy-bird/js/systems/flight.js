;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The per-frame simulation: dispatches by state, runs the bird physics, timers, ground
     and biome changes, then the gate, pickup and hazard systems. Reads and writes G. */

  const {
    CANVAS_W, GRAVITY, FLAP_IMPULSE, TERMINAL_VELOCITY, BIRD_X, BIRD_H, GROUND_Y, POWER_TIMED, STATE_TITLE,
    STATE_WORLDS, STATE_NEST, STATE_AVIARY, STATE_HELP, STATE_READY, STATE_PLAYING, STATE_DYING, STATE_DEAD,
    STATE_CLEAR
  } = NS.C;
  const { particles, screenShake, floatingText, sfx } = NS.services;
  const G = NS.state;
  const Rules = NS.rules;
  const View = NS.view;
  const Run = NS.run;
  const Fx = NS.fx;
  const Contact = NS.contact;

  function update(dt) {
    G.globalTime += dt;

    // Hit-stop — one frozen beat right after damage lands, drawing continues
    if (G.hitStop > 0) {
      G.hitStop -= dt;
      return;
    }

    G.fade = Math.max(0, G.fade - dt * 3.5);
    G.flash = Math.max(0, G.flash - dt * 2.5);

    if (G.state === STATE_TITLE || G.state === STATE_WORLDS || G.state === STATE_NEST ||
      G.state === STATE_AVIARY || G.state === STATE_HELP) {
      Fx.updateWeather(dt, View.sceneFor(SZ.FlappyCourse.BIOME_ORDER[G.menuBiomeIndex]), true, 0.5);
      particles.update();
      floatingText.update();
      return;
    }

    if (G.state === STATE_READY) {
      G.readyBobT += dt * 3;
      G.bird.y = 300 + Math.sin(G.readyBobT) * 8;
      G.bird.angle = 0;
      Fx.updateWeather(dt, G.scene, true);
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
      if (slow === 1) {
        particles.update();
        floatingText.update();
      }
      Fx.updateFeathers(dt * slow);
      Fx.updateWeather(dt, G.scene, false);
      Fx.updateRings(dt);
      if (G.dyingTimer > 0.5)
        Run.finishRun('dead');
      return;
    }

    if (G.state === STATE_DEAD || G.state === STATE_CLEAR) {
      particles.update();
      floatingText.update();
      Fx.updateFeathers(dt);
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

    G.runTime += dt;
    G.dist += speed * (G.power.slow > 0 ? 0.6 : 1) * step;
    G.course.ensure(G.dist + CANVAS_W);
    G.course.prune(G.dist);

    // Power-up timers
    for (const kind of POWER_TIMED) {
      if (G.power[kind] <= 0)
        continue;
      G.power[kind] = Math.max(0, G.power[kind] - dt);
      if (G.power[kind] === 0)
        sfx('drop', { volume: 0.35 });
    }

    // Bird physics
    G.bird.vy += Rules.gravityNow() * step;
    G.bird.vy = Math.min(G.bird.vy, TERMINAL_VELOCITY);
    G.bird.y += G.bird.vy * step;

    // Gliding leaves a faint white trail under the wings
    if (Rules.glideActive()) {
      ++G.glideTick;
      if (G.glideTick % 4 === 0)
        particles.trail(BIRD_X - 6, G.bird.y + 9, { color: 'rgba(255,255,255,0.45)', size: 2, life: 0.4 });
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

    // Wing animation — fast right after a flap, lazy cruise otherwise
    G.flapAnim = Math.max(0, G.flapAnim - dt);
    G.wingFrame += dt * (G.flapAnim > 0 ? 26 : 9);

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
      updateGround();
      updateBiomeChange();

      // Adventure stage finish
      if (G.mode === 'adventure' && G.dist + BIRD_X >= G.course.finishX) {
        Run.finishRun('clear');
        return;
      }

      Contact.updateHazards(dt, step);
    }

    if (G.scorePopTimer > 0)
      G.scorePopTimer -= dt;
    if (G.coinBump > 0)
      G.coinBump -= dt;
    if (G.coinsRun !== G.lastCoinsShown) {
      G.lastCoinsShown = G.coinsRun;
      G.coinBump = 0.2;
    }
    G.biomeBanner = Math.max(0, G.biomeBanner - dt);

    // Afterimage trail while the combo is hot or the world runs in slow-mo
    if (G.combo >= 10 || G.power.slow > 0) {
      ++G.afterimageTick;
      if (G.afterimageTick % 2 === 0) {
        G.afterimages.push({ x: BIRD_X, y: G.bird.y, angle: G.bird.angle, frame: G.wingFrame });
        if (G.afterimages.length > 6)
          G.afterimages.shift();
      }
    } else {
      G.afterimages.length = 0;
    }

    Fx.updateFeathers(dt);
    Fx.updateWeather(dt, G.scene, true);
    Fx.updateRings(dt);

    // Effects
    particles.update();
    floatingText.update();
    screenShake.update(dt * 1000);
  }

  function updateGround() {
    // Ground
    const birdR = Rules.birdRadius();
    if (G.bird.y + birdR >= GROUND_Y) {
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
  }

  function updateBiomeChange() {
    // Biome change in the endless modes — the next gate ahead decides the scenery
    if (G.mode !== 'adventure') {
      for (const gate of G.course.gates) {
        if (gate.x - G.dist > BIRD_X - 40) {
          if (gate.biome !== G.sceneBiome) {
            G.sceneBiome = gate.biome;
            G.scene = View.sceneFor(G.sceneBiome);
            G.biomeBanner = 2.5;
            G.biomeBannerText = SZ.FlappyCourse.BIOMES[G.sceneBiome].name;
            sfx('whoosh', { pitch: 0.8 });
          }
          break;
        }
      }
    }
  }

  Object.assign(NS.flight, { update, updatePlaying, updateGround, updateBiomeChange });
})();
