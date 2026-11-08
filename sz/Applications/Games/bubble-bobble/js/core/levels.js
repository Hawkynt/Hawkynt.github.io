/* Stage maps from a seed: a 24 x 20 tile room with side walls, a ceiling and a floor that each
   have a gap in the middle (fall through the floor and you come back from the top), and five
   rows of mirrored platforms three tiles apart in a world's style - long ledges with holes, steps
   and staircases, small islands, floating clouds or castle battlements with pillars. Enemies
   start on the platforms, the player at the bottom left, and the wind gathers floating bubbles
   to the middle, the left or the right. A breadth-first search over standing spots with the
   real jump reach (three tiles up, three across, through platforms from below) proves that every
   enemy can be reached; a seed that fails is skipped. Pure. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const C = NS.constants;
  const { makeRng } = NS.rng;
  const { COLS, ROWS } = C;

  const PLATFORM_ROWS = [16, 13, 10, 7, 4];
  const GAP = [10, 11, 12, 13];

  function blank() {
    const g = [];
    for (let y = 0; y < ROWS; ++y) {
      const row = [];
      for (let x = 0; x < COLS; ++x) row.push(x === 0 || x === COLS - 1 || ((y === 0 || y === ROWS - 1) && GAP.indexOf(x) < 0) ? '#' : '.');
      g.push(row);
    }
    return g;
  }

  /* one half row (columns 1..11) of platform as booleans */
  function halfRow(r, style, row, k) {
    const out = new Array(11).fill(false);
    const set = (a, b) => { for (let x = Math.max(0, a); x <= Math.min(10, b); ++x) out[x] = true; };
    switch (style) {
      case 'ledges': { let x = r.int(2); while (x < 11) { const len = 4 + r.int(4); set(x, x + len - 1); x += len + 2 + r.int(2); } break; }
      case 'steps': { const off = (k % 2) ? 5 : 0; set(off, off + 4 + r.int(2)); if (r.next() < 0.5) set(9 - off, 10); break; }
      case 'islands': { for (let x = 1 + r.int(2); x < 11; x += 4 + r.int(2)) set(x, x + 1 + r.int(2)); break; }
      case 'clouds': { const c = 2 + r.int(6); set(c - 1, c + 2); if (r.next() < 0.6) set(9, 10); break; }
      default: { set(0, 2 + r.int(2)); set(6, 10); if (k % 2) set(4, 5); }
    }
    return out;
  }

  function build(seed, style, n) {
    const r = makeRng(seed);
    const g = blank();
    PLATFORM_ROWS.forEach((y, k) => {
      const h = halfRow(r, style, y, k);
      for (let x = 0; x < 11; ++x) if (h[x]) { g[y][1 + x] = '#'; g[y][COLS - 2 - x] = '#'; }
    });
    if (style === 'castle') for (let y = 5; y < 16; ++y) if (r.next() < 0.15) g[y][6] = g[y][COLS - 7] = '#';
    /* spawn spot */
    for (let x = 1; x < 4; ++x) g[ROWS - 2][x] = '.';
    const stands = [];
    for (let y = 1; y < ROWS - 2; ++y)
      for (let x = 1; x < COLS - 1; ++x)
        if (g[y][x] === '.' && g[y + 1][x] === '#' && y + 1 < ROWS - 1) stands.push([x, y]);
    const kinds = n.kinds;
    const enemies = [];
    const count = Math.min(9, n.count);
    for (let i = 0; i < count && stands.length; ++i) {
      const spot = stands.splice(r.int(stands.length), 1)[0];
      if (spot[1] > ROWS - 5 && spot[0] < 8) { --i; continue; }
      enemies.push({ type: kinds[r.int(kinds.length)], x: spot[0], y: spot[1] });
    }
    return { map: g.map(row => row.join('')), spawn: { x: 2, y: ROWS - 2 }, enemies: enemies, wind: ['center', 'left', 'right'][r.int(3)], style: style };
  }

  function solidAt(map, x, y) {
    if (x < 0 || x >= COLS) return true;
    if (y < 0 || y >= ROWS) return false;
    return map[y][x] === '#';
  }

  /* standing spots reachable from the spawn */
  function reachable(level) {
    const map = level.map;
    const stand = (x, y) => y >= 0 && y < ROWS - 1 && x > 0 && x < COLS - 1 && !solidAt(map, x, y) && solidAt(map, x, y + 1);
    const fall = (x, y) => {
      let yy = y, guard = 0;
      while (guard++ < ROWS * 2) {
        if (yy >= ROWS - 1) { if (map[ROWS - 1][x] === '#') return [x, ROWS - 2]; yy = 0; continue; }
        if (stand(x, yy)) return [x, yy];
        ++yy;
      }
      return null;
    };
    const seen = {};
    const q = [[level.spawn.x, level.spawn.y]];
    seen[level.spawn.x + ',' + level.spawn.y] = true;
    const push = (p) => { if (p && !seen[p[0] + ',' + p[1]]) { seen[p[0] + ',' + p[1]] = true; q.push(p); } };
    while (q.length) {
      const [x, y] = q.shift();
      for (const dx of [-1, 1]) {
        const nx = x + dx;
        if (nx <= 0 || nx >= COLS - 1) continue;
        push(stand(nx, y) ? [nx, y] : fall(nx, y));
      }
      for (let dy = 1; dy <= 3; ++dy)
        for (let dx = -3; dx <= 3; ++dx) if (stand(x + dx, y - dy)) push([x + dx, y - dy]);
      if (y === ROWS - 2 && map[ROWS - 1][x] !== '#') push(fall(x, 0));
    }
    return seen;
  }

  /* a stage that passes the reachability check (trying following seeds) */
  function generate(seed, style, n) {
    for (let k = 0; k < 40; ++k) {
      const lv = build((seed + k * 104729) >>> 0, style, n);
      const seen = reachable(lv);
      if (lv.enemies.length && lv.enemies.every(e => seen[e.x + ',' + e.y])) { lv.seed = (seed + k * 104729) >>> 0; return lv; }
    }
    return build(seed, 'ledges', n);
  }

  Object.assign(NS.levels, { PLATFORM_ROWS, GAP, blank, build, solidAt, reachable, generate });
})();
