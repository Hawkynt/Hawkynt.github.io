;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});

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
  // AV1 OBU type names
  // =========================================================================

  const AV1_OBU_TYPES = {
    1: 'Sequence Header',
    2: 'Temporal Delimiter',
    3: 'Frame Header',
    4: 'Tile Group',
    5: 'Metadata',
    6: 'Frame',
    7: 'Redundant Frame Header',
    8: 'Tile List',
    15: 'Padding',
  };

  // =========================================================================
  // VP9 color space names
  // =========================================================================

  const VP9_COLOR_SPACES = [
    'Unknown', 'BT.601', 'BT.709', 'SMPTE-170',
    'SMPTE-240', 'BT.2020', 'Reserved', 'sRGB',
  ];

  // =========================================================================
  // Bitstream reader with Exp-Golomb decoding
  // =========================================================================

  class BitstreamReader {

    #bytes;
    #byteOffset;
    #bitOffset;
    #length;

    constructor(bytes, offset, length) {
      this.#bytes = bytes;
      this.#byteOffset = offset || 0;
      this.#bitOffset = 0;
      this.#length = length != null ? length : bytes.length - this.#byteOffset;
    }

    get bitsRemaining() {
      return (this.#length - (this.#byteOffset - (this.#bytes.byteOffset || 0))) * 8 - this.#bitOffset;
    }

    readBit() {
      if (this.#byteOffset >= this.#bytes.length)
        return 0;
      const bit = (this.#bytes[this.#byteOffset] >> (7 - this.#bitOffset)) & 1;
      if (++this.#bitOffset >= 8) {
        this.#bitOffset = 0;
        ++this.#byteOffset;
      }
      return bit;
    }

    readBits(n) {
      let value = 0;
      for (let i = 0; i < n; ++i)
        value = (value << 1) | this.readBit();
      return value;
    }

    skipBits(n) {
      const totalBits = this.#bitOffset + n;
      this.#byteOffset += (totalBits >> 3);
      this.#bitOffset = totalBits & 7;
    }

    // Unsigned Exp-Golomb (ue(v))
    readUE() {
      let leadingZeros = 0;
      while (this.readBit() === 0 && leadingZeros < 32)
        ++leadingZeros;
      if (leadingZeros === 0)
        return 0;
      return (1 << leadingZeros) - 1 + this.readBits(leadingZeros);
    }

    // Signed Exp-Golomb (se(v))
    readSE() {
      const code = this.readUE();
      const sign = (code & 1) ? 1 : -1;
      return sign * ((code + 1) >> 1);
    }
  }

  // =========================================================================
  // NAL start code scanner (shared by H.264 and H.265)
  // =========================================================================

  function _findNALStartCodes(bytes, offset, maxUnits) {
    const results = [];
    const end = bytes.length;
    let i = offset || 0;
    const limit = maxUnits || Infinity;

    while (i < end - 2 && results.length < limit) {
      // look for 0x000001 or 0x00000001
      if (bytes[i] === 0 && bytes[i + 1] === 0) {
        let startCodeLen = 0;
        if (bytes[i + 2] === 1)
          startCodeLen = 3;
        else if (bytes[i + 2] === 0 && i + 3 < end && bytes[i + 3] === 1)
          startCodeLen = 4;

        if (startCodeLen > 0) {
          // mark end of previous NAL
          if (results.length > 0)
            results[results.length - 1].length = i - results[results.length - 1].offset;

          const nalStart = i + startCodeLen;
          results.push({ offset: nalStart, length: 0, startCodeOffset: i });
          i = nalStart;
          continue;
        }
      }
      ++i;
    }

    // finalize last NAL length
    if (results.length > 0 && results[results.length - 1].length === 0)
      results[results.length - 1].length = end - results[results.length - 1].offset;

    return results;
  }

  // Remove emulation prevention bytes (0x000003 -> 0x0000) for SPS/PPS parsing
  function _removeEmulationPrevention(bytes, offset, length) {
    const out = [];
    const end = offset + length;
    for (let i = offset; i < end; ++i) {
      if (i + 2 < end && bytes[i] === 0 && bytes[i + 1] === 0 && bytes[i + 2] === 3) {
        out.push(0, 0);
        i += 2; // skip the 0x03 byte
      } else
        out.push(bytes[i]);
    }
    return new Uint8Array(out);
  }

  // =========================================================================
  // H.264/AVC SPS parser
  // =========================================================================

  function parseSPS_H264(nalBytes) {
    const clean = nalBytes instanceof Uint8Array ? _removeEmulationPrevention(nalBytes, 0, nalBytes.length) : nalBytes;
    const bs = new BitstreamReader(clean, 1); // skip NAL header byte

    const profile_idc = bs.readBits(8);
    const constraint_set0 = bs.readBit();
    const constraint_set1 = bs.readBit();
    const constraint_set2 = bs.readBit();
    const constraint_set3 = bs.readBit();
    const constraint_set4 = bs.readBit();
    const constraint_set5 = bs.readBit();
    bs.skipBits(2); // reserved_zero_2bits
    const level_idc = bs.readBits(8);
    bs.readUE(); // seq_parameter_set_id

    let chroma_format_idc = 1;
    let bit_depth_luma = 8;
    let bit_depth_chroma = 8;
    const separate_colour_plane_flag = 0;

    // High profile and above have extra fields
    if (profile_idc === 100 || profile_idc === 110 || profile_idc === 122 ||
        profile_idc === 244 || profile_idc === 44 || profile_idc === 83 ||
        profile_idc === 86 || profile_idc === 118 || profile_idc === 128 ||
        profile_idc === 138 || profile_idc === 139 || profile_idc === 134 ||
        profile_idc === 135) {
      chroma_format_idc = bs.readUE();
      if (chroma_format_idc === 3)
        bs.readBit(); // separate_colour_plane_flag
      bit_depth_luma = bs.readUE() + 8;
      bit_depth_chroma = bs.readUE() + 8;
      bs.readBit(); // qpprime_y_zero_transform_bypass_flag

      // scaling matrix
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
      bs.readUE(); // log2_max_pic_order_cnt_lsb_minus4
    else if (pic_order_cnt_type === 1) {
      bs.readBit(); // delta_pic_order_always_zero_flag
      bs.readSE(); // offset_for_non_ref_pic
      bs.readSE(); // offset_for_top_to_bottom_field
      const numRefFrames = bs.readUE();
      for (let i = 0; i < numRefFrames; ++i)
        bs.readSE();
    }

    const max_num_ref_frames = bs.readUE();
    bs.readBit(); // gaps_in_frame_num_value_allowed_flag

    const pic_width_in_mbs_minus1 = bs.readUE();
    const pic_height_in_map_units_minus1 = bs.readUE();
    const frame_mbs_only_flag = bs.readBit();

    if (!frame_mbs_only_flag)
      bs.readBit(); // mb_adaptive_frame_field_flag

    bs.readBit(); // direct_8x8_inference_flag

    let cropLeft = 0, cropRight = 0, cropTop = 0, cropBottom = 0;
    const frame_cropping_flag = bs.readBit();
    if (frame_cropping_flag) {
      cropLeft = bs.readUE();
      cropRight = bs.readUE();
      cropTop = bs.readUE();
      cropBottom = bs.readUE();
    }

    // Compute dimensions
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
    const rawUnits = _findNALStartCodes(bytes, offset || 0, maxUnits);
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
  // H.265/HEVC SPS parser
  // =========================================================================

  function parseSPS_H265(nalBytes) {
    const clean = nalBytes instanceof Uint8Array ? _removeEmulationPrevention(nalBytes, 0, nalBytes.length) : nalBytes;
    const bs = new BitstreamReader(clean, 2); // skip 2-byte NAL header

    const vps_id = bs.readBits(4);
    const max_sub_layers_minus1 = bs.readBits(3);
    const temporal_id_nesting_flag = bs.readBit();

    // profile_tier_level
    const general_profile_space = bs.readBits(2);
    const general_tier_flag = bs.readBit();
    const general_profile_idc = bs.readBits(5);

    // 32 general_profile_compatibility_flags
    const compatFlags = bs.readBits(32);

    // general constraint indicators (48 bits)
    const general_progressive_source_flag = bs.readBit();
    const general_interlaced_source_flag = bs.readBit();
    const general_non_packed_constraint_flag = bs.readBit();
    const general_frame_only_constraint_flag = bs.readBit();
    bs.skipBits(44); // remaining constraint flags

    const general_level_idc = bs.readBits(8);

    // sub_layer profile/level present flags
    const subLayerProfilePresent = [];
    const subLayerLevelPresent = [];
    for (let i = 0; i < max_sub_layers_minus1; ++i) {
      subLayerProfilePresent.push(bs.readBit());
      subLayerLevelPresent.push(bs.readBit());
    }

    // reserved bits for alignment
    if (max_sub_layers_minus1 > 0)
      for (let i = max_sub_layers_minus1; i < 8; ++i)
        bs.skipBits(2);

    // skip sub-layer profile_tier_level data
    for (let i = 0; i < max_sub_layers_minus1; ++i) {
      if (subLayerProfilePresent[i])
        bs.skipBits(88); // profile_space(2) + tier(1) + profile(5) + compat(32) + constraints(48)
      if (subLayerLevelPresent[i])
        bs.skipBits(8);
    }

    const sps_id = bs.readUE();
    const chroma_format_idc = bs.readUE();

    if (chroma_format_idc === 3)
      bs.readBit(); // separate_colour_plane_flag

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

    // Compute cropped dimensions
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
    const rawUnits = _findNALStartCodes(bytes, offset || 0, maxUnits);
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
  // VP9 frame parser
  // =========================================================================

  function parseVP9Frame(bytes, offset) {
    const off = offset || 0;
    if (off + 4 > bytes.length)
      return null;

    const bs = new BitstreamReader(bytes, off);

    const frame_marker = bs.readBits(2);
    if (frame_marker !== 2)
      return null; // not a valid VP9 frame

    const profile_low = bs.readBit();
    const profile_high = bs.readBit();
    const profile = (profile_high << 1) | profile_low;

    if (profile === 3)
      bs.readBit(); // reserved_zero bit for profile 3

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

    const frame_type = bs.readBit(); // 0 = key frame, 1 = inter frame
    const show_frame = bs.readBit();
    const error_resilient = bs.readBit();
    const keyFrame = frame_type === 0;

    let width = null;
    let height = null;
    let colorSpace = null;
    let colorRange = null;

    if (keyFrame) {
      // frame sync code: 0x49 0x83 0x42
      const sync1 = bs.readBits(8);
      const sync2 = bs.readBits(8);
      const sync3 = bs.readBits(8);
      if (sync1 !== 0x49 || sync2 !== 0x83 || sync3 !== 0x42)
        return null; // invalid sync code

      if (profile >= 2)
        bs.readBit(); // ten_or_twelve_bit

      const cs = bs.readBits(3);
      colorSpace = VP9_COLOR_SPACES[cs] || 'Unknown';

      if (cs !== 7) { // not sRGB
        colorRange = bs.readBit() ? 'Full' : 'Studio';
        if (profile === 1 || profile === 3) {
          bs.readBit(); // subsampling_x
          bs.readBit(); // subsampling_y
          bs.readBit(); // reserved
        }
      } else {
        colorRange = 'Full';
        if (profile === 1 || profile === 3)
          bs.readBit(); // reserved
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
  // AV1 LEB128 reader (used for OBU size encoding)
  // =========================================================================

  function _readLEB128(bytes, offset) {
    let value = 0;
    let bytesRead = 0;
    for (let i = 0; i < 8; ++i) {
      if (offset + i >= bytes.length)
        break;
      const b = bytes[offset + i];
      value |= (b & 0x7F) * Math.pow(2, i * 7); // avoid bitshift overflow for large values
      ++bytesRead;
      if ((b & 0x80) === 0)
        break;
    }
    return { value, bytesRead };
  }

  // =========================================================================
  // AV1 Sequence Header parser
  // =========================================================================

  function _parseAV1SequenceHeader(bytes, offset, length) {
    const bs = new BitstreamReader(bytes, offset, length);

    const seq_profile = bs.readBits(3);
    const still_picture = bs.readBit();
    const reduced_still_picture_header = bs.readBit();

    let timing_info_present = false;
    let decoder_model_info_present = false;
    let operating_points_cnt = 1;
    const operating_points = [];

    if (reduced_still_picture_header) {
      operating_points.push({
        idc: 0,
        seq_level_idx: bs.readBits(5),
        seq_tier: 0,
      });
    } else {
      timing_info_present = !!bs.readBit();
      if (timing_info_present) {
        bs.skipBits(32); // num_units_in_display_tick
        bs.skipBits(32); // time_scale
        const equal_picture_interval = bs.readBit();
        if (equal_picture_interval)
          bs.readUE(); // num_ticks_per_picture_minus_1
        decoder_model_info_present = !!bs.readBit();
        if (decoder_model_info_present) {
          bs.skipBits(32); // buffer_delay_length_minus_1(5) + num_units_in_decoding_tick(32) ... simplified skip
          // This is a simplified parse; full parsing of decoder_model_info is complex
        }
      }

      const initial_display_delay_present = bs.readBit();
      operating_points_cnt = bs.readBits(5) + 1;

      for (let i = 0; i < operating_points_cnt; ++i) {
        const idc = bs.readBits(12);
        const seq_level_idx = bs.readBits(5);
        let seq_tier = 0;
        if (seq_level_idx > 7)
          seq_tier = bs.readBit();
        if (decoder_model_info_present) {
          const decoder_model_present = bs.readBit();
          if (decoder_model_present)
            bs.skipBits(32); // simplified skip for operating_parameters_info
        }
        if (initial_display_delay_present) {
          const display_delay_present = bs.readBit();
          if (display_delay_present)
            bs.skipBits(4); // initial_display_delay_minus_1
        }
        operating_points.push({ idc, seq_level_idx, seq_tier });
      }
    }

    const frame_width_bits = bs.readBits(4) + 1;
    const frame_height_bits = bs.readBits(4) + 1;
    const max_frame_width = bs.readBits(frame_width_bits) + 1;
    const max_frame_height = bs.readBits(frame_height_bits) + 1;

    let frame_id_numbers_present = false;
    if (!reduced_still_picture_header)
      frame_id_numbers_present = !!bs.readBit();

    const profileNames = {
      0: 'Main',
      1: 'High',
      2: 'Professional',
    };

    return {
      profile: seq_profile,
      profileName: profileNames[seq_profile] || ('Unknown (' + seq_profile + ')'),
      stillPicture: !!still_picture,
      reducedStillPictureHeader: !!reduced_still_picture_header,
      maxFrameWidth: max_frame_width,
      maxFrameHeight: max_frame_height,
      operatingPoints: operating_points,
      frameIdNumbersPresent: frame_id_numbers_present,
      level: operating_points.length > 0 ? operating_points[0].seq_level_idx : null,
      tier: operating_points.length > 0 ? operating_points[0].seq_tier : 0,
    };
  }

  // =========================================================================
  // AV1 OBU parser
  // =========================================================================

  function parseAV1OBUs(bytes, offset, maxOBUs) {
    const obus = [];
    let pos = offset || 0;
    const limit = maxOBUs || Infinity;
    let sequenceHeader = null;

    while (pos < bytes.length && obus.length < limit) {
      if (pos >= bytes.length)
        break;

      const headerByte = bytes[pos];
      const obu_forbidden_bit = (headerByte >> 7) & 1;
      if (obu_forbidden_bit)
        break; // invalid OBU

      const obu_type = (headerByte >> 3) & 0x0F;
      const obu_extension_flag = (headerByte >> 2) & 1;
      const obu_has_size_field = (headerByte >> 1) & 1;

      let headerSize = 1;
      let temporal_id = 0;
      let spatial_id = 0;

      if (obu_extension_flag) {
        if (pos + 1 >= bytes.length)
          break;
        const extByte = bytes[pos + 1];
        temporal_id = (extByte >> 5) & 0x07;
        spatial_id = (extByte >> 3) & 0x03;
        headerSize = 2;
      }

      let obuSize;
      let sizeFieldBytes = 0;
      if (obu_has_size_field) {
        const leb = _readLEB128(bytes, pos + headerSize);
        obuSize = leb.value;
        sizeFieldBytes = leb.bytesRead;
      } else {
        // OBU extends to end of data
        obuSize = bytes.length - pos - headerSize;
      }

      const payloadOffset = pos + headerSize + sizeFieldBytes;
      const totalOBUSize = headerSize + sizeFieldBytes + obuSize;
      const typeName = AV1_OBU_TYPES[obu_type] || ('Unknown (' + obu_type + ')');

      obus.push({
        offset: pos,
        length: totalOBUSize,
        type: obu_type,
        typeName,
        temporalId: temporal_id,
        spatialId: spatial_id,
      });

      // Parse sequence header if found
      if (obu_type === 1 && !sequenceHeader) {
        try {
          sequenceHeader = _parseAV1SequenceHeader(bytes, payloadOffset, obuSize);
        } catch (_) { /* malformed sequence header */ }
      }

      pos += totalOBUSize;
    }

    return { obus, sequenceHeader };
  }

  // =========================================================================
  // Codec identification helper
  // =========================================================================

  function identifyCodec(bytes, offset) {
    const off = offset || 0;
    if (!bytes || bytes.length - off < 4)
      return null;

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

          // H.264 SPS: forbidden=0, nal_ref_idc!=0, type=7
          if (forbiddenBit === 0 && nalType264 === 7 && nalRefIdc !== 0) {
            const result = parseH264NALUnits(bytes, off, 32);
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

          // H.265: forbidden=0, type check via (byte>>1)&0x3F for VPS(32) or SPS(33)
          const nalType265 = (bytes[nalStart] >> 1) & 0x3F;
          if (forbiddenBit === 0 && (nalType265 === 32 || nalType265 === 33)) {
            const result = parseH265NALUnits(bytes, off, 32);
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

    // Try VP9: frame_marker = 0b10 in first 2 bits
    if (((bytes[off] >> 6) & 0x03) === 2) {
      const vp9 = parseVP9Frame(bytes, off);
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

    // Try AV1: look for OBU with sequence header (type=1)
    const headerByte = bytes[off];
    const obuForbidden = (headerByte >> 7) & 1;
    const obuType = (headerByte >> 3) & 0x0F;
    if (obuForbidden === 0 && (obuType === 1 || obuType === 2)) {
      const av1 = parseAV1OBUs(bytes, off, 16);
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
  // Export on SZ.Formats.Codecs.Video
  // =========================================================================

  F.Codecs = F.Codecs || {};
  F.Codecs.Video = {

    // H.264/AVC
    parseH264NALUnits,
    parseSPS_H264,

    // H.265/HEVC
    parseH265NALUnits,
    parseSPS_H265,

    // VP9
    parseVP9Frame,

    // AV1
    parseAV1OBUs,

    // Identification
    identifyCodec,

    // Bitstream reader (exposed for advanced usage)
    BitstreamReader,

    // Lookup tables
    H264_PROFILES,
    H264_NAL_TYPES,
    H265_NAL_TYPES,
    AV1_OBU_TYPES,
    VP9_COLOR_SPACES,
  };

})();
