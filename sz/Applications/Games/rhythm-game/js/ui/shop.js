/* The shop: Today's Offers (three cosmetics at 30% off, a countdown to tomorrow's), Boosters (bought
   in packs of one and five), Songs (the Record Shop) and Record Crates (bought with discs or crystals,
   opened with a reveal - three cards flip one by one with their rarity, a burst and a sound, legendaries
   with a shower; duplicates turn into discs, and the pity counter shows how close an epic is). Every
   item shows a live preview: the note in its skin, the highway, the effect, the performer. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const P = NS.progress;
  const M = NS.metaData;
  const SD = NS.songData;
  const { UI } = C;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const TABS = ['Offers', 'Boosters', 'Songs', 'Crates'];

  /* a small live preview of a cosmetic */
  function preview(slot, item, x, y, s) {
    s = s || 1;
    if (slot === 'note') { K.blit(ctx, NS.notesArt.note(item.shape, Math.floor(G.time) % 4, 'tap'), x, y, 1.2 * s); return; }
    if (slot === 'highway') {
      ctx.save();
      const gr = ctx.createLinearGradient(0, y - 40 * s, 0, y + 40 * s);
      gr.addColorStop(0, item.base); gr.addColorStop(1, K.shade(item.base, 0.15));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.moveTo(x - 20 * s, y - 40 * s); ctx.lineTo(x + 20 * s, y - 40 * s); ctx.lineTo(x + 50 * s, y + 40 * s); ctx.lineTo(x - 50 * s, y + 40 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = item.edge; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = item.line; ctx.lineWidth = 1;
      for (let i = 1; i < 4; ++i) { ctx.beginPath(); ctx.moveTo(x - 20 * s + i * 10 * s, y - 40 * s); ctx.lineTo(x - 50 * s + i * 25 * s, y + 40 * s); ctx.stroke(); }
      const k = (G.time * 0.8) % 1;
      ctx.beginPath(); ctx.moveTo(x - (20 + 30 * k) * s, y + (-40 + 80 * k) * s); ctx.lineTo(x + (20 + 30 * k) * s, y + (-40 + 80 * k) * s); ctx.stroke();
      ctx.restore();
      return;
    }
    if (slot === 'effect') {
      ctx.save();
      const kind = NS.fx.KINDS[item.kind] != null ? NS.fx.KINDS[item.kind] : item.kind === 'ring' ? 4 : 9;
      for (let i = 0; i < 8; ++i) {
        const a = i / 8 * C.TAU + G.time, rr = (18 + ((G.time * 30 + i * 7) % 26)) * s;
        ctx.globalAlpha = 1 - rr / (44 * s);
        const img = NS.fxRender.partSprite(kind, item.tint || C.LANE_COLORS[i % 4]);
        ctx.drawImage(img, x + Math.cos(a) * rr - 10 * s, y + Math.sin(a) * rr - 10 * s, 20 * s, 20 * s);
      }
      ctx.restore();
      return;
    }
    if (slot === 'performer') NS.actors.performer(ctx, item.id, x, y + 60 * s, 0.38 * s, { bob: (G.time * 2) % 1 });
  }

  function draw() {
    const p = G.profile;
    kit.text('SHOP', 40, 40, 30, '#ffffff', { weight: 'bold', shadow: true });
    kit.chip('disc', p.discs.toLocaleString('en-US'), 960, 22, UI.disc, 140);
    kit.chip('crystal', p.crystals.toLocaleString('en-US'), 1110, 22, UI.crystal, 130);
    TABS.forEach((t, i) => W.button('shop-tab-' + i, t + (i === 3 && p.crates.owned ? ' (' + p.crates.owned + ')' : ''), 220 + i * 170, 16, 160, 44, { selected: G.ui.shopTab === i, px: 15, action: () => { G.ui.shopTab = i; G.ui.scroll = 0; } }));
    const tab = G.ui.shopTab;
    if (tab === 0) offers();
    else if (tab === 1) boosters();
    else if (tab === 2) songs();
    else crates();
    W.button('back', 'Back', 40, 650, 200, 48, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
    if (G.ui.crate) drawReveal();
  }

  function offers() {
    const p = G.profile;
    const list = P.dailyOffers(p, G.today);
    const now = new Date();
    const left = 24 * 60 - (now.getHours() * 60 + now.getMinutes());
    kit.text('TODAY\'S OFFERS - new ones in ' + Math.floor(left / 60) + 'h ' + (left % 60) + 'm', 60, 100, 16, UI.gold, { weight: 'bold' });
    if (!list.length) kit.text('You own everything the shop could offer. Impressive.', 60, 160, 16, UI.textDim);
    list.forEach((o, i) => {
      const x = 60 + i * 400, y = 130, w = 380, h = 440;
      const R = M.RARITY[o.item.rarity];
      kit.panel(x, y, w, h, { accent: R.color, glow: true });
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; K.blit(ctx, K.glow(R.color), x + w / 2, y + 150, 2); ctx.restore();
      preview(o.slot, o.item, x + w / 2, y + 150, 1.6);
      kit.text(o.item.name, x + w / 2, y + 290, 24, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text(R.name + ' ' + o.slot, x + w / 2, y + 320, 14, R.color, { align: 'center', weight: 'bold' });
      kit.text(o.was + ' crystals', x + w / 2, y + 352, 14, UI.textMute, { align: 'center' });
      ctx.fillStyle = UI.textMute; ctx.fillRect(x + w / 2 - 45, y + 352, 90, 1.5);
      W.button('offer-' + i, 'Buy for ' + o.price, x + 40, y + h - 70, w - 80, 52, { icon: 'crystal', accent: UI.crystal, disabled: p.crystals < o.price,
        action: () => { if (P.buyCosmetic(p, o.item, o.price)) { sfx('powerup'); NS.fx.burst(x + w / 2, y + 150, 50, [R.color, '#ffffff'], 'star', 360, 200, 7); NS.screens.toast(o.item.name + ' unlocked!', R.color, 'palette'); NS.save.saveProfile(p); } } });
    });
  }

  function boosters() {
    const p = G.profile;
    kit.text('Boosters are used up when a song starts with them. Pick them on the stage or song card.', 60, 100, 14, UI.textDim);
    M.BOOSTERS.forEach((b, i) => {
      const x = 60 + (i % 3) * 400, y = 130 + Math.floor(i / 3) * 250, w = 380, h = 230;
      kit.panel(x, y, w, h, { accent: b.color });
      kit.icon(b.icon, x + 50, y + 56, 48, b.color);
      kit.text(b.name, x + 100, y + 44, 22, '#ffffff', { weight: 'bold' });
      kit.text('You have ' + (p.boosters[b.id] || 0), x + 100, y + 72, 14, UI.gold, { weight: 'bold' });
      kit.wrap(b.desc, x + 24, y + 110, w - 48, 14, UI.textDim);
      const one = Math.round(b.price * P.discount(p)), five = Math.round(b.price * 5 * 0.85 * P.discount(p));
      W.button('bb1-' + b.id, '1 for ' + one, x + 20, y + h - 62, 160, 44, { icon: 'disc', px: 14, accent: UI.disc, disabled: p.discs < one, action: () => { if (P.buyBooster(p, b.id, 1)) { sfx('coin'); NS.save.saveProfile(p); } } });
      W.button('bb5-' + b.id, '5 for ' + five, x + 196, y + h - 62, 164, 44, { icon: 'disc', px: 14, accent: UI.disc, disabled: p.discs < five,
        action: () => { if (p.discs >= five) { p.discs -= five; p.boosters[b.id] = (p.boosters[b.id] || 0) + 5; sfx('coin'); NS.save.saveProfile(p); } } });
    });
  }

  function songs() {
    const p = G.profile;
    SD.SHOP.forEach((s, i) => {
      const x = 60 + (i % 4) * 296, y = 100 + Math.floor(i / 4) * 176, w = 280, h = 160;
      const owned = !!p.owned.songs[s.id];
      const price = Math.round(s.price * P.discount(p));
      kit.panel(x, y, w, h, { accent: owned ? UI.good : UI.disc });
      kit.icon('music', x + 30, y + 34, 26, owned ? UI.good : UI.disc);
      kit.fitText(s.name, x + 56, y + 30, w - 70, 17, { weight: 'bold', color: '#ffffff' });
      const R = SZ.GameMusic.resolve(s);
      kit.text(R.style + ' - ' + Math.round(R.bpm) + ' bpm', x + 56, y + 52, 12, UI.textDim);
      W.button('hear-' + s.id, 'Listen', x + 20, y + h - 52, 110, 38, { icon: 'speaker', px: 13, action: () => { G.ui.preview = s; SZ.GameMusic.play(s); } });
      if (owned) kit.text('Owned', x + w - 30, y + h - 32, 15, UI.good, { align: 'right', weight: 'bold' });
      else W.button('bs-' + s.id, String(price), x + 140, y + h - 52, w - 160, 38, { icon: 'disc', px: 14, accent: UI.disc, disabled: p.discs < price,
        action: () => { if (P.buySong(p, s)) { sfx('coin'); NS.screens.toast(s.name + ' added to Free Play', UI.disc, 'music'); NS.save.saveProfile(p); } } });
    });
  }

  function crates() {
    const p = G.profile;
    const x = 80, y = 110;
    kit.panel(x, y, 520, 470, { accent: '#ff7ad8', glow: true });
    crateArt(x + 260, y + 170, 1.4, 0);
    kit.text('RECORD CRATE', x + 260, y + 300, 26, '#ffffff', { align: 'center', weight: 'bold' });
    kit.text('Three items: performers, note skins, highways, hit effects, boosters, discs', x + 260, y + 330, 13, UI.textDim, { align: 'center' });
    const pityAt = M.CRATE.pity - Math.round(P.stat(p, 'crateLuck'));
    kit.text('Epic or better guaranteed within ' + Math.max(1, pityAt - p.crates.pity) + ' crate' + (pityAt - p.crates.pity > 1 ? 's' : ''), x + 260, y + 356, 13, UI.crystal, { align: 'center', weight: 'bold' });
    const dp = Math.round(M.CRATE.discs * P.discount(p));
    W.button('crate-discs', 'Buy for ' + dp, x + 30, y + 390, 220, 52, { icon: 'disc', accent: UI.disc, disabled: p.discs < dp, action: () => { if (P.buyCrate(p, 'discs')) { sfx('coin'); NS.save.saveProfile(p); } } });
    W.button('crate-crys', 'Buy for ' + M.CRATE.crystals, x + 270, y + 390, 220, 52, { icon: 'crystal', accent: UI.crystal, disabled: p.crystals < M.CRATE.crystals, action: () => { if (P.buyCrate(p, 'crystals')) { sfx('coin'); NS.save.saveProfile(p); } } });
    kit.panel(640, y, 560, 470, { accent: UI.gold });
    kit.text('Crates waiting: ' + p.crates.owned, 920, y + 60, 26, '#ffffff', { align: 'center', weight: 'bold' });
    kit.text('Opened so far: ' + p.crates.opened, 920, y + 94, 14, UI.textDim, { align: 'center' });
    for (let i = 0; i < Math.min(6, p.crates.owned); ++i) crateArt(760 + i * 54, y + 200 + Math.sin(G.time * 3 + i) * 4, 0.5, i);
    W.button('crate-open', 'Open a Crate', 760, y + 300, 320, 64, { icon: 'gift', accent: '#ff7ad8', px: 22, disabled: p.crates.owned <= 0, action: openOne });
    kit.wrap('Odds per item: Common 70%, Rare 22%, Epic 7%, Legendary 1%. Items you own already turn into discs.', 680, y + 400, 480, 12, UI.textDim);
  }

  function crateArt(x, y, s, seed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.rotate(Math.sin(G.time * 2 + seed) * 0.04);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4;
    K.blit(ctx, K.glow('#ff7ad8'), 0, 0, 1.3);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#3a1a4a'; K.roundRect(ctx, -60, -40, 120, 80, 10); ctx.fill();
    ctx.strokeStyle = '#ff7ad8'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#14081c';
    for (let i = 0; i < 4; ++i) ctx.fillRect(-48 + i * 26, -50, 20, 14);
    K.circle(ctx, 0, 4, 20, '#0a0a10');
    K.circle(ctx, 0, 4, 7, UI.gold);
    ctx.restore();
  }

  function openOne() {
    const p = G.profile;
    const rolls = P.openCrate(p, (Date.now() ^ (p.crates.opened * 2654435761)) >>> 0);
    if (!rolls) return;
    G.ui.crate = { rolls: rolls, t: 0, shown: 0, next: 0.6 };
    sfx('whoosh');
    NS.save.saveProfile(p);
  }

  function updateReveal(dt) {
    const c = G.ui.crate;
    if (!c) return;
    c.t += dt;
    if (c.shown < c.rolls.length && c.t >= c.next) {
      const r = c.rolls[c.shown];
      const x = 340 + c.shown * 300, y = 360;
      const col = M.RARITY[r.rarity].color;
      NS.fx.burst(x, y, r.rarity === 'legendary' ? 90 : r.rarity === 'epic' ? 50 : 20, [col, '#ffffff'], r.rarity === 'common' ? 'spark' : 'star', 360, 260, 7);
      if (r.rarity === 'legendary') { NS.fx.flash(0.8, col); NS.fx.shake(12); sfx('win'); if (SZ.GameMusic) SZ.GameMusic.stinger('rare'); }
      else if (r.rarity === 'epic') { NS.fx.flash(0.4, col); sfx('levelup'); }
      else sfx('pickup', { pitch: r.rarity === 'rare' ? 1.2 : 1 });
      ++c.shown;
      c.next = c.t + 0.75;
    }
  }

  function drawReveal() {
    const c = G.ui.crate;
    W.beginFrame();
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(4,2,12,0.82)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.text('RECORD CRATE', 640, 110, 34, '#ffffff', { align: 'center', weight: 'bold', shadow: true });
    c.rolls.forEach((r, i) => {
      const x = 340 + i * 300, y = 360;
      const open = i < c.shown;
      const flip = open ? Math.min(1, (c.t - (0.6 + i * 0.75)) * 4) : 0;
      const col = M.RARITY[r.rarity].color;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(Math.abs(Math.cos(flip * Math.PI)) * (flip < 0.5 ? 1 : 1) || 0.02, 1);
      const face = flip >= 0.5;
      kit.panel(-120, -170, 240, 340, { accent: face ? col : '#ff7ad8', glow: true, top: face ? undefined : 'rgba(70,20,80,0.97)' });
      if (!face) crateArt(0, 0, 0.9, i);
      else {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; K.blit(ctx, K.glow(col), 0, -40, 1.8); ctx.restore();
        if (r.type === 'cosmetic') preview(r.slot, r.item, 0, -50, 1.2);
        else kit.icon(r.type === 'discs' ? 'disc' : M.BOOSTER_BY_ID[r.id].icon, 0, -50, 64, r.type === 'discs' ? UI.disc : M.BOOSTER_BY_ID[r.id].color);
        const name = r.type === 'cosmetic' ? r.item.name : r.type === 'discs' ? r.n + ' discs' : r.n + ' x ' + M.BOOSTER_BY_ID[r.id].name;
        kit.fitText(name, 0, 70, 220, 20, { align: 'center', weight: 'bold', color: '#ffffff' });
        kit.text(M.RARITY[r.rarity].name + (r.type === 'cosmetic' ? ' ' + r.slot : ''), 0, 98, 14, col, { align: 'center', weight: 'bold' });
        if (r.dup) kit.text('Duplicate: +' + r.refund + ' discs', 0, 126, 13, UI.disc, { align: 'center' });
        else if (r.type === 'cosmetic') kit.text('NEW!', 0, 126, 16, UI.good, { align: 'center', weight: 'bold' });
      }
      ctx.restore();
    });
    if (c.shown >= c.rolls.length) {
      const p = G.profile;
      if (p.crates.owned > 0) W.button('crate-again', 'Open another (' + p.crates.owned + ')', 440, 600, 240, 52, { icon: 'gift', accent: '#ff7ad8', action: openOne });
      W.button('crate-done', 'Great!', p.crates.owned > 0 ? 700 : 540, 600, 200, 52, { accent: UI.gold, action: () => { G.ui.crate = null; } });
    } else W.area('crate-skip', v.x0, v.y0, v.w, v.h, () => { c.next = 0; c.t += 0.75; });
    NS.fxRender.draw();
  }

  Object.assign(NS.shop, { TABS, preview, draw, offers, boosters, songs, crates, crateArt, openOne, updateReveal, drawReveal });
})();
