/* How to Play: illustrated pages for digging and the exit, boulder physics, creatures, special
   cells, every power-up, the modes and progression, and the controls for keyboard, mouse and
   touch. Arrows or the buttons turn pages; Esc returns. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const G = NS.state;
  const I = NS.items;
  const kit = NS.kit;
  const CA = NS.creatureArt;
  const scr = NS.screens;
  const { ctx, visible } = NS.view;
  const UI = C.UI;

  let page = 0;

  function rows(list, x, y, img) {
    for (let k = 0; k < list.length; ++k) {
      const yy = y + k * 66;
      const im = img(list[k], k);
      if (im) ctx.drawImage(im, x, yy, 48, 48);
      kit.text(list[k][0], x + 64, yy + 14, 19, UI.accent, { weight: 'bold' });
      kit.wrap(list[k][1], x + 64, yy + 28, 430, 14, 18, UI.text);
    }
  }

  const PAGES = [
    { title: 'Dig, collect, escape', draw(x, y) {
      const t = NS.tileArt.tiles('amber', '');
      rows([
        ['Dirt', 'Walk into dirt to dig through it. Every cell you open changes how things fall.'],
        ['Gems', 'Collect the number of gems shown at the top. Quick pickups build a combo multiplier.'],
        ['Crystals', 'Big pink crystals count as five gems.'],
        ['The exit', 'Opens once the quota is met (or the boss is beaten). Walk in to clear the cave.'],
        ['The clock', 'Leftover seconds turn into bonus points. Run out and you lose a try.']
      ], x, y, (r, k) => [t.dirt[0][0], t.gem[3], t.biggem[3], t.exitOpen[2], CA.icon('time')][k]);
    } },
    { title: 'Boulder physics', draw(x, y) {
      const t = NS.tileArt.tiles('amber', '');
      rows([
        ['Falling', 'Boulders and gems fall when nothing holds them. A falling one crushes whatever it lands on - you too.'],
        ['Rolling', 'Things roll off boulders, gems and brick when there is room beside and below.'],
        ['Safe beneath', 'A boulder resting on your head is harmless - until you step away and back.'],
        ['Pushing', 'Lean into a boulder sideways for a moment to push it into an empty cell.'],
        ['Grab', 'Hold Shift (or the GRAB button) and press a direction to dig or collect beside you without moving.']
      ], x, y, (r, k) => [t.boulder[0], t.boulder[1], t.boulder[2], t.boulder[3], CA.icon('drill')][k]);
    } },
    { title: 'Creatures', draw(x, y) {
      rows([
        ['Firefly', I.CREATURES.firefly.desc + ' Drop a boulder on it.'],
        ['Butterfly', I.CREATURES.butterfly.desc],
        ['Mole', I.CREATURES.mole.desc + ' Dynamite works wonders.'],
        ['Ice Bat', I.CREATURES.bat.desc],
        ['Spore moss', 'Grows into dirt and space. Trapped moss crystallises into gems; too much turns to boulders.']
      ], x, y, (r, k) => k < 4 ? CA.creature([C.FIREFLY, C.BUTTERFLY, C.MOLE, C.BAT][k], Math.floor(G.time * 8)) : NS.tileArt.tiles('grotto', '').amoeba[0]);
    } },
    { title: 'Special cells', draw(x, y) {
      const t = NS.tileArt.tiles('frost', '');
      const m = NS.tileArt.tiles('magma', '');
      rows([
        ['Magic wall', 'Once hit by something falling it hums for a while: boulders drop through as gems, gems as boulders.'],
        ['Powder barrel', 'Explodes when it lands, is hit, or catches a blast - and sets off its neighbours.'],
        ['Ice block', 'Falls like a boulder; pushed, it slides until it hits something (and crushes creatures).'],
        ['Lava', 'Deadly to touch. A boulder dropped in cools it into brick.'],
        ['Brick and steel', 'Brick breaks in blasts (or to the Power Drill); steel never does.']
      ], x, y, (r, k) => [t.magicOn[1], m.tnt, t.ice, m.lava[1], m.brick][k]);
    } },
    { title: 'Power-ups', draw(x, y) {
      for (let k = 1; k < I.POWERUPS.length; ++k) {
        const p = I.POWERUPS[k];
        const col = (k - 1) % 2, row = Math.floor((k - 1) / 2);
        const px = x + col * 560, py = y + row * 62;
        ctx.drawImage(CA.icon(p.key), px, py, 40, 40);
        kit.text(p.name, px + 54, py + 10, 18, p.color, { weight: 'bold' });
        kit.fitText(p.desc, px + 54, py + 32, 480, 14, { color: UI.text });
      }
    } },
    { title: 'Modes and progress', draw(x, y) {
      const M = NS.meta.MODES;
      let k = 0;
      for (const id in M) {
        kit.text(M[id].name, x, y + k * 44, 19, M[id].color, { weight: 'bold' });
        kit.text(M[id].desc, x + 160, y + k * 44, 16, UI.text);
        ++k;
      }
      kit.wrap('Gold from every mode buys Tech Tree upgrades. Seasonal tokens fill the event track for skins and trails. Three daily quests and a play streak reward coming back. Your run saves itself every few seconds - close the window and pick it up with Continue.', x, y + k * 44 + 16, 1060, 17, 24, UI.dim);
    } },
    { title: 'Controls', draw(x, y) {
      const list = [
        ['Arrows / WASD', 'Move and dig'], ['Shift + direction', 'Grab: dig or collect without moving'], ['Space', 'Drop dynamite'],
        ['Esc / P', 'Pause menu (tech tree, wardrobe, journal)'], ['F2', 'Back to the title'], ['H', 'This help'],
        ['Mouse', 'Hold the button and the miner walks toward the pointer; right click drops dynamite'],
        ['Touch', 'Swipe or use the on-screen pad; BOMB and GRAB buttons on the right']
      ];
      for (let k = 0; k < list.length; ++k) {
        kit.text(list[k][0], x, y + k * 46, 19, UI.accent, { weight: 'bold' });
        kit.text(list[k][1], x + 260, y + k * 46, 17, UI.text);
      }
    } }
  ];

  function turn(d) {
    page = (page + d + PAGES.length) % PAGES.length;
    SZ.GameAudio && SZ.GameAudio.play('click', { volume: 0.2 });
  }

  function draw() {
    const v = visible();
    ctx.fillStyle = 'rgba(8,5,3,0.6)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    kit.panel(60, 30, 1160, 660, { accent: UI.accent });
    kit.text('How to Play', 100, 72, 32, UI.accent, { weight: 'bold' });
    kit.text(PAGES[page].title, 100, 112, 22, '#fff3c0', { weight: 'bold' });
    kit.button('Back', 1070, 46, 130, 44, () => scr.back(), { size: 18 });
    PAGES[page].draw(100, 150);
    kit.button('<', 470, 630, 60, 44, () => turn(-1), { size: 22 });
    kit.text((page + 1) + ' / ' + PAGES.length, 640, 652, 18, UI.dim, { align: 'center' });
    kit.button('>', 750, 630, 60, 44, () => turn(1), { size: 22 });
  }

  Object.assign(NS.help, { draw, turn });
})();
