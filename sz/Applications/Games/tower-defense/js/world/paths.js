/* world/paths.js -- road polylines, blocked cells, air routes and loading a map into a fresh battlefield.
   Owns state: G.paths, G.blockedCells
   Reads: constants, enemyTypes, maps, env, research, abilities, combat and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, COLS, ROWS, STATE_BUILD, makeRng } = NS.constants;
  const { ENEMY_TYPES } = NS.enemyTypes;
  const { MAPS } = NS.maps;
  const { updateWindowTitle } = NS.env;
  const { techLevel } = NS.research;
  const { abilityCd } = NS.abilities;

  let pathPoints = [];          // points of the first path (markers, previews)

  function walkPath(waypoints, visit) {
    for (let i = 0; i < waypoints.length - 1; ++i) {
      let [x0, y0] = waypoints[i];
      const [x1, y1] = waypoints[i + 1];
      const dx = Math.sign(x1 - x0);
      const dy = Math.sign(y1 - y0);
      while (x0 !== x1 || y0 !== y1) {
        visit(x0, y0);
        if (x0 !== x1) x0 += dx;
        if (y0 !== y1) y0 += dy;
      }
    }
    const last = waypoints[waypoints.length - 1];
    visit(last[0], last[1]);
  }

  function mapPaths(mapDef) {
    return mapDef.paths;
  }

  function buildPathCells(mapDef) {
    G.pathCells = new Set();
    for (const wp of mapPaths(mapDef))
      walkPath(wp, (x, y) => G.pathCells.add(`${x},${y}`));
    buildBlockedCells(mapDef);
  }

  function buildBlockedCells(mapDef) {
    G.blockedCells = blockedFor(mapDef, G.pathCells);
  }

  // Map features plus a sprinkling of trees and boulders well away from the road
  function blockedFor(mapDef, pathCells) {
    const blockedCells = new Map();
    for (const [type, c0, r0, c1, r1] of mapDef.features || [])
      for (let r = r0; r <= r1; ++r)
        for (let c = c0; c <= c1; ++c)
          if (c >= 0 && c < COLS && r >= 0 && r < ROWS && !pathCells.has(`${c},${r}`))
            blockedCells.set(`${c},${r}`, type);
    const rng = makeRng(MAPS.indexOf(mapDef) * 31337 + 7);
    const near = (c, r, d) => {
      for (let y = r - d; y <= r + d; ++y)
        for (let x = c - d; x <= c + d; ++x)
          if (pathCells.has(`${x},${y}`)) return true;
      return false;
    };
    let placed = 0;
    for (let i = 0; i < 400 && placed < 16; ++i) {
      const c = Math.floor(rng() * COLS), r = Math.floor(rng() * ROWS);
      const key = `${c},${r}`;
      if (blockedCells.has(key) || near(c, r, 2)) continue;
      blockedCells.set(key, rng() < 0.65 ? 'tree' : 'rock');
      ++placed;
    }
    return blockedCells;
  }

  function isEdge(p) {
    return p[0] === 0 || p[1] === 0 || p[0] === COLS - 1 || p[1] === ROWS - 1;
  }

  function makePath(points) {
    const cum = [0];
    for (let i = 1; i < points.length; ++i)
      cum.push(cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
    return { pts: points, cum, total: cum[cum.length - 1] };
  }

  function getPathPoints(waypoints) {
    const points = [];
    walkPath(waypoints, (x, y) => points.push({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 }));
    // Enemies enter from just outside the field and leave past an exit on the edge
    const extend = (a, b) => ({ x: a.x + (a.x - b.x) * 1.2, y: a.y + (a.y - b.y) * 1.2 });
    if (points.length > 1) {
      if (isEdge(waypoints[0]))
        points.unshift(extend(points[0], points[1]));
      if (isEdge(waypoints[waypoints.length - 1]))
        points.push(extend(points[points.length - 1], points[points.length - 2]));
    }
    return points;
  }

  function buildPaths(mapDef) {
    G.paths = mapPaths(mapDef).map(wp => makePath(getPathPoints(wp)));
    // Flyers cut straight from the spawn to the exit
    airPaths = G.paths.map(p => makePath([p.pts[0], p.pts[p.pts.length - 1]]));
    pathPoints = G.paths[0].pts;
  }
  let airPaths = [];

  function enemyPath(e) {
    return ENEMY_TYPES[e.type].flying ? airPaths[e.pi] : G.paths[e.pi];
  }
  // Position (and heading) at a distance along a path
  function pathPos(path, dist, out) {
    const cum = path.cum, pts = path.pts;
    if (dist <= 0) {
      out.x = pts[0].x; out.y = pts[0].y;
      out.angle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      return out;
    }
    let lo = 0, hi = cum.length - 1;
    if (dist >= path.total) {
      out.x = pts[hi].x; out.y = pts[hi].y;
      out.angle = Math.atan2(pts[hi].y - pts[hi - 1].y, pts[hi].x - pts[hi - 1].x);
      return out;
    }
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= dist) lo = mid;
      else hi = mid;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const t = (dist - cum[lo]) / seg;
    out.x = pts[lo].x + (pts[hi].x - pts[lo].x) * t;
    out.y = pts[lo].y + (pts[hi].y - pts[lo].y) * t;
    out.angle = Math.atan2(pts[hi].y - pts[lo].y, pts[hi].x - pts[lo].x);
    return out;
  }

  /* ══════════════════════════════════════════════════════════════════
     MAP LOADING
     ══════════════════════════════════════════════════════════════════ */

  function resetBattlefield() {
    G.towers = [];
    ++G.towerVersion;
    G.enemies = [];
    G.projectiles = [];
    G.clouds = [];
    G.fxLines = [];
    G.floorEffects = [];
    G.selectedTower = null;
    G.selectedTowerType = -1;
    G.waveEnemies = [];
    G.spawnTimer = 0;
    G.waveComplete = true;
    G.waveCountdown = 3;
    G.warningActive = false;
    G.warningTimer = 0;
    G.autoWaveTimer = 0;
    G.waveSize = 0;
    G.lastPaidWave = 0;
    G.bossIntro = null;
    abilityCd.strike = abilityCd.freeze = abilityCd.rush = 0;
    G.rushTimer = 0;
    G.strikes = [];
    G.abilityAim = null;
    G.previewCache.key = '';
  }


  // carry: gold brought along from the previous map
  function loadMap(index, carry) {
    G.currentMap = index;
    const mapDef = MAPS[G.currentMap];
    G.cleared = false;
    G.gold = mapDef.startGold + techLevel('chest') * 25 + (carry || 0);
    G.lives = G.runStartLives = NS.combat.startLives();
    G.totalWaves = mapDef.waves;
    G.currentWave = 0;
    G.gameSpeed = 1;
    resetBattlefield();
    buildPathCells(mapDef);
    buildPaths(mapDef);
    G.runStats = { kills: 0, gold: 0, leaked: 0, rp: 0 };
    G.shownGold = G.gold;
    G.state = STATE_BUILD;
    updateWindowTitle();
  }

  NS.paths = { walkPath, buildPathCells, blockedFor, isEdge, buildPaths, enemyPath, pathPos, loadMap };

})();
