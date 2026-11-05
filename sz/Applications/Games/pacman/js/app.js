/* Bootstrap: the fixed 60 Hz loop (as many simulation steps as are due, then one draw), the
   window menu bar, pre-painting world art while the title is idle, the attract demo and the
   welcome messages. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { STEP, STEP_MS, MAX_STEPS, STEP_SNAP_MS } = NS.constants;
  const { WORLDS } = NS.worlds;
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

  /* paint one piece of art per idle menu frame so the first maze never stalls */
  const jobs = [];
  for (let w = 0; w < WORLDS.length; ++w) jobs.push(() => NS.backdrop.scene(WORLDS[w].theme));
  jobs.push(() => { for (let m = 0; m < 7; ++m) NS.actorArt.pac(G.profile.skin, m); });
  jobs.push(() => { for (let f = 0; f < 2; ++f) { NS.actorArt.scared(f, false); NS.actorArt.scared(f, true); } });
  for (let d = 0; d < 4; ++d) jobs.push(() => NS.actorArt.eyes(d));
  jobs.push(() => NS.backdrop.seasonDecor(G.season.id));

  function prewarm() {
    if (warm >= jobs.length || G.screen === 'playing' || G.time < 0.5) return;
    const t0 = performance.now();
    while (warm < jobs.length && performance.now() - t0 < 6) jobs[warm++]();
  }

  if (SZ.MenuBar) {
    new SZ.MenuBar({
      onAction(action) {
        switch (action) {
          case 'new': scr.toTitle(); break;
          case 'continue': if (G.screen !== 'playing' && G.savedRun) scr.continueRun(); break;
          case 'pause':
            if (G.screen === 'playing') scr.pause();
            else if (G.screen === 'pause') scr.resume();
            break;
          case 'tree':
            if (G.screen === 'cine') break;
            if (G.screen === 'playing') { scr.pause(); scr.openTree('pause'); }
            else if (G.screen !== 'tree') scr.openTree(G.screen);
            break;
          case 'wardrobe':
            if (G.screen === 'cine') break;
            if (G.screen === 'playing') scr.pause();
            if (G.screen !== 'wardrobe') scr.openWardrobe(G.screen);
            break;
          case 'goals':
            if (G.screen === 'cine') break;
            if (G.screen === 'playing') scr.pause();
            if (G.screen !== 'goals') scr.openGoals(G.screen);
            break;
          case 'high-scores':
            if (G.screen === 'playing') scr.pause();
            NS.statusBar.showHighScores();
            break;
          case 'exit': if (User32) User32.DestroyWindow(); break;
          case 'tutorial':
            if (G.screen === 'cine') break;
            if (G.screen === 'playing') scr.pause();
            if (G.screen !== 'help') scr.openHelp(G.screen);
            break;
          case 'controls': SZ.Dialog.show('controlsBackdrop'); break;
          case 'about': SZ.Dialog.show('dlg-about'); break;
        }
      },
    });
  }

  if (User32) {
    User32.EnableVisualStyles && User32.EnableVisualStyles();
    User32.SetWindowText && User32.SetWindowText('Pac-Man');
  }
  if (SZ.GameAudio && SZ.GameAudio.attachMuteButton) SZ.GameAudio.attachMuteButton();
  document.body.tabIndex = -1;

  scr.setScreen('title');
  const p = G.profile;
  if (p.veteran && !p.seen.veteran) {
    p.seen.veteran = true;
    scr.toast('Welcome back! Your old high scores earned ' + p.veteran + ' shards', '#ffd23a');
  }
  if (!p.seenHelp) {
    p.seenHelp = true;
    scr.toast('New here? Press H for How to Play', '#4ad8ff');
  }
  if (G.savedRun) scr.toast('Your last run is waiting - Continue', '#5aff9a');
  NS.save.writeProfile();
  requestAnimationFrame(loop);
})();
