/* The collection: tabs for skins, trails, hats and board themes, a grid of cards with live
   previews and owned/locked state, and a showcase of the selected item on a slithering snake
   (trail particles included) with Equip or Buy and how to unlock the rest - scales, stars,
   guardians, achievements or the seasonal festivals. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { KINDS, find } = NS.cosmetics;
  const { THEMES } = NS.worlds;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const rules = NS.rules;
  const scr = NS.screens;
  const SA = NS.snakeArt;
  const fx = NS.fx;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const TABS = [['skin', 'Skins'], ['trail', 'Trails'], ['hat', 'Hats'], ['board', 'Boards']];
  const PX = new Float32Array(32), PY = new Float32Array(32);
  let emitT = 0;

  function sel() {
    const tab = G.ui.wardrobeTab;
    const item = find(tab, G.ui.wardrobeSel);
    return item && KINDS[tab].indexOf(item) >= 0 ? item : KINDS[tab][0];
  }

  function equip(kind, item) {
    const info = rules.unlockInfo(G.save, kind, item);
    if (!info.owned) {
      if (info.buyable && rules.buyCosmetic(G.save, kind, item.id)) {
        sfx('coin');
        fx.burst(990, 330, 30, ['#ffd25a', '#ffffff'], 300, 0.7, 8, fx.STAR);
        NS.progress.checkAchievements();
      } else { sfx('error'); return; }
    }
    G.save.equip[kind] = item.id;
    if (kind === 'board') NS.tileArt.invalidate();
    NS.save.writeSave();
    sfx('select');
  }

  function snakeAt(x, y, t, n, sc, skinId, hatId) {
    for (let k = 0; k < n; ++k) {
      PX[k] = x - k * 26 * sc;
      PY[k] = y + Math.sin(t * 3 - k * 0.55) * 12 * sc;
    }
    SA.drawChain(ctx, PX, PY, n, SA.skinOf(skinId), { angle: Math.atan2(PY[0] - PY[1], PX[0] - PX[1]), scale: sc, hat: hatId, blink: (t % 3) < 0.1 });
  }

  function preview(kind, item, x, y, w, h, t) {
    if (kind === 'skin') snakeAt(x + w / 2 + 40, y + h / 2, t, 5, 0.75, item.id, 'none');
    else if (kind === 'hat') {
      K.blitRot(ctx, SA.head(SA.skinOf(G.save.equip.skin), false), x + w / 2, y + h / 2 + 8, -Math.PI / 2, 1.1);
      const hs = SA.hat(item.id);
      if (hs) K.blit(ctx, hs, x + w / 2, y + h / 2 - 14, 0.8);
    } else if (kind === 'trail') {
      const kinds = { sparkle: 4, leaf: 2, ember: 0, bubble: 9, heart: 5, star: 4, neon: 0, snow: 6, petal: 3, bat: 8, confetti: 7 };
      if (item.kind === 'none') kit.text('-', x + w / 2, y + h / 2, 22, UI.textMute, { align: 'center' });
      for (let k = 0; k < 5 && item.kind !== 'none'; ++k) {
        const px = x + 20 + k * (w - 40) / 4, py = y + h / 2 + Math.sin(t * 3 + k) * 8;
        if (kinds[item.kind] === 0) {
          ctx.globalCompositeOperation = 'lighter';
          K.blit(ctx, K.glow(item.color), px, py, 0.35);
          ctx.globalCompositeOperation = 'source-over';
        } else K.blit(ctx, NS.itemArt.shape(kinds[item.kind], item.kind === 'confetti' ? ['#ffd23a', '#ff5a8a', '#6fd3ff', '#7ee07a'][k % 4] : item.color), px, py, 1.4);
      }
    } else {
      const th = item.theme >= 0 ? item.theme : (G.season ? G.season.theme : 0);
      const T = THEMES[th];
      for (let yy = 0; yy < 3; ++yy) for (let xx = 0; xx < 5; ++xx) {
        ctx.fillStyle = (xx + yy) % 2 ? T.floorB : T.floorA;
        ctx.fillRect(x + 14 + xx * ((w - 28) / 5), y + 10 + yy * ((h - 20) / 3), (w - 28) / 5 + 0.5, (h - 20) / 3 + 0.5);
      }
      ctx.fillStyle = T.wallTop;
      ctx.fillRect(x + 14, y + 10, (w - 28) / 5, (h - 20) / 3);
      ctx.fillRect(x + w - 14 - (w - 28) / 5, y + h - 10 - (h - 20) / 3, (w - 28) / 5, (h - 20) / 3);
    }
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = G.back.wardrobe === 'paused' ? 'rgba(2,8,4,0.85)' : 'rgba(2,8,4,0.72)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const t = G.time;
    const tab = G.ui.wardrobeTab;
    kit.text('COLLECTION', 60, 44, 30, '#ffffff', { weight: 'bold' });
    kit.credits(G.save.scales, 1220, 46, 24, 'right');
    for (let k = 0; k < TABS.length; ++k) {
      const id = TABS[k][0];
      const list = KINDS[id];
      let owned = 0;
      for (let j = 0; j < list.length; ++j) if (rules.unlockInfo(G.save, id, list[j]).owned) ++owned;
      W.button('tab-' + id, TABS[k][1] + '  ' + owned + '/' + list.length, 300 + k * 170, 22, 160, 42, {
        px: 15, accent: tab === id ? UI.gold : UI.accent, action: () => { G.ui.wardrobeTab = id; G.ui.wardrobeSel = G.save.equip[id]; },
      });
      if (tab === id) { ctx.fillStyle = UI.gold; ctx.fillRect(310 + k * 170, 68, 140, 3); }
    }
    const list = KINDS[tab];
    const cur = sel();
    const cols = 5, cw = 138, ch = 104;
    for (let k = 0; k < list.length; ++k) {
      const it = list[k];
      const x = 50 + (k % cols) * (cw + 8), y = 86 + Math.floor(k / cols) * (ch + 8);
      const info = rules.unlockInfo(G.save, tab, it);
      const on = G.save.equip[tab] === it.id;
      const hot = W.area('it-' + it.id, x, y, cw, ch, () => {
        if (G.ui.wardrobeSel === it.id) equip(tab, it);
        else G.ui.wardrobeSel = it.id;
      });
      if (hot && G.input.mouseMoved > 0 && !G.input.touch) G.ui.wardrobeSel = it.id;
      kit.panel(x, y, cw, ch, { accent: on ? UI.good : cur === it ? UI.gold : 'rgba(150,180,150,0.5)', glow: cur === it, brackets: false, radius: 8, alpha: info.owned ? 1 : 0.75 });
      ctx.save();
      kit.roundRect(x + 2, y + 2, cw - 4, ch - 26, 8);
      ctx.clip();
      if (!info.owned) ctx.globalAlpha = 0.45;
      preview(tab, it, x, y, cw, ch - 24, t + k);
      ctx.restore();
      ctx.globalAlpha = 1;
      kit.fitText(it.name, x + cw / 2, y + ch - 13, cw - 12, 13, { color: info.owned ? '#ffffff' : UI.textDim, align: 'center', weight: on ? 'bold' : 'normal' });
      if (on) kit.icon('check', x + cw - 16, y + 16, 18, UI.good);
      else if (!info.owned) kit.lock(x + cw - 16, y + 16, 14);
    }
    showcase(tab, cur, t);
    W.button('back', G.back.wardrobe === 'paused' ? 'Back to Pause' : 'Back', 60, 650, 240, 46, { action: () => scr.back('wardrobe') });
  }

  function showcase(tab, it, t) {
    const x = 830, y = 86, w = 400, h = 548;
    kit.panel(x, y, w, h, { accent: UI.gold, glow: true });
    const skin = tab === 'skin' ? it.id : G.save.equip.skin;
    const hat = tab === 'hat' ? it.id : G.save.equip.hat;
    const trail = tab === 'trail' ? it : find('trail', G.save.equip.trail);
    if (tab === 'board') {
      const th = it.theme >= 0 ? it.theme : (G.season ? G.season.theme : 0);
      ctx.save();
      kit.roundRect(x + 14, y + 14, w - 28, 250, 10);
      ctx.clip();
      const sc = NS.backdrop.scene(th);
      ctx.drawImage(sc.canvas, x + 14, y + 14, w - 28, 250);
      ctx.restore();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      K.blitAlpha(ctx, K.glow('#7ee07a'), x + w / 2, y + 140, 4, 0.18);
      ctx.globalCompositeOperation = 'source-over';
      const hx = x + w / 2 + 110 + Math.sin(t * 0.8) * 20;
      snakeAt(hx, y + 150, t, 10, 1.15, skin, hat);
      emitT -= 1 / 60;
      if (trail.kind !== 'none' && emitT <= 0) {
        emitT = 0.06;
        const kinds = { sparkle: fx.STAR, leaf: fx.LEAF, ember: fx.GLOW, bubble: fx.BUBBLE, heart: fx.HEART, star: fx.STAR, neon: fx.GLOW, snow: fx.SNOW, petal: fx.PETAL, bat: fx.BAT, confetti: fx.SQUARE };
        const col = trail.kind === 'confetti' ? ['#ffd23a', '#ff5a8a', '#6fd3ff'][Math.floor(Math.random() * 3)] : trail.color;
        fx.spawn(kinds[trail.kind], hx - 40, y + 150 + Math.sin(t * 3) * 12, -80 - Math.random() * 40, (Math.random() - 0.5) * 40, 1.1, 8, col, 0, 1);
      }
      NS.fxRender.draw(1);
    }
    const info = rules.unlockInfo(G.save, tab, it);
    kit.text(it.name, x + 24, y + 300, 26, '#ffffff', { weight: 'bold' });
    kit.text(TABS.filter(a => a[0] === tab)[0][1].replace(/s$/, ''), x + 24, y + 328, 14, UI.textDim);
    kit.wrap(info.owned ? 'Yours to wear. ' + (G.save.equip[tab] === it.id ? 'Equipped.' : '') : 'How to get it: ' + info.text, x + 24, y + 350, w - 48, 15, 21, info.owned ? UI.good : UI.text);
    const on = G.save.equip[tab] === it.id;
    if (info.owned) W.button('equip', on ? 'Equipped' : 'Equip', x + 24, y + h - 78, w - 48, 54, { accent: UI.good, disabled: on, action: () => equip(tab, it) });
    else if (info.buyable) W.button('buy', 'Buy  -  ' + info.cost + ' scales', x + 24, y + h - 78, w - 48, 54, { accent: UI.gold, disabled: G.save.scales < info.cost, action: () => equip(tab, it) });
    else kit.text('Locked', x + w / 2, y + h - 50, 18, UI.textMute, { align: 'center', weight: 'bold' });
  }

  Object.assign(NS.wardrobe, {
    draw, equip
  });
})();
