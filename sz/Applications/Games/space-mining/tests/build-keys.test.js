'use strict';

/* Building by keyboard in the command view: B opens build mode and steps through the tabs, the
   digits pick a tile, the ghost starts on the nearest free spot, the arrows move it a cell at a
   time, Enter builds and keeps placing, Escape backs out; U upgrades the selected building or
   the one under the cursor, Shift+U every one of its kind; in the pilot view U upgrades the
   building under the aim; outside build mode the digits still recall groups. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const B = NS.base;

const key = (code, extra) => env.listeners.keydown.forEach(f => f(Object.assign({ code: code, key: code, preventDefault() {} }, extra || {})));
const steps = (n) => { for (let i = 0; i < n; ++i) { if (G.cine) { NS.cinematics.skip(); G.cine = null; } H.run(NS, 1); } };

G.save.seenIntro = G.save.seenHelp = true;
G.save.credits = 1e6;
G.save.licenses.push('amber', 'verdant');
NS.save.refreshStats();
NS.trip.startTrip('career', 2);
NS.cinematics.skip();
G.cine = null;
G.screen = 'playing';
G.run.pirateT = 1e9;
G.ship.maxHull = G.ship.hull = 1e6;
const s = G.base.site;
const hub = B.grant('hub', s.hubX, s.hubY);
G.save.bases.verdant = G.base.data;
for (const t of ['solar', 'solar', 'solar', 'habitat']) { const c = B.findSpot(t); B.grant(t, c.cx, c.cy); }
G.base.data.crew = 20;
G.base.data.stock.ore = { iron: 500, copper: 500, ice: 200 };
G.base.data.stock.bar = { iron: 200, copper: 200, titanium: 50 };
G.base.waveT = 1e9;
B.refresh();
steps(5);

key('Tab');
check('Tab opens the command view', G.cmd.on);
key('Digit1');
check('outside build mode the digits recall groups, not buildings', !G.cmd.place);
key('KeyB');
check('the first B opens build mode on the open tab', G.cmd.buildMode && G.cmd.cat === 'core');
const cat0 = G.cmd.cat;
key('KeyB');
check('the next B steps to the next tab', G.cmd.cat !== cat0);
while (G.cmd.cat !== 'defense') key('KeyB');
key('KeyB', { shiftKey: true });
check('Shift+B steps back', G.cmd.cat === 'power');
key('KeyB');
key('Digit1');
check('a digit picks that tile of the tab', G.cmd.place === 'laser');
const spot = B.findSpot('laser');
check('the ghost starts on the nearest free spot to the hub', G.cmd.kcell && G.cmd.kcell.cx === spot.cx && G.cmd.kcell.cy === spot.cy);
/* away from the hub */
const dx = spot.cx >= s.hubX + 1 ? 1 : -1, dy = spot.cy >= s.hubY + 1 ? 1 : -1;
key(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
key(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
key(dy > 0 ? 'ArrowDown' : 'ArrowUp');
check('the arrows move the ghost a cell at a time', G.cmd.kcell.cx === spot.cx + 2 * dx && G.cmd.kcell.cy === spot.cy + dy);
const at = { cx: G.cmd.kcell.cx, cy: G.cmd.kcell.cy };
const n0 = G.base.data.buildings.length;
key('Enter');
const built = G.base.data.buildings.find(o => o.type === 'laser');
check('Enter builds on the ghost\'s cell', G.base.data.buildings.length === n0 + 1 && built && built.cx === at.cx && built.cy === at.cy, G.cmd.msg && G.cmd.msg.text);
check('and keeps placing the same kind from the next free spot', G.cmd.place === 'laser' && G.cmd.kcell && !(G.cmd.kcell.cx === at.cx && G.cmd.kcell.cy === at.cy));
key('Enter');
check('a second Enter builds another', G.base.data.buildings.filter(o => o.type === 'laser').length === 2);
key('Escape');
check('Escape drops the building', !G.cmd.place && G.cmd.buildMode);
key('Escape');
check('a second Escape leaves build mode', !G.cmd.buildMode);
for (const o of G.base.data.buildings) o.prog = 1;
B.refresh();
steps(2);

/* U */
const solar = G.base.data.buildings.find(o => o.type === 'solar');
const v = NS.camera.toView(solar.x, solar.y, {});
G.input.mouseX = v.x; G.input.mouseY = v.y;
G.cmd.selB = null;
key('KeyU');
check('U upgrades the building under the cursor', solar.lvl === 2);
G.cmd.selB = hub;
key('KeyU');
check('or the selected one', hub.lvl === 2);
for (const o of G.base.data.buildings) o.prog = 1;
G.cmd.selB = solar;
key('KeyU', { shiftKey: true });
const solars = G.base.data.buildings.filter(o => o.type === 'solar');
check('Shift+U upgrades every one of its kind', solars.every(o => o.lvl >= 2) && solar.lvl === 3);
key('Tab');
check('leaving the command view leaves build mode too', !G.cmd.on && !G.cmd.buildMode);
const laser = G.base.data.buildings.find(o => o.type === 'laser');
G.input.aimWX = laser.x; G.input.aimWY = laser.y;
key('KeyU');
check('in the pilot view U upgrades the building under the aim', laser.lvl === 2);
G.cmd.on = true;
key('KeyB');
NS.frame.draw();
check('build mode labels the tiles and draws without errors', G.cmd.buildMode);

done();
