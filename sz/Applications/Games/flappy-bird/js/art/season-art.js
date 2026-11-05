;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Seasonal dressing for the scenery: the collectible token of every event, the ground
   * decor that rolls by (snowmen, egg baskets, beach umbrellas, hay bales, pumpkins,
   * rockets), toppers on the pipe caps (snow, blossoms, candles), and sky extras (a big
   * moon in autumn and at Halloween). Every sprite is painted once into a cached canvas.
   */

  const TWO_PI = Math.PI * 2;
  const cache = {};

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function cached(key, w, h, paint) {
    if (cache[key])
      return cache[key];
    const cv = makeCanvas(w, h);
    paint(cv.getContext('2d'));
    cache[key] = cv;
    return cv;
  }

  function radial(c, x, y, r, stops) {
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    for (let i = 0; i < stops.length; ++i)
      g.addColorStop(i / (stops.length - 1), stops[i]);
    return g;
  }

  function star(c, cx, cy, ro, ri, n) {
    c.beginPath();
    for (let k = 0; k < n * 2; ++k) {
      const r = k & 1 ? ri : ro;
      const a = -Math.PI / 2 + k * Math.PI / n;
      if (k === 0)
        c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else
        c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    c.closePath();
  }

  /* ── tokens, 44 px with a soft halo ── */
  const TOKEN = {
    newyear: function(c) {
      star(c, 22, 22, 15, 6, 5);
      c.fillStyle = radial(c, 22, 22, 15, ['#ffffff', '#ffe46a', '#ff9a1a']);
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = '#a85a0a';
      c.stroke();
    },
    frost: function(c) {
      c.strokeStyle = '#ffffff';
      c.lineCap = 'round';
      c.lineWidth = 3.5;
      for (let i = 0; i < 3; ++i) {
        const a = i * Math.PI / 3;
        c.beginPath();
        c.moveTo(22 - Math.cos(a) * 15, 22 - Math.sin(a) * 15);
        c.lineTo(22 + Math.cos(a) * 15, 22 + Math.sin(a) * 15);
        c.stroke();
      }
      c.lineWidth = 2;
      for (let i = 0; i < 6; ++i) {
        const a = i * Math.PI / 3;
        const x = 22 + Math.cos(a) * 9, y = 22 + Math.sin(a) * 9;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a + 0.8) * 5, y + Math.sin(a + 0.8) * 5);
        c.moveTo(x, y);
        c.lineTo(x + Math.cos(a - 0.8) * 5, y + Math.sin(a - 0.8) * 5);
        c.stroke();
      }
      c.strokeStyle = '#5ab8ff';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(22, 22, 4, 0, TWO_PI);
      c.stroke();
    },
    bloom: function(c) {
      c.beginPath();
      c.ellipse(22, 23, 11, 15, 0, 0, TWO_PI);
      c.fillStyle = radial(c, 22, 23, 16, ['#ffffff', '#ffb0d8', '#e85aa0']);
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = '#8a2a5a';
      c.stroke();
      c.save();
      c.clip();
      c.strokeStyle = '#7ad8ff';
      c.lineWidth = 3;
      c.beginPath();
      for (let x = 8; x < 38; x += 6)
        c.lineTo(x, 20 + ((x / 6) % 2 ? 3 : -3));
      c.stroke();
      c.fillStyle = '#ffe46a';
      c.fillRect(10, 27, 24, 3);
      c.restore();
    },
    sun: function(c) {
      c.beginPath();
      c.moveTo(22, 34);
      for (let i = 0; i <= 6; ++i) {
        const a = Math.PI + i * Math.PI / 6;
        c.lineTo(22 + Math.cos(a) * 16, 30 + Math.sin(a) * 20);
      }
      c.closePath();
      c.fillStyle = radial(c, 22, 22, 20, ['#ffffff', '#ffd8b0', '#e89a6a']);
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = '#8a4a2a';
      c.stroke();
      c.strokeStyle = 'rgba(138,74,42,0.7)';
      c.lineWidth = 1.5;
      for (let i = 1; i < 6; ++i) {
        const a = Math.PI + i * Math.PI / 6;
        c.beginPath();
        c.moveTo(22, 34);
        c.lineTo(22 + Math.cos(a) * 14, 30 + Math.sin(a) * 17);
        c.stroke();
      }
    },
    harvest: function(c) {
      c.beginPath();
      c.ellipse(22, 26, 10, 12, 0, 0, TWO_PI);
      c.fillStyle = radial(c, 22, 26, 13, ['#fff0a0', '#e8a03a', '#a8641a']);
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = '#5a3206';
      c.stroke();
      c.beginPath();
      c.ellipse(22, 15, 13, 6, 0, Math.PI, TWO_PI);
      c.lineTo(35, 17);
      c.lineTo(9, 17);
      c.closePath();
      c.fillStyle = '#8a5a2a';
      c.fill();
      c.stroke();
      c.fillRect(21, 5, 3, 5);
    },
    spooky: function(c) {
      c.beginPath();
      c.moveTo(22, 40);
      c.lineTo(9, 8);
      c.quadraticCurveTo(22, 2, 35, 8);
      c.closePath();
      c.fillStyle = '#ffffff';
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = '#ff8a1e';
      c.fillRect(0, 16, 44, 14);
      c.fillStyle = '#ffd84a';
      c.fillRect(0, 30, 44, 14);
      c.restore();
      c.lineWidth = 2;
      c.strokeStyle = '#7a3a06';
      c.beginPath();
      c.moveTo(22, 40);
      c.lineTo(9, 8);
      c.quadraticCurveTo(22, 2, 35, 8);
      c.closePath();
      c.stroke();
    }
  };

  function getToken(id) {
    return cached('tok-' + id, 44, 44, function(c) {
      const g = c.createRadialGradient(22, 22, 4, 22, 22, 22);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 44, 44);
      (TOKEN[id] || TOKEN.harvest)(c);
    });
  }

  function drawToken(ctx, id, x, y, t) {
    const bob = Math.sin(t * 3 + x * 0.01) * 5;
    const s = 1 + 0.08 * Math.sin(t * 6);
    ctx.drawImage(getToken(id), x - 22 * s, y - 22 * s + bob, 44 * s, 44 * s);
  }

  /* ── ground decor, 120 x 110 px, bottom centre on the ground line ── */
  const DECOR = {
    frost: function(c) {
      for (const b of [[60, 86, 24], [60, 52, 18], [60, 26, 13]]) {
        c.beginPath();
        c.arc(b[0], b[1], b[2], 0, TWO_PI);
        c.fillStyle = radial(c, b[0], b[1], b[2], ['#ffffff', '#e8f4ff', '#b8d0e8']);
        c.fill();
        c.lineWidth = 2;
        c.strokeStyle = '#7a98b8';
        c.stroke();
      }
      c.fillStyle = '#1a1a1a';
      c.fillRect(54, 22, 3, 3);
      c.fillRect(63, 22, 3, 3);
      c.beginPath();
      c.moveTo(60, 28);
      c.lineTo(44, 31);
      c.lineTo(60, 31);
      c.fillStyle = '#ff8a1e';
      c.fill();
      c.fillStyle = '#c83a2a';
      c.fillRect(46, 36, 30, 6);
      c.fillRect(66, 36, 6, 18);
      c.fillStyle = '#1a1a22';
      c.fillRect(48, 6, 24, 8);
      c.fillRect(44, 12, 32, 3);
    },
    newyear: function(c) {
      c.fillStyle = '#c83a2a';
      c.fillRect(54, 40, 12, 60);
      c.beginPath();
      c.moveTo(52, 40);
      c.lineTo(60, 18);
      c.lineTo(68, 40);
      c.closePath();
      c.fillStyle = '#ffd84a';
      c.fill();
      c.fillStyle = '#ffffff';
      c.fillRect(54, 60, 12, 4);
      c.fillRect(54, 76, 12, 4);
      c.strokeStyle = '#7a5a2a';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(60, 100);
      c.lineTo(60, 110);
      c.stroke();
    },
    bloom: function(c) {
      c.beginPath();
      c.moveTo(24, 70);
      c.lineTo(96, 70);
      c.lineTo(88, 108);
      c.lineTo(32, 108);
      c.closePath();
      c.fillStyle = '#c8904a';
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = '#6a4a1a';
      c.stroke();
      c.beginPath();
      c.arc(60, 70, 36, Math.PI, TWO_PI);
      c.stroke();
      const eggs = [[40, 64, '#ff9ad0'], [58, 58, '#7ad8ff'], [76, 64, '#ffe46a'], [50, 70, '#8aff9a'], [68, 70, '#c08aff']];
      for (const e of eggs) {
        c.beginPath();
        c.ellipse(e[0], e[1], 8, 11, 0, 0, TWO_PI);
        c.fillStyle = e[2];
        c.fill();
        c.lineWidth = 1.2;
        c.strokeStyle = 'rgba(0,0,0,0.35)';
        c.stroke();
      }
    },
    sun: function(c) {
      c.strokeStyle = '#8a6a4a';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(60, 30);
      c.lineTo(66, 110);
      c.stroke();
      c.beginPath();
      c.moveTo(4, 40);
      c.quadraticCurveTo(60, -6, 116, 40);
      c.closePath();
      c.fillStyle = '#ff5a5a';
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = '#ffffff';
      for (let i = 0; i < 3; ++i) {
        c.beginPath();
        c.moveTo(60, 14);
        c.lineTo(12 + i * 38, 44);
        c.lineTo(30 + i * 38, 44);
        c.closePath();
        c.fill();
      }
      c.restore();
      c.beginPath();
      c.arc(30, 96, 13, 0, TWO_PI);
      c.fillStyle = '#4ad8ff';
      c.fill();
      c.fillStyle = '#ffe46a';
      c.beginPath();
      c.arc(30, 96, 13, -0.6, 0.6);
      c.lineTo(30, 96);
      c.fill();
    },
    harvest: function(c) {
      c.fillStyle = '#e8c060';
      c.fillRect(14, 62, 92, 46);
      c.strokeStyle = '#a07a2a';
      c.lineWidth = 2;
      c.strokeRect(14, 62, 92, 46);
      for (let y = 70; y < 106; y += 8) {
        c.beginPath();
        c.moveTo(16, y);
        c.lineTo(104, y + 2);
        c.stroke();
      }
      c.beginPath();
      c.arc(84, 52, 16, 0, TWO_PI);
      c.fillStyle = radial(c, 84, 52, 16, ['#ffb060', '#e86a1a', '#a8400a']);
      c.fill();
      c.strokeStyle = '#6a2a06';
      c.stroke();
      c.fillStyle = '#4a7a2a';
      c.fillRect(82, 32, 4, 7);
    },
    spooky: function(c) {
      c.beginPath();
      c.ellipse(60, 84, 34, 26, 0, 0, TWO_PI);
      c.fillStyle = radial(c, 60, 84, 34, ['#ffb060', '#ff7a1a', '#b8400a']);
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = '#6a2a06';
      c.stroke();
      c.beginPath();
      c.moveTo(48, 60);
      c.quadraticCurveTo(46, 84, 48, 108);
      c.moveTo(72, 60);
      c.quadraticCurveTo(74, 84, 72, 108);
      c.stroke();
      c.fillStyle = '#4a6a2a';
      c.fillRect(57, 52, 6, 10);
      c.fillStyle = '#ffe46a';
      c.beginPath();
      c.moveTo(44, 76);
      c.lineTo(52, 68);
      c.lineTo(56, 78);
      c.closePath();
      c.moveTo(76, 76);
      c.lineTo(68, 68);
      c.lineTo(64, 78);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(42, 90);
      c.lineTo(50, 96);
      c.lineTo(56, 90);
      c.lineTo(62, 98);
      c.lineTo(68, 90);
      c.lineTo(74, 96);
      c.lineTo(80, 88);
      c.lineTo(72, 102);
      c.lineTo(48, 102);
      c.closePath();
      c.fill();
    }
  };

  function getDecor(id) {
    return cached('dec-' + id, 120, 110, DECOR[id] || DECOR.harvest);
  }

  /* decor rolls by with the ground, one every 700 px of course */
  function drawDecor(ctx, id, dist, view, groundY) {
    const img = getDecor(id);
    const period = 1100;
    let x = -(dist % period) + 520;
    while (x - 60 > view.x0)
      x -= period;
    for (; x - 60 < view.x1; x += period)
      ctx.drawImage(img, x - 60, groundY - 104, 120, 110);
  }

  /* ── pipe toppers: a strip that sits on a cap edge, 96 x 22 px ── */
  const TOPPER = {
    frost: function(c) {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(2, 22);
      c.quadraticCurveTo(8, 4, 24, 10);
      c.quadraticCurveTo(40, 0, 56, 8);
      c.quadraticCurveTo(76, 2, 94, 22);
      c.closePath();
      c.fill();
      c.strokeStyle = '#a8c8e8';
      c.lineWidth = 1.5;
      c.stroke();
    },
    bloom: function(c) {
      for (let i = 0; i < 6; ++i) {
        const x = 10 + i * 15, y = 14 + (i % 2) * 3;
        c.fillStyle = i % 2 ? '#ffb0d8' : '#ffffff';
        for (let k = 0; k < 5; ++k) {
          const a = k * TWO_PI / 5;
          c.beginPath();
          c.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.2, 0, TWO_PI);
          c.fill();
        }
        c.fillStyle = '#ffcf3a';
        c.beginPath();
        c.arc(x, y, 2.2, 0, TWO_PI);
        c.fill();
      }
    },
    spooky: function(c) {
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.beginPath();
      c.moveTo(4, 2);
      for (let x = 4; x <= 92; x += 8)
        c.lineTo(x, 2 + ((x / 8) % 2 ? 12 : 4));
      c.lineTo(92, 2);
      c.closePath();
      c.fill();
    },
    newyear: function(c) {
      const colors = ['#ff4a4a', '#ffd84a', '#4ad8ff', '#7aff8a', '#ff4ad8'];
      c.strokeStyle = '#3a3a4a';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(2, 6);
      c.quadraticCurveTo(48, 18, 94, 6);
      c.stroke();
      for (let i = 0; i < 7; ++i) {
        const x = 8 + i * 13, y = 6 + Math.sin(i / 6 * Math.PI) * 9;
        c.fillStyle = colors[i % colors.length];
        c.beginPath();
        c.ellipse(x, y + 4, 3, 4.5, 0, 0, TWO_PI);
        c.fill();
      }
    }
  };

  function getTopper(id) {
    if (!TOPPER[id])
      return null;
    return cached('top-' + id, 96, 22, TOPPER[id]);
  }

  /* sits on the upper edge of the lower pipe's cap */
  function drawTopper(ctx, id, x, capTopY) {
    const img = getTopper(id);
    if (img)
      ctx.drawImage(img, x - 12, capTopY - 14);
  }

  /* a big moon for the autumn nights */
  function getMoon(id) {
    return cached('moon-' + id, 220, 220, function(c) {
      const g = c.createRadialGradient(110, 110, 30, 110, 110, 110);
      g.addColorStop(0, id === 'spooky' ? 'rgba(255,240,200,0.5)' : 'rgba(255,220,150,0.45)');
      g.addColorStop(1, 'rgba(255,220,150,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 220, 220);
      c.beginPath();
      c.arc(110, 110, 52, 0, TWO_PI);
      c.fillStyle = radial(c, 110, 110, 52, id === 'spooky' ? ['#fffbe8', '#f4e0a0'] : ['#fff2d0', '#f0b860']);
      c.fill();
      c.fillStyle = 'rgba(160,120,60,0.25)';
      for (const m of [[96, 96, 10], [124, 120, 8], [104, 130, 6], [126, 92, 5]]) {
        c.beginPath();
        c.arc(m[0], m[1], m[2], 0, TWO_PI);
        c.fill();
      }
    });
  }

  function drawSkyExtra(ctx, id, view, t) {
    if (id === 'spooky') {
      ctx.drawImage(getMoon(id), 170, 30 + Math.sin(t * 0.2) * 4);
    }
  }

  SZ.FlappySeasonArt = Object.freeze({ getToken, drawToken, getDecor, drawDecor, getTopper, drawTopper, getMoon, drawSkyExtra });
})();
