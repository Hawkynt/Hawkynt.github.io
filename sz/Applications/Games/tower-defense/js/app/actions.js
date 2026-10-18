/* app/actions.js -- pause, next level, restart, quit, speed, auto-wave and map clicks.
   Owns state: G.pausedFrom, G.introNext
   Reads: constants, maps, env, effects, abilities, paths, towers, simulation, savegame, battlefield,
      cinematics, hud and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { CELL, STATE_READY, STATE_PLAYING, STATE_PAUSED, STATE_BUILD, AUTO_WAVE_DELAY } = NS.constants;
  const { BIOMES, MAPS, nextMapOf } = NS.maps;
  const { audio, updateWindowTitle } = NS.env;
  const { particles, floatingText, decals, uiCoins, showBanner } = NS.effects;
  const { useAbility } = NS.abilities;
  const { buildPathCells, buildPaths, loadMap } = NS.paths;
  const { towerAt, placeTower } = NS.towers;
  const { GAME_SPEEDS } = NS.simulation;
  const { isInGameState, saveGame, refreshSavedGameInfo } = NS.savegame;
  const { corpses } = NS.battlefield;
  const { cineQueue, startCine } = NS.cinematics;
  const { carryGold, nextLevelAvailable } = NS.hud;

  /* ══════════════════════════════════════════════════════════════════
     ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function togglePause() {
    if (G.state === STATE_PLAYING || G.state === STATE_BUILD) {
      G.pausedFrom = G.state;
      G.state = STATE_PAUSED;
      saveGame();
      audio.play('click', { pitch: 0.7 });
    } else if (G.state === STATE_PAUSED) {
      G.state = G.pausedFrom || STATE_PLAYING;
      audio.play('click');
    }
  }

  /* Save when the page is hidden or closed */
  window.addEventListener('pagehide', saveGame);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden)
      saveGame();
  });

  /* Pause when the window is hidden */
  SZ.GameAutoPause.attach({
    isRunning: () => G.state === STATE_PLAYING,
    pause: togglePause
  });

  // Moving on: research, relics and unlocks stay, the towers stay behind and a
  // quarter of the banked gold comes along
  function goNextLevel() {
    if (!nextLevelAvailable()) return;
    const carry = carryGold();
    const from = G.currentMap;
    saveGame();
    // March across the world map, then fly over the new map
    const to = nextMapOf(from);
    startCine('travel', { from, to }, (skipped) => {
      G.currentMap = to;
      G.introNext = !skipped;
      resetAndStart(carry);
      showBanner(MAPS[G.currentMap].name.toUpperCase(), `${BIOMES[MAPS[G.currentMap].biome].name} · ${carry} gold carried over`, BIOMES[MAPS[G.currentMap].biome].color, 2.6);
      saveGame();
    });
  }

  function resetAndStart(carry) {
    G.overlay = null;
    G.lastResult = null;
    particles.clear();
    floatingText.clear();
    decals.length = 0;
    corpses.length = 0;
    uiCoins.length = 0;
    G.banner = null;
    G.hitstop = 0;
    cineQueue.length = 0;
    if (G.cine && G.cine.kind !== 'travel') G.cine = null;
    loadMap(G.currentMap, carry || 0);
    audio.play('select');
    if (G.introNext) {
      G.introNext = false;
      startCine('intro');
    }
  }

  function quitToTitle() {
    if (isInGameState())
      saveGame();
    G.overlay = null;
    G.selectedTower = null;
    G.cine = null;
    cineQueue.length = 0;
    G.state = STATE_READY;
    refreshSavedGameInfo();
    if (G.savedGameInfo)
      G.currentMap = G.savedGameInfo.map;
    loadMapPreview();
    updateWindowTitle();
  }

  // Shows the chosen map behind the title screen
  function loadMapPreview() {
    const mapDef = MAPS[G.currentMap];
    buildPathCells(mapDef);
    buildPaths(mapDef);
    G.totalWaves = mapDef.waves;
  }

  function setGameSpeed(s) {
    G.gameSpeed = s;
    audio.play('click', { pitch: 0.8 + GAME_SPEEDS.indexOf(s) * 0.15 });
  }

  // One step up or down the speed ladder; up from the top wraps to 1x
  function toggleFastForward(dir) {
    const i = GAME_SPEEDS.indexOf(G.gameSpeed);
    if (dir < 0)
      setGameSpeed(GAME_SPEEDS[Math.max(0, i - 1)]);
    else
      setGameSpeed(GAME_SPEEDS[(i + 1) % GAME_SPEEDS.length]);
  }

  function toggleAutoWave() {
    G.autoWaveMode = !G.autoWaveMode;
    if (G.autoWaveMode && G.state === STATE_BUILD && G.waveComplete)
      G.autoWaveTimer = AUTO_WAVE_DELAY;
    audio.play('click', { pitch: G.autoWaveMode ? 1.2 : 0.8 });
  }

  // Click or Enter on a map cell
  function mapAction(col, row, wx, wy) {
    if (G.state !== STATE_BUILD && G.state !== STATE_PLAYING) return;
    if (G.abilityAim) {
      useAbility(G.abilityAim, wx === undefined ? col * CELL + CELL / 2 : wx, wy === undefined ? row * CELL + CELL / 2 : wy);
      return;
    }
    const t = towerAt(col, row);
    if (G.selectedTowerType >= 0) {
      if (t) {
        G.selectedTowerType = -1;
        G.selectedTower = t;
        audio.play('select');
        return;
      }
      if (!placeTower(col, row, G.selectedTowerType))
        audio.play('error');
      return;
    }
    if (t) {
      G.selectedTower = G.selectedTower === t ? null : t;
      audio.play('select');
      return;
    }
    G.selectedTower = null;
  }

  function cancelBuild() {
    if (G.abilityAim) {
      G.abilityAim = null;
      audio.play('click', { pitch: 0.7 });
      return true;
    }
    if (G.selectedTowerType >= 0) {
      G.selectedTowerType = -1;
      audio.play('click', { pitch: 0.7 });
      return true;
    }
    if (G.selectedTower) {
      G.selectedTower = null;
      return true;
    }
    return false;
  }

  NS.actions = { togglePause, goNextLevel, resetAndStart, quitToTitle, loadMapPreview, setGameSpeed,
      toggleFastForward, toggleAutoWave, mapAction, cancelBuild };

})();
