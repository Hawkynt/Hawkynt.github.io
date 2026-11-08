/* Static collection data: hull liveries (paint schemes laid over any hull's own colours), mining
   beam colours and thruster plumes - each with how it unlocks (from the start, bought with credits
   or research, earned with achievements, belt licences or the Crown, or from a festival track) -
   and the festival reward track every season fills with tokens from trips. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  /* unlock: default, credits (price), rd (price), ach (count), licenses (count), crown, festival (season id) */
  const LIVERIES = [
    { id: 'factory', name: 'Factory Finish', colors: null, unlock: { k: 'default' } },
    { id: 'hazard', name: 'Hazard Stripes', colors: { hull: '#f0c030', trim: '#1a1a1a', dark: '#3a3010' }, unlock: { k: 'credits', n: 15000 } },
    { id: 'arctic', name: 'Arctic Survey', colors: { hull: '#eef4ff', trim: '#3a8aff', dark: '#5a6a80', glass: '#9ae8ff' }, unlock: { k: 'credits', n: 25000 } },
    { id: 'rust', name: 'Rustbucket', colors: { hull: '#a0602a', trim: '#e0c08a', dark: '#3a2010' }, unlock: { k: 'ach', n: 5 } },
    { id: 'cobalt', name: 'Cobalt Racer', colors: { hull: '#2a4ac0', trim: '#ffffff', dark: '#101a40', glow: '#7ab0ff' }, unlock: { k: 'licenses', n: 3 } },
    { id: 'jade', name: 'Jade Prospector', colors: { hull: '#3a9a6a', trim: '#e8ffd0', dark: '#10301e', glow: '#9affc0' }, unlock: { k: 'rd', n: 400 } },
    { id: 'carbon', name: 'Carbon Black', colors: { hull: '#2a2a32', trim: '#ff3a4a', dark: '#0a0a10', glow: '#ff6a5a' }, unlock: { k: 'ach', n: 15 } },
    { id: 'royal', name: 'Royal Charter', colors: { hull: '#5a2a8a', trim: '#ffd25a', dark: '#1e0a30', glow: '#ffd25a' }, unlock: { k: 'licenses', n: 5 } },
    { id: 'crown', name: 'Crown Breaker', colors: { hull: '#ffd25a', trim: '#5a2a8a', dark: '#6a4a10', glow: '#fff0a0', glass: '#c88aff' }, unlock: { k: 'crown' } },
    { id: 'lights', name: 'Festival Lights', colors: { hull: '#c8203a', trim: '#3ae07a', dark: '#40101a', glow: '#ffd25a' }, unlock: { k: 'festival', id: 'perihelion' } },
    { id: 'frost', name: 'Comet Frost', colors: { hull: '#cfefff', trim: '#ffffff', dark: '#4a6a8a', glow: '#bfe8ff' }, unlock: { k: 'festival', id: 'frostbelt' } },
    { id: 'blossom', name: 'Blossom', colors: { hull: '#ffb0d0', trim: '#5a9a3a', dark: '#5a2a40', glow: '#ffd0e8' }, unlock: { k: 'festival', id: 'bloom' } },
    { id: 'solar', name: 'Solar Flare', colors: { hull: '#ff8a1a', trim: '#ffe07a', dark: '#5a2a0a', glow: '#ffd25a' }, unlock: { k: 'festival', id: 'solstice' } },
    { id: 'perseid', name: 'Perseid Streak', colors: { hull: '#3a2a5a', trim: '#ffb44a', dark: '#120a20', glow: '#ffb44a' }, unlock: { k: 'festival', id: 'meteor' } },
    { id: 'lattice', name: 'Void Lattice', colors: { hull: '#0e2a2a', trim: '#3affd0', dark: '#041010', glow: '#3affd0', glass: '#3affd0' }, unlock: { k: 'festival', id: 'voidnight' } },
  ];

  const BEAMS = [
    { id: 'standard', name: 'Cutting Orange', color: '#ff6a3a', core: '#ffb070', unlock: { k: 'default' } },
    { id: 'blue', name: 'Ion Blue', color: '#3a9aff', core: '#a0d0ff', unlock: { k: 'credits', n: 8000 } },
    { id: 'green', name: 'Emerald Cut', color: '#3ae07a', core: '#b4ffc8', unlock: { k: 'rd', n: 250 } },
    { id: 'violet', name: 'Violet Arc', color: '#b05aff', core: '#e0c0ff', unlock: { k: 'ach', n: 10 } },
    { id: 'white', name: 'White Hot', color: '#ffe8c0', core: '#ffffff', unlock: { k: 'ach', n: 25 } },
    { id: 'gold', name: 'Golden Ray', color: '#ffd25a', core: '#fff4c0', unlock: { k: 'festival', id: 'perihelion' } },
    { id: 'ice', name: 'Ice Lance', color: '#9ae8ff', core: '#ffffff', unlock: { k: 'festival', id: 'frostbelt' } },
    { id: 'pink', name: 'Petal Beam', color: '#ff7ab0', core: '#ffd0e8', unlock: { k: 'festival', id: 'bloom' } },
    { id: 'sun', name: 'Sunspot', color: '#ff9a1a', core: '#ffe07a', unlock: { k: 'festival', id: 'solstice' } },
    { id: 'meteor', name: 'Meteor Tail', color: '#ff5a2a', core: '#ffd0a0', unlock: { k: 'festival', id: 'meteor' } },
    { id: 'void', name: 'Lattice Green', color: '#3affd0', core: '#c8fff0', unlock: { k: 'festival', id: 'voidnight' } },
  ];

  const PLUMES = [
    { id: 'standard', name: 'Hull Default', color: null, unlock: { k: 'default' } },
    { id: 'blue', name: 'Blue Burn', color: '#5ab0ff', unlock: { k: 'credits', n: 6000 } },
    { id: 'green', name: 'Green Fusion', color: '#5aff9a', unlock: { k: 'licenses', n: 2 } },
    { id: 'pink', name: 'Plasma Pink', color: '#ff5ad0', unlock: { k: 'rd', n: 300 } },
    { id: 'white', name: 'Afterburner', color: '#ffffff', unlock: { k: 'ach', n: 20 } },
    { id: 'gold', name: 'Gilded Flame', color: '#ffd25a', unlock: { k: 'festival', id: 'perihelion' } },
    { id: 'ice', name: 'Cold Thrust', color: '#bfe8ff', unlock: { k: 'festival', id: 'frostbelt' } },
    { id: 'bloom', name: 'Pollen Trail', color: '#d0ff7a', unlock: { k: 'festival', id: 'bloom' } },
    { id: 'sun', name: 'Solar Wind', color: '#ffb03a', unlock: { k: 'festival', id: 'solstice' } },
    { id: 'meteor', name: 'Meteor Fire', color: '#ff7a3a', unlock: { k: 'festival', id: 'meteor' } },
    { id: 'void', name: 'Void Flame', color: '#3affd0', unlock: { k: 'festival', id: 'voidnight' } },
  ];

  /* the festival track: tokens from trips while a season runs; kind livery/beam/plume pays that
     season's own item */
  const TIERS = [
    { n: 20, kind: 'credits', amount: 3000 },
    { n: 50, kind: 'livery' },
    { n: 90, kind: 'rd', amount: 150 },
    { n: 140, kind: 'beam' },
    { n: 200, kind: 'plume' },
    { n: 270, kind: 'credits', amount: 20000 },
  ];

  const BY_KIND = { livery: LIVERIES, beam: BEAMS, plume: PLUMES };

  Object.assign(NS.cosmeticData, { LIVERIES, BEAMS, PLUMES, TIERS, BY_KIND });
})();
