/* Golden treats: the spawn timer (charms, tech and daily modifiers make them more frequent),
   the floating golden cookie or this season's carrier (snowflake, egg, sun, leaf, pumpkin,
   present - those also drop a season token), catching one, the weighted outcomes (Lucky,
   Frenzy, Click Frenzy, Building Rush, Sugar Rush, Cookie Storm, Combo Blast) and the Cookie
   Storm's pooled falling drops. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const C = NS.constants;
  const E = NS.economy;
  const { OUTCOMES, CARRIERS } = NS.eventData;
  const { BUILDINGS } = NS.buildingData;
  const fmt = NS.format;
  const { sfx } = NS.audio;

  const DROPS = [];
  for (let i = 0; i < 48; ++i) DROPS.push({ on: false, x: 0, y: 0, vy: 0, rot: 0, vr: 0 });

  function nextDelay(st) {
    return (C.GOLDEN_MIN + Math.random() * (C.GOLDEN_MAX - C.GOLDEN_MIN)) / st.goldenFreq;
  }

  function spawn(forceKind) {
    const seasonal = forceKind ? forceKind !== 'golden' : Math.random() < 0.35;
    const carrier = seasonal ? CARRIERS[G.season] || CARRIERS.none : CARRIERS.none;
    G.goldens.push({
      x: 70 + Math.random() * 780, y: 130 + Math.random() * 500, age: 0, life: G.st.goldenLife,
      carrier: carrier.id, seasonal: seasonal && !!carrier.token, phase: Math.random() * 6,
    });
    sfx('coin', { pitch: 0.7, volume: 0.35 });
  }

  function update(dt) {
    const run = G.active();
    if (G.screen === 'game' && !G.cine && !G.st.noGolden) {
      run.goldenTimer -= dt;
      if (run.goldenTimer <= 0) {
        run.goldenTimer = nextDelay(G.st);
        spawn();
        if (Math.random() < E.treeStat(G.profile, 'goldenTwin')) spawn();
      }
    }
    for (let i = G.goldens.length - 1; i >= 0; --i) {
      const g = G.goldens[i];
      g.age += dt;
      if (g.age >= g.life) G.goldens.splice(i, 1);
    }
    if (G.storm) {
      G.storm.t -= dt;
      G.storm.acc += dt * 9;
      while (G.storm.t > 0 && G.storm.acc >= 1) {
        G.storm.acc -= 1;
        for (let k = 0; k < DROPS.length; ++k) {
          const d = DROPS[k];
          if (d.on) continue;
          d.on = true; d.x = 40 + Math.random() * 840; d.y = -30; d.vy = 140 + Math.random() * 120;
          d.rot = Math.random() * 6; d.vr = (Math.random() - 0.5) * 4;
          break;
        }
      }
      let any = false;
      for (let k = 0; k < DROPS.length; ++k) {
        const d = DROPS[k];
        if (!d.on) continue;
        any = true;
        d.y += d.vy * dt;
        d.rot += d.vr * dt;
        if (d.y > C.VIEW_H + 40) d.on = false;
      }
      if (G.storm.t <= 0 && !any) {
        if (G.storm.caught > G.profile.stats.stormBest) G.profile.stats.stormBest = G.storm.caught;
        G.storm = null;
      }
    }
  }

  function pickOutcome(run) {
    let total = 0;
    for (let i = 0; i < OUTCOMES.length; ++i) total += OUTCOMES[i].weight;
    let r = Math.random() * total;
    for (let i = 0; i < OUTCOMES.length; ++i) {
      r -= OUTCOMES[i].weight;
      if (r <= 0) {
        const o = OUTCOMES[i];
        if (o.id === 'sugar' && run.mode !== 'classic') return OUTCOMES[0];
        if (o.id === 'rush' && !rushTarget(run)) return OUTCOMES[1];
        return o;
      }
    }
    return OUTCOMES[0];
  }

  function rushTarget(run) {
    const owned = BUILDINGS.filter(b => run.buildings[b.id] > 0);
    return owned.length ? owned[Math.floor(Math.random() * owned.length)] : null;
  }

  function addBuff(run, id, name, kind, mult, dur, color) {
    for (let i = 0; i < run.buffs.length; ++i)
      if (run.buffs[i].id === id) {
        run.buffs[i].t = Math.max(run.buffs[i].t, dur);
        run.buffs[i].dur = dur;
        run.buffs[i].mult = mult;
        return;
      }
    run.buffs.push({ id: id, name: name, kind: kind, mult: mult, t: dur, dur: dur, color: color });
    const p = G.profile.stats;
    if (run.buffs.length > p.buffsAtOnce) p.buffsAtOnce = run.buffs.length;
  }

  function apply(run, o, x, y) {
    const st = G.st;
    const cps = st.cps;
    let label = o.name;
    if (o.id === 'lucky') {
      const gain = Math.max(13, Math.min(run.cookies * 0.15, cps * 900)) * st.luckyMul + st.click * 20;
      NS.production.earn(run, gain);
      label = 'Lucky! +' + fmt.short(gain);
      NS.fx.burst(x, y, 30, ['#ffd25a', '#fff4b0', '#e8a62a'], 'coins', 380);
    } else if (o.id === 'frenzy' || o.id === 'clickfrenzy') {
      addBuff(run, o.id, o.name, o.buff.kind, o.buff.mult, o.buff.dur * st.goldenDur, o.color);
      label = o.name + '! ' + o.desc;
    } else if (o.id === 'rush') {
      const b = rushTarget(run);
      const mult = 1 + run.buildings[b.id] * 0.1;
      addBuff(run, 'rush-' + b.id, b.name + ' Rush', 'prod', mult, o.buff.dur * st.goldenDur, o.color);
      label = b.name + ' Rush! Production x' + (Math.round(mult * 10) / 10);
    } else if (o.id === 'sugar') {
      const n = 1 + Math.floor(Math.random() * 3);
      G.profile.notes += n;
      G.profile.notesEarned += n;
      label = 'Sugar Rush! +' + n + ' recipe notes';
    } else if (o.id === 'storm') {
      G.storm = { t: o.storm, acc: 0, caught: 0 };
      label = 'Cookie Storm! Catch the falling treats';
    } else if (o.id === 'comboblast') {
      run.combo = st.comboCap;
      run.comboTimer = st.comboWindow * 3;
      run.bestCombo = Math.max(run.bestCombo, run.combo);
      label = 'Combo Blast! Combo x' + st.comboCap;
    }
    NS.fx.text(x, y - 30, label, o.color, 26, 2.2);
    NS.screens.toast(label, o.color, 'golden');
  }

  function catchGolden(i) {
    const g = G.goldens[i];
    G.goldens.splice(i, 1);
    const run = G.active();
    const p = G.profile;
    ++run.golden;
    ++p.stats.golden;
    const o = pickOutcome(run);
    NS.fx.ring(g.x, g.y, 20, 140, 0.6, o.color, 5);
    NS.fx.burst(g.x, g.y, 24, ['#fff4b0', '#ffd25a', o.color], 'stars', 320, 200);
    NS.fx.flash(0.25, '#fff0c0');
    NS.fx.shake(6);
    NS.fx.stop(0.05);
    sfx('powerup');
    apply(run, o, g.x, g.y);
    if (g.seasonal) NS.progression.addToken(1, g.x, g.y);
    if (Math.random() < E.treeStat(p, 'goldenNotes') && run.mode === 'classic') {
      ++p.notes;
      ++p.notesEarned;
      NS.fx.text(g.x, g.y + 26, '+1 recipe note', C.UI.notes, 18, 1.6);
    }
    NS.progression.quest('golden', 1);
    NS.production.invalidate();
  }

  /* returns true when the pointer caught a golden treat or a storm drop */
  function tryClick(x, y) {
    for (let i = G.goldens.length - 1; i >= 0; --i) {
      const g = G.goldens[i];
      const dx = x - g.x, dy = y - g.y;
      if (dx * dx + dy * dy < 44 * 44) {
        catchGolden(i);
        return true;
      }
    }
    if (G.storm) {
      for (let k = 0; k < DROPS.length; ++k) {
        const d = DROPS[k];
        if (!d.on) continue;
        const dx = x - d.x, dy = y - d.y;
        if (dx * dx + dy * dy < 34 * 34) {
          d.on = false;
          const run = G.active();
          const gain = G.st.cps * 5 + G.st.click * 3 + 7;
          NS.production.earn(run, gain);
          ++G.storm.caught;
          NS.fx.burst(d.x, d.y, 8, ['#ffd25a', '#c8884a'], 'crumbs', 200);
          NS.fx.text(d.x, d.y - 10, '+' + fmt.short(gain), C.UI.gold, 20);
          sfx('pickup', { pitch: 1 + G.storm.caught * 0.02, volume: 0.5 });
          return true;
        }
      }
    }
    return false;
  }

  function clearAll() {
    G.goldens.length = 0;
    G.storm = null;
    for (let k = 0; k < DROPS.length; ++k) DROPS[k].on = false;
  }

  Object.assign(NS.golden, { DROPS, nextDelay, spawn, update, pickOutcome, addBuff, apply, catchGolden, tryClick, clearAll });
})();
