/* The wardrobe and collection: tabs for skins, bomb skins and trails, a card per item with a
   live preview and its state (equipped, owned, price, or how to unlock it - a world, an
   achievement or a seasonal event), a showcase of the selected item, and buy/equip actions.
   Equipping mid-run shows at once. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { UI } = C;
  const { ACH_BY_ID, SEASONS } = NS.meta;
  const { WORLDS } = NS.story;
  const K = NS.artKit;
  const kit = NS.kit;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;

  const TABS = [['skin', 'Skins', 'shirt'], ['bomb', 'Bombs', 'bomb'], ['trail', 'Trails', 'star']];
  const CW = 150, CH = 168, GX = 80, GY = 150, COLS = 7;

  function lockText(item) {
    const u = item.unlock;
    switch (u.type) {
      case 'buy': return u.cost + ' gems';
      case 'world': return 'Clear ' + WORLDS[u.world].name;
      case 'ach': return 'Achievement: ' + ACH_BY_ID[u.ach].name;
      case 'event': return SEASONS.find(s => s.id === u.season).name + ' event';
      default: return '';
    }
  }

  function act(kind, item) {
    const save = G.save;
    if (rules.owns(save, kind, item.id)) {
      if (rules.equip(save, kind, item.id)) { NS.fx.sfx('select'); NS.save.writeSave(); }
      return;
    }
    if (item.unlock.type === 'buy') {
      if (rules.buyCosmetic(save, kind, item.id)) {
        rules.equip(save, kind, item.id);
        NS.fx.sfx('levelup');
        NS.fx.burst(640, 600, 40, '#ffd84a', 300, 0.8, 6, true);
        NS.screens.toast('New look: ' + item.name, '#ff70c0', 'shirt');
        NS.save.writeSave();
      } else NS.fx.sfx('error');
      return;
    }
    NS.fx.sfx('error');
  }

  function preview(kind, item, x, y, scale) {
    const t = G.time;
    if (kind === 'skin') {
      const s = NS.actorArt.bomber(item.id, Math.floor(t / 1.5) % 4 === 1 ? 3 : 0, Math.floor(t * 6) % 4);
      ctx.drawImage(s, x - 32 * scale, y - 40 * scale, 64 * scale, 76 * scale);
    } else if (kind === 'bomb') {
      const s = NS.itemArt.bomb(item.id, false);
      const k = scale * (1 + Math.sin(t * 6) * 0.04);
      ctx.drawImage(s, x - 28 * k, y - 34 * k, 56 * k, 60 * k);
    } else {
      if (item.color) {
        for (let i = 0; i < 9; ++i) {
          const u = ((t * 0.8 + i / 9) % 1);
          ctx.globalAlpha = 1 - u;
          K.circle(ctx, x - 40 * scale + u * 80 * scale, y + Math.sin(u * 6 + i) * 10 * scale, (5 - u * 3) * scale, item.color);
        }
        ctx.globalAlpha = 1;
      }
      const s = NS.actorArt.bomber(G.save.equip.skin, 3, Math.floor(t * 6) % 4);
      ctx.drawImage(s, x + 10 * scale, y - 40 * scale, 50 * scale, 60 * scale);
    }
  }

  function draw() {
    const save = G.save;
    kit.dim(G.back.wardrobe === 'paused' ? 0.84 : 0.45);
    kit.text('WARDROBE', 60, 44, 32, '#ffffff', { weight: 'bold', stroke: 6 });
    let owned = 0, all = 0;
    for (const tb of TABS) { owned += save.owned[tb[0]].length; all += rules.catalog(tb[0]).length; }
    kit.text('Collection ' + owned + ' / ' + all + ' - seasonal looks come back every year', 60, 78, 14, UI.textDim);
    kit.gems(save.gems, 1220, 46, 26, 'right');
    for (let i = 0; i < TABS.length; ++i) {
      const tb = TABS[i];
      const on = G.ui.wardTab === tb[0];
      kit.button('tab' + tb[0], tb[1], 600 + i * 160 - 230, 92, 150, 40, { icon: tb[2], px: 16, accent: on ? UI.gold : '#9a8aa0', action: () => { G.ui.wardTab = tb[0]; G.ui.wardSel = 0; } });
      if (on) kit.bar(600 + i * 160 - 210, 136, 110, 5, 1, UI.gold);
    }
    const kind = G.ui.wardTab;
    const list = rules.catalog(kind);
    for (let i = 0; i < list.length; ++i) card(kind, list[i], i, save);
    const sel = list[Math.min(G.ui.wardSel, list.length - 1)];
    showcase(kind, sel, save);
    kit.button('back', G.back.wardrobe === 'paused' ? 'Resume' : 'Back', 50, 656, 220, 46, { icon: 'back', accent: '#9a8aa0', action: () => G.back.wardrobe === 'paused' ? scr.setScreen('playing') : scr.back('wardrobe') });
  }

  function card(kind, item, i, save) {
    const x = GX + (i % COLS) * (CW + 10), y = GY + Math.floor(i / COLS) * (CH + 10);
    const own = rules.owns(save, kind, item.id);
    const on = save.equip[kind] === item.id;
    const hot = kit.area('c' + i, x, y, CW, CH, () => {
      if (G.ui.wardSel === i) act(kind, item);
      else G.ui.wardSel = i;
    });
    if (hot) G.ui.wardSel = i;
    kit.panel(x, y, CW, CH, { accent: on ? UI.good : hot ? UI.gold : own ? '#ffb347' : '#5a4a5a', glow: hot, radius: 12 });
    if (!own) ctx.globalAlpha = 0.45;
    preview(kind, item, x + CW / 2, y + 70, 1.1);
    ctx.globalAlpha = 1;
    kit.fitText(item.name, x + CW / 2, y + CH - 40, CW - 16, 14, { align: 'center', weight: 'bold', color: '#ffffff' });
    const status = on ? 'EQUIPPED' : own ? 'owned' : lockText(item);
    kit.fitText(status, x + CW / 2, y + CH - 18, CW - 16, 11, { align: 'center', color: on ? UI.good : own ? UI.textDim : item.unlock.type === 'buy' ? '#bff8ff' : UI.textMute });
    if (!own && item.unlock.type !== 'buy') kit.icon(item.unlock.type === 'event' ? 'gift' : 'lock', x + CW - 20, y + 20, 18, '#c8c0d0');
  }

  function showcase(kind, item, save) {
    const x = 330, y = 522, w = 900, h = 118;
    const own = rules.owns(save, kind, item.id);
    const on = save.equip[kind] === item.id;
    kit.panel(x, y, w, h, { accent: on ? UI.good : '#ffb347', glow: true });
    preview(kind, item, x + 70, y + 66, 1.4);
    kit.text(item.name, x + 150, y + 34, 22, '#ffffff', { weight: 'bold' });
    const how = own ? (on ? 'Equipped - looking sharp!' : 'Owned - equip it any time') : item.unlock.type === 'buy' ? 'Buy for ' + item.unlock.cost + ' gems' : 'Unlock: ' + lockText(item);
    kit.text(how, x + 150, y + 62, 14, own ? UI.textDim : UI.accent);
    if (item.unlock.type === 'event' && !own) kit.text('Earn it on the seasonal event track (Goals > Event)', x + 150, y + 86, 12, UI.textMute);
    const bx = x + w - 250, by = y + 36;
    if (on) kit.text('In use', bx + 115, by + 24, 17, UI.good, { align: 'center', weight: 'bold' });
    else if (own) kit.button('equip', 'Equip', bx, by, 230, 48, { icon: 'shirt', accent: UI.good, action: () => act(kind, item) });
    else if (item.unlock.type === 'buy') kit.button('buy', 'Buy  ' + item.unlock.cost, bx, by, 230, 48, { icon: 'gem', accent: UI.gold, disabled: save.gems < item.unlock.cost, action: () => act(kind, item) });
    else kit.text('Locked', bx + 115, by + 24, 17, UI.textMute, { align: 'center', weight: 'bold' });
  }

  Object.assign(NS.wardrobe, {
    draw, act, lockText
  });
})();
