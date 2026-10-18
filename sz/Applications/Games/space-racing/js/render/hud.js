/*
 * Race HUD: place, lap and split panels, speedometer, boost meter, minimap, live
 * standings, item slots and the countdown / wrong-way banners. Owns the panel fades
 * and the minimap projection cache; reads G.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI, STATE_PLAYING, BASE_MAX_SPEED, BOOST_METER_MAX, BOOST_COST,
    DRIFT_TIER1, DRIFT_TIER2 } = NS.constants;
  const { formatTime, getOrdinal } = NS.util;
  const { ctx, ui } = NS.runtime;
  const { treeLevel, getPlayerShipDef } = NS.progress;
  const { worldToScreen } = NS.view;

  // Race HUD: panel fades, place-change chip, lap splits, minimap projection
  const hudFade = {};

  let minimapCache = null;     // projected minimap outline, rebuilt when geo changes

  /* ── A HUD panel sinks back when the player's ship sits on top of it ── */
  function hudAlpha(x, y, w, h) {
    const p = worldToScreen(G.ship.x, G.ship.y);
    return (p.x > x - 30 && p.x < x + w + 30 && p.y > y - 30 && p.y < y + h + 30) ? 0.3 : 1;
  }

  function hudFadeAlpha(name, x, y, w, h) {
    const target = hudAlpha(x, y, w, h);
    const prev = hudFade[name];
    const a = prev === undefined ? target : prev + (target - prev) * 0.15;
    hudFade[name] = a;
    return a;
  }

  function drawHUD() {
    if (G.state === STATE_PLAYING) {
      drawPlacePanel();
      drawLapPanel();
      drawLapSplitPopup();
      drawSpeedometer();
      drawBoostPanel();
      drawMinimap();
      drawStandings();
      drawItemSlot();
    }

    // Countdown to the start
    if (G.state === STATE_PLAYING && !G.raceStarted && G.countdown > 0)
      ui.drawHeadline(String(Math.ceil(G.countdown)), CANVAS_W / 2, 180, 120, 56, ui.UI.gold);

    // Wrong-way warning banner
    if (G.wrongWay) {
      const bx = CANVAS_W / 2 - 140, by = 120, bw = 280, bh = 44;
      ui.drawPanel(bx, by, bw, bh, { accent: '#ff6a6a', noStuds: true });
      ui.drawHeadline('WRONG WAY', CANVAS_W / 2, by + bh / 2, bw - 40, 24, '#ff6a6a');
    }

  }

  /* Big ordinal place, with a +1/-1 chip for the last position change */
  function drawPlacePanel() {
    const x = 20, y = 18, w = 180, h = 104;
    const a = hudFadeAlpha('place', x, y, w, h);
    ui.drawPanel(x, y, w, h, { alpha: a });
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const num = String(G.playerPlace);
    const suffix = getOrdinal(G.playerPlace).slice(num.length);
    const nw = ui.fitText(num, x + 16, y + 76, 96, 64, { weight: 'bold', color: '#ffffff' });
    ui.fitText(suffix, x + 16 + nw + 3, y + 76, 44, 24, { weight: 'bold', color: ui.UI.textDim });
    ui.fitText(`of ${G.opponents.length + 1}`, x + 16, y + 98, w - 32, 16, { color: ui.UI.textDim });
    if (G.placeDelta !== 0 && G.raceTime - G.placeDeltaAt < 1.2) {
      const gained = G.placeDelta > 0;
      const col = gained ? ui.UI.good : ui.UI.bad;
      ui.drawChip(gained ? '+1' : '-1', x + w + 8, y + 16, 22, {
        px: 13, color: col, bg: ui.hexToRgba(col, 0.16), border: ui.hexToRgba(col, 0.6)
      });
    }
    ctx.restore();
  }

  /* Lap counter, race clock and the best lap, plus the lap-split popup */
  function drawLapPanel() {
    const x = 212, y = 18, w = 240, h = 104;
    const a = hudFadeAlpha('lap', x, y, w, h);
    ui.drawPanel(x, y, w, h, { alpha: a });
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ui.fitText('LAP', x + 16, y + 30, 60, 14, { color: ui.UI.textDim });
    ui.fitText(`${Math.min(G.raceLaps, G.playerLap + 1)} / ${G.raceLaps}`, x + 16, y + 64, w - 32, 34, { weight: 'bold', color: ui.UI.text });
    ui.fitText(formatTime(G.raceTime), x + 16, y + 94, 110, 20, { weight: 'bold', color: ui.UI.text });
    const best = G.save.bestLaps[G.currentVariant.key] !== undefined ? G.save.bestLaps[G.currentVariant.key] : G.raceBestLap;
    ctx.textAlign = 'right';
    ui.fitText('BEST ' + (best > 0 ? formatTime(best) : '--'), x + w - 16, y + 94, 150, 14, { color: ui.UI.textDim });
    ctx.restore();
  }

  function drawLapSplitPopup() {
    if (G.lapSplitAt < 0) return;
    const age = G.raceTime - G.lapSplitAt;
    if (age > 2.5) return;
    const a = Math.min(1, age / 0.25, (2.5 - age) / 0.25);
    if (a <= 0) return;
    const x = CANVAS_W / 2 - 170, y = 140, w = 340, h = 64;
    ui.drawPanel(x, y, w, h, { alpha: a, accent: G.lapSplitBest ? ui.UI.gold : ui.UI.accent });
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ui.fitText(`LAP ${G.lapSplitNumber}   ${formatTime(G.lapSplitTime)}`, CANVAS_W / 2, y + 34, w - 24, 22, { weight: 'bold', color: ui.UI.text });
    if (G.lapSplitBest)
      ui.drawChip('BEST LAP', CANVAS_W / 2, y + 40, 18, {
        align: 'center', px: 11, color: ui.UI.gold, bg: ui.hexToRgba(ui.UI.gold, 0.14), border: ui.hexToRgba(ui.UI.gold, 0.6)
      });
    ctx.restore();
  }

  /* 270-degree speed dial, bottom right */
  function drawSpeedometer() {
    const cx = CANVAS_W - 120, cy = CANVAS_H - 110, r = 82;
    const a0 = 0.75 * Math.PI, a1 = 2.25 * Math.PI;
    const maxSpeed = BASE_MAX_SPEED * (G.ship.stats ? G.ship.stats.speed : 1) * 1.8;
    const ratio = Math.max(0, Math.min(1, G.ship.speed / maxSpeed));
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; ++i) {
      const ta = a0 + (a1 - a0) * (i / 11);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ta) * (r - 14), cy + Math.sin(ta) * (r - 14));
      ctx.lineTo(cx + Math.cos(ta) * (r - 6), cy + Math.sin(ta) * (r - 6));
      ctx.stroke();
    }
    if (ratio > 0) {
      const g = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      g.addColorStop(0, '#5ab8ff');
      g.addColorStop(0.5, '#c04cff');
      g.addColorStop(1, '#ff4d8d');
      ctx.lineCap = 'round';
      if (G.boostActive) {
        ctx.save();
        ctx.globalAlpha *= 0.25;
        ctx.lineWidth = 20;
        ctx.strokeStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * ratio);
        ctx.stroke();
        ctx.restore();
      }
      ctx.lineWidth = 12;
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, a0, a0 + (a1 - a0) * ratio);
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ui.fitText(String(Math.round(G.ship.speed)), cx, cy + 12, 120, 36, { weight: 'bold', color: '#ffffff' });
    ui.fitText('km/s', cx, cy + 30, 80, 12, { color: ui.UI.textDim });
    if (G.boostActive)
      ui.drawChip('BOOST', cx, cy - r - 28, 20, {
        align: 'center', px: 11, color: '#ffffff', bg: ui.hexToRgba('#c04cff', 0.5), border: '#c04cff'
      });
    ctx.restore();
  }

  /* Boost meter with the manual-boost cost tick and the drift charge bar */
  function drawBoostPanel() {
    const x = CANVAS_W / 2 - 186, y = CANVAS_H - 70, w = 372, h = 56;
    const a = hudFadeAlpha('boost', x, y, w, h);
    ui.drawPanel(x, y, w, h, { alpha: a, accent: '#c04cff' });
    ctx.save();
    ctx.globalAlpha *= a;
    const boostCost = BOOST_COST - 5 * treeLevel('b_burn');
    const mx = CANVAS_W / 2 - 170, my = CANVAS_H - 44, mw = 340, mh = 16;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ui.fitText('BOOST', mx, my - 12, 80, 12, { weight: 'bold', color: ui.UI.textDim });
    if (G.boostMeter >= boostCost)
      ui.drawKeycap('Shift', mx + mw - 46, my - 24, 11);
    if (G.drifting || G.driftTime > 0) {
      const charge = Math.min(1, G.driftTime / DRIFT_TIER2);
      const col = G.driftTime >= DRIFT_TIER2 ? '#ffaa3a' : G.driftTime >= DRIFT_TIER1 ? '#5ab8ff' : '#9ad8ff';
      ui.drawMeter(mx, my - 8, mw, 6, charge, col, { track: 'rgba(0,0,0,0.4)' });
    }
    ui.drawMeter(mx, my, mw, mh, G.boostMeter / BOOST_METER_MAX, '#c04cff', {});
    const tx = mx + mw * Math.min(1, boostCost / BOOST_METER_MAX);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, my - 2);
    ctx.lineTo(tx, my + mh + 2);
    ctx.stroke();
    ctx.restore();
  }

  /* Track outline fitted into the minimap panel, projected once per track */
  function minimapProjection() {
    if (minimapCache && minimapCache.geoRef === G.geo)
      return minimapCache;
    const x = CANVAS_W - 252, y = 18, w = 232, h = 160;
    const ix = x + 12, iy = y + 42, iw = w - 24, ih = h - 52;
    const b = G.geo.bounds, pad = 160;
    const s = Math.min(iw / (b.maxX - b.minX + pad), ih / (b.maxY - b.minY + pad));
    const ox = ix + (iw - (b.maxX - b.minX) * s) / 2 - b.minX * s;
    const oy = iy + (ih - (b.maxY - b.minY) * s) / 2 - b.minY * s;
    const pts = [];
    for (let i = 0; i < G.geo.points.length; i += 3)
      pts.push({ x: G.geo.points[i].x * s + ox, y: G.geo.points[i].y * s + oy });
    const p0 = G.geo.points[0], p1 = G.geo.points[1];
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    minimapCache = {
      geoRef: G.geo, s: s, ox: ox, oy: oy, pts: pts,
      start: { x: p0.x * s + ox, y: p0.y * s + oy, nx: Math.sin(ang), ny: -Math.cos(ang) }
    };
    return minimapCache;
  }

  function drawMinimap() {
    const x = CANVAS_W - 252, y = 18, w = 232, h = 160;
    const a = hudFadeAlpha('minimap', x, y, w, h);
    ui.drawPanel(x, y, w, h, { alpha: a, title: G.currentVariant ? G.currentVariant.displayName : G.track.name, titlePx: 14 });
    const mm = minimapProjection();
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(mm.pts[0].x, mm.pts[0].y);
    for (let i = 1; i < mm.pts.length; ++i)
      ctx.lineTo(mm.pts[i].x, mm.pts[i].y);
    ctx.closePath();
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c8d0e0';
    ctx.stroke();
    ctx.strokeStyle = ui.UI.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mm.start.x - mm.start.nx * 6, mm.start.y - mm.start.ny * 6);
    ctx.lineTo(mm.start.x + mm.start.nx * 6, mm.start.y + mm.start.ny * 6);
    ctx.stroke();
    for (let i = 0; i < G.opponents.length; ++i) {
      ctx.fillStyle = G.opponents[i].color;
      ctx.beginPath();
      ctx.arc(G.opponents[i].x * mm.s + mm.ox, G.opponents[i].y * mm.s + mm.oy, 4, 0, TWO_PI);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(G.ship.x * mm.s + mm.ox, G.ship.y * mm.s + mm.oy);
    ctx.rotate(G.ship.angle);
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = getPlayerShipDef().color;
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  /* Live ranking: finished racers first, then by distance raced */
  function drawStandings() {
    const x = CANVAS_W - 252, y = 188, w = 232, h = 30 + 26 * 4;
    const a = hudFadeAlpha('standings', x, y, w, h);
    ui.drawPanel(x, y, w, h, { alpha: a });
    const pd = getPlayerShipDef();
    const rows = [{ racer: G.ship, name: 'YOU', color: pd.color, player: true }];
    for (let i = 0; i < G.opponents.length; ++i)
      rows.push({ racer: G.opponents[i], name: G.opponents[i].name, color: G.opponents[i].color });
    rows.sort((u, v) => {
      const uf = u.racer.finished === true, vf = v.racer.finished === true;
      if (uf !== vf) return uf ? -1 : 1;
      if (uf && vf) return u.racer.finishTime - v.racer.finishTime;
      return v.racer.ts.dist - u.racer.ts.dist;
    });
    const L = G.geo.length;
    const leaderDist = rows[0].racer.ts.dist;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.textBaseline = 'middle';
    for (let i = 0; i < rows.length; ++i) {
      const ry = y + 14 + i * 26;
      if (rows[i].player) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x + 6, ry - 11, w - 12, 22);
      }
      ctx.textAlign = 'left';
      ui.fitText(String(i + 1), x + 12, ry + 1, 16, 14, { weight: 'bold', color: ui.UI.textDim });
      ctx.fillStyle = rows[i].color;
      ctx.beginPath();
      ctx.arc(x + 36, ry, 4, 0, TWO_PI);
      ctx.fill();
      ui.fitText(rows[i].name, x + 46, ry + 1, 108, 13, { weight: rows[i].player ? 'bold' : undefined, color: rows[i].player ? '#ffffff' : ui.UI.text });
      ctx.textAlign = 'right';
      const r = rows[i].racer;
      if (i === 0)
        ui.fitText('L' + Math.min(G.raceLaps, Math.floor(r.ts.dist / L) + 1), x + w - 12, ry + 1, 40, 12, { weight: 'bold', color: ui.UI.gold });
      else
        ui.fitText('+' + ((leaderDist - r.ts.dist) / 300).toFixed(1) + 's', x + w - 12, ry + 1, 56, 12, { color: ui.UI.textDim });
    }
    ctx.restore();
  }

  /* The slot showing what the player is carrying, with the use-key below it */
  function drawItemSlot() {
    const x = 20, y = CANVAS_H - 116, w = 96, h = 96;
    const a = hudFadeAlpha('item', x, y, w, h);
    ui.drawPanel(x, y, w, h, { accent: G.playerItem ? '#ffd75a' : undefined, alpha: a });
    ctx.save();
    ctx.globalAlpha *= a;
    const cx = x + w / 2, cy = y + h / 2;
    if (G.playerItem) {
      drawItemIcon(G.playerItem, cx, cy);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('?', cx, cy);
    }
    ui.drawKeycap('E', cx - 10, y + h + 2, 12);

    // second slot, unlocked by the Item Rack
    if (treeLevel('a_rack') > 0) {
      const x2 = 124, y2 = CANVAS_H - 92, w2 = 72, h2 = 72;
      ui.drawPanel(x2, y2, w2, h2, { accent: G.playerItem2 ? '#ffd75a' : undefined, alpha: a, noStuds: true });
      if (G.playerItem2) {
        ctx.save();
        ctx.translate(x2 + w2 / 2, y2 + h2 / 2);
        ctx.scale(1.1, 1.1);
        drawItemIcon(G.playerItem2, 0, 0);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('?', x2 + w2 / 2, y2 + h2 / 2);
      }
    }
    ctx.restore();
  }

  function drawItemIcon(item, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (item === 'missile') {
      ctx.fillStyle = '#e8ecf6';
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(7, -8);
      ctx.lineTo(7, 16);
      ctx.lineTo(-7, 16);
      ctx.lineTo(-7, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(7, -8);
      ctx.lineTo(-7, -8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ff8a3a';
      ctx.beginPath();
      ctx.moveTo(-7, 4);
      ctx.lineTo(-14, 17);
      ctx.lineTo(-7, 17);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(7, 4);
      ctx.lineTo(14, 17);
      ctx.lineTo(7, 17);
      ctx.closePath();
      ctx.fill();
    } else if (item === 'mine') {
      ctx.strokeStyle = '#c9d2e4';
      ctx.lineWidth = 3;
      for (let k = 0; k < 8; ++k) {
        const a = k * (Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9);
        ctx.lineTo(Math.cos(a) * 21, Math.sin(a) * 21);
        ctx.stroke();
      }
      ctx.fillStyle = '#2b3244';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#ff5a4a';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, TWO_PI);
      ctx.fill();
    } else if (item === 'shield') {
      ctx.fillStyle = 'rgba(120,200,255,0.15)';
      ctx.strokeStyle = '#78c8ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
    } else if (item === 'emp') {
      ctx.strokeStyle = '#8ad8ff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-9, -21);
      ctx.lineTo(5, -3);
      ctx.lineTo(-5, 3);
      ctx.lineTo(9, 21);
      ctx.stroke();
    } else if (item === 'turbo') {
      ctx.strokeStyle = '#ff8a3a';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-15, 10);
      ctx.lineTo(0, -6);
      ctx.lineTo(15, 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-15, 22);
      ctx.lineTo(0, 6);
      ctx.lineTo(15, 22);
      ctx.stroke();
    }

    ctx.restore();
  }

  Object.assign(NS.module('hud'), {
    drawHUD
  });
})();
