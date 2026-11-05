;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Story scenery for the cinematics and the title: the dawn and storm skies above a sea of
   * clouds, the Sky Tree on its floating island (in leaf and in blossom), and the six glowing
   * Season Feathers. Everything is painted once into cached canvases; a cinematic frame is
   * a few drawImage calls plus its actors.
   */

  const TWO_PI = Math.PI * 2;
  const W = 1280, H = 720;
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

  function rng(seed) {
    let a = seed >>> 0;
    return function() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function puff(c, x, y, r, top, bot) {
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.5, r * 0.1, x, y, r);
    g.addColorStop(0, top);
    g.addColorStop(1, bot);
    c.fillStyle = g;
    c.beginPath();
    c.arc(x, y, r, 0, TWO_PI);
    c.fill();
  }

  function skyCanvas(storm) {
    return cached(storm ? 'storm' : 'dawn', W, H, function(c) {
      const g = c.createLinearGradient(0, 0, 0, H);
      if (storm) {
        g.addColorStop(0, '#0e0a22');
        g.addColorStop(0.55, '#3a2a5a');
        g.addColorStop(1, '#5a4a7a');
      } else {
        g.addColorStop(0, '#3a6ad8');
        g.addColorStop(0.5, '#9ac8f0');
        g.addColorStop(0.8, '#ffd8b0');
        g.addColorStop(1, '#ffb88a');
      }
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      const r = rng(storm ? 7 : 3);
      if (!storm) {
        const sun = c.createRadialGradient(980, 520, 10, 980, 520, 260);
        sun.addColorStop(0, 'rgba(255,250,220,0.95)');
        sun.addColorStop(0.2, 'rgba(255,230,170,0.6)');
        sun.addColorStop(1, 'rgba(255,200,140,0)');
        c.fillStyle = sun;
        c.fillRect(0, 0, W, H);
      } else {
        for (let i = 0; i < 18; ++i)
          puff(c, r() * W, 40 + r() * 200, 70 + r() * 90, 'rgba(90,70,130,0.7)', 'rgba(30,20,50,0)');
      }
      // the sea of clouds below
      for (let i = 0; i < 40; ++i) {
        const x = (i / 40) * (W + 200) - 100 + r() * 40, y = 600 + r() * 90;
        puff(c, x, y, 60 + r() * 50, storm ? '#6a5a8a' : '#ffffff', storm ? '#2a2040' : '#f0d8e0');
      }
    });
  }

  function drawSky(ctx, storm, view) {
    const img = skyCanvas(storm);
    ctx.drawImage(img, 0, 0);
    if (view) {
      if (view.x0 < 0)
        ctx.drawImage(img, 0, 0, 1, H, view.x0, 0, -view.x0, H);
      if (view.x1 > W)
        ctx.drawImage(img, W - 1, 0, 1, H, W, 0, view.x1 - W, H);
      if (view.y0 < 0)
        ctx.drawImage(img, 0, 0, W, 1, view.x0, view.y0, view.x1 - view.x0, -view.y0);
      if (view.y1 > H)
        ctx.drawImage(img, 0, H - 1, W, 1, view.x0, H, view.x1 - view.x0, view.y1 - H);
    }
  }

  /* the Sky Tree on its floating island: 900 x 760 px, anchor (450, 560) */
  function treeCanvas(bloom) {
    return cached(bloom ? 'tree-bloom' : 'tree', 900, 760, function(c) {
      const r = rng(11);
      // island
      c.beginPath();
      c.moveTo(150, 560);
      c.quadraticCurveTo(450, 520, 750, 560);
      c.quadraticCurveTo(620, 700, 450, 750);
      c.quadraticCurveTo(280, 700, 150, 560);
      const rock = c.createLinearGradient(0, 540, 0, 750);
      rock.addColorStop(0, '#8a6a4a');
      rock.addColorStop(1, '#3a2a22');
      c.fillStyle = rock;
      c.fill();
      c.fillStyle = '#5ab83c';
      c.beginPath();
      c.ellipse(450, 556, 304, 26, 0, 0, TWO_PI);
      c.fill();
      // roots and trunk
      c.fillStyle = '#6a4426';
      c.beginPath();
      c.moveTo(390, 560);
      c.quadraticCurveTo(420, 420, 400, 300);
      c.lineTo(500, 300);
      c.quadraticCurveTo(480, 420, 510, 560);
      c.closePath();
      c.fill();
      c.strokeStyle = '#3a2614';
      c.lineWidth = 4;
      c.stroke();
      c.strokeStyle = 'rgba(40,24,12,0.5)';
      c.lineWidth = 3;
      for (let i = 0; i < 5; ++i) {
        c.beginPath();
        c.moveTo(415 + i * 16, 540);
        c.quadraticCurveTo(425 + i * 12, 420, 418 + i * 14, 320);
        c.stroke();
      }
      // branches
      c.strokeStyle = '#6a4426';
      c.lineCap = 'round';
      const branches = [[440, 330, 250, 230, 22], [460, 330, 660, 220, 22], [450, 310, 380, 150, 18], [455, 310, 560, 140, 18], [430, 360, 220, 360, 14], [470, 360, 700, 350, 14]];
      for (const b of branches) {
        c.lineWidth = b[4];
        c.beginPath();
        c.moveTo(b[0], b[1]);
        c.quadraticCurveTo((b[0] + b[2]) / 2, b[3] + 40, b[2], b[3]);
        c.stroke();
      }
      // canopy: clustered leaf puffs
      const puffs = [];
      for (let i = 0; i < 46; ++i) {
        const a = r() * TWO_PI, d = Math.sqrt(r());
        puffs.push([450 + Math.cos(a) * 330 * d, 210 + Math.sin(a) * 170 * d, 50 + r() * 40]);
      }
      puffs.sort((p, q) => p[1] - q[1]);
      for (const p of puffs)
        puff(c, p[0], p[1], p[2], bloom ? '#ffd0e8' : '#8ae06a', bloom ? '#e86aa8' : '#2a8a3a');
      // highlights and fruit/blossoms
      for (let i = 0; i < 60; ++i) {
        const a = r() * TWO_PI, d = Math.sqrt(r());
        const x = 450 + Math.cos(a) * 320 * d, y = 210 + Math.sin(a) * 160 * d;
        c.fillStyle = bloom ? (i % 2 ? '#ffffff' : '#ffe46a') : (i % 3 ? 'rgba(200,255,160,0.6)' : '#ffd84a');
        c.beginPath();
        c.arc(x, y, bloom ? 6 : 4, 0, TWO_PI);
        c.fill();
      }
    });
  }

  function drawTree(ctx, x, y, scale, opts) {
    opts = opts || {};
    const img = treeCanvas(!!opts.bloom);
    const s = scale || 1;
    ctx.save();
    if (opts.alpha !== undefined)
      ctx.globalAlpha *= opts.alpha;
    ctx.drawImage(img, x - 450 * s, y - 560 * s, 900 * s, 760 * s);
    ctx.restore();
  }

  /* a Season Feather: 110 x 110 px with its round glow, the quill at the bottom */
  function featherCanvas(color) {
    return cached('feather-' + color, 110, 110, function(c) {
      const g = c.createRadialGradient(55, 55, 4, 55, 55, 55);
      g.addColorStop(0, 'rgba(255,255,255,0.7)');
      g.addColorStop(0.35, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.45;
      c.fillStyle = g;
      c.fillRect(0, 0, 110, 110);
      c.globalAlpha = 1;
      c.translate(25, 0);
      c.beginPath();
      c.moveTo(30, 100);
      c.quadraticCurveTo(6, 60, 26, 10);
      c.quadraticCurveTo(46, 40, 30, 100);
      const f = c.createLinearGradient(10, 0, 50, 0);
      f.addColorStop(0, '#ffffff');
      f.addColorStop(0.5, color);
      f.addColorStop(1, color);
      c.fillStyle = f;
      c.fill();
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.stroke();
      c.beginPath();
      c.moveTo(30, 104);
      c.quadraticCurveTo(28, 60, 26, 14);
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.lineWidth = 1.6;
      c.stroke();
    });
  }

  function drawFeather(ctx, color, x, y, scale, rot) {
    const img = featherCanvas(color);
    const s = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.drawImage(img, -55 * s, -55 * s, 110 * s, 110 * s);
    ctx.restore();
  }

  SZ.FlappyStoryArt = Object.freeze({ drawSky, drawTree, drawFeather, treeCanvas, skyCanvas });
})();
