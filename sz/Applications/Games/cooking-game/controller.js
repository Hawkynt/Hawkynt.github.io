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
  const BAR_Y = 672, BAR_H = 12;
  const CHEF_Y = 704;
  const TRASH = { x: 1042, y: 374, r: 30 };
  const RAIL_X0 = 52, RAIL_Y = 452, RAIL_W = 120, RAIL_H = 86, RAIL_GAP = 12, RAIL_MAX = 9;
  const BUBBLE_DY = 158;          // order bubble above a seated guest
  const GUEST_SCALE = 1.22;       // guests are drawn a little larger than the sprites
  const STATION_ART = 1.25;       // the station art grows around its base
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
  const BELL = { x: 1246, y: 150, r: 15 };

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

  const fx = SZ.KitchenFX.create();
  const screenShake = new SZ.GameEffects.ScreenShake();

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
  let hitAreas = [], menuCursor = 0, mouseX = -1, mouseY = -1, mouseDown = false;
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
  let dayIntro = 0;             // seconds left on the 'Day 1-1' opening banner
  let starPopped = 0;           // day-end stars already popped with a coin sound
  let carpet = null;            // { x, t } VIP red-carpet shimmer at a seat
  let coach = null;             // { step, ticket, t, hideT } first-day coach marks
  let coachSkip = null;         // { x, y, w, h } the 'Skip tips' button as drawn
  let hudBump = 0;              // the earnings number bumps as a coin lands
  let trashWobble = 0;          // the bin rocks after a toss
  let hitFlash = null;          // { t, color } a short full-screen flash on a burn
  let chefFacing = 1;           // the chef looks toward the station he works at
  const stationPress = [0, 0, 0, 0, 0];   // a clicked station squashes for a beat

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
    dayIntro = 2.2;
    starPopped = 0;
    carpet = null;
    coach = mode === 'career' && index === 0 && !save.coached ? { step: 1, ticket: null, t: 0, hideT: 0 } : null;
    coachSkip = null;
    fade = 1;
    dailyDate = dateKey(new Date());
    rand = mode === 'daily' ? SZ.KitchenData.rng(SZ.KitchenData.dailySeed(new Date())) : Math.random;
    chefX = chefSpotX(1);
    chefTargetX = chefX;
    chefFacing = -1;
    chefPose = 'idle';
    chefTimer = 0;
    hudBump = 0;
    trashWobble = 0;
    hitFlash = null;
    fx.clear();
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

  /* the chef works from the gap right of a station, so he never hides a gauge */
  function chefSpotX(i) { return stationX(i) + STATION_W + (STATION_STEP - STATION_W) / 2; }

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
      fx.emit('star', seatX(seat), SEAT_Y - 90, 14, { color: '#ffd23f', speed: 180 });
      fx.emit('glow', seatX(seat), SEAT_Y - 90, 1, { color: '#ffd23f', size: 160 });
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
        if (c.x >= seatX(c.seat)) { c.x = seatX(c.seat); c.state = 'waiting'; c.bubbleT = animT; sfx('blip', { pitch: 1.8, volume: 0.2 }); }
      } else if (c.state === 'waiting') {
        c.patience -= dt;
        c.mood = moodFor(c);
        /* impatient guests sweat, angry ones fume */
        c.emoteT = (c.emoteT || 0) - dt;
        if (c.emoteT <= 0 && (c.mood === 'impatient' || c.mood === 'angry')) {
          const top = SEAT_Y - 95 * GUEST_SCALE;
          if (c.mood === 'angry') {
            c.emoteT = 0.35;
            fx.emit('steam', c.x + (Math.random() < 0.5 ? -22 : 22), top + 8, 2, { color: '#ffffff', speed: 30, scale: 0.8, alpha: 0.8 });
            if (Math.random() < 0.3) fx.emit('smoke', c.x, top, 1, { color: '#e04040', speed: 20, scale: 0.6, alpha: 0.4 });
          } else {
            c.emoteT = 1.1;
            fx.emit('drop', c.x + 20, top + 12, 1, { color: '#6ab8f0', speed: 40, angle: -Math.PI / 3, spread: 0.6 });
          }
        }
        if (c.patience <= 0) {
          c.state = 'leaving';
          c.mood = 'angry';
          c.leaveT = 0;
          combo = 0;
          ++walkouts;
          cancelTicket(c);
          fx.text(c.x, SEAT_Y - 150, 'Too slow!', { color: '#ff6a5a', size: 24 });
          /* the anger puff: a short red cloud over the empty seat */
          fx.emit('smoke', c.x, SEAT_Y - 100, 7, { color: '#d04040', speed: 70 });
          fx.emit('steam', c.x, SEAT_Y - 110, 4, { color: '#ffffff', speed: 40 });
          pushRing(c.x, SEAT_Y - 90, 8, '#e04545');
          sfx('hurt', { volume: 0.6 });
        }
      } else if (c.state === 'eating') {
        c.eatTimer -= dt;
        /* crumbs fall while the guest chews */
        c.crumbT -= dt;
        if (c.crumbT <= 0) {
          c.crumbT = 0.35;
          fx.emit('crumb', c.x + 8, SEAT_Y - 40, 2, { colors: ['#c8904a', '#e8c070', '#8a5a2a'], speed: 60, angle: -Math.PI / 2, spread: 2.4 });
          if (Math.random() < 0.3) fx.emit('heart', c.x + (Math.random() - 0.5) * 30, SEAT_Y - 90, 1, { color: '#ff5a7a', speed: 30, size: 16 });
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
    const ticket = { id: ++ticketSeq, recipe, customer: c, stepIndex: 0, results: [], waitingFor: recipe.steps[0].station, done: false, born: animT };
    fx.emit('star', c.x, SEAT_Y - BUBBLE_DY, 6, { color: '#ffffff', speed: 120 });
    c.ticket = ticket;
    tickets.push(ticket);
    sfx('select');
    if (coach && coach.step === 1) coachAdvance(2, ticket);
  }

  /* ══════════════════════════════════════════════════════════════════
     COACH MARKS — a guided first order on career day 1-1
     ══════════════════════════════════════════════════════════════════ */

  function coachAdvance(step, ticket) {
    coach.step = step;
    if (ticket) coach.ticket = ticket;
    coach.t = 0;
  }

  function endCoach() {
    coach = null;
    coachSkip = null;
    save.coached = true;
    writeSave();
  }

  /* the first order stays calm: no second guest until its dish is up */
  function coachHoldsSpawn() {
    return !!coach && coach.step < 4 && customers.some(c => c.state === 'walkIn' || c.state === 'waiting');
  }

  function updateCoach(dt) {
    if (!coach) return;
    coach.t += dt;
    const t = coach.ticket;
    if (coach.step >= 2 && coach.step <= 4) {
      /* the coached order walked out or went to the bin: start over */
      if (tickets.indexOf(t) < 0 && !pass.some(d => d.ticket === t) && !flying.some(f => f.ticket === t)) {
        coach.step = 1;
        coach.ticket = null;
        coach.t = 0;
        return;
      }
      if (coach.step < 4 && pass.some(d => d.ticket === t)) coachAdvance(4, null);
    } else if (coach.step === 5) {
      coach.hideT -= dt;
      if (coach.hideT <= 0) coach.step = 6;
    }
  }

  function slotStationOf(t) {
    for (let i = 0; i < SZ.KitchenData.STATION_ORDER.length; ++i)
      for (const s of stations[SZ.KitchenData.STATION_ORDER[i]].slots)
        if (s.ticket === t) return i;
    return -1;
  }

  /* What the current hint says and the box it points at (null: nothing). */
  function coachTarget() {
    const t = coach.ticket;
    if (coach.step === 1) {
      const c = customers.find(g => g.state === 'waiting' && !g.ticket);
      if (!c) return null;
      return { text: 'Click the customer to take the order', place: 'side',
        x: c.x - 48, y: SEAT_Y - BUBBLE_DY - 42, w: 96, h: BUBBLE_DY + 48 };
    }
    if (coach.step === 2 || coach.step === 3) {
      if (!t || t.done) return null;
      let i = slotStationOf(t);
      if (i < 0) {
        if (coach.step === 2) return null;
        i = SZ.KitchenData.STATION_ORDER.indexOf(t.waitingFor);
      }
      const name = SZ.KitchenData.STATIONS[SZ.KitchenData.STATION_ORDER[i]].name;
      const text = coach.step === 2
        ? 'Click the ' + name + ' (or press ' + (i + 1) + ') while the needle is in the green zone'
        : 'Next step: the ' + name.toLowerCase() + ' station (' + (i + 1) + ')';
      return { text: text, place: 'station',
        x: stationX(i) - 6, y: RAIL_Y + RAIL_H + 4, w: STATION_W + 12, h: BAR_Y + BAR_H + 19 - RAIL_Y - RAIL_H };
    }
    if (coach.step === 4) {
      const i = pass.findIndex(d => d.ticket === t);
      if (i < 0) return null;
      return { text: 'Click the dish to serve it', place: 'side',
        x: passX(i) - 40, y: PASS_Y - 40, w: 80, h: 80 };
    }
    if (coach.step === 5)
      return { text: 'Perfect dishes build your combo and tips. Keep it up!', place: 'center' };
    return null;
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
      fx.text(cx, STATION_Y - 10, 'Saved!', { color: '#ffd23f', size: 22 });
      fx.emit('star', cx, STATION_Y + 50, 10, { color: '#ffd23f', speed: 160 });
      sfx('powerup', { volume: 0.5 });
    } else if (quality === 'perfect') {
      pushPop(cx, STATION_Y - 16, 'PERFECT!', '#ffd23f', 22);
      fx.emit('glow', cx, STATION_Y + 50, 1, { color: '#ffb030', size: 150, alpha: 0.6 });
      fx.emit('star', cx, STATION_Y + 50, 12, { color: '#ffd23f', speed: 220 });
      fx.emit('spark', cx, STATION_Y + 50, 10, { color: '#fff0a0', speed: 260, gravity: 200 });
      sfx('pickup', { pitch: 1 + combo * 0.08 });
      if (!auto) { chefTargetX = chefSpotX(SZ.KitchenData.STATION_ORDER.indexOf(stationId)); chefPose = 'cheer'; chefTimer = 0.5; }
    } else if (quality === 'burnt') {
      pushPop(cx, STATION_Y - 16, 'Oops!', '#f55', 20);
      fx.emit('smoke', cx, STATION_Y + 40, 10, { color: '#3a3430', speed: 90 });
      fx.emit('spark', cx, STATION_Y + 50, 14, { color: '#ff5a1a', speed: 240 });
      fx.emit('glow', cx, STATION_Y + 50, 1, { color: '#ff3a1a', size: 220 });
      screenShake.trigger(9, 320);
      hitFlash = { t: 0.25, color: '255,60,30' };
      sfx('smallExplode');
      sfx('error', { volume: 0.5 });
    } else if (quality === 'raw') {
      pushPop(cx, STATION_Y - 16, 'Oops!', '#f55', 18);
      fx.emit('smoke', cx, STATION_Y + 40, 6, { color: '#8a8478', speed: 60 });
      screenShake.trigger(5, 220);
      sfx('error', { volume: 0.5 });
    } else {
      pushPop(cx, STATION_Y - 12, 'Good', '#cfd6e4', 14);
      sfx('blip');
    }
    if (coach && coach.ticket === t && coach.step === 2 && !t.done) coachAdvance(3, t);
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
          fx.emit('chip', px - 13, STATION_Y + 76, 3, { colors: ['#e8452a', '#6cc04a', '#f2cf5a', '#f4f0e0'], speed: 180, angle: -Math.PI / 2, spread: 2.2 });
          sfx('thud', { pitch: 1.8, volume: 0.12 });
        }
      }
    } else s.chopF = -1;
    s.fxT -= dt;
    if (s.fxT > 0) return;
    if (s.state === 'burning') {
      s.fxT = 0.18;
      fx.emit('smoke', px + (Math.random() - 0.5) * 40, STATION_Y + 40, 1, { color: '#3e3834', speed: 25, scale: 1.4 });
      if (Math.random() < 0.5) fx.emit('spark', px, STATION_Y + 50, 2, { color: '#ff5a1a', speed: 140 });
    } else if (id === 'grill') {
      s.fxT = 0.09;
      fx.emit('ember', px + (Math.random() - 0.5) * 90, STATION_Y + 52, 1, { color: '#ffb03a', speed: 30 });
      if (Math.random() < 0.25) fx.emit('smoke', px + (Math.random() - 0.5) * 50, STATION_Y + 40, 1, { color: '#9a9088', alpha: 0.35, speed: 10 });
    } else if (id === 'stove') {
      s.fxT = 0.22;
      fx.emit('steam', px - 25 + (Math.random() - 0.5) * 20, STATION_Y + 14, 1, { color: '#f4f6f8', speed: 12 });
    } else if (id === 'oven') {
      s.fxT = 0.5;
      fx.emit('steam', px + (Math.random() - 0.5) * 50, STATION_Y + 2, 1, { color: '#f4f0e8', speed: 8, alpha: 0.35 });
    } else {
      s.fxT = 0.35;
      if (s.state === 'ready' || Math.random() < 0.4) fx.emit('star', px + (Math.random() - 0.5) * 60, STATION_Y + 70, 1, { color: '#ffd23f', speed: 30, gravity: -20 });
    }
  }

  function clickStation(i) {
    const id = SZ.KitchenData.STATION_ORDER[i];
    chefTargetX = chefSpotX(i);
    stationPress[i] = 0.18;
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
    if (Math.abs(d) > 4) {
      chefX += Math.sign(d) * Math.min(Math.abs(d), 420 * dt);
      chefFacing = Math.sign(d);
      if (Math.random() < dt * 6) fx.emit('steam', chefX - chefFacing * 14, CHEF_Y - 2, 1, { color: '#e8dccc', speed: 8, scale: 0.45, alpha: 0.3 });
    } else chefFacing = -1;
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
        fx.text(px, PASS_Y - 50, 'No one waiting', { color: '#ffb0a0', size: 16 });
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
      fx.text(TRASH.x, TRASH.y - 46, 'Nothing to trash', { color: '#e0d0c0', size: 15 });
      sfx('click');
      return true;
    }
    pass.splice(i, 1);
    trashWobble = 0.5;
    fx.emit('smoke', TRASH.x, TRASH.y - 18, 5, { color: '#6a6460', speed: 50 });
    fx.emit('crumb', TRASH.x, TRASH.y - 18, 8, { colors: ['#3a2a20', '#5a4a3a'], speed: 120, angle: -Math.PI / 2, spread: 1.6 });
    sfx('drop', { pitch: 0.5 });
    return true;
  }

  function serveTo(f, c) {
    const recipe = SZ.KitchenData.recipeById(f.recipe);
    if (f.quality === 'ruined') {
      combo = 0;
      ++ruinedServed;
      c.mood = 'angry';
      fx.text(c.x, SEAT_Y - 140, 'Ruined!', { color: '#ff5a4a', size: 24 });
      fx.emit('smoke', c.x, SEAT_Y - 90, 8, { color: '#4a4440', speed: 60 });
      screenShake.trigger(6, 240);
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
      fx.text(c.x, SEAT_Y - 150, '+$' + tip, { color: '#ffe060', size: 30, rise: 60, life: 1.3 });
      const nCoins = spawnTipCoins(c.x, tip);
      fx.emit('coin', c.x, SEAT_Y - 90, Math.min(8, 2 + Math.floor(tip / 15)), { speed: 260, angle: -Math.PI / 2, spread: 1.6 });
      fx.emit('confetti', c.x, SEAT_Y - 80, f.quality === 'perfect' ? 22 : 10, { speed: 320, angle: -Math.PI / 2, spread: 1.8 });
      fx.emit('glow', c.x, SEAT_Y - 70, 1, { color: '#ffe080', size: 150 });
      /* the tip coin rides the size of the shower: more coins, higher chirp */
      sfx('coin', { pitch: 1 + (nCoins - 3) * 0.12, volume: 0.6 });
      c.hop = 0.4;
      if (f.quality === 'perfect') {
        chefPose = 'cheer';
        chefTimer = 0.9;
        fx.emit('heart', c.x, SEAT_Y - 100, 5, { color: '#ff5a7a', speed: 90 });
        fx.emit('star', c.x, SEAT_Y - 90, 8, { color: '#ffd23f', speed: 200 });
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
    if (coach && coach.step === 4 && f.ticket === coach.ticket) {
      coachAdvance(5, null);
      coach.hideT = 4;
    }
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
      fx.emit('star', gx, HUD_PY + 74, 14, { color: '#ffd23f', speed: 220 });
      fx.emit('glow', gx, HUD_PY + 74, 1, { color: '#ffd23f', size: 180 });
      pushRing(gx, HUD_PY + 74, 6, '#ffd23f');
      fx.text(VIEW_W / 2, 170, '★ Goal reached! ★', { color: '#ffd23f', size: 34, life: 1.6, rise: 40 });
      fx.emit('confetti', VIEW_W / 2, 170, 30, { speed: 420, angle: -Math.PI / 2, spread: 2.2 });
      sfx('levelup', { volume: 0.6 });
      ++goalsHit;
    }
  }

  /* Crossing a combo step: banner, gold edge glow and a rising fanfare. */
  function comboFanfare(n) {
    comboBanner = { n: n, t: 0 };
    edgeGlow = 1;
    screenShake.trigger(4, 260);
    fx.emit('confetti', VIEW_W / 2, 150, 40, { speed: 520, angle: -Math.PI / 2, spread: 2.6 });
    fx.emit('flame', VIEW_W / 2, 170, 16, { color: '#ff7a1a', speed: 220 });
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
      fx.text(f.customer.x, SEAT_Y - 140, 'Gone!', { color: '#ffb0a0', size: 18 });
      sfx('error', { volume: 0.4 });
      return;
    }
    fx.emit('smoke', f.customer.x, SEAT_Y - 60, 6, { color: '#6a6460', speed: 50 });
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
      fx.emit('glow', f.x, f.y, 1, { color: f.quality === 'perfect' ? '#ffd23f' : '#fff4d8', size: f.quality === 'perfect' ? 46 : 30, speed: 0, life: 0.3, alpha: 0.7 });
      if (f.quality === 'perfect') fx.emit('spark', f.x, f.y, 1, { color: '#ffe080', speed: 30, gravity: 0, life: 0.4 });
    }
  }

  function updateCoins(dt) {
    for (let i = coins.length - 1; i >= 0; --i) {
      const c = coins[i];
      c.t += dt;
      if (c.t >= COIN_TIME) {
        coins.splice(i, 1);
        meterTick = 0.25;
        hudBump = 0.3;
        fx.emit('spark', COIN_TX, COIN_TY, 3, { color: '#ffd23f', speed: 140 });
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
      if (pops[i].t > 0.7) pops.splice(i, 1);
    }
    if (hudBump > 0) hudBump = Math.max(0, hudBump - dt);
    if (trashWobble > 0) trashWobble = Math.max(0, trashWobble - dt);
    for (let i = 0; i < stationPress.length; ++i)
      if (stationPress[i] > 0) stationPress[i] = Math.max(0, stationPress[i] - dt);
    if (hitFlash) {
      hitFlash.t -= dt;
      if (hitFlash.t <= 0) hitFlash = null;
    }
    for (let i = rings.length - 1; i >= 0; --i) {
      rings[i].t += dt;
      if (rings[i].t > 0.5) rings.splice(i, 1);
    }
    if (meterTick > 0) meterTick = Math.max(0, meterTick - dt);
    if (dayIntro > 0 && state === STATE_PLAYING) dayIntro = Math.max(0, dayIntro - dt);
    if (edgeGlow > 0) edgeGlow = Math.max(0, edgeGlow - dt);
    if (comboBanner) {
      comboBanner.t += dt;
      if (comboBanner.t > 1.5) comboBanner = null;
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
      fx.text(BELL.x - 30, BELL.y - 30, 'Already used', { color: '#ffb0a0', size: 14 });
      sfx('error', { volume: 0.4 });
      return;
    }
    rushUsed = true;
    rushTimer = RUSH_TIME;
    fx.text(VIEW_W / 2, 210, 'RUSH HOUR!', { color: '#ffd23f', size: 44, life: 1.6 });
    fx.emit('confetti', VIEW_W / 2, 210, 30, { speed: 420, angle: -Math.PI / 2, spread: 2.4 });
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
    if (coach) {
      coach = null;
      save.coached = true;
    }
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
      stats: { days: 0, served: 0, perfect: 0 },
      coached: false
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
          if (o.coached === true) s.coached = true;
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

  /* a bought upgrade bursts with coins, stars and confetti */
  function celebrateBuy(card) {
    const cx = card.x + card.w / 2, cy = card.y + card.h / 2;
    fx.emit('coin', cx, cy, 10, { speed: 360, angle: -Math.PI / 2, spread: 2.4 });
    fx.emit('star', cx, cy, 14, { color: '#ffd23f', speed: 260 });
    fx.emit('confetti', cx, cy, 24, { speed: 420, angle: -Math.PI / 2, spread: 2.2 });
    fx.emit('glow', cx, cy, 1, { color: '#ffd890', size: 360 });
    fx.text(cx, card.y - 6, 'Installed!', { color: '#9af07a', size: 26 });
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

  /* A candy button: glossy face over a 3D lip; the hot one grows, bobs and
     glows. opts: color ('orange' | 'green' | 'red' | 'blue' | 'gold' | 'wood'),
     sub, px, disabled, action */
  function drawButton(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const index = registerHit(id, x, y, w, h, opts.action, opts.disabled);
    const hot = isHot(index, x, y, w, h) && !opts.disabled;
    const pressed = hot && mouseDown;
    const s = hot ? 1.05 + Math.sin(animT * 6) * 0.012 : 1;
    const bob = opts.bob !== undefined ? Math.sin(animT * 2.2 + opts.bob * 0.9) * 1.5 : 0;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2 + bob);
    ctx.scale(s, s);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    if (hot) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ui.drawGlow(x + w / 2, y + h / 2, Math.max(w, h) * 1.25, '#ffc860');
      ctx.restore();
    }
    ui.drawButtonFace(x, y, w, h, label, { color: opts.color || 'orange', hot: hot, pressed: pressed, disabled: opts.disabled, sub: opts.sub, px: opts.px });
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
    const s = Math.round(size);
    const img = cachedSprite('lock|' + s, s, s * 1.1, (c) => {
      c.strokeStyle = '#4a3010';
      c.lineWidth = s * 0.2;
      c.beginPath();
      c.arc(s / 2, s * 0.42, s * 0.28, Math.PI, 0);
      c.stroke();
      c.strokeStyle = '#d8dce4';
      c.lineWidth = s * 0.12;
      c.stroke();
      const g = c.createLinearGradient(0, s * 0.4, 0, s);
      g.addColorStop(0, '#fff0b0');
      g.addColorStop(0.5, '#e0b048');
      g.addColorStop(1, '#8a5a14');
      c.fillStyle = g;
      rrPath(c, s * 0.12, s * 0.42, s * 0.76, s * 0.58, s * 0.1);
      c.fill();
      c.strokeStyle = '#4a3010';
      c.lineWidth = Math.max(1, s * 0.04);
      c.stroke();
      c.fillStyle = '#3a2008';
      c.beginPath();
      c.arc(s / 2, s * 0.66, s * 0.08, 0, Math.PI * 2);
      c.fill();
      c.fillRect(s / 2 - s * 0.03, s * 0.66, s * 0.06, s * 0.16);
    });
    ctx.drawImage(img, cx - s / 2, cy - s * 0.6, s, s * 1.1);
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
    menuScene(theme).drawFront(ctx);
    ctx.fillStyle = 'rgba(8,6,4,' + alpha + ')';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    /* the kitchen line sinks into shadow so the menu owns the screen */
    const fadeImg = cachedSprite('menufade', 4, 128, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 128);
      g.addColorStop(0, 'rgba(10,5,2,0)');
      g.addColorStop(0.6, 'rgba(10,5,2,0.75)');
      g.addColorStop(1, 'rgba(10,5,2,0.92)');
      c.fillStyle = g;
      c.fillRect(0, 0, 4, 128);
    });
    ctx.drawImage(fadeImg, v.x0, 520, v.x1 - v.x0, Math.max(200, v.y1 - 520));
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

    if (coachSkip && mx >= coachSkip.x && mx <= coachSkip.x + coachSkip.w && my >= coachSkip.y && my <= coachSkip.y + coachSkip.h) {
      endCoach();
      sfx('click');
      return;
    }

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
    mouseDown = true;

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
          if (buyNode(card.node.id)) {
            treeBuyFlash = { id: card.node.id, at: animT };
            celebrateBuy(card);
          }
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
    mouseDown = false;
  });

  canvas.addEventListener('pointerup', () => { mouseDown = false; });

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
        if (treeSelected && buyNode(treeSelected)) {
          treeBuyFlash = { id: treeSelected, at: animT };
          const card = treeCardById(treeSelected);
          if (card) celebrateBuy(card);
        }
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

  /* ── small cached sprites for the play screen (painted once at 2x) ── */
  const spriteCache = {};

  function cachedSprite(key, w, h, paint) {
    let s = spriteCache[key];
    if (s) return s;
    s = document.createElement('canvas');
    s.width = Math.ceil(w * 2);
    s.height = Math.ceil(h * 2);
    const c = s.getContext('2d');
    c.scale(2, 2);
    paint(c, w, h);
    spriteCache[key] = s;
    return s;
  }

  function rrPath(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  /* the white speech bubble over a seated guest: 96 x 100, tail at the bottom */
  function bubbleSprite() {
    return cachedSprite('bubble', 96, 104, (c) => {
      c.fillStyle = 'rgba(40,20,0,0.28)';
      c.beginPath();
      c.arc(49, 52, 40, 0, Math.PI * 2);
      c.fill();
      const g = c.createLinearGradient(0, 8, 0, 92);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#f2e8d4');
      c.beginPath();
      c.arc(48, 48, 40, 1.84, 1.23 + Math.PI * 2);
      c.lineTo(49, 102);
      c.closePath();
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = '#5a3a1e';
      c.lineWidth = 2.5;
      c.lineJoin = 'round';
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      c.ellipse(32, 22, 12, 6, -0.6, 0, Math.PI * 2);
      c.fill();
    });
  }

  function checkSprite() {
    return cachedSprite('check', 26, 26, (c) => {
      const g = c.createLinearGradient(0, 2, 0, 24);
      g.addColorStop(0, '#9af07a');
      g.addColorStop(1, '#2e9a2a');
      c.fillStyle = 'rgba(0,40,0,0.35)';
      c.beginPath();
      c.arc(13.5, 14.5, 11, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = g;
      c.beginPath();
      c.arc(13, 13, 11, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#1a5a14';
      c.lineWidth = 1.5;
      c.stroke();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(8, 13.5);
      c.lineTo(12, 17.5);
      c.lineTo(18.5, 9);
      c.stroke();
    });
  }

  function shadowSprite() {
    return cachedSprite('shadow', 64, 20, (c) => {
      c.save();
      c.translate(32, 10);
      c.scale(1, 0.3);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 32);
      g.addColorStop(0, 'rgba(20,8,0,0.55)');
      g.addColorStop(1, 'rgba(20,8,0,0)');
      c.fillStyle = g;
      c.fillRect(-32, -32, 64, 64);
      c.restore();
    });
  }

  function trashSprite() {
    return cachedSprite('trash', 64, 72, (c) => {
      const body = c.createLinearGradient(12, 0, 52, 0);
      body.addColorStop(0, '#5a626a');
      body.addColorStop(0.3, '#d8dee4');
      body.addColorStop(0.6, '#9aa2aa');
      body.addColorStop(1, '#4a525a');
      c.fillStyle = 'rgba(20,8,0,0.35)';
      c.beginPath();
      c.ellipse(32, 66, 26, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = body;
      c.beginPath();
      c.moveTo(13, 24);
      c.lineTo(51, 24);
      c.lineTo(47, 66);
      c.lineTo(17, 66);
      c.closePath();
      c.fill();
      c.strokeStyle = '#2a3036';
      c.lineWidth = 1.5;
      c.stroke();
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 4; ++i) {
        c.beginPath();
        c.moveTo(21 + i * 7.5, 30);
        c.lineTo(22 + i * 6.8, 60);
        c.stroke();
      }
      const lid = c.createLinearGradient(0, 14, 0, 26);
      lid.addColorStop(0, '#f2f4f6');
      lid.addColorStop(1, '#6a727a');
      c.fillStyle = lid;
      c.beginPath();
      c.ellipse(32, 22, 22, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#3a4046';
      rrPath(c, 26, 11, 12, 6, 3);
      c.fill();
      c.fillStyle = '#e8463a';
      c.beginPath();
      c.arc(32, 46, 7, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(28.5, 42.5);
      c.lineTo(35.5, 49.5);
      c.moveTo(35.5, 42.5);
      c.lineTo(28.5, 49.5);
      c.stroke();
    });
  }

  function patienceColor(f) {
    return f > 0.5 ? '#5ad04a' : f > 0.25 ? '#f2b822' : '#ff4a3a';
  }

  function drawOrderBubble(c) {
    const f = Math.max(0, c.patience / c.patienceMax);
    /* the bubble bobs gently; an untaken order bounces to invite a click,
       an impatient one trembles */
    const shake = f < 0.25 ? Math.sin(animT * 40 + c.seat) * 2 : 0;
    const bob = c.ticket ? Math.sin(animT * 2 + c.seat) * 1.5 : -Math.abs(Math.sin(animT * 5 + c.seat)) * 5;
    const pop = c.bubbleT !== undefined ? Math.min(1, (animT - c.bubbleT) / 0.25) : 1;
    const s = pop < 1 ? 0.3 + 0.7 * (1 - Math.pow(1 - pop, 3)) + Math.sin(pop * Math.PI) * 0.15 : 1;
    const bx = c.x + shake, by = SEAT_Y - BUBBLE_DY + bob;
    ctx.save();
    ctx.translate(bx, by + 50);
    ctx.scale(s, s);
    ctx.translate(-bx, -(by + 50));
    ctx.drawImage(bubbleSprite(), bx - 48, by - 48, 96, 104);
    /* patience ring: dark track, coloured arc, a pulse when it runs low */
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(60,40,20,0.18)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(bx, by, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = patienceColor(f);
    ctx.lineWidth = f < 0.25 ? 6 + Math.sin(animT * 14) * 1.5 : 6;
    ctx.beginPath();
    ctx.arc(bx, by, 34, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';
    SZ.FoodArt.drawDish(ctx, c.order, bx, by + 2, 64, 1, 'good');
    if (c.ticket) ctx.drawImage(checkSprite(), bx + 18, by - 44, 26, 26);
    ctx.restore();
    SZ.PeopleArt.drawMood(ctx, bx + 58, by - 18 + Math.sin(animT * 3 + c.seat) * 2, c.mood, 30);
  }

  function customerPose(c) {
    return c.state === 'walkIn' ? 'walk'
      : c.state === 'waiting' ? (c.mood === 'angry' ? 'angry' : c.mood === 'impatient' ? 'fret' : 'sit')
      : c.state === 'eating' ? 'eat'
      : (c.mood === 'angry' ? 'angry' : 'happy');
  }

  function drawCustomers() {
    const sorted = customers.slice().sort((a, b) => a.x - b.x);
    for (const c of sorted) {
      /* a little hop when the dish arrives */
      const hopY = c.hop > 0 ? -Math.sin((1 - c.hop / 0.4) * Math.PI) * 16 : 0;
      ctx.save();
      ctx.translate(c.x, SEAT_Y + hopY);
      ctx.scale(GUEST_SCALE, GUEST_SCALE);
      SZ.PeopleArt.drawCustomer(ctx, c.look, 0, 0, customerPose(c), animT + c.seat * 0.37, 1);
      ctx.restore();
    }
  }

  /* bubbles, moods and cards sit above the counter layer */
  function drawCustomerOverlays() {
    for (const c of customers) {
      if (c.state === 'waiting') drawOrderBubble(c);
      else if (c.state === 'eating') {
        SZ.FoodArt.drawDish(ctx, c.order, c.x - 4, SEAT_Y + 4, 54, 1, 'good');
      } else if (c.state === 'leaving') {
        SZ.PeopleArt.drawMood(ctx, c.x + 44, SEAT_Y - 128 - c.leaveT * 10, c.mood === 'angry' ? 'angry' : 'love', 30);
        if (c.wave > 0) drawWave(c);
        if (c.rating > 0 && c.leaveT < 1.8) drawRatingCard(c);
      }
    }
  }

  /* a small hand waving goodbye beside the head */
  function drawWave(c) {
    ctx.save();
    ctx.translate(c.x + 36, SEAT_Y - 92);
    ctx.rotate(Math.sin(animT * 12) * 0.5);
    ctx.fillStyle = c.look.skin;
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 1.5;
    ui.roundRectPath(-5, -13, 10, 17, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /* the critic holds up the score card for a moment before vanishing */
  function drawRatingCard(c) {
    const rx = c.x, ry = SEAT_Y - 186;
    ctx.save();
    if (c.leaveT > 1.4) ctx.globalAlpha = (1.8 - c.leaveT) / 0.4;
    const k = Math.min(1, c.leaveT / 0.2);
    ctx.translate(rx, ry);
    ctx.scale(0.5 + 0.5 * k, 0.5 + 0.5 * k);
    ui.drawPanel(-62, -20, 124, 40, { style: 'paper', radius: 6, accent: '#c04cff' });
    for (let i = 0; i < 5; ++i)
      ui.drawStar(-44 + i * 22, 2, 20, i < c.rating);
    ctx.restore();
  }

  function drawTrash() {
    const hot = mouseX >= TRASH.x - 30 && mouseX <= TRASH.x + 30 && mouseY >= TRASH.y - 36 && mouseY <= TRASH.y + 30;
    const wob = trashWobble > 0 ? Math.sin(trashWobble * 40) * trashWobble * 0.3 : 0;
    ctx.save();
    ctx.translate(TRASH.x, TRASH.y + 22);
    ctx.rotate(wob);
    if (hot && pass.some(d => d.quality === 'ruined')) SZ.FoodArt.drawHalo(ctx, 0, -26, 110, 90, 'red', 0.5);
    ctx.drawImage(trashSprite(), -28, -63, 56, 63);
    ctx.restore();
  }

  function drawPass() {
    const sh = shadowSprite();
    for (let i = 0; i < pass.length; ++i) {
      const d = pass[i];
      const px = passX(i);
      const hot = Math.abs(mouseX - px) <= 40 && Math.abs(mouseY - PASS_Y) <= 40;
      ctx.drawImage(sh, px - 44, PASS_Y + 14, 88, 24);
      if (hot) SZ.FoodArt.drawHalo(ctx, px, PASS_Y, 130, 110, d.quality === 'ruined' ? 'red' : 'gold', 0.55);
      /* squash-pop as an arced dish settles on the pass */
      const bounce = d.bounce > 0 ? 1 + 0.22 * Math.sin((d.bounce / 0.3) * Math.PI) : 1;
      const lift = hot ? -4 : 0;
      ctx.save();
      ctx.translate(px, PASS_Y + 24 + lift);
      ctx.scale(2 - bounce, bounce);
      ctx.translate(-px, -(PASS_Y + 24));
      SZ.FoodArt.drawDish(ctx, d.recipe, px, PASS_Y, 88, 1, d.quality);
      ctx.restore();
      /* a serveable dish sparkles now and then */
      if (d.quality !== 'ruined' && serveTarget(d) && Math.sin(animT * 3 + i * 2) > 0.97)
        fx.emit('star', px + (Math.random() - 0.5) * 50, PASS_Y - 10, 1, { color: '#fff6c0', speed: 20, gravity: -10 });
    }
    drawTrash();
  }

  /* The progress gauge on the station's instrument plate: dark track, the
     cooked part filling amber, a glowing green zone, a hazard-red burn field
     and a bright needle. */
  function drawSlotBar(x, w, slot) {
    const t = slot.ticket;
    const step = t && !t.done ? t.recipe.steps[t.stepIndex] : null;
    if (!step) return;
    const burn = burnAt();
    const scale = w / burn;
    const zone = zoneFor(step);
    const y = BAR_Y, h = BAR_H;
    ui.roundRectPath(x, y, w, h, h / 2);
    ctx.fillStyle = '#0a0604';
    ctx.fill();
    ctx.save();
    ui.roundRectPath(x, y, w, h, h / 2);
    ctx.clip();
    const nx = x + Math.min(slot.progress, burn) * scale;
    ctx.fillStyle = slot.state === 'burning' ? '#a8401a' : '#c88a2a';
    ctx.fillRect(x, y, nx - x, h);
    ctx.fillStyle = 'rgba(255,230,160,0.35)';
    ctx.fillRect(x, y + 2, nx - x, 3);
    const live = slot.state === 'ready';
    const zg = live ? 0.75 + 0.25 * Math.sin(animT * 12) : 0.6;
    ctx.fillStyle = 'rgba(80,230,100,' + zg.toFixed(3) + ')';
    ctx.fillRect(x + zone[0] * scale, y, (zone[1] - zone[0]) * scale, h);
    ctx.fillStyle = 'rgba(220,255,220,0.5)';
    ctx.fillRect(x + zone[0] * scale, y + 2, (zone[1] - zone[0]) * scale, 3);
    ctx.fillStyle = '#c8281e';
    ctx.fillRect(x + scale, y, (burn - 1) * scale, h);
    ctx.fillStyle = 'rgba(30,0,0,0.45)';
    for (let sx = x + scale - h; sx < x + w; sx += 8) {
      ctx.beginPath();
      ctx.moveTo(sx, y + h);
      ctx.lineTo(sx + 4, y + h);
      ctx.lineTo(sx + 4 + h, y);
      ctx.lineTo(sx + h, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ui.roundRectPath(x, y, w, h, h / 2);
    ctx.strokeStyle = 'rgba(255,220,150,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (live) SZ.FoodArt.drawHalo(ctx, nx, y + h / 2, 60, 44, 'green', 0.8);
    else if (slot.state === 'burning') SZ.FoodArt.drawHalo(ctx, nx, y + h / 2, 60, 44, 'red', 0.7);
    ctx.fillStyle = '#2a1408';
    ui.roundRectPath(nx - 3.5, y - 5, 7, h + 10, 3);
    ctx.fill();
    ctx.fillStyle = slot.state === 'burning' ? '#ff7a5a' : live ? '#b8ffb0' : '#ffffff';
    ui.roundRectPath(nx - 2, y - 4, 4, h + 8, 2);
    ctx.fill();
  }

  function drawIdleTrack(x, w) {
    ui.roundRectPath(x, BAR_Y, w, BAR_H, BAR_H / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,150,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* The station's key number; it bounces and glows green while a step
     sits in its perfect zone. */
  function drawStationKey(i, x, ready) {
    const kx = x + 4, ky = BAR_Y - 22;
    if (!ready) {
      ui.drawKeycap(String(i + 1), kx, ky, 12);
      return;
    }
    const pulse = 0.5 + 0.5 * Math.sin(animT * 12);
    const s = 1 + 0.25 * pulse;
    SZ.FoodArt.drawHalo(ctx, kx + 9, ky + 9, 56, 56, 'green', 0.6 + 0.4 * pulse);
    ctx.save();
    ctx.translate(kx + 9, ky + 9);
    ctx.scale(s, s);
    ctx.translate(-(kx + 9), -(ky + 9));
    ui.drawKeycap(String(i + 1), kx, ky, 12);
    ctx.restore();
  }

  /* a red '!' bubble bobbing over a station that started to burn */
  function drawBurnBubble(cx, y) {
    const by = y + Math.sin(animT * 8) * 3;
    const r = 15 + (Math.sin(animT * 10) > 0 ? 2 : 0);
    SZ.FoodArt.drawHalo(ctx, cx, by, 90, 90, 'red', 0.8);
    ctx.save();
    ctx.fillStyle = '#e03a2e';
    ctx.beginPath();
    ctx.arc(cx, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 6, by + r - 3);
    ctx.lineTo(cx + 6, by + r - 3);
    ctx.lineTo(cx, by + r + 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, by, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = ui.uiFont(22, '900');
    ctx.fillStyle = '#fff';
    ctx.fillText('!', cx, by + 1);
    ctx.restore();
  }

  /* Burn alerts are drawn after the ticket rail, just under its cards, so
     no card hides them. */
  function drawBurnAlerts() {
    for (let i = 0; i < SZ.KitchenData.STATION_ORDER.length; ++i) {
      const id = SZ.KitchenData.STATION_ORDER[i];
      if (stations[id].slots.some(s => s.ticket && !s.ticket.done && s.state === 'burning'))
        drawBurnBubble(stationCX(id), RAIL_Y + RAIL_H + 14);
    }
  }

  function drawStationBar(i, id, slot, ready) {
    const x = stationX(i);
    const t = slot.ticket;
    const step = t && !t.done ? t.recipe.steps[t.stepIndex] : null;
    drawStationKey(i, x, ready);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(step ? step.label : SZ.KitchenData.STATIONS[id].name, x + 28, BAR_Y - 13, STATION_W - 30, 13,
      { weight: 'bold', color: step ? '#ffe6b0' : 'rgba(255,230,190,0.55)' });
    drawSlotBar(x, STATION_W, slot);
  }

  function stationArtState(slot) {
    return slot.ticket ? (slot.ticket.done ? 'ready' : slot.state) : 'idle';
  }

  function slotProgress(slot) {
    return slot.ticket ? (slot.ticket.done ? 1 : slot.progress) : 0;
  }

  /* station art, halos and per-frame life (bars come later, above the chef) */
  function drawStations() {
    for (let i = 0; i < SZ.KitchenData.STATION_ORDER.length; ++i) {
      const id = SZ.KitchenData.STATION_ORDER[i];
      const slots = stations[id].slots;
      const x = stationX(i);
      let anyReady = false, anyBurning = false;
      for (const s of slots) {
        if (!s.ticket || s.ticket.done) continue;
        if (s.state === 'ready') anyReady = true;
        else if (s.state === 'burning') anyBurning = true;
      }
      const hot = mouseX >= x && mouseX <= x + STATION_W && mouseY >= STATION_Y && mouseY <= STATION_Y + STATION_H &&
        slots.some(s => s.ticket && !s.ticket.done);
      if (anyReady) SZ.FoodArt.drawHalo(ctx, x + STATION_W / 2, STATION_Y + 70, 260, 170, 'green', 0.55 + 0.3 * Math.sin(animT * 9));
      if (anyBurning) SZ.FoodArt.drawHalo(ctx, x + STATION_W / 2, STATION_Y + 70, 260, 170, 'red', 0.45 + 0.35 * (Math.sin(animT * 14) > 0 ? 1 : 0));
      if (hot) SZ.FoodArt.drawHalo(ctx, x + STATION_W / 2, STATION_Y + 70, 230, 150, 'gold', 0.35);
      /* a burning station sizzles: its art jitters a pixel or two */
      const jx = anyBurning ? Math.sin(animT * 47 + i * 2.1) * 1.5 : 0;
      const jy = anyBurning ? Math.cos(animT * 39 + i * 1.7) * 1.2 : 0;
      /* a station that just took a click squashes down for a beat */
      const press = stationPress[i] > 0 ? Math.sin(stationPress[i] / 0.18 * Math.PI) * 0.05 : 0;
      ctx.save();
      ctx.translate(x + STATION_W / 2 + jx, STATION_Y + 100 + jy);
      ctx.scale((1 + press) * STATION_ART, (1 - press) * STATION_ART);
      ctx.translate(-(x + STATION_W / 2), -(STATION_Y + 100));
      if (slots.length === 1) {
        const st = stationArtState(slots[0]);
        SZ.FoodArt.drawStation(ctx, id, x, STATION_Y, st, animT, slots[0].ticket ? slots[0].ticket.recipe.id : null, slotProgress(slots[0]));
        SZ.FoodArt.drawStationFx(ctx, id, x, STATION_Y, st, animT + i, slotProgress(slots[0]));
      } else {
        /* Upgraded station: the art twice side by side at 70% scale */
        for (let j = 0; j < slots.length; ++j) {
          const slot = slots[j];
          const st = stationArtState(slot);
          ctx.save();
          ctx.translate(x - 4 + j * 82, STATION_Y + 36);
          ctx.scale(0.7, 0.7);
          SZ.FoodArt.drawStation(ctx, id, 0, 0, st, animT + j * 0.3, slot.ticket ? slot.ticket.recipe.id : null, slotProgress(slot));
          SZ.FoodArt.drawStationFx(ctx, id, 0, 0, st, animT + i + j, slotProgress(slot));
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }

  /* keys, step labels and gauges on the instrument plates */
  function drawStationBars() {
    for (let i = 0; i < SZ.KitchenData.STATION_ORDER.length; ++i) {
      const id = SZ.KitchenData.STATION_ORDER[i];
      const slots = stations[id].slots;
      const x = stationX(i);
      const anyReady = slots.some(s => s.ticket && !s.ticket.done && s.state === 'ready');
      if (slots.length === 1) {
        if (!slots[0].ticket || slots[0].ticket.done) drawIdleTrack(x, STATION_W);
        drawStationBar(i, id, slots[0], anyReady);
      }
      else {
        for (let j = 0; j < slots.length; ++j) {
          if (!slots[j].ticket || slots[j].ticket.done) drawIdleTrack(x + j * 77, (STATION_W - 4) / 2);
          drawSlotBar(x + j * 77, (STATION_W - 4) / 2, slots[j]);
        }
        drawStationKey(i, x, anyReady);
        const run = slots.find(s => s.ticket && !s.ticket.done);
        const step0 = run ? run.ticket.recipe.steps[run.ticket.stepIndex] : null;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ui.fitText(step0 ? step0.label : SZ.KitchenData.STATIONS[id].name, x + 28, BAR_Y - 13, STATION_W - 30, 13,
          { weight: 'bold', color: step0 ? '#ffe6b0' : 'rgba(255,230,190,0.55)' });
      }
    }
  }

  function drawFlying() {
    for (const f of flying) {
      const k = Math.min(1, f.t / FLY_TIME);
      const x = f.x !== undefined ? f.x : f.x0 + (f.customer.x - f.x0) * k;
      const y = f.y !== undefined ? f.y : f.y0 + (SEAT_Y - 60 - f.y0) * k - Math.sin(k * Math.PI) * 90;
      const s = 1 + Math.sin(k * Math.PI) * 0.25;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(k * Math.PI * 2) * 0.25);
      ctx.scale(s, s);
      SZ.FoodArt.drawDish(ctx, f.recipe, 0, 0, 60, 1, f.quality);
      ctx.restore();
    }
  }

  /* finished dishes arcing from their station to the pass */
  function drawArcs() {
    for (const a of arcs) {
      const k = Math.min(1, a.t / ARC_TIME);
      const x = a.x0 + (a.x1 - a.x0) * k;
      const y = a.y0 + (a.y1 - a.y0) * k - Math.sin(k * Math.PI) * 110;
      const s = 0.8 + Math.sin(k * Math.PI) * 0.35;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((1 - k) * Math.PI * 2 * (a.x1 > a.x0 ? 1 : -1) * 0.5);
      ctx.scale(s, s);
      SZ.FoodArt.drawDish(ctx, a.recipe, 0, 0, 64, 1, a.quality);
      ctx.restore();
    }
  }

  function drawCoins() {
    for (const c of coins) {
      if (c.t < 0) continue;
      const k = Math.min(1, c.t / COIN_TIME);
      const e = k * k * (3 - 2 * k);
      const u = 1 - e;
      const x = u * u * c.x0 + 2 * u * e * c.cx + e * e * COIN_TX;
      const y = u * u * c.y0 + 2 * u * e * c.cy + e * e * COIN_TY;
      const sz = 26 - 6 * k + Math.sin(k * Math.PI) * 10;
      const img = fx.coinFrame(Math.floor(c.t * 20 + c.x0));
      if (img) ctx.drawImage(img, x - sz / 2, y - sz / 2, sz, sz);
      if (Math.random() < 0.5) fx.emit('spark', x, y, 1, { color: '#ffd23f', speed: 20, gravity: 0, life: 0.3, size: 12 });
    }
  }

  /* expanding rings: goal stars, VIP arrival, anger puffs, combo pops */
  function drawRings() {
    for (const r of rings) {
      const k = r.t / 0.5;
      const e = 1 - Math.pow(1 - k, 3);
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + e * 50, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* step-finish words: chunky headline popping in, then rising and fading */
  function drawPops() {
    for (const p of pops) {
      const k = p.t / 0.7;
      const s = k < 0.15 ? 0.3 + 1.2 * (k / 0.15) : k < 0.3 ? 1.5 - 0.5 * ((k - 0.15) / 0.15) : 1;
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? Math.max(0, (1 - k) / 0.3) : 1;
      ctx.translate(p.x, p.y - Math.max(0, k - 0.3) * 40);
      ctx.rotate(Math.sin(k * 8) * 0.04);
      ctx.scale(s, s);
      ui.drawHeadline(p.text, 0, 0, 400, Math.round(p.size * 1.25), p.color, p.color === '#ffd23f' ? '#ff7a1a' : undefined);
      ctx.restore();
    }
  }

  /* a VIP walks in under a golden spotlight */
  function drawCarpet() {
    if (!carpet) return;
    const k = carpet.t / 1.2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, k * 2) * 0.8;
    ui.drawGlow(carpet.x, SEAT_Y - 60, 260, '#ffd890', 12);
    ctx.restore();
  }

  /* a flickering flame sprite for combo chips and banners */
  function drawFlame(x, y, s) {
    const img = fx.sprite('flame', '#ff7a1a');
    if (!img) return;
    const k = 1 + 0.18 * Math.sin(animT * 14 + x) + 0.08 * Math.sin(animT * 31 + x * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(img, x - s * 1.4 * k / 2, y - s * 2.2 * k + s * 0.6, s * 1.4 * k, s * 2.2 * k);
    ctx.restore();
  }

  function drawRushBell() {
    const spent = rushUsed && rushTimer <= 0;
    const ring = rushTimer > 0 ? Math.sin(animT * 30) * 0.25 : 0;
    ctx.save();
    ctx.globalAlpha = spent ? 0.4 : 1;
    if (!spent) SZ.FoodArt.drawHalo(ctx, BELL.x, BELL.y, 60, 60, 'gold', rushTimer > 0 ? 0.9 : 0.4 + 0.2 * Math.sin(animT * 4));
    ctx.translate(BELL.x, BELL.y - 10);
    ctx.rotate(ring);
    ctx.translate(-BELL.x, -(BELL.y - 10));
    const g = ctx.createLinearGradient(BELL.x - 13, 0, BELL.x + 13, 0);
    g.addColorStop(0, '#a8741c');
    g.addColorStop(0.35, '#fff2b0');
    g.addColorStop(1, '#a8741c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(BELL.x, BELL.y - 2, 11, Math.PI, 0);
    ctx.lineTo(BELL.x + 14, BELL.y + 8);
    ctx.lineTo(BELL.x - 14, BELL.y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a3a0a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#5a3a0a';
    ctx.beginPath();
    ctx.arc(BELL.x, BELL.y + 11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(rushTimer > 0 ? Math.ceil(rushTimer) + 's' : 'B', BELL.x, BELL.y + 24, 30, 11, { weight: 'bold', color: spent ? 'rgba(255,255,255,0.4)' : '#fff', outline: '#3a1a06' });
  }

  function drawHUD() {
    const px = HUD_PX, py = HUD_PY, pw = HUD_PW, ph = HUD_PH;
    ui.drawPanel(px, py, pw, ph, { title: 'Day ' + dayInfo.id, titleRight: location.name, accent: location.color, titleRightColor: location.color });
    const seated = customers.filter(c => c.state !== 'leaving').length;
    const limit = spawnLimit();
    const left = (isFinite(limit) ? Math.max(0, limit - spawned) : 0) + seated;
    /* the coin counter: spinning coin and a number that rolls and bumps */
    const coin = fx.coinFrame(hudBump > 0 || animT % 4 < 0.75 ? Math.floor(animT * 10) : 0);
    const bump = hudBump > 0 ? Math.sin(hudBump / 0.3 * Math.PI) * 0.22 : 0;
    if (coin) ctx.drawImage(coin, px + 12, py + 36, 30, 30);
    ctx.save();
    ctx.translate(px + 48, py + 52);
    ctx.scale(1 + bump, 1 + bump);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText('$' + Math.round(earnedShown), 0, 0, 110, 24, { weight: '900', color: '#ffe060', outline: '#3a1a04' });
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const line = mode === 'career'
      ? 'Served ' + served + '  ·  Left ' + left + (walkouts ? '  ·  Out ' + walkouts : '')
      : 'Served ' + served + '  ·  Out ' + walkouts + '/3  ·  Ruined ' + ruinedServed + '/3';
    ui.fitText(line, px + pw - 14, py + 52, pw - 180, 12, { weight: 'bold', color: ui.UI.textDim });
    if (dayInfo.goals[2] > 0) {
      const meterX = px + 16, meterY = py + 84, meterW = pw - 32, meterH = 14;
      const top = Math.max(1, dayInfo.goals[2]);
      ui.drawMeter(meterX, meterY, meterW, meterH, earnedShown / top, '#ffc928', { t: animT });
      if (meterTick > 0) {
        ui.roundRectPath(meterX - 2, meterY - 2, meterW + 4, meterH + 4, (meterH + 4) / 2);
        ctx.strokeStyle = 'rgba(255,255,220,' + (0.9 * meterTick / 0.25).toFixed(3) + ')';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      for (let i = 0; i < 3; ++i) {
        const gx = meterX + Math.min(1, dayInfo.goals[i] / top) * meterW;
        const got = earned >= dayInfo.goals[i];
        if (got) ui.drawGlow(gx - (i === 2 ? 6 : 0), meterY + meterH / 2, 44, '#ffd23f');
        ui.drawStar(gx - (i === 2 ? 6 : 0), meterY + meterH / 2, got ? 24 : 20, got);
      }
    } else {
      ctx.textAlign = 'left';
      ui.fitText('Best $' + bestForMode(), px + 16, py + 92, pw - 64, 13, { weight: 'bold', color: ui.UI.textDim });
    }
    if (combo > 0) {
      const flames = combo >= 10 ? 3 : combo >= 6 ? 2 : combo >= 3 ? 1 : 0;
      for (let i = 0; i < flames; ++i)
        drawFlame(px + 26 + i * 16, py + ph + 24, 12);
      const chipW = ui.drawChip('COMBO ×' + comboMult().toFixed(1), px + 10, py + ph + 8, 28,
        { px: 15, bg: 'rgba(120,30,4,0.88)', border: '#ffb048', color: '#ffe080' });
      if (flames) for (let i = 0; i < flames; ++i) drawFlame(px + chipW + 22 + i * 16, py + ph + 26, 10);
    }
    if (treeLevel('p_rush') > 0) drawRushBell();
  }

  /* Ticket rail between the pass and the stations: a brass bar with paper
     order slips clipped to it, oldest first, max 9 visible. New slips drop
     in and swing; the next step's station key blinks. */
  function drawTicketRail() {
    if (tickets.length === 0) return;
    const barX0 = 40, barX1 = 1240;
    ui.roundRectPath(barX0, RAIL_Y - 4, barX1 - barX0, 8, 4);
    ctx.fillStyle = '#7a5214';
    ctx.fill();
    ui.roundRectPath(barX0, RAIL_Y - 4, barX1 - barX0, 5, 2.5);
    ctx.fillStyle = '#e8c060';
    ctx.fill();
    const shown = Math.min(tickets.length, RAIL_MAX);
    for (let i = 0; i < shown; ++i) {
      const t = tickets[i];
      if (t.slot === undefined) t.slot = i;
      t.slot += (i - t.slot) * Math.min(1, 0.18);
      const age = t.born !== undefined ? animT - t.born : 9;
      const drop = age < 0.35 ? (1 - age / 0.35) : 0;
      const swing = age < 1.2 ? Math.sin(age * 14) * 0.06 * (1 - age / 1.2) : Math.sin(animT * 1.3 + i) * 0.006;
      const x = RAIL_X0 + t.slot * (RAIL_W + RAIL_GAP), y = RAIL_Y - drop * drop * 60;
      ctx.save();
      ctx.translate(x + RAIL_W / 2, y);
      ctx.rotate(swing);
      ctx.translate(-(x + RAIL_W / 2), -y);
      const f = Math.max(0, t.customer.patience / t.customer.patienceMax);
      ui.drawPanel(x, y + 2, RAIL_W, RAIL_H, { style: 'paper', radius: 3, accent: location.color });
      /* brass clip */
      ui.roundRectPath(x + RAIL_W / 2 - 11, y - 6, 22, 14, 3);
      ctx.fillStyle = '#c8962e';
      ctx.fill();
      ctx.fillStyle = '#fff0b0';
      ctx.fillRect(x + RAIL_W / 2 - 9, y - 4, 18, 3);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText('#' + t.id, x + 6, y + 14, 30, 10, { weight: 'bold', color: ui.UI.inkDim });
      SZ.FoodArt.drawDish(ctx, t.recipe.id, x + RAIL_W / 2, y + 26, 44, 1, 'good');
      /* the guest's patience */
      ui.roundRectPath(x + 10, y + 47, RAIL_W - 20, 6, 3);
      ctx.fillStyle = 'rgba(80,50,20,0.25)';
      ctx.fill();
      if (f > 0) {
        ui.roundRectPath(x + 10, y + 47, (RAIL_W - 20) * f, 6, 3);
        ctx.fillStyle = patienceColor(f);
        ctx.fill();
      }
      /* step icons: done steps ticked, current step highlighted with its key */
      const steps = t.recipe.steps;
      const running = !t.done && ticketInSlot(t);
      const blocked = !t.done && !running && t.waitingFor !== null && stations[t.waitingFor].slots.every(s => s.ticket);
      const sx0 = x + RAIL_W / 2 - (steps.length - 1) * 13;
      for (let j = 0; j < steps.length; ++j) {
        const ix = sx0 + j * 26;
        if (j === t.stepIndex) {
          ui.roundRectPath(ix - 12, y + 56, 24, 28, 5);
          ctx.fillStyle = running ? 'rgba(255,190,40,0.35)' : 'rgba(120,90,40,0.15)';
          ctx.fill();
          ctx.strokeStyle = running ? '#d8901a' : 'rgba(120,90,40,0.5)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.save();
        if (j < t.stepIndex) ctx.globalAlpha *= 0.45;
        SZ.FoodArt.drawStepIcon(ctx, steps[j].station, ix, y + 66, 20);
        ctx.restore();
        if (j < t.stepIndex) {
          ctx.strokeStyle = '#2e9a2a';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(ix - 6, y + 66);
          ctx.lineTo(ix - 1, y + 71);
          ctx.lineTo(ix + 7, y + 60);
          ctx.stroke();
          ctx.lineCap = 'butt';
        }
        if (j === t.stepIndex) {
          /* runnable at its station: the key number blinks */
          const blink = running && Math.sin(animT * 10) > 0;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = ui.uiFont(10, 'bold');
          ctx.fillStyle = blink ? '#c83a1a' : ui.UI.ink;
          ctx.fillText(String(SZ.KitchenData.STATION_ORDER.indexOf(steps[j].station) + 1), ix, y + 79);
        }
      }
      if (blocked) drawRailClock(x + RAIL_W - 14, y + 16);
      ctx.restore();
    }
  }

  /* the little wait clock on a ticket whose station is busy */
  function drawRailClock(cx, cy) {
    ctx.save();
    ctx.fillStyle = '#fff4d8';
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d8781a';
    ctx.lineWidth = 2;
    ctx.stroke();
    const a = animT * 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#5a3a1e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - 6);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
    ctx.stroke();
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     TITLE SCREEN
     ══════════════════════════════════════════════════════════════════ */

  /* a red ribbon banner with folded ends, text in the middle */
  function drawRibbon(cx, cy, w, h, text, color) {
    const col = color || '#c8302a';
    const key = 'ribbon|' + Math.round(w) + 'x' + Math.round(h) + '|' + col;
    const img = cachedSprite(key, w + 60, h + 16, (c) => {
      const x0 = 30, y0 = 6;
      c.fillStyle = ui.shade(col, -0.45);
      for (let s = 0; s < 2; ++s) {
        const ex = s === 0 ? 2 : w + 34;
        c.beginPath();
        c.moveTo(ex, y0 + 10);
        c.lineTo(ex + 26, y0 + 10);
        c.lineTo(ex + 26, y0 + h + 8);
        c.lineTo(ex, y0 + h + 8);
        c.lineTo(ex + (s === 0 ? 10 : 16), y0 + h / 2 + 9);
        c.closePath();
        c.fill();
      }
      c.fillStyle = ui.shade(col, -0.6);
      c.beginPath();
      c.moveTo(x0, y0 + h);
      c.lineTo(x0 + 6, y0 + h + 8);
      c.lineTo(x0 + 6, y0 + h);
      c.moveTo(x0 + w, y0 + h);
      c.lineTo(x0 + w - 6, y0 + h + 8);
      c.lineTo(x0 + w - 6, y0 + h);
      c.fill();
      const g = c.createLinearGradient(0, y0, 0, y0 + h);
      g.addColorStop(0, ui.shade(col, 0.3));
      g.addColorStop(0.5, col);
      g.addColorStop(1, ui.shade(col, -0.3));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x0, y0);
      c.quadraticCurveTo(x0 + w / 2, y0 - 6, x0 + w, y0);
      c.lineTo(x0 + w, y0 + h);
      c.quadraticCurveTo(x0 + w / 2, y0 + h - 6, x0, y0 + h);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.setLineDash([4, 3]);
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x0 + 4, y0 + 4);
      c.quadraticCurveTo(x0 + w / 2, y0 - 2, x0 + w - 4, y0 + 4);
      c.moveTo(x0 + 4, y0 + h - 4);
      c.quadraticCurveTo(x0 + w / 2, y0 + h - 10, x0 + w - 4, y0 + h - 4);
      c.stroke();
      c.setLineDash([]);
    });
    ctx.drawImage(img, cx - (w + 60) / 2, cy - h / 2 - 6, w + 60, h + 16);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(text, cx, cy - 2, w - 30, Math.round(h * 0.5), { weight: 'bold', color: '#fff6e0', outline: ui.shade(col, -0.6) });
  }

  function drawCoinChip(x, y, amount) {
    const w = ui.drawChip('     $' + amount, x, y, 36, { align: 'right', px: 19, color: ui.UI.gold, bg: 'rgba(30,12,2,0.85)', border: '#e0b048' });
    const coin = fx.coinFrame(animT % 3 < 0.75 ? Math.floor(animT * 8) : 0);
    if (coin) ctx.drawImage(coin, x - w + 4, y + 3, 30, 30);
  }

  function drawTitleScreen() {
    drawMenuBackdrop('bistro', 0.42);
    /* warm rays behind the logo, slowly turning */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    ctx.translate(640, 120);
    ctx.rotate(animT * 0.08);
    ui.drawGlow(0, 0, 900, '#ffb050', 18);
    ctx.restore();
    const breathe = 1 + Math.sin(animT * 2) * 0.02;
    ctx.save();
    ctx.translate(640, 112);
    ctx.scale(breathe, breathe);
    ctx.rotate(Math.sin(animT * 1.3) * 0.01);
    ui.drawHeadline('BISTRO RUSH', 0, 0, 1000, 104, '#ffd23f', '#ff6a1a');
    ctx.restore();
    drawRibbon(640, 196, 520, 44, 'Cook · Serve · Build your restaurant empire', '#c8302a');
    if (Math.random() < 0.08) fx.emit('star', 640 + (Math.random() - 0.5) * 760, 112 + (Math.random() - 0.5) * 100, 1, { color: '#fff0a0', speed: 30, gravity: -10 });

    /* the chef cheering on the left, dishes orbiting around him */
    SZ.PeopleArt.drawChef(ctx, 170, 640, 'cheer', animT);
    const orbit = ['burger', 'pizza', 'tacos', 'cake', 'salad', 'ramen'];
    for (let i = 0; i < orbit.length; ++i) {
      const a = animT * 1.1 + i * Math.PI / 3;
      const depth = Math.sin(a);
      SZ.FoodArt.drawDish(ctx, orbit[i], 170 + Math.cos(a) * 130, 500 + depth * 60, 56 + depth * 10, 1, 'good');
    }
    /* guests strolling along the bottom */
    for (let i = 0; i < 3; ++i) {
      const span = VIEW_W + 220;
      const x = ((animT * 90 + i * 430) % span) - 110;
      SZ.PeopleArt.drawCustomer(ctx, titleLooks[i], x, 712, 'walk', animT + i, 1);
    }

    drawCoinChip(1256, 16, save.coins);

    const stars = countStars();
    const daily = save.best.daily;
    const items = [
      { id: 't-career', label: 'Career', sub: stars + ' / 90 stars', color: 'orange', x: 430, y: 290, w: 420, h: 76, px: 30, action: () => setScreen(STATE_CAREER) },
      { id: 't-endless', label: 'Endless Rush', sub: 'Best $' + save.best.endless, color: 'red', x: 430, y: 380, w: 206, h: 62, action: () => startDay('endless', 0) },
      { id: 't-daily', label: 'Daily Special', sub: daily.date === dateKey(new Date()) ? 'Today: $' + daily.earned : 'New menu today', color: 'blue', x: 644, y: 380, w: 206, h: 62, action: () => startDay('daily', 0) },
      { id: 't-kitchen', label: 'Kitchen', sub: countTreeMaxed() + ' / ' + TREE.length + ' upgrades', color: 'green', x: 430, y: 454, w: 206, h: 62, action: () => { prevScreen = STATE_TITLE; setScreen(STATE_UPGRADES); } },
      { id: 't-recipes', label: 'Recipe Book', color: 'wood', x: 644, y: 454, w: 206, h: 62, action: () => setScreen(STATE_RECIPES) },
      { id: 't-help', label: 'Help', color: 'wood', x: 565, y: 530, w: 150, h: 44, px: 17, action: openHelp },
    ];
    for (let i = 0; i < items.length; ++i) {
      const it = items[i];
      drawButton(it.id, it.label, it.x, it.y, it.w, it.h, { sub: it.sub, action: it.action, color: it.color, px: it.px || 20, bob: i });
    }

    ui.drawKeyHints([
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Start' },
      { key: 'H', label: 'Help' },
      { key: 'F2', label: 'New Game' },
    ], 640, 600, 900, 1);
  }

  /* ══════════════════════════════════════════════════════════════════
     CAREER MAP — five location cards, six days each
     ══════════════════════════════════════════════════════════════════ */

  function drawDayMedal(bx, by, bs, label, color, hot, got, open) {
    const cx = bx + bs / 2, cy = by + bs / 2;
    if (hot) ui.drawGlow(cx, cy, bs * 2.2, '#ffd23f');
    const key = 'medal|' + bs + '|' + color + '|' + (open ? 1 : 0) + (got >= 3 ? 'g' : '');
    const img = cachedSprite(key, bs + 6, bs + 8, (c) => {
      const r = bs / 2;
      c.fillStyle = 'rgba(20,8,0,0.45)';
      c.beginPath();
      c.arc(r + 3, r + 6, r, 0, Math.PI * 2);
      c.fill();
      const rim = c.createLinearGradient(0, 3, 0, bs + 3);
      rim.addColorStop(0, '#fff0b0');
      rim.addColorStop(0.5, '#d8a03a');
      rim.addColorStop(1, '#7a4a10');
      c.fillStyle = rim;
      c.beginPath();
      c.arc(r + 3, r + 3, r, 0, Math.PI * 2);
      c.fill();
      const face = c.createLinearGradient(0, 6, 0, bs);
      const base = open ? (got >= 3 ? '#4cc23a' : color) : '#6a5a4a';
      face.addColorStop(0, ui.shade(base, 0.35));
      face.addColorStop(1, ui.shade(base, -0.35));
      c.fillStyle = face;
      c.beginPath();
      c.arc(r + 3, r + 3, r - 4, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.ellipse(r + 3, r - 3, r * 0.6, r * 0.32, 0, 0, Math.PI * 2);
      c.fill();
    });
    ctx.drawImage(img, bx - 3, by - 3, bs + 6, bs + 8);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (open) ui.fitText(label, cx, cy + 1, bs, 18, { weight: '900', color: '#ffffff', outline: 'rgba(40,16,0,0.8)' });
  }

  function drawCareerScreen() {
    drawMenuBackdrop('truck', 0.55);
    ui.drawHeadline('Career', 640, 44, 600, 50, '#ffd23f', '#ff6a1a');
    drawCoinChip(1256, 16, save.coins);

    for (let li = 0; li < SZ.KitchenData.LOCATIONS.length; ++li) {
      const loc = SZ.KitchenData.LOCATIONS[li];
      const cx = 25 + li * 250, cy = 90, cw = 230, ch = 440;
      const reached = locationReached(li);
      ui.drawPanel(cx, cy, cw, ch, { accent: reached ? loc.color : ui.UI.textMute, noStuds: false });
      /* miniature of the location scene in a brass frame */
      const mx = cx + 12, my = cy + 12, mw = cw - 24, mh = 124;
      ctx.save();
      ui.roundRectPath(mx, my, mw, mh, 6);
      ctx.clip();
      ctx.save();
      ctx.translate(mx - 40, my - 10);
      ctx.scale((mw + 80) / 1280, (mw + 80) / 1280);
      menuScene(loc.theme).draw(ctx, animT, { x0: 0, y0: 0, x1: 1280, y1: 720 });
      menuScene(loc.theme).drawFront(ctx);
      ctx.restore();
      if (!reached) {
        ctx.fillStyle = 'rgba(10,6,4,0.72)';
        ctx.fillRect(mx, my, mw, mh);
      }
      ctx.restore();
      ui.roundRectPath(mx, my, mw, mh, 6);
      ctx.strokeStyle = '#e0b048';
      ctx.lineWidth = 3;
      ctx.stroke();
      ui.roundRectPath(mx + 2, my + 2, mw - 4, mh - 4, 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      let stars = 0;
      for (let k = 0; k < 6; ++k)
        stars += save.stars[(li + 1) + '-' + (k + 1)] || 0;
      drawRibbon(cx + cw / 2, my + mh + 16, cw - 70, 34, loc.name, reached ? loc.color : '#6a5a4a');
      ctx.save();
      ui.drawStar(cx + cw / 2 - 28, cy + 190, 22, stars > 0);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(stars + ' / 18', cx + cw / 2 - 14, cy + 191, 80, 16, { weight: 'bold', color: stars ? ui.UI.gold : ui.UI.textMute });
      ctx.restore();

      if (!reached) {
        const bob = Math.sin(animT * 2 + li) * 3;
        drawLock(cx + cw / 2, cy + 278 + bob, 64);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.drawTextBlock('Earn a star on day ' + SZ.KitchenData.CAREER[li * 6 - 1].id, cx + 20, cy + 330, cw - 40, 40, 15, { color: ui.UI.warn, weight: 'bold', align: 'center' });
        continue;
      }

      for (let k = 0; k < 6; ++k) {
        const di = li * 6 + k;
        const day = SZ.KitchenData.CAREER[di];
        const open = careerUnlocked(di);
        const got = save.stars[day.id] || 0;
        const bs = 46;
        const bx = cx + 22 + (k % 3) * 66, by = cy + 214 + Math.floor(k / 3) * 84;
        const hit = registerHit('day-' + di, bx, by, bs, bs, () => startDay('career', di), !open);
        const hot = isHot(hit, bx, by, bs, bs);
        ctx.save();
        if (hot && open) {
          ctx.translate(bx + bs / 2, by + bs / 2);
          const s = 1.1 + Math.sin(animT * 6) * 0.03;
          ctx.scale(s, s);
          ctx.translate(-(bx + bs / 2), -(by + bs / 2));
        }
        drawDayMedal(bx, by, bs, String(k + 1), loc.color, hot && open, got, open);
        if (day.special) drawSpecialIcon(day.special, bx + bs - 4, by + 4);
        if (!open) drawLock(bx + bs / 2, by + bs / 2, 22);
        ctx.restore();
        for (let t = 0; t < 3; ++t)
          ui.drawStar(bx + bs / 2 - 15 + t * 15, by + bs + 12, 15, t < got);
        const best = save.best[day.id] || 0;
        if (best > 0) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ui.fitText('$' + best, bx + bs / 2, by + bs + 27, bs + 14, 11, { weight: 'bold', color: 'rgba(255,230,190,0.6)' });
        }
      }

      ctx.textAlign = 'left';
      ui.drawTextBlock(loc.recipes.map(id => SZ.KitchenData.recipeById(id).name).join(' · '), cx + 16, cy + ch - 56, cw - 32, 42, 12, { color: 'rgba(255,230,190,0.6)', align: 'center' });
    }

    drawButton('career-back', 'Back', 24, 640, 150, 50, { px: 18, color: 'wood', action: () => setScreen(STATE_TITLE) });
    ui.drawKeyHints([
      { key: '↑↓←→', label: 'Select day' },
      { key: 'Enter', label: 'Start' },
      { key: 'Esc', label: 'Title' },
    ], 640, 690, 900, 1);
  }

  /* ══════════════════════════════════════════════════════════════════
     KITCHEN UPGRADE TREE
     ══════════════════════════════════════════════════════════════════ */

  /* a round medallion with a picture for each branch */
  function drawBranchIcon(branchId, cx, cy, size, color) {
    const r = size / 2;
    const img = cachedSprite('bicon|' + branchId + '|' + size + '|' + color, size + 4, size + 6, (c) => {
      c.fillStyle = 'rgba(20,8,0,0.45)';
      c.beginPath();
      c.arc(r + 2, r + 5, r, 0, Math.PI * 2);
      c.fill();
      const rim = c.createLinearGradient(0, 2, 0, size + 2);
      rim.addColorStop(0, '#fff0b0');
      rim.addColorStop(0.5, '#d8a03a');
      rim.addColorStop(1, '#7a4a10');
      c.fillStyle = rim;
      c.beginPath();
      c.arc(r + 2, r + 2, r, 0, Math.PI * 2);
      c.fill();
      const face = c.createRadialGradient(r - 2, r - 4, 2, r + 2, r + 2, r);
      face.addColorStop(0, ui.shade(color, 0.4));
      face.addColorStop(1, ui.shade(color, -0.45));
      c.fillStyle = face;
      c.beginPath();
      c.arc(r + 2, r + 2, r - 4, 0, Math.PI * 2);
      c.fill();
    });
    ctx.drawImage(img, cx - r - 2, cy - r - 2, size + 4, size + 6);
    const icon = { stations: 'stove', gear: 'grill', service: 'plate', charm: null, pantry: 'board' }[branchId];
    if (icon) SZ.FoodArt.drawStepIcon(ctx, icon, cx, cy, size * 0.62);
    else {
      ui.drawStar(cx, cy, size * 0.6, true);
    }
  }

  function drawUpgradesScreen() {
    drawMenuBackdrop('hotel', 0.6);
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
    ui.drawHeadline('Kitchen', 140, 58, 240, 48, ui.UI.gold, '#ff8a1a');
    ctx.textAlign = 'left';
    ui.fitText('Upgrade your kitchen with the coins you earn', 270, 60, 520, 15, { color: ui.UI.textDim, weight: 'bold' });
    drawCoinChip(1236, 30, save.coins);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ui.fitText(countTreeMaxed() + ' / ' + TREE.length + ' installed', 1236, 82, 320, 13, { color: ui.UI.textDim, weight: 'bold' });
    ctx.textAlign = 'left';

    for (const tab of layout.tabs) {
      const active = tab.index === treeBranch;
      const hot = mouseX >= tab.x && mouseX <= tab.x + tab.w && mouseY >= tab.y && mouseY <= tab.y + tab.h;
      ctx.save();
      if (!active) ctx.globalAlpha *= hot ? 0.95 : 0.8;
      ui.drawPanel(tab.x, tab.y - (active ? 4 : 0), tab.w, tab.h + (active ? 4 : 0), { radius: 9, noStuds: true, accent: tab.branch.color, glow: active, top: active ? ui.shade(tab.branch.color, -0.35) : undefined, bottom: active ? ui.shade(tab.branch.color, -0.7) : undefined });
      drawBranchIcon(tab.branch.id, tab.x + 26, tab.y + tab.h / 2 - (active ? 2 : 0), 30, tab.branch.color);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(tab.branch.name, tab.x + 48, tab.y + tab.h / 2 - (active ? 2 : 0), tab.w - 110, 16, { weight: 'bold', color: active ? '#ffffff' : ui.UI.textDim, outline: 'rgba(30,10,0,0.7)' });
      ctx.textAlign = 'right';
      ui.fitText(tab.maxed + '/' + tab.total, tab.x + tab.w - 14, tab.y + tab.h / 2 - (active ? 2 : 0), 60, 14, { weight: 'bold', color: tab.maxed === tab.total ? ui.UI.good : ui.UI.textDim });
      ctx.restore();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    /* brass pipes between cards; a met requirement glows in branch colour */
    const byId = {};
    for (const card of layout.cards)
      byId[card.node.id] = card;
    for (const card of layout.cards) {
      for (let i = 0; i < card.node.req.length; ++i) {
        const reqId = card.node.req[i][0];
        const from = byId[reqId];
        if (!from) continue;
        const met = treeLevel(reqId) >= card.node.req[i][1];
        const x1 = from.x + from.w, y1 = from.y + from.h / 2;
        const x2 = card.x, y2 = card.y + card.h / 2;
        const midX = (x1 + x2) / 2;
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(midX, y1);
          ctx.lineTo(midX, y2);
          ctx.lineTo(x2, y2);
        };
        ctx.lineJoin = 'round';
        path();
        ctx.strokeStyle = '#2a1408';
        ctx.lineWidth = 10;
        ctx.stroke();
        path();
        ctx.strokeStyle = met ? '#e0b048' : '#6a5038';
        ctx.lineWidth = 6;
        ctx.stroke();
        path();
        ctx.strokeStyle = met ? ui.hexToRgba(layout.branch.color, 0.9) : 'rgba(255,230,190,0.15)';
        ctx.lineWidth = 2;
        ctx.stroke();
        if (met) {
          /* a bead of light running along the pipe */
          const len = Math.abs(midX - x1) + Math.abs(y2 - y1) + Math.abs(x2 - midX);
          let d = (animT * 120) % len;
          let px, py;
          if (d < midX - x1) { px = x1 + d; py = y1; }
          else if ((d -= midX - x1) < Math.abs(y2 - y1)) { px = midX; py = y1 + Math.sign(y2 - y1) * d; }
          else { d -= Math.abs(y2 - y1); px = midX + d; py = y2; }
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ui.drawGlow(px, py, 30, layout.branch.color);
          ctx.restore();
        }
      }
    }

    for (const card of layout.cards)
      drawTreeNodeCard(card);

    ui.drawKeyHints([
      { key: '←→', label: 'Branch' },
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Esc', label: 'Back' },
    ], 640, 690, 900, 1);
  }

  function drawTreeNodeCard(card) {
    const node = card.node;
    const branch = TREE_BRANCHES[node.branch];
    const level = treeLevel(node.id);
    const max = node.costs.length;
    const maxed = card.state === 'maxed';
    const locked = card.state === 'locked';
    const selected = node.id === treeSelected;

    ctx.save();
    if (selected) {
      const s = 1.03 + Math.sin(animT * 5) * 0.008;
      ctx.translate(card.x + card.w / 2, card.y + card.h / 2);
      ctx.scale(s, s);
      ctx.translate(-(card.x + card.w / 2), -(card.y + card.h / 2));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ui.drawGlow(card.x + card.w / 2, card.y + card.h / 2, card.w * 1.5, maxed ? '#6fe08a' : '#ffd23f');
      ctx.restore();
    }
    if (locked)
      ctx.globalAlpha *= 0.94;
    ui.drawPanel(card.x, card.y, card.w, card.h, { accent: maxed ? ui.UI.good : branch.color, glow: selected,
      top: locked ? '#3a3028' : undefined, bottom: locked ? '#1e1812' : undefined });

    drawBranchIcon(node.branch, card.x + 40, card.y + 44, 52, locked ? '#5a5048' : branch.color);
    if (locked) drawLock(card.x + 40, card.y + 46, 26);

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ui.fitText(node.name, card.x + 76, card.y + 26, card.w - 140, 19, { weight: 'bold', color: ui.UI.text, outline: 'rgba(30,10,0,0.6)' });
    ui.drawTextBlock(node.desc, card.x + 76, card.y + 38, card.w - 92, 34, 13, { color: ui.UI.textDim, minPx: 11 });

    /* level pips */
    for (let l = 0; l < max; ++l) {
      const px = card.x + 76 + l * 22;
      const py = card.y + card.h - 22;
      ui.roundRectPath(px, py, 18, 10, 3);
      ctx.fillStyle = l < level ? branch.color : 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = l < level ? '#fff6d0' : 'rgba(255,220,160,0.3)';
      ctx.stroke();
    }
    ctx.textAlign = 'right';
    ui.fitText((level ? romanNumeral(level) : '0') + ' / ' + romanNumeral(max), card.x + card.w - 16, card.y + 24, 60, 13, { weight: 'bold', color: ui.UI.textDim });

    if (maxed) {
      ui.drawChip('✓ MAX', card.x + card.w - 14, card.y + card.h - 32, 24, { align: 'right', px: 13, color: '#eaffea', bg: 'rgba(40,140,50,0.9)', border: '#9af07a' });
    } else if (locked) {
      const missing = [];
      for (let i = 0; i < node.req.length; ++i) {
        if (treeLevel(node.req[i][0]) < node.req[i][1])
          missing.push(TREE_INDEX[node.req[i][0]].name + ' ' + romanNumeral(node.req[i][1]));
      }
      ctx.textAlign = 'right';
      ui.fitText('Needs ' + missing.join(', '), card.x + card.w - 14, card.y + card.h - 20, card.w - 150, 12, { weight: 'bold', color: ui.UI.warn });
    } else {
      const afford = card.state !== 'expensive';
      const bw = 92, bh = 27, bx = card.x + card.w - 14 - bw, by = card.y + card.h - 10 - bh;
      const pulse = afford && selected ? Math.sin(animT * 6) * 0.04 : 0;
      ctx.save();
      ctx.translate(bx + bw / 2, by + bh / 2);
      ctx.scale(1 + pulse, 1 + pulse);
      ctx.translate(-(bx + bw / 2), -(by + bh / 2));
      ui.drawButtonFace(bx, by, bw, bh, '$' + node.costs[level], { color: afford ? 'gold' : 'grey', hot: selected && afford, px: 15, radius: 9 });
      ctx.restore();
    }

    if (treeBuyFlash && treeBuyFlash.id === node.id) {
      const f = 1 - (animT - treeBuyFlash.at) / 0.4;
      if (f > 0) {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 10);
        ctx.fillStyle = 'rgba(255,250,220,' + (0.7 * f).toFixed(3) + ')';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     RECIPE BOOK — twelve paper cards, locked recipes stay silhouettes
     ══════════════════════════════════════════════════════════════════ */

  function drawRecipeBook() {
    drawMenuBackdrop('sushi', 0.6);
    ui.drawHeadline('Recipe Book', 640, 44, 600, 50, '#ffd23f', '#ff6a1a');

    const CW = 296, CH = 168, GX = 16, GY = 14;
    for (let i = 0; i < SZ.KitchenData.RECIPES.length; ++i) {
      const r = SZ.KitchenData.RECIPES[i];
      const cx = 24 + (i % 4) * (CW + GX), cy = 92 + Math.floor(i / 4) * (CH + GY);
      const reached = recipeReached(r.id);
      const hot = reached && mouseX >= cx && mouseX <= cx + CW && mouseY >= cy && mouseY <= cy + CH;
      const tilt = ((i * 7) % 5 - 2) * 0.004;
      ctx.save();
      ctx.translate(cx + CW / 2, cy + CH / 2);
      ctx.rotate(tilt);
      if (hot) ctx.scale(1.03, 1.03);
      ctx.translate(-(cx + CW / 2), -(cy + CH / 2));
      ui.drawPanel(cx, cy, CW, CH, { style: 'paper', radius: 6, accent: reached ? '#d8402a' : '#9a8a78', bottom: reached ? undefined : '#d8ccb4' });
      /* a pin at the top */
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(cx + CW / 2 + 1.5, cy + 10, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = reached ? '#d8302a' : '#7a6a5a';
      ctx.beginPath();
      ctx.arc(cx + CW / 2, cy + 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(cx + CW / 2 - 2, cy + 6, 2, 0, Math.PI * 2);
      ctx.fill();

      if (reached) ui.drawGlow(cx + 64, cy + 72, 150, '#ffe8b0');
      SZ.FoodArt.drawDish(ctx, r.id, cx + 64, cy + 72, 104, reached ? 1 : 0.12, 'good');
      if (!reached) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText('?', cx + 64, cy + 70, 60, 46, { weight: '900', color: '#7a6a5a' });
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(reached ? r.name : 'Not reached yet', cx + 124, cy + 34, CW - 140, 21, { weight: 'bold', color: reached ? ui.UI.ink : ui.UI.inkDim });
      ui.fitText(reached ? '$' + r.price + ' per dish' : 'Serve it to unlock', cx + 124, cy + 58, CW - 140, 14, { weight: 'bold', color: reached ? '#b8641a' : ui.UI.inkDim });

      for (let j = 0; j < r.steps.length; ++j) {
        if (j > 0) {
          ctx.fillStyle = 'rgba(90,60,30,0.6)';
          ctx.font = ui.uiFont(16, 'bold');
          ctx.textAlign = 'center';
          ctx.fillText('›', cx + 122 + j * 36, cy + 90);
        }
        ui.roundRectPath(cx + 124 + j * 36 - 15, cy + 74, 30, 30, 7);
        ctx.fillStyle = 'rgba(120,80,30,0.12)';
        ctx.fill();
        SZ.FoodArt.drawStepIcon(ctx, r.steps[j].station, cx + 124 + j * 36, cy + 89, 26);
      }

      let chipX = cx + 14;
      for (const loc of SZ.KitchenData.LOCATIONS) {
        if (loc.recipes.indexOf(r.id) < 0) continue;
        ctx.font = ui.uiFont(11, 'bold');
        if (chipX + ctx.measureText(loc.name).width + 18 > cx + CW - 10) break;
        const w = ui.drawChip(loc.name, chipX, cy + CH - 36, 22, {
          px: 11,
          color: '#ffffff',
          bg: reached ? ui.shade(loc.color, -0.15) : '#a89880',
          border: 'rgba(60,30,10,0.4)',
        });
        chipX += w + 6;
      }
      ctx.restore();
    }

    drawButton('recipes-back', 'Back', 24, 640, 150, 50, { px: 18, color: 'wood', action: () => setScreen(STATE_TITLE) });
    ui.drawKeyHints([
      { key: 'Esc', label: 'Back' },
    ], 640, 690, 900, 1);
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
      ui.fitText(lines[i][0], px, y, 560, 21, { weight: 'bold', color: ui.UI.gold, outline: 'rgba(30,10,0,0.7)' });
      ui.drawTextBlock(lines[i][1], px, y + 14, 560, 60, 15, { color: ui.UI.text });
    }
  }

  function drawHelp() {
    drawMenuBackdrop('diner', 0.6);
    const pw = 1000, ph = 560, px = 140, py = 74;
    ui.drawPanel(px, py, pw, ph, { title: 'Help · ' + HELP_PAGES[helpPage], accent: '#ffd23f', titlePx: 22, headerH: 40 });
    for (let i = 0; i < HELP_PAGES.length; ++i) {
      ui.roundRectPath(px + pw - 120 + i * 24, py + 15, 14, 14, 7);
      ctx.fillStyle = i === helpPage ? '#ffd23f' : 'rgba(0,0,0,0.45)';
      ctx.fill();
    }

    const ix = px + pw - 250;
    if (helpPage === 0) {
      helpLines(px + 40, py + 92, [
        ['Take the order', 'Click a seated customer, or the bubble over their head, to take the order. A ticket appears in the rail above the kitchen.'],
        ['Patience ring', 'The ring around the bubble drains as they wait: green, then yellow, then red. At zero they walk out and your combo breaks.'],
        ['Moods', 'Happy guests tip well, impatient ones start tapping their fingers, angry ones leave a mark on the day.'],
      ]);
      ui.drawPanel(ix - 40, py + 70, 260, 400, { style: 'chalk', radius: 8 });
      SZ.PeopleArt.drawCustomer(ctx, titleLooks[0], ix + 90, py + 360, 'sit', animT, 1);
      const bx = ix + 90, by = py + 190;
      ctx.drawImage(bubbleSprite(), bx - 48, by - 48, 96, 104);
      SZ.FoodArt.drawDish(ctx, 'burger', bx, by + 2, 56, 1, 'good');
      ctx.strokeStyle = '#5ad04a';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(bx, by, 34, -Math.PI / 2, -Math.PI / 2 + (0.5 + 0.5 * Math.sin(animT)) * Math.PI * 2);
      ctx.stroke();
      ctx.lineCap = 'butt';
      const moods = ['happy', 'ok', 'impatient', 'angry'];
      for (let i = 0; i < moods.length; ++i)
        SZ.PeopleArt.drawMood(ctx, ix + 6 + i * 56, py + 420, moods[i], 34);
    } else if (helpPage === 1) {
      helpLines(px + 40, py + 92, [
        ['Tickets move themselves', 'Once an order is taken, its ticket walks through the stations on its own and waits at each one.'],
        ['Catch the green', 'Click a station, or press 1-5, when its needle is inside the green zone for a perfect step.'],
        ['Red burns', 'Let the needle run into the red field and the step burns — a burnt or raw step ruins the dish.'],
        ['Second slots', 'Kitchen upgrades add a second grill, burner, prep board and oven so two steps can run at once.'],
      ]);
      ui.drawPanel(ix - 40, py + 70, 260, 400, { style: 'chalk', radius: 8 });
      const sp = (0.5 + 0.5 * Math.sin(animT * 2));
      const prog = 0.55 + 0.25 * sp;
      SZ.FoodArt.drawStation(ctx, 'grill', ix + 15, py + 170, prog > 0.6 && prog < 0.8 ? 'ready' : 'working', animT, 'burger', prog);
      SZ.FoodArt.drawStationFx(ctx, 'grill', ix + 15, py + 170, 'working', animT, prog);
      const bw = 150, bx = ix + 15, by = py + 340;
      ui.roundRectPath(bx, by, bw, 12, 6);
      ctx.fillStyle = '#0a0604';
      ctx.fill();
      ctx.fillStyle = 'rgba(80,230,100,0.7)';
      ctx.fillRect(bx + 0.55 * bw / 1.25, by, 0.25 * bw / 1.25, 12);
      ctx.fillStyle = '#c8281e';
      ctx.fillRect(bx + bw / 1.25, by, 0.25 * bw / 1.25, 12);
      const nx = bx + prog * bw / 1.25;
      ctx.fillStyle = '#b8ffb0';
      ctx.fillRect(nx - 2, by - 4, 4, 20);
      ui.drawKeycap('1', bx, by + 26, 12);
    } else if (helpPage === 2) {
      helpLines(px + 40, py + 92, [
        ['Serve from the pass', 'Finished dishes land on the pass. Click one to carry it to the guest waiting for that dish.'],
        ['Combo', 'Perfect dishes build a combo multiplier on the tips; a walkout or a ruined serve resets it.'],
        ['Trash', 'Click the bin to toss a ruined dish before it reaches a guest.'],
        ['Waiter', 'The Waiter upgrade carries finished dishes to waiting guests by itself.'],
      ]);
      ui.drawPanel(ix - 40, py + 70, 260, 400, { style: 'chalk', radius: 8 });
      SZ.FoodArt.drawDish(ctx, 'pasta', ix + 30, py + 190, 90, 1, 'perfect');
      ctx.drawImage(trashSprite(), ix + 120, py + 160, 56, 63);
      SZ.PeopleArt.drawChef(ctx, ix + 90, py + 430, 'cheer', animT);
    } else {
      helpLines(px + 40, py + 92, [
        ['Career', 'Thirty days across five venues. Earn at least one star to unlock the next day; a full venue of stars opens the next. Stars land at $-goal thresholds.'],
        ['Endless Rush', 'Serve until three walkouts or three ruined dishes. The venue rotates and the clock tightens every eight guests; your best run is kept.'],
        ['Daily Special', 'One seeded menu per day — the same kitchen, guests and orders for everyone, twenty guests in.'],
        ['Kitchen tree', 'Coins from every day buy upgrades in five branches: Stations, Gear, Service, Charm and Pantry. They carry into every mode.'],
      ]);
    }

    if (helpPage > 0)
      drawButton('help-prev', '←', px + 24, py + ph - 66, 90, 46, { px: 22, color: 'wood', action: () => { helpPage = Math.max(0, helpPage - 1); sfx('click', { volume: 0.4 }); } });
    if (helpPage < HELP_PAGES.length - 1)
      drawButton('help-next', '→', px + pw - 114, py + ph - 66, 90, 46, { px: 22, color: 'orange', action: () => { helpPage = Math.min(HELP_PAGES.length - 1, helpPage + 1); sfx('click', { volume: 0.4 }); } });
    ui.drawKeyHints([
      { key: '←→', label: 'Pages' },
      { key: 'Esc', label: 'Back' },
    ], 640, 690, 900, 1);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(10,4,0,0.62)';
    fillVisibleRect();
    const pw = 460, ph = 200;
    const px = VIEW_W / 2 - pw / 2, py = VIEW_H / 2 - ph / 2;
    ui.drawPanel(px, py, pw, ph, { accent: '#ff7a3a' });
    ui.drawHeadline('PAUSED', VIEW_W / 2, py + 54, pw - 48, 54, '#ffffff', '#ff8a3a');
    /* one row of equal-width buttons: side padding 28, gap 16, 56 high,
       24 px above the panel bottom */
    const btnW = (pw - 2 * 28 - 2 * 16) / 3;
    const btnY = py + ph - 24 - 56;
    drawButton('pause-resume', 'Resume', px + 28, btnY, btnW, 56,
      { px: 17, color: 'green', action: () => { state = STATE_PLAYING; updateWindowTitle(); updateStatus(); } });
    drawButton('pause-restart', 'Restart Day', px + 28 + btnW + 16, btnY, btnW, 56,
      { px: 15, color: 'orange', action: () => startDay(mode, mode === 'career' ? dayIndex : 0) });
    drawButton('pause-menu', 'Menu', px + 28 + 2 * (btnW + 16), btnY, btnW, 56,
      { px: 17, color: 'wood', action: () => setScreen(STATE_TITLE) });
  }

  function drawDayOver() {
    const appear = Math.min(1, dayOverT / 0.35);
    ctx.fillStyle = 'rgba(10,4,0,' + (0.68 * appear).toFixed(3) + ')';
    fillVisibleRect();
    const px = 390, py = 96, pw = 500, ph = 470;
    const won = mode === 'career' ? dayResult.stars > 0 : dayResult.newBest;
    /* the panel drops in with a little overshoot */
    const e = appear < 1 ? 1 - Math.pow(1 - appear, 3) * Math.cos(appear * 7) : 1;
    ctx.save();
    ctx.translate(0, (1 - e) * -220);
    if (won) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4;
      ctx.translate(VIEW_W / 2, py + 150);
      ctx.rotate(animT * 0.25);
      ui.drawGlow(0, 0, 760, '#ffb040', 16);
      ctx.restore();
    }
    const what = mode === 'career' ? 'Day ' : mode === 'daily' ? 'Daily ' : 'Rush ';
    ui.drawPanel(px, py, pw, ph, { accent: location.color });
    drawRibbon(VIEW_W / 2, py + 4, pw - 120, 46, what + dayInfo.id + ' — ' + location.name, won ? '#c8302a' : '#6a5a4a');
    const headline = mode === 'career' ? (dayResult.stars > 0 ? 'Day complete!' : 'Closed at a loss')
      : mode === 'daily' ? 'Daily Special over!' : 'Rush over!';
    ui.drawHeadline(headline, VIEW_W / 2, py + 76, pw - 60, 38, won ? '#ffd23f' : '#f2e6d0', won ? '#ff6a1a' : '#8a7a68');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (mode === 'career') {
      for (let i = 0; i < 3; ++i) {
        const sx = VIEW_W / 2 - 92 + i * 92, sy = py + 150 - (i === 1 ? 12 : 0);
        const size = i === 1 ? 84 : 70;
        ui.drawStar(sx, sy, size, false);
        if (i >= dayResult.stars) continue;
        /* the star slams in at 2x, settles, and keeps a glow */
        const k = dayOverT - (0.45 + i * 0.4);
        if (k < 0) continue;
        const s = k < 0.18 ? 2.2 - 1.3 * (k / 0.18) : k < 0.3 ? 0.9 + 0.1 * ((k - 0.18) / 0.12) : 1;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, k * 4) * (0.7 + 0.2 * Math.sin(animT * 3 + i));
        ctx.translate(sx, sy);
        ctx.rotate(animT * 0.6 + i);
        ui.drawGlow(0, 0, size * 2.4, '#ffc840', 10);
        ctx.restore();
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate((1 - Math.min(1, k / 0.18)) * -0.6);
        ctx.scale(s, s);
        ui.drawStar(0, 0, size, true);
        ctx.restore();
      }
    } else {
      const bestLine = 'Best $' + bestForMode() + (dayResult.newBest ? '  ·  NEW BEST' : '');
      ui.drawHeadline(bestLine, VIEW_W / 2, py + 146, pw - 120, 36, '#ffd23f', location.color);
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
      const ry = py + 214 + i * 30;
      const k = Math.min(1, Math.max(0, (dayOverT - 0.3 - i * 0.08) / 0.25));
      if (k <= 0) continue;
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.translate((1 - k) * 30, 0);
      ui.roundRectPath(px + 44, ry - 13, pw - 88, 26, 6);
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.18)' : 'rgba(255,220,160,0.06)';
      ctx.fill();
      ctx.textAlign = 'left';
      ui.fitText(rows[i][0], px + 60, ry, 200, 16, { weight: 'bold', color: ui.UI.textDim });
      ctx.textAlign = 'right';
      ui.fitText(rows[i][1], px + pw - 60, ry, 220, i === 0 ? 20 : 16, { weight: 'bold', color: i === 0 ? '#ffe060' : '#fff', outline: i === 0 ? '#3a1a04' : null });
      ctx.restore();
    }
    const nextEnabled = mode === 'career' && dayResult.stars >= 1 &&
      careerUnlocked(dayIndex + 1) && dayIndex + 1 < SZ.KitchenData.CAREER.length;
    /* one row of equal-width buttons: side padding 28, gap 16, 58 high,
       24 px above the panel bottom */
    const btnN = mode === 'career' ? 3 : 2;
    const btnW = (pw - 2 * 28 - (btnN - 1) * 16) / btnN;
    const btnY = py + ph - 24 - 58;
    if (mode === 'career') {
      drawButton('do-next', 'Next Day', px + 28, btnY, btnW, 58,
        { px: 19, color: 'green', disabled: !nextEnabled, action: () => startDay('career', dayIndex + 1) });
      drawButton('do-retry', 'Retry', px + 28 + btnW + 16, btnY, btnW, 58,
        { px: 19, color: 'orange', action: () => startDay('career', dayIndex) });
      drawButton('do-menu', 'Menu', px + 28 + 2 * (btnW + 16), btnY, btnW, 58,
        { px: 19, color: 'wood', action: () => setScreen(STATE_TITLE) });
    } else {
      drawButton('do-retry', 'Retry', px + 28, btnY, btnW, 58,
        { px: 19, color: 'orange', action: () => startDay(mode, 0) });
      drawButton('do-menu', 'Menu', px + 28 + btnW + 16, btnY, btnW, 58,
        { px: 19, color: 'wood', action: () => setScreen(STATE_TITLE) });
    }
    if (mode === 'career' && !nextEnabled) {
      ctx.textAlign = 'center';
      ui.fitText(dayResult.stars < 1 ? 'Earn at least one star to move on.'
        : 'The career ends here — try endless later.', VIEW_W / 2, py + ph - 100, pw - 60, 13, { weight: 'bold', color: ui.UI.textDim });
    }
    ctx.restore();
  }

  /* screen transition: an iris closing to black and opening on the new screen */
  function drawIris(k) {
    const v = visibleRect();
    if (k >= 0.999) {
      ctx.fillStyle = '#0a0602';
      fillVisibleRect();
      return;
    }
    const maxR = Math.hypot(v.x1 - v.x0, v.y1 - v.y0) / 2 + 20;
    const e = 1 - k;
    const r = Math.max(0, maxR * e * e * (3 - 2 * e));
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    ctx.arc(VIEW_W / 2, VIEW_H / 2, r, 0, Math.PI * 2, true);
    ctx.fillStyle = '#0a0602';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,90,' + (0.6 * k).toFixed(3) + ')';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(VIEW_W / 2, VIEW_H / 2, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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
      fx.draw(ctx);
      fx.drawTexts(ctx);
      if (menuFade > 0) {
        ctx.fillStyle = 'rgba(12,8,5,' + (0.5 * Math.min(1, menuFade / 0.5)).toFixed(3) + ')';
        fillVisibleRect();
      }
      if (fade > 0) drawIris(fade);
      return;
    }
    ctx.save();
    screenShake.apply(ctx);
    scene.draw(ctx, animT, visibleRect());
    drawCarpet();
    drawCustomers();
    scene.drawFront(ctx);
    drawPass();
    drawCustomerOverlays();
    if (waiter) {
      SZ.PeopleArt.drawCustomer(ctx, waiterLook, waiter.x, WAITER_Y, 'walk', animT, waiter.facing);
      if (waiter.state === 'toGuest')
        SZ.FoodArt.drawDish(ctx, waiter.dish.recipe, waiter.x + waiter.facing * 16, WAITER_Y - 76 + Math.abs(Math.sin(animT * 16)) * -3, 50, 1, waiter.dish.quality);
    }
    drawStations();
    const moving = Math.abs(chefTargetX - chefX) > 4;
    SZ.PeopleArt.drawChef(ctx, chefX, CHEF_Y, moving && chefPose === 'idle' ? 'run' : chefPose, animT, chefFacing);
    drawStationBars();
    drawArcs();
    drawFlying();
    if (sceneFade > 0) {
      ctx.fillStyle = 'rgba(12,8,5,' + Math.min(1, sceneFade / 0.6).toFixed(3) + ')';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    screenShake.restore(ctx);
    ctx.restore();
    drawRings();
    if (state !== STATE_DAY_OVER) fx.draw(ctx);
    drawCoins();
    drawPops();
    if (state !== STATE_DAY_OVER) fx.drawTexts(ctx);
    if (hitFlash) {
      ctx.fillStyle = 'rgba(' + hitFlash.color + ',' + (hitFlash.t * 0.6).toFixed(3) + ')';
      fillVisibleRect();
    }
    if (rushTimer > 0) drawRushGlow();
    if (tension > 0) drawTension();
    drawHUD();
    if (comboBanner) drawComboBanner();
    if (dayIntro > 0 && state === STATE_PLAYING) drawDayIntro();
    if (edgeGlow > 0) drawEdgeGlow();
    drawTicketRail();
    drawBurnAlerts();
    coachSkip = null;
    if (coach && state === STATE_PLAYING) drawCoach();
    if (state === STATE_PAUSED) drawPauseOverlay();
    if (state === STATE_DAY_OVER) {
      drawDayOver();
      fx.draw(ctx);
      fx.drawTexts(ctx);
    }
    if (fade > 0) drawIris(fade);
  }

  /* ── coach marks: pulsing outline, bobbing arrow and the hint panel ── */
  const COACH_PW = 340, COACH_PH = 88;

  function drawCoachOutline(tg) {
    const pulse = 0.5 + 0.5 * Math.sin(animT * 5);
    const g = 3 + pulse * 4;
    ctx.save();
    ui.roundRectPath(tg.x - g, tg.y - g, tg.w + g * 2, tg.h + g * 2, 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,215,90,' + (0.25 + 0.2 * pulse).toFixed(3) + ')';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,235,150,' + (0.75 + 0.25 * pulse).toFixed(3) + ')';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  }

  /* a fat gold arrow from (x0, y0) to the tip at (x1, y1), nudging forward */
  function drawCoachArrow(x0, y0, x1, y1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 12) return;
    const bob = (Math.sin(animT * 6) + 1) * 4;
    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(Math.atan2(y1 - y0, x1 - x0));
    ctx.translate(-bob, 0);
    const l = Math.max(18, len - 8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-18, -13);
    ctx.lineTo(-18, -5);
    ctx.lineTo(-l, -5);
    ctx.lineTo(-l, 5);
    ctx.lineTo(-18, 5);
    ctx.lineTo(-18, 13);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
    const g = ctx.createLinearGradient(0, -13, 0, 13);
    g.addColorStop(0, '#fff2b8');
    g.addColorStop(0.5, ui.UI.gold);
    g.addColorStop(1, ui.UI.goldDeep);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  function drawCoach() {
    const tg = coachTarget();
    if (!tg) return;
    const pw = COACH_PW, ph = COACH_PH;
    let px, py, ax0 = 0, ay0 = 0, ax1 = 0, ay1 = 0;
    if (tg.place === 'side') {
      const cy = tg.y + tg.h / 2;
      py = Math.max(16, Math.min(VIEW_H - 16 - ph, cy - ph / 2));
      px = tg.x + tg.w + 46;
      ax0 = px - 4;
      ax1 = tg.x + tg.w + 8;
      if (px + pw > VIEW_W - 16) {
        px = tg.x - 46 - pw;
        ax0 = px + pw + 4;
        ax1 = tg.x - 8;
      }
      ay0 = ay1 = cy;
    } else if (tg.place === 'station') {
      /* level with the ticket rail beside the station, pointing down at it */
      py = RAIL_Y - 8;
      px = tg.x + tg.w + 40;
      ax0 = px - 4;
      ax1 = tg.x + tg.w + 6;
      if (px + pw > VIEW_W - 16) {
        px = tg.x - 40 - pw;
        ax0 = px + pw + 4;
        ax1 = tg.x - 6;
      }
      ay0 = py + ph / 2;
      ay1 = tg.y + tg.h * 0.45;
    } else {
      px = VIEW_W / 2 - pw / 2;
      py = 150;
    }
    ctx.save();
    let a = Math.min(1, coach.t / 0.25);
    if (coach.step === 5) a = Math.min(a, coach.hideT / 0.4);
    ctx.globalAlpha = Math.max(0, a);
    if (tg.w) {
      drawCoachOutline(tg);
      drawCoachArrow(ax0, ay0, ax1, ay1);
    }
    ui.drawPanel(px, py, pw, ph, { title: 'Chef\'s tip  ' + coach.step + ' / 5', accent: ui.UI.gold, glow: true, headerH: 28, titlePx: 14, titleRightPad: 84 });
    /* the 'Skip tips' button in the header */
    const bw = 76, bh = 20, bx = px + pw - 8 - bw, by = py + 4;
    const hot = mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh;
    ui.roundRectPath(bx, by, bw, bh, bh / 2);
    ctx.fillStyle = hot ? 'rgba(255,215,90,0.28)' : 'rgba(255,255,255,0.07)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hot ? 'rgba(255,215,90,0.9)' : 'rgba(255,215,90,0.45)';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Skip tips', bx + bw / 2, by + bh / 2 + 1, bw - 12, 11, { weight: 'bold', color: hot ? '#fff' : ui.UI.textDim });
    coachSkip = { x: bx, y: by, w: bw, h: bh };
    ui.drawTextBlock(tg.text, px + 16, py + 34, pw - 32, ph - 42, 16, { color: ui.UI.text, weight: 'bold', valign: 'middle' });
    ctx.restore();
  }

  /* Rush tension: a soft red glow pulses at the screen edges while the day
     is a rush day or three guests wait at once. */
  function drawTension() {
    const a = tension * (0.10 + 0.05 * Math.sin(animT * 5));
    ctx.save();
    for (let i = 0; i < 4; ++i) {
      ctx.strokeStyle = 'rgba(224,50,40,' + (a * (1 - i * 0.22)).toFixed(3) + ')';
      ctx.lineWidth = 10;
      ctx.strokeRect(5 + i * 9, 5 + i * 9, VIEW_W - 10 - i * 18, VIEW_H - 10 - i * 18);
    }
    ctx.restore();
  }

  /* the big COMBO ×n banner: slams in over turning rays, burns with a row
     of flames and fades out over a second and a half */
  function drawComboBanner() {
    const k = comboBanner.t / 1.5;
    const s = k < 0.1 ? 0.2 + 1.6 * (k / 0.1) : k < 0.2 ? 1.8 - 0.8 * ((k - 0.1) / 0.1) : 1 + Math.sin(animT * 8) * 0.02;
    const a = k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(VIEW_W / 2, 150);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.5;
    ctx.rotate(animT * 0.6);
    ui.drawGlow(0, 0, 520, '#ff8a2a', 14);
    ctx.restore();
    for (let i = -3; i <= 3; ++i)
      drawFlame(i * 46, 34 - Math.abs(i) * 4, 30 - Math.abs(i) * 3);
    ctx.rotate(Math.sin(k * 20) * 0.03 * (1 - k));
    ctx.scale(s, s);
    ui.drawHeadline('COMBO ×' + comboBanner.n + '!', 0, 0, 640, 64, '#ffd23f', '#ff5a1a');
    ctx.restore();
  }

  /* the opening banner: a ribbon sweeps in with the day and venue, then away */
  function drawDayIntro() {
    const t = 2.2 - dayIntro;
    const inK = Math.min(1, t / 0.35), outK = Math.max(0, (t - 1.7) / 0.5);
    const ease = 1 - Math.pow(1 - inK, 3);
    const x = VIEW_W / 2 + (1 - ease) * -900 + outK * outK * 1100;
    ctx.save();
    ctx.globalAlpha = 1 - outK;
    const what = mode === 'career' ? 'Day ' + dayInfo.id : mode === 'daily' ? 'Daily Special' : 'Endless Rush';
    drawRibbon(x, 250, 560, 64, what + ' — ' + location.name, '#c8302a');
    const s = t < 0.5 ? 0.2 + 0.8 * Math.min(1, Math.max(0, (t - 0.15) / 0.35)) : 1 + Math.sin(t * 6) * 0.03;
    if (t > 0.15) {
      ctx.translate(x, 330);
      ctx.scale(s, s);
      ui.drawHeadline(mode === 'career' && dayInfo.special === 'rush' ? 'Rush hour!' : mode === 'career' && dayInfo.special === 'critic' ? 'A critic is coming!' : 'Let\'s cook!', 0, 0, 700, 56, '#ffd23f', '#ff6a1a');
    }
    ctx.restore();
  }

  /* one second of gold light along the screen edge when the combo steps up */
  function drawEdgeGlow() {
    ctx.save();
    for (let i = 0; i < 4; ++i) {
      ctx.strokeStyle = 'rgba(255,200,60,' + (0.4 * edgeGlow * (1 - i * 0.22)).toFixed(3) + ')';
      ctx.lineWidth = 10;
      ctx.strokeRect(5 + i * 9, 5 + i * 9, VIEW_W - 10 - i * 18, VIEW_H - 10 - i * 18);
    }
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
          fx.text(VIEW_W / 2, 170, location.name, { color: location.color, size: 36, life: 1.6 });
          updateStatus();
        }
      }
      if (spawned < spawnLimit() && !coachHoldsSpawn()) {
        spawnTimer -= dt;
        if (spawnTimer <= 0 && spawnCustomer())
          spawnTimer = dayInfo.spawnEvery;
      }
      updateCustomers(dt);
      updateStations(dt);
      updateFlying(dt);
      updateWaiter(dt);
      updateChef(dt);
      updateCoach(dt);
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
          fx.emit('confetti', VIEW_W / 2 - 200, 260, 40, { speed: 520, angle: -Math.PI / 2 + 0.3, spread: 1.4 });
          fx.emit('confetti', VIEW_W / 2 + 200, 260, 40, { speed: 520, angle: -Math.PI / 2 - 0.3, spread: 1.4 });
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
    fx.update(dt);
    screenShake.update(dt * 1000);

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
    coach = null;
    coachSkip = null;
    fade = 1;
    save = loadSave();
    fx.clear();
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
