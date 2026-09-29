# Haraka-256

> High-performance hash function optimized for short inputs using AES round function. Designed for post-quantum cryptographic applications with Intel AES-NI optimization.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Stefan Kölbl, Martin M. Lauridsen, Florian Mendel, Christian Rechberger |
| Year | 2016 |
| Origin | Not specified |
| Source | [`algorithms/hash/haraka.js`](../../../algorithms/hash/haraka.js) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [IACR ePrint Archive](https://eprint.iacr.org/2016/098.pdf)
- [Reference Implementation](https://github.com/kste/haraka)
- [Bouncy Castle Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/Haraka256Digest.java)

## References

- [Official Haraka reference implementation (Kölbl et al.)](https://github.com/kste/haraka)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [IACR ePrint 2016/098 Appendix B](https://eprint.iacr.org/2016/098.pdf)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `8027ccb87949774b78d0545fb72bf70c695c2a0923cbd47bba1159efbf2b2c1c` |

---

[← All algorithms](../README.md)
