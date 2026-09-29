# CIPHERUNICORN-A

> Educational implementation of CIPHERUNICORN-A from NEC, a 16-round Feistel network with complex parallel round functions, recommended by CRYPTREC.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | NEC Corporation |
| Year | 2000 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/unicorn-a.js`](../../../algorithms/block/unicorn-a.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [CRYPTREC Report](https://www.cryptrec.go.jp/en/)

## References

- [embeddedsw.net libObfuscate CIPHERUNICORN-A Implementation](https://embeddedsw.net/Cipher_Reference_Home.html)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Regression vector (does not match the CRYPTREC specification)](https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/07_02espec.pdf)

| Field | Value |
| --- | --- |
| `key` | `0f0e0d0c0b0a09080706050403020100` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `9fc26f56ca7752ee45a3141a869551c4` |

---

[← All algorithms](../README.md)
