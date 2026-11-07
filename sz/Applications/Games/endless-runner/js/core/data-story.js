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

  /* in-level turns of each story stage: at about metre m the course turns to dir, and a member
     of the cast says why (the line appears just before the turn) */
  const TURNS = {
    'meadow-2': [
      { m: 330, dir: 'up', who: 'pip', text: 'The old bell tower! The road goes over the roof - up the wall, Nova!' },
      { m: 560, dir: 'right', who: 'nova', text: 'Over the bells and down the far side. Back to the hills!' },
    ],
    'meadow-3': [
      { m: 380, dir: 'left', who: 'pip', text: 'The bridge is collapsing! Run back left - we take the ford!' },
      { m: 640, dir: 'right', who: 'nova', text: 'Ford crossed. Turn around, the hives are this way.' },
    ],
    'meadow-4': [
      { m: 480, dir: 'up', who: 'pip', text: 'Windmill updraft! Ride the wind up the ridge!' },
      { m: 820, dir: 'right', who: 'nova', text: 'Top of the ridge - and there is the boar\'s trail.' },
    ],
    'canyon-2': [
      { m: 420, dir: 'up', who: 'nova', text: 'The mesa wall. The road is up top - climb!' },
      { m: 680, dir: 'right', who: 'pip', text: 'Made it! Flat ground, my favourite kind of ground.' },
    ],
    'canyon-3': [
      { m: 330, dir: 'down', who: 'pip', text: 'Down the lava chimney! Mind the drips, they are VERY warm!' },
      { m: 680, dir: 'right', who: 'nova', text: 'Out at the bottom of the falls. Keep going!' },
    ],
    'canyon-4': [
      { m: 520, dir: 'left', who: 'pip', text: 'Magma flood ahead! Turn back left, there was a side tunnel!' },
      { m: 860, dir: 'right', who: 'nova', text: 'Through the tunnel and round the flood. Onward!' },
    ],
    'frost-2': [
      { m: 420, dir: 'down', who: 'nova', text: 'The ice cracked - we are going down the crevasse!' },
      { m: 720, dir: 'right', who: 'pip', text: 'A tunnel at the bottom! I knew that, I planned that.' },
    ],
    'frost-3': [
      { m: 520, dir: 'left', who: 'pip', text: 'The crystal bridge is shattering in front of us! Back left!' },
      { m: 870, dir: 'right', who: 'nova', text: 'The lower span holds. Turn round and cross!' },
    ],
    'frost-4': [
      { m: 460, dir: 'up', who: 'nova', text: 'Up the frozen waterfall, toward the lights!' },
      { m: 1000, dir: 'right', who: 'pip', text: 'The aurora is right above us. It is so pretty. Run!' },
    ],
    'neon-1': [
      { m: 480, dir: 'up', who: 'pip', text: 'Wall-run up the tower facade! The roofs are this way!' },
      { m: 800, dir: 'right', who: 'nova', text: 'Rooftops again. Now we fly.' },
    ],
    'neon-2': [
      { m: 460, dir: 'down', who: 'nova', text: 'Elevator shaft - drop down, the alley is below!' },
      { m: 760, dir: 'right', who: 'pip', text: 'Ground floor! Please mind the closing doors.' },
    ],
    'neon-3': [
      { m: 600, dir: 'left', who: 'pip', text: 'Wrong platform! The monorail goes the other way - run left!' },
      { m: 1000, dir: 'right', who: 'nova', text: 'Switched tracks. Full speed!' },
    ],
    'neon-4': [
      { m: 520, dir: 'up', who: 'nova', text: 'Lasers on the street - we take the wall!' },
      { m: 820, dir: 'down', who: 'pip', text: 'The Warden is on the roof... let\'s NOT go there yet. Down!' },
      { m: 1100, dir: 'right', who: 'nova', text: 'Back at street level, past the lasers.' },
    ],
    'rift-1': [
      { m: 420, dir: 'down', who: 'king', text: 'Fall, little courier. Fall forever.' },
      { m: 760, dir: 'right', who: 'nova', text: 'Nobody falls forever. Ground!' },
    ],
    'rift-2': [
      { m: 420, dir: 'up', who: 'pip', text: 'The isles are drifting upward - ride them!' },
      { m: 820, dir: 'right', who: 'nova', text: 'Solid rock. Mostly solid. Keep moving.' },
    ],
    'rift-3': [
      { m: 400, dir: 'left', who: 'pip', text: 'Everything is mirrored! Left is right and right is... also left!' },
      { m: 780, dir: 'up', who: 'nova', text: 'The mirror steps climb up. Follow them!' },
      { m: 1150, dir: 'right', who: 'pip', text: 'Out of the mirror. I feel very symmetrical.' },
    ],
    'rift-4': [
      { m: 480, dir: 'down', who: 'king', text: 'The ground is mine to take away.' },
      { m: 880, dir: 'left', who: 'pip', text: 'The path loops back - left, left, LEFT!' },
      { m: 1250, dir: 'right', who: 'nova', text: 'The Beacon\'s light is ahead. Last stretch!' },
    ],
  };

  /* which way each guardian's set-piece runs (Boss Rush keeps it too) and the line that opens it */
  const BOSS_DIRS = { boar: 'right', wyrm: 'right', avalanche: 'down', warden: 'up', king: 'left' };
  const BOSS_TURN_LINES = {
    boar: { who: 'pip', text: 'Back on the farm road - and the boar is right behind!' },
    wyrm: { who: 'nova', text: 'Out onto the sand. Watch for the ripples!' },
    avalanche: { who: 'avalanche', text: 'Down the mountain face, courier. The snow is faster.' },
    warden: { who: 'warden', text: 'ASCEND THE SPIRE. CORRECTION AWAITS AT THE TOP.' },
    king: { who: 'king', text: 'I turn your world around. Run back into the dark.' },
  };

  /* lines for the seeded turns of Arcade, Featured, Zen and the Daily Run */
  const TURN_LINES = {
    up: [
      { who: 'pip', text: 'Wall ahead - up we go!' },
      { who: 'nova', text: 'Climbing. Do not look down, Pip.' },
      { who: 'pip', text: 'Updraft! Wheee!' },
    ],
    down: [
      { who: 'pip', text: 'Drop! Down the shaft!' },
      { who: 'nova', text: 'The road goes down. Way down.' },
      { who: 'pip', text: 'Falling with style!' },
    ],
    left: [
      { who: 'pip', text: 'Dead end - turn around!' },
      { who: 'nova', text: 'Path is out. Back the other way!' },
      { who: 'pip', text: 'Left! The other left!' },
    ],
    right: [
      { who: 'nova', text: 'Back on the straight.' },
      { who: 'pip', text: 'Flat ground again. Bliss.' },
      { who: 'nova', text: 'There is the road. Go!' },
    ],
  };

  Object.assign(NS.story, {
    CAST, CINEMATICS, TURNS, BOSS_DIRS, BOSS_TURN_LINES, TURN_LINES
  });
})();
