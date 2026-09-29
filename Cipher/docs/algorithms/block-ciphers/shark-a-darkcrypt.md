# SHARK-A (DarkCrypt)

> SHARK-A variant from the DarkCrypt Total Commander plugin: a non-standard SHARK derivative with a GF(2^8) plaintext-whitening multiplier, six full-diffusion rounds (no separate S-box-only final round) and a rejection-sampled round-key schedule. 64-bit block, 128-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Vincent Rijmen, Joan Daemen, Bart Preneel, Anton Bosselaers, Erik De Win (base SHARK); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-shark-a.js`](../../../algorithms/block/darkcrypt-shark-a.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard variant | Bespoke SHARK derivative with an undocumented key schedule and round structure; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [SHARK (base algorithm)](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/shark.zip)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Shark — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `446d7d01312bb9ce` |

**Vector 2** — [DarkCrypt Shark — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `c91316734048a0f9` |

**Vector 3** — [DarkCrypt Shark — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `081b61f75f592646` |

---

[← All algorithms](../README.md)
