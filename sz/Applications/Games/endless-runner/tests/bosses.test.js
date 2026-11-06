'use strict';

/* The guardians can be beaten: a bot steering with the look-ahead planner (which also sees the
   guardians' projectiles) plays every guardian stage through the real game loop - both chases
   end with the chaser crashing, all three duels end with the guardian's health at zero - and
   Boss Rush hands over through all five. */
const H = require('./harness');
const env = H.installEnv();
global.requestAnimationFrame = () => 0;
const NS = H.load();
const { check, done } = H;
const G = NS.state;
NS.cine.end();
/* the bot plays instead of the keyboard */
NS.player.input = run => NS.autopilot.bits(run, NS.stream.get(run));

function play(stageOrMode, maxS) {
  if (stageOrMode === 'rush') NS.run.start('rush', {}); else NS.run.start('story', { stageId: stageOrMode });
  NS.autopilot.reset();
  const run = G.run;
  let hp = run.bs ? run.bs.maxHp : 0;
  for (let i = 0; i < maxS * 60 && !run.ended; ++i) {
    NS.sim.update(1 / 60);
    if (run.phase === 'revive') NS.run.over(run);
  }
  return run;
}

for (const id of ['meadow-5', 'canyon-5', 'frost-5', 'neon-5', 'rift-5']) {
  const t0 = Date.now();
  const run = play(id, 240);
  const st = NS.worlds.stageById(id);
  check(st.name + ' beaten by the bot (' + Math.round(run.t) + ' s, ' + run.hits + ' hits, ' + (Date.now() - t0) + ' ms)', run.ended && run.finished && G.save.bosses[st.boss],
    'phase ' + run.phase + ' why ' + run.why + ' hp ' + (run.bs && run.bs.hp) + ' lead ' + (run.bs && Math.round(run.bs.lead)));
}
const rush = play('rush', 600);
check('Boss Rush cleared by the bot (' + Math.round(rush.t) + ' s)', rush.finished && rush.rushIdx === 4, 'idx ' + rush.rushIdx + ' why ' + rush.why);
done();
