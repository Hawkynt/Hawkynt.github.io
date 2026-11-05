/* How to Play: pages for the basics and controls, the twelve power-ups, the seven critters, the
   tiles and hazards, and the modes and daily rhythm, each item with its art; paged with the
   arrow keys or the buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const G = NS.state;
  const { UI, CELL } = NS.constants;
  const { POWERUPS, ENEMIES, MODES } = NS.items;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const IA = NS.itemArt;
  const CA = NS.creatureArt;
  const TA = NS.tileArt;
  const scr = NS.screens;
  const { ctx } = NS.view;

  const PAGES = ['Basics', 'Power-ups', 'Critters', 'Tiles & Hazards', 'Modes'];

  function row(x, y, draw, title, desc, w) {
    draw(x + 24, y + 22);
    kit.text(title, x + 56, y + 12, 16, '#ffffff', { weight: 'bold' });
    kit.wrap(desc, x + 56, y + 24, (w || 520) - 70, 13, 17, UI.textDim);
  }

  function basics() {
    const lines = [
      ['Steer', 'Arrow keys or WASD. On touch screens, swipe. With a mouse, click beside the head on the side you want to go.'],
      ['Eat and grow', 'Every fruit grows you and scores. Eat quickly to build a combo - every 3 in a row raises the multiplier.'],
      ['Do not crash', 'Walls, your own body, critters and active hazards end the snake. Scale Armor saves you once.'],
      ['Story levels', 'Eat the fruit goal and an exit gate opens. Three golden eggs and a crash-free run earn the other stars.'],
      ['Guardians', 'Grab a Sun Shard to shine, then ram the guardian. Every attack flashes red first - keep your head out of it.'],
      ['Venom', 'Buy Venom Glands in the tech tree or pick up a Venom Sac, then spit with Space at crates, critters and guardians.'],
      ['Saving', 'Everything saves by itself. Leave mid-run and Continue on the title picks up exactly where you were.'],
    ];
    for (let k = 0; k < lines.length; ++k) {
      kit.text(lines[k][0], 120, 130 + k * 66, 18, UI.gold, { weight: 'bold' });
      kit.wrap(lines[k][1], 120, 146 + k * 66, 1040, 15, 20, UI.text);
    }
  }

  function powerups() {
    for (let k = 0; k < POWERUPS.length; ++k) {
      const p = POWERUPS[k];
      const x = 90 + (k % 2) * 560, y = 110 + Math.floor(k / 2) * 84;
      row(x, y, (cx, cy) => K.blit(ctx, IA.orb(p), cx, cy, 1), p.name, p.desc + (p.dur ? ' (' + p.dur + 's)' : ''));
    }
  }

  function critters() {
    const ids = Object.keys(ENEMIES);
    for (let k = 0; k < ids.length; ++k) {
      const e = ENEMIES[ids[k]];
      const x = 90 + (k % 2) * 560, y = 120 + Math.floor(k / 2) * 110;
      row(x, y, (cx, cy) => {
        if (ids[k] === 'rival') K.blitRot(ctx, NS.snakeArt.head(NS.snakeArt.tintSkin(e.color), false), cx, cy, 0, 1);
        else K.blit(ctx, CA.critter(ids[k], Math.floor(G.time * 4) % 2), cx, cy, 1.2);
      }, e.name + (e.edible ? '  (edible)' : ''), e.desc + ' Worth ' + e.score + ' points.');
    }
  }

  function tiles() {
    const th = 0;
    const list = [
      [TA.crate(th), 'Crate', 'Blocks the way. Smash it with venom, Quake or while shining - sometimes there is fruit inside.'],
      [TA.soft('ice'), 'Ice', 'You cannot turn while your head is on ice. Plan the slide before you step on.'],
      [TA.soft('sand'), 'Quicksand', 'Slows you down while your head is in it.'],
      [TA.hazardBase('^', th), 'Spike trap', 'Pops up in a rhythm. A flicker warns you just before.'],
      [TA.hazardBase('*', 3), 'Lava vent', 'Glows, then erupts. Slip past between eruptions.'],
      [TA.hazardBase('=', 4), 'Laser gate', 'Switches on and off. Never cross it while it burns.'],
      [TA.hazardBase('o', 4), 'Portal', 'Step in, come out at its twin with the same heading.'],
      [IA.gate(), 'Exit gate', 'Opens when the fruit goal is met. Grab the eggs first if you want all the stars.'],
    ];
    for (let k = 0; k < list.length; ++k) {
      const x = 90 + (k % 2) * 560, y = 110 + Math.floor(k / 2) * 120;
      row(x, y, (cx, cy) => K.blit(ctx, list[k][0], cx, cy, CELL / list[k][0].w * 1.1), list[k][1], list[k][2]);
    }
  }

  function modes() {
    const ids = Object.keys(MODES);
    for (let k = 0; k < ids.length; ++k) {
      const m = MODES[ids[k]];
      const x = 90 + (k % 2) * 560, y = 110 + Math.floor(k / 2) * 90;
      row(x, y, (cx, cy) => kit.icon(m.icon, cx, cy, 28, m.color), m.name, m.desc);
    }
    kit.wrap('Every day brings a new Daily Garden, three daily quests and a streak gift. Each week Arcade gets a new mutator. The seasonal festivals - Frostfall, Bloom, Sunfest, Harvest Moon, Hollow Night and Starfall Eve - scatter tokens that unlock skins, trails and hats you can only earn while they run.', 90, 400, 1100, 16, 24, UI.text);
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(2,8,4,0.86)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const p = G.ui.helpPage;
    kit.text('HOW TO PLAY', 60, 44, 30, '#ffffff', { weight: 'bold' });
    kit.text(PAGES[p] + '   ' + (p + 1) + ' / ' + PAGES.length, 1220, 44, 18, UI.gold, { align: 'right', weight: 'bold' });
    kit.panel(60, 80, 1160, 560, { accent: UI.accent });
    [basics, powerups, critters, tiles, modes][p]();
    W.button('prev', 'Previous', 340, 652, 180, 46, { px: 16, disabled: p === 0, action: () => { G.ui.helpPage = Math.max(0, p - 1); } });
    W.button('next', 'Next', 530, 652, 180, 46, { px: 16, disabled: p === PAGES.length - 1, action: () => { G.ui.helpPage = Math.min(PAGES.length - 1, p + 1); } });
    W.button('back', G.back.help === 'paused' ? 'Back to Pause' : 'Back', 60, 652, 240, 46, { action: () => scr.back('help') });
  }

  function onKey(e) {
    const d = e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0;
    if (!d) return false;
    G.ui.helpPage = Math.max(0, Math.min(PAGES.length - 1, G.ui.helpPage + d));
    return true;
  }

  Object.assign(NS.help, {
    draw, onKey
  });
})();
