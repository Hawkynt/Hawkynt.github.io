'use strict';

/* The guardians can be beaten: a bot steering with the look-ahead planner (which also sees the
   guardians' projectiles) plays every guardian stage through the real game loop - both chases
   end with the chaser crashing, all three duels end with the guardian's health at zero, each
   in its own direction (the avalanche downhill, the Warden up its spire, the King turned
   round) - and Boss Rush hands over through all five, turning on a cleared stretch whenever
   the next guardian runs another way. */
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

/* every turn Boss Rush adds: what is left on its stretch when it is added */
const added = [];
const addTurn = NS.stream.addTurn;
NS.stream.addTurn = function(run, dir, say) {
  const e = addTurn(run, dir, say);
  if (!e) return e;
  const c = run.course, v = e.len / NS.orient.TURN, a = run.p.x + 40, b = e.x + e.len + v * NS.orient.POST;
  const hz = c.hz.filter(h => !h.dead && h.x - (h.roll || 0) - (h.glide || 0) < b && h.x + Math.max(h.w, 60) > a).length;
  const pits = c.ground.filter(g => g.x > a && g.x < b).length;
  added.push({ dir: dir, left: hz + pits + c.pads.filter(q => q.x < b && q.x + q.w > a).length });
  return e;
};

for (const id of ['meadow-5', 'canyon-5', 'frost-5', 'neon-5', 'rift-5']) {
  const t0 = Date.now();
  const run = play(id, 240);
  const st = NS.worlds.stageById(id);
  const o = NS.orient.at(run.course.dirs, run.p.x);
  check(st.name + ' runs ' + NS.story.BOSS_DIRS[st.boss] + ' all the way', o.dir === NS.story.BOSS_DIRS[st.boss] && !o.turning && run.course.dirs.length === 1);
  check(st.name + ' beaten by the bot (' + Math.round(run.t) + ' s, ' + run.hits + ' hits, ' + (Date.now() - t0) + ' ms)', run.ended && run.finished && G.save.bosses[st.boss],
    'phase ' + run.phase + ' why ' + run.why + ' hp ' + (run.bs && run.bs.hp) + ' lead ' + (run.bs && Math.round(run.bs.lead)));
}
const rush = play('rush', 600);
check('Boss Rush cleared by the bot (' + Math.round(rush.t) + ' s)', rush.finished && rush.rushIdx === 4, 'idx ' + rush.rushIdx + ' why ' + rush.why);
check('Boss Rush turns down for Rime, up for the Warden and left for the King, each on a clear stretch',
  added.map(a => a.dir).join(',') === 'down,up,left' && added.every(a => a.left === 0), JSON.stringify(added));
done();
