# CAST-256 (DarkCrypt)

> RFC 2612 CAST-256 (CAST6) as implemented in the DarkCrypt Total Commander plugin: identical round function, key schedule and S-boxes, but 128-bit block and key words are packed little-endian instead of the RFC's big-endian convention. 128-bit block, 256-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Carlisle Adams, Stafford Tavares; DarkCrypt packaging by Alexander Myasnikov |
| Year | 1998 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-cast256.js`](../../../algorithms/block/darkcrypt-cast256.js) |

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
| Non-standard byte order | Little-endian word packing variant of CAST-256; unanalyzed as such and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [RFC 2612 - The CAST-256 Encryption Algorithm](https://www.rfc-editor.org/rfc/rfc2612.txt)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 2612 Appendix A CAST-256 test vector, KEYSIZE=256 (each 32-bit word byte-swapped into the little-endian order this build uses)](https://www.rfc-editor.org/rfc/rfc2612.txt)

| Field | Value |
| --- | --- |
| `key` | `9ebb42232c5438fa83acd0be98c20a94ce477c8d4608492613b5c11c04b6e67a` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `38206a4fb9976828360187c9fa173355` |

**Vector 2** — [DarkCrypt Cast256 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `aa55c231eb024287e914d7a0f60733b5` |

**Vector 3** — [DarkCrypt Cast256 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `b3fb2cefcad5532de25bfc0f905a19f4` |

**Vector 4** — [DarkCrypt Cast256 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `f2f8c35a6818087b4b22b9c5b0b98a32` |

---

[← All algorithms](../README.md)
