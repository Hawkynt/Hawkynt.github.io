/* Space Farming - wild space mice: spawning, sneaking to crops, scarecrows, fences and pest zappers.
   Owns: G.wildAnimals, G.nextAnimalSpawn
   Reads: G.state, G.credits, G.gridRows, G.farmGrid, G.buildings, G.gridCols */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { STATE_PLAYING, BUILDINGS, ANIMAL_SPAWN_MIN, ANIMAL_SPAWN_MAX, particles, UI, getBuildingRange,
    getScarecrowRadius, tileCenter, squeak, techChainCount, popText, toast } = NS;

  /* ── Wild Animals (Feature 8) ── */
  function updateAnimals(dt) {
    if (G.state !== STATE_PLAYING) return;

    // Spawn timer
    G.nextAnimalSpawn -= dt;
    if (G.nextAnimalSpawn <= 0) {
      G.nextAnimalSpawn = (ANIMAL_SPAWN_MIN + Math.random() * (ANIMAL_SPAWN_MAX - ANIMAL_SPAWN_MIN)) * Math.pow(1.4, techChainCount('sci_repel'));
      spawnAnimal();
    }

    // Update each animal
    for (let i = G.wildAnimals.length - 1; i >= 0; --i) {
      const animal = G.wildAnimals[i];
      animal.moveTimer -= dt;
      if (animal.moveTimer > 0) continue;
      animal.moveTimer = 0.5; // move every 0.5s

      // Pest zappers fry mice that come into range
      const zapper = findZapperNear(animal);
      if (zapper) {
        const from = tileCenter(zapper.c, zapper.r);
        const to = tileCenter(animal.rx !== undefined ? animal.rx : animal.x, animal.ry !== undefined ? animal.ry : animal.y);
        zapArcs.push({ x0: from.x, y0: from.y - 30, x1: to.x, y1: to.y, t: 0 });
        particles.burst(to.x, to.y, 10, { color: '#9ff0ff', speed: 3, life: 0.35 });
        popText(to.x, to.y - 12, 'Zapped! +5', { color: '#9ff0ff', font: 'bold 12px' });
        G.credits += 5;
        SZ.GameAudio.play('zap', { volume: 0.7 });
        G.wildAnimals.splice(i, 1);
        continue;
      }

      // Check if in scarecrow range -- flee (radius scales with level)
      let scared = false;
      for (let r = 0; r < G.gridRows && !scared; ++r)
        for (let c = 0; c < G.gridCols && !scared; ++c) {
          const sBld = G.buildings[r]?.[c];
          if (!sBld) continue;
          if (BUILDINGS[sBld.typeIndex].name !== 'Scarecrow') continue;
          const scareRadius = getScarecrowRadius(sBld);
          if (Math.abs(Math.round(animal.y) - r) <= scareRadius && Math.abs(Math.round(animal.x) - c) <= scareRadius)
            scared = true;
        }

      if (scared) {
        // Flee: move away from grid center
        const gridCenterR = G.gridRows / 2;
        const gridCenterC = G.gridCols / 2;
        const dr = animal.y - gridCenterR;
        const dc = animal.x - gridCenterC;
        const len = Math.sqrt(dr * dr + dc * dc) || 1;
        animal.y += (dr / len) * 0.8;
        animal.x += (dc / len) * 0.8;
        // Remove if off-grid
        if (animal.x < -2 || animal.x > G.gridCols + 2 || animal.y < -2 || animal.y > G.gridRows + 2) {
          G.wildAnimals.splice(i, 1);
        }
        continue;
      }

      // Find nearest crop
      let bestDist = Infinity;
      let bestR = -1, bestC = -1;
      for (let r = 0; r < G.gridRows; ++r)
        for (let c = 0; c < G.gridCols; ++c) {
          if (!G.farmGrid[r][c]) continue;
          const d = Math.abs(r - animal.y) + Math.abs(c - animal.x);
          if (d < bestDist) {
            bestDist = d;
            bestR = r;
            bestC = c;
          }
        }

      if (bestR < 0) continue; // no crops to target

      // Move toward target
      const moveR = bestR - animal.y;
      const moveC = bestC - animal.x;
      const moveDist = Math.sqrt(moveR * moveR + moveC * moveC);
      if (moveDist < 0.3) {
        // Reached a crop tile -- eat it
        const eatenCell = G.farmGrid[bestR][bestC];
        if (eatenCell) {
          G.farmGrid[bestR][bestC] = null;
          const { x: tx, y: ty } = tileCenter(bestC, bestR);
          popText(tx, ty - 10, 'Eaten!', { color: '#f44', font: 'bold 11px sans-serif' });
          particles.burst(tx, ty, 6, { color: '#f88', speed: 2, life: 0.3 });
          SZ.GameAudio.play('hurt', { volume: 0.6 });
        }
        // Animal leaves after eating
        G.wildAnimals.splice(i, 1);
        continue;
      }

      // Check for fence blocking (L3+ slows, L5+ blocks and damages)
      const nextR = Math.round(animal.y + (moveR / moveDist) * 0.5);
      const nextC = Math.round(animal.x + (moveC / moveDist) * 0.5);
      if (nextR >= 0 && nextR < G.gridRows && nextC >= 0 && nextC < G.gridCols) {
        const fBld = G.buildings[nextR]?.[nextC];
        if (fBld && BUILDINGS[fBld.typeIndex].name === 'Fence') {
          const fLvl = fBld.level || 1;
          if (fLvl >= 5) {
            // L5+: block AND damage -- kill animal
            const { x: fx, y: fy } = tileCenter(nextC, nextR);
            popText(fx, fy - 10, 'Zapped!', { color: '#f44', font: 'bold 10px sans-serif' });
            particles.burst(fx, fy, 6, { color: '#ff0', speed: 2.5, life: 0.3 });
            SZ.GameAudio.play('zap', { volume: 0.6 });
            G.wildAnimals.splice(i, 1);
            continue;
          }
          if (fLvl >= 3) {
            // L3-L4: slow animals (reduced movement speed)
            animal.y += (moveR / moveDist) * 0.15;
            animal.x += (moveC / moveDist) * 0.15;
            continue;
          }
          // L1-L2: block completely
          continue;
        }
      }

      animal.y += (moveR / moveDist) * 0.5;
      animal.x += (moveC / moveDist) * 0.5;
    }
  }

  let miceWarned = false;
  const zapArcs = [];

  function findZapperNear(animal) {
    const ar = Math.round(animal.y), ac = Math.round(animal.x);
    for (let r = 0; r < G.gridRows; ++r)
      for (let c = 0; c < G.gridCols; ++c) {
        const b = G.buildings[r]?.[c];
        if (!b || BUILDINGS[b.typeIndex].name !== 'Pest Zapper') continue;
        const range = getBuildingRange(b);
        if (Math.abs(ar - r) <= range && Math.abs(ac - c) <= range)
          return { r, c };
      }
    return null;
  }

  function spawnAnimal() {
    // Spawn at a random edge
    let x, y;
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: x = -1; y = Math.random() * G.gridRows; break; // left
      case 1: x = G.gridCols; y = Math.random() * G.gridRows; break; // right
      case 2: x = Math.random() * G.gridCols; y = -1; break; // top
      default: x = Math.random() * G.gridCols; y = G.gridRows; break; // bottom
    }
    G.wildAnimals.push({ x, y, targetCol: -1, targetRow: -1, moveTimer: 0, hp: 1 });
    squeak();
    if (!miceWarned) {
      miceWarned = true;
      toast('A space mouse sneaks onto the farm: click it!', UI.warn, 'mouse');
    }
  }

  Object.assign(NS, { updateAnimals, zapArcs });

})();
