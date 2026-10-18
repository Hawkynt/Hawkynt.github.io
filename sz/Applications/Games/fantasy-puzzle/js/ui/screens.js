/* Screen switching, help entry/exit, the status bar and the window title. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { ELEMENT_BY_ID, isMenuState } = NS.consts;
  const { statusLevel, statusElement, statusMoves, statusStars, User32 } = NS.context;
  const { saveTutorialSeen } = NS.store;
  const { realmInfo } = NS.session;

  /* ── screen switching ── */
  function setScreen(name) {
    G.state = name;
    G.menuCursor = 0;
    G.hitAreas.length = 0;
    G.realmBanner = null;
    G.fade = 1;
    updateStatusBar();
  }

  function openHelp() {
    G.helpFrom = isMenuState(G.state) ? G.state : 'title';
    G.helpPage = 0;
    setScreen('help');
  }

  function leaveHelp() {
    if (!G.tutorialSeen) {
      G.tutorialSeen = true;
      saveTutorialSeen();
    }
    setScreen(G.helpFrom);
  }

  const SCREEN_NAMES = { title: 'Title', realms: 'Realms', trials: 'Trials', grimoire: 'Grimoire', wardrobe: 'Wardrobe', help: 'Help' };

  function updateStatusBar() {
    if (isMenuState(G.state)) {
      if (statusLevel) statusLevel.textContent = `Screen: ${SCREEN_NAMES[G.state]}`;
      if (statusElement) statusElement.textContent = 'Element: —';
      if (statusMoves) statusMoves.textContent = 'Casts: —';
      if (statusStars) statusStars.textContent = 'Mana: —';
      return;
    }
    if (statusLevel) statusLevel.textContent = `Level: ${G.level.id}`;
    if (statusElement) {
      const el = ELEMENT_BY_ID[G.selectedElement];
      statusElement.textContent = `Element: ${el ? el.name : '—'}`;
    }
    if (statusMoves) statusMoves.textContent = `Casts: ${G.casts}`;
    if (statusStars) statusStars.textContent = `Mana: ${G.mana} / ${G.manaTotal}`;
  }

  function updateWindowTitle() {
    const title = `Fantasy Puzzle — ${realmInfo().name}: ${G.level ? G.level.name : ''}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  NS.screens = { setScreen, updateWindowTitle, updateStatusBar, openHelp, leaveHelp };
})();
