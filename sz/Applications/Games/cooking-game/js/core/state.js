;(function() {
  'use strict';

  /* G: the one shared state object. Screen state, menu cursor and mouse,
     the running day (guests, tickets, stations, pass, money, combo), the
     short-lived effect lists and the save data all live here as plain
     fields; systems, renderers and screens read and write them directly. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const { VIEW_W, STATE_TITLE, WAITER_DELAY } = NS.C;

  const G = {
    state: STATE_TITLE,
    animT: 0,
    /* ── menu screen state ── */
    hitAreas: [],
    menuCursor: 0,
    mouseX: -1,
    mouseY: -1,
    mouseDown: false,
    prevScreen: STATE_TITLE,
    helpPage: 0,
    helpFrom: STATE_TITLE,
    treeBranch: 0,
    treeSelected: null,
    treeLayout: null,
    treeBuyFlash: null,
    menuFade: 0.5,
    titleLooks: [
      SZ.PeopleArt.randomLook(Math.random, 'regular'),
      SZ.PeopleArt.randomLook(Math.random, 'kid'),
      SZ.PeopleArt.randomLook(Math.random, 'business')
    ],
    dayInfo: undefined,
    location: undefined,
    scene: undefined,
    customers: [],
    tickets: [],
    stations: {},
    pass: [],
    earned: 0,
    served: 0,
    walkouts: 0,
    combo: 0,
    spawned: 0,
    recent: [],
    rand: Math.random,
    mode: 'career',
    dayIndex: 0,
    flying: [],  // dishes arcing to a guest
    coins: [],  // coins flying to the earnings HUD
    bestCombo: 0,
    ticketSeq: 0,
    hasCritic: false,
    dayResult: null,
    chefX: VIEW_W / 2,
    chefTargetX: VIEW_W / 2,
    chefPose: 'idle',
    chefTimer: 0,
    ruinedServed: 0,  // dishes served in this run that were ruined
    perfectServed: 0,  // dishes served in this run that were perfect
    rushTimer: 0,  // seconds left on the Rush Hour Bell
    rushUsed: false,  // the bell rings once per day
    rescueUsed: false,  // Second Chance fires once per day
    endlessPhase: 0,  // current Endless Rush / Daily step (served / 8)
    sceneFade: 0,  // fade-in seconds after a venue switch
    dailyDate: '',  // date key of the running Daily Special
    waiter: null,  // { x, facing, state, target, dish } while fetching
    waiterTimer: WAITER_DELAY,
    waiterLook: null,
    /* ── juice: flights, pops, rings and screen moods ── */
    arcs: [],  // finished dishes arcing from a station to the pass
    pops: [],  // step-finish text popping in (scale 1.4 -> 1)
    rings: [],  // expanding rings: goal stars, VIP arrival, combo
    fade: 0,  // black overlay between screens, 1 -> 0
    earnedShown: 0,  // earnings number rolling up to earned
    meterTick: 0,  // HUD meter flash seconds left after a coin lands
    goalsHit: 0,  // career star goals already celebrated today
    comboBanner: null,  // { n, t } big 'COMBO ×n' banner
    edgeGlow: 0,  // gold screen-edge glow seconds left
    tension: 0,  // rush-moment vignette strength 0..1
    dayOverT: 0,  // seconds since the day-end panel opened
    dayIntro: 0,  // seconds left on the 'Day 1-1' opening banner
    starPopped: 0,  // day-end stars already popped with a coin sound
    carpet: null,  // { x, t } VIP red-carpet shimmer at a seat
    coach: null,  // { step, ticket, t, hideT } first-day coach marks
    coachSkip: null,  // { x, y, w, h } the 'Skip tips' button as drawn
    hudBump: 0,  // the earnings number bumps as a coin lands
    trashWobble: 0,  // the bin rocks after a toss
    hitFlash: null,  // { t, color } a short full-screen flash on a burn
    chefFacing: 1,  // the chef looks toward the station he works at
    stationPress: [0, 0, 0, 0, 0],  // a clicked station squashes for a beat
    save: null
  };

  NS.state = G;

})();
