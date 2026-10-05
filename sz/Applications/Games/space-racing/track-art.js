;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  /*
   * Themed track and background art for the race tracks.
   * create(geo, theme) precomputes edges, kerb runs, lights, chevrons and all
   * offscreen sprites once; the returned draw functions only stroke, fill and
   * blit, so a frame stays cheap.
   */

  const TWO_PI = Math.PI * 2;
  const BEND_THRESHOLD = 0.35;
  const CHEVRON_THRESHOLD = 0.6;
  const CHEVRON_SPACING = 400;
  const LIGHT_SPACING = 160;
  const NEBULA_TILE = 1024;
  const STAR_TILE = 512;
  const PLANET_SIZE = 600;
  const PLANET_RADIUS = 200;

  const THEMES = {
    nebula: {
      bg1: '#0b0820', bg2: '#1a0f3a', cloud: ['#6a3cff', '#c04cff', '#2a5cff'],
      road: '#1a1830', edge: '#9b7bff', glow: '#7a5cff', kerbA: '#ff4d8d', kerbB: '#f4f0ff', planet: '#c8a0ff'
    },
    storm: {
      bg1: '#041016', bg2: '#08242e', cloud: ['#00b3c7', '#2ae0ff', '#0a6a8a'],
      road: '#121c24', edge: '#4cf0ff', glow: '#00d0ff', kerbA: '#ffe14d', kerbB: '#0b1a22', planet: '#7fe8ff'
    },
    pulsar: {
      bg1: '#050a14', bg2: '#0c1830', cloud: ['#5ab8ff', '#e4f4ff', '#3a6cff'],
      road: '#141a2a', edge: '#bfe6ff', glow: '#7fd0ff', kerbA: '#5ab8ff', kerbB: '#ffffff', planet: '#e8f6ff'
    },
    asteroid: {
      bg1: '#0e0906', bg2: '#2a1a0e', cloud: ['#a8662a', '#ffb060', '#5a3418'],
      road: '#1e1814', edge: '#ffb060', glow: '#ff9a3c', kerbA: '#ff6a2a', kerbB: '#ffe8c8', planet: '#d0a070'
    },
    solar: {
      bg1: '#140504', bg2: '#3a0c06', cloud: ['#ff5a1a', '#ffc04a', '#a01a10'],
      road: '#22120e', edge: '#ffcc5a', glow: '#ff7a2a', kerbA: '#ff3a1a', kerbB: '#fff2d0', planet: '#ffd27a'
    },
    comet: {
      bg1: '#040c14', bg2: '#0a2034', cloud: ['#7fd8ff', '#d8f4ff', '#3a8acc'],
      road: '#121c28', edge: '#d8f4ff', glow: '#9fe4ff', kerbA: '#3aa8ff', kerbB: '#ffffff', planet: '#bfe8ff'
    },
    quasar: {
      bg1: '#10041a', bg2: '#2a0a3a', cloud: ['#ff4cd8', '#a64cff', '#ff9af0'],
      road: '#1c1226', edge: '#ff8af0', glow: '#ff4cd8', kerbA: '#ffd75a', kerbB: '#2a0a3a', planet: '#ffb0f0'
    },
    void: {
      bg1: '#030406', bg2: '#0a1410', cloud: ['#2aff9a', '#1a6a4a', '#6affd0'],
      road: '#0e1412', edge: '#6affc0', glow: '#2aff9a', kerbA: '#2aff9a', kerbB: '#0a1410', planet: '#9affd8'
    }
  };

  /* ── Color helpers ── */

  function hexToRgb(hex) {
    const h = hex.replace(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/, '#$1$1$2$2$3$3');
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16)
    };
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  /* amount > 0 mixes toward white, amount < 0 toward black */
  function shade(hex, amount) {
    const c = hexToRgb(hex);
    const target = amount > 0 ? 255 : 0;
    const mix = (v) => Math.round(v + (target - v) * Math.abs(amount));
    return 'rgb(' + mix(c.r) + ',' + mix(c.g) + ',' + mix(c.b) + ')';
  }

  function makeCanvas(size) {
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    return cv;
  }

  function wrapAngle(a) {
    while (a > Math.PI) a -= TWO_PI;
    while (a < -Math.PI) a += TWO_PI;
    return a;
  }

  function create(geo, themeName) {
    const theme = THEMES[themeName] || THEMES.nebula;
    const points = geo.points;
    const n = points.length;
    const half = geo.width / 2;

    /* ── 1) travel direction per point and the two edge polylines ── */
    const segAngle = new Array(n);
    const left = new Array(n);
    const right = new Array(n);
    for (let i = 0; i < n; ++i) {
      const p = points[i];
      const q = points[(i + 1) % n];
      const a = Math.atan2(q.y - p.y, q.x - p.x);
      segAngle[i] = a;
      const nx = Math.sin(a);
      const ny = -Math.cos(a);
      left[i] = { x: p.x + nx * half, y: p.y + ny * half };
      right[i] = { x: p.x - nx * half, y: p.y - ny * half };
    }

    /* ── 2) bend strength: angle change across six segments around each point ── */
    const bend = new Array(n);
    const turnCross = new Array(n);
    for (let i = 0; i < n; ++i) {
      const a = segAngle[(i - 3 + n) % n];
      const b = segAngle[(i + 3) % n];
      bend[i] = Math.abs(wrapAngle(b - a));
      turnCross[i] = Math.sin(b - a);
    }

    /* maximal runs of consecutive bend points (the loop is closed) */
    const runs = [];
    let starts = 0;
    for (let i = 0; i < n; ++i) {
      if (bend[i] > BEND_THRESHOLD && bend[(i + n - 1) % n] <= BEND_THRESHOLD) ++starts;
    }
    if (starts === 0) {
      if (bend[0] > BEND_THRESHOLD) runs.push({ from: 0, count: n });
    } else {
      for (let i = 0; i < n; ++i) {
        if (bend[i] > BEND_THRESHOLD && bend[(i + n - 1) % n] <= BEND_THRESHOLD) {
          let count = 0;
          while (count < n && bend[(i + count) % n] > BEND_THRESHOLD) ++count;
          runs.push({ from: i, count: count });
        }
      }
    }

    /* ── 3) edge lights every 160 units, one on each side ── */
    const lights = [];
    for (let s = 0; s < geo.length; s += LIGHT_SPACING) {
      const p = geo.sampleAt(s);
      const off = half + 14;
      lights.push({ x: p.x + p.nx * off, y: p.y + p.ny * off, phase: lights.length });
      lights.push({ x: p.x - p.nx * off, y: p.y - p.ny * off, phase: lights.length });
    }

    /* ── 4) chevron groups on the outside of the sharpest bends ── */
    const chevronGroups = [];
    const chevrons = [];
    let lastGroupS = -Infinity;
    for (let i = 0; i < n; ++i) {
      if (bend[i] <= CHEVRON_THRESHOLD) continue;
      const s = geo.cum[i];
      if (s - lastGroupS < CHEVRON_SPACING) continue;
      lastGroupS = s;
      /* cross < 0 turns left on screen, so the outside is the right edge */
      const side = turnCross[i] < 0 ? -1 : 1;
      const off = side * (half + 60);
      const group = { s: s, items: [] };
      for (let k = 0; k < 3; ++k) {
        const p = geo.sampleAt(s + (k - 1) * 50);
        const ch = { x: p.x + p.nx * off, y: p.y + p.ny * off, angle: p.angle, k: k };
        group.items.push(ch);
        chevrons.push(ch);
      }
      chevronGroups.push(group);
    }
    while (chevronGroups.length > 1 && chevronGroups[0].s + geo.length - lastGroupS < CHEVRON_SPACING) {
      const dropped = chevronGroups.shift();
      for (let k = 0; k < dropped.items.length; ++k)
        chevrons.splice(chevrons.indexOf(dropped.items[k]), 1);
    }

    /* ── 5) road texture tile ── */
    const tex = makeCanvas(128);
    const tc = tex.getContext('2d');
    const lighter = shade(theme.road, 0.55);
    const darker = shade(theme.road, -0.55);
    tc.fillStyle = theme.road;
    tc.fillRect(0, 0, 128, 128);
    tc.globalAlpha = 0.25;
    for (let i = 0; i < 900; ++i) {
      tc.fillStyle = i & 1 ? lighter : darker;
      const s = 1 + (i & 1);
      tc.fillRect(Math.random() * 128, Math.random() * 128, s, s);
    }
    tc.globalAlpha = 0.08;
    tc.strokeStyle = lighter;
    tc.lineWidth = 1;
    for (let i = 0; i < 40; ++i) {
      const x = Math.random() * 128;
      const y = Math.random() * 128;
      const a = Math.random() * TWO_PI;
      const len = 10 + Math.random() * 20;
      tc.beginPath();
      tc.moveTo(x, y);
      tc.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      tc.stroke();
    }
    tc.globalAlpha = 1;

    /* ── 6) glow sprite, reused for every edge light ── */
    const glow = makeCanvas(64);
    const gc = glow.getContext('2d');
    const gg = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
    gg.addColorStop(0, rgba(theme.glow, 1));
    gg.addColorStop(0.35, rgba(theme.glow, 0.45));
    gg.addColorStop(1, rgba(theme.glow, 0));
    gc.fillStyle = gg;
    gc.fillRect(0, 0, 64, 64);

    /* ── 7a) seamless nebula cloud tile: each blob is also drawn at the oxi/oyi wrapped offsets ── */
    const nebula = makeCanvas(NEBULA_TILE);
    const nc = nebula.getContext('2d');
    // opaque base (midpoint of the theme's two background colours): the tile then covers the
    // screen on its own, with no gradient pass and no alpha blending
    nc.fillStyle = theme.bg1;
    nc.fillRect(0, 0, NEBULA_TILE, NEBULA_TILE);
    nc.globalAlpha = 0.5;
    nc.fillStyle = theme.bg2;
    nc.fillRect(0, 0, NEBULA_TILE, NEBULA_TILE);
    nc.globalAlpha = 1;
    for (let i = 0; i < 70; ++i) {
      const x = Math.random() * NEBULA_TILE;
      const y = Math.random() * NEBULA_TILE;
      const r = 60 + Math.random() * 200;
      const col = theme.cloud[i % theme.cloud.length];
      const alpha = 0.10 + Math.random() * 0.12;
      for (let oyi = -1; oyi <= 1; ++oyi)
        for (let oxi = -1; oxi <= 1; ++oxi) {
          const ox = oxi * NEBULA_TILE;
          const oy = oyi * NEBULA_TILE;
          const g = nc.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          g.addColorStop(0, rgba(col, alpha));
          g.addColorStop(1, rgba(col, 0));
          nc.fillStyle = g;
          nc.beginPath();
          nc.arc(x + ox, y + oy, r, 0, TWO_PI);
          nc.fill();
        }
    }

    /* ── 7b) seamless star tile ── */
    const stars = makeCanvas(STAR_TILE);
    const sc = stars.getContext('2d');
    const pale = ['#ffffff'].concat(theme.cloud);
    const starDots = [];
    for (let i = 0; i < 260; ++i) {
      sc.globalAlpha = 0.3 + Math.random() * 0.7;
      sc.fillStyle = pale[i % pale.length];
      const s = i & 1 ? 1 : 2;
      const sx = Math.random() * STAR_TILE;
      const sy = Math.random() * STAR_TILE;
      sc.fillRect(sx, sy, s, s);
      starDots.push({ x: sx, y: sy, s: s, color: pale[i % pale.length], alpha: sc.globalAlpha });
    }
    sc.globalAlpha = 0.9;
    sc.strokeStyle = '#ffffff';
    sc.lineWidth = 1;
    for (let i = 0; i < 6; ++i) {
      const x = Math.random() * STAR_TILE;
      const y = Math.random() * STAR_TILE;
      sc.beginPath();
      sc.moveTo(x - 3, y);
      sc.lineTo(x + 3, y);
      sc.moveTo(x, y - 3);
      sc.lineTo(x, y + 3);
      sc.stroke();
    }
    sc.globalAlpha = 1;

    // star dots grouped by colour + alpha bucket: drawn as tiny rects, far cheaper than a full-screen image
    const dotGroups = [];
    (function () {
      const map = {};
      for (let i = 0; i < starDots.length; ++i) {
        const d = starDots[i];
        const bucket = Math.round(d.alpha * 4) / 4;
        const key = d.color + '|' + bucket;
        if (!map[key]) {
          map[key] = { style: rgba(d.color, bucket), pts: [] };
          dotGroups.push(map[key]);
        }
        map[key].pts.push(d.x, d.y, d.s);
      }
    })();

    /* ── 8) the distant planet ── */
    const planet = makeCanvas(PLANET_SIZE);
    const pc = planet.getContext('2d');
    const cx = PLANET_SIZE / 2;
    const cy = PLANET_SIZE / 2;
    const pg = pc.createRadialGradient(cx - 110, cy - 110, 30, cx, cy, PLANET_RADIUS);
    pg.addColorStop(0, theme.planet);
    pg.addColorStop(0.5, shade(theme.planet, -0.3));
    pg.addColorStop(1, shade(theme.planet, -0.93));
    pc.fillStyle = pg;
    pc.beginPath();
    pc.arc(cx, cy, PLANET_RADIUS, 0, TWO_PI);
    pc.fill();
    pc.save();
    pc.beginPath();
    pc.arc(cx, cy, PLANET_RADIUS, 0, TWO_PI);
    pc.clip();
    pc.globalAlpha = 0.03;
    const bandFade = pc.createRadialGradient(cx, cy, PLANET_RADIUS * 0.15, cx, cy, PLANET_RADIUS);
    bandFade.addColorStop(0, shade(theme.planet, 0.7));
    bandFade.addColorStop(1, rgba(theme.planet, 0));
    pc.fillStyle = bandFade;
    for (let b = 0; b < 6; ++b) {
      const by = cy - PLANET_RADIUS + (b + 0.5) * (PLANET_RADIUS * 2 / 6);
      pc.fillRect(cx - PLANET_RADIUS, by - 16, PLANET_RADIUS * 2, 32);
    }
    pc.restore();
    pc.globalAlpha = 0.35;
    pc.strokeStyle = theme.glow;
    pc.lineWidth = 3;
    pc.beginPath();
    pc.arc(cx, cy, PLANET_RADIUS + 3, 0, TWO_PI);
    pc.stroke();
    pc.globalAlpha = 1;

    /* ── Background drawing (screen space) ── */
    function tile(c, img, size, dx, dy, viewW, viewH) {
      const ox = ((dx % size) + size) % size;
      const oy = ((dy % size) + size) % size;
      for (let y = -oy; y < viewH; y += size)
        for (let x = -ox; x < viewW; x += size)
          c.drawImage(img, x, y);
    }

    /* Seamlessly tiled star dots; k scales the tile (0.75 = the farther, denser layer) */
    function drawDots(c, k, dx, dy, viewW, viewH, alpha) {
      const size = STAR_TILE * k;
      const ox = ((dx % size) + size) % size;
      const oy = ((dy % size) + size) % size;
      c.globalAlpha = alpha;
      for (let g = 0; g < dotGroups.length; ++g) {
        const pts = dotGroups[g].pts;
        c.fillStyle = dotGroups[g].style;
        for (let ty = -oy; ty < viewH; ty += size)
          for (let tx = -ox; tx < viewW; tx += size)
            for (let i = 0; i < pts.length; i += 3) {
              const s = pts[i + 2] * (k < 1 ? 0.75 : 1);
              c.fillRect(tx + pts[i] * k, ty + pts[i + 1] * k, s, s);
            }
      }
      c.globalAlpha = 1;
    }

    function drawBackground(c, camX, camY, zoom, time, viewW, viewH) {
      c.globalAlpha = 1;
      tile(c, nebula, NEBULA_TILE, -camX * 0.08, -camY * 0.08, viewW, viewH);
      c.globalAlpha = 0.85;
      c.drawImage(planet, viewW * 0.78 - PLANET_SIZE / 2 - camX * 0.02, viewH * 0.28 - PLANET_SIZE / 2 - camY * 0.02);
      c.globalAlpha = 1;
      drawDots(c, 1, -camX * 0.15, -camY * 0.15, viewW, viewH, 1);
      drawDots(c, 0.75, -camX * 0.3, -camY * 0.3, viewW, viewH, 0.6);
    }

    /* ── Road drawing (world space) ── */
    let pattern = null;

    function traceClosed(c, pts) {
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < n; ++i)
        c.lineTo(pts[i].x, pts[i].y);
      c.closePath();
    }

    function traceRun(c, pts, run) {
      c.beginPath();
      for (let k = 0; k < run.count; ++k) {
        const p = pts[(run.from + k) % n];
        if (k === 0) c.moveTo(p.x, p.y);
        else c.lineTo(p.x, p.y);
      }
    }

    function drawRoad(c, time) {
      c.lineJoin = 'round';
      c.lineCap = 'round';

      /* outer glow, two passes */
      traceClosed(c, points);
      c.strokeStyle = theme.glow;
      c.lineWidth = geo.width + 46;
      c.globalAlpha = 0.10;
      c.stroke();
      c.lineWidth = geo.width + 20;
      c.globalAlpha = 0.16;
      c.stroke();

      /* asphalt */
      if (!pattern) pattern = c.createPattern(tex, 'repeat');
      traceClosed(c, points);
      c.strokeStyle = pattern || theme.road;
      c.lineWidth = geo.width;
      c.globalAlpha = 1;
      c.stroke();

      /* inner shading */
      traceClosed(c, points);
      c.strokeStyle = 'rgba(255,255,255,0.025)';
      c.lineWidth = geo.width - 40;
      c.stroke();

      /* kerbs on the bends: two dashed strokes offset by half a dash */
      c.lineWidth = 12;
      c.setLineDash([22, 22]);
      for (let r = 0; r < runs.length; ++r) {
        const run = runs[r];
        if (run.count < 2) continue;
        traceRun(c, left, run);
        c.strokeStyle = theme.kerbA;
        c.lineDashOffset = 0;
        c.stroke();
        c.strokeStyle = theme.kerbB;
        c.lineDashOffset = 22;
        c.stroke();
        traceRun(c, right, run);
        c.strokeStyle = theme.kerbA;
        c.lineDashOffset = 0;
        c.stroke();
        c.strokeStyle = theme.kerbB;
        c.lineDashOffset = 22;
        c.stroke();
      }
      c.setLineDash([]);
      c.lineDashOffset = 0;

      /* edge lines */
      c.strokeStyle = theme.edge;
      c.lineWidth = 3;
      c.globalAlpha = 0.9;
      traceClosed(c, left);
      c.stroke();
      traceClosed(c, right);
      c.stroke();
      c.globalAlpha = 1;

      /* center line */
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 3;
      c.setLineDash([40, 50]);
      traceClosed(c, points);
      c.stroke();
      c.setLineDash([]);

      /* edge lights */
      for (let i = 0; i < lights.length; ++i) {
        const l = lights[i];
        const alpha = 0.55 + 0.45 * Math.sin(time * 3 + l.phase * 0.8);
        c.globalAlpha = alpha * 0.8;
        c.drawImage(glow, l.x - 17, l.y - 17, 34, 34);
        c.globalAlpha = alpha;
        c.fillStyle = '#ffffff';
        c.fillRect(l.x - 2, l.y - 2, 4, 4);
      }

      /* direction chevrons, flashing along the bend */
      c.strokeStyle = theme.edge;
      c.lineWidth = 6;
      for (let i = 0; i < chevrons.length; ++i) {
        const ch = chevrons[i];
        c.globalAlpha = 0.55 + 0.45 * Math.sin(time * 6 - ch.k);
        c.save();
        c.translate(ch.x, ch.y);
        c.rotate(ch.angle);
        c.beginPath();
        c.moveTo(-11, -11);
        c.lineTo(11, 0);
        c.lineTo(-11, 11);
        c.stroke();
        c.restore();
      }

      /* start/finish band */
      const p0 = geo.sampleAt(0);
      const cell = geo.width / 10;
      c.save();
      c.translate(p0.x, p0.y);
      c.rotate(p0.angle);
      for (let row = 0; row < 2; ++row) {
        for (let col = 0; col < 10; ++col) {
          c.fillStyle = (row + col) % 2 ? '#111111' : '#ffffff';
          c.fillRect(-14 + row * 14, -half + col * cell, 14, cell);
        }
      }
      c.restore();

      /* start grid boxes behind the line */
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2;
      c.globalAlpha = 0.5;
      for (let k = 0; k < 4; ++k) {
        const q = geo.sampleAt(-90 - Math.floor(k / 2) * 110);
        const lat = (k % 2 ? -1 : 1) * geo.width * 0.22;
        c.save();
        c.translate(q.x + q.nx * lat, q.y + q.ny * lat);
        c.rotate(q.angle);
        c.strokeRect(-17, -11, 34, 22);
        c.restore();
      }

      c.globalAlpha = 1;
      c.setLineDash([]);
      c.lineDashOffset = 0;
    }

    return Object.freeze({
      drawBackground: drawBackground,
      drawRoad: drawRoad,
      stats: Object.freeze({
        lights: lights.length,
        chevronGroups: chevronGroups.length,
        bendRuns: runs.length
      })
    });
  }

  SZ.RacingTrackArt = Object.freeze({ create });
})();
