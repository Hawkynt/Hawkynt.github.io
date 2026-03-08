;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ── Expand 3-digit hex (#rgb) to 6-digit (#rrggbb) before appending alpha hex digits ── */
  const _hexAlpha = (hex, alpha) => {
    const h = hex.replace(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/, '#$1$1$2$2$3$3');
    return h + alpha;
  };

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 800;
  const CANVAS_H = 560;
  const MAX_DT = 0.05;
  const DECK_SIZE = 30;
  const HAND_LIMIT = 7;
  const STARTING_HP = 50;
  const MAX_MANA = 10;

  /* ── Game states ── */
  const STATE_MENU = 'MENU';
  const STATE_DECK_BUILD = 'DECK_BUILD';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_GAME_OVER = 'GAME_OVER';
  const STATE_VICTORY = 'VICTORY';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-fantasy-cards';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 10;

  /* ── AI difficulty ── */
  const DIFF_EASY = 'easy';
  const DIFF_NORMAL = 'normal';
  const DIFF_HARD = 'hard';

  /* ══════════════════════════════════════════════════════════════════
     CARD COLLECTION — 55 unique cards
     Types: attack, defend, heal, buff, debuff
     ══════════════════════════════════════════════════════════════════ */

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

  /* ══════════════════════════════════════════════════════════════════
     CANVAS & DOM
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const User32 = SZ.Dlls?.User32;

  /* ── Visual effects from shared library ── */
  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = STATE_MENU;
  let difficulty = DIFF_NORMAL;
  let turnNumber = 0;
  let isPlayerTurn = true;
  let lastTimestamp = 0;

  // Player state
  let playerHP, playerMaxHP, playerShield, playerMana, playerMaxMana;
  let playerDeck, playerHand, playerDiscard;
  let playerDamageBuff, playerShieldBuff, playerPoison;

  // AI state
  let aiHP, aiMaxHP, aiShield, aiMana, aiMaxMana;
  let aiDeck, aiHand, aiDiscard;
  let aiDamageBuff, aiShieldBuff, aiPoison;

  // Deck builder
  let selectedDeck = [];

  // Animations
  let cardAnimations = [];
  let manaShimmerTimer = 0;
  let hoveredCard = -1;
  let hoveredDeckCard = -1;
  let mouseX = 0, mouseY = 0;
  let aiPlayTimer = 0;
  let turnTransition = 0;
  let turnTransitionText = '';
  let showHelpOnMenu = false;

  // High scores
  let highScores = [];

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = CANVAS_W + 'px';
    canvas.style.height = CANVAS_H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════════
     DECK & HAND MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; --i) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildDefaultDeck() {
    const deck = [];
    const picks = ALL_CARDS.slice(0, DECK_SIZE);
    for (const card of picks)
      deck.push({ ...card });
    return deck;
  }

  function drawFromDeck(deck, hand, discard) {
    if (deck.length === 0 && discard.length > 0) {
      // Reshuffle discard into deck when empty
      while (discard.length > 0)
        deck.push(discard.pop());
      shuffle(deck);
    }
    if (deck.length === 0 || hand.length >= HAND_LIMIT)
      return null;
    const card = deck.pop();
    hand.push(card);

    // Card draw animation
    const targetX = getCardX(hand.length - 1, hand.length);
    const targetY = isPlayerTurn ? 420 : -80;
    cardAnimations.push({
      card,
      fromX: CANVAS_W / 2, fromY: 0,
      toX: targetX, toY: isPlayerTurn ? 420 : 100,
      t: 0, duration: 0.4,
      type: 'drawAnim'
    });

    return card;
  }

  function getCardX(index, handSize) {
    const totalWidth = handSize * 90;
    const startX = (CANVAS_W - totalWidth) / 2;
    return startX + index * 90 + 45;
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME INIT
     ══════════════════════════════════════════════════════════════════ */

  function startNewGame() {
    turnNumber = 1;
    isPlayerTurn = true;

    playerMaxHP = STARTING_HP;
    playerHP = playerMaxHP;
    playerShield = 0;
    playerMaxMana = 3;
    playerMana = playerMaxMana;
    playerDamageBuff = 0;
    playerShieldBuff = 0;
    playerPoison = 0;

    aiMaxHP = STARTING_HP;
    aiHP = aiMaxHP;
    aiShield = 0;
    aiMaxMana = 3;
    aiMana = aiMaxMana;
    aiDamageBuff = 0;
    aiShieldBuff = 0;
    aiPoison = 0;

    // Build decks
    if (selectedDeck.length === DECK_SIZE) {
      playerDeck = shuffle(selectedDeck.map(id => ({ ...ALL_CARDS.find(c => c.id === id) })));
    } else {
      playerDeck = shuffle(buildDefaultDeck());
    }
    playerHand = [];
    playerDiscard = [];

    aiDeck = shuffle(buildDefaultDeck());
    aiHand = [];
    aiDiscard = [];

    cardAnimations = [];

    // Draw starting hand (5 cards each)
    for (let i = 0; i < 5; ++i) {
      drawFromDeck(playerDeck, playerHand, playerDiscard);
      drawFromDeck(aiDeck, aiHand, aiDiscard);
    }

    state = STATE_PLAYING;
    aiPlayTimer = 0;
    turnTransition = 0;
    updateWindowTitle();
    updateStatusBar();
  }

  /* ══════════════════════════════════════════════════════════════════
     CARD PLAY LOGIC
     ══════════════════════════════════════════════════════════════════ */

  function canPlayCard(card, mana) {
    return card.cost <= mana;
  }

  function playCard(cardIndex) {
    if (!isPlayerTurn || state !== STATE_PLAYING)
      return;

    const card = playerHand[cardIndex];
    if (!card || playerMana < card.cost)
      return;

    playerMana -= card.cost;
    playerHand.splice(cardIndex, 1);
    applyCardEffect(card, true);
    playerDiscard.push(card);

    // Mana shimmer effect
    manaShimmerTimer = 0.5;
    particles.sparkle(100, CANVAS_H - 30, 8, { color: '#48f', speed: 2 });

    // Card play glow animation
    const cx = getCardX(cardIndex, playerHand.length + 1);
    particles.sparkle(cx, 420, 15, { color: card.color, speed: 3 });

    // Check victory/defeat
    checkGameEnd();
    updateStatusBar();
  }

  function applyCardEffect(card, isPlayer) {
    const targetHP = isPlayer ? 'aiHP' : 'playerHP';
    const targetShield = isPlayer ? 'aiShield' : 'playerShield';
    const selfHP = isPlayer ? 'playerHP' : 'aiHP';
    const selfShield = isPlayer ? 'playerShield' : 'aiShield';
    const damageBuff = isPlayer ? playerDamageBuff : aiDamageBuff;

    // Check combo synergy bonus
    const comboBonus = checkCombo(card, isPlayer);
    const totalPower = card.power + comboBonus;

    const targetY = isPlayer ? 80 : 440;
    const selfY = isPlayer ? 440 : 80;

    switch (card.type) {
      case 'attack': {
        const rawDamage = totalPower + damageBuff;
        let damage = rawDamage;
        const oShield = isPlayer ? aiShield : playerShield;
        if (oShield > 0) {
          const absorbed = Math.min(oShield, damage);
          if (isPlayer)
            aiShield -= absorbed;
          else
            playerShield -= absorbed;
          damage -= absorbed;
        }
        if (damage > 0) {
          if (isPlayer)
            aiHP -= damage;
          else
            playerHP -= damage;
        }

        // Burst particles on damage
        particles.burst(CANVAS_W / 2, targetY, 20, { color: card.color, speed: 4 });
        floatingText.add(CANVAS_W / 2, targetY - 20, `-${rawDamage}`, { color: '#f44', font: 'bold 16px sans-serif' });

        // Screen shake for big damage
        if (rawDamage >= 10)
          screenShake.trigger(6, 300);
        break;
      }
      case 'defend': {
        const shieldAmount = totalPower + (isPlayer ? playerShieldBuff : aiShieldBuff);
        if (isPlayer)
          playerShield += shieldAmount;
        else
          aiShield += shieldAmount;

        particles.sparkle(CANVAS_W / 2, selfY, 12, { color: '#8af', speed: 2 });
        floatingText.add(CANVAS_W / 2, selfY - 20, `+${shieldAmount} Shield`, { color: '#8af', font: 'bold 14px sans-serif' });
        break;
      }
      case 'heal': {
        const healAmount = totalPower;
        if (isPlayer)
          playerHP = Math.min(playerMaxHP, playerHP + healAmount);
        else
          aiHP = Math.min(aiMaxHP, aiHP + healAmount);

        particles.sparkle(CANVAS_W / 2, selfY, 12, { color: '#4f4', speed: 2 });
        floatingText.add(CANVAS_W / 2, selfY - 20, `+${healAmount} HP`, { color: '#4f4', font: 'bold 14px sans-serif' });
        break;
      }
      case 'buff': {
        if (card.name === 'Mana Surge') {
          if (isPlayer)
            playerMana += totalPower;
          else
            aiMana += totalPower;
          particles.sparkle(100, selfY, 10, { color: '#48f', speed: 2 });
          floatingText.add(CANVAS_W / 2, selfY - 20, `+${totalPower} Mana`, { color: '#48f', font: 'bold 14px sans-serif' });
        } else if (card.name === 'Swift Feet') {
          drawFromDeck(isPlayer ? playerDeck : aiDeck, isPlayer ? playerHand : aiHand, isPlayer ? playerDiscard : aiDiscard);
          floatingText.add(CANVAS_W / 2, selfY - 20, '+1 Card', { color: '#8f8', font: 'bold 14px sans-serif' });
        } else {
          if (isPlayer) {
            playerDamageBuff += Math.floor(totalPower / 2);
            playerShieldBuff += Math.floor(totalPower / 2);
          } else {
            aiDamageBuff += Math.floor(totalPower / 2);
            aiShieldBuff += Math.floor(totalPower / 2);
          }
          particles.sparkle(CANVAS_W / 2, selfY, 10, { color: '#fa4', speed: 2 });
          floatingText.add(CANVAS_W / 2, selfY - 20, `Buffed +${Math.floor(totalPower / 2)}`, { color: '#fa4', font: 'bold 14px sans-serif' });
        }
        break;
      }
      case 'debuff': {
        if (isPlayer) {
          aiDamageBuff = Math.max(0, aiDamageBuff - totalPower);
          aiShieldBuff = Math.max(0, aiShieldBuff - totalPower);
        } else {
          playerDamageBuff = Math.max(0, playerDamageBuff - totalPower);
          playerShieldBuff = Math.max(0, playerShieldBuff - totalPower);
        }
        particles.burst(CANVAS_W / 2, targetY, 15, { color: '#808', speed: 3 });
        floatingText.add(CANVAS_W / 2, targetY - 20, `Debuff -${totalPower}`, { color: '#a66', font: 'bold 14px sans-serif' });
        break;
      }
    }
  }

  function checkCombo(card, isPlayer) {
    const hand = isPlayer ? playerHand : aiHand;
    const discard = isPlayer ? playerDiscard : aiDiscard;
    let synergy = 0;
    // Check if another card of same combo type was played this turn (in discard)
    for (const d of discard) {
      if (d.combo === card.combo && d.id !== card.id) {
        ++synergy;
        break;
      }
    }
    return synergy > 0 ? 2 : 0;
  }

  function checkGameEnd() {
    if (aiHP <= 0) {
      state = STATE_VICTORY;
      particles.burst(CANVAS_W / 2, CANVAS_H / 2, 50, { color: '#ff0', speed: 5 });
      screenShake.trigger(8, 400);
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'VICTORY!', { color: '#ff0', font: 'bold 28px sans-serif' });
      saveHighScore();
      updateWindowTitle();
    } else if (playerHP <= 0) {
      state = STATE_GAME_OVER;
      screenShake.trigger(10, 500);
      floatingText.add(CANVAS_W / 2, CANVAS_H / 2, 'DEFEAT', { color: '#f44', font: 'bold 28px sans-serif' });
      updateWindowTitle();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     TURN SYSTEM
     ══════════════════════════════════════════════════════════════════ */

  function endTurn() {
    if (state !== STATE_PLAYING)
      return;
    if (isPlayerTurn) {
      // Apply poison
      if (playerPoison > 0) {
        playerHP -= playerPoison;
        --playerPoison;
      }
      isPlayerTurn = false;
      aiPlayTimer = 0.8;
      turnTransition = 1.0;
      turnTransitionText = 'Opponent Turn';
      startAiTurn();
    }
  }

  function startAiTurn() {
    ++turnNumber;
    // Mana regen — AI maxMana grows like player's
    if (aiMaxMana < MAX_MANA)
      ++aiMaxMana;
    aiMana = aiMaxMana;

    // AI draws a card
    drawFromDeck(aiDeck, aiHand, aiDiscard);
    updateStatusBar();
  }

  function startPlayerTurn() {
    isPlayerTurn = true;
    ++turnNumber;

    if (playerMaxMana < MAX_MANA)
      ++playerMaxMana;
    playerMana = playerMaxMana;

    // Apply poison
    if (aiPoison > 0) {
      aiHP -= aiPoison;
      --aiPoison;
    }

    // Draw a card
    drawFromDeck(playerDeck, playerHand, playerDiscard);

    turnTransition = 1.0;
    turnTransitionText = 'Your Turn';
    updateStatusBar();
    checkGameEnd();
  }

  /* ══════════════════════════════════════════════════════════════════
     AI LOGIC — 3 difficulty levels
     ══════════════════════════════════════════════════════════════════ */

  function aiTakeTurn(dt) {
    if (state !== STATE_PLAYING || isPlayerTurn)
      return;

    aiPlayTimer -= dt;
    if (aiPlayTimer > 0)
      return;

    // Find playable cards
    const playable = [];
    for (let i = 0; i < aiHand.length; ++i) {
      if (aiMana >= aiHand[i].cost)
        playable.push(i);
    }

    if (playable.length === 0) {
      // No playable cards, end AI turn
      startPlayerTurn();
      return;
    }

    let chosenIdx;
    if (difficulty === DIFF_EASY) {
      // Easy: random card
      chosenIdx = playable[Math.floor(Math.random() * playable.length)];
    } else if (difficulty === DIFF_NORMAL) {
      // Normal: prioritize by type based on situation
      chosenIdx = aiEvaluateNormal(playable);
    } else {
      // Hard: strategic scoring with weights
      chosenIdx = aiEvaluateHard(playable);
    }

    const card = aiHand[chosenIdx];
    aiMana -= card.cost;
    aiHand.splice(chosenIdx, 1);
    applyCardEffect(card, false);
    aiDiscard.push(card);

    // Mana shimmer for AI
    manaShimmerTimer = 0.3;

    // Card play glow
    particles.sparkle(CANVAS_W / 2, 100, 12, { color: card.color, speed: 3 });

    checkGameEnd();
    updateStatusBar();

    if (state === STATE_PLAYING) {
      // AI might play more cards
      const morePlayable = aiHand.filter(c => c.cost <= aiMana);
      if (morePlayable.length > 0 && Math.random() < 0.6) {
        aiPlayTimer = 0.6;
      } else {
        // End AI turn
        aiPlayTimer = 0.5;
        setTimeout(() => {
          if (state === STATE_PLAYING)
            startPlayerTurn();
        }, 500);
      }
    }
  }

  function aiEvaluateNormal(playable) {
    // Prioritize: heal if low HP, attack if enemy low, defend if no shield
    const scores = playable.map(i => {
      const card = aiHand[i];
      let score = card.power;
      if (card.type === 'heal' && aiHP < aiMaxHP * 0.4)
        score += 10;
      if (card.type === 'attack' && playerHP < playerMaxHP * 0.3)
        score += 8;
      if (card.type === 'defend' && aiShield < 5)
        score += 5;
      return { idx: i, score };
    });
    scores.sort((a, b) => b.score - a.score);
    return scores[0].idx;
  }

  function aiEvaluateHard(playable) {
    // Strategic: evaluate each card considering all factors
    const scores = playable.map(i => {
      const card = aiHand[i];
      let weight = card.power * 2;

      // Health awareness
      if (card.type === 'heal') {
        const hpRatio = aiHP / aiMaxHP;
        weight += hpRatio < 0.3 ? 25 : hpRatio < 0.5 ? 15 : 3;
      }
      if (card.type === 'attack') {
        const enemyRatio = playerHP / playerMaxHP;
        weight += enemyRatio < 0.2 ? 20 : 10;
        // Account for shield piercing
        if (playerShield > 0 && card.power > playerShield)
          weight += 5;
      }
      if (card.type === 'defend') {
        weight += aiShield < 3 ? 12 : 4;
      }
      if (card.type === 'buff') {
        weight += turnNumber < 5 ? 10 : 5;
      }
      if (card.type === 'debuff') {
        weight += playerDamageBuff > 3 ? 15 : 6;
      }

      // Combo synergy seeking
      const hasCombo = aiHand.some(c => c.combo === card.combo && c.id !== card.id);
      if (hasCombo)
        weight += 8;

      // Mana efficiency
      weight += (card.power / Math.max(1, card.cost)) * 3;

      return { idx: i, weight };
    });
    scores.sort((a, b) => b.weight - a.weight);
    return scores[0].idx;
  }

  /* ══════════════════════════════════════════════════════════════════
     DECK BUILDER
     ══════════════════════════════════════════════════════════════════ */

  function toggleDeckBuilder() {
    if (state === STATE_DECK_BUILD) {
      state = STATE_MENU;
    } else {
      state = STATE_DECK_BUILD;
      if (selectedDeck.length === 0)
        selectedDeck = ALL_CARDS.slice(0, DECK_SIZE).map(c => c.id);
    }
  }

  function addCardToDeck(cardId) {
    if (selectedDeck.length >= DECK_SIZE)
      return;
    selectedDeck.push(cardId);
  }

  function removeCardFromDeck(index) {
    selectedDeck.splice(index, 1);
  }

  /* ══════════════════════════════════════════════════════════════════
     PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function loadHighScores() {
    try {
      const data = localStorage.getItem(STORAGE_HIGHSCORES);
      if (data)
        highScores = JSON.parse(data);
    } catch { /* ignore */ }
  }

  function saveHighScores() {
    try {
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(highScores));
    } catch { /* ignore */ }
  }

  function saveHighScore() {
    const entry = {
      difficulty,
      turns: turnNumber,
      hpRemaining: playerHP,
      date: Date.now()
    };
    highScores.push(entry);
    highScores.sort((a, b) => b.hpRemaining - a.hpRemaining);
    if (highScores.length > MAX_HIGH_SCORES)
      highScores.length = MAX_HIGH_SCORES;
    saveHighScores();
  }

  function renderHighScores() {
    const body = document.getElementById('highScoresBody');
    if (!body) return;
    body.innerHTML = highScores.map((s, i) =>
      `<tr><td>${i + 1}</td><td>${s.difficulty}</td><td>${s.turns} turns</td></tr>`
    ).join('');
  }

  /* ══════════════════════════════════════════════════════════════════
     RENDERING
     ══════════════════════════════════════════════════════════════════ */

  function drawBackground() {
    // Gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, '#120a1e');
    bgGrad.addColorStop(0.45, '#1a1024');
    bgGrad.addColorStop(0.55, '#1a1024');
    bgGrad.addColorStop(1, '#0a1218');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Subtle grid pattern
    ctx.strokeStyle = '#ffffff06';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx < CANVAS_W; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, CANVAS_H);
      ctx.stroke();
    }
    for (let gy = 0; gy < CANVAS_H; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(CANVAS_W, gy);
      ctx.stroke();
    }

    // Play field divider with glow
    const divY = CANVAS_H / 2;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, divY);
    ctx.lineTo(CANVAS_W, divY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Turn number display
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Turn ' + turnNumber, CANVAS_W - 10, divY - 5);

    // Player/opponent labels
    ctx.fillStyle = '#555';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('OPPONENT', 10, 8 + 10);
    ctx.fillText('YOU', 10, CANVAS_H - 32 + 10);
  }

  function drawBuffIndicators() {
    // Player buffs
    let bx = 160;
    const pBufY = CANVAS_H - 50;
    if (playerDamageBuff > 0) {
      ctx.fillStyle = '#fa4';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u2694+' + playerDamageBuff, bx, pBufY + 10);
      bx += 40;
    }
    if (playerShieldBuff > 0) {
      ctx.fillStyle = '#8af';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u{1F6E1}+' + playerShieldBuff, bx, pBufY + 10);
      bx += 40;
    }
    if (playerPoison > 0) {
      ctx.fillStyle = '#0a0';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u2620' + playerPoison, bx, pBufY + 10);
    }

    // AI buffs
    let ax = CANVAS_W / 2 + 110;
    const aBufY = 10;
    if (aiDamageBuff > 0) {
      ctx.fillStyle = '#f88';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u2694+' + aiDamageBuff, ax, aBufY + 10);
      ax += 40;
    }
    if (aiShieldBuff > 0) {
      ctx.fillStyle = '#8af';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u{1F6E1}+' + aiShieldBuff, ax, aBufY + 10);
      ax += 40;
    }
    if (aiPoison > 0) {
      ctx.fillStyle = '#0a0';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('\u2620' + aiPoison, ax, aBufY + 10);
    }
  }

  function drawHealthBar(x, y, hp, maxHP, shield, color, label) {
    const barW = 200;
    const barH = 16;

    // Background
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, barW, barH);

    // Health portion
    const hpRatio = Math.max(0, hp / maxHP);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW * hpRatio, barH);

    // Shield overlay
    if (shield > 0) {
      const shieldRatio = Math.min(1, shield / maxHP);
      ctx.fillStyle = 'rgba(100,160,255,0.4)';
      ctx.fillRect(x, y, barW * shieldRatio, barH);
    }

    // Border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barW, barH);

    // Text
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${label}: ${hp}/${maxHP}` + (shield > 0 ? ` (+${shield})` : ''), x + 4, y + 12);
  }

  function drawManaBar(x, y, mana, maxMana) {
    const barW = 120;
    const barH = 14;

    ctx.fillStyle = '#111';
    ctx.fillRect(x, y, barW, barH);

    const manaRatio = mana / Math.max(1, maxMana);
    ctx.fillStyle = '#38f';
    ctx.fillRect(x, y, barW * manaRatio, barH);

    // Mana shimmer glow effect when active
    if (manaShimmerTimer > 0) {
      ctx.fillStyle = `rgba(80,150,255,${manaShimmerTimer})`;
      ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);
    }

    ctx.strokeStyle = '#448';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barW, barH);

    // Mana text display
    ctx.fillStyle = '#adf';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Mana: ${mana}/${maxMana}`, x + 4, y + 11);
  }

  function roundRect(cx, x, y, w, h, r) {
    cx.beginPath();
    cx.moveTo(x + r, y);
    cx.lineTo(x + w - r, y);
    cx.quadraticCurveTo(x + w, y, x + w, y + r);
    cx.lineTo(x + w, y + h - r);
    cx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    cx.lineTo(x + r, y + h);
    cx.quadraticCurveTo(x, y + h, x, y + h - r);
    cx.lineTo(x, y + r);
    cx.quadraticCurveTo(x, y, x + r, y);
    cx.closePath();
  }

  function drawCardArt(cardObj, cx, artX, artY, artW, artH) {
    const tc = TYPE_COLORS[cardObj.type];
    const cc = COMBO_ICONS[cardObj.combo];

    // Art area background gradient
    const artGrad = ctx.createLinearGradient(artX, artY, artX, artY + artH);
    artGrad.addColorStop(0, tc.grad1);
    artGrad.addColorStop(1, _hexAlpha(cardObj.color, '30'));
    ctx.fillStyle = artGrad;
    ctx.fillRect(artX, artY, artW, artH);

    // Central illustration -- large type icon
    const iconInfo = TYPE_ICONS[cardObj.type];
    ctx.fillStyle = _hexAlpha(cardObj.color, '60');
    ctx.font = Math.floor(artH * 0.6) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(iconInfo.symbol, artX + artW / 2, artY + artH * 0.45);

    // Combo element icon smaller in corner
    if (cc) {
      ctx.fillStyle = _hexAlpha(cc.color, '80');
      ctx.font = Math.floor(artH * 0.25) + 'px sans-serif';
      ctx.fillText(cc.symbol, artX + artW - 10, artY + artH - 8);
    }

    // Decorative border around art
    ctx.strokeStyle = _hexAlpha(cardObj.color, '50');
    ctx.lineWidth = 1;
    ctx.strokeRect(artX, artY, artW, artH);

    ctx.textBaseline = 'alphabetic';
  }

  function drawCard(cardObj, x, y, w, h, faceUp, hovered) {
    const left = x - w / 2;
    const top = y - h / 2;
    const r = 5;
    const tc = TYPE_COLORS[cardObj.type] || TYPE_COLORS.attack;

    // Hover glow
    if (hovered) {
      ctx.shadowColor = cardObj.color || '#fff';
      ctx.shadowBlur = 16;
    }

    // Card body
    roundRect(ctx, left, top, w, h, r);
    if (faceUp) {
      const grad = ctx.createLinearGradient(left, top, left, top + h);
      grad.addColorStop(0, tc.grad1);
      grad.addColorStop(0.5, tc.bg);
      grad.addColorStop(1, tc.grad2);
      ctx.fillStyle = grad;
    } else {
      // Card back pattern
      const grad = ctx.createLinearGradient(left, top, left + w, top + h);
      grad.addColorStop(0, '#2a1a3e');
      grad.addColorStop(0.5, '#1a1030');
      grad.addColorStop(1, '#2a1a3e');
      ctx.fillStyle = grad;
    }
    ctx.fill();

    // Border
    ctx.strokeStyle = faceUp ? tc.border : '#555';
    ctx.lineWidth = hovered ? 2.5 : 1.5;
    roundRect(ctx, left, top, w, h, r);
    ctx.stroke();

    ctx.shadowBlur = 0;

    if (!faceUp) {
      // Card back design
      const cx = left + w / 2;
      const cy = top + h / 2;
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.5;
      roundRect(ctx, left + 4, top + 4, w - 8, h - 8, 3);
      ctx.stroke();
      ctx.fillStyle = '#a6f';
      ctx.font = Math.floor(h * 0.25) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u2735', cx, cy + Math.floor(h * 0.08));
      return;
    }

    // Inner frame
    ctx.strokeStyle = tc.border + '30';
    ctx.lineWidth = 0.5;
    roundRect(ctx, left + 2, top + 2, w - 4, h - 4, 4);
    ctx.stroke();

    // ── Art area ──
    const artMargin = 4;
    const artTop = top + 22;
    const artH = h * 0.32;
    drawCardArt(cardObj, ctx, left + artMargin, artTop, w - artMargin * 2, artH);

    // ── Mana cost badge (top-left, blue gem) ──
    const costX = left + 11;
    const costY = top + 11;
    ctx.fillStyle = '#115';
    ctx.beginPath();
    ctx.arc(costX, costY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38f';
    ctx.beginPath();
    ctx.arc(costX, costY, 7.5, 0, Math.PI * 2);
    ctx.fill();
    // Gem highlight
    ctx.fillStyle = '#8cf';
    ctx.beginPath();
    ctx.arc(costX - 2, costY - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cardObj.cost, costX, costY + 3.5);

    // ── Power badge (top-right, colored by type) ──
    const powX = left + w - 11;
    const powY = top + 11;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(powX, powY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tc.badge;
    ctx.beginPath();
    ctx.arc(powX, powY, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(cardObj.power, powX, powY + 3.5);

    // ── Type icon badge (center top) ──
    const typeIcon = TYPE_ICONS[cardObj.type];
    ctx.fillStyle = tc.badge + '40';
    ctx.font = '10px sans-serif';
    ctx.fillText(typeIcon.symbol, x, top + 13);

    // ── Card name ──
    const nameY = artTop + artH + 12;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    const displayName = w < 70 ? truncateText(cardObj.name, w - 10) : cardObj.name;
    ctx.fillText(displayName, x, nameY);

    // ── Type label with color ──
    const typeY = nameY + 11;
    ctx.fillStyle = tc.badge;
    ctx.font = '7px sans-serif';
    ctx.fillText(typeIcon.label + '  \u00b7  ' + cardObj.combo.toUpperCase(), x, typeY);

    // ── Description text ──
    const descY = typeY + 10;
    ctx.fillStyle = '#bbb';
    ctx.font = '7px sans-serif';
    const descText = w < 70 ? truncateText(cardObj.desc, w - 8) : cardObj.desc;
    ctx.fillText(descText, x, descY);

    // ── Playability indicator (dim if not enough mana) ──
    if (isPlayerTurn && state === STATE_PLAYING && cardObj.cost > playerMana) {
      roundRect(ctx, left, top, w, h, r);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.strokeStyle = '#600';
      ctx.lineWidth = 1;
      roundRect(ctx, left, top, w, h, r);
      ctx.stroke();
    }
  }

  function truncateText(text, maxWidth) {
    // Simple character-based truncation for small card widths
    if (ctx.measureText(text).width <= maxWidth)
      return text;
    while (text.length > 3 && ctx.measureText(text + '...').width > maxWidth)
      text = text.slice(0, -1);
    return text + '...';
  }

  function drawPlayerHand() {
    const cardW = 80;
    const cardH = 110;

    for (let i = 0; i < playerHand.length; ++i) {
      const card = playerHand[i];
      const x = getCardX(i, playerHand.length);
      const y = hoveredCard === i ? 405 : 420;
      const hovered = hoveredCard === i;
      drawCard(card, x, y, cardW, cardH, true, hovered);
    }
  }

  function drawAiHand() {
    const cardW = 60;
    const cardH = 80;
    for (let i = 0; i < aiHand.length; ++i) {
      const x = getCardX(i, aiHand.length);
      drawCard(aiHand[i], x, 60, cardW, cardH, false, false);
    }
  }

  function drawTurnIndicator() {
    if (turnTransition > 0) {
      const alpha = Math.min(1, turnTransition * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(turnTransitionText, CANVAS_W / 2, CANVAS_H / 2 - 10);
    }
  }

  function drawEndTurnButton() {
    if (!isPlayerTurn || state !== STATE_PLAYING)
      return;
    const bx = CANVAS_W - 100, by = CANVAS_H / 2 - 20, bw = 80, bh = 30;

    // Check hover
    const btnHovered = mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh;

    if (btnHovered) {
      ctx.shadowColor = '#4f8';
      ctx.shadowBlur = 8;
    }

    const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
    grad.addColorStop(0, btnHovered ? '#3b6' : '#2a5');
    grad.addColorStop(1, btnHovered ? '#1a4' : '#193');
    ctx.fillStyle = grad;
    roundRect(ctx, bx, by, bw, bh, 4);
    ctx.fill();

    ctx.strokeStyle = '#4f8';
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, bw, bh, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('End Turn', bx + bw / 2, by + 17);

    ctx.fillStyle = '#8c8';
    ctx.font = '8px sans-serif';
    ctx.fillText('[E]', bx + bw / 2, by + 27);
  }

  function drawCardTooltip() {
    if (state !== STATE_PLAYING || hoveredCard < 0 || hoveredCard >= playerHand.length)
      return;

    const card = playerHand[hoveredCard];
    const tc = TYPE_COLORS[card.type];
    const typeIcon = TYPE_ICONS[card.type];
    const comboIcon = COMBO_ICONS[card.combo];

    const tw = 210;
    const th = 150;
    const cx = getCardX(hoveredCard, playerHand.length);
    let tx = cx - tw / 2;
    let ty = 240;

    // Keep tooltip on screen
    if (tx < 4) tx = 4;
    if (tx + tw > CANVAS_W - 4) tx = CANVAS_W - tw - 4;

    // Background
    ctx.fillStyle = 'rgba(10,10,24,0.95)';
    roundRect(ctx, tx, ty, tw, th, 6);
    ctx.fill();
    ctx.strokeStyle = tc.border;
    ctx.lineWidth = 2;
    roundRect(ctx, tx, ty, tw, th, 6);
    ctx.stroke();

    // Inner glow line
    ctx.strokeStyle = tc.border + '30';
    ctx.lineWidth = 1;
    roundRect(ctx, tx + 3, ty + 3, tw - 6, th - 6, 4);
    ctx.stroke();

    let row = ty + 20;
    const padL = tx + 12;
    const padR = tx + tw - 12;

    // Card name (large)
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(card.name, padL, row);

    // Type + element on right
    ctx.fillStyle = tc.badge;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(typeIcon.symbol + ' ' + typeIcon.label, padR, row);

    row += 18;

    // Horizontal separator
    ctx.strokeStyle = tc.border + '50';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padL, row);
    ctx.lineTo(padR, row);
    ctx.stroke();

    row += 14;

    // Stats line
    ctx.textAlign = 'left';
    ctx.font = '11px sans-serif';

    // Mana cost
    ctx.fillStyle = '#8cf';
    ctx.fillText('\u{1F48E} Cost: ' + card.cost + ' mana', padL, row);

    // Power
    ctx.fillStyle = tc.badge;
    ctx.textAlign = 'right';
    const powerLabel = card.type === 'attack' ? 'Damage' : card.type === 'defend' ? 'Shield' : card.type === 'heal' ? 'Heal' : 'Power';
    ctx.fillText(typeIcon.symbol + ' ' + powerLabel + ': ' + card.power, padR, row);

    row += 16;

    // Element / combo
    if (comboIcon) {
      ctx.fillStyle = comboIcon.color;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(comboIcon.symbol + ' Element: ' + card.combo.charAt(0).toUpperCase() + card.combo.slice(1), padL, row);
      ctx.fillStyle = '#777';
      ctx.textAlign = 'right';
      ctx.fillText('+2 combo bonus', padR, row);
    }

    row += 16;

    // Description
    ctx.fillStyle = '#ddd';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(card.desc, padL, row);

    row += 14;

    // Flavor text
    if (card.flavor) {
      ctx.fillStyle = '#888';
      ctx.font = 'italic 9px sans-serif';
      ctx.fillText('"' + card.flavor + '"', padL, row);
    }

    row += 14;

    // Playability hint
    if (card.cost > playerMana) {
      ctx.fillStyle = '#f66';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText('Not enough mana! Need ' + (card.cost - playerMana) + ' more.', padL, row);
    } else {
      ctx.fillStyle = '#6f6';
      ctx.font = '9px sans-serif';
      ctx.fillText('Click or press ' + (hoveredCard + 1) + ' to play', padL, row);
    }
  }

  function drawDeckPile() {
    // Stacked card appearance for deck
    const dx = 20, dy = 370;
    const dw = 50, dh = 40;

    // Shadow cards behind
    for (let s = 2; s >= 1; --s) {
      ctx.fillStyle = '#1a1030';
      roundRect(ctx, dx + s * 2, dy - s * 2, dw, dh, 3);
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      roundRect(ctx, dx + s * 2, dy - s * 2, dw, dh, 3);
      ctx.stroke();
    }

    // Top card
    const grad = ctx.createLinearGradient(dx, dy, dx, dy + dh);
    grad.addColorStop(0, '#2a1a3e');
    grad.addColorStop(1, '#1a1030');
    ctx.fillStyle = grad;
    roundRect(ctx, dx, dy, dw, dh, 3);
    ctx.fill();
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    roundRect(ctx, dx, dy, dw, dh, 3);
    ctx.stroke();

    // Arcane symbol on back
    ctx.fillStyle = 'rgba(170,102,255,0.25)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u2735', dx + dw / 2, dy + dh / 2 + 2);

    // Count
    ctx.fillStyle = '#ccc';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(playerDeck.length, dx + dw / 2, dy + dh + 12);

    ctx.fillStyle = '#888';
    ctx.font = '7px sans-serif';
    ctx.fillText('DECK', dx + dw / 2, dy + dh + 22);

    // Discard pile indicator
    const ddx = dx + dw + 10;
    if (playerDiscard.length > 0) {
      ctx.fillStyle = '#1a1020';
      roundRect(ctx, ddx, dy + 8, 35, 30, 2);
      ctx.fill();
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 0.5;
      roundRect(ctx, ddx, dy + 8, 35, 30, 2);
      ctx.stroke();
      ctx.fillStyle = '#888';
      ctx.font = '7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(playerDiscard.length, ddx + 17, dy + 26);
      ctx.fillText('DISCARD', ddx + 17, dy + 50);
    }
  }

  function drawMenuScreen() {
    // Background with subtle gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    bgGrad.addColorStop(0, '#0a0818');
    bgGrad.addColorStop(0.5, '#0a0a18');
    bgGrad.addColorStop(1, '#080612');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Decorative card fan behind title
    const fanCards = [
      { type: 'attack', color: '#f44' },
      { type: 'defend', color: '#48f' },
      { type: 'heal',   color: '#4f4' },
      { type: 'buff',   color: '#fa4' },
      { type: 'debuff', color: '#a66' }
    ];
    ctx.save();
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < fanCards.length; ++i) {
      const angle = (i - 2) * 0.18;
      const fx = CANVAS_W / 2;
      const fy = 90;
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(angle);
      roundRect(ctx, -25, -40, 50, 70, 4);
      ctx.fillStyle = fanCards[i].color;
      ctx.fill();
      ctx.strokeStyle = fanCards[i].color;
      ctx.lineWidth = 1;
      roundRect(ctx, -25, -40, 50, 70, 4);
      ctx.stroke();
      const ti = TYPE_ICONS[fanCards[i].type];
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ti.symbol, 0, 8);
      ctx.restore();
    }
    ctx.restore();

    // Title
    ctx.fillStyle = '#c8f';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Fantasy Cards', CANVAS_W / 2, 120);

    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('Deck-Building Card Battler', CANVAS_W / 2, 148);

    // Difficulty selection
    const diffs = [DIFF_EASY, DIFF_NORMAL, DIFF_HARD];
    const labels = ['Easy', 'Normal', 'Hard'];
    const diffDescs = ['Random AI, forgiving', 'Tactical AI, balanced', 'Strategic AI, ruthless'];
    for (let i = 0; i < 3; ++i) {
      const bx = CANVAS_W / 2 - 75;
      const by = 180 + i * 48;
      const selected = difficulty === diffs[i];

      if (selected) {
        ctx.shadowColor = '#6f8';
        ctx.shadowBlur = 8;
      }
      roundRect(ctx, bx, by, 150, 38, 4);
      ctx.fillStyle = selected ? '#1a3a2a' : '#181828';
      ctx.fill();
      ctx.strokeStyle = selected ? '#6f8' : '#444';
      ctx.lineWidth = selected ? 2 : 1;
      roundRect(ctx, bx, by, 150, 38, 4);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(labels[i], CANVAS_W / 2, by + 17);

      ctx.fillStyle = '#888';
      ctx.font = '9px sans-serif';
      ctx.fillText(diffDescs[i], CANVAS_W / 2, by + 32);
    }

    // Card type reference
    const refY = 340;
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.fillText('Card Types:', CANVAS_W / 2, refY);

    const typeList = ['attack', 'defend', 'heal', 'buff', 'debuff'];
    const typeNames = ['Attack', 'Defend', 'Heal', 'Buff', 'Debuff'];
    const typeBriefs = ['Deal damage', 'Gain shield', 'Restore HP', 'Boost stats', 'Weaken foe'];
    const totalRefW = typeList.length * 140;
    const refStartX = (CANVAS_W - totalRefW) / 2 + 70;

    for (let i = 0; i < typeList.length; ++i) {
      const rx = refStartX + i * 140;
      const ry = refY + 16;
      const tc = TYPE_COLORS[typeList[i]];
      const ti = TYPE_ICONS[typeList[i]];

      ctx.fillStyle = tc.badge;
      ctx.font = '14px sans-serif';
      ctx.fillText(ti.symbol, rx - 18, ry + 4);

      ctx.fillStyle = tc.badge;
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(typeNames[i], rx + 2, ry);

      ctx.fillStyle = '#777';
      ctx.font = '9px sans-serif';
      ctx.fillText(typeBriefs[i], rx + 2, ry + 14);
    }

    // Element icons
    const elemY = refY + 50;
    ctx.fillStyle = '#666';
    ctx.font = '10px sans-serif';
    ctx.fillText('Elements:', CANVAS_W / 2, elemY);

    const elemKeys = Object.keys(COMBO_ICONS);
    const totalElemW = elemKeys.length * 100;
    const elemStartX = (CANVAS_W - totalElemW) / 2 + 50;

    for (let i = 0; i < elemKeys.length; ++i) {
      const key = elemKeys[i];
      const ci = COMBO_ICONS[key];
      const ex = elemStartX + i * 100;
      ctx.fillStyle = ci.color;
      ctx.font = '12px sans-serif';
      ctx.fillText(ci.symbol + ' ' + key.charAt(0).toUpperCase() + key.slice(1), ex, elemY + 16);
    }

    // Start button
    const startBtnX = CANVAS_W / 2 - 75;
    const startBtnY = elemY + 30;
    const startBtnW = 150;
    const startBtnH = 38;
    const startHovered = mouseX >= startBtnX && mouseX <= startBtnX + startBtnW
      && mouseY >= startBtnY && mouseY <= startBtnY + startBtnH;

    if (startHovered) {
      ctx.shadowColor = '#ff0';
      ctx.shadowBlur = 12;
    }
    const startGrad = ctx.createLinearGradient(startBtnX, startBtnY, startBtnX, startBtnY + startBtnH);
    startGrad.addColorStop(0, startHovered ? '#4a3a0a' : '#3a2a08');
    startGrad.addColorStop(1, startHovered ? '#2a1a04' : '#1a1004');
    ctx.fillStyle = startGrad;
    roundRect(ctx, startBtnX, startBtnY, startBtnW, startBtnH, 4);
    ctx.fill();
    ctx.strokeStyle = '#fc0';
    ctx.lineWidth = 2;
    roundRect(ctx, startBtnX, startBtnY, startBtnW, startBtnH, 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ff0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Start Game', CANVAS_W / 2, startBtnY + 22);

    // Instructions
    const instY = startBtnY + startBtnH + 12;
    ctx.fillStyle = '#6a8';
    ctx.font = '11px sans-serif';
    ctx.fillText('D = Deck Builder  |  H = How to Play  |  F2 = Start', CANVAS_W / 2, instY);

    // Combo hint
    ctx.fillStyle = '#555';
    ctx.font = '10px sans-serif';
    ctx.fillText('Play cards of the same element for +2 combo bonus!', CANVAS_W / 2, instY + 20);
  }

  function drawDeckBuilder() {
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Title with deck count indicator
    ctx.fillStyle = '#c8f';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Deck Builder', CANVAS_W / 2 - 50, 26);

    // Count badge
    const countColor = selectedDeck.length === DECK_SIZE ? '#4f4' : selectedDeck.length > DECK_SIZE ? '#f44' : '#fa4';
    ctx.fillStyle = countColor;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${selectedDeck.length}/${DECK_SIZE}`, CANVAS_W / 2 + 60, 26);

    // Type filter legend
    const legendTypes = ['attack', 'defend', 'heal', 'buff', 'debuff'];
    const legendLabels = ['Attack', 'Defend', 'Heal', 'Buff', 'Debuff'];
    for (let i = 0; i < legendTypes.length; ++i) {
      const lx = 60 + i * 155;
      const ly = 38;
      const tc = TYPE_COLORS[legendTypes[i]];
      const icon = TYPE_ICONS[legendTypes[i]];
      ctx.fillStyle = tc.badge;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(icon.symbol + ' ' + legendLabels[i], lx, ly);
    }

    // Card collection grid -- improved with type coloring
    const cols = 8;
    const cardW = 90;
    const cardH = 52;
    const gapX = 6;
    const gapY = 4;
    const startY = 48;

    hoveredDeckCard = -1;

    for (let i = 0; i < ALL_CARDS.length; ++i) {
      const card = ALL_CARDS[i];
      const tc = TYPE_COLORS[card.type];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = 16 + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const inDeck = selectedDeck.includes(card.id);

      // Check hover
      const isHovered = mouseX >= cx && mouseX <= cx + cardW && mouseY >= cy && mouseY <= cy + cardH;
      if (isHovered)
        hoveredDeckCard = i;

      // Card background with type color
      if (isHovered) {
        ctx.shadowColor = tc.border;
        ctx.shadowBlur = 8;
      }

      const grad = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
      grad.addColorStop(0, inDeck ? '#1a3a1a' : tc.grad1);
      grad.addColorStop(1, inDeck ? '#0a2a0a' : tc.grad2);
      ctx.fillStyle = grad;
      roundRect(ctx, cx, cy, cardW, cardH, 3);
      ctx.fill();

      ctx.strokeStyle = inDeck ? '#4f4' : tc.border;
      ctx.lineWidth = isHovered ? 2 : 1;
      roundRect(ctx, cx, cy, cardW, cardH, 3);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // In-deck check mark
      if (inDeck) {
        ctx.fillStyle = '#4f4';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('\u2713', cx + cardW - 4, cy + 13);
      }

      // Mana cost
      ctx.fillStyle = '#38f';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(card.cost + '', cx + 4, cy + 12);

      // Type icon
      const typeIcon = TYPE_ICONS[card.type];
      ctx.fillStyle = tc.badge;
      ctx.font = '9px sans-serif';
      ctx.fillText(typeIcon.symbol, cx + 16, cy + 12);

      // Power
      ctx.fillStyle = tc.badge;
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(card.power + '', cx + cardW - (inDeck ? 16 : 4), cy + 12);

      // Card name
      ctx.fillStyle = '#eee';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.name, cx + cardW / 2, cy + 26);

      // Combo element
      const comboIcon = COMBO_ICONS[card.combo];
      if (comboIcon) {
        ctx.fillStyle = _hexAlpha(comboIcon.color, '90');
        ctx.font = '8px sans-serif';
        ctx.fillText(comboIcon.symbol + ' ' + card.combo, cx + cardW / 2, cy + 38);
      }

      // Brief desc
      ctx.fillStyle = '#777';
      ctx.font = '6px sans-serif';
      ctx.fillText(card.desc, cx + cardW / 2, cy + 48);
    }

    // Hovered card detail panel at bottom
    if (hoveredDeckCard >= 0) {
      const card = ALL_CARDS[hoveredDeckCard];
      const tc = TYPE_COLORS[card.type];
      const typeIcon = TYPE_ICONS[card.type];
      const comboIcon = COMBO_ICONS[card.combo];

      const panelY = CANVAS_H - 52;
      ctx.fillStyle = 'rgba(10,10,24,0.95)';
      ctx.fillRect(0, panelY, CANVAS_W, 52);
      ctx.strokeStyle = tc.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, panelY);
      ctx.lineTo(CANVAS_W, panelY);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(typeIcon.symbol + ' ' + card.name, 12, panelY + 16);

      ctx.fillStyle = tc.badge;
      ctx.font = '11px sans-serif';
      ctx.fillText(typeIcon.label + '  |  Cost: ' + card.cost + '  |  Power: ' + card.power, 12, panelY + 32);

      if (comboIcon) {
        ctx.fillStyle = comboIcon.color;
        ctx.fillText(comboIcon.symbol + ' ' + card.combo.charAt(0).toUpperCase() + card.combo.slice(1) + ' element (+2 combo)', 250, panelY + 32);
      }

      ctx.fillStyle = '#bbb';
      ctx.fillText(card.desc, 12, panelY + 46);

      if (card.flavor) {
        ctx.fillStyle = '#777';
        ctx.font = 'italic 10px sans-serif';
        ctx.fillText('"' + card.flavor + '"', 350, panelY + 46);
      }
    } else {
      ctx.fillStyle = '#555';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click cards to add/remove from deck. Hover for details. Press D to close.', CANVAS_W / 2, CANVAS_H - 12);
    }
  }

  function drawGameOverlay() {
    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(10,0,0,0.7)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Decorative border
      ctx.strokeStyle = '#f44';
      ctx.lineWidth = 2;
      roundRect(ctx, CANVAS_W / 2 - 160, CANVAS_H / 2 - 80, 320, 160, 8);
      ctx.stroke();
      ctx.fillStyle = 'rgba(40,0,0,0.8)';
      roundRect(ctx, CANVAS_W / 2 - 160, CANVAS_H / 2 - 80, 320, 160, 8);
      ctx.fill();

      ctx.fillStyle = '#f44';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DEFEAT', CANVAS_W / 2, CANVAS_H / 2 - 30);

      ctx.fillStyle = '#ccc';
      ctx.font = '13px sans-serif';
      ctx.fillText('Turns survived: ' + turnNumber + '  |  Difficulty: ' + difficulty, CANVAS_W / 2, CANVAS_H / 2 + 5);
      ctx.fillText('Enemy HP remaining: ' + Math.max(0, aiHP) + '/' + aiMaxHP, CANVAS_W / 2, CANVAS_H / 2 + 25);

      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.fillText('Press F2 for new game  |  Esc for menu', CANVAS_W / 2, CANVAS_H / 2 + 60);

    } else if (state === STATE_VICTORY) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 2;
      roundRect(ctx, CANVAS_W / 2 - 160, CANVAS_H / 2 - 80, 320, 160, 8);
      ctx.stroke();
      ctx.fillStyle = 'rgba(30,30,0,0.8)';
      roundRect(ctx, CANVAS_W / 2 - 160, CANVAS_H / 2 - 80, 320, 160, 8);
      ctx.fill();

      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u2726 VICTORY! \u2726', CANVAS_W / 2, CANVAS_H / 2 - 30);

      ctx.fillStyle = '#ccc';
      ctx.font = '13px sans-serif';
      ctx.fillText('Completed in ' + turnNumber + ' turns  |  Difficulty: ' + difficulty, CANVAS_W / 2, CANVAS_H / 2 + 5);
      ctx.fillText('HP remaining: ' + playerHP + '/' + playerMaxHP, CANVAS_W / 2, CANVAS_H / 2 + 25);

      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.fillText('Press F2 for new game  |  Esc for menu', CANVAS_W / 2, CANVAS_H / 2 + 60);

    } else if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      roundRect(ctx, CANVAS_W / 2 - 100, CANVAS_H / 2 - 50, 200, 100, 6);
      ctx.stroke();
      ctx.fillStyle = 'rgba(20,20,30,0.9)';
      roundRect(ctx, CANVAS_W / 2 - 100, CANVAS_H / 2 - 50, 200, 100, 6);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);

      ctx.fillStyle = '#888';
      ctx.font = '11px sans-serif';
      ctx.fillText('Press Esc to resume', CANVAS_W / 2, CANVAS_H / 2 + 28);
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE & GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  function update(dt) {
    // Update animations
    for (let i = cardAnimations.length - 1; i >= 0; --i) {
      const a = cardAnimations[i];
      a.t += dt / a.duration;
      if (a.t >= 1) {
        cardAnimations.splice(i, 1);
      }
    }

    // Mana shimmer timer
    if (manaShimmerTimer > 0)
      manaShimmerTimer -= dt;

    // Turn transition
    if (turnTransition > 0)
      turnTransition -= dt;

    // AI plays
    if (!isPlayerTurn && state === STATE_PLAYING)
      aiTakeTurn(dt);

    // Update effects
    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();
  }

  function render() {
    ctx.save();

    // Apply screen shake
    screenShake.apply(ctx);

    if (state === STATE_MENU) {
      drawMenuScreen();
    } else if (state === STATE_DECK_BUILD) {
      drawDeckBuilder();
    } else {
      drawBackground();

      // Health bars
      drawHealthBar(CANVAS_W / 2 - 100, 10, aiHP, aiMaxHP, aiShield, '#c44', 'Opponent');
      drawHealthBar(CANVAS_W / 2 - 100, CANVAS_H - 30, playerHP, playerMaxHP, playerShield, '#4a4', 'You');

      // Mana bar display
      drawManaBar(20, CANVAS_H - 50, playerMana, playerMaxMana);

      // Buff/debuff indicators
      drawBuffIndicators();

      // Deck pile
      drawDeckPile();

      // AI hand (face down)
      drawAiHand();

      // Player hand
      drawPlayerHand();

      // End turn button
      drawEndTurnButton();

      // Card tooltip
      drawCardTooltip();

      // Turn indicator
      drawTurnIndicator();

      // Overlays
      drawGameOverlay();
    }

    // Draw effects on top
    particles.draw(ctx);
    floatingText.draw(ctx);

    screenShake.restore(ctx);
    ctx.restore();
  }

  function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTimestamp) / 1000, MAX_DT);
    lastTimestamp = timestamp;

    if (state !== STATE_PAUSED)
      update(dt);
    render();

    requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT HANDLING
     ══════════════════════════════════════════════════════════════════ */

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    mouseY = (e.clientY - rect.top) * (CANVAS_H / rect.height);

    if (state === STATE_PLAYING && isPlayerTurn) {
      hoveredCard = -1;
      for (let i = 0; i < playerHand.length; ++i) {
        const cx = getCardX(i, playerHand.length);
        if (Math.abs(mouseX - cx) < 40 && mouseY > 370 && mouseY < 475)
          hoveredCard = i;
      }
    } else {
      hoveredCard = -1;
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (CANVAS_H / rect.height);

    if (state === STATE_MENU) {
      // Difficulty selection — coordinates must match drawMenuScreen()
      const diffs = [DIFF_EASY, DIFF_NORMAL, DIFF_HARD];
      for (let i = 0; i < 3; ++i) {
        const bx = CANVAS_W / 2 - 75;
        const by = 180 + i * 48;
        if (mx >= bx && mx <= bx + 150 && my >= by && my <= by + 38)
          difficulty = diffs[i];
      }

      // Start Game button — coordinates must match drawMenuScreen()
      // refY=340, elemY=refY+50=390, startBtnY=elemY+30=420
      const startBtnX = CANVAS_W / 2 - 75;
      const startBtnY = 420;
      const startBtnW = 150;
      const startBtnH = 38;
      if (mx >= startBtnX && mx <= startBtnX + startBtnW && my >= startBtnY && my <= startBtnY + startBtnH)
        startNewGame();
      return;
    }

    if (state === STATE_DECK_BUILD) {
      // Click card to toggle
      const cols = 8;
      const cardW = 85;
      const cardH = 40;
      for (let i = 0; i < ALL_CARDS.length; ++i) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 30 + col * (cardW + 8);
        const y = 50 + row * (cardH + 6);
        if (mx >= x && mx <= x + cardW && my >= y && my <= y + cardH) {
          const card = ALL_CARDS[i];
          const idx = selectedDeck.indexOf(card.id);
          if (idx >= 0)
            removeCardFromDeck(idx);
          else
            addCardToDeck(card.id);
          return;
        }
      }
      return;
    }

    if (state !== STATE_PLAYING || !isPlayerTurn)
      return;

    // End turn button click
    const bx = CANVAS_W - 100, by = CANVAS_H / 2 - 20, bw = 80, bh = 30;
    if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) {
      endTurn();
      return;
    }

    // Card click
    if (hoveredCard >= 0)
      playCard(hoveredCard);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      startNewGame();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      togglePause();
      return;
    }

    if (e.key === 'd' || e.key === 'D') {
      if (state === STATE_MENU || state === STATE_DECK_BUILD)
        toggleDeckBuilder();
      return;
    }

    if (e.key === 'h' || e.key === 'H') {
      if (state === STATE_MENU)
        handleAction('how-to-play');
      return;
    }

    if (state !== STATE_PLAYING || !isPlayerTurn)
      return;

    if (e.key === 'e' || e.key === 'E') {
      endTurn();
      return;
    }

    // Number keys 1-9 for hand cards
    const num = parseInt(e.key);
    if (num >= 1 && num <= 9 && num <= playerHand.length)
      playCard(num - 1);
  });

  function togglePause() {
    if (state === STATE_PLAYING) {
      state = STATE_PAUSED;
    } else if (state === STATE_PAUSED) {
      state = STATE_PLAYING;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     STATUS BAR
     ══════════════════════════════════════════════════════════════════ */

  function updateStatusBar() {
    const elTurn = document.getElementById('statusTurn');
    const elMana = document.getElementById('statusMana');
    const elDeck = document.getElementById('statusDeck');
    if (elTurn) elTurn.textContent = `Turn: ${turnNumber}`;
    if (elMana) elMana.textContent = `Mana: ${playerMana}/${playerMaxMana}`;
    if (elDeck) elDeck.textContent = `Deck: ${playerDeck?.length ?? 0}`;
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        startNewGame();
        break;
      case 'pause':
        togglePause();
        break;
      case 'high-scores':
        renderHighScores();
        SZ.Dialog.show('highScoresBackdrop').then((result) => {
          if (result === 'reset') {
            highScores = [];
            saveHighScores();
            renderHighScores();
          }
        });
        break;
      case 'how-to-play':
        SZ.Dialog.show('howToPlayBackdrop');
        break;
      case 'controls':
        SZ.Dialog.show('controlsBackdrop');
        break;
      case 'about':
        SZ.Dialog.show('dlg-about');
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function handleResize() {
    setupCanvas();
  }

  function updateWindowTitle() {
    const title = state === STATE_VICTORY
      ? 'Fantasy Cards — Victory!'
      : state === STATE_GAME_OVER
        ? 'Fantasy Cards — Game Over'
        : `Fantasy Cards — Turn ${turnNumber}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE')
        handleResize();
      else if (msg === 'WM_THEMECHANGED')
        setupCanvas();
    });
  }

  window.addEventListener('resize', handleResize);

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();

  const menu = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  loadHighScores();
  updateWindowTitle();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
