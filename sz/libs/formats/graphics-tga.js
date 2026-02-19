;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  const { readU16LE, readU8 } = F;

  // =========================================================================
  // TGA decoder (uncompressed + RLE)
  // =========================================================================

  function parse(bytes) {
    if (bytes.length < 18) return null;
    const idLength = bytes[0];
    const colorMapType = bytes[1];
    const imageType = bytes[2];
    const width = readU16LE(bytes, 12);
    const height = readU16LE(bytes, 14);
    const bpp = bytes[16];
    const descriptor = bytes[17];

    const typeNames = {
      0: 'No Image', 1: 'Color-mapped', 2: 'True-color', 3: 'Grayscale',
      9: 'RLE Color-mapped', 10: 'RLE True-color', 11: 'RLE Grayscale',
    };

    return { width, height, bpp, imageType, imageTypeName: typeNames[imageType] || 'Unknown', colorMapType, descriptor };
  }

  function decode(bytes) {
    if (bytes.length < 18)
      throw new Error('TGA file too small');

    const idLength = bytes[0];
    const colorMapType = bytes[1];
    const imageType = bytes[2];
    const cmapStart = readU16LE(bytes, 3);
    const cmapLength = readU16LE(bytes, 5);
    const cmapBpp = bytes[7];
    const width = readU16LE(bytes, 12);
    const height = readU16LE(bytes, 14);
    const bpp = bytes[16];
    const descriptor = bytes[17];
    const topToBottom = !!(descriptor & 0x20);

    if (width < 1 || height < 1)
      throw new Error('Invalid TGA dimensions');

    let pos = 18 + idLength;

    const palette = [];
    if (colorMapType === 1 && cmapLength > 0) {
      const entryBytes = Math.ceil(cmapBpp / 8);
      for (let i = 0; i < cmapLength; ++i) {
        const off = pos + i * entryBytes;
        if (entryBytes === 3)
          palette.push([bytes[off + 2], bytes[off + 1], bytes[off], 255]);
        else if (entryBytes === 4)
          palette.push([bytes[off + 2], bytes[off + 1], bytes[off], bytes[off + 3]]);
        else if (entryBytes === 2) {
          const px = readU16LE(bytes, off);
          palette.push([((px >> 10) & 0x1F) * 255 / 31, ((px >> 5) & 0x1F) * 255 / 31, (px & 0x1F) * 255 / 31, 255]);
        }
      }
      pos += cmapLength * Math.ceil(cmapBpp / 8);
    }

    const pixelCount = width * height;
    const bytesPerPixel = Math.ceil(bpp / 8);
    const isRLE = imageType >= 9 && imageType <= 11;

    const pixels = new Uint8Array(pixelCount * bytesPerPixel);
    if (isRLE) {
      let pi = 0;
      while (pi < pixelCount && pos < bytes.length) {
        const header = bytes[pos++];
        const count = (header & 0x7F) + 1;
        if (header & 0x80) {
          const pixel = bytes.slice(pos, pos + bytesPerPixel);
          pos += bytesPerPixel;
          for (let i = 0; i < count && pi < pixelCount; ++i, ++pi)
            pixels.set(pixel, pi * bytesPerPixel);
        } else {
          for (let i = 0; i < count && pi < pixelCount; ++i, ++pi) {
            for (let b = 0; b < bytesPerPixel; ++b)
              pixels[pi * bytesPerPixel + b] = bytes[pos + b];
            pos += bytesPerPixel;
          }
        }
      }
    } else {
      const len = Math.min(pixelCount * bytesPerPixel, bytes.length - pos);
      pixels.set(bytes.subarray(pos, pos + len));
    }

    const imageData = typeof ImageData !== 'undefined'
      ? new ImageData(width, height)
      : { width, height, data: new Uint8ClampedArray(width * height * 4) };
    const out = imageData.data;

    for (let y = 0; y < height; ++y) {
      const srcY = topToBottom ? y : (height - 1 - y);
      for (let x = 0; x < width; ++x) {
        const si = (srcY * width + x) * bytesPerPixel;
        const di = (y * width + x) * 4;
        let r = 0, g = 0, b = 0, a = 255;

        if (imageType === 1 || imageType === 9) {
          const idx = pixels[si];
          if (idx < palette.length) [r, g, b, a] = palette[idx];
        } else if (imageType === 3 || imageType === 11) {
          r = g = b = pixels[si];
          if (bytesPerPixel === 2) a = pixels[si + 1];
        } else {
          b = pixels[si]; g = pixels[si + 1]; r = pixels[si + 2];
          if (bytesPerPixel === 4) a = pixels[si + 3];
        }

        out[di] = r; out[di + 1] = g; out[di + 2] = b; out[di + 3] = a;
      }
    }

    return imageData;
  }

  // =========================================================================
  // TGA encoder (uncompressed true-color)
  // =========================================================================

  function encode(imageData, options) {
    const w = imageData.width;
    const h = imageData.height;
    const data = imageData.data;
    const bpp = (options && options.bpp) || 32;
    const bytesPerPixel = bpp / 8;
    const rowSize = w * bytesPerPixel;
    const totalSize = 18 + rowSize * h;
    const buf = new Uint8Array(totalSize);

    buf[2] = 2;
    buf[12] = w & 0xFF; buf[13] = (w >> 8) & 0xFF;
    buf[14] = h & 0xFF; buf[15] = (h >> 8) & 0xFF;
    buf[16] = bpp;
    buf[17] = bpp === 32 ? 0x28 : 0x20;

    for (let y = 0; y < h; ++y) {
      const srcY = h - 1 - y;
      for (let x = 0; x < w; ++x) {
        const si = (srcY * w + x) * 4;
        const di = 18 + (y * w + x) * bytesPerPixel;
        buf[di] = data[si + 2]; buf[di + 1] = data[si + 1]; buf[di + 2] = data[si];
        if (bpp === 32) buf[di + 3] = data[si + 3];
      }
    }

    return buf;
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('tga', {
    name: 'TGA Image',
    category: 'graphics',
    extensions: ['tga', 'tpic'],
    mimeTypes: ['image/x-tga'],
    access: 'rw',
    detect(bytes) {
      if (bytes.length < 18) return false;
      const imageType = bytes[2];
      if (![1, 2, 3, 9, 10, 11].includes(imageType)) return false;
      const w = readU16LE(bytes, 12);
      const h = readU16LE(bytes, 14);
      const bpp = bytes[16];
      return w > 0 && h > 0 && [8, 15, 16, 24, 32].includes(bpp) ? 0.5 : false;
    },
    codec: { decode, encode },
    parse,
  });

})();
