/*
 * The Wardrobe: hero skins and trails.
 * Owns G.wardrobeFrom; writes G.save.skin and G.save.trail.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H } = NS.config;
  const Prog = SZ.PlatformerProgress;
  const Spr = SZ.PlatformerSprites;
  const Storage = NS.module('storage');
  const Session = NS.module('session');
  const World = NS.module('world');
  const Menu = NS.module('menu');
  const Controls = NS.module('controls');
  const { sfx } = NS.module('sound');
  const { visibleRect } = NS.module('view');
  const { drawSprite, drawGlow, drawIcon } = NS.module('kit');
  const ctx = G.ctx;
  const ui = G.ui;

  function openWardrobe(from) {
    G.wardrobeFrom = from;
    Session.setScreen('wardrobe');
  }

  function closeWardrobe() {
    if (G.wardrobeFrom === 'pause' && G.run) {
      G.screen = 'pause';
      Controls.syncTouch();
    } else {
      Session.setScreen('title');
    }
  }

  function drawWardrobe() {
    if (G.wardrobeFrom === 'pause' && G.run) {
      World.drawWorld(0);
      Menu.veil(0.78);
    } else {
      Menu.menuBackdrop(Math.floor(G.time / 14) % 5, 0.62);
    }
    const v = visibleRect();
    ui.drawPanel(24, 18, 1232, 74, { accent: '#ff6a86' });
    ui.drawHeadline('Wardrobe', 180, 56, 300, 46, '#ffffff', '#ff6a86');
    Menu.currencyChips(1236, 35);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText('HERO', 90, 122, 200, 16, { weight: 'bold', color: '#ffb0c0' });
    Prog.SKINS.forEach((k, i) => {
      const x = 90 + i * 186, y = 136, w = 170, h = 250;
      const owned = Prog.skinOwned(G.save, k.id);
      const on = G.save.skin === k.id;
      const idx = Menu.registerHit('skin' + k.id, x, y, w, h, () => {
        if (!owned) { sfx('error', { volume: 0.4 }); Session.showToast(skinRequirement(k), '#ffb0a0'); return; }
        G.save.skin = k.id;
        Storage.writeSave();
      });
      const hot = Menu.isHot(idx, x, y, w, h);
      if (on)
        drawGlow(x + w / 2, y + h / 2, w * 1.6, k.tunic, 0.4);
      ui.drawPanel(x, y, w, h, { accent: on ? '#ffd75a' : k.trim, glow: on || hot });
      ctx.save();
      if (!owned)
        ctx.globalAlpha = 0.4;
      const pose = hot || on ? 'run' : 'idle';
      drawSprite(Spr.hero(k, pose, Math.floor(G.time * (pose === 'run' ? 12 : 4)) % Spr.HERO_FRAMES[pose]), x + w / 2, y + 170, false, 1.7, 1.7);
      ctx.restore();
      ctx.textAlign = 'center';
      ui.fitText(k.name, x + w / 2, y + 196, w - 20, 18, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
      ui.fitText(on ? 'Wearing' : owned ? 'Click to wear' : skinRequirement(k), x + w / 2, y + 224, w - 20, 12, { color: on ? ui.UI.good : owned ? ui.UI.textDim : ui.UI.warn });
      if (!owned)
        drawIcon('lock', '#c0c8e0', x + w / 2, y + 96, 36);
    });
    ctx.textAlign = 'left';
    ui.fitText('TRAIL', 90, 418, 200, 16, { weight: 'bold', color: '#ffb0c0' });
    Prog.TRAILS.forEach((t, i) => {
      const x = 90 + i * 280, y = 432, w = 260, h = 92;
      const owned = Prog.trailOwned(G.save, t.id);
      const on = G.save.trail === t.id;
      const idx = Menu.registerHit('trail' + t.id, x, y, w, h, () => {
        if (!owned) { sfx('error', { volume: 0.4 }); Session.showToast('Unlock ' + Prog.TREE_BY_ID[t.node].name + ' in the Style branch', '#ffb0a0'); return; }
        G.save.trail = t.id;
        Storage.writeSave();
      });
      const hot = Menu.isHot(idx, x, y, w, h);
      ui.drawPanel(x, y, w, h, { accent: on ? '#ffd75a' : '#c88aff', glow: on || hot });
      /* a swatch of the trail */
      for (let k = 0; k < 7; ++k) {
        const px = x + 30 + k * 14, py = y + 46 + Math.sin(G.time * 6 + k) * 6;
        const col = t.id === 'rainbow' ? ['#ff5a5a', '#ffa83a', '#ffe14a', '#6ae06a', '#4ab8ff', '#a87aff', '#ff5a5a'][k] : t.id === 'spark' ? '#ffd75a' : t.id === 'shadow' ? '#6a5a9a' : '#3a4058';
        if (t.id !== 'none')
          drawGlow(px, py, 26 - k * 2, col, owned ? 0.9 - k * 0.1 : 0.3);
      }
      ctx.textAlign = 'left';
      ui.fitText(t.name, x + 140, y + 34, 110, 18, { weight: 'bold', color: owned ? '#ffffff' : ui.UI.textMute, font: ui.TITLE_FONT });
      ui.fitText(on ? 'Active' : owned ? 'Click to use' : 'Style branch', x + 140, y + 62, 110, 12, { color: on ? ui.UI.good : ui.UI.textDim });
    });
    Menu.drawButton('wback', 'Back', VIEW_W / 2 - 110, Math.min(v.y1, VIEW_H) - 96, 220, 54, { action: closeWardrobe, key: 'Esc' });
  }

  function skinRequirement(k) {
    if (k.stars)
      return 'Earn ' + k.stars + ' stars (' + Prog.totalStars(G.save) + ')';
    return 'Tech Tree: ' + Prog.TREE_BY_ID[k.node].name;
  }

  Object.assign(NS.module('wardrobe'), {
    openWardrobe,
    closeWardrobe,
    drawWardrobe
  });
})();
