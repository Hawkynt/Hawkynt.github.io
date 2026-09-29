# CubeHash-256

> CubeHash-16+16/32+16-256 variant producing 256-bit hashes. SHA-3 competition candidate by Daniel J. Bernstein.

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
| Output sizes | 32 bytes (256 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [CubeHash Official Website](https://cubehash.cr.yp.to/)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)

## References

- [CubeHash reference implementation (Daniel J. Bernstein)](https://cubehash.cr.yp.to/software.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty string (CubeHash16+16/32+16-256)](https://cubehash.cr.yp.to/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `44c6de3ac6c73c391bf0906cb7482600ec06b216c7c54a2a8688a6a42676577d` |

**Vector 2** — [ASCII 'Hello' (CubeHash16+16/32+16-256)](https://cubehash.cr.yp.to/)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f` |
| `expected` | `e712139e3b892f2f5fe52d0f30d78a0cb16b51b217da0e4acb103dd0856f2db0` |

**Vector 3** — [ASCII 'The quick brown fox jumps over the lazy dog' (CubeHash16+16/32+16-256)](https://cubehash.cr.yp.to/)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | `5151e251e348cbbfee46538651c06b138b10eeb71cf6ea6054d7ca5fec82eb79` |

---

[← All algorithms](../README.md)
