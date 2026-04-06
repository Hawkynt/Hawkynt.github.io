// Headless Node.js test runner — runs all tests without a browser
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// DOM shim
const noop = () => {};
function makeFakeCtx2d() {
  return {
    drawImage: noop, clearRect: noop, fillRect: noop, strokeRect: noop,
    beginPath: noop, arc: noop, fill: noop, stroke: noop, save: noop, restore: noop,
    fillText: noop, measureText: () => ({ width: 0 }),
    moveTo: noop, lineTo: noop, roundRect: noop, rect: noop,
    clip: noop, translate: noop, closePath: noop, setTransform: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    imageSmoothingEnabled: true, globalCompositeOperation: 'source-over',
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left',
    textBaseline: 'alphabetic', globalAlpha: 1, shadowColor: '', shadowBlur: 0, lineCap: 'butt',
  };
}
global.document = {
  getElementById: () => null,
  createElement: (tag) => {
    if (tag === 'canvas')
      return { width: 0, height: 0, className: '', style: {}, getContext: () => makeFakeCtx2d() };
    return { className: '', textContent: '', style: {}, children: [], appendChild(c) { this.children.push(c); }, addEventListener: noop, querySelectorAll: () => [], dataset: {} };
  },
  querySelectorAll: () => [],
  addEventListener: noop,
};
global.window = global;
global.localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = noop;
global.OffscreenCanvas = undefined;
global.Image = class Image {
  constructor() { this.width = 0; this.height = 0; this.src = ''; this.onload = null; this.onerror = null; }
  set src(v) { this._src = v; if (this.onerror) setTimeout(() => this.onerror(new Error('headless')), 0); }
  get src() { return this._src || ''; }
};

function load(file) {
  eval(fs.readFileSync(path.join(root, file), 'utf8'));
}

// Load framework
eval(fs.readFileSync(path.join(__dirname, 'runner.js'), 'utf8'));

// Load modules -- order matches index.html dependency chain
load('prng.js');
load('time-rotation.js');
load('state-machine.js');
load('save-crypto.js');
load('save-manager.js');
load('input-handler.js');
load('sprite-compositor.js');
load('renderer.js');

// Shared enums (load before all data files)
load('data/enums.js');

// Data files: races & monsters (push to _pending.creatures)
function tryLoad(file) { try { load(file); } catch (_) { /* data file may not exist yet */ } }
tryLoad('data/races-core.js');
tryLoad('data/races-expanded.js');
tryLoad('data/races-psionic.js');
tryLoad('data/races-campaign.js');
tryLoad('data/monsters-aberrations.js');
tryLoad('data/monsters-animals.js');
tryLoad('data/monsters-constructs.js');
tryLoad('data/monsters-dragons.js');
tryLoad('data/monsters-elementals.js');
tryLoad('data/monsters-fey.js');
tryLoad('data/monsters-fiends.js');
tryLoad('data/monsters-giants.js');
tryLoad('data/monsters-humanoids.js');
tryLoad('data/monsters-magical-beasts.js');
tryLoad('data/monsters-oozes-plants.js');
tryLoad('data/monsters-undead.js');
tryLoad('data/monsters-misc.js');
load('creature-registry.js');

// Data files: classes (push to _pending.classes)
tryLoad('data/classes-core.js');
tryLoad('data/classes-complete.js');
tryLoad('data/classes-psionic.js');
tryLoad('data/classes-incarnum.js');
tryLoad('data/classes-tome.js');
tryLoad('data/classes-campaign.js');
tryLoad('data/prestige-core.js');
tryLoad('data/prestige-complete.js');
tryLoad('data/prestige-campaign.js');
tryLoad('data/prestige-supplements.js');
load('class-registry.js');

// Data files: skills, feats, conditions
tryLoad('data/skills.js');
tryLoad('data/conditions.js');
tryLoad('data/feats-general.js');
tryLoad('data/feats-combat.js');
tryLoad('data/feats-magic.js');
tryLoad('data/feats-class.js');
tryLoad('data/feats-racial.js');
load('skill-registry.js');
load('feat-registry.js');

// Engine modules
load('bonus-stacking.js');
load('condition-engine.js');
load('action-economy.js');

// Character & roster
load('character.js');
load('roster.js');

// Data files: terrain, biomes, planes
tryLoad('data/terrain-types.js');
tryLoad('data/biomes.js');
tryLoad('data/planes.js');
load('terrain-registry.js');
load('plane-registry.js');
load('portal.js');
tryLoad('data/spell-terrain-effects.js');
load('passability.js');
load('terrain.js');

