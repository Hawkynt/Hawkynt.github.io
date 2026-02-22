// SynthelicZ Drums — Note-Flight Overlay Renderer
// Animates projectiles from the belt / falling-lanes into the drum-kit SVG.
// Each projectile follows a quadratic Bézier curve with a glow trail and
// spawns a burst of impact particles on arrival.

(function (ns) {
'use strict';

const { INSTRUMENT_COLORS } = ns;

// ── Tuning constants ───────────────────────────────────────

const FLIGHT_DURATION_MS = 250;     // time for a projectile to reach the kit
const PROJECTILE_RADIUS = 6;        // base radius of the flying dot
const TRAIL_LENGTH = 8;             // number of previous positions kept for trail
const TRAIL_ALPHA_DECAY = 0.7;      // alpha multiplier per trail segment

const IMPACT_PARTICLE_COUNT = 8;    // small sparks on impact
const IMPACT_PARTICLE_SPEED = 80;   // px/s outward
const IMPACT_PARTICLE_LIFE_MS = 400;
const IMPACT_RING_DURATION_MS = 350; // expanding ring lifetime

// ── Data types ─────────────────────────────────────────────

/**
 * @typedef {Object} Projectile
 * @property {number}   startTime   — performance.now() at spawn
 * @property {number}   sx          — start screen X
 * @property {number}   sy          — start screen Y
 * @property {number}   tx          — target screen X (kit pad)
 * @property {number}   ty          — target screen Y (kit pad)
 * @property {number}   cpx         — Bézier control-point X
 * @property {number}   cpy         — Bézier control-point Y
 * @property {string}   color
 * @property {string}   instrument
 * @property {number[]} trailX      — ring-buffer of recent X positions
 * @property {number[]} trailY
 */

/**
 * @typedef {Object} ImpactParticle
 * @property {number} spawnTime
 * @property {number} x
 * @property {number} y
 * @property {number} vx  — velocity px/s
 * @property {number} vy
 * @property {string} color
 */

/**
 * @typedef {Object} ImpactRing
 * @property {number} spawnTime
 * @property {number} x
 * @property {number} y
 * @property {string} color
 */

// ── NoteFlightRenderer class ───────────────────────────────

class NoteFlightRenderer {

  /**
   * @param {HTMLCanvasElement} canvas   — the #particles overlay canvas
   * @param {Function}          onArrive — callback(instrument) on impact
   */
  constructor(canvas, onArrive) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._onArrive = onArrive ?? (() => {});
    this._projectiles = [];
    this._impactParticles = [];
    this._impactRings = [];

    // Resize with window (cheaper than ResizeObserver on documentElement)
    this._handleResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._handleResize);
    this._handleResize();
  }

  // ── Public API ─────────────────────────────────────────

  /**
   * Spawn a flying projectile.
   * All coordinates are in CSS-pixel screen space.
   *
   * @param {number} sx         — source X (screen)
   * @param {number} sy         — source Y (screen)
   * @param {number} tx         — target X (kit pad centre, screen)
   * @param {number} ty         — target Y (kit pad centre, screen)
   * @param {string} instrument — Instrument enum value
   * @param {'belt'|'lane'} origin — where the note came from (affects curve direction)
   */
  spawn(sx, sy, tx, ty, instrument, origin) {
    const color = INSTRUMENT_COLORS[instrument] ?? '#888';
    const dx = tx - sx;
    const dy = ty - sy;

    // Control point: perpendicular offset for a nice arc.
    // Belt notes come from the right → arc upward.
    // Lane notes come from above → arc to the right.
    let cpx, cpy;
    if (origin === 'lane') {
      cpx = sx + dx * 0.5 + Math.abs(dy) * 0.25;
      cpy = sy + dy * 0.3;
    } else {
      cpx = sx + dx * 0.4;
      cpy = sy + dy * 0.5 - Math.abs(dx) * 0.18;
    }

    this._projectiles.push({
      startTime: performance.now(),
      sx, sy, tx, ty, cpx, cpy,
      color,
      instrument,
      trailX: [],
      trailY: [],
    });
  }

  /** Are there any active projectiles, rings, or particles? */
  hasActiveElements() {
    return this._projectiles.length > 0
      || this._impactRings.length > 0
      || this._impactParticles.length > 0;
  }

  /** Call every frame from the main rAF loop. */
  render(now) {
    const { _canvas: canvas, _ctx: ctx } = this;
    const W = canvas._logicalW || canvas.width;
    const H = canvas._logicalH || canvas.height;
    if (W === 0 || H === 0)
      return;

    // Skip clearing + drawing when there's nothing to render
    if (!this.hasActiveElements())
      return;

    ctx.clearRect(0, 0, W, H);

    this._renderProjectiles(ctx, now);
    this._renderImpactRings(ctx, now);
    this._renderImpactParticles(ctx, now);
  }

  // ── Private: projectiles ───────────────────────────────

  _renderProjectiles(ctx, now) {
    const alive = [];
    for (const p of this._projectiles) {
      const elapsed = now - p.startTime;
      const t = elapsed / FLIGHT_DURATION_MS;

      if (t >= 1) {
        // Arrived — trigger impact
        this._spawnImpact(p.tx, p.ty, p.color, now);
        this._onArrive(p.instrument);
        continue;
      }

      alive.push(p);

      // Quadratic Bézier: B(t) = (1-t)²·S + 2(1-t)t·CP + t²·T
      const mt = 1 - t;
      const x = mt * mt * p.sx + 2 * mt * t * p.cpx + t * t * p.tx;
      const y = mt * mt * p.sy + 2 * mt * t * p.cpy + t * t * p.ty;

      // Fade-in at start of flight so the projectile smoothly emerges
      // from the fading note/gem at the source
      const fadeIn = t < 0.2 ? t / 0.2 : 1;

      // Store trail
      p.trailX.push(x);
      p.trailY.push(y);
      if (p.trailX.length > TRAIL_LENGTH) {
        p.trailX.shift();
        p.trailY.shift();
      }

      // ── draw trail ─────────────────────────────────────
      for (let i = 0; i < p.trailX.length - 1; ++i) {
        const segAlpha = Math.pow(TRAIL_ALPHA_DECAY, p.trailX.length - 1 - i) * (0.5 + 0.5 * t) * fadeIn;
        const segR = PROJECTILE_RADIUS * (0.3 + 0.7 * (i / p.trailX.length));
        ctx.globalAlpha = segAlpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.trailX[i], p.trailY[i], segR, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── draw projectile head ───────────────────────────
      const scale = 1 + 0.3 * Math.sin(t * Math.PI); // bulge mid-flight
      const r = PROJECTILE_RADIUS * scale;
      ctx.globalAlpha = 0.95 * fadeIn;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // bright core
      ctx.globalAlpha = 0.7 * fadeIn;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // outer glow
      ctx.globalAlpha = 0.25 * fadeIn;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, r * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    this._projectiles = alive;
    ctx.globalAlpha = 1;
  }

  // ── Private: impact effects ────────────────────────────

  _spawnImpact(x, y, color, now) {
    // expanding ring
    const _t = now ?? performance.now();
    this._impactRings.push({ spawnTime: _t, x, y, color });

    // burst particles
    for (let i = 0; i < IMPACT_PARTICLE_COUNT; ++i) {
      const angle = (Math.PI * 2 * i) / IMPACT_PARTICLE_COUNT + (Math.random() - 0.5) * 0.5;
      const speed = IMPACT_PARTICLE_SPEED * (0.6 + Math.random() * 0.8);
      this._impactParticles.push({
        spawnTime: _t,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
      });
    }
  }

  _renderImpactRings(ctx, now) {
    const alive = [];
    for (const ring of this._impactRings) {
      const t = (now - ring.spawnTime) / IMPACT_RING_DURATION_MS;
      if (t >= 1)
        continue;

      alive.push(ring);
      const radius = 8 + 40 * t;
      const alpha = 0.6 * (1 - t);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2.5 * (1 - t);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    this._impactRings = alive;
    ctx.globalAlpha = 1;
  }

  _renderImpactParticles(ctx, now) {
    const alive = [];
    for (const p of this._impactParticles) {
      const elapsed = now - p.spawnTime;
      if (elapsed >= IMPACT_PARTICLE_LIFE_MS)
        continue;

      alive.push(p);
      const t = elapsed / IMPACT_PARTICLE_LIFE_MS;
      const x = p.x + p.vx * (elapsed / 1000);
      const y = p.y + p.vy * (elapsed / 1000);
      const alpha = 0.8 * (1 - t);
      const r = 2.5 * (1 - t * 0.5);

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    this._impactParticles = alive;
    ctx.globalAlpha = 1;
  }

  // ── Resize handling ────────────────────────────────────

  _handleResize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return;
    this._canvas.width = w * dpr;
    this._canvas.height = h * dpr;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._canvas._logicalW = w;
    this._canvas._logicalH = h;
    this.render(performance.now());
  }
}

ns.NoteFlightRenderer = NoteFlightRenderer;

})(window.SZDrums = window.SZDrums || {});
