# BCJ RISC-V

> Branch/Call/Jump filter for RISC-V machine code. Rewrites JAL (Jump and Link) instructions with rd = ra or rd = t0, and AUIPC-led pc-relative register pairs, from byte-relative immediates into an absolute byte address so repeated calls and jumps to the same target produce identical byte sequences.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Lasse Collin (Tukaani Project) |
| Year | 2024 |
| Origin | 🌐 International |
| Source | [`algorithms/compression/bcj-riscv.js`](../../../algorithms/compression/bcj-riscv.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [xz File Format / liblzma simple filters](https://tukaani.org/xz/xz-file-format.txt)
- [liblzma RISC-V filter source](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c)

## References

- [The RISC-V Instruction Set Manual, Volume I (J-type / JAL)](https://github.com/riscv/riscv-isa-manual)
- [Tukaani Project (xz-utils)](https://tukaani.org/xz/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty buffer](https://tukaani.org/xz/xz-file-format.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [JAL rd=x0 (plain jump) - opcode 0x6F byte is NOT filtered, only rd=ra/t0 are](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c)

| Field | Value |
| --- | --- |
| `input` | `6f0000000000000000000000` |
| `expected` | `6f0000000000000000000000` |

**Vector 3** — [JAL rd=ra, imm=0, at a nonzero pc - byte-relative immediate rewritten to absolute](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c)

| Field | Value |
| --- | --- |
| `input` | `00000000ef0000000000000000000000` |
| `expected` | `00000000ef0000020000000000000000` |

**Vector 4** — [AUIPC register-pair, 'real' form (rd != x0, x2) rewritten to canonical form](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c)

| Field | Value |
| --- | --- |
| `input` | `970000000380000000000000` |
| `expected` | `173100080000000000000000` |

**Vector 5** — [AUIPC register-pair, 'fake' bijective form (rd = x0/x2) rewritten back](https://github.com/tukaani-project/xz/blob/master/src/liblzma/simple/riscv.c)

| Field | Value |
| --- | --- |
| `input` | `173100080000000000000000` |
| `expected` | `970000000380000000000000` |

---

[← All algorithms](../README.md)
