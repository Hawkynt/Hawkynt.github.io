# MORUS

> CAESAR competition finalist for authenticated encryption. High-performance AEAD cipher with 5-register state machine optimized for modern processors. Designed by Hongjun Wu and Tao Huang.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Hongjun Wu, Tao Huang |
| Year | 2014 |
| Origin | Not specified |
| Source | [`algorithms/stream/morus.js`](../../../algorithms/stream/morus.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 0 bytes (0 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| State Recovery | Potential state recovery in certain configurations | — |
| Not Standardized | CAESAR finalist but not standardized - use for research only | — |

## Documentation

- [CAESAR MORUS Submission](https://competitions.cr.yp.to/round3/morusv2.pdf)
- [MORUS Paper](https://eprint.iacr.org/2013/629)
- [CAESAR Competition](https://competitions.cr.yp.to/)

## References

- [MORUS Reference Implementation (Designers)](https://www3.ntu.edu.sg/home/wuhj/research/caesar/finalist_code/morusv2_code.zip)
- [Hongjun Wu CAESAR Research Page](https://www3.ntu.edu.sg/home/wuhj/research/caesar/caesar.html)
- [MORUS-1280-256 Go Port (derived from reference code)](https://github.com/Yawning/morus)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — MORUS-640-128 Test Vector - Empty

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff` |
| `nonce` | `00000000000000000000000000000000` |
| `input` | _(empty)_ |
| `expected` | `36114c3337ab27d84eeb88efadc5a5a7` |

**Vector 2** — MORUS-640-128 Test Vector - Small

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff` |
| `nonce` | `00000000000000000000000000000000` |
| `input` | `01020304` |
| `expected` | `72585912a2802959514d13f11dbad73d4eea8999` |

---

[← All algorithms](../README.md)
