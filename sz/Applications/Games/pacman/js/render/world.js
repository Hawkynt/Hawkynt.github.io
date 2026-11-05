/* The play field for one frame: which look applies (world, chosen maze theme, season colours),
   the scenery, the maze's bezel with seasonal trim, the cached maze, dots and pulsing pellets,
   animated tile twists, pick-ups, the Decoy, ghosts (bodies, eyes, fright, ice, stun stars, dash
   streaks), the boss with its telegraphs, Pac-Man (skin, squash, mega size, shield bubble,
   afterimages, death), shots, effects and the Hollow Woods darkness. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const C = NS.constants;
  const { COLS, ROWS, TILE, MAZE_X, MAZE_Y, MAZE_W, MAZE_H, D_DOT, D_POWER, TAU } = C;
  const { WORLDS } = NS.worlds;
  const { THEME_BY_ID } = NS.cosmetics;
  const { POWERUP_BY_ID } = NS.items;
  const K = NS.artKit;
  const MA = NS.mazeArt;
  const AA = NS.actorArt;
  const IA = NS.itemArt;
  const FX = NS.fx;
  const { ctx } = NS.view;

  const tinted = {};

  /* the look for the current run (or the demo behind menus) */
  function theme() {
    const run = G.run;
    const w = run && run.lvl ? run.lvl.world : 0;
    const base = WORLDS[w].theme;
    if (!run || run.demo || run.mode === 'story') return base;
    const id = G.profile.mazeTheme;
    if (id === 'season' && G.season) {
      const key = w + ':' + G.season.id;
      if (!tinted[key]) {
        const s = G.season;
        tinted[key] = Object.assign({}, base, {
          wall: K.mix(base.wall, s.tint, 0.35), rim: K.mix(base.rim, s.color, 0.55), glow: K.mix(base.glow, s.color, 0.5), accent: s.color,
        });
      }
      return tinted[key];
    }
    const t = THEME_BY_ID[id];
    return t && t.theme ? t.theme : base;
  }

  function px(x) { return MAZE_X + x * TILE; }
  function py(y) { return MAZE_Y + y * TILE; }

  function bezel(th) {
    const sid = G.season ? G.season.id : '';
    return K.sprite('bezel:' + th.rim + th.accent + sid, MAZE_W + 44, MAZE_H + 30, (g, w, h) => {
      const x = 8, y = 4, bw = w - 16, bh = h - 8;
      g.fillStyle = K.rgba(th.glow, 0.25);
      K.roundRect(g, x - 6, y - 4, bw + 12, bh + 8, 22);
      g.fill();
      const gr = g.createLinearGradient(0, y, 0, y + bh);
      gr.addColorStop(0, '#2a2a40');
      gr.addColorStop(0.5, '#10101c');
      gr.addColorStop(1, '#1e1e30');
      g.fillStyle = gr;
      K.roundRect(g, x, y, bw, bh, 16);
      g.fill();
      g.strokeStyle = th.rim;
      g.lineWidth = 2.5;
      g.stroke();
      g.strokeStyle = K.rgba(th.accent, 0.6);
      g.lineWidth = 1;
      K.roundRect(g, x + 5, y + 4, bw - 10, bh - 8, 12);
      g.stroke();
      /* rivets */
      g.fillStyle = K.rgba(th.rim, 0.8);
      for (const cx of [x + 8, x + bw - 8]) for (const cy of [y + 8, y + bh - 8]) { g.beginPath(); g.arc(cx, cy, 2.2, 0, TAU); g.fill(); }
      seasonTrim(g, x, y, bw, sid);
    });
  }

  function seasonTrim(g, x, y, w, sid) {
    const rng = NS.rng.makeRng(7);
    if (sid === 'winter' || sid === 'yearend') {
      g.fillStyle = '#f4faff';
      g.beginPath();
      g.moveTo(x + 10, y + 3);
      for (let i = 0; i <= 40; ++i) g.lineTo(x + 10 + i * (w - 20) / 40, y - 2 - rng() * 6);
      g.lineTo(x + w - 10, y + 3);
      g.closePath();
      g.fill();
      if (sid === 'yearend') {
        const cols = ['#ff3a5a', '#ffd23a', '#3ad8ff', '#5aff9a'];
        for (let i = 0; i < 24; ++i) { g.fillStyle = cols[i % 4]; g.beginPath(); g.arc(x + 20 + i * (w - 40) / 23, y + 8, 2.6, 0, TAU); g.fill(); }
      }
    } else if (sid === 'halloween') {
      g.strokeStyle = 'rgba(240,240,255,0.5)'; g.lineWidth = 0.8;
      for (let r = 8; r < 40; r += 8) { g.beginPath(); g.arc(x + 4, y + 4, r, 0, Math.PI / 2); g.stroke(); }
    } else if (sid === 'spring') {
      for (let i = 0; i < 14; ++i) { g.fillStyle = ['#ffb0d8', '#fff07a', '#ffffff'][i % 3]; g.beginPath(); g.arc(x + 20 + i * (w - 40) / 13, y + 1, 3.4, 0, TAU); g.fill(); }
    } else if (sid === 'autumn') {
      for (let i = 0; i < 18; ++i) { g.fillStyle = ['#ff8a2a', '#e8502a', '#ffc04a'][i % 3]; g.beginPath(); g.ellipse(x + 16 + i * (w - 32) / 17, y + 1, 5, 2.6, i, 0, TAU); g.fill(); }
    }
  }

  function dots(lvl, th) {
    const m = lvl.maze;
    const dot = MA.dot(th.dot);
    const pel = MA.pellet(th.dot);
    const t = G.time;
    const a0 = ctx.globalAlpha;
    for (let i = 0; i < m.dots.length; ++i) {
      const d = m.dots[i];
      if (!d) continue;
      const x = MAZE_X + (i % COLS) * TILE + TILE / 2, y = MAZE_Y + Math.floor(i / COLS) * TILE + TILE / 2;
      if (d === D_DOT) ctx.drawImage(dot.canvas, x - 6, y - 6, 12, 12);
      else {
        const pulse = 0.85 + Math.sin(t * 7) * 0.15;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a0 * (0.5 + Math.sin(t * 7) * 0.2);
        K.blit(ctx, K.glow(th.glow), x, y, 0.75 * pulse);
        ctx.globalAlpha = a0;
        ctx.globalCompositeOperation = 'source-over';
        K.blit(ctx, pel, x, y, pulse * 0.95);
      }
    }
  }

  function features(lvl, th) {
    const m = lvl.maze;
    if (!lvl.features.length) return;
    const t = G.time;
    for (let i = 0; i < m.feat.length; ++i) {
      const f = m.feat[i];
      if (f !== C.F_PORTAL && f !== C.F_VENT) continue;
      const tx = i % COLS, ty = Math.floor(i / COLS);
      const x = px(tx + 0.5), y = py(ty + 0.5);
      if (f === C.F_PORTAL) {
        ctx.globalCompositeOperation = 'lighter';
        K.blit(ctx, K.glow('#9a5aff'), x, y, 0.6 + Math.sin(t * 4 + i) * 0.08);
        ctx.strokeStyle = '#d0b0ff';
        ctx.lineWidth = 2;
        for (let k = 0; k < 3; ++k) {
          ctx.beginPath();
          ctx.arc(x, y, 4 + k * 3, t * (3 + k) + k * 2, t * (3 + k) + k * 2 + 2.2);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const st = NS.hazards.ventState(lvl, tx, ty);
        if (st === 'idle') continue;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = st === 'fire' ? 1 : 0.4 + Math.sin(t * 20) * 0.3;
        K.blit(ctx, K.glow(st === 'fire' ? '#ff9a2a' : '#ff3a1a'), x, y, st === 'fire' ? 1.1 : 0.55);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  function items(lvl) {
    const t = G.time;
    for (let i = 0; i < lvl.items.length; ++i) {
      const it = lvl.items[i];
      const left = it.life - it.t;
      if (left < 3 && Math.floor(t * 8) % 2 === 0) continue;
      const pop = Math.min(1, it.t * 4);
      const x = px(it.x), y = py(it.y) + Math.sin(t * 4 + i) * 2.5;
      let spr, col;
      if (it.kind === 'power') { col = POWERUP_BY_ID[it.id].color; spr = IA.capsule(it.id, col); }
      else if (it.kind === 'fruit') { col = '#ffffff'; spr = IA.fruit(it.id); }
      else { col = G.season ? G.season.color : '#ffffff'; spr = IA.token(it.id); }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      K.blit(ctx, K.glow(col), x, y, 0.9 + Math.sin(t * 5) * 0.1);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blit(ctx, spr, x, y, 0.62 * NS.rng.easeBack(pop));
    }
  }

  function shadow(x, y, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 9, w, w * 0.32, 0, 0, TAU);
    ctx.fill();
  }

  function ghosts(lvl) {
    const t = G.time;
    for (let i = 0; i < lvl.ghosts.length; ++i) {
      const g = lvl.ghosts[i];
      const x = px(g.x), y = py(g.y) + (g.mode === 'house' ? Math.sin(g.bob * 5) * 2.5 : 0);
      const fr = Math.floor(t * 7 + i) % 2;
      const scale = 0.82;
      if (g.mode === 'eyes' || g.mode === 'entering') {
        K.blit(ctx, AA.eyes(Math.max(0, g.dir)), x, y - 3, scale);
        continue;
      }
      shadow(x, y, 9);
      const sq = g.squash > 0 ? Math.sin(g.squash * Math.PI) * 0.18 : 0;
      const sx = scale * (1 + sq), sy = scale * (1 - sq);
      if (g.dash > 0) {
        ctx.globalAlpha = 0.25;
        for (let k = 1; k <= 3; ++k)
          K.blitEx(ctx, AA.ghost(g.color, g.kind, fr), x - C.DX[g.dir] * k * 7, y - 3 - C.DY[g.dir] * k * 7, 0, sx, sy);
        ctx.globalAlpha = 1;
      }
      if (g.kind === 'phantom') ctx.globalAlpha = 0.72 + Math.sin(t * 3 + i) * 0.12;
      if (g.scared) {
        const white = lvl.frightT < 2 && Math.floor(t * 5) % 2 === 0;
        K.blitEx(ctx, AA.scared(fr, white), x, y - 3, 0, sx, sy);
      } else {
        K.blitEx(ctx, AA.ghost(g.color, g.kind, fr), x, y - 3, 0, sx, sy);
        K.blitEx(ctx, AA.eyes(Math.max(0, g.dir)), x, y - 3, 0, sx, sy);
      }
      ctx.globalAlpha = 1;
      if (lvl.effects.freeze > 0 && g.mode !== 'house') K.blit(ctx, AA.ice(), x, y - 3, scale);
      if (g.stun > 0) {
        for (let k = 0; k < 3; ++k) {
          const a = t * 6 + k * TAU / 3;
          ctx.fillStyle = '#ffe23a';
          K.starPath(ctx, x + Math.cos(a) * 10, y - 16 + Math.sin(a) * 3, 3.2, 0.45, 5);
          ctx.fill();
        }
      }
    }
  }

  function boss(lvl) {
    const b = lvl.boss;
    if (!b) return;
    const t = G.time;
    const x = px(b.x), y = py(b.y) + Math.sin(b.bob * 3) * 4;
    const def = NS.worlds.BOSSES[b.id];
    if (b.state === 'tele') {
      ctx.strokeStyle = K.rgba('#ff3a3a', 0.4 + Math.sin(t * 30) * 0.3);
      ctx.lineWidth = 6;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(px(b.tx), py(b.ty)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = 'lighter';
      K.blit(ctx, K.ringSprite('#ff3a3a'), px(b.tx), py(b.ty), 0.5 + Math.sin(t * 20) * 0.1);
      ctx.globalCompositeOperation = 'source-over';
    }
    const powered = b.vuln && (lvl.frightT > 0 || lvl.effects.mega > 0);
    const mode = b.flash > 0 && Math.floor(t * 20) % 2 === 0 ? 'flash' : powered ? 'scared' : 'normal';
    const sc = (b.size * TILE) / 84;
    const sq = b.squash > 0 ? Math.sin(b.squash * Math.PI) * 0.12 : 0;
    ctx.globalAlpha = b.alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = b.alpha * 0.5;
    K.blit(ctx, K.glow(powered ? '#4a6aff' : def.color), x, y, b.size * 1.3);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = b.alpha * (b.state === 'dying' ? 0.6 + Math.sin(t * 40) * 0.4 : 1);
    K.blitEx(ctx, AA.boss(b.id, mode), x, y, Math.sin(b.bob * 2) * 0.05, sc * (1 + sq) * b.face, sc * (1 - sq));
    ctx.globalAlpha = 1;
  }

  function pac(lvl, run) {
    const p = lvl.pac;
    const x = px(p.x), y = py(p.y);
    const skin = run.demo ? 'classic' : G.profile.skin;
    if (lvl.phase === 'dying') {
      AA.drawDeath(ctx, x, y, p.deathT, skin, 1);
      return;
    }
    if (p.grace > 0 && Math.floor(G.time * 12) % 2 === 0) return;
    const mega = lvl.effects.mega > 0;
    const base = 0.68 * (mega ? 1.75 : 1);
    const sq = p.squash > 0 ? Math.sin(p.squash * Math.PI) * 0.22 : 0;
    const face = p.face;
    const ang = face === 1 ? -Math.PI / 2 : face === 3 ? Math.PI / 2 : 0;
    const flip = face === 0 ? -1 : 1;
    const spr = AA.pac(skin, lvl.phase === 'ready' ? 2 : AA.mouthIndex(p.mouth));
    shadow(x, y, mega ? 16 : 9);
    if (lvl.effects.speed > 0 || p.padT > 0) {
      ctx.globalAlpha = 0.22;
      for (let k = 1; k <= 3; ++k) K.blitEx(ctx, spr, x - C.DX[face] * k * 6, y - C.DY[face] * k * 6, ang, base * flip, base);
      ctx.globalAlpha = 1;
    }
    if (lvl.effects.phase > 0) ctx.globalAlpha = 0.55;
    if (mega) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4;
      K.blit(ctx, K.glow('#ffd23a'), x, y, 1.6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    K.blitEx(ctx, spr, x, y, ang, base * flip * (1 + sq), base * (1 - sq * 0.7));
    ctx.globalAlpha = 1;
    if (lvl.effects.shield > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(G.time * 6) * 0.1;
      K.blit(ctx, K.halo('#5affc8'), x, y, 0.75);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = K.rgba('#c8fff0', 0.7);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function decoy(lvl, run) {
    const d = lvl.decoy;
    if (!d) return;
    const skin = run.demo ? 'classic' : G.profile.skin;
    ctx.globalAlpha = 0.45 + Math.sin(G.time * 10) * 0.2;
    K.blitEx(ctx, AA.pac(skin, AA.mouthIndex(G.time * 8)), px(d.x), py(d.y), 0, 0.68 * (d.face === 0 ? -1 : 1), 0.68);
    ctx.globalAlpha = 1;
  }

  function shots(lvl) {
    if (!lvl.shots.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < lvl.shots.length; ++i) {
      const s = lvl.shots[i];
      const x = px(s.x), y = py(s.y);
      if (s.owner === 'pac') K.blit(ctx, K.glow('#ff8a4a'), x, y, 0.4);
      else {
        K.blit(ctx, K.glow('#8af0ff'), x, y, 0.5);
        ctx.fillStyle = '#e8faff';
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.atan2(s.vy, s.vx));
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(0, 3.5); ctx.lineTo(-8, 0); ctx.lineTo(0, -3.5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function puddles(lvl) {
    for (let i = 0; i < lvl.puddles.length; ++i) {
      const p = lvl.puddles[i];
      const k = Math.min(1, p.t * 3, (p.life - p.t) / 1.5);
      ctx.globalAlpha = 0.75 * k;
      ctx.fillStyle = '#ff6ad0';
      ctx.beginPath(); ctx.ellipse(px(p.x), py(p.y), 18 * k, 12 * k, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(px(p.x) - 5, py(p.y) - 3, 5 * k, 2.5 * k, -0.3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* a soft disc of light: full in the middle, fading at the rim */
  function lightSprite() {
    return K.sprite('light', 64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    }, 1);
  }

  /* the woods' darkness: a black veil with holes where light falls */
  let dark = null;
  function darkness(lvl, th) {
    if (!dark) dark = K.makeCanvas(MAZE_W / 2, MAZE_H / 2);
    const g = dark.getContext('2d');
    g.setTransform(0.5, 0, 0, 0.5, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(2,0,10,0.74)';
    g.fillRect(0, 0, MAZE_W, MAZE_H);
    g.globalCompositeOperation = 'destination-out';
    const lightR = (lvl.effects.mega > 0 ? 8.5 : 6.5) + Math.sin(G.time * 3) * 0.25;
    const p = lvl.pac;
    const L = lightSprite();
    g.drawImage(L.canvas, p.x * TILE - lightR * TILE, p.y * TILE - lightR * TILE, lightR * TILE * 2, lightR * TILE * 2);
    const m = lvl.maze;
    for (let i = 0; i < m.dots.length; ++i) {
      if (m.dots[i] !== D_POWER) continue;
      const x = (i % COLS + 0.5) * TILE, y = (Math.floor(i / COLS) + 0.5) * TILE;
      g.drawImage(L.canvas, x - 30, y - 30, 60, 60);
    }
    for (let i = 0; i < lvl.items.length; ++i) g.drawImage(L.canvas, lvl.items[i].x * TILE - 26, lvl.items[i].y * TILE - 26, 52, 52);
    for (let i = 0; i < lvl.ghosts.length; ++i) {
      const gh = lvl.ghosts[i];
      if (gh.mode === 'eyes' || gh.mode === 'entering') g.drawImage(L.canvas, gh.x * TILE - 14, gh.y * TILE - 14, 28, 28);
    }
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(dark, MAZE_X, MAZE_Y, MAZE_W, MAZE_H);
    /* glowing eyes in the dark */
    for (let i = 0; i < lvl.ghosts.length; ++i) {
      const gh = lvl.ghosts[i];
      if (gh.mode !== 'out' || gh.scared) continue;
      const d2 = NS.grid.dist2(gh.x, gh.y, p.x, p.y);
      if (d2 < lightR * lightR * 0.6) continue;
      ctx.globalAlpha = 0.85;
      K.blit(ctx, AA.eyes(Math.max(0, gh.dir)), px(gh.x), py(gh.y) - 3, 0.82);
      ctx.globalAlpha = 1;
    }
  }

  function draw() {
    const run = G.run;
    const th = theme();
    NS.backdrop.draw(ctx, th, null);
    if (!run || !run.lvl) return;
    const lvl = run.lvl;
    ctx.save();
    ctx.translate(FX.shake.x, FX.shake.y);
    K.blit(ctx, bezel(th), MAZE_X + MAZE_W / 2, MAZE_Y + MAZE_H / 2, 1);
    const mz = MA.get(lvl.maze, th, (run.demo ? 'd' : 'r') + lvl.world + (run.n || 0) + run.stage);
    ctx.drawImage(mz, MAZE_X, MAZE_Y, MAZE_W, MAZE_H);
    if (lvl.phase === 'clear' && Math.floor(lvl.phaseT * 6) % 2 === 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45;
      ctx.drawImage(mz, MAZE_X, MAZE_Y, MAZE_W, MAZE_H);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(MAZE_X - 6, MAZE_Y - 6, MAZE_W + 12, MAZE_H + 12);
    ctx.clip();
    features(lvl, th);
    puddles(lvl);
    dots(lvl, th);
    items(lvl);
    decoy(lvl, run);
    ghosts(lvl);
    pac(lvl, run);
    shots(lvl);
    boss(lvl);
    if (lvl.dark) {
      darkness(lvl, th);
      /* the dots still glimmer faintly through the dark */
      ctx.globalAlpha = 0.28;
      dots(lvl, th);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    NS.fxRender.draw();
    ctx.restore();
  }

  Object.assign(NS.world, {
    draw, theme, px, py
  });
})();
