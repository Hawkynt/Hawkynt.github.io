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
  // Encode
  // =========================================================================

  // GIF89a with a fixed 6x7x6 colour cube, Floyd-Steinberg dithering and
  // palette index 255 for transparent pixels.
  function encode(imageData) {
    const { width: w, height: h, data } = imageData;
    const R = 6, G = 7, B = 6;
    const palette = new Uint8Array(256 * 3);
    for (let r = 0; r < R; ++r)
      for (let g = 0; g < G; ++g)
        for (let b = 0; b < B; ++b) {
          const i = (r * G + g) * B + b;
          palette[i * 3] = Math.round(r * 255 / (R - 1));
          palette[i * 3 + 1] = Math.round(g * 255 / (G - 1));
          palette[i * 3 + 2] = Math.round(b * 255 / (B - 1));
        }
    const TRANSPARENT = 255;
    let hasAlpha = false;
    const err = new Float32Array((w + 2) * 2 * 3);
    const indices = new Uint8Array(w * h);
    for (let y = 0; y < h; ++y) {
      const cur = (y & 1) * (w + 2) * 3, next = ((y + 1) & 1) * (w + 2) * 3;
      err.fill(0, next, next + (w + 2) * 3);
      for (let x = 0; x < w; ++x) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 128) {
          indices[y * w + x] = TRANSPARENT;
          hasAlpha = true;
          continue;
        }
        const e = cur + (x + 1) * 3;
        const want = [data[i] + err[e], data[i + 1] + err[e + 1], data[i + 2] + err[e + 2]];
        const r = Math.max(0, Math.min(R - 1, Math.round(want[0] * (R - 1) / 255)));
        const g = Math.max(0, Math.min(G - 1, Math.round(want[1] * (G - 1) / 255)));
        const b = Math.max(0, Math.min(B - 1, Math.round(want[2] * (B - 1) / 255)));
        const idx = (r * G + g) * B + b;
        indices[y * w + x] = idx;
        for (let c = 0; c < 3; ++c) {
          const d = want[c] - palette[idx * 3 + c];
          err[e + 3 + c] += d * 7 / 16;
          err[next + x * 3 + c] += d * 3 / 16;
          err[next + (x + 1) * 3 + c] += d * 5 / 16;
          err[next + (x + 2) * 3 + c] += d / 16;
        }
      }
    }

    const out = [];
    const put = (...b) => { for (const v of b) out.push(v & 255); };
    const word = v => put(v, v >> 8);
    put(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
    word(w); word(h);
    put(0xF7, 0, 0);
    for (let i = 0; i < palette.length; ++i)
      out.push(palette[i]);
    if (hasAlpha)
      put(0x21, 0xF9, 4, 1, 0, 0, TRANSPARENT, 0);
    put(0x2C); word(0); word(0); word(w); word(h); put(0);

    // LZW, 8-bit minimum code size
    const MIN = 8, CLEAR = 1 << MIN, END = CLEAR + 1;
    put(MIN);
    const block = [];
    let acc = 0, bits = 0;
    const flushBlock = () => {
      if (!block.length)
        return;
      out.push(block.length, ...block);
      block.length = 0;
    };
    const emit = (code, size) => {
      acc |= code << bits;
      bits += size;
      while (bits >= 8) {
        block.push(acc & 255);
        acc >>>= 8;
        bits -= 8;
        if (block.length === 255)
          flushBlock();
      }
    };
    let dict = new Map(), next = END + 1, size = MIN + 1;
    emit(CLEAR, size);
    let prefix = indices.length ? indices[0] : 0;
    for (let i = 1; i < indices.length; ++i) {
      const k = indices[i];
      const key = prefix * 256 + k;
      const hit = dict.get(key);
      if (hit !== undefined) {
        prefix = hit;
        continue;
      }
      emit(prefix, size);
      if (next < 4096) {
        dict.set(key, next++);
        if (next > (1 << size) && size < 12)
          ++size;
      } else {
        emit(CLEAR, size);
        dict = new Map();
        next = END + 1;
        size = MIN + 1;
      }
      prefix = k;
    }
    emit(prefix, size);
    emit(END, size);
    if (bits > 0)
      block.push(acc & 255);
    flushBlock();
    put(0, 0x3B);
    return new Uint8Array(out);
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('gif', {
    name: 'GIF Image',
    category: 'graphics',
    extensions: ['gif'],
    mimeTypes: ['image/gif'],
    access: 'rw',
    detect(bytes) {
      return bytes.length >= 6 &&
        bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
        bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61;
    },
    codec: { decode, encode },
    parse,
  });

})();
