/* The wardrobe and collection: tabs for skins, trails and maze themes; a grid of cards that
   equip what is owned, buy shop items with shards, or say how to unlock the rest (achievement,
   story chapter or seasonal event); and a live preview of Pac-Man in the chosen skin running
   with the chosen trail, or the chosen maze colours. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const COS = NS.cosmetics;
  const K = NS.artKit;
  const AA = NS.actorArt;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const R = NS.rules;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;
  const rnd = NS.rng.fx;

  const TABS = [{ id: 'skin', name: 'Skins', icon: 'shirt' }, { id: 'trail', name: 'Trails', icon: 'star' }, { id: 'theme', name: 'Maze Themes', icon: 'map' }];

  function equipped(kind) {
    const p = G.profile;
    return kind === 'skin' ? p.skin : kind === 'trail' ? p.trail : p.mazeTheme;
  }

  function equip(kind, id) {
    const p = G.profile;
    if (kind === 'skin') p.skin = id;
    else if (kind === 'trail') p.trail = id;
    else p.mazeTheme = id;
    NS.save.writeProfile();
    sfx('select');
  }

  function howTo(u) {
    switch (u.by) {
      case 'shop': return u.cost + ' shards';
      case 'ach': return 'Trophy: ' + NS.goals.ACH_BY_ID[u.id].name;
      case 'story': return 'Finish chapter ' + u.chapter;
      case 'season': return 'Event: ' + COS.SEASON_BY_ID[u.id].name;
      default: return '';
    }
  }

  function act(kind, item) {
    const p = G.profile;
    if (R.owns(p, kind, item.id)) { equip(kind, item.id); return; }
    if (item.unlock.by === 'shop') {
      if (R.buyCosmetic(p, kind, item.id)) {
        equip(kind, item.id);
        sfx('coin');
        NS.fx.confetti(1010, 400, 40);
        NS.save.writeProfile();
      } else sfx('error');
      return;
    }
    sfx('error');
    scr.toast('Unlock: ' + howTo(item.unlock), '#ff9ad8');
  }

  function themePreview(t, x, y, w, h) {
    const th = t.theme || (t.id === 'season' ? NS.world.theme() : NS.worlds.WORLDS[0].theme);
    ctx.fillStyle = th.floor;
    kit.roundRect(x, y, w, h, 6);
    ctx.fill();
    ctx.strokeStyle = th.rim;
    ctx.lineWidth = 3;
    kit.roundRect(x + 8, y + 8, w - 16, h - 16, 6);
    ctx.stroke();
    ctx.fillStyle = th.wall;
    ctx.fillRect(x + 18, y + 18, w / 2 - 22, 8);
    ctx.fillRect(x + w / 2 + 4, y + h - 26, w / 2 - 22, 8);
    for (let i = 0; i < 6; ++i) { ctx.fillStyle = th.dot; ctx.fillRect(x + 20 + i * (w - 40) / 6, y + h / 2, 3, 3); }
  }

  function card(kind, item, x, y, w, h, idx) {
    const p = G.profile;
    const own = R.owns(p, kind, item.id);
    const on = equipped(kind) === item.id;
    const hot = W.area('c' + idx, x, y, w, h, () => { G.ui.wardrobeSel = idx; act(kind, item); });
    if (hot) G.ui.wardrobeSel = idx;
    kit.panel(x, y, w, h, { accent: on ? UI.good : own ? UI.accent2 : '#5a5a7a', glow: hot || on, alpha: own ? 1 : 0.85 });
    const cx = x + w / 2, cy = y + 42;
    if (kind === 'skin') K.blitEx(ctx, AA.pac(item.id, hot ? AA.mouthIndex(G.time * 8) : 3), cx, cy, 0, 1.1, 1.1);
    else if (kind === 'trail') {
      const shapeId = { snow: 'flake', petals: 'petal', leaves: 'leaf', hearts: 'heart', bats: 'bat', confetti: 'confetti', bubbles: 'bubble', bubblegum: 'sun' }[item.id];
      if (shapeId) for (let k = 0; k < 3; ++k) K.blit(ctx, NS.itemArt.shape(shapeId), cx - 34 + k * 18, cy + Math.sin(G.time * 3 + k) * 4, 1.3);
      else if (item.id !== 'none') {
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 4; ++k) K.blit(ctx, K.glow(item.id === 'rainbow' ? ['#ff3a5a', '#ffd23a', '#3ad8ff', '#7aff5a'][k] : item.color), cx - 36 + k * 14, cy, 0.4);
        ctx.globalCompositeOperation = 'source-over';
      }
      K.blitEx(ctx, AA.pac(p.skin, 3), cx + 30, cy, 0, 0.9, 0.9);
    } else themePreview(item, x + 14, y + 12, w - 28, 56);
    kit.fitText(item.name, cx, y + h - 34, w - 16, 15, { align: 'center', weight: 'bold', color: own ? '#ffffff' : UI.textDim });
    const status = on ? 'Equipped' : own ? 'Click to equip' : howTo(item.unlock);
    kit.fitText(status, cx, y + h - 14, w - 16, 12, { align: 'center', color: on ? UI.good : own ? UI.accent2 : item.unlock.by === 'shop' ? UI.shard : UI.textMute });
    if (!own && item.unlock.by !== 'shop') kit.lock(x + w - 18, y + 18, 16);
  }

  function preview(kind) {
    const x = 930, y = 150, w = 310, h = 420;
    kit.panel(x, y, w, h, { accent: UI.accent, alpha: 0.95 });
    kit.text('PREVIEW', x + 18, y + 24, 12, UI.textMute, { weight: 'bold' });
    const p = G.profile;
    if (kind === 'theme') {
      const t = COS.THEME_BY_ID[p.mazeTheme];
      themePreview(t, x + 20, y + 60, w - 40, 260);
      kit.wrap('Maze themes recolour Arcade, Zen, Daily and Boss Rush. Story keeps each world\'s own look.', x + 20, y + 340, w - 40, 13, 18, UI.textDim);
      return;
    }
    const t = G.time;
    const px = x + w / 2 + Math.sin(t * 1.4) * 90, py = y + 210 + Math.sin(t * 2.8) * 30;
    const dir = Math.cos(t * 1.4) >= 0 ? 1 : -1;
    if (Math.floor(t * 30) % 2 === 0) {
      const id = p.trail;
      if (id === 'sparkle') NS.fx.particle(px - dir * 20, py, (rnd() - 0.5) * 40, (rnd() - 0.5) * 40, 0.5, 6, '#fff6a0', 0, 0, 2);
      else if (id === 'fire') NS.fx.particle(px - dir * 20, py, 0, -60, 0.5, 10, '#ff7a2a', 0, -60, 1);
      else if (id === 'rainbow') NS.fx.particle(px - dir * 20, py, 0, 0, 0.6, 10, ['#ff3a5a', '#ffd23a', '#3ad8ff', '#7aff5a'][Math.floor(t * 10) % 4], 2, 0, 0);
      else if (id !== 'none') NS.fx.shape(px - dir * 20, py, (rnd() - 0.5) * 40, 20, 1, 12, { snow: 'flake', petals: 'petal', leaves: 'leaf', hearts: 'heart', bats: 'bat', confetti: 'confetti', bubbles: 'bubble', bubblegum: 'sun' }[id] || 'flake', '#fff', 20);
    }
    NS.fxRender.draw();
    K.blitEx(ctx, AA.pac(p.skin, AA.mouthIndex(t * 8)), px, py, 0, 3 * dir, 3);
    const skin = COS.SKIN_BY_ID[p.skin];
    kit.text(skin.name, x + w / 2, y + h - 54, 20, '#ffffff', { align: 'center', weight: 'bold' });
    kit.text('Trail: ' + COS.TRAIL_BY_ID[p.trail].name, x + w / 2, y + h - 28, 14, UI.textDim, { align: 'center' });
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,2,14,0.86)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('WARDROBE', 40, 44, 32, '#ffffff', { weight: 'bold' });
    kit.shards(G.profile.shards, 1240, 46, 26, 'right');
    const kind = G.ui.wardrobeTab;
    W.tabs(TABS, kind, 40, 84, 600, 44, (id) => { G.ui.wardrobeTab = id; G.ui.wardrobeSel = 0; });
    const list = R.listFor(kind);
    const own = list.filter(i => R.owns(G.profile, kind, i.id)).length;
    kit.text(own + ' / ' + list.length + ' collected', 880, 106, 14, UI.textDim, { align: 'right' });
    const cols = 5, cw = 168, ch = 118;
    for (let i = 0; i < list.length; ++i) {
      const x = 40 + (i % cols) * (cw + 8), y = 146 + Math.floor(i / cols) * (ch + 8);
      if (y > 600) break;
      card(kind, list[i], x, y, cw, ch, i);
    }
    preview(kind);
    W.button('back', 'Back', 930, 654, 310, 46, { icon: 'back', action: () => scr.back('wardrobeReturn') });
  }

  Object.assign(NS.wardrobe, {
    draw, equip, act
  });
})();
