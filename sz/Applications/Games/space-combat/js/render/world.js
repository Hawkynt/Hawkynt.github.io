/* The play field in draw order, clipped to the field and culled: speed streaks, black holes,
   burning zones, the jump gate, pickups, mines, asteroids, allies, enemies, the boss, drones,
   the player, all shots and beams, effects, nebula fog and the solar flare band. World units
   via the camera. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, TAU, PF_W, PF_H } = NS.constants;
  const K = NS.artKit;
  const P = NS.propArt;
  const A = NS.actors;
  const { COLORS, POWERUPS } = NS.ships;
  const { SECTORS } = NS.campaign;
  const { ctx } = NS.view;

  /* the drawn part of the field in world coordinates */
  const wv = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const bossBeams = [];

  function inView(x, y, r) {
    return x + r > wv.x0 && x - r < wv.x1 && y + r > wv.y0 && y - r < wv.y1;
  }

  function lighter() {
    ctx.globalCompositeOperation = 'lighter';
  }

  function normal() {
    ctx.globalCompositeOperation = 'source-over';
  }

  function draw() {
    const cam = G.cam;
    const ox = VIEW_W / 2 - cam.x + cam.ox, oy = VIEW_H / 2 - cam.y + cam.oy;
    /* only the field is drawn; a little margin so big ships slide in from the edge */
    wv.x0 = -10; wv.y0 = -10; wv.x1 = PF_W + 10; wv.y1 = PF_H + 10;
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW_W / 2 - PF_W / 2, VIEW_H / 2 - PF_H / 2, PF_W, PF_H);
    ctx.clip();
    ctx.translate(ox, oy);
    NS.backdrop.drawDust(G.scroll.y);
    drawHoles();
    drawZones();
    drawGate();
    drawPickups();
    drawMines();
    drawRocks();
    A.drawAllies();
    A.drawEnemies(wv);
    A.drawBoss();
    A.drawDrones();
    A.drawPlayer();
    drawPlayerShots();
    drawEnemyShots();
    drawBeams();
    NS.fxRender.draw(wv);
    drawFog();
    drawFlare();
    ctx.restore();
  }

  /* the convoy's jump gate swings into view for the last stretch of an escort */
  function drawGate() {
    const g = G.stage && G.stage.rt && G.stage.rt.gate;
    if (!g) return;
    lighter();
    const pulse = 1 + Math.sin(G.time * 4) * 0.05;
    ctx.globalAlpha = 0.9;
    K.blit(ctx, K.ringSprite('#9ad8ff'), g.x, g.y, g.r / 26 * pulse);
    ctx.globalAlpha = 0.35;
    K.blit(ctx, K.glow('#9ad8ff'), g.x, g.y, g.r / 12);
    ctx.globalAlpha = 1;
    normal();
    ctx.strokeStyle = 'rgba(154,216,255,0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 10]);
    ctx.beginPath();
    ctx.arc(g.x, g.y, g.r * 1.15, G.time, G.time + TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawHoles() {
    for (let i = 0; i < G.holes.length; ++i) {
      const h = G.holes[i];
      const spr = P.blackHole(h.r);
      if (!inView(h.x, h.y, spr.hw)) continue;
      K.blitRot(ctx, spr, h.x, h.y, h.t * 0.15, 1);
      lighter();
      ctx.globalAlpha = 0.18;
      K.blitRot(ctx, spr, h.x, h.y, -h.t * 0.25 + 1, 0.8, 1);
      ctx.globalAlpha = 1;
      normal();
      if (h.pull) {
        ctx.strokeStyle = K.rgba('#6ad0ff', 0.12);
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 3; ++k) {
          const r = h.r * 2 + ((G.time * 60 + k * 120) % 360);
          ctx.beginPath();
          ctx.arc(h.x, h.y, r, 0, TAU);
          ctx.stroke();
        }
      }
    }
  }

  function drawZones() {
    if (!G.zones.length) return;
    lighter();
    for (let i = 0; i < G.zones.length; ++i) {
      const z = G.zones[i];
      if (!inView(z.x, z.y, z.r * 2)) continue;
      const k = 1 - z.t / z.life;
      ctx.globalAlpha = k * (z.kind === 'rift' ? 0.8 : 0.45);
      K.blit(ctx, K.glow(z.kind === 'rift' ? '#d9a8ff' : '#ff7a20'), z.x, z.y, z.r / 18);
    }
    ctx.globalAlpha = 1;
    normal();
  }

  function drawPickups() {
    const t = G.time;
    for (let i = 0; i < G.pickups.length; ++i) {
      const q = G.pickups[i];
      if (!inView(q.x, q.y, 60)) continue;
      const blink = q.life < 3 && Math.floor(t * 8) % 2 === 0;
      if (blink) continue;
      if (q.type === 'scrap') {
        K.blitRot(ctx, P.scrap(), q.x, q.y, q.spin, 0.9);
      } else if (q.type === 'core') {
        lighter();
        const pulse = (t * 0.8 + i * 0.3) % 1;
        ctx.globalAlpha = (1 - pulse) * 0.6;
        K.blit(ctx, K.ringSprite('#7affd0'), q.x, q.y, 0.4 + pulse * 1.2);
        ctx.globalAlpha = 0.5;
        K.blit(ctx, K.glow('#7affd0'), q.x, q.y, 1.4);
        ctx.globalAlpha = 1;
        normal();
        K.blitRot(ctx, P.dataCore(), q.x, q.y + Math.sin(t * 2 + i) * 3, Math.sin(t + i) * 0.3, 1);
        /* the download ring */
        ctx.strokeStyle = K.rgba('#7affd0', q.linked ? 0.5 : 0.18);
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 10]);
        ctx.beginPath();
        ctx.arc(q.x, q.y, NS.pickups.CORE_RANGE, t * 0.4, t * 0.4 + TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        if (q.progress > 0) {
          ctx.strokeStyle = '#7affd0';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(q.x, q.y, 34, -Math.PI / 2, -Math.PI / 2 + TAU * q.progress);
          ctx.stroke();
          if (q.linked) {
            const p = G.player;
            lighter();
            ctx.strokeStyle = K.rgba('#7affd0', 0.6);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(q.x, q.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            normal();
          }
        }
      } else {
        const bob = Math.sin(t * 3 + i) * 3;
        lighter();
        ctx.globalAlpha = 0.45;
        K.blit(ctx, K.glow(POWERUPS[q.type].color), q.x, q.y + bob, 1);
        ctx.globalAlpha = 1;
        normal();
        K.blit(ctx, P.capsule(q.type), q.x, q.y + bob, 1);
      }
    }
  }

  function drawMines() {
    const spr = P.mine(false);
    for (let i = 0; i < G.mines.length; ++i) {
      const m = G.mines[i];
      if (!inView(m.x, m.y, 40)) continue;
      K.blitRot(ctx, spr, m.x, m.y, m.t * 0.6, 1);
      const on = m.trig > 0 ? Math.floor(G.time * 16) % 2 === 0 : Math.floor(m.t * 1.5) % 2 === 0;
      if (on) {
        lighter();
        ctx.globalAlpha = m.trig > 0 ? 1 : 0.7;
        K.blit(ctx, K.glow('#ff3a3a'), m.x, m.y, m.trig > 0 ? 0.9 : 0.35);
        ctx.globalAlpha = 1;
        normal();
      }
      if (m.trig > 0) {
        ctx.strokeStyle = K.rgba('#ff3a3a', 0.35);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x, m.y, NS.hazards.MINE_BLAST * (1 - m.trig / 0.55), 0, TAU);
        ctx.stroke();
      }
    }
  }

  function drawRocks() {
    const tone = SECTORS[G.sector].id;
    for (let i = 0; i < G.rocks.length; ++i) {
      const r = G.rocks[i];
      if (!inView(r.x, r.y, r.r + 10)) continue;
      K.blitRot(ctx, P.rock(r.size, r.variant, tone), r.x, r.y, r.rot, 1);
      if (r.flash > 0) {
        lighter();
        ctx.globalAlpha = r.flash * 8;
        K.blit(ctx, K.glow('#ffe0b0'), r.x, r.y, r.r / 40);
        ctx.globalAlpha = 1;
        normal();
      }
    }
  }

  function drawPlayerShots() {
    const list = G.pBullets;
    if (!list.length) return;
    const missile = P.missile(false), pm = P.mine(true);
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      if (!inView(b.x, b.y, 30)) continue;
      if (b.kind === 'missile') K.blitRot(ctx, missile, b.x, b.y, b.ang, 1);
      else if (b.kind === 'pmine') {
        K.blitRot(ctx, pm, b.x, b.y, b.t, 0.8);
      }
    }
    lighter();
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      if (!inView(b.x, b.y, 30)) continue;
      const ramp = COLORS[b.color] || COLORS.cyan;
      if (b.kind === 'bolt') K.blitRot(ctx, K.bolt(b.color, ramp, 22, 5), b.x, b.y, b.ang, 1);
      else if (b.kind === 'frag') K.blitRot(ctx, K.bolt(b.color, ramp, 10, 3), b.x, b.y, b.ang, 1);
      else if (b.kind === 'flak') K.blit(ctx, K.orb(b.color, ramp, 7), b.x, b.y, 1);
      else if (b.kind === 'missile') {
        ctx.globalAlpha = 0.9;
        K.blit(ctx, K.glow('#ffb050'), b.x - Math.cos(b.ang) * 11, b.y - Math.sin(b.ang) * 11, 0.35);
        ctx.globalAlpha = 1;
      } else if (b.kind === 'pmine' && Math.floor(b.t * 4) % 2 === 0) {
        K.blit(ctx, K.glow('#58c8ff'), b.x, b.y, 0.4);
      }
    }
    normal();
  }

  function drawEnemyShots() {
    const list = G.eBullets;
    if (!list.length) return;
    const rocket = P.missile(true);
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      if (b.kind === 'rocket' && inView(b.x, b.y, 20)) K.blitRot(ctx, rocket, b.x, b.y, b.ang, 1);
    }
    lighter();
    for (let i = 0; i < list.length; ++i) {
      const b = list[i];
      if (!inView(b.x, b.y, 24)) continue;
      const ramp = COLORS[b.color] || COLORS.red;
      if (b.kind === 'bolt') K.blitRot(ctx, K.bolt('e' + b.color, ramp, 16, 4.5), b.x, b.y, Math.atan2(b.vy, b.vx), 1);
      else if (b.kind === 'orb') K.blit(ctx, K.orb(b.color, ramp, 9), b.x, b.y, 1 + Math.sin(b.t * 14) * 0.08);
      else if (b.kind === 'pellet') K.blit(ctx, K.orb(b.color, ramp, 5), b.x, b.y, 1);
      else if (b.kind === 'rocket') K.blit(ctx, K.glow('#ff6a3a'), b.x - Math.cos(b.ang) * 10, b.y - Math.sin(b.ang) * 10, 0.35);
    }
    normal();
  }

  /* a beam as three stacked strokes: wide dim glow, mid colour, white core */
  function beamLine(x0, y0, x1, y1, w, color, alpha) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = K.rgba(color, 0.22 * alpha);
    ctx.lineWidth = w * 3;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = K.rgba(color, 0.7 * alpha);
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.strokeStyle = K.rgba('#ffffff', 0.9 * alpha);
    ctx.lineWidth = Math.max(1, w * 0.35);
    ctx.stroke();
  }

  function drawBeams() {
    const p = G.player;
    lighter();
    if (p && p.alive && p.beamOn && p.beam) {
      const b = p.beam;
      const wob = 1 + Math.sin(G.time * 50) * 0.15;
      beamLine(b.x0, b.y0, b.x1, b.y1, 7 * wob, '#ff5ae0', 1);
      K.blit(ctx, K.glow('#ff9af0'), b.x0, b.y0, 0.6);
      if (b.hit) K.blit(ctx, K.glow('#ffffff'), b.x1, b.y1, 0.7 * wob);
    }
    for (let i = 0; i < G.rails.length; ++i) {
      const r = G.rails[i];
      const k = 1 - r.t / r.life;
      beamLine(r.x0, r.y0, r.x1, r.y1, 2 + k * 8, '#9ab8ff', k);
      /* a helix of sparks along the slug's path */
      ctx.strokeStyle = K.rgba('#d8e8ff', k * 0.6);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const dx = r.x1 - r.x0, dy = r.y1 - r.y0;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const n = Math.min(60, Math.floor(len / 18));
      for (let s = 0; s <= n; ++s) {
        const t = s / n;
        const w = Math.sin(t * len / 22 + r.t * 30) * 7 * k;
        const x = r.x0 + dx * t + nx * w, y = r.y0 + dy * t + ny * w;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < G.arcs.length; ++i) drawArc(G.arcs[i]);
    for (let i = 0; i < G.beams.length; ++i) {
      const b = G.beams[i];
      const k = 1 - b.t / b.life;
      beamLine(b.x0, b.y0, b.x1, b.y1, b.w * (0.6 + k), '#ff3a3a', k);
    }
    NS.bosses.beams(bossBeams);
    for (let i = 0; i < bossBeams.length; ++i) {
      const b = bossBeams[i];
      if (b.charge) {
        ctx.strokeStyle = K.rgba('#ffb040', 0.2 + b.k * 0.5);
        ctx.lineWidth = 1 + b.k * 4;
        ctx.setLineDash([18, 12]);
        ctx.beginPath();
        ctx.moveTo(b.x0, b.y0);
        ctx.lineTo(b.x1, b.y1);
        ctx.stroke();
        ctx.setLineDash([]);
        K.blit(ctx, K.glow('#ffd070'), b.x0, b.y0, 0.4 + b.k);
      } else {
        const wob = 1 + Math.sin(G.time * 40 + i) * 0.12;
        beamLine(b.x0, b.y0, b.x1, b.y1, 16 * wob, '#ffa030', 1);
        K.blit(ctx, K.glow('#fff0b0'), b.x0, b.y0, 1.2);
      }
    }
    normal();
  }

  /* jagged lightning, re-jittered every frame from its seed */
  function drawArc(a) {
    const k = 1 - a.t / a.life;
    const rng = NS.rng.makeRng(a.seed + Math.floor(G.time * 30));
    for (let pass = 0; pass < 2; ++pass) {
      ctx.strokeStyle = pass ? K.rgba('#ffffff', k) : K.rgba('#6a8aff', 0.6 * k);
      ctx.lineWidth = pass ? 1.5 : 5;
      ctx.beginPath();
      for (let i = 0; i < a.pts.length - 1; ++i) {
        const p0 = a.pts[i], p1 = a.pts[i + 1];
        const dx = p1.x - p0.x, dy = p1.y - p0.y;
        const n = 6;
        ctx.moveTo(p0.x, p0.y);
        for (let s = 1; s < n; ++s) {
          const j = (rng() - 0.5) * 26;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          ctx.lineTo(p0.x + dx * s / n - dy / len * j, p0.y + dy * s / n + dx / len * j);
        }
        ctx.lineTo(p1.x, p1.y);
      }
      ctx.stroke();
    }
  }

  /* nebula clouds hang over the battle; thinner around the player */
  function drawFog() {
    if (!G.nebulae.length) return;
    const theme = SECTORS[G.sector].theme;
    const p = G.player;
    for (let i = 0; i < G.nebulae.length; ++i) {
      const n = G.nebulae[i];
      if (!inView(n.x, n.y, n.r * 1.2)) continue;
      const spr = P.nebula(n.seed, Math.round(n.r), theme.neb);
      ctx.globalAlpha = p && p.inNebula && Math.abs(p.x - n.x) < n.r && Math.abs(p.y - n.y) < n.r ? 0.45 : 0.85;
      K.blitRot(ctx, spr, n.x, n.y, G.time * 0.01 + i, 4);
    }
    ctx.globalAlpha = 1;
  }

  /* the solar flare: a striped warning band that flashes faster, then a searing sheet of light */
  function drawFlare() {
    const f = G.flare;
    if (!f || !f.band || f.state === 'idle') return;
    const b = f.band;
    const horiz = b.axis === 'h';
    const x = horiz ? 0 : b.pos - b.half, y = horiz ? b.pos - b.half : 0;
    const w = horiz ? PF_W : b.half * 2, h = horiz ? b.half * 2 : PF_H;
    if (f.state === 'warn') {
      const k = 1 - f.t / NS.hazards.FLARE_WARN;
      const on = Math.floor(G.time * (4 + k * 14)) % 2 === 0;
      ctx.fillStyle = 'rgba(255,170,60,' + (0.06 + k * 0.12 + (on ? 0.08 : 0)) + ')';
      ctx.fillRect(x, y, w, h);
      /* hazard stripes along both edges */
      ctx.strokeStyle = 'rgba(255,190,90,' + (0.4 + (on ? 0.4 : 0)) + ')';
      ctx.lineWidth = 3;
      ctx.setLineDash([18, 12]);
      ctx.lineDashOffset = -G.time * 60;
      ctx.beginPath();
      if (horiz) { ctx.moveTo(0, y); ctx.lineTo(PF_W, y); ctx.moveTo(0, y + h); ctx.lineTo(PF_W, y + h); }
      else { ctx.moveTo(x, 0); ctx.lineTo(x, PF_H); ctx.moveTo(x + w, 0); ctx.lineTo(x + w, PF_H); }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      return;
    }
    lighter();
    const k = Math.max(0, f.t / NS.hazards.FLARE_BURN);
    const gr = horiz ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, 'rgba(255,140,40,0)');
    gr.addColorStop(0.3, 'rgba(255,200,120,' + 0.55 * k + ')');
    gr.addColorStop(0.5, 'rgba(255,255,230,' + 0.95 * k + ')');
    gr.addColorStop(0.7, 'rgba(255,200,120,' + 0.55 * k + ')');
    gr.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - (horiz ? 0 : 20), y - (horiz ? 20 : 0), w + (horiz ? 0 : 40), h + (horiz ? 40 : 0));
    normal();
  }

  Object.assign(NS.world, {
    draw, view: wv
  });
})();
