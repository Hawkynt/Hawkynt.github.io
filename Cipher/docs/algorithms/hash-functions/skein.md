# Skein

> Skein-512 hash function from NIST SHA-3 competition. Built on Threefish-512 tweakable block cipher using UBI mode. Finalist in SHA-3 competition (lost to Keccak).

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | SHA-3 Competition Finalist |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Bruce Schneier, Niels Ferguson, Stefan Lucks, Doug Whiting, Mihir Bellare, Tadayoshi Kohno, Jon Callas, Jesse Walker |
| Year | 2008 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/skein.js`](../../../algorithms/hash/skein.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 64 bytes (512 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Skein 1.3 Specification](https://www.schneier.com/academic/skein/skein1.3.pdf)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)
- [Threefish Cipher](https://www.schneier.com/academic/threefish/)

## References

- [Bouncy Castle Implementation](https://github.com/bcgit/bc-csharp)
- [SHA-3 Zoo](https://keccak.team/obsolete_SHA3_zoo/Skein.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Skein-512-512 empty string](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinDigestTest.java)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `bc5b4c50925519c290cc634277ae3d62 57212395cba733bbad37a4af0fa06af4 1fca7903d06564fea7a2d3730dbdb80c 1f85562dfcc070334ea4d1d9e72cba7a` |

**Vector 2** — [Skein-512-512 single byte 0xFB](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinDigestTest.java)

| Field | Value |
| --- | --- |
| `input` | `fb` |
| `expected` | `c49e03d50b4b2cc46bd3b7ef7014c8a4 5b016399fd1714467b7596c86de98240 e35bf7f9772b7d65465cd4cffab14e6b c154c54fc67b8bc340abf08eff572b9e` |

**Vector 3** — [Skein-512-512 32-byte message](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinDigestTest.java)

| Field | Value |
| --- | --- |
| `input` | `fbd17c26b61a82e12e125f0d459b96c91ab4837dff22b39b78439430cdfc5dc8` |
| `expected` | `abefb179d52f68f86941acbbe014cc67 ec66ad78b7ba9508eb1400ee2cbdb06f 9fe7c2a260a0272d0d80e8ef5e8737c0 c6a5f1c02ceb00fb2746f664b85fcef5` |

**Vector 4** — [Skein-512-512 48-byte message (block boundary - 16)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinDigestTest.java)

| Field | Value |
| --- | --- |
| `input` | `fbd17c26b61a82e12e125f0d459b96c9 1ab4837dff22b39b78439430cdfc5dc8 78bb393a1a5f79bef30995a85a129233` |
| `expected` | `5c5b7956f9d973c0989aa40a71aa9c48 a65af2757590e9a758343c7e23ea2df4 057ce0b49f9514987feff97f648e1dd0 65926e2c371a0211ca977c213f14149f` |

**Vector 5** — [Skein-512-512 64-byte message (exactly one UBI block)](https://github.com/aead/skein/blob/master/vector_test.go)

| Field | Value |
| --- | --- |
| `input` | `fbd17c26b61a82e12e125f0d459b96c9 1ab4837dff22b39b78439430cdfc5dc8 78bb393a1a5f79bef30995a85a129233 39ba8ab7d8fc6dc5fec6f4ed22c122bb` |
| `expected` | `02d01535c2df280fde92146df054b060 9273c73056c93b94b82f5e7dcc5be697 9978c4be24331caa85d892d2e710c6c9 b4904cd056a53547b866bee097c0fb17` |

**Vector 6** — [Skein-512-512 128-byte message (exactly two UBI blocks)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/SkeinDigestTest.java)

| Field | Value |
| --- | --- |
| `input` | `fbd17c26b61a82e12e125f0d459b96c9 1ab4837dff22b39b78439430cdfc5dc8 78bb393a1a5f79bef30995a85a129233 39ba8ab7d8fc6dc5fec6f4ed22c122bb e7eb61981892966de5cef576f71fc7a8 0d14dab2d0c03940b95b9fb3a727c66a 6e1ff0dc311b9aa21a3054484802154c 1826c2a27a0914152aeb76f1168d4410` |
| `expected` | `1a0d5abf4432e7c612d658f8dcfa35b0 d1ab68b8d6bd4dd115c23cc57b5c5bcd de9bff0ece4208596e499f211bc07594 d0cb6f3c12b0e110174b2a9b4b2cb6a9` |

---

[← All algorithms](../README.md)
