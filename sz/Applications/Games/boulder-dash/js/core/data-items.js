/* Content tables for the cave: the power-ups (id, look, effect, duration), the seasonal token,
   the creatures with their cadence and what they leave behind, the five bosses and the daily
   modifiers. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});

  /* item kinds stored in run.item; 1..11 power-ups, 20 the seasonal token */
  const POWERUPS = [
    null,
    { id: 1, key: 'bomb', name: 'Dynamite', color: '#ff5a3c', dur: 0, desc: '+2 dynamite. Space drops a stick that blasts 3x3.' },
    { id: 2, key: 'shield', name: 'Hard Hat', color: '#ffd54a', dur: 0, desc: 'Absorbs one crush, blast or creature hit.' },
    { id: 3, key: 'time', name: 'Hourglass', color: '#f0e6c8', dur: 0, desc: '+20 seconds on the cave clock.' },
    { id: 4, key: 'magnet', name: 'Gem Magnet', color: '#ff4fa0', dur: 10, desc: 'Gems within 3 cells fly to you.' },
    { id: 5, key: 'drill', name: 'Power Drill', color: '#c0c8d8', dur: 12, desc: 'Dig straight through brick walls.' },
    { id: 6, key: 'freeze', name: 'Frost Charm', color: '#8fe8ff', dur: 8, desc: 'Creatures freeze solid and turn harmless.' },
    { id: 7, key: 'lantern', name: 'Bright Lantern', color: '#fff2a8', dur: 25, desc: 'Lights the dark and makes gems shine through it.' },
    { id: 8, key: 'boots', name: 'Swift Boots', color: '#7dff8a', dur: 12, desc: 'Run and dig half again as fast.' },
    { id: 9, key: 'clover', name: 'Lucky Clover', color: '#44e070', dur: 15, desc: 'Every gem counts double score and gold.' },
    { id: 10, key: 'slow', name: 'Stopwatch', color: '#b39dff', dur: 8, desc: 'The cave moves at half speed; you do not.' },
    { id: 11, key: 'life', name: 'Miner\'s Lamp', color: '#ffb347', dur: 0, desc: 'One extra life (or 15 gold in Story and Zen).' }
  ];
  const TIMED = POWERUPS.filter((p) => p && p.dur > 0).map((p) => p.key);
  const TOKEN = 20;

  /* what each daily or weekly modifier changes */
  const MODIFIERS = [
    { id: 'dark', name: 'Lights Out', desc: 'The cave is pitch dark - lanterns are everywhere.' },
    { id: 'gemrain', name: 'Gem Rain', desc: 'Twice the gems, twice the boulders.' },
    { id: 'swarm', name: 'Swarm', desc: 'Double the creatures in every pocket.' },
    { id: 'quick', name: 'Quickstep', desc: 'The cave ticks faster, and so do you.' },
    { id: 'powder', name: 'Powder Day', desc: 'Start with 6 dynamite; barrels everywhere.' },
    { id: 'fragile', name: 'Glass Miner', desc: 'One life, double score.' },
    { id: 'giant', name: 'Giant Cave', desc: 'A cave half again as large, with more time.' }
  ];

  /* creatures: steps between moves are in cave ticks; leaves = what their explosion leaves */
  const CREATURES = {
    firefly: { name: 'Firefly', color: '#ff8a2a', every: 1, leaves: 'empty', desc: 'Hugs the wall on its left. Explodes on contact.' },
    butterfly: { name: 'Butterfly', color: '#5fd6ff', every: 1, leaves: 'gem', desc: 'Hugs the wall on its right. Crush it for a cluster of gems.' },
    mole: { name: 'Mole', color: '#c9a27a', every: 2, leaves: 'empty', desc: 'Digs straight toward you through dirt.' },
    bat: { name: 'Ice Bat', color: '#bfe6ff', every: 1, leaves: 'empty', desc: 'Flies straight and turns right at every wall.' }
  };

  /* bosses: 2x2 creatures; hp, move cadence in ticks, special every n ticks */
  const BOSSES = {
    grub: { name: 'Old Chomp', title: 'The Gravel Grub', hp: 3, every: 4, special: 'none', specialEvery: 0, color: '#d79a4a', eye: '#ffef7a' },
    wyrm: { name: 'Rime Wyrm', title: 'Serpent of the Glacier', hp: 4, every: 3, special: 'ice', specialEvery: 40, color: '#8fd8ff', eye: '#ffffff' },
    spore: { name: 'Spore Mother', title: 'Queen of the Grotto', hp: 4, every: 5, special: 'mole', specialEvery: 55, color: '#9a6bd8', eye: '#9dff6a' },
    titan: { name: 'Cinderjaw', title: 'The Magma Titan', hp: 5, every: 4, special: 'rocks', specialEvery: 35, color: '#e0582c', eye: '#ffd54a' },
    king: { name: 'The Hollow King', title: 'Golem of the Empty Heart', hp: 6, every: 3, special: 'blink', specialEvery: 45, color: '#b08cff', eye: '#ffffff' }
  };

  Object.assign(NS.items, { POWERUPS, TIMED, TOKEN, MODIFIERS, CREATURES, BOSSES });
})();
