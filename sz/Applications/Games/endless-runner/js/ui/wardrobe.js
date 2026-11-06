/* The collection: tabs for runners, outfits and trails; a grid of cards with a preview, the
   name and what it takes (equipped, owned, a price in coins or gems, or the level, achievement,
   guardian or festival that unlocks it); clicking equips, buys or explains; and a large preview
   of the equipped runner running in place with the trail streaming off. Draws and registers hit
   areas; owns the tab choice. */
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
  const rules = NS.rules;
  const RA = NS.runnerArt;
  const PA = NS.propArt;
  const { CHARACTERS, OUTFITS, TRAILS } = NS.cosmetics;
  const { sfx } = NS.audio;
  const { ctx } = NS.view;

  const TABS = [['char', 'Runners', CHARACTERS], ['outfit', 'Outfits', OUTFITS], ['trail', 'Trails', TRAILS]];

  function how(u) {
    switch (u.kind) {
      case 'coins': return u.n + ' coins';
      case 'gems': return u.n + ' gems';
      case 'level': return 'Reach level ' + u.n;
      case 'ach': return 'Achievement: ' + ((NS.goals.ACHIEVEMENTS.find(a => a.id === u.id) || {}).name || u.id);
      case 'boss': return 'Free ' + NS.worlds.BOSS_NAMES[u.id];
      case 'season': return (NS.seasons.SEASONS[u.id] || {}).name + ' reward';
      default: return '';
    }
  }

  function pick(kind, item) {
    const s = G.save;
    if (rules.owns(s, kind, item)) {
      s.equip[kind] = item.id;
      NS.save.refreshStats();
      NS.save.writeSave();
      sfx('select');
      return;
    }
    if (rules.buyCosmetic(s, kind, item)) {
      s.equip[kind] = item.id;
      NS.save.refreshStats();
      NS.save.writeSave();
      NS.progress.checkAchievements();
      sfx('levelup');
      NS.progress.toast('New ' + (kind === 'char' ? 'runner' : kind) + ': ' + item.name, UI.accent, 'gift');
      return;
    }
    sfx('error');
    NS.progress.toast(rules.price(item) ? 'Not enough ' + (item.unlock.kind) : how(item.unlock), UI.warn, 'lock');
  }

  function preview(kind, item, x, y) {
    const eq = G.save.equip;
    if (kind === 'trail') {
      for (let i = 0; i < 7; ++i) {
        const c = item.colors[i % item.colors.length];
        const kd = NS.fx.SHAPES[item.shape];
        const xx = x - 50 + i * 15, yy = y + Math.sin(G.time * 4 + i) * 8;
        if (kd === NS.fx.GLOW || kd === NS.fx.RIBBON) {
          ctx.globalCompositeOperation = 'lighter';
          K.blitAlpha(ctx, K.glow(c), xx, yy, 0.5, 0.8);
          ctx.globalCompositeOperation = 'source-over';
        } else if (kd === NS.fx.DOT) {
          ctx.fillStyle = c; ctx.fillRect(xx - 4, yy - 4, 8, 8);
        } else K.blit(ctx, PA.shape(kd, c), xx, yy, 0.7);
      }
      return;
    }
    const ch = kind === 'char' ? item.id : eq.char;
    const of = kind === 'outfit' ? item.id : eq.outfit;
    const spr = RA.frame(ch, of, 'idle', 0);
    ctx.drawImage(spr.canvas, x - RA.OX * 0.9, y + 40 - RA.OY * 0.9, RA.W * 0.9, RA.H * 0.9);
  }

  function card(kind, item, x, y, w, h, i) {
    const s = G.save;
    const owned = rules.owns(s, kind, item);
    const eq = s.equip[kind] === item.id;
    const hot = W.area(kind + ':' + item.id, x, y, w, h, () => pick(kind, item));
    kit.panel(x, y, w, h, { radius: 10, accent: eq ? UI.gold : owned ? UI.accent : UI.textMute, glow: hot || eq, brackets: false, alpha: 0.95 });
    preview(kind, item, x + w / 2, y + 52);
    kit.fitText(item.name, x + w / 2, y + h - 40, w - 12, 15, { align: 'center', weight: 'bold', color: owned ? '#ffffff' : UI.textDim });
    let sub = eq ? 'Equipped' : owned ? 'Owned' : how(item.unlock);
    if (kind === 'char') sub = eq || owned ? item.perk : how(item.unlock);
    kit.fitText(sub, x + w / 2, y + h - 18, w - 12, 12, { align: 'center', color: eq ? UI.gold : owned ? UI.good : UI.warn });
    if (!owned && !rules.price(item)) kit.lock(x + w - 18, y + 18, 18);
  }

  function bigPreview(x, y) {
    const eq = G.save.equip;
    kit.panel(x, y, 300, 420, { radius: 14, accent: UI.gold });
    const ch = NS.cosmetics.CHAR_BY_ID[eq.char];
    kit.text(ch.name, x + 150, y + 30, 24, '#ffffff', { align: 'center', weight: 'bold' });
    kit.text(ch.role, x + 150, y + 56, 13, UI.textDim, { align: 'center' });
    const f = Math.floor(G.time * 12) % RA.RUN_FRAMES;
    const spr = RA.frame(eq.char, eq.outfit, 'run', f);
    const tr = NS.cosmetics.TRAIL_BY_ID[eq.trail];
    for (let i = 0; i < 10; ++i) {
      const c = tr.colors[i % tr.colors.length];
      const xx = x + 120 - i * 14 - (G.time * 80) % 14, yy = y + 250 + Math.sin(G.time * 5 + i) * 10;
      ctx.globalAlpha = 1 - i / 10;
      ctx.globalCompositeOperation = 'lighter';
      K.blitAlpha(ctx, K.glow(c), xx, yy, 0.6, 0.7);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(spr.canvas, x + 150 - RA.OX * 2, y + 330 - RA.OY * 2, RA.W * 2, RA.H * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x + 150, y + 334, 50, 8, 0, 0, TAU); ctx.fill();
    kit.fitText('Perk: ' + ch.perk, x + 150, y + 372, 270, 14, { align: 'center', color: UI.good });
    kit.fitText(NS.cosmetics.OUTFIT_BY_ID[eq.outfit].name + ' outfit - ' + tr.name + ' trail', x + 150, y + 396, 270, 13, { align: 'center', color: UI.textDim });
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(8,6,22,0.86)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('Collection', 60, 44, 32, '#ffffff', { weight: 'bold' });
    kit.amount('coins', G.save.coins, 280, 46, 22);
    kit.amount('gems', G.save.gems, 420, 46, 22);
    const tab = G.ui.wardrobeTab;
    for (let i = 0; i < TABS.length; ++i) {
      const t = TABS[i];
      W.button('tab:' + t[0], t[1], 60 + i * 170, 80, 160, 40, { action: () => { G.ui.wardrobeTab = t[0]; G.ui.scroll = 0; }, accent: tab === t[0] ? UI.gold : UI.accent, px: 16 });
    }
    const list = TABS.find(t => t[0] === tab)[2];
    const cols = 5, cw = 150, chh = 160, gap = 10;
    const pages = Math.ceil(list.length / (cols * 3));
    const page = Math.min(G.ui.scroll, pages - 1);
    for (let i = page * cols * 3; i < Math.min(list.length, (page + 1) * cols * 3); ++i) {
      const k = i - page * cols * 3;
      card(tab, list[i], 60 + (k % cols) * (cw + gap), 134 + Math.floor(k / cols) * (chh + gap), cw, chh, i);
    }
    if (pages > 1) {
      W.button('prev', 'Prev', 60, 652, 110, 40, { action: () => { G.ui.scroll = Math.max(0, page - 1); }, disabled: page === 0, px: 15 });
      W.button('next', 'Next', 180, 652, 110, 40, { action: () => { G.ui.scroll = Math.min(pages - 1, page + 1); }, disabled: page >= pages - 1, px: 15 });
      kit.text('Page ' + (page + 1) + ' / ' + pages, 310, 672, 14, UI.textDim);
    }
    bigPreview(880, 134);
    W.button('back', 'Back', v.x1 - 190, 22, 160, 46, { action: () => scr.back('wardrobe'), icon: 'back' });
  }

  Object.assign(NS.wardrobe, {
    draw, pick
  });
})();
