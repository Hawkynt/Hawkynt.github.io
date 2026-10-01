# REDOC III

> Michael Wood's streamlined successor of REDOC II, built only from XORs: the key (1 to 34 bytes) seeds a 2560-byte key table that is folded into a 16-byte mask; two passes over the 8-byte block let each byte, masked, select a table row XORed into all other bytes. Follows Wood's reference source code, which processes 64-bit blocks; Applied Cryptography describes an 80-bit block.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | Michael Wood |
| Year | 1985 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/redoc.js`](../../../algorithms/block/redoc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 34 bytes (272 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Differential cryptanalysis](https://en.wikipedia.org/wiki/REDOC) | Ken Shirriff's differential attack recovers the key with about 2^20 chosen plaintexts and 2^30 memory. | Use AES or another vetted cipher. |

## Documentation

- [Applied Cryptography source code (REDOC3.ZIP by Michael Wood)](https://www.schneier.com/books/applied-cryptography-source/)
- [Wikipedia: REDOC](https://en.wikipedia.org/wiki/REDOC)
- [US Patent 5,003,596 (Wood)](https://patents.google.com/patent/US5003596A)

## References

- [REDOC III reference source (Michael Wood)](https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [REDOC III reference - sample key of the reference source, zero block](https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip)

| Field | Value |
| --- | --- |
| `key` | `594280e7122b` |
| `input` | `0000000000000000` |
| `expected` | `d907f979f2477825` |

**Vector 2** — [REDOC III reference - 1-byte key (minimum)](https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip)

| Field | Value |
| --- | --- |
| `key` | `80` |
| `input` | `0123456789abcdef` |
| `expected` | `c96886528fbdd43e` |

**Vector 3** — [REDOC III reference - 16-byte key](https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `input` | `6bc1bee22e409f96` |
| `expected` | `ab6a95c7fc7fd581` |

**Vector 4** — [REDOC III reference - zero 32-byte key, zero block](https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `4f83a9591536d9bd` |

**Vector 5** — [REDOC III reference - incrementing 32-byte key and block](https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `0001020304050607` |
| `expected` | `731624c431837ac5` |

**Vector 6** — [REDOC III reference - all-ones 32-byte key and block](https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffff` |
| `expected` | `3485b3877f608773` |

**Vector 7** — [REDOC III reference - 34-byte key (maximum)](https://www.schneier.com/wp-content/uploads/2015/03/REDOC3-2.zip)

| Field | Value |
| --- | --- |
| `key` | `e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff 0001` |
| `input` | `fedcba9876543210` |
| `expected` | `8c81eb7f3db7776e` |

---

[← All algorithms](../README.md)
