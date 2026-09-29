# Grand Cru

> Experimental Rijndael variant with key-dependent S-boxes and operations. 128-bit blocks, 10 rounds, designed for enhanced security through key-dependent transformations.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🧪 Experimental |
| Complexity | Advanced |
| Inventor | Johan Borst |
| Year | 2000 |
| Origin | 🇳🇱 Netherlands |
| Source | [`algorithms/block/grand-cru.js`](../../../algorithms/block/grand-cru.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited cryptanalysis | Grand Cru was not selected by NESSIE and has received minimal public cryptanalysis. | Use well-established algorithms like AES for production systems. |
| Weak key-dependent operations | Key-dependent S-box generation may not provide expected security benefits and could introduce weaknesses. | Avoid using Grand Cru in security-critical applications. |

## Documentation

- [Grand Cru (Wikipedia)](https://en.wikipedia.org/wiki/Grand_Cru_(cipher))
- [NESSIE Project](https://www.cosic.esat.kuleuven.be/nessie/)

## References

- [Crypto Wiki: Grand Cru](https://cryptography.fandom.com/wiki/Grand_Cru_(cipher))

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Grand Cru synthetic test vector #1

Source: Generated from implementation for consistency verification

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00112233445566778899aabbccddeeff` |
| `expected` | `71de5e5bf5e1983cbc13f15601efe59a` |

**Vector 2** — Grand Cru synthetic test vector #2 (all zeros)

Source: Generated from implementation for consistency verification

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `6b4791315ffd4d34b9e85ae6d88829ab` |

**Vector 3** — Grand Cru synthetic test vector #3 (all ones)

Source: Generated from implementation for consistency verification

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `c10a7527a61765e2606bec10a86ad75e` |

**Vector 4** — Grand Cru synthetic test vector #4 (mixed pattern)

Source: Generated from implementation for consistency verification

| Field | Value |
| --- | --- |
| `key` | `fedcba98765432100123456789abcdef` |
| `input` | `0123456789abcdeffedcba9876543210` |
| `expected` | `09cc7353d442f37f3d74a663fe74338e` |

---

[← All algorithms](../README.md)
