# Serpent (DarkCrypt)

> Serpent variant from the DarkCrypt Total Commander plugin: standard 32-round S-box/linear-transform structure, but a non-overlapping flat key-schedule recurrence (unlike the overlapping circular-buffer recurrence used by common reference sources). Fixed 256-bit key, 128-bit block.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Ross Anderson, Eli Biham, Lars Knudsen (base Serpent); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-serpent.js`](../../../algorithms/block/darkcrypt-serpent.js) |

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
| Non-standard key schedule | Uses a non-overlapping prekey generation scheme instead of the overlapping circular-buffer recurrence common in reference sources; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Serpent (base algorithm)](https://www.cl.cam.ac.uk/~rja14/serpent.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST AES round-1 Serpent KAT ecb_vk.txt, KEYSIZE=256, I=1 (byte order reversed, the little-endian convention this build uses)](https://web.archive.org/web/20070109105707if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/serpent-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000080` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `1908ef821ad2ebc0cb28bf66e796edab` |

**Vector 2** — [DarkCrypt Serpent — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `49672ba898d98df95019180445491089` |

**Vector 3** — [DarkCrypt Serpent — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `de269ff833e432b85b2e88d2701ce75c` |

**Vector 4** — [DarkCrypt Serpent — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `b3691ac95c69060089c450f61fe384b7` |

---

[← All algorithms](../README.md)
