;(function() {
  'use strict';

  const SZ = window.SZ;

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

  const ALL_CARDS = [
    // ── Attack cards (15) ──
    { id: 1,  name: 'Fireball',         type: 'attack', cost: 3, power: 8,  color: '#f44',  desc: 'Hurl a ball of fire', combo: 'fire' },
    { id: 2,  name: 'Lightning Bolt',   type: 'attack', cost: 2, power: 5,  color: '#ff0',  desc: 'Strike with lightning', combo: 'storm' },
    { id: 3,  name: 'Ice Shard',        type: 'attack', cost: 2, power: 4,  color: '#6ef',  desc: 'Launch frozen shard', combo: 'frost' },
    { id: 4,  name: 'Shadow Strike',    type: 'attack', cost: 3, power: 7,  color: '#808',  desc: 'Strike from shadows', combo: 'shadow' },
    { id: 5,  name: 'Holy Smite',       type: 'attack', cost: 4, power: 10, color: '#ff8',  desc: 'Divine damage', combo: 'holy' },
    { id: 6,  name: 'Meteor Crash',     type: 'attack', cost: 6, power: 16, color: '#f80',  desc: 'Devastating meteor', combo: 'fire' },
    { id: 7,  name: 'Wind Slash',       type: 'attack', cost: 1, power: 3,  color: '#8f8',  desc: 'Quick wind blade', combo: 'storm' },
    { id: 8,  name: 'Poison Dart',      type: 'attack', cost: 2, power: 4,  color: '#0a0',  desc: 'Toxic projectile', combo: 'nature' },
    { id: 9,  name: 'Arcane Missile',   type: 'attack', cost: 1, power: 2,  color: '#a6f',  desc: 'Magic missile', combo: 'arcane' },
    { id: 10, name: 'Thunder Clap',     type: 'attack', cost: 4, power: 9,  color: '#ff4',  desc: 'Echoing thunder', combo: 'storm' },
    { id: 11, name: 'Dragon Breath',    type: 'attack', cost: 7, power: 20, color: '#f60',  desc: 'Ancient dragon fire', combo: 'fire' },
    { id: 12, name: 'Soul Drain',       type: 'attack', cost: 3, power: 5,  color: '#606',  desc: 'Drain life force', combo: 'shadow' },
    { id: 13, name: 'Earth Spike',      type: 'attack', cost: 3, power: 6,  color: '#a85',  desc: 'Erupting rock spike', combo: 'nature' },
    { id: 14, name: 'Void Blast',       type: 'attack', cost: 5, power: 12, color: '#309',  desc: 'Void energy burst', combo: 'arcane' },
    { id: 15, name: 'Frost Nova',       type: 'attack', cost: 4, power: 8,  color: '#8ef',  desc: 'Freezing explosion', combo: 'frost' },

    // ── Defend cards (10) ──
    { id: 16, name: 'Stone Wall',       type: 'defend', cost: 2, power: 6,  color: '#888',  desc: 'Raise a shield of stone', combo: 'nature' },
    { id: 17, name: 'Ice Barrier',      type: 'defend', cost: 3, power: 8,  color: '#aef',  desc: 'Frozen shield wall', combo: 'frost' },
    { id: 18, name: 'Holy Shield',      type: 'defend', cost: 3, power: 7,  color: '#fe8',  desc: 'Divine protection', combo: 'holy' },
    { id: 19, name: 'Shadow Cloak',     type: 'defend', cost: 2, power: 5,  color: '#636',  desc: 'Wrap in shadows', combo: 'shadow' },
    { id: 20, name: 'Arcane Ward',      type: 'defend', cost: 4, power: 10, color: '#c8f',  desc: 'Magical barrier', combo: 'arcane' },
    { id: 21, name: 'Iron Skin',        type: 'defend', cost: 1, power: 3,  color: '#999',  desc: 'Harden your body', combo: 'nature' },
    { id: 22, name: 'Mirror Image',     type: 'defend', cost: 3, power: 6,  color: '#aaf',  desc: 'Duplicate to absorb', combo: 'arcane' },
    { id: 23, name: 'Flame Wall',       type: 'defend', cost: 2, power: 5,  color: '#f84',  desc: 'Burning barrier', combo: 'fire' },
    { id: 24, name: 'Wind Barrier',     type: 'defend', cost: 2, power: 4,  color: '#8e8',  desc: 'Deflecting winds', combo: 'storm' },
    { id: 25, name: 'Dragon Scale',     type: 'defend', cost: 5, power: 14, color: '#a80',  desc: 'Impenetrable scales', combo: 'fire' },

    // ── Heal cards (10) ──
    { id: 26, name: 'Minor Heal',       type: 'heal', cost: 1, power: 3,  color: '#4f4',  desc: 'Small restoration', combo: 'holy' },
    { id: 27, name: 'Greater Heal',     type: 'heal', cost: 3, power: 8,  color: '#6f6',  desc: 'Major restoration', combo: 'holy' },
    { id: 28, name: 'Nature Mend',      type: 'heal', cost: 2, power: 5,  color: '#4a4',  desc: 'Nature heals wounds', combo: 'nature' },
    { id: 29, name: 'Blood Pact',       type: 'heal', cost: 4, power: 10, color: '#a22',  desc: 'Sacrifice for health', combo: 'shadow' },
    { id: 30, name: 'Regeneration',     type: 'heal', cost: 2, power: 4,  color: '#6e6',  desc: 'Steady recovery', combo: 'nature' },
    { id: 31, name: 'Frost Salve',      type: 'heal', cost: 2, power: 5,  color: '#6df',  desc: 'Cooling restoration', combo: 'frost' },
    { id: 32, name: 'Arcane Restore',   type: 'heal', cost: 3, power: 7,  color: '#b8f',  desc: 'Magic mending', combo: 'arcane' },
    { id: 33, name: 'Phoenix Tear',     type: 'heal', cost: 5, power: 15, color: '#f84',  desc: 'Legendary restoration', combo: 'fire' },
    { id: 34, name: 'Spirit Touch',     type: 'heal', cost: 1, power: 2,  color: '#8af',  desc: 'Gentle spirit heal', combo: 'holy' },
    { id: 35, name: 'Tidal Wave',       type: 'heal', cost: 3, power: 6,  color: '#48f',  desc: 'Cleansing waters', combo: 'storm' },

    // ── Buff cards (10) ──
    { id: 36, name: 'Battle Cry',       type: 'buff', cost: 2, power: 3,  color: '#fa4',  desc: 'Boost next attack damage', combo: 'fire' },
    { id: 37, name: 'Empower',          type: 'buff', cost: 3, power: 5,  color: '#ff6',  desc: 'Greatly boost damage', combo: 'arcane' },
    { id: 38, name: 'Fortify',          type: 'buff', cost: 2, power: 4,  color: '#aaa',  desc: 'Boost next shield', combo: 'nature' },
    { id: 39, name: 'Mana Surge',       type: 'buff', cost: 1, power: 2,  color: '#48f',  desc: 'Gain extra mana', combo: 'arcane' },
    { id: 40, name: 'Swift Feet',       type: 'buff', cost: 2, power: 1,  color: '#8f8',  desc: 'Draw an extra card', combo: 'storm' },
    { id: 41, name: 'Flame Aura',       type: 'buff', cost: 3, power: 4,  color: '#f64',  desc: 'Add fire to attacks', combo: 'fire' },
    { id: 42, name: 'Frost Armor',      type: 'buff', cost: 3, power: 4,  color: '#8ef',  desc: 'Add frost to shields', combo: 'frost' },
    { id: 43, name: 'Shadow Step',      type: 'buff', cost: 2, power: 2,  color: '#606',  desc: 'Evade next attack', combo: 'shadow' },
    { id: 44, name: 'Holy Blessing',    type: 'buff', cost: 4, power: 6,  color: '#fe6',  desc: 'Buff all stats', combo: 'holy' },
    { id: 45, name: 'Berserker Rage',   type: 'buff', cost: 3, power: 7,  color: '#f44',  desc: 'Double damage, halve shield', combo: 'fire' },

    // ── Debuff cards (10) ──
    { id: 46, name: 'Weaken',           type: 'debuff', cost: 2, power: 3,  color: '#a66',  desc: 'Reduce enemy damage', combo: 'shadow' },
    { id: 47, name: 'Curse',            type: 'debuff', cost: 3, power: 5,  color: '#808',  desc: 'Curse reduces all stats', combo: 'shadow' },
    { id: 48, name: 'Slow',             type: 'debuff', cost: 1, power: 2,  color: '#68a',  desc: 'Enemy draws fewer cards', combo: 'frost' },
    { id: 49, name: 'Silence',          type: 'debuff', cost: 3, power: 4,  color: '#aaa',  desc: 'Block enemy buffs', combo: 'arcane' },
    { id: 50, name: 'Poison Cloud',     type: 'debuff', cost: 2, power: 3,  color: '#080',  desc: 'Poison over time', combo: 'nature' },
    { id: 51, name: 'Hex',              type: 'debuff', cost: 4, power: 6,  color: '#606',  desc: 'Random stat reduction', combo: 'shadow' },
    { id: 52, name: 'Frostbite',        type: 'debuff', cost: 2, power: 3,  color: '#6cf',  desc: 'Freeze and weaken', combo: 'frost' },
    { id: 53, name: 'Disarm',           type: 'debuff', cost: 3, power: 5,  color: '#a86',  desc: 'Reduce enemy power', combo: 'nature' },
    { id: 54, name: 'Mind Fog',         type: 'debuff', cost: 2, power: 2,  color: '#a8f',  desc: 'Confuse opponent', combo: 'arcane' },
    { id: 55, name: 'Chain Lightning',  type: 'debuff', cost: 5, power: 8,  color: '#ff4',  desc: 'Shock and weaken', combo: 'storm' }
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
  let aiPlayTimer = 0;
  let turnTransition = 0;
  let turnTransitionText = '';

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
    ctx.fillStyle = '#1a1024';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Play field divider
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H / 2);
    ctx.lineTo(CANVAS_W, CANVAS_H / 2);
    ctx.stroke();
    ctx.setLineDash([]);
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

  function drawCard(cardObj, x, y, w, h, faceUp, hovered) {
    // Card border glow on hover
    if (hovered) {
      ctx.shadowColor = cardObj.color || '#fff';
      ctx.shadowBlur = 12;
    }

    // Card background
    ctx.fillStyle = faceUp ? '#1a1a2e' : '#2a1a3e';
    ctx.strokeStyle = faceUp ? (cardObj.color || '#666') : '#555';
    ctx.lineWidth = hovered ? 2 : 1;

    const r = 4;
    ctx.beginPath();
    ctx.moveTo(x - w / 2 + r, y - h / 2);
    ctx.lineTo(x + w / 2 - r, y - h / 2);
    ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
    ctx.lineTo(x + w / 2, y + h / 2 - r);
    ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
    ctx.lineTo(x - w / 2 + r, y + h / 2);
    ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
    ctx.lineTo(x - w / 2, y - h / 2 + r);
    ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    if (!faceUp)
      return;

    // Cost circle
    ctx.fillStyle = '#38f';
    ctx.beginPath();
    ctx.arc(x - w / 2 + 12, y - h / 2 + 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cardObj.cost, x - w / 2 + 12, y - h / 2 + 15);

    // Power badge
    ctx.fillStyle = cardObj.type === 'attack' ? '#f44' : cardObj.type === 'defend' ? '#48f' : cardObj.type === 'heal' ? '#4f4' : cardObj.type === 'buff' ? '#fa4' : '#a66';
    ctx.beginPath();
    ctx.arc(x + w / 2 - 12, y - h / 2 + 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(cardObj.power, x + w / 2 - 12, y - h / 2 + 15);

    // Card name
    ctx.fillStyle = '#eee';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cardObj.name, x, y - 5);

    // Type label
    ctx.fillStyle = cardObj.color || '#888';
    ctx.font = '8px sans-serif';
    ctx.fillText(cardObj.type.toUpperCase(), x, y + 8);

    // Description
    ctx.fillStyle = '#888';
    ctx.font = '7px sans-serif';
    ctx.fillText(cardObj.desc, x, y + 22);
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
    ctx.fillStyle = '#2a5';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#4f8';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('End Turn', bx + bw / 2, by + 20);
  }

  function drawDeckPile() {
    // Player deck count
    ctx.fillStyle = '#333';
    ctx.fillRect(20, 380, 50, 30);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 380, 50, 30);
    ctx.fillStyle = '#aaa';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Deck: ${playerDeck.length}`, 45, 399);
  }

  function drawMenuScreen() {
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#c8f';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Fantasy Cards', CANVAS_W / 2, 120);

    ctx.fillStyle = '#aaa';
    ctx.font = '16px sans-serif';
    ctx.fillText('Deck-Building Card Battler', CANVAS_W / 2, 160);

    // Difficulty selection
    const diffs = [DIFF_EASY, DIFF_NORMAL, DIFF_HARD];
    const labels = ['Easy', 'Normal', 'Hard'];
    for (let i = 0; i < 3; ++i) {
      const bx = CANVAS_W / 2 - 60;
      const by = 220 + i * 50;
      const selected = difficulty === diffs[i];
      ctx.fillStyle = selected ? '#3a5' : '#222';
      ctx.fillRect(bx, by, 120, 35);
      ctx.strokeStyle = selected ? '#6f8' : '#555';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(bx, by, 120, 35);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(labels[i], CANVAS_W / 2, by + 23);
    }

    ctx.fillStyle = '#8af';
    ctx.font = '14px sans-serif';
    ctx.fillText('Click a difficulty, then press F2 to start', CANVAS_W / 2, 420);
    ctx.fillText('Press D to open Deck Builder', CANVAS_W / 2, 450);
  }

  function drawDeckBuilder() {
    ctx.fillStyle = '#0a0a18';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#c8f';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Deck Builder (${selectedDeck.length}/${DECK_SIZE})`, CANVAS_W / 2, 30);

    // Card collection grid
    const cols = 8;
    const cardW = 85;
    const cardH = 40;
    for (let i = 0; i < ALL_CARDS.length; ++i) {
      const card = ALL_CARDS[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 30 + col * (cardW + 8) + cardW / 2;
      const y = 50 + row * (cardH + 6) + cardH / 2;

      const inDeck = selectedDeck.includes(card.id);
      ctx.fillStyle = inDeck ? '#1a3a1a' : '#1a1a2e';
      ctx.strokeStyle = inDeck ? '#4f4' : card.color;
      ctx.lineWidth = 1;
      ctx.fillRect(x - cardW / 2, y - cardH / 2, cardW, cardH);
      ctx.strokeRect(x - cardW / 2, y - cardH / 2, cardW, cardH);

      ctx.fillStyle = '#ddd';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(card.name, x, y + 3);

      ctx.fillStyle = '#38f';
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText(card.cost + '', x - cardW / 2 + 10, y + 3);
    }

    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.fillText('Click cards to toggle in/out of deck. Press D to close.', CANVAS_W / 2, CANVAS_H - 20);
  }

  function drawGameOverlay() {
    if (state === STATE_GAME_OVER) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#f44';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2);
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('Press F2 for new game', CANVAS_W / 2, CANVAS_H / 2 + 40);
    } else if (state === STATE_VICTORY) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#ff0';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VICTORY!', CANVAS_W / 2, CANVAS_H / 2);
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('Press F2 for new game', CANVAS_W / 2, CANVAS_H / 2 + 40);
    } else if (state === STATE_PAUSED) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2);
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

      // Deck pile
      drawDeckPile();

      // AI hand (face down)
      drawAiHand();

      // Player hand
      drawPlayerHand();

      // End turn button
      drawEndTurnButton();

      // Turn indicator
      drawTurnIndicator();

      // Overlays
      drawGameOverlay();
    }

    // Draw effects on top
    particles.draw(ctx);
    floatingText.draw(ctx);

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
    if (state !== STATE_PLAYING || !isPlayerTurn)
      return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (CANVAS_H / rect.height);

    hoveredCard = -1;
    for (let i = 0; i < playerHand.length; ++i) {
      const cx = getCardX(i, playerHand.length);
      if (Math.abs(mx - cx) < 40 && my > 370 && my < 475)
        hoveredCard = i;
    }
  });

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
    const my = (e.clientY - rect.top) * (CANVAS_H / rect.height);

    if (state === STATE_MENU) {
      // Difficulty selection
      const diffs = [DIFF_EASY, DIFF_NORMAL, DIFF_HARD];
      for (let i = 0; i < 3; ++i) {
        const bx = CANVAS_W / 2 - 60;
        const by = 220 + i * 50;
        if (mx >= bx && mx <= bx + 120 && my >= by && my <= by + 35)
          difficulty = diffs[i];
      }
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
