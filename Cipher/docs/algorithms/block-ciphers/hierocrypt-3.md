# Hierocrypt-3

> Educational implementation of Hierocrypt-3, a 128-bit block cipher from Toshiba submitted to NESSIE with nested SPN structure and variable rounds.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Toshiba Corporation |
| Year | 2000 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/hierocrypt3.js`](../../../algorithms/block/hierocrypt3.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NESSIE Specification](https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/08_02espec.pdf)

## References

- [embeddedsw.net libObfuscate Hierocrypt-3 Implementation](https://embeddedsw.net/Cipher_Reference_Home.html)
- [NESSIE Submission Archive (reference code package)](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions.html)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Hierocrypt-3 Test Vector 1

Source: Educational test vector for Hierocrypt-3 cipher

| Field | Value |
| --- | --- |
| `key` | `0f0e0d0c0b0a09080706050403020100` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `06c42e69000392e7df7c28d40d4419cf` |

---

[← All algorithms](../README.md)
