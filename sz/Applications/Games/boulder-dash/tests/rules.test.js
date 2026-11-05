'use strict';

/* Cave rules on small hand-drawn caves: falling, rolling, crushing, shields, pushing with
   strain, grab, creatures exploding on contact, butterflies into gems, the magic wall, lava,
   powder barrel chains, spore moss, sliding ice, dynamite, the exit, boss damage, moles that
   wake up, power-up timers and the slow-motion cadence. */
const H = require('./harness.js');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const C = NS.constants;

const LEGEND = { '=': C.STEEL, ':': C.DIRT, '.': C.EMPTY, 'O': C.BOULDER, 'o': C.GEM, '#': C.BRICK, 'E': C.EXIT, 'M': C.MAGIC,
  'A': C.AMOEBA, '~': C.LAVA, 'I': C.ICE, '%': C.TNT, 'f': C.FIREFLY, 'b': C.BUTTERFLY, 'm': C.MOLE, 'B': C.BAT, 'P': C.PLAYER };

function cave(rows) {
  const h = rows.length, w = rows[0].length;
  const cv = NS.cavegen.newCave(w, h, 1);
  for (let r = 0; r < h; ++r)
    for (let c = 0; c < w; ++c) {
      const t = LEGEND[rows[r][c]];
      cv.cells[r * w + c] = t;
      if (t === C.PLAYER) cv.player = NS.cavegen.newPlayer(r, c);
      if (t === C.EXIT) { cv.exitR = r; cv.exitC = c; }
    }
  if (!cv.player) cv.player = NS.cavegen.newPlayer(1, 1);
  cv.perks = NS.progression.perks(NS.progression.defaultSave());
  cv.player.moveT = 99;
  return cv;
}
const at = (cv, r, c) => cv.cells[r * cv.w + c];
const ticks = (cv, n) => { for (let k = 0; k < n; ++k) NS.physics.tick(cv); };
const steps = (cv, n, intent) => { for (let k = 0; k < n; ++k) NS.sim.stepCave(cv, intent || { dir: -1 }); };
const has = (cv, t) => cv.events.some((e) => e.t === t);

/* falling and landing */
let cv = cave(['=====', '=.O.=', '=...=', '=...=', '=====']);
ticks(cv, 1);
check('boulder falls into empty space', at(cv, 2, 2) === C.BOULDER && cv.fall[2 * 5 + 2] === 1);
ticks(cv, 3);
check('boulder lands and rests', at(cv, 3, 2) === C.BOULDER && !cv.fall[3 * 5 + 2] && has(cv, 'land'));

/* rolling off a gem */
cv = cave(['=====', '=.O.=', '=.o.=', '=:::=', '=====']);
ticks(cv, 1);
check('boulder rolls off a rounded gem', at(cv, 1, 2) === C.EMPTY && (at(cv, 1, 1) === C.BOULDER || at(cv, 1, 3) === C.BOULDER));

/* crushing the miner; a resting boulder overhead is harmless */
cv = cave(['=====', '=.O.=', '=...=', '=.P.=', '=====']);
ticks(cv, 3);
check('falling boulder crushes the miner', !cv.player.alive && has(cv, 'death'));
cv = cave(['=====', '=.O.=', '=.P.=', '=:::=', '=====']);
ticks(cv, 5);
check('boulder resting on the miner does not hurt', cv.player.alive);

/* hard hat */
cv = cave(['=====', '=.O.=', '=...=', '=.P.=', '=====']);
cv.player.shield = 1;
ticks(cv, 3);
check('hard hat absorbs a crush', cv.player.alive && cv.player.shield === 0 && has(cv, 'shield'));

/* zen: no death */
cv = cave(['=====', '=.O.=', '=...=', '=.P.=', '=====']);
cv.zen = true;
ticks(cv, 3);
check('zen mode bonks instead of killing', cv.player.alive && has(cv, 'bonk'));

/* pushing needs a moment of strain */
cv = cave(['======', '=PO..=', '=::::=', '======']);
let moved = NS.player.tryMove(cv, 1, false);
check('first push attempt only strains', !moved && at(cv, 1, 2) === C.BOULDER && has(cv, 'strain'));
moved = NS.player.tryMove(cv, 1, false);
check('second push moves the boulder', moved && at(cv, 1, 3) === C.BOULDER && at(cv, 1, 2) === C.PLAYER);
cv = cave(['=====', '=PO:=', '=:::=', '=====']);
NS.player.tryMove(cv, 1, false);
check('boulder against dirt cannot be pushed', !NS.player.tryMove(cv, 1, false) && at(cv, 1, 2) === C.BOULDER);

/* grab */
cv = cave(['=====', '=Po:=', '=:::=', '=====']);
NS.player.tryMove(cv, 1, true);
check('grab collects the gem without moving', cv.gems === 1 && cv.player.c === 1 && at(cv, 1, 2) === C.EMPTY);

