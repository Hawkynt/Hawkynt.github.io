/* Lobby overlays: the trophy cabinet (achievements) and the statistics board
   (totals, streaks, per-category records, most played games). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const CE = SZ.CardEngine;
  const K = NS.constants;
  const PA = NS.paint;
  const P = NS.profile;
  const SCR = NS.screens = NS.screens || {};

  const W = K.CANVAS_W, H = K.CANVAS_H;
  const BOX = { x: 70, y: 40, w: 760, h: 520 };
  const CLOSE = { x: BOX.x + BOX.w - 106, y: BOX.y + 16, w: 88, h: 30 };
  let which = null;
  let t = 0;

  SCR.open = () => !!which;
  SCR.show = (w) => { which = w; t = 0; };
  SCR.close = () => { which = null; };

  SCR.click = function(x, y) {
    if (x >= CLOSE.x && x <= CLOSE.x + CLOSE.w && y >= CLOSE.y && y <= CLOSE.y + CLOSE.h) { which = null; return; }
    if (x < BOX.x || x > BOX.x + BOX.w || y < BOX.y || y > BOX.y + BOX.h) which = null;
  };

  function drawTrophies(cx) {
    const list = NS.achievements.LIST;
    const d = P.data();
    PA.goldText(cx, 'Trophy Cabinet', W / 2, BOX.y + 32, 28);
    PA.text(cx, NS.achievements.earned() + ' of ' + list.length + ' earned', W / 2, BOX.y + 58, 12, '#d8c8a0', { weight: 'normal' });
    const cols = 3, cw = 236, rh = 36;
    for (let i = 0; i < list.length; ++i) {
      const a = list[i];
      const got = !!d.achievements[a.id];
      const x = BOX.x + 24 + (i % cols) * (cw + 8), y = BOX.y + 78 + Math.floor(i / cols) * (rh + 3);
      const appear = PA.clamp01((t - i * 0.015) / 0.25);
      cx.save();
      cx.globalAlpha = appear;
      CE.drawRoundedRect(cx, x, y, cw, rh, 7);
      cx.fillStyle = got ? 'rgba(120,90,20,0.45)' : 'rgba(0,0,0,0.35)';
      cx.fill();
      cx.strokeStyle = got ? 'rgba(255,215,120,0.8)' : 'rgba(255,215,120,0.15)';
      cx.lineWidth = 1;
      cx.stroke();
      PA.text(cx, got ? a.icon : '?', x + 18, y + rh / 2 + 1, 16, got ? '#ffd54f' : '#6a6050', { serif: true });
      PA.text(cx, a.name, x + 36, y + 13, 12, got ? '#fff4d6' : '#9a9080', { align: 'left' });
      const sub = a.desc + (a.reward ? '  ·  ' + a.reward.name : '');
      PA.fitText(cx, sub, cw - 44, 9.5, 'normal');
      cx.fillStyle = got ? '#d8c8a0' : '#7a7060';
      cx.textAlign = 'left';
      cx.fillText(sub, x + 36, y + 28);
      cx.restore();
    }
  }

  function drawStats(cx) {
    const d = P.data();
    PA.goldText(cx, 'Statistics', W / 2, BOX.y + 32, 28);
    const rows = [
      ['Level', d.level], ['Rounds finished', d.totalPlayed], ['Rounds won', d.totalWon],
      ['Win rate', d.totalPlayed ? Math.round(d.totalWon / d.totalPlayed * 100) + '%' : '—'],
      ['Best win streak', d.bestWinStreak], ['Days played', d.days], ['Best day streak', d.bestDayStreak],
      ['Featured games finished', d.featuredCount],
      ['Games tried', Object.values(d.games).filter(g => g.played > 0).length + ' / ' + K.VARIANTS.length]
    ];
    for (let i = 0; i < rows.length; ++i) {
      const y = BOX.y + 84 + i * 26;
      PA.text(cx, rows[i][0], BOX.x + 40, y, 13, '#d8c8a0', { align: 'left', weight: 'normal' });
      PA.text(cx, String(rows[i][1]), BOX.x + 300, y, 14, '#ffe7a8', { align: 'right' });
    }
    /* per category */
    PA.text(cx, 'Categories', BOX.x + 360, BOX.y + 84, 14, '#ffe7a8', { align: 'left', serif: true });
    let max = 1;
    const cats = K.SORTED_CATS.map(c => {
      let won = 0, played = 0;
      for (const g of c.games) { const s = P.game(g.variant.id); won += s.won; played += s.played; }
      max = Math.max(max, played);
      return { c, won, played };
    });
    cats.forEach((e, i) => {
      const y = BOX.y + 106 + i * 26;
      PA.emblem(cx, e.c.name, BOX.x + 370, y, 0.65, '#ffd54f');
      PA.text(cx, e.c.name, BOX.x + 384, y, 11, '#e3d6b8', { align: 'left', weight: 'normal' });
      const grow = PA.ease.out(PA.clamp01(t / 0.6));
      PA.bar(cx, BOX.x + 480, y - 6, 200, 12, e.played / max * grow, { light: '#a5d6a7', dark: '#2e7d32' });
      PA.text(cx, e.won + '/' + e.played, BOX.x + 700, y, 11, '#ffe7a8', { align: 'left' });
    });
    /* most played */
    const top = Object.entries(d.games).filter(([, g]) => g.played > 0).sort((a, b) => b[1].played - a[1].played).slice(0, 5);
    PA.text(cx, 'Most played', BOX.x + 360, BOX.y + 300, 14, '#ffe7a8', { align: 'left', serif: true });
    top.forEach(([id, g], i) => {
      const v = K.VARIANTS.find(x => x.id === id);
      const y = BOX.y + 324 + i * 22;
      PA.text(cx, (i + 1) + '.  ' + (v ? v.name : id), BOX.x + 370, y, 12, '#e3d6b8', { align: 'left', weight: 'normal' });
      PA.text(cx, g.won + ' won / ' + g.played, BOX.x + 700, y, 11, '#d8c8a0', { align: 'right', weight: 'normal' });
    });
    if (!top.length) PA.text(cx, 'Play a few rounds to fill this board.', BOX.x + 370, BOX.y + 326, 12, '#9a9080', { align: 'left', weight: 'normal' });
  }

  SCR.draw = function(cx) {
    if (!which) return;
    t += 1 / 60;
    const p = PA.ease.out(PA.clamp01(t / 0.25));
    cx.save();
    cx.fillStyle = 'rgba(0,0,0,' + 0.6 * p + ')';
    cx.fillRect(-2000, -2000, 5000, 5000);
    cx.globalAlpha = p;
    cx.translate(W / 2, H / 2);
    cx.scale(0.94 + 0.06 * p, 0.94 + 0.06 * p);
    cx.translate(-W / 2, -H / 2);
    PA.panel(cx, BOX.x, BOX.y, BOX.w, BOX.h, { radius: 14 });
    if (which === 'trophies') drawTrophies(cx);
    else drawStats(cx);
    PA.button(cx, CLOSE.x, CLOSE.y, CLOSE.w, CLOSE.h, 'Close');
    cx.restore();
  };
})();
