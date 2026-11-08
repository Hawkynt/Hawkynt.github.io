/* The field: a framed board centred in the board area with cells as big as fit (up to 46 px),
   closed cells in the chosen tile set (a reburied cell shows a mound), open cells with their
   numbers, flags, question marks and defused mines; the cell under the pointer lit, the keyboard
   cursor, cells pressed down while a button is held (a chord presses the neighbours); opened cells
   pop in as a ripple spreading from the click; smoke patches hide their numbers under drifting
   clouds and Lantern Night shows numbers only near the pointer; a lost field shows every mine, the
   one that went off and the wrong flags. Also draws a rival's field small, anywhere. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const T = NS.tiles;
  const M = NS.metaData;
  const { ctx } = NS.view;

  function tileDef() {
    return M.TILES.find(x => x.id === G.profile.cosmetics.tile) || M.TILES[0];
  }

  function flagDef() {
    return M.FLAGS.find(x => x.id === G.profile.cosmetics.flag) || M.FLAGS[0];
  }

  /* where a field sits: cell size and top-left corner */
  function layout(g, area) {
    const a = area || { x0: C.BOARD_X0, y0: C.BOARD_Y0, x1: C.BOARD_X1, y1: C.BOARD_Y1, max: C.CELL_MAX };
    const s = Math.max(4, Math.floor(Math.min((a.x1 - a.x0) / g.w, (a.y1 - a.y0) / g.h, a.max || C.CELL_MAX)));
    return { s: s, x0: Math.round((a.x0 + a.x1) / 2 - g.w * s / 2), y0: Math.round((a.y0 + a.y1) / 2 - g.h * s / 2) };
  }

  /* the cell index under a view-plane point, or -1 */
  function cellAt(g, x, y) {
    const L = layout(g);
    const cx = Math.floor((x - L.x0) / L.s), cy = Math.floor((y - L.y0) / L.s);
    return cx >= 0 && cy >= 0 && cx < g.w && cy < g.h ? cy * g.w + cx : -1;
  }

  /* ---- the opening ripple ---- */
  const anim = { born: {}, field: null };
  function ripple(g, from, cells) {
    if (anim.field !== g) { anim.field = g; anim.born = {}; }
    const fx = from % g.w, fy = Math.floor(from / g.w);
    for (const i of cells) {
      const d = Math.hypot(i % g.w - fx, Math.floor(i / g.w) - fy);
      anim.born[i] = G.time + Math.min(0.6, d * 0.025);
    }
  }

  function frame(g, L, accent) {
    const w = g.w * L.s, h = g.h * L.s;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    K.roundRect(ctx, L.x0 - 10, L.y0 - 6, w + 20, h + 20, 12); ctx.fill();
    const gr = ctx.createLinearGradient(0, L.y0 - 12, 0, L.y0 + h + 12);
    gr.addColorStop(0, K.shade(accent, 0.2)); gr.addColorStop(1, K.shade(accent, -0.45));
    ctx.fillStyle = gr;
    K.roundRect(ctx, L.x0 - 12, L.y0 - 12, w + 24, h + 24, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2;
    K.roundRect(ctx, L.x0 - 9, L.y0 - 9, w + 18, h + 18, 10); ctx.stroke();
  }

  /* opts: area, demo, small (no hover, no cursor), hover, cursor, pressed (cells), dark */
  function draw(g, opts) {
    opts = opts || {};
    const run = G.run;
    const L = layout(g, opts.area);
    const s = L.s, def = tileDef(), fdef = flagDef();
    const world = NS.worldData.WORLDS[run && !opts.demo ? run.world || 0 : 0];
    frame(g, L, world.accent);
    const over = g.state === 'lost';
    const pressed = opts.pressed || null;
    const lit = opts.dark ? opts.hover : -1;
    for (let y = 0; y < g.h; ++y)
      for (let x = 0; x < g.w; ++x) {
        const i = y * g.w + x;
        const px = L.x0 + x * s, py = L.y0 + y * s;
        if (g.open[i]) {
          const born = anim.field === g ? anim.born[i] : null;
          const age = born ? G.time - born : 1;
          if (age < 0) { ctx.drawImage(T.closed(def, s), px, py); continue; }
          ctx.drawImage(T.open(def, s), px, py);
          const n = g.num ? g.num[i] : 0;
          if (n > 0) {
            let hide = NS.engine.fogged(g, i);
            if (opts.dark && lit >= 0 && Math.hypot(x - lit % g.w, y - Math.floor(lit / g.w)) > 3.2) hide = true;
            if (opts.dark && lit < 0) hide = true;
            if (!hide) {
              if (age < 0.22) {
                const k = 0.5 + age / 0.22 * 0.5;
                ctx.drawImage(T.number(n, s, def), px + s * (1 - k) / 2, py + s * (1 - k) / 2, s * k, s * k);
              } else ctx.drawImage(T.number(n, s, def), px, py);
            }
          }
          if (age < 0.18) { ctx.fillStyle = 'rgba(255,255,255,' + (0.5 - age * 2.5) + ')'; ctx.fillRect(px, py, s, s); }
          continue;
        }
        const down = pressed && pressed.indexOf(i) >= 0 && g.flag[i] !== 1;
        if (over && g.mine && g.mine[i] && !g.defused[i] && g.flag[i] !== 1) {
          ctx.drawImage(T.open(def, s), px, py);
          ctx.drawImage(T.mine(s, i === g.hit), px, py);
          continue;
        }
        if (over && g.mine && g.flag[i] === 1 && !g.mine[i]) {
          ctx.drawImage(T.open(def, s), px, py);
          ctx.drawImage(T.wrongFlag(fdef, s), px, py);
          continue;
        }
        if (g.defused[i]) {
          ctx.drawImage(T.open(def, s), px, py);
          ctx.drawImage(T.defused(s), px, py);
          continue;
        }
        ctx.drawImage(down ? T.open(def, s) : T.closed(def, s), px, py);
        if (g.buried && g.buried[i]) ctx.drawImage(T.mound(s), px, py);
        if (g.flag[i] === 1) ctx.drawImage(T.flag(fdef, s), px, py);
        else if (g.flag[i] === 2) ctx.drawImage(T.question(s, def), px, py);
        if (!opts.small && i === opts.hover && !down && E_playing(g)) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(px, py, s, s);
        }
      }
    /* smoke */
    for (const p of g.fog) {
      const a = Math.min(1, p.t / 0.6, (p.max - p.t) / 0.6 + 0.2);
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      for (let yy = 0; yy < p.h; yy += 1)
        for (let xx = 0; xx < p.w; xx += 1) {
          const wob = Math.sin(G.time * 1.3 + xx + yy * 2) * s * 0.15;
          ctx.drawImage(T.smoke(s), L.x0 + (p.x + xx) * s - s / 2 + wob, L.y0 + (p.y + yy) * s - s / 2);
        }
      ctx.globalAlpha = 1;
    }
    if (g.flagLockT > 0) {
      ctx.fillStyle = 'rgba(160,210,255,' + (0.12 + 0.06 * Math.sin(G.time * 5)) + ')';
      ctx.fillRect(L.x0, L.y0, g.w * s, g.h * s);
    }
    if (!opts.small && opts.cursor >= 0) {
      const cx = L.x0 + (opts.cursor % g.w) * s, cy = L.y0 + Math.floor(opts.cursor / g.w) * s;
      ctx.strokeStyle = C.UI.gold; ctx.lineWidth = 3;
      ctx.strokeRect(cx + 1.5, cy + 1.5, s - 3, s - 3);
    }
    return L;
  }

  function E_playing(g) {
    return g.state === 'ready' || g.state === 'play';
  }

  Object.assign(NS.boardRender, { tileDef, flagDef, layout, cellAt, ripple, anim, draw });
})();
