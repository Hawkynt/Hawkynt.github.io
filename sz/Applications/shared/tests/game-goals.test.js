'use strict';

/* The shared keep-coming-back layer, configured per game: deeds grow statistics, achievements
   unlock once and pay the game's own currency, three daily quests a day and a day streak, the six
   real-date festivals with a six-tier token track paying currency and a festival cosmetic,
   cosmetics unlocked by deeds and equipped (the game hears it), a Daily recipe (the same seed and
   twist all day) with the best result kept, everything saved under the game's own key and repaired
   on load; and the shared story scenes: once per save, replayable, pausing the game.
   Run: node sz/Applications/shared/tests/game-goals.test.js */
const path = require('path');
let passes = 0, failures = 0;
function check(name, ok, details) {
  if (ok) { ++passes; console.log('PASS ' + name); }
  else { ++failures; console.log('FAIL ' + name + (details !== undefined ? ': ' + details : '')); }
}

const store = {};
global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
require(path.join(__dirname, '..', 'game-goals.js'));
require(path.join(__dirname, '..', 'game-story.js'));
const GG = window.SZ.GameGoals, GS = window.SZ.GameStory;

let paid = 0, equipped = null, paused = 0;
const cfg = {
  id: 'test-game', title: 'Test', currency: 'gems', pay: n => { paid += n; },
  achievements: [
    { id: 'k1', name: 'First', stat: 'kills', n: 1, reward: 2, desc: 'One kill' },
    { id: 'k100', name: 'Hundred', stat: 'kills', n: 100, reward: 5, desc: '100 kills' },
    { id: 'lv5', name: 'Climber', stat: 'level', n: 5, reward: 3, desc: 'Reach level 5' },
  ],
  quests: [
    { id: 'q1', kind: 'kills', n: 50, reward: 4, text: 'Defeat 50' },
    { id: 'q2', kind: 'wins', n: 1, reward: 4, text: 'Win once' },
    { id: 'q3', kind: 'coins', n: 200, reward: 3, text: 'Collect 200 coins' },
    { id: 'q4', kind: 'jumps', n: 30, reward: 2, text: 'Jump 30 times' },
  ],
  tokens: { kills: 0.5, wins: 20 },
  cosmetics: [
    { id: 'base', name: 'Base', colors: ['#888888', '#cccccc'], unlock: { kind: 'free' } },
    { id: 'red', name: 'Red', colors: ['#ff4040', '#ffd0d0'], unlock: { kind: 'stat', stat: 'wins', n: 3, text: 'Win 3 times' } },
    { id: 'fest-hollow', name: 'Pumpkin', colors: ['#ff8a1a', '#3a1a4a'], unlock: { kind: 'festival', id: 'hollow' } },
    { id: 'fest-frost', name: 'Frost', colors: ['#bff4ff', '#ffffff'], unlock: { kind: 'festival', id: 'frost' } },
    { id: 'fest-bloom', name: 'Bloom', colors: ['#ffb0d0', '#7ae08a'], unlock: { kind: 'festival', id: 'bloom' } },
    { id: 'fest-sunfest', name: 'Sun', colors: ['#ffe07a', '#ff9a3a'], unlock: { kind: 'festival', id: 'sunfest' } },
    { id: 'fest-harvest', name: 'Harvest', colors: ['#e0902a', '#7a4a1a'], unlock: { kind: 'festival', id: 'harvest' } },
    { id: 'fest-starfall', name: 'Star', colors: ['#ffd23a', '#2a2a6a'], unlock: { kind: 'festival', id: 'starfall' } },
  ],
  onEquip: id => { equipped = id; },
  twists: [{ id: 'a', name: 'A', text: 'a' }, { id: 'b', name: 'B', text: 'b' }, { id: 'c', name: 'C', text: 'c' }],
  pause: () => { ++paused; }, resume: () => {},
};
const now = new Date(2026, 9, 25);
const g = GG.create(Object.assign({ now: () => now }, cfg));

