/*
 * Screens after and over a race: results with podium and reward count-up, cup
 * standings, the pause panel and the help overlay. Reads G.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, STATE_PLAYING, STATE_STANDINGS } = NS.constants;
  const { SHIP_DEFS, CUPS, TUTORIAL_PAGES, TROPHY_COLORS } = NS.defs;
  const { formatTime, getOrdinal } = NS.util;
  const { ctx, ui } = NS.runtime;
  const { resetGame } = NS.raceSetup;
  const { gotoState, enterTitle, enterCareer, enterTracks, openCupIntro } = NS.flow;
  const { menuBackground, drawButton, drawTrophy, drawConfetti } = NS.menuKit;

  function drawResultsScreen() {
    menuBackground();
    ui.drawHeadline('Race Results', 640, 56, 600, 44, ui.UI.gold);

    // podium: 2nd, 1st, 3rd
    const groundY = 560;
    const podium = [
      { place: 2, x: 130, h: 120, col: '#c8d0e0' },
      { place: 1, x: 270, h: 160, col: '#ffd75a' },
      { place: 3, x: 410, h: 90, col: '#d08a4a' }
    ];
    for (let i = 0; i < podium.length; ++i) {
      const p = podium[i];
      const entry = G.lastPodium[p.place - 1];
      const x = p.x - 60, y = groundY - p.h;
      ui.drawPanel(x, y, 120, p.h, { accent: p.col, noStuds: true, glow: p.place === 1 });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(String(p.place), p.x, y + p.h / 2, 60, 34, { weight: 'bold', color: p.col });
      if (entry) {
        SZ.RacingShipArt.drawShip(ctx, {
          x: p.x, y: y - 34, angle: -Math.PI / 2, shape: entry.shape, color: entry.color,
          accent: entry.accent, exhaust: entry.exhaust, thrust: 0.35, scale: 1.5, time: G.globalTime
        });
        if (entry.player)
          ui.drawChip('YOU', p.x, y - 78, 20, { align: 'center', px: 12, color: '#ffffff', bg: ui.hexToRgba('#5ab8ff', 0.5), border: '#5ab8ff' });
      }
    }

    // results table
    const tx = 560, ty = 96, tw = CANVAS_W - tx - 24;
    ui.drawPanel(tx, ty, tw, 210, { title: G.currentVariant.displayName, titlePx: 15 });
    ctx.textBaseline = 'middle';
    for (let i = 0; i < G.lastStandings.length && i < 4; ++i) {
      const e = G.lastStandings[i];
      const ry = ty + 52 + i * 36;
      const isPlayer = e.name === 'player';
      if (isPlayer) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(tx + 8, ry - 15, tw - 16, 30);
      }
      ctx.textAlign = 'left';
      ui.fitText(getOrdinal(i + 1), tx + 16, ry, 50, 16, { weight: 'bold', color: i === 0 ? ui.UI.gold : ui.UI.textDim });
      ui.fitText(isPlayer ? 'YOU' : e.name, tx + 76, ry, 180, 16, { weight: isPlayer ? 'bold' : undefined, color: isPlayer ? '#ffffff' : ui.UI.text });
      ctx.textAlign = 'right';
      const timeText = e.finished ? formatTime(e.finishTime) : `${Math.max(0, Math.floor(e.dist / G.geo.length))} laps`;
      ui.fitText(timeText, tx + tw - 16, ry, 140, 15, { color: ui.UI.text });
    }
    ctx.textAlign = 'left';
    ui.fitText(`Best lap: ${G.raceBestLap > 0 ? formatTime(G.raceBestLap) : '--'}`, tx + 16, ty + 190, 220, 13, { color: ui.UI.textDim });

    // reward breakdown with a count-up total
    const ry0 = ty + 226;
    ui.drawPanel(tx, ry0, tw, 250, { title: 'Reward', titlePx: 15, accent: ui.UI.gold });
    if (G.lastRaceReward) {
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ui.fitText(`${getOrdinal(G.playerPlace)} place`, tx + 16, ry0 + 52, 200, 16, { weight: 'bold', color: ui.UI.text });
      ctx.textAlign = 'right';
      ui.fitText(String(G.lastRaceReward.base), tx + tw - 16, ry0 + 52, 120, 16, { color: ui.UI.text });
      for (let i = 0; i < G.lastRaceReward.bonuses.length && i < 4; ++i) {
        const b = G.lastRaceReward.bonuses[i];
        ctx.textAlign = 'left';
        ui.fitText(b[0], tx + 16, ry0 + 80 + i * 26, 240, 14, { color: ui.UI.textDim });
        ctx.textAlign = 'right';
        ui.fitText(`+${b[1]}`, tx + tw - 16, ry0 + 80 + i * 26, 120, 14, { color: ui.UI.good });
      }
      const shown = Math.round(G.lastRaceReward.total * Math.min(1, G.resultsTime / 1.2));
      ctx.textAlign = 'left';
      ui.fitText('TOTAL', tx + 16, ry0 + 208, 120, 20, { weight: 'bold', color: ui.UI.gold });
      ctx.textAlign = 'right';
      ui.fitText(`${shown} CR`, tx + tw - 16, ry0 + 208, 160, 26, { weight: 'bold', color: ui.UI.gold });
    }

    drawConfetti();

    if (G.resultsWasCup) {
      drawButton('standings', 'Standings', 520, 600, 240, 48, { accent: ui.UI.gold, action: () => gotoState(STATE_STANDINGS) });
    } else {
      drawButton('again', 'Race Again', 470, 600, 220, 48, { accent: ui.UI.gold, action: () => resetGame() });
      drawButton('tracks', 'Tracks', 710, 600, 220, 48, { action: enterTracks });
      drawButton('menu', 'Menu', 950, 600, 220, 48, { action: enterTitle });
    }

    ui.drawKeyHints([
      { key: '↑↓', label: 'Move' },
      { key: 'Enter', label: 'Select' }
    ], 640, 692, 900, 1);
  }

  function drawStandingsScreen() {
    menuBackground();
    const cupDone = !!G.lastCupResult;
    const cup = cupDone ? CUPS.find(c => c.id === G.lastCupResult.cup) : CUPS[G.save.cupProgress ? G.save.cupProgress.cup : G.chosenCup];
    if (!cup) {
      enterCareer();
      return;
    }

    ui.drawHeadline(`${cup.name} Standings`, 640, 60, 700, 44, cup.color);

    let rows;
    if (cupDone)
      rows = G.lastCupResult.standings.slice();
    else {
      const pts = (G.save.cupProgress && G.save.cupProgress.points) || {};
      rows = Object.keys(pts).map(name => ({ name: name, points: pts[name] }));
    }
    rows.sort((a, b) => b.points - a.points || (a.name === 'player' ? -1 : 1));

    const px = 300, py = 110, pw = 680, ph = 250;
    ui.drawPanel(px, py, pw, ph, { title: 'Championship', titlePx: 16 });
    ctx.textBaseline = 'middle';
    for (let i = 0; i < rows.length && i < 4; ++i) {
      const r = rows[i];
      const isPlayer = r.name === 'player';
      const ry = py + 56 + i * 44;
      if (isPlayer) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(px + 8, ry - 18, pw - 16, 36);
      }
      ctx.textAlign = 'left';
      ui.fitText(String(i + 1), px + 16, ry, 30, 18, { weight: 'bold', color: i === 0 ? ui.UI.gold : ui.UI.textDim });
      ui.fitText(isPlayer ? 'YOU' : r.name, px + 56, ry, 260, 18, { weight: isPlayer ? 'bold' : undefined, color: isPlayer ? '#ffffff' : ui.UI.text });
      const gained = G.lastRacePoints[r.name] || 0;
      const shown = Math.max(0, Math.round(r.points - gained * (1 - Math.min(1, G.standingsTime / 0.8))));
      ctx.textAlign = 'right';
      if (gained > 0)
        ui.fitText(`+${gained}`, px + pw - 110, ry, 60, 14, { color: ui.UI.good });
      ui.fitText(String(shown), px + pw - 20, ry, 80, 20, { weight: 'bold', color: ui.UI.gold });
    }

    if (cupDone) {
      const trophy = G.lastCupResult.trophy;
      let rank = 0;
      while (rank < rows.length && rows[rank].name !== 'player')
        ++rank;
      if (trophy) {
        drawTrophy(640, 430, 130, TROPHY_COLORS[trophy]);
        ui.drawHeadline(`${cup.name} won!`, 640, 520, 600, 40, TROPHY_COLORS[trophy]);
      } else {
        ui.drawHeadline(`Cup finished: ${getOrdinal(rank + 1)}`, 640, 450, 600, 36, ui.UI.textDim);
      }
      const unlockedNotes = [];
      if (trophy) {
        const nextIdx = CUPS.findIndex(c => c.id === G.lastCupResult.cup) + 1;
        if (nextIdx < CUPS.length)
          unlockedNotes.push(`${CUPS[nextIdx].name} unlocked`);
        for (let i = 0; i < SHIP_DEFS.length; ++i) {
          const sd = SHIP_DEFS[i];
          if (sd.unlock && sd.unlock.trophy === trophy)
            unlockedNotes.push(`${sd.name} unlocked`);
        }
      }
      ctx.textAlign = 'center';
      ui.fitText(unlockedNotes.join('   -   '), 640, 560, 900, 15, { color: ui.UI.good });
    }

    drawButton('next', G.save.cupProgress ? 'Next Race' : 'Career', 520, 600, 240, 48, {
      accent: ui.UI.gold,
      action: () => {
        if (G.save.cupProgress)
          openCupIntro(G.save.cupProgress.cup, G.save.cupProgress.race);
        else
          enterCareer();
      }
    });

    ui.drawKeyHints([
      { key: 'Enter', label: G.save.cupProgress ? 'Next Race' : 'Career' },
      { key: 'Esc', label: 'Career' }
    ], 640, 692, 900, 1);
  }

  function drawPausePanel() {
    ctx.fillStyle = 'rgba(3,5,12,0.55)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const pw = 420, ph = 300;
    const px = (CANVAS_W - pw) / 2, py = (CANVAS_H - ph) / 2;
    ui.drawPanel(px, py, pw, ph, { title: 'Paused', titlePx: 20, accent: ui.UI.gold });
    drawButton('resume', 'Resume', px + 60, py + 70, 300, 48, { accent: ui.UI.gold, action: () => { G.state = STATE_PLAYING; SZ.GameAudio.play('select'); } });
    drawButton('restart', 'Restart', px + 60, py + 128, 300, 48, { action: () => resetGame() });
    drawButton('quit', 'Quit to Menu', px + 60, py + 186, 300, 48, { action: enterTitle });
    ui.drawKeyHints([
      { key: '↑↓', label: 'Move' },
      { key: 'Enter', label: 'Select' },
      { key: 'Esc', label: 'Resume' }
    ], 640, 692, 900, 1);
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const page = TUTORIAL_PAGES[G.tutorialPage] || TUTORIAL_PAGES[0];
    const cx = CANVAS_W / 2, pw = 460, ph = 220, px = cx - pw / 2, py = (CANVAS_H - ph) / 2;
    ctx.fillStyle = 'rgba(10,10,30,0.95)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = '#f80';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Page ' + (G.tutorialPage + 1) + ' / ' + TUTORIAL_PAGES.length, cx, py + ph - 12);
    ctx.fillStyle = '#f80';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(page.title, cx, py + 30);
    for (let i = 0; i < page.lines.length; ++i)
      ui.fitText(page.lines[i], cx, py + 58 + i * 22, pw - 40, 13, { color: '#ccc' });
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    if (G.tutorialPage < TUTORIAL_PAGES.length - 1)
      ctx.fillText('Click / Space / Right = Next  |  Esc = Close', cx, py + ph - 28);
    else
      ctx.fillText('Click / Space = Start!  |  Press H for help anytime', cx, py + ph - 28);
  }

  Object.assign(NS.module('results'), {
    drawResultsScreen, drawStandingsScreen, drawPausePanel, drawTutorialOverlay
  });
})();
