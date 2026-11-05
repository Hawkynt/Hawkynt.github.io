;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The bird against the course objects: gate collision and pass scoring (score, arcade
     points and multiplier, perfect combo, fever, Combo Keeper, near miss, Zen chimes),
     coins with the magnet and the streak, power-up bubbles, seasonal tokens and the moving
     hazards (stepped by SZ.FlappyHazards). Writes the score, coin, combo and power fields of
     G and the per-object flags in G.course. */

  const {
    CANVAS_W, BIRD_X, COIN_RADIUS, GROUND_Y, GATE_W, CAP_EXTRA_W, CAP_H, LEVELUP_INTERVAL, ARCADE, STATE_PLAYING
  } = NS.C;
  const { ui, particles, floatingText, sfx } = NS.services;
  const G = NS.state;
  const Rules = NS.rules;
  const Run = NS.run;
  const Fx = NS.fx;
  const Nav = NS.nav;
  const Goals = NS.goals;
  const Powers = NS.powers;
  const H = SZ.FlappyHazards;

  // a pentatonic scale for the Zen chimes, as pitch factors
  const ZEN_SCALE = [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25, 2.5];

  function addPoints(n, x, y) {
    if (G.mode !== 'arcade')
      return;
    const pts = Math.round(n * G.mult * (G.feverT > 0 ? 2 : 1));
    G.points += pts;
    if (x !== undefined)
      floatingText.add(x, y, '+' + pts, { color: '#ffffff', decay: 0.035 });
  }

  function payCoins(value) {
    G.coinCarry += value;
    const whole = Math.floor(G.coinCarry);
    G.coinCarry -= whole;
    G.coinsRun += whole;
    return whole;
  }

  function updateGates() {
    const birdR = Rules.birdRadius();
    for (const gate of G.course.gates) {
      const sx = gate.x - G.dist;
      if (sx <= -GATE_W - 20 || sx >= CANVAS_W + 20)
        continue;
      if (gate.smashed) {
        if (!gate.passed && sx + GATE_W < BIRD_X - birdR)
          passGate(gate, sx, SZ.FlappyCourse.gateShape(gate, G.worldT), birdR);
        continue;
      }
      const shape = SZ.FlappyCourse.gateShape(gate, G.worldT);
      const topBottom = shape.y - shape.gap / 2;
      const botTop = shape.y + shape.gap / 2;

      // Remember the hit counter and the narrowest clearance while inside the gate
      if (gate.hitsAtEntry === undefined && sx < BIRD_X + CAP_EXTRA_W + birdR)
        gate.hitsAtEntry = G.hitsTaken;
      if (sx - 8 < BIRD_X && BIRD_X < sx + GATE_W + 8) {
        const clearance = Math.min(G.bird.y - birdR - topBottom, botTop - (G.bird.y + birdR));
        gate.minClear = Math.min(gate.minClear ?? Infinity, clearance);
      }

      const hit =
        Rules.circleRect(BIRD_X, G.bird.y, birdR, sx, 0, GATE_W, topBottom) ||
        Rules.circleRect(BIRD_X, G.bird.y, birdR, sx, botTop, GATE_W, GROUND_Y - botTop) ||
        Rules.circleRect(BIRD_X, G.bird.y, birdR, sx - CAP_EXTRA_W, topBottom - CAP_H, GATE_W + CAP_EXTRA_W * 2, CAP_H) ||
        Rules.circleRect(BIRD_X, G.bird.y, birdR, sx - CAP_EXTRA_W, botTop, GATE_W + CAP_EXTRA_W * 2, CAP_H);
      if (hit && G.power.rush <= 0 && G.power.ghost <= 0 && G.invuln <= 0 && !Powers.trySmash(gate, sx))
        Run.takeHit('pipe');
      if (G.state !== STATE_PLAYING)
        break;

      if (!gate.passed && sx + GATE_W < BIRD_X - birdR)
        passGate(gate, sx, shape, birdR);
    }
  }

  function passGate(gate, sx, shape, birdR) {
    gate.passed = true;
    ++G.score;
    Goals.bump('gates', 1);
    G.scorePopTimer = 0.2;
    const topBottom = shape.y - shape.gap / 2;
    const botTop = shape.y + shape.gap / 2;
    const clean = G.hitsTaken === gate.hitsAtEntry;

    if (G.mode === 'zen') {
      // every pipe rings the next note of a slow pentatonic tune
      if (clean)
        ++G.flow;
      const note = ZEN_SCALE[(G.zenNote++ * 3) % ZEN_SCALE.length];
      sfx('blip', { pitch: note * 0.5, volume: 0.18 });
      if (G.flow > 0 && G.flow % 10 === 0) {
        sfx('levelup', { volume: 0.2, pitch: 0.75 });
        floatingText.add(BIRD_X, G.bird.y - 50, 'FLOW ' + G.flow, { color: '#bff4ff', font: 'bold 24px sans-serif' });
      }
      particles.sparkle(sx + GATE_W, topBottom, 4, { color: '#bff4ff' });
      particles.sparkle(sx + GATE_W, botTop, 4, { color: '#bff4ff' });
    } else {
      if (G.score % LEVELUP_INTERVAL === 0)
        sfx('levelup');
      else
        sfx('blip', { pitch: 0.9, volume: 0.32 });
      particles.sparkle(sx + GATE_W, topBottom, 6, { color: '#ffd700' });
      particles.sparkle(sx + GATE_W, botTop, 6, { color: '#ffd700' });
      if (G.mode !== 'arcade')
        floatingText.add(BIRD_X, G.bird.y - 20, '+1', { color: '#fff', decay: 0.03 });
    }

    // Arcade: clean pipes in a row raise the multiplier
    if (G.mode === 'arcade') {
      if (clean) {
        ++G.multClean;
        if (G.multClean % ARCADE.multEvery === 0 && G.mult < ARCADE.multMax) {
          ++G.mult;
          floatingText.add(CANVAS_W / 2, 210, 'x' + G.mult, { color: '#ffd84a', font: 'bold 48px sans-serif' });
          sfx('powerup', { pitch: 1 + G.mult * 0.08, volume: 0.5 });
        }
      }
      addPoints(ARCADE.gate, BIRD_X + 30, G.bird.y - 24);
    }

    // Perfect pass — dead centre of the gap keeps the combo alive
    const offset = Math.abs(G.bird.y - shape.y) / (shape.gap / 2);
    if (offset <= Rules.perfectBand()) {
      ++G.combo;
      ++G.perfects;
      Goals.bump('perfects', 1);
      Goals.best('comboMax', G.combo);
      G.bestCombo = Math.max(G.bestCombo, G.combo);
      addPoints(ARCADE.perfect);
      Powers.feedFever(Rules.feverGain());
      floatingText.add(BIRD_X, G.bird.y - 48, G.combo >= 2 ? 'PERFECT! x' + G.combo : 'PERFECT!', { color: '#7affd8', font: 'bold 24px sans-serif' });
      sfx('blip', { pitch: 1 + Math.min(G.combo, 12) * 0.06, volume: 0.55 });
      particles.sparkle(BIRD_X, G.bird.y, 10, { color: '#7affd8' });
      particles.ring(BIRD_X, G.bird.y, 'rgba(122,255,216,0.9)', 4, 0.3);
      if (G.combo === 5 || G.combo === 10 || G.combo === 20) {
        floatingText.add(CANVAS_W / 2, 260, 'COMBO x' + Rules.comboMult(), { color: '#7affd8', font: 'bold 40px sans-serif' });
        sfx('levelup');
      }
    } else if (G.combo > 0 && G.comboSaves > 0) {
      // Combo Keeper — an imperfect pass may spend a save instead of breaking the streak
      --G.comboSaves;
      floatingText.add(BIRD_X, G.bird.y - 48, 'COMBO KEPT', { color: '#ff7a3a' });
    } else {
      G.combo = 0;
    }

    // Near miss — a clean pass within a hair of the pipes pays a coin
    if (gate.minClear !== undefined && gate.minClear < 7 && clean && G.mode !== 'zen') {
      payCoins(Rules.coinValue());
      Goals.bump('close', 1);
      addPoints(ARCADE.close);
      floatingText.add(BIRD_X, G.bird.y - 74, 'CLOSE!', { color: '#ffb03a' });
      particles.burst(BIRD_X, G.bird.y, 8, { color: '#ffffff', speed: 3, size: 2 });
      sfx('whoosh', { pitch: 1.5, volume: 0.4 });
    }

    Powers.goldShower();
    Nav.updateStatus();
  }

  /* one coin into the purse — the bird's own pickups and the Wingmate's */
  function collectCoin(coin, cx) {
    coin.taken = true;
    ++G.coinsPicked;
    const whole = payCoins(Rules.coinValue());
    addPoints(ARCADE.coin);
    // A streak of coins picked up in quick succession climbs in pitch
    G.coinStreak = G.globalTime - G.coinStreakTime < 0.6 ? Math.min(G.coinStreak + 1, 12) : 0;
    G.coinStreakTime = G.globalTime;
    sfx('coin', { pitch: 1.1 + G.coinStreak * 0.05, volume: 0.4 });
    particles.sparkle(cx, coin.y, 5, { color: '#ffd23f' });
    Fx.addRing(cx, coin.y);
    if (whole > 1)
      floatingText.add(cx, coin.y - 24, '+' + whole, { color: ui.UI.gold });
  }

  function updateCoins(step) {
    // Coins — an active magnet drags nearby coins into the bird
    const magnetR = Rules.magnetRadius();
    const pull = 1 - Math.pow(0.82, step);
    for (const coin of G.course.coins) {
      if (coin.taken)
        continue;
      let cx = coin.x - G.dist;
      if (cx > CANVAS_W + 60)
        break;
      if (magnetR > 0) {
        const mx = cx - BIRD_X;
        const my = coin.y - G.bird.y;
        if (mx * mx + my * my < magnetR * magnetR) {
          coin.x += (G.dist + BIRD_X - coin.x) * pull;
          coin.y += (G.bird.y - coin.y) * pull;
          cx = coin.x - G.dist;
        }
      }
      if (Math.abs(cx - BIRD_X) >= 60)
        continue;
      const dx = cx - BIRD_X;
      const dy = coin.y - G.bird.y;
      if (dx * dx + dy * dy < COIN_RADIUS * COIN_RADIUS)
        collectCoin(coin, cx);
    }
  }

  function updateBubbles() {
    for (const bubble of G.course.bubbles) {
      if (bubble.taken)
        continue;
      const bx = bubble.x - G.dist;
      if (Math.abs(bx - BIRD_X) >= 60)
        continue;
      const dx = bx - BIRD_X;
      const dy = bubble.y - G.bird.y;
      if (dx * dx + dy * dy >= 36 * 36)
        continue;
      bubble.taken = true;
      particles.burst(bx, bubble.y, 18, { color: NS.C.BUBBLE_COLORS[bubble.kind], speed: 5, size: 3, life: 0.7 });
      Powers.grant(bubble.kind);
    }
  }

  /* seasonal tokens: they only exist while an event runs (every event has one) */
  function updateTokens() {
    for (const tk of G.course.tokens) {
      if (tk.taken)
        continue;
      const tx = tk.x - G.dist;
      if (Math.abs(tx - BIRD_X) >= 60)
        continue;
      const dx = tx - BIRD_X, dy = tk.y - G.bird.y;
      if (dx * dx + dy * dy >= 34 * 34)
        continue;
      tk.taken = true;
      const n = Rules.tokenValue();
      G.tokensRun += n;
      addPoints(ARCADE.token);
      Goals.addTokens(n);
      const ev = G.season.event;
      particles.burst(tx, tk.y, 16, { color: ev.tokenColor, speed: 4, size: 3, shape: 'star' });
      particles.ring(tx, tk.y, ev.tokenColor, 4, 0.3);
      floatingText.add(tx, tk.y - 30, '+' + n + ' ' + ev.token, { color: ev.tokenColor });
      sfx('pickup', { volume: 0.5, pitch: 1.2 });
    }
  }

  function updateHazards(dt, step) {
    const w = {
      dist: G.dist, t: G.worldT, dt: dt, step: step, birdX: BIRD_X, birdY: G.bird.y, birdR: Rules.birdRadius(),
      windScale: Rules.windScale(), crowScale: Rules.crowScale()
    };
    const crowsHarmless = Rules.crowsHarmless();
    for (const hz of G.course.hazards) {
      const sx = hz.x - G.dist;
      if (sx < -300 || sx > CANVAS_W + 300)
        continue;
      if (hz.type === 'gust') {
        const push = H.gustPush(hz, w);
        if (push) {
          if (!hz.entered) {
            hz.entered = true;
            sfx('whoosh', { volume: 0.3 });
          }
          G.bird.vy += push * (step || 0);
        }
        continue;
      }
      const ev = H.step(hz, w);
      if (ev === 'drop')
        sfx('drop');
      else if (ev === 'smash') {
        particles.burst(sx, GROUND_Y - 4, 14, { color: '#cfefff', speed: 4, size: 3, gravity: 0.2 });
        sfx('smallExplode', { volume: 0.35 });
      } else if (ev === 'laser' && sx > -40 && sx < CANVAS_W)
        sfx('laser', { volume: 0.25 });
      else if (ev === 'launch' && sx > -40 && sx < CANVAS_W + 40)
        sfx('shoot', { pitch: 0.6, volume: 0.3 });
      else if (ev === 'caw')
        sfx('hurt', { pitch: 1.8, volume: 0.25 });

      if (hz.type === 'fireball') {
        const fy = H.fireballY(hz, G.worldT);
        hz.ember = (hz.ember || 0) + 1;
        if (fy < GROUND_Y + 10 && hz.ember % 4 === 0)
          particles.trail(sx, fy + 12, { color: '#ff8a3a', size: 3, life: 0.4, vy: 1, shape: 'glow' });
      }
      if (hz.type === 'crow' && !hz.counted && sx < BIRD_X - 40) {
        hz.counted = true;
        if (!hz.beaten)
          Goals.bump('crows', 1);
      }
      if (H.hits(hz, w)) {
        if (hz.type === 'crow' && (crowsHarmless || G.power.rush > 0 || G.power.blast > 0)) {
          hz.beaten = true;
          particles.burst(sx, hz.y, 12, { color: '#3a2a4a', speed: 5 });
          floatingText.add(sx, hz.y - 30, 'SHOO!', { color: '#c08aff' });
          sfx('bounce', { volume: 0.4 });
        } else {
          Run.takeHit(hz.type);
        }
      }
      if (G.state !== STATE_PLAYING)
        break;
    }
  }

  Object.assign(NS.contact, { ZEN_SCALE, addPoints, payCoins, updateGates, passGate, collectCoin, updateCoins, updateBubbles, updateTokens, updateHazards });
})();
