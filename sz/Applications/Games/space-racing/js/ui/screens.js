/*
 * Menu screens before a race: title (with its flying ships), career, cup intro,
 * quick race track list and garage. Reads G and registers the screen's hit areas.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI } = NS.constants;
  const { SHIP_DEFS, TRACKS, CUPS, CUP_RACES, trackVariant, THEME_COLORS, TROPHY_COLORS } = NS.defs;
  const { formatTime } = NS.util;
  const { ctx, ui } = NS.runtime;
  const { writeSave } = NS.save;
  const { getEffectiveStats, isShipUnlocked, buyShip } = NS.progress;
  const { isCupUnlocked, startCup, nextCupRace } = NS.career;
  const { resetGame } = NS.raceSetup;
  const { enterCareer, enterTracks, enterGarage, openCupIntro, enterTree } = NS.flow;
  const { menuBackground, registerHit, isHot, drawButton, drawTrophy, drawLock, variantGeo,
    drawTrackPreview, drawStars } = NS.menuKit;

  let quickReverse = false;    // reverse toggle on the quick race screen
  let titleShips = [];         // decorative ships looping across the title screen

  /* Three random ships looping across the title screen */
  function initTitleShips() {
    const shapes = ['arrow', 'dart', 'wing', 'heavy', 'stealth'];
    const palette = [
      ['#4af', '#27d', '#48f'], ['#f44', '#a22', '#f84'], ['#4f4', '#2a2', '#8f4'],
      ['#fa0', '#a70', '#fc0'], ['#c4f', '#82a', '#d8f']
    ];
    titleShips = [];
    for (let i = 0; i < 3; ++i) {
      const col = palette[(Math.random() * palette.length) | 0];
      titleShips.push({
        shape: shapes[(Math.random() * shapes.length) | 0],
        color: col[0], accent: col[1], exhaust: col[2],
        y: 430 + i * 95 + Math.random() * 25,
        speed: 90 + Math.random() * 130,
        offset: Math.random() * 1500,
        bob: 0.7 + Math.random() * 0.9
      });
    }
  }

  function drawTitleScreen() {
    menuBackground();

    for (let i = 0; i < titleShips.length; ++i) {
      const t = titleShips[i];
      const span = CANVAS_W + 260;
      const x = ((G.globalTime * t.speed + t.offset) % span) - 130;
      SZ.RacingShipArt.drawShip(ctx, {
        x: x,
        y: t.y + Math.sin(G.globalTime * t.bob + t.offset) * 16,
        angle: 0,
        shape: t.shape,
        color: t.color,
        accent: t.accent,
        exhaust: t.exhaust,
        thrust: 1,
        scale: 1.5,
        time: G.globalTime
      });
    }

    ui.drawHeadline('SPACE RACING', 640, 170, 900, 96, '#5ab8ff', '#c04cff');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Drift. Boost. Win the Galaxy Cup.', 640, 238, 620, 20, { color: ui.UI.textDim });

    const trophyIds = ['bronze', 'silver', 'gold', 'platinum'];
    for (let i = 0; i < trophyIds.length; ++i) {
      const cx = 34 + i * 30;
      ctx.beginPath();
      ctx.arc(cx, 34, 10, 0, TWO_PI);
      if (G.save.trophies[trophyIds[i]]) {
        ctx.fillStyle = TROPHY_COLORS[trophyIds[i]];
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.stroke();
      }
    }
    ui.drawChip(`${G.save.credits} CR`, CANVAS_W - 24, 24, 30, { align: 'right', color: '#ffd75a' });

    const bw = 320, bh = 52, gap = 14;
    const bx = (CANVAS_W - bw) / 2;
    let by = 300;
    drawButton('career', 'Career', bx, by, bw, bh, { accent: ui.UI.gold, action: enterCareer });
    by += bh + gap;
    drawButton('quick', 'Quick Race', bx, by, bw, bh, { action: enterTracks });
    by += bh + gap;
    drawButton('garage', 'Garage', bx, by, bw, bh, { action: enterGarage });
    by += bh + gap;
    drawButton('workshop', 'Workshop', bx, by, bw, bh, { action: enterTree });
    by += bh + gap;
    drawButton('help', 'Help', bx, by, bw, bh, { action: () => { G.showTutorial = true; G.tutorialPage = 0; } });

    ui.drawKeyHints([
      { key: '↑↓', label: 'Move' },
      { key: 'Enter', label: 'Select' },
      { key: 'H', label: 'Help' }
    ], 640, 692, 900, 1);
  }

  function drawCareerScreen() {
    menuBackground();
    ui.drawHeadline('Career', 640, 66, 500, 48, ui.UI.gold);

    let cardY = 150;
    if (G.save.cupProgress && CUPS[G.save.cupProgress.cup]) {
      const progress = G.save.cupProgress;
      const cup = CUPS[progress.cup];
      drawButton('continue', `Continue ${cup.name} -- race ${progress.race + 1}/${CUP_RACES}`, 240, 100, 800, 40, {
        accent: cup.color,
        action: () => openCupIntro(progress.cup, progress.race)
      });
      cardY = 158;
    }

    const cw = 280, ch = 330, gap = 24;
    const x0 = (CANVAS_W - (CUPS.length * cw + (CUPS.length - 1) * gap)) / 2;
    for (let i = 0; i < CUPS.length; ++i) {
      const cup = CUPS[i];
      const x = x0 + i * (cw + gap);
      const unlocked = isCupUnlocked(i);
      const idx = registerHit('cup' + i, x, cardY, cw, ch, () => openCupIntro(i, 0), !unlocked);
      const hot = isHot(idx, x, cardY, cw, ch);
      ctx.save();
      if (!unlocked)
        ctx.globalAlpha *= 0.45;
      ui.drawPanel(x, cardY, cw, ch, { accent: hot ? ui.UI.gold : cup.color, glow: hot });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(cup.name, x + cw / 2, cardY + 30, cw - 24, 22, { weight: 'bold', color: cup.color });
      const earned = G.save.trophies[cup.id];
      drawTrophy(x + cw / 2, cardY + 110, 76, unlocked ? (earned ? TROPHY_COLORS[earned] : '#5d6884') : '#3a4058');
      if (!unlocked)
        drawLock(x + cw / 2 + 46, cardY + 142, 26);
      const earnedText = earned ? earned.charAt(0).toUpperCase() + earned.slice(1) + ' trophy' : 'Not won yet';
      ui.fitText(earnedText, x + cw / 2, cardY + 178, cw - 24, 14, { color: earned ? TROPHY_COLORS[earned] : ui.UI.textDim });
      drawStars(x + cw / 2, cardY + 204, i + 1);
      ui.fitText(`x${cup.reward} credits`, x + cw / 2, cardY + 228, cw - 24, 13, { color: ui.UI.textDim });
      for (let r = 0; r < cup.races.length; ++r) {
        const race = cup.races[r];
        const label = TRACKS[race[0]].name + (race[1] ? ' (Reverse)' : '');
        ui.fitText(label, x + cw / 2, cardY + 252 + r * 17, cw - 20, 12, { color: ui.UI.textDim });
      }
      if (!unlocked)
        ui.fitText('Finish the previous cup in the top 3', x + cw / 2, cardY + ch - 16, cw - 20, 11, { color: ui.UI.warn });
      ctx.restore();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Cup' },
      { key: 'Enter', label: 'Select' },
      { key: 'Esc', label: 'Back' }
    ], 640, 692, 900, 1);
  }

  function drawCupIntroScreen() {
    menuBackground();
    const cup = CUPS[G.chosenCup];
    const race = cup.races[G.cupIntroRace];
    const variant = trackVariant(race[0], race[1]);
    const g = variantGeo(variant);
    const pw = 760, ph = 480;
    const px = (CANVAS_W - pw) / 2, py = (CANVAS_H - ph) / 2;

    ui.drawPanel(px, py, pw, ph, { accent: cup.color });
    ui.drawHeadline(cup.name, 640, py + 52, 560, 40, cup.color);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText(`Race ${G.cupIntroRace + 1} of ${CUP_RACES}`, 640, py + 88, 400, 17, { color: ui.UI.textDim });
    ui.fitText(variant.displayName, 640, py + 122, 640, 32, { weight: 'bold', color: ui.UI.text });

    drawTrackPreview(variant, px + 30, py + 150, 420, 260, THEME_COLORS[variant.theme] || ui.UI.accent);
    ui.fitText(`${variant.laps} laps   -   ${(g.length / 1000).toFixed(1)} km`, px + 240, py + 424, 420, 16, { color: ui.UI.textDim });

    if (G.save.cupProgress && G.save.cupProgress.cup === G.chosenCup && G.save.cupProgress.race > 0) {
      const pts = G.save.cupProgress.points || {};
      const rows = Object.keys(pts).map(name => ({ name: name, points: pts[name] }));
      rows.sort((a, b) => b.points - a.points);
      ctx.textAlign = 'left';
      ui.fitText('Standings', px + 500, py + 160, 200, 16, { weight: 'bold', color: ui.UI.gold });
      for (let i = 0; i < rows.length && i < 4; ++i) {
        const ry = py + 190 + i * 26;
        const isPlayer = rows[i].name === 'player';
        ctx.textAlign = 'left';
        ui.fitText(isPlayer ? 'YOU' : rows[i].name, px + 500, ry, 150, 14, { weight: isPlayer ? 'bold' : undefined, color: isPlayer ? '#ffffff' : ui.UI.text });
        ctx.textAlign = 'right';
        ui.fitText(String(rows[i].points), px + 710, ry, 60, 14, { weight: 'bold', color: ui.UI.gold });
      }
      ctx.textAlign = 'center';
    }

    drawButton('race', 'Race!', px + 120, py + ph - 70, 240, 48, {
      accent: ui.UI.gold,
      action: () => {
        if (G.save.cupProgress && G.save.cupProgress.cup === G.chosenCup) {
          if (!nextCupRace())
            SZ.GameAudio.play('error');
        } else if (!startCup(G.chosenCup))
          SZ.GameAudio.play('error');
      }
    });
    drawButton('back', 'Back', px + 400, py + ph - 70, 240, 48, { action: enterCareer });

    ui.drawKeyHints([
      { key: 'Enter', label: 'Race!' },
      { key: 'Esc', label: 'Back' }
    ], 640, 692, 900, 1);
  }

  function drawTracksScreen() {
    menuBackground();
    ui.drawHeadline('Quick Race', 640, 56, 500, 44, ui.UI.accent);

    const canReverse = !!G.save.trophies.gold;
    drawButton('reverse', `Reverse: ${quickReverse ? 'On' : 'Off'}`, 980, 36, 264, 44, {
      disabled: !canReverse,
      sub: canReverse ? undefined : 'Win the Gold Cup',
      action: () => { quickReverse = !quickReverse; }
    });

    const cw = 280, ch = 230, gap = 24;
    const x0 = (CANVAS_W - (4 * cw + 3 * gap)) / 2;
    const y0 = 108;
    for (let i = 0; i < TRACKS.length; ++i) {
      const col = i % 4, row = (i / 4) | 0;
      const x = x0 + col * (cw + gap);
      const y = y0 + row * (ch + gap);
      const variant = trackVariant(i, quickReverse);
      const theme = THEME_COLORS[TRACKS[i].theme] || ui.UI.accent;
      const idx = registerHit('track' + i, x, y, cw, ch, () => {
        G.currentTrackIndex = i;
        G.currentVariant = trackVariant(i, quickReverse);
        G.raceCup = null;
        resetGame();
      });
      const hot = isHot(idx, x, y, cw, ch);
      ui.drawPanel(x, y, cw, ch, { accent: hot ? ui.UI.gold : theme, glow: hot });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(variant.displayName, x + cw / 2, y + 22, cw - 24, 18, { weight: 'bold', color: hot ? '#ffffff' : ui.UI.text });
      drawTrackPreview(variant, x + 24, y + 38, cw - 48, 128, theme);
      ctx.fillStyle = theme;
      ctx.fillRect(x + 16, y + ch - 40, cw - 32, 4);
      const best = G.save.bestLaps[variant.key];
      ui.fitText('BEST ' + (best !== undefined ? formatTime(best) : '--'), x + cw / 2, y + ch - 18, cw - 32, 13, { color: ui.UI.textDim });
    }

    ui.drawKeyHints([
      { key: '←→↑↓', label: 'Track' },
      { key: 'Enter', label: 'Race' },
      { key: 'Esc', label: 'Back' }
    ], 640, 692, 900, 1);
  }

  function drawGarageScreen() {
    menuBackground();
    const def = SHIP_DEFS[G.menuCursor];
    const unlocked = isShipUnlocked(def);

    // glowing platform under the big preview
    const px = 300, py = 320;
    const glow = ctx.createRadialGradient(px, py + 95, 10, px, py + 95, 180);
    glow.addColorStop(0, ui.hexToRgba(def.color, 0.35));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(px, py + 95, 180, 58, 0, 0, TWO_PI);
    ctx.fill();

    SZ.RacingShipArt.drawShip(ctx, {
      x: px,
      y: py,
      angle: G.globalTime * 0.6,
      shape: def.shape,
      color: def.color,
      accent: def.accentColor,
      exhaust: def.exhaustColor,
      thrust: 0.6 + 0.4 * Math.abs(Math.sin(G.globalTime * 1.7)),
      scale: 3.2,
      time: G.globalTime
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.drawHeadline(def.name, 900, 110, 520, 40, def.color);
    ui.drawTextBlock(def.description, 640, 146, 520, 44, 16, { color: ui.UI.textDim });

    const statDefs = [['speed', 'Speed'], ['accel', 'Acceleration'], ['handling', 'Handling'], ['boost', 'Boost']];
    const statColors = { speed: '#5ab8ff', accel: '#6fe08a', handling: '#ffd75a', boost: '#c04cff' };
    const eff = getEffectiveStats(def);
    for (let s = 0; s < statDefs.length; ++s) {
      const key = statDefs[s][0];
      const y = 210 + s * 46;
      ctx.textAlign = 'left';
      ui.fitText(statDefs[s][1], 640, y + 9, 150, 15, { color: ui.UI.textDim });
      ui.drawMeter(800, y, 340, 18, def.stats[key] / 1.4, statColors[key], {});
      const bw = 340 * ui.clamp(def.stats[key] / 1.4, 0, 1);
      const ew = 340 * ui.clamp(eff[key] / 1.4, 0, 1);
      if (ew > bw) {
        ctx.fillStyle = ui.hexToRgba(statColors[key], 0.4);
        ctx.fillRect(800 + bw, y + 2, ew - bw, 14);
      }
    }
    ui.fitText('The lighter bar extension is the Workshop bonus', 640, 400, 520, 12, { color: ui.UI.textMute });

    const tw = 150, th = 116, gap = 16;
    const x0 = (CANVAS_W - (SHIP_DEFS.length * tw + (SHIP_DEFS.length - 1) * gap)) / 2;
    const ty = 560;
    for (let i = 0; i < SHIP_DEFS.length; ++i) {
      const sd = SHIP_DEFS[i];
      const x = x0 + i * (tw + gap);
      const own = isShipUnlocked(sd);
      const idx = registerHit('ship' + i, x, ty, tw, th, () => {
        if (own) {
          G.selectedShipIndex = i;
          G.save.selectedShip = sd.id;
          writeSave();
          SZ.GameAudio.play('select');
        } else if (buyShip(sd)) {
          SZ.GameAudio.play('coin');
          SZ.GameAudio.play('powerup');
          G.selectedShipIndex = i;
          G.save.selectedShip = sd.id;
          writeSave();
        } else
          SZ.GameAudio.play('error');
      });
      const hot = isHot(idx, x, ty, tw, th);
      ctx.save();
      if (!own)
        ctx.globalAlpha *= 0.55;
      ui.drawPanel(x, ty, tw, th, { accent: hot ? ui.UI.gold : (i === G.selectedShipIndex ? sd.color : ui.UI.accent), glow: hot, noStuds: true });
      SZ.RacingShipArt.drawShip(ctx, {
        x: x + tw / 2, y: ty + 34, angle: -Math.PI / 2, shape: sd.shape, color: sd.color,
        accent: sd.accentColor, exhaust: sd.exhaustColor, thrust: 0.3, scale: 1.15, time: G.globalTime
      });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(sd.name, x + tw / 2, ty + 84, tw - 12, 12, { weight: 'bold', color: i === G.selectedShipIndex ? ui.UI.gold : ui.UI.text });
      if (own) {
        if (i === G.selectedShipIndex)
          ui.fitText('EQUIPPED', x + tw / 2, ty + th - 12, tw - 12, 11, { weight: 'bold', color: ui.UI.good });
      } else {
        const req = sd.unlock.price
          ? `${sd.unlock.price} CR`
          : 'Win the ' + sd.unlock.trophy.charAt(0).toUpperCase() + sd.unlock.trophy.slice(1) + ' Cup';
        ui.fitText(req, x + tw / 2, ty + th - 12, tw - 12, 11, { color: ui.UI.warn });
        drawLock(x + tw - 22, ty + 18, 16);
      }
      ctx.restore();
    }

    ui.drawKeyHints([
      { key: '←→', label: 'Browse' },
      { key: 'Enter', label: unlocked ? 'Select' : 'Buy' },
      { key: 'Esc', label: 'Back' }
    ], 640, 692, 900, 1);
  }

  Object.assign(NS.module('screens'), {
    initTitleShips, drawTitleScreen, drawCareerScreen, drawCupIntroScreen, drawTracksScreen, drawGarageScreen
  });
})();
