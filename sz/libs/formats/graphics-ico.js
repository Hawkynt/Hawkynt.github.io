;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  // =========================================================================
  // Helper: ImageData factory
  // =========================================================================

  function makeImageData(width, height, imageDataFactory) {
    if (typeof imageDataFactory === 'function')
      return imageDataFactory(width, height);
    if (typeof ImageData !== 'undefined')
      return new ImageData(width, height);
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  }

  // =========================================================================
  // Palette utilities
  // =========================================================================

  function defaultPaletteForBpp(bpp) {
    const size = bpp <= 1 ? 2 : bpp <= 4 ? 16 : bpp <= 8 ? 256 : 0;
    if (!size)
      return null;
    if (size === 2)
      return [[0, 0, 0, 255], [255, 255, 255, 255]];
    const pal = [];
    for (let i = 0; i < size; ++i) {
      const r = ((i >> 5) & 0x07) * 255 / 7;
      const g = ((i >> 2) & 0x07) * 255 / 7;
      const b = (i & 0x03) * 255 / 3;
      pal.push([Math.round(r), Math.round(g), Math.round(b), 255]);
    }
    return pal;
  }

  function nearestPaletteIndex(palette, r, g, b, a) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < palette.length; ++i) {
      const p = palette[i];
      const dr = r - p[0];
      const dg = g - p[1];
      const db = b - p[2];
      const da = a - (p[3] == null ? 255 : p[3]);
      const d = dr * dr + dg * dg + db * db + da * da;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  // =========================================================================
  // BMP entry decoder (ICO-embedded BMP)
  // =========================================================================

  function decodeBmpEntry(data, wHint, hHint, bppHint, options) {
    if (!options) options = {};
    if (!data || data.length < 16)
      throw new Error('BMP entry too small');

    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const headerSize = view.getUint32(0, true);
    let w = Math.max(1, wHint | 0);
    let h = Math.max(1, hHint | 0);
    let actualBpp = bppHint || 32;
    let topDown = false;
    let paletteSize = 0;
    let paletteEntrySize = 4;
    let paletteOffset = headerSize;

    if (headerSize === 12 && data.length >= 12) {
      const cw = view.getUint16(4, true);
      const ch = view.getUint16(6, true);
      const cbpp = view.getUint16(10, true) || actualBpp;
      if (cw > 0) w = cw;
      if (ch > 0) h = Math.max(1, Math.floor(ch / 2));
      actualBpp = cbpp;
      paletteEntrySize = 3;
      paletteOffset = 12;
      if (actualBpp <= 8) paletteSize = (1 << actualBpp);
    } else if (headerSize >= 40 && data.length >= headerSize) {
      const bw = view.getInt32(4, true);
      const bh = view.getInt32(8, true);
      const bbpp = view.getUint16(14, true) || actualBpp;
      const clrUsed = headerSize >= 36 ? view.getUint32(32, true) : 0;
      if (bw !== 0) w = Math.max(1, Math.abs(bw));
      if (bh !== 0) {
        topDown = bh < 0;
        h = Math.max(1, Math.floor(Math.abs(bh) / 2));
      }
      actualBpp = bbpp;
      paletteEntrySize = 4;
      paletteOffset = headerSize;
      if (actualBpp <= 8)
        paletteSize = clrUsed > 0 ? clrUsed : (1 << actualBpp);
    }

    const palette = [];
    for (let i = 0; i < paletteSize; ++i) {
      const off = paletteOffset + i * paletteEntrySize;
      if (off + paletteEntrySize > data.length) break;
      palette.push([data[off + 2], data[off + 1], data[off]]);
    }

    const xorOffset = paletteOffset + paletteSize * paletteEntrySize;
    const xorRowSize = Math.ceil((w * actualBpp) / 8);
    const xorRowPadded = (xorRowSize + 3) & ~3;
    const andRowSize = Math.ceil(w / 8);
    const andRowPadded = (andRowSize + 3) & ~3;

    if (xorOffset >= data.length)
      throw new Error('Invalid BMP entry offsets');

    if (xorOffset + xorRowPadded * h + andRowPadded * h > data.length) {
      const maxRowsWithMask = Math.floor((data.length - xorOffset) / (xorRowPadded + andRowPadded));
      const maxRowsNoMask = Math.floor((data.length - xorOffset) / xorRowPadded);
      h = Math.max(1, Math.min(h, maxRowsWithMask > 0 ? maxRowsWithMask : maxRowsNoMask));
    }

    const andOffset = xorOffset + xorRowPadded * h;
    const hasAndMask = andOffset + andRowPadded * h <= data.length;
    const imageData = makeImageData(w, h, options.imageDataFactory);
    const out = imageData.data;

    for (let y = 0; y < h; ++y) {
      const srcRow = topDown ? y : (h - 1 - y);
      const xorRowOff = xorOffset + srcRow * xorRowPadded;

      for (let x = 0; x < w; ++x) {
        const dstIdx = (y * w + x) * 4;
        let r = 0, g = 0, b = 0, a = 255;

        if (actualBpp === 32) {
          const off = xorRowOff + x * 4;
          b = data[off] || 0; g = data[off + 1] || 0; r = data[off + 2] || 0; a = data[off + 3] ?? 255;
        } else if (actualBpp === 24) {
          const off = xorRowOff + x * 3;
          b = data[off] || 0; g = data[off + 1] || 0; r = data[off + 2] || 0;
        } else if (actualBpp === 8) {
          const idx = data[xorRowOff + x] || 0;
          if (idx < palette.length) [r, g, b] = palette[idx];
        } else if (actualBpp === 4) {
          const v = data[xorRowOff + (x >> 1)] || 0;
          const idx = (x & 1) === 0 ? (v >> 4) : (v & 0x0F);
          if (idx < palette.length) [r, g, b] = palette[idx];
        } else if (actualBpp === 1) {
          const idx = ((data[xorRowOff + (x >> 3)] || 0) >> (7 - (x & 7))) & 1;
          if (idx < palette.length) [r, g, b] = palette[idx];
        } else if (actualBpp === 16) {
          const off = xorRowOff + x * 2;
          const px = (data[off] || 0) | ((data[off + 1] || 0) << 8);
          r = ((px >> 10) & 0x1F) * 255 / 31; g = ((px >> 5) & 0x1F) * 255 / 31; b = (px & 0x1F) * 255 / 31;
        }

        if (actualBpp < 32 && hasAndMask) {
          const andByteOff = andOffset + srcRow * andRowPadded + (x >> 3);
          if (andByteOff < data.length && (((data[andByteOff] || 0) >> (7 - (x & 7))) & 1))
            a = 0;
        }

        out[dstIdx] = r; out[dstIdx + 1] = g; out[dstIdx + 2] = b; out[dstIdx + 3] = a;
      }
    }

    return { imageData, bpp: actualBpp, palette: palette.length > 0 ? palette.map(p => [p[0], p[1], p[2], 255]) : null };
  }

  // =========================================================================
  // ICO/CUR parser
  // =========================================================================

  function parseICO(buffer, options) {
    if (!options) options = {};
    const view = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer, buffer.byteOffset || 0, buffer.byteLength || buffer.length);
    const fileSize = view.byteLength;
    const reserved = view.getUint16(0, true);
    const type = view.getUint16(2, true);
    const count = view.getUint16(4, true);

    if (reserved !== 0 || (type !== 1 && type !== 2))
      throw new Error('Not a valid ICO/CUR file');

    const doc = { type, images: [] };
    const decodeBmp = options.decodeBmpEntry || ((bytes, w, h, bpp) => decodeBmpEntry(bytes, w, h, bpp, options));

    for (let i = 0; i < count; ++i) {
      const offset = 6 + i * 16;
      if (offset + 16 > fileSize) break;

      const w = view.getUint8(offset) || 256;
      const h = view.getUint8(offset + 1) || 256;
      const colorCount = view.getUint8(offset + 2);
      const bpp = view.getUint16(offset + 6, true);
      const dataSize = view.getUint32(offset + 8, true);
      const dataOffset = view.getUint32(offset + 12, true);

      if (dataOffset >= fileSize) continue;
      const maxAvailable = fileSize - dataOffset;
      const safeSize = dataSize > 0 ? Math.min(dataSize, maxAvailable) : maxAvailable;
      if (safeSize <= 0) continue;

      const rawBuf = buffer instanceof ArrayBuffer ? buffer : buffer.buffer;
      const rawOff = (buffer.byteOffset || 0) + dataOffset;
      const entryData = new Uint8Array(rawBuf, rawOff, safeSize);
      if (entryData.length < 4) continue;

      try {
        if (entryData[0] === 0x89 && entryData[1] === 0x50 && entryData[2] === 0x4E && entryData[3] === 0x47) {
          doc.images.push({ width: w, height: h, bpp: bpp || 32, imageData: null, palette: null, pngData: new Uint8Array(entryData) });
        } else {
          const decoded = decodeBmp(entryData, w, h, bpp || (colorCount > 0 ? (colorCount <= 2 ? 1 : colorCount <= 16 ? 4 : 8) : 32));
          doc.images.push({
            width: decoded.imageData.width, height: decoded.imageData.height,
            bpp: bpp || decoded.bpp || (colorCount > 0 ? (colorCount <= 2 ? 1 : colorCount <= 16 ? 4 : 8) : 32),
            imageData: decoded.imageData, palette: decoded.palette || null,
          });
        }
      } catch (_) { /* skip malformed entries */ }
    }

    return doc;
  }

  // =========================================================================
  // BMP entry encoder
  // =========================================================================

  function encodeBmpEntry(img, options) {
    if (!options) options = {};
    const w = img.width;
    const h = img.height;
    const bpp = img.bpp <= 1 ? 1 : img.bpp <= 4 ? 4 : img.bpp <= 8 ? 8 : img.bpp <= 24 ? 24 : 32;
    const data = img.imageData.data;
    const headerSize = 40;
    const palSize = bpp <= 8 ? (1 << bpp) : 0;
    const xorRowSize = Math.ceil((w * bpp) / 8);
    const xorRowPadded = (xorRowSize + 3) & ~3;
    const andRowSize = Math.ceil(w / 8);
    const andRowPadded = (andRowSize + 3) & ~3;
    const paletteBytes = palSize * 4;
    const totalSize = headerSize + paletteBytes + xorRowPadded * h + andRowPadded * h;
    const xorStart = headerSize + paletteBytes;
    const andStart = xorStart + xorRowPadded * h;

    const buf = new Uint8Array(totalSize);
    const view = new DataView(buf.buffer);

    view.setUint32(0, 40, true);
    view.setInt32(4, w, true);
    view.setInt32(8, h * 2, true);
    view.setUint16(12, 1, true);
    view.setUint16(14, bpp, true);
    view.setUint32(16, 0, true);
    view.setUint32(20, xorRowPadded * h + andRowPadded * h, true);
    view.setUint32(32, palSize, true);

    const ensurePalette = options.ensureImagePalette || function(image) {
      if (!image.palette || image.palette.length < palSize)
        image.palette = defaultPaletteForBpp(bpp) || [];
    };
    const nearestIndex = options.nearestPaletteIndex || nearestPaletteIndex;

    let palette = null;
    if (palSize > 0) {
      ensurePalette(img);
      palette = (img.palette || defaultPaletteForBpp(bpp)).slice(0, palSize);
      while (palette.length < palSize) palette.push([0, 0, 0, 255]);
      for (let i = 0; i < palSize; ++i) {
        const p = palette[i];
        const off = headerSize + i * 4;
        buf[off] = p[2] & 255; buf[off + 1] = p[1] & 255; buf[off + 2] = p[0] & 255; buf[off + 3] = 0;
      }
    }

    const keyToIndex = new Map();
    if (palette)
      for (let i = 0; i < palette.length; ++i) {
        const p = palette[i];
        keyToIndex.set((p[0] << 16) | (p[1] << 8) | p[2], i);
      }

    for (let y = 0; y < h; ++y) {
      const srcRow = h - 1 - y;
      const xorOff = xorStart + srcRow * xorRowPadded;
      const andOff = andStart + srcRow * andRowPadded;

      for (let x = 0; x < w; ++x) {
        const si = (y * w + x) * 4;
        const r = data[si], g = data[si + 1], b = data[si + 2], a = data[si + 3];

        if (a < 128)
          buf[andOff + (x >> 3)] |= (1 << (7 - (x & 7)));

        if (bpp === 32) {
          const di = xorOff + x * 4;
          buf[di] = b; buf[di + 1] = g; buf[di + 2] = r; buf[di + 3] = a;
        } else if (bpp === 24) {
          const di = xorOff + x * 3;
          buf[di] = b; buf[di + 1] = g; buf[di + 2] = r;
        } else if (bpp === 8) {
          const key = (r << 16) | (g << 8) | b;
          let idx = keyToIndex.get(key);
          if (idx == null) { idx = nearestIndex(palette, r, g, b, 255); keyToIndex.set(key, idx); }
          buf[xorOff + x] = idx & 0xff;
        } else if (bpp === 4) {
          const key = (r << 16) | (g << 8) | b;
          let idx = keyToIndex.get(key);
          if (idx == null) { idx = nearestIndex(palette, r, g, b, 255); keyToIndex.set(key, idx); }
          const byteOff = xorOff + (x >> 1);
          if ((x & 1) === 0) buf[byteOff] = (buf[byteOff] & 0x0f) | ((idx & 0x0f) << 4);
          else buf[byteOff] = (buf[byteOff] & 0xf0) | (idx & 0x0f);
        } else if (bpp === 1) {
          const key = (r << 16) | (g << 8) | b;
          let idx = keyToIndex.get(key);
          if (idx == null) { idx = nearestIndex(palette, r, g, b, 255); keyToIndex.set(key, idx); }
          if (idx & 1) buf[xorOff + (x >> 3)] |= (1 << (7 - (x & 7)));
        }
      }
    }

    return buf;
  }

  // =========================================================================
  // ICO/CUR writer
  // =========================================================================

  function writeICO(doc, options) {
    if (!options) options = {};
    const entries = [];
    for (const img of doc.images) {
      let entryData;
      if (img.width === 256 && img.height === 256) {
        if (typeof options.encodePngEntry !== 'function')
          throw new Error('encodePngEntry callback required for 256x256 PNG icon entries');
        entryData = options.encodePngEntry(img);
      } else {
        entryData = (options.encodeBmpEntry || ((image) => encodeBmpEntry(image, options)))(img);
      }
      entries.push({ img, data: entryData });
    }

    const headerSize = 6 + doc.images.length * 16;
    let totalSize = headerSize;
    for (const e of entries) totalSize += e.data.length;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    view.setUint16(0, 0, true);
    view.setUint16(2, doc.type, true);
    view.setUint16(4, doc.images.length, true);

    let dataOffset = headerSize;
    for (let i = 0; i < entries.length; ++i) {
      const e = entries[i];
      const entryOff = 6 + i * 16;
      view.setUint8(entryOff, e.img.width >= 256 ? 0 : e.img.width);
      view.setUint8(entryOff + 1, e.img.height >= 256 ? 0 : e.img.height);
      const cc = e.img.bpp <= 8 ? (1 << e.img.bpp) : 0;
      view.setUint8(entryOff + 2, cc >= 256 ? 0 : cc);
      view.setUint8(entryOff + 3, 0);
      view.setUint16(entryOff + 4, 1, true);
      view.setUint16(entryOff + 6, e.img.bpp, true);
      view.setUint32(entryOff + 8, e.data.length, true);
      view.setUint32(entryOff + 12, dataOffset, true);
      bytes.set(e.data, dataOffset);
      dataOffset += e.data.length;
    }

    return buffer;
  }

  // =========================================================================
  // Structured parse for SZ.Formats (returns structured data, not UI fields)
  // =========================================================================

  function parseICOStructured(bytes) {
    try {
      const buffer = bytes instanceof ArrayBuffer ? bytes : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return parseICO(buffer);
    } catch (e) {
      return { type: 0, images: [], error: e.message };
    }
  }

  // =========================================================================
  // Codec API object (backward compat for SZ.System.Drawing.IconCodec)
  // =========================================================================

  const codec = {
    parseICO,
    decodeBmpEntry,
    writeICO,
    encodeBmpEntry,
    defaultPaletteForBpp,
    nearestPaletteIndex,
  };

  // =========================================================================
  // Registration on SZ.Formats
  // =========================================================================

  F.register('ico', {
    name: 'ICO/CUR Icon',
    category: 'graphics',
    extensions: ['ico', 'cur'],
    detect(bytes) {
      if (bytes.length < 6) return false;
      const reserved = bytes[0] | (bytes[1] << 8);
      const type = bytes[2] | (bytes[3] << 8);
      return reserved === 0 && (type === 1 || type === 2);
    },
    parse: parseICOStructured,
    codec,
  });

  // =========================================================================
  // Also register on SZ.System.Drawing.IconCodec for backward compatibility
  // =========================================================================

  SZ.System = SZ.System || {};
  SZ.System.Drawing = SZ.System.Drawing || {};
  SZ.System.Drawing.IconCodec = codec;

})();
