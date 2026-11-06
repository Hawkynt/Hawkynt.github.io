/* Static goal data: the game modes (Career, Gold Rush, Daily Belt, Siege), the achievements
   with the save counter each one watches and its research reward, and the counters every save
   carries. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});

  const MODES = {
    career: { id: 'career', name: 'Career', desc: 'Build a mining empire, belt by belt', color: '#ffb44a', icon: 'station' },
    rush: { id: 'rush', name: 'Gold Rush', desc: 'Five minutes, your ship, every credit counts', color: '#ffd25a', icon: 'clock', time: 300 },
    daily: { id: 'daily', name: 'Daily Belt', desc: 'One seeded belt a day, the same for everyone', color: '#4fd8ff', icon: 'calendar', time: 240 },
    siege: { id: 'siege', name: 'Siege', desc: 'Build an outpost and hold it through 15 waves', color: '#ff5c6c', icon: 'turret', waves: 15 },
  };

  /* stat: a counter in save.stats; need: the value that earns it; rd: research data reward */
  const ACHIEVEMENTS = [
    { id: 'firstOre', name: 'First Light', desc: 'Pull your first nugget aboard', stat: 'nuggets', need: 1, rd: 1 },
    { id: 'rockbreaker', name: 'Rockbreaker', desc: 'Fracture 100 asteroids', stat: 'fractures', need: 100, rd: 3 },
    { id: 'quarry', name: 'Quarry Master', desc: 'Fracture 1000 asteroids', stat: 'fractures', need: 1000, rd: 8 },
    { id: 'fullHold', name: 'Fully Loaded', desc: 'Dock with a full hold', stat: 'fullDocks', need: 1, rd: 2 },
    { id: 'earn10k', name: 'Prospector', desc: 'Earn 10,000 credits', stat: 'earned', need: 10000, rd: 3 },
    { id: 'earn100k', name: 'Tycoon', desc: 'Earn 100,000 credits', stat: 'earned', need: 100000, rd: 6 },
    { id: 'earn1m', name: 'Belt Baron', desc: 'Earn 1,000,000 credits', stat: 'earned', need: 1000000, rd: 12 },
    { id: 'refiner', name: 'Smelter', desc: 'Refine 50 bars', stat: 'bars', need: 50, rd: 3 },
    { id: 'contractor', name: 'Reliable Supplier', desc: 'Complete 10 contracts', stat: 'contracts', need: 10, rd: 5 },
    { id: 'fleet', name: 'Drone Fleet', desc: 'Fly with three drones', stat: 'maxDrones', need: 3, rd: 4 },
    { id: 'pirates', name: 'Pirate Bane', desc: 'Destroy 25 pirates', stat: 'pirates', need: 25, rd: 5 },
    { id: 'chain', name: 'Chain Reaction', desc: 'Set off three volatile rocks in one blast', stat: 'bestChain', need: 3, rd: 3 },
    { id: 'geode', name: 'Geologist', desc: 'Crack open a crystal geode', stat: 'geodes', need: 1, rd: 4 },
    { id: 'derelict', name: 'Salvager', desc: 'Salvage a derelict', stat: 'derelicts', need: 1, rd: 4 },
    { id: 'void', name: 'Crystal Heart', desc: 'Mine a void crystal', stat: 'voidCrystals', need: 1, rd: 5 },
    { id: 'explorer', name: 'Explorer', desc: 'Visit all five belts', stat: 'zonesVisited', need: 5, rd: 6 },
    { id: 'crown', name: 'The Crown', desc: 'Shatter the Crown Heart', stat: 'crown', need: 1, rd: 10 },
    { id: 'founder', name: 'Founder', desc: 'Found your first outpost', stat: 'bases', need: 1, rd: 3 },
    { id: 'architect', name: 'Architect', desc: 'Complete 25 buildings', stat: 'buildings', need: 25, rd: 5 },
    { id: 'holdout', name: 'Holdout', desc: 'Repel 10 attack waves', stat: 'waves', need: 10, rd: 6 },
    { id: 'exterminator', name: 'Exterminator', desc: 'Destroy 250 invaders', stat: 'invaders', need: 250, rd: 6 },
    { id: 'admiral', name: 'Admiral', desc: 'Command a fleet of 12 units', stat: 'maxFleet', need: 12, rd: 5 },
    { id: 'bossSlayer', name: 'Hive Breaker', desc: 'Destroy a hive mothership', stat: 'bosses', need: 1, rd: 8 },
    { id: 'industrialist', name: 'Industrialist', desc: 'Fabricate 50 components', stat: 'components', need: 50, rd: 5 },
    { id: 'siegeMaster', name: 'Unbroken', desc: 'Hold an outpost through all 15 Siege waves', stat: 'siegeWins', need: 1, rd: 10 },
    { id: 'medic', name: 'Field Medic', desc: 'Cure 20 infected crew', stat: 'cured', need: 20, rd: 4 },
    { id: 'rescuer', name: 'Search and Rescue', desc: 'Rescue survivors from a silent station', stat: 'reclaims', need: 1, rd: 5 },
    { id: 'purifier', name: 'Purifier', desc: 'Purge nanoprobe corruption 10 times', stat: 'purges', need: 10, rd: 5 },
    { id: 'streak', name: 'Regular', desc: 'Finish daily contracts 7 days in a row', stat: 'streakBest', need: 7, rd: 8 },
  ];

  const ACH_BY_ID = {};
  for (let i = 0; i < ACHIEVEMENTS.length; ++i) ACH_BY_ID[ACHIEVEMENTS[i].id] = ACHIEVEMENTS[i];

  /* the counters every save carries (all start at 0) */
  const STAT_KEYS = ['nuggets', 'fractures', 'fullDocks', 'earned', 'bars', 'contracts', 'maxDrones', 'pirates', 'bestChain',
    'geodes', 'derelicts', 'voidCrystals', 'zonesVisited', 'crown', 'trips', 'units', 'deaths', 'playTime',
    'bases', 'buildings', 'waves', 'invaders', 'maxFleet', 'bosses', 'components', 'siegeWins', 'infections', 'cured',
    'reclaims', 'corruptions', 'purges', 'rescued', 'hives', 'bioHarvest', 'streakBest', 'dailies', 'abandoned'];

  Object.assign(NS.goals, {
    MODES, ACHIEVEMENTS, ACH_BY_ID, STAT_KEYS
  });
})();
