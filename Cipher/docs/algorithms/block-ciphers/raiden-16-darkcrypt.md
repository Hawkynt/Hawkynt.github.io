# Raiden-16 (DarkCrypt)

> Raiden, the genetic-programming-designed TEA replacement of Polimon, Hernandez-Castro, Estevez-Tapiador and Ribagorda, at the 16 rounds used by the published reference implementation and shipped by the DarkCrypt Total Commander plugin. TEA/XTEA-family Feistel network with a self-mutating 4-word key state (no separate DELTA accumulator). 64-bit block, 128-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Javier Polimon, Julio C. Hernandez-Castro, Juan M. Estevez-Tapiador, Arturo Ribagorda |
| Year | 2006 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-raiden.js`](../../../algorithms/block/darkcrypt-raiden.js) |

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
| Broken by differential cryptanalysis | An iterative differential characteristic covering the full cipher is known from automated trail search on ARX constructions, and related-key attacks have also been published. Raiden is broken and must not be used to protect anything. | Use AES or another vetted cipher. |
| All-zero weak key | Under the all-zero key every round value is zero and the round function degenerates, leaving the all-zero block unencrypted. No round constant exists to prevent this. | Never use an all-zero key. |

## Documentation

- [Raiden: A genetically developed Block Cipher (reference implementation)](https://raiden-cipher.sourceforge.net/)
- [Polimon, Hernandez-Castro, Estevez-Tapiador, Ribagorda - Automated design of a lightweight block cipher with Genetic Programming](https://kar.kent.ac.uk/31960/1/Automated%20design%20of%20a%20lightweight%20block.pdf)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Raiden reference implementation - zero plaintext, incrementing key](https://raiden-cipher.sourceforge.net/)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0000000000000000` |
| `expected` | `979531fe59845bca` |

**Vector 2** — [Raiden reference implementation - incrementing key/plaintext](https://raiden-cipher.sourceforge.net/)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `3e7ff369dad916bc` |

**Vector 3** — [Raiden reference implementation - shifted incrementing key/plaintext](https://raiden-cipher.sourceforge.net/)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `44d5e9b829102175` |

**Vector 4** — [Raiden reference implementation - all-ones plaintext, descending key](https://raiden-cipher.sourceforge.net/)

| Field | Value |
| --- | --- |
| `key` | `0f0e0d0c0b0a09080706050403020100` |
| `input` | `ffffffffffffffff` |
| `expected` | `54bb5cfd485c0af6` |

---

[← All algorithms](../README.md)
