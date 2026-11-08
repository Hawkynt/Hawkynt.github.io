/* Static event data: the belt events (outbreaks, distress calls from abandoned stations,
   migrating swarms, nanoprobe incursions, waking hives), the date-based seasons, the weekly
   anomaly rule sets, and the captain's log - seven chapters that tell what the Bloom and the
   Lattice are, each unlocked by a save counter. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  const EVENTS = {
    outbreak: { name: 'Spore Outbreak', icon: 'serum', color: '#9ae04a', banner: 'SPORE BREACH', sub: 'Crew infected - quarantine or treat them' },
    distress: { name: 'Distress Call', icon: 'derelict', color: '#ffd25a', banner: 'DISTRESS CALL', sub: 'A silent station is broadcasting - clear it and dock to rescue survivors' },
    migration: { name: 'Swarm Migration', icon: 'swarm', color: '#c070ff', banner: 'SWARM MIGRATION', sub: 'A brood crosses the belt - stay clear or thin it out' },
    nanoprobe: { name: 'Nanoprobe Incursion', icon: 'glitch', color: '#3affd0', banner: 'NANOPROBE INCURSION', sub: 'The Lattice is reaching for your outpost' },
    hive: { name: 'Hive Wakes', icon: 'hive', color: '#ff8ae0', banner: 'A HIVE STIRS', sub: 'Swarmers pour out of a hollow rock' },
  };

  /* month is 1-based; a season runs from (m0, d0) to (m1, d1) inclusive, wrapping the year */
  const SEASONS = [
    { id: 'perihelion', name: 'Perihelion Lights', m0: 12, d0: 18, m1: 1, d1: 6, color: '#ffd25a',
      text: 'Festival lights on every station - contracts pay a quarter more', mods: { contracts: 1.25, reward: 1.1 } },
    { id: 'frostbelt', name: 'Frostbelt', m0: 1, d0: 15, m1: 2, d1: 20, color: '#bfe8ff',
      text: 'Ice comets drift through the belts - ice and crystal sell a third higher', mods: { reward: 1.15, yield: 1.1 } },
    { id: 'solstice', name: 'Solar Solstice', m0: 6, d0: 15, m1: 7, d1: 10, color: '#ffb03a',
      text: 'The solar wind runs strong - engines burn hotter, rocks crack richer', mods: { yield: 1.2, reward: 1.1 } },
    { id: 'bloom', name: 'Spring Bloom', m0: 4, d0: 10, m1: 5, d1: 10, color: '#9ae04a',
      text: 'The Bloom flowers - twice the lifeforms, bio-matter sells high', mods: { life: 2, bioPrice: 1.5 } },
    { id: 'meteor', name: 'Perseid Drift', m0: 8, d0: 5, m1: 8, d1: 25, color: '#ffb44a',
      text: 'A meteor stream crosses the belts - richer rocks everywhere', mods: { yield: 1.25, rare: 0.2 } },
    { id: 'voidnight', name: 'Void Night', m0: 10, d0: 24, m1: 11, d1: 3, color: '#3affd0',
      text: 'The Lattice is restless - more nanoprobes, harder waves, better pay', mods: { nano: 2, waves: 1.25, reward: 1.3 } },
  ];

  /* one rule set per week, in one belt (index 1..4) picked from the week key */
  const ANOMALIES = [
    { id: 'richveins', name: 'Rich Veins', color: '#ffd25a', text: 'Every fracture yields half again as much ore', mods: { yield: 1.5 }, reward: 1.2 },
    { id: 'swarmweek', name: 'Swarm Migration', color: '#c070ff', text: 'Broods migrate through - waves are larger', mods: { waves: 1.4, migration: 2 }, reward: 1.4 },
    { id: 'ionstorm', name: 'Ion Storm', color: '#7cf0ff', text: 'Solar storms rage - shields recharge slowly', mods: { storm: 1, shieldRegen: 0.5 }, reward: 1.3 },
    { id: 'bloomtide', name: 'Bloom Tide', color: '#9ae04a', text: 'Spores on every rock - rich bio-matter, constant outbreaks', mods: { life: 2.5 }, reward: 1.35 },
    { id: 'latticewake', name: 'Lattice Wake', color: '#3affd0', text: 'Nanoprobes swarm the belt - guard your links', mods: { nano: 3 }, reward: 1.5 },
    { id: 'drift', name: 'Drift Currents', color: '#8ac8ff', text: 'Rocks tumble three times as fast', mods: { drift: 3 }, reward: 1.2 },
    { id: 'goldfever', name: 'Gold Fever', color: '#ffc83a', text: 'Precious veins run thick', mods: { precious: 2 }, reward: 1.25 },
    { id: 'darkbelt', name: 'Dark Belt', color: '#8a8aff', text: 'Sensors are blind - but derelicts are everywhere', mods: { dark: 1, derelicts: 2 }, reward: 1.3 },
  ];

  /* the captain's log: stat >= need unlocks the chapter (and plays it once) */
  const CHAPTERS = [
    { id: 'claim', title: 'Chapter I - Stakes in the Dark', stat: 'bases', need: 1, color: '#ffb44a', lines: [
      'Captain\'s log. We set down our first outpost today - a hub, a few rigs, a lot of hope.',
      'The survey drones that charted these belts forty years ago never came home. Nobody asks why.',
      'The crew says the rocks out here hum at night. I told them it is thermal stress. I am not sure.'] },
    { id: 'bloom', title: 'Chapter II - The Bloom', stat: 'infections', need: 1, color: '#9ae04a', lines: [
      'The humming has a name now. The medics call it the Bloom: spores that live inside metal-rich rock.',
      'It feeds slowly on ore and quickly on people. It rides in on cargo, in the dust on a suit.',
      'Quarantine works. Serum works. Being careless does not.'] },
    { id: 'silence', title: 'Chapter III - Silent Stations', stat: 'reclaims', need: 1, color: '#ffd25a', lines: [
      'We answered a distress call and found a station with the lights off and the airlocks welded shut.',
      'Their logs end mid-sentence. They sealed the Bloom in with themselves and kept broadcasting for us.',
      'We brought the survivors home. There were fewer than the beacon promised.'] },
    { id: 'lattice', title: 'Chapter IV - The Lattice', stat: 'corruptions', need: 1, color: '#3affd0', lines: [
      'A turret turned on our own fighters today. Inside it: nanoprobes, rewriting it one gate at a time.',
      'The engineers call them the Lattice. They are not attacking. They are building - following a blueprint',
      'older than the colonies, and our outposts are made of exactly the parts it needs.'] },
    { id: 'hive', title: 'Chapter V - The Mothership', stat: 'bosses', need: 1, color: '#d050ff', lines: [
      'The mothership is down. Its hull was Bloom grown over a Lattice frame - the two were never enemies.',
      'One seeds, the other builds. Something designed them to work together, and then left them here.',
      'Every one we kill sings the same frequency as the rocks.'] },
    { id: 'crown', title: 'Chapter VI - The Crown', stat: 'crown', need: 1, color: '#c88aff', lines: [
      'The Crown Heart was not a crystal. It was a lock - a prison that held the Bloom asleep for ages.',
      'The Lattice was its warden, and we have been mining the walls of the cell.',
      'It is open now. I do not know whether that was a mistake.'] },
    { id: 'keepers', title: 'Chapter VII - The Keepers', stat: 'waves', need: 40, color: '#4fd8ff', lines: [
      'Forty raids held. The outposts stand, and the crews have started calling themselves keepers.',
      'If the old warden is broken, someone has to watch the belts. It may as well be us.',
      'End of the log. For now.'] },
  ];
  const CHAPTER_BY_ID = {};
  for (let i = 0; i < CHAPTERS.length; ++i) {
    CHAPTERS[i].index = i;
    CHAPTER_BY_ID[CHAPTERS[i].id] = CHAPTERS[i];
  }

  Object.assign(NS.eventData, {
    EVENTS, SEASONS, ANOMALIES, CHAPTERS, CHAPTER_BY_ID
  });
})();
