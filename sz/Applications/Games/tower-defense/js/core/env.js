/* core/env.js -- the canvas, status-bar elements, the desktop window hooks and title, and throttled sound helpers.
   Reads: constants, maps, effects and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { STATE_READY, STATE_GAME_OVER, STATE_MAP_SELECT, STATE_RESEARCH } = NS.constants;
  const { MAPS } = NS.maps;

  /* ══════════════════════════════════════════════════════════════════
     DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const statusWave = document.getElementById('statusWave');
  const statusGold = document.getElementById('statusGold');
  const statusLives = document.getElementById('statusLives');
  const highScoresBody = document.getElementById('highScoresBody');

  const { User32 } = SZ?.Dlls ?? {};

  const screenShake = { trigger: (intensity, ms) => NS.effects.addShake(intensity, ms) };
  const audio = SZ.GameAudio;

  /* Tower shots are throttled so a full board does not turn into noise */
  const SHOT_SOUNDS = {
    arrow: ['shoot', 1.4], cannon: ['thud', 1.1], frost: ['blip', 1.6], tesla: ['zap', 1.1],
    flame: ['whoosh', 1.5], poison: ['bounce', 0.8], laser: ['laser', 1.3], sniper: ['shoot', 0.6],
    mortar: ['thud', 0.6], missile: ['shoot', 0.85], arcane: ['laser', 2.2]
  };
  const lastShotSoundAt = {};

  // Any effect, at most once per `ms` for the given key
  const lastSoundAt = {};
  function playThrottled(key, name, opts, ms) {
    const now = performance.now();
    if (now - (lastSoundAt[key] || 0) < ms) return;
    lastSoundAt[key] = now;
    audio.play(name, opts);
  }

  // A low two-voice horn when a boss arrives
  function bossHorn() {
    audio.sweep(110, 72, 0.9, 'sawtooth', 0.1);
    audio.sweep(165, 108, 0.9, 'square', 0.05, 0.06);
    audio.play('thud', { pitch: 0.5 });
  }

  function playShotSound(def) {
    const now = performance.now();
    const snd = SHOT_SOUNDS[def.id];
    if (!snd || now - (lastShotSoundAt[def.id] || 0) < 110)
      return;
    lastShotSoundAt[def.id] = now;
    audio.play(snd[0], { pitch: snd[1] * (0.95 + NS.effects.fxRandom() * 0.1), volume: 0.3 });
  }

  function waveTotalText() {
    return String(G.totalWaves);
  }

  function updateWindowTitle() {
    const mapName = MAPS[G.currentMap]?.name || '';
    const title = G.state === STATE_READY
      ? 'Tower Defense'
      : G.state === STATE_MAP_SELECT
        ? 'Tower Defense -- Campaign'
        : G.state === STATE_RESEARCH
          ? 'Tower Defense -- Research'
        : G.state === STATE_GAME_OVER
          ? `Tower Defense -- ${mapName} Game Over`
          : `Tower Defense -- ${mapName} Wave ${G.currentWave}/${waveTotalText()}${G.cleared ? ' (cleared)' : ''}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  NS.env = { canvas, ctx, statusWave, statusGold, statusLives, highScoresBody, User32, screenShake, audio,
      playThrottled, bossHorn, playShotSound, waveTotalText, updateWindowTitle };

})();
