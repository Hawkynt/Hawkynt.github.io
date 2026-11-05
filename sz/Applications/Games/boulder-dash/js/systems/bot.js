/* The autopilot: picks the miner's next step by breadth-first search over cells that are safe
   to dig (the solver's test) and clear of creatures, falling objects and lit dynamite, heading
   for the nearest gem or power-up, then the open exit. In boss arenas it fetches dynamite, baits
   the boss and drops a stick in its path. Plays the title screen's demo cave and, in the tests,
   proves every story cave can be finished. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const S = NS.solver;

  function bossDist(cv, r, c) {
    const b = cv.boss;
    const dr = r < b.r ? b.r - r : r > b.r + 1 ? r - b.r - 1 : 0;
    const dc = c < b.c ? b.c - c : c > b.c + 1 ? c - b.c - 1 : 0;
    return dr + dc;
  }

  /* nearest chaser: the boss footprint or a mole */
  function threatDist(cv, r, c) {
    let best = cv.boss && !cv.bossDefeated ? bossDist(cv, r, c) : 99;
    const { w, cells } = cv;
    for (let i = 0; i < cells.length; ++i)
      if (cells[i] === C.MOLE) best = Math.min(best, Math.abs(((i / w) | 0) - r) + Math.abs(i % w - c));
    return best;
  }

  /* drop a stick where we stand and run clear of the blast */
  function bombAndRun(cv, out) {
    const p = cv.player, w = cv.w;
    out.bomb = true;
    const bd = dangerNow(cv);
    const rad = (cv.perks && cv.perks.blast) ? 2 : 1;
    const br = p.r, bc = p.c;
    const clear = (i) => Math.abs(((i / w) | 0) - br) > rad || Math.abs(i % w - bc) > rad;
    out.dir = route(cv, bd, (i) => clear(i) && !bd[i], false);
    if (out.dir < 0) out.dir = route(cv, bd, clear, true);
    return out;
  }

  function dangerNow(cv, skipCreatures) {
    const { w, h, cells } = cv;
    const n = cells.length;
    const danger = new Uint8Array(n);
    const mark = (r0, c0, rad, manhattan) => {
      for (let r = Math.max(0, r0 - rad); r <= Math.min(h - 1, r0 + rad); ++r)
        for (let c = Math.max(0, c0 - rad); c <= Math.min(w - 1, c0 + rad); ++c)
          if (!manhattan || Math.abs(r - r0) + Math.abs(c - c0) <= rad) danger[r * w + c] = 1;
    };
    for (let i = 0; i < n; ++i) {
      const t = cells[i];
      if (C.CREATURE[t] && !cv.frozen) mark((i / w) | 0, i % w, skipCreatures ? 2 : t === C.MOLE ? 2 : 3, true);
      if (C.FALLS[t] && cv.fall[i])
        for (let j = i + w; j < n && (cells[j] === C.EMPTY || cells[j] === C.PLAYER); j += w) danger[j] = 1;
      if (t === C.EXPLODE) danger[i] = 1;
    }
    for (let k = 0; k < cv.bombs.length; ++k) {
      const b = cv.bombs[k];
      mark((b.i / w) | 0, b.i % w, b.rad || 1, false);
    }
    if (cv.boss && !cv.bossDefeated) {
      const b = cv.boss;
      for (let r = b.r - 3; r <= b.r + 4; ++r)
        for (let c = b.c - 3; c <= b.c + 4; ++c)
          if (r > 0 && c > 0 && r < h - 1 && c < w - 1 && bossDist(cv, r, c) <= 2) danger[r * w + c] = 1;
    }
    return danger;
  }

  /* BFS from the miner; isGoal(i) picks targets; returns the first direction or -1 */
  function route(cv, danger, isGoal, relaxed) {
    const { w, cells } = cv;
    const p = cv.player;
    const start = p.r * w + p.c;
    const prev = new Int32Array(cells.length).fill(-1);
    prev[start] = start;
    const queue = [start];
    const drill = p.pow.drill > 0;
    for (let q = 0; q < queue.length; ++q) {
      const i = queue[q];
      if (i !== start && isGoal(i)) {
        let j = i;
        while (prev[j] !== start) j = prev[j];
        const dd = j - start;
        return dd === -w ? 0 : dd === 1 ? 1 : dd === w ? 2 : 3;
      }
      for (let d = 0; d < 4; ++d) {
        const k = i + C.DX[d] + C.DY[d] * w;
        if (prev[k] !== -1 || danger[k]) continue;
        const t = cells[k];
        const exitOk = t === C.EXIT && cv.exitOpen;
        const brickOk = t === C.BRICK && drill;
        if (!exitOk && !brickOk) {
          if (!S.STEPPABLE[t]) continue;
          if (!relaxed && !S.isSafeCell(cv, k)) continue;
          if (relaxed && ((C.FALLS[cells[k - w]] && t !== C.EMPTY) || S.isRolling(cv, k - 1) || S.isRolling(cv, k + 1) ||
            S.isRolling(cv, k - w - 1) || S.isRolling(cv, k - w + 1))) continue;
        }
        prev[k] = i;
        if (!exitOk) queue.push(k);
        else if (isGoal(k)) queue.push(k);
      }
    }
    return -1;
  }

  /* step away from danger: the free neighbour farthest from creatures */
  function flee(cv, danger) {
    const { w, cells } = cv;
    const p = cv.player;
    const start = p.r * w + p.c;
    let best = -1, bestScore = -1;
    for (let d = 0; d < 4; ++d) {
      const k = start + C.DX[d] + C.DY[d] * w;
      const t = cells[k];
      if (t !== C.EMPTY && t !== C.DIRT && t !== C.GEM && t !== C.ITEM && t !== C.BIGGEM) continue;
      if (C.FALLS[cells[k - w]] && t !== C.EMPTY) continue;
      const score = danger[k] ? 0 : 1;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best;
  }

  /* creatures drift away again: wait a few seconds before taking a riskier way round */
  function patience(cv) {
    cv.botWait = (cv.botWait || 0) + 1;
    return cv.botWait > 300;
  }

  function decide(cv) {
    const p = cv.player;
    const out = { dir: -1, bomb: false };
    if (!p || !p.alive || cv.won) return out;
    const { w, cells } = cv;
    const danger = dangerNow(cv);
    const here = p.r * w + p.c;
    const isItem = (i) => cells[i] === C.ITEM;
    const isGem = (i) => cells[i] === C.GEM || cells[i] === C.BIGGEM;

    /* keep to the cells the cave's safety analysis proved harmless (they never wake a creature
       pocket or loosen a boulder), then away from whole creature pockets */
    if (!cv.botPlan) {
      const plan = new Uint8Array(cells.length);
      const reached = S.analyse(cv).reached;
      for (let q = 0; q < reached.length; ++q) plan[reached[q]] = 1;
      plan[cv.exitR * w + cv.exitC] = 1;
      cv.botPlan = plan;
    }
    /* on proven cells a sealed creature can never reach the miner: only falling things matter */
    const avoid = cv.boss ? S.dangerMap(cv, 2) : new Uint8Array(cells.length);
    const near = cv.boss ? danger : dangerNow(cv, true);
    for (let i = 0; i < avoid.length; ++i) avoid[i] |= near[i] | (cv.boss ? 0 : 1 - cv.botPlan[i]);
    avoid[here] = 0;
    if (cv.exitOpen) {
      const exit = cv.exitR * w + cv.exitC;
      out.dir = route(cv, avoid, (i) => i === exit, false);
      if (out.dir >= 0) cv.botWait = 0;
      else if (patience(cv)) {
        out.dir = route(cv, danger, (i) => i === exit, false);
        if (out.dir < 0) out.dir = route(cv, danger, (i) => i === exit, true);
      }
    } else if (cv.boss && !cv.bossDefeated) {
      if (p.bombs > 0 && !cv.bombs.length && threatDist(cv, p.r, p.c) <= 4) return bombAndRun(cv, out);
      const bait = (i) => {
        const dd = bossDist(cv, (i / w) | 0, i % w);
        return dd >= 3 && dd <= 4;
      };
      if (p.bombs > 0 && !cv.bombs.length) {
        out.dir = route(cv, danger, bait, false);
        if (out.dir < 0) out.dir = route(cv, danger, bait, true);
      }
      else out.dir = route(cv, danger, (i) => isItem(i) && cv.item[i] === 1, false);
      if (out.dir < 0) out.dir = route(cv, danger, (i) => isItem(i) || isGem(i), true);
    } else {
      if (p.bombs > 0 && !cv.bombs.length && threatDist(cv, p.r, p.c) <= 3) return bombAndRun(cv, out);
      out.dir = route(cv, avoid, (i) => isGem(i) || isItem(i), false);
      if (out.dir >= 0) cv.botWait = 0;
      else if (patience(cv)) {
        out.dir = route(cv, danger, (i) => isGem(i) || isItem(i), false);
        if (out.dir < 0) out.dir = route(cv, danger, isGem, true);
      }
    }
    if (danger[here] && out.dir < 0) out.dir = flee(cv, danger);
    return out;
  }

  Object.assign(NS.bot, { decide, dangerNow, route });
})();
