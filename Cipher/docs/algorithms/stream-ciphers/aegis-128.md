# AEGIS-128

> High-performance authenticated encryption with associated data (AEAD) using AES round function. Winner of CAESAR competition high-performance category with exceptional speed on AES-NI enabled processors.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | AEAD Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Hongjun Wu, Bart Preneel |
| Year | 2016 |
| Origin | Not specified |
| Source | [`algorithms/stream/aegis-128.js`](../../../algorithms/stream/aegis-128.js) |

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
| Side-Channel Attacks | Potential timing vulnerabilities in AES round function implementations without hardware acceleration | — |

## Documentation

- [CAESAR Submission](https://competitions.cr.yp.to/round3/aegisv11.pdf)
- [IETF RFC 9380](https://tools.ietf.org/rfc/rfc9380.txt)
- [CAESAR Competition Results](https://competitions.cr.yp.to/caesar-submissions.html)

## References

- [Reference Implementation](https://github.com/jedisct1/aegis-c)
- [Supercop Benchmarks](https://bench.cr.yp.to/results-aead.html)
- [Academic Paper](https://eprint.iacr.org/2015/1047.pdf)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — AEGIS-128 Test Vector 1 (Educational)

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `10010000000000000000000000000000` |
| `iv` | `10000200000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `0001020000000000000000000000000000010200000000000000000000000000` |

**Vector 2** — AEGIS-128 Test Vector 2 (Shorter input)

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `10010000000000000000000000000000` |
| `iv` | `10000200000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `00010200000000000000000000000000` |

---

[← All algorithms](../README.md)
