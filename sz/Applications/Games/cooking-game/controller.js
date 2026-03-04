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
  const STATION_CENTER_X = CANVAS_W / 2;
  const STATION_CENTER_Y = STATION_Y + 30;

  /* ── Recipe button layout (computed to fit all 6 within canvas) ── */
  const RECIPE_BTN_MARGIN = 8;
  const RECIPE_BTN_W = Math.floor((CANVAS_W - RECIPE_BTN_MARGIN * 2 - (5 * RECIPE_BTN_MARGIN)) / 6);
  const RECIPE_BTN_H = 50;

  /* ══════════════════════════════════════════════════════════════════
     RECIPES — 6 dishes, each with 2-4 steps
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
     FAIR RNG — weighted selection with streak prevention
     ══════════════════════════════════════════════════════════════════ */

  const recentRecipes = [];
  const MAX_RECENT = 3;

  function pickRecipeFair(availableRecipes) {
    if (availableRecipes.length <= 1)
      return availableRecipes[0];

    const weights = availableRecipes.map(r => {
      let w = 1.0;
      const recentCount = recentRecipes.filter(name => name === r.name).length;
      if (recentCount === 1) w *= 0.35;
      else if (recentCount >= 2) w *= 0.1;

      const currentlyOrdered = customers.filter(c => !c.served && !c.angry && c.recipe.name === r.name).length;
      if (currentlyOrdered >= 1) w *= 0.4;
      if (currentlyOrdered >= 2) w *= 0.15;

      return w;
    });

    const totalWeight = weights.reduce((s, w) => s + w, 0);
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; ++i) {
      roll -= weights[i];
      if (roll <= 0) {
        const chosen = availableRecipes[i];
        recentRecipes.push(chosen.name);
        while (recentRecipes.length > MAX_RECENT) recentRecipes.shift();
        return chosen;
      }
    }

    return availableRecipes[availableRecipes.length - 1];
  }

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

  /* ── Customer appearance variety ── */
  const SKIN_TONES = ['#fde0c8', '#f5c5a3', '#d4a574', '#c68642', '#8d5524', '#5c3310'];
  const HAIR_COLORS = ['#2c1b0e', '#5a3214', '#8b4513', '#d4a017', '#c0392b', '#e67e22', '#7f8c8d', '#f5e6ca'];
  const SHIRT_COLORS = ['#4a7fb5', '#b54a6d', '#4ab58a', '#b5964a', '#7b4ab5', '#b5554a', '#4ab5b5', '#8a8a8a'];
  const HAIR_STYLES = ['spiky', 'round', 'flat', 'parted'];

  function generateCustomerAppearance() {
    return {
      skin: SKIN_TONES[(Math.random() * SKIN_TONES.length) | 0],
      hair: HAIR_COLORS[(Math.random() * HAIR_COLORS.length) | 0],
      shirt: SHIRT_COLORS[(Math.random() * SHIRT_COLORS.length) | 0],
      hairStyle: HAIR_STYLES[(Math.random() * HAIR_STYLES.length) | 0]
    };
  }

  function spawnCustomer() {
    if (customers.length >= MAX_CUSTOMERS) return;
    const availableRecipes = RECIPES.filter(r => r.difficulty <= Math.min(day, 3));
    const recipe = pickRecipeFair(availableRecipes);
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
      enterAnim: 1.0,
      appearance: generateCustomerAppearance()
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
    customers = customers.filter(c => !(c.angry && c.patience < -2));
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

    if (Math.random() < 0.3)
      particles.trail(STATION_CENTER_X + (Math.random() - 0.5) * 60, STATION_CENTER_Y - 20, { color: '#fff', life: 0.6, speed: 30 });

    if (cookingProgress >= 1.0) {
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
      floatingText.add(STATION_CENTER_X, STATION_CENTER_Y - 40, 'Perfect!', { color: '#4f4', size: 22 });
      particles.sparkle(STATION_CENTER_X, STATION_CENTER_Y - 20, 12, { color: '#ff0', speed: 50, life: 0.6 });

      ++activeDish.stepIndex;
      if (activeDish.stepIndex >= activeDish.recipe.steps.length) {
        activeDish.result = 'perfect';
        cookedDishes.push(activeDish);
        activeDish = null;
        state = STATE_PLAYING;
      } else {
        cookingProgress = 0;
        const nextStep = activeDish.recipe.steps[activeDish.stepIndex];
        const speedBonus = hasUpgrade('speed') ? 1.2 : 1.0;
        cookingSpeed = (0.3 + nextStep.duration * 0.1) * speedBonus;
      }
    } else {
      floatingText.add(STATION_CENTER_X, STATION_CENTER_Y - 40, 'Ruined!', { color: '#f44', size: 20 });
      screenShake.trigger(6, 300);
      activeDish = null;
      state = STATE_PLAYING;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     POWERUP SYSTEM
     ══════════════════════════════════════════════════════════════════ */

  const POWERUP_TYPES = [
    { id: 'freeze',    emoji: '\u2744\uFE0F',  label: 'Time Freeze',     duration: 5,  color: '#0af' },
    { id: 'speed',     emoji: '\u26A1',         label: 'Speed Boost',     duration: 8,  color: '#fa0' },
    { id: 'precision', emoji: '\uD83C\uDFAF',   label: 'Precision',       duration: 0,  color: '#0f0' },
    { id: 'money',     emoji: '\uD83D\uDCB0',   label: 'Double Tips',     duration: 10, color: '#ff0' },
    { id: 'patience',  emoji: '\u2764\uFE0F',   label: 'Restore Patience', duration: 0, color: '#f44' },
  ];

  let activePowerups = [];
  let floatingPowerups = [];
  let powerupSpawnTimer = 0;

  function spawnPowerup() {
    if (floatingPowerups.length >= 2) return;
    const type = POWERUP_TYPES[(Math.random() * POWERUP_TYPES.length) | 0];
    const x = 100 + Math.random() * (CANVAS_W - 200);
    const y = 180 + Math.random() * 100;
    floatingPowerups.push({ type, x, y, age: 0, maxAge: 6 });
  }

  function collectPowerup(idx) {
    const pu = floatingPowerups.splice(idx, 1)[0];
    const t = pu.type;

    particles.sparkle(pu.x, pu.y, 12, { color: t.color });
    floatingText.add(pu.x, pu.y - 20, t.emoji + ' ' + t.label + '!', { color: t.color, size: 16 });

    if (t.id === 'patience') {
      for (const c of customers) {
        if (!c.served && !c.angry)
          c.patience = Math.min(c.patience + 5, c.maxPatience);
      }
    } else if (t.id === 'precision') {
      // Widen green zone on next cook
      activePowerups.push({ id: 'precision', remaining: 1 });
    } else if (t.duration > 0)
      activePowerups.push({ id: t.id, remaining: t.duration });
  }

  function hasPowerup(id) {
    return activePowerups.some(p => p.id === id);
  }

  function updatePowerups(dt) {
    for (let i = floatingPowerups.length - 1; i >= 0; --i) {
      floatingPowerups[i].age += dt;
      if (floatingPowerups[i].age > floatingPowerups[i].maxAge)
        floatingPowerups.splice(i, 1);
    }
    for (let i = activePowerups.length - 1; i >= 0; --i) {
      if (typeof activePowerups[i].remaining === 'number' && activePowerups[i].remaining > 0) {
        activePowerups[i].remaining -= dt;
        if (activePowerups[i].remaining <= 0) {
          floatingText.add(CANVAS_W / 2, 40, activePowerups[i].id + ' expired', { color: '#888', size: 12 });
          activePowerups.splice(i, 1);
        }
      }
    }
    powerupSpawnTimer -= dt;
    if (powerupSpawnTimer <= 0) {
      powerupSpawnTimer = 8 + Math.random() * 6;
      if (Math.random() < 0.4)
        spawnPowerup();
    }
  }

  function drawPowerups() {
    for (const pu of floatingPowerups) {
      const bob = Math.sin(pu.age * 3) * 4;
      const alpha = pu.age > pu.maxAge - 1 ? (pu.maxAge - pu.age) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Glow
      ctx.shadowColor = pu.type.color;
      ctx.shadowBlur = 12;
      ctx.fillText(pu.type.emoji, pu.x, pu.y + bob);
      ctx.restore();
    }
    // Active powerup badges in top-right
    let bx = CANVAS_W - 10;
    for (const ap of activePowerups) {
      const def = POWERUP_TYPES.find(t => t.id === ap.id);
      if (!def) continue;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx - 60, 4, 56, 20);
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = def.color;
      ctx.fillText(def.emoji + ' ' + (ap.remaining > 0 ? ap.remaining.toFixed(0) + 's' : '1x'), bx - 8, 17);
      ctx.restore();
      bx -= 64;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     SERVING MECHANICS — match dish to customer
     ══════════════════════════════════════════════════════════════════ */

  function serveDish(customerIndex) {
    if (cookedDishes.length === 0 || customerIndex >= customers.length) return;
    const customer = customers[customerIndex];
    if (customer.served || customer.angry) return;

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
    customer.patience = 0;

    const tipBonus = hasUpgrade('tips') ? 1.25 : 1.0;
    const moneyMultiplier = hasPowerup('money') ? 2 : 1;
    const earnedTip = Math.round(customer.recipe.tip * tipBonus * moneyMultiplier);
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
    if (dayCustomersSpawned >= dayCustomerCount && customers.length === 0)
      endDay();
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
    recentRecipes.length = 0;
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
      for (let i = 0; i < UPGRADES.length; ++i) {
        const bx = CANVAS_W / 2 - 140;
        const by = 120 + i * 55;
        if (mx >= bx && mx <= bx + 280 && my >= by && my <= by + 45) {
          if (!UPGRADES[i].bought && money >= UPGRADES[i].cost)
            buyUpgrade(UPGRADES[i].id);
          return;
        }
      }
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

    // Check floating powerup clicks
    for (let i = floatingPowerups.length - 1; i >= 0; --i) {
      const pu = floatingPowerups[i];
      if (Math.abs(mx - pu.x) < 24 && Math.abs(my - pu.y) < 24) {
        collectPowerup(i);
        return;
      }
    }

    for (let i = 0; i < customers.length; ++i) {
      const cx = 120 + customers[i].slot * 180;
      if (mx >= cx - 40 && mx <= cx + 40 && my >= CUSTOMER_Y - 40 && my <= CUSTOMER_Y + 60) {
        serveDish(i);
        return;
      }
    }

    for (let r = 0; r < RECIPES.length; ++r) {
      const rx = RECIPE_BTN_MARGIN + r * (RECIPE_BTN_W + RECIPE_BTN_MARGIN);
      if (mx >= rx && mx <= rx + RECIPE_BTN_W && my >= CANVAS_H - 10 - RECIPE_BTN_H && my <= CANVAS_H - 10) {
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
     DRAWING HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ── Miniature food icons for recipe buttons ── */
  function drawFoodIcon(name, cx, cy, size) {
    const s = size;
    ctx.save();
    switch (name) {
      case 'Burger': {
        // bottom bun
        ctx.fillStyle = '#c88530';
        ctx.beginPath();
        ctx.ellipse(cx, cy + s * 0.25, s * 0.5, s * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
        // patty
        ctx.fillStyle = '#6b3a1f';
        ctx.beginPath();
        ctx.ellipse(cx, cy + s * 0.08, s * 0.45, s * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
        // lettuce
        ctx.fillStyle = '#5cb85c';
        ctx.beginPath();
        ctx.ellipse(cx, cy - s * 0.02, s * 0.48, s * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
        // top bun
        ctx.fillStyle = '#d9963a';
        ctx.beginPath();
        ctx.ellipse(cx, cy - s * 0.18, s * 0.45, s * 0.22, 0, Math.PI, Math.PI * 2);
        ctx.fill();
        // sesame seeds
        ctx.fillStyle = '#fff8dc';
        ctx.beginPath();
        ctx.ellipse(cx - s * 0.12, cy - s * 0.28, s * 0.04, s * 0.025, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + s * 0.1, cy - s * 0.26, s * 0.04, s * 0.025, 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'Pasta': {
        // plate
        ctx.fillStyle = '#e8e0d0';
        ctx.beginPath();
        ctx.ellipse(cx, cy + s * 0.1, s * 0.5, s * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // pasta strands
        ctx.strokeStyle = '#eec860';
        ctx.lineWidth = s * 0.06;
        ctx.lineCap = 'round';
        for (let i = 0; i < 5; ++i) {
          ctx.beginPath();
          const ox = (i - 2) * s * 0.12;
          ctx.moveTo(cx + ox - s * 0.08, cy - s * 0.15);
          ctx.quadraticCurveTo(cx + ox + s * 0.1, cy, cx + ox - s * 0.05, cy + s * 0.12);
          ctx.stroke();
        }
        // sauce
        ctx.fillStyle = '#cc3333';
        ctx.beginPath();
        ctx.ellipse(cx, cy - s * 0.05, s * 0.18, s * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'Pizza': {
        // slice triangle
        ctx.fillStyle = '#eec860';
        ctx.beginPath();
        ctx.moveTo(cx, cy - s * 0.35);
        ctx.lineTo(cx - s * 0.4, cy + s * 0.3);
        ctx.lineTo(cx + s * 0.4, cy + s * 0.3);
        ctx.closePath();
        ctx.fill();
        // crust edge
        ctx.fillStyle = '#c88530';
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.4, cy + s * 0.3);
        ctx.lineTo(cx + s * 0.4, cy + s * 0.3);
        ctx.lineTo(cx + s * 0.35, cy + s * 0.2);
        ctx.lineTo(cx - s * 0.35, cy + s * 0.2);
        ctx.closePath();
        ctx.fill();
        // pepperoni
        ctx.fillStyle = '#b22222';
        ctx.beginPath();
        ctx.arc(cx - s * 0.08, cy, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + s * 0.12, cy + s * 0.08, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx, cy + s * 0.15, s * 0.055, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'Salad': {
        // bowl
        ctx.fillStyle = '#c8a86e';
        ctx.beginPath();
        ctx.ellipse(cx, cy + s * 0.12, s * 0.45, s * 0.18, 0, 0, Math.PI);
        ctx.fill();
        // greens
        ctx.fillStyle = '#5cb85c';
        ctx.beginPath();
        ctx.ellipse(cx, cy - s * 0.02, s * 0.4, s * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        // darker leaf detail
        ctx.fillStyle = '#3d8b3d';
        ctx.beginPath();
        ctx.ellipse(cx - s * 0.12, cy - s * 0.08, s * 0.15, s * 0.1, -0.4, 0, Math.PI * 2);
        ctx.fill();
        // tomato slice
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(cx + s * 0.15, cy - s * 0.06, s * 0.08, 0, Math.PI * 2);
        ctx.fill();
        // cucumber
        ctx.fillStyle = '#7dcea0';
        ctx.beginPath();
        ctx.arc(cx - s * 0.05, cy + s * 0.05, s * 0.06, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'Sushi': {
        // plate
        ctx.fillStyle = '#2c2c2c';
        ctx.beginPath();
        ctx.ellipse(cx, cy + s * 0.12, s * 0.5, s * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();
        // maki roll 1
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(cx - s * 0.2, cy - s * 0.05, s * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f0f0f0';
        ctx.beginPath();
        ctx.arc(cx - s * 0.2, cy - s * 0.05, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e87461';
        ctx.beginPath();
        ctx.arc(cx - s * 0.2, cy - s * 0.05, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
        // maki roll 2
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(cx + s * 0.15, cy - s * 0.05, s * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f0f0f0';
        ctx.beginPath();
        ctx.arc(cx + s * 0.15, cy - s * 0.05, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5cb85c';
        ctx.beginPath();
        ctx.arc(cx + s * 0.15, cy - s * 0.05, s * 0.05, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'Steak': {
        // plate
        ctx.fillStyle = '#e8e0d0';
        ctx.beginPath();
        ctx.ellipse(cx, cy + s * 0.08, s * 0.5, s * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // steak
        ctx.fillStyle = '#8b3a2a';
        ctx.beginPath();
        ctx.ellipse(cx - s * 0.05, cy - s * 0.02, s * 0.32, s * 0.18, 0.2, 0, Math.PI * 2);
        ctx.fill();
        // grill marks
        ctx.strokeStyle = '#5a1a0a';
        ctx.lineWidth = s * 0.04;
        for (let i = -1; i <= 1; ++i) {
          ctx.beginPath();
          ctx.moveTo(cx - s * 0.2 + i * s * 0.12, cy - s * 0.12);
          ctx.lineTo(cx - s * 0.1 + i * s * 0.12, cy + s * 0.1);
          ctx.stroke();
        }
        // herb garnish
        ctx.fillStyle = '#5cb85c';
        ctx.beginPath();
        ctx.ellipse(cx + s * 0.28, cy - s * 0.08, s * 0.06, s * 0.04, -0.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawBackground() {
    // Customer area (top) -- draw first so nothing is occluded
    const custGrad = ctx.createLinearGradient(0, 0, 0, COUNTER_Y - 10);
    custGrad.addColorStop(0, '#12122a');
    custGrad.addColorStop(1, '#1e1e3a');
    ctx.fillStyle = custGrad;
    ctx.fillRect(0, 0, CANVAS_W, COUNTER_Y - 10);

    // Subtle wall pattern (vertical stripes)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let wx = 30; wx < CANVAS_W; wx += 60) {
      ctx.beginPath();
      ctx.moveTo(wx, 0);
      ctx.lineTo(wx, COUNTER_Y - 10);
      ctx.stroke();
    }

    // Counter surface with wood grain gradient
    const counterGrad = ctx.createLinearGradient(0, COUNTER_Y - 12, 0, COUNTER_Y + 20);
    counterGrad.addColorStop(0, '#a07040');
    counterGrad.addColorStop(0.15, '#876543');
    counterGrad.addColorStop(0.5, '#654321');
    counterGrad.addColorStop(0.85, '#543210');
    counterGrad.addColorStop(1, '#432100');
    ctx.fillStyle = counterGrad;
    ctx.fillRect(0, COUNTER_Y - 12, CANVAS_W, 32);

    // Counter highlight strip
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, COUNTER_Y - 12, CANVAS_W, 2);

    // Counter shadow underneath
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, COUNTER_Y + 20, CANVAS_W, 3);

    // Kitchen area with tile-like gradient
    const kitchenGrad = ctx.createLinearGradient(0, COUNTER_Y + 23, 0, CANVAS_H);
    kitchenGrad.addColorStop(0, '#2e1e10');
    kitchenGrad.addColorStop(1, '#1a0e04');
    ctx.fillStyle = kitchenGrad;
    ctx.fillRect(0, COUNTER_Y + 23, CANVAS_W, CANVAS_H - COUNTER_Y - 23);

    // Subtle floor tile grid
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let tx = 0; tx < CANVAS_W; tx += 80) {
      ctx.beginPath();
      ctx.moveTo(tx, COUNTER_Y + 23);
      ctx.lineTo(tx, CANVAS_H);
      ctx.stroke();
    }
    for (let ty = COUNTER_Y + 23; ty < CANVAS_H; ty += 80) {
      ctx.beginPath();
      ctx.moveTo(0, ty);
      ctx.lineTo(CANVAS_W, ty);
      ctx.stroke();
    }
  }

  function drawCustomers() {
    for (const c of customers) {
      const x = 120 + c.slot * 180;
      const slideOffset = Math.max(0, c.enterAnim) * -80;
      const a = c.appearance;

      ctx.save();
      ctx.translate(0, slideOffset);

      // Body / torso
      const bodyColor = c.angry ? '#a44' : c.served ? '#4a4' : a.shirt;
      const bodyGrad = ctx.createRadialGradient(x, CUSTOMER_Y + 15, 5, x, CUSTOMER_Y + 15, 28);
      bodyGrad.addColorStop(0, bodyColor);
      bodyGrad.addColorStop(1, darkenColor(bodyColor, 0.6));
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(x, CUSTOMER_Y + 18, 22, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      const headGrad = ctx.createRadialGradient(x - 3, CUSTOMER_Y - 10, 3, x, CUSTOMER_Y - 5, 20);
      headGrad.addColorStop(0, lightenColor(a.skin, 1.15));
      headGrad.addColorStop(1, a.skin);
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.arc(x, CUSTOMER_Y - 5, 18, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = a.hair;
      switch (a.hairStyle) {
        case 'spiky':
          ctx.beginPath();
          ctx.arc(x, CUSTOMER_Y - 12, 16, Math.PI, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x - 10, CUSTOMER_Y - 25);
          ctx.lineTo(x - 6, CUSTOMER_Y - 15);
          ctx.lineTo(x - 2, CUSTOMER_Y - 28);
          ctx.lineTo(x + 4, CUSTOMER_Y - 14);
          ctx.lineTo(x + 10, CUSTOMER_Y - 26);
          ctx.lineTo(x + 14, CUSTOMER_Y - 13);
          ctx.closePath();
          ctx.fill();
          break;
        case 'round':
          ctx.beginPath();
          ctx.arc(x, CUSTOMER_Y - 10, 20, Math.PI * 0.85, Math.PI * 2.15);
          ctx.fill();
          break;
        case 'flat':
          ctx.fillRect(x - 16, CUSTOMER_Y - 24, 32, 10);
          ctx.beginPath();
          ctx.arc(x, CUSTOMER_Y - 14, 17, Math.PI, Math.PI * 2);
          ctx.fill();
          break;
        case 'parted':
          ctx.beginPath();
          ctx.arc(x - 2, CUSTOMER_Y - 12, 17, Math.PI * 0.9, Math.PI * 1.7);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + 2, CUSTOMER_Y - 12, 17, Math.PI * 1.3, Math.PI * 2.1);
          ctx.fill();
          break;
      }

      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(x - 6, CUSTOMER_Y - 8, 4, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 6, CUSTOMER_Y - 8, 4, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(x - 5.5, CUSTOMER_Y - 7.5, 2, 0, Math.PI * 2);
      ctx.arc(x + 6.5, CUSTOMER_Y - 7.5, 2, 0, Math.PI * 2);
      ctx.fill();
      // Eye highlights
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - 4.5, CUSTOMER_Y - 8.5, 0.8, 0, Math.PI * 2);
      ctx.arc(x + 7.5, CUSTOMER_Y - 8.5, 0.8, 0, Math.PI * 2);
      ctx.fill();

      // Mouth
      if (c.angry) {
        ctx.strokeStyle = '#c00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, CUSTOMER_Y + 5, 6, Math.PI, 0);
        ctx.stroke();
        // Angry eyebrows
        ctx.strokeStyle = '#500';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 10, CUSTOMER_Y - 15);
        ctx.lineTo(x - 3, CUSTOMER_Y - 12);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 10, CUSTOMER_Y - 15);
        ctx.lineTo(x + 3, CUSTOMER_Y - 12);
        ctx.stroke();
      } else if (c.served) {
        ctx.strokeStyle = '#2a8a2a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, CUSTOMER_Y, 6, 0, Math.PI);
        ctx.stroke();
        // Happy blush
        ctx.fillStyle = 'rgba(255, 120, 120, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x - 12, CUSTOMER_Y - 2, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x + 12, CUSTOMER_Y - 2, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Neutral small mouth
        ctx.strokeStyle = darkenColor(a.skin, 0.5);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - 3, CUSTOMER_Y + 2);
        ctx.lineTo(x + 3, CUSTOMER_Y + 2);
        ctx.stroke();
      }

      // Order bubble
      if (!c.served && !c.angry) {
        // Bubble tail
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(x + 10, CUSTOMER_Y - 22);
        ctx.lineTo(x + 16, CUSTOMER_Y - 28);
        ctx.lineTo(x + 22, CUSTOMER_Y - 30);
        ctx.closePath();
        ctx.fill();
        // Bubble body with shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(x + 35, CUSTOMER_Y - 40, 35, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#bbb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x + 35, CUSTOMER_Y - 40, 35, 18, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Food icon in bubble
        drawFoodIcon(c.recipe.name, x + 25, CUSTOMER_Y - 40, 22);
        // Recipe name
        ctx.fillStyle = '#333';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(c.recipe.name, x + 40, CUSTOMER_Y - 36);

        // Patience bar with rounded ends
        const pctLeft = Math.max(0, c.patience / c.maxPatience);
        const barW = 50;
        const barH = 7;
        const barX = x - barW / 2;
        const barY = CUSTOMER_Y + 32;
        // Bar background
        drawRoundedRect(barX, barY, barW, barH, 3);
        ctx.fillStyle = '#222';
        ctx.fill();
        // Bar fill
        if (pctLeft > 0) {
          const fillW = Math.max(barH, barW * pctLeft);
          ctx.save();
          ctx.beginPath();
          drawRoundedRect(barX, barY, barW, barH, 3);
          ctx.clip();
          const barColor = pctLeft > 0.5 ? '#4a4' : pctLeft > 0.25 ? '#aa4' : '#d44';
          const barGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
          barGrad.addColorStop(0, lightenColor(barColor, 1.3));
          barGrad.addColorStop(1, barColor);
          ctx.fillStyle = barGrad;
          ctx.fillRect(barX, barY, fillW, barH);
          ctx.restore();
        }
        // Bar border
        drawRoundedRect(barX, barY, barW, barH, 3);
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawCookingStation() {
    // Station background with metallic gradient
    const stationX = CANVAS_W / 2 - 110;
    const stationW = 220;
    const stationH = 90;
    const stGrad = ctx.createLinearGradient(stationX, STATION_Y, stationX, STATION_Y + stationH);
    stGrad.addColorStop(0, '#5a5a5a');
    stGrad.addColorStop(0.3, '#484848');
    stGrad.addColorStop(0.7, '#3a3a3a');
    stGrad.addColorStop(1, '#2a2a2a');
    drawRoundedRect(stationX, STATION_Y, stationW, stationH, 8);
    ctx.fillStyle = stGrad;
    ctx.fill();
    // Station border with slight bevel
    ctx.strokeStyle = '#6a6a6a';
    ctx.lineWidth = 2;
    drawRoundedRect(stationX, STATION_Y, stationW, stationH, 8);
    ctx.stroke();
    // Inner highlight line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    drawRoundedRect(stationX + 2, STATION_Y + 2, stationW - 4, stationH - 4, 6);
    ctx.stroke();

    // Burner rings on station
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(CANVAS_W / 2 - 35, STATION_Y + stationH / 2, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(CANVAS_W / 2 + 35, STATION_Y + stationH / 2, 18, 0, Math.PI * 2);
    ctx.stroke();

    if (state === STATE_COOKING && activeDish) {
      const step = activeDish.recipe.steps[activeDish.stepIndex];

      // Step label with recipe color accent
      ctx.fillStyle = activeDish.recipe.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${step.label} (${activeDish.stepIndex + 1}/${activeDish.recipe.steps.length})`, CANVAS_W / 2, STATION_Y - 12);

      // Timing bar
      const barX = CANVAS_W / 2 - 90;
      const barY = STATION_Y + 22;
      const barW = 180;
      const barH = 22;

      // Bar background
      drawRoundedRect(barX, barY, barW, barH, 4);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      drawRoundedRect(barX, barY, barW, barH, 4);
      ctx.stroke();

      // Danger zone (red tint)
      const [lo, hi] = step.greenZone;
      ctx.save();
      ctx.beginPath();
      drawRoundedRect(barX, barY, barW, barH, 4);
      ctx.clip();
      ctx.fillStyle = 'rgba(180, 40, 40, 0.25)';
      ctx.fillRect(barX, barY, barW, barH);

      // Green zone with gradient
      const gzGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
      gzGrad.addColorStop(0, 'rgba(40, 200, 40, 0.5)');
      gzGrad.addColorStop(0.5, 'rgba(60, 220, 60, 0.6)');
      gzGrad.addColorStop(1, 'rgba(40, 180, 40, 0.5)');
      ctx.fillStyle = gzGrad;
      ctx.fillRect(barX + lo * barW, barY, (hi - lo) * barW, barH);

      // Green zone edge markers
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(barX + lo * barW, barY, 1, barH);
      ctx.fillRect(barX + hi * barW - 1, barY, 1, barH);
      ctx.restore();

      // Progress marker with glow
      const markerX = barX + cookingProgress * barW;
      const inGreen = cookingProgress >= lo && cookingProgress <= hi;
      if (inGreen) {
        ctx.save();
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#7f7';
        ctx.fillRect(markerX - 2, barY - 4, 4, barH + 8);
        ctx.restore();
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(markerX - 2, barY - 3, 4, barH + 6);

      // Glow overlay on green zone when cursor is inside
      if (inGreen) {
        ctx.save();
        ctx.beginPath();
        drawRoundedRect(barX, barY, barW, barH, 4);
        ctx.clip();
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 15;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
        ctx.fillRect(barX + lo * barW, barY, (hi - lo) * barW, barH);
        ctx.restore();
      }

      ctx.fillStyle = '#ccc';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click or press SPACE to stop!', CANVAS_W / 2, STATION_Y + 62);

      // Current action icon
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.font = '24px sans-serif';
      const actionEmoji = { grill: '\u{1F525}', boil: '\u{1F4A7}', fry: '\u{1F373}', mix: '\u{1F944}', chop: '\u{1F52A}', bake: '\u{2668}', flip: '\u{1F504}', plate: '\u{1F37D}', season: '\u{1F9C2}' };
      ctx.fillText(actionEmoji[step.action] || '', CANVAS_W / 2, STATION_Y + 82);
    } else {
      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Select a recipe below to start cooking', CANVAS_W / 2, STATION_Y + 40);
    }

    // Cooked dishes ready to serve
    if (cookedDishes.length > 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,255,0,0.4)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#4f4';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Ready: ${cookedDishes.map(d => d.recipe.name).join(', ')}`, 30, STATION_Y - 12);
      ctx.restore();
    }
  }

  function drawRecipeButtons() {
    const ry = CANVAS_H - 10 - RECIPE_BTN_H;
    for (let r = 0; r < RECIPES.length; ++r) {
      const rx = RECIPE_BTN_MARGIN + r * (RECIPE_BTN_W + RECIPE_BTN_MARGIN);
      const recipe = RECIPES[r];
      const disabled = !!activeDish;

      // Button background with gradient
      const baseColor = disabled ? '#333' : recipe.color;
      const btnGrad = ctx.createLinearGradient(rx, ry, rx, ry + RECIPE_BTN_H);
      btnGrad.addColorStop(0, lightenColor(baseColor, 1.3));
      btnGrad.addColorStop(0.5, baseColor);
      btnGrad.addColorStop(1, darkenColor(baseColor, 0.7));

      drawRoundedRect(rx, ry, RECIPE_BTN_W, RECIPE_BTN_H, 6);
      ctx.fillStyle = btnGrad;
      ctx.fill();

      // Inner highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      drawRoundedRect(rx + 1, ry + 1, RECIPE_BTN_W - 2, RECIPE_BTN_H / 2, 5);
      ctx.stroke();

      // Border
      ctx.strokeStyle = disabled ? '#555' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      drawRoundedRect(rx, ry, RECIPE_BTN_W, RECIPE_BTN_H, 6);
      ctx.stroke();

      // Food icon
      if (!disabled)
        drawFoodIcon(recipe.name, rx + 22, ry + RECIPE_BTN_H / 2, 18);

      // Text
      const textX = disabled ? rx + RECIPE_BTN_W / 2 : rx + RECIPE_BTN_W / 2 + 8;
      ctx.fillStyle = disabled ? '#888' : '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(recipe.name, textX, ry + 18);
      ctx.font = '9px sans-serif';
      ctx.fillStyle = disabled ? '#666' : 'rgba(255,255,255,0.8)';
      ctx.fillText(`${recipe.steps.length} steps`, textX, ry + 31);
      ctx.fillText(`$${recipe.tip}`, textX, ry + 42);
    }
  }

  function drawMenu() {
    // Gradient background
    const bgGrad = ctx.createRadialGradient(CANVAS_W / 2, CANVAS_H / 2 - 60, 50, CANVAS_W / 2, CANVAS_H / 2, 400);
    bgGrad.addColorStop(0, '#2a2a4a');
    bgGrad.addColorStop(1, '#0e0e1e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Decorative food icons around title
    ctx.globalAlpha = 0.15;
    drawFoodIcon('Burger', 180, 200, 50);
    drawFoodIcon('Pizza', 720, 180, 50);
    drawFoodIcon('Sushi', 150, 400, 45);
    drawFoodIcon('Steak', 750, 420, 45);
    drawFoodIcon('Pasta', 300, 440, 40);
    drawFoodIcon('Salad', 600, 160, 40);
    ctx.globalAlpha = 1.0;

    // Title with shadow
    ctx.save();
    ctx.shadowColor = 'rgba(255, 160, 0, 0.4)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Cooking Game', CANVAS_W / 2, CANVAS_H / 2 - 80);
    ctx.restore();

    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#bbb';
    ctx.textAlign = 'center';
    ctx.fillText('Run your restaurant and serve customers!', CANVAS_W / 2, CANVAS_H / 2 - 40);

    // Start button with gradient
    const btnGrad = ctx.createLinearGradient(0, CANVAS_H / 2 - 20, 0, CANVAS_H / 2 + 30);
    btnGrad.addColorStop(0, '#3a8a3a');
    btnGrad.addColorStop(1, '#1a5a1a');
    drawRoundedRect(CANVAS_W / 2 - 100, CANVAS_H / 2 - 20, 200, 50, 8);
    ctx.fillStyle = btnGrad;
    ctx.fill();
    ctx.strokeStyle = '#5cb85c';
    ctx.lineWidth = 2;
    drawRoundedRect(CANVAS_W / 2 - 100, CANVAS_H / 2 - 20, 200, 50, 8);
    ctx.stroke();
    // Highlight on top half
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.save();
    ctx.beginPath();
    drawRoundedRect(CANVAS_W / 2 - 100, CANVAS_H / 2 - 20, 200, 50, 8);
    ctx.clip();
    ctx.fillRect(CANVAS_W / 2 - 100, CANVAS_H / 2 - 20, 200, 25);
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('START', CANVAS_W / 2, CANVAS_H / 2 + 12);

    // High scores hint
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText('Press F2 for new game at any time', CANVAS_W / 2, CANVAS_H / 2 + 70);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.3)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.restore();
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
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, '#1a1a30');
    bgGrad.addColorStop(1, '#0e0e1e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    ctx.shadowColor = 'rgba(255,160,0,0.3)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Upgrade Shop`, CANVAS_W / 2, 50);
    ctx.restore();
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#8af';
    ctx.fillText(`Day ${day}`, CANVAS_W / 2, 72);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#fa0';
    ctx.fillText(`Money: $${money}`, CANVAS_W / 2, 95);

    for (let i = 0; i < UPGRADES.length; ++i) {
      const u = UPGRADES[i];
      const bx = CANVAS_W / 2 - 150;
      const by = 120 + i * 55;
      const canBuy = !u.bought && money >= u.cost;

      const cardGrad = ctx.createLinearGradient(bx, by, bx + 300, by);
      if (u.bought) {
        cardGrad.addColorStop(0, '#2a2a2a');
        cardGrad.addColorStop(1, '#333');
      } else if (canBuy) {
        cardGrad.addColorStop(0, '#1a3a1a');
        cardGrad.addColorStop(1, '#1a4a1a');
      } else {
        cardGrad.addColorStop(0, '#2a1a1a');
        cardGrad.addColorStop(1, '#3a1a1a');
      }

      drawRoundedRect(bx, by, 300, 45, 6);
      ctx.fillStyle = cardGrad;
      ctx.fill();
      ctx.strokeStyle = u.bought ? '#444' : canBuy ? '#5b5' : '#a55';
      ctx.lineWidth = 1.5;
      drawRoundedRect(bx, by, 300, 45, 6);
      ctx.stroke();

      ctx.fillStyle = u.bought ? '#666' : '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(u.name, bx + 12, by + 18);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = u.bought ? '#555' : '#aaa';
      ctx.fillText(u.desc, bx + 12, by + 35);
      ctx.textAlign = 'right';
      ctx.fillStyle = u.bought ? '#555' : '#fa0';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(u.bought ? 'OWNED' : `$${u.cost}`, bx + 288, by + 26);
    }

    // Continue button
    const cbtnGrad = ctx.createLinearGradient(0, 420, 0, 460);
    cbtnGrad.addColorStop(0, '#3a8a3a');
    cbtnGrad.addColorStop(1, '#1a5a1a');
    drawRoundedRect(CANVAS_W / 2 - 80, 420, 160, 40, 6);
    ctx.fillStyle = cbtnGrad;
    ctx.fill();
    ctx.strokeStyle = '#5cb85c';
    ctx.lineWidth = 2;
    drawRoundedRect(CANVAS_W / 2 - 80, 420, 160, 40, 6);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Continue', CANVAS_W / 2, 446);
  }

  function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    ctx.shadowColor = 'rgba(255,0,0,0.4)';
    ctx.shadowBlur = 15;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 30);
    ctx.restore();
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#fa0';
    ctx.fillText(`Final Score: $${money}  |  Days: ${day}`, CANVAS_W / 2, CANVAS_H / 2 + 10);
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

    ctx.save();
    screenShake.apply(ctx);
    drawBackground();
    drawCustomers();
    drawCookingStation();
    drawRecipeButtons();

    // Day info HUD with subtle background
    const hudText = `Day ${day}  |  Served: ${dayServed}/${dayCustomerCount}`;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    const hudW = ctx.measureText(hudText).width + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    drawRoundedRect(CANVAS_W - 12 - hudW, COUNTER_Y - 34, hudW + 4, 22, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(hudText, CANVAS_W - 14, COUNTER_Y - 18);

    ctx.restore();

    drawPowerups();
    particles.draw(ctx);
    floatingText.draw(ctx);

    if (state === STATE_PAUSED) drawPauseOverlay();
    if (state === STATE_DAY_OVER) drawDayOverOverlay();
    if (state === STATE_GAME_OVER) drawGameOver();
  }

  /* ══════════════════════════════════════════════════════════════════
     COLOR HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function parseColor(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3)
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    return [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16)
    ];
  }

  function lightenColor(hex, factor) {
    const [r, g, b] = parseColor(hex);
    return `rgb(${Math.min(255, (r * factor) | 0)},${Math.min(255, (g * factor) | 0)},${Math.min(255, (b * factor) | 0)})`;
  }

  function darkenColor(hex, factor) {
    const [r, g, b] = parseColor(hex);
    return `rgb(${(r * factor) | 0},${(g * factor) | 0},${(b * factor) | 0})`;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    if (state === STATE_PLAYING) {
      updatePowerups(dt);
      if (hasPowerup('freeze')) {
        // Don't drain patience while frozen
      } else
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
    recentRecipes.length = 0;
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
