/* Bootstrap: opens the play session (season, streak, quests), the fixed 60 Hz loop (as many
   simulation steps as are due, then one draw), background pre-painting of art in menus, saving
   on page hide and unload, the window menu bar and start-up. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const scr = NS.screens;
  const User32 = SZ.Dlls && SZ.Dlls.User32;

  let last = 0;
  let acc = 0;
  let warm = 0;

  function loop(ts) {
    if (!last) last = ts;
    let elapsed = ts - last;
    last = ts;
    if (Math.abs(elapsed - C.STEP_MS) < C.STEP_SNAP_MS) elapsed = C.STEP_MS;
    acc = Math.min(acc + elapsed, C.STEP_MS * C.MAX_STEPS);
    const t0 = performance.now();
    while (acc >= C.STEP_MS) {
      acc -= C.STEP_MS;
      NS.sim.update(C.STEP);
      NS.backdrop.seasonTick(C.STEP);
    }
    G.perf.sim = performance.now() - t0;
    G.perf.simAvg = G.perf.simAvg * 0.95 + G.perf.sim * 0.05;
    NS.frame.draw();
    NS.statusBar.tick(elapsed / 1000);
    prewarm();
    requestAnimationFrame(loop);
  }

  /* paint one batch of art per idle menu frame so the first stage never stalls */
  function prewarm() {
    if (G.screen === 'playing' || G.time < 0.4 || warm > 12) return;
    if (warm < 5) NS.tileArt.warm(warm);
    else if (warm === 5) NS.itemArt.warm();
    else if (!NS.backdrop.warm(warm - 6)) warm = 12;
    ++warm;
  }

  function persist() {
    if (G.run && !G.run.over && (G.screen === 'playing' || G.screen === 'paused' || G.screen === 'results' || NS.screens.inRun())) NS.save.saveRun();
    NS.save.writeSave();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
  window.addEventListener('pagehide', persist);
  window.addEventListener('beforeunload', persist);

  if (SZ.MenuBar) {
    new SZ.MenuBar({
      onAction(action) {
        switch (action) {
          case 'new':
            if (G.screen === 'playing' || G.screen === 'paused') NS.run.suspend();
            G.cine = null;
            scr.setScreen('title');
            break;
          case 'pause':
            if (G.screen === 'playing') scr.pause();
            else if (G.screen === 'paused') scr.resume();
            break;
          case 'tree':
            if (G.screen === 'playing') { scr.pause(); scr.open('tree', 'paused'); }
            else if (G.screen === 'paused') scr.open('tree', 'paused');
            else if (G.screen !== 'tree' && G.screen !== 'cine') scr.open('tree', G.screen === 'results' ? 'results' : G.screen);
            break;
          case 'wardrobe':
            if (G.screen === 'playing') scr.pause();
            if (G.screen !== 'cine') scr.open('wardrobe', G.screen === 'paused' ? 'paused' : G.screen);
            break;
          case 'high-scores':
            if (G.screen === 'playing') scr.pause();
            NS.statusBar.showHighScores();
            break;
          case 'exit':
            persist();
            if (User32) User32.DestroyWindow();
            break;
          case 'tutorial':
            if (G.screen === 'playing') scr.pause();
            if (G.screen !== 'cine') scr.open('help', G.screen === 'paused' ? 'paused' : G.screen);
            break;
          case 'controls': SZ.Dialog.show('controlsBackdrop'); break;
          case 'about': SZ.Dialog.show('dlg-about'); break;
        }
      }
    });
  }
  if (SZ.Dialog && SZ.Dialog.wireAll) SZ.Dialog.wireAll();

  if (User32) {
    if (User32.EnableVisualStyles) User32.EnableVisualStyles();
    if (User32.SetWindowText) User32.SetWindowText('Bomberman');
    if (User32.RegisterWindowProc) User32.RegisterWindowProc((msg) => { if (typeof WM_SIZE !== 'undefined' && msg === WM_SIZE) NS.view.resize(); });
  }
  if (SZ.GameAudio && SZ.GameAudio.attachMuteButton) SZ.GameAudio.attachMuteButton();
  document.body.tabIndex = -1;

  const session = NS.save.startSession(new Date());
  NS.backdrop.setScene('village');
  NS.save.probeContinue();
  scr.setScreen('title');
  if (session.streakBonus) scr.toast('Day ' + session.streak + ' streak  +' + session.streakBonus + ' gems', '#ff8a3c', 'fire');
  scr.toast(G.season.def.name + ' event is on - collect ' + G.season.def.token.toLowerCase() + '!', G.season.def.color, G.season.def.tokenIcon);
  if (!G.save.seen.help) {
    G.save.seen.help = true;
    scr.toast('New here? Open How to Play (H)', '#7cf08a', 'help');
  }
  NS.tracker.check();
  requestAnimationFrame(loop);
})();
