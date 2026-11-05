/* The ghosts: the house (waiting, leaving, eyes returning and re-entering), classic targeting
   for Blinky, Pinky, Inky and Clyde (with Cruise Elroy), the Gobbler that eats dots, the Dasher
   that charges down straight halls, the Phantom that drifts through walls, fright, freezing,
   stuns, reversals, and the touch with Pac-Man (eaten, harmless or a catch). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const C = NS.constants;
  const { COLS, ROWS, DX, DY, D_DOT } = C;
  const { GHOSTS } = NS.items;
  const grid = NS.grid;
  const FX = NS.fx;
  const R = NS.rules;
  const { sfx } = NS.audio;
  const rnd = NS.rng.fx;

  function aiOf(g) {
    return GHOSTS[g.kind].ai;
  }

  /* where Pac-Man seems to be (the Decoy fools them) */
  function bait(lvl) {
    return lvl.decoy || lvl.pac;
  }

  function elroy(lvl, g) {
    return aiOf(g) === 'chase' && lvl.cfg.elroy > 0 && lvl.dotsLeft <= lvl.cfg.elroy && lvl.kind === 'maze';
  }

  function target(lvl, g) {
    const p = bait(lvl);
    const px = Math.floor(p.x), py = Math.floor(p.y);
    const ai = aiOf(g);
    if (lvl.mode === 'scatter' && !elroy(lvl, g) && ai !== 'gobble') return GHOSTS[g.kind].scatter;
    const face = p.face !== undefined ? p.face : 0;
    switch (ai) {
      case 'ambush': {
        let tx = px + DX[face] * 4;
        if (face === 1) tx -= 4;
        return { x: tx, y: py + DY[face] * 4 };
      }
      case 'flank': {
        let b = null;
        for (let i = 0; i < lvl.ghosts.length; ++i) if (aiOf(lvl.ghosts[i]) === 'chase') { b = lvl.ghosts[i]; break; }
        b = b || g;
        const ax = px + DX[face] * 2, ay = py + DY[face] * 2;
        return { x: ax + (ax - Math.floor(b.x)), y: ay + (ay - Math.floor(b.y)) };
      }
      case 'shy':
        return grid.dist2(g.x, g.y, p.x, p.y) > 64 ? { x: px, y: py } : GHOSTS[g.kind].scatter;
      case 'gobble':
        return g.belly < 24 ? nearestDot(lvl, g) : { x: px, y: py };
      default:
        return { x: px, y: py };
    }
  }

  function nearestDot(lvl, g) {
    const m = lvl.maze;
    const gx = Math.floor(g.x), gy = Math.floor(g.y);
    let best = null, bd = Infinity;
    for (let i = 0; i < m.dots.length; ++i) {
      if (m.dots[i] !== D_DOT) continue;
      const x = i % COLS, y = (i - x) / COLS;
      const d = Math.abs(x - gx) + Math.abs(y - gy);
      if (d < bd && d > 0) { bd = d; best = { x: x, y: y }; }
    }
    return best || { x: Math.floor(lvl.pac.x), y: Math.floor(lvl.pac.y) };
  }

  function decide(lvl, g, tx, ty) {
    const m = lvl.maze;
    const ai = aiOf(g);
    const tile = ty * COLS + tx;
    if (ai === 'gobble' && !g.scared && g.belly < 24 && m.dots[tile] === D_DOT) {
      m.dots[tile] = 0;
      --lvl.dotsLeft;
      ++g.belly;
      ++lvl.gobbled;
      FX.particle(grid.px(tx + 0.5), grid.py(ty + 0.5), 0, -30, 0.4, 4, '#7aff5a', 0, 0, 2);
    }
    if (g.eyesHome) return;
    const rev = grid.opposite(g.dir);
    if (ai === 'dash' && !g.scared && g.dashCd <= 0 && lvl.mode === 'chase') {
      const d = lineOfSight(lvl, tx, ty);
      if (d >= 0) {
        g.dir = d;
        g.dash = 1.1;
        g.dashCd = 4.5;
        FX.ring(grid.px(g.x), grid.py(g.y), 6, 40, 0.3, '#ff8a1a', 3);
        sfx('whoosh', { pitch: 1.6, volume: 0.35 });
        return;
      }
    }
    if (g.dash > 0 && grid.canEnter(m, tx + DX[g.dir], ty + DY[g.dir], 'ghost')) return;
    const kind = g.mode === 'eyes' ? 'eyes' : 'ghost';
    const tgt = g.mode === 'eyes' ? C.DOOR : target(lvl, g);
    let best = -1, bd = Infinity;
    const opts = [];
    for (let d = 0; d < 4; ++d) {
      if (d === rev) continue;
      const nx = tx + DX[d], ny = ty + DY[d];
      if (!grid.canEnter(m, nx, ny, kind)) continue;
      opts.push(d);
      const dd = grid.dist2(nx + 0.5, ny + 0.5, tgt.x + 0.5, tgt.y + 0.5);
      if (dd < bd) { bd = dd; best = d; }
    }
    if (g.scared && g.mode === 'out' && opts.length) best = opts[Math.floor(rnd() * opts.length)];
    g.dir = best >= 0 ? best : rev;
  }

  /* the direction to Pac-Man along a clear straight line within 12 tiles, or -1 */
  function lineOfSight(lvl, tx, ty) {
    const p = lvl.pac;
    const px = Math.floor(p.x), py = Math.floor(p.y);
    if (px !== tx && py !== ty) return -1;
    const d = px === tx ? (py > ty ? 3 : 1) : (px > tx ? 2 : 0);
    const n = Math.abs(px - tx) + Math.abs(py - ty);
    if (n > 12 || n < 2) return -1;
    for (let k = 1; k < n; ++k)
      if (!grid.canEnter(lvl.maze, tx + DX[d] * k, ty + DY[d] * k, 'ghost')) return -1;
    return d;
  }

  function speedOf(lvl, g) {
    const cfg = lvl.cfg;
    let s;
    if (g.mode === 'eyes') return C.EYES_SPEED;
    if (g.scared) s = cfg.ghostSpeed * 0.62 * G.stats.frightSlow;
    else {
      s = cfg.ghostSpeed * GHOSTS[g.kind].speed;
      if (elroy(lvl, g)) s *= lvl.dotsLeft <= cfg.elroy / 2 ? 1.12 : 1.06;
      if (g.dash > 0) s *= 2.1;
    }
    if (lvl.effects.slowmo > 0) s *= 0.5;
    const tx = Math.floor(g.x), ty = Math.floor(g.y);
    if (lvl.maze.tunnels.indexOf(ty) >= 0 && (tx < 5 || tx > COLS - 6)) s = Math.min(s, C.TUNNEL_SPEED);
    if (NS.pac.featAt(lvl.maze, g.x, g.y) === C.F_TAFFY) s *= 0.7;
    return s;
  }

  function update(run, dt) {
    const lvl = run.lvl;
    const frozen = lvl.effects.freeze > 0;
    for (let i = 0; i < lvl.ghosts.length; ++i) {
      const g = lvl.ghosts[i];
      g.bob += dt;
      if (g.flash > 0) g.flash -= dt;
      if (g.squash > 0) g.squash = Math.max(0, g.squash - dt * 4);
      if (g.dashCd > 0) g.dashCd -= dt;
      if (g.dash > 0) g.dash -= dt;
      if (g.stun > 0) { g.stun -= dt; continue; }
      if (frozen && g.mode !== 'eyes' && g.mode !== 'entering') continue;
      step(lvl, g, dt);
    }
  }

  function step(lvl, g, dt) {
    switch (g.mode) {
      case 'house':
        g.release -= dt;
        if (g.release <= 0) g.mode = 'leaving';
        return;
      case 'leaving': {
        const sp = 3.2 * dt;
        if (Math.abs(g.x - 14) > 0.01) g.x += Math.max(-sp, Math.min(sp, 14 - g.x));
        else if (g.y > 11.5) g.y = Math.max(11.5, g.y - sp);
        else {
          g.x = rnd() < 0.5 ? 13.5 : 14.5;
          g.y = 11.5;
          g.dir = g.x < 14 ? 0 : 2;
          g.mode = 'out';
          g.squash = 0.6;
        }
        return;
      }
      case 'entering': {
        const sp = 6 * dt;
        const slot = C.HOUSE_SLOTS[Math.max(1, Math.min(g.slot, 3))];
        if (g.y < 14.5) g.y = Math.min(14.5, g.y + sp);
        else if (Math.abs(g.x - slot.x) > 0.01) g.x += Math.max(-sp, Math.min(sp, slot.x - g.x));
        else {
          g.mode = 'house';
          g.release = 0.7;
          g.scared = false;
          g.squash = 0.6;
        }
        return;
      }
      case 'eyes':
        if (aiOf(g) === 'phase') { floatTo(g, 14, 11.5, C.EYES_SPEED * dt, () => enter(g)); return; }
        grid.travel(g, C.EYES_SPEED * dt, (e, tx, ty) => {
          if (ty === C.DOOR.y && (tx === 13 || tx === 14)) {
            enter(e);
            e.dir = -1;
            return;
          }
          decide(lvl, e, tx, ty);
        });
        return;
      case 'out':
        if (aiOf(g) === 'phase') { phantom(lvl, g, dt); return; }
        grid.travel(g, speedOf(lvl, g) * dt, (e, tx, ty) => decide(lvl, e, tx, ty));
        return;
    }
  }

  function enter(g) {
    g.mode = 'entering';
    g.x = 14;
    g.y = 11.5;
  }

  function floatTo(g, tx, ty, sp, arrive) {
    const dx = tx - g.x, dy = ty - g.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d <= sp) { g.x = tx; g.y = ty; arrive(); return; }
    g.x += dx / d * sp;
    g.y += dy / d * sp;
    g.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 2) : (dy < 0 ? 1 : 3);
  }

  /* drifts straight through walls: toward its target, away from Pac-Man when scared */
  function phantom(lvl, g, dt) {
    const sp = speedOf(lvl, g) * 0.62 * dt;
    let tx, ty;
    if (g.scared) {
      const p = lvl.pac;
      tx = g.x + (g.x - p.x);
      ty = g.y + (g.y - p.y);
    } else {
      const t = target(lvl, g);
      tx = t.x + 0.5;
      ty = t.y + 0.5;
    }
    tx = Math.max(1, Math.min(COLS - 1, tx));
    ty = Math.max(1, Math.min(ROWS - 1, ty));
    floatTo(g, tx, ty, sp, () => {});
  }

  /* during the ready pause: house ghosts bob */
  function idle(lvl, dt) {
    for (let i = 0; i < lvl.ghosts.length; ++i) lvl.ghosts[i].bob += dt;
  }

  function frighten(run) {
    const lvl = run.lvl;
    lvl.frightT = lvl.cfg.frightTime + G.stats.frightBonus + (lvl.kind === 'boss' ? 3.5 : 0);
    lvl.frightMax = lvl.frightT;
    lvl.ghostCombo = 0;
    for (let i = 0; i < lvl.ghosts.length; ++i) {
      const g = lvl.ghosts[i];
      if (g.mode === 'eyes' || g.mode === 'entering') continue;
      g.scared = true;
      g.dash = 0;
      if (g.mode === 'out' && aiOf(g) !== 'phase') g.dir = grid.opposite(g.dir);
    }
    if (lvl.boss) NS.boss.frighten(lvl.boss);
  }

  function reverseAll(lvl) {
    for (let i = 0; i < lvl.ghosts.length; ++i) {
      const g = lvl.ghosts[i];
      if (g.mode === 'out' && aiOf(g) !== 'phase' && !g.scared) g.dir = grid.opposite(g.dir);
    }
  }

  function sendHome(g) {
    g.mode = 'eyes';
    g.scared = false;
    g.stun = 0;
    g.dash = 0;
    if (aiOf(g) !== 'phase') {
      g.x = Math.floor(g.x) + 0.5;
      g.y = Math.floor(g.y) + 0.5;
      if (grid.wallAt(grid.maze(), Math.floor(g.x), Math.floor(g.y)) !== C.W_OPEN) {
        g.x = 13.5;
        g.y = 11.5;
      }
    }
  }

  function eat(run, g) {
    const lvl = run.lvl;
    const st = G.stats;
    const x = grid.px(g.x), y = grid.py(g.y);
    let base = C.GHOST_POINTS[Math.min(lvl.ghostCombo, 3)] * st.ghostBonus;
    if (g.belly > 0) base += g.belly * 50;
    ++lvl.ghostCombo;
    const pts = NS.level.addScore(run, Math.round(base));
    FX.floater(x, y - 6, String(pts), '#7af0ff', 22, 1.1);
    if (g.belly > 0) FX.floater(x, y - 30, 'JACKPOT!', '#7aff5a', 20, 1.2);
    FX.burst(x, y, 24, g.color, 260, 0.5, 6, 0);
    FX.ring(x, y, 8, 70, 0.35, '#7af0ff', 4);
    FX.addShake(5);
    FX.hitStop(run.mode === 'zen' ? 0.04 : 0.1);
    sfx('zap', { pitch: 0.7 + lvl.ghostCombo * 0.15 });
    sfx('coin', { pitch: 0.8 + lvl.ghostCombo * 0.1, volume: 0.6 });
    g.belly = 0;
    sendHome(g);
    if (st.echo && lvl.frightT > 0) lvl.frightT = Math.min(lvl.frightMax + 3, lvl.frightT + 1);
    if (st.burst > 0) lvl.pac.burstT = 3;
    NS.level.addMult(run, 10);
    if (!run.demo) {
      ++run.tally.ghosts;
      R.bump(G.profile, 'ghosts', 1);
      if (lvl.ghostCombo === 4) {
        const a = R.feat(G.profile, 'quad');
        if (a) NS.screens.achievements([a]);
      }
    }
  }

  function collide(run) {
    const lvl = run.lvl;
    const pac = lvl.pac;
    const mega = lvl.effects.mega > 0;
    const reach = mega ? 1.1 : 0.62;
    for (let i = 0; i < lvl.ghosts.length; ++i) {
      const g = lvl.ghosts[i];
      if (g.mode !== 'out' && g.mode !== 'leaving') continue;
      if (grid.dist2(pac.x, pac.y, g.x, g.y) > reach * reach) continue;
      if (g.scared || mega) { eat(run, g); continue; }
      if (g.stun > 0 || lvl.effects.freeze > 0) continue;
      if (NS.level.caught(run, g)) return;
    }
  }

  Object.assign(NS.ghosts, {
    update, idle, frighten, reverseAll, sendHome, collide, eat, target, speedOf, aiOf
  });
})();
