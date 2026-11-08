'use strict';

/* Space Mining in a real browser: the station's Hangar tab with liveries, beams and plumes, a
   livery bought and equipped with real clicks and shown on the docked ship; then a trip: Space
   drills the ore nearest the nose with a bent beam, docking banks the hold and the flight goes
   on with the Return home button, which ends the trip only when pressed. */
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
    G.run.cargo = { iron: 10, gold: 3 }; G.run.cargoUsed = 13; G.run.leftDock = true;
    s.x = G.dock.x + 30; s.y = G.dock.y; s.vx = s.vy = 0;
    NS.camera.snap(s.x, s.y);
  });
  await t.wait(700);
  await t.shot('07-docked-banked');
  t.check('docking banks the hold and keeps the trip going', await t.state("G.screen === 'playing' && G.run && G.run.bankedUnits === 13 && G.hitAreas.some(a => a.id === 'dock-home')"));
  await t.hit('dock-home');
  await t.wait(4200);
  await t.shot('08-report');
  t.check('Return home ends the trip with the report', await t.state("G.screen === 'results' && G.ui.results.hold.iron === 10"));
};
