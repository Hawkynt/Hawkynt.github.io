# Geffe Generator

> Classical stream cipher using three Linear Feedback Shift Registers (LFSRs) and a Boolean combining function. Uses correlation between output bits for keystream generation.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | LFSR Stream Cipher |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Harold Geffe |
| Year | 1973 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/geffe.js`](../../../algorithms/stream/geffe.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 8 bytes (64 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Correlation Attack | The Geffe generator is vulnerable to correlation attacks due to statistical bias in the combining function - educational purposes only | — |

## Documentation

- [Stream Cipher Design](https://link.springer.com/book/10.1007/978-3-642-32369-2)
- [LFSR-based Stream Ciphers](https://www.springer.com/book/9780387341880)
- [Correlation Attacks on Stream Ciphers](https://link.springer.com/chapter/10.1007/0-387-34805-0_21)

## References

- [Geffe Generator Analysis](https://csrc.nist.gov/publications/detail/sp/800-22/rev-1a/final)
- [LFSR Theory](https://web.archive.org/web/20190416141256/https://www.cs.miami.edu/home/burt/learning/Csc609.092/lfsr.html)
- [Stream Cipher Cryptanalysis](https://eprint.iacr.org/2013/013)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Geffe Generator Test Vector 1 (Educational)

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0001020304050607` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `0c0502030405060708090a0b0c0d0e0f` |

**Vector 2** — Geffe Generator Test Vector 2 (Shorter input)

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0001020304050607` |
| `input` | `00010203040506070809` |
| `expected` | `0c050203040506070809` |

---

[← All algorithms](../README.md)
