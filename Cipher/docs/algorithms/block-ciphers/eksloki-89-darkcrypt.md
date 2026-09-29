# EksLOKI-89 (DarkCrypt)

> Expanded LOKI89 variant from the DarkCrypt Total Commander plugin. Uses a 256-bit key expanded via an RC4-like key schedule into a 256-byte permutation supplying subkeys for an 18-round Feistel network whose round function stacks multiple LOKI89 S-box/permutation passes. 64-bit block, 256-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Lawrie Brown, Josef Pieprzyk, Jennifer Seberry (base LOKI89); DarkCrypt variant by Alexander Myasnikov |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-eksloki89.js`](../../../algorithms/block/darkcrypt-eksloki89.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard variant | Custom expanded LOKI89 with a bespoke key schedule and round function; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [LOKI89 (base algorithm)](https://en.wikipedia.org/wiki/LOKI)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Eksloki89 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `ce1f4a43dbf023a2` |

**Vector 2** — [DarkCrypt Eksloki89 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `0001020304050607` |
| `expected` | `11a7f5d2c116be80` |

**Vector 3** — [DarkCrypt Eksloki89 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `1011121314151617` |
| `expected` | `d4b4ee5170264650` |

---

[← All algorithms](../README.md)
