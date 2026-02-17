;(function() {
  'use strict';

  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // Zilog Z80 Disassembler
  // =========================================================================

  // -------------------------------------------------------------------------
  // Register tables
  // -------------------------------------------------------------------------

  const R8 = ['B', 'C', 'D', 'E', 'H', 'L', '(HL)', 'A'];
  const RP = ['BC', 'DE', 'HL', 'SP'];
  const RP2 = ['BC', 'DE', 'HL', 'AF'];
  const CC = ['NZ', 'Z', 'NC', 'C', 'PO', 'PE', 'P', 'M'];
  const CC_PSEUDO = ['!Z', 'Z', '!C', 'C', '!P', 'P', '!S', 'S'];
  const ALU = ['ADD', 'ADC', 'SUB', 'SBC', 'AND', 'XOR', 'OR', 'CP'];
  const ALU_OP = ['+ ', '+ /*carry*/ ', '- ', '- /*borrow*/ ', '& ', '^ ', '| ', '- '];
  const ROT = ['RLC', 'RRC', 'RL', 'RR', 'SLA', 'SRA', 'SLL', 'SRL'];

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  function hex8(v) { return '0x' + (v & 0xFF).toString(16).toUpperCase().padStart(2, '0'); }
  function hex16(v) { return '0x' + (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0'); }
  function signedByte(v) { return (v & 0xFF) > 0x7F ? (v & 0xFF) - 256 : v & 0xFF; }

  function readU8(bytes, o) { return o < bytes.length ? bytes[o] : 0; }
  function readU16(bytes, o) {
    return o + 1 < bytes.length ? (bytes[o] | (bytes[o + 1] << 8)) & 0xFFFF : 0;
  }

  function formatBytes(bytes, offset, length) {
    const parts = [];
    for (let i = 0; i < length && offset + i < bytes.length; ++i)
      parts.push(bytes[offset + i].toString(16).padStart(2, '0').toUpperCase());
    return parts.join(' ');
  }

  function fmtDisp(d) {
    if (d >= 0) return '+' + hex8(d);
    return '-' + hex8(-d);
  }

  function bitMask(bit) { return '0x' + (1 << bit).toString(16).toUpperCase().padStart(2, '0'); }
  function bitMaskInv(bit) { return '0x' + ((~(1 << bit)) & 0xFF).toString(16).toUpperCase().padStart(2, '0'); }

  // -------------------------------------------------------------------------
  // Game Boy invalid opcode set
  // -------------------------------------------------------------------------

  const GB_INVALID = new Set([0xD3, 0xDB, 0xDD, 0xE3, 0xE4, 0xEB, 0xEC, 0xED, 0xF4, 0xFC, 0xFD]);

  // -------------------------------------------------------------------------
  // Base opcode decoder (0x00-0xFF)
  // -------------------------------------------------------------------------

  function decodeBase(bytes, pos, gb) {
    const op = readU8(bytes, pos);
    let len = 1;
    let mnemonic = '';
    let operands = '';
    let pseudoC = '';

    // --- Game Boy invalid opcodes ---
    if (gb && GB_INVALID.has(op))
      return { len: 1, mnemonic: 'db', operands: hex8(op), pseudoC: '/* invalid */' };

    // --- Game Boy overrides ---
    if (gb) {
      switch (op) {
        case 0x08: {
          const nn = readU16(bytes, pos + 1);
          return { len: 3, mnemonic: 'LD', operands: '(' + hex16(nn) + '),SP', pseudoC: '*' + hex16(nn) + ' = SP' };
        }
        case 0x10:
          return { len: 2, mnemonic: 'STOP', operands: '', pseudoC: 'stop()' };
        case 0xE0: {
          const n = readU8(bytes, pos + 1);
          return { len: 2, mnemonic: 'LDH', operands: '(' + hex8(n) + '),A', pseudoC: '*(0xFF00 + ' + hex8(n) + ') = A' };
        }
        case 0xE2:
          return { len: 1, mnemonic: 'LD', operands: '(C),A', pseudoC: '*(0xFF00 + C) = A' };
        case 0xE8: {
          const d = signedByte(readU8(bytes, pos + 1));
          return { len: 2, mnemonic: 'ADD', operands: 'SP,' + (d >= 0 ? '+' : '') + d, pseudoC: 'SP = SP + ' + d };
        }
        case 0xF0: {
          const n = readU8(bytes, pos + 1);
          return { len: 2, mnemonic: 'LDH', operands: 'A,(' + hex8(n) + ')', pseudoC: 'A = *(0xFF00 + ' + hex8(n) + ')' };
        }
        case 0xF2:
          return { len: 1, mnemonic: 'LD', operands: 'A,(C)', pseudoC: 'A = *(0xFF00 + C)' };
        case 0xF8: {
          const d = signedByte(readU8(bytes, pos + 1));
          return { len: 2, mnemonic: 'LD', operands: 'HL,SP' + (d >= 0 ? '+' : '') + d, pseudoC: 'HL = SP + ' + d };
        }
      }
    }

    // --- x = op >> 6, y = (op >> 3) & 7, z = op & 7, p = y >> 1, q = y & 1 ---
    const x = (op >> 6) & 3;
    const y = (op >> 3) & 7;
    const z = op & 7;
    const p = y >> 1;
    const q = y & 1;

    if (x === 0) {
      switch (z) {
        case 0:
          switch (y) {
            case 0: // NOP
              mnemonic = 'NOP'; pseudoC = '/* nop */';
              break;
            case 1: // EX AF,AF'
              mnemonic = 'EX'; operands = "AF,AF'"; pseudoC = 'swap(AF, AF\')';
              break;
            case 2: { // DJNZ d
              const d = signedByte(readU8(bytes, pos + 1));
              const target = (pos + 2 + d) & 0xFFFF;
              len = 2;
              mnemonic = 'DJNZ'; operands = hex16(target);
              pseudoC = 'if (--B) goto ' + hex16(target);
              break;
            }
            case 3: { // JR d
              const d = signedByte(readU8(bytes, pos + 1));
              const target = (pos + 2 + d) & 0xFFFF;
              len = 2;
              mnemonic = 'JR'; operands = hex16(target);
              pseudoC = 'goto ' + hex16(target);
              break;
            }
            default: { // JR cc,d (y=4..7 -> cc = y-4: NZ,Z,NC,C)
              const d = signedByte(readU8(bytes, pos + 1));
              const target = (pos + 2 + d) & 0xFFFF;
              len = 2;
              const cc = y - 4;
              mnemonic = 'JR'; operands = CC[cc] + ',' + hex16(target);
              pseudoC = 'if (' + CC_PSEUDO[cc] + ') goto ' + hex16(target);
              break;
            }
          }
          break;
        case 1:
          if (q === 0) { // LD rp,nn
            const nn = readU16(bytes, pos + 1); len = 3;
            mnemonic = 'LD'; operands = RP[p] + ',' + hex16(nn);
            pseudoC = RP[p] + ' = ' + hex16(nn);
          } else { // ADD HL,rp
            mnemonic = 'ADD'; operands = 'HL,' + RP[p];
            pseudoC = 'HL = HL + ' + RP[p];
          }
          break;
        case 2:
          if (q === 0) {
            switch (p) {
              case 0: mnemonic = 'LD'; operands = '(BC),A'; pseudoC = '*BC = A'; break;
              case 1: mnemonic = 'LD'; operands = '(DE),A'; pseudoC = '*DE = A'; break;
              case 2: { const nn = readU16(bytes, pos + 1); len = 3; mnemonic = 'LD'; operands = '(' + hex16(nn) + '),HL'; pseudoC = '*' + hex16(nn) + ' = HL'; break; }
              case 3: { const nn = readU16(bytes, pos + 1); len = 3; mnemonic = 'LD'; operands = '(' + hex16(nn) + '),A'; pseudoC = '*' + hex16(nn) + ' = A'; break; }
            }
          } else {
            switch (p) {
              case 0: mnemonic = 'LD'; operands = 'A,(BC)'; pseudoC = 'A = *BC'; break;
              case 1: mnemonic = 'LD'; operands = 'A,(DE)'; pseudoC = 'A = *DE'; break;
              case 2: { const nn = readU16(bytes, pos + 1); len = 3; mnemonic = 'LD'; operands = 'HL,(' + hex16(nn) + ')'; pseudoC = 'HL = *' + hex16(nn); break; }
              case 3: { const nn = readU16(bytes, pos + 1); len = 3; mnemonic = 'LD'; operands = 'A,(' + hex16(nn) + ')'; pseudoC = 'A = *' + hex16(nn); break; }
            }
          }
          break;
        case 3:
          if (q === 0) { mnemonic = 'INC'; operands = RP[p]; pseudoC = '++' + RP[p]; }
          else { mnemonic = 'DEC'; operands = RP[p]; pseudoC = '--' + RP[p]; }
          break;
        case 4: // INC r
          mnemonic = 'INC'; operands = R8[y]; pseudoC = '++' + R8[y];
          break;
        case 5: // DEC r
          mnemonic = 'DEC'; operands = R8[y]; pseudoC = '--' + R8[y];
          break;
        case 6: { // LD r,n
          const n = readU8(bytes, pos + 1); len = 2;
          mnemonic = 'LD'; operands = R8[y] + ',' + hex8(n);
          pseudoC = R8[y] + ' = ' + hex8(n);
          break;
        }
        case 7:
          switch (y) {
            case 0: mnemonic = 'RLCA'; pseudoC = 'A = rotl(A, 1)'; break;
            case 1: mnemonic = 'RRCA'; pseudoC = 'A = rotr(A, 1)'; break;
            case 2: mnemonic = 'RLA'; pseudoC = 'A = rl(A) /* through carry */'; break;
            case 3: mnemonic = 'RRA'; pseudoC = 'A = rr(A) /* through carry */'; break;
            case 4: mnemonic = 'DAA'; pseudoC = 'A = daa(A) /* decimal adjust */'; break;
            case 5: mnemonic = 'CPL'; pseudoC = 'A = ~A'; break;
            case 6: mnemonic = 'SCF'; pseudoC = 'C = 1'; break;
            case 7: mnemonic = 'CCF'; pseudoC = 'C = !C'; break;
          }
          break;
      }
    } else if (x === 1) {
      if (y === 6 && z === 6) {
        mnemonic = 'HALT'; pseudoC = 'halt()';
      } else {
        mnemonic = 'LD'; operands = R8[y] + ',' + R8[z];
        pseudoC = R8[y] + ' = ' + R8[z];
      }
    } else if (x === 2) {
      // ALU A,r
      mnemonic = ALU[y]; operands = 'A,' + R8[z];
      if (y === 7) // CP
        pseudoC = 'flags = A ' + ALU_OP[y] + R8[z];
      else if (y === 0 || y === 1) // ADD/ADC
        pseudoC = 'A = A ' + ALU_OP[y] + R8[z];
      else if (y >= 2 && y <= 3) // SUB/SBC
        pseudoC = 'A = A ' + ALU_OP[y] + R8[z];
      else // AND/XOR/OR
        pseudoC = 'A = A ' + ALU_OP[y] + R8[z];
    } else { // x === 3
      switch (z) {
        case 0: // RET cc
          mnemonic = 'RET'; operands = CC[y];
          pseudoC = 'if (' + CC_PSEUDO[y] + ') return';
          break;
        case 1:
          if (q === 0) { // POP rp2
            mnemonic = 'POP'; operands = RP2[p];
            pseudoC = RP2[p] + ' = pop()';
          } else {
            switch (p) {
              case 0: mnemonic = 'RET'; pseudoC = 'return'; break;
              case 1: mnemonic = 'EXX'; pseudoC = "swap(BC,DE,HL, BC',DE',HL')"; break;
              case 2: mnemonic = 'JP'; operands = '(HL)'; pseudoC = 'goto *HL'; break;
              case 3: mnemonic = 'LD'; operands = 'SP,HL'; pseudoC = 'SP = HL'; break;
            }
          }
          break;
        case 2: { // JP cc,nn
          const nn = readU16(bytes, pos + 1); len = 3;
          mnemonic = 'JP'; operands = CC[y] + ',' + hex16(nn);
          pseudoC = 'if (' + CC_PSEUDO[y] + ') goto ' + hex16(nn);
          break;
        }
        case 3:
          switch (y) {
            case 0: { const nn = readU16(bytes, pos + 1); len = 3; mnemonic = 'JP'; operands = hex16(nn); pseudoC = 'goto ' + hex16(nn); break; }
            case 1: return null; // CB prefix handled externally
            case 2: { const n = readU8(bytes, pos + 1); len = 2; mnemonic = 'OUT'; operands = '(' + hex8(n) + '),A'; pseudoC = 'out(' + hex8(n) + ', A)'; break; }
            case 3: { const n = readU8(bytes, pos + 1); len = 2; mnemonic = 'IN'; operands = 'A,(' + hex8(n) + ')'; pseudoC = 'A = in(' + hex8(n) + ')'; break; }
            case 4: mnemonic = 'EX'; operands = '(SP),HL'; pseudoC = 'swap(*SP, HL)'; break;
            case 5: mnemonic = 'EX'; operands = 'DE,HL'; pseudoC = 'swap(DE, HL)'; break;
            case 6: mnemonic = 'DI'; pseudoC = 'interrupts = false'; break;
            case 7: mnemonic = 'EI'; pseudoC = 'interrupts = true'; break;
          }
          break;
        case 4: { // CALL cc,nn
          const nn = readU16(bytes, pos + 1); len = 3;
          mnemonic = 'CALL'; operands = CC[y] + ',' + hex16(nn);
          pseudoC = 'if (' + CC_PSEUDO[y] + ') call ' + hex16(nn);
          break;
        }
        case 5:
          if (q === 0) { // PUSH rp2
            mnemonic = 'PUSH'; operands = RP2[p];
            pseudoC = 'push(' + RP2[p] + ')';
          } else {
            switch (p) {
              case 0: { const nn = readU16(bytes, pos + 1); len = 3; mnemonic = 'CALL'; operands = hex16(nn); pseudoC = 'call ' + hex16(nn); break; }
              case 1: return null; // DD prefix
              case 2: return null; // ED prefix
              case 3: return null; // FD prefix
            }
          }
          break;
        case 6: { // ALU A,n
          const n = readU8(bytes, pos + 1); len = 2;
          mnemonic = ALU[y]; operands = 'A,' + hex8(n);
          if (y === 7)
            pseudoC = 'flags = A - ' + hex8(n);
          else
            pseudoC = 'A = A ' + ALU_OP[y] + hex8(n);
          break;
        }
        case 7: { // RST n
          const target = y * 8;
          mnemonic = 'RST'; operands = hex8(target);
          pseudoC = 'call ' + hex8(target);
          break;
        }
      }
    }

    if (!mnemonic) {
      mnemonic = 'db'; operands = hex8(op); pseudoC = '/* unknown */';
    }

    return { len, mnemonic, operands, pseudoC };
  }

  // -------------------------------------------------------------------------
  // CB prefix (bit operations)
  // -------------------------------------------------------------------------

  function decodeCB(bytes, pos, gb) {
    const op = readU8(bytes, pos + 1);
    const x = (op >> 6) & 3;
    const y = (op >> 3) & 7;
    const z = op & 7;

    let mnemonic, operands, pseudoC;

    if (x === 0) {
      // Rotation/shift
      if (gb && y === 6) { // SLL slot in GB is SWAP
        mnemonic = 'SWAP'; operands = R8[z];
        pseudoC = R8[z] + ' = swap_nibbles(' + R8[z] + ')';
      } else {
        mnemonic = ROT[y]; operands = R8[z];
        switch (y) {
          case 0: pseudoC = R8[z] + ' = rotl(' + R8[z] + ', 1)'; break;
          case 1: pseudoC = R8[z] + ' = rotr(' + R8[z] + ', 1)'; break;
          case 2: pseudoC = R8[z] + ' = rl(' + R8[z] + ')'; break;
          case 3: pseudoC = R8[z] + ' = rr(' + R8[z] + ')'; break;
          case 4: pseudoC = R8[z] + ' = ' + R8[z] + ' << 1'; break;
          case 5: pseudoC = R8[z] + ' = (signed)' + R8[z] + ' >> 1'; break;
          case 6: pseudoC = R8[z] + ' = ' + R8[z] + ' << 1 | 1 /* undoc */'; break;
          case 7: pseudoC = R8[z] + ' = ' + R8[z] + ' >> 1'; break;
        }
      }
    } else if (x === 1) {
      // BIT b,r
      mnemonic = 'BIT'; operands = y + ',' + R8[z];
      pseudoC = 'Z = !(' + R8[z] + ' & ' + bitMask(y) + ')';
    } else if (x === 2) {
      // RES b,r
      mnemonic = 'RES'; operands = y + ',' + R8[z];
      pseudoC = R8[z] + ' &= ' + bitMaskInv(y);
    } else {
      // SET b,r
      mnemonic = 'SET'; operands = y + ',' + R8[z];
      pseudoC = R8[z] + ' |= ' + bitMask(y);
    }

    return { len: 2, mnemonic, operands, pseudoC };
  }

  // -------------------------------------------------------------------------
  // DD CB / FD CB prefix (indexed bit operations)
  // -------------------------------------------------------------------------

  function decodeIXYCB(bytes, pos, regName) {
    // DD CB d op  or  FD CB d op  (4 bytes total)
    const d = signedByte(readU8(bytes, pos + 2));
    const op = readU8(bytes, pos + 3);
    const x = (op >> 6) & 3;
    const y = (op >> 3) & 7;
    const z = op & 7;
    const mem = '(' + regName + fmtDisp(d) + ')';

    let mnemonic, operands, pseudoC;

    if (x === 0) {
      // Rotation/shift on (IX/IY+d), optionally storing in register
      mnemonic = ROT[y]; operands = mem;
      switch (y) {
        case 0: pseudoC = mem + ' = rotl(' + mem + ', 1)'; break;
        case 1: pseudoC = mem + ' = rotr(' + mem + ', 1)'; break;
        case 2: pseudoC = mem + ' = rl(' + mem + ')'; break;
        case 3: pseudoC = mem + ' = rr(' + mem + ')'; break;
        case 4: pseudoC = mem + ' = ' + mem + ' << 1'; break;
        case 5: pseudoC = mem + ' = (signed)' + mem + ' >> 1'; break;
        case 6: pseudoC = mem + ' = ' + mem + ' << 1 | 1 /* undoc */'; break;
        case 7: pseudoC = mem + ' = ' + mem + ' >> 1'; break;
      }
      if (z !== 6) {
        operands += ',' + R8[z];
        pseudoC += '; ' + R8[z] + ' = ' + mem;
      }
    } else if (x === 1) {
      mnemonic = 'BIT'; operands = y + ',' + mem;
      pseudoC = 'Z = !(' + mem + ' & ' + bitMask(y) + ')';
    } else if (x === 2) {
      mnemonic = 'RES'; operands = y + ',' + mem;
      pseudoC = mem + ' &= ' + bitMaskInv(y);
      if (z !== 6) {
        operands += ',' + R8[z];
        pseudoC += '; ' + R8[z] + ' = ' + mem;
      }
    } else {
      mnemonic = 'SET'; operands = y + ',' + mem;
      pseudoC = mem + ' |= ' + bitMask(y);
      if (z !== 6) {
        operands += ',' + R8[z];
        pseudoC += '; ' + R8[z] + ' = ' + mem;
      }
    }

    return { len: 4, mnemonic, operands, pseudoC };
  }

  // -------------------------------------------------------------------------
  // DD/FD prefix (IX/IY variants)
  // -------------------------------------------------------------------------

  function decodeIXY(bytes, pos, regName) {
    const op = readU8(bytes, pos + 1);

    // DD CB / FD CB -> indexed bit ops
    if (op === 0xCB)
      return decodeIXYCB(bytes, pos, regName);

    const rH = regName === 'IX' ? 'IXH' : 'IYH';
    const rL = regName === 'IX' ? 'IXL' : 'IYL';

    // Substitute HL->IX/IY, H->IXH/IYH, L->IXL/IYL, (HL)->(IX+d)/(IY+d) in base opcodes
    const x = (op >> 6) & 3;
    const y = (op >> 3) & 7;
    const z = op & 7;
    const p = y >> 1;
    const q = y & 1;

    // Helper to map register indices for IXY prefix
    function r8ixy(idx) {
      if (idx === 4) return rH;
      if (idx === 5) return rL;
      if (idx === 6) return null; // signals (IX/IY+d) needed
      return R8[idx];
    }

    // --- x=0 block ---
    if (x === 0) {
      switch (z) {
        case 1:
          if (q === 0 && p === 2) { // LD IX/IY,nn
            const nn = readU16(bytes, pos + 2);
            return { len: 4, mnemonic: 'LD', operands: regName + ',' + hex16(nn), pseudoC: regName + ' = ' + hex16(nn) };
          }
          if (q === 1 && p === 2) { // ADD IX/IY,rp
            return { len: 2, mnemonic: 'ADD', operands: regName + ',' + regName, pseudoC: regName + ' = ' + regName + ' + ' + regName };
          }
          if (q === 1) { // ADD IX/IY,rp
            const rpName = p === 2 ? regName : RP[p];
            return { len: 2, mnemonic: 'ADD', operands: regName + ',' + rpName, pseudoC: regName + ' = ' + regName + ' + ' + rpName };
          }
          if (q === 0) { // LD rp,nn (non-HL pair unchanged, but prefix consumed)
            const nn = readU16(bytes, pos + 2);
            return { len: 4, mnemonic: 'LD', operands: RP[p] + ',' + hex16(nn), pseudoC: RP[p] + ' = ' + hex16(nn) };
          }
          break;
        case 2:
          if (q === 0 && p === 2) { // LD (nn),IX/IY
            const nn = readU16(bytes, pos + 2);
            return { len: 4, mnemonic: 'LD', operands: '(' + hex16(nn) + '),' + regName, pseudoC: '*' + hex16(nn) + ' = ' + regName };
          }
          if (q === 1 && p === 2) { // LD IX/IY,(nn)
            const nn = readU16(bytes, pos + 2);
            return { len: 4, mnemonic: 'LD', operands: regName + ',(' + hex16(nn) + ')', pseudoC: regName + ' = *' + hex16(nn) };
          }
          break;
        case 3:
          if (p === 2) {
            if (q === 0) return { len: 2, mnemonic: 'INC', operands: regName, pseudoC: '++' + regName };
            return { len: 2, mnemonic: 'DEC', operands: regName, pseudoC: '--' + regName };
          }
          break;
        case 4: { // INC r (with IXY substitution)
          if (y === 6) { // INC (IX/IY+d)
            const d = signedByte(readU8(bytes, pos + 2));
            const mem = '(' + regName + fmtDisp(d) + ')';
            return { len: 3, mnemonic: 'INC', operands: mem, pseudoC: '++' + mem };
          }
          const reg = r8ixy(y);
          if (reg && reg !== R8[y])
            return { len: 2, mnemonic: 'INC', operands: reg, pseudoC: '++' + reg };
          break;
        }
        case 5: { // DEC r
          if (y === 6) {
            const d = signedByte(readU8(bytes, pos + 2));
            const mem = '(' + regName + fmtDisp(d) + ')';
            return { len: 3, mnemonic: 'DEC', operands: mem, pseudoC: '--' + mem };
          }
          const reg = r8ixy(y);
          if (reg && reg !== R8[y])
            return { len: 2, mnemonic: 'DEC', operands: reg, pseudoC: '--' + reg };
          break;
        }
        case 6: { // LD r,n (with IXY substitution)
          if (y === 6) { // LD (IX/IY+d),n
            const d = signedByte(readU8(bytes, pos + 2));
            const n = readU8(bytes, pos + 3);
            const mem = '(' + regName + fmtDisp(d) + ')';
            return { len: 4, mnemonic: 'LD', operands: mem + ',' + hex8(n), pseudoC: mem + ' = ' + hex8(n) };
          }
          const reg = r8ixy(y);
          if (reg && reg !== R8[y]) {
            const n = readU8(bytes, pos + 2);
            return { len: 3, mnemonic: 'LD', operands: reg + ',' + hex8(n), pseudoC: reg + ' = ' + hex8(n) };
          }
          break;
        }
      }
    }

    // --- x=1 block: LD r,r' with IXY substitution ---
    if (x === 1) {
      // If both src and dst are (HL) slot, it's HALT which is not affected
      if (y === 6 && z === 6)
        return { len: 2, mnemonic: 'HALT', operands: '', pseudoC: 'halt()' };

      const dstIsMem = (y === 6);
      const srcIsMem = (z === 6);

      if (dstIsMem || srcIsMem) {
        // One operand is (IX/IY+d)
        const d = signedByte(readU8(bytes, pos + 2));
        const mem = '(' + regName + fmtDisp(d) + ')';
        if (dstIsMem) {
          // LD (IX/IY+d),r  -- src uses plain R8 (not IXH/IXL)
          return { len: 3, mnemonic: 'LD', operands: mem + ',' + R8[z], pseudoC: mem + ' = ' + R8[z] };
        }
        // LD r,(IX/IY+d)  -- dst uses plain R8
        return { len: 3, mnemonic: 'LD', operands: R8[y] + ',' + mem, pseudoC: R8[y] + ' = ' + mem };
      }

      // Neither is (HL), so substitute H/L -> IXH/IXL etc.
      const dst = r8ixy(y) || R8[y];
      const src = r8ixy(z) || R8[z];
      if (dst !== R8[y] || src !== R8[z])
        return { len: 2, mnemonic: 'LD', operands: dst + ',' + src, pseudoC: dst + ' = ' + src };
    }

    // --- x=2 block: ALU A,r with IXY substitution ---
    if (x === 2) {
      if (z === 6) { // ALU A,(IX/IY+d)
        const d = signedByte(readU8(bytes, pos + 2));
        const mem = '(' + regName + fmtDisp(d) + ')';
        const mn = ALU[y];
        if (y === 7)
          return { len: 3, mnemonic: mn, operands: 'A,' + mem, pseudoC: 'flags = A - ' + mem };
        return { len: 3, mnemonic: mn, operands: 'A,' + mem, pseudoC: 'A = A ' + ALU_OP[y] + mem };
      }
      const reg = r8ixy(z);
      if (reg && reg !== R8[z]) {
        const mn = ALU[y];
        if (y === 7)
          return { len: 2, mnemonic: mn, operands: 'A,' + reg, pseudoC: 'flags = A - ' + reg };
        return { len: 2, mnemonic: mn, operands: 'A,' + reg, pseudoC: 'A = A ' + ALU_OP[y] + reg };
      }
    }

    // --- x=3 block ---
    if (x === 3) {
      switch (z) {
        case 1:
          if (q === 1 && p === 2) { // JP (IX/IY)
            return { len: 2, mnemonic: 'JP', operands: '(' + regName + ')', pseudoC: 'goto *' + regName };
          }
          if (q === 1 && p === 3) { // LD SP,IX/IY
            return { len: 2, mnemonic: 'LD', operands: 'SP,' + regName, pseudoC: 'SP = ' + regName };
          }
          if (q === 0 && p === 2) { // POP IX/IY
            return { len: 2, mnemonic: 'POP', operands: regName, pseudoC: regName + ' = pop()' };
          }
          break;
        case 3:
          if (y === 4) { // EX (SP),IX/IY
            return { len: 2, mnemonic: 'EX', operands: '(SP),' + regName, pseudoC: 'swap(*SP, ' + regName + ')' };
          }
          break;
        case 5:
          if (q === 0 && p === 2) { // PUSH IX/IY
            return { len: 2, mnemonic: 'PUSH', operands: regName, pseudoC: 'push(' + regName + ')' };
          }
          break;
      }
    }

    // Prefix not meaningful for this opcode -- treat as NOP prefix + re-decode
    // (The prefix is consumed but the following byte is interpreted as a normal opcode)
    const inner = decodeBase(bytes, pos + 1, false);
    if (inner)
      return { len: inner.len + 1, mnemonic: inner.mnemonic, operands: inner.operands, pseudoC: inner.pseudoC };

    return { len: 2, mnemonic: 'db', operands: hex8(readU8(bytes, pos)) + ',' + hex8(op), pseudoC: '/* unknown IX/IY */' };
  }

  // -------------------------------------------------------------------------
  // ED prefix (extended instructions)
  // -------------------------------------------------------------------------

  function decodeED(bytes, pos) {
    const op = readU8(bytes, pos + 1);
    const x = (op >> 6) & 3;
    const y = (op >> 3) & 7;
    const z = op & 7;
    const p = y >> 1;
    const q = y & 1;

    // Only x=1 and x=2 blocks are defined; others are NOP/invalid
    if (x === 1) {
      switch (z) {
        case 0: // IN r,(C)
          if (y === 6)
            return { len: 2, mnemonic: 'IN', operands: '(C)', pseudoC: 'flags = in(C)' };
          return { len: 2, mnemonic: 'IN', operands: R8[y] + ',(C)', pseudoC: R8[y] + ' = in(C)' };
        case 1: // OUT (C),r
          if (y === 6)
            return { len: 2, mnemonic: 'OUT', operands: '(C),0', pseudoC: 'out(C, 0)' };
          return { len: 2, mnemonic: 'OUT', operands: '(C),' + R8[y], pseudoC: 'out(C, ' + R8[y] + ')' };
        case 2: // SBC HL,rp / ADC HL,rp
          if (q === 0)
            return { len: 2, mnemonic: 'SBC', operands: 'HL,' + RP[p], pseudoC: 'HL = HL - ' + RP[p] + ' - !C' };
          return { len: 2, mnemonic: 'ADC', operands: 'HL,' + RP[p], pseudoC: 'HL = HL + ' + RP[p] + ' + C' };
        case 3: { // LD (nn),rp / LD rp,(nn)
          const nn = readU16(bytes, pos + 2);
          if (q === 0)
            return { len: 4, mnemonic: 'LD', operands: '(' + hex16(nn) + '),' + RP[p], pseudoC: '*' + hex16(nn) + ' = ' + RP[p] };
          return { len: 4, mnemonic: 'LD', operands: RP[p] + ',(' + hex16(nn) + ')', pseudoC: RP[p] + ' = *' + hex16(nn) };
        }
        case 4: // NEG
          return { len: 2, mnemonic: 'NEG', operands: '', pseudoC: 'A = -A' };
        case 5: // RETN / RETI
          if (y === 1)
            return { len: 2, mnemonic: 'RETI', operands: '', pseudoC: 'return /* interrupt */' };
          return { len: 2, mnemonic: 'RETN', operands: '', pseudoC: 'return /* NMI */' };
        case 6: { // IM n
          const modes = [0, 0, 1, 2, 0, 0, 1, 2];
          return { len: 2, mnemonic: 'IM', operands: '' + modes[y], pseudoC: 'interrupt_mode = ' + modes[y] };
        }
        case 7:
          switch (y) {
            case 0: return { len: 2, mnemonic: 'LD', operands: 'I,A', pseudoC: 'I = A' };
            case 1: return { len: 2, mnemonic: 'LD', operands: 'R,A', pseudoC: 'R = A' };
            case 2: return { len: 2, mnemonic: 'LD', operands: 'A,I', pseudoC: 'A = I' };
            case 3: return { len: 2, mnemonic: 'LD', operands: 'A,R', pseudoC: 'A = R' };
            case 4: return { len: 2, mnemonic: 'RRD', operands: '', pseudoC: 'rrd(A, *HL)' };
            case 5: return { len: 2, mnemonic: 'RLD', operands: '', pseudoC: 'rld(A, *HL)' };
            case 6: return { len: 2, mnemonic: 'NOP', operands: '', pseudoC: '/* nop */' };
            case 7: return { len: 2, mnemonic: 'NOP', operands: '', pseudoC: '/* nop */' };
          }
          break;
      }
    }

    if (x === 2 && y >= 4 && z <= 3) {
      // Block instructions
      const BLK_MN = [
        ['LDI', 'CPI', 'INI', 'OUTI'],   // y=4
        ['LDD', 'CPD', 'IND', 'OUTD'],   // y=5
        ['LDIR', 'CPIR', 'INIR', 'OTIR'], // y=6
        ['LDDR', 'CPDR', 'INDR', 'OTDR'], // y=7
      ];
      const BLK_PC = [
        ['*DE++ = *HL++; --BC', 'compare(A, *HL++); --BC', '*HL++ = in(C); --B', 'out(C, *HL++); --B'],
        ['*DE-- = *HL--; --BC', 'compare(A, *HL--); --BC', '*HL-- = in(C); --B', 'out(C, *HL--); --B'],
        ['do { *DE++ = *HL++; } while(--BC)', 'do { compare(A, *HL++); } while(--BC && !Z)', 'do { *HL++ = in(C); } while(--B)', 'do { out(C, *HL++); } while(--B)'],
        ['do { *DE-- = *HL--; } while(--BC)', 'do { compare(A, *HL--); } while(--BC && !Z)', 'do { *HL-- = in(C); } while(--B)', 'do { out(C, *HL--); } while(--B)'],
      ];

      const row = y - 4;
      return { len: 2, mnemonic: BLK_MN[row][z], operands: '', pseudoC: BLK_PC[row][z] };
    }

    // Undefined ED opcodes act as NOPs
    return { len: 2, mnemonic: 'NOP', operands: '/* ED ' + hex8(op) + ' */', pseudoC: '/* nop */' };
  }

  // -------------------------------------------------------------------------
  // Main decode entry point
  // -------------------------------------------------------------------------

  function decode(bytes, offset, maxCount, opts) {
    const results = [];
    const gb = !!(opts && opts.gameboy);
    const start = offset || 0;
    const count = maxCount || 256;
    let pos = start;

    for (let i = 0; i < count && pos < bytes.length; ++i) {
      const op = readU8(bytes, pos);
      let insn = null;

      if (op === 0xCB) {
        // CB prefix: bit operations
        if (pos + 1 < bytes.length)
          insn = decodeCB(bytes, pos, gb);
      } else if (op === 0xDD && !gb) {
        // DD prefix: IX variants
        if (pos + 1 < bytes.length)
          insn = decodeIXY(bytes, pos, 'IX');
      } else if (op === 0xFD && !gb) {
        // FD prefix: IY variants
        if (pos + 1 < bytes.length)
          insn = decodeIXY(bytes, pos, 'IY');
      } else if (op === 0xED && !gb) {
        // ED prefix: extended instructions
        if (pos + 1 < bytes.length)
          insn = decodeED(bytes, pos);
      } else {
        insn = decodeBase(bytes, pos, gb);
      }

      if (!insn) {
        // Fallback for unrecognized or incomplete prefix
        results.push({
          offset: pos,
          length: 1,
          bytes: formatBytes(bytes, pos, 1),
          mnemonic: 'db',
          operands: hex8(op),
          pseudoC: '/* invalid */',
        });
        ++pos;
        continue;
      }

      results.push({
        offset: pos,
        length: insn.len,
        bytes: formatBytes(bytes, pos, insn.len),
        mnemonic: insn.mnemonic,
        operands: insn.operands,
        pseudoC: insn.pseudoC,
      });

      pos += insn.len;
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  D.registerDisassembler('z80', decode);

})();
