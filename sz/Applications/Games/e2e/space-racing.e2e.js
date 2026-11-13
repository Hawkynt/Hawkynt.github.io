'use strict';

/* Space Racing's story, goals and Daily Race in a real browser: the Bronze Cup opens with the
   prologue and the cup's words while the race holds, a livery from Goals repaints the ship, the
   Daily Race starts on today's track, and a finished race counts toward goals and the Daily best. */
exports.ns = 'SpaceRacing';
exports.game = 'space-racing';

exports.run = async (t) => {
  const M = require('./meta-helpers')(t, 'SpaceRacing');
  await M.open('space-racing');
  await M.run('NS.career.startCup(0); G.state = "PLAYING";');
  await t.wait(1500);
  t.check('the Bronze Cup opens with the prologue and holds the race', await M.has('.szs-overlay') && await M.run('return G.hold === true;'));
  await t.shot('01-prologue');
  let n = 0;
  while (await M.has('.szs-overlay') && n++ < 40) await M.click('.szs-overlay');
  t.check('the scenes play through', !(await M.has('.szs-overlay')) && await M.run('return !G.hold;'));
  await M.run('NS.meta.goals.state.owned["racing-red"] = true; NS.meta.open("daily");');
  await t.wait(300);
  await t.shot('02-daily-tab');
  await M.click('[data-a="daily"]');
  await t.wait(800);
  t.check('the Daily Race starts on today\'s track', await M.run('const r = NS.meta.goals.dailyRecipe(); return !!G.dailyRace && G.currentTrackIndex === r.seed % NS.defs.TRACKS.length;'));
  await M.run('NS.meta.goals.equip("racing-red"); G.state = "PLAYING";');
  await t.wait(1500);
  await t.shot('03-livery');
  await M.run('G.raceTime = 95; NS.race.finishRace();');
  await t.wait(800);
  t.check('a finished race counts toward goals and the Daily best', await M.run('const s = NS.meta.goals.state; return s.stats.races >= 1 && s.daily.best > 0 && NS.meta.livery()[0] === "#e83a3a";'));

  /* Time Trial and ghosts: a recorded run becomes the ghost of its track */
  await M.run('G.showTutorial = false; G.timeTrial = true; G.dailyRace = null; G.raceCup = null; G.currentTrackIndex = 0; G.currentVariant = NS.defs.trackVariant(0, false); NS.raceSetup.resetGame();');
  t.check('a Time Trial races alone', await M.run('return G.opponents.length === 0;'));
  await M.run('G.countdown = 0; G.raceStarted = true; for (let i = 0; i < 300; ++i) { G.raceTime = i * 0.1; G.ship.x += 4; NS.replay.update(0.1); } G.raceTime = 30; NS.race.finishRace();');
  t.check('the run becomes the ghost of the track', await M.run('const g = NS.replay.ghostFor(G.currentVariant.key); return !!g && Math.abs(g.time - 30) < 0.01;'));
  await M.run('NS.raceSetup.resetGame(); G.countdown = 0; G.raceStarted = true; G.raceTime = 5; G.state = "PLAYING";');
  await t.wait(600);
  t.check('the next race on the track shows the ghost', await M.run('const p = NS.replay.ghostPose(); return !!p && p.x > 0;'));
  await t.shot('04-ghost');

  /* the race autosave: Continue puts the race back where it was */
  await M.run('G.timeTrial = false; NS.raceSetup.resetGame(); G.countdown = 0; G.raceStarted = true; G.raceTime = 42; G.playerLap = 1; G.ship.x += 300; NS.replay.saveRace(); G.state = "TITLE";');
  await t.wait(600);
  t.check('the title offers to continue the race', await M.run('return G.hitAreas.some(h => h.id === "continue-race");'));
  await t.shot('05-title-continue');
  const x = await M.run('return NS.replay.savedRace().ship.x;');
  await M.run('NS.replay.resumeRace();');
  t.check('Continue resumes the race with clock, lap and positions', await M.run('return G.state === "PLAYING" && G.raceStarted && Math.abs(G.raceTime - 42) < 0.5 && G.playerLap === 1 && Math.abs(G.ship.x - ' + x + ') < 20 && G.opponents.length === 3;'));
};
