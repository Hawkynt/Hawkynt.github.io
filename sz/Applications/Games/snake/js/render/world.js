/* The board during a run: scenery, the cached static layer, then everything that moves on it -
   timed traps (spikes, vent flames, laser gates), swirling portals, guardian warnings and
   strikes, the exit gate, bobbing fruit and tokens, power-up orbs, venom, critters, rival snakes,
   the guardian, the player's snake gliding between cells with its power-up auras - and the dark
   of Firefly Night. Positions interpolate between grid steps. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { CELL, COLS, BX, BY, TAU } = NS.constants;
  const { T, POWER_BY_ID, ENEMIES } = NS.items;
  const K = NS.artKit;
  const TA = NS.tileArt;
  const SA = NS.snakeArt;
  const IA = NS.itemArt;
  const CA = NS.creatureArt;
  const L = NS.levels;
  const B = NS.board;
  const { ctx } = NS.view;

  const MAXP = 1200;
  const xs = new Float32Array(MAXP), ys = new Float32Array(MAXP);
  const ANG = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  const STRIKE = { sand: ['#ffd8a0', '#c08a4a'], ice: ['#ffffff', '#8ad0ff'], laser: ['#ffffff', '#c08cff'], lava: ['#ffe07a', '#ff5a1a'] };

  let dynCells = [], dynLevel = null, dynVer = -1;

  function cx(i) { return BX + (i % COLS + 0.5) * CELL; }
  function cy(i) { return BY + (((i / COLS) | 0) + 0.5) * CELL; }

  /* lerp between two cells unless they are far apart (wrap or portal jump) */
  function lerpCell(a, b, t, out, k) {
    const ax = cx(a), ay = cy(a), bx = cx(b), by = cy(b);
    if (Math.abs(ax - bx) + Math.abs(ay - by) > CELL * 1.5) { out.x[k] = bx; out.y[k] = by; return; }
    out.x[k] = ax + (bx - ax) * t;
    out.y[k] = ay + (by - ay) * t;
  }

  const OUT = { x: xs, y: ys };

  function dynamicCells(level) {
    if (dynLevel === level && dynVer === (level.ver || 0)) return dynCells;
    dynCells = [];
    for (let i = 0; i < level.tiles.length; ++i) {
      const ch = level.tiles[i];
      if (L.isTimed(ch) || L.isPortal(ch)) dynCells.push(i);
    }
    dynLevel = level;
    dynVer = level.ver || 0;
    return dynCells;
  }

  function drawTiles(run) {
    const time = G.time;
    const cells = dynamicCells(run.level);
    for (let k = 0; k < cells.length; ++k) {
      const i = cells[k];
      const ch = run.level.tiles[i];
      const x = cx(i), y = cy(i);
      if (L.isPortal(ch)) {
        const col = ch === T.P1 || ch === T.P2 ? '#c08cff' : '#6fd3ff';
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow(col), x, y, 0.75, 0.7);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.4;
        for (let a = 0; a < 3; ++a) {
          const st = time * 3 + a * TAU / 3;
          ctx.beginPath(); ctx.arc(x, y, CELL * 0.34, st, st + 1.4); ctx.stroke();
        }
        continue;
      }
      const st = B.timedState(i);
      if (st === 'off') continue;
      const pulse = 0.5 + Math.sin(time * 18) * 0.5;
      if (ch === T.SPIKE) {
        const h = st === 'on' ? 1 : 0.3;
        ctx.fillStyle = st === 'on' ? '#e8e8f0' : K.rgba('#e8e8f0', 0.5 + pulse * 0.4);
        for (let yy = 0; yy < 3; ++yy) for (let xx = 0; xx < 3; ++xx) {
          const px = x - 8 + xx * 8, py = y - 8 + yy * 8;
          ctx.beginPath(); ctx.moveTo(px - 3, py + 2); ctx.lineTo(px, py + 2 - 9 * h); ctx.lineTo(px + 3, py + 2); ctx.fill();
        }
      } else if (ch === T.VENT) {
        ctx.globalCompositeOperation = 'lighter';
        if (st === 'warn') K.blitAlpha(ctx, K.glow('#ff6a2a'), x, y, 0.6, 0.4 + pulse * 0.4);
        else {
          for (let f = 0; f < 4; ++f) K.blitAlpha(ctx, K.glow(f % 2 ? '#ffb03a' : '#ff5a1a'), x + Math.sin(time * 20 + f) * 4, y - f * 9, 0.75 - f * 0.1, 0.85);
          if (Math.random() < 0.3) NS.fx.spawn(NS.fx.GLOW, x, y, (Math.random() - 0.5) * 40, -120, 0.5, 7, '#ffb03a', 0, 1);
        }
        ctx.globalCompositeOperation = 'source-over';
      } else if (ch === T.GATE) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = st === 'on' ? '#ff3a6a' : K.rgba('#ff3a6a', 0.25 + pulse * 0.3);
        ctx.lineWidth = st === 'on' ? 4 : 1.5;
        ctx.beginPath(); ctx.moveTo(x - CELL / 2 + 4, y); ctx.lineTo(x + CELL / 2 - 4, y); ctx.stroke();
        if (st === 'on') { ctx.strokeStyle = 'rgba(255,200,220,0.9)'; ctx.lineWidth = 1.5; ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  function drawMarks(run) {
    const m = run.marks;
    const time = G.time;
    for (let k = 0; k < m.length; ++k) {
      const mk = m[k];
      const x = cx(mk.i), y = cy(mk.i);
      if (mk.kind === 'warn') {
        const f = mk.t / mk.life;
        const a = 0.25 + 0.35 * (0.5 + Math.sin(time * (10 + f * 20)) * 0.5);
        const col = mk.then === 'ice' ? '#8ad0ff' : mk.then === 'rock' ? '#c8a070' : mk.then === 'crate' ? '#ffd25a' : '#ff4a3a';
        ctx.fillStyle = K.rgba(col, a);
        ctx.fillRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4);
        ctx.strokeStyle = K.rgba(col, 0.9);
        ctx.lineWidth = 2;
        const s = (CELL / 2 - 3) * (1 - f * 0.5);
        ctx.strokeRect(x - s, y - s, s * 2, s * 2);
      } else if (mk.kind === 'fire') {
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow('#ff6a1a'), x, y, 0.7, 0.8);
        K.blitAlpha(ctx, K.glow('#ffd23a'), x + Math.sin(time * 25 + mk.i) * 3, y - 4, 0.4, 0.8);
        ctx.globalCompositeOperation = 'source-over';
      } else if (mk.kind === 'sting') {
        const cols = STRIKE[mk.style] || STRIKE.sand;
        const f = 1 - mk.t / mk.life;
        if (mk.style === 'laser' || mk.style === 'lava') {
          ctx.globalCompositeOperation = 'lighter';
          K.blitAlpha(ctx, K.glow(cols[1]), x, y, 0.75, f);
          ctx.fillStyle = K.rgba(cols[0], f * 0.8);
          ctx.fillRect(x - CELL / 2, y - 5, CELL, 10);
          ctx.globalCompositeOperation = 'source-over';
        } else {
          ctx.fillStyle = cols[1];
          ctx.strokeStyle = cols[0];
          ctx.lineWidth = 1;
          for (let s = -1; s <= 1; ++s) {
            const px = x + s * 10, h = 22 * Math.min(1, f * 3);
            ctx.beginPath(); ctx.moveTo(px - 5, y + 10); ctx.lineTo(px, y + 10 - h); ctx.lineTo(px + 5, y + 10); ctx.closePath(); ctx.fill(); ctx.stroke();
          }
        }
      }
    }
  }

  function drawGate(run) {
    if (run.gate < 0) return;
    const x = cx(run.gate), y = cy(run.gate);
    const t = G.time;
    ctx.globalCompositeOperation = 'lighter';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.8);
    ctx.fillStyle = 'rgba(255,230,140,0.18)';
    for (let r = 0; r < 8; ++r) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6, -70); ctx.lineTo(6, -70); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    K.blit(ctx, IA.gate(), x, y, 1 + Math.sin(t * 5) * 0.08);
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFoods(run) {
    const t = G.time;
    const season = G.season ? G.season.id : 'harvest';
    for (let k = 0; k < run.foods.length; ++k) {
      const f = run.foods[k];
      if (f.life && f.life - f.t < 3 && Math.floor(f.t * 8) % 2 === 0) continue;
      const x = cx(f.i), y = cy(f.i) + Math.sin(t * 3 + f.i) * 2.5;
      const pop = f.pop > 0 ? NS.rng.easeOutBack(1 - f.pop / 0.35) : 1;
      if (f.kind === 'golden' || f.kind === 'shard' || f.kind === 'egg' || f.kind === 'token' || f.kind === 'gem') {
        ctx.globalCompositeOperation = 'lighter';
        const col = f.kind === 'gem' ? '#4ae0d0' : f.kind === 'token' && G.season ? G.season.color : '#ffd23a';
        K.blitAlpha(ctx, K.glow(col), x, y, 0.8 + Math.sin(t * 4 + f.i) * 0.1, 0.55);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(cx(f.i) + 2, cy(f.i) + CELL * 0.36, 10, 3.5, 0, 0, TAU); ctx.fill();
      const spr = IA.fruit(f.kind, f.kind === 'token' ? season : '');
      if (f.kind === 'shard') K.blitRot(ctx, spr, x, y, t * 2, pop);
      else K.blit(ctx, spr, x, y, pop * (f.kind === 'egg' ? 1 + Math.sin(t * 6) * 0.04 : 1));
    }
  }

  function drawPower(run) {
    const p = run.power;
    if (!p) return;
    const left = NS.constants.POWER_LIFE - p.t;
    if (left < NS.constants.POWER_BLINK && Math.floor(p.t * 8) % 2 === 0) return;
    const def = POWER_BY_ID[p.id];
    const x = cx(p.i), y = cy(p.i) + Math.sin(G.time * 4) * 3;
    ctx.globalCompositeOperation = 'lighter';
    K.blitAlpha(ctx, K.glow(def.color), x, y, 1.1, 0.6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = K.rgba(def.color, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, CELL * 0.62, -Math.PI / 2, -Math.PI / 2 + TAU * (left / NS.constants.POWER_LIFE)); ctx.stroke();
    K.blit(ctx, IA.orb(def), x, y, 1);
  }

  function drawShots(run) {
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < run.shots.length; ++k) {
      const s = run.shots[k];
      const x0 = cx(s.c), y0 = cy(s.c);
      const dx = L.DX[s.dir] * CELL * s.d, dy = L.DY[s.dir] * CELL * s.d;
      K.blit(ctx, K.glow('#9aff4a'), x0 + dx, y0 + dy, 0.6);
      K.blit(ctx, K.glow('#ffffff'), x0 + dx, y0 + dy, 0.2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawEnemies(run) {
    const t = G.time;
    const frozen = B.frozen();
    for (let k = 0; k < run.enemies.length; ++k) {
      const e = run.enemies[k];
      if (!e.alive) continue;
      const def = ENEMIES[e.type];
      if (e.body) {
        const skin = SA.tintSkin(e.color || def.color);
        const p = Math.min(1, e.acc / def.interval);
        const n = Math.min(MAXP, e.body.length);
        for (let j = 0; j < n; ++j) lerpCell(e.prev && e.prev[j] !== undefined ? e.prev[j] : e.body[j], e.body[j], p, OUT, j);
        SA.drawChain(ctx, xs, ys, n, skin, { angle: ANG[e.dir], scale: 0.85 });
        continue;
      }
      const p = Math.min(1, e.acc / def.interval);
      lerpCell(e.pi, e.i, p, OUT, 0);
      let x = xs[0], y = ys[0];
      const f = Math.floor(t * 8 + k) % 2;
      const sc = e.born > 0 ? 1 - e.born / 0.6 : 1;
      let ang = 0;
      if (e.type === 'hornet') { ang = Math.atan2(e.dy, e.dx); y -= 8; }
      else if (e.type === 'wisp' || e.type === 'imp') { y += Math.sin(t * 4 + k) * 3; }
      else ang = ANG[e.dir];
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(xs[0] + 2, ys[0] + CELL * 0.35, 12, 4, 0, 0, TAU); ctx.fill();
      if (e.type === 'wisp') {
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow('#8ad0ff'), x, y, 0.9, 0.5);
        ctx.globalCompositeOperation = 'source-over';
      }
      K.blitRot(ctx, CA.critter(e.type, frozen ? 0 : f), x, y, ang, sc);
      if (frozen) {
        ctx.fillStyle = 'rgba(190,240,255,0.45)';
        ctx.beginPath(); ctx.arc(x, y, CELL * 0.45, 0, TAU); ctx.fill();
      }
    }
  }

  function drawBoss(run) {
    const b = run.boss;
    if (!b) return;
    const t = G.time;
    if (b.hp <= 0 && b.dead > 1.6) return;
    const alpha = b.hp <= 0 ? Math.max(0, 1 - b.dead / 1.6) : 1;
    ctx.globalAlpha = alpha;
    if (b.body) {
      const n = Math.min(MAXP, b.body.length);
      const every = b.phase === 2 ? 0.26 : 0.32;
      const p = Math.min(1, b.acc / every);
      for (let j = 0; j < n; ++j) lerpCell(b.prev && b.prev[j] !== undefined ? b.prev[j] : b.body[j], b.body[j], p, OUT, j);
      ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < n; j += 2) K.blitAlpha(ctx, K.glow('#ff6a2a'), xs[j], ys[j], 0.9, 0.35);
      ctx.globalCompositeOperation = 'source-over';
      SA.drawChain(ctx, xs, ys, n, CA.WYRM_SKIN, { angle: ANG[b.dir], scale: 1.25, hat: 'horns', headScale: 1.1 });
      if (b.flash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        for (let j = 0; j < n; ++j) K.blitAlpha(ctx, K.glow('#ffffff'), xs[j], ys[j], 0.6, b.flash);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
      return;
    }
    const f = Math.floor(t * 4) % 2;
    const off = CELL / 2;
    if (b.hidden) {
      const i = b.shadow >= 0 ? b.shadow : b.i;
      if (b.id === 'mole') {
        K.blit(ctx, CA.mound(), cx(i) + off, cy(i) + off + Math.sin(t * 20) * 1.5, 1);
      } else if (b.id === 'owl') {
        const sx = cx(b.i) + off + Math.sin(t * 0.9) * 260, sy = cy(b.i) + off + Math.cos(t * 0.7) * 120;
        K.blit(ctx, CA.flightShadow(), sx, sy, 1);
        ctx.globalAlpha = alpha * 0.85;
        K.blit(ctx, CA.boss('owl', f), sx, sy - 90, 0.75);
      }
      ctx.globalAlpha = 1;
      return;
    }
    const prevX = cx(b.pi) + off, prevY = cy(b.pi) + off;
    const x = prevX + (cx(b.i) + off - prevX) * b.lt, y = prevY + (cy(b.i) + off - prevY) * b.lt;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x + 4, y + CELL * 0.8, CELL * 0.9, CELL * 0.3, 0, 0, TAU); ctx.fill();
    if (b.id === 'eclipse') {
      ctx.globalCompositeOperation = 'lighter';
      K.blitAlpha(ctx, K.glow('#c08cff'), x, y, 2.2 + Math.sin(t * 3) * 0.2, 0.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(192,140,255,0.55)';
      ctx.lineWidth = 2;
      for (let r = 0; r < 3; ++r) {
        const a0 = t * (1.2 + r * 0.5) * (r % 2 ? -1 : 1);
        ctx.beginPath(); ctx.ellipse(x, y, 48 + r * 10, 20 + r * 6, a0 * 0.3, a0, a0 + 4.2); ctx.stroke();
      }
    }
    const bob = b.id === 'eclipse' ? Math.sin(t * 2.5) * 4 : Math.abs(Math.sin(t * 5)) * -3;
    const squash = b.lt < 1 ? 1 + (1 - b.lt) * 0.15 : 1;
    const spr = CA.boss(b.id, f);
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(squash, 2 - squash);
    ctx.drawImage(spr.canvas, -spr.hw, -spr.hh, spr.w, spr.h);
    if (b.flash > 0) {
      ctx.globalAlpha = alpha * b.flash;
      const sil = K.silhouette('boss:' + b.id + ':' + f, spr);
      ctx.drawImage(sil.canvas, -spr.hw, -spr.hh, spr.w, spr.h);
    }
    ctx.restore();
    if (run.act.radiant > 0 && !b.hidden) {
      ctx.strokeStyle = K.rgba('#fff27a', 0.5 + Math.sin(t * 10) * 0.3);
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath(); ctx.arc(x, y, CELL * 1.25, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(run) {
    const s = run.snake;
    const skin = SA.skinOf(G.save.equip.skin);
    const p = NS.snake.progress();
    const body = s.body;
    const prev = G.prevBody;
    let n = Math.min(MAXP, body.length);
    for (let k = 0; k < n; ++k) lerpCell(prev[k] !== undefined ? prev[k] : body[k], body[k], p, OUT, k);
    let from = 0;
    if (!s.alive) {
      from = Math.floor((NS.constants.DEATH_TIME - s.deadT) * 60);
      if (from >= n) return;
    }
    const ang = Math.atan2(ys[0] - (n > 1 ? ys[1] : ys[0]), xs[0] - (n > 1 ? xs[1] : xs[0] - 1));
    const t = G.time;
    const radiant = run.act.radiant > 0, ghost = run.act.ghost > 0;
    if (s.iframes > 0 && Math.floor(t * 12) % 2 === 0) ctx.globalAlpha = 0.45;
    if (ghost) ctx.globalAlpha = 0.5;
    if (radiant) {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < n; k += 2) K.blitAlpha(ctx, K.glow('#fff27a'), xs[k], ys[k], 0.9 + Math.sin(t * 12 + k) * 0.15, 0.5);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (run.act.dash > 0) {
      ctx.strokeStyle = 'rgba(255,240,140,0.5)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; ++k) {
        const o = (k - 1) * 9;
        ctx.beginPath();
        ctx.moveTo(xs[0] - Math.cos(ang) * 20 - Math.sin(ang) * o, ys[0] - Math.sin(ang) * 20 + Math.cos(ang) * o);
        ctx.lineTo(xs[0] - Math.cos(ang) * 60 - Math.sin(ang) * o, ys[0] - Math.sin(ang) * 60 + Math.cos(ang) * o);
        ctx.stroke();
      }
    }
    const blink = (t % 3.7) < 0.12;
    const tongue = (t % 2.3) < 0.35 ? Math.sin((t % 2.3) / 0.35 * Math.PI) : 0;
    SA.drawChain(ctx, xs, ys, n, skin, {
      angle: ang, gulps: s.gulp, blink: blink, tongue: s.alive ? tongue : 0, hat: G.save.equip.hat, from: from,
      headScale: 1 + (s.gulp.length && s.gulp[s.gulp.length - 1] < 1 ? 0.12 : 0),
    });
    ctx.globalAlpha = 1;
    if (run.shield > 0 && s.alive) {
      ctx.strokeStyle = K.rgba('#8ab8ff', 0.55 + Math.sin(t * 5) * 0.2);
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(xs[0], ys[0], CELL * 0.72, 0, TAU); ctx.stroke();
      if (run.shield > 1) { ctx.beginPath(); ctx.arc(xs[0], ys[0], CELL * 0.86, 0, TAU); ctx.stroke(); }
    }
    if (run.act.magnet > 0) {
      ctx.strokeStyle = K.rgba('#ff9a3a', 0.35);
      ctx.lineWidth = 1.5;
      const r = ((t * 60) % 60) + 20;
      ctx.beginPath(); ctx.arc(xs[0], ys[0], r, 0, TAU); ctx.stroke();
    }
    OUT.headX = xs[0];
    OUT.headY = ys[0];
  }

  /* Firefly Night: darkness everywhere but a pool of light around the head, painted into a small
     offscreen mask (one fill and one cut-out) and stretched over the view, so it has no seams */
  let dark = null;
  const DARK_SCALE = 0.25;

  function darkness(v) {
    const w = Math.ceil(v.w * DARK_SCALE) + 2, h = Math.ceil(v.h * DARK_SCALE) + 2;
    if (!dark) dark = K.makeCanvas(w, h);
    if (dark.width < w || dark.height < h) { dark.width = w; dark.height = h; }
    const g = dark.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, dark.width, dark.height);
    g.fillStyle = 'rgba(4,6,18,0.93)';
    g.fillRect(0, 0, w, h);
    const x = (OUT.headX - v.x0) * DARK_SCALE, y = (OUT.headY - v.y0) * DARK_SCALE, R = 260 * DARK_SCALE;
    const gr = g.createRadialGradient(x, y, R * 0.2, x, y, R);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.55, 'rgba(0,0,0,0.45)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = gr;
    g.fillRect(x - R, y - R, R * 2, R * 2);
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(dark, 0, 0, w, h, v.x0, v.y0, w / DARK_SCALE, h / DARK_SCALE);
  }

  function draw(dt) {
    const run = G.run;
    if (!run || !run.level) return;
    const v = NS.view.visible();
    NS.backdrop.draw(run.level.theme, dt);
    ctx.save();
    ctx.translate(G.shakeX, G.shakeY);
    const layer = TA.boardLayer(run.level);
    ctx.drawImage(layer.canvas, BX - TA.RIM, BY - TA.RIM, layer.w, layer.h);
    drawTiles(run);
    drawMarks(run);
    drawGate(run);
    NS.fxRender.draw(0);
    drawFoods(run);
    drawPower(run);
    drawEnemies(run);
    drawBoss(run);
    drawPlayer(run);
    drawShots(run);
    if (run.mutators && run.mutators.indexOf('night') >= 0) {
      darkness(v);
      /* fruit glimmers in the dark like fireflies */
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < run.foods.length; ++k) {
        const f = run.foods[k];
        K.blitAlpha(ctx, K.glow('#fff2a0'), cx(f.i), cy(f.i), 0.35, 0.25 + Math.sin(G.time * 3 + f.i) * 0.15);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    NS.fxRender.draw(1);
    ctx.restore();
  }

  Object.assign(NS.world, {
    draw, cx, cy, OUT
  });
})();
