/* Hangar screen: ship preview, stat bars, ship cards; keyboard picking and buying.
   Owns the hangar cursor. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { SHIP_DEFS, SHIP_ORDER, shipArtFor, shipName, HANGAR_STAT_MAX } = NS.data;
  const { playSfx } = NS.audio;
  const { shipOwned, shipAvailable, buyShip } = NS.progress;
  const { ctx, fillVisible, ui } = NS.view;
  const { registerHit, isHot, drawLock } = NS.widgets;
  const { setScreen, openHelp } = NS.screens;

  let hangarCursor = 0;

  function drawHangar() {
    ctx.fillStyle = 'rgba(3,4,10,0.62)';
    fillVisible();
    ui.drawHeadline('Hangar', 640, 46, 600, 40, '#5af2ff', ui.UI.accent);
    ui.drawChip(G.save.credits + ' CR', 1256, 20, 30, { align: 'right', color: ui.UI.gold });

    const id = SHIP_ORDER[hangarCursor];
    const def = SHIP_DEFS[id];

    /* left: big preview hovering over a glowing pad */
    const padX = 300, padY = 470;
    ctx.save();
    const glow = 0.35 + 0.15 * Math.sin(G.gameTime * 0.003);
    const g = ctx.createRadialGradient(padX, padY, 10, padX, padY, 190);
    g.addColorStop(0, ui.hexToRgba('#5af2ff', glow));
    g.addColorStop(1, 'rgba(90,242,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(padX, padY, 190, 52, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const hover = Math.sin(G.gameTime * 0.002) * 8;
    const thrust = 1 + Math.floor(G.gameTime / 120) % 3;
    ctx.save();
    ctx.translate(padX, padY - 110 + hover);
    ctx.scale(3.5, 3.5);
    SZ.InvaderArt.drawShip(ctx, id, 0, 0, thrust, 0, 1);
    ctx.restore();

    /* right: the ship's name as a headline, its description, stat bars vs. the Interceptor */
    ui.drawPanel(600, 100, 640, 400, { accent: ui.UI.accent });
    ui.drawHeadline(shipName(id), 920, 134, 600, 30, shipArtFor(id).color, ui.UI.accent);
    ui.drawTextBlock(def.desc, 620, 162, 600, 44, 17, { color: ui.UI.textDim });

    const rows = [
      { label: 'Speed', v: def.speed, base: 1 },
      { label: 'Fire rate', v: 1 / def.fire, base: 1 },
      { label: 'Damage', v: def.damage, base: 1 },
      { label: 'Hull', v: 3 + def.lives, base: 3 },
    ];
    for (let i = 0; i < rows.length; ++i) {
      const r = rows[i];
      const y = 210 + i * 44;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ui.UI.textDim;
      ctx.font = ui.uiFont(15, 'bold');
      ctx.fillText(r.label, 620, y);
      const better = r.v > r.base, worse = r.v < r.base;
      ui.drawMeter(760, y - 6, 380, 12, r.v / HANGAR_STAT_MAX[r.label],
        better ? ui.UI.good : worse ? ui.UI.warn : ui.UI.accent);
      const markerX = 760 + 380 * (r.base / HANGAR_STAT_MAX[r.label]);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(markerX, y - 9);
      ctx.lineTo(markerX, y + 9);
      ctx.stroke();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = ui.UI.text;
    ctx.font = ui.uiFont(17, 'bold');
    ctx.fillText('Special: ' + def.specialName, 620, 400);

    let status, statusColor;
    if (G.save.ship === id && shipOwned(id)) {
      status = 'Selected';
      statusColor = ui.UI.good;
    } else if (shipOwned(id)) {
      status = 'Owned - Enter to select';
      statusColor = ui.UI.text;
    } else if (!shipAvailable(id)) {
      status = 'Defeat stage ' + def.unlock + ' to unlock';
      statusColor = ui.UI.warn;
    } else if (def.unlock) {
      status = 'Free - Enter to claim';
      statusColor = ui.UI.gold;
    } else {
      status = 'Buy for ' + def.price + ' credits';
      statusColor = ui.UI.gold;
    }
    ctx.fillStyle = statusColor;
    ctx.font = ui.uiFont(19, 'bold');
    ctx.fillText(status, 620, 450);

    /* bottom: five ship cards */
    for (let i = 0; i < SHIP_ORDER.length; ++i) {
      const sid = SHIP_ORDER[i];
      const sdef = SHIP_DEFS[sid];
      const x = 33 + i * 246;
      const y = 540;
      const sel = i === hangarCursor;
      const hit = registerHit('ship-' + sid, x, y, 230, 140, () => {
        if (hangarCursor !== i) {
          hangarCursor = i;
          playSfx('click', { volume: 0.4 });
        } else {
          buyShip(sid);
        }
      });
      const hot = isHot(hit, x, y, 230, 140);
      ctx.save();
      if (!shipAvailable(sid)) ctx.globalAlpha *= 0.55;
      ui.drawPanel(x, y, 230, 140, {
        accent: sel ? ui.UI.gold : hot ? ui.UI.accent : ui.UI.textMute,
        glow: sel,
      });
      SZ.InvaderArt.drawShip(ctx, sid, x + 115, y + 44, 1, 0, 1);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(shipName(sid), x + 115, y + 92, 200, 16, { weight: 'bold', color: sel ? '#ffffff' : ui.UI.text });
      let tag, tagColor;
      if (!shipAvailable(sid)) { tag = 'Stage ' + sdef.unlock; tagColor = ui.UI.warn; }
      else if (shipOwned(sid)) { tag = shipIdOwnedTag(sid); tagColor = ui.UI.good; }
      else if (sdef.unlock) { tag = 'Free - Enter'; tagColor = ui.UI.gold; }
      else { tag = sdef.price + ' CR'; tagColor = ui.UI.gold; }
      ctx.fillStyle = tagColor;
      ctx.font = ui.uiFont(13, 'bold');
      ctx.fillText(tag, x + 115, y + 116);
      if (!shipAvailable(sid)) drawLock(x + 115, y + 48, 34);
      ctx.restore();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Select ship' },
      { key: 'Enter', label: 'Buy / Select' },
      { key: 'Esc', label: 'Back' },
    ], 640, 694, 900, 1);
  }

  function shipIdOwnedTag(sid) {
    return G.save.ship === sid ? 'Selected' : 'Owned';
  }

  /* Hangar: Left/Right pick the ship, Enter buys or selects it */
  function onHangarKey(e) {
    e.preventDefault();
    if (e.code === 'Escape') {
      setScreen(G.prevScreen);
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      hangarCursor = (hangarCursor + SHIP_ORDER.length - 1) % SHIP_ORDER.length;
      playSfx('click', { volume: 0.4 });
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      hangarCursor = (hangarCursor + 1) % SHIP_ORDER.length;
      playSfx('click', { volume: 0.4 });
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
      buyShip(SHIP_ORDER[hangarCursor]);
    } else if (e.code === 'KeyH') {
      openHelp();
    }
  }

  Object.assign(NS.hangar, {
    drawHangar, onHangarKey
  });
})();
