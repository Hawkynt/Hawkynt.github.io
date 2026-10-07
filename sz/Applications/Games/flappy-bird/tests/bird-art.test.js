'use strict';

const fs = require('fs');
const path = require('path');

global.window = {};

/* A recording 2D context: every drawing call is counted, nothing is rendered.
   Assignments of the expensive blur knob are tracked so the test can prove the
   art never reaches for it - all detail must be baked into the sprite. */
let blurAssignments = 0;
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0 };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
    'save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
    'setLineDash', 'quadraticCurveTo', 'bezierCurveTo'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; };
  c.createLinearGradient = function() { ++c.calls; return gradient; };
  c.createRadialGradient = function() { ++c.calls; return gradient; };
  c.createPattern = function() { ++c.calls; return {}; };
  c.getLineDash = function() { return []; };
  c.measureText = function() { return { width: 0 }; };
  let blur = 0;
  Object.defineProperty(c, 'shadowBlur', {
    get: function() { return blur; },
    set: function(v) { blur = v; if (v) ++blurAssignments; }
  });
  return c;
}

let canvasCount = 0;
function fakeCanvas() {
  ++canvasCount;
  return { width: 0, height: 0, getContext: () => fakeCtx() };
}

global.document = { createElement: () => fakeCanvas() };

require('../bird-art.js');

const Art = window.SZ.FlappyBirdArt;
const IDS = ['sunny', 'ruby', 'jay', 'pip', 'snowy', 'phoenix'];
const FIELDS = ['name', 'body', 'belly', 'wing', 'wingDark', 'beak', 'beakDark', 'outline', 'eye', 'style'];
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

check('module registered', !!(Art && Art.BIRDS && Art.getSprite && Art.drawBird),
  'SZ.FlappyBirdArt exposes BIRDS, getSprite and drawBird');
if (!Art) {
  console.log(failures + ' FAILURES');
  process.exit(1);
}

const ids = Art.BIRDS.map(function(b) { return b.id; });
check('BIRDS has the six ids in order', ids.join(',') === IDS.join(','), 'got ' + ids.join(','));
check('BIRDS frozen', Object.isFrozen(Art.BIRDS), 'the array is not frozen');

for (let i = 0; i < Art.BIRDS.length; ++i) {
  const bird = Art.BIRDS[i];
  let missing = [];
  for (let f = 0; f < FIELDS.length; ++f)
    if (typeof bird[FIELDS[f]] !== 'string' || bird[FIELDS[f]] === '') missing.push(FIELDS[f]);
  check('fields of ' + bird.id, missing.length === 0, 'missing ' + missing.join(','));
  check('frozen ' + bird.id, Object.isFrozen(bird), 'bird object is not frozen');
}

for (let i = 0; i < IDS.length; ++i) {
  for (let f = 0; f < 4; ++f) {
    const name = 'sprite ' + IDS[i] + ' frame ' + f;
    let s = null;
    try {
      s = Art.getSprite(IDS[i], f);
    } catch (err) {
      check(name, false, 'threw ' + err.message);
      continue;
    }
    const isCanvas = !!(s && typeof s.getContext === 'function');
    check(name, isCanvas, 'no canvas returned');
    if (!isCanvas) continue;
    check(name + ' sized', s.width === 128 && s.height === 96, 'got ' + s.width + 'x' + s.height);
    check(name + ' cached', Art.getSprite(IDS[i], f) === s, 'second call returned another object');
  }
}

check('frame 5 wraps to frame 1', Art.getSprite('ruby', 5) === Art.getSprite('ruby', 1),
  'frame 5 returned another object than frame 1');
check('unknown id falls back to sunny', Art.getSprite('nonexistent', 2) === Art.getSprite('sunny', 2),
  'unknown id did not return the sunny sprite of that frame');

for (let i = 0; i < IDS.length; ++i) {
  const ctx = fakeCtx();
  let err = null;
  try {
    Art.drawBird(ctx, { x: 100, y: 50, angle: 0.4, birdId: IDS[i], frame: 2, scale: 1.25, alpha: 0.8 });
  } catch (e) {
    err = e;
  }
  check('drawBird ' + IDS[i], !err, err ? 'threw ' + err.message : '');
  if (!err) check('drawBird ' + IDS[i] + ' blits once', ctx.images === 1, 'drawImage called ' + ctx.images + ' times');
}

const bare = fakeCtx();
let bareErr = null;
try {
  Art.drawBird(bare, { x: 10, y: 20 });
} catch (e) {
  bareErr = e;
}
check('drawBird with defaults', !bareErr && bare.images === 1,
  bareErr ? 'threw ' + bareErr.message : 'drawImage called ' + bare.images + ' times');

check('no blur used while painting', blurAssignments === 0,
  'the blur knob was assigned a non-zero value ' + blurAssignments + ' times');

const source = fs.readFileSync(path.join(__dirname, '..', 'bird-art.js'), 'utf8');
check('source free of the blur knob', source.indexOf('shadowBlur') === -1,
  'bird-art.js mentions shadowBlur');

console.log(failures === 0 ? 'ALL PASS (' + canvasCount + ' sprites built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
