/* One fixed simulation step in order: effects and timers always; while playing (unless hit-stop
   holds the frame) input sampling, player, bombs and fire, enemies, boss, pickups, the damage
   pass (fire on the player and enemies, enemy contact) and the run objective; the Zen ambience;
   cinematics advance on their own screen. Owns nothing. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { COLS } = C;
  const A = NS.arena;

  const ZEN_NOTES = [1, 1.125, 1.25, 1.5, 1.6875, 2];
  let zenT = 2;

  function update(dt) {
    G.time += dt;
    G.screenT += dt;
    NS.fx.update(dt);
    NS.tracker.tick(dt);
    if (G.ui.treeFlash > 0) G.ui.treeFlash -= dt;
    NS.screens.tickToasts(dt);
    if (G.screen === 'cine') { NS.cine.update(dt); return; }
    if (G.screen !== 'playing' || !G.run) return;
    if (G.hitStop > 0) {
      G.hitStop -= dt;
      return;
    }
    const run = G.run;
    NS.input.sample();
    NS.player.update(dt);
    NS.bombs.update(dt);
    A.rebuild();
    NS.enemies.update(dt);
    A.rebuild();
    NS.bosses.update(dt);
    NS.items.update(dt);
    damage();
    NS.run.update(dt);
    if (run.mode === 'zen') zenAmbience(dt);
    seasonal(dt);
  }

  /* Fire burns the player and enemies; touching an awake enemy hurts */
  function damage() {
    const run = G.run, p = run.player;
    const f = run.fire;
    if (!p.dead) {
      const i = A.idx(Math.round(p.x), Math.round(p.y));
      if (f[i] > 0) NS.player.hurt('fire');
    }
    const es = run.enemies;
    for (let k = es.length - 1; k >= 0; --k) {
      const e = es[k];
      if (!e) continue;
      const i = A.idx(Math.round(e.x), Math.round(e.y));
      if (f[i] > 0) {
        const grp = run.fireG[i];
        const g = run.groups.find(x => x.id === grp);
        NS.enemies.damage(e, grp, !!g && g.owner === 'p' || run.fireO[i] === 0);
        continue;
      }
      if (p.dead || e.spawnT > 0 || e.harmless || run.freezeT > 0) continue;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy < 0.4) NS.player.hurt('enemy');
    }
  }

  /* Soft pentatonic notes at low volume while gardening */
  function zenAmbience(dt) {
    zenT -= dt;
    if (zenT > 0) return;
    zenT = 1.4 + Math.random() * 2.2;
    const n = ZEN_NOTES[(Math.random() * ZEN_NOTES.length) | 0] * (Math.random() < 0.3 ? 0.5 : 1);
    if (SZ.GameAudio) SZ.GameAudio.play(Math.random() < 0.5 ? 'blip' : 'select', { pitch: n * 0.8, volume: 0.07 });
  }

  /* Seasonal tokens sometimes float in while playing */
  function seasonal(dt) {
    const run = G.run;
    if (run.phase !== 'play' || Math.random() > dt / 25) return;
    const g = run.level.grid;
    for (let tries = 0; tries < 8; ++tries) {
      const i = (Math.random() * g.length) | 0;
      if (g[i] === C.T_EMPTY && !run.pickups.some(pk => pk.i === i)) {
        NS.items.spawn('token', i, 0.5);
        NS.fx.sparkle(i % COLS, (i / COLS) | 0, G.season.def.color, 10);
        return;
      }
    }
  }

  Object.assign(NS.sim, {
    update, damage
  });
})();
