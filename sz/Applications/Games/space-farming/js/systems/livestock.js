/* Space Farming - livestock pens: production timers, collecting produce, buying animals and
   placing pens on the field perimeter.
   Owns: G.livestockPens
   Reads: G.state, G.credits, G.gridRows, G.inventory, G.gridCols, G.penVersion, G.stats */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { STATE_PLAYING, LIVESTOCK, particles, UI, penCenter, flyProduce, animalVoice, techOwned,
    techChainCount, isAnimalUnlocked, popText, toast } = NS;

  /* ══════════════════════════════════════════════════════════════════
     LIVESTOCK
     ══════════════════════════════════════════════════════════════════ */

  function updateLivestock(dt) {
    if (G.state !== STATE_PLAYING) return;

    for (let i = 0; i < G.livestockPens.length; ++i) {
      const pen = G.livestockPens[i];
      const def = LIVESTOCK[pen.typeIndex];
      pen.feedTimer -= dt;
      if (pen.feedTimer <= 0)
        pen.produceReady = true;
    }
  }

  function feedAndCollect(penIndex) {
    if (G.state !== STATE_PLAYING) return;
    const pen = G.livestockPens[penIndex];
    if (!pen || !pen.produceReady) return;

    const def = LIVESTOCK[pen.typeIndex];
    pen.produceReady = false;
    pen.feedTimer = getFeedInterval(def);

    // Collect produce (happy herds sometimes give two)
    const amount = techOwned('husb_happy') && Math.random() < 0.2 ? 2 : 1;
    G.inventory[def.produce] = (G.inventory[def.produce] || 0) + amount;

    const scr = penCenter(pen);
    flyProduce(def.produceSprite, scr.x, scr.y, amount, false);
    if (amount > 1)
      popText(scr.x, scr.y - 20, '×2!', { color: '#ffd75a', font: 'bold 14px' });
    particles.sparkle(scr.x, scr.y, 6, { color: def.color, speed: 1.5 });
    SZ.GameAudio.play('pickup', { pitch: 0.85 });
    animalVoice(def.sprite);
  }

  /** Generate all perimeter positions around the current grid (one tile outside). */
  function getPerimeterPositions() {
    const positions = [];
    // Bottom edge: row = gridRows, col = -1..gridCols
    for (let c = -1; c <= G.gridCols; ++c)
      positions.push({ gridRow: G.gridRows, gridCol: c });
    // Right edge: col = gridCols, row = gridRows-1 down to -1
    for (let r = G.gridRows - 1; r >= -1; --r)
      positions.push({ gridRow: r, gridCol: G.gridCols });
    // Top edge: row = -1, col = gridCols-1 down to -1
    for (let c = G.gridCols - 1; c >= -1; --c)
      positions.push({ gridRow: -1, gridCol: c });
    // Left edge: col = -1, row = 0 up to gridRows-1
    for (let r = 0; r < G.gridRows; ++r)
      positions.push({ gridRow: r, gridCol: -1 });
    return positions;
  }

  /** Find the next available perimeter slot for a livestock pen. */
  function findNextPerimeterSlot() {
    const positions = getPerimeterPositions();
    for (const pos of positions) {
      const occupied = G.livestockPens.some(p => p.gridRow === pos.gridRow && p.gridCol === pos.gridCol);
      if (!occupied)
        return pos;
    }
    return null; // all perimeter slots full
  }

  /** Relocate all livestock pens to stay on the current grid perimeter after expansion. */
  function relocateLivestockToPerimeter() {
    const positions = getPerimeterPositions();
    let slotIdx = 0;
    for (const pen of G.livestockPens) {
      // Check if pen is still on the perimeter
      const onPerimeter = pen.gridRow === -1 || pen.gridRow === G.gridRows ||
                          pen.gridCol === -1 || pen.gridCol === G.gridCols;
      if (!onPerimeter) {
        // Find next available perimeter slot
        while (slotIdx < positions.length) {
          const pos = positions[slotIdx];
          const occupied = G.livestockPens.some(p => p !== pen && p.gridRow === pos.gridRow && p.gridCol === pos.gridCol);
          if (!occupied) {
            pen.gridRow = pos.gridRow;
            pen.gridCol = pos.gridCol;
            ++slotIdx;
            break;
          }
          ++slotIdx;
        }
      }
    }
  }

  function buyLivestock(typeIndex) {
    if (G.state !== STATE_PLAYING) return;
    const def = LIVESTOCK[typeIndex];
    if (!isAnimalUnlocked(typeIndex) || G.credits < def.cost) return;

    const slot = findNextPerimeterSlot();
    if (!slot) {
      toast('No room left for another pen', UI.bad, 'paw');
      SZ.GameAudio.play('error');
      return;
    }

    G.credits -= def.cost;
    ++G.stats.animals;
    ++G.penVersion;
    G.livestockPens.push({
      typeIndex,
      feedTimer: getFeedInterval(def),
      produceReady: false,
      gridRow: slot.gridRow,
      gridCol: slot.gridCol
    });

    const scr = penCenter(G.livestockPens[G.livestockPens.length - 1]);
    popText(scr.x, scr.y - 15, `-${def.cost}cr`, { color: '#f88', font: 'bold 12px sans-serif' });
    SZ.GameAudio.play('select');
  }

  function getFeedInterval(def) {
    return Math.round(def.feedInterval * (1 - techChainCount('husb_care') * 0.12) * 10) / 10;
  }

  Object.assign(NS, { updateLivestock, feedAndCollect, relocateLivestockToPerimeter, buyLivestock,
    getFeedInterval });

})();
