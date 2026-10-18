/* The puzzle session and modes: unlock rules, the daily puzzle, loading / restarting / advancing
   levels. Owns G.level/puzzle/history/mana/casts and resets every running effect. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { HINT_BANNER_TIME, MOTE_COUNT, MAX_MOTES, STATE_PLAYING } = NS.consts;
  const { sfx, particles, floatingText, fxBoard, fxScreen } = NS.context;
  const { computeBoard, colOf, rowOf } = NS.view;
  const { writeSave } = NS.store;
  const { invalidateCaches } = NS.rules;
  const { treeLevel } = NS.grimoire;

  function localDateString() {
    const d = new Date();
    const m = String(d.getMonth() + 1);
    const day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }

  /* FNV-1a over the local date picks one stable trial per day */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; ++i) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function dailyIndex() {
    return fnv1a(localDateString()) % SZ.PuzzleLevels.BONUS.length;
  }

  function campaignUnlocked(i) {
    const list = SZ.PuzzleLevels.CAMPAIGN;
    if (i <= 0)
      return true;
    if (i >= list.length)
      return false;
    if (!(G.save.stars[list[i - 1].id] >= 1))
      return false;
    /* the first level of a realm also requires the last level of the previous realm */
    if (list[i].realm !== list[i - 1].realm) {
      let prevLast = i - 1;
      while (prevLast > 0 && list[prevLast].realm === list[prevLast - 1].realm)
        --prevLast;
      if (!(G.save.stars[list[prevLast].id] >= 1))
        return false;
    }
    return true;
  }

  function campaignStarCount() {
    let n = 0;
    for (const lv of SZ.PuzzleLevels.CAMPAIGN)
      if (G.save.stars[lv.id] >= 1)
        ++n;
    return n;
  }

  function trialUnlocked(i) {
    const list = SZ.PuzzleLevels.BONUS;
    if (i < 0 || i >= list.length)
      return false;
    if (campaignStarCount() < 10)
      return false;
    if (i < 6)
      return true;
    return G.save.stars[list[i - 1].id] >= 1;
  }

  function solvedTrialCount() {
    let n = 0;
    for (const lv of SZ.PuzzleLevels.BONUS)
      if (G.save.stars[lv.id] >= 1)
        ++n;
    return n;
  }

  /* a realm is open once its first campaign level is */
  function realmUnlocked(r) {
    return campaignUnlocked(r * 8);
  }

  function dailySub() {
    if (G.save.daily.date === localDateString() && G.save.daily.solved)
      return 'Solved ' + '★'.repeat(G.save.daily.stars) + '☆'.repeat(3 - G.save.daily.stars);
    return 'New puzzle';
  }

  function loadDailyPuzzle() {
    const today = localDateString();
    if (G.save.daily.date !== today) {
      G.save.daily = { date: today, solved: false, stars: 0 };
      writeSave();
    }
    loadPuzzle('bonus', dailyIndex());
    G.sessionMode = 'daily';
  }

  function levelList(kind) {
    return kind === 'campaign' ? SZ.PuzzleLevels.CAMPAIGN : SZ.PuzzleLevels.BONUS;
  }

  function realmInfo() {
    return SZ.PuzzleLevels.REALMS[G.theme];
  }

  function realmElements() {
    return realmInfo().elements;
  }

  function loadPuzzle(kind, index) {
    const list = levelList(kind);
    index = Math.max(0, Math.min(list.length - 1, index | 0));
    G.level = list[index];
    G.levelKind = kind;
    G.levelIndex = index;
    G.puzzle = SZ.PuzzleCore.parseLevel(G.level);
    G.history = [];
    G.historyCosts = [];
    G.sessionMode = kind === 'campaign' ? 'campaign' : 'trial';
    G.manaTotal = G.level.mana + treeLevel('a_well') + treeLevel('a_deep');
    G.mana = G.manaTotal;
    G.casts = 0;
    G.hintsLeft = 1 + treeLevel('i_hint');
    G.undosLeft = treeLevel('c_free') ? Infinity : 5 + 5 * treeLevel('c_undo');
    G.lastShardGain = 0;
    G.theme = G.level.realm < 0 ? (index % SZ.PuzzleLevels.REALMS.length) : G.level.realm;
    G.scene = SZ.PuzzleScene.create(G.theme);
    computeBoard();
    if (realmElements().indexOf(G.selectedElement) < 0)
      G.selectedElement = realmElements()[0];
    /* reset the mage and every running effect */
    G.hero.x = colOf(G.puzzle.hero) * 64 + 32;
    G.hero.y = rowOf(G.puzzle.hero) * 64 + 32;
    G.hero.dir = 'down';
    G.hero.pose = 'idle';
    G.hero.t = 0;
    G.hero.scale = 1;
    G.hero.alpha = 1;
    G.walk = { from: G.puzzle.hero, path: [], t: 0, onDone: null };
    G.pendingCast = null;
    G.winSeq = null;
    G.spells = [];
    G.tileFx = [];
    G.slide = null;
    G.tileShake = null;
    G.hintFx = null;
    G.hoverIdx = -1;
    G.projectiles = [];
    G.rings = [];
    G.motes = [];
    ensureMotes();
    G.panelAnim = null;
    G.elementBounce = null;
    G.realmBanner = null;
    G.hoverInvalidT = 0;
    G.blinkT = 0;
    G.blinkSquash = 0;
    G.gemT = 0;
    particles.clear();
    fxBoard.clear();
    fxScreen.clear();
    floatingText.clear();
    G.hintBanner = { text: G.level.hint || '', t: G.level.hint ? HINT_BANNER_TIME : 0 };
    for (const k in G.decals)
      delete G.decals[k];
    invalidateCaches();
    G.state = STATE_PLAYING;
    G.menuCursor = 0;
    G.fade = 1;
    NS.screens.updateWindowTitle();
  }

  /* the ambient motes over the board, seeded to the current board size */
  function ensureMotes() {
    while (G.motes.length < Math.min(MOTE_COUNT, MAX_MOTES)) {
      G.motes.push({
        x: Math.random() * G.puzzle.cols * 64,
        y: Math.random() * G.puzzle.rows * 64,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 5,
        size: 1 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function restartLevel() {
    const mode = G.sessionMode;
    loadPuzzle(G.levelKind, G.levelIndex);
    G.sessionMode = mode;
    sfx('whoosh', { pitch: 0.7 });
  }

  /* Next stays inside the current kind: campaign walks on through the realms,
     trials through the bonus list, the daily puzzle returns to the menu */
  function nextLevel() {
    if (G.sessionMode === 'daily') {
      goLevels();
      return;
    }
    const list = levelList(G.levelKind);
    if (G.levelIndex + 1 < list.length) {
      loadPuzzle(G.levelKind, G.levelIndex + 1);
      return;
    }
    sfx('win');
    goLevels();
  }

  /* 'Levels' goes back to the screen the level came from */
  function goLevels() {
    if (G.sessionMode === 'daily')
      NS.screens.setScreen('title');
    else if (G.sessionMode === 'trial')
      NS.screens.setScreen('trials');
    else
      NS.screens.setScreen('realms');
  }

  NS.session = { localDateString, dailyIndex, campaignUnlocked, campaignStarCount, trialUnlocked, solvedTrialCount,
    realmUnlocked, dailySub, loadDailyPuzzle, loadPuzzle, levelList, realmInfo, realmElements, restartLevel,
    nextLevel, goLevels };
})();
