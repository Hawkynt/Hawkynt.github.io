# LOKI97

> Australian AES candidate featuring 128-bit blocks with 128/192/256-bit keys. Uses substitution-permutation network with S-boxes based on finite field exponentiation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Lawrie Brown, Josef Pieprzyk, Jennifer Seberry |
| Year | 1997 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/block/loki.js`](../../../algorithms/block/loki.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits); 24 bytes (192 bits); 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Square Attack](https://link.springer.com/chapter/10.1007/BFb0052363) | Vulnerable to Square attack on reduced rounds | Educational cipher - not recommended for production use |

## Documentation

- [LOKI97 AES Submission](https://csrc.nist.gov/csrc/media/projects/cryptographic-standards-and-guidelines/documents/aes-development/loki97.pdf)
- [LOKI97 Specification](https://www.unsw.adfa.edu.au/~lpb/papers/loki97.pdf)
- [LOKI Paper](https://www.researchgate.net/publication/2331541_Introducing_the_new_LOKI97_Block_Cipher)

## References

- [AES Competition Archive](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development)
- [Brown et al. Design Paper](https://link.springer.com/chapter/10.1007/BFb0052343)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LOKI97 Educational Test Vector (128-bit key)](https://csrc.nist.gov/csrc/media/projects/cryptographic-standards-and-guidelines/documents/aes-development/loki97.pdf)

| Field | Value |
| --- | --- |
| `key` | `133457799bbcdff10011223344556677` |
| `input` | `0123456789abcdef0123456789abcdef` |
| `expected` | `120d03198dbf3afd3d7d8614d5531c7b` |

**Vector 2** — [LOKI97 All Zeros Educational Test](https://csrc.nist.gov/csrc/media/projects/cryptographic-standards-and-guidelines/documents/aes-development/loki97.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `1cd98343476374f07e9bddabf83af501` |

---

[← All algorithms](../README.md)
