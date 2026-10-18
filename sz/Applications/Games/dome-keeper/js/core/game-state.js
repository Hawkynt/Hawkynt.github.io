;(function() {
  'use strict';

  // Animation clocks, the run state (dome, bag, weapon, keeper, camera, enemies, grid, tree view), tutorial pages and canvas setup.
  // Owns: NS.gameState and these state fields:
  //   G.animTime, G.pickaxeAngle, G.pickaxeSwinging, G.pickaxeSwingTimer, G.lastMineDir, G.keeperFaceX,
  //   G.domePulsePhase, G.domeHitFlash, G.lastDomeHurtSound, G.playerBob, G.crumbleEffects, G.dustClouds,
  //   G.resourceGlows, G.shieldImpacts, G.tileSparkleTimer, G.tutorialSeen, G.showTutorial, G.tutorialPage,
  //   G.state, G.currentView, G.transitionProgress, G.transitionTarget, G.domeHP, G.maxDomeHP, G.resources,
  //   G.carried, G.bag, G.lastPackNotice, G.cargoPanelH, G.cargoPanelRect, G.carryCapacity, G.weaponDamage,
  //   G.fireRate, G.fireCooldown, G.projectiles, G.fireRequested, G.turretAngle, G.mouseAimX, G.mouseAimY,
  //   G.drillSpeed, G.drillX, G.drillY, G.drillTimer, G.cameraX, G.cameraY, G.enemies, G.waveNumber,
  //   G.siteNights, G.waveTimer, G.waveActive, G.score, G.undergroundGrid, G.highScores, G.tileHP,
  //   G.tileMaxHP, G.miningProgress, G.miningDuration, G.miningTarget, G.miningDir, G.droppedResources,
  //   G.pileVersion, G.pileAgeTimer, G.moveTarget, G.movePath, G.movePathIndex, G.moveStepTimer,
  //   G.mineTarget, G.moveStepInterval, G.primaryGadget, G.primaryGadgetState, G.foundGadgets,
  //   G.gadgetChambers, G.gadgetSelectHover, G.unlockedTools, G.activeToolKey, G.toolState,
  //   G.upgradeTreeLevels, G.effectiveLevelCache, G.effectiveLevelSrc, G.upgradeDialogHover,
  //   G.stateBeforeUpgradeDialog, G.upgradeZoom, G.upgradePanX, G.upgradePanY, G.upgradeViewCustomized,
  //   G.upgradePanning, G.upgradePanStartX, G.upgradePanStartY, G.upgradePanBaseX, G.upgradePanBaseY,
  //   G.treeTab, G.treeFocusId, G.treeLayout, G.treeNodeInfo, G.quickPanelHover, G.tileArt, G.renderScale
  // Reads: constants, dom, rules

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, VIEW_SURFACE, STATE_READY, GRID_COLS } = NS.constants;
  const { canvas } = NS.dom;
  const { emptyResources, BASE_DOME_HP, BASE_WEAPON_DAMAGE, BASE_FIRE_RATE, BASE_DRILL_SPEED,
    BASE_CARRY_CAPACITY, BASE_MOVE_INTERVAL } = NS.rules;

  /* ======================================================================
     ANIMATION STATE
     ====================================================================== */

  G.animTime = 0; // global animation clock (seconds)

  // Mining / pickaxe swing
  G.pickaxeAngle = 0;         // current swing angle (radians)
  G.pickaxeSwinging = false;
  G.pickaxeSwingTimer = 0;
  const PICKAXE_SWING_DURATION = 0.25;
  G.lastMineDir = { dx: 1, dy: 0 }; // where the keeper looks: last move or mine direction (sprite and headlamp)
  G.keeperFaceX = 1; // last left/right facing, kept while looking up or down

  // Dome pulse
  G.domePulsePhase = 0;
  G.domeHitFlash = 0; // flash timer when dome is hit
  G.lastDomeHurtSound = 0;

  // Player idle bob (underground)
  G.playerBob = 0;

  // Rock crumble animations
  G.crumbleEffects = []; // { x, y, pieces: [{x,y,vx,vy,rot,rotV,size,color}], life }

  // Dust clouds
  G.dustClouds = []; // { x, y, alpha, radius, expandRate }

  // Resource reveal glows
  G.resourceGlows = []; // { x, y, color, life, radius }

  // Dome shield impact flashes
  G.shieldImpacts = []; // { angle, life, intensity }

  // Ambient underground sparkles for resource tiles
  G.tileSparkleTimer = 0;

  /* ======================================================================
     GAME STATE
     ====================================================================== */

  /* ── Tutorial ── */
  G.tutorialSeen = false;
  G.showTutorial = false;
  G.tutorialPage = 0;
  // Each page: intro paragraph plus rows of [key, text] (key null = plain bullet)
  const TUTORIAL_PAGES = [
    { title: 'How to Play', icon: 'dome',
      intro: 'Mine by day, defend the dome at night. Dig resources underground, bring them home and spend them on upgrades.',
      items: [['Click', 'Fire the laser (surface) / dig (underground)'], ['WASD / Arrows', 'Move the keeper and mine underground'], ['Space / Tab', 'Switch between surface and mine'], ['C', 'Open the Bomb Workshop'], ['Esc', 'Pause - the run is saved automatically']] },
    { title: 'Day & Night', icon: 'moon',
      intro: 'Monsters attack after nightfall. A warning sounds before dusk - get back to the dome in time.',
      items: [[null, 'The sun crosses the sky by day, the moon by night'], [null, 'Full-moon nights bring bigger swarms, new-moon nights are calm'], [null, 'More monsters can arrive later in the night'], [null, 'Sunlight burns the monsters still out at dawn'], [null, 'Day, time, moon phase and weather sit in the top-left panel']] },
    { title: 'Seasons & Weather', icon: 'flower',
      intro: 'A new season begins every four days and changes the swarm and the weather.',
      items: [['Spring', 'Blossoms lure more monsters - smaller and weaker'], ['Summer', 'Long days, the heat makes monsters faster'], ['Autumn', 'Falling leaves, rain and thunderstorms'], ['Winter', 'Short days, snow, few but much tougher monsters'], [null, 'Lightning and meteors hit monsters - and sometimes the dome'], ['Click', 'Collect the ore a meteor leaves behind']] },
    { title: 'Monsters', icon: 'swords',
      intro: 'The swarm grows more varied with every night and every new site. Hover a monster to read about it.',
      items: [['Swarmers', 'Tiny, fast and always in packs'], ['Crawlers', 'Armor soaks part of every hit'], ['Divers', 'Circle high, then dive at the dome'], ['Burrowers', 'Tunnel unseen and pop up at the dome'], ['Spitters', 'Shoot acid from a distance'], ['Splitters', 'Burst into swarmers; Menders heal others'], ['Bosses', 'Behemoth and Hive Queen on every fifth night']] },
    { title: 'Stronger Every Night', icon: 'swords',
      intro: 'Each night at a site raises the threat, each new site adds four more. Monsters get tougher faster than you might think.',
      items: [['Threat', 'More, tougher and faster monsters; the chip turns red and violet'], ['Elites', 'Crest and ring: double health and an aura for their pack'], ['Auras', 'Haste (faster), Ward (less damage), Fury (harder bites)'], ['Enraged', 'Wounded monsters glow red, run and bite harder'], [null, 'Late elites spit acid; extra armour grows with the threat']] },
    { title: 'Combat Skill', icon: 'target',
      intro: 'Aim matters: shots that only graze a monster do less and break your combo. Hover a monster to see its weak point.',
      items: [['Weak point', 'Hit the gold reticle for double damage - CRIT!'], ['Combo', 'Hits in a row add up to 60% damage; a miss resets it'], ['Hold click / F', 'Charge; release when the ring meets the gold circle: PERFECT, piercing shot'], ['E / Right click', 'Parry (or tap the dome): acid and lances fly back, divers bounce'], ['!', 'Bosses warn before they strike - parry at the impact']] },
    { title: 'Upgrades & Tips', icon: 'pickaxe',
      intro: 'Everything is bought in one upgrade tree with six branches: Dome, Mining, Movement, Weapon, Drones and Tools.',
      items: [['U', 'Open the upgrade tree (on the surface)'], [null, 'The Next upgrades panel shows the next node of every branch: click to buy it'], [null, 'Deeper strata hold new ores that pay for the top tiers'], [null, 'Panels fade when something is behind them; click monsters right through them'], ['H', 'Show this help again anytime']] },
    { title: 'Drones', icon: 'drone',
      intro: 'Buy the Drone Bay in the Drones branch and a courier drone starts working for you.',
      items: [[null, 'Couriers fly to the keeper, take the cargo home and pick up loose ore'], [null, 'Mining Lasers let couriers dig ore near the keeper'], [null, 'Gun drones guard the dome, repair drones weld it'], [null, 'Courier Drones, Gun Drones and Repair Drones level up to 10 of each kind'], [null, 'The Droneyard gadget gives a free courier']] },
    { title: 'Bag & Compressor', icon: 'bag',
      intro: 'Ore counts as yours the moment you mine it; the bag only limits what you carry before heading home. Each stack takes one slot.',
      items: [[null, 'Bag Size: +25 slots per level, from 50 up to 1,000'], [null, 'Compressor: 9 ore make a Block, 9 Blocks a Compressed Block, ...'], [null, 'Example: 20 iron = 2 Iron Blocks + 2 ore = 4 slots'], [null, 'Drone cargo is packed too; hover the cargo panel to see every stack'], [null, 'Loose ore gathers in one pile per tile and vanishes after two minutes']] },
    { title: 'Relocation', icon: 'core',
      intro: 'Every mine hides a Relocation Core in its lower strata. Scanners point toward it once it is close.',
      items: [[null, 'Mine the core to unlock the Relocate button'], ['L', 'Relocate when no monsters are attacking'], [null, 'Keep all upgrades and drones plus 75% of the resources'], [null, 'Each new site: a new biome and mine, and tougher monsters']] },
    { title: 'Gadgets', icon: 'gear',
      intro: 'Choose a primary gadget at the start of each run. Golden 2x2 gadget chambers underground hide more of them.',
      items: [['R', 'Activate the Repellent Field'], [null, 'The Blast Mining chamber adds two Bombs to your stock'], [null, 'Gadgets from chambers activate on pickup!']] },
    { title: 'Tools', icon: 'drill',
      intro: 'Tools are nodes of the Tools branch of the upgrade tree. Once bought, use them with the number keys.',
      items: [['1', 'Drill: fast column mining'], ['2', 'Blast: clears a 3x3 area'], ['3', 'Scanner: reveals ores, points to the core and to chests'], ['4', 'Reinforced Dome: takes less damage'], ['5', 'Teleporter: instant return to the surface']] },
    { title: 'Bombs', icon: 'bomb',
      intro: 'Craft bombs from ore in the workshop. Three of a size combine into one of the next - up to the Void Bomb. Recipes and bomb upgrades live in the Tools branch.',
      items: [['C', 'Bomb Workshop: craft and combine'], ['B', 'Drop a bomb in the mine - then run! / lob it at monsters'], ['T', 'Throw mode: click a tunnel tile (or the battlefield)'], ['Q', 'Next bomb size'], ['X', 'Set off all bombs (Remote Detonator)'], [null, 'Blasts free the ore, spare the core and chests, and daze a keeper too close']] },
    { title: 'Secret Chests', icon: 'chest',
      intro: 'Every mine hides three secret chests - shallow, middle and deep. Scanners point the way; dig into one to try its lock.',
      items: [['Lock Picking', 'Stop the needle in the gold zone for every pin'], ['Power Circuit', 'Rotate pipes until power reaches the lock'], ['Rune Memory', 'Repeat the runes in the order they lit up'], [null, 'Fail and the lock jams for 20 s - then try again'], [null, 'Each chest holds an artifact: a strong, unique power for the whole run (see the Artifacts tab)']] }
  ];

  G.state = STATE_READY;
  G.currentView = VIEW_SURFACE;
  G.transitionProgress = 0;
  G.transitionTarget = null;

  G.domeHP = BASE_DOME_HP;
  G.maxDomeHP = BASE_DOME_HP;

  G.resources = emptyResources();
  G.carried = 0;                 // bag slots in use (always bagSlots())
  G.bag = {};                    // ore in the bag per resource label
  G.lastPackNotice = 0;          // time of the last 'packed a block' message
  G.cargoPanelH = 112;           // height of the cargo HUD panel (the tool panel sits below)
  G.cargoPanelRect = null;       // its screen rectangle for the hover tooltip
  G.carryCapacity = BASE_CARRY_CAPACITY;

  G.weaponDamage = BASE_WEAPON_DAMAGE;
  G.fireRate = BASE_FIRE_RATE;
  G.fireCooldown = 0;
  G.projectiles = [];
  let aimX = 0, aimY = 0; // mouse aim position on surface
  G.fireRequested = false; // player clicked to fire
  G.turretAngle = -Math.PI / 2; // turret barrel angle (radians); default = straight up
  G.mouseAimX = -1; G.mouseAimY = -1; // continuous mouse position for turret aiming
  const TURRET_BARREL_LENGTH = 40;
  const TURRET_KEYBOARD_SPEED = 2.5; // radians per second

  G.drillSpeed = BASE_DRILL_SPEED;
  G.drillX = Math.floor(GRID_COLS / 2);
  G.drillY = 0;
  G.drillTimer = 0;

  G.cameraX = 0;
  G.cameraY = 0;

  G.enemies = [];
  G.waveNumber = 0;          // nights survived in the whole run
  G.siteNights = 0;          // nights at the current site (threat restarts per site)
  G.waveTimer = 0;
  G.waveActive = false;
  G.score = 0;

  G.undergroundGrid = [];
  G.highScores = [];

  /* ── Persistent tile mining HP ── */
  G.tileHP = [];                   // 2D array [row][col] of remaining mining HP (null = full)
  G.tileMaxHP = [];                // 2D array [row][col] of max mining HP

  /* ── Mining state ── */
  G.miningProgress = 0;          // accumulated time toward current mine
  G.miningDuration = 0;          // total time required for current mine
  G.miningTarget = null;         // {col, row, dx, dy} -- block being mined
  G.miningDir = null;            // {dx, dy} -- direction player is mining toward

  /* ── Dropped resources ── */
  G.droppedResources = [];       // one pile per cell: [{col, row, items: {tileType: amount}, total, age, key, idx}]
  const pileByCell = new Map();    // row * GRID_COLS + col -> pile
  G.pileVersion = 0;             // bumped whenever a pile appears, changes or vanishes
  G.pileAgeTimer = 0;            // piles age in 0.5 s steps

  /* ── Mouse-based underground navigation ── */
  G.moveTarget = null;   // {col, row} -- destination tile
  G.movePath = null;     // [{col, row}, ...] -- BFS path steps
  G.movePathIndex = 0;   // current step index in path
  G.moveStepTimer = 0;   // timer for smooth stepping
  G.mineTarget = null;   // {col, row, dx, dy} -- queued mine after arrival
  G.moveStepInterval = BASE_MOVE_INTERVAL; // effective move interval (affected by upgrades)

  /* ── Gadget System ── */
  G.primaryGadget = null; // 'shield'|'repellent'|'orchard'|'droneyard'
  G.primaryGadgetState = {};
  G.foundGadgets = [];    // gadgets picked up from mine chambers
  G.gadgetChambers = [];  // [{r, c, gadgetType, revealed: bool}]
  G.gadgetSelectHover = -1; // which card is hovered on selection screen

  /* ── Unlockable Tool/Gadget System ── */
  G.unlockedTools = {};       // { drill: true, blastTool: true, ... }
  G.activeToolKey = null;     // currently selected tool key
  G.toolState = {};           // per-tool runtime state

  /* ── Upgrade Dialog (full-screen tree) ── */
  G.upgradeTreeLevels = {};   // { nodeId: currentLevel }
  G.effectiveLevelCache = null; // upgradeKey -> summed tree levels (null = rebuild)
  G.effectiveLevelSrc = null;   // the levels object the cache was built from
  G.upgradeDialogHover = null; // hovered node id
  G.stateBeforeUpgradeDialog = null; // state to restore when closing dialog

  /* ── Tooltip ── */
  const tooltip = {
    lines: [],
    x: 0,
    y: 0,
    visible: false,
    delayTimer: 0,
    anchor: null,     // optional {x, y, w, h} box to place the tooltip beside
    lastHoverKey: ''  // identity of what we are hovering; resets delay when it changes
  };
  const TOOLTIP_DELAY = 0.2; // seconds before tooltip appears

  /* ── Upgrade Dialog zoom & pan ── */
  G.upgradeZoom = 1.0;        // zoom scale factor
  G.upgradePanX = 0;          // pan offset X
  G.upgradePanY = 0;          // pan offset Y
  G.upgradeViewCustomized = false; // true once user manually zooms/pans
  G.upgradePanning = false;   // right-click drag active
  G.upgradePanStartX = 0;     // drag start mouse X
  G.upgradePanStartY = 0;     // drag start mouse Y
  G.upgradePanBaseX = 0;      // pan offset at drag start
  G.upgradePanBaseY = 0;      // pan offset at drag start
  const treeCam = { tz: 1, tx: 0, ty: 0, last: 0 }; // camera target the view eases towards
  G.treeTab = 'dome';         // 'all' or a branch id
  G.treeFocusId = null;       // keyboard-selected node
  G.treeLayout = null;        // cached node positions and branch regions
  G.treeNodeInfo = null;      // cached display names / chain positions
  const treePurchaseFlash = {}; // nodeId -> purchase time (ms) for the flash effect
  const quickPanelFlash = {};   // branch -> purchase time (ms) for the quick panel row flash
  G.quickPanelHover = null;   // hovered quick panel hit target

  const PRIMARY_GADGETS = [
    { key: 'shield', name: 'Shield Generator', icon: 'shield', desc: ['Absorbs the first hit of each night.', 'Recharges at nightfall.'] },
    { key: 'repellent', name: 'Repellent Field', icon: 'portal', desc: ['Press R: slows all enemies to 40%', 'for 5 seconds (30s cooldown).'] },
    { key: 'orchard', name: 'Orchard', icon: 'tree', desc: ['Every 20s grows a fruit that gives', '+30% mining speed for 10 seconds.'] },
    { key: 'droneyard', name: 'Droneyard', icon: 'drone', desc: ['Starts with a courier drone that hauls', 'your cargo home. All drones work 50% faster.'] }
  ];

  const MINE_GADGETS = ['autoCannon', 'stunLaser', 'blastMining', 'probeScanner', 'domeArmor', 'condenser'];
  const MINE_GADGET_NAMES = {
    autoCannon: 'Auto Cannon', stunLaser: 'Stun Laser', blastMining: 'Blast Mining',
    probeScanner: 'Probe Scanner', domeArmor: 'Dome Armor', condenser: 'Condenser'
  };

  const keys = {};

  /* ======================================================================
     CACHED ART
     ====================================================================== */

  G.tileArt = null; // cached underground textures (see buildTileArt)

  /* ======================================================================
     CANVAS SETUP
     ====================================================================== */

  // Backing-store pixels per logical (CANVAS_W x CANVAS_H) unit
  G.renderScale = 1;

  function setupCanvas() {
    // Fixed logical resolution, letterboxed into the client area so the
    // aspect ratio never distorts. The backing store matches the on-screen
    // size (times devicePixelRatio) so text and sprites stay sharp; every
    // frame starts with a scale transform. Mouse handlers translate
    // coordinates via CANVAS_W / rect.width, which still holds.
    const frame = canvas.parentElement;
    const fw = (frame && frame.clientWidth) || CANVAS_W;
    const fh = (frame && frame.clientHeight) || CANVAS_H;
    const fit = Math.min(fw / CANVAS_W, fh / CANVAS_H);
    const cssW = Math.max(1, Math.floor(CANVAS_W * fit));
    const cssH = Math.max(1, Math.floor(CANVAS_H * fit));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    G.renderScale = Math.max(0.25, Math.min(2, (cssW / CANVAS_W) * (window.devicePixelRatio || 1)));
    const bw = Math.round(CANVAS_W * G.renderScale);
    const bh = Math.round(CANVAS_H * G.renderScale);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
  }

  NS.gameState = { PICKAXE_SWING_DURATION, TUTORIAL_PAGES, TURRET_BARREL_LENGTH, TURRET_KEYBOARD_SPEED,
    pileByCell, tooltip, TOOLTIP_DELAY, treeCam, treePurchaseFlash, quickPanelFlash, PRIMARY_GADGETS,
    MINE_GADGETS, MINE_GADGET_NAMES, keys, setupCanvas };
})();
