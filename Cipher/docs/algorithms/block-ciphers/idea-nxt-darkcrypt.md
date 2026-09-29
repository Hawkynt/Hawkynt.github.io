# IDEA-NXT (DarkCrypt)

> FOX128/256/32 (IDEA NXT-128 with a 256-bit key, 32 rounds): an Extended Lai-Massey block cipher by Junod and Vaudenay (EPFL), built from an f64 substitution-diffusion round function (sigma8 S-box layer plus an (8,8) MDS mu8 matrix over GF(2^8)) and orthomorphisms. 128-bit block, 256-bit key. As implemented by the DarkCrypt Total Commander plugin, which uses 32 rounds (vs. the generic FOX128/256 default of 16) and an all-zero key-schedule pad constant.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Pascal Junod, Serge Vaudenay (EPFL); DarkCrypt port by Alexander Myasnikov |
| Year | 2004 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/block/darkcrypt-ideanxt.js`](../../../algorithms/block/darkcrypt-ideanxt.js) |

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
| Patent-encumbered design | IDEA NXT/FOX was covered by software patents held by MediaCrypt AG; unrelated to any cryptographic weakness. | Use AES or another vetted, unencumbered cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [FOX: a New Family of Block Ciphers (Junod, Vaudenay, SAC 2004)](https://crypto.junod.info/sac04a.pdf)
- [IDEA NXT reference implementation (O. Gay, 2006)](https://github.com/ogay/idea_nxt)
- [IDEA NXT overview (Wikipedia)](https://en.wikipedia.org/wiki/IDEA_NXT)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Ideanxt — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `180880d3e4ea58fc61294492bcb46ae6` |

**Vector 2** — [DarkCrypt Ideanxt — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `7cfe4b5c127efe0676dc062e929b2846` |

**Vector 3** — [DarkCrypt Ideanxt — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `41d8033ba27c7f215294ca9b0cf25211` |

---

[← All algorithms](../README.md)
