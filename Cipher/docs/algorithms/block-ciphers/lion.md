# LION

> Variable block-size cipher construction combining hash function and stream cipher in three-round Feistel structure. Security depends on inner primitives. This implementation uses SHA-1 and RC4.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher Construction |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Ross Anderson, Eli Biham |
| Year | 1996 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/block/lion.js`](../../../algorithms/block/lion.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 2 bytes (16 bits) to 40 bytes (320 bits) in steps of 2 bytes |
| Block sizes | 64 bytes (512 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper: Two Practical and Provably Secure Block Ciphers](https://www.cl.cam.ac.uk/~rja14/Papers/bear-lion.pdf)
- [Wikipedia - BEAR and LION Ciphers](https://en.wikipedia.org/wiki/BEAR_and_LION_ciphers)
- [Botan Library Implementation](https://github.com/randombit/botan/blob/master/src/lib/block/lion/lion.cpp)

## References

- [lioness-rs (LIONESS wide-block cipher, Anderson-Biham construction)](https://github.com/burdges/lioness-rs)
- [pylioness (LIONESS wide-block cipher, Anderson-Biham construction)](https://github.com/applied-mixnetworks/pylioness)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Botan Test Vector - LION(SHA-1,RC4,64)](https://github.com/randombit/botan/blob/master/src/tests/data/block/lion.vec)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff` |
| `input` | `1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 31323334353637382015b3db2dc49529 c2d26b1f1e86c65ec7b946ab2d2e2f30` |
| `expected` | `bce3be866ef63af5ad4cba8c3caa2aa9 cf9bb3cc2a3d77ff7c05d0ec7e684ad6 134abfd7df6842b7292071064c9f4dfe 4b9d34eae89201136b7ce70ed4a190db` |

---

[← All algorithms](../README.md)
