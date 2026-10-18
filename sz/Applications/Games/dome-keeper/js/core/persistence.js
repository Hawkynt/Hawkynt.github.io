;(function() {
  'use strict';

  // Saving, validating, migrating and restoring a run; high scores; title-screen buttons.
  // Owns: NS.persistence and these state fields:
  //   G.autosaveTimer, G.saveAvailable, G.saveNotice, G.newGameConfirmOpen
  // Reads: constants, util, dom, rules, upgrades, gameState, mineGen, run, time, weather, relocation, waves,
  //   bombs, cargo, chests, artifacts, drones, biomes, app
  // Reads state of: gameState, time, weather, relocation, bombs, cargo, chests, artifacts, biomes

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, VIEW_SURFACE, VIEW_UNDERGROUND, STATE_READY, STATE_PLAYING, STATE_PAUSED,
    STATE_UPGRADE_DIALOG, STATE_CINEMATIC, STATE_CONFIRM, STATE_CRAFT, STATE_MINIGAME, STORAGE_PREFIX,
    STORAGE_HIGHSCORES, MAX_HIGH_SCORES, GRID_COLS, GRID_ROWS, TILE_SIZE, TILE_EMPTY, TILE_DIRT, TILE_CORE,
    TILE_CHEST, TILE_MAX } = NS.constants;
  const { makeRng } = NS.util;
  const { highScoresBody, floatingText } = NS.dom;
  const { RESOURCE_TILES, DOME_Y, TOOL_DEFS } = NS.rules;
  const { TREE_NODE_BY_ID, invalidateLevelCache, migrateTreeLevels, absorbLegacyUpgrades, applyStatUpgrade } = NS.upgrades;
  const { PRIMARY_GADGETS } = NS.gameState;

  /* ======================================================================
     PERSISTENCE
     ====================================================================== */

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      if (raw)
        G.highScores = JSON.parse(raw);
    } catch (_) {
      G.highScores = [];
    }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(G.highScores));
    } catch (_) {}
  }

  function addHighScore(waves, pts) {
    G.highScores.push({ waves, score: pts, sites: G.site.index + 1, days: G.world.day });
    G.highScores.sort((a, b) => b.score - a.score);
    if (G.highScores.length > MAX_HIGH_SCORES)
      G.highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < G.highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${G.highScores[i].waves}</td><td>${G.highScores[i].sites || 1}</td><td>${G.highScores[i].score}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!G.highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* -- Run save / resume (plain data only; objects are rebuilt on load) -- */
  const STORAGE_SAVE = STORAGE_PREFIX + '-save-v2';
  const STORAGE_SAVE_V1 = STORAGE_PREFIX + '-save-v1'; // older format, migrated on load
  const SAVE_VERSION = 2;
  const AUTOSAVE_INTERVAL = 5; // seconds of play between autosaves
  G.autosaveTimer = 0;
  G.saveAvailable = false;   // a resumable run is stored
  G.saveNotice = '';         // shown on the title screen (e.g. discarded save)
  G.newGameConfirmOpen = false;

  function isRunActive() {
    return G.primaryGadget !== null && (G.state === STATE_PLAYING || G.state === STATE_PAUSED || G.state === STATE_UPGRADE_DIALOG || G.state === STATE_CINEMATIC || G.state === STATE_CONFIRM || G.state === STATE_CRAFT || G.state === STATE_MINIGAME);
  }

  function saveRun() {
    if (!isRunActive()) return;
    const partialHP = [];
    for (let r = 0; r < GRID_ROWS; ++r)
      for (let c = 0; c < GRID_COLS; ++c)
        if (G.tileMaxHP[r] && G.tileMaxHP[r][c] > 0 && G.tileHP[r][c] < G.tileMaxHP[r][c])
          partialHP.push([r, c, Math.round(G.tileHP[r][c] * 1000) / 1000]);
    const data = {
      version: SAVE_VERSION,
      view: G.transitionTarget || G.currentView,
      domeHP: G.domeHP, maxDomeHP: G.maxDomeHP, carried: G.carried, carryCapacity: G.carryCapacity, bag: G.bag,
      weaponDamage: G.weaponDamage, fireRate: G.fireRate, drillSpeed: G.drillSpeed, moveStepInterval: G.moveStepInterval,
      drillX: G.drillX, drillY: G.drillY, turretAngle: G.turretAngle,
      resources: G.resources, upgradeTreeLevels: G.upgradeTreeLevels,
      waveNumber: G.waveNumber, siteNights: G.siteNights, waveTimer: NS.time.secondsToNight(), waveActive: G.waveActive, score: G.score,
      world: { day: G.world.day, t: G.world.t, bursts: G.world.bursts, warned: G.world.warned },
      weather: { kind: G.weather.kind, timeLeft: G.weather.timeLeft }, snowCover: G.snowCover,
      meteorOre: G.meteorOre.map(o => ({ x: o.x, y: o.y, type: o.type, amount: o.amount })),
      enemies: G.enemies,
      grid: G.undergroundGrid.map(row => row.map(t => String.fromCharCode(48 + t)).join('')),
      partialHP,
      droppedResources: G.droppedResources.map(p => ({ col: p.col, row: p.row, items: Object.assign({}, p.items), age: Math.round(p.age * 10) / 10 }))
        .concat(G.flyingOre.map(f => ({ col: G.drillX, row: G.drillY, items: Object.assign({}, f.items), age: 0 }))),
      primaryGadget: G.primaryGadget, primaryGadgetState: G.primaryGadgetState, foundGadgets: G.foundGadgets, gadgetChambers: G.gadgetChambers,
      unlockedTools: G.unlockedTools, activeToolKey: G.activeToolKey, toolState: G.toolState,
      site: G.site, relocationCore: G.relocationCore, landing: G.landingPending,
      artifacts: G.artifacts.slice(),
      artifactState: { aegis: Math.round(G.artifactState.aegis), charmDawns: G.artifactState.charmDawns, phoenixUsed: G.artifactState.phoenixUsed },
      chests: G.chests.map(ch => ({ r: ch.r, c: ch.c, band: ch.band, kind: ch.kind, revealed: ch.revealed, opened: ch.opened, cooldown: Math.round(ch.cooldown) })),
      bombs: { inv: G.bombInv, sel: G.bombSel, placed: G.placedBombs.map(b => ({ r: b.r, c: b.c, tier: b.tier, fuse: Math.round(b.fuse * 100) / 100, maxFuse: b.maxFuse, sticky: !!b.sticky })) }
    };
    try {
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(data));
      G.saveAvailable = true;
    } catch (_) {}
  }

  function clearSave() {
    G.saveAvailable = false;
    try {
      localStorage.removeItem(STORAGE_SAVE);
      localStorage.removeItem(STORAGE_SAVE_V1);
    } catch (_) {}
  }

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  // Read and validate the stored run; a broken or outdated save is discarded with a notice
  // A version 1 run keeps its upgrades, gadgets, resources and score; its
  // smaller mine cannot be carried over, so the site is generated anew
  function migrateV1Save(d) {
    if (!isPlainObject(d) || d.version !== 1)
      throw new Error('not a version 1 save');
    d.version = SAVE_VERSION;
    d.migratedFrom = 1;
    d.mineOutdated = true;
    d.view = VIEW_SURFACE;
    d.enemies = [];
    d.waveActive = false;
    d.partialHP = [];
    d.droppedResources = [];
    d.gadgetChambers = [];
    if (!isNum(d.drillX)) d.drillX = 0;
    if (!isNum(d.drillY)) d.drillY = 0;
    return d;
  }

  function readSavedRun() {
    let raw = null, legacy = false;
    try {
      raw = localStorage.getItem(STORAGE_SAVE);
      if (!raw) {
        raw = localStorage.getItem(STORAGE_SAVE_V1);
        legacy = !!raw;
      }
    } catch (_) { return null; }
    if (!raw)
      return null;
    try {
      let d = JSON.parse(raw);
      if (legacy)
        d = migrateV1Save(d);
      if (!isPlainObject(d) || d.version !== SAVE_VERSION)
        throw new Error('unsupported save version');
      for (const k of ['domeHP', 'maxDomeHP', 'carried', 'carryCapacity', 'weaponDamage', 'fireRate', 'drillSpeed', 'moveStepInterval', 'drillX', 'drillY', 'turretAngle', 'waveNumber', 'waveTimer', 'score'])
        if (!isNum(d[k]))
          throw new Error('bad ' + k);
      if (!Array.isArray(d.grid))
        throw new Error('bad grid');
      // A mine of another size (older version) is rebuilt; the run itself is kept
      d.mineOutdated = d.grid.length !== GRID_ROWS || d.grid.some(row => typeof row !== 'string' || row.length !== GRID_COLS);
      if (!d.mineOutdated) {
        for (const row of d.grid)
          for (let c = 0; c < row.length; ++c) {
            const t = row.charCodeAt(c) - 48;
            if (t < TILE_EMPTY || t > TILE_MAX)
              throw new Error('bad tile');
          }
        if (d.drillX < 0 || d.drillX >= GRID_COLS || d.drillY < 0 || d.drillY >= GRID_ROWS)
          throw new Error('bad position');
      }
      if (!PRIMARY_GADGETS.some(g => g.key === d.primaryGadget))
        throw new Error('bad gadget');
      for (const k of ['resources', 'upgradeTreeLevels', 'primaryGadgetState', 'unlockedTools', 'toolState'])
        if (!isPlainObject(d[k]))
          throw new Error('bad ' + k);
      for (const k of ['enemies', 'partialHP', 'droppedResources', 'foundGadgets', 'gadgetChambers'])
        if (!Array.isArray(d[k]))
          throw new Error('bad ' + k);
      for (const k in d.resources)
        if (!isNum(d.resources[k]))
          throw new Error('bad resource');
      for (const e of d.enemies)
        if (!isPlainObject(e) || !isNum(e.x) || !isNum(e.y) || !isNum(e.hp) || !isNum(e.maxHP))
          throw new Error('bad enemy');
      for (const ch of d.gadgetChambers)
        if (!isPlainObject(ch) || !isNum(ch.r) || !isNum(ch.c))
          throw new Error('bad chamber');
      // Piles: { col, row, items } (one per cell) or the older { col, row, type, value }
      for (const dr of d.droppedResources)
        if (!isPlainObject(dr) || !isNum(dr.col) || !isNum(dr.row) || !(isNum(dr.value) || isPlainObject(dr.items)))
          throw new Error('bad drop');
      return d;
    } catch (_) {
      clearSave();
      G.saveNotice = 'The saved run could not be read and was discarded.';
      return null;
    }
  }

  function restoreRun(d) {
    NS.run.resetGame(); // fresh defaults for everything not stored
    if (isPlainObject(d.site) && isNum(d.site.seed) && NS.biomes.BIOMES[d.site.biome])
      G.site = { index: Math.max(0, Math.floor(isNum(d.site.index) ? d.site.index : 0)), seed: d.site.seed | 0, biome: d.site.biome };
    if (d.mineOutdated)
      NS.mineGen.generateUnderground(makeRng(G.site.seed));
    else {
      // The core lives in the grid; older saves get it placed now
      const rc = d.relocationCore;
      if (isPlainObject(rc) && isNum(rc.r) && isNum(rc.c))
        G.relocationCore = { r: rc.r | 0, c: rc.c | 0, revealed: !!rc.revealed, found: !!rc.found };
      G.undergroundGrid = d.grid.map(row => Array.from(row, ch => ch.charCodeAt(0) - 48));
      G.gadgetChambers = d.gadgetChambers
        .filter(ch => ch.r >= 0 && ch.r < GRID_ROWS - 1 && ch.c >= 0 && ch.c < GRID_COLS - 1)
        .map(ch => ({ r: ch.r, c: ch.c, gadgetType: ch.gadgetType, revealed: !!ch.revealed }));
      if (!G.relocationCore.found && !d.grid.some(row => row.indexOf(String.fromCharCode(48 + TILE_CORE)) >= 0))
        NS.relocation.placeRelocationCore(makeRng(G.site.seed ^ 0x5eed));
      restoreChests(d);
      NS.mineGen.initTileHP();
      for (const p of d.partialHP)
        if (Array.isArray(p) && G.tileHP[p[0]] && isNum(p[2]) && G.tileMaxHP[p[0]][p[1]] > 0)
          G.tileHP[p[0]][p[1]] = Math.max(0, Math.min(G.tileMaxHP[p[0]][p[1]], p[2]));
    }

    G.domeHP = d.domeHP;
    G.maxDomeHP = d.maxDomeHP;
    // Older saves only kept a number; that ore is in the wallet already, so the bag starts empty
    G.bag = {};
    if (isPlainObject(d.bag))
      for (const k in d.bag)
        if (k in G.resources && isNum(d.bag[k]) && d.bag[k] >= 1)
          G.bag[k] = Math.floor(d.bag[k]);
    G.carried = 0;
    G.carryCapacity = d.carryCapacity;
    G.weaponDamage = d.weaponDamage;
    G.fireRate = d.fireRate;
    G.drillSpeed = d.drillSpeed;
    G.moveStepInterval = d.moveStepInterval;
    if (!d.mineOutdated) {
      G.drillX = d.drillX;
      G.drillY = d.drillY;
    }
    G.turretAngle = d.turretAngle;
    Object.assign(G.resources, d.resources);
    Object.assign(G.upgradeTreeLevels, migrateTreeLevels(Object.assign({}, d.upgradeTreeLevels)));
    invalidateLevelCache();
    if (isPlainObject(d.upgradeLevels))
      absorbLegacyUpgrades(d.upgradeLevels);
    // The bag follows its upgrade level (the stored number may stem from older rules)
    applyStatUpgrade('carryCapacity');
    G.carried = NS.cargo.bagSlots();
    G.waveNumber = d.waveNumber;
    G.waveTimer = d.waveTimer;
    G.waveActive = !!d.waveActive;
    G.siteNights = isNum(d.siteNights) ? Math.max(0, Math.floor(d.siteNights)) : G.waveNumber;
    if (isPlainObject(d.world) && isNum(d.world.day) && isNum(d.world.t))
      G.world = { day: Math.max(1, Math.floor(d.world.day)), t: Math.max(0, Math.min(0.999, d.world.t)), bursts: Math.max(0, Math.min(3, d.world.bursts | 0)), warned: !!d.world.warned };
    else {
      // Older saves: one day per survived wave, morning of the next
      G.world = NS.time.newWorld();
      G.world.day = Math.max(1, Math.floor(d.waveNumber) + 1);
    }
    NS.time.computeSkyLight();
    G.score = d.score;
    // Older saves only knew walkers, armoured walkers, bosses and flyers
    G.enemies = d.enemies.map(e => {
      const o = Object.assign({}, e);
      if (!NS.waves.ENEMY_TYPES[o.type])
        o.type = o.boss ? 'behemoth' : (o.type === 'flyer' ? 'flyer' : (o.armored ? 'crawler' : 'walker'));
      if (!isNum(o.size)) o.size = 20;
      if (!isNum(o.speed)) o.speed = 20;
      if (!isNum(o.damage)) o.damage = 2;
      o.phase = o.phase || 'approach';
      o.t = isNum(o.t) ? o.t : 0;
      return o;
    });
    NS.cargo.clearPiles();
    if (!d.mineOutdated)
      for (const dr of d.droppedResources) {
        const col = dr.col | 0, row = dr.row | 0;
        if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) continue;
        let pile = null;
        if (isPlainObject(dr.items)) {
          for (const t in dr.items)
            if (RESOURCE_TILES.includes(+t) && isNum(dr.items[t]) && dr.items[t] >= 1)
              pile = NS.cargo.addPileOre(col, row, +t, Math.floor(dr.items[t]));
        } else if (RESOURCE_TILES.includes(dr.type) && dr.value >= 1)
          pile = NS.cargo.addPileOre(col, row, dr.type, Math.floor(dr.value));
        if (pile && isNum(dr.age))
          pile.age = Math.max(pile.age, Math.max(0, dr.age));
      }
    G.primaryGadget = d.primaryGadget;
    G.primaryGadgetState = Object.assign({}, d.primaryGadgetState);
    G.foundGadgets = d.foundGadgets.filter(g => typeof g === 'string');
    G.unlockedTools = Object.assign({}, d.unlockedTools);
    // Tools bought on the old tools panel are the same nodes in the tree
    for (const t of TOOL_DEFS)
      if (G.unlockedTools[t.key] && TREE_NODE_BY_ID[t.key])
        G.upgradeTreeLevels[t.key] = TREE_NODE_BY_ID[t.key].maxLevel;
    invalidateLevelCache();
    G.activeToolKey = typeof d.activeToolKey === 'string' ? d.activeToolKey : null;
    Object.assign(G.toolState, d.toolState);
    restoreBombs(d);
    if (Array.isArray(d.artifacts))
      G.artifacts = d.artifacts.filter((id, i, a) => typeof id === 'string' && NS.artifacts.ARTIFACT_BY_ID[id] && a.indexOf(id) === i);
    if (isPlainObject(d.artifactState)) {
      const as = d.artifactState;
      G.artifactState.aegis = isNum(as.aegis) ? Math.max(0, Math.min(NS.artifacts.aegisMax(), as.aegis)) : 0;
      G.artifactState.charmDawns = isNum(as.charmDawns) ? Math.max(0, Math.floor(as.charmDawns)) : 0;
      G.artifactState.phoenixUsed = !!as.phoenixUsed;
    }

    G.currentView = d.view === VIEW_UNDERGROUND && !d.mineOutdated ? VIEW_UNDERGROUND : VIEW_SURFACE;
    if (isPlainObject(d.weather) && NS.weather.WEATHER[d.weather.kind] && isNum(d.weather.timeLeft))
      G.weather = { kind: d.weather.kind, intensity: 1, timeLeft: Math.max(1, d.weather.timeLeft) };
    if (isNum(d.snowCover))
      G.snowCover = Math.max(0, Math.min(1, d.snowCover));
    if (Array.isArray(d.meteorOre))
      G.meteorOre = d.meteorOre.filter(o => isPlainObject(o) && isNum(o.x) && isNum(o.amount) && typeof o.type === 'string' && o.type in G.resources)
        .slice(0, 14).map(o => ({ x: o.x, y: DOME_Y + 10, type: o.type, amount: o.amount, age: 0 }));
    NS.drones.syncDrones();
    if (G.currentView === VIEW_UNDERGROUND) {
      G.cameraX = Math.max(0, Math.min(GRID_COLS * TILE_SIZE - CANVAS_W, G.drillX * TILE_SIZE - CANVAS_W / 2 + TILE_SIZE / 2));
      G.cameraY = Math.max(0, Math.min(GRID_ROWS * TILE_SIZE - CANVAS_H, G.drillY * TILE_SIZE - CANVAS_H / 2 + TILE_SIZE / 2));
    }
    G.autosaveTimer = 0;
    G.state = STATE_PLAYING;
    // Saved on the way to a site: finish the landing
    if (d.landing) {
      G.landingPending = true;
      NS.relocation.startCinematic('arrive');
    }
    NS.app.updateWindowTitle();
  }

  // Secret chests of the site; saves from before chests get theirs hidden now
  function restoreChests(d) {
    if (!Array.isArray(d.chests)) {
      NS.chests.placeSecretChests(makeRng(NS.chests.chestSeed()));
      return;
    }
    G.chests = d.chests
      .filter(ch => isPlainObject(ch) && isNum(ch.r) && isNum(ch.c) && ch.r >= 0 && ch.r < GRID_ROWS && ch.c >= 0 && ch.c < GRID_COLS)
      .slice(0, NS.chests.CHEST_BANDS.length)
      .map((ch, i) => ({
        r: ch.r | 0, c: ch.c | 0, band: isNum(ch.band) ? Math.max(0, Math.min(2, ch.band | 0)) : i,
        kind: NS.chests.MINIGAME_KINDS.includes(ch.kind) ? ch.kind : NS.chests.MINIGAME_KINDS[i % 3],
        revealed: !!ch.revealed, opened: !!ch.opened, cooldown: isNum(ch.cooldown) ? Math.max(0, Math.min(NS.chests.CHEST_RETRY, ch.cooldown)) : 0
      }));
    // The grid and the list agree: unopened chests sit in the rock
    for (const ch of G.chests)
      if (!ch.opened)
        G.undergroundGrid[ch.r][ch.c] = TILE_CHEST;
    for (let r = 0; r < GRID_ROWS; ++r)
      for (let c = 0; c < GRID_COLS; ++c)
        if (G.undergroundGrid[r][c] === TILE_CHEST && !NS.chests.chestAt(r, c))
          G.undergroundGrid[r][c] = TILE_DIRT;
  }

  // Bomb stock and the bombs lying in the mine; blast charges of older saves become bombs
  function restoreBombs(d) {
    const b = d.bombs;
    if (isPlainObject(b)) {
      if (Array.isArray(b.inv))
        G.bombInv = NS.bombs.BOMB_TIERS.map((_, i) => Math.max(0, Math.min(99, Math.floor(Number(b.inv[i]) || 0))));
      if (isNum(b.sel))
        G.bombSel = Math.max(0, Math.min(NS.bombs.BOMB_TIERS.length - 1, Math.floor(b.sel)));
      if (Array.isArray(b.placed) && !d.mineOutdated)
        G.placedBombs = b.placed
          .filter(x => isPlainObject(x) && isNum(x.r) && isNum(x.c) && isNum(x.tier) && isNum(x.fuse) && x.r >= 0 && x.r < GRID_ROWS && x.c >= 0 && x.c < GRID_COLS && NS.bombs.BOMB_TIERS[x.tier | 0])
          .slice(0, 40)
          .map(x => ({ r: x.r | 0, c: x.c | 0, tier: x.tier | 0, fuse: Math.max(0.3, Math.min(10, x.fuse)), maxFuse: isNum(x.maxFuse) ? Math.max(1, x.maxFuse) : NS.bombs.BOMB_BASE_FUSE, sticky: !!x.sticky, fly: null }));
    }
    const charges = G.primaryGadgetState.blastCharges;
    if (isNum(charges) && charges > 0)
      G.bombInv[1] += Math.min(99, Math.floor(charges));
    delete G.primaryGadgetState.blastCharges;
  }

  function continueRun() {
    const d = readSavedRun();
    if (!d)
      return;
    try {
      restoreRun(d);
      G.saveNotice = '';
      if (d.migratedFrom) {
        saveRun();
        try { localStorage.removeItem(STORAGE_SAVE_V1); } catch (_) {}
        floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 110, 'Saved run updated: your dome landed on a fresh, deeper site', { color: '#ffd75a', font: 'bold 24px sans-serif' });
      }
      SZ.GameAudio.play('select');
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `Run resumed -- Wave ${G.waveNumber}`, { color: '#4af', font: 'bold 32px sans-serif' });
    } catch (_) {
      clearSave();
      G.primaryGadget = null;
      G.state = STATE_READY;
      G.saveNotice = 'The saved run could not be restored and was discarded.';
    }
  }

  function startNewRun() {
    clearSave();
    G.saveNotice = '';
    NS.run.resetGame();
  }

  // New Game: ask before throwing away a stored run
  function requestNewGame() {
    if (G.newGameConfirmOpen)
      return;
    if (!G.saveAvailable) {
      startNewRun();
      return;
    }
    if (G.state === STATE_PLAYING)
      G.state = STATE_PAUSED;
    saveRun();
    G.newGameConfirmOpen = true;
    // The shared click wiring hides the inner box too; make sure it shows again
    const box = document.querySelector('#dlg-new-game .dialog');
    if (box)
      box.hidden = false;
    SZ.Dialog.show('dlg-new-game').then((result) => {
      G.newGameConfirmOpen = false;
      if (result === 'yes')
        startNewRun();
    });
  }

  // Title-screen buttons shown when a saved run exists
  function getTitleButtons() {
    const w = 360, h = 60, x = CANVAS_W / 2 - w / 2;
    return [
      { id: 'continue', label: 'Continue', x, y: CANVAS_H / 2 + 10, w, h },
      { id: 'new', label: 'New Game', x, y: CANVAS_H / 2 + 90, w, h }
    ];
  }

  function hitTitleButton(mx, my) {
    for (const b of getTitleButtons())
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h)
        return b.id;
    return null;
  }

  NS.persistence = { loadHighScores, saveHighScores, addHighScore, renderHighScores, AUTOSAVE_INTERVAL,
    saveRun, clearSave, readSavedRun, continueRun, startNewRun, requestNewGame, getTitleButtons,
    hitTitleButton };
})();
