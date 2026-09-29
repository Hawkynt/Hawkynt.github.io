# Dragon (DarkCrypt)

> Real Dragon-256 eSTREAM Phase 3 Focus candidate: a single 1024-bit NLFSR filtered by a reversible F function built from two 8x32 S-boxes. 256-bit key, 256-bit IV. As implemented in the DarkCrypt Total Commander plugin, and bit-exact with the published specification's own official test vectors.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | K. Chen, M. Henricksen, W. Millan, J. Fuller, L. Simpson, E. Dawson, H. Lee, S. Moon |
| Year | 2004 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/stream/darkcrypt-dragon.js`](../../../algorithms/stream/darkcrypt-dragon.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |
| Nonce sizes | 32 bytes (256 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Historical eSTREAM Elimination | Advanced to Phase 3 Focus but not selected for the final eSTREAM portfolio; only known attacks are distinguishing attacks requiring keystream far beyond the specified 2^64-bit limit per key/IV pair. | — |

## Documentation

- [Dragon: A Fast Word Based Stream Cipher (ICISC 2004 paper, with S-box tables and official test vectors)](https://cr.yp.to/streamciphers/dragon-128/desc.pdf)
- [eSTREAM Dragon Page](https://www.ecrypt.eu.org/stream/dragonp2.html)
- [Dragon (cipher) - Wikipedia](https://en.wikipedia.org/wiki/Dragon_(cipher))

## References

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Unofficial Dragon C# reference implementation](https://github.com/lexbritvin/DragonCipher)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Dragon-256 official specification test vector 1](https://cr.yp.to/streamciphers/dragon-128/desc.pdf)

| Field | Value |
| --- | --- |
| `key` | `0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff` |
| `iv` | `0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `bc020767dc48dae314778d8c927e8b32 e086c6cde593c008600c9d47a488f622 3a2b94d6b853d64427e93362abb8ba21 751caaf7bd3165952a37fc1ea3f12fe2 5c133ba74c15ce4b3542fdf893daa751 f571025649795d5431914eba0de2c2a7 8013d29b56d4a0283eb6f3127644ecfe 38b9ca111924fbc94a0a30f2afff5fe0` |

**Vector 2** — [Dragon-256 official specification test vector 2](https://cr.yp.to/streamciphers/dragon-128/desc.pdf)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff` |
| `iv` | `00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `8d3ab9ba01daa3eb5cbd0f6de3ecfcab 619af808cf9c4a42e28777666d2d7037 ee6f94ac29d1eee5340db0478e91a679 480d8d882367ce2a31c96ad449e70756 815ebeb2290dba7a3ccb76a2257bd122 2b0b7aed917fafff6b58b2b2b05f24f6 e271a0169e897beff5c22451da6f9e40 52b78be56c97c1a5c6f8e7910f7b9c98` |

**Vector 3** — [DarkCrypt keystream, incrementing key](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `22b8bb95775a77d46bd97f643b13c95a b27c606b754f471589c6bdc686b8e739 89ec90975227504d8f98abb77b0c663f 827e999e9036d703374d77c0645774b2 a8868d42b10cdcbcf0392d2d4cf410e2 e2f01e091c7647cbdee00e3965343ebc be1d6eedb126b5d22b710679084fee34 57cc563dfe00d1bece925acd953062d7` |

**Vector 4** — [DarkCrypt incrementing plaintext, incrementing key](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `22b9b996735f71d363d0756f371ec755 a26d7278615a510291dfa7dd9aa5f926 a9cdb2b47602766aa7b1819c57214810 b24fabada403e1340f744dfb586a4a8d` |

---

[← All algorithms](../README.md)
