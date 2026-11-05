/* Power-up effects: switching one on (timed ones stack their time, instant ones act at once:
   Boo Bomb's blast and the Extra Heart), the announcement banner, ticking the timers down with
   a warning near the end, the Decoy's lure and what each timed effect does on expiry. Owns
   G.run.lvl.effects and the decoy. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { POWERUP_BY_ID } = NS.items;
  const grid = NS.grid;
  const FX = NS.fx;
  const R = NS.rules;
  const { sfx } = NS.audio;

  function activate(id, quiet) {
    const run = G.run;
    if (!run || !run.lvl) return;
    const lvl = run.lvl;
    const def = POWERUP_BY_ID[id];
    if (!def) return;
    const pac = lvl.pac;
    const x = grid.px(pac.x), y = grid.py(pac.y);
    if (!run.demo) {
      G.profile.used[id] = true;
      ++run.tally.powerups;
      R.bump(G.profile, 'powerups', 1);
    }
    if (!quiet) {
      G.ui.banners.unshift({ text: def.name, sub: def.desc, color: def.color, icon: id, t: 0 });
      if (G.ui.banners.length > 2) G.ui.banners.length = 2;
      FX.ring(x, y, 10, 110, 0.5, def.color, 5);
      FX.burst(x, y, 22, def.color, 240, 0.6, 5, 0);
      sfx('powerup', { pitch: 1.1 });
    }
    switch (id) {
      case 'life':
        if (run.mode !== 'zen') ++run.lives;
        FX.floater(x, y - 28, '+1 LIFE', '#ff4a6a', 22, 1.4);
        return;
      case 'bomb':
        bomb(run, x, y);
        return;
      case 'decoy':
        lvl.decoy = { x: pac.x, y: pac.y, face: pac.face, t: 0 };
        break;
      case 'mega':
        NS.ghosts.frighten(run);
        lvl.frightT = Math.max(lvl.frightT, def.dur * G.stats.powerDur);
        break;
      case 'freeze':
        for (let i = 0; i < lvl.ghosts.length; ++i) lvl.ghosts[i].flash = 0.3;
        sfx('zap', { pitch: 0.5 });
        break;
    }
    const dur = def.dur * G.stats.powerDur;
    lvl.effects[id] = (lvl.effects[id] > 0 ? lvl.effects[id] : 0) + dur;
  }

  function bomb(run, x, y) {
    const lvl = run.lvl;
    const pac = lvl.pac;
    FX.ring(x, y, 10, 200, 0.6, '#ff3b6a', 10);
    FX.ring(x, y, 10, 150, 0.45, '#ffffff', 4);
    FX.burst(x, y, 60, '#ff7a4a', 420, 0.8, 8, 0);
    FX.chunks(x, y, 20, '#ffd23a', 380);
    FX.addShake(14);
    FX.flash('#ff7a4a', 0.45);
    sfx('explode');
    for (let i = 0; i < lvl.ghosts.length; ++i) {
      const g = lvl.ghosts[i];
      if (g.mode !== 'out') continue;
      if (grid.dist2(pac.x, pac.y, g.x, g.y) > 49) continue;
      NS.level.addScore(run, 100, grid.px(g.x), grid.py(g.y), '#ff7a4a', 16);
      FX.burst(grid.px(g.x), grid.py(g.y), 16, g.color, 220, 0.5, 5, 0);
      NS.ghosts.sendHome(g);
    }
    if (lvl.boss) NS.boss.blast(run, pac.x, pac.y);
  }

  function update(run, dt) {
    const lvl = run.lvl;
    const fx = lvl.effects;
    for (const id in fx) {
      if (!(fx[id] > 0)) continue;
      const before = fx[id];
      fx[id] -= dt;
      if (before > 1.5 && fx[id] <= 1.5) sfx('blip', { pitch: 0.5, volume: 0.3 });
      if (fx[id] <= 0) {
        fx[id] = 0;
        expire(run, id);
      }
    }
    if (lvl.decoy) lvl.decoy.t += dt;
  }

  function expire(run, id) {
    const lvl = run.lvl;
    if (id === 'decoy' && lvl.decoy) {
      FX.burst(grid.px(lvl.decoy.x), grid.py(lvl.decoy.y), 16, '#ffeb9a', 200, 0.5, 5, 0);
      lvl.decoy = null;
    }
  }

  function has(id) {
    return !!(G.run && G.run.lvl && G.run.lvl.effects[id] > 0);
  }

  /* the active effects, longest first, for the HUD */
  function active(lvl) {
    const out = [];
    for (const id in lvl.effects) if (lvl.effects[id] > 0 && POWERUP_BY_ID[id]) out.push({ id: id, t: lvl.effects[id], max: POWERUP_BY_ID[id].dur * G.stats.powerDur });
    out.sort((a, b) => b.t - a.t);
    return out;
  }

  Object.assign(NS.powerups, {
    activate, update, has, active
  });
})();
