'use strict';

/* Towers over time: a tower battered by a heavy enemy flashes briefly and then stops - it does
   not keep flickering for the rest of the game. The soundtrack follows the map and its bosses. */
const H = require('./harness');
H.installEnv();
const NS = H.load('tower-attacks.js');
const { check, done } = H;
const G = NS.state;

const t = { type: 0, tier: 1, branch: 0, col: 3, row: 3, x: 100, y: 100, hp: 50, maxHp: 50, flash: 0, recoil: 0, angle: 0, cooldown: 1, beamTargets: [], hurtFlash: 0.15 };
G.towers.length = 0;
G.enemies.length = 0;
G.towers.push(t);
for (let i = 0; i < 30; ++i) NS.towerAttacks.updateTowers(1 / 60);
check('the hurt flash fades out after a moment', t.hurtFlash === 0, t.hurtFlash);
/* the soundtrack: the map screen plays the menu theme, a map its biome's song, a boss the battle theme */
require('../../../shared/game-music.js');
G.state = 'MAP_SELECT';
check('the campaign map plays the menu theme', NS.music.themeFor() === NS.music.MENU);
G.state = 'PLAYING';
G.currentMap = 0;
G.enemies.length = 0;
const m0 = NS.music.themeFor();
G.currentMap = 1;
check('every map plays a song of its own in its biome\'s style', m0 !== NS.music.themeFor() && m0.style === NS.music.BIOME[NS.maps.MAPS[0].biome].style);
G.enemies.push({ type: 'boss', hp: 100, x: 0, y: 0 });
check('a boss on the path brings the battle theme at full intensity', NS.music.themeFor().style === NS.music.BOSS.style && NS.music.intensity() === 1);
G.enemies.length = 0;
done();
