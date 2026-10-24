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
    ellipse: noop, strokeText: noop, scale: noop, rotate: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
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
load('js/core/prng.js');
load('js/core/time-rotation.js');
load('js/core/state-machine.js');
load('js/core/save-crypto.js');
load('js/core/save-manager.js');
load('js/core/input-handler.js');
load('js/render/sprite-compositor.js');
load('../../shared/game-effects.js');
load('js/render/renderer.js');
load('js/render/renderer-sprites.js');
load('js/render/renderer-map.js');
load('js/render/renderer-combat.js');
load('js/render/renderer-ui.js');
load('js/render/renderer-screens.js');
load('js/combat/combat-fx.js');
load('js/render/battle-sprites.js');
load('js/render/battle-backdrop.js');
load('js/render/battle-fx.js');
load('js/render/battle-scene.js');
load('js/render/screen-art.js');

// Shared enums (load before all data files)
load('js/data/enums.js');

// Data files: races & monsters (push to _pending.creatures)
function tryLoad(file) { try { load(file); } catch (_) { /* data file may not exist yet */ } }
tryLoad('js/data/races-core.js');
tryLoad('js/data/races-expanded.js');
tryLoad('js/data/races-psionic.js');
tryLoad('js/data/races-campaign.js');
tryLoad('js/data/monsters-aberrations.js');
tryLoad('js/data/monsters-animals.js');
tryLoad('js/data/monsters-constructs.js');
tryLoad('js/data/monsters-dragons.js');
tryLoad('js/data/monsters-elementals.js');
tryLoad('js/data/monsters-fey.js');
tryLoad('js/data/monsters-fiends.js');
tryLoad('js/data/monsters-giants.js');
tryLoad('js/data/monsters-humanoids.js');
tryLoad('js/data/monsters-magical-beasts.js');
tryLoad('js/data/monsters-oozes-plants.js');
tryLoad('js/data/monsters-undead.js');
tryLoad('js/data/monsters-misc.js');
tryLoad('js/data/monsters-outsiders.js');
load('js/systems/creature-registry.js');

// Data files: classes (push to _pending.classes)
tryLoad('js/data/classes-core.js');
tryLoad('js/data/classes-complete.js');
tryLoad('js/data/classes-psionic.js');
tryLoad('js/data/classes-incarnum.js');
tryLoad('js/data/classes-tome.js');
tryLoad('js/data/classes-campaign.js');
tryLoad('js/data/prestige-core.js');
tryLoad('js/data/prestige-complete.js');
tryLoad('js/data/prestige-campaign.js');
tryLoad('js/data/prestige-supplements.js');
load('js/systems/class-registry.js');

// Data files: skills, feats, conditions
tryLoad('js/data/skills.js');
tryLoad('js/data/conditions.js');
tryLoad('js/data/feats-general.js');
tryLoad('js/data/feats-combat.js');
tryLoad('js/data/feats-magic.js');
tryLoad('js/data/feats-class.js');
tryLoad('js/data/feats-racial.js');
load('js/systems/skill-registry.js');
load('js/systems/feat-registry.js');

// Engine modules
load('js/core/bonus-stacking.js');
load('js/core/condition-engine.js');
load('js/core/action-economy.js');

// Character & roster
load('js/systems/character.js');
load('js/systems/roster.js');

// Data files: terrain, biomes, planes
tryLoad('js/data/terrain-types.js');
tryLoad('js/data/biomes.js');
tryLoad('js/data/planes.js');
load('js/systems/terrain-registry.js');
load('js/systems/plane-registry.js');
load('js/systems/portal.js');
load('js/systems/plane-worlds.js');
tryLoad('js/data/spell-terrain-effects.js');
load('js/core/passability.js');
load('js/systems/terrain.js');

// Combat & pathfinding
load('js/combat/combat-grid.js');
load('js/core/pathfinding.js');
load('js/core/d20-engine.js');
load('js/combat/combat-unit.js');
load('js/systems/enemy-ai.js');

