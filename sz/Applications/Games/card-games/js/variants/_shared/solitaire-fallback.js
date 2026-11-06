;(function() {
  'use strict';

  /* Solitaire family: deck, shuffle and card painting fallbacks used when the card
     engine lacks a primitive (shared by Golf, Clock and Accordion). */

  const SZ = window.SZ;
  if (!SZ.CardGames) SZ.CardGames = {};
  if (!SZ.CardGames.shared) SZ.CardGames.shared = {};

  const CE = SZ.CardEngine;

  const CARD_W = CE ? CE.CARD_W : 71;
  const CARD_H = CE ? CE.CARD_H : 96;
  const CARD_RADIUS = CE ? CE.CARD_RADIUS : 5;

  const RANKS = CE ? CE.RANKS : ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = CE ? CE.SUITS : ['spades', 'hearts', 'diamonds', 'clubs'];

  function createDeck() {
    if (CE && CE.createDeck)
      return CE.createDeck();
    const deck = [];
    for (const suit of SUITS)
      for (const rank of RANKS)
        deck.push({ suit, rank, value: RANKS.indexOf(rank), faceUp: false, color: (suit === 'hearts' || suit === 'diamonds') ? 'red' : 'black' });
    return deck;
  }

  function shuffle(arr) {
    if (CE && CE.shuffle)
      return CE.shuffle(arr);
    for (let i = arr.length - 1; i > 0; --i) {
      const j = (Math.random() * (i + 1)) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function drawRoundedRect(cx, x, y, w, h, r) {
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

  function drawCardFace(cx, x, y, card) {
    if (CE && CE.drawCardFace)
      return CE.drawCardFace(cx, x, y, card);
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.fillStyle = '#fff';
    cx.fill();
    cx.strokeStyle = '#aaa';
    cx.lineWidth = 1;
    cx.stroke();
    const color = (card.suit === 'hearts' || card.suit === 'diamonds') ? '#c00' : '#222';
    cx.fillStyle = color;
    cx.font = 'bold 14px serif';
    cx.textAlign = 'left';
    cx.textBaseline = 'top';
    cx.fillText(card.rank, x + 5, y + 4);
  }

  function drawEmptySlot(cx, x, y, label) {
    if (CE && CE.drawEmptySlot)
      return CE.drawEmptySlot(cx, x, y, label);
    drawRoundedRect(cx, x, y, CARD_W, CARD_H, CARD_RADIUS);
    cx.strokeStyle = 'rgba(255,255,255,0.25)';
    cx.lineWidth = 2;
    cx.stroke();
    if (label) {
      cx.font = '24px serif';
      cx.fillStyle = 'rgba(255,255,255,0.3)';
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(label, x + CARD_W / 2, y + CARD_H / 2);
    }
  }

  SZ.CardGames.shared.solitaireFallback = {
    createDeck, shuffle, drawRoundedRect, drawCardFace, drawEmptySlot
  };

})();
