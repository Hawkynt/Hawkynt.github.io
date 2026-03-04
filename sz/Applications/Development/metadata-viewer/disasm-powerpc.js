;(function() {
  'use strict';
  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // PowerPC disassembler -- fixed 32-bit big-endian instructions
  // =========================================================================

  const GPR = [];
  const FPR = [];
  for (let i = 0; i < 32; ++i) {
    GPR[i] = 'r' + i;
    FPR[i] = 'f' + i;
  }
  const CR = [];
  for (let i = 0; i < 8; ++i)
    CR[i] = 'cr' + i;

  // SPR numbers for common registers
  const SPR_LR = 8;
  const SPR_CTR = 9;

  // ---- helpers ----

  function readU32BE(bytes, off) {
    return ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
  }

  function signExtend(value, bits) {
    const mask = 1 << (bits - 1);
    return (value ^ mask) - mask;
  }

  function hex(v) {
    if (v < 0)
      return '-0x' + (-v).toString(16).toUpperCase();
    return '0x' + v.toString(16).toUpperCase();
  }

  function hexAddr(v) {
    return '0x' + (v >>> 0).toString(16).toUpperCase();
  }

  function formatBytes(bytes, off, len) {
    let s = '';
    for (let i = 0; i < len; ++i) {
      if (i) s += ' ';
      s += (bytes[off + i] < 16 ? '0' : '') + bytes[off + i].toString(16).toUpperCase();
    }
    return s;
  }

  function decodeSPR(spr5hi, spr5lo) {
    return (spr5hi << 5) | spr5lo;
  }

  // ---- branch condition helpers ----

  function simplifyCond(bo, bi) {
    // bi field encodes crN * 4 + cond, where cond: 0=lt,1=gt,2=eq,3=so
    const crBit = bi & 3;
    const crField = (bi >> 2) & 7;
    const crPrefix = crField ? CR[crField] + '+' : '';

    // bo field patterns for simplified mnemonics
    const decCTR = !(bo & 0x04);
    const condTrue = !!(bo & 0x08);
    const branchAlways = !!(bo & 0x14 === 0x14);

    if (bo === 16 || bo === 18) // bdnz variants
      return { mnemonic: 'bdnz', crOp: '' };
    if (bo === 12 && crBit === 0) return { mnemonic: 'blt', crOp: crPrefix };
    if (bo === 12 && crBit === 1) return { mnemonic: 'bgt', crOp: crPrefix };
    if (bo === 12 && crBit === 2) return { mnemonic: 'beq', crOp: crPrefix };
    if (bo === 4 && crBit === 0) return { mnemonic: 'bge', crOp: crPrefix };
    if (bo === 4 && crBit === 1) return { mnemonic: 'ble', crOp: crPrefix };
    if (bo === 4 && crBit === 2) return { mnemonic: 'bne', crOp: crPrefix };
    return null; // no simplification
  }

  function condPseudoC(bo, bi, target) {
    const crBit = bi & 3;
    const labels = ['lt', 'gt', 'eq', 'so'];
    const condTrue = !!(bo & 0x08);
    const cond = condTrue ? labels[crBit] : '!' + labels[crBit];
    return 'if (' + cond + ') goto ' + hexAddr(target);
  }

  // ---- extended opcode 31 tables ----

  const XO_ALU = {
    266: { mn: 'add',   fn: (d, a, b) => [GPR[d] + ', ' + GPR[a] + ', ' + GPR[b], GPR[d] + ' = ' + GPR[a] + ' + ' + GPR[b]] },
    40:  { mn: 'subf',  fn: (d, a, b) => [GPR[d] + ', ' + GPR[a] + ', ' + GPR[b], GPR[d] + ' = ' + GPR[b] + ' - ' + GPR[a]] },
    235: { mn: 'mullw', fn: (d, a, b) => [GPR[d] + ', ' + GPR[a] + ', ' + GPR[b], GPR[d] + ' = ' + GPR[a] + ' * ' + GPR[b]] },
    491: { mn: 'divw',  fn: (d, a, b) => [GPR[d] + ', ' + GPR[a] + ', ' + GPR[b], GPR[d] + ' = ' + GPR[a] + ' / ' + GPR[b]] },
  };

  const X_LOGIC = {
    28:  { mn: 'and',  fn: (a, s, b) => [GPR[a] + ', ' + GPR[s] + ', ' + GPR[b], GPR[a] + ' = ' + GPR[s] + ' & ' + GPR[b]] },
    444: { mn: 'or',   fn: (a, s, b) => [GPR[a] + ', ' + GPR[s] + ', ' + GPR[b], GPR[a] + ' = ' + GPR[s] + ' | ' + GPR[b]] },
    316: { mn: 'xor',  fn: (a, s, b) => [GPR[a] + ', ' + GPR[s] + ', ' + GPR[b], GPR[a] + ' = ' + GPR[s] + ' ^ ' + GPR[b]] },
    124: { mn: 'nor',  fn: (a, s, b) => [GPR[a] + ', ' + GPR[s] + ', ' + GPR[b], GPR[a] + ' = ~(' + GPR[s] + ' | ' + GPR[b] + ')'] },
    24:  { mn: 'slw',  fn: (a, s, b) => [GPR[a] + ', ' + GPR[s] + ', ' + GPR[b], GPR[a] + ' = ' + GPR[s] + ' << ' + GPR[b]] },
    536: { mn: 'srw',  fn: (a, s, b) => [GPR[a] + ', ' + GPR[s] + ', ' + GPR[b], GPR[a] + ' = ' + GPR[s] + ' >>> ' + GPR[b]] },
    792: { mn: 'sraw', fn: (a, s, b) => [GPR[a] + ', ' + GPR[s] + ', ' + GPR[b], GPR[a] + ' = ' + GPR[s] + ' >> ' + GPR[b]] },
    824: { mn: 'srawi', fn: (a, s, sh) => [GPR[a] + ', ' + GPR[s] + ', ' + sh, GPR[a] + ' = ' + GPR[s] + ' >> ' + sh] },
    954: { mn: 'extsb', fn: (a, s) => [GPR[a] + ', ' + GPR[s], GPR[a] + ' = (int8)' + GPR[s]] },
    922: { mn: 'extsh', fn: (a, s) => [GPR[a] + ', ' + GPR[s], GPR[a] + ' = (int16)' + GPR[s]] },
  };

  const X_CMP = {
    0:   'cmp',
    32:  'cmpl',
  };

  // ---- load/store opcode table ----

  const LS_TABLE = {
    32: { mn: 'lwz',   sz: 4, sign: false, fp: false, update: false },
    33: { mn: 'lwzu',  sz: 4, sign: false, fp: false, update: true },
    34: { mn: 'lbz',   sz: 1, sign: false, fp: false, update: false },
    35: { mn: 'lbzu',  sz: 1, sign: false, fp: false, update: true },
    36: { mn: 'stw',   sz: 4, sign: false, fp: false, update: false, store: true },
    37: { mn: 'stwu',  sz: 4, sign: false, fp: false, update: true, store: true },
    38: { mn: 'stb',   sz: 1, sign: false, fp: false, update: false, store: true },
    39: { mn: 'stbu',  sz: 1, sign: false, fp: false, update: true, store: true },
    40: { mn: 'lhz',   sz: 2, sign: false, fp: false, update: false },
    41: { mn: 'lhzu',  sz: 2, sign: false, fp: false, update: true },
    42: { mn: 'lha',   sz: 2, sign: true,  fp: false, update: false },
    43: { mn: 'lhau',  sz: 2, sign: true,  fp: false, update: true },
    44: { mn: 'sth',   sz: 2, sign: false, fp: false, update: false, store: true },
    45: { mn: 'sthu',  sz: 2, sign: false, fp: false, update: true, store: true },
    48: { mn: 'lfs',   sz: 4, sign: false, fp: true,  update: false },
    49: { mn: 'lfsu',  sz: 4, sign: false, fp: true,  update: true },
    50: { mn: 'lfd',   sz: 8, sign: false, fp: true,  update: false },
    51: { mn: 'lfdu',  sz: 8, sign: false, fp: true,  update: true },
    52: { mn: 'stfs',  sz: 4, sign: false, fp: true,  update: false, store: true },
    53: { mn: 'stfsu', sz: 4, sign: false, fp: true,  update: true, store: true },
    54: { mn: 'stfd',  sz: 8, sign: false, fp: true,  update: false, store: true },
    55: { mn: 'stfdu', sz: 8, sign: false, fp: true,  update: true, store: true },
  };

  // ---- main decoder ----

  function decode(bytes, baseAddress, offset, count) {
    const results = [];
    let pos = offset;
    const end = bytes.length;
    const maxInstr = count || 50;

    while (results.length < maxInstr && pos + 3 < end) {
      const word = readU32BE(bytes, pos);
      const opcode = (word >> 26) & 0x3F;
      const instrBytes = formatBytes(bytes, pos, 4);
      const addr = baseAddress + pos - offset;
      let mnemonic = '???';
      let operands = '';
      let pseudoC = '';

      // ---- Branch (opcode 18) ----
      if (opcode === 18) {
        let li = (word >> 2) & 0x00FFFFFF;
        li = signExtend(li, 24) << 2;
        const aa = word & 2;
        const lk = word & 1;
        const target = aa ? (li >>> 0) : ((addr + li) >>> 0);

        if (lk && aa)
          mnemonic = 'bla';
        else if (lk)
          mnemonic = 'bl';
        else if (aa)
          mnemonic = 'ba';
        else
          mnemonic = 'b';

        operands = hexAddr(target);
        pseudoC = lk ? 'call(' + hexAddr(target) + ')' : 'goto ' + hexAddr(target);
      }

      // ---- Branch conditional (opcode 16) ----
      else if (opcode === 16) {
        const bo = (word >> 21) & 0x1F;
        const bi = (word >> 16) & 0x1F;
        let bd = (word >> 2) & 0x3FFF;
        bd = signExtend(bd, 14) << 2;
        const aa = word & 2;
        const lk = word & 1;
        const target = aa ? (bd >>> 0) : ((addr + bd) >>> 0);

        const simplified = simplifyCond(bo, bi);
        if (simplified) {
          mnemonic = simplified.mnemonic;
          if (lk) mnemonic += 'l';
          operands = (simplified.crOp ? simplified.crOp + ', ' : '') + hexAddr(target);
        } else {
          mnemonic = lk ? 'bcl' : 'bc';
          operands = bo + ', ' + bi + ', ' + hexAddr(target);
        }
        pseudoC = condPseudoC(bo, bi, target);
      }

      // ---- Branch to LR/CTR (opcode 19) ----
      else if (opcode === 19) {
        const bo = (word >> 21) & 0x1F;
        const bi = (word >> 16) & 0x1F;
        const xo = (word >> 1) & 0x3FF;
        const lk = word & 1;

        if (xo === 16) {
          // bclr / blr
          if (bo === 20 && bi === 0) {
            mnemonic = lk ? 'blrl' : 'blr';
            operands = '';
            pseudoC = lk ? 'call(LR)' : 'return';
          } else {
            mnemonic = lk ? 'bclrl' : 'bclr';
            operands = bo + ', ' + bi;
            const condBit = bi & 3;
            const labels = ['lt', 'gt', 'eq', 'so'];
            const condTrue = !!(bo & 0x08);
            pseudoC = 'if (' + (condTrue ? '' : '!') + labels[condBit] + ') goto LR';
          }
        } else if (xo === 528) {
          // bcctr / bctr
          if (bo === 20 && bi === 0) {
            mnemonic = lk ? 'bctrl' : 'bctr';
            operands = '';
            pseudoC = lk ? 'call(CTR)' : 'goto CTR';
          } else {
            mnemonic = lk ? 'bcctrl' : 'bcctr';
            operands = bo + ', ' + bi;
            const condBit = bi & 3;
            const labels = ['lt', 'gt', 'eq', 'so'];
            const condTrue = !!(bo & 0x08);
            pseudoC = 'if (' + (condTrue ? '' : '!') + labels[condBit] + ') goto CTR';
          }
        } else {
          mnemonic = '.long';
          operands = hexAddr(word);
          pseudoC = '';
        }
      }

      // ---- ALU immediate (opcodes 7-15) ----
      else if (opcode >= 7 && opcode <= 15) {
        const rD = (word >> 21) & 0x1F;
        const rA = (word >> 16) & 0x1F;
        const imm = signExtend(word & 0xFFFF, 16);
        const uimm = word & 0xFFFF;

        switch (opcode) {
          case 7:
            mnemonic = 'mulli';
            operands = GPR[rD] + ', ' + GPR[rA] + ', ' + imm;
            pseudoC = GPR[rD] + ' = ' + GPR[rA] + ' * ' + imm;
            break;
          case 8:
            mnemonic = 'subfic';
            operands = GPR[rD] + ', ' + GPR[rA] + ', ' + imm;
            pseudoC = GPR[rD] + ' = ' + imm + ' - ' + GPR[rA];
            break;
          case 10:
            mnemonic = 'cmpli';
            operands = GPR[rA] + ', ' + uimm;
            pseudoC = 'compare_unsigned(' + GPR[rA] + ', ' + uimm + ')';
            break;
          case 11:
            // cmpi simplified as cmpwi
            mnemonic = 'cmpwi';
            operands = GPR[rA] + ', ' + imm;
            pseudoC = 'compare(' + GPR[rA] + ', ' + imm + ')';
            break;
          case 12:
            mnemonic = 'addic';
            operands = GPR[rD] + ', ' + GPR[rA] + ', ' + imm;
            pseudoC = GPR[rD] + ' = ' + GPR[rA] + ' + ' + imm;
            break;
          case 13:
            mnemonic = 'addic.';
            operands = GPR[rD] + ', ' + GPR[rA] + ', ' + imm;
            pseudoC = GPR[rD] + ' = ' + GPR[rA] + ' + ' + imm;
            break;
          case 14:
            // addi / li simplification
            if (rA === 0) {
              mnemonic = 'li';
              operands = GPR[rD] + ', ' + imm;
              pseudoC = GPR[rD] + ' = ' + imm;
            } else {
              mnemonic = 'addi';
              operands = GPR[rD] + ', ' + GPR[rA] + ', ' + imm;
              pseudoC = GPR[rD] + ' = ' + GPR[rA] + ' + ' + imm;
            }
            break;
          case 15:
            // addis / lis simplification
            if (rA === 0) {
              mnemonic = 'lis';
              operands = GPR[rD] + ', ' + imm;
              pseudoC = GPR[rD] + ' = ' + imm + ' << 16';
            } else {
              mnemonic = 'addis';
              operands = GPR[rD] + ', ' + GPR[rA] + ', ' + imm;
              pseudoC = GPR[rD] + ' = ' + GPR[rA] + ' + (' + imm + ' << 16)';
            }
            break;
          default:
            mnemonic = '???';
            operands = hexAddr(word);
            pseudoC = '';
        }
      }

      // ---- System call (opcode 17) ----
      else if (opcode === 17) {
        mnemonic = 'sc';
        operands = '';
        pseudoC = 'syscall()';
      }

      // ---- Rotate/shift rlwinm (opcode 21) ----
      else if (opcode === 21) {
        const rS = (word >> 21) & 0x1F;
        const rA = (word >> 16) & 0x1F;
        const SH = (word >> 11) & 0x1F;
        const MB = (word >> 6) & 0x1F;
        const ME = (word >> 1) & 0x1F;

        // Simplified mnemonics
        if (MB === 0 && ME === 31 - SH) {
          // slwi rA, rS, SH
          mnemonic = 'slwi';
          operands = GPR[rA] + ', ' + GPR[rS] + ', ' + SH;
          pseudoC = GPR[rA] + ' = ' + GPR[rS] + ' << ' + SH;
        } else if (SH === 32 - MB && ME === 31) {
          // srwi rA, rS, n  where n = MB, SH = 32-n
          mnemonic = 'srwi';
          operands = GPR[rA] + ', ' + GPR[rS] + ', ' + MB;
          pseudoC = GPR[rA] + ' = ' + GPR[rS] + ' >>> ' + MB;
        } else if (SH === 0 && ME === 31) {
          // clrlwi rA, rS, MB
          mnemonic = 'clrlwi';
          operands = GPR[rA] + ', ' + GPR[rS] + ', ' + MB;
          pseudoC = GPR[rA] + ' = ' + GPR[rS] + ' & ' + hex((0xFFFFFFFF >>> MB) >>> 0);
        } else if (SH === 0 && MB === 0) {
          // clrrwi rA, rS, 31-ME
          const n = 31 - ME;
          mnemonic = 'clrrwi';
          operands = GPR[rA] + ', ' + GPR[rS] + ', ' + n;
          pseudoC = GPR[rA] + ' = ' + GPR[rS] + ' & ' + hex((0xFFFFFFFF << n) >>> 0);
        } else if (MB === 0 && ME === 31) {
          // rotlwi rA, rS, SH
          mnemonic = 'rotlwi';
          operands = GPR[rA] + ', ' + GPR[rS] + ', ' + SH;
          pseudoC = GPR[rA] + ' = rotl32(' + GPR[rS] + ', ' + SH + ')';
        } else {
          mnemonic = 'rlwinm';
          operands = GPR[rA] + ', ' + GPR[rS] + ', ' + SH + ', ' + MB + ', ' + ME;
          pseudoC = GPR[rA] + ' = rotl32(' + GPR[rS] + ', ' + SH + ') & mask(' + MB + ', ' + ME + ')';
        }
      }

      // ---- Logic immediate (opcodes 24-29) ----
      else if (opcode >= 24 && opcode <= 29) {
        const rS = (word >> 21) & 0x1F;
        const rA = (word >> 16) & 0x1F;
        const uimm = word & 0xFFFF;

        switch (opcode) {
          case 24:
            // ori / nop simplification
            if (rS === 0 && rA === 0 && uimm === 0) {
              mnemonic = 'nop';
              operands = '';
              pseudoC = '';
            } else {
              mnemonic = 'ori';
              operands = GPR[rA] + ', ' + GPR[rS] + ', ' + uimm;
              pseudoC = GPR[rA] + ' = ' + GPR[rS] + ' | ' + uimm;
            }
            break;
          case 25:
            mnemonic = 'oris';
            operands = GPR[rA] + ', ' + GPR[rS] + ', ' + uimm;
            pseudoC = GPR[rA] + ' = ' + GPR[rS] + ' | (' + uimm + ' << 16)';
            break;
          case 26:
            mnemonic = 'xori';
            operands = GPR[rA] + ', ' + GPR[rS] + ', ' + uimm;
            pseudoC = GPR[rA] + ' = ' + GPR[rS] + ' ^ ' + uimm;
            break;
          case 27:
            mnemonic = 'xoris';
            operands = GPR[rA] + ', ' + GPR[rS] + ', ' + uimm;
            pseudoC = GPR[rA] + ' = ' + GPR[rS] + ' ^ (' + uimm + ' << 16)';
            break;
          case 28:
            mnemonic = 'andi.';
            operands = GPR[rA] + ', ' + GPR[rS] + ', ' + uimm;
            pseudoC = GPR[rA] + ' = ' + GPR[rS] + ' & ' + uimm;
            break;
          case 29:
            mnemonic = 'andis.';
            operands = GPR[rA] + ', ' + GPR[rS] + ', ' + uimm;
            pseudoC = GPR[rA] + ' = ' + GPR[rS] + ' & (' + uimm + ' << 16)';
            break;
        }
      }

      // ---- Load/Store (opcodes 32-55) ----
      else if (LS_TABLE[opcode]) {
        const info = LS_TABLE[opcode];
        const rDorS = (word >> 21) & 0x1F;
        const rA = (word >> 16) & 0x1F;
        const d = signExtend(word & 0xFFFF, 16);
        const reg = info.fp ? FPR[rDorS] : GPR[rDorS];
        const base = rA === 0 ? '0' : GPR[rA];

        mnemonic = info.mn;
        operands = reg + ', ' + d + '(' + (rA === 0 ? '0' : GPR[rA]) + ')';

        if (info.store)
          pseudoC = '*(' + base + ' + ' + d + ') = ' + reg;
        else
          pseudoC = reg + ' = *(' + base + ' + ' + d + ')';
      }

      // ---- Extended ALU / Logic / SPR / Compare (opcode 31) ----
      else if (opcode === 31) {
        const rD = (word >> 21) & 0x1F;  // also rS for logic ops
        const rA = (word >> 16) & 0x1F;
        const rB = (word >> 11) & 0x1F;
        const xo10 = (word >> 1) & 0x3FF;  // 10-bit extended opcode
        const xo9 = (word >> 1) & 0x1FF;   // 9-bit extended opcode (XO-form)
        const rc = word & 1;

        // mfspr / mtspr
        if (xo10 === 339) {
          // mfspr rD, SPR
          const spr = decodeSPR(rB, rA);  // SPR field is split: bits [15:11] || [20:16]
          if (spr === SPR_LR) {
            mnemonic = 'mflr';
            operands = GPR[rD];
            pseudoC = GPR[rD] + ' = LR';
          } else if (spr === SPR_CTR) {
            mnemonic = 'mfctr';
            operands = GPR[rD];
            pseudoC = GPR[rD] + ' = CTR';
          } else {
            mnemonic = 'mfspr';
            operands = GPR[rD] + ', ' + spr;
            pseudoC = GPR[rD] + ' = SPR' + spr;
          }
        } else if (xo10 === 467) {
          // mtspr SPR, rS
          const spr = decodeSPR(rB, rA);
          if (spr === SPR_LR) {
            mnemonic = 'mtlr';
            operands = GPR[rD];
            pseudoC = 'LR = ' + GPR[rD];
          } else if (spr === SPR_CTR) {
            mnemonic = 'mtctr';
            operands = GPR[rD];
            pseudoC = 'CTR = ' + GPR[rD];
          } else {
            mnemonic = 'mtspr';
            operands = spr + ', ' + GPR[rD];
            pseudoC = 'SPR' + spr + ' = ' + GPR[rD];
          }
        }
        // mfcr
        else if (xo10 === 19) {
          mnemonic = 'mfcr';
          operands = GPR[rD];
          pseudoC = GPR[rD] + ' = CR';
        }
        // mtcrf
        else if (xo10 === 144) {
          const crm = (word >> 12) & 0xFF;
          mnemonic = 'mtcrf';
          operands = crm + ', ' + GPR[rD];
          pseudoC = 'CR = ' + GPR[rD] + ' (mask ' + hex(crm) + ')';
        }
        // Compare instructions
        else if (xo10 === 0) {
          // cmp
          const bf = (rD >> 2) & 7;
          mnemonic = 'cmpw';
          operands = (bf ? CR[bf] + ', ' : '') + GPR[rA] + ', ' + GPR[rB];
          pseudoC = 'compare(' + GPR[rA] + ', ' + GPR[rB] + ')';
        } else if (xo10 === 32) {
          // cmpl
          const bf = (rD >> 2) & 7;
          mnemonic = 'cmplw';
          operands = (bf ? CR[bf] + ', ' : '') + GPR[rA] + ', ' + GPR[rB];
          pseudoC = 'compare_unsigned(' + GPR[rA] + ', ' + GPR[rB] + ')';
        }
        // extsb, extsh (only use rS and rA)
        else if (xo10 === 954) {
          const info = X_LOGIC[954];
          const [ops, pc] = info.fn(rA, rD);
          mnemonic = info.mn + (rc ? '.' : '');
          operands = ops;
          pseudoC = pc;
        } else if (xo10 === 922) {
          const info = X_LOGIC[922];
          const [ops, pc] = info.fn(rA, rD);
          mnemonic = info.mn + (rc ? '.' : '');
          operands = ops;
          pseudoC = pc;
        }
        // srawi (uses SH = rB field)
        else if (xo10 === 824) {
          const info = X_LOGIC[824];
          const [ops, pc] = info.fn(rA, rD, rB);
          mnemonic = info.mn + (rc ? '.' : '');
          operands = ops;
          pseudoC = pc;
        }
        // Logic X-form ops (and, or, xor, nor, slw, srw, sraw)
        else if (X_LOGIC[xo10]) {
          const info = X_LOGIC[xo10];
          // Simplified: mr = or rA,rS,rS; not = nor rA,rS,rS
          if (xo10 === 444 && rD === rB) {
            // mr rA, rS
            mnemonic = 'mr' + (rc ? '.' : '');
            operands = GPR[rA] + ', ' + GPR[rD];
            pseudoC = GPR[rA] + ' = ' + GPR[rD];
          } else if (xo10 === 124 && rD === rB) {
            // not rA, rS
            mnemonic = 'not' + (rc ? '.' : '');
            operands = GPR[rA] + ', ' + GPR[rD];
            pseudoC = GPR[rA] + ' = ~' + GPR[rD];
          } else {
            const [ops, pc] = info.fn(rA, rD, rB);
            mnemonic = info.mn + (rc ? '.' : '');
            operands = ops;
            pseudoC = pc;
          }
        }
        // XO-form ALU ops (add, subf, mullw, divw) -- 9-bit xo
        else if (XO_ALU[xo9]) {
          const info = XO_ALU[xo9];
          const oe = (word >> 10) & 1;
          const [ops, pc] = info.fn(rD, rA, rB);
          mnemonic = info.mn + (oe ? 'o' : '') + (rc ? '.' : '');
          operands = ops;
          pseudoC = pc;
        }
        // Unknown opcode 31
        else {
          mnemonic = '.long';
          operands = hexAddr(word);
          pseudoC = '';
        }
      }

      // ---- Unknown primary opcode ----
      else {
        mnemonic = '.long';
        operands = hexAddr(word);
        pseudoC = '';
      }

      results.push({
        offset: addr,
        length: 4,
        bytes: instrBytes,
        mnemonic: mnemonic,
        operands: operands,
        pseudoC: pseudoC,
      });

      pos += 4;
    }

    return results;
  }

  D.registerDisassembler('ppc', decode);

})();
