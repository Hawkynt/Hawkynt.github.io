# Sobbikashi (DarkCrypt)

> 128-bit block, 512-bit key cipher from the DarkCrypt Total Commander plugin. A CAST-256-shaped generalized Feistel network (standard Type1/2/3 F-functions and S-boxes) run for 14 quad-rounds with a custom 512-bit key schedule.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Alexander Myasnikov (DarkCrypt / "Zarya" project) |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-sobbikashi.js`](../../../algorithms/block/darkcrypt-sobbikashi.js) |

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
| Unanalyzed non-standard construction | Uses CAST-256's public round-function formulas but with a non-standard round count and a custom, unanalyzed 512-bit key schedule with unused (always-zero) subkey slots for the first six quad-rounds. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [CAST-256 (RFC 2612) - the round-function family this cipher borrows from](https://www.rfc-editor.org/rfc/rfc2612)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Sobbikashi — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `76c519ced2629aa405fa4f8bd08618c1` |

**Vector 2** — [DarkCrypt Sobbikashi — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `fbb5cefcc945ba334ed378109f8a503d` |

**Vector 3** — [DarkCrypt Sobbikashi — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `8779a3bc256932680273875f4c9861f7` |

---

[← All algorithms](../README.md)
