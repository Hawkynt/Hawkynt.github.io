;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * A pooled particle system: a fixed array of particle objects that are reused, removal
   * by swapping with the last live one, and every dot, star and square blitted from a
   * small cached sprite per colour - no allocation and no path building per particle
   * per frame. The API matches the shared GameEffects.ParticleSystem (burst, trail,
   * sparkle, confetti, update, draw, clear), plus ring() for expanding shock rings.
   */

  const CAP = 1200;
  const spriteCache = {};

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  /* 32 px sprite per shape and colour; drawn scaled to the particle size */
  function sprite(shape, color) {
    const key = shape + color;
    let cv = spriteCache[key];
    if (cv)
      return cv;
    cv = makeCanvas(32, 32);
    const c = cv.getContext('2d');
    c.fillStyle = color;
    if (shape === 'square') {
      c.fillRect(4, 4, 24, 24);
    } else if (shape === 'star') {
      c.beginPath();
      for (let i = 0; i < 10; ++i) {
        const r = i % 2 === 0 ? 15 : 6;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        if (i === 0)
          c.moveTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r);
        else
          c.lineTo(16 + Math.cos(a) * r, 16 + Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
    } else if (shape === 'glow') {
      const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, color);
      g.addColorStop(0.35, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 32, 32);
    } else if (shape === 'heart') {
      c.beginPath();
      c.moveTo(16, 28);
      c.bezierCurveTo(2, 18, 2, 6, 10, 6);
      c.bezierCurveTo(14, 6, 16, 9, 16, 11);
      c.bezierCurveTo(16, 9, 18, 6, 22, 6);
      c.bezierCurveTo(30, 6, 30, 18, 16, 28);
      c.fill();
    } else if (shape === 'note') {
      c.beginPath();
      c.ellipse(11, 24, 7, 5, -0.4, 0, Math.PI * 2);
      c.fill();
      c.fillRect(16, 4, 3, 21);
      c.beginPath();
      c.moveTo(19, 4);
      c.quadraticCurveTo(28, 8, 26, 16);
      c.quadraticCurveTo(25, 10, 19, 10);
      c.fill();
    } else if (shape === 'ghost') {
      c.beginPath();
      c.arc(16, 13, 10, Math.PI, 0);
      c.lineTo(26, 28);
      c.lineTo(22, 24);
      c.lineTo(18, 28);
      c.lineTo(14, 24);
      c.lineTo(10, 28);
      c.lineTo(6, 24);
      c.closePath();
      c.fill();
      c.fillStyle = '#20202a';
      c.fillRect(11, 11, 3, 4);
      c.fillRect(18, 11, 3, 4);
    } else if (shape === 'petal') {
      c.beginPath();
      c.ellipse(16, 16, 13, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.beginPath();
      c.ellipse(12, 14, 6, 2.5, 0, 0, Math.PI * 2);
      c.fill();
    } else if (shape === 'leaf') {
      c.beginPath();
      c.moveTo(3, 16);
      c.quadraticCurveTo(16, 0, 29, 16);
      c.quadraticCurveTo(16, 32, 3, 16);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(4, 16);
      c.lineTo(28, 16);
      c.stroke();
    } else if (shape === 'flake') {
      c.strokeStyle = color;
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath();
      for (let i = 0; i < 3; ++i) {
        const a = i * Math.PI / 3;
        c.moveTo(16 - Math.cos(a) * 13, 16 - Math.sin(a) * 13);
        c.lineTo(16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13);
      }
      c.stroke();
    } else if (shape === 'bubble') {
      c.strokeStyle = color;
      c.lineWidth = 2.5;
      c.beginPath();
      c.arc(16, 16, 13, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.arc(11, 11, 3.5, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      c.arc(16, 16, 15, 0, Math.PI * 2);
      c.fill();
    }
    spriteCache[key] = cv;
    return cv;
  }

  function ParticlePool() {
    this.items = [];
    for (let i = 0; i < CAP; ++i)
      this.items.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, decay: 0, size: 0, shrink: 1, gravity: 0, friction: 1, rot: 0, vrot: 0, img: null, spin: false, ring: 0 });
    this.n = 0;
  }

  ParticlePool.prototype.spawn = function(x, y, o) {
    if (this.n >= CAP)
      return null;
    const p = this.items[this.n++];
    p.x = x;
    p.y = y;
    p.vx = o.vx || 0;
    p.vy = o.vy || 0;
    p.life = o.life === undefined ? 1 : o.life;
    p.decay = o.decay === undefined ? 0.02 : o.decay;
    p.size = o.size === undefined ? 3 : o.size;
    p.shrink = o.shrink === undefined ? 0.97 : o.shrink;
    p.gravity = o.gravity || 0;
    p.friction = o.friction === undefined ? 1 : o.friction;
    const shape = o.shape || 'circle';
    p.img = sprite(shape, o.color || '#ffffff');
    p.spin = shape === 'square' || shape === 'star' || shape === 'petal' || shape === 'leaf' || shape === 'flake';
    p.rot = Math.random() * Math.PI * 2;
    p.vrot = o.rotationSpeed === undefined ? (Math.random() - 0.5) * 0.2 : o.rotationSpeed;
    p.ring = 0;
    p.color = o.color || '#ffffff';
    return p;
  };

  ParticlePool.prototype.burst = function(x, y, count, opts) {
    opts = opts || {};
    const speed = opts.speed === undefined ? 4 : opts.speed;
    for (let i = 0; i < count; ++i) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * speed;
      this.spawn(x, y, {
        vx: Math.cos(a) * v + (opts.vx || 0), vy: Math.sin(a) * v + (opts.vy || 0),
        life: opts.life === undefined ? 0.6 + Math.random() * 0.4 : opts.life,
        decay: opts.decay, size: opts.size === undefined ? 2 + Math.random() * 3 : opts.size,
        shrink: opts.shrink, color: opts.color, gravity: opts.gravity, friction: opts.friction, shape: opts.shape
      });
    }
  };

  ParticlePool.prototype.trail = function(x, y, opts) {
    opts = opts || {};
    this.spawn(x, y, {
      vx: (opts.vx || 0) + (Math.random() - 0.5) * 0.5, vy: (opts.vy || 0) + (Math.random() - 0.5) * 0.5,
      life: opts.life === undefined ? 0.5 : opts.life, decay: opts.decay === undefined ? 0.03 : opts.decay,
      size: opts.size === undefined ? 2 : opts.size, shrink: opts.shrink === undefined ? 0.95 : opts.shrink,
      color: opts.color || '#ffff00', gravity: opts.gravity, shape: opts.shape, rotationSpeed: opts.rotationSpeed
    });
  };

  ParticlePool.prototype.sparkle = function(x, y, count, opts) {
    opts = opts || {};
    for (let i = 0; i < count; ++i) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * (opts.speed === undefined ? 2 : opts.speed);
      this.spawn(x, y, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.3 + Math.random() * 0.5, decay: 0.04,
        size: (opts.size || 1) + Math.random() * 2, shrink: 0.98, color: opts.color || '#ffffff', shape: opts.shape || 'star'
      });
    }
  };

  ParticlePool.prototype.confetti = function(x, y, count, opts) {
    opts = opts || {};
    const colors = opts.colors || ['#ff4444', '#44ff44', '#4488ff', '#ffff44', '#ff44ff', '#44ffff'];
    for (let i = 0; i < count; ++i) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * (opts.spread || 0.8);
      const v = 2 + Math.random() * (opts.speed === undefined ? 5 : opts.speed);
      this.spawn(x, y, {
        vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: 0.01, size: 3 + Math.random() * 3, shrink: 0.99,
        color: colors[Math.floor(Math.random() * colors.length)], gravity: opts.gravity === undefined ? 0.1 : opts.gravity,
        friction: 0.99, shape: 'square', rotationSpeed: (Math.random() - 0.5) * 0.3
      });
    }
  };

  /* an expanding circle outline: size grows, alpha fades */
  ParticlePool.prototype.ring = function(x, y, color, grow, life) {
    const p = this.spawn(x, y, { life: 1, decay: 1 / (60 * (life || 0.4)), size: 6, shrink: 1, color: color });
    if (p) {
      p.ring = grow || 6;
      p.img = null;
    }
  };

  ParticlePool.prototype.update = function(dt) {
    const f = Math.min(3, (dt === undefined ? 1 / 60 : dt) * 60);
    const items = this.items;
    for (let i = this.n - 1; i >= 0; --i) {
      const p = items[i];
      p.vy += p.gravity * f;
      if (p.friction !== 1) {
        const k = Math.pow(p.friction, f);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * f;
      p.y += p.vy * f;
      p.life -= p.decay * f;
      if (p.ring)
        p.size += p.ring * f;
      else if (p.shrink !== 1)
        p.size *= Math.pow(p.shrink, f);
      p.rot += p.vrot * f;
      if (p.life <= 0 || p.size < 0.3) {
        // swap the dead one with the last live one
        const last = items[this.n - 1];
        items[this.n - 1] = p;
        items[i] = last;
        --this.n;
      }
    }
  };

  ParticlePool.prototype.draw = function(ctx) {
    const items = this.items;
    const base = ctx.globalAlpha;
    for (let i = 0; i < this.n; ++i) {
      const p = items[i];
      const a = p.life > 1 ? 1 : p.life;
      if (a <= 0)
        continue;
      ctx.globalAlpha = base * a;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * a + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.spin) {
        const c = Math.cos(p.rot), s = Math.sin(p.rot);
        ctx.save();
        ctx.transform(c, s, -s, c, p.x, p.y);
        ctx.drawImage(p.img, -p.size, -p.size, p.size * 2, p.size * 2);
        ctx.restore();
      } else {
        ctx.drawImage(p.img, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      }
    }
    ctx.globalAlpha = base;
  };

  ParticlePool.prototype.clear = function() {
    this.n = 0;
  };

  Object.defineProperty(ParticlePool.prototype, 'count', { get: function() { return this.n; } });

  SZ.FlappyParticles = Object.freeze({ ParticlePool: ParticlePool, sprite: sprite, CAP: CAP });
})();
