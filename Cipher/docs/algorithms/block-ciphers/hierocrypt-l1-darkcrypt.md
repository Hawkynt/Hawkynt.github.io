# Hierocrypt-L1 (DarkCrypt)

> Hierocrypt-L1, Toshiba's NESSIE-submission nested-SPN block cipher (64-bit block, 128-bit key, 6 rounds, turning point 4), as used by the DarkCrypt Total Commander plugin. Validated against Toshiba's official specification.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Toshiba Corporation; DarkCrypt integration by Alexander Myasnikov |
| Year | 2000 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/darkcrypt-hierocrypt-l1.js`](../../../algorithms/block/darkcrypt-hierocrypt-l1.js) |

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
| Not selected by NESSIE | Hierocrypt-L1 was submitted to NESSIE but not selected for the final portfolio; cryptanalysis is comparatively limited. | Use AES or another vetted, widely analyzed cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Toshiba Specification on a Block Cipher: Hierocrypt-L1](https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/04_02espec.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Hierocrypt-L1 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `3ccc94b801fbf16d` |

**Vector 2** — [DarkCrypt Hierocrypt-L1 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `ac9260e52fba69a7` |

**Vector 3** — [DarkCrypt Hierocrypt-L1 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `08696d47f38c17d6` |

---

[← All algorithms](../README.md)
