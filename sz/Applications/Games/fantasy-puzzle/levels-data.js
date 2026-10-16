;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Solver-verified levels: 40 campaign levels in five realms plus 60 bonus
   * trials. Every par was confirmed by the breadth-first solver in puzzle-core.js.
   * Open ground is floor; walls carry the structure and water and fire only come
   * from casts on channels and ice. Regenerate with tools/generate-levels.js --
   * the output is deterministic.
   */

  const REALMS = Object.freeze([
    Object.freeze({ id: 0, name: "Ember Grove", elements: Object.freeze(["fire"]), color: "#ff7a3a" }),
    Object.freeze({ id: 1, name: "Tide Caverns", elements: Object.freeze(["fire", "water"]), color: "#3ab4ff" }),
    Object.freeze({ id: 2, name: "Stone Peaks", elements: Object.freeze(["fire", "water", "earth"]), color: "#c9a36a" }),
    Object.freeze({ id: 3, name: "Sky Ruins", elements: Object.freeze(["fire", "water", "earth", "air"]), color: "#bfe8ff" }),
    Object.freeze({ id: 4, name: "Elemental Sanctum", elements: Object.freeze(["fire", "water", "earth", "air"]), color: "#c04cff" })
  ]);

  const CAMPAIGN = Object.freeze([
    Object.freeze({
      id: "1-1", realm: 0, name: "Kindling Path",
      grid: Object.freeze([
          "##########",
          "####.##..#",
          "####.#..##",
          "#r##.##.##",
          "#w##.i..G#",
          "#..w.#.###",
          "##.#.#...#",
          "##########"
      ]),
      hero: Object.freeze([5, 1]),
      par: 3, mana: 5, runes: 1,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "1-2", realm: 0, name: "Ashen Gate",
      grid: Object.freeze([
          "##########",
          "##.###...#",
          "#..#r#.#.#",
          "##.#w#.###",
          "#..#.w..G#",
          "##.#.##.##",
          "#..w.#...#",
          "##########"
      ]),
      hero: Object.freeze([2, 1]),
      par: 3, mana: 5, runes: 1,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "1-3", realm: 0, name: "Ember Hollow",
      grid: Object.freeze([
          "###########",
          "#..#..#..##",
          "##.##.#.#.#",
          "##.#..i...#",
          "#..##.#i#G#",
          "##.i..#r###",
          "#..##.#####",
          "###########"
      ]),
      hero: Object.freeze([1, 1]),
      par: 3, mana: 5, runes: 1,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "1-4", realm: 0, name: "Charred Crossing",
      grid: Object.freeze([
          "###########",
          "#.#########",
          "#..######G#",
          "##.##r##..#",
          "#..##i###.#",
          "##.w...##.#",
          "#..#.#.i..#",
          "###########"
      ]),
      hero: Object.freeze([2, 1]),
      par: 3, mana: 5, runes: 1,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "1-5", realm: 0, name: "Cinder Step",
      grid: Object.freeze([
          "###########",
          "##..#..##G#",
          "##.###.#..#",
          "#..###.##.#",
          "#.#.w..##.#",
          "#...##.i..#",
          "##w##..##.#",
          "##r##.###.#",
          "###########"
      ]),
      hero: Object.freeze([5, 1]),
      par: 3, mana: 5, runes: 1,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "1-6", realm: 0, name: "Blazing Way",
      grid: Object.freeze([
          "###########",
          "#..##.#..##",
          "##.i..#.###",
          "#..##.#.###",
          "##i#..#..##",
          "##r##.#.#G#",
          "####..w...#",
          "#####.#.#.#",
          "###########"
      ]),
      hero: Object.freeze([3, 1]),
      par: 3, mana: 5, runes: 1,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "1-7", realm: 0, name: "Flame Thicket",
      grid: Object.freeze([
          "############",
          "##.#..#.#.##",
          "#..##.i...G#",
          "##.#..#i#i##",
          "#..##.#r#r##",
          "##.w..######",
          "#..#.#######",
          "##.#..######",
          "############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 4, mana: 6, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "1-8", realm: 0, name: "Pyre Gate",
      grid: Object.freeze([
          "############",
          "#r#.#.##.#G#",
          "#w#.#.w....#",
          "#...#.#w#.##",
          "#.#.#.#r#..#",
          "#.#.#.##..##",
          "##..w.###.##",
          "#..##.######",
          "############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 4, mana: 6, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "2-1", realm: 1, name: "Mirror Tide",
      grid: Object.freeze([
          "###########",
          "##.##.#.#.#",
          "#..i..#.#.#",
          "##.##.~...#",
          "#w.##i#.#.#",
          "##.##r##..#",
          "#..######G#",
          "###########"
      ]),
      hero: Object.freeze([6, 1]),
      par: 3, mana: 5, runes: 1,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "2-2", realm: 1, name: "Flooded Hall",
      grid: Object.freeze([
          "###########",
          "#..w..##.##",
          "##.##.~...#",
          "##.##.#.#G#",
          "#..#..#..##",
          "#i##.##.###",
          "#r##..#...#",
          "###########"
      ]),
      hero: Object.freeze([4, 1]),
      par: 3, mana: 5, runes: 1,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "2-3", realm: 1, name: "Channel Run",
      grid: Object.freeze([
          "###########",
          "#..#.###.##",
          "##.#..~...#",
          "#..##.#i#G#",
          "##.#..#r###",
          "##.##.#####",
          "#..w..#####",
          "###########"
      ]),
      hero: Object.freeze([3, 1]),
      par: 3, mana: 5, runes: 1,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "2-4", realm: 1, name: "Welling Gate",
      grid: Object.freeze([
          "###########",
          "#..####.#.#",
          "##.####...#",
          "#..####.###",
          "##.#r##.#G#",
          "##.#~##.#.#",
          "#..~..w...#",
          "###########"
      ]),
      hero: Object.freeze([1, 1]),
      par: 3, mana: 5, runes: 1,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "2-5", realm: 1, name: "Still Basin",
      grid: Object.freeze([
          "############",
          "#...#..#####",
          "#.#.#.######",
          "###.#..##r##",
          "#...##.##i##",
          "###.##.w...#",
          "#...~..#w#.#",
          "#.#.#.##r#G#",
          "############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 4, mana: 6, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "2-6", realm: 1, name: "Rain Corridor",
      grid: Object.freeze([
          "############",
          "#...#r#.#.##",
          "#.#.#w#.#..#",
          "###.~.#.#.##",
          "#...#.i....#",
          "#.#.#~#.##.#",
          "##..#r#..#G#",
          "###.####..##",
          "############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 4, mana: 6, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "2-7", realm: 1, name: "Undertow",
      grid: Object.freeze([
          "############",
          "##r#####...#",
          "##i######.##",
          "#...#####..#",
          "#.#.####..##",
          "##..##r#.#G#",
          "#.#.##w#.#.#",
          "#...w..~...#",
          "############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 4, mana: 6, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "2-8", realm: 1, name: "Tideway",
      grid: Object.freeze([
          "############",
          "#..i...#####",
          "##w#.#.###G#",
          "##r#.#.##..#",
          "#####..#r#.#",
          "####.#.#w#.#",
          "####.#.~...#",
          "####...#.#.#",
          "############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 4, mana: 6, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "3-1", realm: 2, name: "Granite Steps",
      grid: Object.freeze([
          "############",
          "#..###.#####",
          "##.###.#~#G#",
          "#..###._...#",
          "##.#.#.##~##",
          "#..#.#.##r##",
          "##.#.#.#####",
          "#..~.w.#####",
          "############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 4, mana: 6, runes: 1,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "3-2", realm: 2, name: "Stone Bridge",
      grid: Object.freeze([
          "############",
          "#..######..#",
          "#.####.#..##",
          "#..#r#.##.##",
          "##.#~#.w..G#",
          "#..#w#.#.###",
          "##._.#.#..##",
          "#..#.~.#.###",
          "############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 5, mana: 7, runes: 1,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "3-3", realm: 2, name: "Chasm Walk",
      grid: Object.freeze([
          "############",
          "##.#.#######",
          "#..~.#r#.#G#",
          "##.#.#w#.#.#",
          "##.#.#_#.#.#",
          "##.#.#.i...#",
          "#..#._.#.#.#",
          "##.#.#.###.#",
          "############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 5, mana: 7, runes: 1,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "3-4", realm: 2, name: "Basalt Gate",
      grid: Object.freeze([
          "############",
          "######.##.##",
          "#.##r#._...#",
          "#..#~#.#.#G#",
          "##.#_#.#.###",
          "#..~.#.#...#",
          "##.#.w.#.#.#",
          "#..#.###.###",
          "############"
      ]),
      hero: Object.freeze([7, 1]),
      par: 5, mana: 7, runes: 1,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "3-5", realm: 2, name: "Quarry Path",
      grid: Object.freeze([
          "#############",
          "####.i._...G#",
          "####.#.##i###",
          "####.#.##r###",
          "####.#.######",
          "#r##.#.######",
          "#_##.#.######",
          "#..~.#.######",
          "#############"
      ]),
      hero: Object.freeze([7, 1]),
      par: 5, mana: 7, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "3-6", realm: 2, name: "Stonefall",
      grid: Object.freeze([
          "#############",
          "#..###._...G#",
          "##.#r#.##.###",
          "#..#~#.#..#.#",
          "##.w.~.##...#",
          "#..#w#.###.##",
          "#.##r#.######",
          "#..###.######",
          "#############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 5, mana: 7, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "3-7", realm: 2, name: "Rift Crossing",
      grid: Object.freeze([
          "#############",
          "##.#####...##",
          "#..#.#.#.##G#",
          "##.#.~.i....#",
          "#.._.#.#_#.##",
          "#_##.#.#r#..#",
          "#r##.#.####.#",
          "####.######.#",
          "#############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 5, mana: 7, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "3-8", realm: 2, name: "High Stone",
      grid: Object.freeze([
          "#############",
          "####.#.######",
          "##.#._.#r####",
          "##.~.#.#~####",
          "#..#~#.i....#",
          "##.#_#.#.##.#",
          "####r###.#..#",
          "########..#G#",
          "#############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 6, mana: 8, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "4-1", realm: 3, name: "Gale Bridge",
      grid: Object.freeze([
          "#############",
          "########.#.##",
          "#.######.~.G#",
          "#..#r###.#.##",
          "#.##w###.#..#",
          "#..#.B_i.#.##",
          "##._.###~#.##",
          "##.#.###r#.##",
          "#############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 6, mana: 8, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "4-2", realm: 3, name: "Boulder Lane",
      grid: Object.freeze([
          "#############",
          "##.B_########",
          "#..#.#.######",
          "##.#.#.######",
          "##.#.#.###r##",
          "#..#._.#.#w##",
          "#_##.#.~.i..#",
          "#r##.#.#.##G#",
          "#############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 6, mana: 8, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "4-3", realm: 3, name: "Wind Push",
      grid: Object.freeze([
          "#############",
          "######.#.##G#",
          "####.~._.#..#",
          "####.#.#.##.#",
          "#r##.#.#.##.#",
          "#~##.#.#.w..#",
          "#..B_###.#w##",
          "#.########r##",
          "#############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 6, mana: 8, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "4-4", realm: 3, name: "Sky Corridor",
      grid: Object.freeze([
          "#############",
          "####.i.#.##r#",
          "####.#.#.##~#",
          "####.#.#.~..#",
          "#..B_#.#.##.#",
          "#.####._.##G#",
          "#..###w#.####",
          "#.####r#.####",
          "#############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 6, mana: 8, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "4-5", realm: 3, name: "Gust Gate",
      grid: Object.freeze([
          "##############",
          "############G#",
          "####r#._.###.#",
          "####_#.#.###.#",
          "####_#.#.###.#",
          "#..#.B_#.w...#",
          "##.~.#####.#~#",
          "####.#######r#",
          "##############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 7, mana: 9, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "4-6", realm: 3, name: "Rolling Stone",
      grid: Object.freeze([
          "##############",
          "####.B_###.#.#",
          "####.#.#._...#",
          "##r#.#.~.#.#.#",
          "##_#.#w#####G#",
          "##w#.#r#######",
          "#..i.#########",
          "####.#########",
          "##############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 7, mana: 9, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "4-7", realm: 3, name: "Cloud Passage",
      grid: Object.freeze([
          "##############",
          "##############",
          "##.###########",
          "#..#########G#",
          "##.###r####..#",
          "#..###_#r#.#.#",
          "##.B_#~#w#.#.#",
          "##.#.~._.w...#",
          "##############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 7, mana: 9, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "4-8", realm: 3, name: "Zephyr Way",
      grid: Object.freeze([
          "##############",
          "##.B_#r#######",
          "#..#.#_#.###G#",
          "#.##.#_#.##..#",
          "####.i._.###.#",
          "######.#.~...#",
          "########.##w##",
          "###########r##",
          "##############"
      ]),
      hero: Object.freeze([2, 1]),
      par: 7, mana: 9, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "5-1", realm: 4, name: "Sanctum Gate",
      grid: Object.freeze([
          "#############",
          "######r#.####",
          "######i#.####",
          "#..###w#.####",
          "##.B_~.i.##G#",
          "#..###w#.##.#",
          "#.####r#._..#",
          "#..#####.#.##",
          "#############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 7, mana: 9, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "5-2", realm: 4, name: "Elemental Trial",
      grid: Object.freeze([
          "#############",
          "#..#####.####",
          "##.#._.#.~.G#",
          "##.#.#.w.#.##",
          "##.#.#w#_#.##",
          "#..#.#r#w####",
          "##.B_###r####",
          "#############",
          "#############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 7, mana: 9, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "5-3", realm: 4, name: "Convergence",
      grid: Object.freeze([
          "############",
          "#r##.#.i.~.#",
          "#~##._.#~#G#",
          "#..#.#.#_###",
          "##.#.#.#w###",
          "#..B_#.#r###",
          "############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 8, mana: 10, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "5-4", realm: 4, name: "Fourfold Path",
      grid: Object.freeze([
          "############",
          "##.~.w.###G#",
          "##.#i#.###.#",
          "##.#~#.B_#.#",
          "##.#_#w#.#.#",
          "#..#r#r#._.#",
          "############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 8, mana: 10, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "5-5", realm: 4, name: "Sigil Hall",
      grid: Object.freeze([
          "############",
          "#r##.B_###G#",
          "#~##.#.###.#",
          "#w##.#.#r#.#",
          "#~##.#.#i#.#",
          "#..~.#._.i.#",
          "############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 8, mana: 10, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "5-6", realm: 4, name: "Elemental Crown",
      grid: Object.freeze([
          "############",
          "####r#.#.###",
          "#r##i#.#.###",
          "#w##w#.#.###",
          "#..#i#.#._G#",
          "##.i.~.B_###",
          "############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 8, mana: 10, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "5-7", realm: 4, name: "Inner Sanctum",
      grid: Object.freeze([
          "############",
          "#..###r#.#G#",
          "##.###~#._.#",
          "#..###_#.#~#",
          "##.B_#~#.#r#",
          "#..#.w.~.###",
          "############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 8, mana: 10, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "5-8", realm: 4, name: "Heart of Elements",
      grid: Object.freeze([
          "############",
          "##.#.B_i.~G#",
          "#.._.###~###",
          "##.#w###_###",
          "#..#~###i###",
          "##.#r###r###",
          "############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 9, mana: 11, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    })
  ]);

  const BONUS = Object.freeze([
    Object.freeze({
      id: "T1", realm: -1, name: "Trial 1",
      grid: Object.freeze([
          "##########",
          "#.##.#...#",
          "#..w.#.#.#",
          "##i#.#..##",
          "##i#.#.#G#",
          "##r#.w...#",
          "####.#.#.#",
          "##########"
      ]),
      hero: Object.freeze([2, 1]),
      par: 4, mana: 5, runes: 1,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T2", realm: -1, name: "Trial 2",
      grid: Object.freeze([
          "###########",
          "#.#.##.##G#",
          "#...w..~..#",
          "#.#.#~##.##",
          "##..#w##..#",
          "#.#.#r##.##",
          "#...####..#",
          "###########"
      ]),
      hero: Object.freeze([6, 1]),
      par: 4, mana: 5, runes: 1,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T3", realm: -1, name: "Trial 3",
      grid: Object.freeze([
          "############",
          "#.##._.#.#.#",
          "#.##.#.~...#",
          "#..#.#.#i#.#",
          "##.#.#.#r#.#",
          "##.#.#.###.#",
          "#..#.#.#...#",
          "##.w.###.#G#",
          "############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 4, mana: 5, runes: 1,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T4", realm: -1, name: "Trial 4",
      grid: Object.freeze([
          "#############",
          "#.######.#..#",
          "#..#r###.#.##",
          "##.#i###.w..#",
          "##.#.B_#.##.#",
          "#..~.#._.##.#",
          "#.##w#.#.#..#",
          "#..#r#.#.##G#",
          "#############"
      ]),
      hero: Object.freeze([2, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T5", realm: -1, name: "Trial 5",
      grid: Object.freeze([
          "##############",
          "##.###.#.#####",
          "#..#._.i.#####",
          "##.#.#.#.#r#G#",
          "#..#.#.#.#i#.#",
          "##.#.#.#.~...#",
          "#..#.#.#.##~##",
          "##.B_#.#.##r##",
          "#..###.#.#####",
          "##############"
      ]),
      hero: Object.freeze([2, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "T6", realm: -1, name: "Trial 6",
      grid: Object.freeze([
          "###########",
          "#.##..w...#",
          "#..##.#i#.#",
          "#.##..#i#.#",
          "#..##.#r#G#",
          "##.i..#####",
          "#..##.#####",
          "#.##..#####",
          "###########"
      ]),
      hero: Object.freeze([4, 1]),
      par: 4, mana: 5, runes: 1,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T7", realm: -1, name: "Trial 7",
      grid: Object.freeze([
          "############",
          "#.#.##.#..##",
          "#...i..##..#",
          "###.##.#r#.#",
          "#r#.##.#~#.#",
          "#~#.#..~...#",
          "#...##.#.#.#",
          "#.#.#..#.#G#",
          "############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T8", realm: -1, name: "Trial 8",
      grid: Object.freeze([
          "#############",
          "#..#.#.###r##",
          "##.#.~.#w#w##",
          "#..#.#.w....#",
          "##._.#_#.##G#",
          "#..#.#r#..###",
          "##.#.####...#",
          "#..#.###..###",
          "#############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 5, mana: 6, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "T9", realm: -1, name: "Trial 9",
      grid: Object.freeze([
          "##############",
          "#..###.#._...#",
          "##.###.~.#w#G#",
          "#..###.#w#r###",
          "##.###.#r#####",
          "##.###.#######",
          "#..B_#.#######",
          "##.#.#.#######",
          "#..#.w.#######",
          "##############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "T10", realm: -1, name: "Trial 10",
      grid: Object.freeze([
          "##############",
          "####.#.#.#.#.#",
          "##r#.#.#.~...#",
          "##i#._.w.#.#.#",
          "#..B_#w#.##..#",
          "##.###r#.#.#.#",
          "#..#####.#...#",
          "#.######.#.#G#",
          "#..#####.#..##",
          "##############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T11", realm: -1, name: "Trial 11",
      grid: Object.freeze([
          "############",
          "#..#..##.#G#",
          "##.##.i....#",
          "#..w..#w##w#",
          "##.##.#r##r#",
          "#..##.######",
          "##.#..######",
          "#..#.#######",
          "############"
      ]),
      hero: Object.freeze([7, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T12", realm: -1, name: "Trial 12",
      grid: Object.freeze([
          "############",
          "#.#.##.#.#.#",
          "#...#..~...#",
          "#~#.##.#w#.#",
          "#r#.##.#r#G#",
          "###.#..#####",
          "#...##.#####",
          "#.#.i..#####",
          "############"
      ]),
      hero: Object.freeze([2, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T13", realm: -1, name: "Trial 13",
      grid: Object.freeze([
          "#############",
          "####.#._....#",
          "#r##.i.#.##.#",
          "#w##.#_#.##.#",
          "#..#.#r##...#",
          "##.#.###..#.#",
          "#~.#.###.##G#",
          "##.~.###...##",
          "#############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 5, mana: 6, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T14", realm: -1, name: "Trial 14",
      grid: Object.freeze([
          "##############",
          "######.#.###.#",
          "######.#.B_..#",
          "######.~.###.#",
          "##r###.#.#.#.#",
          "##i#r#.#.#...#",
          "#..#~#.#.#.#.#",
          "##._.#.#.#.#G#",
          "##.#.w.#.#..##",
          "##############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T15", realm: -1, name: "Trial 15",
      grid: Object.freeze([
          "##############",
          "##.i.###.#..##",
          "#..#.###.#.#G#",
          "##.#.###.~...#",
          "#..#.###.#~#.#",
          "##.#.###.#r#.#",
          "#..#.###.###.#",
          "#_##.B__.##..#",
          "#r##.###.#..##",
          "##############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T16", realm: -1, name: "Trial 16",
      grid: Object.freeze([
          "############",
          "####..######",
          "#####.######",
          "####..##r###",
          "##r##.##i###",
          "##w##.i...G#",
          "##.i..#.#.##",
          "#..#.###...#",
          "############"
      ]),
      hero: Object.freeze([7, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T17", realm: -1, name: "Trial 17",
      grid: Object.freeze([
          "############",
          "##..#..#..##",
          "#.#.#.##.#G#",
          "#.#.i..~...#",
          "#...##.#~#.#",
          "##w##..#r#.#",
          "##r###.##..#",
          "#####..###.#",
          "############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T18", realm: -1, name: "Trial 18",
      grid: Object.freeze([
          "#############",
          "##.i.###..###",
          "#..#.###.####",
          "##.#.###..###",
          "#..#.#.#.#r##",
          "#w##.#.#.#w##",
          "#r##._.~...G#",
          "####.#.#.#.##",
          "#############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 5, mana: 6, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T19", realm: -1, name: "Trial 19",
      grid: Object.freeze([
          "##############",
          "##r#####.~...#",
          "##i#####.#.#.#",
          "#..#####.#.#.#",
          "##.#####.#.#.#",
          "#..###r#.###.#",
          "##.###w#.#...#",
          "#..B__.i.#.#G#",
          "#.####.#.#..##",
          "##############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T20", realm: -1, name: "Trial 20",
      grid: Object.freeze([
          "##############",
          "##.#._.#######",
          "#..#.#.#######",
          "##.#.#.#######",
          "##.~.#.#r#####",
          "#w.#.#.#~##r##",
          "##.#.#.i.##w##",
          "##.#.#.#.B_.G#",
          "#..#.#.#.##.##",
          "##############"
      ]),
      hero: Object.freeze([8, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T21", realm: -1, name: "Trial 21",
      grid: Object.freeze([
          "############",
          "##.#########",
          "#...#r####G#",
          "#.#.#w###..#",
          "##..i..#.#.#",
          "#.#.##.i...#",
          "#...##.#.#i#",
          "##.##..#.#r#",
          "############"
      ]),
      hero: Object.freeze([2, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T22", realm: -1, name: "Trial 22",
      grid: Object.freeze([
          "############",
          "##.#..##.#.#",
          "#..##..~...#",
          "##.#.#.#i#.#",
          "#..i...#r#.#",
          "##~#.#i##..#",
          "####.#r###G#",
          "####..######",
          "############"
      ]),
      hero: Object.freeze([2, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T23", realm: -1, name: "Trial 23",
      grid: Object.freeze([
          "#############",
          "##.#.i.~....#",
          "#.._.#_##.#G#",
          "##.#.#r#...##",
          "#..#.#####..#",
          "#i##.###...##",
          "#r##.#####.##",
          "########....#",
          "#############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 5, mana: 6, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "T24", realm: -1, name: "Trial 24",
      grid: Object.freeze([
          "##############",
          "##.###.~.##..#",
          "#..#.#.#.##.##",
          "#.##.#.#.##..#",
          "#..#.#.#.#..##",
          "#.##._.#.##.##",
          "#..B_#~#.i..G#",
          "##.###r#.#w###",
          "#..#####.#r###",
          "##############"
      ]),
      hero: Object.freeze([8, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "T25", realm: -1, name: "Trial 25",
      grid: Object.freeze([
          "##############",
          "##.#.###.B_..#",
          "#..i.###.###.#",
          "##.#.#r#.#.#.#",
          "##.#.#_#.#...#",
          "#..#.#._.#.#G#",
          "#i##.#.#w#..##",
          "#r##.#.#######",
          "####.~.#######",
          "##############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T26", realm: -1, name: "Trial 26",
      grid: Object.freeze([
          "############",
          "#.###.#w##G#",
          "#..#..w....#",
          "##.##.##w#.#",
          "##.w..##r#.#",
          "#..##w####.#",
          "#.###r##...#",
          "#..####..#.#",
          "############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T27", realm: -1, name: "Trial 27",
      grid: Object.freeze([
          "############",
          "#...#..w...#",
          "#w#.##.#.#G#",
          "#r#.##.#.###",
          "##..~..#...#",
          "###.##i#.#.#",
          "##..##r#..##",
          "#..#####.###",
          "############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T28", realm: -1, name: "Trial 28",
      grid: Object.freeze([
          "#############",
          "#..i.#.######",
          "##.#.#.##r#G#",
          "##.#.#.##_#.#",
          "#..#.#.~....#",
          "##.#.#.#.#i##",
          "#..#._.#.#r##",
          "##.#.#.#..###",
          "#############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 5, mana: 6, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T29", realm: -1, name: "Trial 29",
      grid: Object.freeze([
          "##############",
          "#..#####.w...#",
          "##.#####.#w#.#",
          "#..###r#.###.#",
          "##.B_#w#.#...#",
          "#..#.~._.#.#G#",
          "##.#~#.#.#..##",
          "#..#r#.#.##.##",
          "#.######.##.##",
          "##############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "T30", realm: -1, name: "Trial 30",
      grid: Object.freeze([
          "##############",
          "#..###.#######",
          "#.####.#######",
          "#..#r#.#######",
          "##.#_#.#.#####",
          "#.._.#.#.#r###",
          "##.#.~.#.#w#G#",
          "#..#.#.#.w...#",
          "##.#.#.B_##w##",
          "##############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "T31", realm: -1, name: "Trial 31",
      grid: Object.freeze([
          "############",
          "#.#.i.##.###",
          "#...#.w...G#",
          "#i#.#.#.#w##",
          "#r#.#.#.#r##",
          "##..#.#.####",
          "##.##.#....#",
          "#####.#.#.##",
          "############"
      ]),
      hero: Object.freeze([2, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T32", realm: -1, name: "Trial 32",
      grid: Object.freeze([
          "############",
          "####...#.#G#",
          "#####.##.#.#",
          "####...~...#",
          "#r####.#.#~#",
          "#~##.#.#.#r#",
          "#..w...#..##",
          "##.#.#.##..#",
          "############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T33", realm: -1, name: "Trial 33",
      grid: Object.freeze([
          "#############",
          "#..###.~....#",
          "#.##.#.##~#.#",
          "#..#.#.##r#.#",
          "##.#.#.###..#",
          "#.._.#.####G#",
          "#~##.i.######",
          "#r##.#.######",
          "#############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 5, mana: 6, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "T34", realm: -1, name: "Trial 34",
      grid: Object.freeze([
          "##############",
          "#..#.#####..##",
          "##.#.B_#.#.#.#",
          "#..#.#.#.~...#",
          "##.#.#.#.#.#.#",
          "#..#.#.#.###.#",
          "##.i.#._.#...#",
          "##i#~#.#.#.#G#",
          "##r#r#.#.#####",
          "##############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T35", realm: -1, name: "Trial 35",
      grid: Object.freeze([
          "##############",
          "##.#####.B_..#",
          "#..###.#.###.#",
          "#.####.#.#...#",
          "#..#r#.#.#.#.#",
          "##.#w#.#.#.#G#",
          "#..w.#.#.#..##",
          "##_#._.~.##..#",
          "##r#.#.#.###.#",
          "##############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T36", realm: -1, name: "Trial 36",
      grid: Object.freeze([
          "############",
          "##.##..w...#",
          "#...##.#i#.#",
          "#.#.w..#r#.#",
          "##..##i###.#",
          "#..###r#...#",
          "##..####.#G#",
          "#..#####..##",
          "############"
      ]),
      hero: Object.freeze([2, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T37", realm: -1, name: "Trial 37",
      grid: Object.freeze([
          "############",
          "#r#.##.~...#",
          "#i#.w..#.#.#",
          "#...##i##..#",
          "#.#.##r###G#",
          "#.#.########",
          "##..########",
          "###.########",
          "############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T38", realm: -1, name: "Trial 38",
      grid: Object.freeze([
          "#############",
          "#.##r#.#..#G#",
          "#..#_#.#.##.#",
          "##.#._.w....#",
          "#..#.#.#.##~#",
          "##.#.#.#..#r#",
          "#..~.###.####",
          "#.##.###.####",
          "#############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 5, mana: 6, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T39", realm: -1, name: "Trial 39",
      grid: Object.freeze([
          "##############",
          "##r#.#.###.#.#",
          "##_#._.B_~...#",
          "#..i.#.###.#.#",
          "##.#w#.####..#",
          "##.#r#.#####.#",
          "#..###.#####G#",
          "##.###.#######",
          "#..###.#######",
          "##############"
      ]),
      hero: Object.freeze([8, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "T40", realm: -1, name: "Trial 40",
      grid: Object.freeze([
          "##############",
          "#..#.#.#.~..G#",
          "#.##.#.#.##.##",
          "#..#.i.#.#...#",
          "##.#.#.#.##.##",
          "##._.#.#.#####",
          "#..#w#.#.#####",
          "##w#r#.#.#####",
          "##r###.B_#####",
          "##############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "T41", realm: -1, name: "Trial 41",
      grid: Object.freeze([
          "############",
          "#..##.#.####",
          "#.##..#..###",
          "#..##.#.#r##",
          "##.i..#.#w##",
          "##w##.w....#",
          "##r#..##.#G#",
          "#####.#...##",
          "############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T42", realm: -1, name: "Trial 42",
      grid: Object.freeze([
          "############",
          "##.###.#####",
          "#...~..#####",
          "##w###.##r##",
          "##r###.##i##",
          "#####..w..G#",
          "######.##.##",
          "#####..#...#",
          "############"
      ]),
      hero: Object.freeze([2, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T43", realm: -1, name: "Trial 43",
      grid: Object.freeze([
          "#############",
          "#..#.#.######",
          "##.#.#.##r###",
          "##.#.~.##w###",
          "#..#.#.i...G#",
          "##.#.#.#w#.##",
          "#.._.#.#r#..#",
          "##.#.#.####.#",
          "#############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 5, mana: 6, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "T44", realm: -1, name: "Trial 44",
      grid: Object.freeze([
          "##############",
          "####.#########",
          "##r#.######..#",
          "##_#.#r###..##",
          "#..#.#w###.###",
          "##.#.i.B_#.#G#",
          "#..#.#.#.#.#.#",
          "##.~.#.#._...#",
          "#..#.#.#.##.##",
          "##############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "T45", realm: -1, name: "Trial 45",
      grid: Object.freeze([
          "##############",
          "##.###.~.##.##",
          "#..###.#._...#",
          "##.B_#.#_#.#G#",
          "#..#.#.#r#.###",
          "##.#.#.###...#",
          "#..#.w.###.#.#",
          "##.#w#.####..#",
          "#..#r#.###..##",
          "##############"
      ]),
      hero: Object.freeze([8, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Air pushes the boulder rightwards, filling the chasm behind it."
    }),
    Object.freeze({
      id: "T46", realm: -1, name: "Trial 46",
      grid: Object.freeze([
          "############",
          "#..w..####.#",
          "##.##.##r#.#",
          "#..#..##w#.#",
          "##.##.i....#",
          "##.##.##i#G#",
          "#..#..##r###",
          "##.#.#######",
          "############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T47", realm: -1, name: "Trial 47",
      grid: Object.freeze([
          "############",
          "#.#####..#G#",
          "#..####.##.#",
          "#.#####....#",
          "#..####.##.#",
          "##.##r##r#.#",
          "##.##i##w#.#",
          "#..~..i....#",
          "############"
      ]),
      hero: Object.freeze([4, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T48", realm: -1, name: "Trial 48",
      grid: Object.freeze([
          "#############",
          "#..#.#.######",
          "##.w.#.####G#",
          "#..#.#.#r#..#",
          "##.#.#.#w##.#",
          "#..#.~._....#",
          "#.##~#.##.#.#",
          "#.##r#.#..#.#",
          "#############"
      ]),
      hero: Object.freeze([3, 1]),
      par: 5, mana: 6, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T49", realm: -1, name: "Trial 49",
      grid: Object.freeze([
          "##############",
          "##.w.#.####..#",
          "#..#.#.###..##",
          "#.##.#.#~##.##",
          "#..#._.#.B_.G#",
          "#.##_#.~.##~##",
          "#.##r#.#.##r##",
          "######.#.#####",
          "######.#.#####",
          "##############"
      ]),
      hero: Object.freeze([2, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T50", realm: -1, name: "Trial 50",
      grid: Object.freeze([
          "##############",
          "##.###.B_#..##",
          "##.#r#.#.#.#G#",
          "#..#_#.#._...#",
          "#.##.w.#.##w##",
          "#..#.#.#.##r##",
          "##.#.#.#.#####",
          "##.~.#.#.#####",
          "#..#.#.#.#####",
          "##############"
      ]),
      hero: Object.freeze([8, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T51", realm: -1, name: "Trial 51",
      grid: Object.freeze([
          "############",
          "#.##.#.#####",
          "#..w...#r#G#",
          "##.#i#.#i#.#",
          "#..#r#.w...#",
          "##.###.#.###",
          "#..#...#...#",
          "##.#.#.##.##",
          "############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire spreads through connected wood."
    }),
    Object.freeze({
      id: "T52", realm: -1, name: "Trial 52",
      grid: Object.freeze([
          "############",
          "#..##.#..###",
          "#.###.#.####",
          "#.#r#.#...##",
          "#.#~#.#.####",
          "#...w.#...##",
          "#w#.#.#.##G#",
          "#r#.#.~....#",
          "############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T53", realm: -1, name: "Trial 53",
      grid: Object.freeze([
          "#############",
          "#..#.#.#.#..#",
          "##._.#.#...##",
          "##.#.#.##.#G#",
          "#..#.#.w....#",
          "##.#.~.##_#~#",
          "#..#.#.##r#r#",
          "#.##.#.######",
          "#############"
      ]),
      hero: Object.freeze([6, 1]),
      par: 5, mana: 6, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "T54", realm: -1, name: "Trial 54",
      grid: Object.freeze([
          "##############",
          "####.B_#.#.#r#",
          "####.#.w.#.#~#",
          "####.#~#._...#",
          "#.##.#r#.#.#.#",
          "#..#.###.##..#",
          "#.##.###.###.#",
          "#..~.###.#...#",
          "##.#.#####.#G#",
          "##############"
      ]),
      hero: Object.freeze([7, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T55", realm: -1, name: "Trial 55",
      grid: Object.freeze([
          "##############",
          "##.#.#.#.#.#G#",
          "#~.~.#.#._...#",
          "##.#.#.#.##_##",
          "#..#.#.#.##r##",
          "##.#.#.#.#####",
          "#..#.#.i.#####",
          "##.#.B_#_#####",
          "#..#.###r#####",
          "##############"
      ]),
      hero: Object.freeze([8, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T56", realm: -1, name: "Trial 56",
      grid: Object.freeze([
          "############",
          "#.#.#.#.#r##",
          "#.#.#.#.#i##",
          "#.#.#.w...G#",
          "#...i.##i###",
          "#.#.#.##r###",
          "###.#.######",
          "#...#.######",
          "############"
      ]),
      hero: Object.freeze([7, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Fire melts ice into water."
    }),
    Object.freeze({
      id: "T57", realm: -1, name: "Trial 57",
      grid: Object.freeze([
          "############",
          "#..#..#.#.##",
          "##.##.i....#",
          "#..#..#~##.#",
          "##.##.#r##.#",
          "#..~..##...#",
          "##.##i#..#G#",
          "#..##r##..##",
          "############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 4, mana: 5, runes: 2,
      hint: "Water floods a channel network and opens it."
    }),
    Object.freeze({
      id: "T58", realm: -1, name: "Trial 58",
      grid: Object.freeze([
          "#############",
          "#..#r#.##...#",
          "##.#~#.#..###",
          "#.._.#.##.#G#",
          "#.##.#.~....#",
          "#..#.#.#.#_##",
          "####.w.#.#r##",
          "####.#.#..###",
          "#############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 5, mana: 6, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "T59", realm: -1, name: "Trial 59",
      grid: Object.freeze([
          "##############",
          "#..#.#.#r#r#.#",
          "##._.#.#w#~#.#",
          "##.#.#.#.~...#",
          "#..#.#.#.###.#",
          "##.#.i.#.#.#.#",
          "####.#.#.#...#",
          "####.#.#.#.#G#",
          "####.#.B_#..##",
          "##############"
      ]),
      hero: Object.freeze([1, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Earth fills a chasm to bridge the gap."
    }),
    Object.freeze({
      id: "T60", realm: -1, name: "Trial 60",
      grid: Object.freeze([
          "##############",
          "##.w.#.#.###.#",
          "#..#.#._.B_..#",
          "##.#.#.#~###.#",
          "##.#.#.#r#...#",
          "#..#.~.#####.#",
          "##.#_#.###...#",
          "#..#r#.#####G#",
          "##.###.#######",
          "##############"
      ]),
      hero: Object.freeze([5, 1]),
      par: 6, mana: 7, runes: 2,
      hint: "Fire spreads through connected wood."
    })
  ]);

  SZ.PuzzleLevels = Object.freeze({ REALMS, CAMPAIGN, BONUS });
})();
