;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 700;
  const CANVAS_H = 500;
  const MAX_DT = 0.05;
  const TWO_PI = Math.PI * 2;

  /* ── Grid ── */
  const GRID_COLS = 8;
  const GRID_ROWS = 6;
  const TILE_SIZE = 56;
  const GRID_OFFSET_X = 30;
  const GRID_OFFSET_Y = 60;

  /* ── States ── */
  const STATE_READY = 'READY';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-space-farming';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 5;

  /* ── Crop Definitions ── */
  const CROPS = [
    { name: 'Space Wheat',  icon: '🌾', color: '#da2', growTime: 8,  stages: 4, sellPrice: 10, seedCost: 5  },
    { name: 'Star Fruit',   icon: '⭐', color: '#f80', growTime: 14, stages: 4, sellPrice: 25, seedCost: 12 },
    { name: 'Nebula Berry',  icon: '🫐', color: '#a3f', growTime: 10, stages: 4, sellPrice: 15, seedCost: 8  },
    { name: 'Lunar Lettuce', icon: '🥬', color: '#5d5', growTime: 6,  stages: 3, sellPrice: 8,  seedCost: 3  },
    { name: 'Cosmic Corn',  icon: '🌽', color: '#ec3', growTime: 12, stages: 4, sellPrice: 20, seedCost: 10 },
    { name: 'Crystal Melon', icon: '🍈', color: '#0da', growTime: 18, stages: 5, sellPrice: 40, seedCost: 20 },
    { name: 'Solar Tomato',  icon: '🍅', color: '#e33', growTime: 9,  stages: 4, sellPrice: 12, seedCost: 6  }
  ];

  /* ── Livestock Definitions ── */
  const LIVESTOCK = [
    { name: 'Space Cow',     icon: '🐄', color: '#ddd', feedInterval: 12, produce: 'Milk',      produceIcon: '🥛', produceValue: 18, cost: 50 },
    { name: 'Star Hen',      icon: '🐔', color: '#fb4', feedInterval: 8,  produce: 'Egg',       produceIcon: '🥚', produceValue: 10, cost: 30 },
    { name: 'Nebula Goat',   icon: '🐐', color: '#c96', feedInterval: 10, produce: 'Wool',      produceIcon: '🧶', produceValue: 14, cost: 40 },
    { name: 'Crystal Chick', icon: '🐣', color: '#ff8', feedInterval: 6,  produce: 'Feather',   produceIcon: '🪶', produceValue: 6,  cost: 15 }
  ];

  /* ── Weather ── */
  const WEATHER_NONE = 'none';
  const WEATHER_SOLAR_FLARE = 'solarFlare';
  const WEATHER_METEOR_SHOWER = 'meteorShower';
  const WEATHER_DURATION = 8;
  const WEATHER_MIN_INTERVAL = 25;
  const WEATHER_MAX_INTERVAL = 50;

  /* ── Shop modes ── */
  const TOOL_PLANT = 'plant';
  const TOOL_HARVEST = 'harvest';
  const TOOL_FEED = 'feed';

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusCredits = document.getElementById('statusCredits');
  const statusTool = document.getElementById('statusTool');
  const statusWeather = document.getElementById('statusWeather');
  const statusDay = document.getElementById('statusDay');
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
  let credits = 100;
  let selectedCropIndex = 0;
  let selectedTool = TOOL_PLANT;
  let gameTime = 0;
  let dayCount = 0;

  // Farm grid: each cell is null or { cropIndex, growthProgress, growthStage, plantAnim }
  let farmGrid = [];

  // Livestock pens: array of { typeIndex, feedTimer, produceReady, x, y }
  let livestockPens = [];

  // Inventory: { cropName: count }
  let inventory = {};

  // Weather
  let weatherType = WEATHER_NONE;
  let weatherTimer = 0;
  let weatherInterval = 0;
  let weatherEffect = 0; // visual overlay alpha
  let overlayAlpha = 0;

  // High scores
  let highScores = [];

  // Input
  const keys = {};

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

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

  function addHighScore(earned, days) {
    highScores.push({ credits: earned, days });
    highScores.sort((a, b) => b.credits - a.credits);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    if (!highScoresBody) return;
    highScoresBody.innerHTML = '';
    for (let i = 0; i < highScores.length; ++i) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${highScores[i].credits}</td><td>${highScores[i].days}</td>`;
      highScoresBody.appendChild(tr);
    }
    if (!highScores.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center">No scores yet</td>';
      highScoresBody.appendChild(tr);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME INIT / RESET
     ══════════════════════════════════════════════════════════════════ */

  function resetGame() {
    credits = 100;
    selectedCropIndex = 0;
    selectedTool = TOOL_PLANT;
    gameTime = 0;
    dayCount = 1;
    inventory = {};

    // Initialize empty farm grid
    farmGrid = [];
    for (let r = 0; r < GRID_ROWS; ++r) {
      const row = [];
      for (let c = 0; c < GRID_COLS; ++c)
        row.push(null); // empty tile
      farmGrid.push(row);
    }

    // Start with no livestock
    livestockPens = [];

    // Weather reset
    weatherType = WEATHER_NONE;
    weatherTimer = 0;
    weatherInterval = WEATHER_MIN_INTERVAL + Math.random() * (WEATHER_MAX_INTERVAL - WEATHER_MIN_INTERVAL);
    overlayAlpha = 0;

    state = STATE_PLAYING;
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     FARM GRID OPERATIONS
     ══════════════════════════════════════════════════════════════════ */

  function plantCrop(row, col) {
    if (state !== STATE_PLAYING) return;
    if (farmGrid[row][col] !== null) return; // not empty
    const crop = CROPS[selectedCropIndex];
    if (credits < crop.seedCost) return;

    credits -= crop.seedCost;
    farmGrid[row][col] = {
      cropIndex: selectedCropIndex,
      growthProgress: 0,
      growthStage: 0,
      plantAnim: 1.0 // plantAnim scale bounce
    };

    // Planting animation sparkle
    const tx = GRID_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2;
    const ty = GRID_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2;
    particles.sparkle(tx, ty, 6, { color: crop.color, speed: 2 });
    floatingText.add(tx, ty - 10, `-${crop.seedCost}cr`, { color: '#f88', font: 'bold 12px sans-serif' });
  }

  function harvestCrop(row, col) {
    if (state !== STATE_PLAYING) return;
    const cell = farmGrid[row][col];
    if (!cell) return;

    const crop = CROPS[cell.cropIndex];
    const maxStage = crop.stages - 1;
    if (cell.growthStage < maxStage) return; // not mature yet

    // Harvest particle burst
    const tx = GRID_OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2;
    const ty = GRID_OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2;
    particles.burst(tx, ty, 12, { color: crop.color, speed: 3, life: 0.6 });

    // Add to inventory
    if (!inventory[crop.name])
      inventory[crop.name] = 0;
    ++inventory[crop.name];

    floatingText.add(tx, ty - 10, `+1 ${crop.name}`, { color: '#0f0', font: 'bold 12px sans-serif' });

    farmGrid[row][col] = null; // clear tile
  }

  /* ══════════════════════════════════════════════════════════════════
     CROP GROWTH
     ══════════════════════════════════════════════════════════════════ */

  function updateCrops(dt) {
    if (state !== STATE_PLAYING) return;

    // Growth multiplier from weather
    let growthBoost = 1;
    if (weatherType === WEATHER_SOLAR_FLARE)
      growthBoost = 2; // solarFlare boost growth

    for (let r = 0; r < GRID_ROWS; ++r) {
      for (let c = 0; c < GRID_COLS; ++c) {
        const cell = farmGrid[r][c];
        if (!cell) continue;

        const crop = CROPS[cell.cropIndex];
        const maxStage = crop.stages - 1;

        // Advance growth progress
        cell.growthProgress += (dt / crop.growTime) * growthBoost;

        // Check stage advancement
        const newStage = Math.min(maxStage, Math.floor(cell.growthProgress * crop.stages));
        if (newStage > cell.growthStage) {
          cell.growthStage = newStage;
          // Growth sparkle effect on stage change
          const tx = GRID_OFFSET_X + c * TILE_SIZE + TILE_SIZE / 2;
          const ty = GRID_OFFSET_Y + r * TILE_SIZE + TILE_SIZE / 2;
          particles.sparkle(tx, ty, 4, { color: crop.color, speed: 1.5 });
        }

        // Plant animation decay
        if (cell.plantAnim > 0)
          cell.plantAnim = Math.max(0, cell.plantAnim - dt * 3);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     LIVESTOCK
     ══════════════════════════════════════════════════════════════════ */

  function updateLivestock(dt) {
    if (state !== STATE_PLAYING) return;

    for (let i = 0; i < livestockPens.length; ++i) {
      const pen = livestockPens[i];
      const def = LIVESTOCK[pen.typeIndex];
      pen.feedTimer -= dt;
      if (pen.feedTimer <= 0)
        pen.produceReady = true;
    }
  }

  function feedAndCollect(penIndex) {
    if (state !== STATE_PLAYING) return;
    const pen = livestockPens[penIndex];
    if (!pen || !pen.produceReady) return;

    const def = LIVESTOCK[pen.typeIndex];
    pen.produceReady = false;
    pen.feedTimer = def.feedInterval;

    // Collect produce
    if (!inventory[def.produce])
      inventory[def.produce] = 0;
    ++inventory[def.produce];

    floatingText.add(pen.x, pen.y - 10, `+1 ${def.produce}`, { color: '#0f0', font: 'bold 12px sans-serif' });
    particles.sparkle(pen.x, pen.y, 5, { color: def.color, speed: 1.5 });
  }

  function buyLivestock(typeIndex) {
    if (state !== STATE_PLAYING) return;
    const def = LIVESTOCK[typeIndex];
    if (credits < def.cost) return;

    credits -= def.cost;
    const penX = 520 + (livestockPens.length % 2) * 80;
    const penY = 80 + Math.floor(livestockPens.length / 2) * 90;

    livestockPens.push({
      typeIndex,
      feedTimer: def.feedInterval,
      produceReady: false,
      x: penX,
      y: penY
    });

    floatingText.add(penX, penY - 15, `-${def.cost}cr`, { color: '#f88', font: 'bold 12px sans-serif' });
  }

  /* ══════════════════════════════════════════════════════════════════
     SHOP — SELL & BUY
     ══════════════════════════════════════════════════════════════════ */

  function sellAllProduce() {
    if (state !== STATE_PLAYING) return;
    let totalEarned = 0;

    for (const crop of CROPS) {
      const count = inventory[crop.name] || 0;
      if (count > 0) {
        const earned = count * crop.sellPrice;
        credits += earned;
        totalEarned += earned;
        delete inventory[crop.name];
      }
    }

    for (const live of LIVESTOCK) {
      const count = inventory[live.produce] || 0;
      if (count > 0) {
        const earned = count * live.produceValue;
        credits += earned;
        totalEarned += earned;
        delete inventory[live.produce];
      }
    }

    if (totalEarned > 0) {
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 20, `+${totalEarned} credits`, { color: '#ff0', font: 'bold 16px sans-serif' });
      screenShake.trigger(3, 150);
    }
  }

  function buySeed(cropIndex) {
    if (state !== STATE_PLAYING) return;
    selectedCropIndex = cropIndex;
    selectedTool = TOOL_PLANT;
  }

  /* ══════════════════════════════════════════════════════════════════
     WEATHER EVENTS
     ══════════════════════════════════════════════════════════════════ */

  function updateWeather(dt) {
    if (state !== STATE_PLAYING) return;

    if (weatherType === WEATHER_NONE) {
      weatherInterval -= dt;
      if (weatherInterval <= 0)
        triggerWeather();
    } else {
      weatherTimer -= dt;
      overlayAlpha = Math.min(0.3, overlayAlpha + dt * 0.5);

      if (weatherTimer <= 0) {
        weatherType = WEATHER_NONE;
        overlayAlpha = 0;
        weatherInterval = WEATHER_MIN_INTERVAL + Math.random() * (WEATHER_MAX_INTERVAL - WEATHER_MIN_INTERVAL);
      }
    }
  }

  function triggerWeather() {
    if (Math.random() < 0.5) {
      weatherType = WEATHER_SOLAR_FLARE;
      floatingText.add(CANVAS_W / 2, 30, 'SOLAR FLARE — Growth Boost!', { color: '#ff0', font: 'bold 14px sans-serif' });
    } else {
      weatherType = WEATHER_METEOR_SHOWER;
      floatingText.add(CANVAS_W / 2, 30, 'METEOR SHOWER — Crop Damage!', { color: '#f44', font: 'bold 14px sans-serif' });
      // meteorShower damage crops — destroy random crops
      for (let r = 0; r < GRID_ROWS; ++r) {
        for (let c = 0; c < GRID_COLS; ++c) {
          if (farmGrid[r][c] && Math.random() < 0.2) {
            const tx = GRID_OFFSET_X + c * TILE_SIZE + TILE_SIZE / 2;
            const ty = GRID_OFFSET_Y + r * TILE_SIZE + TILE_SIZE / 2;
            particles.burst(tx, ty, 8, { color: '#f44', speed: 3, life: 0.4 });
            farmGrid[r][c] = null; // destroy crop
          }
        }
      }
      screenShake.trigger(8, 400);
    }
    weatherTimer = WEATHER_DURATION;
  }

  /* ══════════════════════════════════════════════════════════════════
     DAY CYCLE
     ══════════════════════════════════════════════════════════════════ */

  function updateDayCycle(dt) {
    if (state !== STATE_PLAYING) return;
    const prevDay = Math.floor(gameTime / 30);
    gameTime += dt;
    const curDay = Math.floor(gameTime / 30);
    if (curDay > prevDay) {
      ++dayCount;
      updateWindowTitle();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE
     ══════════════════════════════════════════════════════════════════ */

  function updateGame(dt) {
    if (state === STATE_PAUSED) return;

    updateDayCycle(dt);
    updateCrops(dt);
    updateLivestock(dt);
    updateWeather(dt);
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawGrid() {
    for (let r = 0; r < GRID_ROWS; ++r) {
      for (let c = 0; c < GRID_COLS; ++c) {
        const x = GRID_OFFSET_X + c * TILE_SIZE;
        const y = GRID_OFFSET_Y + r * TILE_SIZE;
        const cell = farmGrid[r][c];

        // Draw soil tile
        ctx.fillStyle = cell ? '#3a2a1a' : '#2a1a0a';
        ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        ctx.strokeStyle = '#5a4a3a';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);

        if (cell) {
          const crop = CROPS[cell.cropIndex];
          const maxStage = crop.stages - 1;
          const mature = cell.growthStage >= maxStage;

          // Growth indicator bar
          const progress = Math.min(1, cell.growthProgress);
          ctx.fillStyle = mature ? '#0f0' : crop.color;
          ctx.fillRect(x + 3, y + TILE_SIZE - 6, (TILE_SIZE - 6) * progress, 3);

          // Crop icon with plantAnim scale bounce
          const scale = cell.plantAnim > 0 ? 1 + Math.sin(cell.plantAnim * Math.PI) * 0.4 : 1;
          ctx.save();
          ctx.translate(x + TILE_SIZE / 2, y + TILE_SIZE / 2 - 4);
          ctx.scale(scale, scale);
          ctx.font = `${14 + cell.growthStage * 3}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(crop.icon, 0, 0);
          ctx.restore();

          // Glow on mature crops
          if (mature) {
            ctx.shadowBlur = 8;
            ctx.shadowColor = crop.color;
            ctx.fillStyle = 'transparent';
            ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
            ctx.shadowBlur = 0;
          }
        }
      }
    }
  }

  function drawLivestock() {
    for (let i = 0; i < livestockPens.length; ++i) {
      const pen = livestockPens[i];
      const def = LIVESTOCK[pen.typeIndex];

      // Pen background
      ctx.fillStyle = '#1a2a1a';
      ctx.fillRect(pen.x - 30, pen.y - 25, 60, 55);
      ctx.strokeStyle = '#4a5a4a';
      ctx.lineWidth = 1;
      ctx.strokeRect(pen.x - 30, pen.y - 25, 60, 55);

      // Animal icon
      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, pen.x, pen.y);

      // Ready indicator
      if (pen.produceReady) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#0f0';
        ctx.font = '14px sans-serif';
        ctx.fillText(def.produceIcon, pen.x + 18, pen.y - 15);
        ctx.shadowBlur = 0;
      }
    }
  }

  function drawWeatherOverlay() {
    if (weatherType === WEATHER_NONE) return;

    if (weatherType === WEATHER_SOLAR_FLARE) {
      ctx.fillStyle = `rgba(255,200,0,${overlayAlpha * 0.5})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // Sun rays
      for (let i = 0; i < 5; ++i) {
        const rx = Math.random() * CANVAS_W;
        const ry = Math.random() * CANVAS_H;
        ctx.beginPath();
        ctx.arc(rx, ry, 2, 0, TWO_PI);
        ctx.fillStyle = 'rgba(255,255,100,0.4)';
        ctx.fill();
      }
    } else if (weatherType === WEATHER_METEOR_SHOWER) {
      ctx.fillStyle = `rgba(255,50,50,${overlayAlpha * 0.3})`;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      // Falling meteors
      for (let i = 0; i < 3; ++i) {
        const mx = Math.random() * CANVAS_W;
        const my = Math.random() * CANVAS_H;
        ctx.beginPath();
        ctx.arc(mx, my, 3, 0, TWO_PI);
        ctx.fillStyle = '#f80';
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#f80';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  function drawUI() {
    // Crop selection bar at bottom
    const barY = CANVAS_H - 45;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, barY, CANVAS_W, 45);

    for (let i = 0; i < CROPS.length; ++i) {
      const bx = 10 + i * 60;
      const selected = i === selectedCropIndex && selectedTool === TOOL_PLANT;
      ctx.fillStyle = selected ? '#444' : '#222';
      ctx.fillRect(bx, barY + 4, 52, 37);
      if (selected) {
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, barY + 4, 52, 37);
      }
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(CROPS[i].icon, bx + 16, barY + 26);
      ctx.fillStyle = credits >= CROPS[i].seedCost ? '#aaa' : '#f44';
      ctx.font = '9px sans-serif';
      ctx.fillText(`${CROPS[i].seedCost}cr`, bx + 40, barY + 26);
    }

    // Sell button
    ctx.fillStyle = '#040';
    ctx.fillRect(CANVAS_W - 75, barY + 4, 65, 37);
    ctx.strokeStyle = '#0a0';
    ctx.lineWidth = 1;
    ctx.strokeRect(CANVAS_W - 75, barY + 4, 65, 37);
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SELL ALL', CANVAS_W - 42, barY + 26);

    // Livestock buy area
    ctx.fillStyle = '#aaa';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Livestock:', 510, GRID_OFFSET_Y - 10);

    for (let i = 0; i < LIVESTOCK.length; ++i) {
      const ly = GRID_OFFSET_Y + i * 25;
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#bbb';
      ctx.fillText(`${LIVESTOCK[i].icon} ${LIVESTOCK[i].cost}cr`, 510, ly + 10);
    }
  }

  function drawHUD() {
    if (state === STATE_READY) {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#4d4';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SPACE FARMING', CANVAS_W / 2, CANVAS_H / 2 - 40);
      ctx.fillStyle = '#888';
      ctx.font = '14px sans-serif';
      ctx.fillText('Grow crops, tend livestock, sell produce on your space station.', CANVAS_W / 2, CANVAS_H / 2);
      ctx.fillText('Tap or press F2 to Start', CANVAS_W / 2, CANVAS_H / 2 + 30);
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

    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#f80';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SEASON OVER', CANVAS_W / 2, CANVAS_H / 2 - 25);
      ctx.fillStyle = '#ccc';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Credits: ${credits} — Days: ${dayCount}`, CANVAS_W / 2, CANVAS_H / 2 + 10);
      ctx.fillText('Tap or press F2 to play again', CANVAS_W / 2, CANVAS_H / 2 + 40);
      ctx.textAlign = 'start';
    }
  }

  function drawGame() {
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (state === STATE_PLAYING || state === STATE_GAME_OVER) {
      drawGrid();
      drawLivestock();
      drawWeatherOverlay();
      drawUI();
    }

    drawHUD();
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    if (statusCredits) statusCredits.textContent = `Credits: ${credits}`;
    if (statusTool) statusTool.textContent = `Tool: ${selectedTool}`;
    if (statusWeather) statusWeather.textContent = `Weather: ${weatherType === WEATHER_NONE ? 'Clear' : weatherType}`;
    if (statusDay) statusDay.textContent = `Day: ${dayCount}`;
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

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (e.code === 'F2') {
      e.preventDefault();
      resetGame();
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING)
        state = STATE_PAUSED;
      else if (state === STATE_PAUSED)
        state = STATE_PLAYING;
    }

    // Number keys 1-7 to select crop
    if (state === STATE_PLAYING) {
      const num = parseInt(e.key);
      if (num >= 1 && num <= CROPS.length) {
        selectedCropIndex = num - 1;
        selectedTool = TOOL_PLANT;
      }
      if (e.code === 'KeyS')
        sellAllProduce();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  /* ── Click/Tap handling ── */
  canvas.addEventListener('pointerdown', (e) => {
    if (state === STATE_READY || state === STATE_GAME_OVER) {
      resetGame();
      return;
    }

    if (state !== STATE_PLAYING) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Check farm grid click
    const col = Math.floor((mx - GRID_OFFSET_X) / TILE_SIZE);
    const row = Math.floor((my - GRID_OFFSET_Y) / TILE_SIZE);

    if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
      if (farmGrid[row][col] === null)
        plantCrop(row, col);
      else
        harvestCrop(row, col);
      return;
    }

    // Check sell button click
    const barY = CANVAS_H - 45;
    if (mx >= CANVAS_W - 75 && mx <= CANVAS_W - 10 && my >= barY + 4 && my <= barY + 41) {
      sellAllProduce();
      return;
    }

    // Check crop selection bar
    if (my >= barY && my <= CANVAS_H) {
      const cropIdx = Math.floor((mx - 10) / 60);
      if (cropIdx >= 0 && cropIdx < CROPS.length) {
        selectedCropIndex = cropIdx;
        selectedTool = TOOL_PLANT;
      }
      return;
    }

    // Check livestock pen click (feeding/collecting)
    for (let i = 0; i < livestockPens.length; ++i) {
      const pen = livestockPens[i];
      if (mx >= pen.x - 30 && mx <= pen.x + 30 && my >= pen.y - 25 && my <= pen.y + 30) {
        feedAndCollect(i);
        return;
      }
    }

    // Check livestock buy area
    for (let i = 0; i < LIVESTOCK.length; ++i) {
      const ly = GRID_OFFSET_Y + i * 25;
      if (mx >= 510 && mx <= 640 && my >= ly && my <= ly + 20) {
        buyLivestock(i);
        return;
      }
    }
  });

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        resetGame();
        break;
      case 'pause':
        if (state === STATE_PLAYING)
          state = STATE_PAUSED;
        else if (state === STATE_PAUSED)
          state = STATE_PLAYING;
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
    const title = state === STATE_GAME_OVER
      ? `Space Farming — Season Over — ${credits}cr`
      : `Space Farming — Day ${dayCount} — ${credits}cr`;
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
  loadHighScores();
  updateWindowTitle();

  lastTimestamp = 0;
  animFrameId = requestAnimationFrame(gameLoop);

})();
