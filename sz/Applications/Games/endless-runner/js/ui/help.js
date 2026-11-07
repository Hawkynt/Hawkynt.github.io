/* How to Play: five illustrated pages - controls for keyboard, mouse and touch; the moves;
   all thirteen power-ups with their icons; the obstacles and how each is passed; the modes and
   how progress works. Arrow keys or the buttons turn pages. Draws and registers hit areas; owns
   the page number in G.ui. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const kit = NS.kit;
  const K = NS.artKit;
  const W = NS.widgets;
  const scr = NS.screens;
  const PA = NS.propArt;
  const RA = NS.runnerArt;
  const { POWERS } = NS.items;
  const { sfx } = NS.audio;
  const { ctx } = NS.view;

  const PAGES = ['Controls', 'Moves', 'Power-ups', 'Obstacles', 'Modes & Progress'];

  function lines(list, x, y, gap) {
    for (let i = 0; i < list.length; ++i) {
      kit.text(list[i][0], x, y + i * gap, 17, UI.accent, { weight: 'bold' });
      kit.text(list[i][1], x + 250, y + i * gap, 17, '#ffffff');
    }
  }

  function pose(kind, f, x, y, k) {
    const spr = RA.frame(G.save.equip.char, G.save.equip.outfit, kind, f);
    ctx.drawImage(spr.canvas, x - RA.OX * k, y - RA.OY * k, RA.W * k, RA.H * k);
  }

  function page(p) {
    if (p === 0) {
      lines([['Space / W / Up', 'Jump - press again in the air to double jump'], ['S / Down', 'Slide (on the ground) - fast fall (in the air)'],
        ['Shift / D / Right', 'Dash forward, smashing small obstacles'], ['Arrows when it turns', 'Follow the screen: away from the floor jumps, toward it slides'],
        ['Release jump early', 'A shorter hop'], ['Esc / P', 'Pause - tech tree and collection from there'],
        ['Mouse', 'Left click: jump - right click: slide - middle click or wheel: dash'],
        ['Touch', 'Tap or swipe up: jump - swipe down: slide - swipe right: dash'], ['F2', 'Title screen - your run is saved for Continue']], 120, 160, 40);
    } else if (p === 1) {
      const moves = [['run', 2, 'Run', 'Automatic - the speed climbs as you go.'], ['jump', 0, 'Jump & double jump', 'Two jumps before you land (three with Spring Shoes or Triple Jump).'],
        ['slide', 0, 'Slide', 'Duck under overhangs - you stay down while one is above you.'], ['dash', 0, 'Dash', 'A burst of speed that smashes crates, fences and flyers.']];
      for (let i = 0; i < moves.length; ++i) {
        const x = 120 + i * 270;
        pose(moves[i][0], moves[i][1], x + 60, 330, 1.6);
        kit.text(moves[i][2], x + 60, 370, 18, UI.gold, { weight: 'bold', align: 'center' });
        kit.wrap(moves[i][3], x - 40, 392, 200, 14, 19, UI.textDim, { align: 'left' });
      }
      kit.wrap('Near misses - slipping past an obstacle by a hair - score a bonus and feed your combo. Coins, gems, smashes and power-ups feed it too; the multiplier climbs to x4 (x5 with Frenzy) and fades if you go quiet.', 120, 500, 1040, 17, 24, '#ffffff');
    } else if (p === 2) {
      for (let i = 0; i < POWERS.length; ++i) {
        const pw = POWERS[i];
        const x = 100 + (i % 2) * 540, y = 160 + Math.floor(i / 2) * 64;
        K.blit(ctx, PA.orb(pw.id), x + 22, y + 12, 0.8);
        kit.text(pw.name, x + 54, y + 2, 17, pw.color, { weight: 'bold' });
        kit.fitText(pw.desc, x + 54, y + 24, 470, 14, { color: UI.textDim });
      }
    } else if (p === 3) {
      const w = G.run && G.run.world !== undefined ? G.run.world : 0;
      const rows = [[PA.hurdle(w), 'Fences, crates, rocks and rollers', 'Jump them - or dash through'], [PA.barTile(w), 'Overhangs', 'Slide under'],
        [PA.wall(w), 'Walls', 'Double jump, or take the ledges'], [PA.spikeTile(w), 'Spikes', 'Jump - they cannot be smashed'],
        [PA.saw(w), 'Saws and flyers', 'Watch where they settle: red ring - jump, blue - slide'], [PA.pitFill(w), 'Pits', 'Jump across; fall in and the run ends']];
      for (let i = 0; i < rows.length; ++i) {
        const y = 170 + i * 72;
        const s = rows[i][0];
        const k = Math.min(56 / s.h, 70 / s.w);
        ctx.drawImage(s.canvas, 150 - s.w * k / 2, y - s.h * k / 2, s.w * k, s.h * k);
        kit.text(rows[i][1], 220, y - 10, 18, '#ffffff', { weight: 'bold' });
        kit.text(rows[i][2], 220, y + 14, 15, UI.textDim);
      }
    } else {
      kit.wrap('Story: help Nova carry the five Spark Cores home across five worlds. Each world has four stages and a guardian - two of them chase you, three fight you head-on: dodge their shots, grab the spark orbs and fire back. Stars: finish, collect 60% of the coins (take at most one hit against a guardian), and find all three Spark Shards.', 120, 160, 1040, 17, 25, '#ffffff');
      kit.wrap('Arcade runs forever through all five worlds with a high-score table and your best distance marked on the course. Featured adds the week\'s twist. Zen never ends your run. The Daily Run is the same course for everyone on this computer today - beat your ghost. Boss Rush opens once two guardians are free.', 120, 290, 1040, 17, 25, '#ffffff');
      kit.wrap('Coins from every mode buy upgrades in the tech tree (also from the pause menu). Gems buy runners and outfits. Daily quests, streaks, achievements and seasonal festivals pay extra - and every run saves itself, so you can always Continue.', 120, 420, 1040, 17, 25, '#ffffff');
    }
  }

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = 'rgba(8,6,22,0.88)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const p = G.ui.helpPage;
    kit.text('How to Play', 60, 44, 32, '#ffffff', { weight: 'bold' });
    kit.text(PAGES[p] + '  (' + (p + 1) + ' / ' + PAGES.length + ')', 60, 92, 20, UI.gold, { weight: 'bold' });
    page(p);
    W.button('prev', 'Previous', 380, 640, 170, 46, { action: () => turn(-1), disabled: p === 0 });
    W.button('next', p === PAGES.length - 1 ? 'Done' : 'Next', 730, 640, 170, 46, { action: () => { if (p === PAGES.length - 1) scr.back('help'); else turn(1); }, accent: UI.gold });
    W.button('back', 'Back', v.x1 - 190, 22, 160, 46, { action: () => scr.back('help'), icon: 'back' });
  }

  function turn(d) {
    G.ui.helpPage = Math.max(0, Math.min(PAGES.length - 1, G.ui.helpPage + d));
    sfx('click');
  }

  function onKey(e) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { turn(-1); return true; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { turn(1); return true; }
    return false;
  }

  Object.assign(NS.help, {
    PAGES, draw, onKey
  });
})();
