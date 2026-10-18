/* Space Farming - sprite cache and drawing: baked sprites by key, crop stage sprites and
   drawSprite at the current pass scale.
   Owns: G.spriteScale */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { ctx, bakeSprite, SPRITE_PAINTERS } = NS;

  const spriteCache = {};

  function getSprite(key) {
    let spr = spriteCache[key];
    if (!spr) {
      const paint = SPRITE_PAINTERS[key];
      if (!paint) return null;
      spr = spriteCache[key] = bakeSprite(paint);
    }
    return spr;
  }

  /* Young plant tinted with the crop's colour */
  function getYoungCropSprite(crop) {
    const key = 'young:' + crop.sprite;
    let spr = spriteCache[key];
    if (!spr)
      spr = spriteCache[key] = bakeSprite((p, P) => {
        p.ell(7.5, 13.5, 5.5, 1.5, P.soil);
        p.line(7.5, 13, 7.5, 4, P.leaf);
        p.ell(4.5, 10, 2.5, 1, P.green); p.ell(10.5, 9, 2.5, 1, P.green);
        p.ell(5, 6, 2, 1, P.green); p.ell(10, 5, 2, 1, P.green);
        p.disc(7.5, 3, 1.5, crop.color);
        p.disc(3, 7.5, 1, crop.color); p.disc(12, 6.5, 1, crop.color);
      });
    return spr;
  }

  /* Draws a sprite centred on (cx, cy) with the given on-screen size */
  function drawSprite(key, cx, cy, size, alpha) {
    const spr = typeof key === 'string' ? getSprite(key) : key;
    if (!spr) return;
    const prevSmooth = ctx.imageSmoothingEnabled;
    const prevAlpha = ctx.globalAlpha;
    // crisp pixels when enlarged, smooth when shrunk
    ctx.imageSmoothingEnabled = size * G.spriteScale / spr.width < 1.5;
    if (alpha !== undefined)
      ctx.globalAlpha = prevAlpha * alpha;
    const s = Math.round(size);
    ctx.drawImage(spr, Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
    ctx.imageSmoothingEnabled = prevSmooth;
    ctx.globalAlpha = prevAlpha;
  }

  function getCropStageSprite(crop, stage) {
    const maxStage = crop.stages - 1;
    if (stage >= maxStage) return getSprite(crop.sprite);
    if (stage <= 0) return getSprite('sprout');
    return getYoungCropSprite(crop);
  }

  Object.assign(NS, { spriteCache, getSprite, getYoungCropSprite, drawSprite });

})();
