/* The mage, his aura and staff glow, motes, the win trail, spell orbs, rings and spell strips, all
   in board space. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { PORTAL_ENTER_TIME, ORB_SIZE, ORB_GLOW_SIZE, ELEMENT_BY_ID, ROBES } = NS.consts;
  const { ctx, ui, Fx } = NS.context;
  const { colOf, rowOf } = NS.view;
  const { gemX, gemY } = NS.world;

  function drawHeroSprite() {
    if (G.hero.alpha <= 0)
      return;
    ctx.save();
    ctx.globalAlpha = G.hero.alpha;
    if (G.hero.scale !== 1) {
      ctx.translate(G.hero.x, G.hero.y);
      ctx.scale(G.hero.scale, G.hero.scale);
      ctx.translate(-G.hero.x, -G.hero.y);
    }
    /* the last spin before he vanishes into the portal */
    if (G.winSeq && G.winSeq.phase === 'enter') {
      const k = Math.min(1, G.winSeq.t / PORTAL_ENTER_TIME);
      ctx.translate(G.hero.x, G.hero.y);
      ctx.rotate(k * Math.PI * 3);
      ctx.translate(-G.hero.x, -G.hero.y);
    }
    if (G.blinkSquash > 0) {
      const s = 1 - 0.03 * (G.blinkSquash / 0.12);
      ctx.translate(G.hero.x, G.hero.y + 16);
      ctx.scale(1, s);
      ctx.translate(-G.hero.x, -(G.hero.y + 16));
    }
    const bob = G.hero.pose === 'idle' && !G.winSeq ? Math.sin(G.time * 2.2) * 1.5 : 0;
    SZ.PuzzleArt.drawHero(ctx, G.hero.x, G.hero.y + bob, G.hero.dir, G.hero.pose, G.hero.t, ROBES[G.save.robe] || ROBES.violet);
    ctx.restore();
  }

  /* under the mage: a soft contact shadow and a pool of the selected element's light */
  function drawElementAura() {
    if (G.hero.alpha <= 0)
      return;
    const el = ELEMENT_BY_ID[G.selectedElement];
    const pulse = 0.5 + 0.5 * Math.sin(G.time * 2.4);
    const s = G.hero.scale;
    ctx.save();
    ctx.globalAlpha = 0.55 * G.hero.alpha;
    ctx.drawImage(SZ.PuzzleBoard.softDot('#000000', 64), G.hero.x - 22 * s, G.hero.y + 8, 44 * s, 18 * s);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (0.22 + 0.1 * pulse) * G.hero.alpha;
    ctx.drawImage(SZ.PuzzleBoard.softDot(el.color, 64), G.hero.x - 40 * s, G.hero.y - 6, 80 * s, 40 * s);
    ctx.restore();
  }

  /* the staff gem burns in the selected element's colour, brighter while casting */
  function drawStaffGlow() {
    if (G.hero.alpha <= 0 || G.winSeq)
      return;
    const el = ELEMENT_BY_ID[G.pendingCast && G.pendingCast.phase === 'cast' ? G.pendingCast.action.element : G.selectedElement];
    const casting = G.hero.pose === 'cast';
    const side = G.hero.dir === 'left' || G.hero.dir === 'right';
    const gx = casting ? gemX() : G.hero.x + (G.hero.dir === 'left' ? -(side ? 12 : 17) : (side ? 12 : 17));
    const gy = casting ? gemY() : G.hero.y - 38 + Math.sin(G.time * 2.2) * 1.5;
    const k = casting ? 1.6 + 0.3 * Math.sin(G.time * 30) : 1 + 0.15 * Math.sin(G.time * 3.1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = casting ? 0.95 : 0.6;
    ctx.drawImage(Fx.sprite('glow', el.color), gx - 20 * k, gy - 20 * k, 40 * k, 40 * k);
    ctx.globalAlpha = casting ? 0.9 : 0.5;
    ctx.drawImage(Fx.sprite('spark', '#ffffff'), gx - 6 * k, gy - 6 * k, 12 * k, 12 * k);
    ctx.restore();
  }

  /* slow motes of the realm's glow drifting over the board */
  function drawMotes() {
    if (!G.motes.length)
      return;
    const glow = G.scene && G.scene.scene ? G.scene.scene.glow : '#ffffff';
    ctx.save();
    ctx.fillStyle = glow;
    for (const m of G.motes) {
      ctx.globalAlpha = 0.18 + 0.12 * Math.sin(G.time * 1.5 + m.phase);
      ctx.fillRect(m.x, m.y, m.size, m.size);
    }
    ctx.restore();
  }

  /* the golden trail of tiles the mage has walked on his way into the portal */
  function drawWinTrail() {
    if (!G.winSeq || !G.winSeq.trail || G.winSeq.trail.length < 2)
      return;
    ctx.save();
    ctx.fillStyle = '#ffd75a';
    for (let i = 0; i < G.winSeq.trail.length - 1; ++i) {
      const idx = G.winSeq.trail[i];
      ctx.globalAlpha = Math.max(0.12, 0.3 - (G.winSeq.trail.length - 1 - i) * 0.02);
      ctx.fillRect(colOf(idx) * 64 + 6, rowOf(idx) * 64 + 6, 52, 52);
    }
    ctx.restore();
  }

  /* the orb's halo, painted once per element colour */
  const orbGlowCache = {};
  function getOrbGlow(color) {
    let c = orbGlowCache[color];
    if (c)
      return c;
    const n = ORB_GLOW_SIZE * 2;
    c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    rg.addColorStop(0, ui.hexToRgba(color, 0.95));
    rg.addColorStop(0.3, ui.hexToRgba(color, 0.6));
    rg.addColorStop(0.65, ui.hexToRgba(color, 0.18));
    rg.addColorStop(1, ui.hexToRgba(color, 0));
    g.fillStyle = rg;
    g.fillRect(0, 0, n, n);
    orbGlowCache[color] = c;
    return c;
  }

  function drawProjectiles() {
    for (const pr of G.projectiles) {
      const k = Math.min(1, pr.t / pr.dur);
      const x = pr.x0 + (pr.x1 - pr.x0) * k, y = pr.y0 + (pr.y1 - pr.y0) * k;
      const pulse = 1 + 0.12 * Math.sin(pr.t * 60);
      const gs = ORB_GLOW_SIZE * pulse;
      ctx.save();
      ctx.drawImage(getOrbGlow(pr.color), x - gs / 2, y - gs / 2, gs, gs);
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(x, y, ORB_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(x, y, ORB_SIZE * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x - ORB_SIZE * 0.12, y - ORB_SIZE * 0.12, ORB_SIZE * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawRings() {
    for (const r of G.rings) {
      const k = r.t / r.dur;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lw * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSpells() {
    for (const s of G.spells)
      SZ.PuzzleScene.drawSpell(ctx, s.kind, s.x, s.y, s.t / s.dur, 64);
  }

  NS.actors = { drawHeroSprite, drawElementAura, drawStaffGlow, drawMotes, drawWinTrail, drawProjectiles,
    drawRings, drawSpells };
})();
