;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const CANVAS_W = 1280;
  const CANVAS_H = 720;
  const TILE_SIZE = 32;
  const MOVE_DURATION = 0.12;
  const COMBAT_TILE_SIZE = 44;
  const COMBAT_MOVE_STEP_DUR = 0.08;
  const REVEAL_TIME = 0.55;
  const CRAWL_TILE = 48;
  const CRAWL_STEP = 0.11;
  const DEPLOY_BUTTON = Object.freeze({ x: CANVAS_W / 2 - 100, y: 92, w: 200, h: 44 });
  // darkness of underground boards (0 = lit)
  const UNDERGROUND_LIGHT = Object.freeze({ dungeon: 0.6, cave: 0.68, lava: 0.35 });

  // colours of the planes' traits and of the damage their energy deals
  const TRAIT_COLORS = Object.freeze({
    weightless: '#c8d8ff', flooded: '#7ac8ff', hazard: '#ff9a5a', vital: '#fff2a0', element_magic: '#ffb86a',
    potent_magic: '#d8a8ff', dulled_magic: '#a8a8b8', wild_magic: '#ff8af0', home_ground: '#f0d890', despair: '#9a9a9a',
  });
  const HAZARD_COLORS = Object.freeze({ fire: '#ff7a2a', cold: '#8ad8ff', acid: '#a8e84a', negative: '#b88aff' });

  const BATTLE_SCENE_KEY = 'sz-tactical-realms-battle-scenes';
  const BATTLE_SCENE_MODES = ['full', 'short', 'off'];

  function loadBattleSceneMode() {
    try {
      const v = localStorage.getItem(BATTLE_SCENE_KEY);
      return BATTLE_SCENE_MODES.includes(v) ? v : 'full';
    } catch (_) {
      return 'full';
    }
  }

  const MENU_ACTIONS = {
    'new'() { TR.app.controller && TR.app.controller.newGame(); },
    'scenes-full'() { TR.app.controller?.setBattleSceneMode('full'); },
    'scenes-short'() { TR.app.controller?.setBattleSceneMode('short'); },
    'scenes-off'() { TR.app.controller?.setBattleSceneMode('off'); },
    'combat-history'() { TR.app.controller?.showCombatHistory(); },
    'exit'() { window.parent.postMessage({ type: 'sz:close' }, '*'); },
    'about'() {
      if (SZ.Dialog)
        SZ.Dialog.show('dlg-about');
    }
  };

  // Camp and town menus: shared by drawing and hit-testing.
  const menuButtons = (labels, accents) => Object.freeze(labels.map((label, i) => Object.freeze({
    x: 958, y: 150 + i * 60, w: 280, h: 46, label, accent: accents[i] || null,
  })));
  const CAMP_BUTTONS = menuButtons(['Inventory', 'Equipment', 'Rest (Heal Party)', 'Return to Overworld'], [null, null, '#5ad07a', '#d8a050']);
  const TOWN_BUTTONS = menuButtons(['Weaponsmith', 'Armorer', 'General Store', 'Inn (Heal Party)', 'Leave Town'], [null, null, null, '#5ad07a', '#d8a050']);

  const TITLE_BUTTONS = [
    { label: 'New Game', x: 540, y: 370, w: 200, h: 44 },
    { label: 'Continue', x: 540, y: 430, w: 200, h: 44 },
  ];


  TR.app = {
    CANVAS_W, CANVAS_H, TILE_SIZE, MOVE_DURATION, COMBAT_TILE_SIZE, COMBAT_MOVE_STEP_DUR,
    REVEAL_TIME, CRAWL_TILE, CRAWL_STEP, DEPLOY_BUTTON, UNDERGROUND_LIGHT, TRAIT_COLORS,
    HAZARD_COLORS, BATTLE_SCENE_KEY, BATTLE_SCENE_MODES, loadBattleSceneMode, MENU_ACTIONS,
    CAMP_BUTTONS, TOWN_BUTTONS, TITLE_BUTTONS,
  };
})();