// Combat & pathfinding
load('combat-grid.js');
load('pathfinding.js');
load('d20-engine.js');
load('combat-unit.js');
load('enemy-ai.js');

// Data files: spells
tryLoad('data/spells-0.js');
tryLoad('data/spells-1.js');
tryLoad('data/spells-2.js');
tryLoad('data/spells-3.js');
tryLoad('data/spells-4.js');
tryLoad('data/spells-5.js');
tryLoad('data/spells-6.js');
tryLoad('data/spells-7.js');
tryLoad('data/spells-8.js');
tryLoad('data/spells-9.js');
tryLoad('data/spells-psionic.js');
tryLoad('data/spells-campaign.js');
load('spell-registry.js');
load('spells.js');

// Data files: items
tryLoad('data/weapons-simple.js');
tryLoad('data/weapons-martial.js');
tryLoad('data/weapons-exotic.js');
tryLoad('data/armor.js');
tryLoad('data/items-mundane.js');
tryLoad('data/items-potions.js');
tryLoad('data/items-scrolls.js');
tryLoad('data/items-wondrous.js');
tryLoad('data/items-rings.js');
tryLoad('data/items-rods-staves.js');
tryLoad('data/items-artifacts.js');
tryLoad('data/items-materials.js');
tryLoad('data/item-enchantments.js');
load('item-registry.js');
load('items.js');
load('shop.js');

// Data files: creature types, enemy templates, boss templates
tryLoad('data/creature-types.js');
tryLoad('data/enemy-templates.js');
tryLoad('data/boss-templates.js');

// Game systems
load('combat-history.js');
load('combat-ui.js');
load('combat-engine.js');
load('asset-loader.js');
tryLoad('data/creature-sprites.js');
load('sprite-resolver.js');
load('autotile.js');
load('overworld-map.js');
load('dungeon-gen.js');
load('debug-console.js');

// Load test suites
function loadTest(file) {
  eval(fs.readFileSync(path.join(__dirname, file), 'utf8'));
}

loadTest('test-prng.js');
loadTest('test-time-rotation.js');
loadTest('test-state-machine.js');
loadTest('test-save-crypto.js');
loadTest('test-save-manager.js');
loadTest('test-input-handler.js');
loadTest('test-renderer.js');
loadTest('test-character.js');
loadTest('test-roster.js');
loadTest('test-terrain.js');
loadTest('test-combat-grid.js');
loadTest('test-pathfinding.js');
loadTest('test-d20-engine.js');
loadTest('test-combat-unit.js');
loadTest('test-enemy-ai.js');
loadTest('test-combat-engine.js');
loadTest('test-spells.js');
loadTest('test-items.js');
loadTest('test-shop.js');
loadTest('test-asset-loader.js');
loadTest('test-sprite-resolver.js');
loadTest('test-autotile.js');
loadTest('test-overworld-map.js');
loadTest('test-dungeon-gen.js');
loadTest('test-debug-console.js');
loadTest('test-sprite-compositor.js');

// New module tests
loadTest('test-creature-registry.js');
loadTest('test-class-registry.js');
loadTest('test-spell-registry.js');
loadTest('test-skill-registry.js');
loadTest('test-feat-registry.js');
loadTest('test-bonus-stacking.js');
loadTest('test-condition-engine.js');
loadTest('test-action-economy.js');
loadTest('test-passability.js');

loadTest('test-integration.js');

// Headless execution
(async () => {
  let passed = 0, failed = 0, skipped = 0, total = 0;
  const outputChildren = [];

  global.document.getElementById = (id) => {
    if (id === 'test-output')
      return { innerHTML: '', appendChild(c) { outputChildren.push(c); } };
    if (id === 'test-summary')
      return { textContent: '', className: '' };
    return null;
  };

  await window.TestRunner.runAll();

  for (const suiteEl of outputChildren) {
    let suiteName = '';
    for (const child of suiteEl.children) {
      if (child.className && child.className.includes('test')) {
        ++total;
        if (child.className.includes('pass'))
          ++passed;
        else if (child.className.includes('skip')) {
          ++skipped;
          console.log('SKIP: ' + child.textContent);
        } else if (child.className.includes('fail')) {
          ++failed;
          let errMsg = '';
          for (const sub of child.children) {
            if (sub.className === 'error-detail')
              errMsg = sub.textContent.split('\n')[0];
          }
          console.log('FAIL: ' + child.textContent + (errMsg ? '\n  ' + errMsg : ''));
        }
      } else {
        suiteName = child.textContent || '';
      }
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(`${passed} passed, ${failed} failed, ${skipped} skipped (${total} total)`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
})();
