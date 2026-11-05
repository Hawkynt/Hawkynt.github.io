/* The live arena of the run: tile queries, the per-step caches (which bomb and how many enemies
   sit on each cell, teleporter pairs), walkability for each kind of mover, breaking bricks and
   crates (debris, score, stats) and revealing what was hidden under them. Mutates G.run.level
   and owns G.lvl. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { COLS, ROWS, T_EMPTY, T_HARD, T_SOFT, T_CRATE, T_TELE } = C;
  const N = COLS * ROWS;

  function idx(c, r) {
    return r * COLS + c;
  }

  function inside(c, r) {
    return c >= 0 && r >= 0 && c < COLS && r < ROWS;
  }

  function tileAt(c, r) {
    return inside(c, r) ? G.run.level.grid[idx(c, r)] : T_HARD;
  }

  function isBlock(t) {
    return t === T_HARD || t === T_SOFT || t === T_CRATE;
  }

  /* Rebuilds the per-step lookups after bombs or enemies moved */
  function rebuild() {
    const L = G.lvl;
    if (!L.bombAt) {
      L.bombAt = new Int32Array(N);
      L.enemyAt = new Uint8Array(N);
    }
    L.bombAt.fill(-1);
    L.enemyAt.fill(0);
    const run = G.run;
    for (let k = 0; k < run.bombs.length; ++k) {
      const b = run.bombs[k];
      if (!b.fly) L.bombAt[b.i] = k;
    }
    for (let k = 0; k < run.enemies.length; ++k) {
      const e = run.enemies[k];
      const i = idx(Math.round(e.x), Math.round(e.y));
      if (i >= 0 && i < N && L.enemyAt[i] < 255) ++L.enemyAt[i];
    }
    if (L.dirty) {
      /* teleporters pair up in reading order: first with second, third with fourth */
      L.teleTo = {};
      const list = [];
      const g = run.level.grid;
      for (let i = 0; i < N; ++i) if (g[i] === T_TELE) list.push(i);
      for (let k = 0; k + 1 < list.length; k += 2) {
        L.teleTo[list[k]] = list[k + 1];
        L.teleTo[list[k + 1]] = list[k];
      }
      L.dirty = false;
    }
  }

  function bombAtCell(c, r) {
    if (!inside(c, r)) return null;
    const k = G.lvl.bombAt[idx(c, r)];
    return k >= 0 ? G.run.bombs[k] : null;
  }

  /* Can the player stand on (c, r)? Bombs block unless passable or being stood on already */
  function playerCan(c, r, p) {
    const t = tileAt(c, r);
    if (t === T_HARD) return false;
    if ((t === T_SOFT || t === T_CRATE) && !(p.wallpass && t === T_SOFT)) return false;
    const b = bombAtCell(c, r);
    if (b && !p.bombpass && p.onBomb.indexOf(b.id) < 0) return false;
    return true;
  }

  /* Can an enemy enter (c, r)? Ghosts pass bricks; nobody walks into fire or bombs */
  function enemyCan(c, r, e, avoidFire) {
    const t = tileAt(c, r);
    if (t === T_HARD || t === T_CRATE) return false;
    if (t === T_SOFT && !(e && e.ghost)) return false;
    if (t === T_TELE) return false;
    if (bombAtCell(c, r)) return false;
    if (avoidFire !== false && G.run.fire[idx(c, r)] > 0) return false;
    return true;
  }

  /* Can a sliding bomb move into (c, r)? */
  function bombCan(c, r) {
    const t = tileAt(c, r);
    if (isBlock(t)) return false;
    if (bombAtCell(c, r)) return false;
    if (G.lvl.enemyAt[idx(c, r)]) return false;
    if (G.run.boss && NS.bosses.blocksCell(c, r)) return false;
    return true;
  }

  /* Breaks a brick (or cracks a crate) hit by fire; returns true if the blast stops here */
  function hitBlock(i, byPlayer) {
    const run = G.run;
    const g = run.level.grid;
    const t = g[i];
    const c = i % COLS, r = (i / COLS) | 0;
    if (t === T_CRATE) {
      g[i] = T_SOFT;
      NS.fx.debris(c, r, '#9aa4b0', 6);
      NS.fx.sfx('thud', { pitch: 1.3, volume: 0.5 });
      run.levelDirty = true;
      return true;
    }
    if (t !== T_SOFT) return t === T_HARD;
    g[i] = T_EMPTY;
    run.levelDirty = true;
    ++run.blocks;
    NS.tracker.stat('blocks', 1);
    if (run.mode === 'zen') NS.tracker.stat('zenBlocks', 1);
    if (byPlayer) NS.run.addScore(C.BLOCK_POINTS, c, r, true);
    NS.fx.crumble(c, r);
    reveal(i);
    return true;
  }

  /* Turns what was hidden under a broken brick into a pickup (or shows the exit) */
  function reveal(i) {
    const run = G.run;
    const h = run.level.hidden[i];
    if (!h) {
      /* bricks in zen and on later arcade arenas sometimes drop a gem on their own */
      if (run.mode === 'zen' && NS.run.rand() < 0.22) NS.items.spawn('gem', i, 0.4);
      return;
    }
    delete run.level.hidden[i];
    if (h === 'exit') {
      run.exitShown = true;
      run.exitAt = i;
      NS.fx.sparkle(i % COLS, (i / COLS) | 0, '#9af0ff', 18);
      NS.fx.sfx('zap', { pitch: 1.4, volume: 0.6 });
      NS.fx.text(i % COLS, (i / COLS) | 0, 'EXIT', '#9af0ff', 18);
      return;
    }
    NS.items.spawn(h, i, 0.6);
  }

  function countBricks() {
    const g = G.run.level.grid;
    let n = 0;
    for (let i = 0; i < N; ++i) if (g[i] === T_SOFT || g[i] === T_CRATE) ++n;
    return n;
  }

  Object.assign(NS.arena, {
    N, idx, inside, tileAt, isBlock, rebuild, bombAtCell, playerCan, enemyCan, bombCan, hitBlock, reveal, countBricks
  });
})();
