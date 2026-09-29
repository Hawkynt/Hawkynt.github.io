# Raiden-32 (DarkCrypt)

> Raiden, the genetic-programming-designed TEA replacement of Polimon, Hernandez-Castro, Estevez-Tapiador and Ribagorda, at 32 rounds. Same round function and key state as the 16-round variant, double the rounds. 64-bit block, 128-bit key.

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
| Source | [`algorithms/block/darkcrypt-raiden32.js`](../../../algorithms/block/darkcrypt-raiden32.js) |

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
| Broken by differential cryptanalysis | An iterative differential characteristic covering all 32 rounds is known from automated trail search on ARX constructions, and related-key attacks have also been published. Raiden is broken and must not be used to protect anything. | Use AES or another vetted cipher. |
| All-zero weak key | Under the all-zero key every round value is zero and the round function degenerates, leaving the all-zero block unencrypted. No round constant exists to prevent this. | Never use an all-zero key. |

## Documentation

- [Raiden: A genetically developed Block Cipher (reference implementation)](https://raiden-cipher.sourceforge.net/)
- [Polimon, Hernandez-Castro, Estevez-Tapiador, Ribagorda - Automated design of a lightweight block cipher with Genetic Programming](https://kar.kent.ac.uk/31960/1/Automated%20design%20of%20a%20lightweight%20block.pdf)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Raiden reference implementation at 32 rounds - zero plaintext, incrementing key](https://raiden-cipher.sourceforge.net/)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0000000000000000` |
| `expected` | `0dfbba0b541353e6` |

**Vector 2** — [Raiden reference implementation at 32 rounds - incrementing key/plaintext](https://raiden-cipher.sourceforge.net/)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `cef61fb072688a0b` |

**Vector 3** — [Raiden reference implementation at 32 rounds - shifted incrementing key/plaintext](https://raiden-cipher.sourceforge.net/)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `2535aeb794e36c1b` |

**Vector 4** — [Raiden reference implementation at 32 rounds - all-ones plaintext, descending key](https://raiden-cipher.sourceforge.net/)

| Field | Value |
| --- | --- |
| `key` | `0f0e0d0c0b0a09080706050403020100` |
| `input` | `ffffffffffffffff` |
| `expected` | `fa9202a8c35ac2f3` |

---

[← All algorithms](../README.md)
