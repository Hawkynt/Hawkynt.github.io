/* Space Farming - feedback effects: produce and coins flying to their counters, building
   drop-in and dust, confetti, animal voices and day chimes.
   Owns: G.storagePulse, G.harvestCombo, G.harvestComboT
   Reads: G.uiTime, G.lowQuality, G.creditsPulse */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, ctx, FarmParticles, particles, drawSprite, worldToUI, hudLayout } = NS;

  /* ══════════════════════════════════════════════════════════════════
     JUICE — produce and coins fly to their counters, buildings drop in,
     celebrations burst confetti, sounds follow every action
     ══════════════════════════════════════════════════════════════════ */

  const uiParticles = new FarmParticles(400);
  const flyers = [];                 // { sprite, x0, y0, target, t, dur, size, arc, onArrive }
  const buildAnim = {};              // "r,c" -> uiTime of placement

  function creditsTarget() {
    const L = hudLayout();
    return { x: L.farm.x + 26, y: L.farm.y + 26 };
  }

  function storageTarget() {
    const L = hudLayout();
    return { x: L.farm.x + 20, y: L.farm.y + 63 };
  }

  function addFlyer(sprite, x0, y0, targetFn, opts) {
    opts = opts || {};
    if (flyers.length > (G.lowQuality ? 40 : 80)) return;
    flyers.push({
      sprite, x0, y0, target: targetFn, t: -(opts.delay || 0), dur: opts.dur || 0.75 + Math.random() * 0.2,
      size: opts.size || 22, arc: opts.arc !== undefined ? opts.arc : 60 + Math.random() * 50,
      spread: (Math.random() - 0.5) * 40, onArrive: opts.onArrive
    });
  }

  /* Harvested produce hops up from the tile and flies into storage */
  function flyProduce(sprite, wx, wy, count, small) {
    const p = worldToUI(wx, wy);
    for (let i = 0; i < Math.min(count, 4); ++i)
      addFlyer(sprite, p.x, p.y - 10, storageTarget, {
        delay: i * 0.08, size: small ? 16 : 24, arc: small ? 40 : 90,
        onArrive: () => {
          G.storagePulse = 1;
          SZ.GameAudio.play('blip', { pitch: 1.6 + Math.random() * 0.3, volume: 0.25 });
        }
      });
  }

  /* Coins from a point (UI units) into the credit counter */
  function flyCoins(n, ux, uy, opts) {
    opts = opts || {};
    for (let i = 0; i < n; ++i)
      addFlyer('coin', ux + (Math.random() - 0.5) * 24, uy + (Math.random() - 0.5) * 12, creditsTarget, {
        delay: i * (opts.stagger || 0.05), size: opts.size || 20, arc: 50 + Math.random() * 60,
        onArrive: () => {
          G.creditsPulse = 1;
          SZ.GameAudio.play('coin', { pitch: 0.9 + Math.random() * 0.3, volume: 0.35 });
        }
      });
  }

  function updateFlyers(dt) {
    for (let i = flyers.length - 1; i >= 0; --i) {
      const f = flyers[i];
      f.t += dt;
      if (f.t >= f.dur) {
        flyers.splice(i, 1);
        if (f.onArrive) f.onArrive();
      }
    }
    G.storagePulse = Math.max(0, G.storagePulse - dt * 3);
    G.harvestComboT -= dt;
    if (G.harvestComboT <= 0)
      G.harvestCombo = 0;
  }

  function drawFlyers() {
    for (const f of flyers) {
      if (f.t < 0) continue;
      const k = f.t / f.dur;
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const tg = f.target();
      const cx = (f.x0 + tg.x) / 2 + f.spread, cy = Math.min(f.y0, tg.y) - f.arc;
      const x = (1 - e) * (1 - e) * f.x0 + 2 * (1 - e) * e * cx + e * e * tg.x;
      const y = (1 - e) * (1 - e) * f.y0 + 2 * (1 - e) * e * cy + e * e * tg.y;
      const pop = k < 0.15 ? 0.5 + k / 0.15 * 0.7 : 1.2 - (k - 0.15) * 0.45;
      ctx.save();
      ctx.globalAlpha = Math.min(1, (1 - k) * 4 + 0.3);
      NS.drawGlow(x, y, f.size * pop * 0.8, '#ffe68c', 0.55);
      drawSprite(f.sprite, x, y, f.size * pop);
      ctx.restore();
    }
  }

  function celebrate(ux, uy, n) {
    uiParticles.confetti(ux, uy, n || 26, { speed: 5 });
  }

  /* Building drop-in: falls from above, squashes on landing, dust ring */
  function buildingDrop(r, c) {
    const k = r + ',' + c;
    if (buildAnim[k] === undefined) return 0;
    const t = (G.uiTime - buildAnim[k]) / 0.45;
    if (t >= 1.35) {
      delete buildAnim[k];
      return 0;
    }
    return t;
  }

  function dustRing(wx, wy, color) {
    for (let i = 0; i < 14; ++i) {
      const a = (i / 14) * TWO_PI;
      particles.trail(wx + Math.cos(a) * 10, wy + Math.sin(a) * 4, {
        vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 0.8 - 0.3, color: color || '#d8c8a8',
        life: 0.5 + Math.random() * 0.2, size: 3 + Math.random() * 2, decay: 0.035
      });
    }
  }

  /* Animal voices when produce is collected */
  const ANIMAL_VOICES = {
    cow: () => { SZ.GameAudio.sweep(230, 150, 0.32, 'sawtooth', 0.045); },
    hen: () => { SZ.GameAudio.sweep(900, 1300, 0.07, 'square', 0.035); SZ.GameAudio.sweep(1000, 1400, 0.07, 'square', 0.03, 0.09); },
    goat: () => { SZ.GameAudio.sweep(520, 380, 0.22, 'sawtooth', 0.04); SZ.GameAudio.sweep(500, 400, 0.18, 'sawtooth', 0.03, 0.2); },
    chick: () => { SZ.GameAudio.sweep(1700, 2200, 0.05, 'square', 0.03); SZ.GameAudio.sweep(1800, 2300, 0.05, 'square', 0.025, 0.08); },
    rabbit: () => { SZ.GameAudio.sweep(1200, 900, 0.06, 'triangle', 0.05); },
    bee: () => { SZ.GameAudio.sweep(210, 240, 0.4, 'sawtooth', 0.03); }
  };
  let lastVoice = 0;

  function animalVoice(sprite) {
    if (G.uiTime - lastVoice < 0.25) return;
    lastVoice = G.uiTime;
    const v = ANIMAL_VOICES[sprite];
    if (v) v();
  }

  function squeak() {
    SZ.GameAudio.sweep(2400, 3000, 0.04, 'square', 0.025);
    SZ.GameAudio.sweep(2600, 3200, 0.04, 'square', 0.02, 0.07);
  }

  /* Soft chimes at dawn and dusk */
  function dayChime(dawn) {
    const notes = dawn ? [523, 659, 784] : [659, 523, 392];
    notes.forEach((f, i) => SZ.GameAudio.tone(f, 0.5, 'sine', 0.035, i * 0.18));
  }

  Object.assign(NS, { uiParticles, buildAnim, flyProduce, flyCoins, updateFlyers, drawFlyers, celebrate,
    buildingDrop, dustRing, animalVoice, squeak, dayChime });

})();
