# LOKI97 (DarkCrypt)

> LOKI97 as implemented in the DarkCrypt Total Commander plugin. 128-bit block, 256-bit key, 16-round Feistel with GF-based S-boxes (S1 in GF(2^13), S2 in GF(2^11)), a bit-scatter permutation, and a DELTA=0x9E3779B97F4A7C15 key schedule.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Lawrie Brown, Josef Pieprzyk, Jennifer Seberry (base LOKI97); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-loki97.js`](../../../algorithms/block/darkcrypt-loki97.js) |

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
| Differential/linear weaknesses | LOKI97 was cryptanalysed during the AES process and is not competitive; this DarkCrypt build is unanalysed. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [LOKI97 (AES submission, base algorithm)](https://www.unsw.adfa.edu.au/~lpb/research/loki97/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST AES round-1 LOKI97 KAT ecb_single.txt, 256-bit key (key words reordered into the little-endian, reversed 64-bit-word order this build expects)](https://web.archive.org/web/20070109105533if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/loki97-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `1b1a19181f1e1d1c13121110171615140b0a09080f0e0d0c0302010007060504` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `75080e359f10fe640144b35c57128dad` |

**Vector 2** — [DarkCrypt Lokilib — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `78914e82206f130a6619b59cb5fe4f3b` |

**Vector 3** — [DarkCrypt Lokilib — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `16f9beb8cf88424b8b56c5d3a96da8c7` |

**Vector 4** — [DarkCrypt Lokilib — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `b5635930e1d8ed8bbe7963efe306def1` |

---

[← All algorithms](../README.md)
