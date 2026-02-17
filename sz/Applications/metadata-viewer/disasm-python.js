;(function() {
  'use strict';
  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // Python 3.6-3.12 Bytecode Disassembler (2-byte wordcode)
  // =========================================================================

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function hex(n) { return '0x' + (n >>> 0).toString(16).toUpperCase(); }

  function safeName(arr, idx) {
    if (arr && idx >= 0 && idx < arr.length) {
      const v = arr[idx];
      return v != null ? String(v) : '?';
    }
    return '#' + idx;
  }

  function reprConst(arr, idx) {
    if (!arr || idx < 0 || idx >= arr.length)
      return '#' + idx;
    const v = arr[idx];
    if (v === null || v === undefined)
      return 'None';
    if (typeof v === 'string')
      return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    if (typeof v === 'boolean')
      return v ? 'True' : 'False';
    return String(v);
  }

  // -------------------------------------------------------------------------
  // COMPARE_OP values
  // -------------------------------------------------------------------------

  const CMP_OPS = ['<', '<=', '==', '!=', '>', '>='];

  // -------------------------------------------------------------------------
  // Opcode table
  //
  // Each entry: { name, hasArg, handler(arg, offset, opts) }
  //   handler returns { operands, pseudoC, tokens? }
  //   hasArg: false = arg byte ignored (opcode < 90)
  // -------------------------------------------------------------------------

  const OPCODES = Object.create(null);

  function def(code, name, handler) {
    OPCODES[code] = { name, hasArg: code >= 90, handler: handler || null };
  }

  // --- Stack manipulation ---
  def(1, 'POP_TOP', () => ({ operands: '', pseudoC: 'TOS = pop()' }));
  def(2, 'ROT_TWO', () => ({ operands: '', pseudoC: 'a=TOS; TOS=TOS1; TOS1=a' }));
  def(3, 'ROT_THREE', () => ({ operands: '', pseudoC: 'a=TOS; TOS=TOS1; TOS1=TOS2; TOS2=a' }));
  def(4, 'DUP_TOP', () => ({ operands: '', pseudoC: 'push(TOS)' }));
  def(5, 'DUP_TOP_TWO', () => ({ operands: '', pseudoC: 'push(TOS1, TOS)' }));

  // --- Misc ---
  def(9, 'NOP', () => ({ operands: '', pseudoC: '/* nop */' }));

  // --- Unary ops ---
  def(10, 'UNARY_POSITIVE', () => ({ operands: '', pseudoC: 'TOS = +TOS' }));
  def(11, 'UNARY_NEGATIVE', () => ({ operands: '', pseudoC: 'TOS = -TOS' }));
  def(12, 'UNARY_NOT', () => ({ operands: '', pseudoC: 'TOS = not TOS' }));
  def(15, 'UNARY_INVERT', () => ({ operands: '', pseudoC: 'TOS = ~TOS' }));

  // --- Binary ops ---
  def(19, 'BINARY_POWER', () => ({ operands: '', pseudoC: 'x = pop() ** pop()' }));
  def(20, 'BINARY_MULTIPLY', () => ({ operands: '', pseudoC: 'x = pop() * pop()' }));
  def(22, 'BINARY_MODULO', () => ({ operands: '', pseudoC: 'x = a % b' }));
  def(23, 'BINARY_ADD', () => ({ operands: '', pseudoC: 'x = a + b' }));
  def(24, 'BINARY_SUBTRACT', () => ({ operands: '', pseudoC: 'x = a - b' }));
  def(25, 'BINARY_SUBSCR', () => ({ operands: '', pseudoC: 'x = TOS1[TOS]' }));
  def(26, 'BINARY_FLOOR_DIVIDE', () => ({ operands: '', pseudoC: 'x = a // b' }));
  def(27, 'BINARY_TRUE_DIVIDE', () => ({ operands: '', pseudoC: 'x = a / b' }));

  // --- Inplace ops ---
  def(28, 'INPLACE_FLOOR_DIVIDE', () => ({ operands: '', pseudoC: 'TOS1 //= TOS' }));
  def(29, 'INPLACE_TRUE_DIVIDE', () => ({ operands: '', pseudoC: 'TOS1 /= TOS' }));
  def(55, 'INPLACE_ADD', () => ({ operands: '', pseudoC: 'TOS1 += TOS' }));
  def(56, 'INPLACE_SUBTRACT', () => ({ operands: '', pseudoC: 'TOS1 -= TOS' }));
  def(57, 'INPLACE_MULTIPLY', () => ({ operands: '', pseudoC: 'TOS1 *= TOS' }));
  def(59, 'INPLACE_MODULO', () => ({ operands: '', pseudoC: 'TOS1 %= TOS' }));
  def(67, 'INPLACE_POWER', () => ({ operands: '', pseudoC: 'TOS1 **= TOS' }));
  def(75, 'INPLACE_LSHIFT', () => ({ operands: '', pseudoC: 'TOS1 <<= TOS' }));
  def(76, 'INPLACE_RSHIFT', () => ({ operands: '', pseudoC: 'TOS1 >>= TOS' }));
  def(77, 'INPLACE_AND', () => ({ operands: '', pseudoC: 'TOS1 &= TOS' }));
  def(78, 'INPLACE_XOR', () => ({ operands: '', pseudoC: 'TOS1 ^= TOS' }));
  def(79, 'INPLACE_OR', () => ({ operands: '', pseudoC: 'TOS1 |= TOS' }));

  // --- Subscript store/delete ---
  def(60, 'STORE_SUBSCR', () => ({ operands: '', pseudoC: 'TOS1[TOS] = TOS2' }));
  def(61, 'DELETE_SUBSCR', () => ({ operands: '', pseudoC: 'del TOS1[TOS]' }));

  // --- Binary bitwise/shift ---
  def(62, 'BINARY_LSHIFT', () => ({ operands: '', pseudoC: 'x = a << b' }));
  def(63, 'BINARY_RSHIFT', () => ({ operands: '', pseudoC: 'x = a >> b' }));
  def(64, 'BINARY_AND', () => ({ operands: '', pseudoC: 'x = a & b' }));
  def(65, 'BINARY_XOR', () => ({ operands: '', pseudoC: 'x = a ^ b' }));
  def(66, 'BINARY_OR', () => ({ operands: '', pseudoC: 'x = a | b' }));

  // --- Async/coroutine ---
  def(50, 'GET_AITER', () => ({ operands: '', pseudoC: 'TOS = aiter(TOS)' }));
  def(51, 'GET_ANEXT', () => ({ operands: '', pseudoC: 'push(anext(TOS))' }));
  def(52, 'BEFORE_ASYNC_WITH', () => ({ operands: '', pseudoC: '/* before async with */' }));

  // --- Iterator ---
  def(68, 'GET_ITER', () => ({ operands: '', pseudoC: 'TOS = iter(TOS)' }));
  def(69, 'GET_YIELD_FROM_ITER', () => ({ operands: '', pseudoC: 'TOS = yield_from_iter(TOS)' }));

  // --- Print/misc ---
  def(70, 'PRINT_EXPR', () => ({ operands: '', pseudoC: 'print(pop())' }));
  def(71, 'LOAD_BUILD_CLASS', () => ({ operands: '', pseudoC: 'push(__build_class__)' }));
  def(72, 'YIELD_FROM', () => ({ operands: '', pseudoC: 'x = yield from TOS' }));

  // --- Return/yield/block ---
  def(83, 'RETURN_VALUE', () => ({ operands: '', pseudoC: 'return TOS' }));
  def(85, 'SETUP_ANNOTATIONS', () => ({ operands: '', pseudoC: '/* setup annotations */' }));
  def(86, 'YIELD_VALUE', () => ({ operands: '', pseudoC: 'yield TOS' }));
  def(87, 'POP_BLOCK', () => ({ operands: '', pseudoC: '/* pop block */' }));
  def(89, 'POP_EXCEPT', () => ({ operands: '', pseudoC: '/* pop except */' }));

  // =========================================================================
  // Opcodes with arg (>= 90)
  // =========================================================================

  // --- Name operations ---
  def(90, 'STORE_NAME', (arg, off, opts) => {
    const n = safeName(opts.names, arg);
    return { operands: n, pseudoC: n + ' = TOS' };
  });
  def(91, 'DELETE_NAME', (arg, off, opts) => {
    const n = safeName(opts.names, arg);
    return { operands: n, pseudoC: 'del ' + n };
  });
  def(92, 'UNPACK_SEQUENCE', (arg) => ({
    operands: String(arg), pseudoC: 'unpack ' + arg + ' values from TOS'
  }));
  def(93, 'FOR_ITER', (arg, off) => {
    const target = off + 2 + arg;
    return { operands: 'to ' + hex(target), pseudoC: 'TOS = next(iter) or goto ' + hex(target) };
  });
  def(94, 'UNPACK_EX', (arg) => ({
    operands: String(arg), pseudoC: 'unpack with star (' + (arg & 0xFF) + ' before, ' + (arg >> 8) + ' after)'
  }));
  def(95, 'STORE_ATTR', (arg, off, opts) => {
    const n = safeName(opts.names, arg);
    return { operands: n, pseudoC: 'TOS.'+n+' = TOS1' };
  });
  def(97, 'STORE_GLOBAL', (arg, off, opts) => {
    const n = safeName(opts.names, arg);
    return { operands: n, pseudoC: 'global ' + n + ' = TOS' };
  });
  def(98, 'DELETE_GLOBAL', (arg, off, opts) => {
    const n = safeName(opts.names, arg);
    return { operands: n, pseudoC: 'del global ' + n };
  });
  def(100, 'LOAD_CONST', (arg, off, opts) => {
    const c = reprConst(opts.consts, arg);
    return { operands: c, pseudoC: 'push(' + c + ')' };
  });
  def(101, 'LOAD_NAME', (arg, off, opts) => {
    const n = safeName(opts.names, arg);
    return { operands: n, pseudoC: 'push(' + n + ')' };
  });
  def(102, 'BUILD_TUPLE', (arg) => ({
    operands: String(arg), pseudoC: 'push(tuple(pop() x ' + arg + '))'
  }));
  def(103, 'BUILD_LIST', (arg) => ({
    operands: String(arg), pseudoC: 'push(list(pop() x ' + arg + '))'
  }));
  def(104, 'BUILD_SET', (arg) => ({
    operands: String(arg), pseudoC: 'push(set(pop() x ' + arg + '))'
  }));
  def(105, 'BUILD_MAP', (arg) => ({
    operands: String(arg), pseudoC: 'push(dict(' + arg + ' pairs))'
  }));
  def(106, 'LOAD_ATTR', (arg, off, opts) => {
    const n = safeName(opts.names, arg);
    return { operands: n, pseudoC: 'TOS = TOS.' + n };
  });
  def(107, 'COMPARE_OP', (arg) => {
    const op = CMP_OPS[arg] || '?cmp' + arg;
    return { operands: op, pseudoC: 'push(TOS1 ' + op + ' TOS)' };
  });
  def(108, 'IMPORT_NAME', (arg, off, opts) => {
    const n = safeName(opts.names, arg);
    return { operands: n, pseudoC: 'push(import(' + n + '))' };
  });
  def(109, 'IMPORT_FROM', (arg, off, opts) => {
    const n = safeName(opts.names, arg);
    return { operands: n, pseudoC: 'push(from TOS import ' + n + ')' };
  });

  // --- Jumps ---
  def(110, 'JUMP_FORWARD', (arg, off) => {
    const target = off + 2 + arg;
    return { operands: 'to ' + hex(target), pseudoC: 'goto ' + hex(target) };
  });
  def(111, 'JUMP_IF_FALSE_OR_POP', (arg) => ({
    operands: 'to ' + hex(arg), pseudoC: 'if not TOS goto ' + hex(arg) + ' else pop()'
  }));
  def(112, 'JUMP_IF_TRUE_OR_POP', (arg) => ({
    operands: 'to ' + hex(arg), pseudoC: 'if TOS goto ' + hex(arg) + ' else pop()'
  }));
  def(113, 'JUMP_ABSOLUTE', (arg) => ({
    operands: 'to ' + hex(arg), pseudoC: 'goto ' + hex(arg)
  }));
  def(114, 'POP_JUMP_IF_FALSE', (arg) => ({
    operands: 'to ' + hex(arg), pseudoC: 'if not pop() goto ' + hex(arg)
  }));
  def(115, 'POP_JUMP_IF_TRUE', (arg) => ({
    operands: 'to ' + hex(arg), pseudoC: 'if pop() goto ' + hex(arg)
  }));

  // --- Globals / locals ---
  def(116, 'LOAD_GLOBAL', (arg, off, opts) => {
    const n = safeName(opts.names, arg);
    return { operands: n, pseudoC: 'push(global ' + n + ')' };
  });
  def(119, 'SETUP_FINALLY', (arg, off) => {
    const target = off + 2 + arg;
    return { operands: 'to ' + hex(target), pseudoC: 'setup finally -> ' + hex(target) };
  });
  def(122, 'LOAD_FAST', (arg, off, opts) => {
    const n = safeName(opts.varnames, arg);
    return { operands: n, pseudoC: 'push(' + n + ')' };
  });
  def(124, 'STORE_FAST', (arg, off, opts) => {
    const n = safeName(opts.varnames, arg);
    return { operands: n, pseudoC: n + ' = pop()' };
  });
  def(125, 'DELETE_FAST', (arg, off, opts) => {
    const n = safeName(opts.varnames, arg);
    return { operands: n, pseudoC: 'del ' + n };
  });

  // --- Call / function ---
  def(130, 'RAISE_VARARGS', (arg) => ({
    operands: String(arg), pseudoC: 'raise(' + arg + ' args)'
  }));
  def(131, 'CALL_FUNCTION', (arg) => ({
    operands: String(arg), pseudoC: 'call func(' + arg + ' args)'
  }));
  def(132, 'MAKE_FUNCTION', (arg) => {
    const flags = [];
    if (arg & 0x01) flags.push('defaults');
    if (arg & 0x02) flags.push('kwdefaults');
    if (arg & 0x04) flags.push('annotations');
    if (arg & 0x08) flags.push('closure');
    return { operands: String(arg), pseudoC: 'make_function(' + (flags.join(', ') || 'none') + ')' };
  });
  def(133, 'BUILD_SLICE', (arg) => ({
    operands: String(arg), pseudoC: 'push(slice(' + arg + ' args))'
  }));

  // --- Closure / deref ---
  def(135, 'LOAD_CLOSURE', (arg) => ({
    operands: String(arg), pseudoC: 'push(closure[' + arg + '])'
  }));
  def(136, 'LOAD_DEREF', (arg) => ({
    operands: String(arg), pseudoC: 'push(deref[' + arg + '])'
  }));
  def(137, 'STORE_DEREF', (arg) => ({
    operands: String(arg), pseudoC: 'deref[' + arg + '] = pop()'
  }));
  def(138, 'DELETE_DEREF', (arg) => ({
    operands: String(arg), pseudoC: 'del deref[' + arg + ']'
  }));

  // --- Call variants ---
  def(141, 'CALL_FUNCTION_KW', (arg) => ({
    operands: String(arg), pseudoC: 'call func(' + arg + ' args, kw)'
  }));
  def(142, 'CALL_FUNCTION_EX', (arg) => ({
    operands: String(arg), pseudoC: 'call func(*args' + (arg & 1 ? ', **kwargs' : '') + ')'
  }));

  // --- With / extended ---
  def(143, 'SETUP_WITH', (arg, off) => {
    const target = off + 2 + arg;
    return { operands: 'to ' + hex(target), pseudoC: 'setup with -> ' + hex(target) };
  });
  def(144, 'EXTENDED_ARG', (arg) => ({
    operands: String(arg), pseudoC: '/* extended arg prefix ' + arg + ' */'
  }));

  // --- Collection appends ---
  def(145, 'LIST_APPEND', (arg) => ({
    operands: String(arg), pseudoC: 'list[' + arg + '].append(pop())'
  }));
  def(146, 'SET_ADD', (arg) => ({
    operands: String(arg), pseudoC: 'set[' + arg + '].add(pop())'
  }));
  def(147, 'MAP_ADD', (arg) => ({
    operands: String(arg), pseudoC: 'map[' + arg + '][key] = val'
  }));
  def(148, 'LOAD_CLASSDEREF', (arg) => ({
    operands: String(arg), pseudoC: 'push(classderef[' + arg + '])'
  }));

  // --- Async ---
  def(154, 'SETUP_ASYNC_WITH', (arg, off) => {
    const target = off + 2 + arg;
    return { operands: 'to ' + hex(target), pseudoC: 'setup async with -> ' + hex(target) };
  });

  // --- Formatting / building ---
  def(155, 'FORMAT_VALUE', (arg) => {
    const which = arg & 0x03;
    const hasFormat = (arg & 0x04) !== 0;
    const conv = ['', 'str', 'repr', 'ascii'][which];
    return { operands: String(arg), pseudoC: 'format(' + (conv || 'none') + (hasFormat ? ', fmt' : '') + ')' };
  });
  def(156, 'BUILD_CONST_KEY_MAP', (arg) => ({
    operands: String(arg), pseudoC: 'push(dict_from_keys(' + arg + '))'
  }));
  def(157, 'BUILD_STRING', (arg) => ({
    operands: String(arg), pseudoC: 'push(concat_str(' + arg + '))'
  }));

  // --- Method calls (3.7+) ---
  def(160, 'LOAD_METHOD', (arg, off, opts) => {
    const n = safeName(opts.names, arg);
    return { operands: n, pseudoC: 'push(TOS.' + n + ')' };
  });
  def(161, 'CALL_METHOD', (arg) => ({
    operands: String(arg), pseudoC: 'call method(' + arg + ' args)'
  }));

  // --- Collection extend (3.9+) ---
  def(162, 'LIST_EXTEND', (arg) => ({
    operands: String(arg), pseudoC: 'list[' + arg + '].extend(pop())'
  }));
  def(163, 'SET_UPDATE', (arg) => ({
    operands: String(arg), pseudoC: 'set[' + arg + '].update(pop())'
  }));
  def(164, 'DICT_MERGE', (arg) => ({
    operands: String(arg), pseudoC: 'dict[' + arg + '].merge(pop())'
  }));
  def(165, 'DICT_UPDATE', (arg) => ({
    operands: String(arg), pseudoC: 'dict[' + arg + '].update(pop())'
  }));

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

    const names = (opts && opts.names) || [];
    const consts = (opts && opts.consts) || [];
    const varnames = (opts && opts.varnames) || [];
    const resolveOpts = { names, consts, varnames };

    let extendedArg = 0;

    while (result.length < limit && pos + 1 < end) {
      const instrOffset = pos;
      const opcode = view[pos];
      const rawArg = view[pos + 1];
      pos += 2;

      const entry = OPCODES[opcode];
      if (!entry) {
        result.push({
          offset: instrOffset, length: 2,
          bytes: view.slice(instrOffset, instrOffset + 2),
          mnemonic: 'db', operands: hex(opcode) + ' ' + hex(rawArg),
          pseudoC: '/* unknown opcode */',
        });
        extendedArg = 0;
        continue;
      }

      // Handle EXTENDED_ARG accumulation
      let arg = rawArg;
      if (opcode === 144) {
        extendedArg = (extendedArg | rawArg) << 8;
        result.push({
          offset: instrOffset, length: 2,
          bytes: view.slice(instrOffset, instrOffset + 2),
          mnemonic: 'EXTENDED_ARG', operands: String(rawArg),
          pseudoC: '/* extended arg prefix ' + rawArg + ' */',
        });
        continue;
      }

      if (entry.hasArg)
        arg = extendedArg | rawArg;

      extendedArg = 0;

      let operands = '';
      let pseudoC = '';
      if (entry.handler) {
        const h = entry.handler(arg, instrOffset, resolveOpts);
        operands = h.operands || '';
        pseudoC = h.pseudoC || '';
      }

      result.push({
        offset: instrOffset,
        length: 2,
        bytes: view.slice(instrOffset, instrOffset + 2),
        mnemonic: entry.name,
        operands,
        pseudoC,
      });
    }

    return result;
  }

  // =========================================================================
  // Register
  // =========================================================================

  D.registerDisassembler('python', decode);

})();
