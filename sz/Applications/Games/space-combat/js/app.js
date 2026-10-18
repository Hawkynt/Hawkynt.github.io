/* Bootstrap: the fixed 60 Hz loop (as many simulation steps as are due, then one draw), the
   window menu bar, background pre-painting of sector art, and start-up. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceCombat || (SZ.SpaceCombat = {});
  const G = NS.state;
  const { STEP, STEP_MS, MAX_STEPS, STEP_SNAP_MS } = NS.constants;
  const { SECTORS } = NS.campaign;
  const scr = NS.screens;
  const User32 = SZ.Dlls && SZ.Dlls.User32;

  let last = 0;
  let acc = 0;
  let warm = 0;

  function loop(ts) {
    if (!last) last = ts;
    let elapsed = ts - last;
    last = ts;
    if (Math.abs(elapsed - STEP_MS) < STEP_SNAP_MS) elapsed = STEP_MS;
    acc = Math.min(acc + elapsed, STEP_MS * MAX_STEPS);
    while (acc >= STEP_MS) {
      acc -= STEP_MS;
      NS.sim.update(STEP);
    }
    NS.frame.draw();
    NS.statusBar.tick(elapsed / 1000);
    prewarm();
    requestAnimationFrame(loop);
  }

  /* paint one sector's backdrop per idle menu frame so the map and first missions never stall */
  function prewarm() {
    if (warm >= SECTORS.length || G.screen === 'playing') return;
    if (G.time < 0.5) return;
    NS.backdropArt.nebulaLayer(warm, SECTORS[warm].theme);
    ++warm;
  }

  if (SZ.MenuBar) {
    new SZ.MenuBar({
      onAction(action) {
        switch (action) {
          case 'new': scr.setScreen('title'); break;
          case 'pause':
            if (G.screen === 'playing') scr.pause();
            else if (G.screen === 'paused') scr.resume();
            break;
          case 'tree':
            if (G.screen === 'playing') { scr.pause(); scr.openTree('paused'); }
            else if (G.screen === 'paused') scr.openTree('paused');
            else if (scr.isMenu()) scr.openTree(G.screen === 'tree' ? G.treeReturn : G.screen);
            break;
          case 'high-scores':
            if (G.screen === 'playing') scr.pause();
            NS.statusBar.showHighScores();
            break;
          case 'exit': if (User32) User32.DestroyWindow(); break;
          case 'tutorial':
            if (G.screen === 'playing') scr.pause();
            scr.openHelp(G.screen === 'paused' ? 'paused' : G.screen);
            break;
          case 'controls': SZ.Dialog.show('controlsBackdrop'); break;
          case 'about': SZ.Dialog.show('dlg-about'); break;
        }
      },
    });
  }

  if (User32) {
    User32.EnableVisualStyles && User32.EnableVisualStyles();
    User32.SetWindowText && User32.SetWindowText('Space Combat');
  }
  if (SZ.GameAudio) SZ.GameAudio.attachMuteButton();
  document.body.tabIndex = -1;

  NS.backdrop.setSector(0);
  NS.statusBar.update();
  if (!G.save.seenHelp) {
    G.save.seenHelp = true;
    scr.toast('New pilot? Open How to Play for the controls', '#4fc3ff');
  }
  requestAnimationFrame(loop);
})();
