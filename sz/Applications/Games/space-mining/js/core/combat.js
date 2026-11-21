/* The combat model as pure rules: five damage types against six armour classes, the damage
   type of each kind of shot, the damage mix of an army (units, turrets, the ship's weapons) and
   how much an enemy of a given armour resists that mix - the counter-pick weight the wave
   composer leans on. The weapons' hardpoints in the save: owning, levels, prices, unlocks,
   mounting per hull and the repair of stored weapons. No DOM, no state access. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const { WEAPONS, WEAPON_BY_ID, LEVEL_COST, SLOTS } = NS.weaponData;

  const TYPES = ['energy', 'kinetic', 'explosive', 'flak', 'emp'];
  const ARMOURS = ['light', 'armoured', 'shielded', 'swarm', 'structure', 'bio'];
  /* damage factor of a type against an armour */
  const TABLE = {
    energy: { light: 1, armoured: 0.7, shielded: 1.4, swarm: 1, structure: 0.8, bio: 1.2 },
    kinetic: { light: 1, armoured: 1.5, shielded: 0.7, swarm: 0.6, structure: 1, bio: 1 },
    explosive: { light: 0.9, armoured: 1.3, shielded: 0.9, swarm: 1.4, structure: 1.5, bio: 1.1 },
    flak: { light: 1.5, armoured: 0.4, shielded: 0.6, swarm: 1.8, structure: 0.3, bio: 1 },
    emp: { light: 0.3, armoured: 0.3, shielded: 2.5, swarm: 0.5, structure: 0.6, bio: 0.2 },
  };
  const KIND_TYPE = { bolt: 'energy', beam: 'energy', laser: 'energy', shell: 'kinetic', flak: 'flak', missile: 'explosive', artillery: 'explosive', bomb: 'explosive', nanobolt: 'emp' };

  function mult(type, armour) {
    const row = TABLE[type];
    return row && row[armour] != null ? row[armour] : 1;
  }

  function typeOfKind(kind) {
    return KIND_TYPE[kind] || '';
  }

  /* shares of each damage type in a list of { type, w } (w: damage per second or a count) */
  function mix(list) {
    const out = {};
    let tot = 0;
    for (let i = 0; i < list.length; ++i) if (TABLE[list[i].type] && list[i].w > 0) { out[list[i].type] = (out[list[i].type] || 0) + list[i].w; tot += list[i].w; }
    if (tot) for (const t in out) out[t] /= tot;
    return out;
  }

  /* how much an armour holds out against a mix: the mix's mean factor against it */
  function resistance(shares, armour) {
    let m = 0, any = false;
    for (const t in shares) { m += shares[t] * mult(t, armour); any = true; }
    return any ? m : 1;
  }

  /* the wave composer's weight for an enemy of this armour: up to 2.25x when the mix barely
     scratches it, down to 0.25x when it is the mix's favourite prey */
  function counterWeight(shares, armour) {
    const k = Math.max(0.5, Math.min(1.5, 2 - resistance(shares, armour)));
    return k * k;
  }

  /* ── hardpoints in the save ── */
  function blank() {
    return { owned: {}, slots: [] };
  }

  function repair(src) {
    const out = blank();
    if (!src || typeof src !== 'object') return out;
    if (src.owned && typeof src.owned === 'object')
      for (const id in src.owned) {
        const n = Math.floor(+src.owned[id] || 0);
        if (WEAPON_BY_ID[id] && n > 0) out.owned[id] = Math.min(LEVEL_COST.length, n);
      }
    if (Array.isArray(src.slots))
      for (let i = 0; i < Math.min(3, src.slots.length); ++i) out.slots.push(src.slots[i] && out.owned[src.slots[i]] && out.slots.indexOf(src.slots[i]) < 0 ? src.slots[i] : null);
    return out;
  }

  function level(save, id) {
    return save.weapons.owned[id] || 0;
  }

  /* open: it can be bought (its belt licensed, or its unlock earned) */
  function open(save, id) {
    const w = WEAPON_BY_ID[id];
    if (!w) return false;
    if (w.unlock.id) return save.unlocks.indexOf(w.unlock.id) >= 0;
    return save.licenses.indexOf(w.unlock.licence) >= 0;
  }

  /* credits for the next level (0 when the next level is free, -1 when maxed) */
  function nextCost(save, id) {
    const w = WEAPON_BY_ID[id], lvl = level(save, id);
    if (lvl >= LEVEL_COST.length) return -1;
    if (!lvl && w.unlock.id) return 0;
    return Math.round(w.cost * LEVEL_COST[lvl] / 10) * 10;
  }

  function buy(save, id) {
    if (!open(save, id)) return false;
    const c = nextCost(save, id);
    if (c < 0 || save.credits < c) return false;
    save.credits -= c;
    save.weapons.owned[id] = level(save, id) + 1;
    if (save.weapons.owned[id] === 1) autoMount(save, id);
    return true;
  }

  function slotCount(hullId) {
    return SLOTS[hullId] || 1;
  }

  /* mounts a weapon in a hardpoint (null empties it); a weapon sits in one hardpoint at most */
  function mount(save, slot, id) {
    if (slot < 0 || slot >= 3 || (id && !level(save, id))) return false;
    const s = save.weapons.slots;
    while (s.length < 3) s.push(null);
    if (id) for (let i = 0; i < 3; ++i) if (s[i] === id) s[i] = null;
    s[slot] = id || null;
    return true;
  }

  /* a new weapon goes into the first free hardpoint of the flown hull */
  function autoMount(save, id) {
    const n = slotCount(save.hull);
    const s = save.weapons.slots;
    while (s.length < 3) s.push(null);
    if (s.indexOf(id) >= 0) return;
    for (let i = 0; i < n; ++i) if (!s[i]) { s[i] = id; return; }
  }

  /* weapons handed out by unlocks join the save at level 1 */
  function grantUnlocked(save) {
    for (let i = 0; i < WEAPONS.length; ++i) {
      const w = WEAPONS[i];
      if (w.unlock.id && !level(save, w.id) && save.unlocks.indexOf(w.unlock.id) >= 0) {
        save.weapons.owned[w.id] = 1;
        autoMount(save, w.id);
      }
    }
  }

  /* the weapons in the flown hull's hardpoints, by hardpoint (null for an empty one) */
  function mounted(save) {
    const n = slotCount(save.hull), out = [];
    for (let i = 0; i < n; ++i) {
      const id = save.weapons.slots[i];
      out.push(id && level(save, id) ? id : null);
    }
    return out;
  }

  Object.assign(NS.combat, {
    TYPES, ARMOURS, TABLE, mult, typeOfKind, mix, resistance, counterWeight,
    blank, repair, level, open, nextCost, buy, slotCount, mount, autoMount, grantUnlocked, mounted
  });
})();
