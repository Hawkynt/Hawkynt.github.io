/* The world map: five islands over a night sea joined by a dotted route (also the map shot of
   the cinematics), each island clickable once its world is open (the previous guardian freed);
   below, the selected world's five stage cards with stars, shards, best score and lock state, and
   the card for the chosen stage with its Run button. Arrow keys move between worlds and stages.
   Draws and registers hit areas; owns the map selection in G.ui. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const kit = NS.kit;
  const K = NS.artKit;
  const W = NS.widgets;
  const scr = NS.screens;
  const { WORLDS, STAGES_PER_WORLD, stage } = NS.worlds;
  const { sfx } = NS.audio;
  const { ctx } = NS.view;

  const ISLES = [[200, 250], [430, 170], [660, 260], [880, 160], [1090, 250]];

  function worldOpen(w) {
    return w === 0 || !!G.save.bosses[WORLDS[w - 1].boss];
  }

  function stageOpen(w, s) {
    if (!worldOpen(w)) return false;
    return s === 0 || !!G.save.cleared[stage(w, s - 1).id];
  }

  function island(i, x, y, hi) {
    const Wd = WORLDS[i];
    const t = G.time;
    if (hi) {
      ctx.globalCompositeOperation = 'lighter';
      K.blitAlpha(ctx, K.glow(Wd.accent), x, y, 4.5, 0.45 + 0.15 * Math.sin(t * 3));
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(x + 6, y + 30, 100, 34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = Wd.ground[2];
    ctx.beginPath(); ctx.ellipse(x, y + 18, 96, 34, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = Wd.ground[0];
    ctx.beginPath(); ctx.ellipse(x, y + 8, 92, 28, 0, 0, TAU); ctx.fill();
    /* a landmark per world */
    ctx.fillStyle = Wd.near;
    if (i === 0) { ctx.beginPath(); ctx.arc(x - 30, y - 14, 22, 0, TAU); ctx.arc(x + 34, y - 6, 16, 0, TAU); ctx.fill(); }
    else if (i === 1) { K.poly(ctx, [[x - 60, y + 6], [x - 44, y - 34], [x - 4, y - 34], [x + 10, y + 6]]); ctx.fill(); }
    else if (i === 2) { ctx.fillStyle = '#ffffff'; K.poly(ctx, [[x - 50, y + 8], [x - 14, y - 52], [x + 22, y + 8]]); ctx.fill(); }
    else if (i === 3) { for (let k = 0; k < 4; ++k) ctx.fillRect(x - 50 + k * 26, y - 20 - (k % 2) * 26, 18, 30 + (k % 2) * 26); }
    else { ctx.fillStyle = Wd.accent; K.poly(ctx, [[x - 10, y + 6], [x, y - 54], [x + 10, y + 6]]); ctx.fill(); }
    kit.text(Wd.name, x, y + 64, 15, hi ? '#ffffff' : UI.textDim, { align: 'center', weight: 'bold' });
  }

  /* the illustrated map; hi = the world to highlight */
  function drawMapArt(hi, v) {
    const gr = ctx.createLinearGradient(0, v.y0, 0, v.y1);
    gr.addColorStop(0, '#0a1430');
    gr.addColorStop(1, '#1a2a5a');
    ctx.fillStyle = gr;
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    ctx.strokeStyle = 'rgba(120,170,255,0.12)';
    ctx.lineWidth = 2;
    for (let y = 60; y < 720; y += 40) {
      ctx.beginPath();
      for (let x = v.x0; x < v.x1; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.02 + G.time + y) * 4);
      ctx.stroke();
    }
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = 'rgba(255,230,160,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < ISLES.length; ++i) ctx.lineTo(ISLES[i][0], ISLES[i][1] + 10);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < ISLES.length; ++i) island(i, ISLES[i][0], ISLES[i][1], i === hi);
    const b = ISLES[Math.max(0, Math.min(4, hi))];
    K.blit(ctx, NS.cineRender.pip(), b[0], b[1] - 80 + Math.sin(G.time * 3) * 6, 0.6);
  }

  function stageCard(w, s, x, y, cw, sel) {
    const st = stage(w, s);
    const open = stageOpen(w, s);
    const stars = G.save.stars[st.id] || 0;
    const hot = W.area('stage' + s, x, y, cw, 150, () => { G.ui.mapStage = s; if (open) scr.startStory(st.id); else sfx('error'); }, !open);
    if (hot) G.ui.mapStage = s;
    kit.panel(x, y, cw, 150, { radius: 12, accent: st.boss ? UI.bad : WORLDS[w].accent, glow: hot || sel, alpha: open ? 0.95 : 0.6 });
    kit.text(st.boss ? 'GUARDIAN' : 'Stage ' + (s + 1), x + cw / 2, y + 22, 13, st.boss ? UI.bad : UI.textDim, { align: 'center', weight: 'bold' });
    kit.fitText(st.name, x + cw / 2, y + 48, cw - 20, 18, { align: 'center', weight: 'bold', color: open ? '#ffffff' : UI.textMute });
    if (!open) { kit.lock(x + cw / 2, y + 96, 34); return; }
    for (let i = 0; i < 3; ++i) kit.star(x + cw / 2 - 30 + i * 30, y + 84, 12, i < stars);
    const best = G.save.best[st.id];
    kit.text(st.boss ? NS.worlds.BOSS_NAMES[st.boss] : st.lenM + ' m', x + cw / 2, y + 112, 13, UI.textDim, { align: 'center' });
    if (best) kit.text('Best ' + best, x + cw / 2, y + 132, 13, UI.gold, { align: 'center' });
  }

  function draw() {
    const v = NS.view.visible();
    const w = G.ui.mapWorld;
    drawMapArt(w, v);
    for (let i = 0; i < ISLES.length; ++i) {
      const open = worldOpen(i);
      W.area('world' + i, ISLES[i][0] - 100, ISLES[i][1] - 60, 200, 140, () => { if (open) { G.ui.mapWorld = i; G.ui.mapStage = 0; sfx('select'); } else sfx('error'); }, !open);
      if (!open) kit.lock(ISLES[i][0], ISLES[i][1] - 10, 36);
    }
    kit.text('Story', 40, 40, 34, '#ffffff', { weight: 'bold' });
    kit.text(WORLDS[w].sub, 40, 74, 15, UI.textDim);
    const cw = 200, gap = 14, total = STAGES_PER_WORLD * cw + (STAGES_PER_WORLD - 1) * gap;
    const x0 = 640 - total / 2, y0 = 400;
    for (let s = 0; s < STAGES_PER_WORLD; ++s) stageCard(w, s, x0 + s * (cw + gap), y0, cw, G.ui.mapStage === s);
    W.button('back', 'Back', 40, 600, 160, 48, { action: () => scr.setScreen('title'), icon: 'back' });
    W.button('cine', 'Replay story', 220, 600, 200, 48, { action: () => NS.cine.play(G.ui.mapWorld === 0 ? 'intro' : 'world' + G.ui.mapWorld, () => scr.setScreen('map')), icon: 'book' });
    let got = 0;
    for (const k in G.save.stars) got += G.save.stars[k];
    kit.icon('star', 1060, 624, 24, UI.gold);
    kit.text(got + ' / ' + WORLDS.length * STAGES_PER_WORLD * 3, 1080, 624, 20, UI.gold, { weight: 'bold' });
  }

  function onKey(e) {
    const ui = G.ui;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { ui.mapStage = Math.max(0, ui.mapStage - 1); sfx('click'); return true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { ui.mapStage = Math.min(STAGES_PER_WORLD - 1, ui.mapStage + 1); sfx('click'); return true; }
    if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'PageUp') {
      if (ui.mapWorld > 0) { --ui.mapWorld; sfx('click'); }
      return true;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'PageDown') {
      if (ui.mapWorld < WORLDS.length - 1 && worldOpen(ui.mapWorld + 1)) { ++ui.mapWorld; sfx('click'); }
      return true;
    }
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      if (e.repeat) return true;
      const st = stage(ui.mapWorld, ui.mapStage);
      if (stageOpen(ui.mapWorld, ui.mapStage)) { sfx('select'); scr.startStory(st.id); } else sfx('error');
      return true;
    }
    return false;
  }

  Object.assign(NS.map, {
    ISLES, worldOpen, stageOpen, drawMapArt, draw, onKey
  });
})();
