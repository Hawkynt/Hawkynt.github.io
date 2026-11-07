/* The achievements: the original game's 59 (same ids, so old unlocks carry over) plus new ones
   for the eras, golden treats, combos, Bake-Offs, quests, streaks, seasons, the tech tree,
   ascension, the late producers and the collection. Each tests a snapshot built by
   progression.snapshot; each unlock gives +1% production and a recipe note. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const { STAGES } = NS.treatData;

  const A = [];
  function add(id, name, desc, icon, test) {
    A.push({ id: id, name: name, desc: desc, icon: icon, test: test });
  }
  const own = (id, n) => s => (s.buildings[id] || 0) >= n;

  /* the original set */
  const BAKED = [['a01', 'Wake and Bake', 1], ['a02', 'Making Some Dough', 100], ['a03', 'So Baked Right Now', 1000], ['a04', 'Fledgling Bakery', 1e4],
    ['a05', 'Affluent Bakery', 1e5], ['a06', 'World Famous Bakery', 1e6], ['a07', 'Cosmic Bakery', 1e9], ['a08', 'Galactic Bakery', 1e12],
    ['a09', 'Universal Bakery', 1e15], ['a10', 'Timeless Bakery', 1e18], ['a40', 'Infinite Bakery', 1e21]];
  for (const b of BAKED) add(b[0], b[1], 'Bake ' + NS.format.long(b[2]) + (b[2] === 1 ? ' treat' : ' treats') + ' in total', 'cookie', s => s.allTime >= b[2]);
  const CLICKS = [['a11', 'Click', 1], ['a12', 'Double Click', 2], ['a13', 'Mouse Wheel', 100], ['a14', 'Of Mice and Men', 500], ['a15', 'The Digital', 1000],
    ['a41', 'Extreme Polka', 5000], ['a42', 'Manic Clicking', 10000], ['a43', 'Carpal Tunnel', 50000]];
  for (const c of CLICKS) add(c[0], c[1], 'Click the treat ' + NS.format.group(c[2]) + ' time' + (c[2] > 1 ? 's' : ''), 'hand', s => s.clicks >= c[2]);
  const B50 = [['a16', 'Cursor Starter', 'cursor', 1], ['a17', 'Cursor Army', 'cursor', 50], ['a18', 'Grandma Army', 'grandma', 50], ['a19', 'Farm Lord', 'farm', 50],
    ['a20', 'Mine Tycoon', 'mine', 50], ['a21', 'Factory Owner', 'factory', 50], ['a22', 'Bank President', 'bank', 50], ['a23', 'Temple Guardian', 'temple', 50],
    ['a24', 'Arch Wizard', 'wizard-tower', 50], ['a44', 'Spacefarer', 'shipment', 1], ['a45', 'Transmuter', 'alchemy-lab', 1], ['a46', 'Gatekeeper', 'portal', 1],
    ['a47', 'Time Lord', 'time-machine', 1], ['a48', 'Antibaker', 'condenser', 1], ['a49', 'Light Bender', 'prism', 1], ['a50', 'Fleet Commander', 'shipment', 50],
    ['a51', 'Grand Alchemist', 'alchemy-lab', 50], ['a52', 'Portal Master', 'portal', 50], ['a53', 'Temporal Overlord', 'time-machine', 50],
    ['a54', 'Particle Physicist', 'condenser', 50], ['a55', 'Prismatic', 'prism', 50], ['a56', 'Cursor Centurion', 'cursor', 100],
    ['a57', 'Grandma Centennial', 'grandma', 100], ['a58', 'Farm Baron', 'farm', 100], ['a59', 'Deep Digger', 'mine', 100],
    ['n01', 'Oven Within an Oven', 'fractal-oven', 1], ['n02', 'Sweet Dreams', 'dream-engine', 1], ['n03', 'Star Baker', 'sugar-nebula', 1], ['n04', 'Point of No Return', 'cake-singularity', 1],
    ['n05', 'Infinite Regress', 'fractal-oven', 50], ['n06', 'Dream Team', 'dream-engine', 50], ['n07', 'Nebular Empire', 'sugar-nebula', 50], ['n08', 'Gravity Well', 'cake-singularity', 50],
    ['n09', 'Grandmapocalypse', 'grandma', 200], ['n10', 'Cursor Singularity', 'cursor', 200]];
  for (const b of B50) add(b[0], b[1], 'Own ' + b[3] + ' ' + (b[3] > 1 ? NS.buildingData.BY_ID[b[2]].plural : NS.buildingData.BY_ID[b[2]].name), 'b:' + b[2], own(b[2], b[3]));
  const CPS = [['a25', 'Speedbaker', 10], ['a26', 'Kilobaker', 1000], ['a27', 'Megabaker', 1e6], ['a28', 'Gigabaker', 1e9], ['a60', 'Terabaker', 1e12], ['a61', 'Petabaker', 1e15],
    ['n11', 'Exabaker', 1e18]];
  for (const c of CPS) add(c[0], c[1], 'Reach ' + NS.format.long(c[2]) + ' per second', 'bolt', s => s.cps >= c[2]);
  add('a29', 'Ascended', 'Ascend at least once', 'wing', s => s.ascensions >= 1);
  add('a30', 'Reborn', 'Ascend 5 times', 'wing', s => s.ascensions >= 5);
  add('a62', 'Eternal', 'Ascend 10 times', 'wing', s => s.ascensions >= 10);
  add('a31', 'Builder', 'Own 100 producers at once', 'crate', s => s.totalBuildings >= 100);
  add('a32', 'Architect', 'Own 500 producers at once', 'crate', s => s.totalBuildings >= 500);
  add('a63', 'Engineer', 'Own 1,000 producers at once', 'crate', s => s.totalBuildings >= 1000);
  add('a64', 'Enhancer', 'Own 10 upgrades in one run', 'flavour', s => s.totalUpgrades >= 10);
  add('a65', 'Augmenter', 'Own 25 upgrades in one run', 'flavour', s => s.totalUpgrades >= 25);
  add('a66', 'Cookie Scientist', 'Own 50 upgrades in one run', 'flavour', s => s.totalUpgrades >= 50);

  /* eras */
  for (let i = 1; i < STAGES.length; ++i)
    add('st' + i, STAGES[i].era, 'Evolve the treat into a ' + STAGES[i].name, 'recipe', s => s.stageMax >= i);
  add('st-goals', 'Milestone Maker', 'Complete 12 era milestones', 'scroll', s => s.goals >= 12);
  /* golden treats */
  const GOLD = [['g01', 'Lucky Find', 1], ['g02', 'Golden Fingers', 7], ['g03', 'Fortune Hunter', 27], ['g04', 'Treasure Baker', 77], ['g05', 'Midas Kitchen', 277], ['g06', 'Golden Age', 777]];
  for (const g of GOLD) add(g[0], g[1], 'Catch ' + g[2] + ' golden treat' + (g[2] > 1 ? 's' : ''), 'golden', s => s.golden >= g[2]);
  add('g07', 'Double Trouble', 'Have two golden buffs running at once', 'bolt', s => s.buffsAtOnce >= 2);
  add('g08', 'Stormchaser', 'Catch 30 drops in one Cookie Storm', 'cookie', s => s.stormBest >= 30);
  /* combos */
  const COMBO = [['x01', 'Rhythm Section', 10], ['x02', 'Drum Roll', 25], ['x03', 'Blast Beat', 50], ['x04', 'Machine Gun Fingers', 100], ['x05', 'Inhuman', 150]];
  for (const c of COMBO) add(c[0], c[1], 'Reach a combo of ' + c[2], 'combo', s => s.bestCombo >= c[2]);
  /* modes */
  add('b01', 'On Your Marks', 'Finish a Bake-Off', 'clock', s => s.bakeoffs >= 1);
  add('b02', 'Bake-Off Contender', 'Score a million in a Bake-Off', 'trophy', s => s.bakeBest >= 1e6);
  add('b03', 'Bake-Off Champion', 'Score a billion in a Bake-Off', 'trophy', s => s.bakeBest >= 1e9);
  add('b04', 'Daily Baker', 'Finish a Daily Bake-Off', 'calendar', s => s.dailies >= 1);
  add('b05', 'Weekly Regular', 'Finish 7 Daily Bake-Offs', 'calendar', s => s.dailies >= 7);
  add('b06', 'Inner Peace', 'Spend 5 minutes in the Zen Kitchen', 'leaf', s => s.zenSeconds >= 300);
  /* quests and streaks */
  add('q01', 'Errand Runner', 'Complete a daily quest', 'scroll', s => s.quests >= 1);
  add('q02', 'Reliable Baker', 'Complete 15 daily quests', 'scroll', s => s.quests >= 15);
  add('q03', 'Quest Master', 'Complete 60 daily quests', 'scroll', s => s.quests >= 60);
  add('q04', 'Three in a Row', 'Bake on 3 days in a row', 'calendar', s => s.streak >= 3);
  add('q05', 'Week of Baking', 'Bake on 7 days in a row', 'calendar', s => s.streak >= 7);
  add('q06', 'Month of Baking', 'Bake on 30 days in a row', 'calendar', s => s.streak >= 30);
  add('q07', 'Night Owl', 'Come back to offline baking', 'moon', s => s.offlineReturns >= 1);
  /* seasons */
  const SEAS = [['winter', 'Snow Baker'], ['spring', 'Egg Hunter'], ['summer', 'Sun Catcher'], ['autumn', 'Leaf Peeper'], ['halloween', 'Pumpkin King'], ['yearend', 'Countdown Baker']];
  for (const se of SEAS) add('se-' + se[0], se[1], 'Collect 10 ' + se[0] + ' tokens', 'leaf', s => (s.tokens[se[0]] || 0) >= 10);
  /* tree and ascension */
  add('t01', 'First Experiment', 'Research a tech tree node', 'flask', s => s.treeLevels >= 1);
  add('t02', 'Lab Regular', 'Research 25 tech tree levels', 'flask', s => s.treeLevels >= 25);
  add('t03', 'Head of Research', 'Research 60 tech tree levels', 'flask', s => s.treeLevels >= 60);
  add('t04', 'Crystal Clear', 'Own 10 sugar crystals', 'crystal', s => s.crystals >= 10);
  add('t05', 'Crystal Palace', 'Own 100 sugar crystals', 'crystal', s => s.crystals >= 100);
  add('t06', 'Crystal Cathedral', 'Own 1,000 sugar crystals', 'crystal', s => s.crystals >= 1000);
  /* collection */
  add('k01', 'Fully Decorated', 'Put all six decorations on the treat', 'deco', s => s.decos >= 6);
  add('k02', 'Fashion Baker', 'Unlock 5 treat skins', 'palette', s => s.skins >= 5);
  add('k03', 'Haute Patisserie', 'Unlock 10 treat skins', 'palette', s => s.skins >= 10);
  add('k04', 'Couturier', 'Unlock 16 treat skins', 'palette', s => s.skins >= 16);
  /* the Sugar Garden */
  add('g01', 'Green Thumb', 'Plant your first seed in the Sugar Garden', 'leaf', s => s.planted >= 1);
  add('g02', 'Something New', 'Grow a mutation in the garden', 'leaf', s => s.mutations >= 1);
  add('g03', 'Seed Collector', 'Know 5 garden seeds', 'leaf', s => s.seeds >= 5);
  add('g04', 'Botanist', 'Know 10 garden seeds', 'leaf', s => s.seeds >= 10);
  add('g05', 'Master Gardener', 'Know all 17 garden seeds', 'leaf', s => s.seeds >= 17);
  add('g06', 'Harvest Festival', 'Harvest 100 ripe plants', 'leaf', s => s.harvested >= 100);
  add('g07', 'Thousand Harvests', 'Harvest 1,000 ripe plants', 'leaf', s => s.harvested >= 1000);
  add('g08', 'Crystal Bloom', 'Harvest a sugar crystal from a Crystal Rose', 'crystal', s => s.gardenCrystals >= 1);
  add('g09', 'Wide Fields', 'Grow the garden to its full 6 x 6 plot', 'leaf', s => s.gardenFull >= 1);
  add('g10', 'Mad Scientist', 'Grow 50 mutations', 'flask', s => s.mutations >= 50);
  /* Sanctum Trials */
  for (const t of NS.trialData.TRIALS) add('tr-' + t.id, t.name, 'Complete the ' + t.name + ' trial', 'star', s => !!s.trialIds[t.id]);
  add('tr-all', 'Sanctified', 'Complete all six Sanctum Trials', 'crystal', s => s.trials >= 6);

  const BY_ID = {};
  for (let i = 0; i < A.length; ++i) BY_ID[A[i].id] = A[i];

  NS.achievementData = { ACHIEVEMENTS: A, BY_ID };
})();
