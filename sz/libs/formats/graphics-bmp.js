;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU16LE, readU32LE, readI32LE } = F;

  // =========================================================================
  // BMP decoder (standalone file, not ICO-embedded)
  // =========================================================================

  function decode(bytes) {
    if (bytes.length < 54)
      throw new Error('BMP file too small');

    const fileSize = readU32LE(bytes, 2);
    const dataOffset = readU32LE(bytes, 10);
    const headerSize = readU32LE(bytes, 14);
    const width = readI32LE(bytes, 18);
    const rawHeight = readI32LE(bytes, 22);
    const topDown = rawHeight < 0;
    const height = Math.abs(rawHeight);
    const planes = readU16LE(bytes, 26);
    const bpp = readU16LE(bytes, 28);
    const compression = readU32LE(bytes, 30);

    if (width < 1 || height < 1)
      throw new Error('Invalid BMP dimensions');

    const clrUsed = headerSize >= 36 ? readU32LE(bytes, 46) : 0;
    const paletteCount = bpp <= 8 ? (clrUsed > 0 ? clrUsed : (1 << bpp)) : 0;
    const paletteOffset = 14 + headerSize;

    const palette = [];
    for (let i = 0; i < paletteCount; ++i) {
      const off = paletteOffset + i * 4;
      if (off + 3 > bytes.length) break;
      palette.push([bytes[off + 2], bytes[off + 1], bytes[off], 255]);
    }

    const rowSize = Math.ceil((width * bpp) / 8);
    const rowPadded = (rowSize + 3) & ~3;

    const imageData = typeof ImageData !== 'undefined'
      ? new ImageData(width, height)
      : { width, height, data: new Uint8ClampedArray(width * height * 4) };
    const out = imageData.data;

    for (let y = 0; y < height; ++y) {
      const srcRow = topDown ? y : (height - 1 - y);
      const rowOff = dataOffset + srcRow * rowPadded;

      for (let x = 0; x < width; ++x) {
        const dstIdx = (y * width + x) * 4;
        let r = 0, g = 0, b = 0, a = 255;

        if (bpp === 32) {
          const off = rowOff + x * 4;
          b = bytes[off] || 0; g = bytes[off + 1] || 0; r = bytes[off + 2] || 0; a = bytes[off + 3] ?? 255;
        } else if (bpp === 24) {
          const off = rowOff + x * 3;
          b = bytes[off] || 0; g = bytes[off + 1] || 0; r = bytes[off + 2] || 0;
        } else if (bpp === 16) {
          const off = rowOff + x * 2;
          const px = (bytes[off] || 0) | ((bytes[off + 1] || 0) << 8);
          r = ((px >> 10) & 0x1F) * 255 / 31;
          g = ((px >> 5) & 0x1F) * 255 / 31;
          b = (px & 0x1F) * 255 / 31;
        } else if (bpp === 8) {
          const idx = bytes[rowOff + x] || 0;
          if (idx < palette.length) [r, g, b, a] = palette[idx];
        } else if (bpp === 4) {
          const v = bytes[rowOff + (x >> 1)] || 0;
          const idx = (x & 1) === 0 ? (v >> 4) : (v & 0x0F);
          if (idx < palette.length) [r, g, b, a] = palette[idx];
        } else if (bpp === 1) {
          const idx = ((bytes[rowOff + (x >> 3)] || 0) >> (7 - (x & 7))) & 1;
          if (idx < palette.length) [r, g, b, a] = palette[idx];
        }

        out[dstIdx] = r; out[dstIdx + 1] = g; out[dstIdx + 2] = b; out[dstIdx + 3] = a;
      }
    }

    return imageData;
  }

  // =========================================================================
  // BMP encoder
  // =========================================================================

  function encode(imageData, options) {
    const bpp = (options && options.bpp) || 24;
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;

    const rowSize = Math.ceil((w * bpp) / 8);
    const rowPadded = (rowSize + 3) & ~3;
    const pixelDataSize = rowPadded * h;
    const headerSize = 14 + 40;
    const totalSize = headerSize + pixelDataSize;

    const buf = new Uint8Array(totalSize);
    const view = new DataView(buf.buffer);

    buf[0] = 0x42; buf[1] = 0x4D;
    view.setUint32(2, totalSize, true);
    view.setUint32(10, headerSize, true);
    view.setUint32(14, 40, true);
    view.setInt32(18, w, true);
    view.setInt32(22, h, true);
    view.setUint16(26, 1, true);
    view.setUint16(28, bpp, true);
    view.setUint32(34, pixelDataSize, true);

    for (let y = 0; y < h; ++y) {
      const srcRow = h - 1 - y;
      const rowOff = headerSize + srcRow * rowPadded;

      for (let x = 0; x < w; ++x) {
        const si = (y * w + x) * 4;
        if (bpp === 32) {
          const di = rowOff + x * 4;
          buf[di] = data[si + 2]; buf[di + 1] = data[si + 1]; buf[di + 2] = data[si]; buf[di + 3] = data[si + 3];
        } else if (bpp === 24) {
          const di = rowOff + x * 3;
          buf[di] = data[si + 2]; buf[di + 1] = data[si + 1]; buf[di + 2] = data[si];
        }
      }
    }

    return buf;
  }

  // =========================================================================
  // Parse metadata
  // =========================================================================

  function parse(bytes) {
    if (bytes.length < 54) return null;
    return {
      width: Math.abs(readI32LE(bytes, 18)),
      height: Math.abs(readI32LE(bytes, 22)),
      bpp: readU16LE(bytes, 28),
      compression: readU32LE(bytes, 30),
      fileSize: readU32LE(bytes, 2),
      dataOffset: readU32LE(bytes, 10),
    };
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('bmp', {
    name: 'BMP Image',
    category: 'graphics',
    extensions: ['bmp', 'dib'],
    mimeTypes: ['image/bmp'],
    access: 'rw',
    detect(bytes) {
      return bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4D;
    },
    codec: { decode, encode },
    parse,
  });

})();
