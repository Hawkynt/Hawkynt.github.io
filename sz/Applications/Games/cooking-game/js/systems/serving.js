;(function() {
  'use strict';

  /* Serving: clicks on the pass and the bin, dishes flying to a guest,
     tips, combo, goal and combo celebrations and the coins flying to the
     HUD. Owns G.flying and G.coins; writes money, combo and guest states. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { VIEW_W, SEAT_Y, PASS_Y, TRASH, EAT_TIME, FLY_TIME, COIN_TIME, COIN_MAX, HUD_PX,
    HUD_PY, HUD_PW, COIN_TX, COIN_TY } = NS.C;
  const { fx, screenShake, sfx } = NS.juice;
  const { treeLevel } = NS.persist;
  const { passCapacity, passX, comboMult } = NS.rules;
  const { updateStatus } = NS.status;
  const { pushRing } = NS.effects;
  const { coachAdvance } = NS.coach;

  function serveTarget(dish) {
    const owner = dish.ticket && dish.ticket.customer;
    if (owner && owner.state === 'waiting') return owner;
    for (const c of G.customers)
      if (c.state === 'waiting' && c.order === dish.recipe) return c;
    return null;
  }

  function clickPass(mx, my) {
    for (let i = 0; i < G.pass.length; ++i) {
      const px = passX(i);
      if (Math.abs(mx - px) > 40 || Math.abs(my - PASS_Y) > 40) continue;
      const dish = G.pass[i];
      const target = serveTarget(dish);
      if (!target) {
        fx.text(px, PASS_Y - 50, 'No one waiting', { color: '#ffb0a0', size: 16 });
        sfx('error', { volume: 0.5 });
        return true;
      }
      G.pass.splice(i, 1);
      G.flying.push({ recipe: dish.recipe, quality: dish.quality, ticket: dish.ticket, x0: px, y0: PASS_Y, t: 0, customer: target });
      sfx('whoosh', { pitch: 1.3, volume: 0.3 });
      return true;
    }
    return false;
  }

  function clickTrash(mx, my) {
    if (Math.hypot(mx - TRASH.x, my - TRASH.y) > TRASH.r + 8) return false;
    const i = G.pass.findIndex(d => d.quality === 'ruined');
    if (i < 0) {
      fx.text(TRASH.x, TRASH.y - 46, 'Nothing to trash', { color: '#e0d0c0', size: 15 });
      sfx('click');
      return true;
    }
    G.pass.splice(i, 1);
    G.trashWobble = 0.5;
    fx.emit('smoke', TRASH.x, TRASH.y - 18, 5, { color: '#6a6460', speed: 50 });
    fx.emit('crumb', TRASH.x, TRASH.y - 18, 8, { colors: ['#3a2a20', '#5a4a3a'], speed: 120, angle: -Math.PI / 2, spread: 1.6 });
    sfx('drop', { pitch: 0.5 });
    return true;
  }

  function serveTo(f, c) {
    const recipe = SZ.KitchenData.recipeById(f.recipe);
    if (f.quality === 'ruined') {
      G.combo = 0;
      ++G.ruinedServed;
      c.mood = 'angry';
      fx.text(c.x, SEAT_Y - 140, 'Ruined!', { color: '#ff5a4a', size: 24 });
      fx.emit('smoke', c.x, SEAT_Y - 90, 8, { color: '#4a4440', speed: 60 });
      screenShake.trigger(6, 240);
      sfx('hurt', { volume: 0.5 });
    } else {
      let tip = SZ.KitchenData.tipFor(recipe, f.quality, c.patience / c.patienceMax, c.type, comboMult());
      const charm = treeLevel('c_tips');
      if (charm > 0) tip = Math.round(tip * (1 + 0.1 * charm));
      const before = G.earned;
      G.earned += tip;
      ++G.served;
      const prevCombo = G.combo;
      if (f.quality === 'perfect') {
        ++G.perfectServed;
        G.combo += treeLevel('c_combo') > 0 ? 2 : 1;
      }
      if (G.combo > G.bestCombo) G.bestCombo = G.combo;
      fx.text(c.x, SEAT_Y - 150, '+$' + tip, { color: '#ffe060', size: 30, rise: 60, life: 1.3 });
      const nCoins = spawnTipCoins(c.x, tip);
      fx.emit('coin', c.x, SEAT_Y - 90, Math.min(8, 2 + Math.floor(tip / 15)), { speed: 260, angle: -Math.PI / 2, spread: 1.6 });
      fx.emit('confetti', c.x, SEAT_Y - 80, f.quality === 'perfect' ? 22 : 10, { speed: 320, angle: -Math.PI / 2, spread: 1.8 });
      fx.emit('glow', c.x, SEAT_Y - 70, 1, { color: '#ffe080', size: 150 });
      /* the tip coin rides the size of the shower: more coins, higher chirp */
      sfx('coin', { pitch: 1 + (nCoins - 3) * 0.12, volume: 0.6 });
      c.hop = 0.4;
      if (f.quality === 'perfect') {
        G.chefPose = 'cheer';
        G.chefTimer = 0.9;
        fx.emit('heart', c.x, SEAT_Y - 100, 5, { color: '#ff5a7a', speed: 90 });
        fx.emit('star', c.x, SEAT_Y - 90, 8, { color: '#ffd23f', speed: 200 });
      }
      if (c.type.id === 'critic')
        c.rating = f.quality === 'perfect' ? 5 : f.quality === 'good' ? 3 : 1;
      if (G.mode === 'career') celebrateGoals(before, G.earned);
      if (prevCombo < 3 && G.combo >= 3) comboFanfare(3);
      else if (prevCombo < 6 && G.combo >= 6) comboFanfare(6);
      else if (prevCombo < 10 && G.combo >= 10) comboFanfare(10);
    }
    c.state = 'eating';
    c.eatTimer = EAT_TIME;
    if (G.coach && G.coach.step === 4 && f.ticket === G.coach.ticket) {
      coachAdvance(5, null);
      G.coach.hideT = 4;
    }
    updateStatus();
  }

  /* 3..8 coins on staggered curved flights to the earnings HUD. */
  function spawnTipCoins(x, tip) {
    const n = Math.max(3, Math.min(8, 3 + Math.floor(tip / 25)));
    for (let i = 0; i < n; ++i) {
      if (G.coins.length >= COIN_MAX) G.coins.shift();
      G.coins.push({
        x0: x + (i - n / 2) * 6, y0: SEAT_Y - 70,
        cx: (x + COIN_TX) / 2 + (Math.random() - 0.5) * 160,
        cy: SEAT_Y - 190 - Math.random() * 60,
        t: -i * 0.07
      });
    }
    return n;
  }

  /* A career star goal crossed mid-day: a burst on the meter and the word. */
  function celebrateGoals(before, after) {
    while (G.goalsHit < 3 && G.dayInfo.goals[G.goalsHit] > 0 && after >= G.dayInfo.goals[G.goalsHit] && before < G.dayInfo.goals[G.goalsHit]) {
      const gx = HUD_PX + 16 + Math.min(1, G.dayInfo.goals[G.goalsHit] / Math.max(1, G.dayInfo.goals[2])) * (HUD_PW - 32);
      fx.emit('star', gx, HUD_PY + 74, 14, { color: '#ffd23f', speed: 220 });
      fx.emit('glow', gx, HUD_PY + 74, 1, { color: '#ffd23f', size: 180 });
      pushRing(gx, HUD_PY + 74, 6, '#ffd23f');
      fx.text(VIEW_W / 2, 170, '★ Goal reached! ★', { color: '#ffd23f', size: 34, life: 1.6, rise: 40 });
      fx.emit('confetti', VIEW_W / 2, 170, 30, { speed: 420, angle: -Math.PI / 2, spread: 2.2 });
      sfx('levelup', { volume: 0.6 });
      ++G.goalsHit;
    }
  }

  /* Crossing a combo step: banner, gold edge glow and a rising fanfare. */
  function comboFanfare(n) {
    G.comboBanner = { n: n, t: 0 };
    G.edgeGlow = 1;
    screenShake.trigger(4, 260);
    fx.emit('confetti', VIEW_W / 2, 150, 40, { speed: 520, angle: -Math.PI / 2, spread: 2.6 });
    fx.emit('flame', VIEW_W / 2, 170, 16, { color: '#ff7a1a', speed: 220 });
    pushRing(VIEW_W / 2, 130, 20, '#ffb060');
    sfx('powerup', { volume: 0.7 });
  }

  function landDish(f) {
    const c = f.customer;
    if (c.state === 'waiting') { serveTo(f, c); return; }
    const alt = serveTarget({ recipe: f.recipe, ticket: f.ticket });
    if (alt) { serveTo(f, alt); return; }
    if (G.pass.length < passCapacity()) {
      G.pass.push({ recipe: f.recipe, quality: f.quality, ticket: f.ticket });
      fx.text(f.customer.x, SEAT_Y - 140, 'Gone!', { color: '#ffb0a0', size: 18 });
      sfx('error', { volume: 0.4 });
      return;
    }
    fx.emit('smoke', f.customer.x, SEAT_Y - 60, 6, { color: '#6a6460', speed: 50 });
  }

  function updateFlying(dt) {
    for (let i = G.flying.length - 1; i >= 0; --i) {
      const f = G.flying[i];
      f.t += dt;
      if (f.t >= FLY_TIME) {
        G.flying.splice(i, 1);
        landDish(f);
        continue;
      }
      /* position is computed here once and reused by drawFlying */
      const k = f.t / FLY_TIME;
      f.x = f.x0 + (f.customer.x - f.x0) * k;
      f.y = f.y0 + (SEAT_Y - 60 - f.y0) * k - Math.sin(k * Math.PI) * 90;
      fx.emit('glow', f.x, f.y, 1, { color: f.quality === 'perfect' ? '#ffd23f' : '#fff4d8', size: f.quality === 'perfect' ? 46 : 30, speed: 0, life: 0.3, alpha: 0.7 });
      if (f.quality === 'perfect') fx.emit('spark', f.x, f.y, 1, { color: '#ffe080', speed: 30, gravity: 0, life: 0.4 });
    }
  }

  function updateCoins(dt) {
    for (let i = G.coins.length - 1; i >= 0; --i) {
      const c = G.coins[i];
      c.t += dt;
      if (c.t >= COIN_TIME) {
        G.coins.splice(i, 1);
        G.meterTick = 0.25;
        G.hudBump = 0.3;
        fx.emit('spark', COIN_TX, COIN_TY, 3, { color: '#ffd23f', speed: 140 });
      }
    }
  }

  NS.serving = { serveTarget, clickPass, clickTrash, serveTo, updateFlying, updateCoins };

})();
