;(function() {
  'use strict';
  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // Motorola 68000 disassembler -- 16/32-bit CISC, big-endian, variable length
  // =========================================================================

  const DR = ['D0','D1','D2','D3','D4','D5','D6','D7'];
  const AR = ['A0','A1','A2','A3','A4','A5','A6','A7'];

  const CC_NAMES = [
    'T','F','HI','LS','CC','CS','NE','EQ',
    'VC','VS','PL','MI','GE','LT','GT','LE'
  ];

  const CC_PSEUDO = [
    'true','false','!C && !Z','C || Z','!C','C','!Z','Z',
    '!V','V','!N','N','N == V','N != V','!Z && N == V','Z || N != V'
  ];

  const SIZE_NAMES = ['.B','.W','.L'];
  const SIZE_BYTES = [1, 2, 4];
  const SIZE_SUFFIX = ['b','w','l'];

  // ---- helpers ----

  function readU16BE(bytes, off) {
    if (off + 1 >= bytes.length) return 0;
    return ((bytes[off] << 8) | bytes[off + 1]) >>> 0;
  }

  function readU32BE(bytes, off) {
    if (off + 3 >= bytes.length) return 0;
    return ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
  }

  function signExtend8(v) {
    return (v & 0x80) ? (v | 0xFFFFFF00) | 0 : v & 0xFF;
  }

  function signExtend16(v) {
    return (v & 0x8000) ? (v | 0xFFFF0000) | 0 : v & 0xFFFF;
  }

  function hex(v) {
    if (v < 0)
      return '-$' + ((-v) >>> 0).toString(16).toUpperCase();
    return '$' + (v >>> 0).toString(16).toUpperCase();
  }

  function hexAddr(v) {
    return '$' + (v >>> 0).toString(16).toUpperCase();
  }

  function hexImm(v) {
    return '#$' + (v >>> 0).toString(16).toUpperCase();
  }

  function hexC(v) {
    return '0x' + (v >>> 0).toString(16).toUpperCase();
  }

  function formatBytes(bytes, off, len) {
    let s = '';
    for (let i = 0; i < len && off + i < bytes.length; ++i) {
      if (i) s += ' ';
      s += bytes[off + i].toString(16).toUpperCase().padStart(2, '0');
    }
    return s;
  }

  // ---- effective address decoder ----

  /**
   * Decode a 68000 effective address.
   * @param {Uint8Array} bytes
   * @param {number} pos - position of the first extension word (after the opcode word)
   * @param {number} mode - 3-bit mode field
   * @param {number} reg - 3-bit register field
   * @param {number} size - 0=byte, 1=word, 2=long
   * @param {number} pc - current PC value (address of the operation word)
   * @returns {{ text:string, pseudoC:string, length:number }}
   */
  function decodeEA(bytes, pos, mode, reg, size, pc) {
    switch (mode) {
      case 0: // Dn
        return { text: DR[reg], pseudoC: DR[reg], length: 0 };

      case 1: // An
        return { text: AR[reg], pseudoC: AR[reg], length: 0 };

      case 2: // (An)
        return { text: '(' + AR[reg] + ')', pseudoC: '*' + AR[reg], length: 0 };

      case 3: // (An)+
        return { text: '(' + AR[reg] + ')+', pseudoC: '*' + AR[reg] + '++', length: 0 };

      case 4: // -(An)
        return { text: '-(' + AR[reg] + ')', pseudoC: '*--' + AR[reg], length: 0 };

      case 5: { // d16(An)
        const d16 = signExtend16(readU16BE(bytes, pos));
        const dispStr = d16 === 0 ? '(' + AR[reg] + ')' : d16 + '(' + AR[reg] + ')';
        return { text: dispStr, pseudoC: '*(' + AR[reg] + ' + ' + d16 + ')', length: 2 };
      }

      case 6: { // d8(An,Xn)
        const ext = readU16BE(bytes, pos);
        const d8 = signExtend8(ext & 0xFF);
        const xnReg = (ext >> 12) & 7;
        const xnIsAddr = (ext >> 15) & 1;
        const xnSize = (ext >> 11) & 1; // 0=word, 1=long
        const xn = xnIsAddr ? AR[xnReg] : DR[xnReg];
        const xnSuf = xnSize ? '.L' : '.W';
        return {
          text: d8 + '(' + AR[reg] + ',' + xn + xnSuf + ')',
          pseudoC: '*(' + AR[reg] + ' + ' + xn + ' + ' + d8 + ')',
          length: 2
        };
      }

      case 7:
        switch (reg) {
          case 0: { // addr.W (absolute short)
            const addr = signExtend16(readU16BE(bytes, pos));
            return { text: hexAddr(addr & 0xFFFFFFFF) + '.W', pseudoC: '*' + hexC(addr & 0xFFFFFFFF), length: 2 };
          }
          case 1: { // addr.L (absolute long)
            const addr = readU32BE(bytes, pos);
            return { text: hexAddr(addr) + '.L', pseudoC: '*' + hexC(addr), length: 4 };
          }
          case 2: { // d16(PC)
            const d16 = signExtend16(readU16BE(bytes, pos));
            const target = (pc + 2 + d16) >>> 0;
            return { text: hexAddr(target) + '(PC)', pseudoC: '*' + hexC(target), length: 2 };
          }
          case 3: { // d8(PC,Xn)
            const ext = readU16BE(bytes, pos);
            const d8 = signExtend8(ext & 0xFF);
            const xnReg = (ext >> 12) & 7;
            const xnIsAddr = (ext >> 15) & 1;
            const xnSize = (ext >> 11) & 1;
            const xn = xnIsAddr ? AR[xnReg] : DR[xnReg];
            const xnSuf = xnSize ? '.L' : '.W';
            const target = (pc + 2 + d8) >>> 0;
            return {
              text: hexAddr(target) + '(PC,' + xn + xnSuf + ')',
              pseudoC: '*(' + hexC(target) + ' + ' + xn + ')',
              length: 2
            };
          }
          case 4: { // #imm
            if (size === 0) { // byte: stored in low byte of word
              const imm = readU16BE(bytes, pos) & 0xFF;
              return { text: hexImm(imm), pseudoC: hexC(imm), length: 2 };
            }
            if (size === 1) { // word
              const imm = readU16BE(bytes, pos);
              return { text: hexImm(imm), pseudoC: hexC(imm), length: 2 };
            }
            // long
            const imm = readU32BE(bytes, pos);
            return { text: hexImm(imm), pseudoC: hexC(imm), length: 4 };
          }
          default:
            return { text: '???', pseudoC: '???', length: 0 };
        }

      default:
        return { text: '???', pseudoC: '???', length: 0 };
    }
  }

  // ---- MOVEM register list decoder ----

  function decodeRegList(mask, reversed) {
    const names = [];
    for (let i = 0; i < 16; ++i) {
      const bit = reversed ? (15 - i) : i;
      if (mask & (1 << bit)) {
        const regName = i < 8 ? DR[i] : AR[i - 8];
        // Try to form ranges
        let end = i;
        while (end + 1 < 16 && (mask & (1 << (reversed ? (15 - (end + 1)) : (end + 1))))) ++end;
        if (end > i + 1) {
          const endName = end < 8 ? DR[end] : AR[end - 8];
          names.push(regName + '-' + endName);
          i = end;
        } else if (end === i + 1) {
          const endName = end < 8 ? DR[end] : AR[end - 8];
          names.push(regName + '-' + endName);
          i = end;
        } else
          names.push(regName);
      }
    }
    return names.join('/');
  }

  // ---- size suffix pseudoC ----

  function pSuffix(size) {
    return size === 0 ? '.b' : size === 1 ? '.w' : '';
  }

  function pTarget(ea, size) {
    const suf = pSuffix(size);
    return suf ? ea + suf : ea;
  }

  // ---- main single-instruction decoder ----

  function decodeOne(bytes, pos, baseAddr) {
    const startPos = pos;
    const addr = baseAddr + pos;

    if (pos + 1 >= bytes.length)
      return { length: 0, mnemonic: 'db', operands: '???', pseudoC: '/* end */' };

    const opWord = readU16BE(bytes, pos);
    pos += 2;

    const top4 = (opWord >> 12) & 0xF;

    // ====================================================================
    // 0000: Immediate ALU, bit ops, MOVEP
    // ====================================================================
    if (top4 === 0) {
      const bits11_8 = (opWord >> 8) & 0xF;

      // ORI/ANDI/SUBI/ADDI/EORI/CMPI to EA (bits 11-8 == 0xxx0)
      // Format: 0000 iii0 ssxx xyyy  where iii selects op, ss = size
      if ((opWord & 0x0100) === 0 && bits11_8 !== 8) {
        const opSel = (opWord >> 9) & 7;
        const sizeField = (opWord >> 6) & 3;
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;

        // Check for ORI/ANDI/EORI to CCR/SR
        if (sizeField <= 2) {
          const immSize = sizeField === 0 ? 0 : sizeField === 1 ? 1 : 2;
          let immLen, immVal;
          if (immSize === 2) {
            immVal = readU32BE(bytes, pos);
            immLen = 4;
          } else {
            immVal = readU16BE(bytes, pos);
            if (immSize === 0) immVal &= 0xFF;
            immLen = 2;
          }

          const aluNames = ['ORI','ANDI','SUBI','ADDI',null,'EORI','CMPI',null];
          const aluOps = ['|','&','-','+',null,'^','-',null];
          const name = aluNames[opSel];

          if (name) {
            pos += immLen;

            // Special: to CCR (mode=7,reg=4 and size=byte) or to SR (size=word)
            if (eaMode === 7 && eaReg === 4) {
              if (sizeField === 0) {
                return {
                  length: pos - startPos,
                  mnemonic: name,
                  operands: hexImm(immVal) + ',CCR',
                  pseudoC: 'CCR ' + aluOps[opSel] + '= ' + hexC(immVal)
                };
              }
              if (sizeField === 1) {
                return {
                  length: pos - startPos,
                  mnemonic: name,
                  operands: hexImm(immVal) + ',SR',
                  pseudoC: 'SR ' + aluOps[opSel] + '= ' + hexC(immVal)
                };
              }
            }

            const ea = decodeEA(bytes, pos, eaMode, eaReg, immSize, addr);
            pos += ea.length;

            const sizeSuf = SIZE_NAMES[sizeField];

            if (opSel === 6) // CMPI
              return {
                length: pos - startPos,
                mnemonic: name + sizeSuf,
                operands: hexImm(immVal) + ',' + ea.text,
                pseudoC: 'flags = ' + pTarget(ea.pseudoC, sizeField) + ' - ' + hexC(immVal)
              };

            return {
              length: pos - startPos,
              mnemonic: name + sizeSuf,
              operands: hexImm(immVal) + ',' + ea.text,
              pseudoC: pTarget(ea.pseudoC, sizeField) + ' ' + aluOps[opSel] + '= ' + hexC(immVal)
            };
          }
        }
      }

      // BTST/BCHG/BCLR/BSET dynamic (register)
      // 0000 rrr1 00xx xyyy (BTST), 01 (BCHG), 10 (BCLR), 11 (BSET)
      if (opWord & 0x0100) {
        const bitReg = (opWord >> 9) & 7;
        const bitOp = (opWord >> 6) & 3;
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;

        // Exclude MOVEP: eaMode == 001
        if (eaMode !== 1) {
          const bitOpNames = ['BTST','BCHG','BCLR','BSET'];
          const sz = eaMode === 0 ? 2 : 0; // long for Dn, byte for memory
          const ea = decodeEA(bytes, pos, eaMode, eaReg, sz, addr);
          pos += ea.length;

          const pseudoOps = [
            'flags = bit(' + ea.pseudoC + ', ' + DR[bitReg] + ')',
            ea.pseudoC + ' ^= (1 << ' + DR[bitReg] + ')',
            ea.pseudoC + ' &= ~(1 << ' + DR[bitReg] + ')',
            ea.pseudoC + ' |= (1 << ' + DR[bitReg] + ')'
          ];

          return {
            length: pos - startPos,
            mnemonic: bitOpNames[bitOp],
            operands: DR[bitReg] + ',' + ea.text,
            pseudoC: pseudoOps[bitOp]
          };
        }

        // MOVEP
        if (eaMode === 1) {
          const dir = (opWord >> 7) & 1; // 0=reg<-mem, 1=reg->mem
          const sz = (opWord >> 6) & 1; // 0=word, 1=long
          const d16 = signExtend16(readU16BE(bytes, pos));
          pos += 2;
          const sizeSuf = sz ? '.L' : '.W';
          if (dir)
            return {
              length: pos - startPos,
              mnemonic: 'MOVEP' + sizeSuf,
              operands: DR[bitReg] + ',' + d16 + '(' + AR[eaReg] + ')',
              pseudoC: 'movep ' + DR[bitReg] + ' -> *(' + AR[eaReg] + ' + ' + d16 + ')'
            };
          return {
            length: pos - startPos,
            mnemonic: 'MOVEP' + sizeSuf,
            operands: d16 + '(' + AR[eaReg] + '),' + DR[bitReg],
            pseudoC: DR[bitReg] + ' = movep(*(' + AR[eaReg] + ' + ' + d16 + '))'
          };
        }
      }

      // BTST/BCHG/BCLR/BSET static (immediate bit number)
      // 0000 1000 00xx xyyy (BTST), 01 (BCHG), 10 (BCLR), 11 (BSET)
      if ((opWord & 0x0F00) === 0x0800) {
        const bitOp = (opWord >> 6) & 3;
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const bitNum = readU16BE(bytes, pos) & 0xFF;
        pos += 2;

        const bitOpNames = ['BTST','BCHG','BCLR','BSET'];
        const sz = eaMode === 0 ? 2 : 0;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, sz, addr);
        pos += ea.length;

        const pseudoOps = [
          'flags = bit(' + ea.pseudoC + ', ' + bitNum + ')',
          ea.pseudoC + ' ^= (1 << ' + bitNum + ')',
          ea.pseudoC + ' &= ~(1 << ' + bitNum + ')',
          ea.pseudoC + ' |= (1 << ' + bitNum + ')'
        ];

        return {
          length: pos - startPos,
          mnemonic: bitOpNames[bitOp],
          operands: '#' + bitNum + ',' + ea.text,
          pseudoC: pseudoOps[bitOp]
        };
      }
    }

    // ====================================================================
    // 0001/0010/0011: MOVE / MOVEA
    // ====================================================================
    if (top4 >= 1 && top4 <= 3) {
      const sizeMap = { 1: 0, 3: 1, 2: 2 }; // top4 -> size index (B/W/L)
      const size = sizeMap[top4];
      const srcMode = (opWord >> 3) & 7;
      const srcReg = opWord & 7;
      const dstReg = (opWord >> 9) & 7;
      const dstMode = (opWord >> 6) & 7;

      const src = decodeEA(bytes, pos, srcMode, srcReg, size, addr);
      pos += src.length;
      const dst = decodeEA(bytes, pos, dstMode, dstReg, size, addr);
      pos += dst.length;

      const sizeSuf = SIZE_NAMES[size];

      // MOVEA: dest is An
      if (dstMode === 1)
        return {
          length: pos - startPos,
          mnemonic: 'MOVEA' + sizeSuf,
          operands: src.text + ',' + AR[dstReg],
          pseudoC: AR[dstReg] + ' = ' + src.pseudoC
        };

      return {
        length: pos - startPos,
        mnemonic: 'MOVE' + sizeSuf,
        operands: src.text + ',' + dst.text,
        pseudoC: pTarget(dst.pseudoC, size) + ' = ' + src.pseudoC
      };
    }

    // ====================================================================
    // 0100: Miscellaneous
    // ====================================================================
    if (top4 === 4) {

      // LEA: 0100 rrr1 11xx xyyy
      if ((opWord & 0x01C0) === 0x01C0) {
        const aReg = (opWord >> 9) & 7;
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 2, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'LEA',
          operands: ea.text + ',' + AR[aReg],
          pseudoC: AR[aReg] + ' = ' + ea.pseudoC.replace(/^\*/, '')
        };
      }

      // CHK: 0100 rrr1 10xx xyyy
      if ((opWord & 0x01C0) === 0x0180) {
        const dReg = (opWord >> 9) & 7;
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'CHK',
          operands: ea.text + ',' + DR[dReg],
          pseudoC: 'if (' + DR[dReg] + ' < 0 || ' + DR[dReg] + ' > ' + ea.pseudoC + ') trap(6)'
        };
      }

      // NOP: 0100 1110 0111 0001
      if (opWord === 0x4E71)
        return { length: 2, mnemonic: 'NOP', operands: '', pseudoC: '' };

      // RESET: 0100 1110 0111 0000
      if (opWord === 0x4E70)
        return { length: 2, mnemonic: 'RESET', operands: '', pseudoC: 'reset()' };

      // RTE: 0100 1110 0111 0011
      if (opWord === 0x4E73)
        return { length: 2, mnemonic: 'RTE', operands: '', pseudoC: 'return_from_exception' };

      // RTS: 0100 1110 0111 0101
      if (opWord === 0x4E75)
        return { length: 2, mnemonic: 'RTS', operands: '', pseudoC: 'return' };

      // TRAPV: 0100 1110 0111 0110
      if (opWord === 0x4E76)
        return { length: 2, mnemonic: 'TRAPV', operands: '', pseudoC: 'if (V) trap(7)' };

      // RTR: 0100 1110 0111 0111
      if (opWord === 0x4E77)
        return { length: 2, mnemonic: 'RTR', operands: '', pseudoC: 'CCR = pop(); return' };

      // STOP: 0100 1110 0111 0010
      if (opWord === 0x4E72) {
        const imm = readU16BE(bytes, pos);
        pos += 2;
        return { length: pos - startPos, mnemonic: 'STOP', operands: hexImm(imm), pseudoC: 'SR = ' + hexC(imm) + '; stop()' };
      }

      // TRAP: 0100 1110 0100 vvvv
      if ((opWord & 0xFFF0) === 0x4E40) {
        const vector = opWord & 0xF;
        return { length: 2, mnemonic: 'TRAP', operands: '#' + vector, pseudoC: 'trap(' + vector + ')' };
      }

      // LINK: 0100 1110 0101 0rrr
      if ((opWord & 0xFFF8) === 0x4E50) {
        const aReg = opWord & 7;
        const disp = signExtend16(readU16BE(bytes, pos));
        pos += 2;
        return {
          length: pos - startPos,
          mnemonic: 'LINK',
          operands: AR[aReg] + ',#' + disp,
          pseudoC: 'push(' + AR[aReg] + '); ' + AR[aReg] + ' = SP; SP += ' + disp
        };
      }

      // UNLK: 0100 1110 0101 1rrr
      if ((opWord & 0xFFF8) === 0x4E58) {
        const aReg = opWord & 7;
        return {
          length: 2,
          mnemonic: 'UNLK',
          operands: AR[aReg],
          pseudoC: 'SP = ' + AR[aReg] + '; ' + AR[aReg] + ' = pop()'
        };
      }

      // MOVE USP: 0100 1110 0110 drrr  d=direction
      if ((opWord & 0xFFF0) === 0x4E60) {
        const dir = (opWord >> 3) & 1;
        const aReg = opWord & 7;
        if (dir)
          return { length: 2, mnemonic: 'MOVE', operands: 'USP,' + AR[aReg], pseudoC: AR[aReg] + ' = USP' };
        return { length: 2, mnemonic: 'MOVE', operands: AR[aReg] + ',USP', pseudoC: 'USP = ' + AR[aReg] };
      }

      // JSR: 0100 1110 10xx xyyy
      if ((opWord & 0xFFC0) === 0x4E80) {
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 2, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'JSR',
          operands: ea.text,
          pseudoC: 'call ' + ea.pseudoC.replace(/^\*/, '')
        };
      }

      // JMP: 0100 1110 11xx xyyy
      if ((opWord & 0xFFC0) === 0x4EC0) {
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 2, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'JMP',
          operands: ea.text,
          pseudoC: 'goto ' + ea.pseudoC.replace(/^\*/, '')
        };
      }

      // PEA: 0100 1000 01xx xyyy
      if ((opWord & 0xFFC0) === 0x4840) {
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 2, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'PEA',
          operands: ea.text,
          pseudoC: 'push(&' + ea.pseudoC.replace(/^\*/, '') + ')'
        };
      }

      // SWAP: 0100 1000 0100 0rrr
      if ((opWord & 0xFFF8) === 0x4840) {
        const reg = opWord & 7;
        return { length: 2, mnemonic: 'SWAP', operands: DR[reg], pseudoC: DR[reg] + ' = swap16(' + DR[reg] + ')' };
      }

      // EXT.W: 0100 1000 1000 0rrr
      if ((opWord & 0xFFF8) === 0x4880) {
        const reg = opWord & 7;
        return { length: 2, mnemonic: 'EXT.W', operands: DR[reg], pseudoC: DR[reg] + '.w = sign_extend(' + DR[reg] + '.b)' };
      }

      // EXT.L: 0100 1000 1100 0rrr
      if ((opWord & 0xFFF8) === 0x48C0) {
        const reg = opWord & 7;
        return { length: 2, mnemonic: 'EXT.L', operands: DR[reg], pseudoC: DR[reg] + ' = sign_extend(' + DR[reg] + '.w)' };
      }

      // MOVEM register to memory: 0100 1000 1xxx xyyy (size bit 6)
      if ((opWord & 0xFB80) === 0x4880 && ((opWord >> 3) & 7) !== 0) {
        const sz = (opWord >> 6) & 1; // 0=word, 1=long
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const mask = readU16BE(bytes, pos);
        pos += 2;
        const reversed = eaMode === 4; // predecrement reverses mask
        const regList = decodeRegList(mask, reversed);
        const sizeSuf = sz ? '.L' : '.W';
        const ea = decodeEA(bytes, pos, eaMode, eaReg, sz ? 2 : 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'MOVEM' + sizeSuf,
          operands: regList + ',' + ea.text,
          pseudoC: 'push ' + regList
        };
      }

      // MOVEM memory to register: 0100 1100 1xxx xyyy (size bit 6)
      if ((opWord & 0xFB80) === 0x4C80) {
        const sz = (opWord >> 6) & 1;
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const mask = readU16BE(bytes, pos);
        pos += 2;
        const regList = decodeRegList(mask, false);
        const sizeSuf = sz ? '.L' : '.W';
        const ea = decodeEA(bytes, pos, eaMode, eaReg, sz ? 2 : 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'MOVEM' + sizeSuf,
          operands: ea.text + ',' + regList,
          pseudoC: 'pop ' + regList
        };
      }

      // CLR: 0100 0010 ssxx xyyy
      if ((opWord & 0xFF00) === 0x4200) {
        const sizeField = (opWord >> 6) & 3;
        if (sizeField <= 2) {
          const eaMode = (opWord >> 3) & 7;
          const eaReg = opWord & 7;
          const ea = decodeEA(bytes, pos, eaMode, eaReg, sizeField, addr);
          pos += ea.length;
          return {
            length: pos - startPos,
            mnemonic: 'CLR' + SIZE_NAMES[sizeField],
            operands: ea.text,
            pseudoC: pTarget(ea.pseudoC, sizeField) + ' = 0'
          };
        }
      }

      // NEG: 0100 0100 ssxx xyyy
      if ((opWord & 0xFF00) === 0x4400) {
        const sizeField = (opWord >> 6) & 3;
        if (sizeField <= 2) {
          const eaMode = (opWord >> 3) & 7;
          const eaReg = opWord & 7;
          const ea = decodeEA(bytes, pos, eaMode, eaReg, sizeField, addr);
          pos += ea.length;
          return {
            length: pos - startPos,
            mnemonic: 'NEG' + SIZE_NAMES[sizeField],
            operands: ea.text,
            pseudoC: pTarget(ea.pseudoC, sizeField) + ' = -' + ea.pseudoC
          };
        }
      }

      // NEGX: 0100 0000 ssxx xyyy
      if ((opWord & 0xFF00) === 0x4000) {
        const sizeField = (opWord >> 6) & 3;
        if (sizeField <= 2) {
          const eaMode = (opWord >> 3) & 7;
          const eaReg = opWord & 7;
          const ea = decodeEA(bytes, pos, eaMode, eaReg, sizeField, addr);
          pos += ea.length;
          return {
            length: pos - startPos,
            mnemonic: 'NEGX' + SIZE_NAMES[sizeField],
            operands: ea.text,
            pseudoC: pTarget(ea.pseudoC, sizeField) + ' = -' + ea.pseudoC + ' - X'
          };
        }
      }

      // NOT: 0100 0110 ssxx xyyy
      if ((opWord & 0xFF00) === 0x4600) {
        const sizeField = (opWord >> 6) & 3;
        if (sizeField <= 2) {
          const eaMode = (opWord >> 3) & 7;
          const eaReg = opWord & 7;
          const ea = decodeEA(bytes, pos, eaMode, eaReg, sizeField, addr);
          pos += ea.length;
          return {
            length: pos - startPos,
            mnemonic: 'NOT' + SIZE_NAMES[sizeField],
            operands: ea.text,
            pseudoC: pTarget(ea.pseudoC, sizeField) + ' = ~' + ea.pseudoC
          };
        }
      }

      // NBCD: 0100 1000 00xx xyyy
      if ((opWord & 0xFFC0) === 0x4800) {
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 0, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'NBCD',
          operands: ea.text,
          pseudoC: ea.pseudoC + ' = 0 - ' + ea.pseudoC + ' - X (BCD)'
        };
      }

      // TST: 0100 1010 ssxx xyyy
      if ((opWord & 0xFF00) === 0x4A00) {
        const sizeField = (opWord >> 6) & 3;
        if (sizeField <= 2) {
          const eaMode = (opWord >> 3) & 7;
          const eaReg = opWord & 7;
          const ea = decodeEA(bytes, pos, eaMode, eaReg, sizeField, addr);
          pos += ea.length;
          return {
            length: pos - startPos,
            mnemonic: 'TST' + SIZE_NAMES[sizeField],
            operands: ea.text,
            pseudoC: 'flags = ' + pTarget(ea.pseudoC, sizeField)
          };
        }
      }

      // TAS: 0100 1010 11xx xyyy
      if ((opWord & 0xFFC0) === 0x4AC0) {
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 0, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'TAS',
          operands: ea.text,
          pseudoC: 'flags = ' + ea.pseudoC + '.b; ' + ea.pseudoC + ' |= 0x80'
        };
      }

      // MOVE from SR: 0100 0000 11xx xyyy
      if ((opWord & 0xFFC0) === 0x40C0) {
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'MOVE',
          operands: 'SR,' + ea.text,
          pseudoC: ea.pseudoC + '.w = SR'
        };
      }

      // MOVE to CCR: 0100 0100 11xx xyyy
      if ((opWord & 0xFFC0) === 0x44C0) {
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'MOVE',
          operands: ea.text + ',CCR',
          pseudoC: 'CCR = ' + ea.pseudoC + '.w'
        };
      }

      // MOVE to SR: 0100 0110 11xx xyyy
      if ((opWord & 0xFFC0) === 0x46C0) {
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'MOVE',
          operands: ea.text + ',SR',
          pseudoC: 'SR = ' + ea.pseudoC + '.w'
        };
      }
    }

    // ====================================================================
    // 0101: ADDQ / SUBQ / Scc / DBcc
    // ====================================================================
    if (top4 === 5) {
      const sizeField = (opWord >> 6) & 3;
      const eaMode = (opWord >> 3) & 7;
      const eaReg = opWord & 7;

      // Scc: 0101 cccc 11xx xyyy
      if (sizeField === 3) {
        const cond = (opWord >> 8) & 0xF;

        // DBcc: eaMode == 001
        if (eaMode === 1) {
          const dReg = eaReg;
          const disp = signExtend16(readU16BE(bytes, pos));
          pos += 2;
          const target = (addr + 2 + disp) >>> 0;
          return {
            length: pos - startPos,
            mnemonic: 'DB' + CC_NAMES[cond],
            operands: DR[dReg] + ',' + hexAddr(target),
            pseudoC: 'if (!(' + CC_PSEUDO[cond] + ')) { --' + DR[dReg] + '; if (' + DR[dReg] + ' != -1) goto ' + hexC(target) + ' }'
          };
        }

        const ea = decodeEA(bytes, pos, eaMode, eaReg, 0, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'S' + CC_NAMES[cond],
          operands: ea.text,
          pseudoC: ea.pseudoC + '.b = (' + CC_PSEUDO[cond] + ') ? 0xFF : 0'
        };
      }

      // ADDQ/SUBQ: 0101 ddd0 ssxx xyyy / 0101 ddd1 ssxx xyyy
      if (sizeField <= 2) {
        const data3 = (opWord >> 9) & 7;
        const imm = data3 === 0 ? 8 : data3;
        const isSub = (opWord >> 8) & 1;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, sizeField, addr);
        pos += ea.length;
        const mnemonic = isSub ? 'SUBQ' : 'ADDQ';
        const op = isSub ? '-' : '+';
        return {
          length: pos - startPos,
          mnemonic: mnemonic + SIZE_NAMES[sizeField],
          operands: '#' + imm + ',' + ea.text,
          pseudoC: pTarget(ea.pseudoC, sizeField) + ' ' + op + '= ' + imm
        };
      }
    }

    // ====================================================================
    // 0110: Bcc / BRA / BSR
    // ====================================================================
    if (top4 === 6) {
      const cond = (opWord >> 8) & 0xF;
      let disp = signExtend8(opWord & 0xFF);
      let extraLen = 0;

      if (disp === 0) {
        // 16-bit displacement
        disp = signExtend16(readU16BE(bytes, pos));
        pos += 2;
        extraLen = 2;
      } else if (disp === -1) {
        // 32-bit displacement (68020+) - treat as word for 68000
        disp = signExtend16(readU16BE(bytes, pos));
        pos += 2;
        extraLen = 2;
      }

      const target = (addr + 2 + disp) >>> 0;

      if (cond === 0) // BRA (always)
        return {
          length: 2 + extraLen,
          mnemonic: 'BRA',
          operands: hexAddr(target),
          pseudoC: 'goto ' + hexC(target)
        };

      if (cond === 1) // BSR
        return {
          length: 2 + extraLen,
          mnemonic: 'BSR',
          operands: hexAddr(target),
          pseudoC: 'call ' + hexC(target)
        };

      return {
        length: 2 + extraLen,
        mnemonic: 'B' + CC_NAMES[cond],
        operands: hexAddr(target),
        pseudoC: 'if (' + CC_PSEUDO[cond] + ') goto ' + hexC(target)
      };
    }

    // ====================================================================
    // 0111: MOVEQ
    // ====================================================================
    if (top4 === 7) {
      const reg = (opWord >> 9) & 7;
      const data = signExtend8(opWord & 0xFF);
      return {
        length: 2,
        mnemonic: 'MOVEQ',
        operands: '#' + data + ',' + DR[reg],
        pseudoC: DR[reg] + ' = ' + data
      };
    }

    // ====================================================================
    // 1000: OR / DIVU / DIVS / SBCD
    // ====================================================================
    if (top4 === 8) {
      const reg = (opWord >> 9) & 7;
      const opMode = (opWord >> 6) & 7;
      const eaMode = (opWord >> 3) & 7;
      const eaReg = opWord & 7;

      // SBCD: 1000 rrr1 0000 xyyy
      if (opMode === 4 && ((opWord & 0x0030) === 0x0000 || (opWord & 0x0030) === 0x0008)) {
        // Not fully decoded here -- fallthrough to generic
      }

      // DIVU: 1000 rrr0 11xx xyyy
      if (opMode === 3) {
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'DIVU',
          operands: ea.text + ',' + DR[reg],
          pseudoC: DR[reg] + ' = ' + DR[reg] + ' / ' + ea.pseudoC + ' (unsigned)'
        };
      }

      // DIVS: 1000 rrr1 11xx xyyy
      if (opMode === 7) {
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'DIVS',
          operands: ea.text + ',' + DR[reg],
          pseudoC: DR[reg] + ' = ' + DR[reg] + ' / ' + ea.pseudoC + ' (signed)'
        };
      }

      // OR: other op modes
      if (opMode <= 2) {
        // OR <ea>,Dn
        const size = opMode;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, size, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'OR' + SIZE_NAMES[size],
          operands: ea.text + ',' + DR[reg],
          pseudoC: pTarget(DR[reg], size) + ' |= ' + ea.pseudoC
        };
      }

      if (opMode >= 4 && opMode <= 6) {
        // OR Dn,<ea>
        const size = opMode - 4;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, size, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'OR' + SIZE_NAMES[size],
          operands: DR[reg] + ',' + ea.text,
          pseudoC: pTarget(ea.pseudoC, size) + ' |= ' + DR[reg]
        };
      }
    }

    // ====================================================================
    // 1001: SUB / SUBA / SUBX
    // ====================================================================
    if (top4 === 9) {
      const reg = (opWord >> 9) & 7;
      const opMode = (opWord >> 6) & 7;
      const eaMode = (opWord >> 3) & 7;
      const eaReg = opWord & 7;

      // SUBA.W: opMode=3
      if (opMode === 3) {
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'SUBA.W',
          operands: ea.text + ',' + AR[reg],
          pseudoC: AR[reg] + ' -= ' + ea.pseudoC
        };
      }

      // SUBA.L: opMode=7
      if (opMode === 7) {
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 2, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'SUBA.L',
          operands: ea.text + ',' + AR[reg],
          pseudoC: AR[reg] + ' -= ' + ea.pseudoC
        };
      }

      // SUBX: opMode 4/5/6 with eaMode 0 or 1 (bit 3 of opword)
      if (opMode >= 4 && opMode <= 6 && (eaMode === 0 || eaMode === 1)) {
        const size = opMode - 4;
        const rm = (opWord >> 3) & 1; // 0=Dn, 1=-(An)
        if (rm)
          return {
            length: 2,
            mnemonic: 'SUBX' + SIZE_NAMES[size],
            operands: '-(' + AR[eaReg] + '),-(' + AR[reg] + ')',
            pseudoC: '*--' + AR[reg] + ' = *--' + AR[reg] + ' - *--' + AR[eaReg] + ' - X'
          };
        return {
          length: 2,
          mnemonic: 'SUBX' + SIZE_NAMES[size],
          operands: DR[eaReg] + ',' + DR[reg],
          pseudoC: DR[reg] + ' = ' + DR[reg] + ' - ' + DR[eaReg] + ' - X'
        };
      }

      // SUB <ea>,Dn (opMode 0-2)
      if (opMode <= 2) {
        const size = opMode;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, size, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'SUB' + SIZE_NAMES[size],
          operands: ea.text + ',' + DR[reg],
          pseudoC: pTarget(DR[reg], size) + ' -= ' + ea.pseudoC
        };
      }

      // SUB Dn,<ea> (opMode 4-6)
      if (opMode >= 4 && opMode <= 6) {
        const size = opMode - 4;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, size, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'SUB' + SIZE_NAMES[size],
          operands: DR[reg] + ',' + ea.text,
          pseudoC: pTarget(ea.pseudoC, size) + ' -= ' + DR[reg]
        };
      }
    }

    // ====================================================================
    // 1010: Line-A emulator trap
    // ====================================================================
    if (top4 === 0xA)
      return {
        length: 2,
        mnemonic: 'dc.w',
        operands: hexAddr(opWord),
        pseudoC: '/* Line-A trap */'
      };

    // ====================================================================
    // 1011: CMP / CMPA / CMPM / EOR
    // ====================================================================
    if (top4 === 0xB) {
      const reg = (opWord >> 9) & 7;
      const opMode = (opWord >> 6) & 7;
      const eaMode = (opWord >> 3) & 7;
      const eaReg = opWord & 7;

      // CMPA.W: opMode=3
      if (opMode === 3) {
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'CMPA.W',
          operands: ea.text + ',' + AR[reg],
          pseudoC: 'flags = ' + AR[reg] + ' - ' + ea.pseudoC
        };
      }

      // CMPA.L: opMode=7
      if (opMode === 7) {
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 2, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'CMPA.L',
          operands: ea.text + ',' + AR[reg],
          pseudoC: 'flags = ' + AR[reg] + ' - ' + ea.pseudoC
        };
      }

      // CMPM: opMode 4/5/6 and eaMode == 1  (actually bit 3)
      if (opMode >= 4 && opMode <= 6 && eaMode === 1) {
        const size = opMode - 4;
        return {
          length: 2,
          mnemonic: 'CMPM' + SIZE_NAMES[size],
          operands: '(' + AR[eaReg] + ')+,(' + AR[reg] + ')+',
          pseudoC: 'flags = *' + AR[reg] + '++ - *' + AR[eaReg] + '++'
        };
      }

      // CMP: opMode 0-2
      if (opMode <= 2) {
        const size = opMode;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, size, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'CMP' + SIZE_NAMES[size],
          operands: ea.text + ',' + DR[reg],
          pseudoC: 'flags = ' + DR[reg] + ' - ' + ea.pseudoC
        };
      }

      // EOR: opMode 4-6
      if (opMode >= 4 && opMode <= 6) {
        const size = opMode - 4;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, size, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'EOR' + SIZE_NAMES[size],
          operands: DR[reg] + ',' + ea.text,
          pseudoC: pTarget(ea.pseudoC, size) + ' ^= ' + DR[reg]
        };
      }
    }

    // ====================================================================
    // 1100: AND / MULU / MULS / ABCD / EXG
    // ====================================================================
    if (top4 === 0xC) {
      const reg = (opWord >> 9) & 7;
      const opMode = (opWord >> 6) & 7;
      const eaMode = (opWord >> 3) & 7;
      const eaReg = opWord & 7;

      // MULU: 1100 rrr0 11xx xyyy
      if (opMode === 3) {
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'MULU',
          operands: ea.text + ',' + DR[reg],
          pseudoC: DR[reg] + ' = ' + DR[reg] + ' * ' + ea.pseudoC + ' (unsigned)'
        };
      }

      // MULS: 1100 rrr1 11xx xyyy
      if (opMode === 7) {
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'MULS',
          operands: ea.text + ',' + DR[reg],
          pseudoC: DR[reg] + ' = ' + DR[reg] + ' * ' + ea.pseudoC + ' (signed)'
        };
      }

      // EXG: 1100 rrr1 01000 yyy (Dn,Dn) / 01001 (An,An) / 10001 (Dn,An)
      if ((opWord & 0xF130) === 0xC100) {
        const exgMode = (opWord >> 3) & 0x1F;
        if (exgMode === 0x08) // Dn,Dn
          return { length: 2, mnemonic: 'EXG', operands: DR[reg] + ',' + DR[eaReg], pseudoC: 'swap(' + DR[reg] + ', ' + DR[eaReg] + ')' };
        if (exgMode === 0x09) // An,An
          return { length: 2, mnemonic: 'EXG', operands: AR[reg] + ',' + AR[eaReg], pseudoC: 'swap(' + AR[reg] + ', ' + AR[eaReg] + ')' };
        if (exgMode === 0x11) // Dn,An
          return { length: 2, mnemonic: 'EXG', operands: DR[reg] + ',' + AR[eaReg], pseudoC: 'swap(' + DR[reg] + ', ' + AR[eaReg] + ')' };
      }

      // ABCD: 1100 rrr1 0000 myyy
      if ((opWord & 0xF1F0) === 0xC100) {
        const rm = (opWord >> 3) & 1;
        if (rm)
          return { length: 2, mnemonic: 'ABCD', operands: '-(' + AR[eaReg] + '),-(' + AR[reg] + ')', pseudoC: '*--' + AR[reg] + ' = bcd_add(*--' + AR[reg] + ', *--' + AR[eaReg] + ')' };
        return { length: 2, mnemonic: 'ABCD', operands: DR[eaReg] + ',' + DR[reg], pseudoC: DR[reg] + ' = bcd_add(' + DR[reg] + ', ' + DR[eaReg] + ')' };
      }

      // AND <ea>,Dn (opMode 0-2)
      if (opMode <= 2) {
        const size = opMode;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, size, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'AND' + SIZE_NAMES[size],
          operands: ea.text + ',' + DR[reg],
          pseudoC: pTarget(DR[reg], size) + ' &= ' + ea.pseudoC
        };
      }

      // AND Dn,<ea> (opMode 4-6)
      if (opMode >= 4 && opMode <= 6) {
        const size = opMode - 4;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, size, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'AND' + SIZE_NAMES[size],
          operands: DR[reg] + ',' + ea.text,
          pseudoC: pTarget(ea.pseudoC, size) + ' &= ' + DR[reg]
        };
      }
    }

    // ====================================================================
    // 1101: ADD / ADDA / ADDX
    // ====================================================================
    if (top4 === 0xD) {
      const reg = (opWord >> 9) & 7;
      const opMode = (opWord >> 6) & 7;
      const eaMode = (opWord >> 3) & 7;
      const eaReg = opWord & 7;

      // ADDA.W: opMode=3
      if (opMode === 3) {
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'ADDA.W',
          operands: ea.text + ',' + AR[reg],
          pseudoC: AR[reg] + ' += ' + ea.pseudoC
        };
      }

      // ADDA.L: opMode=7
      if (opMode === 7) {
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 2, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'ADDA.L',
          operands: ea.text + ',' + AR[reg],
          pseudoC: AR[reg] + ' += ' + ea.pseudoC
        };
      }

      // ADDX: opMode 4/5/6 with eaMode 0 or 1
      if (opMode >= 4 && opMode <= 6 && (eaMode === 0 || eaMode === 1)) {
        const size = opMode - 4;
        const rm = (opWord >> 3) & 1;
        if (rm)
          return {
            length: 2,
            mnemonic: 'ADDX' + SIZE_NAMES[size],
            operands: '-(' + AR[eaReg] + '),-(' + AR[reg] + ')',
            pseudoC: '*--' + AR[reg] + ' = *--' + AR[reg] + ' + *--' + AR[eaReg] + ' + X'
          };
        return {
          length: 2,
          mnemonic: 'ADDX' + SIZE_NAMES[size],
          operands: DR[eaReg] + ',' + DR[reg],
          pseudoC: DR[reg] + ' = ' + DR[reg] + ' + ' + DR[eaReg] + ' + X'
        };
      }

      // ADD <ea>,Dn (opMode 0-2)
      if (opMode <= 2) {
        const size = opMode;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, size, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'ADD' + SIZE_NAMES[size],
          operands: ea.text + ',' + DR[reg],
          pseudoC: pTarget(DR[reg], size) + ' += ' + ea.pseudoC
        };
      }

      // ADD Dn,<ea> (opMode 4-6)
      if (opMode >= 4 && opMode <= 6) {
        const size = opMode - 4;
        const ea = decodeEA(bytes, pos, eaMode, eaReg, size, addr);
        pos += ea.length;
        return {
          length: pos - startPos,
          mnemonic: 'ADD' + SIZE_NAMES[size],
          operands: DR[reg] + ',' + ea.text,
          pseudoC: pTarget(ea.pseudoC, size) + ' += ' + DR[reg]
        };
      }
    }

    // ====================================================================
    // 1110: Shift/Rotate
    // ====================================================================
    if (top4 === 0xE) {
      const sizeField = (opWord >> 6) & 3;

      // Memory shift/rotate: size == 3 (single bit, word-size EA)
      if (sizeField === 3) {
        const dir = (opWord >> 8) & 1; // 0=right, 1=left
        const type = (opWord >> 9) & 3; // 0=AS, 1=LS, 2=ROX, 3=RO
        const eaMode = (opWord >> 3) & 7;
        const eaReg = opWord & 7;

        const typeNames = ['AS','LS','ROX','RO'];
        const dirNames = ['R','L'];
        const ea = decodeEA(bytes, pos, eaMode, eaReg, 1, addr);
        pos += ea.length;

        const mnemonic = typeNames[type] + dirNames[dir];
        const shiftOps = dir
          ? [' <<= 1', ' <<= 1', ' = roxl(' + ea.pseudoC + ', 1)', ' = rotl(' + ea.pseudoC + ', 1)']
          : [' >>= 1', ' >>>= 1', ' = roxr(' + ea.pseudoC + ', 1)', ' = rotr(' + ea.pseudoC + ', 1)'];

        return {
          length: pos - startPos,
          mnemonic: mnemonic + '.W',
          operands: ea.text,
          pseudoC: ea.pseudoC + '.w' + shiftOps[type]
        };
      }

      // Register shift/rotate
      if (sizeField <= 2) {
        const count = (opWord >> 9) & 7;
        const dir = (opWord >> 8) & 1;
        const ir = (opWord >> 5) & 1; // 0=immediate count, 1=register count
        const type = (opWord >> 3) & 3;
        const dReg = opWord & 7;

        const typeNames = ['AS','LS','ROX','RO'];
        const dirNames = ['R','L'];
        const mnemonic = typeNames[type] + dirNames[dir] + SIZE_NAMES[sizeField];

        let countStr, countPseudo;
        if (ir) {
          countStr = DR[count];
          countPseudo = DR[count];
        } else {
          const immCount = count === 0 ? 8 : count;
          countStr = '#' + immCount;
          countPseudo = '' + immCount;
        }

        const target = pTarget(DR[dReg], sizeField);
        let pseudoC;
        if (type === 0) // arithmetic shift
          pseudoC = dir ? target + ' <<= ' + countPseudo : target + ' >>= ' + countPseudo;
        else if (type === 1) // logical shift
          pseudoC = dir ? target + ' <<= ' + countPseudo : target + ' >>>= ' + countPseudo;
        else if (type === 2) // rotate through extend
          pseudoC = target + ' = rox' + (dir ? 'l' : 'r') + '(' + DR[dReg] + ', ' + countPseudo + ')';
        else // rotate
          pseudoC = target + ' = rot' + (dir ? 'l' : 'r') + '(' + DR[dReg] + ', ' + countPseudo + ')';

        return {
          length: 2,
          mnemonic: mnemonic,
          operands: countStr + ',' + DR[dReg],
          pseudoC: pseudoC
        };
      }
    }

    // ====================================================================
    // 1111: Line-F emulator trap
    // ====================================================================
    if (top4 === 0xF)
      return {
        length: 2,
        mnemonic: 'dc.w',
        operands: hexAddr(opWord),
        pseudoC: '/* Line-F trap */'
      };

    // ====================================================================
    // Fallback: unknown opcode
    // ====================================================================
    return {
      length: 2,
      mnemonic: 'dc.w',
      operands: hexAddr(opWord),
      pseudoC: ''
    };
  }

  // ---- batch decoder ----

  function decode(bytes, baseAddress, count, opts) {
    const results = [];
    const base = baseAddress || 0;
    let pos = 0;
    const maxInstr = count || 50;
    const end = bytes.length;

    while (results.length < maxInstr && pos + 1 < end) {
      const insn = decodeOne(bytes, pos, base);

      if (!insn || insn.length <= 0) {
        // Can't decode -- emit raw word and skip 2 bytes
        results.push({
          offset: base + pos,
          length: 2,
          bytes: formatBytes(bytes, pos, 2),
          mnemonic: 'dc.w',
          operands: hexAddr(readU16BE(bytes, pos)),
          pseudoC: '/* invalid */'
        });
        pos += 2;
        continue;
      }

      results.push({
        offset: base + pos,
        length: insn.length,
        bytes: formatBytes(bytes, pos, insn.length),
        mnemonic: insn.mnemonic,
        operands: insn.operands,
        pseudoC: insn.pseudoC
      });

      pos += insn.length;
    }

    return results;
  }

  D.registerDisassembler('m68k', decode);

})();
