;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 700;
  const CANVAS_H = 500;
  const MAX_DT = 0.05;

  /* ── Elements ── */
  const ELEMENT_FIRE = 'fire';
  const ELEMENT_WATER = 'water';
  const ELEMENT_EARTH = 'earth';
  const ELEMENT_AIR = 'air';

  const ELEMENTS = [
    { id: ELEMENT_FIRE,  name: 'Fire',  icon: '🔥', color: '#f60', key: '1', altKey: 'KeyQ' },
    { id: ELEMENT_WATER, name: 'Water', icon: '💧', color: '#48f', key: '2', altKey: 'KeyW' },
    { id: ELEMENT_EARTH, name: 'Earth', icon: '🪨', color: '#a62', key: '3', altKey: 'KeyE' },
    { id: ELEMENT_AIR,   name: 'Air',   icon: '💨', color: '#aaf', key: '4', altKey: 'KeyR' }
  ];

  /* ── States ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';
  const STATE_LEVEL_COMPLETE = 'LEVEL_COMPLETE';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-fantasy-puzzle';
  const STORAGE_PROGRESS = STORAGE_PREFIX + '-progress';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL_SEEN = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 10;

  /* ── Grid ── */
  const GRID_COLS = 10;
  const GRID_ROWS = 8;
  const TILE_SIZE = 48;
  const GRID_OFFSET_X = 30;
  const GRID_OFFSET_Y = 40;

  /* ── Tile types ── */
  const T_EMPTY = 0;
  const T_WALL = 1;
  const T_WOOD = 2;    // burnable by fire
  const T_CHANNEL = 3; // fillable by water
  const T_FILLED = 4;  // channel filled with water
  const T_BLOCK = 5;   // pushable by air
  const T_EARTH_WALL = 6; // created by earth
  const T_RUNE = 7;    // hidden rune
  const T_RUNE_ACTIVE = 8; // discovered rune (glows)
  const T_GOAL = 9;    // level goal

  /* ── Star thresholds (moves) ── */
  const STAR_3_MULT = 1.0;
  const STAR_2_MULT = 1.5;

  /* ══════════════════════════════════════════════════════════════════
     LEVEL DATA — 15+ puzzles with grids
     ══════════════════════════════════════════════════════════════════ */

  const LEVELS = [
    { name: 'Ember Path', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,2,0,0,0,0,0,1],
      [1,0,0,2,0,0,7,0,0,1],
      [1,0,0,2,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,9,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 3, hint: 'Use fire to burn the wood' },
    { name: 'River Cross', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,3,0,0,0,0,1],
      [1,0,0,0,3,0,0,0,0,1],
      [1,0,0,0,3,0,0,7,0,1],
      [1,0,0,0,3,0,0,0,9,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 4, hint: 'Fill the channels with water' },
    { name: 'Stone Barrier', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,5,0,0,0,0,0,0,1],
      [1,0,0,0,0,7,0,0,0,1],
      [1,0,0,0,0,0,0,0,9,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 3, hint: 'Push blocks with air, block paths with earth' },
    { name: 'Wind Maze', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,5,0,1,0,0,0,0,1],
      [1,0,0,0,1,0,5,0,0,1],
      [1,0,0,0,0,0,0,7,0,1],
      [1,1,0,0,0,1,0,0,0,1],
      [1,0,0,0,0,1,0,0,9,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 5, hint: 'Push blocks into position with air' },
    { name: 'Fire & Water', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,2,0,3,0,0,0,0,1],
      [1,0,2,0,3,0,0,0,0,1],
      [1,0,0,0,3,0,0,0,0,1],
      [1,0,0,0,0,0,7,0,9,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 5, hint: 'Combine fire and water to clear the path' },
    { name: 'Rune Garden', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,7,0,0,0,0,0,0,7,1],
      [1,0,0,2,0,2,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,2,0,9,0,2,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,7,0,0,0,0,0,0,7,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 8, hint: 'Find all runes then reach the goal' },
    { name: 'Earth Bridge', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,3,3,3,0,0,0,1],
      [1,0,0,0,0,0,0,7,0,1],
      [1,0,0,0,0,0,0,0,9,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 4, hint: 'Create earth walls to bridge channels' },
    { name: 'Gust Push', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,5,0,5,0,0,0,0,1],
      [1,0,0,0,0,0,1,0,0,1],
      [1,0,0,5,0,0,1,0,9,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,7,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 6, hint: 'Push all blocks into gaps with wind' },
    { name: 'Inferno Trail', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,2,2,2,0,0,0,0,1],
      [1,0,0,0,2,0,0,0,0,1],
      [1,0,0,0,2,2,2,0,0,1],
      [1,0,0,0,0,0,2,0,9,1],
      [1,0,0,0,0,0,0,7,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 7, hint: 'Burn a trail through the forest' },
    { name: 'Aqua Flow', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,3,0,0,0,0,0,1],
      [1,0,0,3,0,3,3,0,0,1],
      [1,0,0,3,0,0,3,0,0,1],
      [1,0,0,0,0,0,3,0,9,1],
      [1,0,0,0,7,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 7, hint: 'Fill multiple channel systems with water' },
    { name: 'Four Winds', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,5,0,0,0,0,1],
      [1,0,1,0,0,0,1,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,5,0,0,9,0,0,5,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,1,0,0,7,1,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 6, hint: 'Use air from all four directions' },
    { name: 'Elemental Merge', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,2,0,3,0,0,0,0,1],
      [1,0,0,0,0,0,5,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,7,0,0,0,0,9,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 4, hint: 'All four elements needed' },
    { name: 'Rune Temple', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,7,0,2,0,2,0,7,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,3,0,7,0,3,0,0,1],
      [1,0,0,0,0,0,0,0,9,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,7,0,0,5,0,0,7,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 10, hint: 'Discover all six runes' },
    { name: 'Cascade Canyon', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,2,3,0,0,0,0,1],
      [1,0,5,2,3,0,5,0,0,1],
      [1,0,0,0,0,0,0,7,0,1],
      [1,0,2,0,0,0,0,0,9,1],
      [1,0,0,0,0,5,0,0,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 8, hint: 'Chain elements in sequence' },
    { name: 'Crystal Labyrinth', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,1,0,0,1,0,0,1],
      [1,0,2,0,3,0,0,5,0,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,1,0,0,7,0,0,1,0,1],
      [1,0,0,0,0,0,0,0,9,1],
      [1,0,2,0,3,0,5,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 9, hint: 'Navigate the crystal maze' },
    { name: 'Ancient Archive', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,7,0,0,2,0,0,0,7,1],
      [1,0,0,5,0,5,0,0,0,1],
      [1,0,3,0,0,0,3,0,0,1],
      [1,0,0,0,7,0,0,0,9,1],
      [1,0,3,0,0,0,3,0,0,1],
      [1,7,0,0,2,0,0,0,7,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 12, hint: 'Uncover ancient rune patterns' },
    { name: 'Elemental Mastery', grid: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,2,0,3,0,5,0,0,1],
      [1,7,0,0,0,0,0,7,0,1],
      [1,0,2,0,3,0,5,0,0,1],
      [1,0,0,0,0,0,0,0,9,1],
      [1,7,0,0,0,0,0,7,0,1],
      [1,0,2,0,3,0,5,0,0,1],
      [1,1,1,1,1,1,1,1,1,1]
    ], optimal: 15, hint: 'Master all four elements' }
  ];

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
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

  let state = STATE_READY;
  let currentLevel = 0;
  let grid = [];
  let moves = 0;
  let selectedElement = ELEMENT_FIRE;
  let elementSwitchAnim = 0; // transition animation for element switching
  let levelStars = {}; // { levelIndex: stars }
  let highScores = [];

  /* ── Tutorial & hint state ── */
  let tutorialSeen = false;
  let showingTutorial = false; // full tutorial overlay active
  let tutorialPage = 0;
  const TUTORIAL_PAGES = 4;

  /* ── Level hint overlay ── */
  let hintOverlayAlpha = 0;   // fades from 1 to 0
  let hintOverlayText = '';

  /* ── Hover tracking ── */
  let hoverRow = -1;
  let hoverCol = -1;
  let tooltipText = '';
  let tooltipX = 0;
  let tooltipY = 0;

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fitCanvasToFrame();
  }

  function fitCanvasToFrame() {
    const frame = document.querySelector('.game-frame');
    if (!frame)
      return;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    const aspect = CANVAS_W / CANVAS_H;
    let dw, dh;
    if (fw / fh > aspect) {
      dh = fh;
      dw = Math.floor(fh * aspect);
    } else {
      dw = fw;
      dh = Math.floor(fw / aspect);
    }
    canvas.style.width = dw + 'px';
    canvas.style.height = dh + 'px';
  }

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_PROGRESS);
      if (raw)
        levelStars = JSON.parse(raw);
    } catch (_) {
      levelStars = {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_PROGRESS, JSON.stringify(levelStars));
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

  function addHighScore(level, stars) {
    highScores.push({ level: level + 1, stars });
    highScores.sort((a, b) => b.stars - a.stars || a.level - b.level);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
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

  /* ══════════════════════════════════════════════════════════════════
     LEVEL LOADING
     ══════════════════════════════════════════════════════════════════ */

  function loadLevel(index) {
    if (index < 0 || index >= LEVELS.length) return;

    currentLevel = index;
    const levelDef = LEVELS[currentLevel];
    grid = [];
    for (let r = 0; r < levelDef.grid.length; ++r)
      grid.push([...levelDef.grid[r]]);

    moves = 0;
    state = STATE_PLAYING;

    // Show hint overlay at level start
    hintOverlayText = levelDef.hint || '';
    hintOverlayAlpha = 1.0;

    // Show quick-reference banner for early levels
    quickRefTimer = 6.0;

    updateWindowTitle();
  }

  function nextLevel() {
    if (currentLevel + 1 < LEVELS.length)
      loadLevel(currentLevel + 1);
    else {
      state = STATE_GAME_OVER;
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'ALL PUZZLES COMPLETE!', { color: '#ff0', font: 'bold 20px sans-serif' });
      updateWindowTitle();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     STAR RATING
     ══════════════════════════════════════════════════════════════════ */

  function calculateStars() {
    const optimal = LEVELS[currentLevel].optimal;
    if (moves <= optimal * STAR_3_MULT) return 3;
    if (moves <= optimal * STAR_2_MULT) return 2;
    return 1;
  }

  /* ══════════════════════════════════════════════════════════════════
     ELEMENT CASTING
     ══════════════════════════════════════════════════════════════════ */

  function castElement(row, col) {
    if (state !== STATE_PLAYING) return;
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;

    const tile = grid[row][col];
    const tx = GRID_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2;
    const ty = GRID_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2;
    let acted = false;

    switch (selectedElement) {
      case ELEMENT_FIRE:
        if (tile === T_WOOD) {
          // Fire burns wood obstacle — flame particles
          grid[row][col] = T_EMPTY;
          particles.burst(tx, ty, 12, { color: '#f60', speed: 3, life: 0.6 });
          particles.sparkle(tx, ty, 6, { color: '#ff0', speed: 1.5 });
          floatingText.add(tx, ty - 15, 'Burn!', { color: '#f80', font: 'bold 12px sans-serif' });
          screenShake.trigger(4, 150);
          acted = true;
        }
        break;

      case ELEMENT_WATER:
        if (tile === T_CHANNEL) {
          // Water fills channel — water ripple particles
          grid[row][col] = T_FILLED;
          particles.burst(tx, ty, 10, { color: '#48f', speed: 2, life: 0.5 });
          particles.sparkle(tx, ty, 5, { color: '#8af', speed: 1 });
          floatingText.add(tx, ty - 15, 'Fill!', { color: '#4af', font: 'bold 12px sans-serif' });
          acted = true;
        }
        break;

      case ELEMENT_EARTH:
        if (tile === T_EMPTY) {
          // Earth creates wall barrier — earth crumble particles
          grid[row][col] = T_EARTH_WALL;
          particles.burst(tx, ty, 8, { color: '#a62', speed: 2, life: 0.4 });
          particles.sparkle(tx, ty, 4, { color: '#840', speed: 1 });
          floatingText.add(tx, ty - 15, 'Block path!', { color: '#a62', font: 'bold 12px sans-serif' });
          acted = true;
        }
        break;

      case ELEMENT_AIR:
        // Air pushes movable blocks — wind gust particles
        if (tile === T_BLOCK) {
          const pushDir = getAirPushDirection(row, col);
          if (pushDir) {
            const nr = row + pushDir.dr;
            const nc = col + pushDir.dc;
            if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS && grid[nr][nc] === T_EMPTY) {
              grid[row][col] = T_EMPTY;
              grid[nr][nc] = T_BLOCK;
              particles.burst(tx, ty, 8, { color: '#ddf', speed: 2, life: 0.4 });
              particles.sparkle(tx, ty, 5, { color: '#eef', speed: 1.5 });
              floatingText.add(tx, ty - 15, 'Push!', { color: '#aaf', font: 'bold 12px sans-serif' });
              acted = true;
            }
          }
        }
        break;
    }

    // Check rune discovery — cast any element adjacent to rune
    checkRuneDiscovery(row, col, tx, ty);

    if (acted) {
      ++moves;
      checkLevelComplete();
    }
  }

  function getAirPushDirection(row, col) {
    // Push away from center of grid
    const cr = GRID_ROWS / 2;
    const cc = GRID_COLS / 2;
    const dr = row < cr ? 1 : -1;
    const dc = col < cc ? 1 : -1;
    // Prefer horizontal push
    if (Math.abs(col - cc) > Math.abs(row - cr))
      return { dr: 0, dc };
    return { dr, dc: 0 };
  }

  /* ══════════════════════════════════════════════════════════════════
     RUNE DISCOVERY
     ══════════════════════════════════════════════════════════════════ */

  function checkRuneDiscovery(row, col, tx, ty) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < GRID_ROWS && nc >= 0 && nc < GRID_COLS) {
        if (grid[nr][nc] === T_RUNE) {
          // Discover rune — activate and glow
          grid[nr][nc] = T_RUNE_ACTIVE;
          const rx = GRID_OFFSET_X + nc * TILE_SIZE + TILE_SIZE / 2;
          const ry = GRID_OFFSET_Y + nr * TILE_SIZE + TILE_SIZE / 2;
          revealRune(rx, ry);
        }
      }
    }
  }

  function revealRune(rx, ry) {
    particles.sparkle(rx, ry, 15, { color: '#c8f', speed: 2 });
    floatingText.add(rx, ry - 20, 'Rune Found!', { color: '#c8f', font: 'bold 14px sans-serif' });
    screenShake.trigger(3, 100);
  }

  /* ══════════════════════════════════════════════════════════════════
     LEVEL COMPLETION
     ══════════════════════════════════════════════════════════════════ */

  function checkLevelComplete() {
    let hasUnsolvedRune = false;
    let hasObstacles = false;
    let hasGoal = false;

    for (let r = 0; r < grid.length; ++r) {
      for (let c = 0; c < grid[r].length; ++c) {
        const tile = grid[r][c];
        if (tile === T_RUNE) hasUnsolvedRune = true;
        else if (tile === T_GOAL) hasGoal = true;
        else if (tile === T_WOOD || tile === T_CHANNEL) hasObstacles = true;
      }
    }

    if (!hasUnsolvedRune && !hasObstacles && hasGoal)
      completeLevel();
  }

  function completeLevel() {
    state = STATE_LEVEL_COMPLETE;
    const stars = calculateStars();

    // Save best stars
    if (!levelStars[currentLevel] || stars > levelStars[currentLevel]) {
      levelStars[currentLevel] = stars;
      saveProgress();
    }

    addHighScore(currentLevel, stars);

    // Solution cascade celebration
    solveCascade(stars);
    updateWindowTitle();
  }

  function solveCascade(stars) {
    // Cascade particles across the solved puzzle
    for (let i = 0; i < 5; ++i) {
      const cx = GRID_OFFSET_X + Math.random() * (GRID_COLS * TILE_SIZE);
      const cy = GRID_OFFSET_Y + Math.random() * (GRID_ROWS * TILE_SIZE);
      particles.burst(cx, cy, 10, { color: '#ff0', speed: 3, life: 0.8 });
      particles.sparkle(cx, cy, 8, { color: '#c8f', speed: 2 });
    }

    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `Level ${currentLevel + 1} Solved!`, { color: '#ff0', font: 'bold 18px sans-serif' });
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 30, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, { color: '#fc0', font: 'bold 24px sans-serif' });
    screenShake.trigger(6, 300);
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateGame(dt) {
    if (state !== STATE_PLAYING && state !== STATE_LEVEL_COMPLETE) return;

    // Element switch animation decay
    if (elementSwitchAnim > 0)
      elementSwitchAnim = Math.max(0, elementSwitchAnim - dt * 4);

    // Hint overlay fade-out (hold 2s then fade over 1s)
    if (hintOverlayAlpha > 0) {
      if (hintOverlayAlpha > 0.99)
        hintOverlayAlpha -= dt * 0.5; // slow start (holds ~2s)
      else
        hintOverlayAlpha = Math.max(0, hintOverlayAlpha - dt * 0.8);
    }

    // Quick-reference banner countdown
    if (quickRefTimer > 0)
      quickRefTimer = Math.max(0, quickRefTimer - dt);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawGrid() {
    for (let r = 0; r < grid.length; ++r) {
      for (let c = 0; c < grid[r].length; ++c) {
        const x = GRID_OFFSET_X + c * TILE_SIZE;
        const y = GRID_OFFSET_Y + r * TILE_SIZE;
        const tile = grid[r][c];

        // Tile background
        switch (tile) {
          case T_EMPTY:     ctx.fillStyle = '#1a1a2a'; break;
          case T_WALL:      ctx.fillStyle = '#444'; break;
          case T_WOOD:      ctx.fillStyle = '#642'; break;
          case T_CHANNEL:   ctx.fillStyle = '#124'; break;
          case T_FILLED:    ctx.fillStyle = '#28a'; break;
          case T_BLOCK:     ctx.fillStyle = '#555'; break;
          case T_EARTH_WALL:ctx.fillStyle = '#863'; break;
          case T_RUNE:      ctx.fillStyle = '#1a1a2a'; break;
          case T_RUNE_ACTIVE:ctx.fillStyle = '#201040'; break;
          case T_GOAL:      ctx.fillStyle = '#142'; break;
          default:          ctx.fillStyle = '#111'; break;
        }
        ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

        // Tile details
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (tile === T_WOOD) {
          ctx.fillStyle = '#a64';
          ctx.fillText('🪵', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
        } else if (tile === T_CHANNEL) {
          ctx.strokeStyle = '#48f';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          ctx.setLineDash([]);
        } else if (tile === T_FILLED) {
          ctx.fillStyle = '#48f';
          ctx.globalAlpha = 0.5;
          ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.globalAlpha = 1;
          ctx.fillText('💧', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
        } else if (tile === T_BLOCK) {
          ctx.fillStyle = '#aaa';
          ctx.fillText('📦', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
        } else if (tile === T_EARTH_WALL) {
          ctx.fillText('🧱', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
        } else if (tile === T_RUNE) {
          // Hidden rune — subtle shimmer
          ctx.fillStyle = 'rgba(200,128,255,0.15)';
          ctx.fillRect(x + 8, y + 8, TILE_SIZE - 16, TILE_SIZE - 16);
        } else if (tile === T_RUNE_ACTIVE) {
          // Discovered rune — draw rune with glow
          drawRuneGlow(x, y);
        } else if (tile === T_GOAL) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#0f0';
          ctx.fillText('⭐', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
          ctx.shadowBlur = 0;
        }

        // Grid lines
        ctx.strokeStyle = '#2a2a3a';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

        // Valid-target highlight for currently selected element
        if (state === STATE_PLAYING) {
          const isValid = isValidTarget(tile, selectedElement);
          if (isValid) {
            const pulse = 0.4 + 0.3 * Math.sin(performance.now() / 300);
            const elem = ELEMENTS.find(e => e.id === selectedElement);
            ctx.save();
            ctx.strokeStyle = elem ? elem.color : '#fff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = pulse;
            ctx.shadowBlur = 8;
            ctx.shadowColor = elem ? elem.color : '#fff';
            ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            ctx.restore();
          }
        }

        // Hover highlight
        if (r === hoverRow && c === hoverCol && state === STATE_PLAYING) {
          ctx.save();
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.6;
          ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      }
    }
  }

  function isValidTarget(tile, element) {
    switch (element) {
      case ELEMENT_FIRE:  return tile === T_WOOD;
      case ELEMENT_WATER: return tile === T_CHANNEL;
      case ELEMENT_EARTH: return tile === T_EMPTY;
      case ELEMENT_AIR:   return tile === T_BLOCK;
      default: return false;
    }
  }

  function drawRuneGlow(x, y) {
    // Rune glow with shadowBlur
    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#c8f';
    ctx.fillStyle = '#c8f';
    ctx.font = 'bold 22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ᚱ', x + TILE_SIZE / 2, y + TILE_SIZE / 2);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawElementSelector() {
    const barY = CANVAS_H - 48;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, barY, CANVAS_W, 48);

    for (let i = 0; i < ELEMENTS.length; ++i) {
      const elem = ELEMENTS[i];
      const bx = 20 + i * 90;
      const isSelected = elem.id === selectedElement;

      ctx.fillStyle = isSelected ? '#333' : '#1a1a1a';
      ctx.fillRect(bx, barY + 4, 80, 40);

      if (isSelected) {
        // Glow border on selected element with transition
        const glowIntensity = 1 - elementSwitchAnim * 0.5;
        ctx.strokeStyle = elem.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 8 * glowIntensity;
        ctx.shadowColor = elem.color;
        ctx.strokeRect(bx, barY + 4, 80, 40);
        ctx.shadowBlur = 0;
      }

      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(elem.icon, bx + 22, barY + 24);

      ctx.fillStyle = isSelected ? elem.color : '#888';
      ctx.font = '11px sans-serif';
      ctx.fillText(`${elem.name} [${elem.key}]`, bx + 54, barY + 24);
    }

    // Level info
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Level ${currentLevel + 1}/${LEVELS.length}: ${LEVELS[currentLevel].name}`, CANVAS_W - 10, barY + 16);
    ctx.fillText(`Moves: ${moves} | Best: ${LEVELS[currentLevel].optimal}`, CANVAS_W - 10, barY + 34);
  }

  /* ── Objective summary ── */
  function getLevelObjectives() {
    const objectives = [];
    let woodCount = 0, channelCount = 0, runeCount = 0, hasGoal = false;
    for (let r = 0; r < grid.length; ++r) {
      for (let c = 0; c < grid[r].length; ++c) {
        const t = grid[r][c];
        if (t === T_WOOD) ++woodCount;
        else if (t === T_CHANNEL) ++channelCount;
        else if (t === T_RUNE) ++runeCount;
        else if (t === T_GOAL) hasGoal = true;
      }
    }
    if (woodCount > 0) objectives.push({ icon: '🔥', text: `Burn ${woodCount} wood`, done: false });
    if (channelCount > 0) objectives.push({ icon: '💧', text: `Fill ${channelCount} channel${channelCount > 1 ? 's' : ''}`, done: false });
    if (runeCount > 0) objectives.push({ icon: 'ᚱ', text: `Find ${runeCount} rune${runeCount > 1 ? 's' : ''}`, done: false });
    if (hasGoal) objectives.push({ icon: '⭐', text: 'Reach the goal', done: woodCount === 0 && channelCount === 0 && runeCount === 0 });
    // Mark completed objectives
    if (woodCount === 0 && objectives.some(o => o.icon === '🔥'))
      objectives.find(o => o.icon === '🔥').done = true;
    return objectives;
  }

  function drawObjectives() {
    if (state !== STATE_PLAYING) return;
    const objectives = getLevelObjectives();
    if (!objectives.length) return;

    const ox = GRID_OFFSET_X + GRID_COLS * TILE_SIZE + 16;
    let oy = GRID_OFFSET_Y + 4;

    ctx.fillStyle = '#c8f';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Objectives:', ox, oy);
    oy += 18;

    for (const obj of objectives) {
      ctx.fillStyle = obj.done ? '#4a4' : '#aaa';
      ctx.font = '11px sans-serif';
      const prefix = obj.done ? '[done] ' : '[ ] ';
      ctx.fillText(`${obj.icon} ${prefix}${obj.text}`, ox, oy);
      oy += 16;
    }

    // Suggested element
    oy += 8;
    const suggestion = getSuggestedElement();
    if (suggestion) {
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('Try:', ox, oy);
      oy += 14;
      ctx.fillStyle = suggestion.color;
      ctx.font = '11px sans-serif';
      ctx.fillText(`${suggestion.icon} ${suggestion.name}`, ox, oy);
    }
  }

  function getSuggestedElement() {
    // Suggest the element that has the most remaining targets
    let woodCount = 0, channelCount = 0, runeCount = 0, blockCount = 0;
    for (let r = 0; r < grid.length; ++r)
      for (let c = 0; c < grid[r].length; ++c) {
        const t = grid[r][c];
        if (t === T_WOOD) ++woodCount;
        else if (t === T_CHANNEL) ++channelCount;
        else if (t === T_BLOCK) ++blockCount;
        else if (t === T_RUNE) ++runeCount;
      }

    if (woodCount > 0) return ELEMENTS.find(e => e.id === ELEMENT_FIRE);
    if (channelCount > 0) return ELEMENTS.find(e => e.id === ELEMENT_WATER);
    if (blockCount > 0) return ELEMENTS.find(e => e.id === ELEMENT_AIR);
    if (runeCount > 0) return null; // any element works for rune adjacency
    return null;
  }

  /* ── Hint overlay (fades after level start) ── */
  function drawHintOverlay() {
    if (hintOverlayAlpha <= 0 || !hintOverlayText) return;

    ctx.save();
    ctx.globalAlpha = Math.min(hintOverlayAlpha, 1);

    // Background band
    const bandY = GRID_OFFSET_Y + GRID_ROWS * TILE_SIZE / 2 - 30;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(GRID_OFFSET_X - 10, bandY, GRID_COLS * TILE_SIZE + 20, 60);

    // Hint icon
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💡 Hint', CANVAS_W / 2, bandY + 16);

    // Hint text
    ctx.fillStyle = '#eee';
    ctx.font = '14px sans-serif';
    ctx.fillText(hintOverlayText, CANVAS_W / 2, bandY + 40);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* ── Tooltip ── */
  function drawTooltip() {
    if (!tooltipText || state !== STATE_PLAYING) return;

    ctx.save();
    ctx.font = '11px sans-serif';
    const metrics = ctx.measureText(tooltipText);
    const pw = metrics.width + 12;
    const ph = 20;
    let tx = tooltipX + 12;
    let ty = tooltipY - 24;

    // Keep on screen
    if (tx + pw > CANVAS_W) tx = CANVAS_W - pw - 4;
    if (ty < 4) ty = tooltipY + 20;

    ctx.fillStyle = 'rgba(20, 10, 40, 0.92)';
    ctx.strokeStyle = '#c8f';
    ctx.lineWidth = 1;
    ctx.fillRect(tx, ty, pw, ph);
    ctx.strokeRect(tx, ty, pw, ph);

    ctx.fillStyle = '#eee';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tooltipText, tx + 6, ty + ph / 2);
    ctx.restore();
  }

  /* ── Tutorial overlay (multi-page) ── */
  function drawTutorial() {
    if (!showingTutorial) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = '#c8f';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('HOW TO PLAY', CANVAS_W / 2, 40);

    // Page indicator
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Page ${tutorialPage + 1} / ${TUTORIAL_PAGES}`, CANVAS_W / 2, CANVAS_H - 20);

    // Navigation hint
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    if (tutorialPage < TUTORIAL_PAGES - 1)
      ctx.fillText('Click or press any key for next page  |  Esc to skip', CANVAS_W / 2, CANVAS_H - 40);
    else
      ctx.fillText('Click or press any key to start playing!', CANVAS_W / 2, CANVAS_H - 40);

    const cx = CANVAS_W / 2;
    const baseY = 80;

    switch (tutorialPage) {
      case 0: // Overview
        drawTutorialPage_Overview(cx, baseY);
        break;
      case 1: // Elements
        drawTutorialPage_Elements(cx, baseY);
        break;
      case 2: // Tiles & Runes
        drawTutorialPage_Tiles(cx, baseY);
        break;
      case 3: // Controls & Tips
        drawTutorialPage_Controls(cx, baseY);
        break;
    }
  }

  function drawTutorialPage_Overview(cx, y) {
    ctx.fillStyle = '#eee';
    ctx.font = '16px sans-serif';
    ctx.fillText('Welcome to Fantasy Puzzle!', cx, y);
    y += 40;

    ctx.fillStyle = '#ccc';
    ctx.font = '14px sans-serif';
    const lines = [
      'You are an elemental mage solving magical puzzles.',
      '',
      'Your goal: clear all obstacles, discover hidden runes,',
      'and reach the golden star to complete each level.',
      '',
      'You have four elements at your disposal:',
      'Fire, Water, Earth, and Air.',
      '',
      'Each element affects different tiles on the grid.',
      'Select an element, then click a tile to cast it.',
      '',
      'Try to solve each puzzle in as few moves as possible',
      'to earn up to 3 stars!'
    ];
    for (const line of lines) {
      ctx.fillText(line, cx, y);
      y += 22;
    }
  }

  function drawTutorialPage_Elements(cx, y) {
    ctx.fillStyle = '#eee';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('The Four Elements', cx, y);
    y += 40;

    const elementInfo = [
      { icon: '🔥', name: 'Fire', color: '#f60', desc: 'Burns wood obstacles (brown tiles with 🪵)' },
      { icon: '💧', name: 'Water', color: '#48f', desc: 'Fills empty channels (dark blue dashed tiles)' },
      { icon: '🪨', name: 'Earth', color: '#a62', desc: 'Creates wall barriers on empty tiles' },
      { icon: '💨', name: 'Air', color: '#aaf', desc: 'Pushes movable blocks (grey tiles with 📦)' }
    ];

    for (const info of elementInfo) {
      // Icon + name
      ctx.fillStyle = info.color;
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${info.icon} ${info.name}`, cx, y);
      y += 24;

      // Description
      ctx.fillStyle = '#bbb';
      ctx.font = '13px sans-serif';
      ctx.fillText(info.desc, cx, y);
      y += 16;

      // Valid target glow demo
      ctx.fillStyle = '#777';
      ctx.font = '11px sans-serif';
      ctx.fillText('Valid targets glow with a pulsing border in the element\'s color', cx, y);
      y += 32;
    }
  }

  function drawTutorialPage_Tiles(cx, y) {
    ctx.fillStyle = '#eee';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Tile Types & Runes', cx, y);
    y += 36;

    const tiles = [
      { icon: '🪵', label: 'Wood', color: '#642', desc: 'Obstacle. Burn it with Fire.' },
      { icon: '~ ~', label: 'Channel', color: '#124', desc: 'Gap. Fill it with Water.' },
      { icon: '📦', label: 'Block', color: '#555', desc: 'Movable. Push it with Air.' },
      { icon: '🧱', label: 'Earth Wall', color: '#863', desc: 'You create these with Earth on empty tiles.' },
      { icon: 'ᚱ', label: 'Hidden Rune', color: '#c8f', desc: 'Cast any element on an adjacent tile to reveal it.' },
      { icon: '⭐', label: 'Goal', color: '#0f0', desc: 'Reach this after clearing all obstacles & runes.' }
    ];

    ctx.font = '14px sans-serif';
    for (const t of tiles) {
      ctx.fillStyle = t.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${t.icon}  ${t.label}`, cx, y);
      y += 20;

      ctx.fillStyle = '#aaa';
      ctx.font = '12px sans-serif';
      ctx.fillText(t.desc, cx, y);
      y += 28;
    }
  }

  function drawTutorialPage_Controls(cx, y) {
    ctx.fillStyle = '#eee';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Controls & Tips', cx, y);
    y += 36;

    const controls = [
      ['Click / Tap a tile', 'Cast the selected element on that tile'],
      ['1 or Q', 'Select Fire'],
      ['2 or W', 'Select Water'],
      ['3 or E', 'Select Earth'],
      ['4 or R', 'Select Air'],
      ['H', 'Show the level hint again'],
      ['F1', 'Open How to Play'],
      ['F2', 'Restart current level'],
      ['Escape', 'Pause / Resume']
    ];

    for (const [key, desc] of controls) {
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(key, cx - 10, y);

      ctx.fillStyle = '#ccc';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(desc, cx + 10, y);
      y += 22;
    }

    ctx.textAlign = 'center';
    y += 20;
    ctx.fillStyle = '#8f8';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Tips:', cx, y);
    y += 24;

    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    const tips = [
      'Pulsing highlighted tiles show valid targets for your current element.',
      'The objectives panel on the right tracks your remaining tasks.',
      'Hover over tiles to see what they are and how to interact with them.',
      'Fewer moves = more stars. The optimal move count is shown at the bottom.'
    ];
    for (const tip of tips) {
      ctx.fillText(tip, cx, y);
      y += 20;
    }
  }

  /* ── Quick-reference banner for early levels ── */
  let quickRefTimer = 0; // counts down from level start

  function drawQuickRef() {
    if (state !== STATE_PLAYING || currentLevel >= 3 || quickRefTimer <= 0)
      return;

    const alpha = Math.min(1, quickRefTimer / 2);
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;

    const bx = GRID_OFFSET_X;
    const by = 4;
    const bw = GRID_COLS * TILE_SIZE;
    const bh = 32;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(bx, by, bw, bh);

    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const tips = [
      'Select an element below (1-4), then click a glowing tile to cast it. Clear obstacles to reach the star!',
      'Fill channels with Water [2/W], burn wood with Fire [1/Q]. Hover tiles for hints.',
      'Push blocks with Air [4/R], build walls with Earth [3/E]. Find hidden runes by casting nearby.'
    ];
    ctx.fillText(tips[currentLevel] || tips[0], bx + bw / 2, by + bh / 2);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawHUD() {
    if (state === STATE_READY && !showingTutorial) {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#c8f';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('FANTASY PUZZLE', CANVAS_W / 2, CANVAS_H / 2 - 100);

      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('Manipulate fire, water, earth, and air to solve magical puzzles.', CANVAS_W / 2, CANVAS_H / 2 - 65);

      // Quick how-to-play summary
      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      const quickHelp = [
        'Select an element, then click a tile to cast it.',
        'Clear all obstacles and hidden runes, then reach the golden star.',
        'Fewer moves = more stars!'
      ];
      for (let i = 0; i < quickHelp.length; ++i)
        ctx.fillText(quickHelp[i], CANVAS_W / 2, CANVAS_H / 2 - 38 + i * 16);

      // Element preview
      ctx.font = '22px sans-serif';
      for (let i = 0; i < ELEMENTS.length; ++i) {
        const elem = ELEMENTS[i];
        const ex = CANVAS_W / 2 - 120 + i * 80;
        ctx.fillText(elem.icon, ex, CANVAS_H / 2 + 25);
        ctx.fillStyle = elem.color;
        ctx.font = '11px sans-serif';
        ctx.fillText(elem.name, ex, CANVAS_H / 2 + 45);
        ctx.fillStyle = '#aaa';
        ctx.font = '22px sans-serif';
      }

      // Element brief descriptions
      ctx.font = '9px sans-serif';
      const elemDescs = ['Burns wood', 'Fills channels', 'Creates walls', 'Pushes blocks'];
      for (let i = 0; i < ELEMENTS.length; ++i) {
        const ex = CANVAS_W / 2 - 120 + i * 80;
        ctx.fillStyle = '#666';
        ctx.fillText(elemDescs[i], ex, CANVAS_H / 2 + 57);
      }

      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Click or press F2 to Start', CANVAS_W / 2, CANVAS_H / 2 + 80);
      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.fillText('Press F1 for full How to Play guide', CANVAS_W / 2, CANVAS_H / 2 + 100);
      ctx.textAlign = 'start';
    }

    if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
      ctx.textAlign = 'start';
    }

    if (state === STATE_LEVEL_COMPLETE) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LEVEL COMPLETE!', CANVAS_W / 2, CANVAS_H / 2 - 10);
      ctx.fillStyle = '#ccc';
      ctx.font = '14px sans-serif';
      ctx.fillText('Tap or press any key for next level', CANVAS_W / 2, CANVAS_H / 2 + 20);
      ctx.textAlign = 'start';
    }

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#c8f';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ALL PUZZLES SOLVED!', CANVAS_W / 2, CANVAS_H / 2 - 30);
      ctx.fillStyle = '#ccc';
      ctx.font = '16px sans-serif';
      const totalStars = Object.values(levelStars).reduce((a, b) => a + b, 0);
      ctx.fillText(`Total Stars: ${totalStars} / ${LEVELS.length * 3}`, CANVAS_W / 2, CANVAS_H / 2 + 10);
      ctx.fillText('Tap or press F2 to play again', CANVAS_W / 2, CANVAS_H / 2 + 40);
      ctx.textAlign = 'start';
    }
  }

  function drawGame() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (state === STATE_PLAYING || state === STATE_LEVEL_COMPLETE) {
      drawGrid();
      drawElementSelector();
      drawObjectives();
      drawHintOverlay();
      drawQuickRef();
      drawTooltip();
    }

    drawHUD();
    drawTutorial();
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusLevel) statusLevel.textContent = `Level: ${currentLevel + 1}/${LEVELS.length}`;
    if (statusElement) {
      const elem = ELEMENTS.find(e => e.id === selectedElement);
      statusElement.textContent = `Element: ${elem ? elem.name : '—'}`;
    }
    if (statusMoves) statusMoves.textContent = `Moves: ${moves}`;
    if (statusStars) {
      const s = levelStars[currentLevel] || 0;
      statusStars.textContent = `Stars: ${'★'.repeat(s)}${'☆'.repeat(3 - s)}`;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  let lastTimestamp = 0;
  let animFrameId = null;

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    updateGame(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    screenShake.apply(ctx);
    drawGame();
    particles.draw(ctx);
    floatingText.draw(ctx);
    ctx.restore();

    updateStatusBar();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT
     ══════════════════════════════════════════════════════════════════ */

  function selectElement(elemId) {
    if (selectedElement !== elemId) {
      selectedElement = elemId;
      elementSwitchAnim = 1.0; // trigger transition animation
    }
  }

  window.addEventListener('keydown', (e) => {
    // Tutorial navigation
    if (showingTutorial) {
      e.preventDefault();
      if (e.code === 'Escape') {
        showingTutorial = false;
        if (!tutorialSeen) {
          tutorialSeen = true;
          saveTutorialSeen();
        }
        return;
      }
      advanceTutorial();
      return;
    }

    // F1 — How to Play (tutorial)
    if (e.code === 'F1') {
      e.preventDefault();
      showingTutorial = true;
      tutorialPage = 0;
      return;
    }

    if (e.code === 'F2') {
      e.preventDefault();
      loadLevel(state === STATE_GAME_OVER ? 0 : currentLevel);
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_PLAYING;
      return;
    }

    if (state === STATE_LEVEL_COMPLETE) {
      nextLevel();
      return;
    }

    if (state !== STATE_PLAYING) return;

    // H — show level hint again
    if (e.code === 'KeyH') {
      hintOverlayAlpha = 1.0;
      hintOverlayText = LEVELS[currentLevel].hint || '';
      return;
    }

    // Element selection
    if (e.key === '1' || e.code === 'KeyQ') selectElement(ELEMENT_FIRE);
    if (e.key === '2' || e.code === 'KeyW') selectElement(ELEMENT_WATER);
    if (e.key === '3' || e.code === 'KeyE') selectElement(ELEMENT_EARTH);
    if (e.key === '4' || e.code === 'KeyR') selectElement(ELEMENT_AIR);
  });

  function advanceTutorial() {
    ++tutorialPage;
    if (tutorialPage >= TUTORIAL_PAGES) {
      showingTutorial = false;
      if (!tutorialSeen) {
        tutorialSeen = true;
        saveTutorialSeen();
      }
    }
  }

  /* ── Click/Tap handling ── */
  canvas.addEventListener('pointerdown', (e) => {
    // Tutorial click advances page
    if (showingTutorial) {
      advanceTutorial();
      return;
    }

    if (state === STATE_READY) {
      loadLevel(0);
      return;
    }

    if (state === STATE_GAME_OVER) {
      loadLevel(0);
      return;
    }

    if (state === STATE_LEVEL_COMPLETE) {
      nextLevel();
      return;
    }

    if (state !== STATE_PLAYING) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Check grid click
    const col = Math.floor((mx - GRID_OFFSET_X) / TILE_SIZE);
    const row = Math.floor((my - GRID_OFFSET_Y) / TILE_SIZE);

    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS)
      castElement(row, col);

    // Check element selector bar
    const barY = CANVAS_H - 48;
    if (my >= barY) {
      for (let i = 0; i < ELEMENTS.length; ++i) {
        const bx = 20 + i * 90;
        if (mx >= bx && mx <= bx + 80)
          selectElement(ELEMENTS[i].id);
      }
    }
  });

  /* ── Hover tracking for tooltips ── */
  canvas.addEventListener('pointermove', (e) => {
    if (state !== STATE_PLAYING) {
      hoverRow = -1;
      hoverCol = -1;
      tooltipText = '';
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    tooltipX = mx;
    tooltipY = my;

    const col = Math.floor((mx - GRID_OFFSET_X) / TILE_SIZE);
    const row = Math.floor((my - GRID_OFFSET_Y) / TILE_SIZE);

    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
      hoverRow = row;
      hoverCol = col;
      tooltipText = getTileTooltip(grid[row][col]);
    } else {
      hoverRow = -1;
      hoverCol = -1;

      // Check element bar tooltips
      const barY = CANVAS_H - 48;
      if (my >= barY) {
        for (let i = 0; i < ELEMENTS.length; ++i) {
          const bx = 20 + i * 90;
          if (mx >= bx && mx <= bx + 80) {
            tooltipText = getElementTooltip(ELEMENTS[i]);
            return;
          }
        }
      }
      tooltipText = '';
    }
  });

  canvas.addEventListener('pointerleave', () => {
    hoverRow = -1;
    hoverCol = -1;
    tooltipText = '';
  });

  function getTileTooltip(tile) {
    switch (tile) {
      case T_EMPTY:      return 'Empty tile - place Earth walls here [3/E]';
      case T_WALL:       return 'Wall - impassable';
      case T_WOOD:       return 'Wood - burn with Fire [1/Q]';
      case T_CHANNEL:    return 'Channel - fill with Water [2/W]';
      case T_FILLED:     return 'Filled channel - water already here';
      case T_BLOCK:      return 'Block - push with Air [4/R]';
      case T_EARTH_WALL: return 'Earth wall - you created this';
      case T_RUNE:       return 'Shimmer... cast nearby to reveal';
      case T_RUNE_ACTIVE:return 'Rune - discovered!';
      case T_GOAL:       return 'Goal - clear all obstacles to complete';
      default:           return '';
    }
  }

  function getElementTooltip(elem) {
    switch (elem.id) {
      case ELEMENT_FIRE:  return 'Fire [1/Q]: Burns wood obstacles';
      case ELEMENT_WATER: return 'Water [2/W]: Fills empty channels';
      case ELEMENT_EARTH: return 'Earth [3/E]: Creates walls on empty tiles';
      case ELEMENT_AIR:   return 'Air [4/R]: Pushes movable blocks';
      default: return elem.name;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        loadLevel(state === STATE_GAME_OVER ? 0 : currentLevel);
        break;
      case 'pause':
        if (state === STATE_PLAYING)
          state = STATE_PAUSED;
        else if (state === STATE_PAUSED)
          state = STATE_PLAYING;
        break;
      case 'hint':
        if (state === STATE_PLAYING) {
          hintOverlayAlpha = 1.0;
          hintOverlayText = LEVELS[currentLevel].hint || '';
        }
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
        showingTutorial = true;
        tutorialPage = 0;
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
    const levelName = LEVELS[currentLevel]?.name || '';
    const title = state === STATE_GAME_OVER
      ? 'Fantasy Puzzle — All Complete!'
      : `Fantasy Puzzle — Level ${currentLevel + 1}: ${levelName}`;
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

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  loadProgress();
  loadHighScores();
  loadTutorialSeen();
  updateWindowTitle();

  // Show tutorial automatically for first-time players
  if (!tutorialSeen) {
    showingTutorial = true;
    tutorialPage = 0;
  }

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
