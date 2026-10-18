/* Space Farming - 16x16 pixel-art toolkit: palette, pixel painter and the baker that turns a
   painter into an outlined, shaded offscreen canvas. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});

  /* ══════════════════════════════════════════════════════════════════
     SPRITES — 16x16 pixel art drawn once into offscreen canvases
     ══════════════════════════════════════════════════════════════════ */

  const SPRITE_SIZE = 16;
  const SPRITE_OUTLINE = '#1a1424';

  const PAL = {
    white: '#f4f0e8', cream: '#ffe6a8', yellow: '#ffd23f', gold: '#f2a516', orange: '#f57a1f',
    red: '#e23b3b', maroon: '#9c2a4a', pink: '#ff8fb8', purple: '#a54be0', violet: '#6a3bb5',
    blue: '#3d8ef0', sky: '#8fd3ff', cyan: '#4fe0d0', teal: '#1fa39a', green: '#4cc341',
    leaf: '#2f8f3a', lime: '#a8e04a', brown: '#9a5b34', dbrown: '#5e3820', tan: '#d8a868',
    grey: '#9aa0b0', dgrey: '#5a5f70', steel: '#c8d0dc', black: '#2a2438', slate: '#7186b0',
    soil: '#6b4429'
  };

  function shadeColor(hex, amount) {
    let h = hex.replace('#', '');
    if (h.length === 3)
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    const mix = (v) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  /* Pixel painter on a 16x16 grid; every primitive works in whole pixels */
  function createPixelPainter() {
    const N = SPRITE_SIZE;
    const px = new Array(N * N).fill(null);
    const flat = new Array(N * N).fill(false);
    const set = (x, y, c, noShade) => {
      x = Math.round(x);
      y = Math.round(y);
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      px[y * N + x] = c;
      flat[y * N + x] = !!noShade;
    };
    const p = {
      px: set,
      clear: (x, y) => set(x, y, null),
      rect: (x, y, w, h, c, noShade) => {
        for (let j = 0; j < h; ++j)
          for (let i = 0; i < w; ++i)
            set(x + i, y + j, c, noShade);
      },
      ell: (cx, cy, rx, ry, c, noShade) => {
        for (let y = 0; y < N; ++y)
          for (let x = 0; x < N; ++x) {
            const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
            if (dx * dx + dy * dy <= 1)
              set(x, y, c, noShade);
          }
      },
      disc: (cx, cy, r, c, noShade) => p.ell(cx, cy, r, r, c, noShade),
      line: (x0, y0, x1, y1, c, noShade) => {
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
        for (let s = 0; s <= steps; ++s)
          set(x0 + (x1 - x0) * s / steps, y0 + (y1 - y0) * s / steps, c, noShade);
      },
      poly: (pts, c, noShade) => {
        for (let y = 0; y < N; ++y)
          for (let x = 0; x < N; ++x) {
            const tx = x + 0.5, ty = y + 0.5;
            let inside = false;
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
              const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
              if ((yi > ty) !== (yj > ty) && tx < (xj - xi) * (ty - yi) / (yj - yi) + xi)
                inside = !inside;
            }
            if (inside)
              set(x, y, c, noShade);
          }
      },
      map: (x0, y0, rows, colors, noShade) => {
        for (let j = 0; j < rows.length; ++j)
          for (let i = 0; i < rows[j].length; ++i) {
            const ch = rows[j][i];
            if (ch !== '.')
              set(x0 + i, y0 + j, colors[ch], noShade);
          }
      },
      _px: px,
      _flat: flat
    };
    return p;
  }

  /* Bakes a painter into a canvas: light rim top-left, shadow bottom-right, 1px dark outline */
  function bakeSprite(paint) {
    const N = SPRITE_SIZE;
    const p = createPixelPainter();
    paint(p, PAL);
    const src = p._px;
    const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N) ? null : src[y * N + x];
    const out = src.slice();
    for (let y = 0; y < N; ++y)
      for (let x = 0; x < N; ++x) {
        const c = src[y * N + x];
        if (!c || p._flat[y * N + x]) continue;
        if (at(x + 1, y) !== c && at(x, y + 1) !== c && (at(x + 1, y) === null || at(x, y + 1) === null))
          out[y * N + x] = shadeColor(c, -0.3);
        else if (at(x, y + 1) === null || at(x + 1, y) === null)
          out[y * N + x] = shadeColor(c, -0.22);
        else if (at(x, y - 1) === null || at(x - 1, y) === null)
          out[y * N + x] = shadeColor(c, 0.25);
      }
    for (let y = 0; y < N; ++y)
      for (let x = 0; x < N; ++x)
        if (!src[y * N + x] && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)))
          out[y * N + x] = SPRITE_OUTLINE;
    const cv = document.createElement('canvas');
    cv.width = N;
    cv.height = N;
    const g = cv.getContext('2d');
    for (let y = 0; y < N; ++y)
      for (let x = 0; x < N; ++x)
        if (out[y * N + x]) {
          g.fillStyle = out[y * N + x];
          g.fillRect(x, y, 1, 1);
        }
    return cv;
  }

  function paintSun(p, P, cx, cy, r) {
    for (let a = 0; a < 8; ++a) {
      const ang = a * Math.PI / 4;
      p.line(cx + Math.cos(ang) * (r + 2), cy + Math.sin(ang) * (r + 2), cx + Math.cos(ang) * (r + 3), cy + Math.sin(ang) * (r + 3), P.orange);
    }
    p.disc(cx, cy, r, P.yellow);
    p.px(cx - 1, cy - 1, P.cream, true);
  }

  function paintRobot(p, P) {
    p.line(7.5, 1, 7.5, 3, P.dgrey);
    p.disc(7.5, 1, 0, P.red, true);
    p.rect(3, 4, 10, 7, P.steel);
    p.rect(5, 6, 2, 2, P.cyan, true);
    p.rect(9, 6, 2, 2, P.cyan, true);
    p.rect(6, 9, 4, 1, P.dgrey, true);
    p.rect(4, 12, 8, 3, P.grey);
    p.rect(1, 6, 2, 3, P.grey);
    p.rect(13, 6, 2, 3, P.grey);
  }

  function paintPot(p, P) {
    p.poly([[4, 10], [12, 10], [11, 15], [5, 15]], P.brown);
    p.rect(3, 9, 10, 2, P.orange);
    p.rect(5, 9, 6, 1, P.soil, true);
  }

  Object.assign(NS, { shadeColor, bakeSprite, paintSun, paintRobot, paintPot });

})();
