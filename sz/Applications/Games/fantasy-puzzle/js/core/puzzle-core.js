;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Rules engine of the Fantasy Puzzle: tiles, casts and a breadth-first solver.
   * Pure logic -- no DOM, no canvas. A level is { grid: ['.wG', ...], hero: [row, col] }.
   * The mage walks freely over walkable tiles (walking costs nothing), so a state only
   * records the tiles, the hero's tile and the runes collected so far.
   */

  const T = Object.freeze({
    FLOOR: 0, WALL: 1, WOOD: 2, CHANNEL: 3, WATER: 4,
    BOULDER: 5, STONE: 6, CHASM: 7, ICE: 8, GOAL: 9, RUNE: 10
  });

  const CHARS = Object.freeze({
    '.': T.FLOOR, '#': T.WALL, 'w': T.WOOD, '~': T.CHANNEL, 'o': T.WATER,
    'B': T.BOULDER, 'S': T.STONE, '_': T.CHASM, 'i': T.ICE, 'G': T.GOAL, 'r': T.RUNE
  });

  const DIRS = Object.freeze({
    up: Object.freeze([-1, 0]),
    down: Object.freeze([1, 0]),
    left: Object.freeze([0, -1]),
    right: Object.freeze([0, 1])
  });
  const DIR_NAMES = Object.freeze(['up', 'down', 'left', 'right']);
  const ELEMENTS = Object.freeze(['fire', 'water', 'earth', 'air']);

  function isWalkable(tile) {
    return tile === T.FLOOR || tile === T.WATER || tile === T.GOAL || tile === T.RUNE;
  }

  function rowOf(state, idx) {
    return (idx / state.cols) | 0;
  }

  function colOf(state, idx) {
    return idx % state.cols;
  }

  // Walkable 4-neighbours of idx, as indices
  function walkableNeighbours(state, idx, out) {
    const rows = state.rows, cols = state.cols, tiles = state.tiles;
    const r = rowOf(state, idx), c = colOf(state, idx);
    if (r > 0 && isWalkable(tiles[idx - cols]))
      out.push(idx - cols);
    if (r + 1 < rows && isWalkable(tiles[idx + cols]))
      out.push(idx + cols);
    if (c > 0 && isWalkable(tiles[idx - 1]))
      out.push(idx - 1);
    if (c + 1 < cols && isWalkable(tiles[idx + 1]))
      out.push(idx + 1);
    return out;
  }

  // All tiles the mage can stand on: 4-neighbour closure over walkable tiles
  function reachSet(state) {
    const reach = new Set([state.hero]);
    const stack = [state.hero];
    const buf = [];
    while (stack.length) {
      const idx = stack.pop();
      buf.length = 0;
      walkableNeighbours(state, idx, buf);
      for (let i = 0; i < buf.length; ++i) {
        const n = buf[i];
        if (!reach.has(n)) {
          reach.add(n);
          stack.push(n);
        }
      }
    }
    return reach;
  }

  // Tiles a cast may target: in reach, or 4-adjacent to a tile in reach
  function castableSet(state, reach) {
    const rows = state.rows, cols = state.cols;
    const castable = new Set(reach);
    for (const idx of reach) {
      const r = rowOf(state, idx), c = colOf(state, idx);
      if (r > 0) castable.add(idx - cols);
      if (r + 1 < rows) castable.add(idx + cols);
      if (c > 0) castable.add(idx - 1);
      if (c + 1 < cols) castable.add(idx + 1);
    }
    return castable;
  }

  function castableTiles(state) {
    const castable = castableSet(state, reachSet(state));
    return Array.from(castable).sort((a, b) => a - b);
  }

  function goalIndex(state) {
    const tiles = state.tiles;
    for (let i = 0; i < tiles.length; ++i)
      if (tiles[i] === T.GOAL)
        return i;
    return -1;
  }

  function parseLevel(level) {
    if (!level || !Array.isArray(level.grid))
      throw new Error('level.grid must be an array of strings');
    const grid = level.grid;
    const rows = grid.length;
    if (rows === 0)
      throw new Error('level.grid must have at least one row');
    let cols = grid[0].length;
    if (cols === 0)
      throw new Error('level.grid rows must not be empty');
    for (let r = 0; r < rows; ++r) {
      if (typeof grid[r] !== 'string')
        throw new Error('level.grid row ' + r + ' is not a string');
      if (grid[r].length !== cols)
        throw new Error('level.grid row ' + r + ' has ' + grid[r].length + ' tiles, expected ' + cols);
    }
    const tiles = new Uint8Array(rows * cols);
    const runes = [];
    let goals = 0;
    for (let r = 0; r < rows; ++r) {
      for (let c = 0; c < cols; ++c) {
        const ch = grid[r][c];
        if (!Object.prototype.hasOwnProperty.call(CHARS, ch))
          throw new Error('unknown tile "' + ch + '" at row ' + r + ', column ' + c);
        const idx = r * cols + c;
        tiles[idx] = CHARS[ch];
        if (tiles[idx] === T.GOAL)
          ++goals;
        else if (tiles[idx] === T.RUNE)
          runes.push(idx);
      }
    }
    if (goals === 0)
      throw new Error('the level has no goal tile "G"');
    if (goals > 1)
      throw new Error('the level has ' + goals + ' goal tiles, expected exactly one');
    const hero = level.hero;
    if (!Array.isArray(hero) || hero.length !== 2)
      throw new Error('level.hero must be a [row, col] pair');
    const hr = hero[0], hc = hero[1];
    if (!Number.isInteger(hr) || !Number.isInteger(hc) || hr < 0 || hr >= rows || hc < 0 || hc >= cols)
      throw new Error('hero [' + hr + ', ' + hc + '] lies outside the ' + rows + ' x ' + cols + ' grid');
    const state = { rows, cols, tiles, hero: hr * cols + hc, runes: new Set() };
    if (!isWalkable(tiles[state.hero]))
      throw new Error('hero [' + hr + ', ' + hc + '] stands on a non-walkable tile');
    const reach = reachSet(state);
    for (const idx of runes)
      if (reach.has(idx))
        state.runes.add(idx);
    return state;
  }

  function cloneState(state) {
    return { rows: state.rows, cols: state.cols, tiles: state.tiles.slice(), hero: state.hero, runes: new Set(state.runes) };
  }

  // Two states that only differ in where the hero stands inside the same walkable
  // region are the same position: the canonical hero is the smallest reachable index.
  function stateKey(state) {
    const reach = reachSet(state);
    let canon = state.hero;
    for (const idx of reach)
      if (idx < canon)
        canon = idx;
    const runes = Array.from(state.runes).sort((a, b) => a - b);
    return state.tiles.join(',') + '|' + canon + '|' + runes.join(',');
  }

  // Turn every tile of the 4-connected cluster at idx that holds `from` into `to`
  function floodConvert(tiles, idx, cols, from, to) {
    const stack = [idx];
    tiles[idx] = to;
    while (stack.length) {
      const cur = stack.pop();
      const r = (cur / cols) | 0, c = cur % cols;
      const cand = [];
      if (r > 0) cand.push(cur - cols);
      if ((r + 1) * cols < tiles.length) cand.push(cur + cols);
      if (c > 0) cand.push(cur - 1);
      if (c + 1 < cols) cand.push(cur + 1);
      for (const n of cand)
        if (tiles[n] === from) {
          tiles[n] = to;
          stack.push(n);
        }
    }
  }

  /*
   * Air push: the boulder steps in dir while the next tile is FLOOR. A CHASM swallows
   * it -- the chasm is filled and the boulder is gone. Returns false when the boulder
   * would not move at all; with `apply` cleared the tiles are only walked through.
   */
  function pushBoulder(tiles, rows, cols, idx, dir, apply) {
    let cur = idx, moved = false;
    for (;;) {
      const r = (cur / cols) | 0, c = cur % cols;
      const nr = r + dir[0], nc = c + dir[1];
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols)
        break;
      const nxt = nr * cols + nc;
      if (tiles[nxt] === T.FLOOR) {
        if (apply) {
          tiles[cur] = T.FLOOR;
          tiles[nxt] = T.BOULDER;
        }
        cur = nxt;
        moved = true;
      } else if (tiles[nxt] === T.CHASM) {
        if (apply) {
          tiles[cur] = T.FLOOR;
          tiles[nxt] = T.FLOOR;
        }
        moved = true;
        break;
      } else
        break;
    }
    return moved;
  }

  // The tile the mage must occupy to push a boulder at idx in dir
  function standTile(state, idx, dir) {
    const r = rowOf(state, idx) - dir[0], c = colOf(state, idx) - dir[1];
    if (r < 0 || r >= state.rows || c < 0 || c >= state.cols)
      return -1;
    return r * state.cols + c;
  }

  function airDirsFor(state, reach, idx) {
    const out = [];
    for (const name of DIR_NAMES) {
      const stand = standTile(state, idx, DIRS[name]);
      if (stand >= 0 && reach.has(stand))
        out.push(name);
    }
    return out;
  }

  // Every cast that would change something, ordered by tile and element
  function validActions(state) {
    const reach = reachSet(state);
    const castable = Array.from(castableSet(state, reach)).sort((a, b) => a - b);
    const tiles = state.tiles;
    const actions = [];
    for (const idx of castable) {
      const tile = tiles[idx];
      if (tile === T.WOOD || tile === T.ICE)
        actions.push({ element: 'fire', index: idx });
      if (tile === T.CHANNEL)
        actions.push({ element: 'water', index: idx });
      if (tile === T.CHASM || (tile === T.FLOOR && idx !== state.hero))
        actions.push({ element: 'earth', index: idx });
      if (tile === T.BOULDER)
        for (const dir of airDirsFor(state, reach, idx))
          if (pushBoulder(tiles, state.rows, state.cols, idx, DIRS[dir], false))
            actions.push({ element: 'air', index: idx, dir });
    }
    return actions;
  }

  // The new state of a cast, or null when the cast is not allowed or changes nothing
  function applyAction(state, action) {
    if (!action || typeof action.element !== 'string')
      return null;
    const idx = action.index;
    if (!Number.isInteger(idx) || idx < 0 || idx >= state.tiles.length)
      return null;
    const reach = reachSet(state);
    if (!castableSet(state, reach).has(idx))
      return null;
    const next = cloneState(state);
    const tiles = next.tiles;
    switch (action.element) {
      case 'fire':
        if (tiles[idx] === T.WOOD)
          floodConvert(tiles, idx, state.cols, T.WOOD, T.FLOOR);
        else if (tiles[idx] === T.ICE)
          tiles[idx] = T.WATER;
        else
          return null;
        break;
      case 'water':
        if (tiles[idx] !== T.CHANNEL)
          return null;
        floodConvert(tiles, idx, state.cols, T.CHANNEL, T.WATER);
        break;
      case 'earth':
        if (tiles[idx] === T.CHASM)
          tiles[idx] = T.FLOOR;
        else if (tiles[idx] === T.FLOOR && idx !== state.hero)
          tiles[idx] = T.STONE;
        else
          return null;
        break;
      case 'air': {
        if (tiles[idx] !== T.BOULDER)
          return null;
        const dir = Object.prototype.hasOwnProperty.call(DIRS, action.dir) ? DIRS[action.dir] : null;
        if (!dir)
          return null;
        const stand = standTile(state, idx, dir);
        if (stand < 0 || !reach.has(stand))
          return null;
        if (!pushBoulder(tiles, state.rows, state.cols, idx, dir, true))
          return null;
        break;
      }
      default:
        return null;
    }
    const after = reachSet(next);
    for (let i = 0; i < tiles.length; ++i)
      if (tiles[i] === T.RUNE && after.has(i))
        next.runes.add(i);
    return next;
  }

  function isSolved(state) {
    const goal = goalIndex(state);
    return goal >= 0 && reachSet(state).has(goal);
  }

  function totalRunes(state) {
    const tiles = state.tiles;
    let n = 0;
    for (let i = 0; i < tiles.length; ++i)
      if (tiles[i] === T.RUNE)
        ++n;
    return n;
  }

  function collectedRunes(state) {
    return Array.from(state.runes).sort((a, b) => a - b);
  }

  function isPerfect(state) {
    return isSolved(state) && state.runes.size >= totalRunes(state);
  }

  function toState(source) {
    if (source && source.tiles && typeof source.rows === 'number' && typeof source.cols === 'number')
      return cloneState(source);
    return parseLevel(source);
  }

  /*
   * Breadth-first search over casts -- every cast costs one, so the first time the
   * goal (and, for a perfect run, every rune) is reached is the minimum. States are
   * deduplicated by stateKey; the queue is an array walked with a head index.
   */
  function searchFrom(start, maxStates, perfect) {
    const done = perfect ? isPerfect : isSolved;
    if (done(start))
      return { par: 0, actions: [] };
    if (!(maxStates > 0))
      return null;
    const visited = new Set([stateKey(start)]);
    const queue = [{ state: start, actions: [] }];
    let head = 0, expanded = 0;
    while (head < queue.length) {
      const node = queue[head++];
      if (++expanded > maxStates)
        return null;
      const actions = validActions(node.state);
      for (const action of actions) {
        const next = applyAction(node.state, action);
        if (!next)
          continue;
        const chain = node.actions.concat([action]);
        if (done(next))
          return { par: chain.length, actions: chain };
        const key = stateKey(next);
        if (visited.has(key))
          continue;
        visited.add(key);
        queue.push({ state: next, actions: chain });
      }
    }
    return null;
  }

  function solve(level, opts) {
    opts = opts || {};
    const maxStates = opts.maxStates === undefined ? 200000 : opts.maxStates;
    const perfect = opts.perfect === undefined ? true : !!opts.perfect;
    return searchFrom(toState(level), maxStates, perfect);
  }

  function hint(levelOrState, opts) {
    opts = opts || {};
    const maxStates = opts.maxStates === undefined ? 200000 : opts.maxStates;
    const perfect = opts.perfect === undefined ? true : !!opts.perfect;
    const found = searchFrom(toState(levelOrState), maxStates, perfect);
    return found && found.actions.length ? found.actions[0] : null;
  }

  SZ.PuzzleCore = Object.freeze({
    T, CHARS, DIRS, ELEMENTS,
    parseLevel, cloneState, stateKey, reachSet, castableTiles, validActions, applyAction,
    isSolved, isPerfect, totalRunes, collectedRunes, solve, hint
  });
})();
