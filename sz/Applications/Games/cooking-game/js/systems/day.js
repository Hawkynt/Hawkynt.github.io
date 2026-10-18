;(function() {
  'use strict';

  /* A day from start to end: resetting every day field of G, pausing and
     resuming, the per-frame simulation step of a running day (venue
     rotation, spawning, all systems, tension), the day-end check, the
     result and the star pops. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { VIEW_W, STATE_PLAYING, STATE_PAUSED, STATE_DAY_OVER, ENDLESS_PHASE, WAITER_DELAY } = NS.C;
  const { SECOND_SLOT } = NS.Tree;
  const { ctx, ui } = NS.view;
  const { fx, sfx } = NS.juice;
  const { treeLevel, saveDayResult, saveHighScores } = NS.persist;
  const { dateKey, chefSpotX, spawnLimit } = NS.rules;
  const { updateWindowTitle, updateStatus } = NS.status;
  const { coachHoldsSpawn, updateCoach } = NS.coach;
  const { spawnCustomer, updateCustomers } = NS.customers;
  const { updateStations } = NS.stations;
  const { updateFlying } = NS.serving;
  const { updateChef, updateWaiter } = NS.staff;

  let dayTime = 0, spawnTimer = 0;

  /* paint the step verdicts and combo banners into the headline cache once,
     so the first PERFECT! of a session costs no more than the hundredth */
  let headlinesWarm = false;

  function prewarmHeadlines() {
    if (headlinesWarm) return;
    headlinesWarm = true;
    ctx.save();
    ctx.globalAlpha = 0;
    const verdicts = [['PERFECT!', '#ffd23f', 22], ['Oops!', '#f55', 20], ['Oops!', '#f55', 18], ['Good', '#cfd6e4', 14]];
    for (const v of verdicts)
      ui.drawHeadline(v[0], 0, 0, 400, Math.round(v[2] * 1.25), v[1], v[1] === '#ffd23f' ? '#ff7a1a' : undefined);
    for (const n of [3, 6, 10])
      ui.drawHeadline('COMBO ×' + n + '!', 0, 0, 640, 64, '#ffd23f', '#ff5a1a');
    ctx.restore();
  }

  function startDay(dayMode, index) {
    prewarmHeadlines();
    G.mode = dayMode && typeof dayMode === 'object' ? G.mode : dayMode;
    const dayObj = dayMode && typeof dayMode === 'object'
      ? dayMode
      : (G.mode === 'endless' || G.mode === 'daily' ? SZ.KitchenData.endlessDay(index) : SZ.KitchenData.CAREER[index]);
    G.dayIndex = index;
    G.dayInfo = dayObj;
    G.location = SZ.KitchenData.locationById(G.dayInfo.location);
    G.scene = SZ.KitchenScene.create(G.location.theme);
    G.stations = {};
    for (const id of SZ.KitchenData.STATION_ORDER) {
      const slots = [{ ticket: null, progress: 0, state: 'idle', fxT: 0, chopF: -1 }];
      if (SECOND_SLOT[id] && treeLevel(SECOND_SLOT[id]) > 0)
        slots.push({ ticket: null, progress: 0, state: 'idle', fxT: 0, chopF: -1 });
      G.stations[id] = { id, slots };
    }
    G.customers = [];
    G.tickets = [];
    G.pass = [];
    G.flying = [];
    G.coins = [];
    G.earned = 0;
    G.served = 0;
    G.walkouts = 0;
    G.combo = 0;
    G.bestCombo = 0;
    dayTime = 0;
    spawnTimer = 1;             // first guest after one second
    G.spawned = 0;
    G.recent = [];
    G.hasCritic = false;
    G.ticketSeq = 0;
    G.dayResult = null;
    G.ruinedServed = 0;
    G.perfectServed = 0;
    G.rushTimer = 0;
    G.rushUsed = false;
    G.rescueUsed = false;
    G.endlessPhase = 0;
    G.sceneFade = 0;
    G.waiter = null;
    G.waiterTimer = WAITER_DELAY;
    G.waiterLook = SZ.PeopleArt.randomLook(Math.random, 'regular');
    G.waiterLook.shirt = '#23272e';
    G.arcs = [];
    G.pops = [];
    G.rings = [];
    G.earnedShown = 0;
    G.meterTick = 0;
    G.goalsHit = 0;
    G.comboBanner = null;
    G.edgeGlow = 0;
    G.tension = 0;
    G.dayOverT = 0;
    G.dayIntro = 2.2;
    G.starPopped = 0;
    G.carpet = null;
    G.coach = G.mode === 'career' && index === 0 && !G.save.coached ? { step: 1, ticket: null, t: 0, hideT: 0 } : null;
    G.coachSkip = null;
    G.fade = 1;
    G.dailyDate = dateKey(new Date());
    G.rand = G.mode === 'daily' ? SZ.KitchenData.rng(SZ.KitchenData.dailySeed(new Date())) : Math.random;
    G.chefX = chefSpotX(1);
    G.chefTargetX = G.chefX;
    G.chefFacing = -1;
    G.chefPose = 'idle';
    G.chefTimer = 0;
    G.hudBump = 0;
    G.trashWobble = 0;
    G.hitFlash = null;
    fx.clear();
    G.state = STATE_PLAYING;
    sfx('select');
    updateWindowTitle();
    updateStatus();
  }

  function checkDayEnd() {
    if (G.mode === 'career') {
      if (G.spawned < spawnLimit() || G.customers.length > 0) return;
    } else {
      if (G.walkouts >= 3 || G.ruinedServed >= 3) { endDay(); return; }
      if (G.mode === 'daily') {
        if (G.spawned < spawnLimit() || G.customers.length > 0) return;
      } else {
        return;                       // Endless Rush only stops on failures
      }
    }
    endDay();
  }

  function endDay() {
    const newBest = G.mode === 'endless' ? G.earned > G.save.best.endless
      : G.mode === 'daily' ? (G.save.best.daily.date !== G.dailyDate || G.earned > G.save.best.daily.earned)
      : false;
    const stars = G.mode === 'career' ? SZ.KitchenData.starsFor(G.dayInfo, G.earned) : 0;
    /* a career day is won with at least one star; Endless Rush and the
       Daily Special always end on failures or the last guest, so they are
       won by setting a new best — the sound and the results panel both
       read this one flag */
    const won = G.mode === 'career' ? stars >= 1 : newBest;
    G.dayResult = {
      earned: G.earned, served: G.served, walkouts: G.walkouts, ruined: G.ruinedServed, newBest, stars, won
    };
    G.state = STATE_DAY_OVER;
    G.dayOverT = 0;
    G.starPopped = 0;
    G.fade = 1;
    if (G.coach) {
      G.coach = null;
      G.save.coached = true;
    }
    saveDayResult();
    saveHighScores();
    sfx(won ? 'win' : 'lose');
    updateWindowTitle();
    updateStatus();
  }

  /* Pausing and resuming a running day — the one path shared by Escape,
     the Game > Pause menu entry, the pause panel's Resume button and the
     auto-pause: the pause panel opens with Resume under the cursor and the
     title and status bar follow the state. */
  function pauseDay() {
    if (G.state !== STATE_PLAYING) return;
    G.state = STATE_PAUSED;
    G.menuCursor = 0;
    updateWindowTitle();
    updateStatus();
  }

  function resumeDay() {
    if (G.state !== STATE_PAUSED) return;
    G.state = STATE_PLAYING;
    updateWindowTitle();
    updateStatus();
  }

  function togglePause() {
    if (G.state === STATE_PLAYING) pauseDay();
    else if (G.state === STATE_PAUSED) resumeDay();
  }

  /* One simulated step of a running day: the venue rotation of the
     challenge modes, guest spawning, every system, the rush tension and the
     day-end check. */
  function updatePlaying(dt) {
    dayTime += dt;
    if (G.rushTimer > 0) G.rushTimer = Math.max(0, G.rushTimer - dt);
    if (G.sceneFade > 0) G.sceneFade = Math.max(0, G.sceneFade - dt);
    /* Endless Rush and Daily Special: every eight guests the venue rotates
       and the clock tightens, with a fade into the new room. */
    if (G.mode === 'endless' || G.mode === 'daily') {
      const phase = Math.floor(G.served / ENDLESS_PHASE);
      if (phase !== G.endlessPhase) {
        G.endlessPhase = phase;
        G.dayIndex = phase;
        G.dayInfo = SZ.KitchenData.endlessDay(phase);
        G.location = SZ.KitchenData.locationById(G.dayInfo.location);
        G.scene = SZ.KitchenScene.create(G.location.theme);
        G.sceneFade = 0.6;
        fx.text(VIEW_W / 2, 170, G.location.name, { color: G.location.color, size: 36, life: 1.6 });
        updateStatus();
      }
    }
    if (G.spawned < spawnLimit() && !coachHoldsSpawn()) {
      spawnTimer -= dt;
      if (spawnTimer <= 0 && spawnCustomer())
        spawnTimer = G.dayInfo.spawnEvery;
    }
    updateCustomers(dt);
    updateStations(dt);
    updateFlying(dt);
    updateWaiter(dt);
    updateChef(dt);
    updateCoach(dt);
    /* rush moments: a rush day or a full counter of waiting guests */
    let waiting = 0;
    for (const c of G.customers)
      if (c.state === 'waiting') ++waiting;
    const tense = G.dayInfo.special === 'rush' || waiting >= 3;
    G.tension = tense ? Math.min(1, G.tension + dt * 1.5) : Math.max(0, G.tension - dt * 1.5);
    checkDayEnd();
  }

  /* The day-end panel: stars pop one after another. */
  function updateDayOver(dt) {
    G.dayOverT += dt;
    /* stars pop one after another with rising coin sounds; three stars
       bring confetti */
    while (G.dayResult && G.starPopped < G.dayResult.stars && G.dayOverT >= 0.35 + G.starPopped * 0.35) {
      if (G.starPopped === 2 && G.dayResult.stars === 3) {
        fx.emit('confetti', VIEW_W / 2 - 200, 260, 40, { speed: 520, angle: -Math.PI / 2 + 0.3, spread: 1.4 });
        fx.emit('confetti', VIEW_W / 2 + 200, 260, 40, { speed: 520, angle: -Math.PI / 2 - 0.3, spread: 1.4 });
      }
      sfx('coin', { pitch: 1 + G.starPopped * 0.2, volume: 0.7 });
      ++G.starPopped;
    }
  }

  NS.day = { startDay, updatePlaying, updateDayOver, pauseDay, resumeDay, togglePause };

})();
