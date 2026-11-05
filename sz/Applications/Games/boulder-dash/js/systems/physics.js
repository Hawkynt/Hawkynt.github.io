/* The cave tick, scanned top to bottom like the original: boulders, gems, ice and powder barrels
   fall, roll off rounded things and crush what they land on; ice slides once pushed; barrels go
   off; the magic wall turns boulders into gems and back; spore moss grows and turns to gems when
   trapped or to boulders when it grows too large; explosions run their course; dynamite fuses
   burn; creatures and the boss take their turns. Records what happened in cave.events. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const R = NS.rng;

  const EXPLODE_TICKS = 3;

  function ev(cv, t, i, extra) {
    const e = extra || {};
    e.t = t;
    e.i = i;
    cv.events.push(e);
    return e;
  }

  /* the miner takes a deadly hit; returns true when it is fatal */
  function hitPlayer(cv, cause) {
    const p = cv.player;
    if (!p || !p.alive) return false;
    const i = p.r * cv.w + p.c;
    if (p.invuln > 0) return false;
    if (cv.zen) {
      p.invuln = 12;
      ev(cv, 'bonk', i, { cause });
      return false;
    }
    if (p.shield > 0) {
      --p.shield;
      p.invuln = cv.grace || 10;
      ev(cv, 'shield', i, { cause });
      return false;
    }
    if (cv.escape && R.next(cv.rng) < cv.escape) {
      p.invuln = 10;
      ev(cv, 'escape', i, { cause });
      return false;
    }
    p.alive = false;
    p.deadT = 0;
    ev(cv, 'death', i, { cause });
    return true;
  }

  /* blasts a square around a cell; leaves EMPTY or GEM behind */
  function explodeAt(cv, center, leaves, radius, source) {
    const { w, h, cells } = cv;
    const r0 = (center / w) | 0, c0 = center % w;
    const rad = radius || 1;
    let bossHit = false;
    ev(cv, 'explode', center, { rad, leaves, source: source || '' });
    for (let r = r0 - rad; r <= r0 + rad; ++r) {
      if (r < 0 || r >= h) continue;
      for (let c = c0 - rad; c <= c0 + rad; ++c) {
        if (c < 0 || c >= w) continue;
        const j = r * w + c, t = cells[j];
        if (t === C.BOSS) {
          if (!bossHit) { bossHit = true; NS.boss.damage(cv, 'blast'); }
          continue;
        }
        if (C.BLASTPROOF[t]) continue;
        if (t === C.PLAYER) {
          if (!hitPlayer(cv, 'blast')) continue;
        }
        if (t === C.TNT && j !== center) {
          if (cv.chain.indexOf(j) < 0) cv.chain.push(j);
          continue;
        }
        if (t === C.BRICK) ev(cv, 'brick', j);
        if (C.CREATURE[t]) ev(cv, 'kill', j, { k: t, by: source || 'blast' });
        cells[j] = C.EXPLODE;
        cv.aux[j] = EXPLODE_TICKS;
        cv.dir[j] = leaves;
        cv.fall[j] = 0;
        cv.item[j] = 0;
        cv.stamp[j] = cv.tick;
      }
    }
  }

  function creatureLeaves(t) {
    return t === C.BUTTERFLY ? C.GEM : C.EMPTY;
  }

  /* a falling object comes down on cell `below` */
  function impact(cv, i, below, t) {
    const cells = cv.cells;
    const b = cells[below];
    if (b === C.PLAYER) {
      if (hitPlayer(cv, 'crush')) {
        explodeAt(cv, below, C.EMPTY, 1, 'crush');
        return true;
      }
      return false;
    }
    if (C.CREATURE[b]) {
      ev(cv, 'crush', below, { k: b });
      explodeAt(cv, below, creatureLeaves(b), 1, 'crush');
      return true;
    }
    if (b === C.BOSS) {
      NS.boss.damage(cv, 'crush');
      ev(cv, 'shatter', i, { k: t });
      cells[i] = C.EMPTY;
      cv.fall[i] = 0;
      return true;
    }
    if (t === C.TNT || b === C.TNT) {
      explodeAt(cv, t === C.TNT ? i : below, C.EMPTY, 1, 'tnt');
      ++cv.chainCount;
      return true;
    }
    if (b === C.MAGIC) {
      if (cv.magic.state === 0) {
        cv.magic.state = 1;
        cv.magic.t = cv.magic.dur;
        ev(cv, 'magic', below);
      }
      if (cv.magic.state === 1) {
        const out = below + cv.w;
        cells[i] = C.EMPTY;
        cv.fall[i] = 0;
        if (cells[out] === C.EMPTY) {
          cells[out] = t === C.GEM || t === C.BIGGEM ? C.BOULDER : t === C.BOULDER ? C.GEM : t;
          cv.fall[out] = 1;
          cv.mvy[out] = 2;
          cv.stamp[out] = cv.tick;
        }
        ev(cv, 'convert', out, { k: t });
        return true;
      }
    }
    if (b === C.LAVA) {
      cells[i] = C.EMPTY;
      cv.fall[i] = 0;
      if (t === C.BOULDER || t === C.ICE) cells[below] = C.BRICK;
      ev(cv, 'sizzle', below, { k: t });
      return true;
    }
    return false;
  }

  function updateFaller(cv, i, t) {
    const { w, cells } = cv;
    const below = i + w;
    if (cells[below] === C.EMPTY) {
      cells[below] = t; cv.aux[below] = cv.aux[i];
      cells[i] = C.EMPTY; cv.aux[i] = 0;
      cv.fall[below] = 1; cv.fall[i] = 0;
      cv.mvy[below] = 1;
      cv.stamp[below] = cv.tick;
      return;
    }
    if (cv.fall[i]) {
      if (impact(cv, i, below, t)) return;
      cv.fall[i] = 0;
      ev(cv, 'land', i, { k: t });
    }
    /* roll off rounded things */
    if (C.ROLLS[t] && C.ROUNDED[cells[below]]) {
      const first = R.next(cv.rng) < 0.5 ? -1 : 1;
      for (let s = 0; s < 2; ++s) {
        const side = s === 0 ? first : -first;
        const j = i + side;
        if (cells[j] === C.EMPTY && cells[j + w] === C.EMPTY) {
          cells[j] = t; cells[i] = C.EMPTY;
          cv.fall[j] = 1; cv.fall[i] = 0;
          cv.mvx[j] = side;
          cv.stamp[j] = cv.tick;
          return;
        }
      }
    }
    /* pushed ice keeps sliding until it hits something */
    if (t === C.ICE && cv.aux[i]) {
      const d = cv.aux[i] - 1;
      const j = i + C.DX[d];
      if (cells[j] === C.EMPTY) {
        cells[j] = t; cv.aux[j] = cv.aux[i];
        cells[i] = C.EMPTY; cv.aux[i] = 0;
        cv.mvx[j] = C.DX[d];
        cv.stamp[j] = cv.tick;
      } else {
        if (C.CREATURE[cells[j]]) {
          ev(cv, 'crush', j, { k: cells[j] });
          explodeAt(cv, j, creatureLeaves(cells[j]), 1, 'ice');
        } else if (cells[j] === C.BOSS) NS.boss.damage(cv, 'ice');
        cv.aux[i] = 0;
        ev(cv, 'land', i, { k: t });
      }
    }
  }

  function updateExplosion(cv, i) {
    if (--cv.aux[i] > 0) return;
    cv.cells[i] = cv.dir[i] || C.EMPTY;
    cv.dir[i] = 0;
  }

  /* ── Spore moss ── */
  function updateAmoeba(cv) {
    const { w, cells } = cv;
    const am = cv.amoeba;
    let count = 0, canGrow = false;
    const grow = am.ticks > am.fastAfter ? 0.09 : 0.025;
    ++am.ticks;
    for (let i = 0; i < cells.length; ++i) {
      if (cells[i] !== C.AMOEBA || cv.stamp[i] === cv.tick) continue;
      ++count;
      for (let d = 0; d < 4; ++d) {
        const t = cells[i + C.DX[d] + C.DY[d] * w];
        if (t === C.EMPTY || t === C.DIRT) { canGrow = true; break; }
      }
      if (R.next(cv.rng) < grow) {
        const d = R.int(cv.rng, 4);
        const j = i + C.DX[d] + C.DY[d] * w;
        if (cells[j] === C.EMPTY || cells[j] === C.DIRT) {
          cells[j] = C.AMOEBA;
          cv.stamp[j] = cv.tick;
          ++count;
        }
      }
    }
    am.count = count;
    if (!count) return;
    if (!canGrow || count >= am.limit) {
      const into = canGrow ? C.BOULDER : C.GEM;
      for (let i = 0; i < cells.length; ++i)
        if (cells[i] === C.AMOEBA) cells[i] = into;
      ev(cv, into === C.GEM ? 'amoebaGems' : 'amoebaRocks', -1, { n: count });
      am.count = 0;
    }
  }

  function updateBombs(cv) {
    for (let k = cv.bombs.length - 1; k >= 0; --k) {
      const b = cv.bombs[k];
      if (--b.fuse > 0) continue;
      cv.bombs.splice(k, 1);
      ev(cv, 'bomb', b.i);
      explodeAt(cv, b.i, C.EMPTY, b.rad || 1, 'bomb');
    }
  }

  function updateChain(cv) {
    if (!cv.chain.length) return;
    const list = cv.chain;
    cv.chain = [];
    for (let k = 0; k < list.length; ++k) {
      if (cv.cells[list[k]] !== C.TNT) continue;
      ++cv.chainCount;
      explodeAt(cv, list[k], C.EMPTY, 1, 'tnt');
    }
    ev(cv, 'chain', -1, { n: cv.chainCount });
  }

  function checkExit(cv) {
    if (cv.exitOpen) return;
    const bossOk = !cv.boss || cv.bossDefeated;
    if (cv.gems >= cv.required && bossOk) {
      cv.exitOpen = true;
      cv.aux[cv.exitR * cv.w + cv.exitC] = 1;
      ev(cv, 'exitOpen', cv.exitR * cv.w + cv.exitC);
    }
  }

  /* One cave tick */
  function tick(cv) {
    ++cv.tick;
    const { cells, w, h } = cv;
    cv.mvx.fill(0);
    cv.mvy.fill(0);
    cv.chainCount = 0;
    updateChain(cv);
    for (let r = 1; r < h - 1; ++r)
      for (let c = 1; c < w - 1; ++c) {
        const i = r * w + c;
        if (cv.stamp[i] === cv.tick) continue;
        const t = cells[i];
        if (C.FALLS[t]) updateFaller(cv, i, t);
        else if (t === C.EXPLODE) updateExplosion(cv, i);
        else if (C.CREATURE[t]) NS.creatures.step(cv, i, t);
      }
    if (cv.magic.state === 1 && --cv.magic.t <= 0) {
      cv.magic.state = 2;
      ev(cv, 'magicEnd', -1);
    }
    if (cv.amoeba.count || cv.tick === 1) updateAmoeba(cv);
    updateBombs(cv);
    if (cv.boss && !cv.bossDefeated) NS.boss.step(cv);
    NS.creatures.contact(cv);
    if (cv.player && cv.player.invuln > 0) --cv.player.invuln;
    checkExit(cv);
    /* embedded objects lose their dirt backing once they leave or the cell opens */
    const bg = cv.bg;
    for (let i = 0; i < cells.length; ++i)
      if (bg[i] && (cells[i] === C.EMPTY || cv.mvx[i] || cv.mvy[i] || !C.FALLS[cells[i]] && cells[i] !== C.ITEM)) bg[i] = 0;
  }

  Object.assign(NS.physics, { tick, explodeAt, hitPlayer, ev, checkExit, creatureLeaves, EXPLODE_TICKS });
})();
