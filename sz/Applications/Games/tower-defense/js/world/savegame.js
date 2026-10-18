/* world/savegame.js -- the saved game: autosave, serializing, reading, the format-1 migration and continuing a run.
   Owns state: G.autosaveTimer, G.savedGameInfo, G.saveNotice
   Reads: constants, towerTypes, enemyTypes, maps, env, abilities, paths, towers, waves, combat, projectiles,
      simulation, actions and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { MAX_TIER, BRANCH_TIER, STATE_PLAYING, STATE_PAUSED, STATE_BUILD, STATE_RESEARCH, STORAGE_SAVE_V1,
      STORAGE_SAVE, isFiniteNumber, num, clamp } = NS.constants;
  const { TOWER_TYPES, TOWER_BY_ID, TIER_COST, TARGET_MODES } = NS.towerTypes;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { MAPS } = NS.maps;
  const { updateWindowTitle } = NS.env;
  const { abilityCd } = NS.abilities;
  const { enemyPath, pathPos, loadMap } = NS.paths;
  const { canBuildAt, makeTower } = NS.towers;
  const { isQueueToken, spawnEnemy } = NS.waves;
  const { startLives } = NS.combat;
  const { addFloorEffect } = NS.projectiles;
  const { GAME_SPEEDS } = NS.simulation;

  const SAVE_VERSION = 2;
  const ENEMY_SAVE_FIELDS = ['hp', 'maxHp', 'speed', 'bounty', 'radius', 'armor', 'dist', 'slowMul', 'slowTimer', 'freezeTimer', 'stunTimer', 'phase',
    'burnDps', 'burnTimer', 'poisonTimer', 'acidTimer', 'shred', 'shieldHp', 'shieldMax', 'healCooldown', 'abilityTimer', 'revealTimer'];

  function isInGameState() {
    return G.state === STATE_PLAYING || G.state === STATE_BUILD || G.state === STATE_PAUSED;
  }

  // A map is running: in play, or paused behind the research tree
  function runIsOpen() {
    return isInGameState() || (G.state === STATE_RESEARCH && (G.treeReturn === STATE_PLAYING || G.treeReturn === STATE_BUILD || G.treeReturn === STATE_PAUSED));
  }

  function serializeGame() {
    const st = G.state === STATE_RESEARCH ? G.treeReturn : G.state;
    return {
      version: SAVE_VERSION,
      map: G.currentMap,
      cleared: G.cleared,
      gold: G.gold, lives: G.lives, runStartLives: G.runStartLives,
      wave: G.currentWave,
      phase: st === STATE_BUILD || (st === STATE_PAUSED && G.pausedFrom === STATE_BUILD) ? 'build' : 'wave',
      gameSpeed: G.gameSpeed, autoWaveMode: G.autoWaveMode, autoWaveTimer: G.autoWaveTimer,
      waveComplete: G.waveComplete, waveCountdown: G.waveCountdown, spawnTimer: G.spawnTimer, waveSize: G.waveSize, lastPaidWave: G.lastPaidWave,
      abilities: { strike: abilityCd.strike, freeze: abilityCd.freeze, rush: abilityCd.rush, rushTimer: G.rushTimer },
      waveEnemies: G.waveEnemies.slice(),
      stats: { kills: G.runStats.kills, gold: G.runStats.gold, leaked: G.runStats.leaked, rp: G.runStats.rp || 0 },
      towers: G.towers.map(t => ({
        col: t.col, row: t.row, type: TOWER_TYPES[t.type].id, tier: t.tier, branch: t.branch,
        target: t.target, kills: t.kills, dealt: Math.round(t.dealt), hp: t.hp, maxHp: t.maxHp,
        spent: t.spent, builtWave: t.builtWave
      })),
      floor: G.floorEffects.map(fe => ({ col: fe.col, row: fe.row, type: fe.type, timer: fe.timer, damage: fe.damage })),
      enemies: G.enemies.filter(e => e.hp > 0).map(e => {
        const o = { type: e.type, pi: e.pi, elite: !!e.elite, enraged: !!e.enraged };
        for (const k of ENEMY_SAVE_FIELDS)
          o[k] = e[k];
        return o;
      })
    };
  }

  function saveGame() {
    if (!runIsOpen())
      return;
    try {
      const data = serializeGame();
      localStorage.setItem(STORAGE_SAVE, JSON.stringify(data));
      G.savedGameInfo = { map: data.map, wave: data.wave, waves: MAPS[data.map].waves };
    } catch (_) {}
    G.autosaveTimer = 0;
  }

  function clearSavedGame() {
    try {
      localStorage.removeItem(STORAGE_SAVE);
      localStorage.removeItem(STORAGE_SAVE_V1);
    } catch (_) {}
    G.savedGameInfo = null;
  }

  /* ── Format 1 conversion ── */

  // Format 1 tower types, in their old order, mapped to today's families
  const V1_TOWERS = ['arrow', 'cannon', 'frost', 'tesla', 'laser', 'poison', 'tesla', 'cannon', 'flame', 'frost', 'flame', 'tesla', 'sniper', 'spikes'];
  // Number of path tiles of each map in format 1 (enemy progress is kept as a share of it)
  const V1_PATH_TILES = [43, 49, 129, 49, 25, 45, 85, 65, 41, 57, 37, 25];

  function tierSpent(def, tier) {
    let spent = def.cost;
    for (let n = 2; n <= tier; ++n)
      spent += Math.round(def.cost * TIER_COST[n] / 5) * 5;
    return spent;
  }

  function migrateV1(d) {
    if (!d || d.version !== 1 || !Number.isInteger(d.map) || d.map < 0 || d.map >= MAPS.length)
      throw new Error('v1');
    const out = {
      version: 2, map: d.map, gold: num(d.gold, 0), lives: d.lives, wave: d.wave,
      phase: d.phase === 'build' ? 'build' : 'wave',
      gameSpeed: d.gameSpeed, autoWaveMode: !!d.autoWaveMode, autoWaveTimer: num(d.autoWaveTimer, 0),
      waveComplete: !!d.waveComplete, waveCountdown: num(d.waveCountdown, 3), spawnTimer: num(d.spawnTimer, 0),
      waveEnemies: Array.isArray(d.waveEnemies) ? d.waveEnemies.filter(t => ENEMY_TYPES[t]) : [],
      towers: [], floor: [], enemies: []
    };
    for (const t of Array.isArray(d.towers) ? d.towers : []) {
      if (!t || !Number.isInteger(t.type) || !V1_TOWERS[t.type]) continue;
      const def = TOWER_BY_ID[V1_TOWERS[t.type]];
      const tier = clamp(Number.isInteger(t.tier) ? t.tier : 1, 1, 3);
      out.towers.push({ col: t.col, row: t.row, type: def.id, tier, branch: -1, target: 'first', kills: num(t.kills, 0), dealt: 0,
        hp: num(t.hp, 100), maxHp: num(t.maxHp, 100), spent: tierSpent(def, tier), builtWave: -1 });
    }
    for (const fe of Array.isArray(d.floorEffects) ? d.floorEffects : []) {
      if (!fe) continue;
      if (fe.type === 'spike')
        out.towers.push({ col: fe.col, row: fe.row, type: 'spikes', tier: 1, branch: -1, target: 'first', kills: 0, dealt: 0, hp: 100, maxHp: 100, spent: TOWER_BY_ID.spikes.cost, builtWave: -1 });
      else if ((fe.type === 'lava' || fe.type === 'ice') && isFiniteNumber(fe.timer) && fe.timer > 0)
        out.floor.push({ col: fe.col, row: fe.row, type: fe.type, timer: fe.timer, damage: num(fe.damage, 0) });
    }
    const tiles = V1_PATH_TILES[d.map] || 2;
    for (const e of Array.isArray(d.enemies) ? d.enemies : []) {
      if (!e || !ENEMY_TYPES[e.type] || !isFiniteNumber(e.hp) || e.hp <= 0) continue;
      const def = ENEMY_TYPES[e.type];
      const share = clamp((num(e.pathIndex, 0) + num(e.pathProgress, 0)) / Math.max(1, tiles - 1), 0, 0.98);
      out.enemies.push({ type: e.type, pi: 0, share, hp: e.hp, maxHp: num(e.maxHp, e.hp), speed: num(e.baseSpeed, def.speed),
        bounty: num(e.bounty, def.bounty), radius: num(e.radius, def.radius), armor: def.armor || 0,
        shieldHp: num(e.shieldHp, 0), shieldMax: num(e.shieldHp, 0), slowTimer: num(e.slowTimer, 0), freezeTimer: num(e.freezeTimer, 0) });
    }
    return out;
  }

  // Parses and validates a save; returns plain format-2 data or null (with saveNotice set) when unusable
  function readSavedGame() {
    let raw = null, rawV1 = null;
    try {
      raw = localStorage.getItem(STORAGE_SAVE);
      if (!raw)
        rawV1 = localStorage.getItem(STORAGE_SAVE_V1);
    } catch (_) {
      return null;
    }
    if (!raw && !rawV1)
      return null;

    try {
      const d = raw ? JSON.parse(raw) : migrateV1(JSON.parse(rawV1));
      if (!d || d.version !== SAVE_VERSION)
        throw new Error('version');
      if (!Number.isInteger(d.map) || d.map < 0 || d.map >= MAPS.length)
        throw new Error('map');
      const mapDef = MAPS[d.map];
      if (!Number.isInteger(d.wave) || d.wave < 0 || d.wave > 9999)
        throw new Error('wave');
      if (!isFiniteNumber(d.gold) || !Number.isInteger(d.lives) || d.lives <= 0)
        throw new Error('stats');
      if (!Array.isArray(d.towers) || !Array.isArray(d.enemies) || !Array.isArray(d.waveEnemies))
        throw new Error('lists');
      if (rawV1) {
        // Converted once: from now on the game lives in the new slot
        try {
          localStorage.setItem(STORAGE_SAVE, JSON.stringify(d));
          localStorage.removeItem(STORAGE_SAVE_V1);
        } catch (_) {}
      }
      return d;
    } catch (_) {
      clearSavedGame();
      G.saveNotice = 'The saved game could not be read and was discarded.';
      return null;
    }
  }

  function refreshSavedGameInfo() {
    const d = readSavedGame();
    G.savedGameInfo = d ? { map: d.map, wave: d.wave, waves: MAPS[d.map].waves } : null;
  }

  function continueSavedGame() {
    const d = readSavedGame();
    if (!d) {
      G.savedGameInfo = null;
      return false;
    }

    loadMap(d.map);
    G.cleared = !!d.cleared || !!d.endless || d.wave > MAPS[d.map].waves;
    G.gold = Math.max(0, Math.floor(d.gold));
    G.lives = d.lives;
    G.runStartLives = Number.isInteger(d.runStartLives) && d.runStartLives > 0 ? d.runStartLives : startLives();
    G.currentWave = d.wave;
    G.gameSpeed = GAME_SPEEDS.indexOf(d.gameSpeed) >= 0 ? d.gameSpeed : 1;
    G.autoWaveMode = !!d.autoWaveMode;
    G.autoWaveTimer = num(d.autoWaveTimer, 0);
    G.waveComplete = d.phase === 'build' ? true : !!d.waveComplete;
    G.waveCountdown = num(d.waveCountdown, 3);
    G.spawnTimer = num(d.spawnTimer, 0);
    G.waveEnemies = d.waveEnemies.filter(isQueueToken);
    G.lastPaidWave = Number.isInteger(d.lastPaidWave) ? clamp(d.lastPaidWave, 0, G.currentWave) : (d.phase === 'build' ? G.currentWave : Math.max(0, G.currentWave - 1));
    if (d.stats)
      G.runStats = { kills: num(d.stats.kills, 0), gold: num(d.stats.gold, 0), leaked: num(d.stats.leaked, 0), rp: num(d.stats.rp, 0) };

    // Towers: anything that no longer fits the map is refunded
    for (const o of d.towers) {
      const def = o && TOWER_BY_ID[o.type];
      if (!def || !Number.isInteger(o.col) || !Number.isInteger(o.row)) continue;
      const tier = clamp(Number.isInteger(o.tier) ? o.tier : 1, 1, MAX_TIER);
      const branch = tier >= BRANCH_TIER ? (o.branch === 1 ? 1 : 0) : -1;
      const spent = num(o.spent, tierSpent(def, tier));
      if (!canBuildAt(def.index, o.col, o.row)) {
        G.gold += spent;
        continue;
      }
      const t = makeTower(o.col, o.row, def.index, tier, branch);
      t.target = TARGET_MODES.indexOf(o.target) >= 0 ? o.target : 'first';
      t.kills = num(o.kills, 0);
      t.dealt = num(o.dealt, 0);
      t.maxHp = Math.max(1, num(o.maxHp, 100));
      t.hp = clamp(num(o.hp, t.maxHp), 1, t.maxHp);
      t.spent = spent;
      t.builtWave = num(o.builtWave, -1);
      G.towers.push(t);
      ++G.towerVersion;
    }

    G.floorEffects = [];
    for (const fe of Array.isArray(d.floor) ? d.floor : [])
      if (fe && (fe.type === 'lava' || fe.type === 'ice') && isFiniteNumber(fe.timer) && fe.timer > 0)
        addFloorEffect(fe.col, fe.row, fe.type, fe.timer, num(fe.damage, 0));

    G.enemies = [];
    for (const o of d.enemies) {
      if (!o || !ENEMY_TYPES[o.type] || !isFiniteNumber(o.hp) || o.hp <= 0) continue;
      const pi = Number.isInteger(o.pi) && o.pi >= 0 && o.pi < G.paths.length ? o.pi : 0;
      const e = spawnEnemy(o.type + (o.elite ? '!' : ''), pi, 1);
      e.enraged = !!o.enraged;
      for (const k of ENEMY_SAVE_FIELDS)
        if (isFiniteNumber(o[k]))
          e[k] = o[k];

      const path = enemyPath(e);
      if (isFiniteNumber(o.share))
        e.dist = o.share * path.total;
      e.dist = clamp(e.dist, 0, path.total - 1);
      e.maxHp = Math.max(e.maxHp, e.hp);
      e.spawnT = 1;
      pathPos(path, e.dist, e);
    }
    G.waveSize = Math.max(num(d.waveSize, 0), G.waveEnemies.filter(t => t !== '|').length + G.enemies.length);
    if (d.abilities && typeof d.abilities === 'object') {
      for (const k of ['strike', 'freeze', 'rush'])
        abilityCd[k] = clamp(num(d.abilities[k], 0), 0, 120);
      G.rushTimer = clamp(num(d.abilities.rushTimer, 0), 0, 60);
    }

    G.shownGold = G.gold;

    // A wave in progress resumes paused so the player can get their bearings
    if (d.phase === 'build')
      G.state = STATE_BUILD;
    else {
      G.state = STATE_PAUSED;
      G.pausedFrom = STATE_PLAYING;
    }
    G.saveNotice = '';
    G.autosaveTimer = 0;
    updateWindowTitle();
    return true;
  }

  // New Game: asks first when it would overwrite an existing save.
  function requestNewGame() {
    if (!G.savedGameInfo) {
      NS.actions.resetAndStart();
      return;
    }
    if (G.state === STATE_PLAYING) {
      G.pausedFrom = G.state;
      G.state = STATE_PAUSED;
    }
    // The inner box may still carry the hidden flag from the previous answer
    for (const box of document.querySelectorAll('#dlg-new-game .dialog'))
      box.hidden = false;
    SZ.Dialog.show('dlg-new-game').then((result) => {
      if (result !== 'yes')
        return;
      clearSavedGame();
      NS.actions.resetAndStart();
    });
  }

  NS.savegame = { isInGameState, runIsOpen, saveGame, clearSavedGame, refreshSavedGameInfo,
      continueSavedGame, requestNewGame };

})();
