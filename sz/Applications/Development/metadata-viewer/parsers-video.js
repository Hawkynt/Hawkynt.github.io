;(function() {
  'use strict';
  const P = window.SZ.MetadataParsers;
  const { readU8, readU16LE, readU16BE, readU32LE, readU32BE, readI32LE, readU64LE, readU64BE, readString, readUTF8, readUTF16, bytesToDataUrl, formatSize } = P;

  function parseMP4(bytes) {
    const categories = [];
    const fields = [];
    const byteRegions = [];

    function walkBoxes(start, end, depth) {
      let pos = start;
      while (pos + 8 <= end) {
        let size = readU32BE(bytes, pos);
        const type = readString(bytes, pos + 4, 4);
        let headerSize = 8;
        if (size === 1 && pos + 16 <= end) {
          size = readU64BE(bytes, pos + 8);
          headerSize = 16;
        }
        if (size === 0) size = end - pos;
        if (size < 8 || pos + size > end) break;

        const boxData = pos + headerSize;
        const boxEnd = pos + size;

        // Top-level box byte regions
        if (depth === 0) {
          byteRegions.push({ offset: pos, length: headerSize, label: type + ' Box Header', color: 1 });
          if (type === 'ftyp')
            byteRegions.push({ offset: boxData, length: Math.min(size - headerSize, 256), label: 'ftyp Data', color: 0 });
          else if (type === 'mdat')
            byteRegions.push({ offset: boxData, length: Math.min(size - headerSize, 256), label: 'Media Data', color: 4 });
        }

        if (type === 'ftyp') {
          const brand = readString(bytes, boxData, 4).trim();
          const minorVersion = readU32BE(bytes, boxData + 4);
          fields.push({ key: 'mp4.brand', label: 'Major Brand', value: brand });
          const compatBrands = [];
          for (let i = boxData + 8; i + 4 <= boxEnd; i += 4)
            compatBrands.push(readString(bytes, i, 4).trim());
          if (compatBrands.length > 0)
            fields.push({ key: 'mp4.compat', label: 'Compatible Brands', value: compatBrands.join(', ') });
        }

        if (type === 'mvhd' && boxEnd - boxData >= 20) {
          const fullBoxVersion = readU8(bytes, boxData);
          let timescale, duration;
          if (fullBoxVersion === 0) {
            timescale = readU32BE(bytes, boxData + 12);
            duration = readU32BE(bytes, boxData + 16);
          } else {
            timescale = readU32BE(bytes, boxData + 20);
            duration = readU64BE(bytes, boxData + 24);
          }
          if (timescale > 0) {
            const durationSec = Math.floor(duration / timescale);
            const min = Math.floor(durationSec / 60);
            const sec = durationSec % 60;
            fields.push({ key: 'mp4.duration', label: 'Duration', value: min + ':' + String(sec).padStart(2, '0') });
          }
        }

        if (type === 'tkhd' && boxEnd - boxData >= 24) {
          const fullBoxVersion = readU8(bytes, boxData);
          if (fullBoxVersion === 0 && boxEnd - boxData >= 84) {
            const w = readU32BE(bytes, boxData + 76) >> 16;
            const h = readU32BE(bytes, boxData + 80) >> 16;
            if (w > 0 && h > 0)
              fields.push({ key: 'mp4.trackDim', label: 'Track Dimensions', value: w + ' x ' + h });
          }
        }

        // Parse ilst (iTunes metadata list)
        if (type === 'ilst') {
          let iPos = boxData;
          while (iPos + 8 <= boxEnd) {
            let iSize = readU32BE(bytes, iPos);
            const iType = readString(bytes, iPos + 4, 4);
            if (iSize < 8 || iPos + iSize > boxEnd) break;

            // Read first 'data' sub-atom
            let dPos = iPos + 8;
            while (dPos + 16 <= iPos + iSize) {
              let dSize = readU32BE(bytes, dPos);
              const dType = readString(bytes, dPos + 4, 4);
              if (dSize < 8 || dPos + dSize > iPos + iSize) break;
              if (dType === 'data') {
                const dataFlags = readU32BE(bytes, dPos + 8) & 0xFFFFFF;
                const valueStart = dPos + 16;
                const valueLen = dSize - 16;
                if (valueLen > 0 && valueStart + valueLen <= bytes.length) {
                  if (dataFlags === 1) {
                    // UTF-8 text
                    const text = readUTF8(bytes, valueStart, valueLen);
                    const atomInfo = ILST_ATOM_MAP[iType];
                    if (atomInfo) {
                      ilstFields.push({
                        key: 'mp4.ilst.' + iType.replace(/\xA9/g, '_'),
                        label: atomInfo.label,
                        value: text,
                        editable: true,
                        editType: 'text',
                      });
                    } else
                      ilstFields.push({ key: 'mp4.ilst.' + iType.replace(/\xA9/g, '_'), label: iType, value: text });
                  } else if (dataFlags === 0 && iType === 'trkn' && valueLen >= 4) {
                    const trackNum = readU16BE(bytes, valueStart + 2);
                    const trackTotal = valueLen >= 6 ? readU16BE(bytes, valueStart + 4) : 0;
                    ilstFields.push({ key: 'mp4.ilst.trkn', label: 'Track Number', value: trackTotal > 0 ? trackNum + '/' + trackTotal : String(trackNum) });
                  } else if (dataFlags === 0 && iType === 'disk' && valueLen >= 4) {
                    const discNum = readU16BE(bytes, valueStart + 2);
                    const discTotal = valueLen >= 6 ? readU16BE(bytes, valueStart + 4) : 0;
                    ilstFields.push({ key: 'mp4.ilst.disk', label: 'Disc Number', value: discTotal > 0 ? discNum + '/' + discTotal : String(discNum) });
                  } else if ((dataFlags === 13 || dataFlags === 14) && iType === 'covr') {
                    const mime = dataFlags === 13 ? 'image/jpeg' : 'image/png';
                    const imgSlice = bytes.slice(valueStart, valueStart + valueLen);
                    mp4Images.push({ label: 'Cover Art', mimeType: mime, dataUrl: bytesToDataUrl(imgSlice, mime) });
                  }
                }
                break;
              }
              dPos += dSize;
            }

            iPos += iSize;
          }
        }

        // Extract codec configuration from stsd entries
        if (type === 'stsd' && boxEnd - boxData > 8) {
          const entryCount = readU32BE(bytes, boxData + 4);
          let ePos = boxData + 8;
          for (let e = 0; e < entryCount && ePos + 8 <= boxEnd; ++e) {
            let eSize = readU32BE(bytes, ePos);
            const codecTag = readString(bytes, ePos + 4, 4);
            if (eSize < 8 || ePos + eSize > boxEnd) break;
            // Video sample entries have width/height at offset 24/26 from entry start, followed by sub-boxes after 78 bytes
            if (['avc1', 'avc3', 'hev1', 'hvc1', 'vp09', 'av01', 'mp4v'].includes(codecTag)) {
              codecConfigs.push({ tag: codecTag, offset: ePos, size: eSize });
              // Look for avcC / hvcC / vpcC / av1C sub-box inside the sample entry
              let sPos = ePos + 78; // skip sample entry header (78 bytes for video)
              if (sPos > ePos + eSize) sPos = ePos + 8 + 6 + 2; // fallback: after 8-byte box header + 6 reserved + 2 data_ref
              while (sPos + 8 <= ePos + eSize) {
                const sSize = readU32BE(bytes, sPos);
                const sType = readString(bytes, sPos + 4, 4);
                if (sSize < 8) break;
                if (['avcC', 'hvcC', 'vpcC', 'av1C'].includes(sType))
                  codecConfigs.push({ tag: sType, offset: sPos + 8, size: sSize - 8 });
                sPos += sSize;
              }
            }
            // Audio sample entries
            if (['mp4a', 'ac-3', 'ec-3', 'Opus', 'fLaC', 'alac'].includes(codecTag))
              codecConfigs.push({ tag: codecTag, offset: ePos, size: eSize });
            ePos += eSize;
          }
        }

        // Recurse into container boxes (ilst handled explicitly above)
        if (type !== 'ilst' && ['moov', 'trak', 'mdia', 'minf', 'stbl', 'udta', 'meta'].includes(type)) {
          const skip = type === 'meta' ? 4 : 0; // meta has fullbox header
          walkBoxes(boxData + skip, boxEnd, depth + 1);
        }

        pos = boxEnd;
      }
    }

    // iTunes atom type → label map
    const ILST_ATOM_MAP = {
      '\xA9nam': { label: 'Title' },
      '\xA9ART': { label: 'Artist' },
      '\xA9alb': { label: 'Album' },
      '\xA9day': { label: 'Year' },
      '\xA9gen': { label: 'Genre' },
      '\xA9cmt': { label: 'Comment' },
      '\xA9wrt': { label: 'Composer' },
      'aART':    { label: 'Album Artist' },
      '\xA9too': { label: 'Encoder' },
      '\xA9grp': { label: 'Grouping' },
      'desc':    { label: 'Description' },
      'ldes':    { label: 'Long Description' },
      '\xA9lyr': { label: 'Lyrics' },
      'cprt':    { label: 'Copyright' },
    };
    const ilstFields = [];
    const mp4Images = [];
    const codecConfigs = [];

    walkBoxes(0, bytes.length, 0);

    if (fields.length > 0)
      categories.push({ name: 'Container', icon: 'video', fields });

    if (ilstFields.length > 0)
      categories.push({ name: 'iTunes Metadata', icon: 'music', fields: ilstFields });

    // Video/audio stream codec details via shared codec-video.js library
    const CV = window.SZ && SZ.Formats && SZ.Formats.Codecs && SZ.Formats.Codecs.Video;
    if (CV && codecConfigs.length > 0) {
      try {
        for (const cfg of codecConfigs) {
          const streamFields = [];
          // H.264 avcC box — contains SPS/PPS
          if (cfg.tag === 'avcC' && cfg.size >= 8 && CV.parseSPS_H264) {
            const numSps = bytes[cfg.offset + 5] & 0x1F;
            if (numSps > 0 && cfg.offset + 8 <= bytes.length) {
              const spsLen = readU16BE(bytes, cfg.offset + 6);
              if (spsLen > 0 && cfg.offset + 8 + spsLen <= bytes.length) {
                const spsBytes = bytes.slice(cfg.offset + 8, cfg.offset + 8 + spsLen);
                const sps = CV.parseSPS_H264(spsBytes);
                if (sps) {
                  streamFields.push({ key: 'stream.video.codec', label: 'Codec', value: 'H.264/AVC' });
                  if (sps.profileName) streamFields.push({ key: 'stream.video.profile', label: 'Profile', value: sps.profileName });
                  if (sps.level) streamFields.push({ key: 'stream.video.level', label: 'Level', value: (sps.level / 10).toFixed(1) });
                  if (sps.width && sps.height) streamFields.push({ key: 'stream.video.resolution', label: 'Resolution', value: sps.width + '\u00D7' + sps.height });
                  if (sps.chromaFormat) {
                    const chromaNames = { 1: '4:2:0', 2: '4:2:2', 3: '4:4:4' };
                    streamFields.push({ key: 'stream.video.chroma', label: 'Chroma', value: chromaNames[sps.chromaFormat] || String(sps.chromaFormat) });
                  }
                  if (sps.bitDepthLuma) streamFields.push({ key: 'stream.video.bitDepth', label: 'Bit Depth', value: String(sps.bitDepthLuma) });
                  if (sps.refFrames) streamFields.push({ key: 'stream.video.refFrames', label: 'Reference Frames', value: String(sps.refFrames) });
                }
              }
            }
          }

          // H.265 hvcC box
          if (cfg.tag === 'hvcC' && cfg.size >= 23 && CV.parseSPS_H265) {
            // hvcC contains arrays of NAL units; extract first SPS
            const generalProfileIdc = bytes[cfg.offset + 1] & 0x1F;
            const generalLevelIdc = bytes[cfg.offset + 12];
            const numArrays = bytes[cfg.offset + 22];
            let aOff = cfg.offset + 23;
            for (let a = 0; a < numArrays && aOff + 3 <= cfg.offset + cfg.size; ++a) {
              const nalType = bytes[aOff] & 0x3F;
              const numNalus = readU16BE(bytes, aOff + 1);
              aOff += 3;
              for (let n = 0; n < numNalus && aOff + 2 <= cfg.offset + cfg.size; ++n) {
                const nalLen = readU16BE(bytes, aOff);
                aOff += 2;
                if (nalType === 33 && nalLen > 0 && aOff + nalLen <= bytes.length) {
                  const spsBytes = bytes.slice(aOff, aOff + nalLen);
                  const sps = CV.parseSPS_H265(spsBytes);
                  if (sps) {
                    streamFields.push({ key: 'stream.video.codec', label: 'Codec', value: 'H.265/HEVC' });
                    if (sps.profileName) streamFields.push({ key: 'stream.video.profile', label: 'Profile', value: sps.profileName });
                    if (sps.level) streamFields.push({ key: 'stream.video.level', label: 'Level', value: (sps.level / 30).toFixed(1) });
                    if (sps.tier) streamFields.push({ key: 'stream.video.tier', label: 'Tier', value: sps.tier });
                    if (sps.width && sps.height) streamFields.push({ key: 'stream.video.resolution', label: 'Resolution', value: sps.width + '\u00D7' + sps.height });
                    if (sps.chromaFormat) {
                      const chromaNames = { 1: '4:2:0', 2: '4:2:2', 3: '4:4:4' };
                      streamFields.push({ key: 'stream.video.chroma', label: 'Chroma', value: chromaNames[sps.chromaFormat] || String(sps.chromaFormat) });
                    }
                    if (sps.bitDepthLuma) streamFields.push({ key: 'stream.video.bitDepth', label: 'Bit Depth', value: String(sps.bitDepthLuma) });
                  }
                }
                aOff += nalLen;
              }
            }
          }

          // Codec tag identification
          if (streamFields.length === 0 && ['avc1', 'avc3', 'hev1', 'hvc1', 'vp09', 'av01', 'mp4v'].includes(cfg.tag)) {
            const tagNames = { avc1: 'H.264/AVC', avc3: 'H.264/AVC', hev1: 'H.265/HEVC', hvc1: 'H.265/HEVC', vp09: 'VP9', av01: 'AV1', mp4v: 'MPEG-4 Part 2' };
            streamFields.push({ key: 'stream.video.codec', label: 'Video Codec', value: tagNames[cfg.tag] || cfg.tag });
          }
          if (streamFields.length === 0 && ['mp4a', 'ac-3', 'ec-3', 'Opus', 'fLaC', 'alac'].includes(cfg.tag)) {
            const audioNames = { mp4a: 'AAC', 'ac-3': 'AC-3 (Dolby Digital)', 'ec-3': 'E-AC-3 (Dolby Digital Plus)', Opus: 'Opus', fLaC: 'FLAC', alac: 'Apple Lossless' };
            streamFields.push({ key: 'stream.audio.codec', label: 'Audio Codec', value: audioNames[cfg.tag] || cfg.tag });
          }

          if (streamFields.length > 0)
            categories.push({ name: 'Stream: ' + cfg.tag, icon: 'video', fields: streamFields });
        }
      } catch (_) { /* codec analysis is best-effort */ }
    }

    return { categories, images: mp4Images, byteRegions };
  }

  // =========================================================================
  // MKV/WebM (EBML) parser
  // =========================================================================

  function readVint(bytes, offset) {
    if (offset >= bytes.length) return { value: 0, length: 0 };
    const first = bytes[offset];
    let length = 1;
    let mask = 0x80;
    while (length <= 8 && !(first & mask)) { ++length; mask >>= 1; }
    if (length > 8) return { value: 0, length: 0 };
    let value = first & (mask - 1);
    for (let i = 1; i < length && offset + i < bytes.length; ++i)
      value = value * 256 + bytes[offset + i];
    return { value, length };
  }

  function parseEBML(bytes) {
    const fields = [];

    // Read EBML header to get DocType
    let pos = 0;
    const headerIdVint = readVint(bytes, pos);
    pos += headerIdVint.length;
    const headerSizeVint = readVint(bytes, pos);
    pos += headerSizeVint.length;
    const headerEnd = pos + headerSizeVint.value;

    let docType = '';
    while (pos < headerEnd && pos < bytes.length) {
      const elId = readVint(bytes, pos); pos += elId.length;
      const elSize = readVint(bytes, pos); pos += elSize.length;
      // DocType element ID is 0x4282
      if (elId.value === 0x4282)
        docType = readString(bytes, pos, elSize.value);
      pos += elSize.value;
    }

    if (docType === 'webm') fields.push({ key: 'ebml.format', label: 'Format', value: 'WebM' });
    else if (docType === 'matroska') fields.push({ key: 'ebml.format', label: 'Format', value: 'Matroska (MKV)' });
    else fields.push({ key: 'ebml.docType', label: 'DocType', value: docType || 'unknown' });

    return { categories: [{ name: 'Container', icon: 'video', fields }], images: [] };
  }

  P.registerParsers({ mp4: parseMP4, ebml: parseEBML });
})();
