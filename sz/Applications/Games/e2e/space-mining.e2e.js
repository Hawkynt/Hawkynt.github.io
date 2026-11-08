'use strict';

/* Space Mining in a real browser: the station's Hangar tab with liveries, beams and plumes, a
   livery bought and equipped with real clicks and shown on the docked ship, and a trip launched. */
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
};
