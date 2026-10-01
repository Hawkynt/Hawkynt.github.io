# E2 (NTT AES candidate)

> Educational implementation of E2 block cipher adapted as a stream cipher using keystream generation. Originally an AES candidate by NTT with Feistel structure.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | NTT (Nippon Telegraph and Telephone) |
| Year | 1998 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/stream/e2.js`](../../../algorithms/stream/e2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

Block cipher adapted for educational stream cipher demonstration. Original E2 was an AES candidate.

No vulnerabilities are recorded for this implementation.

## Documentation

- [E2 (cipher) - Wikipedia](https://en.wikipedia.org/wiki/E2_(cipher))
- [E2 - A Candidate Cipher for AES (NTT, First AES Candidate Conference, 1998)](https://pdfs.semanticscholar.org/d97c/e39b4bec4d467a1b0c45cdd0fa49a058c964.pdf)
- [NIST AES Development Archive (Round 1 candidates)](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development)

## References

- [NTT Social Informatics Laboratories - Encryption Archive (E2 submission)](https://info.isl.ntt.co.jp/crypt/eng/archive/)
- [Optimized Software Implementations of E2 (Aoki and Ueda, NIST AES Candidate Conference, 1999)](https://csrc.nist.rip/encryption/aes/round1/conf2/papers/aoki.pdf)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Self-computed vector: output of this educational E2-based keystream construction, verified for self-consistency (not an official NTT E2 test vector - this implementation is a simplified stream-cipher adaptation, not the original E2 Feistel block cipher)](https://en.wikipedia.org/wiki/E2_(cipher))

| Field | Value |
| --- | --- |
| `key` | `00010203040506070809101112131415` |
| `input` | `0001020304050607` |
| `expected` | `1a1b18191e1f1c1d` |

---

[← All algorithms](../README.md)
