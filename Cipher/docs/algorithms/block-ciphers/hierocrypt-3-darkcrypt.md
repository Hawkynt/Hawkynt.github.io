# Hierocrypt-3 (DarkCrypt)

> Hierocrypt-3, Toshiba's NESSIE-submission nested-SPN block cipher, fixed to a 256-bit key (8 rounds, turning point 5) as used by the DarkCrypt Total Commander plugin. 128-bit block. Validated against Toshiba's official specification.

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
| Source | [`algorithms/block/darkcrypt-hierocrypt3.js`](../../../algorithms/block/darkcrypt-hierocrypt3.js) |

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
| Not selected by NESSIE | Hierocrypt-3 was submitted to NESSIE but not selected for the final portfolio; cryptanalysis is comparatively limited. | Use AES or another vetted, widely analyzed cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Toshiba Specification on a Block Cipher: Hierocrypt-3](https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/08_02espec.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Toshiba Hierocrypt-3 specification test data, 256-bit key](https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/08_02espec.pdf)

| Field | Value |
| --- | --- |
| `key` | `11a180269a78dda4994746213b5a6dd6e34ffe0cc465d583aff66e1329419c94` |
| `input` | `c16d7efca1cbafc7625cbe9c2593de2d` |
| `expected` | `c86cd3b4a3185232e3457d638c6515c9` |

**Vector 2** — [DarkCrypt Hierocrypt-3 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `a509d3d04066cd974d72135b0b44f64c` |

**Vector 3** — [DarkCrypt Hierocrypt-3 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `b1921a8d0f1a281b0f7660064c586279` |

**Vector 4** — [DarkCrypt Hierocrypt-3 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `e220dfc4b0b3e8464b518f9cb48038f2` |

---

[← All algorithms](../README.md)