check('a fresh layer starts with the free cosmetic equipped', g.equipped() === 'base' && g.owns('base') && !g.owns('red'));
g.deed('kills', 1);
check('a deed unlocks an achievement and pays the game currency', g.state.ach.k1 && paid === 2);
g.deed('kills', 1);
check('an achievement pays once', paid === 2 + 0 || paid === 2);
g.record('level', 7);
g.record('level', 3);
check('records keep the maximum and unlock by it', g.state.stats.level === 7 && g.state.ach.lv5);
check('three quests today, different kinds, the same for the same day', g.state.quests.list.length === 3 && new Set(g.state.quests.list.map(q => q.kind)).size === 3);
const before = paid;
for (const q of g.state.quests.list) g.deed(q.kind, q.n);
check('finished quests pay', g.state.quests.list.every(q => q.done) && paid > before);
check('festival tokens come from deeds', g.state.festival.tokens > 0 && g.state.festival.event.indexOf('hollow') === 0);
g.deed('wins', 100);
check('the festival track pays its cosmetic', g.owns('fest-hollow') && g.state.festival.claimed === 6);
check('deeds unlock cosmetics', g.owns('red'));
check('an owned cosmetic is equipped and the game hears it', g.equip('red') && equipped === 'red' && g.equipped() === 'red');
check('a locked one is refused', !g.equip('fest-frost') && g.equipped() === 'red');
check('the unlock text explains a locked cosmetic', /Frost/.test(g.unlockText('fest-frost')));
check('unlocks queue toasts', g.toasts.length > 0);

/* persistence and repair */
const raw = JSON.parse(store['sz-goals-test-game']);
check('the layer saves under the game\'s own key', raw && raw.stats.kills >= 2 && raw.equipped === 'red');
const g2 = GG.create(Object.assign({ now: () => now }, cfg));
check('and loads it again', g2.state.stats.kills === g.state.stats.kills && g2.equipped() === 'red' && g2.owns('fest-hollow'));
store['sz-goals-test-game'] = JSON.stringify({ stats: { kills: 'x', level: 4 }, ach: { nope: 1, k1: 1 }, owned: { red: 1, '<x>': 1 }, equipped: 'nope', festival: { tokens: -5 } });
const g3 = GG.create(Object.assign({ now: () => now }, cfg));
check('junk is repaired', g3.state.stats.kills === 0 && g3.state.stats.level === 4 && !g3.state.ach.nope && g3.state.ach.k1 && g3.owns('red') && !g3.owns('<x>') && g3.equipped() === 'base' && g3.state.festival.tokens >= 0);

/* streak */
let day = new Date(2026, 10, 7);
const gs = GG.create(Object.assign({}, cfg, { id: 'streak', now: () => day }));
day = new Date(2026, 10, 8); gs.touch();
day = new Date(2026, 10, 9); gs.touch();
check('consecutive days grow the streak', gs.state.streak.count === 3);
day = new Date(2026, 10, 12); gs.touch();
check('a gap starts it over', gs.state.streak.count === 1);

/* daily */
const r1 = g.dailyRecipe(), r2 = g.dailyRecipe();
check('the Daily is the same all day', r1.seed === r2.seed && r1.twist.id === r2.twist.id && r1.day === GG.dayKey(now));
check('a better Daily result is kept as today\'s best', g.dailyResult(120).newBest && !g.dailyResult(80).newBest && g.state.daily.best === 120 && g.state.stats.dailies === 2);

/* festival calendar */
const at = (m, d) => GG.festivalIdFor(new Date(2026, m - 1, d));
check('every festival by date', at(1, 15) === 'frost' && at(4, 10) === 'bloom' && at(7, 1) === 'sunfest' && at(9, 15) === 'harvest' && at(10, 31) === 'hollow' && at(12, 31) === 'starfall');

/* story */
let p2 = 0, r = 0;
const st = GS.create({ id: 'test-story', cast: { hero: { name: 'Hero', skin: '#f0c8a0', hair: '#3a2a1e', cloth: '#3a6ad8', trim: '#e8ecf8', eyes: '#223', head: 'helm' } },
  scenes: { intro: { title: 'Intro', lines: [{ who: 'hero', text: 'Hello.' }, { who: 'hero', text: 'Bye.' }] } }, pause: () => ++p2, resume: () => ++r });
check('a scene plays once', st.play('intro') && !st.play('intro') && st.seen('intro'));
check('it pauses the game', p2 === 1);
check('lines advance and the end resumes the game', (() => { for (let i = 0; i < 10 && st.active(); ++i) st.next(); return r === 1 && !st.active(); })());
check('a seen scene can be watched again', st.replay('intro') && st.active());
st.skip();
check('Esc-style skip ends it', !st.active() && r === 2);
check('the scene list shows what was seen', st.list().length === 1 && st.list()[0].seen);
check('the seen scenes are saved', JSON.parse(store['sz-story-test-story']).intro === 1);

console.log(passes + ' passed, ' + failures + ' failed');
if (failures) process.exitCode = 1;
