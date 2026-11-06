/* The collection (wardrobe): treat skins previewed on the highest era's treat, click-particle
   styles, kitchen themes and the gallery of the eight treat eras. Unlocked items equip with a
   click and apply at once; locked ones show how to earn them (eras, achievements, golden
   treats, ascensions, Bake-Off scores, season tracks). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const PR = NS.progression;
  const { SKINS, PARTICLES, THEMES, STAGES } = NS.treatData;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const TABS = ['Treat Skins', 'Click Styles', 'Kitchen Themes', 'Era Gallery'];
  const CW = 192, CH = 160, COLS = 6, X0 = 40, Y0 = 128;

  function cardPos(i) {
    return { x: X0 + (i % COLS) * (CW + 8), y: Y0 + Math.floor(i / COLS) * (CH + 10) };
  }

  function equip(kind, id) {
    const p = G.profile;
    p[kind] = id;
    sfx('powerup', { volume: 0.5 });
    NS.save.write(G);
  }

  function card(i, name, sub, unlocked, selected, action, painter) {
    const c = cardPos(i);
    const hot = W.area('card' + i, c.x, c.y, CW, CH, unlocked ? action : null, { disabled: !unlocked });
    kit.panel(c.x, c.y, CW, CH, { radius: 12, accent: selected ? UI.gold : unlocked ? UI.accent : '#5a4a40', glow: selected || hot,
      top: selected ? 'rgba(110,70,30,0.97)' : undefined });
    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.35;
    painter(c.x + CW / 2, c.y + 62);
    ctx.restore();
    kit.fitText(name, c.x + CW / 2, c.y + CH - 34, CW - 16, 15, { align: 'center', weight: 'bold', color: unlocked ? '#ffffff' : UI.textMute });
    kit.fitText(sub, c.x + CW / 2, c.y + CH - 14, CW - 16, 12, { align: 'center', color: selected ? UI.gold : unlocked ? UI.textDim : UI.bad });
    if (!unlocked) kit.lock(c.x + CW - 22, c.y + 18, 14);
  }

  function draw() {
    const p = G.profile;
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(16,8,4,0.93)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('COLLECTION', 40, 40, 34, '#ffffff', { weight: 'bold', shadow: true });
    kit.text('Earn cosmetics through eras, achievements, golden treats, ascensions, Bake-Offs and the seasons', 40, 74, 14, UI.textDim);
    const tab = G.ui.collTab;
    for (let i = 0; i < TABS.length; ++i)
      W.button('ctab' + i, TABS[i], 40 + i * 214, 88 - 2, 204, 34, { selected: tab === i, px: 15, action: () => { G.ui.collTab = i; } });
    const stage = Math.max(p.stageMax, G.run ? G.run.stage : 0);
    if (tab === 0)
      for (let i = 0; i < SKINS.length; ++i) {
        const s = SKINS[i];
        const un = PR.isUnlocked(s, 'skin');
        card(i, s.name, p.skin === s.id ? 'equipped' : un ? 'click to wear' : PR.unlockText(s), un, p.skin === s.id, () => equip('skin', s.id),
          (x, y) => K.blit(ctx, NS.treatArt.sprite(stage >= 4 ? 4 : stage, s.id, 0), x, y + 4, 0.26));
      }
    else if (tab === 1)
      for (let i = 0; i < PARTICLES.length; ++i) {
        const s = PARTICLES[i];
        const un = PR.isUnlocked(s, 'particle');
        card(i, s.name, p.particle === s.id ? 'equipped' : un ? 'click to use' : PR.unlockText(s), un, p.particle === s.id, () => equip('particle', s.id),
          (x, y) => particlePreview(s.id, x, y));
      }
    else if (tab === 2)
      for (let i = 0; i < THEMES.length; ++i) {
        const s = THEMES[i];
        const un = PR.isUnlocked(s, 'theme');
        card(i, s.name, p.theme === s.id ? 'equipped' : un ? 'click to use' : PR.unlockText(s), un, p.theme === s.id, () => equip('theme', s.id),
          (x, y) => themePreview(s, x, y));
      }
    else
      for (let i = 0; i < STAGES.length; ++i) {
        const s = STAGES[i];
        const un = p.stageMax >= i;
        card(i, un ? s.name : '???', un ? 'Era ' + NS.cinematics.ROMAN[i] + ' - +' + Math.round(s.bonus * 100) + '%' : 'bake ' + NS.format.short(s.need) + ' in one run', un, false,
          () => NS.cinematics.play('stage', { from: Math.max(0, i - 1), to: i }), (x, y) => K.blit(ctx, NS.treatArt.sprite(i, p.skin, 0), x, y + 4, 0.26));
      }
    if (tab === 3) kit.text('Click an era you have reached to replay its transformation', 40, 640, 13, UI.textMute);
    W.button('back', G.ui.panelReturn === 'title' ? 'Back to the title' : G.ui.panelReturn === 'paused' ? 'Back to the pause menu' : 'Back to the bakery',
      40, 650, 280, 48, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
  }

  function particlePreview(id, x, y) {
    const colors = NS.clicking.STYLE_COLORS[id] || NS.clicking.STYLE_COLORS.crumbs;
    const kind = NS.fx.KINDS[id];
    for (let k = 0; k < 7; ++k) {
      const a = k / 7 * Math.PI * 2 + G.time * 0.6;
      const r = 26 + (k % 2) * 12;
      const img = NS.fxRender.partSprite(kind, colors[k % colors.length]);
      ctx.drawImage(img, x + Math.cos(a) * r - 12, y + Math.sin(a) * r - 12);
    }
    K.circle(ctx, x, y, 12, '#d89a52');
  }

  function themePreview(t, x, y) {
    const gr = ctx.createLinearGradient(0, y - 48, 0, y + 48);
    gr.addColorStop(0, t.top);
    gr.addColorStop(1, t.bottom);
    ctx.fillStyle = gr;
    K.roundRect(ctx, x - 80, y - 48, 160, 96, 8);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    K.blit(ctx, K.glow(t.glow), x, y, 1);
    ctx.restore();
    ctx.fillStyle = '#6a4228';
    ctx.fillRect(x - 80, y + 30, 160, 18);
  }

  Object.assign(NS.collection, { TABS, draw, equip });
})();
