/* The bakery view in the middle: one animated strip per owned producer, scrolled with the
   wheel or a drag - cursors tapping, grandmas rolling dough, swaying crops, mine carts,
   factory smoke, popping coins, glowing temples, wizard sparkles, launching rockets,
   bubbling flasks, swirling portals, ticking clocks, pulsing condensers, rainbow beams,
   oven heat, dream bubbles, twinkling nebulae and the spiralling singularity. Only visible
   strips are drawn; units are cached sprites. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { LAYOUT, UI, TAU } = NS.constants;
  const K = NS.artKit;
  const BA = NS.buildingArt;
  const { BUILDINGS, BY_ID } = NS.buildingData;
  const kit = NS.kit;
  const fmt = NS.format;
  const { ctx } = NS.view;

  const MAX_UNITS = 9;

  function rows() {
    const run = G.active();
    const out = [];
    for (let i = 0; i < BUILDINGS.length; ++i) if (run.buildings[BUILDINGS[i].id] > 0) out.push(BUILDINGS[i]);
    return out;
  }

  function contentHeight() {
    return rows().length * LAYOUT.rowH;
  }

  function clampScroll() {
    const max = Math.max(0, contentHeight() - (LAYOUT.sceneH - 36));
    G.ui.sceneScroll = Math.max(0, Math.min(max, G.ui.sceneScroll));
    return max;
  }

  function draw() {
    const L = LAYOUT;
    const run = G.active();
    const list = rows();
    kit.panel(L.sceneX - 8, L.sceneY - 8, L.sceneW + 16, L.sceneH + 16, { radius: 14 });
    let total = 0;
    for (const id in run.buildings) total += run.buildings[id];
    kit.text('YOUR BAKERY', L.sceneX + 6, L.sceneY + 14, 16, UI.gold, { weight: 'bold', shadow: true });
    kit.text(fmt.group(total) + ' producer' + (total === 1 ? '' : 's'), L.sceneX + L.sceneW - 6, L.sceneY + 14, 13, UI.textDim, { align: 'right' });
    const top = L.sceneY + 32, h = L.sceneH - 36;
    if (!list.length) {
      kit.text('An empty kitchen...', L.sceneX + L.sceneW / 2, top + h / 2 - 30, 22, UI.textDim, { align: 'center', weight: 'bold' });
      kit.text('Click the treat, then buy a Cursor or a', L.sceneX + L.sceneW / 2, top + h / 2 + 4, 15, UI.textMute, { align: 'center' });
      kit.text('Grandma in the store on the right.', L.sceneX + L.sceneW / 2, top + h / 2 + 24, 15, UI.textMute, { align: 'center' });
      const img = BA.unit('grandma');
      ctx.globalAlpha = 0.35;
      ctx.drawImage(img, L.sceneX + L.sceneW / 2 - 30, top + h / 2 + 50 + Math.sin(G.time * 2) * 3);
      ctx.globalAlpha = 1;
      return;
    }
    const max = clampScroll();
    NS.widgets.area('scene', L.sceneX, top, L.sceneW, h, null, { nonav: true, scroll: 'scene' });
    ctx.save();
    K.roundRect(ctx, L.sceneX, top, L.sceneW, h, 8);
    ctx.clip();
    for (let r = 0; r < list.length; ++r) {
      const y = top + r * L.rowH - G.ui.sceneScroll;
      if (y + L.rowH < top || y > top + h) continue;
      drawRow(list[r], L.sceneX, y, run.buildings[list[r].id]);
    }
    ctx.restore();
    if (max > 0) {
      const f = G.ui.sceneScroll / max;
      const bh = Math.max(30, h * h / contentHeight());
      ctx.fillStyle = 'rgba(255,220,170,0.35)';
      K.roundRect(ctx, L.sceneX + L.sceneW + 2, top + f * (h - bh), 4, bh, 2);
      ctx.fill();
    }
  }

  function drawRow(d, x, y, owned) {
    ctx.drawImage(BA.backdrop(d.id), x, y);
    const n = Math.min(MAX_UNITS, owned);
    const t = G.time;
    const img = BA.unit(d.id);
    const fresh = G.ui.lastBuy === d.id ? G.ui.lastBuyT : 0;
    const gap = 400 / Math.max(n, 3);
    for (let i = 0; i < n; ++i) {
      const ux = x + 40 + i * gap + (n < 3 ? 60 : 0), uy = y + 80;
      let dy = 0, rot = 0, sc = 1;
      const ph = t * 3 + i * 1.3;
      if (d.id === 'cursor') dy = Math.max(0, Math.sin(ph * 2)) * -6;
      else if (d.id === 'grandma') { dy = Math.abs(Math.sin(ph)) * -3; rot = Math.sin(ph) * 0.06; }
      else if (d.id === 'portal' || d.id === 'sugar-nebula') sc = 1 + Math.sin(ph) * 0.05;
      else if (d.id === 'dream-engine') dy = Math.sin(ph * 0.6) * 4;
      else if (d.id === 'shipment') dy = Math.sin(ph * 4) * 0.8;
      if (i === n - 1 && fresh > 0) sc *= 1 + fresh * 0.4;
      if (rot || sc !== 1) {
        ctx.save();
        ctx.translate(ux, uy + dy);
        ctx.rotate(rot);
        ctx.scale(sc, sc);
        ctx.drawImage(img, -30, -64);
        ctx.restore();
      } else ctx.drawImage(img, ux - 30, uy - 64 + dy);
      anim(d, ux, uy, i, t);
    }
    /* label tag */
    const label = d.name + '  x' + fmt.group(owned);
    const w = kit.width(label, 13, 'bold') + 16;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    K.roundRect(ctx, x + 6, y + 6, w, 20, 10);
    ctx.fill();
    kit.text(label, x + 14, y + 16, 13, '#ffffff', { weight: 'bold' });
    const cps = G.st ? G.st.per[d.id] * owned * NS.economy.buffMult(G.active(), 'prod') : 0;
    const ct = fmt.rate(cps) + '/s';
    const cw = kit.width(ct, 12) + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    K.roundRect(ctx, x + 434 - cw, y + 6, cw, 18, 9);
    ctx.fill();
    kit.text(ct, x + 427, y + 15, 12, UI.gold, { align: 'right' });
    if (owned > MAX_UNITS) kit.text('+' + fmt.group(owned - MAX_UNITS), x + 430, y + 74, 12, 'rgba(255,255,255,0.75)', { align: 'right', weight: 'bold' });
  }

  /* the per-producer live animation (a few primitives each) */
  function anim(d, x, y, i, t) {
    const ph = t * 2 + i * 1.7;
    switch (d.id) {
      case 'cursor': if (Math.sin(ph * 3) > 0.95) K.circle(ctx, x - 6, y - 8, 4, 'rgba(255,240,200,0.8)'); break;
      case 'farm': for (let k = 0; k < 2; ++k) { const px = x - 20 + k * 40, sw = Math.sin(ph + k) * 3; ctx.strokeStyle = '#6aa03a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px + sw, y - 12); ctx.stroke(); K.circle(ctx, px + sw, y - 13, 4, '#c8884a'); } break;
      case 'mine': { const cx = x - 26 + ((t * 30 + i * 40) % 52); ctx.fillStyle = '#5a4a40'; ctx.fillRect(cx - 7, y - 9, 14, 7); K.circle(ctx, cx - 4, y - 1, 2, '#2a2a2a'); K.circle(ctx, cx + 4, y - 1, 2, '#2a2a2a'); K.circle(ctx, cx, y - 11, 3, '#c8884a'); break; }
      case 'factory': for (let k = 0; k < 3; ++k) { const f = ((t * 0.6 + k / 3 + i * 0.21) % 1); K.circle(ctx, x + 16 + f * 10, y - 54 - f * 26, 4 + f * 7, 'rgba(220,220,230,' + (0.45 * (1 - f)) + ')'); } break;
      case 'bank': { const f = (t * 0.8 + i * 0.37) % 1; K.circle(ctx, x + Math.sin(i) * 10, y - 50 - f * 22, 4, 'rgba(255,210,90,' + (1 - f) + ')'); break; }
      case 'temple': ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25 + Math.sin(ph) * 0.15; K.blit(ctx, K.glow('#ffb45a'), x, y - 36, 0.5); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break;
      case 'wizard-tower': for (let k = 0; k < 3; ++k) { const a = ph * 1.5 + k * 2.1; K.circle(ctx, x + Math.cos(a) * 18, y - 40 + Math.sin(a) * 8, 1.8, k % 2 ? '#b8f0ff' : '#ffd25a'); } break;
      case 'shipment': { const f = (t * 0.25 + i * 0.29) % 1; if (f > 0.75) { const k = (f - 0.75) * 4; K.circle(ctx, x, y - 4 + k * 4, 4 + k * 6, 'rgba(255,160,60,' + (0.8 - k * 0.6) + ')'); } break; }
      case 'alchemy-lab': for (let k = 0; k < 2; ++k) { const f = (t * 0.9 + k * 0.5 + i * 0.3) % 1; K.circle(ctx, x - 3 + k * 6, y - 14 - f * 40, 2 + f * 2, 'rgba(160,255,200,' + (1 - f) + ')'); } break;
      case 'portal': ctx.strokeStyle = 'rgba(96,255,216,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 28, 9, ph * 2, ph * 2 + 2.5); ctx.stroke(); break;
      case 'time-machine': ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x + Math.cos(t * 3 + i) * 10, y - 30 + Math.sin(t * 3 + i) * 10); ctx.moveTo(x, y - 30); ctx.lineTo(x + Math.cos(t * 0.3 + i) * 6, y - 30 + Math.sin(t * 0.3 + i) * 6); ctx.stroke(); break;
      case 'condenser': ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4 + Math.sin(ph * 2) * 0.3; K.blit(ctx, K.glow('#40d0ff'), x, y - 26, 0.35); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break;
      case 'prism': { ctx.globalCompositeOperation = 'lighter'; const cols = ['#ff4a4a', '#ffe03a', '#4ae07a', '#4ab4ff', '#a05aff']; for (let k = 0; k < cols.length; ++k) { ctx.strokeStyle = K.rgba(cols[k], 0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 6, y - 26); ctx.lineTo(x + 40, y - 40 + k * 6 + Math.sin(ph) * 6); ctx.stroke(); } ctx.globalCompositeOperation = 'source-over'; break; }
      case 'fractal-oven': ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3 + Math.sin(ph * 1.5) * 0.15; K.blit(ctx, K.glow('#ff8a3a'), x, y - 22, 0.45); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; break;
      case 'dream-engine': { const f = (t * 0.5 + i * 0.4) % 1; kit.text('z', x + 12 + f * 10, y - 50 - f * 20, 10 + f * 6, 'rgba(255,255,255,' + (1 - f) + ')', { weight: 'bold' }); break; }
      case 'sugar-nebula': if (Math.sin(ph * 2.3) > 0.6) { K.star(ctx, x + Math.cos(ph) * 14, y - 30 + Math.sin(ph) * 10, 4, 0.3, 4); ctx.fillStyle = '#ffffff'; ctx.fill(); } break;
      case 'cake-singularity': for (let k = 0; k < 3; ++k) { const f = (t * 0.7 + k / 3 + i * 0.2) % 1, a = f * TAU * 1.5 + k * 2; K.circle(ctx, x + Math.cos(a) * 26 * (1 - f), y - 28 + Math.sin(a) * 10 * (1 - f), 1.8, 'rgba(255,210,90,' + (1 - f) + ')'); } break;
      default: break;
    }
  }

  Object.assign(NS.sceneRender, { rows, contentHeight, clampScroll, draw, BY_ID });
})();
