/* Per-frame simulation around the mage: walking and idling, ambient motes, the invalid-hover cross
   and the board particles. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { T, WALK_STEP_TIME, ELEMENT_BY_ID, STATE_PLAYING, REALM_DUST } = NS.consts;
  const { sfx, particles, Fx, fxBoard } = NS.context;
  const { tileCenterX, tileCenterY, toViewX, toViewY } = NS.view;
  const { reach, isWalkable, goalIndex, walkPath, dirBetween, actionsForTile } = NS.rules;
  const { treeLevel } = NS.grimoire;
  const { realmInfo } = NS.session;

  function startWalk(target, onDone) {
    const path = walkPath(G.puzzle.hero, target);
    if (!path)
      return false;
    G.walk = { from: G.puzzle.hero, path: path.slice(1), t: 0, onDone: onDone || null };
    return true;
  }

  function updateWalk(dt) {
    if (G.walk.path.length) {
      G.walk.t += dt;
      while (G.walk.path.length && G.walk.t >= WALK_STEP_TIME) {
        G.walk.t -= WALK_STEP_TIME;
        const next = G.walk.path.shift();
        G.hero.dir = dirBetween(G.walk.from, next);
        G.walk.from = next;
        G.puzzle.hero = next;
        /* a soft footfall on every second step, slightly off-pitch each time */
        ++G.stepCount;
        if (G.stepCount % 2 === 0)
          sfx('blip', { pitch: 0.8 + Math.random() * 0.1, volume: 0.15 });
        /* Starlight Steps: a short-lived sparkle on every stepped tile */
        if (treeLevel('s_trail') > 0)
          particles.sparkle(toViewX(tileCenterX(next)), toViewY(tileCenterY(next)), 2, { color: '#ffe9a8', speed: 0.6 });
        /* a small dust puff with each step; golden sparks while the win path lights up */
        if (G.winSeq) {
          G.winSeq.trail.push(next);
          particles.sparkle(toViewX(tileCenterX(next)), toViewY(tileCenterY(next)), 3, { color: '#ffd75a', speed: 1.5 });
        }
        Fx.step(fxBoard, tileCenterX(next), tileCenterY(next) + 14, REALM_DUST[G.theme] || '#a89878', G.puzzle.tiles[next] === T.WATER);
      }
      G.hero.pose = 'walk';
      if (G.walk.path.length) {
        const k = Math.min(1, G.walk.t / WALK_STEP_TIME);
        G.hero.x = tileCenterX(G.walk.from) + (tileCenterX(G.walk.path[0]) - tileCenterX(G.walk.from)) * k;
        G.hero.y = tileCenterY(G.walk.from) + (tileCenterY(G.walk.path[0]) - tileCenterY(G.walk.from)) * k;
      } else {
        G.hero.x = tileCenterX(G.walk.from);
        G.hero.y = tileCenterY(G.walk.from);
      }
      return;
    }
    if (G.walk.onDone) {
      const cb = G.walk.onDone;
      G.walk.onDone = null;
      cb();
    }
    if (G.hero.pose === 'walk')
      G.hero.pose = 'idle';
  }

  /* the staff gem in board space (cast pose), where every spell orb starts */
  function gemX() { return G.hero.x + (G.hero.dir === 'left' ? -15 : G.hero.dir === 'right' ? 15 : 17); }
  function gemY() { return G.hero.y - 48; }
  function updateBoardFx(dt) {
    fxBoard.update(dt);
    Fx.ambient(fxBoard, G.theme, G.puzzle.cols * 64, G.puzzle.rows * 64, dt);
    if (G.pendingCast && G.pendingCast.phase === 'cast')
      Fx.charge(fxBoard, gemX(), gemY(), ELEMENT_BY_ID[G.pendingCast.action.element].color, dt);
    const goal = goalIndex();
    if (goal >= 0 && reach().has(goal))
      Fx.portalIdle(fxBoard, tileCenterX(goal), tileCenterY(goal), realmInfo().color, dt);
  }

  /* the mage at rest: he breathes, blinks, watches the pointer and his gem glimmers */
  function updateHeroLife(dt) {
    if (G.winSeq || G.pendingCast || G.walk.path.length || G.hero.alpha <= 0) {
      G.blinkSquash = 0;
      return;
    }
    if (G.hero.pose !== 'idle')
      return;
    if (G.hoverPoint) {
      const dx = G.hoverPoint.x - toViewX(G.hero.x), dy = G.hoverPoint.y - toViewY(G.hero.y);
      if (Math.abs(dx) >= Math.abs(dy))
        G.hero.dir = dx >= 0 ? 'right' : 'left';
      else
        G.hero.dir = dy >= 0 ? 'down' : 'up';
    }
    /* the art has no blink frame, so a short 3% squash stands in for one */
    G.blinkT += dt;
    if (G.blinkT >= G.blinkNext) {
      G.blinkT = 0;
      G.blinkNext = 3 + Math.random() * 2;
      G.blinkSquash = 0.12;
    }
    if (G.blinkSquash > 0)
      G.blinkSquash = Math.max(0, G.blinkSquash - dt);
    G.gemT += dt;
    if (G.gemT >= 0.6) {
      G.gemT = 0;
      fxBoard.spawn({ kind: 'spark', color: ELEMENT_BY_ID[G.selectedElement].color, x: gemX() + (Math.random() - 0.5) * 6, y: gemY(), vy: -18, wobble: 20, life: 0.9, size: 6, size1: 1 });
    }
  }

  function updateMotes(dt) {
    if (!G.motes.length)
      return;
    const w = G.puzzle.cols * 64, h = G.puzzle.rows * 64;
    for (const m of G.motes) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < 0) m.x += w; else if (m.x > w) m.x -= w;
      if (m.y < 0) m.y += h; else if (m.y > h) m.y -= h;
    }
  }

  /* the pointer resting on a tile that can neither be walked to nor cast on */
  function updateHoverInvalid(dt) {
    if (G.state !== STATE_PLAYING || G.pendingCast || G.winSeq || G.projectiles.length || G.hoverIdx < 0 || !G.hoverPoint) {
      G.hoverInvalidT = 0;
      return;
    }
    const code = G.puzzle.tiles[G.hoverIdx];
    if ((isWalkable(code) && reach().has(G.hoverIdx)) || actionsForTile(G.hoverIdx, G.selectedElement, G.hoverPoint).length) {
      G.hoverInvalidT = 0;
      return;
    }
    G.hoverInvalidT = Math.min(1, G.hoverInvalidT + dt * 3);
  }

  NS.world = { startWalk, updateWalk, gemX, gemY, updateMotes, updateHeroLife, updateHoverInvalid, updateBoardFx };
})();
