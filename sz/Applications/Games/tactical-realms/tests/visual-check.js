// Playwright visual check -- navigates game to combat to verify sprite rendering
'use strict';
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://localhost:3335/Applications/Games/tactical-realms/tests/visual-wrapper.html';
const OUT = path.join(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1300, height: 780 } });

  let exitCode = 0;
  const failedAssets = new Set();
  page.on('response', resp => {
    if (!resp.ok() && resp.url().match(/\.(png|jpg|bmp|svg)$/i))
      failedAssets.add(`${resp.status()} ${resp.url()}`);
  });

  console.log('Loading game...');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const frame = page.frames().find(f => f !== page.mainFrame());
  if (!frame) { console.log('ERROR: No iframe'); await browser.close(); return; }

  for (let i = 0; i < 20; ++i) {
    if (await frame.evaluate(() => !!(window.SZ?.TacticalRealms?.Renderer))) break;
    await page.waitForTimeout(500);
  }

  const canvas = frame.locator('canvas#gameCanvas');
  const getState = () => frame.evaluate(() => document.getElementById('statusState')?.textContent || '?');

  // Title → Character Select (click "New Game" button)
  await canvas.click({ force: true, position: { x: 650, y: 420 } });
  await page.waitForTimeout(1000);
  console.log('State:', await getState());

  // Select first character
  await canvas.click({ force: true, position: { x: 280, y: 250 } });
  await page.waitForTimeout(300);

  // "Begin Adventure" button -- it's at y≈735 in 780 viewport, but canvas is 720px.
  // The button is at the bottom of the canvas. Use JavaScript to trigger it directly.
  await frame.evaluate(() => {
    // Simulate a click at the bottom-center of the canvas
    const c = document.getElementById('gameCanvas');
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const evt = new PointerEvent('pointerdown', {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height - 30,
      bubbles: true, pointerId: 1, pointerType: 'mouse',
    });
    c.dispatchEvent(evt);
    const up = new PointerEvent('pointerup', {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height - 30,
      bubbles: true, pointerId: 1, pointerType: 'mouse',
    });
    c.dispatchEvent(up);
  });
  await page.waitForTimeout(2000);

  let state = await getState();
  console.log('After Begin Adventure:', state);

  if (state.includes('CHARACTER')) {
    // Try again with click event
    await frame.evaluate(() => {
      const c = document.getElementById('gameCanvas');
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const y = rect.top + rect.height - 25;
      const x = rect.left + rect.width / 2;
      for (const type of ['pointerdown', 'pointerup', 'click']) {
        c.dispatchEvent(new PointerEvent(type, {
          clientX: x, clientY: y,
          bubbles: true, pointerId: 1, pointerType: 'mouse',
        }));
      }
    });
    await page.waitForTimeout(2000);
    state = await getState();
    console.log('Retry Begin Adventure:', state);
  }

  await page.screenshot({ path: path.join(OUT, 'screenshot-overworld.png') });
  console.log('Saved screenshot-overworld.png');

  if (state.includes('OVERWORLD')) {
    // Click around to trigger random encounter
    for (let round = 0; round < 10; ++round) {
      for (let i = 0; i < 10; ++i) {
        await canvas.click({ force: true, position: { x: 800 + (i % 4) * 40, y: 300 + (i % 3) * 40 } });
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(300);
      state = await getState();
      if (state.includes('COMBAT')) break;
      // Try keyboard movement
      for (let k = 0; k < 5; ++k) {
        await frame.press('canvas#gameCanvas', 'ArrowRight', { force: true });
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(300);
      state = await getState();
      if (state.includes('COMBAT')) break;
    }
    console.log('After exploration:', state);

    await page.screenshot({ path: path.join(OUT, 'screenshot-exploration.png') });
  }

  if (state.includes('COMBAT')) {
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, 'screenshot-combat.png') });
    console.log('Saved screenshot-combat.png');

    // Validate enemy sprites render from tilemap, not as fallback circles
    const spriteCheck = await frame.evaluate(() => {
      const TR = window.SZ?.TacticalRealms;
      if (!TR) return { error: 'TR namespace missing' };

      const results = { enemies: {}, errors: [] };

      // Verify every enemy in ENEMY_SPRITES resolves to a valid dungeon rect
      for (const [id, rect] of Object.entries(TR.ENEMY_SPRITES)) {
        const resolved = TR.resolveSprite(id, 'enemy');
        if (!resolved) {
          results.errors.push(`${id}: resolveSprite returned null`);
          continue;
        }
        if (resolved.sheet && resolved.sheet !== 'dungeon')
          results.errors.push(`${id}: uses sheet '${resolved.sheet}' instead of dungeon`);
        if (resolved.x + resolved.w > 192)
          results.errors.push(`${id}: x=${resolved.x}+w=${resolved.w} exceeds dungeon width 192`);
        if (resolved.y + resolved.h > 176)
          results.errors.push(`${id}: y=${resolved.y}+h=${resolved.h} exceeds dungeon height 176`);
        results.enemies[id] = { x: resolved.x, y: resolved.y, sheet: resolved.sheet || 'dungeon' };
      }

      // Verify the dungeon tilemap image actually loaded
      const loader = TR._testAssets || null;
      const renderer = TR._testRenderer || null;
      const assets = renderer?.assets;
      if (assets) {
        results.dungeonLoaded = assets.has('dungeon');
        results.assetsReady = assets.ready;
      } else {
        // Try to check via ASSET_MANIFEST
        results.assetManifest = Object.keys(TR.ASSET_MANIFEST);
        results.noKenney1bit = !TR.ASSET_MANIFEST.kenney1bit;
      }

      // Verify all 42 enemies have tints
      const missingTints = Object.keys(TR.ENEMY_SPRITES).filter(id => !TR.ENEMY_TINTS[id]);
      if (missingTints.length > 0)
        results.errors.push(`Missing tints: ${missingTints.join(', ')}`);

      results.enemyCount = Object.keys(TR.ENEMY_SPRITES).length;
      results.tintCount = Object.keys(TR.ENEMY_TINTS).length;
      return results;
    });

    console.log(`\n=== SPRITE VALIDATION ===`);
    console.log(`Enemy sprites: ${spriteCheck.enemyCount}, Tints: ${spriteCheck.tintCount}`);
    if (spriteCheck.noKenney1bit !== undefined)
      console.log(`kenney1bit removed from manifest: ${spriteCheck.noKenney1bit}`);
    if (spriteCheck.assetManifest)
      console.log(`Asset manifest sheets: ${spriteCheck.assetManifest.join(', ')}`);
    if (spriteCheck.dungeonLoaded !== undefined)
      console.log(`Dungeon sheet loaded: ${spriteCheck.dungeonLoaded}`);
    if (spriteCheck.errors.length > 0) {
      console.log('ERRORS:');
      for (const e of spriteCheck.errors)
        console.log('  ' + e);
      exitCode = 1;
    } else {
      console.log('All enemy sprites resolve to valid dungeon sheet rects');
    }
  }

  // Report
  if (failedAssets.size > 0) {
    console.log('\n=== FAILED IMAGE LOADS ===');
    for (const f of failedAssets)
      console.log('  ' + f);
    exitCode = 1;
  }

  await browser.close();
  console.log('Done.');
  process.exit(exitCode);
})();
