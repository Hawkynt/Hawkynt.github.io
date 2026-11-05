;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The Wardrobe: three tabs (Birds with their perks, Hats, Trails), a pedestal where the
     selected look flies a loop with its trail, an info panel with the perk or the unlock
     hint, and the item grid. Enter / click buys, claims or wears the selected item.
     Owns G.wardrobeTab and G.aviaryIndex. */

  const { CANVAS_W, BIRD_DEFS, HATS, TRAILS, THEMES } = NS.C;
  const { ctx, ui, particles, sfx } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Menu = NS.menu;
  const Shapes = NS.shapes;
  const Fx = NS.fx;

  const TABS = [
    { id: 'birds', name: 'Birds', list: BIRD_DEFS },
    { id: 'hats', name: 'Hats', list: HATS },
    { id: 'trails', name: 'Trails', list: TRAILS },
    { id: 'themes', name: 'Themes', list: THEMES }
  ];

  function tab() {
    return TABS[G.wardrobeTab];
  }

  function setTab(i) {
    G.wardrobeTab = (i + TABS.length) % TABS.length;
    const t = tab();
    const cur = Prog.currentOf(t.id);
    G.aviaryIndex = Math.max(0, t.list.findIndex(d => d.id === cur));
    G.menuCursor = 0;
    sfx('click', { volume: 0.4 });
  }

  function selected() {
    const t = tab();
    return t.list[Math.min(G.aviaryIndex, t.list.length - 1)];
  }

  function useSelected() {
    const t = tab();
    const def = selected();
    if (Prog.useItem(t.id, def.id)) {
      particles.confetti(320, 380, 30);
      particles.ring(320, 380, '#ffd75a', 6, 0.4);
    }
  }

  function drawPedestal(t) {
    const tb = tab();
    const def = selected();
    const birdId = tb.id === 'birds' ? def.id : Prog.currentBird();
    const hat = tb.id === 'hats' ? def.id : Prog.currentHat();
    const trail = tb.id === 'trails' ? def.id : Prog.currentTrail();
    const px = 320, py = 380;
    const glow = ctx.createRadialGradient(px, py, 20, px, py, 170);
    glow.addColorStop(0, 'rgba(255,215,90,0.35)');
    glow.addColorStop(1, 'rgba(255,215,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(px - 170, py - 170, 340, 340);
    ctx.fillStyle = 'rgba(255,215,90,0.16)';
    ctx.beginPath();
    ctx.ellipse(px, py + 110, 130, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,215,90,0.5)';
    ctx.stroke();
    // the bird flies a small loop so the trail shows
    const bx = px + Math.cos(t * 1.6) * 60, by = py - 10 + Math.sin(t * 3.2) * 26;
    const ang = 0.15 * Math.cos(t * 3.2);
    if (trail !== 'none')
      Fx.emitTrail(1 / 60, bx - 30, by, 4, trail);
    particles.draw(ctx);
    SZ.FlappyBirdArt.drawBird(ctx, { x: bx, y: by, angle: ang, birdId: birdId, frame: t * 10, scale: 4 });
    if (hat !== 'none')
      SZ.FlappyCosmeticArt.drawHat(ctx, { x: bx, y: by, angle: ang, hatId: hat, scale: 4 });
  }

  function statusOf(kind, def) {
    const st = Prog.itemState(kind, def);
    const cur = Prog.currentOf(kind);
    if (def.id === cur)
      return { text: 'Wearing', color: ui.UI.good, st: st };
    if (st === 'owned')
      return { text: 'Owned - Enter to wear', color: ui.UI.text, st: st };
    if (st === 'free')
      return { text: 'Unlocked - Enter to claim', color: ui.UI.good, st: st };
    if (st === 'buy')
      return { text: 'Buy for ' + def.price, color: G.save.coins >= def.price ? ui.UI.gold : ui.UI.bad, st: st };
    return { text: Prog.unlockHint(kind, def), color: ui.UI.warn, st: st };
  }

  function drawTrailIcon(id, x, y) {
    const shapes = { sparkle: ['star', '#ffd84a'], hearts: ['heart', '#ff5a8a'], stars: ['star', '#ffe14a'], rainbow: ['glow', '#ff4ad8'],
      embers: ['glow', '#ff7a2a'], notes: ['note', '#7a5aff'], fireworks: ['glow', '#4ad8ff'], snow: ['flake', '#ffffff'],
      petals: ['petal', '#ffb0d8'], bubbles: ['bubble', '#9ae8ff'], leaves: ['leaf', '#e87a2a'], ghosts: ['ghost', '#f0f0ff'] };
    const s = shapes[id];
    if (!s) {
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.moveTo(x - 10, y + 10);
      ctx.lineTo(x + 10, y - 10);
      ctx.stroke();
      return;
    }
    const img = SZ.FlappyParticles.sprite(s[0], s[1]);
    for (let k = 0; k < 4; ++k) {
      const sz = 8 + k * 3;
      ctx.globalAlpha = 0.4 + k * 0.2;
      ctx.drawImage(img, x - 36 + k * 20 - sz, y + Math.sin(k + G.globalTime * 3) * 4 - sz, sz * 2, sz * 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawAviaryScreen() {
    const t = G.globalTime;
    const tb = tab();
    ui.drawHeadline('Wardrobe', 640, 52, 500, 44, ui.UI.gold);
    Shapes.drawCoinChip(G.save.coins, CANVAS_W - 24, 20);

    // tabs
    for (let i = 0; i < TABS.length; ++i) {
      const x = 560 + i * 172, y = 96, w = 164, h = 40;
      const active = i === G.wardrobeTab;
      const own = G.save[TABS[i].id].length;
      const idx = Menu.registerHit('tab' + i, x, y, w, h, () => setTab(i), false);
      const hot = Menu.isHot(idx, x, y, w, h);
      ui.roundRectPath(x, y, w, h, 8);
      ctx.fillStyle = active ? 'rgba(255,215,90,0.35)' : hot ? 'rgba(255,255,255,0.14)' : 'rgba(10,14,30,0.7)';
      ctx.fill();
      if (active) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = ui.UI.gold;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(TABS[i].name + '  ' + own + '/' + TABS[i].list.length, x + w / 2, y + h / 2 + 1, w - 16, 17, { weight: 'bold', color: active ? '#ffffff' : ui.UI.text });
    }

    drawPedestal(t);

    // info panel
    const def = selected();
    const rx = 560, ry = 150, rw = 680, rh = 190;
    ui.drawPanel(rx, ry, rw, rh, { accent: ui.UI.gold });
    ui.drawHeadline(Prog.itemName(tb.id, def.id), rx + rw / 2, ry + 48, rw - 80, 38, ui.UI.text);
    const desc = tb.id === 'birds' ? def.perk : tb.id === 'hats' ? 'A hat for every bird. Shows in every mode and in the story.' :
      tb.id === 'trails' ? 'Drawn behind your bird while it flies. FEVER turns it into a rainbow.' :
      def.id === 'auto' ? 'The scenery follows the calendar\'s seasonal events.' : 'Keep this event\'s scenery, decor and weather all year round.';
    ui.drawTextBlock(desc, rx + 40, ry + 80, rw - 80, 48, 19, { color: ui.UI.textDim, align: 'center', valign: 'middle' });
    const stt = statusOf(tb.id, def);
    Menu.drawButton('w-use', stt.text, rx + rw / 2 - 200, ry + rh - 58, 400, 44, {
      action: useSelected, disabled: stt.st === 'locked' || (stt.st === 'buy' && G.save.coins < def.price), px: 18
    });

    // item grid
    const cols = tb.list.length > 14 ? 8 : 7;
    const cw = Math.floor((1232 - (cols - 1) * 10) / cols), ch = 108;
    for (let i = 0; i < tb.list.length; ++i) {
      const d = tb.list[i];
      const cx = 24 + (i % cols) * (cw + 10), cy = 452 + Math.floor(i / cols) * (ch + 10);
      const idx = Menu.registerHit('item' + i, cx, cy, cw, ch, () => {
        if (G.aviaryIndex === i)
          useSelected();
        else {
          G.aviaryIndex = i;
          sfx('click', { volume: 0.4 });
        }
      }, false);
      const hot = Menu.isHot(idx, cx, cy, cw, ch);
      const st = Prog.itemState(tb.id, d);
      const cur = Prog.currentOf(tb.id) === d.id;
      ctx.save();
      ui.drawPanel(cx, cy, cw, ch, { radius: 8, noStuds: true, accent: cur ? ui.UI.good : hot ? ui.UI.gold : ui.UI.accent, glow: hot });
      if (st === 'locked')
        ctx.globalAlpha *= 0.45;
      if (tb.id === 'birds') {
        SZ.FlappyBirdArt.drawBird(ctx, { x: cx + cw / 2, y: cy + 42, birdId: d.id, frame: t * 8, scale: 1.5 });
      } else if (tb.id === 'hats') {
        SZ.FlappyBirdArt.drawBird(ctx, { x: cx + cw / 2, y: cy + 50, birdId: Prog.currentBird(), frame: 1, scale: 1.3 });
        if (d.id !== 'none')
          SZ.FlappyCosmeticArt.drawHat(ctx, { x: cx + cw / 2, y: cy + 50, hatId: d.id, scale: 1.3 });
      } else if (tb.id === 'trails') {
        drawTrailIcon(d.id, cx + cw / 2, cy + 44);
      } else if (d.id === 'auto') {
        for (let k = 0; k < 4; ++k) {
          const id = SZ.FlappySeasons.EVENT_ORDER[(k + Math.floor(t)) % 6];
          ctx.drawImage(SZ.FlappySeasonArt.getToken(id), cx + cw / 2 - 64 + k * 30, cy + 26, 34, 34);
        }
      } else {
        ctx.drawImage(SZ.FlappySeasonArt.getDecor(d.id), cx + cw / 2 - 52, cy + 6, 66, 61);
        ctx.drawImage(SZ.FlappySeasonArt.getToken(d.id), cx + cw / 2 + 8, cy + 20, 40, 40);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(Prog.itemName(tb.id, d.id), cx + cw / 2, cy + 82, cw - 12, 14, { weight: 'bold', color: ui.UI.text });
      if (st === 'locked')
        Shapes.drawLock(cx + cw / 2, cy + 98, 14);
      else if (st === 'buy')
        ui.fitText(String(d.price), cx + cw / 2, cy + 98, cw - 12, 12, { weight: 'bold', color: ui.UI.gold });
      else
        ui.fitText(cur ? 'Wearing' : st === 'free' ? 'Claim!' : 'Owned', cx + cw / 2, cy + 98, cw - 12, 11, { color: cur ? ui.UI.good : ui.UI.textDim });
      if (i === G.aviaryIndex) {
        ui.roundRectPath(cx - 3, cy - 3, cw + 6, ch + 6, 10);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      ctx.restore();
    }

    Menu.drawBackButton();
    ui.drawKeyHints([
      { key: 'Tab', label: 'Tab' },
      { key: '←→', label: 'Item' },
      { key: 'Enter', label: 'Buy / Wear' },
      { key: 'Esc', label: 'Back' }
    ], 640, 704, 900, 1);
  }

  Object.assign(NS.aviary, { TABS, tab, setTab, selected, useSelected, drawAviaryScreen });
})();
