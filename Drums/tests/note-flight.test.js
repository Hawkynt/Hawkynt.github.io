// SynthelicZ Drums — Note-Flight Renderer Tests
// Tests for the projectile overlay that animates notes into the drum kit.

(function () {
'use strict';

const { describe, it, expect, beforeEach } = window.TestRunner;
const { NoteFlightRenderer, Instrument, INSTRUMENT_COLORS } = window.SZDrums;

// ── Helper: create a full-screen overlay canvas ────────────

const makeCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;';
  document.body.appendChild(canvas);
  return canvas;
};

// ── Construction ───────────────────────────────────────────

describe('NoteFlightRenderer — construction', () => {

  it('creates renderer without throwing', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    expect(renderer).toBeTruthy();
  });

  it('has a 2d context', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    expect(renderer._ctx).toBeTruthy();
  });

  it('starts with empty projectile and impact lists', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    expect(renderer._projectiles.length).toBe(0);
    expect(renderer._impactParticles.length).toBe(0);
    expect(renderer._impactRings.length).toBe(0);
  });

  it('hasActiveElements returns false when empty', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    expect(renderer.hasActiveElements()).toBe(false);
  });
});

// ── spawn ──────────────────────────────────────────────────

describe('NoteFlightRenderer — spawn', () => {

  it('adds a projectile with correct source and target', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(100, 200, 300, 400, Instrument.SnareDrum, 'belt');
    expect(renderer._projectiles.length).toBe(1);
    const p = renderer._projectiles[0];
    expect(p.sx).toBe(100);
    expect(p.sy).toBe(200);
    expect(p.tx).toBe(300);
    expect(p.ty).toBe(400);
    expect(p.instrument).toBe(Instrument.SnareDrum);
  });

  it('assigns the correct color from INSTRUMENT_COLORS', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(0, 0, 100, 100, Instrument.Crash, 'lane');
    expect(renderer._projectiles[0].color).toBe(INSTRUMENT_COLORS[Instrument.Crash]);
  });

  it('hasActiveElements returns true after spawn', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(0, 0, 100, 100, Instrument.Crash, 'belt');
    expect(renderer.hasActiveElements()).toBe(true);
  });

  it('computes a Bézier control point', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(50, 50, 350, 250, Instrument.BassDrum, 'belt');
    const p = renderer._projectiles[0];
    expect(typeof p.cpx).toBe('number');
    expect(typeof p.cpy).toBe('number');
  });

  it('uses different control points for belt vs lane origin', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(50, 50, 350, 250, Instrument.HighTom, 'belt');
    const belt = { ...renderer._projectiles[0] };

    const canvas2 = makeCanvas();
    const renderer2 = new NoteFlightRenderer(canvas2);
    renderer2.spawn(50, 50, 350, 250, Instrument.HighTom, 'lane');
    const lane = { ...renderer2._projectiles[0] };

    // Control points should differ between belt and lane origin
    const cpDiffers = belt.cpx !== lane.cpx || belt.cpy !== lane.cpy;
    expect(cpDiffers).toBe(true);
  });
});

// ── render — projectile lifecycle ──────────────────────────

describe('NoteFlightRenderer — render lifecycle', () => {

  it('renders without throwing on empty state', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.render(performance.now());
    expect(true).toBe(true);
  });

  it('keeps projectile alive before flight duration elapses', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(100, 100, 300, 300, Instrument.Ride, 'belt');
    renderer.render(performance.now() + 50); // 50ms into 250ms flight
    expect(renderer._projectiles.length).toBe(1);
  });

  it('removes projectile and spawns impact after flight duration', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(100, 100, 300, 300, Instrument.Ride, 'belt');
    renderer.render(performance.now() + 500); // well past 250ms
    expect(renderer._projectiles.length).toBe(0);
    expect(renderer._impactRings.length).toBe(1);
    expect(renderer._impactParticles.length).toBeGreaterThan(0);
  });
});

// ── onArrive callback ──────────────────────────────────────

describe('NoteFlightRenderer — onArrive callback', () => {

  it('invokes callback with the instrument when projectile arrives', () => {
    const arrived = [];
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas, (instr) => arrived.push(instr));
    renderer.spawn(0, 0, 100, 100, Instrument.ClosedHiHat, 'belt');
    renderer.render(performance.now() + 500);
    expect(arrived.length).toBe(1);
    expect(arrived[0]).toBe(Instrument.ClosedHiHat);
  });

  it('does not invoke callback before flight duration elapses', () => {
    const arrived = [];
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas, (instr) => arrived.push(instr));
    renderer.spawn(0, 0, 100, 100, Instrument.MidTom, 'lane');
    renderer.render(performance.now() + 50);
    expect(arrived.length).toBe(0);
  });
});

// ── Impact effects ─────────────────────────────────────────

describe('NoteFlightRenderer — impact effects', () => {

  it('impact rings fade out over time', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(0, 0, 100, 100, Instrument.FloorTom, 'belt');
    renderer.render(performance.now() + 500); // arrive
    expect(renderer._impactRings.length).toBe(1);
    renderer.render(performance.now() + 1500); // well past ring lifetime
    expect(renderer._impactRings.length).toBe(0);
  });

  it('impact particles fade out over time', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(0, 0, 100, 100, Instrument.FloorTom, 'belt');
    renderer.render(performance.now() + 500);
    const particleCount = renderer._impactParticles.length;
    expect(particleCount).toBeGreaterThan(0);
    renderer.render(performance.now() + 2000);
    expect(renderer._impactParticles.length).toBe(0);
  });
});

// ── Projectile fade-in ────────────────────────────────────────

describe('NoteFlightRenderer — projectile fade-in', () => {

  it('renders early-flight projectiles without throwing', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(100, 100, 300, 300, Instrument.SnareDrum, 'belt');
    // Render at 10ms — within the 20% fade-in window (50ms of 250ms flight)
    renderer.render(performance.now() + 10);
    expect(renderer._projectiles.length).toBe(1);
  });

  it('renders mid-flight projectiles without throwing', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(100, 100, 300, 300, Instrument.ClosedHiHat, 'lane');
    // Render at 125ms — past fade-in, mid-flight
    renderer.render(performance.now() + 125);
    expect(renderer._projectiles.length).toBe(1);
  });

  it('trail builds up during fade-in phase', () => {
    const canvas = makeCanvas();
    const renderer = new NoteFlightRenderer(canvas);
    renderer.spawn(100, 100, 300, 300, Instrument.BassDrum, 'belt');
    // Render multiple frames during early flight
    const base = performance.now();
    renderer.render(base + 10);
    renderer.render(base + 20);
    renderer.render(base + 30);
    expect(renderer._projectiles[0].trailX.length).toBeGreaterThan(0);
  });
});

})();
