/* The things on the course: the thirteen power-ups (name, colour, base duration, what they
   do), the obstacle catalogue (size, how it is passed, whether a dash or a giant smashes it, and
   each world's look for it) and the pickup sizes. Pure data; owns nothing that changes. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});

  /* dur 0 = instant; weight = how often it drops */
  const POWERS = [
    { id: 'magnet', name: 'Magnet', color: '#ff5a6a', dur: 8, weight: 5, desc: 'Pulls every coin and gem nearby to you.' },
    { id: 'shield', name: 'Shield', color: '#5ee0ff', dur: 14, weight: 5, desc: 'Takes one hit for you, then smashes the obstacle.' },
    { id: 'multi', name: 'Double Score', color: '#ffd24a', dur: 10, weight: 4, desc: 'Every point counts twice.' },
    { id: 'jetpack', name: 'Jetpack', color: '#ff9a3a', dur: 6, weight: 3, desc: 'Fly above the course along a trail of coins. Jump and slide steer.' },
    { id: 'giant', name: 'Giant', color: '#7cff9a', dur: 6, weight: 3, desc: 'Grow huge and stomp straight through obstacles.' },
    { id: 'slowmo', name: 'Slow-Mo', color: '#b48cff', dur: 6, weight: 3, desc: 'Time slows down around you.' },
    { id: 'ghost', name: 'Ghost', color: '#e0e8ff', dur: 6, weight: 3, desc: 'Phase through obstacles (pits still need a jump).' },
    { id: 'rocket', name: 'Rocket', color: '#ff4a3a', dur: 4, weight: 2, desc: 'Blast forward at double speed, untouchable.' },
    { id: 'rain', name: 'Coin Rain', color: '#ffe07a', dur: 6, weight: 3, desc: 'Coins pour from the sky ahead of you.' },
    { id: 'revive', name: 'Phoenix Feather', color: '#ff8a2a', dur: 0, weight: 1, desc: 'One extra life for this run.' },
    { id: 'spring', name: 'Spring Shoes', color: '#6aff5a', dur: 12, weight: 3, desc: 'Higher jumps and a third jump in the air.' },
    { id: 'lucky', name: 'Gem Rush', color: '#ff6ad5', dur: 8, weight: 2, desc: 'New coins turn into gems.' },
    { id: 'quake', name: 'Shockwave', color: '#ffffff', dur: 0, weight: 2, desc: 'Smashes every obstacle on screen.' },
  ];
  const POWER_BY_ID = {};
  for (let i = 0; i < POWERS.length; ++i) {
    POWERS[i].index = i;
    POWER_BY_ID[POWERS[i].id] = POWERS[i];
  }

  /* obstacle catalogue; pass: how the player gets by (jump, slide, double, timing) */
  const HAZARDS = {
    hurdle: { w: 34, h: 46, pass: 'jump', smash: true, looks: ['Fence', 'Bone pile', 'Snow drift', 'Traffic cone', 'Void spikes'] },
    block: { w: 58, h: 58, pass: 'jump', smash: true, looks: ['Hay crate', 'Cactus', 'Ice block', 'Barrier', 'Crystal'] },
    bar: { w: 90, h: 0, pass: 'slide', smash: true, looks: ['Low branch', 'Rock arch', 'Icicle curtain', 'Laser sign', 'Shadow veil'] },
    wall: { w: 54, h: 196, pass: 'double', smash: false, looks: ['Stone wall', 'Mesa', 'Glacier', 'Container', 'Monolith'] },
    spikes: { w: 120, h: 26, pass: 'jump', smash: false, looks: ['Thorns', 'Hot coals', 'Ice spikes', 'Live wires', 'Void spikes'] },
    saw: { w: 64, h: 64, pass: 'timing', smash: true, looks: ['Saw blade', 'Saw blade', 'Ice saw', 'Plasma saw', 'Rift saw'] },
    drone: { w: 56, h: 34, pass: 'timing', smash: true, looks: ['Bee', 'Vulture', 'Snow owl', 'Security drone', 'Wisp'] },
    rock: { w: 52, h: 52, pass: 'jump', smash: true, looks: ['Falling acorn', 'Boulder', 'Icicle', 'Drop crate', 'Shard'] },
    roller: { w: 56, h: 56, pass: 'jump', smash: true, looks: ['Hay bale', 'Tumbleweed', 'Snowball', 'Barrel', 'Void orb'] },
    proj: { w: 46, h: 30, pass: 'timing', smash: true, looks: ['Thorn', 'Sand blast', 'Ice shard', 'Missile', 'Hollow bolt'] },
  };

  /* bar: a beam whose bottom edge sits above the feet (a slider fits, a stander does not);
     its top is a ledge (BAR_DECK) the runner can land on */
  const BAR_GAP = 46;
  const BAR_TOP = 124;
  const BAR_DECK = 130;

  const PICKUP_R = { coin: 13, gem: 15, shard: 18, power: 24, token: 17, orb: 22 };

  Object.assign(NS.items, {
    POWERS, POWER_BY_ID, HAZARDS, BAR_GAP, BAR_TOP, BAR_DECK, PICKUP_R
  });
})();
