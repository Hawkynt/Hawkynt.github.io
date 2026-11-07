/* The Sugar Garden: seventeen plants with growth and life in garden ticks (one real minute
   each), the bonus a mature plant gives while it stands, what harvesting it pays, and the
   mutations - two mature parents next to an empty plot may sprout a new kind there. Four soils
   trade growth speed, bonus strength and mutation chance. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});

  /* effect kinds: prod, click, goldenFreq, goldenDur, comboCap (each per mature plant)
     harvest: cps (minutes of production), notes, golden (spawns a golden treat), crystals
     rarity: common, uncommon, rare, epic, legendary */
  const PLANTS = [
    { id: 'butterwheat', name: 'Butterwheat', color: '#f0c860', leaf: '#8ab048', shape: 'wheat', rarity: 'common', grow: 3, life: 30, cost: 1,
      effect: { k: 'prod', v: 0.01 }, harvest: { cps: 3 }, desc: 'Golden ears that smell of fresh butter.' },
    { id: 'sugarreed', name: 'Sugar Reed', color: '#f4f0e0', leaf: '#6ac080', shape: 'reed', rarity: 'common', grow: 5, life: 40, cost: 3,
      effect: { k: 'click', v: 0.02 }, harvest: { cps: 5 }, desc: 'Sweet stalks that crunch like rock candy.' },
    { id: 'crumbweed', name: 'Crumbweed', color: '#9a8a60', leaf: '#5a6a30', shape: 'weed', rarity: 'common', grow: 2, life: 60, cost: 0, weed: true,
      effect: { k: 'prod', v: -0.01 }, harvest: { cps: 0.5 }, desc: 'Sprouts on its own in empty plots and drags the bakery down. Pull it - or breed it.' },
    { id: 'cocoabush', name: 'Cocoa Bush', color: '#8a4a28', leaf: '#3a7a3a', shape: 'bush', rarity: 'uncommon', grow: 7, life: 50, cost: 10,
      effect: { k: 'prod', v: 0.02 }, harvest: { cps: 10 }, desc: 'Pods full of beans, already a little roasted.' },
    { id: 'vanilla', name: 'Vanilla Orchid', color: '#fff4c8', leaf: '#5aa060', shape: 'flower', rarity: 'uncommon', grow: 9, life: 45, cost: 15,
      effect: { k: 'goldenFreq', v: 0.02 }, harvest: { cps: 12 }, desc: 'Its scent draws golden treats closer.' },
    { id: 'cinnamon', name: 'Cinnamon Sprig', color: '#c06a30', leaf: '#6a8a3a', shape: 'sprig', rarity: 'uncommon', grow: 8, life: 50, cost: 15,
      effect: { k: 'goldenDur', v: 0.03 }, harvest: { cps: 12 }, desc: 'Warm bark that makes good luck linger.' },
    { id: 'glowcap', name: 'Glowcap', color: '#9affea', leaf: '#4a6a8a', shape: 'mushroom', rarity: 'uncommon', grow: 6, life: 35, cost: 20,
      effect: { k: 'click', v: 0.01 }, harvest: { golden: 1 }, desc: 'A mushroom that glows at night. Harvest it and a golden treat pops out.' },
    { id: 'mintfern', name: 'Mint Fern', color: '#9af0c0', leaf: '#3aa070', shape: 'fern', rarity: 'uncommon', grow: 6, life: 55, cost: 12,
      effect: { k: 'click', v: 0.03 }, harvest: { cps: 8 }, desc: 'Cool fronds that keep fingers nimble.' },
    { id: 'honeybloom', name: 'Honeybloom', color: '#ffc040', leaf: '#7ab048', shape: 'flower', rarity: 'rare', grow: 12, life: 50, cost: 40,
      effect: { k: 'prod', v: 0.03 }, harvest: { notes: 1 }, desc: 'Drips honey that the Test Kitchen pays good notes for.' },
    { id: 'emberpepper', name: 'Ember Pepper', color: '#ff4a2a', leaf: '#4a8a2a', shape: 'pepper', rarity: 'rare', grow: 10, life: 45, cost: 40,
      effect: { k: 'comboCap', v: 4 }, harvest: { cps: 20 }, desc: 'So hot your clicks keep going.' },
    { id: 'frostlily', name: 'Frost Lily', color: '#c8e8ff', leaf: '#5a8aa0', shape: 'lily', rarity: 'rare', grow: 14, life: 60, cost: 50,
      effect: { k: 'goldenDur', v: 0.05 }, harvest: { cps: 20 }, desc: 'Petals of ice that slow the clock on good fortune.' },
    { id: 'moonmelon', name: 'Moon Melon', color: '#e8e0ff', leaf: '#6a7ab0', shape: 'melon', rarity: 'rare', grow: 16, life: 50, cost: 80,
      effect: { k: 'goldenFreq', v: 0.04 }, harvest: { notes: 3 }, desc: 'Ripens only by moonlight. Full of notes and secrets.' },
    { id: 'jellytulip', name: 'Jelly Tulip', color: '#ff70c0', leaf: '#5ab070', shape: 'tulip', rarity: 'epic', grow: 18, life: 55, cost: 120,
      effect: { k: 'click', v: 0.06 }, harvest: { cps: 40 }, desc: 'Wobbly petals of fruit jelly.' },
    { id: 'starvine', name: 'Star Vine', color: '#ffe870', leaf: '#4a5ab0', shape: 'vine', rarity: 'epic', grow: 20, life: 60, cost: 150,
      effect: { k: 'prod', v: 0.06 }, harvest: { cps: 45 }, desc: 'Climbs toward the sky and bears tiny stars.' },
    { id: 'goldengourd', name: 'Golden Gourd', color: '#ffd25a', leaf: '#8a9a3a', shape: 'gourd', rarity: 'epic', grow: 24, life: 50, cost: 300,
      effect: { k: 'goldenFreq', v: 0.06 }, harvest: { cps: 90, golden: 1 }, desc: 'Solid gold on the outside, pure luck on the inside.' },
    { id: 'crystalrose', name: 'Crystal Rose', color: '#e59cff', leaf: '#7a5ab0', shape: 'rose', rarity: 'legendary', grow: 30, life: 45, cost: 800,
      effect: { k: 'prod', v: 0.08 }, harvest: { crystals: 1 }, desc: 'Grown from sugar and starlight. Harvest it for a sugar crystal.' },
    { id: 'voidorchid', name: 'Void Orchid', color: '#4a2a8a', leaf: '#2a1a4a', shape: 'orchid', rarity: 'legendary', grow: 36, life: 40, cost: 1500,
      effect: { k: 'prod', v: 0.15 }, harvest: { notes: 12 }, desc: 'A flower from beyond the oven. Nobody knows what it eats.' },
  ];

  /* parents [a, b] (b may equal a: then two of a are needed), chance per tick per empty plot */
  const MUTATIONS = [
    { child: 'sugarreed', parents: ['butterwheat', 'butterwheat'], chance: 0.05 },
    { child: 'cocoabush', parents: ['butterwheat', 'sugarreed'], chance: 0.04 },
    { child: 'mintfern', parents: ['crumbweed', 'sugarreed'], chance: 0.05 },
    { child: 'glowcap', parents: ['crumbweed', 'crumbweed'], chance: 0.03 },
    { child: 'vanilla', parents: ['cocoabush', 'sugarreed'], chance: 0.03 },
    { child: 'cinnamon', parents: ['cocoabush', 'butterwheat'], chance: 0.03 },
    { child: 'honeybloom', parents: ['vanilla', 'sugarreed'], chance: 0.02 },
    { child: 'emberpepper', parents: ['cinnamon', 'cocoabush'], chance: 0.02 },
    { child: 'frostlily', parents: ['mintfern', 'vanilla'], chance: 0.02 },
    { child: 'moonmelon', parents: ['honeybloom', 'glowcap'], chance: 0.015 },
    { child: 'jellytulip', parents: ['emberpepper', 'honeybloom'], chance: 0.012 },
    { child: 'starvine', parents: ['moonmelon', 'frostlily'], chance: 0.01 },
    { child: 'goldengourd', parents: ['starvine', 'jellytulip'], chance: 0.008 },
    { child: 'crystalrose', parents: ['goldengourd', 'starvine'], chance: 0.004 },
    { child: 'voidorchid', parents: ['crystalrose', 'glowcap'], chance: 0.003 },
  ];

  const SOILS = [
    { id: 'dirt', name: 'Garden Dirt', desc: 'Plain, honest soil.', grow: 1, effect: 1, mutate: 1, color: '#6a4a30' },
    { id: 'fertilizer', name: 'Cookie Compost', desc: 'Plants grow 50% faster, bonuses -25%.', grow: 1.5, effect: 0.75, mutate: 1, color: '#4a3a24' },
    { id: 'clay', name: 'Caramel Clay', desc: 'Bonuses +25%, plants grow 25% slower.', grow: 0.75, effect: 1.25, mutate: 1, color: '#9a6a3a' },
    { id: 'woodchips', name: 'Wafer Chips', desc: 'Mutations three times as likely, bonuses halved.', grow: 1, effect: 0.5, mutate: 3, color: '#c09a60' },
  ];

  const RARITY = { common: '#d8c8b0', uncommon: '#7be08a', rare: '#6ab4ff', epic: '#e59cff', legendary: '#ffd25a' };

  const BY_ID = {};
  for (let i = 0; i < PLANTS.length; ++i) BY_ID[PLANTS[i].id] = PLANTS[i];
  const SOIL_BY_ID = {};
  for (let i = 0; i < SOILS.length; ++i) SOIL_BY_ID[SOILS[i].id] = SOILS[i];

  NS.gardenData = {
    PLANTS, MUTATIONS, SOILS, RARITY, BY_ID, SOIL_BY_ID,
    TICK_MS: 60000, MAX_CATCHUP: 1440, UNLOCK_STAGE: 3, WEED_CHANCE: 0.002,
  };
})();
