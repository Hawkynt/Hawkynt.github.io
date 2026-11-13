/* The mission autosave: a mission in progress is stored every few seconds and whenever the window
   is hidden (sz-space-combat-mission) - which mission (campaign mission, endless wave, Daily or
   Boss Rush stage), its clock and objective counters, the outposts and data cores still to come
   (live ones go back into the queue), the convoy's or station's health, the boss's health, and
   the ship (position, hull, shield, ammunition) with the score, kills and scrap. Continue mission
   on the title rebuilds the mission and puts all of that back. A finished or abandoned mission
   clears it. Owns G.pendingBossHp. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const KEY = 'sz-space-combat-mission';
  let saveT = 0, resuming = false;

  function snapshot() {
    const st = G.stage, rt = st && st.rt, run = G.run, p = G.player;
    if (G.screen !== 'playing' && G.screen !== 'paused') return null;
    if (!st || !rt || !run || rt.done || rt.failed || !p || !p.alive) return null;
    const outQ = rt.outQueue.map(o => ({ x: o.x, at: Math.max(0, o.at - rt.t) }));
    for (const e of G.enemies) if (e.alive && e.objective) outQ.unshift({ x: e.homeX || e.x, at: 1 });
    const coreQ = rt.coreQueue.map(c => ({ x: c.x, at: Math.max(0, c.at - rt.t) }));
    for (const k of G.pickups) if (k.alive && k.type === 'core') coreQ.push({ x: k.x, at: 0.5 });
    return {
      v: 1, mode: run.mode, sector: run.sector, index: run.index, idx: run.idx || 0, wave: run.wave || 1, cleared: run.cleared || 0, time: run.time || 0,
      rt: { t: rt.t, wave: rt.wave, nextWave: rt.nextWave, timeLeft: rt.timeLeft, coresGot: rt.coresGot, outpostsLeft: rt.outpostsLeft, bossSpawned: rt.bossSpawned },
      outQ, coreQ, boss: G.boss && G.boss.alive ? G.boss.hp / G.boss.maxHp : null,
      allies: G.allies.map(a => ({ hp: a.hp / a.maxHp, travelled: a.travelled || 0, progress: a.progress || 0, y: a.y })),
      player: { x: p.x, y: p.y, hull: p.hull, shield: p.shield, ammo: p.ammo },
      score: G.score, kills: G.kills, scrap: G.runScrap, at: Date.now(),
    };
  }

  function save() {
    const s = snapshot();
    if (s) try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch (_) {}
  }
  function load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { s = null; }
    if (!s || s.v !== 1 || !s.rt || !s.player || ['campaign', 'endless', 'daily', 'bossRush'].indexOf(s.mode) < 0) return null;
    return s;
  }

  function update(dt) {
    if (G.screen !== 'playing' || G.hold) return;
    if ((saveT += dt) >= 4) { saveT = 0; save(); }
  }

  /* a new run or a finished mission forgets the stored one */
  function onRunStart() { if (!resuming) clear(); }
  function onFinish() { clear(); }

  function resume() {
    const s = load();
    if (!s) return false;
    const M = NS.missions, W = NS.waves;
    resuming = true;
    M.startRun(s.mode, s.mode === 'campaign' ? { sector: s.sector, index: s.index } : {});
    const run = G.run;
    if (s.mode === 'endless' && s.wave > 1) { run.wave = s.wave; M.startStage(W.endlessStage(s.wave)); }
    else if (run.stages && s.idx > 0 && run.stages[s.idx]) { run.idx = s.idx; M.startStage(run.stages[s.idx]); }
    resuming = false;
    run.cleared = s.cleared;
    run.time = s.time;
    const rt = G.stage.rt;
    Object.assign(rt, { t: s.rt.t, wave: s.rt.wave, nextWave: s.rt.nextWave, timeLeft: s.rt.timeLeft, coresGot: s.rt.coresGot,
      outpostsLeft: s.rt.outpostsLeft, bossSpawned: false });
    rt.outQueue = s.outQ.map(o => ({ x: o.x, at: rt.t + o.at }));
    rt.coreQueue = s.coreQ.map(c => ({ x: c.x, at: rt.t + c.at }));
    rt.lastOutpost = rt.t;
    if (s.rt.bossSpawned) { rt.bossDelay = 0.5; G.pendingBossHp = s.boss == null ? 1 : s.boss; }
    s.allies.forEach((q, i) => {
      const a = G.allies[i];
      if (!a) return;
      a.hp = a.maxHp * q.hp;
      if (a.type === 'freighter') { a.travelled = q.travelled; a.progress = q.progress; if (typeof q.y === 'number') a.y = q.y; }
    });
    const p = G.player;
    Object.assign(p, { x: s.player.x, y: s.player.y, hull: Math.min(p.maxHull, s.player.hull), shield: Math.min(p.maxShield, s.player.shield), ammo: Math.min(p.maxAmmo, s.player.ammo), iframes: 2 });
    G.score = s.score;
    G.kills = s.kills;
    G.runScrap = s.scrap;
    G.banner = { title: 'MISSION RESUMED', sub: G.stage.name, t: 0, life: 2.4, color: '#5cff9a' };
    NS.screens.setScreen('playing');
    return true;
  }

  /* a boss coming back after Continue keeps the health it had */
  function onBoss(b) {
    if (G.pendingBossHp != null && b) {
      b.hp = b.maxHp * Math.max(0.05, G.pendingBossHp);
      G.pendingBossHp = null;
    }
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    window.addEventListener('pagehide', save);
  }

  NS.checkpoint = { snapshot, save, clear, load, update, onRunStart, onFinish, resume, onBoss };
})();
