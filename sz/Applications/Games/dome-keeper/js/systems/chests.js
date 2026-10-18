;(function() {
  'use strict';

  // Secret chests: placement, reveal and the lock, circuit and rune minigames.
  // Owns: NS.chests and these state fields:
  //   G.chests, G.minigame
  // Reads: constants, util, dom, panels, persistence, time, mining, artifacts, update, bombArt, tooltip
  // Reads state of: gameState, relocation, bombs, biomes

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, TWO_PI, VIEW_UNDERGROUND, STATE_PLAYING, STATE_MINIGAME, STRATUM_ROWS,
    GRID_COLS, GRID_ROWS, TILE_SIZE, TILE_EMPTY, TILE_DIRT, TILE_CHEST } = NS.constants;
  const { makeRng } = NS.util;
  const { particles, screenShake, floatingText } = NS.dom;
  const { UI } = NS.panels;
  const { saveRun } = NS.persistence;
  const { announce } = NS.time;
  const { cancelMining } = NS.mining;

  /* ======================================================================
     SECRET CHESTS -- three per site, opened by beating a short minigame
     ====================================================================== */

  const CHEST_BANDS = [[2, 4], [6, 8], [10, 13]];   // strata: shallow-mid, mid, deep
  const CHEST_RETRY = 20;                            // seconds a failed lock stays jammed
  const MINIGAME_KINDS = ['lock', 'circuit', 'runes'];
  const MINIGAME_NAMES = { lock: 'Lock Picking', circuit: 'Power Circuit', runes: 'Rune Memory' };
  G.chests = [];                   // { r, c, band, kind, revealed, opened, cooldown }
  G.minigame = null;               // the chest being opened (see startMinigame)

  // Hide three chests in plain rock, one per depth band, far apart
  function placeSecretChests(rand) {
    G.chests = [];
    const kinds = MINIGAME_KINDS.map((k, i) => MINIGAME_KINDS[(i + G.site.index) % MINIGAME_KINDS.length]);
    CHEST_BANDS.forEach(([s0, s1], band) => {
      for (let attempt = 0; attempt < 400; ++attempt) {
        const r = Math.min(GRID_ROWS - 2, s0 * STRATUM_ROWS + Math.floor(rand() * (s1 - s0 + 1) * STRATUM_ROWS));
        const c = 6 + Math.floor(rand() * (GRID_COLS - 12));
        if (G.undergroundGrid[r][c] !== TILE_DIRT) continue;
        if (Math.abs(r - G.relocationCore.r) + Math.abs(c - G.relocationCore.c) < 6) continue;
        if (G.chests.some(ch => Math.abs(ch.c - c) < 24 && Math.abs(ch.r - r) < 12)) continue;
        G.undergroundGrid[r][c] = TILE_CHEST;
        G.chests.push({ r, c, band, kind: kinds[band], revealed: false, opened: false, cooldown: 0 });
        break;
      }
    });
  }

  function chestSeed() {
    return G.site.seed ^ 0x0c4e57;
  }

  function chestAt(r, c) {
    return G.chests.find(ch => ch.r === r && ch.c === c && !ch.opened);
  }

  function chestsOpened() {
    return G.chests.filter(ch => ch.opened).length;
  }

  function revealChest(ch, announceIt) {
    if (ch.revealed || ch.opened) return;
    ch.revealed = true;
    if (announceIt && G.currentView === VIEW_UNDERGROUND) {
      const tx = ch.c * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, ty = ch.r * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
      floatingText.add(tx, ty - 40, 'Secret chest!', { color: '#e0b0ff', font: 'bold 24px sans-serif' });
      particles.sparkle(tx, ty, 16, { color: '#ffd8ff', speed: 2 });
      SZ.GameAudio.play('coin', { pitch: 0.8 });
    }
  }

  // Reveal chests within a tile distance of (r, c)
  function revealChestsNear(r, c, dist, announceIt) {
    for (const ch of G.chests)
      if (!ch.revealed && !ch.opened && Math.abs(ch.r - r) + Math.abs(ch.c - c) <= dist)
        revealChest(ch, announceIt);
  }

  // Difficulty 0..1 grows with the depth band and the site
  function chestDifficulty(ch) {
    return Math.max(0, Math.min(1, 0.15 + ch.band * 0.3 + G.site.index * 0.08));
  }

  function tryOpenChest(ch) {
    if (!ch || ch.opened) return;
    revealChest(ch, false);
    if (ch.cooldown > 0) {
      SZ.GameAudio.play('error');
      floatingText.add(ch.c * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, ch.r * TILE_SIZE - 10 - G.cameraY, `The lock is jammed: ${Math.ceil(ch.cooldown)} s`, { color: '#ffb0a8', font: 'bold 20px sans-serif' });
      return;
    }
    cancelMining();
    NS.update.clearMoveTarget();
    startMinigame(ch);
  }

  function updateChests(dt) {
    for (const ch of G.chests)
      if (ch.cooldown > 0) ch.cooldown = Math.max(0, ch.cooldown - dt);
  }

  // What a chest holds: rare ore of its depth plus points
  function grantChestTreasure(ch) {
    const pools = [['silver', 'gold', 'quartz', 'cobalt'], ['redstone', 'emerald', 'diamond', 'ruby'], ['titanium', 'sapphire', 'uranium', 'amethyst', 'opal']];
    const pool = pools[ch.band];
    const rng = makeRng(chestSeed() ^ (ch.r * 977 + ch.c));
    const got = [];
    for (let i = 0; i < 3; ++i) {
      const key = pool[Math.floor(rng() * pool.length)];
      const n = Math.round((14 + rng() * 14) * (1 + ch.band * 0.4));
      G.resources[key] = (G.resources[key] || 0) + n;
      got.push(`${n} [[${key}]]`);
    }
    const pts = 250 * (ch.band + 1) * (G.site.index + 1);
    G.score += pts;
    return { icon: 'chest', title: 'Treasure!', text: `${got.join('  ')}  and ${pts} points`, color: UI.gold };
  }

  /* -- Minigames: lock picking, power circuit, rune memory -- */
  function startMinigame(ch) {
    const diff = chestDifficulty(ch);
    const m = { kind: ch.kind, chest: ch, diff, t: 0, limit: 40, phase: 'play', endT: 0, shake: 0, flash: 0, flashOk: true, reward: null, hover: null };
    if (m.kind === 'lock') {
      m.total = 3 + Math.round(diff * 3);
      m.set = 0;
      m.lives = 3;
      m.angle = -Math.PI / 2;
      m.dir = 1;
      m.speed = 2.0 + diff * 1.6;
      m.hw = 0.42 - diff * 0.18;
      m.target = Math.PI * (0.25 + Math.random() * 0.5);
      m.limit = 40;
    } else if (m.kind === 'circuit') {
      buildCircuit(m, 4 + Math.round(diff * 2));
      m.limit = 35 + 4 * m.n;
    } else {
      m.len = 4 + Math.round(diff * 3);
      m.seq = [];
      for (let i = 0; i < m.len; ++i) m.seq.push(Math.floor(Math.random() * 6));
      m.round = 3;
      m.lives = 3;
      m.limit = Math.min(60, 42 + m.len * 2.5);   // the clock stops while the runes play
      m.lit = -1;
      m.litT = 0;
      startRuneShow(m, 0.8);
    }
    G.minigame = m;
    G.state = STATE_MINIGAME;
    G.bombThrowMode = false;
    NS.tooltip.clearTooltip();
    SZ.GameAudio.play('powerup', { pitch: 0.7, volume: 0.6 });
  }

  function finishMinigame(win, why) {
    const m = G.minigame;
    if (!m || m.phase !== 'play') return;
    m.phase = win ? 'won' : 'lost';
    m.endT = 0;
    if (win) {
      const ch = m.chest;
      ch.opened = true;
      G.undergroundGrid[ch.r][ch.c] = TILE_EMPTY;
      G.tileHP[ch.r][ch.c] = G.tileMaxHP[ch.r][ch.c] = 0;
      m.reward = NS.artifacts.grantChestReward(ch);
      SZ.GameAudio.play('win', { volume: 0.8 });
      screenShake.trigger(6, 250);
    } else {
      m.chest.cooldown = CHEST_RETRY;
      m.why = why || 'The chest stays locked';
      SZ.GameAudio.play('lose', { volume: 0.7 });
    }
  }

  function closeMinigame() {
    const m = G.minigame;
    G.minigame = null;
    G.state = STATE_PLAYING;
    if (m && m.phase === 'won') {
      const tx = m.chest.c * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, ty = m.chest.r * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
      particles.burst(tx, ty, 40, { color: '#ffd870', speed: 4, life: 0.8 });
      particles.sparkle(tx, ty, 24, { color: '#ffe8ff', speed: 3 });
      announce(m.reward.title, m.reward.text, m.reward.color, m.reward.icon);
    }
    saveRun();
  }

  function giveUpMinigame() {
    if (G.minigame && G.minigame.phase === 'play')
      finishMinigame(false, 'You stepped away from the chest');
  }

  function updateMinigame(dt) {
    const m = G.minigame;
    if (!m) return;
    m.shake = Math.max(0, m.shake - dt * 3);
    m.flash = Math.max(0, m.flash - dt * 2.5);
    if (m.msg && (m.msg.t -= dt) <= 0) m.msg = null;
    if (m.phase !== 'play') {
      m.endT += dt;
      return;
    }
    const showing = m.kind === 'runes' && m.show;
    if (!showing) m.t += dt;
    if (m.t >= m.limit) {
      finishMinigame(false, 'Time ran out');
      return;
    }
    if (m.kind === 'lock')
      m.angle += m.dir * m.speed * dt;
    else if (m.kind === 'runes')
      updateRunes(m, dt);
  }

  function minigameMessage(m, text, color) {
    m.msg = { text, color, t: 1.2 };
  }

  function angleGap(a, b) {
    let d = (a - b) % TWO_PI;
    if (d > Math.PI) d -= TWO_PI;
    if (d < -Math.PI) d += TWO_PI;
    return Math.abs(d);
  }

  function lockPress(m) {
    const gap = angleGap(m.angle, m.target);
    if (gap <= m.hw) {
      ++m.set;
      m.flash = 1;
      m.flashOk = true;
      SZ.GameAudio.play('select', { pitch: 1 + m.set * 0.12 });
      SZ.GameAudio.play('click', { pitch: 0.7 });
      minigameMessage(m, gap <= m.hw * 0.35 ? 'PERFECT!' : 'Pin set!', gap <= m.hw * 0.35 ? UI.gold : UI.good);
      if (m.set >= m.total) {
        finishMinigame(true);
        return;
      }
      m.dir = -m.dir;
      m.speed *= 1.12;
      m.hw = Math.max(0.13, m.hw * 0.9);
      m.target = m.angle + m.dir * (Math.PI * 0.55 + Math.random() * Math.PI * 0.9);
    } else {
      --m.lives;
      m.flash = 1;
      m.flashOk = false;
      m.shake = 1;
      SZ.GameAudio.play('error');
      minigameMessage(m, 'The pick slipped!', UI.bad);
      if (m.lives <= 0)
        finishMinigame(false, 'Your last lock pick snapped');
    }
  }

  /* Power circuit: rotate the tiles until power flows from the battery to the lock.
     Connections are bits N=1, E=2, S=4, W=8 */
  function rotMask(mask, k) {
    for (let i = 0; i < ((k % 4) + 4) % 4; ++i)
      mask = ((mask << 1) | (mask >> 3)) & 15;
    return mask;
  }

  function buildCircuit(m, n) {
    m.n = n;
    const base = [];
    for (let r = 0; r < n; ++r) base.push(new Array(n).fill(0));
    // Random spanning tree (depth-first maze)
    const seen = new Set([0]);
    const stack = [[0, 0]];
    const dirs = [[-1, 0, 1, 4], [0, 1, 2, 8], [1, 0, 4, 1], [0, -1, 8, 2]];
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const opts = dirs.filter(([dr, dc]) => r + dr >= 0 && r + dr < n && c + dc >= 0 && c + dc < n && !seen.has((r + dr) * n + c + dc));
      if (!opts.length) {
        stack.pop();
        continue;
      }
      const [dr, dc, bit, back] = opts[Math.floor(Math.random() * opts.length)];
      base[r][c] |= bit;
      base[r + dr][c + dc] |= back;
      seen.add((r + dr) * n + c + dc);
      stack.push([r + dr, c + dc]);
    }
    m.src = Math.floor(Math.random() * n);
    m.snk = Math.floor(Math.random() * n);
    base[m.src][0] |= 8;
    base[m.snk][n - 1] |= 2;
    m.base = base;
    m.cur = { r: m.src, c: 0 };
    for (let tries = 0; tries < 20; ++tries) {
      m.rot = base.map(row => row.map(() => Math.floor(Math.random() * 4)));
      if (!circuitPowered(m).done) break;
    }
    m.spin = base.map(row => row.map(() => 0));
  }

  function circuitMask(m, r, c) {
    return rotMask(m.base[r][c], m.rot[r][c]);
  }

  // Tiles reached by power from the battery; done when the lock tile is live
  function circuitPowered(m) {
    const n = m.n, on = new Set();
    if (circuitMask(m, m.src, 0) & 8) {
      const q = [[m.src, 0]];
      on.add(m.src * n);
      while (q.length) {
        const [r, c] = q.shift();
        const mk = circuitMask(m, r, c);
        for (const [dr, dc, bit, back] of [[-1, 0, 1, 4], [0, 1, 2, 8], [1, 0, 4, 1], [0, -1, 8, 2]]) {
          const rr = r + dr, cc = c + dc;
          if (!(mk & bit) || rr < 0 || rr >= n || cc < 0 || cc >= n || on.has(rr * n + cc)) continue;
          if (circuitMask(m, rr, cc) & back) {
            on.add(rr * n + cc);
            q.push([rr, cc]);
          }
        }
      }
    }
    return { on, done: on.has(m.snk * n + n - 1) && !!(circuitMask(m, m.snk, n - 1) & 2) };
  }

  function rotateCircuitTile(m, r, c, dir) {
    m.rot[r][c] = (m.rot[r][c] + dir + 4) % 4;
    m.spin[r][c] = dir;
    m.cur = { r, c };
    SZ.GameAudio.play('click', { pitch: 1.2 + Math.random() * 0.2, volume: 0.7 });
    if (circuitPowered(m).done) {
      SZ.GameAudio.play('zap', { pitch: 1.4 });
      finishMinigame(true);
    }
  }

  /* Rune memory: watch the runes light up, then repeat the sequence */
  const RUNE_COLORS = ['#ff6a6a', '#ffb648', '#ffe66a', '#6fe08a', '#5ab8ff', '#c890ff'];
  const RUNE_TONES = [262, 330, 392, 440, 523, 659];

  function startRuneShow(m, delay) {
    m.show = true;
    m.showI = -1;
    m.showT = -(delay || 0.6);
    m.input = 0;
    m.lit = -1;
  }

  function runeStep(m) {
    return Math.max(0.32, 0.6 - m.diff * 0.22);
  }

  function updateRunes(m, dt) {
    if (m.litT > 0) {
      m.litT -= dt;
      if (m.litT <= 0) m.lit = -1;
    }
    if (!m.show) return;
    m.showT += dt;
    const step = runeStep(m);
    const i = Math.floor(m.showT / (step + 0.16));
    if (m.showT < 0) return;
    if (i >= m.round) {
      m.show = false;
      m.lit = -1;
      return;
    }
    if (i !== m.showI) {
      m.showI = i;
      lightRune(m, m.seq[i], step);
    }
  }

  function lightRune(m, k, dur) {
    m.lit = k;
    m.litT = dur;
    SZ.GameAudio.tone(RUNE_TONES[k], dur * 0.9, 'triangle', 0.12);
  }

  function runePress(m, k) {
    if (m.show || m.phase !== 'play') return;
    lightRune(m, k, 0.25);
    if (k === m.seq[m.input]) {
      ++m.input;
      if (m.input >= m.round) {
        if (m.round >= m.len) {
          finishMinigame(true);
          return;
        }
        ++m.round;
        m.flash = 1;
        m.flashOk = true;
        minigameMessage(m, 'Correct!', UI.good);
        startRuneShow(m, 0.9);
      }
    } else {
      --m.lives;
      m.flash = 1;
      m.flashOk = false;
      m.shake = 1;
      SZ.GameAudio.play('error');
      minigameMessage(m, 'Wrong rune - watch again', UI.bad);
      if (m.lives <= 0)
        finishMinigame(false, 'The runes went dark');
      else
        startRuneShow(m, 1.0);
    }
  }

  /* -- Minigame layout, input and drawing -- */
  function minigameLayout() {
    const w = 900, h = 680, x = (CANVAS_W - w) / 2, y = (CANVAS_H - h) / 2;
    return { x, y, w, h, cx: x + w / 2, bodyY: y + 112, bodyH: h - 112 - 64 };
  }

  function runeSpots() {
    const L = minigameLayout();
    const cx = L.cx, cy = L.bodyY + L.bodyH / 2 + 6;
    return RUNE_COLORS.map((col, i) => {
      const a = -Math.PI / 2 + i * TWO_PI / 6;
      return { x: cx + Math.cos(a) * 170, y: cy + Math.sin(a) * 170, r: 52, i };
    });
  }

  function circuitGeom(m) {
    const L = minigameLayout();
    const cell = Math.min(86, Math.floor(430 / m.n));
    const gw = cell * m.n;
    return { cell, gx: L.cx - gw / 2, gy: L.bodyY + (L.bodyH - gw) / 2 + 8 };
  }

  function minigameKey(e) {
    const m = G.minigame;
    if (!m) return false;
    if (m.phase !== 'play') {
      if (m.endT > 0.35 && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape' || e.code === 'NumpadEnter'))
        closeMinigame();
      return true;
    }
    if (e.code === 'Escape') {
      giveUpMinigame();
      return true;
    }
    if (m.kind === 'lock') {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyE') {
        if (!e.repeat) lockPress(m);
        return true;
      }
    } else if (m.kind === 'circuit') {
      const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], KeyW: [-1, 0], KeyS: [1, 0], KeyA: [0, -1], KeyD: [0, 1] }[e.code];
      if (mv) {
        m.cur = { r: Math.max(0, Math.min(m.n - 1, m.cur.r + mv[0])), c: Math.max(0, Math.min(m.n - 1, m.cur.c + mv[1])) };
        return true;
      }
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        rotateCircuitTile(m, m.cur.r, m.cur.c, e.shiftKey ? -1 : 1);
        return true;
      }
    } else if (/^(Digit|Numpad)[1-6]$/.test(e.code)) {
      runePress(m, parseInt(e.code.slice(-1), 10) - 1);
      return true;
    }
    return true;
  }

  function minigameClick(mx, my, button) {
    const m = G.minigame;
    if (!m) return;
    if (m.phase !== 'play') {
      if (m.endT > 0.35) closeMinigame();
      return;
    }
    const L = minigameLayout();
    if (NS.bombArt.inRect(mx, my, { x: L.x + L.w - 54, y: L.y + 12, w: 40, h: 40 })) {
      giveUpMinigame();
      return;
    }
    if (m.kind === 'lock')
      lockPress(m);
    else if (m.kind === 'circuit') {
      const g = circuitGeom(m);
      const c = Math.floor((mx - g.gx) / g.cell), r = Math.floor((my - g.gy) / g.cell);
      if (r >= 0 && r < m.n && c >= 0 && c < m.n)
        rotateCircuitTile(m, r, c, button === 2 ? -1 : 1);
    } else {
      for (const sp of runeSpots())
        if (Math.hypot(mx - sp.x, my - sp.y) <= sp.r + 6) {
          runePress(m, sp.i);
          break;
        }
    }
  }

  function minigameHover(mx, my) {
    const m = G.minigame;
    if (!m) return;
    m.hover = null;
    if (m.kind === 'circuit' && m.phase === 'play') {
      const g = circuitGeom(m);
      const c = Math.floor((mx - g.gx) / g.cell), r = Math.floor((my - g.gy) / g.cell);
      if (r >= 0 && r < m.n && c >= 0 && c < m.n) m.hover = { r, c };
    } else if (m.kind === 'runes') {
      for (const sp of runeSpots())
        if (Math.hypot(mx - sp.x, my - sp.y) <= sp.r + 6) m.hover = sp.i;
    }
  }

  NS.chests = { CHEST_BANDS, CHEST_RETRY, MINIGAME_KINDS, MINIGAME_NAMES, placeSecretChests, chestSeed,
    chestAt, chestsOpened, revealChest, revealChestsNear, chestDifficulty, tryOpenChest, updateChests,
    grantChestTreasure, updateMinigame, circuitMask, circuitPowered, RUNE_COLORS, minigameLayout, runeSpots,
    circuitGeom, minigameKey, minigameClick, minigameHover };
})();
