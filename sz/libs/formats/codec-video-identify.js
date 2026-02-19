;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

  // =========================================================================
  // Codec identification helper
  // Requires codec-h264.js, codec-h265.js, codec-vp9.js, codec-av1.js
  // =========================================================================

  function identifyCodec(bytes, offset) {
    const off = offset || 0;
    if (!bytes || bytes.length - off < 4)
      return null;

    const CV = F.Codecs && F.Codecs.Video;
    if (!CV) return null;

    // Try H.264: look for NAL start code followed by SPS (type 7)
    for (let i = off; i < Math.min(off + 1024, bytes.length - 4); ++i) {
      if (bytes[i] === 0 && bytes[i + 1] === 0) {
        let nalStart = -1;
        if (bytes[i + 2] === 1)
          nalStart = i + 3;
        else if (bytes[i + 2] === 0 && i + 3 < bytes.length && bytes[i + 3] === 1)
          nalStart = i + 4;

        if (nalStart >= 0 && nalStart < bytes.length) {
          const nalType264 = bytes[nalStart] & 0x1F;
          const forbiddenBit = (bytes[nalStart] >> 7) & 1;
          const nalRefIdc = (bytes[nalStart] >> 5) & 0x03;

          if (forbiddenBit === 0 && nalType264 === 7 && nalRefIdc !== 0 && CV.parseH264NALUnits) {
            const result = CV.parseH264NALUnits(bytes, off, 32);
            if (result.spsInfo)
              return {
                codec: 'h264',
                profile: result.spsInfo.profile,
                profileName: result.spsInfo.profileName,
                level: result.spsInfo.level,
                width: result.spsInfo.width,
                height: result.spsInfo.height,
              };
          }

          const nalType265 = (bytes[nalStart] >> 1) & 0x3F;
          if (forbiddenBit === 0 && (nalType265 === 32 || nalType265 === 33) && CV.parseH265NALUnits) {
            const result = CV.parseH265NALUnits(bytes, off, 32);
            if (result.spsInfo)
              return {
                codec: 'h265',
                profile: result.spsInfo.profile,
                profileName: result.spsInfo.profileName,
                level: result.spsInfo.level,
                width: result.spsInfo.width,
                height: result.spsInfo.height,
              };
          }
        }
      }
    }

    // Try VP9
    if (((bytes[off] >> 6) & 0x03) === 2 && CV.parseVP9Frame) {
      const vp9 = CV.parseVP9Frame(bytes, off);
      if (vp9 && vp9.keyFrame)
        return {
          codec: 'vp9',
          profile: vp9.profile,
          profileName: 'Profile ' + vp9.profile,
          level: null,
          width: vp9.width,
          height: vp9.height,
        };
    }

    // Try AV1
    const headerByte = bytes[off];
    const obuForbidden = (headerByte >> 7) & 1;
    const obuType = (headerByte >> 3) & 0x0F;
    if (obuForbidden === 0 && (obuType === 1 || obuType === 2) && CV.parseAV1OBUs) {
      const av1 = CV.parseAV1OBUs(bytes, off, 16);
      if (av1.sequenceHeader)
        return {
          codec: 'av1',
          profile: av1.sequenceHeader.profile,
          profileName: av1.sequenceHeader.profileName,
          level: av1.sequenceHeader.level,
          width: av1.sequenceHeader.maxFrameWidth,
          height: av1.sequenceHeader.maxFrameHeight,
        };
    }

    return null;
  }

  // =========================================================================
  // Export + backward compat
  // =========================================================================

  F.Codecs = F.Codecs || {};
  F.Codecs.Video = F.Codecs.Video || {};
  F.Codecs.Video.identifyCodec = identifyCodec;
  F.Codecs.Video.BitstreamReader = (F.Utils && F.Utils.BitstreamReader) || null;

})();
