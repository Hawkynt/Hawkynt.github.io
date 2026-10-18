'use strict';

/* Progression: tech tree data and purchases, styles, hangar purchases, stars, rewards and unlocks. */
const H = require('./harness');
H.installEnv();
const NS = H.load('core/rules.js');
const { check, done } = H;
const R = NS.rules;
const { BRANCHES, TREE, TREE_BY_ID } = NS.treeData;
const { missionId } = NS.campaign;

check('36 tree nodes in five branches', TREE.length === 36 && BRANCHES.length === 5 && BRANCHES.every(b => TREE.some(n => n.branch === b.id)));
check('node ids are unique', new Set(TREE.map(n => n.id)).size === TREE.length);
check('every requirement exists and is reachable', TREE.every(n => n.req.every(r => TREE_BY_ID[r[0]] && r[1] >= 1 && r[1] <= TREE_BY_ID[r[0]].costs.length)));
check('requirements stay inside the branch', TREE.every(n => n.req.every(r => TREE_BY_ID[r[0]].branch === n.branch)));
check('requirements point up the tree', TREE.every(n => n.req.every(r => TREE_BY_ID[r[0]].row < n.row)));
check('costs rise level by level', TREE.every(n => n.costs.every((c, i) => c > 0 && (i === 0 || c > n.costs[i - 1]))));
check('no two nodes share a grid cell', new Set(TREE.map(n => n.branch + n.row + ':' + n.lane)).size === TREE.length);
check('stat nodes have a stat and per-level value', TREE.every(n => n.style || (n.stat && n.per > 0)));
check('style nodes are one purchase each', TREE.filter(n => n.style).every(n => n.costs.length === 1));
check('every node reads as text', TREE.every(n => R.nodeText(n, 1).indexOf('{') < 0 && R.nodeText(n, 1).length > 5));

const save = R.defaultSave();
check('a broke pilot cannot buy', R.nodeState(save, 'w_dmg') === 'expensive' && !R.buyNode(save, 'w_dmg'));
check('missing prerequisites lock a node', R.nodeState(save, 'w_rate') === 'locked');
save.credits = 100000;
check('buying spends scrap and adds a level', R.buyNode(save, 'w_dmg') && save.tree.w_dmg === 1 && save.credits === 100000 - 150);
check('a prerequisite opens the next node', R.nodeState(save, 'w_rate') === 'available');
for (let i = 0; i < 4; ++i) R.buyNode(save, 'w_dmg');
check('a node maxes out', R.nodeState(save, 'w_dmg') === 'maxed' && !R.buyNode(save, 'w_dmg'));
check('next cost follows the table', R.nodeCost(save, 'w_rate') === TREE_BY_ID.w_rate.costs[0]);

/* styles */
check('stock styles are always owned', R.styleOwned(save, 'skin', 'stock') && R.styleOwned(save, 'trail', 'standard'));
check('unbought styles cannot be equipped', !R.equipStyle(save, 'skin', 'crimson'));
check('buying a style equips it', R.buyNode(save, 'skin_crimson') && save.style.skin === 'crimson');
check('equipping again toggles back to stock', R.equipStyle(save, 'skin', 'crimson') && save.style.skin === 'stock');

/* hangar */
const s2 = R.defaultSave();
check('ships cost scrap', !R.buyShip(s2, 'wraith'));
s2.credits = 5000;
check('buying a ship flies it', R.buyShip(s2, 'wraith') && s2.ship === 'wraith' && s2.credits === 5000 - 1800);
check('a ship is bought once', !R.buyShip(s2, 'wraith'));
check('weapons equip on purchase', R.buyPrimary(s2, 'spread') && s2.loadout.primary === 'spread' && R.buySecondary(s2, 'mines') && s2.loadout.secondary === 'mines');
check('unknown items are refused', !R.buyPrimary(s2, 'nuke') && !R.buyShip(s2, 'nope'));

/* stars, rewards and unlocks */
check('a loss earns no stars', R.missionStars(false, 1, 10, 60) === 0);
check('one star for finishing', R.missionStars(true, 0.2, 100, 60) === 1);
check('two for keeping half the hull', R.missionStars(true, 0.5, 100, 60) === 2);
check('three for beating par as well', R.missionStars(true, 0.9, 59, 60) === 3);
check('par alone without hull is two', R.missionStars(true, 0.1, 30, 60) === 2);
check('rewards grow with sector and stars', R.missionReward(4, 0, 3, 0) > R.missionReward(0, 0, 3, 0) && R.missionReward(0, 0, 3, 0) > R.missionReward(0, 0, 1, 0));
check('replays pay less than the first clear', R.missionReward(1, 2, 2, 2) < R.missionReward(1, 2, 2, 0));
check('boss missions pay the most in a sector', R.missionReward(2, 5, 1, 0) > R.missionReward(2, 4, 1, 0));
check('a failed mission still pays a little', R.missionReward(0, 0, 0, 0) > 0);
const s3 = R.defaultSave();
check('only the first mission starts open', R.missionUnlocked(s3, 0, 0) && !R.missionUnlocked(s3, 0, 1) && !R.sectorUnlocked(s3, 1));
s3.stars[missionId(0, 0)] = 1;
check('a star opens the next mission', R.missionUnlocked(s3, 0, 1));
s3.stars[missionId(0, 5)] = 1;
check('beating the boss opens the next sector and boss rush', R.sectorUnlocked(s3, 1) && R.bossRushUnlocked(s3));
check('stars add up', R.totalStars(s3) === 2);
check('score pays scrap scaled by salvage', R.scoreScrap(4500, { salvage: 1 }) === 100 && R.scoreScrap(4500, { salvage: 1.2 }) === 120);

done();
