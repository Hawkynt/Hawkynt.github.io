/* Start-up and the loop: a fixed 60 Hz simulation (as many steps as are due, then one draw),
   the window menu bar, the day's bookkeeping on launch, background pre-painting of the worlds'
   scenery while menus are idle, and the first-visit intro. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { STEP, STEP_MS, MAX_STEPS } = NS.constants;
  const scr = NS.screens;
  const User32 = SZ.Dlls && SZ.Dlls.User32;

  let last = 0;
  let acc = 0;
  let warm = 0;

  function loop(ts) {
    if (!last) last = ts;
    let elapsed = ts - last;
    last = ts;
    if (Math.abs(elapsed - STEP_MS) < 2.5) elapsed = STEP_MS;
    acc = Math.min(acc + elapsed, STEP_MS * MAX_STEPS);
    const s0 = performance.now();
    while (acc >= STEP_MS) {
      acc -= STEP_MS;
      NS.sim.update(STEP);
    }
    const p = G.perf;
    p.sim = performance.now() - s0;
    p.simAvg = p.simAvg * 0.95 + p.sim * 0.05;
    NS.frame.draw();
    prewarm();
    requestAnimationFrame(loop);
  }

  /* paint one world's scenery per idle menu frame so the first runs never stall */
  function prewarm() {
    if (warm >= 5 || G.screen === 'playing' || G.time < 0.6) return;
    for (const L of ['far', 'mid', 'near']) NS.backdropArt.layer(L, warm);
    NS.propArt.groundTile(warm);
    ++warm;
  }

  if (SZ.MenuBar) {
    new SZ.MenuBar({
      onAction(action) {
        switch (action) {
          case 'new': scr.toTitle(); break;
          case 'pause':
            if (G.screen === 'playing') scr.pause();
            else if (G.screen === 'paused') scr.resume();
            break;
          case 'tree':
          case 'wardrobe':
          case 'journal':
          case 'tutorial': {
            const name = action === 'tutorial' ? 'help' : action;
            if (G.screen === 'playing') scr.pause();
            if (G.screen !== 'cine') scr.open(name, G.screen === name ? G.back[name] : G.screen);
            break;
          }
          case 'high-scores':
            if (G.screen === 'playing') scr.pause();
            NS.statusBar.showHighScores();
            break;
          case 'exit':
            NS.input.persist();
            if (User32) User32.DestroyWindow();
            break;
          case 'controls': if (SZ.Dialog) SZ.Dialog.show('controlsBackdrop'); break;
          case 'about': if (SZ.Dialog) SZ.Dialog.show('dlg-about'); break;
        }
      },
    });
  }

  if (SZ.Dialog && SZ.Dialog.wireAll) SZ.Dialog.wireAll();
  if (User32) {
    if (User32.EnableVisualStyles) User32.EnableVisualStyles();
    if (User32.SetWindowText) User32.SetWindowText('Endless Runner');
    if (User32.RegisterWindowProc) User32.RegisterWindowProc((msg) => { if (msg === 'WM_SIZE') NS.view.resize(); });
  }
  if (SZ.GameAudio && SZ.GameAudio.attachMuteButton) SZ.GameAudio.attachMuteButton();
  document.body.tabIndex = -1;

  NS.progress.dayStart();
  NS.sim.newDemo();
  scr.setScreen('title');
  if (!G.save.seen.intro && !NS.save.readRun()) NS.cine.play('intro', () => scr.setScreen('title'));
  else if (G.season) NS.progress.toast(G.season.name + ' is on: collect ' + G.season.token + 's in every mode!', G.season.color, 'gift');
  requestAnimationFrame(loop);
})();
