'use strict';

/* The market: prices from value, drift and saturation; selling pushes the price down and it
   recovers over cycles; drift stays in bounds; booms and busts; history; refining 3:1;
   contracts; the service bill. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/economy.js');
const { check, done } = H;
const R = NS.rules, E = NS.economy;
const { ORES, ORE_BY_ID } = NS.ores;

const s = R.freshSave();
E.initMarket(s);
const st = R.computeStats(s);
check('a neutral market pays the base value', E.price(s, st, 'gold') === ORE_BY_ID.gold.value);
check('a bar is worth three ore without a refinery bonus', E.barPrice(s, st, 'gold') === ORE_BY_ID.gold.value * 3);

s.store.ore.iron = 200;
const p0 = E.price(s, st, 'iron');
const got = E.sell(s, st, 'ore', 'iron', 200);
const p1 = E.price(s, st, 'iron');
check('selling pays credits and counts as earned', got > 0 && s.credits === R.START_CREDITS + got && s.stats.earned === got);
check('a big sale pushes the price down', p1 < p0);
check('the sale is less than 200 x the starting price', got < 200 * p0);
check('the stock is gone', !s.store.ore.iron);
check('selling nothing pays nothing', E.sell(s, st, 'ore', 'iron', 5) === 0);
const rng = NS.rng.makeRng(42);
for (let i = 0; i < 4; ++i) E.tickMarket(s, st, rng);
check('saturation recovers over cycles', E.price(s, st, 'iron') > p1 || s.market.iron.sat < 0.05);

let inBounds = true, news = 0;
const r2 = NS.rng.makeRng(7);
for (let i = 0; i < 300; ++i) {
  E.tickMarket(s, st, r2);
  if (s.news) ++news;
  for (const o of ORES) if (s.market[o.id].f < 0.55 || s.market[o.id].f > 1.9) inBounds = false;
}
check('price drift stays within bounds', inBounds);
check('booms and busts make the news now and then', news > 30 && news < 200, news);
check('history keeps the last cycles', ORES.every(o => s.market[o.id].hist.length === E.HISTORY));
check('the cycle counter advances', s.cycle === 304);
check('forecasts read -1, 0 or 1', ORES.every(o => [-1, 0, 1].indexOf(E.forecast(s, o.id)) >= 0));

/* refining */
const f = R.freshSave();
E.initMarket(f);
let fs = R.computeStats(f);
f.store.ore.copper = 10;
check('no refinery, no bars', E.refine(f, fs, 'copper') === 0);
f.modules.refinery = 1;
fs = R.computeStats(f);
check('3 ore make 1 bar, leftovers stay', E.refine(f, fs, 'copper') === 3 && f.store.bar.copper === 3 && f.store.ore.copper === 1);
check('a refined bar beats its three ore', E.barPrice(f, fs, 'copper') > 3 * E.price(f, fs, 'copper'));
check('bars count for the Smelter goal', f.stats.bars === 3);

/* contracts */
const c = R.freshSave();
E.initMarket(c);
const cst = R.computeStats(c);
E.refillContracts(c, cst, NS.rng.makeRng(3));
check('contracts fill the open slots', c.contracts.length === cst.contracts);
check('contracts only ask for reachable ore', c.contracts.every(k => E.reachableOres(c).indexOf(k.ore) >= 0));
check('without a refinery contracts ask for ore', c.contracts.every(k => k.kind === 'ore'));
const k0 = c.contracts[0];
check('an unmet contract cannot be delivered', !E.canFulfil(c, k0) && E.fulfil(c, 0) === null);
c.store.ore[k0.ore] = k0.qty + 2;
const cr0 = c.credits, rd0 = c.rd;
check('delivering pays credits and data', E.fulfil(c, 0) === k0 && c.credits === cr0 + k0.reward && c.rd === rd0 + k0.rd && c.store.ore[k0.ore] === 2);
check('contracts pay more than the market', k0.reward > k0.qty * ORE_BY_ID[k0.ore].value);
const before = c.contracts.map(k => k.trips);
E.tickMarket(c, cst, NS.rng.makeRng(9));
check('contracts age each cycle and refill', c.contracts.length === cst.contracts && c.contracts.slice(0, before.length - 1).every((k, i) => k.trips <= Math.max.apply(null, before)));

/* service */
const sv = R.computeStats(R.freshSave());
check('refuel and repairs cost credits', E.serviceCost(sv, 50, 20) > 0);
const dep = R.freshSave();
dep.modules.depot = 3;
check('a full fuel depot makes service free', E.serviceCost(R.computeStats(dep), 50, 20) === 0);
check('cargo value sums the hold', E.cargoValue(s, st, { iron: 0 }) === 0 && E.cargoValue(f, fs, { gold: 2 }) === 2 * E.price(f, fs, 'gold'));

done();
