;(function() {
  'use strict';

  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // ARM (32-bit) Disassembler
  // =========================================================================

  const ARM_REGS = ['R0','R1','R2','R3','R4','R5','R6','R7','R8','R9','R10','R11','R12','SP','LR','PC'];

  const ARM_CONDITIONS = [
    'EQ','NE','CS','CC','MI','PL','VS','VC',
    'HI','LS','GE','LT','GT','LE','','NV'
  ];

  const ARM_DP_OPCODES = [
    'AND','EOR','SUB','RSB','ADD','ADC','SBC','RSC',
    'TST','TEQ','CMP','CMN','ORR','MOV','BIC','MVN'
  ];

  const ARM_DP_PSEUDO_OPS = {
    AND: '&', EOR: '^', SUB: '-', RSB: '-', ADD: '+', ADC: '+',
    SBC: '-', RSC: '-', ORR: '|', BIC: '& ~', TST: '&', TEQ: '^',
    CMP: '-', CMN: '+'
  };

  const ARM_SHIFT_TYPES = ['LSL','LSR','ASR','ROR'];

  function readU32LE(bytes, offset) {
    if (offset + 3 >= bytes.length) return 0;
    return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
  }

  function hexU32(v) {
    return '0x' + (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  function hex(v) {
    if (v < 0) return '-0x' + (-v).toString(16).toUpperCase();
    return '0x' + v.toString(16).toUpperCase();
  }

  function signExtend(value, bits) {
    const shift = 32 - bits;
    return (value << shift) >> shift;
  }

  function rotateRight(value, amount) {
    return ((value >>> amount) | (value << (32 - amount))) >>> 0;
  }

  function formatBytes(bytes, offset, length) {
    const arr = [];
    for (let i = 0; i < length && offset + i < bytes.length; ++i)
      arr.push(bytes[offset + i].toString(16).padStart(2, '0').toUpperCase());
    return arr.join(' ');
  }

  function decodeShiftedImm(imm12) {
    const rotate = ((imm12 >>> 8) & 0xF) * 2;
    const value = imm12 & 0xFF;
    return rotateRight(value, rotate);
  }

  function formatShiftedReg(rm, shiftType, shiftAmount, shiftReg) {
    const rmName = ARM_REGS[rm];
    if (shiftReg !== undefined)
      return rmName + ', ' + ARM_SHIFT_TYPES[shiftType] + ' ' + ARM_REGS[shiftReg];
    if (shiftAmount === 0 && shiftType === 0) return rmName;
    if (shiftAmount === 0 && shiftType === 3) return rmName + ', RRX';
    return rmName + ', ' + ARM_SHIFT_TYPES[shiftType] + ' #' + shiftAmount;
  }

  function formatRegList(mask) {
    const regs = [];
    for (let i = 0; i < 16; ++i)
      if (mask & (1 << i)) regs.push(ARM_REGS[i]);
    return '{' + regs.join(', ') + '}';
  }

  function regListPseudo(mask) {
    const regs = [];
    for (let i = 0; i < 16; ++i)
      if (mask & (1 << i)) regs.push(ARM_REGS[i].toLowerCase());
    return regs.join(', ');
  }

  function decodeARM32(bytes, baseAddress, count) {
    const results = [];
    let pc = baseAddress;

    for (let i = 0; i < count; ++i) {
      if (pc - baseAddress + 3 >= bytes.length) break;

      const offset = pc - baseAddress;
      const word = readU32LE(bytes, offset);
      const bytesStr = formatBytes(bytes, offset, 4);
      let mnemonic = '';
      let operands = '';
      let pseudoC = '';

      const cond = (word >>> 28) & 0xF;
      const condSuffix = (cond < 14) ? ARM_CONDITIONS[cond] : '';
      const condPrefix = condSuffix ? '.' + condSuffix : '';

      // Classify instruction by bits [27:25]
      const bits27_25 = (word >>> 25) & 0x7;
      const bit27 = (word >>> 27) & 1;
      const bit26 = (word >>> 26) & 1;
      const bit25 = (word >>> 25) & 1;
      const bit24 = (word >>> 24) & 1;
      const bit23 = (word >>> 23) & 1;
      const bit22 = (word >>> 22) & 1;
      const bit21 = (word >>> 21) & 1;
      const bit20 = (word >>> 20) & 1;
      const bit4 = (word >>> 4) & 1;
      const bit7 = (word >>> 7) & 1;

      let decoded = false;

      // ---- SWI / SVC ----
      if ((word & 0x0F000000) === 0x0F000000) {
        const swiNum = word & 0x00FFFFFF;
        mnemonic = 'SVC' + condSuffix;
        operands = '#' + hex(swiNum);
        pseudoC = 'syscall(' + hex(swiNum) + ')';
        decoded = true;
      }

      // ---- Branch (bits [27:25] = 101) ----
      if (!decoded && bits27_25 === 5) {
        const link = bit24;
        const imm24 = word & 0x00FFFFFF;
        const offset32 = signExtend(imm24, 24) << 2;
        const target = (pc + 8 + offset32) >>> 0;
        mnemonic = (link ? 'BL' : 'B') + condSuffix;
        operands = hex(target);
        pseudoC = link ? 'call(' + hex(target) + ')' : 'goto ' + hex(target);
        decoded = true;
      }

      // ---- Multiply (bits [27:22] = 000000, bits [7:4] = 1001) ----
      if (!decoded && (word & 0x0FC000F0) === 0x00000090) {
        const rd = (word >>> 16) & 0xF;
        const rn = (word >>> 12) & 0xF;
        const rs = (word >>> 8) & 0xF;
        const rm = word & 0xF;
        const accumulate = bit21;
        const setFlags = bit20;
        if (accumulate) {
          mnemonic = 'MLA' + condSuffix + (setFlags ? 'S' : '');
          operands = ARM_REGS[rd] + ', ' + ARM_REGS[rm] + ', ' + ARM_REGS[rs] + ', ' + ARM_REGS[rn];
          pseudoC = ARM_REGS[rd].toLowerCase() + ' = ' + ARM_REGS[rm].toLowerCase() + ' * ' + ARM_REGS[rs].toLowerCase() + ' + ' + ARM_REGS[rn].toLowerCase();
        } else {
          mnemonic = 'MUL' + condSuffix + (setFlags ? 'S' : '');
          operands = ARM_REGS[rd] + ', ' + ARM_REGS[rm] + ', ' + ARM_REGS[rs];
          pseudoC = ARM_REGS[rd].toLowerCase() + ' = ' + ARM_REGS[rm].toLowerCase() + ' * ' + ARM_REGS[rs].toLowerCase();
        }
        decoded = true;
      }

      // ---- Block Data Transfer (STM/LDM) / PUSH/POP (bits [27:25] = 100) ----
      if (!decoded && bits27_25 === 4) {
        const load = bit20;
        const writeBack = bit21;
        const psr = bit22;
        const up = bit23;
        const pre = bit24;
        const rn = (word >>> 16) & 0xF;
        const regList = word & 0xFFFF;

        // Detect PUSH/POP aliases
        if (rn === 13 && writeBack) {
          if (!load && !up && pre) {
            // STMDB SP!, {regs} = PUSH
            mnemonic = 'PUSH' + condSuffix;
            operands = formatRegList(regList);
            pseudoC = 'push(' + regListPseudo(regList) + ')';
            decoded = true;
          } else if (load && up && !pre) {
            // LDMIA SP!, {regs} = POP
            mnemonic = 'POP' + condSuffix;
            operands = formatRegList(regList);
            pseudoC = 'pop(' + regListPseudo(regList) + ')';
            decoded = true;
          }
        }

        if (!decoded) {
          const dir = up ? 'I' : 'D';
          const when = pre ? 'B' : 'A';
          mnemonic = (load ? 'LDM' : 'STM') + condSuffix + dir + when;
          operands = ARM_REGS[rn] + (writeBack ? '!' : '') + ', ' + formatRegList(regList);
          if (load)
            pseudoC = 'load_multiple(' + ARM_REGS[rn].toLowerCase() + ', ' + regListPseudo(regList) + ')';
          else
            pseudoC = 'store_multiple(' + ARM_REGS[rn].toLowerCase() + ', ' + regListPseudo(regList) + ')';
          decoded = true;
        }
      }

      // ---- Single Data Transfer LDR/STR (bits [27:26] = 01) ----
      if (!decoded && bit27 === 0 && bit26 === 1) {
        const load = bit20;
        const writeBack = bit21;
        const byteTransfer = bit22;
        const up = bit23;
        const pre = bit24;
        const immediate = !bit25;
        const rd = (word >>> 12) & 0xF;
        const rn = (word >>> 16) & 0xF;

        let offsetStr;
        let offsetVal = 0;
        if (immediate) {
          offsetVal = word & 0xFFF;
          offsetStr = '#' + (up ? '' : '-') + hex(offsetVal);
        } else {
          const rm = word & 0xF;
          const shiftType = (word >>> 5) & 0x3;
          const shiftAmount = (word >>> 7) & 0x1F;
          offsetStr = (up ? '' : '-') + formatShiftedReg(rm, shiftType, shiftAmount);
        }

        const suffix = byteTransfer ? 'B' : '';
        const signStr = up ? '+' : '-';

        if (pre) {
          mnemonic = (load ? 'LDR' : 'STR') + condSuffix + suffix;
          if (offsetVal === 0 && immediate)
            operands = ARM_REGS[rd] + ', [' + ARM_REGS[rn] + ']';
          else
            operands = ARM_REGS[rd] + ', [' + ARM_REGS[rn] + ', ' + offsetStr + ']' + (writeBack ? '!' : '');
        } else {
          mnemonic = (load ? 'LDR' : 'STR') + condSuffix + suffix + (writeBack ? 'T' : '');
          operands = ARM_REGS[rd] + ', [' + ARM_REGS[rn] + '], ' + offsetStr;
        }

        const rdLow = ARM_REGS[rd].toLowerCase();
        const rnLow = ARM_REGS[rn].toLowerCase();
        const castPrefix = byteTransfer ? '(uint8_t*)' : '';
        if (immediate) {
          const effOff = up ? offsetVal : -offsetVal;
          const offPart = effOff !== 0 ? ' ' + (effOff > 0 ? '+' : '-') + ' ' + hex(Math.abs(effOff)) : '';
          if (load)
            pseudoC = rdLow + ' = *' + castPrefix + '(' + rnLow + offPart + ')';
          else
            pseudoC = '*' + castPrefix + '(' + rnLow + offPart + ') = ' + rdLow;
        } else {
          if (load)
            pseudoC = rdLow + ' = *' + castPrefix + '(' + rnLow + ' ' + signStr + ' offset)';
          else
            pseudoC = '*' + castPrefix + '(' + rnLow + ' ' + signStr + ' offset) = ' + rdLow;
        }
        decoded = true;
      }

      // ---- Data Processing (bits [27:26] = 00) ----
      if (!decoded && bit27 === 0 && bit26 === 0) {
        // Check it's not a multiply (handled above) by checking bit pattern
        const opcode = (word >>> 21) & 0xF;
        const setFlags = bit20;
        const rn = (word >>> 16) & 0xF;
        const rd = (word >>> 12) & 0xF;
        const isImmediate = bit25;

        let op2Str;
        let op2Val = null;

        if (isImmediate) {
          const imm12 = word & 0xFFF;
          const immVal = decodeShiftedImm(imm12);
          op2Str = '#' + hex(immVal);
          op2Val = immVal;
        } else {
          const rm = word & 0xF;
          const shiftType = (word >>> 5) & 0x3;
          if (bit4) {
            const rs = (word >>> 8) & 0xF;
            op2Str = formatShiftedReg(rm, shiftType, 0, rs);
          } else {
            const shiftAmount = (word >>> 7) & 0x1F;
            op2Str = formatShiftedReg(rm, shiftType, shiftAmount);
          }
        }

        const opName = ARM_DP_OPCODES[opcode];
        const sFlag = (setFlags && opcode < 8 || opcode > 11) ? 'S' : '';

        // MOV, MVN: only Rd and operand2
        if (opcode === 13 || opcode === 15) {
          mnemonic = opName + condSuffix + sFlag;
          operands = ARM_REGS[rd] + ', ' + op2Str;
          const rdLow = ARM_REGS[rd].toLowerCase();
          if (opcode === 13)
            pseudoC = rdLow + ' = ' + (op2Val !== null ? hex(op2Val) : op2Str.toLowerCase());
          else
            pseudoC = rdLow + ' = ~' + (op2Val !== null ? hex(op2Val) : op2Str.toLowerCase());
          decoded = true;
        }
        // TST, TEQ, CMP, CMN: only Rn and operand2 (S always set)
        else if (opcode >= 8 && opcode <= 11) {
          mnemonic = opName + condSuffix;
          operands = ARM_REGS[rn] + ', ' + op2Str;
          const rnLow = ARM_REGS[rn].toLowerCase();
          const op = ARM_DP_PSEUDO_OPS[opName] || '';
          pseudoC = 'compare(' + rnLow + ', ' + (op2Val !== null ? hex(op2Val) : op2Str.toLowerCase()) + ')';
          decoded = true;
        }
        // All other data processing: Rd, Rn, operand2
        else if (!decoded) {
          mnemonic = opName + condSuffix + sFlag;
          operands = ARM_REGS[rd] + ', ' + ARM_REGS[rn] + ', ' + op2Str;
          const rdLow = ARM_REGS[rd].toLowerCase();
          const rnLow = ARM_REGS[rn].toLowerCase();
          const op = ARM_DP_PSEUDO_OPS[opName] || opName.toLowerCase();
          if (opcode === 3) // RSB: Rd = Op2 - Rn
            pseudoC = rdLow + ' = ' + (op2Val !== null ? hex(op2Val) : op2Str.toLowerCase()) + ' - ' + rnLow;
          else if (opcode === 7) // RSC
            pseudoC = rdLow + ' = ' + (op2Val !== null ? hex(op2Val) : op2Str.toLowerCase()) + ' - ' + rnLow + ' - !carry';
          else if (opcode === 5) // ADC
            pseudoC = rdLow + ' = ' + rnLow + ' + ' + (op2Val !== null ? hex(op2Val) : op2Str.toLowerCase()) + ' + carry';
          else if (opcode === 6) // SBC
            pseudoC = rdLow + ' = ' + rnLow + ' - ' + (op2Val !== null ? hex(op2Val) : op2Str.toLowerCase()) + ' - !carry';
          else if (opcode === 14) // BIC
            pseudoC = rdLow + ' = ' + rnLow + ' & ~' + (op2Val !== null ? hex(op2Val) : op2Str.toLowerCase());
          else
            pseudoC = rdLow + ' = ' + rnLow + ' ' + op + ' ' + (op2Val !== null ? hex(op2Val) : op2Str.toLowerCase());
          decoded = true;
        }
      }

      // ---- Coprocessor / undefined ----
      if (!decoded) {
        mnemonic = 'dw';
        operands = hexU32(word);
        pseudoC = '';
      }

      results.push({
        offset: pc,
        length: 4,
        bytes: bytesStr,
        mnemonic,
        operands,
        pseudoC
      });

      pc += 4;
    }

    return results;
  }

  // =========================================================================
  // ARM64 / AArch64 Disassembler
  // =========================================================================

  const A64_CONDITIONS = [
    'EQ','NE','CS','CC','MI','PL','VS','VC',
    'HI','LS','GE','LT','GT','LE','AL','NV'
  ];

  function xReg(n, sf) {
    if (n === 31) return sf ? 'XZR' : 'WZR';
    return (sf ? 'X' : 'W') + n;
  }

  function xRegOrSP(n, sf) {
    if (n === 31) return 'SP';
    return (sf ? 'X' : 'W') + n;
  }

  function decodeARM64(bytes, baseAddress, count) {
    const results = [];
    let pc = baseAddress;

    for (let i = 0; i < count; ++i) {
      if (pc - baseAddress + 3 >= bytes.length) break;

      const offset = pc - baseAddress;
      const word = readU32LE(bytes, offset);
      const bytesStr = formatBytes(bytes, offset, 4);
      let mnemonic = '';
      let operands = '';
      let pseudoC = '';
      let decoded = false;

      const op0 = (word >>> 25) & 0xF; // bits [28:25] — major opcode group

      // ---- Reserved (op0 = 0000) ----
      // ---- Unallocated ----

      // ---- PC-relative addressing: ADR/ADRP ----
      // op0 bits [28:24] = 1x000 for data processing immediate
      if (!decoded && (word & 0x1F000000) === 0x10000000) {
        const sf = (word >>> 31) & 1; // 0 = ADR, 1 = ADRP
        const immLo = (word >>> 29) & 0x3;
        const immHi = (word >>> 5) & 0x7FFFF;
        const rd = word & 0x1F;
        let imm = (immHi << 2) | immLo;
        imm = signExtend(imm, 21);
        if (sf) {
          // ADRP: imm << 12, PC page-aligned
          const target = ((pc & ~0xFFF) + (imm << 12)) >>> 0;
          mnemonic = 'ADRP';
          operands = xReg(rd, true) + ', ' + hex(target);
          pseudoC = xReg(rd, true).toLowerCase() + ' = ' + hex(target);
        } else {
          const target = (pc + imm) >>> 0;
          mnemonic = 'ADR';
          operands = xReg(rd, true) + ', ' + hex(target);
          pseudoC = xReg(rd, true).toLowerCase() + ' = ' + hex(target);
        }
        decoded = true;
      }

      // ---- Move wide immediate: MOVN/MOVZ/MOVK ----
      if (!decoded && (word & 0x1F800000) === 0x12800000) {
        // Bits [30:29] = opc, bit 31 = sf
        const sf = (word >>> 31) & 1;
        const opc = (word >>> 29) & 0x3;
        const hw = (word >>> 21) & 0x3;
        const imm16 = (word >>> 5) & 0xFFFF;
        const rd = word & 0x1F;
        const shift = hw * 16;
        const regName = xReg(rd, !!sf);

        if (opc === 0) {
          mnemonic = 'MOVN';
          operands = regName + ', #' + hex(imm16) + (shift ? ', LSL #' + shift : '');
          const val = ~(imm16 << shift) >>> 0;
          pseudoC = regName.toLowerCase() + ' = ' + hex(sf ? val : val & 0xFFFFFFFF);
        } else if (opc === 2) {
          mnemonic = 'MOVZ';
          operands = regName + ', #' + hex(imm16) + (shift ? ', LSL #' + shift : '');
          pseudoC = regName.toLowerCase() + ' = ' + hex(imm16 << shift);
        } else if (opc === 3) {
          mnemonic = 'MOVK';
          operands = regName + ', #' + hex(imm16) + (shift ? ', LSL #' + shift : '');
          pseudoC = regName.toLowerCase() + '[' + shift + ':' + (shift + 15) + '] = ' + hex(imm16);
        } else {
          mnemonic = 'dw';
          operands = hexU32(word);
        }
        decoded = true;
      }

      // ---- Add/Sub immediate ----
      // Encoding: sf|op|S|10001|sh|imm12|Rn|Rd
      if (!decoded && (word & 0x1F000000) === 0x11000000) {
        const sf = (word >>> 31) & 1;
        const op = (word >>> 30) & 1;
        const setFlags = (word >>> 29) & 1;
        const sh = (word >>> 22) & 1;
        const imm12 = (word >>> 10) & 0xFFF;
        const rn = (word >>> 5) & 0x1F;
        const rd = word & 0x1F;
        const imm = sh ? (imm12 << 12) : imm12;
        const regRd = setFlags ? xReg(rd, !!sf) : xRegOrSP(rd, !!sf);
        const regRn = xRegOrSP(rn, !!sf);

        // CMP alias: SUBS with Rd = XZR/WZR
        if (op && setFlags && rd === 31) {
          mnemonic = 'CMP';
          operands = regRn + ', #' + hex(imm);
          pseudoC = 'compare(' + regRn.toLowerCase() + ', ' + hex(imm) + ')';
        }
        // CMN alias: ADDS with Rd = XZR/WZR
        else if (!op && setFlags && rd === 31) {
          mnemonic = 'CMN';
          operands = regRn + ', #' + hex(imm);
          pseudoC = 'compare_neg(' + regRn.toLowerCase() + ', ' + hex(imm) + ')';
        }
        // MOV alias: ADD Rd, SP/Rn, #0
        else if (!op && !setFlags && imm === 0 && (rn === 31 || rd === 31)) {
          mnemonic = 'MOV';
          operands = regRd + ', ' + regRn;
          pseudoC = regRd.toLowerCase() + ' = ' + regRn.toLowerCase();
        } else {
          const opName = op ? 'SUB' : 'ADD';
          mnemonic = opName + (setFlags ? 'S' : '');
          operands = regRd + ', ' + regRn + ', #' + hex(imm);
          const oper = op ? '-' : '+';
          pseudoC = regRd.toLowerCase() + ' = ' + regRn.toLowerCase() + ' ' + oper + ' ' + hex(imm);
        }
        decoded = true;
      }

      // ---- Logical immediate ----
      // Encoding: sf|opc|100100|N|immr|imms|Rn|Rd
      if (!decoded && (word & 0x1F800000) === 0x12000000) {
        const sf = (word >>> 31) & 1;
        const opc = (word >>> 29) & 0x3;
        const n = (word >>> 22) & 1;
        const immr = (word >>> 16) & 0x3F;
        const imms = (word >>> 10) & 0x3F;
        const rn = (word >>> 5) & 0x1F;
        const rd = word & 0x1F;

        // Decode bitmask immediate (simplified -- show raw encoding)
        const regRd = (opc === 3) ? xReg(rd, !!sf) : xRegOrSP(rd, !!sf);
        const regRn = xReg(rn, !!sf);
        const immDesc = '#bitmask(N=' + n + ', immr=' + immr + ', imms=' + imms + ')';
        const opcNames = ['AND', 'ORR', 'EOR', 'ANDS'];
        const opcSymbols = ['&', '|', '^', '&'];

        // TST alias: ANDS with Rd = XZR
        if (opc === 3 && rd === 31) {
          mnemonic = 'TST';
          operands = regRn + ', ' + immDesc;
          pseudoC = 'test(' + regRn.toLowerCase() + ' & imm)';
        } else {
          mnemonic = opcNames[opc];
          operands = regRd + ', ' + regRn + ', ' + immDesc;
          pseudoC = regRd.toLowerCase() + ' = ' + regRn.toLowerCase() + ' ' + opcSymbols[opc] + ' imm';
        }
        decoded = true;
      }

      // ---- Add/Sub shifted register ----
      // Encoding: sf|op|S|01011|shift|0|Rm|imm6|Rn|Rd
      if (!decoded && (word & 0x1F200000) === 0x0B000000) {
        const sf = (word >>> 31) & 1;
        const op = (word >>> 30) & 1;
        const setFlags = (word >>> 29) & 1;
        const shift = (word >>> 22) & 0x3;
        const rm = (word >>> 16) & 0x1F;
        const imm6 = (word >>> 10) & 0x3F;
        const rn = (word >>> 5) & 0x1F;
        const rd = word & 0x1F;
        const regRd = setFlags ? xReg(rd, !!sf) : xRegOrSP(rd, !!sf);
        const regRn = xReg(rn, !!sf);
        const regRm = xReg(rm, !!sf);
        const shiftNames = ['LSL', 'LSR', 'ASR', ''];
        const shiftStr = imm6 ? ', ' + shiftNames[shift] + ' #' + imm6 : '';

        // CMP alias
        if (op && setFlags && rd === 31) {
          mnemonic = 'CMP';
          operands = regRn + ', ' + regRm + shiftStr;
          pseudoC = 'compare(' + regRn.toLowerCase() + ', ' + regRm.toLowerCase() + ')';
        }
        // CMN alias
        else if (!op && setFlags && rd === 31) {
          mnemonic = 'CMN';
          operands = regRn + ', ' + regRm + shiftStr;
          pseudoC = 'compare_neg(' + regRn.toLowerCase() + ', ' + regRm.toLowerCase() + ')';
        }
        // NEG alias: SUB Rd, XZR, Rm
        else if (op && !setFlags && rn === 31) {
          mnemonic = 'NEG';
          operands = regRd + ', ' + regRm + shiftStr;
          pseudoC = regRd.toLowerCase() + ' = -' + regRm.toLowerCase();
        }
        // MOV alias: ORR Rd, XZR, Rm (handled separately below for logical)
        else {
          const opName = op ? 'SUB' : 'ADD';
          mnemonic = opName + (setFlags ? 'S' : '');
          operands = regRd + ', ' + regRn + ', ' + regRm + shiftStr;
          const oper = op ? '-' : '+';
          pseudoC = regRd.toLowerCase() + ' = ' + regRn.toLowerCase() + ' ' + oper + ' ' + regRm.toLowerCase();
        }
        decoded = true;
      }

      // ---- Logical shifted register ----
      // Encoding: sf|opc|01010|shift|N|Rm|imm6|Rn|Rd
      if (!decoded && (word & 0x1F000000) === 0x0A000000) {
        const sf = (word >>> 31) & 1;
        const opc = (word >>> 29) & 0x3;
        const shift = (word >>> 22) & 0x3;
        const invert = (word >>> 21) & 1;
        const rm = (word >>> 16) & 0x1F;
        const imm6 = (word >>> 10) & 0x3F;
        const rn = (word >>> 5) & 0x1F;
        const rd = word & 0x1F;
        const regRd = xReg(rd, !!sf);
        const regRn = xReg(rn, !!sf);
        const regRm = xReg(rm, !!sf);
        const shiftNames = ['LSL', 'LSR', 'ASR', 'ROR'];
        const shiftStr = imm6 ? ', ' + shiftNames[shift] + ' #' + imm6 : '';

        // Lookup by opc + invert
        const opcNames = [
          ['AND', 'BIC'],   // opc=0
          ['ORR', 'ORN'],   // opc=1
          ['EOR', 'EON'],   // opc=2
          ['ANDS', 'BICS'], // opc=3
        ];
        const opcSymbols = ['&', '|', '^', '&'];
        const name = opcNames[opc][invert ? 1 : 0];

        // MOV alias: ORR Rd, XZR, Rm
        if (opc === 1 && !invert && rn === 31 && imm6 === 0 && shift === 0) {
          mnemonic = 'MOV';
          operands = regRd + ', ' + regRm;
          pseudoC = regRd.toLowerCase() + ' = ' + regRm.toLowerCase();
        }
        // MVN alias: ORN Rd, XZR, Rm
        else if (opc === 1 && invert && rn === 31 && imm6 === 0 && shift === 0) {
          mnemonic = 'MVN';
          operands = regRd + ', ' + regRm;
          pseudoC = regRd.toLowerCase() + ' = ~' + regRm.toLowerCase();
        }
        // TST alias: ANDS Rd=XZR, Rn, Rm
        else if (opc === 3 && !invert && rd === 31) {
          mnemonic = 'TST';
          operands = regRn + ', ' + regRm + shiftStr;
          pseudoC = 'test(' + regRn.toLowerCase() + ' & ' + regRm.toLowerCase() + ')';
        } else {
          mnemonic = name;
          operands = regRd + ', ' + regRn + ', ' + regRm + shiftStr;
          const invertStr = invert ? '~' : '';
          pseudoC = regRd.toLowerCase() + ' = ' + regRn.toLowerCase() + ' ' + opcSymbols[opc] + ' ' + invertStr + regRm.toLowerCase();
        }
        decoded = true;
      }

      // ---- Unconditional branch immediate: B, BL ----
      if (!decoded && (word & 0x7C000000) === 0x14000000) {
        const link = (word >>> 31) & 1;
        const imm26 = word & 0x03FFFFFF;
        const offset64 = signExtend(imm26, 26) << 2;
        const target = (pc + offset64) >>> 0;
        mnemonic = link ? 'BL' : 'B';
        operands = hex(target);
        pseudoC = link ? 'call(' + hex(target) + ')' : 'goto ' + hex(target);
        decoded = true;
      }

      // ---- Conditional branch: B.cond ----
      if (!decoded && (word & 0xFF000010) === 0x54000000) {
        const imm19 = (word >>> 5) & 0x7FFFF;
        const condCode = word & 0xF;
        const offset64 = signExtend(imm19, 19) << 2;
        const target = (pc + offset64) >>> 0;
        mnemonic = 'B.' + A64_CONDITIONS[condCode];
        operands = hex(target);
        pseudoC = 'if (' + A64_CONDITIONS[condCode].toLowerCase() + ') goto ' + hex(target);
        decoded = true;
      }

      // ---- Compare and branch: CBZ, CBNZ ----
      if (!decoded && (word & 0x7E000000) === 0x34000000) {
        const sf = (word >>> 31) & 1;
        const nz = (word >>> 24) & 1;
        const imm19 = (word >>> 5) & 0x7FFFF;
        const rt = word & 0x1F;
        const offset64 = signExtend(imm19, 19) << 2;
        const target = (pc + offset64) >>> 0;
        const regName = xReg(rt, !!sf);
        mnemonic = nz ? 'CBNZ' : 'CBZ';
        operands = regName + ', ' + hex(target);
        pseudoC = 'if (' + regName.toLowerCase() + (nz ? ' != 0' : ' == 0') + ') goto ' + hex(target);
        decoded = true;
      }

      // ---- Test and branch: TBZ, TBNZ ----
      if (!decoded && (word & 0x7E000000) === 0x36000000) {
        const b5 = (word >>> 31) & 1;
        const nz = (word >>> 24) & 1;
        const b40 = (word >>> 19) & 0x1F;
        const imm14 = (word >>> 5) & 0x3FFF;
        const rt = word & 0x1F;
        const bit = (b5 << 5) | b40;
        const offset64 = signExtend(imm14, 14) << 2;
        const target = (pc + offset64) >>> 0;
        const regName = xReg(rt, bit >= 32);
        mnemonic = nz ? 'TBNZ' : 'TBZ';
        operands = regName + ', #' + bit + ', ' + hex(target);
        pseudoC = 'if (' + regName.toLowerCase() + '[' + bit + '] ' + (nz ? '!= 0' : '== 0') + ') goto ' + hex(target);
        decoded = true;
      }

      // ---- Unconditional branch register: BR, BLR, RET ----
      if (!decoded && (word & 0xFE1FFC1F) === 0xD61F0000) {
        const opc = (word >>> 21) & 0x3;
        const rn = (word >>> 5) & 0x1F;
        if (opc === 0) {
          mnemonic = 'BR';
          operands = xReg(rn, true);
          pseudoC = 'goto *' + xReg(rn, true).toLowerCase();
        } else if (opc === 1) {
          mnemonic = 'BLR';
          operands = xReg(rn, true);
          pseudoC = 'call(*' + xReg(rn, true).toLowerCase() + ')';
        } else if (opc === 2) {
          mnemonic = 'RET';
          operands = rn !== 30 ? xReg(rn, true) : '';
          pseudoC = 'return';
        } else {
          mnemonic = 'dw';
          operands = hexU32(word);
        }
        decoded = true;
      }

      // ---- Load/Store register (unsigned immediate) ----
      // Encoding: size|111|V|01|opc|imm12|Rn|Rt
      if (!decoded && (word & 0x3B000000) === 0x39000000) {
        const size = (word >>> 30) & 0x3;
        const v = (word >>> 26) & 1;
        const opc = (word >>> 22) & 0x3;
        const imm12 = (word >>> 10) & 0xFFF;
        const rn = (word >>> 5) & 0x1F;
        const rt = word & 0x1F;

        if (!v) {
          const scale = size;
          const offset64 = imm12 << scale;
          const isLoad = (opc & 1) || (opc === 2) || (opc === 3);
          const regRt = (opc === 2 || opc === 3) ? xReg(rt, true) : xReg(rt, size === 3);
          const regRn = xRegOrSP(rn, true);
          const sizeNames = ['B', 'H', '', ''];
          const sizeSuffix = size < 2 ? sizeNames[size] : '';

          if (opc === 0) {
            mnemonic = 'STR' + sizeSuffix;
            operands = regRt + ', [' + regRn + (offset64 ? ', #' + hex(offset64) : '') + ']';
            pseudoC = '*(' + regRn.toLowerCase() + (offset64 ? ' + ' + hex(offset64) : '') + ') = ' + regRt.toLowerCase();
          } else if (opc === 1) {
            mnemonic = 'LDR' + sizeSuffix;
            operands = regRt + ', [' + regRn + (offset64 ? ', #' + hex(offset64) : '') + ']';
            pseudoC = regRt.toLowerCase() + ' = *(' + regRn.toLowerCase() + (offset64 ? ' + ' + hex(offset64) : '') + ')';
          } else if (opc === 2) {
            mnemonic = 'LDRS' + (size === 0 ? 'B' : size === 1 ? 'H' : 'W');
            operands = regRt + ', [' + regRn + (offset64 ? ', #' + hex(offset64) : '') + ']';
            pseudoC = regRt.toLowerCase() + ' = sign_extend(*(' + regRn.toLowerCase() + (offset64 ? ' + ' + hex(offset64) : '') + '))';
          } else {
            mnemonic = 'LDR';
            operands = regRt + ', [' + regRn + (offset64 ? ', #' + hex(offset64) : '') + ']';
            pseudoC = regRt.toLowerCase() + ' = *(' + regRn.toLowerCase() + (offset64 ? ' + ' + hex(offset64) : '') + ')';
          }
        } else {
          // SIMD/FP load/store -- simplified
          const regRn = xRegOrSP(rn, true);
          const scale = (opc & 2) ? 4 : size;
          const offset64 = imm12 << scale;
          const load = opc & 1;
          mnemonic = (load ? 'LDR' : 'STR') + ' (SIMD)';
          operands = 'V' + rt + ', [' + regRn + (offset64 ? ', #' + hex(offset64) : '') + ']';
          pseudoC = load ? 'v' + rt + ' = *(' + regRn.toLowerCase() + ')' : '*(' + regRn.toLowerCase() + ') = v' + rt;
        }
        decoded = true;
      }

      // ---- Load/Store register pair: LDP, STP ----
      // Encoding: opc|101|V|0xx|imm7|Rt2|Rn|Rt
      if (!decoded && (word & 0x3A000000) === 0x28000000) {
        const opc = (word >>> 30) & 0x3;
        const v = (word >>> 26) & 1;
        const mode = (word >>> 23) & 0x3; // 01=post, 10=offset, 11=pre
        const load = (word >>> 22) & 1;
        const imm7 = (word >>> 15) & 0x7F;
        const rt2 = (word >>> 10) & 0x1F;
        const rn = (word >>> 5) & 0x1F;
        const rt = word & 0x1F;
        const sf = (opc & 2) ? true : false;
        const scale = sf ? 3 : 2;
        const sImm7 = signExtend(imm7, 7) << scale;
        const regRt = xReg(rt, sf);
        const regRt2 = xReg(rt2, sf);
        const regRn = xRegOrSP(rn, true);

        mnemonic = (load ? 'LDP' : 'STP');

        if (mode === 1) // post-index
          operands = regRt + ', ' + regRt2 + ', [' + regRn + '], #' + sImm7;
        else if (mode === 3) // pre-index
          operands = regRt + ', ' + regRt2 + ', [' + regRn + ', #' + sImm7 + ']!';
        else // signed offset
          operands = regRt + ', ' + regRt2 + ', [' + regRn + (sImm7 ? ', #' + sImm7 : '') + ']';

        if (load)
          pseudoC = regRt.toLowerCase() + ', ' + regRt2.toLowerCase() + ' = *(' + regRn.toLowerCase() + (sImm7 ? ' + ' + sImm7 : '') + ')';
        else
          pseudoC = '*(' + regRn.toLowerCase() + (sImm7 ? ' + ' + sImm7 : '') + ') = ' + regRt.toLowerCase() + ', ' + regRt2.toLowerCase();

        decoded = true;
      }

      // ---- Load literal (PC-relative) ----
      // Encoding: opc|011|V|00|imm19|Rt
      if (!decoded && (word & 0x3B000000) === 0x18000000) {
        const opc = (word >>> 30) & 0x3;
        const v = (word >>> 26) & 1;
        const imm19 = (word >>> 5) & 0x7FFFF;
        const rt = word & 0x1F;
        const offset64 = signExtend(imm19, 19) << 2;
        const target = (pc + offset64) >>> 0;
        const sf = opc >= 1;
        const regRt = v ? ('V' + rt) : xReg(rt, sf);
        mnemonic = 'LDR';
        operands = regRt + ', ' + hex(target);
        pseudoC = regRt.toLowerCase() + ' = *(' + hex(target) + ')';
        decoded = true;
      }

      // ---- Load/Store register (pre/post index, register offset) ----
      // Encoding: size|111|V|00|opc|0|Rm|option|S|10|Rn|Rt (register offset)
      // Encoding: size|111|V|00|opc|0|imm9|01|Rn|Rt (post-index)
      // Encoding: size|111|V|00|opc|0|imm9|11|Rn|Rt (pre-index)
      if (!decoded && (word & 0x3B200000) === 0x38000000) {
        const size = (word >>> 30) & 0x3;
        const v = (word >>> 26) & 1;
        const opc = (word >>> 22) & 0x3;
        const rn = (word >>> 5) & 0x1F;
        const rt = word & 0x1F;
        const bit11 = (word >>> 11) & 1;
        const bit10 = (word >>> 10) & 1;

        if (bit11 === 1 && bit10 === 0) {
          // Register offset
          const rm = (word >>> 16) & 0x1F;
          const option = (word >>> 13) & 0x7;
          const s = (word >>> 12) & 1;
          const regRt = xReg(rt, size === 3);
          const regRn = xRegOrSP(rn, true);
          const regRm = xReg(rm, (option & 1) ? true : false);
          const load = opc & 1;
          const sizeNames = ['B', 'H', '', ''];
          mnemonic = (load ? 'LDR' : 'STR') + sizeNames[size];
          operands = regRt + ', [' + regRn + ', ' + regRm + ']';
          pseudoC = load ?
            regRt.toLowerCase() + ' = *(' + regRn.toLowerCase() + ' + ' + regRm.toLowerCase() + ')' :
            '*(' + regRn.toLowerCase() + ' + ' + regRm.toLowerCase() + ') = ' + regRt.toLowerCase();
        } else {
          // Pre/post index with imm9
          const imm9 = (word >>> 12) & 0x1FF;
          const sImm9 = signExtend(imm9, 9);
          const isPost = bit10 === 1 && bit11 === 0;
          const isPre = bit10 === 1 && bit11 === 1;
          const regRt = xReg(rt, size === 3);
          const regRn = xRegOrSP(rn, true);
          const load = opc & 1;
          const sizeNames = ['B', 'H', '', ''];
          mnemonic = (load ? 'LDR' : 'STR') + sizeNames[size];

          if (isPost)
            operands = regRt + ', [' + regRn + '], #' + sImm9;
          else if (isPre)
            operands = regRt + ', [' + regRn + ', #' + sImm9 + ']!';
          else
            operands = regRt + ', [' + regRn + ', #' + sImm9 + ']';

          pseudoC = load ?
            regRt.toLowerCase() + ' = *(' + regRn.toLowerCase() + (sImm9 ? ' + ' + sImm9 : '') + ')' :
            '*(' + regRn.toLowerCase() + (sImm9 ? ' + ' + sImm9 : '') + ') = ' + regRt.toLowerCase();
        }
        decoded = true;
      }

      // ---- System: NOP, hints ----
      if (!decoded && (word & 0xFFFFF01F) === 0xD503201F) {
        const crm = (word >>> 8) & 0xF;
        const op2 = (word >>> 5) & 0x7;
        const hintNames = { 0: 'NOP', 1: 'YIELD', 2: 'WFE', 3: 'WFI', 4: 'SEV', 5: 'SEVL' };
        const hintKey = (crm << 3) | op2;
        mnemonic = hintNames[hintKey] || 'HINT';
        operands = hintNames[hintKey] ? '' : '#' + hintKey;
        pseudoC = mnemonic.toLowerCase() + '()';
        decoded = true;
      }

      // ---- MRS/MSR ----
      if (!decoded && (word & 0xFFF00000) === 0xD5300000) {
        const l = (word >>> 21) & 1;
        const rt = word & 0x1F;
        const sysRegBits = (word >>> 5) & 0xFFFF;
        if (l) {
          mnemonic = 'MRS';
          operands = xReg(rt, true) + ', S' + sysRegBits.toString(16).toUpperCase();
          pseudoC = xReg(rt, true).toLowerCase() + ' = sysreg(0x' + sysRegBits.toString(16) + ')';
        } else {
          mnemonic = 'MSR';
          operands = 'S' + sysRegBits.toString(16).toUpperCase() + ', ' + xReg(rt, true);
          pseudoC = 'sysreg(0x' + sysRegBits.toString(16) + ') = ' + xReg(rt, true).toLowerCase();
        }
        decoded = true;
      }

      // ---- Exception generation: SVC, HVC, SMC, BRK ----
      if (!decoded && (word & 0xFF000000) === 0xD4000000) {
        const opc = (word >>> 21) & 0x7;
        const imm16 = (word >>> 5) & 0xFFFF;
        const opcNames = { 0: 'SVC', 1: 'HVC', 2: 'SMC' };
        const ll = word & 0x3;
        if (opc === 0 && ll === 1) {
          mnemonic = 'SVC';
          operands = '#' + hex(imm16);
          pseudoC = 'syscall(' + hex(imm16) + ')';
        } else if (opc === 0 && ll === 0) {
          mnemonic = 'BRK';
          operands = '#' + hex(imm16);
          pseudoC = 'breakpoint(' + hex(imm16) + ')';
        } else if (opc === 1) {
          mnemonic = 'HVC';
          operands = '#' + hex(imm16);
          pseudoC = 'hypervisor_call(' + hex(imm16) + ')';
        } else if (opc === 2) {
          mnemonic = 'SMC';
          operands = '#' + hex(imm16);
          pseudoC = 'secure_monitor(' + hex(imm16) + ')';
        } else {
          mnemonic = 'dw';
          operands = hexU32(word);
        }
        decoded = true;
      }

      // ---- Bitfield: UBFM/SBFM/BFM and aliases (UXTB, UXTH, SXTB, SXTH, LSL, LSR, ASR, UBFX, SBFX, BFI, BFXIL) ----
      if (!decoded && (word & 0x1F800000) === 0x13000000) {
        const sf = (word >>> 31) & 1;
        const opc = (word >>> 29) & 0x3;
        const n = (word >>> 22) & 1;
        const immr = (word >>> 16) & 0x3F;
        const imms = (word >>> 10) & 0x3F;
        const rn = (word >>> 5) & 0x1F;
        const rd = word & 0x1F;
        const regRd = xReg(rd, !!sf);
        const regRn = xReg(rn, !!sf);
        const maxBit = sf ? 63 : 31;

        if (opc === 2) {
          // UBFM aliases
          if (imms === maxBit) {
            // LSR
            mnemonic = 'LSR';
            operands = regRd + ', ' + regRn + ', #' + immr;
            pseudoC = regRd.toLowerCase() + ' = ' + regRn.toLowerCase() + ' >> ' + immr;
          } else if (imms + 1 === immr) {
            // LSL
            const shift = maxBit - imms;
            mnemonic = 'LSL';
            operands = regRd + ', ' + regRn + ', #' + shift;
            pseudoC = regRd.toLowerCase() + ' = ' + regRn.toLowerCase() + ' << ' + shift;
          } else if (immr === 0 && imms === 7) {
            mnemonic = 'UXTB';
            operands = regRd + ', ' + xReg(rn, false);
            pseudoC = regRd.toLowerCase() + ' = (uint8_t)' + xReg(rn, false).toLowerCase();
          } else if (immr === 0 && imms === 15) {
            mnemonic = 'UXTH';
            operands = regRd + ', ' + xReg(rn, false);
            pseudoC = regRd.toLowerCase() + ' = (uint16_t)' + xReg(rn, false).toLowerCase();
          } else {
            mnemonic = 'UBFM';
            operands = regRd + ', ' + regRn + ', #' + immr + ', #' + imms;
            pseudoC = regRd.toLowerCase() + ' = ubfx(' + regRn.toLowerCase() + ', ' + immr + ', ' + imms + ')';
          }
        } else if (opc === 0) {
          // SBFM aliases
          if (imms === maxBit) {
            mnemonic = 'ASR';
            operands = regRd + ', ' + regRn + ', #' + immr;
            pseudoC = regRd.toLowerCase() + ' = (signed)' + regRn.toLowerCase() + ' >> ' + immr;
          } else if (immr === 0 && imms === 7) {
            mnemonic = 'SXTB';
            operands = regRd + ', ' + xReg(rn, false);
            pseudoC = regRd.toLowerCase() + ' = (int8_t)' + xReg(rn, false).toLowerCase();
          } else if (immr === 0 && imms === 15) {
            mnemonic = 'SXTH';
            operands = regRd + ', ' + xReg(rn, false);
            pseudoC = regRd.toLowerCase() + ' = (int16_t)' + xReg(rn, false).toLowerCase();
          } else if (immr === 0 && imms === 31) {
            mnemonic = 'SXTW';
            operands = xReg(rd, true) + ', ' + xReg(rn, false);
            pseudoC = xReg(rd, true).toLowerCase() + ' = (int32_t)' + xReg(rn, false).toLowerCase();
          } else {
            mnemonic = 'SBFM';
            operands = regRd + ', ' + regRn + ', #' + immr + ', #' + imms;
            pseudoC = regRd.toLowerCase() + ' = sbfx(' + regRn.toLowerCase() + ', ' + immr + ', ' + imms + ')';
          }
        } else if (opc === 1) {
          // BFM
          mnemonic = 'BFM';
          operands = regRd + ', ' + regRn + ', #' + immr + ', #' + imms;
          pseudoC = regRd.toLowerCase() + ' = bfm(' + regRn.toLowerCase() + ', ' + immr + ', ' + imms + ')';
        } else {
          mnemonic = 'dw';
          operands = hexU32(word);
        }
        decoded = true;
      }

      // ---- Conditional select: CSEL, CSINC, CSINV, CSNEG ----
      if (!decoded && (word & 0x1FE00000) === 0x1A800000) {
        const sf = (word >>> 31) & 1;
        const op = (word >>> 30) & 1;
        const s = (word >>> 29) & 1;
        const rm = (word >>> 16) & 0x1F;
        const condCode = (word >>> 12) & 0xF;
        const op2 = (word >>> 10) & 0x3;
        const rn = (word >>> 5) & 0x1F;
        const rd = word & 0x1F;
        const regRd = xReg(rd, !!sf);
        const regRn = xReg(rn, !!sf);
        const regRm = xReg(rm, !!sf);
        const condStr = A64_CONDITIONS[condCode];

        // CSINC with Rn=Rm=WZR/XZR and inverted cond = CSET
        if (!op && op2 === 1 && rn === 31 && rm === 31) {
          const invCond = A64_CONDITIONS[condCode ^ 1];
          mnemonic = 'CSET';
          operands = regRd + ', ' + invCond;
          pseudoC = regRd.toLowerCase() + ' = (' + invCond.toLowerCase() + ') ? 1 : 0';
        }
        // CSINC with Rn=Rm and inverted cond = CINC
        else if (!op && op2 === 1 && rn === rm && rn !== 31) {
          const invCond = A64_CONDITIONS[condCode ^ 1];
          mnemonic = 'CINC';
          operands = regRd + ', ' + regRn + ', ' + invCond;
          pseudoC = regRd.toLowerCase() + ' = (' + invCond.toLowerCase() + ') ? ' + regRn.toLowerCase() + ' + 1 : ' + regRn.toLowerCase();
        } else {
          const opcNames = [['CSEL', 'CSINC'], ['CSINV', 'CSNEG']];
          mnemonic = opcNames[op][op2 & 1];
          operands = regRd + ', ' + regRn + ', ' + regRm + ', ' + condStr;
          pseudoC = regRd.toLowerCase() + ' = (' + condStr.toLowerCase() + ') ? ' + regRn.toLowerCase() + ' : ' + regRm.toLowerCase();
        }
        decoded = true;
      }

      // ---- Data processing (2 source): UDIV, SDIV, LSLV, LSRV, ASRV, RORV ----
      if (!decoded && (word & 0x1FE00000) === 0x1AC00000) {
        const sf = (word >>> 31) & 1;
        const rm = (word >>> 16) & 0x1F;
        const opcode2 = (word >>> 10) & 0x3F;
        const rn = (word >>> 5) & 0x1F;
        const rd = word & 0x1F;
        const regRd = xReg(rd, !!sf);
        const regRn = xReg(rn, !!sf);
        const regRm = xReg(rm, !!sf);

        const dp2Names = {
          2: ['UDIV', '/'],
          3: ['SDIV', '/ (signed)'],
          8: ['LSLV', '<<'],
          9: ['LSRV', '>>'],
          10: ['ASRV', '>> (signed)'],
          11: ['RORV', 'ror'],
        };

        const entry = dp2Names[opcode2];
        if (entry) {
          mnemonic = entry[0];
          operands = regRd + ', ' + regRn + ', ' + regRm;
          pseudoC = regRd.toLowerCase() + ' = ' + regRn.toLowerCase() + ' ' + entry[1] + ' ' + regRm.toLowerCase();
        } else {
          mnemonic = 'dw';
          operands = hexU32(word);
        }
        decoded = true;
      }

      // ---- Data processing (1 source): RBIT, REV, CLZ, CLS ----
      if (!decoded && (word & 0x1FE00000) === 0x1AC00000) {
        // Already handled above
      }
      if (!decoded && (word & 0x7FE0FC00) === 0x5AC00000) {
        const sf = (word >>> 31) & 1;
        const opcode2 = (word >>> 10) & 0x3F;
        const rn = (word >>> 5) & 0x1F;
        const rd = word & 0x1F;
        const regRd = xReg(rd, !!sf);
        const regRn = xReg(rn, !!sf);
        const dp1Names = { 0: 'RBIT', 1: 'REV16', 2: sf ? 'REV32' : 'REV', 3: 'REV', 4: 'CLZ', 5: 'CLS' };
        const name = dp1Names[opcode2];
        if (name) {
          mnemonic = name;
          operands = regRd + ', ' + regRn;
          pseudoC = regRd.toLowerCase() + ' = ' + name.toLowerCase() + '(' + regRn.toLowerCase() + ')';
        } else {
          mnemonic = 'dw';
          operands = hexU32(word);
        }
        decoded = true;
      }

      // ---- Multiply: MADD, MSUB (and MUL/MNEG aliases) ----
      if (!decoded && (word & 0x1F800000) === 0x1B000000) {
        const sf = (word >>> 31) & 1;
        const op31 = (word >>> 21) & 0x7;
        const rm = (word >>> 16) & 0x1F;
        const o0 = (word >>> 15) & 1;
        const ra = (word >>> 10) & 0x1F;
        const rn = (word >>> 5) & 0x1F;
        const rd = word & 0x1F;
        const regRd = xReg(rd, !!sf);
        const regRn = xReg(rn, !!sf);
        const regRm = xReg(rm, !!sf);
        const regRa = xReg(ra, !!sf);

        if (op31 === 0) {
          if (!o0 && ra === 31) {
            mnemonic = 'MUL';
            operands = regRd + ', ' + regRn + ', ' + regRm;
            pseudoC = regRd.toLowerCase() + ' = ' + regRn.toLowerCase() + ' * ' + regRm.toLowerCase();
          } else if (o0 && ra === 31) {
            mnemonic = 'MNEG';
            operands = regRd + ', ' + regRn + ', ' + regRm;
            pseudoC = regRd.toLowerCase() + ' = -(' + regRn.toLowerCase() + ' * ' + regRm.toLowerCase() + ')';
          } else if (!o0) {
            mnemonic = 'MADD';
            operands = regRd + ', ' + regRn + ', ' + regRm + ', ' + regRa;
            pseudoC = regRd.toLowerCase() + ' = ' + regRa.toLowerCase() + ' + ' + regRn.toLowerCase() + ' * ' + regRm.toLowerCase();
          } else {
            mnemonic = 'MSUB';
            operands = regRd + ', ' + regRn + ', ' + regRm + ', ' + regRa;
            pseudoC = regRd.toLowerCase() + ' = ' + regRa.toLowerCase() + ' - ' + regRn.toLowerCase() + ' * ' + regRm.toLowerCase();
          }
        } else {
          mnemonic = 'dw';
          operands = hexU32(word);
        }
        decoded = true;
      }

      // ---- Fallback: unknown encoding ----
      if (!decoded) {
        mnemonic = 'dw';
        operands = hexU32(word);
        pseudoC = '';
      }

      results.push({
        offset: pc,
        length: 4,
        bytes: bytesStr,
        mnemonic,
        operands,
        pseudoC
      });

      pc += 4;
    }

    return results;
  }

  // =========================================================================
  // Registration
  // =========================================================================

  const DEFAULT_COUNT = 50;

  D.registerDisassembler('arm', function(bytes, baseAddress, count) {
    return decodeARM32(bytes, baseAddress || 0, count || DEFAULT_COUNT);
  });

  D.registerDisassembler('arm64', function(bytes, baseAddress, count) {
    return decodeARM64(bytes, baseAddress || 0, count || DEFAULT_COUNT);
  });

})();
