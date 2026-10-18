/* Undo, hints, element selection and casting: the cast pose, the spell orb, impact rings and the
   tile-by-tile visual reaction. Owns G.pendingCast/projectiles/rings/tileFx/slide/spells. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { T, CAST_TIME, BURN_STEP_DELAY, SLIDE_STEP_TIME, SPELL_TIME, HINT_TIME, HINT_BANNER_TIME, PROJECTILE_TIME,
    RING_TIME, MAX_RINGS, ELEMENT_BY_ID, ELEMENT_PITCH, STATE_PLAYING, STATE_OUT_OF_MANA, isMenuState, DIRS,
    REALM_DUST, REALM_ROCK } = NS.consts;
  const { sfx, screenShake, floatingText, Fx, fxBoard } = NS.context;
  const { colOf, rowOf, tileCenterX, tileCenterY, toViewX, toViewY } = NS.view;
  const { invalidateCaches, neighbours4 } = NS.rules;
  const { treeLevel } = NS.grimoire;
  const { realmElements } = NS.session;
  const { startWalk, gemX, gemY } = NS.world;

  function undoCast() {
    if (!G.history.length || G.pendingCast || G.winSeq || G.projectiles.length)
      return;
    if (G.undosLeft <= 0) {
      sfx('error', { volume: 0.4 });
      return;
    }
    --G.undosLeft;
    G.puzzle = G.history.pop();
    G.mana += G.historyCosts.pop();
    --G.casts;
    invalidateCaches();
    G.walk = { from: G.puzzle.hero, path: [], t: 0, onDone: null };
    G.hero.x = tileCenterX(G.puzzle.hero);
    G.hero.y = tileCenterY(G.puzzle.hero);
    G.hero.pose = 'idle';
    G.hero.scale = 1;
    G.hero.alpha = 1;
    G.tileFx = [];
    G.slide = null;
    if (G.state === STATE_OUT_OF_MANA)
      G.state = STATE_PLAYING;
    sfx('click', { pitch: 0.8 });
  }

  function showHint() {
    if (G.state !== STATE_PLAYING || G.pendingCast || G.winSeq)
      return;
    if (G.hintsLeft <= 0) {
      sfx('error', { volume: 0.4 });
      return;
    }
    const action = SZ.PuzzleCore.hint(G.puzzle);
    if (!action && !G.level.hint) {
      sfx('error', { volume: 0.4 });
      return;
    }
    /* the solver's highlight and the level's own hint strip come up together */
    --G.hintsLeft;
    if (action)
      G.hintFx = { action: action, t: HINT_TIME };
    if (G.level.hint)
      G.hintBanner = { text: G.level.hint, t: HINT_BANNER_TIME };
    sfx('blip', { pitch: 1.5 });
  }

  function selectElement(elemId) {
    if (G.selectedElement === elemId)
      return;
    if (realmElements().indexOf(elemId) < 0) {
      sfx('error', { volume: 0.4 });
      return;
    }
    G.selectedElement = elemId;
    G.elementBounce = { id: elemId, at: G.time };
    /* the mage briefly breathes out the new element's colour */
    if (!isMenuState(G.state) && !G.winSeq)
      for (let k = 0; k < 14; ++k) {
        const a = k / 14 * Math.PI * 2;
        fxBoard.spawn({ kind: 'spark', color: ELEMENT_BY_ID[elemId].color, x: G.hero.x + Math.cos(a) * 18, y: G.hero.y + 10 + Math.sin(a) * 8, vx: Math.cos(a) * 10, vy: -60 - Math.random() * 40, drag: 1.5, life: 0.7, size: 8, size1: 1 });
      }
    sfx('select', { pitch: ELEMENT_PITCH[elemId] });
  }
  function beginCast(action, standIdx, faceDir) {
    G.pendingCast = { action: action, standIdx: standIdx, faceDir: faceDir, phase: 'walk', timer: 0 };
    if (standIdx === G.puzzle.hero) {
      G.pendingCast.phase = 'cast';
      G.hero.dir = faceDir;
      G.hero.pose = 'cast';
      G.hero.t = 0;
    } else {
      startWalk(standIdx, function() {
        if (!G.pendingCast)
          return;
        G.pendingCast.phase = 'cast';
        G.hero.dir = faceDir;
        G.hero.pose = 'cast';
        G.hero.t = 0;
      });
    }
  }

  function updatePendingCast(dt) {
    if (!G.pendingCast || G.pendingCast.phase !== 'cast')
      return;
    G.pendingCast.timer += dt;
    G.hero.pose = 'cast';
    if (G.pendingCast.timer >= CAST_TIME) {
      const action = G.pendingCast.action;
      G.pendingCast = null;
      G.hero.pose = 'idle';
      doCast(action);
    }
  }

  function doCast(action) {
    const prev = G.puzzle;
    const next = SZ.PuzzleCore.applyAction(G.puzzle, action);
    if (!next)
      return;
    /* Focus: the first cast of each puzzle does not drink mana */
    const cost = G.casts === 0 && treeLevel('a_focus') > 0 ? 0 : 1;
    G.history.push(prev);
    G.historyCosts.push(cost);
    G.puzzle = next;
    invalidateCaches();
    G.mana -= cost;
    ++G.casts;
    ++G.save.stats.casts;
    /* the rules are applied at once; the visuals wait for the orb to land */
    let changed = 0;
    for (let i = 0; i < next.tiles.length; ++i)
      if (prev.tiles[i] !== next.tiles[i])
        ++changed;
    G.projectiles.push({
      x0: gemX(), y0: gemY(),
      x1: tileCenterX(action.index), y1: tileCenterY(action.index),
      t: 0, dur: PROJECTILE_TIME, color: ELEMENT_BY_ID[action.element].color,
      prev: prev, next: next, action: action, changed: changed
    });
    sfx('whoosh', { volume: 0.3 });
    NS.screens.updateStatusBar();
    if (SZ.PuzzleCore.isSolved(G.puzzle))
      NS.win.startWin();
    else if (G.mana <= 0) {
      G.state = STATE_OUT_OF_MANA;
      sfx('lose');
    }
  }

  function pushRing(x, y, r0, r1, color, lw, dur) {
    G.rings.push({ x: x, y: y, t: 0, dur: dur || RING_TIME, r0: r0, r1: r1, color: color, lw: lw || 3 });
    if (G.rings.length > MAX_RINGS)
      G.rings.shift();
  }

  function updateProjectiles(dt) {
    if (!G.projectiles.length)
      return;
    for (const pr of G.projectiles) {
      pr.t += dt;
      const k = Math.min(1, pr.t / pr.dur);
      const x = pr.x0 + (pr.x1 - pr.x0) * k, y = pr.y0 + (pr.y1 - pr.y0) * k;
      /* a short comet tail in the element colour, with a few white sparks */
      fxBoard.spawn({ kind: 'spark', color: pr.color, x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6, vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30, life: 0.35, size: 12, size1: 2 });
      fxBoard.spawn({ kind: 'glow', color: pr.color, x: x, y: y, life: 0.25, size: 22, size1: 6, alpha: 0.6 });
      if (Math.random() < 0.6)
        fxBoard.spawn({ kind: 'spark', color: '#ffffff', x: x, y: y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, drag: 3, life: 0.4, size: 6, size1: 1 });
      if (pr.t >= pr.dur) {
        pushRing(pr.x1, pr.y1, 8, 46, pr.color, 3);
        screenShake.trigger(2 + Math.min(2, (pr.changed / 4) | 0), 140);
        Fx.flash(fxBoard, pr.x1, pr.y1, pr.color, 110, 0.3);
        spawnCastFx(pr.prev, pr.next, pr.action);
      }
    }
    G.projectiles = G.projectiles.filter(function(pr) { return pr.t < pr.dur; });
  }

  function updateRings(dt) {
    if (!G.rings.length)
      return;
    for (const r of G.rings)
      r.t += dt;
    G.rings = G.rings.filter(function(r) { return r.t < r.dur; });
  }

  /* ── visual reaction to a cast: the logical state is already applied, the
     changed tiles burn/slide into place behind it ── */

  function spawnCastFx(prev, next, action) {
    const changed = [];
    for (let i = 0; i < next.tiles.length; ++i)
      if (prev.tiles[i] !== next.tiles[i])
        changed.push(i);

    /* newly collected runes */
    for (const idx of next.runes)
      if (!prev.runes.has(idx)) {
        G.spells.push({ kind: 'runeCollect', x: tileCenterX(idx), y: tileCenterY(idx), t: 0, dur: SPELL_TIME });
        floatingText.add(toViewX(tileCenterX(idx)), toViewY(tileCenterY(idx)) - 14, '+Rune', { color: '#e0a8ff', font: 'bold 15px sans-serif' });
        Fx.rune(fxBoard, tileCenterX(idx), tileCenterY(idx), '#d080ff');
        pushRing(tileCenterX(idx), tileCenterY(idx), 6, 52, '#e0a8ff', 3, 0.5);
        sfx('pickup', { pitch: 1.3 });
      }

    const target = action.index;
    switch (action.element) {
      case 'fire':
        if (prev.tiles[target] === T.ICE)
          scheduleTiles(changed, prev, next, 'iceMelt', '#8ae0ff', '#e2f6ff');
        else {
          scheduleSpread(changed, prev, target, 'fireBurst', '#ff7a3a', '#ffe6b8');
          if (changed.length >= 3)
            floatingText.add(toViewX(tileCenterX(target)), toViewY(tileCenterY(target)) - 26, 'Chain x' + changed.length + '!', { color: '#ff7a3a', font: 'bold 16px sans-serif' });
        }
        break;
      case 'water':
        scheduleSpread(changed, prev, target, 'waterSplash', '#3ab4ff', '#e2f6ff');
        if (changed.length >= 3)
          floatingText.add(toViewX(tileCenterX(target)), toViewY(tileCenterY(target)) - 26, 'Chain x' + changed.length + '!', { color: '#3ab4ff', font: 'bold 16px sans-serif' });
        break;
      case 'earth': {
        const kind = prev.tiles[target] === T.CHASM ? 'chasmFill' : 'earthRise';
        scheduleTiles(changed, prev, next, kind, '#c9a36a', '#ffe0a8');
        sfx('thud', kind === 'chasmFill' ? { pitch: 0.7 } : undefined);
        break;
      }
      case 'air': {
        G.spells.push({ kind: 'windGust', x: tileCenterX(target), y: tileCenterY(target), t: 0, dur: SPELL_TIME });
        const gd = DIRS[action.dir] || [0, 1];
        Fx.gust(fxBoard, tileCenterX(target), tileCenterY(target), gd[1], gd[0], G.theme === 3 ? '#8ac050' : '#c8b088');
        screenShake.trigger(3, 160);
        sfx('bounce', { pitch: 0.6 });
        /* where did the boulder end up? */
        let endIdx = -1;
        for (const idx of changed)
          if (next.tiles[idx] === T.BOULDER)
            endIdx = idx;
        const chasmIdx = changed.find(function(idx) { return prev.tiles[idx] === T.CHASM; });
        const swallowed = endIdx < 0;
        const to = swallowed ? chasmIdx : endIdx;
        const steps = Math.abs(rowOf(to) - rowOf(target)) + Math.abs(colOf(to) - colOf(target));
        G.slide = { fromIdx: target, toIdx: to, chasmIdx: chasmIdx === undefined ? -1 : chasmIdx, t: 0, dur: Math.max(1, steps) * SLIDE_STEP_TIME, swallowed: swallowed };
        break;
      }
    }
  }

  /* every changed tile carries its own spell so overlapping casts stay coherent */
  function scheduleTiles(changed, prev, next, kind, color, sparkle) {
    for (const idx of changed)
      G.tileFx.push({ index: idx, oldCode: prev.tiles[idx], newCode: next.tiles[idx], delay: 0, elapsed: 0, fired: false, dist: 0, kind: kind, color: color, sparkle: sparkle });
  }

  /* fire and water crawl over the changed cluster, one tile per BURN_STEP_DELAY */
  function scheduleSpread(changed, prev, target, kind, color, sparkle) {
    const changedSet = new Set(changed);
    const dist = new Map([[target, 0]]);
    const queue = [target];
    const nb = [];
    for (let head = 0; head < queue.length; ++head) {
      const idx = queue[head];
      neighbours4(idx, nb);
      for (const n of nb) {
        if (!changedSet.has(n) || dist.has(n))
          continue;
        dist.set(n, dist.get(idx) + 1);
        queue.push(n);
      }
    }
    for (const idx of changed) {
      const d = dist.has(idx) ? dist.get(idx) : 0;
      G.tileFx.push({ index: idx, oldCode: prev.tiles[idx], newCode: G.puzzle.tiles[idx], delay: d * BURN_STEP_DELAY, elapsed: 0, fired: false, dist: d, kind: kind, color: color, sparkle: sparkle });
    }
  }

  function updateTileFx(dt) {
    for (const fx of G.tileFx) {
      fx.elapsed += dt;
      if (!fx.fired && fx.elapsed >= fx.delay) {
        fx.fired = true;
        G.spells.push({ kind: fx.kind, x: tileCenterX(fx.index), y: tileCenterY(fx.index), t: 0, dur: SPELL_TIME });
        const fxX = tileCenterX(fx.index), fxY = tileCenterY(fx.index);
        if (fx.kind === 'fireBurst') {
          Fx.fire(fxBoard, fxX, fxY);
          if (fx.oldCode === T.WOOD)
            G.decals[fx.index] = 'scorch';
        } else if (fx.kind === 'iceMelt') {
          Fx.melt(fxBoard, fxX, fxY);
        } else if (fx.kind === 'waterSplash') {
          Fx.splash(fxBoard, fxX, fxY);
          pushRing(fxX, fxY, 6, 40, '#cfefff', 2.5, 0.5);
        } else {
          Fx.quake(fxBoard, fxX, fxY, REALM_ROCK[G.theme] || '#7a5a3a', REALM_DUST[G.theme] || '#a89878');
          screenShake.trigger(fx.kind === 'chasmFill' ? 5 : 6, 260);
          if (fx.kind === 'chasmFill')
            G.decals[fx.index] = 'rubble';
        }
        /* the sound rides the visual: one per tile the blaze/flood reaches,
           pitched up the further out it is; the throttle keeps bursts tame */
        if (fx.kind === 'fireBurst')
          sfx('smallExplode', { volume: 0.25, pitch: 1 + fx.dist * 0.15 });
        else if (fx.kind === 'waterSplash')
          sfx('drop', { pitch: 1 + fx.dist * 0.15 });
        else if (fx.kind === 'iceMelt')
          sfx('zap', { pitch: 1.4 });
      }
    }
    if (G.tileFx.length && G.tileFx.every(function(fx) { return fx.elapsed >= fx.delay + SPELL_TIME; }))
      G.tileFx = [];
  }

  function updateSlide(dt) {
    if (!G.slide)
      return;
    G.slide.t += dt;
    {
      const k = Math.min(1, G.slide.t / G.slide.dur);
      const bx = tileCenterX(G.slide.fromIdx) + (tileCenterX(G.slide.toIdx) - tileCenterX(G.slide.fromIdx)) * k;
      const by = tileCenterY(G.slide.fromIdx) + (tileCenterY(G.slide.toIdx) - tileCenterY(G.slide.fromIdx)) * k;
      if (Math.random() < 0.7)
        Fx.step(fxBoard, bx, by + 20, REALM_DUST[G.theme] || '#a89878', false);
    }
    if (G.slide.t >= G.slide.dur) {
      if (G.slide.swallowed && G.slide.chasmIdx >= 0) {
        G.spells.push({ kind: 'chasmFill', x: tileCenterX(G.slide.chasmIdx), y: tileCenterY(G.slide.chasmIdx), t: 0, dur: SPELL_TIME });
        Fx.quake(fxBoard, tileCenterX(G.slide.chasmIdx), tileCenterY(G.slide.chasmIdx), REALM_ROCK[G.theme] || '#7a5a3a', REALM_DUST[G.theme] || '#a89878');
        G.decals[G.slide.chasmIdx] = 'rubble';
        screenShake.trigger(7, 300);
        sfx('thud', { pitch: 0.7 });
      } else {
        /* the boulder grinds to a halt with a heavy thud */
        Fx.dustRing(fxBoard, tileCenterX(G.slide.toIdx), tileCenterY(G.slide.toIdx) + 16, REALM_DUST[G.theme] || '#a89878', 12, 1.1);
        screenShake.trigger(6, 260);
        sfx('thud');
      }
      G.slide = null;
    }
  }

  NS.casting = { undoCast, showHint, selectElement, beginCast, updatePendingCast, pushRing, updateProjectiles,
    updateRings, updateTileFx, updateSlide };
})();
