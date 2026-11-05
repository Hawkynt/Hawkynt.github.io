/* How to Play, five illustrated pages: controls (keyboard, mouse, touch), the fifteen
   power-ups, the enemy roster, tiles and tactics (crates, ice, belts, teleporters, darkness,
   chains and combos) and the modes with the long-term progression. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { UI } = C;
  const { POWERUPS, ENEMIES } = NS.content;
  const kit = NS.kit;
  const scr = NS.screens;
  const { ctx } = NS.view;

  const PAGES = ['Controls', 'Power-ups', 'Enemies', 'Tiles & Tactics', 'Modes & Progress'];

  function draw() {
    kit.dim(G.back.help === 'paused' ? 0.75 : 0.55);
    const p = G.ui.helpPage;
    kit.panel(60, 40, 1160, 600, { accent: '#7cf08a', radius: 20 });
    kit.text('HOW TO PLAY', 100, 80, 28, '#ffffff', { weight: 'bold', stroke: 5 });
    for (let i = 0; i < PAGES.length; ++i)
      kit.button('pg' + i, PAGES[i], 400 + i * 160, 60, 150, 38, { px: 14, accent: i === p ? UI.gold : '#9a8aa0', action: () => { G.ui.helpPage = i; } });
    kit.bar(420 + p * 160, 102, 110, 5, 1, UI.gold);
    [controls, powerups, enemies, tiles, modes][p]();
    kit.button('prev', '<', 60, 656, 70, 46, { action: () => turn(-1), accent: '#9a8aa0', disabled: p === 0 });
    kit.button('next', '>', 1150, 656, 70, 46, { action: () => turn(1), accent: '#9a8aa0', disabled: p === PAGES.length - 1 });
    kit.button('back', G.back.help === 'paused' ? 'Back to Pause' : 'Back', 540, 656, 200, 46, { icon: 'back', accent: '#9a8aa0', action: () => scr.back('help') });
  }

  function turn(d) {
    G.ui.helpPage = Math.max(0, Math.min(PAGES.length - 1, G.ui.helpPage + d));
  }

  function rows(list, x, y, gap) {
    for (let i = 0; i < list.length; ++i) {
      kit.text(list[i][0], x, y + i * gap, 16, UI.gold, { weight: 'bold' });
      kit.text(list[i][1], x + 230, y + i * gap, 16, UI.text);
    }
  }

  function controls() {
    kit.text('KEYBOARD', 110, 140, 18, '#7cf08a', { weight: 'bold' });
    rows([['Arrows / WASD', 'move (slides around corners)'], ['Space / Z', 'drop a bomb (glove: throw it)'], ['X / E', 'detonate remote bombs'], ['C', 'Mega Bomb (tech tree)'], ['Shift', 'dash (tech tree)'], ['Esc / P', 'pause menu'], ['F2', 'title screen'], ['H', 'this help']], 110, 176, 34);
    kit.text('MOUSE', 740, 140, 18, '#7cf08a', { weight: 'bold' });
    kit.wrap('Click a tile to walk there. Click Pip (or right-click) to drop a bomb. Menus work with clicks, the arrow keys and Enter.', 740, 166, 420, 15, 22, UI.text);
    kit.text('TOUCH', 740, 300, 18, '#7cf08a', { weight: 'bold' });
    kit.wrap('A thumb pad appears on the left side panel and BOMB / BOOM buttons on the right. Tapping the arena walks there; tapping Pip drops a bomb.', 740, 326, 420, 15, 22, UI.text);
    kit.text('SAVING', 740, 460, 18, '#7cf08a', { weight: 'bold' });
    kit.wrap('Your run saves itself every few seconds, on pause and when you leave. Reload the page and pick Continue to carry on exactly where you were.', 740, 486, 420, 15, 22, UI.text);
  }

  function powerups() {
    for (let i = 0; i < POWERUPS.length; ++i) {
      const pu = POWERUPS[i];
      const x = 100 + (i % 3) * 370, y = 140 + Math.floor(i / 3) * 96;
      ctx.drawImage(NS.itemArt.powerup(pu.id), x, y - 22, 44, 44);
      kit.text(pu.name, x + 56, y - 8, 16, pu.color, { weight: 'bold' });
      kit.wrap(pu.desc, x + 56, y + 4, 290, 13, 17, UI.textDim);
    }
  }

  function enemies() {
    for (let i = 0; i < ENEMIES.length; ++i) {
      const e = ENEMIES[i];
      const x = 100 + (i % 2) * 560, y = 140 + Math.floor(i / 2) * 96;
      ctx.drawImage(NS.actorArt.enemy(e.id, Math.floor(G.time * 5) % 4, false), x - 6, y - 34, 64, 64);
      kit.text(e.name + (e.hp > 1 ? '  (' + e.hp + ' hits)' : ''), x + 66, y - 10, 17, e.color, { weight: 'bold' });
      kit.text(e.desc + ' - ' + e.points + ' pts', x + 66, y + 14, 14, UI.textDim);
    }
    kit.text('Bosses guard the end of every world - watch the glowing tiles, they turn into fire.', 640, 618, 14, UI.gold, { align: 'center' });
  }

  function tiles() {
    const TA = NS.tileArt;
    const list = [
      [TA.soft(0), 'Brick', 'Breaks in one blast. Hides power-ups, gems, tokens - and the exit.'],
      [TA.crate(), 'Steel crate', 'Takes two blasts and always stops fire, even pierce.'],
      [TA.ice(), 'Ice', 'Step on it and you slide until something stops you.'],
      [TA.belt(3, Math.floor(G.time * 8) % 4), 'Conveyor belt', 'Carries you and resting bombs along.'],
      [TA.tele(), 'Teleport pad', 'Pads come in pairs: step on one, appear on its twin.'],
      [TA.exitDoor(true), 'Exit', 'Opens once every enemy is gone. Step in to clear the stage.']
    ];
    for (let i = 0; i < list.length; ++i) {
      const y = 140 + i * 72;
      ctx.drawImage(list[i][0], 100, y - 24, 48, 48);
      kit.text(list[i][1], 170, y - 8, 17, '#ffffff', { weight: 'bold' });
      kit.text(list[i][2], 170, y + 14, 14, UI.textDim);
    }
    kit.text('TACTICS', 740, 140, 18, '#7cf08a', { weight: 'bold' });
    kit.wrap('Bombs in a blast go off too - one chain that defeats several enemies scores 2x, 3x, 4x per kill. Keep defeating enemies quickly to raise the combo multiplier up to x8. Fire burns exposed power-ups, so grab them fast. In the Shadow Keep only your glow, fire and bombs light the halls. When the timer runs out, wisps hunt you down. A Cursed Skull scrambles you for ten seconds - blast an enemy to lift it.', 740, 166, 420, 15, 23, UI.text);
  }

  function modes() {
    const M = NS.modes.INFO;
    const ids = ['story', 'arcade', 'zen', 'daily', 'rush'];
    const text = {
      story: 'Five worlds of six stages and a boss, comic chapters and three stars per stage.',
      arcade: 'Endless arenas that keep getting harder, a boss every fifth, a top-10 table.',
      zen: 'No harm and no timer: calm gardens full of bricks and gems, soft music.',
      daily: 'The same three arenas and modifiers for everyone today. One life.',
      rush: 'Five bosses in a row with a strong loadout and a stopwatch.'
    };
    for (let i = 0; i < ids.length; ++i) {
      const y = 146 + i * 62;
      kit.icon(M[ids[i]].icon, 120, y, 36, M[ids[i]].color);
      kit.text(M[ids[i]].name, 156, y - 9, 17, M[ids[i]].color, { weight: 'bold' });
      kit.text(text[ids[i]], 156, y + 13, 14, UI.textDim);
    }
    kit.text('THE LONG GAME', 740, 140, 18, '#7cf08a', { weight: 'bold' });
    kit.wrap('Every mode pays gems. Spend them in the Tech Tree on permanent upgrades (also from the pause menu, taking effect at once) and in the Wardrobe on skins, bombs and trails. Daily quests, a weekly challenge, achievements and a play streak pay extra. Each season of the year brings its own look, collectible tokens and an event track with exclusive rewards.', 740, 166, 420, 15, 23, UI.text);
  }

  function onKey(e) {
    if (e.code === 'ArrowLeft') turn(-1);
    else if (e.code === 'ArrowRight') turn(1);
  }

  Object.assign(NS.help, {
    draw, onKey, turn, PAGES
  });
})();
