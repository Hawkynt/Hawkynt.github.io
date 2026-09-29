# Hermes8 (DarkCrypt)

> Hermes8 byte-oriented stream cipher as shipped in the DarkCrypt Total Commander plugin. Built around the AES S-box with a 17-byte state register and an evolving 16-byte key register. 128-bit key, 128-bit IV.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Ulrich Kaiser (Hermes8); DarkCrypt variant by Alexander Myasnikov |
| Year | 2005 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-hermes.js`](../../../algorithms/stream/darkcrypt-hermes.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not selected for eSTREAM | Hermes8 was an eSTREAM Phase 1 candidate that was not advanced; the DarkCrypt variant is unanalysed. | Use a vetted cipher such as ChaCha20 or AES-GCM. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Hermes8 eSTREAM submission](https://www.ecrypt.eu.org/stream/hermes8.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Hermes - 128 zero bytes, key 00..0f, iv 0](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `896e260cddf5618498ce69e189f2c6e8 d2ece3bae069a04485b9853fec8bf3c4 ae6682ed94adc3854f080d1d161146d0 00e22ce9e71c72ea29808d5dcfcc7121 bbe2234825f52a48f29c5a833c0df270 b6da8d53350b29129d8e1be363200059 5582ceb16211c4f5dad13ab26b763663 25b6b9923a28e1becc05ad433a887a38` |

**Vector 2** — [DarkCrypt Hermes - encrypt 00..3f, key 00..0f, iv 0](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `896f240fd9f0678390c763ea85ffc8e7 c2fdf1a9f47cb6539da09f24f096eddb 8e47a0ceb088e5a2672127363a3c68ff 30d31edad32944dd11b9b766f3f14f1e` |

---

[← All algorithms](../README.md)
