;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Juice for the Cooking Game: a pooled sprite particle system and pop-in
   * floating texts. Every particle is a blit of a small cached sprite (soft
   * glows, sparks, stars, smoke puffs, hearts, coins, confetti, food chips)
   * painted once on first use; glowing kinds are drawn in one additive batch.
   * No gradients and no shadow blur per frame, at most MAX_PARTICLES alive.
   *
   * Usage: const fx = SZ.KitchenFX.create();
   *        fx.emit('spark', x, y, 6, { color: '#ffb03a', speed: 120 });
   *        fx.text(x, y, '+$12', { color: '#ffd23f', size: 24 });
   *        fx.update(dt); fx.draw(ctx); fx.drawTexts(ctx);
   */

  const TWO_PI = Math.PI * 2;
  const MAX_PARTICLES = 400;
  const MAX_TEXTS = 24;
  const SPRITE = 48;
  const FONT = "'Segoe UI', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";

  function hexToRgb(hex) {
    let h = String(hex || '').trim();
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    const n = parseInt(h, 16);
    if (h.length !== 6 || isNaN(n)) return { r: 255, g: 255, b: 255 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, a) {
    const c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }

  function makeCanvas(w, h) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    return cv;
  }

  /* ── sprite painters: each paints a SPRITE x SPRITE canvas centred ── */

  function paintGlow(c, col) {
    const g = c.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0, rgba(col, 1));
    g.addColorStop(0.25, rgba(col, 0.55));
    g.addColorStop(0.6, rgba(col, 0.14));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, SPRITE, SPRITE);
  }

  function paintSpark(c, col) {
    paintGlow(c, col);
    const g = c.createRadialGradient(24, 24, 0, 24, 24, 7);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.beginPath();
    c.arc(24, 24, 7, 0, TWO_PI);
    c.fill();
  }

  function paintStar(c, col) {
    const g = c.createRadialGradient(24, 24, 0, 24, 24, 22);
    g.addColorStop(0, rgba(col, 0.6));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, SPRITE, SPRITE);
    c.fillStyle = rgba(col, 1);
    c.beginPath();
    c.moveTo(24, 3);
    c.quadraticCurveTo(26.5, 21.5, 45, 24);
    c.quadraticCurveTo(26.5, 26.5, 24, 45);
    c.quadraticCurveTo(21.5, 26.5, 3, 24);
    c.quadraticCurveTo(21.5, 21.5, 24, 3);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath();
    c.arc(24, 24, 4, 0, TWO_PI);
    c.fill();
  }

  function paintPuff(c, col) {
    const blobs = [[24, 26, 15], [16, 22, 10], [32, 21, 11], [24, 16, 10]];
    for (let i = 0; i < blobs.length; ++i) {
      const b = blobs[i];
      const g = c.createRadialGradient(b[0] - 2, b[1] - 3, 1, b[0], b[1], b[2]);
      g.addColorStop(0, rgba(col, 0.55));
      g.addColorStop(0.7, rgba(col, 0.28));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.beginPath();
      c.arc(b[0], b[1], b[2], 0, TWO_PI);
      c.fill();
    }
  }

  function paintHeart(c, col) {
    const g = c.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0, rgba(col, 0.35));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, SPRITE, SPRITE);
    c.beginPath();
    c.moveTo(24, 39);
    c.bezierCurveTo(4, 24, 10, 6, 24, 16);
    c.bezierCurveTo(38, 6, 44, 24, 24, 39);
    c.closePath();
    const hg = c.createLinearGradient(0, 10, 0, 40);
    hg.addColorStop(0, '#ff9ab4');
    hg.addColorStop(0.5, col);
    hg.addColorStop(1, '#b8203f');
    c.fillStyle = hg;
    c.fill();
    c.strokeStyle = 'rgba(90,10,30,0.7)';
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.beginPath();
    c.ellipse(17, 18, 4, 2.6, -0.6, 0, TWO_PI);
    c.fill();
  }

  /* a gold coin seen at one of 6 spin angles: frame -> width factor */
  function paintCoin(c, frame) {
    const k = Math.abs(Math.cos(frame / 6 * Math.PI)) * 0.62 + 0.38;
    const rx = 15 * k, ry = 15;
    c.save();
    c.translate(24, 24);
    c.fillStyle = '#8a5a08';
    c.beginPath();
    c.ellipse(1.5 * k, 1.5, rx, ry, 0, 0, TWO_PI);
    c.fill();
    const g = c.createLinearGradient(-rx, -ry, rx, ry);
    g.addColorStop(0, '#fff6b8');
    g.addColorStop(0.35, '#ffd23f');
    g.addColorStop(0.75, '#e8a21a');
    g.addColorStop(1, '#b8780a');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, rx, ry, 0, 0, TWO_PI);
    c.fill();
    c.strokeStyle = '#9a6408';
    c.lineWidth = 1.6;
    c.stroke();
    if (k > 0.4) {
      c.strokeStyle = 'rgba(154,100,8,0.7)';
      c.lineWidth = 1.4;
      c.beginPath();
      c.ellipse(0, 0, rx * 0.72, ry * 0.72, 0, 0, TWO_PI);
      c.stroke();
      c.fillStyle = 'rgba(154,100,8,0.85)';
      c.font = 'bold ' + Math.round(15) + 'px ' + FONT;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.save();
      c.scale(k, 1);
      c.fillText('$', 0, 1);
      c.restore();
    }
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.beginPath();
    c.ellipse(-rx * 0.4, -ry * 0.45, rx * 0.28, ry * 0.18, -0.5, 0, TWO_PI);
    c.fill();
    c.restore();
  }

  function paintSquare(c, col) {
    c.fillStyle = col;
    c.fillRect(14, 18, 20, 12);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(14, 18, 20, 4);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(14, 27, 20, 3);
  }

  function paintChip(c, col) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(14, 20);
    c.lineTo(30, 15);
    c.lineTo(35, 27);
    c.lineTo(19, 33);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(40,20,10,0.55)';
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.fillRect(18, 19, 9, 3);
  }

  function paintDrop(c, col) {
    c.beginPath();
    c.moveTo(24, 8);
    c.quadraticCurveTo(36, 26, 24, 38);
    c.quadraticCurveTo(12, 26, 24, 8);
    c.fillStyle = col;
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath();
    c.ellipse(21, 27, 2.5, 4, 0, 0, TWO_PI);
    c.fill();
  }

  function paintFlame(c, col) {
    const g = c.createRadialGradient(24, 30, 1, 24, 28, 20);
    g.addColorStop(0, 'rgba(255,250,210,1)');
    g.addColorStop(0.35, rgba(col, 0.95));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(24, 4);
    c.quadraticCurveTo(38, 24, 34, 36);
    c.quadraticCurveTo(24, 46, 14, 36);
    c.quadraticCurveTo(10, 24, 24, 4);
    c.fill();
  }

  const PAINTERS = {
    glow: paintGlow, spark: paintSpark, star: paintStar, puff: paintPuff, heart: paintHeart,
    square: paintSquare, chip: paintChip, drop: paintDrop, flame: paintFlame
  };

  /* particle kinds: sprite, additive, default life/size/motion */
  const KINDS = {
    spark: { sprite: 'spark', add: true, life: 0.55, size: [10, 18], speed: 140, gravity: 260, drag: 1.2, shrink: 0.2 },
    ember: { sprite: 'spark', add: true, life: 0.9, size: [8, 14], speed: 40, gravity: -90, drag: 1.5, shrink: 0.1 },
    glow: { sprite: 'glow', add: true, life: 0.5, size: [40, 70], speed: 0, gravity: 0, drag: 0, shrink: 1.4 },
    star: { sprite: 'star', add: true, life: 0.8, size: [14, 26], speed: 120, gravity: 60, drag: 2.2, shrink: 0.1, spin: 4 },
    smoke: { sprite: 'puff', add: false, life: 1.4, size: [22, 34], speed: 18, gravity: -50, drag: 0.8, shrink: 2.4, alpha: 0.75 },
    steam: { sprite: 'puff', add: false, life: 1.2, size: [18, 26], speed: 10, gravity: -60, drag: 0.6, shrink: 2.2, alpha: 0.5 },
    heart: { sprite: 'heart', add: false, life: 1.1, size: [18, 28], speed: 50, gravity: -70, drag: 1.4, shrink: 0.6 },
    confetti: { sprite: 'square', add: false, life: 1.8, size: [10, 16], speed: 300, gravity: 420, drag: 1.6, shrink: 1, spin: 9, flutter: true },
    chip: { sprite: 'chip', add: false, life: 0.7, size: [9, 14], speed: 120, gravity: 520, drag: 0.6, shrink: 0.8, spin: 12 },
    crumb: { sprite: 'chip', add: false, life: 0.6, size: [5, 8], speed: 40, gravity: 300, drag: 0.5, shrink: 0.8, spin: 8 },
    drop: { sprite: 'drop', add: false, life: 0.8, size: [10, 16], speed: 70, gravity: 380, drag: 0.4, shrink: 0.9 },
    flame: { sprite: 'flame', add: true, life: 0.45, size: [18, 30], speed: 20, gravity: -160, drag: 1, shrink: 0.2 },
    coin: { sprite: 'coin', add: false, life: 1.0, size: [16, 22], speed: 200, gravity: 600, drag: 0.6, shrink: 1 }
  };

  const CONFETTI = ['#ff5a6a', '#ffd23f', '#5ad27a', '#4ab8ff', '#ff8ad8', '#ffa040'];

  function create() {
    const sprites = {};
    const coinFrames = [];
    const parts = [];
    const texts = [];

    function sprite(name, color) {
      const key = name + '|' + (color || '');
      let s = sprites[key];
      if (s !== undefined) return s;
      const cv = makeCanvas(SPRITE, SPRITE);
      if (cv) {
        const c = cv.getContext('2d');
        (PAINTERS[name] || paintGlow)(c, color || '#ffffff');
      }
      sprites[key] = cv;
      return cv;
    }

    function coinFrame(i) {
      if (!coinFrames.length) {
        for (let f = 0; f < 6; ++f) {
          const cv = makeCanvas(SPRITE, SPRITE);
          if (cv) paintCoin(cv.getContext('2d'), f);
          coinFrames.push(cv);
        }
      }
      return coinFrames[((i % 6) + 6) % 6];
    }

    function rnd(a, b) { return a + Math.random() * (b - a); }

    /* emit n particles of kind at (x, y). opts: color, colors, speed, angle,
       spread, vx, vy, life, size, gravity, drag, alpha, scale */
    function emit(kind, x, y, n, opts) {
      const k = KINDS[kind] || KINDS.spark;
      opts = opts || {};
      for (let i = 0; i < (n || 1); ++i) {
        if (parts.length >= MAX_PARTICLES) parts.shift();
        const sp = opts.speed !== undefined ? opts.speed : k.speed;
        const ang = opts.angle !== undefined ? opts.angle + (Math.random() - 0.5) * (opts.spread !== undefined ? opts.spread : TWO_PI)
          : Math.random() * TWO_PI;
        const v = sp * (0.35 + Math.random() * 0.65);
        const col = opts.colors ? opts.colors[(Math.random() * opts.colors.length) | 0]
          : kind === 'confetti' && !opts.color ? CONFETTI[(Math.random() * CONFETTI.length) | 0]
          : (opts.color || '#ffffff');
        const size = (opts.size || rnd(k.size[0], k.size[1])) * (opts.scale || 1);
        const life = (opts.life || k.life) * (0.75 + Math.random() * 0.5);
        parts.push({
          img: kind === 'coin' ? null : sprite(k.sprite, col),
          coin: kind === 'coin',
          add: k.add,
          x: x + (opts.jitter ? (Math.random() - 0.5) * opts.jitter : 0),
          y: y + (opts.jitterY ? (Math.random() - 0.5) * opts.jitterY : 0),
          vx: Math.cos(ang) * v + (opts.vx || 0),
          vy: Math.sin(ang) * v + (opts.vy || 0),
          g: opts.gravity !== undefined ? opts.gravity : k.gravity,
          drag: opts.drag !== undefined ? opts.drag : k.drag,
          t: 0, life: life,
          s0: size, s1: size * (opts.shrink !== undefined ? opts.shrink : k.shrink),
          a: opts.alpha !== undefined ? opts.alpha : (k.alpha || 1),
          rot: Math.random() * TWO_PI,
          vr: (k.spin || 0) * (Math.random() - 0.5) * 2,
          flutter: !!k.flutter,
          ph: Math.random() * TWO_PI
        });
      }
    }

    /* a floating text that pops in at 1.5x and settles while it rises.
       opts: color, size, outline, life, rise, weight, delay */
    function text(x, y, str, opts) {
      opts = opts || {};
      if (texts.length >= MAX_TEXTS) texts.shift();
      texts.push({
        x: x, y: y, str: String(str), t: -(opts.delay || 0),
        life: opts.life || 1.1,
        rise: opts.rise !== undefined ? opts.rise : 46,
        size: opts.size || 20,
        color: opts.color || '#ffffff',
        outline: opts.outline || '#2a1408',
        font: 'bold ' + (opts.size || 20) + 'px ' + FONT
      });
    }

    function update(dt) {
      for (let i = parts.length - 1; i >= 0; --i) {
        const p = parts[i];
        p.t += dt;
        if (p.t >= p.life) { parts.splice(i, 1); continue; }
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d;
        p.vy = p.vy * d + p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      for (let i = texts.length - 1; i >= 0; --i) {
        texts[i].t += dt;
        if (texts[i].t >= texts[i].life) texts.splice(i, 1);
      }
    }

    function drawOne(ctx, p) {
      const k = p.t / p.life;
      const size = p.s0 + (p.s1 - p.s0) * k;
      const fade = k < 0.1 ? k / 0.1 : (k > 0.6 ? (1 - k) / 0.4 : 1);
      ctx.globalAlpha = Math.max(0, p.a * fade);
      if (p.coin) {
        const img = coinFrame(Math.floor(p.t * 18 + p.ph * 3));
        if (img) ctx.drawImage(img, p.x - size / 2, p.y - size / 2, size, size);
        return;
      }
      if (!p.img) return;
      if (p.vr) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.flutter) ctx.scale(1, Math.cos(p.t * 9 + p.ph));
        ctx.drawImage(p.img, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        ctx.drawImage(p.img, p.x - size / 2, p.y - size / 2, size, size);
      }
    }

    /* normal particles first, then the glowing ones in one additive batch */
    function draw(ctx) {
      if (!parts.length) return;
      const alpha = ctx.globalAlpha;
      for (let i = 0; i < parts.length; ++i)
        if (!parts[i].add) drawOne(ctx, parts[i]);
      const op = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < parts.length; ++i)
        if (parts[i].add) drawOne(ctx, parts[i]);
      ctx.globalCompositeOperation = op || 'source-over';
      ctx.globalAlpha = alpha;
    }

    function drawTexts(ctx) {
      if (!texts.length) return;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      for (let i = 0; i < texts.length; ++i) {
        const t = texts[i];
        if (t.t < 0) continue;
        const k = t.t / t.life;
        const s = k < 0.12 ? 0.4 + 1.1 * (k / 0.12) : (k < 0.24 ? 1.5 - 0.5 * ((k - 0.12) / 0.12) : 1);
        const ease = 1 - Math.pow(1 - Math.min(1, k * 1.4), 3);
        ctx.globalAlpha = k > 0.72 ? Math.max(0, (1 - k) / 0.28) : 1;
        ctx.save();
        ctx.translate(t.x, t.y - ease * t.rise);
        ctx.scale(s, s);
        ctx.font = t.font;
        ctx.strokeStyle = t.outline;
        ctx.lineWidth = Math.max(3, t.size / 5);
        ctx.strokeText(t.str, 0, 2);
        ctx.strokeText(t.str, 0, 0);
        ctx.fillStyle = t.color;
        ctx.fillText(t.str, 0, 0);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillText(t.str, 0, -t.size * 0.08);
        ctx.fillStyle = t.color;
        ctx.globalAlpha *= 0.85;
        ctx.fillText(t.str, 0, t.size * 0.02);
        ctx.restore();
      }
      ctx.restore();
    }

    function clear() {
      parts.length = 0;
      texts.length = 0;
    }

    return Object.freeze({
      emit, text, update, draw, drawTexts, clear, sprite, coinFrame,
      get count() { return parts.length; },
      get textCount() { return texts.length; }
    });
  }

  SZ.KitchenFX = Object.freeze({ create, MAX_PARTICLES });
})();
