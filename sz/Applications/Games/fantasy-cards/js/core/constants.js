/* Canvas size, deck and combat tunables, the game-state names, the storage key
   and the AI difficulty labels. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});

  const CANVAS_W = 800;
  const CANVAS_H = 560;
  const MAX_DT = 0.05;
  const DECK_SIZE = 30;
  const HAND_LIMIT = 7;
  const STARTING_HP = 50;
  const MAX_MANA = 10;

  /* ── Game states ── */
  const STATE_MENU = 'MENU';
  const STATE_DECK_BUILD = 'DECK_BUILD';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';
  const STATE_VICTORY = 'VICTORY';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-fantasy-cards';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 10;

  /* ── AI difficulty ── */
  const DIFF_EASY = 'easy';
  const DIFF_NORMAL = 'normal';
  const DIFF_HARD = 'hard';

  Object.assign(NS.constants, {
    CANVAS_W, CANVAS_H, MAX_DT, DECK_SIZE, HAND_LIMIT, STARTING_HP, MAX_MANA,
    STATE_MENU, STATE_DECK_BUILD, STATE_PLAYING, STATE_PAUSED, STATE_GAME_OVER, STATE_VICTORY,
    STORAGE_HIGHSCORES, MAX_HIGH_SCORES,
    DIFF_EASY, DIFF_NORMAL, DIFF_HARD
  });
})();
