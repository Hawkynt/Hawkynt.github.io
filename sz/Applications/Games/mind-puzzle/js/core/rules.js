/* The puzzle logic: perspective shifting and its transition, the reality-warp effect,
   ambient atmospherics, rule discovery, portal and object interaction, solid-object
   collision resolution, player movement and the per-frame update step. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const ROOMS = NS.rooms;
  const { particles, screenShake, floatingText } = NS.effects;
  const { saveProgress, addHighScore } = NS.persist;
  const { loadRoom, nextRoom } = NS.flow;

  /* ── PERSPECTIVE SHIFTING ── */

  // standing on a fracture re-triggers every frame; keep its sound to one
  function playThrottled(name, opts) {
    const now = performance.now();
    if (now - (S.lastSoundAt[name] || 0) < 600)
      return;
    S.lastSoundAt[name] = now;
    SZ.GameAudio.play(name, opts);
  }

  function shiftPerspective() {
    S.transitionTo = (S.currentView + 1) % 3;
    S.transitionProgress = 0;
    S.shiftTimer = 0;

    screenShake.trigger(4, 150);
    floatingText.add(C.canvasW / 2, 40, 'Perspective Shift!', { color: '#ff0', font: 'bold 14px sans-serif' });
    particles.burst(C.canvasW / 2, C.canvasH / 2, 15, { color: '#88f', speed: 3, life: 0.6 });
    playThrottled('whoosh', { pitch: 0.8 + S.transitionTo * 0.25 });
  }

  function updateTransition(dt) {
    if (S.transitionProgress < 1) {
      S.shiftTimer += dt;
      // Ease-in-out with smoothstep
      const t = Math.min(S.shiftTimer / 0.5, 1);
      S.transitionProgress = t * t * (3 - 2 * t);
      if (S.transitionProgress >= 1) {
        S.transitionProgress = 1;
        S.currentView = S.transitionTo;
      }
    }
  }

  /* ── REALITY WARP ── */

  function triggerWarp() {
    S.warpActive = true;
    S.warpEffect = 1;
    S.waveAmplitude = 15;
    screenShake.trigger(6, 300);
    floatingText.add(C.canvasW / 2, C.canvasH / 2, 'Reality Warped!', { color: '#f44', font: 'bold 16px sans-serif' });
    particles.burst(S.player.x, S.player.y, 20, { color: '#f04', speed: 5, life: 0.8 });
    playThrottled('zap', { pitch: 0.6 });
  }

  function updateWarp(dt) {
    if (S.warpActive) {
      S.warpEffect -= dt * 1.5;
      S.waveAmplitude *= 0.95;
      if (S.warpEffect <= 0) {
        S.warpActive = false;
        S.warpEffect = 0;
        S.waveAmplitude = 0;
      }
    }
  }

  /* ── AMBIENT ATMOSPHERICS ── */

  function updateAmbient(dt) {
    S.ambientTimer += dt;
    if (S.ambientTimer >= 0.15) {
      S.ambientTimer = 0;
      const def = ROOMS[S.currentRoom];
      const rx = Math.random() * C.canvasW;
      const ry = Math.random() * C.canvasH;
      particles.trail(rx, ry, { color: def.accentColor || '#446', life: 1.5, size: 1.5 });
    }
  }

  /* ── RULE DISCOVERY ── */

  function discoverRule() {
    if (S.discoveredRules[S.currentRoom]) return false;
    S.discoveredRules[S.currentRoom] = true;
    saveProgress();

    const def = ROOMS[S.currentRoom];
    particles.sparkle(S.player.x, S.player.y - 20, 12, { color: '#ff0', speed: 3 });
    particles.burst(S.player.x, S.player.y, 15, { color: def.accentColor, speed: 4, life: 0.6 });
    floatingText.add(S.player.x, S.player.y - 30, 'Rule Discovered!', { color: '#0f0', font: 'bold 14px sans-serif' });
    screenShake.trigger(3, 100);
    SZ.GameAudio.play('pickup');
    return true;
  }

  /* ── COLLISION & INTERACTION ── */

  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function checkPortals() {
    const def = ROOMS[S.currentRoom];
    if (!def.portals || def.portals.length === 0) return;
    for (const p of def.portals) {
      if (rectOverlap(S.player.x - C.PLAYER_SIZE / 2, S.player.y - C.PLAYER_SIZE / 2, C.PLAYER_SIZE, C.PLAYER_SIZE, p.x, p.y, p.w, p.h)) {
        triggerWarp();
        discoverRule();
        loadRoom(p.target);
        return;
      }
    }
  }

  function touchHint(obj) {
    S.hintTouchedNow = true;
    if (!discoverRule() && obj !== S.touchedHint)
      SZ.GameAudio.play('blip', { volume: 0.6 });
    S.touchedHint = obj;
  }

  function checkObjects() {
    const def = ROOMS[S.currentRoom];
    const half = C.PLAYER_SIZE / 2;
    S.hintTouchedNow = false;

    for (const obj of def.objects) {
      if (!rectOverlap(S.player.x - half, S.player.y - half, C.PLAYER_SIZE, C.PLAYER_SIZE, obj.x, obj.y, obj.w, obj.h))
        continue;

      switch (obj.type) {
        case 'clue':
          touchHint(obj);
          floatingText.add(obj.x, obj.y - 15, def.ruleHint, { color: '#ff0', font: '11px sans-serif' });
          break;

        case 'goal':
          discoverRule();
          completeGame();
          break;

        case 'fracture':
          discoverRule();
          triggerWarp();
          shiftPerspective();
          break;

        case 'echo':
          touchHint(obj);
          floatingText.add(obj.x, obj.y - 15, def.ruleHint, { color: '#0cf', font: '11px sans-serif' });
          particles.burst(obj.x + obj.w / 2, obj.y + obj.h / 2, 10, { color: '#00ccff', speed: 3, life: 0.5 });
          break;

        case 'nexusOrb':
          discoverRule();
          floatingText.add(obj.x, obj.y - 15, 'The Nexus responds...', { color: '#fff', font: 'bold 12px sans-serif' });
          particles.sparkle(obj.x + obj.w / 2, obj.y + obj.h / 2, 15, { color: '#fff', speed: 4 });
          nextRoom();
          break;

        case 'shadow':
          touchHint(obj);
          floatingText.add(obj.x, obj.y - 15, def.ruleHint, { color: '#678', font: '11px sans-serif' });
          break;

        case 'colorTile':
          touchHint(obj);
          floatingText.add(obj.x, obj.y - 15, def.ruleHint, { color: obj.tileColor || '#ff0', font: '11px sans-serif' });
          break;

        case 'phantomBridge':
          touchHint(obj);
          floatingText.add(obj.x + obj.w / 2, obj.y - 15, def.ruleHint, { color: '#8f4', font: '11px sans-serif' });
          break;
      }
    }
    if (!S.hintTouchedNow)
      S.touchedHint = null;
  }

  function completeGame() {
    S.state = C.STATE_GAME_OVER;
    S.elapsedTime = (performance.now() - S.startTime) / 1000;
    addHighScore(S.currentRoom, S.elapsedTime);

    particles.confetti(C.canvasW / 2, C.canvasH / 2, 50, { speed: 6, gravity: 0.08 });
    particles.burst(C.canvasW / 2, C.canvasH / 2, 25, { color: '#ffd700', speed: 5, life: 1 });
    floatingText.add(C.canvasW / 2, C.canvasH / 2 - 60, 'AWAKENED!', { color: '#ffd700', font: 'bold 24px sans-serif' });
    screenShake.trigger(8, 400);
    NS.os.updateWindowTitle();
    SZ.GameAudio.play('win');
  }

  /* ── PLAYER MOVEMENT ── */

  function isSolid(obj) {
    return obj.type === 'wall' || obj.type === 'platform' || obj.type === 'stairPlatform';
  }

  function resolveCollisions() {
    const def = ROOMS[S.currentRoom];
    const half = C.PLAYER_SIZE / 2;

    for (const obj of def.objects) {
      if (!isSolid(obj))
        continue;

      const px = S.player.x - half;
      const py = S.player.y - half;
      if (!rectOverlap(px, py, C.PLAYER_SIZE, C.PLAYER_SIZE, obj.x, obj.y, obj.w, obj.h))
        continue;

      // Compute overlap on each axis and push out by the smallest penetration
      const overlapLeft = (px + C.PLAYER_SIZE) - obj.x;
      const overlapRight = (obj.x + obj.w) - px;
      const overlapTop = (py + C.PLAYER_SIZE) - obj.y;
      const overlapBottom = (obj.y + obj.h) - py;

      const minX = Math.min(overlapLeft, overlapRight);
      const minY = Math.min(overlapTop, overlapBottom);

      if (minX < minY) {
        if (overlapLeft < overlapRight)
          S.player.x = obj.x - half;
        else
          S.player.x = obj.x + obj.w + half;
      } else {
        if (overlapTop < overlapBottom)
          S.player.y = obj.y - half;
        else
          S.player.y = obj.y + obj.h + half;
      }
    }
  }

  function updatePlayer(dt) {
    let dx = 0, dy = 0;
    if (S.keys['ArrowLeft'] || S.keys['KeyA']) dx = -1;
    if (S.keys['ArrowRight'] || S.keys['KeyD']) dx = 1;
    if (S.keys['ArrowUp'] || S.keys['KeyW']) dy = -1;
    if (S.keys['ArrowDown'] || S.keys['KeyS']) dy = 1;

    // Normalize diagonal
    if (dx && dy) {
      const inv = 1 / Math.sqrt(2);
      dx *= inv;
      dy *= inv;
    }

    // Mirror room: reverse horizontal
    const def = ROOMS[S.currentRoom];
    if (def.viewMode === C.VIEW_FLIPPED)
      dx = -dx;

    // Move on X axis and resolve collisions, then Y axis separately
    // This prevents corner-clipping and allows sliding along walls
    S.player.x += dx * C.PLAYER_SPEED * dt;
    S.player.x = Math.max(C.PLAYER_SIZE / 2, Math.min(C.canvasW - C.PLAYER_SIZE / 2, S.player.x));
    resolveCollisions();

    S.player.y += dy * C.PLAYER_SPEED * dt;
    S.player.y = Math.max(C.PLAYER_SIZE / 2, Math.min(C.canvasH - C.PLAYER_SIZE / 2, S.player.y));
    resolveCollisions();
  }

  /* ── UPDATE ── */

  function updateGame(dt) {
    if (S.state !== C.STATE_EXPLORING) return;

    updatePlayer(dt);
    updateTransition(dt);
    updateWarp(dt);
    updateAmbient(dt);
    checkPortals();
    checkObjects();
  }

  Object.assign(NS.rules, { playThrottled, shiftPerspective, updateTransition, triggerWarp, updateWarp, updateAmbient,
    discoverRule, rectOverlap, checkPortals, touchHint, checkObjects, completeGame, isSolid, resolveCollisions,
    updatePlayer, updateGame });
})();
