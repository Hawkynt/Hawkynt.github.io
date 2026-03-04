;(function() {
  'use strict';
  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // Dalvik Bytecode Decoder
  // =========================================================================
  // Register-based VM. Instructions are 16-bit code units (little-endian).
  // Registers named v0-v65535.
  // =========================================================================

  // -------------------------------------------------------------------------
  // Helpers — little-endian reads
  // -------------------------------------------------------------------------

  function u8(bytes, off) {
    return off < bytes.length ? bytes[off] : 0;
  }

  function u16le(bytes, off) {
    return off + 1 < bytes.length ? bytes[off] | (bytes[off + 1] << 8) : 0;
  }

  function i16le(bytes, off) {
    const v = u16le(bytes, off);
    return v > 0x7FFF ? v - 0x10000 : v;
  }

  function u32le(bytes, off) {
    if (off + 3 >= bytes.length) return 0;
    return (bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24)) >>> 0;
  }

  function i32le(bytes, off) {
    return u32le(bytes, off) | 0;
  }

  function i64Hex(bytes, off) {
    const lo = u32le(bytes, off);
    const hi = u32le(bytes, off + 4);
    return '0x' + hi.toString(16).padStart(8, '0').toUpperCase() + lo.toString(16).padStart(8, '0').toUpperCase();
  }

  function hex(n) {
    return '0x' + (n >>> 0).toString(16).toUpperCase();
  }

  function hexS(n) {
    if (n < 0) return '-0x' + ((-n) >>> 0).toString(16).toUpperCase();
    return '0x' + (n >>> 0).toString(16).toUpperCase();
  }

  function v(r) { return 'v' + r; }

  function signExtend4(n) { return (n & 0x8) ? n - 16 : n; }
  function signExtend8(n) { return (n & 0x80) ? n - 256 : n; }

  // -------------------------------------------------------------------------
  // DEX ID table resolution
  // -------------------------------------------------------------------------

  function resolveString(opts, idx) {
    if (opts && opts.strings && idx >= 0 && idx < opts.strings.length)
      return '"' + opts.strings[idx] + '"';
    return 'string@' + idx;
  }

  function resolveType(opts, idx) {
    if (opts && opts.types && idx >= 0 && idx < opts.types.length)
      return opts.types[idx];
    return 'type@' + idx;
  }

  function resolveMethod(opts, idx) {
    if (opts && opts.methods && idx >= 0 && idx < opts.methods.length)
      return opts.methods[idx];
    return 'method@' + idx;
  }

  function resolveField(opts, idx) {
    if (opts && opts.fields && idx >= 0 && idx < opts.fields.length)
      return opts.fields[idx];
    return 'field@' + idx;
  }

  // =========================================================================
  // Instruction formats
  // =========================================================================
  // Each format name: NNx where NN = number of 16-bit code units, x = types
  //   10x: 1 unit, op only
  //   12x: 1 unit, op|A(4)|B(4)
  //   11n: 1 unit, op|A(4)|B(signed 4)
  //   11x: 1 unit, op|AA(8)
  //   10t: 1 unit, op|AA(signed 8)
  //   20t: 2 units, op|00|AAAA(signed 16)
  //   22x: 2 units, op|AA|BBBB
  //   21s: 2 units, op|AA|BBBB(signed 16)
  //   21h: 2 units, op|AA|BBBB(high16)
  //   21c: 2 units, op|AA|BBBB(index)
  //   21t: 2 units, op|AA|BBBB(signed 16 branch offset)
  //   23x: 2 units, op|AA|BB|CC
  //   22t: 2 units, op|A(4)|B(4)|CCCC(signed 16 branch offset)
  //   22s: 2 units, op|A(4)|B(4)|CCCC(signed 16 literal)
  //   22b: 2 units, op|AA|BB|CC(signed 8 literal)
  //   22c: 2 units, op|A(4)|B(4)|CCCC(index)
  //   30t: 3 units, op|00|AAAAAAAAlo|hi (signed 32 branch offset)
  //   32x: 3 units, op|00|AAAA|BBBB
  //   31i: 3 units, op|AA|BBBBBBBBlo|hi (32-bit literal)
  //   31c: 3 units, op|AA|BBBBBBBBlo|hi (32-bit string index)
  //   31t: 3 units, op|AA|BBBBBBBBlo|hi (signed 32 branch offset to data)
  //   35c: 3 units, op|A(4)|G(4)|BBBB|F(4)|E(4)|D(4)|C(4)
  //   3rc: 3 units, op|AA|BBBB|CCCC
  //   51l: 5 units, op|AA|BBBBBBBBBBBBBBBBlo..hi (64-bit literal)
  // =========================================================================

  const FMT_10x = '10x';
  const FMT_12x = '12x';
  const FMT_11n = '11n';
  const FMT_11x = '11x';
  const FMT_10t = '10t';
  const FMT_20t = '20t';
  const FMT_22x = '22x';
  const FMT_21s = '21s';
  const FMT_21h = '21h';
  const FMT_21c = '21c';
  const FMT_21t = '21t';
  const FMT_23x = '23x';
  const FMT_22t = '22t';
  const FMT_22s = '22s';
  const FMT_22b = '22b';
  const FMT_22c = '22c';
  const FMT_30t = '30t';
  const FMT_32x = '32x';
  const FMT_31i = '31i';
  const FMT_31c = '31c';
  const FMT_31t = '31t';
  const FMT_35c = '35c';
  const FMT_3rc = '3rc';
  const FMT_51l = '51l';

  // =========================================================================
  // Complete opcode table 0x00-0xFF
  // =========================================================================

  const OPCODES = new Array(256).fill(null);

  function def(code, name, format) {
    OPCODES[code] = { name, format };
  }

  // 0x00 nop
  def(0x00, 'nop', FMT_10x);
  // 0x01-0x09 move variants
  def(0x01, 'move', FMT_12x);
  def(0x02, 'move/from16', FMT_22x);
  def(0x03, 'move/16', FMT_32x);
  def(0x04, 'move-wide', FMT_12x);
  def(0x05, 'move-wide/from16', FMT_22x);
  def(0x06, 'move-wide/16', FMT_32x);
  def(0x07, 'move-object', FMT_12x);
  def(0x08, 'move-object/from16', FMT_22x);
  def(0x09, 'move-object/16', FMT_32x);
  // 0x0A-0x0D move-result
  def(0x0A, 'move-result', FMT_11x);
  def(0x0B, 'move-result-wide', FMT_11x);
  def(0x0C, 'move-result-object', FMT_11x);
  def(0x0D, 'move-exception', FMT_11x);
  // 0x0E return-void
  def(0x0E, 'return-void', FMT_10x);
  // 0x0F-0x11 return
  def(0x0F, 'return', FMT_11x);
  def(0x10, 'return-wide', FMT_11x);
  def(0x11, 'return-object', FMT_11x);
  // 0x12-0x19 const
  def(0x12, 'const/4', FMT_11n);
  def(0x13, 'const/16', FMT_21s);
  def(0x14, 'const', FMT_31i);
  def(0x15, 'const/high16', FMT_21h);
  def(0x16, 'const-wide/16', FMT_21s);
  def(0x17, 'const-wide/32', FMT_31i);
  def(0x18, 'const-wide', FMT_51l);
  def(0x19, 'const-wide/high16', FMT_21h);
  // 0x1A-0x1C const-string, const-class
  def(0x1A, 'const-string', FMT_21c);
  def(0x1B, 'const-string/jumbo', FMT_31c);
  def(0x1C, 'const-class', FMT_21c);
  // 0x1D-0x1E monitor
  def(0x1D, 'monitor-enter', FMT_11x);
  def(0x1E, 'monitor-exit', FMT_11x);
  // 0x1F check-cast
  def(0x1F, 'check-cast', FMT_21c);
  // 0x20 instance-of
  def(0x20, 'instance-of', FMT_22c);
  // 0x21 array-length
  def(0x21, 'array-length', FMT_12x);
  // 0x22 new-instance
  def(0x22, 'new-instance', FMT_21c);
  // 0x23 new-array
  def(0x23, 'new-array', FMT_22c);
  // 0x24-0x25 filled-new-array
  def(0x24, 'filled-new-array', FMT_35c);
  def(0x25, 'filled-new-array/range', FMT_3rc);
  // 0x26 fill-array-data
  def(0x26, 'fill-array-data', FMT_31t);
  // 0x27 throw
  def(0x27, 'throw', FMT_11x);
  // 0x28-0x2A goto
  def(0x28, 'goto', FMT_10t);
  def(0x29, 'goto/16', FMT_20t);
  def(0x2A, 'goto/32', FMT_30t);
  // 0x2B-0x2C switch
  def(0x2B, 'packed-switch', FMT_31t);
  def(0x2C, 'sparse-switch', FMT_31t);
  // 0x2D-0x31 cmp
  def(0x2D, 'cmpl-float', FMT_23x);
  def(0x2E, 'cmpg-float', FMT_23x);
  def(0x2F, 'cmpl-double', FMT_23x);
  def(0x30, 'cmpg-double', FMT_23x);
  def(0x31, 'cmp-long', FMT_23x);
  // 0x32-0x37 if-test
  def(0x32, 'if-eq', FMT_22t);
  def(0x33, 'if-ne', FMT_22t);
  def(0x34, 'if-lt', FMT_22t);
  def(0x35, 'if-ge', FMT_22t);
  def(0x36, 'if-gt', FMT_22t);
  def(0x37, 'if-le', FMT_22t);
  // 0x38-0x3D if-testz
  def(0x38, 'if-eqz', FMT_21t);
  def(0x39, 'if-nez', FMT_21t);
  def(0x3A, 'if-ltz', FMT_21t);
  def(0x3B, 'if-gez', FMT_21t);
  def(0x3C, 'if-gtz', FMT_21t);
  def(0x3D, 'if-lez', FMT_21t);
  // 0x3E-0x43 (unused)
  // 0x44-0x4A aget
  def(0x44, 'aget', FMT_23x);
  def(0x45, 'aget-wide', FMT_23x);
  def(0x46, 'aget-object', FMT_23x);
  def(0x47, 'aget-boolean', FMT_23x);
  def(0x48, 'aget-byte', FMT_23x);
  def(0x49, 'aget-char', FMT_23x);
  def(0x4A, 'aget-short', FMT_23x);
  // 0x4B-0x51 aput
  def(0x4B, 'aput', FMT_23x);
  def(0x4C, 'aput-wide', FMT_23x);
  def(0x4D, 'aput-object', FMT_23x);
  def(0x4E, 'aput-boolean', FMT_23x);
  def(0x4F, 'aput-byte', FMT_23x);
  def(0x50, 'aput-char', FMT_23x);
  def(0x51, 'aput-short', FMT_23x);
  // 0x52-0x58 iget
  def(0x52, 'iget', FMT_22c);
  def(0x53, 'iget-wide', FMT_22c);
  def(0x54, 'iget-object', FMT_22c);
  def(0x55, 'iget-boolean', FMT_22c);
  def(0x56, 'iget-byte', FMT_22c);
  def(0x57, 'iget-char', FMT_22c);
  def(0x58, 'iget-short', FMT_22c);
  // 0x59-0x5F iput
  def(0x59, 'iput', FMT_22c);
  def(0x5A, 'iput-wide', FMT_22c);
  def(0x5B, 'iput-object', FMT_22c);
  def(0x5C, 'iput-boolean', FMT_22c);
  def(0x5D, 'iput-byte', FMT_22c);
  def(0x5E, 'iput-char', FMT_22c);
  def(0x5F, 'iput-short', FMT_22c);
  // 0x60-0x66 sget
  def(0x60, 'sget', FMT_21c);
  def(0x61, 'sget-wide', FMT_21c);
  def(0x62, 'sget-object', FMT_21c);
  def(0x63, 'sget-boolean', FMT_21c);
  def(0x64, 'sget-byte', FMT_21c);
  def(0x65, 'sget-char', FMT_21c);
  def(0x66, 'sget-short', FMT_21c);
  // 0x67-0x6D sput
  def(0x67, 'sput', FMT_21c);
  def(0x68, 'sput-wide', FMT_21c);
  def(0x69, 'sput-object', FMT_21c);
  def(0x6A, 'sput-boolean', FMT_21c);
  def(0x6B, 'sput-byte', FMT_21c);
  def(0x6C, 'sput-char', FMT_21c);
  def(0x6D, 'sput-short', FMT_21c);
  // 0x6E-0x72 invoke
  def(0x6E, 'invoke-virtual', FMT_35c);
  def(0x6F, 'invoke-super', FMT_35c);
  def(0x70, 'invoke-direct', FMT_35c);
  def(0x71, 'invoke-static', FMT_35c);
  def(0x72, 'invoke-interface', FMT_35c);
  // 0x73 (unused)
  // 0x74-0x78 invoke/range
  def(0x74, 'invoke-virtual/range', FMT_3rc);
  def(0x75, 'invoke-super/range', FMT_3rc);
  def(0x76, 'invoke-direct/range', FMT_3rc);
  def(0x77, 'invoke-static/range', FMT_3rc);
  def(0x78, 'invoke-interface/range', FMT_3rc);
  // 0x79-0x7A (unused)
  // 0x7B-0x8F unary ops (12x)
  def(0x7B, 'neg-int', FMT_12x);
  def(0x7C, 'not-int', FMT_12x);
  def(0x7D, 'neg-long', FMT_12x);
  def(0x7E, 'not-long', FMT_12x);
  def(0x7F, 'neg-float', FMT_12x);
  def(0x80, 'neg-double', FMT_12x);
  def(0x81, 'int-to-long', FMT_12x);
  def(0x82, 'int-to-float', FMT_12x);
  def(0x83, 'int-to-double', FMT_12x);
  def(0x84, 'long-to-int', FMT_12x);
  def(0x85, 'long-to-float', FMT_12x);
  def(0x86, 'long-to-double', FMT_12x);
  def(0x87, 'float-to-int', FMT_12x);
  def(0x88, 'float-to-long', FMT_12x);
  def(0x89, 'float-to-double', FMT_12x);
  def(0x8A, 'double-to-int', FMT_12x);
  def(0x8B, 'double-to-long', FMT_12x);
  def(0x8C, 'double-to-float', FMT_12x);
  def(0x8D, 'int-to-byte', FMT_12x);
  def(0x8E, 'int-to-char', FMT_12x);
  def(0x8F, 'int-to-short', FMT_12x);
  // 0x90-0xAF binary ops (23x) — add through rem-double
  def(0x90, 'add-int', FMT_23x);
  def(0x91, 'sub-int', FMT_23x);
  def(0x92, 'mul-int', FMT_23x);
  def(0x93, 'div-int', FMT_23x);
  def(0x94, 'rem-int', FMT_23x);
  def(0x95, 'and-int', FMT_23x);
  def(0x96, 'or-int', FMT_23x);
  def(0x97, 'xor-int', FMT_23x);
  def(0x98, 'shl-int', FMT_23x);
  def(0x99, 'shr-int', FMT_23x);
  def(0x9A, 'ushr-int', FMT_23x);
  def(0x9B, 'add-long', FMT_23x);
  def(0x9C, 'sub-long', FMT_23x);
  def(0x9D, 'mul-long', FMT_23x);
  def(0x9E, 'div-long', FMT_23x);
  def(0x9F, 'rem-long', FMT_23x);
  def(0xA0, 'and-long', FMT_23x);
  def(0xA1, 'or-long', FMT_23x);
  def(0xA2, 'xor-long', FMT_23x);
  def(0xA3, 'shl-long', FMT_23x);
  def(0xA4, 'shr-long', FMT_23x);
  def(0xA5, 'ushr-long', FMT_23x);
  def(0xA6, 'add-float', FMT_23x);
  def(0xA7, 'sub-float', FMT_23x);
  def(0xA8, 'mul-float', FMT_23x);
  def(0xA9, 'div-float', FMT_23x);
  def(0xAA, 'rem-float', FMT_23x);
  def(0xAB, 'add-double', FMT_23x);
  def(0xAC, 'sub-double', FMT_23x);
  def(0xAD, 'mul-double', FMT_23x);
  def(0xAE, 'div-double', FMT_23x);
  def(0xAF, 'rem-double', FMT_23x);
  // 0xB0-0xCF binary ops 2addr (12x)
  def(0xB0, 'add-int/2addr', FMT_12x);
  def(0xB1, 'sub-int/2addr', FMT_12x);
  def(0xB2, 'mul-int/2addr', FMT_12x);
  def(0xB3, 'div-int/2addr', FMT_12x);
  def(0xB4, 'rem-int/2addr', FMT_12x);
  def(0xB5, 'and-int/2addr', FMT_12x);
  def(0xB6, 'or-int/2addr', FMT_12x);
  def(0xB7, 'xor-int/2addr', FMT_12x);
  def(0xB8, 'shl-int/2addr', FMT_12x);
  def(0xB9, 'shr-int/2addr', FMT_12x);
  def(0xBA, 'ushr-int/2addr', FMT_12x);
  def(0xBB, 'add-long/2addr', FMT_12x);
  def(0xBC, 'sub-long/2addr', FMT_12x);
  def(0xBD, 'mul-long/2addr', FMT_12x);
  def(0xBE, 'div-long/2addr', FMT_12x);
  def(0xBF, 'rem-long/2addr', FMT_12x);
  def(0xC0, 'and-long/2addr', FMT_12x);
  def(0xC1, 'or-long/2addr', FMT_12x);
  def(0xC2, 'xor-long/2addr', FMT_12x);
  def(0xC3, 'shl-long/2addr', FMT_12x);
  def(0xC4, 'shr-long/2addr', FMT_12x);
  def(0xC5, 'ushr-long/2addr', FMT_12x);
  def(0xC6, 'add-float/2addr', FMT_12x);
  def(0xC7, 'sub-float/2addr', FMT_12x);
  def(0xC8, 'mul-float/2addr', FMT_12x);
  def(0xC9, 'div-float/2addr', FMT_12x);
  def(0xCA, 'rem-float/2addr', FMT_12x);
  def(0xCB, 'add-double/2addr', FMT_12x);
  def(0xCC, 'sub-double/2addr', FMT_12x);
  def(0xCD, 'mul-double/2addr', FMT_12x);
  def(0xCE, 'div-double/2addr', FMT_12x);
  def(0xCF, 'rem-double/2addr', FMT_12x);
  // 0xD0-0xD7 binop/lit16 (22s)
  def(0xD0, 'add-int/lit16', FMT_22s);
  def(0xD1, 'rsub-int', FMT_22s);
  def(0xD2, 'mul-int/lit16', FMT_22s);
  def(0xD3, 'div-int/lit16', FMT_22s);
  def(0xD4, 'rem-int/lit16', FMT_22s);
  def(0xD5, 'and-int/lit16', FMT_22s);
  def(0xD6, 'or-int/lit16', FMT_22s);
  def(0xD7, 'xor-int/lit16', FMT_22s);
  // 0xD8-0xE2 binop/lit8 (22b)
  def(0xD8, 'add-int/lit8', FMT_22b);
  def(0xD9, 'rsub-int/lit8', FMT_22b);
  def(0xDA, 'mul-int/lit8', FMT_22b);
  def(0xDB, 'div-int/lit8', FMT_22b);
  def(0xDC, 'rem-int/lit8', FMT_22b);
  def(0xDD, 'and-int/lit8', FMT_22b);
  def(0xDE, 'or-int/lit8', FMT_22b);
  def(0xDF, 'xor-int/lit8', FMT_22b);
  def(0xE0, 'shl-int/lit8', FMT_22b);
  def(0xE1, 'shr-int/lit8', FMT_22b);
  def(0xE2, 'ushr-int/lit8', FMT_22b);
  // 0xE3-0xFF are unused/implementation-specific — will decode as unknown

  // =========================================================================
  // Operator mappings for pseudo-C
  // =========================================================================

  const BINOP_23X = {
    0x90: '+', 0x91: '-', 0x92: '*', 0x93: '/', 0x94: '%',
    0x95: '&', 0x96: '|', 0x97: '^', 0x98: '<<', 0x99: '>>', 0x9A: '>>>',
    0x9B: '+', 0x9C: '-', 0x9D: '*', 0x9E: '/', 0x9F: '%',
    0xA0: '&', 0xA1: '|', 0xA2: '^', 0xA3: '<<', 0xA4: '>>', 0xA5: '>>>',
    0xA6: '+', 0xA7: '-', 0xA8: '*', 0xA9: '/', 0xAA: '%',
    0xAB: '+', 0xAC: '-', 0xAD: '*', 0xAE: '/', 0xAF: '%',
  };

  const BINOP_2ADDR = {
    0xB0: '+', 0xB1: '-', 0xB2: '*', 0xB3: '/', 0xB4: '%',
    0xB5: '&', 0xB6: '|', 0xB7: '^', 0xB8: '<<', 0xB9: '>>', 0xBA: '>>>',
    0xBB: '+', 0xBC: '-', 0xBD: '*', 0xBE: '/', 0xBF: '%',
    0xC0: '&', 0xC1: '|', 0xC2: '^', 0xC3: '<<', 0xC4: '>>', 0xC5: '>>>',
    0xC6: '+', 0xC7: '-', 0xC8: '*', 0xC9: '/', 0xCA: '%',
    0xCB: '+', 0xCC: '-', 0xCD: '*', 0xCE: '/', 0xCF: '%',
  };

  const BINOP_LIT16 = {
    0xD0: '+', 0xD1: 'rsub', 0xD2: '*', 0xD3: '/', 0xD4: '%',
    0xD5: '&', 0xD6: '|', 0xD7: '^',
  };

  const BINOP_LIT8 = {
    0xD8: '+', 0xD9: 'rsub', 0xDA: '*', 0xDB: '/', 0xDC: '%',
    0xDD: '&', 0xDE: '|', 0xDF: '^', 0xE0: '<<', 0xE1: '>>', 0xE2: '>>>',
  };

  const UNARY_OPS = {
    0x7B: '-', 0x7C: '~',
    0x7D: '-', 0x7E: '~',
    0x7F: '-', 0x80: '-',
  };

  const CONV_OPS = {
    0x81: '(long)', 0x82: '(float)', 0x83: '(double)',
    0x84: '(int)', 0x85: '(float)', 0x86: '(double)',
    0x87: '(int)', 0x88: '(long)', 0x89: '(double)',
    0x8A: '(int)', 0x8B: '(long)', 0x8C: '(float)',
    0x8D: '(byte)', 0x8E: '(char)', 0x8F: '(short)',
  };

  const IF_OPS = {
    0x32: '==', 0x33: '!=', 0x34: '<', 0x35: '>=', 0x36: '>', 0x37: '<=',
  };

  const IFZ_OPS = {
    0x38: '==', 0x39: '!=', 0x3A: '<', 0x3B: '>=', 0x3C: '>', 0x3D: '<=',
  };

  const CMP_OPS = {
    0x2D: 'cmpl', 0x2E: 'cmpg', 0x2F: 'cmpl', 0x30: 'cmpg', 0x31: 'cmp',
  };

  // =========================================================================
  // Format size in bytes (= code units * 2)
  // =========================================================================

  const FORMAT_BYTES = {
    [FMT_10x]: 2, [FMT_12x]: 2, [FMT_11n]: 2, [FMT_11x]: 2, [FMT_10t]: 2,
    [FMT_20t]: 4, [FMT_22x]: 4, [FMT_21s]: 4, [FMT_21h]: 4, [FMT_21c]: 4,
    [FMT_21t]: 4, [FMT_23x]: 4, [FMT_22t]: 4, [FMT_22s]: 4, [FMT_22b]: 4,
    [FMT_22c]: 4,
    [FMT_30t]: 6, [FMT_32x]: 6, [FMT_31i]: 6, [FMT_31c]: 6, [FMT_31t]: 6,
    [FMT_35c]: 6, [FMT_3rc]: 6,
    [FMT_51l]: 10,
  };

  // =========================================================================
  // Main decode function — batch mode
  // =========================================================================

  function decode(bytes, offset, maxCount, opts) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const baseOffset = offset || 0;
    const limit = maxCount || 256;
    const end = view.length;
    const result = [];
    let pos = baseOffset;

    while (result.length < limit && pos + 1 < end) {
      const instrOffset = pos;
      const unit0 = u16le(view, pos);
      const opByte = unit0 & 0xFF;

      const entry = OPCODES[opByte];
      if (!entry) {
        // Unknown opcode — emit as db (2 bytes since Dalvik is 16-bit aligned)
        const len = Math.min(2, end - pos);
        result.push({
          offset: instrOffset,
          length: len,
          bytes: Array.from(view.subarray(instrOffset, instrOffset + len)),
          mnemonic: 'unknown-' + opByte.toString(16).toUpperCase().padStart(2, '0'),
          operands: '',
          pseudoC: '??',
        });
        pos += 2;
        continue;
      }

      const instrSize = FORMAT_BYTES[entry.format] || 2;
      if (pos + instrSize > end) {
        pushDb(result, view, instrOffset, end - instrOffset);
        break;
      }

      const bytesSlice = Array.from(view.subarray(pos, pos + instrSize));
      pos += instrSize;

      // Decode fields from the raw instruction bytes based on format
      let operands = '';
      let pseudoC = '??';

      switch (entry.format) {

        // ---- 10x: just opcode ----
        case FMT_10x:
          if (opByte === 0x0E)
            pseudoC = 'return';
          else
            pseudoC = 'nop';
          break;

        // ---- 12x: op|A(4)|B(4) ----
        case FMT_12x: {
          const a = (unit0 >> 8) & 0xF;
          const b = (unit0 >> 12) & 0xF;
          operands = v(a) + ', ' + v(b);

          if (opByte >= 0x01 && opByte <= 0x09)
            pseudoC = v(a) + ' = ' + v(b);
          else if (opByte === 0x21)
            pseudoC = v(a) + ' = ' + v(b) + '.length';
          else if (UNARY_OPS[opByte])
            pseudoC = v(a) + ' = ' + UNARY_OPS[opByte] + v(b);
          else if (CONV_OPS[opByte])
            pseudoC = v(a) + ' = ' + CONV_OPS[opByte] + v(b);
          else if (BINOP_2ADDR[opByte]) {
            const op = BINOP_2ADDR[opByte];
            pseudoC = v(a) + ' = ' + v(a) + ' ' + op + ' ' + v(b);
          } else
            pseudoC = v(a) + ' = ' + v(b);
          break;
        }

        // ---- 11n: op|A(4)|B(signed 4) ----
        case FMT_11n: {
          const a = (unit0 >> 8) & 0xF;
          const b = signExtend4((unit0 >> 12) & 0xF);
          operands = v(a) + ', ' + b;
          pseudoC = v(a) + ' = ' + b;
          break;
        }

        // ---- 11x: op|AA(8) ----
        case FMT_11x: {
          const aa = (unit0 >> 8) & 0xFF;
          operands = v(aa);

          if (opByte === 0x0F || opByte === 0x10 || opByte === 0x11)
            pseudoC = 'return ' + v(aa);
          else if (opByte === 0x27)
            pseudoC = 'throw ' + v(aa);
          else if (opByte === 0x1D)
            pseudoC = 'monitor-enter(' + v(aa) + ')';
          else if (opByte === 0x1E)
            pseudoC = 'monitor-exit(' + v(aa) + ')';
          else if (opByte >= 0x0A && opByte <= 0x0C)
            pseudoC = v(aa) + ' = result';
          else if (opByte === 0x0D)
            pseudoC = v(aa) + ' = exception';
          else
            pseudoC = v(aa);
          break;
        }

        // ---- 10t: op|AA(signed 8 branch) ----
        case FMT_10t: {
          const off = signExtend8((unit0 >> 8) & 0xFF);
          const target = instrOffset + off * 2;
          operands = hexS(target);
          pseudoC = 'goto ' + hexS(target);
          break;
        }

        // ---- 20t: op|00|AAAA(signed 16 branch) ----
        case FMT_20t: {
          const off = i16le(view, instrOffset + 2);
          const target = instrOffset + off * 2;
          operands = hexS(target);
          pseudoC = 'goto ' + hexS(target);
          break;
        }

        // ---- 30t: op|00|AAAAlo|AAAAhi (signed 32 branch) ----
        case FMT_30t: {
          const off = i32le(view, instrOffset + 2);
          const target = instrOffset + off * 2;
          operands = hexS(target);
          pseudoC = 'goto ' + hexS(target);
          break;
        }

        // ---- 22x: op|AA|BBBB ----
        case FMT_22x: {
          const aa = (unit0 >> 8) & 0xFF;
          const bbbb = u16le(view, instrOffset + 2);
          operands = v(aa) + ', ' + v(bbbb);
          pseudoC = v(aa) + ' = ' + v(bbbb);
          break;
        }

        // ---- 32x: op|00|AAAA|BBBB ----
        case FMT_32x: {
          const aaaa = u16le(view, instrOffset + 2);
          const bbbb = u16le(view, instrOffset + 4);
          operands = v(aaaa) + ', ' + v(bbbb);
          pseudoC = v(aaaa) + ' = ' + v(bbbb);
          break;
        }

        // ---- 21s: op|AA|BBBB(signed 16) ----
        case FMT_21s: {
          const aa = (unit0 >> 8) & 0xFF;
          const lit = i16le(view, instrOffset + 2);
          operands = v(aa) + ', ' + lit;
          pseudoC = v(aa) + ' = ' + lit;
          break;
        }

        // ---- 21h: op|AA|BBBB (high16 — shifted left 16 or 48) ----
        case FMT_21h: {
          const aa = (unit0 >> 8) & 0xFF;
          const raw = u16le(view, instrOffset + 2);
          if (opByte === 0x15) {
            const val = (raw << 16) | 0;
            operands = v(aa) + ', ' + hex(val >>> 0);
            pseudoC = v(aa) + ' = ' + hex(val >>> 0);
          } else {
            // const-wide/high16: value in bits [63:48]
            operands = v(aa) + ', ' + hex(raw) + '000000000000';
            pseudoC = v(aa) + ' = ' + hex(raw) + '000000000000';
          }
          break;
        }

        // ---- 21c: op|AA|BBBB (index into string/type/field table) ----
        case FMT_21c: {
          const aa = (unit0 >> 8) & 0xFF;
          const idx = u16le(view, instrOffset + 2);

          if (opByte === 0x1A) {
            const s = resolveString(opts, idx);
            operands = v(aa) + ', ' + s;
            pseudoC = v(aa) + ' = ' + s;
          } else if (opByte === 0x1C) {
            const t = resolveType(opts, idx);
            operands = v(aa) + ', ' + t;
            pseudoC = v(aa) + ' = ' + t + '.class';
          } else if (opByte === 0x1F) {
            const t = resolveType(opts, idx);
            operands = v(aa) + ', ' + t;
            pseudoC = '(' + t + ')' + v(aa);
          } else if (opByte === 0x22) {
            const t = resolveType(opts, idx);
            operands = v(aa) + ', ' + t;
            pseudoC = v(aa) + ' = new ' + t;
          } else if (opByte >= 0x60 && opByte <= 0x66) {
            const f = resolveField(opts, idx);
            operands = v(aa) + ', ' + f;
            pseudoC = v(aa) + ' = ' + f;
          } else if (opByte >= 0x67 && opByte <= 0x6D) {
            const f = resolveField(opts, idx);
            operands = v(aa) + ', ' + f;
            pseudoC = f + ' = ' + v(aa);
          } else {
            operands = v(aa) + ', idx@' + idx;
            pseudoC = v(aa) + ' = idx@' + idx;
          }
          break;
        }

        // ---- 21t: op|AA|BBBB(signed 16 branch offset) ----
        case FMT_21t: {
          const aa = (unit0 >> 8) & 0xFF;
          const off = i16le(view, instrOffset + 2);
          const target = instrOffset + off * 2;
          const op = IFZ_OPS[opByte] || '?';
          operands = v(aa) + ', ' + hexS(target);
          pseudoC = 'if (' + v(aa) + ' ' + op + ' 0) goto ' + hexS(target);
          break;
        }

        // ---- 23x: op|AA|BB|CC ----
        case FMT_23x: {
          const aa = (unit0 >> 8) & 0xFF;
          const bb = u8(view, instrOffset + 2);
          const cc = u8(view, instrOffset + 3);
          operands = v(aa) + ', ' + v(bb) + ', ' + v(cc);

          if (BINOP_23X[opByte]) {
            const op = BINOP_23X[opByte];
            pseudoC = v(aa) + ' = ' + v(bb) + ' ' + op + ' ' + v(cc);
          } else if (CMP_OPS[opByte])
            pseudoC = v(aa) + ' = ' + CMP_OPS[opByte] + '(' + v(bb) + ', ' + v(cc) + ')';
          else if (opByte >= 0x44 && opByte <= 0x4A)
            pseudoC = v(aa) + ' = ' + v(bb) + '[' + v(cc) + ']';
          else if (opByte >= 0x4B && opByte <= 0x51)
            pseudoC = v(bb) + '[' + v(cc) + '] = ' + v(aa);
          else
            pseudoC = v(aa) + ' = op(' + v(bb) + ', ' + v(cc) + ')';
          break;
        }

        // ---- 22t: op|A(4)|B(4)|CCCC(signed 16 branch offset) ----
        case FMT_22t: {
          const a = (unit0 >> 8) & 0xF;
          const b = (unit0 >> 12) & 0xF;
          const off = i16le(view, instrOffset + 2);
          const target = instrOffset + off * 2;
          const op = IF_OPS[opByte] || '?';
          operands = v(a) + ', ' + v(b) + ', ' + hexS(target);
          pseudoC = 'if (' + v(a) + ' ' + op + ' ' + v(b) + ') goto ' + hexS(target);
          break;
        }

        // ---- 22s: op|A(4)|B(4)|CCCC(signed 16 literal) ----
        case FMT_22s: {
          const a = (unit0 >> 8) & 0xF;
          const b = (unit0 >> 12) & 0xF;
          const lit = i16le(view, instrOffset + 2);
          const op = BINOP_LIT16[opByte];
          operands = v(a) + ', ' + v(b) + ', ' + lit;
          if (op === 'rsub')
            pseudoC = v(a) + ' = ' + lit + ' - ' + v(b);
          else if (op)
            pseudoC = v(a) + ' = ' + v(b) + ' ' + op + ' ' + lit;
          else
            pseudoC = v(a) + ' = ' + v(b) + ' ? ' + lit;
          break;
        }

        // ---- 22b: op|AA|BB|CC(signed 8 literal) ----
        case FMT_22b: {
          const aa = (unit0 >> 8) & 0xFF;
          const bb = u8(view, instrOffset + 2);
          const lit = signExtend8(u8(view, instrOffset + 3));
          const op = BINOP_LIT8[opByte];
          operands = v(aa) + ', ' + v(bb) + ', ' + lit;
          if (op === 'rsub')
            pseudoC = v(aa) + ' = ' + lit + ' - ' + v(bb);
          else if (op)
            pseudoC = v(aa) + ' = ' + v(bb) + ' ' + op + ' ' + lit;
          else
            pseudoC = v(aa) + ' = ' + v(bb) + ' ? ' + lit;
          break;
        }

        // ---- 22c: op|A(4)|B(4)|CCCC(type/field index) ----
        case FMT_22c: {
          const a = (unit0 >> 8) & 0xF;
          const b = (unit0 >> 12) & 0xF;
          const idx = u16le(view, instrOffset + 2);

          if (opByte === 0x20) {
            const t = resolveType(opts, idx);
            operands = v(a) + ', ' + v(b) + ', ' + t;
            pseudoC = v(a) + ' = ' + v(b) + ' instanceof ' + t;
          } else if (opByte === 0x23) {
            const t = resolveType(opts, idx);
            operands = v(a) + ', ' + v(b) + ', ' + t;
            pseudoC = v(a) + ' = new ' + t + '[' + v(b) + ']';
          } else if (opByte >= 0x52 && opByte <= 0x58) {
            const f = resolveField(opts, idx);
            operands = v(a) + ', ' + v(b) + ', ' + f;
            pseudoC = v(a) + ' = ' + v(b) + '.' + f;
          } else if (opByte >= 0x59 && opByte <= 0x5F) {
            const f = resolveField(opts, idx);
            operands = v(a) + ', ' + v(b) + ', ' + f;
            pseudoC = v(b) + '.' + f + ' = ' + v(a);
          } else {
            operands = v(a) + ', ' + v(b) + ', idx@' + idx;
            pseudoC = v(a) + ' = op(' + v(b) + ', idx@' + idx + ')';
          }
          break;
        }

        // ---- 31i: op|AA|BBBBBBBBlo|hi (32-bit literal) ----
        case FMT_31i: {
          const aa = (unit0 >> 8) & 0xFF;
          const lit = i32le(view, instrOffset + 2);
          operands = v(aa) + ', ' + hex(lit >>> 0);
          pseudoC = v(aa) + ' = ' + lit;
          break;
        }

        // ---- 31c: op|AA|BBBBBBBBlo|hi (32-bit string index) ----
        case FMT_31c: {
          const aa = (unit0 >> 8) & 0xFF;
          const idx = u32le(view, instrOffset + 2);
          const s = resolveString(opts, idx);
          operands = v(aa) + ', ' + s;
          pseudoC = v(aa) + ' = ' + s;
          break;
        }

        // ---- 31t: op|AA|BBBBBBBBlo|hi (signed 32 offset to data payload) ----
        case FMT_31t: {
          const aa = (unit0 >> 8) & 0xFF;
          const off = i32le(view, instrOffset + 2);
          const target = instrOffset + off * 2;
          operands = v(aa) + ', ' + hexS(target);

          if (opByte === 0x26)
            pseudoC = 'fill-array-data ' + v(aa) + ', ' + hexS(target);
          else if (opByte === 0x2B)
            pseudoC = 'packed-switch ' + v(aa) + ', ' + hexS(target);
          else if (opByte === 0x2C)
            pseudoC = 'sparse-switch ' + v(aa) + ', ' + hexS(target);
          else
            pseudoC = v(aa) + ' -> ' + hexS(target);
          break;
        }

        // ---- 35c: op|A(4)|G(4)|BBBB|F(4)|E(4)|D(4)|C(4) ----
        case FMT_35c: {
          const argCount = (unit0 >> 12) & 0xF;
          const g = (unit0 >> 8) & 0xF;
          const idx = u16le(view, instrOffset + 2);
          const unit2 = u16le(view, instrOffset + 4);
          const c = unit2 & 0xF;
          const d = (unit2 >> 4) & 0xF;
          const e = (unit2 >> 8) & 0xF;
          const f = (unit2 >> 12) & 0xF;

          const regs = [c, d, e, f, g].slice(0, argCount);
          const regStr = regs.map(r => v(r)).join(', ');

          if (opByte === 0x24) {
            const t = resolveType(opts, idx);
            operands = '{' + regStr + '}, ' + t;
            pseudoC = 'filled-new-array ' + t + '(' + regStr + ')';
          } else {
            const m = resolveMethod(opts, idx);
            operands = '{' + regStr + '}, ' + m;
            pseudoC = m + '(' + regStr + ')';
          }
          break;
        }

        // ---- 3rc: op|AA|BBBB|CCCC ----
        case FMT_3rc: {
          const argCount = (unit0 >> 8) & 0xFF;
          const idx = u16le(view, instrOffset + 2);
          const firstReg = u16le(view, instrOffset + 4);

          const regs = [];
          for (let i = 0; i < argCount; ++i)
            regs.push(v(firstReg + i));
          const regStr = regs.join(', ');
          const rangeStr = argCount > 0
            ? v(firstReg) + '..' + v(firstReg + argCount - 1)
            : '';

          if (opByte === 0x25) {
            const t = resolveType(opts, idx);
            operands = '{' + rangeStr + '}, ' + t;
            pseudoC = 'filled-new-array/range ' + t + '(' + regStr + ')';
          } else {
            const m = resolveMethod(opts, idx);
            operands = '{' + rangeStr + '}, ' + m;
            pseudoC = m + '(' + regStr + ')';
          }
          break;
        }

        // ---- 51l: op|AA|BBBBBBBBBBBBBBBBlo..hi (64-bit literal) ----
        case FMT_51l: {
          const aa = (unit0 >> 8) & 0xFF;
          const litHex = i64Hex(view, instrOffset + 2);
          operands = v(aa) + ', ' + litHex;
          pseudoC = v(aa) + ' = ' + litHex;
          break;
        }

        default:
          operands = '';
          pseudoC = '??';
          break;
      }

      result.push({
        offset: instrOffset,
        length: instrSize,
        bytes: bytesSlice,
        mnemonic: entry.name,
        operands,
        pseudoC,
      });
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Fallback raw-byte emitter
  // -------------------------------------------------------------------------

  function pushDb(result, view, offset, length) {
    const actual = Math.min(length, view.length - offset);
    if (actual <= 0) return;
    result.push({
      offset,
      length: actual,
      bytes: Array.from(view.subarray(offset, offset + actual)),
      mnemonic: 'db',
      operands: Array.from(view.subarray(offset, offset + actual))
        .map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      pseudoC: '??',
    });
  }

  // =========================================================================
  // Register
  // =========================================================================
  D.registerDisassembler('dalvik', decode);

})();
