'use strict';

/* Boots the whole game as index.html does, walks every screen, starts every mode and plays
   with scripted input for a while: nothing may throw, nothing may use shadowBlur, and every
   screen must register its clickable areas. */
const H = require('./harness');
const env = H.installEnv({ date: '2026-11-05T12:00:00' });
const NS = H.load();
const { check, done } = H;
const G = NS.state;

let threw = null;
function safe(fn) {
  try { fn(); } catch (e) { threw = threw || e; console.log(e.stack); }
}

safe(() => env.frames(30));
check('boots to the title', G.screen === 'title' && !threw, threw && threw.message);
check('the title registers its buttons', G.hitAreas.length >= 10, G.hitAreas.length);
check('the season is autumn on Nov 5', G.season.id === 'autumn');

for (const s of ['tree', 'wardrobe', 'goals', 'stats', 'help', 'map']) {
  safe(() => { NS.screens.open(s, 'title'); env.frames(5); });
  check('screen ' + s + ' draws and registers areas', G.screen === s && G.hitAreas.length > 2 && !threw, threw && threw.message);
}
for (let p = 0; p < NS.help.PAGES.length; ++p) safe(() => { G.ui.helpPage = p; NS.screens.open('help', 'title'); env.frames(2); });
for (const tab of ['skin', 'bomb', 'trail']) safe(() => { G.ui.wardTab = tab; NS.screens.open('wardrobe', 'title'); env.frames(2); });
for (const tab of ['quests', 'ach', 'event']) safe(() => { G.ui.goalsTab = tab; NS.screens.open('goals', 'title'); env.frames(2); });
check('every help, wardrobe and goals tab draws', !threw, threw && threw.message);

/* every mode starts and survives scripted play */
const MOVES = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
for (const mode of ['arcade', 'zen', 'daily', 'rush', 'story']) {
  safe(() => {
    NS.screens.setScreen('title');
    NS.run.newRun(mode, { world: 0, level: 0 });
    let n = 0;
    while (G.screen === 'cine' && n++ < 40) { NS.cine.advance(); env.frames(2); }
    for (let i = 0; i < 900; ++i) {
      if (i % 40 === 0) env.key(MOVES[(i / 40) % 4], 'keydown');
      if (i % 40 === 30) env.key(MOVES[(i / 40) % 4], 'keyup');
      if (i % 90 === 10) env.tap('Space');
      if (i % 200 === 50) env.tap('KeyX');
      env.frames(1);
      if (G.screen === 'results') { env.tap('Enter'); env.frames(2); }
    }
  });
  check('mode ' + mode + ' plays 15 seconds without errors', !threw && G.run && G.run.mode === mode, threw && threw.message);
}

/* pause menu and its sub screens */
safe(() => {
  NS.run.newRun('arcade');
  env.frames(100);
  env.tap('Escape');
  env.frames(3);
});
check('Escape pauses', G.screen === 'paused');
safe(() => { NS.screens.open('tree', 'paused'); env.frames(3); });
check('the tree opens over the paused arena', G.screen === 'tree' && NS.screens.inRun());
safe(() => { env.tap('Escape'); env.frames(2); });
check('Escape from the tree returns to the pause menu', G.screen === 'paused');
safe(() => { env.tap('Escape'); env.frames(2); });
check('Escape resumes', G.screen === 'playing');

/* cinematics */
for (const id of Object.keys(NS.story.CINEMATICS)) {
  safe(() => {
    NS.cine.play(id, () => NS.screens.setScreen('title'));
    for (let i = 0; i < 30 && G.screen === 'cine'; ++i) { env.frames(20); NS.cine.advance(); }
  });
  check('cinematic ' + id + ' plays to the end', G.screen === 'title' && !threw, threw && threw.message);
}

/* menu bar actions */
safe(() => { for (const a of ['tree', 'wardrobe', 'tutorial', 'controls', 'about', 'high-scores', 'new', 'pause']) { SZ.menuAction(a); env.frames(2); } });
check('menu bar actions run', !threw, threw && threw.message);

check('no shadowBlur anywhere', env.gameCanvas.ctx.shadowBlurUsed === 0);
done();
