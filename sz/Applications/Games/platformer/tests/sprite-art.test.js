'use strict';

global.window = {};

const fs = require('fs');

/* A recording 2D context: every drawing call is counted, nothing is rendered. */
function fakeCtx() {
  const gradient = { addColorStop: function() {} };
  const c = { calls: 0, images: 0, gradients: 0, globalAlpha: 1, globalCompositeOperation: 'source-over' };
  const plain = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse', 'rect', 'roundRect',
    'fill', 'stroke', 'clip', 'fillRect', 'strokeRect', 'clearRect', 'fillText', 'strokeText',
    'save', 'restore', 'translate', 'rotate', 'scale', 'transform', 'setTransform', 'resetTransform',
    'setLineDash', 'quadraticCurveTo', 'bezierCurveTo'];
  for (let i = 0; i < plain.length; ++i)
    c[plain[i]] = function() { ++c.calls; };
  c.drawImage = function() { ++c.calls; ++c.images; };
  c.createLinearGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createRadialGradient = function() { ++c.calls; ++c.gradients; return gradient; };
  c.createPattern = function() { ++c.calls; return {}; };
  c.getLineDash = function() { return []; };
  c.measureText = function() { return { width: 0 }; };
  return c;
}

let canvasCount = 0;
function fakeCanvas() {
  ++canvasCount;
  return { width: 0, height: 0, getContext: () => fakeCtx() };
}

global.document = { createElement: () => fakeCanvas() };

require('../js/logic/progression.js');
const PARTS = ['kit', 'hero', 'foes', 'bosses', 'items', 'icons'].map(n => '../js/art/sprites/' + n + '.js');
for (const part of PARTS)
  require(part);

const Art = window.SZ.PlatformerSprites;
const SKINS = window.SZ.PlatformerProgress.SKINS;
let failures = 0;

function check(name, ok, details) {
  if (ok) {
    console.log('PASS ' + name);
  } else {
    ++failures;
    console.log('FAIL ' + name + ': ' + details);
  }
}

function validSprite(s) {
  return !!s && !!s.c && s.w > 0 && s.h > 0 && typeof s.ax === 'number' && typeof s.ay === 'number'
    && s.c.width === Math.ceil(s.w * Art.SCALE) && s.c.height === Math.ceil(s.h * Art.SCALE);
}

check('module registered', !!Art && typeof Art.hero === 'function', 'SZ.PlatformerSprites missing');
check('export frozen', Object.isFrozen(Art), 'SZ.PlatformerSprites is not frozen');
const src = PARTS.map(part => fs.readFileSync(require.resolve(part), 'utf8')).join('\n');
check('no shadowBlur in source', src.indexOf('shadowBlur') < 0, 'shadowBlur found');
check('frame tables', Art.HERO_FRAMES.run === 8 && Art.ENEMY_FRAMES.turret === 2 && Art.BOSS_FRAMES.idle === 4 && Art.ITEM_FRAMES.coin === 8, 'unexpected frame counts');

/* hero: every skin, pose and frame */
let bad = [];
let err = null;
try {
  for (const skin of SKINS)
    for (const pose of Object.keys(Art.HERO_FRAMES))
      for (let f = 0; f < Art.HERO_FRAMES[pose]; ++f) {
        const s = Art.hero(skin, pose, f);
        if (!validSprite(s)) bad.push(skin.id + '/' + pose + '/' + f);
        else if (Math.abs(s.ax - s.w / 2) > 0.5 || s.ay < s.h * 0.85) bad.push(skin.id + '/' + pose + ' anchor');
      }
} catch (e) { err = e; }
check('hero sprites', !err && !bad.length, err ? err.stack : bad.slice(0, 5).join(', '));

/* enemies: every type, world, frame and state */
bad = [];
err = null;
const STATES = ['normal', 'windup', 'stunned', 'squash'];
try {
  for (const type of Object.keys(Art.ENEMY_FRAMES))
    for (let w = 0; w < 5; ++w)
      for (let f = 0; f < Art.ENEMY_FRAMES[type]; ++f)
        for (const st of STATES) {
          const s = Art.enemy(type, w, f, st);
          if (!validSprite(s)) bad.push(type + '/' + w + '/' + f + '/' + st);
          const air = type === 'flyer' || type === 'diver';
          if (air && Math.abs(s.ay - s.h / 2) > 1) bad.push(type + ' centre anchor');
          if (!air && s.ay < s.h * 0.8) bad.push(type + ' bottom anchor');
        }
} catch (e) { err = e; }
check('enemy sprites', !err && !bad.length, err ? err.stack : bad.slice(0, 5).join(', '));

