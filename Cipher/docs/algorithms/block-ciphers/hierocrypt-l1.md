# Hierocrypt-L1

> Hierocrypt-L1, a 64-bit block cipher from Toshiba submitted to NESSIE and recommended by CRYPTREC. Nested SPN structure with 6.5 rounds and a round-trip Feistel key schedule.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Toshiba Corporation |
| Year | 2000 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/hierocrypt-l1.js`](../../../algorithms/block/hierocrypt-l1.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NESSIE Submission (CRYPTREC)](https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/04_02espec.pdf)
- [NESSIE Submission (KU Leuven)](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/Hierocrypt-L1-revised-spec.pdf)
- [Wikipedia Article](https://en.wikipedia.org/wiki/Hierocrypt)

## References

- [NESSIE Submission Archive (reference code package)](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions.html)
- [embeddedsw.net libObfuscate Hierocrypt Implementation](https://embeddedsw.net/Cipher_Reference_Home.html)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NESSIE submission package, C/testvectors.txt](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/hierocrypt-l1.zip)

| Field | Value |
| --- | --- |
| `key` | `4703c87e817842c4ce6b167d43701b76` |
| `input` | `85693846db4c1b34` |
| `expected` | `0cb19444abd24347` |

---

[← All algorithms](../README.md)
