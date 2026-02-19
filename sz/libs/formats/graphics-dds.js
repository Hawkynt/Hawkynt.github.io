;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU32LE } = F;

  // =========================================================================
  // DDS metadata parser
  // =========================================================================

  function parse(bytes) {
    if (bytes.length < 128) return null;

    const headerSize = readU32LE(bytes, 4);
    const flags = readU32LE(bytes, 8);
    const height = readU32LE(bytes, 12);
    const width = readU32LE(bytes, 16);
    const pitchOrLinear = readU32LE(bytes, 20);
    const depth = readU32LE(bytes, 24);
    const mipMapCount = readU32LE(bytes, 28);

    const pfFlags = readU32LE(bytes, 80);
    const fourCC = String.fromCharCode(bytes[84], bytes[85], bytes[86], bytes[87]);
    const rgbBitCount = readU32LE(bytes, 88);

    let format = 'Unknown';
    if (pfFlags & 0x04)
      format = fourCC;
    else if (pfFlags & 0x40)
      format = rgbBitCount + '-bit RGB';
    else if (pfFlags & 0x41)
      format = rgbBitCount + '-bit RGBA';

    return { width, height, depth, mipMapCount, format, fourCC, flags };
  }

  // =========================================================================
  // DDS decoder (DXT1/DXT5 basic support)
  // =========================================================================

  function _decodeDXT1Block(bytes, off) {
    const c0 = bytes[off] | (bytes[off + 1] << 8);
    const c1 = bytes[off + 2] | (bytes[off + 3] << 8);
    const r0 = ((c0 >> 11) & 0x1F) * 255 / 31;
    const g0 = ((c0 >> 5) & 0x3F) * 255 / 63;
    const b0 = (c0 & 0x1F) * 255 / 31;
    const r1 = ((c1 >> 11) & 0x1F) * 255 / 31;
    const g1 = ((c1 >> 5) & 0x3F) * 255 / 63;
    const b1 = (c1 & 0x1F) * 255 / 31;

    const colors = [
      [r0, g0, b0, 255],
      [r1, g1, b1, 255],
    ];

    if (c0 > c1) {
      colors.push([(2 * r0 + r1) / 3, (2 * g0 + g1) / 3, (2 * b0 + b1) / 3, 255]);
      colors.push([(r0 + 2 * r1) / 3, (g0 + 2 * g1) / 3, (b0 + 2 * b1) / 3, 255]);
    } else {
      colors.push([(r0 + r1) / 2, (g0 + g1) / 2, (b0 + b1) / 2, 255]);
      colors.push([0, 0, 0, 0]);
    }

    const pixels = [];
    for (let i = 0; i < 4; ++i) {
      const bits = bytes[off + 4 + i];
      for (let j = 0; j < 4; ++j)
        pixels.push(colors[(bits >> (j * 2)) & 0x03]);
    }
    return pixels;
  }

  function decode(bytes) {
    const meta = parse(bytes);
    if (!meta) throw new Error('Invalid DDS file');

    const { width, height, fourCC } = meta;
    if (fourCC !== 'DXT1' && fourCC !== 'DXT5')
      throw new Error('Unsupported DDS format: ' + fourCC);

    const imageData = typeof ImageData !== 'undefined'
      ? new ImageData(width, height)
      : { width, height, data: new Uint8ClampedArray(width * height * 4) };
    const out = imageData.data;

    const blocksX = Math.ceil(width / 4);
    const blocksY = Math.ceil(height / 4);
    const blockSize = fourCC === 'DXT1' ? 8 : 16;
    let pos = 128;

    for (let by = 0; by < blocksY; ++by) {
      for (let bx = 0; bx < blocksX; ++bx) {
        let alphas = null;
        if (fourCC === 'DXT5') {
          const a0 = bytes[pos]; const a1 = bytes[pos + 1];
          const alphaLookup = [a0, a1];
          if (a0 > a1) {
            for (let i = 1; i <= 6; ++i) alphaLookup.push(((6 - i) * a0 + i * a1) / 6);
          } else {
            for (let i = 1; i <= 4; ++i) alphaLookup.push(((4 - i) * a0 + i * a1) / 4);
            alphaLookup.push(0, 255);
          }
          const bits48 = [];
          for (let i = 2; i < 8; ++i) bits48.push(bytes[pos + i]);
          alphas = [];
          let bitPos = 0;
          for (let i = 0; i < 16; ++i) {
            const byteIdx = Math.floor(bitPos / 8);
            const bitIdx = bitPos % 8;
            const val = ((bits48[byteIdx] >> bitIdx) | (byteIdx + 1 < 6 ? (bits48[byteIdx + 1] << (8 - bitIdx)) : 0)) & 0x07;
            alphas.push(alphaLookup[val]);
            bitPos += 3;
          }
          pos += 8;
        }

        const pixels = _decodeDXT1Block(bytes, pos);
        pos += 8;

        for (let py = 0; py < 4; ++py) {
          for (let px = 0; px < 4; ++px) {
            const x = bx * 4 + px;
            const y = by * 4 + py;
            if (x >= width || y >= height) continue;
            const di = (y * width + x) * 4;
            const pixel = pixels[py * 4 + px];
            out[di] = pixel[0]; out[di + 1] = pixel[1]; out[di + 2] = pixel[2];
            out[di + 3] = alphas ? alphas[py * 4 + px] : pixel[3];
          }
        }
      }
    }

    return imageData;
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('dds', {
    name: 'DDS Surface',
    category: 'graphics',
    extensions: ['dds'],
    mimeTypes: ['image/vnd-ms.dds'],
    access: 'ro',
    detect(bytes) {
      return bytes.length >= 4 && bytes[0] === 0x44 && bytes[1] === 0x44 && bytes[2] === 0x53 && bytes[3] === 0x20;
    },
    codec: { decode },
    parse,
  });

})();
