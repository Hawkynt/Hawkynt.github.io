/* A player bot over the real engine: pops trapped bubbles first (climbing toward them), else
   hunts the nearest enemy - walking along its row, jumping up through platforms when the target
   is higher, dropping down when it is lower - blows bubbles when an enemy is ahead on its level,
   hops away from foes that come too close and fights guardians by blowing bubbles and popping
   lightning bubbles. It plays the title demo, steers Pop in co-op and shows in the tests that
   rooms and guardians can be cleared. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const E = NS.engine;
  const { TILE, ROWS } = C;

  function platformAbove(g, x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor((y - 1) / TILE);
    for (let dy = 1; dy <= 3; ++dy) if (ty - dy > 0 && E.solidTile(g, tx, ty - dy) && tx > 0 && tx < C.COLS - 1) return true;
    return false;
  }

  /* -> input for one step; mem keeps the bot's small memory between steps; who: the newt to
     steer (Fizz by default, Pop in co-op) */
  function input(g, mem, who) {
    mem = mem || {};
    const p = who || g.player;
    const inp = { left: false, right: false, jump: false, shoot: false };
    if (p.dead) return inp;
    mem.t = (mem.t || 0) + C.STEP;
    let tx = null, ty = null, popping = false;
    const trap = g.bubbles.filter(b => b.trap || (b.elem && (b.elem !== 'fire' || !g.boss))).sort((a, b) => Math.abs(a.x - p.x) + Math.abs(a.y - p.y) - Math.abs(b.x - p.x) - Math.abs(b.y - p.y))[0];
    let foe = null, fd = Infinity;
    for (const e of g.enemies) { const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 1.5; if (d < fd) { fd = d; foe = e; } }
    if (g.boss) foe = foe || { x: g.boss.x, y: g.boss.y + 20 };
    if (trap && (!foe || Math.abs(trap.x - p.x) + Math.abs(trap.y - p.y) < fd * 1.5)) { tx = trap.x; ty = trap.y + 20; popping = true; }
    else if (foe) { tx = foe.x; ty = foe.y; }
    else {
      const it = g.items[0];
      if (it) { tx = it.x; ty = it.y; }
    }
    if (tx == null) return inp;
    const dx = tx - p.x, dy = ty - p.y;
    if (popping || Math.abs(dy) > 20 || Math.abs(dx) > C.BUBBLE_RANGE * (p.range ? 2 : 1) * 0.9) {
      if (Math.abs(dx) > 6) { inp.right = dx > 0; inp.left = dx < 0; }
    } else {
      inp.left = dx < 0 && p.face > 0;
      inp.right = dx > 0 && p.face < 0;
      if (Math.abs(dx) < 50) { inp.left = dx > 0; inp.right = dx < 0; }
    }
    /* stuck walking into a wall for a while: try the other way */
    if (Math.abs(p.x - (mem.lx || 0)) < 0.5 && (inp.left || inp.right)) mem.stuck = (mem.stuck || 0) + C.STEP; else mem.stuck = 0;
    mem.lx = p.x;
    if (mem.stuck > 0.6) { mem.flip = 0.8; mem.stuck = 0; }
    if (mem.flip > 0) { mem.flip -= C.STEP; const l = inp.left; inp.left = inp.right || (!l && !inp.right); inp.right = l; inp.jump = true; }
    if (p.ground && dy < -TILE * 0.8 && (platformAbove(g, p.x, p.y) || popping || Math.abs(dx) < TILE * 3)) inp.jump = true;
    if (p.ground && mem.t % 3 < C.STEP * 2 && dy < -TILE) inp.jump = true;
    const ahead = g.enemies.some(e => Math.abs(e.y - p.y) < 22 && Math.sign(e.x - p.x) === p.face && Math.abs(e.x - p.x) < C.BUBBLE_RANGE * (p.range ? 2 : 1) + 30);
    if (ahead || (g.boss && Math.abs(g.boss.y - (p.y - 12)) < 60 && Math.sign(g.boss.x - p.x) === p.face)) inp.shoot = true;
    const close = g.enemies.some(e => Math.abs(e.x - p.x) < 40 && Math.abs(e.y - p.y) < 30);
    if (close && p.ground) { inp.jump = true; inp.shoot = true; }
    if (g.shade && Math.hypot(g.shade.x - p.x, g.shade.y - p.y) < 90) { inp.left = g.shade.x > p.x; inp.right = !inp.left; inp.jump = true; }
    return inp;
  }

  Object.assign(NS.bot, { platformAbove, input });
})();
