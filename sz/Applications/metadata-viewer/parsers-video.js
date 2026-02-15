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

    walkBoxes(0, bytes.length, 0);

    if (fields.length > 0)
      categories.push({ name: 'Container', icon: 'video', fields });

    if (ilstFields.length > 0)
      categories.push({ name: 'iTunes Metadata', icon: 'music', fields: ilstFields });

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
