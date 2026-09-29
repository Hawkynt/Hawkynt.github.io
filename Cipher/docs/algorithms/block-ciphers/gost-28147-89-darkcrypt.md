# GOST-28147-89 (DarkCrypt)

> GOST 28147-89 (Magma) variant from the DarkCrypt Total Commander plugin: textbook 32-round Feistel schedule (K0..K7 x3, then K7..K0), but with a non-standard, hardcoded S-box set (one table is not even a bijection). 64-bit block, 256-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Soviet Union cryptographers (base GOST 28147-89); DarkCrypt variant by Alexander Myasnikov |
| Year | 1989 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-gost.js`](../../../algorithms/block/darkcrypt-gost.js) |

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
| Non-standard S-box | Uses a hardcoded S-box set where one of the four substitution tables is not a bijection; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [GOST 28147-89 (base algorithm)](https://en.wikipedia.org/wiki/GOST_(block_cipher))

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Gost — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `0b07331dd419cc0d` |

**Vector 2** — [DarkCrypt Gost — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `0001020304050607` |
| `expected` | `5a167e04fd82ee68` |

**Vector 3** — [DarkCrypt Gost — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `1011121314151617` |
| `expected` | `5c0fb1419d6b9c6d` |

---

[← All algorithms](../README.md)
