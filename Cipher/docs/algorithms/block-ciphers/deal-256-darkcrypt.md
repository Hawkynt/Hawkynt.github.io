# DEAL-256 (DarkCrypt)

> DEAL block cipher (Knudsen/Outerbridge AES candidate) using DES as its round function: 8 rounds, four 64-bit round-key-schedule DES encryptions with a fixed key. 128-bit block, 256-bit key. As implemented in the DarkCrypt Total Commander plugin, matching the standard DEAL-256 construction exactly.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Lars Knudsen, Richard Outerbridge; DarkCrypt packaging by Alexander Myasnikov |
| Year | 1998 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-deal.js`](../../../algorithms/block/darkcrypt-deal.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Key-schedule weaknesses | Equivalent keys and related-key attacks found by Kelsey and Schneier; not selected as an AES finalist. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [DEAL (Wikipedia)](https://en.wikipedia.org/wiki/DEAL)
- [Key-Schedule Cryptanalysis of DEAL (Kelsey, Schneier)](https://www.schneier.com/wp-content/uploads/2016/02/paper-deal.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Deal — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `f0137a90d2268b14614f67c16aa5ec51` |

**Vector 2** — [DarkCrypt Deal — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `5b9014b97fdc142a19b54e5107666fe9` |

**Vector 3** — [DarkCrypt Deal — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `671a2730e253852dba5a9a2f54b84004` |

---

[← All algorithms](../README.md)
