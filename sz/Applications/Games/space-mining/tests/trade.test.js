'use strict';

/* Outpost trade: every outpost buys and sells at its own prices (cheap where its belt is rich in an
   ore, a premium where the belt lacks it), selling there saturates its market and a market cycle
   lets it recover, freight fees per unit and belt crossed, shipping between outposts limited by
   stock, room and credits, abandoned outposts closed, the save repair, and the trade board in the
   station's Colonies tab. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const T = NS.trade;
const C = NS.colony;
const { ORE_BY_ID } = NS.ores;

/* ── local factors ── */
check('Kessler is rich in iron: it sells at the floor there', T.factor('kessler', 'iron') === 0.6);
check('an ore a belt lacks fetches the full premium', T.factor('kessler', 'iridium') === 1.5 && T.factor('void', 'iron') === 1.5);
check('in between it follows the ore\'s share of the mix', T.factor('crimson', 'iridium') > 0.6 && T.factor('crimson', 'iridium') < 1.5);
let bounded = true;
for (const z of NS.ores.ZONES) for (const o of NS.ores.ORES) { const f = T.factor(z.id, o.id); if (!(f >= 0.6 && f <= 1.5)) bounded = false; }
check('every factor lies between 0.6 and 1.5', bounded);

/* ── two outposts ── */
const s = NS.rules.freshSave();
s.licenses.push('amber', 'verdant', 'crimson', 'void');
const stats = NS.rules.computeStats(s);
function outpost(zid) {
  const b = C.newBase(zid);
  b.buildings.push({ id: 1, type: 'hub', cx: 9, cy: 7, prog: 1, hp: 1000, maxHp: 1000, lvl: 1 });
  s.bases[zid] = b;
  return b;
}
const kes = outpost('kessler'), vd = outpost('void');
kes.stock.ore.iron = 100;
kes.stock.bar.iron = 10;
check('a founded outpost trades, a site without one does not', T.open(s, 'kessler') && !T.open(s, 'amber'));

/* ── prices and selling ── */
const pIron = T.price(s, stats, 'kessler', 'ore', 'iron');
check('the local price is the base value times the factor (and the trade bonus)', pIron === Math.max(1, Math.round(ORE_BY_ID.iron.value * 0.6 * stats.priceMul)));
check('a bar is three ore at 1.3 times', T.price(s, stats, 'kessler', 'bar', 'iron') === Math.max(1, Math.round(ORE_BY_ID.iron.value * 3 * 1.3 * 0.6 * stats.priceMul)));
check('iron fetches more where the belt lacks it', T.price(s, stats, 'void', 'ore', 'iron') > 2 * pIron);
const cr0 = s.credits;
const got = T.sell(s, stats, 'kessler', 'ore', 'iron', 60);
check('selling at an outpost pays credits and takes the stock', got > 0 && s.credits === cr0 + got && kes.stock.ore.iron === 40);
check('and lowers its price for the next', T.price(s, stats, 'kessler', 'ore', 'iron') < pIron || pIron <= 2);
check('selling more than there is sells what there is', T.sell(s, stats, 'kessler', 'bar', 'iron', 999) > 0 && !kes.stock.bar.iron);
const satBefore = kes.sat.iron;
T.recover(s);
check('a market cycle lets the outpost\'s market recover', kes.sat.iron < satBefore && Math.abs(kes.sat.iron - satBefore * 0.6) < 1e-9);
check('the earnings count as earned', s.stats.earned >= got);

