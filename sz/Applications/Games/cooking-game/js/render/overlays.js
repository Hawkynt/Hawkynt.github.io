;(function() {
  'use strict';

  /* Full-screen moods over the play view: rush tension, the combo banner,
     the day intro ribbon, the gold edge and rush glows and the iris
     transition. Reads G only. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H } = NS.C;
  const { ctx, ui, visibleRect, fillVisibleRect } = NS.view;
  const { drawFlame, drawRibbon } = NS.sprites;

  /* screen transition: an iris closing to black and opening on the new screen */
  function drawIris(k) {
    const v = visibleRect();
    if (k >= 0.999) {
      ctx.fillStyle = '#0a0602';
      fillVisibleRect();
      return;
    }
    const maxR = Math.hypot(v.x1 - v.x0, v.y1 - v.y0) / 2 + 20;
    const e = 1 - k;
    const r = Math.max(0, maxR * e * e * (3 - 2 * e));
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    ctx.arc(VIEW_W / 2, VIEW_H / 2, r, 0, Math.PI * 2, true);
    ctx.fillStyle = '#0a0602';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,90,' + (0.6 * k).toFixed(3) + ')';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(VIEW_W / 2, VIEW_H / 2, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* Rush tension: a soft red glow pulses at the screen edges while the day
     is a rush day or three guests wait at once. */
  function drawTension() {
    const a = G.tension * (0.10 + 0.05 * Math.sin(G.animT * 5));
    ctx.save();
    for (let i = 0; i < 4; ++i) {
      ctx.strokeStyle = 'rgba(224,50,40,' + (a * (1 - i * 0.22)).toFixed(3) + ')';
      ctx.lineWidth = 10;
      ctx.strokeRect(5 + i * 9, 5 + i * 9, VIEW_W - 10 - i * 18, VIEW_H - 10 - i * 18);
    }
    ctx.restore();
  }

  /* the big COMBO ×n banner: slams in over turning rays, burns with a row
     of flames and fades out over a second and a half */
  function drawComboBanner() {
    const k = G.comboBanner.t / 1.5;
    const s = k < 0.1 ? 0.2 + 1.6 * (k / 0.1) : k < 0.2 ? 1.8 - 0.8 * ((k - 0.1) / 0.1) : 1 + Math.sin(G.animT * 8) * 0.02;
    const a = k > 0.75 ? (1 - k) / 0.25 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(VIEW_W / 2, 150);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.5;
    ctx.rotate(G.animT * 0.6);
    ui.drawGlow(0, 0, 520, '#ff8a2a', 14);
    ctx.restore();
    for (let i = -3; i <= 3; ++i)
      drawFlame(i * 46, 34 - Math.abs(i) * 4, 30 - Math.abs(i) * 3);
    ctx.rotate(Math.sin(k * 20) * 0.03 * (1 - k));
    ctx.scale(s, s);
    ui.drawHeadline('COMBO ×' + G.comboBanner.n + '!', 0, 0, 640, 64, '#ffd23f', '#ff5a1a');
    ctx.restore();
  }

  /* the opening banner: a ribbon sweeps in with the day and venue, then away */
  function drawDayIntro() {
    const t = 2.2 - G.dayIntro;
    const inK = Math.min(1, t / 0.35), outK = Math.max(0, (t - 1.7) / 0.5);
    const ease = 1 - Math.pow(1 - inK, 3);
    const x = VIEW_W / 2 + (1 - ease) * -900 + outK * outK * 1100;
    ctx.save();
    ctx.globalAlpha = 1 - outK;
    const what = G.mode === 'career' ? 'Day ' + G.dayInfo.id : G.mode === 'daily' ? 'Daily Special' : 'Endless Rush';
    drawRibbon(x, 250, 560, 64, what + ' — ' + G.location.name, '#c8302a');
    const s = t < 0.5 ? 0.2 + 0.8 * Math.min(1, Math.max(0, (t - 0.15) / 0.35)) : 1 + Math.sin(t * 6) * 0.03;
    if (t > 0.15) {
      ctx.translate(x, 330);
      ctx.scale(s, s);
      ui.drawHeadline(G.mode === 'career' && G.dayInfo.special === 'rush' ? 'Rush hour!' : G.mode === 'career' && G.dayInfo.special === 'critic' ? 'A critic is coming!' : 'Let\'s cook!', 0, 0, 700, 56, '#ffd23f', '#ff6a1a');
    }
    ctx.restore();
  }

  /* one second of gold light along the screen edge when the combo steps up */
  function drawEdgeGlow() {
    ctx.save();
    for (let i = 0; i < 4; ++i) {
      ctx.strokeStyle = 'rgba(255,200,60,' + (0.4 * G.edgeGlow * (1 - i * 0.22)).toFixed(3) + ')';
      ctx.lineWidth = 10;
      ctx.strokeRect(5 + i * 9, 5 + i * 9, VIEW_W - 10 - i * 18, VIEW_H - 10 - i * 18);
    }
    ctx.restore();
  }

  /* Golden edge glow while the Rush Hour Bell is ringing. */
  function drawRushGlow() {
    const a = 0.25 + 0.12 * Math.sin(G.animT * 7);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,210,63,' + a.toFixed(3) + ')';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, VIEW_W - 14, VIEW_H - 14);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,240,180,' + Math.min(1, a + 0.2).toFixed(3) + ')';
    ctx.strokeRect(12, 12, VIEW_W - 24, VIEW_H - 24);
    ctx.restore();
  }

  NS.overlays = { drawIris, drawRushGlow, drawTension, drawComboBanner, drawDayIntro,
    drawEdgeGlow };

})();
