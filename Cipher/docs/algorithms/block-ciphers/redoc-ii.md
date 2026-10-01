# REDOC II

> Michael Wood's cipher for Cryptech Inc: 80-bit blocks, a 160-bit key and 10 rounds of substitutions, key-table XORs, enclave functions and permutations, each chosen by a block byte XORed with a mask byte. The key expands into a 256-row key table and a 10x10 mask table. Follows Wood's reference source code.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | Michael Wood |
| Year | 1990 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/redoc.js`](../../../algorithms/block/redoc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) |
| Block sizes | 10 bytes (80 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Differential cryptanalysis](https://www.cs.technion.ac.il/~biham/Reports/Weizmann/cs91-18.ps.gz) | Biham and Shamir attack one round with about 2300 encryptions and recover three masks of up to four rounds faster than exhaustive search; Cusick found another one-round attack. | Use AES or another vetted cipher. |

## Documentation

- [Applied Cryptography source code (REDOC2.ZIP by Michael Wood)](https://www.schneier.com/books/applied-cryptography-source/)
- [Cusick, Wood - "The REDOC II Cryptosystem", CRYPTO '90](https://link.springer.com/chapter/10.1007/3-540-38424-3_38)
- [Wikipedia: REDOC](https://en.wikipedia.org/wiki/REDOC)
- [US Patent 5,003,596 (Wood)](https://patents.google.com/patent/US5003596A)

## References

- [REDOC II reference source (Michael Wood)](https://www.schneier.com/wp-content/uploads/2015/03/REDOC2-2.zip)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [REDOC II reference - sample key and block of the reference source ("ABCDEFGHIJ")](https://www.schneier.com/wp-content/uploads/2015/03/REDOC2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `724d3e0e5b71e9aa3898ffde1a9bd5f80c6d4e5f` |
| `input` | `4142434445464748494a` |
| `expected` | `d3e1b40d11f4c81224ca` |

**Vector 2** — [REDOC II reference - zero key, zero block](https://www.schneier.com/wp-content/uploads/2015/03/REDOC2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000` |
| `input` | `00000000000000000000` |
| `expected` | `f00bb85e8f9205917b57` |

**Vector 3** — [REDOC II reference - incrementing key and block](https://www.schneier.com/wp-content/uploads/2015/03/REDOC2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `input` | `00010203040506070809` |
| `expected` | `98b8a06b23bf702b729e` |

**Vector 4** — [REDOC II reference - all-ones key and block](https://www.schneier.com/wp-content/uploads/2015/03/REDOC2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffffffff` |
| `expected` | `cba888ddd1b273eb965e` |

**Vector 5** — [REDOC II reference - mixed key and block](https://www.schneier.com/wp-content/uploads/2015/03/REDOC2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c762e7160` |
| `input` | `6bc1bee22e409f96e93d` |
| `expected` | `0f78543ed2e217aaa2bf` |

**Vector 6** — [REDOC II reference - single set bit in the block](https://www.schneier.com/wp-content/uploads/2015/03/REDOC2-2.zip)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdeffedcba987654321000112233` |
| `input` | `80000000000000000000` |
| `expected` | `d1d49c32755140ea71ca` |

---

[← All algorithms](../README.md)
