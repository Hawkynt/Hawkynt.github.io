/* The card collection — 55 unique cards — plus the type icons/colors and the
   elemental combo icons. Types: attack, defend, heal, buff, debuff. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});

  /* ── Card type icons (drawn procedurally) ── */
  const TYPE_ICONS = {
    attack: { symbol: '\u2694', label: 'ATK' },   // crossed swords
    defend: { symbol: '\u{1F6E1}', label: 'DEF' }, // shield
    heal:   { symbol: '\u2764', label: 'HEAL' },   // heart
    buff:   { symbol: '\u2B06', label: 'BUFF' },   // up arrow
    debuff: { symbol: '\u2B07', label: 'DBNF' }    // down arrow
  };

  const TYPE_COLORS = {
    attack: { bg: '#2a0808', border: '#f44',  badge: '#f44',  grad1: '#3a1010', grad2: '#1a0505' },
    defend: { bg: '#081828', border: '#48f',  badge: '#48f',  grad1: '#102a3a', grad2: '#050a1a' },
    heal:   { bg: '#082808', border: '#4f4',  badge: '#4f4',  grad1: '#103a10', grad2: '#051a05' },
    buff:   { bg: '#28200a', border: '#fa4',  badge: '#fa4',  grad1: '#3a2a10', grad2: '#1a1005' },
    debuff: { bg: '#200a20', border: '#a66',  badge: '#a66',  grad1: '#2a1028', grad2: '#100510' }
  };

  const COMBO_ICONS = {
    fire:   { symbol: '\u{1F525}', color: '#f80' },
    storm:  { symbol: '\u26A1',    color: '#ff4' },
    frost:  { symbol: '\u2744',    color: '#8ef' },
    shadow: { symbol: '\u{1F319}', color: '#a6f' },
    holy:   { symbol: '\u2726',    color: '#fe8' },
    nature: { symbol: '\u{1F33F}', color: '#6c4' },
    arcane: { symbol: '\u2735',    color: '#c8f' }
  };

  const ALL_CARDS = [
    // ── Attack cards (15) ──
    { id: 1,  name: 'Fireball',         type: 'attack', cost: 3, power: 8,  color: '#f44',  desc: 'Deal 8 damage to the enemy', flavor: 'A searing sphere of flame', combo: 'fire' },
    { id: 2,  name: 'Lightning Bolt',   type: 'attack', cost: 2, power: 5,  color: '#ff0',  desc: 'Deal 5 damage to the enemy', flavor: 'Strikes faster than thought', combo: 'storm' },
    { id: 3,  name: 'Ice Shard',        type: 'attack', cost: 2, power: 4,  color: '#6ef',  desc: 'Deal 4 damage to the enemy', flavor: 'Razor-sharp frozen crystal', combo: 'frost' },
    { id: 4,  name: 'Shadow Strike',    type: 'attack', cost: 3, power: 7,  color: '#808',  desc: 'Deal 7 damage to the enemy', flavor: 'Unseen blade from the void', combo: 'shadow' },
    { id: 5,  name: 'Holy Smite',       type: 'attack', cost: 4, power: 10, color: '#ff8',  desc: 'Deal 10 damage to the enemy', flavor: 'Divine wrath made manifest', combo: 'holy' },
    { id: 6,  name: 'Meteor Crash',     type: 'attack', cost: 6, power: 16, color: '#f80',  desc: 'Deal 16 damage to the enemy', flavor: 'A rock from the heavens', combo: 'fire' },
    { id: 7,  name: 'Wind Slash',       type: 'attack', cost: 1, power: 3,  color: '#8f8',  desc: 'Deal 3 damage to the enemy', flavor: 'A quick gust of blades', combo: 'storm' },
    { id: 8,  name: 'Poison Dart',      type: 'attack', cost: 2, power: 4,  color: '#0a0',  desc: 'Deal 4 damage to the enemy', flavor: 'Tipped with lethal venom', combo: 'nature' },
    { id: 9,  name: 'Arcane Missile',   type: 'attack', cost: 1, power: 2,  color: '#a6f',  desc: 'Deal 2 damage to the enemy', flavor: 'Never misses its target', combo: 'arcane' },
    { id: 10, name: 'Thunder Clap',     type: 'attack', cost: 4, power: 9,  color: '#ff4',  desc: 'Deal 9 damage to the enemy', flavor: 'Echoing thunder splits the sky', combo: 'storm' },
    { id: 11, name: 'Dragon Breath',    type: 'attack', cost: 7, power: 20, color: '#f60',  desc: 'Deal 20 damage to the enemy', flavor: 'Ancient fire that melts steel', combo: 'fire' },
    { id: 12, name: 'Soul Drain',       type: 'attack', cost: 3, power: 5,  color: '#606',  desc: 'Deal 5 damage to the enemy', flavor: 'Tears the spirit asunder', combo: 'shadow' },
    { id: 13, name: 'Earth Spike',      type: 'attack', cost: 3, power: 6,  color: '#a85',  desc: 'Deal 6 damage to the enemy', flavor: 'Erupts from the ground below', combo: 'nature' },
    { id: 14, name: 'Void Blast',       type: 'attack', cost: 5, power: 12, color: '#309',  desc: 'Deal 12 damage to the enemy', flavor: 'Energy from beyond the veil', combo: 'arcane' },
    { id: 15, name: 'Frost Nova',       type: 'attack', cost: 4, power: 8,  color: '#8ef',  desc: 'Deal 8 damage to the enemy', flavor: 'Freezing explosion outward', combo: 'frost' },

    // ── Defend cards (10) ──
    { id: 16, name: 'Stone Wall',       type: 'defend', cost: 2, power: 6,  color: '#888',  desc: 'Gain 6 shield points', flavor: 'Solid as the mountain itself', combo: 'nature' },
    { id: 17, name: 'Ice Barrier',      type: 'defend', cost: 3, power: 8,  color: '#aef',  desc: 'Gain 8 shield points', flavor: 'A wall of frozen crystal', combo: 'frost' },
    { id: 18, name: 'Holy Shield',      type: 'defend', cost: 3, power: 7,  color: '#fe8',  desc: 'Gain 7 shield points', flavor: 'Blessed by the light above', combo: 'holy' },
    { id: 19, name: 'Shadow Cloak',     type: 'defend', cost: 2, power: 5,  color: '#636',  desc: 'Gain 5 shield points', flavor: 'Darkness wraps like armor', combo: 'shadow' },
    { id: 20, name: 'Arcane Ward',      type: 'defend', cost: 4, power: 10, color: '#c8f',  desc: 'Gain 10 shield points', flavor: 'Impervious magic barrier', combo: 'arcane' },
    { id: 21, name: 'Iron Skin',        type: 'defend', cost: 1, power: 3,  color: '#999',  desc: 'Gain 3 shield points', flavor: 'Flesh hardens to iron', combo: 'nature' },
    { id: 22, name: 'Mirror Image',     type: 'defend', cost: 3, power: 6,  color: '#aaf',  desc: 'Gain 6 shield points', flavor: 'Illusions absorb the blow', combo: 'arcane' },
    { id: 23, name: 'Flame Wall',       type: 'defend', cost: 2, power: 5,  color: '#f84',  desc: 'Gain 5 shield points', flavor: 'A curtain of searing flame', combo: 'fire' },
    { id: 24, name: 'Wind Barrier',     type: 'defend', cost: 2, power: 4,  color: '#8e8',  desc: 'Gain 4 shield points', flavor: 'Gusts deflect incoming blows', combo: 'storm' },
    { id: 25, name: 'Dragon Scale',     type: 'defend', cost: 5, power: 14, color: '#a80',  desc: 'Gain 14 shield points', flavor: 'Nigh impenetrable dragon hide', combo: 'fire' },

    // ── Heal cards (10) ──
    { id: 26, name: 'Minor Heal',       type: 'heal', cost: 1, power: 3,  color: '#4f4',  desc: 'Restore 3 HP', flavor: 'A warm glow soothes wounds', combo: 'holy' },
    { id: 27, name: 'Greater Heal',     type: 'heal', cost: 3, power: 8,  color: '#6f6',  desc: 'Restore 8 HP', flavor: 'Radiant light mends the body', combo: 'holy' },
    { id: 28, name: 'Nature Mend',      type: 'heal', cost: 2, power: 5,  color: '#4a4',  desc: 'Restore 5 HP', flavor: 'Vines stitch flesh together', combo: 'nature' },
    { id: 29, name: 'Blood Pact',       type: 'heal', cost: 4, power: 10, color: '#a22',  desc: 'Restore 10 HP', flavor: 'Dark bargain, great reward', combo: 'shadow' },
    { id: 30, name: 'Regeneration',     type: 'heal', cost: 2, power: 4,  color: '#6e6',  desc: 'Restore 4 HP', flavor: 'Cells knit back together', combo: 'nature' },
    { id: 31, name: 'Frost Salve',      type: 'heal', cost: 2, power: 5,  color: '#6df',  desc: 'Restore 5 HP', flavor: 'Cooling balm eases the pain', combo: 'frost' },
    { id: 32, name: 'Arcane Restore',   type: 'heal', cost: 3, power: 7,  color: '#b8f',  desc: 'Restore 7 HP', flavor: 'Magic flows where blood once ran', combo: 'arcane' },
    { id: 33, name: 'Phoenix Tear',     type: 'heal', cost: 5, power: 15, color: '#f84',  desc: 'Restore 15 HP', flavor: 'A single tear defies death', combo: 'fire' },
    { id: 34, name: 'Spirit Touch',     type: 'heal', cost: 1, power: 2,  color: '#8af',  desc: 'Restore 2 HP', flavor: 'A gentle spirit soothes you', combo: 'holy' },
    { id: 35, name: 'Tidal Wave',       type: 'heal', cost: 3, power: 6,  color: '#48f',  desc: 'Restore 6 HP', flavor: 'Cleansing waters wash over you', combo: 'storm' },

    // ── Buff cards (10) ──
    { id: 36, name: 'Battle Cry',       type: 'buff', cost: 2, power: 3,  color: '#fa4',  desc: '+1 ATK and +1 DEF buff', flavor: 'Your war cry inspires fury', combo: 'fire' },
    { id: 37, name: 'Empower',          type: 'buff', cost: 3, power: 5,  color: '#ff6',  desc: '+2 ATK and +2 DEF buff', flavor: 'Arcane strength surges within', combo: 'arcane' },
    { id: 38, name: 'Fortify',          type: 'buff', cost: 2, power: 4,  color: '#aaa',  desc: '+2 ATK and +2 DEF buff', flavor: 'Brace yourself for the storm', combo: 'nature' },
    { id: 39, name: 'Mana Surge',       type: 'buff', cost: 1, power: 2,  color: '#48f',  desc: 'Gain +2 mana this turn', flavor: 'Energy wells up from within', combo: 'arcane' },
    { id: 40, name: 'Swift Feet',       type: 'buff', cost: 2, power: 1,  color: '#8f8',  desc: 'Draw 1 extra card', flavor: 'Quick hands seize opportunity', combo: 'storm' },
    { id: 41, name: 'Flame Aura',       type: 'buff', cost: 3, power: 4,  color: '#f64',  desc: '+2 ATK and +2 DEF buff', flavor: 'Fire dances around your fists', combo: 'fire' },
    { id: 42, name: 'Frost Armor',      type: 'buff', cost: 3, power: 4,  color: '#8ef',  desc: '+2 ATK and +2 DEF buff', flavor: 'Ice encases you like plate mail', combo: 'frost' },
    { id: 43, name: 'Shadow Step',      type: 'buff', cost: 2, power: 2,  color: '#606',  desc: '+1 ATK and +1 DEF buff', flavor: 'Phase through the shadows', combo: 'shadow' },
    { id: 44, name: 'Holy Blessing',    type: 'buff', cost: 4, power: 6,  color: '#fe6',  desc: '+3 ATK and +3 DEF buff', flavor: 'The heavens smile upon you', combo: 'holy' },
    { id: 45, name: 'Berserker Rage',   type: 'buff', cost: 3, power: 7,  color: '#f44',  desc: '+3 ATK and +3 DEF buff', flavor: 'Rage turns pain into power', combo: 'fire' },

    // ── Debuff cards (10) ──
    { id: 46, name: 'Weaken',           type: 'debuff', cost: 2, power: 3,  color: '#a66',  desc: 'Remove 3 enemy ATK/DEF buffs', flavor: 'Saps the strength from limbs', combo: 'shadow' },
    { id: 47, name: 'Curse',            type: 'debuff', cost: 3, power: 5,  color: '#808',  desc: 'Remove 5 enemy ATK/DEF buffs', flavor: 'A hex that rots all power', combo: 'shadow' },
    { id: 48, name: 'Slow',             type: 'debuff', cost: 1, power: 2,  color: '#68a',  desc: 'Remove 2 enemy ATK/DEF buffs', flavor: 'Time crawls for your foe', combo: 'frost' },
    { id: 49, name: 'Silence',          type: 'debuff', cost: 3, power: 4,  color: '#aaa',  desc: 'Remove 4 enemy ATK/DEF buffs', flavor: 'Not a word, not a spell', combo: 'arcane' },
    { id: 50, name: 'Poison Cloud',     type: 'debuff', cost: 2, power: 3,  color: '#080',  desc: 'Remove 3 enemy ATK/DEF buffs', flavor: 'Toxic fumes choke the air', combo: 'nature' },
    { id: 51, name: 'Hex',              type: 'debuff', cost: 4, power: 6,  color: '#606',  desc: 'Remove 6 enemy ATK/DEF buffs', flavor: 'Twisted magic undoes all', combo: 'shadow' },
    { id: 52, name: 'Frostbite',        type: 'debuff', cost: 2, power: 3,  color: '#6cf',  desc: 'Remove 3 enemy ATK/DEF buffs', flavor: 'Bitter cold numbs the senses', combo: 'frost' },
    { id: 53, name: 'Disarm',           type: 'debuff', cost: 3, power: 5,  color: '#a86',  desc: 'Remove 5 enemy ATK/DEF buffs', flavor: 'Strip away their weapons', combo: 'nature' },
    { id: 54, name: 'Mind Fog',         type: 'debuff', cost: 2, power: 2,  color: '#a8f',  desc: 'Remove 2 enemy ATK/DEF buffs', flavor: 'Thoughts scatter like smoke', combo: 'arcane' },
    { id: 55, name: 'Chain Lightning',  type: 'debuff', cost: 5, power: 8,  color: '#ff4',  desc: 'Remove 8 enemy ATK/DEF buffs', flavor: 'Arcing bolts sap all might', combo: 'storm' }
  ];
  Object.assign(NS.tables, {
    TYPE_ICONS, TYPE_COLORS, COMBO_ICONS, ALL_CARDS
  });
})();
