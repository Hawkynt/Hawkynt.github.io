'use strict';

global.window = {};
require('../track-geometry.js');

const RacingTrack = window.SZ.RacingTrack;
const CIRCUMFERENCE = 2 * Math.PI * 1000;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

function circleControlPoints() {
  const pts = [];
  for (let k = 0; k < 16; ++k) {
    const a = k * 2 * Math.PI / 16;
    pts.push([Math.cos(a) * 1000, Math.sin(a) * 1000]);
  }
  return pts;
}

const circle = RacingTrack.build({ controlPoints: circleControlPoints(), width: 200, smooth: 0 });

/* Test 1: circle length, radius band, even spacing */
let ok1 = Math.abs(circle.length - CIRCUMFERENCE) < 0.02 * CIRCUMFERENCE;
let why1 = 'length ' + circle.length + ' expected ' + CIRCUMFERENCE;
for (let i = 0; i < circle.points.length && ok1; ++i) {
  const r = Math.hypot(circle.points[i].x, circle.points[i].y);
  if (r < 990 || r > 1010) {
    ok1 = false;
    why1 = 'radius ' + r + ' at point ' + i;
  }
}
for (let i = 0; i + 1 < circle.points.length && ok1; ++i) {
  const d = Math.hypot(circle.points[i + 1].x - circle.points[i].x, circle.points[i + 1].y - circle.points[i].y);
  if (d < 20 || d > 28) {
    ok1 = false;
    why1 = 'spacing ' + d + ' between points ' + i + ' and ' + (i + 1);
  }
}
check('circle', ok1, why1);

/* Test 2: locate distance and lateral sign */
const outer = circle.locate(0, 1100);
const inner = circle.locate(0, 900);
const ok2 = outer.dist >= 95 && outer.dist <= 105 &&
  Math.abs(outer.lateral) >= 95 && Math.abs(outer.lateral) <= 105 &&
  outer.lateral * inner.lateral < 0;
check('locate', ok2, 'outer ' + JSON.stringify(outer) + ' inner ' + JSON.stringify(inner));

/* Test 3: sampleAt wraps around the loop */
const w1 = circle.sampleAt(circle.length + 10);
const w2 = circle.sampleAt(10);
const w3 = circle.sampleAt(-10);
const w4 = circle.sampleAt(circle.length - 10);
const ok3 = Math.abs(w1.x - w2.x) < 0.001 && Math.abs(w1.y - w2.y) < 0.001 &&
  Math.abs(w3.x - w4.x) < 0.001 && Math.abs(w3.y - w4.y) < 0.001;
check('sampleAt', ok3, 'wrapped ' + JSON.stringify(w1) + ' vs ' + JSON.stringify(w2) +
  ', negative ' + JSON.stringify(w3) + ' vs ' + JSON.stringify(w4));

/* Test 4: progress across the wrap */
const p1 = circle.progress(circle.length - 5, 5);
const p2 = circle.progress(5, circle.length - 5);
const ok4 = Math.abs(p1 - 10) < 0.001 && Math.abs(p2 + 10) < 0.001;
check('progress', ok4, 'forward ' + p1 + ' backward ' + p2);

/* Test 5: heavy smoothing keeps the length sane */
const smoothed = RacingTrack.build({ controlPoints: circleControlPoints(), width: 200, smooth: 20 });
const ok5 = Math.abs(smoothed.length - CIRCUMFERENCE) < 0.05 * CIRCUMFERENCE;
check('smooth', ok5, 'smoothed length ' + smoothed.length + ' expected ' + CIRCUMFERENCE);

/* Test 6: hinted locate finds the same segment */
const base = circle.locate(0, 1100);
const hinted = circle.locate(0, 1100, base.index);
const ok6 = hinted.index === base.index;
check('hint', ok6, 'unhinted ' + base.index + ' hinted ' + hinted.index);

process.exit(failures ? 1 : 0);
