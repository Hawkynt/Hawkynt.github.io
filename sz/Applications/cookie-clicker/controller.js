;(function() {
  'use strict';

  /* ── Constants ── */
  const STORAGE_KEY = 'sz-cookie-clicker';
  const CANVAS_W = 800;
  const CANVAS_H = 600;
  const MAX_DT = 0.05;
  const AUTO_SAVE_INTERVAL = 30 * 1000;
  const MAX_OFFLINE_SECONDS = 8 * 3600; // 28800
  const OFFLINE_EFFICIENCY = 0.5;
  const COST_SCALE = 1.15;
  const WM_THEMECHANGED = 0x031A;

  /* States */
  const STATE_PLAYING = 'PLAYING';

  /* Number suffixes */
  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  /* ── Building Definitions ── */
  const BUILDING_DEFS = [
    { id: 'cursor',       name: 'Cursor',        baseCost: 15,          baseCPS: 0.1,    emoji: '\u{1F5B1}' },
    { id: 'grandma',      name: 'Grandma',       baseCost: 100,         baseCPS: 1,      emoji: '\u{1F475}' },
    { id: 'farm',         name: 'Farm',           baseCost: 1100,        baseCPS: 8,      emoji: '\u{1F33E}' },
    { id: 'mine',         name: 'Mine',           baseCost: 12000,       baseCPS: 47,     emoji: '\u{26CF}' },
    { id: 'factory',      name: 'Factory',        baseCost: 130000,      baseCPS: 260,    emoji: '\u{1F3ED}' },
    { id: 'bank',         name: 'Bank',           baseCost: 1400000,     baseCPS: 1400,   emoji: '\u{1F3E6}' },
    { id: 'temple',       name: 'Temple',         baseCost: 20000000,    baseCPS: 7800,   emoji: '\u{26EA}' },
    { id: 'wizard-tower', name: 'Wizard Tower',   baseCost: 330000000,   baseCPS: 44000,  emoji: '\u{1F9D9}' }
  ];

  /* ── Upgrade Definitions ── */
  const UPGRADE_DEFS = [
    { id: 'u01', name: 'Reinforced Index Finger',     cost: 100,       target: 'cursor',   multiplier: 2,  condition: b => b.cursor >= 1 },
    { id: 'u02', name: 'Carpal Tunnel Prevention',    cost: 500,       target: 'cursor',   multiplier: 2,  condition: b => b.cursor >= 1 },
    { id: 'u03', name: 'Ambidextrous',                cost: 10000,     target: 'cursor',   multiplier: 2,  condition: b => b.cursor >= 10 },
    { id: 'u04', name: 'Forwards from Grandma',       cost: 1000,      target: 'grandma',  multiplier: 2,  condition: b => b.grandma >= 1 },
    { id: 'u05', name: 'Steel-plated Rolling Pins',   cost: 5000,      target: 'grandma',  multiplier: 2,  condition: b => b.grandma >= 5 },
    { id: 'u06', name: 'Lubricated Dentures',         cost: 50000,     target: 'grandma',  multiplier: 2,  condition: b => b.grandma >= 25 },
    { id: 'u07', name: 'Cheap Hoes',                  cost: 11000,     target: 'farm',     multiplier: 2,  condition: b => b.farm >= 1 },
    { id: 'u08', name: 'Fertilizer',                  cost: 55000,     target: 'farm',     multiplier: 2,  condition: b => b.farm >= 5 },
    { id: 'u09', name: 'Cookie Trees',                cost: 550000,    target: 'farm',     multiplier: 2,  condition: b => b.farm >= 25 },
    { id: 'u10', name: 'Sugar Gas',                   cost: 120000,    target: 'mine',     multiplier: 2,  condition: b => b.mine >= 1 },
    { id: 'u11', name: 'Megadrill',                   cost: 600000,    target: 'mine',     multiplier: 2,  condition: b => b.mine >= 5 },
    { id: 'u12', name: 'Ultradrill',                  cost: 6000000,   target: 'mine',     multiplier: 2,  condition: b => b.mine >= 25 },
    { id: 'u13', name: 'Sturdier Conveyor Belts',     cost: 1300000,   target: 'factory',  multiplier: 2,  condition: b => b.factory >= 1 },
    { id: 'u14', name: 'Child Labor',                 cost: 6500000,   target: 'factory',  multiplier: 2,  condition: b => b.factory >= 5 },
    { id: 'u15', name: 'Sweatshop',                   cost: 65000000,  target: 'factory',  multiplier: 2,  condition: b => b.factory >= 25 },
    { id: 'u16', name: 'Taller Tellers',              cost: 14000000,  target: 'bank',     multiplier: 2,  condition: b => b.bank >= 1 },
    { id: 'u17', name: 'Scissor-resistant Credit Cards', cost: 70000000, target: 'bank',  multiplier: 2,  condition: b => b.bank >= 5 },
    { id: 'u18', name: 'Golden Idols',                cost: 200000000, target: 'temple',   multiplier: 2,  condition: b => b.temple >= 1 },
    { id: 'u19', name: 'Pointier Hats',               cost: 3300000000, target: 'wizard-tower', multiplier: 2, condition: b => b['wizard-tower'] >= 1 },
    { id: 'u20', name: 'Plastic Mouse',               cost: 50000,     target: 'click',    multiplier: 2,  condition: () => true },
    { id: 'u21', name: 'Iron Mouse',                  cost: 5000000,   target: 'click',    multiplier: 2,  condition: () => true },
    { id: 'u22', name: 'Titanium Mouse',              cost: 500000000, target: 'click',    multiplier: 2,  condition: () => true },
    { id: 'u23', name: 'Lucky Day',                   cost: 7777777,   target: 'global',   multiplier: 1.1, condition: () => true },
    { id: 'u24', name: 'Serendipity',                 cost: 77777777,  target: 'global',   multiplier: 1.1, condition: () => true },
    { id: 'u25', name: 'Get Lucky',                   cost: 777777777, target: 'global',   multiplier: 1.1, condition: () => true }
  ];

  /* ── Achievement Definitions ── */
  const ACHIEVEMENT_DEFS = [
    { id: 'a01', name: 'Wake and Bake',         desc: 'Bake 1 cookie',             condition: s => s.cookiesBakedAllTime >= 1 },
    { id: 'a02', name: 'Making Some Dough',     desc: 'Bake 100 cookies',          condition: s => s.cookiesBakedAllTime >= 100 },
    { id: 'a03', name: 'So Baked Right Now',    desc: 'Bake 1,000 cookies',        condition: s => s.cookiesBakedAllTime >= 1000 },
    { id: 'a04', name: 'Fledgling Bakery',      desc: 'Bake 10,000 cookies',       condition: s => s.cookiesBakedAllTime >= 10000 },
    { id: 'a05', name: 'Affluent Bakery',       desc: 'Bake 100,000 cookies',      condition: s => s.cookiesBakedAllTime >= 100000 },
    { id: 'a06', name: 'World Famous Bakery',   desc: 'Bake 1 million cookies',    condition: s => s.cookiesBakedAllTime >= 1e6 },
    { id: 'a07', name: 'Cosmic Bakery',         desc: 'Bake 1 billion cookies',    condition: s => s.cookiesBakedAllTime >= 1e9 },
    { id: 'a08', name: 'Galactic Bakery',       desc: 'Bake 1 trillion cookies',   condition: s => s.cookiesBakedAllTime >= 1e12 },
    { id: 'a09', name: 'Universal Bakery',      desc: 'Bake 1 quadrillion',        condition: s => s.cookiesBakedAllTime >= 1e15 },
    { id: 'a10', name: 'Timeless Bakery',       desc: 'Bake 1 quintillion',        condition: s => s.cookiesBakedAllTime >= 1e18 },
    { id: 'a11', name: 'Click',                 desc: 'Click the cookie 1 time',   condition: s => s.totalClicks >= 1 },
    { id: 'a12', name: 'Double Click',          desc: 'Click the cookie 2 times',  condition: s => s.totalClicks >= 2 },
    { id: 'a13', name: 'Mouse Wheel',           desc: 'Click the cookie 100 times', condition: s => s.totalClicks >= 100 },
    { id: 'a14', name: 'Of Mice and Men',       desc: 'Click the cookie 500 times', condition: s => s.totalClicks >= 500 },
    { id: 'a15', name: 'The Digital',           desc: 'Click the cookie 1,000 times', condition: s => s.totalClicks >= 1000 },
    { id: 'a16', name: 'Cursor Starter',        desc: 'Own 1 cursor',              condition: s => s.buildings.cursor >= 1 },
    { id: 'a17', name: 'Cursor Army',           desc: 'Own 50 cursors',            condition: s => s.buildings.cursor >= 50 },
    { id: 'a18', name: 'Grandma Army',          desc: 'Own 50 grandmas',           condition: s => s.buildings.grandma >= 50 },
    { id: 'a19', name: 'Farm Lord',             desc: 'Own 50 farms',              condition: s => s.buildings.farm >= 50 },
    { id: 'a20', name: 'Mine Tycoon',           desc: 'Own 50 mines',              condition: s => s.buildings.mine >= 50 },
    { id: 'a21', name: 'Factory Owner',         desc: 'Own 50 factories',          condition: s => s.buildings.factory >= 50 },
    { id: 'a22', name: 'Bank President',        desc: 'Own 50 banks',              condition: s => s.buildings.bank >= 50 },
    { id: 'a23', name: 'Temple Guardian',       desc: 'Own 50 temples',            condition: s => s.buildings.temple >= 50 },
    { id: 'a24', name: 'Arch Wizard',           desc: 'Own 50 wizard towers',      condition: s => s.buildings['wizard-tower'] >= 50 },
    { id: 'a25', name: 'Speedbaker',            desc: 'Reach 10 CPS',             condition: s => s.cps >= 10 },
    { id: 'a26', name: 'Kilobaker',             desc: 'Reach 1,000 CPS',          condition: s => s.cps >= 1000 },
    { id: 'a27', name: 'Megabaker',             desc: 'Reach 1 million CPS',      condition: s => s.cps >= 1e6 },
    { id: 'a28', name: 'Gigabaker',             desc: 'Reach 1 billion CPS',      condition: s => s.cps >= 1e9 },
    { id: 'a29', name: 'Ascended',              desc: 'Prestige at least once',    condition: s => s.prestigeCount >= 1 },
    { id: 'a30', name: 'Reborn',                desc: 'Prestige 5 times',         condition: s => s.prestigeCount >= 5 },
    { id: 'a31', name: 'Builder',               desc: 'Own 100 buildings total',  condition: s => s.totalBuildings >= 100 },
    { id: 'a32', name: 'Architect',             desc: 'Own 500 buildings total',  condition: s => s.totalBuildings >= 500 }
  ];

  /* ── DOM ── */
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusCookies = document.getElementById('statusCookies');
  const statusCps = document.getElementById('statusCps');
  const statusState = document.getElementById('statusState');

  /* ── Effects ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ── Game State ── */
  let state = STATE_PLAYING;
  let cookies = 0;
  let displayCookies = 0;
  let cookiesBaked = 0;
  let cookiesBakedAllTime = 0;
  let totalClicks = 0;
  let clickValue = 1;
  let clickMultiplier = 1;
  let globalMultiplier = 1;
  let heavenlyChips = 0;
  let prestigeCount = 0;
  let cps = 0;
  let animFrameId = null;
  let lastTimestamp = 0;
  let dpr = 1;
  let cookieScale = 1;
  let cookieScaleV = 0;
  let achievementCheckTimer = 0;
  let autoSaveTimer = 0;
  let purchaseGlowTimer = 0;
  let purchaseGlowIndex = -1;
  let confettiTimer = 0;
  let lastMilestone = 0;

  /* ── Click ripple state ── */
  let clickRipple = null;

  const buildings = {};
  const buildingMultipliers = {};
  for (const def of BUILDING_DEFS) {
    buildings[def.id] = 0;
    buildingMultipliers[def.id] = 1;
  }

  const upgradePurchased = {};
  for (const def of UPGRADE_DEFS)
    upgradePurchased[def.id] = false;

  const achievementUnlocked = {};
  for (const def of ACHIEVEMENT_DEFS)
    achievementUnlocked[def.id] = false;

  /* ── Canvas Setup ── */
  function setupCanvas() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── Number Formatting ── */
  function formatNumber(n) {
    if (n < 1000)
      return Math.floor(n).toString();
    let idx = 0;
    let val = n;
    while (val >= 1000 && idx < SUFFIXES.length - 1) {
      val /= 1000;
      ++idx;
    }
    return val.toFixed(val < 10 ? 2 : val < 100 ? 1 : 0) + SUFFIXES[idx];
  }

  /* ── CPS Calculation ── */
  function recalcCPS() {
    let total = 0;
    for (const def of BUILDING_DEFS)
      total += buildings[def.id] * def.baseCPS * buildingMultipliers[def.id];
    total *= globalMultiplier;
    total *= (1 + heavenlyChips * 0.01);
    const achievementBonus = 1 + Object.values(achievementUnlocked).filter(Boolean).length * 0.01;
    total *= achievementBonus;
    cps = total;
  }

  /* ── Click Value Calculation ── */
  function recalcClickValue() {
    clickValue = clickMultiplier * globalMultiplier * (1 + heavenlyChips * 0.01);
  }

  /* ── Owned Counts Snapshot ── */
  function getOwnedCounts() {
    const counts = {};
    for (const def of BUILDING_DEFS)
      counts[def.id] = buildings[def.id];
    return counts;
  }

  /* ── Building Cost ── */
  function buildingCost(def) {
    return Math.ceil(def.baseCost * Math.pow(COST_SCALE, buildings[def.id]));
  }

  /* ── Buy Building ── */
  function buyBuilding(defIndex) {
    const def = BUILDING_DEFS[defIndex];
    const cost = buildingCost(def);
    if (cookies >= cost) {
      cookies -= cost;
      ++buildings[def.id];
      recalcCPS();
      purchaseGlowTimer = 0.6;
      purchaseGlowIndex = defIndex;
      // Burst particles on purchase
      particles.burst(650, 80 + defIndex * 55, 8, { r: 255, g: 215, b: 0 }, 0.6);
    }
  }

  /* ── Buy Upgrade ── */
  function buyUpgrade(defIndex) {
    const def = UPGRADE_DEFS[defIndex];
    if (upgradePurchased[def.id] || cookies < def.cost)
      return;
    cookies -= def.cost;
    upgradePurchased[def.id] = true;
    if (def.target === 'click')
      clickMultiplier *= def.multiplier;
    else if (def.target === 'global')
      globalMultiplier *= def.multiplier;
    else
      buildingMultipliers[def.target] *= def.multiplier;
    recalcCPS();
    recalcClickValue();
    // Sparkle on upgrade
    particles.burst(400, 300, 12, { r: 180, g: 100, b: 255 }, 0.8);
  }

  /* ── Cookie Click ── */
  function handleCookieClick(x, y) {
    cookies += clickValue;
    cookiesBaked += clickValue;
    cookiesBakedAllTime += clickValue;
    ++totalClicks;

    // Click burst particles
    particles.burst(x || CANVAS_W / 2, y || CANVAS_H / 2, 8, { r: 210, g: 160, b: 60 }, 0.5);

    // Floating +N text
    floatingText.add(x || CANVAS_W / 2, (y || CANVAS_H / 2) - 30, '+' + formatNumber(clickValue), { color: '#fff' });

    // Click ripple ring
    clickRipple = { x: COOKIE_CX, y: COOKIE_CY, radius: COOKIE_R * 0.5, alpha: 0.7 };

    // Cookie crumb burst — small brown particles flung from cookie
    particles.burst(COOKIE_CX, COOKIE_CY, 5, { r: 160, g: 120, b: 60 }, 0.4);

    // Cookie squish spring animation
    cookieScale = 0.95;
    cookieScaleV = 0.3;
  }

  /* ── Achievement Check ── */
  function checkAchievements() {
    const totalBuildings = Object.values(buildings).reduce((a, b) => a + b, 0);
    const snapshot = {
      cookiesBakedAllTime,
      totalClicks,
      buildings,
      cps,
      prestigeCount,
      totalBuildings
    };
    let newUnlock = false;
    for (const def of ACHIEVEMENT_DEFS) {
      if (!achievementUnlocked[def.id] && def.condition(snapshot)) {
        achievementUnlocked[def.id] = true;
        newUnlock = true;
        floatingText.add(CANVAS_W / 2, 40, '\u{1F3C6} ' + def.name, { color: '#ffd700', decay: 0.01 });
      }
    }
    if (newUnlock)
      recalcCPS();
  }

  /* ── Milestone Confetti ── */
  const MILESTONES = [1e6, 1e9, 1e12, 1e15, 1e18];
  const CONFETTI_COLORS = [
    { r: 255, g: 50, b: 50 },
    { r: 50, g: 255, b: 50 },
    { r: 50, g: 50, b: 255 },
    { r: 255, g: 215, b: 0 },
    { r: 255, g: 100, b: 255 }
  ];

  function checkMilestones() {
    for (const m of MILESTONES) {
      if (cookiesBakedAllTime >= m && lastMilestone < m) {
        lastMilestone = m;
        confettiTimer = 2;
        for (let i = 0; i < 50; ++i)
          particles.burst(Math.random() * CANVAS_W, -10, 3, CONFETTI_COLORS[i % CONFETTI_COLORS.length], 2);
      }
    }
  }

  /* ── Prestige ── */
  function getHeavenlyChipsFromLifetime() {
    return Math.floor(Math.cbrt(cookiesBakedAllTime / 1e12));
  }

  function performPrestige() {
    const newChips = getHeavenlyChipsFromLifetime() - heavenlyChips;
    if (newChips <= 0)
      return;
    heavenlyChips += newChips;
    ++prestigeCount;

    // Reset buildings, upgrades, cookies
    cookies = 0;
    cookiesBaked = 0;
    displayCookies = 0;
    clickMultiplier = 1;
    globalMultiplier = 1;
    for (const def of BUILDING_DEFS) {
      buildings[def.id] = 0;
      buildingMultipliers[def.id] = 1;
    }
    for (const def of UPGRADE_DEFS)
      upgradePurchased[def.id] = false;

    recalcCPS();
    recalcClickValue();
    confettiTimer = 2;
    for (let i = 0; i < 40; ++i)
      particles.burst(Math.random() * CANVAS_W, -10, 2, { r: 200, g: 200, b: 255 }, 2);
  }

  /* ── Save / Load ── */
  function saveGame() {
    try {
      const data = {
        cookies, cookiesBaked, cookiesBakedAllTime, totalClicks,
        clickMultiplier, globalMultiplier, heavenlyChips, prestigeCount,
        buildings: { ...buildings },
        buildingMultipliers: { ...buildingMultipliers },
        upgradePurchased: { ...upgradePurchased },
        achievementUnlocked: { ...achievementUnlocked },
        lastMilestone,
        lastSaveTime: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw)
        return;
      const data = JSON.parse(raw);
      cookies = data.cookies || 0;
      cookiesBaked = data.cookiesBaked || 0;
      cookiesBakedAllTime = data.cookiesBakedAllTime || 0;
      totalClicks = data.totalClicks || 0;
      clickMultiplier = data.clickMultiplier || 1;
      globalMultiplier = data.globalMultiplier || 1;
      heavenlyChips = data.heavenlyChips || 0;
      prestigeCount = data.prestigeCount || 0;
      lastMilestone = data.lastMilestone || 0;
      if (data.buildings)
        for (const k of Object.keys(data.buildings))
          if (k in buildings)
            buildings[k] = data.buildings[k];
      if (data.buildingMultipliers)
        for (const k of Object.keys(data.buildingMultipliers))
          if (k in buildingMultipliers)
            buildingMultipliers[k] = data.buildingMultipliers[k];
      if (data.upgradePurchased)
        for (const k of Object.keys(data.upgradePurchased))
          if (k in upgradePurchased)
            upgradePurchased[k] = data.upgradePurchased[k];
      if (data.achievementUnlocked)
        for (const k of Object.keys(data.achievementUnlocked))
          if (k in achievementUnlocked)
            achievementUnlocked[k] = data.achievementUnlocked[k];

      recalcCPS();
      recalcClickValue();
      displayCookies = cookies;

      // Calculate offline production
      if (data.lastSaveTime) {
        const elapsed = Math.min((Date.now() - data.lastSaveTime) / 1000, MAX_OFFLINE_SECONDS);
        if (elapsed > 10) {
          const offlineCookies = elapsed * cps * OFFLINE_EFFICIENCY;
          cookies += offlineCookies;
          cookiesBaked += offlineCookies;
          cookiesBakedAllTime += offlineCookies;
          if (offlineCookies > 0)
            floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'Welcome back! +' + formatNumber(offlineCookies), { color: '#7ec8e3', decay: 0.007 });
        }
      }
    } catch (_) {}
  }

  /* ── New Game ── */
  function newGame() {
    cookies = 0;
    displayCookies = 0;
    cookiesBaked = 0;
    cookiesBakedAllTime = 0;
    totalClicks = 0;
    clickValue = 1;
    clickMultiplier = 1;
    globalMultiplier = 1;
    heavenlyChips = 0;
    prestigeCount = 0;
    cps = 0;
    lastMilestone = 0;
    for (const def of BUILDING_DEFS) {
      buildings[def.id] = 0;
      buildingMultipliers[def.id] = 1;
    }
    for (const def of UPGRADE_DEFS)
      upgradePurchased[def.id] = false;
    for (const def of ACHIEVEMENT_DEFS)
      achievementUnlocked[def.id] = false;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    recalcCPS();
    recalcClickValue();
  }

  /* ── Status ── */
  function updateStatus() {
    statusCookies.textContent = 'Cookies: ' + formatNumber(displayCookies);
    statusCps.textContent = 'CPS: ' + formatNumber(cps);
    statusState.textContent = state;
  }

  /* ── Draw Helpers ── */
  const COOKIE_CX = 200;
  const COOKIE_CY = 250;
  const COOKIE_R = 100;

  /* ── Background crumb particles ── */
  const bgCrumbs = [];
  for (let i = 0; i < 15; ++i)
    bgCrumbs.push({
      x: COOKIE_CX + (Math.random() - 0.5) * 250,
      y: Math.random() * CANVAS_H,
      r: 1 + Math.random() * 2,
      speed: 8 + Math.random() * 12,
      alpha: 0.15 + Math.random() * 0.25
    });

  function drawCookie() {
    ctx.save();
    ctx.translate(COOKIE_CX, COOKIE_CY);
    ctx.scale(cookieScale, cookieScale);

    // Cookie shadow / glow
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 20 + Math.sin(Date.now() / 500) * 5;

    // Cookie body — radial gradient for 3D sphere look (offset up-left for natural lighting)
    const bodyGrad = ctx.createRadialGradient(-25, -25, COOKIE_R * 0.15, 0, 0, COOKIE_R);
    bodyGrad.addColorStop(0, '#daa520');
    bodyGrad.addColorStop(0.7, '#c68e17');
    bodyGrad.addColorStop(1, '#8b6914');
    ctx.beginPath();
    ctx.arc(0, 0, COOKIE_R, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Cookie texture — subtle circular scoring lines
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(139,105,20,0.3)';
    ctx.lineWidth = 1;
    const scoringRadii = [35, 55, 72, 88];
    for (const sr of scoringRadii) {
      ctx.beginPath();
      ctx.arc(0, 0, sr, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, sr, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }

    // Cookie chips with varied shapes and shadows
    const chipPositions = [
      [-30, -40], [20, -30], [-10, 10], [40, 20], [-40, 30], [15, -60], [-20, 50]
    ];
    for (let i = 0; i < chipPositions.length; ++i) {
      const [cx, cy] = chipPositions[i];

      // Chip shadow — tiny offset dark ellipse
      ctx.save();
      ctx.translate(cx, cy + 1.5);
      ctx.fillStyle = 'rgba(30,15,0,0.35)';
      ctx.beginPath();
      if (i % 2 === 0) {
        ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();

      // Chip body — alternate between ellipse and circle
      ctx.fillStyle = '#4a2800';
      ctx.beginPath();
      if (i % 2 === 0)
        ctx.ellipse(cx, cy, 10, 7, 0, 0, Math.PI * 2);
      else
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Specular highlight — white crescent arc in upper-left quadrant
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(-10, -10, COOKIE_R * 0.7, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
    ctx.restore();

    // Edge — double-line bevel (outer darker ring + inner lighter ring)
    ctx.beginPath();
    ctx.arc(0, 0, COOKIE_R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(100,65,10,0.5)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, COOKIE_R - 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,220,130,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  function drawBuildingsPanel() {
    const panelX = 420;
    const panelW = CANVAS_W - panelX - 10;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(panelX, 10, panelW, CANVAS_H - 20);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Buildings', panelX + 10, 30);

    for (let i = 0; i < BUILDING_DEFS.length; ++i) {
      const def = BUILDING_DEFS[i];
      const y = 50 + i * 55;
      const cost = buildingCost(def);
      const canAfford = cookies >= cost;

      // Purchase glow
      if (purchaseGlowIndex === i && purchaseGlowTimer > 0) {
        ctx.save();
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 30 * purchaseGlowTimer;
        ctx.fillStyle = 'rgba(255,215,0,0.15)';
        ctx.fillRect(panelX + 5, y - 5, panelW - 10, 50);
        ctx.restore();
      }

      // Building row background — horizontal linear gradient
      const rowGrad = ctx.createLinearGradient(panelX + 5, 0, panelX + panelW - 5, 0);
      if (canAfford) {
        rowGrad.addColorStop(0, 'rgba(80,180,80,0.2)');
        rowGrad.addColorStop(0.5, 'rgba(100,200,100,0.12)');
        rowGrad.addColorStop(1, 'rgba(80,180,80,0.05)');
      } else {
        rowGrad.addColorStop(0, 'rgba(60,60,60,0.35)');
        rowGrad.addColorStop(0.5, 'rgba(50,50,50,0.25)');
        rowGrad.addColorStop(1, 'rgba(40,40,40,0.15)');
      }
      ctx.fillStyle = rowGrad;
      ctx.fillRect(panelX + 5, y - 5, panelW - 10, 50);

      // Emoji + name (with glow pulse when affordable)
      ctx.save();
      if (canAfford) {
        const pulse = 4 + Math.sin(Date.now() / 600) * 3;
        ctx.shadowColor = 'rgba(100,255,100,0.6)';
        ctx.shadowBlur = pulse;
      }
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(def.emoji, panelX + 12, y + 22);
      ctx.restore();

      ctx.font = '12px sans-serif';
      ctx.fillStyle = canAfford ? '#fff' : '#888';
      ctx.fillText(def.name, panelX + 42, y + 15);
      ctx.fillText('Cost: ' + formatNumber(cost), panelX + 42, y + 30);

      // Owned count
      ctx.fillStyle = '#7ec8e3';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(buildings[def.id].toString(), panelX + panelW - 15, y + 25);
      ctx.textAlign = 'left';
    }
  }

  function drawUpgradesPanel() {
    const panelX = 10;
    const panelY = 420;
    const panelW = 400;

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(panelX, panelY, panelW, CANVAS_H - panelY - 10);

    ctx.fillStyle = '#c8a0ff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('Upgrades', panelX + 10, panelY + 16);

    const ownedCounts = getOwnedCounts();
    let drawn = 0;
    for (let i = 0; i < UPGRADE_DEFS.length && drawn < 6; ++i) {
      const def = UPGRADE_DEFS[i];
      if (upgradePurchased[def.id])
        continue;
      if (!def.condition(ownedCounts))
        continue;
      const x = panelX + 10 + (drawn % 3) * 130;
      const y = panelY + 30 + Math.floor(drawn / 3) * 55;
      const canAfford = cookies >= def.cost;

      ctx.fillStyle = canAfford ? 'rgba(200,160,255,0.2)' : 'rgba(50,50,50,0.3)';
      ctx.fillRect(x, y, 120, 48);

      ctx.font = '10px sans-serif';
      ctx.fillStyle = canAfford ? '#fff' : '#888';
      ctx.fillText(def.name.substring(0, 18), x + 4, y + 14);
      ctx.fillText(formatNumber(def.cost), x + 4, y + 28);
      ctx.fillStyle = '#aaa';
      ctx.fillText('x' + def.multiplier + ' ' + def.target, x + 4, y + 42);
      ++drawn;
    }
  }

  function drawStats() {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatNumber(displayCookies) + ' cookies', COOKIE_CX, 50);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('per second: ' + formatNumber(cps), COOKIE_CX, 72);

    if (heavenlyChips > 0) {
      ctx.fillStyle = '#c8a0ff';
      ctx.font = '12px sans-serif';
      ctx.fillText('\u{2728} ' + heavenlyChips + ' heavenly chips (+' + heavenlyChips + '% CPS)', COOKIE_CX, 92);
    }

    ctx.textAlign = 'left';
  }

  function tickConfetti(dt) {
    if (confettiTimer <= 0)
      return;
    confettiTimer -= dt;
  }

  /* ── Game Loop ── */
  function gameLoop(timestamp) {
    if (!lastTimestamp)
      lastTimestamp = timestamp;
    const rawDt = (timestamp - lastTimestamp) / 1000;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    // Auto-generation
    if (cps > 0) {
      const earned = cps * dt;
      cookies += earned;
      cookiesBaked += earned;
      cookiesBakedAllTime += earned;
    }

    // Smooth counter animation (lerp toward target)
    displayCookies += (cookies - displayCookies) * Math.min(1, dt * 10);

    // Cookie squish spring
    cookieScaleV += (1 - cookieScale) * 20 * dt;
    cookieScaleV *= 0.85;
    cookieScale += cookieScaleV * dt * 60;

    // Purchase glow fade
    if (purchaseGlowTimer > 0)
      purchaseGlowTimer -= dt;

    // Confetti
    tickConfetti(dt);

    // Achievement check (every second)
    achievementCheckTimer += dt;
    if (achievementCheckTimer >= 1) {
      achievementCheckTimer = 0;
      checkAchievements();
      checkMilestones();
    }

    // Auto-save
    autoSaveTimer += dt;
    if (autoSaveTimer >= AUTO_SAVE_INTERVAL / 1000) {
      autoSaveTimer = 0;
      saveGame();
    }

    // Update background crumb particles
    for (const crumb of bgCrumbs) {
      crumb.y += crumb.speed * dt;
      if (crumb.y > CANVAS_H + 5) {
        crumb.y = -5;
        crumb.x = COOKIE_CX + (Math.random() - 0.5) * 250;
      }
    }

    // Update click ripple
    if (clickRipple) {
      clickRipple.radius += 150 * dt;
      clickRipple.alpha -= 1.4 * dt;
      if (clickRipple.alpha <= 0)
        clickRipple = null;
    }

    // Update effects
    particles.update(dt);
    floatingText.update(dt);

    // ── Draw ──
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Bakery warm glow — radial gradient behind cookie
    ctx.save();
    const glowGrad = ctx.createRadialGradient(COOKIE_CX, COOKIE_CY, 20, COOKIE_CX, COOKIE_CY, 220);
    glowGrad.addColorStop(0, 'rgba(255,180,60,0.12)');
    glowGrad.addColorStop(0.5, 'rgba(200,140,40,0.06)');
    glowGrad.addColorStop(1, 'rgba(200,140,40,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();

    // Background crumb particles
    ctx.save();
    for (const crumb of bgCrumbs) {
      ctx.beginPath();
      ctx.arc(crumb.x, crumb.y, crumb.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(160,120,60,' + crumb.alpha + ')';
      ctx.fill();
    }
    ctx.restore();

    drawStats();
    drawCookie();

    // Click ripple ring
    if (clickRipple) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(clickRipple.x, clickRipple.y, clickRipple.radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,215,0,' + clickRipple.alpha + ')';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    drawBuildingsPanel();
    drawUpgradesPanel();

    // Render effects
    particles.draw(ctx);
    floatingText.draw(ctx);

    updateStatus();

    animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ── Click / Pointer Input ── */
  function handleCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    // Check cookie click
    const dx = x - COOKIE_CX;
    const dy = y - COOKIE_CY;
    if (dx * dx + dy * dy <= COOKIE_R * COOKIE_R) {
      handleCookieClick(x, y);
      return;
    }

    // Check building click
    const panelX = 420;
    if (x >= panelX && x <= CANVAS_W - 10) {
      for (let i = 0; i < BUILDING_DEFS.length; ++i) {
        const by = 50 + i * 55;
        if (y >= by - 5 && y <= by + 45) {
          buyBuilding(i);
          return;
        }
      }
    }

    // Check upgrade click
    if (x >= 10 && x <= 410 && y >= 420) {
      const ownedCounts = getOwnedCounts();
      let drawn = 0;
      for (let i = 0; i < UPGRADE_DEFS.length && drawn < 6; ++i) {
        const def = UPGRADE_DEFS[i];
        if (upgradePurchased[def.id])
          continue;
        if (!def.condition(ownedCounts))
          continue;
        const ux = 10 + 10 + (drawn % 3) * 130;
        const uy = 420 + 30 + Math.floor(drawn / 3) * 55;
        if (x >= ux && x <= ux + 120 && y >= uy && y <= uy + 48) {
          buyUpgrade(i);
          return;
        }
        ++drawn;
      }
    }
  }

  canvas.addEventListener('pointerdown', handleCanvasClick);

  /* ── Keyboard ── */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'F2') {
      e.preventDefault();
      newGame();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      // Open menu or deselect
    }
  });

  /* ── Resize ── */
  window.addEventListener('resize', setupCanvas);

  /* ── Menu Bar ── */
  {
    const actions = {
      new: () => newGame(),
      save: () => saveGame(),
      prestige: async () => {
        const chips = getHeavenlyChipsFromLifetime() - heavenlyChips;
        document.getElementById('prestigeInfo').textContent =
          chips > 0
            ? 'Prestige now to earn ' + chips + ' heavenly chip(s). Each chip gives +1% CPS.'
            : 'You need more cookies to earn heavenly chips. Keep baking!';
        const result = await SZ.Dialog.show('prestigeBackdrop');
        if (result === 'ok' && chips > 0)
          performPrestige();
      },
      exit: () => { saveGame(); SZ.Dlls.User32.DestroyWindow(); },
      controls: () => SZ.Dialog.show('controlsBackdrop'),
      about: () => SZ.Dialog.show('dlg-about')
    };
    new SZ.MenuBar({ onAction: (action) => actions[action]?.() });
  }

  /* ── Dialog Wiring ── */
  SZ.Dialog.wireAll();

  /* ── OS Integration ── */
  SZ.Dlls.User32.RegisterWindowProc(function(msg) {
    if (msg === 'WM_THEMECHANGED') {
      // Theme changed — CSS handles repainting
    }
  });

  SZ.Dlls.User32.SetWindowText('Cookie Clicker');

  /* ── Save on blur ── */
  window.addEventListener('blur', saveGame);

  /* ── Init ── */
  setupCanvas();
  loadGame();
  recalcCPS();
  recalcClickValue();
  updateStatus();
  animFrameId = requestAnimationFrame(gameLoop);

})();
