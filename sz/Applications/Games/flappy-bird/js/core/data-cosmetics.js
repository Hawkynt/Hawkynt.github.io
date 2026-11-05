;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The wardrobe catalogue: birds with their perks, hats and trails, and how each one is
     unlocked - bought with coins, earned on a story stage, by an achievement or by a
     seasonal event track. The art lives in SZ.FlappyBirdArt and SZ.FlappyCosmeticArt. */

  const BIRD_DEFS = [
    { id: 'sunny', perk: 'Balanced all-rounder', price: 0 },
    { id: 'ruby', perk: 'Light: gravity 6% weaker', price: 400 },
    { id: 'jay', perk: 'Shiny eyes: +50 px coin magnet', price: 900 },
    { id: 'pip', perk: 'Lucky: +15% coins', unlock: { stage: '2-4' } },
    { id: 'snowy', perk: 'Tough: +1 heart', unlock: { stage: '4-4' } },
    { id: 'phoenix', perk: 'Reborn: revive once per run', unlock: { stage: '6-4' } },
    { id: 'goldie', perk: 'Gilded: +20% coins', unlock: { ach: 'coins_10k' } },
    { id: 'corvus', perk: 'Storm-born: gusts and crows leave you alone', unlock: { ach: 'boss_corvus' } },
    { id: 'frosty', perk: 'Festive: +1 seasonal token per pickup', unlock: { season: 'frost' } },
    { id: 'nova', perk: 'Festive: +1 seasonal token per pickup', unlock: { season: 'newyear' } },
    { id: 'blossom', perk: 'Festive: +1 seasonal token per pickup', unlock: { season: 'bloom' } },
    { id: 'surf', perk: 'Festive: +1 seasonal token per pickup', unlock: { season: 'sun' } },
    { id: 'maple', perk: 'Festive: +1 seasonal token per pickup', unlock: { season: 'harvest' } },
    { id: 'jack', perk: 'Festive: +1 seasonal token per pickup', unlock: { season: 'spooky' } }
  ];

  const HATS = [
    { id: 'none', name: 'No Hat', price: 0 },
    { id: 'cap', name: 'Flight Cap', price: 300 },
    { id: 'bow', name: 'Big Bow', price: 350 },
    { id: 'goggles', name: 'Pilot Goggles', unlock: { ach: 'boss_nohit' } },
    { id: 'crown', name: 'Crown', unlock: { ach: 'streak_7' } },
    { id: 'tophat', name: 'Top Hat', unlock: { ach: 'arcade_20k' } },
    { id: 'halo', name: 'Halo', unlock: { ach: 'zen_30' } },
    { id: 'viking', name: 'Viking Helm', unlock: { ach: 'bossrush' } },
    { id: 'flower', name: 'Daisy', unlock: { ach: 'daily_7' } },
    { id: 'party', name: 'Party Hat', unlock: { season: 'newyear' } },
    { id: 'santa', name: 'Winter Hat', unlock: { season: 'frost' } },
    { id: 'bunny', name: 'Bunny Ears', unlock: { season: 'bloom' } },
    { id: 'shades', name: 'Sunglasses', unlock: { season: 'sun' } },
    { id: 'beret', name: 'Harvest Beret', unlock: { season: 'harvest' } },
    { id: 'witch', name: 'Witch Hat', unlock: { season: 'spooky' } }
  ];

  const TRAILS = [
    { id: 'none', name: 'No Trail', price: 0 },
    { id: 'sparkle', name: 'Sparkles', price: 0 },
    { id: 'hearts', name: 'Hearts', price: 500 },
    { id: 'stars', name: 'Shooting Stars', price: 800 },
    { id: 'rainbow', name: 'Rainbow', unlock: { ach: 'combo_25' } },
    { id: 'embers', name: 'Embers', unlock: { ach: 'boss_wyrm' } },
    { id: 'notes', name: 'Music Notes', unlock: { ach: 'zen_10' } },
    { id: 'fireworks', name: 'Fireworks', unlock: { season: 'newyear' } },
    { id: 'snow', name: 'Snowfall', unlock: { season: 'frost' } },
    { id: 'petals', name: 'Petals', unlock: { season: 'bloom' } },
    { id: 'bubbles', name: 'Bubbles', unlock: { season: 'sun' } },
    { id: 'leaves', name: 'Autumn Leaves', unlock: { season: 'harvest' } },
    { id: 'ghosts', name: 'Little Ghosts', unlock: { season: 'spooky' } }
  ];

  /* scenery themes: follow the calendar, or keep an event's look all year once its track
     reached the first tier */
  const THEMES = [
    { id: 'auto', name: 'Follow the Calendar', price: 0 },
    { id: 'frost', name: 'Winter Wonderflap', unlock: { season: 'frost' } },
    { id: 'newyear', name: 'Year-End Fireworks', unlock: { season: 'newyear' } },
    { id: 'bloom', name: 'Blossom Festival', unlock: { season: 'bloom' } },
    { id: 'sun', name: 'Summer Splash', unlock: { season: 'sun' } },
    { id: 'harvest', name: 'Harvest Moon', unlock: { season: 'harvest' } },
    { id: 'spooky', name: 'Spooky Flight', unlock: { season: 'spooky' } }
  ];

  Object.assign(NS.C, { BIRD_DEFS, HATS, TRAILS, THEMES });
})();
