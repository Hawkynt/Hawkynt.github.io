/* The miner: one step per move slot - walk, dig dirt (or brick with the drill), collect gems,
   power-ups and seasonal tokens, push boulders, barrels and ice sideways after a short strain,
   grab (dig or collect beside you without moving), walk out of the open exit. Also applies the
   power-ups, drops dynamite and runs the gem magnet. Records what happened in cave.events. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const I = NS.items;

  function ev(cv, t, i, extra) {
    return NS.physics.ev(cv, t, i, extra);
  }

  function collectAt(cv, j) {
    const t = cv.cells[j];
    if (t === C.GEM || t === C.BIGGEM) {
      const v = t === C.BIGGEM ? 5 : 1;
      cv.gems += v;
      cv.cells[j] = C.EMPTY;
      cv.fall[j] = 0;
      ev(cv, 'gem', j, { v, big: t === C.BIGGEM });
      return true;
    }
    if (t === C.ITEM) {
      const kind = cv.item[j];
      cv.item[j] = 0;
      cv.cells[j] = C.EMPTY;
      if (kind === I.TOKEN) ev(cv, 'token', j);
      else applyItem(cv, kind, j);
      return true;
    }
    return false;
  }

  function applyItem(cv, kind, j) {
    const p = cv.player, pk = cv.perks || {};
    const def = I.POWERUPS[kind];
    if (!def) return;
    switch (def.key) {
      case 'bomb': p.bombs += 2; break;
      case 'shield': p.shield = Math.min((pk.shieldMax || 1) + 0, p.shield + 1); break;
      case 'time': cv.timeAdd += 20; break;
      case 'life': break;
      default: {
        let dur = def.dur * (1 + (pk.powerDur || 0));
        if (def.key === 'slow') dur += pk.slowDur || 0;
        if (def.key === 'freeze') dur += pk.freezeDur || 0;
        if (def.key === 'drill') dur += pk.drillDur || 0;
        if (def.key === 'boots') dur += pk.bootsDur || 0;
        p.pow[def.key] = Math.max(p.pow[def.key] || 0, dur);
      }
    }
    ev(cv, 'item', j, { kind });
  }

  function placePlayer(cv, from, to) {
    const p = cv.player;
    cv.cells[from] = C.EMPTY;
    cv.cells[to] = C.PLAYER;
    p.fr = p.r; p.fc = p.c;
    p.r = (to / cv.w) | 0;
    p.c = to % cv.w;
    p.moveT = 0;
    p.moved = 1;
  }

  /* One move attempt in direction d; grab digs or collects without stepping */
  function tryMove(cv, d, grab) {
    const p = cv.player;
    if (!p || !p.alive || cv.won) return false;
    const w = cv.w;
    const i = p.r * w + p.c;
    const j = i + C.DX[d] + C.DY[d] * w;
    const t = cv.cells[j];
    if (C.DX[d]) p.facing = C.DX[d];
    p.dir = d;
    if (d !== p.pushDir) { p.push = 0; p.pushDir = d; }

    if (t === C.EXIT && cv.exitOpen) {
      if (grab) return false;
      placePlayer(cv, i, j);
      cv.won = true;
      ev(cv, 'win', j);
      return true;
    }
    if (t === C.DIRT || (t === C.BRICK && p.pow.drill > 0)) {
      cv.cells[j] = C.EMPTY;
      ev(cv, t === C.DIRT ? 'dig' : 'drill', j, { d });
      p.digT = 1;
      if (!grab) placePlayer(cv, i, j);
      return true;
    }
    if (t === C.GEM || t === C.BIGGEM || t === C.ITEM) {
      collectAt(cv, j);
      if (!grab) placePlayer(cv, i, j);
      return true;
    }
    if (t === C.EMPTY) {
      if (grab) return false;
      placePlayer(cv, i, j);
      ev(cv, 'step', j);
      return true;
    }
    if ((t === C.BOULDER || t === C.TNT || t === C.ICE) && C.DX[d] && !grab) {
      const k = j + C.DX[d];
      if (cv.cells[k] !== C.EMPTY || cv.fall[j]) return false;
      if (++p.push < 2) {
        ev(cv, 'strain', j, { d });
        return false;
      }
      p.push = 0;
      cv.cells[k] = t;
      cv.aux[k] = t === C.ICE ? d + 1 : 0;
      cv.cells[j] = C.EMPTY;
      cv.aux[j] = 0;
      cv.mvx[k] = C.DX[d];
      cv.stamp[k] = cv.tick;
      placePlayer(cv, i, j);
      ev(cv, 'push', k, { d, k: t });
      return true;
    }
    return false;
  }

  function dropBomb(cv) {
    const p = cv.player;
    if (!p || !p.alive || p.bombs <= 0) return false;
    const i = p.r * cv.w + p.c;
    for (let k = 0; k < cv.bombs.length; ++k)
      if (cv.bombs[k].i === i) return false;
    --p.bombs;
    const pk = cv.perks || {};
    cv.bombs.push({ i, fuse: Math.max(4, Math.round(11 * (1 - (pk.fuse || 0)))), rad: pk.blast ? 2 : 1 });
    ev(cv, 'bombSet', i);
    return true;
  }

  /* pulls the nearest gem within reach straight into the miner's pocket */
  function magnet(cv) {
    const p = cv.player;
    const rad = 3 + ((cv.perks && cv.perks.magnetRadius) || 0);
    let best = -1, bd = 99;
    for (let r = Math.max(1, p.r - rad); r <= Math.min(cv.h - 2, p.r + rad); ++r)
      for (let c = Math.max(1, p.c - rad); c <= Math.min(cv.w - 2, p.c + rad); ++c) {
        const j = r * cv.w + c, t = cv.cells[j];
        if (t !== C.GEM && t !== C.BIGGEM) continue;
        if (c === p.c && r < p.r) continue;   /* never pull the gem out from under a load above */
        const d = Math.abs(r - p.r) + Math.abs(c - p.c);
        if (d < bd) { bd = d; best = j; }
      }
    if (best < 0) return false;
    ev(cv, 'magnet', best, { to: p.r * cv.w + p.c });
    collectAt(cv, best);
    return true;
  }

  Object.assign(NS.player, { tryMove, dropBomb, magnet, applyItem, collectAt });
})();
