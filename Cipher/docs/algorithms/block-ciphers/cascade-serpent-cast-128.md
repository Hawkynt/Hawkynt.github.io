# Cascade(Serpent,CAST-128)

> Sequential chaining of Serpent and CAST-128 block ciphers. Encrypts with Serpent first, then CAST-128. Provides increased security margin through cipher diversity.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher Construction |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Jack Lloyd (Botan Library) |
| Year | 2010 |
| Origin | Not specified |
| Source | [`algorithms/block/cascade.js`](../../../algorithms/block/cascade.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 48 bytes (384 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Botan CASCADE Implementation (Header)](https://github.com/randombit/botan/blob/master/src/lib/block/cascade/cascade.h)
- [Botan CASCADE Implementation (Source)](https://github.com/randombit/botan/blob/master/src/lib/block/cascade/cascade.cpp)
- [Botan Test Vectors](https://github.com/randombit/botan/blob/master/src/tests/data/block/cascade.vec)

## References

- [Cipher Cascading - Wikipedia](https://en.wikipedia.org/wiki/Multiple_encryption)
- [Botan Cryptography Library](https://botan.randombit.net/)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Botan cascade.vec - Cascade(Serpent,CAST-128) vector 1](https://github.com/randombit/botan/blob/master/src/tests/data/block/cascade.vec)

| Field | Value |
| --- | --- |
| `key` | `efa9cc5f3e245ab463cc60a5015cb0f6 63676760832cee6c633a518112e518d4 5dd4b627e9507cdb03a1add870e28362` |
| `input` | `27ede4b2a3784a33898fa330167317bf 7354072672d49dd03d13d3f0856cf3d9 c17c1237565e7320bdd23c03bde195a4 fe58623a983db9c308d5a976d92cd6a2` |
| `expected` | `2d7096a03bab4dbdabedb9f069fe68c3 e12ed65acce43ecf7f6d810b5eec36a5 22b605715be12003e324436652bea06b d289dbe886a5de9e51cff6c065a21f2b` |

---

[← All algorithms](../README.md)
