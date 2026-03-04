;(function() {
  'use strict';

  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // Register tables
  // =========================================================================

  const REG8  = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
  const REG8_REX = ['al', 'cl', 'dl', 'bl', 'spl', 'bpl', 'sil', 'dil',
                    'r8b', 'r9b', 'r10b', 'r11b', 'r12b', 'r13b', 'r14b', 'r15b'];
  const REG16 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di',
                 'r8w', 'r9w', 'r10w', 'r11w', 'r12w', 'r13w', 'r14w', 'r15w'];
  const REG32 = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi',
                 'r8d', 'r9d', 'r10d', 'r11d', 'r12d', 'r13d', 'r14d', 'r15d'];
  const REG64 = ['rax', 'rcx', 'rdx', 'rbx', 'rsp', 'rbp', 'rsi', 'rdi',
                 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15'];

  const CC_NAMES = [
    'o', 'no', 'b', 'nb', 'z', 'nz', 'be', 'a',
    's', 'ns', 'p', 'np', 'l', 'ge', 'le', 'g',
  ];

  const CC_PSEUDO = [
    'overflow', '!overflow', 'below', '!below', 'zero', '!zero', 'belowOrEqual', 'above',
    'sign', '!sign', 'parity', '!parity', 'less', 'greaterOrEqual', 'lessOrEqual', 'greater',
  ];

  // ALU operations sharing the same /r encoding in 0x80-0x83 groups
  const ALU_NAMES = ['add', 'or', 'adc', 'sbb', 'and', 'sub', 'xor', 'cmp'];
  const ALU_PSEUDO_OP = ['+=', '|=', '+=/*carry*/', '-=/*borrow*/', '&=', '-=', '^=', null];

  const SHIFT_NAMES = ['rol', 'ror', 'rcl', 'rcr', 'shl', 'shr', 'sal', 'sar'];

  // =========================================================================
  // Helpers
  // =========================================================================

  function hex8(v)  { return '0x' + (v & 0xFF).toString(16).toUpperCase().padStart(2, '0'); }
  function hex16(v) { return '0x' + (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'); }
  function hex32(v) { return '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0'); }
  function hex64(hi, lo) {
    return '0x' + (hi >>> 0).toString(16).toUpperCase().padStart(8, '0') +
           (lo >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  function hexAddr(v, is64) {
    if (is64) return hex32(v); // in practice we only have 32-bit offsets in our byte window
    return hex32(v);
  }

  function signedByte(v)  { return (v & 0xFF) > 0x7F ? (v & 0xFF) - 256 : (v & 0xFF); }
  function signedWord(v)  { return (v & 0xFFFF) > 0x7FFF ? (v & 0xFFFF) - 65536 : (v & 0xFFFF); }
  function signedDword(v) { return v | 0; }

  function readU8(bytes, o)  { return o < bytes.length ? bytes[o] : 0; }
  function readU16(bytes, o) { return o + 1 < bytes.length ? (bytes[o] | (bytes[o + 1] << 8)) : 0; }
  function readU32(bytes, o) { return o + 3 < bytes.length ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0 : 0; }

  function fmtDisp(disp) {
    if (disp === 0) return '';
    if (disp > 0) return ' + ' + hex8OrMore(disp);
    return ' - ' + hex8OrMore(-disp);
  }

  function hex8OrMore(v) {
    if (v >= 0 && v <= 0xFF) return hex8(v);
    if (v >= 0 && v <= 0xFFFF) return hex16(v);
    return hex32(v);
  }

  function fmtImm(v, size) {
    if (size === 1) return hex8(v);
    if (size === 2) return hex16(v);
    return hex32(v);
  }

  // =========================================================================
  // ModR/M + SIB decoder
  // =========================================================================

  /**
   * Decodes ModR/M (and SIB if needed) at bytes[pos].
   * Returns { reg, rm, mod, regIdx, rmIdx, text, dispSize, totalBytes }
   *
   * @param {Uint8Array} bytes
   * @param {number} pos - position of ModR/M byte
   * @param {boolean} is64 - true for x64 mode
   * @param {number} operandSize - 1,2,4,8
   * @param {number} addrSize - 4 or 8
   * @param {boolean} rexR - REX.R bit (extends reg field)
   * @param {boolean} rexX - REX.X bit (extends SIB index)
   * @param {boolean} rexB - REX.B bit (extends rm / SIB base)
   * @param {boolean} hasRex - any REX prefix present
   */
  function decodeModRM(bytes, pos, is64, operandSize, addrSize, rexR, rexX, rexB, hasRex) {
    const modrm = readU8(bytes, pos);
    const mod = (modrm >> 6) & 3;
    const regBits = ((modrm >> 3) & 7) | (rexR ? 8 : 0);
    const rmBits  = (modrm & 7) | (rexB ? 8 : 0);

    const regTable = operandSize === 1 ? (hasRex ? REG8_REX : REG8)
      : operandSize === 2 ? REG16
      : operandSize === 8 ? REG64
      : REG32;

    const addrTable = addrSize === 8 ? REG64 : REG32;

    const regName = regTable[regBits] || ('r' + regBits);

    let consumed = 1; // ModR/M byte
    let rmText;
    let rmIdx = rmBits;

    if (mod === 3) {
      // register-direct
      const rmRegTable = operandSize === 1 ? (hasRex ? REG8_REX : REG8)
        : operandSize === 2 ? REG16
        : operandSize === 8 ? REG64
        : REG32;
      rmText = rmRegTable[rmBits] || ('r' + rmBits);
    } else {
      // memory operand
      const rmBase = (modrm & 7); // without REX extension for SIB check
      const needsSIB = rmBase === 4 && addrSize !== 2;
      let dispSize = 0;
      let baseStr;

      if (needsSIB) {
        const sib = readU8(bytes, pos + 1);
        ++consumed;
        const scale = 1 << ((sib >> 6) & 3);
        const indexBits = ((sib >> 3) & 7) | (rexX ? 8 : 0);
        const baseBits = (sib & 7) | (rexB ? 8 : 0);

        let baseReg = addrTable[baseBits] || ('r' + baseBits);
        const indexReg = addrTable[indexBits] || ('r' + indexBits);
        const hasIndex = (indexBits & 7) !== 4; // RSP/ESP can't be index

        if ((baseBits & 7) === 5 && mod === 0) {
          // disp32 without base
          dispSize = 4;
          if (hasIndex)
            baseStr = indexReg + (scale > 1 ? '*' + scale : '');
          else
            baseStr = '';
        } else {
          dispSize = mod === 1 ? 1 : mod === 2 ? 4 : 0;
          if (hasIndex)
            baseStr = baseReg + ' + ' + indexReg + (scale > 1 ? '*' + scale : '');
          else
            baseStr = baseReg;
        }
      } else if (mod === 0 && rmBase === 5) {
        // RIP-relative (x64) or disp32 (x86)
        dispSize = 4;
        baseStr = is64 ? 'rip' : '';
      } else {
        dispSize = mod === 1 ? 1 : mod === 2 ? 4 : 0;
        const effRm = (modrm & 7) | (rexB ? 8 : 0);
        baseStr = addrTable[effRm] || ('r' + effRm);
      }

      let disp = 0;
      if (dispSize === 1) {
        disp = signedByte(readU8(bytes, pos + consumed));
        consumed += 1;
      } else if (dispSize === 4) {
        disp = signedDword(readU32(bytes, pos + consumed));
        consumed += 4;
      } else if (dispSize === 2) {
        disp = signedWord(readU16(bytes, pos + consumed));
        consumed += 2;
      }

      const sizeHint = operandSize === 1 ? 'byte' : operandSize === 2 ? 'word' : operandSize === 8 ? 'qword' : 'dword';

      if (baseStr === '' && disp !== 0)
        rmText = sizeHint + ' [' + hex32(disp >>> 0) + ']';
      else if (baseStr !== '' && disp !== 0)
        rmText = sizeHint + ' [' + baseStr + fmtDisp(disp) + ']';
      else
        rmText = sizeHint + ' [' + (baseStr || '0') + ']';
    }

    return { reg: regName, regIdx: regBits, rm: rmText, rmIdx, mod, consumed };
  }

  // =========================================================================
  // Pseudo-C helpers
  // =========================================================================

  function pseudoMov(dst, src) { return dst + ' = ' + src; }
  function pseudoMovMem(dst, memExpr) { return dst + ' = *(' + memExpr + ')'; }
  function pseudoStoreMem(memExpr, src) { return '*(' + memExpr + ') = ' + src; }
  function pseudoAlu(op, dst, src) {
    if (op === '+=') return dst + ' += ' + src;
    if (op === '-=') return dst + ' -= ' + src;
    if (op === '&=') return dst + ' &= ' + src;
    if (op === '|=') return dst + ' |= ' + src;
    if (op === '^=') return dst + ' ^= ' + src;
    return dst + ' ' + op + ' ' + src;
  }

  function stripSizeHint(rm) { return rm.replace(/^(?:byte|word|dword|qword)\s+/, ''); }

  function memExprFromBracket(rm) {
    const stripped = stripSizeHint(rm);
    const m = stripped.match(/^\[(.+)\]$/);
    return m ? m[1] : stripped;
  }

  // =========================================================================
  // Main decoder
  // =========================================================================

  function decodeX86(bytes, offset, count, is64Mode) {
    const results = [];
    const maxCount = count || 50;
    let pos = offset || 0;
    const end = bytes.length;

    while (results.length < maxCount && pos < end) {
      const startPos = pos;
      let mnemonic = '';
      let operands = '';
      let pseudoC = '';

      // ---- Prefix parsing ----
      let hasRex = false;
      let rexW = false, rexR = false, rexX = false, rexB = false;
      let prefixSeg = '';
      let hasOperandSizeOverride = false;
      let hasAddressSizeOverride = false;
      let repPrefix = 0; // 0xF2 or 0xF3 if present
      let hasLock = false;

      for (;;) {
        if (pos >= end) break;
        const b = bytes[pos];

        // Segment overrides
        if (b === 0x26 || b === 0x2E || b === 0x36 || b === 0x3E || b === 0x64 || b === 0x65) {
          const segNames = { 0x26: 'es', 0x2E: 'cs', 0x36: 'ss', 0x3E: 'ds', 0x64: 'fs', 0x65: 'gs' };
          prefixSeg = segNames[b];
          ++pos;
          continue;
        }
        // Operand-size override
        if (b === 0x66) { hasOperandSizeOverride = true; ++pos; continue; }
        // Address-size override
        if (b === 0x67) { hasAddressSizeOverride = true; ++pos; continue; }
        // REP / REPNE
        if (b === 0xF2 || b === 0xF3) { repPrefix = b; ++pos; continue; }
        // LOCK
        if (b === 0xF0) { hasLock = true; ++pos; continue; }
        // REX prefix (x64 only, 0x40-0x4F)
        if (is64Mode && b >= 0x40 && b <= 0x4F) {
          hasRex = true;
          rexW = !!(b & 0x08);
          rexR = !!(b & 0x04);
          rexX = !!(b & 0x02);
          rexB = !!(b & 0x01);
          ++pos;
          continue;
        }
        break;
      }

      if (pos >= end) {
        // Ran out of bytes during prefix parsing — emit what we have as db
        for (let i = startPos; i < end; ++i) {
          const length = 1;
          results.push({
            offset: i,
            length,
            bytes: Array.from(bytes.slice(i, i + 1)),
            mnemonic: 'db',
            operands: hex8(bytes[i]),
            pseudoC: '',
          });
        }
        break;
      }

      // Effective sizes
      let operandSize; // in bytes: 1, 2, 4, or 8
      if (is64Mode)
        operandSize = rexW ? 8 : hasOperandSizeOverride ? 2 : 4;
      else
        operandSize = hasOperandSizeOverride ? 2 : 4;

      const addrSize = is64Mode
        ? (hasAddressSizeOverride ? 4 : 8)
        : (hasAddressSizeOverride ? 2 : 4);

      function regName(idx, size) {
        const sz = size || operandSize;
        if (sz === 1) return (hasRex ? REG8_REX : REG8)[idx] || ('r' + idx + 'b');
        if (sz === 2) return REG16[idx] || ('r' + idx + 'w');
        if (sz === 8) return REG64[idx] || ('r' + idx);
        return REG32[idx] || ('r' + idx + 'd');
      }

      function regByIdx(idx) { return regName(idx, operandSize); }

      const opcode = readU8(bytes, pos);
      ++pos;
      let decoded = false;

      // Lock prefix string for output
      const lockStr = hasLock ? 'lock ' : '';

      // ---- NOP (0x90, also XCHG EAX,EAX) ----
      if (opcode === 0x90 && !rexB) {
        // Could be REX.W NOP → still NOP
        // But 0x66 0x90 is also just NOP (data16 nop)
        mnemonic = 'nop';
        pseudoC = '/* nop */';
        decoded = true;
      }

      // ---- Multi-byte NOP: 0x0F 0x1F /0 (commonly used for alignment padding) ----
      if (!decoded && opcode === 0x0F && pos < end && readU8(bytes, pos) === 0x1F) {
        ++pos;
        const mr = decodeModRM(bytes, pos, is64Mode, operandSize, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        mnemonic = 'nop';
        operands = mr.rm;
        pseudoC = '/* nop */';
        decoded = true;
      }

      // ---- INT3 (0xCC) ----
      if (!decoded && opcode === 0xCC) {
        mnemonic = 'int3';
        pseudoC = '__debugbreak()';
        decoded = true;
      }

      // ---- INT imm8 (0xCD) ----
      if (!decoded && opcode === 0xCD) {
        const imm = readU8(bytes, pos); ++pos;
        mnemonic = 'int';
        operands = hex8(imm);
        pseudoC = 'interrupt(' + hex8(imm) + ')';
        decoded = true;
      }

      // ---- RET (0xC3, 0xC2) ----
      if (!decoded && opcode === 0xC3) {
        mnemonic = 'ret';
        pseudoC = 'return';
        decoded = true;
      }
      if (!decoded && opcode === 0xC2) {
        const imm16 = readU16(bytes, pos); pos += 2;
        mnemonic = 'ret';
        operands = hex16(imm16);
        pseudoC = 'return /* pop ' + imm16 + ' */';
        decoded = true;
      }

      // ---- CALL rel32 (0xE8) ----
      if (!decoded && opcode === 0xE8) {
        const rel = signedDword(readU32(bytes, pos)); pos += 4;
        const target = (pos + rel) >>> 0;
        mnemonic = 'call';
        operands = hexAddr(target, is64Mode);
        pseudoC = 'call(' + hexAddr(target, is64Mode) + ')';
        decoded = true;
      }

      // ---- JMP rel32 (0xE9) ----
      if (!decoded && opcode === 0xE9) {
        const rel = signedDword(readU32(bytes, pos)); pos += 4;
        const target = (pos + rel) >>> 0;
        mnemonic = 'jmp';
        operands = hexAddr(target, is64Mode);
        pseudoC = 'goto ' + hexAddr(target, is64Mode);
        decoded = true;
      }

      // ---- JMP rel8 (0xEB) ----
      if (!decoded && opcode === 0xEB) {
        const rel = signedByte(readU8(bytes, pos)); ++pos;
        const target = (pos + rel) >>> 0;
        mnemonic = 'jmp';
        operands = hexAddr(target, is64Mode);
        pseudoC = 'goto ' + hexAddr(target, is64Mode);
        decoded = true;
      }

      // ---- Jcc rel8 (0x70-0x7F) ----
      if (!decoded && opcode >= 0x70 && opcode <= 0x7F) {
        const cc = opcode - 0x70;
        const rel = signedByte(readU8(bytes, pos)); ++pos;
        const target = (pos + rel) >>> 0;
        mnemonic = 'j' + CC_NAMES[cc];
        operands = hexAddr(target, is64Mode);
        pseudoC = 'if (' + CC_PSEUDO[cc] + ') goto ' + hexAddr(target, is64Mode);
        decoded = true;
      }

      // ---- Jcc rel32 (0x0F 0x80-0x8F) ----
      if (!decoded && opcode === 0x0F && pos < end) {
        const op2 = readU8(bytes, pos);
        if (op2 >= 0x80 && op2 <= 0x8F) {
          ++pos;
          const cc = op2 - 0x80;
          const rel = signedDword(readU32(bytes, pos)); pos += 4;
          const target = (pos + rel) >>> 0;
          mnemonic = 'j' + CC_NAMES[cc];
          operands = hexAddr(target, is64Mode);
          pseudoC = 'if (' + CC_PSEUDO[cc] + ') goto ' + hexAddr(target, is64Mode);
          decoded = true;
        }
      }

      // ---- SETcc (0x0F 0x90-0x9F) ----
      if (!decoded && opcode === 0x0F && pos < end) {
        const op2 = readU8(bytes, pos);
        if (op2 >= 0x90 && op2 <= 0x9F) {
          ++pos;
          const cc = op2 - 0x90;
          const mr = decodeModRM(bytes, pos, is64Mode, 1, addrSize, rexR, rexX, rexB, hasRex);
          pos += mr.consumed;
          mnemonic = 'set' + CC_NAMES[cc];
          operands = mr.rm;
          pseudoC = stripSizeHint(mr.rm) + ' = ' + CC_PSEUDO[cc] + ' ? 1 : 0';
          decoded = true;
        }
      }

      // ---- CMOVcc (0x0F 0x40-0x4F) ----
      if (!decoded && opcode === 0x0F && pos < end) {
        const op2 = readU8(bytes, pos);
        if (op2 >= 0x40 && op2 <= 0x4F) {
          ++pos;
          const cc = op2 - 0x40;
          const mr = decodeModRM(bytes, pos, is64Mode, operandSize, addrSize, rexR, rexX, rexB, hasRex);
          pos += mr.consumed;
          mnemonic = 'cmov' + CC_NAMES[cc];
          operands = mr.reg + ', ' + mr.rm;
          pseudoC = 'if (' + CC_PSEUDO[cc] + ') ' + mr.reg + ' = ' + stripSizeHint(mr.rm);
          decoded = true;
        }
      }

      // ---- PUSH r (0x50-0x57) ----
      if (!decoded && opcode >= 0x50 && opcode <= 0x57) {
        const idx = (opcode - 0x50) | (rexB ? 8 : 0);
        const rn = is64Mode ? REG64[idx] : (hasOperandSizeOverride ? REG16[idx] : REG32[idx]);
        mnemonic = 'push';
        operands = rn;
        pseudoC = 'push(' + rn + ')';
        decoded = true;
      }

      // ---- POP r (0x58-0x5F) ----
      if (!decoded && opcode >= 0x58 && opcode <= 0x5F) {
        const idx = (opcode - 0x58) | (rexB ? 8 : 0);
        const rn = is64Mode ? REG64[idx] : (hasOperandSizeOverride ? REG16[idx] : REG32[idx]);
        mnemonic = 'pop';
        operands = rn;
        pseudoC = rn + ' = pop()';
        decoded = true;
      }

      // ---- PUSH imm32 (0x68) ----
      if (!decoded && opcode === 0x68) {
        if (hasOperandSizeOverride) {
          const imm = readU16(bytes, pos); pos += 2;
          mnemonic = 'push';
          operands = hex16(imm);
          pseudoC = 'push(' + hex16(imm) + ')';
        } else {
          const imm = readU32(bytes, pos); pos += 4;
          mnemonic = 'push';
          operands = hex32(imm);
          pseudoC = 'push(' + hex32(imm) + ')';
        }
        decoded = true;
      }

      // ---- PUSH imm8 (0x6A) ----
      if (!decoded && opcode === 0x6A) {
        const imm = signedByte(readU8(bytes, pos)); ++pos;
        mnemonic = 'push';
        operands = hex8(imm & 0xFF);
        pseudoC = 'push(' + hex8(imm & 0xFF) + ')';
        decoded = true;
      }

      // ---- MOV r, imm (0xB8-0xBF for 16/32/64-bit, 0xB0-0xB7 for 8-bit) ----
      if (!decoded && opcode >= 0xB8 && opcode <= 0xBF) {
        const idx = (opcode - 0xB8) | (rexB ? 8 : 0);
        let rn, immVal;
        if (rexW) {
          // 64-bit immediate
          const lo = readU32(bytes, pos);
          const hi = readU32(bytes, pos + 4);
          pos += 8;
          rn = REG64[idx];
          immVal = hex64(hi, lo);
        } else if (hasOperandSizeOverride) {
          immVal = hex16(readU16(bytes, pos)); pos += 2;
          rn = REG16[idx];
        } else {
          immVal = hex32(readU32(bytes, pos)); pos += 4;
          rn = REG32[idx];
        }
        mnemonic = 'mov';
        operands = rn + ', ' + immVal;
        pseudoC = rn + ' = ' + immVal;
        decoded = true;
      }

      // ---- MOV r8, imm8 (0xB0-0xB7) ----
      if (!decoded && opcode >= 0xB0 && opcode <= 0xB7) {
        const idx = (opcode - 0xB0) | (rexB ? 8 : 0);
        const rn = (hasRex ? REG8_REX : REG8)[idx] || ('r' + idx + 'b');
        const imm = readU8(bytes, pos); ++pos;
        mnemonic = 'mov';
        operands = rn + ', ' + hex8(imm);
        pseudoC = rn + ' = ' + hex8(imm);
        decoded = true;
      }

      // ---- MOV r/m, r and MOV r, r/m (0x88, 0x89, 0x8A, 0x8B) ----
      if (!decoded && (opcode === 0x88 || opcode === 0x89 || opcode === 0x8A || opcode === 0x8B)) {
        const isByte = (opcode === 0x88 || opcode === 0x8A);
        const isToReg = (opcode === 0x8A || opcode === 0x8B);
        const sz = isByte ? 1 : operandSize;
        const mr = decodeModRM(bytes, pos, is64Mode, sz, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        mnemonic = lockStr + 'mov';
        if (isToReg) {
          operands = mr.reg + ', ' + mr.rm;
          if (mr.mod === 3)
            pseudoC = mr.reg + ' = ' + mr.rm;
          else
            pseudoC = mr.reg + ' = *(' + memExprFromBracket(mr.rm) + ')';
        } else {
          operands = mr.rm + ', ' + mr.reg;
          if (mr.mod === 3)
            pseudoC = stripSizeHint(mr.rm) + ' = ' + mr.reg;
          else
            pseudoC = '*(' + memExprFromBracket(mr.rm) + ') = ' + mr.reg;
        }
        decoded = true;
      }

      // ---- MOV EAX, moffs / MOV moffs, EAX (0xA1, 0xA3) ----
      if (!decoded && (opcode === 0xA1 || opcode === 0xA3)) {
        const addrBytes = is64Mode ? 8 : 4;
        let addr;
        if (addrBytes === 8) {
          const lo = readU32(bytes, pos);
          const hi = readU32(bytes, pos + 4);
          pos += 8;
          addr = hex64(hi, lo);
        } else {
          addr = hex32(readU32(bytes, pos)); pos += 4;
        }
        const rn = rexW ? 'rax' : hasOperandSizeOverride ? 'ax' : 'eax';
        mnemonic = 'mov';
        if (opcode === 0xA1) {
          operands = rn + ', [' + addr + ']';
          pseudoC = rn + ' = *(' + addr + ')';
        } else {
          operands = '[' + addr + '], ' + rn;
          pseudoC = '*(' + addr + ') = ' + rn;
        }
        decoded = true;
      }

      // ---- MOV r/m, imm (0xC6 /0 byte, 0xC7 /0 word/dword) ----
      if (!decoded && (opcode === 0xC6 || opcode === 0xC7)) {
        const isByte = opcode === 0xC6;
        const sz = isByte ? 1 : operandSize;
        const mr = decodeModRM(bytes, pos, is64Mode, sz, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        if ((mr.regIdx & 7) === 0) { // /0 = MOV
          let immVal;
          if (isByte) { immVal = hex8(readU8(bytes, pos)); ++pos; }
          else if (operandSize === 2) { immVal = hex16(readU16(bytes, pos)); pos += 2; }
          else { immVal = hex32(readU32(bytes, pos)); pos += 4; } // 32-bit imm even for 64-bit operand
          mnemonic = lockStr + 'mov';
          operands = mr.rm + ', ' + immVal;
          if (mr.mod === 3)
            pseudoC = stripSizeHint(mr.rm) + ' = ' + immVal;
          else
            pseudoC = '*(' + memExprFromBracket(mr.rm) + ') = ' + immVal;
          decoded = true;
        }
      }

      // ---- LEA (0x8D) ----
      if (!decoded && opcode === 0x8D) {
        const mr = decodeModRM(bytes, pos, is64Mode, operandSize, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        mnemonic = 'lea';
        operands = mr.reg + ', ' + mr.rm;
        pseudoC = mr.reg + ' = ' + memExprFromBracket(mr.rm);
        decoded = true;
      }

      // ---- ALU r/m, r  (ADD 0x01/0x00, OR 0x09/0x08, ADC, SBB, AND 0x21/0x20, SUB 0x29/0x28, XOR 0x31/0x30, CMP 0x39/0x38) ----
      if (!decoded) {
        // Even opcodes = byte, odd = word/dword; direction is encoded in bit 1
        // Pattern: opcode bits [5:3] = ALU op, bit 0 = size (0=byte, 1=full), bit 1 = direction (0=r/m,r  1=r,r/m)
        const baseMap = { 0x00: 0, 0x01: 0, 0x02: 0, 0x03: 0, 0x08: 1, 0x09: 1, 0x0A: 1, 0x0B: 1,
                          0x10: 2, 0x11: 2, 0x12: 2, 0x13: 2, 0x18: 3, 0x19: 3, 0x1A: 3, 0x1B: 3,
                          0x20: 4, 0x21: 4, 0x22: 4, 0x23: 4, 0x28: 5, 0x29: 5, 0x2A: 5, 0x2B: 5,
                          0x30: 6, 0x31: 6, 0x32: 6, 0x33: 6, 0x38: 7, 0x39: 7, 0x3A: 7, 0x3B: 7 };
        if (baseMap[opcode] !== undefined) {
          const aluOp = baseMap[opcode];
          const isByte = (opcode & 1) === 0;
          const toReg = (opcode & 2) !== 0;
          const sz = isByte ? 1 : operandSize;
          const mr = decodeModRM(bytes, pos, is64Mode, sz, addrSize, rexR, rexX, rexB, hasRex);
          pos += mr.consumed;
          mnemonic = lockStr + ALU_NAMES[aluOp];
          if (toReg) {
            operands = mr.reg + ', ' + mr.rm;
            if (aluOp === 7) // CMP
              pseudoC = 'compare(' + mr.reg + ', ' + stripSizeHint(mr.rm) + ')';
            else if (aluOp === 6 && mr.mod === 3 && mr.reg === stripSizeHint(mr.rm)) // XOR same reg
              pseudoC = mr.reg + ' = 0';
            else
              pseudoC = pseudoAlu(ALU_PSEUDO_OP[aluOp], mr.reg, stripSizeHint(mr.rm));
          } else {
            operands = mr.rm + ', ' + mr.reg;
            if (aluOp === 7)
              pseudoC = 'compare(' + stripSizeHint(mr.rm) + ', ' + mr.reg + ')';
            else
              pseudoC = pseudoAlu(ALU_PSEUDO_OP[aluOp], stripSizeHint(mr.rm), mr.reg);
          }
          decoded = true;
        }
      }

      // ---- ALU AL/AX/EAX, imm (0x04/0x05, 0x0C/0x0D, ..., 0x3C/0x3D) ----
      if (!decoded) {
        const accImmMap = { 0x04: 0, 0x05: 0, 0x0C: 1, 0x0D: 1, 0x14: 2, 0x15: 2, 0x1C: 3, 0x1D: 3,
                            0x24: 4, 0x25: 4, 0x2C: 5, 0x2D: 5, 0x34: 6, 0x35: 6, 0x3C: 7, 0x3D: 7 };
        if (accImmMap[opcode] !== undefined) {
          const aluOp = accImmMap[opcode];
          const isByte = (opcode & 1) === 0;
          let immVal, rn;
          if (isByte) {
            immVal = hex8(readU8(bytes, pos)); ++pos;
            rn = 'al';
          } else if (operandSize === 2) {
            immVal = hex16(readU16(bytes, pos)); pos += 2;
            rn = 'ax';
          } else {
            immVal = hex32(readU32(bytes, pos)); pos += 4;
            rn = rexW ? 'rax' : 'eax';
          }
          mnemonic = ALU_NAMES[aluOp];
          operands = rn + ', ' + immVal;
          if (aluOp === 7)
            pseudoC = 'compare(' + rn + ', ' + immVal + ')';
          else
            pseudoC = pseudoAlu(ALU_PSEUDO_OP[aluOp], rn, immVal);
          decoded = true;
        }
      }

      // ---- ALU r/m, imm (0x80, 0x81, 0x83) ----
      if (!decoded && (opcode === 0x80 || opcode === 0x81 || opcode === 0x83)) {
        const isByte = opcode === 0x80;
        const isSignExt = opcode === 0x83;
        const sz = isByte ? 1 : operandSize;
        const mr = decodeModRM(bytes, pos, is64Mode, sz, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        const aluOp = mr.regIdx & 7;

        let immVal;
        if (isByte || isSignExt) {
          const raw = readU8(bytes, pos); ++pos;
          immVal = hex8(raw);
        } else if (operandSize === 2) {
          immVal = hex16(readU16(bytes, pos)); pos += 2;
        } else {
          immVal = hex32(readU32(bytes, pos)); pos += 4;
        }

        mnemonic = lockStr + ALU_NAMES[aluOp];
        operands = mr.rm + ', ' + immVal;
        const target = stripSizeHint(mr.rm);

        if (aluOp === 7)
          pseudoC = 'compare(' + target + ', ' + immVal + ')';
        else if (aluOp === 6 && mr.mod === 3 && immVal === hex8(0) + '' || false)
          pseudoC = pseudoAlu(ALU_PSEUDO_OP[aluOp], target, immVal);
        else
          pseudoC = ALU_PSEUDO_OP[aluOp] ? pseudoAlu(ALU_PSEUDO_OP[aluOp], target, immVal) : ('/* ' + ALU_NAMES[aluOp] + ' */');

        decoded = true;
      }

      // ---- TEST r/m, r (0x84 byte, 0x85 word/dword) ----
      if (!decoded && (opcode === 0x84 || opcode === 0x85)) {
        const isByte = opcode === 0x84;
        const sz = isByte ? 1 : operandSize;
        const mr = decodeModRM(bytes, pos, is64Mode, sz, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        mnemonic = 'test';
        operands = mr.rm + ', ' + mr.reg;
        pseudoC = 'test(' + stripSizeHint(mr.rm) + ', ' + mr.reg + ')';
        decoded = true;
      }

      // ---- TEST AL/EAX, imm (0xA8 byte, 0xA9 word/dword) ----
      if (!decoded && (opcode === 0xA8 || opcode === 0xA9)) {
        const isByte = opcode === 0xA8;
        let immVal, rn;
        if (isByte) {
          immVal = hex8(readU8(bytes, pos)); ++pos;
          rn = 'al';
        } else if (operandSize === 2) {
          immVal = hex16(readU16(bytes, pos)); pos += 2;
          rn = 'ax';
        } else {
          immVal = hex32(readU32(bytes, pos)); pos += 4;
          rn = rexW ? 'rax' : 'eax';
        }
        mnemonic = 'test';
        operands = rn + ', ' + immVal;
        pseudoC = 'test(' + rn + ', ' + immVal + ')';
        decoded = true;
      }

      // ---- TEST r/m, imm (0xF6 /0 byte, 0xF7 /0 word/dword) ----
      if (!decoded && (opcode === 0xF6 || opcode === 0xF7)) {
        const isByte = opcode === 0xF6;
        const sz = isByte ? 1 : operandSize;
        const mr = decodeModRM(bytes, pos, is64Mode, sz, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        const ext = mr.regIdx & 7;
        if (ext === 0) {
          // TEST
          let immVal;
          if (isByte) { immVal = hex8(readU8(bytes, pos)); ++pos; }
          else if (operandSize === 2) { immVal = hex16(readU16(bytes, pos)); pos += 2; }
          else { immVal = hex32(readU32(bytes, pos)); pos += 4; }
          mnemonic = 'test';
          operands = mr.rm + ', ' + immVal;
          pseudoC = 'test(' + stripSizeHint(mr.rm) + ', ' + immVal + ')';
          decoded = true;
        } else if (ext === 2) {
          // NOT
          mnemonic = lockStr + 'not';
          operands = mr.rm;
          pseudoC = stripSizeHint(mr.rm) + ' = ~' + stripSizeHint(mr.rm);
          decoded = true;
        } else if (ext === 3) {
          // NEG
          mnemonic = lockStr + 'neg';
          operands = mr.rm;
          pseudoC = stripSizeHint(mr.rm) + ' = -' + stripSizeHint(mr.rm);
          decoded = true;
        } else if (ext === 4) {
          // MUL
          const acc = isByte ? 'al' : regName(0);
          mnemonic = 'mul';
          operands = mr.rm;
          pseudoC = acc + ' *= ' + stripSizeHint(mr.rm) + ' /* unsigned */';
          decoded = true;
        } else if (ext === 5) {
          // IMUL
          const acc = isByte ? 'al' : regName(0);
          mnemonic = 'imul';
          operands = mr.rm;
          pseudoC = acc + ' *= ' + stripSizeHint(mr.rm) + ' /* signed */';
          decoded = true;
        } else if (ext === 6) {
          // DIV
          mnemonic = 'div';
          operands = mr.rm;
          pseudoC = 'div(' + stripSizeHint(mr.rm) + ') /* unsigned */';
          decoded = true;
        } else if (ext === 7) {
          // IDIV
          mnemonic = 'idiv';
          operands = mr.rm;
          pseudoC = 'idiv(' + stripSizeHint(mr.rm) + ') /* signed */';
          decoded = true;
        }
      }

      // ---- XCHG EAX, r (0x91-0x97) / also 0x90 handled above as NOP ----
      if (!decoded && opcode >= 0x91 && opcode <= 0x97) {
        const idx = (opcode - 0x90) | (rexB ? 8 : 0);
        const rn1 = rexW ? 'rax' : hasOperandSizeOverride ? 'ax' : 'eax';
        const rn2 = regByIdx(idx);
        mnemonic = 'xchg';
        operands = rn1 + ', ' + rn2;
        pseudoC = 'swap(' + rn1 + ', ' + rn2 + ')';
        decoded = true;
      }

      // ---- XCHG r/m, r (0x86 byte, 0x87 word/dword) ----
      if (!decoded && (opcode === 0x86 || opcode === 0x87)) {
        const isByte = opcode === 0x86;
        const sz = isByte ? 1 : operandSize;
        const mr = decodeModRM(bytes, pos, is64Mode, sz, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        mnemonic = lockStr + 'xchg';
        operands = mr.rm + ', ' + mr.reg;
        pseudoC = 'swap(' + stripSizeHint(mr.rm) + ', ' + mr.reg + ')';
        decoded = true;
      }

      // ---- INC/DEC r/m (0xFE byte, 0xFF word/dword) ----
      if (!decoded && (opcode === 0xFE || opcode === 0xFF)) {
        const isByte = opcode === 0xFE;
        const sz = isByte ? 1 : operandSize;
        const mr = decodeModRM(bytes, pos, is64Mode, sz, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        const ext = mr.regIdx & 7;
        if (ext === 0) {
          mnemonic = lockStr + 'inc';
          operands = mr.rm;
          pseudoC = '++' + stripSizeHint(mr.rm);
          decoded = true;
        } else if (ext === 1) {
          mnemonic = lockStr + 'dec';
          operands = mr.rm;
          pseudoC = '--' + stripSizeHint(mr.rm);
          decoded = true;
        } else if (ext === 2 && !isByte) {
          // CALL r/m
          mnemonic = 'call';
          operands = mr.rm;
          pseudoC = 'call(' + stripSizeHint(mr.rm) + ')';
          decoded = true;
        } else if (ext === 4 && !isByte) {
          // JMP r/m
          mnemonic = 'jmp';
          operands = mr.rm;
          pseudoC = 'goto ' + stripSizeHint(mr.rm);
          decoded = true;
        } else if (ext === 6 && !isByte) {
          // PUSH r/m
          mnemonic = 'push';
          operands = mr.rm;
          pseudoC = 'push(' + stripSizeHint(mr.rm) + ')';
          decoded = true;
        }
      }

      // ---- INC/DEC r (0x40-0x4F, x86 only — in x64 these are REX prefixes) ----
      if (!decoded && !is64Mode && opcode >= 0x40 && opcode <= 0x4F) {
        const isInc = opcode < 0x48;
        const idx = opcode & 7;
        const rn = hasOperandSizeOverride ? REG16[idx] : REG32[idx];
        mnemonic = isInc ? 'inc' : 'dec';
        operands = rn;
        pseudoC = (isInc ? '++' : '--') + rn;
        decoded = true;
      }

      // ---- POP r/m (0x8F /0) ----
      if (!decoded && opcode === 0x8F) {
        const mr = decodeModRM(bytes, pos, is64Mode, operandSize, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        if ((mr.regIdx & 7) === 0) {
          mnemonic = 'pop';
          operands = mr.rm;
          pseudoC = stripSizeHint(mr.rm) + ' = pop()';
          decoded = true;
        }
      }

      // ---- Shift/Rotate instructions ----
      // SHL/SHR/SAR/ROL/ROR/RCL/RCR r/m, 1 (0xD0 byte, 0xD1 word/dword)
      if (!decoded && (opcode === 0xD0 || opcode === 0xD1)) {
        const isByte = opcode === 0xD0;
        const sz = isByte ? 1 : operandSize;
        const mr = decodeModRM(bytes, pos, is64Mode, sz, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        const ext = mr.regIdx & 7;
        mnemonic = SHIFT_NAMES[ext];
        operands = mr.rm + ', 1';
        const shiftOp = ext === 4 || ext === 6 ? '<<=' : ext === 5 ? '>>>=' : ext === 7 ? '>>=' : '/* ' + SHIFT_NAMES[ext] + ' */';
        if (typeof shiftOp === 'string' && shiftOp.includes('='))
          pseudoC = stripSizeHint(mr.rm) + ' ' + shiftOp + ' 1';
        else
          pseudoC = SHIFT_NAMES[ext] + '(' + stripSizeHint(mr.rm) + ', 1)';
        decoded = true;
      }

      // SHL/SHR/SAR/ROL/ROR r/m, CL (0xD2 byte, 0xD3 word/dword)
      if (!decoded && (opcode === 0xD2 || opcode === 0xD3)) {
        const isByte = opcode === 0xD2;
        const sz = isByte ? 1 : operandSize;
        const mr = decodeModRM(bytes, pos, is64Mode, sz, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        const ext = mr.regIdx & 7;
        mnemonic = SHIFT_NAMES[ext];
        operands = mr.rm + ', cl';
        const shiftOp = ext === 4 || ext === 6 ? '<<=' : ext === 5 ? '>>>=' : ext === 7 ? '>>=' : null;
        if (shiftOp)
          pseudoC = stripSizeHint(mr.rm) + ' ' + shiftOp + ' cl';
        else
          pseudoC = SHIFT_NAMES[ext] + '(' + stripSizeHint(mr.rm) + ', cl)';
        decoded = true;
      }

      // SHL/SHR/SAR/ROL/ROR r/m, imm8 (0xC0 byte, 0xC1 word/dword)
      if (!decoded && (opcode === 0xC0 || opcode === 0xC1)) {
        const isByte = opcode === 0xC0;
        const sz = isByte ? 1 : operandSize;
        const mr = decodeModRM(bytes, pos, is64Mode, sz, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        const ext = mr.regIdx & 7;
        const imm = readU8(bytes, pos); ++pos;
        mnemonic = SHIFT_NAMES[ext];
        operands = mr.rm + ', ' + hex8(imm);
        const shiftOp = ext === 4 || ext === 6 ? '<<=' : ext === 5 ? '>>>=' : ext === 7 ? '>>=' : null;
        if (shiftOp)
          pseudoC = stripSizeHint(mr.rm) + ' ' + shiftOp + ' ' + imm;
        else
          pseudoC = SHIFT_NAMES[ext] + '(' + stripSizeHint(mr.rm) + ', ' + imm + ')';
        decoded = true;
      }

      // ---- MOVZX (0x0F 0xB6, 0x0F 0xB7) ----
      if (!decoded && opcode === 0x0F && pos < end) {
        const op2 = readU8(bytes, pos);
        if (op2 === 0xB6 || op2 === 0xB7) {
          ++pos;
          const srcSz = op2 === 0xB6 ? 1 : 2;
          const mr = decodeModRM(bytes, pos, is64Mode, srcSz, addrSize, rexR, rexX, rexB, hasRex);
          pos += mr.consumed;
          const dstReg = regName(mr.regIdx, operandSize);
          mnemonic = 'movzx';
          operands = dstReg + ', ' + mr.rm;
          pseudoC = dstReg + ' = (unsigned)' + stripSizeHint(mr.rm);
          decoded = true;
        }
      }

      // ---- MOVSX (0x0F 0xBE, 0x0F 0xBF) ----
      if (!decoded && opcode === 0x0F && pos < end) {
        const op2 = readU8(bytes, pos);
        if (op2 === 0xBE || op2 === 0xBF) {
          ++pos;
          const srcSz = op2 === 0xBE ? 1 : 2;
          const mr = decodeModRM(bytes, pos, is64Mode, srcSz, addrSize, rexR, rexX, rexB, hasRex);
          pos += mr.consumed;
          const dstReg = regName(mr.regIdx, operandSize);
          mnemonic = 'movsx';
          operands = dstReg + ', ' + mr.rm;
          pseudoC = dstReg + ' = (signed)' + stripSizeHint(mr.rm);
          decoded = true;
        }
      }

      // ---- MOVSXD (0x63 in x64 mode) ----
      if (!decoded && is64Mode && opcode === 0x63) {
        const mr = decodeModRM(bytes, pos, is64Mode, 4, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        const dstReg = regName(mr.regIdx, rexW ? 8 : 4);
        mnemonic = 'movsxd';
        operands = dstReg + ', ' + mr.rm;
        pseudoC = dstReg + ' = (int64_t)(int32_t)' + stripSizeHint(mr.rm);
        decoded = true;
      }

      // ---- IMUL r, r/m (0x0F 0xAF) ----
      if (!decoded && opcode === 0x0F && pos < end && readU8(bytes, pos) === 0xAF) {
        ++pos;
        const mr = decodeModRM(bytes, pos, is64Mode, operandSize, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        mnemonic = 'imul';
        operands = mr.reg + ', ' + mr.rm;
        pseudoC = mr.reg + ' *= ' + stripSizeHint(mr.rm);
        decoded = true;
      }

      // ---- IMUL r, r/m, imm8 (0x6B) ----
      if (!decoded && opcode === 0x6B) {
        const mr = decodeModRM(bytes, pos, is64Mode, operandSize, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        const imm = signedByte(readU8(bytes, pos)); ++pos;
        mnemonic = 'imul';
        operands = mr.reg + ', ' + mr.rm + ', ' + hex8(imm & 0xFF);
        pseudoC = mr.reg + ' = ' + stripSizeHint(mr.rm) + ' * ' + imm;
        decoded = true;
      }

      // ---- IMUL r, r/m, imm32 (0x69) ----
      if (!decoded && opcode === 0x69) {
        const mr = decodeModRM(bytes, pos, is64Mode, operandSize, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        let immVal;
        if (operandSize === 2) { immVal = readU16(bytes, pos); pos += 2; }
        else { immVal = readU32(bytes, pos); pos += 4; }
        mnemonic = 'imul';
        operands = mr.reg + ', ' + mr.rm + ', ' + hex32(immVal);
        pseudoC = mr.reg + ' = ' + stripSizeHint(mr.rm) + ' * ' + hex32(immVal);
        decoded = true;
      }

      // ---- LEAVE (0xC9) ----
      if (!decoded && opcode === 0xC9) {
        mnemonic = 'leave';
        pseudoC = is64Mode ? 'rsp = rbp; rbp = pop()' : 'esp = ebp; ebp = pop()';
        decoded = true;
      }

      // ---- ENTER (0xC8) ----
      if (!decoded && opcode === 0xC8) {
        const frameSize = readU16(bytes, pos); pos += 2;
        const nestLevel = readU8(bytes, pos); ++pos;
        mnemonic = 'enter';
        operands = hex16(frameSize) + ', ' + hex8(nestLevel);
        pseudoC = 'enter(' + frameSize + ', ' + nestLevel + ')';
        decoded = true;
      }

      // ---- CLD (0xFC), STD (0xFD) ----
      if (!decoded && opcode === 0xFC) {
        mnemonic = 'cld';
        pseudoC = 'DF = 0';
        decoded = true;
      }
      if (!decoded && opcode === 0xFD) {
        mnemonic = 'std';
        pseudoC = 'DF = 1';
        decoded = true;
      }

      // ---- CDQ (0x99), CWD, CQO ----
      if (!decoded && opcode === 0x99) {
        if (rexW) {
          mnemonic = 'cqo';
          pseudoC = 'rdx:rax = sign_extend(rax)';
        } else if (hasOperandSizeOverride) {
          mnemonic = 'cwd';
          pseudoC = 'dx:ax = sign_extend(ax)';
        } else {
          mnemonic = 'cdq';
          pseudoC = 'edx:eax = sign_extend(eax)';
        }
        decoded = true;
      }

      // ---- CBW / CWDE / CDQE (0x98) ----
      if (!decoded && opcode === 0x98) {
        if (rexW) {
          mnemonic = 'cdqe';
          pseudoC = 'rax = (int64_t)(int32_t)eax';
        } else if (hasOperandSizeOverride) {
          mnemonic = 'cbw';
          pseudoC = 'ax = (int16_t)(int8_t)al';
        } else {
          mnemonic = 'cwde';
          pseudoC = 'eax = (int32_t)(int16_t)ax';
        }
        decoded = true;
      }

      // ---- SYSCALL (0x0F 0x05) ----
      if (!decoded && opcode === 0x0F && pos < end && readU8(bytes, pos) === 0x05) {
        ++pos;
        mnemonic = 'syscall';
        pseudoC = 'syscall()';
        decoded = true;
      }

      // ---- CPUID (0x0F 0xA2) ----
      if (!decoded && opcode === 0x0F && pos < end && readU8(bytes, pos) === 0xA2) {
        ++pos;
        mnemonic = 'cpuid';
        pseudoC = 'cpuid()';
        decoded = true;
      }

      // ---- RDTSC (0x0F 0x31) ----
      if (!decoded && opcode === 0x0F && pos < end && readU8(bytes, pos) === 0x31) {
        ++pos;
        mnemonic = 'rdtsc';
        pseudoC = 'edx:eax = read_tsc()';
        decoded = true;
      }

      // ---- BSF/BSR (0x0F 0xBC, 0x0F 0xBD) ----
      if (!decoded && opcode === 0x0F && pos < end) {
        const op2 = readU8(bytes, pos);
        if (op2 === 0xBC || op2 === 0xBD) {
          ++pos;
          const mr = decodeModRM(bytes, pos, is64Mode, operandSize, addrSize, rexR, rexX, rexB, hasRex);
          pos += mr.consumed;
          const name = op2 === 0xBC ? 'bsf' : 'bsr';
          mnemonic = name;
          operands = mr.reg + ', ' + mr.rm;
          pseudoC = mr.reg + ' = ' + name + '(' + stripSizeHint(mr.rm) + ')';
          decoded = true;
        }
      }

      // ---- BT/BTS/BTR/BTC (0x0F 0xBA /4-/7) ----
      if (!decoded && opcode === 0x0F && pos < end && readU8(bytes, pos) === 0xBA) {
        ++pos;
        const mr = decodeModRM(bytes, pos, is64Mode, operandSize, addrSize, rexR, rexX, rexB, hasRex);
        pos += mr.consumed;
        const ext = mr.regIdx & 7;
        if (ext >= 4 && ext <= 7) {
          const names = { 4: 'bt', 5: 'bts', 6: 'btr', 7: 'btc' };
          const imm = readU8(bytes, pos); ++pos;
          mnemonic = names[ext];
          operands = mr.rm + ', ' + hex8(imm);
          pseudoC = names[ext] + '(' + stripSizeHint(mr.rm) + ', ' + imm + ')';
          decoded = true;
        }
      }

      // ---- CLC/STC/CMC (0xF8/0xF9/0xF5) ----
      if (!decoded && opcode === 0xF8) { mnemonic = 'clc'; pseudoC = 'CF = 0'; decoded = true; }
      if (!decoded && opcode === 0xF9) { mnemonic = 'stc'; pseudoC = 'CF = 1'; decoded = true; }
      if (!decoded && opcode === 0xF5) { mnemonic = 'cmc'; pseudoC = 'CF = !CF'; decoded = true; }

      // ---- CLI/STI (0xFA/0xFB) ----
      if (!decoded && opcode === 0xFA) { mnemonic = 'cli'; pseudoC = 'IF = 0'; decoded = true; }
      if (!decoded && opcode === 0xFB) { mnemonic = 'sti'; pseudoC = 'IF = 1'; decoded = true; }

      // ---- HLT (0xF4) ----
      if (!decoded && opcode === 0xF4) { mnemonic = 'hlt'; pseudoC = 'halt()'; decoded = true; }

      // ---- SAHF/LAHF (0x9E/0x9F) ----
      if (!decoded && opcode === 0x9E) { mnemonic = 'sahf'; pseudoC = 'flags = ah'; decoded = true; }
      if (!decoded && opcode === 0x9F) { mnemonic = 'lahf'; pseudoC = 'ah = flags'; decoded = true; }

      // ---- PUSHF/POPF (0x9C/0x9D) ----
      if (!decoded && opcode === 0x9C) { mnemonic = rexW ? 'pushfq' : 'pushfd'; pseudoC = 'push(flags)'; decoded = true; }
      if (!decoded && opcode === 0x9D) { mnemonic = rexW ? 'popfq' : 'popfd'; pseudoC = 'flags = pop()'; decoded = true; }

      // ---- REP MOVSB/MOVSD/MOVSQ etc. (string operations) ----
      if (!decoded && (opcode === 0xA4 || opcode === 0xA5)) {
        const isByte = opcode === 0xA4;
        const suf = isByte ? 'b' : rexW ? 'q' : hasOperandSizeOverride ? 'w' : 'd';
        const prefix = repPrefix === 0xF3 ? 'rep ' : '';
        mnemonic = prefix + 'movs' + suf;
        pseudoC = prefix + 'memcpy(edi, esi)';
        decoded = true;
      }
      if (!decoded && (opcode === 0xAA || opcode === 0xAB)) {
        const isByte = opcode === 0xAA;
        const suf = isByte ? 'b' : rexW ? 'q' : hasOperandSizeOverride ? 'w' : 'd';
        const prefix = repPrefix === 0xF3 ? 'rep ' : '';
        mnemonic = prefix + 'stos' + suf;
        pseudoC = prefix + 'memset(edi, ' + (isByte ? 'al' : 'eax') + ')';
        decoded = true;
      }
      if (!decoded && (opcode === 0xAC || opcode === 0xAD)) {
        const isByte = opcode === 0xAC;
        const suf = isByte ? 'b' : rexW ? 'q' : hasOperandSizeOverride ? 'w' : 'd';
        const prefix = repPrefix === 0xF3 ? 'rep ' : '';
        mnemonic = prefix + 'lods' + suf;
        pseudoC = prefix + (isByte ? 'al' : 'eax') + ' = *esi++';
        decoded = true;
      }
      if (!decoded && (opcode === 0xA6 || opcode === 0xA7)) {
        const isByte = opcode === 0xA6;
        const suf = isByte ? 'b' : rexW ? 'q' : hasOperandSizeOverride ? 'w' : 'd';
        const prefix = repPrefix === 0xF3 ? 'repe ' : repPrefix === 0xF2 ? 'repne ' : '';
        mnemonic = prefix + 'cmps' + suf;
        pseudoC = prefix + 'memcmp(esi, edi)';
        decoded = true;
      }
      if (!decoded && (opcode === 0xAE || opcode === 0xAF)) {
        const isByte = opcode === 0xAE;
        const suf = isByte ? 'b' : rexW ? 'q' : hasOperandSizeOverride ? 'w' : 'd';
        const prefix = repPrefix === 0xF3 ? 'repe ' : repPrefix === 0xF2 ? 'repne ' : '';
        mnemonic = prefix + 'scas' + suf;
        pseudoC = prefix + 'scan(edi, ' + (isByte ? 'al' : 'eax') + ')';
        decoded = true;
      }

      // ---- LOOP / LOOPcc (0xE0-0xE2) ----
      if (!decoded && opcode >= 0xE0 && opcode <= 0xE2) {
        const rel = signedByte(readU8(bytes, pos)); ++pos;
        const target = (pos + rel) >>> 0;
        const names = { 0xE0: 'loopne', 0xE1: 'loope', 0xE2: 'loop' };
        mnemonic = names[opcode];
        operands = hexAddr(target, is64Mode);
        pseudoC = 'if (--ecx' + (opcode === 0xE0 ? ' && !ZF' : opcode === 0xE1 ? ' && ZF' : '') + ') goto ' + hexAddr(target, is64Mode);
        decoded = true;
      }

      // ---- IN/OUT (0xE4-0xE7, 0xEC-0xEF) ----
      if (!decoded && (opcode === 0xE4 || opcode === 0xE5)) {
        const isByte = opcode === 0xE4;
        const port = readU8(bytes, pos); ++pos;
        mnemonic = 'in';
        operands = (isByte ? 'al' : 'eax') + ', ' + hex8(port);
        pseudoC = (isByte ? 'al' : 'eax') + ' = in(' + hex8(port) + ')';
        decoded = true;
      }
      if (!decoded && (opcode === 0xE6 || opcode === 0xE7)) {
        const isByte = opcode === 0xE6;
        const port = readU8(bytes, pos); ++pos;
        mnemonic = 'out';
        operands = hex8(port) + ', ' + (isByte ? 'al' : 'eax');
        pseudoC = 'out(' + hex8(port) + ', ' + (isByte ? 'al' : 'eax') + ')';
        decoded = true;
      }
      if (!decoded && (opcode === 0xEC || opcode === 0xED)) {
        const isByte = opcode === 0xEC;
        mnemonic = 'in';
        operands = (isByte ? 'al' : 'eax') + ', dx';
        pseudoC = (isByte ? 'al' : 'eax') + ' = in(dx)';
        decoded = true;
      }
      if (!decoded && (opcode === 0xEE || opcode === 0xEF)) {
        const isByte = opcode === 0xEE;
        mnemonic = 'out';
        operands = 'dx, ' + (isByte ? 'al' : 'eax');
        pseudoC = 'out(dx, ' + (isByte ? 'al' : 'eax') + ')';
        decoded = true;
      }

      // ---- UD2 (0x0F 0x0B) ----
      if (!decoded && opcode === 0x0F && pos < end && readU8(bytes, pos) === 0x0B) {
        ++pos;
        mnemonic = 'ud2';
        pseudoC = '__ud2() /* undefined instruction */';
        decoded = true;
      }

      // ---- PAUSE (F3 90) — already consumed F3 as repPrefix, 0x90 above becomes nop ----
      // Handle specially: if we had repPrefix === 0xF3 and opcode === 0x90
      if (!decoded && repPrefix === 0xF3 && opcode === 0x90) {
        mnemonic = 'pause';
        pseudoC = '/* pause — spin-wait hint */';
        decoded = true;
      }

      // ---- ENDBR32 / ENDBR64 (0xF3 0x0F 0x1E 0xFA/0xFB) ----
      if (!decoded && repPrefix === 0xF3 && opcode === 0x0F && pos + 1 < end) {
        const b1 = readU8(bytes, pos);
        const b2 = readU8(bytes, pos + 1);
        if (b1 === 0x1E && (b2 === 0xFA || b2 === 0xFB)) {
          pos += 2;
          mnemonic = b2 === 0xFB ? 'endbr32' : 'endbr64';
          pseudoC = '/* CET: ' + mnemonic + ' */';
          decoded = true;
        }
      }

      // ---- BSWAP (0x0F 0xC8-0xCF) ----
      if (!decoded && opcode === 0x0F && pos < end) {
        const op2 = readU8(bytes, pos);
        if (op2 >= 0xC8 && op2 <= 0xCF) {
          ++pos;
          const idx = (op2 - 0xC8) | (rexB ? 8 : 0);
          const rn = rexW ? REG64[idx] : REG32[idx];
          mnemonic = 'bswap';
          operands = rn;
          pseudoC = rn + ' = bswap(' + rn + ')';
          decoded = true;
        }
      }

      // ---- MOVAPS/MOVUPS etc. — just enough to not choke on SSE prologues ----
      if (!decoded && opcode === 0x0F && pos < end) {
        const op2 = readU8(bytes, pos);
        // MOVAPS xmm, xmm/m128 (0x0F 0x28) / MOVAPS m128, xmm (0x0F 0x29)
        // MOVUPS (0x0F 0x10/0x11)
        // MOVDQA (0x66 0x0F 0x6F/0x7F)
        if (op2 === 0x28 || op2 === 0x29 || op2 === 0x10 || op2 === 0x11 ||
            op2 === 0x6F || op2 === 0x7F) {
          ++pos;
          const names = { 0x28: 'movaps', 0x29: 'movaps', 0x10: 'movups', 0x11: 'movups',
                          0x6F: hasOperandSizeOverride ? 'movdqa' : 'movq',
                          0x7F: hasOperandSizeOverride ? 'movdqa' : 'movq' };
          // Just consume the ModR/M to advance pos correctly
          const mr = decodeModRM(bytes, pos, is64Mode, 4, addrSize, rexR, rexX, rexB, hasRex);
          pos += mr.consumed;
          const xmmReg = 'xmm' + mr.regIdx;
          const isStore = op2 === 0x29 || op2 === 0x11 || op2 === 0x7F;
          mnemonic = names[op2];
          if (isStore)
            operands = mr.rm + ', ' + xmmReg;
          else
            operands = xmmReg + ', ' + mr.rm;
          pseudoC = '/* ' + mnemonic + ' */';
          decoded = true;
        }
      }

      // ---- XORPS/PXOR — common for zeroing SSE regs ----
      if (!decoded && opcode === 0x0F && pos < end) {
        const op2 = readU8(bytes, pos);
        if (op2 === 0x57 || op2 === 0xEF) { // XORPS = 0x57, PXOR = 0xEF
          ++pos;
          const mr = decodeModRM(bytes, pos, is64Mode, 4, addrSize, rexR, rexX, rexB, hasRex);
          pos += mr.consumed;
          const xmmR = 'xmm' + mr.regIdx;
          mnemonic = op2 === 0x57 ? 'xorps' : 'pxor';
          operands = xmmR + ', ' + (mr.mod === 3 ? 'xmm' + mr.rmIdx : mr.rm);
          if (mr.mod === 3 && mr.regIdx === mr.rmIdx)
            pseudoC = xmmR + ' = 0';
          else
            pseudoC = '/* ' + mnemonic + ' */';
          decoded = true;
        }
      }

      // ---- Unrecognized — emit db ----
      if (!decoded) {
        // Reset pos to just after the original opcode byte (prefixes were already consumed)
        pos = startPos + 1;
        // But include any prefixes as part of this single unknown byte span
        // We'll just emit the first byte after prefixes as unknown
        const unknownByte = bytes[startPos];
        mnemonic = 'db';
        operands = hex8(unknownByte);
        pseudoC = '';
        pos = startPos + 1;
      }

      const length = pos - startPos;
      const instrBytes = Array.from(bytes.slice(startPos, pos));
      results.push({ offset: startPos, length, bytes: instrBytes, mnemonic, operands, pseudoC });
    }

    return results;
  }

  // =========================================================================
  // Public registration
  // =========================================================================

  D.registerDisassembler('x86', function(bytes, offset, count) {
    return decodeX86(bytes, offset, count, false);
  });

  D.registerDisassembler('x64', function(bytes, offset, count) {
    return decodeX86(bytes, offset, count, true);
  });

})();
