;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 900;
  const CANVAS_H = 600;
  const MAX_DT = 0.05;

  /* ── Game states ── */
  const STATE_MENU = 'MENU';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_COOKING = 'COOKING';
  const STATE_DAY_OVER = 'DAY_OVER';
  const STATE_UPGRADE = 'UPGRADE';
  const STATE_GAME_OVER = 'GAME_OVER';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-cooking-game';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 10;

  /* ── Restaurant layout ── */
  const COUNTER_Y = 340;
  const CUSTOMER_Y = 120;
  const STATION_Y = 440;
  const MAX_CUSTOMERS = 4;
  const STATION_CENTER_X = 900 / 2;  // CANVAS_W / 2 — used by cooking functions
  const STATION_CENTER_Y = STATION_Y + 30;

  /* ══════════════════════════════════════════════════════════════════
     RECIPES — 5+ dishes, each with 2-4 steps
     ══════════════════════════════════════════════════════════════════ */

  const RECIPES = [
    {
      name: 'Burger',
      color: '#a64',
      steps: [
        { action: 'grill', label: 'Grill Patty', duration: 2.5, greenZone: [0.4, 0.7] },
        { action: 'plate', label: 'Assemble Bun', duration: 1.5, greenZone: [0.3, 0.8] }
      ],
      tip: 15, difficulty: 1
    },
    {
      name: 'Pasta',
      color: '#ea4',
      steps: [
        { action: 'boil', label: 'Boil Water', duration: 2.0, greenZone: [0.5, 0.8] },
        { action: 'fry', label: 'Cook Pasta', duration: 2.5, greenZone: [0.35, 0.65] },
        { action: 'mix', label: 'Add Sauce', duration: 1.5, greenZone: [0.3, 0.8] }
      ],
      tip: 25, difficulty: 2
    },
    {
      name: 'Pizza',
      color: '#e44',
      steps: [
        { action: 'mix', label: 'Roll Dough', duration: 2.0, greenZone: [0.4, 0.7] },
        { action: 'chop', label: 'Add Toppings', duration: 1.5, greenZone: [0.3, 0.8] },
        { action: 'bake', label: 'Bake in Oven', duration: 3.0, greenZone: [0.45, 0.7] }
      ],
      tip: 30, difficulty: 2
    },
    {
      name: 'Salad',
      color: '#4a4',
      steps: [
        { action: 'chop', label: 'Chop Vegetables', duration: 2.0, greenZone: [0.35, 0.7] },
        { action: 'mix', label: 'Mix Dressing', duration: 1.5, greenZone: [0.4, 0.8] }
      ],
      tip: 12, difficulty: 1
    },
    {
      name: 'Sushi',
      color: '#48a',
      steps: [
        { action: 'boil', label: 'Prepare Rice', duration: 2.0, greenZone: [0.45, 0.7] },
        { action: 'chop', label: 'Slice Fish', duration: 2.0, greenZone: [0.4, 0.65] },
        { action: 'flip', label: 'Roll Maki', duration: 2.5, greenZone: [0.35, 0.6] },
        { action: 'plate', label: 'Plate Dish', duration: 1.5, greenZone: [0.3, 0.8] }
      ],
      tip: 40, difficulty: 3
    },
    {
      name: 'Steak',
      color: '#844',
      steps: [
        { action: 'season', label: 'Season Meat', duration: 1.5, greenZone: [0.3, 0.8] },
        { action: 'grill', label: 'Grill Steak', duration: 3.0, greenZone: [0.42, 0.62] },
        { action: 'plate', label: 'Plate & Garnish', duration: 1.5, greenZone: [0.3, 0.8] }
      ],
      tip: 35, difficulty: 3
    }
  ];

  /* ── Upgrades ── */
  const UPGRADES = [
    { id: 'speed',    name: 'Faster Cooking',  cost: 50,  desc: 'Cook 20% faster',    bought: false },
    { id: 'patience', name: 'Comfy Seats',     cost: 40,  desc: 'Customers wait longer', bought: false },
    { id: 'tips',     name: 'Charm School',    cost: 60,  desc: '+25% tip bonus',      bought: false },
    { id: 'station',  name: 'Extra Station',   cost: 80,  desc: 'Cook two dishes at once', bought: false },
    { id: 'attract',  name: 'Neon Sign',       cost: 70,  desc: 'More customers visit', bought: false }
  ];

  function hasUpgrade(id) { return UPGRADES.find(u => u.id === id)?.bought ?? false; }

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const User32 = SZ.Dlls?.User32;

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════════
     VISUAL EFFECTS
     ══════════════════════════════════════════════════════════════════ */

  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = STATE_MENU;
  let day = 1;
  let money = 0;
  let totalServed = 0;
  let dayServed = 0;
  let dayMissed = 0;
  let lastTimestamp = 0;

  /* ── Customer state ── */
  let customers = [];
  let customerSpawnTimer = 0;
  let customerSpawnInterval = 4.0;
  let customersToSpawn = 0;

  /* ── Cooking state ── */
  let activeDish = null;        // { recipe, stepIndex, progress, result }
  let cookingProgress = 0;      // 0..1 progress bar for timing minigame
  let cookingSpeed = 0.4;       // how fast the bar moves
  let cookedDishes = [];         // ready to serve

  /* ── Day configuration ── */
  let dayCustomerCount = 5;
  let dayCustomersSpawned = 0;
  let basePatience = 15;        // seconds

  /* ══════════════════════════════════════════════════════════════════
     CUSTOMER SYSTEM
     ══════════════════════════════════════════════════════════════════ */

  function spawnCustomer() {
    if (customers.length >= MAX_CUSTOMERS) return;
    const availableRecipes = RECIPES.filter(r => r.difficulty <= Math.min(day, 3));
    const recipe = availableRecipes[(Math.random() * availableRecipes.length) | 0];
    const patienceBonus = hasUpgrade('patience') ? 5 : 0;
    const patience = basePatience + patienceBonus - Math.min(day * 0.5, 5);
    const slot = findEmptySlot();
    if (slot < 0) return;
    customers.push({
      recipe,
      patience,
      maxPatience: patience,
      slot,
      served: false,
      angry: false,
      enterAnim: 1.0
    });
  }

  function findEmptySlot() {
    const taken = new Set(customers.map(c => c.slot));
    for (let i = 0; i < MAX_CUSTOMERS; ++i)
      if (!taken.has(i)) return i;
    return -1;
  }

  function updateCustomers(dt) {
    for (const c of customers) {
      c.patience -= dt;
      if (c.enterAnim > 0) c.enterAnim -= dt * 3;
      if (c.patience <= 0 && !c.served && !c.angry) {
        c.angry = true;
        floatingText.add(
          120 + c.slot * 180, CUSTOMER_Y - 20,
          'Too slow!', { color: '#f44', size: 16 }
        );
        ++dayMissed;
      }
    }
    // Remove expired angry customers after brief display
    customers = customers.filter(c => !(c.angry && c.patience < -2));
    // Remove served customers after brief display
    customers = customers.filter(c => !(c.served && c.patience < -1));
  }

  function addCustomer() {
    spawnCustomer();
    ++dayCustomersSpawned;
  }

  /* ══════════════════════════════════════════════════════════════════
     COOKING MINIGAME — timing-based, hit the green zone
     ══════════════════════════════════════════════════════════════════ */

  function startCooking(recipe) {
    if (activeDish) return;
    const speedBonus = hasUpgrade('speed') ? 1.2 : 1.0;
    activeDish = {
      recipe,
      stepIndex: 0,
      result: 'pending'
    };
    cookingProgress = 0;
    cookingSpeed = (0.3 + recipe.steps[0].duration * 0.1) * speedBonus;
    state = STATE_COOKING;
  }

  function updateCooking(dt) {
    if (!activeDish || state !== STATE_COOKING) return;

    cookingProgress += cookingSpeed * dt;

    // Sizzle/steam particles during cooking
    if (Math.random() < 0.3)
      particles.trail(STATION_CENTER_X + (Math.random() - 0.5) * 60, STATION_CENTER_Y - 20, { color: '#fff', life: 0.6, speed: 30 });

    if (cookingProgress >= 1.0) {
      // Overcooked / burned!
      activeDish.result = 'burned';
      floatingText.add(STATION_CENTER_X, STATION_CENTER_Y - 40, 'Burned!', { color: '#f44', size: 22 });
      screenShake.trigger(10, 500);
      particles.burst(STATION_CENTER_X, STATION_CENTER_Y, 15, { color: '#444', speed: 60, life: 0.5 });
      activeDish = null;
      state = STATE_PLAYING;
    }
  }

  function stopCooking() {
    if (!activeDish || state !== STATE_COOKING) return;
    const step = activeDish.recipe.steps[activeDish.stepIndex];
    const [lo, hi] = step.greenZone;

    if (cookingProgress >= lo && cookingProgress <= hi) {
      // Perfect timing!
      floatingText.add(STATION_CENTER_X, STATION_CENTER_Y - 40, 'Perfect!', { color: '#4f4', size: 22 });
      particles.sparkle(STATION_CENTER_X, STATION_CENTER_Y - 20, 12, { color: '#ff0', speed: 50, life: 0.6 });

      ++activeDish.stepIndex;
      if (activeDish.stepIndex >= activeDish.recipe.steps.length) {
        // Dish complete
        activeDish.result = 'perfect';
        cookedDishes.push(activeDish);
        activeDish = null;
        state = STATE_PLAYING;
      } else {
        // Next step
        cookingProgress = 0;
        const nextStep = activeDish.recipe.steps[activeDish.stepIndex];
        const speedBonus = hasUpgrade('speed') ? 1.2 : 1.0;
        cookingSpeed = (0.3 + nextStep.duration * 0.1) * speedBonus;
      }
    } else {
      // Bad timing — burned!
      floatingText.add(STATION_CENTER_X, STATION_CENTER_Y - 40, 'Ruined!', { color: '#f44', size: 20 });
      screenShake.trigger(6, 300);
      activeDish = null;
      state = STATE_PLAYING;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SERVING MECHANICS — match dish to customer
     ══════════════════════════════════════════════════════════════════ */

  function serveDish(customerIndex) {
    if (cookedDishes.length === 0 || customerIndex >= customers.length) return;
    const customer = customers[customerIndex];
    if (customer.served || customer.angry) return;

    // Find matching dish
    const dishIdx = cookedDishes.findIndex(d => d.recipe.name === customer.recipe.name);
    if (dishIdx < 0) {
      floatingText.add(
        120 + customer.slot * 180, CUSTOMER_Y,
        'Wrong dish!', { color: '#f88', size: 14 }
      );
      return;
    }

    cookedDishes.splice(dishIdx, 1);
    customer.served = true;
    customer.patience = 0; // start exit timer

    const tipBonus = hasUpgrade('tips') ? 1.25 : 1.0;
    const earnedTip = Math.round(customer.recipe.tip * tipBonus);
    money += earnedTip;
    ++totalServed;
    ++dayServed;

    floatingText.add(
      120 + customer.slot * 180, CUSTOMER_Y - 30,
      `Delicious! +$${earnedTip}`, { color: '#4f4', size: 18 }
    );
    particles.confetti(120 + customer.slot * 180, CUSTOMER_Y, 15);

    updateStatus();
  }

  /* ══════════════════════════════════════════════════════════════════
     DAY PROGRESSION & STAR RATING
     ══════════════════════════════════════════════════════════════════ */

  function checkDayEnd() {
    if (dayCustomersSpawned >= dayCustomerCount && customers.length === 0) {
      endDay();
    }
  }

  function endDay() {
    const ratio = dayServed / Math.max(dayCustomerCount, 1);
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.3 ? 1 : 0;
    state = STATE_DAY_OVER;
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `Day ${day} Complete!`, { color: '#fff', size: 28 });
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 20, `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, { color: '#fa0', size: 32 });
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 + 20, `Served: ${dayServed}/${dayCustomerCount}`, { color: '#aaa', size: 16 });
    saveHighScores();
    updateWindowTitle();
  }

  function startNextDay() {
    ++day;
    dayServed = 0;
    dayMissed = 0;
    dayCustomersSpawned = 0;
    dayCustomerCount = 5 + day * 2;
    customerSpawnInterval = Math.max(2.0, 4.0 - day * 0.3);
    customerSpawnTimer = 1.0;
    customers = [];
    cookedDishes = [];
    activeDish = null;
    state = STATE_UPGRADE;
    updateWindowTitle();
    updateStatus();
  }

  function startPlaying() {
    state = STATE_PLAYING;
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     UPGRADE SYSTEM
     ══════════════════════════════════════════════════════════════════ */

  function buyUpgrade(upgradeId) {
    const upgrade = UPGRADES.find(u => u.id === upgradeId);
    if (!upgrade || upgrade.bought || money < upgrade.cost) return;
    money -= upgrade.cost;
    upgrade.bought = true;
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2, `Bought: ${upgrade.name}!`, { color: '#4f4', size: 20 });
    updateStatus();
  }

  /* ══════════════════════════════════════════════════════════════════
     CLICK HANDLING
     ══════════════════════════════════════════════════════════════════ */

  function handleCanvasClick(mx, my) {
    if (state === STATE_MENU) {
      // Start button
      if (mx >= CANVAS_W / 2 - 100 && mx <= CANVAS_W / 2 + 100 &&
          my >= CANVAS_H / 2 - 20 && my <= CANVAS_H / 2 + 30) {
        initDay();
        return;
      }
      return;
    }

    if (state === STATE_DAY_OVER) {
      startNextDay();
      return;
    }

    if (state === STATE_UPGRADE) {
      // Check upgrade buttons
      for (let i = 0; i < UPGRADES.length; ++i) {
        const bx = CANVAS_W / 2 - 140;
        const by = 120 + i * 55;
        if (mx >= bx && mx <= bx + 280 && my >= by && my <= by + 45) {
          if (!UPGRADES[i].bought && money >= UPGRADES[i].cost)
            buyUpgrade(UPGRADES[i].id);
          return;
        }
      }
      // Continue button
      if (mx >= CANVAS_W / 2 - 80 && mx <= CANVAS_W / 2 + 80 &&
          my >= 420 && my <= 460) {
        startPlaying();
        return;
      }
      return;
    }

    if (state === STATE_COOKING) {
      stopCooking();
      return;
    }

    if (state === STATE_GAME_OVER) {
      initGame();
      return;
    }

    if (state !== STATE_PLAYING) return;

    // Click on customer to serve
    for (let i = 0; i < customers.length; ++i) {
      const cx = 120 + customers[i].slot * 180;
      if (mx >= cx - 40 && mx <= cx + 40 && my >= CUSTOMER_Y - 40 && my <= CUSTOMER_Y + 60) {
        serveDish(i);
        return;
      }
    }

    // Click on recipe buttons at bottom
    for (let r = 0; r < RECIPES.length; ++r) {
      const rx = 40 + r * 150;
      if (mx >= rx && mx <= rx + 130 && my >= CANVAS_H - 70 && my <= CANVAS_H - 20) {
        if (!activeDish)
          startCooking(RECIPES[r]);
        return;
      }
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    handleCanvasClick(mx, my);
  });

  /* ══════════════════════════════════════════════════════════════════
     KEYBOARD HANDLING
     ══════════════════════════════════════════════════════════════════ */

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      initGame();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING || state === STATE_COOKING) {
        state = STATE_PAUSED;
        updateWindowTitle();
      } else if (state === STATE_PAUSED) {
        state = STATE_PLAYING;
        updateWindowTitle();
      }
      return;
    }
    if (e.key === ' ' && state === STATE_COOKING) {
      e.preventDefault();
      stopCooking();
      return;
    }

    if (state !== STATE_PLAYING) return;
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= RECIPES.length && !activeDish)
      startCooking(RECIPES[num - 1]);
  });

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawBackground() {
    // Kitchen floor
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Counter
    ctx.fillStyle = '#654321';
    ctx.fillRect(0, COUNTER_Y - 10, CANVAS_W, 30);
    ctx.fillStyle = '#876543';
    ctx.fillRect(0, COUNTER_Y - 12, CANVAS_W, 4);
    // Customer area
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, 0, CANVAS_W, COUNTER_Y - 10);
    // Kitchen area
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(0, COUNTER_Y + 20, CANVAS_W, CANVAS_H - COUNTER_Y - 20);
  }

  function drawCustomers() {
    for (const c of customers) {
      const x = 120 + c.slot * 180;
      const slideOffset = Math.max(0, c.enterAnim) * -80;

      // Customer body
      ctx.save();
      ctx.translate(0, slideOffset);
      ctx.fillStyle = c.angry ? '#a44' : c.served ? '#4a4' : '#88a';
      ctx.beginPath();
      ctx.arc(x, CUSTOMER_Y, 25, 0, Math.PI * 2);
      ctx.fill();
      // Face
      ctx.fillStyle = '#fda';
      ctx.beginPath();
      ctx.arc(x, CUSTOMER_Y - 5, 18, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(x - 6, CUSTOMER_Y - 8, 2, 0, Math.PI * 2);
      ctx.arc(x + 6, CUSTOMER_Y - 8, 2, 0, Math.PI * 2);
      ctx.fill();
      // Mouth
      if (c.angry) {
        ctx.strokeStyle = '#a00';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, CUSTOMER_Y + 5, 6, Math.PI, 0);
        ctx.stroke();
      } else if (c.served) {
        ctx.strokeStyle = '#4a4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, CUSTOMER_Y, 6, 0, Math.PI);
        ctx.stroke();
      }

      // Order bubble
      if (!c.served && !c.angry) {
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x + 30, CUSTOMER_Y - 35, 35, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#333';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(c.recipe.name, x + 30, CUSTOMER_Y - 32);

        // Patience bar
        const pctLeft = Math.max(0, c.patience / c.maxPatience);
        const barW = 50;
        ctx.fillStyle = '#333';
        ctx.fillRect(x - barW / 2, CUSTOMER_Y + 30, barW, 6);
        ctx.fillStyle = pctLeft > 0.5 ? '#4a4' : pctLeft > 0.25 ? '#aa4' : '#a44';
        ctx.fillRect(x - barW / 2, CUSTOMER_Y + 30, barW * pctLeft, 6);
      }
      ctx.restore();
    }
  }

  function drawCookingStation() {
    // Station background
    ctx.fillStyle = '#444';
    ctx.fillRect(CANVAS_W / 2 - 100, STATION_Y, 200, 80);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.strokeRect(CANVAS_W / 2 - 100, STATION_Y, 200, 80);

    if (state === STATE_COOKING && activeDish) {
      const step = activeDish.recipe.steps[activeDish.stepIndex];
      // Step label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${step.label} (${activeDish.stepIndex + 1}/${activeDish.recipe.steps.length})`, CANVAS_W / 2, STATION_Y - 10);

      // Timing bar
      const barX = CANVAS_W / 2 - 80;
      const barY = STATION_Y + 25;
      const barW = 160;
      const barH = 20;

      // Background
      ctx.fillStyle = '#222';
      ctx.fillRect(barX, barY, barW, barH);

      // Green zone
      const [lo, hi] = step.greenZone;
      ctx.fillStyle = 'rgba(0, 180, 0, 0.4)';
      ctx.fillRect(barX + lo * barW, barY, (hi - lo) * barW, barH);

      // Progress marker
      const markerX = barX + cookingProgress * barW;
      ctx.fillStyle = '#fff';
      ctx.fillRect(markerX - 2, barY - 3, 4, barH + 6);

      // Glow when in green zone
      if (cookingProgress >= lo && cookingProgress <= hi) {
        ctx.save();
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fillRect(barX + lo * barW, barY, (hi - lo) * barW, barH);
        ctx.restore();
      }

      ctx.fillStyle = '#aaa';
      ctx.font = '11px sans-serif';
      ctx.fillText('Click or press SPACE to stop!', CANVAS_W / 2, STATION_Y + 65);
    } else {
      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Select a recipe below to start cooking', CANVAS_W / 2, STATION_Y + 40);
    }

    // Cooked dishes ready to serve
    if (cookedDishes.length > 0) {
      ctx.fillStyle = '#4f4';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Ready: ${cookedDishes.map(d => d.recipe.name).join(', ')}`, 40, STATION_Y - 10);
    }
  }

  function drawRecipeButtons() {
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    for (let r = 0; r < RECIPES.length; ++r) {
      const rx = 40 + r * 150;
      const ry = CANVAS_H - 70;
      ctx.fillStyle = activeDish ? '#333' : RECIPES[r].color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rx + 5, ry);
      ctx.lineTo(rx + 125, ry);
      ctx.quadraticCurveTo(rx + 130, ry, rx + 130, ry + 5);
      ctx.lineTo(rx + 130, ry + 45);
      ctx.quadraticCurveTo(rx + 130, ry + 50, rx + 125, ry + 50);
      ctx.lineTo(rx + 5, ry + 50);
      ctx.quadraticCurveTo(rx, ry + 50, rx, ry + 45);
      ctx.lineTo(rx, ry + 5);
      ctx.quadraticCurveTo(rx, ry, rx + 5, ry);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillText(RECIPES[r].name, rx + 65, ry + 22);
      ctx.font = '10px sans-serif';
      ctx.fillStyle = '#ddd';
      ctx.fillText(`${RECIPES[r].steps.length} steps • $${RECIPES[r].tip}`, rx + 65, ry + 38);
      ctx.font = 'bold 12px sans-serif';
    }
  }

  function drawMenu() {
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Cooking Game', CANVAS_W / 2, CANVAS_H / 2 - 80);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Run your restaurant and serve customers!', CANVAS_W / 2, CANVAS_H / 2 - 40);

    // Start button
    ctx.fillStyle = '#2a6a2a';
    ctx.strokeStyle = '#4a4';
    ctx.lineWidth = 2;
    ctx.fillRect(CANVAS_W / 2 - 100, CANVAS_H / 2 - 20, 200, 50);
    ctx.strokeRect(CANVAS_W / 2 - 100, CANVAS_H / 2 - 20, 200, 50);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('START', CANVAS_W / 2, CANVAS_H / 2 + 12);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press Escape to resume', CANVAS_W / 2, CANVAS_H / 2 + 20);
  }

  function drawDayOverOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Click to continue', CANVAS_W / 2, CANVAS_H / 2 + 80);
  }

  function drawUpgradeScreen() {
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Upgrade Shop — Day ${day}`, CANVAS_W / 2, 60);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#fa0';
    ctx.fillText(`Money: $${money}`, CANVAS_W / 2, 90);

    for (let i = 0; i < UPGRADES.length; ++i) {
      const u = UPGRADES[i];
      const bx = CANVAS_W / 2 - 140;
      const by = 120 + i * 55;
      ctx.fillStyle = u.bought ? '#333' : money >= u.cost ? '#1a3a1a' : '#2a1a1a';
      ctx.strokeStyle = u.bought ? '#555' : money >= u.cost ? '#4a4' : '#a44';
      ctx.lineWidth = 2;
      ctx.fillRect(bx, by, 280, 45);
      ctx.strokeRect(bx, by, 280, 45);
      ctx.fillStyle = u.bought ? '#666' : '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(u.name, bx + 10, by + 18);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = u.bought ? '#555' : '#aaa';
      ctx.fillText(u.desc, bx + 10, by + 35);
      ctx.textAlign = 'right';
      ctx.fillStyle = u.bought ? '#555' : '#fa0';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(u.bought ? 'OWNED' : `$${u.cost}`, bx + 270, by + 26);
    }

    // Continue button
    ctx.fillStyle = '#2a6a2a';
    ctx.strokeStyle = '#4a4';
    ctx.lineWidth = 2;
    ctx.fillRect(CANVAS_W / 2 - 80, 420, 160, 40);
    ctx.strokeRect(CANVAS_W / 2 - 80, 420, 160, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Continue', CANVAS_W / 2, 446);
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 30);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#fa0';
    ctx.fillText(`Final Score: $${money} • Days: ${day}`, CANVAS_W / 2, CANVAS_H / 2 + 10);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Click to restart', CANVAS_W / 2, CANVAS_H / 2 + 40);
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (state === STATE_MENU) {
      drawMenu();
      return;
    }

    if (state === STATE_UPGRADE) {
      drawUpgradeScreen();
      particles.draw(ctx);
      floatingText.draw(ctx);
      return;
    }

    screenShake.apply(ctx);
    drawBackground();
    drawCustomers();
    drawCookingStation();
    drawRecipeButtons();

    // Day info
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Day ${day} • Served: ${dayServed}/${dayCustomerCount}`, CANVAS_W - 20, COUNTER_Y - 20);

    particles.draw(ctx);
    floatingText.draw(ctx);

    if (state === STATE_PAUSED) drawPauseOverlay();
    if (state === STATE_DAY_OVER) drawDayOverOverlay();
    if (state === STATE_GAME_OVER) drawGameOver();
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    if (state === STATE_PLAYING) {
      updateCustomers(dt);
      customerSpawnTimer -= dt;
      if (customerSpawnTimer <= 0 && dayCustomersSpawned < dayCustomerCount) {
        customerSpawnTimer = customerSpawnInterval;
        addCustomer();
      }
      checkDayEnd();
    }

    if (state === STATE_COOKING)
      updateCooking(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    draw();
    requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS & PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function updateStatus() {
    const dayEl = document.getElementById('statusDay');
    const moneyEl = document.getElementById('statusMoney');
    const servedEl = document.getElementById('statusCustomers');
    if (dayEl) dayEl.textContent = `Day: ${day}`;
    if (moneyEl) moneyEl.textContent = `Tips: $${money}`;
    if (servedEl) servedEl.textContent = `Served: ${totalServed}`;
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
      scores.push({ day, money, served: totalServed, date: Date.now() });
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
        initGame();
        break;
      case 'pause':
        if (state === STATE_PLAYING || state === STATE_COOKING)
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
      : state === STATE_GAME_OVER ? ' — Game Over'
      : state === STATE_DAY_OVER ? ` — Day ${day} Complete`
      : state === STATE_UPGRADE ? ' — Upgrade Shop'
      : ` — Day ${day}`;
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

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  function initDay() {
    day = 1;
    money = 0;
    totalServed = 0;
    dayServed = 0;
    dayMissed = 0;
    dayCustomersSpawned = 0;
    dayCustomerCount = 5;
    customerSpawnTimer = 1.0;
    customers = [];
    cookedDishes = [];
    activeDish = null;
    for (const u of UPGRADES) u.bought = false;
    state = STATE_PLAYING;
    updateWindowTitle();
    updateStatus();
  }

  function initGame() {
    state = STATE_MENU;
    updateWindowTitle();
    updateStatus();
  }

  SZ.Dialog.wireAll();

  const menuBar = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  initGame();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
