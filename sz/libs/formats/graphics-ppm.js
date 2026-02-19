;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  // =========================================================================
  // PPM/PGM/PBM family decoder (P1-P6)
  // =========================================================================

  function _skipWhitespaceAndComments(text, pos) {
    while (pos < text.length) {
      if (text[pos] === '#') {
        while (pos < text.length && text[pos] !== '\n') ++pos;
        ++pos;
      } else if (text[pos] <= ' ')
        ++pos;
      else
        break;
    }
    return pos;
  }

  function _readToken(text, pos) {
    pos = _skipWhitespaceAndComments(text, pos);
    let end = pos;
    while (end < text.length && text[end] > ' ') ++end;
    return { value: text.substring(pos, end), end };
  }

  function parse(bytes) {
    if (bytes.length < 3) return null;
    const magic = String.fromCharCode(bytes[0], bytes[1]);
    if (bytes[0] !== 0x50 || bytes[1] < 0x31 || bytes[1] > 0x36) return null;

    const text = new TextDecoder('ascii').decode(bytes.subarray(0, Math.min(256, bytes.length)));
    let pos = 2;
    const w = _readToken(text, pos); pos = w.end;
    const h = _readToken(text, pos); pos = h.end;

    let maxVal = '1';
    if (magic !== 'P1' && magic !== 'P4') {
      const m = _readToken(text, pos); pos = m.end;
      maxVal = m.value;
    }

    return { magic, width: +w.value, height: +h.value, maxVal: +maxVal };
  }

  function decode(bytes) {
    const meta = parse(bytes);
    if (!meta) throw new Error('Invalid PPM/PGM/PBM header');

    const { magic, width, height, maxVal } = meta;
    if (width < 1 || height < 1) throw new Error('Invalid PPM dimensions');

    const imageData = typeof ImageData !== 'undefined'
      ? new ImageData(width, height)
      : { width, height, data: new Uint8ClampedArray(width * height * 4) };
    const out = imageData.data;

    const text = new TextDecoder('ascii').decode(bytes);
    let pos = 2;
    pos = _readToken(text, pos).end;
    pos = _readToken(text, pos).end;
    if (magic !== 'P1' && magic !== 'P4')
      pos = _readToken(text, pos).end;
    pos = _skipWhitespaceAndComments(text, pos);

    if (magic === 'P6') {
      const dataStart = pos;
      const scale = 255 / maxVal;
      for (let i = 0; i < width * height; ++i) {
        const off = dataStart + i * 3;
        const di = i * 4;
        out[di] = Math.round(bytes[off] * scale);
        out[di + 1] = Math.round(bytes[off + 1] * scale);
        out[di + 2] = Math.round(bytes[off + 2] * scale);
        out[di + 3] = 255;
      }
    } else if (magic === 'P5') {
      const dataStart = pos;
      const scale = 255 / maxVal;
      for (let i = 0; i < width * height; ++i) {
        const v = Math.round(bytes[dataStart + i] * scale);
        const di = i * 4;
        out[di] = out[di + 1] = out[di + 2] = v;
        out[di + 3] = 255;
      }
    } else if (magic === 'P4') {
      const dataStart = pos;
      for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
          const byteIdx = dataStart + y * Math.ceil(width / 8) + (x >> 3);
          const bit = (bytes[byteIdx] >> (7 - (x & 7))) & 1;
          const di = (y * width + x) * 4;
          const v = bit ? 0 : 255;
          out[di] = out[di + 1] = out[di + 2] = v;
          out[di + 3] = 255;
        }
      }
    } else if (magic === 'P3') {
      const scale = 255 / maxVal;
      let tp = pos;
      for (let i = 0; i < width * height; ++i) {
        const r = _readToken(text, tp); tp = r.end;
        const g = _readToken(text, tp); tp = g.end;
        const b = _readToken(text, tp); tp = b.end;
        const di = i * 4;
        out[di] = Math.round(+r.value * scale);
        out[di + 1] = Math.round(+g.value * scale);
        out[di + 2] = Math.round(+b.value * scale);
        out[di + 3] = 255;
      }
    } else if (magic === 'P2') {
      const scale = 255 / maxVal;
      let tp = pos;
      for (let i = 0; i < width * height; ++i) {
        const v = _readToken(text, tp); tp = v.end;
        const di = i * 4;
        const val = Math.round(+v.value * scale);
        out[di] = out[di + 1] = out[di + 2] = val;
        out[di + 3] = 255;
      }
    } else if (magic === 'P1') {
      let tp = pos;
      for (let i = 0; i < width * height; ++i) {
        const v = _readToken(text, tp); tp = v.end;
        const di = i * 4;
        const val = +v.value ? 0 : 255;
        out[di] = out[di + 1] = out[di + 2] = val;
        out[di + 3] = 255;
      }
    }

    return imageData;
  }

  // =========================================================================
  // PPM encoder (P6 binary)
  // =========================================================================

  function encode(imageData) {
    const { width, height, data } = imageData;
    const header = 'P6\n' + width + ' ' + height + '\n255\n';
    const headerBytes = new TextEncoder().encode(header);
    const pixelData = new Uint8Array(width * height * 3);

    for (let i = 0; i < width * height; ++i) {
      pixelData[i * 3] = data[i * 4];
      pixelData[i * 3 + 1] = data[i * 4 + 1];
      pixelData[i * 3 + 2] = data[i * 4 + 2];
    }

    const result = new Uint8Array(headerBytes.length + pixelData.length);
    result.set(headerBytes);
    result.set(pixelData, headerBytes.length);
    return result;
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('ppm', {
    name: 'PPM/PGM/PBM Image',
    category: 'graphics',
    extensions: ['ppm', 'pgm', 'pbm', 'pnm'],
    mimeTypes: ['image/x-portable-pixmap', 'image/x-portable-graymap', 'image/x-portable-bitmap'],
    access: 'rw',
    detect(bytes) {
      if (bytes.length < 3) return false;
      return bytes[0] === 0x50 && bytes[1] >= 0x31 && bytes[1] <= 0x36 && (bytes[2] === 0x0A || bytes[2] === 0x20 || bytes[2] === 0x09 || bytes[2] === 0x0D);
    },
    codec: { decode, encode },
    parse,
  });

})();