/* ── freight ── */
check('the fee is 1 credit plus 5% of the unit\'s value per belt crossed', T.fee('kessler', 'void', 'ore', 'iron') === Math.ceil(1 + 0.05 * ORE_BY_ID.iron.value * 4) && T.fee('kessler', 'amber', 'ore', 'iron') === Math.ceil(1 + 0.05 * ORE_BY_ID.iron.value));
check('a bar pays for its three ore', T.fee('kessler', 'void', 'bar', 'iron') === Math.ceil(1 + 0.05 * ORE_BY_ID.iron.value * 3 * 4));
vd.buildings.push({ id: 2, type: 'warehouse', cx: 2, cy: 2, prog: 1, hp: 300, maxHp: 300, lvl: 1 });
const room = C.stockRoom(vd, stats, 'ore', 'iron');
s.credits = 100000;
kes.stock.ore.iron = 40;
const cr1 = s.credits;
const r = T.ship(s, stats, 'kessler', 'void', 'ore', 'iron', 30);
check('shipping moves the stock and charges the fee', r.moved === Math.min(30, room) && kes.stock.ore.iron === 40 - r.moved && vd.stock.ore.iron === r.moved && s.credits === cr1 - r.fee && r.fee === r.moved * T.fee('kessler', 'void', 'ore', 'iron'));
s.credits = T.fee('kessler', 'void', 'ore', 'iron') * 3 + 1;
const r2 = T.ship(s, stats, 'kessler', 'void', 'ore', 'iron', 10);
check('no more than the credits pay for', r2.moved <= 3);
s.credits = 100000;
const full = C.storageCap(vd, stats);
kes.stock.ore.iron = full * 50;
const r3 = T.ship(s, stats, 'kessler', 'void', 'ore', 'iron', full * 50);
check('no more than the other outpost has room for', C.stockCount(vd.stock, vd) <= full && r3.moved > 0);
check('a shipment to itself goes nowhere', T.ship(s, stats, 'kessler', 'kessler', 'ore', 'iron', 5).moved === 0);
kes.stock.ore.iridium = 5;
const sellHere = 5 * T.price(s, stats, 'kessler', 'ore', 'iridium');
vd.abandoned = true;
check('an abandoned outpost neither trades nor takes shipments', !T.open(s, 'void') && T.ship(s, stats, 'kessler', 'void', 'ore', 'iridium', 5).moved === 0 && T.sell(s, stats, 'void', 'ore', 'iron', 5) === 0);
vd.abandoned = false;
void sellHere;

/* the profit: iridium the Void has plenty of, sold in Kessler where there is none */
const buyVoid = T.price(s, stats, 'void', 'ore', 'iridium'), sellKes = T.price(s, stats, 'kessler', 'ore', 'iridium');
check('shipping iridium from the Void to Kessler pays more than the fee', sellKes - buyVoid > T.fee('void', 'kessler', 'ore', 'iridium'));

/* ── the save ── */
kes.sat = { iron: 0.3, bogus: 2 };
const rep = NS.rules.migrateSave(JSON.parse(JSON.stringify(s)));
check('the outposts\' markets survive the save repair (unknown ores dropped)', rep.bases.kessler.sat.iron === 0.3 && rep.bases.kessler.sat.bogus === undefined);

/* ── the market cycle at the station recovers them ── */
NS.economy.tickMarket(s, stats, NS.rng.makeRng(7));
check('the home market cycle lets every outpost market recover', kes.sat.iron < 0.3);

/* ── the trade board ── */
vd.stock = { ore: {}, bar: {}, comp: {} };
G.save = s;
G.save.seenIntro = true;
NS.save.refreshStats();
NS.screens.setScreen('station');
G.ui.stationTab = 'colonies';
let errors = 0;
try { H.run(NS, 2, 1); } catch (e) { ++errors; console.log(e.stack); }
check('the Colonies tab offers Trade on a founded outpost', G.hitAreas.some(a => a.id === 'trade_kessler') && !G.hitAreas.some(a => a.id === 'trade_amber'));
G.hitAreas.find(a => a.id === 'trade_kessler').action();
try { H.run(NS, 2, 1); } catch (e) { ++errors; console.log(e.stack); }
kes.stock.ore.iron = 50;
try { H.run(NS, 2, 1); } catch (e) { ++errors; console.log(e.stack); }
check('the trade board lists the outpost\'s stock with sell and ship buttons', G.ui.tradeZone === 'kessler' && G.hitAreas.some(a => a.id === 'tsell_ore_iron') && G.hitAreas.some(a => a.id === 'tship_ore_iron'));
const c2 = G.save.credits;
G.hitAreas.find(a => a.id === 'tsell_ore_iron').action();
check('its sell button sells ten', kes.stock.ore.iron === 40 && G.save.credits > c2);
const vBefore = vd.stock.ore.iron || 0;
G.hitAreas.find(a => a.id === 'tship_ore_iron').action();
check('its ship button ships ten to the chosen outpost', (vd.stock.ore.iron || 0) > vBefore && kes.stock.ore.iron < 40 && G.ui.tradeTo === 'void');
G.hitAreas.find(a => a.id === 'trade_back').action();
try { H.run(NS, 2, 1); } catch (e) { ++errors; console.log(e.stack); }
check('back to the list', !G.ui.tradeZone && G.hitAreas.some(a => a.id === 'trade_kessler'));
check('drawn without errors', errors === 0);

done();
