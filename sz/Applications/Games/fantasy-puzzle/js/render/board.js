/* The board as seen this frame: baked tile art, runes, the portal, hover and hint highlights, the
   sliding boulder; drawGame composes the board layer. Reads the puzzle and effect state. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { T, ELEMENT_BY_ID, STATE_PLAYING, DIRS } = NS.consts;
  const { ctx, ui, Fx, fxBoard } = NS.context;
  const { visibleRect, colOf, rowOf, tileCenterX, tileCenterY } = NS.view;
  const { reach, isWalkable, goalIndex, actionsForTile } = NS.rules;
  const { treeLevel } = NS.grimoire;
  const { realmInfo } = NS.session;
  const { drawHeroSprite, drawElementAura, drawStaffGlow, drawMotes, drawWinTrail, drawProjectiles, drawRings,
    drawSpells } = NS.actors;

  /* the board as the player sees it this frame: a tile still waiting for its
     spell keeps its old face, a boulder in flight has not landed yet */
  let boardArt = null, boardArtTheme = -1, displayTiles = null;

  function boardBakeScale() {
    const s = G.viewScale * G.TS / 64;
    return Math.max(0.5, Math.min(2, Math.ceil(s * 4) / 4));
  }

  function prepareBoardArt() {
    if (!boardArt || boardArtTheme !== G.theme) {
      boardArt = SZ.PuzzleBoard.create(G.theme);
      boardArtTheme = G.theme;
    }
    const n = G.puzzle.tiles.length;
    if (!displayTiles || displayTiles.length !== n)
      displayTiles = new Uint8Array(n);
    for (let i = 0; i < n; ++i)
      displayTiles[i] = G.puzzle.tiles[i];
    for (const fx of G.tileFx)
      if (fx.elapsed < fx.delay)
        displayTiles[fx.index] = fx.oldCode;
    if (G.slide && !G.slide.swallowed)
      displayTiles[G.slide.toIdx] = T.FLOOR;
    if (G.slide && G.slide.swallowed && G.slide.chasmIdx >= 0)
      displayTiles[G.slide.chasmIdx] = T.CHASM;
    boardArt.update({ cols: G.puzzle.cols, rows: G.puzzle.rows, tiles: displayTiles, decals: G.decals, scale: boardBakeScale() });
  }

  function drawSlideBoulder() {
    if (!G.slide)
      return;
    const k = Math.min(1, G.slide.t / G.slide.dur);
    const x = tileCenterX(G.slide.fromIdx) + (tileCenterX(G.slide.toIdx) - tileCenterX(G.slide.fromIdx)) * k;
    const y = tileCenterY(G.slide.fromIdx) + (tileCenterY(G.slide.toIdx) - tileCenterY(G.slide.fromIdx)) * k;
    /* it rolls: the turn follows the distance travelled */
    const dist = (Math.abs(x - tileCenterX(G.slide.fromIdx)) + Math.abs(y - tileCenterY(G.slide.fromIdx))) / 26;
    const sgn = tileCenterX(G.slide.toIdx) < tileCenterX(G.slide.fromIdx) || tileCenterY(G.slide.toIdx) < tileCenterY(G.slide.fromIdx) ? -1 : 1;
    const sink = G.slide.swallowed ? Math.max(0, (k - 0.7) / 0.3) : 0;
    SZ.PuzzleBoard.drawProp(ctx, G.theme, T.BOULDER, x, y + sink * 10, dist * sgn, 64 * (1 - sink * 0.45));
  }

  function drawRunes() {
    const tiles = G.puzzle.tiles;
    const sight = treeLevel('i_runes') > 0;
    const reachable = reach();
    for (let i = 0; i < tiles.length; ++i) {
      if (tiles[i] !== T.RUNE)
        continue;
      const collected = G.puzzle.runes.has(i);
      SZ.PuzzleArt.drawRuneGlow(ctx, G.theme, tileCenterX(i), tileCenterY(i), G.time, collected);
      /* Rune Sight: runes outside reach shimmer visibly through the walls,
         without it they only glow faintly */
      if (sight && !collected && !reachable.has(i)) {
        const cx = tileCenterX(i), cy = tileCenterY(i);
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.25 * Math.sin(G.time * 4 + i);
        ctx.strokeStyle = '#e0a8ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 15 + 3 * Math.sin(G.time * 3 + i), 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx + 7, cy);
        ctx.lineTo(cx, cy + 10);
        ctx.lineTo(cx - 7, cy);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawPortalTile() {
    const goal = goalIndex();
    if (goal < 0)
      return;
    const open = reach().has(goal);
    const cx = tileCenterX(goal), cy = tileCenterY(goal);
    const color = realmInfo().color;
    const pulse = 0.5 + 0.5 * Math.sin(G.time * 3);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    /* a halo on the dais and, once it can be reached, a column of light */
    ctx.globalAlpha = open ? 0.55 + 0.25 * pulse : 0.22 + 0.08 * pulse;
    ctx.drawImage(Fx.sprite('glow', color), cx - 48, cy - 44, 96, 88);
    if (open) {
      ctx.globalAlpha = 0.28 + 0.12 * pulse;
      ctx.drawImage(Fx.sprite('glow', color), cx - 18, cy - 120, 36, 150);
      ctx.globalAlpha = 0.35;
      ctx.drawImage(Fx.sprite('glow', '#ffffff'), cx - 7, cy - 90, 14, 110);
    }
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.86);
    ctx.rotate(G.time * (open ? 1.6 : 0.5));
    SZ.PuzzleArt.drawPortal(ctx, G.theme, 0, 0, G.time, open);
    ctx.restore();
  }

  function drawPushArrow(idx, dir) {
    const d = DIRS[dir];
    if (!d)
      return;
    const cx = tileCenterX(idx), cy = tileCenterY(idx);
    const hx = cx + d[1] * 26, hy = cy + d[0] * 26;
    ctx.save();
    ctx.strokeStyle = '#eaf8ff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(G.time * 6);
    ctx.beginPath();
    ctx.moveTo(cx + d[1] * 6, cy + d[0] * 6);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - d[1] * 9 - d[0] * 5, hy - d[0] * 9 + d[1] * 5);
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - d[1] * 9 + d[0] * 5, hy - d[0] * 9 - d[1] * 5);
    ctx.stroke();
    ctx.restore();
  }

  function drawHighlights() {
    if (G.state !== STATE_PLAYING || G.pendingCast || G.winSeq)
      return;
    if (G.hoverIdx >= 0 && G.hoverPoint) {
      /* a walkable tile in reach is walked to, never cast on — no hint there */
      const wouldWalk = isWalkable(G.puzzle.tiles[G.hoverIdx]) && reach().has(G.hoverIdx);
      const acts = wouldWalk ? [] : actionsForTile(G.hoverIdx, G.selectedElement, G.hoverPoint);
      if (acts.length) {
        const el = ELEMENT_BY_ID[G.selectedElement];
        const pulse = 0.45 + 0.3 * Math.sin(G.time * 5);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 + 0.2 * pulse;
        ctx.drawImage(Fx.sprite('glow', el.color), colOf(G.hoverIdx) * 64 - 16, rowOf(G.hoverIdx) * 64 - 16, 96, 96);
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = el.color;
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = pulse + 0.2;
        ui.roundRectPath(colOf(G.hoverIdx) * 64 + 4, rowOf(G.hoverIdx) * 64 + 4, 56, 56, 8);
        ctx.stroke();
        ctx.restore();
        /* the element floats above the tile it would be cast on */
        ctx.save();
        ctx.globalAlpha = 0.6;
        SZ.PuzzleScene.drawElementIcon(ctx, G.selectedElement, colOf(G.hoverIdx) * 64 + 32, rowOf(G.hoverIdx) * 64 - 2, 22, true);
        ctx.restore();
        if (G.selectedElement === 'air')
          drawPushArrow(G.hoverIdx, acts[0].dir);
      } else if (isWalkable(G.puzzle.tiles[G.hoverIdx]) && reach().has(G.hoverIdx)) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = 2;
        ctx.strokeRect(colOf(G.hoverIdx) * 64 + 4, rowOf(G.hoverIdx) * 64 + 4, 56, 56);
        /* faint footprints mark the tile the mage would walk to */
        const fcx = colOf(G.hoverIdx) * 64 + 32, fcy = rowOf(G.hoverIdx) * 64 + 32;
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(fcx - 7, fcy + 12, 4, 6, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(fcx + 7, fcy + 14, 4, 6, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (G.hoverInvalidT > 0 && G.hoverIdx >= 0) {
      const xc = colOf(G.hoverIdx) * 64 + 32, yc = rowOf(G.hoverIdx) * 64 + 32;
      ctx.save();
      ctx.globalAlpha = 0.55 * G.hoverInvalidT;
      ctx.strokeStyle = ui.UI.bad;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(xc - 12, yc - 12);
      ctx.lineTo(xc + 12, yc + 12);
      ctx.moveTo(xc + 12, yc - 12);
      ctx.lineTo(xc - 12, yc + 12);
      ctx.stroke();
      ctx.restore();
    }
    if (G.hintFx) {
      const a = G.hintFx.action;
      const el = ELEMENT_BY_ID[a.element];
      ctx.save();
      ctx.strokeStyle = el.color;
      ctx.globalAlpha = 0.5 + 0.35 * Math.sin(G.time * 6);
      ctx.lineWidth = 3;
      ctx.strokeRect(colOf(a.index) * 64 + 3, rowOf(a.index) * 64 + 3, 58, 58);
      ctx.globalAlpha = 1;
      SZ.PuzzleScene.drawElementIcon(ctx, a.element, colOf(a.index) * 64 + 50, rowOf(a.index) * 64 + 14, 24, true);
      if (a.element === 'air' && a.dir)
        drawPushArrow(a.index, a.dir);
      ctx.restore();
    }
  }

  function drawGame() {
    G.scene.draw(ctx, G.time, visibleRect());
    prepareBoardArt();

    ctx.save();
    ctx.translate(G.boardX, G.boardY);
    ctx.scale(G.TS / 64, G.TS / 64);
    boardArt.drawGround(ctx);
    boardArt.drawWater(ctx, G.time);
    drawWinTrail();
    drawRunes();
    boardArt.drawUpper(ctx);
    boardArt.drawGlow(ctx, G.time);
    drawSlideBoulder();
    drawPortalTile();
    drawHighlights();
    drawMotes();
    drawElementAura();
    drawHeroSprite();
    drawStaffGlow();
    drawSpells();
    fxBoard.draw(ctx);
    drawProjectiles();
    drawRings();
    ctx.restore();
  }

  NS.board = { drawGame };
})();
