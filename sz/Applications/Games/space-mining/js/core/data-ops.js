/* Static operation data: the moods an operation is meant to strike, the loop each belt adds,
   and the operations of every belt in the order they open - objectives, time limit, the
   threats the pacing director sends, the beats of its timeline and the first-clear reward.
   The last operation of a belt is its capstone and opens the next licence (the Void Crown's
   ends the career). allies: allied stations to protect; fronts: faction groups arriving from the
   rim on a schedule (at: 'ally' sends them at a station); feud: factions fight each other.
   Pure data. */
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
       stat (rise of career statistics, summed), record (a career statistic reached),
       deliver (freighters docked at their post), waves (repelled this trip), outpost (a finished
       hub), build (finished buildings, of: types or cat: a build category), clean (the
       outbreak the operation started is over), raze (Syndicate structures or craft of the
       types destroyed), scout (a Syndicate base found), repel (attack groups wiped out)
     time: seconds (0 = none); threat: pirate kinds by weight, first wave, seconds between
       waves, wave size and the most pirates at once; beats: [seconds, beat] from the start;
     force: specials laid out for the operation (storm: seconds until a storm is warned);
     convoy: freighters - fee per full delivery, losses allowed, the schedule (where each goes,
       when it undocks, need: a stop at a share of the lane for n of the belt's commonest ore),
       the ambush at choke points per lane (kinds, size, chokes, lead: an armoured leader) and
       wing: the hired wing flies along (it does on every convoy once 'wing' is unlocked);
     waves: the outpost's waves in the operation - from (the wave strength its first wave
       has, the ones after it count up from there), first (seconds until the first), every
       (between waves), mul (budget), favor (invaders to lead with), split (two bearings),
       boss (the wave of the trip that brings the mothership), nano (the Lattice's share of the
       waves, 0 keeps it out), spores: false (the Bloom has not
       reached the outpost: no spores from bites, belt outbreaks or cargo yet);
     force.outbreak: seconds until an outbreak in a crew building; force.radiation: { at, n }
       radiation clouds that drift over the outpost;
     waves.off: no invader waves (the Syndicate is the threat); keep: losing the outpost fails it;
     syndicate: the bases - where (far, far2, mid), build order, factory mix, credits, the
       structures standing at the start, guards, attack groups (first, every, size), haulers
       (first, every, max), toward: 'mid' reaches for the fields between - and escape: the
       haulers that may get away before it fails;
     reward: credits, research, unlock ids */
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
      threat: { kinds: { skimmer: 3, raider: 2 }, first: 35, every: 30, size: [2, 4], cap: 8 },
      beats: [[0, 'build'], [110, 'peak'], [190, 'relief'], [250, 'surprise'], [320, 'peak'], [420, 'relief']],
      reward: { cr: 1500, rd: 6 } },

    /* the Amber Reach: escort */
    { id: 'a_first', zone: 'amber', name: 'One Freighter', mood: 'C', time: 0,
      brief: 'A freighter leaves the dock for the nearest trading post. Its lane is marked - pirates wait at a choke point along it. Fly with it and keep them off until it docks.',
      goals: [{ type: 'deliver', n: 1, text: 'Deliver freighters' }],
      convoy: { fee: 600, loss: 0, list: [{ to: 'near', at: 6 }], ambush: { kinds: { skimmer: 1 }, size: [2, 2], chokes: 1 } },
      reward: { cr: 1200, rd: 4 } },
    { id: 'a_long', zone: 'amber', name: 'Courier Run', mood: 'E', time: 0,
      brief: 'A courier with sealed cargo flies the long lane at well over twice a freighter\'s speed and waits for no one. Keep up - it takes speed and fuel - and swat the fast skimmers sent after it.',
      goals: [{ type: 'deliver', n: 1, text: 'Deliver the courier' }],
      convoy: { fee: 900, loss: 0, list: [{ to: 'far', at: 6, speed: 2.4 }], ambush: { kinds: { skimmer: 2, raider: 0.5 }, size: [1, 2], chokes: 1 } },
      reward: { cr: 1400, rd: 4 } },
    { id: 'a_storm', zone: 'amber', name: 'Glass Cargo', mood: 'S', time: 0,
      brief: 'A freighter with a cracked hull - one more hit and it breaks apart - has to cross a solar storm. Any bolt, blast or mine destroys it: kill the raiders before they open fire.',
      goals: [{ type: 'deliver', n: 1, text: 'Deliver the cracked freighter' }],
      force: { storm: 26 },
      convoy: { fee: 1100, loss: 0, list: [{ to: 'far', at: 6, hp: 1 }], ambush: { kinds: { skimmer: 3, raider: 1 }, size: [2, 3], chokes: 2 } },
      reward: { cr: 1700, rd: 5 } },
    { id: 'a_twin', zone: 'amber', name: 'Pirate Tide', mood: 'H', time: 0,
      brief: 'Two freighters on one lane, and the whole pirate clan is out: every ambush is a swarm of skimmers. Wide guns pay off - and every skimmer you miss drains a hold.',
      goals: [{ type: 'deliver', n: 2, text: 'Deliver freighters' }],
      convoy: { fee: 1000, loss: 0, list: [{ to: 'far', at: 6 }, { to: 'far', at: 10 }], ambush: { kinds: { skimmer: 6, raider: 1 }, size: [8, 10], chokes: 1 } },
      threat: { kinds: { skimmer: 1 }, first: 50, every: 45, size: [2, 3], cap: 12 },
      beats: [[0, 'build'], [40, 'peak'], [80, 'relief']],
      reward: { cr: 2200, rd: 5 } },
    { id: 'a_wing', zone: 'amber', name: 'Hired Wing', mood: 'E', time: 0,
      brief: 'The guild lends you two fighters. They guard you and dive on whatever attacks a freighter - and once this run is done they fly with every convoy.',
      goals: [{ type: 'deliver', n: 1, text: 'Deliver freighters' }],
      convoy: { fee: 1000, loss: 0, wing: true, list: [{ to: 'side', at: 6 }], ambush: { kinds: { skimmer: 1, raider: 2 }, size: [3, 3], chokes: 2 } },
      reward: { cr: 1500, rd: 4, unlock: ['wing'] } },
    { id: 'a_convoy', zone: 'amber', name: 'Gun Run', mood: 'H', time: 0,
      brief: 'The long lane runs past a pirate outpost: three gun batteries stand beside it and shell anything in reach. Three freighters leave late - raze the guns before they pass, or lose them on the way.',
      goals: [{ type: 'deliver', n: 2, text: 'Deliver freighters' }],
      convoy: { fee: 900, loss: 1, battery: { n: 3 }, list: [{ to: 'far', at: 28 }, { to: 'far', at: 40 }, { to: 'far', at: 52 }], ambush: { kinds: { skimmer: 2, raider: 1 }, size: [1, 2], chokes: 1 } },
      threat: { kinds: { skimmer: 1, raider: 1 }, first: 60, every: 45, size: [1, 2], cap: 6 },
      beats: [[0, 'build'], [50, 'peak'], [95, 'relief']],
      reward: { cr: 2600, rd: 6 } },
    { id: 'a_three', zone: 'amber', name: 'Three Directions', mood: 'W', time: 0,
      brief: 'Three freighters twelve seconds apart, three posts, and a Jammer leads every ambush: its beam stops a freighter dead while it stays close. The guild wants all three - none may be lost.',
      goals: [{ type: 'deliver', n: 3, text: 'Deliver freighters' }],
      convoy: { fee: 1000, loss: 0, list: [{ to: 'near', at: 6 }, { to: 'opp', at: 18 }, { to: 'side', at: 30 }], ambush: { kinds: { skimmer: 1, raider: 2 }, size: [2, 3], chokes: 1, lead: 'jammer' } },
      threat: { kinds: { skimmer: 2, raider: 1 }, first: 50, every: 40, size: [1, 2], cap: 8 },
      beats: [[0, 'build'], [35, 'peak'], [75, 'surprise'], [110, 'relief']],
      reward: { cr: 3000, rd: 7 } },
    { id: 'a_order', zone: 'amber', name: 'Reactor Trouble', mood: 'S', time: 0,
      brief: 'The freighter limps out with a failing reactor. Halfway it will stop and ask for ore to patch it - bring the belt\'s commonest ore alongside, slowly.',
      goals: [{ type: 'deliver', n: 1, text: 'Deliver freighters' }],
      convoy: { fee: 1200, loss: 0, list: [{ to: 'far', at: 6, need: { at: 0.45, n: 15 } }], ambush: { kinds: { skimmer: 2, raider: 1 }, size: [2, 3], chokes: 1 } },
      threat: { kinds: { skimmer: 1, raider: 1 }, first: 60, every: 40, size: [1, 2], cap: 5 },
      reward: { cr: 2000, rd: 5 } },
    { id: 'a_haul', zone: 'amber', name: 'Long Haul', mood: 'N', time: 0, capstone: true,
      brief: 'The charter for the Verdant Shoals rides on one run: four freighters to all four posts, a storm front on the way, gunships in the ambushes and Minelayers seeding the lanes ahead. Lose one at most.',
      goals: [{ type: 'deliver', n: 3, text: 'Deliver freighters' }],
      force: { storm: 70 },
      convoy: { fee: 1200, loss: 1, list: [{ to: 'near', at: 6 }, { to: 'far', at: 18 }, { to: 'opp', at: 30 }, { to: 'side', at: 42 }],
        ambush: { kinds: { skimmer: 2, raider: 2, layer: 0.7, gunship: 0.4 }, size: [2, 3], chokes: 1 } },
      threat: { kinds: { skimmer: 1, raider: 2, gunship: 1 }, first: 70, every: 36, size: [2, 3], cap: 9 },
      beats: [[0, 'build'], [45, 'peak'], [90, 'relief'], [120, 'surprise'], [160, 'peak'], [210, 'relief']],
      reward: { cr: 5000, rd: 10 } },

    /* the Verdant Shoals: the outpost and tower defense */
    { id: 'v_found', zone: 'verdant', name: 'Found the Outpost', mood: 'C', time: 0,
      brief: 'The Shoals have no iron to speak of - bring bars from the station (the Supply tab and the manifest) or order a supply freighter. Found a hub on the site, put up two turrets and hold the first wave.',
      goals: [{ type: 'outpost', n: 1, text: 'Found the outpost' }, { type: 'build', cat: 'defense', n: 2, text: 'Finish turrets' }, { type: 'waves', n: 1, text: 'Hold waves' }],
      waves: { from: 1, nano: 0, spores: false, first: 100, every: 100 },
      reward: { cr: 2500, rd: 6 } },
    { id: 'v_hold', zone: 'verdant', name: 'Hold the Line', mood: 'E', time: 0,
      brief: 'Raiders and swarms have found the outpost. Four waves, one after another - the turrets do the work, you fill the gaps.',
      goals: [{ type: 'waves', n: 4, text: 'Hold waves' }],
      waves: { from: 2, nano: 0, spores: false, first: 50, every: 75 },
      reward: { cr: 2600, rd: 6 } },
    { id: 'v_rad', zone: 'verdant', name: 'Radiation Season', mood: 'S', time: 0,
      brief: 'The shoals\' sun flares: radiation clouds drift over the outpost and slow every plant a powered shield dome does not cover. The smelters still owe twenty bars - and the waves keep coming.',
      goals: [{ type: 'stat', stats: ['bars'], n: 20, text: 'Smelt bars at the outpost' }, { type: 'waves', n: 2, text: 'Hold waves' }],
      force: { radiation: { at: 20, n: 3 } },
      waves: { from: 4, nano: 0, spores: false, first: 70, every: 85 },
      reward: { cr: 2800, rd: 7 } },
    { id: 'v_bloom', zone: 'verdant', name: 'First Bloom', mood: 'H', time: 0,
      brief: 'A crew building has caught the Bloom. Quarantine, sterilise, a medical bay or purge tenders - end the outbreak before it spreads, while three waves come in.',
      goals: [{ type: 'clean', n: 1, text: 'End the outbreak' }, { type: 'waves', n: 3, text: 'Hold waves' }],
      force: { outbreak: 25 },
      waves: { from: 5, nano: 0, first: 60, every: 75 },
      reward: { cr: 3000, rd: 7 } },
    { id: 'v_siege', zone: 'verdant', name: 'Siege Breakers', mood: 'H', time: 0,
      brief: 'Bombers and siege ships lead the waves now - armour that shrugs off lasers and guns that outrange them. Flak and missiles, walls of buildings, and your ship on the siege ships.',
      goals: [{ type: 'build', of: ['flak', 'missile'], n: 2, text: 'Finish flak or missiles' }, { type: 'waves', n: 3, text: 'Hold waves' }],
      waves: { from: 5, nano: 0, first: 60, every: 75, favor: ['bomber', 'siege'], mul: 0.8 },
      reward: { cr: 3200, rd: 8 } },
    { id: 'v_split', zone: 'verdant', name: 'Split Front', mood: 'W', time: 0,
      brief: 'The raiders have learned: every wave now splits and strikes from two bearings at once. Watch the minimap and cover both sides.',
      goals: [{ type: 'waves', n: 5, text: 'Hold waves' }],
      waves: { from: 6, nano: 0, first: 50, every: 65, split: true, mul: 1.15 },
      reward: { cr: 3800, rd: 9 } },
    { id: 'v_supply', zone: 'verdant', name: 'Supply Run', mood: 'S', time: 0,
      brief: 'Two supply freighters are on their way to your hub - through an ambush, while the waves keep coming. Their cargo is yours if they make it.',
      goals: [{ type: 'deliver', n: 2, text: 'Bring the freighters in' }, { type: 'waves', n: 2, text: 'Hold waves' }],
      convoy: { fee: 0, loss: 0, list: [{ to: 'hub', at: 10, pack: 'mix' }, { to: 'hub', at: 45, pack: 'iron' }], ambush: { kinds: { skimmer: 2, raider: 2 }, size: [2, 3], chokes: 1 } },
      waves: { from: 7, nano: 0, first: 40, every: 75 },
      reward: { cr: 3200, rd: 7 } },
    { id: 'v_mother', zone: 'verdant', name: 'Mothership', mood: 'N', time: 0, capstone: true,
      brief: 'The hive has tracked the outpost. Two waves to dig in - the third brings the mothership, its broods and its guns. Bring it down and the Crimson Maw charter is yours.',
      goals: [{ type: 'stat', stats: ['bosses'], n: 1, text: 'Destroy the mothership' }],
      waves: { from: 8, nano: 0, first: 60, every: 75, boss: 3 },
      reward: { cr: 6000, rd: 12 } },

    /* the Crimson Maw: the Syndicate (its bases replace the invader waves) */
    { id: 'c_scout', zone: 'crimson', name: 'Scout the Syndicate', mood: 'C', time: 0,
      brief: 'A Syndicate base is mining the far side of the Maw. Find it, and take out two of its harvesters - mind the Stalkers: turrets cannot see them until something comes close.',
      goals: [{ type: 'scout', n: 1, text: 'Find the base' }, { type: 'raze', of: ['syn_harvester'], n: 2, text: 'Raze harvesters' }],
      waves: { off: true },
      syndicate: { bases: [{ at: 'far', order: 'outpost', mix: 'light', credits: 0, start: ['syn_harvester', 'syn_harvester', 'syn_harvester'], guards: { stalker: 2, syn_fighter: 1 } }] },
      reward: { cr: 3000, rd: 7 } },
    { id: 'c_raid', zone: 'crimson', name: 'Harvester Raid', mood: 'E', time: 0,
      brief: 'Their income runs on harvesters. Burn four of them - in and out before the factory has a fleet.',
      goals: [{ type: 'raze', of: ['syn_harvester'], n: 4, text: 'Raze harvesters' }],
      waves: { off: true },
      syndicate: { bases: [{ at: 'far', order: 'outpost', mix: 'light', credits: 100, start: ['syn_harvester', 'syn_harvester', 'syn_harvester', 'syn_tower'], guards: { syn_fighter: 3 },
        attack: { first: 240, every: 150, size: 4 } }] },
      reward: { cr: 3200, rd: 7 } },
    { id: 'c_counter', zone: 'crimson', name: 'Counter-Attack', mood: 'S', time: 0, keep: true,
      brief: 'The Syndicate wants the Maw to itself. Found an outpost and hold it: three attack groups are coming - turrets, your ship and your fleet against their fighters and Juggernauts.',
      goals: [{ type: 'outpost', n: 1, text: 'Found the outpost' }, { type: 'repel', n: 3, text: 'Repel attack groups' }],
      waves: { off: true },
      syndicate: { bases: [{ at: 'far', order: 'standard', mix: 'standard', credits: 400, start: ['syn_harvester', 'syn_harvester', 'syn_tower', 'syn_factory', 'syn_factory'],
        attack: { first: 170, every: 110, size: 5 } }] },
      reward: { cr: 3600, rd: 8 } },
    { id: 'c_lattice', zone: 'crimson', name: 'Lattice Outpost', mood: 'H', time: 0,
      brief: 'One Syndicate base has gone silent - the Lattice runs it now, and its factories spit nanoprobes that corrupt what they touch. Raze its core.',
      goals: [{ type: 'raze', of: ['syn_core'], n: 1, text: 'Raze the core' }],
      waves: { off: true },
      syndicate: { bases: [{ at: 'far', order: 'standard', mix: 'lattice', credits: 300, start: ['syn_harvester', 'syn_harvester', 'syn_tower', 'syn_tower', 'syn_factory'],
        guards: { nanodrone: 4, nanoswarm: 2 }, attack: { first: 140, every: 100, size: 6 } }] },
      reward: { cr: 4000, rd: 9 } },
    { id: 'c_expand', zone: 'crimson', name: 'Contested Deposits', mood: 'H', time: 600,
      brief: 'The Syndicate is reaching for the fields between you, relay by relay. Raze three relays and three harvesters in ten minutes before it holds the Maw.',
      goals: [{ type: 'raze', of: ['syn_relay'], n: 3, text: 'Raze relays' }, { type: 'raze', of: ['syn_harvester'], n: 3, text: 'Raze harvesters' }],
      waves: { off: true },
      syndicate: { bases: [{ at: 'far', order: 'expand', mix: 'standard', credits: 900, toward: 'mid', start: ['syn_harvester', 'syn_tower', 'syn_factory'],
        attack: { first: 200, every: 120, size: 5 } }] },
      reward: { cr: 4200, rd: 9 } },
    { id: 'c_twin', zone: 'crimson', name: 'Two Fronts', mood: 'W', time: 0,
      brief: 'Two bases, two factories feeding attack groups, batteries that outrange your turrets. Raze both cores.',
      goals: [{ type: 'raze', of: ['syn_core'], n: 2, text: 'Raze the cores' }],
      waves: { off: true },
      syndicate: { bases: [
        { at: 'far', order: 'standard', mix: 'standard', credits: 300, start: ['syn_harvester', 'syn_harvester', 'syn_tower', 'syn_factory', 'syn_battery'], attack: { first: 180, every: 130, size: 5 } },
        { at: 'far2', order: 'standard', mix: 'standard', credits: 300, start: ['syn_harvester', 'syn_harvester', 'syn_tower', 'syn_factory', 'syn_battery'], attack: { first: 240, every: 130, size: 5 } }] },
      reward: { cr: 5200, rd: 10 } },
    { id: 'c_freight', zone: 'crimson', name: 'Cut Their Freighters', mood: 'S', time: 0,
      brief: 'The Syndicate ships its ore out in haulers. Shoot down five of them - if four get away the run is lost.',
      goals: [{ type: 'raze', of: ['hauler'], n: 5, text: 'Shoot down haulers' }],
      waves: { off: true },
      syndicate: { escape: 4, bases: [{ at: 'far', order: 'standard', mix: 'standard', credits: 300, start: ['syn_harvester', 'syn_harvester', 'syn_harvester', 'syn_tower', 'syn_tower', 'syn_factory'],
        guards: { syn_fighter: 4 }, haul: { first: 25, every: 35, max: 14 }, attack: { first: 300, every: 150, size: 5 } }] },
      reward: { cr: 4000, rd: 8 } },
    { id: 'c_citadel', zone: 'crimson', name: 'Syndicate Citadel', mood: 'N', time: 0, capstone: true,
      brief: 'The Syndicate\'s heart: a shielded citadel behind shield pylons and artillery, Juggernauts at the gate. Break the pylons, silence the batteries, raze the citadel - and the Void Crown is open.',
      goals: [{ type: 'raze', of: ['citadel'], n: 1, text: 'Raze the citadel' }],
      waves: { off: true },
      syndicate: { bases: [{ at: 'far', citadel: true, order: 'fortress', mix: 'heavy', credits: 1500, start: ['syn_pylon', 'syn_pylon', 'syn_battery', 'syn_battery', 'syn_tower', 'syn_tower', 'syn_tower', 'syn_factory', 'syn_harvester', 'syn_harvester'],
        guards: { juggernaut: 2, syn_fighter: 4 }, attack: { first: 200, every: 120, size: 6 } }] },
      reward: { cr: 8000, rd: 14 } },

    /* the Void Crown: everything at once - allied stations, three feuding factions, the Crown */
    { id: 'vc_hunt', zone: 'void', name: 'Void Crystals', mood: 'C', time: 0,
      brief: 'The crystal that sings: bank 24 void crystals from the rim rocks - while hunters stalk your ship from the dark.',
      goals: [{ type: 'ore', ore: 'voidCrystal', n: 24, text: 'Bank void crystals' }],
      threat: { kinds: { raider: 2, gunship: 1 }, first: 45, every: 40, size: [2, 3], cap: 7 },
      beats: [[0, 'build'], [60, 'peak'], [120, 'relief']],
      reward: { cr: 6000, rd: 10 } },
    { id: 'vc_ally', zone: 'void', name: 'Protect Friends', mood: 'H', time: 0,
      brief: 'A free miners\' station at the rim is under siege by the Hive. Hold out four minutes with it standing - its guns help, but it cannot stand alone.',
      goals: [{ type: 'hold', n: 240, text: 'Hold out (seconds)' }],
      waves: { off: true },
      allies: [{ hp: 3200, name: 'Freehold Station' }],
      fronts: [{ faction: 'alien', kinds: { swarmer: 6, carrier: 0.3 }, first: 20, every: 38, size: [6, 9], at: 'ally' }],
      reward: { cr: 6500, rd: 10 } },
    { id: 'vc_base', zone: 'void', name: 'Build Base', mood: 'E', time: 0,
      brief: 'Plant a flag in the Void: found an outpost, finish three turrets and hold the first wave.',
      goals: [{ type: 'outpost', n: 1, text: 'Found the outpost' }, { type: 'build', cat: 'defense', n: 3, text: 'Finish turrets' }, { type: 'waves', n: 1, text: 'Hold waves' }],
      waves: { from: 2, nano: 0, spores: false, first: 120, every: 110 },
      reward: { cr: 6000, rd: 10 } },
    { id: 'vc_front', zone: 'void', name: 'Base and Haulers', mood: 'W', time: 0,
      brief: 'A Syndicate base strips the Void and ships the crystal out. Raze its core - and if five of its haulers get away, the run is lost.',
      goals: [{ type: 'raze', of: ['syn_core'], n: 1, text: 'Raze the core' }],
      waves: { off: true },
      syndicate: { escape: 5, bases: [{ at: 'far', order: 'standard', mix: 'standard', credits: 400, start: ['syn_harvester', 'syn_harvester', 'syn_harvester', 'syn_tower', 'syn_tower', 'syn_factory', 'syn_battery'],
        guards: { syn_fighter: 3, stalker: 1 }, haul: { first: 30, every: 32, max: 16 }, attack: { first: 200, every: 140, size: 5 } }] },
      reward: { cr: 7500, rd: 12 } },
    { id: 'vc_survivors', zone: 'void', name: 'Survivors', mood: 'S', time: 0,
      brief: 'Two freighters of survivors from a silent station must reach the far posts - through Lattice space. Its drones wait along the lanes.',
      goals: [{ type: 'deliver', n: 2, text: 'Deliver the survivors' }],
      convoy: { fee: 1500, loss: 0, list: [{ to: 'far', at: 6 }, { to: 'side', at: 14 }], ambush: { kinds: { nanodrone: 3, nanoswarm: 1 }, size: [3, 4], chokes: 2 } },
      reward: { cr: 7000, rd: 11 } },
    { id: 'vc_war', zone: 'void', name: 'Three-Front War', mood: 'H', time: 0,
      brief: 'The Syndicate is dug in, the Hive and the Lattice come in from the rim - and all three hate each other as much as you. Raze the Syndicate core and hold out five minutes.',
      goals: [{ type: 'raze', of: ['syn_core'], n: 1, text: 'Raze the core' }, { type: 'hold', n: 300, text: 'Hold out (seconds)' }],
      waves: { off: true },
      feud: true,
      syndicate: { bases: [{ at: 'far', order: 'standard', mix: 'standard', credits: 500, start: ['syn_harvester', 'syn_harvester', 'syn_tower', 'syn_tower', 'syn_factory', 'syn_battery'],
        guards: { syn_fighter: 4, juggernaut: 1 }, attack: { first: 160, every: 120, size: 6 } }] },
      fronts: [{ faction: 'alien', kinds: { swarmer: 6, carrier: 0.4 }, first: 40, every: 55, size: [6, 9] },
        { faction: 'lattice', kinds: { nanodrone: 3, nanoswarm: 1 }, first: 70, every: 60, size: [4, 6] }],
      reward: { cr: 9000, rd: 14 } },
    { id: 'vc_crown', zone: 'void', name: 'The Crown', mood: 'N', time: 0, capstone: true,
      brief: 'At the heart of the Void the Crown sings. Shatter it - while the Syndicate, the Hive and the Lattice all converge on you and the last free station.',
      goals: [{ type: 'crown', n: 1, text: 'Shatter the Crown Heart' }],
      waves: { off: true },
      feud: true,
      allies: [{ hp: 4000, name: 'Last Light Station' }],
      fronts: [{ faction: 'syndicate', kinds: { syn_fighter: 3, juggernaut: 1 }, first: 30, every: 60, size: [3, 5] },
        { faction: 'alien', kinds: { swarmer: 6, carrier: 0.4 }, first: 50, every: 55, size: [6, 9], at: 'ally' },
        { faction: 'lattice', kinds: { nanodrone: 3, nanoswarm: 1 }, first: 70, every: 60, size: [4, 6] }],
      reward: { cr: 15000, rd: 20 } },
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
