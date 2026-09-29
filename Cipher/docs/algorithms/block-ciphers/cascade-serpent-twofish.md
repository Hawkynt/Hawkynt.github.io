# Cascade(Serpent,Twofish)

> Sequential chaining of Serpent and Twofish block ciphers. Encrypts with Serpent first, then Twofish. Provides increased security margin through cipher diversity.

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
| Key sizes | 64 bytes (512 bits) |
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

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Botan cascade.vec - Cascade(Serpent,Twofish) vector 1](https://github.com/randombit/botan/blob/master/src/tests/data/block/cascade.vec)

| Field | Value |
| --- | --- |
| `key` | `b50638f695afa16f9378d43374ca8568 600135ecd1e513838722366346bc4b21 01422291558faa30a3196cbeb42e67f4 c075882482897f72a8a30ae9b3ad426d` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `e78516d21d23da501939c24c48bcc79de78516d21d23da501939c24c48bcc79d` |

**Vector 2** — [Botan cascade.vec - Cascade(Serpent,Twofish) vector 2](https://github.com/randombit/botan/blob/master/src/tests/data/block/cascade.vec)

| Field | Value |
| --- | --- |
| `key` | `9e8f6bc09768aed8f533fa4fc35ff6fe b8020ffbc8350ddfd20aca7ecf1889cf bfcd78e261b9a3cd825401afa7adcdfa 88dba8230fb92d4b942c25ee92f27a02` |
| `input` | `47cb8147c5290d6f94fbf3351777087fa731610a3f66e3ccfa6d9b18f980e687` |
| `expected` | `f234e056923b3db26aabc8f604f0ce2c1a7f4c35b0b74958014d791668ff6bf4` |

**Vector 3** — [Botan cascade.vec - Cascade(Serpent,Twofish) vector 3](https://github.com/randombit/botan/blob/master/src/tests/data/block/cascade.vec)

| Field | Value |
| --- | --- |
| `key` | `1ef34e47005028f2d95120052855c600 1225200a333ca4d7d5a356b5554ee2ae 7ebc9ba57bada0dafc84c2187c51cb3c cb5eee40f27c00537fffca2851dd8bd8` |
| `input` | `b9a28d32734ef678bacd5539ff9ff951 af81f44afe223256e5d8898fb862a767 b90bd2d95e17e4411d02d49481cce419 1ee2c7ae8ebdf6312bdc66317ad42140` |
| `expected` | `065e390c4fd10e9929f30d89a67e0d4c fa3af90bef46b2b435b53cbe0b7dd1b6 12d4c5e2d03028b488000c06517434fc 70f7b62c273ca5debd9ca7034d853087` |

---

[← All algorithms](../README.md)
