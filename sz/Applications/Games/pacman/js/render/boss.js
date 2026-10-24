;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  NS.bossview.drawBoss = function drawBoss() {
    if (!S.boss)
      return;

    const x = S.boss.x;
    const y = S.boss.y;
    const r = C.TILE * C.BOSS_SIZE / 2;
    const glowColor = S.boss.vulnerable ? '#FFFFFF' : S.boss.type.color;
    const pulsePhase2 = S.boss.phase2 ? Math.sin(performance.now() * 0.01) * 0.3 + 0.7 : 1;

    D.ctx.save();

    if (S.boss.stunned)
      D.ctx.globalAlpha = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;

    SZ.GameEffects.drawGlow(D.ctx, c => {
      c.fillStyle = S.boss.vulnerable ? '#2121DE' : S.boss.type.color;
      c.beginPath();
      c.arc(x, y - r * 0.15, r, Math.PI, 0, false);
      c.lineTo(x + r, y + r * 0.7);

      const waveTime = performance.now() * 0.006;
      const segments = 5;
      const segW = (r * 2) / segments;
      for (let i = segments - 1; i >= 0; --i) {
        const sx = x + r - i * segW;
        const sy = y + r * 0.7;
        const cp = Math.sin(waveTime + i * 2) * 3;
        c.lineTo(sx - segW / 2, sy + cp - 3);
        c.lineTo(sx - segW, sy);
      }
      c.closePath();
      c.fill();
    }, glowColor, 12 * pulsePhase2);

    /* Crown */
    if (!S.boss.vulnerable) {
      D.ctx.fillStyle = '#FFD700';
      const crownY = y - r - 4;
      D.ctx.beginPath();
      D.ctx.moveTo(x - r * 0.5, crownY);
      D.ctx.lineTo(x - r * 0.4, crownY - 8);
      D.ctx.lineTo(x - r * 0.15, crownY - 3);
      D.ctx.lineTo(x, crownY - 10);
      D.ctx.lineTo(x + r * 0.15, crownY - 3);
      D.ctx.lineTo(x + r * 0.4, crownY - 8);
      D.ctx.lineTo(x + r * 0.5, crownY);
      D.ctx.closePath();
      D.ctx.fill();
    }

    /* Eyes */
    const eyeScale = C.BOSS_SIZE * 0.5;
    D.ctx.fillStyle = '#FFFFFF';
    D.ctx.beginPath();
    D.ctx.ellipse(x - r * 0.25, y - r * 0.15, 4 * eyeScale, 5 * eyeScale, 0, 0, Math.PI * 2);
    D.ctx.fill();
    D.ctx.beginPath();
    D.ctx.ellipse(x + r * 0.25, y - r * 0.15, 4 * eyeScale, 5 * eyeScale, 0, 0, Math.PI * 2);
    D.ctx.fill();

    /* Pupils tracking Pac-Man */
    const pdx = S.pacman.x - x;
    const pdy = S.pacman.y - y;
    const pd = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
    const ppx = (pdx / pd) * 2;
    const ppy = (pdy / pd) * 2;

    D.ctx.fillStyle = S.boss.vulnerable ? '#FF0000' : '#2121DE';
    D.ctx.beginPath();
    D.ctx.arc(x - r * 0.25 + ppx, y - r * 0.15 + ppy, 2.5 * eyeScale, 0, Math.PI * 2);
    D.ctx.fill();
    D.ctx.beginPath();
    D.ctx.arc(x + r * 0.25 + ppx, y - r * 0.15 + ppy, 2.5 * eyeScale, 0, Math.PI * 2);
    D.ctx.fill();

    D.ctx.restore();

    /* Draw minions */
    for (const m of S.bossMinions)
      NS.bossview.drawMinion(m);
  }

  NS.bossview.drawMinion = function drawMinion(m) {
    const r = C.TILE / 3;
    D.ctx.save();
    D.ctx.globalAlpha = Math.min(1, m.life / 1000);
    D.ctx.fillStyle = m.color;
    D.ctx.beginPath();
    D.ctx.arc(m.x, m.y - 1, r, Math.PI, 0, false);
    D.ctx.lineTo(m.x + r, m.y + r * 0.8);
    D.ctx.lineTo(m.x, m.y + r * 0.5);
    D.ctx.lineTo(m.x - r, m.y + r * 0.8);
    D.ctx.closePath();
    D.ctx.fill();

    /* Small eyes */
    D.ctx.fillStyle = '#FFFFFF';
    D.ctx.beginPath();
    D.ctx.arc(m.x - 2, m.y - 2, 1.5, 0, Math.PI * 2);
    D.ctx.fill();
    D.ctx.beginPath();
    D.ctx.arc(m.x + 2, m.y - 2, 1.5, 0, Math.PI * 2);
    D.ctx.fill();

    D.ctx.restore();
  }

  NS.bossview.drawBossHealthBar = function drawBossHealthBar() {
    if (!S.boss)
      return;

    const barW = 200;
    const barH = 12;
    const bx = (C.CANVAS_W - barW) / 2;
    const by = 6;

    D.ctx.fillStyle = 'rgba(0,0,0,0.6)';
    D.ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

    const hpFrac = S.boss.hp / S.boss.maxHp;
    D.ctx.fillStyle = hpFrac > 0.5 ? '#4CAF50' : hpFrac > 0.25 ? '#FFEB3B' : '#F44336';
    D.ctx.fillRect(bx, by, barW * hpFrac, barH);

    D.ctx.strokeStyle = '#FFFFFF';
    D.ctx.lineWidth = 1;
    D.ctx.strokeRect(bx, by, barW, barH);

    D.ctx.font = 'bold 10px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.fillStyle = '#FFFFFF';
    D.ctx.fillText(S.boss.type.name + ' (' + S.boss.hp + '/' + S.boss.maxHp + ')', C.CANVAS_W / 2, by + barH + 12);
  }

  NS.bossview.drawBossIntro = function drawBossIntro() {
    D.ctx.fillStyle = 'rgba(0,0,0,0.7)';
    D.ctx.fillRect(0, 0, C.CANVAS_W, C.CANVAS_H);

    const flash = Math.floor(performance.now() / 200) % 2;
    D.ctx.font = 'bold 32px sans-serif';
    D.ctx.textAlign = 'center';
    D.ctx.textBaseline = 'middle';
    D.ctx.fillStyle = flash ? '#FF0000' : '#FF4444';
    D.ctx.strokeStyle = '#000';
    D.ctx.lineWidth = 3;
    D.ctx.strokeText('WARNING', C.CANVAS_W / 2, C.CANVAS_H / 2 - 30);
    D.ctx.fillText('WARNING', C.CANVAS_W / 2, C.CANVAS_H / 2 - 30);

    const bossIndex = Math.floor((S.level - 1) / C.BOSS_EVERY) % T.BOSS_TYPES.length;
    const bossType = T.BOSS_TYPES[bossIndex];
    D.ctx.font = 'bold 18px sans-serif';
    D.ctx.fillStyle = bossType.color;
    D.ctx.strokeText(bossType.name, C.CANVAS_W / 2, C.CANVAS_H / 2 + 10);
    D.ctx.fillText(bossType.name, C.CANVAS_W / 2, C.CANVAS_H / 2 + 10);

    D.ctx.font = '12px sans-serif';
    D.ctx.fillStyle = '#aaa';
    D.ctx.fillText('BOSS APPROACHING', C.CANVAS_W / 2, C.CANVAS_H / 2 + 35);
  }

})();
