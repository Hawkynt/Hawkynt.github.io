'use strict';

/* Saving: migration of the first version's high scores and tutorial flag, the v2 save written
   back, the run snapshot restoring the cave exactly (continuing it gives the very same cave as
   never stopping), and Continue across a full reload of the game from localStorage. */
const path = require('path');
const H = require('./harness.js');
const { check, done } = H;

function freshLoad(store) {
  for (const k of Object.keys(require.cache)) if (k.includes(path.sep + 'js' + path.sep)) delete require.cache[k];
  global.window = {};
  const env = H.installEnv(store);
  return { NS: H.load(), env };
}

/* 1. migration of old keys */
const oldScores = [{ score: 4200, level: 6, date: 1 }, { score: 900, level: 2, date: 2 }];
let { NS, env } = freshLoad({ 'sz-boulder-dash-highscores': JSON.stringify(oldScores), 'sz-boulder-dash-tutorial-seen': '1' });
let G = NS.state;
check('old high scores survive into the arcade table', G.save.high.arcade.length === 2 && G.save.high.arcade[0].score === 4200 && G.save.high.arcade[0].legacy);
check('old tutorial flag is kept', G.save.seenHelp === true);
check('the v2 save is written', !!env.store['sz-boulder-dash-save-v2']);
const again = NS.save.loadSave();
check('migration does not import the old list twice', again.high.arcade.length === 2);
check('a corrupt save falls back to defaults', NS.progression.migrateSave('nonsense', null, false).gold === 0);

/* 2. snapshot determinism */
const C = NS.constants;
function script(n) {
  const r = NS.rng.make(77);
  const out = [];
  for (let k = 0; k < n; ++k) out.push({ dir: NS.rng.int(r, 5) - 1, grab: false, bomb: false });
  return out;
}
const moves = script(1500);
G.run = null;
NS.run.start('story', { ch: 1, lv: 3 });
let run = G.run;
run.state = 'play';
for (let k = 0; k < 600; ++k) NS.sim.stepCave(run.cave, moves[k]);
const snap = JSON.parse(JSON.stringify(NS.run.snapshot(run)));
for (let k = 600; k < 1500; ++k) { NS.sim.stepCave(run.cave, moves[k]); run.cave.events.length = 0; }
const straight = Array.from(run.cave.cells).join('');
const r2 = NS.run.restore(snap);
check('restore rebuilds the cave cell for cell', r2.cave.tick === snap.cave.tick && r2.cave.player.r === snap.cave.player.r);
for (let k = 600; k < 1500; ++k) { NS.sim.stepCave(r2.cave, moves[k]); r2.cave.events.length = 0; }
check('a restored cave plays on exactly like the original', Array.from(r2.cave.cells).join('') === straight);

/* 3. continue across a reload */
G.run = null;
NS.screens.launch('arcade', {});
run = G.run;
run.state = 'play';
run.score = 1234;
for (let k = 0; k < 300; ++k) NS.sim.stepCave(run.cave, moves[k]);
const cellsBefore = Array.from(run.cave.cells).join('');
NS.run.autosave();
const store = Object.assign({}, env.store);
({ NS, env } = freshLoad(store));
G = NS.state;
check('the title offers Continue after a reload', NS.screens.canContinue());
NS.screens.continueRun();
check('Continue resumes the same mode, cave and score', G.screen === 'playing' && G.run.mode === 'arcade' && G.run.score === 1234);
check('Continue restores the exact cave', Array.from(G.run.cave.cells).join('') === cellsBefore);
NS.screens.quitToTitle();
check('quitting keeps the snapshot', NS.screens.canContinue());
G.run = null;
NS.run.start('zen', {});
G.results = { mode: 'zen', ach: [] };
NS.run.gameOver(G.run);
check('finishing a run clears the snapshot', !NS.screens.canContinue());
done();
