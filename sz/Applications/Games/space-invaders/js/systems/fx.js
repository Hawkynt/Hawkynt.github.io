/* Cosmetic effects: particles, screen shake, floating text, flares, debris, rings, engine trails,
   the screen flash and the ship death spectacle. Owns those lists in G; reads G.player. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { PLAYER_W, PLAYER_H } = NS.constants;
  const { shipArtFor } = NS.data;
  const { currentShipId } = NS.progress;

  const { ParticleSystem, ScreenShake, FloatingText } = SZ.GameEffects;

  const particles = new ParticleSystem();
  const shake = new ScreenShake();
  const floatingText = new FloatingText();

  function addFlare(x, y, color, r, life) {
    G.flares.push({ x, y, color, r, t: 0, life });
    if (G.flares.length > 40)
      G.flares.splice(0, G.flares.length - 40);
  }

  function darkenColor(hex, f) {
    let h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    if (h.length === 3)
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    const r = Math.round(parseInt(h.slice(0, 2), 16) * f);
    const g = Math.round(parseInt(h.slice(2, 4), 16) * f);
    const b = Math.round(parseInt(h.slice(4, 6), 16) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function addDebris(x, y, count, colors) {
    for (let i = 0; i < count; ++i) {
      const ang = G.rand() * Math.PI * 2;
      const v = 1 + G.rand() * 3;
      G.debris.push({
        x, y,
        vx: Math.cos(ang) * v,
        vy: Math.sin(ang) * v - 1,
        rot: G.rand() * Math.PI * 2,
        vrot: (G.rand() - 0.5) * 0.3,
        life: 0.6,
        color: colors[Math.floor(G.rand() * colors.length)],
        size: 2 + G.rand() * 3,
      });
    }
    if (G.debris.length > 120)
      G.debris.splice(0, G.debris.length - 120);
  }

  function addRing(x, y, color, r0, maxR, life) {
    G.rings.push({ x, y, r: r0, r0, maxR, life, maxLife: life, color });
    if (G.rings.length > 24)
      G.rings.splice(0, G.rings.length - 24);
  }

  /* The ship's death spectacle, shared by bullet kills and the swarm reaching the row */
  function playerDeathFx() {
    const cx = G.player.x + PLAYER_W / 2, cy = G.player.y + PLAYER_H / 2;
    const shipColor = shipArtFor(currentShipId()).color;
    addFlare(cx, cy, 'white', 130, 0.5);
    addDebris(cx, cy, 30, [shipColor, darkenColor(shipColor, 0.5)]);
    addRing(cx, cy, '#ffffff', 10, 90, 0.4);
    addRing(cx, cy, '#5af2ff', 10, 150, 0.5);
    shake.trigger(10, 500);
    G.hitStop = 0.08;
    G.dyingSlow = 0.6;
  }

  /* Advance every cosmetic list; runs even while the simulation is frozen */
  function updateFx(dt) {
    for (let i = G.flares.length - 1; i >= 0; --i) {
      G.flares[i].t += dt / 1000;
      if (G.flares[i].t >= G.flares[i].life)
        G.flares.splice(i, 1);
    }
    for (let i = G.debris.length - 1; i >= 0; --i) {
      const d = G.debris[i];
      d.vy += 0.05;
      d.x += d.vx;
      d.y += d.vy;
      d.rot += d.vrot;
      d.life -= dt / 1000;
      if (d.life <= 0)
        G.debris.splice(i, 1);
    }
    for (let i = G.rings.length - 1; i >= 0; --i) {
      const r = G.rings[i];
      r.life -= dt / 1000;
      r.r = r.r0 + (r.maxR - r.r0) * (1 - r.life / r.maxLife);
      if (r.life <= 0)
        G.rings.splice(i, 1);
    }
    for (let i = G.trails.length - 1; i >= 0; --i) {
      const t = G.trails[i];
      t.y += t.vy;
      t.life -= dt / 1000;
      if (t.life <= 0)
        G.trails.splice(i, 1);
    }
    if (G.comboPop) {
      G.comboPop.t += dt / 1000;
      if (G.comboPop.t >= 0.5)
        G.comboPop = null;
    }
  }

  function triggerFlash(color, intensity) {
    G.screenFlashAlpha = intensity;
    G.screenFlashColor = color;
  }

  Object.assign(NS.fx, {
    particles, shake, floatingText, addFlare, darkenColor, addDebris, addRing, playerDeathFx, updateFx,
    triggerFlash
  });
})();
