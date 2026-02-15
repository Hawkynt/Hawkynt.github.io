;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  // =========================================================================
  // Utility helpers
  // =========================================================================

  function readU8(bytes, offset) {
    return offset < bytes.length ? bytes[offset] : 0;
  }

  function readU16LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8);
  }

  function readU16BE(bytes, offset) {
    return (bytes[offset] << 8) | bytes[offset + 1];
  }

  function readU32LE(bytes, offset) {
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function readU32BE(bytes, offset) {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  }

  function readI32LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
  }

  function readU64LE(bytes, offset) {
    const lo = readU32LE(bytes, offset);
    const hi = readU32LE(bytes, offset + 4);
    return hi * 0x100000000 + lo;
  }

  function readU64BE(bytes, offset) {
    const hi = readU32BE(bytes, offset);
    const lo = readU32BE(bytes, offset + 4);
    return hi * 0x100000000 + lo;
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

  function readUTF8(bytes, offset, length) {
    const slice = bytes.slice(offset, offset + length);
    try {
      return new TextDecoder('utf-8').decode(slice);
    } catch (_) {
      return readString(bytes, offset, length);
    }
  }

  function readUTF16(bytes, offset, length, le) {
    let s = '';
    const reader = le ? readU16LE : readU16BE;
    for (let i = 0; i + 1 < length && offset + i + 1 < bytes.length; i += 2) {
      const code = reader(bytes, offset + i);
      if (code === 0) break;
      s += String.fromCharCode(code);
    }
    return s;
  }

  function bytesToHex(bytes, offset, length) {
    let hex = '';
    for (let i = 0; i < length && offset + i < bytes.length; ++i) {
      if (i > 0) hex += ' ';
      hex += bytes[offset + i].toString(16).padStart(2, '0').toUpperCase();
    }
    return hex;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  function formatTimestamp(unixSec) {
    try {
      return new Date(unixSec * 1000).toLocaleString();
    } catch (_) {
      return String(unixSec);
    }
  }

  function matchBytes(bytes, offset, signature) {
    for (let i = 0; i < signature.length; ++i)
      if (offset + i >= bytes.length || bytes[offset + i] !== signature[i])
        return false;
    return true;
  }

  function computeEntropy(bytes) {
    if (bytes.length === 0) return 0;
    const freq = new Uint32Array(256);
    for (let i = 0; i < bytes.length; ++i)
      ++freq[bytes[i]];
    let entropy = 0;
    const len = bytes.length;
    for (let i = 0; i < 256; ++i) {
      if (freq[i] === 0) continue;
      const p = freq[i] / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  function countNulls(bytes) {
    let count = 0;
    for (let i = 0; i < bytes.length; ++i)
      if (bytes[i] === 0) ++count;
    return count;
  }

  function detectTextEncoding(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return 'UTF-8 (BOM)';
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return 'UTF-16 LE';
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return 'UTF-16 BE';
    const nullPct = countNulls(bytes) / bytes.length;
    if (nullPct > 0.3) return 'Binary';
    let ascii = 0;
    for (let i = 0; i < Math.min(bytes.length, 4096); ++i)
      if (bytes[i] >= 0x20 && bytes[i] <= 0x7E || bytes[i] === 0x0A || bytes[i] === 0x0D || bytes[i] === 0x09)
        ++ascii;
    const ratio = ascii / Math.min(bytes.length, 4096);
    if (ratio > 0.95) return 'ASCII / UTF-8';
    if (ratio > 0.7) return 'Likely text';
    return 'Binary';
  }

  function bytesToDataUrl(bytes, mimeType) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      const slice = bytes.subarray(i, i + chunk);
      for (let j = 0; j < slice.length; ++j)
        binary += String.fromCharCode(slice[j]);
    }
    return 'data:' + mimeType + ';base64,' + btoa(binary);
  }

  // =========================================================================
  // Magic byte table
  // =========================================================================

  const MAGIC_TABLE = [
    // ---- Images ----
    { signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, id: 'png', name: 'PNG Image', category: 'Image', mimeType: 'image/png' },
    { signature: [0xFF, 0xD8, 0xFF], offset: 0, id: 'jpeg', name: 'JPEG Image', category: 'Image', mimeType: 'image/jpeg' },
    { signature: [0x47, 0x49, 0x46, 0x38], offset: 0, id: 'gif', name: 'GIF Image', category: 'Image', mimeType: 'image/gif' },
    { signature: [0x42, 0x4D], offset: 0, id: 'bmp', name: 'BMP Image', category: 'Image', mimeType: 'image/bmp' },
    { signature: [0x00, 0x00, 0x01, 0x00], offset: 0, id: 'ico', name: 'ICO Icon', category: 'Image', mimeType: 'image/x-icon' },
    { signature: [0x00, 0x00, 0x02, 0x00], offset: 0, id: 'cur', name: 'CUR Cursor', category: 'Image', mimeType: 'image/x-icon' },
    { signature: [0x38, 0x42, 0x50, 0x53], offset: 0, id: 'psd', name: 'Photoshop Document', category: 'Image', mimeType: 'image/vnd.adobe.photoshop' },
    { signature: [0x00, 0x00, 0x00, 0x0C, 0x6A, 0x50, 0x20, 0x20, 0x0D, 0x0A, 0x87, 0x0A], offset: 0, id: 'jp2', name: 'JPEG 2000', category: 'Image', mimeType: 'image/jp2' },
    { signature: [0xFF, 0x4F, 0xFF, 0x51], offset: 0, id: 'jp2', name: 'JPEG 2000 Codestream', category: 'Image', mimeType: 'image/jp2' },
    { signature: [0x00, 0x00, 0x00, 0x0C, 0x4A, 0x58, 0x4C, 0x20, 0x0D, 0x0A, 0x87, 0x0A], offset: 0, id: 'jxl', name: 'JPEG XL', category: 'Image', mimeType: 'image/jxl' },
    { signature: [0xFF, 0x0A], offset: 0, id: 'jxl', name: 'JPEG XL', category: 'Image', mimeType: 'image/jxl' },
    { signature: [0x49, 0x49, 0xBC, 0x01], offset: 0, id: 'jxr', name: 'JPEG XR', category: 'Image', mimeType: 'image/jxr' },
    { signature: [0x76, 0x2F, 0x31, 0x01], offset: 0, id: 'exr', name: 'OpenEXR Image', category: 'Image', mimeType: 'image/x-exr' },
    { signature: [0x67, 0x69, 0x6D, 0x70, 0x20, 0x78, 0x63, 0x66], offset: 0, id: 'xcf', name: 'GIMP XCF Image', category: 'Image', mimeType: 'image/x-xcf' },
    { signature: [0xD7, 0xCD, 0xC6, 0x9A], offset: 0, id: 'wmf', name: 'WMF Metafile', category: 'Image', mimeType: 'image/wmf' },
    // EMF detected via full header check in identify() — signature 01 00 00 00 alone is too generic
    { signature: [0x46, 0x4C, 0x49, 0x46], offset: 0, id: 'flif', name: 'FLIF Image', category: 'Image', mimeType: 'image/flif' },
    { signature: [0x42, 0x50, 0x47, 0xFB], offset: 0, id: 'bpg', name: 'BPG Image', category: 'Image', mimeType: 'image/bpg' },
    // RIFF container (WAV, AVI, WebP, ANI) — detected via fourcc in identify(), not here

    // ---- Audio ----
    { signature: [0x49, 0x44, 0x33], offset: 0, id: 'mp3', name: 'MP3 Audio', category: 'Audio', mimeType: 'audio/mpeg' },
    { signature: [0x66, 0x4C, 0x61, 0x43], offset: 0, id: 'flac', name: 'FLAC Audio', category: 'Audio', mimeType: 'audio/flac' },
    { signature: [0x4F, 0x67, 0x67, 0x53], offset: 0, id: 'ogg', name: 'OGG Audio', category: 'Audio', mimeType: 'audio/ogg' },
    { signature: [0x46, 0x4F, 0x52, 0x4D], offset: 0, id: 'aiff', name: 'AIFF Audio', category: 'Audio', mimeType: 'audio/aiff' },
    { signature: [0x4D, 0x54, 0x68, 0x64], offset: 0, id: 'midi', name: 'MIDI Music', category: 'Audio', mimeType: 'audio/midi' },
    { signature: [0x44, 0x53, 0x44, 0x20], offset: 0, id: 'dsf', name: 'DSF Audio (DSD)', category: 'Audio', mimeType: 'audio/dsf' },
    { signature: [0x46, 0x52, 0x4D, 0x38], offset: 0, id: 'dff', name: 'DSDIFF Audio (DSD)', category: 'Audio', mimeType: 'audio/x-dff' },
    // AC-3 sync word 0B 77 is only 2 bytes — detected in heuristic section with frame size validation
    { signature: [0x4D, 0x41, 0x43, 0x20], offset: 0, id: 'ape', name: "Monkey's Audio (APE)", category: 'Audio', mimeType: 'audio/x-ape' },

    // ---- Video ----
    { signature: [0x1A, 0x45, 0xDF, 0xA3], offset: 0, id: 'ebml', name: 'EBML (MKV/WebM)', category: 'Video', mimeType: 'video/webm' },
    { signature: [0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11], offset: 0, id: 'asf', name: 'ASF / WMV / WMA', category: 'Video', mimeType: 'video/x-ms-asf' },
    { signature: [0x46, 0x4C, 0x56, 0x01], offset: 0, id: 'flv', name: 'FLV Video', category: 'Video', mimeType: 'video/x-flv' },
    { signature: [0x00, 0x00, 0x01, 0xBA], offset: 0, id: 'mpegps', name: 'MPEG Program Stream', category: 'Video', mimeType: 'video/mpeg' },
    { signature: [0x00, 0x00, 0x01, 0xB3], offset: 0, id: 'mpegv', name: 'MPEG Video', category: 'Video', mimeType: 'video/mpeg' },

    // ---- Documents ----
    { signature: [0x25, 0x50, 0x44, 0x46], offset: 0, id: 'pdf', name: 'PDF Document', category: 'Document', mimeType: 'application/pdf' },
    { signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], offset: 0, id: 'ole2', name: 'OLE2 Compound Document', category: 'Document', mimeType: 'application/x-ole-storage' },
    { signature: [0x41, 0x54, 0x26, 0x54, 0x46, 0x4F, 0x52, 0x4D], offset: 0, id: 'djvu', name: 'DjVu Document', category: 'Document', mimeType: 'image/vnd.djvu' },
    { signature: [0x49, 0x54, 0x53, 0x46], offset: 0, id: 'chm', name: 'CHM Help File', category: 'Document', mimeType: 'application/vnd.ms-htmlhelp' },

    // ---- Archives ----
    { signature: [0x50, 0x4B, 0x03, 0x04], offset: 0, id: 'zip', name: 'ZIP Archive', category: 'Archive', mimeType: 'application/zip' },
    { signature: [0x50, 0x4B, 0x05, 0x06], offset: 0, id: 'zip', name: 'ZIP Archive (empty)', category: 'Archive', mimeType: 'application/zip' },
    { signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00], offset: 0, id: 'rar', name: 'RAR 5 Archive', category: 'Archive', mimeType: 'application/x-rar-compressed' },
    { signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00], offset: 0, id: 'rar', name: 'RAR Archive', category: 'Archive', mimeType: 'application/x-rar-compressed' },
    { signature: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], offset: 0, id: '7z', name: '7-Zip Archive', category: 'Archive', mimeType: 'application/x-7z-compressed' },
    { signature: [0x1F, 0x8B], offset: 0, id: 'gzip', name: 'GZIP Compressed', category: 'Archive', mimeType: 'application/gzip' },
    { signature: [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00], offset: 0, id: 'xz', name: 'XZ Compressed', category: 'Archive', mimeType: 'application/x-xz' },
    { signature: [0x04, 0x22, 0x4D, 0x18], offset: 0, id: 'lz4', name: 'LZ4 Compressed', category: 'Archive', mimeType: 'application/x-lz4' },
    { signature: [0x4C, 0x5A, 0x49, 0x50], offset: 0, id: 'lzip', name: 'LZIP Compressed', category: 'Archive', mimeType: 'application/x-lzip' },
    { signature: [0x28, 0xB5, 0x2F, 0xFD], offset: 0, id: 'zstd', name: 'Zstandard Compressed', category: 'Archive', mimeType: 'application/zstd' },
    { signature: [0x42, 0x5A, 0x68], offset: 0, id: 'bzip2', name: 'BZip2 Compressed', category: 'Archive', mimeType: 'application/x-bzip2' },
    { signature: [0x60, 0xEA], offset: 0, id: 'arj', name: 'ARJ Archive', category: 'Archive', mimeType: 'application/x-arj' },
    { signature: [0x4D, 0x53, 0x43, 0x46], offset: 0, id: 'cab', name: 'Microsoft Cabinet', category: 'Archive', mimeType: 'application/vnd.ms-cab-compressed' },
    { signature: [0x78, 0x61, 0x72, 0x21], offset: 0, id: 'xar', name: 'XAR Archive', category: 'Archive', mimeType: 'application/x-xar' },
    // LZMA signature 5D 00 00 too short/generic for reliable detection

    // ---- Executables ----
    { signature: [0x4D, 0x5A], offset: 0, id: 'pe', name: 'PE Executable', category: 'Executable', mimeType: 'application/x-dosexec' },
    { signature: [0x7F, 0x45, 0x4C, 0x46], offset: 0, id: 'elf', name: 'ELF Executable', category: 'Executable', mimeType: 'application/x-elf' },
    { signature: [0xFE, 0xED, 0xFA, 0xCE], offset: 0, id: 'macho', name: 'Mach-O (32-bit)', category: 'Executable', mimeType: 'application/x-mach-binary' },
    { signature: [0xFE, 0xED, 0xFA, 0xCF], offset: 0, id: 'macho', name: 'Mach-O (64-bit)', category: 'Executable', mimeType: 'application/x-mach-binary' },
    { signature: [0xCF, 0xFA, 0xED, 0xFE], offset: 0, id: 'macho', name: 'Mach-O (64-bit, reversed)', category: 'Executable', mimeType: 'application/x-mach-binary' },
    { signature: [0xCE, 0xFA, 0xED, 0xFE], offset: 0, id: 'macho', name: 'Mach-O (32-bit, reversed)', category: 'Executable', mimeType: 'application/x-mach-binary' },
    { signature: [0xCA, 0xFE, 0xBA, 0xBE], offset: 0, id: 'javaclass', name: 'Java Class', category: 'Executable', mimeType: 'application/java-vm' },
    { signature: [0x64, 0x65, 0x78, 0x0A], offset: 0, id: 'dex', name: 'Android DEX', category: 'Executable', mimeType: 'application/vnd.android.dex' },
    { signature: [0x00, 0x61, 0x73, 0x6D], offset: 0, id: 'wasm', name: 'WebAssembly Module', category: 'Executable', mimeType: 'application/wasm' },
    { signature: [0x1B, 0x4C, 0x75, 0x61], offset: 0, id: 'luac', name: 'Lua Bytecode', category: 'Executable', mimeType: 'application/x-lua-bytecode' },

    // ---- Data / Database ----
    { signature: [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65], offset: 0, id: 'sqlite', name: 'SQLite Database', category: 'Data', mimeType: 'application/x-sqlite3' },
    { signature: [0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x63], offset: 0, id: 'mdb', name: 'Microsoft Access (MDB)', category: 'Data', mimeType: 'application/x-msaccess' },
    { signature: [0x89, 0x48, 0x44, 0x46, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, id: 'hdf5', name: 'HDF5 Data', category: 'Data', mimeType: 'application/x-hdf5' },

    // ---- System / Package ----
    { signature: [0x21, 0x3C, 0x61, 0x72, 0x63, 0x68, 0x3E], offset: 0, id: 'deb', name: 'Debian Package', category: 'Archive', mimeType: 'application/vnd.debian.binary-package' },
    { signature: [0xED, 0xAB, 0xEE, 0xDB], offset: 0, id: 'rpm', name: 'RPM Package', category: 'Archive', mimeType: 'application/x-rpm' },
    { signature: [0x43, 0x72, 0x32, 0x34], offset: 0, id: 'crx', name: 'Chrome Extension (CRX)', category: 'Archive', mimeType: 'application/x-chrome-extension' },
    { signature: [0x4C, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00], offset: 0, id: 'lnk', name: 'Windows Shortcut (LNK)', category: 'Data', mimeType: 'application/x-ms-shortcut' },
    { signature: [0x63, 0x6F, 0x6E, 0x65, 0x63, 0x74, 0x69, 0x78], offset: 0, id: 'vhd', name: 'Virtual Hard Disk (VHD)', category: 'Data', mimeType: 'application/x-vhd' },
    { signature: [0x76, 0x68, 0x64, 0x78, 0x66, 0x69, 0x6C, 0x65], offset: 0, id: 'vhdx', name: 'Virtual Hard Disk (VHDX)', category: 'Data', mimeType: 'application/x-vhdx' },

    // ---- Disc Images ----
    { signature: [0x43, 0x44, 0x30, 0x30, 0x31], offset: 0x8001, id: 'iso', name: 'ISO 9660 Disc Image', category: 'Archive', mimeType: 'application/x-iso9660-image' },

    // ---- Retro / ROM ----
    { signature: [0x4E, 0x45, 0x53, 0x1A], offset: 0, id: 'nes', name: 'NES ROM (iNES)', category: 'Data', mimeType: 'application/x-nes-rom' },
    // SNES ROM has no reliable magic bytes at offset 0; detected by other means

    // ---- Fonts ----
    { signature: [0x00, 0x01, 0x00, 0x00], offset: 0, id: 'ttf', name: 'TrueType Font', category: 'Font', mimeType: 'font/ttf' },
    { signature: [0x4F, 0x54, 0x54, 0x4F], offset: 0, id: 'otf', name: 'OpenType Font', category: 'Font', mimeType: 'font/otf' },
    { signature: [0x77, 0x4F, 0x46, 0x46], offset: 0, id: 'woff', name: 'WOFF Font', category: 'Font', mimeType: 'font/woff' },
    { signature: [0x77, 0x4F, 0x46, 0x32], offset: 0, id: 'woff2', name: 'WOFF2 Font', category: 'Font', mimeType: 'font/woff2' },

    // ---- Cryptographic ----
    { signature: [0xC5, 0xD0, 0xD3, 0xC6], offset: 0, id: 'eps', name: 'Encapsulated PostScript', category: 'Image', mimeType: 'application/postscript' },
  ];

  // =========================================================================
  // identify(bytes) — two-pass detection
  // =========================================================================

  function identify(bytes) {
    if (!bytes || bytes.length === 0)
      return { id: 'empty', name: 'Empty File', category: 'Unknown', mimeType: 'application/octet-stream', confidence: 100 };

    // Pass 1: direct signature match
    for (const entry of MAGIC_TABLE)
      if (bytes.length > entry.offset + entry.signature.length && matchBytes(bytes, entry.offset, entry.signature))
        return { id: entry.id, name: entry.name, category: entry.category, mimeType: entry.mimeType, confidence: 95 };

    // MP3 without ID3 tag (sync word)
    if (bytes.length >= 2 && bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0)
      return { id: 'mp3', name: 'MP3 Audio', category: 'Audio', mimeType: 'audio/mpeg', confidence: 70 };

    // RIFF container (WAV, AVI, WebP, ANI, RMID, CDR, etc.)
    if (bytes.length >= 12 && matchBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46])) {
      const fourcc = readString(bytes, 8, 4);
      if (fourcc === 'WAVE') return { id: 'wav', name: 'WAV Audio', category: 'Audio', mimeType: 'audio/wav', confidence: 95 };
      if (fourcc === 'AVI ') return { id: 'avi', name: 'AVI Video', category: 'Video', mimeType: 'video/avi', confidence: 95 };
      if (fourcc === 'WEBP') return { id: 'webp', name: 'WebP Image', category: 'Image', mimeType: 'image/webp', confidence: 95 };
      if (fourcc === 'ACON') return { id: 'ani', name: 'Animated Cursor (ANI)', category: 'Image', mimeType: 'application/x-navi-animation', confidence: 95 };
      if (fourcc === 'RMID') return { id: 'rmidi', name: 'RIFF MIDI', category: 'Audio', mimeType: 'audio/midi', confidence: 90 };
      if (fourcc === 'CDR ') return { id: 'cdr', name: 'CorelDRAW', category: 'Image', mimeType: 'application/vnd.corel-draw', confidence: 90 };
      if (fourcc === 'PAL ') return { id: 'pal', name: 'RIFF Palette', category: 'Data', mimeType: 'application/octet-stream', confidence: 85 };
      return { id: 'riff', name: 'RIFF Container (' + fourcc.trim() + ')', category: 'Data', mimeType: 'application/octet-stream', confidence: 60 };
    }

    // TIFF
    if (bytes.length >= 4 && ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2A && bytes[3] === 0x00) ||
                               (bytes[0] === 0x4D && bytes[1] === 0x4D && bytes[2] === 0x00 && bytes[3] === 0x2A)))
      return { id: 'tiff', name: 'TIFF Image', category: 'Image', mimeType: 'image/tiff', confidence: 90 };

    // ISO BMFF (MP4, M4A, M4V, MOV, HEIC, AVIF, 3GPP, etc.) — ftyp at offset 4
    if (bytes.length >= 12 && matchBytes(bytes, 4, [0x66, 0x74, 0x79, 0x70])) {
      const brand = readString(bytes, 8, 4);
      const b = brand.trim();
      if (b === 'M4A' || b === 'M4B')
        return { id: 'mp4', name: 'M4A Audio', category: 'Audio', mimeType: 'audio/mp4', confidence: 95 };
      if (b === 'M4V' || b === 'M4VP')
        return { id: 'mp4', name: 'M4V Video', category: 'Video', mimeType: 'video/x-m4v', confidence: 95 };
      if (b === 'qt')
        return { id: 'mp4', name: 'QuickTime Movie', category: 'Video', mimeType: 'video/quicktime', confidence: 95 };
      if (b === 'heic' || b === 'heix' || b === 'mif1')
        return { id: 'heic', name: 'HEIC Image', category: 'Image', mimeType: 'image/heic', confidence: 95 };
      if (b === 'avif' || b === 'avis')
        return { id: 'avif', name: 'AVIF Image', category: 'Image', mimeType: 'image/avif', confidence: 95 };
      if (b === 'av01')
        return { id: 'av1', name: 'AV1 Video', category: 'Video', mimeType: 'video/av1', confidence: 95 };
      if (b === '3gp4' || b === '3gp5' || b === '3gp6' || b === '3ge6' || b === '3ge7' || b === '3gg6')
        return { id: '3gpp', name: '3GPP Video', category: 'Video', mimeType: 'video/3gpp', confidence: 95 };
      if (b === 'crx' || b === 'cr2')
        return { id: 'cr2', name: 'Canon RAW Image', category: 'Image', mimeType: 'image/x-canon-cr2', confidence: 90 };
      return { id: 'mp4', name: 'MP4 Video (' + b + ')', category: 'Video', mimeType: 'video/mp4', confidence: 90 };
    }

    // ZIP-based format detection: walk local file headers to extract filenames
    if (bytes.length >= 30 && matchBytes(bytes, 0, [0x50, 0x4B, 0x03, 0x04])) {
      const zipNames = [];
      let zp = 0;
      while (zp + 30 <= bytes.length && zipNames.length < 50) {
        if (readU32LE(bytes, zp) !== 0x04034B50) break;
        const cSize = readU32LE(bytes, zp + 18);
        const nLen = readU16LE(bytes, zp + 26);
        const eLen = readU16LE(bytes, zp + 28);
        if (nLen > 0) zipNames.push(readUTF8(bytes, zp + 30, nLen));
        zp = zp + 30 + nLen + eLen + cSize;
      }
      // OOXML detection
      if (zipNames.some(n => n === '[Content_Types].xml')) {
        if (zipNames.some(n => n.startsWith('word/')))
          return { id: 'docx', name: 'Word Document (OOXML)', category: 'Document', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', confidence: 95 };
        if (zipNames.some(n => n.startsWith('xl/')))
          return { id: 'xlsx', name: 'Excel Spreadsheet (OOXML)', category: 'Document', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', confidence: 95 };
        if (zipNames.some(n => n.startsWith('ppt/')))
          return { id: 'pptx', name: 'PowerPoint Presentation (OOXML)', category: 'Document', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', confidence: 95 };
        return { id: 'ooxml', name: 'Office Document (OOXML)', category: 'Document', mimeType: 'application/zip', confidence: 80 };
      }
      // JAR detection
      if (zipNames.some(n => n === 'META-INF/MANIFEST.MF'))
        return { id: 'jar', name: 'Java Archive (JAR)', category: 'Archive', mimeType: 'application/java-archive', confidence: 90 };
      // APK detection (Android)
      if (zipNames.some(n => n === 'AndroidManifest.xml') && zipNames.some(n => n === 'classes.dex'))
        return { id: 'apk', name: 'Android APK', category: 'Archive', mimeType: 'application/vnd.android.package-archive', confidence: 95 };
      // OpenDocument (ODS/ODT/ODP)
      if (zipNames.some(n => n === 'mimetype') && zipNames.some(n => n === 'content.xml')) {
        // Read mimetype file content for exact type
        return { id: 'odf', name: 'OpenDocument File', category: 'Document', mimeType: 'application/vnd.oasis.opendocument', confidence: 85 };
      }
      // EPUB
      if (zipNames.some(n => n === 'mimetype') && zipNames.some(n => n.endsWith('.opf')))
        return { id: 'epub', name: 'EPUB eBook', category: 'Document', mimeType: 'application/epub+zip', confidence: 90 };
      // XPI (Firefox extension)
      if (zipNames.some(n => n === 'manifest.json') && zipNames.some(n => n.endsWith('.js')))
        return { id: 'xpi', name: 'Browser Extension', category: 'Archive', mimeType: 'application/x-xpinstall', confidence: 70 };
    }

    // RTF
    if (bytes.length >= 5 && matchBytes(bytes, 0, [0x7B, 0x5C, 0x72, 0x74, 0x66]))
      return { id: 'rtf', name: 'Rich Text Format', category: 'Document', mimeType: 'application/rtf', confidence: 90 };

    // TAR (ustar at offset 257)
    if (bytes.length >= 263 && matchBytes(bytes, 257, [0x75, 0x73, 0x74, 0x61, 0x72]))
      return { id: 'tar', name: 'TAR Archive', category: 'Archive', mimeType: 'application/x-tar', confidence: 90 };

    // MPEG-TS (188-byte packets starting with 0x47 sync byte)
    if (bytes.length >= 376 && bytes[0] === 0x47 && bytes[188] === 0x47)
      return { id: 'mpegts', name: 'MPEG Transport Stream', category: 'Video', mimeType: 'video/mp2t', confidence: 85 };

    // AAC-ADTS (sync word 0xFFF with profile bits)
    if (bytes.length >= 4 && bytes[0] === 0xFF && (bytes[1] & 0xF0) === 0xF0 && ((bytes[1] & 0x06) === 0x00))
      return { id: 'aac', name: 'AAC Audio (ADTS)', category: 'Audio', mimeType: 'audio/aac', confidence: 70 };

    // BOM-based text detection
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF)
      return { id: 'text', name: 'Text File (UTF-8 BOM)', category: 'Document', mimeType: 'text/plain', confidence: 80 };
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE)
      return { id: 'text', name: 'Text File (UTF-16LE)', category: 'Document', mimeType: 'text/plain', confidence: 80 };
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF)
      return { id: 'text', name: 'Text File (UTF-16BE)', category: 'Document', mimeType: 'text/plain', confidence: 80 };

    // PGP/GPG
    if (bytes.length >= 3 && (bytes[0] === 0xA8 || bytes[0] === 0x85 || bytes[0] === 0xC5 || bytes[0] === 0xC6 || bytes[0] === 0xC7))
      if ((bytes[0] & 0x80) === 0x80) {
        // Old-format PGP packet tag
        const tag = (bytes[0] & 0x3C) >> 2;
        if (tag >= 1 && tag <= 14)
          return { id: 'pgp', name: 'PGP/GPG Data', category: 'Data', mimeType: 'application/pgp-encrypted', confidence: 60 };
      }

    // Pass 2: heuristics for text-based formats
    const textSample = readUTF8(bytes, 0, Math.min(bytes.length, 1024)).trim();

    if (textSample.startsWith('<?xml') || textSample.startsWith('<svg'))
      return { id: 'xml', name: textSample.includes('<svg') ? 'SVG Image' : 'XML Document', category: 'Data', mimeType: textSample.includes('<svg') ? 'image/svg+xml' : 'application/xml', confidence: 80 };

    if ((textSample.startsWith('{') && textSample.endsWith('}')) || (textSample.startsWith('[') && textSample.endsWith(']'))) {
      try { JSON.parse(textSample); return { id: 'json', name: 'JSON Document', category: 'Data', mimeType: 'application/json', confidence: 75 }; } catch (_) {}
    }

    if (textSample.startsWith('<!DOCTYPE html') || textSample.startsWith('<html'))
      return { id: 'html', name: 'HTML Document', category: 'Document', mimeType: 'text/html', confidence: 70 };

    // Shebang script detection
    if (textSample.startsWith('#!')) {
      const shebang = textSample.substring(0, textSample.indexOf('\n') || 80).toLowerCase();
      if (shebang.includes('python')) return { id: 'script', name: 'Python Script', category: 'Executable', mimeType: 'text/x-python', confidence: 85 };
      if (shebang.includes('bash') || shebang.includes('/sh')) return { id: 'script', name: 'Shell Script', category: 'Executable', mimeType: 'application/x-shellscript', confidence: 85 };
      if (shebang.includes('node') || shebang.includes('deno') || shebang.includes('bun')) return { id: 'script', name: 'JavaScript Script', category: 'Executable', mimeType: 'application/javascript', confidence: 85 };
      if (shebang.includes('perl')) return { id: 'script', name: 'Perl Script', category: 'Executable', mimeType: 'text/x-perl', confidence: 85 };
      if (shebang.includes('ruby')) return { id: 'script', name: 'Ruby Script', category: 'Executable', mimeType: 'text/x-ruby', confidence: 85 };
      if (shebang.includes('php')) return { id: 'script', name: 'PHP Script', category: 'Executable', mimeType: 'text/x-php', confidence: 85 };
      return { id: 'script', name: 'Script File', category: 'Executable', mimeType: 'text/plain', confidence: 70 };
    }

    // PEM certificates/keys
    if (textSample.startsWith('-----BEGIN'))
      return { id: 'pem', name: 'PEM Certificate/Key', category: 'Data', mimeType: 'application/x-pem-file', confidence: 90 };

    // iCalendar
    if (textSample.startsWith('BEGIN:VCALENDAR'))
      return { id: 'ics', name: 'iCalendar Event', category: 'Data', mimeType: 'text/calendar', confidence: 90 };

    // vCard
    if (textSample.startsWith('BEGIN:VCARD'))
      return { id: 'vcf', name: 'vCard Contact', category: 'Data', mimeType: 'text/vcard', confidence: 90 };

    // CSS
    if (/^(@charset|@import|@media|\*\s*\{|body\s*\{|html\s*\{|\/\*)/i.test(textSample))
      return { id: 'css', name: 'CSS Stylesheet', category: 'Document', mimeType: 'text/css', confidence: 50 };

    // YAML
    if (textSample.startsWith('---\n') || textSample.startsWith('---\r\n'))
      return { id: 'yaml', name: 'YAML Document', category: 'Data', mimeType: 'text/yaml', confidence: 55 };

    // INI / Config
    if (/^\[[\w\s.-]+\]\s*[\r\n]/.test(textSample))
      return { id: 'ini', name: 'INI / Configuration File', category: 'Data', mimeType: 'text/plain', confidence: 45 };

    // Generic fallback
    const encoding = detectTextEncoding(bytes);
    if (encoding !== 'Binary')
      return { id: 'text', name: 'Text File', category: 'Document', mimeType: 'text/plain', confidence: 40 };

    return { id: 'binary', name: 'Binary File', category: 'Unknown', mimeType: 'application/octet-stream', confidence: 10 };
  }

  // =========================================================================
  // Generic parser (always included)
  // =========================================================================

  function parseGeneric(bytes, fileName) {
    const fields = [
      { key: 'fileName', label: 'File Name', value: fileName || '(unknown)' },
      { key: 'fileSize', label: 'File Size', value: formatSize(bytes.length), raw: bytes.length },
      { key: 'encoding', label: 'Encoding', value: detectTextEncoding(bytes) },
      { key: 'entropy', label: 'Shannon Entropy', value: computeEntropy(bytes).toFixed(4) + ' bits/byte' },
      { key: 'nullPct', label: 'Null Byte %', value: (countNulls(bytes) / Math.max(bytes.length, 1) * 100).toFixed(1) + '%' },
      { key: 'firstBytes', label: 'First 16 Bytes', value: bytesToHex(bytes, 0, 16) },
    ];
    return { name: 'General', icon: 'info', fields };
  }

  // =========================================================================
  // JPEG parser
  // =========================================================================

  function parseJPEG(bytes) {
    const categories = [];
    const images = [];
    const imgFields = [];
    const byteRegions = [];

    // SOI marker
    byteRegions.push({ offset: 0, length: 2, label: 'SOI Marker', color: 0 });

    // Walk JPEG segments
    let offset = 2; // skip SOI (FF D8)
    let width = 0, height = 0, colorComponents = 0;
    let exifData = null, jfifData = null;

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

      // Marker + length
      const markerName = marker === 0xE0 ? 'APP0' : marker === 0xE1 ? 'APP1' : marker === 0xC0 ? 'SOF0' : marker === 0xC2 ? 'SOF2' : marker === 0xDA ? 'SOS' : marker === 0xDB ? 'DQT' : marker === 0xC4 ? 'DHT' : 'Segment 0x' + marker.toString(16).toUpperCase();
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
        if (id === 'JFIF\0') {
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
        if (exifHeader === 'Exif\0\0')
          exifData = { offset: segData + 6, length: segLen - 8 };
      }

      offset += segLen;
    }

    if (imgFields.length > 0)
      categories.push({ name: 'Image', icon: 'image', fields: imgFields });

    // Parse EXIF if present
    if (exifData)
      parseEXIF(bytes, exifData.offset, exifData.length, categories, images);

    return { categories, images, byteRegions };
  }

  // =========================================================================
  // EXIF parser
  // =========================================================================

  const EXIF_TAGS = {
    0x010F: 'Camera Make',
    0x0110: 'Camera Model',
    0x0112: 'Orientation',
    0x011A: 'X Resolution',
    0x011B: 'Y Resolution',
    0x0128: 'Resolution Unit',
    0x0131: 'Software',
    0x0132: 'Date/Time',
    0x013B: 'Artist',
    0x8298: 'Copyright',
    0x829A: 'Exposure Time',
    0x829D: 'F-Number',
    0x8827: 'ISO Speed',
    0x9003: 'Date/Time Original',
    0x9004: 'Date/Time Digitized',
    0x9204: 'Exposure Bias',
    0x9207: 'Metering Mode',
    0x9209: 'Flash',
    0x920A: 'Focal Length',
    0xA001: 'Color Space',
    0xA002: 'Pixel X Dimension',
    0xA003: 'Pixel Y Dimension',
    0xA405: 'Focal Length (35mm)',
    0xA431: 'Serial Number',
    0xA432: 'Lens Info',
    0xA433: 'Lens Make',
    0xA434: 'Lens Model',
  };

  const GPS_TAGS = {
    0x0001: 'Latitude Ref',
    0x0002: 'Latitude',
    0x0003: 'Longitude Ref',
    0x0004: 'Longitude',
    0x0005: 'Altitude Ref',
    0x0006: 'Altitude',
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

  function parseEXIF(bytes, tiffStart, tiffLength, categories, images) {
    if (tiffLength < 8) return;

    const le = bytes[tiffStart] === 0x49; // 'II' = little-endian
    const readU16 = le ? readU16LE : readU16BE;
    const readU32 = le ? readU32LE : readU32BE;

    const magic = readU16(bytes, tiffStart + 2);
    if (magic !== 0x002A) return;

    const ifd0Offset = readU32(bytes, tiffStart + 4);

    function readIFDValue(type, count, valueOffset) {
      const abs = tiffStart + valueOffset;
      if (type === 2) // ASCII
        return readString(bytes, abs, count).replace(/\0+$/, '');
      if (type === 3 && count === 1) // SHORT
        return readU16(bytes, abs);
      if (type === 4 && count === 1) // LONG
        return readU32(bytes, abs);
      if (type === 5 && count === 1) { // RATIONAL
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
      if (type === 10 && count === 1) { // SRATIONAL
        const num = readI32LE(bytes, abs);
        const den = readI32LE(bytes, abs + 4);
        return den === 0 ? 0 : num / den;
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
        if (totalSize <= 4) {
          valueOffset = entryBase + 8 - tiffStart;
        } else {
          valueOffset = readU32(bytes, entryBase + 8);
        }

        const tagName = (tagMap && tagMap[tag]) || null;
        const value = readIFDValue(type, count, valueOffset);
        result[tag] = { tag, tagName, type, count, value };
      }

      // Next IFD offset
      const nextOffset = abs + 2 + entryCount * 12;
      if (nextOffset + 4 <= bytes.length)
        result._nextIFD = readU32(bytes, nextOffset);

      return result;
    }

    // Read IFD0
    const ifd0 = readIFD(ifd0Offset, EXIF_TAGS);
    const exifFields = [];

    for (const entry of Object.values(ifd0)) {
      if (!entry.tagName || entry.tagName.startsWith('_')) continue;
      let displayValue = entry.value;
      if (entry.tag === 0x0112) displayValue = ORIENTATION_MAP[entry.value] || String(entry.value);
      else if (entry.tag === 0x829A && typeof entry.value === 'number')
        displayValue = entry.value < 1 ? '1/' + Math.round(1 / entry.value) + ' s' : entry.value + ' s';
      else if (entry.tag === 0x829D && typeof entry.value === 'number')
        displayValue = 'f/' + entry.value.toFixed(1);
      else if (entry.tag === 0x920A && typeof entry.value === 'number')
        displayValue = entry.value.toFixed(1) + ' mm';
      else if (entry.tag === 0x9209)
        displayValue = (entry.value & 1) ? 'Fired' : 'No flash';
      else if (entry.tag === 0x9207)
        displayValue = METERING_MAP[entry.value] || String(entry.value);
      else if (entry.tag === 0xA001)
        displayValue = entry.value === 1 ? 'sRGB' : entry.value === 0xFFFF ? 'Uncalibrated' : String(entry.value);
      else if (typeof displayValue === 'number')
        displayValue = String(displayValue);
      else if (displayValue == null)
        continue;
      exifFields.push({
        key: 'exif.' + entry.tag.toString(16),
        label: entry.tagName,
        value: String(displayValue),
        editable: entry.tag === 0x010F || entry.tag === 0x0110 || entry.tag === 0x0131 || entry.tag === 0x013B || entry.tag === 0x8298,
        editType: 'text',
      });
    }

    // Sub-IFD (EXIF)
    if (ifd0[0x8769]) {
      const subIFD = readIFD(ifd0[0x8769].value, EXIF_TAGS);
      for (const entry of Object.values(subIFD)) {
        if (!entry.tagName || entry.tagName.startsWith('_')) continue;
        let displayValue = entry.value;
        if (entry.tag === 0x829A && typeof entry.value === 'number')
          displayValue = entry.value < 1 ? '1/' + Math.round(1 / entry.value) + ' s' : entry.value + ' s';
        else if (entry.tag === 0x829D && typeof entry.value === 'number')
          displayValue = 'f/' + entry.value.toFixed(1);
        else if (entry.tag === 0x920A && typeof entry.value === 'number')
          displayValue = entry.value.toFixed(1) + ' mm';
        else if (entry.tag === 0x9209)
          displayValue = (entry.value & 1) ? 'Fired' : 'No flash';
        else if (entry.tag === 0x9207)
          displayValue = METERING_MAP[entry.value] || String(entry.value);
        else if (entry.tag === 0xA001)
          displayValue = entry.value === 1 ? 'sRGB' : entry.value === 0xFFFF ? 'Uncalibrated' : String(entry.value);
        else if (typeof displayValue === 'number')
          displayValue = String(displayValue);
        else if (displayValue == null)
          continue;
        if (!exifFields.some(f => f.key === 'exif.' + entry.tag.toString(16)))
          exifFields.push({ key: 'exif.' + entry.tag.toString(16), label: entry.tagName, value: String(displayValue) });
      }
    }

    if (exifFields.length > 0)
      categories.push({ name: 'EXIF', icon: 'camera', fields: exifFields });

    // GPS IFD
    if (ifd0[0x8825]) {
      const gpsIFD = readIFD(ifd0[0x8825].value, GPS_TAGS);
      const gpsFields = [];

      for (const entry of Object.values(gpsIFD)) {
        if (!entry.tagName || entry.tagName.startsWith('_')) continue;
        let displayValue = entry.value;
        if (Array.isArray(displayValue))
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
      const ifd1 = readIFD(ifd0._nextIFD, {});
      if (ifd1[0x0201] && ifd1[0x0202]) {
        const thumbOffset = tiffStart + ifd1[0x0201].value;
        const thumbLength = ifd1[0x0202].value;
        if (thumbOffset + thumbLength <= bytes.length) {
          const thumbBytes = bytes.slice(thumbOffset, thumbOffset + thumbLength);
          images.push({ label: 'EXIF Thumbnail', mimeType: 'image/jpeg', dataUrl: bytesToDataUrl(thumbBytes, 'image/jpeg') });
        }
      }
    }
  }

  // =========================================================================
  // PNG parser
  // =========================================================================

  function parsePNG(bytes) {
    const categories = [];
    const imgFields = [];
    const textFields = [];
    const byteRegions = [];

    // PNG signature
    byteRegions.push({ offset: 0, length: 8, label: 'PNG Signature', color: 0 });

    let offset = 8; // skip signature
    while (offset + 8 <= bytes.length) {
      const chunkLen = readU32BE(bytes, offset);
      const chunkType = readString(bytes, offset + 4, 4);
      const chunkData = offset + 8;

      // Chunk header (length + type)
      byteRegions.push({ offset, length: 4, label: chunkType + ' Length', color: 1 });
      byteRegions.push({ offset: offset + 4, length: 4, label: chunkType + ' Type', color: 1 });
      // Chunk CRC
      if (chunkLen + 12 + offset <= bytes.length)
        byteRegions.push({ offset: chunkData + chunkLen, length: 4, label: chunkType + ' CRC', color: 6 });

      if (chunkType === 'IHDR' && chunkLen >= 13) {
        byteRegions.push({ offset: chunkData, length: 13, label: 'IHDR Data', color: 2 });
        const w = readU32BE(bytes, chunkData);
        const h = readU32BE(bytes, chunkData + 4);
        const bitDepth = readU8(bytes, chunkData + 8);
        const colorType = readU8(bytes, chunkData + 9);
        const compression = readU8(bytes, chunkData + 10);
        const filter = readU8(bytes, chunkData + 11);
        const interlace = readU8(bytes, chunkData + 12);
        const colorTypeNames = { 0: 'Grayscale', 2: 'RGB', 3: 'Indexed', 4: 'Grayscale+Alpha', 6: 'RGBA' };
        imgFields.push({ key: 'png.width', label: 'Width', value: w + ' px', raw: w });
        imgFields.push({ key: 'png.height', label: 'Height', value: h + ' px', raw: h });
        imgFields.push({ key: 'png.bitDepth', label: 'Bit Depth', value: String(bitDepth) });
        imgFields.push({ key: 'png.colorType', label: 'Color Type', value: colorTypeNames[colorType] || String(colorType) });
        imgFields.push({ key: 'png.interlace', label: 'Interlace', value: interlace ? 'Adam7' : 'None' });
      } else if (chunkType === 'IDAT') {
        byteRegions.push({ offset: chunkData, length: Math.min(chunkLen, 256), label: 'Image Data', color: 4 });
      } else if (chunkType === 'tEXt' || chunkType === 'iTXt' || chunkType === 'zTXt') {
        byteRegions.push({ offset: chunkData, length: chunkLen, label: chunkType + ' Text', color: 7 });
      } else if (chunkType === 'PLTE') {
        byteRegions.push({ offset: chunkData, length: chunkLen, label: 'Palette', color: 8 });
      } else if (chunkLen > 0) {
        byteRegions.push({ offset: chunkData, length: chunkLen, label: chunkType + ' Data', color: 2 });
      }

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
        imgFields.push({ key: 'png.time', label: 'Modified', value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}` });
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
      offset += 12 + chunkLen; // length(4) + type(4) + data + CRC(4)
    }

    if (imgFields.length > 0)
      categories.push({ name: 'Image', icon: 'image', fields: imgFields });
    if (textFields.length > 0)
      categories.push({ name: 'Text Chunks', icon: 'text', fields: textFields });

    return { categories, images: [], byteRegions };
  }

  // =========================================================================
  // MP3 / ID3 parser
  // =========================================================================

  // Standard ID3v1 genre list (0-191)
  const ID3_GENRES = [
    'Blues','Classic Rock','Country','Dance','Disco','Funk','Grunge','Hip-Hop','Jazz','Metal',
    'New Age','Oldies','Other','Pop','R&B','Rap','Reggae','Rock','Techno','Industrial',
    'Alternative','Ska','Death Metal','Pranks','Soundtrack','Euro-Techno','Ambient','Trip-Hop','Vocal','Jazz+Funk',
    'Fusion','Trance','Classical','Instrumental','Acid','House','Game','Sound Clip','Gospel','Noise',
    'AlternRock','Bass','Soul','Punk','Space','Meditative','Instrumental Pop','Instrumental Rock','Ethnic','Gothic',
    'Darkwave','Techno-Industrial','Electronic','Pop-Folk','Eurodance','Dream','Southern Rock','Comedy','Cult','Gangsta',
    'Top 40','Christian Rap','Pop/Funk','Jungle','Native American','Cabaret','New Wave','Psychedelic','Rave','Showtunes',
    'Trailer','Lo-Fi','Tribal','Acid Punk','Acid Jazz','Polka','Retro','Musical','Rock & Roll','Hard Rock',
    'Folk','Folk-Rock','National Folk','Swing','Fast Fusion','Bebop','Latin','Revival','Celtic','Bluegrass',
    'Avantgarde','Gothic Rock','Progressive Rock','Psychedelic Rock','Symphonic Rock','Slow Rock','Big Band','Chorus','Easy Listening','Acoustic',
    'Humour','Speech','Chanson','Opera','Chamber Music','Sonata','Symphony','Booty Bass','Primus','Porn Groove',
    'Satire','Slow Jam','Club','Tango','Samba','Folklore','Ballad','Power Ballad','Rhythmic Soul','Freestyle',
    'Duet','Punk Rock','Drum Solo','A capella','Euro-House','Dance Hall','Goa','Drum & Bass','Club-House','Hardcore',
    'Terror','Indie','BritPop','Negerpunk','Polsk Punk','Beat','Christian Gangsta Rap','Heavy Metal','Black Metal','Crossover',
    'Contemporary Christian','Christian Rock','Merengue','Salsa','Thrash Metal','Anime','JPop','Synthpop','Abstract','Art Rock',
    'Baroque','Bhangra','Big Beat','Breakbeat','Chillout','Downtempo','Dub','EBM','Eclectic','Electro',
    'Electroclash','Emo','Experimental','Garage','Global','IDM','Illbient','Industro-Goth','Jam Band','Krautrock',
    'Leftfield','Lounge','Math Rock','New Romantic','Nu-Breakz','Post-Punk','Post-Rock','Psytrance','Shoegaze','Space Rock',
    'Trop Rock','World Music','Neoclassical','Audiobook','Audio Theatre','Neue Deutsche Welle','Podcast','Indie Rock','G-Funk','Dubstep',
    'Garage Rock','Psybient',
  ];

  function parseMP3(bytes) {
    const categories = [];
    const images = [];
    const audioFields = [];
    const byteRegions = [];

    // ID3v2
    if (bytes.length >= 10 && matchBytes(bytes, 0, [0x49, 0x44, 0x33])) {
      const id3version = bytes[3] + '.' + bytes[4];
      const flags = bytes[5];
      const size = ((bytes[6] & 0x7F) << 21) | ((bytes[7] & 0x7F) << 14) | ((bytes[8] & 0x7F) << 7) | (bytes[9] & 0x7F);
      const id3Fields = [];
      id3Fields.push({ key: 'id3.version', label: 'ID3 Version', value: '2.' + id3version });

      byteRegions.push({ offset: 0, length: 10, label: 'ID3v2 Header', color: 0 });

      let pos = 10;
      if (flags & 0x40) pos += readU32BE(bytes, 10) + 4; // extended header

      const isV23 = bytes[3] >= 3;
      const headerSize = isV23 ? 10 : 6;

      while (pos + headerSize < 10 + size && pos + headerSize < bytes.length) {
        let frameId, frameSize;
        if (isV23) {
          frameId = readString(bytes, pos, 4);
          if (frameId[0] === '\0' || !/^[A-Z0-9]{4}$/.test(frameId)) break;
          if (bytes[3] >= 4) // v2.4 uses syncsafe
            frameSize = ((bytes[pos + 4] & 0x7F) << 21) | ((bytes[pos + 5] & 0x7F) << 14) | ((bytes[pos + 6] & 0x7F) << 7) | (bytes[pos + 7] & 0x7F);
          else
            frameSize = readU32BE(bytes, pos + 4);
          pos += 10;
        } else {
          frameId = readString(bytes, pos, 3);
          if (frameId[0] === '\0' || !/^[A-Z0-9]{3}$/.test(frameId)) break;
          frameSize = (bytes[pos + 3] << 16) | (bytes[pos + 4] << 8) | bytes[pos + 5];
          pos += 6;
        }

        if (frameSize <= 0 || pos + frameSize > bytes.length) break;

        const frameData = pos;
        const frameNames = {
          TIT2: 'Title', TPE1: 'Artist', TALB: 'Album', TYER: 'Year', TDRC: 'Year',
          TCON: 'Genre', TRCK: 'Track', COMM: 'Comment', TCOM: 'Composer',
          TPE2: 'Album Artist', TPOS: 'Disc',
          TIT1: 'Content Group', TIT3: 'Subtitle', TPE3: 'Conductor', TPE4: 'Remixed By',
          TBPM: 'BPM', TCOP: 'Copyright', TENC: 'Encoded By', TPUB: 'Publisher',
          TKEY: 'Initial Key', TLAN: 'Language', TLEN: 'Length', TMED: 'Media Type',
          TOAL: 'Original Album', TOPE: 'Original Artist', TORY: 'Original Year',
          TDOR: 'Original Release Date', TSRC: 'ISRC', TSSE: 'Encoding Settings',
          TSOP: 'Performer Sort', TSOA: 'Album Sort', TSOT: 'Title Sort',
          TCMP: 'Compilation', TFLT: 'File Type', TEXT: 'Lyricist', TOFN: 'Original Filename',
          TOWN: 'File Owner', TDLY: 'Playlist Delay', TDTG: 'Tagging Time',
          TMOO: 'Mood', TPRO: 'Produced Notice', TSST: 'Set Subtitle',
          WORS: 'Radio Station URL', WOAR: 'Artist URL', WPUB: 'Publisher URL',
          TT2: 'Title', TP1: 'Artist', TAL: 'Album', TYE: 'Year', TCO: 'Genre', TRK: 'Track',
          TP2: 'Album Artist', TCM: 'Composer', TP3: 'Conductor', TCR: 'Copyright',
          TEN: 'Encoded By', TPB: 'Publisher', TKE: 'Initial Key', TLA: 'Language',
          TOA: 'Original Artist', TOT: 'Original Album', TOR: 'Original Year',
        };

        if (frameNames[frameId]) {
          const encoding = readU8(bytes, frameData);
          let text = '';
          if (frameId === 'COMM' || frameId === 'COM') {
            // Comment frame: encoding(1) + language(3) + short desc(null-term) + text
            const langEnd = frameData + 4; // skip encoding + 3 lang bytes
            let descEnd = langEnd;
            if (encoding === 1 || encoding === 2) {
              while (descEnd + 1 < frameData + frameSize && !(bytes[descEnd] === 0 && bytes[descEnd + 1] === 0)) ++descEnd;
              descEnd += 2;
            } else {
              while (descEnd < frameData + frameSize && bytes[descEnd] !== 0) ++descEnd;
              ++descEnd;
            }
            if (encoding === 0 || encoding === 3)
              text = readUTF8(bytes, descEnd, frameData + frameSize - descEnd);
            else
              text = readUTF16(bytes, descEnd, frameData + frameSize - descEnd, encoding === 1);
          } else {
            if (encoding === 0 || encoding === 3)
              text = readUTF8(bytes, frameData + 1, frameSize - 1);
            else if (encoding === 1 || encoding === 2)
              text = readUTF16(bytes, frameData + 1, frameSize - 1, encoding === 1);
          }
          text = text.replace(/\0+$/, '').trim();
          // Decode TCON genre references like "(17)" or "(17)Rock"
          if ((frameId === 'TCON' || frameId === 'TCO') && text) {
            const genreMatch = text.match(/^\((\d+)\)/);
            if (genreMatch) {
              const genreIdx = parseInt(genreMatch[1]);
              const genreName = ID3_GENRES[genreIdx];
              text = genreName || text.substring(genreMatch[0].length) || text;
            }
          }
          if (text)
            id3Fields.push({
              key: 'id3.' + frameId,
              label: frameNames[frameId],
              value: text,
              editable: true,
              editType: frameId === 'TCON' || frameId === 'TCO' ? 'genre' : 'text',
            });
        }

        // TXXX — user-defined text
        if (frameId === 'TXXX' || frameId === 'TXX') {
          const encoding = readU8(bytes, frameData);
          let descEnd = frameData + 1;
          let description = '', value = '';
          if (encoding === 1 || encoding === 2) {
            while (descEnd + 1 < frameData + frameSize && !(bytes[descEnd] === 0 && bytes[descEnd + 1] === 0)) ++descEnd;
            description = readUTF16(bytes, frameData + 1, descEnd - frameData - 1, encoding === 1);
            descEnd += 2;
            value = readUTF16(bytes, descEnd, frameData + frameSize - descEnd, encoding === 1);
          } else {
            while (descEnd < frameData + frameSize && bytes[descEnd] !== 0) ++descEnd;
            description = readUTF8(bytes, frameData + 1, descEnd - frameData - 1);
            ++descEnd;
            value = readUTF8(bytes, descEnd, frameData + frameSize - descEnd);
          }
          description = description.replace(/\0+$/, '').trim();
          value = value.replace(/\0+$/, '').trim();
          if (description && value)
            id3Fields.push({ key: 'id3.TXXX.' + description, label: description, value, editable: true, editType: 'text' });
        }

        // USLT — unsynchronized lyrics
        if (frameId === 'USLT' || frameId === 'ULT') {
          const encoding = readU8(bytes, frameData);
          const langEnd = frameData + 4;
          let descEnd = langEnd;
          if (encoding === 1 || encoding === 2) {
            while (descEnd + 1 < frameData + frameSize && !(bytes[descEnd] === 0 && bytes[descEnd + 1] === 0)) ++descEnd;
            descEnd += 2;
          } else {
            while (descEnd < frameData + frameSize && bytes[descEnd] !== 0) ++descEnd;
            ++descEnd;
          }
          let lyrics = '';
          if (encoding === 0 || encoding === 3)
            lyrics = readUTF8(bytes, descEnd, frameData + frameSize - descEnd);
          else
            lyrics = readUTF16(bytes, descEnd, frameData + frameSize - descEnd, encoding === 1);
          lyrics = lyrics.replace(/\0+$/, '').trim();
          if (lyrics)
            id3Fields.push({ key: 'id3.USLT', label: 'Lyrics', value: lyrics, editable: true, editType: 'text' });
        }

        // PCNT — play counter
        if (frameId === 'PCNT' || frameId === 'CNT') {
          let count = 0;
          for (let i = 0; i < frameSize && i < 4; ++i) count = (count << 8) | bytes[frameData + i];
          id3Fields.push({ key: 'id3.PCNT', label: 'Play Count', value: String(count) });
        }

        // POPM — popularimeter (rating)
        if (frameId === 'POPM' || frameId === 'POP') {
          let emailEnd = frameData;
          while (emailEnd < frameData + frameSize && bytes[emailEnd] !== 0) ++emailEnd;
          const rating = emailEnd + 1 < frameData + frameSize ? bytes[emailEnd + 1] : 0;
          const stars = rating === 0 ? 0 : rating < 64 ? 1 : rating < 128 ? 2 : rating < 196 ? 3 : rating < 255 ? 4 : 5;
          id3Fields.push({ key: 'id3.POPM', label: 'Rating', value: stars > 0 ? '\u2605'.repeat(stars) + '\u2606'.repeat(5 - stars) + ' (' + rating + '/255)' : 'Not rated' });
        }

        // W*** — URL frames (except WXXX)
        if (/^W[A-Z]{3}$/.test(frameId) && frameId !== 'WXXX' && frameNames[frameId]) {
          const url = readString(bytes, frameData, frameSize).replace(/\0+$/, '').trim();
          if (url)
            id3Fields.push({ key: 'id3.' + frameId, label: frameNames[frameId], value: url });
        }

        // APIC — album art
        if (frameId === 'APIC' || frameId === 'PIC') {
          const enc = readU8(bytes, frameData);
          let mimeEnd = frameData + 1;
          while (mimeEnd < frameData + frameSize && bytes[mimeEnd] !== 0) ++mimeEnd;
          const mime = readString(bytes, frameData + 1, mimeEnd - frameData - 1);
          let imgStart = mimeEnd + 2; // skip null + picture type
          if (enc === 1 || enc === 2) {
            // skip description (UTF-16, null-terminated with double null)
            while (imgStart + 1 < frameData + frameSize && !(bytes[imgStart] === 0 && bytes[imgStart + 1] === 0)) ++imgStart;
            imgStart += 2;
          } else {
            while (imgStart < frameData + frameSize && bytes[imgStart] !== 0) ++imgStart;
            ++imgStart;
          }
          if (imgStart < frameData + frameSize) {
            const imgBytes = bytes.slice(imgStart, frameData + frameSize);
            const mimeType = mime.includes('png') ? 'image/png' : 'image/jpeg';
            images.push({ label: 'Album Art', mimeType, dataUrl: bytesToDataUrl(imgBytes, mimeType) });
          }
        }

        pos += frameSize;
      }

      if (id3Fields.length > 0)
        categories.push({ name: 'ID3v2', icon: 'music', fields: id3Fields });
    }

    // Find MPEG frame header for audio details
    let mpegStart = 0;
    if (bytes.length >= 10 && matchBytes(bytes, 0, [0x49, 0x44, 0x33])) {
      const size = ((bytes[6] & 0x7F) << 21) | ((bytes[7] & 0x7F) << 14) | ((bytes[8] & 0x7F) << 7) | (bytes[9] & 0x7F);
      mpegStart = 10 + size;
    }

    for (let i = mpegStart; i < Math.min(bytes.length - 4, mpegStart + 4096); ++i) {
      if (bytes[i] === 0xFF && (bytes[i + 1] & 0xE0) === 0xE0) {
        const hdr = readU32BE(bytes, i);
        const version = (hdr >> 19) & 3;
        const layer = (hdr >> 17) & 3;
        const brIndex = (hdr >> 12) & 0xF;
        const srIndex = (hdr >> 10) & 3;
        const channelMode = (hdr >> 6) & 3;

        const versionNames = { 0: 'MPEG 2.5', 2: 'MPEG 2', 3: 'MPEG 1' };
        const layerNames = { 1: 'Layer III', 2: 'Layer II', 3: 'Layer I' };
        const channelNames = { 0: 'Stereo', 1: 'Joint Stereo', 2: 'Dual Channel', 3: 'Mono' };

        const bitrateTable = [
          [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
          [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
          [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
        ];
        const sampleRateTable = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

        const layerIdx = layer === 3 ? 0 : layer === 2 ? 1 : 2;
        const bitrate = bitrateTable[layerIdx] ? bitrateTable[layerIdx][brIndex] : 0;
        const sampleRate = sampleRateTable[version] ? sampleRateTable[version][srIndex] : 0;

        if (versionNames[version]) audioFields.push({ key: 'mp3.version', label: 'MPEG Version', value: versionNames[version] });
        if (layerNames[layer]) audioFields.push({ key: 'mp3.layer', label: 'Layer', value: layerNames[layer] });
        if (bitrate) audioFields.push({ key: 'mp3.bitrate', label: 'Bitrate', value: bitrate + ' kbps' });
        if (sampleRate) audioFields.push({ key: 'mp3.sampleRate', label: 'Sample Rate', value: sampleRate + ' Hz' });
        audioFields.push({ key: 'mp3.channels', label: 'Channels', value: channelNames[channelMode] || 'Unknown' });

        if (bitrate && sampleRate) {
          const durationSec = Math.floor((bytes.length - mpegStart) * 8 / (bitrate * 1000));
          const min = Math.floor(durationSec / 60);
          const sec = durationSec % 60;
          audioFields.push({ key: 'mp3.duration', label: 'Duration (est.)', value: min + ':' + String(sec).padStart(2, '0') });
        }
        break;
      }
    }

    // ID3v1 (last 128 bytes)
    if (bytes.length >= 128) {
      const tagStart = bytes.length - 128;
      if (matchBytes(bytes, tagStart, [0x54, 0x41, 0x47])) {
        const id3v1Fields = [];
        const v1Title = readString(bytes, tagStart + 3, 30).trim();
        const v1Artist = readString(bytes, tagStart + 33, 30).trim();
        const v1Album = readString(bytes, tagStart + 63, 30).trim();
        const v1Year = readString(bytes, tagStart + 93, 4).trim();
        const v1Comment = readString(bytes, tagStart + 97, 30).trim();
        const v1Genre = readU8(bytes, tagStart + 127);
        if (v1Title) id3v1Fields.push({ key: 'id3v1.title', label: 'Title', value: v1Title, editable: true, editType: 'text' });
        if (v1Artist) id3v1Fields.push({ key: 'id3v1.artist', label: 'Artist', value: v1Artist, editable: true, editType: 'text' });
        if (v1Album) id3v1Fields.push({ key: 'id3v1.album', label: 'Album', value: v1Album, editable: true, editType: 'text' });
        if (v1Year) id3v1Fields.push({ key: 'id3v1.year', label: 'Year', value: v1Year, editable: true, editType: 'text' });
        if (v1Comment) id3v1Fields.push({ key: 'id3v1.comment', label: 'Comment', value: v1Comment, editable: true, editType: 'text' });
        const v1GenreName = ID3_GENRES[v1Genre] || ('Unknown (' + v1Genre + ')');
        id3v1Fields.push({ key: 'id3v1.genre', label: 'Genre', value: v1GenreName });
        if (id3v1Fields.length > 0)
          categories.push({ name: 'ID3v1', icon: 'music', fields: id3v1Fields });
      }
    }

    if (audioFields.length > 0)
      categories.push({ name: 'Audio', icon: 'audio', fields: audioFields });

    return { categories, images, byteRegions };
  }

  // =========================================================================
  // PE (exe/dll) parser — sections, imports, exports, .NET, compiler detection
  // =========================================================================

  function parsePE(bytes) {
    const categories = [];
    const fields = [];
    const byteRegions = [];
    const empty = { categories: [{ name: 'PE Header', icon: 'exe', fields }], images: [], byteRegions: [] };
    if (bytes.length < 64) return empty;

    // DOS header
    byteRegions.push({ offset: 0, length: 2, label: 'MZ Signature', color: 0 });
    byteRegions.push({ offset: 2, length: 0x3C - 2, label: 'DOS Header', color: 5 });
    byteRegions.push({ offset: 0x3C, length: 4, label: 'PE Offset (e_lfanew)', color: 3 });

    const e_lfanew = readU32LE(bytes, 0x3C);
    if (e_lfanew + 24 > bytes.length)
      return { categories: [{ name: 'PE Header', icon: 'exe', fields: [{ key: 'pe.error', label: 'Error', value: 'Invalid PE offset' }] }], images: [], byteRegions };

    // DOS stub
    if (e_lfanew > 0x40)
      byteRegions.push({ offset: 0x40, length: e_lfanew - 0x40, label: 'DOS Stub', color: 5 });

    if (readU32LE(bytes, e_lfanew) !== 0x00004550)
      return { categories: [{ name: 'PE Header', icon: 'exe', fields: [{ key: 'pe.error', label: 'Error', value: 'Invalid PE signature' }] }], images: [], byteRegions };

    byteRegions.push({ offset: e_lfanew, length: 4, label: 'PE Signature', color: 0 });

    const coffBase = e_lfanew + 4;
    byteRegions.push({ offset: coffBase, length: 20, label: 'COFF Header', color: 1 });
    const machine = readU16LE(bytes, coffBase);
    const numSections = readU16LE(bytes, coffBase + 2);
    const timestamp = readU32LE(bytes, coffBase + 4);
    const optionalHeaderSize = readU16LE(bytes, coffBase + 16);
    const characteristics = readU16LE(bytes, coffBase + 18);

    const machineNames = {
      0x014C: 'x86 (i386)', 0x8664: 'x64 (AMD64)', 0x01C0: 'ARM',
      0x01C4: 'ARM Thumb-2', 0xAA64: 'ARM64', 0x5032: 'RISC-V 32',
      0x5064: 'RISC-V 64', 0x0200: 'IA-64',
    };

    fields.push({ key: 'pe.machine', label: 'Architecture', value: machineNames[machine] || '0x' + machine.toString(16).toUpperCase() });
    fields.push({ key: 'pe.sections', label: 'Sections', value: String(numSections) });
    fields.push({ key: 'pe.timestamp', label: 'Compile Time', value: formatTimestamp(timestamp) });

    const isDLL = (characteristics & 0x2000) !== 0;
    fields.push({ key: 'pe.type', label: 'File Type', value: isDLL ? 'DLL (Dynamic Library)' : 'Executable' });

    const charFlags = [];
    if (characteristics & 0x0020) charFlags.push('Large Address Aware');
    if (characteristics & 0x0100) charFlags.push('32-bit');
    if (characteristics & 0x2000) charFlags.push('DLL');
    if (characteristics & 0x0002) charFlags.push('Executable Image');
    if (charFlags.length > 0)
      fields.push({ key: 'pe.chars', label: 'Characteristics', value: charFlags.join(', ') });

    // Optional header
    const optBase = coffBase + 20;
    let isPE32Plus = false;
    let numDataDirs = 0;
    let dataDirBase = 0;

    if (optBase + 2 <= bytes.length) {
      const optMagic = readU16LE(bytes, optBase);
      isPE32Plus = optMagic === 0x020B;
      fields.push({ key: 'pe.format', label: 'PE Format', value: isPE32Plus ? 'PE32+ (64-bit)' : 'PE32 (32-bit)' });

      const linkerMajor = readU8(bytes, optBase + 2);
      const linkerMinor = readU8(bytes, optBase + 3);
      fields.push({ key: 'pe.linker', label: 'Linker Version', value: linkerMajor + '.' + linkerMinor });

      const subsystemOff = isPE32Plus ? optBase + 68 : optBase + 68;
      if (subsystemOff + 2 <= bytes.length) {
        const subsystem = readU16LE(bytes, subsystemOff);
        const subsystemNames = {
          0: 'Unknown', 1: 'Native', 2: 'Windows GUI', 3: 'Windows Console',
          5: 'OS/2 Console', 7: 'POSIX Console', 9: 'Windows CE',
          10: 'EFI Application', 12: 'EFI Boot Driver', 14: 'Xbox',
        };
        fields.push({ key: 'pe.subsystem', label: 'Subsystem', value: subsystemNames[subsystem] || String(subsystem) });
      }

      const entryRVA = readU32LE(bytes, optBase + 16);
      fields.push({ key: 'pe.entry', label: 'Entry Point', value: '0x' + entryRVA.toString(16).toUpperCase() });

      const sizeOfImage = readU32LE(bytes, isPE32Plus ? optBase + 56 : optBase + 56);
      fields.push({ key: 'pe.imageSize', label: 'Image Size', value: formatSize(sizeOfImage) });

      const numDirsOff = isPE32Plus ? optBase + 108 : optBase + 92;
      if (numDirsOff + 4 <= bytes.length) {
        numDataDirs = readU32LE(bytes, numDirsOff);
        dataDirBase = numDirsOff + 4;
      }
    }

    // ---- Section table ----
    const sectionTableBase = optBase + optionalHeaderSize;
    const sections = [];
    const sectionFields = [];

    for (let i = 0; i < numSections; ++i) {
      const sb = sectionTableBase + i * 40;
      if (sb + 40 > bytes.length) break;
      const name = readString(bytes, sb, 8);
      const virtualSize = readU32LE(bytes, sb + 8);
      const virtualAddress = readU32LE(bytes, sb + 12);
      const rawDataSize = readU32LE(bytes, sb + 16);
      const rawDataOffset = readU32LE(bytes, sb + 20);
      const secChars = readU32LE(bytes, sb + 36);
      sections.push({ name, virtualSize, virtualAddress, rawDataSize, rawDataOffset, characteristics: secChars });

      const sf = [];
      if (secChars & 0x00000020) sf.push('Code');
      if (secChars & 0x00000040) sf.push('InitData');
      if (secChars & 0x00000080) sf.push('UninitData');
      if (secChars & 0x20000000) sf.push('Exec');
      if (secChars & 0x40000000) sf.push('Read');
      if (secChars & 0x80000000) sf.push('Write');
      sectionFields.push({ key: 'pe.sec.' + i, label: name, value: formatSize(virtualSize) + ' (' + sf.join(', ') + ')' });
    }

    if (sectionFields.length > 0)
      categories.push({ name: 'Sections', icon: 'list', fields: sectionFields });

    // RVA → file offset helper
    function rvaToOffset(rva) {
      for (const sec of sections)
        if (rva >= sec.virtualAddress && rva < sec.virtualAddress + sec.rawDataSize)
          return rva - sec.virtualAddress + sec.rawDataOffset;
      return rva;
    }

    // ---- Import Directory (Data Directory[1]) ----
    const dllNames = [];
    if (numDataDirs > 1 && dataDirBase + 16 <= bytes.length) {
      const importRVA = readU32LE(bytes, dataDirBase + 8);
      const importSz = readU32LE(bytes, dataDirBase + 12);
      if (importRVA > 0 && importSz > 0) {
        const importFields = [];
        let pos = rvaToOffset(importRVA);
        while (pos + 20 <= bytes.length && importFields.length < 100) {
          const nameRVA = readU32LE(bytes, pos + 12);
          if (nameRVA === 0) break;
          const origFirstThunk = readU32LE(bytes, pos);
          const firstThunk = readU32LE(bytes, pos + 16);
          const dllName = readString(bytes, rvaToOffset(nameRVA), 256);
          if (!dllName) { pos += 20; continue; }
          dllNames.push(dllName);

          let funcCount = 0;
          const thunkRVA = origFirstThunk || firstThunk;
          if (thunkRVA > 0) {
            let tp = rvaToOffset(thunkRVA);
            const ts = isPE32Plus ? 8 : 4;
            while (tp + ts <= bytes.length) {
              const tv = isPE32Plus ? readU64LE(bytes, tp) : readU32LE(bytes, tp);
              if (tv === 0) break;
              ++funcCount;
              tp += ts;
            }
          }
          importFields.push({ key: 'pe.imp.' + importFields.length, label: dllName, value: funcCount + ' function(s)' });
          pos += 20;
        }
        if (importFields.length > 0)
          categories.push({ name: 'Imports (' + importFields.length + ' DLLs)', icon: 'link', fields: importFields });
      }
    }

    // ---- Export Directory (Data Directory[0]) ----
    if (numDataDirs > 0 && dataDirBase + 8 <= bytes.length) {
      const exportRVA = readU32LE(bytes, dataDirBase);
      const exportSz = readU32LE(bytes, dataDirBase + 4);
      if (exportRVA > 0 && exportSz > 0) {
        const eo = rvaToOffset(exportRVA);
        if (eo + 40 <= bytes.length) {
          const exportFields = [];
          const enameRVA = readU32LE(bytes, eo + 12);
          const ename = readString(bytes, rvaToOffset(enameRVA), 256);
          if (ename) exportFields.push({ key: 'pe.exp.name', label: 'DLL Name', value: ename });

          const numFunctions = readU32LE(bytes, eo + 20);
          const numNames = readU32LE(bytes, eo + 24);
          exportFields.push({ key: 'pe.exp.count', label: 'Exported Functions', value: String(numFunctions) });
          exportFields.push({ key: 'pe.exp.named', label: 'Named Exports', value: String(numNames) });

          const namesRVA = readU32LE(bytes, eo + 32);
          if (namesRVA > 0 && numNames > 0) {
            const no = rvaToOffset(namesRVA);
            const exportNames = [];
            for (let i = 0; i < Math.min(numNames, 30) && no + (i + 1) * 4 <= bytes.length; ++i) {
              const fnRVA = readU32LE(bytes, no + i * 4);
              const fn = readString(bytes, rvaToOffset(fnRVA), 256);
              if (fn) exportNames.push(fn);
            }
            if (exportNames.length > 0)
              exportFields.push({ key: 'pe.exp.names', label: 'Export Names', value: exportNames.join('\n') + (numNames > 30 ? '\n... (' + (numNames - 30) + ' more)' : '') });
          }
          if (exportFields.length > 0)
            categories.push({ name: 'Exports', icon: 'link', fields: exportFields });
        }
      }
    }

    // ---- .NET CLR header (Data Directory[14]) ----
    let isDotNet = false;
    if (numDataDirs > 14 && dataDirBase + 14 * 8 + 8 <= bytes.length) {
      const clrRVA = readU32LE(bytes, dataDirBase + 14 * 8);
      const clrSz = readU32LE(bytes, dataDirBase + 14 * 8 + 4);
      if (clrRVA > 0 && clrSz > 0) {
        isDotNet = true;
        const co = rvaToOffset(clrRVA);
        const clrFields = [{ key: 'pe.clr.runtime', label: 'Runtime', value: '.NET (CLR)' }];
        if (co + 20 <= bytes.length) {
          const clrMajor = readU16LE(bytes, co + 4);
          const clrMinor = readU16LE(bytes, co + 6);
          clrFields.push({ key: 'pe.clr.ver', label: 'CLR Header Version', value: clrMajor + '.' + clrMinor });
          const clrFlags = readU32LE(bytes, co + 16);
          if (clrFlags & 0x01) clrFields.push({ key: 'pe.clr.ilonly', label: 'IL Only', value: 'Yes' });
          if (clrFlags & 0x02) clrFields.push({ key: 'pe.clr.32bit', label: '32-bit Required', value: 'Yes' });
          if (clrFlags & 0x10000) clrFields.push({ key: 'pe.clr.native', label: 'Native Entry Point', value: 'Yes' });
        }
        // Detect .NET type from string scan
        const scanLen = Math.min(bytes.length, 65536);
        const scanStr = readString(bytes, 0, scanLen);
        if (scanStr.includes('.NETCoreApp'))
          clrFields.push({ key: 'pe.clr.type', label: '.NET Type', value: '.NET Core / .NET 5+' });
        else if (scanStr.includes('.NETFramework'))
          clrFields.push({ key: 'pe.clr.type', label: '.NET Type', value: '.NET Framework' });
        categories.push({ name: '.NET CLR', icon: 'exe', fields: clrFields });
      }
    }

    // ---- Compiler / Packer / Protector detection ----
    const detFields = [];

    // Rich header → MSVC
    let hasRich = false;
    for (let i = 0x80; i < Math.min(e_lfanew, bytes.length - 4); i += 4)
      if (readU32LE(bytes, i) === 0x68636952) { hasRich = true; break; }
    if (hasRich)
      detFields.push({ key: 'pe.rich', label: 'Rich Header', value: 'Present (MSVC toolchain)' });

    // Section name analysis
    const secNames = sections.map(s => s.name);
    const secNamesStr = secNames.join(',');

    // DLL import analysis
    const dllNamesLower = dllNames.map(n => n.toLowerCase());

    // String scanning (scan first ~256KB for signatures)
    const scanLimit = Math.min(bytes.length, 262144);
    function findString(needle) {
      for (let i = 0; i < scanLimit - needle.length; ++i) {
        let match = true;
        for (let j = 0; j < needle.length; ++j)
          if (bytes[i + j] !== needle.charCodeAt(j)) { match = false; break; }
        if (match) return true;
      }
      return false;
    }

    // Entry point bytes (first 64 bytes at EP for signature matching)
    const entryRVA = readU32LE(bytes, optBase + 16);
    const epOffset = rvaToOffset(entryRVA);
    const epBytes = [];
    for (let i = 0; i < 64 && epOffset + i < bytes.length; ++i) epBytes.push(bytes[epOffset + i]);

    // ---- Packer detection ----
    const packers = [];

    // UPX
    if (secNames.some(n => n.startsWith('UPX')) || (epBytes[0] === 0x60 && epBytes[1] === 0xBE))
      packers.push('UPX');

    // ASPack
    if (secNames.some(n => n === '.aspack') || (epBytes[0] === 0x60 && epBytes[1] === 0xE8 && epBytes[2] === 0x03))
      packers.push('ASPack');

    // PECompact
    if (secNames.some(n => n === '.pec' || n.startsWith('PEC')))
      packers.push('PECompact');

    // MPRESS
    if (secNames.some(n => n.startsWith('.MPRESS')))
      packers.push('MPRESS');

    // FSG
    if (sections.length >= 2 && sections[0].rawDataSize === 0 && sections[1].rawDataSize > 0 && secNames.some(n => n === ''))
      if (epBytes[0] === 0x87 || epBytes[0] === 0xBE) packers.push('FSG');

    // Petite
    if (secNames.some(n => n === '.petite'))
      packers.push('Petite');

    // PECrypt32
    if (secNames.some(n => n === '.PECry'))
      packers.push('PE-Crypt32');

    // NSPack
    if (secNames.some(n => n === '.nsp0' || n === '.nsp1' || n === '.nsp2'))
      packers.push('NsPack');

    // ---- Protector detection ----
    const protectors = [];

    // Themida / WinLicense
    if (secNames.some(n => n === '.themida') || findString('THEMIDA'))
      protectors.push('Themida / WinLicense');

    // VMProtect
    if (secNames.some(n => n.startsWith('.vmp')))
      protectors.push('VMProtect');

    // Obsidium
    if (secNames.some(n => n === '.obsidium'))
      protectors.push('Obsidium');

    // Enigma Protector
    if (secNames.some(n => n === '.enigma') || findString('Enigma protector'))
      protectors.push('Enigma Protector');

    // Armadillo
    if (findString('ADATA') && findString('Silicon Realms'))
      protectors.push('Armadillo');

    // .NET obfuscators
    if (isDotNet) {
      if (findString('ConfuserEx')) protectors.push('ConfuserEx');
      else if (findString('Confuser')) protectors.push('Confuser');
      if (findString('.NETReactor') || findString('Eziriz')) protectors.push('.NET Reactor');
      if (findString('Dotfuscator')) protectors.push('Dotfuscator');
      if (findString('SmartAssembly')) protectors.push('SmartAssembly');
      if (findString('Babel Obfuscator')) protectors.push('Babel Obfuscator');
    }

    // ---- Compiler / Runtime detection ----
    const compilers = [];

    if (isDotNet) {
      if (findString('.NETCoreApp')) compilers.push('.NET Core / .NET 5+');
      else if (findString('.NETFramework')) compilers.push('.NET Framework');
      else compilers.push('.NET (CLR)');
      if (findString('F# ')) compilers.push('F#');
      if (findString('Visual Basic')) compilers.push('Visual Basic .NET');
    }

    // Go
    if (secNames.some(n => n === '.go' || n === '.gopclnt' || n === '.gosymtab') || findString('runtime.main'))
      compilers.push('Go');

    // Rust
    if (secNames.some(n => n === '.rustc') || findString('rust_begin_unwind'))
      compilers.push('Rust (rustc)');

    // Delphi / C++ Builder
    if (dllNamesLower.includes('borlndmm.dll') || findString('Embarcadero') || findString('Borland C++ -'))
      compilers.push('Delphi / C++ Builder (Embarcadero)');
    else if (findString('Object Pascal') || (secNames.includes('.idata') && secNames.includes('CODE') && secNames.includes('DATA')))
      compilers.push('Delphi (Borland)');

    // Free Pascal / Lazarus
    if (findString('Free Pascal') || findString('FPC '))
      compilers.push('Free Pascal / Lazarus');

    // GCC variants
    if (dllNamesLower.includes('cygwin1.dll')) compilers.push('GCC (Cygwin)');
    else if (dllNamesLower.some(n => n.startsWith('msys-'))) compilers.push('GCC (MSYS2)');
    else if (dllNamesLower.some(n => n.startsWith('libgcc') || n.startsWith('libstdc'))) compilers.push('GCC (MinGW)');

    // MSVC
    if (compilers.length === 0 && !isDotNet) {
      if (hasRich || dllNamesLower.some(n => n.startsWith('vcruntime') || n.startsWith('msvcp') || n.startsWith('msvcr')))
        compilers.push('Microsoft Visual C++ (MSVC)');
    }

    // ---- Installer / Framework detection ----
    const frameworks = [];

    // NSIS
    if (findString('Nullsoft Install System') || findString('NSIS '))
      frameworks.push('NSIS Installer');

    // Inno Setup
    if (findString('Inno Setup'))
      frameworks.push('Inno Setup');

    // InstallShield
    if (findString('InstallShield'))
      frameworks.push('InstallShield');

    // AutoIt
    if (findString('AutoIt') || findString('AU3!'))
      frameworks.push('AutoIt Script');

    // AutoHotkey
    if (findString('AutoHotkey'))
      frameworks.push('AutoHotkey');

    // PyInstaller
    if (findString('MEIPASS') || findString('PYZ-00.pyz') || findString('pyiboot'))
      frameworks.push('PyInstaller (Python)');

    // cx_Freeze
    if (findString('cx_Freeze'))
      frameworks.push('cx_Freeze (Python)');

    // Electron / Node.js
    if (dllNamesLower.includes('node.dll') || findString('electron.asar'))
      frameworks.push('Electron / Node.js');

    // Qt
    if (dllNamesLower.some(n => n.startsWith('qt5') || n.startsWith('qt6')))
      frameworks.push('Qt Framework');

    // wxWidgets
    if (dllNamesLower.some(n => n.startsWith('wxmsw')))
      frameworks.push('wxWidgets');

    // Java (Launch4j / JSmooth)
    if (findString('launch4j') || findString('Launch4j'))
      frameworks.push('Launch4j (Java)');
    else if (dllNamesLower.includes('jvm.dll') || findString('jvm.dll'))
      frameworks.push('Java (JNI)');

    // Build detection summary
    if (packers.length > 0)
      detFields.push({ key: 'pe.packer', label: 'Packer', value: packers.join(', ') });
    if (protectors.length > 0)
      detFields.push({ key: 'pe.protector', label: 'Protector / Obfuscator', value: protectors.join(', ') });
    if (compilers.length > 0)
      detFields.push({ key: 'pe.compiler', label: 'Compiler / Runtime', value: compilers.join(', ') });
    if (frameworks.length > 0)
      detFields.push({ key: 'pe.framework', label: 'Framework / Installer', value: frameworks.join(', ') });

    // Overlay detection (data appended after last section)
    const lastSection = sections[sections.length - 1];
    if (lastSection) {
      const imageEnd = lastSection.rawDataOffset + lastSection.rawDataSize;
      if (imageEnd < bytes.length) {
        const overlaySize = bytes.length - imageEnd;
        detFields.push({ key: 'pe.overlay', label: 'Overlay Data', value: formatSize(overlaySize) + ' appended after PE image' });
      }
    }

    // ---- ExeInfo ASL signature database matching ----
    const sigDb = (typeof SZ !== 'undefined' && SZ.PESignatures) || [];
    if (sigDb.length > 0 && epOffset > 0 && epOffset < bytes.length) {
      const matches = [];
      const EP_MAX = 128;
      const epBuf = new Uint8Array(EP_MAX);
      const epAvail = Math.min(EP_MAX, bytes.length - epOffset);
      for (let i = 0; i < epAvail; ++i) epBuf[i] = bytes[epOffset + i];
      for (const entry of sigDb) {
        const epOnly = entry.length < 3 || entry[2] !== 0;
        if (!epOnly) continue; // non-EP sigs would need full file scan — skip for performance
        const hexSig = entry[1];
        const sigLen = hexSig.length >> 1;
        if (sigLen > epAvail) continue;
        let matched = true;
        for (let i = 0; i < sigLen; ++i) {
          const h = hexSig.charCodeAt(i * 2);
          if (h === 0x3F) continue; // '?' — wildcard byte
          const hi = h <= 0x39 ? h - 0x30 : h - 0x57; // '0'-'9' or 'a'-'f'
          const lo_c = hexSig.charCodeAt(i * 2 + 1);
          const lo = lo_c <= 0x39 ? lo_c - 0x30 : lo_c - 0x57;
          if (epBuf[i] !== ((hi << 4) | lo)) { matched = false; break; }
        }
        if (matched)
          matches.push(entry[0]);
      }
      if (matches.length > 0) {
        detFields.push({ key: 'pe.sigdb', label: 'Signature Match', value: matches[0] });
        if (matches.length > 1)
          detFields.push({ key: 'pe.sigdb.alt', label: 'Alternative Matches', value: matches.slice(1, 6).join('; ') + (matches.length > 6 ? ' (+' + (matches.length - 6) + ' more)' : '') });
      }
    }

    if (detFields.length > 0)
      categories.push({ name: 'Detection', icon: 'exe', fields: detFields });

    categories.unshift({ name: 'PE Header', icon: 'exe', fields });
    return { categories, images: [], byteRegions };
  }

  // =========================================================================
  // ELF parser — sections, dynamic linking, interpreter, compiler detection
  // =========================================================================

  function parseELF(bytes) {
    const categories = [];
    const fields = [];
    const byteRegions = [];
    if (bytes.length < 52) return { categories: [{ name: 'ELF Header', icon: 'exe', fields }], images: [], byteRegions: [] };

    // ELF header regions
    byteRegions.push({ offset: 0, length: 4, label: 'ELF Magic', color: 0 });
    byteRegions.push({ offset: 4, length: 12, label: 'ELF Ident', color: 1 });
    byteRegions.push({ offset: 16, length: bytes[4] === 2 ? 48 : 36, label: 'ELF Header Fields', color: 2 });

    const elfClass = readU8(bytes, 4);
    const elfData = readU8(bytes, 5);
    const osabi = readU8(bytes, 7);
    const le = elfData === 1;
    const is64 = elfClass === 2;
    const readU16 = le ? readU16LE : readU16BE;
    const readU32 = le ? readU32LE : readU32BE;
    const readUPtr = is64 ? (le ? readU64LE : readU64BE) : readU32;

    fields.push({ key: 'elf.class', label: 'Class', value: is64 ? '64-bit' : '32-bit' });
    fields.push({ key: 'elf.endian', label: 'Byte Order', value: le ? 'Little-endian' : 'Big-endian' });

    const osabiNames = { 0: 'UNIX System V', 3: 'Linux', 6: 'Solaris', 9: 'FreeBSD', 12: 'OpenBSD' };
    fields.push({ key: 'elf.osabi', label: 'OS/ABI', value: osabiNames[osabi] || String(osabi) });

    const eType = readU16(bytes, 16);
    const typeNames = { 1: 'Relocatable', 2: 'Executable', 3: 'Shared Object', 4: 'Core Dump' };
    fields.push({ key: 'elf.type', label: 'Object Type', value: typeNames[eType] || String(eType) });

    const eMachine = readU16(bytes, 18);
    const machineNames = {
      0x03: 'x86', 0x3E: 'x86-64', 0x28: 'ARM', 0xB7: 'AArch64',
      0xF3: 'RISC-V', 0x08: 'MIPS', 0x14: 'PowerPC', 0x15: 'PowerPC64', 0x2B: 'SPARC V9',
    };
    fields.push({ key: 'elf.machine', label: 'Architecture', value: machineNames[eMachine] || '0x' + eMachine.toString(16) });

    const entryPoint = is64 ? readUPtr(bytes, 24) : readU32(bytes, 24);
    fields.push({ key: 'elf.entry', label: 'Entry Point', value: '0x' + entryPoint.toString(16).toUpperCase() });

    // Header offsets differ for 32/64-bit
    const phOff = is64 ? readUPtr(bytes, 32) : readU32(bytes, 28);
    const shOff = is64 ? readUPtr(bytes, 40) : readU32(bytes, 32);
    const phEntSize = is64 ? readU16(bytes, 54) : readU16(bytes, 42);
    const phNum = is64 ? readU16(bytes, 56) : readU16(bytes, 44);
    const shEntSize = is64 ? readU16(bytes, 58) : readU16(bytes, 46);
    const shNum = is64 ? readU16(bytes, 60) : readU16(bytes, 48);
    const shStrIdx = is64 ? readU16(bytes, 62) : readU16(bytes, 50);

    fields.push({ key: 'elf.phnum', label: 'Program Headers', value: String(phNum) });
    fields.push({ key: 'elf.shnum', label: 'Section Headers', value: String(shNum) });

    // ---- Section header string table ----
    let shStrTab = null;
    if (shStrIdx < shNum && shOff > 0) {
      const ssBase = shOff + shStrIdx * shEntSize;
      if (is64 && ssBase + 64 <= bytes.length) {
        const ssOff = readUPtr(bytes, ssBase + 24);
        const ssSize = readUPtr(bytes, ssBase + 32);
        shStrTab = { offset: ssOff, size: ssSize };
      } else if (!is64 && ssBase + 40 <= bytes.length) {
        const ssOff = readU32(bytes, ssBase + 16);
        const ssSize = readU32(bytes, ssBase + 20);
        shStrTab = { offset: ssOff, size: ssSize };
      }
    }

    function readSectionName(nameIdx) {
      if (!shStrTab || nameIdx === 0) return '';
      return readString(bytes, shStrTab.offset + nameIdx, 256);
    }

    // ---- Walk sections ----
    const sectionFields = [];
    const sectionNames = [];
    if (shOff > 0 && shNum > 0) {
      for (let i = 0; i < shNum && i < 50; ++i) {
        const sb = shOff + i * shEntSize;
        if (is64 ? sb + 64 > bytes.length : sb + 40 > bytes.length) break;
        const nameIdx = readU32(bytes, sb);
        const shType = readU32(bytes, sb + 4);
        const shSize = is64 ? readUPtr(bytes, sb + 32) : readU32(bytes, sb + 20);
        const name = readSectionName(nameIdx);
        if (!name || name === '') continue;
        sectionNames.push(name);

        const typeNames = { 1: 'PROGBITS', 2: 'SYMTAB', 3: 'STRTAB', 4: 'RELA', 5: 'HASH',
          6: 'DYNAMIC', 7: 'NOTE', 8: 'NOBITS', 9: 'REL', 11: 'DYNSYM' };
        const typeName = typeNames[shType] || '0x' + shType.toString(16);
        sectionFields.push({ key: 'elf.sec.' + i, label: name, value: formatSize(shSize) + ' (' + typeName + ')' });
      }
    }

    if (sectionFields.length > 0)
      categories.push({ name: 'Sections (' + sectionFields.length + ')', icon: 'list', fields: sectionFields });

    // ---- Program headers — find PT_INTERP and PT_DYNAMIC ----
    let interpreter = null;
    let dynamicOffset = 0, dynamicSize = 0;
    if (phOff > 0 && phNum > 0) {
      for (let i = 0; i < phNum; ++i) {
        const pb = phOff + i * phEntSize;
        if (is64 ? pb + 56 > bytes.length : pb + 32 > bytes.length) break;
        const pType = readU32(bytes, pb);

        if (pType === 3) { // PT_INTERP
          const pOff = is64 ? readUPtr(bytes, pb + 8) : readU32(bytes, pb + 4);
          const pSize = is64 ? readUPtr(bytes, pb + 32) : readU32(bytes, pb + 16);
          interpreter = readString(bytes, pOff, pSize);
        }
        if (pType === 2) { // PT_DYNAMIC
          dynamicOffset = is64 ? readUPtr(bytes, pb + 8) : readU32(bytes, pb + 4);
          dynamicSize = is64 ? readUPtr(bytes, pb + 32) : readU32(bytes, pb + 16);
        }
      }
    }

    if (interpreter)
      fields.push({ key: 'elf.interp', label: 'Interpreter', value: interpreter });

    // ---- Dynamic section — linked libraries (DT_NEEDED) ----
    if (dynamicOffset > 0 && dynamicSize > 0) {
      // Find .dynstr string table
      let dynStrOff = 0, dynStrSize = 0;
      if (shOff > 0) {
        for (let i = 0; i < shNum; ++i) {
          const sb = shOff + i * shEntSize;
          if (is64 ? sb + 64 > bytes.length : sb + 40 > bytes.length) break;
          const shType = readU32(bytes, sb + 4);
          const name = readSectionName(readU32(bytes, sb));
          if (shType === 3 && name === '.dynstr') {
            dynStrOff = is64 ? readUPtr(bytes, sb + 24) : readU32(bytes, sb + 16);
            dynStrSize = is64 ? readUPtr(bytes, sb + 32) : readU32(bytes, sb + 20);
            break;
          }
        }
      }

      if (dynStrOff > 0) {
        const libFields = [];
        const entSize = is64 ? 16 : 8;
        let pos = dynamicOffset;
        while (pos + entSize <= bytes.length && libFields.length < 50) {
          const tag = is64 ? readUPtr(bytes, pos) : readU32(bytes, pos);
          const val = is64 ? readUPtr(bytes, pos + 8) : readU32(bytes, pos + 4);
          if (tag === 0) break; // DT_NULL
          if (tag === 1) { // DT_NEEDED
            const libName = readString(bytes, dynStrOff + val, 256);
            if (libName)
              libFields.push({ key: 'elf.lib.' + libFields.length, label: libName, value: 'Shared library' });
          }
          pos += entSize;
        }
        if (libFields.length > 0)
          categories.push({ name: 'Linked Libraries (' + libFields.length + ')', icon: 'link', fields: libFields });
      }
    }

    // ---- Compiler / runtime heuristics ----
    const compilerHints = [];
    if (sectionNames.includes('.go.buildinfo') || sectionNames.includes('.gopclntab'))
      compilerHints.push('Go');
    else if (sectionNames.includes('.rustc'))
      compilerHints.push('Rust (rustc)');
    else if (interpreter && interpreter.includes('ld-musl'))
      compilerHints.push('C/C++ (musl libc)');
    else if (interpreter && interpreter.includes('ld-linux'))
      compilerHints.push('C/C++ (glibc)');

    // Scan for compiler identification strings
    const scanLen = Math.min(bytes.length, 65536);
    const scanStr = readString(bytes, 0, scanLen);
    if (scanStr.includes('GCC:'))
      compilerHints.push('GCC');
    else if (scanStr.includes('clang version'))
      compilerHints.push('Clang/LLVM');

    if (compilerHints.length > 0)
      categories.push({ name: 'Compiler / Runtime', icon: 'exe', fields: [
        { key: 'elf.compiler', label: 'Detected Compiler', value: compilerHints.join(', ') }
      ]});

    categories.unshift({ name: 'ELF Header', icon: 'exe', fields });
    return { categories, images: [], byteRegions };
  }

  // =========================================================================
  // Mach-O parser — load commands, linked libraries, compiler detection
  // =========================================================================

  function parseMachO(bytes) {
    const categories = [];
    const fields = [];
    if (bytes.length < 28) return { categories: [{ name: 'Mach-O Header', icon: 'exe', fields }], images: [] };

    const magic = readU32BE(bytes, 0);
    const reversed = magic === 0xCEFAEDFE || magic === 0xCFFAEDFE;
    const is64 = magic === 0xFEEDFACF || magic === 0xCFFAEDFE;
    const readU32M = reversed ? readU32LE : readU32BE;

    fields.push({ key: 'macho.bits', label: 'Format', value: is64 ? '64-bit' : '32-bit' });

    const cpuType = readU32M(bytes, 4);
    const cpuSubtype = readU32M(bytes, 8);
    const fileType = readU32M(bytes, 12);
    const ncmds = readU32M(bytes, 16);
    const sizeOfCmds = readU32M(bytes, 20);
    const flags = readU32M(bytes, 24);

    const cpuNames = { 7: 'x86', 12: 'ARM', 0x01000007: 'x86-64', 0x0100000C: 'ARM64' };
    fields.push({ key: 'macho.cpu', label: 'CPU Type', value: cpuNames[cpuType] || '0x' + cpuType.toString(16) });

    const fileTypeNames = { 1: 'Object', 2: 'Executable', 3: 'Fixed VM Shared Library', 4: 'Core', 5: 'Preloaded', 6: 'Dylib', 7: 'Dylinker', 8: 'Bundle' };
    fields.push({ key: 'macho.fileType', label: 'File Type', value: fileTypeNames[fileType] || String(fileType) });
    fields.push({ key: 'macho.loadCmds', label: 'Load Commands', value: String(ncmds) });

    const mflagNames = [];
    if (flags & 0x01) mflagNames.push('No Undefs');
    if (flags & 0x04) mflagNames.push('Dyldlink');
    if (flags & 0x80) mflagNames.push('Two-Level');
    if (flags & 0x200000) mflagNames.push('PIE');
    if (mflagNames.length > 0)
      fields.push({ key: 'macho.flags', label: 'Flags', value: mflagNames.join(', ') });

    // Walk load commands
    const headerSize = is64 ? 32 : 28;
    let pos = headerSize;
    const libFields = [];
    let minVersion = null;
    let sourceVersion = null;
    let uuid = null;
    const segmentFields = [];

    for (let i = 0; i < ncmds && pos + 8 <= bytes.length; ++i) {
      const cmd = readU32M(bytes, pos);
      const cmdSize = readU32M(bytes, pos + 4);
      if (cmdSize < 8 || pos + cmdSize > bytes.length) break;

      // LC_SEGMENT / LC_SEGMENT_64
      if (cmd === 0x01 || cmd === 0x19) {
        const segName = readString(bytes, pos + 8, 16);
        const segSize = cmd === 0x19 ? readU64LE(bytes, pos + 48) : readU32M(bytes, pos + 36);
        if (segName)
          segmentFields.push({ key: 'macho.seg.' + segmentFields.length, label: segName, value: formatSize(segSize) });
      }

      // LC_LOAD_DYLIB (0x0C), LC_LOAD_WEAK_DYLIB (0x80000018), LC_REEXPORT_DYLIB (0x1F)
      if (cmd === 0x0C || cmd === 0x80000018 || cmd === 0x1F) {
        const nameOffset = readU32M(bytes, pos + 8);
        const libName = readString(bytes, pos + nameOffset, cmdSize - nameOffset);
        const kind = cmd === 0x0C ? 'Dynamic Library' : cmd === 0x80000018 ? 'Weak Library' : 'Re-export';
        if (libName)
          libFields.push({ key: 'macho.lib.' + libFields.length, label: libName, value: kind });
      }

      // LC_VERSION_MIN_MACOSX (0x24) / LC_BUILD_VERSION (0x32)
      if (cmd === 0x24 && pos + 12 <= bytes.length) {
        const ver = readU32M(bytes, pos + 8);
        minVersion = ((ver >> 16) & 0xFF) + '.' + ((ver >> 8) & 0xFF) + '.' + (ver & 0xFF);
      }
      if (cmd === 0x32 && pos + 16 <= bytes.length) {
        const platform = readU32M(bytes, pos + 8);
        const minos = readU32M(bytes, pos + 12);
        const platNames = { 1: 'macOS', 2: 'iOS', 3: 'tvOS', 4: 'watchOS', 5: 'bridgeOS', 6: 'Mac Catalyst', 7: 'iOS Simulator' };
        const ver = ((minos >> 16) & 0xFFFF) + '.' + ((minos >> 8) & 0xFF) + '.' + (minos & 0xFF);
        minVersion = (platNames[platform] || 'Platform ' + platform) + ' ' + ver;
      }

      // LC_SOURCE_VERSION (0x2A)
      if (cmd === 0x2A && pos + 16 <= bytes.length) {
        const sv = readU64LE(bytes, pos + 8);
        sourceVersion = String(sv);
      }

      // LC_UUID (0x1B)
      if (cmd === 0x1B && pos + 24 <= bytes.length) {
        uuid = bytesToHex(bytes, pos + 8, 16).replace(/ /g, '');
        uuid = uuid.substring(0, 8) + '-' + uuid.substring(8, 12) + '-' + uuid.substring(12, 16) + '-' + uuid.substring(16, 20) + '-' + uuid.substring(20);
      }

      pos += cmdSize;
    }

    if (minVersion) fields.push({ key: 'macho.minVer', label: 'Minimum Version', value: minVersion });
    if (uuid) fields.push({ key: 'macho.uuid', label: 'UUID', value: uuid });

    categories.push({ name: 'Mach-O Header', icon: 'exe', fields });

    if (segmentFields.length > 0)
      categories.push({ name: 'Segments (' + segmentFields.length + ')', icon: 'list', fields: segmentFields });

    if (libFields.length > 0)
      categories.push({ name: 'Linked Libraries (' + libFields.length + ')', icon: 'link', fields: libFields });

    // Compiler heuristics
    const compilerHints = [];
    const libNamesJoined = libFields.map(f => f.label).join(' ');
    if (libNamesJoined.includes('libswiftCore'))
      compilerHints.push('Swift');
    else if (libNamesJoined.includes('libobjc'))
      compilerHints.push('Objective-C');
    const scanStr = readString(bytes, 0, Math.min(bytes.length, 65536));
    if (scanStr.includes('clang version') || scanStr.includes('Apple clang'))
      compilerHints.push('Apple Clang/LLVM');
    else if (scanStr.includes('rustc'))
      compilerHints.push('Rust (rustc)');

    if (compilerHints.length > 0)
      categories.push({ name: 'Compiler / Runtime', icon: 'exe', fields: [
        { key: 'macho.compiler', label: 'Detected Compiler', value: compilerHints.join(', ') }
      ]});

    return { categories, images: [] };
  }

  // =========================================================================
  // Java .class parser
  // =========================================================================

  function parseJavaClass(bytes) {
    const fields = [];
    if (bytes.length < 10) return { categories: [{ name: 'Java Class', icon: 'exe', fields }], images: [] };

    const minor = readU16BE(bytes, 4);
    const major = readU16BE(bytes, 6);
    const javaVersionMap = {
      45: '1.1', 46: '1.2', 47: '1.3', 48: '1.4', 49: '5', 50: '6', 51: '7', 52: '8',
      53: '9', 54: '10', 55: '11', 56: '12', 57: '13', 58: '14', 59: '15', 60: '16',
      61: '17', 62: '18', 63: '19', 64: '20', 65: '21', 66: '22', 67: '23', 68: '24',
    };

    fields.push({ key: 'class.version', label: 'Class File Version', value: major + '.' + minor });
    fields.push({ key: 'class.java', label: 'Java Version', value: 'Java ' + (javaVersionMap[major] || '?') });

    const cpCount = readU16BE(bytes, 8);
    fields.push({ key: 'class.cpCount', label: 'Constant Pool Entries', value: String(cpCount - 1) });

    // Walk constant pool to find class name
    let cpOffset = 10;
    const cpEntries = [null]; // 1-indexed
    for (let i = 1; i < cpCount && cpOffset < bytes.length; ++i) {
      const tag = readU8(bytes, cpOffset);
      cpEntries[i] = { tag, offset: cpOffset };
      ++cpOffset;
      switch (tag) {
        case 1: { const len = readU16BE(bytes, cpOffset); cpEntries[i].value = readUTF8(bytes, cpOffset + 2, len); cpOffset += 2 + len; break; }
        case 3: case 4: cpOffset += 4; break;
        case 5: case 6: cpOffset += 8; ++i; cpEntries.push(null); break;
        case 7: case 8: case 16: case 19: case 20: cpOffset += 2; break;
        case 9: case 10: case 11: case 12: case 17: case 18: cpOffset += 4; break;
        case 15: cpOffset += 3; break;
        default: cpOffset = bytes.length; break;
      }
    }

    if (cpOffset + 6 <= bytes.length) {
      const accessFlags = readU16BE(bytes, cpOffset);
      const thisClassIdx = readU16BE(bytes, cpOffset + 2);
      const superClassIdx = readU16BE(bytes, cpOffset + 4);

      function resolveClassName(idx) {
        if (!cpEntries[idx] || cpEntries[idx].tag !== 7) return '?';
        const nameIdx = readU16BE(bytes, cpEntries[idx].offset + 1);
        if (!cpEntries[nameIdx] || cpEntries[nameIdx].tag !== 1) return '?';
        return cpEntries[nameIdx].value.replace(/\//g, '.');
      }

      const className = resolveClassName(thisClassIdx);
      const superName = resolveClassName(superClassIdx);
      if (className !== '?') fields.push({ key: 'class.name', label: 'Class Name', value: className });
      if (superName !== '?' && superName !== 'java.lang.Object') fields.push({ key: 'class.super', label: 'Superclass', value: superName });

      const flagNames = [];
      if (accessFlags & 0x0001) flagNames.push('public');
      if (accessFlags & 0x0010) flagNames.push('final');
      if (accessFlags & 0x0200) flagNames.push('interface');
      if (accessFlags & 0x0400) flagNames.push('abstract');
      if (accessFlags & 0x1000) flagNames.push('synthetic');
      if (accessFlags & 0x2000) flagNames.push('annotation');
      if (accessFlags & 0x4000) flagNames.push('enum');
      if (flagNames.length > 0) fields.push({ key: 'class.flags', label: 'Access Flags', value: flagNames.join(', ') });
    }

    return { categories: [{ name: 'Java Class', icon: 'exe', fields }], images: [] };
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

    // Count frames
    let frameCount = 0;
    let pos = 13 + (hasGCT ? gctSize * 3 : 0);
    while (pos < bytes.length) {
      const block = readU8(bytes, pos);
      if (block === 0x3B) break; // trailer
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

    const fileSize = readU32LE(bytes, 2);
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
  // FLAC parser
  // =========================================================================

  function parseFLAC(bytes) {
    const categories = [];
    const images = [];
    const audioFields = [];

    let pos = 4; // skip magic
    while (pos < bytes.length) {
      const header = readU8(bytes, pos);
      const isLast = (header & 0x80) !== 0;
      const blockType = header & 0x7F;
      const blockLen = (readU8(bytes, pos + 1) << 16) | (readU8(bytes, pos + 2) << 8) | readU8(bytes, pos + 3);
      const blockData = pos + 4;

      // STREAMINFO
      if (blockType === 0 && blockLen >= 34) {
        const minBlock = readU16BE(bytes, blockData);
        const maxBlock = readU16BE(bytes, blockData + 2);
        const sampleRate = (readU8(bytes, blockData + 10) << 12) | (readU8(bytes, blockData + 11) << 4) | (readU8(bytes, blockData + 12) >> 4);
        const channels = ((readU8(bytes, blockData + 12) >> 1) & 0x07) + 1;
        const bitsPerSample = ((readU8(bytes, blockData + 12) & 0x01) << 4) | (readU8(bytes, blockData + 13) >> 4) + 1;
        const totalSamples = ((readU8(bytes, blockData + 13) & 0x0F) * 0x100000000) +
          readU32BE(bytes, blockData + 14);

        audioFields.push({ key: 'flac.sampleRate', label: 'Sample Rate', value: sampleRate + ' Hz' });
        audioFields.push({ key: 'flac.channels', label: 'Channels', value: String(channels) });
        audioFields.push({ key: 'flac.bitsPerSample', label: 'Bits Per Sample', value: String(bitsPerSample) });
        if (totalSamples > 0 && sampleRate > 0) {
          const durationSec = Math.floor(totalSamples / sampleRate);
          const min = Math.floor(durationSec / 60);
          const sec = durationSec % 60;
          audioFields.push({ key: 'flac.duration', label: 'Duration', value: min + ':' + String(sec).padStart(2, '0') });
        }
      }

      // VORBIS_COMMENT
      if (blockType === 4 && blockLen > 4) {
        const commentFields = [];
        const vendorLen = readU32LE(bytes, blockData);
        const vendor = readUTF8(bytes, blockData + 4, vendorLen);
        commentFields.push({ key: 'flac.vendor', label: 'Encoder', value: vendor });
        let cPos = blockData + 4 + vendorLen;
        if (cPos + 4 <= blockData + blockLen) {
          const numComments = readU32LE(bytes, cPos);
          cPos += 4;
          for (let i = 0; i < numComments && cPos + 4 <= blockData + blockLen; ++i) {
            const cLen = readU32LE(bytes, cPos);
            cPos += 4;
            const comment = readUTF8(bytes, cPos, cLen);
            cPos += cLen;
            const eq = comment.indexOf('=');
            if (eq > 0) {
              const key = comment.substring(0, eq).toUpperCase();
              const val = comment.substring(eq + 1);
              commentFields.push({ key: 'flac.tag.' + key, label: key.charAt(0) + key.substring(1).toLowerCase(), value: val });
            }
          }
        }
        if (commentFields.length > 0)
          categories.push({ name: 'Vorbis Comments', icon: 'music', fields: commentFields });
      }

      // PICTURE
      if (blockType === 6 && blockLen > 32) {
        let pPos = blockData;
        pPos += 4; // picture type
        const mimeLen = readU32BE(bytes, pPos); pPos += 4;
        const mime = readUTF8(bytes, pPos, mimeLen); pPos += mimeLen;
        const descLen = readU32BE(bytes, pPos); pPos += 4;
        pPos += descLen; // skip description
        pPos += 16; // skip width, height, depth, colors
        const dataLen = readU32BE(bytes, pPos); pPos += 4;
        if (pPos + dataLen <= bytes.length) {
          const imgBytes = bytes.slice(pPos, pPos + dataLen);
          images.push({ label: 'Cover Art', mimeType: mime || 'image/jpeg', dataUrl: bytesToDataUrl(imgBytes, mime || 'image/jpeg') });
        }
      }

      pos = blockData + blockLen;
      if (isLast) break;
    }

    if (audioFields.length > 0)
      categories.push({ name: 'Audio', icon: 'audio', fields: audioFields });

    return { categories, images };
  }

  // =========================================================================
  // WAV parser
  // =========================================================================

  function parseWAV(bytes) {
    const fields = [];
    if (bytes.length < 44) return { categories: [{ name: 'Audio', icon: 'audio', fields }], images: [] };

    const fileSize = readU32LE(bytes, 4);

    // Walk RIFF chunks
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const chunkId = readString(bytes, pos, 4);
      const chunkSize = readU32LE(bytes, pos + 4);
      const chunkData = pos + 8;

      if (chunkId === 'fmt ' && chunkSize >= 16) {
        const format = readU16LE(bytes, chunkData);
        const channels = readU16LE(bytes, chunkData + 2);
        const sampleRate = readU32LE(bytes, chunkData + 4);
        const byteRate = readU32LE(bytes, chunkData + 8);
        const bitsPerSample = readU16LE(bytes, chunkData + 14);

        const formatNames = { 1: 'PCM', 3: 'IEEE Float', 6: 'A-law', 7: 'mu-law', 0xFFFE: 'Extensible' };
        fields.push({ key: 'wav.format', label: 'Format', value: formatNames[format] || String(format) });
        fields.push({ key: 'wav.channels', label: 'Channels', value: String(channels) });
        fields.push({ key: 'wav.sampleRate', label: 'Sample Rate', value: sampleRate + ' Hz' });
        fields.push({ key: 'wav.bitsPerSample', label: 'Bits Per Sample', value: String(bitsPerSample) });
        fields.push({ key: 'wav.bitrate', label: 'Bitrate', value: Math.round(byteRate * 8 / 1000) + ' kbps' });
      }

      if (chunkId === 'data') {
        const dataSize = chunkSize;
        const fmtChunkData = 12; // back reference to fmt
        const sampleRate = readU32LE(bytes, fmtChunkData + 12); // crude
        const byteRate = readU32LE(bytes, fmtChunkData + 16);
        if (byteRate > 0) {
          const durationSec = Math.floor(dataSize / byteRate);
          const min = Math.floor(durationSec / 60);
          const sec = durationSec % 60;
          fields.push({ key: 'wav.duration', label: 'Duration', value: min + ':' + String(sec).padStart(2, '0') });
        }
      }

      pos = chunkData + chunkSize + (chunkSize & 1); // align to word
    }

    return { categories: [{ name: 'Audio', icon: 'audio', fields }], images: [] };
  }

  // =========================================================================
  // OGG parser
  // =========================================================================

  function parseOGG(bytes) {
    const fields = [];
    if (bytes.length < 58) return { categories: [{ name: 'Audio', icon: 'audio', fields }], images: [] };

    // First page header
    const version = readU8(bytes, 4);
    const granulePos = readU64LE(bytes, 6);
    const segments = readU8(bytes, 26);
    let dataStart = 27;
    let payloadSize = 0;
    for (let i = 0; i < segments && dataStart + i < bytes.length; ++i) {
      payloadSize += readU8(bytes, dataStart + i);
    }
    dataStart += segments;

    // Check for Vorbis identification header
    if (dataStart + 30 <= bytes.length && matchBytes(bytes, dataStart, [0x01, 0x76, 0x6F, 0x72, 0x62, 0x69, 0x73])) {
      const channels = readU8(bytes, dataStart + 11);
      const sampleRate = readU32LE(bytes, dataStart + 12);
      const maxBitrate = readI32LE(bytes, dataStart + 16);
      const nomBitrate = readI32LE(bytes, dataStart + 20);
      const minBitrate = readI32LE(bytes, dataStart + 24);

      fields.push({ key: 'ogg.codec', label: 'Codec', value: 'Vorbis' });
      fields.push({ key: 'ogg.channels', label: 'Channels', value: String(channels) });
      fields.push({ key: 'ogg.sampleRate', label: 'Sample Rate', value: sampleRate + ' Hz' });
      if (nomBitrate > 0) fields.push({ key: 'ogg.bitrate', label: 'Nominal Bitrate', value: Math.round(nomBitrate / 1000) + ' kbps' });
    }

    return { categories: [{ name: 'Audio', icon: 'audio', fields }], images: [] };
  }

  // =========================================================================
  // MP4 / ISO BMFF parser
  // =========================================================================

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

  // =========================================================================
  // PDF parser
  // =========================================================================

  function parsePDF(bytes) {
    const fields = [];
    const headerLine = readString(bytes, 0, 20);
    const versionMatch = headerLine.match(/%PDF-(\d+\.\d+)/);
    if (versionMatch) fields.push({ key: 'pdf.version', label: 'PDF Version', value: versionMatch[1] });

    // Scan for Info dictionary and page count
    const text = readString(bytes, 0, Math.min(bytes.length, 65536));

    const infoPatterns = [
      { key: 'pdf.title', label: 'Title', rx: /\/Title\s*\(([^)]*)\)/ },
      { key: 'pdf.author', label: 'Author', rx: /\/Author\s*\(([^)]*)\)/ },
      { key: 'pdf.subject', label: 'Subject', rx: /\/Subject\s*\(([^)]*)\)/ },
      { key: 'pdf.creator', label: 'Creator', rx: /\/Creator\s*\(([^)]*)\)/ },
      { key: 'pdf.producer', label: 'Producer', rx: /\/Producer\s*\(([^)]*)\)/ },
      { key: 'pdf.keywords', label: 'Keywords', rx: /\/Keywords\s*\(([^)]*)\)/ },
    ];

    for (const pat of infoPatterns) {
      const m = text.match(pat.rx);
      if (m && m[1].trim()) fields.push({ key: pat.key, label: pat.label, value: m[1].trim() });
    }

    // Count pages
    const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
    if (pageMatches)
      fields.push({ key: 'pdf.pages', label: 'Pages', value: String(pageMatches.length) });

    // Encryption
    if (text.includes('/Encrypt'))
      fields.push({ key: 'pdf.encrypted', label: 'Encrypted', value: 'Yes' });

    return { categories: [{ name: 'PDF', icon: 'document', fields }], images: [] };
  }

  // =========================================================================
  // ZIP parser
  // =========================================================================

  function parseZIP(bytes) {
    const fields = [];
    const byteRegions = [];
    let entryCount = 0;
    let totalUncompressed = 0;
    let totalCompressed = 0;
    const fileNames = [];

    // Local file header signature at start
    if (bytes.length >= 4 && readU32LE(bytes, 0) === 0x04034B50)
      byteRegions.push({ offset: 0, length: 4, label: 'Local File Header Signature', color: 0 });

    // Try to find the End of Central Directory
    let eocdPos = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); --i) {
      if (readU32LE(bytes, i) === 0x06054B50) { eocdPos = i; break; }
    }

    if (eocdPos >= 0) {
      byteRegions.push({ offset: eocdPos, length: 22, label: 'End of Central Directory', color: 1 });

      entryCount = readU16LE(bytes, eocdPos + 10);
      const cdSize = readU32LE(bytes, eocdPos + 12);
      const cdOffset = readU32LE(bytes, eocdPos + 16);
      const comment = readString(bytes, eocdPos + 22, readU16LE(bytes, eocdPos + 20));

      if (cdOffset < bytes.length)
        byteRegions.push({ offset: cdOffset, length: Math.min(cdSize, 256), label: 'Central Directory', color: 3 });

      fields.push({ key: 'zip.entries', label: 'Entries', value: String(entryCount) });
      if (comment) fields.push({ key: 'zip.comment', label: 'Comment', value: comment });

      // Walk central directory
      let pos = cdOffset;
      for (let i = 0; i < entryCount && pos + 46 <= bytes.length; ++i) {
        if (readU32LE(bytes, pos) !== 0x02014B50) break;
        const method = readU16LE(bytes, pos + 10);
        const compSize = readU32LE(bytes, pos + 20);
        const uncompSize = readU32LE(bytes, pos + 24);
        const nameLen = readU16LE(bytes, pos + 28);
        const extraLen = readU16LE(bytes, pos + 30);
        const commentLen = readU16LE(bytes, pos + 32);
        const name = readUTF8(bytes, pos + 46, nameLen);
        fileNames.push(name);
        totalCompressed += compSize;
        totalUncompressed += uncompSize;
        pos += 46 + nameLen + extraLen + commentLen;
      }

      fields.push({ key: 'zip.compressedSize', label: 'Compressed Size', value: formatSize(totalCompressed) });
      fields.push({ key: 'zip.uncompressedSize', label: 'Uncompressed Size', value: formatSize(totalUncompressed) });
      if (totalUncompressed > 0)
        fields.push({ key: 'zip.ratio', label: 'Compression Ratio', value: Math.round((1 - totalCompressed / totalUncompressed) * 100) + '%' });
      if (fileNames.length > 0)
        fields.push({ key: 'zip.files', label: 'Files (first 10)', value: fileNames.slice(0, 10).join('\n') + (fileNames.length > 10 ? '\n...' : '') });
    } else {
      fields.push({ key: 'zip.note', label: 'Note', value: 'Could not locate End of Central Directory' });
    }

    return { categories: [{ name: 'ZIP Archive', icon: 'archive', fields }], images: [], byteRegions };
  }

  // =========================================================================
  // TTF/OTF font parser
  // =========================================================================

  function parseFont(bytes) {
    const fields = [];
    if (bytes.length < 12) return { categories: [{ name: 'Font', icon: 'font', fields }], images: [] };

    const numTables = readU16BE(bytes, 4);
    fields.push({ key: 'font.tables', label: 'Tables', value: String(numTables) });

    // Find name table
    let nameTableOffset = 0, nameTableLength = 0;
    let headTableOffset = 0;
    let os2TableOffset = 0;
    for (let i = 0; i < numTables; ++i) {
      const tableBase = 12 + i * 16;
      if (tableBase + 16 > bytes.length) break;
      const tag = readString(bytes, tableBase, 4);
      const offset = readU32BE(bytes, tableBase + 8);
      const length = readU32BE(bytes, tableBase + 12);
      if (tag === 'name') { nameTableOffset = offset; nameTableLength = length; }
      if (tag === 'head') headTableOffset = offset;
      if (tag === 'OS/2') os2TableOffset = offset;
    }

    // Parse name table
    if (nameTableOffset > 0 && nameTableOffset + 6 <= bytes.length) {
      const nameCount = readU16BE(bytes, nameTableOffset + 2);
      const stringOffset = readU16BE(bytes, nameTableOffset + 4);
      const nameIds = { 0: 'Copyright', 1: 'Font Family', 2: 'Font Subfamily', 4: 'Full Name', 5: 'Version', 6: 'PostScript Name' };

      for (let i = 0; i < nameCount; ++i) {
        const recBase = nameTableOffset + 6 + i * 12;
        if (recBase + 12 > bytes.length) break;
        const platformId = readU16BE(bytes, recBase);
        const nameId = readU16BE(bytes, recBase + 6);
        const strLength = readU16BE(bytes, recBase + 8);
        const strOffset = readU16BE(bytes, recBase + 10);

        if (nameIds[nameId] && (platformId === 1 || platformId === 3)) {
          const absOffset = nameTableOffset + stringOffset + strOffset;
          let text;
          if (platformId === 3)
            text = readUTF16(bytes, absOffset, strLength, false);
          else
            text = readString(bytes, absOffset, strLength);
          if (text && !fields.some(f => f.key === 'font.name.' + nameId))
            fields.push({ key: 'font.name.' + nameId, label: nameIds[nameId], value: text });
        }
      }
    }

    // Parse head table
    if (headTableOffset > 0 && headTableOffset + 54 <= bytes.length) {
      const unitsPerEm = readU16BE(bytes, headTableOffset + 18);
      fields.push({ key: 'font.unitsPerEm', label: 'Units Per Em', value: String(unitsPerEm) });
    }

    // Parse OS/2 table
    if (os2TableOffset > 0 && os2TableOffset + 8 <= bytes.length) {
      const weightClass = readU16BE(bytes, os2TableOffset + 4);
      const widthClass = readU16BE(bytes, os2TableOffset + 6);
      const weightNames = { 100: 'Thin', 200: 'Extra Light', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semi Bold', 700: 'Bold', 800: 'Extra Bold', 900: 'Black' };
      fields.push({ key: 'font.weight', label: 'Weight', value: weightNames[weightClass] || String(weightClass) });
    }

    return { categories: [{ name: 'Font', icon: 'font', fields }], images: [] };
  }

  // =========================================================================
  // ICO parser
  // =========================================================================

  function parseICO(bytes) {
    const fields = [];
    if (bytes.length < 6) return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };

    const type = readU16LE(bytes, 2);
    const count = readU16LE(bytes, 4);
    fields.push({ key: 'ico.type', label: 'Type', value: type === 1 ? 'Icon' : type === 2 ? 'Cursor' : String(type) });
    fields.push({ key: 'ico.count', label: 'Images', value: String(count) });

    for (let i = 0; i < count && 6 + (i + 1) * 16 <= bytes.length; ++i) {
      const entryBase = 6 + i * 16;
      const w = readU8(bytes, entryBase) || 256;
      const h = readU8(bytes, entryBase + 1) || 256;
      const colors = readU8(bytes, entryBase + 2);
      const bpp = readU16LE(bytes, entryBase + 6);
      const size = readU32LE(bytes, entryBase + 8);
      fields.push({ key: 'ico.image.' + i, label: 'Image ' + (i + 1), value: w + 'x' + h + ', ' + bpp + ' bpp, ' + formatSize(size) });
    }

    return { categories: [{ name: 'Image', icon: 'image', fields }], images: [] };
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

    // RIFF..WEBP, then VP8 chunk
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const chunkId = readString(bytes, pos, 4);
      const chunkSize = readU32LE(bytes, pos + 4);
      const chunkData = pos + 8;

      if (chunkId === 'VP8 ' && chunkSize >= 10) {
        // Lossy VP8 — frame header starts after 3-byte frame tag
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
      const count = readU32(bytes, base + 4);

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

  // =========================================================================
  // OOXML (Office) parser — reads metadata from ZIP local file entries
  // =========================================================================

  function parseOOXML(bytes) {
    const categories = [];
    const archiveFields = [];

    // Walk ZIP local file headers to find core.xml and app.xml
    let pos = 0;
    const fileEntries = [];
    while (pos + 30 <= bytes.length && fileEntries.length < 200) {
      if (readU32LE(bytes, pos) !== 0x04034B50) break;
      const method = readU16LE(bytes, pos + 8);
      const compSize = readU32LE(bytes, pos + 18);
      const uncompSize = readU32LE(bytes, pos + 22);
      const nameLen = readU16LE(bytes, pos + 26);
      const extraLen = readU16LE(bytes, pos + 28);
      const name = readUTF8(bytes, pos + 30, nameLen);
      const dataStart = pos + 30 + nameLen + extraLen;
      fileEntries.push({ name, method, compSize, uncompSize, dataStart });
      pos = dataStart + compSize;
    }

    archiveFields.push({ key: 'ooxml.files', label: 'Files in Archive', value: String(fileEntries.length) });

    // Classify document type from filenames
    const names = fileEntries.map(e => e.name);
    if (names.some(n => n.startsWith('word/')))
      archiveFields.push({ key: 'ooxml.type', label: 'Document Type', value: 'Word Document' });
    else if (names.some(n => n.startsWith('xl/')))
      archiveFields.push({ key: 'ooxml.type', label: 'Document Type', value: 'Excel Spreadsheet' });
    else if (names.some(n => n.startsWith('ppt/')))
      archiveFields.push({ key: 'ooxml.type', label: 'Document Type', value: 'PowerPoint Presentation' });

    categories.push({ name: 'Archive', icon: 'archive', fields: archiveFields });

    // Try to read docProps/core.xml (Dublin Core metadata)
    const coreEntry = fileEntries.find(e => e.name === 'docProps/core.xml');
    if (coreEntry && coreEntry.method === 0 && coreEntry.uncompSize > 0) {
      const xml = readUTF8(bytes, coreEntry.dataStart, coreEntry.uncompSize);
      const metaFields = parseOOXMLCoreXml(xml, true);
      if (metaFields.length > 0)
        categories.push({ name: 'Document Properties', icon: 'document', fields: metaFields });
    } else if (coreEntry && coreEntry.method !== 0) {
      // DEFLATE compressed — try to parse via simple regex on raw data
      const rawSample = readString(bytes, coreEntry.dataStart, Math.min(coreEntry.compSize, 4096));
      // Cannot decompress without inflate; show note
      categories.push({ name: 'Document Properties', icon: 'document', fields: [
        { key: 'ooxml.note', label: 'Note', value: 'Metadata is compressed (DEFLATE); full parsing requires decompression' }
      ]});
    }

    // Try to read docProps/app.xml
    const appEntry = fileEntries.find(e => e.name === 'docProps/app.xml');
    if (appEntry && appEntry.method === 0 && appEntry.uncompSize > 0) {
      const xml = readUTF8(bytes, appEntry.dataStart, appEntry.uncompSize);
      const appFields = parseOOXMLAppXml(xml);
      if (appFields.length > 0)
        categories.push({ name: 'Application Properties', icon: 'info', fields: appFields });
    }

    return { categories, images: [] };
  }

  function parseOOXMLCoreXml(xml, editable) {
    const fields = [];
    const patterns = [
      { key: 'ooxml.title', label: 'Title', rx: /<dc:title>([^<]*)<\/dc:title>/i },
      { key: 'ooxml.subject', label: 'Subject', rx: /<dc:subject>([^<]*)<\/dc:subject>/i },
      { key: 'ooxml.creator', label: 'Author', rx: /<dc:creator>([^<]*)<\/dc:creator>/i },
      { key: 'ooxml.keywords', label: 'Keywords', rx: /<cp:keywords>([^<]*)<\/cp:keywords>/i },
      { key: 'ooxml.description', label: 'Description', rx: /<dc:description>([^<]*)<\/dc:description>/i },
      { key: 'ooxml.lastModifiedBy', label: 'Last Modified By', rx: /<cp:lastModifiedBy>([^<]*)<\/cp:lastModifiedBy>/i },
      { key: 'ooxml.revision', label: 'Revision', rx: /<cp:revision>([^<]*)<\/cp:revision>/i },
      { key: 'ooxml.created', label: 'Created', rx: /<dcterms:created[^>]*>([^<]*)<\/dcterms:created>/i },
      { key: 'ooxml.modified', label: 'Modified', rx: /<dcterms:modified[^>]*>([^<]*)<\/dcterms:modified>/i },
      { key: 'ooxml.category', label: 'Category', rx: /<cp:category>([^<]*)<\/cp:category>/i },
    ];
    for (const pat of patterns) {
      const m = xml.match(pat.rx);
      if (m && m[1].trim()) {
        const isEditable = editable && ['ooxml.title', 'ooxml.subject', 'ooxml.creator', 'ooxml.keywords', 'ooxml.description', 'ooxml.category'].includes(pat.key);
        fields.push({ key: pat.key, label: pat.label, value: m[1].trim(), editable: isEditable, editType: isEditable ? 'text' : undefined });
      }
    }
    return fields;
  }

  function parseOOXMLAppXml(xml) {
    const fields = [];
    const patterns = [
      { key: 'ooxml.app', label: 'Application', rx: /<Application>([^<]*)<\/Application>/i },
      { key: 'ooxml.appVer', label: 'App Version', rx: /<AppVersion>([^<]*)<\/AppVersion>/i },
      { key: 'ooxml.company', label: 'Company', rx: /<Company>([^<]*)<\/Company>/i },
      { key: 'ooxml.pages', label: 'Pages', rx: /<Pages>([^<]*)<\/Pages>/i },
      { key: 'ooxml.words', label: 'Words', rx: /<Words>([^<]*)<\/Words>/i },
      { key: 'ooxml.chars', label: 'Characters', rx: /<Characters>([^<]*)<\/Characters>/i },
      { key: 'ooxml.slides', label: 'Slides', rx: /<Slides>([^<]*)<\/Slides>/i },
      { key: 'ooxml.sheets', label: 'Sheets', rx: /<Sheets>([^<]*)<\/Sheets>/i },
    ];
    for (const pat of patterns) {
      const m = xml.match(pat.rx);
      if (m && m[1].trim())
        fields.push({ key: pat.key, label: pat.label, value: m[1].trim() });
    }
    return fields;
  }

  // =========================================================================
  // =========================================================================
  // OLE2 Compound Document parser (legacy .doc, .xls, .ppt)
  // =========================================================================

  function parseOLE2(bytes) {
    const categories = [];
    const fields = [];

    if (bytes.length < 512) return { categories: [{ name: 'OLE2', icon: 'document', fields }], images: [] };

    // OLE2 header
    const sectorSize = 1 << readU16LE(bytes, 30);
    const miniSectorSize = 1 << readU16LE(bytes, 32);
    const fatSectors = readU32LE(bytes, 44);
    const firstDirSector = readU32LE(bytes, 48);
    const firstMiniFATSector = readU32LE(bytes, 60);
    const firstDIFATSector = readU32LE(bytes, 68);

    fields.push({ key: 'ole2.sectorSize', label: 'Sector Size', value: sectorSize + ' bytes' });

    // Read FAT (for sector chain traversal)
    const fat = [];
    for (let i = 0; i < 109 && i < fatSectors; ++i) {
      const fatSecId = readU32LE(bytes, 76 + i * 4);
      if (fatSecId === 0xFFFFFFFE || fatSecId === 0xFFFFFFFF) break;
      const fatOffset = (fatSecId + 1) * sectorSize;
      for (let j = 0; j < sectorSize / 4 && fatOffset + j * 4 + 4 <= bytes.length; ++j)
        fat.push(readU32LE(bytes, fatOffset + j * 4));
    }

    // Read directory entries by following sector chain from firstDirSector
    function readSectorChain(startSector, maxSize) {
      const chunks = [];
      let sec = startSector;
      let total = 0;
      while (sec !== 0xFFFFFFFE && sec !== 0xFFFFFFFF && sec < fat.length && total < maxSize) {
        const offset = (sec + 1) * sectorSize;
        if (offset + sectorSize > bytes.length) break;
        chunks.push(bytes.subarray(offset, offset + sectorSize));
        total += sectorSize;
        sec = fat[sec];
      }
      if (chunks.length === 0) return new Uint8Array(0);
      const result = new Uint8Array(total);
      let wp = 0;
      for (const c of chunks) { result.set(c, wp); wp += c.length; }
      return result;
    }

    const dirData = readSectorChain(firstDirSector, 65536);
    const dirEntries = [];
    for (let i = 0; i + 128 <= dirData.length; ++i) {
      const entryBase = i * 128;
      if (entryBase + 128 > dirData.length) break;
      const nameLen = readU16LE(dirData, entryBase + 64);
      if (nameLen === 0) continue;
      const entryName = readUTF16(dirData, entryBase, Math.min(nameLen, 64), true).replace(/\0+$/, '');
      const entryType = dirData[entryBase + 66]; // 1=storage, 2=stream, 5=root
      const entrySize = readU32LE(dirData, entryBase + 120);
      const startSec = readU32LE(dirData, entryBase + 116);
      dirEntries.push({ name: entryName, type: entryType, size: entrySize, startSector: startSec });
    }

    // Determine document type from directory entries
    const entryNames = dirEntries.map(e => e.name);
    let docType = 'Unknown';
    let specificId = 'ole2';
    if (entryNames.some(n => n === 'WordDocument' || n === '1Table' || n === '0Table')) {
      docType = 'Microsoft Word Document (.doc)';
      specificId = 'doc';
    } else if (entryNames.some(n => n === 'Workbook' || n === 'Book')) {
      docType = 'Microsoft Excel Spreadsheet (.xls)';
      specificId = 'xls';
    } else if (entryNames.some(n => n === 'PowerPoint Document' || n === 'Current User')) {
      docType = 'Microsoft PowerPoint Presentation (.ppt)';
      specificId = 'ppt';
    } else if (entryNames.some(n => n === 'VisioDocument')) {
      docType = 'Microsoft Visio Drawing (.vsd)';
    } else if (entryNames.some(n => n.includes('MSO'))) {
      docType = 'Microsoft Office Document';
    }

    fields.push({ key: 'ole2.docType', label: 'Document Type', value: docType });
    fields.push({ key: 'ole2.streams', label: 'Streams', value: String(dirEntries.filter(e => e.type === 2).length) });
    fields.push({ key: 'ole2.storages', label: 'Storages', value: String(dirEntries.filter(e => e.type === 1).length) });

    // List directory entries
    const entryList = dirEntries.filter(e => e.type === 2).slice(0, 20);
    if (entryList.length > 0)
      fields.push({ key: 'ole2.entries', label: 'Streams (first 20)', value: entryList.map(e => e.name + ' (' + formatSize(e.size) + ')').join('\n') });

    categories.push({ name: 'Document', icon: 'document', fields });

    // Try to parse SummaryInformation stream for document properties
    const summaryEntry = dirEntries.find(e => e.name === '\x05SummaryInformation' || e.name === 'SummaryInformation');
    if (summaryEntry && summaryEntry.startSector !== 0xFFFFFFFE) {
      const propData = readSectorChain(summaryEntry.startSector, summaryEntry.size + sectorSize);
      const propFields = parseOLE2Properties(propData, summaryEntry.size);
      if (propFields.length > 0)
        categories.push({ name: 'Summary Information', icon: 'info', fields: propFields });
    }

    // Try DocSummaryInformation too
    const docSummaryEntry = dirEntries.find(e => e.name === '\x05DocumentSummaryInformation' || e.name === 'DocumentSummaryInformation');
    if (docSummaryEntry && docSummaryEntry.startSector !== 0xFFFFFFFE) {
      const propData = readSectorChain(docSummaryEntry.startSector, docSummaryEntry.size + sectorSize);
      const docPropFields = parseOLE2DocSummary(propData, docSummaryEntry.size);
      if (docPropFields.length > 0)
        categories.push({ name: 'Document Summary', icon: 'info', fields: docPropFields });
    }

    return { categories, images: [] };
  }

  function parseOLE2Properties(data, size) {
    const fields = [];
    if (data.length < 28) return fields;

    // Property set header
    const numSections = readU32LE(data, 24);
    if (numSections === 0) return fields;
    if (data.length < 44) return fields;

    const sectionOffset = readU32LE(data, 44);
    if (sectionOffset + 8 > data.length) return fields;

    const sectionSize = readU32LE(data, sectionOffset);
    const numProps = readU32LE(data, sectionOffset + 4);

    const pidLabels = {
      2: 'Title', 3: 'Subject', 4: 'Author', 5: 'Keywords',
      6: 'Comments', 7: 'Template', 8: 'Last Author', 9: 'Revision Number',
      12: 'Created', 13: 'Last Saved', 14: 'Pages', 15: 'Words',
      16: 'Characters', 18: 'Application', 19: 'Security',
    };

    for (let i = 0; i < numProps && i < 30; ++i) {
      const propBase = sectionOffset + 8 + i * 8;
      if (propBase + 8 > data.length) break;
      const pid = readU32LE(data, propBase);
      const propOffset = readU32LE(data, propBase + 4);
      const absOffset = sectionOffset + propOffset;
      if (absOffset + 8 > data.length || !pidLabels[pid]) continue;

      const propType = readU32LE(data, absOffset);
      let value = null;
      if (propType === 0x1E) {
        // VT_LPSTR
        const strLen = readU32LE(data, absOffset + 4);
        if (absOffset + 8 + strLen <= data.length)
          value = readString(data, absOffset + 8, strLen).replace(/\0+$/, '');
      } else if (propType === 0x03) {
        // VT_I4
        value = String(readI32LE(data, absOffset + 4));
      } else if (propType === 0x40) {
        // VT_FILETIME
        const lo = readU32LE(data, absOffset + 4);
        const hi = readU32LE(data, absOffset + 8);
        if (lo !== 0 || hi !== 0) {
          const ft = hi * 0x100000000 + lo;
          const unixMs = (ft / 10000) - 11644473600000;
          try { value = new Date(unixMs).toLocaleString(); } catch (_) {}
        }
      }

      if (value)
        fields.push({ key: 'ole2.prop.' + pid, label: pidLabels[pid], value });
    }
    return fields;
  }

  function parseOLE2DocSummary(data, size) {
    const fields = [];
    if (data.length < 28) return fields;

    const numSections = readU32LE(data, 24);
    if (numSections === 0 || data.length < 44) return fields;

    const sectionOffset = readU32LE(data, 44);
    if (sectionOffset + 8 > data.length) return fields;

    const numProps = readU32LE(data, sectionOffset + 4);

    const pidLabels = {
      2: 'Category', 14: 'Manager', 15: 'Company', 16: 'Bytes',
      17: 'Lines', 18: 'Paragraphs', 22: 'Slides', 23: 'Notes',
      24: 'Hidden Slides', 26: 'Links Up To Date',
    };

    for (let i = 0; i < numProps && i < 30; ++i) {
      const propBase = sectionOffset + 8 + i * 8;
      if (propBase + 8 > data.length) break;
      const pid = readU32LE(data, propBase);
      const propOffset = readU32LE(data, propBase + 4);
      const absOffset = sectionOffset + propOffset;
      if (absOffset + 8 > data.length || !pidLabels[pid]) continue;

      const propType = readU32LE(data, absOffset);
      let value = null;
      if (propType === 0x1E) {
        const strLen = readU32LE(data, absOffset + 4);
        if (absOffset + 8 + strLen <= data.length)
          value = readString(data, absOffset + 8, strLen).replace(/\0+$/, '');
      } else if (propType === 0x03) {
        value = String(readI32LE(data, absOffset + 4));
      } else if (propType === 0x0B) {
        // VT_BOOL
        value = readU16LE(data, absOffset + 4) !== 0 ? 'Yes' : 'No';
      }

      if (value)
        fields.push({ key: 'ole2.docprop.' + pid, label: pidLabels[pid], value });
    }
    return fields;
  }

  // =========================================================================
  // JAR parser
  // =========================================================================

  function parseJAR(bytes) {
    const categories = [];
    const fields = [];

    // Walk ZIP local file headers
    let pos = 0;
    const entries = [];
    while (pos + 30 <= bytes.length && entries.length < 500) {
      if (readU32LE(bytes, pos) !== 0x04034B50) break;
      const method = readU16LE(bytes, pos + 8);
      const compSize = readU32LE(bytes, pos + 18);
      const uncompSize = readU32LE(bytes, pos + 22);
      const nameLen = readU16LE(bytes, pos + 26);
      const extraLen = readU16LE(bytes, pos + 28);
      const name = readUTF8(bytes, pos + 30, nameLen);
      const dataStart = pos + 30 + nameLen + extraLen;
      entries.push({ name, method, compSize, uncompSize, dataStart });
      pos = dataStart + compSize;
    }

    // Read MANIFEST.MF
    const manifest = entries.find(e => e.name === 'META-INF/MANIFEST.MF');
    if (manifest && manifest.method === 0 && manifest.uncompSize > 0) {
      const mfText = readUTF8(bytes, manifest.dataStart, manifest.uncompSize);
      const mfLines = mfText.split(/\r?\n/);
      for (const line of mfLines) {
        const sep = line.indexOf(':');
        if (sep > 0) {
          const key = line.substring(0, sep).trim();
          const value = line.substring(sep + 1).trim();
          if (key && value && !key.startsWith('Name'))
            fields.push({ key: 'jar.manifest.' + key, label: key, value });
        }
      }
    }

    // Count classes, resources
    const classes = entries.filter(e => e.name.endsWith('.class') && !e.name.includes('$'));
    const innerClasses = entries.filter(e => e.name.endsWith('.class') && e.name.includes('$'));
    const resources = entries.filter(e => !e.name.endsWith('.class') && !e.name.endsWith('/') && e.name !== 'META-INF/MANIFEST.MF');
    fields.push({ key: 'jar.classes', label: 'Classes', value: String(classes.length) });
    if (innerClasses.length > 0)
      fields.push({ key: 'jar.innerClasses', label: 'Inner Classes', value: String(innerClasses.length) });
    if (resources.length > 0)
      fields.push({ key: 'jar.resources', label: 'Resources', value: String(resources.length) });

    // List packages
    const packages = new Set();
    for (const e of classes) {
      const lastSlash = e.name.lastIndexOf('/');
      if (lastSlash > 0) packages.add(e.name.substring(0, lastSlash).replace(/\//g, '.'));
    }
    if (packages.size > 0)
      fields.push({ key: 'jar.packages', label: 'Packages', value: [...packages].sort().join('\n') });

    // List top-level class names
    const classNames = classes.slice(0, 30).map(e => {
      const n = e.name.replace(/\.class$/, '').replace(/\//g, '.');
      return n;
    });
    if (classNames.length > 0)
      fields.push({ key: 'jar.classList', label: 'Classes (first 30)', value: classNames.join('\n') + (classes.length > 30 ? '\n...' : '') });

    categories.push({ name: 'JAR Contents', icon: 'archive', fields });

    // Try to parse first .class file for bytecode info
    const firstClass = entries.find(e => e.name.endsWith('.class') && e.method === 0 && e.uncompSize >= 10);
    if (firstClass) {
      const classBytes = bytes.subarray(firstClass.dataStart, firstClass.dataStart + firstClass.uncompSize);
      if (classBytes.length >= 10 && readU32BE(classBytes, 0) === 0xCAFEBABE) {
        const classResult = parseJavaClass(classBytes);
        if (classResult.categories.length > 0) {
          const sampleCat = classResult.categories[0];
          sampleCat.name = 'Sample Class (' + firstClass.name.replace(/\.class$/, '').split('/').pop() + ')';
          categories.push(sampleCat);
        }
      }
    }

    return { categories, images: [] };
  }

  // =========================================================================
  // APK parser
  // =========================================================================

  function parseAPK(bytes) {
    const categories = [];
    const apkFields = [];
    const contentFields = [];
    const signingFields = [];
    const images = [];

    // Walk ZIP local headers to build file listing
    const zipFiles = [];
    let pos = 0;
    while (pos + 30 <= bytes.length) {
      if (readU32LE(bytes, pos) !== 0x04034B50) break;
      const method = readU16LE(bytes, pos + 8);
      const compSize = readU32LE(bytes, pos + 18);
      const uncompSize = readU32LE(bytes, pos + 22);
      const nameLen = readU16LE(bytes, pos + 26);
      const extraLen = readU16LE(bytes, pos + 28);
      const name = readUTF8(bytes, pos + 30, nameLen);
      const dataOffset = pos + 30 + nameLen + extraLen;
      zipFiles.push({ name, method, compSize, uncompSize, dataOffset });
      pos = dataOffset + compSize;
    }

    // DEX files
    const dexFiles = zipFiles.filter(f => /^classes\d*\.dex$/i.test(f.name));
    const totalDexSize = dexFiles.reduce((s, f) => s + f.uncompSize, 0);
    if (dexFiles.length > 0) {
      contentFields.push({ key: 'apk.dexCount', label: 'DEX Files', value: String(dexFiles.length) });
      contentFields.push({ key: 'apk.dexSize', label: 'Total DEX Size', value: formatSize(totalDexSize) });
    }

    // Native libraries
    const nativeArchs = new Set();
    for (const f of zipFiles) {
      const m = f.name.match(/^lib\/([^/]+)\//);
      if (m) nativeArchs.add(m[1]);
    }
    if (nativeArchs.size > 0)
      contentFields.push({ key: 'apk.nativeArchs', label: 'Native Architectures', value: [...nativeArchs].join(', ') });

    // Resource and asset counts
    const resCount = zipFiles.filter(f => f.name.startsWith('res/')).length;
    const assetCount = zipFiles.filter(f => f.name.startsWith('assets/')).length;
    if (resCount > 0) contentFields.push({ key: 'apk.resCount', label: 'Resource Files', value: String(resCount) });
    if (assetCount > 0) contentFields.push({ key: 'apk.assetCount', label: 'Asset Files', value: String(assetCount) });

    // Signing info
    const rsaFiles = zipFiles.filter(f => /^META-INF\/.*\.(RSA|DSA|EC)$/i.test(f.name));
    const sfFiles = zipFiles.filter(f => /^META-INF\/.*\.SF$/i.test(f.name));
    if (rsaFiles.length > 0)
      signingFields.push({ key: 'apk.certPresent', label: 'Certificate', value: rsaFiles.map(f => f.name.split('/').pop()).join(', ') });
    if (sfFiles.length > 0)
      signingFields.push({ key: 'apk.sigFile', label: 'Signature File', value: sfFiles.map(f => f.name.split('/').pop()).join(', ') });

    // V2/V3 signing: check APK Signing Block before central directory
    let eocdPos = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); --i) {
      if (readU32LE(bytes, i) === 0x06054B50) { eocdPos = i; break; }
    }
    if (eocdPos >= 0) {
      const cdOffset = readU32LE(bytes, eocdPos + 16);
      // APK Signing Block magic: "APK Sig Block 42" at cdOffset-16
      if (cdOffset >= 24) {
        const magic = readString(bytes, cdOffset - 16, 16);
        if (magic === 'APK Sig Block 42')
          signingFields.push({ key: 'apk.sigScheme', label: 'Signing Scheme', value: 'v2+ (APK Signature Scheme)' });
      }
    }
    if (signingFields.length === 0)
      signingFields.push({ key: 'apk.sigScheme', label: 'Signing', value: 'Not detected' });

    // Parse AndroidManifest.xml binary XML string pool
    const manifest = zipFiles.find(f => f.name === 'AndroidManifest.xml');
    if (manifest && manifest.method === 0 && manifest.dataOffset + manifest.compSize <= bytes.length) {
      const mData = bytes.subarray(manifest.dataOffset, manifest.dataOffset + manifest.compSize);
      parseAndroidBinaryXml(mData, apkFields);
    }

    // Try to extract app icon
    const iconPaths = [
      'res/mipmap-xxxhdpi-v4/ic_launcher.png', 'res/mipmap-xxxhdpi/ic_launcher.png',
      'res/mipmap-xxhdpi-v4/ic_launcher.png', 'res/mipmap-xxhdpi/ic_launcher.png',
      'res/mipmap-xhdpi-v4/ic_launcher.png', 'res/mipmap-xhdpi/ic_launcher.png',
      'res/mipmap-hdpi-v4/ic_launcher.png', 'res/mipmap-hdpi/ic_launcher.png',
      'res/drawable-xxxhdpi/icon.png', 'res/drawable-xxhdpi/icon.png',
      'res/drawable-xhdpi/icon.png', 'res/drawable-hdpi/icon.png',
      'res/drawable/icon.png',
    ];
    for (const iconPath of iconPaths) {
      const icon = zipFiles.find(f => f.name === iconPath && f.method === 0);
      if (icon && icon.dataOffset + icon.compSize <= bytes.length) {
        const iconBytes = bytes.subarray(icon.dataOffset, icon.dataOffset + icon.compSize);
        // Verify PNG signature
        if (iconBytes.length > 8 && iconBytes[0] === 0x89 && iconBytes[1] === 0x50) {
          images.push({
            label: 'App Icon',
            mimeType: 'image/png',
            dataUrl: bytesToDataUrl(iconBytes, 'image/png'),
          });
          break;
        }
      }
    }

    if (apkFields.length > 0)
      categories.push({ name: 'APK Info', icon: 'archive', fields: apkFields });
    if (contentFields.length > 0)
      categories.push({ name: 'Contents', icon: 'archive', fields: contentFields });
    if (signingFields.length > 0)
      categories.push({ name: 'Signing', icon: 'archive', fields: signingFields });

    return { categories, images };
  }

  function parseAndroidBinaryXml(data, fields) {
    if (data.length < 8) return;

    // Binary XML starts with ResChunk_header: type(u16) + headerSize(u16) + size(u32)
    const xmlType = readU16LE(data, 0);
    if (xmlType !== 0x0003) return; // XML_TYPE = 0x0003

    // Find String Pool chunk (type 0x0001)
    let spOffset = -1;
    let off = 8;
    while (off + 8 <= data.length) {
      const chunkType = readU16LE(data, off);
      const chunkSize = readU32LE(data, off + 4);
      if (chunkSize < 8 || off + chunkSize > data.length) break;
      if (chunkType === 0x0001) { spOffset = off; break; }
      off += chunkSize;
    }

    if (spOffset < 0) return;

    // Parse ResStringPool_header
    const spHeaderSize = readU16LE(data, spOffset + 2);
    const spSize = readU32LE(data, spOffset + 4);
    const stringCount = readU32LE(data, spOffset + 8);
    const styleCount = readU32LE(data, spOffset + 12);
    const spFlags = readU32LE(data, spOffset + 16);
    const stringsStart = readU32LE(data, spOffset + 20);
    const isUtf8 = (spFlags & (1 << 8)) !== 0;

    // Read string offsets
    const offsetsBase = spOffset + spHeaderSize;
    const strings = [];
    for (let i = 0; i < stringCount && i < 5000; ++i) {
      const strOff = readU32LE(data, offsetsBase + i * 4);
      const absOff = spOffset + stringsStart + strOff;
      if (absOff >= data.length) break;

      let str;
      if (isUtf8) {
        // UTF-8 encoded: charSize(u8/u16) then byteSize(u8/u16) then data
        let byteOff = absOff;
        // Skip char count (encoded length)
        const c1 = data[byteOff++];
        if (c1 & 0x80) ++byteOff;
        // Byte count
        const b1 = data[byteOff++];
        let byteLen = b1;
        if (b1 & 0x80) {
          byteLen = ((b1 & 0x7F) << 8) | data[byteOff++];
        }
        str = readUTF8(data, byteOff, byteLen);
      } else {
        // UTF-16 encoded: charCount(u16/u32) then data
        let byteOff = absOff;
        let charLen = readU16LE(data, byteOff);
        byteOff += 2;
        if (charLen & 0x8000) {
          charLen = ((charLen & 0x7FFF) << 16) | readU16LE(data, byteOff);
          byteOff += 2;
        }
        str = readUTF16(data, byteOff, charLen * 2, true);
      }

      strings.push(str);
    }

    // Extract known values from string pool
    const packagePattern = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/;
    const packageName = strings.find(s => packagePattern.test(s));
    if (packageName)
      fields.push({ key: 'apk.packageName', label: 'Package Name', value: packageName });

    // Extract permissions
    const permissions = strings.filter(s => s.startsWith('android.permission.'));
    if (permissions.length > 0)
      fields.push({ key: 'apk.permissions', label: 'Permissions', value: permissions.map(p => p.replace('android.permission.', '')).join('\n') });

    // Extract SDK versions from known string patterns
    for (const s of strings) {
      if (/^\d+$/.test(s)) continue; // skip bare numbers
    }

    // Walk XML elements to find version info and components
    const activities = [];
    const services = [];
    const receivers = [];
    let inManifest = false;

    off = spOffset + spSize;
    while (off + 8 <= data.length) {
      const chunkType = readU16LE(data, off);
      const chunkHeaderSize = readU16LE(data, off + 2);
      const chunkSize = readU32LE(data, off + 4);
      if (chunkSize < 8 || off + chunkSize > data.length) break;

      // Start element (0x0102)
      if (chunkType === 0x0102 && chunkSize >= 36) {
        const nsIdx = readU32LE(data, off + 8);
        const nameIdx = readU32LE(data, off + 12);
        const attrStart = readU16LE(data, off + 16);
        const attrSize = readU16LE(data, off + 18);
        const attrCount = readU16LE(data, off + 20);
        const elemName = nameIdx < strings.length ? strings[nameIdx] : '';

        if (elemName === 'manifest') inManifest = true;

        // Read attributes
        const attrBase = off + chunkHeaderSize;
        for (let a = 0; a < attrCount; ++a) {
          const ao = attrBase + a * 20;
          if (ao + 20 > data.length) break;
          const attrNameIdx = readU32LE(data, ao + 4);
          const attrRawIdx = readU32LE(data, ao + 8);
          const attrType = readU32LE(data, ao + 12) >> 24;
          const attrData = readU32LE(data, ao + 16);
          const attrName = attrNameIdx < strings.length ? strings[attrNameIdx] : '';
          const attrRawVal = attrRawIdx < strings.length && attrRawIdx !== 0xFFFFFFFF ? strings[attrRawIdx] : null;

          if (elemName === 'manifest') {
            if (attrName === 'versionCode')
              fields.push({ key: 'apk.versionCode', label: 'Version Code', value: String(attrData) });
            if (attrName === 'versionName' && attrRawVal)
              fields.push({ key: 'apk.versionName', label: 'Version Name', value: attrRawVal });
            if (attrName === 'compileSdkVersion')
              fields.push({ key: 'apk.compileSdk', label: 'Compile SDK', value: String(attrData) });
          }

          if (elemName === 'uses-sdk') {
            if (attrName === 'minSdkVersion')
              fields.push({ key: 'apk.minSdk', label: 'Min SDK', value: String(attrData) });
            if (attrName === 'targetSdkVersion')
              fields.push({ key: 'apk.targetSdk', label: 'Target SDK', value: String(attrData) });
          }

          if (elemName === 'activity' && attrName === 'name' && attrRawVal)
            activities.push(attrRawVal.split('.').pop());
          if (elemName === 'service' && attrName === 'name' && attrRawVal)
            services.push(attrRawVal.split('.').pop());
          if (elemName === 'receiver' && attrName === 'name' && attrRawVal)
            receivers.push(attrRawVal.split('.').pop());
        }
      }

      off += chunkSize;
    }

    if (activities.length > 0)
      fields.push({ key: 'apk.activities', label: 'Activities', value: activities.slice(0, 20).join('\n') + (activities.length > 20 ? '\n...' : '') });
    if (services.length > 0)
      fields.push({ key: 'apk.services', label: 'Services', value: services.slice(0, 10).join('\n') + (services.length > 10 ? '\n...' : '') });
    if (receivers.length > 0)
      fields.push({ key: 'apk.receivers', label: 'Receivers', value: receivers.slice(0, 10).join('\n') + (receivers.length > 10 ? '\n...' : '') });
  }

  // Parser dispatch
  // =========================================================================

  const PARSER_MAP = {
    jpeg: parseJPEG,
    png: parsePNG,
    gif: parseGIF,
    bmp: parseBMP,
    ico: parseICO,
    psd: parsePSD,
    webp: parseWebP,
    tiff: parseTIFF,
    mp3: parseMP3,
    flac: parseFLAC,
    wav: parseWAV,
    ogg: parseOGG,
    mp4: parseMP4,
    ebml: parseEBML,
    pdf: parsePDF,
    zip: parseZIP,
    pe: parsePE,
    elf: parseELF,
    macho: parseMachO,
    javaclass: parseJavaClass,
    ttf: parseFont,
    otf: parseFont,
    woff: parseFont,
    woff2: parseFont,
    ole2: parseOLE2,
    docx: parseOOXML,
    xlsx: parseOOXML,
    pptx: parseOOXML,
    ooxml: parseOOXML,
    jar: parseJAR,
    apk: parseAPK,
  };

  // =========================================================================
  // parse(bytes, fileName) — main entry point
  // =========================================================================

  function parse(bytes, fileName) {
    if (!bytes || bytes.length === 0)
      return {
        fileType: { id: 'empty', name: 'Empty File', category: 'Unknown', mimeType: 'application/octet-stream', confidence: 100 },
        categories: [parseGeneric(bytes || new Uint8Array(0), fileName)],
        images: [],
        byteRegions: [],
      };

    const fileType = identify(bytes);
    const categories = [parseGeneric(bytes, fileName)];
    const images = [];
    let byteRegions = [];

    const parser = PARSER_MAP[fileType.id];
    if (parser) {
      const result = parser(bytes);
      if (result.categories)
        for (const cat of result.categories)
          categories.push(cat);
      if (result.images)
        for (const img of result.images)
          images.push(img);
      if (result.byteRegions)
        byteRegions = result.byteRegions;
    }

    // Dual-nature: also run ZIP parser for ZIP-based formats that aren't pure ZIP
    const zipBasedTypes = ['docx', 'xlsx', 'pptx', 'ooxml', 'jar', 'apk'];
    if (zipBasedTypes.includes(fileType.id)) {
      const zipResult = parseZIP(bytes);
      if (zipResult.categories)
        for (const cat of zipResult.categories)
          categories.push(cat);
    }

    return { fileType, categories, images, byteRegions };
  }

  // =========================================================================
  // Export
  // =========================================================================

  SZ.MetadataParsers = {
    identify,
    parse,
    formatSize,
    computeEntropy,
    bytesToHex,
    bytesToDataUrl,
    ID3_GENRES,
  };

})();
