/* Space Farming - the goals and orders HUD panel and the market dialog.
   Reads: G.state, G.credits, G.gameTime, G.priceMultipliers, G.inventory, G.stats, G.goalIndex, G.orders,
     G.orderTimer, G.dialogScroll, G.pointerUX, G.pointerUY */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { STATE_PLAYING, CROPS, LIVESTOCK, DAY_CYCLE_PERIOD, ctx, drawSprite, fitText, drawTextBlock, UI,
    roundRectPath, drawPanel, drawMeter, addRegion, hoverAmount, drawButton, getStorageCapacity,
    getTotalInventoryCount, getEffectiveSellPrice, getEffectiveProduceValue, getEstimatedStorageValue,
    sellAllProduce, flyCoins, techOwned, GOALS, goalNeed, orderSlots, orderSprite, canDeliver, deliverOrder,
    goalPanelLayout, beginHudPanel, endHudPanel, storageItems, reorderPassiveRegions, toast, beginDialog,
    endDialog, buildSellButtonTooltip } = NS;

  /* ── HUD: current goal and open orders under the quick panel ── */

  function drawGoalPanel(L) {
    const GP = goalPanelLayout(L);
    if (GP.y + GP.h > L.dock.y - 34) {
      // not enough room: only the goal line
      if (GP.y + 96 > L.dock.y - 34) return;
    }
    const room = L.dock.y - 34 - GP.y;
    const h = Math.min(GP.h, room);
    beginHudPanel('goals', GP.x, GP.y, GP.w, h);
    const top = drawPanel(GP.x, GP.y, GP.w, h, { title: 'Goals & orders', icon: 'target', titlePx: 14, headerH: 34, titleRight: G.goalIndex < GOALS.length ? `${G.goalIndex + 1} / ${GOALS.length}` : 'All done', titleRightColor: UI.good, accent: UI.good });
    // goal
    const g = GOALS[G.goalIndex];
    const gy = top - 2;
    if (g) {
      const need = goalNeed(g), val = Math.min(need, g.value());
      drawSprite(g.icon, GP.x + 26, gy + 20, 26);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const rw = fitText(`+${g.reward} [[coin]]`, GP.x + GP.w - 12, gy + 10, 90, 12, { weight: 'bold', color: UI.gold });
      ctx.textAlign = 'left';
      fitText(g.title, GP.x + 46, gy + 10, GP.w - 46 - 12 - rw - 8, 14, { weight: 'bold', color: UI.text });
      drawMeter(GP.x + 46, gy + 24, GP.w - 58, 14, val / need, UI.good, { label: `${g.desc}: ${Math.floor(val).toLocaleString('en-US')} / ${need.toLocaleString('en-US')}`, labelPx: 10 });
      addRegion({ id: 'goal-row', x: GP.x, y: gy, w: GP.w, h: 44, tip: () => [`[[${g.icon}]] ${g.title}`, g.desc, `Progress: ${Math.floor(val)} / ${need}`, `Reward: ${g.reward} credits`, `Goal ${G.goalIndex + 1} of ${GOALS.length}`] });
    } else {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText('[[star]] Every goal reached!', GP.x + 14, gy + 18, GP.w - 28, 14, { weight: 'bold', color: UI.gold });
    }
    // orders
    let oy = gy + 50;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(GP.x + 10, oy - 4, GP.w - 20, 1);
    if (!G.orders.length) {
      ctx.textAlign = 'left';
      fitText(`[[order]] Next trader in ${Math.ceil(Math.max(0, G.orderTimer))}s`, GP.x + 14, oy + 10, GP.w - 28, 12, { color: UI.textMute });
    }
    for (let i = 0; i < GP.shown; ++i) {
      const o = G.orders[i];
      const ry = oy + i * (GP.rowH + 4);
      if (ry + GP.rowH > GP.y + h - 4) break;
      const ok = canDeliver(o);
      const id = 'order-' + o.id;
      const hv = hoverAmount(id);
      roundRectPath(GP.x + 8, ry, GP.w - 16, GP.rowH, 8);
      ctx.fillStyle = ok ? `rgba(111,224,138,${0.14 + hv * 0.12})` : `rgba(255,255,255,${0.04 + hv * 0.05})`;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = ok ? 'rgba(111,224,138,0.6)' : 'rgba(255,255,255,0.12)';
      ctx.stroke();
      const left = (o.until - G.gameTime) / (DAY_CYCLE_PERIOD * 3);
      ctx.fillStyle = left < 0.25 ? UI.bad : 'rgba(255,215,90,0.6)';
      ctx.fillRect(GP.x + 12, ry + GP.rowH - 4, (GP.w - 24) * Math.max(0, Math.min(1, left)), 2);
      drawSprite(orderSprite(o), GP.x + 24, ry + GP.rowH / 2 - 1, 20);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const rew = fitText(`${o.reward} [[coin]]`, GP.x + GP.w - 14, ry + GP.rowH / 2 - 1, 80, 12, { weight: 'bold', color: UI.gold });
      ctx.textAlign = 'left';
      const have = Math.min(o.qty, G.inventory[o.item] || 0);
      fitText(`${have}/${o.qty} ${o.item}`, GP.x + 40, ry + GP.rowH / 2 - 1, GP.w - 40 - 22 - rew, 12, { weight: 'bold', color: ok ? UI.good : UI.text });
      addRegion({ id, x: GP.x + 8, y: ry, w: GP.w - 16, h: GP.rowH, onClick: () => deliverOrder(o, GP.x + GP.w / 2, ry + GP.rowH / 2), tip: () => orderTooltip(o) });
    }
    if (G.orders.length > GP.shown) {
      ctx.textAlign = 'left';
      fitText(`+${G.orders.length - GP.shown} more in the market (M)`, GP.x + 14, oy + GP.shown * (GP.rowH + 4) + 6, GP.w - 28, 11, { color: UI.textMute });
    }
    endHudPanel();
  }

  function orderTooltip(o) {
    const have = G.inventory[o.item] || 0;
    const secs = Math.max(0, Math.ceil(o.until - G.gameTime));
    return [`[[order]] Order: ${o.qty} × ${o.item}`, `Pays ${o.reward} credits (about ${Math.round(o.reward / o.qty)} each)`,
      have >= o.qty ? '✔ Ready: click to deliver' : `✘ You have ${have} of ${o.qty}`,
      `Expires in ${secs}s`];
  }

  /* ── Market dialog: sell single items, see prices, deliver orders ── */

  function sellItem(name) {
    if (G.state !== STATE_PLAYING) return;
    const count = G.inventory[name] || 0;
    if (!count) return;
    let price = 0;
    for (const c of CROPS)
      if (c.name === name) price = getEffectiveSellPrice(c);
    for (const l of LIVESTOCK)
      if (l.produce === name) price = getEffectiveProduceValue(l);
    const bulk = techOwned('com_broker') && count >= 20 ? 1.1 : 1;
    const earned = Math.round(count * price * bulk);
    G.credits += earned;
    G.stats.earned += earned;
    delete G.inventory[name];
    SZ.GameAudio.play('coin');
    flyCoins(Math.min(8, 2 + Math.ceil(earned / 60)), G.pointerUX, G.pointerUY);
    toast(`Sold ${count} × ${name} for ${earned} credits`, UI.gold, 'coin');
  }

  function drawMarketDialog() {
    const c = beginDialog('Market', 820, 520, { icon: 'market', accent: UI.gold, titleRight: `${Math.round(G.credits).toLocaleString('en-US')} [[coin]]`, titleRightColor: UI.gold });
    const split = c.w >= 640;
    // too narrow for two columns: a tall dialog lists the orders under the storage
    const stack = !split && c.h >= 420;
    const ordersH = stack ? Math.min(Math.round(c.h * 0.5), 24 + Math.max(1, G.orders.length) * 94) : 0;
    const leftW = split ? Math.round(c.w * 0.56) : c.w;
    const leftH = stack ? c.h - ordersH - 16 : c.h;
    const rightX = split ? c.x + leftW + 16 : c.x, rightW = split ? c.w - leftW - 16 : c.w;
    const rightY = split ? c.y : c.y + leftH + 16, rightH = split ? c.h : ordersH;
    // Storage list
    const items = storageItems();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(`[[basket]] Storage ${getTotalInventoryCount()} / ${getStorageCapacity()}`, c.x, c.y + 8, leftW - 120, 14, { weight: 'bold', color: UI.text });
    const rowH = 34;
    const listY = c.y + 24, listH = leftH - 24 - 50;
    const maxScroll = Math.max(0, items.length * (rowH + 4) - listH);
    G.dialogScroll = Math.max(0, Math.min(maxScroll, G.dialogScroll));
    ctx.save();
    ctx.beginPath();
    ctx.rect(c.x - 2, listY, leftW + 4, listH);
    ctx.clip();
    if (!items.length) {
      ctx.textAlign = 'left';
      fitText('Nothing to sell yet: harvest some crops first.', c.x + 8, listY + 20, leftW - 16, 13, { color: UI.textMute });
    }
    items.forEach((it, i) => {
      const y = listY + i * (rowH + 4) - G.dialogScroll;
      if (y + rowH < listY || y > listY + listH) return;
      roundRectPath(c.x, y, leftW, rowH, 8);
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
      ctx.fill();
      drawSprite(it.sprite, c.x + 20, y + rowH / 2, 24);
      const crop = CROPS.findIndex(cr => cr.name === it.name);
      let trend = '';
      if (crop >= 0) {
        const pm = G.priceMultipliers[crop] || 1;
        trend = pm > 1.05 ? ' ▲' : (pm < 0.95 ? ' ▼' : '');
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const bw = 92;
      fitText(it.name, c.x + 40, y + rowH / 2 - 7, leftW - 40 - bw - 120, 13, { weight: 'bold', color: UI.text });
      fitText(`${it.value} cr each${trend}`, c.x + 40, y + rowH / 2 + 8, leftW - 40 - bw - 120, 11, { color: trend === ' ▲' ? UI.good : (trend === ' ▼' ? UI.bad : UI.textDim) });
      ctx.textAlign = 'right';
      fitText(`×${it.count}`, c.x + leftW - bw - 16, y + rowH / 2, 100, 14, { weight: 'bold', color: UI.text });
      if (y >= listY && y + rowH <= listY + listH)
        drawButton({ id: 'sell-' + it.name, x: c.x + leftW - bw - 6, y: y + 4, w: bw, h: rowH - 8 }, { label: `${it.count * it.value} [[coin]]`, primary: true, color: '#59c96a', px: 12, onClick: () => sellItem(it.name), tip: () => [`Sell all ${it.name}`, `${it.count} × ${it.value} = ${it.count * it.value} credits`] });
    });
    ctx.restore();
    addRegion({ id: 'market-wheel', x: c.x, y: listY, w: leftW, h: listH, modal: true, passive: true, onWheel: (dy) => { G.dialogScroll += dy > 0 ? 50 : -50; } });
    reorderPassiveRegions();
    const total = getEstimatedStorageValue();
    drawButton({ id: 'market-sellall', x: c.x, y: c.y + leftH - 40, w: leftW, h: 36 }, { label: total ? `Sell everything · ${total} [[coin]]` : 'Sell everything', icon: 'coin', key: 'S', primary: total > 0, disabled: !total, color: '#59c96a', px: 14, onClick: sellAllProduce, tip: buildSellButtonTooltip });

    // Orders
    if (split || stack) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      if (split)
        ctx.fillRect(rightX - 9, c.y, 1, c.h);
      else
        ctx.fillRect(c.x, rightY - 9, c.w, 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      fitText(`[[order]] Orders ${G.orders.length} / ${orderSlots()}`, rightX, rightY + 8, rightW, 14, { weight: 'bold', color: UI.text });
      let y = rightY + 24;
      if (!G.orders.length)
        drawTextBlock(`Traders bring orders now and then; the next one arrives in about ${Math.ceil(Math.max(0, G.orderTimer))}s. Orders pay well above market prices.`, rightX, y + 4, rightW, 70, 12, { color: UI.textMute });
      for (const o of G.orders) {
        const h = 86;
        if (y + h > rightY + rightH) break;
        const ok = canDeliver(o);
        roundRectPath(rightX, y, rightW, h, 10);
        ctx.fillStyle = ok ? 'rgba(111,224,138,0.12)' : 'rgba(255,255,255,0.04)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = ok ? 'rgba(111,224,138,0.6)' : 'rgba(255,255,255,0.12)';
        ctx.stroke();
        drawSprite(orderSprite(o), rightX + 26, y + 26, 32);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        fitText(`${o.qty} × ${o.item}`, rightX + 50, y + 16, rightW - 60, 14, { weight: 'bold', color: UI.text });
        fitText(`Pays ${o.reward} [[coin]] · ${Math.max(0, Math.ceil(o.until - G.gameTime))}s left`, rightX + 50, y + 34, rightW - 60, 12, { color: UI.gold });
        const have = G.inventory[o.item] || 0;
        drawButton({ id: 'deliver-' + o.id, x: rightX + 10, y: y + h - 34, w: rightW - 20, h: 26 }, { label: ok ? 'Deliver' : `Have ${have} / ${o.qty}`, primary: ok, disabled: !ok, color: UI.good, px: 12, onClick: () => deliverOrder(o, rightX + rightW / 2, y + h - 20), onDisabled: () => SZ.GameAudio.play('error'), tip: () => orderTooltip(o) });
        y += h + 8;
      }
    }
    endDialog();
  }

  Object.assign(NS, { drawGoalPanel, drawMarketDialog });

})();
