;(function() {
  'use strict';

  // Keyboard, pointer and wheel input, auto-pause and saving when the page is hidden.
  // Reads: constants, dom, hudFading, rules, upgradeData, upgrades, gameState, persistence, run, animation,
  //   pathfinding, weather, weatherArt, relocation, weapon, mining, bombs, chests, artifacts, upgradeTree,
  //   update, mineHud, bombArt, craftDialog, hud, tooltip
  // Reads state of: gameState, persistence, relocation, waves, weapon, bombs, bombArt

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, VIEW_SURFACE, VIEW_UNDERGROUND, STATE_READY, STATE_GADGET_SELECT,
    STATE_PLAYING, STATE_PAUSED, STATE_GAME_OVER, STATE_UPGRADE_DIALOG, STATE_CINEMATIC, STATE_CONFIRM,
    STATE_CRAFT, STATE_MINIGAME, GRID_COLS, GRID_ROWS, TILE_SIZE, TILE_EMPTY } = NS.constants;
  const { canvas, particles, floatingText } = NS.dom;
  const { hudPassThrough } = NS.hudFading;
  const { DOME_RADIUS, DOME_X, DOME_Y } = NS.rules;
  const { UPGRADE_TREE } = NS.upgradeData;
  const { getEffectiveLevel } = NS.upgrades;
  const { TUTORIAL_PAGES, tooltip, treeCam, PRIMARY_GADGETS, keys } = NS.gameState;
  const { saveRun, continueRun, startNewRun, requestNewGame, hitTitleButton } = NS.persistence;
  const { startGameAfterGadgetSelect, toggleView } = NS.run;
  const { spawnDust } = NS.animation;
  const { findPath, findAdjacentEmptyNear } = NS.pathfinding;
  const { collectMeteorOre } = NS.weather;
  const { hitMeteorOre } = NS.weatherArt;
  const { relocateBlocker, hitRelocateButton, requestRelocation, confirmButtons, answerRelocation,
    skipCinematic } = NS.relocation;
  const { startCharge, releaseCharge, tryParry } = NS.weapon;
  const { cancelMining, tryMine, pickUpDroppedResources, useBlastTool, useTeleporter, selectTool } = NS.mining;
  const { BOMB_TIERS, bombRadius, bombPower, cycleBomb, readyBombTier, noBombsHint, placeBomb, throwBombAt,
    lobSurfaceBomb, remoteDetonate } = NS.bombs;
  const { minigameKey, minigameClick, minigameHover } = NS.chests;
  const { hasArtifact } = NS.artifacts;
  const { zoomTreeAt, handleUpgradeDialogKey, openUpgradeDialog, closeUpgradeDialog,
    handleUpgradeDialogClick, handleUpgradeDialogHover } = NS.upgradeTree;
  const { clearMoveTarget } = NS.update;
  const { cargoTooltipLines } = NS.mineHud;
  const { hitBombBar, useBombBar } = NS.bombArt;
  const { openCraftDialog, hitCraftDialog, handleCraftClick, handleCraftKey } = NS.craftDialog;
  const { hitQuickPanel, activateQuickRow } = NS.hud;
  const { clearTooltip, setTooltip, buildTileTooltip, buildEnemyTooltip, buildUpgradeNodeTooltip } = NS.tooltip;

  /* ======================================================================
     INPUT
     ====================================================================== */

  /* Pause when the window is hidden or loses focus */
  SZ.GameAutoPause.attach({
    isRunning: () => G.state === STATE_PLAYING,
    pause: () => {
      G.state = STATE_PAUSED;
      saveRun();
    }
  });

  /* Keep the run when the page goes away or is hidden */
  window.addEventListener('pagehide', () => saveRun());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden)
      saveRun();
  });

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if (G.newGameConfirmOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        SZ.Dialog.close('dlg-new-game');
      }
      return;
    }

    if (e.code === 'F2') {
      e.preventDefault();
      requestNewGame();
      return;
    }

    if (G.state === STATE_CINEMATIC && !G.showTutorial) {
      if (e.code === 'Space' || e.code === 'Escape' || e.code === 'Enter') {
        e.preventDefault();
        skipCinematic();
      }
      return;
    }
    if (G.state === STATE_CONFIRM) {
      e.preventDefault();
      if (e.code === 'Enter' || e.code === 'KeyY')
        answerRelocation(true);
      else if (e.code === 'Escape' || e.code === 'KeyN')
        answerRelocation(false);
      return;
    }

    /* Tutorial navigation */
    if (G.showTutorial) {
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowRight') {
        e.preventDefault();
        ++G.tutorialPage;
        if (G.tutorialPage >= TUTORIAL_PAGES.length)
          G.showTutorial = false;
        return;
      }
      if (e.code === 'ArrowLeft' && G.tutorialPage > 0) {
        e.preventDefault();
        --G.tutorialPage;
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        G.showTutorial = false;
        return;
      }
      return;
    }

    if (G.state === STATE_CRAFT) {
      if (handleCraftKey(e))
        e.preventDefault();
      return;
    }
    if (G.state === STATE_MINIGAME) {
      if (minigameKey(e))
        e.preventDefault();
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      if (G.state === STATE_PLAYING || G.state === STATE_PAUSED || G.state === STATE_READY || G.state === STATE_GADGET_SELECT) {
        G.showTutorial = !G.showTutorial;
        G.tutorialPage = 0;
        return;
      }
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      if (G.state === STATE_UPGRADE_DIALOG) {
        closeUpgradeDialog();
        return;
      }
      if (G.state === STATE_PLAYING && G.bombThrowMode) {
        G.bombThrowMode = false;
        return;
      }
      if (G.state === STATE_PLAYING) {
        G.state = STATE_PAUSED;
        saveRun();
      } else if (G.state === STATE_PAUSED)
        G.state = STATE_PLAYING;
      return;
    }

    // Title screen with a saved run: Enter/C continues, N starts over
    if (G.state === STATE_READY && G.saveAvailable) {
      if (e.code === 'Enter' || e.code === 'KeyC') {
        e.preventDefault();
        continueRun();
        return;
      }
      if (e.code === 'KeyN') {
        requestNewGame();
        return;
      }
    }

    // U key: open/close upgrade dialog
    if (e.code === 'KeyU') {
      if (G.state === STATE_UPGRADE_DIALOG) {
        closeUpgradeDialog();
        return;
      }
      if (G.state === STATE_PLAYING && G.currentView === VIEW_SURFACE) {
        openUpgradeDialog();
        return;
      }
    }

    if (G.state === STATE_UPGRADE_DIALOG) {
      // Tree navigation; other keys are blocked while the dialog is open
      if (handleUpgradeDialogKey(e))
        e.preventDefault();
      return;
    }
    if (G.state !== STATE_PLAYING) return;

    if (e.code === 'Space' || e.code === 'Tab') {
      e.preventDefault();
      toggleView();
    }

    if (G.currentView === VIEW_UNDERGROUND) {
      let newDx = 0, newDy = 0;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { newDx = 0; newDy = -1; }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { newDx = 0; newDy = 1; }
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { newDx = -1; newDy = 0; }
      else if (e.code === 'ArrowRight' || e.code === 'KeyD') { newDx = 1; newDy = 0; }

      G.keeperIdle = 0;
      // Dash: Shift + direction rushes through the tunnel
      if ((newDx !== 0 || newDy !== 0) && e.shiftKey && G.unlockedTools.dash && G.dashCooldown <= 0) {
        G.lastMineDir = { dx: newDx, dy: newDy };
        let n = 0;
        const range = 3 + (getEffectiveLevel('dash') - 1);
        while (n < range) {
          const rr = G.drillY + newDy, cc = G.drillX + newDx;
          if (rr < 0 || rr >= GRID_ROWS || cc < 0 || cc >= GRID_COLS || G.undergroundGrid[rr][cc] !== TILE_EMPTY) break;
          spawnDust(G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, G.drillY * TILE_SIZE + TILE_SIZE / 2 - G.cameraY);
          G.drillX = cc;
          G.drillY = rr;
          ++n;
        }
        if (n > 0) {
          G.dashCooldown = 2;
          clearMoveTarget();
          pickUpDroppedResources();
          SZ.GameAudio.play('whoosh', { pitch: 1.8, volume: 0.6 });
          newDx = newDy = 0;
        }
      }
      // Double Jump: two tunnel tiles per step upward
      if (newDy === -1 && G.unlockedTools.doubleJump && !G.miningTarget && G.drillY >= 2 && G.undergroundGrid[G.drillY - 1][G.drillX] === TILE_EMPTY && G.undergroundGrid[G.drillY - 2][G.drillX] === TILE_EMPTY) {
        clearMoveTarget();
        G.drillY -= 1;
      }
      if (newDx !== 0 || newDy !== 0) {
        // Cancel mining if direction changed
        if (G.miningTarget && G.miningDir && (G.miningDir.dx !== newDx || G.miningDir.dy !== newDy))
          cancelMining();
        clearMoveTarget();
        tryMine(newDx, newDy);
      }
    }

    // Repellent field activation
    if (e.code === 'KeyR' && G.primaryGadget === 'repellent') {
      if (!G.primaryGadgetState.active && G.primaryGadgetState.cooldown <= 0) {
        G.primaryGadgetState.active = true;
        G.primaryGadgetState.duration = 5;
        SZ.GameAudio.play('zap', { pitch: 0.5 });
        floatingText.add(DOME_X, DOME_Y - DOME_RADIUS - 60, 'Repellent Field!', { color: '#a0f', font: 'bold 28px sans-serif' });
        particles.burst(DOME_X, DOME_Y, 20, { color: '#a0f', speed: 3, life: 0.5 });
      }
    }

    // Bombs: drop (mine) or lob at the cursor (surface), throw mode, next size, workshop, remote detonation
    if (e.code === 'KeyB') {
      if (G.currentView === VIEW_UNDERGROUND)
        placeBomb();
      else if (G.mouseAimX >= 0 && G.mouseAimY >= 0 && G.mouseAimY < DOME_Y)
        lobSurfaceBomb(G.mouseAimX, G.mouseAimY);
      else
        lobSurfaceBomb(DOME_X + Math.cos(G.turretAngle) * 420, DOME_Y + Math.sin(G.turretAngle) * 420);
    }
    if (e.code === 'KeyT') {
      if (readyBombTier() < 0)
        noBombsHint();
      else
        G.bombThrowMode = !G.bombThrowMode;
    }
    if (e.code === 'KeyQ')
      cycleBomb(e.shiftKey ? -1 : 1);
    if (e.code === 'KeyC') {
      openCraftDialog();
      return;
    }
    if (e.code === 'KeyX')
      remoteDetonate();

    // Surface combat: F fires (hold to charge), E parries
    if (G.currentView === VIEW_SURFACE && !e.repeat) {
      if (e.code === 'KeyF') {
        G.fireRequested = true;
        startCharge();
      }
      if (e.code === 'KeyE')
        tryParry();
    }

    if (e.code === 'KeyL' && G.relocationCore.found)
      requestRelocation();

    // Tool/Gadget shortcuts (1-5)
    if (e.code === 'Digit1' || e.key === '1') {
      if (G.unlockedTools.drill)
        selectTool('drill');
    }
    if (e.code === 'Digit2' || e.key === '2') {
      if (G.unlockedTools.blastTool)
        useBlastTool();
    }
    if (e.code === 'Digit3' || e.key === '3') {
      if (G.unlockedTools.scanner)
        floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'Scanner active (passive)', { color: '#0f0', font: 'bold 22px sans-serif' });
    }
    if (e.code === 'Digit4' || e.key === '4') {
      if (G.unlockedTools.reinforcedDome)
        floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 40, 'Reinforced Dome active (passive)', { color: '#0f0', font: 'bold 22px sans-serif' });
    }
    if (e.code === 'Digit5' || e.key === '5') {
      if (G.unlockedTools.teleporter || hasArtifact('warpAnchor'))
        useTeleporter();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'KeyF' && G.charge)
      releaseCharge();
  });

  /* -- Click/Tap handling -- */
  canvas.addEventListener('pointerdown', (e) => {
    if (G.state === STATE_CINEMATIC && !G.showTutorial) {
      skipCinematic();
      return;
    }
    if (G.state === STATE_CONFIRM) {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * CANVAS_W / rect.width, my = (e.clientY - rect.top) * CANVAS_H / rect.height;
      for (const b of confirmButtons())
        if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h)
          answerRelocation(b.id === 'yes');
      return;
    }
    if (G.showTutorial) {
      ++G.tutorialPage;
      if (G.tutorialPage >= TUTORIAL_PAGES.length)
        G.showTutorial = false;
      return;
    }
    if (G.newGameConfirmOpen)
      return;
    if (G.state === STATE_CRAFT) {
      const rect = canvas.getBoundingClientRect();
      handleCraftClick((e.clientX - rect.left) * CANVAS_W / rect.width, (e.clientY - rect.top) * CANVAS_H / rect.height);
      return;
    }
    if (G.state === STATE_MINIGAME) {
      const rect = canvas.getBoundingClientRect();
      minigameClick((e.clientX - rect.left) * CANVAS_W / rect.width, (e.clientY - rect.top) * CANVAS_H / rect.height, e.button);
      return;
    }
    if (G.state === STATE_READY && G.saveAvailable) {
      const rect = canvas.getBoundingClientRect();
      const hit = hitTitleButton((e.clientX - rect.left) * CANVAS_W / rect.width, (e.clientY - rect.top) * CANVAS_H / rect.height);
      if (hit === 'continue')
        continueRun();
      else if (hit === 'new')
        requestNewGame();
      return;
    }
    if (G.state === STATE_READY || G.state === STATE_GAME_OVER) {
      startNewRun();
      return;
    }

    // Upgrade dialog click (left-click only; right-click is pan)
    if (G.state === STATE_UPGRADE_DIALOG) {
      if (e.button === 2) return; // right-click handled by pan listener
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      if (!handleUpgradeDialogClick(mx, my))
        startTreePan(e, mx, my); // drag on empty space pans the tree
      return;
    }

    // Gadget selection screen click
    if (G.state === STATE_GADGET_SELECT) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const cardW = 280, cardH = 320, gap = 30;
      const totalW = PRIMARY_GADGETS.length * cardW + (PRIMARY_GADGETS.length - 1) * gap;
      const startX = (CANVAS_W - totalW) / 2;
      const cardY = (CANVAS_H - cardH) / 2;

      for (let i = 0; i < PRIMARY_GADGETS.length; ++i) {
        const cx = startX + i * (cardW + gap);
        if (mx >= cx && mx <= cx + cardW && my >= cardY && my <= cardY + cardH) {
          G.primaryGadget = PRIMARY_GADGETS[i].key;
          startGameAfterGadgetSelect();
          return;
        }
      }
      return;
    }

    if (G.state !== STATE_PLAYING) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Touch has no hover: a tap also aims the turret at the tapped point
    G.mouseAimX = mx;
    G.mouseAimY = my;

    // A monster (or the keeper) seen through a faded panel takes the click
    const through = hudPassThrough(mx, my);

    // Bomb stock panel (both views); right click cancels an armed throw
    const bombHit = through ? null : hitBombBar(mx, my);
    if (bombHit) {
      useBombBar(bombHit);
      return;
    }
    if (G.bombThrowMode && e.button === 2) {
      G.bombThrowMode = false;
      return;
    }

    if (G.currentView === VIEW_UNDERGROUND) {
      const col = Math.floor((mx + G.cameraX) / TILE_SIZE);
      const row = Math.floor((my + G.cameraY) / TILE_SIZE);
      if (G.bombThrowMode) {
        throwBombAt(col, row);
        return;
      }
      if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS) {
        const ddx = col - G.drillX;
        const ddy = row - G.drillY;
        if (ddx === 0 && ddy === 0) {
          toggleView();
        } else if (G.undergroundGrid[row][col] === TILE_EMPTY) {
          // Click on empty tile: move there via pathfinding
          const path = findPath(G.drillX, G.drillY, col, row);
          if (path && path.length > 0) {
            clearMoveTarget();
            G.moveTarget = { col, row };
            G.movePath = path;
            G.movePathIndex = 0;
            G.moveStepTimer = 0;
            G.mineTarget = null;
          }
        } else if (Math.abs(ddx) + Math.abs(ddy) === 1) {
          // Adjacent non-empty tile: mine directly
          clearMoveTarget();
          tryMine(ddx, ddy);
        } else {
          // Non-adjacent non-empty tile: pathfind to adjacent empty, then queue mine
          const result = findAdjacentEmptyNear(col, row);
          if (result) {
            clearMoveTarget();
            G.moveTarget = { col: result.adj.col, row: result.adj.row };
            G.movePath = result.path;
            G.movePathIndex = 0;
            G.moveStepTimer = 0;
            G.mineTarget = { col: col, row: row, dx: result.adj.dx, dy: result.adj.dy };
          }
        }
      }
    } else {
      // Orchard: clicking near the dome tree when fruit is ready
      if (G.primaryGadget === 'orchard' && G.primaryGadgetState.fruitReady) {
        const treeX = DOME_X - 60, treeY = DOME_Y - 30;
        if (Math.abs(mx - treeX) < 40 && Math.abs(my - treeY) < 50) {
          G.primaryGadgetState.fruitReady = false;
          G.primaryGadgetState.fruitTimer = 20;
          G.primaryGadgetState.speedBoostTimer = 10;
          SZ.GameAudio.play('pickup', { pitch: 1.2 });
          floatingText.add(treeX, treeY - 40, '+30% Mining Speed!', { color: '#0f0', font: 'bold 24px sans-serif' });
          particles.sparkle(treeX, treeY - 15, 8, { color: '#ff0', speed: 2 });
          return;
        }
      }

      // Surface view: relocate button, meteor ore, the quick upgrade panel, then fire the weapon
      if (!through && hitRelocateButton(mx, my)) {
        requestRelocation();
        return;
      }
      const ore = hitMeteorOre(mx, my);
      if (ore) {
        collectMeteorOre(ore);
        return;
      }
      const qp = through ? null : hitQuickPanel(mx, my);
      if (qp) {
        if (qp.kind === 'row')
          activateQuickRow(qp.row);
        else if (qp.kind === 'tree')
          openUpgradeDialog();
        return;
      }
      if (G.bombThrowMode) {
        lobSurfaceBomb(mx, my);
        return;
      }
      // Right click or a tap on the dome raises the parry shield
      if (e.button === 2 || (Math.hypot(mx - DOME_X, my - DOME_Y) < DOME_RADIUS + 6 && my < DOME_Y + 8)) {
        tryParry();
        return;
      }
      // Fire weapon toward current turret aim direction; holding charges a stronger shot
      G.fireRequested = true;
      startCharge();
    }
  });

  /* -- Scroll/zoom for upgrade dialog -- */
  canvas.addEventListener('wheel', (e) => {
    if (G.state === STATE_UPGRADE_DIALOG) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * CANVAS_W / rect.width;
      const my = (e.clientY - rect.top) * CANVAS_H / rect.height;
      zoomTreeAt(mx, my, e.deltaY > 0 ? 1 / 1.15 : 1.15);
      G.upgradeViewCustomized = true;
    }
  }, { passive: false });

  /* -- Right-click pan for upgrade dialog -- */
  canvas.addEventListener('contextmenu', (e) => {
    if (G.state === STATE_UPGRADE_DIALOG || G.state === STATE_PLAYING || G.state === STATE_CRAFT || G.state === STATE_MINIGAME)
      e.preventDefault();
  });

  function startTreePan(e, mx, my) {
    G.upgradePanning = true;
    G.upgradePanStartX = mx;
    G.upgradePanStartY = my;
    G.upgradePanBaseX = G.upgradePanX;
    G.upgradePanBaseY = G.upgradePanY;
    treeCam.tz = G.upgradeZoom;
    G.upgradeViewCustomized = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (G.state === STATE_UPGRADE_DIALOG && e.button === 2) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      startTreePan(e, (e.clientX - rect.left) * CANVAS_W / rect.width, (e.clientY - rect.top) * CANVAS_H / rect.height);
    }
  });

  canvas.addEventListener('pointercancel', () => { G.charge = null; });

  canvas.addEventListener('pointerup', (e) => {
    if (G.charge && e.button === 0)
      releaseCharge();
    if (G.upgradePanning && (e.button === 0 || e.button === 2)) {
      G.upgradePanning = false;
      treeCam.tx = G.upgradePanX;
      treeCam.ty = G.upgradePanY;
      treeCam.tz = G.upgradeZoom;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  });

  /* -- Continuous mouse tracking for turret aim + gadget selection hover + tooltips -- */
  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    G.mouseAimX = (e.clientX - rect.left) * scaleX;
    G.mouseAimY = (e.clientY - rect.top) * scaleY;
    G.quickPanelHover = null;
    G.relocateHover = null;
    G.bombBarHover = null;
    if (G.state === STATE_CRAFT) {
      G.craftHover = hitCraftDialog(G.mouseAimX, G.mouseAimY);
      return;
    }
    if (G.state === STATE_MINIGAME) {
      minigameHover(G.mouseAimX, G.mouseAimY);
      return;
    }
    const passHover = G.state === STATE_PLAYING && hudPassThrough(G.mouseAimX, G.mouseAimY);
    if (G.state === STATE_PLAYING && !passHover) {
      G.bombBarHover = hitBombBar(G.mouseAimX, G.mouseAimY);
      if (G.bombBarHover) {
        if (G.bombBarHover.kind === 'slot') {
          const t = G.bombBarHover.tier, T = BOMB_TIERS[t];
          setTooltip(G.mouseAimX, G.mouseAimY, [`[[${T.icon}]] ${T.name}`, `In stock: ${G.bombInv[t]}`, `Blast radius ${bombRadius(t).toFixed(1)} tiles, rock power ${bombPower(t).toFixed(1)}`, `Lobbed on the surface: up to ${Math.round(T.monster * (1 + 0.3 * getEffectiveLevel('bombPower')))} damage`, '\u2714 Click to select'], 'bombslot:' + t);
        } else
          clearTooltip();
        return;
      }
    }
    if (G.state === STATE_CONFIRM) {
      for (const b of confirmButtons())
        if (G.mouseAimX >= b.x && G.mouseAimX <= b.x + b.w && G.mouseAimY >= b.y && G.mouseAimY <= b.y + b.h)
          G.relocateHover = b.id;
      return;
    }
    if (!passHover && hitRelocateButton(G.mouseAimX, G.mouseAimY)) {
      G.relocateHover = 'button';
      setTooltip(G.mouseAimX, G.mouseAimY, ['[[flight]] Relocate', 'Pack up the dome and fly to a new site', relocateBlocker() ? '\u26A0 ' + relocateBlocker() : '\u2714 Click or press L'], 'relocate');
      return;
    }

    // Right-click drag panning in upgrade dialog
    if (G.upgradePanning && G.state === STATE_UPGRADE_DIALOG) {
      G.upgradePanX = treeCam.tx = G.upgradePanBaseX + (G.mouseAimX - G.upgradePanStartX);
      G.upgradePanY = treeCam.ty = G.upgradePanBaseY + (G.mouseAimY - G.upgradePanStartY);
      G.upgradeZoom = treeCam.tz;
      clearTooltip();
      return;
    }

    // Track hover on upgrade dialog + tooltip
    if (G.state === STATE_UPGRADE_DIALOG) {
      handleUpgradeDialogHover(G.mouseAimX, G.mouseAimY);
      // Build tooltip for hovered upgrade node
      if (G.upgradeDialogHover) {
        const node = UPGRADE_TREE.find(n => n.id === G.upgradeDialogHover);
        if (node) {
          const ttLines = buildUpgradeNodeTooltip(node);
          setTooltip(G.mouseAimX, G.mouseAimY, ttLines, 'node:' + node.id);
        } else
          clearTooltip();
      } else
        clearTooltip();
      return;
    }

    // Track hover on gadget selection screen
    if (G.state === STATE_GADGET_SELECT) {
      const cardW = 280, cardH = 320, gap = 30;
      const totalW = PRIMARY_GADGETS.length * cardW + (PRIMARY_GADGETS.length - 1) * gap;
      const startX = (CANVAS_W - totalW) / 2;
      const cardY = (CANVAS_H - cardH) / 2;
      G.gadgetSelectHover = -1;
      for (let i = 0; i < PRIMARY_GADGETS.length; ++i) {
        const cx = startX + i * (cardW + gap);
        if (G.mouseAimX >= cx && G.mouseAimX <= cx + cardW && G.mouseAimY >= cardY && G.mouseAimY <= cardY + cardH) {
          G.gadgetSelectHover = i;
          break;
        }
      }
      clearTooltip();
      return;
    }

    // Tooltip detection for playing state
    if (G.state === STATE_PLAYING) {
      const cr = G.cargoPanelRect;
      if (G.currentView === VIEW_UNDERGROUND && !passHover && cr && G.mouseAimX >= cr.x && G.mouseAimX <= cr.x + cr.w && G.mouseAimY >= cr.y && G.mouseAimY <= cr.y + cr.h) {
        setTooltip(G.mouseAimX, G.mouseAimY, cargoTooltipLines(), 'cargo');
      } else if (G.currentView === VIEW_UNDERGROUND) {
        // Underground: detect tile under mouse
        const col = Math.floor((G.mouseAimX + G.cameraX) / TILE_SIZE);
        const row = Math.floor((G.mouseAimY + G.cameraY) / TILE_SIZE);
        if (col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS && G.undergroundGrid[row][col] !== TILE_EMPTY) {
          const ttLines = buildTileTooltip(col, row);
          if (ttLines)
            setTooltip(G.mouseAimX, G.mouseAimY, ttLines, 'tile:' + col + ',' + row);
          else
            clearTooltip();
        } else
          clearTooltip();
      } else if (G.currentView === VIEW_SURFACE) {
        G.quickPanelHover = passHover ? null : hitQuickPanel(G.mouseAimX, G.mouseAimY);
        if (G.quickPanelHover) {
          const r = G.quickPanelHover.row;
          if (G.quickPanelHover.kind === 'row' && r.node)
            setTooltip(G.mouseAimX, G.mouseAimY, buildUpgradeNodeTooltip(r.node, true), 'quick:' + r.node.id, { x: r.x, y: r.y, w: r.w, h: r.h });
          else
            clearTooltip();
          return;
        }
        // Surface: detect enemy under mouse (not while aiming and shooting)
        let foundEnemy = false;
        for (const e of (G.charge || G.animTime - G.lastShotAt < 2 ? [] : G.enemies)) {
          if (e.hidden) continue;
          const sz = e.size || 10;
          const dx = G.mouseAimX - e.x;
          const dy = G.mouseAimY - e.y;
          if (dx * dx + dy * dy < (sz + 8) * (sz + 8)) {
            const ttLines = buildEnemyTooltip(e);
            if (tooltip.enemy !== e)
              setTooltip(G.mouseAimX, G.mouseAimY, ttLines, 'enemy:' + G.enemies.indexOf(e) + ':' + e.type);
            else {
              tooltip.x = G.mouseAimX;
              tooltip.y = G.mouseAimY;
            }
            tooltip.enemy = e;
            foundEnemy = true;
            break;
          }
        }
        if (!foundEnemy)
          clearTooltip();
      } else
        clearTooltip();
    } else
      clearTooltip();
  });
})();
