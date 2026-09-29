# SEED (DarkCrypt)

> RFC 4269 SEED as implemented in the DarkCrypt Total Commander plugin: identical Feistel structure, G/F-functions, S-boxes and key schedule, but the 128-bit block and key words are packed little-endian instead of RFC 4269's big-endian convention. 128-bit block, 128-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Korea Internet and Security Agency (KISA); DarkCrypt packaging by Alexander Myasnikov |
| Year | 1998 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-seed.js`](../../../algorithms/block/darkcrypt-seed.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard byte order | Little-endian word packing variant of SEED; unanalyzed as such and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [RFC 4269 - The SEED Encryption Algorithm](https://tools.ietf.org/rfc/rfc4269.txt)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 4269 Appendix B.1 SEED test vector (each 32-bit word byte-swapped into the little-endian order this build uses)](https://www.rfc-editor.org/rfc/rfc4269.txt)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `03020100070605040b0a09080f0e0d0c` |
| `expected` | `e0c6ba5e68164e05ccf1af19db6c346d` |

**Vector 2** — [DarkCrypt Seed — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `e49d69901e7093786b19117592af12e3` |

**Vector 3** — [DarkCrypt Seed — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `11f03014e70cb0017c6126cc57c6d886` |

**Vector 4** — [DarkCrypt Seed — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `b90d6bb8daa501aa19f53729e4eb2dd4` |

---

[← All algorithms](../README.md)
