/* Room loading and game flow: placing the player and resetting the per-room view/warp
   state on entry, advancing to the next room (or finishing the game) and starting a
   fresh run. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const C = NS.constants;
  const S = NS.state;
  const ROOMS = NS.rooms;
  const { floatingText, particles } = NS.effects;
  const { saveProgress, addHighScore } = NS.persist;

  function loadRoom(index) {
    if (index < 0 || index >= ROOMS.length) return;

    S.currentRoom = index;
    const def = ROOMS[S.currentRoom];

    S.player.x = def.playerStart.x;
    S.player.y = def.playerStart.y;

    S.currentView = def.viewMode;
    S.transitionProgress = 1;
    S.transitionTo = S.currentView;

    S.warpActive = false;
    S.warpEffect = 0;
    S.waveAmplitude = 0;
    S.ambientTimer = 0;

    S.roomsVisited[S.currentRoom] = true;
    S.state = C.STATE_EXPLORING;
    NS.os.updateWindowTitle();
    saveProgress();
  }

  function nextRoom() {
    if (S.currentRoom + 1 < ROOMS.length) {
      loadRoom(S.currentRoom + 1);
      SZ.GameAudio.play('levelup');
    } else {
      S.state = C.STATE_GAME_OVER;
      S.elapsedTime = (performance.now() - S.startTime) / 1000;
      addHighScore(S.currentRoom, S.elapsedTime);
      floatingText.add(C.canvasW / 2, C.canvasH / 2 - 40, 'ALL ROOMS COMPLETE!', { color: '#ffd700', font: 'bold 20px sans-serif' });
      particles.confetti(C.canvasW / 2, C.canvasH / 2, 40, { speed: 6, gravity: 0.08 });
      NS.os.updateWindowTitle();
      SZ.GameAudio.play('win');
    }
  }

  function resetAndStart() {
    S.startTime = performance.now();
    S.discoveredRules = {};
    S.roomsVisited = {};
    loadRoom(0);
  }

  Object.assign(NS.flow, { loadRoom, nextRoom, resetAndStart });
})();
