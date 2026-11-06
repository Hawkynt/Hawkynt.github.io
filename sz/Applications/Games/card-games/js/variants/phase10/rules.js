/* Phase 10 rules: deck, card points, the ten phase objectives, group validation, hits and hand sorting. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const V = SZ.CardGames.v.phase10;
  const S = V.S;
  const { NUM_PLAYERS, PHASES } = V;

  const P10_COLORS = ['red', 'blue', 'green', 'yellow'];

  /* ================================================================
     DECK CREATION
     ================================================================ */

  function createPhase10Deck() {
    const d = [];
    for (const color of P10_COLORS)
      for (let num = 1; num <= 12; ++num)
        for (let copy = 0; copy < 2; ++copy)
          d.push({ number: num, color, type: 'number' });
    for (let i = 0; i < 4; ++i)
      d.push({ number: 0, color: 'skip', type: 'skip' });
    for (let i = 0; i < 8; ++i)
      d.push({ number: 0, color: 'wild', type: 'wild' });
    return d;
  }

  function cardPoints(card) {
    if (card.type === 'wild') return 25;
    if (card.type === 'skip') return 15;
    if (card.number >= 10) return 10;
    return 5;
  }

  function handPoints(hand) {
    let pts = 0;
    for (const c of hand) pts += cardPoints(c);
    return pts;
  }

  /* ================================================================
     PHASE VALIDATION
     ================================================================ */

  function isSet(cards, minCount) {
    if (cards.length < minCount) return false;
    let num = -1;
    for (const c of cards) {
      if (c.type === 'wild') continue;
      if (num < 0) num = c.number;
      else if (c.number !== num) return false;
    }
    return true;
  }

  function isRun(cards, minCount) {
    if (cards.length < minCount) return false;
    // Extract non-wild numbers, sort, then check if wilds fill gaps
    const nums = [];
    let wilds = 0;
    for (const c of cards) {
      if (c.type === 'wild') ++wilds;
      else nums.push(c.number);
    }
    nums.sort((a, b) => a - b);
    // Check for duplicates among non-wild numbers
    for (let i = 1; i < nums.length; ++i)
      if (nums[i] === nums[i - 1]) return false;
    if (nums.length === 0) return wilds >= minCount;
    let gaps = 0;
    for (let i = 1; i < nums.length; ++i)
      gaps += nums[i] - nums[i - 1] - 1;
    return gaps <= wilds;
  }

  function isColorGroup(cards, minCount) {
    if (cards.length < minCount) return false;
    let col = null;
    for (const c of cards) {
      if (c.type === 'wild') continue;
      if (!col) col = c.color;
      else if (c.color !== col) return false;
    }
    return true;
  }

  function validateGroup(cards, group) {
    if (cards.length < group.count) return false;
    if (group.type === 'set') return isSet(cards, group.count);
    if (group.type === 'run') return isRun(cards, group.count);
    if (group.type === 'color') return isColorGroup(cards, group.count);
    return false;
  }

  /* Try to split selected cards into the groups required by a phase.
     Returns array of card-groups (matching phase.groups order) or null. */
  function tryMatchPhase(cards, phase) {
    const groups = phase.groups;
    if (groups.length === 1)
      return validateGroup(cards, groups[0]) ? [cards.slice()] : null;

    // Two groups: try every partition
    const n = cards.length;
    const g0Count = groups[0].count;
    const g1Count = groups[1].count;
    if (n < g0Count + g1Count) return null;

    // Generate combinations of size g0Count
    const indices = [];
    function combo(start, chosen) {
      if (chosen.length === g0Count) {
        const set0 = chosen.map(i => cards[i]);
        const used = new Set(chosen);
        const set1 = [];
        for (let i = 0; i < n; ++i)
          if (!used.has(i)) set1.push(cards[i]);
        if (set1.length >= g1Count && validateGroup(set0, groups[0]) && validateGroup(set1, groups[1]))
          indices.push([set0, set1]);
        return;
      }
      if (indices.length > 0) return; // found one, stop
      for (let i = start; i < n; ++i)
        combo(i + 1, [...chosen, i]);
    }
    combo(0, []);
    return indices.length > 0 ? indices[0] : null;
  }

  /* ================================================================
     HITTING
     ================================================================ */

  function canHitOnSet(card, group) {
    if (card.type === 'wild') return true;
    // group is a set -- all same number
    let num = -1;
    for (const c of group)
      if (c.type !== 'wild') { num = c.number; break; }
    return num < 0 || card.number === num;
  }

  function canHitOnRun(card, group) {
    if (card.type === 'wild') return true;
    const nums = [];
    let wilds = 0;
    for (const c of group) {
      if (c.type === 'wild') ++wilds;
      else nums.push(c.number);
    }
    nums.sort((a, b) => a - b);
    // Figure out the effective run range
    if (nums.length === 0) return true;
    const lo = nums[0];
    const hi = nums[nums.length - 1];
    const span = hi - lo;
    const filledLen = span + 1;
    const totalLen = filledLen + (wilds - (filledLen - nums.length));
    // Card extends the run if it's adjacent
    const extLo = lo - (totalLen > filledLen ? 0 : 1);
    const extHi = hi + 1;
    return (card.number === lo - 1 && lo - 1 >= 1) || (card.number === hi + 1 && hi + 1 <= 12);
  }

  function canHitOnColor(card, group) {
    if (card.type === 'wild') return true;
    let col = null;
    for (const c of group)
      if (c.type !== 'wild') { col = c.color; break; }
    return !col || card.color === col;
  }

  function canHitOnGroup(card, group, groupDef) {
    if (groupDef.type === 'set') return canHitOnSet(card, group);
    if (groupDef.type === 'run') return canHitOnRun(card, group);
    if (groupDef.type === 'color') return canHitOnColor(card, group);
    return false;
  }

  /* ================================================================
     HINT HELPERS
     ================================================================ */

  function isCardUsefulForCurrentPhase(hand, idx) {
    const card = hand[idx];
    if (card.type === 'wild') return true;
    const phIdx = S.playerPhases[0];
    if (phIdx >= 10) return false;
    const ph = PHASES[phIdx];
    for (const g of ph.groups) {
      if (g.type === 'set') {
        let count = 0;
        for (const c of hand)
          if (c.type === 'wild' || (c.type === 'number' && c.number === card.number)) ++count;
        if (count >= 2) return true;
      }
      if (g.type === 'run') {
        for (const c of hand)
          if (c !== card && c.type === 'number' && Math.abs(c.number - card.number) <= 1) return true;
      }
      if (g.type === 'color') {
        let count = 0;
        for (const c of hand)
          if (c.type === 'wild' || (c.type === 'number' && c.color === card.color)) ++count;
        if (count >= 3) return true;
      }
    }
    return false;
  }

  function canHitAny(card) {
    for (let tp = 0; tp < NUM_PLAYERS; ++tp) {
      if (S.laidPhases[tp].length === 0) continue;
      const phIdx = S.playerPhases[tp];
      const ph = PHASES[phIdx];
      for (let gi = 0; gi < S.laidPhases[tp].length; ++gi) {
        const gDef = ph.groups[gi] || ph.groups[0];
        if (canHitOnGroup(card, S.laidPhases[tp][gi], gDef)) return true;
      }
    }
    return false;
  }

  /* ================================================================
     PLAYER PHASE CHECK
     ================================================================ */

  function playerCanLayPhase() {
    const phIdx = S.playerPhases[0];
    if (phIdx >= 10 || S.laidPhases[0].length > 0) return false;
    const sel = S.selectedCards.map(i => S.hands[0][i]);
    return tryMatchPhase(sel, PHASES[phIdx]) !== null;
  }

  function playerCanHitSelected() {
    if (S.laidPhases[0].length === 0 || S.selectedCards.length !== 1) return false;
    const card = S.hands[0][S.selectedCards[0]];
    return canHitAny(card);
  }

  function sortHand(hand) {
    const to = { number: 0, skip: 1, wild: 2 };
    hand.sort((a, b) => {
      const td = (to[a.type] ?? 2) - (to[b.type] ?? 2);
      if (td !== 0) return td;
      if (a.type === 'number' && b.type === 'number') {
        if (a.color !== b.color) return String(a.color).localeCompare(String(b.color));
        return a.number - b.number;
      }
      return 0;
    });
  }

  Object.assign(V, { createPhase10Deck, handPoints, tryMatchPhase, canHitOnGroup, cardPoints,
    playerCanLayPhase, playerCanHitSelected, isCardUsefulForCurrentPhase, canHitAny, sortHand });

})();
