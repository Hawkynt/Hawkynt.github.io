/* Cached result-screen and menu art painted once: stars, ray burst, level medallions and the
   Grimoire inscription circle. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const { ui } = NS.context;

  /* cached result-screen art: a gold star (earned or an empty socket) and a ray burst */
  const resultArt = {};

  function starSprite(earned) {
    const key = earned ? 'star1' : 'star0';
    if (resultArt[key])
      return resultArt[key];
    const n = 128, c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const g = c.getContext('2d');
    g.translate(n / 2, n / 2 + 2);
    const path = function(r) {
      g.beginPath();
      for (let i = 0; i < 10; ++i) {
        const rad = i % 2 === 0 ? r : r * 0.48;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        if (i === 0) g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      g.closePath();
    };
    g.lineJoin = 'round';
    if (earned) {
      path(56);
      g.fillStyle = '#5a3608';
      g.fill();
      path(52);
      const gr = g.createLinearGradient(0, -52, 0, 52);
      gr.addColorStop(0, '#fff6c0');
      gr.addColorStop(0.35, '#ffd75a');
      gr.addColorStop(0.75, '#e09a20');
      gr.addColorStop(1, '#a85e10');
      g.fillStyle = gr;
      g.fill();
      /* facets: the left half of every arm a little brighter */
      g.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i < 5; ++i) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * 52, Math.sin(a) * 52);
        g.lineTo(Math.cos(a - Math.PI / 5) * 25, Math.sin(a - Math.PI / 5) * 25);
        g.closePath();
        g.fill();
      }
      g.lineWidth = 2;
      g.strokeStyle = '#fff2b0';
      path(46);
      g.globalAlpha = 0.5;
      g.stroke();
    } else {
      path(54);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fill();
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(232,196,106,0.35)';
      g.stroke();
      path(40);
      g.lineWidth = 1.5;
      g.strokeStyle = 'rgba(255,255,255,0.08)';
      g.stroke();
    }
    resultArt[key] = c;
    return c;
  }

  function raySprite() {
    if (resultArt.rays)
      return resultArt.rays;
    const n = 512, c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const g = c.getContext('2d');
    g.translate(n / 2, n / 2);
    const rg = g.createRadialGradient(0, 0, 10, 0, 0, n / 2);
    rg.addColorStop(0, 'rgba(255,230,150,0.9)');
    rg.addColorStop(0.4, 'rgba(255,200,90,0.35)');
    rg.addColorStop(1, 'rgba(255,200,90,0)');
    g.fillStyle = rg;
    for (let i = 0; i < 18; ++i) {
      const a = i * Math.PI * 2 / 18;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, n / 2, a - 0.07, a + 0.07);
      g.closePath();
      g.fill();
    }
    resultArt.rays = c;
    return c;
  }

  /* a level node: a gold-rimmed medallion with a gem-coloured heart */
  const medallionCache = {};
  function medallion(color) {
    if (medallionCache[color])
      return medallionCache[color];
    const n = 80, c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const g = c.getContext('2d');
    const h = n / 2;
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath();
    g.arc(h + 1.5, h + 3, h - 3, 0, Math.PI * 2);
    g.fill();
    const rim = g.createLinearGradient(0, 0, 0, n);
    rim.addColorStop(0, '#fff2c0');
    rim.addColorStop(0.35, '#e0b24e');
    rim.addColorStop(1, '#5a3a10');
    g.fillStyle = rim;
    g.beginPath();
    g.arc(h, h, h - 4, 0, Math.PI * 2);
    g.fill();
    const core = g.createRadialGradient(h - 6, h - 8, 2, h, h, h - 10);
    core.addColorStop(0, ui.shade(color, 0.35));
    core.addColorStop(0.5, ui.shade(color, -0.25));
    core.addColorStop(1, ui.shade(color, -0.7));
    g.fillStyle = core;
    g.beginPath();
    g.arc(h, h, h - 10, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(h - 7, h - 11, 9, 4, -0.5, 0, Math.PI * 2);
    g.fill();
    medallionCache[color] = c;
    return c;
  }

  /* the Grimoire's inscription circle: rings, rune ticks and a hexagram, cached */
  let arcaneCircleCanvas = null;
  function arcaneCircle() {
    if (arcaneCircleCanvas)
      return arcaneCircleCanvas;
    const n = 660, c = document.createElement('canvas');
    c.width = n;
    c.height = n;
    const g = c.getContext('2d');
    g.translate(n / 2, n / 2);
    g.strokeStyle = '#c86aff';
    const ring = function(r, w) {
      g.lineWidth = w;
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.stroke();
    };
    ring(320, 3);
    ring(304, 1.5);
    ring(230, 2);
    ring(120, 2);
    g.lineWidth = 2;
    for (let i = 0; i < 72; ++i) {
      const a = i * Math.PI * 2 / 72, r0 = i % 6 === 0 ? 278 : 292;
      g.beginPath();
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      g.lineTo(Math.cos(a) * 304, Math.sin(a) * 304);
      g.stroke();
    }
    for (let t = 0; t < 2; ++t) {
      g.beginPath();
      for (let i = 0; i <= 3; ++i) {
        const a = -Math.PI / 2 + t * Math.PI + i * Math.PI * 2 / 3;
        if (i === 0) g.moveTo(Math.cos(a) * 230, Math.sin(a) * 230);
        else g.lineTo(Math.cos(a) * 230, Math.sin(a) * 230);
      }
      g.stroke();
    }
    g.font = 'bold 22px ' + ui.TITLE_FONT;
    g.fillStyle = '#e0a8ff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
    for (let i = 0; i < 24; ++i) {
      const a = i * Math.PI * 2 / 24;
      g.save();
      g.rotate(a);
      g.fillText(glyphs.charAt(i), 0, -262);
      g.restore();
    }
    arcaneCircleCanvas = c;
    return c;
  }

  NS.sprites = { starSprite, raySprite, medallion, arcaneCircle };
})();
