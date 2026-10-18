;(function() {
  'use strict';

  // Drones: couriers in the mine, gun and repair drones at the dome.
  // Owns: NS.drones and these state fields:
  //   G.drones, G.gunDrones, G.repairBots
  // Reads: constants, dom, rules, upgrades, gameState, mineGen, animation, pathfinding, cargo, artifacts
  // Reads state of: gameState, run

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { TWO_PI, VIEW_SURFACE, VIEW_UNDERGROUND, GRID_COLS, GRID_ROWS, TILE_SIZE, TILE_EMPTY,
    TILE_HIGHLIGHT_COLORS, TILE_VALUES, TILE_LABELS } = NS.constants;
  const { particles, floatingText } = NS.dom;
  const { RESOURCE_TILES, getDepthValueMultiplier, getTileBaseColor, DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { getEffectiveLevel } = NS.upgrades;
  const { pileByCell } = NS.gameState;
  const { getTileHardness } = NS.mineGen;
  const { spawnCrumble, applyDamageToEnemy } = NS.animation;
  const { findPath } = NS.pathfinding;
  const { bagSlots, bagTotal, bagAdd, takePileOre, pilesNear } = NS.cargo;
  const { hasArtifact, depositScore } = NS.artifacts;

  /* ======================================================================
     DRONES -- couriers in the mine, gun and repair drones at the dome
     ====================================================================== */

  const DRONE_DOCK_TIME = 1.2;   // seconds a courier rests in the dome between trips
  G.drones = [];               // couriers: { x, y, state, path, pi, cargo, job, timer, ... }
  G.gunDrones = [];            // { angle, x, y, cooldown, flash, tx, ty }
  G.repairBots = [];           // { x, y, angle, beam, bx, by }
  const MAX_DRONES_PER_KIND = 10;
  let keeperPickTimer = 0;       // countdown to the next check which courier serves the keeper

  function droneShaftTile() {
    return { col: Math.floor(GRID_COLS / 2), row: 0 };
  }

  function courierCount() {
    let n = (G.unlockedTools.droneBay ? 1 : 0) + (G.primaryGadget === 'droneyard' ? 1 : 0);
    if (n > 0)
      n += getEffectiveLevel('droneCount');
    return Math.min(MAX_DRONES_PER_KIND, n);
  }

  function gunDroneCount() {
    return G.unlockedTools.combatDrone ? Math.min(MAX_DRONES_PER_KIND, 1 + getEffectiveLevel('gunDroneCount')) : 0;
  }

  function repairDroneCount() {
    return G.unlockedTools.repairDrone ? Math.min(MAX_DRONES_PER_KIND, 1 + getEffectiveLevel('repairDroneCount')) : 0;
  }

  function droneBoost() {
    return G.primaryGadget === 'droneyard' ? 1.5 : 1;
  }

  // Flight speed in px/s, cargo size, pickup radius (tiles), laser reach (tiles) and laser speed
  function droneSpeed() { return TILE_SIZE * 3.2 * Math.pow(1.3, getEffectiveLevel('droneSpeed')) * droneBoost() * (hasArtifact('hiveLink') ? 1.25 : 1); }
  function droneCargoCap() { return (15 + 20 * getEffectiveLevel('droneCargo')) * (hasArtifact('hiveLink') ? 2 : 1); }
  function dronePickupRadius() { return 1 + getEffectiveLevel('droneSpeed'); }
  function droneLaserReach() { return 4 + 2 * getEffectiveLevel('droneMining'); }
  function droneLaserSpeed() { return Math.pow(1.35, getEffectiveLevel('droneMining')) * droneBoost(); }

  // Bring the drone fleet in line with the upgrades (new drones start in the dome)
  function syncDrones(announce) {
    const shaft = droneShaftTile();
    const want = courierCount();
    while (G.drones.length < want) {
      G.drones.push({ x: shaft.col * TILE_SIZE + TILE_SIZE / 2, y: -TILE_SIZE, state: 'dock', path: null, pi: 0, cargo: 0, bag: {}, job: null, timer: 0.5 + G.drones.length * 0.4, phase: Math.random() * TWO_PI, repath: 0, laser: 0 });
      if (announce)
        floatingText.add(DOME_X - 150, DOME_Y - 170, 'Courier drone ready!', { color: '#d8b8ff', font: 'bold 24px sans-serif' });
    }
    G.drones.length = Math.min(G.drones.length, want);
    const guns = gunDroneCount();
    while (G.gunDrones.length < guns)
      G.gunDrones.push({ angle: G.gunDrones.length ? G.gunDrones[0].angle : 0, x: DOME_X, y: DOME_Y - 160, cooldown: 0.5, flash: 0, tx: 0, ty: 0 });
    G.gunDrones.length = guns;
    const medics = repairDroneCount();
    while (G.repairBots.length < medics)
      G.repairBots.push({ x: DOME_X + 60, y: DOME_Y - 150, angle: G.repairBots.length * 1.7, beam: 0, bx: DOME_X, by: DOME_Y - DOME_RADIUS });
    G.repairBots.length = medics;
  }

  function droneTile(d) {
    return { col: Math.max(0, Math.min(GRID_COLS - 1, Math.floor(d.x / TILE_SIZE))), row: Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(d.y / TILE_SIZE))) };
  }

  // Exposed ore near the keeper that no one else is working on, nearest first
  function findDroneOre(d) {
    const R = droneLaserReach();
    let best = null, bestD = Infinity;
    const busy = new Set();
    for (const o of G.drones)
      if (o !== d && o.job && o.job.kind === 'mine')
        busy.add(o.job.row * GRID_COLS + o.job.col);
    for (let r = Math.max(0, G.drillY - R); r <= Math.min(GRID_ROWS - 1, G.drillY + R); ++r)
      for (let c = Math.max(0, G.drillX - R); c <= Math.min(GRID_COLS - 1, G.drillX + R); ++c) {
        const t = G.undergroundGrid[r][c];
        if (!RESOURCE_TILES.includes(t)) continue;
        const dist = Math.abs(r - G.drillY) + Math.abs(c - G.drillX);
        if (dist > R || dist >= bestD) continue;
        if (G.miningTarget && G.miningTarget.col === c && G.miningTarget.row === r) continue;
        if (busy.has(r * GRID_COLS + c)) continue;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const ar = r + dr, ac = c + dc;
          if (ar < 0 || ar >= GRID_ROWS || ac < 0 || ac >= GRID_COLS || G.undergroundGrid[ar][ac] !== TILE_EMPTY) continue;
          best = { kind: 'mine', col: c, row: r, standCol: ac, standRow: ar };
          bestD = dist;
          break;
        }
      }
    return best;
  }

  // A pile a courier is still flying to, or one no courier could reach a moment ago
  function pileClaimed(p) {
    if (p.noRoute > G.animTime) return true;
    const o = p.claimedBy;
    return !!o && !!o.job && o.job.kind === 'drop' && o.job.drop === p && G.drones.indexOf(o) >= 0;
  }

  // Nearest unclaimed pile: ring by ring (Manhattan distance) up to 40 tiles,
  // then the nearest of all piles anywhere in the mine
  function nearestDrop(fromCol, fromRow) {
    if (!pileByCell.size) return null;
    for (let dist = 0; dist <= 40; ++dist)
      for (let dr = -dist; dr <= dist; ++dr) {
        const r = fromRow + dr;
        if (r < 0 || r >= GRID_ROWS) continue;
        const span = dist - Math.abs(dr);
        for (let k = 0; k < (span ? 2 : 1); ++k) {
          const c = fromCol + (k ? -span : span);
          if (c < 0 || c >= GRID_COLS) continue;
          const p = pileByCell.get(r * GRID_COLS + c);
          if (p && !pileClaimed(p))
            return p;
        }
      }
    let best = null, bestD = Infinity;
    for (const p of G.droppedResources) {
      const dist = Math.abs(p.col - fromCol) + Math.abs(p.row - fromRow);
      if (dist < bestD && !pileClaimed(p)) {
        best = p;
        bestD = dist;
      }
    }
    return best;
  }

  // The keeper is (or is about to be) in the mine
  function keeperInMine() {
    return (G.transitionPhase !== 'none' && G.transitionTarget ? G.transitionTarget : G.currentView) === VIEW_UNDERGROUND;
  }

  // The keeper's bag is worth a courier trip
  function keeperNeedsCourier() {
    return keeperInMine() && bagTotal() >= Math.min(10, G.carryCapacity * 0.25);
  }

  // Next errand for a courier with room in its hold: loose ore first, then
  // lasering ore near the keeper's spot - in any view. Serving the keeper is
  // handed out separately (assignKeeperCourier), to one courier at a time.
  function pickDroneJob(d) {
    const room = droneCargoCap() - d.cargo;
    if (room <= 0) return null;
    const here = d.state === 'dock' ? droneShaftTile() : droneTile(d);
    const drop = nearestDrop(here.col, here.row);
    if (drop) {
      drop.claimedBy = d;
      return { kind: 'drop', drop, col: drop.col, row: drop.row };
    }
    if (G.unlockedTools.droneMiner)
      return findDroneOre(d);
    return null;
  }

  // Drop a courier's claim on the pile it was flying to
  function releaseDroneClaim(d) {
    if (d.job && d.job.kind === 'drop' && d.job.drop.claimedBy === d)
      d.job.drop.claimedBy = null;
  }

  // Take up the next errand, or fly home when there is none (or the hold is nearly full)
  function nextDroneJob(d) {
    d.job = d.cargo < droneCargoCap() * 0.85 ? pickDroneJob(d) : null;
    if (d.job) {
      d.state = 'fly';
      if (routeDrone(d)) return;
    }
    sendDroneHome(d);
  }

  // A courier that may drop what it is doing to serve the keeper
  function courierFree(d) {
    if (d.cargo >= droneCargoCap() * 0.5) return false;
    if (d.state === 'dock') return true;
    return d.state === 'fly' && !!d.job && (d.job.kind === 'drop' || d.job.kind === 'mine' || d.job.kind === 'home');
  }

  // At most one courier serves the keeper: the nearest free one, while the keeper
  // is in the mine with a bag worth fetching. Any other keeper job is dropped.
  function assignKeeperCourier() {
    const want = keeperNeedsCourier();
    let keeper = null;
    for (const d of G.drones) {
      if (!d.job || d.job.kind !== 'keeper') continue;
      if (want && !keeper)
        keeper = d;
      else
        nextDroneJob(d);
    }
    if (!want || keeper) return;
    let best = null, bestD = Infinity;
    for (const d of G.drones) {
      if (!courierFree(d)) continue;
      const t = d.state === 'dock' ? droneShaftTile() : droneTile(d);
      const dist = Math.abs(t.col - G.drillX) + Math.abs(t.row - G.drillY) + (d.state === 'dock' ? 2 : 0);
      if (dist < bestD) {
        best = d;
        bestD = dist;
      }
    }
    if (!best) return;
    releaseDroneClaim(best);
    const docked = best.state === 'dock';
    if (docked) {
      const sh = droneShaftTile();
      best.x = sh.col * TILE_SIZE + TILE_SIZE / 2;
      best.y = TILE_SIZE / 2;
    }
    best.job = { kind: 'keeper' };
    best.state = 'fly';
    best.repath = 0.4;
    if (routeDrone(best)) return;
    if (docked) {
      best.job = null;
      best.state = 'dock';
      best.timer = 1;
    } else
      nextDroneJob(best);
  }

  function jobTarget(d) {
    if (d.job.kind === 'keeper') return { col: G.drillX, row: G.drillY };
    if (d.job.kind === 'mine') return { col: d.job.standCol, row: d.job.standRow };
    if (d.job.kind === 'home') return droneShaftTile();
    return { col: d.job.col, row: d.job.row };
  }

  function routeDrone(d) {
    const from = droneTile(d);
    const to = jobTarget(d);
    if (G.undergroundGrid[from.row][from.col] !== TILE_EMPTY) {
      // Lost inside rock (should not happen): hop back to the shaft
      const sh = droneShaftTile();
      d.x = sh.col * TILE_SIZE + TILE_SIZE / 2;
      d.y = TILE_SIZE / 2;
    }
    const path = findPath(droneTile(d).col, droneTile(d).row, to.col, to.row);
    d.path = path;
    d.pi = 0;
    d.target = to;
    if (!path && d.job.kind === 'drop') {
      // Out of reach (buried or cut off): leave it be for a while
      d.job.drop.noRoute = G.animTime + 5;
      releaseDroneClaim(d);
    }
    return !!path;
  }

  function sendDroneHome(d) {
    d.job = { kind: 'home' };
    d.state = 'fly';
    if (!routeDrone(d)) {
      d.state = 'dock';
      d.timer = DRONE_DOCK_TIME;
    }
  }

  function dronePickupAt(d, col, row) {
    let got = 0;
    const cap = droneCargoCap();
    const fit = (t, want) => bagAdd(TILE_LABELS[t], want, d.bag, cap);
    for (const drop of pilesNear(col, row, dronePickupRadius())) {
      const res = takePileOre(drop, Infinity, fit);
      for (const t in res.taken)
        G.resources[TILE_LABELS[t]] += res.taken[t];
      got += res.count;
    }
    d.cargo = bagSlots(d.bag);
    return got;
  }

  // The drone's laser finished an ore tile: the ore goes straight into the hold
  function droneMinedTile(d) {
    const { col, row } = d.job;
    const tile = G.undergroundGrid[row][col];
    if (!RESOURCE_TILES.includes(tile)) return;
    const value = Math.round(TILE_VALUES[tile] * getDepthValueMultiplier(row));
    G.resources[TILE_LABELS[tile]] += value;
    bagAdd(TILE_LABELS[tile], value, d.bag, droneCargoCap());
    d.cargo = bagSlots(d.bag);
    G.undergroundGrid[row][col] = TILE_EMPTY;
    G.tileHP[row][col] = 0;
    G.tileMaxHP[row][col] = 0;
    if (G.currentView === VIEW_UNDERGROUND) {
      const tx = col * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, ty = row * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
      spawnCrumble(tx, ty, getTileBaseColor(tile, row));
      particles.sparkle(tx, ty, 10, { color: TILE_HIGHLIGHT_COLORS[tile] || '#fff', speed: 2 });
      floatingText.add(tx, ty - 26, `Drone +${value} ${TILE_LABELS[tile]}`, { color: '#d8b8ff', font: 'bold 18px sans-serif' });
      SZ.GameAudio.play('pickup', { pitch: 1.4, volume: 0.4 });
    }
  }

  function arriveDrone(d) {
    const job = d.job;
    if (job.kind === 'home') {
      if (d.cargo > 0) {
        const total = bagTotal(d.bag);
        if (G.currentView === VIEW_SURFACE) {
          floatingText.add(DOME_X - 140, DOME_Y - 150, `Drone delivered ${total}`, { color: '#d8b8ff', font: 'bold 20px sans-serif' });
          SZ.GameAudio.play('coin', { pitch: 1.3, volume: 0.5 });
        }
        depositScore(total, DOME_X - 140, DOME_Y - 190);
      }
      d.cargo = 0;
      d.bag = {};
      d.job = null;
      d.state = 'dock';
      d.timer = DRONE_DOCK_TIME / droneBoost();
      return;
    }
    if (job.kind === 'keeper') {
      // The keeper's bag goes into the hold as far as it fits (packed)
      let take = 0;
      const cap = droneCargoCap();
      for (const label of Object.keys(G.bag)) {
        const k = bagAdd(label, G.bag[label], d.bag, cap);
        if (k <= 0) continue;
        take += k;
        G.bag[label] -= k;
        if (G.bag[label] <= 0)
          delete G.bag[label];
      }
      G.carried = bagSlots();
      d.cargo = bagSlots(d.bag);
      if (take > 0) {
        if (G.currentView === VIEW_UNDERGROUND)
          floatingText.add(d.x - G.cameraX, d.y - G.cameraY - 30, `Drone took ${take} cargo`, { color: '#d8b8ff', font: 'bold 18px sans-serif' });
        SZ.GameAudio.play('blip', { pitch: 1.5, volume: 0.4 });
      }
      dronePickupAt(d, G.drillX, G.drillY);
    } else if (job.kind === 'drop') {
      if (job.drop.claimedBy === d)
        job.drop.claimedBy = null;
      dronePickupAt(d, job.col, job.row);
    } else if (job.kind === 'mine') {
      if (G.undergroundGrid[job.row][job.col] !== TILE_EMPTY) {
        d.state = 'mine';
        const hard = getTileHardness(job.row, G.undergroundGrid[job.row][job.col]);
        d.timer = d.laserTime = Math.max(0.4, hard * 1.6 / droneLaserSpeed());
        return;
      }
    }
    // Look for more work while there is room, otherwise head home
    nextDroneJob(d);
  }

  function updateCourier(d, dt) {
    d.phase += dt * 6;
    if (d.state === 'dock') {
      d.timer -= dt;
      if (d.timer > 0) return;
      d.job = pickDroneJob(d);
      if (!d.job) {
        d.timer = 0.6;
        return;
      }
      const sh = droneShaftTile();
      d.x = sh.col * TILE_SIZE + TILE_SIZE / 2;
      d.y = TILE_SIZE / 2;
      d.state = 'fly';
      if (!routeDrone(d)) {
        d.state = 'dock';
        d.job = null;
        d.timer = 1;
      }
      return;
    }
    if (d.state === 'mine') {
      const job = d.job;
      if (G.undergroundGrid[job.row][job.col] === TILE_EMPTY) {
        arriveDrone(Object.assign(d, { state: 'fly' }));
        return;
      }
      d.timer -= dt;
      const ratio = 1 - Math.max(0, d.timer) / d.laserTime;
      if (G.tileMaxHP[job.row][job.col] > 0)
        G.tileHP[job.row][job.col] = Math.min(G.tileHP[job.row][job.col], G.tileMaxHP[job.row][job.col] * (1 - ratio));
      if (G.currentView === VIEW_UNDERGROUND && Math.random() < dt * 14)
        particles.sparkle(job.col * TILE_SIZE + TILE_SIZE / 2 - G.cameraX + (Math.random() - 0.5) * 16, job.row * TILE_SIZE + TILE_SIZE / 2 - G.cameraY + (Math.random() - 0.5) * 16, 1, { color: '#ff9adf', speed: 1.5 });
      if (d.timer <= 0) {
        droneMinedTile(d);
        d.state = 'fly';
        arriveDrone(Object.assign(d, { job: { kind: 'idle' } }));
      }
      return;
    }
    // Flying: chase the keeper if they moved (back to normal work once they surface), then follow the path
    if (d.job && d.job.kind === 'keeper') {
      if (!keeperInMine()) {
        nextDroneJob(d);
        return;
      }
      d.repath -= dt;
      if (d.repath <= 0 && (d.target.col !== G.drillX || d.target.row !== G.drillY)) {
        d.repath = 0.4;
        routeDrone(d);
      }
    }
    if (d.job && d.job.kind === 'drop' && pileByCell.get(d.job.drop.key) !== d.job.drop) {
      arriveDrone(Object.assign(d, { job: { kind: 'idle' } }));
      return;
    }
    if (!d.path) {
      sendDroneHome(d);
      return;
    }
    let move = droneSpeed() * dt;
    while (move > 0 && d.pi < d.path.length) {
      const step = d.path[d.pi];
      const tx = step.col * TILE_SIZE + TILE_SIZE / 2, ty = step.row * TILE_SIZE + TILE_SIZE / 2;
      const dx = tx - d.x, dy = ty - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= move) {
        d.x = tx;
        d.y = ty;
        move -= dist;
        ++d.pi;
      } else {
        d.x += dx / dist * move;
        d.y += dy / dist * move;
        d.face = dx < -0.5 ? -1 : dx > 0.5 ? 1 : d.face;
        move = 0;
      }
    }
    if (d.pi >= d.path.length) {
      // Close the last gap to an off-centre start (the shaft mouth)
      const t = d.target;
      d.x = t.col * TILE_SIZE + TILE_SIZE / 2;
      d.y = t.row * TILE_SIZE + TILE_SIZE / 2;
      d.path = null;
      arriveDrone(d);
    }
  }

  function updateDrones(dt) {
    // The couriers work the mine whatever is on screen
    keeperPickTimer -= dt;
    if (keeperPickTimer <= 0) {
      keeperPickTimer = 0.4;
      assignKeeperCourier();
    }
    for (const d of G.drones)
      updateCourier(d, dt);

    // Gun drones circle above the dome, evenly spread, and shoot whatever comes closest
    const gunLevel = getEffectiveLevel('combatDroneLevel');
    // A squad of two or more also gets the sharper shots of the former third level
    const gunBonus = gunLevel >= 1 && G.gunDrones.length >= 2 ? 2 : 0;
    G.gunDrones.forEach((g, i) => {
      g.angle += dt * 0.7;
      const a = g.angle + i * TWO_PI / G.gunDrones.length;
      g.x = DOME_X + Math.cos(a) * (200 + Math.sin(g.angle * 1.3) * 20);
      g.y = DOME_Y - 175 + Math.sin(a) * 50 + Math.sin(g.angle * 2 + i) * 8;
      g.cooldown -= dt;
      g.flash = Math.max(0, g.flash - dt * 5);
      if (g.cooldown > 0 || !G.enemies.length) return;
      let target = null, best = 560 * 560;
      for (const e of G.enemies) {
        if (e.hidden) continue;
        const dd = (e.x - g.x) * (e.x - g.x) + (e.y - g.y) * (e.y - g.y);
        if (dd < best) {
          best = dd;
          target = e;
        }
      }
      if (!target) return;
      g.cooldown = 1 / ((1.1 + 0.5 * Math.min(1, gunLevel)) * droneBoost());
      applyDamageToEnemy(target, 5 + 3 * Math.min(1, gunLevel) + gunBonus);
      g.flash = 1;
      g.tx = target.x;
      g.ty = target.y;
      if (G.currentView === VIEW_SURFACE) {
        SZ.GameAudio.play('shoot', { pitch: 1.7 + i * 0.1, volume: 0.35 });
        particles.burst(target.x, target.y, 4, { color: '#7af0ff', speed: 1.8, life: 0.25 });
      }
    });

    // Repair drones weld the dome while it is damaged; several stack up to 4x the rate of one
    const healing = G.repairBots.length > 0 && G.domeHP < G.maxDomeHP && G.domeHP > 0;
    if (healing) {
      const rate = (0.5 + 0.45 * getEffectiveLevel('repairDroneLevel')) * droneBoost();
      G.domeHP = Math.min(G.maxDomeHP, G.domeHP + rate * Math.min(4, G.repairBots.length) * dt);
    }
    G.repairBots.forEach((r, i) => {
      r.angle += dt;
      if (healing) {
        const a = Math.PI + 0.35 + (Math.sin(r.angle * 0.4 + i * 2.3) * 0.5 + 0.5) * (Math.PI - 0.7);
        r.bx = DOME_X + Math.cos(a) * DOME_RADIUS;
        r.by = DOME_Y + Math.sin(a) * DOME_RADIUS;
        r.x += (r.bx + Math.cos(a) * 46 - r.x) * Math.min(1, dt * 3);
        r.y += (r.by + Math.sin(a) * 46 - 10 - r.y) * Math.min(1, dt * 3);
        r.beam = 1;
        if (G.currentView === VIEW_SURFACE && Math.random() < dt * 18)
          particles.trail(r.bx, r.by, { vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2.5, color: Math.random() < 0.5 ? '#fff6a0' : '#7affb0', life: 0.3, size: 1.5, gravity: 0.1 });
      } else {
        // Idle medics hover in a little block right of the dome
        r.beam = Math.max(0, r.beam - dt * 4);
        const hx = DOME_X + 70 + (i % 5) * 34, hy = DOME_Y - 160 - Math.floor(i / 5) * 34;
        r.x += (hx + Math.cos(r.angle * 0.8) * (i ? 8 : 30) - r.x) * Math.min(1, dt * 2);
        r.y += (hy + Math.sin(r.angle * 1.6) * (i ? 6 : 14) - r.y) * Math.min(1, dt * 2);
      }
    });
  }

  NS.drones = { MAX_DRONES_PER_KIND, droneCargoCap, syncDrones, keeperInMine, updateDrones };
})();
