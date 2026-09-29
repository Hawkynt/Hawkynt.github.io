# TWOPES (DarkCrypt)

> Double-IDEA block cipher from the DarkCrypt Total Commander plugin: two consecutive 8-round IDEA passes over a 64-bit block using multiplication mod 65537. The 256-bit key is split into two 128-bit halves, each driving its own IDEA key schedule.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | IDEA by Xuejia Lai and James Massey; DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-twopes.js`](../../../algorithms/block/darkcrypt-twopes.js) |

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
| Non-standard variant | Undocumented double-IDEA construction with a custom key schedule and subkey whitening constant; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [IDEA (base algorithm)](https://en.wikipedia.org/wiki/International_Data_Encryption_Algorithm)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Twopes — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `e4118731984818f7` |

**Vector 2** — [DarkCrypt Twopes — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `0001020304050607` |
| `expected` | `94098860114ea1fd` |

**Vector 3** — [DarkCrypt Twopes — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `1011121314151617` |
| `expected` | `8ae166fe3a8d91b2` |

---

[← All algorithms](../README.md)
