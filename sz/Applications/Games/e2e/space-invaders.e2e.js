'use strict';

/* Space Invaders' story and goals in a real browser: the first campaign stage opens with the
   prologue and the sector's arrival while play holds, a boss stage opens with the boss's word, an
   aura equipped in Goals glows behind the ship, and destroyed aliens count toward an achievement. */
exports.ns = 'SpaceInvaders';
exports.game = 'space-invaders';

exports.run = async (t) => {
  const M = require('./meta-helpers')(t, 'SpaceInvaders');
  await M.open('space-invaders');
  await M.run('NS.stages.startStage(0);');
  await t.wait(1500);
  t.check('the first stage opens with the prologue and holds play', await M.has('.szs-overlay') && await M.run('return G.hold === true;'));
  await t.shot('01-prologue');
  let n = 0;
  while (await M.has('.szs-overlay') && n++ < 40) await M.click('.szs-overlay');
  t.check('the scenes play through and play resumes', !(await M.has('.szs-overlay')) && await M.run('return !G.hold;'));
  await M.run('NS.stages.startStage(4);');
  await t.wait(1200);
  t.check('a boss stage opens with the boss\'s word', await M.has('.szs-overlay') && (await M.text('.szs-text b')) === 'Crater Warden');
  await t.shot('02-boss');
  n = 0;
  while (await M.has('.szs-overlay') && n++ < 20) await M.click('.szs-overlay');
  await M.run('NS.meta.goals.state.owned.plasma = true; NS.meta.open("cos");');
  await t.wait(300);
  await M.click('[data-a="equip"][data-v="plasma"]');
  await M.click('[data-a="close"]');
  await M.run('NS.stages.startStage(1);');
  await t.wait(600);
  n = 0;
  while (await M.has('.szs-overlay') && n++ < 20) await M.click('.szs-overlay');
  await M.run('const a = G.aliens.find(a => a.alive); if (a) NS.combat.destroyAlien(a);');
  await t.wait(800);
  t.check('an aura is equipped and a destroyed alien unlocks an achievement', await M.run('return NS.meta.goals.equipped() === "plasma" && !!NS.meta.goals.state.ach.k1;'));
  await t.shot('03-aura');

  /* Zen: no ship is lost and a landing fleet is pushed back */
  await M.run('NS.waves.newGame("zen");');
  await t.wait(400);
  const lives = await M.run('return G.lives;');
  await M.run('NS.combat.killPlayer();');
  t.check('Zen never loses a ship', await M.run('return G.lives === ' + lives + ';'));
  await t.wait(2500);
  await M.run('G.gameState = "playing"; G.player.alive = true; for (const a of G.aliens) a.y = G.player.y; NS.collisions.resolveCollisions();');
  await t.wait(300);
  t.check('Zen pushes a landing fleet back', await M.run('return G.gameState !== "gameover" && G.aliens.every(a => a.y < G.player.y);'));

  /* autosave: a new wave is stored and Continue resumes it with score and lives */
  await M.run('NS.waves.newGame("classic"); G.score = 4321; G.lives = 2; NS.waves.startNextLevel();');
  t.check('a new wave is autosaved', await M.run('const s = NS.autosave.load(); return !!s && s.score === 4321 && s.level === 2 && s.lives === 2;'));
  await M.run('NS.screens.setScreen("title");');
  await t.wait(500);
  t.check('the title offers Continue', await M.run('return G.hitAreas.some(h => h.id === "t-continue");'));
  await t.shot('04-title-continue');
  await M.run('G.score = 0; NS.autosave.resume();');
  t.check('Continue resumes the wave with score and lives', await M.run('return G.gameMode === "classic" && G.level === 2 && G.score === 4321 && G.lives === 2 && G.gameState === "playing";'));
};
