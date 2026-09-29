# CAST-256

> AES competition finalist by Adams and Tavares with 128-bit blocks and variable key lengths. Uses CAST-128 S-boxes with extended key schedule and 48 rounds. Conservative security design.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Carlisle Adams, Stafford Tavares |
| Year | 1998 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/block/cast.js`](../../../algorithms/block/cast.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 4 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [AES Competition Result](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development) | Not selected as AES - Rijndael chosen for better performance and analysis | Use AES (Rijndael) for standardized symmetric encryption |
| [Limited adoption](https://www.schneier.com/academic/) | Less analyzed than AES due to limited real-world deployment | Prefer widely-analyzed algorithms like AES for security-critical applications |

## Documentation

- [RFC 2612 - CAST-256 Specification](https://www.rfc-editor.org/rfc/rfc2612.txt)
- [NIST AES Candidate Submission](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development)
- [CAST Algorithm Family](https://www.iacr.org/cryptodb/data/paper.php?pubkey=789)

## References

- [Crypto++ CAST Implementation](https://github.com/weidai11/cryptopp/blob/master/cast.cpp)
- [Bouncy Castle CAST Implementation](https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines)
- [libgcrypt CAST Implementation](https://github.com/gpg/libgcrypt/blob/master/cipher/cast5.c)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [CAST-256 128-bit key test vector (Crypto++ validated)](https://github.com/weidai11/cryptopp/blob/master/TestData/cast256v.dat)

| Field | Value |
| --- | --- |
| `key` | `2342bb9efa38542c0af75647f29f615d` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `c842a08972b43d20836c91d1b7530f6b` |

**Vector 2** — [CAST-256 192-bit key test vector (Crypto++ validated)](https://github.com/weidai11/cryptopp/blob/master/TestData/cast256v.dat)

| Field | Value |
| --- | --- |
| `key` | `2342bb9efa38542cbed0ac83940ac298bac77a7717942863` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `1b386c0210dcadcbdd0e41aa08a7a7e8` |

**Vector 3** — [CAST-256 256-bit key test vector (Crypto++ validated)](https://github.com/weidai11/cryptopp/blob/master/TestData/cast256v.dat)

| Field | Value |
| --- | --- |
| `key` | `2342bb9efa38542cbed0ac83940ac2988d7c47ce264908461cc1b5137ae6b604` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `4f6a2038286897b9c9870136553317fa` |

---

[← All algorithms](../README.md)
