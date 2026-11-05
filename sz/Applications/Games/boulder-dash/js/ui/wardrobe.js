/* The wardrobe: tabs for miner skins (animated previews), dig trails and cave tile sets, each
   card showing whether it is worn, how to unlock it (chapters, achievements, seasonal event
   tracks) or its gold price; clicking equips or buys. Writes the choice into the save. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const G = NS.state;
  const M = NS.meta;
  const P = NS.progression;
  const kit = NS.kit;
  const scr = NS.screens;
  const { ctx, visible } = NS.view;
  const UI = C.UI;

  const TABS = [
    { name: 'Miners', list: () => M.SKINS, key: 'skin' },
    { name: 'Trails', list: () => M.TRAILS, key: 'trail' },
    { name: 'Tile Sets', list: () => M.TILESETS, key: 'tileset' }
  ];

  function choose(tab, item) {
    const s = G.save;
    if (!P.isUnlocked(s, item)) {
      if (item.unlock.type === 'gold') {
        if (s.gold < item.unlock.value) { scr.toast('Not enough gold', '#ff5d5d'); return; }
        s.gold -= item.unlock.value;
        s.bought[item.id] = 1;
        SZ.GameAudio && SZ.GameAudio.play('coin');
        scr.toast(item.name + ' bought!', '#ffd54a');
      } else {
        scr.toast('Locked - ' + P.unlockHint(item), '#ff9a6a');
        return;
      }
    }
    s[tab.key] = item.id;
    if (tab.key === 'skin') NS.spriteArt.clearPortraits();
    SZ.GameAudio && SZ.GameAudio.play('select', { volume: 0.4 });
    NS.save.writeSave();
  }

  function preview(tab, item, x, y, w, h, hot) {
    if (tab.key === 'skin') {
      const set = NS.spriteArt.miner(item.id);
      const pose = hot ? 'walk' + (Math.floor(G.time * 10) & 3) : ((G.time + x * 0.01) % 3 < 0.12 ? 'blink' : 'front');
      ctx.drawImage(set.right[pose], x + w / 2 - 40, y + 4, 80, 80);
    } else if (tab.key === 'trail') {
      const cols = item.colors.length ? item.colors : ['#555'];
      for (let k = 0; k < 9; ++k) {
        const px = x + 20 + k * (w - 40) / 8, py = y + 46 + Math.sin(G.time * 3 + k) * 8;
        ctx.globalAlpha = item.colors.length ? 0.3 + k / 12 : 0.25;
        ctx.drawImage(K.glow(cols[k % cols.length]), px - 10, py - 10, 20, 20);
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(NS.spriteArt.miner(G.save.skin).right['walk' + (Math.floor(G.time * 10) & 3)], x + w - 60, y + 14, 56, 56);
    } else {
      const theme = item.id === 'auto' ? 'amber' : item.id;
      const t = NS.tileArt.tiles(theme, '');
      const imgs = [t.dirt[0][0], t.boulder[0], t.gem[Math.floor(G.time * 8) & 7], t.brick, t.dirt[1][5], t.steel];
      for (let k = 0; k < 6; ++k) ctx.drawImage(imgs[k], x + w / 2 - 60 + (k % 3) * 40, y + 6 + Math.floor(k / 3) * 40, 40, 40);
    }
  }

  function draw() {
    const v = visible();
    ctx.fillStyle = 'rgba(8,5,3,0.55)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('Wardrobe', 70, 50, 34, UI.accent, { weight: 'bold' });
    kit.goldLabel(v.x1 - 190, 50, G.save.gold, 24, 'right');
    kit.button('Back', v.x1 - 160, 26, 130, 46, () => scr.back(), { size: 18 });
    for (let k = 0; k < TABS.length; ++k)
      kit.button(TABS[k].name, 70 + k * 170, 90, 160, 44, () => { G.ui.wardrobeTab = k; }, { selected: G.ui.wardrobeTab === k, size: 17 });
    const tab = TABS[G.ui.wardrobeTab];
    const list = tab.list();
    const cols = 6, cw = 186, ch = 170;
    for (let k = 0; k < list.length; ++k) {
      const item = list[k];
      const x = 70 + (k % cols) * (cw + 10), y = 150 + Math.floor(k / cols) * (ch + 10);
      const open = P.isUnlocked(G.save, item);
      const worn = G.save[tab.key] === item.id;
      G.hitAreas.push({ x, y, w: cw, h: ch, action: () => choose(tab, item), nav: true });
      const idx = G.hitAreas.length - 1;
      const hot = kit.hover(x, y, cw, ch) || (G.menuCursor === idx && G.input.lastInput === 1);
      kit.panel(x, y, cw, ch, { accent: worn ? '#7dff8a' : UI.accent, glow: worn || hot, radius: 12, rivets: false, alpha: open ? 1 : 0.7 });
      preview(tab, item, x, y + 4, cw, 90, hot);
      kit.fitText(item.name, x + cw / 2, y + 112, cw - 16, 16, { align: 'center', weight: 'bold', color: open ? UI.text : UI.faint });
      if (worn) kit.text('Equipped', x + cw / 2, y + 140, 14, UI.good, { align: 'center', weight: 'bold' });
      else if (open) kit.text('Click to wear', x + cw / 2, y + 140, 13, UI.dim, { align: 'center' });
      else if (item.unlock.type === 'gold') kit.goldLabel(x + cw / 2, y + 140, item.unlock.value, 15, 'center');
      else kit.fitText(P.unlockHint(item), x + cw / 2, y + 140, cw - 16, 12, { align: 'center', color: '#ff9a6a' });
    }
  }

  Object.assign(NS.wardrobe, { draw, choose, TABS });
})();
