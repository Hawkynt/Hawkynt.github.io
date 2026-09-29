# Keeloq

> 32-bit block cipher with 64-bit key designed for remote keyless entry systems. Uses 528-round NLFSR structure. Owned by Microchip. Cryptographically broken with known practical attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Beginner |
| Inventor | Nanoteq (Willem Smit) |
| Year | 1985 |
| Origin | Not specified |
| Source | [`algorithms/block/keeloq.js`](../../../algorithms/block/keeloq.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |
| Block sizes | 4 bytes (32 bits) |

## Security

**Status:** ❌ Broken

No vulnerabilities are recorded for this implementation.

## Documentation

- [Wikipedia - Keeloq](https://en.wikipedia.org/wiki/KeeLoq)
- [IACR Cryptanalysis Paper](https://eprint.iacr.org/2007/055.pdf)

## References

- [GitHub Implementation](https://github.com/hadipourh/KeeLoq)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [GitHub test vector #1](https://github.com/hadipourh/KeeLoq)

| Field | Value |
| --- | --- |
| `key` | `5cec6701b79fd949` |
| `input` | `f741e2db` |
| `expected` | `e44f4cdf` |

**Vector 2** — [GitHub test vector #2](https://github.com/hadipourh/KeeLoq)

| Field | Value |
| --- | --- |
| `key` | `5cec6701b79fd949` |
| `input` | `0ca69b92` |
| `expected` | `a6ac0ea2` |

**Vector 3** — [keeloq-go test vector (independent implementation, same two vectors plus this one)](https://github.com/dimchansky/keeloq-go/blob/master/keeloq_test.go)

| Field | Value |
| --- | --- |
| `key` | `beefdeadbeefdead` |
| `input` | `2000c022` |
| `expected` | `054c90c2` |

---

[← All algorithms](../README.md)
