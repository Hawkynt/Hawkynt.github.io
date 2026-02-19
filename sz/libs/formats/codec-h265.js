;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});
  const U = F.Utils || {};

  const BitstreamReader = U.BitstreamReader;
  const findNALStartCodes = U.findNALStartCodes;
  const removeEmulationPrevention = U.removeEmulationPrevention;

  // =========================================================================
  // H.265/HEVC NAL type names
  // =========================================================================

  const H265_NAL_TYPES = {
    0: 'TRAIL_N',
    1: 'TRAIL_R',
    2: 'TSA_N',
    3: 'TSA_R',
    4: 'STSA_N',
    5: 'STSA_R',
    6: 'RADL_N',
    7: 'RADL_R',
    8: 'RASL_N',
    9: 'RASL_R',
    16: 'BLA_W_LP',
    17: 'BLA_W_RADL',
    18: 'BLA_N_LP',
    19: 'IDR_W_RADL',
    20: 'IDR_N_LP',
    21: 'CRA_NUT',
    32: 'VPS',
    33: 'SPS',
    34: 'PPS',
    35: 'AUD',
    36: 'EOS',
    37: 'EOB',
    38: 'FD',
    39: 'SEI Prefix',
    40: 'SEI Suffix',
  };

  // =========================================================================
  // H.265/HEVC SPS parser
  // =========================================================================

  function parseSPS_H265(nalBytes) {
    const clean = nalBytes instanceof Uint8Array ? removeEmulationPrevention(nalBytes, 0, nalBytes.length) : nalBytes;
    const bs = new BitstreamReader(clean, 2);

    const vps_id = bs.readBits(4);
    const max_sub_layers_minus1 = bs.readBits(3);
    const temporal_id_nesting_flag = bs.readBit();

    const general_profile_space = bs.readBits(2);
    const general_tier_flag = bs.readBit();
    const general_profile_idc = bs.readBits(5);

    const compatFlags = bs.readBits(32);

    const general_progressive_source_flag = bs.readBit();
    const general_interlaced_source_flag = bs.readBit();
    const general_non_packed_constraint_flag = bs.readBit();
    const general_frame_only_constraint_flag = bs.readBit();
    bs.skipBits(44);

    const general_level_idc = bs.readBits(8);

    const subLayerProfilePresent = [];
    const subLayerLevelPresent = [];
    for (let i = 0; i < max_sub_layers_minus1; ++i) {
      subLayerProfilePresent.push(bs.readBit());
      subLayerLevelPresent.push(bs.readBit());
    }

    if (max_sub_layers_minus1 > 0)
      for (let i = max_sub_layers_minus1; i < 8; ++i)
        bs.skipBits(2);

    for (let i = 0; i < max_sub_layers_minus1; ++i) {
      if (subLayerProfilePresent[i])
        bs.skipBits(88);
      if (subLayerLevelPresent[i])
        bs.skipBits(8);
    }

    const sps_id = bs.readUE();
    const chroma_format_idc = bs.readUE();

    if (chroma_format_idc === 3)
      bs.readBit();

    const pic_width = bs.readUE();
    const pic_height = bs.readUE();

    const conformance_window_flag = bs.readBit();
    let cropLeft = 0, cropRight = 0, cropTop = 0, cropBottom = 0;
    if (conformance_window_flag) {
      cropLeft = bs.readUE();
      cropRight = bs.readUE();
      cropTop = bs.readUE();
      cropBottom = bs.readUE();
    }

    const bit_depth_luma = bs.readUE() + 8;
    const bit_depth_chroma = bs.readUE() + 8;

    const subWidthC = chroma_format_idc === 1 || chroma_format_idc === 2 ? 2 : 1;
    const subHeightC = chroma_format_idc === 1 ? 2 : 1;
    const width = pic_width - subWidthC * (cropLeft + cropRight);
    const height = pic_height - subHeightC * (cropTop + cropBottom);

    const profileNames = {
      1: 'Main',
      2: 'Main 10',
      3: 'Main Still Picture',
      4: 'Range Extensions',
      5: 'High Throughput',
      9: 'Screen Content Coding',
      11: 'High Throughput Screen Content Coding',
    };

    return {
      profile: general_profile_idc,
      profileName: profileNames[general_profile_idc] || ('Unknown (' + general_profile_idc + ')'),
      tier: general_tier_flag ? 'High' : 'Main',
      level: general_level_idc / 30,
      width,
      height,
      chromaFormat: chroma_format_idc,
      bitDepthLuma: bit_depth_luma,
      bitDepthChroma: bit_depth_chroma,
    };
  }

  // =========================================================================
  // H.265/HEVC NAL unit parser
  // =========================================================================

  function parseH265NALUnits(bytes, offset, maxUnits) {
    const rawUnits = findNALStartCodes(bytes, offset || 0, maxUnits);
    const units = [];
    let spsInfo = null;
    let vpsCount = 0;
    let ppsCount = 0;
    let idrCount = 0;
    let sliceCount = 0;

    for (const raw of rawUnits) {
      if (raw.offset >= bytes.length) continue;
      const nalType = (bytes[raw.offset] >> 1) & 0x3F;
      const typeName = H265_NAL_TYPES[nalType] || ('Unknown (' + nalType + ')');

      units.push({
        offset: raw.offset,
        length: raw.length,
        type: nalType,
        typeName,
      });

      if (nalType === 33 && !spsInfo) {
        try {
          const nalData = bytes.slice(raw.offset, raw.offset + raw.length);
          spsInfo = parseSPS_H265(nalData);
        } catch (_) { /* malformed SPS */ }
      } else if (nalType === 32)
        ++vpsCount;
      else if (nalType === 34)
        ++ppsCount;
      else if (nalType === 19 || nalType === 20)
        ++idrCount;
      else if (nalType >= 0 && nalType <= 9)
        ++sliceCount;
    }

    return { units, spsInfo, vpsCount, ppsCount, idrCount, sliceCount };
  }

  // =========================================================================
  // Registration + backward compat
  // =========================================================================

  F.register('h265', {
    name: 'H.265/HEVC Video',
    category: 'video',
    extensions: ['h265', '265', 'hevc'],
    mimeTypes: ['video/h265'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 5) return false;
      for (let i = 0; i < Math.min(32, bytes.length - 4); ++i) {
        if (bytes[i] === 0 && bytes[i + 1] === 0) {
          let nalStart = -1;
          if (bytes[i + 2] === 1)
            nalStart = i + 3;
          else if (bytes[i + 2] === 0 && i + 3 < bytes.length && bytes[i + 3] === 1)
            nalStart = i + 4;
          if (nalStart >= 0 && nalStart < bytes.length) {
            const nalType = (bytes[nalStart] >> 1) & 0x3F;
            const forbidden = (bytes[nalStart] >> 7) & 1;
            if (forbidden === 0 && (nalType === 32 || nalType === 33))
              return true;
          }
        }
      }
      return false;
    },
    codec: { parseH265NALUnits, parseSPS_H265 },
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Video = F.Codecs.Video || {};
  F.Codecs.Video.parseH265NALUnits = parseH265NALUnits;
  F.Codecs.Video.parseSPS_H265 = parseSPS_H265;
  F.Codecs.Video.H265_NAL_TYPES = H265_NAL_TYPES;

})();
