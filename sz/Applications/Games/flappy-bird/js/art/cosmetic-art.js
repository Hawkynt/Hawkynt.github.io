;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Hats for the wardrobe. Every hat is painted once into a cached canvas (48 x 40 local
   * units at 2x) whose anchor - the point that sits on the bird's head - is (24, 34).
   * drawHat() blits it rotated and scaled with the bird, so a hat costs one drawImage per
   * frame. Sunglasses sit on the eye instead of the crown of the head.
   */

  const RS = 2;
  const W = 48, H = 40, AX = 24, AY = 34;
  const HEAD = { x: 7, y: -13 };
  const EYE = { x: 9, y: -4 };
  const cache = {};

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function outline(c, color, w) {
    c.lineWidth = w || 1.4;
    c.strokeStyle = color;
    c.stroke();
  }

  function grad(c, y0, y1, top, bot) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    return g;
  }

  const PAINT = {
    cap: function(c) {
      c.beginPath();
      c.arc(0, -2, 11, Math.PI, 0);
      c.closePath();
      c.fillStyle = grad(c, -13, 0, '#5ab8ff', '#2a6ad8');
      c.fill();
      outline(c, '#123a7a');
      c.beginPath();
      c.ellipse(11, -1, 9, 2.6, 0.1, 0, Math.PI * 2);
      c.fillStyle = '#1a4aa8';
      c.fill();
      outline(c, '#0e2a6a', 1.2);
      c.beginPath();
      c.arc(0, -13, 2, 0, Math.PI * 2);
      c.fillStyle = '#ffffff';
      c.fill();
    },
    bow: function(c) {
      c.fillStyle = '#ff4a7a';
      for (let s = -1; s <= 1; s += 2) {
        c.beginPath();
        c.moveTo(0, -5);
        c.quadraticCurveTo(s * 14, -18, s * 13, -4);
        c.quadraticCurveTo(s * 10, 2, 0, -5);
        c.fill();
        outline(c, '#8a1a3a');
      }
      c.beginPath();
      c.arc(0, -5, 3.4, 0, Math.PI * 2);
      c.fillStyle = '#ff8aaa';
      c.fill();
      outline(c, '#8a1a3a');
    },
    goggles: function(c) {
      c.fillStyle = '#6a4a2a';
      c.fillRect(-14, -6, 28, 4);
      for (let s = -1; s <= 1; s += 2) {
        c.beginPath();
        c.arc(s * 6, -6, 5.5, 0, Math.PI * 2);
        c.fillStyle = '#c8a050';
        c.fill();
        outline(c, '#4a3010', 1.2);
        c.beginPath();
        c.arc(s * 6, -6, 3.8, 0, Math.PI * 2);
        c.fillStyle = grad(c, -10, -2, '#bfeaff', '#3a8ac8');
        c.fill();
        c.beginPath();
        c.arc(s * 6 - 1.2, -7.4, 1.2, 0, Math.PI * 2);
        c.fillStyle = '#ffffff';
        c.fill();
      }
    },
    crown: function(c) {
      c.beginPath();
      c.moveTo(-11, 0);
      c.lineTo(-12, -14);
      c.lineTo(-6, -7);
      c.lineTo(0, -17);
      c.lineTo(6, -7);
      c.lineTo(12, -14);
      c.lineTo(11, 0);
      c.closePath();
      c.fillStyle = grad(c, -17, 0, '#fff3a0', '#e0a010');
      c.fill();
      outline(c, '#7a5206');
      const gems = [['#ff3a4a', -6, -4], ['#3ab0ff', 0, -5], ['#3ae070', 6, -4]];
      for (const g of gems) {
        c.beginPath();
        c.arc(g[1], g[2], 1.8, 0, Math.PI * 2);
        c.fillStyle = g[0];
        c.fill();
      }
    },
    tophat: function(c) {
      c.beginPath();
      c.ellipse(0, -1, 14, 3, 0, 0, Math.PI * 2);
      c.fillStyle = '#1a1a22';
      c.fill();
      outline(c, '#000000');
      c.fillStyle = grad(c, -26, 0, '#3a3a48', '#16161e');
      c.fillRect(-8, -26, 16, 25);
      c.strokeStyle = '#000000';
      c.lineWidth = 1.4;
      c.strokeRect(-8, -26, 16, 25);
      c.fillStyle = '#c8302a';
      c.fillRect(-8, -8, 16, 4);
    },
    halo: function(c) {
      c.beginPath();
      c.ellipse(0, -16, 12, 4, 0, 0, Math.PI * 2);
      c.lineWidth = 3.5;
      c.strokeStyle = 'rgba(255,230,120,0.5)';
      c.stroke();
      c.lineWidth = 2;
      c.strokeStyle = '#fff3a0';
      c.stroke();
    },
    viking: function(c) {
      for (let s = -1; s <= 1; s += 2) {
        c.beginPath();
        c.moveTo(s * 8, -6);
        c.quadraticCurveTo(s * 20, -8, s * 18, -22);
        c.quadraticCurveTo(s * 14, -12, s * 6, -10);
        c.closePath();
        c.fillStyle = '#f4ead0';
        c.fill();
        outline(c, '#6a5a3a', 1.2);
      }
      c.beginPath();
      c.arc(0, -1, 11, Math.PI, 0);
      c.closePath();
      c.fillStyle = grad(c, -12, 0, '#d8dce8', '#7a8090');
      c.fill();
      outline(c, '#3a3e4a');
      c.fillStyle = '#a87a3a';
      c.fillRect(-11, -3, 22, 3);
    },
    flower: function(c) {
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 8; ++i) {
        const a = i * Math.PI / 4;
        c.beginPath();
        c.ellipse(Math.cos(a) * 6, -8 + Math.sin(a) * 6, 4.2, 2.2, a, 0, Math.PI * 2);
        c.fill();
        outline(c, '#c8c8d0', 0.8);
      }
      c.beginPath();
      c.arc(0, -8, 3.6, 0, Math.PI * 2);
      c.fillStyle = '#ffcf3a';
      c.fill();
      outline(c, '#c8901a', 1);
    },
    party: function(c) {
      c.beginPath();
      c.moveTo(-10, 0);
      c.lineTo(0, -28);
      c.lineTo(10, 0);
      c.closePath();
      c.fillStyle = '#7a4aff';
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = '#ffd84a';
      for (let i = 0; i < 4; ++i) {
        c.save();
        c.translate(0, -6 - i * 7);
        c.rotate(-0.4);
        c.fillRect(-16, -1.5, 32, 3);
        c.restore();
      }
      c.restore();
      c.beginPath();
      c.moveTo(-10, 0);
      c.lineTo(0, -28);
      c.lineTo(10, 0);
      c.closePath();
      outline(c, '#2a1060');
      c.beginPath();
      c.arc(0, -29, 3.2, 0, Math.PI * 2);
      c.fillStyle = '#ff4ad8';
      c.fill();
    },
    santa: function(c) {
      c.beginPath();
      c.moveTo(-11, -2);
      c.quadraticCurveTo(-4, -26, 12, -20);
      c.quadraticCurveTo(14, -18, 15, -10);
      c.quadraticCurveTo(6, -14, 11, -2);
      c.closePath();
      c.fillStyle = grad(c, -26, 0, '#ff4a4a', '#b81a1a');
      c.fill();
      outline(c, '#6a0a0a');
      c.beginPath();
      c.ellipse(0, -1, 13, 3.6, 0, 0, Math.PI * 2);
      c.fillStyle = '#ffffff';
      c.fill();
      outline(c, '#c8ccd8', 1);
      c.beginPath();
      c.arc(15, -9, 3.4, 0, Math.PI * 2);
      c.fillStyle = '#ffffff';
      c.fill();
    },
    bunny: function(c) {
      for (let s = -1; s <= 1; s += 2) {
        c.save();
        c.translate(s * 5, -2);
        c.rotate(s * 0.25);
        c.beginPath();
        c.ellipse(0, -13, 4.6, 13, 0, 0, Math.PI * 2);
        c.fillStyle = '#ffffff';
        c.fill();
        outline(c, '#a8a8b8', 1.2);
        c.beginPath();
        c.ellipse(0, -13, 2.4, 9.5, 0, 0, Math.PI * 2);
        c.fillStyle = '#ffb0c8';
        c.fill();
        c.restore();
      }
    },
    shades: function(c) {
      c.fillStyle = '#1a1a22';
      c.fillRect(-12, -3, 24, 2);
      for (let s = -1; s <= 1; s += 2) {
        c.beginPath();
        c.ellipse(s * 5.5, 0, 5.4, 4, 0, 0, Math.PI * 2);
        c.fillStyle = grad(c, -4, 4, '#3a3a5a', '#0a0a14');
        c.fill();
        outline(c, '#000000', 1);
        c.beginPath();
        c.ellipse(s * 5.5 - 2, -1.4, 1.6, 0.9, -0.4, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,255,255,0.8)';
        c.fill();
      }
    },
    beret: function(c) {
      c.beginPath();
      c.ellipse(-1, -5, 13, 5.5, -0.15, 0, Math.PI * 2);
      c.fillStyle = grad(c, -11, 0, '#d86a2a', '#8a3a12');
      c.fill();
      outline(c, '#4a1a06');
      c.fillStyle = '#4a1a06';
      c.fillRect(-1, -12, 2, 3);
      c.beginPath();
      c.moveTo(6, -8);
      c.quadraticCurveTo(12, -16, 16, -9);
      c.quadraticCurveTo(11, -7, 6, -8);
      c.fillStyle = '#e8b030';
      c.fill();
      outline(c, '#7a4a0a', 1);
    },
    witch: function(c) {
      c.beginPath();
      c.ellipse(0, -1, 16, 3.4, 0, 0, Math.PI * 2);
      c.fillStyle = '#2a1a3a';
      c.fill();
      outline(c, '#0a0612');
      c.beginPath();
      c.moveTo(-9, -2);
      c.lineTo(-2, -24);
      c.quadraticCurveTo(4, -32, 12, -28);
      c.quadraticCurveTo(4, -26, 3, -20);
      c.lineTo(9, -2);
      c.closePath();
      c.fillStyle = grad(c, -30, 0, '#5a2a7a', '#2a1a3a');
      c.fill();
      outline(c, '#0a0612');
      c.fillStyle = '#ff8a1e';
      c.fillRect(-8, -7, 16, 3);
      c.fillStyle = '#ffd84a';
      c.fillRect(-2, -8, 4, 5);
    }
  };

  const HAT_IDS = Object.keys(PAINT);

  function getHat(id) {
    if (!PAINT[id])
      return null;
    if (cache[id])
      return cache[id];
    const cv = makeCanvas(W * RS, H * RS);
    const c = cv.getContext('2d');
    c.scale(RS, RS);
    c.translate(AX, AY);
    PAINT[id](c);
    cache[id] = cv;
    return cv;
  }

  /* opts: x, y (bird centre), angle, scale, hatId, sx, sy, flip, alpha */
  function drawHat(ctx, opts) {
    const img = getHat(opts.hatId);
    if (!img)
      return;
    const scale = opts.scale === undefined ? 1 : opts.scale;
    const sx = scale * (opts.sx || 1), sy = scale * (opts.sy || 1);
    const at = opts.hatId === 'shades' ? EYE : HEAD;
    ctx.save();
    ctx.translate(opts.x, opts.y);
    ctx.rotate(opts.angle || 0);
    if (opts.flip)
      ctx.scale(-1, 1);
    if (opts.alpha !== undefined && opts.alpha !== 1)
      ctx.globalAlpha *= opts.alpha;
    ctx.drawImage(img, (at.x - AX) * sx, (at.y - AY) * sy, W * sx, H * sy);
    ctx.restore();
  }

  SZ.FlappyCosmeticArt = Object.freeze({ HAT_IDS, getHat, drawHat });
})();
