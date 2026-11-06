/* Bootstrap: the fixed 60 Hz loop (as many simulation steps as are due, then one draw), the
   window menu bar, background pre-painting of belt, outpost and fleet art while menus are
   idle, autosave when the page hides, and start-up. Owns the loop clock. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { STEP, STEP_MS, MAX_STEPS, STEP_SNAP_MS } = NS.constants;
  const { ZONES, ORES } = NS.ores;
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

  /* paint one piece of belt art per idle menu frame so trips never stall on first sight */
  const jobs = [];
  for (let z = 0; z < ZONES.length; ++z) {
    jobs.push(() => NS.backdropArt.nebulaLayer(z, ZONES[z].theme));
    for (let t = 1; t <= 4; ++t)
      for (let v = 0; v < 4; ++v) jobs.push(() => NS.rockArt.body(t, v, ZONES[z].theme.rock));
  }
  /* vein overlays only for the ore of belts already licensed */
  const reach = NS.economy.reachableOres(G.save);
  for (let i = 0; i < ORES.length; ++i) {
    if (reach.indexOf(ORES[i].id) < 0) continue;
    for (let t = 1; t <= 4; ++t)
      for (let v = 0; v < 4; ++v) jobs.push(() => NS.rockArt.veins(t, v, ORES[i].id));
  }

  /* outpost and fleet art too, so the first command view does not stall */
  const { BUILDINGS } = NS.colonyData;
  for (let i = 0; i < BUILDINGS.length; ++i)
    for (let l = 1; l <= 3; ++l) jobs.push(() => NS.colonyArt.building(BUILDINGS[i].id, l));
  for (let i = 0; i < NS.fleetData.UNITS.length; ++i) jobs.push(() => NS.fleetArt.unit(NS.fleetData.UNITS[i].id));
  for (let i = 0; i < NS.fleetData.ENEMIES.length; ++i) jobs.push(() => NS.fleetArt.enemy(NS.fleetData.ENEMIES[i].id));

  function prewarm() {
    if (warm >= jobs.length || G.screen === 'playing' || G.time < 0.6) return;
    const t0 = performance.now();
    while (warm < jobs.length && performance.now() - t0 < 4) jobs[warm++]();
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
            if (G.cine) break;
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
            if (G.cine) break;
            if (G.screen === 'playing') scr.pause();
            scr.openHelp(G.screen === 'paused' ? 'paused' : G.screen === 'help' ? G.helpReturn : G.screen);
            break;
          case 'controls': SZ.Dialog.show('controlsBackdrop'); break;
          case 'about': SZ.Dialog.show('dlg-about'); break;
        }
      },
    });
  }

  if (User32) {
    User32.EnableVisualStyles && User32.EnableVisualStyles();
    User32.SetWindowText && User32.SetWindowText('Space Mining');
  }
  if (SZ.GameAudio) SZ.GameAudio.attachMuteButton();
  /* autosave the trip when the page goes away, so Continue resumes right there */
  window.addEventListener('pagehide', () => NS.resume.save());
  document.addEventListener('visibilitychange', () => { if (document.hidden) NS.resume.save(); });
  document.body.tabIndex = -1;

  NS.backdrop.setZone(0);
  NS.statusBar.update();
  if (!G.save.seenHelp) {
    G.save.seenHelp = true;
    scr.toast('New pilot? Press H for How to Play', '#ffb44a');
  }
  if (G.save.migrated && G.save.stats.trips === 0 && G.save.credits > NS.rules.START_CREDITS)
    scr.toast('Welcome back, veteran - your best haul became ' + NS.kit.group(G.save.credits - NS.rules.START_CREDITS) + ' starting credits', '#ffd25a');
  requestAnimationFrame(loop);
})();