// Data files: spells
tryLoad('js/data/spells-0.js');
tryLoad('js/data/spells-1.js');
tryLoad('js/data/spells-2.js');
tryLoad('js/data/spells-3.js');
tryLoad('js/data/spells-4.js');
tryLoad('js/data/spells-5.js');
tryLoad('js/data/spells-6.js');
tryLoad('js/data/spells-7.js');
tryLoad('js/data/spells-8.js');
tryLoad('js/data/spells-9.js');
tryLoad('js/data/spells-psionic.js');
tryLoad('js/data/spells-campaign.js');
load('js/systems/spell-registry.js');
load('js/systems/spells.js');

// Data files: items
tryLoad('js/data/weapons-simple.js');
tryLoad('js/data/weapons-martial.js');
tryLoad('js/data/weapons-exotic.js');
tryLoad('js/data/armor.js');
tryLoad('js/data/items-mundane.js');
tryLoad('js/data/items-potions.js');
tryLoad('js/data/items-scrolls.js');
tryLoad('js/data/items-wondrous.js');
tryLoad('js/data/items-rings.js');
tryLoad('js/data/items-rods-staves.js');
tryLoad('js/data/items-artifacts.js');
tryLoad('js/data/items-materials.js');
tryLoad('js/data/item-enchantments.js');
load('js/systems/item-registry.js');
load('js/systems/items.js');
load('js/systems/shop.js');

// Data files: creature types, enemy templates, boss templates
tryLoad('js/data/creature-types.js');
tryLoad('js/data/enemy-templates.js');
tryLoad('js/data/boss-templates.js');

// Game systems
load('js/systems/combat-history.js');
load('js/ui/combat-ui.js');
load('js/systems/monster-attacks.js');
load('js/systems/monster-abilities.js');
load('js/combat/combat-templates.js');
load('js/combat/combat-engine.js');
load('js/combat/combat-engine-actions.js');
load('js/combat/combat-engine-ai.js');
load('js/combat/combat-engine-effects.js');
load('js/render/pixel-art.js');
load('js/render/terrain-art.js');
load('js/render/asset-loader.js');
tryLoad('js/data/creature-sprites.js');
load('js/render/sprite-resolver.js');
load('js/render/autotile.js');
load('js/dungeon/overworld-map.js');
load('js/dungeon/dungeon-gen.js');
load('js/dungeon/dungeon-themes.js');
load('js/systems/monster-roster.js');
load('js/dungeon/dungeon-crawl.js');
load('js/dungeon/dungeon-art.js');
load('js/dungeon/dungeon-view.js');
load('js/ui/debug-console.js');

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
loadTest('test-combat-fx.js');
loadTest('test-battle-scene.js');
loadTest('test-screen-art.js');
loadTest('test-character.js');
loadTest('test-roster.js');
loadTest('test-terrain.js');
loadTest('test-combat-grid.js');
loadTest('test-pathfinding.js');
loadTest('test-d20-engine.js');
loadTest('test-combat-unit.js');
loadTest('test-enemy-ai.js');
loadTest('test-combat-engine.js');
loadTest('test-monster-spawn.js');
loadTest('test-monster-attacks.js');
loadTest('test-monster-abilities.js');
loadTest('test-monster-sprites.js');
loadTest('test-monster-roster.js');
loadTest('test-spells.js');
loadTest('test-items.js');
loadTest('test-shop.js');
loadTest('test-asset-loader.js');
loadTest('test-sprite-resolver.js');
loadTest('test-sprite-mapping.js');
loadTest('test-autotile.js');
loadTest('test-overworld-map.js');
loadTest('test-plane-worlds.js');
loadTest('test-portal.js');
loadTest('test-plane-traits.js');
loadTest('test-dungeon-gen.js');
loadTest('test-dungeon-crawl.js');
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
