# XXTEA-TW (DarkCrypt)

> Fixed 64-bit-block cipher from the DarkCrypt Total Commander plugin, built from the XXTEA MX() round function with non-standard shifts (9/2, 3/6 vs textbook 5/2, 3/4) applied to a fixed 2-word block, 40 rounds. 64-bit block, 128-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | David Wheeler, Roger Needham (XXTEA MX round function); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-xxtea-tw.js`](../../../algorithms/block/darkcrypt-xxtea-tw.js) |

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
| Non-standard variant | Fixed-block XXTEA-derived construction with unusual shift amounts; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [XXTEA / Correction to XTEA (base MX round function)](http://www.movable-type.co.uk/scripts/xxtea.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Xxtea-tw — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `0ad350bb85878953` |

**Vector 2** — [DarkCrypt Xxtea-tw — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `1368421f3d8d4bf6` |

**Vector 3** — [DarkCrypt Xxtea-tw — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `8d047c2569514ca9` |

---

[← All algorithms](../README.md)
