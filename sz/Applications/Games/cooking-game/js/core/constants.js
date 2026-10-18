;(function() {
  'use strict';

  /* Fixed numbers of the game: the 1280 x 720 play layout, screen states,
     storage keys, timings and the help page titles. Owns nothing mutable. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});

  const VIEW_W = 1280;
  const VIEW_H = 720;
  const MAX_DT = 0.05;

  /* ── Game states: five menu screens plus the three play states ── */
  const STATE_TITLE = 'title';
  const STATE_CAREER = 'career';
  const STATE_UPGRADES = 'upgrades';
  const STATE_RECIPES = 'recipes';
  const STATE_HELP = 'help';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_DAY_OVER = 'DAY_OVER';
  const MENU_SCREENS = [STATE_TITLE, STATE_CAREER, STATE_UPGRADES, STATE_RECIPES, STATE_HELP];

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-cooking-game';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_SAVE = STORAGE_PREFIX + '-v2';
  const MAX_HIGH_SCORES = 10;

  /* ── Play view layout (native 1280 x 720, matching scene-art's room) ── */
  const SEAT_X0 = 180, SEAT_X1 = 1100, SEAT_Y = 330;
  const PASS_MAX = 4, PASS_X0 = 300, PASS_X1 = 980, PASS_Y = 360;
  const STATION_X0 = 40, STATION_STEP = 245, STATION_Y = 520, STATION_W = 150, STATION_H = 120;
  const BAR_Y = 672, BAR_H = 12;
  const CHEF_Y = 704;
  const TRASH = { x: 1042, y: 374, r: 30 };
  const RAIL_X0 = 52, RAIL_Y = 452, RAIL_W = 120, RAIL_H = 86, RAIL_GAP = 12, RAIL_MAX = 9;
  const BUBBLE_DY = 158; // order bubble above a seated guest
  const GUEST_SCALE = 1.22; // guests are drawn a little larger than the sprites
  const STATION_ART = 1.25; // the station art grows around its base
  const WALK_SPEED = 140; // px/s on the way in and out
  const BURN_AT = 1.25; // a step self-burns past this progress
  const EAT_TIME = 2; // seconds a served guest enjoys the dish
  const FLY_TIME = 0.35; // arc of a dish travelling to a guest
  const ARC_TIME = 0.3; // arc of a finished dish travelling to the pass
  const COIN_TIME = 0.6; // arc of a tip coin travelling to the HUD
  const COIN_MAX = 40; // flying coins on screen at once
  const RING_MAX = 24; // expanding rings on screen at once

  /* HUD panel and the coin target inside it (drawHUD, drawCoins, goal bursts) */
  const HUD_PX = 940, HUD_PY = 8, HUD_PW = 332, HUD_PH = 116;
  const COIN_TX = 1106, COIN_TY = 78;

  /* ── modes & powerups ── */
  const ENDLESS_PHASE = 8; // guests served per Endless Rush step
  const DAILY_CUSTOMERS = 20; // guests in one Daily Special
  const RUSH_TIME = 10; // seconds the Rush Hour Bell lasts
  const WAITER_DELAY = 0.8; // seconds before the waiter picks a dish up
  const WAITER_HOME = 640; // where the waiter waits between runs
  const WAITER_Y = 430; // the waiter walks in front of the counter
  const BELL = { x: 1246, y: 150, r: 15 };
  const HELP_PAGES = ['Taking orders', 'Cooking', 'Serving', 'Modes & upgrades'];

  NS.C = { VIEW_W, VIEW_H, MAX_DT, STATE_TITLE, STATE_CAREER, STATE_UPGRADES, STATE_RECIPES,
    STATE_HELP, STATE_PLAYING, STATE_PAUSED, STATE_DAY_OVER, MENU_SCREENS, STORAGE_HIGHSCORES,
    STORAGE_SAVE, MAX_HIGH_SCORES, SEAT_X0, SEAT_X1, SEAT_Y, PASS_MAX, PASS_X0, PASS_X1,
    PASS_Y, STATION_X0, STATION_STEP, STATION_Y, STATION_W, STATION_H, BAR_Y, BAR_H, CHEF_Y,
    TRASH, RAIL_X0, RAIL_Y, RAIL_W, RAIL_H, RAIL_GAP, RAIL_MAX, BUBBLE_DY, GUEST_SCALE,
    STATION_ART, WALK_SPEED, BURN_AT, EAT_TIME, FLY_TIME, ARC_TIME, COIN_TIME, COIN_MAX,
    RING_MAX, HUD_PX, HUD_PY, HUD_PW, HUD_PH, COIN_TX, COIN_TY, ENDLESS_PHASE, DAILY_CUSTOMERS,
    RUSH_TIME, WAITER_DELAY, WAITER_HOME, WAITER_Y, BELL, HELP_PAGES };

})();
