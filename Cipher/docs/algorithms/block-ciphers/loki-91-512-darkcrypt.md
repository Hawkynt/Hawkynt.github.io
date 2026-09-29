# LOKI'91-512 (DarkCrypt)

> LOKI'91 variant from the DarkCrypt Total Commander plugin: standard 16-round Feistel network with the textbook LOKI'91 S-P round function, extended to a 512-bit (64-byte) key used directly as the 16 round subkeys (no key-rotation schedule). The external interface is 128 bits; only the first 8 bytes are transformed, the last 8 pass through unchanged.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Lawrie Brown, Josef Pieprzyk, Jennifer Seberry; DarkCrypt variant by Alexander Myasnikov |
| Year | 1991 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-loki91.js`](../../../algorithms/block/darkcrypt-loki91.js) |

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
| Non-standard key schedule and block truncation | The 512-bit key is used directly as 16 round subkeys with no rotation schedule, and only the first 8 of 16 declared block bytes are actually transformed (the remaining 8 pass through unchanged, unauthenticated). Unanalyzed variant, not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [LOKI91 Specification](https://www.unsw.adfa.edu.au/~lpb/papers/loki91.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Loki91 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `bd84a2085ef609c70000000000000000` |

**Vector 2** — [DarkCrypt Loki91 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `ec14f4dd6d1c49bc08090a0b0c0d0e0f` |

**Vector 3** — [DarkCrypt Loki91 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `8a8ae6452c77f35b18191a1b1c1d1e1f` |

---

[← All algorithms](../README.md)
