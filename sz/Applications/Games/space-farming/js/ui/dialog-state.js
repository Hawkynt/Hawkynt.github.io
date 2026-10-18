/* Space Farming - which modal dialog is open (tree, market, livestock, help) and pausing.
   Owns: G.dialog, G.dialogT, G.helpPage, G.dialogScroll
   Reads: G.tutorialSeen, G.state, G.isDragging, G.inspect */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { STATE_PLAYING, STATE_PAUSED, STORAGE_TUTORIAL, clearTooltip } = NS;

  /* ══════════════════════════════════════════════════════════════════
     DIALOGS — modal panels that pause the farm
     ══════════════════════════════════════════════════════════════════ */


  function openDialog(kind) {
    G.dialog = kind;
    G.dialogT = 0;
    G.dialogScroll = 0;
    G.inspect = null;
    clearTooltip();
    G.isDragging = false;
    SZ.GameAudio.play('select', { volume: 0.7 });
  }

  function closeDialog() {
    if (!G.dialog) return;
    if (G.dialog === 'help' && !G.tutorialSeen) {
      G.tutorialSeen = true;
      try { localStorage.setItem(STORAGE_TUTORIAL, '1'); } catch (_) {}
    }
    G.dialog = null;
    clearTooltip();
    SZ.GameAudio.play('click');
  }

  function toggleDialog(kind) {
    if (G.state !== STATE_PLAYING && kind !== 'help') return;
    if (G.dialog === kind)
      closeDialog();
    else
      openDialog(kind);
  }

  function toggleTree() {
    if (G.dialog === 'tree')
      closeDialog();
    else
      NS.openTree();
  }

  function closeAllDialogs() {
    G.dialog = null;
    G.inspect = null;
    G.dialogScroll = 0;
  }

  function togglePause() {
    if (G.state === STATE_PLAYING) {
      G.state = STATE_PAUSED;
      NS.saveGame();
      SZ.GameAudio.play('click');
    } else if (G.state === STATE_PAUSED) {
      G.state = STATE_PLAYING;
      SZ.GameAudio.play('select', { volume: 0.6 });
    }
  }

  Object.assign(NS, { openDialog, closeDialog, toggleDialog, toggleTree, closeAllDialogs, togglePause });

})();
