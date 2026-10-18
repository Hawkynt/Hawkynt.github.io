/* render/tower-art.js -- tower bases, rotating heads, traps and mines, cached per tier and branch, and tower icons for the UI.
   Reads: constants, towerTypes, env, pixelArt, artKit and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, TWO_PI, parseHex } = NS.constants;
  const { TOWER_TYPES } = NS.towerTypes;
  const { ctx } = NS.env;
  const { pixelArt } = NS.pixelArt;
  const { AP, RAMPS, rampOf, px, block, disc, ellipseFill, poly, line, drawGlow, drawShadow, blitArt } = NS.artKit;

  /* ══════════════════════════════════════════════════════════════════
     TOWER ART -- a base that grows with every tier (wood, stone, gold
     trim, family stone, crowned) and a head per family and branch.
     Rotating heads are pre-rendered at 16 angles.
     ══════════════════════════════════════════════════════════════════ */

  const HEAD_ANGLES = 16;
  const ROTATING = { arrow: 1, cannon: 1, flame: 1, laser: 1, sniper: 1, mortar: 1, missile: 1 };
  // Tower body height (art px above the tile's top face) per tier
  const BASE_HEIGHT = [0, 1, 2, 3, 4, 5];

  function familyRamp(def) {
    return rampOf(def.color);
  }

  function mixRamp(ramp, hex, t) {
    const [r2, g2, b2] = parseHex(hex);
    return ramp.map(c => {
      const [r, g, b] = parseHex(c.slice(0, 7));
      const m = (a, b) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
      return '#' + m(r, r2 * (0.4 + (r / 255) * 0.8)) + m(g, g2 * (0.4 + (g / 255) * 0.8)) + m(b, b2 * (0.4 + (b / 255) * 0.8));
    });
  }

  // Base: a 3/4 view tower with a top platform; returns the canvas.
  // The tile footprint is the bottom 16 x 16 of the sprite (2px margin each side).
  //   I wooden scaffold, II stone, III stone with gold trim and a family banner,
  //   IV/V family stone: branch A a slender spire, branch B a heavy bastion
  function buildBase(def, tier, branch) {
    const H = BASE_HEIGHT[tier];
    const W = 20, Ht = 16 + H + 4 + (tier >= 4 && branch === 0 ? 3 : 0);
    const fam = familyRamp(def);
    const round = def.id === 'frost' || def.id === 'tesla' || def.id === 'laser';
    return pixelArt(W, Ht, (g) => {
      const top = 4 + (tier >= 4 && branch === 0 ? 3 : 0);
      const bodyY = top + 8;
      const bodyH = Ht - 4 - bodyY + 1;
      const mat = tier === 1 ? RAMPS.wood : tier <= 3 ? RAMPS.stone : mixRamp(branch === 1 ? RAMPS.metal : RAMPS.stone, def.color, 0.32);
      const gold = RAMPS.gold;
      // Foundation shadow / foot
      ellipseFill(g, 10, Ht - 4, 9, 3.5, mat[1]);
      if (tier === 1) {
        // Wooden scaffold: four posts and cross bracing
        px(g, 3, bodyY, 2, bodyH, mat[1]); px(g, 15, bodyY, 2, bodyH, mat[1]);
        px(g, 7, bodyY, 2, bodyH - 1, mat[2]); px(g, 11, bodyY, 2, bodyH - 1, mat[2]);
        line(g, 4, bodyY + 1, 16, bodyY + bodyH - 1, mat[3], 1);
        line(g, 16, bodyY + 1, 4, bodyY + bodyH - 1, mat[2], 1);
        px(g, 3, bodyY + Math.floor(bodyH / 2), 14, 1, mat[4]);
      } else if (round) {
        px(g, 3, bodyY, 14, bodyH, mat[2]);
        px(g, 3, bodyY, 2, bodyH, mat[3]);
        px(g, 15, bodyY, 2, bodyH, mat[1]);
        ellipseFill(g, 10, bodyY + bodyH, 7, 2.5, mat[2]);
        for (let y = bodyY + 2; y < bodyY + bodyH; y += 3) px(g, 4, y, 12, 1, mat[1]);
      } else {
        px(g, 2, bodyY, 16, bodyH, mat[2]);
        px(g, 2, bodyY, 1, bodyH, mat[3]);
        px(g, 17, bodyY, 1, bodyH, mat[1]);
        for (let y = bodyY + 2; y < bodyY + bodyH; y += 3) {
          px(g, 3, y, 14, 1, mat[1]);
          for (let x = 4 + ((y / 3) % 2 ? 0 : 2); x < 17; x += 4) px(g, x, y - 2, 1, 2, mat[1]);
        }
      }
      // Bastion buttresses / spire pillars
      if (tier >= 4 && branch === 1) {
        block(g, 0, bodyY + 2, 3, bodyH - 2, mat, 3);
        block(g, 17, bodyY + 2, 3, bodyH - 2, mat, 2);
        px(g, 0, bodyY + 2, 3, 1, gold[4]); px(g, 17, bodyY + 2, 3, 1, gold[4]);
      }
      if (tier >= 4 && branch === 0) {
        block(g, 1, top - 1, 3, bodyH + 9, mat, 3);
        block(g, 16, top - 1, 3, bodyH + 9, mat, 2);
        poly(g, [1, top - 1, 2.5, top - 6, 4, top - 1], fam[3]);
        poly(g, [16, top - 1, 17.5, top - 6, 19, top - 1], fam[3]);
      }
      // Trim and banner from tier III
      if (tier >= 3) {
        const x0 = round ? 3 : 2, w0 = round ? 14 : 16;
        px(g, x0, bodyY, w0, 1, gold[3]);
        px(g, x0, bodyY + bodyH - 2, w0, 1, gold[2]);
        const bh = Math.max(4, bodyH - 4);
        poly(g, [8, bodyY + 1, 12, bodyY + 1, 12, bodyY + bh, 10, bodyY + bh - 2, 8, bodyY + bh], fam[2]);
        px(g, 8, bodyY + 1, 1, bh - 1, fam[3]);
        px(g, 9, bodyY + 3, 2, 2, tier >= 4 ? gold[4] : fam[4]);
      }
      if (tier >= 4)
        for (const gx of [4, 15]) { px(g, gx, bodyY + 3, 1, 2, fam[5]); px(g, gx, bodyY + 3, 1, 1, '#ffffff'); }
      // Platform (top face)
      const pm = mat;
      if (round) {
        ellipseFill(g, 10, top + 6, 8, 5, pm[1]);
        ellipseFill(g, 10, top + 5, 8, 4.5, pm[3]);
        ellipseFill(g, 10, top + 5, 5.5, 3, pm[2]);
      } else {
        px(g, 1, top + 1, 18, 9, pm[1]);
        px(g, 1, top, 18, 8, pm[3]);
        px(g, 3, top + 2, 14, 5, pm[2]);
        if (tier === 1) for (let x = 3; x < 17; x += 3) px(g, x, top + 1, 1, 7, pm[1]);
      }
      // Battlements
      if (tier >= 2 && !round) {
        const cap = tier >= 3 ? gold : pm;
        for (const bx of [1, 6, 11, 16]) {
          px(g, bx, top - 2, 3, 3, pm[3]);
          px(g, bx, top - 2, 3, 1, cap[4]);
        }
      }
      if (tier >= 2 && round) {
        const cap = tier >= 3 ? gold : pm;
        px(g, 2, top + 4, 16, 1, cap[4]);
        px(g, 4, top + 9, 12, 1, cap[2]);
      }
      if (tier === 1) {
        // Railing posts
        px(g, 1, top - 1, 1, 3, RAMPS.wood[4]); px(g, 18, top - 1, 1, 3, RAMPS.wood[4]);
      }
      // Crown points and flags on mastered towers
      if (tier >= 5) {
        for (const bx of [3, 9, 15]) poly(g, [bx, top - 2, bx + 1, top - 6, bx + 2, top - 2], gold[4]);
        px(g, 9, top - 4, 1, 1, '#ffffff');
      }
    });
  }

  /* ── Heads ── drawn pointing right around (cx, cy) */
  const HEADS = {
    arrow(g, tier, branch, fam) {
      const wood = tier >= 4 && branch === 0 ? ['#2a4a2a', '#3a6a3a', '#5a8a4a', '#8ab86a', '#c4e8a0', '#eaffd8'] : RAMPS.wood;
      const metal = tier >= 3 ? RAMPS.gold : RAMPS.metal;
      if (tier >= 4 && branch === 1) {
        // Volley: three bolts on a wide frame
        px(g, -4, -6, 6, 12, RAMPS.wood[2]); px(g, -4, -6, 6, 1, RAMPS.wood[4]);
        for (const dy of [-4, 0, 4]) {
          px(g, -2, dy - 0.5, 10, 1, RAMPS.wood[4]);
          px(g, 8, dy - 1, 2, 2, metal[4]);
        }
        line(g, 2, -8, 2, 8, metal[3], 1.5);
        if (tier >= 5) { px(g, -5, -1, 2, 2, fam[4]); }
        return;
      }
      const len = tier >= 4 ? 11 : 7 + tier;
      px(g, -5, -1.5, len, 3, wood[2]); px(g, -5, -1.5, len, 1, wood[4]);
      const span = tier >= 4 ? 9 : 5 + tier;
      g.strokeStyle = wood[3];
      g.lineWidth = 2;
      g.beginPath(); g.arc(-2, 0, span, -1.0, 1.0); g.stroke();
      line(g, -2 + span * Math.cos(1.0), -span * Math.sin(1.0), -2 + span * Math.cos(1.0), span * Math.sin(1.0), '#e8e2d4', 0.8);
      px(g, len - 6, -1, 3, 2, metal[4]);
      poly(g, [len - 3, -2.5, len + 1, 0, len - 3, 2.5], metal[3]);
      if (tier >= 4) { px(g, -4, -0.5, 2, 1, fam[5]); }
    },
    cannon(g, tier, branch, fam) {
      const barrel = tier >= 3 ? ['#3a2008', '#6a400e', '#9a6418', '#c8902a', '#ecbc4a', '#fff0a0'] : RAMPS.iron;
      if (tier >= 4 && branch === 0) {
        // Mortar: short fat tube
        disc(g, 0, 0, 6.5, RAMPS.iron, 3);
        px(g, -1, -5, 9, 10, barrel[2]); px(g, -1, -5, 9, 2, barrel[4]);
        ellipseFill(g, 8, 0, 2.5, 5, barrel[1]); ellipseFill(g, 8, 0, 1.5, 3.5, '#0a0a0a');
        if (tier >= 5) px(g, 2, -5, 1, 10, fam[4]);
        return;
      }
      disc(g, -1, 0, 5, RAMPS.wood, 2);
      const twin = tier >= 4 && branch === 1;
      for (const dy of twin ? [-2.6, 2.6] : [0]) {
        const len = 8 + Math.min(tier, 3) * 1.5;
        const w = twin ? 3.2 : 4 + (tier >= 2 ? 1 : 0);
        px(g, -2, dy - w / 2, len, w, barrel[2]);
        px(g, -2, dy - w / 2, len, 1, barrel[4]);
        px(g, len - 3, dy - w / 2 - 0.8, 2, w + 1.6, barrel[3]);
        px(g, len - 1, dy - w / 2 + 0.6, 1, w - 1.2, '#0a0a0a');
      }
      if (twin) { px(g, 0, -1, 2, 2, fam[4]); for (let i = 0; i < 3; ++i) px(g, -4 + i * 3, 4.5, 1, 2, RAMPS.metal[4]); }
      if (tier >= 2) px(g, 1, -0.5, 2, 1, barrel[5]);
    },
    flame(g, tier, branch, fam) {
      const tank = tier >= 4 && branch === 0 ? ['#3a0a04', '#6a1808', '#a0280a', '#e0500e', '#ff8a2a', '#ffd06a'] : RAMPS.brick;
      if (tier >= 4 && branch === 1) {
        // Dragon head nozzle
        poly(g, [-5, -4, 4, -4, 10, -1.5, 10, 1.5, 4, 4, -5, 4], fam[2]);
        poly(g, [-5, -4, 4, -4, 10, -1.5, 4, -1.5], fam[4]);
        px(g, 3, -3, 2, 1, '#ffe14a');
        poly(g, [-3, -4, -6, -7, -1, -4], fam[1]); poly(g, [-3, 4, -6, 7, -1, 4], fam[1]);
        px(g, 9, -0.5, 2, 1, '#2a0a04');
        if (tier >= 5) { px(g, -2, -1, 2, 2, '#ffe14a'); }
        return;
      }
      disc(g, -2, 0, 5, tank, 3);
      const len = 7 + Math.min(tier, 3) * 1.5;
      px(g, 0, -1.5, len, 3, RAMPS.metal[3]); px(g, 0, -1.5, len, 1, RAMPS.metal[5]);
      px(g, len - 1, -2.5, 2, 5, RAMPS.metal[2]);
      if (tier >= 3) for (let i = 2; i < len - 2; i += 2) px(g, i, -2.5, 1, 5, RAMPS.gold[3]);
      if (tier >= 4) disc(g, -2, 0, 3, ['#4a0a00', '#8a1a00', '#ff4a00', '#ffa020', '#ffe080', '#ffffff'], 3);
    },
    laser(g, tier, branch, fam) {
      if (tier >= 4 && branch === 0) {
        // Prism
        poly(g, [-5, -6, 6, 0, -5, 6], fam[2]);
        poly(g, [-5, -6, 6, 0, -1, 0], fam[4]);
        poly(g, [-5, 6, 6, 0, -1, 0], fam[1]);
        px(g, -1, -1, 2, 2, '#ffffff');
        if (tier >= 5) for (const a of [-2.2, 2.2, 0]) px(g, Math.cos(a) * 7 - 1, Math.sin(a) * 7 - 1, 2, 2, fam[5]);
        return;
      }
      if (tier >= 4 && branch === 1) {
        // Solar lance: mirror dish
        g.fillStyle = RAMPS.gold[2];
        g.beginPath(); g.arc(-3, 0, 7, -1.2, 1.2); g.lineTo(-3, 0); g.fill();
        g.fillStyle = RAMPS.gold[4];
        g.beginPath(); g.arc(-3, 0, 5, -1.1, 1.1); g.lineTo(-3, 0); g.fill();
        px(g, -3, -0.5, 10, 1, RAMPS.metal[4]);
        disc(g, 7, 0, 2, ['#5a3a00', '#a06a00', '#ffb000', '#ffe060', '#fff6c0', '#ffffff'], 3);
        return;
      }
      disc(g, -2, 0, 4.5, RAMPS.metal, 3);
      const len = 6 + Math.min(tier, 3) * 1.5;
      px(g, 0, -1.5, len, 3, RAMPS.metal[2]); px(g, 0, -1.5, len, 1, RAMPS.metal[4]);
      px(g, len - 1, -2, 2, 4, tier >= 3 ? RAMPS.gold[3] : RAMPS.metal[3]);
      disc(g, -2, 0, 2.2, fam, 3);
    },
    sniper(g, tier, branch, fam) {
      if (tier >= 4 && branch === 0) {
        // Railgun: twin rails with a glowing core
        px(g, -6, -3.5, 8, 7, RAMPS.metal[2]); px(g, -6, -3.5, 8, 1, RAMPS.metal[4]);
        px(g, 0, -3, 13, 2, RAMPS.metal[3]); px(g, 0, 1, 13, 2, RAMPS.metal[3]);
        px(g, 1, -1, 11, 2, '#7ad8ff');
        if (tier >= 5) px(g, -4, -1, 3, 2, '#ffffff');
        return;
      }
      const dark = tier >= 4 && branch === 1;
      const body = dark ? ['#08080c', '#121218', '#1e1e28', '#2c2c3a', '#404052', '#5a5a70'] : RAMPS.metal;
      px(g, -6, -2, 6, 4, dark ? body[3] : RAMPS.wood[2]);
      const len = 10 + Math.min(tier, 3) * 1.5 + (dark ? 2 : 0);
      px(g, -1, -1, len, 2, body[2]); px(g, -1, -1, len, 1, body[4]);
      px(g, 1, -3, 5, 2, body[3]); px(g, 1, -3, 1, 2, dark ? '#ff3a3a' : '#7ad8ff');
      if (tier >= 3) px(g, len - 3, -1.5, 2, 3, RAMPS.gold[3]);
      if (dark) px(g, len - 2, -1.5, 3, 3, body[1]);
    }
  };

  HEADS.mortar = function (g, tier, branch, fam) {
    const iron = tier >= 3 ? ['#3a2008', '#6a400e', '#9a6418', '#c8902a', '#ecbc4a', '#fff0a0'] : RAMPS.iron;
    disc(g, -1, 0, 6, RAMPS.wood, 2);
    const tubes = tier >= 4 && branch === 0 ? [-3.5, 0, 3.5] : [0];
    for (const dy of tubes) {
      const w = tubes.length > 1 ? 3.4 : 6 + Math.min(tier, 3) * 0.5;
      px(g, -1, dy - w / 2, 7, w, iron[2]);
      px(g, -1, dy - w / 2, 7, 1, iron[4]);
      ellipseFill(g, 6.5, dy, 1.6, w / 2 + 0.6, iron[1]);
      ellipseFill(g, 6.8, dy, 0.9, w / 2 - 0.6, '#0a0a0a');
    }
    if (tier >= 4 && branch === 1) { px(g, 0, -1, 5, 2, '#ff6a14'); px(g, 1, -0.5, 3, 1, '#ffe48a'); }
    if (tier >= 2) px(g, -4, -1, 2, 2, iron[5]);
  };
  HEADS.missile = function (g, tier, branch, fam) {
    const m = RAMPS.metal;
    const cells = tier >= 4 && branch === 0 ? 6 : tier >= 4 ? 1 : 2;
    px(g, -6, -5, 11, 10, m[2]); px(g, -6, -5, 11, 1, m[4]); px(g, -6, 4, 11, 1, m[1]);
    if (cells === 1) {
      px(g, -2, -2, 13, 4, '#d8d8e0'); poly(g, [11, -2, 15, 0, 11, 2], '#ff4a3a'); px(g, -2, -3, 3, 6, m[3]);
    } else {
      const rows = cells === 6 ? 3 : 2, cols = cells === 6 ? 2 : 1;
      for (let r = 0; r < rows; ++r)
        for (let c = 0; c < cols; ++c) {
          const yy = -4 + r * (8 / rows) + 0.5, xx = 2 + c * 3;
          px(g, xx, yy, 4, 8 / rows - 1, '#1a1a20');
          px(g, xx + 3, yy + 0.5, 2, 8 / rows - 2, '#ff4a3a');
        }
    }
    if (tier >= 3) px(g, -6, -1, 2, 2, RAMPS.gold[4]);
    if (tier >= 2) px(g, -5, -6, 6, 1, fam[3]);
  };

  // Static heads (not rotating) of the other families
  const STATIC_HEADS = {
    storm(g, tier, branch, fam) {
      const m = RAMPS.metal;
      px(g, -1, -9, 2, 13, m[3]); px(g, -1, -9, 1, 13, m[5]);
      for (let i = 0; i < Math.min(tier, 3); ++i) px(g, -3 + i * 0.5, -1 - i * 3, 6 - i, 1, RAMPS.gold[3]);
      if (tier >= 4 && branch === 0) {
        ellipseFill(g, 0, -11, 7, 3.5, '#4a4a6a'); ellipseFill(g, -2, -12, 4, 2.5, '#6a6a8a'); ellipseFill(g, 3, -12, 3, 2, '#5a5a7a');
      } else
        disc(g, 0, -10, 2.5 + (tier >= 4 ? 1 : 0), fam, 3);
      if (tier >= 4 && branch === 1) { g.strokeStyle = fam[5]; g.lineWidth = 1; g.beginPath(); g.ellipse(0, -2, 6, 2, 0, 0, TWO_PI); g.stroke(); }
    },
    wind(g, tier, branch, fam) {
      const w = RAMPS.wood;
      px(g, -1.5, -6, 3, 9, tier >= 2 ? RAMPS.stone[3] : w[3]);
      disc(g, 0, -7, 2.5, tier >= 3 ? RAMPS.gold : RAMPS.metal, 3);
      if (tier >= 4) { px(g, -4, 0, 8, 2, fam[3]); }
    },
    beacon(g, tier, branch, fam) {
      const s = tier >= 3 ? RAMPS.gold : RAMPS.stone;
      poly(g, [-5, -2, 5, -2, 3, 3, -3, 3], s[2]);
      px(g, -5, -3, 10, 2, s[4]);
      if (branch === 0 && tier >= 4) { ellipseFill(g, 0, -4, 5, 3, '#8a3a1a'); px(g, -4, -5, 8, 1, '#e8c890'); }
      if (branch === 1 && tier >= 4) disc(g, 0, -8, 3, ['#203a5a', '#2a5a8a', '#4a8ac8', '#7ab8ff', '#c8e8ff', '#ffffff'], 3);
      px(g, -0.5, 3, 1, 3, s[1]);
    },
    arcane(g, tier, branch, fam) {
      poly(g, [-4, 2, 4, 2, 2, 5, -2, 5], RAMPS.stone[3]);
      const r = 2.6 + Math.min(tier, 4) * 0.5;
      disc(g, 0, -5, r, fam, 3);
      px(g, -1, -6.5, 1, 2, '#ffffff');
      if (tier >= 4 && branch === 0) { poly(g, [0, -5 - r - 4, 1.5, -5 - r, -1.5, -5 - r], fam[5]); }
      if (tier >= 4 && branch === 1) for (const a of [0.5, 2.6, 4.7]) px(g, Math.cos(a) * (r + 3) - 0.5, -5 + Math.sin(a) * (r + 3) - 0.5, 1.5, 1.5, fam[4]);
    },
    frost(g, tier, branch, fam) {
      const ice = RAMPS.ice;
      if (tier >= 4 && branch === 1) {
        disc(g, 0, 0, 6, ice, 3);
        g.strokeStyle = ice[5]; g.lineWidth = 1;
        g.beginPath(); g.ellipse(0, 1, 9, 3, 0, 0, TWO_PI); g.stroke();
        px(g, -2, -3, 2, 2, '#ffffff');
        return;
      }
      const big = tier >= 4 ? 1.35 : 0.75 + tier * 0.12;
      poly(g, [0, -9 * big, 4 * big, -2, 0, 6 * big, -4 * big, -2], ice[3]);
      poly(g, [0, -9 * big, 0, 6 * big, -4 * big, -2], ice[4]);
      px(g, -1, -5 * big, 1, 4, '#ffffff');
      if (tier >= 2) { poly(g, [-6, 2, -4, -3, -3, 3], ice[2]); poly(g, [6, 2, 4, -3, 3, 3], ice[2]); }
      if (tier >= 4) { poly(g, [-7, -4, -5, -8, -4, -3], ice[4]); poly(g, [7, -4, 5, -8, 4, -3], ice[4]); }
    },
    tesla(g, tier, branch, fam) {
      const cu = ['#3a1a08', '#6a3010', '#9a4c1c', '#c8702e', '#e8984a', '#ffc884'];
      if (tier >= 4 && branch === 0) {
        for (const dx of [-5, 0, 5]) {
          px(g, dx - 1, -6 + (dx === 0 ? -3 : 0), 2, 12, RAMPS.metal[3]);
          disc(g, dx, -7 + (dx === 0 ? -3 : 0), 2, fam, 3);
        }
        return;
      }
      const h = 6 + Math.min(tier, 4) * 1.5;
      px(g, -1.5, -h + 4, 3, h, RAMPS.metal[3]);
      for (let i = 0; i < Math.min(tier, 3) + 1; ++i) ellipseFill(g, 0, 2 - i * 3, 4 - i * 0.4, 1.2, cu[3 + (i % 2)]);
      const r = tier >= 4 ? 4.5 : 2.5 + tier * 0.4;
      disc(g, 0, -h + 3, r, tier >= 4 ? fam : RAMPS.metal, 3);
      if (tier >= 4) { g.strokeStyle = RAMPS.gold[3]; g.lineWidth = 1; g.strokeRect(-r, -h + 3 - r, r * 2, r * 2); }
    },
    poison(g, tier, branch, fam) {
      const pot = tier >= 4 && branch === 0 ? RAMPS.iron : tier >= 4 ? ['#203028', '#2e4a3a', '#3e6a50', '#5a9070', '#8ac0a0', '#c8f0d8'] : RAMPS.iron;
      const w = 6 + Math.min(tier, 3) * 0.6;
      ellipseFill(g, 0, 1, w, 5, pot[2]);
      ellipseFill(g, -1.5, 0, w - 2, 3.5, pot[3]);
      ellipseFill(g, 0, -3, w - 0.5, 2, '#22501a');
      ellipseFill(g, 0, -3.2, w - 1.5, 1.4, tier >= 4 && branch === 1 ? '#c8ff4a' : '#7ce35a');
      if (tier >= 2) { px(g, -w - 1, -3, 2, 3, pot[1]); px(g, w - 1, -3, 2, 3, pot[1]); }
      if (tier >= 4 && branch === 0) { px(g, -2, 1, 4, 3, '#e8e2d4'); px(g, -1, 2, 1, 1, '#000'); px(g, 1, 2, 1, 1, '#000'); }
      if (tier >= 3) px(g, -w + 1, 3, w * 2 - 2, 1, RAMPS.gold[3]);
    }
  };

  const towerArtCache = {};

  function towerArt(typeIndex, tier, branch) {
    const key = typeIndex + ':' + tier + ':' + branch;
    let a = towerArtCache[key];
    if (a) return a;
    const def = TOWER_TYPES[typeIndex];
    const fam = familyRamp(def);
    a = { base: null, heads: null, head: null, lift: 0, kind: 'tower' };
    if (def.trap) {
      a.kind = 'trap';
      a.base = buildTrap(def, tier, branch);
    } else if (def.kind === 'mine') {
      a.kind = 'mine';
      a.base = buildMine(def, tier, branch);
    } else {
      a.base = buildBase(def, tier, branch);
      a.lift = a.base.height - 10;   // platform centre above the sprite bottom (art px)
      if (ROTATING[def.id]) {
        a.heads = [];
        for (let i = 0; i < HEAD_ANGLES; ++i) {
          const ang = (i / HEAD_ANGLES) * TWO_PI;
          a.heads.push(pixelArt(26, 26, (g) => {
            g.translate(13, 13);
            g.rotate(ang);
            const k = 1 + (tier - 1) * 0.07;
            g.scale(k, k);
            HEADS[def.id](g, tier, branch, fam);
          }));
        }
      } else if (STATIC_HEADS[def.id]) {
        a.head = pixelArt(22, 22, (g) => {
          g.translate(11, 13);
          const k = 1 + (tier - 1) * 0.06;
          g.scale(k, k);
          STATIC_HEADS[def.id](g, tier, branch, fam);
        });
      }
    }
    towerArtCache[key] = a;
    return a;
  }

  function buildTrap(def, tier, branch) {
    return pixelArt(16, 16, (g) => {
      if (tier >= 4 && branch === 0) {
        ellipseFill(g, 8, 8, 7.5, 6.5, '#0a0806');
        ellipseFill(g, 7, 7, 5.5, 4.5, '#1e1810');
        px(g, 4, 5, 3, 1, '#3a3020'); px(g, 9, 9, 2, 1, '#3a3020');
        return;
      }
      const plate = tier === 1 ? RAMPS.wood : RAMPS.metal;
      px(g, 1, 2, 14, 12, plate[1]); px(g, 1, 2, 14, 1, plate[3]);
      if (tier >= 4) {
        // Razor: two saw blades in slots
        px(g, 2, 5, 12, 2, '#0a0a0a'); px(g, 2, 10, 12, 2, '#0a0a0a');
        return;
      }
      const n = tier === 1 ? 2 : 3;
      for (let i = 0; i < n; ++i)
        for (let j = 0; j < n; ++j) {
          const x = 2 + (i + 0.5) * (12 / n), y = 3 + (j + 0.5) * (10 / n);
          poly(g, [x - 1.5, y + 1.5, x, y - 2.5, x + 1.5, y + 1.5], tier >= 3 ? RAMPS.gold[4] : RAMPS.metal[5]);
          px(g, x, y - 1, 0.5, 2, '#ffffff');
        }
    });
  }

  function buildMine(def, tier, branch) {
    return pixelArt(22, 26, (g) => {
      const W = RAMPS.wood, S = RAMPS.stone;
      if (tier >= 4 && branch === 0) {
        // Bank: marble hall with columns
        const M = RAMPS.marble;
        px(g, 1, 12, 20, 12, M[2]);
        poly(g, [0, 12, 11, 4, 22, 12], M[3]);
        poly(g, [3, 11, 11, 6, 19, 11], M[1]);
        for (const x of [3, 8, 13, 17]) { px(g, x, 13, 2, 10, M[4]); px(g, x + 1, 13, 1, 10, M[2]); }
        px(g, 1, 23, 20, 2, M[1]);
        disc(g, 11, 9, 2, RAMPS.gold, 3);
        if (tier >= 5) { px(g, 10, 1, 2, 4, RAMPS.gold[4]); }
        return;
      }
      if (tier >= 4 && branch === 1) {
        // Alchemist: round tower with a bubbling flask
        px(g, 4, 8, 14, 16, S[2]); px(g, 4, 8, 2, 16, S[3]);
        poly(g, [3, 9, 11, 1, 19, 9], '#5a2a6a'); poly(g, [3, 9, 11, 1, 11, 9], '#7a4a8a');
        ellipseFill(g, 11, 17, 4, 4, '#7ce35a'); px(g, 10, 11, 2, 3, RAMPS.ice[4]);
        px(g, 9, 15, 1, 1, '#ffffff');
        px(g, 6, 22, 10, 2, S[1]);
        return;
      }
      // Mine shaft: timber frame in a rock face, cart of gold
      disc(g, 11, 13, 10, S, 2 + (tier >= 3 ? 1 : 0));
      px(g, 6, 9, 10, 13, '#120a06');
      px(g, 5, 8, 12, 2, W[3]); px(g, 5, 8, 2, 14, W[2]); px(g, 15, 8, 2, 14, W[2]);
      px(g, 2, 21, 18, 1, RAMPS.metal[3]);
      px(g, 3, 17, 7, 4, W[2]); px(g, 3, 17, 7, 1, W[4]);
      px(g, 4, 15, 5, 2, RAMPS.gold[4]); px(g, 5, 14, 2, 1, RAMPS.gold[5]);
      if (tier >= 2) { px(g, 13, 19, 6, 3, RAMPS.gold[3]); px(g, 14, 18, 3, 1, RAMPS.gold[5]); }
      if (tier >= 3) { px(g, 10, 4, 2, 4, W[3]); px(g, 8, 3, 6, 2, RAMPS.gold[3]); }
    });
  }

  /* ── Drawing a tower in the world ── */
  function headIndex(angle) {
    const a = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
    return Math.round(a / TWO_PI * HEAD_ANGLES) % HEAD_ANGLES;
  }

  function drawTowerSprite(t, x, y, alpha) {
    const def = TOWER_TYPES[t.type];
    const a = towerArt(t.type, t.tier, t.branch);
    const bottom = y + CELL / 2;
    if (a.kind === 'trap') {
      blitArt(a.base, x, bottom, false, alpha);
      if (t.tier >= 4 && t.branch === 1) {
        // Spinning saw blades
        for (const dy of [-5, 5]) {
          ctx.save();
          ctx.translate(x, y + dy - 1);
          ctx.rotate(G.animTime * 14 * (dy < 0 ? 1 : -1));
          ctx.fillStyle = '#c4ccdc';
          ctx.beginPath();
          for (let i = 0; i < 8; ++i) {
            const ang = i / 8 * TWO_PI;
            ctx.lineTo(Math.cos(ang) * 7, Math.sin(ang) * 3);
            ctx.lineTo(Math.cos(ang + 0.4) * 4, Math.sin(ang + 0.4) * 2);
          }
          ctx.fill();
          ctx.restore();
        }
      } else if (t.tier >= 4) {
        // Tar bubbles
        const ph = (G.animTime * 1.5 + t.col) % 1;
        ctx.fillStyle = `rgba(80,70,50,${1 - ph})`;
        ctx.beginPath(); ctx.arc(x - 4 + t.row % 3 * 3, y - ph * 3, 1 + ph * 2, 0, TWO_PI); ctx.fill();
      }
      return;
    }
    drawShadow(x, bottom - 3, 14, 5, 0.9);
    if (t.hurtFlash > 0) ctx.globalAlpha *= 0.7 + 0.3 * Math.sin(G.animTime * 60);
    blitArt(a.base, x, bottom + 2, false, alpha);
    if (t.hurtFlash > 0) ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    if (a.kind === 'mine') {
      // Glinting gold
      if ((G.animTime * 0.7 + t.col * 0.3) % 2 < 0.15)
        drawGlow('#ffe14a', x - 6, y + 6, 6, 0.8);
      return;
    }
    const hx = x, hy = bottom + 2 - a.lift * AP - 2;
    if (a.heads) {
      const rec = (t.recoil || 0) * 2.5;
      const ox = -Math.cos(t.angle) * rec, oy = -Math.sin(t.angle) * rec;
      blitPivot(a.heads[headIndex(t.angle)], hx + ox, hy + oy, 14, 14, alpha);
    } else if (a.head) {
      const bob = def.id === 'frost' ? Math.sin(G.animTime * 2.4 + t.col) * 1.6 - 4 : 0;
      if (def.id === 'frost') drawGlow('#9ae4ff', hx, hy + bob - 4, 14 + t.tier * 2, 0.35);
      blitPivot(a.head, hx, hy + bob, 12, 14, alpha);
    }
  }

  function blitPivot(img, x, y, pxA, pyA, alpha) {
    const pa = ctx.globalAlpha;
    if (alpha !== undefined) ctx.globalAlpha = pa * alpha;
    ctx.drawImage(img, x - pxA * AP, y - pyA * AP, img.width * AP, img.height * AP);
    ctx.globalAlpha = pa;
  }

  // Muzzle position of a tower (world units)
  // Platform height of a tower sprite (art px), worked out without building the art
  function towerLift(type, tier, branch) {
    const def = TOWER_TYPES[type];
    if (def.trap || def.kind === 'mine') return 0;
    const ht = 16 + BASE_HEIGHT[tier] + 4 + (tier >= 4 && branch === 0 ? 3 : 0);
    return ht + 2 - 10;
  }

  function muzzleOf(t) {
    const hy = t.y + CELL / 2 + 2 - towerLift(t.type, t.tier, t.branch) * AP - 2;
    const def = TOWER_TYPES[t.type];
    if (!ROTATING[def.id])
      return { x: t.x, y: hy - ({ tesla: 12 + t.tier * 2, frost: 6, storm: 20, arcane: 10, wind: 14, beacon: 8 }[def.id] || 2) };
    const len = def.id === 'sniper' ? 26 : def.id === 'cannon' ? 20 : def.id === 'arrow' ? 18 : 18;
    return { x: t.x + Math.cos(t.angle) * len, y: hy + Math.sin(t.angle) * len };
  }

  /* ── Icons for the UI ── */
  function drawTowerIcon(typeIndex, tier, cx, cy, size, branch) {
    const t = { type: typeIndex, tier, branch: branch === undefined ? -1 : branch, angle: -Math.PI / 5, col: 0, row: 0, recoil: 0, hp: 1, maxHp: 1 };
    const art = towerArt(typeIndex, tier, t.branch);
    const h = (art.base.height + (art.heads || art.head ? 4 : 0)) * AP;
    const k = size / Math.max(44, h);
    ctx.save();
    ctx.translate(cx, cy + size / 2 - (CELL / 2 + 6) * k);
    ctx.scale(k, k);
    ctx.imageSmoothingEnabled = false;
    drawTowerSprite(t, 0, 0);
    ctx.restore();
    ctx.imageSmoothingEnabled = true;
  }

  function drawTowerIconWorld(typeIndex, tier, x, y) {
    drawTowerSprite({ type: typeIndex, tier, branch: -1, angle: -Math.PI / 2, col: 0, row: 0, recoil: 0, hp: 1, maxHp: 1 }, x, y);
  }

  NS.towerArt = { drawTowerSprite, muzzleOf, drawTowerIcon, drawTowerIconWorld };

})();
