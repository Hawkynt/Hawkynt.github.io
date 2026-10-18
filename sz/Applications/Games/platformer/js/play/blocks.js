/*
 * Blocks in play: coin and power blocks, crates, foes bonked from below and crumbling floors.
 * Writes G.run (tiles, bumps, crumbles, coins, items).
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const { TS, T, STEP } = NS.config;
  const Ph = SZ.PlatformerPhysics;
  const Ent = SZ.PlatformerEntities;
  const Fx = SZ.PlatformerFx;
  const Combat = NS.module('combat');
  const { sfx } = NS.module('sound');
  const fxWorld = G.fxWorld;
  const shake = G.shake;

  function hitBlock(c, rr, fromBelow) {
    const r = G.run, level = r.level;
    const code = Ph.tileAt(level, c, rr);
    const idx = rr * level.cols + c;
    const x = c * TS + TS / 2, y = rr * TS + TS / 2;
    if (code === T.QBLOCK) {
      r.bumps[idx] = 0.2;
      const power = r.level.powerBlocks[idx];
      Ph.setTile(level, c, rr, T.USED);
      if (power) {
        const kind = !r.fire ? 'fire' : r.hearts < r.maxHearts ? 'heart' : 'star';
        r.items.push(Ent.createBlockItem(kind, c, rr));
        Fx.flash(fxWorld, x, y - TS / 2, '#fff4c0', 110, 0.3);
        sfx('powerup', { pitch: 0.8, volume: 0.6 });
      } else {
        for (let k = 0; k < G.stats.blockCoins; ++k)
          r.coins.push({ x: x, y: y - 10, taken: false, vx: (k - (G.stats.blockCoins - 1) / 2) * 70, vy: -520 - k * 30, pull: false, pop: 0.45 + k * 0.05, t: 0 });
        sfx('coin');
      }
      Fx.debris(fxWorld, x, y - TS / 2, '#ffd75a', 4);
      bonkAbove(c, rr);
    } else if (code === T.CRATE && fromBelow) {
      breakCrate(c, rr);
    } else if (fromBelow && code !== T.EMPTY) {
      sfx('thud', { volume: 0.3, pitch: 1.6 });
      r.bumps[idx] = 0.12;
    }
  }

  function breakCrate(c, rr) {
    const r = G.run, level = r.level;
    if (Ph.tileAt(level, c, rr) !== T.CRATE)
      return;
    Ph.setTile(level, c, rr, T.EMPTY);
    r.tiles.refresh(c, rr);
    Fx.debris(fxWorld, c * TS + TS / 2, rr * TS + TS / 2, ['#b07a3a', '#6a5a6a', '#8ab0c8', '#5a4a48', '#c8b8e8'][r.world], 12);
    sfx('smallExplode');
    shake.add(0.1);
    bonkAbove(c, rr);
  }

  /* foes standing on a block that gets hit from below are knocked out */
  function bonkAbove(c, rr) {
    for (const e of G.run.enemies) {
      if (!e.alive || e.air)
        continue;
      if (Math.abs(e.y + e.h - rr * TS) < 4 && e.x + e.w > c * TS && e.x < (c + 1) * TS)
        Combat.killEnemy(e, 'bonk');
    }
  }

  function standOnCrumble(p) {
    const level = G.run.level;
    const rr = Math.floor((p.y + p.h + 2) / TS);
    for (let c = Math.floor(p.x / TS); c <= Math.floor((p.x + p.w - 1) / TS); ++c) {
      if (Ph.tileAt(level, c, rr) !== T.CRUMBLE)
        continue;
      const idx = rr * level.cols + c;
      let k = G.run.crumbles.get(idx);
      if (!k) {
        k = { c: c, r: rr, t: 0, gone: 0 };
        G.run.crumbles.set(idx, k);
      }
      if (!k.gone)
        k.t += STEP;
    }
  }

  function updateCrumbles() {
    const r = G.run, level = r.level, p = r.player;
    for (const [idx, k] of r.crumbles) {
      if (!k.gone && k.t > 0) {
        if (k.t > 0.5) {
          Ph.setTile(level, k.c, k.r, T.EMPTY);
          k.gone = 4;
          Fx.debris(fxWorld, k.c * TS + TS / 2, k.r * TS + TS / 2, ['#8a6a4a', '#5a6480', '#a8b8cc', '#4a383c', '#d8d0e8'][r.world], 8);
          sfx('smallExplode', { volume: 0.5 });
        }
      } else if (k.gone) {
        k.gone -= STEP;
        if (k.gone <= 0) {
          const box = { x: k.c * TS, y: k.r * TS, w: TS, h: TS };
          if (Ph.overlaps(p, box)) {
            k.gone = 0.5;
          } else {
            Ph.setTile(level, k.c, k.r, T.CRUMBLE);
            r.crumbles.delete(idx);
            fxWorld.spawn({ kind: 'glow', color: '#ffffff', x: box.x + TS / 2, y: box.y + TS / 2, size: 30, size1: 60, life: 0.3, alpha: 0.5 });
          }
        }
      }
    }
  }

  Object.assign(NS.module('blocks'), {
    hitBlock,
    breakCrate,
    standOnCrumble,
    updateCrumbles
  });
})();
