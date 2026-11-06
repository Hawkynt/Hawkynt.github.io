/* Card sprite cache and the public card drawing entry points. Faces, backs and
   soft shadows are painted once per (theme, card, size, pixel scale) into
   offscreen canvases; per frame a card is one or two drawImage calls. Moving
   cards (engine/motion.js) are queued and drawn above the table, lifted. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const CE = SZ.CardEngine;
  const M = CE.motion;

  const rawBack = CE.drawCardBack;
  const MAX_SPRITES = 700;
  const cache = new Map();
  const flying = [];

  CE.pixelScale = 1;
  CE.cardShadows = true;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function resolution() {
    return Math.max(1, Math.round(CE.pixelScale * 4) / 4);
  }

  function sprite(key, w, h, pad, paint) {
    let c = cache.get(key);
    if (c) {
      cache.delete(key);
      cache.set(key, c);
      return c;
    }
    const res = resolution();
    c = makeCanvas((w + pad * 2) * res, (h + pad * 2) * res);
    const g = c.getContext('2d');
    if (g) {
      g.scale(res, res);
      g.translate(pad, pad);
      paint(g, w, h);
    }
    cache.set(key, c);
    if (cache.size > MAX_SPRITES)
      cache.delete(cache.keys().next().value);
    return c;
  }

  CE.clearSpriteCache = function() {
    cache.clear();
  };

  function themeKey() {
    const CT = SZ.CardThemes;
    const t = CT && CT.activeTheme;
    return t ? t.cardFace + '|' + t.cardBack + '|' + t.customBackColor : '-';
  }

  function faceSprite(card, w, h) {
    const key = 'f|' + themeKey() + '|' + CE.resolveSuit(card.suit) + '|' + card.rank + '|' + (card.value == null ? '' : card.value) + '|' + w + 'x' + h + '@' + resolution();
    return sprite(key, w, h, 0, (g) => CE.art.drawFace(g, 0, 0, card, w, h));
  }

  function backSprite(w, h) {
    const key = 'b|' + themeKey() + '|' + w + 'x' + h + '@' + resolution();
    return sprite(key, w, h, 0, (g) => rawBack(g, 0, 0, w, h));
  }

  const SHADOW_PAD = 10;
  function shadowSprite(w, h) {
    const key = 's|' + w + 'x' + h + '@' + resolution();
    return sprite(key, w, h, SHADOW_PAD, (g) => {
      const r = CE.CARD_RADIUS * Math.min(w / CE.CARD_W, h / CE.CARD_H);
      g.shadowColor = 'rgba(0,0,0,0.55)';
      g.shadowBlur = 6;
      g.fillStyle = 'rgba(0,0,0,0.35)';
      CE.drawRoundedRect(g, 0, 0, w, h, r);
      g.fill();
    });
  }

  function blit(cx, img, x, y, w, h, pad) {
    cx.drawImage(img, x - pad, y - pad, w + pad * 2, h + pad * 2);
  }

  /* draws one placed card (face or back) with shadow, scale, tilt and flip */
  function paint(cx, card, x, y, w, h, o, faceUp, custom) {
    const img = o.showBack || !faceUp ? backSprite(w, h) : custom || faceSprite(card, w, h);
    const plain = o.scale === 1 && o.tilt === 0 && o.flipX === 1 && o.alpha === 1 && o.lift === 0;
    if (plain) {
      if (CE.cardShadows) blit(cx, shadowSprite(w, h), x + 0.8, y + 1.6, w, h, SHADOW_PAD);
      cx.drawImage(img, x, y, w, h);
      return;
    }
    cx.save();
    if (o.alpha !== 1) cx.globalAlpha *= o.alpha;
    cx.translate(x + w / 2, y + h / 2);
    if (o.tilt) cx.rotate(o.tilt);
    const sc = o.scale;
    if (CE.cardShadows) {
      const off = 1.6 + o.lift * 9;
      cx.save();
      cx.globalAlpha *= 1 - o.lift * 0.35;
      cx.scale(sc * o.flipX, sc);
      blit(cx, shadowSprite(w, h), -w / 2 + off * 0.5, -h / 2 + off, w, h, SHADOW_PAD);
      cx.restore();
    }
    cx.scale(sc * o.flipX, sc);
    cx.drawImage(img, -w / 2, -h / 2, w, h);
    cx.restore();
  }

  function getTransform(cx) {
    return typeof cx.getTransform === 'function' ? cx.getTransform() : null;
  }

  function place(cx, card, x, y, w, h, faceUp, custom) {
    const o = M.place(card, x, y, w, h);
    if (o.alpha <= 0) return;
    if (o.flying) {
      flying.push({ cx, card, x: o.x, y: o.y, w, h, faceUp, custom, m: getTransform(cx), alpha: cx.globalAlpha,
        o: { x: o.x, y: o.y, scale: o.scale, tilt: o.tilt, lift: o.lift, alpha: o.alpha, flipX: o.flipX, showBack: o.showBack } });
      return;
    }
    paint(cx, card, o.x, o.y, w, h, o, faceUp, custom);
  }

  /* a card painted by `painter` (cached under `key`); with `card` it moves like the rest */
  CE.drawSpriteCard = function(cx, x, y, w, h, key, painter, card) {
    const img = sprite(key + '|' + w + 'x' + h + '@' + resolution(), w, h, 0, painter);
    if (card && typeof card === 'object') {
      place(cx, card, x, y, w, h, true, img);
      return;
    }
    if (CE.cardShadows) blit(cx, shadowSprite(w, h), x + 0.8, y + 1.6, w, h, SHADOW_PAD);
    cx.drawImage(img, x, y, w, h);
  };

  CE.drawCardFace = function(cx, x, y, card, w, h) {
    place(cx, card, x, y, w || CE.CARD_W, h || CE.CARD_H, true);
  };

  CE.drawCardBack = function(cx, x, y, w, h) {
    const cw = w || CE.CARD_W, ch = h || CE.CARD_H;
    M.noteBack(x, y, cw, ch);
    if (CE.cardShadows) blit(cx, shadowSprite(cw, ch), x + 0.8, y + 1.6, cw, ch, SHADOW_PAD);
    cx.drawImage(backSprite(cw, ch), x, y, cw, ch);
  };

  CE.drawCard = function(cx, x, y, card, w, h) {
    if (card.faceUp)
      CE.drawCardFace(cx, x, y, card, w, h);
    else
      CE.drawCardBack(cx, x, y, w, h);
  };

  /* the unlifted painters for previews (settings tiles, lobby art) */
  CE.paintCardFace = function(cx, x, y, card, w, h) {
    cx.drawImage(faceSprite(card, w || CE.CARD_W, h || CE.CARD_H), x, y, w || CE.CARD_W, h || CE.CARD_H);
  };
  CE.paintCardBack = function(cx, x, y, w, h) {
    cx.drawImage(backSprite(w || CE.CARD_W, h || CE.CARD_H), x, y, w || CE.CARD_W, h || CE.CARD_H);
  };
  CE.paintCardShadow = function(cx, x, y, w, h) {
    blit(cx, shadowSprite(w, h), x, y, w, h, SHADOW_PAD);
  };

  /* moving cards are drawn after the variant, above everything on the table */
  CE.flushFlyingCards = function() {
    for (let i = 0; i < flying.length; ++i) {
      const f = flying[i];
      const cx = f.cx;
      cx.save();
      if (f.m && typeof cx.setTransform === 'function') cx.setTransform(f.m);
      cx.globalAlpha = f.alpha;
      paint(cx, f.card, f.o.x, f.o.y, f.w, f.h, f.o, f.faceUp, f.custom);
      cx.restore();
    }
    flying.length = 0;
  };
})();
