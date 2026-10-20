/* The perspective rotation: the four cycling views and their smoothstep morph. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.IllusionPuzzle || (SZ.IllusionPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const I = NS.iso;
  const FX = NS.effects;

  /* ══════════════════════════════════════════════════════════════════
     PERSPECTIVE ROTATION
     ══════════════════════════════════════════════════════════════════ */

  function rotatePerspective(dir) {
    if (S.rotationProgress < 1) return;
    S.rotationFrom = S.perspective;
    S.rotationTo = (S.perspective + dir + 4) % 4;
    S.rotationProgress = 0;

    FX.screenShake.trigger(3, 120);
    FX.floatingText.add(C.CANVAS_W / 2, 30, dir > 0 ? 'Rotate Right' : 'Rotate Left', { color: '#88f', font: 'bold 12px sans-serif' });
    FX.particles.burst(C.CANVAS_W / 2, C.CANVAS_H / 2, 10, { color: '#66f', speed: 2, life: 0.4 });
    SZ.GameAudio.play('whoosh', { pitch: dir > 0 ? 1.2 : 0.9 });
  }

  function updateRotation(dt) {
    if (S.rotationProgress < 1) {
      S.rotationProgress = Math.min(1, S.rotationProgress + dt * 3);
      if (I.smoothstep(S.rotationProgress) >= 1) {
        S.rotationProgress = 1;
        S.perspective = S.rotationTo;
      }
    }
  }

  Object.assign(NS.perspective, { rotatePerspective, updateRotation });
})();
