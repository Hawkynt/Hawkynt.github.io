/* The hangar: the collection of ship skins, engine trails and shot colours on three tabs, a live
   preview of the current look, and cards showing what is equipped, owned, buyable with stardust
   or how it unlocks (achievement, story chapter, seasonal event tier). Changes apply at once,
   also mid-run from the pause menu. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const COS = NS.cosmetics;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const rules = NS.rules;
  const scr = NS.screens;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const TABS = [['skin', 'Ship Skins', 'skin'], ['trail', 'Engine Trails', 'trail'], ['shot', 'Shot Colours', 'shot']];

  function pick(kind, it) {
    const sv = G.save;
    if (rules.owns(sv, kind, it.id)) {
      rules.equip(sv, kind, it.id);
      NS.save.writeSave();
      sfx('select');
      return;
    }
    if (it.unlock.by === 'dust') {
      if (rules.buyCosmetic(sv, kind, it.id)) {
        rules.equip(sv, kind, it.id);
        NS.save.writeSave();
        NS.progress.checkGoals();
        sfx('levelup');
        scr.toast('Unlocked ' + it.name, '#c08aff');
      } else {
        sfx('error');
        scr.toast('Not enough stardust yet', '#ff5a6a');
      }
      return;
    }
    sfx('error');
    scr.toast(rules.unlockText(it), '#9fb0d0');
  }

  function draw() {
    const sv = G.save;
    const kind = G.ui.wardrobeTab;
    kit.text('HANGAR', 60, 44, 30, '#ffffff', { weight: 'bold' });
    kit.text('Your collection: ' + sv.owned.length + ' pieces. New ones come from stardust, achievements, the story and seasonal events.', 60, 74, 14, UI.textDim);
    kit.credits(sv.dust, 1220, 44, 24, 'right');
    for (let i = 0; i < TABS.length; ++i) {
      const tb = TABS[i];
      const on = kind === tb[0];
      W.button('tab' + i, tb[1], 400 + i * 200, 100, 190, 40, { action: () => { G.ui.wardrobeTab = tb[0]; }, icon: tb[2], accent: on ? UI.gold : UI.accent, px: 15 });
      if (on) {
        ctx.fillStyle = UI.gold;
        ctx.fillRect(410 + i * 200, 142, 170, 3);
      }
    }
    preview();
    const list = COS.KINDS[kind];
    const cols = 5, cw = 160, ch = 100, x0 = 400, y0 = 158;
    for (let i = 0; i < list.length; ++i) {
      const it = list[i];
      const x = x0 + (i % cols) * (cw + 8), y = y0 + Math.floor(i / cols) * (ch + 8);
      const owned = rules.owns(sv, kind, it.id);
      const eq = sv.look[kind] === it.id;
      const hot = W.area(kind + i, x, y, cw, ch, () => pick(kind, it));
      kit.panel(x, y, cw, ch, { accent: eq ? UI.good : hot ? UI.gold : owned ? UI.accent : '#4a5470', glow: hot || eq, alpha: owned ? 1 : 0.8 });
      thumb(kind, it, x + cw / 2, y + 36, owned);
      kit.fitText(it.name, x + cw / 2, y + 68, cw - 16, 14, { align: 'center', weight: 'bold', color: owned ? '#ffffff' : UI.textDim });
      const status = eq ? 'EQUIPPED' : owned ? 'Owned - click to equip' : rules.unlockText(it);
      kit.fitText(status, x + cw / 2, y + 86, cw - 16, 11, { align: 'center', color: eq ? UI.good : owned ? UI.textDim : it.unlock.by === 'dust' ? (sv.dust >= it.unlock.cost ? '#bfe8ff' : UI.bad) : UI.warn });
      if (!owned) kit.lock(x + cw - 18, y + 18, 16);
    }
    W.button('back', G.returns.wardrobe === 'paused' ? 'Back to pause' : 'Back', 60, 650, 240, 46, { action: () => scr.back('wardrobe'), icon: 'back' });
  }

  function thumb(kind, it, x, y, owned) {
    ctx.globalAlpha = owned ? 1 : 0.55;
    if (kind === 'skin') K.blitRot(ctx, NS.shipArt.shipSprite(it.id), x, y, -Math.PI / 2 + Math.sin(G.time * 1.5) * 0.15, 1.2);
    else if (kind === 'trail') {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 7; ++k) {
        const c = it.cols[(k + Math.floor(G.time * 6)) % it.cols.length];
        ctx.globalAlpha = (owned ? 1 : 0.55) * (1 - k / 8);
        K.blit(ctx, K.glow(c), x + 40 - k * 13, y + Math.sin(G.time * 4 + k * 0.7) * 4, 0.55 - k * 0.05);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = owned ? 1 : 0.55;
      K.blitRot(ctx, NS.shipArt.shipSprite(G.save.look.skin), x + 50, y, 0, 0.8);
    } else {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; ++k) K.blitRot(ctx, K.bolt('p:' + it.id, it.ramp, 18, 4), x - 40 + ((G.time * 100 + k * 30) % 80), y, 0, 1.3);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  /* the current look, flying a slow circle */
  function preview() {
    const x = 60, y = 158, w = 320, h = 360;
    kit.panel(x, y, w, h, { accent: UI.accent });
    kit.text('CURRENT LOOK', x + 20, y + 24, 13, UI.textDim, { weight: 'bold' });
    const cx = x + w / 2, cy = y + 170;
    const a = G.time * 0.9;
    const sx = cx + Math.cos(a) * 80, sy = cy + Math.sin(a) * 80;
    const head = a + Math.PI / 2;
    const tr = COS.find('trail', G.save.look.trail) || COS.TRAILS[0];
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 1; k < 16; ++k) {
      const b = a - k * 0.09;
      ctx.globalAlpha = 0.7 * (1 - k / 16);
      K.blit(ctx, K.glow(tr.cols[k % tr.cols.length]), cx + Math.cos(b) * 80, cy + Math.sin(b) * 80, 0.5 - k * 0.02);
    }
    ctx.globalAlpha = 1;
    const sh = COS.find('shot', G.save.look.shot) || COS.SHOTS[0];
    const p = (G.time * 2) % 1;
    K.blitRot(ctx, K.bolt('p:' + sh.id, sh.ramp, 18, 4), sx + Math.cos(head) * (20 + p * 140), sy + Math.sin(head) * (20 + p * 140), head, 1.4);
    ctx.globalCompositeOperation = 'source-over';
    K.blitRot(ctx, NS.shipArt.shipSprite(G.save.look.skin), sx, sy, head, 2.2);
    const sk = COS.find('skin', G.save.look.skin);
    kit.text(sk.name, cx, y + 300, 18, '#ffffff', { align: 'center', weight: 'bold' });
    kit.text(tr.name + '  -  ' + sh.name, cx, y + 326, 12, UI.textDim, { align: 'center' });
    if (G.save.badges.length) kit.text('Badges: ' + G.save.badges.length, cx, y + 346, 12, UI.gold, { align: 'center' });
  }

  Object.assign(NS.wardrobe, {
    draw, pick, TABS
  });
})();
