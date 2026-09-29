# RC4-drop[65536] (DarkCrypt)

> Standard RC4 KSA/PRGA with a fixed 1024-bit (128-byte) key, discarding the first 65536 generated keystream bytes before output. As implemented in the DarkCrypt Total Commander plugin (readme entry "RC4-drop[65536] (1024 bit)").

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Beginner |
| Inventor | Ron Rivest (RC4); DarkCrypt build by Alexander Myasnikov |
| Year | 1987 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-rc4drop.js`](../../../algorithms/stream/darkcrypt-rc4drop.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 128 bytes (1024 bits) |
| Nonce sizes | 0 bytes (0 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Statistical Biases | Dropping the first 65536 bytes mitigates but does not eliminate known RC4 keystream biases | DO NOT USE - Use ChaCha20 or AES-GCM instead |

## Documentation

- [RFC 6229: Test Vectors for RC4](https://tools.ietf.org/html/rfc6229)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Rc4drop — incrementing 128-byte key, 128-byte zero keystream after drop](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `d4bb07e3632f1774c816557a74378899 c56bbd2cb76ddd7034c2a15112648524 66314c6b086c59efc926c365d5a778c8 205c27e38386fd45c79cf68ea75681c6 fc8dd9d55726703aa314f76f9c91ba58 3d0875c0fbc7f29c10555aa5b8d312e1 9ba17baf096aa0f982d578774222bbe5 dd363d48454a8f9dce2984ade642e40f` |

**Vector 2** — [DarkCrypt Rc4drop — incrementing 128-byte key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `d4ba05e0672a1173c01f5f71783a8696 d57aaf3fa378cb672cdbbb4a0e799b3b 46106e482c497fc8e10fe94ef98a56e7 106d15d0b7b3cb72ffa5ccb59b6bbff9` |

---

[← All algorithms](../README.md)
