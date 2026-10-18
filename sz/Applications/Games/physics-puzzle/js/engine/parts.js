;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * What a puzzle is made of: the placeable parts the player drags out of the
   * inventory (planks, blocks, springs, bumpers, fans, conveyors, magnets,
   * plus crates, glass and TNT in the Sandbox) and the fixtures a level is
   * built from (walls, ground, ramps, pegs, crates, glass, TNT, springs,
   * bumpers, conveyors, paddles, fans, water, magnets, portals, pendulums,
   * ice and lava). Both turn into body and zone specs for physics.js; every
   * body carries data.kind so the art knows how to draw it. Placement rules
   * (grid snap, rotation steps, overlap and launcher clearance) live here too.
   * Pure logic: no DOM.
   */

  const Ph = SZ.PhysicsPuzzlePhysics;
  const DEG = Math.PI / 180;

  const FIELD_W = 1280;
  const FIELD_H = 640;
  const GROUND_Y = 600;
  const GRID = 10;
  const ROT_STEP = 15;
  const BALL_R = 13;
  const TARGET_R = 26;
  const STAR_R = 17;

  /* ── placeable parts ── */

  const PARTS = Object.freeze({
    plank: { id: 'plank', name: 'Plank', desc: 'A wooden board. Tilt it into a ramp or a wall.', rotatable: true, half: [66, 8] },
    block: { id: 'block', name: 'Steel Block', desc: 'A heavy steel cube that never moves.', rotatable: true, half: [28, 28] },
    spring: { id: 'spring', name: 'Spring Pad', desc: 'Launches the ball off its face at high speed.', rotatable: true, half: [34, 10] },
    bumper: { id: 'bumper', name: 'Bumper', desc: 'A rubber dome that kicks the ball away in any direction.', rotatable: false, half: [24, 24] },
    fan: { id: 'fan', name: 'Fan', desc: 'Blows a steady wind along its arrow, about six ball widths far.', rotatable: true, half: [22, 22] },
    conveyor: { id: 'conveyor', name: 'Conveyor', desc: 'A moving belt that carries anything on top along its arrow.', rotatable: true, half: [90, 9] },
    magnet: { id: 'magnet', name: 'Magnet', desc: 'Pulls the steel ball toward itself from close by.', rotatable: false, half: [20, 20] },
    crate: { id: 'crate', name: 'Crate', desc: 'A loose wooden crate that tumbles when hit.', rotatable: true, half: [24, 24], sandbox: true },
    glass: { id: 'glass', name: 'Glass Pane', desc: 'A pane that shatters under a hard hit.', rotatable: true, half: [60, 7], sandbox: true },
    tnt: { id: 'tnt', name: 'TNT', desc: 'Explodes when hit hard, flinging everything near it.', rotatable: false, half: [22, 22], sandbox: true }
  });
  const PART_ORDER = ['plank', 'block', 'spring', 'bumper', 'fan', 'conveyor', 'magnet', 'crate', 'glass', 'tnt'];

  const SPRING_BOOST = 1150;
  const BUMPER_BOOST = 820;
  const FAN_LEN = 300;
  const FAN_STRENGTH = 2600;
  const CONVEYOR_SPEED = 300;
  const MAGNET_RADIUS = 170;
  const MAGNET_STRENGTH = 2600;

  function rot(x, y, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return [x * c - y * s, x * s + y * c];
  }

  /* placement { type, x, y, a (degrees) } -> { bodies, zones } */
  function partSpecs(p) {
    const a = (p.a || 0) * DEG;
    const data = { kind: p.type, part: true };
    switch (p.type) {
      case 'plank':
        return { bodies: [{ shape: 'box', x: p.x, y: p.y, w: 132, h: 16, a: a, mat: 'wood', data: data }], zones: [] };
      case 'block':
        return { bodies: [{ shape: 'box', x: p.x, y: p.y, w: 56, h: 56, a: a, mat: 'metal', data: data }], zones: [] };
      case 'spring':
        return { bodies: [{ shape: 'box', x: p.x, y: p.y, w: 68, h: 20, a: a, mat: 'rubber', boost: SPRING_BOOST, tag: 'spring', data: data }], zones: [] };
      case 'bumper':
        return { bodies: [{ shape: 'circle', x: p.x, y: p.y, r: 24, mat: 'rubber', boost: BUMPER_BOOST, boostDir: 'any', tag: 'bumper', data: data }], zones: [] };
      case 'fan': {
        const o = rot(22, 0, a);
        return { bodies: [{ shape: 'box', x: p.x, y: p.y, w: 40, h: 44, a: a, mat: 'metal', data: data }],
          zones: [{ kind: 'fan', x: p.x + o[0], y: p.y + o[1], len: FAN_LEN, width: 70, a: a, strength: FAN_STRENGTH, data: data }] };
      }
      case 'conveyor':
        return { bodies: [{ shape: 'box', x: p.x, y: p.y, w: 180, h: 18, a: a, mat: 'rubber', fric: 1.2, surface: CONVEYOR_SPEED, data: data }], zones: [] };
      case 'magnet':
        return { bodies: [{ shape: 'circle', x: p.x, y: p.y, r: 20, mat: 'metal', data: data }],
          zones: [{ kind: 'magnet', x: p.x, y: p.y, radius: MAGNET_RADIUS, strength: MAGNET_STRENGTH, data: data }] };
      case 'crate':
        return { bodies: [{ shape: 'box', x: p.x, y: p.y, w: 48, h: 48, a: a, type: 'dynamic', mat: 'wood', data: data }], zones: [] };
      case 'glass':
        return { bodies: [{ shape: 'box', x: p.x, y: p.y, w: 120, h: 14, a: a, mat: 'glass', breakImpulse: 380, tag: 'glass', data: data }], zones: [] };
      case 'tnt':
        return { bodies: [{ shape: 'box', x: p.x, y: p.y, w: 44, h: 44, a: a, mat: 'tnt', tnt: { radius: 170, power: 1100 }, tag: 'tnt', data: data }], zones: [] };
    }
    return { bodies: [], zones: [] };
  }

  /* ── level fixtures ── */

  /*
   * A level lists its fixtures as arrays: [kind, ...args]. The world's theme
   * picks the default material of walls and ground.
   */
  function fixtureSpecs(item, theme) {
    const k = item[0];
    const out = { bodies: [], zones: [], joints: [] };
    const wallMat = theme && theme.wallMat || 'wood';
    const groundMat = theme && theme.groundMat || 'stone';
    const d = (extra) => Object.assign({ kind: k }, extra || {});
    switch (k) {
      case 'ground': {
        /* ['ground', x0, x1, top = GROUND_Y] a slab down past the field bottom */
        const top = item[3] !== undefined ? item[3] : GROUND_Y;
        const h = FIELD_H + 60 - top;
        out.bodies.push({ shape: 'box', x: (item[1] + item[2]) / 2, y: top + h / 2, w: item[2] - item[1], h: h, mat: groundMat, data: d({ top: top }) });
        break;
      }
      case 'wall':
        /* ['wall', x, y, w, h, angleDeg = 0, mat] */
        out.bodies.push({ shape: 'box', x: item[1], y: item[2], w: item[3], h: item[4], a: (item[5] || 0) * DEG, mat: item[6] || wallMat, data: d({ w: item[3], h: item[4], mat: item[6] || wallMat }) });
        break;
      case 'ice':
        out.bodies.push({ shape: 'box', x: item[1], y: item[2], w: item[3], h: item[4], a: (item[5] || 0) * DEG, mat: 'ice', data: d({ w: item[3], h: item[4] }) });
        break;
      case 'ramp': {
        /* ['ramp', x0, y0 (bottom left), w, h, dir]: a wedge rising to the right (dir 1) or left (dir -1) */
        const x0 = item[1], y0 = item[2], w = item[3], h = item[4], dir = item[5] || 1;
        const pts = dir > 0 ? [[0, 0], [w, 0], [w, -h]] : [[0, 0], [w, 0], [0, -h]];
        out.bodies.push({ shape: 'poly', points: pts, x: x0, y: y0, mat: item[6] || wallMat, data: d({ dir: dir, w: w, h: h }) });
        break;
      }
      case 'peg':
        out.bodies.push({ shape: 'circle', x: item[1], y: item[2], r: item[3] || 12, mat: 'metal', data: d() });
        break;
      case 'crate':
        out.bodies.push({ shape: 'box', x: item[1], y: item[2], w: item[3] || 48, h: item[4] || item[3] || 48, a: (item[5] || 0) * DEG, type: 'dynamic', mat: 'wood', data: d() });
        break;
      case 'steel':
        out.bodies.push({ shape: 'box', x: item[1], y: item[2], w: item[3] || 44, h: item[4] || item[3] || 44, type: 'dynamic', mat: 'metal', data: d() });
        break;
      case 'boulder':
        out.bodies.push({ shape: 'circle', x: item[1], y: item[2], r: item[3] || 26, type: 'dynamic', mat: 'stone', data: d() });
        break;
      case 'glass':
        out.bodies.push({ shape: 'box', x: item[1], y: item[2], w: item[3], h: item[4] || 14, a: (item[5] || 0) * DEG, mat: 'glass', breakImpulse: item[6] || 380, tag: 'glass', data: d({ w: item[3], h: item[4] || 14 }) });
        break;
      case 'tnt':
        /* ['tnt', x, y, dynamic] */
        out.bodies.push({ shape: 'box', x: item[1], y: item[2], w: 44, h: 44, type: item[3] ? 'dynamic' : 'static', mat: 'tnt', tnt: { radius: 170, power: 1100 }, tag: 'tnt', data: d() });
        break;
      case 'spring':
        /* ['spring', x, y, angleDeg, boost] */
        out.bodies.push({ shape: 'box', x: item[1], y: item[2], w: 68, h: 20, a: (item[3] || 0) * DEG, mat: 'rubber', boost: item[4] || SPRING_BOOST, tag: 'spring', data: d() });
        break;
      case 'bumper':
        out.bodies.push({ shape: 'circle', x: item[1], y: item[2], r: item[3] || 24, mat: 'rubber', boost: item[4] || BUMPER_BOOST, boostDir: 'any', tag: 'bumper', data: d() });
        break;
      case 'conveyor':
        /* ['conveyor', x, y, len, angleDeg, speed] */
        out.bodies.push({ shape: 'box', x: item[1], y: item[2], w: item[3], h: 18, a: (item[4] || 0) * DEG, mat: 'rubber', fric: 1.2, surface: item[5] !== undefined ? item[5] : CONVEYOR_SPEED, data: d({ w: item[3] }) });
        break;
      case 'paddle':
        /* ['paddle', x, y, len, spin rad/s, angleDeg]: a kinematic bar spinning about its centre */
        out.bodies.push({ shape: 'box', x: item[1], y: item[2], w: item[3], h: 16, a: (item[5] || 0) * DEG, type: 'kinematic', mat: 'metal', motor: { spin: item[4] }, data: d({ w: item[3] }) });
        break;
      case 'swing':
        /* ['swing', x, y, len, ampDeg, freqHz, angleDeg] a bar rocking back and forth */
        out.bodies.push({ shape: 'box', x: item[1], y: item[2], w: item[3], h: 16, a: (item[6] || 0) * DEG, type: 'kinematic', mat: 'metal', motor: { swing: true, amp: item[4] * DEG, freq: item[5] }, data: d({ w: item[3], kind: 'paddle' }) });
        out.bodies[0].data.kind = 'paddle';
        break;
      case 'fan': {
        /* ['fan', x, y, angleDeg, len, strength] */
        const a = (item[3] || 0) * DEG;
        const o = rot(22, 0, a);
        out.bodies.push({ shape: 'box', x: item[1], y: item[2], w: 40, h: 44, a: a, mat: 'metal', data: d() });
        out.zones.push({ kind: 'fan', x: item[1] + o[0], y: item[2] + o[1], len: item[4] || FAN_LEN, width: 70, a: a, strength: item[5] || FAN_STRENGTH, data: d() });
        break;
      }
      case 'water':
        /* ['water', x0, y0, x1, y1] */
        out.zones.push({ kind: 'water', x0: item[1], y0: item[2], x1: item[3], y1: item[4], density: 1.6, drag: 2.2, data: d() });
        break;
      case 'magnet':
        /* ['magnet', x, y, radius, strength] */
        out.bodies.push({ shape: 'circle', x: item[1], y: item[2], r: 20, mat: 'metal', data: d() });
        out.zones.push({ kind: 'magnet', x: item[1], y: item[2], radius: item[3] || MAGNET_RADIUS, strength: item[4] || MAGNET_STRENGTH, data: d() });
        break;
      case 'portal':
        /* ['portal', ax, ay, aDeg, bx, by, bDeg]: each mouth faces along its angle */
        out.zones.push({ kind: 'portal', ax: item[1], ay: item[2], aa: item[3] * DEG, bx: item[4], by: item[5], ba: item[6] * DEG, r: 26, data: d() });
        break;
      case 'pendulum': {
        /* ['pendulum', ax, ay, len, startAngleDeg (0 = straight down), r] */
        const ang = (item[4] || 0) * DEG, len = item[3], r = item[5] || 20;
        const bx = item[1] + Math.sin(ang) * len, by = item[2] + Math.cos(ang) * len;
        out.bodies.push({ shape: 'circle', x: bx, y: by, r: r, type: 'dynamic', mat: 'metal', density: 3, data: d({ ax: item[1], ay: item[2] }) });
        out.joints.push({ ax: item[1], ay: item[2], body: 0, len: len });
        break;
      }
      case 'lava':
        /* ['lava', x0, y0, x1, y1]: burns any ball that touches it */
        out.bodies.push({ shape: 'box', x: (item[1] + item[3]) / 2, y: (item[2] + item[4]) / 2, w: item[3] - item[1], h: item[4] - item[2], sensor: true, tag: 'lava', data: d() });
        break;
    }
    return out;
  }

  /* adds a list of specs to a world; returns the created bodies */
  function addSpecs(world, specs) {
    const made = [];
    for (const b of specs.bodies)
      made.push(Ph.addBody(world, b));
    for (const z of specs.zones)
      Ph.addZone(world, z);
    if (specs.joints)
      for (const j of specs.joints)
        Ph.addJoint(world, { ax: j.ax, ay: j.ay, body: made[j.body], len: j.len });
    return made;
  }

  /* ══════════════════════════════════════════════════════════════════
     PLACEMENT
     ══════════════════════════════════════════════════════════════════ */

  function snap(v) {
    return Math.round(v / GRID) * GRID;
  }

  function snapAngle(a) {
    return ((Math.round(a / ROT_STEP) * ROT_STEP) % 360 + 360) % 360;
  }

  /* bodies of every fixture plus the sensors' footprints, in a scratch world */
  function obstacleWorld(level, theme, placed, skipIndex) {
    const w = Ph.createWorld({ gravity: [0, 0] });
    for (const item of level.items)
      addSpecs(w, fixtureSpecs(item, theme));
    (level.targets || []).forEach(t => Ph.addBody(w, { shape: 'circle', x: t[0], y: t[1], r: TARGET_R + 4, sensor: true }));
    (level.stars || []).forEach(s => Ph.addBody(w, { shape: 'circle', x: s[0], y: s[1], r: STAR_R }));
    for (const it of level.items) {
      if (it[0] === 'portal') {
        Ph.addBody(w, { shape: 'circle', x: it[1], y: it[2], r: 30 });
        Ph.addBody(w, { shape: 'circle', x: it[4], y: it[5], r: 30 });
      }
    }
    const L = level.launcher;
    Ph.addBody(w, { shape: 'circle', x: L[0], y: L[1], r: 70 });
    (placed || []).forEach((p, i) => {
      if (i !== skipIndex)
        addSpecs(w, { bodies: partSpecs(p).bodies, zones: [] });
    });
    return w;
  }

  /*
   * Can part p go here? { ok, reason }. Parts must stay inside the field,
   * keep clear of the launcher and not overlap fixtures, targets, stars or
   * other parts.
   */
  function canPlace(level, theme, placed, p, skipIndex) {
    const specs = partSpecs(p);
    const w = obstacleWorld(level, theme, placed, skipIndex);
    const probe = Ph.createWorld({ gravity: [0, 0] });
    const mine = addSpecs(probe, { bodies: specs.bodies, zones: [] });
    for (const b of mine) {
      if (b.x0 < 8 || b.x1 > FIELD_W - 8 || b.y0 < 8 || b.y1 > FIELD_H - 4)
        return { ok: false, reason: 'Keep parts inside the field' };
    }
    for (const b of mine)
      for (const o of w.bodies)
        if (Ph.overlap(b, o, 1))
          return { ok: false, reason: o.sensor || o.r === 70 ? 'Too close to the launcher or a target' : 'Something is in the way' };
    return { ok: true, reason: '' };
  }

  /* inventory left: level.inv minus what is placed, plus tree bonuses */
  function inventoryLeft(inv, placed) {
    const left = Object.assign({}, inv);
    for (const p of placed)
      left[p.type] = (left[p.type] || 0) - 1;
    return left;
  }

  SZ.PhysicsPuzzleParts = Object.freeze({
    FIELD_W: FIELD_W, FIELD_H: FIELD_H, GROUND_Y: GROUND_Y, GRID: GRID, ROT_STEP: ROT_STEP,
    BALL_R: BALL_R, TARGET_R: TARGET_R, STAR_R: STAR_R,
    PARTS: PARTS, PART_ORDER: PART_ORDER,
    SPRING_BOOST: SPRING_BOOST, FAN_LEN: FAN_LEN, MAGNET_RADIUS: MAGNET_RADIUS,
    partSpecs: partSpecs, fixtureSpecs: fixtureSpecs, addSpecs: addSpecs,
    snap: snap, snapAngle: snapAngle, canPlace: canPlace, inventoryLeft: inventoryLeft
  });
})();
