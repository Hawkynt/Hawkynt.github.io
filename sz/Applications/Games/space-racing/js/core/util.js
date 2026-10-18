/*
 * Pure helpers: 60 Hz frame scaling of per-frame rates, time / ordinal / roman
 * number formatting. Owns no state, reads nothing.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;

  function romanNumeral(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
  }

  function formatTime(t) {
    const mins = Math.floor(t / 60);
    const secs = (t % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  }

  /* Number of 60 Hz frames covered by dt; snaps refresh jitter so 60 Hz stays one frame */
  function frameScale(dt) {
    const frames = dt * 60;
    return Math.abs(frames - 1) < 0.03 ? 1 : frames;
  }

  /* Per-frame rate (blend factor or chance) spread over the frames covered by dt */
  function frameRate(rate, dt) {
    const frames = frameScale(dt);
    return frames === 1 ? rate : 1 - Math.pow(1 - rate, frames);
  }

  function getOrdinal(n) {
    if (n === 1) return '1st';
    if (n === 2) return '2nd';
    if (n === 3) return '3rd';
    return n + 'th';
  }

  Object.assign(NS.module('util'), {
    romanNumeral, formatTime, frameScale, frameRate, getOrdinal
  });
})();
