;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  class MinHeap {
    #data;

    constructor() {
      this.#data = [];
    }

    get size() { return this.#data.length; }

    push(item, priority) {
      this.#data.push({ item, priority });
      this.#bubbleUp(this.#data.length - 1);
    }

    pop() {
      const top = this.#data[0];
      const last = this.#data.pop();
      if (this.#data.length > 0) {
        this.#data[0] = last;
        this.#sinkDown(0);
      }
      return top.item;
    }

    #bubbleUp(i) {
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (this.#data[i].priority >= this.#data[parent].priority)
          break;
        const tmp = this.#data[i];
        this.#data[i] = this.#data[parent];
        this.#data[parent] = tmp;
        i = parent;
      }
    }

    #sinkDown(i) {
      const n = this.#data.length;
      for (;;) {
        let smallest = i;
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        if (left < n && this.#data[left].priority < this.#data[smallest].priority)
          smallest = left;
        if (right < n && this.#data[right].priority < this.#data[smallest].priority)
          smallest = right;
        if (smallest === i)
          break;
        const tmp = this.#data[i];
        this.#data[i] = this.#data[smallest];
        this.#data[smallest] = tmp;
        i = smallest;
      }
    }
  }

  function isEnemy(grid, col, row, faction) {
    const uid = grid.unitAt(col, row);
    if (!uid)
      return false;
    const isPartyFaction = faction === 'party';
    const isPartyUnit = uid.startsWith('party_') || uid.startsWith('ally');
    return isPartyFaction ? !isPartyUnit : isPartyUnit;
  }

  function heuristic(a, b) {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }

  // Check if a tile is passable for a given creature's movement modes
  function isTilePassable(grid, col, row, creaturePassMode) {
    const moveCost = grid.moveCostAt(col, row);
    // If no passability system loaded or no creature passMode, use legacy check
    if (!creaturePassMode || !TR.Terrain || !TR.Terrain.passMode)
      return moveCost < 99;
    // Use bitmask: creature can enter if any movement mode overlaps tile's passMode
    const tileId = grid.terrainAt ? grid.terrainAt(col, row) : null;
    if (!tileId)
      return moveCost < 99;
    const tilePass = TR.Terrain.passMode(tileId);
    return (creaturePassMode & tilePass) !== 0;
  }

  function expandNeighbors(grid, key, gScore, cameFrom, open, goalOrStart, unitFaction, creaturePassMode) {
    const [cc, cr] = key.split(',').map(Number);
    const currentG = gScore.get(key);
    const neighbors = grid.neighbors(cc, cr);
    for (const nb of neighbors) {
      const nbKey = `${nb.col},${nb.row}`;
      if (isEnemy(grid, nb.col, nb.row, unitFaction))
        continue;
      if (!isTilePassable(grid, nb.col, nb.row, creaturePassMode))
        continue;
      const moveCost = grid.moveCostAt(nb.col, nb.row);
      // Flying creatures treat difficult terrain as cost 1
      const effectiveCost = (creaturePassMode && (creaturePassMode & 0b00010) && moveCost > 1) ? 1 : moveCost;
      const tentG = currentG + effectiveCost;
      const prevG = gScore.get(nbKey);
      if (prevG === undefined || tentG < prevG) {
        gScore.set(nbKey, tentG);
        cameFrom.set(nbKey, key);
        open.push(nbKey, tentG + heuristic(nb, goalOrStart));
      }
    }
  }

  function reconstructPath(cameFrom, key) {
    const path = [];
    let k = key;
    while (k) {
      const [c, r] = k.split(',').map(Number);
      path.push({ col: c, row: r });
      k = cameFrom.get(k);
    }
    path.reverse();
    return path;
  }

  // --- Formation offset tables ---
  // Offsets are relative to leader; indexed by (direction, slotIndex).
  // Direction determines orientation: "east" = party faces east (trailing west).
  const FORMATION_OFFSETS = Object.freeze({
    LINE: {
      east:  (i) => ({ dc: 0, dr: i === 0 ? 0 : (i % 2 === 1 ? -Math.ceil(i / 2) : Math.ceil(i / 2)) }),
      west:  (i) => ({ dc: 0, dr: i === 0 ? 0 : (i % 2 === 1 ? -Math.ceil(i / 2) : Math.ceil(i / 2)) }),
      north: (i) => ({ dc: i === 0 ? 0 : (i % 2 === 1 ? -Math.ceil(i / 2) : Math.ceil(i / 2)), dr: 0 }),
      south: (i) => ({ dc: i === 0 ? 0 : (i % 2 === 1 ? -Math.ceil(i / 2) : Math.ceil(i / 2)), dr: 0 }),
    },
    WEDGE: {
      east:  (i) => ({ dc: i === 0 ? 0 : -i, dr: i === 0 ? 0 : (i % 2 === 1 ? -Math.ceil(i / 2) : Math.ceil(i / 2)) }),
      west:  (i) => ({ dc: i === 0 ? 0 : i,  dr: i === 0 ? 0 : (i % 2 === 1 ? -Math.ceil(i / 2) : Math.ceil(i / 2)) }),
      north: (i) => ({ dc: i === 0 ? 0 : (i % 2 === 1 ? -Math.ceil(i / 2) : Math.ceil(i / 2)), dr: i === 0 ? 0 : i }),
      south: (i) => ({ dc: i === 0 ? 0 : (i % 2 === 1 ? -Math.ceil(i / 2) : Math.ceil(i / 2)), dr: i === 0 ? 0 : -i }),
    },
    SQUARE: {
      east:  (i) => {
        const r = i >> 1, c = i & 1;
        return { dc: -c, dr: r === 0 ? 0 : (r % 2 === 1 ? -Math.ceil(r / 2) : Math.ceil(r / 2)) };
      },
      west:  (i) => {
        const r = i >> 1, c = i & 1;
        return { dc: c, dr: r === 0 ? 0 : (r % 2 === 1 ? -Math.ceil(r / 2) : Math.ceil(r / 2)) };
      },
      north: (i) => {
        const r = i >> 1, c = i & 1;
        return { dc: r === 0 ? 0 : (r % 2 === 1 ? -Math.ceil(r / 2) : Math.ceil(r / 2)), dr: c };
      },
      south: (i) => {
        const r = i >> 1, c = i & 1;
        return { dc: r === 0 ? 0 : (r % 2 === 1 ? -Math.ceil(r / 2) : Math.ceil(r / 2)), dr: -c };
      },
    },
    COLUMN: {
      east:  (i) => ({ dc: -i, dr: 0 }),
      west:  (i) => ({ dc: i,  dr: 0 }),
      north: (i) => ({ dc: 0,  dr: i }),
      south: (i) => ({ dc: 0,  dr: -i }),
    },
  });

  const Pathfinding = {

    // --- Standard unidirectional A* ---
    // creaturePassMode: optional bitmask of movement modes (WALK|FLY|SWIM|BURROW|ETHEREAL)
    findPath(grid, start, goal, unitFaction, creaturePassMode) {
      if (start.col === goal.col && start.row === goal.row)
        return [{ col: start.col, row: start.row }];

      const open = new MinHeap();
      const gScore = new Map();
      const cameFrom = new Map();
      const startKey = `${start.col},${start.row}`;
      const goalKey = `${goal.col},${goal.row}`;

      gScore.set(startKey, 0);
      open.push(startKey, heuristic(start, goal));

      while (open.size > 0) {
        const currentKey = open.pop();
        if (currentKey === goalKey)
          return reconstructPath(cameFrom, goalKey);

        expandNeighbors(grid, currentKey, gScore, cameFrom, open, goal, unitFaction, creaturePassMode);
      }

      return null;
    },

    // --- Bidirectional weighted A* ---
    findPathBiDir(grid, start, goal, unitFaction, creaturePassMode) {
      if (start.col === goal.col && start.row === goal.row)
        return [{ col: start.col, row: start.row }];

      const startKey = `${start.col},${start.row}`;
      const goalKey = `${goal.col},${goal.row}`;

      const fwdOpen = new MinHeap();
      const bwdOpen = new MinHeap();
      const fwdG = new Map();
      const bwdG = new Map();
      const fwdFrom = new Map();
      const bwdFrom = new Map();
      const fwdClosed = new Set();
      const bwdClosed = new Set();

      fwdG.set(startKey, 0);
      bwdG.set(goalKey, 0);
      fwdOpen.push(startKey, heuristic(start, goal));
      bwdOpen.push(goalKey, heuristic(goal, start));

      let bestCost = Infinity;
      let meetKey = null;

      while (fwdOpen.size > 0 && bwdOpen.size > 0) {
        // Expand forward
        if (fwdOpen.size > 0) {
          const fKey = fwdOpen.pop();
          fwdClosed.add(fKey);

          if (bwdClosed.has(fKey)) {
            const total = fwdG.get(fKey) + bwdG.get(fKey);
            if (total < bestCost) {
              bestCost = total;
              meetKey = fKey;
            }
          }

          const [fc, fr] = fKey.split(',').map(Number);
          const fg = fwdG.get(fKey);
          const neighbors = grid.neighbors(fc, fr);
          for (const nb of neighbors) {
            const nbKey = `${nb.col},${nb.row}`;
            if (fwdClosed.has(nbKey))
              continue;
            if (isEnemy(grid, nb.col, nb.row, unitFaction))
              continue;
            if (!isTilePassable(grid, nb.col, nb.row, creaturePassMode))
              continue;
            const moveCost = grid.moveCostAt(nb.col, nb.row);
            const effectiveCost = (creaturePassMode && (creaturePassMode & 0b00010) && moveCost > 1) ? 1 : moveCost;
            const tentG = fg + effectiveCost;
            const prevG = fwdG.get(nbKey);
            if (prevG === undefined || tentG < prevG) {
              fwdG.set(nbKey, tentG);
              fwdFrom.set(nbKey, fKey);
              fwdOpen.push(nbKey, tentG + heuristic(nb, goal));
              if (bwdG.has(nbKey)) {
                const total = tentG + bwdG.get(nbKey);
                if (total < bestCost) {
                  bestCost = total;
                  meetKey = nbKey;
                }
              }
            }
          }
        }

        // Early termination: if both fronts' minimum f exceeds best found
        if (meetKey !== null) {
          // Check if further expansion can improve
          let canImprove = false;
          if (fwdOpen.size > 0 || bwdOpen.size > 0)
            canImprove = true;
          // Simple termination: if both fronts have been expanded past meeting cost
          if (fwdClosed.size + bwdClosed.size > bestCost * 4)
            break;
        }

        // Expand backward
        if (bwdOpen.size > 0) {
          const bKey = bwdOpen.pop();
          bwdClosed.add(bKey);

          if (fwdClosed.has(bKey)) {
            const total = fwdG.get(bKey) + bwdG.get(bKey);
            if (total < bestCost) {
              bestCost = total;
              meetKey = bKey;
            }
          }

          const [bc, br] = bKey.split(',').map(Number);
          const bg = bwdG.get(bKey);
          const neighbors = grid.neighbors(bc, br);
          for (const nb of neighbors) {
            const nbKey = `${nb.col},${nb.row}`;
            if (bwdClosed.has(nbKey))
              continue;
            if (isEnemy(grid, nb.col, nb.row, unitFaction))
              continue;
            if (!isTilePassable(grid, nb.col, nb.row, creaturePassMode))
              continue;
            const moveCost = grid.moveCostAt(nb.col, nb.row);
            const effectiveCost = (creaturePassMode && (creaturePassMode & 0b00010) && moveCost > 1) ? 1 : moveCost;
            const tentG = bg + effectiveCost;
            const prevG = bwdG.get(nbKey);
            if (prevG === undefined || tentG < prevG) {
              bwdG.set(nbKey, tentG);
              bwdFrom.set(nbKey, bKey);
              bwdOpen.push(nbKey, tentG + heuristic(nb, start));
              if (fwdG.has(nbKey)) {
                const total = tentG + fwdG.get(nbKey);
                if (total < bestCost) {
                  bestCost = total;
                  meetKey = nbKey;
                }
              }
            }
          }
        }
      }

      if (!meetKey)
        return null;

      // Reconstruct: forward path to meetKey + backward path from meetKey
      const fwdPath = reconstructPath(fwdFrom, meetKey);
      let bKey = bwdFrom.get(meetKey);
      while (bKey) {
        const [c, r] = bKey.split(',').map(Number);
        fwdPath.push({ col: c, row: r });
        bKey = bwdFrom.get(bKey);
      }
      return fwdPath;
    },

    // --- Dijkstra flood fill for movement range ---
    movementRange(grid, start, budget, faction, creaturePassMode) {
      const result = new Map();
      const startKey = `${start.col},${start.row}`;
      result.set(startKey, 0);

      if (budget <= 0)
        return result;

      const open = new MinHeap();
      open.push(startKey, 0);

      while (open.size > 0) {
        const currentKey = open.pop();
        const [cc, cr] = currentKey.split(',').map(Number);
        const currentCost = result.get(currentKey);

        const neighbors = grid.neighbors(cc, cr);
        for (const nb of neighbors) {
          const nbKey = `${nb.col},${nb.row}`;

          if (!isTilePassable(grid, nb.col, nb.row, creaturePassMode))
            continue;

          if (isEnemy(grid, nb.col, nb.row, faction))
            continue;

          const moveCost = grid.moveCostAt(nb.col, nb.row);
          const effectiveCost = (creaturePassMode && (creaturePassMode & 0b00010) && moveCost > 1) ? 1 : moveCost;
          const newCost = currentCost + effectiveCost;
          if (newCost > budget)
            continue;

          const prevCost = result.get(nbKey);
          if (prevCost === undefined || newCost < prevCost) {
            result.set(nbKey, newCost);
            open.push(nbKey, newCost);
          }
        }
      }

      return result;
    },

    // --- Path cost calculation ---
    pathCost(grid, path) {
      if (path.length <= 1)
        return 0;
      let cost = 0;
      for (let i = 1; i < path.length; ++i)
        cost += grid.moveCostAt(path[i].col, path[i].row);
      return cost;
    },

    // --- Multi-unit cooperative pathfinding ---
    findPathsMulti(grid, requests, faction) {
      const result = new Map();
      if (!requests || requests.length === 0)
        return result;

      // Sort by Manhattan distance to goal (shortest first = higher priority)
      const sorted = requests.slice().sort((a, b) => {
        const da = Math.abs(a.start.col - a.goal.col) + Math.abs(a.start.row - a.goal.row);
        const db = Math.abs(b.start.col - b.goal.col) + Math.abs(b.start.row - b.goal.row);
        return da - db;
      });

      // Tiles reserved by earlier units' final positions
      const reserved = new Set();

      for (const req of sorted) {
        const goalKey = `${req.goal.col},${req.goal.row}`;

        // If goal is already reserved, find nearest free tile to goal
        let actualGoal = req.goal;
        if (reserved.has(goalKey)) {
          const alt = findNearestFree(grid, req.goal, reserved, faction);
          if (!alt) {
            result.set(req.unitId, null);
            continue;
          }
          actualGoal = alt;
        }

        const path = Pathfinding.findPath(grid, req.start, actualGoal, faction);
        result.set(req.unitId, path);

        if (path) {
          const end = path[path.length - 1];
          reserved.add(`${end.col},${end.row}`);
        }
      }

      return result;
    },

    // --- Formation slot computation ---
    Formations: Object.freeze({
      LINE: 'LINE',
      WEDGE: 'WEDGE',
      SQUARE: 'SQUARE',
      COLUMN: 'COLUMN',
    }),

    formationSlots(type, leaderPos, direction, unitCount) {
      const dir = direction || 'east';
      const offsets = FORMATION_OFFSETS[type];
      if (!offsets)
        return [{ col: leaderPos.col, row: leaderPos.row }];

      const fn = offsets[dir] || offsets.east;
      const slots = [];
      for (let i = 0; i < unitCount; ++i) {
        const off = fn(i);
        slots.push({ col: leaderPos.col + off.dc, row: leaderPos.row + off.dr });
      }
      return slots;
    },

    // --- Formation movement: compute multi-unit paths to formation slots ---
    moveFormation(grid, units, leaderGoal, direction, formationType, faction) {
      const slots = Pathfinding.formationSlots(formationType, leaderGoal, direction, units.length);
      const reserved = new Set();
      const requests = [];

      for (let i = 0; i < units.length; ++i) {
        let goal = slots[i];
        const gKey = `${goal.col},${goal.row}`;

        // If slot is impassable or reserved, find nearest free alternative
        if (reserved.has(gKey) || !grid.inBounds(goal.col, goal.row) || grid.moveCostAt(goal.col, goal.row) >= 99) {
          const alt = findNearestFree(grid, goal, reserved, faction);
          if (alt)
            goal = alt;
        }

        reserved.add(`${goal.col},${goal.row}`);
        requests.push({ unitId: units[i].unitId, start: units[i].start, goal });
      }

      return Pathfinding.findPathsMulti(grid, requests, faction);
    },

    // --- Path cache class with partial reuse / stitching ---
    PathCache: class PathCache {
      #cache;
      #order;
      #maxSize;
      #hits;
      #misses;
      #stitchHits;
      #waypointIndex; // Map<tileKey, Array<{cacheKey, pathIndex}>>
      static BRIDGE_LIMIT = 8;

      constructor(maxSize) {
        this.#cache = new Map();
        this.#order = [];
        this.#maxSize = maxSize || 128;
        this.#hits = 0;
        this.#misses = 0;
        this.#stitchHits = 0;
        this.#waypointIndex = new Map();
      }

      #makeKey(start, goal, faction) {
        return `${start.col},${start.row}|${goal.col},${goal.row}|${faction}`;
      }

      #addWaypoints(cacheKey, path) {
        if (!path)
          return;
        for (let i = 0; i < path.length; ++i) {
          const tk = `${path[i].col},${path[i].row}`;
          let entries = this.#waypointIndex.get(tk);
          if (!entries) {
            entries = [];
            this.#waypointIndex.set(tk, entries);
          }
          entries.push({ cacheKey, pathIndex: i });
        }
      }

      #removeWaypoints(cacheKey) {
        for (const [tk, entries] of this.#waypointIndex) {
          const filtered = entries.filter(e => e.cacheKey !== cacheKey);
          if (filtered.length === 0)
            this.#waypointIndex.delete(tk);
          else
            this.#waypointIndex.set(tk, filtered);
        }
      }

      #store(key, path) {
        this.#cache.set(key, path);
        this.#order.push(key);
        this.#addWaypoints(key, path);
        while (this.#order.length > this.#maxSize) {
          const evict = this.#order.shift();
          this.#removeWaypoints(evict);
          this.#cache.delete(evict);
        }
      }

      #touchLRU(key) {
        const idx = this.#order.indexOf(key);
        if (idx >= 0) {
          this.#order.splice(idx, 1);
          this.#order.push(key);
        }
      }

      findPath(grid, start, goal, faction) {
        // 1. Exact cache hit
        const key = this.#makeKey(start, goal, faction);
        if (this.#cache.has(key)) {
          ++this.#hits;
          this.#touchLRU(key);
          return this.#cache.get(key);
        }

        // 2. Try partial reuse via waypoint stitching
        const stitched = this.#tryStitch(grid, start, goal, faction);
        if (stitched !== undefined) {
          ++this.#stitchHits;
          this.#store(key, stitched);
          return stitched;
        }

        // 3. Full computation
        ++this.#misses;
        const path = Pathfinding.findPath(grid, start, goal, faction);
        this.#store(key, path);
        return path;
      }

      #tryStitch(grid, start, goal, faction) {
        const startTK = `${start.col},${start.row}`;
        const goalTK = `${goal.col},${goal.row}`;
        const limit = PathCache.BRIDGE_LIMIT;

        // Collect waypoint entries filtered to matching faction
        const startEntries = this.#entriesForFaction(startTK, faction);
        const goalEntries = this.#entriesForFaction(goalTK, faction);

        // Case 1: Both start and goal on the same cached path → subpath extraction
        if (startEntries && goalEntries) {
          for (const se of startEntries) {
            for (const ge of goalEntries) {
              if (se.cacheKey === ge.cacheKey && se.pathIndex <= ge.pathIndex) {
                const cached = this.#cache.get(se.cacheKey);
                if (cached)
                  return cached.slice(se.pathIndex, ge.pathIndex + 1);
              }
            }
          }
        }

        // Case 2: Start on cached path → suffix; bridge from suffix end to goal
        if (startEntries) {
          for (const se of startEntries) {
            const cached = this.#cache.get(se.cacheKey);
            if (!cached)
              continue;
            // Check if goal is also reachable by extending the suffix
            const suffixEnd = cached[cached.length - 1];
            const dist = Math.abs(suffixEnd.col - goal.col) + Math.abs(suffixEnd.row - goal.row);
            if (dist <= limit && dist > 0) {
              const bridge = Pathfinding.findPath(grid, suffixEnd, goal, faction);
              if (bridge && bridge.length > 1) {
                const suffix = cached.slice(se.pathIndex);
                return suffix.concat(bridge.slice(1));
              }
            }
            // Also check if goal is closer to a point earlier in the cached path
          }
        }

        // Case 3: Goal on cached path → prefix; bridge from start to prefix start
        if (goalEntries) {
          for (const ge of goalEntries) {
            const cached = this.#cache.get(ge.cacheKey);
            if (!cached)
              continue;
            const prefixStart = cached[0];
            const dist = Math.abs(start.col - prefixStart.col) + Math.abs(start.row - prefixStart.row);
            if (dist <= limit && dist > 0) {
              const bridge = Pathfinding.findPath(grid, start, prefixStart, faction);
              if (bridge && bridge.length > 1) {
                const prefix = cached.slice(0, ge.pathIndex + 1);
                return bridge.concat(prefix.slice(1));
              }
            }
          }
        }

        // Case 4: Two-segment stitch — start on path1, goal on path2, bridge between
        if (startEntries) {
          for (const se of startEntries) {
            const cached1 = this.#cache.get(se.cacheKey);
            if (!cached1)
              continue;
            const tail1 = cached1[cached1.length - 1];
            // Find a cached path whose start or any waypoint is near tail1 and contains goal
            const nearEntries = this.#findNearWaypoint(tail1, faction, limit);
            for (const ne of nearEntries) {
              if (ne.cacheKey === se.cacheKey)
                continue;
              const cached2 = this.#cache.get(ne.cacheKey);
              if (!cached2)
                continue;
              // Check if goal is on cached2
              const goalIdx = this.#findTileIndex(cached2, goal);
              if (goalIdx < 0)
                continue;
              const bridgeStart = tail1;
              const bridgeEnd = cached2[ne.pathIndex];
              const bDist = Math.abs(bridgeStart.col - bridgeEnd.col) + Math.abs(bridgeStart.row - bridgeEnd.row);
              if (bDist > limit)
                continue;
              let bridge;
              if (bDist === 0)
                bridge = [bridgeStart];
              else
                bridge = Pathfinding.findPath(grid, bridgeStart, bridgeEnd, faction);
              if (!bridge)
                continue;
              const seg1 = cached1.slice(se.pathIndex);
              const seg2 = cached2.slice(ne.pathIndex, goalIdx + 1);
              const result = seg1.concat(bridge.slice(1));
              if (seg2.length > 1)
                return result.concat(seg2.slice(1));
              return result;
            }
          }
        }

        return undefined;
      }

      #entriesForFaction(tileKey, faction) {
        const entries = this.#waypointIndex.get(tileKey);
        if (!entries)
          return null;
        // Cache keys end with |faction
        const suffix = `|${faction}`;
        const filtered = entries.filter(e => e.cacheKey.endsWith(suffix));
        return filtered.length > 0 ? filtered : null;
      }

      #findNearWaypoint(pos, faction, radius) {
        const results = [];
        for (let dc = -radius; dc <= radius; ++dc) {
          for (let dr = -radius; dr <= radius; ++dr) {
            if (Math.abs(dc) + Math.abs(dr) > radius)
              continue;
            const tk = `${pos.col + dc},${pos.row + dr}`;
            const entries = this.#entriesForFaction(tk, faction);
            if (entries)
              for (const e of entries)
                results.push(e);
          }
        }
        return results;
      }

      #findTileIndex(path, pos) {
        for (let i = 0; i < path.length; ++i)
          if (path[i].col === pos.col && path[i].row === pos.row)
            return i;
        return -1;
      }

      invalidate() {
        this.#cache.clear();
        this.#order.length = 0;
        this.#waypointIndex.clear();
      }

      stats() {
        return { hits: this.#hits, misses: this.#misses, stitchHits: this.#stitchHits, size: this.#cache.size };
      }
    },
  };

  // Helper: find nearest passable free tile to a target
  function findNearestFree(grid, target, reserved, faction, creaturePassMode) {
    const visited = new Set();
    const queue = [{ col: target.col, row: target.row }];
    visited.add(`${target.col},${target.row}`);

    while (queue.length > 0) {
      const cur = queue.shift();
      const key = `${cur.col},${cur.row}`;
      if (!reserved.has(key) && grid.inBounds(cur.col, cur.row) && isTilePassable(grid, cur.col, cur.row, creaturePassMode) && !isEnemy(grid, cur.col, cur.row, faction))
        return cur;

      const neighbors = grid.neighbors(cur.col, cur.row);
      for (const nb of neighbors) {
        const nbKey = `${nb.col},${nb.row}`;
        if (!visited.has(nbKey)) {
          visited.add(nbKey);
          queue.push(nb);
        }
      }
    }
    return null;
  }

  TR.Pathfinding = Pathfinding;
})();
