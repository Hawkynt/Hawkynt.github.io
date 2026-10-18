/* The one shared game state object (G): screen state, the puzzle session, the mage, running
   effects, menu cursors and the save. Every module reads and writes it by plain property access. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const { STATE_PLAYING } = NS.consts;

  NS.state = {
    state: STATE_PLAYING,
    time: 0,
    /* the puzzle session */
    level: null, puzzle: null, history: [], historyCosts: [], mana: 0, manaTotal: 0, casts: 0, levelKind: 'campaign', levelIndex: 0, scene: null,
    sessionMode: 'campaign', // 'campaign' | 'trial' | 'daily'
    hintsLeft: 1, undosLeft: 5, lastShardGain: 0,
    theme: 0,
    selectedElement: 'fire',
    /* cached rule sets, invalidated whenever the tiles change */
    reachCache: null, actionsCache: null,
    /* the mage: pixel position in board space (64 px tiles) */
    hero: { x: 32, y: 32, dir: 'down', pose: 'idle', t: 0, scale: 1, alpha: 1 },
    walk: { from: -1, path: [], t: 0, onDone: null },
    stepCount: 0, // tiles the mage has stepped, for the every-other-step footfall
    pendingCast: null, // { action, standIdx, faceDir, phase, timer }
    winSeq: null, // { phase: 'walk' | 'enter' | 'done', t }
    /* visual effects */
    spells: [], // { kind, x, y, t, dur } in board space
    tileFx: [], // { index, oldCode, newCode, delay, elapsed, fired, dist }
    slide: null, // { fromIdx, toIdx, chasmIdx, t, dur, swallowed }
    tileShake: null,
    hintFx: null, // { action, t }
    hintBanner: { text: '', t: 0 },
    projectiles: [], // { x0, y0, x1, y1, t, dur, color, prev, next, action, changed } board space
    rings: [], // { x, y, t, dur, r0, r1, color, lw } in board space
    motes: [], // { x, y, vx, vy, size, phase } drifting over the board
    fade: 0, // screen-change fade, 1 -> 0
    elementBounce: null, // { id, at } the element bar icon bounce
    realmBanner: null, // { realm, t } the realm-restored banner
    panelAnim: null, // { at, starPlayed } the complete panel's pop-in
    unlockFx: null, // { realm, at } the realms-screen lock shatter
    hoverInvalidT: 0, // how long the pointer has rested on an invalid tile
    blinkT: 0, blinkNext: 3 + Math.random() * 2, blinkSquash: 0,
    gemT: 0, // the staff gem's idle sparkle timer
    /* hover */
    hoverIdx: -1,
    /* ── Menu navigation ── */
    hitAreas: [], menuCursor: 0, mouseX: -1, mouseY: -1,
    prevScreen: 'title', helpFrom: 'title', helpPage: 0,
    wardrobeCursor: 0,
    treeBranch: 0, treeSelected: null, treeLayout: null, treeBuyFlash: null,
    /* ── Help on first run ── */
    tutorialSeen: false,
    /* ── Persistence ── */
    save: { stars: {} },
    highScores: [],
    /* view scale, written by setupCanvas */
    viewScale: 1,
    /* the HUD Grimoire button, set while the HUD draws */
    grimoireChip: null,
    /* board geometry: tile size and the board origin in the view */
    TS: 64, boardX: 0, boardY: 0,
    /* the pointer in view space, null when it left the canvas */
    hoverPoint: null,
    /* the element bar buttons, set while the HUD draws */
    elementButtons: [],
    /* scorch and rubble marks under the board art, per tile */
    decals: {},
    /* the dt of the frame being drawn, for the menu easing */
    frameDt: 0
  };
})();
