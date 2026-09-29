# ForkSkinny-128-256

> ForkSkinny is a tweakable block cipher with forking construction, producing two outputs from one input. Designed for authenticated encryption in the ForkAE NIST lightweight crypto finalist.

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
| Key sizes | 32 bytes (256 bits) |
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

**Vector 1** — [ForkSkinny-128-256 Left Output](https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-forkskinny.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `forkOutput` | left |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `1078c53597fc5e4c9d91a8eae8f5a876` |

**Vector 2** — [ForkSkinny-128-256 Right Output](https://github.com/rweather/lightweight-crypto/blob/master/test/unit/test-forkskinny.c)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `forkOutput` | right |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `d6fd008b1f5f14aaf1341a5f76e5a32f` |

---

[← All algorithms](../README.md)
