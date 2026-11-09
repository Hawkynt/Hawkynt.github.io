'use strict';

/* Tower Defense in a real browser: the campaign screen with its Daily Siege and Goals buttons,
   every Goals tab (today's quests and festival track, achievements, tower skins, Daily Siege), a
   skin equipped with a real click and seen on the towers, the Daily Siege started with its twist
   and a wave held counting it as played, and an achievement toast. */
exports.ns = 'TowerDefense';
exports.game = 'tower-defense';

exports.run = async (t) => {
  const W = '(function(){ const ws = [window].concat(Array.from(document.querySelectorAll("iframe")).map(f => f.contentWindow)); ' +
    'for (const w of ws) { try { if (w && w.SZ && w.SZ.TowerDefense && w.SZ.TowerDefense.state && w.SZ.TowerDefense.state.meta) return w; } catch (_) {} } return null; })()';
  const run = (body) => t.page.eval('(function(){ const w = ' + W + '; const NS = w.SZ.TowerDefense, G = NS.state; ' + body + ' })()');
  const url = t.base + '/sz/Applications/Games/tower-defense/index.html';
  await t.page.goto(url, '!!' + W);
  await t.page.eval('localStorage.clear()');
  await t.page.goto(url, '!!' + W);
  await t.wait(800);
  const clickId = async (id) => {
    const r = await run('const h = (G.prevRegions || []).find(r => r.id === ' + JSON.stringify(id) + '); if (!h) return null; ' +
      'const f = w === window ? null : Array.from(document.querySelectorAll("iframe")).find(e => e.contentWindow === w); const o = f ? f.getBoundingClientRect() : { left: 0, top: 0 }; ' +
      'const c = NS.env.canvas.getBoundingClientRect(); const k = c.width / G.canvasW * G.uiS; return { x: o.left + c.left + (h.x + h.w / 2) * k, y: o.top + c.top + (h.y + h.h / 2) * k };');
    if (!r) throw new Error('no region ' + id);
    await t.page.click(r.x, r.y);
    await t.wait(250);
  };
  await run('NS.mapSelect.openMapSelect();');
  await t.wait(600);
  await t.shot('01-campaign');
  t.check('the campaign screen offers the Daily Siege and Goals', await run('return (G.prevRegions || []).some(r => r.id === "ms-daily") && G.prevRegions.some(r => r.id === "ms-goals");'));
  await clickId('ms-goals');
  t.check('Goals opens on today\'s quests', await run('return G.overlay === "goals" && G.meta.quests.list.length === 3;'));
  await t.shot('02-goals-today');
  await clickId('goals-tab-ach');
  await t.shot('03-goals-achievements');
  await run('G.meta.skins.owned.gilded = true;');
  await clickId('goals-tab-skins');
  await t.wait(200);
  await t.shot('04-goals-skins');
  await clickId('goals-skin-gilded');
  t.check('a real click equips a skin', await run('return G.meta.skins.equipped === "gilded";'));
  await clickId('goals-tab-daily');
  await t.shot('05-goals-daily');
  await clickId('goals-daily-play');
  await t.wait(1500);
  await run('if (G.cine) NS.cinematics.skipCine && NS.cinematics.skipCine(); G.cine = null;');
  t.check('the Daily Siege starts on today\'s map with its twist', await run('const r = NS.deeds.todaysSiege(); return !!G.daily && G.currentMap === r.map && G.daily.twist.id === r.twist.id;'));
  /* a few towers on free cells next to the path, then a wave */
  await run('G.gold += 5000; let n = 0; const order = []; for (let r = 0; r < 17; ++r) for (let c = 0; c < 25; ++c) order.push([c, r]); ' +
    'order.sort((a, b) => Math.hypot(a[0] - 12, a[1] - 8) - Math.hypot(b[0] - 12, b[1] - 8)); ' +
    'for (const [c, r] of order) { if (n >= 6) break; if (NS.towers.placeTower(c, r, n % 3)) ++n; } ' +
    'G.towers.forEach((tw, i) => { if (i % 2 === 0) { NS.towers.upgradeTower(tw); NS.towers.upgradeTower(tw); } });');
  await t.wait(400);
  await t.shot('06-daily-built-gilded');
  const box = await run('const f = w === window ? null : Array.from(document.querySelectorAll("iframe")).find(e => e.contentWindow === w); const o = f ? f.getBoundingClientRect() : { left: 0, top: 0 }; ' +
    'const c = NS.env.canvas.getBoundingClientRect(); const xs = G.towers.map(tw => tw.x), ys = G.towers.map(tw => tw.y); ' +
    'const k = c.width / G.canvasW * (G.worldScale || 1); return { cx: o.left + c.left + c.width / 2, cy: o.top + c.top + c.height / 2 };');
  await t.page.screenshot(require('path').join(require('os').tmpdir(), 'sz-e2e', 'tower-defense', '06b-towers-closeup.png'), { x: box.cx - 160, y: box.cy - 110, width: 320, height: 220 }, 2);
  await run('NS.waves.startNextWave(); G.gameSpeed = 8;');
  for (let i = 0; i < 80 && !(await run('return G.state === "BUILD" && G.currentWave >= 1;')); ++i) await t.wait(250);
  t.check('holding a wave counts the Daily Siege as played', await run('return G.meta.stats.dailies === 1 && G.meta.daily.best >= 1 && G.meta.stats.waves >= 1;'));
  t.check('kills, towers and achievements are recorded', await run('return G.meta.stats.kills > 0 && G.meta.stats.towers >= 1 && !!G.meta.ach.kill1;'));
  await t.shot('07-wave-held-toasts');
};
