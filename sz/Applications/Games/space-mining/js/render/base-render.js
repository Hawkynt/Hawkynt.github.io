/* Draws the outpost under the camera transform, culled: the site plate and build grid, the
   deposits, energy links (power flowing, infection and corruption tinting them), buildings
   with their moving parts, construction as a blueprint filling in, dark (unpowered,
   understaffed, abandoned) and hijacked looks with glitches, infection glow, damage, hit
   points, selection and ranges; then on top the shield domes, cargo pods, turret and repair
   beams, the placement preview and the silent distress station. Reads only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU, FONT } = NS.constants;
  const { BUILDING_BY_ID } = NS.colonyData;
  const K = NS.artKit;
  const A = NS.colonyArt;
  const C = NS.colony;
  const { ctx } = NS.view;
  const rect = NS.world.rect;

  function inRect(x, y, m) {
    return x > rect.x0 - m && x < rect.x1 + m && y > rect.y0 - m && y < rect.y1 + m;
  }

  function siteVisible(b) {
    const s = b.site;
    return s.x0 + s.w > rect.x0 - 100 && s.x0 < rect.x1 + 100 && s.y0 + s.h > rect.y0 - 100 && s.y0 < rect.y1 + 100;
  }

  /* below the rocks: plate, grid, deposits, links, buildings */
  function draw() {
    const b = G.base;
    if (!b || !siteVisible(b)) return;
    const s = b.site;
    const claimed = NS.base.claimed();
    const showGrid = G.cmd.on && (G.cmd.place || !claimed);
    /* the site plate */
    ctx.fillStyle = claimed ? 'rgba(20,28,40,0.32)' : 'rgba(20,28,40,0.18)';
    ctx.fillRect(s.x0, s.y0, s.w, s.h);
    ctx.strokeStyle = K.rgba(b.zone.theme.accent, claimed ? 0.35 : 0.5 + Math.sin(G.time * 3) * 0.2);
    ctx.lineWidth = 2;
    const L = 40;
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0 + L); ctx.lineTo(s.x0, s.y0); ctx.lineTo(s.x0 + L, s.y0);
    ctx.moveTo(s.x0 + s.w - L, s.y0); ctx.lineTo(s.x0 + s.w, s.y0); ctx.lineTo(s.x0 + s.w, s.y0 + L);
    ctx.moveTo(s.x0, s.y0 + s.h - L); ctx.lineTo(s.x0, s.y0 + s.h); ctx.lineTo(s.x0 + L, s.y0 + s.h);
    ctx.moveTo(s.x0 + s.w - L, s.y0 + s.h); ctx.lineTo(s.x0 + s.w, s.y0 + s.h); ctx.lineTo(s.x0 + s.w, s.y0 + s.h - L);
    ctx.stroke();
    if (showGrid) {
      ctx.strokeStyle = 'rgba(124,240,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 1; x < s.cols; ++x) { ctx.moveTo(s.x0 + x * s.cell, s.y0); ctx.lineTo(s.x0 + x * s.cell, s.y0 + s.h); }
      for (let y = 1; y < s.rows; ++y) { ctx.moveTo(s.x0, s.y0 + y * s.cell); ctx.lineTo(s.x0 + s.w, s.y0 + y * s.cell); }
      ctx.stroke();
    }
    for (let i = 0; i < b.deps.length; ++i) {
      const d = b.deps[i];
      const x = s.x0 + (d.cx + 0.5) * s.cell, y = s.y0 + (d.cy + 0.5) * s.cell;
      const col = NS.ores.ORE_BY_ID[d.res].color;
      const used = b.cells && b.cells[d.cy * s.cols + d.cx];
      if (!used) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 + Math.sin(G.time * 2 + i) * 0.12;
        K.blit(ctx, K.glow(col), x, y, 1.1);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = K.rgba(col, 0.55);
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(x, y, s.cell * 0.62, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      K.blit(ctx, A.deposit(d.kind, d.res), x, y, 1.15);
      if (G.cmd.on && !used && G.cam.zoom > 0.36) label(NS.ores.ORE_BY_ID[d.res].name, x, y + s.cell * 0.78, 11, K.shade(col, 0.3));
    }
    if (!claimed && !b.data.abandoned) {
      const k = 0.5 + Math.sin(G.time * 2.5) * 0.3;
      ctx.globalAlpha = k;
      ctx.drawImage(K.ringSprite(b.zone.theme.accent).canvas, s.cx - 160, s.cy - 160, 320, 320);
      ctx.globalAlpha = 1;
      label('UNCLAIMED OUTPOST SITE', s.cx, s.cy - 20, 22, b.zone.theme.accent);
      label(G.cmd.on ? 'Place a Command Hub to found it' : 'TAB - command view to found an outpost', s.cx, s.cy + 12, 15, '#ffffff');
    }
    links(b);
    const list = b.data.buildings;
    for (let i = 0; i < list.length; ++i) building(list[i], b);
  }

  function label(t, x, y, px, color) {
    ctx.font = 'bold ' + Math.round(px / Math.max(0.4, G.cam.zoom) * 0.85) + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(t, x, y);
    ctx.fillStyle = color;
    ctx.fillText(t, x, y);
  }

  function links(b) {
    const net = b.net;
    if (!net) return;
    const list = b.data.buildings;
    const low = b.pw.ratio < 0.95;
    ctx.lineCap = 'round';
    for (let k = 0; k < net.edges.length; ++k) {
      const p = list[net.edges[k][0]], q = list[net.edges[k][1]];
      if (!p || !q) continue;
      const bad = (p.cor || 0) > 0.25 || (q.cor || 0) > 0.25 || p.rogue || q.rogue;
      const sick = (p.inf || 0) > 0.05 || (q.inf || 0) > 0.05;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.stroke();
      ctx.strokeStyle = bad ? '#2a8a7a' : sick ? '#5a8a2a' : b.data.abandoned ? '#2a3038' : '#3a5a6a';
      ctx.lineWidth = 3;
      ctx.stroke();
      if (b.data.abandoned) continue;
      ctx.strokeStyle = bad ? '#3affd0' : sick ? '#9ae04a' : low ? '#ffb347' : '#7cf0ff';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 14]);
      ctx.lineDashOffset = -G.time * (low ? 20 : 60);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function dim(o, b) {
    if (b.data.abandoned) return true;
    if (o.prog < 1 || o.rogue) return false;
    const def = BUILDING_BY_ID[o.type];
    return (def.power < 0 || def.crew > 0) && (o._eff || 0) <= 0.05;
  }

  function building(o, b) {
    if (!inRect(o.x, o.y, o.r * 2)) return;
    const def = BUILDING_BY_ID[o.type];
    const S = def.size * A.CELL;
    const lvl = o.lvl;
    if (o.prog < 1) {
      construction(o, def, S);
      return;
    }
    let jx = 0, jy = 0;
    if (o.rogue || (o.cor || 0) > 0.4) {
      const g = Math.sin(G.time * 37 + o.id) > 0.85 ? 1 : 0;
      jx = g * (Math.sin(G.time * 91 + o.id) * 3);
      jy = g * (Math.cos(G.time * 73) * 2);
    }
    const sp = o.rogue ? A.rogue(o.type, lvl) : dim(o, b) ? A.dark(o.type, lvl) : A.building(o.type, lvl);
    ctx.drawImage(sp.canvas, o.x - S / 2 + jx, o.y - S / 2 + jy, S, S);
    parts(o, def, b);
    overlays(o, def, S);
  }

  function construction(o, def, S) {
    const x = o.x - S / 2, y = o.y - S / 2;
    ctx.fillStyle = 'rgba(20,60,90,0.35)';
    ctx.fillRect(x, y, S, S);
    const h = S * o.prog;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + S - h, S, h);
    ctx.clip();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(A.building(o.type, o.lvl).canvas, x, y, S, S);
    ctx.restore();
    ctx.globalAlpha = 1;
    /* blueprint frame and the welding line */
    ctx.strokeStyle = 'rgba(124,240,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.lineDashOffset = -G.time * 30;
    ctx.strokeRect(x + 1, y + 1, S - 2, S - 2);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(124,240,255,0.25)';
    ctx.beginPath();
    for (let k = 1; k < 4; ++k) { ctx.moveTo(x + S * k / 4, y); ctx.lineTo(x + S * k / 4, y + S); ctx.moveTo(x, y + S * k / 4); ctx.lineTo(x + S, y + S * k / 4); }
    ctx.stroke();
    const ly = y + S - h;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(160,240,255,0.8)';
    ctx.fillRect(x, ly - 1, S, 2);
    K.blit(ctx, K.glow('#bfe8ff'), x + S * (0.5 + Math.sin(G.time * 5) * 0.45), ly, 0.6);
    ctx.globalCompositeOperation = 'source-over';
    hpBar(o.x, y - 8, S * 0.8, o.prog, '#7cf0ff');
  }

  /* turret heads, the dish, drill and torus, lights that breathe */
  function parts(o, def, b) {
    const t = G.time;
    const on = !dim(o, b);
    if (o.type === 'laser' || o.type === 'flak') K.blitRot(ctx, A.head(o.type), o.x, o.y, o._ang || 0, o.type === 'flak' ? 1 : 0.9);
    else if (o.type === 'radar') K.blitRot(ctx, A.head('radar'), o.x, o.y, on ? t * 1.6 + o.id : o.id, 0.9);
    else if (o.type === 'rig') K.blitRot(ctx, A.head('drill'), o.x, o.y, on && !o._blocked ? t * 6 : 0, 1.2);
    else if (o.type === 'fusion' && on && G.base.fuel[o.id] !== false) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6 + Math.sin(t * 5 + o.id) * 0.25;
      K.blitRot(ctx, A.head('torus'), o.x, o.y, t, 1.3);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else if (o.type === 'smelter' && on && !o._idle) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + Math.sin(t * 9 + o.id) * 0.2;
      K.blit(ctx, K.glow('#ff8a3a'), o.x - 14, o.y - 14, 0.7);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.05) NS.fx.smoke(o.x + 18, o.y - 16, 1, 6, true);
    }
    if (on && !o.rogue && (def.range || def.makes)) {
      const blink = Math.sin(t * 4 + o.id) > 0.6;
      if (blink) {
        ctx.globalCompositeOperation = 'lighter';
        K.blit(ctx, K.glow(def.color), o.x + o.r * 0.8, o.y - o.r * 0.8, 0.22);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  function overlays(o, def, S) {
    const t = G.time;
    if ((o.inf || 0) > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.9, 0.3 + o.inf * 0.7) * (0.75 + Math.sin(t * 3 + o.id) * 0.25);
      K.blit(ctx, K.glow('#7ae04a'), o.x, o.y, S / 30);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = K.rgba('#9ae04a', 0.35 + o.inf * 0.5);
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x - S / 2 + 1, o.y - S / 2 + 1, S - 2, S - 2);
      ctx.fillStyle = 'rgba(190,255,140,0.75)';
      const n = Math.round(4 + o.inf * 10);
      for (let i = 0; i < n; ++i) {
        const a = i * 2.4 + o.id, r = (0.2 + ((i * 37) % 10) / 12) * S * 0.45;
        ctx.fillRect(o.x + Math.cos(a + t * 0.2) * r, o.y + Math.sin(a + t * 0.2) * r, 2, 2);
      }
    }
    if ((o.cor || 0) > 0.02 && !o.rogue) {
      ctx.fillStyle = K.rgba('#3affd0', 0.25 + o.cor * 0.5);
      const n = Math.round(2 + o.cor * 8);
      for (let i = 0; i < n; ++i) {
        const yy = o.y - S / 2 + ((i * 53 + Math.floor(t * 12) * 17) % S);
        ctx.fillRect(o.x - S / 2 + ((i * 29) % 12), yy, S * (0.3 + ((i * 7) % 5) / 8), 1.5);
      }
    }
    if (o.rogue) {
      ctx.strokeStyle = K.rgba('#3affd0', 0.6 + Math.sin(t * 8) * 0.3);
      ctx.lineWidth = 2.5;
      ctx.strokeRect(o.x - S / 2 - 2, o.y - S / 2 - 2, S + 4, S + 4);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + Math.sin(t * 6 + o.id) * 0.15;
      K.blit(ctx, K.glow('#3affd0'), o.x, o.y, S / 34);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      const iy = o.y - S / 2 - 18;
      ctx.fillStyle = 'rgba(0,30,26,0.8)';
      ctx.beginPath(); ctx.arc(o.x, iy, 11, 0, TAU); ctx.fill();
      NS.kit.icon('glitch', o.x, iy, 16, Math.sin(t * 10) > 0 ? '#3affd0' : '#ffffff');
    }
    if (o.quarantine) {
      ctx.strokeStyle = '#ff5c6c';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(o.x - S / 2 - 3, o.y - S / 2 - 3, S + 6, S + 6);
      ctx.setLineDash([]);
    }
    if (o._flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = o._flash * 2.5;
      K.blit(ctx, K.glow('#ff8a5a'), o.x, o.y, S / 80);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const sel = G.cmd.selB === o;
    if (o.hp < o.maxHp * 0.999 || sel) hpBar(o.x, o.y - S / 2 - 8, S * 0.8, o.hp / o.maxHp, o.hp < o.maxHp * 0.35 ? '#ff5c6c' : '#5cff9a');
    if (o.hp < o.maxHp * 0.4 && Math.random() < 0.08) NS.fx.smoke(o.x + (Math.random() - 0.5) * S * 0.5, o.y + (Math.random() - 0.5) * S * 0.5, 1, 8, true);
    if (sel) {
      ctx.strokeStyle = K.rgba('#ffffff', 0.7);
      ctx.lineWidth = 1.5 / Math.max(0.4, G.cam.zoom);
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -t * 16;
      ctx.strokeRect(o.x - S / 2 - 4, o.y - S / 2 - 4, S + 8, S + 8);
      ctx.setLineDash([]);
      if (def.range) range(o.x, o.y, def.range * G.stats.turretRange * (1 + (o.lvl - 1) * 0.12), def.color);
      if (def.radius) range(o.x, o.y, def.radius, def.color);
      if (def.link) range(o.x, o.y, C.linkRange(o.type, o.lvl, G.stats) * A.CELL + A.CELL / 2, '#7cf0ff', true);
      if (o.rally) {
        ctx.strokeStyle = 'rgba(255,210,90,0.6)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.rally.x, o.rally.y); ctx.stroke();
        ctx.setLineDash([]);
        flag(o.rally.x, o.rally.y);
      }
    }
  }

  function flag(x, y) {
    ctx.fillStyle = '#ffd25a';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - 26); ctx.lineTo(x + 14, y - 20); ctx.lineTo(x, y - 14);
    ctx.fill();
    ctx.strokeStyle = '#ffd25a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 26); ctx.stroke();
  }

  function range(x, y, r, color, square) {
    ctx.strokeStyle = K.rgba(color, 0.4);
    ctx.lineWidth = 1.5 / Math.max(0.4, G.cam.zoom);
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    if (square) ctx.rect(x - r, y - r, r * 2, r * 2);
    else ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = K.rgba(color, 0.04);
    ctx.fill();
  }

  function hpBar(x, y, w, k, color) {
    const z = Math.max(0.5, 1 / Math.max(0.4, G.cam.zoom) * 0.6);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 4 * z + 2);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, k)), 4 * z);
  }

  /* above everything in the world: domes, pods, beams, placement, the silent station */
  function drawTop() {
    const b = G.base;
    if (b && siteVisible(b)) {
      domes(b);
      pods();
      placement(b);
    }
    beams();
    distress();
  }

  function domes(b) {
    const list = b.data.buildings;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < list.length; ++i) {
      const o = list[i];
      if (o.type !== 'shield' || o.prog < 1 || !(o._shield > 0)) continue;
      const def = BUILDING_BY_ID.shield;
      const cap = def.cap * C.levelMul(o.lvl) * G.stats.shieldMul;
      const rad = def.radius * (1 + (o.lvl - 1) * 0.2);
      const k = o._shield / cap;
      ctx.globalAlpha = (o._hit > 0 ? 0.55 : 0.12 + 0.12 * k) * (0.85 + Math.sin(G.time * 2 + o.id) * 0.15);
      ctx.drawImage(K.ringSprite('#58c8ff').canvas, o.x - rad, o.y - rad, rad * 2, rad * 2);
      ctx.globalAlpha = 0.05 + 0.04 * k;
      K.blit(ctx, K.glow('#58c8ff'), o.x, o.y, rad / 32);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function pods() {
    if (!G.pods.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < G.pods.length; ++i) {
      const p = G.pods[i];
      if (p.t < 0) continue;
      const k = p.t / p.dur, e = k * k * (3 - 2 * k);
      const x = p.x0 + (p.x1 - p.x0) * e, y = p.y0 + (p.y1 - p.y0) * e - Math.sin(k * Math.PI) * 18;
      if (!inRect(x, y, 20)) continue;
      ctx.globalAlpha = Math.min(1, Math.sin(k * Math.PI) * 2);
      K.blit(ctx, K.glow(p.color), x, y, 0.32);
      ctx.fillStyle = p.color;
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function beams() {
    if (!G.tbeams.length) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < G.tbeams.length; ++i) {
      const bm = G.tbeams[i];
      ctx.strokeStyle = K.rgba(bm.color, bm.soft ? 0.25 : 0.35);
      ctx.lineWidth = bm.soft ? 5 : 7;
      ctx.beginPath(); ctx.moveTo(bm.x0, bm.y0); ctx.lineTo(bm.x1, bm.y1); ctx.stroke();
      ctx.strokeStyle = bm.soft ? K.rgba('#ffffff', 0.4) : '#ffffff';
      ctx.lineWidth = bm.soft ? 1.2 : 1.8;
      ctx.stroke();
      if (!bm.soft) K.blit(ctx, K.glow(bm.color), bm.x1, bm.y1, 0.45);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  /* the ghost of the building being placed, its footprint and why it may not go there */
  function placement(b) {
    const c = G.cmd;
    if (!c.on || !c.place) return;
    const def = BUILDING_BY_ID[c.place];
    const w = NS.camera.toWorld(G.input.mouseX, G.input.mouseY, {});
    const cell = NS.base.cellAt(w.x, w.y, def.size);
    const chk = C.canPlace(b.data, b.deps, c.place, cell.cx, cell.cy, G.stats);
    const cost = C.buildCost(c.place, G.stats);
    const afford = C.canAfford(NS.base.wallet(), b.data.stock, cost);
    const ok = chk.ok && afford;
    const s = b.site;
    const x = s.x0 + cell.cx * s.cell, y = s.y0 + cell.cy * s.cell, S = def.size * s.cell;
    ctx.fillStyle = ok ? 'rgba(92,255,154,0.18)' : 'rgba(255,92,108,0.2)';
    ctx.fillRect(x, y, S, S);
    ctx.globalAlpha = 0.7;
    ctx.drawImage(A.building(c.place, 1).canvas, x, y, S, S);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ok ? '#5cff9a' : '#ff5c6c';
    ctx.lineWidth = 2 / Math.max(0.4, G.cam.zoom);
    ctx.strokeRect(x, y, S, S);
    if (def.range) range(x + S / 2, y + S / 2, def.range * G.stats.turretRange, def.color);
    if (def.radius) range(x + S / 2, y + S / 2, def.radius, def.color);
    if (def.link) range(x + S / 2, y + S / 2, C.linkRange(c.place, 1, G.stats) * s.cell + s.cell / 2, '#7cf0ff', true);
    /* the link it would take */
    if (chk.ok && c.place !== 'hub') {
      let best = null, bd = Infinity;
      const list = b.data.buildings;
      for (let i = 0; i < list.length; ++i) {
        const o = list[i];
        if ((o.type !== 'hub' && o.type !== 'relay') || !b.net.on[i]) continue;
        const d = Math.abs(o.x - x - S / 2) + Math.abs(o.y - y - S / 2);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        ctx.strokeStyle = 'rgba(124,240,255,0.7)';
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(best.x, best.y); ctx.lineTo(x + S / 2, y + S / 2); ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (!ok) label(chk.ok ? 'Not enough ' + NS.base.missName(C.missing(NS.base.wallet(), b.data.stock, cost)) : chk.reason, x + S / 2, y - 18, 15, '#ff8a8a');
  }

  function distress() {
    const d = G.distress;
    if (!d || !inRect(d.x, d.y, 200)) return;
    d.angle += 0.0008;
    K.blitRot(ctx, NS.fleetArt.station(d.kind), d.x, d.y, d.angle, 1);
    if (d.state !== 'rescued') {
      const blink = Math.sin(G.time * 4) > 0;
      if (blink) {
        ctx.globalCompositeOperation = 'lighter';
        K.blit(ctx, K.glow('#ffd25a'), d.x, d.y - 60, 0.5);
        ctx.globalCompositeOperation = 'source-over';
      }
      if (d.state === 'clear') {
        ctx.globalAlpha = 0.5 + Math.sin(G.time * 5) * 0.25;
        ctx.drawImage(K.ringSprite('#ffd25a').canvas, d.x - 130, d.y - 130, 260, 260);
        ctx.globalAlpha = 1;
      }
      label(d.state === 'clear' ? 'DOCK TO RESCUE' : 'SILENT STATION', d.x, d.y - 120, 15, '#ffd25a');
    }
  }

  Object.assign(NS.baseRender, {
    draw, drawTop, hpBar, range, flag, label
  });
})();
