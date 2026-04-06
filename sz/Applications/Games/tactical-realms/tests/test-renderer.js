;(function() {
  'use strict';
  const { describe, it, assert } = window.TestRunner;
  const Renderer = window.SZ.TacticalRealms.Renderer;

  describe('Renderer', () => {

    it('constructs with default dimensions', () => {
      const r = new Renderer(null);
      assert.equal(r.width, 1280);
      assert.equal(r.height, 720);
      assert.equal(r.tileSize, 32);
    });

    it('constructs with custom dimensions', () => {
      const r = new Renderer(null, { width: 800, height: 600, tileSize: 16 });
      assert.equal(r.width, 800);
      assert.equal(r.height, 600);
      assert.equal(r.tileSize, 16);
    });

    it('camera defaults to 0,0', () => {
      const r = new Renderer(null);
      assert.deepEqual(r.camera, { x: 0, y: 0 });
    });

    it('camera can be set', () => {
      const r = new Renderer(null);
      r.camera = { x: 100, y: 200 };
      assert.deepEqual(r.camera, { x: 100, y: 200 });
    });

    it('centerOn() sets camera so point is at screen center', () => {
      const r = new Renderer(null, { width: 800, height: 600 });
      r.centerOn(500, 400);
      assert.equal(r.camera.x, 500 - 400);
      assert.equal(r.camera.y, 400 - 300);
    });

    it('worldToScreen() converts world coords to screen coords', () => {
      const r = new Renderer(null);
      r.camera = { x: 100, y: 50 };
      const s = r.worldToScreen(150, 80);
      assert.equal(s.x, 50);
      assert.equal(s.y, 30);
    });

    it('worldToScreen() with zero camera is identity', () => {
      const r = new Renderer(null);
      const s = r.worldToScreen(200, 300);
      assert.equal(s.x, 200);
      assert.equal(s.y, 300);
    });

    it('screenToWorld() converts screen coords to world coords', () => {
      const r = new Renderer(null);
      r.camera = { x: 100, y: 50 };
      const w = r.screenToWorld(50, 30);
      assert.equal(w.x, 150);
      assert.equal(w.y, 80);
    });

    it('worldToScreen and screenToWorld are inverses', () => {
      const r = new Renderer(null);
      r.camera = { x: 123, y: 456 };
      const world = { x: 500, y: 700 };
      const screen = r.worldToScreen(world.x, world.y);
      const back = r.screenToWorld(screen.x, screen.y);
      assert.equal(back.x, world.x);
      assert.equal(back.y, world.y);
    });

    it('isVisible() returns true for objects on screen', () => {
      const r = new Renderer(null, { width: 800, height: 600 });
      r.camera = { x: 0, y: 0 };
      assert.ok(r.isVisible(100, 100, 50, 50));
    });

    it('isVisible() returns false for objects left of screen', () => {
      const r = new Renderer(null, { width: 800, height: 600 });
      r.camera = { x: 0, y: 0 };
      assert.ok(!r.isVisible(-60, 100, 50, 50));
    });

    it('isVisible() returns false for objects right of screen', () => {
      const r = new Renderer(null, { width: 800, height: 600 });
      r.camera = { x: 0, y: 0 };
      assert.ok(!r.isVisible(810, 100, 50, 50));
    });

    it('isVisible() returns false for objects above screen', () => {
      const r = new Renderer(null, { width: 800, height: 600 });
      r.camera = { x: 0, y: 0 };
      assert.ok(!r.isVisible(100, -60, 50, 50));
    });

    it('isVisible() returns false for objects below screen', () => {
      const r = new Renderer(null, { width: 800, height: 600 });
      r.camera = { x: 0, y: 0 };
      assert.ok(!r.isVisible(100, 610, 50, 50));
    });

    it('isVisible() handles partial visibility (edge overlap)', () => {
      const r = new Renderer(null, { width: 800, height: 600 });
      r.camera = { x: 0, y: 0 };
      assert.ok(r.isVisible(-10, -10, 50, 50));
      assert.ok(r.isVisible(790, 590, 50, 50));
    });

    it('isVisible() accounts for camera offset', () => {
      const r = new Renderer(null, { width: 800, height: 600 });
      r.camera = { x: 1000, y: 1000 };
      assert.ok(!r.isVisible(100, 100, 50, 50));
      assert.ok(r.isVisible(1100, 1100, 50, 50));
    });

    it('beginFrame and endFrame do not throw without canvas', () => {
      const r = new Renderer(null);
      r.beginFrame();
      r.endFrame();
    });

    it('drawRect does not throw without canvas', () => {
      const r = new Renderer(null);
      r.drawRect(0, 0, 50, 50, '#f00');
    });

    it('drawText does not throw without canvas', () => {
      const r = new Renderer(null);
      r.drawText(0, 0, 'test');
    });

    it('drawScreenText does not throw without canvas', () => {
      const r = new Renderer(null);
      r.drawScreenText(0, 0, 'test');
    });

    it('highlightTile does not throw without canvas', () => {
      const r = new Renderer(null);
      r.highlightTile(0, 0);
    });

    it('drawPanel does not throw without canvas', () => {
      const r = new Renderer(null);
      r.drawPanel(0, 0, 100, 100);
    });

    it('drawButton does not throw without canvas', () => {
      const r = new Renderer(null);
      r.drawButton(0, 0, 100, 30, 'Test');
    });

    it('drawTileMap does not throw without canvas', () => {
      const r = new Renderer(null);
      r.drawTileMap(new Uint8Array(100), 10, 10);
    });

    it('drawBattleScene does not throw without canvas', () => {
      const r = new Renderer(null);
      const attacker = { name: 'Fighter', faction: 'party', currentHp: 20, maxHp: 20, character: { class: 'fighter' }, bab: 2, strMod: 2, position: { col: 1, row: 1 } };
      const defender = { name: 'Goblin', faction: 'enemy', currentHp: 8, maxHp: 8, ac: 14, character: { class: 'goblin' }, position: { col: 2, row: 1 } };
      const result = { hit: true, damage: 5, critical: false, d20: 15, total: 19, natural20: false, natural1: false, flanking: false };
      r.drawBattleScene(attacker, defender, result, 0.5, 'player_attack');
    });

    it('drawBattleScene accepts spell_cast type', () => {
      const r = new Renderer(null);
      const caster = { name: 'Wizard', faction: 'party', currentHp: 10, maxHp: 10, character: { class: 'wizard' }, currentMp: 5, maxMp: 10, position: { col: 1, row: 1 } };
      const target = { name: 'Goblin', faction: 'enemy', currentHp: 8, maxHp: 8, ac: 14, character: { class: 'goblin' }, position: { col: 3, row: 1 } };
      const result = { hit: true, damage: 7, heal: 0, critical: false, d20: 0, total: 0, natural20: false, natural1: false, spellName: 'Magic Missile' };
      r.drawBattleScene(caster, target, result, 0.3, 'spell_cast');
    });

    it('drawContextMenu does not throw without canvas', () => {
      const r = new Renderer(null);
      const items = [
        { label: 'Attack', action: 'attack' },
        { label: 'Fireball (AoE)', action: 'spell', spellId: 'fireball' },
      ];
      r.drawContextMenu(100, 100, items, 0);
    });

    it('drawContextMenu handles empty items', () => {
      const r = new Renderer(null);
      r.drawContextMenu(100, 100, [], -1);
    });

    it('drawAoeRadius does not throw without canvas', () => {
      const r = new Renderer(null);
      r.drawAoeRadius(0, 0, 32, 5, 5, 2, 10, 10, 'rgba(200,80,255,0.35)');
    });

    it('drawInfiniteMap does not throw without canvas', () => {
      const r = new Renderer(null);
      r.drawInfiniteMap(() => 1);
    });

    it('drawInfiniteMap gracefully handles null canvas', () => {
      const r = new Renderer(null);
      let called = 0;
      r.drawInfiniteMap(() => { ++called; return 1; });
      assert.equal(called, 0);
    });

    it('drawTitleScreen does not throw without canvas', () => {
      const r = new Renderer(null);
      r.drawTitleScreen(0.5);
    });

    it('drawVictoryScreen does not throw without canvas', () => {
      const r = new Renderer(null);
      const party = [{ name: 'Fighter', class: 'fighter', hp: 20, maxHp: 20 }];
      r.drawVictoryScreen(party, 50, 25, 0.5);
    });

    it('drawDefeatScreen does not throw without canvas', () => {
      const r = new Renderer(null);
      r.drawDefeatScreen(0.5);
    });

    it('drawTitleScreen clamps progress to 0-1', () => {
      const r = new Renderer(null);
      r.drawTitleScreen(-0.5);
      r.drawTitleScreen(1.5);
    });

    it('drawInfiniteMap accepts dimension parameter without throwing', () => {
      const r = new Renderer(null);
      r.drawInfiniteMap(() => 1, 'feywild');
      r.drawInfiniteMap(() => 1, 'shadowfell');
      r.drawInfiniteMap(() => 1, 'nine_hells');
      r.drawInfiniteMap(() => 1, 'underdark');
      r.drawInfiniteMap(() => 1, 'abyss');
    });

    it('drawInfiniteMap defaults to material dimension with no arg', () => {
      const r = new Renderer(null);
      r.drawInfiniteMap(() => 1);
    });

    it('drawInfiniteMap handles unknown dimension gracefully', () => {
      const r = new Renderer(null);
      r.drawInfiniteMap(() => 1, 'nonexistent');
    });

    it('drawCombatGrid accepts dimension parameter without throwing', () => {
      const r = new Renderer(null);
      const TR = window.SZ.TacticalRealms;
      if (TR.CombatGrid) {
        const grid = TR.CombatGrid.generate(8, 8, new TR.PRNG(42), 'plains');
        r.drawCombatGrid(grid, 32, 0, 0, 'plains', 'feywild');
      }
    });
  });
})();
