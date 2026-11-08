/* Draws a trip's world under the camera transform, culled to the visible rectangle: radiation
   haze, gas and Bloom clouds, gravity wells, the dock, the outpost, dust, rocks (body, ore
   veins, cracks, then one additive pass for vein glow, living-rock spores and laser heat;
   cheaper when zoomed out), wrecks, nuggets with tractor beams, drones, charges, pirates,
   units, invaders and shots, bolts, the ship with engine glow, shield and banking, laser beams,
   shield domes, pods and placement, effects, the command overlay, the scanner pulse, and the
   storm over everything. Reads only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, TAU, ROCK_RADII, FONT } = NS.constants;
  const { ORE_BY_ID } = NS.ores;
  const K = NS.artKit;
  const RA = NS.rockArt;
  const PA = NS.propArt;
  const SA = NS.shipArt;
  const { ctx } = NS.view;

  const rect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const shown = [];
  const RED = ['#ffffff', '#ffb090', '#ff3a20'];
  const BLUE = ['#ffffff', '#bfe8ff', '#4fa8ff'];
  let budget = { rocks: 0 };

  function inRect(x, y, m) {
    return x > rect.x0 - m && x < rect.x1 + m && y > rect.y0 - m && y < rect.y1 + m;
  }

  function begin() {
    const cam = G.cam;
    ctx.translate(VIEW_W / 2 + cam.ox, VIEW_H / 2 + cam.oy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);
  }

  function end() {
    const cam = G.cam;
    ctx.translate(cam.x, cam.y);
    ctx.scale(1 / cam.zoom, 1 / cam.zoom);
    ctx.translate(-(VIEW_W / 2 + cam.ox), -(VIEW_H / 2 + cam.oy));
  }

  function draw() {
    const run = G.run;
    if (!run) return;
    NS.camera.worldRect(rect, 0);
    const s = G.ship;
    NS.backdrop.draw(G.cam.x, G.cam.y, 0.3, true);
    begin();
    drawHazards();
    NS.fleetRender.drawClouds();
    drawDock();
    NS.baseRender.draw();
    NS.backdrop.drawDust(rect, s ? s.vx : 0, s ? s.vy : 0);
    drawRocks();
    drawWrecks();
    drawNuggets(s);
    drawDrones();
    drawCharges();
    drawPirates();
    NS.fleetRender.draw();
    drawBolts();
    if (s && s.alive && !s.hidden) drawShip(s);
    drawBeams();
    NS.baseRender.drawTop();
    NS.fxRender.draw(rect);
    if (G.cmd.on || G.cmd.sel.length) NS.fleetRender.drawOverlay();
    drawPulse();
    end();
    drawStorm();
  }

  function drawHazards() {
    for (let i = 0; i < G.radZones.length; ++i) {
      const z = G.radZones[i];
      if (!inRect(z.x, z.y, z.r * 1.2)) continue;
      const cl = PA.radCloud(z.seed);
      ctx.globalAlpha = 0.85 + Math.sin(G.time * 1.3 + z.phase) * 0.15;
      ctx.drawImage(cl.canvas, z.x - z.r * 1.05, z.y - z.r * 1.05, z.r * 2.1, z.r * 2.1);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < G.wells.length; ++i) {
      const w = G.wells[i];
      if (!inRect(w.x, w.y, w.r)) continue;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25;
      K.blit(ctx, K.glow('#ff7a4a'), w.x, w.y, w.r / 22);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, PA.well(), w.x, w.y, w.rot, 1.6);
      ctx.strokeStyle = K.rgba('#ffb070', 0.18);
      ctx.lineWidth = 2;
      ctx.setLineDash([16, 14]);
      ctx.lineDashOffset = -G.time * 20 * w.spin;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawDock() {
    const d = G.dock;
    if (!inRect(d.x, d.y, 220)) return;
    K.blitRot(ctx, PA.dock(), d.x, d.y, d.angle, 1);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; ++i) {
      const a = d.angle + i * TAU / 8;
      const on = ((G.time * 4 + i) | 0) % 8 === i ? 1 : 0.3;
      ctx.globalAlpha = on;
      K.blit(ctx, K.glow(i % 2 ? '#ffb44a' : '#4fd8ff'), d.x + Math.cos(a) * 112, d.y + Math.sin(a) * 112, 0.3);
    }
    /* landing guide while the hold has ore */
    if (G.run.cargoUsed > 0 && G.run.leftDock) {
      ctx.globalAlpha = 0.4 + Math.sin(G.time * 5) * 0.25;
      ctx.drawImage(K.ringSprite('#ffd25a').canvas, d.x - 120, d.y - 120, 240, 240);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function crackStage(r) {
    const k = r.hp / r.maxHp;
    return k > 0.75 ? 0 : k > 0.5 ? 1 : k > 0.25 ? 2 : 3;
  }

  function drawRocks() {
    shown.length = 0;
    const lod = G.cam.zoom < 0.5;
    const pal = G.run.zone.theme.rock;
    const rocks = G.rocks;
    for (let i = 0; i < rocks.length; ++i) {
      const r = rocks[i];
      if (!r.alive || !inRect(r.x, r.y, r.r + 4)) continue;
      shown.push(r);
      ctx.globalAlpha = r.fade;
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      if (r.kind === 'crown') {
        const sp = RA.crown();
        ctx.drawImage(sp.canvas, -sp.hw, -sp.hh, sp.w, sp.h);
      } else if (r.kind === 'geode') {
        const sp = RA.geode(r.ore);
        ctx.drawImage(sp.canvas, -sp.hw, -sp.hh, sp.w, sp.h);
        const st = crackStage(r);
        if (st) {
          const c = RA.cracks(4, 2, st);
          ctx.drawImage(c.canvas, -c.hw, -c.hh, c.w, c.h);
        }
      } else {
        const k = r.r / ROCK_RADII[r.tier];
        const b = RA.body(r.tier, r.variant, pal);
        const w = b.w * k, h = b.h * k;
        ctx.drawImage(b.canvas, -w / 2, -h / 2, w, h);
        if (r.ore || r.volatile) {
          const v = RA.veins(r.tier, r.variant, r.volatile ? 'volatile' : r.ore);
          ctx.drawImage(v.canvas, -w / 2, -h / 2, w, h);
        }
        const st = lod ? 0 : crackStage(r);
        if (st) {
          const c = RA.cracks(r.tier, r.variant, st);
          ctx.drawImage(c.canvas, -w / 2, -h / 2, w, h);
        }
      }
      ctx.rotate(-r.rot);
      ctx.translate(-r.x, -r.y);
    }
    ctx.globalAlpha = 1;
    budget.rocks = shown.length;
    /* one additive pass: vein glow, volatile pulse, laser heat */
    ctx.globalCompositeOperation = 'lighter';
    const t = G.time;
    for (let i = 0; i < shown.length; ++i) {
      const r = shown[i];
      if (lod && r.tier < 3 && r.kind === 'rock') continue;
      if (r.bio) {
        ctx.globalAlpha = (0.35 + Math.sin(t * 1.4 + r.id) * 0.15) * r.fade;
        K.blit(ctx, K.glow(r.bio === 'crystal' ? '#c070ff' : '#7ae04a'), r.x + Math.cos(r.id) * r.r * 0.3, r.y + Math.sin(r.id) * r.r * 0.3, r.r / 24);
      }
      if (r.kind === 'crown') {
        ctx.globalAlpha = 0.55 + Math.sin(t * 1.7) * 0.2;
        K.blit(ctx, K.glow('#c88aff'), r.x, r.y, 7);
      } else if (r.ore || r.volatile) {
        const pulse = r.volatile ? (r.fuse > 0 ? 0.6 + Math.sin(t * 30) * 0.4 : 0.45 + Math.sin(t * 3 + r.id) * 0.25)
          : (0.35 + Math.sin(t * 2 + r.id) * 0.15) * (0.6 + ORE_BY_ID[r.ore].rarity * 0.15) + r.heat * 0.4;
        if (r.kind === 'rock') {
          const k = r.r / ROCK_RADII[r.tier];
          const g = RA.veinGlow(r.tier, r.variant, r.volatile ? 'volatile' : r.ore);
          ctx.globalAlpha = Math.min(1, pulse) * r.fade;
          ctx.translate(r.x, r.y);
          ctx.rotate(r.rot);
          ctx.drawImage(g.canvas, -g.w * k / 2, -g.h * k / 2, g.w * k, g.h * k);
          ctx.rotate(-r.rot);
          ctx.translate(-r.x, -r.y);
        } else {
          ctx.globalAlpha = 0.5 + Math.sin(t * 2.2) * 0.2;
          K.blit(ctx, K.glow(ORE_BY_ID[r.ore].color), r.x, r.y, 3.4);
        }
      }
      if (r.heat > 0.02) {
        ctx.globalAlpha = Math.min(1, r.heat);
        K.blit(ctx, K.glow('#ff9a40'), r.hitX, r.hitY, 0.5 + r.heat * 0.9);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (!lod) drawScanTags();
  }

  /* scanned rocks show their ore for a while; the Scanner Array shows it always nearby */
  function drawScanTags() {
    const s = G.ship;
    const always = G.stats.scanner >= 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < shown.length; ++i) {
      const r = shown[i];
      if (!r.ore || r.kind !== 'rock' || r.tier < 2) continue;
      const age = G.time - r.scanT;
      const near = always && s && Math.abs(r.x - s.x) + Math.abs(r.y - s.y) < 520;
      if (age > 8 && !near) continue;
      const ore = ORE_BY_ID[r.ore];
      const a = age <= 8 ? Math.min(1, (8 - age) / 2) : 0.7;
      ctx.globalAlpha = a;
      ctx.font = 'bold ' + (11 + r.tier) + 'px ' + FONT;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      const label = ore.sym + (r.rich > 0.8 ? ' ++' : r.rich > 0.6 ? ' +' : '');
      ctx.strokeText(label, r.x, r.y - r.r - 10);
      ctx.fillStyle = ore.glow;
      ctx.fillText(label, r.x, r.y - r.r - 10);
    }
    ctx.globalAlpha = 1;
  }

  function hpBar(x, y, w, k, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, k), 4);
  }

  function drawWrecks() {
    for (let i = 0; i < G.specials.length; ++i) {
      const o = G.specials[i];
      if (!o.alive || !inRect(o.x, o.y, 140)) continue;
      K.blitRot(ctx, PA.derelict(o.variant), o.x, o.y, o.angle, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.sin(G.time * 2.6) > 0.7 ? 0.9 : 0.15;
      K.blit(ctx, K.glow('#ff4a4a'), o.x + Math.cos(o.angle) * 70, o.y + Math.sin(o.angle) * 70, 0.35);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (o.hp < o.maxHp) hpBar(o.x, o.y - 70, 90, o.hp / o.maxHp, '#ffd25a');
    }
  }

  function drawNuggets(s) {
    const list = G.nuggets;
    /* tractor beams first, one path */
    if (s && G.run.pulled) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = K.rgba('#7ae8ff', 0.22 + Math.sin(G.time * 12) * 0.06);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < list.length; ++i) {
        const n = list[i];
        if (!n.pulled) continue;
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo((s.x + n.x) / 2 + Math.sin(G.time * 6 + i) * 12, (s.y + n.y) / 2, n.x, n.y);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < list.length; ++i) {
      const n = list[i];
      if (!inRect(n.x, n.y, 20)) continue;
      const col = n.credits ? '#ffd25a' : ORE_BY_ID[n.ore].color;
      ctx.globalAlpha = (0.45 + Math.sin(G.time * 5 + i) * 0.2) * Math.min(1, n.life / 3);
      K.blit(ctx, K.glow(col), n.x, n.y, n.units > 1 ? 0.8 : 0.55);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < list.length; ++i) {
      const n = list[i];
      if (!inRect(n.x, n.y, 20)) continue;
      ctx.globalAlpha = Math.min(1, n.life / 3);
      K.blitRot(ctx, n.credits ? RA.salvage() : RA.nugget(n.ore, n.variant), n.x, n.y, n.rot, n.units > 1 ? 1.3 : 0.95);
    }
    ctx.globalAlpha = 1;
  }

  function drawDrones() {
    const sp = SA.drone();
    for (let i = 0; i < G.drones.length; ++i) {
      const d = G.drones[i];
      if (!d.alive || !inRect(d.x, d.y, 30)) continue;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      K.blit(ctx, K.glow('#5cff9a'), d.x, d.y, 0.45);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, sp, d.x, d.y + Math.sin(d.hover * 3) * 1.5, d.angle, d.state === 'docked' ? 0.7 : 1);
      if (d.load > 0 && d.ore) {
        ctx.fillStyle = ORE_BY_ID[d.ore].color;
        ctx.fillRect(d.x - 4, d.y + 10, Math.min(8, d.load * 2), 2);
      }
    }
  }

  function drawCharges() {
    for (let i = 0; i < G.charges.length; ++i) {
      const c = G.charges[i];
      K.blitRot(ctx, PA.charge(), c.x, c.y, G.time * 4, 1);
      if (Math.sin(G.time * (20 - c.t * 8)) > 0) {
        ctx.globalCompositeOperation = 'lighter';
        K.blit(ctx, K.glow('#ff3a2a'), c.x, c.y, 0.5);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.strokeStyle = K.rgba('#ffb44a', 0.3);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 240 * (1 - c.t / 1.6) + 10, 0, TAU);
      ctx.stroke();
    }
  }

  function drawPirates() {
    for (let i = 0; i < G.pirates.length; ++i) {
      const p = G.pirates[i];
      if (!p.alive || !inRect(p.x, p.y, 60)) continue;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7;
      K.blit(ctx, K.glow('#ff5a3a'), p.x - Math.cos(p.angle) * p.r, p.y - Math.sin(p.angle) * p.r, p.r / 30);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, PA.pirate(p.kind), p.x, p.y, p.angle, 1, 1 - Math.abs(p.bank) * 0.15);
      if (p.hitFlash > 0) {
        ctx.globalAlpha = 0.8;
        K.blitRot(ctx, K.silhouette('pirate:' + p.kind, PA.pirate(p.kind)), p.x, p.y, p.angle, 1);
        ctx.globalAlpha = 1;
      }
      if (p.hp < p.maxHp) hpBar(p.x, p.y - p.r - 12, p.r * 1.6, p.hp / p.maxHp, '#ff5c6c');
      if (p.stolen) {
        ctx.fillStyle = ORE_BY_ID[p.stolen.ore].glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y + p.r + 6, 3, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawBolts() {
    if (!G.bolts.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < G.bolts.length; ++i) {
      const b = G.bolts[i];
      if (!inRect(b.x, b.y, 30)) continue;
      K.blitRot(ctx, b.friendly ? K.bolt('blue', BLUE, 20, 4) : K.bolt('red', RED, 16, 5), b.x, b.y, b.angle, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawShip(s) {
    const st = G.stats;
    const id = st.hullId;
    const ca = Math.cos(s.angle), sa = Math.sin(s.angle);
    /* engine glow at each nozzle */
    ctx.globalCompositeOperation = 'lighter';
    const noz = SA.nozzles(id);
    const glowC = s.boosting ? '#bfe8ff' : st.colors.glow;
    for (let i = 0; i < noz.length; ++i) {
      const nx = s.x + ca * noz[i][0] - sa * noz[i][1], ny = s.y + sa * noz[i][0] + ca * noz[i][1];
      ctx.globalAlpha = 0.35 + s.thrust * 0.5;
      K.blit(ctx, K.glow(glowC), nx - ca * 4, ny - sa * 4, 0.5 + s.thrust * 0.9 + Math.sin(G.time * 40) * 0.05);
      if (s.thrust > 0.1) {
        ctx.globalAlpha = Math.min(1, s.thrust);
        K.blitRot(ctx, K.bolt('flame' + glowC, [ '#ffffff', glowC, K.shade(glowC, -0.4) ], 26, 7), nx - ca * (16 + s.thrust * 8), ny - sa * (16 + s.thrust * 8), s.angle + Math.PI, 0.6 + s.thrust * 0.5);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    K.blitRot(ctx, SA.shipSprite(id, st.colors, s.bank), s.x, s.y, s.angle, 1);
    if (s.hitFlash > 0) {
      ctx.globalAlpha = Math.min(1, s.hitFlash * 6);
      K.blitRot(ctx, SA.shipFlash(id, st.colors, s.bank), s.x, s.y, s.angle, 1);
      ctx.globalAlpha = 1;
    }
    /* turret on top */
    if (st.turret) {
      ctx.fillStyle = '#2a303a';
      ctx.beginPath();
      ctx.arc(s.x - ca * 6, s.y - sa * 6, 4, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#9ac4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x - ca * 6, s.y - sa * 6);
      ctx.lineTo(s.x - ca * 6 + Math.cos(G.run.turretAngle) * 9, s.y - sa * 6 + Math.sin(G.run.turretAngle) * 9);
      ctx.stroke();
    }
    if (s.maxShield > 0 && (s.shieldHit > 0 || s.shield > 0)) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = s.shieldHit > 0 ? 0.5 : 0.05 + 0.05 * (s.shield / s.maxShield);
      const rr = s.r * 2.6;
      ctx.drawImage(K.ringSprite('#58c8ff').canvas, s.x - rr, s.y - rr, rr * 2, rr * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawBeams() {
    if (!G.beams.length) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const fl = 0.85 + Math.sin(G.time * 60) * 0.15;
    const own = G.save ? NS.cosmetics.equipped(G.save, 'beam') : NS.cosmeticData.BEAMS[0];
    for (let i = 0; i < G.beams.length; ++i) {
      const b = G.beams[i];
      const w = b.drone ? 0.45 : b.primary ? 1 : 0.7;
      const col = b.drone ? '#5cff9a' : own.color;
      ctx.strokeStyle = K.rgba(col, 0.22);
      ctx.lineWidth = 14 * w * fl;
      line(b);
      ctx.strokeStyle = K.rgba(b.drone ? '#b4ffc8' : own.core, 0.6);
      ctx.lineWidth = 5 * w * fl;
      line(b);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8 * w;
      line(b);
      K.blit(ctx, K.glow(col), b.x0, b.y0, 0.45 * w);
      if (b.hit) {
        K.blit(ctx, K.glow(b.drone ? '#5cff9a' : '#ffd090'), b.x1, b.y1, (0.8 + Math.sin(G.time * 45) * 0.2) * w);
        K.blit(ctx, K.glow('#ffffff'), b.x1, b.y1, 0.3 * w);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function line(b) {
    ctx.beginPath();
    ctx.moveTo(b.x0, b.y0);
    ctx.lineTo(b.x1, b.y1);
    ctx.stroke();
  }

  function drawPulse() {
    const p = G.run.pulse;
    if (!p) return;
    const k = p.t / 1.2;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - k) * 0.5;
    ctx.fillStyle = K.rgba('#4fd8ff', 0.06);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * Math.min(1, k * 1.6), 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* the storm: a hot tint and streaks raking the screen along the front */
  function drawStorm() {
    const sm = G.storm;
    if (!sm || sm.phase === 'calm') return;
    const v = NS.view.visible();
    if (sm.phase === 'warn') {
      ctx.fillStyle = K.rgba('#ffb060', 0.05 + Math.max(0, Math.sin(G.time * 6)) * 0.05);
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      return;
    }
    ctx.fillStyle = 'rgba(255,150,60,0.12)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.globalCompositeOperation = 'lighter';
    const ca = Math.cos(sm.angle), sa = Math.sin(sm.angle);
    ctx.strokeStyle = 'rgba(255,220,170,0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 40; ++i) {
      const seed = i * 97.13;
      const ph = (G.time * 1.6 + (seed % 1)) % 1;
      const ox = v.x0 + ((seed * 13.7) % v.w), oy = v.y0 + ((seed * 7.3) % v.h);
      const x = ox + ca * (ph - 0.5) * 900, y = oy + sa * (ph - 0.5) * 900;
      ctx.moveTo(x, y);
      ctx.lineTo(x - ca * 120, y - sa * 120);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  Object.assign(NS.world, {
    draw, begin, end, rect, budget
  });
})();
