;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Content for the Physics Puzzle: five themed worlds of eight levels and
   * the Trick Shot challenges. A level is plain data:
   *   launcher [x, y], aim [minDeg, maxDeg] (optional limit of the barrel),
   *   items: fixtures for parts.js ([kind, ...args]), targets [[x, y]],
   *   stars [[x, y]] (optional pickups in the air), inv { part: count },
   *   par (shots for the second star), tip (shown on the intro card),
   *   plan (the designer's part layout, a seed for the solver tool).
   * Coordinates are field pixels (1280 x 640, ground top at y 600).
   * Known solutions live in solutions.js and are replayed by the tests.
   */

  const WORLDS = Object.freeze([
    { id: 'workshop', name: 'Tinker Workshop', blurb: 'Planks, springs and crates on the workbench', gravity: 1200, wallMat: 'wood', groundMat: 'wood',
      color: '#ffb35a', accent: '#ffd98a' },
    { id: 'garden', name: 'Greenhouse Garden', blurb: 'Belts, breezes and ponds under glass', gravity: 1200, wallMat: 'wood', groundMat: 'stone',
      color: '#7ee07a', accent: '#c8ff9a' },
    { id: 'icelab', name: 'Cryo Lab', blurb: 'Ice, magnets and portals in the cold', gravity: 1200, wallMat: 'metal', groundMat: 'metal',
      color: '#7ad8ff', accent: '#d0f4ff' },
    { id: 'forge', name: 'Volcano Forge', blurb: 'TNT, gears and lava in the heat', gravity: 1250, wallMat: 'metal', groundMat: 'stone',
      color: '#ff7a3a', accent: '#ffc07a' },
    { id: 'space', name: 'Orbit Station', blurb: 'Low gravity among the stars', gravity: 480, wallMat: 'metal', groundMat: 'metal',
      color: '#c08aff', accent: '#e8d0ff' }
  ]);

  const L = [110, 566];

  function ground(x0, x1, top) {
    return ['ground', x0 === undefined ? 0 : x0, x1 === undefined ? 1280 : x1, top];
  }

  /* an open-topped bin standing with its floor at y = bottom */
  function cup(cx, bottom, w, h, mat) {
    return [
      ['wall', cx, bottom - 8, w, 16, 0, mat],
      ['wall', cx - w / 2 + 8, bottom - h / 2, 16, h, 0, mat],
      ['wall', cx + w / 2 - 8, bottom - h / 2, 16, h, 0, mat]
    ];
  }

  /* a little table with legs; top surface at y = top */
  function table(cx, top, w, h) {
    return [
      ['wall', cx, top + 8, w, 16],
      ['wall', cx - w / 2 + 10, top + 16 + (h - 16) / 2, 12, h - 16],
      ['wall', cx + w / 2 - 10, top + 16 + (h - 16) / 2, 12, h - 16]
    ];
  }

  const LEVELS = [
    /* ═══════════════ World 1: Tinker Workshop ═══════════════ */
    { id: 'w1-1', world: 0, name: 'First Shot', launcher: L,
      items: [ground()].concat(table(980, 516, 120, 84)),
      targets: [[980, 484]],
      stars: [[365, 478], [565, 447], [764, 449]],
      inv: {}, par: 1,
      tip: 'Press anywhere on the field and pull back - the farther, the harder. Let go to fire.' },
    { id: 'w1-2', world: 0, name: 'Over the Cabinet', launcher: L,
      items: [ground(), ['wall', 640, 430, 90, 340]],
      targets: [[1040, 568]],
      stars: [[332, 285], [597, 184], [849, 333]],
      inv: {}, par: 1,
      tip: 'Lob it high over the cabinet.' },
    { id: 'w1-3', world: 0, name: 'Backboard', launcher: L, aim: [20, 70],
      items: [ground(), ['wall', 1000, 424, 170, 16], ['wall', 923, 512, 16, 160]],
      targets: [[1010, 568]],
      stars: [[340, 226], [863, 109], [1131, 423]],
      inv: { plank: 1 }, par: 2, plan: [['plank', 1180, 516, 90]],
      tip: 'The bin opens to the right. Stand a plank behind it to bank the ball back in.' },
    { id: 'w1-4', world: 0, name: 'Spring Step', launcher: L, aim: [0, 25],
      items: [ground(), ['wall', 760, 255, 1040, 20], ['wall', 1135, 340, 290, 20], ['wall', 1000, 470, 20, 260]],
      targets: [[1200, 302]],
      stars: [[970, 454], [950, 320], [1066, 317]],
      inv: { spring: 1 }, par: 2, plan: [['spring', 780, 575, 30]],
      tip: 'The ledge hides under the beam. A tilted spring pad can bounce the ball up and in.' },
    { id: 'w1-5', world: 0, name: 'Crate Wall', launcher: L, aim: [-10, 40],
      items: [ground(), ['wall', 1060, 440, 440, 16], ['wall', 1272, 520, 16, 160], ['crate', 870, 576], ['crate', 870, 527]],
      targets: [[1160, 568]],
      stars: [[395, 487], [685, 470], [961, 493]],
      inv: {}, par: 2,
      tip: 'Smash the crates out of the doorway - the next shot can roll right in.' },
    { id: 'w1-6', world: 0, name: 'Glass Lid', launcher: L,
      items: [ground(), ['wall', 963, 525, 16, 150], ['wall', 1117, 525, 16, 150], ['glass', 1040, 444, 172, 12, 0, 900], ['wall', 680, 460, 60, 280]],
      targets: [[1040, 566]],
      stars: [[350, 248], [646, 121], [937, 294]],
      inv: {}, par: 1,
      tip: 'Glass breaks under a hard hit. Drop the ball onto the lid from high up.' },
    { id: 'w1-7', world: 0, name: 'Bumper Bank', launcher: [640, 566], aim: [15, 65],
      items: [ground(), ['wall', 190, 470, 380, 16], ['wall', 10, 535, 20, 130]],
      targets: [[120, 566]],
      stars: [[1010, 442], [853, 580], [319, 584]],
      inv: { bumper: 1, plank: 1 }, par: 2, plan: [['bumper', 1150, 420, 0]],
      tip: 'The target hides behind you. Bounce the ball back off a bumper.' },
    { id: 'w1-8', world: 0, name: 'Two Birds', launcher: L, aim: [10, 70],
      items: [ground()].concat(table(560, 486, 110, 114), cup(1130, 600, 150, 110), [['wall', 840, 330, 20, 540]]),
      targets: [[560, 454], [1130, 566]],
      stars: [[798, 584], [657, 587]],
      inv: { plank: 2, spring: 1 }, par: 3, plan: [],
      tip: 'Two targets - light both. The world keeps every change between shots.' },

    /* ═══════════════ World 2: Greenhouse Garden ═══════════════ */
    { id: 'w2-1', world: 1, name: 'Garden Path', launcher: L, aim: [-10, 30],
      items: [ground(), ['conveyor', 820, 591, 560, 0, 320], ['wall', 900, 470, 760, 20], ['wall', 1272, 540, 16, 120]],
      targets: [[1200, 568]],
      stars: [[423, 545], [729, 555], [984, 563]],
      inv: {}, par: 1,
      tip: 'Conveyor belts carry anything that lands on them.' },
    { id: 'w2-2', world: 1, name: 'Lily Pond', launcher: L, aim: [-10, 5],
      items: [ground(0, 420), ground(700, 1280), ['wall', 560, 690, 280, 40], ['water', 420, 625, 700, 670], ['wall', 1120, 470, 300, 16], ['wall', 1272, 540, 16, 120]],
      targets: [[1160, 568]],
      stars: [[733, 587], [892, 587], [1012, 587]],
      inv: { plank: 2 }, par: 1, plan: [['plank', 490, 610, 0], ['plank', 630, 610, 0]],
      tip: 'The barrel is stuck low. Lay planks across the pond and roll the ball over.' },
    { id: 'w2-3', world: 1, name: 'Breeze', launcher: L, aim: [-10, 30],
      items: [ground(), ['wall', 900, 295, 20, 450], ['wall', 1090, 60, 380, 20], ['wall', 1272, 320, 16, 560], ['fan', 1080, 622, -90, 480, 3600]],
      targets: [[1080, 170]],
      stars: [[575, 587], [1064, 576], [1150, 496]],
      inv: {}, par: 1,
      tip: 'Fans blow along their arrow. Roll under the wall and ride the updraft.' },
    { id: 'w2-4', world: 1, name: 'Bean Poles', launcher: L,
      items: [ground(), ['peg', 760, 260, 12], ['peg', 840, 260, 12], ['peg', 920, 260, 12], ['peg', 800, 330, 12], ['peg', 880, 330, 12], ['peg', 960, 330, 12],
        ['peg', 760, 400, 12], ['peg', 840, 400, 12], ['peg', 920, 400, 12], ['wall', 1040, 470, 20, 260]].concat(cup(880, 600, 140, 80)),
      targets: [[880, 570]],
      stars: [[343, 448], [543, 416], [742, 448]],
      inv: {}, par: 2,
      tip: 'Drop the ball through the bean poles into the pot.' },
    { id: 'w2-5', world: 1, name: 'Hanging Pot', launcher: L, aim: [-10, 35],
      items: [ground(), ['wall', 700, 220, 1160, 20], ['pendulum', 760, 230, 300, 0, 28], ['wall', 1272, 520, 16, 160]].concat(cup(1150, 600, 150, 90)),
      targets: [[1150, 570]],
      stars: [[398, 424], [686, 377], [955, 420]],
      inv: { plank: 1 }, par: 2, plan: [],
      tip: 'The heavy pot hangs in the way. Knock it aside - or slip past.' },
    { id: 'w2-6', world: 1, name: 'Greenhouse', launcher: L, aim: [0, 30],
      items: [ground(), ['wall', 870, 470, 16, 260], ['wall', 1250, 470, 16, 260], ['glass', 1060, 336, 396, 14, 0, 700], ['glass', 1060, 470, 360, 12, 0, 520], ['wall', 600, 520, 40, 160]],
      targets: [[1060, 568]],
      stars: [[540, 441], [619, 154], [1008, 283]],
      inv: { spring: 1 }, par: 2, plan: [],
      tip: 'Two panes of glass guard the seedling. The barrel fires low - bounce up and come down hard.' },
    { id: 'w2-7', world: 1, name: 'Uphill Belt', launcher: L, aim: [-10, 25],
      items: [ground(), ['wall', 760, 250, 1040, 20], ['wall', 1130, 350, 300, 20], ['wall', 990, 475, 20, 250], ['wall', 1272, 300, 16, 120]],
      targets: [[1200, 314]],
      stars: [[681, 434], [935, 352], [1061, 327]],
      inv: { conveyor: 1, plank: 1 }, par: 2, plan: [['conveyor', 880, 470, -30]],
      tip: 'Tilt a conveyor so it hauls the ball up to the ledge.' },
    { id: 'w2-8', world: 1, name: 'Garden Gauntlet', launcher: L,
      items: [ground(0, 360), ground(700, 1280), ['wall', 530, 650, 340, 40], ['water', 360, 480, 700, 640], ['fan', 980, 578, -90, 380, 3000], ['wall', 840, 470, 20, 260],
        ['conveyor', 560, 250, 300, 0, -260], ['wall', 1272, 330, 16, 580]].concat(cup(980, 220, 140, 60)),
      targets: [[980, 190], [1170, 568]],
      stars: [[292, 182], [1128, 117], [1245, 322]],
      inv: { plank: 1, spring: 1 }, par: 3, plan: [],
      tip: 'Pond, belt and breeze - light both targets.' },

    /* ═══════════════ World 3: Cryo Lab ═══════════════ */
    { id: 'w3-1', world: 2, name: 'Slippery Slope', launcher: L, aim: [-10, 30],
      items: [ground(), ['ice', 760, 520, 420, 16, -15], ['wall', 1000, 300, 560, 20], ['wall', 1110, 410, 340, 20], ['wall', 1272, 360, 16, 120]],
      targets: [[1200, 376]],
      stars: [[398, 435], [691, 375], [963, 386]],
      inv: {}, par: 2,
      tip: 'Ice has almost no grip - the ball keeps all its speed.' },
    { id: 'w3-2', world: 2, name: 'First Portal', launcher: L,
      items: [ground(), ['wall', 1000, 360, 16, 480], ['wall', 1140, 128, 296, 16], ['wall', 1272, 360, 16, 480], ['portal', 700, 300, 180, 1130, 300, 0]],
      targets: [[1200, 568]],
      stars: [[462, 365], [1181, 326], [1045, 491]],
      inv: {}, par: 1,
      tip: 'Whatever enters one portal leaves the other along its arrow.' },
    { id: 'w3-3', world: 2, name: 'Magnetic Bend', launcher: L, aim: [10, 55],
      items: [ground(), ['wall', 720, 380, 30, 440], ['magnet', 1000, 300, 240, 3400]].concat(cup(1000, 600, 150, 90)),
      targets: [[1000, 568]],
      stars: [[498, 210], [724, 89], [816, 223]],
      inv: { plank: 1 }, par: 2, plan: [],
      tip: 'The magnet pulls the steel ball toward it when it flies close.' },
    { id: 'w3-4', world: 2, name: 'Ice Rink', launcher: L, aim: [-10, 10],
      items: [ground(), ['ice', 760, 594, 960, 12], ['wall', 760, 380, 1040, 20], ['wall', 1272, 500, 16, 200]],
      targets: [[700, 470]],
      stars: [[329, 532], [450, 449], [566, 407]],
      inv: { spring: 1, bumper: 1 }, par: 2, plan: [['spring', 1180, 550, -45]],
      tip: 'The barrel only fires flat. Send the ball back up from the far end of the rink.' },
    { id: 'w3-5', world: 2, name: 'Portal Chain', launcher: L, aim: [20, 80],
      items: [ground(), ['wall', 400, 300, 20, 600], ['wall', 840, 300, 20, 600], ['portal', 300, 300, 0, 480, 560, 0], ['portal', 780, 570, 0, 900, 200, 0], ['wall', 1272, 500, 16, 200]],
      targets: [[1150, 568]],
      stars: [[338, 321], [727, 585], [1101, 313]],
      inv: { plank: 1 }, par: 2, plan: [],
      tip: 'Portals can chain. Follow the arrows through all three rooms.' },
    { id: 'w3-6', world: 2, name: 'Cold Storage', launcher: L, aim: [0, 30],
      items: [ground(), ['wall', 900, 450, 16, 300], ['wall', 1220, 450, 16, 300], ['glass', 1060, 300, 336, 14, 0, 600], ['ice', 1030, 450, 240, 14, 10], ['wall', 620, 470, 40, 260]],
      targets: [[1185, 566]],
      stars: [[390, 378], [489, 81], [1133, 337]],
      inv: { spring: 1, plank: 1 }, par: 2, plan: [],
      tip: 'The barrel fires low. Spring up, smash the glass roof and slide down the ice shelf.' },
    { id: 'w3-7', world: 2, name: 'Magnet Lift', launcher: L, aim: [-10, 30],
      items: [ground(), ['wall', 700, 260, 1200, 20], ['wall', 1110, 400, 320, 16], ['wall', 958, 360, 16, 96], ['wall', 1272, 400, 16, 400]],
      targets: [[1150, 370]],
      stars: [[489, 423], [838, 306], [992, 296]],
      inv: { magnet: 1, spring: 1 }, par: 2, plan: [['magnet', 1100, 300, 0], ['spring', 980, 575, 20]],
      tip: 'Place a magnet to tug the ball up onto the high shelf.' },
    { id: 'w3-8', world: 2, name: 'Lab Accident', launcher: L,
      items: [ground(), ['wall', 900, 420, 20, 360], ['glass', 1085, 420, 350, 12, 0, 560], ['portal', 640, 140, 0, 1200, 160, 180], ['magnet', 380, 420, 160, 2600], ['wall', 1272, 330, 16, 580]],
      targets: [[1080, 300], [1080, 568]],
      stars: [[381, 278], [746, 173], [1242, 463]],
      inv: { spring: 1, plank: 1, bumper: 1 }, par: 3, plan: [],
      tip: 'Portals, magnets and glass - light both targets.' },

    /* ═══════════════ World 4: Volcano Forge ═══════════════ */
    { id: 'w4-1', world: 3, name: 'Hot Floor', launcher: L,
      items: [ground(0, 400), ground(820, 1280), ['lava', 400, 610, 820, 660], ['wall', 610, 660, 420, 40], ['wall', 900, 500, 20, 200]],
      targets: [[1100, 568]],
      stars: [[335, 227], [624, 84], [907, 274]],
      inv: {}, par: 1,
      tip: 'Lava melts the ball on contact. Clear the pit.' },
    { id: 'w4-2', world: 3, name: 'Blast Door', launcher: L, aim: [-10, 30],
      items: [ground(), ['wall', 1000, 420, 560, 20], ['steel', 860, 578], ['steel', 860, 534], ['steel', 860, 490], ['tnt', 800, 578], ['wall', 1272, 520, 16, 160]],
      targets: [[1160, 568]],
      stars: [[430, 465], [794, 454], [986, 509]],
      inv: {}, par: 2,
      tip: 'TNT blows up under a hard hit. Clear the steel door.' },
    { id: 'w4-3', world: 3, name: 'Gear Gate', launcher: L, aim: [-10, 35],
      items: [ground(), ['wall', 700, 300, 1160, 20], ['paddle', 760, 470, 200, 2.2], ['wall', 760, 590, 30, 20], ['wall', 1272, 520, 16, 160]].concat(cup(1100, 600, 150, 80)),
      targets: [[1100, 570]],
      stars: [[398, 399], [687, 328], [951, 411]],
      inv: { plank: 1 }, par: 2, plan: [],
      tip: 'Gears start turning when you fire. Time your shot.' },
    { id: 'w4-4', world: 3, name: 'Chain Reaction', launcher: L,
      items: [ground(), ['tnt', 700, 578], ['tnt', 800, 578], ['tnt', 900, 578], ['wall', 1000, 470, 20, 260], ['steel', 1000, 320, 60, 40], ['wall', 1180, 420, 200, 16]],
      targets: [[1180, 568]],
      stars: [[883, 333], [978, 148], [1080, 371]],
      inv: { plank: 1 }, par: 2, plan: [],
      tip: 'One spark sets off the whole row.' },
    { id: 'w4-5', world: 3, name: 'Ore Belt', launcher: L, aim: [30, 80],
      items: [ground(0, 300), ground(980, 1280), ['lava', 300, 610, 980, 660], ['wall', 640, 660, 680, 40], ['conveyor', 640, 360, 420, 0, 360], ['wall', 1272, 520, 16, 160]].concat(cup(1150, 600, 140, 80)),
      targets: [[1150, 570]],
      stars: [[377, 329], [690, 334], [954, 357]],
      inv: { plank: 1, bumper: 1 }, par: 2, plan: [],
      tip: 'Land on the belt and let it carry the ball over the lava.' },
    { id: 'w4-6', world: 3, name: 'Hammer Swing', launcher: L, aim: [-10, 30],
      items: [ground(), ['wall', 700, 230, 1160, 20], ['swing', 700, 420, 220, 50, 0.5, 90], ['wall', 1272, 520, 16, 160], ['crate', 1000, 576], ['crate', 1000, 527]],
      targets: [[1160, 568]],
      stars: [[492, 565], [859, 583], [1015, 587]],
      inv: { spring: 1 }, par: 2, plan: [],
      tip: 'The hammer rocks back and forth. Slip under it or get batted.' },
    { id: 'w4-7', world: 3, name: 'Furnace Door', launcher: L,
      items: [ground(0, 560), ground(860, 1280), ['lava', 560, 610, 860, 660], ['wall', 710, 660, 300, 40], ['wall', 1070, 460, 420, 16], ['wall', 1272, 530, 16, 140],
        ['steel', 930, 578], ['steel', 930, 534], ['steel', 930, 490], ['tnt', 878, 578]],
      targets: [[1150, 568]],
      stars: [[534, 587], [434, 467], [864, 507]],
      inv: { plank: 1, block: 1 }, par: 2, plan: [],
      tip: 'Steel blocks the furnace door. The TNT in front of it can clear the way.' },
    { id: 'w4-8', world: 3, name: 'Meltdown', launcher: L,
      items: [ground(0, 480), ground(780, 1280), ['lava', 480, 610, 780, 660], ['wall', 630, 660, 300, 40], ['paddle', 630, 420, 180, -2], ['tnt', 1000, 578], ['steel', 1060, 578], ['wall', 1180, 400, 200, 16], ['glass', 1180, 470, 180, 12, 0, 500]],
      targets: [[1180, 368], [1180, 568]],
      stars: [[568, 317], [341, 371], [848, 342]],
      inv: { spring: 1, plank: 1, bumper: 1 }, par: 3, plan: [],
      tip: 'Lava, gears, glass and TNT - light both targets.' },

    /* ═══════════════ World 5: Orbit Station (low gravity) ═══════════════ */
    { id: 'w5-1', world: 4, name: 'Moon Lob', launcher: L,
      items: [ground(), ['wall', 640, 0, 1280, 20], ['wall', 700, 450, 60, 300]].concat(table(1060, 500, 120, 100)),
      targets: [[1060, 470]],
      stars: [[344, 334], [600, 240], [850, 319]],
      inv: {}, par: 1,
      tip: 'Gravity is weak up here. Gentle shots fly far.' },
    { id: 'w5-2', world: 4, name: 'Airlock', launcher: L, aim: [-10, 40],
      items: [ground(), ['wall', 640, 0, 1280, 20], ['wall', 820, 220, 20, 440], ['portal', 600, 520, 180, 1060, 120, 270], ['wall', 1272, 320, 16, 600]],
      targets: [[1060, 568]],
      stars: [[421, 587], [670, 587], [874, 587]],
      inv: {}, par: 1,
      tip: 'Through the airlock portal and down into the bay.' },
    { id: 'w5-3', world: 4, name: 'Orbit', launcher: L, aim: [0, 60],
      items: [ground(), ['wall', 640, 0, 1280, 20], ['magnet', 700, 300, 260, 1800], ['wall', 700, 470, 20, 260]].concat(cup(1100, 600, 150, 100)),
      targets: [[1100, 568]],
      stars: [[354, 360], [647, 251], [949, 370]],
      inv: { plank: 1 }, par: 2, plan: [],
      tip: 'Whip around the magnet like a moon round a planet.' },
    { id: 'w5-4', world: 4, name: 'Pinball Station', launcher: L,
      items: [ground(), ['wall', 640, 0, 1280, 20], ['bumper', 500, 300, 28], ['bumper', 700, 220, 28], ['bumper', 900, 320, 28], ['wall', 1000, 470, 20, 260], ['wall', 1272, 320, 16, 600]].concat(cup(1140, 600, 150, 90)),
      targets: [[1140, 570]],
      stars: [[381, 253], [993, 84], [1210, 309]],
      inv: { bumper: 1 }, par: 2, plan: [],
      tip: 'Ricochet through the bumper field.' },
    { id: 'w5-5', world: 4, name: 'Thrusters', launcher: L, aim: [-10, 15],
      items: [ground(), ['wall', 640, 0, 1280, 20], ['wall', 380, 320, 280, 20], ['wall', 1000, 320, 560, 20], ['wall', 1272, 450, 16, 260]],
      targets: [[620, 220]],
      stars: [[386, 532], [557, 479], [595, 370]],
      inv: { spring: 1, fan: 1 }, par: 2, plan: [['fan', 560, 560, 300]],
      tip: 'Fans push hard in low gravity. Blow the ball up through the gap.' },
    { id: 'w5-6', world: 4, name: 'Docking Bay', launcher: L, aim: [0, 50],
      items: [ground(), ['wall', 640, 0, 1280, 20], ['wall', 900, 200, 20, 400], ['wall', 1090, 400, 380, 20], ['portal', 600, 520, 180, 1180, 300, 180], ['glass', 1000, 500, 20, 180, 0, 400]],
      targets: [[1180, 568]],
      stars: [[452, 582], [752, 587], [990, 587]],
      inv: { plank: 1, spring: 1 }, par: 2, plan: [],
      tip: 'Two ways in. One goes through glass.' },
    { id: 'w5-7', world: 4, name: 'Gravity Well', launcher: L,
      items: [ground(), ['wall', 640, 0, 1280, 20], ['magnet', 640, 320, 300, 2200], ['magnet', 1000, 200, 200, 1800], ['wall', 820, 470, 20, 260], ['wall', 1272, 320, 16, 600]].concat(cup(1100, 600, 140, 80)),
      targets: [[1100, 570]],
      stars: [[501, 405], [991, 241], [1065, 376]],
      inv: { bumper: 1, plank: 1 }, par: 2, plan: [],
      tip: 'Two magnets bend space. Find the slingshot line.' },
    { id: 'w5-8', world: 4, name: 'Grand Finale', launcher: L,
      items: [ground(0, 400), ground(760, 1280), ['lava', 400, 610, 760, 660], ['wall', 580, 660, 360, 40], ['wall', 640, 0, 1280, 20], ['portal', 580, 400, 270, 1180, 120, 180],
        ['bumper', 860, 260, 26], ['tnt', 900, 578], ['wall', 1000, 470, 20, 260], ['glass', 1140, 420, 240, 12, 0, 480], ['paddle', 300, 250, 160, 1.6]],
      targets: [[1140, 568], [860, 120]],
      stars: [[339, 216], [872, 510], [1023, 327]],
      inv: { spring: 1, plank: 1, bumper: 1, magnet: 1 }, par: 3, plan: [],
      tip: 'Everything you have learned - light both targets.' }
  ];

  /*
   * Trick Shots: a campaign level with a stricter rule. oneShot: every target
   * in a single shot; minBounces: the ball must ricochet at least that often
   * before a target counts; noParts: the inventory is empty.
   */
  const TRICKS = [
    { id: 't1', base: 'w1-2', name: 'Bank Shot', rule: { minBounces: 2 }, desc: 'Light the target after at least 2 bounces.' },
    { id: 't2', base: 'w1-6', name: 'Ricochet Lid', rule: { minBounces: 2 }, desc: 'Bounce twice before the ball drops into the bin.' },
    { id: 't3', base: 'w2-4', name: 'Pachinko', rule: { minBounces: 3 }, desc: 'Rattle off at least 3 poles before the pot.' },
    { id: 't4', base: 'w2-8', name: 'Garden Tour', rule: { oneShot: true }, desc: 'Both targets in one shot.' },
    { id: 't5', base: 'w3-2', name: 'Long Way Round', rule: { minBounces: 2 }, desc: 'Bounce twice, then through the portal.' },
    { id: 't6', base: 'w3-8', name: 'Clean Sweep', rule: { oneShot: true }, desc: 'Both targets in one shot.' },
    { id: 't7', base: 'w4-4', name: 'Bare Hands', rule: { noParts: true }, desc: 'No parts at all.' },
    { id: 't8', base: 'w4-6', name: 'Hammer Time', rule: { minBounces: 3 }, desc: 'At least 3 ricochets before the target.' },
    { id: 't9', base: 'w5-4', name: 'Tilt!', rule: { minBounces: 4 }, desc: 'At least 4 ricochets before the cup.' },
    { id: 't10', base: 'w5-8', name: 'Finale Flourish', rule: { oneShot: true }, desc: 'Both targets in one shot.' }
  ];

  const BY_ID = {};
  for (const l of LEVELS)
    BY_ID[l.id] = l;

  function worldLevels(w) {
    return LEVELS.filter(l => l.world === w);
  }

  /* a trick shot as a playable level object */
  function trickLevel(t) {
    const base = BY_ID[t.base];
    return Object.assign({}, base, {
      id: 'trick-' + t.id, name: t.name, trick: t, rule: t.rule, par: 1,
      inv: t.rule.noParts ? {} : base.inv, stars: [], tip: t.desc
    });
  }

  SZ.PhysicsPuzzleLevels = Object.freeze({
    WORLDS: WORLDS, LEVELS: LEVELS, TRICKS: TRICKS, BY_ID: BY_ID, LEVELS_PER_WORLD: 8,
    worldLevels: worldLevels, trickLevel: trickLevel
  });
})();
