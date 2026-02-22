;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /* ---- Particle ---- */
  class Particle {
    constructor(x, y, opts = {}) {
      this.x = x;
      this.y = y;
      this.vx = opts.vx ?? (Math.random() - 0.5) * 4;
      this.vy = opts.vy ?? (Math.random() - 0.5) * 4;
      this.life = opts.life ?? 1;
      this.decay = opts.decay ?? 0.02;
      this.size = opts.size ?? 3;
      this.shrink = opts.shrink ?? 0.97;
      this.color = opts.color ?? '#fff';
      this.gravity = opts.gravity ?? 0;
      this.friction = opts.friction ?? 1;
      this.shape = opts.shape ?? 'circle';
      this.rotation = opts.rotation ?? Math.random() * Math.PI * 2;
      this.rotationSpeed = opts.rotationSpeed ?? (Math.random() - 0.5) * 0.2;
    }

    update() {
      this.vy += this.gravity;
      this.vx *= this.friction;
      this.vy *= this.friction;
      this.x += this.vx;
      this.y += this.vy;
      this.life -= this.decay;
      this.size *= this.shrink;
      this.rotation += this.rotationSpeed;
    }

    get dead() { return this.life <= 0 || this.size < 0.3; }

    draw(ctx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life);
      ctx.fillStyle = this.color;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      if (this.shape === 'square') {
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
      } else if (this.shape === 'star') {
        _drawStar(ctx, this.size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function _drawStar(ctx, size) {
    ctx.beginPath();
    for (let i = 0; i < 5; ++i) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const method = i === 0 ? 'moveTo' : 'lineTo';
      ctx[method](Math.cos(a) * size, Math.sin(a) * size);
    }
    ctx.closePath();
    ctx.fill();
  }

  /* ---- ParticleSystem ---- */
  class ParticleSystem {
    #particles = [];

    get count() { return this.#particles.length; }

    burst(x, y, count, opts = {}) {
      for (let i = 0; i < count; ++i) {
        const speed = opts.speed ?? 4;
        const angle = Math.random() * Math.PI * 2;
        const v = Math.random() * speed;
        this.#particles.push(new Particle(x, y, {
          ...opts,
          vx: Math.cos(angle) * v + (opts.vx ?? 0),
          vy: Math.sin(angle) * v + (opts.vy ?? 0),
          life: opts.life ?? (0.6 + Math.random() * 0.4),
          size: opts.size ?? (2 + Math.random() * 3)
        }));
      }
    }

    trail(x, y, opts = {}) {
      this.#particles.push(new Particle(x, y, {
        vx: (opts.vx ?? 0) + (Math.random() - 0.5) * 0.5,
        vy: (opts.vy ?? 0) + (Math.random() - 0.5) * 0.5,
        life: opts.life ?? 0.5,
        decay: opts.decay ?? 0.03,
        size: opts.size ?? 2,
        shrink: opts.shrink ?? 0.95,
        color: opts.color ?? '#ff0',
        gravity: opts.gravity ?? 0,
        shape: opts.shape ?? 'circle'
      }));
    }

    sparkle(x, y, count, opts = {}) {
      for (let i = 0; i < count; ++i) {
        const angle = Math.random() * Math.PI * 2;
        const v = Math.random() * (opts.speed ?? 2);
        this.#particles.push(new Particle(x, y, {
          vx: Math.cos(angle) * v,
          vy: Math.sin(angle) * v,
          life: 0.3 + Math.random() * 0.5,
          decay: 0.04,
          size: 1 + Math.random() * 2,
          shrink: 0.98,
          color: opts.color ?? '#fff',
          shape: opts.shape ?? 'star'
        }));
      }
    }

    confetti(x, y, count, opts = {}) {
      const colors = opts.colors ?? ['#f44', '#4f4', '#44f', '#ff4', '#f4f', '#4ff'];
      for (let i = 0; i < count; ++i) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8;
        const v = 2 + Math.random() * (opts.speed ?? 5);
        this.#particles.push(new Particle(x, y, {
          vx: Math.cos(angle) * v,
          vy: Math.sin(angle) * v,
          life: 1,
          decay: 0.01,
          size: 3 + Math.random() * 3,
          shrink: 0.99,
          color: colors[Math.floor(Math.random() * colors.length)],
          gravity: opts.gravity ?? 0.1,
          friction: 0.99,
          shape: 'square',
          rotationSpeed: (Math.random() - 0.5) * 0.3
        }));
      }
    }

    update() {
      for (let i = this.#particles.length - 1; i >= 0; --i) {
        this.#particles[i].update();
        if (this.#particles[i].dead)
          this.#particles.splice(i, 1);
      }
    }

    draw(ctx) {
      for (const p of this.#particles)
        p.draw(ctx);
    }

    clear() { this.#particles.length = 0; }
  }

  /* ---- ScreenShake ---- */
  class ScreenShake {
    #intensity = 0;
    #duration = 0;
    #elapsed = 0;
    #offsetX = 0;
    #offsetY = 0;

    trigger(intensity = 5, duration = 300) {
      this.#intensity = intensity;
      this.#duration = duration;
      this.#elapsed = 0;
    }

    update(dt) {
      if (this.#elapsed >= this.#duration) {
        this.#offsetX = 0;
        this.#offsetY = 0;
        return;
      }
      this.#elapsed += dt;
      const progress = 1 - this.#elapsed / this.#duration;
      const mag = this.#intensity * progress;
      this.#offsetX = (Math.random() - 0.5) * 2 * mag;
      this.#offsetY = (Math.random() - 0.5) * 2 * mag;
    }

    apply(ctx) {
      ctx.translate(this.#offsetX, this.#offsetY);
    }

    get active() { return this.#elapsed < this.#duration; }
  }

  /* ---- FloatingText ---- */
  class FloatingText {
    #texts = [];

    add(x, y, text, opts = {}) {
      this.#texts.push({
        x, y,
        text: String(text),
        life: 1,
        decay: opts.decay ?? 0.02,
        vy: opts.vy ?? -1.5,
        color: opts.color ?? '#fff',
        font: opts.font ?? 'bold 14px sans-serif',
        outline: opts.outline ?? '#000'
      });
    }

    update() {
      for (let i = this.#texts.length - 1; i >= 0; --i) {
        const t = this.#texts[i];
        t.y += t.vy;
        t.life -= t.decay;
        if (t.life <= 0)
          this.#texts.splice(i, 1);
      }
    }

    draw(ctx) {
      for (const t of this.#texts) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, t.life);
        ctx.font = t.font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (t.outline) {
          ctx.strokeStyle = t.outline;
          ctx.lineWidth = 3;
          ctx.strokeText(t.text, t.x, t.y);
        }
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
      }
    }

    clear() { this.#texts.length = 0; }
  }

  /* ---- Glow helper ---- */
  function drawGlow(ctx, drawFn, color, blur) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    drawFn(ctx);
    drawFn(ctx);
    ctx.restore();
  }

  /* ---- Export ---- */
  SZ.GameEffects = { ParticleSystem, ScreenShake, FloatingText, drawGlow };
})();
