;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  // =========================================================================
  // CRC32 — table-based implementation for PNG chunk writing
  // =========================================================================

  const CRC32_TABLE = new Uint32Array(256);
  for (let i = 0; i < 256; ++i) {
    let c = i;
    for (let j = 0; j < 8; ++j)
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    CRC32_TABLE[i] = c;
  }

  function crc32(bytes, start, length) {
    let crc = 0xFFFFFFFF;
    for (let i = start; i < start + length; ++i)
      crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // =========================================================================
  // Utility
  // =========================================================================

  function writeU32BE(arr, offset, value) {
    arr[offset]     = (value >>> 24) & 0xFF;
    arr[offset + 1] = (value >>> 16) & 0xFF;
    arr[offset + 2] = (value >>> 8) & 0xFF;
    arr[offset + 3] = value & 0xFF;
  }

  function writeU16BE(arr, offset, value) {
    arr[offset]     = (value >>> 8) & 0xFF;
    arr[offset + 1] = value & 0xFF;
  }

  function readU32BE(bytes, offset) {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  }

  function readString(bytes, offset, length) {
    let s = '';
    for (let i = 0; i < length && offset + i < bytes.length; ++i) {
      const c = bytes[offset + i];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  function stringToBytes(str) {
    const bytes = [];
    for (let i = 0; i < str.length; ++i)
      bytes.push(str.charCodeAt(i) & 0xFF);
    return bytes;
  }

  function utf8ToBytes(str) {
    return Array.from(new TextEncoder().encode(str));
  }

  // =========================================================================
  // Editable format detection
  // =========================================================================

  function isEditable(fileTypeId) {
    return fileTypeId === 'mp3' || fileTypeId === 'png' || fileTypeId === 'jpeg'
      || fileTypeId === 'mp4'
      || fileTypeId === 'docx' || fileTypeId === 'xlsx' || fileTypeId === 'pptx' || fileTypeId === 'ooxml';
  }

  // =========================================================================
  // ID3v2 tag writer
  // =========================================================================

  function rebuildID3v2(originalBytes, modifications) {
    // Find where audio data starts (after existing ID3v2 tag)
    let audioStart = 0;
    if (originalBytes.length >= 10 &&
        originalBytes[0] === 0x49 && originalBytes[1] === 0x44 && originalBytes[2] === 0x33) {
      const size = ((originalBytes[6] & 0x7F) << 21) | ((originalBytes[7] & 0x7F) << 14) |
                   ((originalBytes[8] & 0x7F) << 7) | (originalBytes[9] & 0x7F);
      audioStart = 10 + size;
    }

    // Parse existing ID3v2 frames
    const existingFrames = new Map();
    if (audioStart > 10) {
      let pos = 10;
      const version = originalBytes[3];
      const headerSize = version >= 3 ? 10 : 6;
      while (pos + headerSize < audioStart) {
        let frameId, frameSize;
        if (version >= 3) {
          frameId = readString(originalBytes, pos, 4);
          if (frameId[0] === '\0' || !/^[A-Z0-9]{4}$/.test(frameId)) break;
          if (version >= 4)
            frameSize = ((originalBytes[pos + 4] & 0x7F) << 21) | ((originalBytes[pos + 5] & 0x7F) << 14) |
                        ((originalBytes[pos + 6] & 0x7F) << 7) | (originalBytes[pos + 7] & 0x7F);
          else
            frameSize = readU32BE(originalBytes, pos + 4);
          existingFrames.set(frameId, originalBytes.slice(pos, pos + 10 + frameSize));
          pos += 10 + frameSize;
        } else {
          frameId = readString(originalBytes, pos, 3);
          if (frameId[0] === '\0' || !/^[A-Z0-9]{3}$/.test(frameId)) break;
          frameSize = (originalBytes[pos + 3] << 16) | (originalBytes[pos + 4] << 8) | originalBytes[pos + 5];
          existingFrames.set(frameId, originalBytes.slice(pos, pos + 6 + frameSize));
          pos += 6 + frameSize;
        }
        if (frameSize <= 0) break;
      }
    }

    // Apply modifications
    const frameIdMap = {
      'id3.TIT2': 'TIT2', 'id3.TPE1': 'TPE1', 'id3.TALB': 'TALB',
      'id3.TYER': 'TYER', 'id3.TDRC': 'TDRC', 'id3.TCON': 'TCON',
      'id3.TRCK': 'TRCK', 'id3.COMM': 'COMM', 'id3.TCOM': 'TCOM',
      'id3.TPE2': 'TPE2', 'id3.TPOS': 'TPOS',
      'id3.TIT1': 'TIT1', 'id3.TIT3': 'TIT3', 'id3.TPE3': 'TPE3', 'id3.TPE4': 'TPE4',
      'id3.TBPM': 'TBPM', 'id3.TCOP': 'TCOP', 'id3.TENC': 'TENC', 'id3.TPUB': 'TPUB',
      'id3.TKEY': 'TKEY', 'id3.TLAN': 'TLAN', 'id3.TOAL': 'TOAL', 'id3.TOPE': 'TOPE',
      'id3.TORY': 'TORY', 'id3.TDOR': 'TDOR', 'id3.TSRC': 'TSRC', 'id3.TSSE': 'TSSE',
      'id3.TSOP': 'TSOP', 'id3.TSOA': 'TSOA', 'id3.TSOT': 'TSOT',
      'id3.TCMP': 'TCMP', 'id3.TEXT': 'TEXT', 'id3.TMOO': 'TMOO',
    };

    for (const [key, value] of modifications) {
      if (value === null) {
        // Remove the frame
        const frameId = frameIdMap[key];
        if (frameId) existingFrames.delete(frameId);
        continue;
      }

      // Handle TXXX user-defined text frames
      if (key.startsWith('id3.TXXX.')) {
        const desc = key.substring(9);
        const descBytes = utf8ToBytes(desc);
        const textBytes = utf8ToBytes(value);
        const payloadLen = 1 + descBytes.length + 1 + textBytes.length;
        const frameData = new Uint8Array(10 + payloadLen);
        for (let i = 0; i < 4; ++i) frameData[i] = 'TXXX'.charCodeAt(i);
        writeU32BE(frameData, 4, payloadLen);
        frameData[10] = 3; // UTF-8
        frameData.set(new Uint8Array(descBytes), 11);
        frameData[11 + descBytes.length] = 0; // null separator
        frameData.set(new Uint8Array(textBytes), 12 + descBytes.length);
        // Use desc as key to avoid collision
        existingFrames.set('TXXX:' + desc, frameData);
        continue;
      }

      const frameId = frameIdMap[key];
      if (!frameId) continue;

      if (frameId === 'COMM') {
        // Comment frame: encoding(1) + language(3) + description(null-term) + text
        const textBytes = utf8ToBytes(value);
        const payloadLen = 1 + 3 + 1 + textBytes.length; // enc + lang("eng") + null desc + text
        const frameData = new Uint8Array(10 + payloadLen);
        for (let i = 0; i < 4; ++i) frameData[i] = 'COMM'.charCodeAt(i);
        writeU32BE(frameData, 4, payloadLen);
        frameData[10] = 3; // UTF-8
        frameData[11] = 0x65; frameData[12] = 0x6E; frameData[13] = 0x67; // "eng"
        frameData[14] = 0; // empty description
        frameData.set(new Uint8Array(textBytes), 15);
        existingFrames.set(frameId, frameData);
        continue;
      }

      if (frameId === 'USLT') {
        // Lyrics frame: encoding(1) + language(3) + description(null-term) + lyrics
        const textBytes = utf8ToBytes(value);
        const payloadLen = 1 + 3 + 1 + textBytes.length;
        const frameData = new Uint8Array(10 + payloadLen);
        for (let i = 0; i < 4; ++i) frameData[i] = 'USLT'.charCodeAt(i);
        writeU32BE(frameData, 4, payloadLen);
        frameData[10] = 3;
        frameData[11] = 0x65; frameData[12] = 0x6E; frameData[13] = 0x67;
        frameData[14] = 0;
        frameData.set(new Uint8Array(textBytes), 15);
        existingFrames.set('USLT', frameData);
        continue;
      }

      // Build a new UTF-8 text frame
      const textBytes = utf8ToBytes(value);
      const frameData = new Uint8Array(10 + 1 + textBytes.length);
      // Frame ID
      for (let i = 0; i < 4; ++i)
        frameData[i] = frameId.charCodeAt(i);
      // Frame size (non-syncsafe for v2.3 compatibility)
      writeU32BE(frameData, 4, 1 + textBytes.length);
      // Flags: 0, 0
      // Encoding: 3 = UTF-8
      frameData[10] = 3;
      frameData.set(textBytes, 11);
      existingFrames.set(frameId, frameData);
    }

    // Rebuild tag
    const frames = [];
    for (const frameBytes of existingFrames.values())
      frames.push(frameBytes);

    let totalFrameSize = 0;
    for (const f of frames) totalFrameSize += f.length;

    // Syncsafe size encoding
    const tagSize = totalFrameSize;
    const header = new Uint8Array(10);
    header[0] = 0x49; header[1] = 0x44; header[2] = 0x33; // "ID3"
    header[3] = 3; header[4] = 0; // v2.3
    header[5] = 0; // no flags
    header[6] = (tagSize >> 21) & 0x7F;
    header[7] = (tagSize >> 14) & 0x7F;
    header[8] = (tagSize >> 7) & 0x7F;
    header[9] = tagSize & 0x7F;

    // Assemble
    const audioData = originalBytes.slice(audioStart);
    const result = new Uint8Array(10 + totalFrameSize + audioData.length);
    result.set(header, 0);
    let writePos = 10;
    for (const f of frames) {
      result.set(f, writePos);
      writePos += f.length;
    }
    result.set(audioData, writePos);

    return result;
  }

  // =========================================================================
  // ID3v1 writer
  // =========================================================================

  function rebuildID3v1(originalBytes, modifications) {
    const result = new Uint8Array(originalBytes);
    const hasV1 = originalBytes.length >= 128 &&
      originalBytes[originalBytes.length - 128] === 0x54 &&
      originalBytes[originalBytes.length - 127] === 0x41 &&
      originalBytes[originalBytes.length - 126] === 0x47;

    const tagStart = hasV1 ? originalBytes.length - 128 : originalBytes.length;
    const tag = new Uint8Array(128);
    if (hasV1) tag.set(originalBytes.slice(tagStart, tagStart + 128));
    else { tag[0] = 0x54; tag[1] = 0x41; tag[2] = 0x47; }

    const fieldMap = {
      'id3v1.title':   { offset: 3,  length: 30 },
      'id3v1.artist':  { offset: 33, length: 30 },
      'id3v1.album':   { offset: 63, length: 30 },
      'id3v1.year':    { offset: 93, length: 4 },
      'id3v1.comment': { offset: 97, length: 30 },
    };

    for (const [key, value] of modifications) {
      const field = fieldMap[key];
      if (!field) continue;
      const valueBytes = stringToBytes(value);
      for (let i = 0; i < field.length; ++i)
        tag[field.offset + i] = i < valueBytes.length ? valueBytes[i] : 0;
    }

    if (hasV1) {
      const out = new Uint8Array(originalBytes);
      out.set(tag, tagStart);
      return out;
    }
    const out = new Uint8Array(originalBytes.length + 128);
    out.set(originalBytes, 0);
    out.set(tag, originalBytes.length);
    return out;
  }

  // =========================================================================
  // PNG chunk writer
  // =========================================================================

  function rebuildPNG(originalBytes, modifications) {
    const chunks = [];
    let offset = 8; // skip PNG signature

    while (offset + 8 <= originalBytes.length) {
      const chunkLen = readU32BE(originalBytes, offset);
      const chunkType = readString(originalBytes, offset + 4, 4);
      const chunkEnd = offset + 12 + chunkLen;
      if (chunkEnd > originalBytes.length) break;

      // For tEXt/iTXt chunks, check if they're being modified or removed
      let replaced = false;
      if (chunkType === 'tEXt') {
        const rawText = readString(originalBytes, offset + 8, chunkLen);
        const sepIdx = rawText.indexOf('\0');
        if (sepIdx >= 0) {
          const key = rawText.substring(0, sepIdx);
          const modKey = 'png.text.' + key;
          if (modifications.has(modKey)) {
            const newValue = modifications.get(modKey);
            if (newValue === null) {
              // Remove: skip this chunk entirely
              replaced = true;
            } else {
              const chunkBody = stringToBytes(key + '\0' + newValue);
              chunks.push(buildPNGChunk('tEXt', new Uint8Array(chunkBody)));
              replaced = true;
            }
            modifications.delete(modKey);
          }
        }
      }

      if (chunkType === 'iTXt') {
        const rawText = readString(originalBytes, offset + 8, chunkLen);
        const sepIdx = rawText.indexOf('\0');
        if (sepIdx >= 0) {
          const key = rawText.substring(0, sepIdx);
          const modKey = 'png.itext.' + key;
          if (modifications.has(modKey)) {
            const newValue = modifications.get(modKey);
            if (newValue === null) {
              // Remove: skip this chunk entirely
              replaced = true;
            } else {
              const chunkBody = utf8ToBytes(key + '\0\0\0\0\0' + newValue);
              chunks.push(buildPNGChunk('iTXt', new Uint8Array(chunkBody)));
              replaced = true;
            }
            modifications.delete(modKey);
          }
        }
      }

      if (!replaced) {
        // Insert new tEXt chunks before IEND
        if (chunkType === 'IEND') {
          for (const [modKey, value] of modifications) {
            if (value === null) continue; // removal marker — nothing to add
            if (!modKey.startsWith('png.text.') && !modKey.startsWith('png.itext.')) continue;
            const prefix = modKey.startsWith('png.text.') ? 'png.text.' : 'png.itext.';
            const key = modKey.substring(prefix.length);
            if (prefix === 'png.text.') {
              const chunkBody = stringToBytes(key + '\0' + value);
              chunks.push(buildPNGChunk('tEXt', new Uint8Array(chunkBody)));
            } else {
              const chunkBody = utf8ToBytes(key + '\0\0\0\0\0' + value);
              chunks.push(buildPNGChunk('iTXt', new Uint8Array(chunkBody)));
            }
          }
        }
        chunks.push(originalBytes.slice(offset, chunkEnd));
      }

      offset = chunkEnd;
    }

    // Assemble
    let totalSize = 8; // PNG signature
    for (const c of chunks) totalSize += c.length;
    const result = new Uint8Array(totalSize);
    result.set(originalBytes.slice(0, 8), 0); // PNG signature
    let writePos = 8;
    for (const c of chunks) {
      result.set(c, writePos);
      writePos += c.length;
    }
    return result;
  }

  function buildPNGChunk(type, data) {
    const chunk = new Uint8Array(12 + data.length);
    writeU32BE(chunk, 0, data.length);
    for (let i = 0; i < 4; ++i) chunk[4 + i] = type.charCodeAt(i);
    chunk.set(data, 8);
    // CRC over type + data
    const crcData = new Uint8Array(4 + data.length);
    for (let i = 0; i < 4; ++i) crcData[i] = type.charCodeAt(i);
    crcData.set(data, 4);
    writeU32BE(chunk, 8 + data.length, crc32(crcData, 0, crcData.length));
    return chunk;
  }

  // =========================================================================
  // JPEG EXIF writer — full IFD rebuild engine
  // =========================================================================

  function readU16LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function readU32LE(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function readU16BE_local(bytes, offset) {
    return (bytes[offset] << 8) | bytes[offset + 1];
  }

  function writeU16LE(arr, offset, value) {
    arr[offset] = value & 0xFF;
    arr[offset + 1] = (value >> 8) & 0xFF;
  }

  function writeU32LE(arr, offset, value) {
    arr[offset] = value & 0xFF;
    arr[offset + 1] = (value >> 8) & 0xFF;
    arr[offset + 2] = (value >> 16) & 0xFF;
    arr[offset + 3] = (value >> 24) & 0xFF;
  }

  function writeU16BE_local(arr, offset, value) {
    arr[offset] = (value >> 8) & 0xFF;
    arr[offset + 1] = value & 0xFF;
  }

  function writeU32BE_local(arr, offset, value) {
    arr[offset] = (value >> 24) & 0xFF;
    arr[offset + 1] = (value >> 16) & 0xFF;
    arr[offset + 2] = (value >> 8) & 0xFF;
    arr[offset + 3] = value & 0xFF;
  }

  // RATIONAL helpers
  function decimalToDmsRationals(decimalDeg) {
    const abs = Math.abs(decimalDeg);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    const secScaled = Math.round(sec * 10000);
    return [
      { num: deg, den: 1 },
      { num: min, den: 1 },
      { num: secScaled, den: 10000 },
    ];
  }

  function rationalToBytes(rationals, wU32Fn, le) {
    const buf = new Uint8Array(rationals.length * 8);
    for (let i = 0; i < rationals.length; ++i) {
      wU32Fn(buf, i * 8, rationals[i].num >>> 0);
      wU32Fn(buf, i * 8 + 4, rationals[i].den >>> 0);
    }
    return buf;
  }

  // EXIF type sizes
  const TYPE_SIZES = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

  // Known EXIF tag types for creating new entries
  const TAG_TYPE_MAP = {
    // IFD0 tags
    0x010E: 2,   // ImageDescription — ASCII
    0x010F: 2,   // Make
    0x0110: 2,   // Model
    0x0112: 3,   // Orientation — SHORT
    0x0131: 2,   // Software
    0x0132: 2,   // DateTime
    0x013B: 2,   // Artist
    0x8298: 2,   // Copyright
    // ExifSubIFD tags
    0x9003: 2,   // DateTimeOriginal
    0x9004: 2,   // DateTimeDigitized
    // Pointers
    0x8769: 4,   // ExifIFD pointer — LONG
    0x8825: 4,   // GPSIFD pointer — LONG
    // GPS tags
    0x0000: 1,   // GPSVersionID — BYTE
    0x0001: 2,   // GPSLatitudeRef — ASCII
    0x0002: 5,   // GPSLatitude — RATIONAL
    0x0003: 2,   // GPSLongitudeRef
    0x0004: 5,   // GPSLongitude
    0x0005: 1,   // GPSAltitudeRef — BYTE
    0x0006: 5,   // GPSAltitude — RATIONAL
    0x0010: 2,   // GPSImgDirectionRef — ASCII
    0x0011: 5,   // GPSImgDirection — RATIONAL
  };

  // IFD0 tags vs ExifSubIFD tags
  const IFD0_TAGS = new Set([0x010E, 0x010F, 0x0110, 0x0112, 0x0131, 0x0132, 0x013B, 0x8298, 0x8769, 0x8825]);
  const EXIF_SUB_TAGS = new Set([0x9003, 0x9004]);

  // Parse one IFD into an array of entry objects
  function parseIFDEntries(tiff, ifdOffset, rU16, rU32) {
    const entries = [];
    if (ifdOffset + 2 > tiff.length) return { entries, nextIFD: 0 };
    const count = rU16(tiff, ifdOffset);
    for (let i = 0; i < count; ++i) {
      const eb = ifdOffset + 2 + i * 12;
      if (eb + 12 > tiff.length) break;
      const tag = rU16(tiff, eb);
      const type = rU16(tiff, eb + 2);
      const cnt = rU32(tiff, eb + 4);
      const typeSize = TYPE_SIZES[type] || 1;
      const totalSize = cnt * typeSize;
      let valueBytes;
      if (totalSize <= 4) {
        valueBytes = new Uint8Array(4);
        for (let j = 0; j < 4; ++j) valueBytes[j] = tiff[eb + 8 + j];
      } else {
        const off = rU32(tiff, eb + 8);
        if (off + totalSize <= tiff.length)
          valueBytes = tiff.slice(off, off + totalSize);
        else
          valueBytes = new Uint8Array(totalSize);
      }
      entries.push({ tag, type, count: cnt, valueBytes });
    }
    const nextOff = ifdOffset + 2 + count * 12;
    const nextIFD = nextOff + 4 <= tiff.length ? rU32(tiff, nextOff) : 0;
    return { entries, nextIFD };
  }

  // Serialize an IFD entry array back to bytes
  function serializeIFD(entries, dataStartOffset, wU16, wU32) {
    // Sort by tag (EXIF spec)
    entries.sort((a, b) => a.tag - b.tag);
    const count = entries.length;
    const ifdSize = 2 + count * 12 + 4; // count + entries + nextIFD pointer
    const ifdBuf = new Uint8Array(ifdSize);
    wU16(ifdBuf, 0, count);

    const dataChunks = [];
    let dataOffset = dataStartOffset + ifdSize;

    for (let i = 0; i < count; ++i) {
      const e = entries[i];
      const eb = 2 + i * 12;
      wU16(ifdBuf, eb, e.tag);
      wU16(ifdBuf, eb + 2, e.type);
      wU32(ifdBuf, eb + 4, e.count);

      const totalSize = e.valueBytes.length;
      if (totalSize <= 4) {
        for (let j = 0; j < Math.min(totalSize, 4); ++j)
          ifdBuf[eb + 8 + j] = e.valueBytes[j];
      } else {
        wU32(ifdBuf, eb + 8, dataOffset);
        dataChunks.push(e.valueBytes);
        dataOffset += totalSize;
        if (totalSize & 1) {
          dataChunks.push(new Uint8Array([0])); // word-align
          ++dataOffset;
        }
      }
    }

    return { ifdBuf, dataChunks, nextPtrOffset: 2 + count * 12, totalDataEnd: dataOffset };
  }

  // Create value bytes for a tag
  function makeValueBytes(type, value, wU16, wU32) {
    if (type === 2) {
      // ASCII
      const str = String(value) + '\0';
      const b = new Uint8Array(str.length);
      for (let i = 0; i < str.length; ++i) b[i] = str.charCodeAt(i) & 0xFF;
      return { valueBytes: b, count: str.length };
    }
    if (type === 3) {
      // SHORT
      const b = new Uint8Array(2);
      wU16(b, 0, parseInt(value) & 0xFFFF);
      return { valueBytes: b, count: 1 };
    }
    if (type === 4) {
      // LONG
      const b = new Uint8Array(4);
      wU32(b, 0, parseInt(value) >>> 0);
      return { valueBytes: b, count: 1 };
    }
    if (type === 5) {
      // RATIONAL — value should be an array of {num, den}
      if (Array.isArray(value)) {
        const b = new Uint8Array(value.length * 8);
        for (let i = 0; i < value.length; ++i) {
          wU32(b, i * 8, value[i].num >>> 0);
          wU32(b, i * 8 + 4, value[i].den >>> 0);
        }
        return { valueBytes: b, count: value.length };
      }
      // Single rational
      const num = Math.round(parseFloat(value) * 10000);
      const b = new Uint8Array(8);
      wU32(b, 0, num >>> 0);
      wU32(b, 4, 10000);
      return { valueBytes: b, count: 1 };
    }
    if (type === 1) {
      // BYTE
      if (Array.isArray(value)) {
        const b = new Uint8Array(value.length);
        for (let i = 0; i < value.length; ++i) b[i] = value[i] & 0xFF;
        return { valueBytes: b, count: value.length };
      }
      const b = new Uint8Array([parseInt(value) & 0xFF]);
      return { valueBytes: b, count: 1 };
    }
    // Fallback: ASCII
    const str = String(value) + '\0';
    const b = new Uint8Array(str.length);
    for (let i = 0; i < str.length; ++i) b[i] = str.charCodeAt(i) & 0xFF;
    return { valueBytes: b, count: str.length };
  }

  function rebuildJPEG(originalBytes, exifMods, gpsMods) {
    // Find APP1 EXIF segment
    let app1Start = -1, app1SegLen = 0, tiffStart = -1;
    let offset = 2;
    while (offset < originalBytes.length - 1) {
      if (originalBytes[offset] !== 0xFF) break;
      const marker = originalBytes[offset + 1];
      offset += 2;
      if (marker === 0xD9) break;
      if (marker === 0x00 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) continue;
      if (offset + 2 > originalBytes.length) break;
      const segLen = readU16BE_local(originalBytes, offset);
      if (marker === 0xE1 && segLen >= 8) {
        const hdr = readString(originalBytes, offset + 2, 6);
        if (hdr.startsWith('Exif') && originalBytes[offset + 6] === 0 && originalBytes[offset + 7] === 0) {
          app1Start = offset - 2;
          app1SegLen = segLen;
          tiffStart = offset + 2 + 6;
          break;
        }
      }
      offset += segLen;
    }

    const hasExistingApp1 = app1Start >= 0;
    let tiff, le, rU16, rU32, wU16, wU32;
    let ifd0Entries = [], subIfdEntries = [], gpsIfdEntries = [], ifd1Entries = [];
    let thumbnailData = null;

    if (hasExistingApp1) {
      const app1End = app1Start + 2 + app1SegLen;
      const origTiffLen = app1End - tiffStart;
      tiff = originalBytes.slice(tiffStart, app1End);
      le = tiff[0] === 0x49;
      rU16 = le ? readU16LE : readU16BE_local;
      rU32 = le ? readU32LE : readU32BE;
      wU16 = le ? writeU16LE : writeU16BE_local;
      wU32 = le ? writeU32LE : writeU32BE_local;

      const ifd0Off = rU32(tiff, 4);
      const ifd0Result = parseIFDEntries(tiff, ifd0Off, rU16, rU32);
      ifd0Entries = ifd0Result.entries;

      // Parse ExifSubIFD
      const exifPtrEntry = ifd0Entries.find(e => e.tag === 0x8769);
      if (exifPtrEntry) {
        const subOff = rU32(exifPtrEntry.valueBytes, 0);
        if (subOff > 0 && subOff < tiff.length)
          subIfdEntries = parseIFDEntries(tiff, subOff, rU16, rU32).entries;
      }

      // Parse GPSIFD
      const gpsPtrEntry = ifd0Entries.find(e => e.tag === 0x8825);
      if (gpsPtrEntry) {
        const gpsOff = rU32(gpsPtrEntry.valueBytes, 0);
        if (gpsOff > 0 && gpsOff < tiff.length)
          gpsIfdEntries = parseIFDEntries(tiff, gpsOff, rU16, rU32).entries;
      }

      // Parse IFD1 (thumbnail)
      if (ifd0Result.nextIFD > 0 && ifd0Result.nextIFD < tiff.length) {
        const ifd1Result = parseIFDEntries(tiff, ifd0Result.nextIFD, rU16, rU32);
        ifd1Entries = ifd1Result.entries;
        // Extract thumbnail JPEG data
        const thumbOffEntry = ifd1Entries.find(e => e.tag === 0x0201);
        const thumbLenEntry = ifd1Entries.find(e => e.tag === 0x0202);
        if (thumbOffEntry && thumbLenEntry) {
          const thumbOff = rU32(thumbOffEntry.valueBytes, 0);
          const thumbLen = rU32(thumbLenEntry.valueBytes, 0);
          if (thumbOff + thumbLen <= tiff.length)
            thumbnailData = tiff.slice(thumbOff, thumbOff + thumbLen);
        }
      }
    } else {
      // No existing EXIF — create from scratch
      le = false; // big-endian by default
      rU16 = readU16BE_local;
      rU32 = readU32BE;
      wU16 = writeU16BE_local;
      wU32 = writeU32BE_local;
    }

    // Apply exif.* modifications to IFD0 and ExifSubIFD
    for (const [key, value] of exifMods) {
      const tagNum = parseInt(key.substring(5), 16);
      if (isNaN(tagNum)) continue;

      const isIfd0 = IFD0_TAGS.has(tagNum);
      const isSubIfd = EXIF_SUB_TAGS.has(tagNum);
      const targetEntries = isIfd0 ? ifd0Entries : isSubIfd ? subIfdEntries : ifd0Entries;
      const idx = targetEntries.findIndex(e => e.tag === tagNum);

      if (value === null) {
        // Remove entry
        if (idx >= 0) targetEntries.splice(idx, 1);
        continue;
      }

      const type = TAG_TYPE_MAP[tagNum] || (idx >= 0 ? targetEntries[idx].type : 2);
      const { valueBytes, count } = makeValueBytes(type, value, wU16, wU32);

      if (idx >= 0) {
        targetEntries[idx].type = type;
        targetEntries[idx].count = count;
        targetEntries[idx].valueBytes = valueBytes;
      } else
        targetEntries.push({ tag: tagNum, type, count, valueBytes });
    }

    // Apply gps.* modifications
    if (gpsMods.size > 0) {
      const coordVal = gpsMods.get('gps.coordinates');
      if (coordVal) {
        let coords;
        try { coords = JSON.parse(coordVal); } catch (_) { coords = null; }
        if (coords && coords.lat != null && coords.lng != null) {
          const latRat = decimalToDmsRationals(coords.lat);
          const lngRat = decimalToDmsRationals(coords.lng);
          const latRef = coords.lat >= 0 ? 'N' : 'S';
          const lngRef = coords.lng >= 0 ? 'E' : 'W';

          _setGpsEntry(gpsIfdEntries, 0x0000, 1, [2, 3, 0, 0], 4, wU16, wU32); // GPSVersionID
          _setGpsEntry(gpsIfdEntries, 0x0001, 2, latRef, null, wU16, wU32); // LatRef
          _setGpsEntry(gpsIfdEntries, 0x0002, 5, latRat, 3, wU16, wU32); // Lat
          _setGpsEntry(gpsIfdEntries, 0x0003, 2, lngRef, null, wU16, wU32); // LngRef
          _setGpsEntry(gpsIfdEntries, 0x0004, 5, lngRat, 3, wU16, wU32); // Lng

          if (coords.alt != null) {
            const altRef = coords.alt < 0 ? 1 : 0;
            _setGpsEntry(gpsIfdEntries, 0x0005, 1, [altRef], 1, wU16, wU32);
            _setGpsEntry(gpsIfdEntries, 0x0006, 5, [{ num: Math.round(Math.abs(coords.alt) * 1000), den: 1000 }], 1, wU16, wU32);
          }

          if (coords.direction != null) {
            _setGpsEntry(gpsIfdEntries, 0x0010, 2, 'T', null, wU16, wU32);
            _setGpsEntry(gpsIfdEntries, 0x0011, 5, [{ num: Math.round(coords.direction * 100), den: 100 }], 1, wU16, wU32);
          }
        }
      }

      // Standalone altitude modification
      const altVal = gpsMods.get('gps.altitude');
      if (altVal != null && !coordVal) {
        const alt = parseFloat(altVal);
        if (!isNaN(alt)) {
          _setGpsEntry(gpsIfdEntries, 0x0005, 1, [alt < 0 ? 1 : 0], 1, wU16, wU32);
          _setGpsEntry(gpsIfdEntries, 0x0006, 5, [{ num: Math.round(Math.abs(alt) * 1000), den: 1000 }], 1, wU16, wU32);
        }
      }

      // Standalone direction modification
      const dirVal = gpsMods.get('gps.direction');
      if (dirVal != null && !coordVal) {
        const dir = parseFloat(dirVal);
        if (!isNaN(dir)) {
          _setGpsEntry(gpsIfdEntries, 0x0010, 2, 'T', null, wU16, wU32);
          _setGpsEntry(gpsIfdEntries, 0x0011, 5, [{ num: Math.round(dir * 100), den: 100 }], 1, wU16, wU32);
        }
      }

      // GPS Destination
      const destVal = gpsMods.get('gps.destination');
      if (destVal) {
        let dest;
        try { dest = JSON.parse(destVal); } catch (_) { dest = null; }
        if (dest && dest.lat != null && dest.lng != null) {
          const dLatRat = decimalToDmsRationals(dest.lat);
          const dLngRat = decimalToDmsRationals(dest.lng);
          _setGpsEntry(gpsIfdEntries, 0x0013, 2, dest.lat >= 0 ? 'N' : 'S', null, wU16, wU32);
          _setGpsEntry(gpsIfdEntries, 0x0014, 5, dLatRat, 3, wU16, wU32);
          _setGpsEntry(gpsIfdEntries, 0x0015, 2, dest.lng >= 0 ? 'E' : 'W', null, wU16, wU32);
          _setGpsEntry(gpsIfdEntries, 0x0016, 5, dLngRat, 3, wU16, wU32);

          if (dest.bearing != null) {
            _setGpsEntry(gpsIfdEntries, 0x0017, 2, 'T', null, wU16, wU32);
            _setGpsEntry(gpsIfdEntries, 0x0018, 5, [{ num: Math.round(dest.bearing * 100), den: 100 }], 1, wU16, wU32);
          }
          if (dest.distance != null) {
            _setGpsEntry(gpsIfdEntries, 0x0019, 2, 'K', null, wU16, wU32);
            _setGpsEntry(gpsIfdEntries, 0x001A, 5, [{ num: Math.round(dest.distance * 1000), den: 1000 }], 1, wU16, wU32);
          }
        }
      }
    }

    // Ensure ExifSubIFD pointer exists if we have sub-IFD entries
    if (subIfdEntries.length > 0 && !ifd0Entries.some(e => e.tag === 0x8769)) {
      const ptrBytes = new Uint8Array(4);
      ifd0Entries.push({ tag: 0x8769, type: 4, count: 1, valueBytes: ptrBytes });
    }

    // Ensure GPSIFD pointer exists if we have GPS entries
    if (gpsIfdEntries.length > 0 && !ifd0Entries.some(e => e.tag === 0x8825)) {
      const ptrBytes = new Uint8Array(4);
      ifd0Entries.push({ tag: 0x8825, type: 4, count: 1, valueBytes: ptrBytes });
    }

    // Serialize all IFDs
    // Layout: TIFF header (8) -> IFD0 -> ExifSubIFD -> GPSIFD -> IFD1 -> thumbnail data
    let currentOffset = 8; // after TIFF header

    const ifd0Ser = serializeIFD(ifd0Entries, currentOffset, wU16, wU32);
    currentOffset = ifd0Ser.totalDataEnd;

    let subIfdSer = null;
    if (subIfdEntries.length > 0) {
      subIfdSer = serializeIFD(subIfdEntries, currentOffset, wU16, wU32);
      // Fix ExifIFD pointer in IFD0
      const exifPtrIdx = ifd0Entries.findIndex(e => e.tag === 0x8769);
      if (exifPtrIdx >= 0)
        wU32(ifd0Entries[exifPtrIdx].valueBytes, 0, currentOffset);
      currentOffset = subIfdSer.totalDataEnd;
    }

    let gpsSer = null;
    if (gpsIfdEntries.length > 0) {
      gpsSer = serializeIFD(gpsIfdEntries, currentOffset, wU16, wU32);
      // Fix GPSIFD pointer in IFD0
      const gpsPtrIdx = ifd0Entries.findIndex(e => e.tag === 0x8825);
      if (gpsPtrIdx >= 0)
        wU32(ifd0Entries[gpsPtrIdx].valueBytes, 0, currentOffset);
      currentOffset = gpsSer.totalDataEnd;
    }

    let ifd1Ser = null;
    if (ifd1Entries.length > 0 && thumbnailData) {
      ifd1Ser = serializeIFD(ifd1Entries, currentOffset, wU16, wU32);
      // Fix thumbnail offset
      const thumbOffIdx = ifd1Entries.findIndex(e => e.tag === 0x0201);
      if (thumbOffIdx >= 0)
        wU32(ifd1Entries[thumbOffIdx].valueBytes, 0, ifd1Ser.totalDataEnd);
      currentOffset = ifd1Ser.totalDataEnd + thumbnailData.length;
    }

    // Re-serialize IFD0 with correct pointer values (need to redo since pointers changed)
    const ifd0Final = serializeIFD(ifd0Entries, 8, wU16, wU32);

    // Assemble TIFF
    const tiffParts = [];
    // TIFF header
    const tiffHeader = new Uint8Array(8);
    tiffHeader[0] = le ? 0x49 : 0x4D;
    tiffHeader[1] = le ? 0x49 : 0x4D;
    wU16(tiffHeader, 2, 0x002A);
    wU32(tiffHeader, 4, 8); // IFD0 offset
    tiffParts.push(tiffHeader);

    // IFD0
    tiffParts.push(ifd0Final.ifdBuf);
    // Set IFD0 next-IFD pointer
    if (ifd1Ser && ifd1Entries.length > 0) {
      // Recalculate IFD1 start offset
      let ifd1Start = ifd0Final.totalDataEnd;
      if (subIfdSer) ifd1Start = subIfdSer.totalDataEnd;
      if (gpsSer) ifd1Start = gpsSer.totalDataEnd;
      // Re-serialize to get correct offsets...
    }
    for (const chunk of ifd0Final.dataChunks) tiffParts.push(chunk);

    if (subIfdSer) {
      // Re-serialize SubIFD at correct offset
      const subStart = ifd0Final.totalDataEnd;
      const subFinal = serializeIFD(subIfdEntries, subStart, wU16, wU32);
      // Fix ExifIFD pointer
      const exifPtrIdx2 = ifd0Entries.findIndex(e => e.tag === 0x8769);
      if (exifPtrIdx2 >= 0) {
        wU32(ifd0Entries[exifPtrIdx2].valueBytes, 0, subStart);
      }
      tiffParts.push(subFinal.ifdBuf);
      for (const chunk of subFinal.dataChunks) tiffParts.push(chunk);
    }

    if (gpsSer) {
      // Calculate GPS IFD start
      let gpsStart = ifd0Final.totalDataEnd;
      if (subIfdSer) {
        const subFinal = serializeIFD(subIfdEntries, ifd0Final.totalDataEnd, wU16, wU32);
        gpsStart = subFinal.totalDataEnd;
      }
      const gpsFinal = serializeIFD(gpsIfdEntries, gpsStart, wU16, wU32);
      const gpsPtrIdx2 = ifd0Entries.findIndex(e => e.tag === 0x8825);
      if (gpsPtrIdx2 >= 0)
        wU32(ifd0Entries[gpsPtrIdx2].valueBytes, 0, gpsStart);
      tiffParts.push(gpsFinal.ifdBuf);
      for (const chunk of gpsFinal.dataChunks) tiffParts.push(chunk);
    }

    // IFD1 + thumbnail
    let ifd1StartOffset = 0;
    if (ifd1Entries.length > 0 && thumbnailData) {
      // Calculate exact IFD1 position
      let pos = 8;
      for (let i = 1; i < tiffParts.length; ++i) pos += tiffParts[i].length;
      ifd1StartOffset = pos;

      const ifd1Final = serializeIFD(ifd1Entries, pos, wU16, wU32);
      // Fix thumbnail offset to point after IFD1 data
      const thumbOffIdx2 = ifd1Entries.findIndex(e => e.tag === 0x0201);
      if (thumbOffIdx2 >= 0)
        wU32(ifd1Entries[thumbOffIdx2].valueBytes, 0, ifd1Final.totalDataEnd);

      const ifd1Final2 = serializeIFD(ifd1Entries, pos, wU16, wU32);
      tiffParts.push(ifd1Final2.ifdBuf);
      for (const chunk of ifd1Final2.dataChunks) tiffParts.push(chunk);
      tiffParts.push(thumbnailData);
    }

    // Now do a final pass: re-serialize everything with correct offsets
    // Use a simpler two-pass approach: measure then write
    const finalTiff = _assembleTiffFinal(ifd0Entries, subIfdEntries, gpsIfdEntries, ifd1Entries, thumbnailData, le, wU16, wU32);

    // Build new APP1
    const exifHdr = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
    const newDataLen = exifHdr.length + finalTiff.length;
    if (newDataLen + 2 > 65535)
      console.warn('APP1 segment exceeds 64KB limit (' + (newDataLen + 2) + ' bytes)');

    const newApp1 = new Uint8Array(2 + 2 + newDataLen);
    newApp1[0] = 0xFF;
    newApp1[1] = 0xE1;
    writeU16BE(newApp1, 2, Math.min(newDataLen + 2, 65535));
    for (let i = 0; i < 6; ++i) newApp1[4 + i] = exifHdr[i];
    newApp1.set(finalTiff, 10);

    // Reassemble JPEG
    let before, after;
    if (hasExistingApp1) {
      const app1End = app1Start + 2 + app1SegLen;
      before = originalBytes.slice(0, app1Start);
      after = originalBytes.slice(app1End);
    } else {
      // Insert after SOI marker
      before = originalBytes.slice(0, 2);
      after = originalBytes.slice(2);
    }

    const result = new Uint8Array(before.length + newApp1.length + after.length);
    result.set(before, 0);
    result.set(newApp1, before.length);
    result.set(after, before.length + newApp1.length);
    return result;
  }

  function _setGpsEntry(entries, tag, type, value, count, wU16, wU32) {
    const { valueBytes, count: cnt } = makeValueBytes(type, value, wU16, wU32);
    const idx = entries.findIndex(e => e.tag === tag);
    if (idx >= 0) {
      entries[idx].type = type;
      entries[idx].count = count != null ? count : cnt;
      entries[idx].valueBytes = valueBytes;
    } else
      entries.push({ tag, type, count: count != null ? count : cnt, valueBytes });
  }

  // Final TIFF assembly with correct offsets (two-pass)
  function _assembleTiffFinal(ifd0Entries, subIfdEntries, gpsIfdEntries, ifd1Entries, thumbnailData, le, wU16, wU32) {
    // Pass 1: measure sizes
    const headerSize = 8;
    const ifd0Size = _measureIFD(ifd0Entries);
    const subSize = subIfdEntries.length > 0 ? _measureIFD(subIfdEntries) : 0;
    const gpsSize = gpsIfdEntries.length > 0 ? _measureIFD(gpsIfdEntries) : 0;
    const ifd1Size = ifd1Entries.length > 0 ? _measureIFD(ifd1Entries) : 0;
    const thumbSize = thumbnailData ? thumbnailData.length : 0;

    const ifd0Start = headerSize;
    const subStart = ifd0Start + ifd0Size;
    const gpsStart = subStart + subSize;
    const ifd1Start = gpsStart + gpsSize;
    const thumbStart = ifd1Start + ifd1Size;
    const totalSize = thumbStart + thumbSize;

    // Fix pointers
    const exifPtrEntry = ifd0Entries.find(e => e.tag === 0x8769);
    if (exifPtrEntry && subIfdEntries.length > 0)
      wU32(exifPtrEntry.valueBytes, 0, subStart);

    const gpsPtrEntry = ifd0Entries.find(e => e.tag === 0x8825);
    if (gpsPtrEntry && gpsIfdEntries.length > 0)
      wU32(gpsPtrEntry.valueBytes, 0, gpsStart);

    // Fix thumbnail offset
    if (ifd1Entries.length > 0 && thumbnailData) {
      const thumbOffEntry = ifd1Entries.find(e => e.tag === 0x0201);
      if (thumbOffEntry)
        wU32(thumbOffEntry.valueBytes, 0, thumbStart);
      const thumbLenEntry = ifd1Entries.find(e => e.tag === 0x0202);
      if (thumbLenEntry)
        wU32(thumbLenEntry.valueBytes, 0, thumbnailData.length);
    }

    // Pass 2: write
    const buf = new Uint8Array(totalSize);
    // Header
    buf[0] = le ? 0x49 : 0x4D;
    buf[1] = le ? 0x49 : 0x4D;
    wU16(buf, 2, 0x002A);
    wU32(buf, 4, ifd0Start);

    _writeIFD(buf, ifd0Start, ifd0Entries, ifd1Entries.length > 0 ? ifd1Start : 0, wU16, wU32);
    if (subIfdEntries.length > 0)
      _writeIFD(buf, subStart, subIfdEntries, 0, wU16, wU32);
    if (gpsIfdEntries.length > 0)
      _writeIFD(buf, gpsStart, gpsIfdEntries, 0, wU16, wU32);
    if (ifd1Entries.length > 0)
      _writeIFD(buf, ifd1Start, ifd1Entries, 0, wU16, wU32);
    if (thumbnailData)
      buf.set(thumbnailData, thumbStart);

    return buf;
  }

  function _measureIFD(entries) {
    const count = entries.length;
    let size = 2 + count * 12 + 4; // count + entries + nextIFD
    for (const e of entries) {
      if (e.valueBytes.length > 4) {
        size += e.valueBytes.length;
        if (e.valueBytes.length & 1) ++size; // word-align
      }
    }
    return size;
  }

  function _writeIFD(buf, ifdOffset, entries, nextIFDOffset, wU16, wU32) {
    entries.sort((a, b) => a.tag - b.tag);
    const count = entries.length;
    wU16(buf, ifdOffset, count);

    let dataOffset = ifdOffset + 2 + count * 12 + 4;

    for (let i = 0; i < count; ++i) {
      const e = entries[i];
      const eb = ifdOffset + 2 + i * 12;
      wU16(buf, eb, e.tag);
      wU16(buf, eb + 2, e.type);
      wU32(buf, eb + 4, e.count);

      if (e.valueBytes.length <= 4) {
        for (let j = 0; j < 4; ++j)
          buf[eb + 8 + j] = j < e.valueBytes.length ? e.valueBytes[j] : 0;
      } else {
        wU32(buf, eb + 8, dataOffset);
        buf.set(e.valueBytes, dataOffset);
        dataOffset += e.valueBytes.length;
        if (e.valueBytes.length & 1) buf[dataOffset++] = 0;
      }
    }

    wU32(buf, ifdOffset + 2 + count * 12, nextIFDOffset);
  }

  // =========================================================================
  // MP4 ilst writer — modifies iTunes metadata atoms in ISO BMFF container
  // =========================================================================

  // iTunes atom key → 4-byte atom type mapping
  const MP4_KEY_TO_ATOM = {
    'mp4.ilst._nam': '\xA9nam',
    'mp4.ilst._ART': '\xA9ART',
    'mp4.ilst._alb': '\xA9alb',
    'mp4.ilst._day': '\xA9day',
    'mp4.ilst._gen': '\xA9gen',
    'mp4.ilst._cmt': '\xA9cmt',
    'mp4.ilst._wrt': '\xA9wrt',
    'mp4.ilst.aART': 'aART',
    'mp4.ilst._too': '\xA9too',
    'mp4.ilst._grp': '\xA9grp',
    'mp4.ilst.desc': 'desc',
    'mp4.ilst.ldes': 'ldes',
    'mp4.ilst._lyr': '\xA9lyr',
    'mp4.ilst.cprt': 'cprt',
  };

  function buildIlstAtom(atomType, textValue) {
    // Build: [atomSize(4)][atomType(4)] [dataSize(4)]"data"[flags(4)][locale(4)][UTF-8 value]
    const valueBytes = utf8ToBytes(textValue);
    const dataSize = 16 + valueBytes.length; // 8 (header) + 4 (flags) + 4 (locale) + value
    const atomSize = 8 + dataSize;
    const atom = new Uint8Array(atomSize);
    writeU32BE(atom, 0, atomSize);
    for (let i = 0; i < 4; ++i) atom[4 + i] = atomType.charCodeAt(i) & 0xFF;
    writeU32BE(atom, 8, dataSize);
    atom[12] = 0x64; atom[13] = 0x61; atom[14] = 0x74; atom[15] = 0x61; // "data"
    // Flags: 0x00000001 = UTF-8 text
    atom[16] = 0; atom[17] = 0; atom[18] = 0; atom[19] = 1;
    // Locale: 4 zero bytes
    for (let i = 0; i < valueBytes.length; ++i) atom[24 + i] = valueBytes[i];
    return atom;
  }

  function rebuildMP4(originalBytes, modifications) {
    // Convert mod keys to atom type → value map
    const atomMods = new Map();
    for (const [key, value] of modifications) {
      if (value === null) continue;
      const atomType = MP4_KEY_TO_ATOM[key];
      if (atomType) atomMods.set(atomType, value);
    }
    if (atomMods.size === 0) return originalBytes;

    // Locate moov, udta, meta, ilst boxes
    function findBox(bytes, start, end, targetType) {
      let pos = start;
      while (pos + 8 <= end) {
        let size = readU32BE(bytes, pos);
        const type = readString(bytes, pos + 4, 4);
        if (size === 1 && pos + 16 <= end)
          return null; // 64-bit size — skip
        if (size === 0) size = end - pos;
        if (size < 8 || pos + size > end) break;
        if (type === targetType) return { start: pos, end: pos + size, headerSize: 8 };
        pos += size;
      }
      return null;
    }

    // Fix stco/co64 chunk offsets after insertion/size change
    // All absolute offsets pointing past `threshold` must be shifted by `delta`
    function fixChunkOffsets(arr, moovStart, moovEnd, threshold, delta) {
      if (delta === 0) return;
      // Walk moov recursively to find stco and co64 boxes
      function walkForStco(start, end) {
        let pos = start;
        while (pos + 8 <= end) {
          let size = readU32BE(arr, pos);
          const type = readString(arr, pos + 4, 4);
          if (size === 1) return; // skip 64-bit
          if (size === 0) size = end - pos;
          if (size < 8 || pos + size > end) break;
          const boxData = pos + 8;
          const boxEnd = pos + size;

          if (type === 'stco' && boxData + 8 <= boxEnd) {
            const entryCount = readU32BE(arr, boxData + 4);
            for (let i = 0; i < entryCount && boxData + 8 + (i + 1) * 4 <= boxEnd; ++i) {
              const off = boxData + 8 + i * 4;
              const oldVal = readU32BE(arr, off);
              if (oldVal >= threshold)
                writeU32BE(arr, off, oldVal + delta);
            }
          } else if (type === 'co64' && boxData + 8 <= boxEnd) {
            // 64-bit offsets — only adjust low 32 bits if high 32 are 0 (common case)
            const entryCount = readU32BE(arr, boxData + 4);
            for (let i = 0; i < entryCount && boxData + 8 + (i + 1) * 8 <= boxEnd; ++i) {
              const off = boxData + 8 + i * 8;
              const hi = readU32BE(arr, off);
              const lo = readU32BE(arr, off + 4);
              if (hi === 0 && lo >= threshold)
                writeU32BE(arr, off + 4, lo + delta);
              // For offsets > 4GB, a full 64-bit add would be needed (rare)
            }
          }

          if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type))
            walkForStco(boxData, boxEnd);

          pos = boxEnd;
        }
      }
      walkForStco(moovStart + 8, moovEnd);
    }

    const moov = findBox(originalBytes, 0, originalBytes.length, 'moov');
    if (!moov) return originalBytes;

    // Check if mdat comes after moov (need stco fixup)
    const mdat = findBox(originalBytes, 0, originalBytes.length, 'mdat');
    const needsStcoFix = mdat && mdat.start > moov.start;

    let udta = findBox(originalBytes, moov.start + 8, moov.end, 'udta');
    let meta = udta ? findBox(originalBytes, udta.start + 8, udta.end, 'meta') : null;
    // meta is a fullbox (4 extra bytes after header)
    let ilst = meta ? findBox(originalBytes, meta.start + 12, meta.end, 'ilst') : null;

    if (ilst) {
      // Existing ilst — rebuild it: walk existing atoms, replace matching, append new
      const existingAtoms = [];
      const replaced = new Set();
      let iPos = ilst.start + 8;
      while (iPos + 8 <= ilst.end) {
        let iSize = readU32BE(originalBytes, iPos);
        const iType = readString(originalBytes, iPos + 4, 4);
        if (iSize < 8 || iPos + iSize > ilst.end) break;
        if (atomMods.has(iType)) {
          existingAtoms.push(buildIlstAtom(iType, atomMods.get(iType)));
          replaced.add(iType);
        } else
          existingAtoms.push(originalBytes.slice(iPos, iPos + iSize));
        iPos += iSize;
      }
      // Add new atoms
      for (const [atomType, value] of atomMods)
        if (!replaced.has(atomType))
          existingAtoms.push(buildIlstAtom(atomType, value));

      // Calculate new ilst
      let newIlstDataLen = 0;
      for (const a of existingAtoms) newIlstDataLen += a.length;
      const newIlstSize = 8 + newIlstDataLen;
      const newIlst = new Uint8Array(newIlstSize);
      writeU32BE(newIlst, 0, newIlstSize);
      newIlst[4] = 0x69; newIlst[5] = 0x6C; newIlst[6] = 0x73; newIlst[7] = 0x74; // "ilst"
      let wp = 8;
      for (const a of existingAtoms) { newIlst.set(a, wp); wp += a.length; }

      // Replace old ilst in file
      const sizeDiff = newIlst.length - (ilst.end - ilst.start);
      const result = new Uint8Array(originalBytes.length + sizeDiff);
      result.set(originalBytes.slice(0, ilst.start), 0);
      result.set(newIlst, ilst.start);
      result.set(originalBytes.slice(ilst.end), ilst.start + newIlst.length);

      // Update parent box sizes: meta, udta, moov
      function updateBoxSize(arr, boxStart, diff) {
        const oldSize = readU32BE(arr, boxStart);
        writeU32BE(arr, boxStart, oldSize + diff);
      }
      updateBoxSize(result, meta.start, sizeDiff);
      updateBoxSize(result, udta.start, sizeDiff);
      updateBoxSize(result, moov.start, sizeDiff);

      // Fix stco/co64 if mdat comes after moov
      if (needsStcoFix && sizeDiff !== 0) {
        const newMoovEnd = moov.end + sizeDiff;
        fixChunkOffsets(result, moov.start, newMoovEnd, moov.end, sizeDiff);
      }

      return result;
    }

    // No existing ilst — build one and insert into the container chain
    const newAtoms = [];
    for (const [atomType, value] of atomMods)
      newAtoms.push(buildIlstAtom(atomType, value));
    let ilstDataLen = 0;
    for (const a of newAtoms) ilstDataLen += a.length;

    if (meta) {
      // meta exists but no ilst — insert ilst at end of meta content
      const newIlstSize = 8 + ilstDataLen;
      const newIlst = new Uint8Array(newIlstSize);
      writeU32BE(newIlst, 0, newIlstSize);
      newIlst[4] = 0x69; newIlst[5] = 0x6C; newIlst[6] = 0x73; newIlst[7] = 0x74;
      let wp = 8;
      for (const a of newAtoms) { newIlst.set(a, wp); wp += a.length; }

      const insertPos = meta.end;
      const result = new Uint8Array(originalBytes.length + newIlstSize);
      result.set(originalBytes.slice(0, insertPos), 0);
      result.set(newIlst, insertPos);
      result.set(originalBytes.slice(insertPos), insertPos + newIlstSize);

      // Update meta, udta, moov sizes
      writeU32BE(result, meta.start, (meta.end - meta.start) + newIlstSize);
      writeU32BE(result, udta.start, (udta.end - udta.start) + newIlstSize);
      writeU32BE(result, moov.start, (moov.end - moov.start) + newIlstSize);

      if (needsStcoFix) {
        const newMoovEnd = moov.end + newIlstSize;
        fixChunkOffsets(result, moov.start, newMoovEnd, moov.end, newIlstSize);
      }
      return result;
    }

    if (udta) {
      // udta exists but no meta — build meta+ilst and insert at end of udta
      const ilstSize = 8 + ilstDataLen;
      const metaSize = 12 + ilstSize; // 8 (header) + 4 (fullbox flags) + ilst
      const metaBox = new Uint8Array(metaSize);
      writeU32BE(metaBox, 0, metaSize);
      metaBox[4] = 0x6D; metaBox[5] = 0x65; metaBox[6] = 0x74; metaBox[7] = 0x61; // "meta"
      // fullbox version + flags (4 bytes of zero)
      // ilst starts at offset 12
      writeU32BE(metaBox, 12, ilstSize);
      metaBox[16] = 0x69; metaBox[17] = 0x6C; metaBox[18] = 0x73; metaBox[19] = 0x74;
      let wp = 20;
      for (const a of newAtoms) { metaBox.set(a, wp); wp += a.length; }

      const insertPos = udta.end;
      const result = new Uint8Array(originalBytes.length + metaSize);
      result.set(originalBytes.slice(0, insertPos), 0);
      result.set(metaBox, insertPos);
      result.set(originalBytes.slice(insertPos), insertPos + metaSize);

      writeU32BE(result, udta.start, (udta.end - udta.start) + metaSize);
      writeU32BE(result, moov.start, (moov.end - moov.start) + metaSize);

      if (needsStcoFix) {
        const newMoovEnd = moov.end + metaSize;
        fixChunkOffsets(result, moov.start, newMoovEnd, moov.end, metaSize);
      }
      return result;
    }

    // No udta — build udta+meta+ilst and insert at end of moov
    const ilstSize = 8 + ilstDataLen;
    const metaSize = 12 + ilstSize;
    const udtaSize = 8 + metaSize;
    const udtaBox = new Uint8Array(udtaSize);
    writeU32BE(udtaBox, 0, udtaSize);
    udtaBox[4] = 0x75; udtaBox[5] = 0x64; udtaBox[6] = 0x74; udtaBox[7] = 0x61; // "udta"
    writeU32BE(udtaBox, 8, metaSize);
    udtaBox[12] = 0x6D; udtaBox[13] = 0x65; udtaBox[14] = 0x74; udtaBox[15] = 0x61; // "meta"
    // fullbox 4 bytes zero at 16-19
    writeU32BE(udtaBox, 20, ilstSize);
    udtaBox[24] = 0x69; udtaBox[25] = 0x6C; udtaBox[26] = 0x73; udtaBox[27] = 0x74; // "ilst"
    let wp = 28;
    for (const a of newAtoms) { udtaBox.set(a, wp); wp += a.length; }

    const insertPos = moov.end;
    const result = new Uint8Array(originalBytes.length + udtaSize);
    result.set(originalBytes.slice(0, insertPos), 0);
    result.set(udtaBox, insertPos);
    result.set(originalBytes.slice(insertPos), insertPos + udtaSize);

    writeU32BE(result, moov.start, (moov.end - moov.start) + udtaSize);

    if (needsStcoFix) {
      const newMoovEnd = moov.end + udtaSize;
      fixChunkOffsets(result, moov.start, newMoovEnd, moov.end, udtaSize);
    }
    return result;
  }

  // =========================================================================
  // OOXML (Office) writer — modifies docProps/core.xml in ZIP
  // =========================================================================

  function rebuildOOXML(originalBytes, modifications) {
    // Build XML modification map
    const xmlMods = new Map();
    const tagMap = {
      'ooxml.title': { tag: 'dc:title' },
      'ooxml.subject': { tag: 'dc:subject' },
      'ooxml.creator': { tag: 'dc:creator' },
      'ooxml.keywords': { tag: 'cp:keywords' },
      'ooxml.description': { tag: 'dc:description' },
      'ooxml.category': { tag: 'cp:category' },
    };

    for (const [key, value] of modifications) {
      if (value === null) continue;
      const tm = tagMap[key];
      if (tm) xmlMods.set(tm.tag, value);
    }
    if (xmlMods.size === 0) return originalBytes;

    // Walk ZIP local file headers to find docProps/core.xml
    let pos = 0;
    let coreStart = -1, coreDataStart = -1, coreCompSize = -1, coreUncompSize = -1, coreMethod = -1;
    let coreHeaderEnd = -1;

    while (pos + 30 <= originalBytes.length) {
      const sig = readU32LE(originalBytes, pos);
      if (sig !== 0x04034B50) break;
      const method = readU16LE(originalBytes, pos + 8);
      const compSize = readU32LE(originalBytes, pos + 18);
      const nameLen = readU16LE(originalBytes, pos + 26);
      const extraLen = readU16LE(originalBytes, pos + 28);
      const name = readString(originalBytes, pos + 30, nameLen);
      const dataStart = pos + 30 + nameLen + extraLen;

      if (name === 'docProps/core.xml' && method === 0) {
        coreStart = pos;
        coreDataStart = dataStart;
        coreCompSize = compSize;
        coreMethod = method;
        coreHeaderEnd = dataStart;
      }

      pos = dataStart + compSize;
    }

    if (coreStart < 0 || coreMethod !== 0) return originalBytes; // can't edit compressed entries

    // Read original XML
    let xml = '';
    for (let i = 0; i < coreCompSize && coreDataStart + i < originalBytes.length; ++i)
      xml += String.fromCharCode(originalBytes[coreDataStart + i]);

    // Apply modifications via regex replacement
    for (const [tag, value] of xmlMods) {
      const escapedValue = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const rx = new RegExp('(<' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^>]*>)[^<]*(</' + tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '>)', 'i');
      if (rx.test(xml))
        xml = xml.replace(rx, '$1' + escapedValue + '$2');
      else {
        // Insert new tag before closing </cp:coreProperties>
        const closeTag = '</cp:coreProperties>';
        const insertIdx = xml.indexOf(closeTag);
        if (insertIdx >= 0)
          xml = xml.substring(0, insertIdx) + '<' + tag + '>' + escapedValue + '</' + tag + '>' + xml.substring(insertIdx);
      }
    }

    // Convert modified XML to bytes
    const newXmlBytes = utf8ToBytes(xml);
    const sizeDiff = newXmlBytes.length - coreCompSize;

    // Rebuild ZIP: replace core.xml data, update sizes in local header
    const result = new Uint8Array(originalBytes.length + sizeDiff);
    // Copy before core.xml data
    result.set(originalBytes.slice(0, coreDataStart), 0);
    // Write new data
    for (let i = 0; i < newXmlBytes.length; ++i)
      result[coreDataStart + i] = newXmlBytes[i];
    // Copy after core.xml data
    const afterOffset = coreDataStart + coreCompSize;
    result.set(originalBytes.slice(afterOffset), coreDataStart + newXmlBytes.length);

    // Update compressed size and uncompressed size in local file header
    writeU32LE(result, coreStart + 18, newXmlBytes.length); // compressed size
    writeU32LE(result, coreStart + 22, newXmlBytes.length); // uncompressed size

    // Also need to update central directory entry for core.xml
    // Find EOCD
    for (let i = result.length - 22; i >= Math.max(0, result.length - 65557); --i) {
      if (readU32LE(result, i) === 0x06054B50) {
        const cdOffset = readU32LE(result, i + 16);
        const newCdOffset = cdOffset + sizeDiff;
        writeU32LE(result, i + 16, newCdOffset); // update CD offset in EOCD

        // Walk central directory and update the core.xml entry
        let cdPos = newCdOffset;
        while (cdPos + 46 <= result.length) {
          if (readU32LE(result, cdPos) !== 0x02014B50) break;
          const nameLen2 = readU16LE(result, cdPos + 28);
          const extraLen2 = readU16LE(result, cdPos + 30);
          const commentLen2 = readU16LE(result, cdPos + 32);
          const cdName = readString(result, cdPos + 46, nameLen2);
          if (cdName === 'docProps/core.xml') {
            writeU32LE(result, cdPos + 20, newXmlBytes.length); // compressed size
            writeU32LE(result, cdPos + 24, newXmlBytes.length); // uncompressed size
          }
          // Update local header offset for entries after core.xml
          const localOff = readU32LE(result, cdPos + 42);
          if (localOff > coreStart)
            writeU32LE(result, cdPos + 42, localOff + sizeDiff);
          cdPos += 46 + nameLen2 + extraLen2 + commentLen2;
        }
        break;
      }
    }

    return result;
  }

  // =========================================================================
  // Main rebuild dispatcher
  // =========================================================================

  // =========================================================================
  // IPTC APP13 writer
  // =========================================================================

  function rebuildIPTC(originalBytes, iptcMods) {
    // Build dataset ID → value map
    const datasets = new Map();
    for (const [key, value] of iptcMods) {
      if (value === null) continue;
      const dsId = parseInt(key.substring(5), 16);
      if (!isNaN(dsId)) datasets.set(dsId, value);
    }
    if (datasets.size === 0) return originalBytes;

    // Find APP13 segment
    let app13Start = -1, app13SegLen = 0;
    let offset = 2;
    while (offset < originalBytes.length - 1) {
      if (originalBytes[offset] !== 0xFF) break;
      const marker = originalBytes[offset + 1];
      offset += 2;
      if (marker === 0xD9) break;
      if (marker === 0x00 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) continue;
      if (offset + 2 > originalBytes.length) break;
      const segLen = readU16BE_local(originalBytes, offset);
      if (marker === 0xED && segLen > 16) {
        const hdr = readString(originalBytes, offset + 2, 14);
        if (hdr.startsWith('Photoshop 3.0')) {
          app13Start = offset - 2;
          app13SegLen = segLen;
          break;
        }
      }
      offset += segLen;
    }

    // Parse existing IIM datasets if APP13 exists
    const existingDatasets = new Map();
    if (app13Start >= 0) {
      const psDataStart = app13Start + 2 + 2 + 14; // marker + length + "Photoshop 3.0\0"
      const psDataEnd = app13Start + 2 + app13SegLen;
      let pos = psDataStart;
      while (pos + 12 <= psDataEnd) {
        if (originalBytes[pos] !== 0x38 || originalBytes[pos + 1] !== 0x42 ||
            originalBytes[pos + 2] !== 0x49 || originalBytes[pos + 3] !== 0x4D) {
          ++pos;
          continue;
        }
        pos += 4;
        const resId = readU16BE_local(originalBytes, pos);
        pos += 2;
        const nameLen = originalBytes[pos];
        ++pos;
        pos += nameLen;
        if ((nameLen + 1) & 1) ++pos;
        if (pos + 4 > psDataEnd) break;
        const dataSize = readU32BE(originalBytes, pos);
        pos += 4;

        if (resId === 0x0404 && dataSize > 0) {
          // Parse IIM datasets
          const iimEnd = Math.min(pos + dataSize, psDataEnd);
          let ip = pos;
          while (ip + 5 <= iimEnd) {
            if (originalBytes[ip] !== 0x1C) { ++ip; continue; }
            const record = originalBytes[ip + 1];
            const dsId = originalBytes[ip + 2];
            const dsSize = readU16BE_local(originalBytes, ip + 3);
            ip += 5;
            if (record === 0x02 && ip + dsSize <= iimEnd) {
              if (!datasets.has(dsId)) {
                // Preserve unmodified datasets
                const val = new TextDecoder().decode(originalBytes.slice(ip, ip + dsSize));
                existingDatasets.set(dsId, val.replace(/\0+$/, ''));
              }
            }
            ip += dsSize;
          }
        }

        pos += dataSize;
        if (dataSize & 1) ++pos;
      }
    }

    // Merge: modified datasets override existing
    for (const [dsId, val] of datasets) existingDatasets.set(dsId, val);

    // Build IIM record bytes
    const iimParts = [];
    // Record version dataset (required)
    if (!existingDatasets.has(0x00))
      iimParts.push(new Uint8Array([0x1C, 0x02, 0x00, 0x00, 0x02, 0x00, 0x04]));

    for (const [dsId, val] of existingDatasets) {
      if (dsId === 0x00) continue; // already added
      const valBytes = new TextEncoder().encode(val);
      const ds = new Uint8Array(5 + valBytes.length);
      ds[0] = 0x1C;
      ds[1] = 0x02;
      ds[2] = dsId;
      ds[3] = (valBytes.length >> 8) & 0xFF;
      ds[4] = valBytes.length & 0xFF;
      ds.set(valBytes, 5);
      iimParts.push(ds);
    }

    let iimTotalLen = 0;
    for (const p of iimParts) iimTotalLen += p.length;

    // Build 8BIM resource 0x0404
    const resHeader = new Uint8Array(12);
    resHeader[0] = 0x38; resHeader[1] = 0x42; resHeader[2] = 0x49; resHeader[3] = 0x4D; // "8BIM"
    writeU16BE(resHeader, 4, 0x0404);
    resHeader[6] = 0; resHeader[7] = 0; // empty pascal string + pad
    writeU32BE(resHeader, 8, iimTotalLen);

    // Build APP13 segment
    const psHeader = utf8ToBytes('Photoshop 3.0\0');
    const app13DataLen = psHeader.length + resHeader.length + iimTotalLen + (iimTotalLen & 1 ? 1 : 0);
    const newApp13 = new Uint8Array(2 + 2 + app13DataLen);
    newApp13[0] = 0xFF;
    newApp13[1] = 0xED;
    writeU16BE(newApp13, 2, app13DataLen + 2);
    let wp = 4;
    for (let i = 0; i < psHeader.length; ++i) newApp13[wp++] = psHeader[i];
    newApp13.set(resHeader, wp);
    wp += resHeader.length;
    for (const p of iimParts) {
      newApp13.set(p, wp);
      wp += p.length;
    }

    // Reassemble JPEG
    let before, after;
    if (app13Start >= 0) {
      const app13End = app13Start + 2 + app13SegLen;
      before = originalBytes.slice(0, app13Start);
      after = originalBytes.slice(app13End);
    } else {
      // Insert after SOI + any existing APP segments
      let insertPos = 2;
      let scanOff = 2;
      while (scanOff < originalBytes.length - 1) {
        if (originalBytes[scanOff] !== 0xFF) break;
        const m = originalBytes[scanOff + 1];
        if (m >= 0xE0 && m <= 0xEF) {
          const sl = readU16BE_local(originalBytes, scanOff + 2);
          insertPos = scanOff + 2 + sl;
          scanOff = insertPos;
        } else
          break;
      }
      before = originalBytes.slice(0, insertPos);
      after = originalBytes.slice(insertPos);
    }

    const result = new Uint8Array(before.length + newApp13.length + after.length);
    result.set(before, 0);
    result.set(newApp13, before.length);
    result.set(after, before.length + newApp13.length);
    return result;
  }

  // =========================================================================
  // Main rebuild dispatcher
  // =========================================================================

  function rebuildFile(fileTypeId, originalBytes, modifications) {
    if (modifications.size === 0)
      return originalBytes;

    // Separate modifications by prefix
    const id3v2Mods = new Map();
    const id3v1Mods = new Map();
    const pngMods = new Map();
    const exifMods = new Map();
    const gpsMods = new Map();
    const iptcMods = new Map();
    const mp4Mods = new Map();
    const ooxmlMods = new Map();

    for (const [key, value] of modifications) {
      if (key.startsWith('id3v1.'))
        id3v1Mods.set(key, value);
      else if (key.startsWith('id3.'))
        id3v2Mods.set(key, value);
      else if (key.startsWith('png.'))
        pngMods.set(key, value);
      else if (key.startsWith('exif.'))
        exifMods.set(key, value);
      else if (key.startsWith('gps.'))
        gpsMods.set(key, value);
      else if (key.startsWith('iptc.'))
        iptcMods.set(key, value);
      else if (key.startsWith('mp4.ilst.'))
        mp4Mods.set(key, value);
      else if (key.startsWith('ooxml.'))
        ooxmlMods.set(key, value);
    }

    if (fileTypeId === 'mp3') {
      let result = originalBytes;
      if (id3v2Mods.size > 0)
        result = rebuildID3v2(result, id3v2Mods);
      if (id3v1Mods.size > 0)
        result = rebuildID3v1(result, id3v1Mods);
      return result;
    }

    if (fileTypeId === 'png' && pngMods.size > 0)
      return rebuildPNG(originalBytes, pngMods);

    if (fileTypeId === 'jpeg') {
      let result = originalBytes;
      if (exifMods.size > 0 || gpsMods.size > 0)
        result = rebuildJPEG(result, exifMods, gpsMods);
      if (iptcMods.size > 0)
        result = rebuildIPTC(result, iptcMods);
      return result;
    }

    if (fileTypeId === 'mp4' && mp4Mods.size > 0)
      return rebuildMP4(originalBytes, mp4Mods);

    if ((fileTypeId === 'docx' || fileTypeId === 'xlsx' || fileTypeId === 'pptx' || fileTypeId === 'ooxml') && ooxmlMods.size > 0)
      return rebuildOOXML(originalBytes, ooxmlMods);

    return originalBytes;
  }

  // =========================================================================
  // Export
  // =========================================================================

  SZ.MetadataEditors = {
    isEditable,
    rebuildFile,
    crc32,
  };

})();
