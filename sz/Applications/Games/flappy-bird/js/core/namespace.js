;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /* The SZ.FlappyBird namespace and its module slots. Every module fills its own slot
     with Object.assign, so any module may keep a reference to any other slot at load
     time; the calls only happen once all scripts have run. Load order (index.html):
       pure      course, hazards, boss, seasons (SZ.Flappy* - also loaded by the tests)
       art       bird, cosmetics, bosses, seasons, story, power icons, scenery, UI kit
       core      namespace, constants, data tables, state, services, save, progress, rules, music
       systems   particles, goals, run, powers, bossfight, effects, cinematics, autosave,
                 flight, contact
       render    view, shapes, effects, world, hud, cinematic
       ui        menu, navigation, title, modes, map, nest, wardrobe, goals, help, results,
                 input
       app       game loop and start-up */
  const NS = SZ.FlappyBird || (SZ.FlappyBird = {});

  const SLOTS = [
    'C', 'state', 'services', 'save', 'progress', 'rules', 'music',
    'goals', 'run', 'powers', 'bossfight', 'fx', 'cine', 'autosave', 'flight', 'contact',
    'view', 'shapes', 'fxDraw', 'world', 'hud', 'cineDraw',
    'menu', 'nav', 'title', 'modes', 'map', 'nest', 'aviary', 'goalsUi', 'help', 'results', 'input',
    'app'
  ];
  for (let i = 0; i < SLOTS.length; ++i)
    if (!NS[SLOTS[i]])
      NS[SLOTS[i]] = {};
})();
