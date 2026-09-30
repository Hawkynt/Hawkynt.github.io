;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Grid-level combat feedback: popping damage numbers, particles, screen
  // shake and per-unit reactions (hit flash, knockback, dodge, death fade).
  // Positions are screen pixels; the controller passes tile centres.

  const NUMBER_LIFE = 1.1;
  const REACTION_LIFE = 0.35;
  const DEATH_LIFE = 0.9;

  const clamp01 = v => v < 0 ? 0 : (v > 1 ? 1 : v);
  const easeOutBack = t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

  class CombatFx {
    #particles;
    #shake;
    #numbers;
    #reactions;
    #deaths;

    constructor() {
      const GE = SZ.GameEffects;
      this.#particles = GE ? new GE.ParticleSystem() : null;
      this.#shake = GE ? new GE.ScreenShake() : null;
      this.#numbers = [];
      this.#reactions = new Map();
      this.#deaths = new Map();
    }

    get busy() {
      return this.#numbers.length > 0 || this.#reactions.size > 0 || (this.#particles && this.#particles.count > 0);
    }

    get numberCount() { return this.#numbers.length; }

    clear() {
      this.#numbers.length = 0;
      this.#reactions.clear();
      this.#deaths.clear();
      if (this.#particles)
        this.#particles.clear();
    }

    update(dt) {
      if (this.#particles)
        this.#particles.update();
      if (this.#shake)
        this.#shake.update(dt * 1000);
      for (let i = this.#numbers.length - 1; i >= 0; --i) {
        const n = this.#numbers[i];
        n.t += dt;
        if (n.t >= n.life)
          this.#numbers.splice(i, 1);
      }
      for (const [id, r] of this.#reactions) {
        r.t += dt;
        if (r.t >= REACTION_LIFE)
          this.#reactions.delete(id);
      }
      for (const d of this.#deaths.values())
        d.t = Math.min(DEATH_LIFE, d.t + dt);
    }

    // --- events ---

    number(x, y, text, { color = '#fff', size = 22, crit = false } = {}) {
      this.#numbers.push({ x, y, text, color, size: crit ? size * 1.45 : size, crit, t: 0, life: crit ? NUMBER_LIFE * 1.3 : NUMBER_LIFE });
    }

    hit(unitId, x, y, amount, { crit = false, fromX = null, fromY = null, color = null } = {}) {
      this.number(x, y - 8, crit ? `${amount}!` : String(amount), { color: color || (crit ? '#ffd23a' : '#ff5a4a'), crit });
      let kx = 0, ky = 0;
      if (fromX !== null && fromY !== null) {
        const len = Math.hypot(x - fromX, y - fromY) || 1;
        kx = (x - fromX) / len;
        ky = (y - fromY) / len;
      }
      this.#reactions.set(unitId, { kind: 'hit', t: 0, kx, ky, crit });
      if (this.#particles) {
        this.#particles.burst(x, y, crit ? 26 : 12, { speed: crit ? 5 : 3.2, color: crit ? '#ffd23a' : '#ff6a50', decay: 0.035, size: 2 + Math.random() * 2 });
        this.#particles.sparkle(x, y, crit ? 10 : 4, { color: '#fff', speed: 3 });
      }
      if (this.#shake)
        this.#shake.trigger(crit ? 9 : 3, crit ? 380 : 160);
    }

    miss(unitId, x, y) {
      this.number(x, y - 8, 'MISS', { color: '#c8ccd8', size: 16 });
      this.#reactions.set(unitId, { kind: 'dodge', t: 0, kx: 0, ky: 0 });
      if (this.#particles)
        this.#particles.burst(x, y + 6, 5, { speed: 1.5, color: 'rgba(220,220,230,0.8)', decay: 0.05, size: 2 });
    }

    heal(unitId, x, y, amount) {
      this.number(x, y - 8, `+${amount}`, { color: '#5dff9a' });
      this.#reactions.set(unitId, { kind: 'heal', t: 0, kx: 0, ky: 0 });
      if (this.#particles)
        for (let i = 0; i < 14; ++i)
          this.#particles.trail(x + (Math.random() - 0.5) * 24, y + 10 - Math.random() * 10, {
            vy: -0.8 - Math.random() * 1.2, color: i % 3 ? '#7dffb0' : '#ffffff', life: 0.9, decay: 0.02, size: 2, shape: 'star',
          });
    }

    spell(x, y, color) {
      if (!this.#particles)
        return;
      this.#particles.burst(x, y, 18, { speed: 3.5, color, decay: 0.03 });
      this.#particles.sparkle(x, y, 8, { color: '#fff' });
    }

    death(unitId, x, y) {
      this.#deaths.set(unitId, { t: 0 });
      if (this.#particles) {
        this.#particles.burst(x, y, 22, { speed: 2.5, color: '#2a2230', decay: 0.02, size: 3, gravity: -0.02 });
        this.#particles.burst(x, y, 10, { speed: 2, color: '#b8b0c8', decay: 0.03, size: 2, gravity: -0.03 });
      }
      if (this.#shake)
        this.#shake.trigger(5, 260);
    }

    // --- queries used by the token renderer ---

    // Pixel offset, white-flash strength and opacity for a unit this frame.
    unitState(unitId, tileSize) {
      const state = { dx: 0, dy: 0, flash: 0, alpha: 1, tint: null, dying: false };
      const r = this.#reactions.get(unitId);
      if (r) {
        const p = clamp01(r.t / REACTION_LIFE);
        const wave = Math.sin(p * Math.PI);
        if (r.kind === 'hit') {
          const push = (r.crit ? 0.22 : 0.14) * tileSize * wave;
          state.dx = r.kx * push + (r.crit ? Math.sin(p * 40) * 2 * (1 - p) : 0);
          state.dy = r.ky * push;
          state.flash = 1 - p;
        } else if (r.kind === 'dodge') {
          state.dx = -0.18 * tileSize * wave;
        } else if (r.kind === 'heal') {
          state.tint = `rgba(120,255,170,${(0.45 * (1 - p)).toFixed(3)})`;
        }
      }
      const d = this.#deaths.get(unitId);
      if (d) {
        const p = clamp01(d.t / DEATH_LIFE);
        state.alpha = 1 - p * 0.72;
        state.dy += p * tileSize * 0.08;
        state.dying = true;
      }
      return state;
    }

    isDying(unitId) { return this.#deaths.has(unitId); }

    // --- drawing ---

    beginShake(ctx) {
      if (this.#shake)
        this.#shake.apply(ctx);
      else
        ctx.save();
    }

    endShake(ctx) {
      ctx.restore();
    }

    drawParticles(ctx) {
      if (this.#particles)
        this.#particles.draw(ctx);
    }

    drawNumbers(ctx) {
      if (this.#numbers.length === 0)
        return;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      for (const n of this.#numbers) {
        const p = n.t / n.life;
        const pop = n.t < 0.18 ? easeOutBack(n.t / 0.18) : 1;
        const rise = 34 * (1 - Math.pow(1 - clamp01(p * 1.4), 3));
        const alpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
        const size = Math.max(1, n.size * pop);
        ctx.globalAlpha = clamp01(alpha);
        ctx.font = `900 ${size | 0}px Georgia, 'Times New Roman', serif`;
        const y = n.y - rise;
        ctx.lineWidth = Math.max(3, size * 0.2);
        ctx.strokeStyle = 'rgba(10,6,14,0.9)';
        ctx.strokeText(n.text, n.x, y);
        ctx.fillStyle = n.color;
        ctx.fillText(n.text, n.x, y);
        if (n.crit) {
          ctx.globalAlpha = clamp01(alpha) * 0.55;
          ctx.fillStyle = '#fff';
          ctx.fillText(n.text, n.x, y - size * 0.06);
        }
      }
      ctx.restore();
    }
  }

  TR.CombatFx = CombatFx;
})();
