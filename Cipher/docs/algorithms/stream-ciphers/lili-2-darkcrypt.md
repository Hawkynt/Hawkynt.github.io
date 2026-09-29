# LILI-2 (DarkCrypt)

> Enlarged successor to LILI-128 used by the DarkCrypt Total Commander plugin: two 128-bit clock-controlled shift registers (LFSRc, LFSRd) with Galois-style table-driven feedback and a 4096-entry nonlinear Boolean function, seeded via a key+IV whitening step and two self-referential 255-bit compression rounds.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Alexander Myasnikov ("Zarya" project, DarkCrypt plugin) |
| Year | 2008 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-lili2.js`](../../../algorithms/stream/darkcrypt-lili2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unanalyzed proprietary variant | Non-public enlargement of LILI-128 with no independent cryptanalysis; not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [LILI Keystream Generator (base LILI-128 design, SAC 2000 paper)](https://www.researchgate.net/publication/2528091_LILI_Keystream_Generator)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Lili2 — keystream from incrementing key, zero IV/input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `1198a219a3f3ed729500b3a54187f40d bbc9da59ceb3216f2dfbfdb31b70b634 63eba7448eed9b629b622cd545b9a458 eb4f559e145be166fff1f640d7e70612 3a61be369b294af9dd489193b7b0eaf0 eb7dd8deaa3efa309344810abc1db154 57816e31b6ea37b1b2d437d994c52a14 b172af605149529e6ec3a9c28782ac1c` |

**Vector 2** — [DarkCrypt Lili2 — incrementing key/plaintext, zero IV](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `1199a01aa7f6eb759d09b9ae4d8afa02 abd8c84adaa6377835e2e7a8076da82b 43ca8567aac8bd45b34b06fe69948a77 db7e67ad206ed751c7c8cc7bebda382d` |

---

[← All algorithms](../README.md)
