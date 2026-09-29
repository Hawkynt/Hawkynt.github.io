# MARS-1248 (DarkCrypt)

> MARS variant from the DarkCrypt Total Commander plugin: standard MARS round structure (8 forward mixing + 16 keyed core + 8 backward mixing rounds) with the key expansion generalized to a 156-byte (1248-bit) key via modulo indexing into the key-word array, beyond the official spec's 56-byte maximum.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | IBM (Carolynn Burwick, Don Coppersmith, et al.); DarkCrypt variant by Alexander Myasnikov |
| Year | 1998 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-mars-1248.js`](../../../algorithms/block/darkcrypt-mars-1248.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 156 bytes (1248 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard key size | 1248-bit key vastly exceeds the official MARS specification's 448-bit maximum; the key-expansion generalization used to support it (arbitrary Nk via modulo indexing) is an unanalyzed DarkCrypt-specific extension. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [IBM MARS Specification](https://shaih.github.io/pubs/mars/mars.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Mars1248 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `2242d12bd3949549c1ecb9f797e0be96` |

**Vector 2** — [DarkCrypt Mars1248 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `1193e3e356685cd532a0d40d7919c3e5` |

**Vector 3** — [DarkCrypt Mars1248 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40 4142434445464748494a4b4c4d4e4f50 5152535455565758595a5b5c5d5e5f60 6162636465666768696a6b6c6d6e6f70 7172737475767778797a7b7c7d7e7f80 8182838485868788898a8b8c8d8e8f90 9192939495969798999a9b9c` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `455291d62e31b03112052d0373e019cf` |

---

[← All algorithms](../README.md)
