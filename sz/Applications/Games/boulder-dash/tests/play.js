'use strict';
/* Plays one cave with the autopilot until it is won, the miner dies or the clock runs out. */
function playCave(NS, cv, timeLimit, opts) {
  opts = opts || {};
  cv.perks = cv.perks || NS.progression.perks(NS.progression.defaultSave());
  const C = NS.constants;
  let steps = 0, intent = { dir: -1, grab: false, bomb: false };
  const maxSteps = Math.round((timeLimit || 300) / C.STEP);
  let extra = 0;
  while (steps < maxSteps + extra) {
    const p = cv.player;
    if (cv.won) break;
    if (!p.alive && p.deadT > 0.5) break;
    if (p.moveT >= cv.playerPeriod - 1) intent = NS.bot.decide(cv);
    else intent = { dir: -1, grab: false, bomb: false };
    NS.sim.stepCave(cv, intent);
    if (cv.timeAdd) { extra += Math.round(cv.timeAdd / C.STEP); cv.timeAdd = 0; }
    cv.events.length = 0;
    ++steps;
  }
  return { won: cv.won, alive: cv.player.alive, seconds: steps * C.STEP, gems: cv.gems, required: cv.required };
}
module.exports = { playCave };
