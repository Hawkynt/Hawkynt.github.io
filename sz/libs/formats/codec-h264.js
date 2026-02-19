;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});
  const U = F.Utils || {};

  const BitstreamReader = U.BitstreamReader;
  const findNALStartCodes = U.findNALStartCodes;
  const removeEmulationPrevention = U.removeEmulationPrevention;

  // =========================================================================
  // H.264/AVC profile names
  // =========================================================================

  const H264_PROFILES = {
    66: 'Baseline',
    77: 'Main',
    88: 'Extended',
    100: 'High',
    110: 'High 10',
    122: 'High 4:2:2',
    244: 'High 4:4:4 Predictive',
  };

  const H264_NAL_TYPES = {
    1: 'Non-IDR Slice',
    2: 'Slice Data Partition A',
    3: 'Slice Data Partition B',
    4: 'Slice Data Partition C',
    5: 'IDR Slice',
    6: 'SEI',
    7: 'SPS',
    8: 'PPS',
    9: 'Access Unit Delimiter',
  };

  // =========================================================================
  // H.264/AVC SPS parser
  // =========================================================================

  function parseSPS_H264(nalBytes) {
    const clean = nalBytes instanceof Uint8Array ? removeEmulationPrevention(nalBytes, 0, nalBytes.length) : nalBytes;
    const bs = new BitstreamReader(clean, 1);

    const profile_idc = bs.readBits(8);
    const constraint_set0 = bs.readBit();
    const constraint_set1 = bs.readBit();
    const constraint_set2 = bs.readBit();
    const constraint_set3 = bs.readBit();
    const constraint_set4 = bs.readBit();
    const constraint_set5 = bs.readBit();
    bs.skipBits(2);
    const level_idc = bs.readBits(8);
    bs.readUE();

    let chroma_format_idc = 1;
    let bit_depth_luma = 8;
    let bit_depth_chroma = 8;

    if (profile_idc === 100 || profile_idc === 110 || profile_idc === 122 ||
        profile_idc === 244 || profile_idc === 44 || profile_idc === 83 ||
        profile_idc === 86 || profile_idc === 118 || profile_idc === 128 ||
        profile_idc === 138 || profile_idc === 139 || profile_idc === 134 ||
        profile_idc === 135) {
      chroma_format_idc = bs.readUE();
      if (chroma_format_idc === 3)
        bs.readBit();
      bit_depth_luma = bs.readUE() + 8;
      bit_depth_chroma = bs.readUE() + 8;
      bs.readBit();

      const seq_scaling_matrix_present = bs.readBit();
      if (seq_scaling_matrix_present) {
        const limit = chroma_format_idc !== 3 ? 8 : 12;
        for (let i = 0; i < limit; ++i) {
          const present = bs.readBit();
          if (present) {
            const sizeOfList = i < 6 ? 16 : 64;
            let lastScale = 8;
            let nextScale = 8;
            for (let j = 0; j < sizeOfList; ++j) {
              if (nextScale !== 0) {
                const delta = bs.readSE();
                nextScale = (lastScale + delta + 256) % 256;
              }
              lastScale = nextScale === 0 ? lastScale : nextScale;
            }
          }
        }
      }
    }

    const log2_max_frame_num = bs.readUE() + 4;
    const pic_order_cnt_type = bs.readUE();

    if (pic_order_cnt_type === 0)
      bs.readUE();
    else if (pic_order_cnt_type === 1) {
      bs.readBit();
      bs.readSE();
      bs.readSE();
      const numRefFrames = bs.readUE();
      for (let i = 0; i < numRefFrames; ++i)
        bs.readSE();
    }

    const max_num_ref_frames = bs.readUE();
    bs.readBit();

    const pic_width_in_mbs_minus1 = bs.readUE();
    const pic_height_in_map_units_minus1 = bs.readUE();
    const frame_mbs_only_flag = bs.readBit();

    if (!frame_mbs_only_flag)
      bs.readBit();

    bs.readBit();

    let cropLeft = 0, cropRight = 0, cropTop = 0, cropBottom = 0;
    const frame_cropping_flag = bs.readBit();
    if (frame_cropping_flag) {
      cropLeft = bs.readUE();
      cropRight = bs.readUE();
      cropTop = bs.readUE();
      cropBottom = bs.readUE();
    }

    const subWidthC = chroma_format_idc === 3 ? 1 : 2;
    const subHeightC = chroma_format_idc === 1 ? 2 : 1;
    const cropUnitX = chroma_format_idc === 0 ? 1 : subWidthC;
    const cropUnitY = (chroma_format_idc === 0 ? 1 : subHeightC) * (2 - frame_mbs_only_flag);

    const width = (pic_width_in_mbs_minus1 + 1) * 16 - cropUnitX * (cropLeft + cropRight);
    const height = (2 - frame_mbs_only_flag) * (pic_height_in_map_units_minus1 + 1) * 16 - cropUnitY * (cropTop + cropBottom);

    return {
      profile: profile_idc,
      profileName: H264_PROFILES[profile_idc] || ('Unknown (' + profile_idc + ')'),
      level: level_idc / 10,
      constraintFlags: (constraint_set0 << 5) | (constraint_set1 << 4) | (constraint_set2 << 3) | (constraint_set3 << 2) | (constraint_set4 << 1) | constraint_set5,
      width,
      height,
      chromaFormat: chroma_format_idc,
      bitDepthLuma: bit_depth_luma,
      bitDepthChroma: bit_depth_chroma,
      refFrames: max_num_ref_frames,
      frameMbsOnly: !!frame_mbs_only_flag,
    };
  }

  // =========================================================================
  // H.264/AVC NAL unit parser
  // =========================================================================

  function parseH264NALUnits(bytes, offset, maxUnits) {
    const rawUnits = findNALStartCodes(bytes, offset || 0, maxUnits);
    const units = [];
    let spsInfo = null;
    let ppsCount = 0;
    let idrCount = 0;
    let sliceCount = 0;

    for (const raw of rawUnits) {
      if (raw.offset >= bytes.length) continue;
      const nalType = bytes[raw.offset] & 0x1F;
      const typeName = H264_NAL_TYPES[nalType] || ('Unknown (' + nalType + ')');

      units.push({
        offset: raw.offset,
        length: raw.length,
        type: nalType,
        typeName,
      });

      if (nalType === 7 && !spsInfo) {
        try {
          const nalData = bytes.slice(raw.offset, raw.offset + raw.length);
          spsInfo = parseSPS_H264(nalData);
        } catch (_) { /* malformed SPS */ }
      } else if (nalType === 8)
        ++ppsCount;
      else if (nalType === 5)
        ++idrCount;
      else if (nalType === 1)
        ++sliceCount;
    }

    return { units, spsInfo, ppsCount, idrCount, sliceCount };
  }

  // =========================================================================
  // Registration + backward compat
  // =========================================================================

  F.register('h264', {
    name: 'H.264/AVC Video',
    category: 'video',
    extensions: ['h264', '264'],
    mimeTypes: ['video/h264'],
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
            const nalType = bytes[nalStart] & 0x1F;
            const forbidden = (bytes[nalStart] >> 7) & 1;
            if (forbidden === 0 && nalType === 7)
              return true;
          }
        }
      }
      return false;
    },
    codec: { parseH264NALUnits, parseSPS_H264 },
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Video = F.Codecs.Video || {};
  F.Codecs.Video.parseH264NALUnits = parseH264NALUnits;
  F.Codecs.Video.parseSPS_H264 = parseSPS_H264;
  F.Codecs.Video.H264_PROFILES = H264_PROFILES;
  F.Codecs.Video.H264_NAL_TYPES = H264_NAL_TYPES;

})();
