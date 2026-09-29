# ForkSkinny-128-384

> ForkSkinny-128-384 is a tweakable block cipher with 384-bit tweakey and forking construction. Used in ForkAE authenticated encryption suite.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Tweakable Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Elena Andreeva, Reza Reyhanitabar, Damian Vizar |
| Year | 2019 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/block/forkskinny.js`](../../../algorithms/block/forkskinny.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 48 bytes (384 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [ForkAE NIST LWC Submission Specification](https://csrc.nist.gov/CSRC/media/Projects/Lightweight-Cryptography/documents/round-1/spec-doc/forkae-spec.pdf)
- [ForkAE Official Website](https://www.esat.kuleuven.be/cosic/forkae/)
- [NIST Lightweight Crypto](https://csrc.nist.gov/projects/lightweight-cryptography)

## References

- [Reference Implementation](https://github.com/rweather/lightweight-crypto)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ForkSkinny-128-384 Left Output](https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-forkskinny.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f` |
| `forkOutput` | left |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `a842dcd53062730d8e293cd923ef9aa9` |

**Vector 2** — [ForkSkinny-128-384 Right Output](https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-forkskinny.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f` |
| `forkOutput` | right |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `d086cd2919969ee6c30adba21194f870` |

---

[← All algorithms](../README.md)
