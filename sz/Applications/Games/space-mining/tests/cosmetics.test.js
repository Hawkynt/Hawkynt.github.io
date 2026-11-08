'use strict';

/* The collection and festivals: a fresh save flies the factory finish; liveries lay their colours
   over any hull and plumes set the engine glow; items unlock from the start, with credits or
   research, achievements, belt licences, the Crown or a festival track; what is not owned cannot
   be equipped; every season has its own livery, beam and plume; trips while a season runs fill
   its six-tier track, nothing outside one, and a new season starts a new track; stored cosmetics
   are repaired; the soundtrack follows belts, modes and screens. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/music.js');
const { check, done } = H;
const R = NS.rules, CO = NS.cosmetics, D = NS.cosmeticData, G = NS.state;

const s = R.migrateSave(null, null);
const hull = NS.ships.HULL_BY_ID[s.hull].colors;
check('a fresh save flies the factory finish', CO.equipped(s, 'livery').id === 'factory' && R.computeStats(s).colors.hull === hull.hull);
const hazard = D.LIVERIES.find(x => x.id === 'hazard');
check('an unowned livery cannot be equipped', !CO.equip(s, 'livery', 'hazard'));
s.credits = 100000;
check('a credit livery can be bought once', CO.buy(s, 'livery', hazard) && s.credits === 100000 - 15000 && !CO.buy(s, 'livery', hazard));
CO.equip(s, 'livery', 'hazard');
check('a livery lays its colours over the hull', R.computeStats(s).colors.hull === hazard.colors.hull && R.computeStats(s).colors.glass === hull.glass);
s.rd = 1000;
CO.buy(s, 'plume', D.PLUMES.find(x => x.id === 'pink'));
CO.equip(s, 'plume', 'pink');
check('a plume sets the engine glow, bought with research', R.computeStats(s).colors.glow === '#ff5ad0' && s.rd === 700);
check('achievements unlock items', !CO.owned(s, 'beam', D.BEAMS.find(x => x.id === 'violet')) && (() => { for (let i = 0; i < 10; ++i) s.achievements[NS.goals.ACHIEVEMENTS[i].id] = true; return CO.owned(s, 'beam', D.BEAMS.find(x => x.id === 'violet')); })());
s.licenses = ['kessler', 'a', 'b'];
check('belt licences unlock items', CO.owned(s, 'livery', D.LIVERIES.find(x => x.id === 'cobalt')));
check('the Crown unlocks its livery', !CO.owned(s, 'livery', D.LIVERIES.find(x => x.id === 'crown')) && (s.crownDone = true) && CO.owned(s, 'livery', D.LIVERIES.find(x => x.id === 'crown')));
let all = true;
for (const se of NS.eventData.SEASONS) for (const k of ['livery', 'beam', 'plume']) if (!CO.festivalItem(se.id, k)) all = false;
check('every season has its own livery, beam and plume', all && NS.eventData.SEASONS.length === 6);

const f = R.migrateSave(null, null);
const inSeason = new Date(2026, 9, 28), outside = new Date(2026, 8, 1);
check('no festival, no tokens', CO.addTokens(f, 500, outside).length === 0 && f.festival.tokens === 0);
const got = CO.addTokens(f, 300, inSeason);
check('a season\'s track pays all six tiers with its livery, beam and plume', got.length === 6 && CO.owned(f, 'livery', CO.festivalItem('voidnight', 'livery'))
  && CO.owned(f, 'beam', CO.festivalItem('voidnight', 'beam')) && CO.owned(f, 'plume', CO.festivalItem('voidnight', 'plume')) && f.credits > R.START_CREDITS);
CO.addTokens(f, 10, new Date(2026, 11, 25));
check('a new season starts a new track', f.festival.event.indexOf('perihelion') === 0 && f.festival.tokens === 10 && f.festival.claimed === 0);
check('a haul earns tokens by its value', CO.tokensFor(0) === 0 && CO.tokensFor(10) === 1 && CO.tokensFor(4000) === 10);
const fixed = R.migrateSave({ cosmetics: { livery: 'nope', beam: 'gold', owned: { 'beam:gold': true, '<x>': true, 'livery:hazard': 'yes' } }, festival: { event: 'bloom-2026', tokens: -4, claimed: 99 } }, null);
check('stored cosmetics are repaired', fixed.cosmetics.livery === 'factory' && fixed.cosmetics.beam === 'gold' && fixed.cosmetics.owned['beam:gold'] && !fixed.cosmetics.owned['livery:hazard']
  && fixed.festival.tokens === 0 && fixed.festival.claimed === D.TIERS.length);

const M = NS.music;
G.run = { mode: 'career', zoneIndex: 2 };
G.screen = 'playing';
check('each belt has its theme', M.themeFor() === M.BELT[2]);
G.run.mode = 'siege';
check('Siege has a battle theme', M.themeFor() === M.SIEGE);
G.run.mode = 'rush';
check('Gold Rush drives', M.themeFor() === M.RUSH);
G.run = null; G.screen = 'station';
check('the station has its own theme, the menus another', M.themeFor() === M.STATION && (G.screen = 'title') && M.themeFor() === M.MENU);
done();
