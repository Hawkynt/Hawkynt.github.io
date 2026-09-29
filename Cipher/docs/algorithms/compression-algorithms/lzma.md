# LZMA

> Lempel-Ziv-Markov chain Algorithm. Dictionary compression combining hash-chain match finding with an adaptive binary range coder and context-modelled literal, length and distance coders.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Igor Pavlov |
| Year | 2001 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/lzma.js`](../../../algorithms/compression/lzma.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [7-Zip LZMA SDK](https://www.7-zip.org/sdk.html)
- [Wikipedia - LZMA](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm)

## References

- [LZMA Specification](https://www.7-zip.org/recover.html)
- [Range Encoding Theory](http://www.compressconsult.com/rangecoder/)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - properties, zero size and the end marker only](https://www.7-zip.org/sdk.html)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `5d00001000000000000083fffbffffc0000000` |

**Vector 2** — [Single byte literal](https://www.7-zip.org/sdk.html)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `5d00001000010000000020c1fbffffffe0000000` |

**Vector 3** — [Hello string - five literals](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f` |
| `expected` | `5d00001000050000000024194986e7dc81a809fffc917000` |

**Vector 4** — [ABABAB pattern - two literals then a distance-2 match](http://www.compressconsult.com/rangecoder/)

| Field | Value |
| --- | --- |
| `input` | `414241424142` |
| `expected` | `5d00001000060000000020909e06107bdffffef84000` |

**Vector 5** — [AAAA repetition - self-referential distance-1 match](https://www.7-zip.org/recover.html)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `5d00001000040000000020e8bdffffffffe0000000` |

**Vector 6** — [Hello World text](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `5d000010000b0000000024194986e7d5e56ab57f1092370048ffffc2c00000` |

**Vector 7** — [Repetitive run (24 bytes) - overlapping match longer than its distance](https://www.7-zip.org/sdk.html)

| Field | Value |
| --- | --- |
| `input` | `616161616161616161616161616161616161616161616161` |
| `expected` | `5d00001000180000000030ee0707ffffffff80000000` |

**Vector 8** — [Alternating pattern (16 bytes)](https://www.7-zip.org/sdk.html)

| Field | Value |
| --- | --- |
| `input` | `61626162616261626162616261626162` |
| `expected` | `5d0000100010000000003098a60307bfffffff84000000` |

**Vector 9** — [Binary sample with high-bit-set bytes](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Markov_chain_algorithm)

| Field | Value |
| --- | --- |
| `input` | `ff80ab007f80fffe0180818200ff7e10` |
| `expected` | `5d0000100010000000007fa0116003f9 139ae212a38c4f9550a246d60ba22fff ff853a0000` |

---

[← All algorithms](../README.md)
