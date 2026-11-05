/* Fruit and collectibles on the board: keeping the main fruit count topped up (common fruit,
   golden apples and scale gems by chance), festival tokens on a timer, Sun Shards in guardian
   fights, short-lived Fruit Rain, the magnet pull, eating (score with the combo and power
   multipliers, growth, golden eggs, gems, tokens, venom refills) and the combo clock. Owns
   run.foods and the combo. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const C = NS.constants;
  const { FRUITS, COMMON_FRUIT } = NS.items;
  const B = NS.board;
  const fx = NS.fx;
  const rules = NS.rules;
  const { sfx } = NS.audio;

  const MAIN = { apple: 1, cherry: 1, pear: 1, plum: 1, golden: 1, gem: 1 };

  function hasMut(id) {
    return G.run.mutators && G.run.mutators.indexOf(id) >= 0;
  }

  function add(i, kind, life) {
    if (i < 0) return null;
    const f = { i: i, kind: kind, t: 0, life: life || 0 };
    G.run.foods.push(f);
    return f;
  }

  function mainCount() {
    let n = 0;
    const fs = G.run.foods;
    for (let k = 0; k < fs.length; ++k) if (MAIN[fs[k].kind] && !fs[k].life) ++n;
    return n;
  }

  function target() {
    const run = G.run;
    let n = 1 + Math.floor(G.stats.extraFood);
    if (run.mode === 'zen') n += 2;
    if (run.mode === 'demo') n = 3;
    if (run.boss) n = 2;
    return n;
  }

  function pickKind() {
    const st = G.stats;
    const r = G.rng();
    const gold = 0.05 + st.goldChance + (hasMut('golden') ? 0.15 : 0);
    const gem = G.run.mode === 'demo' ? 0 : 0.025 + st.gems;
    if (r < gold) return 'golden';
    if (r < gold + gem) return 'gem';
    return COMMON_FRUIT[Math.floor(G.rng() * COMMON_FRUIT.length)];
  }

  function ensure() {
    let need = target() - mainCount();
    while (need-- > 0) {
      const i = B.freeCell(4);
      if (i < 0) return;
      const f = add(i, pickKind());
      fx.ring(fx.cx(i), fx.cy(i), 2, 26, 0.4, '#ffffff', 3);
      f.pop = 0.35;
    }
  }

  function update(dt) {
    const run = G.run;
    const fs = run.foods;
    for (let k = fs.length - 1; k >= 0; --k) {
      const f = fs[k];
      f.t += dt;
      if (f.pop > 0) f.pop = Math.max(0, f.pop - dt);
      if (f.life && f.t >= f.life) {
        fs.splice(k, 1);
        fx.burst(fx.cx(f.i), fx.cy(f.i), 6, '#ffffff', 60, 0.4, 5, fx.DOT);
      }
    }
    /* festival tokens drift in now and then */
    if (G.season && run.mode !== 'demo') {
      run.tokenT -= dt;
      if (run.tokenT <= 0) {
        run.tokenT = 16 / (1 + G.stats.tokens) + G.rng() * 6;
        let has = false;
        for (let k = 0; k < fs.length; ++k) if (fs[k].kind === 'token') has = true;
        if (!has) add(B.freeCell(5), 'token', 14);
      }
    }
    /* Sun Shards while a guardian stands and the snake is not shining */
    if (run.boss && run.boss.hp > 0 && !(run.act.radiant > 0)) {
      let has = false;
      for (let k = 0; k < fs.length; ++k) if (fs[k].kind === 'shard') has = true;
      if (!has) {
        run.shardT -= dt;
        if (run.shardT <= 0) {
          run.shardT = 3.5;
          const f = add(B.freeCell(6), 'shard');
          if (f) sfx('zap', { volume: 0.5 });
        }
      }
    }
    if (hasMut('storm')) {
      run.stormT = (run.stormT || 20) - dt;
      if (run.stormT <= 0) { run.stormT = 20; rain(6); }
    }
    /* the combo fades when no fruit is eaten in time */
    if (run.combo > 0) {
      run.comboT -= dt;
      if (run.comboT <= 0) {
        if (run.combo >= 5) fx.text(fx.cx(run.snake.body[0]), fx.cy(run.snake.body[0]) - 30, 'combo ' + run.combo + ' ended', '#c8d8c0', 16);
        run.combo = 0;
      }
    }
    ensure();
  }

  function rain(n) {
    for (let k = 0; k < n; ++k) {
      const i = B.freeCell(2);
      if (i < 0) break;
      const f = add(i, COMMON_FRUIT[k % COMMON_FRUIT.length], 8 + G.rng() * 3);
      f.pop = 0.5;
      fx.spray(fx.cx(i), fx.cy(i) - 40, Math.PI / 2, 0.5, 4, FRUITS[f.kind].color, 160, 0.4, 6);
    }
  }

  /* the magnet drags fruit within reach one cell toward the head each step */
  function magnetStep() {
    const run = G.run;
    if (!(run.act.magnet > 0)) return;
    const head = run.snake.body[0];
    const reach = 4 + G.stats.magnet;
    const L = NS.levels;
    for (let k = 0; k < run.foods.length; ++k) {
      const f = run.foods[k];
      const d = B.dist(f.i, head);
      if (d <= 1 || d > reach || f.kind === 'egg') continue;
      let best = -1, bd = d;
      for (let dir = 0; dir < 4; ++dir) {
        const s = L.step(run.level, f.i, dir);
        if (s < 0 || !B.isFree(s)) continue;
        const nd = B.dist(s, head);
        if (nd < bd) { bd = nd; best = s; }
      }
      if (best >= 0) {
        fx.spawn(fx.GLOW, fx.cx(f.i), fx.cy(f.i), 0, 0, 0.3, 8, '#ff9a3a');
        f.i = best;
      }
    }
  }

  function multiplier() {
    const run = G.run;
    let m = rules.comboMultiplier(run.combo, G.stats.comboCap);
    if (run.act.golden > 0) m *= 2;
    if (run.act.dash > 0) m *= 1.5;
    if (hasMut('fast')) m *= 1.5;
    return m * NS.run.scoreMul();
  }

  /* the head reached food k */
  function eat(k) {
    const run = G.run;
    const f = run.foods[k];
    run.foods.splice(k, 1);
    const def = FRUITS[f.kind];
    const x = fx.cx(f.i), y = fx.cy(f.i);
    const P = NS.progress;
    switch (f.kind) {
      case 'gem': {
        const n = 1 + Math.floor(G.rng() * 3);
        run.gems += n;
        fx.text(x, y - 18, '+' + n + ' scales', '#4ae0d0', 18);
        fx.burst(x, y, 14, ['#4ae0d0', '#ffffff', '#a0fff4'], 220, 0.6, 7, fx.STAR);
        sfx('coin');
        break;
      }
      case 'token': {
        run.tokens += 1;
        P.token(1);
        fx.text(x, y - 18, G.season ? G.season.name + ' +1' : '+1', G.season ? G.season.color : '#fff', 17);
        fx.burst(x, y, 16, [G.season ? G.season.color : '#fff', '#ffffff'], 240, 0.7, 8, fx.STAR);
        fx.ring(x, y, 4, 50, 0.5, G.season ? G.season.color : '#fff', 4);
        sfx('coin', { pitch: 1.3 });
        break;
      }
      case 'egg': {
        const idx = run.level.eggs.indexOf(f.i);
        if (idx >= 0) run.eggs[idx] = true;
        let got = 0;
        for (let e = 0; e < run.eggs.length; ++e) if (run.eggs[e]) ++got;
        addScore(30 * multiplier(), x, y);
        P.add('eggs', 1);
        fx.text(x, y - 40, 'Golden Egg ' + got + ' / ' + run.eggs.length, '#ffe07a', 20, 1.5);
        fx.burst(x, y, 30, ['#ffe07a', '#ffffff', '#ffb02a'], 300, 0.8, 9, fx.STAR);
        fx.ring(x, y, 6, 70, 0.6, '#ffe07a', 5);
        sfx('powerup', { pitch: 1.2 });
        break;
      }
      case 'shard':
        NS.powerups.activate('radiant');
        fx.burst(x, y, 30, ['#fff27a', '#ffffff', '#ffb02a'], 320, 0.7, 10);
        fx.ring(x, y, 6, 90, 0.5, '#fff27a', 6);
        fx.flash('#fff6c0', 0.35);
        sfx('powerup', { pitch: 1.4 });
        break;
      default: {
        /* real fruit: the combo, growth, score, refills */
        run.combo += 1;
        run.comboT = C.COMBO_WINDOW + G.stats.comboWindow;
        run.maxCombo = Math.max(run.maxCombo, run.combo);
        const grow = (def.grow || 1) * (hasMut('feast') ? 2 : 1);
        run.snake.grow += grow;
        run.eaten += 1;
        const pts = rules.fruitScore(def.value, multiplier(), run.snake.body.length, G.stats.growScore);
        addScore(pts, x, y);
        P.add('fruit', 1);
        P.best('bestCombo', run.combo);
        NS.audio.fruit(run.combo);
        fx.burst(x, y, 12 + Math.min(20, run.combo), [def.color, '#ffffff', '#fff6b0'], 200 + run.combo * 6, 0.55, 7);
        fx.ring(x, y, 4, 34 + Math.min(30, run.combo * 2), 0.35, def.color, 3);
        if (run.combo > 0 && run.combo % C.COMBO_PER_STEP === 0) {
          fx.text(x, y - 44, 'x' + rules.comboMultiplier(run.combo, G.stats.comboCap).toFixed(1) + ' COMBO', '#ffd25a', 22, 1.2);
          sfx('blip', { pitch: 1 + run.combo * 0.03 });
        }
        if (f.kind === 'golden') {
          fx.flash('#ffe07a', 0.25);
          fx.burst(x, y, 20, ['#ffd23a', '#ffffff'], 300, 0.7, 8, fx.STAR);
          if (run.mode === 'time' || run.mode === 'daily') {
            run.timeLeft += 3;
            fx.text(x, y - 66, '+3s', '#6fd3ff', 20);
          }
          sfx('coin');
        }
        run.snake.gulp.push(0);
        if (G.stats.venom > 0) {
          run.venomFruit += 1;
          const every = Math.max(2, 6 - G.stats.venomRegen);
          if (run.venomFruit >= every) {
            run.venomFruit = 0;
            NS.combat.addVenom(1);
          }
        }
        if (f.kind === 'golden') NS.progress.add('goldens', 1);
      }
    }
    if (f.kind === 'petal') {
      addScore(5, x, y);
      sfx('blip', { pitch: 1.6, volume: 0.4 });
    }
  }

  function addScore(pts, x, y) {
    pts = Math.round(pts);
    G.run.score += pts;
    if (x !== undefined) fx.text(x, y - 16, '+' + pts, '#ffffff', 16 + Math.min(10, pts / 40));
  }

  function clearKinds(kinds) {
    const fs = G.run.foods;
    for (let k = fs.length - 1; k >= 0; --k) if (kinds[fs[k].kind]) fs.splice(k, 1);
  }

  Object.assign(NS.food, {
    MAIN, add, ensure, update, rain, magnetStep, multiplier, eat, addScore, clearKinds, hasMut
  });
})();
