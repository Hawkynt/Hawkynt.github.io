# MANTIS

> Low-latency tweakable block cipher designed for memory encryption. 64-bit block size with 128-bit keys and 64-bit tweaks using reflection-based structure with 14 rounds. Optimized for minimal latency in hardware implementations. Note: Decryption uses modified key derivation per reflection property.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Tweakable Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Christof Beierle, Jérémy Jean, Stefan Kölbl, Gregor Leander, et al. |
| Year | 2016 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/block/mantis.js`](../../../algorithms/block/mantis.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [MANTIS Specification (ePrint Archive)](https://eprint.iacr.org/2016/660)
- [CRYPTO 2016 Paper](https://link.springer.com/chapter/10.1007/978-3-662-53008-5_5)
- [Reference Implementation (Skinny-C)](https://github.com/rweather/skinny-c)

## References

- [Skinny-C MANTIS Source (mantis-cipher.c)](https://github.com/rweather/skinny-c/blob/master/src/mantis-cipher.c)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MANTIS-7 Test Vector - specification Appendix B.2](https://eprint.iacr.org/2016/660.pdf)

| Field | Value |
| --- | --- |
| `key` | `92f09952c625e3e9d7a060f714c0292b` |
| `tweak` | `ba912e6f1055fed2` |
| `input` | `60e43457311936fd` |
| `expected` | `308e8a07f168f517` |

---

[← All algorithms](../README.md)
