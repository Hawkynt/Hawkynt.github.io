;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const DungeonTile = Object.freeze({
    WALL:        'wall',
    FLOOR:       'floor',
    CORRIDOR:    'corridor',
    DOOR:        'door',
    STAIRS_UP:   'stairs_up',
    STAIRS_DOWN: 'stairs_down',
  });

  const VALID_TILES = new Set(Object.values(DungeonTile));

  const FeatureType = Object.freeze({
    TREASURE: 'treasure',
    TRAP:     'trap',
    FOUNTAIN: 'fountain',
    ENEMY:    'enemy',
    ALTAR:    'altar',
    LIBRARY:  'library',
    BOSS:     'boss',
    ARMORY:   'armory',
  });

  const RoomShape = Object.freeze({
    RECTANGLE: 'rectangle',
    ROUNDED:   'rounded',
    ALCOVE:    'alcove',
    L_SHAPE:   'l_shape',
    CROSS:     'cross',
  });

  const MIN_ROOM_SIZE = 4;
  const MIN_SPLIT_SIZE = MIN_ROOM_SIZE * 2 + 3;

  class BSPNode {
    constructor(x, y, w, h) {
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.left = null;
      this.right = null;
      this.room = null;
    }

    split(prng) {
      if (this.left || this.right)
        return false;
      if (this.w < MIN_SPLIT_SIZE && this.h < MIN_SPLIT_SIZE)
        return false;

      const splitH = this.w >= this.h ? prng.next() < 0.6 : prng.next() < 0.4;

      if (splitH && this.w < MIN_SPLIT_SIZE)
        return this.#splitVertical(prng);
      if (!splitH && this.h < MIN_SPLIT_SIZE)
        return this.#splitHorizontal(prng);
      return splitH ? this.#splitHorizontal(prng) : this.#splitVertical(prng);
    }

    #splitHorizontal(prng) {
      if (this.w < MIN_SPLIT_SIZE)
        return false;
      const min = MIN_ROOM_SIZE + 1;
      const max = this.w - MIN_ROOM_SIZE - 1;
      if (min >= max)
        return false;
      const split = prng.nextInt(min, max);
      this.left = new BSPNode(this.x, this.y, split, this.h);
      this.right = new BSPNode(this.x + split, this.y, this.w - split, this.h);
      return true;
    }

    #splitVertical(prng) {
      if (this.h < MIN_SPLIT_SIZE)
        return false;
      const min = MIN_ROOM_SIZE + 1;
      const max = this.h - MIN_ROOM_SIZE - 1;
      if (min >= max)
        return false;
      const split = prng.nextInt(min, max);
      this.left = new BSPNode(this.x, this.y, this.w, split);
      this.right = new BSPNode(this.x, this.y + split, this.w, this.h - split);
      return true;
    }

    getLeaves() {
      if (!this.left && !this.right)
        return [this];
      const leaves = [];
      if (this.left)
        leaves.push(...this.left.getLeaves());
      if (this.right)
        leaves.push(...this.right.getLeaves());
      return leaves;
    }
  }

  class DungeonFloor {
    #width;
    #height;
    #tiles;
    #rooms;
    #corridors;
    #features;
    #entrance;
    #exit;

    constructor(width, height) {
      this.#width = width;
      this.#height = height;
      this.#tiles = new Array(width * height).fill(DungeonTile.WALL);
      this.#rooms = [];
      this.#corridors = [];
      this.#features = [];
      this.#entrance = null;
      this.#exit = null;
    }

    get width() { return this.#width; }
    get height() { return this.#height; }
    get rooms() { return this.#rooms.slice(); }
    get corridors() { return this.#corridors.slice(); }
    get features() { return this.#features.slice(); }
    get entrance() { return this.#entrance; }
    get exit() { return this.#exit; }

    getTile(col, row) {
      if (col < 0 || col >= this.#width || row < 0 || row >= this.#height)
        return DungeonTile.WALL;
      return this.#tiles[row * this.#width + col];
    }

    getRoomAt(col, row) {
      for (const room of this.#rooms)
        if (col >= room.x && col < room.x + room.w && row >= room.y && row < room.y + room.h)
          return room;
      return null;
    }

    generate(roomCount, prng) {
      const root = new BSPNode(1, 1, this.#width - 2, this.#height - 2);
      const maxSplits = Math.max(2, roomCount);
      const nodes = [root];

      for (let i = 0; i < maxSplits; ++i) {
        const leaves = root.getLeaves();
        let splitAny = false;
        for (const leaf of leaves)
          if (leaf.split(prng))
            splitAny = true;
        if (!splitAny)
          break;
      }

      const leaves = root.getLeaves();
      for (const leaf of leaves) {
        const padX = 1;
        const padY = 1;
        const rw = Math.max(MIN_ROOM_SIZE, leaf.w - padX * 2 - prng.nextInt(0, Math.max(0, leaf.w - MIN_ROOM_SIZE - padX * 2)));
        const rh = Math.max(MIN_ROOM_SIZE, leaf.h - padY * 2 - prng.nextInt(0, Math.max(0, leaf.h - MIN_ROOM_SIZE - padY * 2)));
        const rx = leaf.x + prng.nextInt(padX, Math.max(padX, leaf.w - rw - padX));
        const ry = leaf.y + prng.nextInt(padY, Math.max(padY, leaf.h - rh - padY));

        // Pick a room shape based on PRNG
        const shapeRoll = prng.next();
        let shape = RoomShape.RECTANGLE;
        if (shapeRoll < 0.40) shape = RoomShape.RECTANGLE;
        else if (shapeRoll < 0.60) shape = RoomShape.ROUNDED;
        else if (shapeRoll < 0.75) shape = RoomShape.ALCOVE;
        else if (shapeRoll < 0.90) shape = RoomShape.L_SHAPE;
        else if (rw >= 6 && rh >= 6) shape = RoomShape.CROSS;

        const room = Object.freeze({ x: rx, y: ry, w: rw, h: rh, id: this.#rooms.length, shape });
        leaf.room = room;
        this.#rooms.push(room);

        // Carve the base rectangle
        for (let r = ry; r < ry + rh; ++r)
          for (let c = rx; c < rx + rw; ++c)
            this.#tiles[r * this.#width + c] = DungeonTile.FLOOR;

        // Apply shape modifications
        this.#applyRoomShape(room, shape, prng);
      }

      this.#connectRooms(root, prng);

      if (this.#rooms.length > 0) {
        const first = this.#rooms[0];
        this.#entrance = { col: first.x + Math.floor(first.w / 2), row: first.y + Math.floor(first.h / 2) };
        this.#tiles[this.#entrance.row * this.#width + this.#entrance.col] = DungeonTile.STAIRS_UP;

        const last = this.#rooms[this.#rooms.length - 1];
        this.#exit = { col: last.x + Math.floor(last.w / 2), row: last.y + Math.floor(last.h / 2) };
        if (this.#rooms.length > 1)
          this.#tiles[this.#exit.row * this.#width + this.#exit.col] = DungeonTile.STAIRS_DOWN;
      }

      return this;
    }

    placeFeatures(prng, difficulty) {
      const isLast = (room) => room === this.#rooms[this.#rooms.length - 1];
      const isFirst = (room) => room === this.#rooms[0];

      for (const room of this.#rooms) {
        if (isFirst(room)) continue;

        const col = room.x + prng.nextInt(1, Math.max(1, room.w - 2));
        const row = room.y + prng.nextInt(1, Math.max(1, room.h - 2));

        // Boss room: last room on harder dungeons
        if (isLast(room) && (difficulty || 0) >= 3) {
          this.#features.push(Object.freeze({ type: FeatureType.BOSS, col: room.x + Math.floor(room.w / 2), row: room.y + Math.floor(room.h / 2), roomId: room.id }));
          continue;
        }

        // Themed rooms (15% each for non-start/end rooms)
        const themeRoll = prng.next();
        if (themeRoll < 0.10) {
          this.#features.push(Object.freeze({ type: FeatureType.LIBRARY, col, row, roomId: room.id }));
          this.#features.push(Object.freeze({ type: FeatureType.TREASURE, col: col + 1, row, roomId: room.id }));
        } else if (themeRoll < 0.20) {
          this.#features.push(Object.freeze({ type: FeatureType.ALTAR, col, row, roomId: room.id }));
          this.#features.push(Object.freeze({ type: FeatureType.FOUNTAIN, col: col + 1, row, roomId: room.id }));
        } else if (themeRoll < 0.28) {
          this.#features.push(Object.freeze({ type: FeatureType.ARMORY, col, row, roomId: room.id }));
          this.#features.push(Object.freeze({ type: FeatureType.TREASURE, col, row: row + 1, roomId: room.id }));
        } else {
          // Standard features
          const roll = prng.next();
          if (roll < 0.15)
            this.#features.push(Object.freeze({ type: FeatureType.TREASURE, col, row, roomId: room.id }));
          else if (roll < 0.28)
            this.#features.push(Object.freeze({ type: FeatureType.TRAP, col, row, roomId: room.id }));
          else if (roll < 0.38)
            this.#features.push(Object.freeze({ type: FeatureType.FOUNTAIN, col, row, roomId: room.id }));
        }

        // Enemies: 50-70% chance depending on difficulty
        const enemyChance = 0.5 + ((difficulty || 0) * 0.03);
        if (prng.next() < enemyChance) {
          this.#features.push(Object.freeze({ type: FeatureType.ENEMY, col: room.x + Math.floor(room.w / 2), row: room.y + Math.floor(room.h / 2), roomId: room.id }));
          // Larger rooms may have multiple enemies
          if (room.w >= 6 && room.h >= 6 && prng.next() < 0.3)
            this.#features.push(Object.freeze({ type: FeatureType.ENEMY, col: room.x + 1, row: room.y + 1, roomId: room.id }));
        }
      }
      return this;
    }

    #setTile(c, r, tile) {
      if (c >= 1 && c < this.#width - 1 && r >= 1 && r < this.#height - 1)
        this.#tiles[r * this.#width + c] = tile;
    }

    #applyRoomShape(room, shape, prng) {
      const { x, y, w, h } = room;
      if (shape === RoomShape.ROUNDED && w >= 5 && h >= 5) {
        // Remove corner tiles to make it feel less boxy
        this.#setTile(x, y, DungeonTile.WALL);
        this.#setTile(x + w - 1, y, DungeonTile.WALL);
        this.#setTile(x, y + h - 1, DungeonTile.WALL);
        this.#setTile(x + w - 1, y + h - 1, DungeonTile.WALL);
      } else if (shape === RoomShape.ALCOVE) {
        // Extend 2-3 tiles from a random wall
        const side = prng.nextInt(0, 3);
        const alcoveLen = prng.nextInt(2, 3);
        const midW = x + Math.floor(w / 2);
        const midH = y + Math.floor(h / 2);
        if (side === 0) for (let i = 1; i <= alcoveLen; ++i) this.#setTile(midW, y - i, DungeonTile.FLOOR);
        else if (side === 1) for (let i = 1; i <= alcoveLen; ++i) this.#setTile(midW, y + h - 1 + i, DungeonTile.FLOOR);
        else if (side === 2) for (let i = 1; i <= alcoveLen; ++i) this.#setTile(x - i, midH, DungeonTile.FLOOR);
        else for (let i = 1; i <= alcoveLen; ++i) this.#setTile(x + w - 1 + i, midH, DungeonTile.FLOOR);
      } else if (shape === RoomShape.L_SHAPE && w >= 5 && h >= 5) {
        // Carve out one quadrant to create an L
        const quadrant = prng.nextInt(0, 3);
        const cutW = Math.floor(w / 2);
        const cutH = Math.floor(h / 2);
        let cx, cy;
        if (quadrant === 0) { cx = x; cy = y; }
        else if (quadrant === 1) { cx = x + w - cutW; cy = y; }
        else if (quadrant === 2) { cx = x; cy = y + h - cutH; }
        else { cx = x + w - cutW; cy = y + h - cutH; }
        for (let r = cy; r < cy + cutH; ++r)
          for (let c = cx; c < cx + cutW; ++c)
            this.#setTile(c, r, DungeonTile.WALL);
      } else if (shape === RoomShape.CROSS && w >= 6 && h >= 6) {
        // Keep only the center cross, wall out the corners
        const armW = Math.floor(w / 3);
        const armH = Math.floor(h / 3);
        // Wall out four corner rectangles
        for (let r = y; r < y + armH; ++r) {
          for (let c = x; c < x + armW; ++c) this.#setTile(c, r, DungeonTile.WALL);
          for (let c = x + w - armW; c < x + w; ++c) this.#setTile(c, r, DungeonTile.WALL);
        }
        for (let r = y + h - armH; r < y + h; ++r) {
          for (let c = x; c < x + armW; ++c) this.#setTile(c, r, DungeonTile.WALL);
          for (let c = x + w - armW; c < x + w; ++c) this.#setTile(c, r, DungeonTile.WALL);
        }
      }
    }

    #connectRooms(node, prng) {
      if (!node.left || !node.right)
        return;

      this.#connectRooms(node.left, prng);
      this.#connectRooms(node.right, prng);

      const leftRoom = this.#findRoom(node.left);
      const rightRoom = this.#findRoom(node.right);
      if (leftRoom && rightRoom)
        this.#carveCorridorBetween(leftRoom, rightRoom, prng);
    }

    #findRoom(node) {
      if (node.room)
        return node.room;
      if (node.left) {
        const r = this.#findRoom(node.left);
        if (r) return r;
      }
      if (node.right)
        return this.#findRoom(node.right);
      return null;
    }

    #carveCorridorBetween(roomA, roomB, prng) {
      const ax = roomA.x + Math.floor(roomA.w / 2);
      const ay = roomA.y + Math.floor(roomA.h / 2);
      const bx = roomB.x + Math.floor(roomB.w / 2);
      const by = roomB.y + Math.floor(roomB.h / 2);

      const corridor = [];
      const wide = prng.next() < 0.3; // 30% chance for wider corridor

      if (prng.next() < 0.5) {
        this.#carveLine(ax, ay, bx, ay, corridor);
        this.#carveLine(bx, ay, bx, by, corridor);
        if (wide) {
          this.#carveLine(ax, ay + 1, bx, ay + 1, corridor);
          this.#carveLine(bx + 1, ay, bx + 1, by, corridor);
        }
      } else {
        this.#carveLine(ax, ay, ax, by, corridor);
        this.#carveLine(ax, by, bx, by, corridor);
        if (wide) {
          this.#carveLine(ax + 1, ay, ax + 1, by, corridor);
          this.#carveLine(ax, by + 1, bx, by + 1, corridor);
        }
      }

      this.#corridors.push(Object.freeze(corridor.map(p => Object.freeze(p))));
    }

    #carveLine(x1, y1, x2, y2, corridor) {
      let x = x1, y = y1;
      const dx = x2 > x1 ? 1 : x2 < x1 ? -1 : 0;
      const dy = y2 > y1 ? 1 : y2 < y1 ? -1 : 0;

      while (x !== x2 || y !== y2) {
        if (x >= 0 && x < this.#width && y >= 0 && y < this.#height) {
          const idx = y * this.#width + x;
          if (this.#tiles[idx] === DungeonTile.WALL) {
            this.#tiles[idx] = DungeonTile.CORRIDOR;
            corridor.push({ col: x, row: y });
          }
        }
        if (x !== x2)
          x += dx;
        else
          y += dy;
      }
      if (x >= 0 && x < this.#width && y >= 0 && y < this.#height) {
        const idx = y * this.#width + x;
        if (this.#tiles[idx] === DungeonTile.WALL) {
          this.#tiles[idx] = DungeonTile.CORRIDOR;
          corridor.push({ col: x, row: y });
        }
      }
    }

    isReachable(startCol, startRow, endCol, endRow) {
      const start = this.getTile(startCol, startRow);
      const end = this.getTile(endCol, endRow);
      if (start === DungeonTile.WALL || end === DungeonTile.WALL)
        return false;

      const visited = new Set();
      const queue = [`${startCol},${startRow}`];
      visited.add(queue[0]);
      const DIRS = [{ dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }];

      while (queue.length > 0) {
        const key = queue.shift();
        const [c, r] = key.split(',').map(Number);
        if (c === endCol && r === endRow)
          return true;
        for (const d of DIRS) {
          const nc = c + d.dc;
          const nr = r + d.dr;
          const nk = `${nc},${nr}`;
          if (visited.has(nk))
            continue;
          if (nc < 0 || nc >= this.#width || nr < 0 || nr >= this.#height)
            continue;
          const tile = this.#tiles[nr * this.#width + nc];
          if (tile === DungeonTile.WALL)
            continue;
          visited.add(nk);
          queue.push(nk);
        }
      }
      return false;
    }
  }

  class DungeonInstance {
    #floors;
    #currentFloor;
    #difficulty;
    #revealed;

    constructor(difficulty) {
      this.#difficulty = difficulty || 1;
      this.#floors = [];
      this.#currentFloor = 0;
      this.#revealed = new Set();
    }

    get floors() { return this.#floors.slice(); }
    get currentFloor() { return this.#currentFloor; }
    get currentFloorData() { return this.#floors[this.#currentFloor] || null; }
    get difficulty() { return this.#difficulty; }
    get floorCount() { return this.#floors.length; }

    generate(width, height, floorCount, prng) {
      const numFloors = Math.max(1, Math.min(10, floorCount));
      this.#floors = [];
      this.#revealed = new Set();

      for (let f = 0; f < numFloors; ++f) {
        const roomCount = 3 + Math.floor(f * 1.5) + prng.nextInt(0, 2);
        // Deeper floors are slightly larger
        const floorW = Math.min(width + f * 2, width * 2);
        const floorH = Math.min(height + f * 2, height * 2);
        const floor = new DungeonFloor(floorW, floorH);
        floor.generate(roomCount, prng.fork(`floor_${f}`));
        floor.placeFeatures(prng.fork(`feat_${f}`), this.#difficulty);
        this.#floors.push(floor);
      }

      this.#currentFloor = 0;
      return this;
    }

    moveToFloor(idx) {
      if (idx < 0 || idx >= this.#floors.length)
        return false;
      this.#currentFloor = idx;
      this.#revealed = new Set();
      return true;
    }

    reveal(col, row, radius) {
      const floor = this.currentFloorData;
      if (!floor)
        return;
      for (let dr = -radius; dr <= radius; ++dr)
        for (let dc = -radius; dc <= radius; ++dc) {
          const nc = col + dc;
          const nr = row + dr;
          if (Math.abs(dc) + Math.abs(dr) <= radius)
            this.#revealed.add(`${this.#currentFloor}:${nc},${nr}`);
        }
    }

    isRevealed(col, row) {
      return this.#revealed.has(`${this.#currentFloor}:${col},${row}`);
    }

    enemyTier(floorIndex) {
      return Math.min(6, this.#difficulty + floorIndex);
    }
  }

  TR.DungeonTile = DungeonTile;
  TR.FeatureType = FeatureType;
  TR.RoomShape = RoomShape;
  TR.DungeonFloor = DungeonFloor;
  TR.DungeonInstance = DungeonInstance;
})();
