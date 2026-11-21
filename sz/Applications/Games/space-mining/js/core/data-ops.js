/* Static operation data: the moods an operation is meant to strike, the loop each belt adds,
   and the operations of every belt in the order they open - objectives, time limit, the
   threats the pacing director sends, the beats of its timeline and the first-clear reward.
   The last operation of a belt is its capstone and opens the next licence. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  /* peak: a high point of the belt's curve (never two in a row) */
  const MOODS = {
    C: { name: 'Challenging', color: '#ffd25a' },
    E: { name: 'Breather', color: '#5cff9a' },
    S: { name: 'Surprise', color: '#7cf0ff' },
    H: { name: 'Harder', color: '#ffb44a' },
    W: { name: 'Worse than you think', color: '#ff6a5c', peak: true },
    N: { name: 'Nightmare', color: '#d050ff', peak: true },
  };

  /* the loop each belt adds (by belt index); a belt allows every loop up to its own */
  const LOOPS = [
    { id: 'mining', name: 'Mining', from: 0 },
    { id: 'escort', name: 'Escort', from: 1 },
    { id: 'outpost', name: 'Outposts', from: 2 },
    { id: 'warfare', name: 'Warfare', from: 3 },
    { id: 'all', name: 'Everything', from: 4 },
  ];

  /* goals: bank (units banked), ore (units of one ore banked), value (credits' worth banked),
       stat (rise of career statistics, summed), record (a career statistic reached)
     time: seconds (0 = none); threat: pirate kinds by weight, first wave, seconds between
       waves, wave size and the most pirates at once; beats: [seconds, beat] from the start;
     force: specials laid out for the operation; reward: credits, research, unlock ids */
  const OPS = [
    { id: 'k_haul', zone: 'kessler', name: 'First Haul', mood: 'C', time: 0,
      brief: 'Kessler Station buys anything you bring. Laser rocks until they crack, reel the ore in with the tractor and bank 60 units at the dock.',
      goals: [{ type: 'bank', n: 60, text: 'Bank ore at the dock' }],
      reward: { cr: 300, rd: 3 } },
    { id: 'k_copper', zone: 'kessler', name: 'Copper Contract', mood: 'E', time: 0,
      brief: 'The wire mills are short of copper. The orange-veined rocks carry it - bank 25 copper.',
      goals: [{ type: 'ore', ore: 'copper', n: 25, text: 'Bank copper' }],
      reward: { cr: 500, rd: 3 } },
    { id: 'k_drones', zone: 'kessler', name: 'Drone Bay', mood: 'E', time: 0,
      brief: 'Let a drone do the drilling. Research Drone Protocols in the tech tree (or buy a Drone Bay), take it along and bank 120 units while it hauls.',
      goals: [{ type: 'record', stat: 'maxDrones', n: 1, text: 'Fly with a mining drone' }, { type: 'bank', n: 120, text: 'Bank ore at the dock' }],
      reward: { cr: 700, rd: 3 } },
    { id: 'k_geode', zone: 'kessler', name: 'Geode Hunt', mood: 'S', time: 0,
      brief: 'Survey pings found hollow rocks and a dead freighter far from the dock - they are marked on your radar. Find them and crack two.',
      goals: [{ type: 'stat', stats: ['geodes', 'derelicts'], n: 2, text: 'Crack geodes or derelicts' }],
      force: { geode: 2, derelict: 1 },
      reward: { cr: 900, rd: 4 } },
    { id: 'k_jumpers', zone: 'kessler', name: 'Claim Jumpers', mood: 'H', time: 420,
      brief: 'Skimmers are stealing from the miners. They come in packs - turn the laser on them (Space locks it on) and shoot down fourteen before they scatter.',
      goals: [{ type: 'stat', stats: ['pirates'], n: 14, text: 'Shoot down pirates' }],
      threat: { kinds: { skimmer: 2, raider: 2 }, first: 15, every: 30, size: [2, 4], cap: 8 },
      beats: [[0, 'build'], [140, 'peak'], [230, 'relief'], [290, 'peak'], [380, 'relief']],
      reward: { cr: 1000, rd: 4, unlock: ['w_pulse'] } },
    { id: 'k_charter', zone: 'kessler', name: 'Kessler Charter', mood: 'W', time: 480, capstone: true,
      brief: 'The charter board wants proof before it licenses the Amber Reach: bank ore worth 3,000 credits in eight minutes - while claim jumpers raid the lanes.',
      goals: [{ type: 'value', n: 3000, text: 'Bank ore worth credits' }],
      threat: { kinds: { skimmer: 3, raider: 2 }, first: 40, every: 38, size: [2, 4], cap: 8 },
      beats: [[0, 'build'], [110, 'peak'], [190, 'relief'], [250, 'surprise'], [320, 'peak'], [420, 'relief']],
      reward: { cr: 1500, rd: 6 } },
  ];

  const OP_BY_ID = {};
  for (let i = 0; i < OPS.length; ++i) {
    OPS[i].index = i;
    OP_BY_ID[OPS[i].id] = OPS[i];
  }

  Object.assign(NS.opsData, {
    MOODS, LOOPS, OPS, OP_BY_ID
  });
})();
