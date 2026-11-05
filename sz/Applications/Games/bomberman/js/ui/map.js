/* The story world map: five realm badges joined by a dotted trail (locked ones in chains), the
   selected realm's seven stage nodes with their stars and the boss, a briefing panel with the
   realm's twist and enemies, and Play, Replay Intro, Tech Tree and Back buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { UI } = C;
  const { WORLDS, LEVELS_PER_WORLD } = NS.story;
  const { BOSSES, ENEMY_BY_ID } = NS.content;
  const K = NS.artKit;
  const kit = NS.kit;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;

  const SPOTS = [[170, 250], [400, 180], [640, 260], [880, 180], [1110, 250]];

  function worldStars(save, w) {
    let n = 0;
    for (let l = 0; l < LEVELS_PER_WORLD; ++l) n += save.stars[w + '-' + l] || 0;
    return n;
  }

  function play(w, l) {
    NS.modes.start('story', { world: w, level: l });
  }

  function draw() {
    const save = G.save;
    const t = G.time;
    kit.text('WORLD MAP', 640, 40, 30, '#ffffff', { align: 'center', weight: 'bold', stroke: 6 });
    kit.text('Recover the five Embers of the Spark Core', 640, 74, 14, UI.textDim, { align: 'center' });
    /* trail */
    ctx.setLineDash([10, 10]);
    ctx.lineDashOffset = -t * 20;
    for (let i = 0; i < SPOTS.length - 1; ++i) {
      const open = rules.worldUnlocked(save, i + 1);
      ctx.strokeStyle = open ? 'rgba(255,216,74,0.9)' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(SPOTS[i][0], SPOTS[i][1]);
      ctx.quadraticCurveTo((SPOTS[i][0] + SPOTS[i + 1][0]) / 2, Math.min(SPOTS[i][1], SPOTS[i + 1][1]) - 60, SPOTS[i + 1][0], SPOTS[i + 1][1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let w = 0; w < WORLDS.length; ++w) badge(save, w, t);
    stages(save);
    brief(save);
    kit.button('back', 'Back', 40, 650, 180, 48, { icon: 'back', action: () => scr.setScreen('title'), accent: '#9a8aa0' });
    kit.button('tree', 'Tech Tree', 236, 650, 200, 48, { icon: 'tree', accent: '#ff8a3c', action: () => scr.open('tree', 'map') });
    kit.button('ward', 'Wardrobe', 452, 650, 200, 48, { icon: 'shirt', accent: '#ff70c0', action: () => scr.open('wardrobe', 'map') });
  }

  function badge(save, w, t) {
    const W = WORLDS[w];
    const [x, y] = SPOTS[w];
    const open = rules.worldUnlocked(save, w);
    const sel = G.ui.mapWorld === w;
    const hot = kit.area('w' + w, x - 70, y - 70, 140, 150, () => {
      if (!open) { NS.fx.sfx('error'); return; }
      if (G.ui.mapWorld !== w) { G.ui.mapWorld = w; G.ui.mapSel = firstOpen(save, w); }
    }, !open);
    const bob = sel ? Math.sin(t * 3) * 4 : 0;
    if (sel || hot) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      K.blit(ctx, K.glow(W.palette.accent), x, y + bob, 1.9);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fillStyle = open ? W.palette.floorA : '#3a3440'; ctx.fill();
    ctx.save();
    ctx.clip();
    const tA = NS.tileArt;
    for (let r = -2; r <= 1; ++r) for (let c = -2; c <= 1; ++c) ctx.drawImage((r + c) & 1 ? tA.soft(w) : tA.floor(w, (r + c) & 1), c * 48, r * 48);
    ctx.drawImage(tA.hard(w), -24, -24);
    if (!open) { ctx.fillStyle = 'rgba(20,10,30,0.7)'; ctx.fillRect(-60, -60, 120, 120); }
    ctx.restore();
    ctx.strokeStyle = sel ? UI.gold : open ? W.palette.accent : '#5a5060';
    ctx.lineWidth = sel ? 5 : 3;
    ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.stroke();
    if (!open) kit.icon('lock', 0, 0, 40, '#c8c0d0');
    else if (rules.levelCleared(save, w, LEVELS_PER_WORLD - 1)) kit.icon('star', 40, -40, 28, UI.gold);
    ctx.restore();
    kit.text(W.short, x, y + 80 + bob, 18, open ? '#ffffff' : UI.textMute, { align: 'center', weight: 'bold', stroke: 4 });
    if (open) kit.text(worldStars(save, w) + '/21', x, y + 100 + bob, 12, UI.gold, { align: 'center', stroke: 3 });
  }

  function firstOpen(save, w) {
    for (let l = 0; l < LEVELS_PER_WORLD; ++l) if (!rules.levelCleared(save, w, l)) return rules.levelUnlocked(save, w, l) ? l : 0;
    return 0;
  }

  function stages(save) {
    const w = G.ui.mapWorld;
    const x0 = 120, y = 430, gap = 150;
    kit.panel(60, 372, 1160, 120, { accent: WORLDS[w].palette.accent });
    for (let l = 0; l < LEVELS_PER_WORLD; ++l) {
      const x = x0 + l * gap;
      const open = rules.levelUnlocked(save, w, l);
      const boss = l === LEVELS_PER_WORLD - 1;
      const sel = G.ui.mapSel === l;
      const hot = kit.area('l' + l, x - 50, y - 50, 100, 100, () => {
        if (!open) { NS.fx.sfx('error'); return; }
        if (G.ui.mapSel === l) play(w, l);
        else G.ui.mapSel = l;
      }, !open);
      if (hot && open) G.ui.mapSel = l;
      if (l < LEVELS_PER_WORLD - 1) {
        ctx.strokeStyle = rules.levelCleared(save, w, l) ? UI.gold : 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x + 34, y); ctx.lineTo(x + gap - 34, y); ctx.stroke();
      }
      const r = boss ? 36 : 30;
      ctx.fillStyle = !open ? '#2a2430' : sel ? K.shade(WORLDS[w].palette.accent, -0.3) : '#3a2a3a';
      ctx.beginPath(); ctx.arc(x, y, r * (sel ? 1.1 : 1), 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = sel ? UI.gold : open ? WORLDS[w].palette.accent : '#4a4050'; ctx.lineWidth = sel ? 4 : 2; ctx.stroke();
      if (boss) {
        const s = NS.bossArt.sprite(WORLDS[w].boss, 0);
        ctx.globalAlpha = open ? 1 : 0.3;
        ctx.drawImage(s, x - 34, y - 38, 68, 68);
        ctx.globalAlpha = 1;
      } else kit.text((w + 1) + '-' + (l + 1), x, y + 1, 20, open ? '#ffffff' : UI.textMute, { align: 'center', weight: 'bold' });
      if (!open) kit.icon('lock', x + 22, y - 22, 18, '#a89ab0');
      const st = save.stars[w + '-' + l] || 0;
      if (open) kit.stars(x - 15, y + 46, st, 3, 13);
    }
  }

  function brief(save) {
    const w = G.ui.mapWorld, l = G.ui.mapSel;
    const W = WORLDS[w];
    const x = 680, y = 506, wd = 540, h = 128;
    kit.panel(x, y, wd, h, { accent: W.palette.accent });
    const boss = l === LEVELS_PER_WORLD - 1;
    kit.text(boss ? BOSSES[W.boss].name + ' - ' + BOSSES[W.boss].title : W.name + ' ' + (w + 1) + '-' + (l + 1), x + 20, y + 24, 19, '#ffffff', { weight: 'bold' });
    kit.fitText(W.tagline, x + 20, y + 48, wd - 220, 13, { color: UI.textDim });
    const mix = boss ? [BOSSES[W.boss].minion] : W.mix[Math.min(l, W.mix.length - 1)];
    for (let i = 0; i < mix.length; ++i) {
      const s = NS.actorArt.enemy(mix[i], Math.floor(G.time * 4) % 4, false);
      ctx.drawImage(s, x + 16 + i * 46, y + 62, 46, 46);
    }
    kit.text(mix.map(id => ENEMY_BY_ID[id].name).join(', '), x + 20, y + 116, 11, UI.textMute);
    const open = rules.levelUnlocked(save, w, l);
    kit.button('play', open ? 'Play' : 'Locked', x + wd - 190, y + 20, 170, 50, { icon: 'play', accent: UI.good, disabled: !open, action: () => play(w, l) });
    kit.button('intro', boss ? 'Boss Intro' : 'Chapter', x + wd - 190, y + 78, 170, 36, { px: 14, accent: '#9a8aa0', disabled: !open, action: () => NS.cine.play(boss ? 'boss' + w : (w === 0 && l === 0 ? 'intro' : 'chapter' + w), () => scr.setScreen('map')) });
  }

  Object.assign(NS.map, {
    draw, play, worldStars
  });
})();
