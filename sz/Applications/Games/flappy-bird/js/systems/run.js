;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Run lifecycle: start a run, flap, take damage, die and settle the result into the save.
     Writes the run fields of G (course, bird, hearts, power, combo, effects timers, state). */

  const {
    CANVAS_W, FLAP_IMPULSE, BIRD_X, INVULN_TIME, TIME_ATTACK_SECONDS, BUBBLE_COLORS, POWER_NAMES, POWER_TIMED,
    STATE_READY, STATE_DYING, STATE_DEAD, STATE_CLEAR
  } = NS.C;
  const { particles, screenShake, floatingText, sfx } = NS.services;
  const G = NS.state;
  const Save = NS.save;
  const Prog = NS.progress;
  const Rules = NS.rules;
  const View = NS.view;
  const Fx = NS.fx;
  const Nav = NS.nav;

  function startRun() {
    const stage = G.mode === 'adventure' ? SZ.FlappyCourse.STAGES[G.stageIndex] : null;
    let seed;
    if (G.mode === 'daily')
      seed = SZ.FlappyCourse.dailySeed(new Date());
    else if (G.mode === 'adventure')
      seed = SZ.FlappyCourse.hashSeed(stage.id);
    else
      seed = (Math.random() * 4294967296) >>> 0;

    const bubbleBase = G.mode === 'adventure' ? 6 : 7;
    G.course = SZ.FlappyCourse.createCourse({
      seed: seed,
      stage: stage,
      bubbleEvery: Math.max(3, Math.round(bubbleBase / (1 + 0.25 * Prog.treeLevel('p_more'))))
    });
    G.dist = 0;
    G.runTime = 0;
    G.score = 0;
    G.coinsRun = 0;
    G.coinsPicked = 0;
    G.hitsTaken = 0;
    G.invuln = 0;
    G.hearts = Rules.maxHearts();
    G.timeLeft = TIME_ATTACK_SECONDS;
    G.power = { shield: false, magnet: 0, slow: 0, ghost: 0, double: 0, tiny: 0 };
    G.combo = 0;
    G.bestCombo = 0;
    G.perfects = 0;
    G.coinCarry = 0;
    G.coinStreak = 0;
    G.comboSaves = Prog.treeLevel('s_keep');
    G.revives = (Prog.treeLevel('s_phoenix') > 0 || Prog.currentBird() === 'phoenix') ? 1 : 0;
    G.glideTick = 0;
    if (Prog.treeLevel('a_shield') > 0)
      G.power.shield = true;
    let kitKind = null;
    if (Prog.treeLevel('p_kit') > 0) {
      kitKind = POWER_TIMED[Math.floor(Math.random() * POWER_TIMED.length)];
      G.power[kitKind] = Rules.powerDuration(kitKind);
    }
    G.bird = { x: BIRD_X, y: 300, vy: 0, angle: 0 };
    G.sceneBiome = G.course.gates[0].biome;
    G.scene = View.sceneFor(G.sceneBiome);
    G.biomeBanner = 2.5;
    G.biomeBannerText = G.mode === 'adventure' ? stage.name : SZ.FlappyCourse.BIOMES[G.sceneBiome].name;
    G.readyBobT = 0;
    G.dyingTimer = 0;
    G.scorePopTimer = 0;
    G.wingFrame = 0;
    G.flapAnim = 0;
    particles.clear();
    floatingText.clear();
    G.feathers.length = 0;
    G.weather.length = 0;
    G.rings.length = 0;
    G.afterimages.length = 0;
    G.weatherCarry = 0;
    G.hitStop = 0;
    G.flash = 0;
    G.coinBump = 0;
    G.lastCoinsShown = 0;
    G.fade = 1;
    if (kitKind)
      floatingText.add(BIRD_X, G.bird.y - 40, POWER_NAMES[kitKind], { color: BUBBLE_COLORS[kitKind], font: 'bold 26px sans-serif' });
    G.state = STATE_READY;
    G.menuCursor = 0;
    Nav.updateStatus();
    Nav.updateWindowTitle();
    G.newBest = false;
  }

  function resetGame() {
    startRun();
  }

  function flap() {
    G.bird.vy = FLAP_IMPULSE;
    G.flapAnim = 0.25;
    sfx('jump', { pitch: 1.15 + Math.random() * 0.12, volume: 0.45 });
    // Flap particle puff effect
    particles.burst(BIRD_X - 10, G.bird.y + 8, 6, {
      color: '#ddd',
      speed: 2,
      gravity: 0.05,
      size: 2,
      life: 0.5,
      decay: 0.03
    });
    // A couple of feathers drift off the back of the wings
    const art = Prog.birdArt();
    Fx.addFeather(BIRD_X - 14, G.bird.y + 4, -0.5 - Math.random(), Math.random() * 1.5, art.wing);
    Fx.addFeather(BIRD_X - 14, G.bird.y + 4, -0.5 - Math.random(), Math.random() * 1.5, art.body);
  }

  function takeHit(source) {
    if (G.invuln > 0)
      return;

    // A shield eats the first non-ground hit
    if (G.power.shield && source !== 'ground') {
      G.power.shield = false;
      G.invuln = 0.8;
      sfx('zap');
      particles.burst(BIRD_X, G.bird.y, 24, { color: '#4aa3ff', speed: 6 });
      screenShake.trigger(3, 150);
      G.flash = 0.25;
      G.flashColor = BUBBLE_COLORS.shield;
      return;
    }

    // Ghost mode walks through everything but the ground
    if (G.power.ghost > 0 && source !== 'ground')
      return;

    G.combo = 0;
    ++G.hitsTaken;
    screenShake.trigger(6, 250);
    sfx('hurt');
    // The hit lands with a beat of frozen frame, a white flash and loose feathers
    G.hitStop = 0.07;
    G.flash = 0.5;
    G.flashColor = '#ffffff';
    Fx.burstFeathers(BIRD_X, G.bird.y, 10);

    if (G.mode === 'time') {
      G.timeLeft = Math.max(0, G.timeLeft - 3);
      G.invuln = INVULN_TIME;
      floatingText.add(BIRD_X, G.bird.y - 30, '-3 s', { color: '#ff6a6a' });
      return;
    }

    G.hearts -= 1;
    if (G.hearts > 0) {
      G.invuln = INVULN_TIME + 0.4 * Prog.treeLevel('a_down');
      G.bird.vy = Math.min(G.bird.vy, -4);
      return;
    }
    // The last heart can be paid for with a revive — once per run
    if (G.revives > 0) {
      --G.revives;
      G.hearts = 1;
      G.invuln = 2;
      G.bird.vy = FLAP_IMPULSE;
      particles.burst(BIRD_X, G.bird.y, 40, { color: '#ff7a3a', speed: 7, size: 4 });
      particles.burst(BIRD_X, G.bird.y, 20, { color: '#ffd23f', speed: 4 });
      floatingText.add(BIRD_X, G.bird.y - 60, 'REBORN!', { color: '#ff7a3a', font: 'bold 40px sans-serif' });
      sfx('powerup', { pitch: 0.8 });
      sfx('win', { volume: 0.4 });
      screenShake.trigger(8, 400);
      return;
    }
    die();
  }

  function die() {
    G.state = STATE_DYING;
    G.dyingTimer = 0;
    // Death hits harder: red flash, a longer freeze and a burst of feathers
    G.afterimages.length = 0;
    G.hitStop = 0.07;
    G.flash = 0.5;
    G.flashColor = '#ff4a4a';
    Fx.burstFeathers(BIRD_X, G.bird.y, 10);
    // Screen shake on death
    screenShake.trigger(6, 300);
    sfx('hit');
  }

  function finishRun(reason) {
    ++G.save.stats.runs;
    G.save.stats.coins += G.coinsRun;
    G.save.coins += G.coinsRun;

    if (G.mode === 'classic') {
      Save.addHighScore(G.score);
      if (G.score > G.save.best.classic) {
        G.save.best.classic = G.score;
        G.newBest = true;
      }
    } else if (G.mode === 'time') {
      if (G.score > G.save.best.time) {
        G.save.best.time = G.score;
        G.newBest = true;
      }
    } else if (G.mode === 'daily') {
      const today = Prog.todayKey();
      if (G.save.best.daily.date !== today) {
        G.save.best.daily = { date: today, score: G.score };
        G.newBest = G.score > 0;
      } else if (G.score > G.save.best.daily.score) {
        G.save.best.daily.score = G.score;
        G.newBest = true;
      }
    } else if (G.mode === 'adventure' && reason === 'clear') {
      const stars = 1 + (G.coinsPicked >= 0.6 * G.course.totalCoins ? 1 : 0) + (G.hitsTaken === 0 ? 1 : 0);
      G.lastStars = stars;
      const id = SZ.FlappyCourse.STAGES[G.stageIndex].id;
      G.save.stars[id] = Math.max(G.save.stars[id] || 0, stars);
      G.state = STATE_CLEAR;
      sfx('win');
      particles.confetti(CANVAS_W / 2, 200, 60);
    }

    Save.writeSave();
    if (G.state !== STATE_CLEAR) {
      G.state = STATE_DEAD;
      sfx('lose', { volume: 0.7 });
      if (G.newBest) {
        particles.confetti(CANVAS_W / 2, 200, 60);
        sfx('levelup', { pitch: 1.2 });
      }
    }
    G.fade = 1;
    G.panelAt = G.globalTime;
    G.clearStarFx = 0;
    G.menuCursor = 0;
    Nav.updateStatus();
    Nav.updateWindowTitle();
  }

  Object.assign(NS.run, { startRun, resetGame, flap, takeHit, die, finishRun });
})();
