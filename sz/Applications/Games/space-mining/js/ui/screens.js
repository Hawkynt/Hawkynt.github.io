/* Screen switching: entering a screen resets the cursor and timers and saves; the tech tree and
   help remember where they were opened from (title, station, map or the pause menu); pausing
   and resuming a trip, starting a career or mode run (with its launch cinematic), toasts and
   achievement pop-ups. Owns G.screen and the return targets. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { sfx } = NS.audio;

  const MENU_SCREENS = { title: 1, station: 1, map: 1, tree: 1, help: 1, results: 1 };

  function isMenu(s) {
    return !!MENU_SCREENS[s || G.screen];
  }

  /* a trip is open (playing, paused, or a screen opened from the pause menu) */
  function inRun() {
    return !!G.run && (G.screen === 'playing' || G.screen === 'paused' ||
      (G.screen === 'tree' && G.treeReturn === 'paused') || (G.screen === 'help' && G.helpReturn === 'paused'));
  }

  function setScreen(name) {
    if (name === 'title' || name === 'station' || name === 'map') {
      if (G.run && name === 'title') {
        G.run = null;
        G.ship = null;
        G.cine = null;
      }
      if (name !== 'map') NS.backdrop.setZone(name === 'station' ? 0 : NS.backdrop.current());
    }
    G.screen = name;
    G.screenT = 0;
    G.menuCursor = 0;
    G.hitAreas.length = 0;
    G.input.mouseDown = false;
    G.input.firing = false;
    if (name !== 'playing' && name !== 'cine') NS.save.writeSave();
    NS.statusBar.update();
  }

  function pause() {
    if (G.screen !== 'playing' || (G.cine && G.cine.kind === 'docking')) return;
    setScreen('paused');
    sfx('blip', { pitch: 0.7 });
  }

  function resume() {
    if (G.screen !== 'paused') return;
    setScreen('playing');
    sfx('blip');
  }

  function openTree(from) {
    G.treeReturn = from || G.screen;
    setScreen('tree');
  }

  function openHelp(from) {
    G.helpReturn = from || G.screen;
    G.ui.helpPage = 0;
    setScreen('help');
  }

  /* Career: the intro the first time, then the station */
  function career() {
    if (!G.save.seenIntro) {
      G.save.seenIntro = true;
      NS.save.writeSave();
      setScreen('station');
      NS.cinematics.play('intro', {}, () => setScreen('station'));
      return;
    }
    setScreen('station');
  }

  /* Launch into a belt (career from the map, or a mode from the title) */
  function launch(mode, zoneIndex) {
    const z = mode === 'daily' ? null : NS.ores.ZONES[zoneIndex];
    NS.cinematics.play('launch', { zone: z || NS.ores.ZONES[NS.rng.hashString(NS.rng.dayKey()) % 3 + 1] }, () => NS.trip.startTrip(mode, zoneIndex));
  }

  function toast(text, color) {
    G.ui.toast = { text: text, color: color || '#ffd25a', t: 0 };
  }

  function achievements(list) {
    for (let i = 0; i < list.length; ++i) {
      G.ui.popups.unshift({ name: list[i].name, desc: list[i].desc, rd: list[i].rd, t: 0 });
      sfx('levelup', { volume: 0.6 });
    }
    if (G.ui.popups.length > 3) G.ui.popups.length = 3;
  }

  Object.assign(NS.screens, {
    isMenu, inRun, setScreen, pause, resume, openTree, openHelp, career, launch, toast, achievements
  });
})();
