/* Bootstrap: the fixed 60 Hz loop (as many simulation steps as are due, then one draw), the
   window menu bar, idle pre-painting of chapter art, the season's opening on the first visit of
   a season, and start-up. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { STEP, STEP_MS, MAX_STEPS, STEP_SNAP_MS } = NS.constants;
  const scr = NS.screens;
  const User32 = SZ.Dlls && SZ.Dlls.User32;

  let last = 0;
  let acc = 0;

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
    NS.music.update(elapsed / 1000);
    NS.frame.draw();
    NS.rockArt.warmStep(G.screen === 'playing' ? 1 : 3);
    NS.statusBar.tick(elapsed / 1000);
    if (G.screen !== 'playing' && G.time > 0.6) NS.backdrop.prewarm();
    requestAnimationFrame(loop);
  }

  if (SZ.MenuBar) {
    new SZ.MenuBar({
      onAction(action) {
        switch (action) {
          case 'new':
            if (scr.inRun()) scr.quitToTitle();
            else scr.setScreen('title');
            break;
          case 'pause':
            if (G.screen === 'playing') scr.pause();
            else if (G.screen === 'paused') scr.resume();
            break;
          case 'tree':
            if (G.screen === 'playing') scr.pause();
            if (G.screen === 'paused') scr.open('tree', 'paused');
            else if (scr.isMenu()) scr.open('tree', G.screen === 'tree' ? G.returns.tree : G.screen);
            break;
          case 'wardrobe':
            if (G.screen === 'playing') scr.pause();
            if (G.screen === 'paused') scr.open('wardrobe', 'paused');
            else if (scr.isMenu()) scr.open('wardrobe', G.screen === 'wardrobe' ? G.returns.wardrobe : G.screen);
            break;
          case 'goals':
            if (G.screen === 'playing') scr.pause();
            if (G.screen === 'paused') scr.open('goals', 'paused');
            else if (scr.isMenu()) scr.open('goals', G.screen === 'goals' ? G.returns.goals : G.screen);
            break;
          case 'high-scores':
            if (G.screen === 'playing') scr.pause();
            NS.statusBar.showHighScores();
            break;
          case 'exit': if (User32) User32.DestroyWindow(); break;
          case 'tutorial':
            if (G.screen === 'playing') scr.pause();
            if (G.screen === 'paused') scr.open('help', 'paused');
            else if (scr.isMenu()) scr.open('help', G.screen === 'help' ? G.returns.help : G.screen);
            break;
          case 'controls': SZ.Dialog.show('controlsBackdrop'); break;
          case 'music': if (SZ.GameMusic) SZ.GameMusic.toggle(); break;
          case 'about': SZ.Dialog.show('dlg-about'); break;
        }
      },
    });
  }

  if (User32) {
    User32.EnableVisualStyles && User32.EnableVisualStyles();
    User32.SetWindowText && User32.SetWindowText('Asteroids');
  }
  if (SZ.GameAudio) SZ.GameAudio.attachMuteButton();
  document.body.tabIndex = -1;

  NS.backdrop.setChapter(-1);
  for (const t of ['normal', 'iron', 'crystal', 'gold', 'ice', G.cal.seasonDef.token, 'explosive', 'lava', 'electric', 'void']) NS.rockArt.want(t);
  NS.statusBar.update();
  NS.sim.startDemo();
  NS.cinematics.seasonIntro(() => scr.setScreen('title'));
  if (!G.save.seenHelp) {
    G.save.seenHelp = true;
    NS.save.writeSave();
    scr.toast('New pilot? Press H for How to Play', '#5ad8ff');
  }
  if (NS.snapshot.has()) scr.toast('Your last flight is waiting - Continue', '#6dff9a');
  requestAnimationFrame(loop);
})();
