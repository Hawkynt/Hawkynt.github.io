;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  // =========================================================================
  // VP8 frame header parser
  // =========================================================================

  function parseVP8Frame(bytes, offset) {
    const off = offset || 0;
    if (off + 10 > bytes.length)
      return null;

    const b0 = bytes[off];
    const b1 = bytes[off + 1];
    const b2 = bytes[off + 2];

    const frameTag = b0 | (b1 << 8) | (b2 << 16);
    const keyFrame = !(frameTag & 0x01);
    const version = (frameTag >> 1) & 0x07;
    const showFrame = !!(frameTag >> 4 & 0x01);
    const firstPartSize = (frameTag >> 5) & 0x7FFFF;

    let width = null;
    let height = null;
    let horizontalScale = 0;
    let verticalScale = 0;

    if (keyFrame) {
      if (off + 9 >= bytes.length) return null;

      const sync0 = bytes[off + 3];
      const sync1 = bytes[off + 4];
      const sync2 = bytes[off + 5];
      if (sync0 !== 0x9D || sync1 !== 0x01 || sync2 !== 0x2A)
        return null;

      const w16 = bytes[off + 6] | (bytes[off + 7] << 8);
      const h16 = bytes[off + 8] | (bytes[off + 9] << 8);
      width = w16 & 0x3FFF;
      height = h16 & 0x3FFF;
      horizontalScale = w16 >> 14;
      verticalScale = h16 >> 14;
    }

    return {
      keyFrame,
      version,
      showFrame,
      firstPartSize,
      width,
      height,
      horizontalScale,
      verticalScale,
    };
  }

  // =========================================================================
  // Registration
  // =========================================================================

  F.register('vp8', {
    name: 'VP8 Video',
    category: 'video',
    extensions: ['vp8'],
    mimeTypes: ['video/vp8'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 10) return false;
      const b0 = bytes[0];
      const keyFrame = !(b0 & 0x01);
      if (!keyFrame) return false;
      return bytes[3] === 0x9D && bytes[4] === 0x01 && bytes[5] === 0x2A;
    },
    codec: { parseVP8Frame },
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Video = F.Codecs.Video || {};
  F.Codecs.Video.parseVP8Frame = parseVP8Frame;

})();
