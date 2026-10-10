;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const VIEW_W = 1280;
  const VIEW_H = 720;
  const MAX_DT = 0.05;

  /* ── Game states: five menu screens plus the three play states ── */
  const STATE_TITLE = 'title';
  const STATE_CAREER = 'career';
  const STATE_UPGRADES = 'upgrades';
  const STATE_RECIPES = 'recipes';
  const STATE_HELP = 'help';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DAY_OVER = 'DAY_OVER';
  const MENU_SCREENS = [STATE_TITLE, STATE_CAREER, STATE_UPGRADES, STATE_RECIPES, STATE_HELP];

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-cooking-game';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_SAVE = STORAGE_PREFIX + '-v2';
  const MAX_HIGH_SCORES = 10;

  /* ── Play view layout (native 1280 x 720, matching scene-art's room) ── */
  const SEAT_X0 = 180, SEAT_X1 = 1100, SEAT_Y = 330;
  const PASS_MAX = 4, PASS_X0 = 300, PASS_X1 = 980, PASS_Y = 360;
  const STATION_X0 = 40, STATION_STEP = 245, STATION_Y = 520, STATION_W = 150, STATION_H = 120;
  const BAR_Y = 652, BAR_H = 12;
  const CHEF_Y = 704;
  const TRASH = { x: 1042, y: 374, r: 30 };
  const RAIL_X0 = 52, RAIL_Y = 452, RAIL_W = 120, RAIL_H = 86, RAIL_GAP = 12, RAIL_MAX = 9;
  const BUBBLE_DY = 150;          // order bubble above a seated guest
  const WALK_SPEED = 140;         // px/s on the way in and out
  const BURN_AT = 1.25;           // a step self-burns past this progress
  const EAT_TIME = 2;             // seconds a served guest enjoys the dish
  const FLY_TIME = 0.35;          // arc of a dish travelling to a guest
  const ARC_TIME = 0.3;           // arc of a finished dish travelling to the pass
  const COIN_TIME = 0.6;          // arc of a tip coin travelling to the HUD
  const COIN_MAX = 40;            // flying coins on screen at once
  const RING_MAX = 24;            // expanding rings on screen at once

  /* HUD panel and the coin target inside it (drawHUD, drawCoins, goal bursts) */
  const HUD_PX = 940, HUD_PY = 8, HUD_PW = 332, HUD_PH = 116;
  const COIN_TX = 1106, COIN_TY = 78;

  /* ── modes & powerups ── */
  const ENDLESS_PHASE = 8;        // guests served per Endless Rush step
  const DAILY_CUSTOMERS = 20;     // guests in one Daily Special
  const RUSH_TIME = 10;           // seconds the Rush Hour Bell lasts
  const WAITER_DELAY = 0.8;       // seconds before the waiter picks a dish up
  const WAITER_HOME = 640;        // where the waiter waits between runs
  const WAITER_Y = 430;           // the waiter walks in front of the counter
  const BELL = { x: 1246, y: 96, r: 15 };

  /* ══════════════════════════════════════════════════════════════════
     KITCHEN UPGRADE TREE — five branches, seventeen upgrades
     ══════════════════════════════════════════════════════════════════ */

  const TREE_BRANCHES = {
    stations: { name: 'Stations', color: '#ff7a3a' },
    gear: { name: 'Gear', color: '#3ab4ff' },
    service: { name: 'Service', color: '#6fe08a' },
    charm: { name: 'Charm', color: '#ffd23f' },
    pantry: { name: 'Pantry', color: '#c04cff' }
  };
  const TREE = [
    { id: 's_grill2', branch: 'stations', name: 'Second Grill', desc: 'Grill two things at once', costs: [300], req: [] },
    { id: 's_stove2', branch: 'stations', name: 'Second Burner', desc: 'Two pots on the stove', costs: [350], req: [] },
    { id: 's_board2', branch: 'stations', name: 'Prep Helper', desc: 'A second prep board', costs: [400], req: [['s_grill2', 1]] },
    { id: 's_oven2', branch: 'stations', name: 'Double Oven', desc: 'Bake two dishes at once', costs: [650], req: [['s_stove2', 1]] },
    { id: 'g_heat', branch: 'gear', name: 'Hot Burners', desc: 'Cooking 10% faster per level', costs: [150, 320, 650], req: [] },
    { id: 'g_timer', branch: 'gear', name: 'Precision Timers', desc: 'Perfect zones 15% wider per level', costs: [200, 450], req: [] },
    { id: 'g_pan', branch: 'gear', name: 'Non-stick Pans', desc: 'Food burns 40% later', costs: [380], req: [['g_heat', 1]] },
    { id: 'v_seats', branch: 'service', name: 'Comfy Seats', desc: 'Customers wait 12% longer per level', costs: [150, 320, 650], req: [] },
    { id: 'v_table', branch: 'service', name: 'Extra Stool', desc: 'One more seat at the counter', costs: [800], req: [['v_seats', 2]] },
    { id: 'v_waiter', branch: 'service', name: 'Waiter', desc: 'Finished dishes are served automatically', costs: [1200], req: [['v_seats', 1]] },
    { id: 'c_tips', branch: 'charm', name: 'Charm School', desc: '+10% tips per level', costs: [200, 450, 900], req: [] },
    { id: 'c_combo', branch: 'charm', name: 'Showmanship', desc: 'Combo bonus grows twice as fast', costs: [600], req: [['c_tips', 1]] },
    { id: 'c_decor', branch: 'charm', name: 'Fancy Decor', desc: 'VIPs and critics visit more often', costs: [900], req: [['c_tips', 2]] },
    { id: 'p_pass', branch: 'pantry', name: 'Warming Shelf', desc: 'Two more places on the pass', costs: [250], req: [] },
    { id: 'p_prep', branch: 'pantry', name: 'Pre-chopped', desc: 'Prep and plating steps 30% faster', costs: [300], req: [] },
    { id: 'p_rescue', branch: 'pantry', name: 'Second Chance', desc: 'Once per day a burning step is saved as good', costs: [700], req: [['p_prep', 1]] },
    { id: 'p_rush', branch: 'pantry', name: 'Rush Hour Bell', desc: 'Press B once per day: all stations work 50% faster for 10 s', costs: [1000], req: [['p_pass', 1], ['g_heat', 1]] }
  ];
  const TREE_INDEX = {};
  for (const node of TREE)
    TREE_INDEX[node.id] = node;
  const TREE_BRANCH_LIST = Object.keys(TREE_BRANCHES).map(id => ({ id: id, name: TREE_BRANCHES[id].name, color: TREE_BRANCHES[id].color }));

  /* Card grid of the Kitchen screen */
  const TREE_CARD_W = 300, TREE_CARD_H = 110, TREE_COL_GAP = 48, TREE_ROW_GAP = 24;

  /* Which upgrade gives a station its second slot. */
  const SECOND_SLOT = { grill: 's_grill2', stove: 's_stove2', board: 's_board2', oven: 's_oven2' };

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const User32 = SZ.Dlls?.User32;
  const ui = SZ.KitchenUI.create(ctx);

  let viewScale = 1, viewOffX = 0, viewOffY = 0, dpr = 1;      // backing-store mapping

  function setupCanvas() {
    const cssW = Math.max(1, canvas.clientWidth), cssH = Math.max(1, canvas.clientHeight);
    const fit = Math.min(cssW / VIEW_W, cssH / VIEW_H);
    dpr = Math.max(0.5, Math.min(window.devicePixelRatio || 1, 1.5 / Math.max(fit, 0.01)));
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    viewScale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    viewOffX = Math.round((canvas.width - VIEW_W * viewScale) / 2);
    viewOffY = Math.round((canvas.height - VIEW_H * viewScale) / 2);
  }

  /* Visible logical area including the letterbox bars */
  function visibleRect() {
    return { x0: -viewOffX / viewScale, y0: -viewOffY / viewScale, x1: (canvas.width - viewOffX) / viewScale, y1: (canvas.height - viewOffY) / viewScale };
  }

  /* Start of every frame: clear, then logical 1280 x 720 coordinates */
  function beginFrame() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#120c08';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(viewScale, 0, 0, viewScale, viewOffX, viewOffY);
  }

  /* Pointer event -> logical 1280 x 720 coordinates */
  function pointerToView(e) {
    const rect = canvas.getBoundingClientRect();
    const d = canvas.width / Math.max(1, rect.width);
    return { x: ((e.clientX - rect.left) * d - viewOffX) / viewScale, y: ((e.clientY - rect.top) * d - viewOffY) / viewScale };
  }

  /* ══════════════════════════════════════════════════════════════════
     VISUAL EFFECTS
     ══════════════════════════════════════════════════════════════════ */

  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── sound gate ──
     Every effect goes through sfx: the same name never fires more than
     once per 40 ms, so chopping, coin showers and station calls stay a
     rhythm instead of a wall of noise. The shared mute switch in
     SZ.GameAudio keeps working behind it. */
  const SFX_GAP_MS = 40;
  const sfxLast = new Map();

  function sfx(name, opts) {
    const now = performance.now();
    const last = sfxLast.get(name);
    if (last !== undefined && now - last < SFX_GAP_MS)
      return;
    sfxLast.set(name, now);
    SZ.GameAudio.play(name, opts);
  }

  /* ══════════════════════════════════════════════════════════════════
     DAY SESSION STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = STATE_TITLE;
  let lastTimestamp = 0;
  let animT = 0;

  /* ── menu screen state ── */
  let hitAreas = [], menuCursor = 0, mouseX = -1, mouseY = -1;
  let prevScreen = STATE_TITLE, helpPage = 0, helpFrom = STATE_TITLE;
  let treeBranch = 0, treeSelected = null, treeLayout = null, treeBuyFlash = null;
  let menuFade = 0.5;
  const menuScenes = {};
  const titleLooks = [
    SZ.PeopleArt.randomLook(Math.random, 'regular'),
    SZ.PeopleArt.randomLook(Math.random, 'kid'),
    SZ.PeopleArt.randomLook(Math.random, 'business')
  ];

  let dayInfo, location, scene, customers = [], tickets = [], stations = {}, pass = [], earned = 0, served = 0, walkouts = 0, combo = 0, dayTime = 0, spawnTimer = 0, spawned = 0, recent = [], rand = Math.random, mode = 'career', dayIndex = 0;
  let flying = [];              // dishes arcing to a guest
  let coins = [];               // coins flying to the earnings HUD
  let bestCombo = 0;
  let ticketSeq = 0;
  let hasCritic = false;
  let dayResult = null;
  let chefX = VIEW_W / 2, chefTargetX = VIEW_W / 2, chefPose = 'idle', chefTimer = 0;
  let ruinedServed = 0;         // dishes served in this run that were ruined
  let perfectServed = 0;        // dishes served in this run that were perfect
  let rushTimer = 0;            // seconds left on the Rush Hour Bell
  let rushUsed = false;         // the bell rings once per day
  let rescueUsed = false;       // Second Chance fires once per day
  let endlessPhase = 0;         // current Endless Rush / Daily step (served / 8)
  let sceneFade = 0;            // fade-in seconds after a venue switch
  let dailyDate = '';           // date key of the running Daily Special
  let waiter = null;            // { x, facing, state, target, dish } while fetching
  let waiterTimer = WAITER_DELAY;
  let waiterLook = null;

  /* ── juice: flights, pops, rings and screen moods ── */
  let arcs = [];                // finished dishes arcing from a station to the pass
  let pops = [];                // step-finish text popping in (scale 1.4 -> 1)
  let rings = [];               // expanding rings: goal stars, VIP arrival, combo
  let fade = 0;                 // black overlay between screens, 1 -> 0
  let earnedShown = 0;          // earnings number rolling up to earned
  let meterTick = 0;            // HUD meter flash seconds left after a coin lands
  let goalsHit = 0;             // career star goals already celebrated today
  let comboBanner = null;       // { n, t } big 'COMBO ×n' banner
  let edgeGlow = 0;             // gold screen-edge glow seconds left
  let tension = 0;              // rush-moment vignette strength 0..1
  let dayOverT = 0;             // seconds since the day-end panel opened
  let starPopped = 0;           // day-end stars already popped with a coin sound
  let carpet = null;            // { x, t } VIP red-carpet shimmer at a seat

  function startDay(dayMode, index) {
    mode = dayMode && typeof dayMode === 'object' ? mode : dayMode;
    const dayObj = dayMode && typeof dayMode === 'object'
      ? dayMode
      : (mode === 'endless' || mode === 'daily' ? SZ.KitchenData.endlessDay(index) : SZ.KitchenData.CAREER[index]);
    dayIndex = index;
    dayInfo = dayObj;
    location = SZ.KitchenData.locationById(dayInfo.location);
    scene = SZ.KitchenScene.create(location.theme);
    stations = {};
    for (const id of SZ.KitchenData.STATION_ORDER) {
      const slots = [{ ticket: null, progress: 0, state: 'idle', fxT: 0, chopF: -1 }];
      if (SECOND_SLOT[id] && treeLevel(SECOND_SLOT[id]) > 0)
        slots.push({ ticket: null, progress: 0, state: 'idle', fxT: 0, chopF: -1 });
      stations[id] = { id, slots };
    }
    customers = [];
    tickets = [];
    pass = [];
    flying = [];
    coins = [];
    earned = 0;
    served = 0;
    walkouts = 0;
    combo = 0;
    bestCombo = 0;
    dayTime = 0;
    spawnTimer = 1;             // first guest after one second
    spawned = 0;
    recent = [];
    hasCritic = false;
    ticketSeq = 0;
    dayResult = null;
    ruinedServed = 0;
    perfectServed = 0;
    rushTimer = 0;
    rushUsed = false;
    rescueUsed = false;
    endlessPhase = 0;
    sceneFade = 0;
    waiter = null;
    waiterTimer = WAITER_DELAY;
    waiterLook = SZ.PeopleArt.randomLook(Math.random, 'regular');
    waiterLook.shirt = '#23272e';
    arcs = [];
    pops = [];
    rings = [];
    earnedShown = 0;
    meterTick = 0;
    goalsHit = 0;
    comboBanner = null;
    edgeGlow = 0;
    tension = 0;
    dayOverT = 0;
    starPopped = 0;
    carpet = null;
    fade = 1;
    dailyDate = dateKey(new Date());
    rand = mode === 'daily' ? SZ.KitchenData.rng(SZ.KitchenData.dailySeed(new Date())) : Math.random;
    chefX = VIEW_W / 2;
    chefTargetX = VIEW_W / 2;
    chefPose = 'idle';
    chefTimer = 0;
    particles.clear();
    floatingText.clear();
    state = STATE_PLAYING;
    sfx('select');
    updateWindowTitle();
    updateStatus();
  }

  /* ── layout helpers ── */
  function seatCount() { return location.seats + treeLevel('v_table'); }

  function seatX(i) {
    const n = seatCount();
    return n <= 1 ? (SEAT_X0 + SEAT_X1) / 2 : SEAT_X0 + i * (SEAT_X1 - SEAT_X0) / (n - 1);
  }

  function stationX(i) { return STATION_X0 + i * STATION_STEP; }

  function stationCX(id) { return stationX(SZ.KitchenData.STATION_ORDER.indexOf(id)) + STATION_W / 2; }

  function passCapacity() { return PASS_MAX + 2 * treeLevel('p_pass'); }

  function passX(i) { return PASS_X0 + i * (PASS_X1 - PASS_X0) / (passCapacity() - 1); }

  /* How much faster a step runs: hot burners everywhere, pre-chopped prep
     and plating, and the Rush Hour Bell on top. */
  function speedFactor(stationId) {
    const prep = (stationId === 'board' || stationId === 'plate') ? 1 + 0.3 * treeLevel('p_prep') : 1;
    return (1 + 0.1 * treeLevel('g_heat')) * prep * (rushTimer > 0 ? 1.5 : 1);
  }

  /* The perfect zone of a step, widened around its centre by the timers. */
  function zoneFor(step) {
    const w = 1 + 0.15 * treeLevel('g_timer');
    const c = (step.zone[0] + step.zone[1]) / 2;
    const h = (step.zone[1] - step.zone[0]) / 2 * w;
    return [c - h, c + h];
  }

  /* Non-stick pans push the burn threshold back. */
  function burnAt() { return BURN_AT + 0.2 * treeLevel('g_pan'); }

  function comboMult() { return 1 + Math.min(1, combo * 0.1); }

  /* How many guests a day lets in: endless runs have no fixed count, the
     Daily Special stops at twenty. */
  function spawnLimit() { return mode === 'daily' ? DAILY_CUSTOMERS : dayInfo.customers; }

  function dateKey(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  /* ══════════════════════════════════════════════════════════════════
     CUSTOMERS — walk in, wait at a seat, eat, leave
     ══════════════════════════════════════════════════════════════════ */

  function freeSeat() {
    const taken = new Set(customers.map(c => c.seat));
    for (let i = 0; i < seatCount(); ++i)
      if (!taken.has(i)) return i;
    return -1;
  }

  /* Fancy Decor draws the better crowd: when a plain regular walks in, the
     dice are cast once more and a critic or VIP that shows up is taken. */
  function pickGuestType() {
    let type = SZ.KitchenData.pickCustomerType(rand, dayIndex, hasCritic);
    if (treeLevel('c_decor') > 0 && type.id === 'regular') {
      const alt = SZ.KitchenData.pickCustomerType(rand, dayIndex, hasCritic);
      if (alt.id === 'critic' || alt.id === 'vip') type = alt;
    }
    return type;
  }

  function spawnCustomer() {
    const seat = freeSeat();
    if (seat < 0) return false;         // counter full: the queue waits outside
    const type = pickGuestType();
    if (type.id === 'critic') hasCritic = true;
    const order = SZ.KitchenData.pickRecipe(rand, location, recent);
    recent.push(order);
    while (recent.length > 4) recent.shift();
    const patience = dayInfo.patience * type.patience * (1 + 0.12 * treeLevel('v_seats'));
    customers.push({
      look: SZ.PeopleArt.randomLook(rand, type.id),
      type, seat, x: -60, state: 'walkIn',
      order, patience, patienceMax: patience, ticket: null,
      eatTimer: 0, mood: 'happy',
      hop: 0, wave: 0, leaveT: 0, crumbT: 0, rating: 0
    });
    ++spawned;
    sfx('blip', { pitch: 1.3, volume: 0.25 });
    if (type.id === 'vip') {
      particles.sparkle(seatX(seat), SEAT_Y - 60, 14, { color: '#ffd23f', speed: 3 });
      pushRing(seatX(seat), SEAT_Y - 40, 10, '#ffd23f');
      carpet = { x: seatX(seat), t: 1.2 };
    }
    return true;
  }

  function moodFor(c) {
    const f = c.patience / c.patienceMax;
    if (f > 0.6) return 'happy';
    if (f < 0.15) return 'angry';
    if (f < 0.35) return 'impatient';
    return 'ok';
  }

  function cancelTicket(c) {
    const t = c.ticket;
    if (!t) return;
    c.ticket = null;
    const i = tickets.indexOf(t);
    if (i >= 0) tickets.splice(i, 1);
    for (const id of SZ.KitchenData.STATION_ORDER)
      for (const s of stations[id].slots)
        if (s.ticket === t && !t.done) { s.ticket = null; s.progress = 0; s.state = 'idle'; }
  }

  function updateCustomers(dt) {
    for (const c of customers) {
      if (c.hop > 0) c.hop -= dt;
      if (c.state === 'walkIn') {
        c.x += WALK_SPEED * dt;
        if (c.x >= seatX(c.seat)) { c.x = seatX(c.seat); c.state = 'waiting'; }
      } else if (c.state === 'waiting') {
        c.patience -= dt;
        c.mood = moodFor(c);
        if (c.patience <= 0) {
          c.state = 'leaving';
          c.mood = 'angry';
          c.leaveT = 0;
          combo = 0;
          ++walkouts;
          cancelTicket(c);
          floatingText.add(c.x, SEAT_Y - 140, 'Too slow!', { color: '#f66', size: 18 });
          /* the anger puff: a short red cloud over the empty seat */
          particles.burst(c.x, SEAT_Y - 90, 10, { color: '#e04545', speed: 1.6, size: 7, life: 0.7, decay: 0.025, friction: 0.96 });
          pushRing(c.x, SEAT_Y - 90, 8, '#e04545');
          sfx('hurt', { volume: 0.6 });
        }
      } else if (c.state === 'eating') {
        c.eatTimer -= dt;
        /* crumbs fall while the guest chews */
        c.crumbT -= dt;
        if (c.crumbT <= 0) {
          c.crumbT = 0.35;
          particles.burst(c.x + 14, SEAT_Y - 96, 2, { color: '#b08050', speed: 0.8, size: 2, life: 0.5, gravity: 0.08 });
        }
        if (c.eatTimer <= 0) {
          c.state = 'leaving';
          c.mood = 'love';
          c.leaveT = 0;
          c.wave = 1.2;
          /* the critic holds up the score card on the way out */
          if (c.type.id === 'critic' && c.rating > 0)
            sfx(c.rating >= 3 ? 'levelup' : 'lose', { volume: 0.6 });
        }
      } else if (c.state === 'leaving') {
        c.x += WALK_SPEED * dt;
        c.leaveT += dt;
        if (c.wave > 0) c.wave -= dt;
      }
    }
    customers = customers.filter(c => c.x < VIEW_W + 80);
  }

  /* Taking an order: click the guest or the bubble over their head. */
  function takeOrder(c) {
    if (c.state !== 'waiting' || c.ticket) return;
    const recipe = SZ.KitchenData.recipeById(c.order);
    const ticket = { id: ++ticketSeq, recipe, customer: c, stepIndex: 0, results: [], waitingFor: recipe.steps[0].station, done: false };
    c.ticket = ticket;
    tickets.push(ticket);
    sfx('select');
  }

  /* ══════════════════════════════════════════════════════════════════
     STATIONS — five parallel steps, catch the zone to finish one
     ══════════════════════════════════════════════════════════════════ */

  function ticketInSlot(t) {
    for (const id of SZ.KitchenData.STATION_ORDER)
      for (const s of stations[id].slots)
        if (s.ticket === t) return true;
    return false;
  }

  /* A finished ticket moves to the pass when there is room; until then the
     plating station holds it and blocks. The dish itself lands at once, a
     copy arcs over for the eye and bounces where it settles. */
  function tryToPass(t, slot, fromId) {
    if (pass.length >= passCapacity()) return false;
    const quality = SZ.KitchenData.dishScore(t.results);
    pass.push({ recipe: t.recipe.id, quality: quality, ticket: t, bounce: 0 });
    if (fromId) {
      const pi = pass.length - 1;
      arcs.push({
        recipe: t.recipe.id, quality: quality, ticket: t, t: 0,
        x0: stationCX(fromId), y0: STATION_Y + 30,
        x1: passX(pi), y1: PASS_Y
      });
    }
    const i = tickets.indexOf(t);
    if (i >= 0) tickets.splice(i, 1);
    if (slot) { slot.ticket = null; slot.progress = 0; slot.state = 'idle'; }
    return true;
  }

  /* forced: Second Chance finishes a burning step as 'ok' instead. */
  function finishStep(stationId, slot, auto, forced) {
    const t = slot.ticket;
    const step = t.recipe.steps[t.stepIndex];
    const quality = forced || SZ.KitchenData.qualityOf(slot.progress, zoneFor(step), burnAt());
    t.results.push(quality);
    ++t.stepIndex;
    slot.progress = 0;
    if (t.stepIndex < t.recipe.steps.length) {
      t.waitingFor = t.recipe.steps[t.stepIndex].station;
      slot.ticket = null;
      slot.state = 'idle';
    } else {
      t.done = true;
      t.waitingFor = null;
      if (!tryToPass(t, slot, stationId)) slot.state = 'ready';
    }
    const cx = stationCX(stationId);
    if (forced) {
      floatingText.add(cx, STATION_Y - 10, 'Saved!', { color: '#ffd23f', size: 16 });
      particles.sparkle(cx, STATION_Y + 40, 8, { color: '#ffd23f', speed: 50, life: 0.6 });
      sfx('powerup', { volume: 0.5 });
    } else if (quality === 'perfect') {
      pushPop(cx, STATION_Y - 16, 'PERFECT!', '#ffd23f', 22);
      particles.sparkle(cx, STATION_Y + 40, 10, { color: '#ffd23f', speed: 50, life: 0.6 });
      sfx('pickup', { pitch: 1 + combo * 0.08 });
      if (!auto) { chefTargetX = cx; chefPose = 'cheer'; chefTimer = 0.5; }
    } else if (quality === 'burnt') {
      pushPop(cx, STATION_Y - 16, 'Oops!', '#f55', 20);
      particles.burst(cx, STATION_Y + 40, 12, { color: '#555', speed: 60, life: 0.5 });
      screenShake.trigger(5, 250);
      sfx('smallExplode');
      sfx('error', { volume: 0.5 });
    } else if (quality === 'raw') {
      pushPop(cx, STATION_Y - 16, 'Oops!', '#f55', 18);
      particles.burst(cx, STATION_Y + 40, 8, { color: '#666', speed: 40, life: 0.5 });
      screenShake.trigger(4, 200);
      sfx('error', { volume: 0.5 });
    } else {
      pushPop(cx, STATION_Y - 12, 'Good', '#cfd6e4', 14);
      sfx('blip');
    }
  }

  /* a ticket landing on a station: each kind gets its own short call */
  function stationArrive(id) {
    if (id === 'grill') sfx('shoot', { pitch: 0.5, volume: 0.25 });
    else if (id === 'stove') sfx('drop', { pitch: 0.6 });
    else if (id === 'oven') sfx('click', { pitch: 0.6 });
    else if (id === 'board') sfx('thud', { pitch: 1.6, volume: 0.3 });
    else sfx('click');
  }

  function updateStations(dt) {
    /* FIFO: a waiting ticket enters the first free slot of its station */
    for (const t of tickets) {
      if (t.done || t.waitingFor === null || ticketInSlot(t)) continue;
      for (const s of stations[t.waitingFor].slots) {
        if (!s.ticket) {
          s.ticket = t;
          s.progress = 0;
          s.state = 'working';
          stationArrive(t.waitingFor);
          break;
        }
      }
    }
    for (const id of SZ.KitchenData.STATION_ORDER) {
      for (const s of stations[id].slots) {
        const t = s.ticket;
        if (!t) continue;
        if (t.done) { tryToPass(t, s, id); continue; }
        const step = t.recipe.steps[t.stepIndex];
        s.progress += dt * speedFactor(id) / step.time;
        if (s.progress >= burnAt()) {
          if (treeLevel('p_rescue') > 0 && !rescueUsed) {
            rescueUsed = true;
            finishStep(id, s, true, 'ok');
          } else {
            finishStep(id, s, true);
          }
        } else {
          const zone = zoneFor(step);
          s.state = s.progress > 1 ? 'burning'
            : (s.progress >= zone[0] && s.progress <= zone[1] ? 'ready' : 'working');
          stationAmbience(id, s, dt);
        }
      }
    }
  }

  /* The kitchen breathes: sparks on the grill, steam off the pot, wood chips
     with every knife stroke, grey smoke while a step burns. Emission is on a
     small per-slot timer so it reads steady at any frame rate. */
  function stationAmbience(id, s, dt) {
    if (s.fxT === undefined) s.fxT = 0;
    const px = stationCX(id);
    /* the board throws chips on every down-stroke of the knife, in step with
       the four baked art frames rather than a timer */
    if (id === 'board' && s.state === 'working') {
      const cf = Math.floor(animT * 6) % 4;
      if (s.chopF !== cf) {
        s.chopF = cf;
        if (cf === 0 || cf === 2) {
          particles.burst(px, STATION_Y + 86, 2, { color: '#c08a4a', speed: 1.4, size: 2, life: 0.4, gravity: 0.1 });
          sfx('thud', { pitch: 1.8, volume: 0.12 });
        }
      }
    } else s.chopF = -1;
    s.fxT -= dt;
    if (s.fxT > 0) return;
    if (s.state === 'burning') {
      s.fxT = 0.3;
      particles.burst(px, STATION_Y + 34, 2, { color: '#8a8a92', speed: 0.8, size: 5, life: 0.8, decay: 0.02, vy: -1.3, friction: 0.97 });
    } else if (id === 'grill') {
      s.fxT = 0.15;
      particles.burst(px, STATION_Y + 62, 2, { color: '#ff8a2a', speed: 1.6, size: 2, life: 0.4, gravity: -0.02, vy: -1.2 });
    } else if (id === 'stove') {
      s.fxT = 0.25;
      particles.burst(px + 29, STATION_Y + 26, 1, { color: '#e8eef4', speed: 0.5, size: 4, life: 0.9, decay: 0.018, vy: -1.1, friction: 0.98 });
    } else {
      s.fxT = 0.4;
    }
  }

  function clickStation(i) {
    const id = SZ.KitchenData.STATION_ORDER[i];
    const cx = stationCX(id);
    chefTargetX = cx;
    chefPose = id === 'board' ? 'chop' : (id === 'stove' || id === 'grill') ? 'flip' : chefPose;
    chefTimer = 0.9;
    let slot = null;
    for (const s of stations[id].slots)
      if (s.ticket && !s.ticket.done) { slot = s; break; }
    if (!slot) {
      sfx('click');
      return;
    }
    finishStep(id, slot, false);
  }

  /* ── the chef walks to the station last touched ── */
  function updateChef(dt) {
    const d = chefTargetX - chefX;
    if (Math.abs(d) > 4)
      chefX += Math.sign(d) * Math.min(Math.abs(d), 320 * dt);
    if (chefTimer > 0) {
      chefTimer -= dt;
      if (chefTimer <= 0) chefPose = 'idle';
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SERVING — pass, trash bin, flying dishes and coins
     ══════════════════════════════════════════════════════════════════ */

  function serveTarget(dish) {
    const owner = dish.ticket && dish.ticket.customer;
    if (owner && owner.state === 'waiting') return owner;
    for (const c of customers)
      if (c.state === 'waiting' && c.order === dish.recipe) return c;
    return null;
  }

  function clickPass(mx, my) {
    for (let i = 0; i < pass.length; ++i) {
      const px = passX(i);
      if (Math.abs(mx - px) > 40 || Math.abs(my - PASS_Y) > 40) continue;
      const dish = pass[i];
      const target = serveTarget(dish);
      if (!target) {
        floatingText.add(px, PASS_Y - 46, 'No one waiting', { color: '#faa', size: 14 });
        sfx('error', { volume: 0.5 });
        return true;
      }
      pass.splice(i, 1);
      flying.push({ recipe: dish.recipe, quality: dish.quality, ticket: dish.ticket, x0: px, y0: PASS_Y, t: 0, customer: target });
      sfx('whoosh', { pitch: 1.3, volume: 0.3 });
      return true;
    }
    return false;
  }

  function clickTrash(mx, my) {
    if (Math.hypot(mx - TRASH.x, my - TRASH.y) > TRASH.r + 8) return false;
    const i = pass.findIndex(d => d.quality === 'ruined');
    if (i < 0) {
      floatingText.add(TRASH.x, TRASH.y - 40, 'Nothing to trash', { color: '#999', size: 12 });
      sfx('click');
      return true;
    }
    pass.splice(i, 1);
    particles.burst(TRASH.x, TRASH.y - 12, 8, { color: '#666', speed: 40, life: 0.4 });
    sfx('drop', { pitch: 0.5 });
    return true;
  }

  function serveTo(f, c) {
    const recipe = SZ.KitchenData.recipeById(f.recipe);
    if (f.quality === 'ruined') {
      combo = 0;
      ++ruinedServed;
      c.mood = 'angry';
      floatingText.add(c.x, SEAT_Y - 130, 'Ruined!', { color: '#f55', size: 16 });
      particles.burst(c.x, SEAT_Y - 90, 8, { color: '#666', speed: 1.2, size: 5, life: 0.6 });
      sfx('hurt', { volume: 0.5 });
    } else {
      let tip = SZ.KitchenData.tipFor(recipe, f.quality, c.patience / c.patienceMax, c.type, comboMult());
      const charm = treeLevel('c_tips');
      if (charm > 0) tip = Math.round(tip * (1 + 0.1 * charm));
      const before = earned;
      earned += tip;
      ++served;
      const prevCombo = combo;
      if (f.quality === 'perfect') {
        ++perfectServed;
        combo += treeLevel('c_combo') > 0 ? 2 : 1;
      }
      if (combo > bestCombo) bestCombo = combo;
      floatingText.add(c.x, SEAT_Y - 130, '+$' + tip, { color: '#ffd23f', size: 20 });
      const nCoins = spawnTipCoins(c.x, tip);
      particles.confetti(c.x, SEAT_Y - 40, 10);
      /* the tip coin rides the size of the shower: more coins, higher chirp */
      sfx('coin', { pitch: 1 + (nCoins - 3) * 0.12, volume: 0.6 });
      c.hop = 0.4;
      if (f.quality === 'perfect') {
        chefPose = 'cheer';
        chefTimer = 0.9;
        for (let i = 0; i < 3; ++i)
          floatingText.add(c.x + (i - 1) * 16, SEAT_Y - 122, '♥', { color: '#ff6a8a', font: 'bold ' + (16 + i * 3) + 'px sans-serif' });
      }
      if (c.type.id === 'critic')
        c.rating = f.quality === 'perfect' ? 5 : f.quality === 'good' ? 3 : 1;
      if (mode === 'career') celebrateGoals(before, earned);
      if (prevCombo < 3 && combo >= 3) comboFanfare(3);
      else if (prevCombo < 6 && combo >= 6) comboFanfare(6);
      else if (prevCombo < 10 && combo >= 10) comboFanfare(10);
    }
    c.state = 'eating';
    c.eatTimer = EAT_TIME;
    updateStatus();
  }

  /* 3..8 coins on staggered curved flights to the earnings HUD. */
  function spawnTipCoins(x, tip) {
    const n = Math.max(3, Math.min(8, 3 + Math.floor(tip / 25)));
    for (let i = 0; i < n; ++i) {
      if (coins.length >= COIN_MAX) coins.shift();
      coins.push({
        x0: x + (i - n / 2) * 6, y0: SEAT_Y - 70,
        cx: (x + COIN_TX) / 2 + (Math.random() - 0.5) * 160,
        cy: SEAT_Y - 190 - Math.random() * 60,
        t: -i * 0.07
      });
    }
    return n;
  }

  /* A career star goal crossed mid-day: a burst on the meter and the word. */
  function celebrateGoals(before, after) {
    while (goalsHit < 3 && dayInfo.goals[goalsHit] > 0 && after >= dayInfo.goals[goalsHit] && before < dayInfo.goals[goalsHit]) {
      const gx = HUD_PX + 16 + Math.min(1, dayInfo.goals[goalsHit] / Math.max(1, dayInfo.goals[2])) * (HUD_PW - 32);
      particles.sparkle(gx, HUD_PY + 74, 12, { color: '#ffd23f', speed: 3 });
      pushRing(gx, HUD_PY + 74, 6, '#ffd23f');
      floatingText.add(VIEW_W / 2, 150, '★ Goal reached!', { color: '#ffd23f', size: 26 });
      sfx('levelup', { volume: 0.6 });
      ++goalsHit;
    }
  }

  /* Crossing a combo step: banner, gold edge glow and a rising fanfare. */
  function comboFanfare(n) {
    comboBanner = { n: n, t: 0 };
    edgeGlow = 1;
    pushRing(VIEW_W / 2, 130, 20, '#ffb060');
    sfx('powerup', { volume: 0.7 });
  }

  function landDish(f) {
    const c = f.customer;
    if (c.state === 'waiting') { serveTo(f, c); return; }
    const alt = serveTarget({ recipe: f.recipe, ticket: f.ticket });
    if (alt) { serveTo(f, alt); return; }
    if (pass.length < passCapacity()) {
      pass.push({ recipe: f.recipe, quality: f.quality, ticket: f.ticket });
      floatingText.add(f.customer.x, SEAT_Y - 130, 'Gone!', { color: '#faa', size: 14 });
      sfx('error', { volume: 0.4 });
      return;
    }
    particles.burst(f.customer.x, SEAT_Y - 60, 8, { color: '#666', speed: 40, life: 0.4 });
  }

  function updateFlying(dt) {
    for (let i = flying.length - 1; i >= 0; --i) {
      const f = flying[i];
      f.t += dt;
      if (f.t >= FLY_TIME) {
        flying.splice(i, 1);
        landDish(f);
        continue;
      }
      /* position is computed here once and reused by drawFlying */
      const k = f.t / FLY_TIME;
      f.x = f.x0 + (f.customer.x - f.x0) * k;
      f.y = f.y0 + (SEAT_Y - 60 - f.y0) * k - Math.sin(k * Math.PI) * 90;
      if (f.quality === 'perfect')
        particles.trail(f.x, f.y, { color: '#ffd23f', size: 2.5, life: 0.4 });
    }
  }

  function updateCoins(dt) {
    for (let i = coins.length - 1; i >= 0; --i) {
      const c = coins[i];
      c.t += dt;
      if (c.t >= COIN_TIME) {
        coins.splice(i, 1);
        meterTick = 0.25;
      }
    }
  }

  /* Shared bookkeeping for the short-lived effect lists. */
  function updateFx(dt) {
    for (let i = arcs.length - 1; i >= 0; --i) {
      const a = arcs[i];
      a.t += dt;
      if (a.t >= ARC_TIME) {
        arcs.splice(i, 1);
        for (const d of pass)
          if (d.ticket === a.ticket) { d.bounce = 0.3; break; }
        /* the dish settling on the pass */
        sfx('bounce', { pitch: 1.4, volume: 0.3 });
      }
    }
    for (const d of pass)
      if (d.bounce > 0) d.bounce -= dt;
    for (let i = pops.length - 1; i >= 0; --i) {
      pops[i].t += dt;
      if (pops[i].t > 0.45) pops.splice(i, 1);
    }
    for (let i = rings.length - 1; i >= 0; --i) {
      rings[i].t += dt;
      if (rings[i].t > 0.5) rings.splice(i, 1);
    }
    if (meterTick > 0) meterTick = Math.max(0, meterTick - dt);
    if (edgeGlow > 0) edgeGlow = Math.max(0, edgeGlow - dt);
    if (comboBanner) {
      comboBanner.t += dt;
      if (comboBanner.t > 1.1) comboBanner = null;
    }
    if (carpet) {
      carpet.t -= dt;
      if (carpet.t <= 0) carpet = null;
    }
  }

  function pushRing(x, y, r, color) {
    if (rings.length >= RING_MAX) rings.shift();
    rings.push({ x: x, y: y, r: r, t: 0, color: color });
  }

  function pushPop(x, y, text, color, size) {
    if (pops.length >= 16) pops.shift();
    pops.push({ x: x, y: y, text: text, color: color, size: size, t: 0 });
  }

  /* ── the hired waiter: a finished dish that matches a waiting guest is
     carried over automatically, a beat after it lands on the pass ── */

  function updateWaiter(dt) {
    if (treeLevel('v_waiter') <= 0) return;
    if (!waiter) {
      let idx = -1, target = null;
      for (let i = 0; i < pass.length; ++i) {
        const c = serveTarget(pass[i]);
        if (c) { idx = i; target = c; break; }
      }
      if (idx < 0) { waiterTimer = WAITER_DELAY; return; }
      waiterTimer -= dt;
      if (waiterTimer > 0) return;
      waiterTimer = WAITER_DELAY;
      const dish = pass.splice(idx, 1)[0];
      waiter = { x: passX(idx), facing: 1, state: 'toGuest', target, dish };
      sfx('whoosh', { pitch: 1.3, volume: 0.3 });
      return;
    }
    const goal = waiter.state === 'toGuest' ? waiter.target.x : WAITER_HOME;
    const dir = Math.sign(goal - waiter.x) || waiter.facing;
    waiter.facing = dir;
    waiter.x += dir * 220 * dt;
    if (waiter.state === 'toGuest') {
      if (Math.abs(waiter.target.x - waiter.x) < 12) {
        const c = waiter.target;
        if (c.state === 'waiting')
          serveTo({ recipe: waiter.dish.recipe, quality: waiter.dish.quality, ticket: waiter.dish.ticket }, c);
        else if (pass.length < passCapacity())
          pass.push(waiter.dish);
        waiter.state = 'back';
      }
    } else if (Math.abs(waiter.x - WAITER_HOME) < 8) {
      waiter = null;
    }
  }

  /* ── Rush Hour Bell: every station runs 50% faster for ten seconds ── */

  function activateRush() {
    if (state !== STATE_PLAYING || treeLevel('p_rush') <= 0) return;
    if (rushUsed) {
      floatingText.add(BELL.x, BELL.y - 26, 'Already used', { color: '#faa', size: 12 });
      sfx('error', { volume: 0.4 });
      return;
    }
    rushUsed = true;
    rushTimer = RUSH_TIME;
    floatingText.add(VIEW_W / 2, 200, 'RUSH HOUR!', { color: '#ffd23f', size: 30 });
    sfx('zap');
  }

  /* ══════════════════════════════════════════════════════════════════
     DAY END & SAVE
     ══════════════════════════════════════════════════════════════════ */

  function checkDayEnd() {
    if (mode === 'career') {
      if (spawned < spawnLimit() || customers.length > 0) return;
    } else {
      if (walkouts >= 3 || ruinedServed >= 3) { endDay(); return; }
      if (mode === 'daily') {
        if (spawned < spawnLimit() || customers.length > 0) return;
      } else {
        return;                       // Endless Rush only stops on failures
      }
    }
    endDay();
  }

  function endDay() {
    const newBest = mode === 'endless' ? earned > save.best.endless
      : mode === 'daily' ? (save.best.daily.date !== dailyDate || earned > save.best.daily.earned)
      : false;
    dayResult = {
      earned, served, walkouts, ruined: ruinedServed, newBest,
      stars: mode === 'career' ? SZ.KitchenData.starsFor(dayInfo, earned) : 0
    };
    state = STATE_DAY_OVER;
    dayOverT = 0;
    starPopped = 0;
    fade = 1;
    saveDayResult();
    saveHighScores();
    /* a career day is won with at least one star; the challenge modes are
       won by lasting out the day instead of failing on walkouts or ruins */
    const won = mode === 'career' ? dayResult.stars >= 1 : walkouts < 3 && ruinedServed < 3;
    sfx(won ? 'win' : 'lose');
    updateWindowTitle();
    updateStatus();
  }

  function defaultSave() {
    return {
      v: 2, coins: 0, stars: {}, tree: {},
      best: { endless: 0, daily: { date: '', earned: 0 } },
      stats: { days: 0, served: 0, perfect: 0 }
    };
  }

  /* Save v2: coins, career stars, the upgrade tree, mode bests and lifetime
     stats — an old v2 blob is merged over the defaults so nothing is lost. */
  function loadSave() {
    const s = defaultSave();
    try {
      const raw = localStorage.getItem(STORAGE_SAVE);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && o.v === 2) {
          if (typeof o.coins === 'number') s.coins = o.coins;
          if (o.stars && typeof o.stars === 'object') s.stars = o.stars;
          if (o.tree && typeof o.tree === 'object') s.tree = o.tree;
          if (o.best && typeof o.best === 'object') {
            for (const k in o.best)
              if (k !== 'endless' && k !== 'daily') s.best[k] = o.best[k];
            if (typeof o.best.endless === 'number') s.best.endless = o.best.endless;
            if (o.best.daily && typeof o.best.daily === 'object')
              s.best.daily = { date: o.best.daily.date || '', earned: o.best.daily.earned || 0 };
          }
          if (o.stats && typeof o.stats === 'object') {
            s.stats.days = o.stats.days || 0;
            s.stats.served = o.stats.served || 0;
            s.stats.perfect = o.stats.perfect || 0;
          }
        }
      }
    } catch { /* file:// may block */ }
    return s;
  }

  let save = loadSave();

  function writeSave() {
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(save));
    } catch { /* file:// may block */ }
  }

  /* A day's money is kept even when the day fails; stars only count for the
     career, bests only for the modes, and the lifetime stats always tick. */
  function saveDayResult() {
    save.coins += earned;
    ++save.stats.days;
    save.stats.served += served;
    save.stats.perfect += perfectServed;
    if (mode === 'career') {
      const id = dayInfo.id;
      if (!(id in save.stars) || dayResult.stars > save.stars[id]) save.stars[id] = dayResult.stars;
      if (!(id in save.best) || earned > save.best[id]) save.best[id] = earned;
    } else if (mode === 'endless') {
      if (earned > save.best.endless) save.best.endless = earned;
    } else if (mode === 'daily') {
      if (save.best.daily.date !== dailyDate || earned > save.best.daily.earned)
        save.best.daily = { date: dailyDate, earned };
    }
    writeSave();
  }

  /* ── career unlocking: a day needs one star on the day before it ── */

  function careerUnlocked(i) {
    if (i <= 0) return true;
    const prev = SZ.KitchenData.CAREER[i - 1];
    return !!prev && (save.stars[prev.id] || 0) >= 1;
  }

  /* A location is reached when its first day is playable. */
  function locationReached(locIndex) {
    return careerUnlocked(locIndex * 6);
  }

  /* ── upgrade tree helpers ── */

  function treeLevel(id) { return save.tree[id] || 0; }

  function nodeState(node) {
    const level = treeLevel(node.id);
    if (level >= node.costs.length) return 'maxed';
    for (const r of node.req)
      if (treeLevel(r[0]) < r[1]) return 'locked';
    if (save.coins < node.costs[level]) return 'expensive';
    return 'available';
  }

  function buyNode(id) {
    const node = TREE_INDEX[id];
    if (!node || nodeState(node) !== 'available') {
      sfx('error', { volume: 0.5 });
      return false;
    }
    save.coins -= node.costs[treeLevel(id)];
    ++save.tree[id];
    writeSave();
    sfx('powerup');
    sfx('coin', { pitch: 1.2, volume: 0.6 });
    return true;
  }

  /* ── Kitchen screen layout: tabs plus the card grid of the active branch ── */

  /* Column of a node: one past the deepest node it requires */
  function treeDepth(node) {
    let d = 0;
    for (let i = 0; i < node.req.length; ++i) {
      const parent = TREE_INDEX[node.req[i][0]];
      if (parent)
        d = Math.max(d, treeDepth(parent) + 1);
    }
    return d;
  }

  function buildTreeLayout() {
    const tabs = [];
    const tabW = (1232 - (TREE_BRANCH_LIST.length - 1) * 8) / TREE_BRANCH_LIST.length;
    for (let i = 0; i < TREE_BRANCH_LIST.length; ++i) {
      const b = TREE_BRANCH_LIST[i];
      const nodes = TREE.filter(n => n.branch === b.id);
      let maxed = 0;
      for (let k = 0; k < nodes.length; ++k)
        if (treeLevel(nodes[k].id) >= nodes[k].costs.length)
          ++maxed;
      tabs.push({ index: i, branch: b, x: 24 + i * (tabW + 8), y: 108, w: tabW, h: 36, maxed: maxed, total: nodes.length });
    }

    const branch = TREE_BRANCH_LIST[treeBranch];
    const cols = [];
    for (const node of TREE) {
      if (node.branch !== branch.id) continue;
      const d = treeDepth(node);
      if (!cols[d]) cols[d] = [];
      cols[d].push(node);
    }
    let rows = 0;
    for (let c = 0; c < cols.length; ++c)
      if (cols[c]) rows = Math.max(rows, cols[c].length);

    const areaH = 480;   // the card area between tabs and footer, y 160..640
    const gap = rows > 1 ? Math.max(8, Math.min(TREE_ROW_GAP, (areaH - rows * TREE_CARD_H) / (rows - 1))) : TREE_ROW_GAP;
    const gridW = cols.length * TREE_CARD_W + (cols.length - 1) * TREE_COL_GAP;
    const gridH = rows * TREE_CARD_H + (rows - 1) * gap;
    const startX = 24 + (1232 - gridW) / 2;
    const startY = gridH <= areaH ? 160 + (areaH - gridH) / 2 : 160;

    const cards = [];
    for (let c = 0; c < cols.length; ++c) {
      if (!cols[c]) continue;
      for (let r = 0; r < cols[c].length; ++r) {
        const node = cols[c][r];
        cards.push({
          node: node,
          col: c,
          row: r,
          x: startX + c * (TREE_CARD_W + TREE_COL_GAP),
          y: startY + r * (TREE_CARD_H + gap),
          w: TREE_CARD_W,
          h: TREE_CARD_H,
          state: nodeState(node),
        });
      }
    }
    return { tabs: tabs, cards: cards, branch: branch };
  }

  function treeCardById(id) {
    if (!treeLayout) return null;
    return treeLayout.cards.find(c => c.node.id === id) || null;
  }

  function selectFirstInBranch() {
    const branchId = TREE_BRANCH_LIST[treeBranch].id;
    const first = treeLayout ? treeLayout.cards.find(c => c.node.branch === branchId) : null;
    treeSelected = first ? first.node.id : null;
  }

  /* Up/Down within a column, Left/Right between columns; past an edge the
     selection wraps into the previous/next branch */
  function moveTreeSelection(dc, dr) {
    if (!treeLayout) treeLayout = buildTreeLayout();
    const branchId = TREE_BRANCH_LIST[treeBranch].id;
    const cur = treeCardById(treeSelected);
    if (!cur || cur.node.branch !== branchId) {
      selectFirstInBranch();
      sfx('click', { volume: 0.4 });
      return;
    }
    const cols = {};
    for (const card of treeLayout.cards) {
      if (card.node.branch !== branchId) continue;
      if (!cols[card.col]) cols[card.col] = [];
      cols[card.col].push(card);
    }
    const colIdx = Object.keys(cols).map(Number).sort((a, b) => a - b);
    const ci = colIdx.indexOf(cur.col) + dc;
    let ri = cols[cur.col].indexOf(cur) + dr;
    if (ci < 0 || ci >= colIdx.length) {
      treeBranch = (treeBranch + (ci < 0 ? -1 : 1) + TREE_BRANCH_LIST.length) % TREE_BRANCH_LIST.length;
      treeLayout = buildTreeLayout();
      selectFirstInBranch();
      sfx('click', { volume: 0.4 });
      return;
    }
    const col = cols[colIdx[ci]];
    ri = Math.max(0, Math.min(col.length - 1, ri));
    treeSelected = col[ri].node.id;
    sfx('click', { volume: 0.4 });
  }

  function bestForMode() {
    if (mode === 'endless') return save.best.endless;
    if (mode === 'daily') return save.best.daily.date === dailyDate ? save.best.daily.earned : 0;
    return save.best[dayInfo.id] || 0;
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU SCREENS — shared widgets
     ══════════════════════════════════════════════════════════════════ */

  function isMenuState(s) {
    return MENU_SCREENS.indexOf(s) >= 0;
  }

  function setScreen(name) {
    state = name;
    menuCursor = 0;
    hitAreas.length = 0;
    menuFade = 0.5;
    fade = 1;
    if (name === STATE_UPGRADES)
      treeLayout = buildTreeLayout();
    updateWindowTitle();
    updateStatus();
  }

  function openHelp() {
    helpFrom = isMenuState(state) ? state : STATE_TITLE;
    helpPage = 0;
    setScreen(STATE_HELP);
  }

  /* Register one clickable / keyboard-selectable item for this frame */
  function registerHit(id, x, y, w, h, action, disabled) {
    const index = hitAreas.length;
    hitAreas.push({ id: id, x: x, y: y, w: w, h: h, action: action, disabled: !!disabled });
    return index;
  }

  /* True when the keyboard cursor or the mouse rests on the item; hovering selects it */
  function isHot(index, x, y, w, h) {
    const hovered = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
    if (hovered)
      menuCursor = index;
    return hovered || menuCursor === index;
  }

  function drawButton(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = registerHit(id, x, y, w, h, opts.action, opts.disabled);
    const hot = isHot(index, x, y, w, h);
    ctx.save();
    if (opts.disabled)
      ctx.globalAlpha *= 0.55;
    if (hot) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(1.03, 1.03);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    ui.drawPanel(x, y, w, h, {
      radius: 10,
      noStuds: true,
      accent: hot ? ui.UI.gold : (opts.accent || ui.UI.accent),
      glow: hot,
      top: hot ? 'rgba(56,42,22,0.96)' : undefined,
      bottom: hot ? 'rgba(26,18,10,0.96)' : undefined
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, x + w / 2, opts.sub ? y + h / 2 - 8 : y + h / 2 + 1, w - 24, opts.px || 20, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
    if (opts.sub)
      ui.fitText(opts.sub, x + w / 2, y + h - 11, w - 24, 11, { color: ui.UI.textDim });
    ctx.restore();
  }

  function moveMenuCursor(d) {
    const n = hitAreas.length;
    if (!n) return;
    menuCursor = (Math.min(menuCursor, n - 1) + d + n) % n;
    sfx('click', { volume: 0.4 });
  }

  function activateMenuItem(item) {
    if (!item || item.disabled || !item.action) {
      sfx('error', { volume: 0.5 });
      return;
    }
    sfx('select');
    item.action();
  }

  function drawLock(cx, cy, size) {
    ctx.save();
    ctx.strokeStyle = '#c8d0e0';
    ctx.lineWidth = size * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.12, size * 0.3, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#c8d0e0';
    ui.roundRectPath(cx - size * 0.4, cy - size * 0.12, size * 0.8, size * 0.6, size * 0.1);
    ctx.fill();
    ctx.restore();
  }

  function romanNumeral(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
  }

  function countStars() {
    let n = 0;
    for (const id of Object.keys(save.stars))
      n += save.stars[id] || 0;
    return n;
  }

  function countTreeMaxed() {
    let n = 0;
    for (const node of TREE)
      if (treeLevel(node.id) >= node.costs.length)
        ++n;
    return n;
  }

  /* A recipe shows in the book once one of its venues has been reached. */
  function recipeReached(id) {
    for (let li = 0; li < SZ.KitchenData.LOCATIONS.length; ++li)
      if (SZ.KitchenData.LOCATIONS[li].recipes.indexOf(id) >= 0 && locationReached(li))
        return true;
    return false;
  }

  /* One cached interior per theme, reused by every menu screen. */
  function menuScene(theme) {
    if (!menuScenes[theme])
      menuScenes[theme] = SZ.KitchenScene.create(theme);
    return menuScenes[theme];
  }

  function fillVisibleRect() {
    const v = visibleRect();
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  /* Menu background: a location scene over the whole visible area, softened
     by a dark overlay so panels and text stay readable. */
  function drawMenuBackdrop(theme, alpha) {
    const v = visibleRect();
    menuScene(theme).draw(ctx, animT, v);
    ctx.fillStyle = 'rgba(8,6,4,' + alpha + ')';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  /* Small marker on a career day button: glasses for a critic day, a bolt for
     a rush day. */
  function drawSpecialIcon(kind, x, y) {
    ctx.save();
    ctx.strokeStyle = '#ffd23f';
    ctx.fillStyle = '#ffd23f';
    ctx.lineWidth = 1.5;
    if (kind === 'critic') {
      ctx.beginPath();
      ctx.arc(x - 4, y, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 4, y, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 1, y);
      ctx.lineTo(x + 1, y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + 1, y - 5);
      ctx.lineTo(x - 3, y + 1);
      ctx.lineTo(x, y + 1);
      ctx.lineTo(x - 1, y + 5);
      ctx.lineTo(x + 3, y - 1);
      ctx.lineTo(x, y - 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     CLICK HANDLING
     ══════════════════════════════════════════════════════════════════ */

  function handleCanvasClick(mx, my) {
    if (state !== STATE_PLAYING) return;

    if (treeLevel('p_rush') > 0 && Math.hypot(mx - BELL.x, my - BELL.y) <= BELL.r + 8) {
      activateRush();
      return;
    }
    if (clickPass(mx, my)) return;
    if (clickTrash(mx, my)) return;

    for (const c of customers) {
      if (c.state !== 'waiting') continue;
      const by = SEAT_Y - BUBBLE_DY;
      if (Math.hypot(mx - c.x, my - by) < 36 ||
          (Math.abs(mx - c.x) < 46 && my > SEAT_Y - 120 && my < SEAT_Y + 6)) {
        takeOrder(c);
        return;
      }
    }

    for (let i = 0; i < SZ.KitchenData.STATION_ORDER.length; ++i) {
      if (mx >= stationX(i) && mx <= stationX(i) + STATION_W && my >= STATION_Y && my <= STATION_Y + STATION_H) {
        clickStation(i);
        return;
      }
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    /* the frame must keep keyboard focus after clicks */
    window.focus();

    const p = pointerToView(e);
    mouseX = p.x;
    mouseY = p.y;

    if (state === STATE_UPGRADES) {
      if (!treeLayout) treeLayout = buildTreeLayout();
      for (const tab of treeLayout.tabs) {
        if (mouseX >= tab.x && mouseX <= tab.x + tab.w && mouseY >= tab.y && mouseY <= tab.y + tab.h) {
          treeBranch = tab.index;
          selectFirstInBranch();
          sfx('click', { volume: 0.4 });
          return;
        }
      }
      for (const card of treeLayout.cards) {
        if (mouseX >= card.x && mouseX <= card.x + card.w && mouseY >= card.y && mouseY <= card.y + card.h) {
          treeSelected = card.node.id;
          if (buyNode(card.node.id))
            treeBuyFlash = { id: card.node.id, at: animT };
          return;
        }
      }
      return;
    }

    if (isMenuState(state) || state === STATE_PAUSED || state === STATE_DAY_OVER) {
      for (let i = 0; i < hitAreas.length; ++i) {
        const a = hitAreas[i];
        if (mouseX >= a.x && mouseX <= a.x + a.w && mouseY >= a.y && mouseY <= a.y + a.h) {
          menuCursor = i;
          activateMenuItem(a);
          return;
        }
      }
      return;
    }

    handleCanvasClick(p.x, p.y);
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointerToView(e);
    mouseX = p.x;
    mouseY = p.y;
  });

  canvas.addEventListener('pointerleave', () => {
    mouseX = -1;
    mouseY = -1;
  });

  /* ══════════════════════════════════════════════════════════════════
     KEYBOARD HANDLING
     ══════════════════════════════════════════════════════════════════ */

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => state === STATE_PLAYING,
    pause: () => {
      state = STATE_PAUSED;
      menuCursor = 0;
      updateWindowTitle();
      updateStatus();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      setScreen(STATE_TITLE);
      return;
    }

    /* ── Kitchen upgrade tree navigation ── */
    if (state === STATE_UPGRADES) {
      e.preventDefault();
      if (e.key === 'Escape') {
        setScreen(prevScreen);
      } else if (e.key === 'Tab') {
        treeBranch = (treeBranch + 1) % TREE_BRANCH_LIST.length;
        treeLayout = buildTreeLayout();
        selectFirstInBranch();
        sfx('click', { volume: 0.4 });
      } else if (e.key >= '1' && e.key <= '5') {
        const b = Number(e.key) - 1;
        if (b < TREE_BRANCH_LIST.length) {
          treeBranch = b;
          treeLayout = buildTreeLayout();
          selectFirstInBranch();
          sfx('click', { volume: 0.4 });
        }
      } else if (e.key === 'ArrowLeft') {
        moveTreeSelection(-1, 0);
      } else if (e.key === 'ArrowRight') {
        moveTreeSelection(1, 0);
      } else if (e.key === 'ArrowUp') {
        moveTreeSelection(0, -1);
      } else if (e.key === 'ArrowDown') {
        moveTreeSelection(0, 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (treeSelected && buyNode(treeSelected))
          treeBuyFlash = { id: treeSelected, at: animT };
      } else if (e.key === 'h' || e.key === 'H') {
        openHelp();
      }
      return;
    }

    /* ── Help pages ── */
    if (state === STATE_HELP) {
      e.preventDefault();
      if (e.key === 'Escape' || e.key === 'h' || e.key === 'H') {
        setScreen(helpFrom);
      } else if (e.key === 'ArrowLeft') {
        helpPage = Math.max(0, helpPage - 1);
        sfx('click', { volume: 0.4 });
      } else if (e.key === 'ArrowRight') {
        helpPage = Math.min(HELP_PAGES.length - 1, helpPage + 1);
        sfx('click', { volume: 0.4 });
      }
      return;
    }

    /* ── Menu screens, pause and day-over share the hit-area cursor ── */
    if (isMenuState(state) || state === STATE_PAUSED || state === STATE_DAY_OVER) {
      e.preventDefault();
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'w' || e.key === 'W')
        moveMenuCursor(-1);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 's' || e.key === 'S')
        moveMenuCursor(1);
      else if (e.key === 'Enter' || e.key === ' ')
        activateMenuItem(hitAreas[Math.min(menuCursor, hitAreas.length - 1)]);
      else if ((e.key === 'h' || e.key === 'H') && isMenuState(state))
        openHelp();
      else if (e.key === 'Escape') {
        if (state === STATE_PAUSED) {
          state = STATE_PLAYING;
          updateWindowTitle();
          updateStatus();
        } else if (state !== STATE_TITLE)
          setScreen(STATE_TITLE);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING) {
        state = STATE_PAUSED;
        menuCursor = 0;
        updateWindowTitle();
        updateStatus();
      }
      return;
    }
    if (state !== STATE_PLAYING) return;
    if (e.key === 'b' || e.key === 'B') {
      activateRush();
      return;
    }
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= SZ.KitchenData.STATION_ORDER.length)
      clickStation(num - 1);
  });

  /* ══════════════════════════════════════════════════════════════════
     DRAWING — the kitchen, guests, stations and HUD
     ══════════════════════════════════════════════════════════════════ */

  function drawOrderBubble(c) {
    const bx = c.x, by = SEAT_Y - BUBBLE_DY;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.beginPath();
    ctx.arc(bx, by, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(bx - 7, by + 29);
    ctx.lineTo(bx + 7, by + 29);
    ctx.lineTo(bx, by + 44);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    SZ.FoodArt.drawDish(ctx, c.order, bx, by, 40, 1, 'good');
    /* patience ring: green -> yellow -> red */
    const f = Math.max(0, c.patience / c.patienceMax);
    ctx.strokeStyle = f > 0.5 ? '#4caf50' : f > 0.25 ? '#e6b422' : '#e04545';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(bx, by, 30, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
    ctx.stroke();
    if (c.ticket) {
      ctx.fillStyle = '#4caf50';
      ctx.beginPath();
      ctx.arc(bx - 26, by - 26, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx - 29, by - 26);
      ctx.lineTo(bx - 26, by - 23);
      ctx.lineTo(bx - 22, by - 29);
      ctx.stroke();
    }
    SZ.PeopleArt.drawMood(ctx, bx + 54, by - 4, c.mood, 26);
  }

  function drawCustomers() {
    const sorted = customers.slice().sort((a, b) => a.x - b.x);
    for (const c of sorted) {
      const pose = c.state === 'walkIn' ? 'walk'
        : c.state === 'waiting' ? 'sit'
        : c.state === 'eating' ? 'eat'
        : (c.mood === 'angry' ? 'angry' : 'happy');
      /* a little hop when the dish arrives */
      const hopY = c.hop > 0 ? -Math.sin((1 - c.hop / 0.4) * Math.PI) * 12 : 0;
      SZ.PeopleArt.drawCustomer(ctx, c.look, c.x, SEAT_Y + hopY, pose, animT, 1);
      if (c.state === 'waiting') drawOrderBubble(c);
      else if (c.state === 'leaving') {
        SZ.PeopleArt.drawMood(ctx, c.x + 44, SEAT_Y - 130, c.mood === 'angry' ? 'angry' : 'love', 26);
        if (c.wave > 0) drawWave(c);
        if (c.rating > 0 && c.leaveT < 1.8) drawRatingCard(c);
      }
    }
  }

  /* a small hand waving goodbye beside the head */
  function drawWave(c) {
    ctx.save();
    ctx.translate(c.x + 36, SEAT_Y - 116);
    ctx.rotate(Math.sin(animT * 12) * 0.5);
    ctx.fillStyle = c.look.skin;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.2;
    ui.roundRectPath(-4, -11, 8, 15, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /* the critic holds up the score card for a moment before vanishing */
  function drawRatingCard(c) {
    const rx = c.x, ry = SEAT_Y - 176;
    ctx.save();
    if (c.leaveT > 1.4) ctx.globalAlpha = (1.8 - c.leaveT) / 0.4;
    ui.drawPanel(rx - 46, ry - 16, 92, 32, { radius: 8, noStuds: true, accent: '#c04cff' });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = ui.uiFont(15, 'bold');
    for (let i = 0; i < 5; ++i) {
      ctx.fillStyle = i < c.rating ? '#ffd23f' : 'rgba(255,255,255,0.2)';
      ctx.fillText('★', rx - 32 + i * 16, ry);
    }
    ctx.restore();
  }

  function drawTrash() {
    ctx.save();
    ctx.fillStyle = '#3a3f46';
    ui.roundRectPath(TRASH.x - 22, TRASH.y - 16, 44, 38, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#4a5058';
    ui.roundRectPath(TRASH.x - 26, TRASH.y - 25, 52, 9, 4);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; ++i) {
      ctx.beginPath();
      ctx.moveTo(TRASH.x + i * 9, TRASH.y - 6);
      ctx.lineTo(TRASH.x + i * 9, TRASH.y + 14);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPass() {
    for (let i = 0; i < pass.length; ++i) {
      const d = pass[i];
      const px = passX(i);
      /* squash-pop as an arced dish settles on the pass */
      const bounce = d.bounce > 0 ? 1 + 0.18 * Math.sin((d.bounce / 0.3) * Math.PI) : 1;
      if (bounce !== 1) {
        ctx.save();
        ctx.translate(px, PASS_Y + 14);
        ctx.scale(2 - bounce, bounce);
        ctx.translate(-px, -(PASS_Y + 14));
      }
      SZ.FoodArt.drawDish(ctx, d.recipe, px, PASS_Y, 64, 1, d.quality);
      if (bounce !== 1) ctx.restore();
    }
    drawTrash();
  }

  /* One progress bar for one slot: green perfect zone, red burn field, marker. */
  function drawSlotBar(x, w, slot) {
    const t = slot.ticket;
    const step = t && !t.done ? t.recipe.steps[t.stepIndex] : null;
    if (!step) return;
    const burn = burnAt();
    const scale = w / burn;
    ui.roundRectPath(x, BAR_Y, w, BAR_H, BAR_H / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.save();
    ui.roundRectPath(x, BAR_Y, w, BAR_H, BAR_H / 2);
    ctx.clip();
    const zone = zoneFor(step);
    ctx.fillStyle = 'rgba(70,200,90,0.55)';
    ctx.fillRect(x + zone[0] * scale, BAR_Y, (zone[1] - zone[0]) * scale, BAR_H);
    ctx.fillStyle = 'rgba(220,60,50,0.5)';
    ctx.fillRect(x + scale, BAR_Y, (burn - 1) * scale, BAR_H);
    ctx.restore();
    const nx = x + Math.min(slot.progress, burn) * scale;
    /* the needle glows while the perfect zone is live */
    if (slot.state === 'ready') {
      ctx.fillStyle = 'rgba(125,255,138,' + (0.3 + 0.2 * Math.sin(animT * 6)).toFixed(3) + ')';
      ctx.fillRect(nx - 6, BAR_Y - 6, 12, BAR_H + 12);
    }
    ctx.fillStyle = slot.state === 'burning' ? '#ff6a4a' : slot.state === 'ready' ? '#7dff8a' : '#fff';
    ctx.fillRect(nx - 2, BAR_Y - 3, 4, BAR_H + 6);
  }

  function drawStationBar(i, id, slot) {
    const x = stationX(i);
    const t = slot.ticket;
    const step = t && !t.done ? t.recipe.steps[t.stepIndex] : null;
    ui.drawKeycap(String(i + 1), x + 2, BAR_Y + BAR_H + 4, 12);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(step ? step.label : SZ.KitchenData.STATIONS[id].name, x + 26, BAR_Y + BAR_H + 12, STATION_W - 30, 11, { color: 'rgba(255,255,255,0.75)' });
    drawSlotBar(x, STATION_W, slot);
  }

  function stationArtState(slot) {
    return slot.ticket ? (slot.ticket.done ? 'ready' : slot.state) : 'idle';
  }

  function drawStations() {
    for (let i = 0; i < SZ.KitchenData.STATION_ORDER.length; ++i) {
      const id = SZ.KitchenData.STATION_ORDER[i];
      const slots = stations[id].slots;
      const x = stationX(i);
      let anyReady = false, anyBurning = false, anyWorking = false;
      for (const s of slots) {
        if (!s.ticket || s.ticket.done) continue;
        if (s.state === 'ready') anyReady = true;
        else if (s.state === 'burning') anyBurning = true;
        else anyWorking = true;
      }
      /* a burning station sizzles: its art jitters a pixel or two */
      const jx = anyBurning ? Math.sin(animT * 47 + i * 2.1) * 1.5 : 0;
      const jy = anyBurning ? Math.cos(animT * 39 + i * 1.7) * 1.2 : 0;
      if (slots.length === 1) {
        ctx.save();
        ctx.translate(jx, jy);
        SZ.FoodArt.drawStation(ctx, id, x, STATION_Y, stationArtState(slots[0]), animT, slots[0].ticket ? slots[0].ticket.recipe.id : null);
        ctx.restore();
        drawStationBar(i, id, slots[0]);
      } else {
        /* Upgraded station: the art twice side by side at 70% scale, one bar
           per slot under it. */
        for (let j = 0; j < slots.length; ++j) {
          const slot = slots[j];
          ctx.save();
          ctx.translate(x + 8 + j * 120 + jx, STATION_Y + 24 + jy);
          ctx.scale(0.7, 0.7);
          SZ.FoodArt.drawStation(ctx, id, 0, 0, stationArtState(slot), animT, slot.ticket ? slot.ticket.recipe.id : null);
          ctx.restore();
          drawSlotBar(x + 4 + j * 75, (STATION_W - 8) / 2, slot);
        }
        ui.drawKeycap(String(i + 1), x + 2, BAR_Y + BAR_H + 4, 12);
        const step0 = slots[0].ticket && !slots[0].ticket.done ? slots[0].ticket.recipe.steps[slots[0].ticket.stepIndex] : null;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ui.fitText(step0 ? step0.label : SZ.KitchenData.STATIONS[id].name, x + 26, BAR_Y + BAR_H + 12, STATION_W - 30, 11, { color: 'rgba(255,255,255,0.75)' });
      }
      /* the oven door breathes warm light while it bakes */
      if (id === 'oven' && anyWorking) {
        const a = (0.10 + 0.09 * Math.sin(animT * 5)).toFixed(3);
        ctx.fillStyle = 'rgba(255,170,58,' + a + ')';
        if (slots.length === 1) ctx.fillRect(x + 48, STATION_Y + 52, 54, 30);
        else for (let j = 0; j < slots.length; ++j)
          ctx.fillRect(x + 8 + j * 120 + 34, STATION_Y + 24 + 36, 38, 21);
      }
      /* ready: a green ring pulses around the station */
      if (anyReady) {
        ctx.strokeStyle = 'rgba(125,255,138,' + (0.35 + 0.25 * Math.sin(animT * 6)).toFixed(3) + ')';
        ctx.lineWidth = 3;
        ui.roundRectPath(x - 4, STATION_Y - 4, STATION_W + 8, STATION_H + 8, 10);
        ctx.stroke();
      }
      /* burning: the frame blinks a red warning */
      if (anyBurning) {
        ctx.strokeStyle = 'rgba(255,70,50,' + (Math.sin(animT * 10) > 0 ? 0.55 : 0.15) + ')';
        ctx.lineWidth = 3;
        ui.roundRectPath(x - 4, STATION_Y - 4, STATION_W + 8, STATION_H + 8, 10);
        ctx.stroke();
      }
    }
  }

  function drawFlying() {
    for (const f of flying) {
      const k = Math.min(1, f.t / FLY_TIME);
      const x = f.x !== undefined ? f.x : f.x0 + (f.customer.x - f.x0) * k;
      const y = f.y !== undefined ? f.y : f.y0 + (SEAT_Y - 60 - f.y0) * k - Math.sin(k * Math.PI) * 90;
      SZ.FoodArt.drawDish(ctx, f.recipe, x, y, 44, 1, f.quality);
    }
  }

  /* finished dishes arcing from their station to the pass */
  function drawArcs() {
    for (const a of arcs) {
      const k = Math.min(1, a.t / ARC_TIME);
      const x = a.x0 + (a.x1 - a.x0) * k;
      const y = a.y0 + (a.y1 - a.y0) * k - Math.sin(k * Math.PI) * 70;
      SZ.FoodArt.drawDish(ctx, a.recipe, x, y, 40, 1, a.quality);
    }
  }

  function drawCoins() {
    for (const c of coins) {
      if (c.t < 0) continue;
      const k = Math.min(1, c.t / COIN_TIME);
      const u = 1 - k;
      const x = u * u * c.x0 + 2 * u * k * c.cx + k * k * COIN_TX;
      const y = u * u * c.y0 + 2 * u * k * c.cy + k * k * COIN_TY;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,80,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(x - 1.6, y - 1.6, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* expanding rings: goal stars, VIP arrival, anger puffs, combo pops */
  function drawRings() {
    for (const r of rings) {
      const k = r.t / 0.5;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + k * 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* step-finish text: pops in at 1.4x and settles to 1x while it rises */
  function drawPops() {
    for (const p of pops) {
      const k = p.t / 0.45;
      const s = k < 0.3 ? 1.4 - 0.4 * (k / 0.3) : 1;
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.translate(p.x, p.y - k * 26);
      ctx.scale(s, s);
      ctx.font = ui.uiFont(p.size, 'bold');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }

  /* the short red carpet a VIP walks in on, with a travelling shimmer */
  function drawCarpet() {
    if (!carpet) return;
    const k = carpet.t / 1.2;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.5) * 0.5;
    ctx.fillStyle = '#a02040';
    ui.roundRectPath(carpet.x - 46, SEAT_Y - 2, 92, 14, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(carpet.x - 46 + (1 - k) * 78, SEAT_Y - 2, 14, 14);
    ctx.restore();
  }

  /* a small two-tone flame for the combo chip */
  function drawFlame(x, y, s) {
    s *= 1 + 0.12 * Math.sin(animT * 10 + x);
    ctx.save();
    ctx.fillStyle = '#ff7a3a';
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x + s * 0.8, y - s * 0.2, x + s * 0.5, y + s * 0.6);
    ctx.quadraticCurveTo(x, y + s * 0.2, x - s * 0.5, y + s * 0.6);
    ctx.quadraticCurveTo(x - s * 0.8, y - s * 0.2, x, y - s);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.4);
    ctx.quadraticCurveTo(x + s * 0.4, y, x + s * 0.2, y + s * 0.5);
    ctx.quadraticCurveTo(x, y + s * 0.2, x - s * 0.2, y + s * 0.5);
    ctx.quadraticCurveTo(x - s * 0.4, y, x, y - s * 0.4);
    ctx.fill();
    ctx.restore();
  }

  function drawRushBell() {
    const spent = rushUsed && rushTimer <= 0;
    ctx.save();
    ctx.globalAlpha = spent ? 0.4 : 1;
    ctx.fillStyle = rushTimer > 0 ? '#ffd23f' : '#e6b422';
    ctx.beginPath();
    ctx.arc(BELL.x, BELL.y - 2, 11, Math.PI, 0);
    ctx.lineTo(BELL.x + 13, BELL.y + 8);
    ctx.lineTo(BELL.x - 13, BELL.y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(BELL.x, BELL.y + 11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = ui.uiFont(10, 'bold');
    ctx.fillStyle = spent ? 'rgba(255,255,255,0.4)' : '#fff';
    ctx.fillText(rushTimer > 0 ? Math.ceil(rushTimer) + 's' : 'B', BELL.x, BELL.y + 24);
  }

  function drawHUD() {
    const px = HUD_PX, py = HUD_PY, pw = HUD_PW, ph = HUD_PH;
    ui.drawPanel(px, py, pw, ph, { title: 'Day ' + dayInfo.id, titleRight: location.name, accent: location.color });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const seated = customers.filter(c => c.state !== 'leaving').length;
    const limit = spawnLimit();
    const left = (isFinite(limit) ? Math.max(0, limit - spawned) : 0) + seated;
    const line = mode === 'career'
      ? 'Served ' + served + '  ·  Walkouts ' + walkouts + '  ·  Guests left ' + left
      : 'Served ' + served + '  ·  Walkouts ' + walkouts + ' / 3  ·  Ruined ' + ruinedServed + ' / 3';
    ui.fitText(line, px + 14, py + 46, pw - 28, 11, { color: 'rgba(255,255,255,0.7)' });
    const shown = Math.round(earnedShown);
    if (dayInfo.goals[2] > 0) {
      const meterX = px + 16, meterY = py + 66, meterW = pw - 32, meterH = 16;
      const top = Math.max(1, dayInfo.goals[2]);
      ui.drawMeter(meterX, meterY, meterW, meterH, earnedShown / top, '#ffd23f', { label: '$' + shown });
      /* the meter ticks white as each coin lands */
      if (meterTick > 0) {
        ui.roundRectPath(meterX, meterY, meterW, meterH, meterH / 2);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * meterTick / 0.25).toFixed(3) + ')';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.font = ui.uiFont(12, 'bold');
      for (let i = 0; i < 3; ++i) {
        const gx = meterX + Math.min(1, dayInfo.goals[i] / top) * meterW;
        ctx.fillStyle = earned >= dayInfo.goals[i] ? '#ffd23f' : 'rgba(255,255,255,0.35)';
        ctx.fillText('★', gx, meterY - 9);
      }
    } else {
      ui.fitText('Earned $' + shown + '   ·   Best $' + bestForMode(), px + 16, py + 74, pw - 64, 14, { weight: 'bold', color: '#ffd23f' });
    }
    if (combo > 0) {
      const chipW = ui.drawChip('COMBO ×' + comboMult().toFixed(1), px, py + ph + 10, 24, { bg: 'rgba(255,120,40,0.25)', border: 'rgba(255,160,60,0.6)', color: '#ffb060' });
      /* the chip grows a flame at every combo step */
      const flames = combo >= 10 ? 3 : combo >= 6 ? 2 : combo >= 3 ? 1 : 0;
      for (let i = 0; i < flames; ++i)
        drawFlame(px + chipW + 12 + i * 15, py + ph + 22, 7);
    }
    if (treeLevel('p_rush') > 0) drawRushBell();
  }

  /* Ticket rail in the band between the pass and the stations: a thin metal
     bar with the ticket cards hanging from it, oldest first, max 9 visible. */
  function drawTicketRail() {
    if (tickets.length === 0) return;
    const barX0 = 40, barX1 = 1240;
    const bg = ctx.createLinearGradient(0, RAIL_Y - 3, 0, RAIL_Y + 3);
    bg.addColorStop(0, '#a8aeb8');
    bg.addColorStop(1, '#4a505a');
    ui.roundRectPath(barX0, RAIL_Y - 3, barX1 - barX0, 6, 3);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const shown = Math.min(tickets.length, RAIL_MAX);
    for (let i = 0; i < shown; ++i) {
      const t = tickets[i];
      const x = RAIL_X0 + i * (RAIL_W + RAIL_GAP), y = RAIL_Y;
      /* the clip hanging the card on the bar */
      ctx.fillStyle = '#7a808a';
      ui.roundRectPath(x + RAIL_W / 2 - 8, y - 5, 16, 10, 3);
      ctx.fill();
      ui.drawPanel(x, y, RAIL_W, RAIL_H, { radius: 7, accent: location.color, noStuds: true });
      SZ.FoodArt.drawDish(ctx, t.recipe.id, x + RAIL_W / 2, y + 24, 40, 1, 'good');
      /* the customer's patience as a thin bar */
      const f = Math.max(0, t.customer.patience / t.customer.patienceMax);
      ui.roundRectPath(x + 10, y + 46, RAIL_W - 20, 5, 2.5);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      if (f > 0) {
        ui.roundRectPath(x + 10, y + 46, (RAIL_W - 20) * f, 5, 2.5);
        ctx.fillStyle = f > 0.5 ? '#4caf50' : f > 0.25 ? '#e6b422' : '#e04545';
        ctx.fill();
      }
      /* step icons: done steps ticked, current step highlighted with its key */
      const steps = t.recipe.steps;
      for (let j = 0; j < steps.length; ++j) {
        const ix = x + 20 + j * 20;
        if (j === t.stepIndex) {
          ui.roundRectPath(ix - 11, y + 55, 22, 26, 5);
          ctx.fillStyle = 'rgba(255,210,63,0.22)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,210,63,0.85)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        SZ.FoodArt.drawStepIcon(ctx, steps[j].station, ix, y + 64, 18);
        if (j < t.stepIndex) {
          ctx.strokeStyle = '#5cd25c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ix - 5, y + 64);
          ctx.lineTo(ix - 1, y + 68);
          ctx.lineTo(ix + 6, y + 59);
          ctx.stroke();
        }
        if (j === t.stepIndex) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = ui.uiFont(9, 'bold');
          ctx.fillStyle = '#ffd23f';
          ctx.fillText(String(SZ.KitchenData.STATION_ORDER.indexOf(steps[j].station) + 1), ix, y + 76);
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     TITLE SCREEN
     ══════════════════════════════════════════════════════════════════ */

  function drawTitleScreen() {
    drawMenuBackdrop('bistro', 0.55);
    ui.drawHeadline('BISTRO RUSH', 640, 110, 1100, 88, '#ffd23f', '#ff7a3a');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,240,210,0.8)';
    ctx.font = ui.uiFont(22);
    ctx.fillText('Cook. Serve. Build your restaurant empire.', 640, 176);

    /* the chef cheering on the left, dishes orbiting around him */
    SZ.PeopleArt.drawChef(ctx, 150, 648, 'cheer', animT);
    const orbit = ['burger', 'pizza', 'tacos', 'cake', 'salad', 'ramen'];
    for (let i = 0; i < orbit.length; ++i) {
      const a = animT * 1.1 + i * Math.PI / 3;
      SZ.FoodArt.drawDish(ctx, orbit[i], 150 + Math.cos(a) * 118, 470 + Math.sin(a) * 72, 44, 1, 'good');
    }

    /* three customers strolling along the bottom */
    for (let i = 0; i < 3; ++i) {
      const span = VIEW_W + 220;
      const x = ((animT * 90 + i * 430) % span) - 110;
      SZ.PeopleArt.drawCustomer(ctx, titleLooks[i], x, 706, 'walk', animT, 1);
    }

    ui.drawChip('$' + save.coins, 1256, 20, 30, { align: 'right', color: ui.UI.gold });

    const stars = countStars();
    const daily = save.best.daily;
    const items = [
      { id: 't-career', label: 'Career', sub: stars + ' / 90 stars', action: () => setScreen(STATE_CAREER) },
      { id: 't-endless', label: 'Endless Rush', sub: 'Best $' + save.best.endless, action: () => startDay('endless', 0) },
      { id: 't-daily', label: 'Daily Special', sub: daily.date === dateKey(new Date()) ? 'Today: $' + daily.earned : 'New menu today', action: () => startDay('daily', 0) },
      { id: 't-kitchen', label: 'Kitchen', sub: countTreeMaxed() + ' / ' + TREE.length + ' upgrades', action: () => { prevScreen = STATE_TITLE; setScreen(STATE_UPGRADES); } },
      { id: 't-recipes', label: 'Recipe Book', action: () => setScreen(STATE_RECIPES) },
      { id: 't-help', label: 'Help', action: openHelp },
    ];
    for (let i = 0; i < items.length; ++i) {
      const x = 640 - 352 + (i % 2) * 364;
      const y = 300 + Math.floor(i / 2) * 64;
      drawButton(items[i].id, items[i].label, x, y, 340, 52, { sub: items[i].sub, action: items[i].action });
    }

    ui.drawKeyHints([
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Start' },
      { key: 'H', label: 'Help' },
      { key: 'F2', label: 'New Game' },
    ], 640, 694, 900, 1);
  }

  /* ══════════════════════════════════════════════════════════════════
     CAREER MAP — five location cards, six days each
     ══════════════════════════════════════════════════════════════════ */

  function drawCareerScreen() {
    drawMenuBackdrop('truck', 0.62);
    ui.drawHeadline('Career', 640, 46, 600, 40, '#ffd23f', '#ff7a3a');

    for (let li = 0; li < SZ.KitchenData.LOCATIONS.length; ++li) {
      const loc = SZ.KitchenData.LOCATIONS[li];
      const cx = 25 + li * 250, cy = 92, cw = 230, ch = 430;
      const reached = locationReached(li);

      /* opaque card body first, so the restaurant behind never shows through;
         only the miniature at the card top shows art */
      ui.drawPanel(cx, cy, cw, ch, {
        flat: true, noStuds: true,
        accent: reached ? loc.color : ui.UI.textMute,
        top: '#161d30', bottom: '#0a0d18',
      });
      /* miniature of the location scene, clipped into the card top */
      ctx.save();
      ui.roundRectPath(cx, cy, cw, 130, 9);
      ctx.clip();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(cw / 1280, cw / 1280);
      menuScene(loc.theme).draw(ctx, animT, { x0: 0, y0: 0, x1: 1280, y1: 720 });
      ctx.restore();
      ctx.fillStyle = reached ? 'rgba(6,9,18,0.35)' : 'rgba(4,6,12,0.78)';
      ctx.fillRect(cx, cy, cw, 130);
      ctx.restore();

      let stars = 0;
      for (let k = 0; k < 6; ++k)
        stars += save.stars[(li + 1) + '-' + (k + 1)] || 0;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(loc.name, cx + 14, cy + 152, 140, 19, { weight: 'bold', color: reached ? ui.UI.text : ui.UI.textMute });
      ui.drawChip(stars + ' / 18', cx + cw - 12, cy + 140, 24, {
        align: 'right', px: 13,
        color: stars ? ui.UI.gold : ui.UI.textMute,
        bg: 'rgba(4,6,14,0.8)',
      });

      if (!reached) {
        drawLock(cx + cw / 2, cy + 250, 56);
        ctx.textAlign = 'center';
        ui.fitText('Earn a star on day ' + SZ.KitchenData.CAREER[li * 6 - 1].id, cx + cw / 2, cy + 320, cw - 24, 14, { color: ui.UI.warn });
        continue;
      }

      for (let k = 0; k < 6; ++k) {
        const di = li * 6 + k;
        const day = SZ.KitchenData.CAREER[di];
        const open = careerUnlocked(di);
        const got = save.stars[day.id] || 0;
        const bx = cx + 12 + k * 36, by = cy + 186, bs = 30;
        const hit = registerHit('day-' + di, bx, by, bs, bs, () => startDay('career', di), !open);
        const hot = isHot(hit, bx, by, bs, bs);
        ctx.save();
        if (!open) ctx.globalAlpha *= 0.45;
        ui.drawPanel(bx, by, bs, bs, {
          radius: 7, noStuds: true, glow: hot,
          accent: hot ? ui.UI.gold : got >= 3 ? ui.UI.good : loc.color,
        });
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ui.UI.text;
        ctx.font = ui.uiFont(15, 'bold');
        ctx.fillText(String(k + 1), bx + bs / 2, by + bs / 2 + 1);
        if (day.special) drawSpecialIcon(day.special, bx + bs - 7, by + 6);
        if (!open) drawLock(bx + bs / 2, by + bs / 2, 16);
        ctx.restore();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let t = 0; t < 3; ++t) {
          ctx.fillStyle = t < got ? '#ffd23f' : 'rgba(255,255,255,0.2)';
          ctx.font = ui.uiFont(9);
          ctx.fillText('★', bx + 6 + t * 9, by + bs + 10);
        }
        const best = save.best[day.id] || 0;
        if (best > 0)
          ui.fitText('$' + best, bx + bs / 2, by + bs + 24, bs + 10, 9, { color: 'rgba(255,255,255,0.4)' });
      }

      ctx.textAlign = 'left';
      ui.drawTextBlock(loc.recipes.map(id => SZ.KitchenData.recipeById(id).name).join(' · '), cx + 14, cy + ch - 96, cw - 28, 70, 12, { color: 'rgba(255,255,255,0.5)' });
    }

    drawButton('career-back', 'Back', 24, 640, 140, 40, { px: 16, accent: '#8a90a0', action: () => setScreen(STATE_TITLE) });
    ui.drawKeyHints([
      { key: '↑↓←→', label: 'Select day' },
      { key: 'Enter', label: 'Start' },
      { key: 'Esc', label: 'Title' },
    ], 640, 694, 900, 1);
  }

  /* ══════════════════════════════════════════════════════════════════
     KITCHEN UPGRADE TREE
     ══════════════════════════════════════════════════════════════════ */

  function drawUpgradesScreen() {
    drawMenuBackdrop('hotel', 0.72);
    const layout = buildTreeLayout();
    treeLayout = layout;

    if (!treeSelected || !layout.cards.some(c => c.node.id === treeSelected))
      selectFirstInBranch();

    if (mouseX >= 0) {
      for (const card of layout.cards) {
        if (mouseX >= card.x && mouseX <= card.x + card.w && mouseY >= card.y && mouseY <= card.y + card.h) {
          treeSelected = card.node.id;
          break;
        }
      }
    }

    ui.drawPanel(24, 20, 1232, 76);
    ui.drawHeadline('Kitchen', 130, 58, 220, 40, ui.UI.gold);
    ui.drawChip('$' + save.coins, 1236, 44, 30, { align: 'right', color: ui.UI.gold });
    ctx.textAlign = 'right';
    ui.fitText(countTreeMaxed() + ' / ' + TREE.length + ' upgrades installed', 1236, 84, 320, 13, { color: ui.UI.textDim });
    ctx.textAlign = 'left';

    for (const tab of layout.tabs) {
      const active = tab.index === treeBranch;
      ui.roundRectPath(tab.x, tab.y, tab.w, tab.h, 8);
      ctx.fillStyle = '#0d1020';
      ctx.fill();
      ui.roundRectPath(tab.x, tab.y, tab.w, tab.h, 8);
      ctx.fillStyle = ui.hexToRgba(tab.branch.color, active ? 0.55 : 0.25);
      ctx.fill();
      if (active) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = tab.branch.color;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(tab.branch.name + ' ' + tab.maxed + '/' + tab.total, tab.x + tab.w / 2, tab.y + tab.h / 2 + 1, tab.w - 16, 14, { weight: 'bold', color: active ? '#ffffff' : '#c9d1e8' });
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    /* connectors under the cards */
    const byId = {};
    for (const card of layout.cards)
      byId[card.node.id] = card;
    ctx.lineWidth = 3;
    for (const card of layout.cards) {
      for (let i = 0; i < card.node.req.length; ++i) {
        const reqId = card.node.req[i][0];
        const from = byId[reqId];
        if (!from) continue;
        const met = treeLevel(reqId) >= card.node.req[i][1];
        ctx.strokeStyle = met ? ui.hexToRgba(layout.branch.color, 0.8) : '#3a4058';
        const x1 = from.x + from.w, y1 = from.y + from.h / 2;
        const x2 = card.x, y2 = card.y + card.h / 2;
        const midX = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(midX, y1);
        ctx.lineTo(midX, y2);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    for (const card of layout.cards)
      drawTreeNodeCard(card);

    for (const card of layout.cards) {
      if (card.node.id !== treeSelected) continue;
      ui.roundRectPath(card.x - 3, card.y - 3, card.w + 6, card.h + 6, 11);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Branch' },
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Esc', label: 'Back' },
    ], 640, 694, 900, 1);
  }

  function drawTreeNodeCard(card) {
    const node = card.node;
    const branch = TREE_BRANCHES[node.branch];
    const level = treeLevel(node.id);
    const max = node.costs.length;
    const maxed = card.state === 'maxed';
    const locked = card.state === 'locked';

    ctx.save();
    if (locked)
      ctx.globalAlpha *= 0.45;
    ui.drawPanel(card.x, card.y, card.w, card.h, { accent: maxed ? ui.UI.good : branch.color });

    if (card.state === 'available') {
      ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ui.hexToRgba(branch.color, 0.4 + 0.3 * Math.sin(animT * 4));
      ctx.stroke();
    }

    ctx.textBaseline = 'middle';
    ui.fitText(node.name, card.x + 16, card.y + 26, 268, 20, { weight: 'bold', color: ui.UI.text });
    ui.drawChip((level ? romanNumeral(level) : '0') + ' / ' + romanNumeral(max), card.x + card.w - 14, card.y + 14, 20, { align: 'right', px: 12, color: ui.UI.textDim, bg: 'rgba(255,255,255,0.06)' });
    ui.drawTextBlock(node.desc, card.x + 16, card.y + 42, 268, 40, 14, { color: ui.UI.textDim });

    for (let l = 0; l < max; ++l) {
      const px = card.x + 16 + l * 20;
      const py = card.y + card.h - 18;
      ui.roundRectPath(px, py, 16, 8, 2);
      ctx.fillStyle = l < level ? branch.color : 'rgba(255,255,255,0.07)';
      ctx.fill();
      if (l >= level) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.stroke();
      }
    }

    if (maxed) {
      ui.drawChip('MAX', card.x + card.w - 16, card.y + card.h - 26, 18, { align: 'right', px: 11, color: ui.UI.good, bg: 'rgba(111,224,138,0.12)', border: ui.hexToRgba(ui.UI.good, 0.5) });
    } else {
      ctx.textAlign = 'right';
      const costColor = card.state === 'expensive' ? ui.UI.bad : locked ? ui.UI.textMute : ui.UI.gold;
      ui.fitText('$' + node.costs[level], card.x + card.w - 16, card.y + card.h - 14, 120, 15, { weight: 'bold', color: costColor });
      ctx.textAlign = 'left';
    }

    if (locked) {
      const missing = [];
      for (let i = 0; i < node.req.length; ++i) {
        if (treeLevel(node.req[i][0]) < node.req[i][1])
          missing.push(TREE_INDEX[node.req[i][0]].name + ' ' + romanNumeral(node.req[i][1]));
      }
      ctx.textAlign = 'center';
      ui.fitText('Requires ' + missing.join(', '), card.x + card.w / 2, card.y + card.h - 30, card.w - 32, 12, { color: ui.UI.warn });
      ctx.textAlign = 'left';
    }

    if (treeBuyFlash && treeBuyFlash.id === node.id) {
      const f = 1 - (animT - treeBuyFlash.at) / 0.3;
      if (f > 0) {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * f).toFixed(3) + ')';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     RECIPE BOOK — twelve cards, locked recipes stay silhouettes
     ══════════════════════════════════════════════════════════════════ */

  function drawRecipeBook() {
    drawMenuBackdrop('sushi', 0.66);
    ui.drawHeadline('Recipe Book', 640, 46, 600, 40, '#ffd23f', '#ff7a3a');

    const CW = 296, CH = 168, GX = 16, GY = 14;
    for (let i = 0; i < SZ.KitchenData.RECIPES.length; ++i) {
      const r = SZ.KitchenData.RECIPES[i];
      const cx = 24 + (i % 4) * (CW + GX), cy = 96 + Math.floor(i / 4) * (CH + GY);
      const reached = recipeReached(r.id);
      ui.drawPanel(cx, cy, CW, CH, { accent: reached ? ui.UI.gold : ui.UI.textMute, noStuds: true });

      SZ.FoodArt.drawDish(ctx, r.id, cx + 52, cy + 62, 76, reached ? 1 : 0.15, 'good');
      if (!reached) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = ui.uiFont(30, 'bold');
        ctx.fillText('?', cx + 52, cy + 62);
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(reached ? r.name : 'Not reached yet', cx + 100, cy + 26, CW - 116, 19, { weight: 'bold', color: reached ? ui.UI.text : ui.UI.textMute });
      ui.fitText(reached ? '$' + r.price + ' per dish' : 'Serve it to unlock', cx + 100, cy + 48, CW - 116, 14, { color: reached ? ui.UI.gold : ui.UI.textMute });

      for (let j = 0; j < r.steps.length; ++j) {
        if (j > 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.font = ui.uiFont(14);
          ctx.textAlign = 'center';
          ctx.fillText('›', cx + 99 + j * 30, cy + 78);
        }
        SZ.FoodArt.drawStepIcon(ctx, r.steps[j].station, cx + 114 + j * 30, cy + 78, 22);
      }

      let chipX = cx + 12;
      for (const loc of SZ.KitchenData.LOCATIONS) {
        if (loc.recipes.indexOf(r.id) < 0) continue;
        const w = ui.drawChip(loc.name, chipX, cy + CH - 34, 22, {
          px: 11,
          color: reached ? loc.color : ui.UI.textMute,
          bg: 'rgba(4,6,14,0.7)',
          border: ui.hexToRgba(loc.color, 0.5),
        });
        chipX += w + 6;
      }
    }

    drawButton('recipes-back', 'Back', 24, 640, 140, 40, { px: 16, accent: '#8a90a0', action: () => setScreen(STATE_TITLE) });
    ui.drawKeyHints([
      { key: 'Esc', label: 'Back' },
    ], 640, 694, 900, 1);
  }

  /* ══════════════════════════════════════════════════════════════════
     HELP — four pages
     ══════════════════════════════════════════════════════════════════ */

  const HELP_PAGES = ['Taking orders', 'Cooking', 'Serving', 'Modes & upgrades'];

  function helpLines(px, py, lines) {
    for (let i = 0; i < lines.length; ++i) {
      const y = py + i * 96;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ui.UI.text;
      ctx.font = ui.uiFont(19, 'bold');
      ctx.fillText(lines[i][0], px, y);
      ui.drawTextBlock(lines[i][1], px, y + 14, 560, 60, 15, { color: ui.UI.textDim });
    }
  }

  function drawHelp() {
    drawMenuBackdrop('diner', 0.68);
    const pw = 1000, ph = 540, px = 140, py = 84;
    ui.drawPanel(px, py, pw, ph, { title: 'Help · ' + HELP_PAGES[helpPage], accent: '#ffd23f', titlePx: 20 });

    const ix = px + pw - 250;
    if (helpPage === 0) {
      helpLines(px + 40, py + 90, [
        ['Take the order', 'Click a seated customer, or the bubble over their head, to take the order. A ticket appears in the rail above the kitchen.'],
        ['Patience ring', 'The ring around the bubble drains as they wait: green, then yellow, then red. At zero they walk out and your combo breaks.'],
        ['Moods', 'Happy guests tip well, impatient ones start tapping their fingers, angry ones leave a mark on the day.'],
      ]);
      SZ.PeopleArt.drawCustomer(ctx, titleLooks[0], ix + 60, py + 330, 'sit', animT, 1);
      const bx = ix + 60, by = py + 180;
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.beginPath();
      ctx.arc(bx, by, 34, 0, Math.PI * 2);
      ctx.fill();
      SZ.FoodArt.drawDish(ctx, 'burger', bx, by, 40, 1, 'good');
      ctx.strokeStyle = '#4caf50';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(bx, by, 30, -Math.PI / 2, -Math.PI / 2 + 0.7 * Math.PI * 2);
      ctx.stroke();
      const moods = ['happy', 'ok', 'impatient', 'angry'];
      for (let i = 0; i < moods.length; ++i)
        SZ.PeopleArt.drawMood(ctx, ix - 40 + i * 56, py + 420, moods[i], 26);
    } else if (helpPage === 1) {
      helpLines(px + 40, py + 90, [
        ['Tickets move themselves', 'Once an order is taken, its ticket walks through the stations on its own and waits at each one.'],
        ['Catch the green', 'Click a station, or press 1-5, when its needle is inside the green zone for a perfect step.'],
        ['Red burns', 'Let the needle run into the red field and the step burns — a burnt or raw step ruins the dish.'],
        ['Second slots', 'Kitchen upgrades add a second grill, burner, prep board and oven so two steps can run at once.'],
      ]);
      SZ.FoodArt.drawStation(ctx, 'grill', ix, py + 180, 'working', animT, 'burger');
      const bw = 150, bx = ix, by = py + 340;
      ui.roundRectPath(bx, by, bw, 12, 6);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fill();
      ctx.fillStyle = 'rgba(70,200,90,0.55)';
      ctx.fillRect(bx + 0.55 * bw / 1.25, by, 0.25 * bw / 1.25, 12);
      ctx.fillStyle = 'rgba(220,60,50,0.5)';
      ctx.fillRect(bx + bw / 1.25, by, 0.25 * bw / 1.25, 12);
      const nx = bx + ((0.55 + 0.25 * (0.5 + 0.5 * Math.sin(animT * 2))) * bw / 1.25);
      ctx.fillStyle = '#7dff8a';
      ctx.fillRect(nx - 2, by - 3, 4, 18);
      ui.drawKeycap('1', bx, by + 26, 12);
    } else if (helpPage === 2) {
      helpLines(px + 40, py + 90, [
        ['Serve from the pass', 'Finished dishes land on the pass. Click one to carry it to the guest waiting for that dish.'],
        ['Combo', 'Perfect dishes build a combo multiplier on the tips; a walkout or a ruined serve resets it.'],
        ['Trash', 'Click the bin to toss a ruined dish before it reaches a guest.'],
        ['Waiter', 'The Waiter upgrade carries finished dishes to waiting guests by itself.'],
      ]);
      SZ.FoodArt.drawDish(ctx, 'pasta', ix + 20, py + 200, 64, 1, 'perfect');
      ctx.fillStyle = '#3a3f46';
      ui.roundRectPath(ix + 120, py + 190, 44, 38, 5);
      ctx.fill();
      ctx.fillStyle = '#4a5058';
      ui.roundRectPath(ix + 116, py + 181, 52, 9, 4);
      ctx.fill();
      SZ.PeopleArt.drawChef(ctx, ix + 70, py + 420, 'cheer', animT);
    } else {
      helpLines(px + 40, py + 90, [
        ['Career', 'Thirty days across five venues. Earn at least one star to unlock the next day; a full venue of stars opens the next. Stars land at $-goal thresholds.'],
        ['Endless Rush', 'Serve until three walkouts or three ruined dishes. The venue rotates and the clock tightens every eight guests; your best run is kept.'],
        ['Daily Special', 'One seeded menu per day — the same kitchen, guests and orders for everyone, twenty guests in.'],
        ['Kitchen tree', 'Coins from every day buy upgrades in five branches: Stations, Gear, Service, Charm and Pantry. They carry into every mode.'],
      ]);
    }

    if (helpPage > 0)
      drawButton('help-prev', '←', px + 20, py + ph - 56, 90, 40, { px: 18, action: () => { helpPage = Math.max(0, helpPage - 1); sfx('click', { volume: 0.4 }); } });
    if (helpPage < HELP_PAGES.length - 1)
      drawButton('help-next', '→', px + pw - 110, py + ph - 56, 90, 40, { px: 18, action: () => { helpPage = Math.min(HELP_PAGES.length - 1, helpPage + 1); sfx('click', { volume: 0.4 }); } });
    ui.drawKeyHints([
      { key: '←→', label: 'Pages' },
      { key: 'Esc', label: 'Back' },
    ], 640, 694, 900, 1);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    fillVisibleRect();
    const pw = 420, ph = 176;
    const px = VIEW_W / 2 - pw / 2, py = VIEW_H / 2 - ph / 2;
    ui.drawPanel(px, py, pw, ph, { accent: '#ff7a3a' });
    ui.drawHeadline('PAUSED', VIEW_W / 2, py + 48, pw - 48, 42, '#fff', '#ff7a3a');
    /* one row of equal-width buttons: side padding 28, gap 16, 52 high,
       24 px above the panel bottom */
    const btnW = (pw - 2 * 28 - 2 * 16) / 3;
    const btnY = py + ph - 24 - 52;
    drawButton('pause-resume', 'Resume', px + 28, btnY, btnW, 52,
      { px: 15, action: () => { state = STATE_PLAYING; updateWindowTitle(); updateStatus(); } });
    drawButton('pause-restart', 'Restart Day', px + 28 + btnW + 16, btnY, btnW, 52,
      { px: 15, action: () => startDay(mode, mode === 'career' ? dayIndex : 0) });
    drawButton('pause-menu', 'Menu', px + 28 + 2 * (btnW + 16), btnY, btnW, 52,
      { px: 15, action: () => setScreen(STATE_TITLE) });
  }

  function drawDayOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const px = 400, py = 110, pw = 480, ph = 424;
    const what = mode === 'career' ? 'Day ' : mode === 'daily' ? 'Daily ' : 'Rush ';
    ui.drawPanel(px, py, pw, ph, { title: what + dayInfo.id + ' — ' + location.name, accent: location.color });
    const headline = mode === 'career' ? (dayResult.stars > 0 ? 'Day complete!' : 'Closed at a loss')
      : mode === 'daily' ? 'Daily Special over!' : 'Rush over!';
    ui.drawHeadline(headline, VIEW_W / 2, py + 76, pw - 40, 30, '#fff', location.color);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode === 'career') {
      ctx.font = ui.uiFont(46, 'bold');
      for (let i = 0; i < 3; ++i) {
        const sx = VIEW_W / 2 - 62 + i * 62, sy = py + 132;
        if (i >= dayResult.stars) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillText('★', sx, sy);
          continue;
        }
        /* the star pops in at 1.4x and settles, one after another */
        const k = dayOverT - (0.35 + i * 0.35);
        if (k < 0) continue;
        const s = k < 0.25 ? 1.4 - 0.4 * (k / 0.25) : 1;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.scale(s, s);
        ctx.fillStyle = '#ffd23f';
        ctx.fillText('★', 0, 0);
        ctx.restore();
      }
    } else {
      const bestLine = 'Best $' + bestForMode() + (dayResult.newBest ? '  ·  NEW BEST' : '');
      ui.drawHeadline(bestLine, VIEW_W / 2, py + 132, pw - 120, 34, '#ffd23f', location.color);
    }
    const rows = mode === 'career' ? [
      ['Earned', '$' + Math.round(earnedShown)],
      ['Goals', '$' + dayInfo.goals.join(' / $')],
      ['Served', String(served)],
      ['Walkouts', String(walkouts)],
      ['Best combo', '×' + (1 + Math.min(1, bestCombo * 0.1)).toFixed(1)]
    ] : [
      ['Earned', '$' + Math.round(earnedShown)],
      ['Served', String(served)],
      ['Walkouts', String(walkouts)],
      ['Ruined dishes', String(ruinedServed)],
      ['Best combo', '×' + (1 + Math.min(1, bestCombo * 0.1)).toFixed(1)]
    ];
    for (let i = 0; i < rows.length; ++i) {
      const ry = py + 180 + i * 30;
      ctx.textAlign = 'left';
      ui.fitText(rows[i][0], px + 60, ry, 200, 15, { color: 'rgba(255,255,255,0.65)' });
      ctx.textAlign = 'right';
      ui.fitText(rows[i][1], px + pw - 60, ry, 200, 15, { weight: 'bold', color: '#fff' });
    }
    const nextEnabled = mode === 'career' && dayResult.stars >= 1 &&
      careerUnlocked(dayIndex + 1) && dayIndex + 1 < SZ.KitchenData.CAREER.length;
    /* one row of equal-width buttons: side padding 28, gap 16, 52 high,
       24 px above the panel bottom */
    const btnN = mode === 'career' ? 3 : 2;
    const btnW = (pw - 2 * 28 - (btnN - 1) * 16) / btnN;
    const btnY = py + ph - 24 - 52;
    if (mode === 'career') {
      drawButton('do-next', 'Next Day', px + 28, btnY, btnW, 52,
        { px: 17, accent: '#5cb85c', disabled: !nextEnabled, action: () => startDay('career', dayIndex + 1) });
      drawButton('do-retry', 'Retry', px + 28 + btnW + 16, btnY, btnW, 52,
        { px: 17, accent: '#e6b422', action: () => startDay('career', dayIndex) });
      drawButton('do-menu', 'Menu', px + 28 + 2 * (btnW + 16), btnY, btnW, 52,
        { px: 17, accent: '#8a90a0', action: () => setScreen(STATE_TITLE) });
    } else {
      drawButton('do-retry', 'Retry', px + 28, btnY, btnW, 52,
        { px: 17, accent: '#e6b422', action: () => startDay(mode, 0) });
      drawButton('do-menu', 'Menu', px + 28 + btnW + 16, btnY, btnW, 52,
        { px: 17, accent: '#8a90a0', action: () => setScreen(STATE_TITLE) });
    }
    if (mode === 'career' && !nextEnabled) {
      ctx.textAlign = 'center';
      ui.fitText(dayResult.stars < 1 ? 'Earn at least one star to move on.'
        : 'The career ends here — try endless later.', VIEW_W / 2, py + ph - 94, pw - 60, 12, { color: 'rgba(255,255,255,0.55)' });
    }
  }

  function draw() {
    beginFrame();
    hitAreas.length = 0;
    if (isMenuState(state)) {
      if (state === STATE_TITLE) drawTitleScreen();
      else if (state === STATE_CAREER) drawCareerScreen();
      else if (state === STATE_UPGRADES) drawUpgradesScreen();
      else if (state === STATE_RECIPES) drawRecipeBook();
      else drawHelp();
      if (menuFade > 0) {
        ctx.fillStyle = 'rgba(12,8,5,' + Math.min(1, menuFade / 0.5).toFixed(3) + ')';
        fillVisibleRect();
      }
      if (fade > 0) {
        ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, fade).toFixed(3) + ')';
        fillVisibleRect();
      }
      return;
    }
    ctx.save();
    screenShake.apply(ctx);
    scene.draw(ctx, animT, visibleRect());
    if (sceneFade > 0) {
      ctx.fillStyle = 'rgba(12,8,5,' + Math.min(1, sceneFade / 0.6).toFixed(3) + ')';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    drawCarpet();
    drawPass();
    drawCustomers();
    if (waiter) SZ.PeopleArt.drawCustomer(ctx, waiterLook, waiter.x, WAITER_Y, 'walk', animT, waiter.facing);
    drawStations();
    SZ.PeopleArt.drawChef(ctx, chefX, CHEF_Y, chefPose, animT);
    drawFlying();
    drawArcs();
    screenShake.restore(ctx);
    ctx.restore();
    drawCoins();
    drawRings();
    particles.draw(ctx);
    floatingText.draw(ctx);
    drawPops();
    if (rushTimer > 0) drawRushGlow();
    if (tension > 0) drawTension();
    drawHUD();
    if (comboBanner) drawComboBanner();
    if (edgeGlow > 0) drawEdgeGlow();
    drawTicketRail();
    if (state === STATE_PAUSED) drawPauseOverlay();
    if (state === STATE_DAY_OVER) drawDayOver();
    if (fade > 0) {
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, fade).toFixed(3) + ')';
      fillVisibleRect();
    }
  }

  /* Rush tension: a red vignette pulses at the screen edges while the day
     is a rush day or three guests wait at once. */
  function drawTension() {
    const a = tension * (0.10 + 0.05 * Math.sin(animT * 5));
    ctx.save();
    ctx.strokeStyle = 'rgba(224,60,50,' + a.toFixed(3) + ')';
    ctx.lineWidth = 22;
    ctx.strokeRect(11, 11, VIEW_W - 22, VIEW_H - 22);
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,90,70,' + (a * 0.8).toFixed(3) + ')';
    ctx.strokeRect(20, 20, VIEW_W - 40, VIEW_H - 40);
    ctx.restore();
  }

  /* the big COMBO ×n banner, popping in and fading out over a second */
  function drawComboBanner() {
    const k = comboBanner.t / 1.1;
    const s = k < 0.15 ? 1.4 - 0.4 * (k / 0.15) : 1;
    ctx.save();
    ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.translate(VIEW_W / 2, 130);
    ctx.scale(s, s);
    ui.drawHeadline('COMBO ×' + comboBanner.n, 0, 0, 600, 44, '#ffd23f', '#ff7a3a');
    ctx.restore();
  }

  /* one second of gold light along the screen edge when the combo steps up */
  function drawEdgeGlow() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,210,63,' + (0.35 * edgeGlow).toFixed(3) + ')';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, VIEW_W - 16, VIEW_H - 16);
    ctx.restore();
  }

  /* Golden edge glow while the Rush Hour Bell is ringing. */
  function drawRushGlow() {
    const a = 0.25 + 0.12 * Math.sin(animT * 7);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,210,63,' + a.toFixed(3) + ')';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, VIEW_W - 14, VIEW_H - 14);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,240,180,' + Math.min(1, a + 0.2).toFixed(3) + ')';
    ctx.strokeRect(12, 12, VIEW_W - 24, VIEW_H - 24);
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;
    animT += dt;

    if (state === STATE_PLAYING) {
      dayTime += dt;
      if (rushTimer > 0) rushTimer = Math.max(0, rushTimer - dt);
      if (sceneFade > 0) sceneFade = Math.max(0, sceneFade - dt);
      /* Endless Rush and Daily Special: every eight guests the venue rotates
         and the clock tightens, with a fade into the new room. */
      if (mode === 'endless' || mode === 'daily') {
        const phase = Math.floor(served / ENDLESS_PHASE);
        if (phase !== endlessPhase) {
          endlessPhase = phase;
          dayIndex = phase;
          dayInfo = SZ.KitchenData.endlessDay(phase);
          location = SZ.KitchenData.locationById(dayInfo.location);
          scene = SZ.KitchenScene.create(location.theme);
          sceneFade = 0.6;
          floatingText.add(VIEW_W / 2, 160, location.name, { color: location.color, size: 26 });
          updateStatus();
        }
      }
      if (spawned < spawnLimit()) {
        spawnTimer -= dt;
        if (spawnTimer <= 0 && spawnCustomer())
          spawnTimer = dayInfo.spawnEvery;
      }
      updateCustomers(dt);
      updateStations(dt);
      updateFlying(dt);
      updateWaiter(dt);
      updateChef(dt);
      /* rush moments: a rush day or a full counter of waiting guests */
      let waiting = 0;
      for (const c of customers)
        if (c.state === 'waiting') ++waiting;
      const tense = dayInfo.special === 'rush' || waiting >= 3;
      tension = tense ? Math.min(1, tension + dt * 1.5) : Math.max(0, tension - dt * 1.5);
      checkDayEnd();
    }

    if (state === STATE_DAY_OVER) {
      dayOverT += dt;
      /* stars pop one after another with rising coin sounds; three stars
         bring confetti */
      while (dayResult && starPopped < dayResult.stars && dayOverT >= 0.35 + starPopped * 0.35) {
        if (starPopped === 2 && dayResult.stars === 3) {
          particles.confetti(VIEW_W / 2 - 160, 250, 26);
          particles.confetti(VIEW_W / 2 + 160, 250, 26);
        }
        sfx('coin', { pitch: 1 + starPopped * 0.2, volume: 0.7 });
        ++starPopped;
      }
    }

    if (state !== STATE_PLAYING && tension > 0) tension = Math.max(0, tension - dt * 2);
    if (menuFade > 0) menuFade = Math.max(0, menuFade - dt);
    if (fade > 0) fade = Math.max(0, fade - dt * 3.5);
    if (earnedShown < earned)
      earnedShown = Math.min(earned, earnedShown + Math.max(3, (earned - earnedShown) * dt * 6));
    else earnedShown = earned;
    updateCoins(dt);
    updateFx(dt);
    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    draw();
    requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS & PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  const SCREEN_LABEL = {
    title: 'Title', career: 'Career', upgrades: 'Kitchen', recipes: 'Recipe Book', help: 'Help'
  };

  function updateStatus() {
    const dayEl = document.getElementById('statusDay');
    const moneyEl = document.getElementById('statusMoney');
    const servedEl = document.getElementById('statusCustomers');
    if (isMenuState(state)) {
      if (dayEl) dayEl.textContent = 'Screen: ' + SCREEN_LABEL[state];
      if (moneyEl) moneyEl.textContent = `Coins: $${save.coins}`;
      if (servedEl) servedEl.textContent = `Stars: ${countStars()} / 90`;
      return;
    }
    if (dayEl) dayEl.textContent = `Day: ${dayInfo ? dayInfo.id : SZ.KitchenData.CAREER[0].id}`;
    if (moneyEl) moneyEl.textContent = `Tips: $${earned}`;
    if (servedEl) servedEl.textContent = `Served: ${served}`;
  }

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHighScores() {
    try {
      const scores = loadHighScores();
      scores.push({ day: dayInfo.id, money: earned, served, date: Date.now() });
      scores.sort((a, b) => b.money - a.money);
      while (scores.length > MAX_HIGH_SCORES) scores.pop();
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(scores));
    } catch { /* file:// may block */ }
  }

  function showHighScores() {
    const scores = loadHighScores();
    const tbody = document.getElementById('highScoresBody');
    if (tbody) {
      tbody.innerHTML = scores.map((s, i) =>
        `<tr><td>${i + 1}</td><td>${s.day}</td><td>$${s.money}</td></tr>`
      ).join('');
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU BAR ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        setScreen(STATE_TITLE);
        break;
      case 'pause':
        if (state === STATE_PLAYING)
          state = STATE_PAUSED;
        else if (state === STATE_PAUSED)
          state = STATE_PLAYING;
        updateWindowTitle();
        break;
      case 'high-scores':
        showHighScores();
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function updateWindowTitle() {
    const suffix = state === STATE_PAUSED ? ' — Paused'
      : state === STATE_DAY_OVER ? ' — Day Complete'
      : isMenuState(state) ? ''
      : dayInfo ? ` — Day ${dayInfo.id}` : '';
    const title = `Cooking Game${suffix}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        setupCanvas();
      else if (msg === 'WM_THEMECHANGED')
        setupCanvas();
    });
  }

  window.addEventListener('resize', setupCanvas);

  /* Re-fit on maximize/restore/drag-resize of the desktop window */
  if (typeof ResizeObserver === 'function')
    new ResizeObserver(setupCanvas).observe(canvas);

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  function initGame() {
    state = STATE_TITLE;
    menuFade = 0.5;
    hitAreas.length = 0;
    menuCursor = 0;
    dayInfo = null;
    scene = null;
    customers = [];
    tickets = [];
    pass = [];
    flying = [];
    coins = [];
    earned = 0;
    served = 0;
    walkouts = 0;
    combo = 0;
    ruinedServed = 0;
    perfectServed = 0;
    rushTimer = 0;
    rushUsed = false;
    rescueUsed = false;
    endlessPhase = 0;
    sceneFade = 0;
    waiter = null;
    waiterLook = null;
    dayResult = null;
    arcs = [];
    pops = [];
    rings = [];
    earnedShown = 0;
    meterTick = 0;
    goalsHit = 0;
    comboBanner = null;
    edgeGlow = 0;
    tension = 0;
    dayOverT = 0;
    starPopped = 0;
    carpet = null;
    fade = 1;
    save = loadSave();
    particles.clear();
    floatingText.clear();
    updateWindowTitle();
    updateStatus();
  }

  SZ.Dialog.wireAll();

  const menuBar = new SZ.MenuBar({
    onAction: handleAction
  });

  /* let the page accept keyboard focus on the body so clicks keep the keys alive */
  document.body.tabIndex = -1;

  setupCanvas();
  initGame();
  SZ.GameAudio.attachMuteButton();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
