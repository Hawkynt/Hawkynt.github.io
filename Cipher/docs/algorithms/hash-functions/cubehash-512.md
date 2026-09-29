# CubeHash-512

> CubeHash-16+16/32+16-512 hash function designed by Daniel J. Bernstein, submitted to NIST SHA-3 competition. Uses 16 initialization rounds, 32-byte blocks, 16 rounds per block, and produces 512-bit hashes.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Daniel J. Bernstein |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/cubehash.js`](../../../algorithms/hash/cubehash.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [CubeHash Official Website](https://cubehash.cr.yp.to/)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)
- [CubeHash Specification (PDF)](https://cubehash.cr.yp.to/submission/spec.pdf)

## References

- [Daniel J. Bernstein's Research](https://cr.yp.to/)
- [SHA-3 Competition Archive](https://csrc.nist.gov/projects/hash-functions/sha-3-project/sha-3-standardization)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string (CubeHash16+16/32+16-512)](https://cubehash.cr.yp.to/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `4a1d00bbcfcb5a9562fb981e7f7db335 0fe2658639d948b9d57452c22328bb32 f468b072208450bad5ee178271408be0 b16e5633ac8a1e3cf9864cfbfc8e043a` |

**Vector 2** — [ASCII 'Hello' (CubeHash16+16/32+16-512)](https://cubehash.cr.yp.to/)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f` |
| `expected` | `dcc0503aae279a3c8c95fa1181d37c41 8783204e2e3048a081392fd61bace883 a1f7c4c96b16b4060c42104f1ce45a62 2f1a9abaeb994beb107fed53a78f588c` |

**Vector 3** — [ASCII 'The quick brown fox jumps over the lazy dog' (CubeHash16+16/32+16-512)](https://cubehash.cr.yp.to/)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `bdba44a28cd16b774bdf3c9511def1a2 baf39d4ef98b92c27cf5e37beb8990b7 cdb6575dae1a548330780810618b8a5c 351c1368904db7ebdf8857d596083a86` |

---

[← All algorithms](../README.md)
