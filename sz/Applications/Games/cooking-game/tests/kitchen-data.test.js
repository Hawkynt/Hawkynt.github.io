'use strict';

global.window = {};
require('../kitchen-data.js');

let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

const D = window.SZ.KitchenData;

/* Test 1: every export is present */
const names = ['STATIONS', 'STATION_ORDER', 'RECIPES', 'recipeById', 'LOCATIONS', 'locationById',
  'CAREER', 'CUSTOMER_TYPES', 'qualityOf', 'dishScore', 'tipFor', 'starsFor', 'pickRecipe',
  'pickCustomerType', 'rng', 'hashSeed', 'dailySeed', 'endlessDay'];
const missing = names.filter(n => D[n] === undefined);
check('exports', missing.length === 0, 'missing ' + JSON.stringify(missing));

/* Test 2: the counts of the kitchen */
const stationKeys = Object.keys(D.STATIONS);
const ok2 = stationKeys.length === 5 && D.STATION_ORDER.length === 5 && D.RECIPES.length === 12 &&
  D.LOCATIONS.length === 5 && D.CAREER.length === 30 && D.CUSTOMER_TYPES.length === 6;
check('counts', ok2, 'stations ' + stationKeys.length + ' order ' + D.STATION_ORDER.length +
  ' recipes ' + D.RECIPES.length + ' locations ' + D.LOCATIONS.length +
  ' career ' + D.CAREER.length + ' types ' + D.CUSTOMER_TYPES.length);
check('station order', D.STATION_ORDER.join(',') === 'grill,stove,oven,board,plate',
  D.STATION_ORDER.join(','));

/* Test 3: every step names a real station and has a usable zone */
let badSteps = [];
for (const r of D.RECIPES) {
  if (!r.id || !r.name || !(r.price > 0) || !r.steps || r.steps.length === 0)
    badSteps.push(r.id + ' header');
  for (const s of r.steps) {
    if (!D.STATIONS[s.station])
      badSteps.push(r.id + ' station ' + s.station);
    if (!(s.time > 0))
      badSteps.push(r.id + ' time ' + s.time);
    if (!(s.zone && s.zone.length === 2 && 0 < s.zone[0] && s.zone[0] < s.zone[1] && s.zone[1] <= 1))
      badSteps.push(r.id + ' zone ' + JSON.stringify(s.zone));
  }
}
check('recipe steps', badSteps.length === 0, badSteps.join('; '));

