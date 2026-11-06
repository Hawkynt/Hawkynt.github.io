/* Draws the fleets under the camera transform, culled: gas and Bloom clouds (below the rocks),
   units with engine glow, rank chevrons, cargo, work beams and deserter glitches, invaders with
   shields, dormant and waking hives, the mothership tinted to its belt, every kind of shot
   (bolts, shells, flak, homing missiles, arcing artillery with its shadow, falling bombs), and
   the command overlay: selection rings, order paths with queued waypoints, patrol legs, order
   markers and the drag box. Reads only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU } = NS.constants;
  const K = NS.artKit;
  const FA = NS.fleetArt;
  const { ctx } = NS.view;
  const rect = NS.world.rect;
  const RED = ['#ffffff', '#ffb090', '#ff3a20'];
  const BLUE = ['#ffffff', '#bfe8ff', '#4fa8ff'];
  const TEAL = ['#ffffff', '#b0fff0', '#3affd0'];
  const pt = { x: 0, y: 0 };

  function inRect(x, y, m) {
    return x > rect.x0 - m && x < rect.x1 + m && y > rect.y0 - m && y < rect.y1 + m;
  }

  function drawClouds() {
    for (let i = 0; i < G.clouds.length; ++i) {
      const c = G.clouds[i];
      if (!inRect(c.x, c.y, c.r * 1.3)) continue;
      const sp = FA.cloud(c.res, c.bio, c.seed);
      const s = c.r * 2.4;
      ctx.globalAlpha = 0.85 + Math.sin(c.phase) * 0.15;
      ctx.translate(c.x, c.y);
      ctx.rotate(c.phase * 0.2);
      ctx.drawImage(sp.canvas, -s / 2, -s / 2, s, s);
      ctx.rotate(-c.phase * 0.2);
      ctx.translate(-c.x, -c.y);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (G.cam.zoom < 0.7) teamRings();
    drawUnits();
    drawEnemies();
    drawShots();
  }

  /* zoomed out, friend and foe need a mark: a ring under every ship in its side's colour */
  function teamRings() {
    const z = G.cam.zoom;
    ctx.lineWidth = 1.6 / z;
    const pass = (list, test, color) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (let i = 0; i < list.length; ++i) {
        const o = list[i];
        if (!o.alive || !test(o) || !inRect(o.x, o.y, 40)) continue;
        const r = o.r + 3 / z;
        ctx.moveTo(o.x + r, o.y);
        ctx.arc(o.x, o.y, r, 0, TAU);
      }
      ctx.stroke();
    };
    pass(G.units, (u) => u.side === 'player', 'rgba(92,255,154,0.55)');
    pass(G.units, (u) => u.side === 'rogue', 'rgba(58,255,208,0.7)');
    pass(G.enemies, (e) => !e.dormant && e.type !== 'hive', 'rgba(255,80,90,0.55)');
  }

  function drawUnits() {
    const lod = G.cam.zoom < 0.5;
    for (let i = 0; i < G.units.length; ++i) {
      const u = G.units[i];
      if (!u.alive || !inRect(u.x, u.y, 40)) continue;
      const rogue = u.side === 'rogue';
      if (!lod) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        K.blit(ctx, K.glow(rogue ? '#3affd0' : u.def.color), u.x - Math.cos(u.angle) * u.r, u.y - Math.sin(u.angle) * u.r, u.r / 26);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      let jx = 0;
      if (rogue || u.cor > 0.5) jx = Math.sin(G.time * 83 + u.id) > 0.8 ? 2 : 0;
      K.blitRot(ctx, FA.unit(u.type, rogue), u.x + jx, u.y, u.angle, lod ? 1.4 : 1, 1 - Math.abs(u.bank) * 0.15);
      if (u.flash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        K.blit(ctx, K.glow('#ffffff'), u.x, u.y, u.r / 24);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (u.beam) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = K.rgba(u.beam.color, 0.45);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.beam.x1, u.beam.y1); ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        K.blit(ctx, K.glow(u.beam.color), u.beam.x1, u.beam.y1, 0.35);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (u.load > 0 && u.ore) {
        ctx.fillStyle = NS.ores.ORE_BY_ID[u.ore].color;
        ctx.fillRect(u.x - 5, u.y + u.r + 3, Math.min(10, u.load * 1.6), 2);
      } else if (u.cargo) {
        ctx.fillStyle = '#ffd25a';
        ctx.fillRect(u.x - 6, u.y + u.r + 3, 12, 2);
      }
      if (u.rank > 0) chevrons(u.x - u.r - 4, u.y - u.r - 2, u.rank);
      const sel = u.sel || G.cmd.sel.indexOf(u) >= 0;
      if (u.hp < u.maxHp || sel) NS.baseRender.hpBar(u.x, u.y - u.r - 9, u.r * 2.2, u.hp / u.maxHp, rogue ? '#3affd0' : '#5cff9a');
      if (u.cor > 0.02 && !rogue) NS.baseRender.hpBar(u.x, u.y - u.r - 13, u.r * 2.2, u.cor, '#3affd0');
    }
  }

  function chevrons(x, y, n) {
    ctx.strokeStyle = '#ffd25a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < n; ++k) {
      ctx.moveTo(x - 3, y + k * 3.5);
      ctx.lineTo(x, y - 2.5 + k * 3.5);
      ctx.lineTo(x + 3, y + k * 3.5);
    }
    ctx.stroke();
  }

  function drawEnemies() {
    const tint = G.run && G.run.zone ? G.run.zone.theme.accent : null;
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      if (!e.alive || !inRect(e.x, e.y, e.r + 30)) continue;
      const d = e.def;
      if (e.type === 'nanoswarm') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        K.blit(ctx, K.glow('#3affd0'), e.x, e.y, 0.8);
        ctx.globalAlpha = 1;
        K.blitRot(ctx, FA.enemy('nanoswarm'), e.x, e.y, G.time * 2 + e.id, 1 + Math.sin(G.time * 6 + e.id) * 0.08);
        K.blitRot(ctx, FA.enemy('nanoswarm'), e.x, e.y, -G.time * 3 + e.id, 0.7);
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      if (e.type === 'hive') {
        const pulse = e.dormant ? 0.25 + Math.sin(G.time * 0.8 + e.id) * 0.1 : 0.6 + Math.sin(G.time * 5) * 0.25;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = pulse;
        K.blit(ctx, K.glow('#ff6ad0'), e.x, e.y, e.r / 14);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        K.blitRot(ctx, FA.enemy('hive'), e.x, e.y, e.angle + Math.sin(G.time * 0.3) * 0.05, 1 + (e.dormant ? 0 : Math.sin(G.time * 4) * 0.03));
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = d.boss ? 0.35 : 0.6;
        K.blit(ctx, K.glow(d.color), e.x - Math.cos(e.angle) * e.r, e.y - Math.sin(e.angle) * e.r, d.boss ? 1.6 : e.r / 26);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        K.blitRot(ctx, FA.enemy(e.type, d.boss ? tint : null), e.x, e.y, e.angle, 1, 1 - Math.abs(e.bank) * 0.12);
      }
      if (e.flash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = e.flash * (d.boss ? 1.5 : 8);
        K.blit(ctx, K.glow('#ffffff'), e.x, e.y, d.boss ? 1.4 : e.r / 22);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      if (e.maxShield > 0 && e.shield > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (e.shieldHit > 0 ? (d.boss ? 0.35 : 0.6) : 0.16) * (e.shield / e.maxShield);
        const rr = e.r * (d.boss ? 1.25 : 1.5);
        ctx.drawImage(K.ringSprite(d.faction === 'alien' ? '#e080ff' : '#58a8ff').canvas, e.x - rr, e.y - rr, rr * 2, rr * 2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      if (e.stun > 0 && Math.sin(G.time * 30) > 0) {
        ctx.strokeStyle = 'rgba(124,240,255,0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.2, 0, TAU); ctx.stroke();
      }
      if (e.hp < e.maxHp && !d.boss) NS.baseRender.hpBar(e.x, e.y - e.r - 10, Math.max(20, e.r * 1.6), e.hp / e.maxHp, '#ff5c6c');
    }
  }

  function drawShots() {
    if (!G.shots.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < G.shots.length; ++i) {
      const s = G.shots[i];
      if (s.delay > 0 || !inRect(s.x, s.y, 40)) continue;
      const enemy = s.side === 'enemy';
      switch (s.kind) {
        case 'bolt':
          K.blitRot(ctx, enemy ? K.bolt('red', RED, 16, 5) : K.bolt('blue', BLUE, 20, 4), s.x, s.y, s.angle, 1);
          break;
        case 'nanobolt':
          K.blitRot(ctx, K.bolt('teal', TEAL, 14, 4), s.x, s.y, s.angle, 1);
          break;
        case 'shell':
          K.blit(ctx, K.orb(enemy ? 'shellE' : 'shellP', enemy ? ['#ffffff', '#ffc080', '#ff5a20'] : ['#ffffff', '#ffe0a0', '#ffb44a'], 5), s.x, s.y, 1);
          break;
        case 'missile':
          K.blit(ctx, K.glow(enemy ? '#ff6a3a' : '#ffd0a0'), s.x, s.y, 0.4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
          break;
        case 'flak':
          K.blit(ctx, K.orb('flak', ['#ffffff', '#ffe8a0', '#ffb44a'], 3), s.x, s.y, 1);
          break;
        case 'artillery': {
          const k = Math.min(1, s.t / s.flight);
          const h = Math.sin(k * Math.PI) * Math.min(220, s.flight * 120);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          K.blit(ctx, K.orb('arty', ['#ffffff', '#ffb070', '#ff4a1a'], 6), s.x, s.y - h, 1 + h / 300);
          /* landing marker */
          ctx.strokeStyle = 'rgba(255,90,60,' + (0.3 + k * 0.4) + ')';
          ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(s.tx, s.ty, s.splash * (1.2 - k * 0.6), 0, TAU); ctx.stroke();
          break;
        }
        case 'bomb': {
          const k = Math.min(1, s.t / s.flight);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#2a2020';
          ctx.beginPath(); ctx.arc(s.x, s.y, 5 - k * 2, 0, TAU); ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          if (Math.sin(G.time * 30) > 0) K.blit(ctx, K.glow('#ff3a2a'), s.x, s.y, 0.25);
          break;
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* the command overlay: selection, order paths, markers, the drag box */
  function drawOverlay() {
    const c = G.cmd;
    const z = Math.max(0.35, G.cam.zoom);
    const sel = c.sel;
    ctx.lineWidth = 1.5 / z;
    for (let i = 0; i < sel.length; ++i) {
      const u = sel[i];
      if (!u.alive) continue;
      ctx.strokeStyle = '#5cff9a';
      ctx.beginPath();
      ctx.ellipse(u.x, u.y, u.r + 6, (u.r + 6) * 0.9, 0, 0, TAU);
      ctx.stroke();
      if (!u.orders || !u.orders.length) continue;
      ctx.strokeStyle = 'rgba(92,255,154,0.35)';
      ctx.setLineDash([6 / z, 6 / z]);
      ctx.beginPath();
      ctx.moveTo(u.x, u.y);
      for (let k = 0; k < u.orders.length && k < 6; ++k) {
        const o = u.orders[k];
        NS.orders.point(u, o, pt);
        ctx.lineTo(pt.x, pt.y);
        if (o.kind === 'patrol') {
          ctx.lineTo(o.ax, o.ay);
          ctx.lineTo(o.bx, o.by);
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
      for (let k = 0; k < u.orders.length && k < 6; ++k) {
        NS.orders.point(u, u.orders[k], pt);
        ctx.fillStyle = u.orders[k].kind === 'attack' || u.orders[k].kind === 'amove' ? 'rgba(255,92,108,0.7)' : 'rgba(92,255,154,0.6)';
        ctx.fillRect(pt.x - 2.5 / z, pt.y - 2.5 / z, 5 / z, 5 / z);
      }
    }
    for (let i = 0; i < c.marks.length; ++i) {
      const m = c.marks[i];
      const k = m.t / 0.8;
      ctx.strokeStyle = K.rgba(m.color, 1 - k);
      ctx.lineWidth = 2 / z;
      ctx.beginPath();
      ctx.arc(m.x, m.y, (10 + k * 30) / z, 0, TAU);
      ctx.stroke();
    }
    if (c.box) {
      const b = c.box;
      ctx.fillStyle = 'rgba(92,255,154,0.08)';
      ctx.strokeStyle = 'rgba(92,255,154,0.8)';
      ctx.lineWidth = 1 / z;
      ctx.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      ctx.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    }
  }

  Object.assign(NS.fleetRender, {
    drawClouds, draw, drawOverlay, chevrons
  });
})();
