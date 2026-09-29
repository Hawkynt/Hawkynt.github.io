# NUSH (DarkCrypt)

> NUSH block cipher (128-bit block / 256-bit key variant), a NESSIE submission by LAN Crypto (Lebedev, Volchkov) using only XOR/AND/OR/modular addition/rotation - no s-boxes. 17 rounds of a 4-branch mixing function R with per-round constants and rotation amounts. Not selected for the NESSIE portfolio due to a low security margin. The DarkCrypt Total Commander plugin implements this variant with big-endian internal word interpretation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Anatoly N. Lebedev, Alexey A. Volchkov (LAN Crypto, Int.) |
| Year | 2000 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-nush.js`](../../../algorithms/block/darkcrypt-nush.js) |

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
| Low security margin / linear cryptanalysis | NESSIE's Phase I evaluation found NUSH has an extremely low security margin; linear cryptanalysis breaks it with less effort than brute force. | Use AES or another vetted, standardized cipher. |

## Documentation

- [NUSH Block (NESSIE submission, LAN Crypto, 2000)](https://web.archive.org/web/20060621194846/http://www.cosic.esat.kuleuven.ac.be:80/nessie/workshop/submissions/nush.zip)
- [NUSH - Wikipedia](https://en.wikipedia.org/wiki/NUSH)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NESSIE submission test vectors for NUSH, 128-bit block with 256-bit key, set 1 vector 0 (each 32-bit word byte-swapped into the little-endian order this build uses)](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/nush.zip)

| Field | Value |
| --- | --- |
| `key` | `0000008000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `31217b784f1b2fe51590db2a1cd8cf5e` |

**Vector 2** — [DarkCrypt Nush — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `79c6fedb903b010644e23280095061d9` |

**Vector 3** — [DarkCrypt Nush — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `17bcdf28c0ee54496accadbae6e98c80` |

**Vector 4** — [DarkCrypt Nush — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `08ed2ed5860dba64fa983c15939a7538` |

---

[← All algorithms](../README.md)
