/* ui/cinematics.js -- world-map travel, map fly-over intros, outros and reward reveals.
   Owns state: G.cine
   Reads: constants, towerTypes, enemyTypes, maps, env, pixelArt, artKit, layout, text, widgets, bossRewards,
      terrain, towerArt, enemyArt, paths, waves and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { makeRng, TWO_PI, WORLD_W, WORLD_H, clamp, parseHex, hexToRgba, shade } = NS.constants;
  const { TOWER_BY_ID } = NS.towerTypes;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { BIOMES, BIOME_ORDER, MAPS, CAMPAIGN, MAP_RANK, REGIONS, nextMapOf, regionOf } = NS.maps;
  const { ctx, audio } = NS.env;
  const { makeCanvas, drawIcon } = NS.pixelArt;
  const { RAMPS, fbm, rampPick, drawGlow } = NS.artKit;
  const { view } = NS.layout;
  const { fitText, drawTextBlock } = NS.text;
  const { UI, drawPanel, drawKeyHints, drawHeadline, drawScrim } = NS.widgets;
  const { RELIC_BY_ID } = NS.bossRewards;
  const { TERRAIN, propArt } = NS.terrain;
  const { drawTowerIcon } = NS.towerArt;
  const { drawEnemyIcon } = NS.enemyArt;
  const { pathPos } = NS.paths;
  const { parseToken, generateWave, summarizeWave } = NS.waves;

  const cineQueue = [];

  function startCine(kind, data, done) {
    const durs = { travel: 4.6, intro: 4.2, outro: 3.0, reward: 4.0 };
    const c = { kind, t: 0, dur: durs[kind] || 3, data: data || {}, done };
    if (G.cine) cineQueue.push(c);
    else G.cine = c;
    if (kind === 'travel') audio.play('whoosh', { pitch: 0.6, volume: 0.6 });
    if (kind === 'intro') audio.play('select', { pitch: 0.6 });
  }

  function finishCine(skipped) {
    const c = G.cine;
    G.cine = null;
    if (c && c.done) c.done(skipped);
    // Skipping one moment skips the chained ones too (travel -> intro), but not rewards
    while (cineQueue.length) {
      const n = cineQueue.shift();
      if (!skipped || n.kind === 'reward') {
        G.cine = n;
        break;
      }
      if (n.done) n.done(true);
    }
  }

  function skipCine() {
    if (!G.cine) return;
    audio.play('click', { pitch: 0.7 });
    finishCine(true);
  }

  function updateCine(dt) {
    if (!G.cine) return;
    const prev = G.cine.t;
    G.cine.t += dt;
    if (G.cine.kind === 'reward' && prev < 0.55 && G.cine.t >= 0.55)
      audio.play(G.cine.data.kind === 'tower' ? 'levelup' : 'powerup', { pitch: G.cine.data.kind === 'tower' ? 1 : 1.2 });
    if (G.cine.kind === 'outro' && prev < 0.4 && G.cine.t >= 0.4)
      audio.play('win');
    if (G.cine.kind === 'travel' && prev < 3.1 && G.cine.t >= 3.1)
      audio.play('lineClear', { pitch: 0.8 });
    if (G.cine.t >= G.cine.dur) finishCine(false);
  }

  function queueReward(r) {
    startCine('reward', r);
  }

  const ease = (v) => v < 0.5 ? 2 * v * v : 1 - Math.pow(-2 * v + 2, 2) / 2;

  /* ── Camera for the intro and outro: world point, zoom ── */
  function cineCamera() {
    if (!G.cine) return null;
    const c = G.cine, t = c.t;
    if (c.kind === 'intro') {
      const p = G.paths[0];
      if (!p) return null;
      const fly = clamp((t - 0.4) / 2.6, 0, 1);
      const out = clamp((t - 3.1) / 0.8, 0, 1);
      const q = pathPos(p, p.total * ease(fly), { x: 0, y: 0, angle: 0 });
      const z = 2.1 - 1.1 * ease(out);
      return { x: q.x + (WORLD_W / 2 - q.x) * ease(out), y: q.y + (WORLD_H / 2 - q.y) * ease(out), z };
    }
    if (c.kind === 'outro') {
      const p = G.paths[0];
      const e = p.pts[p.pts.length - 2] || p.pts[p.pts.length - 1];
      const k = t < 0.5 ? ease(t / 0.5) : t > c.dur - 0.5 ? ease((c.dur - t) / 0.5) : 1;
      return { x: WORLD_W / 2 + (e.x - WORLD_W / 2) * k, y: WORLD_H / 2 + (e.y - WORLD_H / 2) * k, z: 1 + 0.7 * k };
    }
    return null;
  }

  // Temporarily swap the view for the camera while the world is drawn
  function withCineView(draw) {
    const cam = cineCamera();
    if (!cam) {
      draw();
      return;
    }
    const sx = view.x, sy = view.y, ss = view.s;
    const cx = view.x + WORLD_W * view.s / 2, cy = view.y + WORLD_H * view.s / 2;
    // Keep the zoomed view inside the battlefield
    const hw = WORLD_W / (2 * cam.z), hh = WORLD_H / (2 * cam.z);
    const camX = clamp(cam.x, hw, WORLD_W - hw), camY = clamp(cam.y, hh, WORLD_H - hh);
    view.s = ss * cam.z;
    view.x = cx - camX * view.s;
    view.y = cy - camY * view.s;
    ctx.save();
    ctx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    ctx.beginPath();
    ctx.rect(sx, sy, WORLD_W * ss, WORLD_H * ss);
    ctx.clip();
    draw();
    ctx.restore();
    view.x = sx; view.y = sy; view.s = ss;
  }

  /* ── World map: one band per region from west to east, a keep per map ── */
  const WORLD_ART_W = 100 * REGIONS.length, WORLD_ART_H = 240;
  // Heights of the keeps along the route, repeated as the campaign goes on
  const SPOT_Y = [0.7, 0.38, 0.66, 0.32, 0.62, 0.3, 0.56, 0.28, 0.62, 0.38, 0.7, 0.36];
  let worldArt = null;

  // Spot of a map (by index): inside its region's band, in campaign order
  function spotPx(i) {
    const reg = regionOf(i), maps = REGIONS[reg].maps, k = maps.indexOf(i);
    const fx = (reg + 0.22 + 0.56 * (maps.length > 1 ? k / (maps.length - 1) : 0.5)) / REGIONS.length;
    return { x: fx * WORLD_ART_W, y: SPOT_Y[MAP_RANK[i] % SPOT_Y.length] * WORLD_ART_H };
  }

  // Route between two spots: a gentle curve through an offset midpoint
  function routePoint(a, b, k) {
    const pa = spotPx(a), pb = spotPx(b);
    const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2 - 18 + (MAP_RANK[a] % 2) * 36;
    const u = 1 - k;
    return { x: u * u * pa.x + 2 * u * k * mx + k * k * pb.x, y: u * u * pa.y + 2 * u * k * my + k * k * pb.y };
  }

  function buildWorldArt() {
    const W = WORLD_ART_W, H = WORLD_ART_H;
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const seed = 4242;
    for (let y = 0; y < H; ++y)
      for (let x = 0; x < W; ++x) {
        const n = fbm(x / 22, y / 22, seed);
        const bf = x / W * REGIONS.length + (n - 0.5) * 0.6;
        const bi = clamp(Math.floor(bf), 0, REGIONS.length - 1);
        const T = TERRAIN[BIOME_ORDER[bi]];
        // Sea around the edges of the continent
        const edge = Math.min(x, W - 1 - x, y * 1.4, (H - 1 - y) * 1.4) + (fbm(x / 9, y / 9, seed + 3) - 0.5) * 26;
        let col;
        if (edge < 6) col = rampPick(RAMPS.water, 0.3 + (edge / 6) * 0.35, x, y, 0, 3);
        else if (edge < 8) col = '#e8d8a8';
        else {
          col = rampPick(T.ground, 0.2 + n * 0.7, x, y, 1, 4);
          // Mountain ridges between the biomes
          if (Math.abs(bf - Math.round(bf)) < 0.03 && bf > 0.5 && bf < REGIONS.length - 0.5) col = shade(T.ground[2], -0.35);
        }
        const rgb = parseHex(col);
        const i = (y * W + x) * 4;
        img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    // Scattered biome props
    const rng = makeRng(seed);
    for (let i = 0; i < 35 * REGIONS.length; ++i) {
      const x = 12 + rng() * (W - 24), y = 12 + rng() * (H - 24);
      const bi = clamp(Math.floor(x / W * REGIONS.length), 0, REGIONS.length - 1);
      const T = TERRAIN[BIOME_ORDER[bi]];
      const art = propArt(rng() < 0.6 ? T.tree : T.boulder);
      g.drawImage(art, Math.round(x - art.width / 4), Math.round(y - art.height / 2), Math.round(art.width / 2), Math.round(art.height / 2));
    }
    // Dotted route
    g.fillStyle = 'rgba(60,40,20,0.75)';
    for (let r = 0; r < CAMPAIGN.length - 1; ++r)
      for (let k = 0; k <= 1; k += 0.05) {
        const p = routePoint(CAMPAIGN[r], CAMPAIGN[r + 1], k);
        g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }
    return c;
  }

  function drawKeepMarker(x, y, s, lit, flagUp) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x - 7 * s, y + 3 * s, 14 * s, 2 * s);
    ctx.fillStyle = lit ? '#c8c8d8' : '#7a7a8a';
    ctx.fillRect(x - 6 * s, y - 6 * s, 12 * s, 9 * s);
    ctx.fillRect(x - 7 * s, y - 9 * s, 3 * s, 3 * s);
    ctx.fillRect(x - 1.5 * s, y - 9 * s, 3 * s, 3 * s);
    ctx.fillRect(x + 4 * s, y - 9 * s, 3 * s, 3 * s);
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(x - 1.5 * s, y - 2 * s, 3 * s, 5 * s);
    // Flag on a pole, raised by flagUp (0..1)
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(x + 6 * s, y - 16 * s, 1 * s, 10 * s);
    if (flagUp > 0) {
      ctx.fillStyle = '#c8303a';
      const fy = y - 16 * s + (1 - flagUp) * 7 * s;
      ctx.fillRect(x + 7 * s, fy, 6 * s, 3.5 * s);
    }
  }

  function drawTravel() {
    const c = G.cine, t = c.t;
    const from = c.data.from, to = c.data.to;
    if (!worldArt) worldArt = buildWorldArt();
    // Camera: starts on the old keep, follows the banner, settles on the new keep
    const move = ease(clamp((t - 1.1) / 1.9, 0, 1));
    const tok = routePoint(from, to, move);
    const zoom = 1.7 + 0.25 * Math.sin(clamp((t - 1.1) / 1.9, 0, 1) * Math.PI);
    const base = Math.max(G.UW / WORLD_ART_W, G.UH / WORLD_ART_H) * 1.02;
    const s = base * zoom;
    const ox = clamp(G.UW / 2 - tok.x * s, G.UW - WORLD_ART_W * s, 0);
    const oy = clamp(G.UH / 2 - tok.y * s, G.UH - WORLD_ART_H * s, 0);
    ctx.fillStyle = '#0a0e1a';
    ctx.fillRect(-20, -20, G.UW + 40, G.UH + 40);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(worldArt, 0, 0);
    // Keeps of all maps: cleared ones fly a banner
    for (let i = 0; i < MAPS.length; ++i) {
      const p = spotPx(i);
      const isFrom = i === from, isTo = i === to;
      let flag = G.meta.maps[i].stars > 0 ? 1 : 0;
      if (isFrom) flag = 1 - clamp((t - 0.5) / 0.6, 0, 1);
      if (isTo) flag = clamp((t - 3.1) / 0.5, 0, 1);
      if (isTo && t > 3.0) {
        const k = clamp((t - 3.0) / 0.4, 0, 1);
        drawGlow(BIOMES[MAPS[to].biome].color, p.x, p.y - 3, 22 * k, 0.6 * k);
        // Rays
        ctx.save();
        ctx.translate(p.x, p.y - 3);
        ctx.rotate(G.animTime * 0.6);
        ctx.fillStyle = hexToRgba('#fff2c0', 0.25 * k);
        for (let r = 0; r < 8; ++r) {
          ctx.rotate(Math.PI / 4);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(28 * k, -3); ctx.lineTo(28 * k, 3); ctx.fill();
        }
        ctx.restore();
      }
      drawKeepMarker(p.x, p.y, 0.55, isFrom || isTo || G.meta.maps[i].stars > 0, flag);
    }
    // The travelling banner bearer with a trail of dust
    if (t > 1.0) {
      const bob = Math.abs(Math.sin(t * 14)) * 1.2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(tok.x - 3, tok.y + 1, 6, 1.5);
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(tok.x, tok.y - 11 - bob, 0.8, 11);
      ctx.fillStyle = '#ffd75a';
      const wave = Math.sin(t * 9) * 0.8;
      ctx.beginPath(); ctx.moveTo(tok.x + 0.8, tok.y - 11 - bob); ctx.lineTo(tok.x + 7 + wave, tok.y - 9.5 - bob); ctx.lineTo(tok.x + 0.8, tok.y - 7.5 - bob); ctx.fill();
      ctx.fillStyle = '#3a4a7a';
      ctx.fillRect(tok.x - 2, tok.y - 4 - bob, 3, 4);
      ctx.fillStyle = '#e8c8a0';
      ctx.fillRect(tok.x - 1.5, tok.y - 6 - bob, 2, 2);
      if (t < 3.0) {
        for (let i = 1; i <= 5; ++i) {
          const q = routePoint(from, to, Math.max(0, move - i * 0.03));
          ctx.fillStyle = `rgba(230,210,170,${0.4 - i * 0.07})`;
          ctx.fillRect(q.x - 1, q.y, 2, 1);
        }
      }
    }
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
    // Captions
    const cap = (title, sub, color, a) => {
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      const w = Math.min(520, G.UW - 40);
      const x = G.UW / 2 - w / 2, y = G.UH - 120;
      drawPanel(x, y, w, 70, { accent: color, radius: 12 });
      drawHeadline(title, G.UW / 2, y + 28, w - 40, 26, color, shade(color, -0.4));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitText(sub, G.UW / 2, y + 54, w - 40, 13, { color: '#e4eaf6', weight: 'bold' });
      ctx.restore();
    };
    const fade = (a, b) => clamp((t - a) / 0.3, 0, 1) * clamp((b - t) / 0.3, 0, 1);
    cap(`Leaving ${MAPS[from].name}`, 'The garrison packs up and marches on', UI.gold, fade(0.3, 1.5));
    const nb = BIOMES[MAPS[to].biome];
    const newBiome = MAPS[from].biome !== MAPS[to].biome;
    cap(newBiome ? `Entering ${nb.name}` : MAPS[to].name, newBiome ? `${nb.desc} Next: ${MAPS[to].name}.` : `${MAPS[to].waves} waves to clear · better pay ahead`, nb.color, fade(3.0, c.dur));
    // Fade in from and out to black
    const black = Math.max(clamp(1 - t / 0.4, 0, 1), clamp((t - (c.dur - 0.35)) / 0.35, 0, 1));
    if (black > 0) {
      ctx.fillStyle = `rgba(4,6,12,${black})`;
      ctx.fillRect(-20, -20, G.UW + 40, G.UH + 40);
    }
    drawSkipHint();
  }

  /* ── Map intro: fly along the road, then the briefing card ── */
  function drawIntroOverlay() {
    const c = G.cine, t = c.t;
    const k = clamp(t / 0.4, 0, 1) * clamp((c.dur - t) / 0.5, 0, 1);
    const top = view.y / G.uiS, bottom = (view.y + WORLD_H * view.s) / G.uiS;
    const bar = 36 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, top - 2, G.UW, bar);
    ctx.fillRect(0, bottom - bar + 2, G.UW, bar);
    const m = MAPS[G.currentMap], b = BIOMES[m.biome];
    ctx.save();
    ctx.globalAlpha = clamp((t - 0.3) / 0.4, 0, 1) * clamp((c.dur - t) / 0.5, 0, 1);
    drawHeadline(m.name.toUpperCase(), G.UW / 2, top + 70, G.UW - 60, 44, b.color, shade(b.color, -0.45));
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(`${b.name} · hold ${m.waves} waves · ${G.paths.length > 1 ? G.paths.length + ' roads' : 'one road'}`, G.UW / 2, top + 104, G.UW - 60, 15, { weight: 'bold', color: '#ffffff', outline: 'rgba(0,0,0,0.8)' });
    // Briefing: first wave and the bosses of this map
    const w = Math.min(560, G.UW - 40), h = 84;
    const x = G.UW / 2 - w / 2, y = bottom - 36 - h - 12;
    drawPanel(x, y, w, h, { accent: b.color, radius: 10 });
    ctx.textAlign = 'left';
    fitText('First wave', x + 14, y + 16, 120, 11, { weight: 'bold', color: UI.textDim });
    const first = summarizeWave(generateWave(1));
    first.slice(0, 4).forEach((r, i) => {
      drawEnemyIcon(r.type, x + 30 + i * 46, y + 44, 26);
      ctx.textAlign = 'center';
      fitText(`×${r.count}`, x + 30 + i * 46, y + 68, 40, 11, { weight: 'bold', color: UI.text });
    });
    const bosses = [];
    for (let wv = 5; wv <= m.waves; wv += 5) {
      for (const tok of generateWave(wv)) {
        const p = parseToken(tok);
        if (p && ENEMY_TYPES[p.type].boss && bosses.indexOf(p.type) < 0) bosses.push(p.type);
      }
    }
    if (m.waves % 5) for (const tok of generateWave(m.waves)) { const p = parseToken(tok); if (p && ENEMY_TYPES[p.type].boss && bosses.indexOf(p.type) < 0) bosses.push(p.type); }
    ctx.textAlign = 'left';
    fitText('Bosses', x + w / 2 + 10, y + 16, 120, 11, { weight: 'bold', color: '#ff8a8a' });
    bosses.slice(0, 4).forEach((type, i) => {
      const bx = x + w / 2 + 30 + i * 60;
      drawEnemyIcon(type, bx, y + 44, 30);
      ctx.textAlign = 'center';
      fitText(ENEMY_TYPES[type].name, bx, y + 70, 58, 9, { weight: 'bold', color: '#ffd0d0' });
    });
    ctx.restore();
    drawSkipHint();
  }

  /* ── Cleared map outro ── */
  function drawOutroOverlay() {
    const c = G.cine, t = c.t;
    const a = clamp(t / 0.3, 0, 1) * clamp((c.dur - t) / 0.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    const cy = G.UH * 0.32;
    drawGlow('#ffd75a', G.UW / 2, cy, 220, 0.25);
    ctx.save();
    ctx.translate(G.UW / 2, cy);
    ctx.rotate(G.animTime * 0.3);
    ctx.fillStyle = 'rgba(255,236,170,0.12)';
    for (let r = 0; r < 12; ++r) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(G.UW, -40); ctx.lineTo(G.UW, 40); ctx.fill();
    }
    ctx.restore();
    drawHeadline('MAP CLEARED', G.UW / 2, cy, G.UW - 60, 60, UI.gold, '#ff9a2a');
    const stars = (G.lastResult && G.lastResult.stars) || 0;
    for (let i = 0; i < 3; ++i) {
      const k = clamp((t - 0.5 - i * 0.3) / 0.25, 0, 1);
      const earned = i < stars;
      const s = earned ? 40 * (k < 1 ? 0.4 + 0.9 * Math.sin(k * Math.PI * 0.75) : 1) : 34;
      drawIcon(earned && k > 0 ? 'star' : 'starEmpty', G.UW / 2 + (i - 1) * 54, cy + 60, s);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const next = nextMapOf(G.currentMap) >= 0 ? `Next level open (L) · or stay and keep holding` : 'The last map is held · stay as long as you can';
    fitText(`+${G.lastRp} research · ${next}`, G.UW / 2, cy + 100, G.UW - 60, 15, { weight: 'bold', color: '#ffffff', outline: 'rgba(0,0,0,0.8)' });
    ctx.restore();
    drawSkipHint();
  }

  /* ── Boss reward reveal ── */
  function drawRewardReveal() {
    const c = G.cine, t = c.t, r = c.data;
    const a = clamp(t / 0.3, 0, 1) * clamp((c.dur - t) / 0.4, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    drawScrim(0.7);
    const cx = G.UW / 2, cy = G.UH * 0.42;
    const color = r.kind === 'tower' ? TOWER_BY_ID[r.fam].color : r.kind === 'relic' ? RELIC_BY_ID[r.id].color : '#c890ff';
    const pop = clamp((t - 0.45) / 0.35, 0, 1);
    // Rays and glow behind the prize
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(G.animTime * 0.5);
    ctx.fillStyle = hexToRgba(color, 0.18 * pop);
    for (let i = 0; i < 10; ++i) {
      ctx.rotate(TWO_PI / 10);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(220, -24); ctx.lineTo(220, 24); ctx.fill();
    }
    ctx.restore();
    drawGlow(color, cx, cy, 120 * pop, 0.5);
    // The chest bursts open first, then the prize rises out of it
    if (t < 0.6) {
      const shake = Math.sin(t * 60) * 3 * (t / 0.6);
      drawIcon('gift', cx + shake, cy + 10, 72);
    }
    const sc = pop < 1 ? 0.3 + 0.85 * Math.sin(pop * Math.PI * 0.6) : 1;
    const rise = (1 - pop) * 30;
    if (pop > 0) {
      if (r.kind === 'tower')
        drawTowerIcon(TOWER_BY_ID[r.fam].index, 3, cx, cy + rise, 110 * sc);
      else if (r.kind === 'relic')
        drawIcon(RELIC_BY_ID[r.id].icon, cx, cy + rise, 84 * sc);
      else
        drawIcon('flask', cx, cy + rise, 72 * sc);
    }
    const ta = clamp((t - 0.8) / 0.4, 0, 1);
    ctx.globalAlpha = a * ta;
    const boss = ENEMY_TYPES[r.boss] ? ENEMY_TYPES[r.boss].name : 'Boss';
    let title, sub, desc;
    if (r.kind === 'tower') {
      const def = TOWER_BY_ID[r.fam];
      title = 'NEW TOWER'; sub = def.name; desc = `${def.desc} Won from the ${boss}.`;
    } else if (r.kind === 'relic') {
      const rel = RELIC_BY_ID[r.id];
      title = 'RELIC FOUND'; sub = rel.name; desc = rel.desc;
    } else {
      title = 'TROPHY'; sub = `+${r.rp} research`; desc = 'Every relic is already yours.';
    }
    drawHeadline(title, cx, cy - 110, G.UW - 60, 40, color, shade(color, -0.45));
    const w = Math.min(460, G.UW - 40);
    drawPanel(cx - w / 2, cy + 74, w, 78, { accent: color, radius: 10 });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(sub, cx, cy + 98, w - 30, 20, { weight: 'bold', color: '#ffffff' });
    drawTextBlock(desc, cx - w / 2 + 16, cy + 112, w - 32, 34, 13, { color: '#c4cde0', align: 'center', valign: 'middle' });
    ctx.restore();
    drawSkipHint();
  }

  function drawSkipHint() {
    ctx.save();
    ctx.globalAlpha = 0.75;
    drawKeyHints([{ key: 'Any key', label: 'Skip' }], G.UW - 80, 20, 150);
    ctx.restore();
  }

  function drawCineOverlay() {
    if (!G.cine) return false;
    if (G.cine.kind === 'travel') drawTravel();
    else if (G.cine.kind === 'intro') drawIntroOverlay();
    else if (G.cine.kind === 'outro') drawOutroOverlay();
    else if (G.cine.kind === 'reward') drawRewardReveal();
    return true;
  }

  /* ══════════════════════════════════════════════════════════════════
     SCREEN SHAKE
     ══════════════════════════════════════════════════════════════════ */

  NS.cinematics = { cineQueue, startCine, skipCine, updateCine, queueReward, withCineView, drawCineOverlay };

})();
