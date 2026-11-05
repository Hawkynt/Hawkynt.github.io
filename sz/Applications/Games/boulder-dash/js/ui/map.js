/* The story world map: a cut-away of Mount Ember with its five depths (locked ones in shadow),
   the selected depth's eight caves strung along a glowing trail with their stars (bonus and
   boss caves marked), and a card for the chosen cave with its best score and a Play button.
   Keyboard: arrows pick, Enter plays, Esc goes back. Reads G.ui.mapChapter / mapLevel. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const G = NS.state;
  const ST = NS.story;
  const P = NS.progression;
  const kit = NS.kit;
  const scr = NS.screens;
  const { ctx, visible } = NS.view;
  const UI = C.UI;

  const NODES = [[440, 560], [540, 470], [660, 520], [770, 430], [700, 330], [830, 260], [960, 330], [1060, 220]];

  function chapterOpen(ch) {
    return P.levelOpen(G.save, ch, 0);
  }

  function focusLatest() {
    for (let ch = ST.CHAPTERS.length - 1; ch >= 0; --ch)
      for (let lv = ST.LEVELS_PER_CHAPTER - 1; lv >= 0; --lv)
        if (P.levelOpen(G.save, ch, lv)) { G.ui.mapChapter = ch; G.ui.mapLevel = lv; return; }
  }

  function theme() {
    return ST.CHAPTERS[G.ui.mapChapter].theme;
  }

  function move(dx, dy) {
    const u = G.ui;
    if (dy) {
      const ch = Math.max(0, Math.min(ST.CHAPTERS.length - 1, u.mapChapter + dy));
      if (chapterOpen(ch)) { u.mapChapter = ch; u.mapLevel = 0; }
    }
    if (dx) {
      const lv = Math.max(0, Math.min(ST.LEVELS_PER_CHAPTER - 1, u.mapLevel + dx));
      if (P.levelOpen(G.save, u.mapChapter, lv)) u.mapLevel = lv;
    }
    SZ.GameAudio && SZ.GameAudio.play('click', { volume: 0.2 });
  }

  function playSelected() {
    const u = G.ui;
    if (P.levelOpen(G.save, u.mapChapter, u.mapLevel)) scr.playLevel(u.mapChapter, u.mapLevel);
  }

  function drawMountain(v) {
    const x0 = 30, y0 = 110, w = 250, h = 520;
    kit.panel(x0 - 10, y0 - 50, w + 20, h + 70, { accent: UI.accent });
    kit.text('Mount Ember', x0 + w / 2, y0 - 26, 20, UI.accent, { align: 'center', weight: 'bold' });
    for (let ch = 0; ch < ST.CHAPTERS.length; ++ch) {
      const p = ST.THEMES[ST.CHAPTERS[ch].theme];
      const by = y0 + ch * (h / 5), bh = h / 5 - 6;
      const open = chapterOpen(ch);
      const sel = ch === G.ui.mapChapter;
      G.hitAreas.push({ x: x0, y: by, w, h: bh, action: () => { if (open) { G.ui.mapChapter = ch; G.ui.mapLevel = 0; } }, nav: false });
      const g = ctx.createLinearGradient(x0, by, x0 + w, by + bh);
      g.addColorStop(0, open ? p.rockHi : '#2a2420'); g.addColorStop(1, open ? p.rock : '#141010');
      ctx.fillStyle = g;
      K.roundRect(ctx, x0, by, w, bh, 10);
      ctx.fill();
      if (sel) {
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 3;
        K.roundRect(ctx, x0 - 2, by - 2, w + 4, bh + 4, 12);
        ctx.stroke();
      }
      let stars = 0;
      for (let lv = 0; lv < 8; ++lv) stars += G.save.story.stars[P.levelKey(ch, lv)] | 0;
      kit.text(['I', 'II', 'III', 'IV', 'V'][ch], x0 + 22, by + bh / 2, 22, open ? '#fff3c0' : UI.faint, { align: 'center', weight: 'bold' });
      kit.fitText(p.name, x0 + 44, by + bh / 2 - 12, w - 56, 16, { color: open ? UI.text : UI.faint, weight: 'bold' });
      if (open) {
        kit.starIcon(x0 + 52, by + bh / 2 + 14, 7, true);
        kit.text(stars + ' / 24', x0 + 64, by + bh / 2 + 14, 13, UI.gold);
        if ((G.save.stats.chapters | 0) > ch) kit.text('cleared', x0 + w - 12, by + bh / 2 + 14, 12, UI.good, { align: 'right' });
      } else kit.text('locked', x0 + 44, by + bh / 2 + 14, 13, UI.faint);
    }
  }

  function drawTrail(v) {
    const ch = G.ui.mapChapter;
    const chd = ST.CHAPTERS[ch];
    const p = ST.THEMES[chd.theme];
    ctx.lineCap = 'round';
    for (let k = 0; k < NODES.length - 1; ++k) {
      const open = P.levelOpen(G.save, ch, k + 1);
      ctx.strokeStyle = open ? K.rgba(p.accent, 0.8) : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = 6;
      ctx.setLineDash(open ? [] : [6, 10]);
      ctx.beginPath();
      ctx.moveTo(NODES[k][0], NODES[k][1]);
      ctx.quadraticCurveTo((NODES[k][0] + NODES[k + 1][0]) / 2, Math.max(NODES[k][1], NODES[k + 1][1]) + 30, NODES[k + 1][0], NODES[k + 1][1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (let lv = 0; lv < NODES.length; ++lv) {
      const [x, y] = NODES[lv];
      const open = P.levelOpen(G.save, ch, lv);
      const stars = G.save.story.stars[P.levelKey(ch, lv)] | 0;
      const sel = lv === G.ui.mapLevel;
      const kind = chd.kinds[lv];
      const r = kind === 'boss' ? 34 : 26;
      G.hitAreas.push({ x: x - r, y: y - r, w: r * 2, h: r * 2, action: () => { if (open) { if (G.ui.mapLevel === lv) playSelected(); else G.ui.mapLevel = lv; } }, nav: false });
      if (sel) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(K.glow(p.accent), x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
        ctx.globalCompositeOperation = 'source-over';
      }
      K.orb(ctx, x, y, r, open ? (stars ? p.accent : p.rockHi) : '#3a3430', open ? '#fff3c0' : '#5a5450', open ? K.darken(p.rock, 0.3) : '#1a1614');
      ctx.strokeStyle = sel ? '#ffffff' : 'rgba(0,0,0,0.6)';
      ctx.lineWidth = sel ? 3 : 2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, C.TAU); ctx.stroke();
      if (kind === 'boss') ctx.drawImage(NS.creatureArt.boss(chd.boss, 0, false), x - 26, y - 28, 52, 52);
      else if (kind === 'bonus') ctx.drawImage(NS.tileArt.tiles(chd.theme, '').gem[Math.floor(G.time * 8) & 7], x - 18, y - 18, 36, 36);
      else kit.text(String(lv + 1), x, y + 1, 22, open ? '#1a0f08' : UI.faint, { align: 'center', weight: 'bold', shadow: false });
      for (let s = 0; s < 3; ++s) kit.starIcon(x - 18 + s * 18, y + r + 12, 7, s < stars);
    }
  }

  function drawCard(v) {
    const ch = G.ui.mapChapter, lv = G.ui.mapLevel;
    const chd = ST.CHAPTERS[ch];
    const p = ST.THEMES[chd.theme];
    const x = 330, y = 60, w = 560;
    kit.panel(x, y, w, 120, { accent: p.accent });
    kit.text(chd.title, x + 20, y + 26, 18, p.accent, { weight: 'bold' });
    kit.text(chd.levels[lv], x + 20, y + 60, 28, UI.text, { weight: 'bold' });
    const kind = chd.kinds[lv];
    const desc = kind === 'boss' ? 'Boss: ' + NS.items.BOSSES[chd.boss].name + ' - drop boulders and dynamite on it'
      : kind === 'bonus' ? 'Bonus cave: a quick gem rush, extra lives hidden inside' : 'Cave ' + (lv + 1) + ' of 6';
    kit.text(desc, x + 20, y + 92, 14, UI.dim);
    const best = G.save.story.best[P.levelKey(ch, lv)] | 0;
    if (best) kit.text('Best ' + best, x + w - 160, y + 30, 15, UI.gold, { weight: 'bold' });
    const open = P.levelOpen(G.save, ch, lv);
    kit.button(open ? 'Play' : 'Locked', x + w - 160, y + 52, 140, 52, playSelected, { accent: '#7dff8a', disabled: !open, size: 22 });
  }

  function draw() {
    const v = visible();
    drawMountain(v);
    drawTrail(v);
    drawCard(v);
    kit.button('Back', v.x1 - 150, v.y0 + 20, 130, 44, () => scr.setScreen('title'), { size: 18 });
    kit.button('Tech Tree', v.x1 - 150, v.y0 + 72, 130, 44, () => scr.openOverlay('tree'), { size: 16 });
    kit.text('Arrows: choose   Enter: play   Esc: back', (v.x0 + v.x1) / 2 + 120, v.y1 - 24, 14, UI.faint, { align: 'center' });
  }

  Object.assign(NS.map, { draw, focusLatest, theme, move, playSelected });
})();
