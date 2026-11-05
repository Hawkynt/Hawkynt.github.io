;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Power-ups and FEVER: granting a bubble, the timers, the Sky Rush autopilot, the
     Wingmate that follows the bird and grabs coins, Rocket Beak pipe smashing, Gold Rush
     coin showers, and the fever meter. Writes G.power, G.blastCharges, G.buddy, G.fever,
     G.feverT and the bird's vertical speed while rushing. */

  const { BIRD_X, GATE_W, GROUND_Y, COIN_RADIUS, POWER_TIMED, BUBBLE_COLORS, POWER_NAMES, FEVER_TIME } = NS.C;
  const { particles, floatingText, screenShake, sfx } = NS.services;
  const G = NS.state;
  const Prog = NS.progress;
  const Rules = NS.rules;
  const Goals = NS.goals;
  const Fx = NS.fx;

  function grant(kind, silent) {
    if (kind === 'shield')
      G.power.shield = true;
    else if (kind === 'heart') {
      G.hearts = Math.min(G.hearts + 1, Rules.maxHearts() + 1);
    } else {
      G.power[kind] = Rules.powerDuration(kind);
      if (kind === 'blast')
        G.blastCharges = Rules.blastCharges();
      if (kind === 'buddy') {
        G.buddy.x = BIRD_X - 160;
        G.buddy.y = G.bird.y + 60;
        G.buddy.shield = Prog.treeLevel('p_buddy') > 0;
      }
    }
    if (silent)
      return;
    if (G.save.powersSeen.indexOf(kind) < 0)
      G.save.powersSeen.push(kind);
    Goals.bump('powers', 1);
    sfx('powerup');
    particles.ring(BIRD_X, G.bird.y, BUBBLE_COLORS[kind], 6, 0.35);
    floatingText.add(BIRD_X, G.bird.y - 40, POWER_NAMES[kind], { color: BUBBLE_COLORS[kind], font: 'bold 26px sans-serif' });
    G.flash = 0.25;
    G.flashColor = BUBBLE_COLORS[kind];
  }

  function update(dt, step) {
    for (const kind of POWER_TIMED) {
      if (G.power[kind] <= 0)
        continue;
      G.power[kind] = Math.max(0, G.power[kind] - dt);
      if (G.power[kind] === 0) {
        sfx('drop', { volume: 0.35 });
        if (kind === 'rush')
          G.invuln = Math.max(G.invuln, 0.8);
        if (kind === 'blast')
          G.blastCharges = 0;
      }
    }

    // FEVER counts down; its rainbow trail is drawn by the world
    if (G.feverT > 0) {
      G.feverT = Math.max(0, G.feverT - dt);
      if (G.feverT === 0)
        sfx('drop', { volume: 0.4, pitch: 0.8 });
    }

    if (G.power.rush > 0)
      steerRush();
    if (G.power.buddy > 0)
      updateBuddy(dt, step);
  }

  /* Sky Rush: the bird steers itself to the middle of the next gap */
  function steerRush() {
    let target = 320;
    for (const gate of G.course.gates) {
      if (gate.x + GATE_W - G.dist > BIRD_X - 20) {
        target = SZ.FlappyCourse.gateShape(gate, G.worldT).y;
        break;
      }
    }
    if (G.boss && G.boss.orbs.length)
      target = G.boss.orbs[0].y;
    const dy = target - G.bird.y;
    G.bird.vy = Math.max(-9, Math.min(9, dy * 0.12));
    if (Math.floor(G.globalTime * 30) % 2 === 0)
      particles.trail(BIRD_X - 18, G.bird.y + (Math.random() - 0.5) * 16, { color: '#ff4ad8', size: 4, life: 0.6, vx: -4, shape: 'glow' });
  }

  function updateBuddy(dt, step) {
    const b = G.buddy;
    const tx = BIRD_X - 70 + Math.sin(G.globalTime * 1.3) * 20;
    const ty = G.bird.y + 70 * Math.sin(G.globalTime * 0.9);
    const k = 1 - Math.pow(0.9, step);
    b.x += (tx - b.x) * k;
    b.y += (Math.max(40, Math.min(GROUND_Y - 30, ty)) - b.y) * k;
    // the wingmate grabs coins close to itself
    const r2 = (COIN_RADIUS + 14) * (COIN_RADIUS + 14);
    for (const coin of G.course.coins) {
      if (coin.taken)
        continue;
      const cx = coin.x - G.dist;
      if (cx < b.x - 60)
        continue;
      if (cx > b.x + 60)
        break;
      const dx = cx - b.x, dy = coin.y - b.y;
      if (dx * dx + dy * dy < r2)
        NS.contact.collectCoin(coin, cx);
    }
  }

  /* Rocket Beak: a pipe that would hit the bird shatters instead; true when it did */
  function trySmash(gate, sx) {
    if (G.power.blast <= 0 || G.blastCharges <= 0 || gate.smashed)
      return false;
    gate.smashed = true;
    --G.blastCharges;
    if (G.blastCharges <= 0)
      G.power.blast = 0;
    const shape = SZ.FlappyCourse.gateShape(gate, G.worldT);
    Fx.shatterGate(sx, shape.y - shape.gap / 2, shape.y + shape.gap / 2, G.scene.gateStyle);
    screenShake.trigger(7, 260);
    G.hitStop = 0.05;
    G.flash = 0.3;
    G.flashColor = '#ff9a3a';
    sfx('explode', { volume: 0.5 });
    floatingText.add(BIRD_X + 40, G.bird.y - 50, 'SMASH!', { color: '#ff7a2a', font: 'bold 34px sans-serif' });
    return true;
  }

  /* Gold Rush: every pipe passed throws a fountain of coins that fly straight in */
  function goldShower() {
    if (G.power.gold <= 0)
      return;
    const n = 3 + 2 * Prog.treeLevel('m_gold');
    G.coinCarry += n * Rules.coinBonus();
    const whole = Math.floor(G.coinCarry);
    G.coinCarry -= whole;
    G.coinsRun += whole;
    particles.confetti(BIRD_X + 10, G.bird.y, 10, { colors: ['#ffe14a', '#ffc21a', '#fff3a0'], speed: 5, gravity: 0.25 });
    floatingText.add(BIRD_X, G.bird.y - 64, '+' + whole + ' GOLD', { color: '#ffe14a' });
    sfx('coin', { pitch: 1.4, volume: 0.4 });
  }

  /* ── FEVER: PERFECT passes fill the meter; full, it pays double for a few seconds ── */
  function feedFever(amount) {
    if (G.feverT > 0 || G.mode === 'zen')
      return;
    G.fever = Math.min(1, G.fever + amount);
    if (G.fever >= 1) {
      G.fever = 0;
      G.feverT = FEVER_TIME;
      Goals.bump('fevers', 1);
      floatingText.add(640, 250, 'FEVER!', { color: '#ff4ad8', font: 'bold 56px sans-serif' });
      particles.confetti(BIRD_X, G.bird.y, 40, { colors: ['#ff4ad8', '#ffd84a', '#4ad8ff', '#7aff8a'] });
      particles.ring(BIRD_X, G.bird.y, '#ff4ad8', 9, 0.5);
      screenShake.trigger(4, 200);
      sfx('levelup', { pitch: 1.3 });
      sfx('powerup', { pitch: 1.5, volume: 0.6 });
    }
  }

  Object.assign(NS.powers, { grant, update, steerRush, updateBuddy, trySmash, goldShower, feedFever });
})();
