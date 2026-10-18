/*
 * How to Play: five illustrated pages.
 * Owns G.helpPage, G.helpFrom; writes G.save.tutorialSeen.
 */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Platformer || (SZ.Platformer = {});
  const G = NS.state;
  const Spr = SZ.PlatformerSprites;
  const Storage = NS.module('storage');
  const Session = NS.module('session');
  const World = NS.module('world');
  const Menu = NS.module('menu');
  const Controls = NS.module('controls');
  const { visibleRect } = NS.module('view');
  const { drawSprite, drawGlow, drawIcon } = NS.module('kit');
  const ctx = G.ctx;
  const ui = G.ui;

  const HELP_PAGES = ['Basics', 'Moves', 'Things', 'Foes', 'Modes'];

  function openHelp(from) {
    G.helpFrom = from;
    G.helpPage = 0;
    if (from === 'pause') {
      G.screen = 'help';
      Controls.syncTouch();
    } else {
      Session.setScreen('help');
    }
  }

  function closeHelp() {
    if (!G.save.tutorialSeen) {
      G.save.tutorialSeen = true;
      Storage.writeSave();
    }
    if (G.helpFrom === 'pause' && G.run) {
      G.screen = 'pause';
      Controls.syncTouch();
    } else {
      Session.setScreen('title');
    }
  }

  function helpRow(y, sprite, title, text, x0) {
    const x = x0 || 150;
    if (sprite)
      sprite();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(title, x + 90, y - 12, 380, 18, { weight: 'bold', color: '#ffffff', font: ui.TITLE_FONT });
    ui.drawTextBlock(text, x + 90, y + 2, 400, 40, 14, { color: '#c8d2ea' });
  }

  function drawHelp() {
    if (G.helpFrom === 'pause' && G.run) {
      World.drawWorld(0);
      Menu.veil(0.8);
    } else {
      Menu.menuBackdrop(0, 0.66);
    }
    const v = visibleRect();
    ui.drawPanel(110, 30, 1060, 600, { accent: '#5ab8ff', title: 'How to Play - ' + HELP_PAGES[G.helpPage], titleRight: (G.helpPage + 1) + ' / ' + HELP_PAGES.length, headerH: 40, titlePx: 20 });
    const skin = Session.currentSkin();
    const hero = (pose, x, y) => () => drawSprite(Spr.hero(skin, pose, Math.floor(G.time * 10) % Spr.HERO_FRAMES[pose]), x, y, false, 1.2, 1.2);
    const icon = (name, color, x, y) => () => drawIcon(name, color, x, y, 44);
    const item = (kind, x, y, variant, k) => () => drawSprite(Spr.item(kind, Math.floor(G.time * 8) % (Spr.ITEM_FRAMES[kind] || 1), variant), x, y, false, k || 1, k || 1);
    const foe = (type, x, y) => () => drawSprite(Spr.enemy(type, Math.floor(G.time / 3) % 5, Math.floor(G.time * 7) % Spr.ENEMY_FRAMES[type], 'normal'), x, y);
    if (G.helpPage === 0) {
      helpRow(130, hero('run', 190, 162), 'Run', 'Arrow keys or A / D. Touch: the stick on the left.');
      helpRow(210, hero('jump', 190, 242), 'Jump', 'Space, Up, W or Z. Hold for a higher jump, tap for a hop. A jump pressed just before landing still counts, and so does one just after running off a ledge.');
      helpRow(290, hero('fall', 190, 322), 'Drop down', 'Hold Down and press Jump to drop through a ledge.');
      helpRow(370, icon('flag', '#ffe08a', 190, 360), 'Reach the goal', 'Every level ends at a glowing gate. Checkpoint banners save your progress on the way.');
      helpRow(450, icon('heart', '#ff4a6a', 190, 440), 'Hearts', 'Spikes, foes and shots cost a heart; falling into a pit or liquid costs one and puts you back on safe ground. Lose them all and you restart at the last checkpoint.');
      helpRow(130, icon('star', '#ffd75a', 640, 120), 'Three stars', 'One for reaching the goal, one for finding all three hidden gems, one for beating the par time.', 600);
      helpRow(210, icon('coin', '#ffd75a', 640, 200), 'Coins and gems', 'Spend them in the Tech Tree on new moves, hearts, magnets, fire and style.', 600);
      helpRow(290, icon('shield', '#8ad8ff', 640, 280), 'Pause', 'Escape or P. From the pause menu you can open the Tech Tree mid-level - upgrades work at once.', 600);
    } else if (G.helpPage === 1) {
      helpRow(140, hero('wall', 190, 172), 'Wall Kick (Movement)', 'Slide down walls by pushing into them; with Wall Kick press Jump to kick off and climb.');
      helpRow(230, hero('dash', 190, 262), 'Dash (Movement)', 'Shift or X bursts sideways, once per jump. It smashes crates. Dash II lasts longer and every stomp refreshes it.');
      helpRow(320, hero('jump', 190, 352), 'Cloud Step (Movement)', 'Jump again in mid-air.');
      helpRow(410, item('fireball', 190, 400), 'Fireballs (C or F)', 'From a power block or the Ember Heart upgrade. They bounce along the ground and burn foes, even spiky ones.');
      helpRow(500, hero('fall', 190, 532), 'Stomp', 'Land on a foe to defeat it and bounce. Hold Jump while stomping to bounce higher. Chain stomps for a combo.');
      helpRow(140, icon('bolt', '#ff8a3a', 640, 130), 'Stomp Shockwave', 'An Arsenal upgrade: stomps flatten every foe close by.', 600);
      helpRow(230, icon('magnet', '#ffd75a', 640, 220), 'Coin Magnet', 'A Fortune upgrade: coins fly to you from further away.', 600);
      helpRow(320, icon('gem', '#4aff8a', 640, 310), 'Gem Radar', 'An arrow and a chime lead you to the nearest hidden gem.', 600);
    } else if (G.helpPage === 2) {
      helpRow(130, item('qblock', 190, 120, 0), 'Coin block', 'Hit it from below for coins. Power blocks hold fireballs, a heart or an invincibility star.');
      helpRow(210, item('crate', 190, 200, 0), 'Crate', 'Breaks when hit from below, dashed into or burned.');
      helpRow(290, item('crumble', 190, 280, 0), 'Crumbling block', 'Gives way a moment after you land on it, and grows back a few seconds later.');
      helpRow(370, item('spring', 190, 360, 0), 'Spring', 'Launches you high into the air.');
      helpRow(450, item('checkpoint', 190, 478, 1, 0.62), 'Checkpoint', 'Touch the banner to raise it: you restart here.');
      helpRow(130, item('gem', 640, 120, 0), 'Hidden gems', 'Three per level, tucked behind fake walls, up high or across danger. Some need upgrades.', 600);
      helpRow(210, item('star', 640, 200), 'Star', 'Invincible for a while: run straight through foes.', 600);
      helpRow(290, item('heart', 640, 280), 'Heart', 'Restores one heart.', 600);
      helpRow(370, item('platform', 604, 362, 0, 0.5), 'Moving platforms', 'Ride sliding platforms and lifts - wait for the right moment.', 600);
    } else if (G.helpPage === 3) {
      helpRow(130, foe('walker', 190, 150), 'Walker', 'Patrols its ledge. Stomp it.');
      helpRow(210, foe('charger', 190, 230), 'Charger', 'Lowers its head and charges when it sees you, then stands dazed.');
      helpRow(290, foe('hopper', 190, 310), 'Hopper', 'Leaps toward you every few seconds.');
      helpRow(370, foe('spiky', 190, 390), 'Spiky', 'Cannot be stomped. Burn it, flatten it with a shockwave or jump over it.');
      helpRow(130, () => drawSprite(Spr.enemy('flyer', Math.floor(G.time / 3) % 5, Math.floor(G.time * 10) % 4, 'normal'), 640, 130), 'Flyer', 'Drifts through the air in loops.', 600);
      helpRow(210, () => drawSprite(Spr.enemy('diver', Math.floor(G.time / 3) % 5, Math.floor(G.time * 10) % 4, 'normal'), 640, 210), 'Diver', 'Waits high up and swoops at you when you pass below.', 600);
      helpRow(290, foe('turret', 640, 310), 'Turret', 'Glows, then fires at you. Stomp it or burn it.', 600);
      helpRow(370, icon('skull', '#ff8a6a', 640, 360), 'Bosses', 'Each world ends with a boss in three phases. Stomp it when it is open - watch for its tells.', 600);
    } else {
      helpRow(140, icon('map', '#7ad04a', 190, 130), 'Adventure', 'Five worlds of six levels, each ending in a boss. Win stars, coins and gems; beat a boss to open the next world.');
      helpRow(230, icon('clock', '#5ad1ff', 190, 220), 'Time Trial', 'Replay any cleared level against the ghost of your best run.');
      helpRow(320, icon('bolt', '#ff8a3a', 190, 310), 'Endless', 'Stage after stage of fresh courses through every world. Your hearts carry over; how far can you get?');
      helpRow(410, icon('flag', '#ffe08a', 190, 400), 'Daily Run', 'One long course a day, the same for everyone. The first clear of the day pays a bonus.');
      helpRow(500, icon('star', '#c88aff', 190, 490), 'Tech Tree', 'Five branches: Movement, Survival, Fortune, Arsenal and Style. Open it from the title or the pause menu.');
    }
    Menu.drawButton('hprev', 'Back', 150, 556, 200, 52, { action: () => { if (G.helpPage > 0) --G.helpPage; else closeHelp(); } });
    Menu.drawButton('hnext', G.helpPage < HELP_PAGES.length - 1 ? 'Next' : 'Done', 930, 556, 200, 52, { action: () => { if (G.helpPage < HELP_PAGES.length - 1) ++G.helpPage; else closeHelp(); }, key: 'Enter' });
    for (let i = 0; i < HELP_PAGES.length; ++i) {
      drawGlow(560 + i * 40, 582, i === G.helpPage ? 40 : 20, '#5ab8ff', i === G.helpPage ? 1 : 0.4);
    }
  }

  Object.assign(NS.module('help'), {
    HELP_PAGES,
    openHelp,
    closeHelp,
    drawHelp
  });
})();
