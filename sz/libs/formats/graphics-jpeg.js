;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU16BE } = F;

  // =========================================================================
  // JPEG marker parser (metadata)
  // =========================================================================

  function parse(bytes) {
    if (bytes.length < 4) return null;
    const markers = [];
    let width = 0, height = 0, components = 0;
    let pos = 2;

    while (pos + 1 < bytes.length) {
      if (bytes[pos] !== 0xFF) { ++pos; continue; }
      const marker = bytes[pos + 1];
      if (marker === 0x00 || marker === 0xFF) { ++pos; continue; }

      if (marker === 0xD9) { markers.push({ marker: 0xD9, name: 'EOI' }); break; }

      if (marker >= 0xD0 && marker <= 0xD7) {
        markers.push({ marker, name: 'RST' + (marker - 0xD0) });
        pos += 2;
        continue;
      }

      if (pos + 3 >= bytes.length) break;
      const segLen = readU16BE(bytes, pos + 2);

      const names = {
        0xC0: 'SOF0 (Baseline)', 0xC1: 'SOF1', 0xC2: 'SOF2 (Progressive)',
        0xC4: 'DHT', 0xDA: 'SOS', 0xDB: 'DQT', 0xE0: 'APP0 (JFIF)',
        0xE1: 'APP1 (Exif)', 0xFE: 'COM',
      };
      markers.push({ marker, name: names[marker] || ('0x' + marker.toString(16).toUpperCase()), offset: pos, length: segLen });

      if ((marker & 0xF0) === 0xC0 && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC && pos + 8 < bytes.length) {
        const precision = bytes[pos + 4];
        height = readU16BE(bytes, pos + 5);
        width = readU16BE(bytes, pos + 7);
        components = bytes[pos + 9];
      }

      pos += 2 + segLen;
    }

    return { width, height, components, markers };
  }

  // =========================================================================
  // Decode via browser canvas
  // =========================================================================

  async function decode(bytes) {
    const blob = new Blob([bytes], { type: 'image/jpeg' });
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

  async function encode(imageData, options) {
    const quality = (options && options.quality) || 0.92;
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(imageData.width, imageData.height)
      : (() => { const c = document.createElement('canvas'); c.width = imageData.width; c.height = imageData.height; return c; })();
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    if (canvas.convertToBlob)
      return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality })).arrayBuffer());
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('JPEG encode failed'));
        blob.arrayBuffer().then(ab => resolve(new Uint8Array(ab)));
      }, 'image/jpeg', quality);
    });
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('jpeg', {
    name: 'JPEG Image',
    category: 'graphics',
    extensions: ['jpg', 'jpeg', 'jpe', 'jfif'],
    mimeTypes: ['image/jpeg'],
    access: 'rw',
    detect(bytes) {
      return bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
    },
    codec: { decode, encode },
    parse,
  });

})();
