;(function() {
  'use strict';

  // Starting and resetting a run, the gadget choice and the surface / underground view transition.
  // Owns: NS.run and these state fields:
  //   G.transitionPhase
  // Reads: constants, util, dom, rules, upgradeData, upgrades, mineGen, time, relocation, mining, cargo,
  //   artifacts, drones, biomes, tooltip, app
  // Reads state of: gameState, time, weather, relocation, waves, weapon, bombs, artifacts, drones, biomes

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, VIEW_SURFACE, VIEW_UNDERGROUND, STATE_GADGET_SELECT, STATE_PLAYING, GRID_COLS,
    GRID_ROWS, TILE_SIZE } = NS.constants;
  const { makeRng } = NS.util;
  const { floatingText } = NS.dom;
  const { emptyResources, BASE_DOME_HP, BASE_WEAPON_DAMAGE, BASE_FIRE_RATE, BASE_DRILL_SPEED,
    BASE_CARRY_CAPACITY, BASE_MOVE_INTERVAL } = NS.rules;
  const { UPGRADE_TREE } = NS.upgradeData;
  const { invalidateLevelCache } = NS.upgrades;
  const { generateUnderground } = NS.mineGen;

  /* ======================================================================
     GAME INIT / RESET
     ====================================================================== */

  function resetGame() {
    G.state = STATE_GADGET_SELECT;
    G.currentView = VIEW_SURFACE;
    G.transitionProgress = 0;
    G.transitionTarget = null;
    G.transitionPhase = 'none';

    G.domeHP = BASE_DOME_HP;
    G.maxDomeHP = BASE_DOME_HP;
    G.resources = emptyResources();
    G.bag = {};
    G.carried = 0;
    G.carryCapacity = BASE_CARRY_CAPACITY;

    G.weaponDamage = BASE_WEAPON_DAMAGE;
    G.fireRate = BASE_FIRE_RATE;
    G.fireCooldown = 0;
    G.projectiles = [];
    G.turretAngle = -Math.PI / 2;
    G.mouseAimX = -1;
    G.mouseAimY = -1;

    G.drillSpeed = BASE_DRILL_SPEED;
    G.drillX = Math.floor(GRID_COLS / 2);
    G.drillY = 0;
    G.drillTimer = 0;
    G.cameraX = 0;
    G.cameraY = 0;

    G.enemies = [];
    G.waveNumber = 0;
    G.siteNights = 0;
    G.waveTimer = 0;
    G.waveActive = false;
    G.world = NS.time.newWorld();
    G.banners = [];
    NS.time.computeSkyLight();
    G.weather = { kind: 'clear', intensity: 1, timeLeft: 50 };
    G.snowCover = 0;
    G.enemyShots = [];
    G.shockwaves = [];
    G.domeInvulnerable = 0;
    G.emergencyCooldown = 0;
    G.lastStandUsed = false;
    G.keeperIdle = 0;
    G.dashCooldown = 0;
    G.rainDrops = [];
    G.snowFlakes = [];
    G.leaves = [];
    G.meteors = [];
    G.bolts = [];
    G.meteorOre = [];
    G.score = 0;

    // Reset navigation state
    G.moveTarget = null;
    G.movePath = null;
    G.movePathIndex = 0;
    G.moveStepTimer = 0;
    G.mineTarget = null;
    G.moveStepInterval = BASE_MOVE_INTERVAL;

    // Reset mining state
    G.miningProgress = 0;
    G.miningDuration = 0;
    G.miningTarget = null;
    G.miningDir = null;

    // Reset persistent tile HP (will be re-initialized in generateUnderground)
    G.tileHP = [];
    G.tileMaxHP = [];

    // Reset dropped resources
    NS.cargo.clearPiles();

    // Reset animation state
    G.animTime = 0;
    G.pickaxeAngle = 0;
    G.pickaxeSwinging = false;
    G.pickaxeSwingTimer = 0;
    G.domePulsePhase = 0;
    G.domeHitFlash = 0;
    G.playerBob = 0;
    G.crumbleEffects = [];
    G.dustClouds = [];
    G.resourceGlows = [];
    G.shieldImpacts = [];
    G.tileSparkleTimer = 0;

    // Reset gadget state (clear auto-laser visuals so they never persist into a new game)
    G.primaryGadget = null;
    G.primaryGadgetState = {};
    G.foundGadgets = [];

    // Combat skill
    G.combo = 0;
    G.comboTimer = 0;
    G.bestCombo = 0;
    G.charge = null;
    G.parryT = G.parryCd = G.hitstop = G.screenFlash = 0;
    G.reflected = [];

    // Artifacts
    G.artifacts = [];
    G.artifactState = NS.artifacts.newArtifactState();
    G.stormArcs = [];

    // Bombs
    G.bombInv = [0, 0, 0, 0, 0];
    G.bombSel = 0;
    G.placedBombs = [];
    G.surfaceBombs = [];
    G.pendingBlasts = [];
    G.blasts = [];
    G.bombThrowMode = false;
    G.keeperStun = 0;
    G.stateBeforeCraft = null;

    // Drones are rebuilt from the upgrades
    G.drones = [];
    G.gunDrones = [];
    G.repairBots = [];

    // Reset tool/gadget state
    G.unlockedTools = {};
    G.activeToolKey = null;
    G.toolState = {
      drillLastCol: -1,          // last column mined for drill combo
      drillConsecutive: 0,       // consecutive same-column mines
      blastToolCooldown: 0,      // cooldown timer for blast tool
      scannerActive: false,      // whether scanner is passively active
      teleporterCooldown: 0,     // cooldown timer for teleporter
      autoRepairTimer: 0,        // auto-repair interval timer
      jetpackCooldown: 0,        // jetpack cooldown timer
      phaseShiftCooldown: 0,     // phase shift cooldown timer
      echoLocationActive: false  // echo location passive
    };
    G.gadgetSelectHover = -1;

    // Reset upgrade tree
    G.upgradeTreeLevels = {};
    for (const node of UPGRADE_TREE)
      G.upgradeTreeLevels[node.id] = 0;
    invalidateLevelCache();
    G.upgradeDialogHover = null;
    G.stateBeforeUpgradeDialog = null;
    G.upgradeZoom = 1.0;
    G.upgradePanX = 0;
    G.upgradePanY = 0;
    G.upgradePanning = false;
    G.upgradeViewCustomized = false;
    G.treeFocusId = null;

    // Reset tooltip
    NS.tooltip.clearTooltip();

    // A new run lands on a fresh site
    G.cinematic = null;
    G.landingPending = false;
    G.site = NS.biomes.newSite(0, (Math.random() * 0x7fffffff) | 0);
    generateUnderground(makeRng(G.site.seed));
    NS.app.updateWindowTitle();
  }

  function startGameAfterGadgetSelect() {
    SZ.GameAudio.play('select');
    initPrimaryGadgetState();
    NS.drones.syncDrones();
    // Every run begins with the dome landing on its first site
    G.landingPending = true;
    NS.relocation.startCinematic('arrive');
  }

  function initPrimaryGadgetState() {
    switch (G.primaryGadget) {
      case 'shield':
        G.primaryGadgetState = { active: true };
        break;
      case 'repellent':
        G.primaryGadgetState = { active: false, duration: 0, cooldown: 0 };
        break;
      case 'orchard':
        G.primaryGadgetState = { fruitTimer: 20, fruitReady: false, speedBoostTimer: 0 };
        break;
      case 'droneyard':
        G.primaryGadgetState = {};
        break;
    }
  }

  /* ======================================================================
     VIEW TRANSITION
     ====================================================================== */

  const TRANSITION_DURATION = 0.6; // seconds for a full view switch
  G.transitionPhase = 'none';    // 'none' | 'fade-out' | 'fade-in'

  function toggleView() {
    if (G.state !== STATE_PLAYING) return;
    if (G.transitionPhase !== 'none') return;

    G.transitionTarget = G.currentView === VIEW_SURFACE ? VIEW_UNDERGROUND : VIEW_SURFACE;
    G.transitionProgress = 0;
    G.transitionPhase = 'fade-out';
    NS.tooltip.clearTooltip();
    G.quickPanelHover = null;

    // Cancel any active mining when switching views
    NS.mining.cancelMining();
    SZ.GameAudio.play('whoosh', { pitch: G.transitionTarget === VIEW_SURFACE ? 1.3 : 0.8 });

    if (G.transitionTarget === VIEW_SURFACE)
      NS.cargo.landAllFlyingOre();
    if (G.transitionTarget === VIEW_SURFACE && G.carried > 0) {
      const total = NS.cargo.bagTotal();
      SZ.GameAudio.play('coin');
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, `+${total} resources deposited`, { color: '#0f0', font: 'bold 28px sans-serif' });
      NS.artifacts.depositScore(total, CANVAS_W / 2, CANVAS_H / 2 + 40);
      G.bag = {};
      G.carried = 0;
    }
  }

  function updateTransition(dt) {
    if (G.transitionPhase === 'none') return;

    const speed = 1 / (TRANSITION_DURATION / 2); // each half takes TRANSITION_DURATION/2
    G.transitionProgress += dt * speed;

    if (G.transitionPhase === 'fade-out' && G.transitionProgress >= 1) {
      // Midpoint: switch the actual view
      G.transitionProgress = 1;
      G.currentView = G.transitionTarget;
      G.transitionPhase = 'fade-in';

      // Snap camera to player when entering underground
      if (G.currentView !== VIEW_SURFACE) {
        const targetCamX = G.drillX * TILE_SIZE - CANVAS_W / 2 + TILE_SIZE / 2;
        const targetCamY = G.drillY * TILE_SIZE - CANVAS_H / 2 + TILE_SIZE / 2;
        const maxCamX = GRID_COLS * TILE_SIZE - CANVAS_W;
        const maxCamY = GRID_ROWS * TILE_SIZE - CANVAS_H;
        G.cameraX = Math.max(0, Math.min(maxCamX, targetCamX));
        G.cameraY = Math.max(0, Math.min(maxCamY, targetCamY));

        // Auto-collect loose resources at or near the player position
        NS.cargo.attractPiles(1);
      }
    } else if (G.transitionPhase === 'fade-in' && G.transitionProgress >= 2) {
      // Done
      G.transitionProgress = 0;
      G.transitionPhase = 'none';
      G.transitionTarget = null;
    }
  }

  function getTransitionAlpha() {
    if (G.transitionPhase === 'none') return 1;
    if (G.transitionPhase === 'fade-out')
      return 1 - G.transitionProgress; // 1 -> 0
    // fade-in: transitionProgress goes from 1 -> 2
    return G.transitionProgress - 1; // 0 -> 1
  }

  NS.run = { resetGame, startGameAfterGadgetSelect, initPrimaryGadgetState, toggleView, updateTransition,
    getTransitionAlpha };
})();
