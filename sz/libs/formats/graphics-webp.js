;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU32LE, readU16LE, readString } = F;

  // =========================================================================
  // WebP metadata parser
  // =========================================================================

  function parse(bytes) {
    if (bytes.length < 12) return null;
    const fileSize = readU32LE(bytes, 4) + 8;
    const chunks = [];
    let width = 0, height = 0, format = 'unknown';
    let pos = 12;

    while (pos + 8 <= bytes.length) {
      const fourcc = readString(bytes, pos, 4);
      const size = readU32LE(bytes, pos + 4);
      chunks.push(fourcc);

      if (fourcc === 'VP8 ' && pos + 18 <= bytes.length) {
        format = 'lossy';
        const w = readU16LE(bytes, pos + 14);
        const h = readU16LE(bytes, pos + 16);
        width = w & 0x3FFF;
        height = h & 0x3FFF;
      } else if (fourcc === 'VP8L' && pos + 13 <= bytes.length) {
        format = 'lossless';
        const bits = readU32LE(bytes, pos + 9);
        width = (bits & 0x3FFF) + 1;
        height = ((bits >> 14) & 0x3FFF) + 1;
      } else if (fourcc === 'VP8X' && pos + 18 <= bytes.length) {
        format = 'extended';
        width = ((bytes[pos + 12] | (bytes[pos + 13] << 8) | (bytes[pos + 14] << 16)) & 0xFFFFFF) + 1;
        height = ((bytes[pos + 15] | (bytes[pos + 16] << 8) | (bytes[pos + 17] << 16)) & 0xFFFFFF) + 1;
      }

      pos += 8 + size + (size & 1);
    }

    return { width, height, format, fileSize, chunks };
  }

  // =========================================================================
  // Decode via browser canvas
  // =========================================================================

  async function decode(bytes) {
    const blob = new Blob([bytes], { type: 'image/webp' });
    const bitmap = await createImageBitmap(blob);
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : (() => { const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height; return c; })();
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  }

  // =========================================================================
  // Encode via canvas.toBlob (if browser supports webp)
  // =========================================================================

  async function encode(imageData, options) {
    const quality = (options && options.quality) || 0.80;
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(imageData.width, imageData.height)
      : (() => { const c = document.createElement('canvas'); c.width = imageData.width; c.height = imageData.height; return c; })();
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    if (canvas.convertToBlob) {
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
      if (blob.type === 'image/webp')
        return new Uint8Array(await blob.arrayBuffer());
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob || blob.type !== 'image/webp') return reject(new Error('WebP encode not supported'));
        blob.arrayBuffer().then(ab => resolve(new Uint8Array(ab)));
      }, 'image/webp', quality);
    });
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('webp', {
    name: 'WebP Image',
    category: 'graphics',
    extensions: ['webp'],
    mimeTypes: ['image/webp'],
    access: 'rw',
    detect(bytes) {
      return bytes.length >= 12 &&
        bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    },
    codec: { decode, encode },
    parse,
  });

})();
