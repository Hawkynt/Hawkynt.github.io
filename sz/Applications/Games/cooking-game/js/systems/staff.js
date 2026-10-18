;(function() {
  'use strict';

  /* The chef walking to the station last touched and the hired waiter
     carrying finished dishes. Owns the chef and waiter fields of G. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { CHEF_Y, WAITER_DELAY, WAITER_HOME } = NS.C;
  const { fx, sfx } = NS.juice;
  const { treeLevel } = NS.persist;
  const { passCapacity, passX } = NS.rules;
  const { serveTarget, serveTo } = NS.serving;

  /* ── the chef walks to the station last touched ── */
  function updateChef(dt) {
    const d = G.chefTargetX - G.chefX;
    if (Math.abs(d) > 4) {
      G.chefX += Math.sign(d) * Math.min(Math.abs(d), 420 * dt);
      G.chefFacing = Math.sign(d);
      if (Math.random() < dt * 6) fx.emit('steam', G.chefX - G.chefFacing * 14, CHEF_Y - 2, 1, { color: '#e8dccc', speed: 8, scale: 0.45, alpha: 0.3 });
    } else G.chefFacing = -1;
    if (G.chefTimer > 0) {
      G.chefTimer -= dt;
      if (G.chefTimer <= 0) G.chefPose = 'idle';
    }
  }

  /* ── the hired waiter: a finished dish that matches a waiting guest is
     carried over automatically, a beat after it lands on the pass ── */
  function updateWaiter(dt) {
    if (treeLevel('v_waiter') <= 0) return;
    if (!G.waiter) {
      let idx = -1, target = null;
      for (let i = 0; i < G.pass.length; ++i) {
        const c = serveTarget(G.pass[i]);
        if (c) { idx = i; target = c; break; }
      }
      if (idx < 0) { G.waiterTimer = WAITER_DELAY; return; }
      G.waiterTimer -= dt;
      if (G.waiterTimer > 0) return;
      G.waiterTimer = WAITER_DELAY;
      const dish = G.pass.splice(idx, 1)[0];
      G.waiter = { x: passX(idx), facing: 1, state: 'toGuest', target, dish };
      sfx('whoosh', { pitch: 1.3, volume: 0.3 });
      return;
    }
    const goal = G.waiter.state === 'toGuest' ? G.waiter.target.x : WAITER_HOME;
    const dir = Math.sign(goal - G.waiter.x) || G.waiter.facing;
    G.waiter.facing = dir;
    G.waiter.x += dir * 220 * dt;
    if (G.waiter.state === 'toGuest') {
      if (Math.abs(G.waiter.target.x - G.waiter.x) < 12) {
        const c = G.waiter.target;
        if (c.state === 'waiting')
          serveTo({ recipe: G.waiter.dish.recipe, quality: G.waiter.dish.quality, ticket: G.waiter.dish.ticket }, c);
        else if (G.pass.length < passCapacity())
          G.pass.push(G.waiter.dish);
        G.waiter.state = 'back';
      }
    } else if (Math.abs(G.waiter.x - WAITER_HOME) < 8) {
      G.waiter = null;
    }
  }

  NS.staff = { updateChef, updateWaiter };

})();
