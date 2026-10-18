/* Space Farming - HUD panels: farm (credits, storage, energy), storage list and clock.
   Reads: G.dayCount, G.weatherType, G.weatherTimer, G.weatherInterval, G.currentSeason, G.dayPhase,
     G.energy, G.rainMakerDay, G.storagePulse, G.creditsShown, G.creditsPulse, G.creditsDelta,
     G.creditsDeltaT */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { WEATHER_NONE, SEASONS, SEASON_DURATION, SEASON_SPRITES, DAY_CYCLE_PERIOD, ctx, drawSprite, fitText,
    UI, hexToRgba, roundRectPath, drawPanel, drawMeter, addRegion, drawButton, getStorageCapacity,
    getTotalInventoryCount, getEnergyMax, getEnergyRegenRate, getEstimatedStorageValue, sellAllProduce,
    canCallRain, callRain, forecastWeather, techOwned, SEASON_COLORS, beginHudPanel, endHudPanel,
    storageItems, WEATHER_INFO, weatherInfo, toggleDialog, buildSellButtonTooltip, buildClockTooltip,
    buildWeatherTooltip } = NS;

  /* ── Farm panel: credits, storage, energy ── */

  function drawFarmPanel(L) {
    const r = L.farm;
    beginHudPanel('farm', r.x, r.y, r.w, r.h);
    drawPanel(r.x, r.y, r.w, r.h, { accent: UI.gold });
    // Credits
    const pulse = 1 + G.creditsPulse * 0.18;
    ctx.save();
    ctx.translate(r.x + 26, r.y + 26);
    ctx.scale(pulse, pulse);
    drawSprite('coin', 0, 0, 28);
    ctx.restore();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const credW = fitText(Math.round(G.creditsShown).toLocaleString('en-US'), r.x + 46, r.y + 27, r.w - 56 - 60, 26, { weight: 'bold', color: UI.gold, outline: 'rgba(0,0,0,0.6)' });
    if (G.creditsDeltaT > 0 && G.creditsDelta) {
      ctx.save();
      ctx.globalAlpha *= Math.min(1, G.creditsDeltaT);
      ctx.textAlign = 'left';
      fitText((G.creditsDelta > 0 ? '+' : '') + G.creditsDelta, r.x + 52 + credW, r.y + 27 - (1 - Math.min(1, G.creditsDeltaT)) * 8, r.x + r.w - 10 - (r.x + 52 + credW), 14, { weight: 'bold', color: G.creditsDelta > 0 ? UI.good : UI.bad });
      ctx.restore();
    }
    addRegion({ id: 'hud-credits', x: r.x, y: r.y, w: r.w, h: 48, tip: () => [
      '[[coin]] Credits',
      'Earned by selling produce, orders and building income.',
      'Spent on seeds, buildings, animals and upgrades.'
    ] });

    // Storage
    const cap = getStorageCapacity();
    const used = getTotalInventoryCount();
    const full = used >= cap;
    drawSprite('basket', r.x + 20, r.y + 63, 18 * (1 + G.storagePulse * 0.35));
    drawMeter(r.x + 36, r.y + 55, r.w - 48, 16, used / cap, full ? UI.bad : (used / cap > 0.8 ? UI.warn : '#7ed46a'), { label: `${used} / ${cap}`, labelPx: 11 });
    addRegion({ id: 'hud-storage', x: r.x, y: r.y + 50, w: r.w, h: 26, tip: () => {
      const lines = ['[[basket]] Storage', `${used} of ${cap} slots used.`];
      if (full)
        lines.push('✘ Storage is full: harvesting stops until you sell.');
      lines.push('Silos add room. Sell with S.');
      return lines;
    } });

    // Energy
    const eMax = getEnergyMax();
    const eFrac = G.energy / eMax;
    const regen = getEnergyRegenRate();
    drawSprite('bolt', r.x + 20, r.y + 89, 18);
    drawMeter(r.x + 36, r.y + 81, r.w - 48, 16, eFrac, eFrac > 0.5 ? UI.energy : (eFrac > 0.2 ? UI.warn : UI.bad), { label: `${Math.round(G.energy)} / ${eMax}  +${regen.toFixed(1)}/s`, labelPx: 11, shine: eFrac >= 1 });
    addRegion({ id: 'hud-energy', x: r.x, y: r.y + 76, w: r.w, h: 30, tip: () => [
      '[[bolt]] Energy',
      `${Math.round(G.energy)} of ${eMax}, regenerating ${regen.toFixed(1)} per second.`,
      'Harvesters and harvest drones use 1 energy per crop.',
      'Solar panels charge by day, wind turbines at night and in storms.',
      'Below 20% the drones slow down.'
    ] });
    endHudPanel();
  }

  /* ── Storage list ── */

  function drawStoragePanel(L) {
    const items = storageItems();
    const r = L.storage;
    const rowH = 22;
    const headerH = 30;
    const btnH = items.length ? 34 : 0;
    const maxRows = Math.max(1, Math.floor((r.maxH - headerH - btnH - 24) / rowH));
    const shown = items.length > maxRows ? maxRows - 1 : items.length;
    const rows = items.length ? shown + (items.length > shown ? 1 : 0) : 1;
    const h = headerH + 8 + rows * rowH + (btnH ? btnH + 10 : 4) + 4;
    if (h > r.maxH + 20) return;
    r.h = h;
    beginHudPanel('storage', r.x, r.y, r.w, h);
    const value = getEstimatedStorageValue();
    const top = drawPanel(r.x, r.y, r.w, h, { title: 'Storage', icon: 'basket', headerH: headerH, titlePx: 14, titleRight: items.length ? `≈ ${value.toLocaleString('en-US')} [[coin]]` : '', titleRightColor: UI.gold, accent: '#7ed46a' });
    ctx.textBaseline = 'middle';
    if (!items.length) {
      ctx.textAlign = 'left';
      fitText('Harvest crops to fill it', r.x + 12, top + rowH / 2, r.w - 24, 12, { color: UI.textMute });
    }
    for (let i = 0; i < shown; ++i) {
      const it = items[i];
      const y = top + i * rowH;
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(r.x + 6, y, r.w - 12, rowH);
      }
      drawSprite(it.sprite, r.x + 18, y + rowH / 2, 18);
      ctx.textAlign = 'right';
      const cw = fitText('×' + it.count, r.x + r.w - 12, y + rowH / 2 + 1, 50, 13, { weight: 'bold', color: UI.text });
      ctx.textAlign = 'left';
      fitText(it.name, r.x + 32, y + rowH / 2 + 1, r.w - 32 - 16 - cw - 6, 12, { color: UI.textDim });
    }
    if (items.length > shown) {
      ctx.textAlign = 'left';
      fitText(`+${items.length - shown} more…`, r.x + 32, top + shown * rowH + rowH / 2 + 1, r.w - 44, 12, { color: UI.textMute });
    }
    addRegion({ id: 'hud-storage-list', x: r.x, y: r.y, w: r.w, h: h - btnH - 6, onClick: () => toggleDialog('market'), tip: () => {
      if (!items.length) return ['[[basket]] Storage', 'Harvested crops and animal produce wait here until you sell them.'];
      const lines = ['[[basket]] Storage', '--- Contents ---'];
      for (const it of items)
        lines.push(`[[${it.sprite}]] ${it.name}: ${it.count} × ${it.value} cr`);
      lines.push(`Worth about ${value} credits right now.`);
      lines.push('Click to open the market (M)');
      return lines;
    } });
    if (btnH)
      drawButton({ id: 'btn-sell-storage', x: r.x + 10, y: r.y + h - btnH - 8, w: r.w - 20, h: btnH }, { label: 'Sell all', icon: 'coin', key: 'S', primary: true, color: '#59c96a', px: 13, onClick: sellAllProduce, tip: buildSellButtonTooltip });
    endHudPanel();
  }

  /* ── Clock: season, day, time of day, weather ── */

  function drawClockPanel(L) {
    const r = L.clock;
    if (r.w < 180) return;
    beginHudPanel('clock', r.x, r.y, r.w, r.h);
    const sc = SEASON_COLORS[G.currentSeason];
    drawPanel(r.x, r.y, r.w, r.h, { accent: sc });
    // Season badge
    roundRectPath(r.x + 8, r.y + 8, 40, 40, 9);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = hexToRgba(sc, 0.5);
    ctx.stroke();
    drawSprite(SEASON_SPRITES[G.currentSeason], r.x + 28, r.y + 28, 28);
    const wi = weatherInfo();
    const weatherW = Math.min(118, r.w * 0.38);
    const tx = r.x + 56, tw = r.w - 56 - weatherW - 8;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const dayInSeason = ((G.dayCount - 1) % SEASON_DURATION) + 1;
    fitText(`${SEASONS[G.currentSeason]} · Day ${G.dayCount}`, tx, r.y + 18, tw, 16, { weight: 'bold', color: sc });
    const isNight = G.dayPhase >= 0.5;
    const secsLeft = Math.ceil((isNight ? 1 - G.dayPhase : 0.5 - G.dayPhase) * DAY_CYCLE_PERIOD);
    fitText(`Day ${dayInSeason}/${SEASON_DURATION} of season · ${isNight ? 'dawn' : 'dusk'} in ${secsLeft}s`, tx, r.y + 36, tw, 11, { color: UI.textDim });
    // Day / night bar
    const bx = tx, by = r.y + 47, bw = tw, bh = 8;
    roundRectPath(bx, by, bw, bh, 4);
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#ffcf6a');
    g.addColorStop(0.45, '#ffe9a0');
    g.addColorStop(0.5, '#6a7ad0');
    g.addColorStop(1, '#1c2660');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.stroke();
    drawSprite(isNight ? 'moon' : 'sun', bx + bw * G.dayPhase, by + bh / 2, 14);
    addRegion({ id: 'hud-clock', x: r.x, y: r.y, w: r.w - weatherW - 4, h: r.h, tip: buildClockTooltip });
    // Weather
    const wx = r.x + r.w - weatherW - 6;
    roundRectPath(wx, r.y + 8, weatherW, r.h - 16, 9);
    ctx.fillStyle = hexToRgba(wi.color, 0.12);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(wi.color, 0.4);
    ctx.stroke();
    drawSprite(wi.icon, wx + 20, r.y + r.h / 2, 24);
    ctx.textAlign = 'left';
    const twoLines = G.weatherType !== WEATHER_NONE || techOwned('sci_forecast');
    fitText(wi.name, wx + 36, r.y + r.h / 2 - (twoLines ? 7 : 0), weatherW - 42, 12, { weight: 'bold', color: wi.color });
    if (G.weatherType !== WEATHER_NONE)
      fitText(`${Math.ceil(G.weatherTimer)}s left`, wx + 36, r.y + r.h / 2 + 9, weatherW - 42, 11, { color: UI.textDim });
    else if (techOwned('sci_forecast')) {
      const nx = WEATHER_INFO[forecastWeather()] || WEATHER_INFO.none;
      fitText(`[[${nx.icon}]] in ${Math.ceil(G.weatherInterval)}s`, wx + 36, r.y + r.h / 2 + 9, weatherW - 42, 11, { color: UI.textDim });
    }
    addRegion({ id: 'hud-weather', x: wx, y: r.y, w: weatherW, h: r.h, tip: buildWeatherTooltip });
    if (techOwned('sci_rain')) {
      const ready = canCallRain();
      drawButton({ id: 'hud-rain', x: r.x + r.w - 96, y: r.y + r.h + 4, w: 90, h: 24 }, {
        label: ready || G.dayCount >= G.rainMakerDay ? 'Call rain' : `Day ${G.rainMakerDay}`, icon: G.currentSeason === 3 ? 'snow' : 'rain', px: 11, primary: ready, color: '#7ab8ff', disabled: !ready,
        onClick: callRain, onDisabled: () => SZ.GameAudio.play('error'),
        tip: () => ['[[rain]] Rain Maker', G.currentSeason === 3 ? 'Calls snowfall in winter.' : 'Calls a rain shower: crops grow 50% faster.', ready ? '✔ Ready' : (G.weatherType !== WEATHER_NONE ? '⚠ Wait for the current weather to pass' : `⚠ Recharges on day ${G.rainMakerDay}`)]
      });
    }
    endHudPanel();
  }

  Object.assign(NS, { drawFarmPanel, drawStoragePanel, drawClockPanel });

})();
