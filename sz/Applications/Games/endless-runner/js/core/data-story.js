/* The story: the cast (Nova the courier, Pip her lantern drone, Elder Lumen, the Hollow King
   and his five corrupted guardians) and every cinematic - the intro, a comic strip opening each
   world, a reveal before each guardian, the recovered Spark Core after it, and the finale. Each
   shot names the scene the cinematic renderer paints, its world, the speaker and the line.
   Pure data; owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  const CAST = {
    narrator: { name: '', color: '#f2f4ff' },
    nova: { name: 'Nova', color: '#ff8a5a' },
    pip: { name: 'Pip', color: '#5ee0ff' },
    lumen: { name: 'Elder Lumen', color: '#ffd24a' },
    king: { name: 'The Hollow King', color: '#c08cff' },
    boar: { name: 'Thornback', color: '#9be08a' },
    wyrm: { name: 'The Dune Wyrm', color: '#ffb04a' },
    avalanche: { name: 'Rime', color: '#bff4ff' },
    warden: { name: 'Warden Mk-II', color: '#ff4ab8' },
  };

  const CINEMATICS = {
    intro: [
      { art: 'beacon', w: 0, who: 'narrator', text: 'For a thousand years the Beacon of Lumen kept the five lands bright and moving.' },
      { art: 'shatter', w: 4, who: 'narrator', text: 'Then the Hollow King came. The Beacon cracked, and its light broke into five Spark Cores.' },
      { art: 'king', w: 4, who: 'king', text: 'Rest now, little world. No more running. No more light.' },
      { art: 'nova', w: 0, who: 'lumen', text: 'Nova! You are the fastest courier we have. Bring the cores home before the Hollow swallows everything.' },
      { art: 'pip', w: 0, who: 'pip', text: 'Beep! Five lands, five cores, zero naps. Let\'s run!' },
    ],
    world0: [
      { art: 'run', w: 0, who: 'pip', text: 'Sunpetal Meadows! Fences, bees, and... is that a very angry boar?' },
      { art: 'map', w: 0, who: 'nova', text: 'The first core is out here somewhere. Jump the fences, slide the branches, keep moving.' },
    ],
    world1: [
      { art: 'run', w: 1, who: 'pip', text: 'Ember Canyon. My sensors say: hot. My other sensors say: very hot.' },
      { art: 'map', w: 1, who: 'nova', text: 'Something huge is moving under the sand. Watch for the ripples.' },
    ],
    world2: [
      { art: 'run', w: 2, who: 'nova', text: 'Frostpeak Pass. Ice up top, icicles overhead. Don\'t look down, Pip.' },
      { art: 'map', w: 2, who: 'pip', text: 'I looked down. I regret looking down.' },
    ],
    world3: [
      { art: 'run', w: 3, who: 'pip', text: 'Neon Metro! Rooftops, drones, and a lot of glowing signs that say NO RUNNING.' },
      { art: 'map', w: 3, who: 'nova', text: 'The city\'s security went Hollow too. We go over the rooftops.' },
    ],
    world4: [
      { art: 'run', w: 4, who: 'nova', text: 'The Hollow Rift. The ground is breaking apart beneath us.' },
      { art: 'king', w: 4, who: 'king', text: 'You carry four lights into my dark, courier. Bring me the fifth, and rest.' },
    ],
    boss_boar: [
      { art: 'boss', w: 0, boss: 'boar', who: 'boar', text: 'SNORT! The shiny light is MINE! Thornback tramples all who run!' },
      { art: 'run', w: 0, who: 'pip', text: 'It\'s behind us! Don\'t trip! Don\'t trip! Hit the boost pads!' },
    ],
    boss_wyrm: [
      { art: 'boss', w: 1, boss: 'wyrm', who: 'wyrm', text: 'Little warm thing... come closer to the sand.' },
      { art: 'run', w: 1, who: 'nova', text: 'Grab the spark orbs, Pip - fire them back when it surfaces!' },
    ],
    boss_avalanche: [
      { art: 'boss', w: 2, boss: 'avalanche', who: 'avalanche', text: 'The mountain sleeps. You will sleep with it, beneath the snow.' },
      { art: 'run', w: 2, who: 'pip', text: 'AVALANCHE! Run run run run run!' },
    ],
    boss_warden: [
      { art: 'boss', w: 3, boss: 'warden', who: 'warden', text: 'UNAUTHORISED RUNNING DETECTED. COMMENCING CORRECTION.' },
      { art: 'run', w: 3, who: 'nova', text: 'Dodge the missiles, catch the orbs, and overload its core.' },
    ],
    boss_king: [
      { art: 'boss', w: 4, boss: 'king', who: 'king', text: 'Enough. I will end your running myself.' },
      { art: 'nova', w: 4, who: 'nova', text: 'Four cores are singing, Pip. Let\'s give him the fifth - the hard way.' },
    ],
    win_boar: [{ art: 'core', w: 0, who: 'pip', text: 'The boar crashed into the old oak - and dropped the first Spark Core!' }],
    win_wyrm: [{ art: 'core', w: 1, who: 'nova', text: 'The wyrm sinks back into the sand. Core number two!' }],
    win_avalanche: [{ art: 'core', w: 2, who: 'pip', text: 'We outran a mountain. A whole mountain! And look - the third core!' }],
    win_warden: [{ art: 'core', w: 3, who: 'warden', text: 'SYSTEM... RESTORED. THANK YOU, COURIER. CORE RELEASED.' }],
    win_king: [
      { art: 'core', w: 4, who: 'king', text: 'All five... the light is so loud...' },
      { art: 'relit', w: 0, who: 'narrator', text: 'Nova carried the last core home, and the Beacon of Lumen burned bright again.' },
      { art: 'pip', w: 0, who: 'pip', text: 'So... same time tomorrow? I hear the courses change every day.' },
      { art: 'nova', w: 0, who: 'nova', text: 'Always. A courier never stops running.' },
    ],
  };

  Object.assign(NS.story, {
    CAST, CINEMATICS
  });
})();
