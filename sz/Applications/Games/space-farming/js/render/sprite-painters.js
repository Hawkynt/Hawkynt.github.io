/* Space Farming - the painters of every 16x16 sprite (crops, animals, buildings, tools, icons). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const { paintSun, paintRobot, paintPot } = NS;

  const SPRITE_PAINTERS = {
    /* ── Crops (mature) ── */
    wheat: (p, P) => {
      p.line(7, 14, 7, 6, P.lime); p.line(7, 14, 4, 8, P.lime); p.line(8, 14, 11, 8, P.lime);
      p.ell(7, 4, 1, 3, P.gold); p.ell(4, 6, 1, 3, P.gold); p.ell(11, 6, 1, 3, P.gold);
      p.px(7, 3, P.yellow, true); p.px(4, 5, P.yellow, true); p.px(11, 5, P.yellow, true);
    },
    starfruit: (p, P) => {
      const pts = [];
      for (let i = 0; i < 10; ++i) {
        const ang = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.2 : 7;
        pts.push([8 + Math.cos(ang) * r, 8.6 + Math.sin(ang) * r]);
      }
      p.poly(pts, P.gold);
      p.px(7, 6, P.cream, true); p.px(7, 7, P.yellow, true);
      p.line(8, 4, 8, 9, P.yellow, true);
    },
    berry: (p, P) => {
      p.line(7, 2, 8, 6, P.leaf); p.ell(10, 3, 2, 1, P.green);
      p.disc(4.5, 8, 2.5, P.purple); p.disc(10.5, 8, 2.5, P.violet); p.disc(7.5, 11.5, 2.5, P.purple);
      p.px(4, 7, P.pink, true); p.px(10, 7, P.pink, true); p.px(7, 11, P.pink, true);
    },
    lettuce: (p, P) => {
      p.ell(7.5, 9, 6, 5, P.leaf);
      p.ell(7.5, 8.5, 4, 4, P.green);
      p.ell(7.5, 8, 2, 2, P.lime);
      p.line(7.5, 5, 7.5, 13, P.lime, true);
      p.line(4, 8, 6, 11, P.lime, true); p.line(11, 8, 9, 11, P.lime, true);
    },
    corn: (p, P) => {
      p.ell(7.5, 6.5, 2.5, 5.5, P.yellow);
      for (let y = 2; y <= 11; y += 2)
        for (let x = 6; x <= 9; x += 2)
          p.px(x + (y % 4 ? 1 : 0), y, P.gold, true);
      p.poly([[3, 6], [7, 15], [5, 15], [2, 9]], P.green);
      p.poly([[13, 6], [9, 15], [11, 15], [14, 9]], P.leaf);
      p.rect(6, 13, 4, 2, P.leaf);
    },
    melon: (p, P) => {
      p.disc(7.5, 8.5, 6, P.teal);
      for (let i = -1; i <= 1; ++i) {
        p.line(7.5 + i * 3, 3, 7.5 + i * 4, 14, P.cyan, true);
      }
      p.px(5, 5, P.white, true);
      p.rect(7, 1, 2, 2, P.leaf);
    },
    tomato: (p, P) => {
      p.ell(7.5, 9, 6, 5, P.red);
      p.poly([[4, 4], [8, 5.5], [12, 4], [10, 6.5], [8, 7.5], [6, 6.5]], P.green);
      p.rect(7, 2, 2, 3, P.leaf);
      p.px(4, 8, P.pink, true); p.px(5, 7, P.pink, true);
    },
    mushroom: (p, P) => {
      p.rect(6, 9, 4, 6, P.cream);
      p.ell(7.5, 7, 6.5, 4.5, P.violet);
      p.rect(0, 9, 16, 3, null);
      p.rect(6, 9, 4, 6, P.cream);
      p.rect(1, 8, 14, 1, P.purple);
      p.px(5, 4, P.pink, true); p.px(9, 3, P.pink, true); p.px(11, 6, P.pink, true); p.px(4, 7, P.pink, true); p.px(8, 6, P.pink, true);
    },
    pepper: (p, P) => {
      p.poly([[4, 5], [10, 4], [12, 7], [11, 11], [7, 14], [3, 15], [6, 11], [5, 8]], P.red);
      p.line(6, 6, 6, 9, P.pink, true);
      p.line(10, 4, 12, 1, P.leaf); p.rect(8, 3, 4, 2, P.green);
    },
    flower: (p, P) => {
      p.line(7.5, 10, 7.5, 15, P.leaf); p.ell(10, 13, 2, 1, P.green);
      for (let i = 0; i < 5; ++i) {
        const ang = -Math.PI / 2 + i * 2 * Math.PI / 5;
        p.disc(7.5 + Math.cos(ang) * 4, 6.5 + Math.sin(ang) * 4, 2.2, P.sky);
      }
      p.disc(7.5, 6.5, 1.5, P.yellow);
      p.px(7, 6, P.white, true);
    },
    moss: (p, P) => {
      p.ell(7.5, 11, 6.5, 3.5, P.slate);
      p.ell(5, 9, 3, 2.5, P.slate); p.ell(10, 8.5, 3, 3, P.slate);
      p.px(4, 10, P.sky, true); p.px(9, 7, P.sky, true); p.px(11, 11, P.sky, true); p.px(6, 12, P.sky, true);
      p.ell(7.5, 6, 2, 2, P.slate);
      p.px(12, 3, P.cream, true); p.px(3, 4, P.cream, true); p.px(8, 2, P.sky, true);
    },
    solarvine: (p, P) => {
      p.line(3, 15, 4, 11, P.leaf); p.line(4, 11, 7, 10, P.leaf); p.line(7, 10, 8, 13, P.leaf); p.line(8, 13, 11, 12, P.leaf);
      p.ell(3, 9, 1, 1, P.green); p.ell(11, 14, 1, 1, P.green);
      paintSun(p, P, 8, 5, 2.5);
    },

    /* ── Growth stages ── */
    sprout: (p, P) => {
      p.ell(7.5, 13, 5, 1.5, P.soil);
      p.line(7.5, 12, 7.5, 8, P.lime);
      p.ell(5, 7, 2, 1, P.green); p.ell(10, 6, 2, 1, P.green);
    },

    /* ── Livestock ── */
    cow: (p, P) => {
      p.rect(4, 6, 10, 6, P.white);
      p.rect(5, 12, 2, 3, P.white); p.rect(11, 12, 2, 3, P.white);
      p.ell(3, 7, 2.5, 2.5, P.white);
      p.rect(0, 8, 3, 2, P.pink);
      p.px(2, 6, P.black, true);
      p.px(1, 4, P.cream); p.px(4, 4, P.cream);
      p.rect(7, 7, 3, 2, P.black, true); p.rect(11, 9, 2, 2, P.black, true); p.px(9, 10, P.black, true);
      p.line(14, 6, 15, 10, P.white);
      p.rect(8, 12, 2, 1, P.pink, true);
    },
    hen: (p, P) => {
      p.ell(8.5, 9.5, 5, 4, P.white);
      p.disc(4.5, 5, 2.5, P.white);
      p.rect(3, 1, 3, 2, P.red);
      p.rect(0, 5, 2, 2, P.gold);
      p.px(2, 7, P.red, true);
      p.px(4, 4, P.black, true);
      p.poly([[12, 6], [15, 3], [15, 8], [13, 10]], P.cream);
      p.ell(9, 9.5, 2.5, 1.5, P.cream);
      p.line(7, 14, 7, 15, P.orange); p.line(10, 14, 10, 15, P.orange);
    },
    goat: (p, P) => {
      p.rect(5, 6, 9, 5, P.tan);
      p.rect(6, 11, 2, 4, P.tan); p.rect(12, 11, 2, 4, P.tan);
      p.ell(3.5, 5.5, 2, 2.5, P.tan);
      p.line(3, 2, 6, 0, P.grey); p.line(4, 2, 7, 1, P.grey);
      p.px(3, 5, P.black, true);
      p.line(2, 8, 2, 10, P.white);
      p.px(14, 5, P.tan);
      p.ell(9, 7, 2, 1, P.cream, true);
    },
    chick: (p, P) => {
      p.disc(7.5, 6, 4, P.yellow);
      p.poly([[2, 9], [4, 8], [6, 10], [8, 8], [10, 10], [12, 8], [14, 9], [13, 15], [3, 15]], P.white);
      p.rect(1, 5, 2, 2, P.orange);
      p.px(5, 5, P.black, true); p.px(10, 5, P.black, true);
      p.px(6, 3, P.cream, true);
    },

    /* ── Produce ── */
    milk: (p, P) => {
      p.rect(6, 1, 4, 2, P.blue);
      p.rect(6, 3, 4, 2, P.white);
      p.poly([[6, 5], [10, 5], [12, 8], [12, 15], [4, 15], [4, 8]], P.white);
      p.rect(4, 9, 8, 3, P.sky, true);
    },
    egg: (p, P) => {
      p.ell(7.5, 8.5, 4.5, 6, P.cream);
      p.px(6, 5, P.white, true); p.px(5, 6, P.white, true);
    },
    wool: (p, P) => {
      p.disc(7.5, 8.5, 6, P.pink);
      p.line(3, 5, 12, 12, P.maroon, true); p.line(2, 9, 9, 15, P.maroon, true); p.line(6, 3, 14, 9, P.maroon, true);
      p.line(13, 13, 15, 15, P.pink);
    },
    feather: (p, P) => {
      p.poly([[13, 1], [15, 3], [8, 11], [4, 12], [5, 8]], P.white);
      p.poly([[13, 1], [9, 3], [4, 9], [5, 8]], P.sky);
      p.line(2, 14, 13, 2, P.grey, true);
    },

    /* ── Upgrades ── */
    growth: (p, P) => {
      p.ell(5.5, 13, 4, 1.5, P.soil);
      p.line(5.5, 12, 5.5, 8, P.lime); p.ell(3, 7, 2, 1, P.green); p.ell(8, 6, 2, 1, P.green);
      p.poly([[12, 2], [15, 6], [13, 6], [13, 12], [11, 12], [11, 6], [9, 6]], P.lime);
    },
    crate: (p, P) => {
      p.rect(2, 4, 12, 11, P.tan);
      p.rect(2, 4, 12, 2, P.brown, true); p.rect(2, 9, 12, 1, P.brown, true); p.rect(2, 14, 12, 1, P.brown, true);
      p.line(3, 6, 12, 13, P.brown, true);
    },
    shield: (p, P) => {
      p.poly([[2, 2], [14, 2], [14, 8], [8, 15], [2, 8]], P.blue);
      p.rect(7, 4, 2, 8, P.white, true); p.rect(4, 6, 8, 2, P.white, true);
    },
    robot: paintRobot,
    map: (p, P) => {
      p.poly([[1, 3], [5, 2], [10, 4], [15, 3], [15, 13], [10, 14], [5, 12], [1, 13]], P.cream);
      p.line(5, 2, 5, 12, P.tan, true); p.line(10, 4, 10, 14, P.tan, true);
      p.line(3, 10, 7, 7, P.red, true); p.line(7, 7, 12, 9, P.red, true);
      p.px(12, 8, P.red, true); p.px(13, 9, P.red, true); p.px(12, 10, P.red, true); p.px(11, 9, P.red, true);
      p.ell(4, 5, 1, 1, P.green, true);
    },
    flask: (p, P) => {
      p.rect(6, 1, 4, 5, P.steel);
      p.poly([[6, 5], [10, 5], [15, 14], [1, 14]], P.steel);
      p.poly([[4.5, 9], [11.5, 9], [14, 13.5], [2, 13.5]], P.lime, true);
      p.px(6, 11, P.white, true); p.px(9, 12, P.white, true);
      p.rect(5, 0, 6, 1, P.brown);
    },
    chart: (p, P) => {
      p.rect(1, 1, 14, 14, P.white);
      p.rect(3, 10, 2, 3, P.blue, true); p.rect(6, 8, 2, 5, P.blue, true); p.rect(9, 6, 2, 7, P.blue, true); p.rect(12, 3, 2, 10, P.blue, true);
      p.line(2, 9, 13, 2, P.red, true);
    },
    drop: (p, P) => {
      p.poly([[8, 1], [12, 8], [12.5, 11], [10, 14.5], [6, 14.5], [3.5, 11], [4, 8]], P.blue);
      p.disc(8, 10.5, 4, P.blue);
      p.px(6, 9, P.sky, true); p.px(6, 10, P.sky, true); p.px(7, 7, P.sky, true);
    },

    /* ── Buildings ── */
    sprinkler: (p, P) => {
      p.rect(7, 8, 2, 6, P.steel);
      p.rect(4, 13, 8, 2, P.dgrey);
      p.rect(5, 6, 6, 2, P.grey);
      const drops = [[2, 4], [4, 2], [7, 1], [11, 2], [13, 4], [1, 7], [14, 7], [3, 5.5], [12, 5.5]];
      for (const d of drops) p.px(d[0], d[1], P.sky, true);
    },
    harvester: (p, P) => {
      paintRobot(p, P);
      p.rect(13, 6, 2, 3, null);
      p.line(13, 7, 15, 10, P.grey); p.rect(14, 10, 2, 1, P.yellow); p.px(14, 11, P.yellow);
      p.px(5, 6, P.lime, true); p.px(9, 6, P.lime, true);
    },
    greenhouse: (p, P) => {
      p.poly([[1, 7], [8, 1], [15, 7], [15, 15], [1, 15]], P.sky);
      p.line(1, 7, 8, 1, P.white, true); p.line(8, 1, 15, 7, P.white, true);
      p.line(8, 1, 8, 15, P.white, true); p.line(1, 11, 15, 11, P.white, true);
      p.line(4.5, 4, 4.5, 15, P.white, true); p.line(11.5, 4, 11.5, 15, P.white, true);
      p.ell(6, 13, 1, 1, P.green, true); p.ell(10, 13, 1, 1, P.green, true);
    },
    silo: (p, P) => {
      p.rect(4, 5, 8, 10, P.red);
      p.ell(7.5, 5, 4, 3, P.steel);
      p.rect(4, 8, 8, 1, P.maroon, true); p.rect(4, 12, 8, 1, P.maroon, true);
      p.rect(7, 11, 2, 4, P.dbrown, true);
      p.rect(12, 9, 3, 6, P.grey);
    },
    solarpanel: (p, P) => {
      p.poly([[3, 3], [15, 3], [13, 11], [1, 11]], P.blue);
      for (let i = 1; i < 4; ++i) p.line(3 + i * 3, 3, 1 + i * 3, 11, P.sky, true);
      p.line(2, 7, 14, 7, P.sky, true);
      p.rect(7, 12, 2, 3, P.grey);
      p.rect(4, 14, 8, 1, P.dgrey);
    },
    turbine: (p, P) => {
      p.poly([[7, 7], [9, 7], [10, 15], [6, 15]], P.white);
      p.poly([[8, 6], [7, 0], [9, 0]], P.steel);
      p.poly([[8, 6], [14, 10], [13, 11]], P.steel);
      p.poly([[8, 6], [2, 10], [3, 11]], P.steel);
      p.disc(8, 6, 1, P.grey);
    },
    compost: (p, P) => {
      p.poly([[3, 5], [13, 5], [12, 15], [4, 15]], P.green);
      p.rect(2, 3, 12, 2, P.leaf);
      p.rect(7, 2, 2, 1, P.leaf);
      p.poly([[8, 7], [11, 10], [9, 10], [9, 13], [7, 13], [7, 10], [5, 10]], P.lime, true);
    },
    scarecrow: (p, P) => {
      p.rect(7, 6, 2, 9, P.brown);
      p.rect(1, 7, 14, 2, P.brown);
      p.poly([[4, 7], [12, 7], [11, 12], [5, 12]], P.blue);
      p.disc(8, 4, 2, P.tan);
      p.rect(3, 1, 10, 1, P.gold); p.rect(5, 0, 6, 1, P.gold);
      p.px(7, 4, P.black, true); p.px(9, 4, P.black, true);
      p.px(1, 9, P.yellow); p.px(14, 9, P.yellow); p.px(6, 13, P.yellow); p.px(10, 13, P.yellow);
    },
    fence: (p, P) => {
      for (const x of [2, 7, 12]) {
        p.rect(x, 3, 2, 12, P.tan);
        p.px(x, 2, P.tan);
      }
      p.rect(1, 6, 14, 2, P.brown); p.rect(1, 11, 14, 2, P.brown);
    },
    planter1: (p, P) => {
      paintPot(p, P);
      p.line(8, 9, 8, 5, P.lime); p.ell(5.5, 4, 2, 1, P.green); p.ell(10.5, 4, 2, 1, P.green);
    },
    planter2: (p, P) => {
      paintPot(p, P);
      p.line(8, 9, 8, 2, P.leaf);
      p.ell(5, 7, 2, 1, P.green); p.ell(11, 7, 2, 1, P.green);
      p.ell(5.5, 4, 2, 1, P.green); p.ell(10.5, 4, 2, 1, P.green);
      p.ell(8, 1, 1, 1, P.lime);
    },
    collector: (p, P) => {
      p.poly([[1, 9], [5, 9], [6, 11], [10, 11], [11, 9], [15, 9], [15, 15], [1, 15]], P.grey);
      p.poly([[8, 10], [12, 5], [10, 5], [10, 0], [6, 0], [6, 5], [4, 5]], P.lime);
    },

    /* ── Seasons, time of day, tools ── */
    spring: (p, P) => {
      p.line(7.5, 15, 7.5, 7, P.leaf);
      p.ell(4, 9, 3, 1.5, P.green); p.ell(11, 7, 3, 1.5, P.green);
      p.disc(7.5, 4, 2.5, P.pink); p.disc(7.5, 4, 0.8, P.yellow, true);
    },
    sun: (p, P) => paintSun(p, P, 7.5, 7.5, 3.5),
    autumn: (p, P) => {
      p.poly([[8, 1], [10, 5], [14, 4], [12, 9], [15, 11], [9, 12], [8, 15], [7, 12], [1, 11], [4, 9], [2, 4], [6, 5]], P.orange);
      p.line(8, 4, 8, 15, P.red, true); p.line(8, 9, 4, 6, P.red, true); p.line(8, 9, 12, 6, P.red, true);
    },
    winter: (p, P) => {
      for (let a = 0; a < 3; ++a) {
        const ang = a * Math.PI / 3, dx = Math.cos(ang) * 6.5, dy = Math.sin(ang) * 6.5;
        p.line(7.5 - dx, 7.5 - dy, 7.5 + dx, 7.5 + dy, P.sky);
      }
      for (let a = 0; a < 6; ++a) {
        const ang = a * Math.PI / 3, bx = 7.5 + Math.cos(ang) * 4.5, by = 7.5 + Math.sin(ang) * 4.5;
        p.px(bx + Math.cos(ang + 1) * 1.4, by + Math.sin(ang + 1) * 1.4, P.sky);
        p.px(bx + Math.cos(ang - 1) * 1.4, by + Math.sin(ang - 1) * 1.4, P.sky);
      }
      p.px(7.5, 7.5, P.white, true);
    },
    moon: (p, P) => {
      p.disc(7.5, 7.5, 6, P.cream);
      p.disc(10.5, 5.5, 5, null);
      p.px(4, 9, P.tan, true); p.px(6, 12, P.tan, true);
    },
    hoe: (p, P) => {
      p.line(3, 14, 12, 3, P.brown); p.line(4, 14, 13, 3, P.tan);
      p.poly([[9, 1], [15, 1], [15, 4], [12, 7], [11, 5]], P.steel);
    },
    mouse: (p, P) => {
      p.ell(8, 10, 5, 3, P.grey);
      p.disc(4, 8, 2.5, P.grey);
      p.disc(4, 5, 1.5, P.pink);
      p.px(1, 9, P.pink, true);
      p.px(3, 8, P.black, true);
      p.line(13, 11, 15, 8, P.pink);
      p.px(6, 13, P.pink, true); p.px(10, 13, P.pink, true);
    },
    trap: (p, P) => {
      p.rect(1, 10, 14, 4, P.tan);
      p.rect(1, 13, 14, 1, P.brown, true);
      p.line(3, 9, 9, 3, P.steel); p.line(9, 3, 11, 9, P.steel);
      p.rect(10, 8, 3, 2, P.yellow);
    },

    /* ── Interface icons ── */
    coin: (p, P) => {
      p.disc(7.5, 7.5, 6.5, P.gold);
      p.disc(7.5, 7.5, 4.5, P.yellow);
      p.rect(7, 4, 2, 7, P.gold, true);
      p.rect(5, 5, 5, 1, P.gold, true); p.rect(6, 7, 3, 1, P.gold, true); p.rect(5, 9, 5, 1, P.gold, true);
      p.px(4, 3, P.cream, true); p.px(3, 4, P.cream, true);
    },
    lock: (p, P) => {
      p.rect(4, 2, 8, 2, P.steel); p.rect(4, 2, 2, 6, P.steel); p.rect(10, 2, 2, 6, P.steel);
      p.rect(2, 7, 12, 8, P.gold);
      p.rect(7, 9, 2, 4, P.dbrown, true);
      p.rect(3, 8, 10, 1, P.yellow, true);
    },
    check: (p, P) => {
      p.disc(7.5, 7.5, 7, P.green);
      p.line(4, 8, 6, 11, P.white, true); p.line(6, 11, 11, 4, P.white, true);
      p.line(4, 7, 6, 10, P.white, true); p.line(6, 10, 11, 3, P.white, true);
    },
    bolt: (p, P) => {
      p.poly([[9, 0], [3, 9], [7.5, 9], [5, 16], [13, 6], [8.5, 6], [11, 0]], P.yellow);
      p.line(9, 2, 6, 7, P.cream, true);
    },
    seedbag: (p, P) => {
      p.poly([[3, 6], [13, 6], [14, 15], [2, 15]], P.tan);
      p.rect(5, 3, 6, 3, P.tan);
      p.rect(4, 5, 8, 1, P.brown, true);
      p.line(8, 4, 8, 1, P.leaf); p.ell(6, 1, 1.5, 0.8, P.green); p.ell(10, 1.5, 1.5, 0.8, P.green);
      p.disc(8, 11, 2, P.lime, true); p.px(8, 11, P.leaf, true);
    },
    hammer: (p, P) => {
      p.line(4, 15, 10, 6, P.brown); p.line(5, 15, 11, 6, P.tan);
      p.poly([[6, 2], [12, 1], [15, 4], [13, 9], [10, 7], [8, 5]], P.steel);
      p.line(12, 2, 14, 5, P.white, true);
    },
    paw: (p, P) => {
      p.ell(8, 11, 4, 3.5, P.pink);
      p.disc(3, 6, 1.6, P.pink); p.disc(6, 3, 1.6, P.pink); p.disc(10, 3, 1.6, P.pink); p.disc(13, 6, 1.6, P.pink);
      p.ell(8, 11.5, 2, 1.5, P.maroon, true);
    },
    techtree: (p, P) => {
      p.line(8, 14, 8, 4, P.cyan); p.line(8, 9, 3, 5, P.cyan); p.line(8, 9, 13, 5, P.cyan); p.line(8, 14, 3, 11, P.cyan);
      p.disc(8, 3, 2, P.yellow); p.disc(3, 4.5, 1.6, P.lime); p.disc(13, 4.5, 1.6, P.pink); p.disc(2.5, 11, 1.6, P.sky);
      p.rect(5, 13, 6, 3, P.steel);
    },
    star: (p, P) => {
      const pts = [];
      for (let i = 0; i < 10; ++i) {
        const ang = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3 : 7;
        pts.push([7.5 + Math.cos(ang) * r, 8.3 + Math.sin(ang) * r]);
      }
      p.poly(pts, P.yellow);
      p.px(7, 6, P.cream, true); p.px(6, 7, P.cream, true);
    },
    basket: (p, P) => {
      p.poly([[1, 7], [15, 7], [13, 15], [3, 15]], P.tan);
      for (let x = 3; x < 14; x += 3) p.line(x, 8, x - 0.5, 14, P.brown, true);
      p.rect(1, 7, 14, 1, P.brown, true);
      p.disc(5, 5, 2, P.red); p.disc(9, 4.5, 2, P.lime); p.disc(12, 5.5, 1.6, P.purple);
    },
    cloud: (p, P) => {
      p.ell(8, 10, 6.5, 3.5, P.white);
      p.disc(5, 8, 3, P.white); p.disc(9.5, 6.5, 3.5, P.white);
      p.rect(2, 12, 12, 1, P.steel, true);
    },
    rain: (p, P) => {
      p.ell(8, 6, 6.5, 3, P.steel); p.disc(5, 4.5, 2.5, P.steel); p.disc(9.5, 3.5, 3, P.steel);
      for (const [x, y] of [[4, 11], [8, 12], [12, 11], [6, 14], [10, 15]]) p.line(x, y, x - 1, y + 1, P.sky, true);
    },
    storm: (p, P) => {
      p.ell(8, 6, 6.5, 3, P.dgrey); p.disc(5, 4.5, 2.5, P.dgrey); p.disc(9.5, 3.5, 3, P.dgrey);
      p.poly([[9, 8], [5, 12], [8, 12], [6, 16], [12, 10], [9, 10], [11, 8]], P.yellow);
    },
    meteor: (p, P) => {
      p.line(1, 1, 9, 9, P.orange); p.line(2, 1, 10, 8, P.red); p.line(1, 2, 8, 9, P.yellow);
      p.disc(11, 11, 3.5, P.brown); p.px(10, 10, P.tan, true); p.px(12, 12, P.dbrown, true);
    },
    flare: (p, P) => {
      paintSun(p, P, 7.5, 7.5, 3.5);
      p.px(1, 1, P.yellow, true); p.px(14, 2, P.yellow, true); p.px(13, 14, P.yellow, true);
    },
    dust: (p, P) => {
      for (const [y, x0, x1] of [[4, 2, 12], [7, 4, 15], [10, 1, 11], [13, 5, 13]]) p.line(x0, y, x1, y, P.tan);
      p.disc(13, 4, 1.5, P.tan); p.disc(3, 10, 1.5, P.tan);
      p.px(6, 4, P.cream, true); p.px(9, 7, P.cream, true);
    },
    snow: (p, P) => {
      p.ell(8, 5.5, 6.5, 3, P.steel); p.disc(5, 4, 2.5, P.steel); p.disc(9.5, 3, 3, P.steel);
      for (const [x, y] of [[4, 11], [8, 12], [12, 10], [6, 14], [11, 14]]) { p.px(x, y, P.white, true); p.px(x + 1, y, P.white, true); p.px(x, y + 1, P.white, true); }
    },
    target: (p, P) => {
      p.disc(7.5, 7.5, 7, P.red); p.disc(7.5, 7.5, 5, P.white); p.disc(7.5, 7.5, 3, P.red); p.disc(7.5, 7.5, 1, P.white, true);
    },
    scroll: (p, P) => {
      p.rect(3, 2, 10, 12, P.cream);
      p.rect(2, 1, 12, 2, P.tan); p.rect(2, 13, 12, 2, P.tan);
      for (let y = 5; y <= 11; y += 2) p.line(5, y, 11, y, P.tan, true);
      p.disc(11, 11, 1.5, P.red, true);
    },
    pause: (p, P) => {
      p.rect(3, 2, 4, 12, P.steel); p.rect(9, 2, 4, 12, P.steel);
    },
    book: (p, P) => {
      p.rect(2, 2, 12, 12, P.blue); p.rect(4, 2, 10, 11, P.cream); p.rect(2, 12, 12, 2, P.violet);
      p.line(6, 5, 11, 5, P.tan, true); p.line(6, 7, 11, 7, P.tan, true); p.line(6, 9, 10, 9, P.tan, true);
    },
    market: (p, P) => {
      p.rect(2, 8, 12, 7, P.tan);
      p.poly([[1, 7], [3, 2], [13, 2], [15, 7]], P.red);
      for (let x = 3; x < 14; x += 4) p.poly([[x, 2], [x + 2, 2], [x + 2.5, 7], [x - 0.5, 7]], P.white, true);
      p.rect(4, 9, 3, 3, P.lime, true); p.rect(9, 9, 3, 3, P.orange, true);
      p.rect(2, 14, 12, 1, P.brown, true);
    },
    eye: (p, P) => {
      p.ell(7.5, 8, 7, 4, P.white); p.disc(7.5, 8, 3, P.blue); p.disc(7.5, 8, 1.4, P.black, true); p.px(6, 7, P.white, true);
    },
    /* ── Tree-unlocked crops, animals and buildings ── */
    pumpkin: (p, P) => {
      p.ell(7.5, 10, 7, 5, P.orange);
      p.ell(4, 10, 2.5, 4.5, P.gold); p.ell(11, 10, 2.5, 4.5, P.gold);
      p.line(7.5, 6, 7.5, 15, P.brown, true);
      p.rect(7, 2, 2, 4, P.leaf); p.ell(10.5, 3.5, 2, 1, P.green);
      p.px(4, 8, P.cream, true); p.px(5, 7, P.yellow, true);
      p.px(13, 6, P.cyan, true); p.px(2, 5, P.cyan, true);
    },
    kale: (p, P) => {
      p.ell(7.5, 10, 6.5, 5, P.teal);
      p.ell(4.5, 8, 3, 3.5, P.cyan); p.ell(10.5, 7.5, 3, 4, P.cyan); p.ell(7.5, 6, 2.5, 4, P.sky);
      p.line(7.5, 4, 7.5, 14, P.white, true); p.line(4, 7, 6, 12, P.white, true); p.line(11, 6, 9, 12, P.white, true);
      p.px(3, 5, P.white, true); p.px(12, 4, P.white, true);
    },
    rabbit: (p, P) => {
      p.ell(9, 10.5, 5, 3.5, P.white);
      p.disc(4.5, 8, 2.5, P.white);
      p.rect(3, 1, 2, 6, P.white); p.rect(5, 2, 2, 5, P.white);
      p.px(3, 3, P.pink, true); p.px(3, 4, P.pink, true); p.px(5, 4, P.pink, true);
      p.px(3, 8, P.black, true); p.px(2, 9, P.pink, true);
      p.disc(14, 9.5, 1.2, P.sky);
      p.rect(6, 13, 2, 2, P.white); p.rect(11, 13, 2, 2, P.white);
    },
    bee: (p, P) => {
      p.poly([[3, 15], [13, 15], [14, 9], [8, 4], [2, 9]], P.gold);
      for (const y of [9, 11, 13]) p.line(3, y, 13, y, P.brown, true);
      p.rect(6, 12, 4, 3, P.dbrown, true);
      p.ell(12, 3, 2.5, 2, P.yellow); p.line(10, 3, 14, 3, P.black, true);
      p.ell(12, 1, 2, 1, P.sky);
      p.ell(4, 4, 2, 1.5, P.yellow); p.px(4, 3, P.black, true);
    },
    fur: (p, P) => {
      p.ell(7.5, 9, 6.5, 5, P.steel);
      p.ell(5, 7, 3, 2.5, P.white); p.ell(10, 8, 3, 2.5, P.white); p.ell(7.5, 11, 3, 2, P.white);
      p.px(4, 6, P.sky, true); p.px(11, 7, P.sky, true);
    },
    honey: (p, P) => {
      p.rect(4, 5, 8, 10, P.gold);
      p.rect(3, 3, 10, 2, P.tan); p.rect(5, 1, 6, 2, P.cream);
      p.rect(5, 7, 6, 3, P.cream, true);
      p.px(6, 8, P.orange, true); p.px(9, 8, P.orange, true);
      p.line(5, 12, 5, 14, P.yellow, true);
    },
    lamp: (p, P) => {
      p.rect(7, 5, 2, 9, P.dgrey);
      p.rect(5, 14, 6, 2, P.grey);
      p.poly([[4, 5], [12, 5], [10, 1], [6, 1]], P.steel);
      p.rect(5, 5, 6, 2, P.yellow, true);
      p.px(7, 6, P.white, true);
    },
    zapper: (p, P) => {
      p.rect(6, 6, 4, 8, P.grey);
      for (const y of [7, 9, 11]) p.rect(5, y, 6, 1, P.orange, true);
      p.rect(4, 14, 8, 2, P.dgrey);
      p.disc(8, 3.5, 2.5, P.cyan);
      p.px(7, 2, P.white, true);
      p.px(3, 2, P.sky, true); p.px(13, 4, P.sky, true); p.px(2, 5, P.sky, true);
    },
    order: (p, P) => {
      p.rect(2, 3, 12, 11, P.cream);
      p.rect(2, 3, 12, 3, P.green);
      p.line(4, 8, 11, 8, P.tan, true); p.line(4, 10, 9, 10, P.tan, true);
      p.disc(11.5, 11.5, 2.5, P.gold); p.px(11, 11, P.yellow, true);
    },
    rockpile: (p, P) => {
      p.ell(6, 10, 5.5, 4.5, P.dgrey);
      p.ell(10.5, 11, 4.5, 3.5, P.grey);
      p.ell(6, 8.5, 4, 3.5, P.grey);
      p.ell(5, 7.5, 2, 1.5, P.steel, true);
      p.ell(11, 10, 2, 1, P.steel, true);
      p.line(7, 9, 9, 12, P.black, true);
      p.line(3, 11, 5, 13, P.black, true);
      p.rect(2, 14, 13, 1, P.dgrey);
    },
    rockpile2: (p, P) => {
      p.poly([[2, 14], [3, 7], [7, 3], [11, 4], [14, 9], [14, 14]], P.grey);
      p.poly([[3, 9], [7, 4], [10, 5], [8, 9], [4, 11]], P.steel);
      p.line(8, 9, 12, 13, P.dgrey, true);
      p.line(8, 9, 6, 13, P.dgrey, true);
      p.px(6, 5, P.white, true);
      p.ell(12.5, 13, 2, 1.5, P.dgrey);
    },
    pick: (p, P) => {
      p.line(4, 15, 10, 5, P.brown); p.line(5, 15, 11, 5, P.tan);
      p.poly([[3, 4], [8, 1], [13, 2], [15, 5], [12, 4], [8, 3.5], [5, 6]], P.steel);
      p.px(13, 3, P.white, true);
    },
    soil: (p, P) => {
      p.rect(1, 9, 14, 6, P.soil);
      p.rect(1, 9, 14, 1, P.brown, true);
      for (const x of [3, 7, 11]) {
        p.line(x, 9, x, 4, P.leaf);
        p.ell(x - 1, 5, 1.2, 0.8, P.green);
        p.ell(x + 1, 4, 1.2, 0.8, P.lime);
      }
      p.px(4, 12, P.lime, true); p.px(9, 13, P.lime, true); p.px(12, 11, P.lime, true);
    },
    heart: (p, P) => {
      p.disc(5, 6, 3.5, P.red); p.disc(10.5, 6, 3.5, P.red);
      p.poly([[1.5, 7], [14, 7], [7.75, 14.5]], P.red);
      p.px(4, 4, P.pink, true); p.px(5, 4, P.pink, true); p.px(4, 5, P.pink, true);
    },
    zoom: (p, P) => {
      p.disc(6.5, 6.5, 5, P.steel); p.disc(6.5, 6.5, 3.5, P.sky); p.px(5, 5, P.white, true);
      p.line(10, 10, 14, 14, P.brown); p.line(11, 10, 15, 14, P.brown);
    },
  };

  Object.assign(NS, { SPRITE_PAINTERS });

})();
