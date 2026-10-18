/* Static campaign data: five sectors (art theme, enemy roster, hazards), six missions each with
   type, briefing and parameters, the six mission types and the four play modes. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});

  /* theme: backdrop painting recipe (see render/backdrop-art.js) */
  const SECTORS = [
    {
      id: 'kepler', name: 'Kepler Reach', blurb: 'A frontier asteroid belt where the raiders first struck.',
      roster: ['fighter', 'interceptor', 'drone', 'turret'], boss: 'warden', size: 3400,
      hazards: { rocks: 26, mines: 0, nebulae: 0, hole: false, flares: false },
      theme: {
        base: '#03060f', neb: ['#0e2a5a', '#1f5fa8', '#3fb0e0', '#9be8ff'], neb2: ['#251246', '#5a2a8a'],
        planet: { x: 0.82, y: 0.26, r: 150, a: '#2d7fb8', b: '#0c2a4a', c: '#9fe0ff', ring: true, bands: 0.25, atmo: '#7fd4ff' },
        moon: { x: 0.18, y: 0.72, r: 46, a: '#b8b0a4', b: '#3a3632' },
        dust: '#9fc8ff', star: '#dfeaff', accent: '#4fc3ff',
      },
    },
    {
      id: 'crimson', name: 'Crimson Expanse', blurb: 'Red nebulae hide minefields and the Hydra\'s brood.',
      roster: ['fighter', 'interceptor', 'drone', 'bomber', 'frigate'], boss: 'hydra', size: 3600,
      hazards: { rocks: 12, mines: 18, nebulae: 5, hole: false, flares: false },
      theme: {
        base: '#0a0306', neb: ['#3a0812', '#8a1a2a', '#e0503a', '#ffb08a'], neb2: ['#2a0a3a', '#6a1a5a'],
        planet: { x: 0.18, y: 0.24, r: 170, a: '#c0502a', b: '#3a0e08', c: '#ffc08a', ring: false, bands: 0.9, atmo: '#ff8a5a' },
        moon: { x: 0.84, y: 0.78, r: 38, a: '#c8a090', b: '#40241c' },
        dust: '#ffb0a0', star: '#ffe6dc', accent: '#ff6a5c',
      },
    },
    {
      id: 'helios', name: 'Helios Corona', blurb: 'Fighting in the glare of a dying star. Watch for flares.',
      roster: ['fighter', 'interceptor', 'bomber', 'frigate', 'lancer', 'turret'], boss: 'solaris', size: 3600,
      hazards: { rocks: 18, mines: 0, nebulae: 0, hole: false, flares: true },
      theme: {
        base: '#0c0602', neb: ['#3a1a04', '#a04a0a', '#ffa030', '#fff0b0'], neb2: ['#3a0a04', '#802010'],
        sun: { x: 0.9, y: 0.1, r: 240, a: '#fff6d0', b: '#ffb030', c: '#ff5010' },
        planet: { x: 0.14, y: 0.82, r: 90, a: '#6a4a3a', b: '#1a0e08', c: '#ffd0a0', ring: false, bands: 0.4, atmo: '#ffa060' },
        dust: '#ffd8a0', star: '#fff2d8', accent: '#ffb347',
      },
    },
    {
      id: 'abyss', name: 'Abyss Rift', blurb: 'A black hole bends light and ships alike.',
      roster: ['fighter', 'interceptor', 'drone', 'cloaker', 'lancer', 'carrier'], boss: 'maw', size: 3800,
      hazards: { rocks: 10, mines: 14, nebulae: 2, hole: true, flares: false },
      theme: {
        base: '#020206', neb: ['#0a0a2a', '#1a2a6a', '#2ad0c0', '#c0fff0'], neb2: ['#200a3a', '#5a1a8a'],
        hole: { x: 0.62, y: 0.42, r: 120, disc: '#ffb070', glow: '#6ad0ff' },
        dust: '#a0e8ff', star: '#e0f0ff', accent: '#2ad0c0',
      },
    },
    {
      id: 'void', name: 'Void Citadel', blurb: 'The enemy homeworld. Everything they have is here.',
      roster: ['fighter', 'interceptor', 'drone', 'bomber', 'frigate', 'cloaker', 'lancer', 'carrier'], boss: 'overmind', size: 4000,
      hazards: { rocks: 14, mines: 12, nebulae: 4, hole: false, flares: false },
      theme: {
        base: '#05020a', neb: ['#1a0832', '#5a1a8a', '#b04aff', '#7affc0'], neb2: ['#0a2a2a', '#1a6a5a'],
        planet: { x: 0.84, y: 0.7, r: 150, a: '#3a1a5a', b: '#0a0414', c: '#b07aff', ring: true, bands: 0.6, atmo: '#c070ff' },
        citadel: true,
        dust: '#d0b0ff', star: '#f0e6ff', accent: '#b066ff',
      },
    },
  ];

  const MISSION_TYPES = {
    survive: { name: 'Survival', icon: 'clock', goal: 'Survive until the timer runs out.' },
    destroy: { name: 'Assault', icon: 'target', goal: 'Destroy every enemy outpost.' },
    escort: { name: 'Escort', icon: 'convoy', goal: 'Keep the freighter alive until it reaches the jump gate.' },
    defend: { name: 'Defense', icon: 'shield', goal: 'Protect the relay station until reinforcements arrive.' },
    collect: { name: 'Salvage', icon: 'core', goal: 'Hold position at every data core until it has downloaded.' },
    boss: { name: 'Boss', icon: 'skull', goal: 'Destroy the boss.' },
    endless: { name: 'Endless', icon: 'infinity', goal: 'Survive as many waves as you can.' },
  };

  /* six missions per sector; time = survive/defend seconds, n = outposts or cores, par = 3-star time */
  const MISSIONS = [
    [
      { name: 'First Contact', type: 'survive', time: 50, par: 50, brief: 'Raiders are probing the belt. Hold your ground and learn your ship.' },
      { name: 'Outpost Breaker', type: 'destroy', n: 2, par: 110, brief: 'Two raider outposts guard the mining lanes. Bring them down.' },
      { name: 'Data Salvage', type: 'collect', n: 6, par: 100, brief: 'A survey probe broke apart. Recover its data cores before the raiders do.' },
      { name: 'Convoy Run', type: 'escort', len: 2400, par: 70, brief: 'Escort the ore freighter Persephone to the jump gate.' },
      { name: 'Hold the Relay', type: 'defend', time: 65, par: 65, brief: 'Raiders want our comm relay dark. Keep it standing.' },
      { name: 'The Warden', type: 'boss', boss: 'warden', par: 120, brief: 'The raiders\' orbital bastion. Knock out its shield emitters to expose the core.' },
    ],
    [
      { name: 'Red Tide', type: 'survive', time: 60, par: 60, brief: 'Bombers move in under nebula cover. Survive the onslaught.' },
      { name: 'Silent Freight', type: 'escort', len: 2600, par: 80, brief: 'Guide a medical freighter through the minefield.' },
      { name: 'Nest Burners', type: 'destroy', n: 3, par: 130, brief: 'Three outposts are breeding swarmers. Burn them.' },
      { name: 'Lost in Red', type: 'collect', n: 7, par: 115, brief: 'Data cores drift inside the nebula clouds. Your radar is blind in there.' },
      { name: 'Last Light', type: 'defend', time: 70, par: 70, brief: 'Defend the lighthouse beacon until the fleet jumps in.' },
      { name: 'The Hydra', type: 'boss', boss: 'hydra', par: 140, brief: 'A serpent warship. Its head is armoured in front - strike from the side or behind.' },
    ],
    [
      { name: 'Corona Strike', type: 'destroy', n: 3, par: 130, brief: 'Outposts are harvesting the star. Destroy them; dodge-roll through solar flares.' },
      { name: 'Into the Glare', type: 'survive', time: 65, par: 65, brief: 'Lancers snipe from the glare. Keep moving.' },
      { name: 'Sunfire Cache', type: 'collect', n: 7, par: 110, brief: 'Recover the cores before the flares cook them.' },
      { name: 'Helios Station', type: 'defend', time: 75, par: 75, brief: 'Hold the research station through the storm.' },
      { name: 'Coronal Convoy', type: 'escort', len: 2800, par: 85, brief: 'Escort the tanker out of the corona.' },
      { name: 'Solaris', type: 'boss', boss: 'solaris', par: 160, brief: 'A sun-forged dreadnought. Destroy the rear shield generators first.' },
    ],
    [
      { name: 'Event Horizon', type: 'collect', n: 7, par: 120, brief: 'Cores orbit the black hole. Do not get pulled in.' },
      { name: 'Ghost Fleet', type: 'survive', time: 70, par: 70, brief: 'Phantoms hunt in cloak. Watch for the shimmer.' },
      { name: 'Gravity Well', type: 'escort', len: 2800, par: 90, brief: 'Slingshot the freighter past the singularity.' },
      { name: 'Carrier Group', type: 'destroy', n: 3, par: 140, brief: 'Outposts and carriers anchor the rift. Break them.' },
      { name: 'Rift Watch', type: 'defend', time: 80, par: 80, brief: 'Keep the gravitic beacon alive while the fleet escapes.' },
      { name: 'The Maw', type: 'boss', boss: 'maw', par: 180, brief: 'It feeds on the rift. Strike its mouth when it opens.' },
    ],
    [
      { name: 'Citadel Gates', type: 'destroy', n: 4, par: 160, brief: 'Four gate outposts shield the citadel. Tear them down.' },
      { name: 'Siege Line', type: 'defend', time: 80, par: 80, brief: 'Hold the forward base against everything they throw at it.' },
      { name: 'Void Storm', type: 'survive', time: 80, par: 80, brief: 'The citadel unleashes its full fleet.' },
      { name: 'Heartstone', type: 'collect', n: 8, par: 130, brief: 'Steal the citadel\'s heartstone cores.' },
      { name: 'Final Approach', type: 'escort', len: 3000, par: 95, brief: 'Escort the warhead carrier to the citadel core.' },
      { name: 'The Overmind', type: 'boss', boss: 'overmind', par: 200, brief: 'Shatter its orbiting shards to break the core shield. End this war.' },
    ],
  ];

  const MODES = {
    campaign: { name: 'Campaign', color: '#4fc3ff', desc: '5 sectors, 30 missions, 3 stars each' },
    endless: { name: 'Endless Survival', color: '#5cff9a', desc: 'Escalating waves, a boss every 5th' },
    daily: { name: 'Daily Challenge', color: '#ffd25a', desc: 'One seeded gauntlet per day' },
    bossRush: { name: 'Boss Rush', color: '#ff5c6c', desc: 'All five bosses back to back' },
  };

  function missionId(sector, index) {
    return 's' + (sector + 1) + 'm' + (index + 1);
  }

  Object.assign(NS.campaign, {
    SECTORS, MISSIONS, MISSION_TYPES, MODES, missionId
  });
})();
