/* Screen flow: switching screens with a curtain fade, toasts, and the routes between them -
   starting each mode (with the intro, chapter and boss cinematics and the dialogue between
   chapters in Story), Continue from the autosave, pause and resume, the tech tree, wardrobe,
   journal and help reachable from the title and the pause menu, and what follows a result.
   Owns G.screen and G.returnTo. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const G = NS.state;
  const ST = NS.story;

  const MENUS = { title: 1, map: 1, tree: 1, wardrobe: 1, journal: 1, help: 1, results: 1, paused: 1 };

  function setScreen(name) {
    if (G.screen === name) return;
    G.screen = name;
    G.fade = 1;
    G.menuCursor = 0;
    G.ui.scroll = 0;
    if (NS.dom.update) NS.dom.update();
  }

  function isMenu() {
    return !!MENUS[G.screen];
  }

  function toast(text, color) {
    G.toast.text = text;
    G.toast.color = color || '#ffd54a';
    G.toast.t = 3.2;
  }

  /* ── Story ── */
  function openStory() {
    if (!G.save.story.cine.intro) {
      G.save.story.cine.intro = 1;
      NS.save.writeSave();
      NS.cinema.play('intro', {}, () => openMap());
      return;
    }
    openMap();
  }

  function openMap() {
    NS.map.focusLatest();
    setScreen('map');
  }

  function playLevel(ch, lv) {
    const go = () => {
      if (ST.CHAPTERS[ch].kinds[lv] === 'boss')
        NS.cinema.play('boss', { ch }, () => launch('story', { ch, lv }));
      else launch('story', { ch, lv });
    };
    const key = 'ch' + ch;
    if (lv === 0 && !G.save.story.cine[key]) {
      G.save.story.cine[key] = 1;
      NS.save.writeSave();
      NS.cinema.dialogue(ST.DIALOGUE[ch], () => NS.cinema.play('chapter', { ch }, go));
      return;
    }
    go();
  }

  function launch(mode, opts) {
    NS.run.start(mode, opts);
    setScreen('playing');
  }

  function startMode(mode) {
    if (mode === 'story') { openStory(); return; }
    launch(mode, {});
  }

  function canContinue() {
    return !!NS.save.readRun();
  }

  function continueRun() {
    const snap = NS.save.readRun();
    if (!snap || !NS.run.restore(snap)) { toast('Nothing to continue', '#ff5d5d'); return; }
    setScreen('playing');
  }

  /* ── Pause and the overlays reachable from it ── */
  function pause() {
    if (G.screen !== 'playing') return;
    NS.run.autosave();
    setScreen('paused');
  }

  function resume() {
    if (!G.run) { setScreen('title'); return; }
    G.input.held.length = 0;
    setScreen('playing');
  }

  function openOverlay(name) {
    if (G.screen === 'playing') pause();
    if (G.screen === name) return;
    G.returnTo = G.screen === 'cinema' ? 'title' : G.screen;
    setScreen(name);
  }

  function back() {
    let to = G.returnTo || 'title';
    G.returnTo = 'title';
    if (to === 'paused' && !G.run) to = 'title';
    setScreen(to);
  }

  function quitToTitle() {
    if (G.run) NS.run.quit();
    setScreen('title');
  }

  /* ── After the results screen ── */
  function afterResults(action) {
    const r = G.results;
    if (action === 'title' || !r) { setScreen('title'); return; }
    if (r.mode !== 'story') {
      if (action === 'retry') launch(r.mode, {});
      else setScreen('title');
      return;
    }
    if (action === 'retry') { playLevel(r.ch, r.lv); return; }
    if (action === 'map') { openMap(); return; }
    /* next */
    if (r.chapterDone && r.ch === ST.CHAPTERS.length - 1) {
      NS.cinema.dialogue(ST.DIALOGUE[ST.CHAPTERS.length], () => NS.cinema.play('finale', {}, () => openMap()));
      return;
    }
    let ch = r.ch, lv = r.lv + 1;
    if (lv >= ST.LEVELS_PER_CHAPTER) { ++ch; lv = 0; }
    if (ch >= ST.CHAPTERS.length) { openMap(); return; }
    playLevel(ch, lv);
  }

  Object.assign(NS.screens, {
    setScreen, isMenu, toast, openStory, openMap, playLevel, launch, startMode, canContinue, continueRun, pause, resume,
    openOverlay, back, quitToTitle, afterResults
  });
})();
