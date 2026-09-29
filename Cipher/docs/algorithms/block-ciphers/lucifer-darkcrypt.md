# Lucifer (DarkCrypt)

> Lucifer variant from the DarkCrypt Total Commander plugin: 128-bit block, 128-bit key, 16-round Feistel network with a data/key-dependent interchange bit selecting between two byte-substitution tables per round, and a fixed bit-level diffusion permutation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Horst Feistel, Don Coppersmith (base Lucifer); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-lucifer.js`](../../../algorithms/block/darkcrypt-lucifer.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard variant | DarkCrypt-specific key schedule and S-box/permutation tables; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Lucifer (base algorithm, Sorkin 1984 specification)](https://www.tandfonline.com/doi/abs/10.1080/0161-118491858746)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Lucifer — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `6161616161616161c4c4c4c4c4c4c4c4` |

**Vector 2** — [DarkCrypt Lucifer — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `eac9ad3fbcad4fadbb6351a881169755` |

**Vector 3** — [DarkCrypt Lucifer — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `d4e265cd01b3b803b75efc1b0bda4a8b` |

---

[← All algorithms](../README.md)