/* bosses */
bad = [];
err = null;
try {
  for (const kind of Art.BOSS_KINDS)
    for (const pose of Object.keys(Art.BOSS_FRAMES))
      for (let f = 0; f < Art.BOSS_FRAMES[pose]; ++f) {
        const s = Art.boss(kind, pose, f);
        if (!validSprite(s) || s.w < 120 || s.c.width > 520 || s.c.height > 520) bad.push(kind + '/' + pose + '/' + f);
      }
} catch (e) { err = e; }
check('boss sprites', !err && !bad.length, err ? err.stack : bad.slice(0, 5).join(', '));

/* items: every kind, frame and variant */
const VARIANTS = { gem: 3, checkpoint: 2, goal: 5, qblock: 5, used: 5, crate: 5, crumble: 5, gate: 5, spring: 2, platform: 5, shot: 5, bossShot: 5 };
const FRAMES = Object.assign({ used: 1, crate: 1, crumble: 3, gate: 1, spring: 1, platform: 1, bossShot: 4, shield: 1, arrow: 1 }, Art.ITEM_FRAMES);
bad = [];
err = null;
try {
  for (const kind of Art.ITEM_KINDS)
    for (let v = 0; v < (VARIANTS[kind] || 1); ++v)
      for (let f = 0; f < (FRAMES[kind] || 1); ++f) {
        const s = Art.item(kind, f, v);
        if (!validSprite(s)) bad.push(kind + '/' + f + '/' + v);
        if (kind !== 'platform' && kind !== 'goal' && (s.c.width > 512 || s.c.height > 512)) bad.push(kind + ' too big');
      }
  const pl = Art.item('platform', 0, 0);
  if (pl.ax !== 0 || pl.ay !== 4) bad.push('platform anchor');
  const blk = Art.item('qblock', 0, 0);
  if (Math.abs(blk.ax - blk.w / 2) > 0.5 || Math.abs(blk.ay - blk.h / 2) > 0.5) bad.push('block centre anchor');
} catch (e) { err = e; }
check('item sprites', !err && !bad.length, err ? err.stack : bad.slice(0, 5).join(', '));

/* icons */
const ICONS = ['boot', 'heart', 'heartEmpty', 'coin', 'gem', 'flame', 'star', 'clock', 'skull', 'lock', 'shield', 'magnet', 'trophy', 'flag', 'bolt', 'map'];
bad = [];
err = null;
try {
  for (const n of ICONS)
    for (const size of [16, 32, 48]) {
      const s = Art.icon(n, '#ffd75a', size);
      if (!validSprite(s) || s.w !== size || s.ax !== size / 2) bad.push(n + '/' + size);
    }
} catch (e) { err = e; }
check('icons', !err && !bad.length, err ? err.stack : bad.slice(0, 5).join(', '));
check('icon names exported', ICONS.every(n => Art.ICON_NAMES.indexOf(n) >= 0), Art.ICON_NAMES.join(','));

/* caching: asking again builds nothing and returns the very same sprite */
const before = canvasCount;
const built = Art.cacheSize();
const a = Art.hero(SKINS[0], 'run', 3);
const b = Art.hero(SKINS[0], 'run', 3 + 8);
const e1 = Art.enemy('walker', 2, 1, 'normal');
const e2 = Art.enemy('walker', 2, 5, 'normal');
Art.boss('drake', 'idle', 2);
Art.item('coin', 3);
Art.icon('heart', '#ffd75a', 32);
check('sprites cached', canvasCount === before && Art.cacheSize() === built, (canvasCount - before) + ' new canvases');
check('same object returned', a === b && e1 === e2, 'cache returned different objects');

/* drawing a sprite is one blit */
const ctx = fakeCtx();
const s = Art.hero(SKINS[1], 'idle', 0);
ctx.drawImage(s.c, 100 - s.ax, 200 - s.ay, s.w, s.h);
check('one drawImage per sprite', ctx.images === 1 && ctx.calls === 1, ctx.calls + ' calls');

console.log(failures === 0 ? 'ALL PASS (' + Art.cacheSize() + ' sprites built)' : failures + ' FAILURES');
process.exit(failures === 0 ? 0 : 1);
