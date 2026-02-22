;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const StructEngine = SZ.StructEngine || (SZ.StructEngine = {});

  // -----------------------------------------------------------------------
  // Primitive type system
  // -----------------------------------------------------------------------
  const TYPES = {
    uint8:     { size: 1, read: (d, o) => d[o],                                          write: (d, o, v) => { d[o] = v & 0xff; } },
    int8:      { size: 1, read: (d, o) => { const v = d[o]; return v > 127 ? v - 256 : v; }, write: (d, o, v) => { d[o] = v & 0xff; } },
    uint16le:  { size: 2, read: (d, o) => d[o] | (d[o+1] << 8),                          write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; } },
    uint16be:  { size: 2, read: (d, o) => (d[o] << 8) | d[o+1],                          write: (d, o, v) => { d[o] = (v >> 8) & 0xff; d[o+1] = v & 0xff; } },
    int16le:   { size: 2, read: (d, o) => { const v = d[o] | (d[o+1] << 8); return v > 32767 ? v - 65536 : v; }, write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; } },
    int16be:   { size: 2, read: (d, o) => { const v = (d[o] << 8) | d[o+1]; return v > 32767 ? v - 65536 : v; }, write: (d, o, v) => { d[o] = (v >> 8) & 0xff; d[o+1] = v & 0xff; } },
    uint32le:  { size: 4, read: (d, o) => (d[o] | (d[o+1] << 8) | (d[o+2] << 16) | (d[o+3] << 24)) >>> 0, write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; d[o+3] = (v >> 24) & 0xff; } },
    uint32be:  { size: 4, read: (d, o) => ((d[o] << 24) | (d[o+1] << 16) | (d[o+2] << 8) | d[o+3]) >>> 0, write: (d, o, v) => { d[o] = (v >> 24) & 0xff; d[o+1] = (v >> 16) & 0xff; d[o+2] = (v >> 8) & 0xff; d[o+3] = v & 0xff; } },
    int32le:   { size: 4, read: (d, o) => d[o] | (d[o+1] << 8) | (d[o+2] << 16) | (d[o+3] << 24), write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; d[o+3] = (v >> 24) & 0xff; } },
    int32be:   { size: 4, read: (d, o) => (d[o] << 24) | (d[o+1] << 16) | (d[o+2] << 8) | d[o+3], write: (d, o, v) => { d[o] = (v >> 24) & 0xff; d[o+1] = (v >> 16) & 0xff; d[o+2] = (v >> 8) & 0xff; d[o+3] = v & 0xff; } },
    uint64le:  { size: 8, read: _readU64LE, write: _writeU64LE },
    uint64be:  { size: 8, read: _readU64BE, write: _writeU64BE },
    float32le: { size: 4, read: (d, o) => new DataView(d.buffer, d.byteOffset).getFloat32(o, true),  write: (d, o, v) => new DataView(d.buffer, d.byteOffset).setFloat32(o, v, true) },
    float32be: { size: 4, read: (d, o) => new DataView(d.buffer, d.byteOffset).getFloat32(o, false), write: (d, o, v) => new DataView(d.buffer, d.byteOffset).setFloat32(o, v, false) },
    float64le: { size: 8, read: (d, o) => new DataView(d.buffer, d.byteOffset).getFloat64(o, true),  write: (d, o, v) => new DataView(d.buffer, d.byteOffset).setFloat64(o, v, true) },
    float64be: { size: 8, read: (d, o) => new DataView(d.buffer, d.byteOffset).getFloat64(o, false), write: (d, o, v) => new DataView(d.buffer, d.byteOffset).setFloat64(o, v, false) },
    char:      { size: 1, read: (d, o) => String.fromCharCode(d[o]),                     write: (d, o, v) => { d[o] = (typeof v === 'string' ? v.charCodeAt(0) : v) & 0xff; } },

    // Signed 64-bit
    int64le:   { size: 8, read: (d, o) => { const v = _readU64LE(d, o); return v >= 0x8000000000000000 ? v - 0x10000000000000000 : v; }, write: _writeU64LE },
    int64be:   { size: 8, read: (d, o) => { const v = _readU64BE(d, o); return v >= 0x8000000000000000 ? v - 0x10000000000000000 : v; }, write: _writeU64BE },

    // IEEE 754 half-precision float (16-bit)
    float16le: { size: 2, read: (d, o) => _readF16(d[o] | (d[o+1] << 8)), write: (d, o, v) => { const bits = _writeF16(v); d[o] = bits & 0xff; d[o+1] = (bits >> 8) & 0xff; },
      format: v => v.toPrecision(4) },
    float16be: { size: 2, read: (d, o) => _readF16((d[o] << 8) | d[o+1]), write: (d, o, v) => { const bits = _writeF16(v); d[o] = (bits >> 8) & 0xff; d[o+1] = bits & 0xff; },
      format: v => v.toPrecision(4) },

    // GUID / UUID (16 bytes, mixed endian per RFC)
    guid: { size: 16,
      read: (d, o) => {
        const p = i => d[o + i].toString(16).padStart(2, '0');
        return (p(3)+p(2)+p(1)+p(0) + '-' + p(5)+p(4) + '-' + p(7)+p(6) + '-' + p(8)+p(9) + '-' + p(10)+p(11)+p(12)+p(13)+p(14)+p(15)).toUpperCase();
      },
      write: (d, o, v) => {
        const hex = String(v).replace(/[{}\-\s]/g, '');
        if (hex.length !== 32) return;
        const b = i => parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        d[o]=b(3); d[o+1]=b(2); d[o+2]=b(1); d[o+3]=b(0);
        d[o+4]=b(5); d[o+5]=b(4); d[o+6]=b(7); d[o+7]=b(6);
        for (let i = 8; i < 16; ++i) d[o+i] = b(i);
      },
      format: v => '{' + v + '}',
    },

    // FourCC (4-byte ASCII tag)
    fourcc: { size: 4,
      read: (d, o) => String.fromCharCode(d[o], d[o+1], d[o+2], d[o+3]),
      write: (d, o, v) => { const s = String(v); for (let i = 0; i < 4; ++i) d[o+i] = i < s.length ? s.charCodeAt(i) & 0x7f : 0x20; },
      format: v => '"' + v + '"',
    },

    // Unix timestamps
    unix32le: { size: 4,
      read: (d, o) => (d[o] | (d[o+1] << 8) | (d[o+2] << 16) | (d[o+3] << 24)) >>> 0,
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; d[o+3] = (v >> 24) & 0xff; },
      format: v => { const dt = new Date(v * 1000); return isNaN(dt.getTime()) ? 'Invalid' : dt.toISOString(); },
    },
    unix32be: { size: 4,
      read: (d, o) => ((d[o] << 24) | (d[o+1] << 16) | (d[o+2] << 8) | d[o+3]) >>> 0,
      write: (d, o, v) => { d[o] = (v >> 24) & 0xff; d[o+1] = (v >> 16) & 0xff; d[o+2] = (v >> 8) & 0xff; d[o+3] = v & 0xff; },
      format: v => { const dt = new Date(v * 1000); return isNaN(dt.getTime()) ? 'Invalid' : dt.toISOString(); },
    },
    unix64le: { size: 8, read: _readU64LE, write: _writeU64LE,
      format: v => { const dt = new Date(v * 1000); return isNaN(dt.getTime()) ? 'Invalid' : dt.toISOString(); },
    },
    unix64be: { size: 8, read: _readU64BE, write: _writeU64BE,
      format: v => { const dt = new Date(v * 1000); return isNaN(dt.getTime()) ? 'Invalid' : dt.toISOString(); },
    },

    // DOS FAT date/time (16-bit date + 16-bit time packed in 32 bits LE)
    dosdate: { size: 4,
      read: (d, o) => (d[o] | (d[o+1] << 8) | (d[o+2] << 16) | (d[o+3] << 24)) >>> 0,
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; d[o+3] = (v >> 24) & 0xff; },
      format: v => {
        const time = v & 0xFFFF, date = (v >>> 16) & 0xFFFF;
        const sec = (time & 0x1F) * 2, min = (time >> 5) & 0x3F, hr = (time >> 11) & 0x1F;
        const day = date & 0x1F, mon = (date >> 5) & 0x0F, yr = ((date >> 9) & 0x7F) + 1980;
        return yr + '-' + String(mon).padStart(2,'0') + '-' + String(day).padStart(2,'0') + ' ' + String(hr).padStart(2,'0') + ':' + String(min).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
      },
    },

    // Windows FILETIME (100ns intervals since 1601-01-01)
    filetime: { size: 8, read: _readU64LE, write: _writeU64LE,
      format: v => {
        const msOffset = v / 10000 - 11644473600000;
        const dt = new Date(msOffset);
        return isNaN(dt.getTime()) ? 'Invalid' : dt.toISOString();
      },
    },

    // .NET DateTime ticks (100ns since 0001-01-01)
    dotnet_ticks: { size: 8, read: _readU64LE, write: _writeU64LE,
      format: v => {
        const ticks = v & 0x3FFFFFFFFFFFFFFF; // strip DateTimeKind bits
        const msOffset = ticks / 10000 - 62135596800000;
        const dt = new Date(msOffset);
        return isNaN(dt.getTime()) ? 'Invalid' : dt.toISOString();
      },
    },

    // Colors
    rgb24: { size: 3,
      read: (d, o) => (d[o] << 16) | (d[o+1] << 8) | d[o+2],
      write: (d, o, v) => { d[o] = (v >> 16) & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = v & 0xff; },
      format: v => '#' + (v & 0xFFFFFF).toString(16).padStart(6, '0').toUpperCase(),
      colorFormat: v => '#' + (v & 0xFFFFFF).toString(16).padStart(6, '0'),
    },
    rgba32le: { size: 4,
      read: (d, o) => (d[o] | (d[o+1] << 8) | (d[o+2] << 16) | (d[o+3] << 24)) >>> 0,
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; d[o+3] = (v >> 24) & 0xff; },
      format: v => { const r = v & 0xff, g = (v >> 8) & 0xff, b = (v >> 16) & 0xff, a = (v >> 24) & 0xff; return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase() + a.toString(16).padStart(2, '0').toUpperCase(); },
      colorFormat: v => { const r = v & 0xff, g = (v >> 8) & 0xff, b = (v >> 16) & 0xff; return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0'); },
    },
    bgr24: { size: 3,
      read: (d, o) => d[o] | (d[o+1] << 8) | (d[o+2] << 16),
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; },
      format: v => { const r = v & 0xff, g = (v >> 8) & 0xff, b = (v >> 16) & 0xff; return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase(); },
      colorFormat: v => { const r = v & 0xff, g = (v >> 8) & 0xff, b = (v >> 16) & 0xff; return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0'); },
    },
    bgra32le: { size: 4,
      read: (d, o) => (d[o] | (d[o+1] << 8) | (d[o+2] << 16) | (d[o+3] << 24)) >>> 0,
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; d[o+3] = (v >> 24) & 0xff; },
      format: v => { const b = v & 0xff, g = (v >> 8) & 0xff, r = (v >> 16) & 0xff, a = (v >> 24) & 0xff; return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase() + a.toString(16).padStart(2, '0').toUpperCase(); },
      colorFormat: v => { const b = v & 0xff, g = (v >> 8) & 0xff, r = (v >> 16) & 0xff; return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0'); },
    },
    rgb565le: { size: 2,
      read: (d, o) => d[o] | (d[o+1] << 8),
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; },
      format: v => {
        const r = ((v >> 11) & 0x1F) << 3, g = ((v >> 5) & 0x3F) << 2, b = (v & 0x1F) << 3;
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
      },
      colorFormat: v => {
        const r = ((v >> 11) & 0x1F) << 3, g = ((v >> 5) & 0x3F) << 2, b = (v & 0x1F) << 3;
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
      },
    },

    // IPv4
    ipv4: { size: 4,
      read: (d, o) => (d[o] << 24 | d[o+1] << 16 | d[o+2] << 8 | d[o+3]) >>> 0,
      write: (d, o, v) => { d[o] = (v >> 24) & 0xff; d[o+1] = (v >> 16) & 0xff; d[o+2] = (v >> 8) & 0xff; d[o+3] = v & 0xff; },
      format: v => ((v >>> 24) & 0xff) + '.' + ((v >>> 16) & 0xff) + '.' + ((v >>> 8) & 0xff) + '.' + (v & 0xff),
    },

    // Packed BCD
    bcd8: { size: 1,
      read: (d, o) => d[o],
      write: (d, o, v) => { d[o] = v & 0xff; },
      format: v => '' + ((v >> 4) & 0xf) + (v & 0xf),
    },
    bcd16le: { size: 2,
      read: (d, o) => d[o] | (d[o+1] << 8),
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; },
      format: v => '' + ((v >> 12) & 0xf) + ((v >> 8) & 0xf) + ((v >> 4) & 0xf) + (v & 0xf),
    },
    bcd32le: { size: 4,
      read: (d, o) => (d[o] | (d[o+1] << 8) | (d[o+2] << 16) | (d[o+3] << 24)) >>> 0,
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; d[o+3] = (v >> 24) & 0xff; },
      format: v => {
        let s = '';
        for (let i = 28; i >= 0; i -= 4) s += ((v >>> i) & 0xf);
        return s;
      },
    },

    // UTF-16LE character
    wchar: { size: 2,
      read: (d, o) => d[o] | (d[o+1] << 8),
      write: (d, o, v) => { const c = typeof v === 'string' ? v.charCodeAt(0) : v; d[o] = c & 0xff; d[o+1] = (c >> 8) & 0xff; },
      format: v => "'" + String.fromCharCode(v) + "' (U+" + v.toString(16).padStart(4, '0').toUpperCase() + ')',
    },

    // 24-bit integers
    uint24le: { size: 3,
      read: (d, o) => d[o] | (d[o+1] << 8) | (d[o+2] << 16),
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; },
    },
    uint24be: { size: 3,
      read: (d, o) => (d[o] << 16) | (d[o+1] << 8) | d[o+2],
      write: (d, o, v) => { d[o] = (v >> 16) & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = v & 0xff; },
    },
    int24le: { size: 3,
      read: (d, o) => { const v = d[o] | (d[o+1] << 8) | (d[o+2] << 16); return v > 0x7FFFFF ? v - 0x1000000 : v; },
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; },
    },
    int24be: { size: 3,
      read: (d, o) => { const v = (d[o] << 16) | (d[o+1] << 8) | d[o+2]; return v > 0x7FFFFF ? v - 0x1000000 : v; },
      write: (d, o, v) => { d[o] = (v >> 16) & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = v & 0xff; },
    },

    // Binary display (format-only — same read/write as unsigned integers)
    bin8: { size: 1,
      read: (d, o) => d[o],
      write: (d, o, v) => { d[o] = v & 0xff; },
      format: v => '0b' + (v >>> 0).toString(2).padStart(8, '0'),
    },
    bin16le: { size: 2,
      read: (d, o) => d[o] | (d[o+1] << 8),
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; },
      format: v => '0b' + (v >>> 0).toString(2).padStart(16, '0'),
    },
    bin16be: { size: 2,
      read: (d, o) => (d[o] << 8) | d[o+1],
      write: (d, o, v) => { d[o] = (v >> 8) & 0xff; d[o+1] = v & 0xff; },
      format: v => '0b' + (v >>> 0).toString(2).padStart(16, '0'),
    },
    bin32le: { size: 4,
      read: (d, o) => (d[o] | (d[o+1] << 8) | (d[o+2] << 16) | (d[o+3] << 24)) >>> 0,
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; d[o+3] = (v >> 24) & 0xff; },
      format: v => '0b' + (v >>> 0).toString(2).padStart(32, '0'),
    },
    bin32be: { size: 4,
      read: (d, o) => ((d[o] << 24) | (d[o+1] << 16) | (d[o+2] << 8) | d[o+3]) >>> 0,
      write: (d, o, v) => { d[o] = (v >> 24) & 0xff; d[o+1] = (v >> 16) & 0xff; d[o+2] = (v >> 8) & 0xff; d[o+3] = v & 0xff; },
      format: v => '0b' + (v >>> 0).toString(2).padStart(32, '0'),
    },

    // Octal display
    oct8: { size: 1,
      read: (d, o) => d[o],
      write: (d, o, v) => { d[o] = v & 0xff; },
      format: v => '0o' + (v >>> 0).toString(8).padStart(3, '0'),
    },
    oct16le: { size: 2,
      read: (d, o) => d[o] | (d[o+1] << 8),
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; },
      format: v => '0o' + (v >>> 0).toString(8).padStart(6, '0'),
    },
    oct16be: { size: 2,
      read: (d, o) => (d[o] << 8) | d[o+1],
      write: (d, o, v) => { d[o] = (v >> 8) & 0xff; d[o+1] = v & 0xff; },
      format: v => '0o' + (v >>> 0).toString(8).padStart(6, '0'),
    },
    oct32le: { size: 4,
      read: (d, o) => (d[o] | (d[o+1] << 8) | (d[o+2] << 16) | (d[o+3] << 24)) >>> 0,
      write: (d, o, v) => { d[o] = v & 0xff; d[o+1] = (v >> 8) & 0xff; d[o+2] = (v >> 16) & 0xff; d[o+3] = (v >> 24) & 0xff; },
      format: v => '0o' + (v >>> 0).toString(8).padStart(11, '0'),
    },
    oct32be: { size: 4,
      read: (d, o) => ((d[o] << 24) | (d[o+1] << 16) | (d[o+2] << 8) | d[o+3]) >>> 0,
      write: (d, o, v) => { d[o] = (v >> 24) & 0xff; d[o+1] = (v >> 16) & 0xff; d[o+2] = (v >> 8) & 0xff; d[o+3] = v & 0xff; },
      format: v => '0o' + (v >>> 0).toString(8).padStart(11, '0'),
    },

    // UTF-8 character (variable 1-4 bytes, reads up to one codepoint)
    utf8: { size: 1,
      read: (d, o) => {
        const b0 = d[o];
        if (b0 < 0x80)
          return { cp: b0, len: 1 };
        if ((b0 & 0xE0) === 0xC0 && o + 1 < d.length)
          return { cp: ((b0 & 0x1F) << 6) | (d[o+1] & 0x3F), len: 2 };
        if ((b0 & 0xF0) === 0xE0 && o + 2 < d.length)
          return { cp: ((b0 & 0x0F) << 12) | ((d[o+1] & 0x3F) << 6) | (d[o+2] & 0x3F), len: 3 };
        if ((b0 & 0xF8) === 0xF0 && o + 3 < d.length)
          return { cp: ((b0 & 0x07) << 18) | ((d[o+1] & 0x3F) << 12) | ((d[o+2] & 0x3F) << 6) | (d[o+3] & 0x3F), len: 4 };
        return { cp: b0, len: 1 };
      },
      write: (d, o, v) => { d[o] = (typeof v === 'object' ? v.cp : v) & 0xff; },
      format: v => {
        const cp = typeof v === 'object' ? v.cp : v;
        const ch = String.fromCodePoint(cp);
        const len = typeof v === 'object' ? v.len : 1;
        return "'" + ch + "' (U+" + cp.toString(16).padStart(4, '0').toUpperCase() + ', ' + len + 'b)';
      },
    },
  };

  function _readU64LE(d, o) {
    const lo = (d[o] | (d[o+1] << 8) | (d[o+2] << 16) | (d[o+3] << 24)) >>> 0;
    const hi = (d[o+4] | (d[o+5] << 8) | (d[o+6] << 16) | (d[o+7] << 24)) >>> 0;
    return hi * 0x100000000 + lo;
  }

  function _writeU64LE(d, o, v) {
    const lo = v >>> 0;
    const hi = Math.floor(v / 0x100000000) >>> 0;
    d[o] = lo & 0xff; d[o+1] = (lo >> 8) & 0xff; d[o+2] = (lo >> 16) & 0xff; d[o+3] = (lo >> 24) & 0xff;
    d[o+4] = hi & 0xff; d[o+5] = (hi >> 8) & 0xff; d[o+6] = (hi >> 16) & 0xff; d[o+7] = (hi >> 24) & 0xff;
  }

  function _readF16(bits) {
    const sign = (bits >> 15) & 1;
    const exp = (bits >> 10) & 0x1F;
    const frac = bits & 0x3FF;
    if (exp === 0)
      return (sign ? -1 : 1) * Math.pow(2, -14) * (frac / 1024);
    if (exp === 0x1F)
      return frac ? NaN : (sign ? -Infinity : Infinity);
    return (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + frac / 1024);
  }

  function _writeF16(v) {
    if (isNaN(v)) return 0x7E00;
    if (!isFinite(v)) return v > 0 ? 0x7C00 : 0xFC00;
    if (v === 0) return (1 / v < 0) ? 0x8000 : 0;
    const sign = v < 0 ? 1 : 0;
    v = Math.abs(v);
    const exp = Math.floor(Math.log2(v));
    if (exp > 15) return sign ? 0xFC00 : 0x7C00;
    if (exp < -14) {
      const frac = Math.round(v / Math.pow(2, -14) * 1024);
      return (sign << 15) | (frac & 0x3FF);
    }
    const frac = Math.round((v / Math.pow(2, exp) - 1) * 1024);
    return (sign << 15) | (((exp + 15) & 0x1F) << 10) | (frac & 0x3FF);
  }

  function _readU64BE(d, o) {
    const hi = ((d[o] << 24) | (d[o+1] << 16) | (d[o+2] << 8) | d[o+3]) >>> 0;
    const lo = ((d[o+4] << 24) | (d[o+5] << 16) | (d[o+6] << 8) | d[o+7]) >>> 0;
    return hi * 0x100000000 + lo;
  }

  function _writeU64BE(d, o, v) {
    const lo = v >>> 0;
    const hi = Math.floor(v / 0x100000000) >>> 0;
    d[o] = (hi >> 24) & 0xff; d[o+1] = (hi >> 16) & 0xff; d[o+2] = (hi >> 8) & 0xff; d[o+3] = hi & 0xff;
    d[o+4] = (lo >> 24) & 0xff; d[o+5] = (lo >> 16) & 0xff; d[o+6] = (lo >> 8) & 0xff; d[o+7] = lo & 0xff;
  }

  // Endian-agnostic aliases resolved at evaluation time
  const ENDIAN_ALIASES = {
    uint16: e => e === 'be' ? 'uint16be' : 'uint16le',
    int16:  e => e === 'be' ? 'int16be'  : 'int16le',
    uint32: e => e === 'be' ? 'uint32be' : 'uint32le',
    int32:  e => e === 'be' ? 'int32be'  : 'int32le',
    uint64: e => e === 'be' ? 'uint64be' : 'uint64le',
    float32: e => e === 'be' ? 'float32be' : 'float32le',
    float64: e => e === 'be' ? 'float64be' : 'float64le',
    int64:   e => e === 'be' ? 'int64be'   : 'int64le',
    float16: e => e === 'be' ? 'float16be' : 'float16le',
    unix32:  e => e === 'be' ? 'unix32be'  : 'unix32le',
    unix64:  e => e === 'be' ? 'unix64be'  : 'unix64le',
    uint24:  e => e === 'be' ? 'uint24be'  : 'uint24le',
    int24:   e => e === 'be' ? 'int24be'   : 'int24le',
    bin16:   e => e === 'be' ? 'bin16be'   : 'bin16le',
    bin32:   e => e === 'be' ? 'bin32be'   : 'bin32le',
    oct16:   e => e === 'be' ? 'oct16be'   : 'oct16le',
    oct32:   e => e === 'be' ? 'oct32be'   : 'oct32le',
    rgba32:  () => 'rgba32le',
    bgra32:  () => 'bgra32le',
    rgb565:  () => 'rgb565le',
    bcd16:   () => 'bcd16le',
    bcd32:   () => 'bcd32le',
  };

  function resolveType(typeName, endian) {
    if (TYPES[typeName])
      return typeName;
    const resolver = ENDIAN_ALIASES[typeName];
    if (resolver)
      return resolver(endian || 'le');
    return null;
  }

  function getTypeSize(typeName) {
    const resolved = resolveType(typeName, 'le');
    return resolved && TYPES[resolved] ? TYPES[resolved].size : 0;
  }

  // -----------------------------------------------------------------------
  // StructTemplate class
  // -----------------------------------------------------------------------
  class StructTemplate {

    #def;

    constructor(def) {
      this.#def = def;
    }

    get id() { return this.#def.id; }
    get label() { return this.#def.label || this.#def.id; }
    get endian() { return this.#def.endian || 'le'; }
    get fields() { return this.#def.fields; }
    get magic() { return this.#def.magic || null; }
    get extensions() { return this.#def.extensions || null; }
    get headerOffset() { return this.#def.headerOffset || 0; }

    matches(data) {
      const magic = this.magic;
      if (!magic || !data || data.length < magic.length)
        return false;
      for (let i = 0; i < magic.length; ++i) {
        if (magic[i] !== null && data[i] !== magic[i])
          return false;
      }
      return true;
    }

    evaluate(data, baseOffset) {
      baseOffset = baseOffset || 0;
      return this.#evaluateFields(this.fields, data, baseOffset, this.endian);
    }

    #evaluateFields(fields, data, baseOffset, parentEndian) {
      const results = [];
      let currentOffset = baseOffset;
      let bitPos = 0;
      let bitBase = -1;
      let bitStorageSize = 0;

      for (const field of fields) {
        const endian = field.endian || parentEndian;
        const fieldOffset = field.offset != null ? baseOffset + field.offset : currentOffset;

        // Bitfield handling
        if (field.bitSize != null && field.bitSize > 0) {
          const resolvedName = resolveType(field.type, endian);
          const storageSize = resolvedName ? TYPES[resolvedName].size : 1;

          if (bitBase < 0 || fieldOffset !== bitBase || storageSize !== bitStorageSize) {
            bitBase = fieldOffset;
            bitPos = 0;
            bitStorageSize = storageSize;
          }

          let rawValue = 0;
          if (fieldOffset + storageSize <= data.length) {
            rawValue = TYPES[resolvedName].read(data, fieldOffset);
            if (storageSize <= 4)
              rawValue = rawValue >>> 0;
          }

          const mask = ((1 << field.bitSize) - 1) >>> 0;
          let value;
          if (endian === 'be')
            value = (rawValue >>> (storageSize * 8 - bitPos - field.bitSize)) & mask;
          else
            value = (rawValue >>> bitPos) & mask;

          const node = {
            field,
            offset: fieldOffset,
            size: storageSize,
            value,
            bitOffset: bitPos,
            bitSize: field.bitSize,
          };

          if (field.display === 'enum' && field.enumMap && field.enumMap[value] != null)
            node.displayValue = field.enumMap[value];

          results.push(node);
          bitPos += field.bitSize;

          if (field.offset == null)
            currentOffset = fieldOffset + storageSize;

          continue;
        }

        // Reset bitfield state for non-bitfield
        bitBase = -1;
        bitPos = 0;

        // Union: all children share same base
        if (field.type === 'union') {
          const children = this.#evaluateFields(field.children || [], data, fieldOffset, endian);
          let unionSize = 0;
          for (const child of children) {
            const childEnd = (child.offset - fieldOffset) + child.size;
            if (childEnd > unionSize)
              unionSize = childEnd;
          }
          const node = {
            field,
            offset: fieldOffset,
            size: field.size || unionSize,
            value: null,
            children,
          };
          results.push(node);
          if (field.offset == null)
            currentOffset = fieldOffset + node.size;
          continue;
        }

        // Nested struct
        if (field.type === 'struct') {
          const children = this.#evaluateFields(field.children || [], data, fieldOffset, endian);
          let structSize = 0;
          for (const child of children) {
            const childEnd = (child.offset - fieldOffset) + child.size;
            if (childEnd > structSize)
              structSize = childEnd;
          }
          const node = {
            field,
            offset: fieldOffset,
            size: field.size || structSize,
            value: null,
            children,
          };
          results.push(node);
          if (field.offset == null)
            currentOffset = fieldOffset + node.size;
          continue;
        }

        // char[N] — fixed ASCII string
        const charMatch = field.type.match(/^char\[(\d+)\]$/);
        if (charMatch) {
          const count = parseInt(charMatch[1], 10);
          let str = '';
          for (let i = 0; i < count && fieldOffset + i < data.length; ++i)
            str += String.fromCharCode(data[fieldOffset + i]);
          const node = {
            field,
            offset: fieldOffset,
            size: count,
            value: str,
          };
          results.push(node);
          if (field.offset == null)
            currentOffset = fieldOffset + count;
          continue;
        }

        // wchar[N] — fixed UTF-16LE string
        const wcharMatch = field.type.match(/^wchar\[(\d+)\]$/);
        if (wcharMatch) {
          const count = parseInt(wcharMatch[1], 10);
          const byteSize = count * 2;
          let str = '';
          for (let i = 0; i < count && fieldOffset + i * 2 + 1 < data.length; ++i)
            str += String.fromCharCode(data[fieldOffset + i * 2] | (data[fieldOffset + i * 2 + 1] << 8));
          const node = {
            field,
            offset: fieldOffset,
            size: byteSize,
            value: str,
          };
          results.push(node);
          if (field.offset == null)
            currentOffset = fieldOffset + byteSize;
          continue;
        }

        // Primitive type (possibly array)
        const resolvedName = resolveType(field.type, endian);
        if (!resolvedName) {
          // Unknown type — skip with estimated size
          const skipSize = field.size || 1;
          results.push({ field, offset: fieldOffset, size: skipSize, value: '???' });
          if (field.offset == null)
            currentOffset = fieldOffset + skipSize;
          continue;
        }

        const typeInfo = TYPES[resolvedName];
        const count = field.count || 1;
        const totalSize = typeInfo.size * count;

        if (count === 1) {
          let value = null;
          if (fieldOffset + typeInfo.size <= data.length)
            value = typeInfo.read(data, fieldOffset);
          const node = {
            field,
            offset: fieldOffset,
            size: typeInfo.size,
            value,
          };
          if (field.display === 'enum' && field.enumMap && field.enumMap[value] != null)
            node.displayValue = field.enumMap[value];
          if (field.display === 'flags' && field.enumMap)
            node.displayValue = _formatFlags(value, field.enumMap);
          results.push(node);
        } else {
          // Array
          const children = [];
          for (let i = 0; i < count; ++i) {
            const elemOffset = fieldOffset + i * typeInfo.size;
            let value = null;
            if (elemOffset + typeInfo.size <= data.length)
              value = typeInfo.read(data, elemOffset);
            children.push({
              field: { name: '[' + i + ']', type: field.type, display: field.display, enumMap: field.enumMap },
              offset: elemOffset,
              size: typeInfo.size,
              value,
            });
          }
          results.push({
            field,
            offset: fieldOffset,
            size: totalSize,
            value: null,
            children,
          });
        }

        if (field.offset == null)
          currentOffset = fieldOffset + totalSize;
      }

      return results;
    }

    writeValue(data, node, newValue) {
      if (node.bitSize != null && node.bitSize > 0) {
        const endian = node.field.endian || this.endian;
        const resolvedName = resolveType(node.field.type, endian);
        if (!resolvedName)
          return;
        const typeInfo = TYPES[resolvedName];
        let raw = typeInfo.read(data, node.offset);
        if (typeInfo.size <= 4)
          raw = raw >>> 0;
        const mask = ((1 << node.bitSize) - 1) >>> 0;
        const clampedValue = newValue & mask;
        if (endian === 'be') {
          const shift = typeInfo.size * 8 - node.bitOffset - node.bitSize;
          raw = (raw & ~(mask << shift)) | (clampedValue << shift);
        } else {
          raw = (raw & ~(mask << node.bitOffset)) | (clampedValue << node.bitOffset);
        }
        typeInfo.write(data, node.offset, raw);
        return;
      }

      const endian = node.field.endian || this.endian;
      const charMatch = node.field.type.match(/^char\[(\d+)\]$/);
      if (charMatch) {
        const count = parseInt(charMatch[1], 10);
        const str = String(newValue);
        for (let i = 0; i < count; ++i)
          data[node.offset + i] = i < str.length ? str.charCodeAt(i) & 0xff : 0;
        return;
      }

      const wcharMatch = node.field.type.match(/^wchar\[(\d+)\]$/);
      if (wcharMatch) {
        const count = parseInt(wcharMatch[1], 10);
        const str = String(newValue);
        for (let i = 0; i < count; ++i) {
          const ch = i < str.length ? str.charCodeAt(i) : 0;
          data[node.offset + i * 2] = ch & 0xff;
          data[node.offset + i * 2 + 1] = (ch >> 8) & 0xff;
        }
        return;
      }

      const resolvedName = resolveType(node.field.type, endian);
      if (!resolvedName)
        return;
      TYPES[resolvedName].write(data, node.offset, newValue);
    }
  }

  function _formatFlags(value, enumMap) {
    const parts = [];
    for (const [bit, label] of Object.entries(enumMap)) {
      if (value & parseInt(bit, 10))
        parts.push(label);
    }
    return parts.length > 0 ? parts.join(' | ') : 'none';
  }

  // -----------------------------------------------------------------------
  // Template registry
  // -----------------------------------------------------------------------
  const _registry = new Map();

  function registerTemplate(id, def) {
    def.id = id;
    _registry.set(id, new StructTemplate(def));
  }

  function getTemplate(id) {
    return _registry.get(id) || null;
  }

  function allTemplates() {
    return Array.from(_registry.values());
  }

  function detectTemplate(data, filename) {
    if (!data || data.length === 0)
      return null;
    // Primary: magic byte detection
    for (const tmpl of _registry.values()) {
      if (tmpl.matches(data))
        return tmpl;
    }
    // Fallback: file extension matching
    if (filename) {
      const dot = filename.lastIndexOf('.');
      if (dot >= 0) {
        const ext = filename.substring(dot + 1).toLowerCase();
        for (const tmpl of _registry.values()) {
          if (tmpl.extensions && tmpl.extensions.includes(ext))
            return tmpl;
        }
      }
    }
    return null;
  }

  // -----------------------------------------------------------------------
  // Exports
  // -----------------------------------------------------------------------
  StructEngine.TYPES = TYPES;
  StructEngine.resolveType = resolveType;
  StructEngine.getTypeSize = getTypeSize;
  StructEngine.StructTemplate = StructTemplate;
  StructEngine.registerTemplate = registerTemplate;
  StructEngine.getTemplate = getTemplate;
  StructEngine.allTemplates = allTemplates;
  StructEngine.detectTemplate = detectTemplate;

})();
