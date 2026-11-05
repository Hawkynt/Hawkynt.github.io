;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Run lifecycle: start a run (or resume a saved one), flap, take damage, die and settle
     the result into the save. Writes the run fields of G (course, bird, hearts, power,
     combo, fever, points, effects timers, state). */

  const {
    CANVAS_W, FLAP_IMPULSE, BIRD_X, INVULN_TIME, TIME_ATTACK_SECONDS, BUBBLE_COLORS, POWER_NAMES, POWER_TIMED, MODES,
    STATE_READY, STATE_PAUSED, STATE_DYING, STATE_DEAD, STATE_CLEAR
  } = NS.C;
  const { particles, screenShake, floatingText, sfx } = NS.services;
  const G = NS.state;
  const Save = NS.save;
  const Prog = NS.progress;
  const Rules = NS.rules;
  const View = NS.view;
  const Fx = NS.fx;
  const Nav = NS.nav;
  const Goals = NS.goals;
  const Course = SZ.FlappyCourse;

  const RUSH_STAGE = Object.freeze({
    id: 'rush', world: 0, stage: 0, biome: 'meadow', name: 'Boss Rush', gates: 2, gap: 230, speed: 3, spacing: 380,
    moveChance: 0, closeChance: 0, hazardChance: 0, crowChance: 0, bubbleEvery: 99
  });

  /* the course options of the current mode - stored with a snapshot, so a resumed run
     regenerates exactly the same course */
  function courseOptions() {
    const tw = G.mode === 'daily' ? G.twist : null;
    let seed;
    if (G.mode === 'daily')
      seed = Course.dailySeed(new Date());
    else if (G.mode === 'adventure')
      seed = Course.hashSeed(Course.STAGES[G.stageIndex].id);
    else
      seed = (Math.random() * 4294967296) >>> 0;
    const base = MODES[G.mode].bubbleEvery || (G.mode === 'adventure' ? 6 : 7);
    return {
      seed: seed,
      stageIndex: G.mode === 'adventure' ? G.stageIndex : G.mode === 'bossrush' ? -2 : -1,
      profile: G.mode === 'zen' ? 'zen' : G.mode === 'arcade' ? 'arcade' : 'endless',
      bubbleEvery: tw && tw.bubbleEvery ? tw.bubbleEvery : Math.max(3, Math.round(base / (1 + 0.25 * Prog.treeLevel('p_more')))),
      tokenEvery: G.mode === 'time' || G.mode === 'bossrush' ? 0 : 5,
      mods: tw && tw.mods ? tw.mods : (tw && tw.gusts ? { hazardBoost: 0.2 } : null)
    };
  }

  function buildCourse(o) {
    const stage = o.stageIndex >= 0 ? Course.STAGES[o.stageIndex] : o.stageIndex === -2 ? RUSH_STAGE : null;
    return Course.createCourse({ seed: o.seed, stage: stage, profile: o.profile, bubbleEvery: o.bubbleEvery, tokenEvery: o.tokenEvery, mods: o.mods });
  }

  function resetJuice() {
    particles.clear();
    floatingText.clear();
    G.feathers.length = 0;
    G.weather.length = 0;
    G.rings.length = 0;
    G.debris.length = 0;
    G.afterimages.length = 0;
    G.weatherCarry = 0;
    G.hitStop = 0;
    G.flash = 0;
    G.coinBump = 0;
    G.lastCoinsShown = G.coinsRun;
    G.readyBobT = 0;
    G.dyingTimer = 0;
    G.scorePopTimer = 0;
    G.wingFrame = 0;
    G.flapAnim = 0;
    G.squash = 0;
    G.fade = 1;
  }

  function startRun() {
    Goals.rollover();
    G.courseOpts = courseOptions();
    G.seed = G.courseOpts.seed;
    G.course = buildCourse(G.courseOpts);
    G.dist = 0;
    G.runTime = 0;
    G.worldT = 0;
    G.score = 0;
    G.points = 0;
    G.mult = 1;
    G.multClean = 0;
    G.coinsRun = 0;
    G.coinsPicked = 0;
    G.tokensRun = 0;
    G.hitsTaken = 0;
    G.invuln = 0;
    G.hearts = Rules.maxHearts();
    G.timeLeft = TIME_ATTACK_SECONDS;
    G.power = G.freshPower();
    G.blastCharges = 0;
    G.combo = 0;
    G.bestCombo = 0;
    G.perfects = 0;
    G.coinCarry = 0;
    G.coinStreak = 0;
    G.fever = 0;
    G.feverT = 0;
    G.flow = 0;
    G.zenNote = 0;
    G.zenBumps = 0;
    G.comboSaves = Prog.treeLevel('s_keep');
    G.revives = (Prog.treeLevel('s_phoenix') > 0 || Prog.currentBird() === 'phoenix') ? 1 : 0;
    G.glideTick = 0;
    G.boss = null;
    G.bossIntro = 0;
    G.bossBeaten = false;
    G.bossRush = G.mode === 'bossrush' ? { list: Prog.bossesBeaten(), index: 0 } : null;
    G.runReward = null;
    G.rankArcade = -1;
    G.runSaveT = 1;
    if (Prog.treeLevel('a_shield') > 0)
      G.power.shield = true;
    let kitKind = null;
    if (Prog.treeLevel('p_kit') > 0) {
      kitKind = POWER_TIMED[Math.floor(Math.random() * POWER_TIMED.length)];
      NS.powers.grant(kitKind, true);
    }
    G.bird = { x: BIRD_X, y: 300, vy: 0, angle: 0 };
    G.buddy = { x: BIRD_X - 70, y: 260, shield: false };
    G.sceneBiome = G.mode === 'bossrush' && G.bossRush.list.length ? Course.BIOME_ORDER[Course.BOSS_ORDER.indexOf(G.bossRush.list[0])] : G.course.gates[0].biome;
    G.scene = View.sceneFor(G.sceneBiome);
    G.biomeBanner = 2.5;
    G.biomeBannerText = G.mode === 'adventure' ? Course.STAGES[G.stageIndex].name : G.mode === 'bossrush' ? 'Boss Rush' : Course.BIOMES[G.sceneBiome].name;
    resetJuice();
    if (kitKind)
      floatingText.add(BIRD_X, G.bird.y - 40, POWER_NAMES[kitKind], { color: BUBBLE_COLORS[kitKind], font: 'bold 26px sans-serif' });
    G.state = STATE_READY;
    G.menuCursor = 0;
    G.newBest = false;
    Nav.updateStatus();
    Nav.updateWindowTitle();
    Goals.touchStreak();
  }

  /* continue a run from its autosave snapshot: the same course, the same position */
  function resumeRun(snap) {
    Goals.rollover();
    G.mode = snap.mode;
    G.stageIndex = snap.stageIndex || 0;
    G.courseOpts = snap.courseOpts;
    G.seed = snap.courseOpts.seed;
    G.course = buildCourse(snap.courseOpts);
    G.course.restore(snap.course);
    const keys = ['dist', 'runTime', 'worldT', 'score', 'points', 'mult', 'multClean', 'coinsRun', 'coinsPicked', 'tokensRun',
      'hearts', 'hitsTaken', 'timeLeft', 'blastCharges', 'combo', 'bestCombo', 'perfects', 'coinCarry', 'comboSaves',
      'revives', 'fever', 'feverT', 'flow', 'zenNote', 'zenBumps'];
    for (const k of keys)
      if (typeof snap[k] === 'number')
        G[k] = snap[k];
    G.power = Object.assign(G.freshPower(), snap.power || {});
    G.bird = Object.assign({ x: BIRD_X, y: 300, vy: 0, angle: 0 }, snap.bird || {});
    G.buddy = Object.assign({ x: BIRD_X - 70, y: G.bird.y, shield: false }, snap.buddy || {});
    G.boss = snap.boss || null;
    G.bossRush = snap.bossRush || null;
    G.bossIntro = 0;
    G.bossBeaten = false;
    G.invuln = 1;
    G.runReward = null;
    G.rankArcade = -1;
    G.runSaveT = 3;
    G.sceneBiome = snap.sceneBiome || G.course.gates[0].biome;
    G.scene = View.sceneFor(G.sceneBiome);
    G.biomeBanner = 0;
    resetJuice();
    G.state = STATE_PAUSED;
    G.heartsAtPause = Rules.maxHearts();
    G.menuCursor = 0;
    G.newBest = false;
    Nav.updateStatus();
    Nav.updateWindowTitle();
    Goals.touchStreak();
  }

  function resetGame() {
    startRun();
  }

  function flap() {
    G.bird.vy = FLAP_IMPULSE;
    G.flapAnim = 0.25;
    G.squash = 0.18;
    ++G.save.stats.flaps;
    sfx('jump', { pitch: 1.15 + Math.random() * 0.12, volume: 0.4 });
    particles.burst(BIRD_X - 10, G.bird.y + 8, 6, { color: '#dddddd', speed: 2, gravity: 0.05, size: 2, life: 0.5, decay: 0.03 });
    const art = Prog.birdArt();
    Fx.addFeather(BIRD_X - 14, G.bird.y + 4, -0.5 - Math.random(), Math.random() * 1.5, art.wing);
    Fx.addFeather(BIRD_X - 14, G.bird.y + 4, -0.5 - Math.random(), Math.random() * 1.5, art.body);
  }

  /* source: 'pipe' | 'ground' | a hazard type | 'boss' */
  function takeHit(source) {
    if (G.invuln > 0)
      return;

    // Zen: nothing hurts, a bump only resets the flow
    if (G.mode === 'zen') {
      G.flow = 0;
      ++G.zenBumps;
      G.invuln = 0.6;
      G.bird.vy = source === 'ground' ? FLAP_IMPULSE * 0.8 : Math.min(G.bird.vy, -3);
      particles.burst(BIRD_X, G.bird.y, 10, { color: '#bff4ff', speed: 3, size: 3, life: 0.6 });
      particles.ring(BIRD_X, G.bird.y, 'rgba(190,240,255,0.8)', 3, 0.4);
      sfx('bounce', { volume: 0.25, pitch: 0.8 });
      return;
    }
    if (G.power.rush > 0 && source !== 'ground')
      return;

    // A shield eats the first non-ground hit
    if (G.power.shield && source !== 'ground') {
      G.power.shield = false;
      G.invuln = 0.8;
      sfx('zap');
      particles.burst(BIRD_X, G.bird.y, 24, { color: '#4aa3ff', speed: 6 });
      particles.ring(BIRD_X, G.bird.y, '#4aa3ff', 5, 0.35);
      screenShake.trigger(3, 150);
      G.flash = 0.25;
      G.flashColor = BUBBLE_COLORS.shield;
      return;
    }

    // Ghost mode walks through everything but the ground
    if (G.power.ghost > 0 && source !== 'ground')
      return;

    // The loyal wingmate throws itself in front of one hit
    if (G.power.buddy > 0 && G.buddy.shield && source !== 'ground') {
      G.buddy.shield = false;
      G.power.buddy = 0;
      G.invuln = 0.8;
      Fx.burstFeathers(G.buddy.x, G.buddy.y, 8, 'pip');
      floatingText.add(G.buddy.x, G.buddy.y - 30, 'SAVED!', { color: '#7ad85a', font: 'bold 24px sans-serif' });
      sfx('hurt', { pitch: 1.4 });
      return;
    }

    G.combo = 0;
    G.mult = 1;
    G.multClean = 0;
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
      particles.ring(BIRD_X, G.bird.y, '#ff7a3a', 8, 0.5);
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
    G.hitStop = 0.09;
    G.flash = 0.5;
    G.flashColor = '#ff4a4a';
    Fx.burstFeathers(BIRD_X, G.bird.y, 14);
    screenShake.trigger(7, 320);
    sfx('hit');
    Save.clearRun();
  }

  /* pay the coins, settle bests and stars, count stats; reason: 'dead' | 'time' | 'clear' | 'quit' */
  function finishRun(reason) {
    const s = G.save;
    ++s.stats.runs;
    s.stats.seconds += G.runTime;
    const interest = Math.min(60 * Prog.treeLevel('f_egg'), Math.floor(s.coins * 0.02 * (Prog.treeLevel('f_egg') > 0 ? 1 : 0)));
    s.coins += G.coinsRun + interest;
    Goals.bump('coins', G.coinsRun);
    G.runReward = { coins: G.coinsRun, interest: interest };

    if (G.mode === 'classic') {
      Save.addHighScore(G.score);
      if (G.score > s.best.classic) {
        s.best.classic = G.score;
        G.newBest = true;
      }
    } else if (G.mode === 'arcade') {
      G.rankArcade = Save.addArcadeScore(G.points, Prog.todayKey(), Prog.currentBird());
      Goals.best('arcadeBest', G.points);
      if (G.points > s.best.arcade) {
        s.best.arcade = G.points;
        G.newBest = true;
      }
    } else if (G.mode === 'zen') {
      if (G.score > s.best.zen) {
        s.best.zen = G.score;
        G.newBest = true;
      }
    } else if (G.mode === 'time') {
      if (G.score > s.best.time) {
        s.best.time = G.score;
        G.newBest = true;
      }
    } else if (G.mode === 'daily') {
      const today = Prog.todayKey();
      if (s.lastDaily !== today) {
        s.lastDaily = today;
        Goals.bump('dailyDays', 1);
      }
      if (s.best.daily.date !== today) {
        s.best.daily = { date: today, score: G.score };
        G.newBest = G.score > 0;
      } else if (G.score > s.best.daily.score) {
        s.best.daily.score = G.score;
        G.newBest = true;
      }
    } else if (G.mode === 'bossrush' && reason === 'clear') {
      s.stats.bossRush = 1;
      if (!s.best.bossrush || G.runTime < s.best.bossrush) {
        s.best.bossrush = Math.round(G.runTime * 10) / 10;
        G.newBest = true;
      }
    }

    if (reason === 'clear' && G.mode !== 'bossrush') {
      const stars = 1 + (G.coinsPicked >= 0.6 * G.course.totalCoins ? 1 : 0) + (G.hitsTaken === 0 ? 1 : 0);
      G.lastStars = stars;
      const id = Course.STAGES[G.stageIndex].id;
      s.stars[id] = Math.max(s.stars[id] || 0, stars);
      Goals.bump('stages', 1);
      G.state = STATE_CLEAR;
      sfx('win');
      particles.confetti(CANVAS_W / 2, 200, 70);
    } else if (reason === 'clear') {
      G.state = STATE_CLEAR;
      G.lastStars = 3;
      sfx('win');
      particles.confetti(CANVAS_W / 2, 200, 90);
    }

    Save.clearRun();
    // a cleared story stage leaves the next one waiting behind Continue
    if (G.state === STATE_CLEAR && G.mode === 'adventure' && G.stageIndex + 1 < Course.STAGES.length)
      Save.writeRun({ v: 1, fresh: true, mode: 'adventure', stageIndex: G.stageIndex + 1, savedAt: Date.now() });
    Goals.check();
    Save.writeSave();
    if (G.state !== STATE_CLEAR) {
      G.state = STATE_DEAD;
      sfx('lose', { volume: 0.6 });
      if (G.newBest) {
        particles.confetti(CANVAS_W / 2, 200, 70);
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

  Object.assign(NS.run, { RUSH_STAGE, courseOptions, buildCourse, startRun, resumeRun, resetGame, flap, takeHit, die, finishRun });
})();
