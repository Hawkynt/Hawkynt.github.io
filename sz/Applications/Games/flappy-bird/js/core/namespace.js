;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /* The SZ.FlappyBird namespace and its module slots. Every module fills its own slot
     with Object.assign, so any module may keep a reference to any other slot at load
     time; the calls only happen once all scripts have run. Load order (index.html):
       core      constants, state, services, save, progress, rules
       systems   run, effects, flight, contact
       render    view, shapes, effects, world, hud
       ui        menu, navigation, title, nest, aviary, help, results, input
       app       game loop and start-up */
  const NS = SZ.FlappyBird || (SZ.FlappyBird = {});

  const SLOTS = [
    'C', 'state', 'services', 'save', 'progress', 'rules',
    'run', 'fx', 'flight', 'contact',
    'view', 'shapes', 'fxDraw', 'world', 'hud',
    'menu', 'nav', 'title', 'nest', 'aviary', 'help', 'results', 'input',
    'app'
  ];
  for (let i = 0; i < SLOTS.length; ++i)
    if (!NS[SLOTS[i]])
      NS[SLOTS[i]] = {};
})();
