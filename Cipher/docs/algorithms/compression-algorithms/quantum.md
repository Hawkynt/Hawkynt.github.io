# Quantum

> LZ77 dictionary matching combined with an adaptive arithmetic coder; the compression method Microsoft licensed from David Stafford's Quantum archiver for use inside Cabinet (.CAB) files alongside DEFLATE and LZX.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Hybrid |
| Security status | Not classified |
| Complexity | Expert |
| Inventor | David Stafford (licensed by Microsoft Corporation) |
| Year | 1995 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/quantum.js`](../../../algorithms/compression/quantum.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Quantum compression format - Matthew Russotto](http://www.russotto.net/quantumcomp.html)
- [libmspack documentation (CAB/Quantum/LZX formats) - Stuart Caie](https://www.cabextract.org.uk/libmspack/doc/)

## References

- [libmspack source repository](https://github.com/kyz/libmspack)
- [Cabinet (file format) - Wikipedia](https://en.wikipedia.org/wiki/Cabinet_(file_format))
- [LZX - Wikipedia](https://en.wikipedia.org/wiki/LZX)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Quantum round-trip - empty input](http://www.russotto.net/quantumcomp.html)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Quantum round-trip - single byte](http://www.russotto.net/quantumcomp.html)

| Field | Value |
| --- | --- |
| `input` | `51` |
| `expected` | _(empty)_ |

**Vector 3** — [Quantum round-trip - long repetitive run (300 bytes of 0x41)](http://www.russotto.net/quantumcomp.html)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 …` (300 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 4** — [Quantum round-trip - alternating byte pattern (0x00/0xFF)](http://www.russotto.net/quantumcomp.html)

| Field | Value |
| --- | --- |
| `input` | `00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff 00ff00ff00ff00ff00ff00ff00ff00ff` |
| `expected` | _(empty)_ |

**Vector 5** — [Quantum round-trip - pseudo-random binary sample](http://www.russotto.net/quantumcomp.html)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000004000000000 40004080c0004080c000004000000038 00408000000000408080000000000000 000000400000000040004079c0000000 00000040000000000040000040780038 00382080000000400040000000000000 00000000400040000000000000400000 00004000000000400000000000000000 39004000004080c00000000040000000 00400000000000003800000000004000 00400000000000400000000000000039 00000000000000000000000040800000 0000000000400000` |
| `expected` | _(empty)_ |

**Vector 6** — [Quantum round-trip - spec-flavoured text vector](https://www.cabextract.org.uk/libmspack/doc/)

| Field | Value |
| --- | --- |
| `input` | `4d6963726f736f667420436162696e65 74205175616e74756d20636f6d707265 7373696f6e202d204c5a3737206d6174 6368657320656e74726f707920636f64 6564207769746820616e206164617074 6976652061726974686d657469632063 6f6465722c206c6963656e7365642066 726f6d2044617669642053746166666f 726420666f72204341422066696c6573 20636972636120313939352e` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
