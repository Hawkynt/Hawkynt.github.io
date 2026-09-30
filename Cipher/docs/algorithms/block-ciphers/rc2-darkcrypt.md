# RC2 (DarkCrypt)

> RC2 block cipher from the DarkCrypt Total Commander plugin, keyed with a fixed 1024-bit (128-byte) key copied verbatim into the subkey table (no PITABLE key-schedule pass) and a MIX round whose register wiring is shifted one position from RFC 2268's textbook layout.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Ron Rivest (RSA Security); DarkCrypt variant by Alexander Myasnikov |
| Year | 1987 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-rc2.js`](../../../algorithms/block/darkcrypt-rc2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 128 bytes (1024 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard variant | Uses a raw 1024-bit key with no key schedule and a shifted mix wiring compared to RFC 2268; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [RFC 2268 - A Description of the RC2(r) Encryption Algorithm](https://www.rfc-editor.org/rfc/rfc2268.txt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Rc2 — incrementing key, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f` |
| `input` | `0000000000000000` |
| `expected` | `60a9bd23ab51d808` |

**Vector 2** — [DarkCrypt Rc2 — incrementing key, incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f` |
| `input` | `0001020304050607` |
| `expected` | `a74666e1c9e7c5a7` |

**Vector 3** — [DarkCrypt Rc2 — random key/plaintext (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `618623fb63d8cb12187d4d6b55fd7f32 43b5f238fac5b9de720001828e7930b7 139be46376d9b852814b04a349255e7e 77b2ab704617f16edd96d543dce86c13 c1b77ff33217d4caeda59de05154a064 f19ead889d7fecd79ae7ad40cbfb63bf d231210829f1ee8a7b6b79ee94ccaee7 848e968d84562f5c1e7ccc7770e66d24` |
| `input` | `533ed7cd641fca4d` |
| `expected` | `4e8fcd46ff99c92f` |

---

[← All algorithms](../README.md)
