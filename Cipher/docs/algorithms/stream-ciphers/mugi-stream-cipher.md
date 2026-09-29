# MUGI Stream Cipher

> Educational implementation of MUGI stream cipher. MUGI is a word-oriented stream cipher with a 128-bit key and 128-bit internal state, designed for high-speed software implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Dai Watanabe, Soichi Furuya, Hirotaka Yoshida, Kazuo Takaragi, Bart Preneel |
| Year | 2002 |
| Origin | JP |
| Source | [`algorithms/stream/mugi.js`](../../../algorithms/stream/mugi.js) |

## Security

**Status:** 🎓 Educational Only

MUGI is a Japanese stream cipher designed for efficient software implementation. This educational version demonstrates the basic principles.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Hitachi MUGI Specification and Self-Evaluation Report](https://www.hitachi.com/rd/yrl/crypto/mugi/)
- [MUGI - Wikipedia](https://en.wikipedia.org/wiki/MUGI)
- [ISO/IEC 18033-4:2011 Encryption algorithms - Part 4: Stream ciphers](https://www.iso.org/standard/54531.html)

## References

- [Hitachi MUGI Specification Ver. 1.2 (reference algorithm description, PDF)](https://www.hitachi.com/rd/yrl/crypto/mugi/mugi_spe.pdf)
- [CRYPTREC Evaluation of the MUGI Pseudorandom Number Generator (ANSI-C reference implementation benchmark)](https://www.cryptrec.go.jp/exreport/cryptrec-ex-1035-2002.pdf)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Self-computed vector: output of this simplified educational MUGI-inspired construction, verified for self-consistency (not an official Hitachi MUGI test vector - this implementation approximates MUGI's design principles rather than the exact ISO/IEC 18033-4 algorithm)](https://www.hitachi.com/rd/yrl/crypto/mugi/)

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809101112131415` |
| `input` | `0001020304050607` |
| `expected` | `519970858a85daaa` |

---

[← All algorithms](../README.md)
