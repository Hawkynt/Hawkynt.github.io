/* The playfield: a framed well (frame style from the collection) with a faint grid, locked
   blocks in the chosen skin (fading out under the Ghost Blocks mutator), power orbs and gems on
   their cells, rows flashing white and shrinking while they clear, the ghost piece (and landing
   line with Clear Ghost), the falling piece with a soft lock-delay pulse, the incoming-garbage
   meter on the left edge, and the hold and next panels around it (fogged by the tide). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const B = NS.blocks;
  const E = NS.engine;
  const kit = NS.kit;
  const { COLS, ROWS, HIDDEN, CELL, BOARD_X, BOARD_Y, UI, SHAPES } = C;
  const { ctx } = NS.view;

  const BW = COLS * CELL, BH = (ROWS - HIDDEN) * CELL;

  function skinStyle() {
    const s = NS.metaData.SKINS.find(x => x.id === G.profile.cosmetics.skin);
    return s ? s.style : 'gloss';
  }

  function frameDef() {
    return NS.metaData.FRAMES.find(x => x.id === G.profile.cosmetics.frame) || NS.metaData.FRAMES[0];
  }

  function well() {
    const f = frameDef();
    return K.sprite('well:' + f.id, BW + 28, BH + 28, (g) => {
      const gr = g.createLinearGradient(0, 0, BW + 28, BH + 28);
      gr.addColorStop(0, K.shade(f.color, 0.3)); gr.addColorStop(0.5, f.color); gr.addColorStop(1, K.shade(f.color, -0.35));
      K.roundRect(g, 0, 0, BW + 28, BH + 28, 14); g.fillStyle = gr; g.fill();
      g.strokeStyle = K.rgba(f.accent, 0.9); g.lineWidth = 2; K.roundRect(g, 3, 3, BW + 22, BH + 22, 12); g.stroke();
      if (f.id === 'rainbow') {
        const rg = g.createLinearGradient(0, 0, 0, BH + 28);
        ['#ff6a8a', '#ffd25a', '#7be08a', '#5ad0ff', '#c08aff'].forEach((c, i) => rg.addColorStop(i / 4, c));
        g.strokeStyle = rg; g.lineWidth = 4; K.roundRect(g, 6, 6, BW + 16, BH + 16, 10); g.stroke();
      }
      g.fillStyle = 'rgba(6,8,20,0.9)'; g.fillRect(14, 14, BW, BH);
      g.strokeStyle = 'rgba(140,170,230,0.07)'; g.lineWidth = 1;
      for (let x = 1; x < COLS; ++x) { g.beginPath(); g.moveTo(14 + x * CELL + 0.5, 14); g.lineTo(14 + x * CELL + 0.5, 14 + BH); g.stroke(); }
      for (let y = 1; y < ROWS - HIDDEN; ++y) { g.beginPath(); g.moveTo(14, 14 + y * CELL + 0.5); g.lineTo(14 + BW, 14 + y * CELL + 0.5); g.stroke(); }
      for (let k = 0; k < 4; ++k) K.circle(g, [8, BW + 20, 8, BW + 20][k], [8, 8, BH + 20, BH + 20][k], 3, f.accent);
    });
  }

  function drawPieceCells(t, r, x, y, s, ox, oy, alpha, orb) {
    const style = skinStyle();
    const sh = SHAPES[t][r];
    let k = 0;
    for (let yy = 0; yy < sh.length; ++yy)
      for (let xx = 0; xx < sh.length; ++xx) {
        if (!sh[yy][xx]) continue;
        const cy = y + yy;
        if (cy >= HIDDEN - (oy == null ? 0 : 99)) {
          const px = (ox == null ? BOARD_X : ox) + (x + xx) * s;
          const py = (oy == null ? BOARD_Y + (cy - HIDDEN) * s : oy + cy * s);
          if (alpha != null) ctx.globalAlpha = alpha;
          ctx.drawImage(B.block(style, t, s), px, py);
          if (orb === k) ctx.drawImage(B.orb(s), px, py);
          if (alpha != null) ctx.globalAlpha = 1;
        }
        ++k;
      }
  }

  function drawBoard(game, opts) {
    opts = opts || {};
    const run = G.run;
    ctx.drawImage(well(), BOARD_X - 14, BOARD_Y - 14);
    const style = skinStyle();
    const clearing = game.clearing;
    const ct = clearing ? 1 - clearing.t / C.CLEAR_TIME : 0;
    const invisible = run && run.invisible && !opts.demo;
    for (let y = HIDDEN; y < ROWS; ++y) {
      const isClear = clearing && clearing.rows.indexOf(y) >= 0;
      for (let x = 0; x < COLS; ++x) {
        const code = game.board[y * COLS + x];
        if (!code) continue;
        const px = BOARD_X + x * CELL, py = BOARD_Y + (y - HIDDEN) * CELL;
        if (isClear) {
          const sc = 1 - ct * ct;
          const d = Math.abs(x - 4.5) / 5;
          ctx.globalAlpha = Math.max(0, 1 - Math.max(0, ct * 1.4 - d * 0.4));
          ctx.drawImage(B.forCode(style, code, CELL), px + CELL * (1 - sc) / 2, py + CELL * (1 - sc) / 2, CELL * sc, CELL * sc);
          ctx.fillStyle = 'rgba(255,255,255,' + Math.max(0, 0.9 - ct) + ')';
          ctx.fillRect(px, py, CELL, CELL);
          ctx.globalAlpha = 1;
          continue;
        }
        if (invisible) {
          const near = !game.piece || Math.abs(y - game.piece.y) > 6;
          ctx.globalAlpha = near ? 0.06 : 0.25;
        }
        ctx.drawImage(B.forCode(style, code, CELL), px, py);
        const tag = game.tags[y * COLS + x];
        if (tag === 1) ctx.drawImage(B.orb(CELL), px, py);
        else if (tag === 2) ctx.drawImage(B.gemMark(CELL), px, py);
        ctx.globalAlpha = 1;
      }
    }
    const p = game.piece;
    if (p && !game.clearing) {
      const gy = E.ghostY(game);
      const bright = NS.progress.stat(G.profile, 'ghost') > 0;
      if (G.profile.settings.ghost !== false && gy > p.y) {
        const sh = SHAPES[p.t][p.r];
        for (let yy = 0; yy < sh.length; ++yy)
          for (let xx = 0; xx < sh.length; ++xx)
            if (sh[yy][xx] && gy + yy >= HIDDEN) ctx.drawImage(B.ghost(p.t, CELL, bright), BOARD_X + (p.x + xx) * CELL, BOARD_Y + (gy + yy - HIDDEN) * CELL);
        if (bright) {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          let minX = 9, maxX = 0;
          for (let yy = 0; yy < sh.length; ++yy) for (let xx = 0; xx < sh.length; ++xx) if (sh[yy][xx]) { minX = Math.min(minX, xx); maxX = Math.max(maxX, xx); }
          ctx.fillRect(BOARD_X + (p.x + minX) * CELL, BOARD_Y, (maxX - minX + 1) * CELL, Math.max(0, (gy - HIDDEN) * CELL));
        }
      }
      drawPieceCells(p.t, p.r, p.x, p.y, CELL, null, null, null, p.orb);
      if (E.grounded(game)) {
        const f = Math.min(1, game.lock.t / game.lockDelay);
        ctx.globalAlpha = f * 0.45;
        ctx.globalCompositeOperation = 'lighter';
        drawPieceCells(p.t, p.r, p.x, p.y, CELL);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
      }
    }
    if (run && run.bossState && run.bossState.incoming > 0 && !opts.demo) {
      const n = run.bossState.incoming;
      const h = Math.min(BH, n * CELL);
      const pulse = 0.6 + 0.4 * Math.sin(G.time * 12);
      ctx.fillStyle = 'rgba(255,60,60,' + pulse + ')';
      ctx.fillRect(BOARD_X - 12, BOARD_Y + BH - h, 8, h);
    }
    if (game.slowT > 0) {
      ctx.fillStyle = 'rgba(140,210,255,0.08)';
      ctx.fillRect(BOARD_X, BOARD_Y, BW, BH);
    }
  }

  /* a small piece centred in a box */
  function mini(t, cx, cy, s, alpha) {
    const sh = SHAPES[t][0];
    let minX = 9, maxX = 0, minY = 9, maxY = 0;
    for (let y = 0; y < sh.length; ++y) for (let x = 0; x < sh.length; ++x) if (sh[y][x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const w = (maxX - minX + 1) * s, h = (maxY - minY + 1) * s;
    const style = skinStyle();
    if (alpha != null) ctx.globalAlpha = alpha;
    for (let y = 0; y < sh.length; ++y)
      for (let x = 0; x < sh.length; ++x)
        if (sh[y][x]) ctx.drawImage(B.block(style, t, s), cx - w / 2 + (x - minX) * s, cy - h / 2 + (y - minY) * s);
    ctx.globalAlpha = 1;
  }

  function drawHold(game, x, y) {
    kit.panel(x, y, 170, 120, { accent: UI.accent });
    kit.text('HOLD', x + 14, y + 18, 13, UI.textDim, { weight: 'bold' });
    kit.text('C', x + 156, y + 18, 11, UI.textMute, { align: 'right' });
    if (!game.canHold) {
      kit.lock(x + 85, y + 70, 22);
      return;
    }
    if (game.hold) mini(game.hold, x + 85, y + 70, 24, game.holdUsed ? 0.35 : 1);
  }

  function drawNext(game, x, y, fog) {
    const n = game.preview;
    const h = 40 + 70 + (n - 1) * 52;
    kit.panel(x, y, 170, h, { accent: UI.accent });
    kit.text('NEXT', x + 14, y + 18, 13, UI.textDim, { weight: 'bold' });
    if (fog > 0) {
      ctx.fillStyle = 'rgba(40,140,160,0.75)';
      K.roundRect(ctx, x + 8, y + 30, 154, h - 38, 10);
      ctx.fill();
      kit.text('~ ~ ~', x + 85, y + h / 2 + 10, 22, '#c0ffff', { align: 'center', weight: 'bold' });
      return h;
    }
    for (let i = 0; i < n && i < game.queue.length; ++i) {
      const cy = i === 0 ? y + 75 : y + 75 + 30 + (i - 1) * 52 + 20;
      mini(game.queue[i], x + 85, cy, i === 0 ? 24 : 18, i === 0 ? 1 : 0.85);
    }
    return h;
  }

  Object.assign(NS.boardRender, { skinStyle, frameDef, well, drawBoard, drawPieceCells, mini, drawHold, drawNext, BW, BH });
})();
