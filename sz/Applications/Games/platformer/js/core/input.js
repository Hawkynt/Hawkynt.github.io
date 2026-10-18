/*
 * Play input: the key map and the per-step snapshot of held keys and fresh presses.
 * Writes G.inp and G.firePressed from G.held and G.pressed (filled by ui/controls.js).
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const held = G.held;
  const pressed = G.pressed;
  const inp = G.inp;

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
    ArrowDown: 'down', KeyS: 'down',
    ShiftLeft: 'dash', ShiftRight: 'dash', KeyX: 'dash', KeyL: 'dash',
    KeyC: 'fire', KeyF: 'fire', KeyJ: 'fire'
  };

  function readInput() {
    inp.left = held.has('left');
    inp.right = held.has('right');
    inp.down = held.has('down');
    inp.jump = held.has('jump');
    inp.jumpPressed = pressed.has('jump');
    inp.dashPressed = pressed.has('dash');
    G.firePressed = pressed.has('fire');
    pressed.clear();
  }

  Object.assign(NS.module('input'), {
    KEYMAP,
    readInput
  });
})();
