/* The station's Hangar tab: liveries, mining beams and thruster plumes as cards with live
   previews on the hull you fly - equip what you own, buy with credits or research, see what
   earns the rest - and the festival track of the season running today with its tokens and the
   next reward (or when the next festival comes). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const CO = NS.cosmetics;
  const D = NS.cosmeticData;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const KINDS = [['livery', 'Liveries'], ['beam', 'Beams'], ['plume', 'Plumes']];

  function celebrate(x, y, color) {
    NS.fx.sparks(x, y, 0, TAU, 26, color, 320, 0.5);
    NS.fx.ring(x, y, 10, 90, 0.5, color, 5);
    sfx('levelup', { volume: 0.7 });
    NS.save.refreshStats();
    NS.save.writeSave();
    NS.statusBar.update();
  }

  function preview(kind, it, x, y, live) {
    const save = G.save;
    const st = G.stats;
    if (kind === 'livery') {
      const colors = Object.assign({}, NS.ships.HULL_BY_ID[st.hullId].colors, it.colors || {});
      K.blitRot(ctx, NS.shipArt.shipSprite(st.hullId, colors, live ? Math.sin(G.time * 2) * 0.3 : 0), x, y, -Math.PI / 2, 0.8);
    } else if (kind === 'beam') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      const fl = 0.85 + Math.sin(G.time * 40 + x) * 0.15;
      ctx.strokeStyle = K.rgba(it.color, 0.25); ctx.lineWidth = 12 * fl;
      ctx.beginPath(); ctx.moveTo(x - 40, y + 10); ctx.lineTo(x + 40, y - 10); ctx.stroke();
      ctx.strokeStyle = K.rgba(it.core, 0.7); ctx.lineWidth = 4 * fl; ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      K.blit(ctx, K.glow(it.color), x + 40, y - 10, 0.5);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      const c = it.color || NS.ships.HULL_BY_ID[st.hullId].colors.glow;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.7;
      K.blitRot(ctx, K.bolt('flame' + c, ['#ffffff', c, K.shade(c, -0.4)], 26, 7), x, y + 18, Math.PI / 2, 1.1 + Math.sin(G.time * 30 + x) * 0.08);
      K.blit(ctx, K.glow(c), x, y + 4, 0.6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, NS.shipArt.shipSprite(st.hullId, st.colors, 0), x, y - 14, -Math.PI / 2, 0.55);
    }
    void save;
  }

  function draw(px, py, pw, ph) {
    const save = G.save;
    const kind = G.ui.hangarKind || 'livery';
    for (let i = 0; i < KINDS.length; ++i)
      W.button('hk_' + KINDS[i][0], KINDS[i][1], px + 16 + i * 150, py + 12, 140, 30, { selected: kind === KINDS[i][0], px: 13, action: () => { G.ui.hangarKind = KINDS[i][0]; } });
    const items = CO.list(kind);
    const cols = 5, cw = (pw - 32 - (cols - 1) * 6) / cols, chh = 108;
    const eq = CO.equipped(save, kind);
    for (let i = 0; i < items.length; ++i) {
      const it = items[i];
      const x = px + 16 + (i % cols) * (cw + 6), y = py + 50 + Math.floor(i / cols) * (chh + 6);
      const own = CO.owned(save, kind, it);
      const on = eq.id === it.id;
      const buyable = !own && (it.unlock.k === 'credits' && save.credits >= it.unlock.n || it.unlock.k === 'rd' && save.rd >= it.unlock.n);
      const hot = W.area('hg_' + kind + '_' + it.id, x, y, cw, chh, () => {
        if (own) { CO.equip(save, kind, it.id); celebrate(x + cw / 2, y + 40, UI.accent); }
        else if (CO.buy(save, kind, it)) { CO.equip(save, kind, it.id); celebrate(x + cw / 2, y + 40, UI.gold); }
        else sfx('error');
      }, !own && !buyable);
      kit.panel(x, y, cw, chh, { radius: 8, accent: on ? UI.good : hot ? UI.gold : own ? UI.accent : UI.textMute, glow: on || hot, brackets: false, alpha: 0.95 });
      ctx.globalAlpha = own || buyable ? 1 : 0.45;
      preview(kind, it, x + cw / 2, y + 42, hot || on);
      ctx.globalAlpha = 1;
      kit.fitText(it.name, x + cw / 2, y + 78, cw - 10, 12, { align: 'center', weight: 'bold', color: '#ffffff' });
      kit.fitText(on ? 'EQUIPPED' : own ? 'owned - equip' : CO.unlockText(it), x + cw / 2, y + 95, cw - 10, 10, { align: 'center', color: on ? UI.good : own ? UI.accent : buyable ? UI.gold : UI.textMute, weight: on ? 'bold' : 'normal' });
      if (!own && !buyable) kit.lock(x + cw - 14, y + 14, 12);
    }
    festival(px + 16, py + ph - 76, pw - 32);
  }

  function festival(x, y, w) {
    const save = G.save;
    const se = NS.calendar.season(new Date());
    kit.panel(x, y, w, 64, { radius: 8, accent: se ? se.color : UI.textMute, brackets: false, alpha: 0.95 });
    if (!se) {
      kit.text('FESTIVALS', x + 14, y + 18, 12, UI.textMute, { weight: 'bold' });
      kit.fitText('No festival right now - six seasons a year bring a token track with their own livery, beam and plume.', x + 14, y + 42, w - 28, 12, { color: UI.textDim });
      return;
    }
    const f = save.festival.event === CO.eventId(se, new Date()) ? save.festival : { tokens: 0, claimed: 0 };
    const T = D.TIERS;
    const next = T[Math.min(f.claimed, T.length - 1)];
    kit.text(se.name.toUpperCase() + '  -  FESTIVAL TRACK', x + 14, y + 18, 12, se.color, { weight: 'bold' });
    kit.bar(x + 14, y + 32, w - 200, 10, f.claimed >= T.length ? 1 : f.tokens / next.n, se.color);
    for (let k = 0; k < T.length; ++k) kit.star(x + 14 + (w - 200) * T[k].n / T[T.length - 1].n, y + 37, 6, f.claimed > k);
    const it = next.kind === 'credits' || next.kind === 'rd' ? null : CO.festivalItem(se.id, next.kind);
    const label = f.claimed >= T.length ? 'Track complete!' : 'Next at ' + next.n + ': ' + (next.kind === 'credits' ? kit.group(next.amount) + ' credits' : next.kind === 'rd' ? next.amount + ' research' : (it ? it.name : next.kind));
    kit.fitText(f.tokens + ' tokens  -  ' + label, x + 14, y + 54, w - 200, 11, { color: '#ffffff' });
    kit.fitText('Every haul pays tokens', x + w - 14, y + 37, 170, 11, { align: 'right', color: UI.textDim });
  }

  Object.assign(NS.hangar, { KINDS, draw, preview, festival });
})();
