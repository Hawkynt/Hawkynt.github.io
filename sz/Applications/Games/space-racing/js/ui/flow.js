/*
 * Screen flow: entering menus, pause, the Workshop and back, Esc on menu screens
 * and the window title. Writes G.state, G.menuCursor and G.hitAreas.
 */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.SpaceRacing;
  const G = NS.state;
  const { STATE_TITLE, STATE_CAREER, STATE_CUP_INTRO, STATE_TRACKS, STATE_GARAGE, STATE_TREE,
    STATE_PLAYING, STATE_PAUSED, STATE_RESULTS, STATE_STANDINGS } = NS.constants;
  const { getOrdinal } = NS.util;
  const { User32 } = NS.runtime;
  const { prepareTrack } = NS.raceSetup;

  // Workshop tree screen
  let treeReturnState = STATE_TITLE;

  function gotoState(next) {
    G.state = next;
    G.menuCursor = 0;
    G.hitAreas.length = 0;
    SZ.GameAudio.play('select');
    updateWindowTitle();
  }

  function enterTitle() {
    gotoState(STATE_TITLE);
  }

  function enterCareer() {
    gotoState(STATE_CAREER);
  }

  function enterTracks() {
    gotoState(STATE_TRACKS);
  }

  function enterGarage() {
    gotoState(STATE_GARAGE);
    G.menuCursor = G.selectedShipIndex;
  }

  function openCupIntro(cupIndex, raceIndex) {
    G.chosenCup = cupIndex;
    G.cupIntroRace = raceIndex;
    gotoState(STATE_CUP_INTRO);
  }

  function pauseRacing() {
    G.state = STATE_PAUSED;
    G.hitAreas.length = 0;
    G.menuCursor = 0;
  }

  function enterTree() {
    treeReturnState = G.state;
    G.state = STATE_TREE;
    G.hitAreas.length = 0;
    G.treeBranch = 0;
    G.treeSelected = null;
    G.treeLayout = null;
    updateWindowTitle();
  }

  function leaveTree() {
    G.state = treeReturnState;
    G.hitAreas.length = 0;
    if (G.state === STATE_TITLE)
      prepareTrack();   // refresh the ship stats with everything just bought
    updateWindowTitle();
  }

  function isMenuState(s) {
    return s === STATE_TITLE || s === STATE_CAREER || s === STATE_CUP_INTRO ||
      s === STATE_TRACKS || s === STATE_GARAGE || s === STATE_RESULTS || s === STATE_STANDINGS;
  }

  function menuEscape() {
    if (G.state === STATE_CAREER || G.state === STATE_TRACKS || G.state === STATE_GARAGE || G.state === STATE_RESULTS)
      enterTitle();
    else if (G.state === STATE_CUP_INTRO || G.state === STATE_STANDINGS)
      enterCareer();
    else if (G.state === STATE_PAUSED)
      G.state = STATE_PLAYING;
  }

  function updateWindowTitle() {
    let title;
    if (G.state === STATE_GARAGE)
      title = 'Space Racing -- Garage';
    else if (G.state === STATE_TREE)
      title = 'Space Racing -- Workshop';
    else if (G.state === STATE_RESULTS)
      title = `Space Racing -- ${getOrdinal(G.playerPlace)} Place -- ${G.track.name}`;
    else
      title = `Space Racing -- ${G.track.name}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  Object.assign(NS.module('flow'), {
    gotoState, enterTitle, enterCareer, enterTracks, enterGarage, openCupIntro, pauseRacing, enterTree,
    leaveTree, isMenuState, menuEscape, updateWindowTitle
  });
})();
