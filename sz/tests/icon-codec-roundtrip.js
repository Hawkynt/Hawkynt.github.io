const assert = require('node:assert/strict');
const IconCodec = require('../js/icon-codec.js');

function makeImageData(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

function setPixel(imageData, x, y, r, g, b, a) {
  const i = (y * imageData.width + x) * 4;
  imageData.data[i] = r;
  imageData.data[i + 1] = g;
  imageData.data[i + 2] = b;
  imageData.data[i + 3] = a;
}

function getPixel(imageData, x, y) {
  const i = (y * imageData.width + x) * 4;
  return [
    imageData.data[i],
    imageData.data[i + 1],
    imageData.data[i + 2],
    imageData.data[i + 3]
  ];
}

function assertImagesEqual(actual, expected, alphaMode) {
  assert.equal(actual.width, expected.width);
  assert.equal(actual.height, expected.height);
  for (let y = 0; y < actual.height; ++y) {
    for (let x = 0; x < actual.width; ++x) {
      const a = getPixel(actual, x, y);
      const e = getPixel(expected, x, y);
      const expectedAlpha = alphaMode === 'threshold' ? (e[3] < 128 ? 0 : 255) : e[3];
      assert.deepEqual(a, [e[0], e[1], e[2], expectedAlpha], `pixel mismatch at ${x},${y}`);
    }
  }
}

function makePalette(size) {
  const out = [];
  for (let i = 0; i < size; ++i) {
    const r = ((i >> 5) & 0x07) * 255 / 7;
    const g = ((i >> 2) & 0x07) * 255 / 7;
    const b = (i & 0x03) * 255 / 3;
    out.push([Math.round(r), Math.round(g), Math.round(b), 255]);
  }
  return out;
}

function runRoundTrip(name, spec) {
  const width = spec.width || 16;
  const height = spec.height || 16;
  const imageData = makeImageData(width, height);
  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const [r, g, b, a] = spec.fillPixel(x, y, spec.palette);
      setPixel(imageData, x, y, r, g, b, a);
    }
  }

  const source = { type: 1, images: [{ width, height, bpp: spec.bpp, imageData, palette: spec.palette || null }] };
  const encoded = IconCodec.writeICO(source);
  const decoded = IconCodec.parseICO(encoded, {
    imageDataFactory: (w, h) => makeImageData(w, h)
  });

  assert.equal(decoded.images.length, 1, `${name}: image count mismatch`);
  const img = decoded.images[0];
  assert.equal(img.width, width, `${name}: width mismatch`);
  assert.equal(img.height, height, `${name}: height mismatch`);
  assert.equal(img.bpp, spec.bpp, `${name}: bpp mismatch`);
  assertImagesEqual(img.imageData, imageData, spec.alphaMode);
}

const tests = [
  {
    name: '32bpp',
    bpp: 32,
    alphaMode: 'exact',
    fillPixel: (x, y) => [x * 13 % 256, y * 17 % 256, (x * 7 + y * 11) % 256, (x * 19 + y * 23) % 256]
  },
  {
    name: '24bpp',
    bpp: 24,
    alphaMode: 'threshold',
    fillPixel: (x, y) => [x * 9 % 256, y * 5 % 256, (x * 3 + y * 7) % 256, (x + y) % 3 === 0 ? 0 : 255]
  },
  {
    name: '8bpp',
    bpp: 8,
    palette: makePalette(256),
    alphaMode: 'threshold',
    fillPixel: (x, y, pal) => {
      const idx = (x * 11 + y * 17) & 255;
      const p = pal[idx];
      return [p[0], p[1], p[2], (x + y) % 4 === 0 ? 0 : 255];
    }
  },
  {
    name: '4bpp',
    bpp: 4,
    palette: makePalette(16),
    alphaMode: 'threshold',
    fillPixel: (x, y, pal) => {
      const idx = (x + y * 3) & 15;
      const p = pal[idx];
      return [p[0], p[1], p[2], (x + y) % 5 === 0 ? 0 : 255];
    }
  },
  {
    name: '1bpp',
    bpp: 1,
    palette: [[0, 0, 0, 255], [255, 255, 255, 255]],
    alphaMode: 'threshold',
    fillPixel: (x, y) => {
      const on = ((x >> 1) + (y >> 1)) & 1;
      return on ? [255, 255, 255, ((x + y) % 2 ? 255 : 0)] : [0, 0, 0, ((x + y) % 3 ? 255 : 0)];
    }
  }
];

