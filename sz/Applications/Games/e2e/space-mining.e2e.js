'use strict';

/* Space Mining in a real browser: the station's Hangar tab with liveries, beams and plumes, a
   livery bought and equipped with real clicks and shown on the docked ship; then a trip: Space
   drills the ore nearest the nose with a bent beam, docking banks the hold and the flight goes
   on with the Return home button, which ends the trip only when pressed; the belt map lists
   the Kessler operations and launches First Haul, which banking wins; an outpost in the
   Verdant Shoals installs a press, packs ore, orders a supply freighter and builds with ore
   from the hold; the Supply tab
   buys iron and puts it on the manifest, the launch loads it and the docked Supplies screen
   loads more; a flak tower gets its ingots smelted from the hold's iron and the defense tab
   offers the Tesla Coil and the Stasis Beam; the soundtrack starts calm and switches to the battle arrangement when a raider
   closes in; the Shipyard's Hardpoints page takes the Pulse Cannon and holding 1 fires it; the
   Amber Reach's first escort launches from the map, its freighter is ambushed at a choke point
   and docks at its trading post. */
exports.ns = 'SpaceMining';

exports.run = async (t) => {
  await t.open();
  await t.wait(1500);
  await t.shot('01-title');
  await t.run((NS, G) => { G.save.credits = 60000; G.save.rd = 500; NS.screens.setScreen('station'); G.ui.stationTab = 'hangar'; });
  await t.wait(400);
  await t.shot('02-hangar-liveries');
  t.check('the Hangar tab lists the liveries', await t.state("G.hitAreas.some(a => a.id === 'hg_livery_hazard')"));
  await t.hit('hg_livery_hazard');
  await t.wait(400);
  t.check('a real click buys and equips a livery', await t.state("G.save.cosmetics.livery === 'hazard' && G.stats.colors.hull === '#f0c030'"));
  await t.shot('03-hangar-bought');
  await t.hit('hk_beam');
  await t.wait(300);
  await t.shot('04-hangar-beams');
  await t.hit('hk_plume');
  await t.wait(300);
  await t.shot('05-hangar-plumes');
  t.check('the music engine plays a theme', await t.state('!SZ.GameMusic || !!SZ.GameMusic.current'));
  await t.run((NS, G) => {
    G.save.tree.l_blocks = 1;
    G.ui.stationTab = 'modules';
  });
  await t.hit('mod_blockPress');
  t.check('the researched ship press can be bought in Modules', await t.state('G.save.modules.blockPress === 1'));
  await t.shot('05b-ship-press');
  await t.run((NS) => { NS.trip.startTrip('career', 0); });
  for (let i = 0; i < 8 && await t.state('!!G.cine'); ++i) { await t.run((NS) => NS.cinematics.skip()); await t.wait(300); }
  await t.run((NS, G) => {
    for (const o of G.specials) o.found = true;
    const s = G.ship;
    s.x = G.dock.x + 900; s.y = G.dock.y; s.vx = s.vy = 0; s.angle = 0;
    G.rocks.length = 0;
    const r = NS.asteroids.restoreRock('rock', s.x + Math.cos(0.4) * 190, s.y + Math.sin(0.4) * 190, 3, 'gold', 1);
    r.vx = r.vy = r.vr = 0;
    G.rocks.push(r);
    NS.asteroids.rebuildGrid();
    NS.camera.snap(s.x, s.y);
  });
  await t.run((NS, G) => { G.input.keys.Space = true; });
  await t.wait(500);
  await t.shot('06-laser-cone');
  t.check('Space drills the ore off the nose without spinning the ship', await t.state('G.beams.length > 0 && Math.abs(G.ship.angle) < 0.45'));
  await t.run((NS, G) => { G.input.keys.Space = false; });
  await t.run((NS, G) => {
    const s = G.ship;
    NS.drones.setup(Object.assign({}, G.stats, { drones: 1 }));
    Object.assign(G.drones[0], { x: G.dock.x + 1000, y: G.dock.y, ore: 'iron', load: 7, state: 'haul' });
    G.run.cargo = { iron: 10, gold: 3 }; G.run.cargoUsed = 13; G.run.leftDock = true;
    s.x = G.dock.x + 30; s.y = G.dock.y; s.vx = s.vy = 0;
    NS.camera.snap(s.x, s.y);
  });
  await t.wait(700);
  await t.shot('07-docked-banked');
  t.check('docking banks the hold and remote drone basket immediately', await t.state("G.screen === 'playing' && G.run && G.run.bankedUnits === 20 && !G.drones[0].load && G.hitAreas.some(a => a.id === 'dock-home')"));
  t.check('the Kessler Drift has no outpost site', await t.state('G.base === null'));
  await t.hit('dock-home');
  await t.wait(4200);
  await t.shot('09-report');
  t.check('Return home ends the trip with the report', await t.state("G.screen === 'results' && G.ui.results.hold.iron === 17"));
  /* the belt map lists the Kessler operations; real clicks launch the first one */
  await t.run((NS, G) => { G.ui.mapSel = 0; NS.screens.setScreen('map'); });
  await t.wait(400);
  await t.shot('10-map-operations');
  t.check('the map lists the six Kessler operations', await t.state("['k_haul', 'k_copper', 'k_drones', 'k_geode', 'k_jumpers', 'k_charter'].every(id => G.hitAreas.some(a => a.id === 'op_' + id))"));
  await t.hit('op_k_haul');
  await t.hit('go_op');
  for (let i = 0; i < 12 && await t.state("!!G.cine || G.screen !== 'playing'"); ++i) { await t.run((NS) => NS.cinematics.skip()); await t.wait(300); }
  await t.wait(400);
  await t.shot('11-operation-tracker');
  t.check('the operation flies with its tracker', await t.state("G.run && G.run.op && G.run.op.id === 'k_haul' && G.run.op.status === 'active'"));
  await t.run((NS, G) => {
    G.run.cargo = { iron: 30, copper: 30 }; NS.mining.refreshCargoSpace(); G.run.leftDock = true;
    G.ship.x = G.dock.x + 30; G.ship.y = G.dock.y; G.ship.vx = G.ship.vy = 0;
    NS.camera.snap(G.ship.x, G.ship.y);
  });
  await t.wait(800);
  t.check('banking 60 units wins First Haul and pays at once', await t.state("G.run.op.status === 'won' && G.save.ops.k_haul.done"));
  await t.shot('12-operation-complete');
  await t.hit('dock-home');
  await t.waitFor("G.screen === 'results'", 15000);
  t.check('the report names the operation', await t.state("G.screen === 'results' && G.ui.results.op && G.ui.results.op.status === 'won'"));
  /* the Supply tab: real clicks buy iron and put it on the cargo manifest */
  await t.run((NS, G) => { G.save.credits = Math.max(G.save.credits, 5000); NS.screens.setScreen('station'); G.ui.stationTab = 'supply'; });
  await t.wait(300);
  const iron0 = await t.state('G.save.store.ore.iron || 0');
  await t.hit('buy10_ore_iron');
  t.check('a real click buys ten iron into the warehouse', await t.state('G.save.store.ore.iron === ' + (iron0 + 10)));
  await t.hit('sup_more_ore_iron');
  t.check('a real click orders ten iron on the cargo manifest', await t.state('G.save.manifest.ore.iron === 10'));
  await t.shot('14-supply-tab');
  /* the Shipyard's Hardpoints page: Claim Jumpers handed out the Pulse Cannon, a real click takes it */
  await t.run((NS, G) => { G.save.unlocks.push('w_pulse'); G.ui.stationTab = 'shipyard'; G.ui.yardPage = 'hp'; });
  await t.wait(300);
  await t.hit('wp_buy_pulse');
  t.check('a real click takes the Pulse Cannon into the first hardpoint', await t.state("G.save.weapons.owned.pulse === 1 && G.save.weapons.slots[0] === 'pulse'"));
  await t.shot('16-hardpoints');
  /* an outpost in the Verdant Shoals */
  await t.run((NS) => { NS.trip.startTrip('career', 2); });
  for (let i = 0; i < 8 && await t.state('!!G.cine'); ++i) { await t.run((NS) => NS.cinematics.skip()); await t.wait(300); }
  t.check('the launch loads the manifest as supplies', await t.state('G.run.freight.ore.iron === 10 && G.run.cargoUsed === NS.supply.slots(G.stats, G.run.freight) && G.run.cargoUsed > 0'));
  await t.run((NS, G) => {
    G.ship.maxHull = G.ship.hull = 1e6;
    const h = NS.base.grant('hub', G.base.site.hubX, G.base.site.hubY);
    G.base.data.stock.ore = { copper: 40 };
    G.ship.x = h.x; G.ship.y = h.y; G.ship.vx = G.ship.vy = 0;
    NS.camera.snap(h.x, h.y);
  });
  /* the soundtrack follows the fight: a raider close by switches to the war arrangement */
  t.check('the trip opens in the calm arrangement of the belt theme', await t.state("/:calm$/.test(W.SZ.GameMusic.current.id) && W.SZ.GameMusic.current.style === 'fm16calm'"));
  await t.run((NS, G) => { NS.pirates.spawn('raider', G.ship.x + 500, G.ship.y); });
  await t.wait(900);
  t.check('a raider closing in switches to the battle arrangement', await t.state("NS.music.state().cur === 'combat' && /:war$/.test(W.SZ.GameMusic.current.id) && W.SZ.GameMusic.intensity > 0.9"));
  /* holding the real 1 key fires the Pulse Cannon at it */
  const shots0 = await t.state('NS.hardpoints.state().shots');
  await t.page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
  await t.wait(500);
  await t.shot('17-pulse-cannon');
  await t.page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
  t.check('holding the real 1 key fires the Pulse Cannon', await t.state('NS.hardpoints.state().shots > ' + shots0 + ' && !NS.hardpoints.state().held[0]'));
  await t.run((NS, G) => { for (const p of G.pirates) p.alive = false; });
  await t.page.key('Tab', 'Tab', 9);
  t.check('Tab pauses at the outpost', await t.state('G.cmd.on && G.cmd.plan'));
  await t.run((NS, G) => { G.cmd.selB = NS.base.hub(); });
  await t.hit('base_press');
  t.check('the hub installs its own press for credits', await t.state('G.base.data.blockRank === 1 && G.save.modules.blockPress === 1'));
  await t.hit('loadOre');
  t.check('the hub loads 40 copper into 10 packed slots', await t.state('G.run.cargo.copper === 40 && NS.mining.cargoSpace("copper", 40) === 10 && !G.base.data.stock.ore.copper'));
  await t.shot('08-packed-ore');
  /* the hub orders a supply freighter with real clicks: copper bars from the station */
  const cr0 = await t.state('G.save.credits');
  await t.hit('ship_pack');
  await t.hit('ship_order');
  await t.wait(200);
  await t.shot('08a-supply-order');
  t.check('real clicks order a supply freighter of copper bars from the hub', await t.state("G.freighters.length === 1 && G.freighters[0].kind === 'supply' && G.freighters[0].pack === 'copper' && G.save.credits === " +
    cr0 + " - NS.supply.packPrice(G.save, G.stats, NS.supply.PACK_BY_ID.copper)"));
  /* the stock is empty now: a relay is paid with copper from the ship's hold */
  const spot = await t.run((NS, G) => {
    NS.command.startPlace('relay');
    const s = G.base.site, c = NS.base.findSpot('relay');
    return NS.camera.toView(s.x0 + (c.cx + 0.5) * s.cell, s.y0 + (c.cy + 0.5) * s.cell, {});
  });
  await t.page.mouseMove(0, 0);
  await t.clickAt(spot.x, spot.y);
  await t.wait(300);
  await t.shot('08b-built-from-hold');
  t.check('a relay is built with copper from the ship\'s hold', await t.state("G.base.data.buildings.some(b => b.type === 'relay') && G.run.cargo.copper === 36"));
  /* a flak tower needs iron ingots the outpost does not have: smelted from the hold's iron */
  const flakSpot = await t.run((NS, G) => {
    G.base.data.stock.ore = {};
    G.base.data.stock.bar = {};
    G.run.cargo.iron = 14;
    NS.mining.refreshCargoSpace();
    NS.command.startPlace('flak');
    const s = G.base.site, c = NS.base.findSpot('flak');
    return NS.camera.toView(s.x0 + (c.cx + 0.5) * s.cell, s.y0 + (c.cy + 0.5) * s.cell, {});
  });
  t.check('the tooltip tells the ingots get smelted from the ship\'s ore', await t.state("NS.buildMenu.costLines(NS.colony.buildCost('flak', G.stats), G.base.data.stock, NS.base.wallet(), NS.base.hold()).some(l => /smelted from 6 ore/.test(l[0]))"));
  await t.clickAt(flakSpot.x, flakSpot.y);
  await t.wait(300);
  await t.shot('08c-flak-from-hold');
  t.check('a flak tower is built from hold iron, its ingots smelted on the spot', await t.state("G.base.data.buildings.some(b => b.type === 'flak') && !G.run.cargo.iron"));
  /* the defense tab offers the Tesla Coil and the Stasis Beam */
  await t.run((NS, G) => { G.cmd.selB = null; G.cmd.place = null; });
  await t.hit('cat_defense');
  await t.wait(200);
  await t.shot('08d-defense-tab');
  t.check('a real click on the defense tab shows the Tesla Coil and the Stasis Beam', await t.state("G.hitAreas.some(a => a.id === 'b_tesla') && G.hitAreas.some(a => a.id === 'b_stasis')"));
  await t.page.key('Tab', 'Tab', 9);
  await t.run((NS, G) => {
    G.ship.x = G.dock.x + 30; G.ship.y = G.dock.y; G.ship.vx = G.ship.vy = 0;
    G.run.leftDock = true;
    NS.camera.snap(G.ship.x, G.ship.y);
  });
  await t.wait(500);
  t.check('the station banks the full unpacked amount and keeps the supplies aboard', await t.state('G.save.store.ore.copper === 66 && G.run.cargoUsed === NS.supply.slots(G.stats, G.run.freight) && !G.cmd.plan'));
  await t.hit('dock-supply');
  await t.wait(300);
  await t.shot('15-supplies-docked');
  t.check('the docked Supplies button opens the list and the trip waits', await t.state("G.screen === 'supply' && G.hitAreas.some(a => a.id === 'sup_back')"));
  const aboard = await t.state('G.run.freight.ore.iron || 0');
  await t.hit('sup_more_ore_iron');
  t.check('a real click loads ten iron aboard while docked', await t.state('G.run.freight.ore.iron === ' + (aboard + 10)));
  await t.hit('sup_back');
  t.check('Back returns to the flight', await t.state("G.screen === 'playing'"));
  await t.hit('dock-home');
  /* the docking autopilot takes a few seconds, more on a busy machine */
  await t.waitFor("G.screen === 'results'", 15000);
  await t.wait(300);
  await t.shot('13-report-verdant');
  t.check('the Verdant trip ends with the copper banked', await t.state("G.screen === 'results' && G.ui.results.hold.copper === 36"));
  /* the Amber Reach: real clicks launch the first escort; a freighter undocks, gets ambushed at
     its choke point and docks at its trading post */
  await t.run((NS, G) => {
    for (const o of NS.ops.zoneOps('kessler')) NS.ops.finish(G.save, o, true, 60);
    if (G.save.licenses.indexOf('amber') < 0) G.save.licenses.push('amber');
    NS.screens.setScreen('map');
  });
  await t.wait(300);
  /* the pointer and the keyboard cursor off every planet (either selects one), then the Amber Reach */
  await t.clickAt(640, 160);
  await t.run((NS, G) => { G.ui.mapSel = 1; G.ui.mapTab = 'ops'; G.menuCursor = -1; });
  await t.wait(300);
  await t.shot('18-map-amber');
  t.check('the map lists the nine Amber escorts', await t.state("NS.ops.zoneOps('amber').every(o => G.hitAreas.some(a => a.id === 'op_' + o.id))"));
  await t.hit('op_a_first');
  await t.hit('go_op');
  for (let i = 0; i < 12 && await t.state("!!G.cine || G.screen !== 'playing'"); ++i) { await t.run((NS) => NS.cinematics.skip()); await t.wait(300); }
  t.check('One Freighter lays out four trading posts and a freighter at the dock', await t.state("G.run.op.id === 'a_first' && G.posts.length === 4 && G.freighters.length === 1"));
  await t.run((NS, G) => {
    G.ship.maxHull = G.ship.hull = 1e6;
    /* nothing left to discover on the way, so no cinematic cuts in */
    for (const r of G.rocks) r.found = true;
    for (const o of G.specials) o.found = true;
    const f = G.freighters[0];
    f.wait = 0;
  });
  await t.waitFor("G.freighters[0].state === 'fly'", 5000);
  await t.run((NS, G) => {
    const f = G.freighters[0], p = G.posts.find(q => q.id === f.to);
    f.d = p.chokes[0].d - 300;
    NS.escort.at(p.path, f.d, f);
    G.ship.x = f.x - 200; G.ship.y = f.y + 120; G.ship.vx = G.ship.vy = 0;
    NS.camera.snap(f.x, f.y);
  });
  await t.waitFor("G.run.op.ambushes === 1", 5000);
  await t.wait(1500);
  await t.shot('19-escort-ambush');
  t.check('pirates ambush the freighter at its choke point', await t.state("G.run.op.ambushes === 1 && G.pirates.some(p => p.prey === G.freighters[0] || p.latch === G.freighters[0] || (p.loot && p.loot.f === G.freighters[0]))"));
  await t.run((NS, G) => {
    for (const p of G.pirates) p.alive = false;
    const f = G.freighters[0], p = G.posts.find(q => q.id === f.to);
    f.d = p.len - 30;
    NS.escort.at(p.path, f.d, f);
    G.ship.x = f.x - 200; G.ship.y = f.y + 120;
    NS.camera.snap(p.x, p.y);
  });
  await t.waitFor("G.freighters[0].state === 'done'", 5000);
  await t.wait(300);
  await t.shot('20-escort-delivered');
  t.check('the freighter docks at its post and wins the operation', await t.state("G.run.op.status === 'won' && G.save.ops.a_first.done && G.freighters[0].paid > 0"));
};
