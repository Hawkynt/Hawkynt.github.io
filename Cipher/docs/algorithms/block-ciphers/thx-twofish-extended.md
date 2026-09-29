# THX (Twofish Extended)

> Educational extended Twofish with 256/512/1024-bit keys and proportional rounds (16/20/24). Based on Twofish structure with simplified key schedule for learning.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Extended Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Educational Variant (Based on Schneier Twofish) |
| Year | 2025 |
| Origin | Not specified |
| Source | [`algorithms/block/thx.js`](../../../algorithms/block/thx.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits); 64 bytes (512 bits); 128 bytes (1024 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Educational Implementation | This is an educational extension of Twofish, not suitable for production use | Use only for learning cryptographic principles and algorithm design |

## Documentation

- [Original Twofish Specification](https://www.schneier.com/academic/twofish/)
- [Extended Block Cipher Design](https://en.wikipedia.org/wiki/Block_cipher)
- [Educational Cryptography](https://en.wikipedia.org/wiki/Cryptography)

## References

- [Twofish Official Paper](https://www.schneier.com/academic/twofish/)
- [Block Cipher Theory](https://en.wikipedia.org/wiki/Block_cipher)
- [Feistel Networks](https://en.wikipedia.org/wiki/Feistel_cipher)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — THX-256 Zero Test Vector

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `5ff7e9c66d38a276b84a464d10414c65` |

**Vector 2** — THX-256 Pattern Test Vector

Source: Educational implementation test

| Field | Value |
| --- | --- |
| `key` | `fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210` |
| `input` | `0123456789abcdef0123456789abcdef` |
| `expected` | `2f35f89793d1c8d72e1858a67092f87f` |

---

[← All algorithms](../README.md)
