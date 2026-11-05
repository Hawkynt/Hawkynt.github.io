/* Arena tiles for each world, painted once and cached: floors (grass, frost stone, foundry
   plates, neon grid, flagstones), stone pillars with a lit top and shaded front, bricks per
   world (bricks, ice blocks, rusty crates, neon crates, bookcases), steel crates, ice, belt
   frames, teleport pads, the exit door and seasonal decorations on the stone. Also bakes the
   static floor-and-stone layer of a level. Owns the per-level floor layer. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const { TILE, COLS, ROWS, T_HARD, T_ICE, T_BELT_U, T_BELT_D, T_BELT_L, T_BELT_R, T_TELE } = C;
  const { WORLDS } = NS.story;
  const K = NS.artKit;
  const R = NS.rng;
  const T = TILE;
  const SIDE = 11;

  function pal(w) {
    return WORLDS[w].palette;
  }

  function floor(w, v) {
    return K.sprite('floor:' + w + ':' + v, T, T, (x) => {
      const p = pal(w);
      const base = (v & 1) ? p.floorB : p.floorA;
      x.fillStyle = base;
      x.fillRect(0, 0, T, T);
      const rng = R.makeRng(1000 + w * 97 + v * 13);
      switch (WORLDS[w].id) {
        case 'meadow':
          for (let i = 0; i < 16; ++i) {
            const gx = rng() * T, gy = 6 + rng() * (T - 8);
            x.strokeStyle = rng() < 0.5 ? K.shade(base, 0.18) : K.shade(base, -0.15);
            x.lineWidth = 1.5;
            x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (rng() - 0.5) * 4, gy - 4 - rng() * 4); x.stroke();
          }
          if (v === 2) { K.circle(x, 12 + rng() * 24, 12 + rng() * 24, 2.5, '#fff6a0'); K.circle(x, 30, 30, 2, '#ffffff'); }
          break;
        case 'frost':
          K.speckle(x, 7 + v, 0, 0, T, T, 18, K.rgba('#ffffff', 0.35), 2);
          x.strokeStyle = K.rgba('#ffffff', 0.25); x.lineWidth = 1;
          x.beginPath(); x.moveTo(rng() * T, 0); x.lineTo(rng() * T, T); x.stroke();
          break;
        case 'foundry':
          x.strokeStyle = K.shade(base, -0.3); x.lineWidth = 2; x.strokeRect(1, 1, T - 2, T - 2);
          x.strokeStyle = K.shade(base, 0.12); x.lineWidth = 1; x.beginPath(); x.moveTo(2, 2); x.lineTo(T - 2, 2); x.stroke();
          for (const [a, b] of [[6, 6], [T - 6, 6], [6, T - 6], [T - 6, T - 6]]) K.circle(x, a, b, 2, K.shade(base, 0.25));
          if (v === 3) { x.fillStyle = 'rgba(0,0,0,0.35)'; for (let i = 0; i < 4; ++i) x.fillRect(14, 14 + i * 6, 20, 3); x.fillStyle = 'rgba(255,120,40,0.25)'; x.fillRect(14, 15, 20, 1); }
          break;
        case 'neon':
          x.strokeStyle = K.rgba(p.grout, 0.9); x.lineWidth = 1.5; x.strokeRect(0.75, 0.75, T - 1.5, T - 1.5);
          x.fillStyle = K.rgba(p.accent, 0.08); x.fillRect(4, 4, T - 8, T - 8);
          if (v === 2) K.circle(x, T / 2, T / 2, 2, K.rgba(p.accent, 0.6));
          break;
        case 'keep':
          x.strokeStyle = p.grout; x.lineWidth = 2;
          x.strokeRect(1, 1, T - 2, T - 2);
          x.beginPath(); x.moveTo(T / 2, 1); x.lineTo(T / 2, T / 2); x.moveTo(1, T / 2); x.lineTo(T - 1, T / 2); x.stroke();
          K.speckle(x, 30 + v, 0, 0, T, T, 10, K.rgba('#000000', 0.18), 3);
          break;
      }
    });
  }

  function hard(w) {
    return K.sprite('hard:' + w, T, T, (x) => {
      const p = pal(w);
      const id = WORLDS[w].id;
      /* front face */
      const fg = x.createLinearGradient(0, T - SIDE - 2, 0, T);
      fg.addColorStop(0, p.hardSide); fg.addColorStop(1, K.shade(p.hardSide, -0.35));
      x.fillStyle = fg;
      K.roundRect(x, 1, 6, T - 2, T - 6, 6); x.fill();
      /* top face */
      const tg = x.createLinearGradient(0, 0, 0, T - SIDE);
      tg.addColorStop(0, K.shade(p.hardTop, 0.18)); tg.addColorStop(1, p.hardTop);
      x.fillStyle = tg;
      K.roundRect(x, 1, 1, T - 2, T - SIDE - 1, 6); x.fill();
      x.strokeStyle = K.rgba(p.hardEdge, 0.8); x.lineWidth = 2;
      x.beginPath(); x.moveTo(6, 2.5); x.lineTo(T - 6, 2.5); x.stroke();
      if (id === 'neon') {
        x.strokeStyle = K.rgba(p.hardEdge, 0.7); x.lineWidth = 1.5;
        K.roundRect(x, 6, 6, T - 12, T - SIDE - 11, 3); x.stroke();
        x.fillStyle = K.rgba(p.hardEdge, 0.9); x.fillRect(8, T - SIDE + 3, T - 16, 2);
      } else if (id === 'foundry') {
        x.fillStyle = K.rgba('#000000', 0.25);
        for (let i = 0; i < 3; ++i) x.fillRect(8 + i * 12, 8, 6, T - SIDE - 14);
        x.fillStyle = '#ffb030'; x.fillRect(4, T - SIDE + 2, T - 8, 3);
        x.fillStyle = '#2a2a2a';
        for (let i = 0; i < 5; ++i) x.fillRect(6 + i * 8, T - SIDE + 2, 4, 3);
      } else if (id === 'keep') {
        x.strokeStyle = K.rgba('#000000', 0.3); x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(1, 14); x.lineTo(T - 1, 14); x.moveTo(T / 2, 1); x.lineTo(T / 2, 14); x.moveTo(14, 14); x.lineTo(14, T - SIDE); x.moveTo(34, 14); x.lineTo(34, T - SIDE); x.stroke();
      } else if (id === 'frost') {
        x.fillStyle = K.rgba('#ffffff', 0.7);
        x.beginPath(); x.moveTo(4, 4); x.lineTo(18, 4); x.lineTo(4, 16); x.fill();
        x.fillStyle = K.rgba('#ffffff', 0.85);
        for (let i = 0; i < 4; ++i) { x.beginPath(); x.moveTo(6 + i * 11, T - 1); x.lineTo(10 + i * 11, T - 1); x.lineTo(8 + i * 11, T + 5); x.fill(); }
      } else {
        K.speckle(x, 77 + w, 4, 4, T - 8, T - SIDE - 8, 8, K.rgba('#ffffff', 0.18), 3);
        x.strokeStyle = K.rgba('#000000', 0.18); x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(10, 18); x.lineTo(18, 24); x.lineTo(16, 30); x.stroke();
      }
    });
  }

  function soft(w) {
    return K.sprite('soft:' + w, T, T, (x) => {
      const p = pal(w);
      const id = WORLDS[w].id;
      x.fillStyle = K.shade(p.softB, -0.35);
      K.roundRect(x, 2, 8, T - 4, T - 8, 5); x.fill();
      if (id === 'frost') {
        const g = x.createLinearGradient(0, 0, T, T);
        g.addColorStop(0, K.rgba('#ffffff', 0.95)); g.addColorStop(0.4, p.softA); g.addColorStop(1, p.softB);
        x.fillStyle = g; K.roundRect(x, 3, 3, T - 6, T - 10, 6); x.fill();
        x.strokeStyle = K.rgba('#ffffff', 0.8); x.lineWidth = 2; x.beginPath(); x.moveTo(10, 10); x.lineTo(22, 10); x.stroke();
        x.strokeStyle = K.rgba('#2a6a9a', 0.5); x.lineWidth = 1.5; x.beginPath(); x.moveTo(30, 8); x.lineTo(26, 20); x.lineTo(34, 28); x.stroke();
        return;
      }
      if (id === 'neon' || id === 'foundry') {
        x.fillStyle = p.softA; K.roundRect(x, 3, 3, T - 6, T - 10, 5); x.fill();
        x.strokeStyle = p.softMortar; x.lineWidth = 2.5; K.roundRect(x, 6, 6, T - 12, T - 16, 3); x.stroke();
        x.beginPath(); x.moveTo(7, 7); x.lineTo(T - 7, T - 11); x.moveTo(T - 7, 7); x.lineTo(7, T - 11); x.stroke();
        if (id === 'foundry') K.speckle(x, 5, 6, 6, T - 12, T - 18, 10, 'rgba(60,20,10,0.45)', 3);
        else { x.fillStyle = K.rgba(p.softMortar, 0.35); x.fillRect(4, T - 10, T - 8, 3); }
        return;
      }
      if (id === 'keep') {
        x.fillStyle = p.softB; K.roundRect(x, 3, 3, T - 6, T - 10, 4); x.fill();
        const books = ['#8a2a2a', '#2a5a8a', '#6a8a2a', '#8a6a2a', '#5a2a7a', '#2a7a6a'];
        for (let row = 0; row < 2; ++row)
          for (let i = 0; i < 6; ++i) {
            x.fillStyle = books[(i + row * 2) % books.length];
            x.fillRect(6 + i * 6.2, 6 + row * 16, 5, 14 - (i % 3));
          }
        x.fillStyle = K.shade(p.softB, -0.3); x.fillRect(4, 20, T - 8, 2); x.fillRect(4, 36, T - 8, 2);
        return;
      }
      /* meadow bricks */
      x.fillStyle = p.softA; K.roundRect(x, 3, 3, T - 6, T - 10, 4); x.fill();
      x.strokeStyle = p.softMortar; x.lineWidth = 2;
      for (let r = 0; r < 3; ++r) {
        const y = 3 + r * 12;
        x.beginPath(); x.moveTo(3, y + 12); x.lineTo(T - 3, y + 12); x.stroke();
        const off = r % 2 ? 10 : 20;
        for (let c = off; c < T - 4; c += 20) { x.beginPath(); x.moveTo(c, y); x.lineTo(c, y + 12); x.stroke(); }
      }
      x.fillStyle = K.rgba('#ffffff', 0.18); x.fillRect(5, 4, T - 10, 3);
      x.fillStyle = '#5aa83a'; x.beginPath(); x.ellipse(10, 6, 7, 4, 0, 0, Math.PI * 2); x.fill();
    });
  }

  function crate() {
    return K.sprite('crate', T, T, (x) => {
      x.fillStyle = '#3a4048'; K.roundRect(x, 2, 8, T - 4, T - 8, 5); x.fill();
      const g = x.createLinearGradient(0, 0, 0, T);
      g.addColorStop(0, '#a8b4c0'); g.addColorStop(1, '#6a7480');
      x.fillStyle = g; K.roundRect(x, 3, 3, T - 6, T - 10, 5); x.fill();
      x.strokeStyle = '#4a525c'; x.lineWidth = 3; K.roundRect(x, 6, 6, T - 12, T - 16, 3); x.stroke();
      x.lineWidth = 4; x.beginPath(); x.moveTo(8, 8); x.lineTo(T - 8, T - 12); x.stroke();
      for (const [a, b] of [[8, 8], [T - 8, 8], [8, T - 12], [T - 8, T - 12]]) K.circle(x, a, b, 2.5, '#dfe6ee');
    });
  }

  function ice() {
    return K.sprite('ice', T, T, (x) => {
      const g = x.createLinearGradient(0, 0, T, T);
      g.addColorStop(0, '#e8f8ff'); g.addColorStop(0.5, '#a8dcf4'); g.addColorStop(1, '#c8ecff');
      x.fillStyle = g; x.fillRect(0, 0, T, T);
      x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(8, 30); x.lineTo(30, 8); x.moveTo(16, 38); x.lineTo(38, 16); x.stroke();
      x.strokeStyle = 'rgba(80,150,200,0.35)'; x.lineWidth = 1; x.strokeRect(0.5, 0.5, T - 1, T - 1);
    });
  }

  function belt(dir, frame) {
    return K.sprite('belt:' + dir + ':' + frame, T, T, (x) => {
      x.fillStyle = '#2a2a30'; x.fillRect(0, 0, T, T);
      x.fillStyle = '#3a3a44';
      x.save();
      x.translate(T / 2, T / 2);
      x.rotate([Math.PI / 2, -Math.PI / 2, Math.PI, 0][dir]);
      x.fillRect(-T / 2, -T / 2 + 4, T, T - 8);
      x.fillStyle = '#ffb030';
      for (let i = -1; i < 3; ++i) {
        const ox = -T / 2 + i * 16 + frame * 4;
        x.beginPath(); x.moveTo(ox, -10); x.lineTo(ox + 8, 0); x.lineTo(ox, 10); x.lineTo(ox - 4, 10); x.lineTo(ox + 4, 0); x.lineTo(ox - 4, -10); x.fill();
      }
      x.restore();
      x.fillStyle = '#555'; x.fillRect(0, 0, T, 2); x.fillRect(0, T - 2, T, 2);
    });
  }

  function tele() {
    return K.sprite('tele', T, T, (x) => {
      K.ellipse(x, T / 2, T / 2 + 2, 21, 17, '#1a1a2a');
      x.strokeStyle = '#7ef9ff'; x.lineWidth = 3;
      x.beginPath(); x.ellipse(T / 2, T / 2 + 2, 18, 14, 0, 0, Math.PI * 2); x.stroke();
      x.strokeStyle = '#ff4fd8'; x.lineWidth = 2;
      x.beginPath(); x.ellipse(T / 2, T / 2 + 2, 11, 8, 0, 0, Math.PI * 2); x.stroke();
    });
  }

  function exitDoor(open) {
    return K.sprite('exit:' + open, T, T + 8, (x) => {
      x.fillStyle = '#3a2a1a'; K.roundRect(x, 6, 4, T - 12, T, 16); x.fill();
      if (open) {
        const g = x.createRadialGradient(T / 2, T / 2 + 6, 2, T / 2, T / 2 + 6, 22);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#9af0ff'); g.addColorStop(1, '#2a6aff');
        x.fillStyle = g; K.roundRect(x, 10, 8, T - 20, T - 6, 12); x.fill();
      } else {
        x.fillStyle = '#7a4a2a'; K.roundRect(x, 10, 8, T - 20, T - 6, 12); x.fill();
        x.strokeStyle = '#4a2a14'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(T / 2, 10); x.lineTo(T / 2, T + 2); x.stroke();
        K.circle(x, T / 2 + 6, T / 2 + 8, 2.5, '#ffd84a');
      }
      x.fillStyle = '#ffd84a'; x.font = 'bold 9px sans-serif'; x.textAlign = 'center'; x.fillText('EXIT', T / 2, 3 + 6);
    });
  }

  /* Seasonal touches on stone: snow caps, blossoms, shells, leaves and pumpkins, fairy lights */
  function decor(season, v) {
    return K.sprite('decor:' + season + ':' + v, T, T, (x) => {
      const rng = R.makeRng(400 + v * 31);
      switch (season) {
        case 'winter':
          x.fillStyle = '#ffffff';
          x.beginPath(); x.moveTo(1, 10); x.quadraticCurveTo(10, -2, 24, 4); x.quadraticCurveTo(38, -2, T - 1, 10); x.lineTo(T - 1, 14); x.quadraticCurveTo(24, 8, 1, 14); x.fill();
          break;
        case 'spring':
          for (let i = 0; i < 3; ++i) {
            const fx = 8 + rng() * 32, fy = 6 + rng() * 22;
            for (let k = 0; k < 5; ++k) K.circle(x, fx + Math.cos(k * 1.26) * 4, fy + Math.sin(k * 1.26) * 4, 3, i % 2 ? '#ffc0dc' : '#ffffff');
            K.circle(x, fx, fy, 2, '#ffd84a');
          }
          break;
        case 'summer':
          if (v % 2) { x.save(); x.translate(16, 1); x.scale(0.2, 0.2); NS.icons.PAINT.shell(x, '#ffd0b0'); x.restore(); break; }
          K.circle(x, 12, 10, 4, 'rgba(255,240,170,0.8)');
          break;
        case 'autumn':
          for (let i = 0; i < 4; ++i) {
            x.fillStyle = ['#ff8a2a', '#d8501a', '#ffc040'][i % 3];
            x.save(); x.translate(6 + rng() * 36, 4 + rng() * 26); x.rotate(rng() * 6);
            x.beginPath(); x.ellipse(0, 0, 5, 2.5, 0, 0, Math.PI * 2); x.fill(); x.restore();
          }
          if (v === 1) { x.save(); x.translate(22, 6); x.scale(0.26, 0.26); NS.icons.PAINT.pumpkin(x, '#ff8a1a'); x.restore(); }
          break;
        case 'yearend':
          x.strokeStyle = '#2a4a2a'; x.lineWidth = 1.5;
          x.beginPath(); x.moveTo(0, 6); x.quadraticCurveTo(T / 2, 16, T, 6); x.stroke();
          for (let i = 0; i < 5; ++i) {
            const t = (i + 0.5) / 5;
            K.circle(x, t * T, 6 + Math.sin(t * Math.PI) * 9 + 3, 3, ['#ff5da0', '#ffd84a', '#4fd0ff', '#7cf08a', '#ff8a3c'][i]);
          }
          break;
      }
    });
  }

  /* The static layer of a level: floors under everything, stone, ice, shadows and decor */
  let layer = null;
  let layerKey = '';

  function floorLayer(level, season) {
    const key = level.seed + ':' + level.world + ':' + level.name + ':' + season;
    if (layer && layerKey === key) return layer;
    layerKey = key;
    layer = layer || K.canvas(COLS * T, ROWS * T + SIDE);
    const x = layer.getContext('2d');
    x.clearRect(0, 0, layer.width, layer.height);
    const w = level.world;
    const g = level.grid;
    for (let r = 0; r < ROWS; ++r)
      for (let c = 0; c < COLS; ++c) {
        const t = g[r * COLS + c];
        const v = ((c + r) & 1) + (R.hashString(c + ',' + r) % 7 === 0 ? 2 : 0);
        x.drawImage(t === T_ICE ? ice() : floor(w, v), c * T, r * T);
      }
    /* soft shadows of the stone onto the floor */
    x.fillStyle = 'rgba(0,0,0,0.22)';
    for (let r = 0; r < ROWS; ++r)
      for (let c = 0; c < COLS; ++c)
        if (g[r * COLS + c] === T_HARD) x.fillRect(c * T + 6, r * T + T - 2, T - 2, 8);
    for (let r = 0; r < ROWS; ++r)
      for (let c = 0; c < COLS; ++c) {
        if (g[r * COLS + c] !== T_HARD) continue;
        x.drawImage(hard(w), c * T, r * T);
        const h = R.hashString('d' + c + ':' + r);
        if (season !== 'none' && (r === 0 ? (c % 3 === 1) : h % 6 === 0)) x.drawImage(decor(season, h % 4), c * T, r * T);
      }
    return layer;
  }

  function beltDir(t) {
    return t === T_BELT_D ? 0 : t === T_BELT_U ? 1 : t === T_BELT_L ? 2 : t === T_BELT_R ? 3 : -1;
  }

  /* Paints every tile of a world once so the first frame never stalls */
  function warm(w) {
    for (let v = 0; v < 4; ++v) floor(w, v);
    hard(w); soft(w); crate(); ice(); tele(); exitDoor(false); exitDoor(true);
    for (let d = 0; d < 4; ++d) for (let f = 0; f < 4; ++f) belt(d, f);
  }

  Object.assign(NS.tileArt, {
    SIDE, floor, hard, soft, crate, ice, belt, tele, exitDoor, decor, floorLayer, beltDir, warm, T_TELE
  });
})();