/* Test 4: menus reference real recipes and every recipe is served somewhere */
let badMenu = [];
const served = {};
for (const l of D.LOCATIONS) {
  if (!l.id || !l.name || !l.theme || !(l.seats > 0) || !/^#[0-9a-f]{6}$/i.test(l.color))
    badMenu.push(l.id + ' header');
  for (const id of l.recipes) {
    if (!D.recipeById(id))
      badMenu.push(l.id + ' -> ' + id);
    served[id] = true;
  }
}
const homeless = D.RECIPES.filter(r => !served[r.id]).map(r => r.id);
check('menus', badMenu.length === 0 && homeless.length === 0,
  badMenu.join('; ') + ' unserved ' + homeless.join(','));

/* Test 5: career days are well formed and get harder inside a location */
let badCareer = [];
for (let loc = 0; loc < 5; ++loc) {
  for (let k = 0; k < 6; ++k) {
    const day = D.CAREER[loc * 6 + k];
    if (day.id !== (loc + 1) + '-' + (k + 1))
      badCareer.push('id ' + day.id);
    if (day.location !== D.LOCATIONS[loc].id)
      badCareer.push(day.id + ' location ' + day.location);
    const g = day.goals;
    if (!(g[0] > 0 && g[0] < g[1] && g[1] < g[2]))
      badCareer.push(day.id + ' goals ' + JSON.stringify(g));
    if (g.some(v => v % 10 !== 0))
      badCareer.push(day.id + ' not rounded ' + JSON.stringify(g));
    const wantSpecial = k === 5 ? 'rush' : (k === 2 ? 'critic' : null);
    if (day.special !== wantSpecial)
      badCareer.push(day.id + ' special ' + day.special);
    if (k > 0) {
      const prev = D.CAREER[loc * 6 + k - 1];
      if (!(day.customers > prev.customers))
        badCareer.push(day.id + ' customers ' + prev.customers + '->' + day.customers);
      if (!(day.spawnEvery < prev.spawnEvery))
        badCareer.push(day.id + ' spawn ' + prev.spawnEvery + '->' + day.spawnEvery);
      if (!(day.patience < prev.patience))
        badCareer.push(day.id + ' patience ' + prev.patience + '->' + day.patience);
    }
  }
}
check('career', badCareer.length === 0, badCareer.join('; '));

/* Test 6: qualityOf boundaries on the grill zone [0.55, 0.80] */
const zone = [0.55, 0.80];
const qualityCases = [
  [0.00, 'raw'], [0.30, 'raw'], [0.425, 'raw'],
  [0.44, 'ok'], [0.54, 'ok'],
  [0.55, 'perfect'], [0.70, 'perfect'], [0.80, 'perfect'],
  [0.81, 'ok'], [1.00, 'ok'], [1.24, 'ok'],
  [1.25, 'burnt'], [1.60, 'burnt'], [1.00, 'burnt']
];
let badQuality = [];
for (let i = 0; i < qualityCases.length; ++i) {
  const c = qualityCases[i];
  const burnAt = i === qualityCases.length - 1 ? 1.0 : undefined;
  const got = D.qualityOf(c[0], zone, burnAt);
  if (got !== c[1])
    badQuality.push(c[0] + (burnAt === undefined ? '' : ' @' + burnAt) + ' -> ' + got + ' want ' + c[1]);
}
check('qualityOf', badQuality.length === 0, badQuality.join('; '));

/* Test 7: dishScore */
const scoreCases = [
  [['perfect', 'perfect'], 'perfect'],
  [['perfect', 'ok'], 'good'],
  [['ok', 'ok'], 'good'],
  [['perfect', 'burnt'], 'ruined'],
  [['raw', 'perfect'], 'ruined']
];
let badScore = [];
for (const [input, want] of scoreCases) {
  const got = D.dishScore(input);
  if (got !== want)
    badScore.push(JSON.stringify(input) + ' -> ' + got + ' want ' + want);
}
check('dishScore', badScore.length === 0, badScore.join('; '));

/* Test 8: tipFor */
const burger = D.recipeById('burger');
const regular = D.CUSTOMER_TYPES[0];
const critic = D.CUSTOMER_TYPES.filter(t => t.id === 'critic')[0];
const tipCases = [
  [D.tipFor(burger, 'ruined', 1, regular, 1), 0],
  [D.tipFor(burger, 'perfect', 1, regular, 1), 17],
  [D.tipFor(burger, 'good', 1, regular, 1), 13],
  [D.tipFor(burger, 'perfect', 0, regular, 1), 8],
  [D.tipFor(burger, 'perfect', 1, critic, 2), 67]
];
let badTip = [];
for (let i = 0; i < tipCases.length; ++i)
  if (tipCases[i][0] !== tipCases[i][1])
    badTip.push('case ' + i + ' got ' + tipCases[i][0] + ' want ' + tipCases[i][1]);
const perfectBeatsGood = D.tipFor(burger, 'perfect', 0.5, regular, 1) > D.tipFor(burger, 'good', 0.5, regular, 1);
check('tipFor', badTip.length === 0 && perfectBeatsGood, badTip.join('; ') + ' perfect>good ' + perfectBeatsGood);

/* Test 9: starsFor */
const day1 = D.CAREER[0];
const starCases = [[day1.goals[0] - 1, 0], [day1.goals[0], 1], [day1.goals[1], 2],
  [day1.goals[2] - 1, 2], [day1.goals[2], 3]];
let badStars = [];
for (const [earned, want] of starCases) {
  const got = D.starsFor(day1, earned);
  if (got !== want)
    badStars.push(earned + ' -> ' + got + ' want ' + want);
}
check('starsFor', badStars.length === 0, badStars.join('; ') + ' goals ' + JSON.stringify(day1.goals));

/* Test 10: pickRecipe never repeats one dish three times in a row */
let badPick = [];
for (const loc of D.LOCATIONS) {
  const rand = D.rng(D.hashSeed('pick-' + loc.id));
  const recent = [];
  for (let i = 0; i < 200; ++i) {
    const id = D.pickRecipe(rand, loc.id, recent);
    if (!loc.recipes.includes(id))
      badPick.push(loc.id + ' off-menu ' + id);
    recent.push(id);
    if (recent.length > 2 && recent[recent.length - 1] === recent[recent.length - 2] &&
      recent[recent.length - 2] === recent[recent.length - 3])
      badPick.push(loc.id + ' triple ' + id);
  }
}
check('pickRecipe', badPick.length === 0, badPick.slice(0, 4).join('; '));

/* Test 11: pickCustomerType respects the day and the single critic */
let badType = [];
for (let dayIndex = 0; dayIndex < 30; ++dayIndex) {
  const rand = D.rng(D.hashSeed('guests-' + dayIndex));
  for (let i = 0; i < 200; ++i) {
    const t = D.pickCustomerType(rand, dayIndex, false);
    if (t.from > dayIndex)
      badType.push('day ' + dayIndex + ' too early ' + t.id);
    if (t.id === 'vip' && dayIndex < 12)
      badType.push('vip on day ' + dayIndex);
  }
  const rand2 = D.rng(D.hashSeed('nocritic-' + dayIndex));
  for (let i = 0; i < 200; ++i)
    if (D.pickCustomerType(rand2, dayIndex, true).id === 'critic')
      badType.push('second critic on day ' + dayIndex);
}
check('pickCustomerType', badType.length === 0, badType.slice(0, 4).join('; '));

/* Test 12: rng is repeatable and stays in [0, 1) */
const seqA = [];
const seqB = [];
const ra = D.rng(1234567), rb = D.rng(1234567), rc = D.rng(7654321);
for (let i = 0; i < 50; ++i) {
  seqA.push(ra());
  seqB.push(rb());
}
const inRange = seqA.every(v => v >= 0 && v < 1);
const varies = seqA.some((v, i) => v !== rc());
check('rng', seqA.every((v, i) => v === seqB[i]) && inRange && varies,
  'repeat ' + seqA.every((v, i) => v === seqB[i]) + ' range ' + inRange);

/* Test 13: dailySeed is stable per day and differs the next day */
const seedToday = D.dailySeed(new Date(2026, 9, 9));
const seedSame = D.dailySeed(new Date(2026, 9, 9, 23, 59, 59));
const seedNext = D.dailySeed(new Date(2026, 9, 10));
const ok13 = Number.isInteger(seedToday) && seedToday === seedSame && seedToday !== seedNext &&
  D.hashSeed('kitchen-2026-10-09') === seedToday;
check('dailySeed', ok13, seedToday + ' / ' + seedSame + ' / ' + seedNext);

/* Test 14: endlessDay cycles venues and floors the clock */
const e0 = D.endlessDay(0), e8 = D.endlessDay(8), e40 = D.endlessDay(40), e400 = D.endlessDay(400);
const ok14 = e0.location === 'truck' && e8.location === 'diner' && e40.location === 'hotel' &&
  e0.customers === Infinity && e400.customers === Infinity &&
  e0.spawnEvery === 4.6 && e400.spawnEvery === 2.2 &&
  e0.patience === 28 && e400.patience === 16;
check('endlessDay', ok14, JSON.stringify([e0.location, e8.location, e40.location,
  e400.spawnEvery, e400.patience]));

process.exit(failures ? 1 : 0);