let passed = 0;
for (const t of tests) {
  runRoundTrip(t.name, t);
  passed++;
}

function build4bppIco(width, height) {
  const bpp = 4;
  const headerSize = 40;
  const paletteSize = 16;
  const paletteBytes = paletteSize * 4;
  const xorRowSize = Math.ceil((width * bpp) / 8);
  const xorRowPadded = (xorRowSize + 3) & ~3;
  const andRowSize = Math.ceil(width / 8);
  const andRowPadded = (andRowSize + 3) & ~3;
  const bmpSize = headerSize + paletteBytes + xorRowPadded * height + andRowPadded * height;
  const bmp = new Uint8Array(bmpSize);
  const v = new DataView(bmp.buffer);
  v.setUint32(0, 40, true);
  v.setInt32(4, width, true);
  v.setInt32(8, height * 2, true);
  v.setUint16(12, 1, true);
  v.setUint16(14, bpp, true);
  v.setUint32(16, 0, true);
  v.setUint32(20, xorRowPadded * height + andRowPadded * height, true);
  v.setUint32(32, paletteSize, true);

  for (let i = 0; i < paletteSize; ++i) {
    const off = headerSize + i * 4;
    bmp[off] = (i * 29) & 255;
    bmp[off + 1] = (i * 17) & 255;
    bmp[off + 2] = (i * 53) & 255;
    bmp[off + 3] = 0;
  }

  const xorStart = headerSize + paletteBytes;
  const andStart = xorStart + xorRowPadded * height;
  for (let y = 0; y < height; ++y) {
    const srcRow = height - 1 - y;
    const xorOff = xorStart + srcRow * xorRowPadded;
    const andOff = andStart + srcRow * andRowPadded;
    for (let x = 0; x < width; ++x) {
      const idx = ((x >> 1) + (y % 5) + ((x + y) % 3)) & 15;
      const byteOff = xorOff + (x >> 1);
      if ((x & 1) === 0)
        bmp[byteOff] = (bmp[byteOff] & 0x0f) | (idx << 4);
      else
        bmp[byteOff] = (bmp[byteOff] & 0xf0) | idx;

      if ((x + y) % 11 === 0) {
        const maskByte = andOff + (x >> 3);
        const maskBit = 7 - (x & 7);
        bmp[maskByte] |= (1 << maskBit);
      }
    }
  }

  const ico = new Uint8Array(6 + 16 + bmp.length);
  const iv = new DataView(ico.buffer);
  iv.setUint16(0, 0, true);
  iv.setUint16(2, 1, true);
  iv.setUint16(4, 1, true);
  const off = 6;
  iv.setUint8(off, width);
  iv.setUint8(off + 1, height);
  iv.setUint8(off + 2, 16);
  iv.setUint8(off + 3, 0);
  iv.setUint16(off + 4, 1, true);
  iv.setUint16(off + 6, bpp, true);
  iv.setUint32(off + 8, bmp.length, true);
  iv.setUint32(off + 12, 6 + 16, true);
  ico.set(bmp, 6 + 16);
  return ico.buffer;
}

{
  const width = 32;
  const height = 30;
  const parsed = IconCodec.parseICO(build4bppIco(width, height), {
    imageDataFactory: (w, h) => makeImageData(w, h)
  });
  assert.equal(parsed.images.length, 1, '4bpp handcrafted: image count mismatch');
  const img = parsed.images[0];
  assert.equal(img.width, width, '4bpp handcrafted: width mismatch');
  assert.equal(img.height, height, '4bpp handcrafted: height mismatch');
  assert.equal(img.bpp, 4, '4bpp handcrafted: bpp mismatch');
  const pA = getPixel(img.imageData, 0, 0);
  const pB = getPixel(img.imageData, 31, 29);
  const pC = getPixel(img.imageData, 14, 7);
  assert.notDeepEqual(pA, pB, '4bpp handcrafted: decoded image appears striped/constant');
  assert.notDeepEqual(pB, pC, '4bpp handcrafted: decoded image appears striped/constant');
  passed++;
}

console.log(`icon-codec roundtrip tests passed: ${passed}/${tests.length + 1}`);
