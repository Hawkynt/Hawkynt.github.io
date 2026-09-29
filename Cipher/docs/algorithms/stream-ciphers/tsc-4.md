# TSC-4

> Stream cipher with extremely complex nonlinear operations using multiple S-boxes and parallel LFSRs. Submitted to eSTREAM but eliminated early due to performance issues and implementation complexity.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Jyrki Joutsenlahti, Timo Knuutila |
| Year | 2005 |
| Origin | Not specified |
| Source | [`algorithms/stream/tsc-4.js`](../../../algorithms/stream/tsc-4.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Performance Issues | Eliminated from eSTREAM due to poor performance | — |
| Implementation Complexity | Overly complex design makes analysis difficult | — |

## Documentation

- [eSTREAM TSC-4 Specification](https://www.ecrypt.eu.org/stream/tsc4pf.html)

## References

- [eSTREAM Phase 1 Evaluation](https://www.ecrypt.eu.org/stream/tsc-4.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — TSC-4 basic test vector with 128-bit key and IV

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `545354343420746f7274757265206b65` |
| `iv` | `545343343420746f7274757265204956` |
| `input` | `546f7274757265207465737421` |
| `expected` | `34f1ee19c4b7658e60f6c46cc7` |

**Vector 2** — TSC-4 with high entropy key and IV

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `ffaa5533cc0ff069965aa53cc3788712` |
| `iv` | `123456789abcdef00fedcba987654321` |
| `input` | `4869676820656e74726f7079` |
| `expected` | `8b96261640c3b6e0cdb8195a` |

---

[← All algorithms](../README.md)
