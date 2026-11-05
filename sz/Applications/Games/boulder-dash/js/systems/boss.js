/* The chapter bosses: a 2x2 creature marked BOSS in the grid that crawls toward the miner,
   digging dirt, with a special move per boss (ice blocks, summoned moles, falling rocks, a
   teleport). Falling objects, sliding ice and blasts hurt it; each hit drops a stick of dynamite
   somewhere in the cave; at zero health it bursts into gems and the exit opens. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const R = NS.rng;
  const I = NS.items;

  function cellsOf(b, w) {
    const i = b.r * w + b.c;
    return [i, i + 1, i + w, i + w + 1];
  }

  function stamp(cv, t) {
    const list = cellsOf(cv.boss, cv.w);
    for (let k = 0; k < 4; ++k) cv.cells[list[k]] = t;
  }

  function spawn(cv, kind, r, c) {
    const def = I.BOSSES[kind];
    cv.boss = { kind, r, c, hp: def.hp, max: def.hp, cool: 0, special: 0, inv: 0, hitT: 0, fr: r, fc: c, face: 1, phase: 0 };
    stamp(cv, C.BOSS);
  }

  function canOccupy(cv, r, c) {
    if (r < 1 || c < 1 || r + 1 >= cv.h - 1 || c + 1 >= cv.w - 1) return false;
    for (let y = r; y < r + 2; ++y)
      for (let x = c; x < c + 2; ++x) {
        const t = cv.cells[y * cv.w + x];
        if (t !== C.EMPTY && t !== C.DIRT && t !== C.BOSS && t !== C.EXPLODE) return false;
      }
    return true;
  }

  function moveBoss(cv, r, c) {
    const b = cv.boss;
    stamp(cv, C.EMPTY);
    b.fr = b.r; b.fc = b.c;
    if (c !== b.c) b.face = c > b.c ? 1 : -1;
    b.r = r; b.c = c;
    stamp(cv, C.BOSS);
    b.moved = cv.tick;
  }

  function touching(cv) {
    const p = cv.player, b = cv.boss;
    if (!p || !p.alive) return false;
    const dr = p.r < b.r ? b.r - p.r : p.r > b.r + 1 ? p.r - b.r - 1 : 0;
    const dc = p.c < b.c ? b.c - p.c : p.c > b.c + 1 ? p.c - b.c - 1 : 0;
    return dr + dc <= 1;
  }

  function randomEmpty(cv, rows, filter) {
    for (let tries = 0; tries < 80; ++tries) {
      const r = 1 + R.int(cv.rng, rows || cv.h - 2), c = 1 + R.int(cv.rng, cv.w - 2);
      const i = r * cv.w + c;
      if (cv.cells[i] === C.EMPTY && (!filter || filter(i, r, c))) return i;
    }
    return -1;
  }

  function special(cv) {
    const b = cv.boss, def = I.BOSSES[b.kind], p = cv.player;
    const ev = NS.physics.ev;
    if (def.special === 'rocks' || def.special === 'ice') {
      const t = def.special === 'rocks' ? C.BOULDER : C.ICE;
      for (let k = 0; k < 3; ++k) {
        const c = Math.max(1, Math.min(cv.w - 2, p.c - 4 + R.int(cv.rng, 9)));
        for (let r = 1; r < cv.h - 2; ++r) {
          const i = r * cv.w + c;
          if (cv.cells[i] === C.EMPTY && cv.cells[i - cv.w] !== C.EMPTY && Math.abs(c - p.c) > 0) {
            cv.cells[i] = t;
            cv.fall[i] = 1;
            ev(cv, 'drop', i, { k: t });
            break;
          }
        }
      }
    } else if (def.special === 'mole') {
      const i = randomEmpty(cv, 0, (j, r, c) => Math.abs(r - b.r) < 4 && Math.abs(c - b.c) < 5);
      if (i >= 0) {
        cv.cells[i] = C.MOLE;
        cv.dir[i] = 1;
        ev(cv, 'summon', i, { k: C.MOLE });
      }
    } else if (def.special === 'blink') {
      for (let tries = 0; tries < 60; ++tries) {
        const r = Math.floor(cv.h / 2) + R.int(cv.rng, Math.floor(cv.h / 2) - 2), c = 1 + R.int(cv.rng, cv.w - 3);
        if (Math.abs(r - p.r) + Math.abs(c - p.c) < 8 || !canOccupy(cv, r, c)) continue;
        ev(cv, 'blink', b.r * cv.w + b.c);
        moveBoss(cv, r, c);
        b.fr = r; b.fc = c;
        ev(cv, 'blink', r * cv.w + c);
        break;
      }
    }
    ev(cv, 'bossSpecial', b.r * cv.w + b.c, { k: def.special });
  }

  function step(cv) {
    const b = cv.boss, def = I.BOSSES[b.kind], p = cv.player;
    if (b.inv > 0) --b.inv;
    if (touching(cv)) {
      if (NS.physics.hitPlayer(cv, 'boss')) NS.physics.explodeAt(cv, p.r * cv.w + p.c, C.EMPTY, 1, 'boss');
    }
    if (cv.frozen || !p || !p.alive) return;
    const every = Math.max(2, def.every - (b.hp <= b.max / 2 ? 1 : 0));
    if (++b.cool >= every) {
      b.cool = 0;
      const dy = p.r - b.r, dx = p.c - b.c;
      const tries = [];
      const hx = dx > 0 ? 1 : -1, vy = dy > 0 ? 1 : -1;
      if (Math.abs(dx) >= Math.abs(dy)) { tries.push([0, hx], [vy, 0], [-vy, 0]); }
      else tries.push([vy, 0], [0, hx], [0, -hx]);
      for (let k = 0; k < tries.length; ++k) {
        const nr = b.r + tries[k][0], nc = b.c + tries[k][1];
        if (canOccupy(cv, nr, nc)) { moveBoss(cv, nr, nc); break; }
      }
    }
    if (def.specialEvery && ++b.special >= def.specialEvery) {
      b.special = 0;
      special(cv);
    }
  }

  function damage(cv, source) {
    const b = cv.boss;
    if (!b || cv.bossDefeated || b.inv > 0) return;
    --b.hp;
    b.inv = 10;
    b.hitT = cv.tick;
    const ev = NS.physics.ev;
    ev(cv, 'bossHit', b.r * cv.w + b.c, { hp: b.hp, source });
    if (b.hp <= 0) {
      cv.bossDefeated = true;
      const center = b.r * cv.w + b.c;
      stamp(cv, C.EMPTY);
      ev(cv, 'bossDie', center, { kind: b.kind });
      NS.physics.explodeAt(cv, center, C.GEM, 2, 'boss');
      NS.physics.explodeAt(cv, center + cv.w + 1, C.GEM, 1, 'boss');
      return;
    }
    /* drop fresh dynamite somewhere safe to reach */
    const i = randomEmpty(cv, 0, (j) => !C.FALLS[cv.cells[j - cv.w]] && cv.cells[j + cv.w] !== C.EMPTY);
    if (i >= 0) {
      cv.cells[i] = C.ITEM;
      cv.item[i] = 1;
      ev(cv, 'drop', i, { k: C.ITEM });
    }
  }

  Object.assign(NS.boss, { spawn, step, damage, cellsOf, touching });
})();
