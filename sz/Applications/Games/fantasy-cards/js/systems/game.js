/* The heart of a battle: starting a game, playing a card, applying every card
   effect with its combo synergy, and the victory/defeat check. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FantasyCards || (SZ.FantasyCards = {});
  const C = NS.constants;
  const T = NS.tables;
  const S = NS.state;
  const D = NS.dom;
  const U = NS.util;

  function startNewGame() {
    S.turnNumber = 1;
    S.isPlayerTurn = true;

    S.playerMaxHP = C.STARTING_HP;
    S.playerHP = S.playerMaxHP;
    S.playerShield = 0;
    S.playerMaxMana = 3;
    S.playerMana = S.playerMaxMana;
    S.playerDamageBuff = 0;
    S.playerShieldBuff = 0;
    S.playerPoison = 0;

    S.aiMaxHP = C.STARTING_HP;
    S.aiHP = S.aiMaxHP;
    S.aiShield = 0;
    S.aiMaxMana = 3;
    S.aiMana = S.aiMaxMana;
    S.aiDamageBuff = 0;
    S.aiShieldBuff = 0;
    S.aiPoison = 0;

    // Build decks
    if (S.selectedDeck.length === C.DECK_SIZE) {
      S.playerDeck = U.shuffle(S.selectedDeck.map(id => ({ ...T.ALL_CARDS.find(c => c.id === id) })));
    } else {
      S.playerDeck = U.shuffle(NS.deck.buildDefaultDeck());
    }
    S.playerHand = [];
    S.playerDiscard = [];

    S.aiDeck = U.shuffle(NS.deck.buildDefaultDeck());
    S.aiHand = [];
    S.aiDiscard = [];

    S.cardAnimations = [];

    // Draw starting hand (5 cards each)
    for (let i = 0; i < 5; ++i) {
      NS.deck.drawFromDeck(S.playerDeck, S.playerHand, S.playerDiscard);
      NS.deck.drawFromDeck(S.aiDeck, S.aiHand, S.aiDiscard);
    }

    S.state = C.STATE_PLAYING;
    S.aiPlayTimer = 0;
    S.turnTransition = 0;
    SZ.GameAudio.play('select');
    NS.os.updateWindowTitle();
    NS.status.updateStatusBar();
  }

  function canPlayCard(card, mana) {
    return card.cost <= mana;
  }

  function playCard(cardIndex) {
    if (!S.isPlayerTurn || S.state !== C.STATE_PLAYING)
      return;

    const card = S.playerHand[cardIndex];
    if (!card)
      return;
    if (S.playerMana < card.cost) {
      SZ.GameAudio.play('error', { volume: 0.6 });
      return;
    }

    S.playerMana -= card.cost;
    S.playerHand.splice(cardIndex, 1);
    applyCardEffect(card, true);
    S.playerDiscard.push(card);

    // Mana shimmer effect
    S.manaShimmerTimer = 0.5;
    D.particles.sparkle(100, C.CANVAS_H - 30, 8, { color: '#48f', speed: 2 });

    // Card play glow animation
    const cx = U.getCardX(cardIndex, S.playerHand.length + 1);
    D.particles.sparkle(cx, 420, 15, { color: card.color, speed: 3 });

    // Check victory/defeat
    checkGameEnd();
    NS.status.updateStatusBar();
  }

  function applyCardEffect(card, isPlayer) {
    const targetHP = isPlayer ? 'aiHP' : 'playerHP';
    const targetShield = isPlayer ? 'aiShield' : 'playerShield';
    const selfHP = isPlayer ? 'playerHP' : 'aiHP';
    const selfShield = isPlayer ? 'playerShield' : 'aiShield';
    const damageBuff = isPlayer ? S.playerDamageBuff : S.aiDamageBuff;

    // Check combo synergy bonus
    const comboBonus = checkCombo(card, isPlayer);
    const totalPower = card.power + comboBonus;

    const targetY = isPlayer ? 80 : 440;
    const selfY = isPlayer ? 440 : 80;

    switch (card.type) {
      case 'attack': {
        const rawDamage = totalPower + damageBuff;
        let damage = rawDamage;
        const oShield = isPlayer ? S.aiShield : S.playerShield;
        if (oShield > 0) {
          const absorbed = Math.min(oShield, damage);
          if (isPlayer)
            S.aiShield -= absorbed;
          else
            S.playerShield -= absorbed;
          damage -= absorbed;
        }
        if (damage > 0) {
          if (isPlayer)
            S.aiHP -= damage;
          else
            S.playerHP -= damage;
        }

        // Burst particles on damage
        if (damage > 0)
          SZ.GameAudio.play(rawDamage >= 10 ? 'thud' : 'hit', { pitch: isPlayer ? 1 : 0.85 });
        else
          SZ.GameAudio.play('bounce', { pitch: 0.8 });
        D.particles.burst(C.CANVAS_W / 2, targetY, 20, { color: card.color, speed: 4 });
        D.floatingText.add(C.CANVAS_W / 2, targetY - 20, `-${rawDamage}`, { color: '#f44', font: 'bold 16px sans-serif' });

        // Screen shake for big damage
        if (rawDamage >= 10)
          D.screenShake.trigger(6, 300);
        break;
      }
      case 'defend': {
        const shieldAmount = totalPower + (isPlayer ? S.playerShieldBuff : S.aiShieldBuff);
        if (isPlayer)
          S.playerShield += shieldAmount;
        else
          S.aiShield += shieldAmount;

        D.particles.sparkle(C.CANVAS_W / 2, selfY, 12, { color: '#8af', speed: 2 });
        SZ.GameAudio.play('select', { pitch: 0.75, volume: 0.8 });
        D.floatingText.add(C.CANVAS_W / 2, selfY - 20, `+${shieldAmount} Shield`, { color: '#8af', font: 'bold 14px sans-serif' });
        break;
      }
      case 'heal': {
        const healAmount = totalPower;
        if (isPlayer)
          S.playerHP = Math.min(S.playerMaxHP, S.playerHP + healAmount);
        else
          S.aiHP = Math.min(S.aiMaxHP, S.aiHP + healAmount);

        D.particles.sparkle(C.CANVAS_W / 2, selfY, 12, { color: '#4f4', speed: 2 });
        SZ.GameAudio.play('pickup', { volume: 0.8 });
        D.floatingText.add(C.CANVAS_W / 2, selfY - 20, `+${healAmount} HP`, { color: '#4f4', font: 'bold 14px sans-serif' });
        break;
      }
      case 'buff': {
        if (card.name === 'Mana Surge') {
          if (isPlayer)
            S.playerMana += totalPower;
          else
            S.aiMana += totalPower;
          D.particles.sparkle(100, selfY, 10, { color: '#48f', speed: 2 });
          SZ.GameAudio.play('coin', { pitch: 0.8, volume: 0.8 });
          D.floatingText.add(C.CANVAS_W / 2, selfY - 20, `+${totalPower} Mana`, { color: '#48f', font: 'bold 14px sans-serif' });
        } else if (card.name === 'Swift Feet') {
          NS.deck.drawFromDeck(isPlayer ? S.playerDeck : S.aiDeck, isPlayer ? S.playerHand : S.aiHand, isPlayer ? S.playerDiscard : S.aiDiscard);
          D.floatingText.add(C.CANVAS_W / 2, selfY - 20, '+1 Card', { color: '#8f8', font: 'bold 14px sans-serif' });
          SZ.GameAudio.play('whoosh', { volume: 0.7 });
        } else {
          if (isPlayer) {
            S.playerDamageBuff += Math.floor(totalPower / 2);
            S.playerShieldBuff += Math.floor(totalPower / 2);
          } else {
            S.aiDamageBuff += Math.floor(totalPower / 2);
            S.aiShieldBuff += Math.floor(totalPower / 2);
          }
          D.particles.sparkle(C.CANVAS_W / 2, selfY, 10, { color: '#fa4', speed: 2 });
          SZ.GameAudio.play('powerup', { volume: 0.7 });
          D.floatingText.add(C.CANVAS_W / 2, selfY - 20, `Buffed +${Math.floor(totalPower / 2)}`, { color: '#fa4', font: 'bold 14px sans-serif' });
        }
        break;
      }
      case 'debuff': {
        if (isPlayer) {
          S.aiDamageBuff = Math.max(0, S.aiDamageBuff - totalPower);
          S.aiShieldBuff = Math.max(0, S.aiShieldBuff - totalPower);
        } else {
          S.playerDamageBuff = Math.max(0, S.playerDamageBuff - totalPower);
          S.playerShieldBuff = Math.max(0, S.playerShieldBuff - totalPower);
        }
        D.particles.burst(C.CANVAS_W / 2, targetY, 15, { color: '#808', speed: 3 });
        SZ.GameAudio.play('zap', { pitch: 0.6 });
        D.floatingText.add(C.CANVAS_W / 2, targetY - 20, `Debuff -${totalPower}`, { color: '#a66', font: 'bold 14px sans-serif' });
        break;
      }
    }
  }

  function checkCombo(card, isPlayer) {
    const hand = isPlayer ? S.playerHand : S.aiHand;
    const discard = isPlayer ? S.playerDiscard : S.aiDiscard;
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
    if (S.aiHP <= 0) {
      S.state = C.STATE_VICTORY;
      D.particles.burst(C.CANVAS_W / 2, C.CANVAS_H / 2, 50, { color: '#ff0', speed: 5 });
      D.screenShake.trigger(8, 400);
      D.floatingText.add(C.CANVAS_W / 2, C.CANVAS_H / 2, 'VICTORY!', { color: '#ff0', font: 'bold 28px sans-serif' });
      SZ.GameAudio.play('win');
      NS.storage.saveHighScore();
      NS.os.updateWindowTitle();
    } else if (S.playerHP <= 0) {
      S.state = C.STATE_GAME_OVER;
      D.screenShake.trigger(10, 500);
      D.floatingText.add(C.CANVAS_W / 2, C.CANVAS_H / 2, 'DEFEAT', { color: '#f44', font: 'bold 28px sans-serif' });
      SZ.GameAudio.play('lose');
      NS.os.updateWindowTitle();
    }
  }

  function togglePause() {
    if (S.state === C.STATE_PLAYING) {
      S.state = C.STATE_PAUSED;
    } else if (S.state === C.STATE_PAUSED) {
      S.state = C.STATE_PLAYING;
    }
  }

  Object.assign(NS.game, { startNewGame, canPlayCard, playCard, applyCardEffect, checkCombo, checkGameEnd, togglePause });
})();
