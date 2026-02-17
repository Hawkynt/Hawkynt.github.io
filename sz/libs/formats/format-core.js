;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  // =========================================================================
  // Shared binary I/O utilities
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

  function readI8(bytes, offset) {
    const v = readU8(bytes, offset);
    return v > 127 ? v - 256 : v;
  }

  function readI16LE(bytes, offset) {
    const v = readU16LE(bytes, offset);
    return v > 32767 ? v - 65536 : v;
  }

  function readI32LE(bytes, offset) {
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
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

  function formatSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(2) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }

  function matchBytes(bytes, offset, signature) {
    for (let i = 0; i < signature.length; ++i)
      if (offset + i >= bytes.length || bytes[offset + i] !== signature[i])
        return false;
    return true;
  }

  // =========================================================================
  // Format registry
  // =========================================================================

  const _registry = new Map();

  function register(id, descriptor) {
    if (!id || !descriptor)
      throw new Error('SZ.Formats.register: id and descriptor required');
    descriptor.id = id;
    _registry.set(id, descriptor);
  }

  function find(id) {
    return _registry.get(id) || null;
  }

  function detect(bytes, fileName) {
    if (!bytes || bytes.length === 0)
      return null;

    // Pass 1: try each registered format's detect function
    let best = null;
    let bestConfidence = 0;
    for (const desc of _registry.values()) {
      if (!desc.detect) continue;
      const result = desc.detect(bytes, fileName);
      if (result === true) {
        // Boolean true = confident match; return immediately
        return desc;
      }
      if (typeof result === 'number' && result > bestConfidence) {
        bestConfidence = result;
        best = desc;
      }
    }
    if (best)
      return best;

    // Pass 2: extension-based fallback
    if (fileName) {
      const ext = fileName.split('.').pop().toLowerCase();
      for (const desc of _registry.values())
        if (desc.extensions && desc.extensions.includes(ext))
          return desc;
    }

    return null;
  }

  function all() {
    return Array.from(_registry.values());
  }

  function byCategory(cat) {
    const c = cat.toLowerCase();
    return Array.from(_registry.values()).filter(d => d.category && d.category.toLowerCase() === c);
  }

  // =========================================================================
  // Export
  // =========================================================================

  SZ.Formats = {
    register,
    find,
    detect,
    all,
    byCategory,

    // Shared binary I/O
    readU8, readU16LE, readU16BE, readU32LE, readU32BE,
    readI8, readI16LE, readI32LE,
    readString, readUTF8, readUTF16,
    bytesToHex, matchBytes, formatSize,
  };

})();
