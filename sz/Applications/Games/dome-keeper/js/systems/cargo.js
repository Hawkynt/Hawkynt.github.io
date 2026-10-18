;(function() {
  'use strict';

  // The bag and the Compressor, ore piles in the mine and ore flying to the keeper.
  // Owns: NS.cargo and these state fields:
  //   G.flyingOre
  // Reads: constants, dom, sprites, fxArt, rules, upgrades, gameState, drones, undergroundArt
  // Reads state of: gameState

  const SZ = window.SZ;
  const NS = SZ.DomeKeeper;
  const G = NS.state;
  const { CANVAS_W, CANVAS_H, VIEW_UNDERGROUND, GRID_COLS, GRID_ROWS, TILE_SIZE, TILE_HIGHLIGHT_COLORS,
    TILE_LABELS, TILE_ICONS } = NS.constants;
  const { ctx, particles, floatingText } = NS.dom;
  const { getSprite } = NS.sprites;
  const { drawGlow } = NS.fxArt;
  const { RESOURCE_TILES } = NS.rules;
  const { getEffectiveLevel } = NS.upgrades;
  const { pileByCell } = NS.gameState;

  /* -- Bag and compression --
     The Compressor packs 9 ore into a Block, 9 Blocks into a Compressed Block and so
     on (up to 5 tiers). Every stack of any tier takes one bag slot. */
  const PACK_TIER_NAMES = ['', 'Block', 'Compressed Block', 'Double Compressed Block', 'Triple Compressed Block', 'Quadruple Compressed Block'];
  const TILE_OF_LABEL = {};
  for (const t of RESOURCE_TILES)
    TILE_OF_LABEL[TILE_LABELS[t]] = t;

  function compressionLevel() {
    return Math.min(5, getEffectiveLevel('compression'));
  }

  // Slots for n ore at level L: full top-tier stacks plus the base-9 digits of the rest
  function packedSlots(n, L) {
    if (!L) return n;
    const top = Math.pow(9, L);
    let slots = Math.floor(n / top), r = n % top;
    while (r > 0) {
      slots += r % 9;
      r = Math.floor(r / 9);
    }
    return slots;
  }

  // The stacks of n ore at level L, highest tier first: [{ tier, count }]
  function packedStacks(n, L) {
    if (!L) return n > 0 ? [{ tier: 0, count: n }] : [];
    const out = [];
    let unit = Math.pow(9, L);
    out.push({ tier: L, count: Math.floor(n / unit) });
    let r = n % unit;
    for (let t = L - 1; t >= 0; --t) {
      unit /= 9;
      out.push({ tier: t, count: Math.floor(r / unit) });
      r %= unit;
    }
    return out.filter(s => s.count > 0);
  }

  // Largest n <= N whose packing needs at most S slots (slots are not monotonic in n,
  // so this walks the base-9 digits instead of trying every amount)
  function maxPackedWithin(N, L, S) {
    if (S < 0) return -1;
    if (!L) return Math.min(N, S);
    if (packedSlots(N, L) <= S) return N;
    const top = Math.pow(9, L);
    const dig = [];   // dig[0] = loose ore .. dig[L - 1], dig[L] = top-tier stacks
    let r = N % top;
    for (let i = 0; i < L; ++i) {
      dig.push(r % 9);
      r = Math.floor(r / 9);
    }
    dig.push(Math.floor(N / top));
    let above = 0;
    for (let i = 0; i <= L; ++i)
      above += dig[i];
    // Keep the digits above p, lower digit p as little as the budget allows and fill below
    for (let p = 0; p <= L; ++p) {
      above -= dig[p];
      if (dig[p] === 0) continue;
      const d = dig.slice();
      d[p] = Math.min(dig[p] - 1, S - above);
      let budget = S - above - d[p];
      if (d[p] < 0 || budget < 0) continue;
      for (let i = p - 1; i >= 0; --i) {
        d[i] = Math.min(8, budget);
        budget -= d[i];
      }
      let n = d[L] * top, mul = 1;
      for (let i = 0; i < L; ++i) {
        n += d[i] * mul;
        mul *= 9;
      }
      return n;
    }
    return 0;
  }

  function bagSlots(b = G.bag, L = compressionLevel()) {
    let slots = 0;
    for (const k in b)
      slots += packedSlots(b[k], L);
    return slots;
  }

  function bagTotal(b = G.bag) {
    let n = 0;
    for (const k in b)
      n += b[k];
    return n;
  }

  // Put up to amount ore of one kind into a bag (the keeper's by default);
  // returns how many fit. Keeps carried / the slot count in step.
  function bagAdd(label, amount, b = G.bag, cap = G.carryCapacity) {
    if (!(amount > 0)) return 0;
    const L = compressionLevel();
    const cur = b[label] || 0;
    const room = cap - bagSlots(b, L) + packedSlots(cur, L);
    const k = Math.max(0, Math.min(amount, maxPackedWithin(cur + amount, L, room) - cur));
    if (k <= 0) return 0;
    b[label] = cur + k;
    if (b === G.bag) {
      G.carried = bagSlots(G.bag, L);
      if (L > 0)
        packNotice(label, cur, cur + k, L);
    }
    return k;
  }

  function packedName(label, tier) {
    const name = label.charAt(0).toUpperCase() + label.slice(1);
    if (!tier) return name;
    const t = PACK_TIER_NAMES[tier];
    return tier === 1 ? name + ' Block' : t.replace(' Block', '') + ' ' + name + ' Block';
  }

  // '+1 Iron Block' when a pickup completes a stack of a higher tier
  function packNotice(label, before, after, L) {
    const now = performance.now();
    if (now - G.lastPackNotice < 400 || G.currentView !== VIEW_UNDERGROUND) return;
    const was = {}, is = {};
    for (const s of packedStacks(before, L)) was[s.tier] = s.count;
    for (const s of packedStacks(after, L)) is[s.tier] = s.count;
    for (let t = L; t >= 1; --t) {
      const gained = (is[t] || 0) - (was[t] || 0);
      if (gained <= 0) continue;
      G.lastPackNotice = now;
      const px = G.drillX * TILE_SIZE + TILE_SIZE / 2 - G.cameraX, py = G.drillY * TILE_SIZE + TILE_SIZE / 2 - G.cameraY;
      const color = TILE_HIGHLIGHT_COLORS[TILE_OF_LABEL[label]] || '#fff';
      floatingText.add(px, py - 54, `+${gained} ${packedName(label, t)}`, { color: '#ffe8a0', font: 'bold 20px sans-serif' });
      particles.sparkle(px, py, 6, { color, speed: 2 });
      return;
    }
  }

  // Loose ore: at most one pile per cell holding every kind of ore dropped there.
  // droppedResources lists the piles, pileByCell finds the pile of a cell.
  function addPileOre(col, row, type, amount) {
    if (!(amount > 0)) return null;
    const key = row * GRID_COLS + col;
    let pile = pileByCell.get(key);
    if (!pile) {
      pile = { col, row, items: {}, total: 0, age: 0, key, idx: G.droppedResources.length, claimedBy: null };
      pileByCell.set(key, pile);
      G.droppedResources.push(pile);
    }
    pile.items[type] = (pile.items[type] || 0) + amount;
    pile.total += amount;
    pile.age = 0;
    ++G.pileVersion;
    return pile;
  }

  // Take up to maxAmount ore from a pile, largest stacks first; fit(type, amount)
  // may accept less of a kind. Returns { taken: { type: amount }, count }.
  function takePileOre(pile, maxAmount, fit) {
    const taken = {};
    let count = 0;
    const types = Object.keys(pile.items).sort((a, b) => pile.items[b] - pile.items[a]);
    for (const t of types) {
      if (count >= maxAmount) break;
      const want = Math.min(pile.items[t], maxAmount - count);
      const got = fit ? fit(+t, want) : want;
      if (got <= 0) continue;
      taken[t] = got;
      count += got;
      pile.items[t] -= got;
      pile.total -= got;
      if (pile.items[t] <= 0)
        delete pile.items[t];
    }
    if (count > 0)
      ++G.pileVersion;
    if (pile.total <= 0)
      removePile(pile);
    return { taken, count };
  }

  function removePile(pile) {
    if (pileByCell.get(pile.key) !== pile) return;
    pileByCell.delete(pile.key);
    const last = G.droppedResources.pop();
    if (last !== pile) {
      G.droppedResources[pile.idx] = last;
      last.idx = pile.idx;
    }
    pile.claimedBy = null;
    ++G.pileVersion;
  }

  function clearPiles() {
    G.droppedResources = [];
    G.flyingOre = [];
    flyGain = {};
    flyGainTimer = 0;
    pileByCell.clear();
    ++G.pileVersion;
  }

  // Piles within Manhattan distance R of a cell
  function pilesNear(col, row, R) {
    const out = [];
    if (!pileByCell.size) return out;
    for (let r = Math.max(0, row - R); r <= Math.min(GRID_ROWS - 1, row + R); ++r) {
      const span = R - Math.abs(r - row);
      for (let c = Math.max(0, col - span); c <= Math.min(GRID_COLS - 1, col + span); ++c) {
        const p = pileByCell.get(r * GRID_COLS + c);
        if (p) out.push(p);
      }
    }
    return out;
  }

  // Add ore to the loose pile of a tile
  function dropOre(r, c, tile, value) {
    addPileOre(c, r, tile, value);
  }

  // Age the piles in 0.5 s steps; piles vanish after 120 s
  function agePiles(dt) {
    G.pileAgeTimer += dt;
    if (G.pileAgeTimer < 0.5) return;
    const step = G.pileAgeTimer;
    G.pileAgeTimer = 0;
    for (let i = G.droppedResources.length - 1; i >= 0; --i) {
      const p = G.droppedResources[i];
      p.age += step;
      if (p.age > 120)
        removePile(p);
    }
  }

  /* Loose ore flying into the keeper's bag (pickups, Magnet, Lodestone): it is
     credited when it arrives, and a pile only gives what will still fit */
  const MAX_FLYING_ORE = 60;     // ore sprites in the air at once (one per pile, with its count)
  G.flyingOre = [];            // { x0, y0, x, y, t, dur, items: { type: amount }, count, type, hop, side }
  let flyGain = {}, flyGainTimer = 0;

  // The keeper's bag as it will be once all ore in flight has landed
  function bagWithFlyingOre() {
    const b = Object.assign({}, G.bag);
    for (const f of G.flyingOre)
      for (const t in f.items) {
        const label = TILE_LABELS[t];
        b[label] = (b[label] || 0) + f.items[t];
      }
    return b;
  }

  // Send what fits of a pile flying to the keeper (shadow: bagWithFlyingOre(),
  // kept up to date across several launches); returns the amount launched
  function launchPileOre(pile, shadow, dur, hop) {
    if (G.flyingOre.length >= MAX_FLYING_ORE) return 0;
    const x = pile.col * TILE_SIZE + TILE_SIZE / 2, y = pile.row * TILE_SIZE + TILE_SIZE / 2;
    const got = takePileOre(pile, Infinity, (t, want) => bagAdd(TILE_LABELS[t], want, shadow));
    if (got.count <= 0) return 0;
    let type = -1, most = 0;
    for (const t in got.taken)
      if (got.taken[t] > most) {
        most = got.taken[t];
        type = +t;
      }
    G.flyingOre.push({ x0: x, y0: y, x, y, t: 0, dur, items: got.taken, count: got.count, type, hop: hop || 0, side: (pile.col + pile.row) % 2 ? 1 : -1 });
    return got.count;
  }

  // Pull the piles around a cell to the keeper (Magnet, Lodestone)
  function attractPiles(R) {
    if (!pileByCell.size || G.flyingOre.length >= MAX_FLYING_ORE || !NS.drones.keeperInMine()) return;
    const near = pilesNear(G.drillX, G.drillY, R);
    if (!near.length) return;
    const shadow = bagWithFlyingOre();
    for (const p of near) {
      const dist = Math.abs(p.col - G.drillX) + Math.abs(p.row - G.drillY);
      launchPileOre(p, shadow, 0.3 + 0.075 * Math.min(4, dist), dist ? 0 : 18);
    }
  }

  // Ease-in flight (it speeds up towards the keeper) with a slight curve, or a hop on the spot
  function flyingOrePos(f, t, kx, ky) {
    const e = t * t;
    const dx = kx - f.x0, dy = ky - f.y0, len = Math.hypot(dx, dy) || 1;
    const bend = Math.sin(Math.PI * t) * Math.min(18, len * 0.15) * f.side;
    return { x: f.x0 + dx * e - dy / len * bend, y: f.y0 + dy * e + dx / len * bend - Math.sin(Math.PI * t) * f.hop };
  }

  function landFlyingOre(f) {
    for (const t in f.items) {
      const label = TILE_LABELS[t];
      const k = bagAdd(label, f.items[t]);
      G.resources[label] += k;
      if (k > 0)
        flyGain[label] = (flyGain[label] || 0) + k;
      // No room after all: back onto the floor under the keeper
      if (f.items[t] > k)
        addPileOre(G.drillX, G.drillY, +t, f.items[t] - k);
    }
    if (flyGainTimer <= 0)
      flyGainTimer = 0.12;
  }

  // Land everything in flight at once (the keeper leaves the mine)
  function landAllFlyingOre() {
    const all = G.flyingOre;
    G.flyingOre = [];
    for (const f of all)
      landFlyingOre(f);
    flyGain = {};
    flyGainTimer = 0;
  }

  function updateFlyingOre(dt) {
    if (G.flyingOre.length && !NS.drones.keeperInMine())
      landAllFlyingOre();
    const kx = G.drillX * TILE_SIZE + TILE_SIZE / 2, ky = G.drillY * TILE_SIZE + TILE_SIZE / 2;
    for (let i = G.flyingOre.length - 1; i >= 0; --i) {
      const f = G.flyingOre[i];
      f.t += dt / f.dur;
      if (f.t >= 1) {
        G.flyingOre.splice(i, 1);
        landFlyingOre(f);
        continue;
      }
      const p = flyingOrePos(f, f.t, kx, ky);
      f.x = p.x;
      f.y = p.y;
    }
    // Arrivals close together share one '+N' per kind and one sound
    if (flyGainTimer <= 0) return;
    flyGainTimer -= dt;
    if (flyGainTimer > 0) return;
    flyGainTimer = 0;
    if (G.currentView === VIEW_UNDERGROUND) {
      const px = kx - G.cameraX, py = ky - G.cameraY;
      let line = 0;
      for (const label in flyGain)
        floatingText.add(px, py - 30 - 24 * line++, `+${flyGain[label]} ${label}`, { color: '#0f0', font: 'bold 22px sans-serif' });
      if (line)
        SZ.GameAudio.play('pickup', { volume: 0.6 });
    }
    flyGain = {};
  }

  function drawFlyingOre(ox, oy) {
    if (!G.flyingOre.length) return;
    const kx = G.drillX * TILE_SIZE + TILE_SIZE / 2, ky = G.drillY * TILE_SIZE + TILE_SIZE / 2;
    ctx.save();
    ctx.lineCap = 'round';
    for (const f of G.flyingOre) {
      const x = f.x - ox, y = f.y - oy;
      if (x < -40 || x > CANVAS_W + 40 || y < -40 || y > CANVAS_H + 40) continue;
      const color = TILE_HIGHLIGHT_COLORS[f.type] || '#fff';
      const tail = flyingOrePos(f, Math.max(0, f.t - 0.18), kx, ky);
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(tail.x - ox, tail.y - oy);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      drawGlow(color, x, y, 16, 0.5);
      const img = getSprite(TILE_ICONS[f.type] || 'crate');
      if (img)
        ctx.drawImage(img, Math.round(x - 10), Math.round(y - 10), 20, 20);
      if (f.count > 1) {
        const b = NS.undergroundArt.getPileBadge(NS.undergroundArt.pileCountText(f.count));
        ctx.drawImage(b.canvas, Math.round(x - b.w / 2), Math.round(y - 10 - b.h), b.w, b.h);
      }
    }
    ctx.restore();
  }

  NS.cargo = { compressionLevel, packedStacks, bagSlots, bagTotal, bagAdd, packedName, addPileOre,
    takePileOre, clearPiles, pilesNear, dropOre, agePiles, bagWithFlyingOre, launchPileOre, attractPiles,
    landAllFlyingOre, updateFlyingOre, drawFlyingOre };
})();
