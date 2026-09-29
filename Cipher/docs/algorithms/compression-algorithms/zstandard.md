# Zstandard

> Zstandard (Zstd), RFC 8878. Encoder performs genuine LZ77 compression: a hash-chain match finder produces sequences that are FSE-coded (Predefined_Mode distribution tables) with correct repeat-offset resolution, and literals are Huffman-coded (single-stream, direct tree-weight description) where the literals-section header grammar allows it; each block independently falls back to RLE or Raw when that would be smaller, or when Huffman/FSE isn't applicable (e.g. literal alphabets spanning byte values >=128, or literal counts >=1024, use Raw_Literals so FSE-coded sequences still carry the compression). Decoder reads full frames produced by real Zstd encoders, including Huffman-coded literals (raw/RLE/compressed/treeless) and FSE-coded sequences (predefined/RLE/FSE-compressed/repeat distribution tables) with repeat-offset resolution.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary + Entropy |
| Security status | Not classified |
| Complexity | Expert |
| Inventor | Yann Collet |
| Year | 2016 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/zstd.js`](../../../algorithms/compression/zstd.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 8878: Zstandard Compression and the 'application/zstd' Media Type](https://www.rfc-editor.org/rfc/rfc8878)
- [Official Zstd Repository](https://github.com/facebook/zstd)
- [Zstd Format Specification](https://github.com/facebook/zstd/blob/dev/doc/zstd_compression_format.md)
- [FSE Documentation](https://github.com/Cyan4973/FiniteStateEntropy)

## References

- [Facebook Zstd](https://github.com/facebook/zstd)
- [RFC 8878 Full Text](https://www.rfc-editor.org/rfc/rfc8878.txt)
- [Finite State Entropy](https://github.com/Cyan4973/FiniteStateEntropy)
- [LZ4 (by same author)](https://github.com/lz4/lz4)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Self-consistent - Raw block, short input](https://www.rfc-editor.org/rfc/rfc8878)

| Field | Value |
| --- | --- |
| `input` | `68656c6c6f` |
| `expected` | `28b52ffd200529000068656c6c6f` |

**Vector 2** — [Self-consistent - RLE block, repeated byte](https://www.rfc-editor.org/rfc/rfc8878)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141` |
| `expected` | `28b52ffd200a53000041` |

**Vector 3** — [Self-consistent - Empty frame](https://www.rfc-editor.org/rfc/rfc8878)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `28b52ffd2000010000` |

**Vector 4** — [Round-trip - 300 bytes pseudo-random (2-byte content size)](https://www.rfc-editor.org/rfc/rfc8878)

| Field | Value |
| --- | --- |
| `input` | `80000000000000004000000000004000 00400040800040000000000040000000 4080c000000000000000000000000000 00400000000040004080c00000000000 …` (300 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 5** — [Round-trip - 200000 bytes pseudo-random, spans multiple blocks](https://www.rfc-editor.org/rfc/rfc8878)

| Field | Value |
| --- | --- |
| `input` | `0b30557a9fc4e90e33587da2c7ec1136 5b80a5caef14395e83a8cdf2173c6186 abd0f51a3f6489aed3f81d42678cb1d6 fb20456a8fb4d9fe23486d92b7dc0126 …` (200000 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 6** — [Round-trip - 150000 repeated bytes, spans multiple RLE blocks](https://www.rfc-editor.org/rfc/rfc8878)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 …` (150000 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
