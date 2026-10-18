;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     MODULES & CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const Ph = SZ.PhysicsPuzzlePhysics;
  const Parts = SZ.PhysicsPuzzleParts;
  const Sim = SZ.PhysicsPuzzleSim;
  const Lv = SZ.PhysicsPuzzleLevels;
  const Prog = SZ.PhysicsPuzzleProgress;
  const Art = SZ.PhysicsPuzzleArt;
  const Scene = SZ.PhysicsPuzzleScene;
  const Fx = SZ.PhysicsPuzzleFx;
  const SOLUTIONS = SZ.PhysicsPuzzleSolutions || {};

  const VIEW_W = 1280;
  const VIEW_H = 720;
  const FIELD_H = 640;
  const BAR_Y = 640;
  const MAX_DT = 0.05;
  const MAX_STEPS = 24;
  const FADE_RATE = 3.2;
  const AIM_MAX_DRAG = 220;
  const WIN_TIME = 1.7;
  const STORAGE_SAVE = 'sz-physics-puzzle-v2';
  const DEG = Math.PI / 180;
  const WORLDS = Lv.WORLDS;
  const SANDBOX_CAP = 30;
  const TARGET_COLOR = '#ff4a32';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const ui = SZ.PhysicsPuzzleUI.create(ctx);
  const { User32 } = SZ?.Dlls ?? {};
  const statusLevel = document.getElementById('statusLevel');
  const statusShots = document.getElementById('statusShots');
  const statusStars = document.getElementById('statusStars');
  const statusCoins = document.getElementById('statusCoins');

  const fxWorld = Fx.create(420);
  const fxView = Fx.create(260);
  const fxMenu = Fx.create(160);
  const shake = Fx.createShake();
  const timeScale = Fx.createTimeScale();
  const flash = Fx.createFlash();
  const texts = Fx.createTexts(20);

  /* ══════════════════════════════════════════════════════════════════
     CANVAS: a 1280 x 720 logical view, letterboxed, DPR aware
     ══════════════════════════════════════════════════════════════════ */

  let viewScale = 1, viewOffX = 0, viewOffY = 0, dpr = 1;
  let layer = null;          // the baked static picture of the current level
  let layerKey = '';

  function setupCanvas() {
    const cssW = Math.max(1, canvas.clientWidth), cssH = Math.max(1, canvas.clientHeight);
    const fit = Math.min(cssW / VIEW_W, cssH / VIEW_H);
    dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 2 / Math.max(fit, 0.01)));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    viewScale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    viewOffX = Math.round((canvas.width - VIEW_W * viewScale) / 2);
    viewOffY = Math.round((canvas.height - VIEW_H * viewScale) / 2);
    Art.setScale(viewScale);
    layerKey = '';
  }

  /* visible logical area including the letterbox bars */
  function visibleRect() {
    return { x0: -viewOffX / viewScale, y0: -viewOffY / viewScale, x1: (canvas.width - viewOffX) / viewScale, y1: (canvas.height - viewOffY) / viewScale };
  }

  function beginFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a0e1c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
  }

  function pointerToView(e) {
    const rect = canvas.getBoundingClientRect();
    const d = canvas.width / Math.max(1, rect.width);
    return { x: ((e.clientX - rect.left) * d - viewOffX) / viewScale, y: ((e.clientY - rect.top) * d - viewOffY) / viewScale };
  }

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  let save = Prog.defaultSave();

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_SAVE);
      save = Prog.migrate(raw ? JSON.parse(raw) : null);
    } catch (_) {
      save = Prog.defaultSave();
    }
  }

  function writeSave() {
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(save));
    } catch (_) {}
  }

  function renderHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body)
      return;
    body.innerHTML = '';
    WORLDS.forEach((w, i) => {
      const levels = Lv.worldLevels(i);
      const stars = Prog.totalStars(save, levels);
      const cleared = levels.filter(l => Prog.cleared(save, l.id)).length;
      const tr = document.createElement('tr');
      for (const v of [w.name, stars + ' / ' + levels.length * 3, cleared + ' / ' + levels.length]) {
        const td = document.createElement('td');
        td.textContent = String(v);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });
    const tricks = Lv.TRICKS.filter(t => save.tricks[t.id]).length;
    const tr = document.createElement('tr');
    for (const v of ['Trick Shots', tricks + ' / ' + Lv.TRICKS.length, save.daily.cleared ? 'Daily cleared' : '']) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }

  /* ══════════════════════════════════════════════════════════════════
     SOUND
     ══════════════════════════════════════════════════════════════════ */

  const sfxLast = {};
  function sfx(name, opts) {
    const now = performance.now();
    if (now - (sfxLast[name] || 0) < 45)
      return;
    sfxLast[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  /* ══════════════════════════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = 'title';
  let time = 0;
  let frameDt = 0;
  let fade = 0;
  let mouseX = -1, mouseY = -1, mouseDown = false;
  let pointerMoved = false;
  let menuCursor = 0;
  const hitAreas = [];
  let stats = Prog.computeStats(save);
  let run = null;
  let results = null;
  let toast = null;
  let frameMs = 0, frameMsAvg = 0;

  function refreshStats() {
    stats = Prog.computeStats(save);
    if (run && run.att)
      run.att.rubber = stats.rubber;
  }

  function setScreen(name) {
    state = name;
    menuCursor = 0;
    fade = 1;
    hitAreas.length = 0;
    updateWindowTitle();
  }

  function showToast(text, color) {
    toast = { text: text, color: color || '#ffffff', t: 0 };
  }

  function localDate() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function currentSkin() {
    return Prog.SKINS.find(s => s.id === save.skin) || Prog.SKINS[0];
  }

  /* ══════════════════════════════════════════════════════════════════
     RUN: one level being played
     ══════════════════════════════════════════════════════════════════ */

  function sandboxLevel(world) {
    return {
      id: 'sandbox', name: 'Sandbox', world: world, launcher: [110, 566], sandbox: true,
      items: [['ground', 0, 1280]], targets: [[1100, 520]], stars: [], inv: {}, par: 99,
      tip: 'Build anything. Every part you have unlocked is in the tray. Drag the target to move it.'
    };
  }

  function inventoryFor(level, mode) {
    if (mode === 'sandbox') {
      const inv = {};
      for (const t of stats.sandboxParts)
        inv[t] = SANDBOX_CAP;
      return inv;
    }
    const inv = Object.assign({}, level.inv);
    if (!(level.rule && level.rule.noParts)) {
      if (stats.spare.plank)
        inv.plank = (inv.plank || 0) + stats.spare.plank;
      if (stats.spare.spring)
        inv.spring = (inv.spring || 0) + stats.spare.spring;
    }
    return inv;
  }

  function startLevel(mode, level, opts) {
    opts = opts || {};
    const theme = WORLDS[level.world];
    const rule = level.rule || {};
    run = {
      mode: mode, level: level, world: level.world, theme: theme,
      inv: inventoryFor(level, mode), placed: opts.placed ? opts.placed.slice() : [],
      att: null, phase: 'intro', introT: 0, aimAngle: 35, aimPower: 0.6, aiming: null,
      selected: -1, drag: null, wonT: 0, lastPaths: [], trails: [], bulletLeft: stats.bulletTime,
      blueprint: 0, nearMiss: {}, recoil: 0, readyT: 0, shotsTotal: 0, starsBest: 0,
      oneShot: !!rule.oneShot, minBounces: rule.minBounces || 0
    };
    rebuildAttempt();
    warmCaches();
    fxWorld.clear();
    texts.clear();
    timeScale.reset();
    shake.reset();
    layerKey = '';
    setScreen('play');
    sfx('whoosh', { volume: 0.5 });
  }

  /* draws everything once off screen so no sprite is painted mid-shot */
  let warmCanvas = null, fxWarmed = false;
  function warmCaches() {
    if (!warmCanvas) {
      warmCanvas = document.createElement('canvas');
      warmCanvas.width = warmCanvas.height = 4;
    }
    const g = warmCanvas.getContext('2d');
    const skin = currentSkin();
    for (const b of run.att.world.bodies)
      if (b.alive && !b.sensor)
        Art.drawBody(g, b, run.world, 0, skin);
    for (const z of run.att.world.zones)
      Art.drawZone(g, z, run.world, 0);
    for (const t of Parts.PART_ORDER)
      Art.partIcon(t, run.world);
    Art.drawTarget(g, 0, 0, false, 0, TARGET_COLOR);
    Art.drawTarget(g, 0, 0, true, 0, TARGET_COLOR);
    Art.drawStar(g, 0, 0, 0, 0);
    Art.drawBall(g, 0, 0, 0, skin, Parts.BALL_R, 0);
    Art.drawLauncher(g, 0, 0, 30, 0.5, 0, run.world, 0);
    if (!fxWarmed) {
      fxWarmed = true;
      const sys = Fx.create(400);
      Fx.impact(sys, 0, 0, 0, 1, 'metal', 1);
      Fx.impact(sys, 0, 0, 0, 1, 'wood', 1);
      Fx.shatter(sys, 0, 0, 100, 0);
      Fx.explosion(sys, 0, 0, 170);
      Fx.splash(sys, 0, 0, false);
      Fx.sizzle(sys, 0, 0);
      Fx.targetHit(sys, 0, 0, '#ffb84a');
      Fx.starPickup(sys, 0, 0);
      Fx.confetti(sys, 0, 0, 12);
      Fx.bumperPop(sys, 0, 0, 24, '#ff7ad0');
      Fx.springPop(sys, 0, 0, 0, -1);
      Fx.portal(sys, 0, 0, '#5ac8ff');
      for (const tr of ['spark', 'comet', 'rainbow'])
        for (let k = 0; k < 20; ++k)
          Fx.trail(sys, tr, 0, 0, 900, 0, 0.1, k);
      sys.draw(g);
    }
  }

  /* a fresh world for this level with the current parts */
  function rebuildAttempt() {
    run.att = Sim.createAttempt(run.level, run.placed, { theme: run.theme, rubber: stats.rubber, oneShot: run.oneShot, minBounces: run.minBounces });
    run.phase = run.phase === 'intro' ? 'intro' : 'aim';
    run.selected = -1;
  }

  function restartLevel() {
    if (!run)
      return;
    const placed = run.placed.slice();
    const mode = run.mode, level = run.level;
    startLevel(mode, level, { placed: placed });
    run.phase = 'aim';
    showToast('Fresh start - your parts stay put', '#bfeaff');
  }

  function startCampaign(id) {
    startLevel('campaign', Lv.BY_ID[id]);
  }

  function startTrick(t) {
    startLevel('trick', Lv.trickLevel(t));
  }

  let dailyCache = null;
  function dailyLevel() {
    const key = localDate();
    if (!dailyCache || dailyCache.key !== key)
      dailyCache = { key: key, level: Sim.buildDaily(key, Lv.LEVELS, SOLUTIONS, WORLDS) };
    return dailyCache.level;
  }

  function startDaily() {
    startLevel('daily', dailyLevel());
  }

  function startSandbox(world) {
    startLevel('sandbox', sandboxLevel(world || 0));
  }

  function partsLeft(type) {
    let n = run.inv[type] || 0;
    for (const p of run.placed)
      if (p.type === type)
        --n;
    return n;
  }

  /* ── firing ── */

  function launchSpeed(power) {
    return Sim.MIN_SPEED + power * (Sim.BASE_MAX_SPEED * stats.powerMul - Sim.MIN_SPEED);
  }

  function fire() {
    if (!run || run.phase !== 'aim')
      return;
    const extra = run.mode === 'trick' ? 0 : stats.extraBalls;
    const shot = Sim.fire(run.att, run.aimAngle, launchSpeed(run.aimPower), extra, 4);
    run.phase = 'flight';
    run.selected = -1;
    run.recoil = 1;
    run.bulletLeft = stats.bulletTime;
    run.nearMiss = {};
    run.trails = shot.balls.map(() => []);
    run.shotsTotal = run.att.shots;
    ++save.stats.shots;
    const d = Sim.launcherDir(run.aimAngle);
    const L = run.level.launcher;
    Fx.muzzle(fxWorld, L[0] + d[0] * 40, L[1] + d[1] * 40, d[0], d[1], run.aimPower);
    shake.add(0.12 + run.aimPower * 0.15);
    sfx('shoot', { pitch: 0.7 + run.aimPower * 0.5 });
  }

  /* ── stepping the live attempt ── */

  let stepAcc = 0;

  function updatePlay(dt) {
    if (run.phase === 'intro') {
      run.introT += dt;
      if (run.introT > 2.2)
        run.phase = 'aim';
      return;
    }
    run.recoil = Math.max(0, run.recoil - dt * 4);
    if (run.phase === 'won') {
      run.wonT += dt;
      stepWorld(dt * timeScale.update(dt));
      if (run.wonT > WIN_TIME)
        finishLevel();
      return;
    }
    if (run.phase !== 'flight')
      return;
    let rate = timeScale.update(dt);
    if (stats.bulletTime && run.bulletLeft > 0 && (held.has('Space') || held.has('KeyS') || touchSlow)) {
      run.bulletLeft = Math.max(0, run.bulletLeft - dt);
      rate = Math.min(rate, 0.3);
    }
    stepWorld(dt * rate);
    const shot = run.att.shot;
    if (shot && shot.done) {
      if (shot.done === 'win' && run.mode === 'sandbox') {
        /* the Sandbox never ends: celebrate and keep building */
        winBurst();
        sfx('win');
        texts.add(run.att.targets[0].x, run.att.targets[0].y - 50, 'NICE SHOT!', { color: '#ffe066', size: 30, life: 1.4 });
        for (const t of run.att.targets)
          t.lit = false;
        run.att.won = false;
        run.phase = 'aim';
        run.lastPaths = run.trails.map(t => t.slice());
      } else if (shot.done === 'win') {
        run.phase = 'won';
        run.wonT = 0;
        timeScale.slow(0.25, 0.6);
        sfx('win');
        winBurst();
      } else {
        run.phase = 'aim';
        run.lastPaths = run.trails.map(t => t.slice());
        if (run.mode === 'sandbox')
          return;
        const lit = run.att.targets.filter(t => t.lit).length;
        if (run.oneShot && lit)
          showToast('Not all in one shot - try again', '#ffb0a0');
        else if (lit)
          showToast(lit + ' of ' + run.att.targets.length + ' targets lit - keep going', '#ffe9a0');
        else
          showToast(run.att.shots === 1 ? 'Missed - adjust and try again' : 'Missed - shot ' + run.att.shots, '#ffb0a0');
        sfx('drop', { volume: 0.6 });
      }
    }
  }

  function stepWorld(dt) {
    stepAcc += Math.min(dt, MAX_DT);
    let n = 0;
    while (stepAcc >= Ph.STEP && n < MAX_STEPS) {
      stepAcc -= Ph.STEP;
      ++n;
      if (run.att.shot && !run.att.shot.done) {
        Sim.stepAttempt(run.att);
        handleEvents(run.att.shot.events);
        run.att.shot.events.length = 0;
        recordTrails();
      } else {
        /* after the win the world keeps moving for the celebration */
        Ph.step(run.att.world);
        Ph.takeEvents(run.att.world);
      }
    }
    if (n >= MAX_STEPS)
      stepAcc = 0;
  }

  function recordTrails() {
    const shot = run.att.shot;
    if (run.att.world.steps % 4)
      return;
    shot.balls.forEach((b, i) => {
      if (!b.alive || shot.phase !== 'fly')
        return;
      const tr = run.trails[i];
      tr.push(b.x, b.y);
      if (tr.length > 1200)
        tr.splice(0, 2);
    });
  }

  function matOf(b) {
    return b.mat || 'wood';
  }

  function handleEvents(events) {
    for (const e of events) {
      switch (e.type) {
        case 'impact': {
          const ball = e.a.tag === 'ball' ? e.a : e.b.tag === 'ball' ? e.b : null;
          const other = ball === e.a ? e.b : e.a;
          const s = Math.min(1, e.speed / 1100);
          if (ball) {
            Fx.impact(fxWorld, e.x, e.y, e.nx * (ball === e.b ? 1 : -1), e.ny * (ball === e.b ? 1 : -1), matOf(other), s);
            if (s > 0.15)
              sfx(other.mat === 'metal' ? 'hit' : 'bounce', { volume: 0.3 + s * 0.6, pitch: 0.8 + Math.random() * 0.4 });
            if (s > 0.6)
              shake.add(0.08 * s);
          } else if (e.speed > 140) {
            const dyn = e.a.type === 'dynamic' ? e.a : e.b;
            Fx.dust(fxWorld, e.x, e.y, '#d8c8a8', s);
            if (dyn.mat === 'wood' && s > 0.3)
              sfx('thud', { volume: 0.3 + s * 0.5 });
          }
          break;
        }
        case 'boost': {
          const gadget = e.a.boost ? e.a : e.b;
          gadget.data.hitAt = time;
          if (gadget.tag === 'spring') {
            Fx.springPop(fxWorld, e.x, e.y, Math.sin(gadget.a), -Math.cos(gadget.a));
            sfx('jump', { pitch: 1.2 });
          } else {
            Fx.bumperPop(fxWorld, gadget.x, gadget.y, gadget.r || 24, '#ff7ad0');
            sfx('zap', { volume: 0.7 });
          }
          shake.add(0.06);
          break;
        }
        case 'break':
          Fx.shatter(fxWorld, e.body.x, e.body.y, e.body.data && e.body.data.w || 100, e.body.a);
          sfx('smallExplode', { pitch: 1.8 });
          shake.add(0.2);
          ++save.stats.glass;
          break;
        case 'explode':
          Fx.explosion(fxWorld, e.x, e.y, e.radius);
          scorch(e.x, e.y + 14, 70);
          sfx('explode');
          shake.add(0.6);
          flash.fire('#ffd8a0', 0.35, 3);
          timeScale.slow(0.45, 0.15);
          ++save.stats.tnt;
          break;
        case 'portal':
          Fx.portal(fxWorld, e.x, e.y, '#ffb05a');
          Fx.portal(fxWorld, e.x2, e.y2, '#5ac8ff');
          sfx('laser', { pitch: 1.4, volume: 0.6 });
          break;
        case 'splash':
          Fx.splash(fxWorld, e.x, e.y, false);
          sfx('drop', { pitch: 0.6, volume: 0.6 });
          break;
        case 'burn':
          Fx.sizzle(fxWorld, e.x, e.y);
          sfx('hurt', { volume: 0.6 });
          break;
        case 'target': {
          Fx.targetHit(fxWorld, e.x, e.y, '#ffb84a');
          texts.add(e.x, e.y - 40, run.att.targets.length > 1 ? 'TARGET!' : 'BULLSEYE!', { color: '#ffe066', size: 30, life: 1.3 });
          sfx('powerup');
          shake.add(0.35);
          flash.fire('#ffffff', 0.25, 4);
          timeScale.slow(0.3, 0.35);
          break;
        }
        case 'star':
          Fx.starPickup(fxWorld, e.x, e.y);
          texts.add(e.x, e.y - 26, '+STAR', { color: '#ffd84a', size: 20 });
          sfx('coin', { pitch: 1 + 0.12 * run.att.stars.filter(s => s.got).length });
          ++save.stats.starsTaken;
          break;
        case 'lost':
          if (e.body.tag === 'ball')
            Fx.poof(fxWorld, Math.max(10, Math.min(1270, e.x)), Math.max(10, Math.min(630, e.y)));
          break;
        case 'sleep':
          break;
      }
    }
    /* near misses: a ball streaking close past an unlit target slows time a moment */
    const shot = run.att.shot;
    if (!shot)
      return;
    for (const b of shot.balls) {
      if (!b.alive)
        continue;
      run.att.targets.forEach((t, i) => {
        if (t.lit || run.nearMiss[i])
          return;
        const dx = t.x - b.x, dy = t.y - b.y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 80 && d > 40 && dx * b.vx + dy * b.vy > 0) {
          run.nearMiss[i] = true;
          timeScale.slow(0.35, 0.3);
        }
      });
    }
  }

  function winBurst() {
    const t = run.att.targets[run.att.targets.length - 1];
    Fx.confetti(fxWorld, t.x, t.y - 20, 50);
    for (let k = 0; k < 3; ++k)
      Fx.firework(fxView, 260 + k * 380, 520, null);
  }

  /* ── results ── */

  function finishLevel() {
    const att = run.att;
    const result = { win: true, shots: att.shots, starsTaken: att.stars.filter(s => s.got).length };
    let reward = { coins: 0, stars: [true, false, false], newStars: 0, first: false };
    if (run.mode === 'campaign') {
      reward = Prog.applyLevelResult(save, run.level, result, stats);
    } else if (run.mode === 'trick') {
      const r = Prog.applyTrickResult(save, run.level.trick, true, stats);
      reward = { coins: r.coins, first: r.first, stars: [true, true, true], newStars: 0 };
    } else if (run.mode === 'daily') {
      const r = Prog.applyDailyResult(save, localDate(), result, run.level, stats);
      reward = { coins: r.coins, first: r.first, stars: Prog.runStars(run.level, result), newStars: 0 };
    }
    writeSave();
    results = {
      mode: run.mode, level: run.level, shots: att.shots, par: run.level.par,
      starsTaken: result.starsTaken, starsTotal: att.stars.length,
      stars: run.mode === 'campaign' ? Prog.runStars(run.level, result) : reward.stars,
      coins: reward.coins, first: reward.first, newStars: reward.newStars, t: 0, shown: 0, coinShown: 0
    };
    state = 'results';
    menuCursor = 0;
    updateWindowTitle();
  }

  function nextLevel() {
    if (!results)
      return;
    const lvl = results.level;
    if (results.mode === 'campaign') {
      const i = Lv.LEVELS.findIndex(l => l.id === lvl.id);
      const nx = Lv.LEVELS[i + 1];
      if (nx && Prog.levelUnlocked(save, Lv.LEVELS, nx.id)) {
        startCampaign(nx.id);
        return;
      }
      openMap(nx ? nx.world : lvl.world);
      if (nx && !Prog.worldUnlocked(save, Lv.LEVELS, nx.world))
        showToast('Collect ' + Prog.STAR_GATES[nx.world] + ' stars to open ' + WORLDS[nx.world].name, '#ffe9a0');
      return;
    }
    if (results.mode === 'trick') {
      openTricks();
      return;
    }
    setScreen('title');
  }

  function quitToMenu() {
    const mode = run ? run.mode : 'campaign';
    const world = run ? run.world : 0;
    run = null;
    if (mode === 'campaign')
      openMap(world);
    else if (mode === 'trick')
      openTricks();
    else
      setScreen('title');
  }

  /* ══════════════════════════════════════════════════════════════════
     BUILDING: dragging, rotating and removing parts
     ══════════════════════════════════════════════════════════════════ */

  function canEdit() {
    return run && (run.phase === 'aim' || run.phase === 'intro');
  }

  /* which placed part is under (x, y)? */
  function partAt(x, y) {
    for (let i = run.placed.length - 1; i >= 0; --i) {
      const p = run.placed[i];
      const P = Parts.PARTS[p.type];
      const a = -(p.a || 0) * DEG;
      const dx = x - p.x, dy = y - p.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= P.half[0] + 10 && Math.abs(ly) <= P.half[1] + 12)
        return i;
    }
    return -1;
  }

  function validate(p, skip) {
    return Parts.canPlace(run.level, run.theme, run.placed, p, skip);
  }

  function beginDragNew(type, x, y) {
    if (!canEdit())
      return;
    if (partsLeft(type) <= 0) {
      sfx('error', { volume: 0.5 });
      showToast('No ' + Parts.PARTS[type].name.toLowerCase() + ' left', '#ffb0a0');
      return;
    }
    run.phase = 'aim';
    const a = type === 'spring' ? 0 : type === 'fan' ? 270 : 0;
    run.drag = { type: type, x: x, y: y, a: a, from: -1, ox: 0, oy: 0, valid: false, reason: '', moved: false, sx: x, sy: y };
    run.selected = -1;
    sfx('click');
  }

  function beginDragExisting(i, x, y) {
    const p = run.placed[i];
    run.drag = { type: p.type, x: p.x, y: p.y, a: p.a, from: i, ox: p.x - x, oy: p.y - y, valid: true, reason: '', moved: false, sx: x, sy: y };
  }

  function updateDrag(x, y) {
    const d = run.drag;
    if (Math.abs(x - d.sx) + Math.abs(y - d.sy) > 6)
      d.moved = true;
    d.x = Parts.snap(Math.max(20, Math.min(1260, x + d.ox)));
    d.y = Parts.snap(Math.max(20, Math.min(FIELD_H - 10, y + d.oy)));
    const v = validate({ type: d.type, x: d.x, y: d.y, a: d.a }, d.from);
    d.valid = v.ok && y < BAR_Y;
    d.reason = y >= BAR_Y ? (d.from >= 0 ? 'Drop on the tray to remove' : '') : v.reason;
  }

  function endDrag(x, y) {
    const d = run.drag;
    run.drag = null;
    if (d.from >= 0 && !d.moved) {
      /* a tap on a placed part selects it (a second tap rotates) */
      if (run.selected === d.from && Parts.PARTS[d.type].rotatable)
        rotateSelected(1);
      run.selected = d.from;
      return;
    }
    if (y >= BAR_Y) {
      if (d.from >= 0)
        removePart(d.from);
      return;
    }
    if (!d.valid) {
      sfx('error', { volume: 0.5 });
      if (d.reason)
        showToast(d.reason, '#ffb0a0');
      return;
    }
    const p = { type: d.type, x: d.x, y: d.y, a: d.a };
    if (d.from >= 0)
      run.placed[d.from] = p;
    else
      run.placed.push(p);
    run.selected = d.from >= 0 ? d.from : run.placed.length - 1;
    Sim.setParts(run.att, run.placed);
    Fx.placeBurst(fxWorld, p.x, p.y, '#7ae8ff');
    sfx('drop');
  }

  function rotateSelected(dir) {
    if (!run || run.selected < 0 || !canEdit())
      return;
    const p = run.placed[run.selected];
    if (!Parts.PARTS[p.type].rotatable)
      return;
    for (let k = 1; k <= 24; ++k) {
      const a = Parts.snapAngle(p.a + dir * Parts.ROT_STEP * k);
      if (validate({ type: p.type, x: p.x, y: p.y, a: a }, run.selected).ok) {
        p.a = a;
        Sim.setParts(run.att, run.placed);
        sfx('blip', { pitch: 1.3 });
        return;
      }
    }
    sfx('error', { volume: 0.5 });
  }

  function removePart(i) {
    if (i < 0 || !canEdit())
      return;
    const p = run.placed.splice(i, 1)[0];
    run.selected = -1;
    Sim.setParts(run.att, run.placed);
    Fx.poof(fxWorld, p.x, p.y);
    sfx('whoosh', { volume: 0.5 });
  }

  /* the handles around the selected part: rotate left, rotate right, remove */
  function selectionHandles() {
    if (!run || run.selected < 0 || !canEdit())
      return [];
    const p = run.placed[run.selected];
    const P = Parts.PARTS[p.type];
    const r = Math.max(P.half[0], P.half[1]) + 30;
    const out = [];
    const y = Math.max(40, p.y - r * 0.7);
    if (P.rotatable) {
      out.push({ id: 'rotL', x: p.x - r, y: y, r: 19, action: () => rotateSelected(-1) });
      out.push({ id: 'rotR', x: p.x + r, y: y, r: 19, action: () => rotateSelected(1) });
    }
    out.push({ id: 'del', x: p.x, y: Math.min(FIELD_H - 22, p.y + r * 0.75), r: 17, action: () => removePart(run.selected) });
    return out;
  }

  /* ── aiming ── */

  function aimFromDrag(a) {
    /* slingshot: pull back from where the drag started */
    const dx = a.sx - mouseX, dy = a.sy - mouseY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 6)
      return;
    let ang = Math.atan2(-dy, dx) / DEG;
    const lim = run.level.aim || [Sim.ANGLE_MIN, Sim.ANGLE_MAX];
    if (ang < -90 && lim[1] > 90)
      ang += 360;
    run.aimAngle = Math.max(lim[0], Math.min(lim[1], ang));
    run.aimPower = Math.max(0.02, Math.min(1, len / AIM_MAX_DRAG));
  }

  function aimLimits() {
    return run.level.aim || [Sim.ANGLE_MIN, Sim.ANGLE_MAX];
  }

  function nudgeAim(da, dp) {
    const lim = aimLimits();
    run.aimAngle = Math.max(lim[0], Math.min(lim[1], run.aimAngle + da));
    run.aimPower = Math.max(0.02, Math.min(1, run.aimPower + dp));
  }

  /* predicted flight: a parabola, bending off surfaces with Ricochet Sight */
  const guide = [];
  function computeGuide() {
    guide.length = 0;
    const L = run.level.launcher;
    const d = Sim.launcherDir(run.aimAngle);
    const sp = launchSpeed(run.aimPower);
    let x = L[0] + d[0] * Sim.MUZZLE, y = L[1] + d[1] * Sim.MUZZLE, vx = d[0] * sp, vy = d[1] * sp;
    const g = run.att.world.gy;
    const dt = 1 / 30;
    let bounces = stats.ricochet ? 3 : 0;
    const steps = Math.round(stats.sight / dt);
    for (let i = 0; i < steps; ++i) {
      const nx = x + vx * dt, ny = y + vy * dt + 0.5 * g * dt * dt;
      const dx = nx - x, dy = ny - y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      const hit = Ph.raycast(run.att.world, x, y, dx / len, dy / len, len, Parts.BALL_R);
      if (hit) {
        guide.push(hit.x, hit.y, 1);
        if (!bounces--)
          return;
        const vn = vx * hit.nx + vy * hit.ny;
        const e = 0.55;
        vx -= (1 + e) * vn * hit.nx;
        vy -= (1 + e) * vn * hit.ny;
        x = hit.x + hit.nx * 0.5;
        y = hit.y + hit.ny * 0.5;
        continue;
      }
      x = nx;
      y = ny;
      vy += g * dt;
      guide.push(x, y, 0);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING THE FIELD
     ══════════════════════════════════════════════════════════════════ */

  function bakeLayer() {
    const key = run.level.id + ':' + run.level.targets.join(';') + ':' + canvas.width + 'x' + canvas.height + ':' + viewScale.toFixed(4);
    if (layer && layerKey === key)
      return;
    layerKey = key;
    const v = visibleRect();
    if (!layer)
      layer = document.createElement('canvas');
    layer.width = canvas.width;
    layer.height = canvas.height;
    const g = layer.getContext('2d');
    g.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
    Scene.drawBackdrop(g, run.world, v, viewScale);
    /* push the backdrop back a little so the puzzle reads */
    g.fillStyle = ['rgba(10,14,18,0.22)', 'rgba(236,246,236,0.3)', 'rgba(8,20,36,0.25)', 'rgba(10,4,4,0.25)', 'rgba(4,4,16,0.2)'][run.world];
    g.fillRect(v.x0, v.y0, v.x1 - v.x0, Math.min(FIELD_H, v.y1) - v.y0);
    const statics = run.att.world.bodies.filter(b => b.alive && Art.isStaticArt(b));
    /* drop shadows */
    g.save();
    g.globalAlpha = 0.38;
    g.translate(7, 9);
    for (const b of statics)
      if (b.data.kind !== 'ground')
        drawShadowShape(g, b);
    g.restore();
    for (const b of statics)
      Art.drawBody(g, b, run.world, 0);
  }

  /* a blast mark burned into the baked layer for the rest of the try */
  function scorch(x, y, r) {
    if (!layer)
      return;
    const g = layer.getContext('2d');
    g.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(10,6,4,0.55)');
    rg.addColorStop(0.6, 'rgba(20,10,6,0.25)');
    rg.addColorStop(1, 'rgba(20,10,6,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
  }

  function drawShadowShape(g, b) {
    g.fillStyle = '#000000';
    g.beginPath();
    if (b.circle) {
      g.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    } else {
      const v = b.wv;
      g.moveTo(v[0], v[1]);
      for (let i = 1; i < b.poly.count; ++i)
        g.lineTo(v[i * 2], v[i * 2 + 1]);
      g.closePath();
    }
    g.fill();
  }

  function drawField(dt) {
    bakeLayer();
    const v = visibleRect();
    const sh = shake.update(dt);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, Math.round(sh.x * viewScale), Math.round(sh.y * viewScale));
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX + sh.x * viewScale, viewOffY + sh.y * viewScale);
    Scene.drawLights(ctx, run.world, v, time);
    const world = run.att.world;
    const skin = currentSkin();
    for (const z of world.zones)
      if (z.kind !== 'portal')
        Art.drawZone(ctx, z, run.world, time);
    /* the last shot's ghost trail */
    if (stats.ghostTrail && run.lastPaths.length && run.phase === 'aim')
      drawPath(run.lastPaths[0], 'rgba(255,255,255,0.22)', 2);
    for (const b of world.bodies) {
      if (!b.alive || b.sensor || b.tag === 'ball' || Art.isStaticArt(b))
        continue;
      if (run.drag && run.drag.from >= 0 && b.data && b.data.placedIndex === run.drag.from)
        continue;
      Art.drawBody(ctx, b, run.world, time, skin);
    }
    for (const b of world.bodies)
      if (b.alive && b.tag === 'lava')
        Art.drawBody(ctx, b, run.world, time);
    for (const z of world.zones)
      if (z.kind === 'portal')
        Art.drawZone(ctx, z, run.world, time);
    for (const t of run.att.targets) {
      if (run.mode === 'sandbox' && run.drag && run.drag.target)
        continue;
      Art.drawTarget(ctx, t.x, t.y, t.lit, time, TARGET_COLOR);
    }
    run.att.stars.forEach((s, i) => {
      if (!s.got)
        Art.drawStar(ctx, s.x, s.y, time, i * 1.7);
    });
    /* selection outline */
    if (run.selected >= 0 && canEdit()) {
      const p = run.placed[run.selected];
      const P = Parts.PARTS[p.type];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a * DEG);
      ctx.strokeStyle = 'rgba(122,232,255,' + (0.6 + 0.3 * Math.sin(time * 6)).toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -time * 30;
      ui.roundRectPath(-P.half[0] - 8, -P.half[1] - 8, P.half[0] * 2 + 16, P.half[1] * 2 + 16, 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    /* launcher, aim guide, balls and trails */
    const L = run.level.launcher;
    if (run.phase === 'aim' && !run.drag)
      drawAimGuide();
    Art.drawLauncher(ctx, L[0], L[1], run.aimAngle, run.phase === 'aim' ? run.aimPower : 0, time, run.world, run.recoil);
    if (run.level.aim && run.phase === 'aim')
      drawAimArc(L);
    const shot = run.att.shot;
    if (shot) {
      shot.balls.forEach((b, i) => {
        if (!b.alive)
          return;
        const tr = run.trails[i];
        if (tr && tr.length > 4)
          drawBallTrail(tr);
        if (save.trail !== 'none')
          Fx.trail(fxWorld, save.trail, b.x, b.y, b.vx, b.vy, dt, time);
      });
    }
    for (const b of world.bodies)
      if (b.alive && b.tag === 'ball')
        Art.drawBody(ctx, b, run.world, time, skin);
    if (run.aiming && run.phase === 'aim')
      drawPullBand(run.aiming);
    if (run.blueprint)
      drawBlueprint();
    if (run.drag)
      drawDragGhost();
    fxWorld.draw(ctx, v);
    texts.draw(ctx);
    ctx.restore();
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
  }

  function drawPath(p, color, width) {
    if (!p || p.length < 4)
      return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2)
      ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawBallTrail(tr) {
    const n = tr.length / 2;
    const from = Math.max(0, n - 14);
    ctx.lineCap = 'round';
    for (let i = from + 1; i < n; ++i) {
      const k = (i - from) / (n - from);
      ctx.strokeStyle = 'rgba(255,240,210,' + (0.35 * k).toFixed(3) + ')';
      ctx.lineWidth = 2 + 9 * k;
      ctx.beginPath();
      ctx.moveTo(tr[(i - 1) * 2], tr[(i - 1) * 2 + 1]);
      ctx.lineTo(tr[i * 2], tr[i * 2 + 1]);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  function drawAimGuide() {
    computeGuide();
    const n = guide.length / 3;
    for (let i = 0; i < n; ++i) {
      const x = guide[i * 3], y = guide[i * 3 + 1], hit = guide[i * 3 + 2];
      const k = 1 - i / Math.max(1, n);
      const pulse = 0.75 + 0.25 * Math.sin(time * 8 - i * 0.6);
      if (hit) {
        Art.drawGlow(ctx, x, y, 34, '#ffe066', 0.9);
        ctx.strokeStyle = 'rgba(255,240,180,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * k * pulse).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, 2 + 3.5 * k, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* the slingshot band from where the drag began to the finger */
  function drawPullBand(a) {
    const dx = mouseX - a.sx, dy = mouseY - a.sy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 6)
      return;
    const k = Math.min(1, len / AIM_MAX_DRAG);
    const col = k > 0.85 ? '255,122,58' : k > 0.5 ? '255,216,74' : '122,232,255';
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(mouseX, mouseY);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(' + col + ',0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = time * 40;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a.sx, a.sy, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(' + col + ',0.95)';
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 7 + 5 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAimArc(L) {
    const lim = run.level.aim;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,224,102,0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(L[0], L[1], 58, -lim[1] * DEG, -lim[0] * DEG);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,180,0.8)';
    ctx.lineWidth = 2;
    for (const a of lim) {
      ctx.beginPath();
      ctx.moveTo(L[0] + Math.cos(a * DEG) * 50, L[1] - Math.sin(a * DEG) * 50);
      ctx.lineTo(L[0] + Math.cos(a * DEG) * 66, L[1] - Math.sin(a * DEG) * 66);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDragGhost() {
    const d = run.drag;
    if (d.target) {
      Art.drawTarget(ctx, d.x, d.y, false, time, TARGET_COLOR);
      return;
    }
    ctx.save();
    ctx.globalAlpha = 0.85;
    Art.drawPart(ctx, { type: d.type, x: d.x, y: d.y, a: d.a }, run.world, time);
    ctx.restore();
    const P = Parts.PARTS[d.type];
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.a * DEG);
    ctx.strokeStyle = d.valid ? 'rgba(122,255,170,0.9)' : 'rgba(255,90,90,0.95)';
    ctx.fillStyle = d.valid ? 'rgba(122,255,170,0.12)' : 'rgba(255,60,60,0.18)';
    ctx.lineWidth = 2;
    ui.roundRectPath(-P.half[0] - 4, -P.half[1] - 4, P.half[0] * 2 + 8, P.half[1] * 2 + 8, 6);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    /* snapping grid around the cursor */
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let gx = -60; gx <= 60; gx += 20)
      for (let gy = -60; gy <= 60; gy += 20)
        if (gx * gx + gy * gy < 3700)
          ctx.fillRect(d.x + gx - 1, d.y + gy - 1, 2, 2);
  }

  function drawBlueprint() {
    const sol = SOLUTIONS[run.level.daily ? run.level.baseId : run.level.id];
    if (!sol)
      return;
    const n = run.blueprint >= 2 ? sol.parts.length : Math.min(1, sol.parts.length);
    ctx.save();
    ctx.globalAlpha = 0.45 + 0.15 * Math.sin(time * 4);
    for (let i = 0; i < n; ++i) {
      const q = sol.parts[i];
      Art.drawPart(ctx, { type: q[0], x: q[1], y: q[2], a: q[3] }, run.world, time);
    }
    ctx.restore();
    if (run.blueprint >= 2 && sol.shots.length) {
      ctx.fillStyle = '#bfeaff';
      ctx.textAlign = 'left';
      ui.fitText('Blueprint shot: ' + sol.shots[0][0] + '° at ' + Math.round((sol.shots[0][1] - Sim.MIN_SPEED) / (Sim.BASE_MAX_SPEED * stats.powerMul - Sim.MIN_SPEED) * 100) + '% power',
        run.level.launcher[0] - 40, run.level.launcher[1] - 90, 360, 14, { weight: 'bold', color: '#bfeaff', outline: 'rgba(0,0,0,0.7)' });
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     HUD
     ══════════════════════════════════════════════════════════════════ */

  function trayCards() {
    const types = Parts.PART_ORDER.filter(t => (run.inv[t] || 0) > 0);
    const cw = 104, gap = 10;
    const total = types.length * cw + Math.max(0, types.length - 1) * gap;
    const x0 = Math.max(250, VIEW_W / 2 - total / 2 - 40);
    return types.map((t, i) => ({ type: t, x: x0 + i * (cw + gap), y: BAR_Y + 8, w: cw, h: 64 }));
  }

  function drawHUD() {
    const v = visibleRect();
    /* the tray */
    const ty = BAR_Y;
    ctx.save();
    const lg = ctx.createLinearGradient(0, ty, 0, VIEW_H);
    lg.addColorStop(0, 'rgba(14,26,36,0.92)');
    lg.addColorStop(1, 'rgba(6,12,18,0.96)');
    ctx.fillStyle = lg;
    ctx.fillRect(v.x0, ty, v.x1 - v.x0, v.y1 - ty);
    ctx.fillStyle = 'rgba(232,196,106,0.55)';
    ctx.fillRect(v.x0, ty, v.x1 - v.x0, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(v.x0, ty + 2, v.x1 - v.x0, 2);
    ctx.restore();
    /* launcher readout */
    ui.drawPanel(14, ty + 10, 220, 60, { radius: 10, noStuds: true, accent: run.theme.color });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText((stats.steady ? run.aimAngle.toFixed(1) : Math.round(run.aimAngle)) + '°', 28, ty + 30, 80, 20, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
    ui.fitText('angle', 28, ty + 52, 80, 11, { color: ui.UI.textDim });
    ui.drawMeter(96, ty + 22, 124, 14, run.aimPower, run.aimPower > 0.85 ? '#ff7a3a' : run.aimPower > 0.5 ? '#ffd84a' : '#7ae8ff',
      { label: Math.round(run.aimPower * 100) + '%', labelPx: 10 });
    const extra = run.mode === 'trick' ? 0 : stats.extraBalls;
    ui.fitText(extra ? (extra + 1) + ' balls (M)' : 'power', 96, ty + 52, 124, 11, { color: extra ? '#ffe9a0' : ui.UI.textDim });
    /* part cards */
    const cards = trayCards();
    for (const c of cards) {
      const left = partsLeft(c.type);
      const hot = mouseX >= c.x && mouseX <= c.x + c.w && mouseY >= c.y && mouseY <= c.y + c.h;
      registerHit('card-' + c.type, c.x, c.y, c.w, c.h, null);
      ui.drawPanel(c.x, c.y, c.w, c.h, { radius: 10, noStuds: true, glow: hot && left > 0, accent: left > 0 ? '#7ae8ff' : '#5a6070',
        top: hot ? 'rgba(40,90,110,0.96)' : 'rgba(22,48,62,0.94)', bottom: 'rgba(8,18,26,0.96)' });
      ctx.save();
      if (left <= 0)
        ctx.globalAlpha = 0.35;
      const icon = Art.partIcon(c.type, run.world);
      const k = Math.min((c.w - 20) / icon.w, 34 / icon.h, 1.2);
      ctx.drawImage(icon.c, c.x + c.w / 2 - icon.w * k / 2, c.y + 24 - icon.h * k / 2, icon.w * k, icon.h * k);
      ctx.restore();
      ctx.textAlign = 'center';
      ui.fitText(Parts.PARTS[c.type].name, c.x + c.w / 2, c.y + 50, c.w - 30, 12, { weight: 'bold', color: left > 0 ? '#e4f4ff' : ui.UI.textMute });
      if (run.mode !== 'sandbox')
        ui.drawChip('x' + left, c.x + c.w - 6, c.y - 8, 20, { align: 'right', px: 12, color: left > 0 ? '#ffe066' : ui.UI.textMute });
    }
    if (!cards.length) {
      ctx.textAlign = 'center';
      ui.fitText(run.mode === 'trick' && run.level.rule.noParts ? 'No parts allowed - pure skill' : 'No parts here - aim true', VIEW_W / 2 - 40, ty + 40, 400, 15, { color: ui.UI.textDim, weight: 'bold' });
    }
    /* right side buttons */
    drawSmallButton('reset', 'Reset', 'R', 1052, ty + 14, 104, 52, restartLevel);
    drawSmallButton('pause', 'Menu', 'Esc', 1164, ty + 14, 104, 52, pauseGame);
    /* top chips: level, shots, stars */
    const name = run.mode === 'sandbox' ? 'Sandbox' : run.level.name;
    ui.drawPanel(14, 12, 330, 46, { radius: 12, noStuds: true, accent: run.theme.color });
    ctx.textAlign = 'left';
    const tag = run.mode === 'campaign' ? WORLDS[run.world].name + ' ' + run.level.id.slice(1).replace('-', '-') : run.mode === 'trick' ? 'Trick Shot' : run.mode === 'daily' ? 'Daily ' + localDate() : WORLDS[run.world].name;
    ui.fitText(name, 28, 30, 300, 18, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
    ui.fitText(tag, 28, 49, 300, 11, { color: run.theme.accent });
    if (run.mode !== 'sandbox') {
      const pw = 344;
      const px = VIEW_W - 14 - pw;
      ui.drawPanel(px, 12, pw, 46, { radius: 12, noStuds: true, accent: run.theme.color });
      const shots = run.att.shots;
      ctx.textAlign = 'left';
      ui.fitText('Shots ' + shots + (run.level.par < 99 ? ' / par ' + run.level.par : ''), px + 14, 35, 130, 15, { weight: 'bold', color: shots > run.level.par ? '#ffb0a0' : '#ffffff' });
      const total = run.att.stars.length;
      const got = run.att.stars.filter(s => s.got).length;
      for (let i = 0; i < total; ++i) {
        const s = Art.starSprite();
        ctx.save();
        ctx.globalAlpha = i < got ? 1 : 0.25;
        ctx.drawImage(s.c, px + 154 + i * 28, 20, 28, 28);
        ctx.restore();
      }
      const lit = run.att.targets.filter(t => t.lit).length;
      const ts = Art.targetSprite(TARGET_COLOR, lit === run.att.targets.length);
      ctx.drawImage(ts.c, px + 252, 21, 26, 26);
      ctx.textAlign = 'right';
      ui.fitText(lit + '/' + run.att.targets.length, px + pw - 14, 35, 44, 15, { weight: 'bold', color: lit ? '#ffe066' : ui.UI.textDim });
    }
    if (run.mode === 'trick') {
      ctx.textAlign = 'center';
      ui.drawChip(run.level.trick.desc, VIEW_W / 2, 18, 30, { align: 'center', px: 14, color: '#ffe9a0' });
    }
    /* bullet time meter */
    if (stats.bulletTime && run.phase === 'flight') {
      ui.drawMeter(VIEW_W / 2 - 100, 60, 200, 10, run.bulletLeft / stats.bulletTime, '#8affd0', {});
      ctx.textAlign = 'center';
      ui.fitText('Hold Space: slow motion', VIEW_W / 2, 80, 220, 11, { color: '#bfffe8', outline: 'rgba(0,0,0,0.6)' });
    }
    /* handles of the selected part */
    for (const h of selectionHandles()) {
      registerHit(h.id, h.x - h.r, h.y - h.r, h.r * 2, h.r * 2, h.action);
      const hot = (mouseX - h.x) * (mouseX - h.x) + (mouseY - h.y) * (mouseY - h.y) < h.r * h.r;
      ui.drawPanel(h.x - h.r, h.y - h.r, h.r * 2, h.r * 2, { radius: h.r, noStuds: true, glow: hot, accent: h.id === 'del' ? '#ff6a6a' : '#7ae8ff' });
      drawGlyph(h.id, h.x, h.y, h.r * 0.55, h.id === 'del' ? '#ffb0b0' : '#d8f6ff');
    }
    if (run.phase === 'aim' && run.att.shots === 0 && !run.drag && time % 1 < 0.95 && !run.aiming && run.mode !== 'sandbox') {
      const L = run.level.launcher;
      const k = (time * 0.8) % 1;
      ctx.save();
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.85;
      drawGlyph('hand', L[0] + 80 - k * 60, L[1] - 70 + k * 40, 16, '#ffffff');
      ctx.restore();
      ctx.textAlign = 'left';
      ui.fitText('Drag anywhere to pull back - release to fire', L[0] + 40, L[1] - 120, 380, 13, { weight: 'bold', color: '#ffffff', outline: 'rgba(0,0,0,0.75)' });
    }
    if (run.drag && run.drag.reason && run.drag.moved) {
      ctx.textAlign = 'center';
      ui.drawChip(run.drag.reason, run.drag.x, Math.max(20, run.drag.y - 70), 26, { align: 'center', px: 12, color: '#ffb0a0' });
    }
    if (run.phase === 'intro')
      drawIntroCard();
    if (toast)
      drawToast();
  }

  function drawSmallButton(id, label, key, x, y, w, h, action) {
    const idx = registerHit(id, x, y, w, h, action);
    const hot = isHot(idx, x, y, w, h);
    ui.drawButtonFrame(x, y, w, h, hot, run ? run.theme.color : ui.UI.accent, time);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, x + w / 2, y + h / 2 - 5, w - 20, 16, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
    ui.fitText(key, x + w / 2, y + h / 2 + 13, w - 20, 10, { color: ui.UI.textDim });
  }

  /* small vector glyphs for handles and hints */
  function drawGlyph(name, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, s * 0.28);
    ctx.lineCap = 'round';
    if (name === 'rotL' || name === 'rotR') {
      const d = name === 'rotR' ? 1 : -1;
      ctx.scale(d, 1);
      ctx.beginPath();
      ctx.arc(0, 0, s, Math.PI * 0.9, Math.PI * 2.25);
      ctx.stroke();
      const ax = Math.cos(Math.PI * 2.25) * s, ay = Math.sin(Math.PI * 2.25) * s;
      ctx.beginPath();
      ctx.moveTo(ax + s * 0.5, ay - s * 0.1);
      ctx.lineTo(ax, ay + s * 0.05);
      ctx.lineTo(ax + s * 0.1, ay - s * 0.55);
      ctx.stroke();
    } else if (name === 'del') {
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, -s * 0.7);
      ctx.lineTo(s * 0.7, s * 0.7);
      ctx.moveTo(s * 0.7, -s * 0.7);
      ctx.lineTo(-s * 0.7, s * 0.7);
      ctx.stroke();
    } else if (name === 'hand') {
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, Math.PI * 2);
      ctx.globalAlpha *= 0.4;
      ctx.fill();
      ctx.globalAlpha /= 0.4;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawIntroCard() {
    const k = run.introT;
    const a = k < 0.25 ? k / 0.25 : k > 1.9 ? Math.max(0, (2.2 - k) / 0.3) : 1;
    const slide = k < 0.25 ? (1 - k / 0.25) * 40 : 0;
    ctx.save();
    ctx.globalAlpha = a;
    const w = 640, h = 170, x = VIEW_W / 2 - w / 2, y = 200 - slide;
    ui.drawPanel(x, y, w, h, { accent: run.theme.color, glow: true });
    const label = run.mode === 'campaign' ? WORLDS[run.world].name + '  -  Level ' + (Lv.worldLevels(run.world).indexOf(run.level) + 1) :
      run.mode === 'trick' ? 'Trick Shot' : run.mode === 'daily' ? 'Daily Challenge  ' + localDate() : 'Sandbox';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, VIEW_W / 2, y + 28, w - 40, 14, { weight: 'bold', color: run.theme.accent });
    ui.drawHeadline(run.level.name, VIEW_W / 2, y + 70, w - 60, 44, '#ffffff', run.theme.color);
    ui.drawTextBlock(run.level.tip || '', x + 40, y + 102, w - 80, 40, 15, { align: 'center', color: '#d8e4f0' });
    if (run.mode !== 'sandbox')
      ui.fitText('Par ' + run.level.par + (run.level.stars.length ? '   •   ' + run.level.stars.length + ' stars to grab' : '') + '   •   click to start',
        VIEW_W / 2, y + h - 18, w - 40, 12, { color: ui.UI.textDim });
    ctx.restore();
  }

  function drawToast() {
    toast.t += frameDt;
    if (toast.t > 2.4) {
      toast = null;
      return;
    }
    const k = toast.t;
    const a = k < 0.2 ? k / 0.2 : k > 2 ? (2.4 - k) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = ui.uiFont(18, 'bold');
    const w = Math.min(700, ctx.measureText(toast.text).width + 60);
    const y = state === 'play' ? 584 : 650;
    ui.drawPanel(VIEW_W / 2 - w / 2, y, w, 40, { radius: 18, noStuds: true, accent: toast.color, glow: true });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(toast.text, VIEW_W / 2, y + 21, w - 30, 17, { weight: 'bold', color: toast.color });
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU HELPERS (shared with screens.js)
     ══════════════════════════════════════════════════════════════════ */

  function registerHit(id, x, y, w, h, action, disabled) {
    const index = hitAreas.length;
    hitAreas.push({ id: id, x: x, y: y, w: w, h: h, action: action, disabled: !!disabled });
    return index;
  }

  function isHot(index, x, y, w, h) {
    const hovered = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
    if (hovered && pointerMoved)
      menuCursor = index;
    return hovered || (menuCursor === index && !pointerMoved && state !== 'play');
  }

  const hoverAnim = {};
  function hoverLevel(id, hot) {
    const v = hoverAnim[id] || 0;
    const nv = hot ? Math.min(1, v + frameDt * 8) : Math.max(0, v - frameDt * 5);
    hoverAnim[id] = nv;
    return nv;
  }

  function drawButton(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = registerHit(id, x, y, w, h, opts.action, opts.disabled);
    const hot = isHot(index, x, y, w, h) && !opts.disabled;
    const hv = hoverLevel(id, hot);
    ctx.save();
    if (opts.disabled)
      ctx.globalAlpha *= 0.5;
    if (hv > 0) {
      const sc = 1 + 0.04 * hv;
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(sc, sc);
      ctx.translate(-(x + w / 2), -(y + h / 2));
      Art.drawGlow(ctx, x + w / 2, y + h / 2, w * 1.3, opts.accent || '#4ad0e0', 0.35 * hv);
    }
    ui.drawButtonFrame(x, y, w, h, hot, opts.accent, time);
    let tx = x + w / 2;
    if (opts.icon) {
      opts.icon(x + 36, y + h / 2, Math.min(34, h - 14));
      tx += 18;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, tx, opts.sub ? y + h / 2 - 9 : y + h / 2 + 1, w - (opts.icon ? 96 : 40), opts.px || 20, { weight: 'bold', color: hot ? '#ffffff' : '#e4f0ff', font: ui.TITLE_FONT, outline: 'rgba(0,0,0,0.5)' });
    if (opts.sub)
      ui.fitText(opts.sub, tx, y + h - 14, w - (opts.icon ? 96 : 30), 12, { color: hot ? '#cfeeff' : ui.UI.textDim });
    if (opts.key)
      ui.drawKeycap(opts.key, x + w - 34, y + 7, 10);
    ctx.restore();
  }

  function moveCursor(d) {
    const n = hitAreas.length;
    if (!n)
      return;
    let k = menuCursor;
    for (let i = 0; i < n; ++i) {
      k = (k + d + n) % n;
      if (!hitAreas[k].disabled && hitAreas[k].action)
        break;
    }
    menuCursor = k;
    sfx('click', { volume: 0.4 });
  }

  function activate(item) {
    if (!item || item.disabled || !item.action) {
      sfx('error', { volume: 0.4 });
      return;
    }
    sfx('select');
    item.action();
  }

  function veil(alpha) {
    const v = visibleRect();
    ctx.fillStyle = 'rgba(4,10,18,' + alpha + ')';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  /* ══════════════════════════════════════════════════════════════════
     SCREENS (title, map, tricks, tree, help, pause, results)
     ══════════════════════════════════════════════════════════════════ */

  const G = {
    ctx: ctx, ui: ui, Art: Art, Scene: Scene, Fx: Fx, Lv: Lv, Prog: Prog, Ph: Ph, Parts: Parts, Sim: Sim,
    VIEW_W: VIEW_W, VIEW_H: VIEW_H, fxView: fxView, fxMenu: fxMenu, SOLUTIONS: SOLUTIONS,
    get save() { return save; }, get stats() { return stats; }, get time() { return time; }, get frameDt() { return frameDt; },
    get mouseX() { return mouseX; }, get mouseY() { return mouseY; }, get mouseDown() { return mouseDown; }, get pointerMoved() { return pointerMoved; },
    get state() { return state; }, get run() { return run; }, get results() { return results; }, get viewScale() { return viewScale; },
    visibleRect: visibleRect, registerHit: registerHit, isHot: isHot, drawButton: drawButton, hoverLevel: hoverLevel, veil: veil,
    hitAreas: hitAreas, sfx: sfx, showToast: showToast, writeSave: writeSave, refreshStats: refreshStats, localDate: localDate,
    currentSkin: currentSkin, dailyLevel: dailyLevel, drawField: (dt) => drawField(dt), drawHUD: () => drawHUD(),
    actions: {
      startCampaign: startCampaign, startTrick: startTrick, startDaily: startDaily, startSandbox: startSandbox,
      openMap: (w) => openMap(w), openTricks: () => openTricks(), openTree: (from) => openTree(from), openHelp: (from) => openHelp(from),
      title: () => { run = null; setScreen('title'); }, resume: () => resumeGame(), restart: () => restartLevel(), quit: () => quitToMenu(),
      next: () => nextLevel(), retry: () => { const l = results.level, m = results.mode; results = null; startLevel(m, l, { placed: run ? run.placed : [] }); },
      closeTree: () => closeTree(), closeHelp: () => closeHelp(), setScreen: setScreen
    }
  };
  const Screens = SZ.PhysicsPuzzleScreens.create(G);

  function openMap(world) {
    Screens.openMap(world);
    setScreen('map');
  }

  function openTricks() {
    setScreen('tricks');
  }

  let treeFrom = 'title', helpFrom = 'title';
  function openTree(from) {
    treeFrom = from;
    Screens.openTree();
    Screens.setTreeFromPause(from === 'pause');
    setScreen('tree');
  }

  function closeTree() {
    refreshStats();
    if (run) {
      /* new spare parts and Bullet Time count straight away */
      run.inv = inventoryFor(run.level, run.mode);
      if (run.phase !== 'flight')
        run.bulletLeft = stats.bulletTime;
    }
    if (treeFrom === 'pause' && run) {
      state = 'pause';
    } else if (treeFrom === 'results' && results) {
      state = 'results';
    } else {
      setScreen(treeFrom === 'map' ? 'map' : 'title');
    }
  }

  function openHelp(from) {
    helpFrom = from;
    Screens.openHelp();
    setScreen('help');
  }

  function closeHelp() {
    if (!save.tutorialSeen) {
      save.tutorialSeen = true;
      writeSave();
    }
    if (helpFrom === 'pause' && run)
      state = 'pause';
    else
      setScreen('title');
  }

  function pauseGame() {
    if (state !== 'play' || !run)
      return;
    state = 'pause';
    run.aiming = null;
    run.drag = null;
    menuCursor = 0;
    sfx('click');
    updateWindowTitle();
  }

  function resumeGame() {
    if (!run)
      return;
    state = 'play';
    sfx('click');
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;

  function gameLoop(timestamp) {
    const t0 = performance.now();
    const raw = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.max(0, Math.min(raw, MAX_DT));
    lastTimestamp = timestamp;
    frameDt = dt;
    time += dt;
    beginFrame();
    hitAreas.length = 0;
    const v = visibleRect();

    if (state === 'play' && run) {
      updatePlay(dt);
      if (state === 'play' && run) {
        fxWorld.update(dt * (run.phase === 'flight' || run.phase === 'won' ? timeScale.scale : 1));
        texts.update(dt);
        Fx.ambient(fxWorld, run.world, { x0: 0, y0: 0, x1: VIEW_W, y1: FIELD_H }, dt);
        drawField(dt);
        drawHUD();
      }
    }
    if (state === 'pause' && run) {
      drawField(0);
      drawHUD();
      Screens.drawPause();
    } else if (state === 'results' && results) {
      Screens.drawResults(dt);
    } else if (state === 'title') {
      Screens.drawTitle(dt);
    } else if (state === 'map') {
      Screens.drawMap();
    } else if (state === 'tricks') {
      Screens.drawTricks();
    } else if (state === 'tree') {
      Screens.drawTree();
    } else if (state === 'help') {
      Screens.drawHelp();
    }
    if (state !== 'play' && toast)
      drawToast();
    fxView.update(dt);
    fxView.draw(ctx);
    flash.update(dt);
    flash.draw(ctx, v);
    drawFade(dt, v);
    updateStatusBar();
    frameMs = performance.now() - t0;
    frameMsAvg += (frameMs - frameMsAvg) * 0.05;
    requestAnimationFrame(gameLoop);
  }

  function drawFade(dt, v) {
    if (fade <= 0)
      return;
    ctx.fillStyle = 'rgba(4,10,18,' + Math.min(1, fade).toFixed(3) + ')';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    fade = Math.max(0, fade - dt * FADE_RATE);
  }

  const STATE_NAMES = { title: 'Title', map: 'World Map', tricks: 'Trick Shots', tree: 'Tech Tree', help: 'How to Play', play: 'Playing', pause: 'Paused', results: 'Results' };
  let statusCache = '';

  function updateStatusBar() {
    const lvl = run ? run.level.name : STATE_NAMES[state] || '--';
    const shots = run && run.att ? run.att.shots + (run.level.par < 99 ? ' / par ' + run.level.par : '') : '--';
    const stars = Prog.totalStars(save, Lv.LEVELS) + ' / ' + Lv.LEVELS.length * 3;
    const key = lvl + '|' + shots + '|' + stars + '|' + save.coins;
    if (key === statusCache)
      return;
    statusCache = key;
    statusLevel.textContent = 'Level: ' + lvl;
    statusShots.textContent = 'Shots: ' + shots;
    statusStars.textContent = 'Stars: ' + stars;
    if (statusCoins)
      statusCoins.textContent = 'Coins: ' + save.coins;
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  const held = new Set();
  let touchSlow = false;

  function back() {
    switch (state) {
      case 'play':
        if (run && run.drag) { run.drag = null; return; }
        if (run && run.selected >= 0) { run.selected = -1; return; }
        pauseGame();
        break;
      case 'pause': resumeGame(); break;
      case 'map': setScreen('title'); break;
      case 'tricks': setScreen('title'); break;
      case 'tree': closeTree(); break;
      case 'help': closeHelp(); break;
      case 'results': quitToMenu(); break;
    }
  }

  function playKey(e) {
    const code = e.code;
    if (run.phase === 'intro') {
      if (code === 'Enter' || code === 'Space') {
        run.phase = 'aim';
        e.preventDefault();
        return;
      }
    }
    if (run.phase === 'won')
      return;
    const fine = e.shiftKey && stats.steady;
    switch (code) {
      case 'ArrowLeft': case 'KeyA':
        if (run.phase === 'aim') nudgeAim(fine ? 0.1 : 1, 0);
        break;
      case 'ArrowRight': case 'KeyD':
        if (run.phase === 'aim') nudgeAim(fine ? -0.1 : -1, 0);
        break;
      case 'ArrowUp': case 'KeyW':
        if (run.phase === 'aim') nudgeAim(0, fine ? 0.002 : 0.02);
        break;
      case 'ArrowDown':
        if (run.phase === 'aim') nudgeAim(0, fine ? -0.002 : -0.02);
        break;
      case 'Space': case 'Enter':
        if (!e.repeat && run.phase === 'aim') fire();
        break;
      case 'KeyQ':
        rotateSelected(-1);
        break;
      case 'KeyE':
        rotateSelected(1);
        break;
      case 'Delete': case 'Backspace':
        removePart(run.selected);
        break;
      case 'Tab':
        if (run.placed.length && canEdit()) {
          run.selected = (run.selected + 1) % run.placed.length;
          sfx('click');
        }
        break;
      case 'KeyR':
        if (!e.repeat) restartLevel();
        break;
      case 'KeyB':
        if (stats.blueprint && run.mode !== 'sandbox') {
          run.blueprint = run.blueprint ? 0 : stats.blueprint;
          sfx('blip');
        } else if (!stats.blueprint) {
          showToast('Buy Blueprint in the Tech Tree (Parts) for hints', '#bfeaff');
        }
        break;
      case 'KeyM':
        if (stats.multiOwned) {
          save.multiOn = !save.multiOn;
          writeSave();
          refreshStats();
          showToast(save.multiOn ? 'Twin Shot on' : 'Twin Shot off', '#ffe9a0');
        }
        break;
      case 'KeyH':
        pauseGame();
        openHelp('pause');
        break;
      case 'KeyT':
        pauseGame();
        openTree('pause');
        break;
      default:
        if (/^Digit[1-9]$/.test(code) && canEdit()) {
          const cards = trayCards();
          const c = cards[Number(code.charAt(5)) - 1];
          if (c) {
            beginDragNew(c.type, 640, 300);
            if (run.drag) {
              updateDrag(640, 300);
              endDrag(640, 300);
            }
          }
        }
        return;
    }
    e.preventDefault();
  }

  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))
      return;
    if (document.querySelector('.dialog-overlay.visible'))
      return;
    const code = e.code;
    held.add(code);
    if (code === 'F2') {
      e.preventDefault();
      run = null;
      setScreen('title');
      return;
    }
    if (code === 'Escape' || (code === 'KeyP' && (state === 'play' || state === 'pause'))) {
      e.preventDefault();
      if (!e.repeat)
        back();
      return;
    }
    if (state === 'play' && run) {
      playKey(e);
      return;
    }
    if (e.repeat && (code === 'Enter' || code === 'Space'))
      return;
    if (Screens.key(e))
      return;
    if (state === 'pause') {
      if (code === 'KeyR') { restartLevel(); return; }
      if (code === 'KeyT') { openTree('pause'); return; }
      if (code === 'KeyH') { openHelp('pause'); return; }
      if (code === 'KeyQ') { quitToMenu(); return; }
    }
    if (state === 'results') {
      if (code === 'KeyR') { G.actions.retry(); return; }
      if (code === 'KeyT') { openTree('results'); return; }
      if (code === 'KeyN') { nextLevel(); return; }
    }
    if (state === 'title' && code === 'KeyH') {
      openHelp('title');
      return;
    }
    if (state === 'title' && code === 'KeyT') {
      openTree('title');
      return;
    }
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'ArrowLeft' || code === 'KeyA') {
      moveCursor(-1);
      pointerMoved = false;
      e.preventDefault();
    } else if (code === 'ArrowDown' || code === 'KeyS' || code === 'ArrowRight' || code === 'KeyD' || code === 'Tab') {
      moveCursor(1);
      pointerMoved = false;
      e.preventDefault();
    } else if (code === 'Enter' || code === 'Space') {
      e.preventDefault();
      activate(hitAreas[menuCursor]);
    }
  });

  document.addEventListener('keyup', (e) => {
    held.delete(e.code);
  });

  window.addEventListener('blur', () => {
    held.clear();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointerToView(e);
    if (Math.abs(p.x - mouseX) > 0.5 || Math.abs(p.y - mouseY) > 0.5)
      pointerMoved = true;
    mouseX = p.x;
    mouseY = p.y;
    if (state !== 'play' || !run)
      return;
    if (run.drag) {
      if (run.drag.target) {
        run.drag.x = Parts.snap(Math.max(40, Math.min(1240, p.x)));
        run.drag.y = Parts.snap(Math.max(40, Math.min(580, p.y)));
      } else {
        updateDrag(p.x, p.y);
      }
    } else if (run.aiming) {
      aimFromDrag(run.aiming);
    }
  });

  canvas.addEventListener('pointerleave', () => {
    if (!mouseDown) {
      mouseX = -1;
      mouseY = -1;
    }
  });

  function hitAt(p) {
    for (let i = hitAreas.length - 1; i >= 0; --i) {
      const h = hitAreas[i];
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h)
        return h;
    }
    return null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const p = pointerToView(e);
    mouseX = p.x;
    mouseY = p.y;
    mouseDown = true;
    pointerMoved = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    if (state !== 'play' || !run) {
      const h = hitAt(p);
      if (h) {
        menuCursor = hitAreas.indexOf(h);
        if (Screens.pointerDown(h, p))
          return;
        activate(h);
      } else {
        Screens.pointerDown(null, p);
      }
      return;
    }
    playPointerDown(p, e);
  });

  function playPointerDown(p, e) {
    if (run.phase === 'intro') {
      run.phase = 'aim';
      return;
    }
    if (run.phase === 'won')
      return;
    const h = hitAt(p);
    if (h && h.id.indexOf('card-') === 0) {
      beginDragNew(h.id.slice(5), p.x, p.y);
      if (run.drag)
        updateDrag(p.x, p.y);
      return;
    }
    if (h && h.action) {
      activate(h);
      return;
    }
    if (p.y >= BAR_Y)
      return;
    if (run.phase === 'flight') {
      /* touch: hold anywhere for bullet time */
      touchSlow = e.pointerType === 'touch';
      return;
    }
    if (run.mode === 'sandbox') {
      const t = run.att.targets[0];
      if (t && Math.hypot(p.x - t.x, p.y - t.y) < 34) {
        run.drag = { target: true, x: t.x, y: t.y };
        return;
      }
    }
    const i = partAt(p.x, p.y);
    if (i >= 0 && canEdit()) {
      beginDragExisting(i, p.x, p.y);
      return;
    }
    run.selected = -1;
    run.aiming = { sx: p.x, sy: p.y };
  }

  window.addEventListener('pointerup', (e) => {
    mouseDown = false;
    touchSlow = false;
    if (state !== 'play' || !run)
      return;
    const p = pointerToView(e);
    if (run.drag) {
      if (run.drag.target) {
        const d = run.drag;
        run.drag = null;
        run.level = Object.assign({}, run.level, { targets: [[d.x, d.y]] });
        rebuildAttempt();
        run.phase = 'aim';
        sfx('drop');
        return;
      }
      endDrag(p.x, p.y);
      return;
    }
    if (run.aiming) {
      const a = run.aiming;
      run.aiming = null;
      if (Math.hypot(p.x - a.sx, p.y - a.sy) > 14 && run.phase === 'aim')
        fire();
    }
  });

  window.addEventListener('pointercancel', () => {
    mouseDown = false;
    touchSlow = false;
    if (run) {
      run.aiming = null;
      run.drag = null;
    }
  });

  /* ══════════════════════════════════════════════════════════════════
     MENU BAR & OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        run = null;
        setScreen('title');
        break;
      case 'pause':
        if (state === 'play') pauseGame();
        else if (state === 'pause') resumeGame();
        break;
      case 'restart':
        if (run) { if (state === 'pause') resumeGame(); restartLevel(); }
        break;
      case 'high-scores':
        if (state === 'play') pauseGame();
        renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            save = Prog.defaultSave();
            save.tutorialSeen = true;
            writeSave();
            refreshStats();
            renderHighScores();
            run = null;
            setScreen('title');
          }
        });
        break;
      case 'tech-tree':
        if (state === 'play') pauseGame();
        openTree(state === 'pause' ? 'pause' : 'title');
        break;
      case 'tutorial':
        if (state === 'play') pauseGame();
        openHelp(state === 'pause' ? 'pause' : 'title');
        break;
      case 'controls':
        if (state === 'play') pauseGame();
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        if (state === 'play') pauseGame();
        SZ.Dialog.show('dlg-about');
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  function updateWindowTitle() {
    const title = run && (state === 'play' || state === 'pause') ? 'Physics Puzzle - ' + run.level.name : 'Physics Puzzle';
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  function handleResize() {
    setupCanvas();
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        handleResize();
      else if (msg === 'WM_THEMECHANGED')
        setupCanvas();
    });
  }
  window.addEventListener('resize', handleResize);
  if (window.ResizeObserver)
    new ResizeObserver(handleResize).observe(canvas);

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();
  new SZ.MenuBar({ onAction: handleAction });

  loadSave();
  refreshStats();
  setupCanvas();
  SZ.GameAudio.attachMuteButton();
  SZ.GameAutoPause.attach({
    isRunning: () => state === 'play',
    pause: pauseGame
  });

  document.body.tabIndex = -1;
  setScreen('title');
  if (!save.tutorialSeen)
    openHelp('title');
  updateWindowTitle();
  requestAnimationFrame(gameLoop);
})();
