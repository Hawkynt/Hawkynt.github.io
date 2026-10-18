/* ui/pixel-art.js -- offscreen canvases, pixelation and the pixel-art HUD icons.
   Reads: constants, env. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const { TWO_PI, parseHex } = NS.constants;
  const { ctx } = NS.env;

  /* ══════════════════════════════════════════════════════════════════
     PIXEL ART -- shapes are drawn at art resolution, then every pixel is
     snapped to opaque/transparent and outlined; results are cached
     ══════════════════════════════════════════════════════════════════ */

  const OUTLINE = '#120c18';

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function pixelize(c, outline) {
    const g = c.getContext('2d');
    const w = c.width, h = c.height;
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4)
      d[i] = d[i] >= 100 ? 255 : 0;
    if (outline) {
      const solid = new Uint8Array(w * h);
      for (let i = 0; i < w * h; ++i)
        solid[i] = d[i * 4 + 3] ? 1 : 0;
      const [or, og, ob] = parseHex(outline);
      for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x) {
          if (solid[y * w + x]) continue;
          if ((x > 0 && solid[y * w + x - 1]) || (x < w - 1 && solid[y * w + x + 1]) || (y > 0 && solid[(y - 1) * w + x]) || (y < h - 1 && solid[(y + 1) * w + x])) {
            const i = (y * w + x) * 4;
            d[i] = or; d[i + 1] = og; d[i + 2] = ob; d[i + 3] = 255;
          }
        }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // draw(g, w, h) paints at art resolution; a 1px border is left for the outline
  function pixelArt(w, h, draw, outline) {
    const c = makeCanvas(w + 2, h + 2);
    const g = c.getContext('2d');
    g.translate(1, 1);
    draw(g, w, h);
    return pixelize(c, outline === undefined ? OUTLINE : outline);
  }

  /* ── HUD icons (16x16 art pixels) ── */
  const ICONS = {
    heart: (g) => {
      g.fillStyle = '#e8354a';
      g.beginPath();
      g.moveTo(8, 14); g.lineTo(1.5, 7); g.arc(4.6, 4.8, 3.6, Math.PI * 0.85, Math.PI * 1.9); g.arc(11.4, 4.8, 3.6, Math.PI * 1.1, Math.PI * 0.15); g.closePath();
      g.fill();
      g.fillStyle = '#ff8fa0'; g.fillRect(3, 3, 2, 2);
      g.fillStyle = '#a3162b'; g.fillRect(8, 11, 2, 2); g.fillRect(11, 8, 2, 2);
    },
    coin: (g) => {
      g.fillStyle = '#b8801a'; g.beginPath(); g.arc(8, 8.6, 6.6, 0, TWO_PI); g.fill();
      g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(8, 7.6, 6.2, 0, TWO_PI); g.fill();
      g.fillStyle = '#ffeea0'; g.fillRect(4, 3, 3, 2);
      g.fillStyle = '#c99220'; g.fillRect(7, 4, 2, 7); g.fillRect(5, 5, 6, 1); g.fillRect(5, 9, 6, 1);
    },
    flag: (g) => {
      g.fillStyle = '#8a6a48'; g.fillRect(2, 1, 2, 14);
      g.fillStyle = '#e8354a'; g.beginPath(); g.moveTo(4, 2); g.lineTo(14, 4.5); g.lineTo(4, 8.5); g.fill();
      g.fillStyle = '#ff8fa0'; g.fillRect(5, 3, 3, 1);
    },
    skull: (g) => {
      g.fillStyle = '#e8e2d4'; g.beginPath(); g.arc(8, 7, 6, 0, TWO_PI); g.fill(); g.fillRect(4, 10, 8, 4);
      g.fillStyle = '#2a1e2e'; g.fillRect(4, 6, 3, 3); g.fillRect(9, 6, 3, 3); g.fillRect(7, 10, 2, 2);
      g.fillStyle = '#9a9284'; g.fillRect(5, 13, 1, 2); g.fillRect(8, 13, 1, 2); g.fillRect(11, 13, 1, 1);
    },
    star: (g) => {
      g.fillStyle = '#ffcf3a'; g.beginPath();
      for (let i = 0; i < 10; ++i) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 7.4;
        g.lineTo(8 + Math.cos(a) * r, 8.4 + Math.sin(a) * r);
      }
      g.fill();
      g.fillStyle = '#fff3a8'; g.fillRect(7, 4, 2, 3); g.fillRect(5, 7, 2, 1);
    },
    starEmpty: (g) => {
      g.fillStyle = '#3a3a52'; g.beginPath();
      for (let i = 0; i < 10; ++i) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 7.4;
        g.lineTo(8 + Math.cos(a) * r, 8.4 + Math.sin(a) * r);
      }
      g.fill();
    },
    lock: (g) => {
      g.strokeStyle = '#a8b0c8'; g.lineWidth = 2; g.beginPath(); g.arc(8, 6, 3.5, Math.PI, 0); g.stroke();
      g.fillRect(4.5, 6, 0.1, 0.1);
      g.fillStyle = '#d8a83a'; g.fillRect(3, 7, 10, 8);
      g.fillStyle = '#ffd86a'; g.fillRect(3, 7, 10, 2);
      g.fillStyle = '#5a3a10'; g.fillRect(7, 10, 2, 3);
    },
    check: (g) => {
      g.strokeStyle = '#5ee07a'; g.lineWidth = 3; g.lineCap = 'square';
      g.beginPath(); g.moveTo(2.5, 8.5); g.lineTo(6.5, 12.5); g.lineTo(13.5, 3.5); g.stroke();
    },
    pause: (g) => {
      g.fillStyle = '#e4eaf6'; g.fillRect(3, 2, 4, 12); g.fillRect(9, 2, 4, 12);
    },
    play: (g) => {
      g.fillStyle = '#e4eaf6'; g.beginPath(); g.moveTo(4, 2); g.lineTo(14, 8); g.lineTo(4, 14); g.fill();
    },
    help: (g) => {
      g.fillStyle = '#5ab8ff'; g.beginPath(); g.arc(8, 8, 7, 0, TWO_PI); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 8, 8.5);
    },
    menu: (g) => {
      g.fillStyle = '#e4eaf6'; g.fillRect(2, 3, 12, 2); g.fillRect(2, 7, 12, 2); g.fillRect(2, 11, 12, 2);
    },
    loop: (g) => {
      g.strokeStyle = '#7ad8ff'; g.lineWidth = 2; g.beginPath(); g.arc(8, 8, 5, 0.3, Math.PI * 1.6); g.stroke();
      g.fillStyle = '#7ad8ff'; g.beginPath(); g.moveTo(13, 3); g.lineTo(14, 9); g.lineTo(8.5, 6.5); g.fill();
    },
    sword: (g) => {
      g.save(); g.translate(8, 8); g.rotate(-Math.PI / 4);
      g.fillStyle = '#d8e0f0'; g.fillRect(-1.5, -7.5, 3, 10);
      g.fillStyle = '#ffffff'; g.fillRect(-1.5, -7.5, 1, 10);
      g.fillStyle = '#d8a83a'; g.fillRect(-4, 2.5, 8, 2);
      g.fillStyle = '#7a4a2a'; g.fillRect(-1, 4.5, 2, 3);
      g.restore();
    },
    range: (g) => {
      g.strokeStyle = '#7ad8ff'; g.lineWidth = 1.6; g.beginPath(); g.arc(8, 8, 6, 0, TWO_PI); g.stroke();
      g.beginPath(); g.arc(8, 8, 2.6, 0, TWO_PI); g.stroke();
      g.fillStyle = '#7ad8ff'; g.fillRect(7, 0, 2, 4); g.fillRect(7, 12, 2, 4); g.fillRect(0, 7, 4, 2); g.fillRect(12, 7, 4, 2);
    },
    clock: (g) => {
      g.fillStyle = '#e4eaf6'; g.beginPath(); g.arc(8, 8, 7, 0, TWO_PI); g.fill();
      g.fillStyle = '#2a3248'; g.fillRect(7, 3, 2, 6); g.fillRect(7, 7, 5, 2);
    },
    hammer: (g) => {
      g.save(); g.translate(8, 8); g.rotate(Math.PI / 4);
      g.fillStyle = '#8a5a30'; g.fillRect(-1, -2, 2, 10);
      g.fillStyle = '#b8c0d8'; g.fillRect(-5, -7, 10, 5);
      g.fillStyle = '#e8eef8'; g.fillRect(-5, -7, 10, 1);
      g.restore();
    },
    up: (g) => {
      g.fillStyle = '#5ee07a'; g.beginPath(); g.moveTo(8, 1); g.lineTo(15, 8); g.lineTo(11, 8); g.lineTo(11, 15); g.lineTo(5, 15); g.lineTo(5, 8); g.lineTo(1, 8); g.fill();
      g.fillStyle = '#b8ffc8'; g.fillRect(7, 3, 2, 3);
    },
    wrench: (g) => {
      g.save(); g.translate(8, 8); g.rotate(Math.PI / 4);
      g.fillStyle = '#b8c0d8'; g.fillRect(-1.5, -3, 3, 11);
      g.beginPath(); g.arc(0, -4, 4, 0, TWO_PI); g.fill();
      g.fillStyle = '#2a3248'; g.fillRect(-1.2, -9, 2.4, 5);
      g.restore();
    },
    crown: (g) => {
      g.fillStyle = '#ffcf3a'; g.beginPath(); g.moveTo(1, 13); g.lineTo(2, 4); g.lineTo(5.5, 8); g.lineTo(8, 2); g.lineTo(10.5, 8); g.lineTo(14, 4); g.lineTo(15, 13); g.fill();
      g.fillStyle = '#e8354a'; g.fillRect(7, 9, 2, 2);
      g.fillStyle = '#c99220'; g.fillRect(1, 12, 14, 2);
    },
    bolt: (g) => {
      g.fillStyle = '#ffe14a'; g.beginPath(); g.moveTo(9, 1); g.lineTo(3, 9); g.lineTo(7.5, 9); g.lineTo(6, 15); g.lineTo(13, 6); g.lineTo(8.5, 6); g.lineTo(10.5, 1); g.fill();
    },
    target: (g) => {
      g.strokeStyle = '#ff6a6a'; g.lineWidth = 2; g.beginPath(); g.arc(8, 8, 6, 0, TWO_PI); g.stroke();
      g.fillStyle = '#ff6a6a'; g.fillRect(7, 7, 2, 2); g.fillRect(7, 0, 2, 4); g.fillRect(7, 12, 2, 4); g.fillRect(0, 7, 4, 2); g.fillRect(12, 7, 4, 2);
    },
    shield: (g) => {
      g.fillStyle = '#5ab8ff'; g.beginPath(); g.moveTo(8, 1); g.lineTo(14, 3); g.lineTo(13, 10); g.lineTo(8, 15); g.lineTo(3, 10); g.lineTo(2, 3); g.fill();
      g.fillStyle = '#b8e4ff'; g.fillRect(5, 4, 2, 5);
    },
    eye: (g) => {
      g.fillStyle = '#e4eaf6'; g.beginPath(); g.ellipse(8, 8, 7.5, 4.5, 0, 0, TWO_PI); g.fill();
      g.fillStyle = '#5ab8ff'; g.beginPath(); g.arc(8, 8, 3.2, 0, TWO_PI); g.fill();
      g.fillStyle = '#10141e'; g.fillRect(7, 7, 2, 2);
      g.fillStyle = '#ffffff'; g.fillRect(9, 6, 1, 1);
    },
    bomb: (g) => {
      g.fillStyle = '#2a2a34'; g.beginPath(); g.arc(7, 9.5, 5.5, 0, TWO_PI); g.fill();
      g.fillStyle = '#5a5a6a'; g.fillRect(4, 6, 2, 2);
      g.fillStyle = '#8a6a48'; g.fillRect(10, 2, 2, 4);
      g.fillStyle = '#ffd75a'; g.fillRect(11, 0, 3, 2);
      g.fillStyle = '#ff6a1a'; g.fillRect(13, 1, 2, 1);
    },
    snow: (g) => {
      g.strokeStyle = '#bfeaff'; g.lineWidth = 2;
      for (let i = 0; i < 3; ++i) {
        const a = i * Math.PI / 3;
        g.beginPath(); g.moveTo(8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7); g.lineTo(8 - Math.cos(a) * 7, 8 - Math.sin(a) * 7); g.stroke();
      }
      g.fillStyle = '#ffffff'; g.fillRect(7, 7, 2, 2);
    },
    rush: (g) => {
      g.fillStyle = '#8a5a20'; g.beginPath(); g.arc(8, 10, 5.5, 0, TWO_PI); g.fill();
      g.fillStyle = '#b8803a'; g.fillRect(5, 3, 6, 3);
      g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(8, 10, 2.6, 0, TWO_PI); g.fill();
      g.fillStyle = '#ffd34a'; g.fillRect(1, 1, 2, 2); g.fillRect(13, 2, 2, 2); g.fillRect(14, 12, 2, 2);
    },
    flask: (g) => {
      g.fillStyle = '#c8d4ec'; g.fillRect(6, 1, 4, 2);
      g.fillStyle = '#7ad8ff'; g.beginPath(); g.moveTo(6.5, 3); g.lineTo(9.5, 3); g.lineTo(9.5, 7); g.lineTo(14, 14); g.lineTo(2, 14); g.lineTo(6.5, 7); g.fill();
      g.fillStyle = '#c890ff'; g.beginPath(); g.moveTo(4.5, 10); g.lineTo(11.5, 10); g.lineTo(13.5, 13.5); g.lineTo(2.5, 13.5); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(5, 11, 1, 1); g.fillRect(9, 12, 1, 1);
    }
  };

  const iconCache = {};

  function getIcon(key) {
    let c = iconCache[key];
    if (c === undefined) {
      const fn = ICONS[key];
      c = iconCache[key] = fn ? pixelArt(16, 16, fn) : null;
    }
    return c;
  }

  // Draw a cached pixel image centred at (cx, cy) with the given height
  function drawPixelImage(img, cx, cy, size, alpha) {
    if (!img) return;
    const prevA = ctx.globalAlpha;
    if (alpha !== undefined)
      ctx.globalAlpha = prevA * alpha;
    ctx.imageSmoothingEnabled = false;
    const h = size, w = size * img.width / img.height;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = prevA;
  }

  function drawIcon(key, cx, cy, size, alpha) {
    drawPixelImage(getIcon(key), cx, cy, size, alpha);
  }

  NS.pixelArt = { OUTLINE, makeCanvas, pixelArt, ICONS, drawIcon };

})();
