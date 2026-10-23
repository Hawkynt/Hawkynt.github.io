;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // An explorable dungeon: several floors of rooms or caves, fog of war with
  // line of sight, treasure, traps, fountains and shrines, and monster groups
  // waiting in their chambers. When a group spots the party, the battle board
  // is cut out of the dungeon around everyone involved, walls included.
  //
  // Pure model: no drawing, deterministic for a given seed.

  const Cell = Object.freeze({ WALL: 0, FLOOR: 1, STAIRS_UP: 2, STAIRS_DOWN: 3 });
  const Feature = Object.freeze({ TREASURE: 'treasure', TRAP: 'trap', FOUNTAIN: 'fountain', SHRINE: 'shrine', HOARD: 'hoard' });

  const SIGHT_RADIUS = 7;      // how far the party's torches reach
  const GROUP_SIGHT = 5;       // how far monsters notice the party
  const BOARD_PAD = 4;
  const BOARD_MIN = [16, 12];
  const BOARD_MAX = [34, 24];
  const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  const key = (c, r) => `${c},${r}`;

  // --- level generation ---------------------------------------------------------

  class Level {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.cells = new Uint8Array(w * h);
      this.chambers = [];
      this.entrance = null;
      this.exit = null;
    }

    inBounds(c, r) { return c >= 0 && r >= 0 && c < this.w && r < this.h; }
    get(c, r) { return this.inBounds(c, r) ? this.cells[r * this.w + c] : Cell.WALL; }
    set(c, r, v) { if (this.inBounds(c, r)) this.cells[r * this.w + c] = v; }
    open(c, r) { return this.get(c, r) !== Cell.WALL; }

    // Flood fill over open cells; returns visited keys as numbers.
    region(c0, r0) {
      const seen = new Uint8Array(this.w * this.h);
      const out = [];
      const stack = [r0 * this.w + c0];
      seen[stack[0]] = 1;
      while (stack.length) {
        const i = stack.pop();
        out.push(i);
        const c = i % this.w, r = (i - c) / this.w;
        for (const [dc, dr] of DIRS4) {
          const nc = c + dc, nr = r + dr;
          if (!this.inBounds(nc, nr))
            continue;
          const j = nr * this.w + nc;
          if (!seen[j] && this.cells[j] !== Cell.WALL) {
            seen[j] = 1;
            stack.push(j);
          }
        }
      }
      return out;
    }

    // Path length from (c0, r0) to every open cell (-1 = unreachable).
    distances(c0, r0) {
      const d = new Int32Array(this.w * this.h).fill(-1);
      const q = [r0 * this.w + c0];
      d[q[0]] = 0;
      for (let h = 0; h < q.length; ++h) {
        const i = q[h];
        const c = i % this.w, r = (i - c) / this.w;
        for (const [dc, dr] of DIRS4) {
          const nc = c + dc, nr = r + dr;
          if (!this.inBounds(nc, nr))
            continue;
          const j = nr * this.w + nc;
          if (d[j] < 0 && this.cells[j] !== Cell.WALL) {
            d[j] = d[i] + 1;
            q.push(j);
          }
        }
      }
      return d;
    }
  }

  function builtLevel(w, h, prng, { rooms, broken = false, maze = false }) {
    const floor = new TR.DungeonFloor(w, h);
    floor.generate(rooms, prng);
    const L = new Level(w, h);
    for (let r = 0; r < h; ++r)
      for (let c = 0; c < w; ++c)
        if (floor.getTile(c, r) !== 'wall')
          L.set(c, r, Cell.FLOOR);
    // a labyrinth gets extra looping corridors between random rooms
    if (maze)
      for (let i = 0; i < floor.rooms.length; ++i) {
        const a = floor.rooms[i], b = floor.rooms[prng.nextInt(0, floor.rooms.length - 1)];
        carve(L, a.x + (a.w >> 1), a.y + (a.h >> 1), b.x + (b.w >> 1), b.y + (b.h >> 1), prng);
      }
    // ruins: crumbled walls open up next to floors
    if (broken)
      for (let r = 1; r < h - 1; ++r)
        for (let c = 1; c < w - 1; ++c)
          if (!L.open(c, r) && (L.open(c - 1, r) && L.open(c + 1, r) || L.open(c, r - 1) && L.open(c, r + 1)) && prng.next() < 0.35)
            L.set(c, r, Cell.FLOOR);
    L.chambers = floor.rooms.map((rm, id) => ({ id, x: rm.x, y: rm.y, w: rm.w, h: rm.h, cx: rm.x + (rm.w >> 1), cy: rm.y + (rm.h >> 1) }));
    return L;
  }

  function carve(L, c0, r0, c1, r1, prng) {
    let c = c0, r = r0;
    const horizFirst = prng.next() < 0.5;
    const step = () => {
      if (L.inBounds(c, r) && c > 0 && r > 0 && c < L.w - 1 && r < L.h - 1)
        L.set(c, r, Cell.FLOOR);
    };
    if (horizFirst) {
      while (c !== c1) { step(); c += c1 > c ? 1 : -1; }
      while (r !== r1) { step(); r += r1 > r ? 1 : -1; }
    } else {
      while (r !== r1) { step(); r += r1 > r ? 1 : -1; }
      while (c !== c1) { step(); c += c1 > c ? 1 : -1; }
    }
    step();
  }

  // Cellular-automata caves: noise smoothed into caverns, only the biggest
  // connected cave kept. Wilds use less rock, so they read as open ground.
  function cavernLevel(w, h, prng, { fill = 0.45 } = {}) {
    for (let attempt = 0; attempt < 8; ++attempt) {
      const L = new Level(w, h);
      for (let r = 1; r < h - 1; ++r)
        for (let c = 1; c < w - 1; ++c)
          L.set(c, r, prng.next() < fill ? Cell.WALL : Cell.FLOOR);
      for (let it = 0; it < 5; ++it) {
        const next = new Uint8Array(L.cells);
        for (let r = 1; r < h - 1; ++r)
          for (let c = 1; c < w - 1; ++c) {
            let n1 = 0, n2 = 0;
            for (let dr = -2; dr <= 2; ++dr)
              for (let dc = -2; dc <= 2; ++dc) {
                const wall = !L.open(c + dc, r + dr);
                if (Math.abs(dc) <= 1 && Math.abs(dr) <= 1)
                  n1 += wall;
                n2 += wall;
              }
            const wall = n1 >= 5 || (it < 3 && n2 <= 2);
            next[r * w + c] = wall ? Cell.WALL : Cell.FLOOR;
          }
        L.cells = next;
      }
      // keep the largest cave
      const seen = new Uint8Array(w * h);
      let best = [];
      for (let i = 0; i < w * h; ++i)
        if (!seen[i] && L.cells[i] !== Cell.WALL) {
          const reg = L.region(i % w, Math.floor(i / w));
          for (const j of reg)
            seen[j] = 1;
          if (reg.length > best.length)
            best = reg;
        }
      if (best.length < w * h * 0.32)
        continue;
      const keep = new Uint8Array(w * h);
      for (const j of best)
        keep[j] = 1;
      for (let i = 0; i < w * h; ++i)
        if (!keep[i])
          L.cells[i] = Cell.WALL;
      L.chambers = findChambers(L);
      return L;
    }
    // fall back to rooms if the automaton keeps producing scraps
    return builtLevel(w, h, prng, { rooms: 8 });
  }

  // Chambers are the roomiest spots: local maxima of the distance to the
  // nearest wall, kept apart from each other.
  function findChambers(L) {
    const { w, h } = L;
    const dist = new Int32Array(w * h).fill(-1);
    const q = [];
    for (let i = 0; i < w * h; ++i)
      if (L.cells[i] === Cell.WALL) {
        dist[i] = 0;
        q.push(i);
      }
    for (let head = 0; head < q.length; ++head) {
      const i = q[head];
      const c = i % w, r = (i - c) / w;
      for (const [dc, dr] of DIRS4) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= w || nr >= h)
          continue;
        const j = nr * w + nc;
        if (dist[j] < 0) {
          dist[j] = dist[i] + 1;
          q.push(j);
        }
      }
    }
    const order = [...Array(w * h).keys()].filter(i => dist[i] >= 2).sort((a, b) => dist[b] - dist[a] || a - b);
    const chambers = [];
    for (const i of order) {
      const c = i % w, r = (i - c) / w;
      const rad = dist[i] + 1;
      if (chambers.some(ch => Math.abs(ch.cx - c) + Math.abs(ch.cy - r) < Math.max(9, (ch.rad + rad) * 1.6)))
        continue;
      chambers.push({ id: chambers.length, cx: c, cy: r, rad, x: c - rad, y: r - rad, w: rad * 2 + 1, h: rad * 2 + 1 });
      if (chambers.length >= 14)
        break;
    }
    return chambers;
  }

  // Entrance in the chamber nearest the west edge, exit in the chamber
  // farthest away by path, stairs placed on their centres.
  function placeStairs(L, isLast) {
    if (!L.chambers.length) {
      // no roomy spot found: treat the first open cell as a one-tile chamber
      const i = L.cells.findIndex(v => v !== Cell.WALL);
      const c = i % L.w, r = (i - c) / L.w;
      L.chambers = [{ id: 0, cx: c, cy: r, x: c, y: r, w: 1, h: 1, rad: 0 }];
    }
    const first = L.chambers.reduce((a, b) => (b.cx < a.cx ? b : a));
    const d = L.distances(first.cx, first.cy);
    let far = first;
    for (const ch of L.chambers)
      if (d[ch.cy * L.w + ch.cx] > d[far.cy * L.w + far.cx])
        far = ch;
    L.entrance = { col: first.cx, row: first.cy, chamber: first.id };
    L.exit = { col: far.cx, row: far.cy, chamber: far.id };
    L.set(first.cx, first.cy, Cell.STAIRS_UP);
    if (!isLast)
      L.set(far.cx, far.cy, Cell.STAIRS_DOWN);
  }

  // --- the crawl ------------------------------------------------------------------

  class DungeonCrawl {
    #seed;
    #theme;
    #name;
    #difficulty;
    #floorCount;
    #floor;
    #levels;
    #explored;
    #visible;
    #pos;
    #groups;
    #features;
    #props;
    #used;
    #defeated;
    #locationEnemies;

    constructor({ seed = 1, theme = null, name = 'Dungeon', difficulty = 1, enemies = [] } = {}) {
      this.#seed = seed >>> 0;
      this.#theme = theme || (TR.DungeonThemes && TR.DungeonThemes.THEMES.cavern);
      this.#name = name;
      this.#difficulty = Math.max(1, difficulty | 0);
      this.#locationEnemies = enemies.slice();
      const [fmin, fmax] = this.#theme.floors;
      const rng = this.#rng('floors');
      this.#floorCount = Math.max(1, Math.min(fmax, fmin + Math.floor(this.#difficulty / 3) + rng.nextInt(0, 1)));
      this.#levels = [];
      this.#explored = [];
      this.#groups = [];
      this.#features = [];
      this.#props = [];
      this.#used = new Set();
      this.#defeated = new Set();
      this.#visible = new Set();
      this.#floor = -1;
      this.enterFloor(0, 'up');
    }

    #rng(label) {
      return new TR.PRNG((this.#seed ^ Math.imul(hashStr(label), 0x9E3779B1)) >>> 0);
    }

    // --- accessors ---
    get name() { return this.#name; }
    get theme() { return this.#theme; }
    get difficulty() { return this.#difficulty; }
    get floorIndex() { return this.#floor; }
    get floorCount() { return this.#floorCount; }
    get level() { return this.#levels[this.#floor]; }
    get position() { return { ...this.#pos }; }
    get features() { return this.#features[this.#floor].filter(f => !this.#used.has(f.id)); }
    get props() { return this.#props[this.#floor]; }
    get groups() { return this.#groups[this.#floor].filter(g => this.#aliveMembers(g).length > 0); }
    get isLastFloor() { return this.#floor === this.#floorCount - 1; }
    get cleared() {
      for (let f = 0; f < this.#levels.length; ++f)
        for (const g of this.#groups[f])
          if (g.boss && this.#aliveMembers(g).length)
            return false;
      return this.#levels.length === this.#floorCount;
    }

    isExplored(c, r) { return this.#explored[this.#floor].has(key(c, r)); }
    isVisible(c, r) { return this.#visible.has(key(c, r)); }
    cell(c, r) { return this.level.get(c, r); }
    isOpen(c, r) { return this.level.open(c, r); }

    aliveMembers(group) { return this.#aliveMembers(group); }
    #aliveMembers(g) { return g.members.filter((m, i) => !this.#defeated.has(`${g.id}:${i}`)); }
    memberAlive(g, i) { return !this.#defeated.has(`${g.id}:${i}`); }

    // --- floors ---

    enterFloor(index, arriveBy) {
      if (index < 0 || index >= this.#floorCount)
        return false;
      while (this.#levels.length <= index)
        this.#generateFloor(this.#levels.length);
      this.#floor = index;
      const L = this.level;
      const at = arriveBy === 'down' ? L.exit : L.entrance;
      // stand beside the stairs, not on them
      this.#pos = this.#freeNear(at.col, at.row) || { col: at.col, row: at.row };
      this.#updateVisibility();
      return true;
    }

    #generateFloor(f) {
      const T = this.#theme;
      const rng = this.#rng(`floor:${f}`);
      const [bw, bh] = T.size;
      const w = bw + f * 4, h = bh + f * 2;
      const isLast = f === this.#floorCount - 1;
      let L;
      if (T.layout === 'cavern')
        L = cavernLevel(w, h, rng, { fill: 0.45 });
      else if (T.layout === 'wilds')
        L = cavernLevel(w, h, rng, { fill: 0.37 });
      else if (T.layout === 'maze')
        L = builtLevel(w, h, rng, { rooms: 16 + f * 2, maze: true });
      else
        L = builtLevel(w, h, rng, { rooms: 9 + f * 2, broken: !!T.broken });
      placeStairs(L, isLast);
      this.#levels[f] = L;
      this.#explored[f] = new Set();
      this.#populate(f, L, rng, isLast);
    }

    #populate(f, L, rng, isLast) {
      const T = this.#theme;
      const features = [];
      const props = [];
      const groups = [];
      const taken = new Set();
      const occupy = (c, r) => taken.add(key(c, r));
      const freeIn = (ch, tries = 30) => {
        for (let i = 0; i < tries; ++i) {
          const c = ch.cx + rng.nextInt(-Math.max(1, (ch.w >> 1) - 1), Math.max(1, (ch.w >> 1) - 1));
          const r = ch.cy + rng.nextInt(-Math.max(1, (ch.h >> 1) - 1), Math.max(1, (ch.h >> 1) - 1));
          if (L.get(c, r) === Cell.FLOOR && !taken.has(key(c, r)))
            return { col: c, row: r };
        }
        return null;
      };
      occupy(L.entrance.col, L.entrance.row);
      occupy(L.exit.col, L.exit.row);

      const tier = Math.max(0, Math.min(4, Math.floor((this.#difficulty - 1) / 2) + Math.floor(f / 2)));
      for (const ch of L.chambers) {
        const isEntrance = ch.id === L.entrance.chamber;
        const isExit = ch.id === L.exit.chamber;
        // a few props make every chamber look lived in
        for (let i = rng.nextInt(1, 3); i > 0; --i) {
          const p = freeIn(ch);
          if (p) {
            props.push({ ...p, kind: T.props[rng.nextInt(0, T.props.length - 1)] });
            occupy(p.col, p.row);
          }
        }
        if (isEntrance)
          continue;
        if (isExit && isLast) {
          const p = freeIn(ch);
          if (p) {
            features.push({ id: `${f}:hoard`, type: Feature.HOARD, ...p });
            occupy(p.col, p.row);
          }
          groups.push(this.#makeGroup(f, ch, L, rng, Math.min(4, tier + 1), true, taken));
          continue;
        }
        const roll = rng.next();
        const p = freeIn(ch);
        if (p) {
          const type = roll < 0.2 ? Feature.TREASURE : roll < 0.32 ? Feature.TRAP : roll < 0.4 ? Feature.FOUNTAIN : roll < 0.46 ? Feature.SHRINE : null;
          if (type) {
            features.push({ id: `${f}:${ch.id}`, type, ...p, hidden: type === Feature.TRAP });
            occupy(p.col, p.row);
          }
        }
        if (rng.next() < 0.5 + this.#difficulty * 0.04)
          groups.push(this.#makeGroup(f, ch, L, rng, tier, false, taken));
      }
      this.#features[f] = features;
      this.#props[f] = props;
      this.#groups[f] = groups.filter(g => g.members.length > 0);
    }

    #makeGroup(f, ch, L, rng, tier, boss, taken) {
      const T = this.#theme;
      const pool = T.pools[Math.min(T.pools.length - 1, tier)];
      // the location's own monsters show up more often than the theme's
      const picks = this.#locationEnemies.length && rng.next() < 0.45 ? this.#locationEnemies : pool;
      const count = boss ? rng.nextInt(2, 3) : Math.min(6, 1 + rng.nextInt(0, 2) + Math.floor(this.#difficulty / 3));
      const id = `${f}:g${ch.id}`;
      const members = [];
      // formation: spread around the chamber centre
      const spots = [];
      for (let rad = 0; rad <= 4 && spots.length < count; ++rad)
        for (let dr = -rad; dr <= rad && spots.length < count; ++dr)
          for (let dc = -rad; dc <= rad && spots.length < count; ++dc) {
            if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad)
              continue;
            const c = ch.cx + dc, r = ch.cy + dr;
            if (L.get(c, r) === Cell.FLOOR && !taken.has(key(c, r)) && (rad === 0 || (dc + dr) % 2 === 0)) {
              spots.push({ col: c, row: r });
              taken.add(key(c, r));
            }
          }
      for (let i = 0; i < spots.length; ++i) {
        let templateId = picks[rng.nextInt(0, picks.length - 1)];
        // deeper floors breed tougher monsters
        let extraHD = f;
        if (boss && i === 0) {
          // the strongest of the location's monsters leads, bigger than life
          templateId = (this.#locationEnemies[0]) || pool[pool.length - 1];
          extraHD += 2 + Math.floor(this.#difficulty / 2);
        }
        members.push({ templateId, extraHD, col: spots[i].col, row: spots[i].row, leader: boss && i === 0 });
      }
      return { id, chamber: ch.id, boss, members, aware: false };
    }

    #freeNear(c, r) {
      const L = this.level;
      for (let rad = 1; rad < 4; ++rad)
        for (const [dc, dr] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const nc = c + dc * rad, nr = r + dr * rad;
          if (L.get(nc, nr) === Cell.FLOOR && !this.#monsterAt(nc, nr))
            return { col: nc, row: nr };
        }
      return null;
    }

    #monsterAt(c, r) {
      for (const g of this.#groups[this.#floor] || [])
        for (let i = 0; i < g.members.length; ++i)
          if (g.members[i].col === c && g.members[i].row === r && this.memberAlive(g, i))
            return { group: g, index: i };
      return null;
    }

    monsterAt(c, r) { return this.#monsterAt(c, r); }

    // --- sight ---

    // Line of sight: Bresenham from the viewer, walls block but are seen.
    hasLineOfSight(c0, r0, c1, r1) {
      const L = this.level;
      let x = c0, y = r0;
      const dx = Math.abs(c1 - c0), dy = -Math.abs(r1 - r0);
      const sx = c0 < c1 ? 1 : -1, sy = r0 < r1 ? 1 : -1;
      let err = dx + dy;
      while (!(x === c1 && y === r1)) {
        if (!(x === c0 && y === r0) && !L.open(x, y))
          return false;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
      }
      return true;
    }

    #updateVisibility() {
      const { col, row } = this.#pos;
      const vis = new Set();
      const R = SIGHT_RADIUS;
      for (let r = row - R; r <= row + R; ++r)
        for (let c = col - R; c <= col + R; ++c) {
          if ((c - col) ** 2 + (r - row) ** 2 > R * R + R)
            continue;
          if (this.level.inBounds(c, r) && this.hasLineOfSight(col, row, c, r))
            vis.add(key(c, r));
        }
      this.#visible = vis;
      const ex = this.#explored[this.#floor];
      for (const k of vis)
        ex.add(k);
    }

    // --- movement and events ---

    canEnter(c, r) {
      return this.level.open(c, r) && !this.#monsterAt(c, r);
    }

    // Walks one step; returns the events it causes.
    step(dc, dr) {
      const nc = this.#pos.col + dc, nr = this.#pos.row + dr;
      if (!this.canEnter(nc, nr))
        return { moved: false, events: [] };
      this.#pos = { col: nc, row: nr };
      this.#updateVisibility();
      const events = [];
      const cell = this.level.get(nc, nr);
      if (cell === Cell.STAIRS_DOWN)
        events.push({ type: 'stairs_down' });
      else if (cell === Cell.STAIRS_UP)
        events.push({ type: this.#floor === 0 ? 'exit' : 'stairs_up' });
      for (const f of this.features)
        if (f.col === nc && f.row === nr)
          events.push({ type: f.type, feature: f });
      // a group the party had already spotted is caught unawares
      for (const g of this.groups)
        if (!g.aware && this.#groupSees(g))
          events.push({ type: 'encounter', group: g, ambush: !!g.sighted });
      // monsters the party saw first can be ambushed
      for (const g of this.groups)
        if (!g.sighted && this.#aliveMembers(g).some(m => this.isVisible(m.col, m.row))) {
          g.sighted = true;
          events.push({ type: 'sighted', group: g });
        }
      return { moved: true, events };
    }

    #groupSees(g) {
      const p = this.#pos;
      return g.members.some((m, i) => this.memberAlive(g, i)
        && Math.max(Math.abs(m.col - p.col), Math.abs(m.row - p.row)) <= GROUP_SIGHT
        && this.hasLineOfSight(m.col, m.row, p.col, p.row));
    }

    // Breadth-first walk through explored, open cells (click to walk).
    pathTo(tc, tr) {
      if (!this.isExplored(tc, tr) || !this.level.open(tc, tr))
        return null;
      const start = this.#pos;
      const prev = new Map([[key(start.col, start.row), null]]);
      const q = [start];
      for (let h = 0; h < q.length; ++h) {
        const cur = q[h];
        if (cur.col === tc && cur.row === tr) {
          const path = [];
          for (let k = key(tc, tr); k; k = prev.get(k)) {
            const [c, r] = k.split(',').map(Number);
            path.unshift({ col: c, row: r });
          }
          return path.slice(1);
        }
        for (const [dc, dr] of DIRS4) {
          const nc = cur.col + dc, nr = cur.row + dr, k = key(nc, nr);
          if (prev.has(k) || !this.level.open(nc, nr) || !this.isExplored(nc, nr) || this.#monsterAt(nc, nr))
            continue;
          // stairs are only walked onto on purpose
          const cell = this.level.get(nc, nr);
          if ((cell === Cell.STAIRS_UP || cell === Cell.STAIRS_DOWN) && (nc !== tc || nr !== tr))
            continue;
          prev.set(k, key(cur.col, cur.row));
          q.push({ col: nc, row: nr });
        }
      }
      return null;
    }

    useFeature(feature) {
      this.#used.add(feature.id);
    }

    // --- battles ---

    // Builds the battle around a group: every group whose members stand in
    // the cut-out joins. Positions are board-relative.
    battleSetup(trigger) {
      const L = this.level;
      const p = this.#pos;
      const involved = new Set([trigger.id]);
      let minC = p.col, maxC = p.col, minR = p.row, maxR = p.row;
      const grow = g => {
        for (const m of this.#aliveMembers(g)) {
          minC = Math.min(minC, m.col); maxC = Math.max(maxC, m.col);
          minR = Math.min(minR, m.row); maxR = Math.max(maxR, m.row);
        }
      };
      grow(trigger);
      // neighbours within earshot join the fight
      for (const g of this.groups)
        if (!involved.has(g.id) && this.#aliveMembers(g).some(m => Math.abs(m.col - p.col) + Math.abs(m.row - p.row) <= 9)) {
          involved.add(g.id);
          grow(g);
        }
      let x0 = minC - BOARD_PAD, x1 = maxC + BOARD_PAD, y0 = minR - BOARD_PAD, y1 = maxR + BOARD_PAD;
      const widen = (lo, hi, min, max, limit) => {
        while (hi - lo + 1 < min) { --lo; ++hi; }
        let shrinkHigh = true;
        while (hi - lo + 1 > max) { if (shrinkHigh) --hi; else ++lo; shrinkHigh = !shrinkHigh; }
        if (lo < 0) { hi -= lo; lo = 0; }
        if (hi > limit - 1) { lo -= hi - (limit - 1); hi = limit - 1; }
        return [Math.max(0, lo), Math.min(limit - 1, hi)];
      };
      [x0, x1] = widen(x0, x1, BOARD_MIN[0], BOARD_MAX[0], L.w);
      [y0, y1] = widen(y0, y1, BOARD_MIN[1], BOARD_MAX[1], L.h);
      const cols = x1 - x0 + 1, rows = y1 - y0 + 1;
      const T = this.#theme;
      const terrain = [];
      for (let r = y0; r <= y1; ++r)
        for (let c = x0; c <= x1; ++c)
          terrain.push(L.open(c, r) ? T.floorTerrain : T.wallTerrain);
      const grid = new TR.CombatGrid(cols, rows, terrain);

      const enemies = [];
      const enemyPositions = [];
      for (const g of this.groups) {
        if (!involved.has(g.id))
          continue;
        g.members.forEach((m, i) => {
          if (!this.memberAlive(g, i) || m.col < x0 || m.col > x1 || m.row < y0 || m.row > y1)
            return;
          enemies.push({ templateId: m.templateId, extraHD: m.extraHD, groupId: g.id, member: i, leader: !!m.leader });
          enemyPositions.push({ col: m.col - x0, row: m.row - y0 });
        });
      }
      // the party lines up behind its leader, away from the foes
      const partyPositions = this.#formation(p, trigger, x0, y0, x1, y1);
      const deployZone = [];
      const d = L.distances(p.col, p.row);
      for (let r = y0; r <= y1; ++r)
        for (let c = x0; c <= x1; ++c) {
          const dd = d[r * L.w + c];
          if (dd >= 0 && dd <= 3 && !this.#monsterAt(c, r))
            deployZone.push({ col: c - x0, row: r - y0 });
        }
      return { grid, origin: { col: x0, row: y0 }, enemies, enemyPositions, partyPositions, deployZone, groups: [...involved], biome: T.biome, theme: T.id };
    }

    #formation(p, trigger, x0, y0, x1, y1) {
      const L = this.level;
      const foes = this.#aliveMembers(trigger);
      const fx = foes.reduce((s, m) => s + m.col, 0) / Math.max(1, foes.length);
      const fy = foes.reduce((s, m) => s + m.row, 0) / Math.max(1, foes.length);
      const d = L.distances(p.col, p.row);
      const spots = [];
      for (let r = y0; r <= y1; ++r)
        for (let c = x0; c <= x1; ++c) {
          const dd = d[r * L.w + c];
          if (dd < 0 || dd > 4 || L.get(c, r) === Cell.WALL || this.#monsterAt(c, r))
            continue;
          // closer to the leader first, then farther from the enemy
          spots.push({ col: c, row: r, score: dd * 10 - Math.hypot(c - fx, r - fy) });
        }
      spots.sort((a, b) => a.score - b.score);
      return spots.slice(0, 8).map(s => ({ col: s.col - x0, row: s.row - y0 }));
    }

    // After a battle: mark the slain; survivors of a fled fight stay alert.
    resolveBattle(setup, slain) {
      for (const s of slain)
        this.#defeated.add(`${s.groupId}:${s.member}`);
      for (const id of setup.groups) {
        const g = this.#groups[this.#floor].find(x => x.id === id);
        if (g)
          g.aware = true;
      }
    }

    // --- persistence ---

    serialize() {
      return {
        seed: this.#seed, theme: this.#theme.id, name: this.#name, difficulty: this.#difficulty,
        enemies: this.#locationEnemies, floor: this.#floor, pos: this.#pos,
        explored: this.#explored.map(s => [...s]), used: [...this.#used], defeated: [...this.#defeated],
      };
    }

    static deserialize(data) {
      const theme = TR.DungeonThemes ? TR.DungeonThemes.THEMES[data.theme] : null;
      const crawl = new DungeonCrawl({ seed: data.seed, theme, name: data.name, difficulty: data.difficulty, enemies: data.enemies || [] });
      crawl.#restore(data);
      return crawl;
    }

    #restore(data) {
      for (const k of data.used || [])
        this.#used.add(k);
      for (const k of data.defeated || [])
        this.#defeated.add(k);
      this.enterFloor(data.floor || 0, 'up');
      (data.explored || []).forEach((list, f) => {
        while (this.#levels.length <= f)
          this.#generateFloor(this.#levels.length);
        for (const k of list)
          this.#explored[f].add(k);
      });
      if (data.pos && this.level.open(data.pos.col, data.pos.row))
        this.#pos = { ...data.pos };
      this.#updateVisibility();
    }
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; ++i)
      h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  TR.DungeonCrawl = DungeonCrawl;
  TR.DungeonCrawl.Cell = Cell;
  TR.DungeonCrawl.Feature = Feature;
  TR.DungeonCrawl.SIGHT_RADIUS = SIGHT_RADIUS;
})();
