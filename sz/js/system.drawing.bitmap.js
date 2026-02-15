;(function(global) {
  'use strict';

  const SZ = global.SZ = global.SZ || {};
  SZ.System = SZ.System || {};
  SZ.System.Drawing = SZ.System.Drawing || {};

  const FORMATS = {
    RGBA32: { bpp: 32, alpha: true },
    BGRA32: { bpp: 32, alpha: true },
    ARGB32: { bpp: 32, alpha: true },
    PARGB32: { bpp: 32, alpha: true, premultiplied: true },
    RGBX32: { bpp: 32, alpha: false },
    RGB24: { bpp: 24, alpha: false },
    BGR24: { bpp: 24, alpha: false },
    RGB565: { bpp: 16, alpha: false },
    RGB555: { bpp: 16, alpha: false },
    ARGB1555: { bpp: 16, alpha: true },
    Gray8: { bpp: 8, alpha: false },
    Gray16: { bpp: 16, alpha: false },
    RGB48: { bpp: 48, alpha: false },
    ARGB64: { bpp: 64, alpha: true },
    PARGB64: { bpp: 64, alpha: true, premultiplied: true },
    Indexed1: { bpp: 1, alpha: true, indexed: true },
    Indexed4: { bpp: 4, alpha: true, indexed: true },
    Indexed8: { bpp: 8, alpha: true, indexed: true }
  };

  const FORMAT_ALIASES = {
    format32bppargb: 'ARGB32',
    format32bpprgb: 'RGBX32',
    format32bpppargb: 'PARGB32',
    format24bpprgb: 'BGR24',
    format16bpprgb565: 'RGB565',
    format16bpprgb555: 'RGB555',
    format16bppargb1555: 'ARGB1555',
    format16bppgrayscale: 'Gray16',
    format8bppindexed: 'Indexed8',
    format4bppindexed: 'Indexed4',
    format1bppindexed: 'Indexed1',
    format48bpprgb: 'RGB48',
    format64bppargb: 'ARGB64',
    format64bpppargb: 'PARGB64',
    rgb32: 'RGBX32',
    rgbx32: 'RGBX32',
    prgba32: 'PARGB32',
    prgba64: 'PARGB64',
    rgba64: 'ARGB64',
    rgb161616: 'RGB48',
    argb16161616: 'ARGB64',
    pargb16161616: 'PARGB64'
  };

  function clamp8(v) {
    return v < 0 ? 0 : (v > 255 ? 255 : (v | 0));
  }

  function clamp5(v) {
    v = v | 0;
    if (v < 0) return 0;
    if (v > 31) return 31;
    return v;
  }

  function clamp6(v) {
    v = v | 0;
    if (v < 0) return 0;
    if (v > 63) return 63;
    return v;
  }

  function clamp16(v) {
    v = v | 0;
    if (v < 0) return 0;
    if (v > 65535) return 65535;
    return v;
  }

  function to8From16(v) {
    return clamp8(Math.round((v * 255) / 65535));
  }

  function to16From8(v) {
    v = clamp8(v);
    return (v << 8) | v;
  }

  function readU16LE(data, off) {
    return data[off] | (data[off + 1] << 8);
  }

  function writeU16LE(data, off, value) {
    value = clamp16(value);
    data[off] = value & 255;
    data[off + 1] = (value >> 8) & 255;
  }

  function normalizeFormat(name) {
    if (!name)
      return 'RGBA32';
    if (FORMATS[name])
      return name;
    const key = String(name).replace(/[\s_\-]/g, '').toLowerCase();
    if (FORMAT_ALIASES[key] && FORMATS[FORMAT_ALIASES[key]])
      return FORMAT_ALIASES[key];
    return 'RGBA32';
  }

  function defaultStride(width, format) {
    const fmt = FORMATS[format];
    const bitsPerRow = width * fmt.bpp;
    return ((bitsPerRow + 31) >> 5) << 2;
  }

  function createDefaultPalette(format) {
    if (format === 'Indexed1')
      return [[0, 0, 0, 255], [255, 255, 255, 255]];
    if (format === 'Indexed4') {
      return [
        [0, 0, 0, 255], [128, 0, 0, 255], [0, 128, 0, 255], [128, 128, 0, 255],
        [0, 0, 128, 255], [128, 0, 128, 255], [0, 128, 128, 255], [192, 192, 192, 255],
        [128, 128, 128, 255], [255, 0, 0, 255], [0, 255, 0, 255], [255, 255, 0, 255],
        [0, 0, 255, 255], [255, 0, 255, 255], [0, 255, 255, 255], [255, 255, 255, 255]
      ];
    }
    if (format === 'Indexed8') {
      const pal = [];
      for (let i = 0; i < 256; ++i)
        pal.push([i, i, i, 255]);
      return pal;
    }
    return null;
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

  class Bitmap {
    constructor(optionsOrWidth, height, pixelFormat) {
      let options;
      if (typeof optionsOrWidth === 'object' && optionsOrWidth && !Array.isArray(optionsOrWidth))
        options = optionsOrWidth;
      else {
        options = {
          width: optionsOrWidth | 0,
          height: height | 0,
          pixelFormat: pixelFormat || 'RGBA32'
        };
      }

      this.width = Math.max(0, options.width | 0);
      this.height = Math.max(0, options.height | 0);
      this.pixelFormat = normalizeFormat(options.pixelFormat || 'RGBA32');
      this.stride = Math.max(defaultStride(this.width, this.pixelFormat), options.stride | 0 || 0);
      this.palette = options.palette
        ? options.palette.map(c => [clamp8(c[0]), clamp8(c[1]), clamp8(c[2]), clamp8(c[3] == null ? 255 : c[3])])
        : createDefaultPalette(this.pixelFormat);

      const byteLength = this.stride * this.height;
      if (options.data instanceof Uint8Array)
        this.data = new Uint8Array(options.data.buffer, options.data.byteOffset, Math.min(options.data.byteLength, byteLength));
      else if (options.data instanceof ArrayBuffer)
        this.data = new Uint8Array(options.data, 0, Math.min(options.data.byteLength, byteLength));
      else if (ArrayBuffer.isView(options.data))
        this.data = new Uint8Array(options.data.buffer, options.data.byteOffset, Math.min(options.data.byteLength, byteLength));
      else
        this.data = new Uint8Array(byteLength);

      if (this.data.byteLength < byteLength) {
        const expanded = new Uint8Array(byteLength);
        expanded.set(this.data);
        this.data = expanded;
      }
    }

    static get PixelFormats() {
      return { ...FORMATS };
    }

    static fromImageData(imageData, options = {}) {
      const src = imageData && imageData.data ? imageData : null;
      if (!src)
        return new Bitmap({ width: 0, height: 0, pixelFormat: 'RGBA32' });
      const tmp = new Bitmap({
        width: src.width,
        height: src.height,
        pixelFormat: 'RGBA32',
        data: new Uint8Array(src.data.buffer.slice(src.data.byteOffset, src.data.byteOffset + src.data.byteLength))
      });
      if (options.pixelFormat && options.pixelFormat !== 'RGBA32')
        return tmp.convertTo(options.pixelFormat, options);
      return tmp;
    }

    static from(source, options = {}) {
      if (!source)
        return new Bitmap({ width: 0, height: 0, pixelFormat: 'RGBA32' });
      if (source instanceof Bitmap) {
        if (options.pixelFormat && options.pixelFormat !== source.pixelFormat)
          return source.convertTo(options.pixelFormat, options);
        return source.clone();
      }
      if (source.data && typeof source.width === 'number' && typeof source.height === 'number') {
        if (source.stride && source.pixelFormat) {
          return new Bitmap({
            width: source.width,
            height: source.height,
            pixelFormat: source.pixelFormat,
            stride: source.stride,
            data: source.data,
            palette: source.palette || options.palette
          });
        }
        return Bitmap.fromImageData(source, options);
      }
      return new Bitmap(options);
    }

    clone() {
      return new Bitmap({
        width: this.width,
        height: this.height,
        pixelFormat: this.pixelFormat,
        stride: this.stride,
        data: new Uint8Array(this.data),
        palette: this.palette ? this.palette.map(c => [c[0], c[1], c[2], c[3]]) : null
      });
    }

    toImageData() {
      const out = new Uint8ClampedArray(this.width * this.height * 4);
      for (let y = 0; y < this.height; ++y)
        for (let x = 0; x < this.width; ++x) {
          const [r, g, b, a] = this.getPixelRGBA(x, y);
          const i = (y * this.width + x) * 4;
          out[i] = r;
          out[i + 1] = g;
          out[i + 2] = b;
          out[i + 3] = a;
        }
      return new ImageData(out, this.width, this.height);
    }

    convertTo(pixelFormat, options = {}) {
      const dstFormat = normalizeFormat(pixelFormat);
      const out = new Bitmap({
        width: this.width,
        height: this.height,
        pixelFormat: dstFormat,
        stride: options.stride || defaultStride(this.width, dstFormat),
        palette: options.palette || (dstFormat.startsWith('Indexed') ? (this.palette || createDefaultPalette(dstFormat)) : null)
      });
      for (let y = 0; y < this.height; ++y)
        for (let x = 0; x < this.width; ++x) {
          const rgba = this.getPixelRGBA(x, y);
          out.setPixelRGBA(x, y, rgba[0], rgba[1], rgba[2], rgba[3]);
        }
      return out;
    }

    _byteOffset(x, y) {
      return y * this.stride + x;
    }

    _indexOffsetForIndexed(x, y, bits) {
      const row = y * this.stride;
      if (bits === 8)
        return [row + x, 0];
      if (bits === 4)
        return [row + (x >> 1), (x & 1) ? 0 : 4];
      return [row + (x >> 3), 7 - (x & 7)];
    }

    getPixelIndex(x, y) {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height)
        return 0;
      if (this.pixelFormat === 'Indexed8')
        return this.data[this._byteOffset(x, y)] | 0;
      if (this.pixelFormat === 'Indexed4') {
        const [off, shift] = this._indexOffsetForIndexed(x, y, 4);
        return shift ? ((this.data[off] >> 4) & 0x0f) : (this.data[off] & 0x0f);
      }
      if (this.pixelFormat === 'Indexed1') {
        const [off, bit] = this._indexOffsetForIndexed(x, y, 1);
        return (this.data[off] >> bit) & 1;
      }
      return 0;
    }

    setPixelIndex(x, y, idx) {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height)
        return;
      idx = idx | 0;
      if (this.pixelFormat === 'Indexed8') {
        this.data[this._byteOffset(x, y)] = idx & 0xff;
        return;
      }
      if (this.pixelFormat === 'Indexed4') {
        const [off, shift] = this._indexOffsetForIndexed(x, y, 4);
        if (shift)
          this.data[off] = (this.data[off] & 0x0f) | ((idx & 0x0f) << 4);
        else
          this.data[off] = (this.data[off] & 0xf0) | (idx & 0x0f);
        return;
      }
      if (this.pixelFormat === 'Indexed1') {
        const [off, bit] = this._indexOffsetForIndexed(x, y, 1);
        const mask = 1 << bit;
        if (idx & 1)
          this.data[off] |= mask;
        else
          this.data[off] &= ~mask;
      }
    }

    getPixelRGBA(x, y) {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height)
        return [0, 0, 0, 0];

      const row = y * this.stride;
      switch (this.pixelFormat) {
        case 'RGBA32': {
          const o = row + x * 4;
          return [this.data[o], this.data[o + 1], this.data[o + 2], this.data[o + 3]];
        }
        case 'BGRA32': {
          const o = row + x * 4;
          return [this.data[o + 2], this.data[o + 1], this.data[o], this.data[o + 3]];
        }
        case 'ARGB32': {
          const o = row + x * 4;
          return [this.data[o + 1], this.data[o + 2], this.data[o + 3], this.data[o]];
        }
        case 'PARGB32': {
          const o = row + x * 4;
          const a = this.data[o];
          if (a === 0)
            return [0, 0, 0, 0];
          const s = 255 / a;
          return [
            clamp8(Math.round(this.data[o + 1] * s)),
            clamp8(Math.round(this.data[o + 2] * s)),
            clamp8(Math.round(this.data[o + 3] * s)),
            a
          ];
        }
        case 'RGBX32': {
          const o = row + x * 4;
          return [this.data[o + 2], this.data[o + 1], this.data[o], 255];
        }
        case 'RGB24': {
          const o = row + x * 3;
          return [this.data[o], this.data[o + 1], this.data[o + 2], 255];
        }
        case 'BGR24': {
          const o = row + x * 3;
          return [this.data[o + 2], this.data[o + 1], this.data[o], 255];
        }
        case 'RGB565': {
          const o = row + x * 2;
          const v = readU16LE(this.data, o);
          const r = ((v >> 11) & 31) * 255 / 31;
          const g = ((v >> 5) & 63) * 255 / 63;
          const b = (v & 31) * 255 / 31;
          return [clamp8(r), clamp8(g), clamp8(b), 255];
        }
        case 'RGB555': {
          const o = row + x * 2;
          const v = readU16LE(this.data, o);
          const r = ((v >> 10) & 31) * 255 / 31;
          const g = ((v >> 5) & 31) * 255 / 31;
          const b = (v & 31) * 255 / 31;
          return [clamp8(r), clamp8(g), clamp8(b), 255];
        }
        case 'ARGB1555': {
          const o = row + x * 2;
          const v = readU16LE(this.data, o);
          const a = (v & 0x8000) ? 255 : 0;
          const r = ((v >> 10) & 31) * 255 / 31;
          const g = ((v >> 5) & 31) * 255 / 31;
          const b = (v & 31) * 255 / 31;
          return [clamp8(r), clamp8(g), clamp8(b), a];
        }
        case 'Gray8': {
          const v = this.data[row + x];
          return [v, v, v, 255];
        }
        case 'Gray16': {
          const o = row + x * 2;
          const y16 = readU16LE(this.data, o);
          const y8 = to8From16(y16);
          return [y8, y8, y8, 255];
        }
        case 'RGB48': {
          const o = row + x * 6;
          const r = to8From16(readU16LE(this.data, o));
          const g = to8From16(readU16LE(this.data, o + 2));
          const b = to8From16(readU16LE(this.data, o + 4));
          return [r, g, b, 255];
        }
        case 'ARGB64': {
          const o = row + x * 8;
          const a = to8From16(readU16LE(this.data, o));
          const r = to8From16(readU16LE(this.data, o + 2));
          const g = to8From16(readU16LE(this.data, o + 4));
          const b = to8From16(readU16LE(this.data, o + 6));
          return [r, g, b, a];
        }
        case 'PARGB64': {
          const o = row + x * 8;
          const a16 = readU16LE(this.data, o);
          const a = to8From16(a16);
          if (a === 0)
            return [0, 0, 0, 0];
          const rPm = to8From16(readU16LE(this.data, o + 2));
          const gPm = to8From16(readU16LE(this.data, o + 4));
          const bPm = to8From16(readU16LE(this.data, o + 6));
          const s = 255 / a;
          return [
            clamp8(Math.round(rPm * s)),
            clamp8(Math.round(gPm * s)),
            clamp8(Math.round(bPm * s)),
            a
          ];
        }
        case 'Indexed1':
        case 'Indexed4':
        case 'Indexed8': {
          const idx = this.getPixelIndex(x, y);
          const p = this.palette && this.palette[idx] ? this.palette[idx] : [0, 0, 0, 255];
          return [p[0], p[1], p[2], p[3] == null ? 255 : p[3]];
        }
      }
      return [0, 0, 0, 0];
    }

    setPixelRGBA(x, y, r, g, b, a) {
      if (x < 0 || y < 0 || x >= this.width || y >= this.height)
        return;
      r = clamp8(r); g = clamp8(g); b = clamp8(b); a = clamp8(a);
      const row = y * this.stride;
      switch (this.pixelFormat) {
        case 'RGBA32': {
          const o = row + x * 4;
          this.data[o] = r; this.data[o + 1] = g; this.data[o + 2] = b; this.data[o + 3] = a;
          return;
        }
        case 'BGRA32': {
          const o = row + x * 4;
          this.data[o] = b; this.data[o + 1] = g; this.data[o + 2] = r; this.data[o + 3] = a;
          return;
        }
        case 'ARGB32': {
          const o = row + x * 4;
          this.data[o] = a; this.data[o + 1] = r; this.data[o + 2] = g; this.data[o + 3] = b;
          return;
        }
        case 'PARGB32': {
          const o = row + x * 4;
          const p = a / 255;
          this.data[o] = a;
          this.data[o + 1] = clamp8(Math.round(r * p));
          this.data[o + 2] = clamp8(Math.round(g * p));
          this.data[o + 3] = clamp8(Math.round(b * p));
          return;
        }
        case 'RGBX32': {
          const o = row + x * 4;
          this.data[o] = b; this.data[o + 1] = g; this.data[o + 2] = r; this.data[o + 3] = 255;
          return;
        }
        case 'RGB24': {
          const o = row + x * 3;
          this.data[o] = r; this.data[o + 1] = g; this.data[o + 2] = b;
          return;
        }
        case 'BGR24': {
          const o = row + x * 3;
          this.data[o] = b; this.data[o + 1] = g; this.data[o + 2] = r;
          return;
        }
        case 'RGB565': {
          const o = row + x * 2;
          const rv = clamp5(Math.round(r * 31 / 255));
          const gv = clamp6(Math.round(g * 63 / 255));
          const bv = clamp5(Math.round(b * 31 / 255));
          const v = (rv << 11) | (gv << 5) | bv;
          writeU16LE(this.data, o, v);
          return;
        }
        case 'RGB555': {
          const o = row + x * 2;
          const rv = clamp5(Math.round(r * 31 / 255));
          const gv = clamp5(Math.round(g * 31 / 255));
          const bv = clamp5(Math.round(b * 31 / 255));
          const v = (rv << 10) | (gv << 5) | bv;
          writeU16LE(this.data, o, v);
          return;
        }
        case 'ARGB1555': {
          const o = row + x * 2;
          const av = a >= 128 ? 1 : 0;
          const rv = clamp5(Math.round(r * 31 / 255));
          const gv = clamp5(Math.round(g * 31 / 255));
          const bv = clamp5(Math.round(b * 31 / 255));
          const v = (av << 15) | (rv << 10) | (gv << 5) | bv;
          writeU16LE(this.data, o, v);
          return;
        }
        case 'Gray8': {
          this.data[row + x] = clamp8(Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b));
          return;
        }
        case 'Gray16': {
          const o = row + x * 2;
          const y = clamp8(Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b));
          writeU16LE(this.data, o, to16From8(y));
          return;
        }
        case 'RGB48': {
          const o = row + x * 6;
          writeU16LE(this.data, o, to16From8(r));
          writeU16LE(this.data, o + 2, to16From8(g));
          writeU16LE(this.data, o + 4, to16From8(b));
          return;
        }
        case 'ARGB64': {
          const o = row + x * 8;
          writeU16LE(this.data, o, to16From8(a));
          writeU16LE(this.data, o + 2, to16From8(r));
          writeU16LE(this.data, o + 4, to16From8(g));
          writeU16LE(this.data, o + 6, to16From8(b));
          return;
        }
        case 'PARGB64': {
          const o = row + x * 8;
          const a16 = to16From8(a);
          writeU16LE(this.data, o, a16);
          const p = a / 255;
          writeU16LE(this.data, o + 2, to16From8(clamp8(Math.round(r * p))));
          writeU16LE(this.data, o + 4, to16From8(clamp8(Math.round(g * p))));
          writeU16LE(this.data, o + 6, to16From8(clamp8(Math.round(b * p))));
          return;
        }
        case 'Indexed1':
        case 'Indexed4':
        case 'Indexed8': {
          if (!this.palette)
            this.palette = createDefaultPalette(this.pixelFormat) || [[0, 0, 0, 255], [255, 255, 255, 255]];
          const idx = nearestPaletteIndex(this.palette, r, g, b, a);
          this.setPixelIndex(x, y, idx);
          return;
        }
      }
    }

    forEachPixel(callback) {
      for (let y = 0; y < this.height; ++y)
        for (let x = 0; x < this.width; ++x)
          callback(x, y, this.getPixelRGBA(x, y));
    }

    countDistinctOpaqueColors(limit = 4096) {
      const seen = new Set();
      for (let y = 0; y < this.height; ++y)
        for (let x = 0; x < this.width; ++x) {
          const p = this.getPixelRGBA(x, y);
          if (p[3] < 128)
            continue;
          seen.add((p[0] << 16) | (p[1] << 8) | p[2]);
          if (seen.size > limit)
            return seen.size;
        }
      return seen.size;
    }

    sampleOpaquePixels(maxSamples = 16384) {
      const total = this.width * this.height;
      const step = Math.max(1, Math.ceil(total / maxSamples));
      const out = [];
      let k = 0;
      for (let y = 0; y < this.height; ++y)
        for (let x = 0; x < this.width; ++x, ++k) {
          if ((k % step) !== 0)
            continue;
          const p = this.getPixelRGBA(x, y);
          if (p[3] < 128)
            continue;
          out.push([p[0], p[1], p[2]]);
        }
      return out;
    }
  }

  Bitmap.defaultStride = defaultStride;
  Bitmap.defaultPalette = createDefaultPalette;
  Bitmap.nearestPaletteIndex = nearestPaletteIndex;

  SZ.System.Drawing.Bitmap = Bitmap;
})(window);
