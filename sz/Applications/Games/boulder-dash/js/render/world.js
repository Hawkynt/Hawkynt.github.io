/* Draws a cave: the smooth-follow camera with shake, the vista in the letterbox, the back wall,
   every visible cell from the cached tiles (auto-tiled dirt, interpolated falling and rolling
   objects, animated gems, exit, moss, lava, items, creatures, explosions), lit dynamite, the
   boss, the miner with squash and stretch, shield and power-up auras, an additive glow pass and
   the darkness of deep caves lit by the lamp. Owns the camera. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const K = NS.artKit;
  const G = NS.state;
  const CA = NS.creatureArt;
  const { ctx, visible } = NS.view;
  const T = C.TILE;

  const cam = { x: 0, y: 0, init: false, caveSeed: -1 };
  let light = null, lightX = null;

  const OPEN = new Uint8Array(C.CELL_TYPES);
  OPEN[C.EMPTY] = OPEN[C.PLAYER] = OPEN[C.EXPLODE] = OPEN[C.FIREFLY] = OPEN[C.BUTTERFLY] = OPEN[C.BAT] = OPEN[C.BOSS] = OPEN[C.MOLE] = 1;

  function themeOf(run) {
    const ts = G.save.tileset;
    if (ts && ts !== 'auto' && NS.story.THEMES[ts]) return ts;
    return run && run.params ? run.params.theme : 'amber';
  }

  function palette() {
    return NS.story.THEMES[themeOf(G.run || G.demo)] || NS.story.THEMES.amber;
  }

  /* where the cave is drawn: view rect minus the HUD band */
  function frameRect(hud) {
    const v = visible();
    return { x0: v.x0, y0: v.y0 + (hud ? C.HUD_H : 0), w: v.w, h: v.h - (hud ? C.HUD_H : 0) };
  }

  function updateCamera(cv, dt, hud, snap) {
    const f = frameRect(hud);
    const p = cv.player;
    const a = Math.min(1, p.moveT / cv.playerPeriod);
    const px = (p.fc + (p.c - p.fc) * a) * T + T / 2, py = (p.fr + (p.r - p.fr) * a) * T + T / 2;
    const W = cv.w * T, H = cv.h * T;
    let tx = W <= f.w ? (W - f.w) / 2 : Math.max(0, Math.min(W - f.w, px - f.w / 2));
    let ty = H <= f.h ? (H - f.h) / 2 : Math.max(0, Math.min(H - f.h, py - f.h / 2));
    if (!cam.init || snap || cam.caveSeed !== cv.seed) { cam.x = tx; cam.y = ty; cam.init = true; cam.caveSeed = cv.seed; }
    const k = Math.min(1, dt * 6);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }

  function interp(cv) {
    return Math.min(1, cv.clock / cv.worldPeriod);
  }

  let cap = null;
  function snowCap() {
    if (cap) return cap;
    cap = K.canvas(T, T);
    const x = cap.getContext('2d');
    x.fillStyle = '#f4fbff';
    x.beginPath();
    x.moveTo(8, 9); x.quadraticCurveTo(T / 2, -2, T - 8, 9); x.quadraticCurveTo(T - 12, 13, T / 2 + 4, 10);
    x.quadraticCurveTo(T / 2, 15, T / 2 - 4, 10); x.quadraticCurveTo(12, 13, 8, 9);
    x.fill();
    x.fillStyle = 'rgba(160,200,230,0.6)';
    x.fillRect(12, 9, T - 24, 1.5);
    return cap;
  }

  function drawCells(cv, tiles, ox, oy, c0, c1, r0, r1) {
    const snowy = !!G.season && (G.season.id === 'winter' || G.season.id === 'yearend');
    const { w, cells, mvx, mvy, bg } = cv;
    const a = interp(cv);
    const back = 1 - a;
    const time = G.time;
    const gf = Math.floor(time * 9);
    const af = Math.floor(time * 4);
    for (let r = r0; r <= r1; ++r) {
      const rowY = oy + r * T;
      for (let c = c0; c <= c1; ++c) {
        const i = r * w + c;
        const t = cells[i];
        if (t === C.EMPTY || t === C.PLAYER || t === C.BOSS) continue;
        let x = ox + c * T, y = rowY;
        if (bg[i]) ctx.drawImage(tiles.dirt[0][0], x, y);
        if (mvx[i] || mvy[i]) {
          x -= mvx[i] * back * T;
          y -= Math.min(1, mvy[i]) * back * T;
        }
        switch (t) {
          case C.DIRT: {
            const m = (OPEN[cells[i - w]] ? 1 : 0) | (OPEN[cells[i + 1]] ? 2 : 0) | (OPEN[cells[i + w]] ? 4 : 0) | (OPEN[cells[i - 1]] ? 8 : 0);
            ctx.drawImage(tiles.dirt[(r * 7 + c * 3) % 5 === 0 ? 1 : 0][m], x, y);
            break;
          }
          case C.BRICK: ctx.drawImage(tiles.brick, x, y); break;
          case C.STEEL: ctx.drawImage(tiles.steel, x, y); break;
          case C.BOULDER:
            if (mvx[i]) {
              ctx.save();
              ctx.translate(x + T / 2, y + T / 2);
              ctx.rotate(mvx[i] * a * Math.PI / 2);
              ctx.drawImage(tiles.boulder[(r * 7 + c * 13) & 3], -T / 2, -T / 2);
              ctx.restore();
            } else {
              ctx.drawImage(tiles.boulder[(c * 13 + cv.seed) & 3], x, y);
              if (snowy && OPEN[cells[i - w]]) ctx.drawImage(snowCap(), x, y);
            }
            break;
          case C.GEM: ctx.drawImage(tiles.gem[(gf + c + r * 3) & 7], x, y); break;
          case C.BIGGEM: ctx.drawImage(tiles.biggem[(gf + c * 2 + r) & 7], x, y); break;
          case C.EXIT: ctx.drawImage(cv.exitOpen ? tiles.exitOpen[gf & 7] : tiles.exitClosed, x, y); break;
          case C.MAGIC: ctx.drawImage(cv.magic.state === 1 ? tiles.magicOn[(af + c) & 3] : tiles.magicOff, x, y); break;
          case C.AMOEBA: ctx.drawImage(tiles.amoeba[(af + c + r) & 3], x, y); break;
          case C.LAVA: ctx.drawImage(tiles.lava[(af + c) & 3], x, y); break;
          case C.ICE: ctx.drawImage(tiles.ice, x, y); break;
          case C.TNT: ctx.drawImage(tiles.tnt, x, y); break;
          case C.ITEM: ctx.drawImage(CA.itemTile(cv.item[i], (gf >> 1) & 7), x, y + Math.sin(time * 3 + c) * 2); break;
          case C.EXPLODE: ctx.drawImage(tiles.explode[Math.max(0, Math.min(3, 3 - cv.aux[i]))], x - 4, y - 4, T + 8, T + 8); break;
          default:
            if (C.CREATURE[t]) {
              const img = CA.creature(t, cv.frozen ? 0 : Math.floor(time * (t === C.FIREFLY ? 10 : 8)));
              if (cv.frozen) ctx.globalAlpha = 0.65;
              ctx.drawImage(img, x, y);
              if (cv.frozen) {
                ctx.globalAlpha = 0.5;
                ctx.drawImage(tiles.ice, x, y);
                ctx.globalAlpha = 1;
              }
            }
        }
      }
    }
  }

  function drawBombs(cv, ox, oy) {
    for (let k = 0; k < cv.bombs.length; ++k) {
      const b = cv.bombs[k];
      const x = ox + (b.i % cv.w) * T + T / 2, y = oy + ((b.i / cv.w) | 0) * T + T / 2;
      const blink = Math.sin(G.time * (8 + (12 - b.fuse) * 3)) > 0;
      ctx.save();
      ctx.translate(x, y + 4);
      ctx.rotate(-0.4);
      ctx.fillStyle = blink ? '#ff7a5a' : '#c8301a';
      ctx.fillRect(-5, -11, 10, 22);
      ctx.fillStyle = '#f4e6c8';
      ctx.fillRect(-5, -3, 10, 5);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(K.glow('#ffb347'), x - 4, y - 30, 24, 24);
      ctx.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.6) NS.fx.spawn(x + 8 - ox + 0, y - 16 - oy, (Math.random() - 0.5) * 60, -40 - Math.random() * 40, 0.3, 2, '#ffd54a', 0, 200);
    }
  }

  function drawBoss(cv, ox, oy) {
    const b = cv.boss;
    if (!b || cv.bossDefeated) return;
    const per = Math.max(2, NS.items.BOSSES[b.kind].every) * cv.worldPeriod;
    const since = (cv.tick - (b.moved || 0)) * cv.worldPeriod + cv.clock;
    const a = Math.min(1, since / Math.min(per, cv.worldPeriod * 2));
    const x = ox + (b.fc + (b.c - b.fc) * a) * T, y = oy + (b.fr + (b.r - b.fr) * a) * T;
    const flash = cv.tick - b.hitT < 3 && Math.floor(G.time * 20) % 2 === 0;
    const img = CA.boss(b.kind, Math.floor(G.time * 3) & 1, flash);
    const sq = 1 + Math.sin(G.time * 5) * 0.03;
    ctx.save();
    ctx.translate(x + T, y + T * 2);
    ctx.scale((b.face < 0 ? 1 : -1) * (2 - sq), sq);
    ctx.drawImage(img, -T, -T * 2);
    ctx.restore();
  }

  function minerPose(cv) {
    const p = cv.player;
    if (cv.won) return 'cheer';
    const moving = p.moveT < cv.playerPeriod;
    const f = Math.floor(G.time * 10) & 3;
    if (p.digT > 0 && moving) return 'swing' + (p.moveT < cv.playerPeriod / 2 ? 0 : 1);
    if (p.push > 0) return 'push' + (Math.floor(G.time * 8) & 1);
    if (moving && (p.dir === 1 || p.dir === 3)) return 'walk' + f;
    if (moving) return 'walk' + f;
    return (G.time % 3.2) < 0.12 ? 'blink' : 'front';
  }

  function drawPlayer(cv, ox, oy, skinId) {
    const p = cv.player;
    if (!p.alive) return;
    const a = Math.min(1, p.moveT / cv.playerPeriod);
    const e = a * (2 - a);
    const x = ox + (p.fc + (p.c - p.fc) * e) * T + T / 2, y = oy + (p.fr + (p.r - p.fr) * e) * T + T;
    if (a >= 1) p.digT = 0;
    const set = NS.spriteArt.miner(skinId);
    const pose = minerPose(cv);
    const img = (p.facing < 0 ? set.left : set.right)[pose];
    const moving = a < 1;
    const sq = moving ? 1 + Math.sin(a * Math.PI) * 0.07 : 1 + Math.sin(G.time * 3) * 0.015;
    if (p.invuln > 0 && Math.floor(G.time * 16) % 2) ctx.globalAlpha = 0.45;
    if (p.pow.boots > 0 && moving) {
      ctx.globalAlpha *= 0.3;
      ctx.drawImage(img, x - 24 - (p.c - p.fc) * 14, y - 46 - (p.r - p.fr) * 14);
      ctx.globalAlpha = p.invuln > 0 && Math.floor(G.time * 16) % 2 ? 0.45 : 1;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(2 - sq, sq);
    ctx.drawImage(img, -24, -46);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (p.shield > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + Math.sin(G.time * 4) * 0.1;
      ctx.drawImage(K.glow('#ffd54a'), x - 32, y - 52, 64, 64);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = K.rgba('#ffd54a', 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - 20, 24, G.time * 2, G.time * 2 + 4.5);
      ctx.stroke();
    }
    if (p.pow.clover > 0 && Math.random() < 0.15) NS.fx.spawn(x - ox + (Math.random() - 0.5) * 30, y - oy - 20, 0, -30, 0.6, 2.5, '#44e070', 0, 0);
    if (p.pow.drill > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(K.glow('#c0c8d8'), x - 20 + p.facing * 14, y - 34, 24, 24);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* glowing things, added on top */
  function glowPass(cv, ox, oy, c0, c1, r0, r1) {
    const { w, cells } = cv;
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.22 + Math.sin(G.time * 3) * 0.06;
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const t = cells[r * w + c];
        let col = null, s = 1, al = pulse;
        if (t === C.GEM) col = '#38e6ff';
        else if (t === C.BIGGEM) { col = '#ff5ae0'; s = 1.4; }
        else if (t === C.LAVA) { col = '#ff7a2f'; s = 1.6; al = 0.3; }
        else if (t === C.EXIT && cv.exitOpen) { col = '#ffd54a'; s = 2.4; al = 0.5; }
        else if (t === C.EXPLODE) { col = '#ffb347'; s = 2; al = 0.4; }
        else if (t === C.MAGIC && cv.magic.state === 1) { col = '#c58bff'; s = 1.3; }
        if (!col) continue;
        const sz = T * s;
        ctx.globalAlpha = al;
        ctx.drawImage(K.glow(col), ox + c * T + T / 2 - sz, oy + r * T + T / 2 - sz, sz * 2, sz * 2);
      }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function lightSprite() {
    if (lightX) return lightX;
    lightX = K.canvas(64, 64);
    const x = lightX.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return lightX;
  }

  /* darkness at 1/8 resolution with light punched out around lamps and glowing cells */
  function darkness(cv, dark, ox, oy, f, c0, c1, r0, r1) {
    if (dark <= 0.04) return;
    const S = 8;
    const lw = Math.ceil(f.w / S), lh = Math.ceil(f.h / S);
    if (!light || light.width !== lw || light.height !== lh) light = K.canvas(lw, lh);
    const x = light.getContext('2d');
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, lw, lh);
    x.fillStyle = 'rgba(4,2,8,' + dark + ')';
    x.fillRect(0, 0, lw, lh);
    x.globalCompositeOperation = 'destination-out';
    const spr = lightSprite();
    const put = (px, py, rad) => {
      const rr = rad / S;
      x.drawImage(spr, (px - f.x0) / S - rr, (py - f.y0) / S - rr, rr * 2, rr * 2);
    };
    const p = cv.player;
    const pk = G.perks;
    const a = Math.min(1, p.moveT / cv.playerPeriod);
    const lamp = (3.4 + (pk.light || 0) + (p.pow.lantern > 0 ? 4 : 0)) * T;
    put(ox + (p.fc + (p.c - p.fc) * a) * T + T / 2, oy + (p.fr + (p.r - p.fr) * a) * T + T / 2, lamp * (0.97 + Math.sin(G.time * 7) * 0.03));
    const { w, cells } = cv;
    const gemsShine = p.pow.lantern > 0;
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        const t = cells[r * w + c];
        let rad = 0;
        if (t === C.LAVA || t === C.EXPLODE) rad = 2.2;
        else if (t === C.EXIT && cv.exitOpen) rad = 3;
        else if (t === C.ITEM || t === C.FIREFLY || t === C.AMOEBA) rad = 1.4;
        else if ((t === C.GEM || t === C.BIGGEM) && gemsShine) rad = 1.1;
        else if (t === C.GEM && (r * 3 + c) % 4 === 0) rad = 0.7;
        if (rad) put(ox + c * T + T / 2, oy + r * T + T / 2, rad * T);
      }
    for (let k = 0; k < cv.bombs.length; ++k) put(ox + (cv.bombs[k].i % w) * T + T / 2, oy + ((cv.bombs[k].i / w) | 0) * T, 1.6 * T);
    if (cv.boss && !cv.bossDefeated) put(ox + (cv.boss.c + 1) * T, oy + (cv.boss.r + 1) * T, 2.5 * T);
    x.globalCompositeOperation = 'source-over';
    ctx.drawImage(light, f.x0, f.y0, lw * S, lh * S);
  }

  /* draws the run's or demo's cave into the view; hud reserves the top band */
  function draw(cv, themeId, dt, hud, skinId) {
    updateCamera(cv, dt, hud);
    const f = frameRect(hud);
    const st = NS.fx.state;
    let sx = 0, sy = 0;
    if (st.shake > 0) { sx = (Math.random() - 0.5) * st.shake * 2; sy = (Math.random() - 0.5) * st.shake * 2; }
    const ox = Math.round(f.x0 - cam.x + sx), oy = Math.round(f.y0 - cam.y + sy);
    NS.backdrop.drawVista(themeId, -cam.x, -cam.y);
    const tiles = NS.tileArt.tiles(themeId, G.season ? G.season.id : '');
    const wall = NS.backdrop.backWall(cv, themeId);
    ctx.drawImage(wall, ox, oy, cv.w * T, cv.h * T);
    const c0 = Math.max(0, Math.floor((f.x0 - ox) / T) - 1), c1 = Math.min(cv.w - 1, Math.ceil((f.x0 + f.w - ox) / T));
    const r0 = Math.max(0, Math.floor((f.y0 - oy) / T) - 1), r1 = Math.min(cv.h - 1, Math.ceil((f.y0 + f.h - oy) / T));
    /* a soft frame around caves smaller than the view */
    if (cv.w * T < f.w || cv.h * T < f.h) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(ox - 10, oy - 10, cv.w * T + 20, cv.h * T + 20);
      ctx.drawImage(wall, ox, oy, cv.w * T, cv.h * T);
    }
    drawCells(cv, tiles, ox, oy, c0, c1, r0, r1);
    if (r0 <= 1) NS.backdrop.drawSeasonDecor(cv, ox, oy);
    drawBombs(cv, ox, oy);
    drawBoss(cv, ox, oy);
    drawPlayer(cv, ox, oy, skinId || G.save.skin);
    glowPass(cv, ox, oy, c0, c1, r0, r1);
    NS.fxRender.drawWorld(ox, oy);
    const pal = NS.story.THEMES[themeId] || NS.story.THEMES.amber;
    let dark = (G.run && G.run.params && G.run.params.dark !== undefined) ? G.run.params.dark : pal.dark;
    if (!G.run) dark = pal.dark * 0.6;
    darkness(cv, dark, ox, oy, f, c0, c1, r0, r1);
    NS.fxRender.drawTexts(ox, oy);
    return { ox, oy };
  }

  function camera() {
    return cam;
  }

  Object.assign(NS.world, { draw, palette, themeOf, camera, frameRect });
})();
