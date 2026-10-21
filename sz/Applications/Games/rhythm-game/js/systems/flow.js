/* The per-frame update while playing: song clock, decaying flashes and pulses,
   the BPM-synced background pulse, glow ring motion, note trail emission,
   scroll-past misses and the song-over check. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  function updatePlaying(dt) {
    S.songTime += dt;

    // Decay lane flashes
    for (let i = 0; i < C.LANE_COUNT; ++i) {
      if (S.laneFlash[i] > 0)
        S.laneFlash[i] = Math.max(0, S.laneFlash[i] - dt * 6);
    }

    // Decay combo pulse
    if (S.comboPulse > 0)
      S.comboPulse = Math.max(0, S.comboPulse - dt * 4);

    // Decay combo bounce (elastic — fast decay)
    if (S.comboBounce > 0)
      S.comboBounce = Math.max(0, S.comboBounce - dt * 5);

    // Decay screen flash
    if (S.screenFlashAlpha > 0)
      S.screenFlashAlpha = Math.max(0, S.screenFlashAlpha - dt * 4);

    // Background beat pulse — sync with BPM
    if (S.currentSong) {
      const beatInterval = 60 / S.currentSong.bpm;
      S.bgPulsePhase += dt / beatInterval;
      // Pulse peaks at each beat
      const beatFrac = S.bgPulsePhase % 1;
      S.bgPulseIntensity = Math.pow(1 - beatFrac, 3) * 0.4;
    }

    // Update glow rings
    for (let i = S.glowRings.length - 1; i >= 0; --i) {
      const ring = S.glowRings[i];
      ring.life -= dt * 3;
      ring.radius += dt * 120;
      if (ring.life <= 0 || ring.radius > ring.maxRadius)
        S.glowRings.splice(i, 1);
    }

    // Spawn trail particles behind active notes
    for (const note of S.activeNotes) {
      if (note.hit || note.missed) continue;
      const elapsed = S.songTime - note.time;
      const y = C.HIT_ZONE_Y + elapsed * C.NOTE_SPEED;
      if (y < -C.NOTE_RADIUS * 2 || y > C.CANVAS_H + C.NOTE_RADIUS) continue;
      const x = NS.rules.laneX(note.lane);
      const neonColor = C.NEON_COLORS[note.lane];
      // Emit trail particles upward (behind the note as it falls)
      if (Math.random() < 0.6) {
        D.trailParticles.trail(x + (Math.random() - 0.5) * C.NOTE_RADIUS * 0.8, y - C.NOTE_RADIUS * 0.5, {
          vy: -1.5 - Math.random() * 1.5,
          vx: (Math.random() - 0.5) * 0.8,
          life: 0.35 + Math.random() * 0.25,
          decay: 0.04,
          size: 1.5 + Math.random() * 2,
          shrink: 0.93,
          color: neonColor,
          gravity: -0.02
        });
      }
    }

    // Check for notes that scrolled past hit zone (missed)
    for (const note of S.activeNotes) {
      if (!note.hit && !note.missed && S.songTime - note.time > C.MISS_WINDOW) {
        note.missed = true;
        S.combo = 0;
        S.comboGlowIntensity = 0;
        S.comboPulse = 0;
        ++S.missCount;
        ++S.consecutiveMisses;
      }
    }

    // Check if song is over (all notes resolved)
    if (S.activeNotes.length > 0) {
      const allResolved = S.activeNotes.every(n => n.hit || n.missed);
      const lastNoteTime = S.activeNotes[S.activeNotes.length - 1].time;
      if (allResolved && S.songTime > lastNoteTime + 1.5)
        NS.song.endSong();
    }
  }

  Object.assign(NS.flow, { updatePlaying });
})();
