/* How to Play: five illustrated pages (flight and drilling, ore and the hold, the station
   economy, hazards, progression and controls) drawn with the game's own art, paged with the
   arrows, the page dots or the buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { ORES, ZONES } = NS.ores;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const RA = NS.rockArt;
  const PA = NS.propArt;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  const PAGES = [
    { title: 'Flight and drilling', draw: flight },
    { title: 'Ore and the hold', draw: ore },
    { title: 'The station economy', draw: economy },
    { title: 'Hazards of the belts', draw: hazards },
    { title: 'Progress and controls', draw: progress },
  ];

  function draw() {
    const v = NS.view.visible();
    ctx.fillStyle = G.helpReturn === 'paused' ? 'rgba(2,4,12,0.85)' : 'rgba(2,4,12,0.65)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const page = G.ui.helpPage;
    kit.panel(60, 40, 1160, 600, { alpha: 0.95 });
    kit.text('HOW TO PLAY', 90, 76, 14, UI.accent, { weight: 'bold' });
    kit.text(PAGES[page].title, 90, 104, 28, '#ffffff', { weight: 'bold' });
    PAGES[page].draw();
    for (let i = 0; i < PAGES.length; ++i) {
      const x = 640 + (i - (PAGES.length - 1) / 2) * 26;
      const hot = W.area('dot' + i, x - 10, 604, 20, 20, () => { G.ui.helpPage = i; });
      ctx.fillStyle = i === page ? UI.gold : hot ? UI.text : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(x, 614, i === page ? 6 : 4, 0, TAU);
      ctx.fill();
    }
    W.button('prev', 'Previous', 90, 656, 170, 44, { disabled: page === 0, action: () => turn(-1) });
    W.button('next', 'Next', 1020, 656, 170, 44, { disabled: page === PAGES.length - 1, action: () => turn(1) });
    W.button('close', G.helpReturn === 'paused' ? 'Back to the trip' : 'Close', 560, 656, 160, 44, { accent: UI.gold, action: () => NS.screens.setScreen(G.helpReturn || 'title') });
  }

  function turn(d) {
    const n = Math.max(0, Math.min(PAGES.length - 1, G.ui.helpPage + d));
    if (n !== G.ui.helpPage) {
      G.ui.helpPage = n;
      sfx('click', { volume: 0.4 });
    }
  }

  function onKey(e) {
    turn(e.code === 'ArrowLeft' ? -1 : 1);
  }

  function para(lines, x, y, w) {
    let yy = y;
    for (let i = 0; i < lines.length; ++i) yy += kit.wrap(lines[i], x, yy, w, 15, 21, UI.text) + 10;
    return yy;
  }

  function flight() {
    const t = G.time;
    const pal = ZONES[0].theme.rock;
    const rx = 920, ry = 320;
    K.blitRot(ctx, RA.body(3, 0, pal), rx, ry, t * 0.1, 1.8);
    K.blitRot(ctx, RA.veins(3, 0, 'copper'), rx, ry, t * 0.1, 1.8);
    K.blitRot(ctx, RA.cracks(3, 0, 2), rx, ry, t * 0.1, 1.8);
    const sx = 700, sy = 380;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,106,58,0.3)';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(sx + 26, sy - 10);
    ctx.lineTo(rx - 70, ry + 20);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    K.blit(ctx, K.glow('#ffd090'), rx - 70, ry + 20, 1.2);
    ctx.globalCompositeOperation = 'source-over';
    K.blitRot(ctx, NS.shipArt.shipSprite('prospector', NS.ships.HULLS[0].colors, 0), sx, sy, -0.35, 1.6);
    for (let i = 0; i < 5; ++i) K.blitRot(ctx, RA.nugget('copper', i % 3), 760 + i * 26, 470 + Math.sin(t * 3 + i) * 8, t * 2 + i, 1.4);
    kit.text('the tractor beam reels nuggets in', 820, 510, 13, UI.textDim, { align: 'center' });
    para([
      'Fly with WASD or the arrow keys - or hold the right mouse button to thrust toward the cursor. Space has inertia: let go to drift, the engines brake gently.',
      'Aim with the mouse and hold the left button to drill. Space drills with auto-aim. The laser heats a rock until it cracks into smaller rocks and ore nuggets; the smallest crumble completely.',
      'The tractor beam pulls nearby nuggets into the hold. Shift boosts once you have researched the Afterburner.',
      'Fly back into the DOCK ring slowly to end the trip - the hold is unloaded at the station.',
    ], 90, 140, 520);
  }

  function ore() {
    para([
      'Every ore has its own colour and glow. Rarer ore is worth far more but sits in harder rock in more dangerous belts.',
      'The hold has limited space. A full hold is your cue to go home. Rare ore also yields research data.',
    ], 90, 140, 470);
    for (let i = 0; i < ORES.length; ++i) {
      const o = ORES[i];
      const x = 620 + (i % 2) * 290, y = 160 + Math.floor(i / 2) * 76;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + Math.sin(G.time * 2 + i) * 0.2;
      K.blit(ctx, K.glow(o.color), x, y, 0.9);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, RA.nugget(o.id, i % 3), x, y, G.time + i, 2);
      kit.text(o.name, x + 28, y - 10, 16, o.glow, { weight: 'bold' });
      kit.text('~' + o.value + ' cr  -  ' + ['common', 'common', 'uncommon', 'uncommon', 'valuable', 'valuable', 'rare', 'rare', 'very rare', 'legendary'][i], x + 28, y + 12, 12, UI.textDim);
    }
  }

  function economy() {
    NS.stationArt.draw(ctx, 900, 360, 0.4, G.save.modules, G.time);
    para([
      'At Kessler Station your hold goes into the warehouse. Sell from the Market tab whenever the price is right: prices drift every cycle (each trip is one cycle), booms and busts make the news, and selling a lot at once pushes a price down for a while.',
      'Build a Refinery to smelt three ore into one bar worth more. Contracts pay well for set deliveries of ore or bars - plus research data.',
      'Spend credits in the Shipyard on new hulls and on upgrades that level up to 10, and on station modules: refinery, drone bay, scanner array, trade hub and fuel depot. Refuelling and repairs are billed when you dock.',
    ], 90, 140, 560);
  }

  function hazards() {
    const t = G.time;
    const items = [
      ['Volatile rocks', 'Red-veined rocks explode when cracked - and set off their neighbours. Stand back, or use them.', (x, y) => {
        K.blitRot(ctx, RA.body(2, 1, ZONES[1].theme.rock), x, y, t * 0.3, 1.4);
        K.blitRot(ctx, RA.veins(2, 1, 'volatile'), x, y, t * 0.3, 1.4);
      }],
      ['Radiation fields', 'Green haze burns the hull slowly. Uranium gathers inside. Lead Lining helps.', (x, y) => {
        K.blit(ctx, PA.radCloud(7), x, y, 0.4);
      }],
      ['Solar storms', 'A warning, then a burning front that shoves your ship. Shields soak it up.', (x, y) => {
        K.blit(ctx, K.glow('#ffb060'), x, y, 1.6);
      }],
      ['Gravity wells', 'They drag ships, nuggets and small rocks in. Never touch the core.', (x, y) => {
        K.blitRot(ctx, PA.well(), x, y, t * 0.6, 0.38);
      }],
      ['Pirates', 'Skimmers steal ore from your hold, raiders and gunships shoot. Your laser cuts hulls too.', (x, y) => {
        K.blitRot(ctx, PA.pirate('raider'), x, y, -0.4, 1.2);
      }],
      ['Fuel and hull', 'Out of fuel, a tow takes half your hold. Lose the hull and the hold is gone.', (x, y) => {
        kit.icon('fuel', x - 14, y, 30, UI.fuel);
        kit.icon('hull', x + 18, y, 30, UI.hull);
      }],
    ];
    for (let i = 0; i < items.length; ++i) {
      const x = 100 + (i % 2) * 560, y = 160 + Math.floor(i / 2) * 140;
      items[i][2](x + 50, y + 40);
      kit.text(items[i][0], x + 120, y + 16, 18, '#ffffff', { weight: 'bold' });
      kit.wrap(items[i][1], x + 120, y + 30, 400, 14, 19, UI.textDim);
    }
  }

  function progress() {
    para([
      'Research data buys the tech tree: Drilling, Engines, Logistics, Automation (mining drones), Defense and Science. Open it from the title, the station or the pause menu - it takes effect at once.',
      'Licences open the next belt once your total earnings are high enough. Each belt has its own look, ore and hazards. Geodes and derelicts hide in them; somewhere in the Void Crown waits the Crown Heart.',
      'Gold Rush: five minutes in your best belt, sell at the dock as often as you like. Daily Belt: one seeded belt a day with the same standard rig for everyone.',
    ], 90, 140, 520);
    const rows = [['WASD / Arrows', 'Fly'], ['Right mouse', 'Fly toward the cursor'], ['Left mouse', 'Drill at the cursor'], ['Space', 'Drill with auto-aim'],
      ['Shift', 'Boost'], ['Q', 'Scanner pulse'], ['C', 'Seismic charge'], ['F', 'Recall / launch drones'], ['Esc / P', 'Pause'], ['Tab', 'Station tabs'],
      ['B', 'Research the selected node'], ['F2', 'Title screen']];
    kit.panel(680, 140, 500, 440, { alpha: 0.8, brackets: false });
    for (let i = 0; i < rows.length; ++i) {
      kit.text(rows[i][0], 710, 170 + i * 34, 15, UI.gold, { weight: 'bold' });
      kit.text(rows[i][1], 880, 170 + i * 34, 15, UI.text);
    }
  }

  Object.assign(NS.help, {
    PAGES, draw, onKey
  });
})();
