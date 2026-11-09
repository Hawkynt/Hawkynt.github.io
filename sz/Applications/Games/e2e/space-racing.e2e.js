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
};
