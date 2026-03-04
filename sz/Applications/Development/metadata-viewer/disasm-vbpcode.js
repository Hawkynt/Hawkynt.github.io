;(function() {
  'use strict';
  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // Visual Basic 6 P-code Disassembler
  // =========================================================================

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function hex(n) { return '0x' + (n >>> 0).toString(16).toUpperCase(); }

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

  function f32le(bytes, off) {
    const buf = new ArrayBuffer(4);
    const dv = new DataView(buf);
    for (let i = 0; i < 4; ++i) dv.setUint8(i, u8(bytes, off + i));
    return dv.getFloat32(0, true);
  }

  function f64le(bytes, off) {
    const buf = new ArrayBuffer(8);
    const dv = new DataView(buf);
    for (let i = 0; i < 8; ++i) dv.setUint8(i, u8(bytes, off + i));
    return dv.getFloat64(0, true);
  }

  // -------------------------------------------------------------------------
  // Opcode table
  //
  // Each entry: [mnemonic, argBytes, handler(bytes, opOff) -> { operands, pseudoC }]
  //   argBytes: number of operand bytes following the opcode
  //   opOff: offset of first operand byte
  // -------------------------------------------------------------------------

  const OPS = Object.create(null);

  function op(code, name, argBytes, handler) {
    OPS[code] = { name, argBytes, handler: handler || null };
  }

  // --- Literal push ---
  op(0x00, 'LitI2', 2, (b, o) => {
    const v = i16le(b, o);
    return { operands: String(v), pseudoC: 'push((int16)' + v + ')' };
  });
  op(0x01, 'LitI4', 4, (b, o) => {
    const v = i32le(b, o);
    return { operands: String(v), pseudoC: 'push((int32)' + v + ')' };
  });
  op(0x02, 'LitR4', 4, (b, o) => {
    const v = f32le(b, o);
    return { operands: String(v), pseudoC: 'push((single)' + v + ')' };
  });
  op(0x03, 'LitR8', 8, (b, o) => {
    const v = f64le(b, o);
    return { operands: String(v), pseudoC: 'push((double)' + v + ')' };
  });
  op(0x13, 'LitStr', 4, (b, o) => {
    const addr = u32le(b, o);
    return { operands: hex(addr), pseudoC: 'push(str@' + hex(addr) + ')' };
  });
  op(0x60, 'LitNothing', 0, () => ({
    operands: '', pseudoC: 'push(Nothing)'
  }));
  op(0xF5, 'LitI2_Byte', 1, (b, o) => {
    const v = u8(b, o);
    return { operands: String(v), pseudoC: 'push((int16)' + v + ')' };
  });

  // --- Load/store frame variables ---
  op(0x04, 'FLdRfVar', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'push(ref var@' + hex(v) + ')' };
  });
  op(0x05, 'FLdI2', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'push(int16 var@' + hex(v) + ')' };
  });
  op(0x06, 'FLdI4', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'push(int32 var@' + hex(v) + ')' };
  });
  op(0x08, 'FStRfVar', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'ref var@' + hex(v) + ' = pop()' };
  });
  op(0x09, 'FStI2', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'int16 var@' + hex(v) + ' = pop()' };
  });
  op(0x0A, 'FStI4', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'int32 var@' + hex(v) + ' = pop()' };
  });
  op(0x0D, 'FStR4', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'single var@' + hex(v) + ' = pop()' };
  });
  op(0x0E, 'FStR8', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'double var@' + hex(v) + ' = pop()' };
  });
  op(0x0F, 'FStStr', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'string var@' + hex(v) + ' = pop()' };
  });
  op(0x10, 'FLdFPR4', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'push(fp single@' + hex(v) + ')' };
  });
  op(0x11, 'FLdFPR8', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'push(fp double@' + hex(v) + ')' };
  });

  // --- Branching ---
  op(0x18, 'BranchF', 2, (b, o) => {
    const target = u16le(b, o);
    return { operands: hex(target), pseudoC: 'if not pop() goto ' + hex(target) };
  });
  op(0x19, 'BranchT', 2, (b, o) => {
    const target = u16le(b, o);
    return { operands: hex(target), pseudoC: 'if pop() goto ' + hex(target) };
  });
  op(0x1A, 'Branch', 2, (b, o) => {
    const target = u16le(b, o);
    return { operands: hex(target), pseudoC: 'goto ' + hex(target) };
  });

  // --- Exit ---
  op(0x1C, 'Exit', 0, () => ({
    operands: '', pseudoC: 'exit procedure'
  }));

  // --- Integer arithmetic (int16) ---
  op(0x1E, 'AddI2', 0, () => ({ operands: '', pseudoC: 'push(pop() + pop())' }));
  op(0x1F, 'AddI4', 0, () => ({ operands: '', pseudoC: 'push(pop() + pop())' }));
  op(0x20, 'SubI2', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() - a)' }));
  op(0x21, 'SubI4', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() - a)' }));
  op(0x22, 'MulI2', 0, () => ({ operands: '', pseudoC: 'push(pop() * pop())' }));
  op(0x23, 'MulI4', 0, () => ({ operands: '', pseudoC: 'push(pop() * pop())' }));
  op(0x24, 'DivI2', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() \\ a)' }));
  op(0x25, 'DivI4', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() \\ a)' }));
  op(0x26, 'ModI2', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() Mod a)' }));
  op(0x27, 'ModI4', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() Mod a)' }));

  // --- Negate ---
  op(0x28, 'NegI2', 0, () => ({ operands: '', pseudoC: 'push(-pop())' }));
  op(0x29, 'NegI4', 0, () => ({ operands: '', pseudoC: 'push(-pop())' }));

  // --- Bitwise not ---
  op(0x2A, 'NotI2', 0, () => ({ operands: '', pseudoC: 'push(Not pop())' }));
  op(0x2B, 'NotI4', 0, () => ({ operands: '', pseudoC: 'push(Not pop())' }));

  // --- Bitwise and/or/xor ---
  op(0x2C, 'AndI2', 0, () => ({ operands: '', pseudoC: 'push(pop() And pop())' }));
  op(0x2D, 'AndI4', 0, () => ({ operands: '', pseudoC: 'push(pop() And pop())' }));
  op(0x2E, 'OrI2', 0, () => ({ operands: '', pseudoC: 'push(pop() Or pop())' }));
  op(0x2F, 'OrI4', 0, () => ({ operands: '', pseudoC: 'push(pop() Or pop())' }));
  op(0x30, 'XorI2', 0, () => ({ operands: '', pseudoC: 'push(pop() Xor pop())' }));
  op(0x31, 'XorI4', 0, () => ({ operands: '', pseudoC: 'push(pop() Xor pop())' }));

  // --- Comparison (int16) ---
  op(0x34, 'EqI2', 0, () => ({ operands: '', pseudoC: 'push(pop() = pop())' }));
  op(0x36, 'NeI2', 0, () => ({ operands: '', pseudoC: 'push(pop() <> pop())' }));
  op(0x38, 'LtI2', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() < a)' }));
  op(0x3A, 'GtI2', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() > a)' }));
  op(0x3C, 'LeI2', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() <= a)' }));
  op(0x3E, 'GeI2', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() >= a)' }));

  // --- String concatenation ---
  op(0x44, 'ConcatStr', 0, () => ({
    operands: '', pseudoC: 'a=pop(); push(pop() & a)'
  }));

  // --- Virtual call ---
  op(0x5C, 'VCallAd', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'vcall @' + hex(v) };
  });

  // --- CVarRef ---
  op(0x5E, 'CVarRef', 0, () => ({
    operands: '', pseudoC: 'convert variant ref'
  }));

  // --- Bool ---
  op(0xF6, 'BoolI2', 0, () => ({
    operands: '', pseudoC: 'push(CBool(pop()))'
  }));

  // -------------------------------------------------------------------------
  // Extended opcode table (0xFB prefix)
  // -------------------------------------------------------------------------

  const EXT_OPS = Object.create(null);

  function ext(code, name, argBytes, handler) {
    EXT_OPS[code] = { name, argBytes, handler: handler || null };
  }

  // --- Double arithmetic ---
  ext(0x01, 'AddR8', 0, () => ({ operands: '', pseudoC: 'push(pop() + pop())' }));
  ext(0x02, 'SubR8', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() - a)' }));
  ext(0x03, 'MulR8', 0, () => ({ operands: '', pseudoC: 'push(pop() * pop())' }));
  ext(0x04, 'DivR8', 0, () => ({ operands: '', pseudoC: 'a=pop(); push(pop() / a)' }));

  // --- COM call ---
  ext(0x0E, 'VCallHresult', 4, (b, o) => {
    const v = u32le(b, o);
    return { operands: hex(v), pseudoC: 'hresult = vcall @' + hex(v) };
  });

  // --- Property load/store ---
  ext(0x21, 'FLdPr', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'push(property@' + hex(v) + ')' };
  });
  ext(0x22, 'FStPr', 2, (b, o) => {
    const v = u16le(b, o);
    return { operands: hex(v), pseudoC: 'property@' + hex(v) + ' = pop()' };
  });

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

    while (result.length < limit && pos < end) {
      const instrOffset = pos;
      const opByte = view[pos++];

      // --- Extended prefix ---
      if (opByte === 0xFB) {
        if (pos >= end) {
          result.push({
            offset: instrOffset, length: 1,
            bytes: view.slice(instrOffset, instrOffset + 1),
            mnemonic: 'db', operands: '0xFB',
            pseudoC: '/* truncated extended prefix */',
          });
          break;
        }
        const extByte = view[pos++];
        const entry = EXT_OPS[extByte];
        if (!entry) {
          result.push({
            offset: instrOffset, length: 2,
            bytes: view.slice(instrOffset, instrOffset + 2),
            mnemonic: 'db', operands: '0xFB ' + hex(extByte),
            pseudoC: '/* unknown extended opcode */',
          });
          continue;
        }

        if (pos + entry.argBytes > end) {
          result.push({
            offset: instrOffset, length: end - instrOffset,
            bytes: view.slice(instrOffset, end),
            mnemonic: entry.name, operands: '(truncated)',
            pseudoC: '/* truncated */',
          });
          break;
        }

        let operands = '';
        let pseudoC = '';
        if (entry.handler) {
          const h = entry.handler(view, pos);
          operands = h.operands || '';
          pseudoC = h.pseudoC || '';
        }

        const totalLen = 2 + entry.argBytes;
        result.push({
          offset: instrOffset,
          length: totalLen,
          bytes: view.slice(instrOffset, instrOffset + totalLen),
          mnemonic: entry.name,
          operands,
          pseudoC,
        });
        pos += entry.argBytes;
        continue;
      }

      // --- Standard opcode ---
      const entry = OPS[opByte];
      if (!entry) {
        result.push({
          offset: instrOffset, length: 1,
          bytes: view.slice(instrOffset, instrOffset + 1),
          mnemonic: 'db', operands: hex(opByte),
          pseudoC: '/* unknown opcode */',
        });
        continue;
      }

      if (pos + entry.argBytes > end) {
        result.push({
          offset: instrOffset, length: end - instrOffset,
          bytes: view.slice(instrOffset, end),
          mnemonic: entry.name, operands: '(truncated)',
          pseudoC: '/* truncated */',
        });
        break;
      }

      let operands = '';
      let pseudoC = '';
      if (entry.handler) {
        const h = entry.handler(view, pos);
        operands = h.operands || '';
        pseudoC = h.pseudoC || '';
      }

      const totalLen = 1 + entry.argBytes;
      result.push({
        offset: instrOffset,
        length: totalLen,
        bytes: view.slice(instrOffset, instrOffset + totalLen),
        mnemonic: entry.name,
        operands,
        pseudoC,
      });
      pos += entry.argBytes;
    }

    return result;
  }

  // =========================================================================
  // Register
  // =========================================================================

  D.registerDisassembler('vbpcode', decode);

})();
