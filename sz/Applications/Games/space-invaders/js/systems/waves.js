/* Run and level setup: building waves and bunkers, new runs, next level, survival waves, boss levels.
   Resets most of G; reads data and the save. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const {
    GAME_W, GAME_H, ALIEN_W, ALIEN_H, ALIEN_PAD_X, ALIEN_PAD_Y, PLAYER_W, PLAYER_Y_OFFSET, SHIELD_COUNT,
    SHIELD_BLOCK_SIZE, SHIELD_COLS, SHIELD_ROWS, SHIELD_Y_OFFSET, UFO_MIN_INTERVAL, UFO_MAX_INTERVAL, BOSS_W,
    BOSS_H, BOSS_ESCORT_MIN_Y, BOSS_BASE_HP, BOSS_HP_PER_BOSS, DRONE_W, BASE_MOVE_INTERVAL, SHIELD_SHAPE
  } = NS.constants;
  const { ALIEN_TYPE_INFO, POWERUPS, FORMATIONS, BOSS_ESCORTS, MODES, SHIP_DEFS } = NS.data;
  const { updateStatusBar } = NS.statusBar;
  const { playSfx } = NS.audio;
  const { treeLevel, currentShipId, powerupDuration } = NS.progress;
  const { setBackdrop, levelTheme } = NS.backdrop;
  const { particles, floatingText } = NS.fx;

  function createWaveFromFormation(formation) {
    G.aliens = [];
    G.divers = [];
    const grid = formation.grid;
    const rows = grid.length;
    const maxCols = Math.max(...grid.map(r => r.length));

    const totalW = maxCols * (ALIEN_W + ALIEN_PAD_X) - ALIEN_PAD_X;
    const startX = (GAME_W - totalW) / 2;
    const startY = 90;

    for (let row = 0; row < rows; ++row)
      for (let col = 0; col < grid[row].length; ++col) {
        const type = grid[row][col];
        if (type === 0) continue;

        const info = ALIEN_TYPE_INFO[type];
        if (!info) continue;

        G.aliens.push({
          row, col,
          x: startX + col * (ALIEN_W + ALIEN_PAD_X),
          y: startY + row * (ALIEN_H + ALIEN_PAD_Y),
          w: ALIEN_W,
          h: ALIEN_H,
          alive: true,
          points: info.points,
          color: info.color,
          species: type,
          typeIndex: Math.min(info.drawIndex, 2),
          flash: 0,
          hp: type === 6 ? 2 : 1,
          shielded: type === 5,
          shieldHP: type === 5 ? 1 : 0,
          isDiver: type === 4,
          diving: false,
          divePhase: 0,
        });
      }
  }

  function createShields() {
    G.shields = [];
    const blockHp = 1 + treeLevel('d_bunker');
    const totalShieldWidth = SHIELD_COUNT * SHIELD_COLS * SHIELD_BLOCK_SIZE;
    const gap = (GAME_W - totalShieldWidth) / (SHIELD_COUNT + 1);

    for (let i = 0; i < SHIELD_COUNT; ++i) {
      const sx = gap + i * (SHIELD_COLS * SHIELD_BLOCK_SIZE + gap);
      const sy = GAME_H - SHIELD_Y_OFFSET - SHIELD_ROWS * SHIELD_BLOCK_SIZE;
      const blocks = [];
      for (let r = 0; r < SHIELD_ROWS; ++r)
        for (let c = 0; c < SHIELD_COLS; ++c)
          if (SHIELD_SHAPE[r][c])
            blocks.push({
              x: sx + c * SHIELD_BLOCK_SIZE,
              y: sy + r * SHIELD_BLOCK_SIZE,
              w: SHIELD_BLOCK_SIZE,
              h: SHIELD_BLOCK_SIZE,
              row: r,
              alive: true,
              hp: blockHp,
              maxHp: blockHp,
            });
      G.shields.push(blocks);
    }
  }

  function newGame(mode, skipWave) {
    G.gameMode = mode || 'classic';
    G.rand = mode === 'daily'
      ? SZ.InvaderCampaign.rng(SZ.InvaderCampaign.dailySeed(new Date()))
      : Math.random;
    G.score = 0;
    G.lives = 3 + SHIP_DEFS[currentShipId()].lives + treeLevel('d_hull');
    G.level = 1;
    G.wave = 1;
    G.alienDir = 1;
    G.alienMoveTimer = 0;
    G.alienMoveInterval = BASE_MOVE_INTERVAL;
    G.alienBullets = [];
    G.alienShootTimer = 0;
    G.alienShootInterval = 2000;
    G.playerBullets = [];
    G.playerShootCooldown = 0;
    G.ufo = null;
    G.ufoTimer = 0;
    G.ufoNextSpawn = UFO_MIN_INTERVAL + G.rand() * (UFO_MAX_INTERVAL - UFO_MIN_INTERVAL);
    G.flares = [];
    G.deathTimer = 0;
    G.levelCompleteTimer = 0;
    G.alienFrame = 0;
    G.fallingPowerups = [];
    G.activePowerups = {};
    G.drone = null;
    G.droneShootTimer = 0;
    G.comboCount = 0;
    G.comboTimer = 0;
    G.comboMultiplier = 1;
    G.boss = null;
    G.bossActive = false;
    G.bossWarningTimer = 0;
    G.bossVictoryTimer = 0;
    G.screenFlashAlpha = 0;
    G.waveNameTimer = 0;
    G.debris = [];
    G.rings = [];
    G.trails = [];
    G.trailFrame = 0;
    G.hitStop = 0;
    G.sweep = 0;
    G.comboPop = null;
    G.dyingSlow = 0;
    G.bossFinale = 0;
    G.bossFinaleTick = 0;
    G.bossFinaleBox = null;
    G.fade = 1;

    G.player.x = GAME_W / 2 - PLAYER_W / 2;
    G.player.y = GAME_H - PLAYER_Y_OFFSET;
    G.player.alive = true;
    G.player.tilt = 0;

    G.special = 0;
    G.specialCharges = 0;
    G.specialActive = 0;
    G.specialKind = '';
    G.specialTick = 0;
    G.novaRing = null;
    G.invuln = 0;
    G.dash = null;
    G.dashCooldown = 0;
    G.lastTapDir = 0;
    G.lastTapTime = -1e9;

    if (treeLevel('d_shield') > 0)
      G.activePowerups.shield = powerupDuration(POWERUPS.find(p => p.id === 'shield'));
    if (treeLevel('s_drone') > 0) {
      G.drone = {
        x: G.player.x + PLAYER_W / 2 - DRONE_W / 2 + 30,
        y: G.player.y - 30,
      };
      G.droneShootTimer = 0;
      G.activePowerups.drone = 12000;
    }

    setBackdrop(levelTheme());

    particles.clear();
    floatingText.clear();
    G.marchStep = 0;
    playSfx('select');

    if (!skipWave) {
      const modeConf = MODES[G.gameMode];
      const isBossLevel = modeConf.bossEvery > 0 && G.level % modeConf.bossEvery === 0;

      if (isBossLevel) {
        startBossPhase();
      } else {
        const formIdx = (G.level - 1) % FORMATIONS.length;
        createWaveFromFormation(FORMATIONS[formIdx]);
        createShields();
        G.waveNameText = FORMATIONS[formIdx].name;
        G.waveNameTimer = 2000;
        G.gameState = 'playing';
      }
    }

    updateStatusBar();
  }

  function startNextLevel() {
    ++G.level;
    ++G.wave;
    G.alienDir = 1;
    G.alienMoveTimer = 0;
    G.alienBullets = [];
    G.alienShootTimer = 0;
    G.playerBullets = [];
    G.playerShootCooldown = 0;
    G.ufo = null;
    G.ufoTimer = 0;
    G.ufoNextSpawn = UFO_MIN_INTERVAL + G.rand() * (UFO_MAX_INTERVAL - UFO_MIN_INTERVAL);
    G.deathTimer = 0;
    G.levelCompleteTimer = 0;
    G.alienFrame = 0;
    G.fallingPowerups = [];
    G.bossVictoryTimer = 0;

    G.alienShootInterval = Math.max(400, 2000 - (G.level - 1) * 200);

    G.player.x = GAME_W / 2 - PLAYER_W / 2;
    G.player.alive = true;

    setBackdrop(levelTheme());

    const modeConf = MODES[G.gameMode];
    const isBossLevel = modeConf.bossEvery > 0 && G.level % modeConf.bossEvery === 0;

    if (isBossLevel) {
      startBossPhase();
    } else {
      const formIdx = (G.level - 1) % FORMATIONS.length;
      createWaveFromFormation(FORMATIONS[formIdx]);
      createShields();
      G.waveNameText = FORMATIONS[formIdx].name;
      G.waveNameTimer = 2000;
      G.gameState = 'playing';
    }

    updateStatusBar();
  }

  function startSurvivalNextWave() {
    ++G.wave;
    G.alienDir = 1;
    G.alienMoveTimer = 0;
    G.alienBullets = [];
    G.alienShootTimer = 0;
    G.alienFrame = 0;
    G.fallingPowerups = [];

    G.alienShootInterval = Math.max(400, 2000 - (G.wave - 1) * 100);

    const formIdx = (G.wave - 1) % FORMATIONS.length;
    createWaveFromFormation(FORMATIONS[formIdx]);
    setBackdrop(levelTheme());
    G.waveNameText = 'Wave ' + G.wave + ': ' + FORMATIONS[formIdx].name;
    G.waveNameTimer = 2000;
    G.gameState = 'playing';
    updateStatusBar();
  }

  function startBossPhase() {
    const stage = G.gameMode === 'campaign' ? G.stageInfo : null;
    const escortIdx = (G.level - 1) % BOSS_ESCORTS.length;
    createWaveFromFormation(BOSS_ESCORTS[escortIdx]);
    if (stage) {
      if (stage.escorts <= 0)
        G.aliens = [];
      else if (G.aliens.length > stage.escorts)
        G.aliens.length = stage.escorts;
    }
    /* the escorts march below the boss, never inside its bigger box */
    if (G.aliens.length > 0) {
      let escortTop = G.aliens[0].y;
      for (const a of G.aliens)
        if (a.y < escortTop)
          escortTop = a.y;
      if (escortTop < BOSS_ESCORT_MIN_Y) {
        const drop = BOSS_ESCORT_MIN_Y - escortTop;
        for (const a of G.aliens)
          a.y += drop;
      }
    }
    createShields();

    let hp, design, name;
    if (stage && stage.boss) {
      hp = stage.boss.hp;
      design = stage.boss.design;
      name = stage.boss.name;
    } else {
      const bossNum = Math.ceil(G.level / (MODES[G.gameMode].bossEvery || 1));
      hp = BOSS_BASE_HP + (bossNum - 1) * BOSS_HP_PER_BOSS;
      design = (bossNum - 1) % 6;
    }

    G.boss = {
      x: GAME_W / 2 - BOSS_W / 2,
      y: -BOSS_H - 30,
      targetY: 170,
      hp,
      maxHp: hp,
      design,
      name,
      flash: 0,
      movePhase: 0,
      moveSpeed: 1.5,
      attackTimer: 0,
      attackInterval: 2000,
      currentPattern: 0,
      patterns: ['spread', 'aimed', 'rain'],
      enraged: false,
    };
    setBackdrop(stage ? stage.theme : levelTheme());
    G.bossActive = true;
    G.bossWarningTimer = 2000;
    G.bossWarnBeats = 0;
    G.bossDescendY = -BOSS_H - 30;
    G.gameState = 'bossIntro';
    G.waveNameText = 'BOSS FIGHT';
    G.waveNameTimer = 2500;
    updateStatusBar();
  }

  Object.assign(NS.waves, {
    createWaveFromFormation, createShields, newGame, startBossPhase, startNextLevel, startSurvivalNextWave
  });
})();
