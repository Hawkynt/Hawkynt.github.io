;(function() {
  'use strict';
  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // newarray type codes
  // =========================================================================
  const NEWARRAY_TYPES = {
    4: 'boolean', 5: 'char', 6: 'float', 7: 'double',
    8: 'byte', 9: 'short', 10: 'int', 11: 'long',
  };

  // =========================================================================
  // Constant Pool Resolution
  // =========================================================================

  /**
   * Resolve a constant pool index to a human-readable name.
   *
   * @param {Array} cp  Constant pool entries (1-indexed).
   * @param {Uint8Array} bytes  Raw class file bytes.
   * @param {number} idx  Constant pool index.
   * @returns {{ text: string, tokens: Array }} Resolved name and typed tokens.
   */
  function resolveCp(cp, bytes, idx) {
    if (!cp || !bytes || idx <= 0 || idx >= cp.length || !cp[idx])
      return { text: '#' + idx, tokens: [{ type: 'num', value: '#' + idx }] };

    const entry = cp[idx];
    const rU16 = (off) => (bytes[off] << 8) | bytes[off + 1];

    switch (entry.tag) {
      case 1: // CONSTANT_Utf8
        return { text: entry.value, tokens: [{ type: 'str', value: entry.value }] };

      case 3: // CONSTANT_Integer
        return { text: String(readI32BE(bytes, entry.offset + 1)), tokens: [{ type: 'num', value: String(readI32BE(bytes, entry.offset + 1)) }] };

      case 4: // CONSTANT_Float
      {
        const buf = new ArrayBuffer(4);
        const dv = new DataView(buf);
        for (let i = 0; i < 4; ++i) dv.setUint8(i, bytes[entry.offset + 1 + i]);
        const v = dv.getFloat32(0);
        return { text: v + 'f', tokens: [{ type: 'num', value: v + 'f' }] };
      }

      case 5: // CONSTANT_Long
      {
        const hi = readI32BE(bytes, entry.offset + 1);
        const lo = readI32BE(bytes, entry.offset + 5);
        const s = '0x' + ((hi >>> 0).toString(16).padStart(8, '0') + (lo >>> 0).toString(16).padStart(8, '0')).toUpperCase();
        return { text: s + 'L', tokens: [{ type: 'num', value: s + 'L' }] };
      }

      case 6: // CONSTANT_Double
      {
        const buf = new ArrayBuffer(8);
        const dv = new DataView(buf);
        for (let i = 0; i < 8; ++i) dv.setUint8(i, bytes[entry.offset + 1 + i]);
        const v = dv.getFloat64(0);
        return { text: String(v), tokens: [{ type: 'num', value: String(v) }] };
      }

      case 7: // CONSTANT_Class -> name_index
      {
        const nameIdx = rU16(entry.offset + 1);
        const name = resolveUtf8(cp, nameIdx);
        const pretty = name.replace(/\//g, '.');
        return { text: pretty, tokens: [{ type: 'sym', value: pretty }] };
      }

      case 8: // CONSTANT_String -> string_index
      {
        const strIdx = rU16(entry.offset + 1);
        const s = resolveUtf8(cp, strIdx);
        return { text: '"' + s + '"', tokens: [{ type: 'str', value: '"' + s + '"' }] };
      }

      case 9: // CONSTANT_Fieldref -> class_index, name_and_type_index
      case 10: // CONSTANT_Methodref
      case 11: // CONSTANT_InterfaceMethodref
      {
        const classIdx = rU16(entry.offset + 1);
        const natIdx = rU16(entry.offset + 3);
        const className = resolveClass(cp, bytes, classIdx);
        const { name: memberName, descriptor } = resolveNameAndType(cp, bytes, natIdx);
        const kind = entry.tag === 9 ? 'field' : 'method';
        const prettyDesc = simplifyDescriptor(descriptor);
        const text = className + '.' + memberName + (entry.tag !== 9 ? prettyDesc : (prettyDesc ? ':' + prettyDesc : ''));
        const tokens = [
          { type: 'sym', value: className },
          { type: 'op', value: '.' },
          { type: kind === 'field' ? 'id' : 'sym', value: memberName },
        ];
        if (prettyDesc) {
          if (entry.tag !== 9)
            tokens.push({ type: 'kw', value: prettyDesc });
          else
            tokens.push({ type: 'op', value: ':' }, { type: 'kw', value: prettyDesc });
        }
        return { text, tokens };
      }

      case 12: // CONSTANT_NameAndType -> name_index, descriptor_index
      {
        const { name: n, descriptor: d } = resolveNameAndType(cp, bytes, idx);
        const text = n + ':' + d;
        return { text, tokens: [{ type: 'id', value: n }, { type: 'op', value: ':' }, { type: 'kw', value: d }] };
      }

      case 15: // CONSTANT_MethodHandle
        return { text: 'MethodHandle#' + idx, tokens: [{ type: 'kw', value: 'MethodHandle' }, { type: 'num', value: '#' + idx }] };

      case 16: // CONSTANT_MethodType -> descriptor_index
      {
        const descIdx = rU16(entry.offset + 1);
        const desc = resolveUtf8(cp, descIdx);
        return { text: 'MethodType(' + desc + ')', tokens: [{ type: 'kw', value: 'MethodType' }, { type: 'op', value: '(' }, { type: 'kw', value: desc }, { type: 'op', value: ')' }] };
      }

      case 17: // CONSTANT_Dynamic
      case 18: // CONSTANT_InvokeDynamic
      {
        const natIdx2 = rU16(entry.offset + 3);
        const { name: n2 } = resolveNameAndType(cp, bytes, natIdx2);
        const label = entry.tag === 17 ? 'dynamic' : 'invokedynamic';
        return { text: label + ' ' + n2, tokens: [{ type: 'kw', value: label }, { type: 'text', value: ' ' }, { type: 'sym', value: n2 }] };
      }

      default:
        return { text: '#' + idx, tokens: [{ type: 'num', value: '#' + idx }] };
    }
  }

  function resolveUtf8(cp, idx) {
    if (idx > 0 && idx < cp.length && cp[idx] && cp[idx].tag === 1)
      return cp[idx].value || '';
    return '?';
  }

  function resolveClass(cp, bytes, idx) {
    if (idx > 0 && idx < cp.length && cp[idx] && cp[idx].tag === 7) {
      const nameIdx = (bytes[cp[idx].offset + 1] << 8) | bytes[cp[idx].offset + 2];
      return resolveUtf8(cp, nameIdx).replace(/\//g, '.');
    }
    return '?';
  }

  function resolveNameAndType(cp, bytes, idx) {
    if (idx > 0 && idx < cp.length && cp[idx] && cp[idx].tag === 12) {
      const nameIdx = (bytes[cp[idx].offset + 1] << 8) | bytes[cp[idx].offset + 2];
      const descIdx = (bytes[cp[idx].offset + 3] << 8) | bytes[cp[idx].offset + 4];
      return { name: resolveUtf8(cp, nameIdx), descriptor: resolveUtf8(cp, descIdx) };
    }
    return { name: '?', descriptor: '?' };
  }

  function readI32BE(bytes, off) {
    return (bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3];
  }

  /**
   * Simplify a Java type descriptor to a more readable form.
   * (Ljava/lang/String;)V -> (String)void
   */
  function simplifyDescriptor(desc) {
    if (!desc || desc === '?') return '';
    const result = [];
    let i = 0;
    const parseType = () => {
      let arrays = 0;
      while (i < desc.length && desc[i] === '[') { ++arrays; ++i; }
      let base;
      switch (desc[i]) {
        case 'B': base = 'byte'; ++i; break;
        case 'C': base = 'char'; ++i; break;
        case 'D': base = 'double'; ++i; break;
        case 'F': base = 'float'; ++i; break;
        case 'I': base = 'int'; ++i; break;
        case 'J': base = 'long'; ++i; break;
        case 'S': base = 'short'; ++i; break;
        case 'Z': base = 'boolean'; ++i; break;
        case 'V': base = 'void'; ++i; break;
        case 'L': {
          ++i;
          const end = desc.indexOf(';', i);
          if (end < 0) { base = desc.substring(i); i = desc.length; }
          else { base = desc.substring(i, end).replace(/\//g, '.'); i = end + 1; }
          // Shorten common packages
          if (base.startsWith('java.lang.')) base = base.substring(10);
          break;
        }
        default: base = desc[i] || '?'; ++i; break;
      }
      return base + '[]'.repeat(arrays);
    };

    if (desc[0] === '(') {
      ++i;
      const params = [];
      while (i < desc.length && desc[i] !== ')')
        params.push(parseType());
      ++i; // skip ')'
      const ret = i < desc.length ? parseType() : 'void';
      return '(' + params.join(', ') + ')' + ret;
    }
    return desc;
  }

  // =========================================================================
  // Helpers
  // =========================================================================
  function s16(hi, lo) { return ((hi << 8) | lo) << 16 >> 16; }
  function u16(hi, lo) { return (hi << 8) | lo; }
  function s32(a, b, c, d) { return (a << 24) | (b << 16) | (c << 8) | d; }
  function hex(n) { return '0x' + (n >>> 0).toString(16).toUpperCase(); }

  // =========================================================================
  // Opcode table — generates operand text and pseudo-C.
  // Each entry: [mnemonic, operandBytes, pseudoCFn, cpResolve]
  //   cpResolve: if true, the first 1-2 operand bytes are a CP index to resolve
  // =========================================================================

  const _push = (v) => () => ({ pseudo: 'push(' + v + ')' });
  const _pushLocal = (n) => () => ({ pseudo: 'push(local[' + n + '])' });
  const _storeLocal = (n) => () => ({ pseudo: 'local[' + n + '] = pop()' });
  const _binop = (op, commutative) => () => ({
    pseudo: commutative ? 'push(pop() ' + op + ' pop())' : 'a=pop(); push(pop()' + op + 'a)',
  });
  const _unop = (op) => () => ({ pseudo: 'push(' + op + 'pop())' });
  const _branch = (cond) => (ops, off) => {
    const target = off + s16(ops[0], ops[1]);
    return { pseudo: 'if (' + cond + ') goto ' + hex(target), operands: hex(target) };
  };
  const _ret = (what) => () => ({ pseudo: what ? 'return pop()' : 'return' });
  const _conv = (from, to) => () => ({ pseudo: 'push((' + to + ')pop())' });

  // CP-referencing operand builder
  const _cpOp = (prefix, suffix) => (ops, off, cp, bytes) => {
    const idx = u16(ops[0], ops[1]);
    if (cp && bytes) {
      const resolved = resolveCp(cp, bytes, idx);
      return {
        pseudo: prefix + resolved.text + (suffix || ''),
        operands: resolved.text,
        tokens: [
          ...(prefix ? [{ type: 'text', value: '' }] : []),
          ...resolved.tokens,
          ...(suffix ? [{ type: 'text', value: suffix }] : []),
        ],
      };
    }
    return { pseudo: prefix + '#' + idx + (suffix || ''), operands: '#' + idx };
  };

  const opcodes = new Array(256).fill(null);

  function op(code, mnemonic, operandBytes, handler, cpResolve) {
    opcodes[code] = { mnemonic, operandBytes, handler, cpResolve: !!cpResolve };
  }

  // --- Constants ---
  op(0x00, 'nop', 0, () => ({ pseudo: 'nop' }));
  op(0x01, 'aconst_null', 0, _push('null'));
  op(0x02, 'iconst_m1', 0, _push('-1'));
  for (let i = 0; i <= 5; ++i) op(0x03 + i, 'iconst_' + i, 0, _push(String(i)));
  op(0x09, 'lconst_0', 0, _push('0L'));
  op(0x0A, 'lconst_1', 0, _push('1L'));
  op(0x0B, 'fconst_0', 0, _push('0.0f'));
  op(0x0C, 'fconst_1', 0, _push('1.0f'));
  op(0x0D, 'fconst_2', 0, _push('2.0f'));
  op(0x0E, 'dconst_0', 0, _push('0.0'));
  op(0x0F, 'dconst_1', 0, _push('1.0'));
  op(0x10, 'bipush', 1, (ops) => ({ pseudo: 'push(' + ((ops[0] << 24) >> 24) + ')', operands: String((ops[0] << 24) >> 24) }));
  op(0x11, 'sipush', 2, (ops) => ({ pseudo: 'push(' + s16(ops[0], ops[1]) + ')', operands: String(s16(ops[0], ops[1])) }));

  // ldc — 1-byte CP index
  op(0x12, 'ldc', 1, (ops, off, cp, bytes) => {
    const idx = ops[0];
    if (cp && bytes) {
      const r = resolveCp(cp, bytes, idx);
      return { pseudo: 'push(' + r.text + ')', operands: r.text, tokens: r.tokens };
    }
    return { pseudo: 'push(const #' + idx + ')', operands: '#' + idx };
  }, true);

  // ldc_w, ldc2_w — 2-byte CP index
  op(0x13, 'ldc_w', 2, (ops, off, cp, bytes) => {
    const idx = u16(ops[0], ops[1]);
    if (cp && bytes) {
      const r = resolveCp(cp, bytes, idx);
      return { pseudo: 'push(' + r.text + ')', operands: r.text, tokens: r.tokens };
    }
    return { pseudo: 'push(const #' + idx + ')', operands: '#' + idx };
  }, true);
  op(0x14, 'ldc2_w', 2, (ops, off, cp, bytes) => {
    const idx = u16(ops[0], ops[1]);
    if (cp && bytes) {
      const r = resolveCp(cp, bytes, idx);
      return { pseudo: 'push(' + r.text + ')', operands: r.text, tokens: r.tokens };
    }
    return { pseudo: 'push(const2 #' + idx + ')', operands: '#' + idx };
  }, true);

  // --- Loads ---
  op(0x15, 'iload', 1, (ops) => ({ pseudo: 'push(local[' + ops[0] + '])', operands: String(ops[0]) }));
  op(0x16, 'lload', 1, (ops) => ({ pseudo: 'push(local[' + ops[0] + '])', operands: String(ops[0]) }));
  op(0x17, 'fload', 1, (ops) => ({ pseudo: 'push(local[' + ops[0] + '])', operands: String(ops[0]) }));
  op(0x18, 'dload', 1, (ops) => ({ pseudo: 'push(local[' + ops[0] + '])', operands: String(ops[0]) }));
  op(0x19, 'aload', 1, (ops) => ({ pseudo: 'push(local[' + ops[0] + '])', operands: String(ops[0]) }));
  for (let i = 0; i <= 3; ++i) op(0x1A + i, 'iload_' + i, 0, _pushLocal(i));
  for (let i = 0; i <= 3; ++i) op(0x1E + i, 'lload_' + i, 0, _pushLocal(i));
  for (let i = 0; i <= 3; ++i) op(0x22 + i, 'fload_' + i, 0, _pushLocal(i));
  for (let i = 0; i <= 3; ++i) op(0x26 + i, 'dload_' + i, 0, _pushLocal(i));
  for (let i = 0; i <= 3; ++i) op(0x2A + i, 'aload_' + i, 0, _pushLocal(i));
  op(0x2E, 'iaload', 0, () => ({ pseudo: 'i=pop(); push(pop()[i])' }));
  op(0x2F, 'laload', 0, () => ({ pseudo: 'i=pop(); push(pop()[i])' }));
  op(0x30, 'faload', 0, () => ({ pseudo: 'i=pop(); push(pop()[i])' }));
  op(0x31, 'daload', 0, () => ({ pseudo: 'i=pop(); push(pop()[i])' }));
  op(0x32, 'aaload', 0, () => ({ pseudo: 'i=pop(); push(pop()[i])' }));
  op(0x33, 'baload', 0, () => ({ pseudo: 'i=pop(); push(pop()[i])' }));
  op(0x34, 'caload', 0, () => ({ pseudo: 'i=pop(); push(pop()[i])' }));
  op(0x35, 'saload', 0, () => ({ pseudo: 'i=pop(); push(pop()[i])' }));

  // --- Stores ---
  op(0x36, 'istore', 1, (ops) => ({ pseudo: 'local[' + ops[0] + '] = pop()', operands: String(ops[0]) }));
  op(0x37, 'lstore', 1, (ops) => ({ pseudo: 'local[' + ops[0] + '] = pop()', operands: String(ops[0]) }));
  op(0x38, 'fstore', 1, (ops) => ({ pseudo: 'local[' + ops[0] + '] = pop()', operands: String(ops[0]) }));
  op(0x39, 'dstore', 1, (ops) => ({ pseudo: 'local[' + ops[0] + '] = pop()', operands: String(ops[0]) }));
  op(0x3A, 'astore', 1, (ops) => ({ pseudo: 'local[' + ops[0] + '] = pop()', operands: String(ops[0]) }));
  for (let i = 0; i <= 3; ++i) op(0x3B + i, 'istore_' + i, 0, _storeLocal(i));
  for (let i = 0; i <= 3; ++i) op(0x3F + i, 'lstore_' + i, 0, _storeLocal(i));
  for (let i = 0; i <= 3; ++i) op(0x43 + i, 'fstore_' + i, 0, _storeLocal(i));
  for (let i = 0; i <= 3; ++i) op(0x47 + i, 'dstore_' + i, 0, _storeLocal(i));
  for (let i = 0; i <= 3; ++i) op(0x4B + i, 'astore_' + i, 0, _storeLocal(i));
  op(0x4F, 'iastore', 0, () => ({ pseudo: 'v=pop(); i=pop(); pop()[i]=v' }));
  op(0x50, 'lastore', 0, () => ({ pseudo: 'v=pop(); i=pop(); pop()[i]=v' }));
  op(0x51, 'fastore', 0, () => ({ pseudo: 'v=pop(); i=pop(); pop()[i]=v' }));
  op(0x52, 'dastore', 0, () => ({ pseudo: 'v=pop(); i=pop(); pop()[i]=v' }));
  op(0x53, 'aastore', 0, () => ({ pseudo: 'v=pop(); i=pop(); pop()[i]=v' }));
  op(0x54, 'bastore', 0, () => ({ pseudo: 'v=pop(); i=pop(); pop()[i]=v' }));
  op(0x55, 'castore', 0, () => ({ pseudo: 'v=pop(); i=pop(); pop()[i]=v' }));
  op(0x56, 'sastore', 0, () => ({ pseudo: 'v=pop(); i=pop(); pop()[i]=v' }));

  // --- Stack ---
  op(0x57, 'pop', 0, () => ({ pseudo: 'pop()' }));
  op(0x58, 'pop2', 0, () => ({ pseudo: 'pop(); pop()' }));
  op(0x59, 'dup', 0, () => ({ pseudo: 'a=pop(); push(a); push(a)' }));
  op(0x5A, 'dup_x1', 0, () => ({ pseudo: 'a=pop(); b=pop(); push(a); push(b); push(a)' }));
  op(0x5B, 'dup_x2', 0, () => ({ pseudo: 'a=pop(); b=pop(); c=pop(); push(a); push(c); push(b); push(a)' }));
  op(0x5C, 'dup2', 0, () => ({ pseudo: 'a=pop(); b=pop(); push(b); push(a); push(b); push(a)' }));
  op(0x5D, 'dup2_x1', 0, () => ({ pseudo: 'dup2_x1' }));
  op(0x5E, 'dup2_x2', 0, () => ({ pseudo: 'dup2_x2' }));
  op(0x5F, 'swap', 0, () => ({ pseudo: 'a=pop(); b=pop(); push(a); push(b)' }));

  // --- Math ---
  op(0x60, 'iadd', 0, _binop(' + ', true));
  op(0x61, 'ladd', 0, _binop(' + ', true));
  op(0x62, 'fadd', 0, _binop(' + ', true));
  op(0x63, 'dadd', 0, _binop(' + ', true));
  op(0x64, 'isub', 0, _binop(' - ', false));
  op(0x65, 'lsub', 0, _binop(' - ', false));
  op(0x66, 'fsub', 0, _binop(' - ', false));
  op(0x67, 'dsub', 0, _binop(' - ', false));
  op(0x68, 'imul', 0, _binop(' * ', true));
  op(0x69, 'lmul', 0, _binop(' * ', true));
  op(0x6A, 'fmul', 0, _binop(' * ', true));
  op(0x6B, 'dmul', 0, _binop(' * ', true));
  op(0x6C, 'idiv', 0, _binop(' / ', false));
  op(0x6D, 'ldiv', 0, _binop(' / ', false));
  op(0x6E, 'fdiv', 0, _binop(' / ', false));
  op(0x6F, 'ddiv', 0, _binop(' / ', false));
  op(0x70, 'irem', 0, _binop(' % ', false));
  op(0x71, 'lrem', 0, _binop(' % ', false));
  op(0x72, 'frem', 0, _binop(' % ', false));
  op(0x73, 'drem', 0, _binop(' % ', false));
  op(0x74, 'ineg', 0, _unop('-'));
  op(0x75, 'lneg', 0, _unop('-'));
  op(0x76, 'fneg', 0, _unop('-'));
  op(0x77, 'dneg', 0, _unop('-'));
  op(0x78, 'ishl', 0, _binop(' << ', false));
  op(0x79, 'lshl', 0, _binop(' << ', false));
  op(0x7A, 'ishr', 0, _binop(' >> ', false));
  op(0x7B, 'lshr', 0, _binop(' >> ', false));
  op(0x7C, 'iushr', 0, _binop(' >>> ', false));
  op(0x7D, 'lushr', 0, _binop(' >>> ', false));
  op(0x7E, 'iand', 0, _binop(' & ', true));
  op(0x7F, 'land', 0, _binop(' & ', true));
  op(0x80, 'ior', 0, _binop(' | ', true));
  op(0x81, 'lor', 0, _binop(' | ', true));
  op(0x82, 'ixor', 0, _binop(' ^ ', true));
  op(0x83, 'lxor', 0, _binop(' ^ ', true));
  op(0x84, 'iinc', 2, (ops) => ({ pseudo: 'local[' + ops[0] + '] += ' + ((ops[1] << 24) >> 24), operands: ops[0] + ', ' + ((ops[1] << 24) >> 24) }));

  // --- Conversions ---
  op(0x85, 'i2l', 0, _conv('int', 'long'));
  op(0x86, 'i2f', 0, _conv('int', 'float'));
  op(0x87, 'i2d', 0, _conv('int', 'double'));
  op(0x88, 'l2i', 0, _conv('long', 'int'));
  op(0x89, 'l2f', 0, _conv('long', 'float'));
  op(0x8A, 'l2d', 0, _conv('long', 'double'));
  op(0x8B, 'f2i', 0, _conv('float', 'int'));
  op(0x8C, 'f2l', 0, _conv('float', 'long'));
  op(0x8D, 'f2d', 0, _conv('float', 'double'));
  op(0x8E, 'd2i', 0, _conv('double', 'int'));
  op(0x8F, 'd2l', 0, _conv('double', 'long'));
  op(0x90, 'd2f', 0, _conv('double', 'float'));
  op(0x91, 'i2b', 0, _conv('int', 'byte'));
  op(0x92, 'i2c', 0, _conv('int', 'char'));
  op(0x93, 'i2s', 0, _conv('int', 'short'));

  // --- Comparison ---
  op(0x94, 'lcmp', 0, () => ({ pseudo: 'a=pop(); push(pop() <=> a)' }));
  op(0x95, 'fcmpl', 0, () => ({ pseudo: 'a=pop(); push(pop() <=> a)' }));
  op(0x96, 'fcmpg', 0, () => ({ pseudo: 'a=pop(); push(pop() <=> a)' }));
  op(0x97, 'dcmpl', 0, () => ({ pseudo: 'a=pop(); push(pop() <=> a)' }));
  op(0x98, 'dcmpg', 0, () => ({ pseudo: 'a=pop(); push(pop() <=> a)' }));

  // --- Control: conditional branches ---
  op(0x99, 'ifeq', 2, _branch('pop()==0'));
  op(0x9A, 'ifne', 2, _branch('pop()!=0'));
  op(0x9B, 'iflt', 2, _branch('pop()<0'));
  op(0x9C, 'ifge', 2, _branch('pop()>=0'));
  op(0x9D, 'ifgt', 2, _branch('pop()>0'));
  op(0x9E, 'ifle', 2, _branch('pop()<=0'));
  op(0x9F, 'if_icmpeq', 2, _branch('pop()==pop()'));
  op(0xA0, 'if_icmpne', 2, _branch('pop()!=pop()'));
  op(0xA1, 'if_icmplt', 2, _branch('pop()>pop()'));
  op(0xA2, 'if_icmpge', 2, _branch('pop()<=pop()'));
  op(0xA3, 'if_icmpgt', 2, _branch('pop()<pop()'));
  op(0xA4, 'if_icmple', 2, _branch('pop()>=pop()'));
  op(0xA5, 'if_acmpeq', 2, _branch('pop()==pop()'));
  op(0xA6, 'if_acmpne', 2, _branch('pop()!=pop()'));

  // --- Control: unconditional ---
  op(0xA7, 'goto', 2, (ops, off) => ({ pseudo: 'goto ' + hex(off + s16(ops[0], ops[1])), operands: hex(off + s16(ops[0], ops[1])) }));
  op(0xA8, 'jsr', 2, (ops, off) => ({ pseudo: 'jsr ' + hex(off + s16(ops[0], ops[1])), operands: hex(off + s16(ops[0], ops[1])) }));
  op(0xA9, 'ret', 1, (ops) => ({ pseudo: 'ret local[' + ops[0] + ']', operands: String(ops[0]) }));

  // --- Returns ---
  op(0xAC, 'ireturn', 0, _ret(true));
  op(0xAD, 'lreturn', 0, _ret(true));
  op(0xAE, 'freturn', 0, _ret(true));
  op(0xAF, 'dreturn', 0, _ret(true));
  op(0xB0, 'areturn', 0, _ret(true));
  op(0xB1, 'return', 0, _ret(false));

  // --- References (CP-resolving) ---
  op(0xB2, 'getstatic', 2, _cpOp('push(static ', ')'), true);
  op(0xB3, 'putstatic', 2, _cpOp('static ', ' = pop()'), true);
  op(0xB4, 'getfield', 2, _cpOp('push(obj.', ')'), true);
  op(0xB5, 'putfield', 2, _cpOp('v=pop(); pop().', ' = v'), true);
  op(0xB6, 'invokevirtual', 2, _cpOp('invoke ', ''), true);
  op(0xB7, 'invokespecial', 2, _cpOp('invokespecial ', ''), true);
  op(0xB8, 'invokestatic', 2, _cpOp('call ', ''), true);
  op(0xB9, 'invokeinterface', 4, (ops, off, cp, bytes) => {
    const idx = u16(ops[0], ops[1]);
    if (cp && bytes) {
      const r = resolveCp(cp, bytes, idx);
      return { pseudo: 'invokeinterface ' + r.text + ' count=' + ops[2], operands: r.text + ', ' + ops[2], tokens: [...r.tokens, { type: 'op', value: ', ' }, { type: 'num', value: String(ops[2]) }] };
    }
    return { pseudo: 'invokeinterface #' + idx + ' count=' + ops[2], operands: '#' + idx + ', ' + ops[2] };
  }, true);
  op(0xBA, 'invokedynamic', 4, (ops, off, cp, bytes) => {
    const idx = u16(ops[0], ops[1]);
    if (cp && bytes) {
      const r = resolveCp(cp, bytes, idx);
      return { pseudo: 'invokedynamic ' + r.text, operands: r.text, tokens: r.tokens };
    }
    return { pseudo: 'invokedynamic #' + idx, operands: '#' + idx };
  }, true);
  op(0xBB, 'new', 2, _cpOp('push(new ', ')'), true);
  op(0xBC, 'newarray', 1, (ops) => {
    const t = NEWARRAY_TYPES[ops[0]] || 'type' + ops[0];
    return { pseudo: 'push(new ' + t + '[pop()])', operands: t, tokens: [{ type: 'kw', value: t }] };
  });
  op(0xBD, 'anewarray', 2, _cpOp('push(new ', '[pop()])'), true);
  op(0xBE, 'arraylength', 0, () => ({ pseudo: 'push(pop().length)' }));
  op(0xBF, 'athrow', 0, () => ({ pseudo: 'throw pop()' }));
  op(0xC0, 'checkcast', 2, _cpOp('checkcast ', ''), true);
  op(0xC1, 'instanceof', 2, _cpOp('push(pop() instanceof ', ')'), true);
  op(0xC2, 'monitorenter', 0, () => ({ pseudo: 'monitorenter(pop())' }));
  op(0xC3, 'monitorexit', 0, () => ({ pseudo: 'monitorexit(pop())' }));

  // --- Extended ---
  op(0xC5, 'multianewarray', 3, (ops, off, cp, bytes) => {
    const idx = u16(ops[0], ops[1]);
    if (cp && bytes) {
      const r = resolveCp(cp, bytes, idx);
      return { pseudo: 'push(new ' + r.text + '[' + ops[2] + ' dims])', operands: r.text + ', ' + ops[2], tokens: [...r.tokens, { type: 'op', value: ', ' }, { type: 'num', value: String(ops[2]) }] };
    }
    return { pseudo: 'push(new #' + idx + '[' + ops[2] + ' dims])', operands: '#' + idx + ', ' + ops[2] };
  }, true);
  op(0xC6, 'ifnull', 2, _branch('pop()==null'));
  op(0xC7, 'ifnonnull', 2, _branch('pop()!=null'));
  op(0xC8, 'goto_w', 4, (ops, off) => ({ pseudo: 'goto ' + hex(off + s32(ops[0], ops[1], ops[2], ops[3])), operands: hex(off + s32(ops[0], ops[1], ops[2], ops[3])) }));
  op(0xC9, 'jsr_w', 4, (ops, off) => ({ pseudo: 'jsr ' + hex(off + s32(ops[0], ops[1], ops[2], ops[3])), operands: hex(off + s32(ops[0], ops[1], ops[2], ops[3])) }));

  op(0xFE, 'impdep1', 0, () => ({ pseudo: 'impdep1' }));
  op(0xFF, 'impdep2', 0, () => ({ pseudo: 'impdep2' }));

  // =========================================================================
  // Main decode function
  // =========================================================================
  function decode(bytes, offset, maxCount, opts) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const baseOffset = offset || 0;
    const limit = maxCount || 50;
    const end = view.length;
    const result = [];
    let pos = baseOffset;

    // Constant pool from options
    const cp = (opts && opts.constantPool) || null;

    while (result.length < limit && pos < end) {
      const instrOffset = pos;
      const opByte = view[pos++];

      // --- tableswitch (variable length) ---
      if (opByte === 0xAA) {
        const padded = (4 - (pos % 4)) % 4;
        pos += padded;
        if (pos + 12 > end) { pushDb(result, view, instrOffset, pos - instrOffset); break; }
        const defaultOff = s32(view[pos], view[pos + 1], view[pos + 2], view[pos + 3]); pos += 4;
        const low = s32(view[pos], view[pos + 1], view[pos + 2], view[pos + 3]); pos += 4;
        const high = s32(view[pos], view[pos + 1], view[pos + 2], view[pos + 3]); pos += 4;
        const count = high - low + 1;
        if (count < 0 || count > 65536 || pos + count * 4 > end) { pushDb(result, view, instrOffset, pos - instrOffset); break; }
        const offsets = [];
        for (let i = 0; i < count; ++i) {
          offsets.push(s32(view[pos], view[pos + 1], view[pos + 2], view[pos + 3]));
          pos += 4;
        }
        const length = pos - instrOffset;
        const bytesSlice = Array.from(view.subarray(instrOffset, pos));
        const targets = offsets.map((o, i) => (low + i) + ':' + hex(instrOffset + o)).join(', ');
        result.push({
          offset: instrOffset, length, bytes: bytesSlice,
          mnemonic: 'tableswitch',
          operands: low + ' to ' + high + ' default:' + hex(instrOffset + defaultOff),
          pseudoC: 'switch(pop()) {' + targets + ', default:' + hex(instrOffset + defaultOff) + '}',
        });
        continue;
      }

      // --- lookupswitch (variable length) ---
      if (opByte === 0xAB) {
        const padded = (4 - (pos % 4)) % 4;
        pos += padded;
        if (pos + 8 > end) { pushDb(result, view, instrOffset, pos - instrOffset); break; }
        const defaultOff = s32(view[pos], view[pos + 1], view[pos + 2], view[pos + 3]); pos += 4;
        const npairs = s32(view[pos], view[pos + 1], view[pos + 2], view[pos + 3]); pos += 4;
        if (npairs < 0 || npairs > 65536 || pos + npairs * 8 > end) { pushDb(result, view, instrOffset, pos - instrOffset); break; }
        const pairs = [];
        for (let i = 0; i < npairs; ++i) {
          const match = s32(view[pos], view[pos + 1], view[pos + 2], view[pos + 3]); pos += 4;
          const target = s32(view[pos], view[pos + 1], view[pos + 2], view[pos + 3]); pos += 4;
          pairs.push({ match, target });
        }
        const length = pos - instrOffset;
        const bytesSlice = Array.from(view.subarray(instrOffset, pos));
        const pairStr = pairs.map(p => p.match + ':' + hex(instrOffset + p.target)).join(', ');
        result.push({
          offset: instrOffset, length, bytes: bytesSlice,
          mnemonic: 'lookupswitch',
          operands: npairs + ' pairs default:' + hex(instrOffset + defaultOff),
          pseudoC: 'switch(pop()) {' + pairStr + ', default:' + hex(instrOffset + defaultOff) + '}',
        });
        continue;
      }

      // --- wide prefix (variable length) ---
      if (opByte === 0xC4) {
        if (pos >= end) { pushDb(result, view, instrOffset, 1); break; }
        const widened = view[pos++];
        if (widened === 0x84) {
          if (pos + 4 > end) { pushDb(result, view, instrOffset, pos - instrOffset); break; }
          const idx = u16(view[pos], view[pos + 1]); pos += 2;
          const inc = s16(view[pos], view[pos + 1]); pos += 2;
          result.push({
            offset: instrOffset, length: pos - instrOffset,
            bytes: Array.from(view.subarray(instrOffset, pos)),
            mnemonic: 'wide iinc', operands: idx + ', ' + inc,
            pseudoC: 'local[' + idx + '] += ' + inc,
          });
        } else {
          if (pos + 2 > end) { pushDb(result, view, instrOffset, pos - instrOffset); break; }
          const idx = u16(view[pos], view[pos + 1]); pos += 2;
          const base = opcodes[widened];
          const mn = base ? 'wide ' + base.mnemonic : 'wide 0x' + widened.toString(16);
          const isStore = widened >= 0x36 && widened <= 0x3A;
          const pC = isStore ? 'local[' + idx + '] = pop()' : widened === 0xA9 ? 'ret local[' + idx + ']' : 'push(local[' + idx + '])';
          result.push({
            offset: instrOffset, length: pos - instrOffset,
            bytes: Array.from(view.subarray(instrOffset, pos)),
            mnemonic: mn, operands: String(idx), pseudoC: pC,
          });
        }
        continue;
      }

      // --- Standard fixed-length opcodes ---
      const entry = opcodes[opByte];
      if (!entry) {
        result.push({
          offset: instrOffset, length: 1, bytes: [opByte],
          mnemonic: 'db', operands: '0x' + opByte.toString(16).toUpperCase().padStart(2, '0'),
          pseudoC: '??',
        });
        continue;
      }

      const operandCount = entry.operandBytes;
      if (pos + operandCount > end) {
        pushDb(result, view, instrOffset, end - instrOffset);
        break;
      }

      const operandBytes = [];
      for (let i = 0; i < operandCount; ++i)
        operandBytes.push(view[pos++]);

      const length = pos - instrOffset;
      const bytesSlice = Array.from(view.subarray(instrOffset, pos));

      let pseudoC = '??';
      let operands = '';
      let tokens = null;
      try {
        const h = entry.handler(operandBytes, instrOffset, cp, view);
        pseudoC = h.pseudo || '??';
        operands = h.operands || operandBytes.map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
        if (h.tokens) tokens = h.tokens;
      } catch (_) {}

      const insn = { offset: instrOffset, length, bytes: bytesSlice, mnemonic: entry.mnemonic, operands, pseudoC };
      if (tokens) insn.tokens = tokens;
      result.push(insn);
    }

    return result;
  }

  function pushDb(result, view, offset, length) {
    const actual = Math.min(length, view.length - offset);
    if (actual <= 0) return;
    result.push({
      offset, length: actual,
      bytes: Array.from(view.subarray(offset, offset + actual)),
      mnemonic: 'db',
      operands: Array.from(view.subarray(offset, offset + actual)).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' '),
      pseudoC: '??',
    });
  }

  // =========================================================================
  // Register
  // =========================================================================
  D.registerDisassembler('java', decode);

  // =========================================================================
  // Java Decompiler Formatters (Java, Kotlin)
  // =========================================================================

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function _jvmToJavaLow(insn) {
    const mn = (insn.mnemonic || '').toLowerCase();
    const ops = insn.operands || '';
    const pc = insn.pseudoC || '';

    if (mn === 'aload_0') return 'this';
    if (mn.startsWith('aload')) return 'push ref' + (ops || '');
    if (mn.startsWith('iload') || mn.startsWith('lload') || mn.startsWith('fload') || mn.startsWith('dload'))
      return 'push local' + (ops || '');
    if (mn.startsWith('istore') || mn.startsWith('lstore') || mn.startsWith('fstore') || mn.startsWith('dstore') || mn.startsWith('astore'))
      return 'var v' + (ops || '') + ' = pop();';
    if (mn === 'invokevirtual' || mn === 'invokeinterface')
      return 'obj.' + (ops || 'method') + '();';
    if (mn === 'invokestatic')
      return (ops || 'Class.method') + '();';
    if (mn === 'invokespecial')
      return 'super.' + (ops || 'method') + '();';
    if (mn === 'new') return 'new ' + (ops || 'Object') + '()';
    if (mn === 'return' || mn === 'ireturn' || mn === 'lreturn' || mn === 'freturn' || mn === 'dreturn' || mn === 'areturn')
      return 'return;';
    if (mn === 'iadd' || mn === 'ladd' || mn === 'fadd' || mn === 'dadd') return 'push(pop() + pop());';
    if (mn === 'isub' || mn === 'lsub' || mn === 'fsub' || mn === 'dsub') return 'push(pop() - pop());';
    if (mn === 'imul' || mn === 'lmul' || mn === 'fmul' || mn === 'dmul') return 'push(pop() * pop());';
    if (mn === 'idiv' || mn === 'ldiv' || mn === 'fdiv' || mn === 'ddiv') return 'push(pop() / pop());';
    if (mn === 'irem' || mn === 'lrem' || mn === 'frem' || mn === 'drem') return 'push(pop() % pop());';
    if (mn === 'ineg' || mn === 'lneg' || mn === 'fneg' || mn === 'dneg') return 'push(-pop());';
    if (mn === 'iand' || mn === 'land') return 'push(pop() & pop());';
    if (mn === 'ior' || mn === 'lor') return 'push(pop() | pop());';
    if (mn === 'ixor' || mn === 'lxor') return 'push(pop() ^ pop());';
    if (mn === 'ishl' || mn === 'lshl') return 'push(pop() << pop());';
    if (mn === 'ishr' || mn === 'lshr') return 'push(pop() >> pop());';
    if (mn === 'iushr' || mn === 'lushr') return 'push(pop() >>> pop());';
    if (mn.startsWith('if_icmp') || mn.startsWith('if_acmp') || mn.startsWith('if'))
      return pc || 'if (...) goto ' + ops + ';';
    if (mn === 'goto' || mn === 'goto_w') return 'goto ' + ops + ';';
    if (mn === 'athrow') return 'throw pop();';
    if (mn === 'nop') return '// nop';
    if (mn === 'pop' || mn === 'pop2') return '_ = pop();';
    if (mn === 'dup' || mn === 'dup2') return 'push(peek());';
    if (mn === 'ldc' || mn === 'ldc_w' || mn === 'ldc2_w')
      return 'push(' + ops + ');';
    if (mn.startsWith('iconst') || mn.startsWith('lconst') || mn.startsWith('fconst') || mn.startsWith('dconst'))
      return 'push(' + ops + ');';
    if (mn === 'bipush' || mn === 'sipush') return 'push(' + ops + ');';
    if (mn === 'aconst_null') return 'push(null);';
    if (mn === 'getfield') return 'push(obj.' + (ops || 'field') + ');';
    if (mn === 'putfield') return 'obj.' + (ops || 'field') + ' = pop();';
    if (mn === 'getstatic') return 'push(' + (ops || 'Class.field') + ');';
    if (mn === 'putstatic') return (ops || 'Class.field') + ' = pop();';
    if (mn === 'arraylength') return 'push(pop().length);';
    if (mn === 'newarray' || mn === 'anewarray') return 'push(new ' + (ops || 'Object') + '[pop()]);';
    if (mn.includes('aload')) return 'push(arr[idx]);';
    if (mn.includes('astore')) return 'arr[idx] = pop();';
    if (mn === 'instanceof') return 'push(pop() instanceof ' + ops + ');';
    if (mn === 'checkcast') return 'push((' + ops + ')pop());';
    if (mn === 'i2l' || mn === 'i2f' || mn === 'i2d' || mn === 'l2i' || mn === 'l2f' || mn === 'l2d' ||
        mn === 'f2i' || mn === 'f2l' || mn === 'f2d' || mn === 'd2i' || mn === 'd2l' || mn === 'd2f' ||
        mn === 'i2b' || mn === 'i2c' || mn === 'i2s')
      return 'push((' + mn.charAt(2) + ')pop());';
    return pc || mn + ' ' + ops;
  }

  function _jvmToKotlin(insn) {
    const j = _jvmToJavaLow(insn);
    return j
      .replace(/^var (v\d+) = (.+);$/, 'val $1 = $2')
      .replace(/^return;$/, 'return')
      .replace(/\bnew (\w+)\(\)/, '$1()')
      .replace(/\bnull\b/g, 'null')
      .replace(/\binstanceof\b/g, 'is')
      .replace(/\bvoid\b/g, 'Unit')
      .replace(/\/\/ nop/, '// nop');
  }

  function _formatDecompiledJava(instructions, _annotations, formatter) {
    const lines = [];
    for (const insn of instructions) {
      const off = '<span class="da-off">' + esc(insn.offset.toString(16).padStart(8, '0').toUpperCase()) + '</span>';
      const code = formatter(insn);
      lines.push(
        '<span class="da-line" data-offset="' + insn.offset.toString(16) + '">'
        + off
        + '<span class="da-sep"> | </span>'
        + '<span class="da-cmt">' + esc(code) + '</span>'
        + '</span>'
      );
    }
    return lines.join('\n');
  }

  if (D.registerDecompileFormatter) {
    D.registerDecompileFormatter('java-low', (insns, annot) => _formatDecompiledJava(insns, annot, _jvmToJavaLow));
    D.registerDecompileFormatter('java', (insns, annot) => _formatDecompiledJava(insns, annot, _jvmToJavaLow));
    D.registerDecompileFormatter('kotlin', (insns, annot) => _formatDecompiledJava(insns, annot, _jvmToKotlin));
  }

})();
