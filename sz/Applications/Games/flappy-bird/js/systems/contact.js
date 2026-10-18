;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The bird against the course objects: gate collision and pass scoring (score, perfect
     combo, Combo Keeper, near miss), coins with the magnet and the streak, power-up bubbles,
     and the moving biome hazards. Writes the score, coin, combo and power fields of G
     and the per-object flags in G.course. */

  const {
    CANVAS_W, BIRD_X, COIN_RADIUS, GROUND_Y, GATE_W, CAP_EXTRA_W, CAP_H, LEVELUP_INTERVAL, BUBBLE_COLORS,
    POWER_NAMES, STATE_PLAYING
  } = NS.C;
  const { ui, particles, floatingText, sfx } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Rules = NS.rules;
  const Run = NS.run;
  const Fx = NS.fx;
  const Nav = NS.nav;

  function updateGates() {
    // Gates — collision with the four rects of the gate, then pass scoring
    for (const gate of G.course.gates) {
      const sx = gate.x - G.dist;
      if (sx <= -GATE_W - 20 || sx >= CANVAS_W + 20)
        continue;
      const shape = SZ.FlappyCourse.gateShape(gate, G.runTime);
      const topBottom = shape.y - shape.gap / 2;
      const botTop = shape.y + shape.gap / 2;
      const birdR = Rules.birdRadius();

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
      if (hit)
        Run.takeHit('pipe');
      if (G.state !== STATE_PLAYING)
        break;

      if (!gate.passed && sx + GATE_W < BIRD_X - birdR) {
        gate.passed = true;
        ++G.score;
        ++G.save.stats.gates;
        G.scorePopTimer = 0.2;
        if (G.score % LEVELUP_INTERVAL === 0)
          sfx('levelup');
        else
          sfx('blip', { pitch: 0.9, volume: 0.35 });

        // Gate-pass sparkle effect at the gap edges
        particles.sparkle(sx + GATE_W, topBottom, 6, { color: '#ffd700' });
        particles.sparkle(sx + GATE_W, botTop, 6, { color: '#ffd700' });
        floatingText.add(BIRD_X, G.bird.y - 20, '+1', { color: '#fff', decay: 0.03 });

        // Perfect pass — dead centre of the gap keeps the combo alive
        const offset = Math.abs(G.bird.y - shape.y) / (shape.gap / 2);
        if (offset <= Rules.perfectBand()) {
          ++G.combo;
          ++G.perfects;
          G.bestCombo = Math.max(G.bestCombo, G.combo);
          floatingText.add(BIRD_X, G.bird.y - 48, G.combo >= 2 ? 'PERFECT! x' + G.combo : 'PERFECT!', { color: '#7affd8', font: 'bold 24px sans-serif' });
          sfx('blip', { pitch: 1 + Math.min(G.combo, 12) * 0.06, volume: 0.6 });
          particles.sparkle(BIRD_X, G.bird.y, 10, { color: '#7affd8' });
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
        if (gate.minClear !== undefined && gate.minClear < 7 && G.hitsTaken === gate.hitsAtEntry) {
          G.coinCarry += Rules.coinValue();
          const whole = Math.floor(G.coinCarry);
          G.coinCarry -= whole;
          G.coinsRun += whole;
          floatingText.add(BIRD_X, G.bird.y - 74, 'CLOSE!', { color: '#ffb03a' });
          particles.burst(BIRD_X, G.bird.y, 8, { color: '#ffffff', speed: 3, size: 2 });
          sfx('whoosh', { pitch: 1.5, volume: 0.4 });
        }

        Nav.updateStatus();
      }
    }
  }

  function updateCoins(step) {
    // Coins — an active magnet drags nearby coins into the bird
    const magnetR = Rules.magnetRadius();
    const pull = 1 - Math.pow(0.82, step);
    for (const coin of G.course.coins) {
      if (coin.taken)
        continue;
      let cx = coin.x - G.dist;
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
      if (dx * dx + dy * dy < COIN_RADIUS * COIN_RADIUS) {
        coin.taken = true;
        ++G.coinsPicked;
        // Fractional coin values accumulate in the carry, only whole coins are paid out
        G.coinCarry += Rules.coinValue();
        const whole = Math.floor(G.coinCarry);
        G.coinCarry -= whole;
        G.coinsRun += whole;
        // A streak of coins picked up in quick succession climbs in pitch
        G.coinStreak = G.globalTime - G.coinStreakTime < 0.6 ? Math.min(G.coinStreak + 1, 12) : 0;
        G.coinStreakTime = G.globalTime;
        sfx('coin', { pitch: 1.1 + G.coinStreak * 0.05, volume: 0.45 });
        particles.sparkle(cx, coin.y, 5, { color: '#ffd23f' });
        Fx.addRing(cx, coin.y);
        if (whole > 1)
          floatingText.add(cx, coin.y - 24, '+' + whole, { color: ui.UI.gold });
      }
    }
  }

  function updateBubbles() {
    // Power-up bubbles
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
      if (bubble.kind === 'shield')
        G.power.shield = true;
      else
        G.power[bubble.kind] = Rules.powerDuration(bubble.kind);
      sfx('powerup');
      particles.burst(bx, bubble.y, 18, { color: BUBBLE_COLORS[bubble.kind], speed: 5, size: 3, life: 0.7 });
      floatingText.add(BIRD_X, G.bird.y - 40, POWER_NAMES[bubble.kind], { color: BUBBLE_COLORS[bubble.kind], font: 'bold 26px sans-serif' });
      G.flash = 0.25;
      G.flashColor = BUBBLE_COLORS[bubble.kind];
    }
  }

  function updateHazards(dt, step) {
    // Biome hazards — they keep moving while ghosted, they just cannot hurt
    for (const hz of G.course.hazards) {
      const sx = hz.x - G.dist;
      if (sx < -300 || sx > CANVAS_W + 300)
        continue;

      if (hz.type === 'gust') {
        if (G.dist + BIRD_X >= hz.x && G.dist + BIRD_X <= hz.x + hz.w) {
          if (!hz.entered) {
            hz.entered = true;
            sfx('whoosh', { volume: 0.3 });
          }
          G.bird.vy += hz.dir * hz.strength * (1 - 0.4 * Prog.treeLevel('w_wind')) * step;
        }
      } else if (hz.type === 'icicle') {
        if (hz.sy === undefined)
          hz.sy = hz.len;
        if (!hz.warnStarted && hz.x - (G.dist + BIRD_X) < 420) {
          hz.warnStarted = true;
          hz.warn = 0.35;
        }
        if (hz.warnStarted && !hz.falling) {
          hz.warn -= dt;
          if (hz.warn <= 0) {
            hz.falling = true;
            hz.vy = 0;
            sfx('drop');
          }
        }
        if (!hz.smashed) {
          if (hz.falling) {
            hz.vy += 0.55 * step;
            hz.sy += hz.vy * step;
          }
          if (Rules.circleRect(BIRD_X, G.bird.y, Rules.birdRadius(), sx - 9, hz.sy - hz.len, 18, hz.len))
            Run.takeHit('icicle');
          if (hz.sy >= GROUND_Y) {
            hz.smashed = true;
            particles.burst(sx, GROUND_Y - 4, 14, { color: '#cfefff', speed: 4, size: 3, gravity: 0.2 });
            sfx('smallExplode', { volume: 0.35 });
          }
        }
      } else if (hz.type === 'bat') {
        hz.x -= 1.4 * step;
        const bx = hz.x - G.dist;
        const by = hz.y + hz.amp * Math.sin(Math.PI * 2 * G.runTime / hz.period + hz.phase);
        const rr = 15 + Rules.birdRadius();
        const dx = bx - BIRD_X;
        const dy = by - G.bird.y;
        if (dx * dx + dy * dy < rr * rr)
          Run.takeHit('bat');
      } else if (hz.type === 'laser') {
        const gate = G.course.gates.find(g => g.index === hz.gate);
        if (!gate)
          continue;
        const cycle = hz.on + hz.off;
        const tt = (G.runTime + hz.phase) % cycle;
        const lit = tt < hz.on;
        const beamX = gate.x - G.dist + GATE_W / 2;
        if (lit) {
          if (!hz.wasOn && beamX > 0 && beamX < CANVAS_W)
            sfx('laser', { volume: 0.25 });
          if (Math.abs(BIRD_X - beamX) < Rules.birdRadius() + 3)
            Run.takeHit('laser');
        }
        hz.wasOn = lit;
      } else if (hz.type === 'fireball') {
        const u = ((G.runTime + hz.phase) % hz.period) / hz.period;
        const fy = GROUND_Y + 20 - hz.height * GROUND_Y * Math.sin(Math.PI * u);
        if (fy < GROUND_Y + 10) {
          // the launch is heard once per cycle, only while the column is on screen
          const cycle = Math.floor((G.runTime + hz.phase) / hz.period);
          if (hz.soundCycle !== cycle && u < 0.5 && sx > -40 && sx < CANVAS_W + 40) {
            hz.soundCycle = cycle;
            sfx('shoot', { pitch: 0.6, volume: 0.3 });
          }
          const rr = 17 + Rules.birdRadius();
          const dx = sx - BIRD_X;
          const dy = fy - G.bird.y;
          if (dx * dx + dy * dy < rr * rr)
            Run.takeHit('fireball');
          hz.ember = (hz.ember || 0) + 1;
          if (hz.ember % 4 === 0)
            particles.trail(sx, fy + 12, { color: '#ff8a3a', size: 3, life: 0.4, vy: 1 });
        }
      }

      if (G.state !== STATE_PLAYING)
        break;
    }
  }

  Object.assign(NS.contact, { updateGates, updateCoins, updateBubbles, updateHazards });
})();
