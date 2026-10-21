/* Judging a lane press: find the nearest note in the window, score it with the
   combo multiplier, fire the rank-scaled neon particle effects, glow rings and
   milestone celebrations — or register a miss with its escalating shake. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const { laneX, getMultiplier, judgeNote } = NS.rules;
  const { playHitSound, playMissSound } = NS.audio;
  const { updateStatus } = NS.status;

  function hitNote(lane) {
    if (S.state !== C.STATE_PLAYING) return;

    let bestNote = null;
    let bestDiff = Infinity;

    for (const note of S.activeNotes) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const diff = Math.abs(S.songTime - note.time);
      if (diff < bestDiff && diff <= C.MISS_WINDOW) {
        bestDiff = diff;
        bestNote = note;
      }
    }

    if (!bestNote) {
      // Pressed key but no note nearby — penalize
      registerMiss(lane);
      return;
    }

    const judgment = judgeNote(S.songTime - bestNote.time);
    if (!judgment) {
      registerMiss(lane);
      return;
    }

    bestNote.hit = true;
    S.consecutiveMisses = 0;
    const mult = getMultiplier();
    S.score += judgment.score * mult;
    ++S.combo;
    if (S.combo > S.maxCombo) S.maxCombo = S.combo;

    if (judgment.rank === 'PERFECT') ++S.perfectCount;
    else if (judgment.rank === 'GREAT') ++S.greatCount;
    else ++S.goodCount;

    // Combo glow intensifies with streak
    S.comboGlowIntensity = Math.min(1, S.combo / 30);
    S.comboPulse = 1;

    // Combo bounce — elastic scale effect, stronger when combo changes
    if (S.combo !== S.comboLastValue) {
      S.comboBounce = 1;
      S.comboLastValue = S.combo;
    }

    const x = laneX(lane);
    const neonColor = C.NEON_COLORS[lane];
    const neonGlow = C.NEON_GLOW_COLORS[lane];

    // Judgment text — show multiplier too when > 1
    const multText = mult > 1 ? ` x${mult}` : '';
    D.floatingText.add(x, C.HIT_ZONE_Y - 40, judgment.rank + multText, { color: judgment.color, size: 20 });

    // Lane flash on any hit
    S.laneFlash[lane] = 1;

    // Particle effects scale with judgment rank — neon explosion style
    if (judgment.rank === 'PERFECT') {
      // Screen flash on PERFECT
      S.screenFlashAlpha = 0.35;
      S.screenFlashColor = neonColor;

      // Large neon sparkle burst + standard burst for PERFECT
      D.particles.sparkle(x, C.HIT_ZONE_Y, 20, { color: '#ff0', speed: 5 });
      D.particles.burst(x, C.HIT_ZONE_Y, 25, { color: neonColor, speed: 6, life: 0.9, gravity: 0.05 });
      // Secondary ring of particles
      D.particles.burst(x, C.HIT_ZONE_Y, 15, { color: neonGlow, speed: 3, life: 0.7, size: 4 });
      // White core flash particles
      D.particles.sparkle(x, C.HIT_ZONE_Y, 8, { color: '#fff', speed: 2, life: 0.4 });
      // Expanding glow ring — double ring for PERFECT
      S.glowRings.push({ x, y: C.HIT_ZONE_Y, radius: C.NOTE_RADIUS, maxRadius: 80, life: 1, color: '#ff0' });
      S.glowRings.push({ x, y: C.HIT_ZONE_Y, radius: C.NOTE_RADIUS * 0.5, maxRadius: 50, life: 0.8, color: neonColor });
    } else if (judgment.rank === 'GREAT') {
      D.particles.burst(x, C.HIT_ZONE_Y, 18, { color: neonColor, speed: 4.5, life: 0.7, gravity: 0.03 });
      D.particles.sparkle(x, C.HIT_ZONE_Y, 10, { color: '#4f4', speed: 3 });
      D.particles.burst(x, C.HIT_ZONE_Y, 8, { color: neonGlow, speed: 2.5, life: 0.5 });
      S.glowRings.push({ x, y: C.HIT_ZONE_Y, radius: C.NOTE_RADIUS, maxRadius: 55, life: 0.8, color: neonColor });
    } else {
      D.particles.burst(x, C.HIT_ZONE_Y, 12, { color: neonColor, speed: 3, life: 0.6, gravity: 0.04 });
      D.particles.sparkle(x, C.HIT_ZONE_Y, 4, { color: neonGlow, speed: 2 });
    }

    // Combo milestone notifications — bigger explosions
    if (S.combo === 10 || S.combo === 30 || S.combo === 50 || S.combo === 100) {
      D.floatingText.add(C.CANVAS_W / 2, C.CANVAS_H / 2 - 60, `${S.combo} COMBO!`, { color: '#fa0', size: 28, decay: 0.012, vy: -2 });
      D.particles.confetti(C.CANVAS_W / 2, C.CANVAS_H / 2, 35);
      // Extra neon burst at milestones
      D.particles.sparkle(C.CANVAS_W / 2, C.CANVAS_H / 2, 25, { color: '#ff0', speed: 6 });
      S.screenFlashAlpha = Math.min(S.screenFlashAlpha + 0.2, 0.5);
      S.screenFlashColor = '#fa0';
    }

    playHitSound(judgment.rank);
    updateStatus();
  }

  function registerMiss(lane) {
    S.combo = 0;
    S.comboGlowIntensity = 0;
    S.comboPulse = 0;
    ++S.missCount;
    ++S.consecutiveMisses;
    const x = laneX(lane);
    D.floatingText.add(x, C.HIT_ZONE_Y - 40, 'Miss', { color: '#f44', size: 18 });
    // Escalating screen shake — consecutive misses shake harder (cap at intensity 8)
    const shakeIntensity = Math.min(3 + S.consecutiveMisses * 1.5, 8);
    const shakeDuration = Math.min(150 + S.consecutiveMisses * 30, 300);
    D.screenShake.trigger(shakeIntensity, shakeDuration);
    // Red neon flash particles on miss — gravity pulls them down
    D.particles.burst(x, C.HIT_ZONE_Y, 10, { color: '#ff2244', speed: 3, life: 0.5, gravity: 0.2, size: 3 });
    D.particles.sparkle(x, C.HIT_ZONE_Y, 4, { color: '#ff0000', speed: 1.5 });
    playMissSound();
    updateStatus();
  }

  Object.assign(NS.scoring, { hitNote, registerMiss });
})();
