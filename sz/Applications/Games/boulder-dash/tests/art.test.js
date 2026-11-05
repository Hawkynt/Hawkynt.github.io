'use strict';

/* Art and screens on a counting fake canvas: every screen, cinematic shot and season draws
   without errors, no per-frame shadowBlur, the art caches stop creating canvases after the
   first frame, and a busy cave frame stays within a draw-call budget. */
const H = require('./harness.js');
const { gameCanvas } = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const ctx = gameCanvas.ctx;

function frame() {
  NS.sim.update(1 / 60);
  NS.frame.draw(1 / 60);
}

let errors = [];
function tryDraw(name, fn) {
  try { fn(); } catch (e) { errors.push(name + ': ' + e.message); }
}

/* all screens */
for (const scr of ['title', 'map', 'tree', 'wardrobe', 'journal', 'help'])
  tryDraw(scr, () => { G.screen = scr; for (let k = 0; k < 3; ++k) frame(); });
for (let t = 0; t < 3; ++t) tryDraw('wardrobe tab ' + t, () => { G.ui.wardrobeTab = t; G.screen = 'wardrobe'; frame(); });
for (let t = 0; t < 5; ++t) tryDraw('journal tab ' + t, () => { G.ui.journalTab = t; G.screen = 'journal'; frame(); });
for (const id of ['intro', 'chapter', 'boss', 'finale'])
  tryDraw('cinema ' + id, () => {
    NS.cinema.play(id, { ch: 3 }, () => {});
    for (let k = 0; k < 60 * 30 && G.cine; ++k) { NS.cinema.update(1 / 60); if (k % 20 === 0 && G.cine) NS.frame.draw(1 / 60); }
  });
tryDraw('dialogue', () => { NS.cinema.dialogue(NS.story.DIALOGUE[2], () => {}); frame(); NS.cinema.skip(); frame(); NS.cinema.skip(true); });
for (const mode of ['story', 'arcade', 'zen', 'daily', 'time'])
  tryDraw('play ' + mode, () => { NS.screens.launch(mode, { ch: 2, lv: 1 }); for (let k = 0; k < 120; ++k) frame(); });
tryDraw('boss', () => { NS.screens.launch('story', { ch: 4, lv: 7 }); for (let k = 0; k < 200; ++k) frame(); });
tryDraw('pause', () => { NS.screens.pause(); frame(); NS.screens.openOverlay('tree'); frame(); NS.screens.back(); frame(); NS.screens.resume(); frame(); });
tryDraw('results story', () => { G.results = { mode: 'story', ch: 0, lv: 2, stars: 3, score: 900, gold: 40, time: 30, par: 70, gems: 20, goal: 15, first: true, ach: NS.meta.ACHIEVEMENTS.slice(0, 2) }; G.screen = 'results'; for (let k = 0; k < 90; ++k) frame(); });
tryDraw('results arcade', () => { G.results = { mode: 'arcade', score: 9000, gold: 80, caves: 5, rank: 0, ach: [] }; G.screen = 'results'; G.results.x = 1; for (let k = 0; k < 90; ++k) frame(); });
for (const season of NS.meta.SEASONS)
  tryDraw('season ' + season.id, () => { G.season = season; G.demo = null; G.screen = 'title'; for (let k = 0; k < 3; ++k) frame(); NS.screens.launch('story', { ch: 0, lv: 0 }); frame(); });
check('every screen, cinematic, mode and season draws without errors', errors.length === 0, errors.join(' | '));

/* budgets in a busy cave */
G.season = NS.meta.SEASONS[0];
NS.screens.launch('story', { ch: 4, lv: 5 });
G.run.state = 'play';
for (let k = 0; k < 120; ++k) frame();
const canvasesBefore = H.canvases;
ctx.calls = 0; ctx.shadowBlurUsed = 0;
const N = 60;
for (let k = 0; k < N; ++k) frame();
const perFrame = ctx.calls / N;
check('no shadowBlur in per-frame drawing', ctx.shadowBlurUsed === 0, ctx.shadowBlurUsed);
check('art caches are warm: no new canvases while playing', H.canvases === canvasesBefore, (H.canvases - canvasesBefore) + ' new');
check('a busy cave frame stays under 3000 draw calls', perFrame < 3000, perFrame.toFixed(0));
console.log('draw calls per cave frame: ' + perFrame.toFixed(0));

/* the tile atlas has every animation */
const t = NS.tileArt.tiles('crystal', 'winter');
check('tile set: 2 x 16 dirt shapes, 4 boulders, 8 gem frames, 8 portal frames',
  t.dirt.length === 2 && t.dirt[0].length === 16 && t.boulder.length === 4 && t.gem.length === 8 && t.exitOpen.length === 8);
check('every skin paints all eleven poses both ways', NS.meta.SKINS.every((s) => {
  const set = NS.spriteArt.miner(s.id);
  return Object.keys(set.right).length === 11 && Object.keys(set.left).length === 11;
}));
done();
