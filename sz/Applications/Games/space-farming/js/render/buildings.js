/* Space Farming - buildings with their animated details, and joined fences.
   Reads: G.buildings, G.currentSeason, G.dayPhase, G.animT, G.inspect */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, BASE_TILE_SIZE, GRID_OFFSET_X, GRID_OFFSET_Y, BUILDINGS, ctx, SPRITE_PAINTERS, drawSprite,
    getBuildingRange, hash2, nightAmount, drawGlow, windStrength, lightAt, buildingDrop } = NS;

  /* ── Buildings with animated details ── */

  const BLADE_SPRITE_KEY = 'turbineBlades';
  SPRITE_PAINTERS[BLADE_SPRITE_KEY] = (p, P) => {
    p.poly([[8, 7.5], [7, 0], [9, 0]], P.white);
    p.poly([[8, 7.5], [15, 11], [14, 12.5]], P.white);
    p.poly([[8, 7.5], [1, 11], [2, 12.5]], P.white);
    p.disc(8, 7.5, 1.4, P.grey);
  };
  SPRITE_PAINTERS.turbineTower = (p, P) => {
    p.poly([[7, 6], [9, 6], [10.5, 15], [5.5, 15]], P.white);
    p.rect(6, 5, 4, 3, P.steel);
    p.rect(4, 14, 8, 2, P.dgrey);
  };

  function drawBuilding(r, c, bld) {
    const T = BASE_TILE_SIZE;
    const bdef = BUILDINGS[bld.typeIndex];
    const lvl = bld.level || 1;
    const cx = GRID_OFFSET_X + (c + 0.5) * T, cy = GRID_OFFSET_Y + (r + 0.5) * T;
    const baseY = GRID_OFFSET_Y + (r + 1) * T - 6;
    const ph = hash2(c * 7, r * 3) * TWO_PI;
    const name = bdef.name;
    const night = nightAmount();

    if (name === 'Fence') {
      drawFenceTile(r, c, lvl);
      return;
    }
    // Stone pad
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 2, T * 0.42, T * 0.13, 0, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = G.currentSeason === 3 ? '#c8d0dc' : '#7a7468';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 4, T * 0.38, T * 0.11, 0, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 5, T * 0.3, T * 0.06, 0, Math.PI, TWO_PI);
    ctx.fill();

    const size = 44 + Math.min(lvl - 1, 5) * 1.2;
    const drop = buildingDrop(r, c);
    if (drop > 0 && drop < 1) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, drop * 3);
      ctx.translate(0, -(1 - drop * drop) * 70);
    } else if (drop >= 1) {
      const sq = Math.sin((drop - 1) / 0.35 * Math.PI) * 0.12;
      ctx.save();
      ctx.translate(cx, baseY);
      ctx.scale(1 + sq, 1 - sq);
      ctx.translate(-cx, -baseY);
    }
    const top = baseY - 4 - size;
    if (name === 'Wind Turbine') {
      drawSprite('turbineTower', cx, top + size / 2, size);
      const speed = (1.2 + windStrength() * 1.4) * (G.dayPhase >= 0.5 ? 1.3 : 1);
      ctx.save();
      ctx.translate(cx, top + size * 0.34);
      ctx.rotate(G.animT * speed + ph);
      drawSprite(BLADE_SPRITE_KEY, 0, 0, size * 1.05);
      ctx.restore();
    } else if (name === 'Scarecrow') {
      ctx.save();
      ctx.translate(cx, baseY - 4);
      ctx.rotate(Math.sin(G.animT * 1.4 + ph) * 0.05 * windStrength());
      drawSprite(bdef.sprite, 0, -size / 2, size);
      ctx.restore();
    } else if (name === 'Harvester') {
      const bob = Math.abs(Math.sin(G.animT * 3 + ph)) * 2;
      drawSprite(bdef.sprite, cx, top + size / 2 - bob, size);
      ctx.fillStyle = `rgba(120,255,200,${0.6 + Math.sin(G.animT * 6) * 0.3})`;
      ctx.fillRect(cx - size * 0.16, top + size * 0.39 - bob, 3, 3);
      ctx.fillRect(cx + size * 0.09, top + size * 0.39 - bob, 3, 3);
      lightAt(cx, top + size * 0.4, T * 0.6, '#7affc8', 0.5);
    } else {
      drawSprite(bdef.sprite, cx, top + size / 2, size);
    }

    // Animated details
    switch (name) {
      case 'Sprinkler': {
        const n = 10;
        for (let i = 0; i < n; ++i) {
          const t = (G.animT * 0.9 + i / n) % 1;
          const ang = G.animT * 2.2 + i * (TWO_PI / n) + ph;
          const dist = t * T * (0.7 + Math.min(4, getBuildingRange(bld) - 1) * 0.12);
          const hgt = Math.sin(t * Math.PI) * 16;
          const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.5;
          ctx.fillStyle = `rgba(160,220,255,${0.85 * (1 - t)})`;
          ctx.fillRect(cx + dx - 1, top + size * 0.3 + dy - hgt + t * 14, 2, 3);
        }
        break;
      }
      case 'Solar Panel': {
        if (night < 0.5) {
          const k = (G.animT * 0.35 + ph) % 2;
          if (k < 1) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(cx - size * 0.45, top + size * 0.15, size * 0.9, size * 0.5);
            ctx.clip();
            const gx = cx - size * 0.6 + k * size * 1.2;
            const g = ctx.createLinearGradient(gx - 8, 0, gx + 8, 0);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.5, 'rgba(255,255,255,0.65)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(gx - 10, top, 20, size);
            ctx.restore();
          }
        }
        break;
      }
      case 'Greenhouse':
        if (night > 0.2) {
          ctx.fillStyle = `rgba(200,255,190,${0.25 * night})`;
          ctx.fillRect(cx - size * 0.4, top + size * 0.35, size * 0.8, size * 0.55);
        }
        lightAt(cx, top + size * 0.6, T * 1.3, '#d0ffc0', 0.9);
        break;
      case 'Silo': {
        const blink = Math.sin(G.animT * 4 + ph) > 0.4;
        if (blink) {
          ctx.fillStyle = '#ff5a5a';
          ctx.fillRect(cx - 2, top + size * 0.12, 4, 4);
          lightAt(cx, top + size * 0.14, T * 0.5, '#ff6a5a', 0.5);
        }
        break;
      }
      case 'Compost Bin':
        for (let i = 0; i < 3; ++i) {
          const t = (G.animT * 0.4 + i / 3 + ph) % 1;
          ctx.fillStyle = `rgba(220,230,210,${0.35 * (1 - t)})`;
          ctx.beginPath();
          ctx.arc(cx + Math.sin(t * 6 + i) * 4, top + size * 0.15 - t * 22, 3 + t * 5, 0, TWO_PI);
          ctx.fill();
        }
        break;
      case 'Auto-Planter L1':
      case 'Auto-Planter L2': {
        const k = (G.animT * 1.5 + ph) % 2;
        if (k < 1) {
          ctx.fillStyle = '#c8a050';
          ctx.fillRect(cx - 2 + Math.sin(k * Math.PI) * 6, top + size * 0.2 - Math.sin(k * Math.PI) * 10, 3, 3);
        }
        break;
      }
      case 'Grow Lamp': {
        const n = nightAmount();
        if (n > 0.05)
          drawGlow(cx, top + size * 0.2, T * 1.2, '#ffeca0', 0.35 * n);
        lightAt(cx, top + size * 0.25, T * (1.6 + getBuildingRange(bld) * 0.8), '#ffe8a0', 1);
        break;
      }
      case 'Pest Zapper': {
        if (Math.sin(G.animT * 7 + ph) > 0.6) {
          ctx.strokeStyle = '#bff8ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(cx, top + size * 0.15);
          for (let k = 1; k <= 3; ++k)
            ctx.lineTo(cx + (Math.random() - 0.5) * 16, top + size * 0.15 - k * 4);
          ctx.stroke();
        }
        lightAt(cx, top + size * 0.2, T * 0.8, '#9ff0ff', 0.7);
        break;
      }
      case 'Auto-Collector': {
        ctx.save();
        ctx.fillStyle = '#3a3e4a';
        ctx.fillRect(cx - size * 0.45, baseY - 12, size * 0.9, 6);
        ctx.fillStyle = '#7a7e8a';
        const off = (G.animT * 18) % 8;
        const bl = cx - size * 0.45, br = cx + size * 0.45;
        for (let x = bl - 8 + off; x < br; x += 8) {
          const x0 = Math.max(bl, x), x1 = Math.min(br, x + 3);
          if (x1 > x0)
            ctx.fillRect(x0, baseY - 12, x1 - x0, 6);
        }
        ctx.restore();
        break;
      }
    }

    if (drop > 0)
      ctx.restore();

    // Level pips
    if (lvl > 1) {
      const n = lvl - 1;
      const w = n * 6 - 2;
      for (let i = 0; i < n; ++i) {
        ctx.fillStyle = '#2a1a08';
        ctx.fillRect(cx - w / 2 + i * 6 - 1, baseY - 1, 6, 6);
        ctx.fillStyle = '#ffd75a';
        ctx.fillRect(cx - w / 2 + i * 6, baseY, 4, 4);
      }
    }
    if (G.inspect && G.inspect.row === r && G.inspect.col === c) {
      ctx.strokeStyle = `rgba(76,196,255,${0.6 + Math.sin(G.animT * 5) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(GRID_OFFSET_X + c * T + 2, GRID_OFFSET_Y + r * T + 2, T - 4, T - 4);
    }
  }

  function isFenceAt(r, c) {
    const b = G.buildings[r]?.[c];
    return !!b && BUILDINGS[b.typeIndex].name === 'Fence';
  }

  /* Fences join up with neighbouring fences */
  function drawFenceTile(r, c, lvl) {
    const T = BASE_TILE_SIZE;
    const x = GRID_OFFSET_X + c * T, y = GRID_OFFSET_Y + r * T;
    const cx = x + T / 2, cy = y + T / 2 + 6;
    const wood = lvl >= 5 ? '#8a8ea0' : '#9a5b34', dark = lvl >= 5 ? '#4a4e60' : '#5e3820', light = lvl >= 5 ? '#d0d8e8' : '#c88a54';
    const railTo = (tx, ty) => {
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 9);
      ctx.lineTo(tx, ty - 9);
      ctx.lineTo(tx, ty - 6);
      ctx.lineTo(cx, cy - 6);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - 2);
      ctx.lineTo(tx, ty - 2);
      ctx.lineTo(tx, ty + 1);
      ctx.lineTo(cx, cy + 1);
      ctx.fill();
    };
    const n = isFenceAt(r - 1, c), s = isFenceAt(r + 1, c), w = isFenceAt(r, c - 1), e = isFenceAt(r, c + 1);
    if (w || (!n && !s && !e)) railTo(x, cy);
    if (e || (!n && !s && !w)) railTo(x + T, cy);
    if (n) railTo(cx, y + 6);
    if (s) railTo(cx, y + T + 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 4, 7, 3, 0, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx - 4, cy - 16, 8, 20);
    ctx.fillStyle = wood;
    ctx.fillRect(cx - 3, cy - 15, 6, 18);
    ctx.fillStyle = light;
    ctx.fillRect(cx - 3, cy - 15, 2, 18);
    if (G.currentSeason === 3) {
      ctx.fillStyle = '#f4f8ff';
      ctx.fillRect(cx - 4, cy - 18, 8, 3);
    }
    if (lvl >= 5 && Math.sin(G.animT * 9 + r + c) > 0.85) {
      ctx.strokeStyle = '#9ff0ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 16);
      ctx.lineTo(cx + 5, cy - 10);
      ctx.lineTo(cx - 2, cy - 6);
      ctx.lineTo(cx + 4, cy);
      ctx.stroke();
      lightAt(cx, cy - 8, T * 0.5, '#9ff0ff', 0.6);
    }
  }

  Object.assign(NS, { drawBuilding });

})();
