;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  // =========================================================================
  // TIFF metadata parser (IFD0 only)
  // =========================================================================

  function parse(bytes) {
    if (bytes.length < 8) return null;

    const le = bytes[0] === 0x49;
    const r16 = le
      ? (o) => bytes[o] | (bytes[o + 1] << 8)
      : (o) => (bytes[o] << 8) | bytes[o + 1];
    const r32 = le
      ? (o) => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
      : (o) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;

    const magic = r16(2);
    if (magic !== 42) return null;

    const ifdOffset = r32(4);
    if (ifdOffset + 2 > bytes.length) return null;

    const entryCount = r16(ifdOffset);
    const tags = {};
    const tagNames = {
      256: 'ImageWidth', 257: 'ImageHeight', 258: 'BitsPerSample',
      259: 'Compression', 262: 'PhotometricInterpretation',
      274: 'Orientation', 277: 'SamplesPerPixel',
      282: 'XResolution', 283: 'YResolution', 296: 'ResolutionUnit',
    };

    for (let i = 0; i < entryCount; ++i) {
      const entryOff = ifdOffset + 2 + i * 12;
      if (entryOff + 12 > bytes.length) break;
      const tag = r16(entryOff);
      const type = r16(entryOff + 2);
      const count = r32(entryOff + 4);
      let value;
      if (type === 3 && count === 1) value = r16(entryOff + 8);
      else if ((type === 4 || type === 1) && count === 1) value = r32(entryOff + 8);
      else value = r32(entryOff + 8);
      const name = tagNames[tag];
      if (name) tags[name] = value;
    }

    return {
      byteOrder: le ? 'little-endian' : 'big-endian',
      width: tags.ImageWidth || 0,
      height: tags.ImageHeight || 0,
      bitsPerSample: tags.BitsPerSample || 0,
      compression: tags.Compression || 0,
      tags,
    };
  }

  // =========================================================================
  // Decode — requires wasm-imagemagick (not yet shipped)
  // =========================================================================

  // async function decode(bytes) {
  //   const Wasm = F.Wasm;
  //   if (!Wasm) return null;
  //   const magick = await Wasm.magick();
  //   if (!magick) return null;
  //   return null;
  // }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('tiff', {
    name: 'TIFF Image',
    category: 'graphics',
    extensions: ['tif', 'tiff'],
    mimeTypes: ['image/tiff'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 4) return false;
      return (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) ||
             (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A);
    },
    codec: {},
    parse,
  });

})();
