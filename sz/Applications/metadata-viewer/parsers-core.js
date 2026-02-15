;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  // =========================================================================
  // Utility helpers (exported for parser modules)
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
    { signature: [0x46, 0x4C, 0x49, 0x46], offset: 0, id: 'flif', name: 'FLIF Image', category: 'Image', mimeType: 'image/flif' },
    { signature: [0x42, 0x50, 0x47, 0xFB], offset: 0, id: 'bpg', name: 'BPG Image', category: 'Image', mimeType: 'image/bpg' },

    // ---- Audio ----
    { signature: [0x49, 0x44, 0x33], offset: 0, id: 'mp3', name: 'MP3 Audio', category: 'Audio', mimeType: 'audio/mpeg' },
    { signature: [0x66, 0x4C, 0x61, 0x43], offset: 0, id: 'flac', name: 'FLAC Audio', category: 'Audio', mimeType: 'audio/flac' },
    { signature: [0x4F, 0x67, 0x67, 0x53], offset: 0, id: 'ogg', name: 'OGG Audio', category: 'Audio', mimeType: 'audio/ogg' },
    { signature: [0x46, 0x4F, 0x52, 0x4D], offset: 0, id: 'aiff', name: 'AIFF Audio', category: 'Audio', mimeType: 'audio/aiff' },
    { signature: [0x4D, 0x54, 0x68, 0x64], offset: 0, id: 'midi', name: 'MIDI Music', category: 'Audio', mimeType: 'audio/midi' },
    { signature: [0x44, 0x53, 0x44, 0x20], offset: 0, id: 'dsf', name: 'DSF Audio (DSD)', category: 'Audio', mimeType: 'audio/dsf' },
    { signature: [0x46, 0x52, 0x4D, 0x38], offset: 0, id: 'dff', name: 'DSDIFF Audio (DSD)', category: 'Audio', mimeType: 'audio/x-dff' },
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
      if (zipNames.some(n => n === '[Content_Types].xml')) {
        if (zipNames.some(n => n.startsWith('word/')))
          return { id: 'docx', name: 'Word Document (OOXML)', category: 'Document', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', confidence: 95 };
        if (zipNames.some(n => n.startsWith('xl/')))
          return { id: 'xlsx', name: 'Excel Spreadsheet (OOXML)', category: 'Document', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', confidence: 95 };
        if (zipNames.some(n => n.startsWith('ppt/')))
          return { id: 'pptx', name: 'PowerPoint Presentation (OOXML)', category: 'Document', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', confidence: 95 };
        return { id: 'ooxml', name: 'Office Document (OOXML)', category: 'Document', mimeType: 'application/zip', confidence: 80 };
      }
      if (zipNames.some(n => n === 'META-INF/MANIFEST.MF'))
        return { id: 'jar', name: 'Java Archive (JAR)', category: 'Archive', mimeType: 'application/java-archive', confidence: 90 };
      if (zipNames.some(n => n === 'AndroidManifest.xml') && zipNames.some(n => n === 'classes.dex'))
        return { id: 'apk', name: 'Android APK', category: 'Archive', mimeType: 'application/vnd.android.package-archive', confidence: 95 };
      if (zipNames.some(n => n === 'mimetype') && zipNames.some(n => n === 'content.xml'))
        return { id: 'odf', name: 'OpenDocument File', category: 'Document', mimeType: 'application/vnd.oasis.opendocument', confidence: 85 };
      if (zipNames.some(n => n === 'mimetype') && zipNames.some(n => n.endsWith('.opf')))
        return { id: 'epub', name: 'EPUB eBook', category: 'Document', mimeType: 'application/epub+zip', confidence: 90 };
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

    if (textSample.startsWith('BEGIN:VCALENDAR'))
      return { id: 'ics', name: 'iCalendar Event', category: 'Data', mimeType: 'text/calendar', confidence: 90 };

    if (textSample.startsWith('BEGIN:VCARD'))
      return { id: 'vcf', name: 'vCard Contact', category: 'Data', mimeType: 'text/vcard', confidence: 90 };

    if (/^(@charset|@import|@media|\*\s*\{|body\s*\{|html\s*\{|\/\*)/i.test(textSample))
      return { id: 'css', name: 'CSS Stylesheet', category: 'Document', mimeType: 'text/css', confidence: 50 };

    if (textSample.startsWith('---\n') || textSample.startsWith('---\r\n'))
      return { id: 'yaml', name: 'YAML Document', category: 'Data', mimeType: 'text/yaml', confidence: 55 };

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
  // Dynamic parser registry
  // =========================================================================

  const PARSER_MAP = {};
  const ZIP_BASED_TYPES = new Set();

  function registerParsers(map, opts) {
    Object.assign(PARSER_MAP, map);
    if (opts && opts.zipBased)
      for (const t of opts.zipBased) ZIP_BASED_TYPES.add(t);
  }

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
    if (ZIP_BASED_TYPES.has(fileType.id) && PARSER_MAP.zip) {
      const zipResult = PARSER_MAP.zip(bytes);
      if (zipResult.categories)
        for (const cat of zipResult.categories)
          categories.push(cat);
    }

    return { fileType, categories, images, byteRegions };
  }

  // =========================================================================
  // Export — all utilities available for parser modules
  // =========================================================================

  SZ.MetadataParsers = {
    // Public API
    identify,
    parse,
    registerParsers,
    formatSize,
    computeEntropy,
    bytesToHex,
    bytesToDataUrl,
    // Utility functions for parser modules
    readU8, readU16LE, readU16BE, readU32LE, readU32BE, readI32LE, readU64LE, readU64BE,
    readString, readUTF8, readUTF16,
    formatTimestamp,
    matchBytes, countNulls, detectTextEncoding,
    // ID3_GENRES will be set by parsers-audio.js
    ID3_GENRES: [],
  };

})();
