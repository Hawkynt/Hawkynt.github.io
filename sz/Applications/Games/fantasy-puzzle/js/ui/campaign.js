/* The realm map and the trials grid. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H } = NS.consts;
  const { sfx, ctx, ui, particles, Fx, fxMenu } = NS.context;
  const { writeSave } = NS.store;
  const { campaignUnlocked, campaignStarCount, trialUnlocked, solvedTrialCount, realmUnlocked, loadPuzzle } = NS.session;
  const { medallion } = NS.sprites;
  const { getScene, drawMenuBackdrop, drawLock, starPath, drawMenuLight } = NS.widgets;
  const { registerHit, isHot, hoverLevel } = NS.menu;

  function drawRealmsScreen() {
    drawMenuBackdrop(0, 'rgba(4,6,14,0.62)');
    drawMenuLight();
    fxMenu.update(G.frameDt);
    Fx.ambient(fxMenu, 0, VIEW_W, VIEW_H, G.frameDt);
    fxMenu.draw(ctx);
    ui.drawHeadline('Campaign', 640, 50, 600, 48, '#ffd75a', '#c46a10');
    ui.drawChip(campaignStarCount() + ' / 120 stars', 1256, 20, 28, { align: 'right', color: ui.UI.gold });

    const REALMS = SZ.PuzzleLevels.REALMS;
    for (let r = 0; r < REALMS.length; ++r) {
      const cx = 24 + r * 247, cy = 96, cw = 230, ch = 420;
      const realm = REALMS[r];
      const unlocked = realmUnlocked(r);

      /* the first time a realm shows unlocked, its lock shatters */
      if (unlocked && !G.save.seenUnlocks[r]) {
        G.save.seenUnlocks[r] = true;
        writeSave();
        G.unlockFx = { realm: r, at: G.time };
        particles.burst(cx + cw / 2, cy + 250, 16, { color: '#c8d0e0', speed: 3.5, life: 0.8, gravity: 0.12, shape: 'square', size: 3 });
        particles.sparkle(cx + cw / 2, cy + 250, 10, { color: ui.UI.gold, speed: 2.5 });
        sfx('powerup');
      }

      /* miniature of the realm scene, clipped into the card */
      ctx.save();
      ui.roundRectPath(cx, cy, cw, ch, 9);
      ctx.clip();
      ctx.save();
      const ms = ch / 720;
      ctx.translate(cx + cw / 2 - 640 * ms, cy);
      ctx.scale(ms, ms);
      getScene(r).draw(ctx, G.time, null);
      ctx.restore();
      const vg = ctx.createLinearGradient(0, cy, 0, cy + ch);
      vg.addColorStop(0, unlocked ? 'rgba(6,4,14,0.05)' : 'rgba(4,4,10,0.6)');
      vg.addColorStop(0.35, unlocked ? 'rgba(6,4,14,0.45)' : 'rgba(4,4,10,0.75)');
      vg.addColorStop(1, unlocked ? 'rgba(6,4,14,0.85)' : 'rgba(4,4,10,0.9)');
      ctx.fillStyle = vg;
      ctx.fillRect(cx, cy, cw, ch);
      ctx.restore();
      ui.drawPanel(cx, cy, cw, ch, {
        flat: true, noStuds: !unlocked,
        accent: unlocked ? realm.color : ui.UI.textMute,
        top: 'rgba(10,14,26,0)', bottom: 'rgba(6,8,16,0)'
      });
      if (G.unlockFx && G.unlockFx.realm === r) {
        const f = 1 - (G.time - G.unlockFx.at) / 0.8;
        if (f > 0) {
          ctx.save();
          ctx.globalAlpha = f;
          ui.roundRectPath(cx, cy, cw, ch, 9);
          ctx.lineWidth = 3;
          ctx.strokeStyle = realm.color;
          ctx.stroke();
          ctx.restore();
        } else {
          G.unlockFx = null;
        }
      }

      let stars = 0;
      for (let k = 0; k < 8; ++k)
        stars += G.save.stars[SZ.PuzzleLevels.CAMPAIGN[r * 8 + k].id] || 0;

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(realm.name, cx + 14, cy + 152, 148, 19, { weight: 'bold', color: unlocked ? '#f4e6c4' : ui.UI.textMute, font: ui.TITLE_FONT, outline: 'rgba(0,0,0,0.7)' });
      ui.drawChip(stars + ' / 24', cx + cw - 12, cy + 140, 22, { align: 'right', px: 12, color: stars ? ui.UI.gold : ui.UI.textMute, bg: 'rgba(4,6,14,0.8)' });

      if (!unlocked) {
        drawLock(cx + cw / 2, cy + 250, 64);
        ctx.textAlign = 'center';
        ui.fitText('Finish ' + REALMS[r - 1].name, cx + cw / 2, cy + 316, cw - 24, 14, { color: ui.UI.warn });
        continue;
      }

      /* the eight levels as numbered nodes along a winding dotted path */
      const nodePos = [];
      for (let k = 0; k < 8; ++k) {
        const row = (k / 4) | 0;
        const col = row === 0 ? k % 4 : 3 - (k % 4);
        nodePos.push([cx + 38 + col * 58, cy + 214 + row * 100]);
      }
      /* the trail between the nodes: glowing dots up to the furthest open level */
      ctx.save();
      for (let k = 0; k < 7; ++k) {
        const lit = campaignUnlocked(r * 8 + k + 1);
        const ax = nodePos[k][0], ay = nodePos[k][1], bx2 = nodePos[k + 1][0], by2 = nodePos[k + 1][1];
        const len = Math.hypot(bx2 - ax, by2 - ay), steps = Math.floor(len / 9);
        for (let d = 2; d < steps - 1; ++d) {
          const f = d / steps;
          const px = ax + (bx2 - ax) * f, py = ay + (by2 - ay) * f;
          if (lit) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 0.5 + 0.4 * Math.sin(G.time * 4 - (k * steps + d) * 0.5);
            ctx.drawImage(Fx.sprite('spark', realm.color), px - 5, py - 5, 10, 10);
          } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = '#8a8070';
            ctx.fillRect(px - 1, py - 1, 2, 2);
          }
        }
      }
      ctx.restore();

      for (let k = 0; k < 8; ++k) {
        const index = r * 8 + k;
        const nx = nodePos[k][0], ny = nodePos[k][1];
        const open = campaignUnlocked(index);
        const got = G.save.stars[SZ.PuzzleLevels.CAMPAIGN[index].id] || 0;
        const hit = registerHit('lv-' + index, nx - 17, ny - 17, 34, 34, function() { loadPuzzle('campaign', index); }, !open);
        const hot = isHot(hit, nx - 17, ny - 17, 34, 34);
        const hv = hoverLevel('lv-' + index, hot);
        const next = open && !got;
        ctx.save();
        if (!open)
          ctx.globalAlpha *= 0.5;
        if (open && (hv > 0 || next)) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha *= Math.max(hv, next ? 0.5 + 0.4 * Math.sin(G.time * 4) : 0);
          ctx.drawImage(Fx.sprite('glow', next ? '#ffd75a' : realm.color), nx - 36, ny - 36, 72, 72);
          ctx.restore();
        }
        const nr = 16 + hv * 2;
        ctx.drawImage(medallion(open ? realm.color : '#5a5a6a'), nx - nr - 3, ny - nr - 3, (nr + 3) * 2, (nr + 3) * 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (open) {
          ctx.font = ui.titleFont(16, 'bold');
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          ctx.strokeText(String(k + 1), nx, ny + 1);
          ctx.fillStyle = hot ? '#ffffff' : '#fff0d0';
          ctx.fillText(String(k + 1), nx, ny + 1);
        } else {
          drawLock(nx, ny, 18);
        }
        ctx.restore();
        if (got > 0) {
          for (let s = 0; s < 3; ++s) {
            starPath(nx - 12 + s * 12, ny + 26, 5);
            ctx.fillStyle = s < got ? ui.UI.gold : 'rgba(255,255,255,0.1)';
            ctx.fill();
          }
        }
      }
    }

    ui.drawKeyHints([
      { key: '↑↓←→', label: 'Select level' },
      { key: 'Enter', label: 'Start' },
      { key: 'Esc', label: 'Title' }
    ], 640, 694, 900, 1);
  }

  function drawTrialsScreen() {
    drawMenuBackdrop(4, 'rgba(4,6,14,0.66)');
    ui.drawHeadline('Trials', 640, 46, 600, 40, '#c04cff', '#7a2ad0');
    ui.drawChip(solvedTrialCount() + ' / 60', 1256, 20, 28, { align: 'right', color: ui.UI.gold });

    const TW = 112, TH = 72, GX = 12, GY = 14;
    const x0 = (VIEW_W - (10 * TW + 9 * GX)) / 2, y0 = 104;
    for (let i = 0; i < SZ.PuzzleLevels.BONUS.length; ++i) {
      const x = x0 + (i % 10) * (TW + GX), y = y0 + ((i / 10) | 0) * (TH + GY);
      const open = trialUnlocked(i);
      const got = G.save.stars[SZ.PuzzleLevels.BONUS[i].id] || 0;
      const hit = registerHit('trial-' + i, x, y, TW, TH, function() { loadPuzzle('bonus', i); }, !open);
      const hot = isHot(hit, x, y, TW, TH);
      ctx.save();
      if (!open)
        ctx.globalAlpha *= 0.45;
      ui.drawPanel(x, y, TW, TH, {
        radius: 8, noStuds: true, glow: hot,
        accent: hot ? ui.UI.gold : got >= 3 ? ui.UI.good : got > 0 ? ui.UI.accent : ui.UI.textMute
      });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (open) {
        ctx.fillStyle = ui.UI.text;
        ctx.font = ui.uiFont(22, 'bold');
        ctx.fillText(String(i + 1), x + TW / 2, y + 26);
      } else {
        drawLock(x + TW / 2, y + 26, 26);
      }
      for (let s = 0; s < 3; ++s) {
        starPath(x + TW / 2 - 16 + s * 16, y + TH - 18, 6);
        ctx.fillStyle = s < got ? ui.UI.gold : 'rgba(255,255,255,0.1)';
        ctx.fill();
      }
      ctx.restore();
    }

    if (campaignStarCount() < 10) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText('Trials open once you have 10 campaign stars', 640, 656, 600, 15, { color: ui.UI.warn });
    }

    ui.drawKeyHints([
      { key: '↑↓←→', label: 'Select trial' },
      { key: 'Enter', label: 'Start' },
      { key: 'Esc', label: 'Title' }
    ], 640, 694, 900, 1);
  }

  NS.campaign = { drawRealmsScreen, drawTrialsScreen };
})();
