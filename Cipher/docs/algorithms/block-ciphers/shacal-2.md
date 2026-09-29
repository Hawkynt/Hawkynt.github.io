# SHACAL-2

> 256-bit block cipher based on the SHA-256 hash function compression function. Selected by NESSIE for standardization. Uses 64 rounds with SHA-256 operations.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Helena Handschuh, David Naccache |
| Year | 2000 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/block/shacal-2.js`](../../../algorithms/block/shacal-2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 64 bytes (512 bits) |
| Block sizes | 32 bytes (256 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NESSIE Portfolio](https://www.cosic.esat.kuleuven.be/nessie/)
- [Wikipedia - SHACAL](https://en.wikipedia.org/wiki/SHACAL)

## References

- [Botan Implementation](https://github.com/randombit/botan/blob/master/src/lib/block/shacal2/shacal2.cpp)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NESSIE Set 1, vector 0 (512-bit key)](https://www.cosic.esat.kuleuven.be/nessie/testvectors/)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `361ab6322fa9e7a7bb23818d839e01bddafdf47305426edd297aedb9f6202bae` |

---

[← All algorithms](../README.md)
