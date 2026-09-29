# Misty1 (DarkCrypt)

> MISTY1 block cipher (Matsui, 1996) as implemented in the DarkCrypt Total Commander plugin: standard S7 table, a non-standard S9 table, non-standard FI/FO combining formulas, and a final word swap. Declares a 256-bit key but only the first 128 bits are used. 64-bit block.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Mitsuru Matsui (base MISTY1); DarkCrypt variant by Alexander Myasnikov |
| Year | 1996 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-misty1.js`](../../../algorithms/block/darkcrypt-misty1.js) |

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
| Non-standard variant | DarkCrypt uses a modified S9 table and non-standard FI/FO combining formulas, and silently discards half of the declared 256-bit key; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [RFC 2994 - A Description of the MISTY1 Encryption Algorithm](https://tools.ietf.org/rfc/rfc2994.txt)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Official MISTY1 test data (CRYPTREC specification, 8 rounds; each 32-bit word byte-swapped into this build order, key zero-extended to the 32 bytes this build accepts)](https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/05_02espec.pdf)

| Field | Value |
| --- | --- |
| `key` | `3322110077665544bbaa9988ffeeddcc00000000000000000000000000000000` |
| `input` | `67452301efcdab89` |
| `expected` | `f5a51d8b7cd0b36a` |

**Vector 2** — [DarkCrypt Misty — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `81624ab96f0fb76c` |

**Vector 3** — [DarkCrypt Misty — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `0001020304050607` |
| `expected` | `8ba6bd45ec482725` |

**Vector 4** — [DarkCrypt Misty — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `1011121314151617` |
| `expected` | `a3786b1085819599` |

---

[← All algorithms](../README.md)
