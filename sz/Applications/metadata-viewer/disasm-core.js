;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});

  // =========================================================================
  // Disassembler Framework — registration, dispatch, formatting
  // =========================================================================

  const DISASM_MAP = Object.create(null); // archId -> disasmFn

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  function registerDisassembler(archId, disasmFn) {
    if (typeof archId !== 'string' || !archId)
      throw new Error('registerDisassembler: archId must be a non-empty string');
    if (typeof disasmFn !== 'function')
      throw new Error('registerDisassembler: disasmFn must be a function');
    DISASM_MAP[archId.toLowerCase()] = disasmFn;
  }

  // -------------------------------------------------------------------------
  // Main entry point
  // -------------------------------------------------------------------------

  /**
   * Disassemble a region of bytes.
   *
   * @param {string} archId   Architecture identifier (x86|x64|arm|arm64|java|msil|ppc|dalvik|6502|65c816|z80|m68k|python|vbpcode|dart).
   * @param {Uint8Array} bytes Raw code bytes.
   * @param {number} [offset=0]     Start offset within bytes.
   * @param {number} [count=256]    Max number of instructions to decode.
   * @param {object} [options={}]   Architecture-specific options forwarded to the decoder.
   * @returns {Array<{offset:number, length:number, bytes:Uint8Array, mnemonic:string, operands:string, pseudoC:string, tokens?:Array}>}
   */
  function disassemble(archId, bytes, offset, count, options) {
    const key = (archId || '').toLowerCase();
    const decoder = DISASM_MAP[key];
    if (!decoder)
      return [makeUnknownArch(key, bytes, offset != null ? offset : 0)];

    const start = offset != null ? offset : 0;
    const max = count != null ? count : 256;
    const opts = options || {};

    // Decoders may return an array of instructions (batch mode) or a single
    // instruction per call (streaming mode). Detect by calling with full args.
    const result = decoder(bytes, start, max, opts);

    // Batch mode: decoder returned an array of instruction objects
    if (Array.isArray(result))
      return result.slice(0, max);

    // Streaming mode: decoder returns one instruction at a time
    const instructions = [];
    let pos = start;
    for (let i = 0; i < max && pos < bytes.length; ++i) {
      const insn = decoder(bytes, pos, opts);
      if (!insn || insn.length <= 0) {
        instructions.push(makeInvalid(bytes, pos));
        ++pos;
        continue;
      }

      instructions.push({
        offset: pos,
        length: insn.length,
        bytes: bytes.slice(pos, pos + insn.length),
        mnemonic: insn.mnemonic || '??',
        operands: insn.operands || '',
        pseudoC: insn.pseudoC || '',
        tokens: insn.tokens || null,
      });
      pos += insn.length;
    }

    return instructions;
  }

  // -------------------------------------------------------------------------
  // Helpers — fallback instruction records
  // -------------------------------------------------------------------------

  function makeUnknownArch(archId, bytes, offset) {
    return {
      offset,
      length: 0,
      bytes: new Uint8Array(0),
      mnemonic: '.error',
      operands: 'unknown architecture: ' + archId,
      pseudoC: '/* no decoder registered */',
    };
  }

  function makeInvalid(bytes, offset) {
    const b = offset < bytes.length ? bytes[offset] : 0;
    return {
      offset,
      length: 1,
      bytes: bytes.slice(offset, offset + 1),
      mnemonic: 'db',
      operands: '0x' + b.toString(16).padStart(2, '0'),
      pseudoC: '/* invalid */',
    };
  }

  // -------------------------------------------------------------------------
  // Plain-text Formatting
  // -------------------------------------------------------------------------

  function formatDisassembly(instructions) {
    if (!instructions || !instructions.length)
      return '';

    const offsetWidth = Math.max(8, ...instructions.map(i => i.offset.toString(16).length));
    const hexStrings = instructions.map(i => formatHexBytes(i.bytes));
    const hexWidth = Math.max(1, ...hexStrings.map(h => h.length));
    const mnemonicStrings = instructions.map(i =>
      i.operands ? i.mnemonic + ' ' + i.operands : i.mnemonic
    );
    const mnWidth = Math.max(1, ...mnemonicStrings.map(s => s.length));

    const lines = [];
    for (let idx = 0; idx < instructions.length; ++idx) {
      const insn = instructions[idx];
      const off = insn.offset.toString(16).padStart(offsetWidth, '0').toUpperCase();
      const hex = hexStrings[idx].padEnd(hexWidth);
      const mn = mnemonicStrings[idx].padEnd(mnWidth);
      const pseudo = insn.pseudoC ? '// ' + insn.pseudoC : '';
      lines.push(off + ' | ' + hex + ' | ' + mn + (pseudo ? ' | ' + pseudo : ''));
    }

    return lines.join('\n');
  }

  function formatHexBytes(bytes) {
    if (!bytes || !bytes.length)
      return '';
    const parts = [];
    for (let i = 0; i < bytes.length; ++i)
      parts.push(bytes[i].toString(16).padStart(2, '0').toUpperCase());
    return parts.join(' ');
  }

  // -------------------------------------------------------------------------
  // HTML Formatting — syntax-highlighted output
  // -------------------------------------------------------------------------

  // Known registers for highlighting (covers x86/x64, ARM, general)
  const REGISTERS = new Set([
    // x86 8-bit
    'al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh',
    'spl', 'bpl', 'sil', 'dil',
    'r8b', 'r9b', 'r10b', 'r11b', 'r12b', 'r13b', 'r14b', 'r15b',
    // x86 16-bit
    'ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di',
    'r8w', 'r9w', 'r10w', 'r11w', 'r12w', 'r13w', 'r14w', 'r15w',
    'cs', 'ds', 'es', 'fs', 'gs', 'ss',
    // x86 32-bit
    'eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi',
    'r8d', 'r9d', 'r10d', 'r11d', 'r12d', 'r13d', 'r14d', 'r15d',
    'eip',
    // x86 64-bit
    'rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi',
    'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15',
    'rip',
    // x87 FPU
    'st0', 'st1', 'st2', 'st3', 'st4', 'st5', 'st6', 'st7',
    // SSE
    'xmm0', 'xmm1', 'xmm2', 'xmm3', 'xmm4', 'xmm5', 'xmm6', 'xmm7',
    'xmm8', 'xmm9', 'xmm10', 'xmm11', 'xmm12', 'xmm13', 'xmm14', 'xmm15',
    // ARM 32-bit
    'r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7',
    'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15',
    'lr', 'pc', 'cpsr',
    // ARM 64-bit
    'x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7',
    'x8', 'x9', 'x10', 'x11', 'x12', 'x13', 'x14', 'x15',
    'x16', 'x17', 'x18', 'x19', 'x20', 'x21', 'x22', 'x23',
    'x24', 'x25', 'x26', 'x27', 'x28', 'x29', 'x30',
    'w0', 'w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7',
    'w8', 'w9', 'w10', 'w11', 'w12', 'w13', 'w14', 'w15',
    'w16', 'w17', 'w18', 'w19', 'w20', 'w21', 'w22', 'w23',
    'w24', 'w25', 'w26', 'w27', 'w28', 'w29', 'w30',
    'sp', 'xzr', 'wzr',
    // PowerPC
    'cr0', 'cr1', 'cr2', 'cr3', 'cr4', 'cr5', 'cr6', 'cr7',
    // 6502 / 65C816
    'a', 'x', 'y', 's', 'p',
    // Z80
    'b', 'c', 'd', 'e', 'f', 'h', 'l', 'i', 'r',
    'bc', 'de', 'hl', 'af', 'ix', 'iy',
    "af'", "bc'", "de'", "hl'",
    'ixh', 'ixl', 'iyh', 'iyl',
    // Motorola 68000
    'd0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7',
    'a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7',
    'sr', 'ccr', 'usp',
    // Dalvik
    'v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7',
    'v8', 'v9', 'v10', 'v11', 'v12', 'v13', 'v14', 'v15',
  ]);

  // Data type keywords in memory operands
  const KEYWORDS = new Set([
    'byte', 'word', 'dword', 'qword', 'ptr', 'near', 'far', 'short',
    'tbyte', 'xword', 'xmmword', 'ymmword',
    'int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64',
    'float32', 'float64', 'nint', 'nuint', 'ref',
    'boolean', 'char', 'float', 'double', 'long', 'int', 'short',
  ]);

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function span(cls, text) {
    return '<span class="da-' + cls + '">' + esc(text) + '</span>';
  }

  /**
   * Tokenize an operands string into highlighted HTML.
   * Handles registers, numbers/hex, labels (IL_xxxx, 0xADDR targets),
   * symbols (pre-resolved names from decoders), brackets, punctuation.
   */
  function tokenizeOperands(operandsStr) {
    if (!operandsStr) return '';

    // Pattern matches (order matters — longest/most specific first):
    //   1. Quoted strings: "..."
    //   2. Hex numbers: 0x[0-9A-Fa-f]+
    //   3. IL labels: IL_[0-9A-Fa-f]+
    //   4. Decimal numbers (incl negative): -?\d+
    //   5. Identifiers (registers, keywords, or symbols): [A-Za-z_.$][A-Za-z0-9_.$]*
    //   6. Memory brackets: [ ]
    //   7. Operators/punctuation: + - * , : ( ) { } = < > !
    //   8. Whitespace
    //   9. Anything else
    const TOKEN_RE = /("(?:[^"\\]|\\.)*")|(\b0[xX][0-9A-Fa-f]+\b)|(IL_[0-9A-Fa-f]+)|(-?\b\d+\b)|([A-Za-z_.$][A-Za-z0-9_./;$<>[\]]*)|([[\]])|([+\-*,:(){}=<>!&|^~#%@])|(\s+)|(.)/g;

    let html = '';
    let m;
    while ((m = TOKEN_RE.exec(operandsStr)) !== null) {
      if (m[1]) // quoted string
        html += span('str', m[1]);
      else if (m[2]) // hex number
        html += span('num', m[2]);
      else if (m[3]) // IL label
        html += span('lbl', m[3]);
      else if (m[4]) // decimal number
        html += span('num', m[4]);
      else if (m[5]) { // identifier
        const word = m[5];
        const lower = word.toLowerCase();
        if (REGISTERS.has(lower))
          html += span('reg', word);
        else if (KEYWORDS.has(lower))
          html += span('kw', word);
        else if (word.includes('.') || word.includes('/') || word.includes('$') || word.includes(';'))
          html += span('sym', word); // qualified name — class/method/field
        else
          html += span('id', word);
      }
      else if (m[6]) // bracket
        html += span('br', m[6]);
      else if (m[7]) // operator/punctuation
        html += span('op', m[7]);
      else if (m[8]) // whitespace
        html += m[8];
      else // anything else
        html += esc(m[9]);
    }
    return html;
  }

  /**
   * Render pre-tokenized operand tokens from a decoder.
   * Each token: { type: 'reg'|'num'|'sym'|'kw'|'str'|'lbl'|'op'|'br'|'id'|'text', value: string }
   */
  function renderTokens(tokens) {
    let html = '';
    for (const tok of tokens) {
      if (tok.type === 'text' || !tok.type)
        html += esc(tok.value);
      else
        html += span(tok.type, tok.value);
    }
    return html;
  }

  /**
   * Format an array of instruction objects into syntax-highlighted HTML.
   *
   * @param {Array} instructions Array from disassemble().
   * @returns {string} HTML string (to be set as innerHTML on a container).
   */
  function formatDisassemblyHtml(instructions) {
    if (!instructions || !instructions.length)
      return '';

    const lines = [];
    for (let idx = 0; idx < instructions.length; ++idx) {
      const insn = instructions[idx];
      const off = span('off', insn.offset.toString(16).padStart(8, '0').toUpperCase());
      const hex = span('hex', formatHexBytes(insn.bytes));

      // Mnemonic — classify for coloring
      const mn = insn.mnemonic || '??';
      const mnCls = classifyMnemonic(mn);
      const mnHtml = span(mnCls, mn);

      // Operands — use pre-tokenized if available, else auto-tokenize
      let opsHtml = '';
      if (insn.tokens && Array.isArray(insn.tokens))
        opsHtml = renderTokens(insn.tokens);
      else if (insn.operands)
        opsHtml = tokenizeOperands(insn.operands);

      // Pseudo-C comment
      let pseudoHtml = '';
      if (insn.pseudoC)
        pseudoHtml = span('cmt', '// ' + insn.pseudoC);

      const instrHtml = mnHtml + (opsHtml ? ' ' + opsHtml : '');

      lines.push(
        '<span class="da-line">'
        + off
        + '<span class="da-sep"> | </span>'
        + hex
        + '<span class="da-sep"> | </span>'
        + instrHtml
        + (pseudoHtml ? '<span class="da-sep"> | </span>' + pseudoHtml : '')
        + '</span>'
      );
    }

    return lines.join('\n');
  }

  /**
   * Classify a mnemonic into a semantic category for coloring.
   */
  function classifyMnemonic(mn) {
    const lower = mn.toLowerCase().replace(/\..+$/, ''); // strip suffixes like .s, .un
    // Flow control
    if (/^(j[a-z]*|b[a-z]*|call|calli?|ret|return|ireturn|areturn|lreturn|freturn|dreturn|goto|jsr|jmp|leave|throw|athrow|rethrow|endfinally|switch|tableswitch|lookupswitch|blr|bl)$/.test(lower))
      return 'mn-flow';
    // 6502/65C816 flow
    if (/^(jmp|jsr|jml|jsl|rts|rti|rtl|brk|cop|bcc|bcs|beq|bne|bmi|bpl|bvc|bvs|bra|brl)$/.test(lower))
      return 'mn-flow';
    // Z80 flow
    if (/^(jp|jr|call|ret[in]?|rst|djnz|halt)$/.test(lower))
      return 'mn-flow';
    // 68000 flow
    if (/^(jmp|jsr|rts|rte|rtr|trap[v]?|link|unlk|stop|reset)$/.test(lower))
      return 'mn-flow';
    // 68000 branch/set/decrement-branch
    if (/^(bra|bsr|beq|bne|bhi|bls|bcc|bcs|bmi|bpl|bvc|bvs|bge|blt|bgt|ble|dbeq|dbne|dbhi|dbls|dbcc|dbcs|dbmi|dbpl|dbvc|dbvs|dbge|dblt|dbgt|dble|dbt|dbf|seq|sne|shi|sls|scc|scs|smi|spl|svc|svs|sge|slt|sgt|sle|st|sf)$/.test(lower))
      return 'mn-flow';
    // Dalvik flow
    if (/^(if-[a-z]+|goto|goto\/16|goto\/32|return|return-void|return-wide|return-object|throw|packed-switch|sparse-switch)$/.test(lower))
      return 'mn-flow';
    // Python flow
    if (/^(jump_forward|jump_absolute|jump_if_false_or_pop|jump_if_true_or_pop|pop_jump_if_false|pop_jump_if_true|for_iter|setup_finally|setup_with|setup_async_with|return_value|raise_varargs|yield_value|yield_from)$/.test(lower))
      return 'mn-flow';
    // VB P-code flow
    if (/^(branch[ftb]?|exit)$/.test(lower))
      return 'mn-flow';
    // Stack/data movement
    if (/^(push|pop|mov|ld[a-z]*|st[a-z]*|xchg|lea|dup|swap|nop|break)$/.test(lower))
      return 'mn-data';
    // 6502 data
    if (/^(lda|ldx|ldy|sta|stx|sty|stz|tax|tay|txa|tya|tsx|txs|pha|pla|php|plp|phx|phy|plx|ply|phd|pld|phb|plb|phk|tcd|tdc|tcs|tsc|xba|xce|mvn|mvp|nop|wdm|stp|wai)$/.test(lower))
      return 'mn-data';
    // Z80 data
    if (/^(ld|push|pop|ex|exx|nop|ldi|ldir|ldd|lddr)$/.test(lower))
      return 'mn-data';
    // 68000 data
    if (/^(move[amqp]?|lea|pea|clr|ext|swap|movem|exg|nbcd|tas)$/.test(lower))
      return 'mn-data';
    // Dalvik data
    if (/^(move|move\/from16|move\/16|move-wide|move-object|move-result|move-exception|const|const\/4|const\/16|const\/high16|const-wide|const-string|const-class|nop|fill-array-data)$/.test(lower))
      return 'mn-data';
    // Python data
    if (/^(load_const|load_name|load_fast|load_global|load_attr|load_method|load_deref|load_closure|load_classderef|load_build_class|store_name|store_fast|store_global|store_attr|store_deref|store_subscr|delete_name|delete_fast|delete_global|delete_subscr|pop_top|rot_two|rot_three|dup_top|dup_top_two|nop)$/.test(lower))
      return 'mn-data';
    // VB P-code data
    if (/^(lit[a-z0-9_]*|fld[a-z]*|fst[a-z]*|litstr|litnothing)$/.test(lower))
      return 'mn-data';
    // Arithmetic/logic
    if (/^(add|sub|mul|div|rem|inc|dec|neg|not|and|or|xor|shl|shr|sar|rol|ror|imul|idiv|cmp|test|ceq|cgt|clt|i?add|i?sub|i?mul|i?div|i?rem|i?neg|i?and|i?or|i?xor|i?shl|i?shr|i?ushr|lcmp|[fd]cmp[lg]|conv|i2[a-z]|[a-z]2[a-z]|iadd|isub|imul|idiv|irem|ineg|ishl|ishr|iushr|iand|ior|ixor|ladd|lsub|lmul|ldiv|lrem|lneg|lshl|lshr|lushr|land|lor|lxor|fadd|fsub|fmul|fdiv|frem|fneg|dadd|dsub|dmul|ddiv|drem|dneg|iinc)$/.test(lower))
      return 'mn-alu';
    // 6502 ALU
    if (/^(adc|sbc|and|ora|eor|asl|lsr|rol|ror|inc|dec|inx|dex|iny|dey|cmp|cpx|cpy|bit|clc|sec|cli|sei|clv|cld|sed|trb|tsb|rep|sep)$/.test(lower))
      return 'mn-alu';
    // Z80 ALU
    if (/^(add|adc|sub|sbc|and|or|xor|cp|inc|dec|daa|cpl|neg|ccf|scf|rlca|rrca|rla|rra|rlc|rrc|rl|rr|sla|sra|srl|sll|bit|set|res|rld|rrd|cpi|cpir|cpd|cpdr)$/.test(lower))
      return 'mn-alu';
    // Z80 I/O as access
    if (/^(in|out|ini|inir|ind|indr|outi|otir|outd|otdr|im|di|ei)$/.test(lower))
      return 'mn-access';
    // 68000 ALU
    if (/^(add[aqxi]?|sub[aqxi]?|mulu|muls|divu|divs|and[i]?|or[i]?|eor[i]?|not|neg[x]?|cmp[aim]?|tst|asl|asr|lsl|lsr|rol|ror|roxl|roxr|btst|bset|bclr|bchg|abcd|sbcd|addx|subx|cmpm)$/.test(lower))
      return 'mn-alu';
    // Dalvik ALU
    if (/^(add-|sub-|mul-|div-|rem-|and-|or-|xor-|shl-|shr-|ushr-|neg-|not-|rsub-|int-to-|long-to-|float-to-|double-to-|cmpl-|cmpg-|cmp-)/.test(lower))
      return 'mn-alu';
    // Python ALU
    if (/^(binary_power|binary_multiply|binary_modulo|binary_add|binary_subtract|binary_subscr|binary_floor_divide|binary_true_divide|binary_lshift|binary_rshift|binary_and|binary_xor|binary_or|inplace_[a-z_]+|unary_positive|unary_negative|unary_not|unary_invert|compare_op)$/.test(lower))
      return 'mn-alu';
    // VB P-code ALU
    if (/^(add[a-z0-9]*|sub[a-z0-9]*|mul[a-z0-9]*|div[a-z0-9]*|mod[a-z0-9]*|neg[a-z0-9]*|not[a-z0-9]*|and[a-z0-9]*|or[a-z0-9]*|xor[a-z0-9]*|eq[a-z0-9]*|ne[a-z0-9]*|lt[a-z0-9]*|gt[a-z0-9]*|le[a-z0-9]*|ge[a-z0-9]*|concatstr|booli2)$/.test(lower))
      return 'mn-alu';
    // Object/type operations
    if (/^(new|newobj|newarr|newarray|anewarray|multianewarray|checkcast|instanceof|isinst|castclass|box|unbox|initobj|sizeof|arraylength|ldelema|ldelem|stelem|ldlen|monitorenter|monitorexit|cpobj|ldobj|stobj|mkrefany|refanyval|refanytype|ldtoken|ldftn|ldvirtftn)$/.test(lower))
      return 'mn-obj';
    // Dalvik object
    if (/^(new-instance|new-array|filled-new-array|check-cast|instance-of|array-length|monitor-enter|monitor-exit)$/.test(lower))
      return 'mn-obj';
    // Python object
    if (/^(call_function|call_function_kw|call_function_ex|call_method|build_tuple|build_list|build_set|build_map|build_string|build_const_key_map|build_slice|make_function|import_name|import_from|list_append|set_add|map_add|list_extend|set_update|dict_merge|dict_update|unpack_sequence|unpack_ex|format_value|get_iter|get_aiter|get_anext)$/.test(lower))
      return 'mn-obj';
    // Field/method access
    if (/^(get|put|invoke|callvirt|getstatic|putstatic|getfield|putfield|invokevirtual|invokespecial|invokestatic|invokeinterface|invokedynamic|ldfld|ldflda|stfld|ldsfld|ldsflda|stsfld)$/.test(lower))
      return 'mn-access';
    // Dalvik access
    if (/^(iget|iput|sget|sput|aget|aput|invoke-virtual|invoke-super|invoke-direct|invoke-static|invoke-interface|invoke-virtual\/range|invoke-super\/range|invoke-direct\/range|invoke-static\/range|invoke-interface\/range)/.test(lower))
      return 'mn-access';
    // VB P-code access
    if (/^(vcall[a-z]*|cvarref)$/.test(lower))
      return 'mn-access';
    // Dart structural
    if (/^(library|class|method)$/.test(lower))
      return 'mn-obj';
    // Invalid/data
    if (/^(db|\.error|\.info|impdep|\?\?\?)/.test(lower))
      return 'mn-err';
    return 'mn';
  }

  // =========================================================================
  // Export
  // =========================================================================

  SZ.Disassembler = {
    registerDisassembler,
    disassemble,
    formatDisassembly,
    formatDisassemblyHtml,
    tokenizeOperands,
    DISASM_MAP,
  };

})();
