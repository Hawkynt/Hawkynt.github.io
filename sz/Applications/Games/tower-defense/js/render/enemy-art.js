/* render/enemy-art.js -- side-view enemy sprites, their animation frames and enemy icons for the UI.
   Reads: constants, enemyTypes, env, pixelArt, artKit and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { shade } = NS.constants;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { ctx } = NS.env;
  const { pixelArt } = NS.pixelArt;
  const { RAMPS, rampOf, px, block, disc, ellipseFill, poly, line } = NS.artKit;

  /* ══════════════════════════════════════════════════════════════════
     ENEMY ART -- side-view pixel sprites facing right, four animation
     frames each (walk cycles, wing beats, squishing slimes)
     ══════════════════════════════════════════════════════════════════ */

  const FRAMES = 4;
  const LEG = [0, 1, 0, -1];      // leg swing per frame
  const BOB = [0, -1, 0, -1];     // body bob per frame

  // Generic biped: legs, body, arms, head; p = palette, s = size factor
  function biped(g, f, p, o) {
    o = o || {};
    const w = o.w || 8, h = o.h || 6;
    const bx = o.x || 2, by = (o.y || 4) + BOB[f];
    const legH = o.legH || 4;
    const footY = by + h + legH;
    // Legs
    px(g, bx + 1 + LEG[f], by + h, 2, legH, p.leg);
    px(g, bx + w - 3 - LEG[f], by + h, 2, legH, shade(p.leg, -0.25));
    px(g, bx + LEG[f], footY - 1, 3, 1, p.foot || shade(p.leg, -0.4));
    px(g, bx + w - 3 - LEG[f], footY - 1, 3, 1, p.foot || shade(p.leg, -0.4));
    // Body
    block(g, bx, by, w, h, rampOf(p.body), 3);
    if (p.belt) px(g, bx, by + h - 2, w, 1, p.belt);
    // Back arm
    px(g, bx - 1 - LEG[f], by + 1, 2, h - 1, shade(p.skin, -0.3));
    // Head
    const hs = o.head || 5;
    const hx = bx + Math.floor((w - hs) / 2) + 1, hy = by - hs + 1;
    block(g, hx, hy, hs, hs, rampOf(p.skin), 3);
    px(g, hx + hs - 2, hy + 2, 1, 1, p.eye || '#1a0a0a');
    if (p.helm) { px(g, hx - 1, hy - 1, hs + 2, 2, p.helm); px(g, hx - 1, hy - 1, hs + 2, 1, shade(p.helm, 0.35)); }
    // Front arm with weapon
    const ax = bx + w - 1 + LEG[f], ay = by + 1;
    px(g, ax, ay, 2, h - 2, p.skin);
    if (o.weapon) o.weapon(g, ax + 1, ay + h - 3, f);
    return { hx, hy, hs, bx, by, w, h, footY };
  }

  const ENEMY_ART = {
    normal: [14, 18, (g, f) => {
      biped(g, f, { body: '#8a4a2a', leg: '#4a3a2a', skin: '#6ab04a', helm: '#7a7a8a', belt: '#3a2010', eye: '#ff3a1a' }, { x: 3, y: 6, w: 8, h: 6, legH: 5,
        weapon: (g, x, y) => { px(g, x, y - 6, 2, 7, RAMPS.wood[3]); px(g, x - 1, y - 8, 4, 3, RAMPS.wood[4]); } });
    }],
    fast: [18, 12, (g, f) => {
      // Wolf: long body, four running legs
      const c = ['#2a2420', '#463c34', '#625448', '#80705e', '#a08c76', '#c4b09a'];
      const b = BOB[f];
      const leg = [[0, 2], [2, 0], [0, -2], [-2, 0]][f];
      px(g, 3 + leg[0], 7 + b, 2, 4, c[1]); px(g, 6 - leg[0], 7 + b, 2, 4, c[2]);
      px(g, 11 + leg[1], 7 + b, 2, 4, c[1]); px(g, 14 - leg[1], 7 + b, 2, 4, c[2]);
      block(g, 2, 3 + b, 14, 5, c, 3);
      px(g, 4, 3 + b, 10, 1, c[4]);
      poly(g, [14, 2 + b, 18, 4 + b, 18, 6 + b, 14, 7 + b], c[3]);
      poly(g, [14, 1 + b, 15, -1 + b, 16, 2 + b], c[2]);
      px(g, 16, 4 + b, 1, 1, '#ffd84a');
      poly(g, [2, 4 + b, -1, 2 + b + (f % 2), 0, 5 + b], c[3]);
    }],
    swarm: [12, 8, (g, f) => {
      // Beetle
      for (let i = 0; i < 3; ++i) px(g, 2 + i * 3 + (f % 2 ? 1 : -1) * (i % 2 ? 1 : -1) * 0.5, 6, 1, 2, '#3a1a08');
      ellipseFill(g, 6, 4, 5.5, 3.5, '#a85a10');
      ellipseFill(g, 5.5, 3.2, 4.5, 2.4, '#ffb03a');
      px(g, 6, 1, 1, 6, '#6a3008');
      px(g, 10, 3, 2, 2, '#2a1406'); px(g, 11, 3, 1, 1, '#ff3a1a');
      px(g, 3, 2, 2, 1, '#ffe08a');
    }],
    flying: [16, 12, (g, f) => {
      // Bat
      const c = ['#1e1428', '#2e1e40', '#46305e', '#624680', '#8064a4', '#a888cc'];
      const up = [-4, -1, 3, -1][f];
      poly(g, [8, 6, 0, 6 + up, 2, 9 + up * 0.3, 5, 8], c[2]);
      poly(g, [8, 6, 16, 6 + up, 14, 9 + up * 0.3, 11, 8], c[3]);
      ellipseFill(g, 8, 7, 3, 3.5, c[3]);
      poly(g, [6, 4, 7, 1, 8, 4], c[2]); poly(g, [9, 4, 10, 1, 11, 4], c[2]);
      px(g, 7, 6, 1, 1, '#ff3a3a'); px(g, 9, 6, 1, 1, '#ff3a3a');
    }],
    armored: [20, 22, (g, f) => {
      const r = biped(g, f, { body: '#5a6474', leg: '#3a4048', skin: '#9a8a6a', helm: '#8c98b0', belt: '#c99a2a', eye: '#ff5a1a' }, { x: 4, y: 8, w: 12, h: 8, legH: 5, head: 6,
        weapon: (g, x, y) => { px(g, x, y - 9, 2, 10, RAMPS.wood[2]); block(g, x - 2, y - 12, 6, 4, RAMPS.metal, 3); } });
      // Shoulder plates and horns
      block(g, r.bx - 2, r.by - 1, 4, 3, RAMPS.metal, 4);
      block(g, r.bx + r.w - 2, r.by - 1, 4, 3, RAMPS.metal, 4);
      poly(g, [r.hx - 1, r.hy, r.hx - 3, r.hy - 4, r.hx + 1, r.hy - 1], '#e8e2d4');
      poly(g, [r.hx + r.hs + 1, r.hy, r.hx + r.hs + 3, r.hy - 4, r.hx + r.hs - 1, r.hy - 1], '#e8e2d4');
      for (let i = 0; i < 3; ++i) px(g, r.bx + 2 + i * 3, r.by + 2, 2, 2, RAMPS.metal[5]);
    }],
    splitter: [16, 13, (g, f) => {
      const c = ['#0e4a3a', '#167058', '#24967a', '#3ab898', '#5ae0b4', '#aaffe4'];
      const sq = [0, 1, 0, -1][f];
      ellipseFill(g, 8, 8 + sq * 0.5, 7.5 + sq, 5 - sq * 0.6, c[2]);
      ellipseFill(g, 7, 7 + sq * 0.5, 6 + sq, 3.8 - sq * 0.5, c[3]);
      px(g, 4, 5, 3, 1, c[5]);
      px(g, 9, 6, 2, 2, '#ffffff'); px(g, 12, 6, 2, 2, '#ffffff'); px(g, 10, 7, 1, 1, '#0a2a20'); px(g, 13, 7, 1, 1, '#0a2a20');
      px(g, 6, 9, 1, 1, c[5]); px(g, 11, 10, 1, 1, c[1]);
    }],
    slimelet: [10, 8, (g, f) => {
      const c = ['#167058', '#24967a', '#3ab898', '#5ae0b4', '#8ff0d0', '#d4fff0'];
      const sq = [0, 1, 0, -1][f];
      ellipseFill(g, 5, 5 + sq * 0.4, 4.5 + sq * 0.6, 3 - sq * 0.4, c[2]);
      ellipseFill(g, 4.5, 4.5, 3.5, 2, c[4]);
      px(g, 6, 4, 1, 1, '#0a2a20'); px(g, 8, 4, 1, 1, '#0a2a20');
    }],
    healer: [14, 19, (g, f) => {
      const r = biped(g, f, { body: '#2e7a3a', leg: '#1e4a26', skin: '#b8a07a', belt: '#c99a2a', eye: '#3a1a0a' }, { x: 3, y: 8, w: 8, h: 7, legH: 4 });
      poly(g, [r.hx - 1, r.hy + 1, r.hx + r.hs / 2, r.hy - 4, r.hx + r.hs + 1, r.hy + 1], '#1e5a2a');
      px(g, r.bx + r.w + 1, r.by - 5, 1, 13, RAMPS.wood[3]);
      disc(g, r.bx + r.w + 1.5, r.by - 6, 2, ['#0a4a1a', '#1a7a2a', '#3ab84a', '#6aff8a', '#b8ffc8', '#ffffff'], 3);
    }],
    stealth: [14, 18, (g, f) => {
      const c = ['#1a1028', '#2a1a40', '#3e2a5a', '#5a4080', '#7a5aa8', '#a888d0'];
      const sway = [0, 1, 0, -1][f];
      poly(g, [3, 6, 11, 6, 12 + sway, 17, 8, 15, 5, 18 + sway, 2, 15], c[2]);
      poly(g, [3, 6, 7, 6, 6, 16, 2, 15], c[3]);
      ellipseFill(g, 7, 5, 4.5, 4.5, c[2]);
      ellipseFill(g, 7.5, 5.5, 2.8, 2.6, '#06030c');
      px(g, 8, 5, 1, 1, '#c8a0ff'); px(g, 10, 5, 1, 1, '#c8a0ff');
      px(g, 11, 9, 3, 1, c[4]);
    }],
    shield: [18, 20, (g, f) => {
      const r = biped(g, f, { body: '#3a5a9a', leg: '#2a3a5a', skin: '#c8a888', helm: '#a8b4c8', belt: '#c99a2a' }, { x: 3, y: 7, w: 9, h: 7, legH: 5 });
      // Tower shield in front
      block(g, r.bx + r.w, r.by - 3, 5, 13, ['#1a3a6a', '#24508a', '#3a6ab0', '#5a8ad0', '#8ab0ec', '#c4dcff'], 3);
      px(g, r.bx + r.w + 2, r.by, 1, 7, RAMPS.gold[4]); px(g, r.bx + r.w + 1, r.by + 3, 3, 1, RAMPS.gold[4]);
      px(g, r.hx, r.hy + 2, r.hs, 1, '#1a1a2a');
    }],
    drake: [24, 22, (g, f) => {
      g.translate(0, 6);
      const c = ['#4a0e06', '#7a1a0a', '#a82a12', '#d0441e', '#f06a3a', '#ff9a6a'];
      const up = [-5, -1, 4, -1][f];
      poly(g, [9, 7, 3, 7 + up - 2, 5, 3 + up, 13, 6], c[2]);
      ellipseFill(g, 11, 9, 7, 3.5, c[3]);
      px(g, 6, 8, 10, 1, c[5]);
      poly(g, [4, 9, -1, 7 + (f % 2), 0, 11], c[2]);
      poly(g, [16, 7, 22, 6, 23, 9, 17, 11], c[3]);
      px(g, 20, 7, 1, 1, '#ffe14a');
      poly(g, [12, 7, 18, 7 + up - 3, 19, 3 + up, 14, 6], c[4]);
      px(g, 9, 12, 2, 2, c[1]); px(g, 13, 12, 2, 2, c[1]);
    }],
    golem: [24, 26, (g, f) => {
      const c = ['#2a1e14', '#463424', '#644c36', '#82664a', '#a2845e', '#c8a87a'];
      const b = BOB[f];
      px(g, 6 + LEG[f], 18 + b, 5, 8 - b, c[2]); px(g, 14 - LEG[f], 18 + b, 5, 8 - b, c[1]);
      block(g, 3, 6 + b, 18, 13, c, 3);
      block(g, 7, 1 + b, 10, 7, c, 4);
      px(g, 9, 3 + b, 2, 2, '#ffb03a'); px(g, 13, 3 + b, 2, 2, '#ffb03a');
      block(g, 0 - LEG[f], 7 + b, 5, 11, c, 2); block(g, 19 + LEG[f], 7 + b, 5, 11, c, 2);
      disc(g, 12, 12 + b, 3, ['#5a1a00', '#a03a00', '#ff6a00', '#ffa83a', '#ffe08a', '#ffffff'], 3);
      px(g, 5, 9 + b, 3, 1, c[1]); px(g, 15, 15 + b, 4, 1, c[1]);
    }],
    skeleton: [13, 17, (g, f) => {
      const B = RAMPS.bone;
      const by = 6 + BOB[f];
      px(g, 4 + LEG[f], by + 6, 1, 5, B[3]); px(g, 8 - LEG[f], by + 6, 1, 5, B[2]);
      for (let i = 0; i < 3; ++i) px(g, 4, by + 1 + i * 2, 5, 1, B[4]);
      px(g, 6, by, 1, 6, B[3]);
      block(g, 4, by - 5, 5, 5, B, 4);
      px(g, 5, by - 3, 1, 1, '#1a0a0a'); px(g, 7, by - 3, 1, 1, '#1a0a0a');
      px(g, 9 + LEG[f], by + 1, 1, 4, B[3]); px(g, 10 + LEG[f], by - 3, 1, 7, RAMPS.metal[4]);
    }],
    boss: [30, 32, (g, f) => {
      // Warlord: huge orc with a cape and an axe
      const b = BOB[f];
      poly(g, [6, 10 + b, 2, 30, 14, 28], '#8a1a1a');
      const r = biped(g, f, { body: '#5a3a3a', leg: '#3a2a22', skin: '#5a9a3a', helm: '#3a3a44', belt: '#c99a2a', eye: '#ff2a1a' }, { x: 7, y: 12, w: 14, h: 10, legH: 7, head: 8,
        weapon: (g, x, y) => {
          px(g, x, y - 14, 2, 17, RAMPS.wood[2]);
          poly(g, [x + 2, y - 15, x + 9, y - 13, x + 9, y - 6, x + 2, y - 8], RAMPS.metal[4]);
          px(g, x + 8, y - 13, 1, 7, RAMPS.metal[5]);
        } });
      poly(g, [r.hx - 1, r.hy + 1, r.hx - 5, r.hy - 6, r.hx + 2, r.hy - 1], '#f6f2e2');
      poly(g, [r.hx + r.hs + 1, r.hy + 1, r.hx + r.hs + 5, r.hy - 6, r.hx + r.hs - 2, r.hy - 1], '#f6f2e2');
      block(g, r.bx - 3, r.by - 2, 6, 4, RAMPS.gold, 3); block(g, r.bx + r.w - 3, r.by - 2, 6, 4, RAMPS.gold, 3);
      px(g, r.hx + 1, r.hy + r.hs - 2, r.hs - 2, 1, '#e8e2d4');
    }],
    dragon: [40, 34, (g, f) => {
      g.translate(0, 9);
      const c = ['#3a0804', '#6a1208', '#9a1e0e', '#c8301a', '#ee5030', '#ff8a5a'];
      const up = [-8, -2, 6, -2][f];
      poly(g, [14, 10, 4, 10 + up - 4, 8, 3 + up, 22, 9], c[2]);
      for (let i = 0; i < 3; ++i) line(g, 14, 10, 6 + i * 4, 6 + up - 2 + i, c[1], 1);
      ellipseFill(g, 18, 14, 11, 5.5, c[3]);
      px(g, 10, 13, 16, 2, '#ffb07a');
      poly(g, [8, 14, 0, 10 + (f % 2) * 2, 1, 17, 8, 17], c[2]);
      poly(g, [27, 10, 36, 8, 39, 12, 36, 15, 28, 15], c[3]);
      poly(g, [30, 9, 31, 4, 33, 9], '#e8e2d4');
      px(g, 35, 10, 2, 1, '#ffe14a');
      px(g, 37, 13, 2, 1, '#3a0804');
      for (let i = 0; i < 5; ++i) poly(g, [12 + i * 3, 9, 13 + i * 3, 6, 14 + i * 3, 9], c[1]);
      poly(g, [20, 10, 32, 10 + up - 5, 34, 3 + up, 26, 9], c[4]);
      px(g, 14, 18, 3, 3, c[1]); px(g, 21, 18, 3, 3, c[1]);
    }],
    lich: [24, 32, (g, f) => {
      const c = ['#0a0810', '#16121e', '#241e30', '#342c44', '#4a3e5e', '#6a5a80'];
      const fl = [0, 1, 2, 1][f];
      poly(g, [6, 10, 18, 10, 21, 28 - fl, 16, 25, 12, 30 + fl, 8, 25, 3, 28 - fl], c[2]);
      poly(g, [6, 10, 11, 10, 9, 27, 4, 27], c[3]);
      px(g, 6, 16, 12, 1, RAMPS.gold[3]);
      block(g, 8, 3, 8, 8, RAMPS.bone, 3);
      px(g, 9, 6, 2, 2, '#4aff9a'); px(g, 13, 6, 2, 2, '#4aff9a');
      px(g, 10, 9, 4, 1, '#2a2418');
      for (let i = 0; i < 4; ++i) poly(g, [7 + i * 3, 3, 8 + i * 3, -1 - (i % 2), 9 + i * 3, 3], RAMPS.gold[4]);
      px(g, 20, 4, 1, 22, RAMPS.wood[2]);
      disc(g, 20.5, 3, 2.5, ['#003a1a', '#006a2a', '#1aaa4a', '#4aff9a', '#aaffcc', '#ffffff'], 3);
      px(g, 18, 12, 3, 2, RAMPS.bone[4]);
    }]
  };

  Object.assign(ENEMY_ART, {
    beetle: [16, 10, (g, f) => {
      // Burrowing beetle with digging claws
      const c = ['#3a2410', '#5a3a1a', '#7a5228', '#9a6c38', '#c8904a', '#e8b878'];
      for (let i = 0; i < 3; ++i) px(g, 3 + i * 3 + (f % 2 ? 1 : -1) * (i % 2 ? 1 : -1) * 0.5, 7, 1, 3, c[0]);
      ellipseFill(g, 7, 5, 6.5, 4, c[2]);
      ellipseFill(g, 6.5, 4, 5.5, 2.8, c[3]);
      px(g, 7, 1, 1, 7, c[1]);
      px(g, 4, 2, 2, 1, c[5]);
      poly(g, [12, 3, 16, 2 + (f % 2), 14, 5], c[4]); poly(g, [12, 6, 16, 7 - (f % 2), 14, 5], c[4]);
      px(g, 12, 4, 1, 1, '#1a0a0a');
    }],
    hornet: [12, 10, (g, f) => {
      const up = [-3, 0, 2, 0][f];
      poly(g, [5, 4, 2, 0 + up, 7, 3], 'rgba(220,240,255,0.95)');
      poly(g, [7, 4, 10, 0 + up, 9, 4], 'rgba(200,225,255,0.95)');
      ellipseFill(g, 6, 6, 4.5, 2.5, '#ffd23a');
      px(g, 3, 5, 1, 3, '#2a1a08'); px(g, 6, 4, 1, 4, '#2a1a08');
      px(g, 10, 5, 2, 2, '#2a1a08');
      poly(g, [1, 6, -1, 7, 1, 7.5], '#2a1a08');
    }],
    rhino: [22, 16, (g, f) => {
      const c = ['#2a2a38', '#40405a', '#5a5a78', '#7a7a98', '#a0a0bc', '#c8c8dc'];
      const b = BOB[f];
      const leg = [[0, 2], [2, 0], [0, -2], [-2, 0]][f];
      px(g, 4 + leg[0], 11 + b, 3, 5, c[1]); px(g, 8 - leg[0], 11 + b, 3, 5, c[2]);
      px(g, 13 + leg[1], 11 + b, 3, 5, c[1]); px(g, 16 - leg[1], 11 + b, 3, 5, c[2]);
      block(g, 3, 4 + b, 15, 8, c, 3);
      px(g, 5, 4 + b, 10, 1, c[5]);
      block(g, 16, 5 + b, 6, 6, c, 3);
      poly(g, [21, 6 + b, 24, 2 + b, 22, 8 + b], '#e8e2d4');
      px(g, 18, 6 + b, 1, 1, '#ff3a1a');
      block(g, 6, 3 + b, 6, 3, RAMPS.metal, 4);
    }],
    ghoul: [14, 18, (g, f) => {
      const r = biped(g, f, { body: '#4a5a3a', leg: '#3a4030', skin: '#8ab070', eye: '#ffff6a' }, { x: 3, y: 7, w: 8, h: 6, legH: 5 });
      px(g, r.bx + r.w, r.by + 3, 3, 1, '#c8d8a0'); px(g, r.bx + r.w + 2, r.by + 2, 1, 3, '#c8d8a0');
      px(g, r.bx + 1, r.by + 2, 2, 2, '#6a1a1a');
    }],
    gremlin: [12, 14, (g, f) => {
      const r = biped(g, f, { body: '#2a5a4a', leg: '#1a3a30', skin: '#5ac8a0', eye: '#ffef4a' }, { x: 2, y: 6, w: 7, h: 4, legH: 4, head: 5,
        weapon: (g, x, y) => { px(g, x, y - 5, 1, 6, RAMPS.metal[4]); px(g, x - 1, y - 6, 3, 2, '#7affc8'); } });
      poly(g, [r.hx - 1, r.hy + 1, r.hx - 3, r.hy - 2, r.hx + 1, r.hy], '#5ac8a0');
      poly(g, [r.hx + r.hs, r.hy + 1, r.hx + r.hs + 2, r.hy - 2, r.hx + r.hs - 1, r.hy], '#5ac8a0');
      px(g, r.bx, r.by - 1, 3, 4, '#8a6a40');
    }],
    hexer: [14, 19, (g, f) => {
      const r = biped(g, f, { body: '#5a2a7a', leg: '#3a1a50', skin: '#c8a888', belt: '#ffd75a', eye: '#ff4aff' }, { x: 3, y: 8, w: 8, h: 7, legH: 4 });
      poly(g, [r.hx - 2, r.hy + 2, r.hx + r.hs / 2, r.hy - 6, r.hx + r.hs + 2, r.hy + 2], '#3a1a50');
      px(g, r.hx + 1, r.hy - 3, 1, 1, '#ffd75a');
      px(g, r.bx + r.w + 1, r.by - 4, 1, 12, '#2a1a10');
      poly(g, [r.bx + r.w - 1, r.by - 4, r.bx + r.w + 1.5, r.by - 8, r.bx + r.w + 4, r.by - 4], '#c86aff');
    }],
    colossus: [30, 34, (g, f) => {
      const b = BOB[f];
      const c = ['#1a2a4a', '#2a4070', '#3a5a98', '#5a7ab8', '#8ab0e0', '#c8dcff'];
      px(g, 8 + LEG[f], 24 + b, 6, 10 - b, c[1]); px(g, 17 - LEG[f], 24 + b, 6, 10 - b, c[2]);
      block(g, 4, 9 + b, 22, 16, c, 3);
      block(g, 10, 1 + b, 10, 9, RAMPS.metal, 4);
      px(g, 12, 4 + b, 6, 2, '#7affff');
      block(g, -1 - LEG[f], 10 + b, 6, 13, c, 2); block(g, 25 + LEG[f], 10 + b, 6, 13, c, 2);
      disc(g, 15, 16 + b, 4, ['#003a5a', '#005a8a', '#2a9ad0', '#7ad8ff', '#c8f4ff', '#ffffff'], 3);
      px(g, 4, 9 + b, 22, 1, RAMPS.gold[4]); px(g, 4, 24 + b, 22, 1, RAMPS.gold[2]);
    }],
    sandworm: [36, 22, (g, f) => {
      const c = ['#5a3a18', '#7a5228', '#a07038', '#c8904a', '#e0b070', '#f6d8a0'];
      const wv = [0, 1, 0, -1][f];
      for (let i = 0; i < 6; ++i) {
        const x = 3 + i * 5, y = 12 + Math.sin(i * 1.2 + f * 1.5) * 2;
        disc(g, x, y, 4.5 - i * 0.2, c, 3);
        px(g, x - 2, y - 4, 4, 1, c[5]);
      }
      disc(g, 31, 10 + wv, 6, c, 3);
      ellipseFill(g, 35, 10 + wv, 2.5, 4, '#2a0a0a');
      for (let i = 0; i < 4; ++i) px(g, 34 + (i % 2), 6 + wv + i * 2, 2, 1, '#f6f2e2');
      px(g, 29, 7 + wv, 2, 1, '#ff3a1a');
    }],
    slimeking: [30, 26, (g, f) => {
      const c = ['#0e4a3a', '#167058', '#24967a', '#3ab898', '#4ae0a8', '#aaffe4'];
      const sq = [0, 1, 0, -1][f];
      ellipseFill(g, 15, 17 + sq * 0.5, 14 + sq, 9 - sq * 0.6, c[2]);
      ellipseFill(g, 13, 15 + sq * 0.5, 11 + sq, 7 - sq * 0.5, c[3]);
      px(g, 7, 11, 5, 2, c[5]);
      px(g, 17, 13, 3, 3, '#ffffff'); px(g, 22, 13, 3, 3, '#ffffff'); px(g, 18, 14, 2, 2, '#0a2a20'); px(g, 23, 14, 2, 2, '#0a2a20');
      for (let i = 0; i < 4; ++i) poly(g, [9 + i * 4, 9 - sq, 10 + i * 4, 3 - sq - (i % 2) * 2, 11 + i * 4, 9 - sq], RAMPS.gold[4]);
      px(g, 11, 7 - sq, 9, 2, RAMPS.gold[3]);
    }],
    troll: [28, 32, (g, f) => {
      const r = biped(g, f, { body: '#4a3a2a', leg: '#3a3020', skin: '#6a9a5a', helm: '#5a4a3a', belt: '#8a6a40', eye: '#ffef4a' }, { x: 7, y: 12, w: 13, h: 11, legH: 7, head: 8,
        weapon: (g, x, y) => { px(g, x, y - 15, 3, 18, RAMPS.wood[2]); disc(g, x + 1.5, y - 15, 4, RAMPS.wood, 3); for (let i = 0; i < 3; ++i) px(g, x - 2 + i * 2, y - 19, 1, 2, '#e8e2d4'); } });
      px(g, r.hx + 1, r.hy + r.hs - 2, 2, 2, '#f6f2e2'); px(g, r.hx + r.hs - 3, r.hy + r.hs - 2, 2, 2, '#f6f2e2');
      block(g, r.bx - 2, r.by, 4, 5, RAMPS.wood, 3);
      px(g, r.bx + 3, r.by + 3, 6, 1, '#8a2a1a');
    }]
  });
  const enemyArtCache = {};
  function enemyFrames(type) {
    let fr = enemyArtCache[type];
    if (!fr) {
      const [w, h, fn] = ENEMY_ART[type] || ENEMY_ART.normal;
      fr = enemyArtCache[type] = [];
      for (let f = 0; f < FRAMES; ++f)
        fr.push(pixelArt(w, h, (g) => fn(g, f)));
    }
    return fr;
  }

  // On-screen size: sprites scale with the enemy's collision radius
  function enemyScale(e) {
    const def = ENEMY_TYPES[e.type];
    return e.radius / def.radius;
  }

  function enemyFrame(e) {
    const fr = enemyFrames(e.type);
    const def = ENEMY_TYPES[e.type];
    const speed = def.flying ? 9 : 1;
    return fr[Math.floor((def.flying ? G.animTime * speed + e.walk * 0.05 : e.walk * 0.5)) % FRAMES];
  }

  function drawEnemyIcon(type, cx, cy, size) {
    const img = enemyFrames(type)[0];
    const k = size / Math.max(img.width, img.height);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, cx - img.width * k / 2, cy - img.height * k / 2, img.width * k, img.height * k);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
  }

  NS.enemyArt = { enemyFrames, enemyScale, enemyFrame, drawEnemyIcon };

})();
