/* Ship art, painted once per hull and bank frame: the four mining hulls built from layered
   plates (lit by a fixed key light that slides as the ship banks), cockpit glass, hazard trim,
   panel lines, cargo pods, emitters and nozzles; the mining drone; and hit-flash silhouettes.
   Facing +x. Pure painting into cached canvases. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const K = NS.artKit;
  const TAU = Math.PI * 2;

  /* parts: p = polygon, e = ellipse [cx, cy, rx, ry]; f = paint; z = height (banking parallax) */
  const HULL_PARTS = {
    prospector: [
      { p: [[-27, -8], [-14, -10], [-14, 10], [-27, 8]], f: 'dark', z: 0 },
      { p: [[-20, -24], [6, -24], [12, -19], [6, -13], [-20, -13], [-23, -18]], f: 'hull', z: 1, stripe: 1 },
      { p: [[-20, 24], [6, 24], [12, 19], [6, 13], [-20, 13], [-23, 18]], f: 'hull', z: 1, stripe: 1 },
      { p: [[-12, -15], [-4, -15], [-4, 15], [-12, 15]], f: 'dark', z: 0 },
      { p: [[-18, -11], [6, -13], [17, -8], [23, 0], [17, 8], [6, 13], [-18, 11]], f: 'hull', z: 2 },
      { p: [[-14, -6], [4, -7], [4, 7], [-14, 6]], f: 'trim', z: 3 },
      { p: [[22, -3], [31, -2], [31, 2], [22, 3]], f: 'metal', z: 2 },
      { e: [12, 0, 6, 4.6], f: 'glass', z: 3 },
    ],
    wasp: [
      { p: [[-24, -6], [-12, -7], [-12, 7], [-24, 6]], f: 'dark', z: 0 },
      { p: [[-18, -4], [-4, -6], [-14, -24], [-20, -24]], f: 'trim', z: 1 },
      { p: [[-18, 4], [-4, 6], [-14, 24], [-20, 24]], f: 'trim', z: 1 },
      { p: [[-16, -7], [10, -6], [28, 0], [10, 6], [-16, 7], [-20, 0]], f: 'hull', z: 2 },
      { p: [[-2, -11], [8, -5], [-2, -5]], f: 'hull', z: 1 },
      { p: [[-2, 11], [8, 5], [-2, 5]], f: 'hull', z: 1 },
      { p: [[27, -1.5], [34, -1], [34, 1], [27, 1.5]], f: 'metal', z: 2 },
      { e: [8, 0, 7, 3.4], f: 'glass', z: 3 },
    ],
    hauler: [
      { p: [[-34, -11], [-24, -13], [-24, 13], [-34, 11]], f: 'dark', z: 0 },
      { p: [[-26, -18], [12, -18], [12, 18], [-26, 18]], f: 'dark', z: 1 },
      { p: [[-24, -17], [-12, -17], [-12, -2], [-24, -2]], f: 'hull', z: 2, crate: 1 },
      { p: [[-24, 2], [-12, 2], [-12, 17], [-24, 17]], f: 'trim', z: 2, crate: 1 },
      { p: [[-10, -17], [2, -17], [2, -2], [-10, -2]], f: 'trim', z: 2, crate: 1 },
      { p: [[-10, 2], [2, 2], [2, 17], [-10, 17]], f: 'hull', z: 2, crate: 1 },
      { p: [[4, -14], [20, -12], [28, -5], [28, 5], [20, 12], [4, 14]], f: 'hull', z: 2 },
      { p: [[27, -3], [36, -2.5], [36, 2.5], [27, 3]], f: 'metal', z: 2 },
      { e: [19, 0, 5, 7], f: 'glass', z: 3 },
    ],
    leviathan: [
      { p: [[-36, -16], [-24, -18], [-24, -4], [-36, -6]], f: 'dark', z: 0 },
      { p: [[-36, 6], [-24, 4], [-24, 18], [-36, 16]], f: 'dark', z: 0 },
      { p: [[-28, -26], [0, -28], [10, -22], [2, -16], [-28, -16]], f: 'trim', z: 1, rack: 1 },
      { p: [[-28, 26], [0, 28], [10, 22], [2, 16], [-28, 16]], f: 'trim', z: 1, rack: 1 },
      { p: [[-26, -17], [8, -18], [22, -24], [34, -20], [30, -8], [26, 0], [30, 8], [34, 20], [22, 24], [8, 18], [-26, 17], [-30, 0]], f: 'hull', z: 2 },
      { p: [[-18, -8], [14, -8], [18, 0], [14, 8], [-18, 8]], f: 'dark', z: 3 },
      { p: [[32, -21], [41, -20], [41, -16], [32, -15]], f: 'metal', z: 2 },
      { p: [[32, 15], [41, 16], [41, 20], [32, 21]], f: 'metal', z: 2 },
      { e: [6, 0, 7, 5], f: 'glass', z: 4 },
    ],
  };

  const SIZE = { prospector: 72, wasp: 72, hauler: 84, leviathan: 96 };
  const NOZZLES = {
    prospector: [[-27, 0]], wasp: [[-24, 0]], hauler: [[-34, -6], [-34, 6]], leviathan: [[-36, -11], [-36, 11]],
  };
  const EMITTERS = { prospector: [[31, 0]], wasp: [[34, 0]], hauler: [[36, 0]], leviathan: [[41, -18], [41, 18]] };

  function bankFrame(b) {
    return Math.max(0, Math.min(4, Math.round((b + 1) * 2)));
  }

  function colorOf(colors, f) {
    return f === 'hull' ? colors.hull : f === 'trim' ? colors.trim : f === 'glass' ? colors.glass : f === 'metal' ? '#9aa4b4' : colors.dark;
  }

  function pathPart(g, part, bank, cx, cy) {
    const sq = 1 - Math.abs(bank) * 0.13;
    const lift = -bank * part.z * 1.6;
    g.beginPath();
    if (part.e) g.ellipse(cx + part.e[0], cy + part.e[1] * sq + lift, part.e[2], part.e[3] * sq, 0, 0, TAU);
    else
      for (let i = 0; i < part.p.length; ++i) {
        const x = cx + part.p[i][0], y = cy + part.p[i][1] * sq + lift;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
    g.closePath();
    return { sq: sq, lift: lift };
  }

  function bounds(part) {
    if (part.e) return [part.e[1] - part.e[3], part.e[1] + part.e[3], part.e[0] - part.e[2], part.e[0] + part.e[2]];
    let y0 = 1e9, y1 = -1e9, x0 = 1e9, x1 = -1e9;
    for (let i = 0; i < part.p.length; ++i) {
      y0 = Math.min(y0, part.p[i][1]); y1 = Math.max(y1, part.p[i][1]);
      x0 = Math.min(x0, part.p[i][0]); x1 = Math.max(x1, part.p[i][0]);
    }
    return [y0, y1, x0, x1];
  }

  function paintPart(g, part, colors, bank, cx, cy) {
    const base = colorOf(colors, part.f);
    const t = pathPart(g, part, bank, cx, cy);
    const b = bounds(part);
    const ya = cy + b[0] * t.sq + t.lift, yb = cy + b[1] * t.sq + t.lift;
    /* key light from the upper left; banking tips it */
    const gr = g.createLinearGradient(cx + b[2], ya, cx + b[2] + (b[3] - b[2]) * 0.3, yb);
    if (part.f === 'glass') {
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.25, K.shade(base, 0.35));
      gr.addColorStop(0.7, K.shade(base, -0.45));
      gr.addColorStop(1, K.shade(base, -0.75));
    } else {
      gr.addColorStop(0, K.shade(base, 0.42 - bank * 0.18));
      gr.addColorStop(0.45, base);
      gr.addColorStop(1, K.shade(base, -0.55 - bank * 0.15));
    }
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.65)';
    g.lineWidth = 0.9;
    g.stroke();
    /* rim light along the top edge */
    g.save();
    g.clip();
    g.strokeStyle = K.rgba('#ffffff', part.f === 'dark' ? 0.08 : 0.22);
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(cx + b[2], ya + 0.8);
    g.lineTo(cx + b[3], ya + 0.8);
    g.stroke();
    if (part.stripe) {
      g.fillStyle = K.rgba(colors.trim, 0.9);
      g.fillRect(cx + b[2], (ya + yb) / 2 - 1.5, b[3] - b[2], 3);
      g.fillStyle = 'rgba(20,20,20,0.6)';
      for (let x = b[2]; x < b[3]; x += 5) {
        g.beginPath();
        g.moveTo(cx + x, (ya + yb) / 2 - 1.5);
        g.lineTo(cx + x + 2, (ya + yb) / 2 - 1.5);
        g.lineTo(cx + x - 1, (ya + yb) / 2 + 1.5);
        g.lineTo(cx + x - 3, (ya + yb) / 2 + 1.5);
        g.fill();
      }
    }
    if (part.crate) {
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 0.8;
      for (let x = b[2] + 3; x < b[3]; x += 3) {
        g.beginPath();
        g.moveTo(cx + x, ya);
        g.lineTo(cx + x, yb);
        g.stroke();
      }
    }
    if (part.rack) {
      g.fillStyle = 'rgba(10,14,22,0.7)';
      for (let x = b[2] + 4; x < b[3] - 4; x += 8) g.fillRect(cx + x, (ya + yb) / 2 - 2.5, 5, 5);
      g.fillStyle = '#5cff9a';
      for (let x = b[2] + 4; x < b[3] - 4; x += 8) g.fillRect(cx + x + 2, (ya + yb) / 2 - 0.5, 1, 1);
    }
    g.restore();
  }

  /* panel lines, vents, rivets and running lights shared by every hull */
  function details(g, id, colors, bank, cx, cy) {
    const sq = 1 - Math.abs(bank) * 0.13;
    g.strokeStyle = 'rgba(0,0,0,0.3)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(cx - 10, cy - 4 * sq);
    g.lineTo(cx + 2, cy - 4 * sq);
    g.moveTo(cx - 10, cy + 4 * sq);
    g.lineTo(cx + 2, cy + 4 * sq);
    g.stroke();
    const noz = NOZZLES[id];
    for (let i = 0; i < noz.length; ++i) {
      const x = cx + noz[i][0], y = cy + noz[i][1] * sq;
      const gr = g.createRadialGradient(x, y, 0, x, y, 5);
      gr.addColorStop(0, K.shade(colors.glow, 0.5));
      gr.addColorStop(0.5, colors.glow);
      gr.addColorStop(1, K.rgba(colors.glow, 0));
      g.fillStyle = gr;
      g.fillRect(x - 5, y - 5, 10, 10);
      g.fillStyle = '#20242c';
      g.fillRect(x - 1, y - 4, 2.5, 8);
    }
    const em = EMITTERS[id];
    for (let i = 0; i < em.length; ++i) {
      const x = cx + em[i][0], y = cy + em[i][1] * sq;
      g.fillStyle = '#ff5a3a';
      g.beginPath();
      g.arc(x, y, 1.4, 0, TAU);
      g.fill();
    }
    /* running lights: red port, green starboard */
    g.fillStyle = '#ff4a4a';
    g.fillRect(cx - 6, cy - (SIZE[id] * 0.27) * sq - 1, 2, 2);
    g.fillStyle = '#4aff8a';
    g.fillRect(cx - 6, cy + (SIZE[id] * 0.27) * sq - 1, 2, 2);
  }

  function shipSprite(id, colors, bank) {
    const f = bankFrame(bank);
    const b = (f - 2) / 2;
    const S = SIZE[id] || 72;
    return K.sprite('ship:' + id + ':' + colors.hull + ':' + f, S, S, (g, w, h) => {
      const cx = w / 2, cy = h / 2;
      /* soft contact shadow */
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.beginPath();
      g.ellipse(cx - 2, cy + 3, S * 0.4, S * 0.3, 0, 0, TAU);
      g.fill();
      const parts = HULL_PARTS[id];
      for (let z = 0; z <= 4; ++z)
        for (let i = 0; i < parts.length; ++i) if (parts[i].z === z) paintPart(g, parts[i], colors, b, cx, cy);
      details(g, id, colors, b, cx, cy);
    });
  }

  function shipFlash(id, colors, bank) {
    const base = shipSprite(id, colors, bank);
    return K.silhouette('ship:' + id + ':' + colors.hull + ':' + bankFrame(bank), base);
  }

  /* world-space offsets (unscaled) of nozzles and emitters, for exhaust and beams */
  function nozzles(id) {
    return NOZZLES[id] || NOZZLES.prospector;
  }

  function emitters(id) {
    return EMITTERS[id] || EMITTERS.prospector;
  }

  /* The mining drone: a round body with three arms and a green eye */
  function drone() {
    return K.sprite('drone', 26, 26, (g, w) => {
      const c = w / 2;
      for (let i = 0; i < 3; ++i) {
        const a = i * TAU / 3 + Math.PI / 3;
        g.strokeStyle = '#3a404c';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(c, c);
        g.lineTo(c + Math.cos(a) * 11, c + Math.sin(a) * 11);
        g.stroke();
        g.fillStyle = '#8a94a4';
        g.beginPath();
        g.arc(c + Math.cos(a) * 11, c + Math.sin(a) * 11, 2.4, 0, TAU);
        g.fill();
      }
      const gr = g.createRadialGradient(c - 2, c - 3, 1, c, c, 7);
      gr.addColorStop(0, '#e8eef8');
      gr.addColorStop(0.6, '#8a94a4');
      gr.addColorStop(1, '#2a303a');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(c, c, 7, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 0.8;
      g.stroke();
      g.fillStyle = '#5cff9a';
      g.beginPath();
      g.arc(c + 3, c, 2.2, 0, TAU);
      g.fill();
      g.fillStyle = '#ffffff';
      g.fillRect(c + 3, c - 1, 1, 1);
    });
  }

  Object.assign(NS.shipArt, {
    HULL_PARTS, SIZE, bankFrame, shipSprite, shipFlash, nozzles, emitters, drone
  });
})();
