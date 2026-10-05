'use strict';

global.window = {};

/* A recording 2D context: every drawing call is counted, nothing is rendered. */
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0 };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText', 'drawImage',
    'save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
    'setLineDash', 'quadraticCurveTo', 'bezierCurveTo'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.createLinearGradient = function() { ++c.calls; return gradient; };
  c.createRadialGradient = function() { ++c.calls; return gradient; };
  c.createPattern = function() { ++c.calls; return {}; };
  c.getLineDash = function() { return []; };
  c.measureText = function() { return { width: 0 }; };
  return c;
}

function fakeCanvas() {
  return { width: 0, height: 0, getContext: () => fakeCtx() };
}

global.document = { createElement: () => fakeCanvas() };

require('../track-geometry.js');
require('../tracks-data.js');
require('../track-art.js');

const TRACKS = window.SZ.RacingTracks;
const Art = window.SZ.RacingTrackArt;
const LIGHT_SPACING = 160;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module exports create', !!(Art && typeof Art.create === 'function'), JSON.stringify(Art && Object.keys(Art)));

let withChevrons = 0;
let badTheme = null;

for (let i = 0; i < TRACKS.length; ++i) {
  const track = TRACKS[i];
  const label = track.name || ('track ' + i);
  let geo = null;
  let art = null;
  try {
    geo = window.SZ.RacingTrack.build(track);
    art = Art.create(geo, track.theme);
  } catch (e) {
    check(label + ' create', false, e.message);
    continue;
  }

  const ctx = fakeCanvas().getContext('2d');
  let ok = true;
  let why = '';
  try {
    art.drawBackground(ctx, 0, 0, 1, 1.5, 1280, 720);
    art.drawBackground(ctx, 4200, -3100, 0.8, 7.25, 1280, 720);
    art.drawRoad(ctx, 1.5);
  } catch (e) {
    ok = false;
    why = 'draw threw ' + e.message;
  }
  if (ok && ctx.calls < 100) {
    ok = false;
    why = 'only ' + ctx.calls + ' canvas calls recorded';
  }
  check(label + ' draws', ok, why);

  const st = art.stats;
  const statsOk = st && st.lights > 0 && st.chevronGroups >= 0 && st.bendRuns >= 0;
  check(label + ' stats', statsOk, JSON.stringify(st));
  const wantLights = 2 * Math.ceil(geo.length / LIGHT_SPACING);
  check(label + ' light density', !!st && st.lights === wantLights,
    'lights ' + (st && st.lights) + ' expected ' + wantLights + ' for length ' + geo.length);

  if (st && st.chevronGroups > 0) ++withChevrons;
  console.log('  ' + label + ' [' + track.theme + '] lights ' + (st && st.lights) +
    ' chevronGroups ' + (st && st.chevronGroups) + ' bendRuns ' + (st && st.bendRuns));
}

/* unknown themes must fall back to the nebula palette and still draw */
try {
  const fallback = Art.create(window.SZ.RacingTrack.build(TRACKS[0]), 'not-a-theme');
  const fctx = fakeCanvas().getContext('2d');
  fallback.drawBackground(fctx, 0, 0, 1, 0, 1280, 720);
  fallback.drawRoad(fctx, 0);
} catch (e) {
  badTheme = e.message;
}
check('unknown theme fallback', badTheme === null, badTheme);

check('chevrons on most tracks', withChevrons >= 6, 'chevron groups on ' + withChevrons + ' of ' + TRACKS.length + ' tracks');

process.exit(failures ? 1 : 0);
