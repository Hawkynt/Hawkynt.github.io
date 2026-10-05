'use strict';

global.window = {};
require('../track-geometry.js');
require('../tracks-data.js');

const TRACKS = window.SZ.RacingTracks;
const KEYS = ['name', 'theme', 'width', 'smooth', 'laps', 'controlPoints', 'boost',
  'hazards', 'gravity', 'wormholes', 'items'];
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

for (let i = 0; i < TRACKS.length; ++i) {
  const track = TRACKS[i];
  const label = track.name || ('track ' + i);

  const missing = KEYS.filter(function(k) { return !(k in track); });
  check(label + ' keys', missing.length === 0, 'missing ' + missing.join(','));

  check(label + ' laps', track.laps === 2 || track.laps === 3, 'laps ' + track.laps);
  check(label + ' width', track.width >= 150 && track.width <= 220, 'width ' + track.width);
  check(label + ' control points', track.controlPoints.length >= 8, 'count ' + track.controlPoints.length);

  let trk = null;
  try {
    trk = window.SZ.RacingTrack.build(track);
  } catch (e) {
    check(label + ' build', false, e.message);
  }
  if (trk) {
    check(label + ' length', trk.length >= 6000 && trk.length <= 16000, 'length ' + trk.length);
  }

  const ts = [];
  for (let k = 0; k < track.boost.length; ++k) ts.push(track.boost[k][0]);
  for (let k = 0; k < track.hazards.length; ++k) ts.push(track.hazards[k][0]);
  for (let k = 0; k < track.gravity.length; ++k) ts.push(track.gravity[k][0]);
  for (let k = 0; k < track.wormholes.length; ++k) {
    ts.push(track.wormholes[k][0]);
    ts.push(track.wormholes[k][1]);
  }
  for (let k = 0; k < track.items.length; ++k) ts.push(track.items[k]);
  let badT = null;
  for (let k = 0; k < ts.length; ++k) {
    if (!(ts[k] >= 0 && ts[k] < 1)) {
      badT = ts[k];
      break;
    }
  }
  check(label + ' t range', badT === null, 't ' + badT);

  const maxLat = track.width / 2 - 20;
  let badLat = null;
  for (let k = 0; k < track.boost.length && badLat === null; ++k) {
    if (Math.abs(track.boost[k][1]) > maxLat) badLat = track.boost[k][1];
  }
  for (let k = 0; k < track.hazards.length && badLat === null; ++k) {
    if (Math.abs(track.hazards[k][1]) > maxLat) badLat = track.hazards[k][1];
  }
  check(label + ' lateral', badLat === null, 'lateral ' + badLat + ' beyond ' + maxLat);

  if (trk) {
    let badG = null;
    for (let k = 0; k < track.gravity.length; ++k) {
      const g = track.gravity[k];
      const p = trk.sampleAt(g[0] * trk.length);
      const off = g[1] * trk.width;
      const d = trk.locate(p.x + p.nx * off, p.y + p.ny * off).dist;
      if (d <= trk.width * 0.9) {
        badG = 'body ' + k + ' dist ' + d + ' limit ' + (trk.width * 0.9);
        break;
      }
    }
    check(label + ' gravity', badG === null, badG);
  }

  let badW = null;
  for (let k = 0; k < track.wormholes.length; ++k) {
    if (track.wormholes[k][0] === track.wormholes[k][1]) badW = JSON.stringify(track.wormholes[k]);
  }
  check(label + ' wormholes', badW === null, 'degenerate ' + badW);
}

process.exit(failures ? 1 : 0);
