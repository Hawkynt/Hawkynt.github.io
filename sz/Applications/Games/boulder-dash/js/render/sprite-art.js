/* The miner and the story portraits, painted once into cached canvases: every skin in front
   poses (idle, blink, cheer) and side poses (four walk frames, two pickaxe swings, two pushes),
   mirrored for walking left, with its hat (helmet with lamp, beanie, hood, cap, knight helm,
   crown, robot head, party cone, snowman top hat, bunny ears, pumpkin), and the dialogue
   portraits of Pip, Granny Marla, the Hollow King and Bolt. Owns the sprite cache. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const M = NS.meta;

  const S = 48;
  const cache = {};

  function skinById(id) {
    return M.SKINS.find((s) => s.id === id) || M.SKINS[0];
  }

  function hat(x, sk, hx, hy, side) {
    const h = sk.helmet, t = sk.trim;
    switch (sk.hat) {
      case 'helmet':
        K.orb(x, hx, hy - 3, 10, h, K.lighten(h, 0.5), K.darken(h, 0.35));
        x.fillStyle = 'rgba(0,0,0,0)';
        x.fillStyle = K.darken(h, 0.3);
        x.fillRect(hx - 12, hy - 1, 24, 3);
        x.fillStyle = '#fff6b0';
        x.beginPath(); x.arc(hx + (side ? 7 : 0), hy - 6, 3.2, 0, C.TAU); x.fill();
        x.fillStyle = '#ffffff';
        x.beginPath(); x.arc(hx + (side ? 7 : 0) - 1, hy - 7, 1.2, 0, C.TAU); x.fill();
        break;
      case 'beanie':
        x.fillStyle = h;
        x.beginPath(); x.arc(hx, hy - 2, 10, Math.PI, 0); x.fill();
        x.fillStyle = t;
        x.fillRect(hx - 10.5, hy - 3, 21, 4);
        K.orb(x, hx, hy - 13, 3.5, t, '#ffffff', K.darken(t, 0.4));
        break;
      case 'hood':
        x.strokeStyle = t;
        x.lineWidth = 4;
        x.beginPath(); x.arc(hx, hy + 4, 11, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
        x.fillStyle = h;
        x.beginPath(); x.arc(hx, hy + 2, 12.5, Math.PI, 0); x.lineTo(hx + 10, hy - 4); x.arc(hx, hy + 2, 9, 0, Math.PI, true); x.fill();
        break;
      case 'cap':
        K.orb(x, hx, hy - 4, 12, h, K.lighten(h, 0.4), K.darken(h, 0.4));
        x.fillStyle = K.darken(h, 0.2);
        x.fillRect(hx - 13, hy - 2, 26, 3);
        x.fillStyle = t;
        for (const [dx, dy, r] of [[-5, -8, 2.2], [4, -10, 1.8], [7, -4, 1.6]]) { x.beginPath(); x.arc(hx + dx, hy + dy, r, 0, C.TAU); x.fill(); }
        break;
      case 'knight':
        K.orb(x, hx, hy - 1, 11, h, K.lighten(h, 0.5), K.darken(h, 0.5));
        x.fillStyle = '#111';
        x.fillRect(hx - (side ? 2 : 8), hy + 1, side ? 10 : 16, 2.5);
        x.fillStyle = t;
        x.beginPath(); x.moveTo(hx - 2, hy - 11); x.quadraticCurveTo(hx - 12, hy - 22, hx - 16, hy - 8); x.quadraticCurveTo(hx - 8, hy - 14, hx + 1, hy - 10); x.fill();
        break;
      case 'crown':
        x.fillStyle = h;
        K.poly(x, [hx - 9, hy - 2, hx - 10, hy - 13, hx - 5, hy - 7, hx, hy - 15, hx + 5, hy - 7, hx + 10, hy - 13, hx + 9, hy - 2]);
        x.fill();
        x.fillStyle = t;
        x.beginPath(); x.arc(hx, hy - 6, 2.2, 0, C.TAU); x.fill();
        break;
      case 'robot':
        x.fillStyle = '#d0d8e0';
        x.fillRect(hx - 1, hy - 18, 2, 7);
        x.fillStyle = t;
        x.beginPath(); x.arc(hx, hy - 19, 2.5, 0, C.TAU); x.fill();
        break;
      case 'party':
        x.fillStyle = h;
        K.poly(x, [hx - 8, hy - 3, hx + 8, hy - 3, hx + 1, hy - 20]);
        x.fill();
        x.strokeStyle = t;
        x.lineWidth = 2;
        x.beginPath(); x.moveTo(hx - 5, hy - 8); x.lineTo(hx + 6, hy - 10); x.moveTo(hx - 2, hy - 14); x.lineTo(hx + 4, hy - 15); x.stroke();
        K.orb(x, hx + 1, hy - 21, 2.5, t, '#ffffff', K.darken(t, 0.4));
        break;
      case 'snow':
        x.fillStyle = '#1a1a22';
        x.fillRect(hx - 7, hy - 16, 14, 12);
        x.fillRect(hx - 11, hy - 5, 22, 3);
        x.fillStyle = '#d02a2a';
        x.fillRect(hx - 7, hy - 8, 14, 2.5);
        break;
      case 'ears':
        x.fillStyle = h;
        for (const dx of [-5, 5]) { x.beginPath(); x.ellipse(hx + dx, hy - 14, 3.5, 9, dx * 0.03, 0, C.TAU); x.fill(); }
        x.fillStyle = '#ff9ac8';
        for (const dx of [-5, 5]) { x.beginPath(); x.ellipse(hx + dx, hy - 14, 1.6, 6, 0, 0, C.TAU); x.fill(); }
        break;
    }
  }

  function head(x, sk, hx, hy, side, blink) {
    if (sk.hat === 'robot') {
      x.fillStyle = sk.helmet;
      K.roundRect(x, hx - 9, hy - 10, 18, 17, 4);
      x.fill();
      x.fillStyle = '#10161e';
      x.fillRect(hx - 7 + (side ? 3 : 0), hy - 6, side ? 10 : 14, 6);
      x.fillStyle = sk.trim;
      x.fillRect(hx - 5 + (side ? 5 : 0), hy - 4, 3, 2);
      if (!side) x.fillRect(hx + 2, hy - 4, 3, 2);
      return;
    }
    if (sk.hat === 'pumpkin') {
      K.orb(x, hx, hy - 1, 11, '#ff8a1a', '#ffd08a', '#a04a00');
      x.strokeStyle = '#a04a00';
      x.lineWidth = 1;
      x.beginPath(); x.moveTo(hx - 4, hy - 11); x.quadraticCurveTo(hx - 6, hy, hx - 4, hy + 9); x.moveTo(hx + 4, hy - 11); x.quadraticCurveTo(hx + 6, hy, hx + 4, hy + 9); x.stroke();
      x.fillStyle = '#ffe36a';
      const o = side ? 3 : 0;
      K.poly(x, [hx - 6 + o, hy - 3, hx - 2 + o, hy - 3, hx - 4 + o, hy - 6]); x.fill();
      K.poly(x, [hx + 2 + o, hy - 3, hx + 6 + o, hy - 3, hx + 4 + o, hy - 6]); x.fill();
      K.poly(x, [hx - 6 + o, hy + 2, hx + 6 + o, hy + 2, hx + 3 + o, hy + 5, hx + o, hy + 3, hx - 3 + o, hy + 5]); x.fill();
      x.fillStyle = '#3a8a2a';
      x.fillRect(hx - 1, hy - 15, 3, 5);
      return;
    }
    K.orb(x, hx, hy, 9, sk.face, K.lighten(sk.face, 0.35), K.darken(sk.face, 0.3));
    x.fillStyle = '#20140c';
    if (blink) {
      x.fillRect(hx - 4 + (side ? 4 : 0), hy - 1, 3, 1.2);
      if (!side) x.fillRect(hx + 1, hy - 1, 3, 1.2);
    } else {
      x.beginPath(); x.arc(hx - 3 + (side ? 5 : 0), hy - 1, 1.6, 0, C.TAU); x.fill();
      if (!side) { x.beginPath(); x.arc(hx + 3, hy - 1, 1.6, 0, C.TAU); x.fill(); }
    }
    x.fillStyle = K.darken(sk.face, 0.25);
    if (sk.hat === 'snow') {
      x.fillStyle = '#ff7a1a';
      K.poly(x, [hx + (side ? 4 : 0), hy + 1, hx + (side ? 13 : 6), hy + 2.5, hx + (side ? 4 : 0), hy + 3.5]);
      x.fill();
    } else {
      x.beginPath(); x.arc(hx + (side ? 5 : 0), hy + 4, 2.2, 0.1, Math.PI - 0.1); x.fill();
      x.fillStyle = 'rgba(255,120,120,0.35)';
      x.beginPath(); x.arc(hx - 5 + (side ? 4 : 0), hy + 2.5, 2, 0, C.TAU); x.fill();
    }
  }

  function pickaxe(x, px, py, ang) {
    x.save();
    x.translate(px, py);
    x.rotate(ang);
    x.fillStyle = '#7a4a22';
    x.fillRect(-1.5, -16, 3, 18);
    x.fillStyle = '#c8ccd4';
    x.beginPath();
    x.moveTo(-9, -15); x.quadraticCurveTo(0, -21, 9, -15); x.lineTo(7, -13); x.quadraticCurveTo(0, -17, -7, -13); x.closePath();
    x.fill();
    x.fillStyle = '#ffffff';
    x.fillRect(-1, -19, 2, 2);
    x.restore();
  }

  /* pose: front, blink, cheer, walk0..3, swing0..1, push0..1 */
  function drawMiner(sk, pose) {
    const c = K.canvas(S, S), x = c.getContext('2d');
    const side = !(pose === 'front' || pose === 'blink' || pose === 'cheer');
    const cx = S / 2;
    let bob = 0, legA = 0, lean = 0;
    if (pose.startsWith('walk')) { const f = +pose[4]; legA = [1, 0, -1, 0][f]; bob = f % 2 ? -1 : 0; }
    if (pose.startsWith('push')) { lean = 4; legA = pose === 'push0' ? 1 : -1; }
    if (pose.startsWith('swing')) lean = pose === 'swing1' ? 2 : 0;
    const by = 30 + bob;
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.beginPath(); x.ellipse(cx, S - 4, 12, 3.5, 0, 0, C.TAU); x.fill();
    /* legs */
    x.fillStyle = K.darken(sk.trim, 0.55);
    if (side) {
      x.fillRect(cx - 5 + legA * 3, by + 6, 5, 9);
      x.fillRect(cx + 1 - legA * 3, by + 6, 5, 9);
      x.fillStyle = '#2a1c14';
      x.fillRect(cx - 6 + legA * 3, by + 13, 8, 3);
      x.fillRect(cx - legA * 3, by + 13, 8, 3);
    } else {
      x.fillRect(cx - 7, by + 6, 5, 9);
      x.fillRect(cx + 2, by + 6, 5, 9);
      x.fillStyle = '#2a1c14';
      x.fillRect(cx - 8, by + 13, 7, 3);
      x.fillRect(cx + 1, by + 13, 7, 3);
    }
    /* body */
    const g = x.createLinearGradient(cx - 10, 0, cx + 10, 0);
    g.addColorStop(0, K.lighten(sk.body, 0.2)); g.addColorStop(1, K.darken(sk.body, 0.3));
    x.fillStyle = g;
    K.roundRect(x, cx - 9 + lean * 0.5, by - 8, 18, 16, 6);
    x.fill();
    x.fillStyle = sk.trim;
    x.fillRect(cx - 9 + lean * 0.5, by + 3, 18, 3);
    x.fillStyle = '#ffd54a';
    x.fillRect(cx - 2 + lean * 0.5, by + 3, 4, 3);
    /* arms and tool */
    x.fillStyle = K.darken(sk.body, 0.15);
    if (pose === 'cheer') {
      x.fillRect(cx - 13, by - 18, 4, 12); x.fillRect(cx + 9, by - 18, 4, 12);
      x.fillStyle = sk.face;
      x.beginPath(); x.arc(cx - 11, by - 19, 3, 0, C.TAU); x.arc(cx + 11, by - 19, 3, 0, C.TAU); x.fill();
    } else if (pose.startsWith('push')) {
      x.fillRect(cx + 4, by - 5, 12, 4);
      x.fillStyle = sk.face;
      x.beginPath(); x.arc(cx + 16, by - 3, 3, 0, C.TAU); x.fill();
    } else if (pose.startsWith('swing')) {
      const up = pose === 'swing0';
      pickaxe(x, cx + 6, by - 2, up ? -0.9 : 1.2);
      x.fillStyle = K.darken(sk.body, 0.15);
      x.fillRect(cx + 2, by - 5, 7, 4);
    } else if (side) {
      pickaxe(x, cx - 4, by + 1, -0.35 + legA * 0.1);
      x.fillStyle = K.darken(sk.body, 0.15);
      x.fillRect(cx - 3 - legA * 2, by - 5, 4, 10);
    } else {
      pickaxe(x, cx + 11, by + 2, 0.25);
      x.fillStyle = K.darken(sk.body, 0.15);
      x.fillRect(cx - 12, by - 6, 4, 10); x.fillRect(cx + 8, by - 6, 4, 10);
    }
    const hx = cx + (side ? 2 + lean : 0), hy = by - 15;
    head(x, sk, hx, hy, side, pose === 'blink');
    hat(x, sk, hx, hy - 4, side);
    return c;
  }

  function mirror(src) {
    const c = K.canvas(src.width, src.height), x = c.getContext('2d');
    x.translate(src.width, 0);
    x.scale(-1, 1);
    x.drawImage(src, 0, 0);
    return c;
  }

  const POSES = ['front', 'blink', 'cheer', 'walk0', 'walk1', 'walk2', 'walk3', 'swing0', 'swing1', 'push0', 'push1'];

  /* the sprite set of a skin: { right: {pose: canvas}, left: {pose: canvas} } */
  function miner(id) {
    if (cache[id]) return cache[id];
    const sk = skinById(id);
    const set = { right: {}, left: {} };
    for (let i = 0; i < POSES.length; ++i) {
      const c = drawMiner(sk, POSES[i]);
      set.right[POSES[i]] = c;
      set.left[POSES[i]] = mirror(c);
    }
    cache[id] = set;
    return set;
  }

  /* ── Portraits (96 x 96) ── */
  function portrait(who) {
    const key = 'portrait-' + who;
    if (cache[key]) return cache[key];
    const c = K.canvas(96, 96), x = c.getContext('2d');
    const bg = x.createRadialGradient(48, 40, 8, 48, 48, 60);
    const col = (NS.story.CAST[who] || {}).color || '#ffb347';
    bg.addColorStop(0, K.rgba(col, 0.55)); bg.addColorStop(1, 'rgba(10,8,6,0.9)');
    x.fillStyle = bg;
    K.roundRect(x, 0, 0, 96, 96, 14);
    x.fill();
    if (who === 'pip') {
      x.save(); x.translate(48, 60); x.scale(2.6, 2.6);
      x.drawImage(drawMiner(skinById(G().save ? G().save.skin : 'classic'), 'front'), -24, -32);
      x.restore();
    } else if (who === 'marla') {
      K.orb(x, 48, 30, 18, '#d8d8d8', '#ffffff', '#9a9a9a');
      K.orb(x, 48, 52, 24, '#f2c49b', '#ffe0c4', '#c8946a');
      x.fillStyle = '#ffffff';
      x.beginPath(); x.ellipse(48, 34, 26, 10, 0, Math.PI, 0); x.fill();
      x.strokeStyle = '#4a3020'; x.lineWidth = 2.5;
      x.beginPath(); x.arc(38, 50, 6, 0, C.TAU); x.arc(58, 50, 6, 0, C.TAU); x.moveTo(44, 50); x.lineTo(52, 50); x.stroke();
      x.fillStyle = '#2a1a10';
      x.beginPath(); x.arc(38, 50, 2, 0, C.TAU); x.arc(58, 50, 2, 0, C.TAU); x.fill();
      x.strokeStyle = '#8a4a3a'; x.lineWidth = 2;
      x.beginPath(); x.arc(48, 62, 7, 0.2, Math.PI - 0.2); x.stroke();
      x.fillStyle = '#4fa86a';
      x.fillRect(22, 78, 52, 14);
    } else if (who === 'king') {
      x.fillStyle = '#6a4ab0';
      K.poly(x, [48, 10, 78, 38, 70, 86, 26, 86, 18, 38]); x.fill();
      x.fillStyle = '#9a7ae0';
      K.poly(x, [48, 10, 78, 38, 48, 48, 18, 38]); x.fill();
      x.fillStyle = '#ffffff';
      x.beginPath(); x.ellipse(37, 48, 6, 3.5, 0.3, 0, C.TAU); x.ellipse(59, 48, 6, 3.5, -0.3, 0, C.TAU); x.fill();
      x.fillStyle = '#1a0a30';
      K.poly(x, [48, 60, 56, 70, 48, 80, 40, 70]); x.fill();
      x.fillStyle = '#ffd54a';
      K.poly(x, [30, 18, 34, 4, 41, 14, 48, 0, 55, 14, 62, 4, 66, 18]); x.fill();
    } else {
      x.drawImage(K.glow('#5fd6ff'), 8, 8, 80, 80);
      x.strokeStyle = '#c8a050'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(30, 24); x.lineTo(66, 24); x.lineTo(66, 74); x.lineTo(30, 74); x.closePath();
      x.moveTo(48, 12); x.lineTo(48, 24); x.stroke();
      K.orb(x, 48, 50, 15, '#bff4ff', '#ffffff', '#3ab0e0');
      x.fillStyle = '#10304a';
      x.beginPath(); x.arc(42, 48, 2.5, 0, C.TAU); x.arc(54, 48, 2.5, 0, C.TAU); x.fill();
    }
    x.strokeStyle = K.rgba(col, 0.9);
    x.lineWidth = 3;
    K.roundRect(x, 1.5, 1.5, 93, 93, 13);
    x.stroke();
    cache[key] = c;
    return c;
  }

  function G() {
    return NS.state;
  }

  function clearPortraits() {
    delete cache['portrait-pip'];
  }

  Object.assign(NS.spriteArt, { miner, portrait, clearPortraits, skinById, drawMiner, SIZE: S });
})();
