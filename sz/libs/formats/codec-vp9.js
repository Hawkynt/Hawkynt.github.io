;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});
  const U = F.Utils || {};

  const BitstreamReader = U.BitstreamReader;

  // =========================================================================
  // VP9 color space names
  // =========================================================================

  const VP9_COLOR_SPACES = [
    'Unknown', 'BT.601', 'BT.709', 'SMPTE-170',
    'SMPTE-240', 'BT.2020', 'Reserved', 'sRGB',
  ];

  // =========================================================================
  // VP9 frame parser
  // =========================================================================

  function parseVP9Frame(bytes, offset) {
    const off = offset || 0;
    if (off + 4 > bytes.length)
      return null;

    const bs = new BitstreamReader(bytes, off);

    const frame_marker = bs.readBits(2);
    if (frame_marker !== 2)
      return null;

    const profile_low = bs.readBit();
    const profile_high = bs.readBit();
    const profile = (profile_high << 1) | profile_low;

    if (profile === 3)
      bs.readBit();

    const show_existing_frame = bs.readBit();
    if (show_existing_frame) {
      const frame_to_show = bs.readBits(3);
      return {
        keyFrame: false,
        profile,
        showExistingFrame: true,
        frameToShow: frame_to_show,
        showFrame: true,
        width: null,
        height: null,
        colorSpace: null,
      };
    }

    const frame_type = bs.readBit();
    const show_frame = bs.readBit();
    const error_resilient = bs.readBit();
    const keyFrame = frame_type === 0;

    let width = null;
    let height = null;
    let colorSpace = null;
    let colorRange = null;

    if (keyFrame) {
      const sync1 = bs.readBits(8);
      const sync2 = bs.readBits(8);
      const sync3 = bs.readBits(8);
      if (sync1 !== 0x49 || sync2 !== 0x83 || sync3 !== 0x42)
        return null;

      if (profile >= 2)
        bs.readBit();

      const cs = bs.readBits(3);
      colorSpace = VP9_COLOR_SPACES[cs] || 'Unknown';

      if (cs !== 7) {
        colorRange = bs.readBit() ? 'Full' : 'Studio';
        if (profile === 1 || profile === 3) {
          bs.readBit();
          bs.readBit();
          bs.readBit();
        }
      } else {
        colorRange = 'Full';
        if (profile === 1 || profile === 3)
          bs.readBit();
      }

      width = bs.readBits(16) + 1;
      height = bs.readBits(16) + 1;
    }

    return {
      keyFrame,
      profile,
      showExistingFrame: false,
      showFrame: !!show_frame,
      errorResilient: !!error_resilient,
      width,
      height,
      colorSpace,
      colorRange,
    };
  }

  // =========================================================================
  // Registration + backward compat
  // =========================================================================

  F.register('vp9', {
    name: 'VP9 Video',
    category: 'video',
    extensions: ['vp9'],
    mimeTypes: ['video/vp9'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 4) return false;
      return ((bytes[0] >> 6) & 0x03) === 2;
    },
    codec: { parseVP9Frame },
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Video = F.Codecs.Video || {};
  F.Codecs.Video.parseVP9Frame = parseVP9Frame;
  F.Codecs.Video.VP9_COLOR_SPACES = VP9_COLOR_SPACES;

})();
