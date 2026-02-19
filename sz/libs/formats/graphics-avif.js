;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU32BE, readString } = F;

  // =========================================================================
  // AVIF/HEIF (ISOBMFF ftyp-based) metadata parser
  // =========================================================================

  function parse(bytes) {
    if (bytes.length < 12) return null;

    const size = readU32BE(bytes, 0);
    const type = readString(bytes, 4, 4);
    if (type !== 'ftyp') return null;

    const brand = readString(bytes, 8, 4);
    const compatBrands = [];
    for (let i = 16; i + 3 < size && i + 3 < bytes.length; i += 4)
      compatBrands.push(readString(bytes, i, 4));

    return { brand, compatBrands };
  }

  // =========================================================================
  // Decode via browser canvas (if supported)
  // =========================================================================

  async function decode(bytes) {
    const blob = new Blob([bytes], { type: 'image/avif' });
    try {
      const bitmap = await createImageBitmap(blob);
      const canvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(bitmap.width, bitmap.height)
        : (() => { const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height; return c; })();
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    } catch (_) {
      return null;
    }
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('avif', {
    name: 'AVIF Image',
    category: 'graphics',
    extensions: ['avif'],
    mimeTypes: ['image/avif'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 12) return false;
      const type = readString(bytes, 4, 4);
      if (type !== 'ftyp') return false;
      const brand = readString(bytes, 8, 4);
      return brand === 'avif' || brand === 'avis' || brand === 'mif1';
    },
    codec: { decode },
    parse,
  });

})();
