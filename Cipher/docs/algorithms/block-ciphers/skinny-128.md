# SKINNY-128

> A family of lightweight tweakable block ciphers designed for resource-constrained environments. Features efficient hardware and software implementations with strong security guarantees. Used in the Romulus AEAD scheme (NIST LWC finalist).

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Tweakable Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Beierle, Jean, Kölbl, Leander, Moradi, Peyrin, Sasaki, Sasdrich, Sim |
| Year | 2016 |
| Origin | 🌐 International |
| Source | [`algorithms/block/skinny128.js`](../../../algorithms/block/skinny128.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits); 32 bytes (256 bits); 48 bytes (384 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [SKINNY Specification (ePrint)](https://eprint.iacr.org/2016/660.pdf)
- [SKINNY Official Website](https://sites.google.com/site/skinnycipher/)
- [Romulus AEAD (NIST LWC)](https://romulusae.github.io/romulus/)

## References

- [SKINNY Paper (CRYPTO 2016)](https://eprint.iacr.org/2016/660)
- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SKINNY-128-128 Official Test Vector](https://eprint.iacr.org/2016/660.pdf)

| Field | Value |
| --- | --- |
| `key` | `4f55cfb0520cac52fd92c15f37073e93` |
| `input` | `f20adb0eb08b648a3b2eeed1f0adda14` |
| `expected` | `22ff30d498ea62d7e45b476e33675b74` |

**Vector 2** — [SKINNY-128-256 Official Test Vector](https://eprint.iacr.org/2016/660.pdf)

| Field | Value |
| --- | --- |
| `key` | `009cec81605d4ac1d2ae9e3085d7a1f31ac123ebfc00fddcf01046ceeddfcab3` |
| `input` | `3a0c47767a26a68dd382a695e7022e25` |
| `expected` | `b731d98a4bde147a7ed4a6f16b9b587f` |

**Vector 3** — [SKINNY-128-384 Official Test Vector](https://eprint.iacr.org/2016/660.pdf)

| Field | Value |
| --- | --- |
| `key` | `df889548cfc7ea52d296339301797449 ab588a34a47f1ab2dfe9c8293fbea9a5 ab1afac2611012cd8cef952618c3ebe8` |
| `input` | `a3994b66ad85a3459f44e92b08f550cb` |
| `expected` | `94ecf589e2017c601b38c6346a10dcfa` |

---

[← All algorithms](../README.md)
