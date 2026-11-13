/* Ghost replays, Time Trial and the race autosave.
 * Ghosts: every race records the player's line (position and heading ten times a second); a race
 * faster than the stored ghost on that track and direction becomes the new ghost
 * (sz-space-racing-ghosts, one per track variant), and later races on it show the ghost as a
 * translucent ship marked BEST. Time Trial races alone against the ghost.
 * Autosave: a race in progress is stored every few seconds and when the window is hidden
 * (sz-space-racing-race); Continue on the title puts every ship back where it was, with the laps,
 * the clock and the boost meter. A finished or new race clears it.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const GHOSTS = 'sz-space-racing-ghosts';
  const RACE = 'sz-space-racing-race';
  const STEP = 0.1;
  const MAX_GHOSTS = 24;

  let rec = [], recAt = 0, ghost = null, saveT = 0, resuming = false;

  function readGhosts() {
    try { return JSON.parse(localStorage.getItem(GHOSTS) || '{}') || {}; } catch (_) { return {}; }
  }
  function writeGhosts(all) {
    const keys = Object.keys(all);
    if (keys.length > MAX_GHOSTS) {
      keys.sort((a, b) => (all[a].at || 0) - (all[b].at || 0));
      for (const k of keys.slice(0, keys.length - MAX_GHOSTS)) delete all[k];
    }
    try { localStorage.setItem(GHOSTS, JSON.stringify(all)); } catch (_) {}
  }
  function ghostFor(key) {
    const g = readGhosts()[key];
    return g && Array.isArray(g.p) && g.p.length >= 6 && g.time > 0 ? g : null;
  }

  /* a new race: start recording and load this track's ghost */
  function onRaceStart() {
    rec = [];
    recAt = 0;
    ghost = G.currentVariant ? ghostFor(G.currentVariant.key) : null;
    if (G.timeTrial) {
      G.opponents = [];
      G.aiWormholeCooldowns = [];
    }
    if (!resuming) clearRace();
  }

  function update(dt) {
    if (G.state !== 'PLAYING' || !G.raceStarted || G.raceFinished || !G.ship) return;
    while (recAt <= G.raceTime) {
      rec.push(Math.round(G.ship.x), Math.round(G.ship.y), Math.round(G.ship.angle * 100));
      recAt += STEP;
    }
    if ((saveT += dt) >= 3) { saveT = 0; saveRace(); }
  }

  /* the finish: a faster run replaces the ghost */
  function onFinish() {
    clearRace();
    if (!G.currentVariant || G.raceTime <= 0 || rec.length < 6) return false;
    const all = readGhosts(), key = G.currentVariant.key, old = all[key];
    if (old && old.time <= G.raceTime) return false;
    all[key] = { time: Math.round(G.raceTime * 1000) / 1000, p: rec.slice(), at: Date.now() };
    writeGhosts(all);
    return true;
  }

  /* where the ghost is at the race clock: interpolated between samples */
  function ghostPose() {
    if (!ghost || !G.raceStarted) return null;
    const f = Math.min(G.raceTime, ghost.time) / STEP, i = Math.floor(f), n = ghost.p.length / 3;
    if (i >= n - 1) { const j = (n - 1) * 3; return { x: ghost.p[j], y: ghost.p[j + 1], angle: ghost.p[j + 2] / 100 }; }
    const k = f - i, a = i * 3, b = a + 3, P = ghost.p;
    let da = P[b + 2] - P[a + 2];
    if (da > 314) da -= 628; else if (da < -314) da += 628;
    return { x: P[a] + (P[b] - P[a]) * k, y: P[a + 1] + (P[b + 1] - P[a + 1]) * k, angle: (P[a + 2] + da * k) / 100 };
  }
  function ghostTime() { return ghost ? ghost.time : 0; }

  /* ── the race autosave ── */
  function snapshot() {
    if (G.state !== 'PLAYING' || !G.raceStarted || G.raceFinished || !G.ship || !G.currentVariant) return null;
    const s = G.ship;
    return {
      v: 1, track: G.currentTrackIndex, reverse: !!G.currentVariant.reverse, cup: G.raceCup, timeTrial: !!G.timeTrial,
      daily: G.dailyRace || null, raceTime: G.raceTime, playerLap: G.playerLap, lastLapStamp: G.lastLapStamp, boost: G.boostMeter,
      ship: { x: s.x, y: s.y, angle: s.angle, vx: s.vx, vy: s.vy, speed: s.speed, laps: s.ts ? s.ts.lapsDone : 0, dist: s.ts ? s.ts.dist : 0 },
      ai: G.opponents.map(a => ({ name: a.name, x: a.x, y: a.y, angle: a.angle, vx: a.vx, vy: a.vy, speed: a.speed, lap: a.lap,
        finished: a.finished, finishTime: a.finishTime, laps: a.ts ? a.ts.lapsDone : 0, dist: a.ts ? a.ts.dist : 0 })),
      rec: rec.slice(), at: Date.now(),
    };
  }
  function saveRace() {
    const s = snapshot();
    if (s) try { localStorage.setItem(RACE, JSON.stringify(s)); } catch (_) {}
  }
  function clearRace() {
    try { localStorage.removeItem(RACE); } catch (_) {}
  }
  function savedRace() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(RACE) || 'null'); } catch (_) { s = null; }
    const D = NS.defs;
    if (!s || s.v !== 1 || !(s.track >= 0 && s.track < D.TRACKS.length) || !(s.raceTime >= 0) || !s.ship || !Array.isArray(s.ai)) return null;
    return s;
  }

  function resumeRace() {
    const s = savedRace();
    if (!s) return false;
    const D = NS.defs;
    G.currentTrackIndex = s.track;
    G.currentVariant = D.trackVariant(s.track, s.reverse);
    G.raceCup = s.cup === null || s.cup === undefined ? null : s.cup;
    G.timeTrial = !!s.timeTrial;
    G.dailyRace = s.daily || null;
    resuming = true;
    NS.raceSetup.resetGame();
    resuming = false;
    const T = NS.track;
    G.countdown = 0;
    G.raceStarted = true;
    G.raceTime = s.raceTime;
    G.playerLap = s.playerLap | 0;
    G.lastLapStamp = s.lastLapStamp || 0;
    G.boostMeter = s.boost || 0;
    const sh = G.ship;
    Object.assign(sh, { x: s.ship.x, y: s.ship.y, angle: s.ship.angle, vx: s.ship.vx, vy: s.ship.vy, speed: s.ship.speed });
    sh.ts = T.trackStateAt(sh.x, sh.y);
    sh.ts.lapsDone = s.ship.laps | 0;
    sh.ts.dist = s.ship.dist;
    G.opponents = G.opponents.slice(0, s.ai.length);
    s.ai.forEach((q, i) => {
      const a = G.opponents[i];
      if (!a) return;
      const pers = D.AI_PERSONALITIES.find(p => p.name === q.name);
      if (pers) Object.assign(a, { personality: pers, name: pers.name, color: pers.color, accentColor: pers.accentColor, exhaustColor: pers.exhaustColor, shape: pers.shape });
      Object.assign(a, { x: q.x, y: q.y, angle: q.angle, vx: q.vx, vy: q.vy, speed: q.speed, lap: q.lap, finished: !!q.finished, finishTime: q.finishTime || 0, reactionTimer: 0 });
      a.ts = T.trackStateAt(a.x, a.y);
      a.ts.lapsDone = q.laps | 0;
      a.ts.dist = q.dist;
    });
    G.aiWormholeCooldowns = G.opponents.map(() => 0);
    rec = Array.isArray(s.rec) ? s.rec.slice() : [];
    recAt = rec.length / 3 * STEP;
    return true;
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveRace(); });
    window.addEventListener('pagehide', saveRace);
  }

  Object.assign(NS.module('replay'), { onRaceStart, update, onFinish, ghostPose, ghostTime, ghostFor, savedRace, saveRace, clearRace, resumeRace });
})();
