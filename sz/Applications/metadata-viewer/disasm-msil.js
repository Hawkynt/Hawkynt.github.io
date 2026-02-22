;(function() {
  'use strict';
  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // .NET MSIL/CIL Instruction Decoder
  // =========================================================================

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function u8(bytes, off) {
    return off < bytes.length ? bytes[off] : 0;
  }

  function i8(bytes, off) {
    const v = u8(bytes, off);
    return v > 127 ? v - 256 : v;
  }

  function u16(bytes, off) {
    return off + 1 < bytes.length ? bytes[off] | (bytes[off + 1] << 8) : 0;
  }

  function i32(bytes, off) {
    if (off + 3 >= bytes.length) return 0;
    return bytes[off] | (bytes[off + 1] << 8) | (bytes[off + 2] << 16) | (bytes[off + 3] << 24);
  }

  function u32(bytes, off) {
    return i32(bytes, off) >>> 0;
  }

  function f32(bytes, off) {
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    for (let i = 0; i < 4; ++i) view.setUint8(i, u8(bytes, off + i));
    return view.getFloat32(0, true);
  }

  function f64(bytes, off) {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    for (let i = 0; i < 8; ++i) view.setUint8(i, u8(bytes, off + i));
    return view.getFloat64(0, true);
  }

  function i64Hex(bytes, off) {
    const lo = u32(bytes, off);
    const hi = u32(bytes, off + 4);
    return '0x' + hi.toString(16).padStart(8, '0').toUpperCase() + lo.toString(16).padStart(8, '0').toUpperCase();
  }

  let _currentMeta = null;

  function resolveToken(val, meta) {
    const tableIdx = (val >>> 24) & 0xFF;
    const rowNum = val & 0x00FFFFFF;
    if (!rowNum) return null;
    // US heap (0x70) — user strings for ldstr
    if (tableIdx === 0x70 && meta.readUserString) {
      const s = meta.readUserString(rowNum);
      return s != null ? '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"' : null;
    }
    const table = meta.tables && meta.tables[tableIdx];
    if (!table || rowNum > table.length) return null;
    const row = table[rowNum - 1];
    if (!row) return null;
    const str = meta.strings;
    if (!str || row.name == null) return null;
    const name = str(row.name);
    if (!name) return null;
    const ns = row.ns != null ? str(row.ns) : '';
    return (ns ? ns + '.' : '') + name;
  }

  function tokenRaw(bytes, off) { return u32(bytes, off); }

  function token(bytes, off) {
    const val = u32(bytes, off);
    if (_currentMeta) {
      const name = resolveToken(val, _currentMeta);
      if (name) return name;
    }
    return '#' + val.toString(16).padStart(8, '0').toUpperCase();
  }

  function ilLabel(base, instrLen, rel) {
    const target = base + instrLen + rel;
    return 'IL_' + (target >>> 0).toString(16).padStart(4, '0').toUpperCase();
  }

  // -------------------------------------------------------------------------
  // Single-byte opcode table (0x00 - 0xFE, excluding 0xFE prefix)
  //
  // Each entry: [mnemonic, operandSize, decodeFn]
  //   operandSize: fixed additional bytes (0,1,2,4,8), or -1 for variable
  //   decodeFn(bytes, off, pos): returns { operands, pseudoC, extraLen }
  //     off = position of first operand byte; pos = position of opcode byte
  //     extraLen only needed for variable-length instructions
  // -------------------------------------------------------------------------

  const SINGLE = Object.create(null);

  // -- nop / break --
  SINGLE[0x00] = ['nop', 0, () => ({ operands: '', pseudoC: '/* nop */' })];
  SINGLE[0x01] = ['break', 0, () => ({ operands: '', pseudoC: '/* break */' })];

  // -- ldarg.0..3 --
  for (let n = 0; n < 4; ++n)
    SINGLE[0x02 + n] = ['ldarg.' + n, 0, (function(idx) { return () => ({ operands: '', pseudoC: 'push(arg[' + idx + '])' }); })(n)];

  // -- ldloc.0..3 --
  for (let n = 0; n < 4; ++n)
    SINGLE[0x06 + n] = ['ldloc.' + n, 0, (function(idx) { return () => ({ operands: '', pseudoC: 'push(local[' + idx + '])' }); })(n)];

  // -- stloc.0..3 --
  for (let n = 0; n < 4; ++n)
    SINGLE[0x0A + n] = ['stloc.' + n, 0, (function(idx) { return () => ({ operands: '', pseudoC: 'local[' + idx + '] = pop()' }); })(n)];

  // -- ldarg.s / ldarga.s / starg.s --
  SINGLE[0x0E] = ['ldarg.s', 1, (b, o) => { const v = u8(b, o); return { operands: String(v), pseudoC: 'push(arg[' + v + '])' }; }];
  SINGLE[0x0F] = ['ldarga.s', 1, (b, o) => { const v = u8(b, o); return { operands: String(v), pseudoC: 'push(&arg[' + v + '])' }; }];
  SINGLE[0x10] = ['starg.s', 1, (b, o) => { const v = u8(b, o); return { operands: String(v), pseudoC: 'arg[' + v + '] = pop()' }; }];

  // -- ldloc.s / ldloca.s / stloc.s --
  SINGLE[0x11] = ['ldloc.s', 1, (b, o) => { const v = u8(b, o); return { operands: String(v), pseudoC: 'push(local[' + v + '])' }; }];
  SINGLE[0x12] = ['ldloca.s', 1, (b, o) => { const v = u8(b, o); return { operands: String(v), pseudoC: 'push(&local[' + v + '])' }; }];
  SINGLE[0x13] = ['stloc.s', 1, (b, o) => { const v = u8(b, o); return { operands: String(v), pseudoC: 'local[' + v + '] = pop()' }; }];

  // -- ldnull --
  SINGLE[0x14] = ['ldnull', 0, () => ({ operands: '', pseudoC: 'push(null)' })];

  // -- ldc.i4.m1, ldc.i4.0..8 --
  SINGLE[0x15] = ['ldc.i4.m1', 0, () => ({ operands: '', pseudoC: 'push(-1)' })];
  for (let n = 0; n <= 8; ++n)
    SINGLE[0x16 + n] = ['ldc.i4.' + n, 0, (function(val) { return () => ({ operands: '', pseudoC: 'push(' + val + ')' }); })(n)];

  // -- ldc.i4.s --
  SINGLE[0x1F] = ['ldc.i4.s', 1, (b, o) => { const v = i8(b, o); return { operands: String(v), pseudoC: 'push(' + v + ')' }; }];

  // -- ldc.i4 --
  SINGLE[0x20] = ['ldc.i4', 4, (b, o) => { const v = i32(b, o); return { operands: String(v), pseudoC: 'push(' + v + ')' }; }];

  // -- ldc.i8 --
  SINGLE[0x21] = ['ldc.i8', 8, (b, o) => { const v = i64Hex(b, o); return { operands: v, pseudoC: 'push(' + v + ')' }; }];

  // -- ldc.r4 --
  SINGLE[0x22] = ['ldc.r4', 4, (b, o) => { const v = f32(b, o); return { operands: String(v), pseudoC: 'push(' + v + 'f)' }; }];

  // -- ldc.r8 --
  SINGLE[0x23] = ['ldc.r8', 8, (b, o) => { const v = f64(b, o); return { operands: String(v), pseudoC: 'push(' + v + ')' }; }];

  // 0x24 unused

  // -- dup / pop --
  SINGLE[0x25] = ['dup', 0, () => ({ operands: '', pseudoC: 'push(peek())' })];
  SINGLE[0x26] = ['pop', 0, () => ({ operands: '', pseudoC: 'pop()' })];

  // -- jmp / call / calli / ret --
  SINGLE[0x27] = ['jmp', 4, (b, o) => { const r = tokenRaw(b, o); const t = token(b, o); return { operands: t, pseudoC: 'jmp(' + t + ')', rawToken: r }; }];
  SINGLE[0x28] = ['call', 4, (b, o) => { const r = tokenRaw(b, o); const t = token(b, o); return { operands: t, pseudoC: 'call(' + t + ')', rawToken: r }; }];
  SINGLE[0x29] = ['calli', 4, (b, o) => { const r = tokenRaw(b, o); const t = token(b, o); return { operands: t, pseudoC: 'calli(' + t + ')', rawToken: r }; }];
  SINGLE[0x2A] = ['ret', 0, () => ({ operands: '', pseudoC: 'return' })];

  // -- short branches (1-byte signed offset) --
  const SHORT_BRANCHES = [
    [0x2B, 'br.s', (lbl) => 'goto ' + lbl],
    [0x2C, 'brfalse.s', (lbl) => 'if (!pop()) goto ' + lbl],
    [0x2D, 'brtrue.s', (lbl) => 'if (pop()) goto ' + lbl],
    [0x2E, 'beq.s', (lbl) => 'if (pop()==pop()) goto ' + lbl],
    [0x2F, 'bge.s', (lbl) => 'a=pop(); if (pop()>=a) goto ' + lbl],
    [0x30, 'bgt.s', (lbl) => 'a=pop(); if (pop()>a) goto ' + lbl],
    [0x31, 'ble.s', (lbl) => 'a=pop(); if (pop()<=a) goto ' + lbl],
    [0x32, 'blt.s', (lbl) => 'a=pop(); if (pop()<a) goto ' + lbl],
    [0x33, 'bne.un.s', (lbl) => 'if (pop()!=pop()) goto ' + lbl],
    [0x34, 'bge.un.s', (lbl) => 'a=pop(); if ((uint)pop()>=(uint)a) goto ' + lbl],
    [0x35, 'bgt.un.s', (lbl) => 'a=pop(); if ((uint)pop()>(uint)a) goto ' + lbl],
    [0x36, 'ble.un.s', (lbl) => 'a=pop(); if ((uint)pop()<=(uint)a) goto ' + lbl],
    [0x37, 'blt.un.s', (lbl) => 'a=pop(); if ((uint)pop()<(uint)a) goto ' + lbl],
  ];

  for (const [op, mn, pseudoFn] of SHORT_BRANCHES)
    SINGLE[op] = [mn, 1, (b, o, p) => {
      const rel = i8(b, o);
      const lbl = ilLabel(p, 2, rel);
      return { operands: lbl, pseudoC: pseudoFn(lbl) };
    }];

  // -- long branches (4-byte signed offset) --
  const LONG_BRANCHES = [
    [0x38, 'br', (lbl) => 'goto ' + lbl],
    [0x39, 'brfalse', (lbl) => 'if (!pop()) goto ' + lbl],
    [0x3A, 'brtrue', (lbl) => 'if (pop()) goto ' + lbl],
    [0x3B, 'beq', (lbl) => 'if (pop()==pop()) goto ' + lbl],
    [0x3C, 'bge', (lbl) => 'a=pop(); if (pop()>=a) goto ' + lbl],
    [0x3D, 'bgt', (lbl) => 'a=pop(); if (pop()>a) goto ' + lbl],
    [0x3E, 'ble', (lbl) => 'a=pop(); if (pop()<=a) goto ' + lbl],
    [0x3F, 'blt', (lbl) => 'a=pop(); if (pop()<a) goto ' + lbl],
    [0x40, 'bne.un', (lbl) => 'if (pop()!=pop()) goto ' + lbl],
    [0x41, 'bge.un', (lbl) => 'a=pop(); if ((uint)pop()>=(uint)a) goto ' + lbl],
    [0x42, 'bgt.un', (lbl) => 'a=pop(); if ((uint)pop()>(uint)a) goto ' + lbl],
    [0x43, 'ble.un', (lbl) => 'a=pop(); if ((uint)pop()<=(uint)a) goto ' + lbl],
    [0x44, 'blt.un', (lbl) => 'a=pop(); if ((uint)pop()<(uint)a) goto ' + lbl],
  ];

  for (const [op, mn, pseudoFn] of LONG_BRANCHES)
    SINGLE[op] = [mn, 4, (b, o, p) => {
      const rel = i32(b, o);
      const lbl = ilLabel(p, 5, rel);
      return { operands: lbl, pseudoC: pseudoFn(lbl) };
    }];

  // -- switch (variable-length) --
  SINGLE[0x45] = ['switch', -1, (b, o, p) => {
    const n = u32(b, o);
    const totalLen = 4 + n * 4;
    const targets = [];
    const baseOff = p + 1 + totalLen;
    for (let i = 0; i < Math.min(n, 16); ++i) {
      const rel = i32(b, o + 4 + i * 4);
      targets.push(ilLabel(0, baseOff, rel));
    }
    const operands = '(' + n + ' targets)' + (n > 0 ? ' ' + targets.join(', ') : '') + (n > 16 ? ', ...' : '');
    return { operands, pseudoC: 'switch(pop()) { ' + targets.map((t, i) => i + '=>' + t).join('; ') + (n > 16 ? '; ...' : '') + ' }', extraLen: totalLen };
  }];

  // -- ldind.* --
  const LDIND = [
    [0x46, 'ldind.i1', 'push(*(int8*)pop())'],
    [0x47, 'ldind.u1', 'push(*(uint8*)pop())'],
    [0x48, 'ldind.i2', 'push(*(int16*)pop())'],
    [0x49, 'ldind.u2', 'push(*(uint16*)pop())'],
    [0x4A, 'ldind.i4', 'push(*(int32*)pop())'],
    [0x4B, 'ldind.u4', 'push(*(uint32*)pop())'],
    [0x4C, 'ldind.i8', 'push(*(int64*)pop())'],
    [0x4D, 'ldind.i', 'push(*(nint*)pop())'],
    [0x4E, 'ldind.r4', 'push(*(float32*)pop())'],
    [0x4F, 'ldind.r8', 'push(*(float64*)pop())'],
    [0x50, 'ldind.ref', 'push(*(ref*)pop())'],
  ];

  for (const [op, mn, pseudo] of LDIND)
    SINGLE[op] = [mn, 0, () => ({ operands: '', pseudoC: pseudo })];

  // -- stind.* --
  const STIND = [
    [0x51, 'stind.ref', 'val=pop(); *(ref*)pop() = val'],
    [0x52, 'stind.i1', 'val=pop(); *(int8*)pop() = val'],
    [0x53, 'stind.i2', 'val=pop(); *(int16*)pop() = val'],
    [0x54, 'stind.i4', 'val=pop(); *(int32*)pop() = val'],
    [0x55, 'stind.i8', 'val=pop(); *(int64*)pop() = val'],
    [0x56, 'stind.r4', 'val=pop(); *(float32*)pop() = val'],
    [0x57, 'stind.r8', 'val=pop(); *(float64*)pop() = val'],
  ];

  for (const [op, mn, pseudo] of STIND)
    SINGLE[op] = [mn, 0, () => ({ operands: '', pseudoC: pseudo })];

  // -- arithmetic --
  SINGLE[0x58] = ['add', 0, () => ({ operands: '', pseudoC: 'push(pop() + pop())' })];
  SINGLE[0x59] = ['sub', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() - a)' })];
  SINGLE[0x5A] = ['mul', 0, () => ({ operands: '', pseudoC: 'push(pop() * pop())' })];
  SINGLE[0x5B] = ['div', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() / a)' })];
  SINGLE[0x5C] = ['div.un', 0, () => ({ operands: '', pseudoC: 'a=pop(); push((uint)pop() / (uint)a)' })];
  SINGLE[0x5D] = ['rem', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() % a)' })];
  SINGLE[0x5E] = ['rem.un', 0, () => ({ operands: '', pseudoC: 'a=pop(); push((uint)pop() % (uint)a)' })];

  // -- bitwise --
  SINGLE[0x5F] = ['and', 0, () => ({ operands: '', pseudoC: 'push(pop() & pop())' })];
  SINGLE[0x60] = ['or', 0, () => ({ operands: '', pseudoC: 'push(pop() | pop())' })];
  SINGLE[0x61] = ['xor', 0, () => ({ operands: '', pseudoC: 'push(pop() ^ pop())' })];
  SINGLE[0x62] = ['shl', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() << a)' })];
  SINGLE[0x63] = ['shr', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() >> a)' })];
  SINGLE[0x64] = ['shr.un', 0, () => ({ operands: '', pseudoC: 'a=pop(); push((uint)pop() >>> a)' })];
  SINGLE[0x65] = ['neg', 0, () => ({ operands: '', pseudoC: 'push(-pop())' })];
  SINGLE[0x66] = ['not', 0, () => ({ operands: '', pseudoC: 'push(~pop())' })];

  // -- conv.* --
  const CONV = [
    [0x67, 'conv.i1', 'push((int8)pop())'],
    [0x68, 'conv.i2', 'push((int16)pop())'],
    [0x69, 'conv.i4', 'push((int32)pop())'],
    [0x6A, 'conv.i8', 'push((int64)pop())'],
    [0x6B, 'conv.r4', 'push((float32)pop())'],
    [0x6C, 'conv.r8', 'push((float64)pop())'],
    [0x6D, 'conv.u4', 'push((uint32)pop())'],
    [0x6E, 'conv.u8', 'push((uint64)pop())'],
  ];

  for (const [op, mn, pseudo] of CONV)
    SINGLE[op] = [mn, 0, () => ({ operands: '', pseudoC: pseudo })];

  // -- callvirt / cpobj / ldobj / ldstr / newobj --
  SINGLE[0x6F] = ['callvirt', 4, (b, o) => { const r = tokenRaw(b, o); const t = token(b, o); return { operands: t, pseudoC: 'vcall(' + t + ')', rawToken: r }; }];
  SINGLE[0x70] = ['cpobj', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'cpobj(' + t + ')' }; }];
  SINGLE[0x71] = ['ldobj', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(*(' + t + '*)pop())' }; }];
  SINGLE[0x72] = ['ldstr', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(str ' + t + ')' }; }];
  SINGLE[0x73] = ['newobj', 4, (b, o) => { const r = tokenRaw(b, o); const t = token(b, o); return { operands: t, pseudoC: 'push(new ' + t + ')', rawToken: r }; }];

  // -- castclass / isinst --
  SINGLE[0x74] = ['castclass', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push((' + t + ')pop())' }; }];
  SINGLE[0x75] = ['isinst', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(pop() is ' + t + ')' }; }];

  // -- conv.r.un --
  SINGLE[0x76] = ['conv.r.un', 0, () => ({ operands: '', pseudoC: 'push((float)(uint)pop())' })];

  // 0x77, 0x78 unused

  // -- unbox --
  SINGLE[0x79] = ['unbox', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(&unbox<' + t + '>(pop()))' }; }];

  // -- throw --
  SINGLE[0x7A] = ['throw', 0, () => ({ operands: '', pseudoC: 'throw pop()' })];

  // -- field operations --
  SINGLE[0x7B] = ['ldfld', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(pop().' + t + ')' }; }];
  SINGLE[0x7C] = ['ldflda', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(&pop().' + t + ')' }; }];
  SINGLE[0x7D] = ['stfld', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'val=pop(); pop().' + t + ' = val' }; }];
  SINGLE[0x7E] = ['ldsfld', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(static.' + t + ')' }; }];
  SINGLE[0x7F] = ['ldsflda', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(&static.' + t + ')' }; }];
  SINGLE[0x80] = ['stsfld', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'static.' + t + ' = pop()' }; }];

  // -- stobj --
  SINGLE[0x81] = ['stobj', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'val=pop(); *(' + t + '*)pop() = val' }; }];

  // -- conv.ovf.* --
  SINGLE[0x82] = ['conv.ovf.i1.un', 0, () => ({ operands: '', pseudoC: 'push(checked((int8)(uint)pop()))' })];
  SINGLE[0x83] = ['conv.ovf.i2.un', 0, () => ({ operands: '', pseudoC: 'push(checked((int16)(uint)pop()))' })];
  SINGLE[0x84] = ['conv.ovf.i4.un', 0, () => ({ operands: '', pseudoC: 'push(checked((int32)(uint)pop()))' })];
  SINGLE[0x85] = ['conv.ovf.i8.un', 0, () => ({ operands: '', pseudoC: 'push(checked((int64)(uint)pop()))' })];
  SINGLE[0x86] = ['conv.ovf.u1.un', 0, () => ({ operands: '', pseudoC: 'push(checked((uint8)(uint)pop()))' })];
  SINGLE[0x87] = ['conv.ovf.u2.un', 0, () => ({ operands: '', pseudoC: 'push(checked((uint16)(uint)pop()))' })];
  SINGLE[0x88] = ['conv.ovf.u4.un', 0, () => ({ operands: '', pseudoC: 'push(checked((uint32)(uint)pop()))' })];
  SINGLE[0x89] = ['conv.ovf.u8.un', 0, () => ({ operands: '', pseudoC: 'push(checked((uint64)(uint)pop()))' })];
  SINGLE[0x8A] = ['conv.ovf.i.un', 0, () => ({ operands: '', pseudoC: 'push(checked((nint)(uint)pop()))' })];
  SINGLE[0x8B] = ['conv.ovf.u.un', 0, () => ({ operands: '', pseudoC: 'push(checked((nuint)(uint)pop()))' })];

  // -- box --
  SINGLE[0x8C] = ['box', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(box<' + t + '>(pop()))' }; }];

  // -- newarr --
  SINGLE[0x8D] = ['newarr', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(new ' + t + '[pop()])' }; }];

  // -- ldlen --
  SINGLE[0x8E] = ['ldlen', 0, () => ({ operands: '', pseudoC: 'push(pop().Length)' })];

  // -- ldelema --
  SINGLE[0x8F] = ['ldelema', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'idx=pop(); push(&pop()[idx])' }; }];

  // -- ldelem.* --
  const LDELEM = [
    [0x90, 'ldelem.i1', 'int8'], [0x91, 'ldelem.u1', 'uint8'],
    [0x92, 'ldelem.i2', 'int16'], [0x93, 'ldelem.u2', 'uint16'],
    [0x94, 'ldelem.i4', 'int32'], [0x95, 'ldelem.u4', 'uint32'],
    [0x96, 'ldelem.i8', 'int64'], [0x97, 'ldelem.i', 'nint'],
    [0x98, 'ldelem.r4', 'float32'], [0x99, 'ldelem.r8', 'float64'],
    [0x9A, 'ldelem.ref', 'ref'],
  ];

  for (const [op, mn, ty] of LDELEM)
    SINGLE[op] = [mn, 0, () => ({ operands: '', pseudoC: 'idx=pop(); push((' + ty + ')pop()[idx])' })];

  // -- stelem.* --
  const STELEM = [
    [0x9C, 'stelem.i1', 'int8'], [0x9D, 'stelem.i2', 'int16'],
    [0x9E, 'stelem.i4', 'int32'], [0x9F, 'stelem.i8', 'int64'],
    [0xA0, 'stelem.r4', 'float32'], [0xA1, 'stelem.r8', 'float64'],
    [0xA2, 'stelem.ref', 'ref'],
  ];

  for (const [op, mn, ty] of STELEM)
    SINGLE[op] = [mn, 0, () => ({ operands: '', pseudoC: 'val=pop(); idx=pop(); pop()[idx] = (' + ty + ')val' })];

  // 0x9B: ldelem with token
  SINGLE[0x9B] = ['ldelem', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'idx=pop(); push(pop()[idx] as ' + t + ')' }; }];

  // 0xA3: stelem with token
  SINGLE[0xA3] = ['stelem', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'val=pop(); idx=pop(); pop()[idx] = (' + t + ')val' }; }];

  // 0xA4 unused in this range
  // -- unbox.any --
  SINGLE[0xA5] = ['unbox.any', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(unbox<' + t + '>(pop()))' }; }];

  // -- conv.ovf.* (signed source) --
  SINGLE[0xB3] = ['conv.ovf.i1', 0, () => ({ operands: '', pseudoC: 'push(checked((int8)pop()))' })];
  SINGLE[0xB4] = ['conv.ovf.u1', 0, () => ({ operands: '', pseudoC: 'push(checked((uint8)pop()))' })];
  SINGLE[0xB5] = ['conv.ovf.i2', 0, () => ({ operands: '', pseudoC: 'push(checked((int16)pop()))' })];
  SINGLE[0xB6] = ['conv.ovf.u2', 0, () => ({ operands: '', pseudoC: 'push(checked((uint16)pop()))' })];
  SINGLE[0xB7] = ['conv.ovf.i4', 0, () => ({ operands: '', pseudoC: 'push(checked((int32)pop()))' })];
  SINGLE[0xB8] = ['conv.ovf.u4', 0, () => ({ operands: '', pseudoC: 'push(checked((uint32)pop()))' })];
  SINGLE[0xB9] = ['conv.ovf.i8', 0, () => ({ operands: '', pseudoC: 'push(checked((int64)pop()))' })];
  SINGLE[0xBA] = ['conv.ovf.u8', 0, () => ({ operands: '', pseudoC: 'push(checked((uint64)pop()))' })];

  // 0xC2: refanyval
  SINGLE[0xC2] = ['refanyval', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(refanyval<' + t + '>(pop()))' }; }];

  // 0xC3: ckfinite
  SINGLE[0xC3] = ['ckfinite', 0, () => ({ operands: '', pseudoC: 'if (!isfinite(peek())) throw' })];

  // 0xC6: mkrefany
  SINGLE[0xC6] = ['mkrefany', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(mkrefany<' + t + '>(pop()))' }; }];

  // -- ldtoken --
  SINGLE[0xD0] = ['ldtoken', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(token(' + t + '))' }; }];

  // -- conv.u2, conv.u1, conv.i, conv.ovf.i, conv.ovf.u --
  SINGLE[0xD1] = ['conv.u2', 0, () => ({ operands: '', pseudoC: 'push((uint16)pop())' })];
  SINGLE[0xD2] = ['conv.u1', 0, () => ({ operands: '', pseudoC: 'push((uint8)pop())' })];
  SINGLE[0xD3] = ['conv.i', 0, () => ({ operands: '', pseudoC: 'push((nint)pop())' })];
  SINGLE[0xD4] = ['conv.ovf.i', 0, () => ({ operands: '', pseudoC: 'push(checked((nint)pop()))' })];
  SINGLE[0xD5] = ['conv.ovf.u', 0, () => ({ operands: '', pseudoC: 'push(checked((nuint)pop()))' })];

  // -- add.ovf / add.ovf.un / mul.ovf / mul.ovf.un / sub.ovf / sub.ovf.un --
  SINGLE[0xD6] = ['add.ovf', 0, () => ({ operands: '', pseudoC: 'push(checked(pop() + pop()))' })];
  SINGLE[0xD7] = ['add.ovf.un', 0, () => ({ operands: '', pseudoC: 'push(checked((uint)pop() + (uint)pop()))' })];
  SINGLE[0xD8] = ['mul.ovf', 0, () => ({ operands: '', pseudoC: 'push(checked(pop() * pop()))' })];
  SINGLE[0xD9] = ['mul.ovf.un', 0, () => ({ operands: '', pseudoC: 'push(checked((uint)pop() * (uint)pop()))' })];
  SINGLE[0xDA] = ['sub.ovf', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(checked(pop() - a))' })];
  SINGLE[0xDB] = ['sub.ovf.un', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(checked((uint)pop() - (uint)a))' })];

  // -- endfinally / leave / leave.s --
  SINGLE[0xDC] = ['endfinally', 0, () => ({ operands: '', pseudoC: '/* endfinally */' })];
  SINGLE[0xDD] = ['leave', 4, (b, o, p) => {
    const rel = i32(b, o);
    const lbl = ilLabel(p, 5, rel);
    return { operands: lbl, pseudoC: 'leave ' + lbl };
  }];
  SINGLE[0xDE] = ['leave.s', 1, (b, o, p) => {
    const rel = i8(b, o);
    const lbl = ilLabel(p, 2, rel);
    return { operands: lbl, pseudoC: 'leave ' + lbl };
  }];

  // -- stind.i --
  SINGLE[0xDF] = ['stind.i', 0, () => ({ operands: '', pseudoC: 'val=pop(); *(nint*)pop() = val' })];

  // -- conv.u --
  SINGLE[0xE0] = ['conv.u', 0, () => ({ operands: '', pseudoC: 'push((nuint)pop())' })];

  // -- prefix opcodes (not decoded individually, handled below) --
  // 0xFE is the two-byte prefix, handled in the decoder

  // -------------------------------------------------------------------------
  // Two-byte opcode table (0xFE prefix)
  // -------------------------------------------------------------------------

  const TWOBYTE = Object.create(null);

  // -- arglist --
  TWOBYTE[0x00] = ['arglist', 0, () => ({ operands: '', pseudoC: 'push(arglist)' })];

  // -- ceq / cgt / cgt.un / clt / clt.un --
  TWOBYTE[0x01] = ['ceq', 0, () => ({ operands: '', pseudoC: 'push(pop()==pop() ? 1 : 0)' })];
  TWOBYTE[0x02] = ['cgt', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop()>a ? 1 : 0)' })];
  TWOBYTE[0x03] = ['cgt.un', 0, () => ({ operands: '', pseudoC: 'a=pop(); push((uint)pop()>(uint)a ? 1 : 0)' })];
  TWOBYTE[0x04] = ['clt', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop()<a ? 1 : 0)' })];
  TWOBYTE[0x05] = ['clt.un', 0, () => ({ operands: '', pseudoC: 'a=pop(); push((uint)pop()<(uint)a ? 1 : 0)' })];

  // -- ldftn / ldvirtftn --
  TWOBYTE[0x06] = ['ldftn', 4, (b, o) => { const r = tokenRaw(b, o); const t = token(b, o); return { operands: t, pseudoC: 'push(ftnptr(' + t + '))', rawToken: r }; }];
  TWOBYTE[0x07] = ['ldvirtftn', 4, (b, o) => { const r = tokenRaw(b, o); const t = token(b, o); return { operands: t, pseudoC: 'push(vftnptr(pop(), ' + t + '))', rawToken: r }; }];

  // -- ldarg / ldarga / starg --
  TWOBYTE[0x09] = ['ldarg', 2, (b, o) => { const v = u16(b, o); return { operands: String(v), pseudoC: 'push(arg[' + v + '])' }; }];
  TWOBYTE[0x0A] = ['ldarga', 2, (b, o) => { const v = u16(b, o); return { operands: String(v), pseudoC: 'push(&arg[' + v + '])' }; }];
  TWOBYTE[0x0B] = ['starg', 2, (b, o) => { const v = u16(b, o); return { operands: String(v), pseudoC: 'arg[' + v + '] = pop()' }; }];

  // -- ldloc / ldloca / stloc --
  TWOBYTE[0x0C] = ['ldloc', 2, (b, o) => { const v = u16(b, o); return { operands: String(v), pseudoC: 'push(local[' + v + '])' }; }];
  TWOBYTE[0x0D] = ['ldloca', 2, (b, o) => { const v = u16(b, o); return { operands: String(v), pseudoC: 'push(&local[' + v + '])' }; }];
  TWOBYTE[0x0E] = ['stloc', 2, (b, o) => { const v = u16(b, o); return { operands: String(v), pseudoC: 'local[' + v + '] = pop()' }; }];

  // -- localloc --
  TWOBYTE[0x0F] = ['localloc', 0, () => ({ operands: '', pseudoC: 'push(stackalloc(pop()))' })];

  // -- endfilter --
  TWOBYTE[0x11] = ['endfilter', 0, () => ({ operands: '', pseudoC: '/* endfilter */' })];

  // -- unaligned. prefix --
  TWOBYTE[0x12] = ['unaligned.', 1, (b, o) => { const v = u8(b, o); return { operands: String(v), pseudoC: '/* unaligned ' + v + ' */' }; }];

  // -- volatile. prefix --
  TWOBYTE[0x13] = ['volatile.', 0, () => ({ operands: '', pseudoC: '/* volatile */' })];

  // -- tail. prefix --
  TWOBYTE[0x14] = ['tail.', 0, () => ({ operands: '', pseudoC: '/* tail */' })];

  // -- initobj --
  TWOBYTE[0x15] = ['initobj', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'initobj<' + t + '>(pop())' }; }];

  // -- constrained. prefix --
  TWOBYTE[0x16] = ['constrained.', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: '/* constrained ' + t + ' */' }; }];

  // -- cpblk / initblk --
  TWOBYTE[0x17] = ['cpblk', 0, () => ({ operands: '', pseudoC: 'n=pop(); src=pop(); memcpy(pop(), src, n)' })];
  TWOBYTE[0x18] = ['initblk', 0, () => ({ operands: '', pseudoC: 'n=pop(); val=pop(); memset(pop(), val, n)' })];

  // -- no. prefix --
  TWOBYTE[0x19] = ['no.', 1, (b, o) => { const v = u8(b, o); return { operands: String(v), pseudoC: '/* no. ' + v + ' */' }; }];

  // -- rethrow --
  TWOBYTE[0x1A] = ['rethrow', 0, () => ({ operands: '', pseudoC: 'rethrow' })];

  // -- sizeof --
  TWOBYTE[0x1C] = ['sizeof', 4, (b, o) => { const t = token(b, o); return { operands: t, pseudoC: 'push(sizeof(' + t + '))' }; }];

  // -- refanytype --
  TWOBYTE[0x1D] = ['refanytype', 0, () => ({ operands: '', pseudoC: 'push(refanytype(pop()))' })];

  // -- readonly. prefix --
  TWOBYTE[0x1E] = ['readonly.', 0, () => ({ operands: '', pseudoC: '/* readonly */' })];

  // -------------------------------------------------------------------------
  // Decoder — called once per instruction by the framework
  //
  // decoder(bytes, pos, opts) -> { length, mnemonic, operands, pseudoC }
  // -------------------------------------------------------------------------

  function decodeMsil(bytes, pos, opts) {
    _currentMeta = (opts && typeof opts === 'object' && opts.metadata) || null;
    if (pos >= bytes.length) return null;

    const op = bytes[pos];

    // Two-byte opcodes (0xFE prefix)
    if (op === 0xFE) {
      if (pos + 1 >= bytes.length) return null;
      const op2 = bytes[pos + 1];
      const entry = TWOBYTE[op2];
      if (!entry) return { length: 2, mnemonic: '??', operands: '0xFE 0x' + op2.toString(16).padStart(2, '0').toUpperCase(), pseudoC: '/* unknown 2-byte opcode */' };

      const [mn, opSize, decodeFn] = entry;
      const operandOff = pos + 2;
      if (opSize > 0 && operandOff + opSize > bytes.length)
        return { length: 2, mnemonic: mn, operands: '(truncated)', pseudoC: '/* truncated */' };

      const decoded = decodeFn(bytes, operandOff, pos);
      const r = { length: 2 + opSize, mnemonic: mn, operands: decoded.operands, pseudoC: decoded.pseudoC };
      if (decoded.rawToken != null) r.rawToken = decoded.rawToken;
      return r;
    }

    // Single-byte opcodes
    const entry = SINGLE[op];
    if (!entry) return null; // unknown opcode — framework will emit db

    const [mn, opSize, decodeFn] = entry;
    const operandOff = pos + 1;

    // Variable-length (switch)
    if (opSize === -1) {
      if (operandOff + 4 > bytes.length)
        return { length: 1, mnemonic: mn, operands: '(truncated)', pseudoC: '/* truncated */' };
      const decoded = decodeFn(bytes, operandOff, pos);
      const extraLen = decoded.extraLen || 0;
      return { length: 1 + extraLen, mnemonic: mn, operands: decoded.operands, pseudoC: decoded.pseudoC };
    }

    // Fixed-length operand
    if (opSize > 0 && operandOff + opSize > bytes.length)
      return { length: 1, mnemonic: mn, operands: '(truncated)', pseudoC: '/* truncated */' };

    const decoded = decodeFn(bytes, operandOff, pos);
    const r = { length: 1 + opSize, mnemonic: mn, operands: decoded.operands, pseudoC: decoded.pseudoC };
    if (decoded.rawToken != null) r.rawToken = decoded.rawToken;
    return r;
  }

  // -------------------------------------------------------------------------
  // Register
  // -------------------------------------------------------------------------

  D.registerDisassembler('msil', decodeMsil);

  // =========================================================================
  // MSIL Decompiler — stack-tracking expression builder
  // =========================================================================

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const span = (cls, text) => '<span class="da-' + cls + '">' + esc(text) + '</span>';

  const CS_KW = new Set([
    'if', 'else', 'goto', 'return', 'throw', 'new', 'null', 'true', 'false',
    'try', 'catch', 'finally', 'is', 'as', 'typeof', 'sizeof', 'checked', 'unchecked',
    'while', 'for', 'foreach', 'do', 'switch', 'case', 'break', 'continue', 'default',
    'void', 'int', 'uint', 'long', 'ulong', 'short', 'ushort', 'byte', 'sbyte',
    'float', 'double', 'bool', 'char', 'decimal', 'nint', 'nuint',
    'string', 'object', 'var', 'this', 'base', 'ref', 'out', 'in',
    'async', 'await', 'yield', 'delegate', 'event', 'using', 'lock',
    'class', 'struct', 'record', 'interface', 'enum', 'namespace',
    'public', 'private', 'protected', 'internal', 'static', 'sealed', 'abstract', 'virtual', 'override',
    'stackalloc', 'nameof', 'when',
  ]);
  const VB_KW = new Set([
    'If', 'Then', 'Else', 'ElseIf', 'End', 'GoTo', 'Return', 'Throw', 'New', 'Nothing',
    'True', 'False', 'Try', 'Catch', 'Finally', 'TypeOf', 'Is', 'IsNot', 'Not', 'And', 'Or',
    'Dim', 'As', 'Of', 'Like', 'Mod', 'Xor', 'AndAlso', 'OrElse',
    'While', 'Wend', 'For', 'To', 'Step', 'Each', 'In', 'Next', 'Do', 'Loop', 'Until',
    'Select', 'Case', 'Exit', 'Continue', 'With',
    'Integer', 'Long', 'Short', 'Byte', 'SByte', 'Single', 'Double', 'Boolean', 'Char',
    'UInteger', 'ULong', 'UShort', 'Decimal',
    'String', 'Object', 'Me', 'MyBase', 'MyClass', 'ByRef', 'ByVal',
    'Sub', 'Function', 'Property', 'Get', 'Set', 'Let',
    'Public', 'Private', 'Protected', 'Friend', 'Shared', 'Overrides', 'MustOverride', 'Overridable',
    'Class', 'Structure', 'Interface', 'Enum', 'Module', 'Namespace', 'Imports',
    'Async', 'Await', 'Yield', 'Iterator', 'Using', 'SyncLock', 'AddHandler', 'RemoveHandler',
    'DirectCast', 'CType', 'TryCast', 'CInt', 'CLng', 'CShort', 'CByte', 'CSng', 'CDbl', 'CBool', 'CStr',
    'GetType', 'NameOf',
  ]);

  /** Syntax-highlight a code string into HTML. */
  function _hl(code, kwSet) {
    const RE = /("(?:[^"\\]|\\.)*")|(IL_[0-9A-Fa-f]+)|(\b0[xX][0-9A-Fa-f]+\b)|(-?\b\d+(?:\.\d+)?[fFL]?\b)|([A-Za-z_][A-Za-z0-9_.]*)|([+\-*/%&|^~!=<>?:]+)|(\/\*.*?\*\/)|(\/\/.*$)|([()[\]{},;])|(\s+)|(.)/gm;
    let html = '', m;
    while ((m = RE.exec(code)) !== null) {
      if (m[1]) html += span('str', m[1]);
      else if (m[2]) { const off = parseInt(m[2].substring(3), 16); html += '<a class="da-addr da-lbl" data-target="' + off.toString(16) + '">' + esc(m[2]) + '</a>'; }
      else if (m[3]) html += span('num', m[3]);
      else if (m[4]) html += span('num', m[4]);
      else if (m[5]) { if (kwSet.has(m[5])) html += span('kw', m[5]); else if (m[5].includes('.')) html += span('sym', m[5]); else html += span('id', m[5]); }
      else if (m[6]) html += span('op', m[6]);
      else if (m[7]) html += span('cmt', m[7]);
      else if (m[8]) html += span('cmt', m[8]);
      else if (m[9]) html += span('op', m[9]);
      else if (m[10]) html += m[10];
      else html += esc(m[11]);
    }
    return html;
  }

  // ---- Call info: extract param count from metadata token ----
  function _getCallInfo(rawToken, meta) {
    if (!meta || !meta.tables || !meta.readBlob) return null;
    const tbl = (rawToken >>> 24) & 0xFF, row = (rawToken & 0xFFFFFF) - 1;
    if (row < 0) return null;
    const table = meta.tables[tbl];
    if (!table || row >= table.length) return null;
    const sigIdx = table[row].signature;
    if (sigIdx == null) return null;
    const blob = meta.readBlob(sigIdx);
    if (!blob || blob.length < 2) return null;
    const cc = blob[0];
    const hasThis = (cc & 0x20) !== 0;
    let pos = 1;
    if (cc & 0x10) {
      if (pos >= blob.length) return null;
      const g0 = blob[pos++];
      if ((g0 & 0x80) !== 0 && (g0 & 0xC0) === 0x80) ++pos;
      else if ((g0 & 0xC0) === 0xC0) pos += 3;
    }
    if (pos >= blob.length) return null;
    let paramCount = 0;
    const b0 = blob[pos++];
    if ((b0 & 0x80) === 0) paramCount = b0;
    else if ((b0 & 0xC0) === 0x80 && pos < blob.length) paramCount = ((b0 & 0x3F) << 8) | blob[pos++];
    else if (pos + 2 < blob.length) { paramCount = ((b0 & 0x1F) << 24) | (blob[pos] << 16) | (blob[pos + 1] << 8) | blob[pos + 2]; pos += 3; }
    let returnsVoid = false;
    while (pos < blob.length && (blob[pos] === 0x1E || blob[pos] === 0x1F || blob[pos] === 0x45)) ++pos;
    if (pos < blob.length && blob[pos] === 0x01) returnsVoid = true;
    return { paramCount, hasThis, returnsVoid };
  }

  // ---- Argument name resolution from method context ----
  function _argName(idx, annot) {
    const mc = annot && annot.methodContext;
    if (!mc || !mc.paramInfo) return 'arg' + idx;
    const pi = mc.paramInfo;
    if (pi.hasThis) {
      if (idx === 0) return 'this';
      return (idx - 1) < pi.paramNames.length ? pi.paramNames[idx - 1] : 'arg' + idx;
    }
    return idx < pi.paramNames.length ? pi.paramNames[idx] : 'arg' + idx;
  }

  // ---- Build method header line ----
  function _buildMethodHeader(annot) {
    const mc = annot && annot.methodContext;
    if (!mc || !mc.paramInfo) return null;
    const flags = mc.methodFlags;
    const pi = mc.paramInfo;
    const parts = [];
    if (flags != null) {
      const access = flags & 0x07;
      if (access === 6) parts.push('public');
      else if (access === 5) parts.push('internal');
      else if (access === 4) parts.push('protected');
      else if (access === 3) parts.push('protected internal');
      else if (access === 2) parts.push('private protected');
      else if (access === 1) parts.push('private');
      if (flags & 0x10) parts.push('static');
      if (flags & 0x0400) parts.push('abstract');
      else if (flags & 0x0040) parts.push((flags & 0x0100) ? 'virtual' : 'override');
      if ((flags & 0x0020) && !(flags & 0x0040)) parts.push('sealed');
    }
    parts.push(pi.retType);
    const label = mc.label || 'Method';
    const dot = label.lastIndexOf('.');
    const methodName = dot >= 0 ? label.substring(dot + 1) : label;
    const paramStrs = pi.paramTypes.map((t, i) => t + ' ' + (i < pi.paramNames.length ? pi.paramNames[i] : 'arg' + i));
    parts.push(methodName + '(' + paramStrs.join(', ') + ')');
    return parts.join(' ');
  }

  // ---- Build local variable declarations ----
  function _buildLocalDecls(annot) {
    const mc = annot && annot.methodContext;
    if (!mc || !mc.localTypes || mc.localTypes.length === 0) return [];
    return mc.localTypes.map((t, i) => ({ offset: 0, code: t + ' v' + i + ';', indent: 0 }));
  }

  // ---- Parse IL label offset from label string ----
  function _labelOff(label) {
    if (!label || !label.startsWith('IL_')) return -1;
    return parseInt(label.substring(3), 16);
  }

  // ---- Core stack-tracking decompiler (enhanced with named params + branch metadata) ----
  function _decompileStatements(instructions, annotations) {
    const meta = annotations && annotations.metadata;
    const stack = [];
    const out = [];
    function pop() { return stack.length > 0 ? stack.pop() : '???'; }
    function paren(e) {
      if (!/[+\-*/%&|^<>=!? ]/.test(e)) return e;
      if (e[0] === '(') {
        let d = 0;
        for (let i = 0; i < e.length; ++i) {
          if (e[i] === '(') ++d; else if (e[i] === ')') --d;
          if (d === 0) { if (i === e.length - 1) return e; break; }
        }
      }
      return '(' + e + ')';
    }
    function popCallArgs(insn, isNewObj) {
      if (insn.rawToken && meta) {
        const ci = _getCallInfo(insn.rawToken, meta);
        if (ci) {
          const n = isNewObj ? ci.paramCount : ci.paramCount + (ci.hasThis ? 1 : 0);
          const args = [];
          for (let i = 0; i < n && stack.length > 0; ++i) args.unshift(pop());
          return { args, info: ci };
        }
      }
      return { args: [], info: null };
    }
    function shortName(n) { const d = n.lastIndexOf('.'); return d >= 0 ? n.substring(d + 1) : n; }

    for (const insn of instructions) {
      const mn = (insn.mnemonic || '').toLowerCase();
      const ops = insn.operands || '';
      const off = insn.offset;

      if (mn === 'nop') continue;

      // --- Load constants ---
      if (mn === 'ldnull') { stack.push('null'); continue; }
      if (mn.startsWith('ldstr')) { stack.push(ops || '""'); continue; }
      if (mn === 'ldc.i4.m1') { stack.push('-1'); continue; }
      if (mn === 'ldc.i4.s' || mn === 'ldc.i4') { stack.push(ops || '0'); continue; }
      if (mn.startsWith('ldc.i4.') && mn.length === 9) { stack.push(mn.substring(8)); continue; }
      if (mn.startsWith('ldc.i8')) { stack.push((ops || '0') + 'L'); continue; }
      if (mn.startsWith('ldc.r4')) { stack.push((ops || '0') + 'f'); continue; }
      if (mn.startsWith('ldc.r8')) { stack.push(ops || '0.0'); continue; }

      // --- Load arguments (named) ---
      if (mn === 'ldarg.0') { stack.push(_argName(0, annotations)); continue; }
      if (mn === 'ldarg' || mn === 'ldarg.s') { stack.push(_argName(parseInt(ops, 10) || 0, annotations)); continue; }
      if (mn === 'ldarga' || mn === 'ldarga.s') { stack.push('ref ' + _argName(parseInt(ops, 10) || 0, annotations)); continue; }
      if (mn.startsWith('ldarg.') && mn.length === 7) { stack.push(_argName(parseInt(mn.substring(6), 10), annotations)); continue; }

      // --- Load locals ---
      if (mn === 'ldloc' || mn === 'ldloc.s') { stack.push('v' + (ops || '0')); continue; }
      if (mn === 'ldloca' || mn === 'ldloca.s') { stack.push('ref v' + (ops || '0')); continue; }
      if (mn.startsWith('ldloc.') && mn.length === 7) { stack.push('v' + mn.substring(6)); continue; }

      // --- Store locals ---
      if (mn === 'stloc' || mn === 'stloc.s') { out.push({ offset: off, code: 'v' + (ops || '0') + ' = ' + pop() + ';' }); continue; }
      if (mn.startsWith('stloc.') && mn.length === 7) { out.push({ offset: off, code: 'v' + mn.substring(6) + ' = ' + pop() + ';' }); continue; }
      if (mn === 'starg' || mn === 'starg.s') { out.push({ offset: off, code: _argName(parseInt(ops, 10) || 0, annotations) + ' = ' + pop() + ';' }); continue; }

      // --- Dup / Pop ---
      if (mn === 'dup') { const v = stack.length > 0 ? stack[stack.length - 1] : '???'; stack.push(v); continue; }
      if (mn === 'pop') { out.push({ offset: off, code: pop() + ';' }); continue; }

      // --- Arithmetic ---
      if (mn === 'add' || mn === 'add.ovf' || mn === 'add.ovf.un') { const b = pop(), a = pop(); stack.push(a + ' + ' + b); continue; }
      if (mn === 'sub' || mn === 'sub.ovf' || mn === 'sub.ovf.un') { const b = pop(), a = pop(); stack.push(a + ' - ' + b); continue; }
      if (mn === 'mul' || mn === 'mul.ovf' || mn === 'mul.ovf.un') { const b = pop(), a = pop(); stack.push(paren(a) + ' * ' + paren(b)); continue; }
      if (mn === 'div' || mn === 'div.un') { const b = pop(), a = pop(); stack.push(paren(a) + ' / ' + paren(b)); continue; }
      if (mn === 'rem' || mn === 'rem.un') { const b = pop(), a = pop(); stack.push(paren(a) + ' % ' + paren(b)); continue; }
      if (mn === 'and') { const b = pop(), a = pop(); stack.push(paren(a) + ' & ' + paren(b)); continue; }
      if (mn === 'or') { const b = pop(), a = pop(); stack.push(paren(a) + ' | ' + paren(b)); continue; }
      if (mn === 'xor') { const b = pop(), a = pop(); stack.push(paren(a) + ' ^ ' + paren(b)); continue; }
      if (mn === 'shl') { const b = pop(), a = pop(); stack.push(paren(a) + ' << ' + paren(b)); continue; }
      if (mn === 'shr' || mn === 'shr.un') { const b = pop(), a = pop(); stack.push(paren(a) + ' >> ' + paren(b)); continue; }
      if (mn === 'neg') { stack.push('-' + paren(pop())); continue; }
      if (mn === 'not') { stack.push('~' + paren(pop())); continue; }

      // --- Comparisons ---
      if (mn === 'ceq') { const b = pop(), a = pop(); stack.push(a + ' == ' + b); continue; }
      if (mn === 'clt' || mn === 'clt.un') { const b = pop(), a = pop(); stack.push(a + ' < ' + b); continue; }
      if (mn === 'cgt' || mn === 'cgt.un') { const b = pop(), a = pop(); stack.push(a + ' > ' + b); continue; }

      // --- Conversions ---
      if (mn === 'conv.i1') { stack.push('(sbyte)(' + pop() + ')'); continue; }
      if (mn === 'conv.u1') { stack.push('(byte)(' + pop() + ')'); continue; }
      if (mn === 'conv.i2') { stack.push('(short)(' + pop() + ')'); continue; }
      if (mn === 'conv.u2') { stack.push('(ushort)(' + pop() + ')'); continue; }
      if (mn === 'conv.i4') { stack.push('(int)(' + pop() + ')'); continue; }
      if (mn === 'conv.u4') { stack.push('(uint)(' + pop() + ')'); continue; }
      if (mn === 'conv.i8') { stack.push('(long)(' + pop() + ')'); continue; }
      if (mn === 'conv.u8') { stack.push('(ulong)(' + pop() + ')'); continue; }
      if (mn === 'conv.r4') { stack.push('(float)(' + pop() + ')'); continue; }
      if (mn === 'conv.r8') { stack.push('(double)(' + pop() + ')'); continue; }
      if (mn === 'conv.i') { stack.push('(nint)(' + pop() + ')'); continue; }
      if (mn === 'conv.u') { stack.push('(nuint)(' + pop() + ')'); continue; }
      if (mn === 'conv.r.un') { stack.push('(float)((uint)(' + pop() + '))'); continue; }
      if (mn.startsWith('conv.ovf.')) { const t = mn.substring(9).replace('.un', ''); stack.push('checked((' + t + ')(' + pop() + '))'); continue; }

      // --- Box / Unbox / Cast ---
      if (mn === 'box') { stack.push('(object)(' + pop() + ')'); continue; }
      if (mn === 'unbox' || mn === 'unbox.any') { stack.push('(' + (ops || 'T') + ')(' + pop() + ')'); continue; }
      if (mn === 'castclass') { stack.push('(' + (ops || 'T') + ')(' + pop() + ')'); continue; }
      if (mn === 'isinst') { stack.push(pop() + ' is ' + (ops || 'T')); continue; }

      // --- Fields ---
      if (mn === 'ldfld') { stack.push(pop() + '.' + shortName(ops)); continue; }
      if (mn === 'ldsfld') { stack.push(ops); continue; }
      if (mn === 'ldflda') { stack.push('ref ' + pop() + '.' + shortName(ops)); continue; }
      if (mn === 'ldsflda') { stack.push('ref ' + ops); continue; }
      if (mn === 'stfld') { const val = pop(), obj = pop(); out.push({ offset: off, code: obj + '.' + shortName(ops) + ' = ' + val + ';' }); continue; }
      if (mn === 'stsfld') { out.push({ offset: off, code: ops + ' = ' + pop() + ';' }); continue; }

      // --- Arrays ---
      if (mn === 'newarr') { stack.push('new ' + (ops || 'object') + '[' + pop() + ']'); continue; }
      if (mn === 'ldlen') { stack.push(pop() + '.Length'); continue; }
      if (mn === 'ldelem' || mn.startsWith('ldelem.')) { const idx = pop(), arr = pop(); stack.push(arr + '[' + idx + ']'); continue; }
      if (mn === 'stelem' || mn.startsWith('stelem.')) { const val = pop(), idx = pop(), arr = pop(); out.push({ offset: off, code: arr + '[' + idx + '] = ' + val + ';' }); continue; }
      if (mn === 'ldelema') { const idx = pop(), arr = pop(); stack.push('ref ' + arr + '[' + idx + ']'); continue; }

      // --- Indirect ---
      if (mn.startsWith('ldind.')) { stack.push('*' + paren(pop())); continue; }
      if (mn.startsWith('stind.')) { const val = pop(), ptr = pop(); out.push({ offset: off, code: '*' + paren(ptr) + ' = ' + val + ';' }); continue; }
      if (mn === 'ldobj') { stack.push('*' + paren(pop())); continue; }
      if (mn === 'stobj') { const val = pop(), ptr = pop(); out.push({ offset: off, code: '*' + paren(ptr) + ' = ' + val + ';' }); continue; }
      if (mn === 'cpobj') { const s = pop(), d = pop(); out.push({ offset: off, code: '*' + paren(d) + ' = *' + paren(s) + ';' }); continue; }
      if (mn === 'initobj') { out.push({ offset: off, code: '*' + paren(pop()) + ' = default(' + (ops || 'T') + ');' }); continue; }

      // --- Call / Callvirt ---
      if (mn === 'call' || mn === 'callvirt') {
        const { args, info } = popCallArgs(insn, false);
        const name = ops || 'method';
        const gp = name.match(/(?:^|\.)get_(\w+)$/);
        if (gp) { const obj = args.length > 0 ? args.shift() : ''; stack.push((obj ? obj + '.' : '') + gp[1] + (args.length > 0 ? '[' + args.join(', ') + ']' : '')); continue; }
        const sp = name.match(/(?:^|\.)set_(\w+)$/);
        if (sp && args.length >= 1) { const val = args.pop(); const obj = args.length > 0 ? args.shift() : ''; const ix = args.length > 0 ? '[' + args.join(', ') + ']' : ''; out.push({ offset: off, code: (obj ? obj + '.' : '') + sp[1] + ix + ' = ' + val + ';' }); continue; }
        const ae = name.match(/(?:^|\.)add_(\w+)$/);
        if (ae && args.length >= 2) { out.push({ offset: off, code: args[0] + '.' + ae[1] + ' += ' + args[1] + ';' }); continue; }
        const re = name.match(/(?:^|\.)remove_(\w+)$/);
        if (re && args.length >= 2) { out.push({ offset: off, code: args[0] + '.' + re[1] + ' -= ' + args[1] + ';' }); continue; }
        const opOv = name.match(/(?:^|\.)op_(\w+)$/);
        if (opOv) {
          const binOps = { Equality: '==', Inequality: '!=', GreaterThan: '>', LessThan: '<', GreaterThanOrEqual: '>=', LessThanOrEqual: '<=', Addition: '+', Subtraction: '-', Multiply: '*', Division: '/', Modulus: '%', BitwiseAnd: '&', BitwiseOr: '|', ExclusiveOr: '^', LeftShift: '<<', RightShift: '>>' };
          const unOps = { UnaryNegation: '-', UnaryPlus: '+', LogicalNot: '!', OnesComplement: '~', Increment: '++', Decrement: '--' };
          if (args.length === 2 && binOps[opOv[1]]) { stack.push('(' + args[0] + ' ' + binOps[opOv[1]] + ' ' + args[1] + ')'); continue; }
          if (args.length === 1 && unOps[opOv[1]]) { stack.push(unOps[opOv[1]] + paren(args[0])); continue; }
          if (args.length === 1 && (opOv[1] === 'Explicit' || opOv[1] === 'Implicit')) { stack.push('(' + shortName(name.replace(/\.op_\w+$/, '')) + ')' + paren(args[0])); continue; }
        }
        if (/String\.Concat$/i.test(name)) { stack.push(args.join(' + ') || '""'); continue; }
        let obj = '', callArgs = args;
        if (mn === 'callvirt' && args.length > 0) { obj = args[0]; callArgs = args.slice(1); }
        else if (info && info.hasThis && args.length > 0) { obj = args[0]; callArgs = args.slice(1); }
        else if (args.length > 0 && args[0] === 'this') { obj = args[0]; callArgs = args.slice(1); }
        const expr = (obj ? obj + '.' : '') + shortName(name) + '(' + callArgs.join(', ') + ')';
        if (info && info.returnsVoid) out.push({ offset: off, code: expr + ';' });
        else stack.push(expr);
        continue;
      }

      // --- newobj ---
      if (mn === 'newobj') {
        const { args } = popCallArgs(insn, true);
        const tn = (ops || '.ctor').replace(/\.\.ctor$/, '');
        stack.push('new ' + shortName(tn) + '(' + args.join(', ') + ')');
        continue;
      }

      // --- Branches (with metadata for structurer) ---
      if (mn === 'br' || mn === 'br.s') { out.push({ offset: off, code: 'goto ' + ops + ';', kind: 'goto', target: _labelOff(ops) }); continue; }
      if (mn === 'brtrue' || mn === 'brtrue.s') { const c = pop(); out.push({ offset: off, code: 'if (' + c + ') goto ' + ops + ';', kind: 'cond', cond: c, neg: false, target: _labelOff(ops) }); continue; }
      if (mn === 'brfalse' || mn === 'brfalse.s') { const c = pop(); out.push({ offset: off, code: 'if (!(' + c + ')) goto ' + ops + ';', kind: 'cond', cond: c, neg: true, target: _labelOff(ops) }); continue; }
      if (mn === 'beq' || mn === 'beq.s') { const b = pop(), a = pop(); const c = a + ' == ' + b; out.push({ offset: off, code: 'if (' + c + ') goto ' + ops + ';', kind: 'cond', cond: c, neg: false, target: _labelOff(ops) }); continue; }
      if (mn.startsWith('bne')) { const b = pop(), a = pop(); const c = a + ' != ' + b; out.push({ offset: off, code: 'if (' + c + ') goto ' + ops + ';', kind: 'cond', cond: c, neg: false, target: _labelOff(ops) }); continue; }
      if (mn.startsWith('blt')) { const b = pop(), a = pop(); const c = a + ' < ' + b; out.push({ offset: off, code: 'if (' + c + ') goto ' + ops + ';', kind: 'cond', cond: c, neg: false, target: _labelOff(ops) }); continue; }
      if (mn.startsWith('bgt')) { const b = pop(), a = pop(); const c = a + ' > ' + b; out.push({ offset: off, code: 'if (' + c + ') goto ' + ops + ';', kind: 'cond', cond: c, neg: false, target: _labelOff(ops) }); continue; }
      if (mn.startsWith('ble')) { const b = pop(), a = pop(); const c = a + ' <= ' + b; out.push({ offset: off, code: 'if (' + c + ') goto ' + ops + ';', kind: 'cond', cond: c, neg: false, target: _labelOff(ops) }); continue; }
      if (mn.startsWith('bge')) { const b = pop(), a = pop(); const c = a + ' >= ' + b; out.push({ offset: off, code: 'if (' + c + ') goto ' + ops + ';', kind: 'cond', cond: c, neg: false, target: _labelOff(ops) }); continue; }
      if (mn === 'switch') {
        const val = pop();
        // Parse targets from operands
        const targets = [];
        for (const m of ops.matchAll(/IL_[0-9A-Fa-f]+/g)) targets.push(_labelOff(m[0]));
        out.push({ offset: off, code: 'switch (' + val + ') { ' + ops + ' }', kind: 'switch', switchTargets: targets });
        continue;
      }

      // --- Return / Throw ---
      if (mn === 'ret') { out.push({ offset: off, code: stack.length > 0 ? 'return ' + pop() + ';' : 'return;', kind: 'ret' }); continue; }
      if (mn === 'throw') { out.push({ offset: off, code: 'throw ' + pop() + ';', kind: 'throw' }); continue; }
      if (mn === 'rethrow') { out.push({ offset: off, code: 'throw;', kind: 'throw' }); continue; }

      // --- Leave / endfinally ---
      if (mn === 'leave' || mn === 'leave.s') { out.push({ offset: off, code: '/* leave */', kind: 'leave', target: _labelOff(ops) }); continue; }
      if (mn === 'endfinally' || mn === 'endfault') { out.push({ offset: off, code: '/* endfinally */', kind: 'endfinally' }); continue; }
      if (mn === 'endfilter') continue;

      // --- Misc ---
      if (mn === 'ldtoken') { stack.push('typeof(' + (ops || 'T') + ')'); continue; }
      if (mn === 'sizeof') { stack.push('sizeof(' + (ops || 'T') + ')'); continue; }
      if (mn === 'localloc') { stack.push('stackalloc byte[' + pop() + ']'); continue; }
      if (mn === 'ldftn') { stack.push(ops || 'method'); continue; }
      if (mn === 'ldvirtftn') { stack.push(pop() + '.' + shortName(ops || 'method')); continue; }
      if (mn === 'calli') { const fp = pop(); const { args } = popCallArgs(insn, false); stack.push(fp + '(' + args.join(', ') + ')'); continue; }
      if (mn === 'jmp') { out.push({ offset: off, code: ops + '(); // jmp' }); continue; }
      if (mn === 'arglist') { stack.push('__arglist'); continue; }
      if (mn === 'mkrefany') { stack.push('__makeref(' + pop() + ')'); continue; }
      if (mn === 'refanyval') { stack.push('__refvalue(' + pop() + ', ' + (ops || 'T') + ')'); continue; }
      if (mn === 'refanytype') { stack.push('__reftype(' + pop() + ')'); continue; }
      if (mn === 'ckfinite') continue;
      if (mn === 'cpblk') { const n = pop(), s = pop(), d = pop(); out.push({ offset: off, code: 'Buffer.MemoryCopy(' + s + ', ' + d + ', ' + n + ');' }); continue; }
      if (mn === 'initblk') { const n = pop(), v = pop(), p = pop(); out.push({ offset: off, code: 'Unsafe.InitBlock(' + p + ', ' + v + ', ' + n + ');' }); continue; }
      if (mn === 'break') continue;
      if (mn === 'constrained.' || mn === 'readonly.' || mn === 'tail.' || mn === 'volatile.' || mn === 'unaligned.' || mn === 'no.') continue;

      out.push({ offset: off, code: '/* ' + (insn.mnemonic || '??') + (ops ? ' ' + ops : '') + ' */' });
    }
    return out;
  }

  // =========================================================================
  // Control Flow Reconstruction
  // =========================================================================

  /** Find statement index by offset (first stmt at or after offset). */
  function _findIdx(stmts, targetOff) {
    for (let i = 0; i < stmts.length; ++i)
      if (stmts[i].offset >= targetOff) return i;
    return stmts.length;
  }

  /** Wrap EH regions in try/catch/finally structure. */
  function _structureEH(stmts, annot) {
    const mc = annot && annot.methodContext;
    const ehClauses = mc && mc.ehClauses;
    if (!ehClauses || !ehClauses.length) return stmts;
    const codeBase = annot.codeRange ? annot.codeRange.fileStart : 0;
    if (!codeBase) return stmts;

    // Group clauses sharing the same try region
    const sorted = [...ehClauses].sort((a, b) => a.tryOffset - b.tryOffset || a.handlerOffset - b.handlerOffset);
    const groups = [];
    for (const eh of sorted) {
      const last = groups[groups.length - 1];
      if (last && last[0].tryOffset === eh.tryOffset && last[0].tryLength === eh.tryLength)
        last.push(eh);
      else
        groups.push([eh]);
    }

    // Process from last group to first (so splice indices stay valid)
    const result = [...stmts];
    for (let g = groups.length - 1; g >= 0; --g) {
      const group = groups[g];
      const eh0 = group[0];
      const tryAbsStart = codeBase + eh0.tryOffset;
      const tryAbsEnd = codeBase + eh0.tryOffset + eh0.tryLength;

      const tryStartIdx = _findIdx(result, tryAbsStart);
      let tryEndIdx = _findIdx(result, tryAbsEnd);
      if (tryStartIdx >= result.length) continue;

      // Build handlers
      const handlers = [];
      let overallEndIdx = tryEndIdx;
      for (const eh of group) {
        const hAbsStart = codeBase + eh.handlerOffset;
        const hAbsEnd = codeBase + eh.handlerOffset + eh.handlerLength;
        const hStartIdx = _findIdx(result, hAbsStart);
        let hEndIdx = _findIdx(result, hAbsEnd);
        if (hStartIdx >= result.length) continue;
        // Filter out leave/endfinally from handler body
        const hBody = [];
        for (let i = hStartIdx; i < hEndIdx && i < result.length; ++i) {
          const k = result[i].kind;
          if (k === 'leave' || k === 'endfinally') continue;
          hBody.push({ ...result[i], indent: (result[i].indent || 0) + 1 });
        }
        handlers.push({ eh, body: hBody, startIdx: hStartIdx, endIdx: hEndIdx });
        if (hEndIdx > overallEndIdx) overallEndIdx = hEndIdx;
      }

      // Build try body (filter out leave)
      const tryBody = [];
      for (let i = tryStartIdx; i < tryEndIdx && i < result.length; ++i) {
        if (result[i].kind === 'leave') continue;
        tryBody.push({ ...result[i], indent: (result[i].indent || 0) + 1 });
      }

      // Assemble replacement
      const replacement = [];
      const baseOff = result[tryStartIdx].offset;
      replacement.push({ offset: baseOff, code: 'try {', indent: 0, kind: '_eh' });
      replacement.push(...tryBody);
      for (const h of handlers) {
        const hOff = h.body.length > 0 ? h.body[0].offset : baseOff;
        if (h.eh.flags === 2 || h.eh.flags === 4)
          replacement.push({ offset: hOff, code: '} finally {', indent: 0, kind: '_eh' });
        else {
          const ct = h.eh.catchType || 'Exception';
          replacement.push({ offset: hOff, code: '} catch (' + ct + ') {', indent: 0, kind: '_eh' });
        }
        replacement.push(...h.body);
      }
      replacement.push({ offset: baseOff, code: '}', indent: 0, kind: '_eh' });

      result.splice(tryStartIdx, overallEndIdx - tryStartIdx, ...replacement);
    }
    return result;
  }

  /** Recursive control flow pattern matching on a statement range. */
  function _structureCF(stmts) {
    if (stmts.length === 0) return [];

    // Build offset → index map
    const offIdx = new Map();
    stmts.forEach((s, i) => { if (!offIdx.has(s.offset)) offIdx.set(s.offset, i); });

    // Identify backward jump targets (loop headers)
    const loopBack = new Map(); // headerIdx → backJumpIdx
    for (let i = 0; i < stmts.length; ++i) {
      const s = stmts[i];
      if (s.target != null && s.target < s.offset && (s.kind === 'goto' || (s.kind === 'cond' && !s.neg))) {
        const hIdx = offIdx.get(s.target);
        if (hIdx != null && (!loopBack.has(hIdx) || i > loopBack.get(hIdx)))
          loopBack.set(hIdx, i);
      }
    }

    const result = [];
    let i = 0;

    while (i < stmts.length) {
      const s = stmts[i];
      const baseIndent = s.indent || 0;

      // Skip EH structural markers
      if (s.kind === '_eh') { result.push(s); ++i; continue; }

      // ---- While loop (C# pattern: while header has negated forward exit) ----
      // Pattern: if (!cond) goto EXIT; body; goto HEAD; EXIT:
      if (loopBack.has(i) && s.kind === 'cond' && s.neg && s.target > s.offset) {
        const backIdx = loopBack.get(i);
        const exitIdx = offIdx.get(s.target);
        if (exitIdx != null && backIdx < stmts.length && stmts[backIdx].kind === 'goto') {
          const body = stmts.slice(i + 1, backIdx);
          const structured = _structureCF(body);
          result.push({ offset: s.offset, code: 'while (' + s.cond + ') {', indent: baseIndent });
          for (const bs of structured) result.push({ ...bs, indent: (bs.indent || 0) + baseIndent + 1 });
          result.push({ offset: stmts[backIdx].offset, code: '}', indent: baseIndent });
          i = backIdx + 1;
          continue;
        }
      }

      // ---- C# while pattern: goto COND; HEAD: body; COND: if (cond) goto HEAD; ----
      if (s.kind === 'goto' && s.target > s.offset) {
        const condIdx = offIdx.get(s.target);
        if (condIdx != null && condIdx < stmts.length) {
          const condStmt = stmts[condIdx];
          if (condStmt.kind === 'cond' && !condStmt.neg && condStmt.target != null) {
            const headIdx = offIdx.get(condStmt.target);
            if (headIdx != null && headIdx === i + 1) {
              // while (cond) { body }
              const body = stmts.slice(i + 1, condIdx);
              const structured = _structureCF(body);
              result.push({ offset: s.offset, code: 'while (' + condStmt.cond + ') {', indent: baseIndent });
              for (const bs of structured) result.push({ ...bs, indent: (bs.indent || 0) + baseIndent + 1 });
              result.push({ offset: condStmt.offset, code: '}', indent: baseIndent });
              i = condIdx + 1;
              continue;
            }
          }
        }
      }

      // ---- Do-while loop: body ends with backward conditional branch ----
      if (loopBack.has(i)) {
        const backIdx = loopBack.get(i);
        if (backIdx < stmts.length && stmts[backIdx].kind === 'cond' && !stmts[backIdx].neg) {
          const body = stmts.slice(i, backIdx);
          const structured = _structureCF(body);
          result.push({ offset: s.offset, code: 'do {', indent: baseIndent });
          for (const bs of structured) result.push({ ...bs, indent: (bs.indent || 0) + baseIndent + 1 });
          result.push({ offset: stmts[backIdx].offset, code: '} while (' + stmts[backIdx].cond + ');', indent: baseIndent });
          i = backIdx + 1;
          continue;
        }
      }

      // ---- If-then-else (negated forward branch, then body ends with goto past else) ----
      if (s.kind === 'cond' && s.neg && s.target > s.offset) {
        const elseIdx = offIdx.get(s.target);
        if (elseIdx != null && elseIdx > i && elseIdx <= stmts.length) {
          // Check for else: last statement of then body is goto past else
          const lastThenIdx = elseIdx - 1;
          if (lastThenIdx > i && stmts[lastThenIdx].kind === 'goto' && stmts[lastThenIdx].target > s.target) {
            const endIdx = offIdx.get(stmts[lastThenIdx].target);
            if (endIdx != null && endIdx > elseIdx && endIdx <= stmts.length) {
              const thenBody = _structureCF(stmts.slice(i + 1, lastThenIdx));
              const elseBody = _structureCF(stmts.slice(elseIdx, endIdx));
              result.push({ offset: s.offset, code: 'if (' + s.cond + ') {', indent: baseIndent });
              for (const t of thenBody) result.push({ ...t, indent: (t.indent || 0) + baseIndent + 1 });
              result.push({ offset: stmts[lastThenIdx].offset, code: '} else {', indent: baseIndent });
              for (const e of elseBody) result.push({ ...e, indent: (e.indent || 0) + baseIndent + 1 });
              result.push({ offset: stmts[lastThenIdx].target, code: '}', indent: baseIndent });
              i = endIdx;
              continue;
            }
          }
          // Simple if-then (no else)
          const thenBody = _structureCF(stmts.slice(i + 1, elseIdx));
          result.push({ offset: s.offset, code: 'if (' + s.cond + ') {', indent: baseIndent });
          for (const t of thenBody) result.push({ ...t, indent: (t.indent || 0) + baseIndent + 1 });
          result.push({ offset: s.target, code: '}', indent: baseIndent });
          i = elseIdx;
          continue;
        }
      }

      // ---- Positive condition forward branch: if (cond) goto TARGET ----
      // This often appears in short-circuit evaluation or early exits
      if (s.kind === 'cond' && !s.neg && s.target > s.offset) {
        const targetIdx = offIdx.get(s.target);
        if (targetIdx != null && targetIdx > i + 1 && targetIdx <= stmts.length) {
          // Check if this is a negated if-then: if (cond) skip body → if (!cond) { body }
          const body = stmts.slice(i + 1, targetIdx);
          // Only convert if the body doesn't contain its own branches outside the range
          let safe = true;
          for (const bs of body) {
            if (bs.kind === 'goto' && bs.target != null && (bs.target < s.offset || bs.target > stmts[targetIdx - 1].offset + 10))
              { safe = false; break; }
          }
          if (safe && body.length > 0 && body.length <= 20) {
            const negCond = s.cond.startsWith('!(') ? s.cond.substring(2, s.cond.length - 1) : '!(' + s.cond + ')';
            const structured = _structureCF(body);
            result.push({ offset: s.offset, code: 'if (' + negCond + ') {', indent: baseIndent });
            for (const bs of structured) result.push({ ...bs, indent: (bs.indent || 0) + baseIndent + 1 });
            result.push({ offset: s.target, code: '}', indent: baseIndent });
            i = targetIdx;
            continue;
          }
        }
      }

      // ---- Switch/case ----
      if (s.kind === 'switch' && s.switchTargets && s.switchTargets.length > 0) {
        // Find the extent of all switch targets
        let maxTargetIdx = i + 1;
        for (const t of s.switchTargets) {
          const idx = offIdx.get(t);
          if (idx != null && idx > maxTargetIdx) maxTargetIdx = idx;
        }
        // Emit as structured switch
        const switchExpr = s.code.match(/^switch \((.+?)\)/);
        if (switchExpr) {
          result.push({ offset: s.offset, code: 'switch (' + switchExpr[1] + ') {', indent: baseIndent });
          for (let c = 0; c < s.switchTargets.length; ++c) {
            const targetIdx = offIdx.get(s.switchTargets[c]);
            const nextTarget = c + 1 < s.switchTargets.length ? offIdx.get(s.switchTargets[c + 1]) : maxTargetIdx;
            if (targetIdx != null) {
              result.push({ offset: s.switchTargets[c], code: 'case ' + c + ':', indent: baseIndent + 1 });
              const caseBody = stmts.slice(targetIdx, nextTarget != null ? nextTarget : targetIdx);
              for (const cb of caseBody) result.push({ ...cb, indent: (cb.indent || 0) + baseIndent + 2 });
              result.push({ offset: s.switchTargets[c], code: 'break;', indent: baseIndent + 2 });
            }
          }
          result.push({ offset: s.offset, code: '}', indent: baseIndent });
          i = maxTargetIdx;
          continue;
        }
      }

      // Default: emit as-is
      result.push({ ...s, indent: s.indent || 0 });
      ++i;
    }
    return result;
  }

  // =========================================================================
  // C# 2.0 Pattern Recognition (post-processing on structured output)
  // =========================================================================

  function _applyPatterns(stmts) {
    let result = stmts;
    result = _patternCompoundAssign(result);
    result = _patternTernary(result);
    result = _patternUsing(result);
    result = _patternForeach(result);
    result = _patternLock(result);
    result = _patternForLoop(result);
    return result;
  }

  /** Compound assignments: v = v + expr → v += expr; v = v + 1 → ++v; */
  function _patternCompoundAssign(stmts) {
    const result = [];
    for (const s of stmts) {
      let c = s.code;
      // v = v OP expr → v OP= expr
      const m = c.match(/^(\w+) = \1 ([+\-*/%&|^]) (.+);$/);
      if (m) {
        if (m[2] === '+' && m[3] === '1') c = '++' + m[1] + ';';
        else if (m[2] === '-' && m[3] === '1') c = '--' + m[1] + ';';
        else c = m[1] + ' ' + m[2] + '= ' + m[3] + ';';
      }
      result.push({ ...s, code: c });
    }
    return result;
  }

  /** Ternary: if (cond) { v = a; } else { v = b; } → v = cond ? a : b; */
  function _patternTernary(stmts) {
    const result = [];
    for (let i = 0; i < stmts.length; ++i) {
      if (i + 4 < stmts.length) {
        const open = stmts[i], thenS = stmts[i + 1], mid = stmts[i + 2], elseS = stmts[i + 3], close = stmts[i + 4];
        const ifM = open.code.match(/^if \((.+)\) \{$/);
        const thenM = thenS.code.match(/^(\w+) = (.+);$/);
        const elseM = elseS.code.match(/^(\w+) = (.+);$/);
        if (ifM && thenM && elseM && mid.code === '} else {' && close.code === '}' && thenM[1] === elseM[1]) {
          result.push({ offset: open.offset, code: thenM[1] + ' = ' + ifM[1] + ' ? ' + thenM[2] + ' : ' + elseM[2] + ';', indent: open.indent });
          i += 4;
          continue;
        }
      }
      result.push(stmts[i]);
    }
    return result;
  }

  /** Using pattern: try { ... } finally { v.Dispose(); } → using (v) { ... } */
  function _patternUsing(stmts) {
    const result = [];
    for (let i = 0; i < stmts.length; ++i) {
      if (stmts[i].code === 'try {' && stmts[i].kind === '_eh') {
        // Scan for matching finally with Dispose
        let depth = 1, finallyIdx = -1, closeIdx = -1;
        for (let j = i + 1; j < stmts.length; ++j) {
          const c = stmts[j].code;
          if (c === 'try {' && stmts[j].kind === '_eh') ++depth;
          else if (/^\} finally \{$/.test(c) && stmts[j].kind === '_eh' && depth === 1) finallyIdx = j;
          else if (c === '}' && stmts[j].kind === '_eh') {
            --depth;
            if (depth === 0) { closeIdx = j; break; }
          }
        }
        if (finallyIdx >= 0 && closeIdx >= 0) {
          // Check if finally body is just Dispose
          const finallyBody = stmts.slice(finallyIdx + 1, closeIdx).filter(s => s.kind !== '_eh');
          const disposeMatch = finallyBody.length === 1 && finallyBody[0].code.match(/^(\w+)(?:\?)?\.Dispose\(\);?$/);
          if (disposeMatch) {
            // Find the variable assignment before try
            const varName = disposeMatch[1];
            let initExpr = null, initIdx = -1;
            if (i > 0 && stmts[i - 1].code.match(new RegExp('^' + varName + ' = (.+);$'))) {
              initExpr = stmts[i - 1].code.match(new RegExp('^' + varName + ' = (.+);$'))[1];
              initIdx = i - 1;
            }
            if (initExpr) {
              result.pop(); // remove the assignment we already pushed
              result.push({ offset: stmts[initIdx].offset, code: 'using (var ' + varName + ' = ' + initExpr + ') {', indent: stmts[i].indent });
            } else
              result.push({ offset: stmts[i].offset, code: 'using (' + varName + ') {', indent: stmts[i].indent });
            // Copy try body
            for (let j = i + 1; j < finallyIdx; ++j) result.push(stmts[j]);
            result.push({ offset: stmts[closeIdx].offset, code: '}', indent: stmts[i].indent });
            i = closeIdx;
            continue;
          }
        }
      }
      result.push(stmts[i]);
    }
    return result;
  }

  /** Foreach pattern: GetEnumerator + try { while (MoveNext) { Current } } finally { Dispose } */
  function _patternForeach(stmts) {
    const result = [];
    for (let i = 0; i < stmts.length; ++i) {
      // Look for: v = coll.GetEnumerator(); using (...) { while (v.MoveNext()) { cur = v.Current; ... } }
      const enumM = stmts[i].code.match(/^(\w+) = (.+)\.GetEnumerator\(\);$/);
      if (enumM && i + 1 < stmts.length) {
        const enumVar = enumM[1], coll = enumM[2];
        // Check if next is using (enumVar) { while (enumVar.MoveNext()) { ... } }
        const nextCode = stmts[i + 1].code;
        if (nextCode.match(new RegExp('^using \\(' + enumVar + '\\) \\{$')) || nextCode.match(new RegExp('^using \\(var ' + enumVar))) {
          // Find the while inside
          let whileIdx = -1;
          for (let j = i + 2; j < stmts.length && j < i + 5; ++j) {
            if (stmts[j].code.match(new RegExp('^while \\(' + enumVar + '\\.MoveNext\\(\\)\\)')))
              { whileIdx = j; break; }
          }
          if (whileIdx >= 0) {
            // Find Current assignment inside while body
            let curVar = null;
            for (let j = whileIdx + 1; j < stmts.length && j < whileIdx + 3; ++j) {
              const curM = stmts[j].code.match(new RegExp('^(\\w+) = ' + enumVar + '\\.Current;$'));
              if (curM) { curVar = curM[1]; break; }
            }
            if (curVar) {
              // Collect the rest of the while body
              let depth = 1, whileEnd = -1;
              for (let j = whileIdx + 1; j < stmts.length; ++j) {
                if (stmts[j].code.match(/\{$/)) ++depth;
                if (stmts[j].code === '}') { --depth; if (depth === 0) { whileEnd = j; break; } }
              }
              if (whileEnd >= 0) {
                // Find the using close
                let usingEnd = -1;
                for (let j = whileEnd + 1; j < stmts.length; ++j)
                  if (stmts[j].code === '}') { usingEnd = j; break; }
                if (usingEnd >= 0) {
                  const indent = stmts[i].indent || 0;
                  result.push({ offset: stmts[i].offset, code: 'foreach (var ' + curVar + ' in ' + coll + ') {', indent });
                  // Copy while body minus the Current assignment and while header
                  for (let j = whileIdx + 1; j < whileEnd; ++j) {
                    if (stmts[j].code.match(new RegExp('^' + curVar + ' = ' + enumVar + '\\.Current;$'))) continue;
                    result.push({ ...stmts[j], indent: indent + 1 });
                  }
                  result.push({ offset: stmts[usingEnd].offset, code: '}', indent });
                  i = usingEnd;
                  continue;
                }
              }
            }
          }
        }
      }
      result.push(stmts[i]);
    }
    return result;
  }

  /** Lock pattern: Monitor.Enter(obj); try { ... } finally { Monitor.Exit(obj); } */
  function _patternLock(stmts) {
    const result = [];
    for (let i = 0; i < stmts.length; ++i) {
      const enterM = stmts[i].code.match(/^Monitor\.Enter\((.+?)(?:,\s*.+)?\);?$/);
      if (enterM && i + 1 < stmts.length && stmts[i + 1].code === 'try {' && stmts[i + 1].kind === '_eh') {
        // Check if the finally body is Monitor.Exit
        let depth = 1, finallyIdx = -1, closeIdx = -1;
        for (let j = i + 2; j < stmts.length; ++j) {
          const c = stmts[j].code;
          if (c === 'try {' && stmts[j].kind === '_eh') ++depth;
          else if (/^\} finally \{$/.test(c) && stmts[j].kind === '_eh' && depth === 1) finallyIdx = j;
          else if (c === '}' && stmts[j].kind === '_eh') {
            --depth;
            if (depth === 0) { closeIdx = j; break; }
          }
        }
        if (finallyIdx >= 0 && closeIdx >= 0) {
          const finallyBody = stmts.slice(finallyIdx + 1, closeIdx).filter(s => s.kind !== '_eh');
          const exitM = finallyBody.length === 1 && finallyBody[0].code.match(/^Monitor\.Exit\((.+?)\);?$/);
          if (exitM) {
            const indent = stmts[i].indent || 0;
            result.push({ offset: stmts[i].offset, code: 'lock (' + enterM[1] + ') {', indent });
            for (let j = i + 2; j < finallyIdx; ++j) result.push(stmts[j]);
            result.push({ offset: stmts[closeIdx].offset, code: '}', indent });
            i = closeIdx;
            continue;
          }
        }
      }
      result.push(stmts[i]);
    }
    return result;
  }

  /** For loop: detect while preceded by init and ending with increment */
  function _patternForLoop(stmts) {
    const result = [];
    for (let i = 0; i < stmts.length; ++i) {
      // Look for: v = init; while (cond) { body; ++v; }
      const whileM = stmts[i].code.match(/^while \((.+)\) \{$/);
      if (whileM && i > 0) {
        const prev = result[result.length - 1];
        const initM = prev && prev.code.match(/^(\w+) = (.+);$/);
        if (initM) {
          // Find the closing brace and check if the last body statement is an increment
          let depth = 1, closeIdx = -1;
          for (let j = i + 1; j < stmts.length; ++j) {
            if (stmts[j].code.match(/\{$/)) ++depth;
            if (stmts[j].code === '}') { --depth; if (depth === 0) { closeIdx = j; break; } }
          }
          if (closeIdx > i + 1) {
            const lastBody = stmts[closeIdx - 1];
            const incrM = lastBody && lastBody.code.match(new RegExp('^\\+\\+' + initM[1] + ';$'));
            const incrM2 = lastBody && lastBody.code.match(new RegExp('^' + initM[1] + ' \\+= (\\d+);$'));
            if (incrM || incrM2) {
              const incr = incrM ? '++' + initM[1] : initM[1] + ' += ' + incrM2[1];
              result.pop(); // remove init statement
              result.push({ offset: prev.offset, code: 'for (var ' + initM[1] + ' = ' + initM[2] + '; ' + whileM[1] + '; ' + incr + ') {', indent: stmts[i].indent });
              // Copy body minus the increment
              for (let j = i + 1; j < closeIdx - 1; ++j) result.push(stmts[j]);
              result.push({ offset: stmts[closeIdx].offset, code: '}', indent: stmts[i].indent });
              i = closeIdx;
              continue;
            }
          }
        }
      }
      result.push(stmts[i]);
    }
    return result;
  }

  // =========================================================================
  // Modern C# Patterns (Phase 6)
  // =========================================================================

  function _modernize(stmts) {
    const result = [];
    for (let i = 0; i < stmts.length; ++i) {
      let c = stmts[i].code;
      // Clean up compiler-generated names
      c = c.replace(/<>c__DisplayClass\w*/g, 'closure');
      c = c.replace(/<(\w+)>b__\d+/g, '$1_lambda');
      c = c.replace(/<>1__state/g, 'state');
      c = c.replace(/<>t__builder/g, 'builder');
      c = c.replace(/<>s__\d+/g, function(m) { return 'tmp' + m.substring(4); });
      c = c.replace(/<(\w+)>d__\d+/g, '$1_stateMachine');
      c = c.replace(/CS\$<>8__locals\d*/g, 'locals');
      c = c.replace(/<>4__this/g, 'this');

      // Async/await: .GetAwaiter().GetResult() → await
      if (/\.GetAwaiter\(\)\.GetResult\(\)/.test(c)) {
        c = c.replace(/(\w+(?:\.\w+)*(?:\([^)]*\))?)\.GetAwaiter\(\)\.GetResult\(\)/g, 'await $1');
      }
      // Remove async builder boilerplate
      if (/AsyncTaskMethodBuilder|AsyncVoidMethodBuilder/.test(c)) {
        if (/\.Create\(\)/.test(c) || /\.SetResult\(/.test(c) || /\.Start\(/.test(c) || /\.SetException\(/.test(c))
          c = '// ' + c;
      }
      if (/\.AwaitUnsafeOnCompleted\(|\.AwaitOnCompleted\(/.test(c)) c = '// ' + c;

      // Nullable patterns
      c = c.replace(/\.get_HasValue\(\)/g, ' != null');
      c = c.replace(/\.HasValue/g, ' != null');
      c = c.replace(/\.get_Value\(\)/g, '.Value');

      // String.Format → $"..."
      const fmtM = c.match(/^(.*)String\.Format\("([^"]*)",\s*(.+)\)(.*)$/);
      if (fmtM) {
        const format = fmtM[2];
        const argsPart = fmtM[3];
        const args = [];
        let depth = 0, current = '';
        for (const ch of argsPart) {
          if (ch === '(' || ch === '[') ++depth;
          else if (ch === ')' || ch === ']') --depth;
          if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; }
          else current += ch;
        }
        if (current.trim()) args.push(current.trim());
        let interpolated = format.replace(/\{(\d+)(?::[^}]*)?\}/g, (_, idx) => '{' + (args[parseInt(idx, 10)] || '?') + '}');
        c = fmtM[1] + '$"' + interpolated + '"' + fmtM[4];
      }

      // Null-conditional: detect if (x == null) goto L; result = x.Method(); L: result = null;
      // (simplified — detect in adjacent statements)
      if (i + 3 < stmts.length) {
        const nullChk = c.match(/^if \((\w+) == null\) \{$/);
        if (nullChk) {
          const varName = nullChk[1];
          // Look for pattern: if (x == null) { v = null; } else { v = x.Something; }
          if (stmts[i + 1].code.match(new RegExp('^(\\w+) = null;$'))) {
            const assignVar = stmts[i + 1].code.match(/^(\w+) = null;$/)[1];
            if (stmts[i + 2].code === '} else {') {
              const elseM = stmts[i + 3].code.match(new RegExp('^' + assignVar + ' = ' + varName + '\\.(.+);$'));
              if (elseM && i + 4 < stmts.length && stmts[i + 4].code === '}') {
                result.push({ ...stmts[i], code: assignVar + ' = ' + varName + '?.' + elseM[1] + ';' });
                i += 4;
                continue;
              }
            }
          }
        }
      }

      // Null-coalescing: detect if (v != null) goto END; v = default; END:
      if (i + 2 < stmts.length) {
        const nnChk = c.match(/^if \((\w+) != null\) \{$/);
        if (nnChk && stmts[i + 1].code.match(new RegExp('^' + nnChk[1] + ' = (.+);$')) && stmts[i + 2].code === '}') {
          const fallback = stmts[i + 1].code.match(new RegExp('^' + nnChk[1] + ' = (.+);$'))[1];
          // Check if there's a previous assignment to this var
          if (result.length > 0 && result[result.length - 1].code.match(new RegExp('^' + nnChk[1] + ' = (.+);$'))) {
            const prevVal = result[result.length - 1].code.match(new RegExp('^' + nnChk[1] + ' = (.+);$'))[1];
            result[result.length - 1] = { ...result[result.length - 1], code: nnChk[1] + ' = ' + prevVal + ' ?? ' + fallback + ';' };
            i += 2;
            continue;
          }
        }
      }

      // Pattern matching: if (obj is Type) { t = (Type)obj; ... } → if (obj is Type t) { ... }
      if (i + 2 < stmts.length) {
        const isM = c.match(/^if \((\w+) is (\w+)\) \{$/);
        if (isM) {
          const castM = stmts[i + 1].code.match(new RegExp('^(\\w+) = \\(' + isM[2] + '\\)\\(' + isM[1] + '\\);$'));
          if (castM) {
            result.push({ ...stmts[i], code: 'if (' + isM[1] + ' is ' + isM[2] + ' ' + castM[1] + ') {' });
            i += 1; // skip the cast assignment
            continue;
          }
        }
      }

      // Expression-bodied: single return in method body
      // (detected at formatter level, not here)

      result.push({ ...stmts[i], code: c });
    }
    return result;
  }

  // =========================================================================
  // VB.NET Syntax Transformation (enhanced with structured blocks)
  // =========================================================================

  function _toVB(code) {
    // Structured block transforms
    let c = code;
    // while (cond) { → While cond
    const whileM = c.match(/^(\s*)while \((.+)\) \{$/);
    if (whileM) return whileM[1] + 'While ' + _vbExpr(whileM[2]);
    // } (closing while) — handled by depth tracking
    // do { → Do
    if (/^\s*do \{$/.test(c)) return c.replace(/do \{$/, 'Do');
    // } while (cond); → Loop While cond
    const doWhileM = c.match(/^(\s*)\} while \((.+)\);$/);
    if (doWhileM) return doWhileM[1] + 'Loop While ' + _vbExpr(doWhileM[2]);
    // for (...) { → For ...
    const forM = c.match(/^(\s*)for \(var (\w+) = (.+); (.+); \+\+\2\) \{$/);
    if (forM) return forM[1] + 'For ' + forM[2] + ' = ' + _vbExpr(forM[3]) + ' To ' + _vbExpr(forM[4].replace(new RegExp(forM[2] + '\\s*<\\s*'), '').replace(new RegExp(forM[2] + '\\s*<=\\s*'), ''));
    // foreach (var x in coll) { → For Each x In coll
    const feM = c.match(/^(\s*)foreach \(var (\w+) in (.+)\) \{$/);
    if (feM) return feM[1] + 'For Each ' + feM[2] + ' In ' + _vbExpr(feM[3]);
    // if (cond) { → If cond Then
    const ifM = c.match(/^(\s*)if \((.+)\) \{$/);
    if (ifM) return ifM[1] + 'If ' + _vbExpr(ifM[2]) + ' Then';
    // } else { → Else
    if (/^\s*\} else \{$/.test(c)) return c.replace(/\} else \{$/, 'Else');
    // } catch (Type) { → Catch ex As Type
    const catchM = c.match(/^(\s*)\} catch \((.+)\) \{$/);
    if (catchM) return catchM[1] + 'Catch ex As ' + catchM[2];
    // } finally { → Finally
    if (/^\s*\} finally \{$/.test(c)) return c.replace(/\} finally \{$/, 'Finally');
    // try { → Try
    if (/^\s*try \{$/.test(c)) return c.replace(/try \{$/, 'Try');
    // using (...) { → Using ...
    const usingM = c.match(/^(\s*)using \((.+)\) \{$/);
    if (usingM) return usingM[1] + 'Using ' + _vbExpr(usingM[2]);
    // lock (obj) { → SyncLock obj
    const lockM = c.match(/^(\s*)lock \((.+)\) \{$/);
    if (lockM) return lockM[1] + 'SyncLock ' + _vbExpr(lockM[2]);
    // switch (expr) { → Select Case expr
    const switchM = c.match(/^(\s*)switch \((.+)\) \{$/);
    if (switchM) return switchM[1] + 'Select Case ' + _vbExpr(switchM[2]);
    // case N: → Case N
    const caseM = c.match(/^(\s*)case (.+):$/);
    if (caseM) return caseM[1] + 'Case ' + caseM[2];
    // } → End ... (generic close)
    if (/^\s*\}$/.test(c)) return c.replace('}', 'End');
    // Regular statements
    return _vbExpr(c);
  }

  function _vbExpr(c) {
    return c
      .replace(/\bnull\b/g, 'Nothing')
      .replace(/\btrue\b/g, 'True')
      .replace(/\bfalse\b/g, 'False')
      .replace(/\bnew\b/g, 'New')
      .replace(/\btypeof\b/g, 'GetType')
      .replace(/\bsizeof\b/g, 'Len')
      .replace(/\bstackalloc\b/g, 'ReDim')
      .replace(/\bthrow;/g, 'Throw')
      .replace(/\bthrow\b/g, 'Throw')
      .replace(/\breturn\b/g, 'Return')
      .replace(/\bgoto\b/g, 'GoTo')
      .replace(/\bif\s*\((.+?)\)\s*goto\s+(IL_[0-9A-Fa-f]+);/g, 'If $1 Then GoTo $2')
      .replace(/\bif\s*\((.+?)\)\s*GoTo\s+(IL_[0-9A-Fa-f]+);/g, 'If $1 Then GoTo $2')
      .replace(/ != /g, ' <> ')
      .replace(/ == /g, ' = ')
      .replace(/!(\w)/g, 'Not $1')
      .replace(/!\(/g, 'Not (')
      .replace(/ && /g, ' AndAlso ')
      .replace(/ \|\| /g, ' OrElse ')
      .replace(/\(sbyte\)/g, 'CSByte').replace(/\(byte\)/g, 'CByte').replace(/\(short\)/g, 'CShort').replace(/\(ushort\)/g, 'CUShort')
      .replace(/\(int\)/g, 'CInt').replace(/\(uint\)/g, 'CUInt').replace(/\(long\)/g, 'CLng').replace(/\(ulong\)/g, 'CULng')
      .replace(/\(float\)/g, 'CSng').replace(/\(double\)/g, 'CDbl').replace(/\(nint\)/g, 'CType').replace(/\(nuint\)/g, 'CType')
      .replace(/\(object\)/g, 'CObj').replace(/\(string\)/g, 'CStr')
      .replace(/ is (\w+)/g, function(_, t) { return ' Is ' + t; })
      .replace(/;\s*$/g, '')
      .replace(/;/g, '');
  }

  // =========================================================================
  // Formatting & Formatter Registration
  // =========================================================================

  function _fmtStmts(stmts, kwSet, decompiled) {
    if (decompiled) {
      // Collect all goto targets to build label map
      const targetOffsets = new Set();
      const gotoRx = /\b(?:goto|GoTo)\s+IL_([0-9A-Fa-f]{4,})\b/g;
      for (const s of stmts) {
        if (!s.code) continue;
        let m;
        while ((m = gotoRx.exec(s.code)) !== null)
          targetOffsets.add(parseInt(m[1], 16));
        gotoRx.lastIndex = 0;
      }

      // Assign sequential label names ordered by offset
      const sorted = [...targetOffsets].sort((a, b) => a - b);
      const labelMap = new Map();
      for (let i = 0; i < sorted.length; ++i)
        labelMap.set(sorted[i], 'label_' + i);

      // Replace IL_XXXX references with label names in code text
      const replaceLabels = (code) =>
        code.replace(/\bIL_([0-9A-Fa-f]{4,})\b/g, (_, hex) => {
          const off = parseInt(hex, 16);
          return labelMap.has(off) ? labelMap.get(off) : 'IL_' + hex;
        });

      const lines = [];
      for (const s of stmts) {
        if (!s.code && s.code !== '') continue;
        const indent = '    '.repeat(s.indent || 0);

        // Insert label line before this statement if it is a jump target
        if (labelMap.has(s.offset))
          lines.push(
            '<span class="da-line" data-offset="' + s.offset.toString(16) + '">'
            + (indent ? esc(indent) : '')
            + _hl(labelMap.get(s.offset) + ':', kwSet)
            + '</span>'
          );

        lines.push(
          '<span class="da-line" data-offset="' + s.offset.toString(16) + '">'
          + (indent ? esc(indent) : '')
          + _hl(replaceLabels(s.code), kwSet)
          + '</span>'
        );
      }
      return lines.join('\n');
    }

    const lines = [];
    for (const s of stmts) {
      if (!s.code && s.code !== '') continue;
      const offHex = s.offset.toString(16).padStart(8, '0').toUpperCase();
      const indent = '    '.repeat(s.indent || 0);
      lines.push(
        '<span class="da-line" data-offset="' + s.offset.toString(16) + '">'
        + '<span class="da-off">' + esc(offHex) + '</span>'
        + '<span class="da-sep"> | </span>'
        + (indent ? esc(indent) : '')
        + _hl(s.code, kwSet)
        + '</span>'
      );
    }
    return lines.join('\n');
  }

  /** Full structuring pipeline: EH → control flow → patterns */
  function _fullStructure(stmts, annot) {
    let result = _structureEH(stmts, annot);
    result = _structureCF(result);
    result = _applyPatterns(result);
    return result;
  }

  /** Wrap method body with header and local declarations */
  function _wrapMethod(stmts, annot) {
    const header = _buildMethodHeader(annot);
    const locals = _buildLocalDecls(annot);
    if (!header && locals.length === 0) return stmts;
    const prefix = [];
    const baseOff = stmts.length > 0 ? stmts[0].offset : 0;
    if (header)
      prefix.push({ offset: baseOff, code: header + ' {', indent: 0 });
    for (const l of locals) prefix.push({ ...l, offset: baseOff, indent: 1 });
    if (prefix.length > 0 && locals.length > 0)
      prefix.push({ offset: baseOff, code: '', indent: 0 }); // blank line after locals
    const indented = stmts.map(s => ({ ...s, indent: (s.indent || 0) + 1 }));
    const endOff = stmts.length > 0 ? stmts[stmts.length - 1].offset : 0;
    return [...prefix, ...indented, { offset: endOff, code: '}', indent: 0 }];
  }

  if (D.registerDecompileFormatter) {
    // Pseudo-C# (C# 2.0 level) — structured with method header
    D.registerDecompileFormatter('csharp-low', (insns, annot) => {
      let stmts = _decompileStatements(insns, annot);
      stmts = _fullStructure(stmts, annot);
      stmts = _wrapMethod(stmts, annot);
      return _fmtStmts(stmts, CS_KW, true);
    });
    // Pseudo-VB.NET — structured with VB syntax
    D.registerDecompileFormatter('vb', (insns, annot) => {
      let stmts = _decompileStatements(insns, annot);
      stmts = _fullStructure(stmts, annot);
      return _fmtStmts(stmts.map(s => ({ ...s, code: _toVB(s.code) })), VB_KW, true);
    });
    // C# (simplified) — modern patterns with method header
    D.registerDecompileFormatter('csharp', (insns, annot) => {
      let stmts = _decompileStatements(insns, annot);
      stmts = _fullStructure(stmts, annot);
      stmts = _modernize(stmts);
      stmts = _wrapMethod(stmts, annot);
      return _fmtStmts(stmts, CS_KW, true);
    });
  }

})();
