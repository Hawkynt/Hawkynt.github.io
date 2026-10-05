'use strict';

global.window = {};
require('../track-geometry.js');
require('../tracks-data.js');

const TRACKS = window.SZ.RacingTracks;
const build = window.SZ.RacingTrack.build;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

/* The documented reversal, written from the specification: the first control
   point stays first and the rest of the closed polygon follows in reverse
   order, so the start line keeps its place and the lap runs the other way.
   Every feature moves to the matching point of the lap (t -> 1 - t) and to the
   mirrored side; a wormhole swaps its ends so entry and exit stay paired. */
function reversed(track) {
  const cp = track.controlPoints;
  const points = [cp[0]];
  for (let i = cp.length - 1; i >= 1; --i)
    points.push(cp[i]);
  return {
    name: track.name,
    theme: track.theme,
    width: track.width,
    smooth: track.smooth,
    laps: track.laps,
    controlPoints: points,
    boost: track.boost.map(f => [(1 - f[0]) % 1, -f[1]]),
    hazards: track.hazards.map(f => [(1 - f[0]) % 1, -f[1], f[2]]),
    gravity: track.gravity.map(f => [(1 - f[0]) % 1, -f[1], f[2], f[3]]),
    wormholes: track.wormholes.map(w => [(1 - w[1]) % 1, (1 - w[0]) % 1]),
    items: track.items.map(t => (1 - t) % 1)
  };
}

for (let i = 0; i < TRACKS.length; ++i) {
  const base = TRACKS[i];
  const rev = reversed(base);
  const label = base.name || ('track ' + i);

  /* 1: the reversed control polygon is [cp[0], cp[n-1], cp[n-2], ..., cp[1]] */
  const cp = base.controlPoints;
  let okCp = rev.controlPoints.length === cp.length;
  let whyCp = 'count ' + rev.controlPoints.length + ' expected ' + cp.length;
  for (let k = 0; k < cp.length && okCp; ++k) {
    const want = cp[(cp.length - k) % cp.length];
    if (rev.controlPoints[k][0] !== want[0] || rev.controlPoints[k][1] !== want[1]) {
      okCp = false;
      whyCp = 'point ' + k + ' ' + JSON.stringify(rev.controlPoints[k]) + ' expected ' + JSON.stringify(want);
    }
  }
  check(label + ' control points', okCp, whyCp);

  /* 2: every reversed feature still sits on the lap */
  const ts = [];
  for (let k = 0; k < rev.boost.length; ++k) ts.push(rev.boost[k][0]);
  for (let k = 0; k < rev.hazards.length; ++k) ts.push(rev.hazards[k][0]);
  for (let k = 0; k < rev.gravity.length; ++k) ts.push(rev.gravity[k][0]);
  for (let k = 0; k < rev.wormholes.length; ++k) {
    ts.push(rev.wormholes[k][0]);
    ts.push(rev.wormholes[k][1]);
  }
  for (let k = 0; k < rev.items.length; ++k) ts.push(rev.items[k]);
  let badT = null;
  for (let k = 0; k < ts.length; ++k) {
    if (!(ts[k] >= 0 && ts[k] < 1)) {
      badT = ts[k];
      break;
    }
  }
  check(label + ' reversed t range', badT === null, 't ' + badT);

  /* 3: the reversed geometry is the same loop -- a boost pad placed at the
        mirrored t and mirrored side lands on the original world point */
  let geoA = null, geoB = null;
  try {
    geoA = build(base);
    geoB = build(rev);
  } catch (e) {
    check(label + ' build', false, e.message);
  }
  if (geoA && geoB) {
    check(label + ' length', Math.abs(geoB.length - geoA.length) < 1,
      'reversed ' + geoB.length.toFixed(2) + ' vs ' + geoA.length.toFixed(2));

    let worst = 0, worstPad = -1;
    for (let k = 0; k < base.boost.length; ++k) {
      const t = base.boost[k][0], lat = base.boost[k][1];
      const rt = rev.boost[k][0], rlat = rev.boost[k][1];
      const a = geoA.sampleAt(t * geoA.length);
      const b = geoB.sampleAt(rt * geoB.length);
      const d = Math.hypot(a.x + a.nx * lat - (b.x + b.nx * rlat), a.y + a.ny * lat - (b.y + b.ny * rlat));
      if (d > worst) {
        worst = d;
        worstPad = k;
      }
    }
    check(label + ' boost pads', worst <= 5, 'pad ' + worstPad + ' off by ' + worst.toFixed(2) + ' units');

    /* hazards sit off the centerline: their point on the road matches, and the
       side they hang on flips -- at a hairpin the two resampled polylines can
       disagree about the local normal, so the offset point is not compared */
    let worstH = 0, worstIdx = -1, badLat = null;
    for (let k = 0; k < base.hazards.length; ++k) {
      const t = base.hazards[k][0], lat = base.hazards[k][1];
      const rt = rev.hazards[k][0], rlat = rev.hazards[k][1];
      if (rlat !== -lat) badLat = lat + ' -> ' + rlat;
      const a = geoA.sampleAt(t * geoA.length);
      const b = geoB.sampleAt(rt * geoB.length);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > worstH) {
        worstH = d;
        worstIdx = k;
      }
    }
    check(label + ' hazard mirror', badLat === null && worstH <= 5,
      'lateral ' + badLat + ', road point ' + worstIdx + ' off by ' + worstH.toFixed(2) + ' units');
  }
}

process.exit(failures ? 1 : 0);
