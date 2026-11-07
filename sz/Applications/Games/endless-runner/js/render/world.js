/* The course of a run in world space, behind the actors: the camera transform (lead, zoom,
   look-up, shake, and the run's direction - the whole playfield turned and mirrored about the
   runner's anchor), ground spans tiled from the world's ground sprite with cliff rims and the
   water, lava, chasm or void below each pit - or, where the run goes up or down, a wall slab
   with gaps instead of pits - ledges (cracked ones crumble), spring and boost pads, every
   obstacle in its world's look with the warning cues of the moving ones (saw rails, drone
   alerts, falling-rock shadows), the chevrons that announce a turn, coins, gems, shards, tokens,
   power orbs, spark orbs, the finish gate and Arcade's best-distance flag. Things that hover
   (flyers, pickups, alerts, labels) are drawn upright whatever the view. Only what is on screen
   is drawn. Draws only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const { GROUND_Y, TAU, PX_PER_M } = C;
  const { WORLDS } = NS.worlds;
  const { BAR_DECK } = NS.items;
  const K = NS.artKit;
  const PA = NS.propArt;
  const PH = NS.physics;
  const { ctx } = NS.view;

  const VA = NS.vertArt;
  const OR = NS.orient;

  const VR = { x0: 0, x1: 0, y0: 0, y1: 0 };
  /* the current transform: screen = (ox, oy) + z * R(a) * diag(m, 1) * (world - (fx, fy)) */
  const XF = { ox: 0, oy: 0, z: 1, c: 1, s: 0, m: 1, a: 0, fx: 0, fy: 0, sg: 1 };
  const FLAT = OR.at(null, 0);

  /* plane -> world transform for the current camera and view; returns the visible world rect */
  function enter(cam) {
    const v = NS.view.visible();
    const o = cam.o || FLAT;
    const z = cam.zoom;
    XF.z = z; XF.a = o.a; XF.m = o.m; XF.c = Math.cos(o.a); XF.s = Math.sin(o.a); XF.sg = o.m < 0 ? -1 : 1;
    XF.ox = o.ax + (G.shakeX || 0); XF.oy = o.ay + (G.shakeY || 0);
    XF.fx = cam.x + C.PLAYER_SCREEN_X / z; XF.fy = GROUND_Y + cam.y;
    ctx.translate(XF.ox, XF.oy);
    ctx.transform(XF.c * XF.m * z, XF.s * XF.m * z, -XF.s * z, XF.c * z, 0, 0);
    ctx.translate(-XF.fx, -XF.fy);
    /* the visible rect is the bounding box of the screen's corners back in the world (a
       mirror passing through zero in a flip is held at 0.2 so the box stays finite) */
    const m = Math.abs(XF.m) < 0.2 ? (XF.m < 0 ? -0.2 : 0.2) : XF.m;
    VR.x0 = VR.y0 = Infinity; VR.x1 = VR.y1 = -Infinity;
    for (let i = 0; i < 4; ++i) {
      const dx = ((i & 1) ? v.x1 : v.x0) - XF.ox, dy = ((i & 2) ? v.y1 : v.y0) - XF.oy;
      /* inverse: diag(1/m, 1) * R(-a) / z */
      const rx = (XF.c * dx + XF.s * dy) / z, ry = (-XF.s * dx + XF.c * dy) / z;
      const wx = XF.fx + rx / m, wy = XF.fy + ry;
      if (wx < VR.x0) VR.x0 = wx;
      if (wx > VR.x1) VR.x1 = wx;
      if (wy < VR.y0) VR.y0 = wy;
      if (wy > VR.y1) VR.y1 = wy;
    }
    VR.x0 = Math.max(VR.x0, XF.fx - 4000); VR.x1 = Math.min(VR.x1, XF.fx + 5000);
    VR.y0 = Math.max(VR.y0, -3000); VR.y1 = Math.min(VR.y1, 4000);
    return VR;
  }

  /* where a world point lands in plane coordinates */
  function toScreen(wx, wy, out) {
    const dx = (wx - XF.fx) * XF.m, dy = wy - XF.fy;
    out = out || {};
    out.x = XF.ox + XF.z * (XF.c * dx - XF.s * dy);
    out.y = XF.oy + XF.z * (XF.s * dx + XF.c * dy);
    return out;
  }

  /* draw something upright at a world point: undo the view's turn and mirror (not its squash) */
  function upright(x, y) {
    ctx.translate(x, y);
    if (XF.sg < 0) ctx.scale(-1, 1);
    if (XF.a) ctx.rotate(-XF.a);
  }

  function unright(x, y) {
    if (XF.a) ctx.rotate(XF.a);
    if (XF.sg < 0) ctx.scale(-1, 1);
    ctx.translate(-x, -y);
  }

  /* where the course looks like a wall (up or down) rather than ground: from each turn's middle */
  function wallAt(run, x) {
    const ds = run.course.dirs;
    let i = ds.length - 1;
    while (i > 0 && ds[i].x + ds[i].len / 2 > x) --i;
    return !!OR.VERT[ds[i].dir];
  }

  /* the next x after a where the look changes, or Infinity */
  function lookChange(run, a) {
    const ds = run.course.dirs;
    for (let i = 1; i < ds.length; ++i) {
      const m = ds[i].x + ds[i].len / 2;
      if (m > a && !OR.VERT[ds[i].dir] !== !OR.VERT[ds[i - 1].dir]) return m;
    }
    return Infinity;
  }

  function wOf(run) {
    return run.world;
  }

  /* ── ground and pits ── */
  function ground(run) {
    let a = VR.x0 - 2;
    const end = VR.x1 + 2;
    while (a < end) {
      const b = Math.min(end, lookChange(run, a));
      if (wallAt(run, a)) wallPiece(run, a, b); else groundPiece(run, a, b);
      if (b < end) junction(run, b);
      a = b;
    }
  }

  function tileRow(tile, a, b, top) {
    const src = tile.canvas;
    const sc = src.width / tile.w;
    let x = Math.floor(a / tile.w) * tile.w;
    for (; x < b; x += tile.w) {
      const x0 = Math.max(x, a), x1 = Math.min(x + tile.w, b);
      if (x1 - x0 < 0.5) continue;
      ctx.drawImage(src, (x0 - x) * sc, 0, (x1 - x0) * sc, src.height, x0, top, x1 - x0 + 0.6, tile.h);
    }
  }

  function groundPiece(run, A, B) {
    const w = wOf(run);
    const W = WORLDS[w];
    const tile = PA.groundTile(w);
    const g = run.course.ground;
    const top = GROUND_Y - 10;
    const deep = top + tile.h;
    for (let i = 0; i < g.length; ++i) {
      const s = g[i];
      const a = Math.max(s.x, A), b = Math.min(s.x + s.w, B);
      if (b <= a) continue;
      tileRow(tile, a, b, top);
      if (deep < VR.y1) {
        ctx.fillStyle = W.ground[3];
        ctx.fillRect(a, deep - 1, b - a, VR.y1 - deep + 2);
      }
    }
    /* pits between spans, then the rims */
    const pit = PA.pitFill(w);
    const t = G.time;
    for (let i = 0; i + 1 < g.length; ++i) {
      const p0 = g[i].x + g[i].w, p1 = g[i + 1].x;
      const x0 = Math.max(p0, A), x1 = Math.min(p1, B);
      if (x1 - x0 < 1) continue;
      const py = GROUND_Y + 40;
      ctx.drawImage(pit.canvas, x0, py, x1 - x0, pit.h);
      if (py + pit.h < VR.y1) {
        ctx.fillStyle = K.shade(W.ground[3], -0.5);
        ctx.fillRect(x0, py + pit.h - 1, x1 - x0, VR.y1 - py - pit.h + 2);
      }
      if (W.pit === 'water' || W.pit === 'lava') {
        ctx.fillStyle = W.pit === 'water' ? 'rgba(200,240,255,0.7)' : '#ffe07a';
        for (let x = x0; x < x1; x += 16) ctx.fillRect(x, py - 2 + Math.sin(t * 3 + x * 0.05) * 3, 10, 3);
        if (W.pit === 'lava') {
          ctx.globalCompositeOperation = 'lighter';
          K.blitAlpha(ctx, K.glow('#ff6a1a'), (x0 + x1) / 2, py, Math.min(6, (x1 - x0) / 50), 0.5 + 0.2 * Math.sin(t * 4));
          ctx.globalCompositeOperation = 'source-over';
        }
      } else if (W.pit === 'neon' || W.pit === 'void') {
        ctx.strokeStyle = K.rgba(W.accent, 0.5);
        ctx.lineWidth = 2;
        for (let y = py + 30; y < py + 200; y += 34) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      }
      const eL = PA.groundEdge(w, 1), eR = PA.groundEdge(w, -1);
      if (p0 >= A) ctx.drawImage(eL.canvas, p0 - 2, top, eL.w, eL.h);
      if (p1 <= B) ctx.drawImage(eR.canvas, p1 - eR.w + 2, top, eR.w, eR.h);
    }
  }

  /* where the run climbs or drops, the ground is a wall slab; a pit is a gap right through it */
  function wallPiece(run, A, B) {
    const w = wOf(run);
    const tile = VA.wallTile(w);
    const g = run.course.ground;
    const top = GROUND_Y - 10;
    const pal = VA.PAL[w];
    for (let i = 0; i < g.length; ++i) {
      const s = g[i];
      const a = Math.max(s.x, A), b = Math.min(s.x + s.w, B);
      if (b <= a) continue;
      tileRow(tile, a, b, top);
      ctx.fillStyle = pal.edge;
      if (s.x >= A) ctx.fillRect(s.x - 3, top + 4, 6, tile.h - 8);
      if (s.x + s.w <= B) ctx.fillRect(s.x + s.w - 3, top + 4, 6, tile.h - 8);
    }
  }

  /* the seam where ground turns into wall: a braced corner in the world's trim colour */
  function junction(run, x) {
    const pal = VA.PAL[wOf(run)];
    const top = GROUND_Y - 10;
    if (!PH.onGroundSpan(run.course, x - 4, x + 4)) return;
    ctx.fillStyle = '#141224';
    ctx.fillRect(x - 14, top - 4, 28, 248);
    ctx.fillStyle = pal.trim;
    ctx.fillRect(x - 11, top - 1, 22, 242);
    ctx.fillStyle = pal.glow;
    ctx.fillRect(x - 2, top + 8, 4, 224);
  }

  function plats(run) {
    const w = wOf(run);
    const flat = PA.platTile(w), steep = VA.ledgeTile(w);
    const pl = run.course.plats;
    const px = run.p.x;
    for (let i = 0; i < pl.length; ++i) {
      const q = pl[i];
      if (q.bar || q.x > VR.x1 || q.x + q.w < VR.x0) continue;
      const tile = wallAt(run, q.x) ? steep : flat;
      for (let x = q.x; x < q.x + q.w; x += tile.w) {
        const ww = Math.min(tile.w, q.x + q.w - x);
        let dy = 0;
        if (q.cr && px > x + ww + 120) dy = (px - x - ww - 120) * 0.6;
        if (dy > 600) continue;
        ctx.drawImage(tile.canvas, 0, 0, ww * tile.canvas.width / tile.w, tile.canvas.height, x, q.y - 6 + dy, ww + 0.5, tile.h);
        if (q.cr) {
          ctx.strokeStyle = 'rgba(20,18,36,0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + ww * 0.3, q.y + dy); ctx.lineTo(x + ww * 0.45, q.y + 12 + dy); ctx.lineTo(x + ww * 0.35, q.y + 22 + dy); ctx.stroke();
        }
      }
    }
    const pads = run.course.pads;
    for (let i = 0; i < pads.length; ++i) {
      const d = pads[i];
      if (d.x > VR.x1 || d.x + d.w < VR.x0) continue;
      const s = PA.pad(d.kind, w);
      ctx.drawImage(s.canvas, d.x, GROUND_Y - s.h + 4, s.w, s.h);
      ctx.globalCompositeOperation = 'lighter';
      K.blitAlpha(ctx, K.glow(d.kind === 'spring' ? '#7cff9a' : '#ffd24a'), d.x + d.w / 2, GROUND_Y - 8, 1.6, 0.4 + 0.3 * Math.sin(G.time * 6));
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /* chevrons on the way into a turn, pointing where the screen's "forward" is about to be */
  function turnSigns(run) {
    const ds = run.course.dirs;
    const t = G.time;
    for (let i = 1; i < ds.length; ++i) {
      const e = ds[i];
      if (e.x < VR.x0 - 300 || e.x - 900 > VR.x1) continue;
      const f = OR.vectors(e.q, e.m, VEC);
      const ang = Math.atan2(f.fy, f.fx);
      const col = WORLDS[wOf(run)].accent;
      for (let k = 0; k < 3; ++k) {
        const x = e.x - 640 + k * 210, y = GROUND_Y - 150;
        if (x < VR.x0 - 60 || x > VR.x1 + 60 || run.p.x > e.x + e.len) continue;
        const pulse = 0.55 + 0.45 * Math.sin(t * 7 - k * 1.2);
        upright(x, y);
        ctx.rotate(ang);
        ctx.globalCompositeOperation = 'lighter';
        K.blitAlpha(ctx, K.glow(col), 0, 0, 1.6, 0.35 * pulse);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.5 + 0.5 * pulse;
        ctx.fillStyle = '#141224';
        K.poly(ctx, [[-20, -30], [8, 0], [-20, 30], [-6, 30], [22, 0], [-6, -30]]); ctx.fill();
        ctx.fillStyle = col;
        K.poly(ctx, [[-16, -24], [8, 0], [-16, 24], [-8, 24], [16, 0], [-8, -24]]); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.rotate(-ang);
        unright(x, y);
      }
    }
  }
  const VEC = {};

  /* ── obstacles ── */
  function hazards(run) {
    const w = wOf(run);
    const hz = run.course.hz;
    const px = run.p.x;
    const t = G.time;
    for (let i = PH.lowerBound(hz, VR.x0 - 700); i < hz.length && hz[i].x < VR.x1 + 500; ++i) {
      const h = hz[i];
      if (h.dead) continue;
      switch (h.kind) {
        case 'hurdle': { const s = PA.hurdle(w); ctx.drawImage(s.canvas, h.x + h.w / 2 - s.w / 2, h.base - s.h + 2, s.w, s.h); break; }
        case 'block': {
          const s = PA.block(w);
          for (let k = 0; k < Math.round(h.h / 56); ++k) ctx.drawImage(s.canvas, h.x - 4, h.base - 62 - k * 56, s.w, s.h);
          break;
        }
        case 'bar': {
          const s = PA.barTile(w);
          const sc = s.canvas.width / s.w;
          const top = h.base - BAR_DECK - 8;
          /* hangers up into the sky, then the beam */
          ctx.fillStyle = 'rgba(20,18,36,0.75)';
          if (!h.seg) ctx.fillRect(h.x + 10, VR.y0, 4, top - VR.y0 + 4);
          ctx.fillRect(h.x + h.w - 14, VR.y0, 4, top - VR.y0 + 4);
          for (let x = h.x; x < h.x + h.w; x += s.w) {
            const ww = Math.min(s.w, h.x + h.w - x);
            ctx.drawImage(s.canvas, 0, 0, ww * sc, s.canvas.height, x, top, ww + 0.5, s.h);
          }
          break;
        }
        case 'wall': { const s = PA.wall(w); ctx.drawImage(s.canvas, h.x - 4, h.base - 204, s.w, s.h); break; }
        case 'spikes': {
          const s = PA.spikeTile(w);
          for (let x = h.x; x < h.x + h.w - 4; x += 38) ctx.drawImage(s.canvas, x, h.base - 28, 40, 30);
          break;
        }
        case 'saw': {
          const m = PH.motion(h, px);
          ctx.strokeStyle = 'rgba(20,18,36,0.6)';
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(m.cx, Math.min(h.cyStart, h.cyEnd) - 40); ctx.lineTo(m.cx, Math.max(h.cyStart, h.cyEnd) + 20); ctx.stroke();
          ctx.strokeStyle = h.low ? 'rgba(255,90,106,0.8)' : 'rgba(94,224,255,0.8)';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(m.cx, h.cyEnd, 30, 0, TAU); ctx.stroke();
          K.blitRot(ctx, PA.saw(w), m.cx, m.cy, t * 14, 1);
          break;
        }
        case 'drone': {
          const m = PH.motion(h, px);
          const dy = m.cy + Math.sin(t * 6 + h.id) * 3 * m.f;
          upright(m.cx, dy);
          K.blit(ctx, PA.drone(w, ((t * 12) | 0) % 2), 0, 0);
          unright(m.cx, dy);
          if (m.f > 0.02 && h.x - px < 1100) alert(m.cx, m.cy - 46, h.low ? '#ff5a6a' : '#5ee0ff');
          break;
        }
        case 'rock': {
          const m = PH.motion(h, px);
          const fall = 1 - m.f;
          ctx.fillStyle = 'rgba(20,18,36,' + (0.15 + fall * 0.35).toFixed(3) + ')';
          ctx.beginPath(); ctx.ellipse(m.cx, h.base - 2, 18 + fall * 14, 5, 0, 0, TAU); ctx.fill();
          if (m.cy > VR.y0 - 40) K.blitRot(ctx, PA.rock(w), m.cx, m.cy, fall * 0.6, 1);
          if (m.f > 0.98 && h.x - px < 1000) alert(m.cx, Math.max(VR.y0 + 40, h.base - 220), '#ffb347');
          break;
        }
        case 'roller': {
          const m = PH.motion(h, px);
          K.blitRot(ctx, PA.roller(w), m.cx, m.cy, -m.cx / 28, 1);
          break;
        }
      }
    }
  }

  function alert(x, y, color) {
    const a = 0.6 + 0.4 * Math.sin(G.time * 16);
    upright(x, y);
    ctx.globalAlpha = a;
    ctx.fillStyle = color;
    K.poly(ctx, [[0, -14], [13, 9], [-13, 9]]);
    ctx.fill();
    ctx.fillStyle = '#141224';
    ctx.fillRect(-1.5, -5, 3, 8);
    ctx.fillRect(-1.5, 4, 3, 3);
    ctx.globalAlpha = 1;
    unright(x, y);
  }

  /* a cached sprite drawn upright at a world point */
  function blitUp(s, x, y, k, rot) {
    upright(x, y);
    if (rot) K.blitRot(ctx, s, 0, 0, rot, k); else K.blit(ctx, s, 0, 0, k);
    unright(x, y);
  }

  /* ── pickups ── */
  function items(run) {
    const list = run.course.items;
    const t = G.time;
    const coin = PA.coin();
    for (let i = PH.lowerBound(list, VR.x0 - 60); i < list.length && list[i].x < VR.x1 + 60; ++i) {
      const it = list[i];
      if (it.got) continue;
      switch (it.k) {
        case 'coin': {
          const sx = Math.abs(Math.cos(t * 4 + it.x * 0.013));
          ctx.drawImage(coin.canvas, it.x - 13 * Math.max(0.15, sx), it.y - 13, 26 * Math.max(0.15, sx), 26);
          break;
        }
        case 'gem': blitUp(PA.gem(), it.x, it.y + Math.sin(t * 3 + it.x) * 3, 0.9); break;
        case 'shard':
          ctx.globalCompositeOperation = 'lighter';
          K.blitAlpha(ctx, K.glow('#5ee0ff'), it.x, it.y, 2.2, 0.6 + 0.3 * Math.sin(t * 5));
          ctx.globalCompositeOperation = 'source-over';
          blitUp(PA.shard(), it.x, it.y + Math.sin(t * 3) * 5, 1, Math.sin(t * 2) * 0.2);
          break;
        case 'token':
          blitUp(PA.token(G.season ? G.season.token : 'firework'), it.x, it.y + Math.sin(t * 3 + it.x) * 4, 1);
          break;
        case 'power':
        case 'orb': {
          const id = it.k === 'orb' ? 'spark' : it.p;
          const y = it.y + Math.sin(t * 3 + it.x) * 6;
          ctx.globalCompositeOperation = 'lighter';
          K.blitAlpha(ctx, K.glow(it.k === 'orb' ? '#5ee0ff' : NS.items.POWER_BY_ID[it.p].color), it.x, y, 2.4, 0.55);
          ctx.globalCompositeOperation = 'source-over';
          blitUp(PA.orb(id), it.x, y, 1 + Math.sin(t * 6) * 0.04);
          break;
        }
        case 'finish': {
          const s = PA.gate();
          ctx.drawImage(s.canvas, it.x - s.w / 2, GROUND_Y - s.h + 4, s.w, s.h);
          break;
        }
      }
    }
    /* rain and sky trail */
    const gemS = PA.gem();
    for (let pass = 0; pass < 2; ++pass) {
      const l = pass ? run.sky : run.rain;
      for (let i = 0; i < l.length; ++i) {
        const c = l[i];
        if (c.x < VR.x0 - 30 || c.x > VR.x1 + 30) continue;
        if (c.gem) blitUp(gemS, c.x, c.y, 0.8);
        else ctx.drawImage(coin.canvas, c.x - 13, c.y - 13, 26, 26);
      }
    }
    /* Arcade: the best distance so far */
    if (run.bestX && run.bestX > VR.x0 - 40 && run.bestX < VR.x1 + 40) flag(run.bestX, 'BEST ' + Math.round(run.bestX / PX_PER_M) + ' m', '#ffd24a');
  }

  function flag(x, label, color) {
    ctx.fillStyle = '#141224';
    ctx.fillRect(x - 3, GROUND_Y - 170, 6, 170);
    ctx.fillStyle = color;
    K.poly(ctx, [[x + 3, GROUND_Y - 170], [x + 70, GROUND_Y - 152], [x + 3, GROUND_Y - 134]]);
    ctx.fill();
    ctx.font = 'bold 16px ' + C.FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    upright(x + 36, GROUND_Y - 196);
    ctx.fillText(label, 0, 0);
    unright(x + 36, GROUND_Y - 196);
  }

  Object.assign(NS.world, {
    VR, XF, enter, toScreen, upright, unright, blitUp, wallAt, ground, plats, turnSigns, hazards, items, alert, flag
  });
})();
