/* app/input.js -- mouse, touch and keyboard.
   Reads: constants, towerTypes, maps, env, layout, widgets, abilities, towers, waves, simulation, savegame,
      researchScreen, relicsPanel, cinematics, hud, buildBar, mapSelect, help, actions and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, COLS, ROWS, BRANCH_TIER, STATE_READY, STATE_PLAYING, STATE_PAUSED, STATE_BUILD,
      STATE_GAME_OVER, STATE_MAP_SELECT, STATE_RESEARCH, WORLD_W, WORLD_H, clamp } = NS.constants;
  const { TOWER_TYPES } = NS.towerTypes;
  const { REGIONS, regionOf } = NS.maps;
  const { canvas, audio } = NS.env;
  const { view } = NS.layout;
  const { pointer, pressFx, regionAt, hudPassThrough } = NS.widgets;
  const { ABILITIES, useAbility } = NS.abilities;
  const { towerStats, towerAt, upgradeTower, sellTower, repairTower, cycleTargeting } = NS.towers;
  const { startNextWave, canCallEarly } = NS.waves;
  const { GAME_SPEEDS } = NS.simulation;
  const { continueSavedGame, requestNewGame } = NS.savegame;
  const { treeCam, treeView, openResearchFromMap, openResearch, zoomTreeAt, handleResearchKey } = NS.researchScreen;
  const { openRelics } = NS.relicsPanel;
  const { skipCine } = NS.cinematics;
  const { kbCursor, nextLevelAvailable } = NS.hud;
  const { selectBuildType } = NS.buildBar;
  const { openMapSelect, previewMap, playSelectedMap, mapSelectPages, mapSelectPage, showMapSelectPage,
      moveMapSelect } = NS.mapSelect;
  const { HELP_PAGES, openHelp, closeHelp } = NS.help;
  const { togglePause, goNextLevel, resetAndStart, quitToTitle, toggleFastForward, toggleAutoWave, mapAction,
      cancelBuild } = NS.actions;

  /* ══════════════════════════════════════════════════════════════════
     INPUT -- mouse, touch and keyboard
     ══════════════════════════════════════════════════════════════════ */

  function readPointer(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.px = (e.clientX - rect.left) * (G.canvasW / rect.width);
    pointer.py = (e.clientY - rect.top) * (G.canvasH / rect.height);
    pointer.ux = pointer.px / G.uiS;
    pointer.uy = pointer.py / G.uiS;
    pointer.wx = (pointer.px - view.x) / view.s;
    pointer.wy = (pointer.py - view.y) / view.s;
    pointer.inside = true;
    pointer.type = e.pointerType || 'mouse';
  }

  function updateHover() {
    const r = pointer.inside ? regionAt(pointer.ux, pointer.uy) : null;
    const id = r && !r.disabled ? r.id : null;
    if (id !== G.hoverId) {
      G.hoverId = id;
      canvas.style.cursor = id && r.onClick ? 'pointer' : 'default';
    }
  }

  canvas.addEventListener('pointermove', (e) => {
    const px0 = pointer.ux, py0 = pointer.uy;
    readPointer(e);
    kbCursor.active = false;
    if (G.treeDrag && G.state === STATE_RESEARCH) {
      G.treeDrag.moved += Math.abs(pointer.ux - px0) + Math.abs(pointer.uy - py0);
      treeCam.tx = treeCam.x = G.treeDrag.cx + (pointer.ux - G.treeDrag.ux);
      treeCam.ty = treeCam.y = G.treeDrag.cy + (pointer.uy - G.treeDrag.uy);
    }
  });

  window.addEventListener('pointerup', () => {
    G.treeDrag = null;
  });

  let wheelFlipAt = 0;
  canvas.addEventListener('wheel', (e) => {
    if (G.state === STATE_MAP_SELECT && !G.overlay && !G.cine) {
      // One page per wheel gesture
      e.preventDefault();
      const now = performance.now();
      if (Math.abs(e.deltaY) + Math.abs(e.deltaX) > 0 && now - wheelFlipAt > 350 && mapSelectPages() > 1) {
        wheelFlipAt = now;
        showMapSelectPage(mapSelectPage() + ((e.deltaY || e.deltaX) > 0 ? 1 : -1));
      }
      return;
    }
    if (G.state !== STATE_RESEARCH) return;
    e.preventDefault();
    readPointer(e);
    zoomTreeAt(pointer.ux, pointer.uy, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });

  canvas.addEventListener('pointerleave', () => {
    pointer.inside = false;
  });

  let touchPending = null;   // first tap of a touch placement: { col, row }

  canvas.addEventListener('pointerdown', (e) => {
    readPointer(e);
    kbCursor.active = false;
    if (G.cine) {
      skipCine();
      return;
    }
    if (e.button === 2) return;
    const r = regionAt(pointer.ux, pointer.uy);
    if (G.state === STATE_RESEARCH && (!r || /^tree-node-/.test(r.id))) {
      const v = treeView();
      if (!r && pointer.ux >= v.x && pointer.uy >= v.y && pointer.ux <= v.x + v.w && pointer.uy <= v.y + v.h) {
        G.treeDrag = { ux: pointer.ux, uy: pointer.uy, cx: treeCam.x, cy: treeCam.y, moved: 0 };
        return;
      }
    }
    if (r && !hudPassThrough(pointer.ux, pointer.uy)) {
      if (r.disabled) {
        if (r.onDisabled) r.onDisabled();
        return;
      }
      if (r.onClick) {
        pressFx[r.id] = performance.now();
        if (r.sound !== false && !/^build/.test(r.id))
          audio.play('click');
        r.onClick();
      }
      return;
    }
    if (G.overlay) return;
    if (G.state === STATE_PAUSED) return;
    if (G.state !== STATE_BUILD && G.state !== STATE_PLAYING) return;
    if (pointer.wx < 0 || pointer.wy < 0 || pointer.wx >= WORLD_W || pointer.wy >= WORLD_H) {
      cancelBuild();
      return;
    }
    const col = Math.floor(pointer.wx / CELL), row = Math.floor(pointer.wy / CELL);
    // Touch: the first tap shows the ghost, a second tap on the same tile builds
    if (pointer.type === 'touch' && G.selectedTowerType >= 0 && !towerAt(col, row)) {
      if (!touchPending || touchPending.col !== col || touchPending.row !== row) {
        touchPending = { col, row };
        kbCursor.col = col;
        kbCursor.row = row;
        kbCursor.active = true;
        return;
      }
      touchPending = null;
    }
    mapAction(col, row, pointer.wx, pointer.wy);
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    readPointer(e);
    if (G.overlay || (G.state !== STATE_BUILD && G.state !== STATE_PLAYING)) return;
    if (cancelBuild()) return;
    const col = Math.floor(pointer.wx / CELL), row = Math.floor(pointer.wy / CELL);
    const t = towerAt(col, row);
    if (t) {
      G.selectedTower = t;
      audio.play('select');
      return;
    }
  });

  function moveCursor(dc, dr) {
    if (!kbCursor.active) {
      const c = G.selectedTower ? { col: G.selectedTower.col, row: G.selectedTower.row } : { col: kbCursor.col, row: kbCursor.row };
      kbCursor.col = c.col;
      kbCursor.row = c.row;
      kbCursor.active = true;
    } else {
      kbCursor.col = clamp(kbCursor.col + dc, 0, COLS - 1);
      kbCursor.row = clamp(kbCursor.row + dr, 0, ROWS - 1);
    }
    audio.play('click', { pitch: 1.6, volume: 0.4 });
  }

  window.addEventListener('keydown', (e) => {
    // Leave keys to an open dialog
    if (document.querySelector('.dialog-overlay.visible'))
      return;
    const code = e.code;

    if (code === 'F2') {
      e.preventDefault();
      requestNewGame();
      return;
    }

    // Any key skips a cinematic
    if (G.cine) {
      e.preventDefault();
      skipCine();
      return;
    }

    if (G.overlay === 'relics') {
      if (code === 'Escape' || code === 'Enter' || code === 'Space') G.overlay = null;
      e.preventDefault();
      return;
    }

    if (G.overlay === 'help') {
      if (code === 'Escape' || code === 'KeyH') closeHelp();
      else if (code === 'ArrowRight' || code === 'Tab') { G.helpPage = (G.helpPage + 1) % HELP_PAGES.length; audio.play('click'); }
      else if (code === 'ArrowLeft') { G.helpPage = (G.helpPage + HELP_PAGES.length - 1) % HELP_PAGES.length; audio.play('click'); }
      e.preventDefault();
      return;
    }

    if (code === 'KeyH') {
      e.preventDefault();
      openHelp();
      return;
    }

    if (G.state === STATE_RESEARCH) {
      e.preventDefault();
      handleResearchKey(e);
      return;
    }

    if (G.state === STATE_READY) {
      if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        if (G.savedGameInfo) continueSavedGame();
        else openMapSelect();
      } else if (code === 'KeyC') {
        e.preventDefault();
        openMapSelect();
      } else if (code === 'KeyR') {
        e.preventDefault();
        openResearch();
      }
      return;
    }

    if (G.state === STATE_MAP_SELECT) {
      const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (dirs[code]) {
        e.preventDefault();
        moveMapSelect(dirs[code][0], dirs[code][1]);
      } else if (code === 'PageUp' || code === 'PageDown' || code === 'Tab') {
        e.preventDefault();
        showMapSelectPage(mapSelectPage() + (code === 'PageUp' || (code === 'Tab' && e.shiftKey) ? -1 : 1));
      } else if (code === 'Home' || code === 'End') {
        e.preventDefault();
        const reg = REGIONS[regionOf(G.mapSelectIndex)].maps;
        const ni = reg[code === 'Home' ? 0 : reg.length - 1];
        if (ni !== G.mapSelectIndex) {
          previewMap(ni);
          audio.play('click', { pitch: 1.3 });
        }
      } else if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        pressFx['ms-play'] = performance.now();
        playSelectedMap();
      } else if (code === 'Escape') {
        e.preventDefault();
        quitToTitle();
      } else if (code === 'KeyR') {
        e.preventDefault();
        openResearch();
      } else if (code === 'KeyK') {
        openRelics();
      }
      return;
    }

    if (G.state === STATE_GAME_OVER) {
      if (code === 'Enter' || code === 'Space') {
        e.preventDefault();
        resetAndStart();
      } else if (code === 'KeyL' && nextLevelAvailable()) {
        goNextLevel();
      } else if (code === 'KeyR') {
        resetAndStart();
      } else if (code === 'KeyM' || code === 'Escape') {
        openMapSelect();
      } else if (code === 'KeyT') {
        openResearch();
      }
      return;
    }

    if (G.state === STATE_PAUSED) {
      if (code === 'KeyK') {
        openRelics();
        return;
      }
      if (code === 'Escape' || code === 'Space' || code === 'Enter') {
        e.preventDefault();
        togglePause();
      } else if (code === 'KeyM') {
        quitToTitle();
      } else if (code === 'KeyR') {
        e.preventDefault();
        openResearchFromMap();
      }
      return;
    }

    if (code === 'Escape') {
      e.preventDefault();
      if (!cancelBuild())
        togglePause();
      return;
    }

    if (code === 'Space') {
      e.preventDefault();
      if (G.state === STATE_BUILD)
        startNextWave();
      else if (G.state === STATE_PLAYING)
        toggleFastForward();
      return;
    }

    if (code === 'KeyQ' || code === 'KeyW' || code === 'KeyE') {
      const a = ABILITIES.find(q => 'Key' + q.key === code);
      if (a.aim && G.abilityAim === a.id && kbCursor.active)
        mapAction(kbCursor.col, kbCursor.row);
      else
        useAbility(a.id);
      return;
    }

    if (code === 'KeyK') {
      openRelics();
      return;
    }

    if (code === 'KeyL') {
      if (nextLevelAvailable()) goNextLevel();
      else audio.play('error');
      return;
    }

    if (code === 'KeyN') {
      if (G.state === STATE_BUILD || canCallEarly())
        startNextWave();
      else
        audio.play('error');
      return;
    }

    if (code === 'KeyF') {
      toggleFastForward(e.shiftKey ? -1 : 1);
      return;
    }

    if (code === 'Equal' || code === 'NumpadAdd' || code === 'Minus' || code === 'NumpadSubtract') {
      const up = code === 'Equal' || code === 'NumpadAdd';
      if (!up || G.gameSpeed < GAME_SPEEDS[GAME_SPEEDS.length - 1])
        toggleFastForward(up ? 1 : -1);
      return;
    }

    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrows[code]) {
      e.preventDefault();
      moveCursor(arrows[code][0], arrows[code][1]);
      return;
    }

    if (code === 'Enter' || code === 'NumpadEnter') {
      e.preventDefault();
      if (kbCursor.active)
        mapAction(kbCursor.col, kbCursor.row);
      return;
    }

    // Tower type selection: 1-9 and 0 for the first ten, Shift+1-6 for the rest
    if (/^Digit[0-9]$/.test(code) || /^Numpad[0-9]$/.test(code)) {
      const n = parseInt(code.slice(-1), 10);
      const idx = e.shiftKey ? (n >= 1 ? 9 + n : -1) : (n === 0 ? 9 : n - 1);
      if (idx < 0) return;
      if (idx < TOWER_TYPES.length)
        selectBuildType(idx);
      return;
    }

    if ((code === 'KeyU' || code === 'KeyI') && G.selectedTower) {
      const t = G.selectedTower;
      const branch = t.tier === BRANCH_TIER - 1 ? (code === 'KeyI' ? 1 : 0) : t.branch;
      if (code === 'KeyI' && t.tier !== BRANCH_TIER - 1)
        return;
      if (!upgradeTower(t, branch))
        audio.play('error');
      else
        pressFx[t.tier === BRANCH_TIER ? 'insp-branch' + branch : 'insp-up'] = performance.now();
      return;
    }

    if (code === 'KeyT' && G.selectedTower) {
      const s = towerStats(G.selectedTower);
      if (s.kind !== 'mine' && s.kind !== 'trap' && s.kind !== 'support') {
        cycleTargeting(G.selectedTower, e.shiftKey ? -1 : 1);
        pressFx['insp-target-' + G.selectedTower.target] = performance.now();
      }
      return;
    }

    if (code === 'KeyS' && G.selectedTower) {
      sellTower(G.selectedTower);
      return;
    }

    // Shift+R, or R with no tower selected, opens research over the paused map
    if (code === 'KeyR' && (e.shiftKey || !G.selectedTower)) {
      e.preventDefault();
      openResearchFromMap();
      return;
    }

    if (code === 'KeyR' && G.selectedTower) {
      if (!repairTower(G.selectedTower))
        audio.play('error');
      return;
    }

    if (code === 'KeyA')
      toggleAutoWave();
  });

  NS.input = { updateHover };

})();
