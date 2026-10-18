/* Space Farming - pooled particle system (burst/trail/sparkle/confetti) for world effects,
   and the screen shake.
   Reads: G.lowQuality */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI } = NS;

  /* ── Effects ── */
  /* Pooled particle system with the shared burst/trail/sparkle/confetti API;
     the pool has a hard cap, so big bursts never pile up */
  class FarmParticles {
    constructor(cap) {
      this.cap = cap;
      this.list = [];
      this.free = [];
      this.last = 0;
    }

    get count() { return this.list.length; }

    add(x, y, o) {
      if (this.list.length >= this.cap * (G.lowQuality ? 0.5 : 1))
        return;
      const p = this.free.pop() || {};
      p.x = x; p.y = y;
      p.vx = o.vx; p.vy = o.vy;
      p.life = o.life; p.decay = o.decay;
      p.size = o.size; p.shrink = o.shrink;
      p.color = o.color; p.gravity = o.gravity || 0; p.friction = o.friction || 1;
      p.shape = o.shape || 'circle';
      p.rot = Math.random() * TWO_PI;
      p.spin = o.spin !== undefined ? o.spin : (Math.random() - 0.5) * 0.2;
      this.list.push(p);
    }

    burst(x, y, count, opts = {}) {
      for (let i = 0; i < count; ++i) {
        const speed = opts.speed ?? 4, angle = Math.random() * TWO_PI, v = Math.random() * speed;
        this.add(x, y, { vx: Math.cos(angle) * v + (opts.vx ?? 0), vy: Math.sin(angle) * v + (opts.vy ?? 0), life: opts.life ?? (0.6 + Math.random() * 0.4),
          decay: opts.decay ?? 0.02, size: opts.size ?? (2 + Math.random() * 3), shrink: opts.shrink ?? 0.97, color: opts.color ?? '#fff', gravity: opts.gravity, friction: opts.friction, shape: opts.shape });
      }
    }

    trail(x, y, opts = {}) {
      this.add(x, y, { vx: (opts.vx ?? 0) + (Math.random() - 0.5) * 0.5, vy: (opts.vy ?? 0) + (Math.random() - 0.5) * 0.5, life: opts.life ?? 0.5,
        decay: opts.decay ?? 0.03, size: opts.size ?? 2, shrink: opts.shrink ?? 0.95, color: opts.color ?? '#ff0', gravity: opts.gravity, shape: opts.shape });
    }

    sparkle(x, y, count, opts = {}) {
      for (let i = 0; i < count; ++i) {
        const angle = Math.random() * TWO_PI, v = Math.random() * (opts.speed ?? 2);
        this.add(x, y, { vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 0.3 + Math.random() * 0.5, decay: 0.04,
          size: 1 + Math.random() * 2, shrink: 0.98, color: opts.color ?? '#fff', shape: opts.shape ?? 'star' });
      }
    }

    confetti(x, y, count, opts = {}) {
      const colors = opts.colors ?? ['#f44', '#4f4', '#44f', '#ff4', '#f4f', '#4ff'];
      for (let i = 0; i < count; ++i) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8, v = 2 + Math.random() * (opts.speed ?? 5);
        this.add(x, y, { vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, life: 1, decay: 0.01, size: 3 + Math.random() * 3, shrink: 0.99,
          color: colors[Math.floor(Math.random() * colors.length)], gravity: opts.gravity ?? 0.1, friction: 0.99, shape: 'square', spin: (Math.random() - 0.5) * 0.3 });
      }
    }

    update() {
      // steps are measured in 60 Hz frames, like the shared effects
      const now = performance.now();
      const f = this.last ? Math.min(3, (now - this.last) / (1000 / 60)) : 1;
      this.last = now;
      const list = this.list;
      let j = 0;
      for (let i = 0; i < list.length; ++i) {
        const p = list[i];
        p.vy += p.gravity * f;
        if (p.friction !== 1) {
          const fr = Math.pow(p.friction, f);
          p.vx *= fr;
          p.vy *= fr;
        }
        p.x += p.vx * f;
        p.y += p.vy * f;
        p.life -= p.decay * f;
        p.size *= Math.pow(p.shrink, f);
        p.rot += p.spin * f;
        if (p.life <= 0 || p.size < 0.3)
          this.free.push(p);
        else
          list[j++] = p;
      }
      list.length = j;
    }

    draw(c) {
      const base = c.getTransform();
      const a0 = c.globalAlpha;
      for (const p of this.list) {
        c.globalAlpha = a0 * Math.min(1, p.life);
        c.fillStyle = p.color;
        const s = p.size;
        if (p.shape === 'square') {
          const co = Math.cos(p.rot), si = Math.sin(p.rot);
          c.setTransform(base.a * co + base.c * si, base.b * co + base.d * si, base.c * co - base.a * si, base.d * co - base.b * si,
            base.a * p.x + base.c * p.y + base.e, base.b * p.x + base.d * p.y + base.f);
          c.fillRect(-s / 2, -s / 2, s, s);
        } else if (p.shape === 'star') {
          c.setTransform(base);
          c.beginPath();
          for (let i = 0; i < 5; ++i) {
            const a = p.rot + (i * 4 * Math.PI) / 5 - Math.PI / 2;
            if (i) c.lineTo(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s);
            else c.moveTo(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s);
          }
          c.closePath();
          c.fill();
        } else if (s < 2.2) {
          c.setTransform(base);
          c.fillRect(p.x - s, p.y - s, s * 2, s * 2);
        } else {
          c.setTransform(base);
          c.beginPath();
          c.arc(p.x, p.y, s, 0, TWO_PI);
          c.fill();
        }
      }
      c.setTransform(base);
      c.globalAlpha = a0;
    }

    clear() {
      this.free.push(...this.list);
      this.list.length = 0;
    }
  }

  const particles = new FarmParticles(700);
  const screenShake = new SZ.GameEffects.ScreenShake();

  Object.assign(NS, { FarmParticles, particles, screenShake });

})();
