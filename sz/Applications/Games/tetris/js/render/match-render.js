/* The Pairs and Jewels well: the same framed well as the blocks with a six-wide, fifty-pixel grid,
   glossy jelly blobs that grow bridges to touching blobs of their colour, faceted jewels in six
   cuts and colours, cracked grey stones, cells swelling white as they burst, a dashed ghost where
   the piece will land, the falling piece, the incoming-stone meter, and the Next panel. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const M = NS.match;
  const { BOARD_X, BOARD_Y, UI } = C;
  const { ctx } = NS.view;

  const S = 50;
  const W = M.COLS * S, H = (M.ROWS - M.HIDDEN) * S;
  const COLORS = ['', '#ff5a6a', '#5ae07a', '#4a9aff', '#ffd23a', '#b47aff', '#ff9a3a'];

  function well() {
    const f = NS.boardRender.frameDef();
    return K.sprite('mwell:' + f.id, W + 28, H + 28, (g) => {
      const gr = g.createLinearGradient(0, 0, W + 28, H + 28);
      gr.addColorStop(0, K.shade(f.color, 0.3)); gr.addColorStop(0.5, f.color); gr.addColorStop(1, K.shade(f.color, -0.35));
      K.roundRect(g, 0, 0, W + 28, H + 28, 14); g.fillStyle = gr; g.fill();
      g.strokeStyle = K.rgba(f.accent, 0.9); g.lineWidth = 2; K.roundRect(g, 3, 3, W + 22, H + 22, 12); g.stroke();
      g.fillStyle = 'rgba(6,8,20,0.9)'; g.fillRect(14, 14, W, H);
      g.strokeStyle = 'rgba(140,170,230,0.06)'; g.lineWidth = 1;
      for (let x = 1; x < M.COLS; ++x) { g.beginPath(); g.moveTo(14 + x * S + 0.5, 14); g.lineTo(14 + x * S + 0.5, 14 + H); g.stroke(); }
      for (let y = 1; y < M.ROWS - M.HIDDEN; ++y) { g.beginPath(); g.moveTo(14, 14 + y * S + 0.5); g.lineTo(14 + W, 14 + y * S + 0.5); g.stroke(); }
      g.fillStyle = 'rgba(255,90,110,0.18)'; g.fillRect(14 + 2 * S, 14, S, 4);
    });
  }

  function blob(c, s) {
    return K.sprite('mblob:' + c + ':' + s, s, s, (g) => {
      const col = COLORS[c];
      const gr = g.createRadialGradient(s * 0.38, s * 0.34, 1, s / 2, s / 2, s * 0.48);
      gr.addColorStop(0, K.shade(col, 0.55)); gr.addColorStop(0.55, col); gr.addColorStop(1, K.shade(col, -0.45));
      g.fillStyle = gr;
      g.beginPath(); g.arc(s / 2, s / 2 + s * 0.02, s * 0.44, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.beginPath(); g.ellipse(s * 0.36, s * 0.3, s * 0.12, s * 0.07, -0.6, 0, Math.PI * 2); g.fill();
      for (const ex of [0.38, 0.62]) { K.circle(g, s * ex, s * 0.52, s * 0.075, '#ffffff'); K.circle(g, s * ex + s * 0.015, s * 0.535, s * 0.04, '#141420'); }
    });
  }

  /* six cuts, one per colour, so colours also differ by shape */
  function jewel(c, s) {
    return K.sprite('mjewel:' + c + ':' + s, s, s, (g) => {
      const col = COLORS[c];
      const n = [0, 8, 4, 6, 5, 3, 7][c];
      const r = s * 0.42;
      g.translate(s / 2, s / 2);
      g.beginPath();
      for (let i = 0; i < n; ++i) {
        const a = -Math.PI / 2 + i / n * Math.PI * 2 + (n === 4 ? Math.PI / 4 : 0);
        g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      const gr = g.createLinearGradient(-r, -r, r, r);
      gr.addColorStop(0, K.shade(col, 0.6)); gr.addColorStop(0.5, col); gr.addColorStop(1, K.shade(col, -0.5));
      g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5; g.stroke();
      g.beginPath();
      for (let i = 0; i < n; ++i) {
        const a = -Math.PI / 2 + i / n * Math.PI * 2 + (n === 4 ? Math.PI / 4 : 0);
        g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
      }
      g.closePath();
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fill();
      K.circle(g, -r * 0.25, -r * 0.3, r * 0.12, 'rgba(255,255,255,0.85)');
    });
  }

  function stone(s) {
    return K.sprite('mstone:' + s, s, s, (g) => {
      const gr = g.createLinearGradient(0, 0, s, s);
      gr.addColorStop(0, '#a8adb8'); gr.addColorStop(1, '#5a5f6a');
      K.roundRect(g, s * 0.08, s * 0.08, s * 0.84, s * 0.84, s * 0.2); g.fillStyle = gr; g.fill();
      g.strokeStyle = 'rgba(30,30,40,0.6)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(s * 0.3, s * 0.2); g.lineTo(s * 0.45, s * 0.45); g.lineTo(s * 0.35, s * 0.7); g.moveTo(s * 0.45, s * 0.45); g.lineTo(s * 0.7, s * 0.55); g.stroke();
    });
  }

  function cellSprite(rule, c, s) {
    return c === M.STONE ? stone(s) : rule === 'jewels' ? jewel(c, s) : blob(c, s);
  }

  function draw(game, opts) {
    opts = opts || {};
    const run = G.run;
    ctx.drawImage(well(), BOARD_X - 14, BOARD_Y - 14);
    const b = game.board, rule = game.rule;
    const vis = y => y >= M.HIDDEN;
    const px = x => BOARD_X + x * S, py = y => BOARD_Y + (y - M.HIDDEN) * S;
    const pop = game.popping;
    const k = pop ? 1 - pop.t / M.CLEAR_TIME : 0;
    const popping = {};
    if (pop) for (const c of pop.cells) popping[c[1] * M.COLS + c[0]] = true;
    /* pair bridges between touching blobs of one colour (gone once they burst) */
    if (rule === 'pairs')
      for (let y = M.HIDDEN; y < M.ROWS; ++y)
        for (let x = 0; x < M.COLS; ++x) {
          const c = b[y * M.COLS + x];
          if (!c || c === M.STONE || popping[y * M.COLS + x]) continue;
          ctx.fillStyle = COLORS[c];
          if (x + 1 < M.COLS && b[y * M.COLS + x + 1] === c && !popping[y * M.COLS + x + 1]) ctx.fillRect(px(x) + S / 2, py(y) + S * 0.22, S, S * 0.56);
          if (y + 1 < M.ROWS && b[(y + 1) * M.COLS + x] === c && !popping[(y + 1) * M.COLS + x]) ctx.fillRect(px(x) + S * 0.22, py(y) + S / 2, S * 0.56, S);
        }
    for (let y = M.HIDDEN; y < M.ROWS; ++y)
      for (let x = 0; x < M.COLS; ++x) {
        const c = b[y * M.COLS + x];
        if (!c) continue;
        if (popping[y * M.COLS + x]) {
          const sc = 1 + k * 0.35;
          ctx.globalAlpha = Math.max(0, 1 - k * k);
          ctx.drawImage(cellSprite(rule, c, S), px(x) - S * (sc - 1) / 2, py(y) - S * (sc - 1) / 2, S * sc, S * sc);
          ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, 0.8 - k) + ')';
          ctx.beginPath(); ctx.arc(px(x) + S / 2, py(y) + S / 2, S * 0.45 * sc, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          continue;
        }
        ctx.drawImage(cellSprite(rule, c, S), px(x), py(y));
      }
    const p = game.piece;
    if (p && !pop) {
      const gy = M.ghostY(game);
      if (G.profile.settings.ghost !== false && gy > p.y) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        for (const c of M.cellsOf(rule, { c: p.c, x: p.x, y: gy, r: p.r })) if (vis(c[1])) { ctx.beginPath(); ctx.arc(px(c[0]) + S / 2, py(c[1]) + S / 2, S * 0.38, 0, Math.PI * 2); ctx.stroke(); }
        ctx.setLineDash([]);
      }
      const drop = Math.min(0.95, game.fall) * S * (M.grounded(game) ? 0 : 1);
      for (const c of M.cellsOf(rule, p)) if (c[1] >= M.HIDDEN - 1) ctx.drawImage(cellSprite(rule, c[2], S), px(c[0]), py(c[1]) + drop);
    }
    const incoming = opts.demo || !run || !run.vs ? 0 : NS.versus.pending(run, opts.rival ? 'rival' : 'you');
    if (incoming > 0) {
      const h = Math.min(H, Math.ceil(incoming / M.COLS) * S);
      ctx.fillStyle = 'rgba(255,60,60,' + (0.6 + 0.4 * Math.sin(G.time * 12)) + ')';
      ctx.fillRect(BOARD_X - 12, BOARD_Y + H - h, 8, h);
      for (let i = 0; i < Math.min(M.COLS, incoming); ++i) ctx.drawImage(stone(20), BOARD_X + i * S + 15, BOARD_Y - 26);
    }
  }

  /* the coming pieces, stacked as they will fall */
  function drawNext(game, x, y) {
    const n = Math.min(game.preview, game.queue.length);
    const h = 40 + n * 108;
    kit.panel(x, y, 170, h, { accent: UI.accent });
    kit.text('NEXT', x + 14, y + 18, 13, UI.textDim, { weight: 'bold' });
    for (let i = 0; i < n; ++i) {
      const q = game.queue[i];
      const s = i ? 26 : 32;
      const cy = y + 40 + i * 108 + 50;
      const cells = game.rule === 'pairs' ? [q[1], q[0]] : q;
      cells.forEach((c, k) => ctx.drawImage(cellSprite(game.rule, c, s), x + 85 - s / 2, cy - cells.length * s / 2 + k * s));
    }
    return h;
  }

  Object.assign(NS.matchRender, { S, COLORS, well, blob, jewel, stone, cellSprite, draw, drawNext });
})();
