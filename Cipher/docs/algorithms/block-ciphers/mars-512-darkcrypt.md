# MARS-512 (DarkCrypt)

> MARS variant from the DarkCrypt Total Commander plugin: standard MARS round structure (8 forward mixing + 16 keyed core + 8 backward mixing rounds) with the key expansion generalized to a 64-byte (512-bit) key via modulo indexing into the key-word array, beyond the official spec's 56-byte maximum.

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
| Source | [`algorithms/block/darkcrypt-mars-512.js`](../../../algorithms/block/darkcrypt-mars-512.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard key size | 512-bit key exceeds the official MARS specification's 448-bit maximum; the key-expansion generalization used to support it (arbitrary Nk via modulo indexing) is an unanalyzed DarkCrypt-specific extension. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [IBM MARS Specification](https://shaih.github.io/pubs/mars/mars.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Mars-512 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `3f994f870ea5d1f13e593d5848ea71cb` |

**Vector 2** — [DarkCrypt Mars-512 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `8d199c945f9b6dee2b61acb42e6607a1` |

**Vector 3** — [DarkCrypt Mars-512 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `9a1d3b13f9027ee033cb11ed176fb7e2` |

**Vector 4** — [DarkCrypt Mars-512 — key word with a long top bit run (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `5d9cebee6e1463b6751ff5c878dcb89c 4ecb59c89be600b164927e782e96ead2 6e531237dcea7abd5071a9da47589ee4 39dbe6db5b269a0f30c6028159e5028c` |
| `input` | `b2eed2e17c4fcdada8cf1d6e6b825050` |
| `expected` | `ae7eff91b80ed63e6e278d6825116396` |

---

[← All algorithms](../README.md)
