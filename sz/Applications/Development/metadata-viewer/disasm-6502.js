;(function() {
  'use strict';
  const D = window.SZ && SZ.Disassembler;
  if (!D) return;

  // =========================================================================
  // MOS 6502 + WDC 65C816 Disassembler
  // =========================================================================

  // ---- addressing modes ----
  const IMP  = 'imp';   // Implicit
  const ACC  = 'acc';   // Accumulator
  const IMM  = 'imm';   // Immediate #$nn
  const ZP   = 'zp';    // Zero Page $nn
  const ZPX  = 'zpx';   // Zero Page,X $nn,X
  const ZPY  = 'zpy';   // Zero Page,Y $nn,Y
  const ABS  = 'abs';   // Absolute $nnnn
  const ABX  = 'abx';   // Absolute,X $nnnn,X
  const ABY  = 'aby';   // Absolute,Y $nnnn,Y
  const IND  = 'ind';   // Indirect ($nnnn)
  const IZX  = 'izx';   // (Indirect,X) ($nn,X)
  const IZY  = 'izy';   // (Indirect),Y ($nn),Y
  const REL  = 'rel';   // Relative (branch)

  // 65C816 additional modes
  const STK  = 'stk';   // Stack Relative $nn,S
  const SIY  = 'siy';   // Stack Relative Indirect Indexed ($nn,S),Y
  const DPL  = 'dpl';   // Direct Page Indirect Long [$nn]
  const DPLY = 'dply';  // Direct Page Indirect Long Indexed [$nn],Y
  const ABL  = 'abl';   // Absolute Long $nnnnnn
  const ABLX = 'ablx';  // Absolute Long Indexed $nnnnnn,X
  const BLK  = 'blk';   // Block Move $nn,$nn
  const RLL  = 'rll';   // Relative Long (16-bit offset)
  const IDZ  = 'idz';   // (Indirect) - ZP ($nn)  [65C02/816]
  const IAX  = 'iax';   // (Absolute,X) [65C02/816]

  // ---- byte sizes per addressing mode ----
  const MODE_BYTES = {
    [IMP]: 1, [ACC]: 1, [IMM]: 2, [ZP]: 2, [ZPX]: 2, [ZPY]: 2,
    [ABS]: 3, [ABX]: 3, [ABY]: 3, [IND]: 3, [IZX]: 2, [IZY]: 2,
    [REL]: 2, [STK]: 2, [SIY]: 2, [DPL]: 2, [DPLY]: 2,
    [ABL]: 4, [ABLX]: 4, [BLK]: 3, [RLL]: 3, [IDZ]: 2, [IAX]: 3,
  };

  // ---- helpers ----

  function readU8(bytes, o) {
    return o < bytes.length ? bytes[o] : 0;
  }

  function readU16(bytes, o) {
    return o + 1 < bytes.length ? (bytes[o] | (bytes[o + 1] << 8)) : 0;
  }

  function readU24(bytes, o) {
    return o + 2 < bytes.length ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16)) : 0;
  }

  function hex8(v) {
    return '$' + (v & 0xFF).toString(16).toUpperCase().padStart(2, '0');
  }

  function hex16(v) {
    return '$' + (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  }

  function hex24(v) {
    return '$' + (v & 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
  }

  function cHex8(v) {
    return '0x' + (v & 0xFF).toString(16).toUpperCase().padStart(2, '0');
  }

  function cHex16(v) {
    return '0x' + (v & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  }

  function cHex24(v) {
    return '0x' + (v & 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
  }

  function signedByte(v) {
    return (v & 0xFF) > 0x7F ? (v & 0xFF) - 256 : (v & 0xFF);
  }

  function signedWord(v) {
    return (v & 0xFFFF) > 0x7FFF ? (v & 0xFFFF) - 65536 : (v & 0xFFFF);
  }

  // =========================================================================
  // NMOS 6502 opcode table (all 256 entries)
  // =========================================================================
  // Unofficial/illegal opcodes are marked with a '*' suffix in the mnemonic comment.

  const OPCODES_6502 = [
    /* 00 */ { m: 'BRK', mode: IMP,  bytes: 1 },
    /* 01 */ { m: 'ORA', mode: IZX,  bytes: 2 },
    /* 02 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* 03 */ { m: 'SLO', mode: IZX,  bytes: 2, illegal: true },
    /* 04 */ { m: 'NOP', mode: ZP,   bytes: 2, illegal: true },
    /* 05 */ { m: 'ORA', mode: ZP,   bytes: 2 },
    /* 06 */ { m: 'ASL', mode: ZP,   bytes: 2 },
    /* 07 */ { m: 'SLO', mode: ZP,   bytes: 2, illegal: true },
    /* 08 */ { m: 'PHP', mode: IMP,  bytes: 1 },
    /* 09 */ { m: 'ORA', mode: IMM,  bytes: 2 },
    /* 0A */ { m: 'ASL', mode: ACC,  bytes: 1 },
    /* 0B */ { m: 'ANC', mode: IMM,  bytes: 2, illegal: true },
    /* 0C */ { m: 'NOP', mode: ABS,  bytes: 3, illegal: true },
    /* 0D */ { m: 'ORA', mode: ABS,  bytes: 3 },
    /* 0E */ { m: 'ASL', mode: ABS,  bytes: 3 },
    /* 0F */ { m: 'SLO', mode: ABS,  bytes: 3, illegal: true },

    /* 10 */ { m: 'BPL', mode: REL,  bytes: 2 },
    /* 11 */ { m: 'ORA', mode: IZY,  bytes: 2 },
    /* 12 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* 13 */ { m: 'SLO', mode: IZY,  bytes: 2, illegal: true },
    /* 14 */ { m: 'NOP', mode: ZPX,  bytes: 2, illegal: true },
    /* 15 */ { m: 'ORA', mode: ZPX,  bytes: 2 },
    /* 16 */ { m: 'ASL', mode: ZPX,  bytes: 2 },
    /* 17 */ { m: 'SLO', mode: ZPX,  bytes: 2, illegal: true },
    /* 18 */ { m: 'CLC', mode: IMP,  bytes: 1 },
    /* 19 */ { m: 'ORA', mode: ABY,  bytes: 3 },
    /* 1A */ { m: 'NOP', mode: IMP,  bytes: 1, illegal: true },
    /* 1B */ { m: 'SLO', mode: ABY,  bytes: 3, illegal: true },
    /* 1C */ { m: 'NOP', mode: ABX,  bytes: 3, illegal: true },
    /* 1D */ { m: 'ORA', mode: ABX,  bytes: 3 },
    /* 1E */ { m: 'ASL', mode: ABX,  bytes: 3 },
    /* 1F */ { m: 'SLO', mode: ABX,  bytes: 3, illegal: true },

    /* 20 */ { m: 'JSR', mode: ABS,  bytes: 3 },
    /* 21 */ { m: 'AND', mode: IZX,  bytes: 2 },
    /* 22 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* 23 */ { m: 'RLA', mode: IZX,  bytes: 2, illegal: true },
    /* 24 */ { m: 'BIT', mode: ZP,   bytes: 2 },
    /* 25 */ { m: 'AND', mode: ZP,   bytes: 2 },
    /* 26 */ { m: 'ROL', mode: ZP,   bytes: 2 },
    /* 27 */ { m: 'RLA', mode: ZP,   bytes: 2, illegal: true },
    /* 28 */ { m: 'PLP', mode: IMP,  bytes: 1 },
    /* 29 */ { m: 'AND', mode: IMM,  bytes: 2 },
    /* 2A */ { m: 'ROL', mode: ACC,  bytes: 1 },
    /* 2B */ { m: 'ANC', mode: IMM,  bytes: 2, illegal: true },
    /* 2C */ { m: 'BIT', mode: ABS,  bytes: 3 },
    /* 2D */ { m: 'AND', mode: ABS,  bytes: 3 },
    /* 2E */ { m: 'ROL', mode: ABS,  bytes: 3 },
    /* 2F */ { m: 'RLA', mode: ABS,  bytes: 3, illegal: true },

    /* 30 */ { m: 'BMI', mode: REL,  bytes: 2 },
    /* 31 */ { m: 'AND', mode: IZY,  bytes: 2 },
    /* 32 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* 33 */ { m: 'RLA', mode: IZY,  bytes: 2, illegal: true },
    /* 34 */ { m: 'NOP', mode: ZPX,  bytes: 2, illegal: true },
    /* 35 */ { m: 'AND', mode: ZPX,  bytes: 2 },
    /* 36 */ { m: 'ROL', mode: ZPX,  bytes: 2 },
    /* 37 */ { m: 'RLA', mode: ZPX,  bytes: 2, illegal: true },
    /* 38 */ { m: 'SEC', mode: IMP,  bytes: 1 },
    /* 39 */ { m: 'AND', mode: ABY,  bytes: 3 },
    /* 3A */ { m: 'NOP', mode: IMP,  bytes: 1, illegal: true },
    /* 3B */ { m: 'RLA', mode: ABY,  bytes: 3, illegal: true },
    /* 3C */ { m: 'NOP', mode: ABX,  bytes: 3, illegal: true },
    /* 3D */ { m: 'AND', mode: ABX,  bytes: 3 },
    /* 3E */ { m: 'ROL', mode: ABX,  bytes: 3 },
    /* 3F */ { m: 'RLA', mode: ABX,  bytes: 3, illegal: true },

    /* 40 */ { m: 'RTI', mode: IMP,  bytes: 1 },
    /* 41 */ { m: 'EOR', mode: IZX,  bytes: 2 },
    /* 42 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* 43 */ { m: 'SRE', mode: IZX,  bytes: 2, illegal: true },
    /* 44 */ { m: 'NOP', mode: ZP,   bytes: 2, illegal: true },
    /* 45 */ { m: 'EOR', mode: ZP,   bytes: 2 },
    /* 46 */ { m: 'LSR', mode: ZP,   bytes: 2 },
    /* 47 */ { m: 'SRE', mode: ZP,   bytes: 2, illegal: true },
    /* 48 */ { m: 'PHA', mode: IMP,  bytes: 1 },
    /* 49 */ { m: 'EOR', mode: IMM,  bytes: 2 },
    /* 4A */ { m: 'LSR', mode: ACC,  bytes: 1 },
    /* 4B */ { m: 'ALR', mode: IMM,  bytes: 2, illegal: true },
    /* 4C */ { m: 'JMP', mode: ABS,  bytes: 3 },
    /* 4D */ { m: 'EOR', mode: ABS,  bytes: 3 },
    /* 4E */ { m: 'LSR', mode: ABS,  bytes: 3 },
    /* 4F */ { m: 'SRE', mode: ABS,  bytes: 3, illegal: true },

    /* 50 */ { m: 'BVC', mode: REL,  bytes: 2 },
    /* 51 */ { m: 'EOR', mode: IZY,  bytes: 2 },
    /* 52 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* 53 */ { m: 'SRE', mode: IZY,  bytes: 2, illegal: true },
    /* 54 */ { m: 'NOP', mode: ZPX,  bytes: 2, illegal: true },
    /* 55 */ { m: 'EOR', mode: ZPX,  bytes: 2 },
    /* 56 */ { m: 'LSR', mode: ZPX,  bytes: 2 },
    /* 57 */ { m: 'SRE', mode: ZPX,  bytes: 2, illegal: true },
    /* 58 */ { m: 'CLI', mode: IMP,  bytes: 1 },
    /* 59 */ { m: 'EOR', mode: ABY,  bytes: 3 },
    /* 5A */ { m: 'NOP', mode: IMP,  bytes: 1, illegal: true },
    /* 5B */ { m: 'SRE', mode: ABY,  bytes: 3, illegal: true },
    /* 5C */ { m: 'NOP', mode: ABX,  bytes: 3, illegal: true },
    /* 5D */ { m: 'EOR', mode: ABX,  bytes: 3 },
    /* 5E */ { m: 'LSR', mode: ABX,  bytes: 3 },
    /* 5F */ { m: 'SRE', mode: ABX,  bytes: 3, illegal: true },

    /* 60 */ { m: 'RTS', mode: IMP,  bytes: 1 },
    /* 61 */ { m: 'ADC', mode: IZX,  bytes: 2 },
    /* 62 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* 63 */ { m: 'RRA', mode: IZX,  bytes: 2, illegal: true },
    /* 64 */ { m: 'NOP', mode: ZP,   bytes: 2, illegal: true },
    /* 65 */ { m: 'ADC', mode: ZP,   bytes: 2 },
    /* 66 */ { m: 'ROR', mode: ZP,   bytes: 2 },
    /* 67 */ { m: 'RRA', mode: ZP,   bytes: 2, illegal: true },
    /* 68 */ { m: 'PLA', mode: IMP,  bytes: 1 },
    /* 69 */ { m: 'ADC', mode: IMM,  bytes: 2 },
    /* 6A */ { m: 'ROR', mode: ACC,  bytes: 1 },
    /* 6B */ { m: 'ARR', mode: IMM,  bytes: 2, illegal: true },
    /* 6C */ { m: 'JMP', mode: IND,  bytes: 3 },
    /* 6D */ { m: 'ADC', mode: ABS,  bytes: 3 },
    /* 6E */ { m: 'ROR', mode: ABS,  bytes: 3 },
    /* 6F */ { m: 'RRA', mode: ABS,  bytes: 3, illegal: true },

    /* 70 */ { m: 'BVS', mode: REL,  bytes: 2 },
    /* 71 */ { m: 'ADC', mode: IZY,  bytes: 2 },
    /* 72 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* 73 */ { m: 'RRA', mode: IZY,  bytes: 2, illegal: true },
    /* 74 */ { m: 'NOP', mode: ZPX,  bytes: 2, illegal: true },
    /* 75 */ { m: 'ADC', mode: ZPX,  bytes: 2 },
    /* 76 */ { m: 'ROR', mode: ZPX,  bytes: 2 },
    /* 77 */ { m: 'RRA', mode: ZPX,  bytes: 2, illegal: true },
    /* 78 */ { m: 'SEI', mode: IMP,  bytes: 1 },
    /* 79 */ { m: 'ADC', mode: ABY,  bytes: 3 },
    /* 7A */ { m: 'NOP', mode: IMP,  bytes: 1, illegal: true },
    /* 7B */ { m: 'RRA', mode: ABY,  bytes: 3, illegal: true },
    /* 7C */ { m: 'NOP', mode: ABX,  bytes: 3, illegal: true },
    /* 7D */ { m: 'ADC', mode: ABX,  bytes: 3 },
    /* 7E */ { m: 'ROR', mode: ABX,  bytes: 3 },
    /* 7F */ { m: 'RRA', mode: ABX,  bytes: 3, illegal: true },

    /* 80 */ { m: 'NOP', mode: IMM,  bytes: 2, illegal: true },
    /* 81 */ { m: 'STA', mode: IZX,  bytes: 2 },
    /* 82 */ { m: 'NOP', mode: IMM,  bytes: 2, illegal: true },
    /* 83 */ { m: 'SAX', mode: IZX,  bytes: 2, illegal: true },
    /* 84 */ { m: 'STY', mode: ZP,   bytes: 2 },
    /* 85 */ { m: 'STA', mode: ZP,   bytes: 2 },
    /* 86 */ { m: 'STX', mode: ZP,   bytes: 2 },
    /* 87 */ { m: 'SAX', mode: ZP,   bytes: 2, illegal: true },
    /* 88 */ { m: 'DEY', mode: IMP,  bytes: 1 },
    /* 89 */ { m: 'NOP', mode: IMM,  bytes: 2, illegal: true },
    /* 8A */ { m: 'TXA', mode: IMP,  bytes: 1 },
    /* 8B */ { m: 'XAA', mode: IMM,  bytes: 2, illegal: true },
    /* 8C */ { m: 'STY', mode: ABS,  bytes: 3 },
    /* 8D */ { m: 'STA', mode: ABS,  bytes: 3 },
    /* 8E */ { m: 'STX', mode: ABS,  bytes: 3 },
    /* 8F */ { m: 'SAX', mode: ABS,  bytes: 3, illegal: true },

    /* 90 */ { m: 'BCC', mode: REL,  bytes: 2 },
    /* 91 */ { m: 'STA', mode: IZY,  bytes: 2 },
    /* 92 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* 93 */ { m: 'AHX', mode: IZY,  bytes: 2, illegal: true },
    /* 94 */ { m: 'STY', mode: ZPX,  bytes: 2 },
    /* 95 */ { m: 'STA', mode: ZPX,  bytes: 2 },
    /* 96 */ { m: 'STX', mode: ZPY,  bytes: 2 },
    /* 97 */ { m: 'SAX', mode: ZPY,  bytes: 2, illegal: true },
    /* 98 */ { m: 'TYA', mode: IMP,  bytes: 1 },
    /* 99 */ { m: 'STA', mode: ABY,  bytes: 3 },
    /* 9A */ { m: 'TXS', mode: IMP,  bytes: 1 },
    /* 9B */ { m: 'TAS', mode: ABY,  bytes: 3, illegal: true },
    /* 9C */ { m: 'SHY', mode: ABX,  bytes: 3, illegal: true },
    /* 9D */ { m: 'STA', mode: ABX,  bytes: 3 },
    /* 9E */ { m: 'SHX', mode: ABY,  bytes: 3, illegal: true },
    /* 9F */ { m: 'AHX', mode: ABY,  bytes: 3, illegal: true },

    /* A0 */ { m: 'LDY', mode: IMM,  bytes: 2 },
    /* A1 */ { m: 'LDA', mode: IZX,  bytes: 2 },
    /* A2 */ { m: 'LDX', mode: IMM,  bytes: 2 },
    /* A3 */ { m: 'LAX', mode: IZX,  bytes: 2, illegal: true },
    /* A4 */ { m: 'LDY', mode: ZP,   bytes: 2 },
    /* A5 */ { m: 'LDA', mode: ZP,   bytes: 2 },
    /* A6 */ { m: 'LDX', mode: ZP,   bytes: 2 },
    /* A7 */ { m: 'LAX', mode: ZP,   bytes: 2, illegal: true },
    /* A8 */ { m: 'TAY', mode: IMP,  bytes: 1 },
    /* A9 */ { m: 'LDA', mode: IMM,  bytes: 2 },
    /* AA */ { m: 'TAX', mode: IMP,  bytes: 1 },
    /* AB */ { m: 'LAX', mode: IMM,  bytes: 2, illegal: true },
    /* AC */ { m: 'LDY', mode: ABS,  bytes: 3 },
    /* AD */ { m: 'LDA', mode: ABS,  bytes: 3 },
    /* AE */ { m: 'LDX', mode: ABS,  bytes: 3 },
    /* AF */ { m: 'LAX', mode: ABS,  bytes: 3, illegal: true },

    /* B0 */ { m: 'BCS', mode: REL,  bytes: 2 },
    /* B1 */ { m: 'LDA', mode: IZY,  bytes: 2 },
    /* B2 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* B3 */ { m: 'LAX', mode: IZY,  bytes: 2, illegal: true },
    /* B4 */ { m: 'LDY', mode: ZPX,  bytes: 2 },
    /* B5 */ { m: 'LDA', mode: ZPX,  bytes: 2 },
    /* B6 */ { m: 'LDX', mode: ZPY,  bytes: 2 },
    /* B7 */ { m: 'LAX', mode: ZPY,  bytes: 2, illegal: true },
    /* B8 */ { m: 'CLV', mode: IMP,  bytes: 1 },
    /* B9 */ { m: 'LDA', mode: ABY,  bytes: 3 },
    /* BA */ { m: 'TSX', mode: IMP,  bytes: 1 },
    /* BB */ { m: 'LAS', mode: ABY,  bytes: 3, illegal: true },
    /* BC */ { m: 'LDY', mode: ABX,  bytes: 3 },
    /* BD */ { m: 'LDA', mode: ABX,  bytes: 3 },
    /* BE */ { m: 'LDX', mode: ABY,  bytes: 3 },
    /* BF */ { m: 'LAX', mode: ABY,  bytes: 3, illegal: true },

    /* C0 */ { m: 'CPY', mode: IMM,  bytes: 2 },
    /* C1 */ { m: 'CMP', mode: IZX,  bytes: 2 },
    /* C2 */ { m: 'NOP', mode: IMM,  bytes: 2, illegal: true },
    /* C3 */ { m: 'DCP', mode: IZX,  bytes: 2, illegal: true },
    /* C4 */ { m: 'CPY', mode: ZP,   bytes: 2 },
    /* C5 */ { m: 'CMP', mode: ZP,   bytes: 2 },
    /* C6 */ { m: 'DEC', mode: ZP,   bytes: 2 },
    /* C7 */ { m: 'DCP', mode: ZP,   bytes: 2, illegal: true },
    /* C8 */ { m: 'INY', mode: IMP,  bytes: 1 },
    /* C9 */ { m: 'CMP', mode: IMM,  bytes: 2 },
    /* CA */ { m: 'DEX', mode: IMP,  bytes: 1 },
    /* CB */ { m: 'AXS', mode: IMM,  bytes: 2, illegal: true },
    /* CC */ { m: 'CPY', mode: ABS,  bytes: 3 },
    /* CD */ { m: 'CMP', mode: ABS,  bytes: 3 },
    /* CE */ { m: 'DEC', mode: ABS,  bytes: 3 },
    /* CF */ { m: 'DCP', mode: ABS,  bytes: 3, illegal: true },

    /* D0 */ { m: 'BNE', mode: REL,  bytes: 2 },
    /* D1 */ { m: 'CMP', mode: IZY,  bytes: 2 },
    /* D2 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* D3 */ { m: 'DCP', mode: IZY,  bytes: 2, illegal: true },
    /* D4 */ { m: 'NOP', mode: ZPX,  bytes: 2, illegal: true },
    /* D5 */ { m: 'CMP', mode: ZPX,  bytes: 2 },
    /* D6 */ { m: 'DEC', mode: ZPX,  bytes: 2 },
    /* D7 */ { m: 'DCP', mode: ZPX,  bytes: 2, illegal: true },
    /* D8 */ { m: 'CLD', mode: IMP,  bytes: 1 },
    /* D9 */ { m: 'CMP', mode: ABY,  bytes: 3 },
    /* DA */ { m: 'NOP', mode: IMP,  bytes: 1, illegal: true },
    /* DB */ { m: 'DCP', mode: ABY,  bytes: 3, illegal: true },
    /* DC */ { m: 'NOP', mode: ABX,  bytes: 3, illegal: true },
    /* DD */ { m: 'CMP', mode: ABX,  bytes: 3 },
    /* DE */ { m: 'DEC', mode: ABX,  bytes: 3 },
    /* DF */ { m: 'DCP', mode: ABX,  bytes: 3, illegal: true },

    /* E0 */ { m: 'CPX', mode: IMM,  bytes: 2 },
    /* E1 */ { m: 'SBC', mode: IZX,  bytes: 2 },
    /* E2 */ { m: 'NOP', mode: IMM,  bytes: 2, illegal: true },
    /* E3 */ { m: 'ISC', mode: IZX,  bytes: 2, illegal: true },
    /* E4 */ { m: 'CPX', mode: ZP,   bytes: 2 },
    /* E5 */ { m: 'SBC', mode: ZP,   bytes: 2 },
    /* E6 */ { m: 'INC', mode: ZP,   bytes: 2 },
    /* E7 */ { m: 'ISC', mode: ZP,   bytes: 2, illegal: true },
    /* E8 */ { m: 'INX', mode: IMP,  bytes: 1 },
    /* E9 */ { m: 'SBC', mode: IMM,  bytes: 2 },
    /* EA */ { m: 'NOP', mode: IMP,  bytes: 1 },
    /* EB */ { m: 'SBC', mode: IMM,  bytes: 2, illegal: true },
    /* EC */ { m: 'CPX', mode: ABS,  bytes: 3 },
    /* ED */ { m: 'SBC', mode: ABS,  bytes: 3 },
    /* EE */ { m: 'INC', mode: ABS,  bytes: 3 },
    /* EF */ { m: 'ISC', mode: ABS,  bytes: 3, illegal: true },

    /* F0 */ { m: 'BEQ', mode: REL,  bytes: 2 },
    /* F1 */ { m: 'SBC', mode: IZY,  bytes: 2 },
    /* F2 */ { m: 'KIL', mode: IMP,  bytes: 1, illegal: true },
    /* F3 */ { m: 'ISC', mode: IZY,  bytes: 2, illegal: true },
    /* F4 */ { m: 'NOP', mode: ZPX,  bytes: 2, illegal: true },
    /* F5 */ { m: 'SBC', mode: ZPX,  bytes: 2 },
    /* F6 */ { m: 'INC', mode: ZPX,  bytes: 2 },
    /* F7 */ { m: 'ISC', mode: ZPX,  bytes: 2, illegal: true },
    /* F8 */ { m: 'SED', mode: IMP,  bytes: 1 },
    /* F9 */ { m: 'SBC', mode: ABY,  bytes: 3 },
    /* FA */ { m: 'NOP', mode: IMP,  bytes: 1, illegal: true },
    /* FB */ { m: 'ISC', mode: ABY,  bytes: 3, illegal: true },
    /* FC */ { m: 'NOP', mode: ABX,  bytes: 3, illegal: true },
    /* FD */ { m: 'SBC', mode: ABX,  bytes: 3 },
    /* FE */ { m: 'INC', mode: ABX,  bytes: 3 },
    /* FF */ { m: 'ISC', mode: ABX,  bytes: 3, illegal: true },
  ];

  // =========================================================================
  // WDC 65C816 opcode table (all 256 entries)
  // Replaces illegal 6502 opcodes with official 65C816 instructions
  // =========================================================================

  const OPCODES_65C816 = [
    /* 00 */ { m: 'BRK', mode: IMP,  bytes: 2 },   // BRK #nn on 65C816 (signature byte)
    /* 01 */ { m: 'ORA', mode: IZX,  bytes: 2 },
    /* 02 */ { m: 'COP', mode: IMM,  bytes: 2 },
    /* 03 */ { m: 'ORA', mode: STK,  bytes: 2 },
    /* 04 */ { m: 'TSB', mode: ZP,   bytes: 2 },
    /* 05 */ { m: 'ORA', mode: ZP,   bytes: 2 },
    /* 06 */ { m: 'ASL', mode: ZP,   bytes: 2 },
    /* 07 */ { m: 'ORA', mode: DPL,  bytes: 2 },
    /* 08 */ { m: 'PHP', mode: IMP,  bytes: 1 },
    /* 09 */ { m: 'ORA', mode: IMM,  bytes: 2 },
    /* 0A */ { m: 'ASL', mode: ACC,  bytes: 1 },
    /* 0B */ { m: 'PHD', mode: IMP,  bytes: 1 },
    /* 0C */ { m: 'TSB', mode: ABS,  bytes: 3 },
    /* 0D */ { m: 'ORA', mode: ABS,  bytes: 3 },
    /* 0E */ { m: 'ASL', mode: ABS,  bytes: 3 },
    /* 0F */ { m: 'ORA', mode: ABL,  bytes: 4 },

    /* 10 */ { m: 'BPL', mode: REL,  bytes: 2 },
    /* 11 */ { m: 'ORA', mode: IZY,  bytes: 2 },
    /* 12 */ { m: 'ORA', mode: IDZ,  bytes: 2 },
    /* 13 */ { m: 'ORA', mode: SIY,  bytes: 2 },
    /* 14 */ { m: 'TRB', mode: ZP,   bytes: 2 },
    /* 15 */ { m: 'ORA', mode: ZPX,  bytes: 2 },
    /* 16 */ { m: 'ASL', mode: ZPX,  bytes: 2 },
    /* 17 */ { m: 'ORA', mode: DPLY, bytes: 2 },
    /* 18 */ { m: 'CLC', mode: IMP,  bytes: 1 },
    /* 19 */ { m: 'ORA', mode: ABY,  bytes: 3 },
    /* 1A */ { m: 'INC', mode: ACC,  bytes: 1 },
    /* 1B */ { m: 'TCS', mode: IMP,  bytes: 1 },
    /* 1C */ { m: 'TRB', mode: ABS,  bytes: 3 },
    /* 1D */ { m: 'ORA', mode: ABX,  bytes: 3 },
    /* 1E */ { m: 'ASL', mode: ABX,  bytes: 3 },
    /* 1F */ { m: 'ORA', mode: ABLX, bytes: 4 },

    /* 20 */ { m: 'JSR', mode: ABS,  bytes: 3 },
    /* 21 */ { m: 'AND', mode: IZX,  bytes: 2 },
    /* 22 */ { m: 'JSL', mode: ABL,  bytes: 4 },
    /* 23 */ { m: 'AND', mode: STK,  bytes: 2 },
    /* 24 */ { m: 'BIT', mode: ZP,   bytes: 2 },
    /* 25 */ { m: 'AND', mode: ZP,   bytes: 2 },
    /* 26 */ { m: 'ROL', mode: ZP,   bytes: 2 },
    /* 27 */ { m: 'AND', mode: DPL,  bytes: 2 },
    /* 28 */ { m: 'PLP', mode: IMP,  bytes: 1 },
    /* 29 */ { m: 'AND', mode: IMM,  bytes: 2 },
    /* 2A */ { m: 'ROL', mode: ACC,  bytes: 1 },
    /* 2B */ { m: 'PLD', mode: IMP,  bytes: 1 },
    /* 2C */ { m: 'BIT', mode: ABS,  bytes: 3 },
    /* 2D */ { m: 'AND', mode: ABS,  bytes: 3 },
    /* 2E */ { m: 'ROL', mode: ABS,  bytes: 3 },
    /* 2F */ { m: 'AND', mode: ABL,  bytes: 4 },

    /* 30 */ { m: 'BMI', mode: REL,  bytes: 2 },
    /* 31 */ { m: 'AND', mode: IZY,  bytes: 2 },
    /* 32 */ { m: 'AND', mode: IDZ,  bytes: 2 },
    /* 33 */ { m: 'AND', mode: SIY,  bytes: 2 },
    /* 34 */ { m: 'BIT', mode: ZPX,  bytes: 2 },
    /* 35 */ { m: 'AND', mode: ZPX,  bytes: 2 },
    /* 36 */ { m: 'ROL', mode: ZPX,  bytes: 2 },
    /* 37 */ { m: 'AND', mode: DPLY, bytes: 2 },
    /* 38 */ { m: 'SEC', mode: IMP,  bytes: 1 },
    /* 39 */ { m: 'AND', mode: ABY,  bytes: 3 },
    /* 3A */ { m: 'DEC', mode: ACC,  bytes: 1 },
    /* 3B */ { m: 'TSC', mode: IMP,  bytes: 1 },
    /* 3C */ { m: 'BIT', mode: ABX,  bytes: 3 },
    /* 3D */ { m: 'AND', mode: ABX,  bytes: 3 },
    /* 3E */ { m: 'ROL', mode: ABX,  bytes: 3 },
    /* 3F */ { m: 'AND', mode: ABLX, bytes: 4 },

    /* 40 */ { m: 'RTI', mode: IMP,  bytes: 1 },
    /* 41 */ { m: 'EOR', mode: IZX,  bytes: 2 },
    /* 42 */ { m: 'WDM', mode: IMM,  bytes: 2 },
    /* 43 */ { m: 'EOR', mode: STK,  bytes: 2 },
    /* 44 */ { m: 'MVP', mode: BLK,  bytes: 3 },
    /* 45 */ { m: 'EOR', mode: ZP,   bytes: 2 },
    /* 46 */ { m: 'LSR', mode: ZP,   bytes: 2 },
    /* 47 */ { m: 'EOR', mode: DPL,  bytes: 2 },
    /* 48 */ { m: 'PHA', mode: IMP,  bytes: 1 },
    /* 49 */ { m: 'EOR', mode: IMM,  bytes: 2 },
    /* 4A */ { m: 'LSR', mode: ACC,  bytes: 1 },
    /* 4B */ { m: 'PHK', mode: IMP,  bytes: 1 },
    /* 4C */ { m: 'JMP', mode: ABS,  bytes: 3 },
    /* 4D */ { m: 'EOR', mode: ABS,  bytes: 3 },
    /* 4E */ { m: 'LSR', mode: ABS,  bytes: 3 },
    /* 4F */ { m: 'EOR', mode: ABL,  bytes: 4 },

    /* 50 */ { m: 'BVC', mode: REL,  bytes: 2 },
    /* 51 */ { m: 'EOR', mode: IZY,  bytes: 2 },
    /* 52 */ { m: 'EOR', mode: IDZ,  bytes: 2 },
    /* 53 */ { m: 'EOR', mode: SIY,  bytes: 2 },
    /* 54 */ { m: 'MVN', mode: BLK,  bytes: 3 },
    /* 55 */ { m: 'EOR', mode: ZPX,  bytes: 2 },
    /* 56 */ { m: 'LSR', mode: ZPX,  bytes: 2 },
    /* 57 */ { m: 'EOR', mode: DPLY, bytes: 2 },
    /* 58 */ { m: 'CLI', mode: IMP,  bytes: 1 },
    /* 59 */ { m: 'EOR', mode: ABY,  bytes: 3 },
    /* 5A */ { m: 'PHY', mode: IMP,  bytes: 1 },
    /* 5B */ { m: 'TCD', mode: IMP,  bytes: 1 },
    /* 5C */ { m: 'JML', mode: ABL,  bytes: 4 },
    /* 5D */ { m: 'EOR', mode: ABX,  bytes: 3 },
    /* 5E */ { m: 'LSR', mode: ABX,  bytes: 3 },
    /* 5F */ { m: 'EOR', mode: ABLX, bytes: 4 },

    /* 60 */ { m: 'RTS', mode: IMP,  bytes: 1 },
    /* 61 */ { m: 'ADC', mode: IZX,  bytes: 2 },
    /* 62 */ { m: 'PER', mode: RLL,  bytes: 3 },
    /* 63 */ { m: 'ADC', mode: STK,  bytes: 2 },
    /* 64 */ { m: 'STZ', mode: ZP,   bytes: 2 },
    /* 65 */ { m: 'ADC', mode: ZP,   bytes: 2 },
    /* 66 */ { m: 'ROR', mode: ZP,   bytes: 2 },
    /* 67 */ { m: 'ADC', mode: DPL,  bytes: 2 },
    /* 68 */ { m: 'PLA', mode: IMP,  bytes: 1 },
    /* 69 */ { m: 'ADC', mode: IMM,  bytes: 2 },
    /* 6A */ { m: 'ROR', mode: ACC,  bytes: 1 },
    /* 6B */ { m: 'RTL', mode: IMP,  bytes: 1 },
    /* 6C */ { m: 'JMP', mode: IND,  bytes: 3 },
    /* 6D */ { m: 'ADC', mode: ABS,  bytes: 3 },
    /* 6E */ { m: 'ROR', mode: ABS,  bytes: 3 },
    /* 6F */ { m: 'ADC', mode: ABL,  bytes: 4 },

    /* 70 */ { m: 'BVS', mode: REL,  bytes: 2 },
    /* 71 */ { m: 'ADC', mode: IZY,  bytes: 2 },
    /* 72 */ { m: 'ADC', mode: IDZ,  bytes: 2 },
    /* 73 */ { m: 'ADC', mode: SIY,  bytes: 2 },
    /* 74 */ { m: 'STZ', mode: ZPX,  bytes: 2 },
    /* 75 */ { m: 'ADC', mode: ZPX,  bytes: 2 },
    /* 76 */ { m: 'ROR', mode: ZPX,  bytes: 2 },
    /* 77 */ { m: 'ADC', mode: DPLY, bytes: 2 },
    /* 78 */ { m: 'SEI', mode: IMP,  bytes: 1 },
    /* 79 */ { m: 'ADC', mode: ABY,  bytes: 3 },
    /* 7A */ { m: 'PLY', mode: IMP,  bytes: 1 },
    /* 7B */ { m: 'TDC', mode: IMP,  bytes: 1 },
    /* 7C */ { m: 'JMP', mode: IAX,  bytes: 3 },
    /* 7D */ { m: 'ADC', mode: ABX,  bytes: 3 },
    /* 7E */ { m: 'ROR', mode: ABX,  bytes: 3 },
    /* 7F */ { m: 'ADC', mode: ABLX, bytes: 4 },

    /* 80 */ { m: 'BRA', mode: REL,  bytes: 2 },
    /* 81 */ { m: 'STA', mode: IZX,  bytes: 2 },
    /* 82 */ { m: 'BRL', mode: RLL,  bytes: 3 },
    /* 83 */ { m: 'STA', mode: STK,  bytes: 2 },
    /* 84 */ { m: 'STY', mode: ZP,   bytes: 2 },
    /* 85 */ { m: 'STA', mode: ZP,   bytes: 2 },
    /* 86 */ { m: 'STX', mode: ZP,   bytes: 2 },
    /* 87 */ { m: 'STA', mode: DPL,  bytes: 2 },
    /* 88 */ { m: 'DEY', mode: IMP,  bytes: 1 },
    /* 89 */ { m: 'BIT', mode: IMM,  bytes: 2 },
    /* 8A */ { m: 'TXA', mode: IMP,  bytes: 1 },
    /* 8B */ { m: 'PHB', mode: IMP,  bytes: 1 },
    /* 8C */ { m: 'STY', mode: ABS,  bytes: 3 },
    /* 8D */ { m: 'STA', mode: ABS,  bytes: 3 },
    /* 8E */ { m: 'STX', mode: ABS,  bytes: 3 },
    /* 8F */ { m: 'STA', mode: ABL,  bytes: 4 },

    /* 90 */ { m: 'BCC', mode: REL,  bytes: 2 },
    /* 91 */ { m: 'STA', mode: IZY,  bytes: 2 },
    /* 92 */ { m: 'STA', mode: IDZ,  bytes: 2 },
    /* 93 */ { m: 'STA', mode: SIY,  bytes: 2 },
    /* 94 */ { m: 'STY', mode: ZPX,  bytes: 2 },
    /* 95 */ { m: 'STA', mode: ZPX,  bytes: 2 },
    /* 96 */ { m: 'STX', mode: ZPY,  bytes: 2 },
    /* 97 */ { m: 'STA', mode: DPLY, bytes: 2 },
    /* 98 */ { m: 'TYA', mode: IMP,  bytes: 1 },
    /* 99 */ { m: 'STA', mode: ABY,  bytes: 3 },
    /* 9A */ { m: 'TXS', mode: IMP,  bytes: 1 },
    /* 9B */ { m: 'TXY', mode: IMP,  bytes: 1 },
    /* 9C */ { m: 'STZ', mode: ABS,  bytes: 3 },
    /* 9D */ { m: 'STA', mode: ABX,  bytes: 3 },
    /* 9E */ { m: 'STZ', mode: ABX,  bytes: 3 },
    /* 9F */ { m: 'STA', mode: ABLX, bytes: 4 },

    /* A0 */ { m: 'LDY', mode: IMM,  bytes: 2 },
    /* A1 */ { m: 'LDA', mode: IZX,  bytes: 2 },
    /* A2 */ { m: 'LDX', mode: IMM,  bytes: 2 },
    /* A3 */ { m: 'LDA', mode: STK,  bytes: 2 },
    /* A4 */ { m: 'LDY', mode: ZP,   bytes: 2 },
    /* A5 */ { m: 'LDA', mode: ZP,   bytes: 2 },
    /* A6 */ { m: 'LDX', mode: ZP,   bytes: 2 },
    /* A7 */ { m: 'LDA', mode: DPL,  bytes: 2 },
    /* A8 */ { m: 'TAY', mode: IMP,  bytes: 1 },
    /* A9 */ { m: 'LDA', mode: IMM,  bytes: 2 },
    /* AA */ { m: 'TAX', mode: IMP,  bytes: 1 },
    /* AB */ { m: 'PLB', mode: IMP,  bytes: 1 },
    /* AC */ { m: 'LDY', mode: ABS,  bytes: 3 },
    /* AD */ { m: 'LDA', mode: ABS,  bytes: 3 },
    /* AE */ { m: 'LDX', mode: ABS,  bytes: 3 },
    /* AF */ { m: 'LDA', mode: ABL,  bytes: 4 },

    /* B0 */ { m: 'BCS', mode: REL,  bytes: 2 },
    /* B1 */ { m: 'LDA', mode: IZY,  bytes: 2 },
    /* B2 */ { m: 'LDA', mode: IDZ,  bytes: 2 },
    /* B3 */ { m: 'LDA', mode: SIY,  bytes: 2 },
    /* B4 */ { m: 'LDY', mode: ZPX,  bytes: 2 },
    /* B5 */ { m: 'LDA', mode: ZPX,  bytes: 2 },
    /* B6 */ { m: 'LDX', mode: ZPY,  bytes: 2 },
    /* B7 */ { m: 'LDA', mode: DPLY, bytes: 2 },
    /* B8 */ { m: 'CLV', mode: IMP,  bytes: 1 },
    /* B9 */ { m: 'LDA', mode: ABY,  bytes: 3 },
    /* BA */ { m: 'TSX', mode: IMP,  bytes: 1 },
    /* BB */ { m: 'TYX', mode: IMP,  bytes: 1 },
    /* BC */ { m: 'LDY', mode: ABX,  bytes: 3 },
    /* BD */ { m: 'LDA', mode: ABX,  bytes: 3 },
    /* BE */ { m: 'LDX', mode: ABY,  bytes: 3 },
    /* BF */ { m: 'LDA', mode: ABLX, bytes: 4 },

    /* C0 */ { m: 'CPY', mode: IMM,  bytes: 2 },
    /* C1 */ { m: 'CMP', mode: IZX,  bytes: 2 },
    /* C2 */ { m: 'REP', mode: IMM,  bytes: 2 },
    /* C3 */ { m: 'CMP', mode: STK,  bytes: 2 },
    /* C4 */ { m: 'CPY', mode: ZP,   bytes: 2 },
    /* C5 */ { m: 'CMP', mode: ZP,   bytes: 2 },
    /* C6 */ { m: 'DEC', mode: ZP,   bytes: 2 },
    /* C7 */ { m: 'CMP', mode: DPL,  bytes: 2 },
    /* C8 */ { m: 'INY', mode: IMP,  bytes: 1 },
    /* C9 */ { m: 'CMP', mode: IMM,  bytes: 2 },
    /* CA */ { m: 'DEX', mode: IMP,  bytes: 1 },
    /* CB */ { m: 'WAI', mode: IMP,  bytes: 1 },
    /* CC */ { m: 'CPY', mode: ABS,  bytes: 3 },
    /* CD */ { m: 'CMP', mode: ABS,  bytes: 3 },
    /* CE */ { m: 'DEC', mode: ABS,  bytes: 3 },
    /* CF */ { m: 'CMP', mode: ABL,  bytes: 4 },

    /* D0 */ { m: 'BNE', mode: REL,  bytes: 2 },
    /* D1 */ { m: 'CMP', mode: IZY,  bytes: 2 },
    /* D2 */ { m: 'CMP', mode: IDZ,  bytes: 2 },
    /* D3 */ { m: 'CMP', mode: SIY,  bytes: 2 },
    /* D4 */ { m: 'PEI', mode: ZP,   bytes: 2 },
    /* D5 */ { m: 'CMP', mode: ZPX,  bytes: 2 },
    /* D6 */ { m: 'DEC', mode: ZPX,  bytes: 2 },
    /* D7 */ { m: 'CMP', mode: DPLY, bytes: 2 },
    /* D8 */ { m: 'CLD', mode: IMP,  bytes: 1 },
    /* D9 */ { m: 'CMP', mode: ABY,  bytes: 3 },
    /* DA */ { m: 'PHX', mode: IMP,  bytes: 1 },
    /* DB */ { m: 'STP', mode: IMP,  bytes: 1 },
    /* DC */ { m: 'JML', mode: IND,  bytes: 3 },
    /* DD */ { m: 'CMP', mode: ABX,  bytes: 3 },
    /* DE */ { m: 'DEC', mode: ABX,  bytes: 3 },
    /* DF */ { m: 'CMP', mode: ABLX, bytes: 4 },

    /* E0 */ { m: 'CPX', mode: IMM,  bytes: 2 },
    /* E1 */ { m: 'SBC', mode: IZX,  bytes: 2 },
    /* E2 */ { m: 'SEP', mode: IMM,  bytes: 2 },
    /* E3 */ { m: 'SBC', mode: STK,  bytes: 2 },
    /* E4 */ { m: 'CPX', mode: ZP,   bytes: 2 },
    /* E5 */ { m: 'SBC', mode: ZP,   bytes: 2 },
    /* E6 */ { m: 'INC', mode: ZP,   bytes: 2 },
    /* E7 */ { m: 'SBC', mode: DPL,  bytes: 2 },
    /* E8 */ { m: 'INX', mode: IMP,  bytes: 1 },
    /* E9 */ { m: 'SBC', mode: IMM,  bytes: 2 },
    /* EA */ { m: 'NOP', mode: IMP,  bytes: 1 },
    /* EB */ { m: 'XBA', mode: IMP,  bytes: 1 },
    /* EC */ { m: 'CPX', mode: ABS,  bytes: 3 },
    /* ED */ { m: 'SBC', mode: ABS,  bytes: 3 },
    /* EE */ { m: 'INC', mode: ABS,  bytes: 3 },
    /* EF */ { m: 'SBC', mode: ABL,  bytes: 4 },

    /* F0 */ { m: 'BEQ', mode: REL,  bytes: 2 },
    /* F1 */ { m: 'SBC', mode: IZY,  bytes: 2 },
    /* F2 */ { m: 'SBC', mode: IDZ,  bytes: 2 },
    /* F3 */ { m: 'SBC', mode: SIY,  bytes: 2 },
    /* F4 */ { m: 'PEA', mode: ABS,  bytes: 3 },
    /* F5 */ { m: 'SBC', mode: ZPX,  bytes: 2 },
    /* F6 */ { m: 'INC', mode: ZPX,  bytes: 2 },
    /* F7 */ { m: 'SBC', mode: DPLY, bytes: 2 },
    /* F8 */ { m: 'SED', mode: IMP,  bytes: 1 },
    /* F9 */ { m: 'SBC', mode: ABY,  bytes: 3 },
    /* FA */ { m: 'PLX', mode: IMP,  bytes: 1 },
    /* FB */ { m: 'XCE', mode: IMP,  bytes: 1 },
    /* FC */ { m: 'JSR', mode: IAX,  bytes: 3 },
    /* FD */ { m: 'SBC', mode: ABX,  bytes: 3 },
    /* FE */ { m: 'INC', mode: ABX,  bytes: 3 },
    /* FF */ { m: 'SBC', mode: ABLX, bytes: 4 },
  ];

  // =========================================================================
  // Operand formatting per addressing mode
  // =========================================================================

  function formatOperand(mode, bytes, offset, instrLen) {
    const b1 = readU8(bytes, offset + 1);
    const lo = readU16(bytes, offset + 1);
    const long = readU24(bytes, offset + 1);

    switch (mode) {
      case IMP: return '';
      case ACC: return 'A';
      case IMM: return '#' + hex8(b1);
      case ZP:  return hex8(b1);
      case ZPX: return hex8(b1) + ',X';
      case ZPY: return hex8(b1) + ',Y';
      case ABS: return hex16(lo);
      case ABX: return hex16(lo) + ',X';
      case ABY: return hex16(lo) + ',Y';
      case IND: return '(' + hex16(lo) + ')';
      case IZX: return '(' + hex8(b1) + ',X)';
      case IZY: return '(' + hex8(b1) + '),Y';
      case REL: {
        const target = (offset + 2 + signedByte(b1)) & 0xFFFF;
        return hex16(target);
      }
      // 65C816 modes
      case STK:  return hex8(b1) + ',S';
      case SIY:  return '(' + hex8(b1) + ',S),Y';
      case DPL:  return '[' + hex8(b1) + ']';
      case DPLY: return '[' + hex8(b1) + '],Y';
      case ABL:  return hex24(long);
      case ABLX: return hex24(long) + ',X';
      case BLK:  return hex8(b1) + ',' + hex8(readU8(bytes, offset + 2));
      case RLL: {
        const target = (offset + 3 + signedWord(lo)) & 0xFFFF;
        return hex16(target);
      }
      case IDZ:  return '(' + hex8(b1) + ')';
      case IAX:  return '(' + hex16(lo) + ',X)';
      default:   return '';
    }
  }

  // =========================================================================
  // Memory expression for pseudo-C (addressing mode -> C-like dereference)
  // =========================================================================

  function memExpr(mode, bytes, offset) {
    const b1 = readU8(bytes, offset + 1);
    const lo = readU16(bytes, offset + 1);
    const long = readU24(bytes, offset + 1);

    switch (mode) {
      case IMM:  return cHex8(b1);
      case ZP:   return '*' + cHex8(b1);
      case ZPX:  return '*(' + cHex8(b1) + ' + X)';
      case ZPY:  return '*(' + cHex8(b1) + ' + Y)';
      case ABS:  return '*' + cHex16(lo);
      case ABX:  return '*(' + cHex16(lo) + ' + X)';
      case ABY:  return '*(' + cHex16(lo) + ' + Y)';
      case IND:  return '**' + cHex16(lo);
      case IZX:  return '*(*(' + cHex8(b1) + ' + X))';
      case IZY:  return '(*(*' + cHex8(b1) + ') + Y)';
      case ACC:  return 'A';
      // 65C816 modes
      case STK:  return '*(SP + ' + cHex8(b1) + ')';
      case SIY:  return '(*(*(SP + ' + cHex8(b1) + ')) + Y)';
      case DPL:  return '**' + cHex8(b1);
      case DPLY: return '(*(*' + cHex8(b1) + ') + Y)';
      case ABL:  return '*' + cHex24(long);
      case ABLX: return '*(' + cHex24(long) + ' + X)';
      default:   return '??';
    }
  }

  // =========================================================================
  // Pseudo-C generation
  // =========================================================================

  // Branch condition flags for pseudo-C
  const BRANCH_COND = {
    BPL: '!N', BMI: 'N', BVC: '!V', BVS: 'V',
    BCC: '!C', BCS: 'C', BNE: '!Z', BEQ: 'Z',
    BRA: 'true', BRL: 'true',
  };

  function pseudoC(mnemonic, mode, bytes, offset, illegal) {
    const mn = mnemonic;
    const mem = (mode !== IMP && mode !== REL && mode !== RLL && mode !== BLK)
      ? memExpr(mode, bytes, offset)
      : '';

    // ---- Load/Store ----
    if (mn === 'LDA') return 'A = ' + mem;
    if (mn === 'LDX') return 'X = ' + mem;
    if (mn === 'LDY') return 'Y = ' + mem;
    if (mn === 'STA') return mem + ' = A';
    if (mn === 'STX') return mem + ' = X';
    if (mn === 'STY') return mem + ' = Y';
    if (mn === 'STZ') return mem + ' = 0';

    // ---- Transfer ----
    if (mn === 'TAX') return 'X = A';
    if (mn === 'TAY') return 'Y = A';
    if (mn === 'TXA') return 'A = X';
    if (mn === 'TYA') return 'A = Y';
    if (mn === 'TSX') return 'X = SP';
    if (mn === 'TXS') return 'SP = X';
    // 65C816 transfers
    if (mn === 'TCD') return 'D = A';
    if (mn === 'TDC') return 'A = D';
    if (mn === 'TCS') return 'SP = A';
    if (mn === 'TSC') return 'A = SP';
    if (mn === 'TXY') return 'Y = X';
    if (mn === 'TYX') return 'X = Y';
    if (mn === 'XBA') return 'swap(A.hi, A.lo)';
    if (mn === 'XCE') return 'swap(C, E)';

    // ---- Stack ----
    if (mn === 'PHA') return 'push(A)';
    if (mn === 'PLA') return 'A = pop()';
    if (mn === 'PHP') return 'push(P)';
    if (mn === 'PLP') return 'P = pop()';
    if (mn === 'PHX') return 'push(X)';
    if (mn === 'PHY') return 'push(Y)';
    if (mn === 'PLX') return 'X = pop()';
    if (mn === 'PLY') return 'Y = pop()';
    if (mn === 'PHD') return 'push(D)';
    if (mn === 'PLD') return 'D = pop()';
    if (mn === 'PHB') return 'push(DBR)';
    if (mn === 'PLB') return 'DBR = pop()';
    if (mn === 'PHK') return 'push(PBR)';
    if (mn === 'PEA') {
      const val = readU16(bytes, offset + 1);
      return 'push(' + cHex16(val) + ')';
    }
    if (mn === 'PEI') return 'push(' + mem + ')';
    if (mn === 'PER') {
      const target = (offset + 3 + signedWord(readU16(bytes, offset + 1))) & 0xFFFF;
      return 'push(' + cHex16(target) + ')';
    }

    // ---- Arithmetic ----
    if (mn === 'ADC') return 'A = A + ' + mem + ' + C';
    if (mn === 'SBC') return 'A = A - ' + mem + ' - !C';

    // ---- Logic ----
    if (mn === 'AND') return 'A &= ' + mem;
    if (mn === 'ORA') return 'A |= ' + mem;
    if (mn === 'EOR') return 'A ^= ' + mem;

    // ---- Shift/Rotate ----
    if (mn === 'ASL') return (mode === ACC ? 'A' : mem) + ' <<= 1';
    if (mn === 'LSR') return (mode === ACC ? 'A' : mem) + ' >>= 1';
    if (mn === 'ROL') return (mode === ACC ? 'A' : mem) + ' = ROL(' + (mode === ACC ? 'A' : mem) + ')';
    if (mn === 'ROR') return (mode === ACC ? 'A' : mem) + ' = ROR(' + (mode === ACC ? 'A' : mem) + ')';

    // ---- Increment/Decrement ----
    if (mn === 'INC') return mode === ACC ? '++A' : '++' + mem;
    if (mn === 'DEC') return mode === ACC ? '--A' : '--' + mem;
    if (mn === 'INX') return '++X';
    if (mn === 'DEX') return '--X';
    if (mn === 'INY') return '++Y';
    if (mn === 'DEY') return '--Y';

    // ---- Compare ----
    if (mn === 'CMP') return 'flags = A - ' + mem;
    if (mn === 'CPX') return 'flags = X - ' + mem;
    if (mn === 'CPY') return 'flags = Y - ' + mem;

    // ---- Bit test ----
    if (mn === 'BIT') return 'flags = A & ' + mem;
    if (mn === 'TSB') return mem + ' |= A';
    if (mn === 'TRB') return mem + ' &= ~A';

    // ---- Branch ----
    if (BRANCH_COND[mn]) {
      let target;
      if (mode === RLL)
        target = (offset + 3 + signedWord(readU16(bytes, offset + 1))) & 0xFFFF;
      else
        target = (offset + 2 + signedByte(readU8(bytes, offset + 1))) & 0xFFFF;
      const cond = BRANCH_COND[mn];
      if (cond === 'true')
        return 'goto ' + cHex16(target);
      return 'if (' + cond + ') goto ' + cHex16(target);
    }

    // ---- Jump/Call ----
    if (mn === 'JMP') {
      if (mode === ABL) return 'goto ' + cHex24(readU24(bytes, offset + 1));
      if (mode === IND) return 'goto **' + cHex16(readU16(bytes, offset + 1));
      if (mode === IAX) return 'goto *(' + cHex16(readU16(bytes, offset + 1)) + ' + X)';
      return 'goto ' + cHex16(readU16(bytes, offset + 1));
    }
    if (mn === 'JML') {
      if (mode === ABL) return 'goto ' + cHex24(readU24(bytes, offset + 1));
      if (mode === IND) return 'goto **' + cHex16(readU16(bytes, offset + 1));
      return 'goto ' + cHex16(readU16(bytes, offset + 1));
    }
    if (mn === 'JSR') {
      if (mode === IAX) return 'call *(' + cHex16(readU16(bytes, offset + 1)) + ' + X)';
      return 'call ' + cHex16(readU16(bytes, offset + 1));
    }
    if (mn === 'JSL') return 'call ' + cHex24(readU24(bytes, offset + 1));
    if (mn === 'RTS') return 'return';
    if (mn === 'RTI') return 'return /* interrupt */';
    if (mn === 'RTL') return 'return /* long */';

    // ---- Flag manipulation ----
    if (mn === 'CLC') return 'C = 0';
    if (mn === 'SEC') return 'C = 1';
    if (mn === 'CLI') return 'I = 0';
    if (mn === 'SEI') return 'I = 1';
    if (mn === 'CLV') return 'V = 0';
    if (mn === 'CLD') return 'D = 0';
    if (mn === 'SED') return 'D = 1';
    if (mn === 'REP') return 'P &= ~' + cHex8(readU8(bytes, offset + 1));
    if (mn === 'SEP') return 'P |= ' + cHex8(readU8(bytes, offset + 1));

    // ---- Misc ----
    if (mn === 'NOP') return '/* nop */';
    if (mn === 'BRK') return 'break /* IRQ */';
    if (mn === 'COP') return 'coprocessor(' + cHex8(readU8(bytes, offset + 1)) + ')';
    if (mn === 'WDM') return '/* reserved */';
    if (mn === 'STP') return 'halt()';
    if (mn === 'WAI') return 'wait_for_interrupt()';

    // ---- Block move ----
    if (mn === 'MVN' || mn === 'MVP') {
      const src = readU8(bytes, offset + 1);
      const dst = readU8(bytes, offset + 2);
      if (mn === 'MVN')
        return 'memcpy(dst:' + cHex8(dst) + ', src:' + cHex8(src) + ', ++C)';
      return 'memcpy_rev(dst:' + cHex8(dst) + ', src:' + cHex8(src) + ', ++C)';
    }

    // ---- Illegal/undocumented combos ----
    if (mn === 'LAX') return 'A = X = ' + mem;
    if (mn === 'SAX') return mem + ' = A & X';
    if (mn === 'DCP') return '--' + mem + '; flags = A - ' + mem;
    if (mn === 'ISC') return '++' + mem + '; A = A - ' + mem + ' - !C';
    if (mn === 'SLO') return mem + ' <<= 1; A |= ' + mem;
    if (mn === 'RLA') return mem + ' = ROL(' + mem + '); A &= ' + mem;
    if (mn === 'SRE') return mem + ' >>= 1; A ^= ' + mem;
    if (mn === 'RRA') return mem + ' = ROR(' + mem + '); A = A + ' + mem + ' + C';
    if (mn === 'ANC') return 'A &= ' + mem + '; C = N';
    if (mn === 'ALR') return 'A = (A & ' + mem + ') >> 1';
    if (mn === 'ARR') return 'A = ROR(A & ' + mem + ')';
    if (mn === 'XAA') return 'A = (A | 0xEE) & X & ' + mem;
    if (mn === 'AHX') return mem + ' = A & X & (addr_hi + 1)';
    if (mn === 'TAS') return 'SP = A & X; ' + mem + ' = A & X & (addr_hi + 1)';
    if (mn === 'SHX') return mem + ' = X & (addr_hi + 1)';
    if (mn === 'SHY') return mem + ' = Y & (addr_hi + 1)';
    if (mn === 'LAS') return 'A = X = SP = ' + mem + ' & SP';
    if (mn === 'AXS') return 'X = (A & X) - ' + mem;
    if (mn === 'KIL') return '/* CPU halted */';

    if (illegal)
      return '/* illegal: ' + mn + ' */';
    return '??';
  }

  // =========================================================================
  // Main decode function (batch mode)
  // =========================================================================

  function decode(bytes, offset, maxCount, opts) {
    const is816 = opts && opts.mode === '65c816';
    const table = is816 ? OPCODES_65C816 : OPCODES_6502;
    const results = [];
    let pos = offset || 0;
    const limit = maxCount || 256;

    for (let i = 0; i < limit && pos < bytes.length; ++i) {
      const opcode = readU8(bytes, pos);
      const entry = table[opcode];
      const len = entry.bytes;

      // Not enough bytes remaining -- emit raw data byte
      if (pos + len > bytes.length) {
        results.push({
          offset: pos,
          length: 1,
          bytes: bytes.slice(pos, pos + 1),
          mnemonic: 'db',
          operands: hex8(opcode),
          pseudoC: '/* truncated */',
        });
        ++pos;
        continue;
      }

      const instrBytes = bytes.slice(pos, pos + len);
      const mnemonic = entry.illegal ? '*' + entry.m : entry.m;
      const operands = formatOperand(entry.mode, bytes, pos, len);
      const pseudo = pseudoC(entry.m, entry.mode, bytes, pos, entry.illegal);

      results.push({
        offset: pos,
        length: len,
        bytes: instrBytes,
        mnemonic,
        operands,
        pseudoC: pseudo,
      });

      pos += len;
    }

    return results;
  }

  // =========================================================================
  // Registration
  // =========================================================================

  D.registerDisassembler('6502', decode);
  D.registerDisassembler('65c816', function(b, o, c, opts) {
    return decode(b, o, c, Object.assign({}, opts, { mode: '65c816' }));
  });

})();
