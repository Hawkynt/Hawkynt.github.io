;(function() {
  'use strict';

  /* The kitchen upgrade tree as data: five branches, seventeen upgrades with
     costs and requirements, an id index and the second-slot upgrades. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});

  const TREE_BRANCHES = {
    stations: { name: 'Stations', color: '#ff7a3a' },
    gear: { name: 'Gear', color: '#3ab4ff' },
    service: { name: 'Service', color: '#6fe08a' },
    charm: { name: 'Charm', color: '#ffd23f' },
    pantry: { name: 'Pantry', color: '#c04cff' }
  };
  const TREE = [
    { id: 's_grill2', branch: 'stations', name: 'Second Grill', desc: 'Grill two things at once', costs: [300], req: [] },
    { id: 's_stove2', branch: 'stations', name: 'Second Burner', desc: 'Two pots on the stove', costs: [350], req: [] },
    { id: 's_board2', branch: 'stations', name: 'Prep Helper', desc: 'A second prep board', costs: [400], req: [['s_grill2', 1]] },
    { id: 's_oven2', branch: 'stations', name: 'Double Oven', desc: 'Bake two dishes at once', costs: [650], req: [['s_stove2', 1]] },
    { id: 'g_heat', branch: 'gear', name: 'Hot Burners', desc: 'Cooking 10% faster per level', costs: [150, 320, 650], req: [] },
    { id: 'g_timer', branch: 'gear', name: 'Precision Timers', desc: 'Perfect zones 15% wider per level', costs: [200, 450], req: [] },
    { id: 'g_pan', branch: 'gear', name: 'Non-stick Pans', desc: 'Food burns 40% later', costs: [380], req: [['g_heat', 1]] },
    { id: 'v_seats', branch: 'service', name: 'Comfy Seats', desc: 'Customers wait 12% longer per level', costs: [150, 320, 650], req: [] },
    { id: 'v_table', branch: 'service', name: 'Extra Stool', desc: 'One more seat at the counter', costs: [800], req: [['v_seats', 2]] },
    { id: 'v_waiter', branch: 'service', name: 'Waiter', desc: 'Finished dishes are served automatically', costs: [1200], req: [['v_seats', 1]] },
    { id: 'c_tips', branch: 'charm', name: 'Charm School', desc: '+10% tips per level', costs: [200, 450, 900], req: [] },
    { id: 'c_combo', branch: 'charm', name: 'Showmanship', desc: 'Combo bonus grows twice as fast', costs: [600], req: [['c_tips', 1]] },
    { id: 'c_decor', branch: 'charm', name: 'Fancy Decor', desc: 'VIPs and critics visit more often', costs: [900], req: [['c_tips', 2]] },
    { id: 'p_pass', branch: 'pantry', name: 'Warming Shelf', desc: 'Two more places on the pass', costs: [250], req: [] },
    { id: 'p_prep', branch: 'pantry', name: 'Pre-chopped', desc: 'Prep and plating steps 30% faster', costs: [300], req: [] },
    { id: 'p_rescue', branch: 'pantry', name: 'Second Chance', desc: 'Once per day a burning step is saved as good', costs: [700], req: [['p_prep', 1]] },
    { id: 'p_rush', branch: 'pantry', name: 'Rush Hour Bell', desc: 'Press B once per day: all stations work 50% faster for 10 s', costs: [1000], req: [['p_pass', 1], ['g_heat', 1]] }
  ];
  const TREE_INDEX = {};

  for (const node of TREE)
    TREE_INDEX[node.id] = node;

  const TREE_BRANCH_LIST = Object.keys(TREE_BRANCHES).map(id => ({ id: id, name: TREE_BRANCHES[id].name, color: TREE_BRANCHES[id].color }));

  /* Which upgrade gives a station its second slot. */
  const SECOND_SLOT = { grill: 's_grill2', stove: 's_stove2', board: 's_board2', oven: 's_oven2' };

  NS.Tree = { TREE, TREE_BRANCHES, TREE_INDEX, TREE_BRANCH_LIST, SECOND_SLOT };

})();
