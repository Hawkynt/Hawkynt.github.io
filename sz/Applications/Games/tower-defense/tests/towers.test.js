'use strict';

/* Towers over time: a tower battered by a heavy enemy flashes briefly and then stops - it does
   not keep flickering for the rest of the game. */
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
done();
