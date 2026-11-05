/* The arena on screen: the framed, cached floor-and-stone layer, animated belts and teleport
   pads, the exit, boss telegraphs, pickups, then row by row bricks, bombs, enemies, the player
   and the boss (so taller sprites overlap correctly), fire on top, the darkness of the Keep
   with light around the player, fire and bombs, and the Radar shimmer. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { TILE, COLS, ROWS, ARENA_X, ARENA_Y, ARENA_W, ARENA_H, T_SOFT, T_CRATE, T_TELE, FIRE_TIME } = C;
  const { BOSSES, ENEMY_BY_ID } = NS.content;
  const { WORLDS } = NS.story;
  const K = NS.artKit;
  const TA = NS.tileArt;
  const AA = NS.actorArt;
  const BA = NS.bossArt;
  const IA = NS.itemArt;
  const T = TILE;
  const TAU = Math.PI * 2;

  const rows = [];
  for (let r = 0; r < ROWS + 2; ++r) rows.push([]);
  let dark = null;

  function frame(w) {
    return K.sprite('frame:' + w, ARENA_W + 40, ARENA_H + 44, (x) => {
      const p = WORLDS[w].palette;
      x.fillStyle = 'rgba(0,0,0,0.45)';
      K.roundRect(x, 6, 12, ARENA_W + 32, ARENA_H + 32, 18); x.fill();
      const g = x.createLinearGradient(0, 0, 0, ARENA_H + 40);
      g.addColorStop(0, K.shade(p.hardSide, 0.2)); g.addColorStop(1, K.shade(p.hardSide, -0.4));
      x.fillStyle = g;
      K.roundRect(x, 2, 2, ARENA_W + 36, ARENA_H + 36, 16); x.fill();
      x.strokeStyle = K.rgba(p.hardEdge, 0.7); x.lineWidth = 2;
      K.roundRect(x, 4, 4, ARENA_W + 32, ARENA_H + 32, 14); x.stroke();
      x.fillStyle = p.accent;
      for (const [a, b] of [[12, 12], [ARENA_W + 28, 12], [12, ARENA_H + 28], [ARENA_W + 28, ARENA_H + 28]]) K.circle(x, a, b, 4, p.accent);
    });
  }

  function cx(c) { return c * T + T / 2; }
  function cy(r) { return r * T + T / 2; }

  function draw() {
    const run = G.run;
    if (!run || !run.level) return;
    const ctx = NS.view.ctx;
    const level = run.level;
    const t = G.time;
    ctx.save();
    ctx.translate(ARENA_X + G.shakeX, ARENA_Y + G.shakeY);
    ctx.drawImage(frame(level.world), -20, -20);
    const seasonId = G.season ? G.season.id : 'none';
    ctx.drawImage(TA.floorLayer(level, seasonId), 0, 0);
    const g = level.grid;
    /* animated floor features */
    const bf = Math.floor(t * 8) % 4;
    for (let i = 0; i < g.length; ++i) {
      const tile = g[i];
      if (tile < C.T_BELT_U) continue;
      const c = i % COLS, r = (i / COLS) | 0;
      if (tile === T_TELE) {
        ctx.drawImage(TA.tele(), c * T, r * T);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45 + Math.sin(t * 5 + i) * 0.2;
        K.blit(ctx, K.glow('#7ef9ff'), cx(c), cy(r), 0.5);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255,79,216,0.8)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx(c), cy(r) + 2, 15, t * 3 + i, t * 3 + i + 2); ctx.stroke();
      } else if (tile <= C.T_BELT_R) ctx.drawImage(TA.belt(TA.beltDir(tile), bf), c * T, r * T);
    }
    drawExit(run, t);
    drawTele(run, t);
    drawPickups(run, t);
    /* bucket the movers by row */
    for (let r = 0; r < rows.length; ++r) rows[r].length = 0;
    for (let k = 0; k < run.bombs.length; ++k) bucket(run.bombs[k].fly ? run.bombs[k].y + 0.5 : run.bombs[k].y, run.bombs[k]);
    for (let k = 0; k < run.enemies.length; ++k) bucket(run.enemies[k].y, run.enemies[k]);
    bucket(run.player.y + 0.05, run.player);
    if (run.boss) bucket(run.boss.y + BOSSES[run.boss.type].size / 2 - 0.4, run.boss);
    const soft = TA.soft(level.world), crate = TA.crate();
    for (let r = 0; r < ROWS; ++r) {
      for (let c = 0; c < COLS; ++c) {
        const tile = g[r * COLS + c];
        if (tile === T_SOFT) ctx.drawImage(soft, c * T, r * T);
        else if (tile === T_CRATE) ctx.drawImage(crate, c * T, r * T);
      }
      const list = rows[r];
      for (let k = 0; k < list.length; ++k) {
        const o = list[k];
        if (o === run.player) drawPlayer(run, o, t);
        else if (o === run.boss) drawBoss(run, o, t);
        else if (o.fuse !== undefined) drawBomb(run, o, t);
        else drawEnemy(run, o, t);
      }
    }
    for (let k = 0; k < rows[ROWS].length; ++k) if (rows[ROWS][k] === run.boss) drawBoss(run, run.boss, t);
    drawFire(run);
    if (G.perks.radar) drawRadar(run, t);
    if (level.dark) drawDark(run, t);
    ctx.restore();
  }

  function bucket(y, o) {
    const r = Math.max(0, Math.min(ROWS, Math.round(y)));
    rows[r].push(o);
  }

  function drawExit(run, t) {
    if (!run.exitShown || run.exitAt < 0) return;
    const ctx = NS.view.ctx;
    const c = run.exitAt % COLS, r = (run.exitAt / COLS) | 0;
    if (run.level.grid[run.exitAt] === T_SOFT) return;
    ctx.drawImage(TA.exitDoor(run.exitOpen), c * T, r * T - 8);
    if (run.exitOpen) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + Math.sin(t * 4) * 0.25;
      K.blit(ctx, K.glow('#9af0ff'), cx(c), cy(r), 0.9);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#9af0ff';
      ctx.fillRect(c * T + 10, r * T - 60, T - 20, 64);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawTele(run, t) {
    const ctx = NS.view.ctx;
    for (let k = 0; k < run.tele.length; ++k) {
      const tl = run.tele[k];
      const u = tl.t / tl.dur;
      const blink = 0.25 + u * 0.45 + (Math.sin(t * (10 + u * 20)) > 0 ? 0.15 : 0);
      ctx.fillStyle = tl.kind === 'rock' ? 'rgba(160,110,60,' + blink + ')' : tl.kind === 'laser' ? 'rgba(126,249,255,' + blink + ')' : 'rgba(255,60,40,' + blink + ')';
      for (let j = 0; j < tl.cells.length; ++j) {
        const i = tl.cells[j];
        const c = i % COLS, r = (i / COLS) | 0;
        ctx.fillRect(c * T + 3, r * T + 3, T - 6, T - 6);
      }
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.3 + u * 0.5) + ')';
      ctx.lineWidth = 2;
      for (let j = 0; j < tl.cells.length; ++j) {
        const i = tl.cells[j];
        const c = i % COLS, r = (i / COLS) | 0;
        const s = (T - 6) * (1 - u);
        ctx.strokeRect(c * T + T / 2 - s / 2, r * T + T / 2 - s / 2, s, s);
      }
    }
  }

  function drawPickups(run, t) {
    const ctx = NS.view.ctx;
    for (let k = 0; k < run.pickups.length; ++k) {
      const pk = run.pickups[k];
      const x = pk.x * T + T / 2, y = pk.y * T + T / 2;
      const pop = pk.pop > 0 ? 1 + Math.sin(pk.pop / 0.35 * Math.PI) * 0.35 : 1;
      const bob = Math.sin(t * 4 + pk.id) * 3;
      ctx.drawImage(IA.shadow(32), x - 16, y + 8, 32, 12);
      if (pk.type === 'gem' || pk.type === 'gem5') {
        const s = IA.gem(pk.type === 'gem5');
        const w = s.width * Math.abs(Math.cos(t * 3 + pk.id)) * pop * (pk.type === 'gem5' ? 1 : 0.8);
        ctx.drawImage(s, x - w / 2, y - 16 + bob - 4, w, s.height * pop * (pk.type === 'gem5' ? 1 : 0.8));
        continue;
      }
      if (pk.type === 'token') {
        const s = IA.token(G.season.id);
        K.blit(ctx, s, x, y - 4 + bob, pop);
        continue;
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(t * 5 + pk.id) * 0.15;
      K.blit(ctx, K.glow(NS.content.POWERUP_BY_ID[pk.type] ? NS.content.POWERUP_BY_ID[pk.type].color : '#ffffff'), x, y, 0.6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blit(ctx, IA.powerup(pk.type), x, y - 2 + bob, 0.92 * pop);
    }
  }

  function drawPlayer(run, p, t) {
    const ctx = NS.view.ctx;
    const x = p.x * T + T / 2, y = p.y * T + T / 2;
    ctx.drawImage(IA.shadow(40), x - 20, y + 12, 40, 14);
    if (p.dead) {
      const u = Math.min(1, p.deadT / 1.4);
      ctx.save();
      ctx.globalAlpha = 1 - u;
      ctx.translate(x, y - u * 40);
      ctx.rotate(u * TAU * 1.5);
      ctx.scale(1 + u * 0.4, 1 + u * 0.4);
      const s = AA.bomber(G.save.equip.skin, 0, 0);
      ctx.drawImage(s, -s.width * 0.4, -s.height * 0.5, s.width * 0.8, s.height * 0.8);
      ctx.restore();
      return;
    }
    if (p.inv > 0 && Math.floor(t * 12) % 2 === 0 && run.phase === 'play') ctx.globalAlpha = 0.45;
    const f = p.moving ? Math.floor(p.walkT * 4.2) % 4 : 0;
    const s = AA.bomber(G.save.equip.skin, p.dir, f);
    const sq = p.squash;
    const breathe = p.moving ? 0 : Math.sin(t * 3) * 0.025;
    const sx = (1 + (1 - sq) * 0.45 - breathe) * 0.8, sy = (1 - (1 - sq) * 0.35 + breathe) * 0.8;
    if (p.dashT > 0) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(s, x - s.width * sx / 2 - (p.dir === 3 ? 18 : p.dir === 2 ? -18 : 0), y + 22 - s.height * sy - (p.dir === 0 ? 18 : p.dir === 1 ? -18 : 0), s.width * sx, s.height * sy);
      ctx.globalAlpha = p.inv > 0 ? 0.6 : 1;
    }
    ctx.drawImage(s, x - s.width * sx / 2, y + 22 - s.height * sy, s.width * sx, s.height * sy);
    ctx.globalAlpha = 1;
    if (p.shield) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(t * 6) * 0.1;
      K.blit(ctx, K.glow('#8fe8ff'), x, y - 6, 0.62);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(200,250,255,0.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y - 6, 27, 0, TAU); ctx.stroke();
    }
    if (p.curse) {
      ctx.globalAlpha = 0.6 + Math.sin(t * 8) * 0.3;
      NS.icons.draw(ctx, 'skull', x, y - 46 + Math.sin(t * 5) * 3, 18, '#d8d0e8');
      ctx.globalAlpha = 1;
    }
    if (p.magnetT > 0) {
      ctx.strokeStyle = 'rgba(255,216,74,' + (0.3 + Math.sin(t * 8) * 0.2) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 30 + (t * 40) % 20, 0, TAU); ctx.stroke();
    }
  }

  function drawBomb(run, b, t) {
    const ctx = NS.view.ctx;
    const x = b.x * T + T / 2;
    let y = b.y * T + T / 2;
    let lift = 0;
    if (b.fly) lift = Math.sin(Math.min(1, b.fly.t / b.fly.dur) * Math.PI) * 46;
    ctx.drawImage(IA.shadow(36), x - 18, y + 10, 36, 13);
    y -= lift;
    const urgency = b.remote && b.owner === 'p' ? 0.3 : 1 - Math.max(0, Math.min(1, b.t / b.fuse));
    const pulse = 1 + Math.sin(t * (6 + urgency * 22)) * (0.04 + urgency * 0.07);
    const sx = pulse * (1 + (1 - b.squash) * 0.5), sy = pulse * (1 - (1 - b.squash) * 0.4);
    const s = IA.bomb(G.save.equip.bomb, b.mega, b.owner === 'p' ? '' : b.owner);
    const k = b.mega ? 1 : 0.86;
    ctx.drawImage(s, x - 28 * k * sx, y + 8 - 42 * k * sy, 56 * k * sx, 60 * k * sy);
    if (urgency > 0.7 && Math.floor(t * 16) % 2 === 0) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(BA.silhouette('bomb' + G.save.equip.bomb + b.mega + b.owner, s, '#ff3020'), x - 28 * k * sx, y + 8 - 42 * k * sy, 56 * k * sx, 60 * k * sy);
      ctx.globalAlpha = 1;
    }
    /* fuse spark */
    const fx0 = x + (40 - 28) * k * sx, fy0 = y + 8 - 42 * k * sy + 5 * k * sy;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.7 + Math.random() * 0.3;
    K.blit(ctx, K.glow(b.remote && b.owner === 'p' ? '#ff4040' : '#ffd23a'), fx0, fy0, 0.22 + Math.random() * 0.08);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (Math.random() < 0.25) NS.fx.emit(ARENA_X + fx0, ARENA_Y + fy0, (Math.random() - 0.5) * 60, -40 - Math.random() * 40, 0.3, 2, '#ffd23a', 0, true, 120, 1);
  }

  function drawEnemy(run, e, t) {
    const ctx = NS.view.ctx;
    const def = ENEMY_BY_ID[e.type];
    const x = e.x * T + T / 2, y = e.y * T + T / 2;
    const small = e.type === 'blobling';
    ctx.drawImage(IA.shadow(40), x - (small ? 12 : 18), y + 12, small ? 24 : 36, 12);
    const f = Math.floor((e.t + e.id) * (def.speed * 2.2)) % 4;
    const s = AA.enemy(e.type, run.freezeT > 0 ? 0 : f, e.dir === 2);
    let sc = 0.9;
    if (e.spawnT > 0) sc *= 1 - e.spawnT / 0.7;
    const sx = sc * (1 + (1 - e.squash) * 0.5), sy = sc * (1 - (1 - e.squash) * 0.4);
    const hover = e.ghost ? Math.sin(t * 3 + e.id) * 4 - 6 : 0;
    const dx = x - s.width * sx / 2, dy = y + 22 - s.height * sy + hover;
    ctx.drawImage(s, dx, dy, s.width * sx, s.height * sy);
    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(1, e.flash * 4);
      ctx.drawImage(BA.silhouette('e' + e.type + f + (e.dir === 2), s, '#ffffff'), dx, dy, s.width * sx, s.height * sy);
      ctx.globalAlpha = 1;
    } else if (run.freezeT > 0) {
      ctx.globalAlpha = 0.45;
      ctx.drawImage(BA.silhouette('e' + e.type + 0 + (e.dir === 2), s, '#bff4ff'), dx, dy, s.width * sx, s.height * sy);
      ctx.globalAlpha = 1;
    }
    if (def.ai === 'tank' && e.hp < def.hp) {
      ctx.strokeStyle = 'rgba(30,20,20,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 8, dy + 14); ctx.lineTo(x - 2, dy + 22); ctx.lineTo(x - 6, dy + 30);
      if (e.hp < def.hp - 1) { ctx.moveTo(x + 10, dy + 18); ctx.lineTo(x + 4, dy + 28); }
      ctx.stroke();
    }
    if (e.charging && Math.random() < 0.5) NS.fx.emit(ARENA_X + x, ARENA_Y + y + 14, (Math.random() - 0.5) * 40, -20, 0.4, 6, 'rgba(200,180,140,0.5)', 3, false, 0, 1);
  }

  function drawBoss(run, b, t) {
    const ctx = NS.view.ctx;
    const def = BOSSES[b.type];
    const x = b.x * T + T / 2, y = b.y * T + T / 2;
    const size = def.size * T * 1.45;
    if (b.under) {
      /* a heaving mound of earth with a crown tip poking out */
      ctx.drawImage(IA.shadow(80), x - 40, y + 8, 80, 22);
      ctx.fillStyle = '#5a3a1e';
      ctx.beginPath(); ctx.ellipse(x, y + 12, 40 + Math.sin(t * 20) * 3, 18, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#8a6a4a';
      for (let i = 0; i < 6; ++i) { ctx.beginPath(); ctx.arc(x - 30 + i * 12, y + 4 + Math.sin(t * 14 + i) * 4 - (i > 1 && i < 4 ? 8 : 0), 8, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffd84a';
      ctx.beginPath(); ctx.moveTo(x - 10, y - 8); ctx.lineTo(x - 10, y - 20 - Math.abs(Math.sin(t * 6)) * 4); ctx.lineTo(x - 4, y - 13); ctx.lineTo(x, y - 24 - Math.abs(Math.sin(t * 6)) * 4); ctx.lineTo(x + 4, y - 13); ctx.lineTo(x + 10, y - 20 - Math.abs(Math.sin(t * 6)) * 4); ctx.lineTo(x + 10, y - 8); ctx.fill();
      return;
    }
    ctx.drawImage(IA.shadow(80), x - size * 0.4, y + size * 0.22, size * 0.8, size * 0.24);
    if (b.phase === 2 || b.state === 'dying') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(t * 8) * 0.15;
      K.blit(ctx, K.glow(b.state === 'dying' ? '#ffffff' : '#ff3a1a'), x, y - size * 0.1, size / 70);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const f = Math.floor(t * 4) % 2;
    const s = BA.sprite(b.type, f);
    const intro = b.state === 'intro' ? Math.min(1, b.t / 1.2) : 1;
    const sq = b.squash;
    const shakeX = b.state === 'dying' ? (Math.random() - 0.5) * 8 : 0;
    const sx = size * (1 + (1 - sq) * 0.3) / s.width, sy = size * (1 - (1 - sq) * 0.25) * intro / s.height;
    ctx.save();
    ctx.globalAlpha = b.alpha;
    ctx.translate(x + shakeX, y + size * 0.45);
    if (b.dir === 2) ctx.scale(-1, 1);
    ctx.drawImage(s, -s.width * sx / 2, -s.height * sy, s.width * sx, s.height * sy);
    if (b.flash > 0) {
      ctx.globalAlpha = Math.min(1, b.flash * 4) * b.alpha;
      ctx.drawImage(BA.silhouette('boss' + b.type + f, s, '#ffffff'), -s.width * sx / 2, -s.height * sy, s.width * sx, s.height * sy);
    }
    ctx.restore();
    if (b.state === 'stunned') {
      for (let i = 0; i < 3; ++i) {
        const a = t * 4 + i * TAU / 3;
        NS.icons.draw(ctx, 'star', x + Math.cos(a) * 26, y - size * 0.55 + Math.sin(a) * 8, 14, '#ffd84a');
      }
    }
  }

  function drawFire(run) {
    const ctx = NS.view.ctx;
    const f = run.fire, d = run.fireDir;
    for (let i = 0; i < f.length; ++i) {
      if (f[i] <= 0) continue;
      const u = f[i] / FIRE_TIME;
      const lvl = u > 0.62 ? 0 : u > 0.3 ? 1 : 2;
      const bits = d[i];
      const kind = (bits & 16) || ((bits & 3) && (bits & 12)) ? 'c' : (bits & 3) ? 'v' : (bits & 12) ? 'h' : 'c';
      const c = i % COLS, r = (i / COLS) | 0;
      ctx.drawImage(IA.fire(kind, lvl), c * T, r * T);
      if (kind === 'c' || ((c + r) & 1)) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55 * u;
        K.blit(ctx, K.glow(run.fireO[i] === 2 ? '#ff3a6a' : '#ff8a2a'), c * T + T / 2, r * T + T / 2, 0.75);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  function drawRadar(run, t) {
    const ctx = NS.view.ctx;
    ctx.globalAlpha = 0.3 + Math.sin(t * 3) * 0.12;
    const h = run.level.hidden;
    for (const k in h) {
      const i = +k;
      const c = i % COLS, r = (i / COLS) | 0;
      if (h[k] === 'exit') NS.icons.draw(ctx, 'exit', cx(c), cy(r) - 4, 22, '#9af0ff');
      else if (NS.content.POWERUP_BY_ID[h[k]]) NS.icons.draw(ctx, h[k], cx(c), cy(r) - 4, 20, NS.content.POWERUP_BY_ID[h[k]].color);
    }
    ctx.globalAlpha = 1;
  }

  /* The Keep is dark: light comes from the player, fire, bombs and the open exit */
  function drawDark(run, t) {
    const ctx = NS.view.ctx;
    if (!dark) dark = K.canvas(ARENA_W, ARENA_H);
    const x = dark.getContext('2d');
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, ARENA_W, ARENA_H);
    x.fillStyle = 'rgba(6,2,14,0.8)';
    x.fillRect(0, 0, ARENA_W, ARENA_H);
    x.globalCompositeOperation = 'destination-out';
    const light = K.glow('#ffffff');
    const p = run.player;
    K.blit(x, light, p.x * T + T / 2, p.y * T + T / 2, 3.0 + Math.sin(t * 2) * 0.06);
    K.blit(x, light, p.x * T + T / 2, p.y * T + T / 2, 1.2);
    for (let k = 0; k < run.bombs.length; ++k) K.blit(x, light, run.bombs[k].x * T + T / 2, run.bombs[k].y * T + T / 2, 0.8);
    const f = run.fire;
    for (let i = 0; i < f.length; ++i) if (f[i] > 0 && (i & 1) === 0) K.blit(x, light, (i % COLS) * T + T / 2, ((i / COLS) | 0) * T + T / 2, 1.3);
    if (run.exitShown && run.exitAt >= 0) K.blit(x, light, (run.exitAt % COLS) * T + T / 2, ((run.exitAt / COLS) | 0) * T + T / 2, 0.9);
    if (run.boss && run.boss.state !== 'dead') K.blit(x, light, run.boss.x * T + T / 2, run.boss.y * T + T / 2, 1.1);
    for (let k = 0; k < run.enemies.length; ++k) if (run.enemies[k].ghost) K.blit(x, light, run.enemies[k].x * T + T / 2, run.enemies[k].y * T + T / 2, 0.45);
    ctx.drawImage(dark, 0, 0);
  }

  Object.assign(NS.world, {
    draw, frame
  });
})();
