/* The runners, painted once per pose: a jointed skeleton (hip, torso, head, two-part arms and
   legs) posed for an eight-frame run cycle, the jump, the fall, the slide, the dash, the tucked
   flip, flight, the crash and the ready crouch; drawn with a dark outline and the runner's
   colours (skin, hair, suit, accent - an outfit swaps suit and accent), and each runner's head:
   Nova's ponytail, Kip's fox ears, Rook's visor, Mira's cap, Blaze's helmet, Echo's hood. Feet
   sit at (46, 100) of a 100 x 112 sprite. Paints only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const K = NS.artKit;
  const { CHAR_BY_ID, OUTFIT_BY_ID } = NS.cosmetics;
  const { TAU } = NS.constants;

  const W = 100, H = 112, OX = 46, OY = 100;
  const RUN_FRAMES = 8;
  const OUTLINE = '#141224';

  /* pose: hip (x, y), torso lean a, limbs [angle, bend] (0 = straight down, + = forward) */
  function pose(kind, f) {
    if (kind === 'run') {
      const ph = f / RUN_FRAMES * TAU;
      const s = Math.sin(ph), c = Math.cos(ph);
      return {
        hx: 0, hy: -36 - Math.abs(c) * 3, a: 0.28,
        legF: [0.85 * s, 0.25 + 1.35 * Math.max(0, c)], legB: [-0.85 * s, 0.25 + 1.35 * Math.max(0, -c)],
        armF: [-0.95 * s, 1.2], armB: [0.95 * s, 1.2],
      };
    }
    switch (kind) {
      case 'jump': return { hx: 0, hy: -42, a: 0.12, legF: [1.05, 1.7], legB: [-0.25, 0.9], armF: [-2.5, 0.4], armB: [2.4, 0.5] };
      case 'fall': return { hx: 0, hy: -38, a: 0.04, legF: [0.45, 0.35], legB: [-0.35, 0.7], armF: [-1.9, 0.5], armB: [1.7, 0.4] };
      case 'slide': return { hx: -2, hy: -12, a: -1.12, legF: [1.5, 0.05], legB: [1.25, 1.0], armF: [-2.0, 0.6], armB: [-2.6, 0.4] };
      case 'dash': return { hx: 0, hy: -36, a: 0.85, legF: [0.75, 1.25], legB: [-1.05, 0.5], armF: [-1.75, 0.15], armB: [-1.55, 0.15] };
      case 'ball': return { hx: 0, hy: -40, a: 0.7, legF: [1.35, 2.4], legB: [1.15, 2.3], armF: [0.7, 1.9], armB: [0.5, 1.9] };
      case 'fly': return { hx: 0, hy: -40, a: 0.55, legF: [-0.35, 0.6], legB: [-0.1, 0.9], armF: [1.5, 0.2], armB: [1.3, 0.3] };
      case 'hurt': return { hx: 0, hy: -36, a: -0.5, legF: [0.7, 0.4], legB: [-0.6, 0.5], armF: [-2.8, 0.3], armB: [2.8, 0.3] };
      default: return { hx: 0, hy: -32, a: 0.55, legF: [0.6, 1.45], legB: [-0.5, 1.2], armF: [0.35, 1.2], armB: [-0.45, 1.0] };
    }
  }

  function joint(x, y, ang, len) {
    return [x + Math.sin(ang) * len, y + Math.cos(ang) * len];
  }

  function limb(g, x, y, l, len1, len2, w, color, outline, armLike) {
    const k = joint(x, y, l[0], len1);
    const e = joint(k[0], k[1], l[0] + (armLike ? l[1] : -l[1]), len2);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = outline;
    g.lineWidth = w + 4;
    g.beginPath(); g.moveTo(x, y); g.lineTo(k[0], k[1]); g.lineTo(e[0], e[1]); g.stroke();
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x, y); g.lineTo(k[0], k[1]); g.lineTo(e[0], e[1]); g.stroke();
    return e;
  }

  function colors(ch, outfit) {
    const o = OUTFIT_BY_ID[outfit] || OUTFIT_BY_ID.classic;
    return { skin: ch.skin, hair: ch.hair, suit: o.suit || ch.suit, accent: o.accent || ch.accent, glow: !!o.glow };
  }

  function head(g, ch, col, hx, hy, a) {
    const r = 12;
    g.fillStyle = OUTLINE;
    g.beginPath(); g.arc(hx, hy, r + 2, 0, TAU); g.fill();
    g.fillStyle = col.skin;
    g.beginPath(); g.arc(hx, hy, r, 0, TAU); g.fill();
    const fx = hx + 6, fy = hy - 1;
    switch (ch.head) {
      case 'hair':
        g.fillStyle = col.hair;
        g.beginPath(); g.arc(hx - 1, hy - 3, r, Math.PI * 0.95, Math.PI * 2.1); g.fill();
        K.poly(g, [[hx - 9, hy - 6], [hx - 26, hy - 2], [hx - 20, hy + 4], [hx - 8, hy + 2]]); g.fill();
        g.fillStyle = col.accent;
        g.fillRect(hx - 11, hy - 6, 4, 6);
        break;
      case 'ears':
        g.fillStyle = col.hair;
        g.beginPath(); g.arc(hx - 1, hy - 3, r, Math.PI, Math.PI * 2); g.fill();
        for (const ex of [-6, 3]) {
          g.fillStyle = OUTLINE;
          K.poly(g, [[hx + ex - 6, hy - 6], [hx + ex, hy - 25], [hx + ex + 6, hy - 6]]); g.fill();
          g.fillStyle = col.hair;
          K.poly(g, [[hx + ex - 4, hy - 7], [hx + ex, hy - 21], [hx + ex + 4, hy - 7]]); g.fill();
          g.fillStyle = '#ffe8d0';
          K.poly(g, [[hx + ex - 2, hy - 8], [hx + ex, hy - 16], [hx + ex + 2, hy - 8]]); g.fill();
        }
        g.fillStyle = col.hair;
        K.poly(g, [[hx - 10, hy + 2], [hx - 30, hy + 10], [hx - 12, hy + 8]]); g.fill();
        break;
      case 'visor':
        g.fillStyle = '#d8e0ec';
        g.beginPath(); g.arc(hx, hy, r, 0, TAU); g.fill();
        g.fillStyle = OUTLINE;
        K.roundRect(g, hx - 2, hy - 6, 14, 9, 4); g.fill();
        g.fillStyle = col.hair;
        K.roundRect(g, hx, hy - 5, 11, 6, 3); g.fill();
        g.fillStyle = '#ffffff';
        g.fillRect(hx + 7, hy - 4, 3, 2);
        g.strokeStyle = OUTLINE; g.lineWidth = 2;
        g.beginPath(); g.moveTo(hx - 3, hy - 10); g.lineTo(hx - 6, hy - 20); g.stroke();
        g.fillStyle = col.accent;
        g.beginPath(); g.arc(hx - 6, hy - 21, 3, 0, TAU); g.fill();
        return;
      case 'cap':
        g.fillStyle = col.hair;
        g.beginPath(); g.arc(hx - 2, hy + 1, r, Math.PI * 0.6, Math.PI * 1.2); g.fill();
        g.fillStyle = col.accent;
        g.beginPath(); g.arc(hx, hy - 2, r, Math.PI, Math.PI * 2); g.fill();
        g.fillRect(hx - 20, hy - 4, 12, 4);
        break;
      case 'helmet':
        g.fillStyle = col.suit;
        g.beginPath(); g.arc(hx, hy - 2, r + 2, Math.PI, Math.PI * 2); g.fill();
        g.fillRect(hx - r - 6, hy - 3, 2 * r + 12, 4);
        g.fillStyle = col.accent;
        g.fillRect(hx - 2, hy - 13, 4, 10);
        break;
      case 'hood':
        g.fillStyle = col.suit;
        g.beginPath(); g.arc(hx - 1, hy, r + 2, Math.PI * 0.5, Math.PI * 2.25); g.fill();
        K.poly(g, [[hx - 10, hy - 6], [hx - 22, hy - 16], [hx - 12, hy + 4]]); g.fill();
        g.fillStyle = col.hair;
        g.beginPath(); g.arc(fx, fy, 2.4, 0, TAU); g.fill();
        g.fillStyle = K.rgba(col.hair, 0.4);
        g.beginPath(); g.arc(fx, fy, 5, 0, TAU); g.fill();
        return;
    }
    g.fillStyle = OUTLINE;
    g.beginPath(); g.arc(fx, fy, 1.8, 0, TAU); g.fill();
    g.fillStyle = K.rgba('#ff7a7a', 0.45);
    g.beginPath(); g.arc(fx - 2, fy + 5, 2.5, 0, TAU); g.fill();
  }

  function paintFigure(g, ch, col, p) {
    g.save();
    g.translate(OX, OY);
    const hipX = p.hx, hipY = p.hy;
    const neck = joint(hipX, hipY, Math.PI - p.a, 24);
    const shX = neck[0] - Math.sin(p.a) * 2, shY = neck[1] + 3;
    const back = K.shade(col.suit, -0.35), skinB = K.shade(col.skin, -0.25);
    /* back limbs */
    limb(g, shX, shY, p.armB, 14, 13, 7, skinB, OUTLINE, true);
    const footB = limb(g, hipX, hipY, p.legB, 18, 18, 9, back, OUTLINE, false);
    g.fillStyle = K.shade(col.accent, -0.3);
    g.beginPath(); g.ellipse(footB[0] + 3, footB[1], 7, 4, 0, 0, TAU); g.fill();
    /* torso */
    g.lineCap = 'round';
    g.strokeStyle = OUTLINE; g.lineWidth = 19;
    g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(neck[0], neck[1]); g.stroke();
    g.strokeStyle = col.suit; g.lineWidth = 15;
    g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(neck[0], neck[1]); g.stroke();
    g.strokeStyle = col.accent; g.lineWidth = 4;
    const mid = [(hipX + neck[0]) / 2, (hipY + neck[1]) / 2];
    g.beginPath(); g.moveTo(mid[0] - Math.cos(p.a) * 7, mid[1] - Math.sin(p.a) * 7); g.lineTo(mid[0] + Math.cos(p.a) * 7, mid[1] + Math.sin(p.a) * 7); g.stroke();
    if (col.glow) {
      g.strokeStyle = K.rgba(col.accent, 0.35); g.lineWidth = 9;
      g.beginPath(); g.moveTo(hipX, hipY); g.lineTo(neck[0], neck[1]); g.stroke();
    }
    /* front leg */
    const footF = limb(g, hipX, hipY, p.legF, 18, 18, 9, K.shade(col.suit, -0.12), OUTLINE, false);
    g.fillStyle = OUTLINE;
    g.beginPath(); g.ellipse(footF[0] + 3, footF[1], 9, 6, 0, 0, TAU); g.fill();
    g.fillStyle = col.accent;
    g.beginPath(); g.ellipse(footF[0] + 3, footF[1], 7, 4, 0, 0, TAU); g.fill();
    /* head, then the front arm over the body */
    const hd = joint(neck[0], neck[1], Math.PI - p.a * 0.6, 12);
    head(g, ch, col, hd[0], hd[1], p.a);
    const hand = limb(g, shX, shY, p.armF, 14, 13, 7, col.skin, OUTLINE, true);
    g.fillStyle = col.skin;
    g.beginPath(); g.arc(hand[0], hand[1], 4, 0, TAU); g.fill();
    g.restore();
  }

  /* the cached sprite for one runner, outfit and pose */
  function frame(charId, outfitId, kind, f) {
    const ch = CHAR_BY_ID[charId] || CHAR_BY_ID.nova;
    const key = 'run:' + ch.id + ':' + outfitId + ':' + kind + ':' + (f || 0);
    return K.sprite(key, W, H, (g) => paintFigure(g, ch, colors(ch, outfitId), pose(kind, f || 0)));
  }

  /* where the scarf knot sits for a pose, relative to the feet (for the live scarf) */
  function neckOf(kind, f) {
    const p = pose(kind, f || 0);
    const n = joint(p.hx, p.hy, Math.PI - p.a, 22);
    return { x: n[0] - 4, y: n[1] };
  }

  function accentOf(charId, outfitId) {
    const ch = CHAR_BY_ID[charId] || CHAR_BY_ID.nova;
    return colors(ch, outfitId).accent;
  }

  Object.assign(NS.runnerArt, {
    W, H, OX, OY, RUN_FRAMES, pose, frame, neckOf, accentOf
  });
})();
