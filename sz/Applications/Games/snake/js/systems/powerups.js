/* Power-ups: the one item lying on the board (spawned on a clock the tech tree shortens, blinking
   before it vanishes), picking it up, and every effect - timed ones in run.act (Dash, Time Warp,
   Magnet, Phase, Golden Fangs, Frost Nova, Sun Shard), Scale Armor charges, Molt, Fruit Rain,
   Quake and Venom refills. Owns run.power, run.act and run.shield. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const C = NS.constants;
  const { POWERUPS, POWER_BY_ID } = NS.items;
  const B = NS.board;
  const fx = NS.fx;
  const { sfx } = NS.audio;

  function pool() {
    const run = G.run;
    const out = [];
    for (let k = 0; k < POWERUPS.length; ++k) {
      const p = POWERUPS[k];
      if (run.mode === 'zen' && !p.zen) continue;
      if (p.id === 'radiant' && run.boss) continue;
      out.push(p);
    }
    return out;
  }

  function pickId() {
    const list = pool();
    let total = 0;
    for (let k = 0; k < list.length; ++k) total += list[k].weight;
    let r = G.rng() * total;
    for (let k = 0; k < list.length; ++k) {
      r -= list[k].weight;
      if (r <= 0) return list[k].id;
    }
    return list[0].id;
  }

  function nextDelay() {
    return C.POWER_EVERY * (1 - Math.min(0.5, G.stats.dropRate)) + G.rng() * 4;
  }

  function update(dt) {
    const run = G.run;
    const act = run.act;
    for (const id in act) {
      if (act[id] <= 0) continue;
      act[id] -= dt;
      if (act[id] <= 0) {
        act[id] = 0;
        if (run.mode !== 'demo') {
          const h = run.snake.body[0];
          fx.text(fx.cx(h), fx.cy(h) - 30, POWER_BY_ID[id].name + ' faded', '#c8d0d8', 14);
          sfx('drop', { volume: 0.5 });
        }
      }
    }
    if (run.power) {
      run.power.t += dt;
      if (run.power.t >= C.POWER_LIFE) {
        fx.burst(fx.cx(run.power.i), fx.cy(run.power.i), 10, '#ffffff', 90, 0.4, 5, fx.DOT);
        run.power = null;
        run.powerT = nextDelay();
      }
    } else if (run.mode !== 'rush' || run.boss) {
      run.powerT -= dt;
      if (run.powerT <= 0) {
        const i = B.freeCell(5);
        if (i >= 0) {
          run.power = { i: i, id: pickId(), t: 0 };
          fx.ring(fx.cx(i), fx.cy(i), 4, 46, 0.5, POWER_BY_ID[run.power.id].color, 4);
          sfx('whoosh', { volume: 0.5, pitch: 1.4 });
        }
        run.powerT = nextDelay();
      }
    }
  }

  function duration(id) {
    const def = POWER_BY_ID[id];
    let d = def.dur * (1 + G.stats.duration);
    if (id === 'radiant') d += G.stats.radiant;
    if (id === 'magnet') d += G.stats.magnet;
    return d;
  }

  /* the head reached the power-up on the board */
  function collect() {
    const run = G.run;
    const p = run.power;
    run.power = null;
    run.powerT = G.rng() < G.stats.twin ? 1.5 : nextDelay();
    run.powerUses += 1;
    NS.progress.add('powerups', 1);
    activate(p.id);
  }

  function activate(id) {
    const run = G.run;
    const def = POWER_BY_ID[id];
    const h = run.snake.body[0];
    const x = fx.cx(h), y = fx.cy(h);
    switch (id) {
      case 'shield':
        run.shield = Math.min(3, run.shield + 1);
        break;
      case 'molt':
        molt();
        break;
      case 'frenzy':
        NS.food.rain(8);
        break;
      case 'quake':
        NS.combat.quake(h, 4);
        break;
      case 'venom':
        NS.combat.addVenom(3);
        break;
      default:
        run.act[id] = Math.max(run.act[id] || 0, duration(id));
    }
    if (id === 'frost') {
      fx.flash('#d8f6ff', 0.35);
      fx.ring(x, y, 10, 600, 0.8, '#bff4ff', 10);
    }
    fx.ring(x, y, 6, 80, 0.45, def.color, 6);
    fx.burst(x, y, 22, [def.color, '#ffffff'], 260, 0.6, 8);
    fx.text(x, y - 34, def.name.toUpperCase(), def.color, 22, 1.3);
    G.ui.powerBanner = { id: id, t: 0 };
    sfx('powerup');
  }

  /* shed the last third of the body; every segment pops into points */
  function molt() {
    const run = G.run;
    const body = run.snake.body;
    const keep = Math.max(C.START_LEN - 1, Math.ceil(body.length * 2 / 3));
    const per = Math.round(4 * (1 + G.stats.moltBonus));
    let pts = 0;
    while (body.length > keep) {
      const i = body.pop();
      pts += per;
      fx.burst(fx.cx(i), fx.cy(i), 4, ['#e05aff', '#ffffff', '#ffb0f0'], 120, 0.6, 6, fx.PETAL);
    }
    run.snake.grow = 0;
    if (pts) NS.food.addScore(pts, fx.cx(body[0]), fx.cy(body[0]) - 20);
    sfx('whoosh');
  }

  function has(id) {
    return (G.run.act[id] || 0) > 0;
  }

  Object.assign(NS.powerups, {
    update, collect, activate, duration, has, molt, pickId
  });
})();
