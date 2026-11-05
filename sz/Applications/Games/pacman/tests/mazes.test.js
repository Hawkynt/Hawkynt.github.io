'use strict';

/* Mazes: the classic layout and every generated maze are symmetric, fully connected, free of dead
   ends and traps (arrow pads and portals counted as one-way moves), with four power pellets; the
   twenty story mazes and five boss arenas are proven completable by the autopilot playing the real
   simulation. */
const H = require('./harness');
H.installEnv();
const NS = H.load();
const { check, done } = H;
const M = NS.mazes;
const G = NS.state;
const { WORLDS } = NS.worlds;

const classic = M.classic();
const cv = M.validate(classic);
check('the classic maze is valid', cv.ok, cv.errors.join('; '));
check('the classic maze has its 240 dots and 4 pellets', cv.dots === 240 && cv.power === 4);

let bad = [];
for (let s = 0; s < 400; ++s) {
  const m = M.generate(s * 7 + 1, { features: ['pads', 'taffy', 'ice', 'portals', 'vents'] });
  const v = M.validate(m), p = M.validatePlay(m);
  if (!v.ok || !p.ok || m.seed === 'classic') bad.push(s + ':' + v.errors.concat(p.errors).slice(0, 2).join(','));
}
check('400 generated mazes with every twist are valid and trap-free', bad.length === 0, bad.slice(0, 3).join(' | '));

const arenas = [];
for (let s = 0; s < 50; ++s) {
  const m = M.generate('boss-' + s, { close: 0.14, arena: true });
  if (!M.validate(m).ok) arenas.push(s);
}
check('boss arenas are valid', arenas.length === 0, arenas.join(','));

check('generation is deterministic', JSON.stringify(M.generate(123, { features: ['pads'] })) === JSON.stringify(M.generate(123, { features: ['pads'] })));

/* every story maze, as the game builds it */
const storyBad = [];
for (let w = 0; w < WORLDS.length; ++w)
  for (let s = 0; s < 5; ++s) {
    const run = NS.run.create('story', { world: w, stage: s, demo: true });
    const lvl = NS.level.build(run);
    const v = M.validate(lvl.maze), p = M.validatePlay(lvl.maze);
    if (!v.ok || !p.ok) storyBad.push(w + '-' + s + ' ' + v.errors.concat(p.errors).slice(0, 2).join(','));
    if (s < 4 && lvl.maze.seed === 'classic' && WORLDS[w].levels[s].seed !== 'classic') storyBad.push(w + '-' + s + ' fell back to classic');
  }
check('all 25 story stages build valid mazes', storyBad.length === 0, storyBad.join(' | '));

/* the autopilot clears every story stage in the real simulation */
NS.screens.setScreen = (s) => { G.screen = s; };
NS.cinematics.play = (k, d, cb) => { if (cb) cb(); };
NS.screens.chapter = (w, cb) => cb();
const times = [];
const fails = [];
for (let w = 0; w < WORLDS.length; ++w)
  for (let s = 0; s < 5; ++s) {
    let cleared = false;
    for (let attempt = 0; attempt < 3 && !cleared; ++attempt) {
      const run = NS.run.create('story', { world: w, stage: s });
      run.demo = true;
      G.run = run;
      NS.level.start(run);
      run.lvl.phase = 'play';
      G.screen = 'playing';
      const steps = H.playMaze(NS, 60 * 60 * 10);
      if (steps >= 0) { cleared = true; times.push(w + '-' + s + ':' + Math.round(steps / 60) + 's'); }
    }
    if (!cleared) fails.push(w + '-' + s);
  }
console.log('  clear times ' + times.join(' '));
check('the autopilot clears all 20 story mazes and 5 bosses', fails.length === 0, fails.join(','));

done();
