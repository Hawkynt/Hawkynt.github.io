/* The world map of the Verdant Vale: five world tabs with their stars and locks, the chosen
   world's six levels as stops along a winding trail over its scenery (the guardian's lair last),
   Sola waiting at the selected stop, and a card with the level's goal, critters, hazards, best
   score and three stars, with Play, the tech tree and Back. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { WORLDS, BOSSES, LEVELS_PER_WORLD, THEMES } = NS.worlds;
  const { ENEMIES } = NS.items;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const rules = NS.rules;
  const scr = NS.screens;
  const SA = NS.snakeArt;
  const { ctx } = NS.view;

  const HAZ_NAMES = { sand: 'Quicksand', ice: 'Ice', spike: 'Spike traps', vent: 'Lava vents', gate: 'Laser gates' };

  function nodePos(l) {
    return { x: 150 + l * 196, y: 330 + Math.sin(l * 1.25 + 0.4) * 62 };
  }

  function ensureSel() {
    if (G.ui.mapSel >= 0) return;
    const n = rules.nextStoryLevel(G.save);
    G.ui.mapWorld = n.w;
    G.ui.mapSel = n.l;
  }

  function play() {
    const w = G.ui.mapWorld, l = G.ui.mapSel;
    if (!rules.levelUnlocked(G.save, w, l)) { NS.audio.sfx('error'); return; }
    NS.save.clearRun();
    NS.run.storyEntry(w, l);
  }

  function draw() {
    ensureSel();
    const save = G.save;
    const wi = G.ui.mapWorld;
    const world = WORLDS[wi];
    const v = NS.view.visible();
    NS.backdrop.draw(world.theme, 1 / 60);
    ctx.fillStyle = 'rgba(4,10,6,0.35)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('THE VERDANT VALE', 60, 34, 26, '#ffffff', { weight: 'bold' });
    kit.text(rules.totalStars(save) + ' / 90 stars', 1220, 34, 16, UI.gold, { align: 'right', weight: 'bold' });

    /* world tabs */
    for (let k = 0; k < WORLDS.length; ++k) {
      const x = 50 + k * 238, y = 60, w = 224, h = 66;
      const unlocked = rules.worldUnlocked(save, k);
      const sel = k === wi;
      const hot = W.area('world' + k, x, y, w, h, () => {
        if (!unlocked) { NS.audio.sfx('error'); return; }
        G.ui.mapWorld = k;
        G.ui.mapSel = 0;
        for (let l = 0; l < LEVELS_PER_WORLD; ++l) if (rules.levelUnlocked(save, k, l)) G.ui.mapSel = l;
      });
      kit.panel(x, y, w, h, { accent: sel ? WORLDS[k].color : hot ? UI.gold : 'rgba(160,190,160,0.6)', glow: sel, alpha: unlocked ? 1 : 0.6, brackets: false });
      ctx.fillStyle = THEMES[WORLDS[k].theme].accent;
      ctx.fillRect(x + 10, y + 12, 5, h - 24);
      kit.fitText((k + 1) + '. ' + WORLDS[k].name, x + 24, y + 22, w - 40, 16, { color: unlocked ? '#ffffff' : UI.textMute, weight: 'bold' });
      if (unlocked) {
        kit.star(x + 32, y + 46, 8, true);
        kit.text(rules.worldStars(save, k) + ' / 18', x + 46, y + 46, 13, UI.text);
        if (rules.bossFreed(save, WORLDS[k].boss)) kit.text('freed', x + w - 14, y + 46, 12, UI.good, { align: 'right' });
      } else kit.lock(x + w - 28, y + 40, 18);
    }

    /* trail */
    ctx.strokeStyle = 'rgba(255,240,200,0.55)';
    ctx.lineWidth = 6;
    ctx.setLineDash([2, 14]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let l = 0; l < LEVELS_PER_WORLD; ++l) {
      const p = nodePos(l);
      if (l === 0) ctx.moveTo(p.x - 80, p.y + 30);
      const q = l ? nodePos(l - 1) : { x: p.x - 80, y: p.y + 30 };
      ctx.quadraticCurveTo((p.x + q.x) / 2, Math.min(p.y, q.y) - 40, p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';

    for (let l = 0; l < LEVELS_PER_WORLD; ++l) drawNode(wi, l);
    const sp = nodePos(G.ui.mapSel);
    marker(sp.x, sp.y - 62 + Math.sin(G.time * 4) * 5);
    detail(wi, G.ui.mapSel);
  }

  function drawNode(wi, l) {
    const save = G.save;
    const p = nodePos(l);
    const boss = l === LEVELS_PER_WORLD - 1;
    const r = boss ? 42 : 32;
    const unlocked = rules.levelUnlocked(save, wi, l);
    const rec = rules.levelRecord(save, wi, l);
    const sel = G.ui.mapSel === l;
    const hot = W.area('lvl' + l, p.x - r, p.y - r, r * 2, r * 2 + 26, () => {
      if (G.ui.mapSel === l) play();
      else G.ui.mapSel = l;
    });
    if (hot && G.input.mouseMoved > 0 && !G.input.touch) G.ui.mapSel = l;
    const col = WORLDS[wi].color;
    if (sel) {
      ctx.globalCompositeOperation = 'lighter';
      K.blitAlpha(ctx, K.glow(col), p.x, p.y, 2.2, 0.45 + Math.sin(G.time * 4) * 0.15);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + r * 0.85, r, r * 0.35, 0, 0, TAU); ctx.fill();
    const gr = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.4, 2, p.x, p.y, r);
    gr.addColorStop(0, unlocked ? K.shade(col, 0.35) : '#4a4a50');
    gr.addColorStop(1, unlocked ? K.shade(col, -0.45) : '#1a1a20');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = sel ? '#ffffff' : rec ? UI.gold : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = sel ? 4 : 2.5;
    ctx.stroke();
    if (!unlocked) kit.lock(p.x, p.y, r * 0.8);
    else if (boss) K.blit(ctx, NS.creatureArt.boss(WORLDS[wi].boss, 0), p.x, p.y + 2, r * 2 / NS.creatureArt.BS * 1.25);
    else kit.text(String(l + 1), p.x, p.y + 1, 24, '#ffffff', { align: 'center', weight: 'bold' });
    for (let s = 0; s < 3; ++s) kit.star(p.x - 22 + s * 22, p.y + r + 14, 8, !!(rec && rec.stars[s]));
  }

  function marker(x, y) {
    const skin = SA.skinOf(G.save.equip.skin);
    K.blitRot(ctx, SA.head(skin, (G.time % 3) < 0.12), x, y, Math.PI / 2, 1.3);
    const h = SA.hat(G.save.equip.hat);
    if (h) K.blit(ctx, h, x, y - 22, 0.8);
  }

  function detail(wi, l) {
    const save = G.save;
    const rec = WORLDS[wi].levels[l];
    const lr = rules.levelRecord(save, wi, l);
    const unlocked = rules.levelUnlocked(save, wi, l);
    const x = 60, y = 488, w = 1160, h = 160;
    kit.panel(x, y, w, h, { accent: WORLDS[wi].color, glow: true });
    kit.text((wi + 1) + '-' + (l + 1) + '  ' + rec.name, x + 24, y + 30, 24, '#ffffff', { weight: 'bold' });
    const goal = rec.boss ? 'Free ' + BOSSES[rec.boss].name + ' - eat Sun Shards and ram the guardian while you shine' : 'Eat ' + rec.goal + ' fruit, then slither into the exit gate';
    kit.fitText(goal, x + 24, y + 60, 640, 15, { color: UI.text });
    let cx = x + 24;
    const crit = {};
    for (let k = 0; k < rec.enemies.length; ++k) crit[rec.enemies[k]] = 1;
    const parts = Object.keys(crit).map(id => ENEMIES[id].name);
    for (const hz in rec.hazards) parts.push(HAZ_NAMES[hz]);
    if (rec.portals) parts.push('Portals');
    kit.fitText(parts.length ? 'Watch out: ' + parts.join(', ') : 'A gentle start', cx, y + 86, 640, 13, { color: UI.textDim });
    const starText = ['Clear the level', 'Collect all 3 golden eggs', 'Do not crash once'];
    for (let s = 0; s < 3; ++s) {
      kit.star(x + 36 + s * 210, y + 124, 11, !!(lr && lr.stars[s]));
      kit.fitText(starText[s], x + 54 + s * 210, y + 124, 180, 13, { color: lr && lr.stars[s] ? UI.gold : UI.textDim });
    }
    if (lr) kit.text('Best ' + lr.best, x + 700, y + 30, 15, UI.gold, { weight: 'bold' });
    W.button('play', unlocked ? 'Play' : 'Locked', x + w - 300, y + 24, 270, 58, { icon: 'play', accent: UI.good, disabled: !unlocked, action: play, sub: unlocked ? 'Enter' : 'clear the level before' });
    W.button('tree', 'Tech Tree', x + w - 300, y + 94, 130, 44, { px: 15, action: () => scr.open('tree', 'map') });
    W.button('back', 'Back', x + w - 160, y + 94, 130, 44, { px: 15, action: () => scr.setScreen('title') });
  }

  function onKey(e) {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyA' || e.code === 'KeyD') {
      const d = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 1;
      const n = G.ui.mapSel + d;
      if (n >= 0 && n < LEVELS_PER_WORLD) G.ui.mapSel = n;
      else {
        const w = G.ui.mapWorld + d;
        if (w >= 0 && w < WORLDS.length && rules.worldUnlocked(G.save, w)) { G.ui.mapWorld = w; G.ui.mapSel = d > 0 ? 0 : LEVELS_PER_WORLD - 1; }
      }
      NS.audio.sfx('click', { volume: 0.4 });
      return true;
    }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyW' || e.code === 'KeyS') {
      const d = e.code === 'ArrowUp' || e.code === 'KeyW' ? -1 : 1;
      const w = G.ui.mapWorld + d;
      if (w >= 0 && w < WORLDS.length && rules.worldUnlocked(G.save, w)) { G.ui.mapWorld = w; G.ui.mapSel = 0; NS.audio.sfx('click', { volume: 0.4 }); }
      return true;
    }
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { play(); return true; }
    return false;
  }

  Object.assign(NS.map, {
    draw, play, onKey, nodePos
  });
})();