/* creatures */
cv = cave(['======', '=P.f.=', '=::::=', '======']);
NS.player.tryMove(cv, 1, false);
NS.creatures.contact(cv);
check('firefly explodes on contact and takes the miner', !cv.player.alive && has(cv, 'touch'));
cv = cave(['=======', '=:O:::=', '=:.:::=', '=:b:::=', '=:::::=', '=======']);
ticks(cv, 6);
check('butterfly crushed by a boulder leaves gems', has(cv, 'crush') && cv.cells.filter((t) => t === C.GEM).length >= 5);
cv = cave(['=======', '=.....=', '=.:::.=', '=.:::.=', '=f....=', '=======']);
cv.player.alive = false;
const before = [];
for (let k = 0; k < 8; ++k) { ticks(cv, 1); before.push(cv.cells.indexOf(C.FIREFLY)); }
check('firefly follows the wall around a block', new Set(before).size >= 6);
cv = cave(['============', '=..........=', '=..........=', '=m.........=', '=:::::::::P=', '============']);
ticks(cv, 6);
check('a distant mole dozes', at(cv, 3, 1) === C.MOLE);
cv.player.c = 4; cv.cells[4 * 12 + 10] = C.DIRT; cv.cells[4 * 12 + 4] = C.PLAYER;
ticks(cv, 6);
check('a mole wakes when the miner comes near and digs closer', at(cv, 3, 1) !== C.MOLE && has(cv, 'wake'));

/* magic wall */
cv = cave(['=====', '=.O.=', '=...=', '=MMM=', '=...=', '=...=', '=====']);
ticks(cv, 6);
check('magic wall turns a falling boulder into a gem', cv.magic.state === 1 && cv.cells.indexOf(C.GEM) > 3 * 5 && cv.cells.indexOf(C.BOULDER) < 0);

/* lava */
cv = cave(['=====', '=.O.=', '=...=', '=~~~=', '=====']);
ticks(cv, 4);
check('boulder cools lava into brick', at(cv, 3, 2) === C.BRICK && has(cv, 'sizzle'));

/* powder barrels chain */
cv = cave(['========', '=.%....=', '=......=', '=:%%%%:=', '========']);
ticks(cv, 6);
check('a dropped barrel sets off its neighbours', cv.cells.filter((t) => t === C.TNT).length === 0);

/* spore moss trapped turns into gems */
cv = cave(['=====', '=#A#=', '=###=', '=====']);
ticks(cv, 2);
check('trapped spore moss crystallises', at(cv, 1, 2) === C.GEM && has(cv, 'amoebaGems'));

/* ice slides */
cv = cave(['========', '=PI....=', '=::::::=', '========']);
NS.player.tryMove(cv, 1, false); NS.player.tryMove(cv, 1, false);
ticks(cv, 6);
check('pushed ice slides until it hits the wall', at(cv, 1, 6) === C.ICE);

/* dynamite */
cv = cave(['=======', '=:::::=', '=:P#::=', '=:::::=', '=======']);
cv.player.bombs = 1;
NS.player.dropBomb(cv);
check('dynamite is set and used up', cv.bombs.length === 1 && cv.player.bombs === 0);
NS.player.tryMove(cv, 0, false);
cv.player.shield = 1;
ticks(cv, 14);
check('dynamite blasts brick and dirt around it', at(cv, 2, 3) === C.EMPTY && has(cv, 'brick'));

/* exit */
cv = cave(['======', '=PoE.=', '======']);
cv.required = 1;
NS.player.tryMove(cv, 1, false);
ticks(cv, 1);
check('the exit opens once the quota is met', cv.exitOpen && has(cv, 'exitOpen'));
cv.player.moveT = 99;
NS.player.tryMove(cv, 1, false);
check('walking into the open exit wins', cv.won);

/* boss */
cv = cave(['==========', '=O.......=', '=........=', '=........=', '=........=', '=P.......=', '=:::::::::=', '=========='].map((r) => r.slice(0, 10)));
NS.boss.spawn(cv, 'grub', 3, 1);
cv.cells[1 * 10 + 1] = C.BOULDER;
cv.cells[2 * 10 + 1] = C.EMPTY;
cv.fall[1 * 10 + 1] = 1;
const hp = cv.boss.hp;
NS.physics.tick(cv);
check('a falling boulder hurts the boss', cv.boss.hp === hp - 1 && has(cv, 'bossHit'));
cv.boss.inv = 0; cv.boss.hp = 1;
NS.boss.damage(cv, 'blast');
check('the last hit defeats the boss and opens the way', cv.bossDefeated && has(cv, 'bossDie'));

/* timers and cadence */
cv = cave(['=====', '=P..=', '=:::=', '=====']);
NS.player.applyItem(cv, 10, 6);
steps(cv, 1);
check('stopwatch slows the cave tick', cv.worldPeriod === C.SLOW_PERIOD);
NS.player.applyItem(cv, 8, 6);
steps(cv, 1);
check('swift boots shorten the move slot', cv.playerPeriod === C.BOOTS_PERIOD);
steps(cv, 60 * 13);
check('timed power-ups run out', !cv.player.pow.boots && !cv.player.pow.slow && has(cv, 'powEnd'));
done();
