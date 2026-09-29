# SCOP-384 (DarkCrypt)

> 384-bit table-driven stream cipher as implemented in the DarkCrypt Total Commander plugin kernel, built on an imul-chain key schedule and an RC4-like additive combiner. No public specification of DarkCrypt's own SCOP-384 variant is known.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Unknown (DarkCrypt variant) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-scop.js`](../../../algorithms/stream/darkcrypt-scop.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 48 bytes (384 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |
| Nonce sizes | 0 bytes (0 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unanalyzed proprietary construction | Custom polynomial key schedule and additive (non-XOR) RC4-like combiner with no public design rationale or third-party cryptanalysis. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Scop — keystream from 128 zero bytes, 48-byte incrementing key](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `e2ee660b62e416934a31c17c949a93e0 5692a0d5a8d4971a4a9e94929823f1e5 d8ed60d1c201d50ad6af1eec1e29917a 6d1ef7cf829d847504dda2f0e010f85f e98d7676c2e5d801da0288a3ee4217bb b2d747f2f5973b4a84bd36c6f291df04 847310e2203cf7b8744230088c1e978c be79febd6d08b9a8bef1356e44d92f0b` |

**Vector 2** — [DarkCrypt Scop — encryption of 64 incrementing bytes, 48-byte incrementing key](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `e2ef680e66e91c9a523acb87a0a7a1ef 66a3b2e8bce9ad3162b7aeadb4400f05 f80e83f4e626fb31fed848174a56bfa9 9d4f2903b6d2baac3c16dd2b1c4e369f` |

---

[← All algorithms](../README.md)
