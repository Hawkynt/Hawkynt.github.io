# Khufu-512 (DarkCrypt)

> Ralph Merkle's Khufu cipher with a 544-bit key as implemented in the DarkCrypt Total Commander plugin: 64-bit Feistel block, 8 octets of 8 rounds (64 rounds total), key-dependent S-boxes built via a self-referential bootstrap encryption. Keeps the implementation's quirk in the key schedule's swap-index computation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Ralph Merkle; DarkCrypt variant by Alexander Myasnikov |
| Year | 1990 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-khufu512.js`](../../../algorithms/block/darkcrypt-khufu512.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 68 bytes (544 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard key schedule | The swap-index computation uses a lower bound of 16 whenever it regenerates its random batch, so the S-box shuffle is not a uniform permutation. | Use AES or another vetted cipher. |
| Differential cryptanalysis (base Khufu) | Textbook Khufu is broken by differential cryptanalysis; this DarkCrypt variant is unanalyzed. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Merkle, "Fast Software Encryption Functions", CRYPTO '90](https://link.springer.com/chapter/10.1007/3-540-38424-3_34)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Khufu — zero key/plaintext (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000` |
| `input` | `0000000000000000` |
| `expected` | `8786833be7a2484b` |

**Vector 2** — [DarkCrypt Khufu — incrementing key/plaintext (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 40414243` |
| `input` | `0001020304050607` |
| `expected` | `afecebcbd79deb12` |

**Vector 3** — [DarkCrypt Khufu — shifted incrementing key/plaintext (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40 41424344` |
| `input` | `1011121314151617` |
| `expected` | `c17d0d3f8c6ee28e` |

---

[← All algorithms](../README.md)
