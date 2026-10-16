;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Kitchen data for Cooking Game: stations, recipes, locations, the 30-day
   * career, customer types and the rules that decide quality and rewards.
   * Pure data and math - no canvas, no DOM, so it also loads in node.
   */

  function deepFreeze(v) {
    if (v && typeof v === 'object') {
      Object.freeze(v);
      for (const key of Object.keys(v))
        deepFreeze(v[key]);
    }
    return v;
  }

  /* Stations - the five work spots of the kitchen, in counter-clockwise order.
     Each answers to a number key so a step can be started without the mouse. */
  const STATIONS = {
    grill: { name: 'Grill', key: 'Digit1' },
    stove: { name: 'Stove', key: 'Digit2' },
    oven: { name: 'Oven', key: 'Digit3' },
    board: { name: 'Prep Board', key: 'Digit4' },
    plate: { name: 'Plating', key: 'Digit5' }
  };
  const STATION_ORDER = ['grill', 'stove', 'oven', 'board', 'plate'];

  /* Recipes - a dish is a run of station steps. time is seconds at base speed,
     zone is the fraction of the progress bar that counts as a perfect hit. */
  const RECIPES = [
    { id: 'burger', name: 'Burger', price: 14, steps: [
      { station: 'grill', label: 'Grill patty', time: 3.0, zone: [0.55, 0.80] },
      { station: 'plate', label: 'Assemble', time: 1.2, zone: [0.40, 0.90] }
    ] },
    { id: 'salad', name: 'Salad', price: 12, steps: [
      { station: 'board', label: 'Chop greens', time: 1.6, zone: [0.45, 0.85] },
      { station: 'plate', label: 'Toss', time: 1.0, zone: [0.40, 0.90] }
    ] },
    { id: 'tacos', name: 'Tacos', price: 18, steps: [
      { station: 'grill', label: 'Grill meat', time: 2.6, zone: [0.50, 0.78] },
      { station: 'board', label: 'Chop salsa', time: 1.4, zone: [0.45, 0.85] },
      { station: 'plate', label: 'Fill shells', time: 1.2, zone: [0.40, 0.90] }
    ] },
    { id: 'pancakes', name: 'Pancakes', price: 16, steps: [
      { station: 'board', label: 'Whisk batter', time: 1.4, zone: [0.45, 0.85] },
      { station: 'stove', label: 'Flip pancakes', time: 2.4, zone: [0.50, 0.78] },
      { station: 'plate', label: 'Syrup', time: 1.0, zone: [0.40, 0.90] }
    ] },
    { id: 'pasta', name: 'Pasta', price: 22, steps: [
      { station: 'stove', label: 'Boil pasta', time: 3.2, zone: [0.55, 0.80] },
      { station: 'stove', label: 'Simmer sauce', time: 1.8, zone: [0.50, 0.85] },
      { station: 'plate', label: 'Plate', time: 1.0, zone: [0.40, 0.90] }
    ] },
    { id: 'pizza', name: 'Pizza', price: 26, steps: [
      { station: 'board', label: 'Knead dough', time: 1.6, zone: [0.45, 0.85] },
      { station: 'oven', label: 'Bake', time: 4.0, zone: [0.60, 0.82] },
      { station: 'plate', label: 'Slice', time: 1.0, zone: [0.40, 0.90] }
    ] },
    { id: 'steak', name: 'Steak', price: 34, steps: [
      { station: 'board', label: 'Season', time: 1.2, zone: [0.40, 0.85] },
      { station: 'grill', label: 'Sear steak', time: 3.6, zone: [0.60, 0.78] },
      { station: 'plate', label: 'Garnish', time: 1.2, zone: [0.40, 0.90] }
    ] },
    { id: 'curry', name: 'Curry', price: 28, steps: [
      { station: 'board', label: 'Chop veg', time: 1.5, zone: [0.45, 0.85] },
      { station: 'stove', label: 'Simmer curry', time: 3.8, zone: [0.58, 0.82] },
      { station: 'plate', label: 'Serve rice', time: 1.0, zone: [0.40, 0.90] }
    ] },
    { id: 'sushi', name: 'Sushi', price: 36, steps: [
      { station: 'stove', label: 'Cook rice', time: 2.8, zone: [0.55, 0.80] },
      { station: 'board', label: 'Slice fish', time: 1.8, zone: [0.50, 0.75] },
      { station: 'plate', label: 'Roll maki', time: 1.4, zone: [0.45, 0.85] }
    ] },
    { id: 'ramen', name: 'Ramen', price: 30, steps: [
      { station: 'stove', label: 'Boil broth', time: 3.6, zone: [0.58, 0.82] },
      { station: 'stove', label: 'Cook noodles', time: 2.0, zone: [0.50, 0.80] },
      { station: 'plate', label: 'Top bowl', time: 1.2, zone: [0.40, 0.90] }
    ] },
    { id: 'cake', name: 'Cake', price: 40, steps: [
      { station: 'board', label: 'Mix batter', time: 1.6, zone: [0.45, 0.85] },
      { station: 'oven', label: 'Bake cake', time: 4.6, zone: [0.62, 0.80] },
      { station: 'plate', label: 'Frost', time: 1.6, zone: [0.50, 0.80] }
    ] },
    { id: 'lobster', name: 'Lobster', price: 48, steps: [
      { station: 'stove', label: 'Boil lobster', time: 3.4, zone: [0.58, 0.80] },
      { station: 'grill', label: 'Char claws', time: 2.2, zone: [0.55, 0.78] },
      { station: 'plate', label: 'Butter & plate', time: 1.2, zone: [0.40, 0.90] }
    ] }
  ];

  /* Locations - what a kitchen can serve, how many guests fit at once. */
  const LOCATIONS = [
    { id: 'truck', name: 'Food Truck', theme: 'truck', seats: 3, recipes: ['burger', 'salad', 'tacos'], color: '#ff9a3a' },
    { id: 'diner', name: 'Corner Diner', theme: 'diner', seats: 4, recipes: ['burger', 'salad', 'tacos', 'pancakes', 'pasta'], color: '#ff4a6a' },
    { id: 'bistro', name: 'Le Bistro', theme: 'bistro', seats: 4, recipes: ['salad', 'pasta', 'pizza', 'steak', 'curry', 'pancakes'], color: '#c0703a' },
    { id: 'sushi', name: 'Sakura Bar', theme: 'sushi', seats: 5, recipes: ['sushi', 'ramen', 'curry', 'salad', 'tacos', 'steak'], color: '#e04a6a' },
    { id: 'hotel', name: 'Grand Hotel', theme: 'hotel', seats: 5, recipes: ['cake', 'lobster', 'steak', 'sushi', 'pasta', 'pizza', 'ramen', 'curry'], color: '#d4af37' }
  ];

  const CUSTOMER_TYPES = [
    { id: 'regular', name: 'Regular', weight: 10, patience: 1.0, tip: 1.0, from: 0 },
    { id: 'kid', name: 'Kid', weight: 3, patience: 1.15, tip: 0.7, from: 0 },
    { id: 'business', name: 'Businessperson', weight: 4, patience: 0.7, tip: 1.35, from: 3 },
    { id: 'tourist', name: 'Tourist', weight: 3, patience: 1.1, tip: 1.15, from: 6 },
    { id: 'critic', name: 'Food Critic', weight: 1, patience: 0.9, tip: 2.0, from: 2 },
    { id: 'vip', name: 'VIP', weight: 1, patience: 0.8, tip: 2.5, from: 12 }
  ];

  const RECIPE_INDEX = {};
  for (const r of RECIPES)
    RECIPE_INDEX[r.id] = r;

  const LOCATION_INDEX = {};
  for (const l of LOCATIONS)
    LOCATION_INDEX[l.id] = l;

  function recipeById(id) {
    return RECIPE_INDEX[id] || null;
  }

  function locationById(id) {
    return LOCATION_INDEX[id] || (id && typeof id === 'object' ? id : null);
  }

  function roundTo10(v) {
    return Math.round(v / 10) * 10;
  }

  function averagePrice(location) {
    let sum = 0;
    for (const id of location.recipes)
      sum += RECIPE_INDEX[id].price;
    return sum / location.recipes.length;
  }

  /* Career - five locations, six days each. Every day is a little busier, a
     little quicker and a little less patient than the one before it. */
  const CAREER = [];
  for (let d = 0; d < 30; ++d) {
    const loc = Math.floor(d / 6);
    const k = d % 6;
    const location = LOCATIONS[loc];
    const customers = 6 + 2 * k + 2 * loc;
    const turnover = customers * averagePrice(location);
    CAREER.push({
      id: (loc + 1) + '-' + (k + 1),
      location: location.id,
      customers: customers,
      spawnEvery: +(5.2 - 0.25 * k - 0.35 * loc).toFixed(2),
      patience: +(30 - 1.5 * k - 2 * loc).toFixed(1),
      goals: [roundTo10(turnover * 0.6), roundTo10(turnover * 0.85), roundTo10(turnover * 1.1)],
      special: k === 5 ? 'rush' : (k === 2 ? 'critic' : null)
    });
  }

  /* One step of a dish: how the progress bar looked when the cook stopped it. */
  function qualityOf(progress, zone, burnAt = 1.25) {
    if (progress >= burnAt)
      return 'burnt';
    if (progress < zone[0] - 0.12)
      return 'raw';
    if (progress >= zone[0] && progress <= zone[1])
      return 'perfect';
    return 'ok';
  }

  /* A dish is only as good as its worst step; a step without a stop is ruined. */
  function dishScore(results) {
    if (!results || results.length === 0)
      return 'ruined';
    let allPerfect = true;
    for (const q of results) {
      if (q === 'raw' || q === 'burnt')
        return 'ruined';
      if (q !== 'perfect')
        allPerfect = false;
    }
    return allPerfect ? 'perfect' : 'good';
  }

  /* What the guest pays: the dish, how fast they were served, who they are and
     how well the cook is running. patienceLeft is the fraction still on the clock. */
  function tipFor(recipe, dishQuality, patienceLeft, type, comboMult = 1) {
    if (dishQuality === 'ruined')
      return 0;
    const left = patienceLeft < 0 ? 0 : patienceLeft > 1 ? 1 : patienceLeft;
    return Math.round(recipe.price * (dishQuality === 'perfect' ? 1.0 : 0.75) *
      (0.6 + 0.6 * left) * type.tip * comboMult);
  }

  function starsFor(day, earned) {
    const goals = day.goals;
    if (earned >= goals[2])
      return 3;
    if (earned >= goals[1])
      return 2;
    if (earned >= goals[0])
      return 1;
    return 0;
  }

  /* Orders avoid a third of the same dish in a row, so a queue never reads as
     a broken record. */
  function pickRecipe(rng, location, recent) {
    const loc = locationById(location);
    const menu = loc.recipes;
    const last = recent && recent.length > 0 ? recent[recent.length - 1] : null;
    const second = recent && recent.length > 1 ? recent[recent.length - 2] : null;
    const room = [];
    for (const id of menu) {
      if (id === last && id === second)
        continue;
      room.push(id);
    }
    const list = room.length > 0 ? room : menu;
    return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  }

  /* Guests are drawn by weight among the types this day already knows about;
     a critic shows up at most once a day. */
  function pickCustomerType(rng, dayIndex, alreadyHasCritic = false) {
    const room = [];
    let total = 0;
    for (const t of CUSTOMER_TYPES) {
      if (t.from > dayIndex)
        continue;
      if (t.id === 'critic' && alreadyHasCritic)
        continue;
      room.push(t);
      total += t.weight;
    }
    let roll = rng() * total;
    for (const t of room) {
      roll -= t.weight;
      if (roll < 0)
        return t;
    }
    return room[room.length - 1];
  }

  /* Seeded randomness: the same seed replays the same day, and a career day is
     seeded from its date so everyone gets the same kitchen on the same day. */
  function rng(seed) {
    let a = seed >>> 0;
    return function() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; ++i) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function dailySeed(date) {
    const d = date instanceof Date ? date : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return hashSeed('kitchen-' + y + '-' + m + '-' + day);
  }

  /* Endless Rush: the venue rotates as the cook keeps up, the clock tightens
     until it hits its floor. Like every other day, the description is read-only -
     a run keeps its own counters. */
  function endlessDay(index) {
    const location = LOCATIONS[Math.min(LOCATIONS.length - 1, Math.floor(index / 8))];
    return deepFreeze({
      id: 'E' + (index + 1),
      location: location.id,
      customers: Infinity,
      spawnEvery: Math.max(2.2, +(4.6 - 0.08 * index).toFixed(2)),
      patience: Math.max(16, +(28 - 0.3 * index).toFixed(1)),
      goals: [0, 0, 0],
      special: null
    });
  }

  deepFreeze(STATIONS);
  deepFreeze(STATION_ORDER);
  deepFreeze(RECIPES);
  deepFreeze(LOCATIONS);
  deepFreeze(CUSTOMER_TYPES);
  deepFreeze(CAREER);

  SZ.KitchenData = Object.freeze({
    STATIONS, STATION_ORDER, RECIPES, recipeById, LOCATIONS, locationById, CAREER, CUSTOMER_TYPES,
    qualityOf, dishScore, tipFor, starsFor, pickRecipe, pickCustomerType,
    rng, hashSeed, dailySeed, endlessDay
  });
})();
