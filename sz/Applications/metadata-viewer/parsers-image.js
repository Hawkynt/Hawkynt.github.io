;(function() {
  'use strict';
  const P = window.SZ.MetadataParsers;
  const { readU8, readU16LE, readU16BE, readU32LE, readU32BE, readI32LE, readU64LE, readString, readUTF8, bytesToDataUrl, formatSize, matchBytes } = P;

  // =========================================================================
  // EXIF tag maps (expanded to ~80 tags)
  // =========================================================================

  const EXIF_TAGS = {
    // Image structure
    0x0100: 'Image Width',
    0x0101: 'Image Height',
    0x0103: 'Compression',
    0x010E: 'Image Description',
    0x010F: 'Camera Make',
    0x0110: 'Camera Model',
    0x0112: 'Orientation',
    0x0115: 'Samples Per Pixel',
    0x011A: 'X Resolution',
    0x011B: 'Y Resolution',
    0x0128: 'Resolution Unit',
    0x0131: 'Software',
    0x0132: 'Date/Time',
    0x013B: 'Artist',
    0x0213: 'YCbCr Positioning',
    0x8298: 'Copyright',
    // Camera settings
    0x829A: 'Exposure Time',
    0x829D: 'F-Number',
    0x8822: 'Exposure Program',
    0x8827: 'ISO Speed',
    0x9000: 'EXIF Version',
    0x9003: 'Date/Time Original',
    0x9004: 'Date/Time Digitized',
    0x9101: 'Components Configuration',
    0x9102: 'Compressed Bits/Pixel',
    0x9201: 'Shutter Speed Value',
    0x9202: 'Aperture Value',
    0x9203: 'Brightness Value',
    0x9204: 'Exposure Bias',
    0x9205: 'Max Aperture Value',
    0x9206: 'Subject Distance',
    0x9207: 'Metering Mode',
    0x9208: 'Light Source',
    0x9209: 'Flash',
    0x920A: 'Focal Length',
    0x920B: 'Sensing Method',
    0x9214: 'Subject Area',
    0x927C: 'Maker Note',
    0x9286: 'User Comment',
    0x9290: 'SubSec Time',
    0x9291: 'SubSec Time Original',
    0x9292: 'SubSec Time Digitized',
    // Flashpix
    0xA000: 'Flashpix Version',
    0xA001: 'Color Space',
    0xA002: 'Pixel X Dimension',
    0xA003: 'Pixel Y Dimension',
    0xA004: 'Related Sound File',
    // Advanced capture
    0xA20B: 'Flash Energy',
    0xA20E: 'Focal Plane X Resolution',
    0xA20F: 'Focal Plane Y Resolution',
    0xA210: 'Focal Plane Resolution Unit',
    0xA214: 'Subject Location',
    0xA215: 'Exposure Index',
    0xA217: 'Sensing Method (EXIF)',
    // Image quality
    0xA300: 'File Source',
    0xA301: 'Scene Type',
    0xA302: 'CFA Pattern',
    0xA401: 'Custom Rendered',
    0xA402: 'Exposure Mode',
    0xA403: 'White Balance',
    0xA404: 'Digital Zoom Ratio',
    0xA405: 'Focal Length (35mm)',
    0xA406: 'Scene Capture Type',
    0xA407: 'Gain Control',
    0xA408: 'Contrast',
    0xA409: 'Saturation',
    0xA40A: 'Sharpness',
    0xA40C: 'Subject Distance Range',
    0xA420: 'Image Unique ID',
    0xA005: 'Interoperability Offset',
    // Lens
    0xA431: 'Serial Number',
    0xA432: 'Lens Info',
    0xA433: 'Lens Make',
    0xA434: 'Lens Model',
    0xA435: 'Lens Serial Number',
  };

  const GPS_TAGS = {
    0x0000: 'GPS Version ID',
    0x0001: 'Latitude Ref',
    0x0002: 'Latitude',
    0x0003: 'Longitude Ref',
    0x0004: 'Longitude',
    0x0005: 'Altitude Ref',
    0x0006: 'Altitude',
    0x0007: 'Time Stamp',
    0x0008: 'Satellites',
    0x0009: 'Status',
    0x000A: 'Measure Mode',
    0x000B: 'DOP',
    0x000C: 'Speed Ref',
    0x000D: 'Speed',
    0x000E: 'Track Ref',
    0x000F: 'Track',
    0x0010: 'Img Direction Ref',
    0x0011: 'Img Direction',
    0x0012: 'Map Datum',
    0x0013: 'Dest Latitude Ref',
    0x0014: 'Dest Latitude',
    0x0015: 'Dest Longitude Ref',
    0x0016: 'Dest Longitude',
    0x0017: 'Dest Bearing Ref',
    0x0018: 'Dest Bearing',
    0x0019: 'Dest Distance Ref',
    0x001A: 'Dest Distance',
    0x001D: 'Date Stamp',
  };

  const ORIENTATION_MAP = {
    1: 'Normal',
    2: 'Mirrored',
    3: 'Rotated 180',
    4: 'Mirrored + Rotated 180',
    5: 'Mirrored + Rotated 270 CW',
    6: 'Rotated 90 CW',
    7: 'Mirrored + Rotated 90 CW',
    8: 'Rotated 270 CW',
  };

  const METERING_MAP = {
    0: 'Unknown', 1: 'Average', 2: 'Center-weighted', 3: 'Spot',
    4: 'Multi-spot', 5: 'Multi-segment', 6: 'Partial',
  };

  const EXPOSURE_PROGRAM_MAP = {
    0: 'Not Defined', 1: 'Manual', 2: 'Normal Program', 3: 'Aperture Priority',
    4: 'Shutter Priority', 5: 'Creative', 6: 'Action', 7: 'Portrait', 8: 'Landscape',
  };

  const LIGHT_SOURCE_MAP = {
    0: 'Unknown', 1: 'Daylight', 2: 'Fluorescent', 3: 'Tungsten',
    4: 'Flash', 9: 'Fine Weather', 10: 'Cloudy', 11: 'Shade',
    12: 'Daylight Fluorescent', 13: 'Day White Fluorescent', 14: 'Cool White Fluorescent',
    15: 'White Fluorescent', 17: 'Standard Light A', 18: 'Standard Light B',
    19: 'Standard Light C', 20: 'D55', 21: 'D65', 22: 'D75', 23: 'D50', 24: 'ISO Studio Tungsten',
    255: 'Other',
  };

  const SCENE_CAPTURE_MAP = { 0: 'Standard', 1: 'Landscape', 2: 'Portrait', 3: 'Night Scene' };
  const WHITE_BALANCE_MAP = { 0: 'Auto', 1: 'Manual' };
  const EXPOSURE_MODE_MAP = { 0: 'Auto', 1: 'Manual', 2: 'Auto Bracket' };
  const CUSTOM_RENDERED_MAP = { 0: 'Normal', 1: 'Custom' };
  const GAIN_CONTROL_MAP = { 0: 'None', 1: 'Low Gain Up', 2: 'High Gain Up', 3: 'Low Gain Down', 4: 'High Gain Down' };
  const CONTRAST_MAP = { 0: 'Normal', 1: 'Soft', 2: 'Hard' };
  const SATURATION_MAP = { 0: 'Normal', 1: 'Low', 2: 'High' };
  const SHARPNESS_MAP = { 0: 'Normal', 1: 'Soft', 2: 'Hard' };
  const SUBJECT_DISTANCE_RANGE_MAP = { 0: 'Unknown', 1: 'Macro', 2: 'Close', 3: 'Distant' };
  const FILE_SOURCE_MAP = { 1: 'Film Scanner', 2: 'Reflection Print Scanner', 3: 'Digital Camera' };
  const SCENE_TYPE_MAP = { 1: 'Directly Photographed' };
  const RESOLUTION_UNIT_MAP = { 1: 'No Unit', 2: 'Inch', 3: 'Centimeter' };
  const COMPRESSION_MAP = { 1: 'Uncompressed', 6: 'JPEG' };
  const YCBCR_POS_MAP = { 1: 'Centered', 2: 'Co-sited' };

  function formatFlash(val) {
    if (typeof val !== 'number') return String(val);
    const parts = [];
    parts.push((val & 1) ? 'Fired' : 'Did not fire');
    const returnMode = (val >> 1) & 3;
    if (returnMode === 2) parts.push('strobe return not detected');
    else if (returnMode === 3) parts.push('strobe return detected');
    const mode = (val >> 3) & 3;
    if (mode === 1) parts.push('compulsory on');
    else if (mode === 2) parts.push('compulsory off');
    else if (mode === 3) parts.push('auto');
    if (val & 0x40) parts.push('red-eye reduction');
    return parts.join(', ');
  }

  function formatGPSCoord(rational, ref) {
    if (!Array.isArray(rational) || rational.length < 3) return String(rational);
    const deg = rational[0], min = rational[1], sec = rational[2];
    const decimal = deg + min / 60 + sec / 3600;
    return deg + '\u00B0 ' + min + "' " + sec.toFixed(2) + '" ' + (ref || '') + ' (' + decimal.toFixed(6) + '\u00B0)';
  }

  function gpsToDecimal(rationalArr, ref) {
    if (!Array.isArray(rationalArr) || rationalArr.length < 3) return 0;
    const deg = rationalArr[0], min = rationalArr[1], sec = rationalArr[2];
    let decimal = deg + min / 60 + sec / 3600;
    if (ref === 'S' || ref === 'W') decimal = -decimal;
    return decimal;
  }

  // =========================================================================
  // IPTC dataset tags
  // =========================================================================

  const IPTC_TAGS = {
    0x00: 'Record Version',
    0x03: 'Object Type Ref',
    0x04: 'Object Attribute Ref',
    0x05: 'Object Name',
    0x07: 'Edit Status',
    0x0A: 'Urgency',
    0x0C: 'Subject Ref',
    0x0F: 'Category',
    0x14: 'Supplemental Categories',
    0x16: 'Fixture Identifier',
    0x19: 'Keywords',
    0x1A: 'Content Location Code',
    0x1B: 'Content Location Name',
    0x1E: 'Release Date',
    0x23: 'Release Time',
    0x25: 'Expiration Date',
    0x28: 'Special Instructions',
    0x37: 'Date Created',
    0x3C: 'Time Created',
    0x41: 'Originating Program',
    0x46: 'Program Version',
    0x50: 'Byline',
    0x55: 'Byline Title',
    0x5A: 'City',
    0x5C: 'Sub-Location',
    0x5F: 'Province/State',
    0x64: 'Country Code',
    0x65: 'Country',
    0x67: 'Original Transmission Ref',
    0x69: 'Headline',
    0x6E: 'Credit',
    0x73: 'Source',
    0x74: 'Copyright Notice',
    0x76: 'Contact',
    0x78: 'Caption/Abstract',
    0x7A: 'Writer/Editor',
  };

  // =========================================================================
  // EXIF parser
  // =========================================================================

  function parseEXIF(bytes, tiffStart, tiffLength, categories, images) {
    if (tiffLength < 8) return;

    const le = bytes[tiffStart] === 0x49;
    const readU16 = le ? readU16LE : readU16BE;
    const readU32 = le ? readU32LE : readU32BE;

    const magic = readU16(bytes, tiffStart + 2);
    if (magic !== 0x002A) return;

    const ifd0Offset = readU32(bytes, tiffStart + 4);

    function readIFDValue(type, count, valueOffset) {
      const abs = tiffStart + valueOffset;
      if (type === 2)
        return readString(bytes, abs, count).replace(/\0+$/, '');
      if (type === 3 && count === 1)
        return readU16(bytes, abs);
      if (type === 3 && count > 1) {
        const vals = [];
        for (let i = 0; i < count; ++i) vals.push(readU16(bytes, abs + i * 2));
        return vals;
      }
      if (type === 4 && count === 1)
        return readU32(bytes, abs);
      if (type === 5 && count === 1) {
        const num = readU32(bytes, abs);
        const den = readU32(bytes, abs + 4);
        return den === 0 ? 0 : num / den;
      }
      if (type === 5 && count > 1) {
        const vals = [];
        for (let i = 0; i < count; ++i) {
          const num = readU32(bytes, abs + i * 8);
          const den = readU32(bytes, abs + i * 8 + 4);
          vals.push(den === 0 ? 0 : num / den);
        }
        return vals;
      }
      if (type === 7) {
        if (count <= 4) {
          const raw = [];
          for (let i = 0; i < count; ++i) raw.push(bytes[abs + i]);
          return raw;
        }
        // Try UserComment decode (8-byte charset header + text)
        if (count >= 8 && count < 65536) {
          const cs = readString(bytes, abs, 8);
          if (cs.startsWith('ASCII') || cs.startsWith('\0\0\0\0')) {
            const text = readString(bytes, abs + 8, count - 8).replace(/\0+$/, '').trim();
            if (text) return text;
          }
        }
        return count; // byte count as presence marker
      }
      if (type === 10 && count === 1) {
        const numU = readU32(bytes, abs);
        const denU = readU32(bytes, abs + 4);
        const num = numU > 0x7FFFFFFF ? numU - 0x100000000 : numU;
        const den = denU > 0x7FFFFFFF ? denU - 0x100000000 : denU;
        return den === 0 ? 0 : num / den;
      }
      if (type === 10 && count > 1) {
        const vals = [];
        for (let i = 0; i < count; ++i) {
          const numU = readU32(bytes, abs + i * 8);
          const denU = readU32(bytes, abs + i * 8 + 4);
          const num = numU > 0x7FFFFFFF ? numU - 0x100000000 : numU;
          const den = denU > 0x7FFFFFFF ? denU - 0x100000000 : denU;
          vals.push(den === 0 ? 0 : num / den);
        }
        return vals;
      }
      return null;
    }

    function readIFD(ifdOffset, tagMap) {
      const abs = tiffStart + ifdOffset;
      if (abs + 2 > bytes.length) return {};
      const entryCount = readU16(bytes, abs);
      const result = {};

      for (let i = 0; i < entryCount; ++i) {
        const entryBase = abs + 2 + i * 12;
        if (entryBase + 12 > bytes.length) break;
        const tag = readU16(bytes, entryBase);
        const type = readU16(bytes, entryBase + 2);
        const count = readU32(bytes, entryBase + 4);
        const typeSize = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type] || 1;
        const totalSize = count * typeSize;

        let valueOffset;
        if (totalSize <= 4)
          valueOffset = entryBase + 8 - tiffStart;
        else
          valueOffset = readU32(bytes, entryBase + 8);

        const tagName = (tagMap && tagMap[tag]) || null;
        const value = readIFDValue(type, count, valueOffset);
        result[tag] = { tag, tagName, type, count, value };
      }

      const nextOffset = abs + 2 + entryCount * 12;
      if (nextOffset + 4 <= bytes.length)
        result._nextIFD = readU32(bytes, nextOffset);

      return result;
    }

    function formatExifValue(tag, value) {
      if (tag === 0x0112) return ORIENTATION_MAP[value] || String(value);
      if (tag === 0x0128) return RESOLUTION_UNIT_MAP[value] || String(value);
      if (tag === 0x0103) return COMPRESSION_MAP[value] || String(value);
      if (tag === 0x0213) return YCBCR_POS_MAP[value] || String(value);
      if (tag === 0x829A && typeof value === 'number')
        return value < 1 ? '1/' + Math.round(1 / value) + ' s' : value + ' s';
      if (tag === 0x829D && typeof value === 'number')
        return 'f/' + value.toFixed(1);
      if (tag === 0x8822) return EXPOSURE_PROGRAM_MAP[value] || String(value);
      if (tag === 0x9207) return METERING_MAP[value] || String(value);
      if (tag === 0x9208) return LIGHT_SOURCE_MAP[value] || String(value);
      if (tag === 0x9209) return formatFlash(value);
      if (tag === 0x920A && typeof value === 'number') return value.toFixed(1) + ' mm';
      if (tag === 0xA001) return value === 1 ? 'sRGB' : value === 0xFFFF ? 'Uncalibrated' : String(value);
      if (tag === 0xA300) return FILE_SOURCE_MAP[value] || String(value);
      if (tag === 0xA301) return SCENE_TYPE_MAP[value] || String(value);
      if (tag === 0xA401) return CUSTOM_RENDERED_MAP[value] || String(value);
      if (tag === 0xA402) return EXPOSURE_MODE_MAP[value] || String(value);
      if (tag === 0xA403) return WHITE_BALANCE_MAP[value] || String(value);
      if (tag === 0xA404 && typeof value === 'number') return value === 0 ? 'Not used' : value.toFixed(2) + 'x';
      if (tag === 0xA405 && typeof value === 'number') return value + ' mm';
      if (tag === 0xA406) return SCENE_CAPTURE_MAP[value] || String(value);
      if (tag === 0xA407) return GAIN_CONTROL_MAP[value] || String(value);
      if (tag === 0xA408) return CONTRAST_MAP[value] || String(value);
      if (tag === 0xA409) return SATURATION_MAP[value] || String(value);
      if (tag === 0xA40A) return SHARPNESS_MAP[value] || String(value);
      if (tag === 0xA40C) return SUBJECT_DISTANCE_RANGE_MAP[value] || String(value);
      if (tag === 0x9206 && typeof value === 'number') return value.toFixed(2) + ' m';
      if (tag === 0x9205 && typeof value === 'number') return 'f/' + Math.pow(2, value / 2).toFixed(1);
      if (tag === 0x927C) return typeof value === 'number' ? '(present, ' + value + ' bytes)' : '(present, not decoded)';
      if (tag === 0x9101) {
        if (Array.isArray(value)) {
          const compNames = { 0: '', 1: 'Y', 2: 'Cb', 3: 'Cr', 4: 'R', 5: 'G', 6: 'B' };
          return value.map(b => compNames[b] || '?').filter(Boolean).join('');
        }
        return String(value);
      }
      if (tag === 0x9286) {
        if (typeof value === 'string') return value;
        if (typeof value === 'number') return '(' + value + ' bytes)';
        return String(value);
      }
      if (tag === 0x9000 || tag === 0xA000) {
        if (Array.isArray(value)) return String.fromCharCode(...value);
        if (typeof value === 'string') return value;
        return String(value);
      }
      if (typeof value === 'number') return String(value);
      if (Array.isArray(value))
        return value.map(v => typeof v === 'number' ? v.toFixed(4) : String(v)).join(', ');
      return value == null ? null : String(value);
    }

    // Editable EXIF text tags
    const EDITABLE_TEXT_TAGS = new Set([0x010E, 0x010F, 0x0110, 0x0131, 0x013B, 0x8298]);
    // Editable EXIF date tags
    const EDITABLE_DATE_TAGS = new Set([0x0132, 0x9003, 0x9004]);

    // Orientation select options
    const ORIENTATION_OPTIONS = [
      { value: '1', label: '1 — Normal' },
      { value: '2', label: '2 — Mirror horizontal' },
      { value: '3', label: '3 — Rotate 180°' },
      { value: '4', label: '4 — Mirror vertical' },
      { value: '5', label: '5 — Mirror + rotate 270°' },
      { value: '6', label: '6 — Rotate 90°' },
      { value: '7', label: '7 — Mirror + rotate 90°' },
      { value: '8', label: '8 — Rotate 270°' },
    ];

    function getEditInfo(tag) {
      if (EDITABLE_TEXT_TAGS.has(tag)) return { editable: true, editType: 'text' };
      if (EDITABLE_DATE_TAGS.has(tag)) return { editable: true, editType: 'date' };
      if (tag === 0x0112) return { editable: true, editType: 'select', options: ORIENTATION_OPTIONS };
      return { editable: false, editType: 'text' };
    }

    function processIFD(ifd, exifFields) {
      for (const entry of Object.values(ifd)) {
        if (!entry.tagName || entry.tagName.startsWith('_')) continue;
        const displayValue = formatExifValue(entry.tag, entry.value);
        if (displayValue == null) continue;
        if (exifFields.some(f => f.key === 'exif.' + entry.tag.toString(16))) continue;
        const ei = getEditInfo(entry.tag);
        const field = {
          key: 'exif.' + entry.tag.toString(16),
          label: entry.tagName,
          value: String(displayValue),
          editable: ei.editable,
          editType: ei.editType,
        };
        if (ei.options) field.options = ei.options;
        exifFields.push(field);
      }
    }

    // Read IFD0
    const ifd0 = readIFD(ifd0Offset, EXIF_TAGS);
    const exifFields = [];
    processIFD(ifd0, exifFields);

    // Sub-IFD (EXIF)
    if (ifd0[0x8769]) {
      const subIFD = readIFD(ifd0[0x8769].value, EXIF_TAGS);
      processIFD(subIFD, exifFields);
    }

    if (exifFields.length > 0)
      categories.push({ name: 'EXIF', icon: 'camera', fields: exifFields });

    // GPS IFD
    if (ifd0[0x8825]) {
      const gpsIFD = readIFD(ifd0[0x8825].value, GPS_TAGS);
      const gpsFields = [];
      const gpsRaw = {};

      for (const entry of Object.values(gpsIFD)) {
        if (!entry.tagName || entry.tagName.startsWith('_')) continue;
        gpsRaw[entry.tag] = entry.value;
      }

      // Compound editable Coordinates field
      const hasLat = gpsRaw[0x0002] && gpsRaw[0x0001];
      const hasLng = gpsRaw[0x0004] && gpsRaw[0x0003];
      if (hasLat && hasLng) {
        const decLat = gpsToDecimal(gpsRaw[0x0002], gpsRaw[0x0001]);
        const decLng = gpsToDecimal(gpsRaw[0x0004], gpsRaw[0x0003]);
        const latStr = formatGPSCoord(gpsRaw[0x0002], gpsRaw[0x0001]);
        const lngStr = formatGPSCoord(gpsRaw[0x0004], gpsRaw[0x0003]);
        gpsFields.push({
          key: 'gps.coordinates', label: 'Coordinates',
          value: latStr + '  /  ' + lngStr,
          editable: true, editType: 'geo',
          lat: decLat, lng: decLng,
        });
      }

      // Editable Altitude field
      if (gpsRaw[0x0006] != null) {
        const altVal = typeof gpsRaw[0x0006] === 'number' ? gpsRaw[0x0006] : 0;
        const belowSea = gpsRaw[0x0005] && gpsRaw[0x0005] === 1;
        gpsFields.push({
          key: 'gps.altitude', label: 'Altitude',
          value: altVal.toFixed(2) + ' m' + (belowSea ? ' (below sea level)' : ''),
          editable: true, editType: 'number', step: 0.01,
        });
      }

      // Editable Image Direction field
      if (gpsRaw[0x0011] != null) {
        const dirVal = typeof gpsRaw[0x0011] === 'number' ? gpsRaw[0x0011] : 0;
        const dirRef = gpsRaw[0x0010] || 'T';
        gpsFields.push({
          key: 'gps.direction', label: 'Image Direction',
          value: dirVal.toFixed(1) + '\u00B0 ' + (dirRef === 'M' ? 'Magnetic' : 'True'),
          editable: true, editType: 'compass',
        });
      }

      // Compound editable Destination field
      const hasDestLat = gpsRaw[0x0014] && gpsRaw[0x0013];
      const hasDestLng = gpsRaw[0x0016] && gpsRaw[0x0015];
      if (hasDestLat && hasDestLng) {
        const decDestLat = gpsToDecimal(gpsRaw[0x0014], gpsRaw[0x0013]);
        const decDestLng = gpsToDecimal(gpsRaw[0x0016], gpsRaw[0x0015]);
        const destLatStr = formatGPSCoord(gpsRaw[0x0014], gpsRaw[0x0013]);
        const destLngStr = formatGPSCoord(gpsRaw[0x0016], gpsRaw[0x0015]);
        gpsFields.push({
          key: 'gps.destination', label: 'Destination',
          value: destLatStr + '  /  ' + destLngStr,
          editable: true, editType: 'geo',
          lat: decDestLat, lng: decDestLng,
        });
      }

      // Dest Bearing
      if (gpsRaw[0x0018] != null) {
        const bearVal = typeof gpsRaw[0x0018] === 'number' ? gpsRaw[0x0018] : 0;
        const bearRef = gpsRaw[0x0017] || 'T';
        gpsFields.push({
          key: 'gps.destBearing', label: 'Dest Bearing',
          value: bearVal.toFixed(1) + '\u00B0 ' + (bearRef === 'M' ? 'Magnetic' : 'True'),
        });
      }

      // Dest Distance
      if (gpsRaw[0x001A] != null) {
        const distVal = typeof gpsRaw[0x001A] === 'number' ? gpsRaw[0x001A] : 0;
        const distRef = gpsRaw[0x0019] || 'K';
        const unitLabel = distRef === 'M' ? 'mi' : distRef === 'N' ? 'nmi' : 'km';
        gpsFields.push({
          key: 'gps.destDistance', label: 'Dest Distance',
          value: distVal.toFixed(2) + ' ' + unitLabel,
        });
      }

      // Remaining GPS fields (non-compound)
      for (const entry of Object.values(gpsIFD)) {
        if (!entry.tagName || entry.tagName.startsWith('_')) continue;
        // Skip tags already handled as compound fields
        if ([0x0001, 0x0002, 0x0003, 0x0004, 0x0005, 0x0006, 0x0010, 0x0011,
             0x0013, 0x0014, 0x0015, 0x0016, 0x0017, 0x0018, 0x0019, 0x001A].includes(entry.tag))
          continue;

        let displayValue = entry.value;
        if (entry.tag === 0x0007 && Array.isArray(displayValue))
          displayValue = Math.floor(displayValue[0]) + ':' + String(Math.floor(displayValue[1])).padStart(2, '0') + ':' + displayValue[2].toFixed(2).padStart(5, '0') + ' UTC';
        else if (entry.tag === 0x000D && typeof displayValue === 'number')
          displayValue = displayValue.toFixed(2) + ' ' + (gpsRaw[0x000C] || '');
        else if (entry.tag === 0x000C || entry.tag === 0x000E)
          continue; // ref tags folded into other displays
        else if (Array.isArray(displayValue))
          displayValue = displayValue.map(v => typeof v === 'number' ? v.toFixed(4) : String(v)).join(', ');
        else if (typeof displayValue === 'number')
          displayValue = displayValue.toFixed(4);
        else if (displayValue == null)
          continue;

        gpsFields.push({ key: 'gps.' + entry.tag.toString(16), label: entry.tagName, value: String(displayValue) });
      }

      if (gpsFields.length > 0)
        categories.push({ name: 'GPS', icon: 'location', fields: gpsFields });
    }

    // Thumbnail from IFD1
    if (ifd0._nextIFD && ifd0._nextIFD > 0) {
      const THUMB_TAGS = {
        0x0103: 'Compression', 0x011A: 'X Resolution', 0x011B: 'Y Resolution',
        0x0128: 'Resolution Unit', 0x0201: 'JPEG IF Offset', 0x0202: 'JPEG IF Byte Count',
      };
      const ifd1 = readIFD(ifd0._nextIFD, THUMB_TAGS);
      if (ifd1[0x0201] && ifd1[0x0202]) {
        const thumbOffset = tiffStart + ifd1[0x0201].value;
        const thumbLength = ifd1[0x0202].value;
        if (thumbOffset + thumbLength <= bytes.length) {
          const thumbBytes = bytes.slice(thumbOffset, thumbOffset + thumbLength);
          images.push({ label: 'EXIF Thumbnail', mimeType: 'image/jpeg', dataUrl: bytesToDataUrl(thumbBytes, 'image/jpeg') });
        }
      }
      const thumbFields = [];
      for (const entry of Object.values(ifd1)) {
        if (!entry || typeof entry !== 'object' || !entry.tagName || entry.tagName.startsWith('_')) continue;
        const displayValue = formatExifValue(entry.tag, entry.value);
        if (displayValue == null) continue;
        thumbFields.push({ key: 'thumb.' + entry.tag.toString(16), label: entry.tagName, value: String(displayValue) });
      }
      if (thumbFields.length > 0)
        categories.push({ name: 'Thumbnail', icon: 'image', fields: thumbFields });
    }
  }

  // =========================================================================
  // IPTC parser (APP13 / Photoshop 3.0)
  // =========================================================================

  function parseIPTC(bytes, offset, length) {
    const fields = [];
    const end = offset + length;

    // Walk 8BIM resource blocks
    let pos = offset;
    while (pos + 12 <= end) {
      // Look for "8BIM" signature
      if (bytes[pos] !== 0x38 || bytes[pos + 1] !== 0x42 || bytes[pos + 2] !== 0x49 || bytes[pos + 3] !== 0x4D) {
        ++pos;
        continue;
      }
      pos += 4; // skip "8BIM"
      const resourceId = readU16BE(bytes, pos);
      pos += 2;

      // Pascal string name (1-byte length + chars, padded to even)
      const nameLen = bytes[pos];
      ++pos;
      pos += nameLen;
      if ((nameLen + 1) & 1) ++pos; // pad to even

      if (pos + 4 > end) break;
      const dataSize = readU32BE(bytes, pos);
      pos += 4;

      if (resourceId === 0x0404 && dataSize > 0) {
        // IPTC-NAA record — parse IIM datasets
        const iptcEnd = Math.min(pos + dataSize, end);
        let ip = pos;
        const keywords = [];
        const suppCats = [];

        while (ip + 5 <= iptcEnd) {
          if (bytes[ip] !== 0x1C) { ++ip; continue; }
          const record = bytes[ip + 1];
          const dataset = bytes[ip + 2];
          const dsSize = readU16BE(bytes, ip + 3);
          ip += 5;

          if (record !== 0x02 || ip + dsSize > iptcEnd) { ip += dsSize; continue; }

          const tagName = IPTC_TAGS[dataset];
          if (!tagName) { ip += dsSize; continue; }

          const val = readUTF8(bytes, ip, dsSize).replace(/\0+$/, '').trim();
          if (!val) { ip += dsSize; continue; }

          // Accumulate repeatable fields
          if (dataset === 0x19) { keywords.push(val); ip += dsSize; continue; }
          if (dataset === 0x14) { suppCats.push(val); ip += dsSize; continue; }

          if (!fields.some(f => f.key === 'iptc.' + dataset.toString(16)))
            fields.push({ key: 'iptc.' + dataset.toString(16), label: tagName, value: val });
          ip += dsSize;
        }

        if (keywords.length > 0)
          fields.push({ key: 'iptc.19', label: 'Keywords', value: keywords.join('; ') });
        if (suppCats.length > 0)
          fields.push({ key: 'iptc.14', label: 'Supplemental Categories', value: suppCats.join('; ') });
      }

      pos += dataSize;
      if (dataSize & 1) ++pos; // pad to even
    }
    return fields;
  }

  // =========================================================================
  // JPEG parser
  // =========================================================================

  function parseJPEG(bytes) {
    const categories = [];
    const images = [];
    const imgFields = [];
    const byteRegions = [];

    byteRegions.push({ offset: 0, length: 2, label: 'SOI Marker', color: 0 });

    let offset = 2;
    let width = 0, height = 0, colorComponents = 0;
    let exifData = null;

    while (offset < bytes.length - 1) {
      if (bytes[offset] !== 0xFF) break;
      const marker = bytes[offset + 1];
      const markerPos = offset;
      offset += 2;

      if (marker === 0xD9) {
        byteRegions.push({ offset: markerPos, length: 2, label: 'EOI Marker', color: 0 });
        break;
      }
      if (marker === 0x00 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) continue;

      if (offset + 2 > bytes.length) break;
      const segLen = readU16BE(bytes, offset);
      const segData = offset + 2;

      const markerName = marker === 0xE0 ? 'APP0' : marker === 0xE1 ? 'APP1' : marker === 0xED ? 'APP13' : marker === 0xC0 ? 'SOF0' : marker === 0xC2 ? 'SOF2' : marker === 0xDA ? 'SOS' : marker === 0xDB ? 'DQT' : marker === 0xC4 ? 'DHT' : 'Segment 0x' + marker.toString(16).toUpperCase();
      byteRegions.push({ offset: markerPos, length: 2, label: markerName + ' Marker', color: 1 });
      byteRegions.push({ offset: offset, length: 2, label: markerName + ' Length', color: 1 });
      if (segLen > 2)
        byteRegions.push({ offset: segData, length: Math.min(segLen - 2, 256), label: markerName + ' Data', color: marker === 0xE1 ? 2 : marker === 0xDA ? 4 : 2 });

      // SOF0 or SOF2 — dimensions
      if ((marker === 0xC0 || marker === 0xC2) && segLen >= 7) {
        height = readU16BE(bytes, segData + 1);
        width = readU16BE(bytes, segData + 3);
        colorComponents = readU8(bytes, segData + 5);
        imgFields.push({ key: 'jpeg.width', label: 'Width', value: width + ' px', raw: width });
        imgFields.push({ key: 'jpeg.height', label: 'Height', value: height + ' px', raw: height });
        imgFields.push({ key: 'jpeg.compression', label: 'Compression', value: marker === 0xC0 ? 'Baseline DCT' : 'Progressive DCT' });
        imgFields.push({ key: 'jpeg.components', label: 'Color Components', value: String(colorComponents) });
      }

      // APP0 — JFIF
      if (marker === 0xE0 && segLen >= 14) {
        const id = readString(bytes, segData, 5);
        if (id === 'JFIF' && bytes[segData + 4] === 0) {
          const verMaj = readU8(bytes, segData + 5);
          const verMin = readU8(bytes, segData + 6);
          const units = readU8(bytes, segData + 7);
          const xDens = readU16BE(bytes, segData + 8);
          const yDens = readU16BE(bytes, segData + 10);
          imgFields.push({ key: 'jpeg.jfifVersion', label: 'JFIF Version', value: verMaj + '.' + verMin });
          const unitLabel = units === 1 ? 'DPI' : units === 2 ? 'DPCM' : 'aspect ratio';
          imgFields.push({ key: 'jpeg.density', label: 'Density', value: xDens + ' x ' + yDens + ' ' + unitLabel });
        }
      }

      // APP1 — EXIF
      if (marker === 0xE1 && segLen >= 8) {
        const exifHeader = readString(bytes, segData, 6);
        if (exifHeader === 'Exif' && bytes[segData + 4] === 0 && bytes[segData + 5] === 0)
          exifData = { offset: segData + 6, length: segLen - 8 };
      }

      // APP13 — IPTC via Photoshop 3.0
      if (marker === 0xED && segLen > 16) {
        const psHeader = readString(bytes, segData, 14);
        if (psHeader.startsWith('Photoshop 3.0')) {
          const iptcFields = parseIPTC(bytes, segData + 14, segLen - 2 - 14);
          if (iptcFields.length > 0)
            categories.push({ name: 'IPTC', icon: 'tag', fields: iptcFields });
        }
      }

      offset += segLen;
    }

    if (imgFields.length > 0)
      categories.push({ name: 'Image', icon: 'image', fields: imgFields });

    if (exifData)
      parseEXIF(bytes, exifData.offset, exifData.length, categories, images);

    return { categories, images, byteRegions };
  }

  // =========================================================================
  // PNG parser
  // =========================================================================

  function parsePNG(bytes) {
    const categories = [];
    const imgFields = [];
    const textFields = [];
    const byteRegions = [];

    byteRegions.push({ offset: 0, length: 8, label: 'PNG Signature', color: 0 });

    let offset = 8;
    while (offset + 8 <= bytes.length) {
      const chunkLen = readU32BE(bytes, offset);
      const chunkType = readString(bytes, offset + 4, 4);
      const chunkData = offset + 8;

      byteRegions.push({ offset, length: 4, label: chunkType + ' Length', color: 1 });
      byteRegions.push({ offset: offset + 4, length: 4, label: chunkType + ' Type', color: 1 });
      if (chunkLen + 12 + offset <= bytes.length)
        byteRegions.push({ offset: chunkData + chunkLen, length: 4, label: chunkType + ' CRC', color: 6 });

      if (chunkType === 'IHDR' && chunkLen >= 13) {
        byteRegions.push({ offset: chunkData, length: 13, label: 'IHDR Data', color: 2 });
        const w = readU32BE(bytes, chunkData);
        const h = readU32BE(bytes, chunkData + 4);
        const bitDepth = readU8(bytes, chunkData + 8);
        const colorType = readU8(bytes, chunkData + 9);
        const interlace = readU8(bytes, chunkData + 12);
        const colorTypeNames = { 0: 'Grayscale', 2: 'RGB', 3: 'Indexed', 4: 'Grayscale+Alpha', 6: 'RGBA' };
        imgFields.push({ key: 'png.width', label: 'Width', value: w + ' px', raw: w });
        imgFields.push({ key: 'png.height', label: 'Height', value: h + ' px', raw: h });
        imgFields.push({ key: 'png.bitDepth', label: 'Bit Depth', value: String(bitDepth) });
        imgFields.push({ key: 'png.colorType', label: 'Color Type', value: colorTypeNames[colorType] || String(colorType) });
        imgFields.push({ key: 'png.interlace', label: 'Interlace', value: interlace ? 'Adam7' : 'None' });
      } else if (chunkType === 'IDAT')
        byteRegions.push({ offset: chunkData, length: Math.min(chunkLen, 256), label: 'Image Data', color: 4 });
      else if (chunkType === 'tEXt' || chunkType === 'iTXt' || chunkType === 'zTXt')
        byteRegions.push({ offset: chunkData, length: chunkLen, label: chunkType + ' Text', color: 7 });
      else if (chunkType === 'PLTE')
        byteRegions.push({ offset: chunkData, length: chunkLen, label: 'Palette', color: 8 });
      else if (chunkLen > 0)
        byteRegions.push({ offset: chunkData, length: chunkLen, label: chunkType + ' Data', color: 2 });

      if (chunkType === 'pHYs' && chunkLen >= 9) {
        const ppuX = readU32BE(bytes, chunkData);
        const ppuY = readU32BE(bytes, chunkData + 4);
        const unit = readU8(bytes, chunkData + 8);
        if (unit === 1) {
          const dpiX = Math.round(ppuX / 39.3701);
          const dpiY = Math.round(ppuY / 39.3701);
          imgFields.push({ key: 'png.dpi', label: 'DPI', value: dpiX + ' x ' + dpiY });
        }
      }

      if (chunkType === 'gAMA' && chunkLen >= 4) {
        const gamma = readU32BE(bytes, chunkData) / 100000;
        imgFields.push({ key: 'png.gamma', label: 'Gamma', value: gamma.toFixed(5) });
      }

      if (chunkType === 'tIME' && chunkLen >= 7) {
        const year = readU16BE(bytes, chunkData);
        const month = readU8(bytes, chunkData + 2);
        const day = readU8(bytes, chunkData + 3);
        const hour = readU8(bytes, chunkData + 4);
        const min = readU8(bytes, chunkData + 5);
        const sec = readU8(bytes, chunkData + 6);
        imgFields.push({ key: 'png.time', label: 'Modified', value: year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0') + ' ' + String(hour).padStart(2, '0') + ':' + String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0') });
      }

      if (chunkType === 'tEXt' && chunkLen > 0) {
        const rawText = readString(bytes, chunkData, chunkLen);
        const sepIdx = rawText.indexOf('\0');
        if (sepIdx >= 0) {
          const key = rawText.substring(0, sepIdx);
          const val = rawText.substring(sepIdx + 1);
          textFields.push({ key: 'png.text.' + key, label: key, value: val, editable: true, editType: 'text' });
        }
      }

      if (chunkType === 'iTXt' && chunkLen > 0) {
        const rawText = readUTF8(bytes, chunkData, chunkLen);
        const sepIdx = rawText.indexOf('\0');
        if (sepIdx >= 0) {
          const key = rawText.substring(0, sepIdx);
          const rest = rawText.substring(sepIdx + 1);
          const parts = rest.split('\0');
          const val = parts[parts.length - 1] || '';
          textFields.push({ key: 'png.itext.' + key, label: key + ' (iTXt)', value: val, editable: true, editType: 'text' });
        }
      }

      if (chunkType === 'IEND') break;
      offset += 12 + chunkLen;
    }

    if (imgFields.length > 0)
      categories.push({ name: 'Image', icon: 'image', fields: imgFields });
    if (textFields.length > 0)
      categories.push({ name: 'Text Chunks', icon: 'text', fields: textFields });

    return { categories, images: [], byteRegions };
  }

  // =========================================================================
  // GIF parser
  // =========================================================================

  function parseGIF(bytes) {
    const fields = [];
    if (bytes.length < 13) return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };

    const version = readString(bytes, 0, 6);
    const width = readU16LE(bytes, 6);
    const height = readU16LE(bytes, 8);
    const packed = readU8(bytes, 10);
    const hasGCT = (packed & 0x80) !== 0;
    const colorRes = ((packed >> 4) & 0x07) + 1;
    const gctSize = hasGCT ? (1 << ((packed & 0x07) + 1)) : 0;

    fields.push({ key: 'gif.version', label: 'Version', value: version });
    fields.push({ key: 'gif.width', label: 'Width', value: width + ' px', raw: width });
    fields.push({ key: 'gif.height', label: 'Height', value: height + ' px', raw: height });
    fields.push({ key: 'gif.colorDepth', label: 'Color Depth', value: colorRes + ' bits' });
    if (hasGCT) fields.push({ key: 'gif.gctSize', label: 'Global Color Table', value: gctSize + ' colors' });

    let frameCount = 0;
    let pos = 13 + (hasGCT ? gctSize * 3 : 0);
    while (pos < bytes.length) {
      const block = readU8(bytes, pos);
      if (block === 0x3B) break;
      if (block === 0x2C) { ++frameCount; pos += 10; const lctPacked = readU8(bytes, pos - 1); if (lctPacked & 0x80) pos += (1 << ((lctPacked & 0x07) + 1)) * 3; pos += 1; while (pos < bytes.length) { const sz = readU8(bytes, pos); ++pos; if (sz === 0) break; pos += sz; } continue; }
      if (block === 0x21) { pos += 2; while (pos < bytes.length) { const sz = readU8(bytes, pos); ++pos; if (sz === 0) break; pos += sz; } continue; }
      break;
    }
    if (frameCount > 1) fields.push({ key: 'gif.frames', label: 'Frames', value: String(frameCount) + ' (animated)' });

    return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };
  }

  // =========================================================================
  // BMP parser
  // =========================================================================

  function parseBMP(bytes) {
    const fields = [];
    if (bytes.length < 26) return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };

    const dataOffset = readU32LE(bytes, 10);
    const dibSize = readU32LE(bytes, 14);
    const width = readI32LE(bytes, 18);
    const height = readI32LE(bytes, 22);

    fields.push({ key: 'bmp.width', label: 'Width', value: Math.abs(width) + ' px', raw: width });
    fields.push({ key: 'bmp.height', label: 'Height', value: Math.abs(height) + ' px', raw: height });
    if (height < 0) fields.push({ key: 'bmp.topDown', label: 'Orientation', value: 'Top-down' });

    if (dibSize >= 40) {
      const bpp = readU16LE(bytes, 28);
      const compression = readU32LE(bytes, 30);
      fields.push({ key: 'bmp.bpp', label: 'Bits Per Pixel', value: String(bpp) });
      const compNames = { 0: 'None', 1: 'RLE8', 2: 'RLE4', 3: 'Bitfields' };
      fields.push({ key: 'bmp.compression', label: 'Compression', value: compNames[compression] || String(compression) });

      if (dibSize >= 40) {
        const xPPM = readI32LE(bytes, 38);
        const yPPM = readI32LE(bytes, 42);
        if (xPPM > 0 && yPPM > 0) {
          const dpiX = Math.round(xPPM / 39.3701);
          const dpiY = Math.round(yPPM / 39.3701);
          fields.push({ key: 'bmp.dpi', label: 'DPI', value: dpiX + ' x ' + dpiY });
        }
      }
    }

    fields.push({ key: 'bmp.dibSize', label: 'DIB Header Size', value: dibSize + ' bytes' });

    return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };
  }

  // =========================================================================
  // ICO parser
  // =========================================================================

  function parseICO(bytes) {
    const fields = [];
    const images = [];
    if (bytes.length < 6) return { categories: [{ name: 'Image', icon: 'image', fields }], images };

    const type = readU16LE(bytes, 2);
    const count = readU16LE(bytes, 4);
    fields.push({ key: 'ico.type', label: 'Type', value: type === 1 ? 'Icon' : type === 2 ? 'Cursor' : String(type) });
    fields.push({ key: 'ico.count', label: 'Images', value: String(count) });

    // Try the shared ICO codec for full BMP decoding and image previews
    const F = window.SZ && SZ.Formats;
    const icoFormat = F && F.find && F.find('ico');
    if (icoFormat && icoFormat.parse) {
      try {
        const doc = icoFormat.parse(bytes);
        if (doc && doc.images) {
          for (let i = 0; i < doc.images.length; ++i) {
            const img = doc.images[i];
            const isPng = img.pngData && img.pngData.length > 0;
            const desc = img.width + '\u00D7' + img.height + ', ' + img.bpp + ' bpp' + (isPng ? ', PNG' : ', BMP');
            fields.push({ key: 'ico.image.' + i, label: 'Image ' + (i + 1), value: desc });

            // Generate preview data URL
            if (isPng) {
              images.push({ label: 'Entry ' + (i + 1) + ' (' + img.width + '\u00D7' + img.height + ')', mimeType: 'image/png', dataUrl: bytesToDataUrl(img.pngData, 'image/png') });
            } else if (img.imageData) {
              const dataUrl = imageDataToDataUrl(img.imageData);
              if (dataUrl)
                images.push({ label: 'Entry ' + (i + 1) + ' (' + img.width + '\u00D7' + img.height + ')', mimeType: 'image/png', dataUrl });
            }
          }
          return { categories: [{ name: 'Image', icon: 'image', fields }], images };
        }
      } catch (_) { /* fall through to basic parsing */ }
    }

    // Fallback: basic header-only parse (no image previews)
    for (let i = 0; i < count && 6 + (i + 1) * 16 <= bytes.length; ++i) {
      const entryBase = 6 + i * 16;
      const w = readU8(bytes, entryBase) || 256;
      const h = readU8(bytes, entryBase + 1) || 256;
      const bpp = readU16LE(bytes, entryBase + 6);
      const size = readU32LE(bytes, entryBase + 8);
      fields.push({ key: 'ico.image.' + i, label: 'Image ' + (i + 1), value: w + 'x' + h + ', ' + bpp + ' bpp, ' + formatSize(size) });
    }

    return { categories: [{ name: 'Image', icon: 'image', fields }], images };
  }

  /** Convert an ImageData object to a data URL via canvas */
  function imageDataToDataUrl(imgData) {
    try {
      const c = document.createElement('canvas');
      c.width = imgData.width;
      c.height = imgData.height;
      const ctx = c.getContext('2d');
      ctx.putImageData(imgData, 0, 0);
      return c.toDataURL('image/png');
    } catch (_) {
      return null;
    }
  }

  // =========================================================================
  // PSD parser
  // =========================================================================

  function parsePSD(bytes) {
    const fields = [];
    if (bytes.length < 26) return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };

    const version = readU16BE(bytes, 4);
    const channels = readU16BE(bytes, 12);
    const height = readU32BE(bytes, 14);
    const width = readU32BE(bytes, 18);
    const depth = readU16BE(bytes, 22);
    const colorMode = readU16BE(bytes, 24);

    fields.push({ key: 'psd.version', label: 'PSD Version', value: version === 1 ? 'PSD' : version === 2 ? 'PSB (Large)' : String(version) });
    fields.push({ key: 'psd.width', label: 'Width', value: width + ' px', raw: width });
    fields.push({ key: 'psd.height', label: 'Height', value: height + ' px', raw: height });
    fields.push({ key: 'psd.channels', label: 'Channels', value: String(channels) });
    fields.push({ key: 'psd.depth', label: 'Bit Depth', value: String(depth) });
    const modeNames = { 0: 'Bitmap', 1: 'Grayscale', 2: 'Indexed', 3: 'RGB', 4: 'CMYK', 7: 'Multichannel', 8: 'Duotone', 9: 'Lab' };
    fields.push({ key: 'psd.colorMode', label: 'Color Mode', value: modeNames[colorMode] || String(colorMode) });

    return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };
  }

  // =========================================================================
  // WebP parser
  // =========================================================================

  function parseWebP(bytes) {
    const fields = [];
    if (bytes.length < 20) return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };

    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const chunkId = readString(bytes, pos, 4);
      const chunkSize = readU32LE(bytes, pos + 4);
      const chunkData = pos + 8;

      if (chunkId === 'VP8 ' && chunkSize >= 10) {
        const w = readU16LE(bytes, chunkData + 6) & 0x3FFF;
        const h = readU16LE(bytes, chunkData + 8) & 0x3FFF;
        fields.push({ key: 'webp.format', label: 'Format', value: 'VP8 (Lossy)' });
        fields.push({ key: 'webp.width', label: 'Width', value: w + ' px', raw: w });
        fields.push({ key: 'webp.height', label: 'Height', value: h + ' px', raw: h });
      }

      if (chunkId === 'VP8L' && chunkSize >= 5) {
        const b0 = readU8(bytes, chunkData + 1);
        const b1 = readU8(bytes, chunkData + 2);
        const b2 = readU8(bytes, chunkData + 3);
        const b3 = readU8(bytes, chunkData + 4);
        const w = (b0 | ((b1 & 0x3F) << 8)) + 1;
        const h = (((b1 >> 6) | (b2 << 2) | ((b3 & 0x0F) << 10))) + 1;
        fields.push({ key: 'webp.format', label: 'Format', value: 'VP8L (Lossless)' });
        fields.push({ key: 'webp.width', label: 'Width', value: w + ' px', raw: w });
        fields.push({ key: 'webp.height', label: 'Height', value: h + ' px', raw: h });
      }

      if (chunkId === 'VP8X' && chunkSize >= 10) {
        const flags = readU8(bytes, chunkData);
        const w = (readU16LE(bytes, chunkData + 4) | (readU8(bytes, chunkData + 6) << 16)) + 1;
        const h = (readU16LE(bytes, chunkData + 7) | (readU8(bytes, chunkData + 9) << 16)) + 1;
        fields.push({ key: 'webp.format', label: 'Format', value: 'VP8X (Extended)' });
        fields.push({ key: 'webp.width', label: 'Width', value: w + ' px', raw: w });
        fields.push({ key: 'webp.height', label: 'Height', value: h + ' px', raw: h });
        if (flags & 0x10) fields.push({ key: 'webp.alpha', label: 'Alpha', value: 'Yes' });
        if (flags & 0x02) fields.push({ key: 'webp.anim', label: 'Animated', value: 'Yes' });
      }

      pos = chunkData + chunkSize + (chunkSize & 1);
    }

    return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };
  }

  // =========================================================================
  // TIFF parser
  // =========================================================================

  function parseTIFF(bytes) {
    const fields = [];
    if (bytes.length < 8) return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };

    const le = bytes[0] === 0x49;
    const readU16 = le ? readU16LE : readU16BE;
    const readU32 = le ? readU32LE : readU32BE;

    fields.push({ key: 'tiff.byteOrder', label: 'Byte Order', value: le ? 'Little-endian' : 'Big-endian' });

    const ifdOffset = readU32(bytes, 4);
    if (ifdOffset + 2 > bytes.length) return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };

    const entryCount = readU16(bytes, ifdOffset);
    for (let i = 0; i < entryCount && ifdOffset + 2 + (i + 1) * 12 <= bytes.length; ++i) {
      const base = ifdOffset + 2 + i * 12;
      const tag = readU16(bytes, base);
      const type = readU16(bytes, base + 2);

      if (tag === 0x0100) fields.push({ key: 'tiff.width', label: 'Width', value: (type === 3 ? readU16(bytes, base + 8) : readU32(bytes, base + 8)) + ' px' });
      if (tag === 0x0101) fields.push({ key: 'tiff.height', label: 'Height', value: (type === 3 ? readU16(bytes, base + 8) : readU32(bytes, base + 8)) + ' px' });
      if (tag === 0x0102) fields.push({ key: 'tiff.bitsPerSample', label: 'Bits Per Sample', value: String(readU16(bytes, base + 8)) });
      if (tag === 0x0103) {
        const comp = readU16(bytes, base + 8);
        const compNames = { 1: 'Uncompressed', 2: 'CCITT Group 3', 5: 'LZW', 6: 'Old JPEG', 7: 'JPEG', 8: 'Deflate', 32773: 'PackBits' };
        fields.push({ key: 'tiff.compression', label: 'Compression', value: compNames[comp] || String(comp) });
      }
      if (tag === 0x0106) {
        const pi = readU16(bytes, base + 8);
        const piNames = { 0: 'White is Zero', 1: 'Black is Zero', 2: 'RGB', 3: 'Palette', 5: 'CMYK', 6: 'YCbCr' };
        fields.push({ key: 'tiff.photometric', label: 'Photometric', value: piNames[pi] || String(pi) });
      }
    }

    return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };
  }

  // Register all image parsers
  P.registerParsers({
    jpeg: parseJPEG, png: parsePNG, gif: parseGIF, bmp: parseBMP,
    ico: parseICO, psd: parsePSD, webp: parseWebP, tiff: parseTIFF,
  });

})();
