/* Space Farming - HUD layout and shared HUD state: panel rectangles for every screen width,
   the farm area between them, panel fading over farm action, banners, and the storage and
   weather display info.
   Owns: G.creditsShown, G.creditsPulse, G.creditsDelta, G.creditsDeltaT, G.banner, G.screenFade, G.hudFrame
   Reads: G.canvasW, G.canvasH, G.uiS, G.UW, G.UH, G.state, G.selectedTool, G.livestockPens, G.inventory,
     G.weatherType, G.dayPhase, G.wildAnimals, G.viewZoom, G.isDragging, G.dragStartX, G.dragStartY,
     G.dragCurrentX, G.dragCurrentY, G.dragStartedOnGrid, G.frameDt, G.expandBadge, G.orders, G.dialog,
     G.pointerUX, G.pointerUY, G.pointerInside */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { BASE_TILE_SIZE, STATE_PLAYING, CROPS, LIVESTOCK, WEATHER_NONE, TOOL_HOE, TOOL_BUILD, ctx, UI,
    gridToScreen, livestockPenToScreen, worldToUI, kbCursor } = NS;

  function goalPanelLayout(L) {
    const Q = NS.quickPanelLayout();
    const x = Q.x, w = Q.w, y = Q.y + Q.h + 8;
    const rowH = 30;
    const shown = Math.min(G.orders.length, 3);
    const h = 36 + 52 + (shown ? 8 + shown * (rowH + 4) : 26) + 6;
    return { x, y, w, h, rowH, shown };
  }

  /* ══════════════════════════════════════════════════════════════════
     HUD — farm status, storage, clock, tool dock
     ══════════════════════════════════════════════════════════════════ */

  const HUD_M = 10;                  // margin around HUD panels (UI units)
  const DOCK_H = 84;
  const DOCK_TWO_ROW_H = 156;        // narrow screens: tools and actions above the slots
  const NARROW_UW = 840;             // below this the dock splits and the clock moves left
  const SLOT_W = 58, SLOT_H = 64, SLOT_GAP = 6;
  const SEASON_COLORS = ['#8ef08a', '#ffd75a', '#ff9a4a', '#a8dcff'];
  const dockScroll = { plant: 0, build: 0 };

  function announce(title, sub, color, icon) {
    G.banner = { title, sub: sub || '', color: color || UI.gold, icon: icon || null, t: 0 };
  }

  function dockMode() {
    if (G.selectedTool === TOOL_BUILD) return 'build';
    if (G.selectedTool === TOOL_HOE) return 'hoe';
    return 'plant';
  }

  function isNarrowHud() {
    return G.UW < NARROW_UW;
  }

  function dockHeight() {
    return isNarrowHud() ? DOCK_TWO_ROW_H : DOCK_H;
  }

  function hudLayout() {
    const narrow = isNarrowHud();
    const farm = { x: HUD_M, y: HUD_M, w: 244, h: 112 };
    let clock;
    if (narrow)
      // no room between the side panels: the clock goes under the farm panel
      clock = { x: HUD_M, y: farm.y + farm.h + 8, w: farm.w, h: 64 };
    else {
      const clockW = Math.min(330, G.UW - 2 * (farm.w + HUD_M * 3));
      clock = { x: Math.round(G.UW / 2 - clockW / 2), y: HUD_M, w: clockW, h: 64 };
    }
    const dockW = Math.min(G.UW - HUD_M * 2, 1180);
    const dockH = dockHeight();
    const dock = { x: Math.round((G.UW - dockW) / 2), y: G.UH - dockH - HUD_M, w: dockW, h: dockH };
    const storeTop = narrow ? clock.y + clock.h + 8 : farm.y + farm.h + 8;
    const storage = { x: HUD_M, y: storeTop, w: farm.w, h: 0, maxH: narrow ? Math.min(220, dock.y - 68 - storeTop) : dock.y - 68 - storeTop };
    return { farm, clock, dock, storage };
  }

  /* Canvas rectangle the farm should stay inside, clear of the HUD panels */
  function fieldViewRect(bottomGap) {
    if (!isNarrowHud())
      return { left: 270 * G.uiS, right: G.canvasW - 300 * G.uiS, top: 90 * G.uiS, bottom: G.canvasH - (DOCK_H + bottomGap) * G.uiS };
    // narrow screens stack the panels at the top, the farm uses the full width below them
    const L = hudLayout();
    const GP = goalPanelLayout(L);
    const goalsShown = GP.y + 96 <= L.dock.y - 34;
    const panelsBottom = Math.max(L.storage.y + 60, goalsShown ? GP.y + Math.min(GP.h, L.dock.y - 34 - GP.y) : GP.y);
    const top = Math.min(panelsBottom + 8, L.dock.y - 160);
    return { left: HUD_M * G.uiS, right: G.canvasW - HUD_M * G.uiS, top: top * G.uiS, bottom: G.canvasH - (dockHeight() + bottomGap) * G.uiS };
  }

  /* ── HUD fading: panels turn see-through while farm action is behind them ── */

  const HUD_FADED = 0.28;
  const hudFade = {};
  let hudActorCache = null, hudActorFrame = -1;

  /* Screen rectangles (UI units) of everything that should stay visible */
  function hudActors() {
    if (hudActorFrame === G.hudFrame && hudActorCache) return hudActorCache;
    const out = [];
    const ts = BASE_TILE_SIZE * G.viewZoom / G.uiS;
    const add = (x, y, w, h) => out.push({ x, y, w, h });
    for (const a of G.wildAnimals) {
      const g = gridToScreen(a.rx !== undefined ? a.rx : a.x, a.ry !== undefined ? a.ry : a.y);
      add(g.x / G.uiS, g.y / G.uiS, ts, ts);
    }
    for (const pen of G.livestockPens)
      if (pen.produceReady) {
        const s = livestockPenToScreen(pen);
        add(s.x / G.uiS - ts / 2, s.y / G.uiS - ts / 2, ts, ts);
      }
    if (G.isDragging && G.dragStartedOnGrid) {
      const x0 = Math.min(G.dragStartX, G.dragCurrentX) / G.uiS, y0 = Math.min(G.dragStartY, G.dragCurrentY) / G.uiS;
      add(x0, y0, Math.abs(G.dragCurrentX - G.dragStartX) / G.uiS, Math.abs(G.dragCurrentY - G.dragStartY) / G.uiS);
    }
    if (kbCursor.active) {
      const g = gridToScreen(kbCursor.col, kbCursor.row);
      add(g.x / G.uiS, g.y / G.uiS, ts, ts);
    }
    // the + badge of the next field strip stays reachable under the panels
    if (G.expandBadge) {
      const u = worldToUI(G.expandBadge.x, G.expandBadge.y);
      add(u.x - ts * 0.4, u.y - ts * 0.4, ts * 0.8, ts * 0.8);
    }
    hudActorCache = out;
    hudActorFrame = G.hudFrame;
    return out;
  }

  function overlapsActor(x, y, w, h) {
    for (const a of hudActors())
      if (a.x < x + w && a.x + a.w > x && a.y < y + h && a.y + a.h > y)
        return true;
    return false;
  }

  function hudAlpha(id, x, y, w, h) {
    const f = hudFade[id] || (hudFade[id] = { a: 1 });
    const mouseInside = G.pointerUX >= x && G.pointerUX <= x + w && G.pointerUY >= y && G.pointerUY <= y + h && G.pointerInside;
    const live = G.state === STATE_PLAYING && !G.dialog;
    const target = live && !mouseInside && overlapsActor(x, y, w, h) ? (id === 'dock' ? 0.55 : HUD_FADED) : 1;
    f.a += (target - f.a) * (1 - Math.exp(-G.frameDt * 9));
    f.rect = { x, y, w, h };
    f.frame = G.hudFrame;
    return f.a;
  }

  function beginHudPanel(id, x, y, w, h) {
    ctx.save();
    ctx.globalAlpha *= hudAlpha(id, x, y, w, h);
  }

  function endHudPanel() {
    ctx.restore();
  }

  /* A click on a pest or a ready animal seen through a faded panel goes to the farm */
  function hudPassThrough(ux, uy) {
    for (const id in hudFade) {
      const f = hudFade[id];
      if (f.frame < G.hudFrame - 2 || f.a > 0.6 || !f.rect) continue;
      const r = f.rect;
      if (ux < r.x || ux > r.x + r.w || uy < r.y || uy > r.y + r.h) continue;
      for (const a of hudActors())
        if (ux >= a.x - 6 && ux <= a.x + a.w + 6 && uy >= a.y - 6 && uy <= a.y + a.h + 6)
          return true;
    }
    return false;
  }

  function storageItems() {
    const items = [];
    for (const crop of CROPS) {
      const count = G.inventory[crop.name] || 0;
      if (count > 0)
        items.push({ sprite: crop.sprite, name: crop.name, count, value: NS.getEffectiveSellPrice(crop) });
    }
    for (const live of LIVESTOCK) {
      const count = G.inventory[live.produce] || 0;
      if (count > 0)
        items.push({ sprite: live.produceSprite, name: live.produce, count, value: NS.getEffectiveProduceValue(live) });
    }
    return items;
  }

  const WEATHER_INFO = {
    none: { name: 'Clear skies', icon: 'sun', color: '#ffe48a' },
    solarFlare: { name: 'Solar flare', icon: 'flare', color: '#ffd23f' },
    meteorShower: { name: 'Meteor shower', icon: 'meteor', color: '#ff7a4a' },
    rain: { name: 'Rain', icon: 'rain', color: '#7ab8ff' },
    thunderstorm: { name: 'Thunderstorm', icon: 'storm', color: '#c8b0ff' },
    snow: { name: 'Snowfall', icon: 'snow', color: '#cfe8ff' },
    dust: { name: 'Dust storm', icon: 'dust', color: '#e0b878' }
  };

  function weatherInfo() {
    const w = WEATHER_INFO[G.weatherType] || WEATHER_INFO.none;
    if (G.weatherType === WEATHER_NONE && G.dayPhase >= 0.5)
      return { name: 'Clear night', icon: 'moon', color: '#c8d8ff' };
    return w;
  }

  Object.assign(NS, { goalPanelLayout, HUD_M, DOCK_H, SLOT_W, SLOT_H, SLOT_GAP, SEASON_COLORS, dockScroll,
    announce, dockMode, isNarrowHud, dockHeight, hudLayout, fieldViewRect, hudFade, beginHudPanel,
    endHudPanel, hudPassThrough, storageItems, WEATHER_INFO, weatherInfo });

})();
