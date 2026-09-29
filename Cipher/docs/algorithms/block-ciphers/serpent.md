# Serpent

> AES finalist cipher by Anderson, Biham, and Knudsen with 32 rounds and 8 S-boxes. Uses substitution-permutation network with 128-bit blocks and 128/192/256-bit keys. Conservative security design.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Ross Anderson, Eli Biham, Lars Knudsen |
| Year | 1998 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/block/serpent.js`](../../../algorithms/block/serpent.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Performance vs AES](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development) | Slower than AES, which contributed to AES selection by NIST | AES preferred for performance-critical applications, Serpent acceptable for high-security needs |

## Documentation

- [Serpent Algorithm Specification](https://www.cl.cam.ac.uk/~rja14/serpent.html)
- [Serpent: A New Block Cipher Proposal](https://www.cl.cam.ac.uk/~rja14/Papers/serpent.pdf)
- [NIST AES Candidate Submission](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development)

## References

- [Crypto++ Serpent Implementation](https://github.com/weidai11/cryptopp/blob/master/serpent.cpp)
- [libgcrypt Serpent Implementation](https://github.com/gpg/libgcrypt/blob/master/cipher/serpent.c)
- [Bouncy Castle Serpent Implementation](https://github.com/bcgit/bc-java/tree/master/core/src/main/java/org/bouncycastle/crypto/engines)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [libgcrypt serpent_test - Serpent-128](https://github.com/gpg/libgcrypt/blob/master/cipher/serpent.c)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `d29d576fcea3a3a7ed9099f29273d78e` |
| `expected` | `b2288b968ae8b08648d1ce9606fd992d` |

**Vector 2** — [libgcrypt serpent_test - Serpent-192](https://github.com/gpg/libgcrypt/blob/master/cipher/serpent.c)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `d29d576fceaba3a7ed9899f2927bd78e` |
| `expected` | `130e353e1037c22405e8faefb2c3c3e9` |

**Vector 3** — [libgcrypt serpent_test - Serpent-256](https://github.com/gpg/libgcrypt/blob/master/cipher/serpent.c)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `d095576fcea3e3a7ed98d9f29073d78e` |
| `expected` | `b90ee5862de69168f2bdd5125b45472b` |

**Vector 4** — [libgcrypt serpent_test - Serpent-256, counting plaintext](https://github.com/gpg/libgcrypt/blob/master/cipher/serpent.c)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000010000000200000003000000` |
| `expected` | `2061a42782bd52ec691ec383b03ba77c` |

**Vector 5** — [Botan serpent.vec - variable key, single bit 0x80 in last byte](https://github.com/randombit/botan/blob/master/src/tests/data/block/serpent.vec)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000080` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `ddd26b98a5ffd82c05345a9dadbfaf49` |

**Vector 6** — [Botan serpent.vec - variable key, single bit 0x01 in last byte](https://github.com/randombit/botan/blob/master/src/tests/data/block/serpent.vec)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000001` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `f668c7091f81b2827da77dd419b708e1` |

---

[← All algorithms](../README.md)
