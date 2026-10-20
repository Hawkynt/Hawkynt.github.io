/* The status bar: the current room, the discovered-rule count and the visited-room
   progress. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.MindPuzzle || (SZ.MindPuzzle = {});
  const S = NS.state;
  const D = NS.dom;
  const ROOMS = NS.rooms;

  function updateStatusBar() {
    if (D.statusRoom) D.statusRoom.textContent = `Room: ${S.currentRoom + 1}/${ROOMS.length}`;
    const discovered = Object.keys(S.discoveredRules).length;
    if (D.statusDiscovered) D.statusDiscovered.textContent = `Discovered: ${discovered}/${ROOMS.length}`;
    const visited = Object.keys(S.roomsVisited).length;
    if (D.statusProgress) D.statusProgress.textContent = `Visited: ${visited}/${ROOMS.length}`;
  }

  Object.assign(NS.statusbar, { updateStatusBar });
})();
