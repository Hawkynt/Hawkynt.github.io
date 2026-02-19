;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const F = SZ.Formats || (SZ.Formats = {});
  const U = F.Utils || {};

  const BitstreamReader = U.BitstreamReader;

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
  // AV1 LEB128 reader
  // =========================================================================

  function _readLEB128(bytes, offset) {
    let value = 0;
    let bytesRead = 0;
    for (let i = 0; i < 8; ++i) {
      if (offset + i >= bytes.length)
        break;
      const b = bytes[offset + i];
      value |= (b & 0x7F) * Math.pow(2, i * 7);
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
        bs.skipBits(32);
        bs.skipBits(32);
        const equal_picture_interval = bs.readBit();
        if (equal_picture_interval)
          bs.readUE();
        decoder_model_info_present = !!bs.readBit();
        if (decoder_model_info_present)
          bs.skipBits(32);
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
            bs.skipBits(32);
        }
        if (initial_display_delay_present) {
          const display_delay_present = bs.readBit();
          if (display_delay_present)
            bs.skipBits(4);
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
        break;

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
      } else
        obuSize = bytes.length - pos - headerSize;

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
  // Registration + backward compat
  // =========================================================================

  F.register('av1', {
    name: 'AV1 Video',
    category: 'video',
    extensions: ['av1', 'obu'],
    mimeTypes: ['video/av1'],
    access: 'ro',
    detect(bytes) {
      if (bytes.length < 2) return false;
      const headerByte = bytes[0];
      const obuForbidden = (headerByte >> 7) & 1;
      const obuType = (headerByte >> 3) & 0x0F;
      return obuForbidden === 0 && (obuType === 1 || obuType === 2);
    },
    codec: { parseAV1OBUs },
  });

  F.Codecs = F.Codecs || {};
  F.Codecs.Video = F.Codecs.Video || {};
  F.Codecs.Video.parseAV1OBUs = parseAV1OBUs;
  F.Codecs.Video.AV1_OBU_TYPES = AV1_OBU_TYPES;

})();
