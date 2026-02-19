;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU16LE, readU8 } = F;

  // =========================================================================
  // GIF header/metadata parser
  // =========================================================================

  function parse(bytes) {
    if (bytes.length < 13) return null;

    const version = String.fromCharCode(bytes[3], bytes[4], bytes[5]);
    const width = readU16LE(bytes, 6);
    const height = readU16LE(bytes, 8);
    const packed = bytes[10];
    const hasGCT = !!(packed & 0x80);
    const gctSize = hasGCT ? (1 << ((packed & 0x07) + 1)) : 0;
    const bgColor = bytes[11];

    let frameCount = 0;
    let pos = 13 + gctSize * 3;

    while (pos < bytes.length) {
      const block = bytes[pos];
      if (block === 0x3B) break;

      if (block === 0x2C) {
        ++frameCount;
        if (pos + 9 >= bytes.length) break;
        const localPacked = bytes[pos + 9];
        const hasLCT = !!(localPacked & 0x80);
        const lctSize = hasLCT ? (1 << ((localPacked & 0x07) + 1)) : 0;
        pos += 10 + lctSize * 3;
        if (pos >= bytes.length) break;
        ++pos;
        while (pos < bytes.length) {
          const subLen = bytes[pos];
          if (subLen === 0) { ++pos; break; }
          pos += subLen + 1;
        }
      } else if (block === 0x21) {
        ++pos;
        if (pos >= bytes.length) break;
        ++pos;
        while (pos < bytes.length) {
          const subLen = bytes[pos];
          if (subLen === 0) { ++pos; break; }
          pos += subLen + 1;
        }
      } else
        ++pos;
    }

    return { version, width, height, frameCount, globalColorTableSize: gctSize, backgroundColor: bgColor };
  }

  // =========================================================================
  // Decode via browser canvas (first frame)
  // =========================================================================

  async function decode(bytes) {
    const blob = new Blob([bytes], { type: 'image/gif' });
    const bitmap = await createImageBitmap(blob);
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : (() => { const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height; return c; })();
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  }

  // =========================================================================
  // Encode — requires wasm-imagemagick (not yet shipped)
  // =========================================================================

  // async function encode(imageData) {
  //   const Wasm = F.Wasm;
  //   if (!Wasm) return null;
  //   const magick = await Wasm.magick();
  //   if (!magick) return null;
  //   return null;
  // }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('gif', {
    name: 'GIF Image',
    category: 'graphics',
    extensions: ['gif'],
    mimeTypes: ['image/gif'],
    access: 'ro',
    detect(bytes) {
      return bytes.length >= 6 &&
        bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
        bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61;
    },
    codec: { decode },
    parse,
  });

})();
