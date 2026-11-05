/* Start-up and the loop: a fixed 60 Hz simulation (as many steps as are due, then one draw), the
   window menu bar, the daily bookkeeping on launch, background pre-painting of board themes and
   scenery, and the first-visit intro. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
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
    NS.frame.draw(Math.min(0.1, elapsed / 1000));
    NS.statusBar.tick();
    prewarm();
    requestAnimationFrame(loop);
  }

  /* paint one theme's scenery or tiles per idle menu frame so the first levels never stall */
  function prewarm() {
    if (warm >= 7 || G.screen === 'playing' || G.time < 0.6) return;
    NS.backdrop.scene(warm);
    NS.tileArt.wall(warm);
    for (let v = 0; v < 4; ++v) NS.tileArt.floor(warm, v);
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
            if (G.screen === 'playing') scr.pause();
            if (G.screen !== 'cine') scr.open('tree', G.screen === 'tree' ? G.back.tree : G.screen);
            break;
          case 'wardrobe':
            if (G.screen === 'playing') scr.pause();
            if (G.screen !== 'cine') scr.open('wardrobe', G.screen === 'wardrobe' ? G.back.wardrobe : G.screen);
            break;
          case 'journal':
            if (G.screen === 'playing') scr.pause();
            if (G.screen !== 'cine') scr.open('journal', G.screen === 'journal' ? G.back.journal : G.screen);
            break;
          case 'high-scores':
            if (G.screen === 'playing') scr.pause();
            NS.statusBar.showHighScores();
            break;
          case 'exit':
            NS.input.persist();
            if (User32) User32.DestroyWindow();
            break;
          case 'tutorial':
            if (G.screen === 'playing') scr.pause();
            if (G.screen !== 'cine') scr.open('help', G.screen === 'help' ? G.back.help : G.screen);
            break;
          case 'controls': if (SZ.Dialog) SZ.Dialog.show('controlsBackdrop'); break;
          case 'about': if (SZ.Dialog) SZ.Dialog.show('dlg-about'); break;
        }
      },
    });
  }

  if (User32) {
    if (User32.EnableVisualStyles) User32.EnableVisualStyles();
    if (User32.SetWindowText) User32.SetWindowText('Snake');
  }
  if (SZ.GameAudio && SZ.GameAudio.attachMuteButton) SZ.GameAudio.attachMuteButton();
  document.body.tabIndex = -1;

  NS.progress.dayStart();
  scr.setScreen('title');
  if (!G.save.seen.intro && !NS.save.readRun()) NS.cine.play('intro', () => scr.setScreen('title'));
  else if (G.season) NS.progress.toast(G.season.name + ' is on: collect festival tokens in every mode!', G.season.color, 'gift');
  requestAnimationFrame(loop);
})();
