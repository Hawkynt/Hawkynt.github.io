;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU16LE } = F;

  // =========================================================================
  // PCX metadata parser
  // =========================================================================

  function parse(bytes) {
    if (bytes.length < 128) return null;
    const manufacturer = bytes[0];
    if (manufacturer !== 0x0A) return null;

    const version = bytes[1];
    const encoding = bytes[2];
    const bpp = bytes[3];
    const xMin = readU16LE(bytes, 4);
    const yMin = readU16LE(bytes, 6);
    const xMax = readU16LE(bytes, 8);
    const yMax = readU16LE(bytes, 10);
    const hDpi = readU16LE(bytes, 12);
    const vDpi = readU16LE(bytes, 14);
    const numPlanes = bytes[65];
    const bytesPerLine = readU16LE(bytes, 66);

    return {
      width: xMax - xMin + 1,
      height: yMax - yMin + 1,
      bpp,
      numPlanes,
      bytesPerLine,
      version,
      encoding: encoding === 1 ? 'RLE' : 'None',
      dpi: { h: hDpi, v: vDpi },
    };
  }

  // =========================================================================
  // PCX decoder (RLE, 8-bit/24-bit)
  // =========================================================================

  function decode(bytes) {
    const meta = parse(bytes);
    if (!meta) throw new Error('Invalid PCX file');

    const { width, height, bpp, numPlanes, bytesPerLine } = meta;
    const totalBytesPerLine = bytesPerLine * numPlanes;

    const scanlines = [];
    let pos = 128;
    for (let y = 0; y < height; ++y) {
      const line = new Uint8Array(totalBytesPerLine);
      let col = 0;
      while (col < totalBytesPerLine && pos < bytes.length) {
        const b = bytes[pos++];
        if ((b & 0xC0) === 0xC0) {
          const count = b & 0x3F;
          const value = pos < bytes.length ? bytes[pos++] : 0;
          for (let i = 0; i < count && col < totalBytesPerLine; ++i)
            line[col++] = value;
        } else
          line[col++] = b;
      }
      scanlines.push(line);
    }

    const imageData = typeof ImageData !== 'undefined'
      ? new ImageData(width, height)
      : { width, height, data: new Uint8ClampedArray(width * height * 4) };
    const out = imageData.data;

    if (numPlanes === 3 && bpp === 8) {
      for (let y = 0; y < height; ++y) {
        const line = scanlines[y];
        for (let x = 0; x < width; ++x) {
          const di = (y * width + x) * 4;
          out[di] = line[x];
          out[di + 1] = line[bytesPerLine + x];
          out[di + 2] = line[bytesPerLine * 2 + x];
          out[di + 3] = 255;
        }
      }
    } else if (numPlanes === 1 && bpp === 8) {
      let palette = null;
      if (bytes.length >= 128 + 769) {
        const palOff = bytes.length - 769;
        if (bytes[palOff] === 12) {
          palette = [];
          for (let i = 0; i < 256; ++i)
            palette.push([bytes[palOff + 1 + i * 3], bytes[palOff + 2 + i * 3], bytes[palOff + 3 + i * 3]]);
        }
      }
      if (!palette) {
        palette = [];
        for (let i = 0; i < 256; ++i) palette.push([i, i, i]);
      }
      for (let y = 0; y < height; ++y) {
        const line = scanlines[y];
        for (let x = 0; x < width; ++x) {
          const idx = line[x];
          const di = (y * width + x) * 4;
          out[di] = palette[idx][0]; out[di + 1] = palette[idx][1]; out[di + 2] = palette[idx][2]; out[di + 3] = 255;
        }
      }
    } else {
      for (let y = 0; y < height; ++y) {
        const line = scanlines[y];
        for (let x = 0; x < width; ++x) {
          const di = (y * width + x) * 4;
          out[di] = line[x] || 0; out[di + 1] = line[x] || 0; out[di + 2] = line[x] || 0; out[di + 3] = 255;
        }
      }
    }

    return imageData;
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('pcx', {
    name: 'PCX Image',
    category: 'graphics',
    extensions: ['pcx'],
    mimeTypes: ['image/x-pcx'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 128) return false;
      if (bytes[0] !== 0x0A) return false;
      const version = bytes[1];
      const bpp = bytes[3];
      const w = readU16LE(bytes, 8) - readU16LE(bytes, 4) + 1;
      const h = readU16LE(bytes, 10) - readU16LE(bytes, 6) + 1;
      return w > 0 && h > 0 && [0, 2, 3, 4, 5].includes(version) && [1, 2, 4, 8].includes(bpp) ? 0.6 : false;
    },
    codec: { decode },
    parse,
  });

})();
