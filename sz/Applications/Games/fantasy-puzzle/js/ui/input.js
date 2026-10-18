/* Keyboard and pointer input, tile clicks and the menu-bar actions. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { STATE_PLAYING, STATE_PAUSED, STATE_LEVEL_COMPLETE, STATE_OUT_OF_MANA, isMenuState, DIRS, TREE_BRANCH_LIST } = NS.consts;
  const { sfx, canvas } = NS.context;
  const { pointerToView, colOf, rowOf, pointToTile } = NS.view;
  const { saveHighScores, renderHighScores } = NS.store;
  const { reach, isWalkable, nearestStandTo, dirBetween, actionsForTile, raisesStone, clickWalks } = NS.rules;
  const { openGrimoireFromLevel, buildTreeLayout, selectFirstInBranch, closeGrimoire, buyNode, moveTreeSelection } = NS.grimoire;
  const { restartLevel, goLevels } = NS.session;
  const { startWalk } = NS.world;
  const { undoCast, showHint, selectElement, beginCast } = NS.casting;
  const { moveMenuCursor, activateMenuItem } = NS.menu;
  const { setScreen, openHelp, leaveHelp } = NS.screens;
  const { HELP_PAGES } = NS.help;

  function inRect(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  function rejectTile(idx) {
    G.tileShake = { index: idx, t: 0 };
    sfx('error', { volume: 0.4 });
  }

  /* a press this long on a tile Earth would raise stone on walks there instead */
  const HOLD_TO_WALK_MS = 450;

  function walkTo(idx) {
    if (!isWalkable(G.puzzle.tiles[idx]) || !reach().has(idx)) {
      rejectTile(idx);
      return;
    }
    if (idx !== G.puzzle.hero)
      startWalk(idx, null);
  }

  function cancelHold() {
    if (G.holdPress)
      clearTimeout(G.holdPress.timer);
    G.holdPress = null;
  }

  /* a raise-stone tile is decided on release: a short click casts, a long press walks */
  function beginHold(idx, p) {
    cancelHold();
    const hold = { idx: idx, p: p, timer: 0 };
    hold.timer = setTimeout(function() {
      if (G.holdPress !== hold)
        return;
      G.holdPress = null;
      if (G.state === STATE_PLAYING && !G.pendingCast && !G.winSeq)
        walkTo(idx);
    }, HOLD_TO_WALK_MS);
    G.holdPress = hold;
  }

  function handleTileClick(idx, p) {
    if (clickWalks(idx)) {
      walkTo(idx);
      return;
    }
    const acts = actionsForTile(idx, G.selectedElement, p);
    if (acts.length) {
      const action = acts[0];
      let standIdx;
      if (action.element === 'air') {
        const d = DIRS[action.dir];
        standIdx = (rowOf(idx) - d[0]) * G.puzzle.cols + (colOf(idx) - d[1]);
      } else {
        standIdx = nearestStandTo(idx);
      }
      if (standIdx < 0) {
        rejectTile(idx);
        return;
      }
      beginCast(action, standIdx, dirBetween(standIdx, idx));
      return;
    }
    rejectTile(idx);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F1') {
      e.preventDefault();
      openHelp();
      return;
    }

    if (e.code === 'F2') {
      e.preventDefault();
      setScreen('title');
      return;
    }

    /* ── Grimoire tech tree navigation ── */
    if (G.state === 'grimoire') {
      e.preventDefault();
      if (e.code === 'Escape') {
        closeGrimoire();
      } else if (e.code === 'Tab') {
        G.treeBranch = (G.treeBranch + 1) % TREE_BRANCH_LIST.length;
        G.treeLayout = buildTreeLayout();
        selectFirstInBranch();
        sfx('click', { volume: 0.4 });
      } else if (e.code >= 'Digit1' && e.code <= 'Digit4') {
        const b = Number(e.code.slice(5)) - 1;
        if (b < TREE_BRANCH_LIST.length) {
          G.treeBranch = b;
          G.treeLayout = buildTreeLayout();
          selectFirstInBranch();
          sfx('click', { volume: 0.4 });
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        moveTreeSelection(-1, 0);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        moveTreeSelection(1, 0);
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        moveTreeSelection(0, -1);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        moveTreeSelection(0, 1);
      } else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') {
        if (G.treeSelected && buyNode(G.treeSelected))
          G.treeBuyFlash = { id: G.treeSelected, at: G.time };
      }
      return;
    }

    /* ── Help pages ── */
    if (G.state === 'help') {
      e.preventDefault();
      if (e.code === 'Escape')
        leaveHelp();
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        G.helpPage = Math.max(0, G.helpPage - 1);
        sfx('click', { volume: 0.4 });
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        G.helpPage = Math.min(HELP_PAGES.length - 1, G.helpPage + 1);
        sfx('click', { volume: 0.4 });
      }
      return;
    }

    /* ── menus and panels share the hit-area cursor ── */
    if (isMenuState(G.state) || G.state === STATE_PAUSED || G.state === STATE_LEVEL_COMPLETE || G.state === STATE_OUT_OF_MANA) {
      e.preventDefault();
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'KeyA')
        moveMenuCursor(-1);
      else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'KeyD')
        moveMenuCursor(1);
      else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')
        activateMenuItem(G.hitAreas[G.menuCursor]);
      else if (e.code === 'KeyH' && isMenuState(G.state))
        openHelp();
      else if (e.code === 'KeyR' && !isMenuState(G.state))
        restartLevel();
      else if (e.code === 'KeyZ' && G.state === STATE_OUT_OF_MANA)
        undoCast();
      else if (e.code === 'KeyL' && !isMenuState(G.state))
        goLevels();
      else if (e.code === 'KeyT' && !isMenuState(G.state))
        setScreen('title');
      else if (e.code === 'KeyG' && (G.state === STATE_PAUSED || G.state === STATE_OUT_OF_MANA))
        openGrimoireFromLevel();
      else if (e.code === 'Escape') {
        if (G.state === STATE_PAUSED)
          G.state = STATE_PLAYING;
        else if (G.state === STATE_LEVEL_COMPLETE || G.state === STATE_OUT_OF_MANA)
          goLevels();
        else if (G.state !== 'title')
          setScreen('title');
      }
      return;
    }

    if (e.code === 'Escape') {
      e.preventDefault();
      G.state = STATE_PAUSED;
      G.menuCursor = 0;
      return;
    }

    if (G.state !== STATE_PLAYING)
      return;

    if (e.code === 'KeyZ') {
      e.preventDefault();
      undoCast();
      return;
    }
    if (e.code === 'KeyR') {
      restartLevel();
      return;
    }
    if (e.code === 'KeyH') {
      showHint();
      return;
    }
    if (e.code === 'KeyG') {
      openGrimoireFromLevel();
      return;
    }

    if (e.key === '1') selectElement('fire');
    if (e.key === '2') selectElement('water');
    if (e.key === '3') selectElement('earth');
    if (e.key === '4') selectElement('air');
    if (e.code === 'KeyQ') selectElement('fire');
    if (e.code === 'KeyW') selectElement('water');
    if (e.code === 'KeyE') selectElement('earth');
  });

  canvas.addEventListener('pointerdown', (e) => {
    /* the frame must keep keyboard focus after clicks */
    window.focus();

    const p = pointerToView(e);
    G.mouseX = p.x;
    G.mouseY = p.y;

    if (G.state === STATE_PLAYING && G.grimoireChip && inRect(p, G.grimoireChip)) {
      openGrimoireFromLevel();
      return;
    }

    if (isMenuState(G.state) || G.state === STATE_PAUSED || G.state === STATE_LEVEL_COMPLETE || G.state === STATE_OUT_OF_MANA) {
      if (G.state === 'grimoire' && G.treeLayout) {
        for (const tab of G.treeLayout.tabs)
          if (inRect(p, tab)) {
            G.treeBranch = tab.index;
            selectFirstInBranch();
            sfx('click', { volume: 0.4 });
            return;
          }
        for (const card of G.treeLayout.cards)
          if (inRect(p, card)) {
            G.treeSelected = card.node.id;
            if (buyNode(card.node.id))
              G.treeBuyFlash = { id: card.node.id, at: G.time };
            return;
          }
        return;
      }
      for (let i = 0; i < G.hitAreas.length; ++i) {
        const a = G.hitAreas[i];
        if (inRect(p, a)) {
          G.menuCursor = i;
          activateMenuItem(a);
          return;
        }
      }
      return;
    }

    for (const b of G.elementButtons)
      if (inRect(p, b)) {
        selectElement(b.id);
        return;
      }

    if (G.pendingCast || G.winSeq)
      return;

    const idx = pointToTile(p);
    if (idx < 0)
      return;
    /* right-click always walks, whatever element is selected */
    if (e.button === 2)
      walkTo(idx);
    else if (e.button === 0 && raisesStone(idx)) {
      beginHold(idx, p);
      /* the release must reach the canvas even when it happens outside it */
      if (canvas.setPointerCapture)
        canvas.setPointerCapture(e.pointerId);
    } else if (e.button === 0) {
      handleTileClick(idx, p);
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    const hold = G.holdPress;
    if (!hold)
      return;
    cancelHold();
    if (G.state !== STATE_PLAYING || G.pendingCast || G.winSeq)
      return;
    /* the release has to stay on the pressed tile, so a press can still be dragged off to abort */
    if (pointToTile(pointerToView(e)) === hold.idx)
      handleTileClick(hold.idx, hold.p);
  });

  canvas.addEventListener('pointercancel', cancelHold);

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointerToView(e);
    G.hoverPoint = p;
    G.mouseX = p.x;
    G.mouseY = p.y;
    G.hoverIdx = G.state === STATE_PLAYING ? pointToTile(p) : -1;
  });

  canvas.addEventListener('pointerleave', () => {
    G.hoverIdx = -1;
    G.hoverPoint = null;
    G.mouseX = -1;
    G.mouseY = -1;
  });

  function handleAction(action) {
    switch (action) {
      case 'new':
        setScreen('title');
        break;
      case 'pause':
        if (G.state === STATE_PLAYING)
          G.state = STATE_PAUSED;
        else if (G.state === STATE_PAUSED)
          G.state = STATE_PLAYING;
        break;
      case 'hint':
        showHint();
        break;
      case 'high-scores':
        renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            G.highScores = [];
            saveHighScores();
            renderHighScores();
          }
        });
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'how-to-play':
        openHelp();
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  NS.input = { handleAction };
})();
