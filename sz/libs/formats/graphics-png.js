;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU32BE, readU8 } = F;

  // =========================================================================
  // PNG chunk parser (metadata only)
  // =========================================================================

  function parseChunks(bytes) {
    const chunks = [];
    if (bytes.length < 8) return chunks;

    let pos = 8;
    while (pos + 8 <= bytes.length) {
      const length = readU32BE(bytes, pos);
      const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
      chunks.push({ type, offset: pos, dataOffset: pos + 8, length });
      pos += 12 + length;
    }
    return chunks;
  }

  function parse(bytes) {
    if (bytes.length < 24) return null;
    const chunks = parseChunks(bytes);
    const ihdr = chunks.find(c => c.type === 'IHDR');
    if (!ihdr) return null;

    const off = ihdr.dataOffset;
    return {
      width: readU32BE(bytes, off),
      height: readU32BE(bytes, off + 4),
      bitDepth: readU8(bytes, off + 8),
      colorType: readU8(bytes, off + 9),
      compression: readU8(bytes, off + 10),
      filter: readU8(bytes, off + 11),
      interlace: readU8(bytes, off + 12),
      chunks: chunks.map(c => c.type),
    };
  }

  // =========================================================================
  // Decode via browser canvas
  // =========================================================================

  async function decode(bytes) {
    const blob = new Blob([bytes], { type: 'image/png' });
    const bitmap = await createImageBitmap(blob);
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : (() => { const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height; return c; })();
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  }

  // =========================================================================
  // Encode via canvas.toBlob
  // =========================================================================

  async function encode(imageData) {
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(imageData.width, imageData.height)
      : (() => { const c = document.createElement('canvas'); c.width = imageData.width; c.height = imageData.height; return c; })();
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    if (canvas.convertToBlob)
      return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('PNG encode failed'));
        blob.arrayBuffer().then(ab => resolve(new Uint8Array(ab)));
      }, 'image/png');
    });
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('png', {
    name: 'PNG Image',
    category: 'graphics',
    extensions: ['png'],
    mimeTypes: ['image/png'],
    access: 'rw',
    detect(bytes) {
      return bytes.length >= 8 &&
        bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
        bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A;
    },
    codec: { decode, encode },
    parse,
  });

})();
