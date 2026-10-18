;(function() {
  'use strict';

  // Fixed numbers and ids: canvas size, views, game states, storage keys, grid geometry, tile types and colours.
  // Owns: NS.constants

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;

  /* ======================================================================
     CONSTANTS
     ====================================================================== */

  const CANVAS_W = 1400;
  const CANVAS_H = 1000;
  const MAX_DT = 0.05;
  const TWO_PI = Math.PI * 2;

  /* -- Views -- */
  const VIEW_SURFACE = 'SURFACE';
  const VIEW_UNDERGROUND = 'UNDERGROUND';

  /* -- States -- */
  const STATE_READY = 'READY';
  const STATE_GADGET_SELECT = 'GADGET_SELECT';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';
  const STATE_UPGRADE_DIALOG = 'UPGRADE_DIALOG';
  const STATE_CINEMATIC = 'CINEMATIC';       // landing / relocation sequence
  const STATE_CONFIRM = 'CONFIRM';           // relocation confirmation
  const STATE_CRAFT = 'CRAFT';               // bomb workshop
  const STATE_MINIGAME = 'MINIGAME';         // opening a secret chest

  /* -- Storage -- */
  const STORAGE_PREFIX = 'sz-dome-keeper';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const STORAGE_TUTORIAL = STORAGE_PREFIX + '-tutorial-seen';
  const MAX_HIGH_SCORES = 5;

  /* -- Underground Grid -- */
  const STRATUM_ROWS = 14;                 // rows per rock layer
  const STRATUM_COUNT = 16;
  const GRID_COLS = 165;                   // every layer spans the full width
  const GRID_ROWS = STRATUM_ROWS * STRATUM_COUNT;
  const TILE_SIZE = 40;
  const GRID_OFFSET_X = 140;
  const GRID_OFFSET_Y = 120;

  /* -- Tile Types -- */
  const TILE_EMPTY = 0;
  const TILE_DIRT = 1;
  const TILE_IRON = 2;
  const TILE_WATER = 3;
  const TILE_COBALT = 4;
  const TILE_GADGET = 5;
  const TILE_COPPER = 6;
  const TILE_GOLD = 7;
  const TILE_TIN = 8;
  const TILE_SILVER = 9;
  const TILE_LEAD = 10;
  const TILE_COAL = 11;
  const TILE_QUARTZ = 12;
  const TILE_REDSTONE = 13;
  const TILE_DIAMOND = 14;
  const TILE_EMERALD = 15;
  const TILE_RUBY = 16;
  // Deep ores: one signature ore for each of the six deepest strata
  const TILE_TITANIUM = 17;
  const TILE_SAPPHIRE = 18;
  const TILE_URANIUM = 19;
  const TILE_AMETHYST = 20;
  const TILE_OPAL = 21;
  const TILE_VOIDSTONE = 22;
  const TILE_CORE = 23;          // the site's Relocation Core, hidden in the lower strata
  const TILE_CHEST = 24;         // one of the site's three secret chests
  const TILE_MAX = TILE_CHEST;

  const TILE_COLORS = {
    [TILE_DIRT]: '#4a3a2a',
    [TILE_IRON]: '#888888',
    [TILE_WATER]: '#4488ff',
    [TILE_COBALT]: '#4444aa',
    [TILE_COPPER]: '#b87333',
    [TILE_GOLD]: '#ffd700',
    [TILE_TIN]: '#d4d4d4',
    [TILE_SILVER]: '#c0c0c0',
    [TILE_LEAD]: '#666666',
    [TILE_COAL]: '#333333',
    [TILE_QUARTZ]: '#f0e6d3',
    [TILE_REDSTONE]: '#cc0000',
    [TILE_DIAMOND]: '#b9f2ff',
    [TILE_EMERALD]: '#50c878',
    [TILE_RUBY]: '#e0115f',
    [TILE_TITANIUM]: '#8aa0bc',
    [TILE_SAPPHIRE]: '#2a64e0',
    [TILE_URANIUM]: '#58d030',
    [TILE_AMETHYST]: '#9a4ad8',
    [TILE_OPAL]: '#ff9a40',
    [TILE_VOIDSTONE]: '#5a3aa0'
  };

  const TILE_HIGHLIGHT_COLORS = {
    [TILE_IRON]: '#bbbbbb',
    [TILE_WATER]: '#66aaff',
    [TILE_COBALT]: '#6666cc',
    [TILE_COPPER]: '#d4944d',
    [TILE_GOLD]: '#ffea50',
    [TILE_TIN]: '#eeeeee',
    [TILE_SILVER]: '#e0e0e0',
    [TILE_LEAD]: '#999999',
    [TILE_COAL]: '#555555',
    [TILE_QUARTZ]: '#fff8ee',
    [TILE_REDSTONE]: '#ff3333',
    [TILE_DIAMOND]: '#dff8ff',
    [TILE_EMERALD]: '#80e8a0',
    [TILE_RUBY]: '#ff4488',
    [TILE_TITANIUM]: '#c8dcf4',
    [TILE_SAPPHIRE]: '#6aa0ff',
    [TILE_URANIUM]: '#9aff5a',
    [TILE_AMETHYST]: '#d090ff',
    [TILE_OPAL]: '#ffd080',
    [TILE_VOIDSTONE]: '#b48aff'
  };

  const TILE_VALUES = {
    [TILE_IRON]: 10,
    [TILE_WATER]: 20,
    [TILE_COBALT]: 40,
    [TILE_COPPER]: 12,
    [TILE_TIN]: 15,
    [TILE_COAL]: 8,
    [TILE_LEAD]: 18,
    [TILE_SILVER]: 25,
    [TILE_GOLD]: 35,
    [TILE_QUARTZ]: 30,
    [TILE_REDSTONE]: 45,
    [TILE_EMERALD]: 60,
    [TILE_DIAMOND]: 80,
    [TILE_RUBY]: 70,
    [TILE_TITANIUM]: 90,
    [TILE_SAPPHIRE]: 110,
    [TILE_URANIUM]: 130,
    [TILE_AMETHYST]: 150,
    [TILE_OPAL]: 180,
    [TILE_VOIDSTONE]: 220
  };

  const TILE_LABELS = {
    [TILE_IRON]: 'iron',
    [TILE_WATER]: 'water',
    [TILE_COBALT]: 'cobalt',
    [TILE_COPPER]: 'copper',
    [TILE_GOLD]: 'gold',
    [TILE_TIN]: 'tin',
    [TILE_SILVER]: 'silver',
    [TILE_LEAD]: 'lead',
    [TILE_COAL]: 'coal',
    [TILE_QUARTZ]: 'quartz',
    [TILE_REDSTONE]: 'redstone',
    [TILE_DIAMOND]: 'diamond',
    [TILE_EMERALD]: 'emerald',
    [TILE_RUBY]: 'ruby',
    [TILE_TITANIUM]: 'titanium',
    [TILE_SAPPHIRE]: 'sapphire',
    [TILE_URANIUM]: 'uranium',
    [TILE_AMETHYST]: 'amethyst',
    [TILE_OPAL]: 'opal',
    [TILE_VOIDSTONE]: 'voidstone'
  };

  // Pixel-art sprite drawn on each resource tile (see SPRITES)
  const TILE_ICONS = {
    [TILE_IRON]: 'iron',
    [TILE_WATER]: 'water',
    [TILE_COBALT]: 'cobalt',
    [TILE_COPPER]: 'copper',
    [TILE_GOLD]: 'gold',
    [TILE_TIN]: 'tin',
    [TILE_SILVER]: 'silver',
    [TILE_LEAD]: 'lead',
    [TILE_COAL]: 'coal',
    [TILE_QUARTZ]: 'quartz',
    [TILE_REDSTONE]: 'redstone',
    [TILE_DIAMOND]: 'diamond',
    [TILE_EMERALD]: 'emerald',
    [TILE_RUBY]: 'ruby',
    [TILE_TITANIUM]: 'titanium',
    [TILE_SAPPHIRE]: 'sapphire',
    [TILE_URANIUM]: 'uranium',
    [TILE_AMETHYST]: 'amethyst',
    [TILE_OPAL]: 'opal',
    [TILE_VOIDSTONE]: 'voidstone'
  };

  NS.constants = { CANVAS_W, CANVAS_H, MAX_DT, TWO_PI, VIEW_SURFACE, VIEW_UNDERGROUND, STATE_READY,
    STATE_GADGET_SELECT, STATE_PLAYING, STATE_PAUSED, STATE_GAME_OVER, STATE_UPGRADE_DIALOG, STATE_CINEMATIC,
    STATE_CONFIRM, STATE_CRAFT, STATE_MINIGAME, STORAGE_PREFIX, STORAGE_HIGHSCORES, STORAGE_TUTORIAL,
    MAX_HIGH_SCORES, STRATUM_ROWS, STRATUM_COUNT, GRID_COLS, GRID_ROWS, TILE_SIZE, TILE_EMPTY, TILE_DIRT,
    TILE_IRON, TILE_WATER, TILE_COBALT, TILE_GADGET, TILE_COPPER, TILE_GOLD, TILE_TIN, TILE_SILVER,
    TILE_LEAD, TILE_COAL, TILE_QUARTZ, TILE_REDSTONE, TILE_DIAMOND, TILE_EMERALD, TILE_RUBY, TILE_TITANIUM,
    TILE_SAPPHIRE, TILE_URANIUM, TILE_AMETHYST, TILE_OPAL, TILE_VOIDSTONE, TILE_CORE, TILE_CHEST, TILE_MAX,
    TILE_COLORS, TILE_HIGHLIGHT_COLORS, TILE_VALUES, TILE_LABELS, TILE_ICONS };
})();
