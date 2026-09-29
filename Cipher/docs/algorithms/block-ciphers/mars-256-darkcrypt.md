# MARS-256 (DarkCrypt)

> MARS variant from the DarkCrypt Total Commander plugin: standard MARS round structure (8 forward mixing + 16 keyed core + 8 backward mixing rounds) with the key expansion generalized to a 32-byte (256-bit) key via modulo indexing into the key-word array, beyond the official spec's 56-byte maximum.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | IBM (Carolynn Burwick, Don Coppersmith, et al.); DarkCrypt variant by Alexander Myasnikov |
| Year | 1998 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-mars-256.js`](../../../algorithms/block/darkcrypt-mars-256.js) |

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
| Non-standard key size | 256-bit key size is within the official MARS range but the specific key-expansion generalization used here (arbitrary Nk via modulo indexing) has not been independently analyzed for this DarkCrypt variant family. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [IBM MARS Specification](https://shaih.github.io/pubs/mars/mars.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST AES round-1 MARS KAT ecb_vk.txt, KEYSIZE=256, I=1](https://web.archive.org/web/20070109105456if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/mars-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `8000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `1ce37ef4c368af1401ef3b10eac653eb` |

**Vector 2** — [DarkCrypt Mars — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `c90680f1f61e6f4ea42aada268a97c7a` |

**Vector 3** — [DarkCrypt Mars — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `6b1c86d4580004b4fe3ff0bb57fc5275` |

**Vector 4** — [DarkCrypt Mars — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `ecf145c4976643e8dc7aa94f41879a2b` |

---

[← All algorithms](../README.md)
