# Khufu

> Ralph Merkle's Khufu cipher with 64-bit blocks and variable key lengths up to 512 bits. Uses key-dependent S-boxes in an unbalanced Feistel structure with rotation-based rounds. Named after Egyptian Pharaoh Khufu.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | Ralph Merkle |
| Year | 1990 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/khufu.js`](../../../algorithms/block/khufu.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 64 bytes (512 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Differential Cryptanalysis](https://link.springer.com/chapter/10.1007/3-540-48658-5_33) | Critical: Khufu can be broken using differential cryptanalysis with 2^43 chosen plaintexts | — |

## Documentation

- [CRYPTO '90 Paper](https://link.springer.com/chapter/10.1007/3-540-38424-3_34)
- [U.S. Patent 5,003,597](https://patents.google.com/patent/US5003597A/en)
- [Wikipedia - Khufu and Khafre](https://en.wikipedia.org/wiki/Khufu_and_Khafre)

## References

- [Applied Cryptography Source Code](https://www.schneier.com/books/applied-cryptography-source/)
- [Differential Cryptanalysis](https://link.springer.com/chapter/10.1007/3-540-48658-5_33)
- [Linear Analysis of Khufu](https://link.springer.com/chapter/10.1007/978-3-540-72163-5_3)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Regression vector - all zeros (no published Khufu KAT exists)](https://en.wikipedia.org/wiki/Khufu_and_Khafre)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `ecc679859341a480` |

**Vector 2** — [Regression vector - pattern data (no published Khufu KAT exists)](https://en.wikipedia.org/wiki/Khufu_and_Khafre)

| Field | Value |
| --- | --- |
| `key` | `fedcba9876543210` |
| `input` | `0123456789abcdef` |
| `expected` | `f7e5b312192065ec` |

**Vector 3** — [Regression vector - all ones (no published Khufu KAT exists)](https://en.wikipedia.org/wiki/Khufu_and_Khafre)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffff` |
| `input` | `ffffffffffffffff` |
| `expected` | `ae396b43f43afa61` |

---

[← All algorithms](../README.md)
