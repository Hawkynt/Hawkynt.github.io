/* The simulation tick of every run: derived stats refreshed when something changed, baking
   with buffs applied, buff timers, combo decay, Ghost Hands auto-clicks, recipe notes for
   each half order of magnitude baked, the treat's evolution to the next era, and the
   Bake-Off countdown. The classic bakery keeps baking while a Bake-Off runs. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const E = NS.economy;

  function env() {
    const s = G.profile.streak;
    return { streak: s.last === G.today ? s.count : 0, garden: NS.garden.effects(G.profile) };
  }

  function refresh(force) {
    if (!G.dirty && !force && G.st) return;
    G.stMain = E.compute(G.run, G.profile, env());
    G.st = G.bake ? E.compute(G.bake, G.profile, env()) : G.stMain;
    G.dirty = false;
  }

  function invalidate() {
    G.dirty = true;
  }

  function earn(run, amount) {
    if (!(amount > 0)) return;
    run.cookies += amount;
    run.baked += amount;
    if (run.mode === 'classic') G.profile.allTime += amount;
  }

  function cpsOf(run, st) {
    return st.cps * E.buffMult(run, 'prod');
  }

  function notesFor(run) {
    if (run.mode !== 'classic') return;
    const mark = E.noteMark(run.baked);
    if (mark <= run.noteMark) return;
    const p = G.profile;
    p.noteFrac += (mark - run.noteMark) * (1 + E.treeStat(p, 'notesGain'));
    run.noteMark = mark;
    const whole = Math.floor(p.noteFrac);
    if (whole > 0) {
      p.noteFrac -= whole;
      p.notes += whole;
      p.notesEarned += whole;
      if (NS.screens.toast) NS.screens.toast('+' + whole + ' recipe note' + (whole > 1 ? 's' : '') + ' for the tech tree', NS.constants.UI.notes, 'note');
    }
  }

  function runTick(run, st, dt, active) {
    run.time += dt;
    for (let i = run.buffs.length - 1; i >= 0; --i) {
      run.buffs[i].t -= dt;
      if (run.buffs[i].t <= 0) run.buffs.splice(i, 1);
    }
    earn(run, cpsOf(run, st) * dt);
    if (run.combo > 0) {
      run.comboTimer -= dt;
      if (run.comboTimer <= 0) run.combo = Math.max(0, run.combo - dt * (20 + run.combo));
    }
    notesFor(run);
    const s = E.stageFor(run.baked);
    if (s > run.stage) NS.progression.evolve(run, s);
    if (active && st.autoClick > 0 && G.screen === 'game') {
      run.autoAcc = (run.autoAcc || 0) + st.autoClick * dt;
      while (run.autoAcc >= 1) {
        run.autoAcc -= 1;
        NS.clicking.click(true);
      }
    }
  }

  function tick(dt) {
    refresh();
    const p = G.profile;
    p.stats.playSeconds += dt;
    runTick(G.run, G.stMain, dt, !G.bake);
    if (G.bake) {
      if (G.screen === 'game' && !G.cine) {
        runTick(G.bake, G.st, dt, true);
        G.bake.timeLeft -= dt;
        if (G.bake.timeLeft <= 0) NS.modes.finishBake();
      }
    } else {
      const c = cpsOf(G.run, G.st);
      if (c > p.stats.maxCps) p.stats.maxCps = c;
    }
  }

  Object.assign(NS.production, { env, refresh, invalidate, earn, cpsOf, notesFor, runTick, tick });
})();
