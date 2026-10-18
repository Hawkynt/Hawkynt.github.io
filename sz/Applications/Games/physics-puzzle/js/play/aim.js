;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.PhysicsPuzzle || (SZ.PhysicsPuzzle = {});

  /*
   * Aiming: the slingshot drag, keyboard nudges within the level's barrel
   * arc, and the predicted flight (a parabola that bends off surfaces with
   * Ricochet Sight). Owns the guide buffer (x, y, hit triples); reads G.stats
   * and the pointer, writes G.run.aimAngle and G.run.aimPower.
   */

  const G = NS.G;
  const Ph = G.Ph, Parts = G.Parts, Sim = G.Sim;
  const DEG = NS.C.DEG, AIM_MAX_DRAG = NS.C.AIM_MAX_DRAG;

  function aimFromDrag(a) {
    /* slingshot: pull back from where the drag started */
    const dx = a.sx - G.mouseX, dy = a.sy - G.mouseY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 6)
      return;
    let ang = Math.atan2(-dy, dx) / DEG;
    const lim = G.run.level.aim || [Sim.ANGLE_MIN, Sim.ANGLE_MAX];
    if (ang < -90 && lim[1] > 90)
      ang += 360;
    G.run.aimAngle = Math.max(lim[0], Math.min(lim[1], ang));
    G.run.aimPower = Math.max(0.02, Math.min(1, len / AIM_MAX_DRAG));
  }

  function aimLimits() {
    return G.run.level.aim || [Sim.ANGLE_MIN, Sim.ANGLE_MAX];
  }

  function nudgeAim(da, dp) {
    const lim = aimLimits();
    G.run.aimAngle = Math.max(lim[0], Math.min(lim[1], G.run.aimAngle + da));
    G.run.aimPower = Math.max(0.02, Math.min(1, G.run.aimPower + dp));
  }

  /* predicted flight: a parabola, bending off surfaces with Ricochet Sight */
  const guide = [];
  function computeGuide() {
    const run = G.run;
    guide.length = 0;
    const L = run.level.launcher;
    const d = Sim.launcherDir(run.aimAngle);
    const sp = NS.shot.launchSpeed(run.aimPower);
    let x = L[0] + d[0] * Sim.MUZZLE, y = L[1] + d[1] * Sim.MUZZLE, vx = d[0] * sp, vy = d[1] * sp;
    const g = run.att.world.gy;
    const dt = 1 / 30;
    let bounces = G.stats.ricochet ? 3 : 0;
    const steps = Math.round(G.stats.sight / dt);
    for (let i = 0; i < steps; ++i) {
      const nx = x + vx * dt, ny = y + vy * dt + 0.5 * g * dt * dt;
      const dx = nx - x, dy = ny - y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      const hit = Ph.raycast(run.att.world, x, y, dx / len, dy / len, len, Parts.BALL_R);
      if (hit) {
        guide.push(hit.x, hit.y, 1);
        if (!bounces--)
          return;
        const vn = vx * hit.nx + vy * hit.ny;
        const e = 0.55;
        vx -= (1 + e) * vn * hit.nx;
        vy -= (1 + e) * vn * hit.ny;
        x = hit.x + hit.nx * 0.5;
        y = hit.y + hit.ny * 0.5;
        continue;
      }
      x = nx;
      y = ny;
      vy += g * dt;
      guide.push(x, y, 0);
    }
  }

  NS.aim = { aimFromDrag: aimFromDrag, nudgeAim: nudgeAim, computeGuide: computeGuide, guide: guide };
})();
