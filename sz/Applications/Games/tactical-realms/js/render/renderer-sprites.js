/* Creature sprite drawing: tinted blits and the animated sprite pass shared by tokens and portraits. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const Renderer = TR.Renderer;

  Object.assign(Renderer.prototype, {
    _drawTintedSprite(ctx, img, rect, dx, dy, destSize, tint) {
      this._compositor.drawComposite(ctx, [{ img, rect, tint }], destSize, dx, dy);
    }

  ,
    _drawCreatureSprite(ctx, creatureId, category, dx, dy, destSize, animType, direction, frame, flash) {
      const resolver = TR.spriteResolver;
      if (!resolver)
        return false;
      const sprite = resolver.resolve(creatureId, category,
        animType || 'stand', direction || 'down', frame || 0);
      if (!sprite)
        return false;
      ctx.imageSmoothingEnabled = false;
      if (sprite.flip) {
        ctx.save();
        ctx.translate(dx + destSize, dy);
        ctx.scale(-1, 1);
        dx = 0; dy = 0;
      }
      const rect = { x: sprite.srcX, y: sprite.srcY, w: sprite.srcW, h: sprite.srcH };
      // Flash is quantised so the compositor cache holds only a few variants.
      const flashStep = flash > 0 ? Math.ceil(flash * 4) / 4 : 0;
      if (flashStep > 0) {
        const layers = [{ img: sprite.img, rect, tint: sprite.tint || null },
          { img: sprite.img, rect, tint: `rgba(255,255,255,${(flashStep * 0.85).toFixed(2)})` }];
        this._compositor.drawComposite(ctx, layers, Math.round(destSize), Math.round(dx), Math.round(dy));
      } else if (sprite.tint)
        this._drawTintedSprite(ctx, sprite.img, rect, Math.round(dx), Math.round(dy), Math.round(destSize), sprite.tint);
      else
        ctx.drawImage(sprite.img, sprite.srcX, sprite.srcY, sprite.srcW, sprite.srcH,
          dx, dy, destSize, destSize);
      if (sprite.flip)
        ctx.restore();
      return true;
    }

  ,
  });
})();
