'use strict';

/* Fleet maths (pure): formation slots, rotation and slot matching, group speed, and order
   handling - move, queued waypoints, patrol legs, escort following its target, attack ending
   with its target, return, and replacing versus queueing. */
const H = require('./harness');
H.installEnv();
const NS = H.load('systems/orders.js');
const { check, done } = H;
const F = NS.formations, O = NS.orders;

const close = (a, b, e) => Math.abs(a - b) < (e || 1e-6);

for (const kind of F.KINDS) {
  for (const n of [1, 2, 5, 9, 16]) {
    const s = F.slots(kind, n, 40);
    let mx = 0, my = 0, minD = Infinity;
    for (let i = 0; i < n; ++i) {
      mx += s[i].x / n;
      my += s[i].y / n;
      for (let k = i + 1; k < n; ++k) minD = Math.min(minD, Math.hypot(s[i].x - s[k].x, s[i].y - s[k].y));
    }
    check(kind + ' x' + n + ': one slot per unit', s.length === n);
    check(kind + ' x' + n + ': centred on the anchor', close(mx, 0, 1e-6) && close(my, 0, 1e-6) || kind === 'box' && Math.abs(mx) < 20 && Math.abs(my) < 1e-6);
    if (n > 1) check(kind + ' x' + n + ': slots keep their spacing', minD >= 40 * 0.74);
  }
}
const line = F.slots('line', 3, 50);
check('a line stands abreast (across the facing)', line.every(p => p.x === 0) && line[0].y === -50 && line[2].y === 50);
const wedge = F.slots('wedge', 5, 40);
check('a wedge leads with its tip', wedge[0].x > wedge[1].x && wedge[1].x > wedge[3].x && close(wedge[1].y, -wedge[2].y));
const circ = F.slots('circle', 8, 40);
check('a circle rings the anchor', circ.every(p => close(Math.hypot(p.x, p.y), Math.hypot(circ[0].x, circ[0].y), 1e-6)));
const p = F.place({ x: 10, y: 0 }, 100, 100, Math.PI / 2);
check('slots turn with the facing', close(p.x, 100) && close(p.y, 110));
const q = F.place({ x: 0, y: 10 }, 0, 0, Math.PI / 2);
check('right of a unit facing down is screen left', close(q.x, -10) && close(q.y, 0));

const units = [{ x: 0, y: 0, r: 10, speed: 300 }, { x: 100, y: 0, r: 18, speed: 170 }, { x: 200, y: 0, r: 12, speed: 210 }];
const pts = [{ x: 205, y: 5 }, { x: 5, y: 5 }, { x: 95, y: 0 }];
const pick = F.assign(units, pts);
check('each unit takes the slot nearest to it', pick[0] === 1 && pick[1] === 2 && pick[2] === 0);
check('each slot is taken once', new Set(F.assign(units, F.worldSlots('box', 3, 0, 0, 0, 40))).size === 3);
check('a group moves at its slowest member\'s speed', F.groupSpeed(units) === 170);
check('spacing grows with the biggest hull', F.spacing(units) === 18 * 2 + 26);

/* orders */
const mk = (x, y) => ({ x: x, y: y, r: 12, speed: 200, alive: true, orders: [] });
const g = [mk(0, 0), mk(30, 0), mk(60, 0), mk(90, 0)];
O.issue(g, 'move', { x: 1000, y: 0, formation: 'line' });
check('a move order gives every unit its own slot', new Set(g.map(u => Math.round(u.orders[0].y))).size === 4 && g.every(u => close(u.orders[0].x, 1000, 1e-6)));
check('the line faces the way the group travels (across the path)', g.every(u => close(u.orders[0].facing, 0)));
check('the group keeps the slowest speed', g.every(u => u.orders[0].speed === 200));
O.issue(g, 'move', { x: 1000, y: 800, queue: true, formation: 'wedge' });
check('shift queues a waypoint behind the first', g.every(u => u.orders.length === 2 && u.orders[1].formation === 'wedge'));
check('the queued leg faces from the first point to the second', close(g[0].orders[1].facing, Math.PI / 2, 1e-6));
const u0 = g[0];
u0.x = u0.orders[0].x;
u0.y = u0.orders[0].y;
check('arriving finishes a move and the next waypoint starts', O.current(u0) === u0.orders[0] && u0.orders.length === 1 && u0.orders[0].formation === 'wedge');
O.issue(g, 'move', { x: -500, y: 0 });
check('a new order without shift replaces the queue', g.every(u => u.orders.length === 1 && u.orders[0].x < 0));

O.issue(g, 'patrol', { x: 0, y: 1000, formation: 'box' });
const pu = g[1], po = pu.orders[0];
check('a patrol runs between two ends', po.leg === 1 && close(po.by, po.y) && po.ay < 200);
pu.x = po.bx; pu.y = po.by;
O.current(pu);
check('reaching one end turns it round', po.leg === 0 && pu.orders.length === 1);
pu.x = po.ax; pu.y = po.ay;
O.current(pu);
check('and it never ends', po.leg === 1 && pu.orders.length === 1);

const ship = { x: 500, y: 500, angle: 0, r: 20, alive: true };
O.issue(g, 'escort', { target: ship, formation: 'wedge' });
const pt = O.point(g[0], g[0].orders[0], {});
check('escorts keep station behind the ship', pt.x < ship.x);
ship.x = 900; ship.angle = Math.PI;
const pt2 = O.point(g[0], g[0].orders[0], {});
check('escort slots follow and turn with the ship', pt2.x > ship.x && O.current(g[0]).kind === 'escort');

const foe = { x: 300, y: 0, alive: true };
O.issue(g, 'attack', { target: foe });
check('attack orders go for the target', g.every(u => u.orders[0].target === foe) && O.point(g[0], g[0].orders[0], {}).x === 300);
foe.alive = false;
check('an attack ends with its target', O.current(g[0]) === null && g[0].orders.length === 0);
O.issue(g, 'return', { home: { x: -100, y: -100 } });
check('return heads for the hub', g.every(u => Math.hypot(u.orders[0].x + 100, u.orders[0].y + 100) < 120));
const hurt = { x: 0, y: 0, hp: 10, maxHp: 50, alive: true };
O.issue([g[0]], 'repair', { target: hurt });
hurt.hp = 50;
check('a repair order ends when the target is whole', O.current(g[0]) === null);

done();
