/* Campaign map: six sector cards with mini backdrops, stage buttons, stars and locks. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { BOSS_SPRITE_W, BOSS_SPRITE_H } = NS.constants;
  const { ctx, fillVisible, ui } = NS.view;
  const { getBackdrop } = NS.backdrop;
  const { startStage } = NS.stages;
  const { drawStarShape, registerHit, isHot, drawLock } = NS.widgets;

  function drawCampaignMap() {
    ctx.fillStyle = 'rgba(3,4,10,0.55)';
    fillVisible();
    ui.drawHeadline('Campaign', 640, 46, 600, 40, '#5af2ff', ui.UI.accent);

    const SECTORS = SZ.InvaderCampaign.SECTORS;
    const STAGES = SZ.InvaderCampaign.STAGES;

    for (let s = 0; s < SECTORS.length; ++s) {
      const cx = 24 + (s % 3) * 421;
      const cy = 96 + Math.floor(s / 3) * 266;
      const sector = SECTORS[s];
      const unlocked = SZ.InvaderCampaign.sectorUnlocked(G.save.stars, s);
      let stars = 0;
      for (let k = 0; k < 5; ++k)
        stars += G.save.stars[(s + 1) + '-' + (k + 1)] || 0;

      /* mini backdrop of the sector theme, clipped into the card */
      ctx.save();
      ui.roundRectPath(cx, cy, 390, 250, 9);
      ctx.clip();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(0.3, 0.3);
      getBackdrop(sector.theme).draw(ctx, G.gameTime / 1000);
      ctx.restore();
      ctx.fillStyle = unlocked ? 'rgba(6,9,18,0.45)' : 'rgba(4,6,12,0.78)';
      ctx.fillRect(cx, cy, 390, 250);
      ctx.restore();
      ui.drawPanel(cx, cy, 390, 250, {
        flat: true, noStuds: true,
        accent: unlocked ? sector.boss.color : ui.UI.textMute,
        top: 'rgba(10,14,26,0.25)', bottom: 'rgba(6,8,16,0.35)',
      });

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(sector.name, cx + 16, cy + 26, 250, 21, { weight: 'bold', color: unlocked ? ui.UI.text : ui.UI.textMute });
      ui.drawChip(stars + ' / 15', cx + 374, cy + 14, 24, {
        align: 'right', px: 13,
        color: stars ? ui.UI.gold : ui.UI.textMute,
        bg: 'rgba(4,6,14,0.8)',
      });

      if (!unlocked) {
        drawLock(cx + 195, cy + 116, 64);
        ctx.textAlign = 'center';
        ui.fitText('Defeat ' + SECTORS[s - 1].boss.name, cx + 195, cy + 184, 350, 16, { color: ui.UI.warn });
        continue;
      }

      for (let k = 0; k < 5; ++k) {
        const index = s * 5 + k;
        const stage = STAGES[index];
        const bx = cx + 18 + k * 72;
        const by = cy + 112;
        const open = SZ.InvaderCampaign.stageUnlocked(G.save.stars, index);
        const got = G.save.stars[stage.id] || 0;

        const hit = registerHit('stage-' + index, bx, by, 56, 56, () => startStage(index), !open);
        const hot = isHot(hit, bx, by, 56, 56);
        ctx.save();
        if (!open) ctx.globalAlpha *= 0.45;
        ui.drawPanel(bx, by, 56, 56, {
          radius: 8, noStuds: true, glow: hot,
          accent: hot ? ui.UI.gold : got >= 3 ? ui.UI.good : ui.UI.accent,
        });
        if (k === 4) {
          ctx.save();
          ctx.translate(bx + 28, by + 28);
          ctx.scale(0.3, 0.3);
          SZ.InvaderArt.drawBoss(ctx, s, -BOSS_SPRITE_W / 2, -BOSS_SPRITE_H / 2, false, false);
          ctx.restore();
        } else {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = ui.UI.text;
          ctx.font = ui.uiFont(22, 'bold');
          ctx.fillText(String(k + 1), bx + 28, by + 28);
        }
        if (!open) drawLock(bx + 28, by + 28, 26);
        ctx.restore();

        for (let t = 0; t < 3; ++t)
          drawStarShape(bx + 14 + t * 14, by + 70, 5, t < got);
      }
    }

    ui.drawKeyHints([
      { key: '↑↓←→', label: 'Select stage' },
      { key: 'Enter', label: 'Start' },
      { key: 'Esc', label: 'Title' },
    ], 640, 694, 900, 1);
  }

  Object.assign(NS.campaignMap, {
    drawCampaignMap
  });
})();
