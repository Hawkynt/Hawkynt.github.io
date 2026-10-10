;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const VIEW_W = 1280;
  const VIEW_H = 720;
  const MAX_DT = 0.05;

  /* the board is centred inside this area of the view; the strip above it
     between the top bar and the board carries the level hint banner, and the
     area stops short of the element bar at the bottom */
  const BOARD_X0 = 32, BOARD_Y0 = 170, BOARD_X1 = 872, BOARD_Y1 = 640;
  const BOARD_W = BOARD_X1 - BOARD_X0;   // 840
  const BOARD_H = BOARD_Y1 - BOARD_Y0;   // 470

  const WALK_STEP_TIME = 0.12;   // one tile step of the mage
  const CAST_TIME = 0.35;        // casting pose before the spell lands
  const BURN_STEP_DELAY = 0.06;  // fire/water spread per distance step
  const SLIDE_STEP_TIME = 0.07;  // boulder slide per tile
  const SPELL_TIME = 0.5;        // one spell effect strip
  const HINT_TIME = 2.5;         // solver hint highlight
  const HINT_BANNER_TIME = 4.0;  // level hint banner, then it fades out
  const HINT_BANNER_Y = 140;     // centred in the strip between top bar and board
  const HINT_BANNER_H = 30;
  const PORTAL_ENTER_TIME = 0.7; // the mage shrinking into the portal
  const DAILY_SHARDS = 5;        // arcane shards for the first solve of the daily puzzle
  const PROJECTILE_TIME = 0.18;  // the spell orb's flight from the staff to the target
  const RING_TIME = 0.45;        // one expanding impact ring
  const MAX_RINGS = 24;
  const MOTE_COUNT = 24;         // ambient motes drifting over the board
  const MAX_MOTES = 60;
  const FADE_RATE = 3.5;         // screen-change fade, alpha units per second
  const REALM_BANNER_TIME = 2.6; // the realm-restored banner

  /* ── Elements ── */
  const ELEMENTS = [
    { id: 'fire',  name: 'Fire',  color: '#ff7a3a', key: '1' },
    { id: 'water', name: 'Water', color: '#3ab4ff', key: '2' },
    { id: 'earth', name: 'Earth', color: '#c9a36a', key: '3' },
    { id: 'air',   name: 'Air',   color: '#8fc8ee', key: '4' }
  ];
  const ELEMENT_BY_ID = {};
  for (const el of ELEMENTS)
    ELEMENT_BY_ID[el.id] = el;

  /* the selection chime sits lower for the heavy elements, higher for air */
  const ELEMENT_PITCH = { fire: 1.2, water: 1.0, earth: 0.8, air: 1.4 };

  /* ── States ── */
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_LEVEL_COMPLETE = 'LEVEL_COMPLETE';
  const STATE_OUT_OF_MANA = 'OUT_OF_MANA';
  const MENU_SCREENS = ['title', 'realms', 'trials', 'grimoire', 'wardrobe', 'help'];

  function isMenuState(s) {
    return MENU_SCREENS.indexOf(s) >= 0;
  }

  /* ── Sound ──
     one gate for every effect: the same name never fires twice within
     SFX_THROTTLE_MS, so bursts of steps or a spreading blaze can't spam */
  const SFX_THROTTLE_MS = 40;
  const sfxLast = {};

  function sfx(name, opts) {
    const now = performance.now();
    if (now - (sfxLast[name] || -Infinity) < SFX_THROTTLE_MS)
      return;
    sfxLast[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-fantasy-puzzle';
  const STORAGE_SAVE = STORAGE_PREFIX + '-v2';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL_SEEN = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 10;

  const T = SZ.PuzzleCore.T;
  const DIRS = SZ.PuzzleCore.DIRS;

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const ui = SZ.PuzzleUI.create(ctx);
  const statusLevel = document.getElementById('statusLevel');
  const statusElement = document.getElementById('statusElement');
  const statusMoves = document.getElementById('statusMoves');
  const statusStars = document.getElementById('statusStars');
  const highScoresBody = document.getElementById('highScoresBody');

  /* ── API: Windows integration ── */
  const { User32 } = SZ?.Dlls ?? {};

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = STATE_PLAYING;
  let time = 0;

  /* the puzzle session */
  let level = null, puzzle = null, history = [], historyCosts = [], mana = 0, manaTotal = 0, casts = 0, levelKind = 'campaign', levelIndex = 0, scene = null;
  let sessionMode = 'campaign';   // 'campaign' | 'trial' | 'daily'
  let hintsLeft = 1, undosLeft = 5, lastShardGain = 0;
  let theme = 0;
  let selectedElement = 'fire';

  /* cached rule sets, invalidated whenever the tiles change */
  let reachCache = null, actionsCache = null;

  /* the mage: pixel position in board space (64 px tiles) */
  const hero = { x: 32, y: 32, dir: 'down', pose: 'idle', t: 0, scale: 1, alpha: 1 };
  let walk = { from: -1, path: [], t: 0, onDone: null };
  let stepCount = 0;  // tiles the mage has stepped, for the every-other-step footfall
  let pendingCast = null; // { action, standIdx, faceDir, phase, timer }
  let winSeq = null;      // { phase: 'walk' | 'enter', t }

  /* visual effects */
  let spells = [];    // { kind, x, y, t, dur } in board space
  let tileFx = [];    // { index, oldCode, newCode, delay, elapsed, fired, dist }
  let slide = null;   // { fromIdx, toIdx, chasmIdx, t, dur, swallowed }
  let tileShake = null;
  let hintFx = null;  // { action, t }
  let hintBanner = { text: '', t: 0 };
  let projectiles = []; // { x0, y0, x1, y1, t, dur, color, prev, next, action, changed } board space
  let rings = [];     // { x, y, t, dur, r0, r1, color, lw } in board space
  let motes = [];     // { x, y, vx, vy, size, phase } drifting over the board
  let fade = 0;       // screen-change fade, 1 -> 0
  let elementBounce = null; // { id, at } the element bar icon bounce
  let realmBanner = null;   // { realm, t } the realm-restored banner
  let panelAnim = null;     // { at, starPlayed } the complete panel's pop-in
  let unlockFx = null;      // { realm, at } the realms-screen lock shatter
  let hoverInvalidT = 0;    // how long the pointer has rested on an invalid tile
  let blinkT = 0, blinkNext = 3 + Math.random() * 2, blinkSquash = 0;
  let gemT = 0;             // the staff gem's idle sparkle timer

  /* hover */
  let hoverIdx = -1;

  /* ── Menu navigation ── */
  let hitAreas = [], menuCursor = 0, mouseX = -1, mouseY = -1;
  let prevScreen = 'title', helpFrom = 'title', helpPage = 0;
  let wardrobeCursor = 0;
  let treeBranch = 0, treeSelected = null, treeLayout = null, treeBuyFlash = null;

  /* ── Help on first run ── */
  let tutorialSeen = false;

  /* ── Persistence ── */
  let save = { stars: {} };
  let highScores = [];

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  let viewScale = 1, viewOffX = 0, viewOffY = 0, dpr = 1;

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
    ctx.fillStyle = '#0b0816';
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
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function defaultSave() {
    return {
      v: 2,
      stars: {},
      shards: 0,
      tree: {},
      robe: 'violet',
      robes: ['violet'],
      daily: { date: '', solved: false, stars: 0 },
      stats: { casts: 0, levels: 0 },
      seenUnlocks: {}
    };
  }

  /* the v2 save is merged over the defaults field by field, so partial or
     older payloads never leave a hole; the legacy 'sz-fantasy-puzzle-progress'
     key belongs to the old level set and is deliberately left untouched */
  function loadSave() {
    save = defaultSave();
    try {
      const raw = localStorage.getItem(STORAGE_SAVE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (parsed.stars && typeof parsed.stars === 'object')
            save.stars = parsed.stars;
          save.shards = Math.max(0, parsed.shards | 0);
          if (parsed.tree && typeof parsed.tree === 'object')
            save.tree = parsed.tree;
          if (typeof parsed.robe === 'string' && ROBES[parsed.robe])
            save.robe = parsed.robe;
          if (Array.isArray(parsed.robes))
            save.robes = parsed.robes.filter(function(id) { return ROBES[id]; });
          if (save.robes.indexOf(save.robe) < 0)
            save.robes.push(save.robe);
          if (parsed.daily && typeof parsed.daily === 'object') {
            save.daily.date = typeof parsed.daily.date === 'string' ? parsed.daily.date : '';
            save.daily.solved = !!parsed.daily.solved;
            save.daily.stars = parsed.daily.stars | 0;
          }
          if (parsed.stats && typeof parsed.stats === 'object') {
            save.stats.casts = parsed.stats.casts | 0;
            save.stats.levels = parsed.stats.levels | 0;
          }
          if (parsed.seenUnlocks && typeof parsed.seenUnlocks === 'object')
            save.seenUnlocks = parsed.seenUnlocks;
        }
      }
    } catch (_) {
      save = defaultSave();
    }
  }

  function writeSave() {
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(save));
    } catch (_) {}
  }

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw)
        highScores = JSON.parse(raw);
    } catch (_) {
      highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
    } catch (_) {}
  }

  function addHighScore(levelName, stars) {
    highScores.push({ level: levelName, stars });
    highScores.sort((a, b) => b.stars - a.stars);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].level}</td><td>${'★'.repeat(highScores[i].stars)}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  function loadTutorialSeen() {
    try {
      tutorialSeen = localStorage.getItem(STORAGE_TUTORIAL_SEEN) === '1';
    } catch (_) {
      tutorialSeen = false;
    }
  }

  function saveTutorialSeen() {
    try {
      localStorage.setItem(STORAGE_TUTORIAL_SEEN, '1');
    } catch (_) {}
  }

  /* ══════════════════════════════════════════════════════════════════
     GRIMOIRE — the tech tree bought with arcane shards
     ══════════════════════════════════════════════════════════════════ */

  const TREE_BRANCHES = {
    arcana: { name: 'Arcana', color: '#c04cff' },
    insight: { name: 'Insight', color: '#3ab4ff' },
    chronos: { name: 'Chronos', color: '#6fe08a' },
    style: { name: 'Style', color: '#ffd23f' }
  };

  const TREE = [
    { id: 'a_well', branch: 'arcana', name: 'Mana Well', desc: '+1 mana in every puzzle', costs: [6], req: [] },
    { id: 'a_deep', branch: 'arcana', name: 'Deep Well', desc: '+1 more mana in every puzzle', costs: [18], req: [['a_well', 1]] },
    { id: 'a_focus', branch: 'arcana', name: 'Focus', desc: 'The first cast of each puzzle is free', costs: [30], req: [['a_deep', 1]] },
    { id: 'i_hint', branch: 'insight', name: 'Seer', desc: '+1 hint per puzzle per level', costs: [5, 12], req: [] },
    { id: 'i_runes', branch: 'insight', name: 'Rune Sight', desc: 'Hidden runes shimmer through walls', costs: [8], req: [['i_hint', 1]] },
    { id: 'i_oracle', branch: 'insight', name: 'Oracle', desc: 'See the par number of casts and the next optimal element', costs: [20], req: [['i_runes', 1]] },
    { id: 'c_undo', branch: 'chronos', name: 'Rewind', desc: '+5 undos per puzzle per level', costs: [4, 10], req: [] },
    { id: 'c_free', branch: 'chronos', name: 'Timeless', desc: 'Unlimited undos', costs: [24], req: [['c_undo', 2]] },
    { id: 's_trail', branch: 'style', name: 'Starlight Steps', desc: 'The mage leaves a sparkle trail', costs: [5], req: [] },
    { id: 's_robes', branch: 'style', name: 'Wardrobe', desc: 'Unlocks the robes Crimson, Emerald and Midnight', costs: [8], req: [] },
    { id: 's_gold', branch: 'style', name: 'Golden Robes', desc: 'Unlocks the Solar and Arcane robes', costs: [20], req: [['s_robes', 1]] },
    { id: 's_finale', branch: 'style', name: 'Grand Entrance', desc: 'Fireworks when you step into the portal', costs: [12], req: [['s_trail', 1]] }
  ];
  const TREE_BY_ID = {};
  for (const node of TREE)
    TREE_BY_ID[node.id] = node;

  const TREE_ROBES = {
    s_robes: ['crimson', 'emerald', 'midnight'],
    s_gold: ['solar', 'arcane']
  };

  function treeLevel(id) {
    return save.tree[id] | 0;
  }

  function nodeState(id) {
    const node = TREE_BY_ID[id];
    if (!node)
      return 'locked';
    const rank = treeLevel(id);
    if (rank >= node.costs.length)
      return 'maxed';
    for (const [reqId, reqLevel] of node.req)
      if (treeLevel(reqId) < reqLevel)
        return 'locked';
    if (save.shards < node.costs[rank])
      return 'expensive';
    return 'available';
  }

  function buyNode(id) {
    if (nodeState(id) !== 'available') {
      sfx('error', { volume: 0.4 });
      return false;
    }
    const node = TREE_BY_ID[id];
    save.shards -= node.costs[treeLevel(id)];
    save.tree[id] = treeLevel(id) + 1;
    const robes = TREE_ROBES[id];
    if (robes)
      for (const robeId of robes)
        if (save.robes.indexOf(robeId) < 0)
          save.robes.push(robeId);
    writeSave();
    sfx('powerup');
    sfx('coin');
    return true;
  }

  /* ── robes ── */
  const ROBES = {
    violet: '#5a4ae0',
    crimson: '#c03a4a',
    emerald: '#2f9a5a',
    midnight: '#26305a',
    solar: '#e0a82a',
    arcane: '#a03ad0'
  };

  function selectRobe(id) {
    if (!ROBES[id] || save.robes.indexOf(id) < 0) {
      sfx('error', { volume: 0.4 });
      return false;
    }
    save.robe = id;
    writeSave();
    sfx('select');
    return true;
  }

  /* which Grimoire node unlocks a robe, for the Wardrobe's lock labels */
  function robeRequirement(id) {
    for (const nodeId in TREE_ROBES)
      if (TREE_ROBES[nodeId].indexOf(id) >= 0)
        return TREE_BY_ID[nodeId].name;
    return '';
  }

  /* ── tree layout: branch tabs plus cards by requirement depth ── */

  const TREE_BRANCH_LIST = [];
  for (const branchId in TREE_BRANCHES)
    TREE_BRANCH_LIST.push(Object.assign({ id: branchId }, TREE_BRANCHES[branchId]));

  function romanNumeral(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
  }

  function treeMaxedCount() {
    let n = 0;
    for (const node of TREE)
      if (treeLevel(node.id) >= node.costs.length)
        ++n;
    return n;
  }

  /* column of a node: one past the deepest node it requires */
  function treeDepth(node) {
    let d = 0;
    for (const [reqId] of node.req) {
      const parent = TREE_BY_ID[reqId];
      if (parent)
        d = Math.max(d, treeDepth(parent) + 1);
    }
    return d;
  }

  const TREE_CARD_W = 300, TREE_CARD_H = 120, TREE_COL_GAP = 90, TREE_ROW_GAP = 26;

  /* tabs plus the card grid of the active branch, centered in the card area */
  function buildTreeLayout() {
    const tabs = [];
    const tabW = (1232 - (TREE_BRANCH_LIST.length - 1) * 8) / TREE_BRANCH_LIST.length;
    for (let i = 0; i < TREE_BRANCH_LIST.length; ++i) {
      const b = TREE_BRANCH_LIST[i];
      const nodes = TREE.filter(function(n) { return n.branch === b.id; });
      let maxed = 0;
      for (const node of nodes)
        if (treeLevel(node.id) >= node.costs.length)
          ++maxed;
      tabs.push({ index: i, branch: b, x: 24 + i * (tabW + 8), y: 108, w: tabW, h: 36, maxed: maxed, total: nodes.length });
    }

    const branch = TREE_BRANCH_LIST[treeBranch];
    const cols = [];
    for (const node of TREE) {
      if (node.branch !== branch.id)
        continue;
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
          state: nodeState(node.id)
        });
      }
    }
    return { tabs: tabs, cards: cards, branch: branch };
  }

  function treeCardById(id) {
    if (!treeLayout)
      return null;
    return treeLayout.cards.find(function(c) { return c.node.id === id; }) || null;
  }

  function selectFirstInBranch() {
    const branchId = TREE_BRANCH_LIST[treeBranch].id;
    const first = treeLayout ? treeLayout.cards.find(function(c) { return c.node.branch === branchId; }) : null;
    treeSelected = first ? first.node.id : null;
  }

  /* Up/Down within a column, Left/Right between columns; past an edge the
     selection wraps into the previous/next branch */
  function moveTreeSelection(dc, dr) {
    if (!treeLayout)
      treeLayout = buildTreeLayout();
    const branchId = TREE_BRANCH_LIST[treeBranch].id;
    const cur = treeCardById(treeSelected);
    if (!cur || cur.node.branch !== branchId) {
      selectFirstInBranch();
      sfx('click', { volume: 0.4 });
      return;
    }
    const cols = {};
    for (const card of treeLayout.cards) {
      if (card.node.branch !== branchId)
        continue;
      if (!cols[card.col]) cols[card.col] = [];
      cols[card.col].push(card);
    }
    const colIdx = Object.keys(cols).map(Number).sort(function(a, b) { return a - b; });
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

  /* ══════════════════════════════════════════════════════════════════
     MODES — campaign, daily puzzle, trials
     ══════════════════════════════════════════════════════════════════ */

  function localDateString() {
    const d = new Date();
    const m = String(d.getMonth() + 1);
    const day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }

  /* FNV-1a over the local date picks one stable trial per day */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; ++i) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function dailyIndex() {
    return fnv1a(localDateString()) % SZ.PuzzleLevels.BONUS.length;
  }

  function campaignUnlocked(i) {
    const list = SZ.PuzzleLevels.CAMPAIGN;
    if (i <= 0)
      return true;
    if (i >= list.length)
      return false;
    if (!(save.stars[list[i - 1].id] >= 1))
      return false;
    /* the first level of a realm also requires the last level of the previous realm */
    if (list[i].realm !== list[i - 1].realm) {
      let prevLast = i - 1;
      while (prevLast > 0 && list[prevLast].realm === list[prevLast - 1].realm)
        --prevLast;
      if (!(save.stars[list[prevLast].id] >= 1))
        return false;
    }
    return true;
  }

  function campaignStarCount() {
    let n = 0;
    for (const lv of SZ.PuzzleLevels.CAMPAIGN)
      if (save.stars[lv.id] >= 1)
        ++n;
    return n;
  }

  function trialUnlocked(i) {
    const list = SZ.PuzzleLevels.BONUS;
    if (i < 0 || i >= list.length)
      return false;
    if (campaignStarCount() < 10)
      return false;
    if (i < 6)
      return true;
    return save.stars[list[i - 1].id] >= 1;
  }

  function solvedTrialCount() {
    let n = 0;
    for (const lv of SZ.PuzzleLevels.BONUS)
      if (save.stars[lv.id] >= 1)
        ++n;
    return n;
  }

  /* a realm is open once its first campaign level is */
  function realmUnlocked(r) {
    return campaignUnlocked(r * 8);
  }

  function dailySub() {
    if (save.daily.date === localDateString() && save.daily.solved)
      return 'Solved ' + '★'.repeat(save.daily.stars) + '☆'.repeat(3 - save.daily.stars);
    return 'New puzzle';
  }

  function loadDailyPuzzle() {
    const today = localDateString();
    if (save.daily.date !== today) {
      save.daily = { date: today, solved: false, stars: 0 };
      writeSave();
    }
    loadPuzzle('bonus', dailyIndex());
    sessionMode = 'daily';
  }

  /* ══════════════════════════════════════════════════════════════════
     LEVEL SESSION
     ══════════════════════════════════════════════════════════════════ */

  function levelList(kind) {
    return kind === 'campaign' ? SZ.PuzzleLevels.CAMPAIGN : SZ.PuzzleLevels.BONUS;
  }

  function realmInfo() {
    return SZ.PuzzleLevels.REALMS[theme];
  }

  function realmElements() {
    return realmInfo().elements;
  }

  function loadPuzzle(kind, index) {
    const list = levelList(kind);
    index = Math.max(0, Math.min(list.length - 1, index | 0));
    level = list[index];
    levelKind = kind;
    levelIndex = index;
    puzzle = SZ.PuzzleCore.parseLevel(level);
    history = [];
    historyCosts = [];
    sessionMode = kind === 'campaign' ? 'campaign' : 'trial';
    manaTotal = level.mana + treeLevel('a_well') + treeLevel('a_deep');
    mana = manaTotal;
    casts = 0;
    hintsLeft = 1 + treeLevel('i_hint');
    undosLeft = treeLevel('c_free') ? Infinity : 5 + 5 * treeLevel('c_undo');
    lastShardGain = 0;
    theme = level.realm < 0 ? (index % SZ.PuzzleLevels.REALMS.length) : level.realm;
    scene = SZ.PuzzleScene.create(theme);
    computeBoard();
    if (realmElements().indexOf(selectedElement) < 0)
      selectedElement = realmElements()[0];
    /* reset the mage and every running effect */
    hero.x = colOf(puzzle.hero) * 64 + 32;
    hero.y = rowOf(puzzle.hero) * 64 + 32;
    hero.dir = 'down';
    hero.pose = 'idle';
    hero.t = 0;
    hero.scale = 1;
    hero.alpha = 1;
    walk = { from: puzzle.hero, path: [], t: 0, onDone: null };
    pendingCast = null;
    winSeq = null;
    spells = [];
    tileFx = [];
    slide = null;
    tileShake = null;
    hintFx = null;
    hoverIdx = -1;
    projectiles = [];
    rings = [];
    motes = [];
    ensureMotes();
    panelAnim = null;
    elementBounce = null;
    realmBanner = null;
    hoverInvalidT = 0;
    blinkT = 0;
    blinkSquash = 0;
    gemT = 0;
    particles.clear();
    floatingText.clear();
    hintBanner = { text: level.hint || '', t: level.hint ? HINT_BANNER_TIME : 0 };
    invalidateCaches();
    state = STATE_PLAYING;
    menuCursor = 0;
    fade = 1;
    updateWindowTitle();
  }

  /* the ambient motes over the board, seeded to the current board size */
  function ensureMotes() {
    while (motes.length < Math.min(MOTE_COUNT, MAX_MOTES)) {
      motes.push({
        x: Math.random() * puzzle.cols * 64,
        y: Math.random() * puzzle.rows * 64,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 5,
        size: 1 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function restartLevel() {
    const mode = sessionMode;
    loadPuzzle(levelKind, levelIndex);
    sessionMode = mode;
    sfx('whoosh', { pitch: 0.7 });
  }

  /* Next stays inside the current kind: campaign walks on through the realms,
     trials through the bonus list, the daily puzzle returns to the menu */
  function nextLevel() {
    if (sessionMode === 'daily') {
      goLevels();
      return;
    }
    const list = levelList(levelKind);
    if (levelIndex + 1 < list.length) {
      loadPuzzle(levelKind, levelIndex + 1);
      return;
    }
    sfx('win');
    goLevels();
  }

  /* 'Levels' goes back to the screen the level came from */
  function goLevels() {
    if (sessionMode === 'daily')
      setScreen('title');
    else if (sessionMode === 'trial')
      setScreen('trials');
    else
      setScreen('realms');
  }

  /* ── screen switching ── */
  function setScreen(name) {
    state = name;
    menuCursor = 0;
    hitAreas.length = 0;
    realmBanner = null;
    fade = 1;
    updateStatusBar();
  }

  function openHelp() {
    helpFrom = isMenuState(state) ? state : 'title';
    helpPage = 0;
    setScreen('help');
  }

  function leaveHelp() {
    if (!tutorialSeen) {
      tutorialSeen = true;
      saveTutorialSeen();
    }
    setScreen(helpFrom);
  }

  /* ── realm scenes, one cached instance per realm ── */
  const sceneCache = {};

  function getScene(realm) {
    const key = realm | 0;
    if (!sceneCache[key])
      sceneCache[key] = SZ.PuzzleScene.create(key);
    return sceneCache[key];
  }

  /* the realm scene over the whole visible area plus a soft dark veil */
  function drawMenuBackdrop(realm, veil) {
    const v = visibleRect();
    getScene(realm).draw(ctx, time, v);
    ctx.fillStyle = veil || 'rgba(4,6,14,0.55)';
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  /* ══════════════════════════════════════════════════════════════════
     BOARD GEOMETRY  (the art is authored for 64 px tiles)
     ══════════════════════════════════════════════════════════════════ */

  let TS = 64, boardX = 0, boardY = 0;

  function computeBoard() {
    TS = Math.min(64, Math.floor(BOARD_W / puzzle.cols), Math.floor(BOARD_H / puzzle.rows));
    boardX = BOARD_X0 + (BOARD_W - puzzle.cols * TS) / 2;
    boardY = BOARD_Y0 + (BOARD_H - puzzle.rows * TS) / 2;
  }

  function rowOf(idx) { return (idx / puzzle.cols) | 0; }
  function colOf(idx) { return idx % puzzle.cols; }
  function tileCenterX(idx) { return colOf(idx) * 64 + 32; }
  function tileCenterY(idx) { return rowOf(idx) * 64 + 32; }
  function tileVariant(idx) { return (rowOf(idx) * 7 + colOf(idx) * 13) % 4; }

  /* board space (64 px) -> view space */
  function toViewX(x) { return boardX + x * TS / 64; }
  function toViewY(y) { return boardY + y * TS / 64; }

  function pointToTile(p) {
    const c = Math.floor((p.x - boardX) / TS);
    const r = Math.floor((p.y - boardY) / TS);
    if (c < 0 || c >= puzzle.cols || r < 0 || r >= puzzle.rows)
      return -1;
    return r * puzzle.cols + c;
  }

  /* ══════════════════════════════════════════════════════════════════
     RULE HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function invalidateCaches() {
    reachCache = null;
    actionsCache = null;
  }

  function reach() {
    if (!reachCache)
      reachCache = SZ.PuzzleCore.reachSet(puzzle);
    return reachCache;
  }

  function actions() {
    if (!actionsCache)
      actionsCache = SZ.PuzzleCore.validActions(puzzle);
    return actionsCache;
  }

  function isWalkable(tile) {
    return tile === T.FLOOR || tile === T.WATER || tile === T.GOAL || tile === T.RUNE;
  }

  function goalIndex() {
    const tiles = puzzle.tiles;
    for (let i = 0; i < tiles.length; ++i)
      if (tiles[i] === T.GOAL)
        return i;
    return -1;
  }

  function neighbours4(idx, out) {
    const rows = puzzle.rows, cols = puzzle.cols;
    const r = rowOf(idx), c = colOf(idx);
    out.length = 0;
    if (r > 0) out.push(idx - cols);
    if (r + 1 < rows) out.push(idx + cols);
    if (c > 0) out.push(idx - 1);
    if (c + 1 < cols) out.push(idx + 1);
    return out;
  }

  /* shortest walking route over walkable tiles, as tile indices from -> to */
  function walkPath(from, to) {
    if (from === to)
      return [from];
    const prev = new Map([[from, -1]]);
    const queue = [from];
    const nb = [];
    for (let head = 0; head < queue.length; ++head) {
      const idx = queue[head];
      neighbours4(idx, nb);
      for (const n of nb) {
        if (prev.has(n) || !isWalkable(puzzle.tiles[n]))
          continue;
        prev.set(n, idx);
        if (n === to) {
          const path = [n];
          let cur = n;
          while (prev.get(cur) >= 0) {
            cur = prev.get(cur);
            path.push(cur);
          }
          path.reverse();
          return path;
        }
        queue.push(n);
      }
    }
    return null;
  }

  /* the reachable tile next to `target` that the mage reaches first */
  function nearestStandTo(target) {
    const prev = new Map([[puzzle.hero, -1]]);
    const queue = [puzzle.hero];
    const nb = [];
    for (let head = 0; head < queue.length; ++head) {
      const idx = queue[head];
      neighbours4(idx, nb);
      for (const n of nb) {
        if (n === target)
          continue;
        if (prev.has(n) || !isWalkable(puzzle.tiles[n]))
          continue;
        prev.set(n, idx);
        queue.push(n);
      }
    }
    neighbours4(target, nb);
    let best = -1, bestDist = Infinity;
    for (const n of nb) {
      if (!reach().has(n))
        continue;
      let d = 0, cur = n;
      while (prev.get(cur) >= 0) { ++d; cur = prev.get(cur); }
      if (d < bestDist) { bestDist = d; best = n; }
    }
    return best;
  }

  function dirBetween(from, to) {
    const dr = rowOf(to) - rowOf(from), dc = colOf(to) - colOf(from);
    if (Math.abs(dr) >= Math.abs(dc))
      return dr < 0 ? 'up' : 'down';
    return dc < 0 ? 'left' : 'right';
  }

  /* the push direction the pointer asks for on a boulder: the mage stands
     on the side the pointer points at and shoves the boulder away from it */
  function airDirForPointer(idx, p) {
    const cx = toViewX(tileCenterX(idx)), cy = toViewY(tileCenterY(idx));
    const dx = p.x - cx, dy = p.y - cy;
    if (Math.abs(dx) >= Math.abs(dy))
      return dx >= 0 ? 'left' : 'right';
    return dy >= 0 ? 'up' : 'down';
  }

  function actionsForTile(idx, element, p) {
    const list = actions();
    const out = [];
    for (const a of list) {
      if (a.index !== idx || a.element !== element)
        continue;
      if (element === 'air' && p && a.dir !== airDirForPointer(idx, p))
        continue;
      out.push(a);
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════
     WALKING
     ══════════════════════════════════════════════════════════════════ */

  function startWalk(target, onDone) {
    const path = walkPath(puzzle.hero, target);
    if (!path)
      return false;
    walk = { from: puzzle.hero, path: path.slice(1), t: 0, onDone: onDone || null };
    return true;
  }

  function updateWalk(dt) {
    if (walk.path.length) {
      walk.t += dt;
      while (walk.path.length && walk.t >= WALK_STEP_TIME) {
        walk.t -= WALK_STEP_TIME;
        const next = walk.path.shift();
        hero.dir = dirBetween(walk.from, next);
        walk.from = next;
        puzzle.hero = next;
        /* a soft footfall on every second step, slightly off-pitch each time */
        ++stepCount;
        if (stepCount % 2 === 0)
          sfx('blip', { pitch: 0.8 + Math.random() * 0.1, volume: 0.15 });
        /* Starlight Steps: a short-lived sparkle on every stepped tile */
        if (treeLevel('s_trail') > 0)
          particles.sparkle(toViewX(tileCenterX(next)), toViewY(tileCenterY(next)), 2, { color: '#ffe9a8', speed: 0.6 });
        /* a small dust puff with each step; golden sparks while the win path lights up */
        if (winSeq) {
          winSeq.trail.push(next);
          particles.sparkle(toViewX(tileCenterX(next)), toViewY(tileCenterY(next)), 3, { color: '#ffd75a', speed: 1.5 });
        } else {
          particles.burst(toViewX(tileCenterX(next)), toViewY(tileCenterY(next)) + 12, 3, { color: '#a89878', speed: 0.9, life: 0.3, size: 2, decay: 0.05 });
        }
      }
      hero.pose = 'walk';
      if (walk.path.length) {
        const k = Math.min(1, walk.t / WALK_STEP_TIME);
        hero.x = tileCenterX(walk.from) + (tileCenterX(walk.path[0]) - tileCenterX(walk.from)) * k;
        hero.y = tileCenterY(walk.from) + (tileCenterY(walk.path[0]) - tileCenterY(walk.from)) * k;
      } else {
        hero.x = tileCenterX(walk.from);
        hero.y = tileCenterY(walk.from);
      }
      return;
    }
    if (walk.onDone) {
      const cb = walk.onDone;
      walk.onDone = null;
      cb();
    }
    if (hero.pose === 'walk')
      hero.pose = 'idle';
  }

  /* ══════════════════════════════════════════════════════════════════
     UNDO / HINT / ELEMENT SELECTION
     ══════════════════════════════════════════════════════════════════ */

  function undoCast() {
    if (!history.length || pendingCast || winSeq || projectiles.length)
      return;
    if (undosLeft <= 0) {
      sfx('error', { volume: 0.4 });
      return;
    }
    --undosLeft;
    puzzle = history.pop();
    mana += historyCosts.pop();
    --casts;
    invalidateCaches();
    walk = { from: puzzle.hero, path: [], t: 0, onDone: null };
    hero.x = tileCenterX(puzzle.hero);
    hero.y = tileCenterY(puzzle.hero);
    hero.pose = 'idle';
    hero.scale = 1;
    hero.alpha = 1;
    tileFx = [];
    slide = null;
    if (state === STATE_OUT_OF_MANA)
      state = STATE_PLAYING;
    sfx('click', { pitch: 0.8 });
  }

  function showHint() {
    if (state !== STATE_PLAYING || pendingCast || winSeq)
      return;
    if (hintsLeft <= 0) {
      sfx('error', { volume: 0.4 });
      return;
    }
    const action = SZ.PuzzleCore.hint(puzzle);
    if (!action && !level.hint) {
      sfx('error', { volume: 0.4 });
      return;
    }
    /* the solver's highlight and the level's own hint strip come up together */
    --hintsLeft;
    if (action)
      hintFx = { action: action, t: HINT_TIME };
    if (level.hint)
      hintBanner = { text: level.hint, t: HINT_BANNER_TIME };
    sfx('blip', { pitch: 1.5 });
  }

  function selectElement(elemId) {
    if (selectedElement === elemId)
      return;
    if (realmElements().indexOf(elemId) < 0) {
      sfx('error', { volume: 0.4 });
      return;
    }
    selectedElement = elemId;
    elementBounce = { id: elemId, at: time };
    /* the mage briefly breathes out the new element's colour */
    if (!isMenuState(state) && !winSeq)
      particles.burst(toViewX(hero.x), toViewY(hero.y) - 8, 10, { color: ELEMENT_BY_ID[elemId].color, speed: 2.2, life: 0.5 });
    sfx('select', { pitch: ELEMENT_PITCH[elemId] });
  }
  /* ══════════════════════════════════════════════════════════════════
     CASTING
     ══════════════════════════════════════════════════════════════════ */

  function beginCast(action, standIdx, faceDir) {
    pendingCast = { action: action, standIdx: standIdx, faceDir: faceDir, phase: 'walk', timer: 0 };
    if (standIdx === puzzle.hero) {
      pendingCast.phase = 'cast';
      hero.dir = faceDir;
      hero.pose = 'cast';
      hero.t = 0;
    } else {
      startWalk(standIdx, function() {
        if (!pendingCast)
          return;
        pendingCast.phase = 'cast';
        hero.dir = faceDir;
        hero.pose = 'cast';
        hero.t = 0;
      });
    }
  }

  function updatePendingCast(dt) {
    if (!pendingCast || pendingCast.phase !== 'cast')
      return;
    pendingCast.timer += dt;
    hero.pose = 'cast';
    if (pendingCast.timer >= CAST_TIME) {
      const action = pendingCast.action;
      pendingCast = null;
      hero.pose = 'idle';
      doCast(action);
    }
  }

  function doCast(action) {
    const prev = puzzle;
    const next = SZ.PuzzleCore.applyAction(puzzle, action);
    if (!next)
      return;
    /* Focus: the first cast of each puzzle does not drink mana */
    const cost = casts === 0 && treeLevel('a_focus') > 0 ? 0 : 1;
    history.push(prev);
    historyCosts.push(cost);
    puzzle = next;
    invalidateCaches();
    mana -= cost;
    ++casts;
    ++save.stats.casts;
    /* the rules are applied at once; the visuals wait for the orb to land */
    let changed = 0;
    for (let i = 0; i < next.tiles.length; ++i)
      if (prev.tiles[i] !== next.tiles[i])
        ++changed;
    projectiles.push({
      x0: gemX(), y0: gemY(),
      x1: tileCenterX(action.index), y1: tileCenterY(action.index),
      t: 0, dur: PROJECTILE_TIME, color: ELEMENT_BY_ID[action.element].color,
      prev: prev, next: next, action: action, changed: changed
    });
    sfx('whoosh', { volume: 0.3 });
    updateStatusBar();
    if (SZ.PuzzleCore.isSolved(puzzle))
      startWin();
    else if (mana <= 0) {
      state = STATE_OUT_OF_MANA;
      sfx('lose');
    }
  }

  /* the staff gem in board space, where every spell orb starts */
  function gemX() { return hero.x + (hero.dir === 'left' ? -14 : 14); }
  function gemY() { return hero.y - 38; }

  function pushRing(x, y, r0, r1, color, lw, dur) {
    rings.push({ x: x, y: y, t: 0, dur: dur || RING_TIME, r0: r0, r1: r1, color: color, lw: lw || 3 });
    if (rings.length > MAX_RINGS)
      rings.shift();
  }

  function updateProjectiles(dt) {
    if (!projectiles.length)
      return;
    for (const pr of projectiles) {
      pr.t += dt;
      const k = Math.min(1, pr.t / pr.dur);
      const x = pr.x0 + (pr.x1 - pr.x0) * k, y = pr.y0 + (pr.y1 - pr.y0) * k;
      particles.trail(toViewX(x), toViewY(y), { color: pr.color, size: 2, life: 0.3, decay: 0.04 });
      if (pr.t >= pr.dur) {
        pushRing(pr.x1, pr.y1, 8, 46, pr.color, 3);
        screenShake.trigger(2 + Math.min(2, (pr.changed / 4) | 0), 140);
        particles.sparkle(toViewX(pr.x1), toViewY(pr.y1), 4, { color: pr.color, speed: 1.6 });
        spawnCastFx(pr.prev, pr.next, pr.action);
      }
    }
    projectiles = projectiles.filter(function(pr) { return pr.t < pr.dur; });
  }

  function updateRings(dt) {
    if (!rings.length)
      return;
    for (const r of rings)
      r.t += dt;
    rings = rings.filter(function(r) { return r.t < r.dur; });
  }

  /* ── visual reaction to a cast: the logical state is already applied, the
     changed tiles burn/slide into place behind it ── */

  function spawnCastFx(prev, next, action) {
    const changed = [];
    for (let i = 0; i < next.tiles.length; ++i)
      if (prev.tiles[i] !== next.tiles[i])
        changed.push(i);

    /* newly collected runes */
    for (const idx of next.runes)
      if (!prev.runes.has(idx)) {
        spells.push({ kind: 'runeCollect', x: tileCenterX(idx), y: tileCenterY(idx), t: 0, dur: SPELL_TIME });
        floatingText.add(toViewX(tileCenterX(idx)), toViewY(tileCenterY(idx)) - 14, '+Rune', { color: '#e0a8ff', font: 'bold 15px sans-serif' });
        particles.sparkle(toViewX(tileCenterX(idx)), toViewY(tileCenterY(idx)), 10, { color: '#e0a8ff', speed: 2 });
        sfx('pickup', { pitch: 1.3 });
      }

    const target = action.index;
    switch (action.element) {
      case 'fire':
        if (prev.tiles[target] === T.ICE)
          scheduleTiles(changed, prev, next, 'iceMelt', '#8ae0ff', '#e2f6ff');
        else {
          scheduleSpread(changed, prev, target, 'fireBurst', '#ff7a3a', '#ffe6b8');
          if (changed.length >= 3)
            floatingText.add(toViewX(tileCenterX(target)), toViewY(tileCenterY(target)) - 26, 'Chain x' + changed.length + '!', { color: '#ff7a3a', font: 'bold 16px sans-serif' });
        }
        break;
      case 'water':
        scheduleSpread(changed, prev, target, 'waterSplash', '#3ab4ff', '#e2f6ff');
        if (changed.length >= 3)
          floatingText.add(toViewX(tileCenterX(target)), toViewY(tileCenterY(target)) - 26, 'Chain x' + changed.length + '!', { color: '#3ab4ff', font: 'bold 16px sans-serif' });
        break;
      case 'earth': {
        const kind = prev.tiles[target] === T.CHASM ? 'chasmFill' : 'earthRise';
        scheduleTiles(changed, prev, next, kind, '#c9a36a', '#ffe0a8');
        sfx('thud', kind === 'chasmFill' ? { pitch: 0.7 } : undefined);
        break;
      }
      case 'air': {
        spells.push({ kind: 'windGust', x: tileCenterX(target), y: tileCenterY(target), t: 0, dur: SPELL_TIME });
        particles.sparkle(toViewX(tileCenterX(target)), toViewY(tileCenterY(target)), 6, { color: '#eaf8ff', speed: 1.5 });
        sfx('bounce', { pitch: 0.6 });
        /* where did the boulder end up? */
        let endIdx = -1;
        for (const idx of changed)
          if (next.tiles[idx] === T.BOULDER)
            endIdx = idx;
        const chasmIdx = changed.find(function(idx) { return prev.tiles[idx] === T.CHASM; });
        const swallowed = endIdx < 0;
        const to = swallowed ? chasmIdx : endIdx;
        const steps = Math.abs(rowOf(to) - rowOf(target)) + Math.abs(colOf(to) - colOf(target));
        slide = { fromIdx: target, toIdx: to, chasmIdx: chasmIdx === undefined ? -1 : chasmIdx, t: 0, dur: Math.max(1, steps) * SLIDE_STEP_TIME, swallowed: swallowed };
        break;
      }
    }
  }

  /* every changed tile carries its own spell so overlapping casts stay coherent */
  function scheduleTiles(changed, prev, next, kind, color, sparkle) {
    for (const idx of changed)
      tileFx.push({ index: idx, oldCode: prev.tiles[idx], newCode: next.tiles[idx], delay: 0, elapsed: 0, fired: false, dist: 0, kind: kind, color: color, sparkle: sparkle });
  }

  /* fire and water crawl over the changed cluster, one tile per BURN_STEP_DELAY */
  function scheduleSpread(changed, prev, target, kind, color, sparkle) {
    const changedSet = new Set(changed);
    const dist = new Map([[target, 0]]);
    const queue = [target];
    const nb = [];
    for (let head = 0; head < queue.length; ++head) {
      const idx = queue[head];
      neighbours4(idx, nb);
      for (const n of nb) {
        if (!changedSet.has(n) || dist.has(n))
          continue;
        dist.set(n, dist.get(idx) + 1);
        queue.push(n);
      }
    }
    for (const idx of changed) {
      const d = dist.has(idx) ? dist.get(idx) : 0;
      tileFx.push({ index: idx, oldCode: prev.tiles[idx], newCode: puzzle.tiles[idx], delay: d * BURN_STEP_DELAY, elapsed: 0, fired: false, dist: d, kind: kind, color: color, sparkle: sparkle });
    }
  }

  function updateTileFx(dt) {
    for (const fx of tileFx) {
      fx.elapsed += dt;
      if (!fx.fired && fx.elapsed >= fx.delay) {
        fx.fired = true;
        spells.push({ kind: fx.kind, x: tileCenterX(fx.index), y: tileCenterY(fx.index), t: 0, dur: SPELL_TIME });
        particles.burst(toViewX(tileCenterX(fx.index)), toViewY(tileCenterY(fx.index)), 8, { color: fx.color, speed: 2.5, life: 0.5 });
        particles.sparkle(toViewX(tileCenterX(fx.index)), toViewY(tileCenterY(fx.index)), 4, { color: fx.sparkle, speed: 1.2 });
        /* the sound rides the visual: one per tile the blaze/flood reaches,
           pitched up the further out it is; the throttle keeps bursts tame */
        if (fx.kind === 'fireBurst')
          sfx('smallExplode', { volume: 0.25, pitch: 1 + fx.dist * 0.15 });
        else if (fx.kind === 'waterSplash')
          sfx('drop', { pitch: 1 + fx.dist * 0.15 });
        else if (fx.kind === 'iceMelt')
          sfx('zap', { pitch: 1.4 });
      }
    }
    if (tileFx.length && tileFx.every(function(fx) { return fx.elapsed >= fx.delay + SPELL_TIME; }))
      tileFx = [];
  }

  function updateSlide(dt) {
    if (!slide)
      return;
    slide.t += dt;
    if (slide.t >= slide.dur) {
      if (slide.swallowed && slide.chasmIdx >= 0) {
        spells.push({ kind: 'chasmFill', x: tileCenterX(slide.chasmIdx), y: tileCenterY(slide.chasmIdx), t: 0, dur: SPELL_TIME });
        particles.burst(toViewX(tileCenterX(slide.chasmIdx)), toViewY(tileCenterY(slide.chasmIdx)), 10, { color: '#8a6a3a', speed: 2, life: 0.5 });
        sfx('thud', { pitch: 0.7 });
      } else {
        /* the boulder grinds to a halt */
        sfx('thud');
      }
      slide = null;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     WIN / LEVEL COMPLETE
     ══════════════════════════════════════════════════════════════════ */

  function startWin() {
    const goal = goalIndex();
    /* the puzzle is solved: the portal wakes and the goal turns reachable */
    sfx('powerup');
    winSeq = { phase: 'walk', t: 0, trail: [puzzle.hero] };
    startWalk(goal, function() {
      winSeq.phase = 'enter';
      winSeq.t = 0;
      spells.push({ kind: 'portalOpen', x: tileCenterX(goal), y: tileCenterY(goal), t: 0, dur: SPELL_TIME });
      pushRing(tileCenterX(goal), tileCenterY(goal), 10, 70, '#ffd75a', 4, 0.6);
      particles.sparkle(toViewX(tileCenterX(goal)), toViewY(tileCenterY(goal)), 16, { color: realmInfo().color, speed: 2.5 });
      /* Grand Entrance: fireworks at the portal */
      if (treeLevel('s_finale') > 0) {
        const gx = toViewX(tileCenterX(goal)), gy = toViewY(tileCenterY(goal));
        particles.confetti(gx, gy, 40, { speed: 6 });
        particles.burst(gx, gy, 14, { color: '#ffd75a', speed: 4, life: 0.8 });
        particles.burst(gx, gy, 14, { color: realmInfo().color, speed: 5, life: 0.9 });
        particles.sparkle(gx, gy, 20, { color: '#ffffff', speed: 3 });
      }
    });
  }

  function updateWin(dt) {
    if (!winSeq)
      return;
    if (winSeq.phase === 'enter') {
      winSeq.t += dt;
      const k = Math.min(1, winSeq.t / PORTAL_ENTER_TIME);
      const goal = goalIndex();
      hero.x = hero.x + (tileCenterX(goal) - hero.x) * Math.min(1, dt * 6);
      hero.y = hero.y + (tileCenterY(goal) - hero.y) * Math.min(1, dt * 6);
      hero.scale = 1 - k * 0.8;
      hero.alpha = 1 - k;
      hero.pose = 'idle';
      if (k >= 1)
        completeLevel();
    }
  }

  function completeLevel() {
    state = STATE_LEVEL_COMPLETE;
    const stars = 1
      + (casts <= level.par ? 1 : 0)
      + (SZ.PuzzleCore.isPerfect(puzzle) ? 1 : 0);
    /* every star above the best before pays arcane shards, trials double */
    const oldStars = save.stars[level.id] | 0;
    let gained = 0;
    if (stars > oldStars) {
      gained = (stars - oldStars) * (levelKind === 'bonus' ? 2 : 1);
      save.stars[level.id] = stars;
    }
    if (sessionMode === 'daily') {
      const today = localDateString();
      if (save.daily.date !== today)
        save.daily = { date: today, solved: false, stars: 0 };
      if (!save.daily.solved) {
        save.daily.solved = true;
        gained += DAILY_SHARDS;
      }
      if (stars > save.daily.stars)
        save.daily.stars = stars;
    }
    save.shards += gained;
    ++save.stats.levels;
    lastShardGain = gained;
    writeSave();
    addHighScore(level.name, stars);
    panelAnim = { at: time, starPlayed: [false, false, false] };
    screenShake.trigger(5, 250);
    particles.sparkle(VIEW_W / 2, VIEW_H / 2, 20, { color: '#ffd75a', speed: 3 });
    if (gained > 0)
      floatingText.add(VIEW_W / 2, VIEW_H / 2 - 110, `+${gained} shards`, { color: '#8fd0ff', font: 'bold 20px sans-serif' });
    /* the first full clear of a realm: the whole realm is restored */
    if (levelKind === 'campaign' && (levelIndex % 8) === 7) {
      const realm = level.realm;
      let cleared = true, wasCleared = true;
      for (let k = 0; k < 8; ++k) {
        const id = SZ.PuzzleLevels.CAMPAIGN[realm * 8 + k].id;
        if ((save.stars[id] | 0) < 1)
          cleared = false;
        if ((id === level.id ? oldStars : save.stars[id] | 0) < 1)
          wasCleared = false;
      }
      if (cleared && !wasCleared) {
        realmBanner = { realm: realm, t: 0 };
        particles.confetti(320, 240, 30, { speed: 6 });
        particles.confetti(960, 240, 30, { speed: 6 });
        particles.sparkle(VIEW_W / 2, 300, 24, { color: SZ.PuzzleLevels.REALMS[realm].color, speed: 3 });
        sfx('levelup');
      }
    }
    sfx('win');
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateGame(dt) {
    time += dt;
    hero.t += dt;
    updateWalk(dt);
    updatePendingCast(dt);
    updateProjectiles(dt);
    updateWin(dt);
    updateTileFx(dt);
    updateSlide(dt);
    updateRings(dt);
    updateMotes(dt);
    updateHeroLife(dt);
    updateHoverInvalid(dt);
    if (realmBanner) {
      realmBanner.t += dt;
      if (realmBanner.t >= REALM_BANNER_TIME)
        realmBanner = null;
    }
    for (const s of spells)
      s.t += dt;
    spells = spells.filter(function(s) { return s.t < s.dur; });
    if (tileShake) {
      tileShake.t += dt;
      if (tileShake.t >= 0.3)
        tileShake = null;
    }
    if (hintFx) {
      hintFx.t -= dt;
      if (hintFx.t <= 0)
        hintFx = null;
    }
    if (hintBanner.t > 0)
      hintBanner.t = Math.max(0, hintBanner.t - dt);
  }

  /* the mage at rest: he breathes, blinks, watches the pointer and his gem glimmers */
  function updateHeroLife(dt) {
    if (winSeq || pendingCast || walk.path.length || hero.alpha <= 0) {
      blinkSquash = 0;
      return;
    }
    if (hero.pose !== 'idle')
      return;
    if (hoverPoint) {
      const dx = hoverPoint.x - toViewX(hero.x), dy = hoverPoint.y - toViewY(hero.y);
      if (Math.abs(dx) >= Math.abs(dy))
        hero.dir = dx >= 0 ? 'right' : 'left';
      else
        hero.dir = dy >= 0 ? 'down' : 'up';
    }
    /* the art has no blink frame, so a short 3% squash stands in for one */
    blinkT += dt;
    if (blinkT >= blinkNext) {
      blinkT = 0;
      blinkNext = 3 + Math.random() * 2;
      blinkSquash = 0.12;
    }
    if (blinkSquash > 0)
      blinkSquash = Math.max(0, blinkSquash - dt);
    gemT += dt;
    if (gemT >= 0.6) {
      gemT = 0;
      particles.sparkle(toViewX(gemX()), toViewY(gemY()), 1, { color: ELEMENT_BY_ID[selectedElement].color, speed: 0.6 });
    }
  }

  function updateMotes(dt) {
    if (!motes.length)
      return;
    const w = puzzle.cols * 64, h = puzzle.rows * 64;
    for (const m of motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < 0) m.x += w; else if (m.x > w) m.x -= w;
      if (m.y < 0) m.y += h; else if (m.y > h) m.y -= h;
    }
  }

  /* the pointer resting on a tile that can neither be walked to nor cast on */
  function updateHoverInvalid(dt) {
    if (state !== STATE_PLAYING || pendingCast || winSeq || projectiles.length || hoverIdx < 0 || !hoverPoint) {
      hoverInvalidT = 0;
      return;
    }
    const code = puzzle.tiles[hoverIdx];
    if ((isWalkable(code) && reach().has(hoverIdx)) || actionsForTile(hoverIdx, selectedElement, hoverPoint).length) {
      hoverInvalidT = 0;
      return;
    }
    hoverInvalidT = Math.min(1, hoverInvalidT + dt * 3);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING — everything in the 1280 x 720 view, the board scaled from 64 px art
     ══════════════════════════════════════════════════════════════════ */

  let hoverPoint = null;
  let elementButtons = [];

  function drawTiles() {
    const fxMap = new Map();
    for (const fx of tileFx)
      fxMap.set(fx.index, fx);
    const waterFrame = Math.floor(time * 4);
    for (let r = 0; r < puzzle.rows; ++r) {
      for (let c = 0; c < puzzle.cols; ++c) {
        const idx = r * puzzle.cols + c;
        const code = puzzle.tiles[idx];
        const v = tileVariant(idx);
        let ox = 0;
        if (tileShake && tileShake.index === idx)
          ox = Math.sin(tileShake.t * 42) * 3 * (1 - tileShake.t / 0.3);
        const x = c * 64 + ox, y = r * 64;
        if (code === T.WALL) {
          SZ.PuzzleArt.drawTile(ctx, theme, T.WALL, x, y, v, 0);
          continue;
        }
        /* floor under every non-wall tile, then the tile itself */
        SZ.PuzzleArt.drawTile(ctx, theme, T.FLOOR, x, y, v, 0);
        const fx = fxMap.get(idx);
        let top = fx && fx.elapsed < fx.delay ? fx.oldCode : code;
        if (slide && !slide.swallowed && idx === slide.toIdx)
          top = T.FLOOR; // the boulder is in flight, not landed
        if (top !== T.FLOOR)
          SZ.PuzzleArt.drawTile(ctx, theme, top, x, y, v, waterFrame);
      }
    }
  }

  function drawSlideBoulder() {
    if (!slide)
      return;
    const k = Math.min(1, slide.t / slide.dur);
    const x = tileCenterX(slide.fromIdx) + (tileCenterX(slide.toIdx) - tileCenterX(slide.fromIdx)) * k;
    const y = tileCenterY(slide.fromIdx) + (tileCenterY(slide.toIdx) - tileCenterY(slide.fromIdx)) * k;
    SZ.PuzzleArt.drawTile(ctx, theme, T.BOULDER, x - 32, y - 32, tileVariant(slide.toIdx), 0);
  }

  function drawRunes() {
    const tiles = puzzle.tiles;
    const sight = treeLevel('i_runes') > 0;
    const reachable = reach();
    for (let i = 0; i < tiles.length; ++i) {
      if (tiles[i] !== T.RUNE)
        continue;
      const collected = puzzle.runes.has(i);
      SZ.PuzzleArt.drawRuneGlow(ctx, theme, tileCenterX(i), tileCenterY(i), time, collected);
      /* Rune Sight: runes outside reach shimmer visibly through the walls,
         without it they only glow faintly */
      if (sight && !collected && !reachable.has(i)) {
        const cx = tileCenterX(i), cy = tileCenterY(i);
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(time * 4 + i);
        ctx.strokeStyle = '#e0a8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 15 + 3 * Math.sin(time * 3 + i), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx + 7, cy);
        ctx.lineTo(cx, cy + 10);
        ctx.lineTo(cx - 7, cy);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawPortalTile() {
    const goal = goalIndex();
    if (goal >= 0)
      SZ.PuzzleArt.drawPortal(ctx, theme, tileCenterX(goal), tileCenterY(goal), time, reach().has(goal));
  }

  function drawPushArrow(idx, dir) {
    const d = DIRS[dir];
    if (!d)
      return;
    const cx = tileCenterX(idx), cy = tileCenterY(idx);
    const hx = cx + d[1] * 26, hy = cy + d[0] * 26;
    ctx.save();
    ctx.strokeStyle = '#eaf8ff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 6);
    ctx.beginPath();
    ctx.moveTo(cx + d[1] * 6, cy + d[0] * 6);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - d[1] * 9 - d[0] * 5, hy - d[0] * 9 + d[1] * 5);
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - d[1] * 9 + d[0] * 5, hy - d[0] * 9 - d[1] * 5);
    ctx.stroke();
    ctx.restore();
  }

  function drawHighlights() {
    if (state !== STATE_PLAYING || pendingCast || winSeq)
      return;
    if (hoverIdx >= 0 && hoverPoint) {
      /* a walkable tile in reach is walked to, never cast on — no hint there */
      const wouldWalk = isWalkable(puzzle.tiles[hoverIdx]) && reach().has(hoverIdx);
      const acts = wouldWalk ? [] : actionsForTile(hoverIdx, selectedElement, hoverPoint);
      if (acts.length) {
        const el = ELEMENT_BY_ID[selectedElement];
        const pulse = 0.45 + 0.3 * Math.sin(time * 5);
        ctx.save();
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = pulse;
        ctx.strokeRect(colOf(hoverIdx) * 64 + 4, rowOf(hoverIdx) * 64 + 4, 56, 56);
        ctx.restore();
        /* the element floats above the tile it would be cast on */
        ctx.save();
        ctx.globalAlpha = 0.6;
        SZ.PuzzleScene.drawElementIcon(ctx, selectedElement, colOf(hoverIdx) * 64 + 32, rowOf(hoverIdx) * 64 - 2, 22, true);
        ctx.restore();
        if (selectedElement === 'air')
          drawPushArrow(hoverIdx, acts[0].dir);
      } else if (isWalkable(puzzle.tiles[hoverIdx]) && reach().has(hoverIdx)) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        ctx.strokeRect(colOf(hoverIdx) * 64 + 4, rowOf(hoverIdx) * 64 + 4, 56, 56);
        /* faint footprints mark the tile the mage would walk to */
        const fcx = colOf(hoverIdx) * 64 + 32, fcy = rowOf(hoverIdx) * 64 + 32;
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(fcx - 7, fcy + 12, 4, 6, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(fcx + 7, fcy + 14, 4, 6, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (hoverInvalidT > 0 && hoverIdx >= 0) {
      const xc = colOf(hoverIdx) * 64 + 32, yc = rowOf(hoverIdx) * 64 + 32;
      ctx.save();
      ctx.globalAlpha = 0.55 * hoverInvalidT;
      ctx.strokeStyle = ui.UI.bad;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xc - 12, yc - 12);
      ctx.lineTo(xc + 12, yc + 12);
      ctx.moveTo(xc + 12, yc - 12);
      ctx.lineTo(xc - 12, yc + 12);
      ctx.stroke();
      ctx.restore();
    }
    if (hintFx) {
      const a = hintFx.action;
      const el = ELEMENT_BY_ID[a.element];
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.globalAlpha = 0.5 + 0.35 * Math.sin(time * 6);
      ctx.lineWidth = 3;
      ctx.strokeRect(colOf(a.index) * 64 + 3, rowOf(a.index) * 64 + 3, 58, 58);
      ctx.globalAlpha = 1;
      SZ.PuzzleScene.drawElementIcon(ctx, a.element, colOf(a.index) * 64 + 50, rowOf(a.index) * 64 + 14, 24, true);
      if (a.element === 'air' && a.dir)
        drawPushArrow(a.index, a.dir);
      ctx.restore();
    }
  }

  function drawHeroSprite() {
    if (hero.alpha <= 0)
      return;
    ctx.save();
    ctx.globalAlpha = hero.alpha;
    if (hero.scale !== 1) {
      ctx.translate(hero.x, hero.y);
      ctx.scale(hero.scale, hero.scale);
      ctx.translate(-hero.x, -hero.y);
    }
    /* the last spin before he vanishes into the portal */
    if (winSeq && winSeq.phase === 'enter') {
      const k = Math.min(1, winSeq.t / PORTAL_ENTER_TIME);
      ctx.translate(hero.x, hero.y);
      ctx.rotate(k * Math.PI * 3);
      ctx.translate(-hero.x, -hero.y);
    }
    if (blinkSquash > 0) {
      const s = 1 - 0.03 * (blinkSquash / 0.12);
      ctx.translate(hero.x, hero.y + 16);
      ctx.scale(1, s);
      ctx.translate(-hero.x, -(hero.y + 16));
    }
    const bob = hero.pose === 'idle' && !winSeq ? Math.sin(time * 2.2) * 1.5 : 0;
    SZ.PuzzleArt.drawHero(ctx, hero.x, hero.y + bob, hero.dir, hero.pose, hero.t, ROBES[save.robe] || ROBES.violet);
    ctx.restore();
  }

  /* soft ring of the selected element's light under the mage, pulsing */
  function drawElementAura() {
    if (hero.alpha <= 0)
      return;
    const el = ELEMENT_BY_ID[selectedElement];
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
    ctx.save();
    ctx.fillStyle = ui.hexToRgba(el.color, 0.10 + 0.05 * pulse);
    ctx.beginPath();
    ctx.ellipse(hero.x, hero.y + 14, 26 + 3 * pulse, 10 + 1.5 * pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ui.hexToRgba(el.color, 0.16 + 0.08 * pulse);
    ctx.beginPath();
    ctx.ellipse(hero.x, hero.y + 14, 16 + 2 * pulse, 6 + pulse, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* slow motes of the realm's glow drifting over the board */
  function drawMotes() {
    if (!motes.length)
      return;
    const glow = scene && scene.scene ? scene.scene.glow : '#ffffff';
    ctx.save();
    ctx.fillStyle = glow;
    for (const m of motes) {
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(time * 1.5 + m.phase);
      ctx.fillRect(m.x, m.y, m.size, m.size);
    }
    ctx.restore();
  }

  /* the golden trail of tiles the mage has walked on his way into the portal */
  function drawWinTrail() {
    if (!winSeq || !winSeq.trail || winSeq.trail.length < 2)
      return;
    ctx.save();
    ctx.fillStyle = '#ffd75a';
    for (let i = 0; i < winSeq.trail.length - 1; ++i) {
      const idx = winSeq.trail[i];
      ctx.globalAlpha = Math.max(0.12, 0.3 - (winSeq.trail.length - 1 - i) * 0.02);
      ctx.fillRect(colOf(idx) * 64 + 6, rowOf(idx) * 64 + 6, 52, 52);
    }
    ctx.restore();
  }

  function drawProjectiles() {
    for (const pr of projectiles) {
      const k = Math.min(1, pr.t / pr.dur);
      const x = pr.x0 + (pr.x1 - pr.x0) * k, y = pr.y0 + (pr.y1 - pr.y0) * k;
      ctx.save();
      ctx.fillStyle = pr.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRings() {
    for (const r of rings) {
      const k = r.t / r.dur;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lw * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSpells() {
    for (const s of spells)
      SZ.PuzzleScene.drawSpell(ctx, s.kind, s.x, s.y, s.t / s.dur, 64);
  }

  function drawGame() {
    scene.draw(ctx, time, visibleRect());

    /* soft shadow panel under the board */
    ctx.save();
    ui.roundRectPath(boardX - 10, boardY - 10, puzzle.cols * TS + 20, puzzle.rows * TS + 20, 12);
    ctx.fillStyle = 'rgba(4,6,14,0.5)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(boardX, boardY);
    ctx.scale(TS / 64, TS / 64);
    drawTiles();
    drawWinTrail();
    drawSlideBoulder();
    drawRunes();
    drawPortalTile();
    drawHighlights();
    drawMotes();
    drawElementAura();
    drawHeroSprite();
    drawSpells();
    drawProjectiles();
    drawRings();
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     HUD
     ══════════════════════════════════════════════════════════════════ */

  const BAR_Y = 646, BAR_BTN = 64, BAR_GAP = 12;
  const HUD_CHIP_Y = 16, HUD_CHIP_H = 28, HUD_CHIP_GAP = 12, HUD_RIGHT = 1240;

  // the width drawChip gives this text, so chips can be placed side by side
  function chipWidth(text, h, px) {
    ctx.font = ui.uiFont(px || Math.round(h * 0.62), 'bold');
    return Math.ceil(ctx.measureText(text).width) + h * 0.8;
  }

  function drawManaCrystals(cx, cy, total, left) {
    const s = 5, gap = 11;
    const x0 = cx - (total - 1) * gap / 2;
    for (let i = 0; i < total; ++i) {
      const x = x0 + i * gap;
      ctx.beginPath();
      ctx.moveTo(x, cy - s);
      ctx.lineTo(x + s * 0.7, cy);
      ctx.lineTo(x, cy + s);
      ctx.lineTo(x - s * 0.7, cy);
      ctx.closePath();
      if (i < left) {
        ctx.fillStyle = '#5ab8ff';
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
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

  function drawHUD() {
    const realm = realmInfo();
    const list = levelList(levelKind);

    /* top-left: realm and level */
    ui.drawPanel(32, 14, 330, 62, {
      title: realm.name,
      titlePx: 15,
      titleRight: `${levelIndex + 1} / ${list.length}`,
      accent: realm.color
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(level.name, 44, 58, 306, 17, { weight: 'bold', color: ui.UI.text });
    if (sessionMode === 'daily')
      ui.drawChip('Daily', 374, 20, 26, { align: 'left', px: 13, color: ui.UI.gold, bg: 'rgba(255,215,90,0.12)', border: ui.hexToRgba(ui.UI.gold, 0.5) });

    /* top-centre: mana and casts; the Oracle reveals the par */
    const oracle = treeLevel('i_oracle') > 0;
    ctx.textBaseline = 'middle';
    ui.drawChip(`${mana} / ${manaTotal}`, 560, 16, 28, { align: 'center', color: mana > 0 ? '#8fd0ff' : ui.UI.bad, border: 'rgba(90,184,255,0.35)' });
    drawManaCrystals(560, 56, manaTotal, mana);
    ui.drawChip(`Casts ${casts} / ${oracle ? level.par : '?'}`, 730, 16, 28, { align: 'center', color: casts <= level.par ? ui.UI.text : ui.UI.warn });
    if (oracle && hintFx) {
      /* the Oracle names the next optimal element while a hint glows */
      ctx.textAlign = 'right';
      ui.fitText('Next', 850, 56, 60, 12, { color: ui.UI.textMute });
      SZ.PuzzleScene.drawElementIcon(ctx, hintFx.action.element, 880, 56, 26, true);
    }

    /* top-right: three separate chips, each measured to its own text and laid
       out right to left with a fixed gap, the row ending at x 1240 */
    const chips = [
      { text: `Hints ${hintsLeft}`, color: hintsLeft > 0 ? '#e0c88f' : ui.UI.warn },
      { text: `Undos ${undosLeft === Infinity ? '∞' : undosLeft}`, color: '#6fe08a' },
      { text: `Runes ${puzzle.runes.size} / ${SZ.PuzzleCore.totalRunes(puzzle)}`, color: '#e0a8ff' }
    ];
    let chipRight = HUD_RIGHT;
    for (let i = chips.length - 1; i >= 0; --i) {
      const w = chipWidth(chips[i].text, HUD_CHIP_H);
      ui.drawChip(chips[i].text, chipRight - w, HUD_CHIP_Y, HUD_CHIP_H, { color: chips[i].color });
      chipRight -= w + HUD_CHIP_GAP;
    }

    /* bottom: element bar */
    elementButtons = [];
    const total = ELEMENTS.length * BAR_BTN + (ELEMENTS.length - 1) * BAR_GAP;
    const x0 = (VIEW_W - total) / 2;
    for (let i = 0; i < ELEMENTS.length; ++i) {
      const el = ELEMENTS[i];
      const bx = x0 + i * (BAR_BTN + BAR_GAP);
      const enabled = realmElements().indexOf(el.id) >= 0;
      const selected = el.id === selectedElement;
      ctx.save();
      if (!enabled)
        ctx.globalAlpha = 0.35;
      ui.roundRectPath(bx, BAR_Y, BAR_BTN, BAR_BTN, 8);
      ctx.fillStyle = selected ? 'rgba(44,56,88,0.95)' : 'rgba(14,18,32,0.9)';
      ctx.fill();
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeStyle = selected ? el.color : ui.UI.rim;
      ctx.stroke();
      /* a freshly selected element's icon bounces from 1.25 down to 1 */
      let iconScale = 1;
      if (elementBounce && elementBounce.id === el.id) {
        const bk = (time - elementBounce.at) / 0.2;
        if (bk >= 0 && bk < 1)
          iconScale = 1.25 - 0.25 * bk;
      }
      SZ.PuzzleScene.drawElementIcon(ctx, el.id, bx + BAR_BTN / 2, BAR_Y + 26, 40 * iconScale, selected);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(el.name, bx + BAR_BTN / 2, BAR_Y + 54, BAR_BTN - 8, 10, { color: selected ? el.color : ui.UI.textDim });
      ui.drawKeycap(el.key, bx + 4, BAR_Y + 4, 9);
      if (!enabled)
        drawLock(bx + BAR_BTN / 2, BAR_Y + BAR_BTN / 2, 16);
      ctx.restore();
      elementButtons.push({ x: bx, y: BAR_Y, w: BAR_BTN, h: BAR_BTN, id: el.id });
    }

    /* bottom: key hints */
    ui.drawKeyHints([
      { key: '1-4', label: 'element' },
      { key: 'Click', label: 'walk / cast' },
      { key: 'Z', label: 'undo' },
      { key: 'R', label: 'restart' },
      { key: 'H', label: 'hint' }
    ], 250, 678, 420, 1);

    /* level hint banner: a slim strip above the board that fades out */
    if (hintBanner.t > 0 && hintBanner.text) {
      const alpha = Math.min(1, hintBanner.t / 0.8);
      const text = 'Hint: ' + hintBanner.text;
      const bw = ui.layoutLine(text, 520, 14, 11).width + 34;
      const bx = boardX + puzzle.cols * TS / 2;
      const by = HINT_BANNER_Y - HINT_BANNER_H / 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ui.drawPanel(bx - bw / 2, by, bw, HINT_BANNER_H, { accent: ui.UI.accent, noStuds: true, radius: 8 });
      ui.drawTextBlock(text, bx - bw / 2 + 14, by + 4, bw - 28, HINT_BANNER_H - 8, 14, { color: ui.UI.text, align: 'center', valign: 'middle' });
      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     OVERLAYS AND PANELS
     ══════════════════════════════════════════════════════════════════ */

  /* ── shared menu widgets ── */

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

  function moveMenuCursor(d) {
    const n = hitAreas.length;
    if (!n)
      return;
    menuCursor = (menuCursor + d + n) % n;
    sfx('click', { volume: 0.4 });
  }

  function activateMenuItem(item) {
    if (!item || item.disabled || !item.action) {
      sfx('error', { volume: 0.4 });
      return;
    }
    sfx('select');
    item.action();
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
      top: hot ? 'rgba(36,46,76,0.96)' : undefined,
      bottom: hot ? 'rgba(15,19,36,0.96)' : undefined
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(label, x + w / 2, opts.sub ? y + h / 2 - 8 : y + h / 2 + 1, w - 48, opts.px || 17, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
    if (opts.sub)
      ui.fitText(opts.sub, x + w / 2, y + h - 12, w - 24, 11, { color: ui.UI.textDim });
    if (opts.key)
      ui.drawKeycap(opts.key, x + w - 44, y + 6, 10);
    ctx.restore();
  }

  function starPath(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; ++i) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      if (i === 0)
        ctx.moveTo(x, y);
      else
        ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function fillVeil(alpha) {
    const v = visibleRect();
    ctx.fillStyle = alpha;
    ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
  }

  function drawPauseOverlay() {
    fillVeil('rgba(4,6,14,0.6)');
    const pw = 420, ph = 330;
    const px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2 - 10;
    ui.drawPanel(px, py, pw, ph, { title: 'PAUSED', accent: ui.UI.gold, glow: true });
    drawButton('p-resume', 'Resume', px + 40, py + 62, pw - 80, 48, { key: 'Esc', action: function() { state = STATE_PLAYING; } });
    drawButton('p-restart', 'Restart', px + 40, py + 118, pw - 80, 48, { key: 'R', action: restartLevel });
    drawButton('p-levels', 'Levels', px + 40, py + 174, pw - 80, 48, { key: 'L', action: goLevels });
    drawButton('p-title', 'Title', px + 40, py + 230, pw - 80, 48, { key: 'T', action: function() { setScreen('title'); } });
  }

  function drawLevelCompletePanel() {
    fillVeil('rgba(4,6,14,0.55)');
    const pw = 560, ph = 330;
    const px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2 - 12;
    ui.drawPanel(px, py, pw, ph, { title: 'LEVEL COMPLETE', accent: ui.UI.gold, glow: true });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(level.name, VIEW_W / 2, py + 66, pw - 60, 22, { weight: 'bold', color: ui.UI.text });

    const stars = 1
      + (casts <= level.par ? 1 : 0)
      + (SZ.PuzzleCore.isPerfect(puzzle) ? 1 : 0);
    const reasons = ['Solved', 'Casts ≤ par', 'All runes'];
    const elapsed = panelAnim ? time - panelAnim.at : 99;
    for (let i = 0; i < 3; ++i) {
      const cx = VIEW_W / 2 + (i - 1) * 130;
      const earned = i < stars;
      /* the earned stars pop in one after another, each with a rising coin */
      const appearAt = 0.25 + i * 0.35;
      const popped = !earned || !panelAnim || elapsed >= appearAt;
      if (popped && earned && panelAnim && !panelAnim.starPlayed[i]) {
        panelAnim.starPlayed[i] = true;
        sfx('coin', { pitch: 1 + i * 0.2 });
      }
      let s = 1;
      if (popped && earned && panelAnim) {
        const k = Math.min(1, (elapsed - appearAt) / 0.25);
        s = 1.6 - 0.6 * k;
      }
      ctx.save();
      if (s !== 1) {
        ctx.translate(cx, py + 122);
        ctx.scale(s, s);
        ctx.translate(-cx, -(py + 122));
      }
      starPath(cx, py + 122, 26);
      ctx.fillStyle = earned && popped ? ui.UI.gold : 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = earned && popped ? ui.UI.goldDeep : 'rgba(255,255,255,0.15)';
      ctx.stroke();
      ctx.restore();
      ui.fitText(reasons[i], cx, py + 162, 120, 11, { color: earned && popped ? ui.UI.gold : ui.UI.textMute });
    }

    ui.drawTextBlock(`Casts: ${casts} / par ${level.par}     Runes: ${puzzle.runes.size} / ${SZ.PuzzleCore.totalRunes(puzzle)}`,
      px + 30, py + 196, pw - 60, 30, 16, { color: ui.UI.textDim, align: 'center', valign: 'middle' });
    if (lastShardGain > 0) {
      /* the shards count up once the stars have landed */
      const shown = panelAnim
        ? Math.max(0, Math.min(lastShardGain, Math.round(lastShardGain * (elapsed - 1.1) / 0.6)))
        : lastShardGain;
      ui.drawTextBlock(`+${shown} arcane shards`, px + 30, py + 228, pw - 60, 24, 15, { color: '#8fd0ff', align: 'center', valign: 'middle' });
    }

    const by = py + ph - 62;
    drawButton('c-next', 'Next', px + 40, by, 140, 42, { key: 'Enter', action: nextLevel });
    drawButton('c-replay', 'Replay', px + pw / 2 - 70, by, 140, 42, { key: 'R', action: restartLevel });
    drawButton('c-levels', 'Levels', px + pw - 180, by, 140, 42, { key: 'Esc', action: goLevels });
  }

  function drawOutOfManaPanel() {
    fillVeil('rgba(4,6,14,0.55)');
    const pw = 520, ph = 210;
    const px = (VIEW_W - pw) / 2, py = (VIEW_H - ph) / 2 - 12;
    ui.drawPanel(px, py, pw, ph, { title: 'OUT OF MANA', accent: ui.UI.bad });
    ui.drawTextBlock('The well is dry. Undo a cast to win some mana back, or start the puzzle over.',
      px + 26, py + 48, pw - 52, 70, 15, { color: ui.UI.textDim, align: 'center', valign: 'middle' });
    const by = py + ph - 62;
    drawButton('m-undo', 'Undo', px + 26, by, 140, 42, { key: 'Z', action: undoCast });
    drawButton('m-replay', 'Restart', px + pw / 2 - 70, by, 140, 42, { key: 'R', action: restartLevel });
    drawButton('m-levels', 'Levels', px + pw - 166, by, 140, 42, { key: 'Esc', action: goLevels });
  }

  function drawOverlays() {
    hitAreas.length = 0;
    drawHUD();
    if (state === STATE_PAUSED)
      drawPauseOverlay();
    else if (state === STATE_LEVEL_COMPLETE)
      drawLevelCompletePanel();
    else if (state === STATE_OUT_OF_MANA)
      drawOutOfManaPanel();
    if (realmBanner) {
      const b = realmBanner;
      const alpha = Math.max(0, Math.min(1, b.t * 4, (REALM_BANNER_TIME - b.t) / 0.5));
      const realm = SZ.PuzzleLevels.REALMS[b.realm];
      fillVeil(ui.hexToRgba(realm.color, 0.16 * alpha));
      ctx.save();
      ctx.globalAlpha = alpha;
      ui.drawHeadline(realm.name + ' Restored!', 640, 296, 1000, 64, realm.color, ui.UI.gold);
      ctx.restore();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU SCREENS
     ══════════════════════════════════════════════════════════════════ */

  function drawCrystal(cx, cy, s, color) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.7, cy);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s * 0.7, cy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
  }

  /* the shards counter with its crystal, right-aligned at x */
  function drawShardsChip(x, y) {
    const w = ui.drawChip(save.shards + ' shards', x, y, 30, { align: 'right', color: '#8fd0ff', border: 'rgba(90,184,255,0.35)' });
    drawCrystal(x - w - 14, y + 15, 8, '#8fd0ff');
  }

  function drawTitleScreen() {
    const realm = Math.floor(time / 12) % SZ.PuzzleLevels.REALMS.length;
    drawMenuBackdrop(realm, 'rgba(4,6,14,0.55)');

    ui.drawHeadline('FANTASY PUZZLE', 640, 120, 1100, 88, '#ffd23f', '#c04cff');
    ctx.fillStyle = ui.UI.textDim;
    ctx.font = ui.uiFont(22);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Bend the elements. Open the way.', 640, 182);

    drawShardsChip(1256, 20);

    /* the mage on a floating tile island, the four elements orbiting him */
    ctx.save();
    ctx.translate(300, 470);
    ctx.scale(1.5, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(96, 152, 112, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.translate(0, Math.sin(time * 1.4) * 4);
    const island = [
      [0, 0, T.FLOOR], [64, 0, T.FLOOR], [128, 0, T.FLOOR],
      [0, 64, T.FLOOR], [64, 64, T.FLOOR], [128, 64, T.FLOOR],
      [0, -64, T.WOOD], [64, -64, T.BOULDER], [128, -64, T.ICE]
    ];
    for (const tile of island)
      SZ.PuzzleArt.drawTile(ctx, realm, tile[2], tile[0], tile[1], 1, Math.floor(time * 4));
    SZ.PuzzleArt.drawHero(ctx, 96, 32, 'down', 'idle', time, ROBES[save.robe] || ROBES.violet);
    for (let i = 0; i < ELEMENTS.length; ++i) {
      const a = time * 0.7 + i * Math.PI / 2;
      SZ.PuzzleScene.drawElementIcon(ctx, ELEMENTS[i].id, 96 + Math.cos(a) * 96, -8 + Math.sin(a) * 48, 26, true);
    }
    ctx.restore();

    const items = [
      { id: 't-campaign', label: 'Campaign', sub: campaignStarCount() + ' / 120 stars', action: function() { setScreen('realms'); } },
      { id: 't-daily', label: 'Daily Puzzle', sub: dailySub(), action: loadDailyPuzzle },
      { id: 't-trials', label: 'Trials', sub: solvedTrialCount() + ' / 60', action: function() { setScreen('trials'); } },
      { id: 't-grimoire', label: 'Grimoire', sub: save.shards + ' shards', action: function() { prevScreen = 'title'; treeLayout = buildTreeLayout(); selectFirstInBranch(); setScreen('grimoire'); } },
      { id: 't-wardrobe', label: 'Wardrobe', action: function() { prevScreen = 'title'; wardrobeCursor = Math.max(0, Object.keys(ROBES).indexOf(save.robe)); setScreen('wardrobe'); } },
      { id: 't-help', label: 'Help', action: openHelp }
    ];
    for (let i = 0; i < items.length; ++i)
      drawButton(items[i].id, items[i].label, 700, 268 + i * 58, 340, 52, { sub: items[i].sub, action: items[i].action });

    ui.drawKeyHints([
      { key: '↑↓', label: 'Select' },
      { key: 'Enter', label: 'Start' },
      { key: 'H', label: 'Help' }
    ], 640, 694, 900, 1);
  }

  function drawRealmsScreen() {
    drawMenuBackdrop(0, 'rgba(4,6,14,0.62)');
    ui.drawHeadline('Campaign', 640, 46, 600, 40, '#ffd23f', ui.UI.goldDeep);
    ui.drawChip(campaignStarCount() + ' / 120 stars', 1256, 20, 28, { align: 'right', color: ui.UI.gold });

    const REALMS = SZ.PuzzleLevels.REALMS;
    for (let r = 0; r < REALMS.length; ++r) {
      const cx = 24 + r * 247, cy = 96, cw = 230, ch = 420;
      const realm = REALMS[r];
      const unlocked = realmUnlocked(r);

      /* the first time a realm shows unlocked, its lock shatters */
      if (unlocked && !save.seenUnlocks[r]) {
        save.seenUnlocks[r] = true;
        writeSave();
        unlockFx = { realm: r, at: time };
        particles.burst(cx + cw / 2, cy + 250, 16, { color: '#c8d0e0', speed: 3.5, life: 0.8, gravity: 0.12, shape: 'square', size: 3 });
        particles.sparkle(cx + cw / 2, cy + 250, 10, { color: ui.UI.gold, speed: 2.5 });
        sfx('powerup');
      }

      /* miniature of the realm scene, clipped into the card */
      ctx.save();
      ui.roundRectPath(cx, cy, cw, ch, 9);
      ctx.clip();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(cw / 1280, cw / 1280);
      getScene(r).draw(ctx, time, null);
      ctx.restore();
      ctx.fillStyle = unlocked ? 'rgba(6,9,18,0.55)' : 'rgba(4,6,12,0.8)';
      ctx.fillRect(cx, cy, cw, ch);
      ctx.restore();
      ui.drawPanel(cx, cy, cw, ch, {
        flat: true, noStuds: true,
        accent: unlocked ? realm.color : ui.UI.textMute,
        top: 'rgba(10,14,26,0.25)', bottom: 'rgba(6,8,16,0.35)'
      });
      if (unlockFx && unlockFx.realm === r) {
        const f = 1 - (time - unlockFx.at) / 0.8;
        if (f > 0) {
          ctx.save();
          ctx.globalAlpha = f;
          ui.roundRectPath(cx, cy, cw, ch, 9);
          ctx.lineWidth = 3;
          ctx.strokeStyle = realm.color;
          ctx.stroke();
          ctx.restore();
        } else {
          unlockFx = null;
        }
      }

      let stars = 0;
      for (let k = 0; k < 8; ++k)
        stars += save.stars[SZ.PuzzleLevels.CAMPAIGN[r * 8 + k].id] || 0;

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(realm.name, cx + 14, cy + 152, 148, 17, { weight: 'bold', color: unlocked ? ui.UI.text : ui.UI.textMute });
      ui.drawChip(stars + ' / 24', cx + cw - 12, cy + 140, 22, { align: 'right', px: 12, color: stars ? ui.UI.gold : ui.UI.textMute, bg: 'rgba(4,6,14,0.8)' });

      if (!unlocked) {
        drawLock(cx + cw / 2, cy + 250, 64);
        ctx.textAlign = 'center';
        ui.fitText('Finish ' + REALMS[r - 1].name, cx + cw / 2, cy + 316, cw - 24, 14, { color: ui.UI.warn });
        continue;
      }

      /* the eight levels as numbered nodes along a winding dotted path */
      const nodePos = [];
      for (let k = 0; k < 8; ++k) {
        const row = (k / 4) | 0;
        const col = row === 0 ? k % 4 : 3 - (k % 4);
        nodePos.push([cx + 38 + col * 58, cy + 214 + row * 100]);
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(nodePos[0][0], nodePos[0][1]);
      for (let k = 1; k < 8; ++k)
        ctx.lineTo(nodePos[k][0], nodePos[k][1]);
      ctx.stroke();
      ctx.restore();

      for (let k = 0; k < 8; ++k) {
        const index = r * 8 + k;
        const nx = nodePos[k][0], ny = nodePos[k][1];
        const open = campaignUnlocked(index);
        const got = save.stars[SZ.PuzzleLevels.CAMPAIGN[index].id] || 0;
        const hit = registerHit('lv-' + index, nx - 17, ny - 17, 34, 34, function() { loadPuzzle('campaign', index); }, !open);
        const hot = isHot(hit, nx - 17, ny - 17, 34, 34);
        ctx.save();
        if (!open)
          ctx.globalAlpha *= 0.45;
        ctx.beginPath();
        ctx.arc(nx, ny, 16, 0, Math.PI * 2);
        ctx.fillStyle = hot ? 'rgba(44,56,88,0.98)' : 'rgba(14,18,32,0.92)';
        ctx.fill();
        ctx.lineWidth = hot ? 2.5 : 1.5;
        ctx.strokeStyle = got >= 3 ? ui.UI.good : hot ? ui.UI.gold : realm.color;
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (open) {
          ctx.fillStyle = ui.UI.text;
          ctx.font = ui.uiFont(15, 'bold');
          ctx.fillText(String(k + 1), nx, ny + 1);
        } else {
          drawLock(nx, ny, 18);
        }
        ctx.restore();
        if (got > 0) {
          for (let s = 0; s < 3; ++s) {
            starPath(nx - 12 + s * 12, ny + 26, 5);
            ctx.fillStyle = s < got ? ui.UI.gold : 'rgba(255,255,255,0.1)';
            ctx.fill();
          }
        }
      }
    }

    ui.drawKeyHints([
      { key: '↑↓←→', label: 'Select level' },
      { key: 'Enter', label: 'Start' },
      { key: 'Esc', label: 'Title' }
    ], 640, 694, 900, 1);
  }

  function drawTrialsScreen() {
    drawMenuBackdrop(4, 'rgba(4,6,14,0.66)');
    ui.drawHeadline('Trials', 640, 46, 600, 40, '#c04cff', '#7a2ad0');
    ui.drawChip(solvedTrialCount() + ' / 60', 1256, 20, 28, { align: 'right', color: ui.UI.gold });

    const TW = 112, TH = 72, GX = 12, GY = 14;
    const x0 = (VIEW_W - (10 * TW + 9 * GX)) / 2, y0 = 104;
    for (let i = 0; i < SZ.PuzzleLevels.BONUS.length; ++i) {
      const x = x0 + (i % 10) * (TW + GX), y = y0 + ((i / 10) | 0) * (TH + GY);
      const open = trialUnlocked(i);
      const got = save.stars[SZ.PuzzleLevels.BONUS[i].id] || 0;
      const hit = registerHit('trial-' + i, x, y, TW, TH, function() { loadPuzzle('bonus', i); }, !open);
      const hot = isHot(hit, x, y, TW, TH);
      ctx.save();
      if (!open)
        ctx.globalAlpha *= 0.45;
      ui.drawPanel(x, y, TW, TH, {
        radius: 8, noStuds: true, glow: hot,
        accent: hot ? ui.UI.gold : got >= 3 ? ui.UI.good : got > 0 ? ui.UI.accent : ui.UI.textMute
      });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (open) {
        ctx.fillStyle = ui.UI.text;
        ctx.font = ui.uiFont(22, 'bold');
        ctx.fillText(String(i + 1), x + TW / 2, y + 26);
      } else {
        drawLock(x + TW / 2, y + 26, 26);
      }
      for (let s = 0; s < 3; ++s) {
        starPath(x + TW / 2 - 16 + s * 16, y + TH - 18, 6);
        ctx.fillStyle = s < got ? ui.UI.gold : 'rgba(255,255,255,0.1)';
        ctx.fill();
      }
      ctx.restore();
    }

    if (campaignStarCount() < 10) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText('Trials open once you have 10 campaign stars', 640, 656, 600, 15, { color: ui.UI.warn });
    }

    ui.drawKeyHints([
      { key: '↑↓←→', label: 'Select trial' },
      { key: 'Enter', label: 'Start' },
      { key: 'Esc', label: 'Title' }
    ], 640, 694, 900, 1);
  }

  function drawGrimoire() {
    const layout = buildTreeLayout();
    treeLayout = layout;
    if (!treeSelected || !layout.cards.some(function(c) { return c.node.id === treeSelected; }))
      selectFirstInBranch();
    if (mouseX >= 0) {
      for (const card of layout.cards) {
        if (mouseX >= card.x && mouseX <= card.x + card.w && mouseY >= card.y && mouseY <= card.y + card.h) {
          treeSelected = card.node.id;
          break;
        }
      }
    }

    drawMenuBackdrop(4, 'rgba(4,6,14,0.72)');

    ui.drawPanel(24, 20, 1232, 76);
    ui.drawHeadline('Grimoire', 130, 58, 220, 40, '#c04cff');
    drawShardsChip(1236, 44);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ui.fitText(treeMaxedCount() + ' / ' + TREE.length + ' runes inscribed', 1236, 84, 320, 13, { color: ui.UI.textDim });
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

    /* connectors under the cards */
    const byId = {};
    for (const card of layout.cards)
      byId[card.node.id] = card;
    ctx.lineWidth = 3;
    for (const card of layout.cards) {
      for (const [reqId, reqLevel] of card.node.req) {
        const from = byId[reqId];
        if (!from)
          continue;
        const met = treeLevel(reqId) >= reqLevel;
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
      if (card.node.id !== treeSelected)
        continue;
      ui.roundRectPath(card.x - 3, card.y - 3, card.w + 6, card.h + 6, 11);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Branch' },
      { key: '↑↓', label: 'Select' },
      { key: 'Tab/1-4', label: 'Branch' },
      { key: 'Enter', label: 'Buy' },
      { key: 'Esc', label: 'Back' }
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
      ctx.strokeStyle = ui.hexToRgba(branch.color, 0.4 + 0.3 * Math.sin(time * 4));
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
      ui.fitText(node.costs[level] + ' shards', card.x + card.w - 16, card.y + card.h - 14, 120, 15, { weight: 'bold', color: costColor });
      ctx.textAlign = 'left';
    }

    if (locked) {
      const missing = [];
      for (const [reqId, reqLevel] of node.req) {
        if (treeLevel(reqId) < reqLevel)
          missing.push(TREE_BY_ID[reqId].name + ' ' + romanNumeral(reqLevel));
      }
      ctx.textAlign = 'center';
      ui.fitText('Requires ' + missing.join(', '), card.x + card.w / 2, card.y + card.h - 30, card.w - 32, 12, { color: ui.UI.warn });
      ctx.textAlign = 'left';
    }

    if (treeBuyFlash && treeBuyFlash.id === node.id) {
      const f = 1 - (time - treeBuyFlash.at) / 0.3;
      if (f > 0) {
        ui.roundRectPath(card.x, card.y, card.w, card.h, 9);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * f).toFixed(3) + ')';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function robeName(id) {
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  function drawWardrobe() {
    drawMenuBackdrop(0, 'rgba(4,6,14,0.62)');
    ui.drawHeadline('Wardrobe', 640, 46, 600, 40, '#ffd23f', '#c04cff');

    const robeIds = Object.keys(ROBES);
    const preview = robeIds[Math.max(0, Math.min(robeIds.length - 1, wardrobeCursor))];

    /* the mage, big, idling in a pool of his robe's own light */
    const gx = 330, gy = 470;
    ctx.save();
    const glow = 0.3 + 0.12 * Math.sin(time * 3);
    const g = ctx.createRadialGradient(gx, gy, 10, gx, gy, 170);
    g.addColorStop(0, ui.hexToRgba(ROBES[preview], glow));
    g.addColorStop(1, ui.hexToRgba(ROBES[preview], 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(gx, gy, 170, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(gx, gy - 24);
    ctx.scale(3, 3);
    SZ.PuzzleArt.drawHero(ctx, 0, 0, 'down', 'idle', time, ROBES[preview]);
    ctx.restore();

    /* right: the robe's name and what it takes to wear it */
    ui.drawPanel(560, 150, 680, 200, { accent: ROBES[preview] });
    ui.drawHeadline(robeName(preview) + ' Robe', 900, 196, 600, 30, ROBES[preview], ui.UI.gold);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (save.robe === preview) {
      ui.fitText('You are wearing this robe.', 900, 250, 600, 17, { color: ui.UI.good });
    } else if (save.robes.indexOf(preview) >= 0) {
      ui.fitText('In your wardrobe — Enter or click to wear it.', 900, 250, 600, 17, { color: ui.UI.text });
    } else {
      ui.fitText('Inscribe “' + robeRequirement(preview) + '” in the Grimoire to unlock.', 900, 250, 600, 17, { color: ui.UI.warn });
    }
    ui.drawKeyHints([
      { key: '←→', label: 'Select robe' },
      { key: 'Enter', label: 'Wear' },
      { key: 'Esc', label: 'Back' }
    ], 900, 310, 600, 1);

    /* bottom: the six swatches */
    for (let i = 0; i < robeIds.length; ++i) {
      const id = robeIds[i];
      const x = 40 + i * 202, y = 540, w = 190, h = 150;
      const owned = save.robes.indexOf(id) >= 0;
      const worn = save.robe === id;
      const hit = registerHit('robe-' + id, x, y, w, h, function() {
        wardrobeCursor = i;
        if (owned)
          selectRobe(id);
        else
          sfx('error', { volume: 0.4 });
      });
      const hot = isHot(hit, x, y, w, h);
      ctx.save();
      if (!owned)
        ctx.globalAlpha *= 0.6;
      ui.drawPanel(x, y, w, h, { radius: 9, accent: worn ? ui.UI.good : hot ? ui.UI.gold : ROBES[id], glow: worn || wardrobeCursor === i });
      ctx.save();
      ctx.translate(x + w / 2, y + 80);
      ctx.scale(1.3, 1.3);
      SZ.PuzzleArt.drawHero(ctx, 0, 0, 'down', 'idle', time, ROBES[id]);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(robeName(id), x + w / 2, y + 110, w - 20, 15, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
      let tag, tagColor;
      if (worn) { tag = 'Selected'; tagColor = ui.UI.good; }
      else if (owned) { tag = 'Enter to wear'; tagColor = ui.UI.textDim; }
      else { tag = 'Needs ' + robeRequirement(id); tagColor = ui.UI.warn; }
      ctx.fillStyle = tagColor;
      ctx.font = ui.uiFont(12, 'bold');
      ctx.fillText(tag, x + w / 2, y + 132);
      if (!owned)
        drawLock(x + w / 2, y + 40, 30);
      ctx.restore();
    }
  }

  const HELP_PAGES = ['Goal', 'Elements', 'Tiles', 'Controls'];

  function drawHelp() {
    drawMenuBackdrop(1, 'rgba(4,6,14,0.78)');
    const pw = 900, ph = 520, px = 190, py = 100;
    ui.drawPanel(px, py, pw, ph, { title: 'Help · ' + HELP_PAGES[helpPage], accent: ui.UI.accent, titlePx: 20 });

    if (helpPage === 0) {
      SZ.PuzzleArt.drawPortal(ctx, theme, 640, 200, time, true);
      const lines = [
        'Reach the glowing portal to complete the puzzle.',
        'Walk by clicking a tile you can reach; runes on the way are collected.',
        'Every cast costs one mana from the well — plan the fewest spells.',
        'Stars: one for solving, one for casts at or under par, one for every rune.'
      ];
      let y = 280;
      for (const line of lines) {
        ui.drawTextBlock(line, px + 60, y, pw - 120, 36, 18, { color: ui.UI.text, align: 'center', valign: 'middle' });
        y += 52;
      }
    } else if (helpPage === 1) {
      const info = [
        ['fire', 'Spreads through connected wood and melts ice into water.'],
        ['water', 'Floods connected channels, so you can walk across.'],
        ['earth', 'Fills chasms and raises a stone wall on open ground.'],
        ['air', 'Pushes a boulder from the side you point at; it slides until something stops it, and a boulder that falls into a chasm fills it.']
      ];
      let y = 166;
      for (const row of info) {
        SZ.PuzzleScene.drawElementIcon(ctx, row[0], 330, y + 34, 52, true);
        const el = ELEMENT_BY_ID[row[0]];
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ui.fitText(el.name, 380, y + 12, 200, 20, { weight: 'bold', color: el.color });
        ui.drawTextBlock(row[1], 380, y + 28, 640, 62, 15, { color: ui.UI.textDim });
        y += 102;
      }
    } else if (helpPage === 2) {
      const samples = [
        [T.FLOOR, 'Floor'], [T.WALL, 'Wall'], [T.WOOD, 'Wood'], [T.CHANNEL, 'Channel'], [T.WATER, 'Water'],
        [T.BOULDER, 'Boulder'], [T.STONE, 'Stone'], [T.CHASM, 'Chasm'], [T.ICE, 'Ice'], [T.RUNE, 'Rune']
      ];
      for (let i = 0; i < samples.length; ++i) {
        const x = 252 + (i % 5) * 160, y = 186 + ((i / 5) | 0) * 160;
        SZ.PuzzleArt.drawTile(ctx, 0, samples[i][0], x, y, 1, Math.floor(time * 4));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText(samples[i][1], x + 32, y + 84, 140, 14, { color: ui.UI.textDim });
      }
    } else {
      const lines = [
        ['Elements', '1-4 or Q / W / E'],
        ['Walk / cast', 'click or tap a tile'],
        ['Undo', 'Z'],
        ['Restart', 'R'],
        ['Hint', 'H'],
        ['Pause', 'Esc'],
        ['Title screen', 'F2']
      ];
      for (let i = 0; i < lines.length; ++i) {
        const y = 186 + i * 48;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = ui.UI.text;
        ctx.font = ui.uiFont(20, 'bold');
        ctx.fillText(lines[i][0], px + 90, y);
        ctx.fillStyle = ui.UI.textDim;
        ctx.font = ui.uiFont(18);
        ctx.fillText(lines[i][1], px + 340, y);
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Page ' + (helpPage + 1) + ' / ' + HELP_PAGES.length, 640, py + ph - 26, 300, 13, { color: ui.UI.textMute });
    ui.drawKeyHints([
      { key: '←→', label: 'Page' },
      { key: 'Esc', label: 'Back' }
    ], 640, 694, 900, 1);
  }

  function drawMenuScreen() {
    if (state === 'title')
      drawTitleScreen();
    else if (state === 'realms')
      drawRealmsScreen();
    else if (state === 'trials')
      drawTrialsScreen();
    else if (state === 'grimoire')
      drawGrimoire();
    else if (state === 'wardrobe')
      drawWardrobe();
    else
      drawHelp();
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  const SCREEN_NAMES = { title: 'Title', realms: 'Realms', trials: 'Trials', grimoire: 'Grimoire', wardrobe: 'Wardrobe', help: 'Help' };

  function updateStatusBar() {
    if (isMenuState(state)) {
      if (statusLevel) statusLevel.textContent = `Screen: ${SCREEN_NAMES[state]}`;
      if (statusElement) statusElement.textContent = 'Element: —';
      if (statusMoves) statusMoves.textContent = 'Casts: —';
      if (statusStars) statusStars.textContent = 'Mana: —';
      return;
    }
    if (statusLevel) statusLevel.textContent = `Level: ${level.id}`;
    if (statusElement) {
      const el = ELEMENT_BY_ID[selectedElement];
      statusElement.textContent = `Element: ${el ? el.name : '—'}`;
    }
    if (statusMoves) statusMoves.textContent = `Casts: ${casts}`;
    if (statusStars) statusStars.textContent = `Mana: ${mana} / ${manaTotal}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;
  let animFrameId = null;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.max(0, Math.min(rawDt, MAX_DT));
    lastTimestamp = timestamp;

    if (isMenuState(state)) {
      time += dt;
      particles.update();
      floatingText.update();
      beginFrame();
      hitAreas.length = 0;
      drawMenuScreen();
      particles.draw(ctx);
      floatingText.draw(ctx);
      drawFade(dt);
      updateStatusBar();
      animFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    if (state !== STATE_PAUSED)
      updateGame(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    beginFrame();
    ctx.save();
    screenShake.apply(ctx);
    drawGame();
    particles.draw(ctx);
    floatingText.draw(ctx);
    screenShake.restore(ctx);
    ctx.restore();

    drawOverlays();
    drawFade(dt);
    updateStatusBar();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* the black wash over the visible rect while a screen change settles in */
  function drawFade(dt) {
    if (fade <= 0)
      return;
    fillVeil('rgba(0,0,0,' + fade.toFixed(3) + ')');
    fade = Math.max(0, fade - dt * FADE_RATE);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  function inRect(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  function rejectTile(idx) {
    tileShake = { index: idx, t: 0 };
    sfx('error', { volume: 0.4 });
  }

  function handleTileClick(idx, p) {
    const code = puzzle.tiles[idx];
    if (isWalkable(code) && reach().has(idx)) {
      if (idx !== puzzle.hero)
        startWalk(idx, null);
      return;
    }
    const acts = actionsForTile(idx, selectedElement, p);
    if (acts.length) {
      const action = acts[0];
      let standIdx;
      if (action.element === 'air') {
        const d = DIRS[action.dir];
        standIdx = (rowOf(idx) - d[0]) * puzzle.cols + (colOf(idx) - d[1]);
      } else {
        standIdx = nearestStandTo(idx);
      }
      if (standIdx < 0) {
        rejectTile(idx);
        return;
      }
      beginCast(action, standIdx, dirBetween(standIdx, idx));
      return;
    }
    rejectTile(idx);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F1') {
      e.preventDefault();
      openHelp();
      return;
    }

    if (e.code === 'F2') {
      e.preventDefault();
      setScreen('title');
      return;
    }

    /* ── Grimoire tech tree navigation ── */
    if (state === 'grimoire') {
      e.preventDefault();
      if (e.code === 'Escape') {
        setScreen(prevScreen);
      } else if (e.code === 'Tab') {
        treeBranch = (treeBranch + 1) % TREE_BRANCH_LIST.length;
        treeLayout = buildTreeLayout();
        selectFirstInBranch();
        sfx('click', { volume: 0.4 });
      } else if (e.code >= 'Digit1' && e.code <= 'Digit4') {
        const b = Number(e.code.slice(5)) - 1;
        if (b < TREE_BRANCH_LIST.length) {
          treeBranch = b;
          treeLayout = buildTreeLayout();
          selectFirstInBranch();
          sfx('click', { volume: 0.4 });
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        moveTreeSelection(-1, 0);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        moveTreeSelection(1, 0);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        moveTreeSelection(0, -1);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        moveTreeSelection(0, 1);
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
        if (treeSelected && buyNode(treeSelected))
          treeBuyFlash = { id: treeSelected, at: time };
      }
      return;
    }

    /* ── Help pages ── */
    if (state === 'help') {
      e.preventDefault();
      if (e.code === 'Escape')
        leaveHelp();
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        helpPage = Math.max(0, helpPage - 1);
        sfx('click', { volume: 0.4 });
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        helpPage = Math.min(HELP_PAGES.length - 1, helpPage + 1);
        sfx('click', { volume: 0.4 });
      }
      return;
    }

    /* ── menus and panels share the hit-area cursor ── */
    if (isMenuState(state) || state === STATE_PAUSED || state === STATE_LEVEL_COMPLETE || state === STATE_OUT_OF_MANA) {
      e.preventDefault();
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'KeyA')
        moveMenuCursor(-1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'KeyD')
        moveMenuCursor(1);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')
        activateMenuItem(hitAreas[menuCursor]);
      else if (e.code === 'KeyH' && isMenuState(state))
        openHelp();
      else if (e.code === 'KeyR' && !isMenuState(state))
        restartLevel();
      else if (e.code === 'KeyZ' && state === STATE_OUT_OF_MANA)
        undoCast();
      else if (e.code === 'KeyL' && !isMenuState(state))
        goLevels();
      else if (e.code === 'KeyT' && !isMenuState(state))
        setScreen('title');
      else if (e.code === 'Escape') {
        if (state === STATE_PAUSED)
          state = STATE_PLAYING;
        else if (state === STATE_LEVEL_COMPLETE || state === STATE_OUT_OF_MANA)
          goLevels();
        else if (state !== 'title')
          setScreen('title');
      }
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      state = STATE_PAUSED;
      menuCursor = 0;
      return;
    }

    if (state !== STATE_PLAYING)
      return;

    if (e.code === 'KeyZ') {
      e.preventDefault();
      undoCast();
      return;
    }
    if (e.code === 'KeyR') {
      restartLevel();
      return;
    }
    if (e.code === 'KeyH') {
      showHint();
      return;
    }

    if (e.key === '1') selectElement('fire');
    if (e.key === '2') selectElement('water');
    if (e.key === '3') selectElement('earth');
    if (e.key === '4') selectElement('air');
    if (e.code === 'KeyQ') selectElement('fire');
    if (e.code === 'KeyW') selectElement('water');
    if (e.code === 'KeyE') selectElement('earth');
  });

  canvas.addEventListener('pointerdown', (e) => {
    /* the frame must keep keyboard focus after clicks */
    window.focus();

    const p = pointerToView(e);
    mouseX = p.x;
    mouseY = p.y;

    if (isMenuState(state) || state === STATE_PAUSED || state === STATE_LEVEL_COMPLETE || state === STATE_OUT_OF_MANA) {
      if (state === 'grimoire' && treeLayout) {
        for (const tab of treeLayout.tabs)
          if (inRect(p, tab)) {
            treeBranch = tab.index;
            selectFirstInBranch();
            sfx('click', { volume: 0.4 });
            return;
          }
        for (const card of treeLayout.cards)
          if (inRect(p, card)) {
            treeSelected = card.node.id;
            if (buyNode(card.node.id))
              treeBuyFlash = { id: card.node.id, at: time };
            return;
          }
        return;
      }
      for (let i = 0; i < hitAreas.length; ++i) {
        const a = hitAreas[i];
        if (inRect(p, a)) {
          menuCursor = i;
          activateMenuItem(a);
          return;
        }
      }
      return;
    }

    for (const b of elementButtons)
      if (inRect(p, b)) {
        selectElement(b.id);
        return;
      }

    if (pendingCast || winSeq)
      return;

    const idx = pointToTile(p);
    if (idx >= 0)
      handleTileClick(idx, p);
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointerToView(e);
    hoverPoint = p;
    mouseX = p.x;
    mouseY = p.y;
    hoverIdx = state === STATE_PLAYING ? pointToTile(p) : -1;
  });

  canvas.addEventListener('pointerleave', () => {
    hoverIdx = -1;
    hoverPoint = null;
    mouseX = -1;
    mouseY = -1;
  });

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        setScreen('title');
        break;
      case 'pause':
        if (state === STATE_PLAYING)
          state = STATE_PAUSED;
        else if (state === STATE_PAUSED)
          state = STATE_PLAYING;
        break;
      case 'hint':
        showHint();
        break;
      case 'high-scores':
        renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            highScores = [];
            saveHighScores();
            renderHighScores();
          }
        });
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'how-to-play':
        openHelp();
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
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

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const title = `Fantasy Puzzle — ${realmInfo().name}: ${level ? level.name : ''}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
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
     API — what the menu screens will drive
     ══════════════════════════════════════════════════════════════════ */

  SZ.FantasyPuzzle = {
    loadPuzzle, loadDailyPuzzle, restartLevel,
    dailyIndex, campaignUnlocked, trialUnlocked,
    treeLevel, nodeState, buyNode, selectRobe,
    TREE, TREE_BRANCHES, ROBES
  };

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();

  new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  loadSave();
  loadHighScores();
  loadTutorialSeen();
  loadPuzzle('campaign', 0);
  SZ.GameAudio.attachMuteButton();

  /* let the page accept keyboard focus so clicks keep the keys alive */
  document.body.tabIndex = -1;

  setScreen('title');

  // Walk first-time players through the Help screen before anything else
  if (!tutorialSeen) {
    helpFrom = 'title';
    helpPage = 0;
    state = 'help';
  }

  // Auto-pause when the tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === STATE_PLAYING)
      state = STATE_PAUSED;
  });

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
