/* Pac-Man in play: speed from the maze, tech tree, power-ups and tile twists, buffered turns
   (early cornering with Slick Turns), reversing, arrow pads, ice, taffy, portals, eating dots
   and power pellets with the dot chain, the Dot Magnet, the Pellet Blaster, the trail and the
   chomp animation. Reads the wanted direction from pac.want. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const C = NS.constants;
  const { COLS, DX, DY, D_DOT, D_POWER, F_PAD_L, F_PAD_D, F_TAFFY, F_PORTAL, F_ICE } = C;
  const grid = NS.grid;
  const FX = NS.fx;
  const R = NS.rules;
  const { sfx, chomp } = NS.audio;
  const rnd = NS.rng.fx;

  function featAt(m, x, y) {
    if (x < 0 || x >= COLS) return 0;
    return m.feat[Math.floor(y) * COLS + Math.floor(x)];
  }

  function onPuddle(lvl, x, y) {
    for (let i = 0; i < lvl.puddles.length; ++i) {
      const p = lvl.puddles[i];
      if (Math.abs(p.x - x) < 0.9 && Math.abs(p.y - y) < 0.9) return true;
    }
    return false;
  }

  function speedOf(run, pac) {
    const lvl = run.lvl, st = G.stats, m = lvl.maze;
    let s = lvl.cfg.pacSpeed * st.speed;
    if (lvl.effects.speed > 0) s *= 1.45;
    if (lvl.effects.mega > 0) s *= 1.15;
    if (pac.padT > 0) s *= 1.9;
    if (pac.burstT > 0) s *= 1 + st.burst;
    const f = featAt(m, pac.x, pac.y);
    if (f === F_TAFFY || onPuddle(lvl, pac.x, pac.y)) s *= Math.min(1, 0.55 + st.tunnelEase * 0.45);
    if (f === F_ICE) s *= 1.25;
    return s;
  }

  function kindOf(lvl) {
    return lvl.effects.phase > 0 ? 'phase' : 'pac';
  }

  function onIce(lvl, pac) {
    return featAt(lvl.maze, pac.x, pac.y) === F_ICE && !G.stats.grip;
  }

  function update(run, dt) {
    const lvl = run.lvl;
    const pac = lvl.pac;
    const m = lvl.maze;
    if (pac.grace > 0) pac.grace -= dt;
    if (pac.padT > 0) pac.padT -= dt;
    if (pac.burstT > 0) pac.burstT -= dt;
    if (pac.squash > 0) pac.squash = Math.max(0, pac.squash - dt * 5);
    if (pac.bump > 0) {
      pac.bump -= dt;
      return;
    }
    const kind = kindOf(lvl);
    /* still inside a wall after Ghost Walk ran out: keep walking until free */
    const inWall = grid.wallAt(m, Math.floor(pac.x), Math.floor(pac.y)) !== C.W_OPEN;
    const walk = inWall ? 'phase' : kind;
    const want = pac.want;
    if (want >= 0 && want === grid.opposite(pac.dir) && !onIce(lvl, pac) && pac.padT <= 0.45) {
      pac.dir = want;
      pac.squash = 0.6;
    }
    if (G.stats.corner && want >= 0 && pac.dir >= 0 && want !== pac.dir && want !== grid.opposite(pac.dir)) cornerEarly(pac, m, walk);
    const before = pac.dir;
    const moved = grid.travel(pac, speedOf(run, pac) * dt, (e, tx, ty) => decide(run, e, tx, ty, walk));
    pac.moving = moved > 0;
    if (pac.dir >= 0) pac.face = pac.dir;
    if (pac.dir !== before && pac.dir >= 0 && before >= 0) pac.squash = 0.5;
    if (pac.moving) pac.mouth += dt * 11;
    const tile = grid.tileIndex(pac.x, pac.y);
    if (tile !== pac.lastTile) {
      pac.lastTile = tile;
      if (pac.portalLock >= 0 && tile !== pac.portalLock) pac.portalLock = -1;
      eatAt(run, tile);
    }
    if (lvl.effects.magnet > 0) magnet(run, pac, m);
    if (lvl.effects.blaster > 0) blaster(run, pac, dt);
    trail(run, pac, dt);
  }

  /* Slick Turns: take a turn up to a third of a tile before the centre */
  function cornerEarly(pac, m, kind) {
    const tx = Math.floor(pac.x), ty = Math.floor(pac.y);
    const d = (tx + 0.5 - pac.x) * DX[pac.dir] + (ty + 0.5 - pac.y) * DY[pac.dir];
    if (d < -0.12 || d > 0.34) return;
    if (!grid.canEnter(m, tx + DX[pac.want], ty + DY[pac.want], kind)) return;
    pac.x = tx + 0.5;
    pac.y = ty + 0.5;
    pac.dir = pac.want;
    pac.squash = 0.5;
  }

  function decide(run, e, tx, ty, kind) {
    const lvl = run.lvl, m = lvl.maze;
    const f = tx >= 0 && tx < COLS ? m.feat[ty * COLS + tx] : 0;
    const tile = ty * COLS + tx;
    if (f === F_PORTAL && e.portalLock !== tile) {
      teleport(run, e, tx, ty);
      return;
    }
    if (f >= F_PAD_L && f <= F_PAD_D) {
      const pd = f - F_PAD_L;
      if (grid.canEnter(m, tx + DX[pd], ty + DY[pd], kind)) {
        if (e.padT <= 0.4) {
          FX.sparks(grid.px(e.x), grid.py(e.y), 10, '#ffffff', 220);
          sfx('whoosh', { pitch: 1.4, volume: 0.5 });
        }
        e.dir = pd;
        e.padT = 0.7;
        return;
      }
    }
    const want = e.want;
    if (want >= 0 && grid.canEnter(m, tx + DX[want], ty + DY[want], kind)) {
      e.dir = want;
      return;
    }
    if (e.dir >= 0 && !grid.canEnter(m, tx + DX[e.dir], ty + DY[e.dir], kind)) e.dir = -1;
    if (e.dir < 0 && want >= 0 && grid.canEnter(m, tx + DX[want], ty + DY[want], kind)) e.dir = want;
  }

  function teleport(run, e, tx, ty) {
    const m = run.lvl.maze;
    for (let i = 0; i < m.portals.length; ++i) {
      const p = m.portals[i];
      let to = null;
      if (p[0] === tx && p[1] === ty) to = [p[2], p[3]];
      else if (p[2] === tx && p[3] === ty) to = [p[0], p[1]];
      if (!to) continue;
      const ox = grid.px(e.x), oy = grid.py(e.y);
      e.x = to[0] + 0.5;
      e.y = to[1] + 0.5;
      e.portalLock = to[1] * COLS + to[0];
      e.lastTile = e.portalLock;
      FX.ring(ox, oy, 4, 40, 0.4, '#b98cff', 4);
      FX.ring(grid.px(e.x), grid.py(e.y), 40, 4, 0.4, '#7af0ff', 4);
      FX.burst(grid.px(e.x), grid.py(e.y), 14, '#b98cff', 160, 0.5, 5, 0);
      sfx('zap', { pitch: 0.8, volume: 0.5 });
      /* keep going if the way on is open, otherwise wait for input */
      if (e.dir >= 0 && !grid.canEnter(m, to[0] + DX[e.dir], to[1] + DY[e.dir], 'pac')) e.dir = -1;
      return;
    }
  }

  /* eats whatever lies on the tile */
  function eatAt(run, tile) {
    const lvl = run.lvl, m = lvl.maze;
    const d = m.dots[tile];
    if (!d) return false;
    m.dots[tile] = 0;
    --lvl.dotsLeft;
    ++lvl.dotsEaten;
    const x = tile % COLS, y = (tile - x) / COLS;
    const px = grid.px(x + 0.5), py = grid.py(y + 0.5);
    const theme = NS.world.theme ? NS.world.theme() : null;
    if (d === D_POWER) {
      NS.level.addScore(run, C.POWER_POINTS, px, py, '#ffffff', 16);
      NS.ghosts.frighten(run);
      FX.ring(px, py, 6, 150, 0.6, theme ? theme.rim : '#4a8cff', 6);
      FX.burst(px, py, 30, '#ffffff', 300, 0.7, 6, 0);
      FX.flash(theme ? theme.glow : '#4a8cff', 0.25);
      FX.addShake(4);
      sfx('powerup', { pitch: 0.7 });
      NS.level.addMult(run, 4);
    } else {
      NS.level.addScore(run, C.DOT_POINTS);
      chomp(run.mode === 'zen');
      if (rnd() < 0.5) FX.particle(px, py, (rnd() - 0.5) * 90, (rnd() - 0.5) * 90, 0.3, 3, theme ? theme.dot : '#ffd8b0', 0, 0, 3);
      run.chain = run.chainT > 0 ? run.chain + 1 : 1;
      run.chainT = G.stats.chainWindow;
      if (run.chain > run.bestChain) run.bestChain = run.chain;
      if (run.chain % 25 === 0) {
        FX.floater(px, py - 18, run.chain + ' CHAIN', '#7af0ff', 16, 1);
        FX.ring(px, py, 6, 60, 0.4, '#7af0ff', 3);
      }
      NS.level.addMult(run, 1);
    }
    if (!run.demo) {
      ++run.tally.dots;
      R.bump(G.profile, 'dots', 1);
    }
    return true;
  }

  /* pulls dots within three tiles (a few per step, so they stream in) */
  function magnet(run, pac, m) {
    const cx = Math.floor(pac.x), cy = Math.floor(pac.y);
    let n = 0;
    for (let dy = -3; dy <= 3 && n < 2; ++dy)
      for (let dx = -3; dx <= 3 && n < 2; ++dx) {
        if (Math.abs(dx) + Math.abs(dy) > 3 || (!dx && !dy)) continue;
        const y = cy + dy;
        if (y < 0 || y >= C.ROWS) continue;
        const x = grid.wrapX(cx + dx);
        const t = y * COLS + x;
        if (m.dots[t] !== D_DOT) continue;
        const sx = grid.px(x + 0.5), sy = grid.py(y + 0.5);
        const tx = grid.px(pac.x), ty = grid.py(pac.y);
        FX.particle(sx, sy, (tx - sx) * 5, (ty - sy) * 5, 0.2, 4, '#ff5ad8', 0, 0, 0);
        eatAt(run, t);
        ++n;
      }
  }

  function blaster(run, pac, dt) {
    pac.shotT -= dt;
    if (pac.shotT > 0 || pac.face < 0) return;
    pac.shotT = 0.32;
    NS.hazards.shoot(run, pac.x, pac.y, pac.face);
    sfx('shoot', { pitch: 1.3, volume: 0.35 });
  }

  const TRAIL_SHAPES = { snow: 'flake', petals: 'petal', leaves: 'leaf', hearts: 'heart', bats: 'bat', confetti: 'confetti', bubbles: 'bubble', bubblegum: 'sun' };

  function trail(run, pac, dt) {
    if (!pac.moving) return;
    const id = run.demo ? 'sparkle' : G.profile.trail;
    if (id === 'none') return;
    pac.trailT -= dt;
    if (pac.trailT > 0) return;
    pac.trailT = 0.045;
    const x = grid.px(pac.x) - DX[pac.face] * 8 + (rnd() - 0.5) * 8, y = grid.py(pac.y) - DY[pac.face] * 8 + (rnd() - 0.5) * 8;
    switch (id) {
      case 'sparkle':
        FX.particle(x, y, (rnd() - 0.5) * 30, (rnd() - 0.5) * 30, 0.4, 3 + rnd() * 2, '#fff6a0', 0, 0, 2);
        break;
      case 'rainbow':
        FX.particle(x, y, 0, 0, 0.5, 6, 'hsl(' + ((G.time * 300) % 360 | 0) + ',100%,60%)', 2, 0, 0);
        break;
      case 'fire':
        FX.particle(x, y, (rnd() - 0.5) * 40, -40 - rnd() * 40, 0.45, 5 + rnd() * 3, rnd() < 0.5 ? '#ff7a2a' : '#ffd23a', 0, -60, 1);
        break;
      default:
        FX.shape(x, y, (rnd() - 0.5) * 30, (rnd() - 0.5) * 30 + 10, 0.8, 7, TRAIL_SHAPES[id] || 'flake', '#fff', 20);
    }
  }

  Object.assign(NS.pac, {
    update, speedOf, eatAt, featAt, onPuddle
  });
})();
