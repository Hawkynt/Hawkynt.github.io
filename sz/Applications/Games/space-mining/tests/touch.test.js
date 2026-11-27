'use strict';

/* The command view on a touch screen: a tap selects a craft or a building (a double tap its kind),
   a tap on open space orders the selection there (or clears it when nothing is selected), a
   one-finger drag boxes, a long press attack-moves, two fingers pan and pinch to zoom, and the
   group chips at the left edge recall a group on a tap and set it on a long press. */
const H = require('./harness');
const env = H.installEnv();
const NS = H.load();
const { check, done } = H;
const G = NS.state;
const P = NS.command;
const CI = NS.commandInput;
void env;

let errors = 0;
const steps = n => { try { H.run(NS, n); } catch (e) { ++errors; console.log(e.stack); } };

G.save.seenIntro = true;
G.save.credits = 90000;
G.save.licenses = ['kessler', 'amber', 'verdant'];
NS.trip.startTrip('career', 2);
steps(30);
NS.cinematics.skip();
steps(10);
G.ship.maxHull = G.ship.hull = 1e6;
const site = G.base.site;
NS.base.grant('hub', site.hubX, site.hubY);
steps(2);
const hub = NS.base.hub();
const a = NS.units.spawn('fighter', hub.x + 300, hub.y, 'player');
const b = NS.units.spawn('fighter', hub.x + 340, hub.y + 30, 'player');
const c = NS.units.spawn('gunboat', hub.x + 320, hub.y - 40, 'player');
P.toggle(true);
P.plan(true);
G.cmd.x = hub.x + 300; G.cmd.y = hub.y; G.cmd.zoom = 0.6;
steps(120);
check('the command view is open and paused', G.cmd.on && G.cmd.plan);

/* screen point of a world point */
const scr = (x, y) => NS.camera.toView(x, y, {});
const ev = (id, extra) => Object.assign({ pointerType: 'touch', pointerId: id, button: 0, shiftKey: false, preventDefault() {} }, extra || {});
const tap = (p, id) => { CI.down(ev(id || 1), p); CI.up(ev(id || 1), p); };

/* a tap selects; a double tap selects the kind in view */
let p = scr(a.x, a.y);
G.time += 1;
tap(p);
check('a tap on a craft selects it', G.cmd.sel.length === 1 && G.cmd.sel[0] === a);
G.time += 0.1;
tap(p);
check('a double tap selects every craft of its kind in view', G.cmd.sel.length === 2 && G.cmd.sel.indexOf(b) >= 0 && G.cmd.sel.indexOf(c) < 0);

/* a tap on open space orders the selection there */
G.time += 1;
const open = { x: hub.x + 700, y: hub.y + 250 };
tap(scr(open.x, open.y));
check('a tap on open space moves the selection there', a.orders.length && a.orders[0].kind === 'move' && b.orders.length && G.cmd.sel.length === 2);

/* a long press attack-moves */
G.time += 1;
const lp = scr(hub.x + 500, hub.y - 300);
CI.down(ev(2), lp);
G.time += 0.6;
CI.up(ev(2), lp);
check('a long press attack-moves the selection', a.orders.length && a.orders[0].kind === 'amove');

/* a drag boxes */
G.time += 1;
P.clearSel();
const p0 = scr(hub.x + 260, hub.y - 80), p1 = scr(hub.x + 380, hub.y + 60);
a.x = hub.x + 300; a.y = hub.y; b.x = hub.x + 340; b.y = hub.y + 30; c.x = hub.x + 320; c.y = hub.y - 40;
CI.down(ev(3), p0);
CI.move({ x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }, ev(3));
CI.move(p1, ev(3));
CI.up(ev(3), p1);
check('a one-finger drag selects the craft in the box', G.cmd.sel.length === 3);

/* with nothing selected a tap on open space clears, and does not order */
G.time += 1;
P.clearSel();
a.orders.length = 0;
tap(scr(open.x, open.y));
check('a tap on open space with nothing selected orders nothing', G.cmd.sel.length === 0 && !a.orders.length);

/* two fingers pan and pinch */
G.time += 1;
const cx0 = G.cmd.x, z0 = G.cmd.zoom;
CI.down(ev(4), { x: 500, y: 300 });
CI.down(ev(5), { x: 700, y: 300 });
for (let k = 1; k <= 5; ++k) { CI.move({ x: 500 - 20 * k, y: 300 }, ev(4)); CI.move({ x: 700 - 20 * k, y: 300 }, ev(5)); }
check('two fingers dragging pan the view', G.cmd.x > cx0 + 50 && G.cmd.zoom === z0);
CI.move({ x: 250, y: 300 }, ev(4));
CI.move({ x: 750, y: 300 }, ev(5));
check('spreading them zooms in', G.cmd.zoom > z0);
const z1 = G.cmd.zoom;
CI.move({ x: 470, y: 300 }, ev(4));
CI.move({ x: 530, y: 300 }, ev(5));
CI.up(ev(4), { x: 470, y: 300 });
CI.up(ev(5), { x: 530, y: 300 });
check('pinching them zooms out', G.cmd.zoom < z1);
check('a two-finger gesture selects and orders nothing', G.cmd.sel.length === 0 && !a.orders.length && !G.cmd.box);

/* the group chips */
G.time += 1;
P.select([a, c], false);
const chip = CI.chips().find(k => k.n === 2);
check('the group chips sit at the left edge, 1-5 and a clear', CI.chips().length === 6 && CI.chips().some(k => k.n === 0) && chip.x < 100);
CI.down(ev(6), chip);
G.time += 0.6;
CI.up(ev(6), chip);
check('a long press on a chip sets the group from the selection', G.cmd.groups[2] && G.cmd.groups[2].length === 2);
P.clearSel();
G.time += 1;
tap(chip, 7);
check('a tap on a chip recalls it', G.cmd.sel.length === 2 && G.cmd.sel.indexOf(a) >= 0 && G.cmd.sel.indexOf(c) >= 0);
check('a chip press orders nothing', !a.orders.length);
G.time += 1;
tap(CI.chips().find(k => k.n === 0), 8);
check('the clear chip empties the selection', G.cmd.sel.length === 0);

/* a mouse still uses the mouse paths */
G.time += 1;
P.select([a], false);
const mo = Object.assign(ev(9), { pointerType: 'mouse' });
CI.down(mo, scr(open.x, open.y));
CI.up(mo, scr(open.x, open.y));
check('a mouse click on open space still clears rather than orders', G.cmd.sel.length === 0 && !a.orders.length);

/* flying, a touch button opens the command view */
P.toggle(false);
G.input.touch = true;
steps(2);
const cb = NS.touch.buttons().find(k => k.id === 'command');
check('in flight with an outpost a touch button offers the command view', !!cb);
NS.touch.down(20, cb.x, cb.y);
NS.touch.up(20);
check('tapping it opens the command view in pause-and-plan', G.cmd.on && G.cmd.plan);

/* drawn with touch on */
G.input.touch = true;
steps(3);
NS.commandHud.draw();
check('the command view draws its chips without errors', errors === 0);

done();
