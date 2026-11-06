/* How to Play: eight illustrated pages (flight and drilling, resources and the hold, the
   station economy, hazards, progression and controls, outposts, waves and the fleet, life in
   the belts) drawn with the game's own art, paged with the arrows, the page dots or the
   buttons. */
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
    { title: 'Outposts', draw: outposts },
    { title: 'Waves and the fleet', draw: fleet },
    { title: 'Life in the belts', draw: life },
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
      'Twenty-two resources: bulk ore and precious metals in the rocks, crystals and exotic matter in the outer belts, nebula gas you scoop by flying through a pocket, scrap from wrecks and kills, and bio-matter from the living rocks and Bloom clouds.',
      'Rarer resources are worth far more, sit in harder rock in more dangerous belts and yield research data. The hold has limited space - a full hold is your cue to go home, or to unload at your outpost hub.',
    ], 90, 140, 420);
    for (let i = 0; i < ORES.length; ++i) {
      const o = ORES[i];
      const x = 550 + (i % 3) * 215, y = 150 + Math.floor(i / 3) * 56;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45 + Math.sin(G.time * 2 + i) * 0.2;
      K.blit(ctx, K.glow(o.color), x, y, 0.6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, RA.nugget(o.id, i % 3), x, y, G.time + i, 1.4);
      kit.text(o.name, x + 20, y - 8, 14, o.glow, { weight: 'bold' });
      kit.text('~' + o.value + ' cr  -  ' + NS.ores.KIND_NAMES[o.kind], x + 20, y + 10, 11, UI.textDim);
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
      ['Shift', 'Boost'], ['Q', 'Scanner pulse'], ['C', 'Seismic charge'], ['F', 'Recall / launch drones'], ['Esc / P', 'Pause'], ['Tab', 'Command view / station tabs'],
      ['B', 'Research the selected node'], ['F2', 'Title screen']];
    kit.panel(680, 140, 500, 440, { alpha: 0.8, brackets: false });
    for (let i = 0; i < rows.length; ++i) {
      kit.text(rows[i][0], 710, 170 + i * 34, 15, UI.gold, { weight: 'bold' });
      kit.text(rows[i][1], 880, 170 + i * 34, 15, UI.text);
    }
  }

  function card(x, y, title, text, draw) {
    draw(x + 50, y + 40);
    kit.text(title, x + 110, y + 16, 17, '#ffffff', { weight: 'bold' });
    kit.wrap(text, x + 110, y + 30, 420, 13, 18, UI.textDim);
  }

  function outposts() {
    const A = NS.colonyArt;
    para([
      'Every belt has an outpost site. Press Tab in flight for the command view, pick the Command Hub and click inside the site to found an outpost. Fly slowly over the hub to unload your hold into its stock - buildings are paid in credits and stock.',
      'Buildings must be in link range of the hub or a power relay; links carry power - and infection and nanoprobes. Extractors stand on deposits. Everything that draws power or needs crew runs slower without them.',
    ], 90, 140, 1100);
    const items = [
      ['Extract', 'Mining rigs, gas siphons and crystal harvesters on deposits feed the stock.', 'rig'],
      ['Refine', 'Smelter and refinery turn three ore into a bar; the fabricator turns bars into circuits, alloy, fuel cells, optics, serum, plasma coils and warp cores.', 'fabricator'],
      ['Power', 'Solar arrays, and fusion reactors that burn hydrogen or helium-3. Relays carry the grid further.', 'fusion'],
      ['Live', 'Habitats house crew and fleet supply; the trade depot ships the best stock home; the lab writes research data.', 'habitat'],
    ];
    for (let i = 0; i < items.length; ++i) {
      const it = items[i];
      card(100 + (i % 2) * 560, 290 + Math.floor(i / 2) * 140, it[0], it[1], (x, y) => K.blit(ctx, A.building(it[2], 2), x, y, 0.75));
    }
  }

  function fleet() {
    const FA = NS.fleetArt;
    para([
      'While you are in a belt with an outpost, attack waves come on a timer: pirate raids, alien swarms and the Lattice, bigger with every wave, the belt and what the outpost is worth. A Sensor Array shows the next wave early. Wave 8 brings a hive mothership.',
      'Shipyard and drone factory build units. In the command view: left click or drag to select, double-click for a type, right click to move, attack, escort, mine or repair, Shift to queue waypoints, Ctrl+1-9 groups, Z X C V for line, wedge, box and circle. Space pauses to plan. In flight: G escort me, R return, E attack where I aim.',
    ], 90, 140, 1100);
    const units = ['fighter', 'gunboat', 'escort', 'transport', 'miner', 'mender', 'purger'];
    for (let i = 0; i < units.length; ++i) {
      const u = NS.fleetData.UNIT_BY_ID[units[i]];
      const x = 130 + i * 150, y = 330;
      K.blitRot(ctx, FA.unit(u.id), x, y, -Math.PI / 2 + Math.sin(G.time + i) * 0.1, 1.8);
      kit.text(u.name, x, y + 52, 13, u.color, { align: 'center', weight: 'bold' });
    }
    const foes = ['swarmer', 'raider', 'bomber', 'frigate', 'carrier', 'siege', 'nanodrone', 'mothership'];
    for (let i = 0; i < foes.length; ++i) {
      const e = NS.fleetData.ENEMY_BY_ID[foes[i]];
      const x = 120 + i * 140, y = 480;
      K.blitRot(ctx, FA.enemy(e.id), x, y, Math.PI / 2, Math.min(1.2, 40 / e.r));
      kit.text(e.name, x, y + 56, 12, e.color, { align: 'center', weight: 'bold' });
    }
  }

  function life() {
    para([
      'The outer belts are alive. Spore-crusted rocks burst when drilled, crystal growths shed swarmers, Bloom clouds drift and hive nests sleep in hollow rocks until disturbed. Their bio-matter is valuable - and contaminates the hold.',
      'Unload contaminated cargo at a hub without a Sensor Array or Medical Bay and the Bloom gets in: infection grows in staffed buildings, spreads along links and kills crew. Quarantine cuts links, the Medical Bay treats (twice as fast with serum), sterilising kills it - and some crew. When the last crew dies the outpost is abandoned; leave it and it becomes a hive.',
      'The Lattice: nanoprobes rewrite what they touch. Corruption spreads along links; at 100% a building turns on you - turrets fire on your fleet, factories make Lattice drones, reactors drain the grid - and units desert. Purge with circuits, purge tenders or the hub\'s EMP; firewall research slows it.',
      'Distress calls lead to silent stations: clear the guards, dock, and bring the survivors to your outpost as crew. Every week one belt runs an anomaly with special rules and better pay; seasons change the belts; a daily contract builds a streak.',
    ], 90, 140, 1100);
  }

  Object.assign(NS.help, {
    PAGES, draw, onKey
  });
})();
