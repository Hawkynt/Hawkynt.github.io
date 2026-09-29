# Haraka-512

> High-performance hash function for 512-bit inputs producing 256-bit output using AES round function. Optimized for post-quantum signature schemes requiring efficient hashing.

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
- [Bouncy Castle Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/digests/Haraka512Digest.java)

## References

- [Official Haraka reference implementation (Kölbl et al.)](https://github.com/kste/haraka)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [IACR ePrint 2016/098 Appendix B](https://eprint.iacr.org/2016/098.pdf)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `be7f723b4e80a99813b292287f306f625a6d57331cae5f34dd9277b0945be2aa` |

---

[← All algorithms](../README.md)
