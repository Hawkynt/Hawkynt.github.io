/* The title, victory and defeat screens. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const Renderer = TR.Renderer;

  Object.assign(Renderer.prototype, {
    drawTitleScreen(time) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
      const w = this._width;
      const h = this._height;
      const t = Math.max(0, time);
      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const SA = TR.ScreenArt;

      if (SA) {
        // dusk over the mountains, the heroes waiting on the road
        SA.stage(ctx, 'mountain', 'material', t, { pan: Math.sin(t * 0.08) * 160 });
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#c88a78';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        const heroes = [
          { name: 'Paladin', class: 'paladin', race: 'human' },
          { name: 'Wizard', class: 'wizard', race: 'elf' },
          { name: 'Ranger', class: 'ranger', race: 'halfling' },
          { name: 'Barbarian', class: 'barbarian', race: 'half_orc' },
          { name: 'Cleric', class: 'cleric', race: 'dwarf' },
        ];
        SA.partyLine(ctx, heroes, { x: w / 2, footY: h - 64, spacing: 150, height: 216, time: t, facing: 1 });
        SA.vignette(ctx, 0.6);
      } else {
        ctx.fillStyle = '#0a0a1e';
        ctx.fillRect(0, 0, w, h);
      }

      const midX = w / 2;
      const rise = Math.min(1, t * 1.5);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = "bold 76px Georgia, 'Times New Roman', serif";
      const ty = 150 - (1 - rise) * 30;
      ctx.globalAlpha = rise;
      ctx.lineJoin = 'round';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#1a0e08';
      ctx.strokeText('TACTICAL REALMS', midX, ty);
      const g = ctx.createLinearGradient(0, ty - 64, 0, ty + 6);
      g.addColorStop(0, '#fff4c0');
      g.addColorStop(0.5, '#f0c050');
      g.addColorStop(1, '#a86a18');
      ctx.fillStyle = g;
      ctx.shadowColor = 'rgba(255,200,80,0.6)';
      ctx.shadowBlur = 18 + Math.sin(t * 2) * 6;
      ctx.fillText('TACTICAL REALMS', midX, ty);
      ctx.shadowBlur = 0;
      ctx.font = "italic 24px Georgia, 'Times New Roman', serif";
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#1a0e08';
      ctx.strokeText('A Tactical RPG Adventure', midX, ty + 46);
      ctx.fillStyle = '#f0e6d0';
      ctx.fillText('A Tactical RPG Adventure', midX, ty + 46);
      ctx.restore();
    }

  ,
    drawVictoryScreen(party, xpGained, goldGained, progress, { time = 0, biome = 'plains', plane = 'material' } = {}) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
      const w = this._width;
      const h = this._height;
      const p = Math.min(1, Math.max(0, progress));
      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const SA = TR.ScreenArt;
      const midX = w / 2;

      if (SA) {
        SA.stage(ctx, biome, plane, time);
        // the party cheers: arms up, hopping
        SA.partyLine(ctx, party, {
          x: midX, footY: h - 12, spacing: 200, height: 144, time, hop: 10,
          pose: i => ({ pose: 'cast', p: 0.6 + 0.4 * Math.abs(Math.sin(time * 4 + i)) }),
        });
        SA.vignette(ctx, 0.45);
        SA.frame(ctx, midX - 330, 206, 660, 330, { alpha: 0.88 });
        SA.confetti(ctx, time);
      } else {
        ctx.fillStyle = '#1a2a0a';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.save();
      ctx.textAlign = 'center';
      const pop = Math.min(1, time * 3);
      ctx.translate(midX, 120);
      ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
      ctx.font = "900 78px Georgia, 'Times New Roman', serif";
      ctx.lineJoin = 'round';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#1a0e08';
      ctx.strokeText('VICTORY!', 0, 0);
      const g = ctx.createLinearGradient(0, -64, 0, 6);
      g.addColorStop(0, '#fffbe0');
      g.addColorStop(0.5, '#ffd24a');
      g.addColorStop(1, '#c87a10');
      ctx.fillStyle = g;
      ctx.fillText('VICTORY!', 0, 0);
      ctx.restore();

      // the controller lists the rewards inside the panel; this bar fills with them
      const barW = 360, barH = 8, barX = midX - barW / 2;
      ctx.fillStyle = '#0a0610';
      ctx.fillRect(barX - 1, 223, barW + 2, barH + 2);
      ctx.fillStyle = '#46d468';
      ctx.fillRect(barX, 224, barW * p, barH);
    }

  ,
    drawDefeatScreen(time, { party = null, biome = 'plains', plane = 'material' } = {}) {
      if (!this._bufCtx)
        return;
      const ctx = this._bufCtx;
      const w = this._width;
      const h = this._height;
      const t = Math.max(0, time);
      const TR = (window.SZ && window.SZ.TacticalRealms) || {};
      const SA = TR.ScreenArt;
      const midX = w / 2;

      if (SA) {
        SA.stage(ctx, biome, plane, t, { dim: 0.35 });
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#8a3a3a';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        if (party)
          SA.partyLine(ctx, party, {
            x: midX, footY: h - 86, spacing: 200, height: 180, time: t, facing: 1,
            pose: () => ({ pose: 'down', p: 1, opts: { rotate: -1.35, alpha: 0.85 } }),
          });
        SA.vignette(ctx, 0.8, '20,0,0');
      } else {
        ctx.fillStyle = '#1a0a0a';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, t * 0.8);
      ctx.font = "900 76px Georgia, 'Times New Roman', serif";
      ctx.lineJoin = 'round';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#0a0404';
      ctx.strokeText('DEFEAT', midX, 220);
      ctx.fillStyle = '#d84a3a';
      ctx.fillText('DEFEAT', midX, 220);
      ctx.font = "italic 22px Georgia, 'Times New Roman', serif";
      ctx.lineWidth = 6;
      ctx.strokeText('Your party has fallen...', midX, 270);
      ctx.fillStyle = '#e0d0c8';
      ctx.fillText('Your party has fallen...', midX, 270);
      ctx.restore();
    }

  ,
  });
})();
