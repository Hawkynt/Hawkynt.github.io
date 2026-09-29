# Diamond2-2048 (DarkCrypt)

> Diamond2 substitution-permutation cipher from the DarkCrypt Total Commander plugin. 128-bit block, 2048-bit key, 12 rounds. In this DarkCrypt build the key schedule collapses: every S-box reduces to the byte complement (0xFF - v), so the transform is key-independent - accepted keys are ignored.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Michael Paul Johnson (Diamond2); DarkCrypt build by Alexander Myasnikov |
| Year | 1995 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-diamond2.js`](../../../algorithms/block/darkcrypt-diamond2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 256 bytes (2048 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Degenerate key schedule | In this DarkCrypt build the CRC-based S-box generator collapses to fixed byte-complement boxes, so the cipher is entirely key-independent - identical plaintext always yields identical ciphertext regardless of key. | Do not use; treat as a fixed, keyless byte-shuffling transform. Use AES or another vetted cipher. |
| Linear-ish structure | Substitution reduces to complement and the permutation is a bit transposition; the whole transform is trivially invertible without the key. | Educational use only. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Diamond2 / Diamond2 encryption (Michael Paul Johnson)](https://web.archive.org/web/19970607052759/http://www.mpj.com/mpj.htm)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Diamond — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `01000000000000000000000000000000` |

**Vector 2** — [DarkCrypt Diamond — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `070500030201040f0e0d080b0a090c07` |

**Vector 3** — [DarkCrypt Diamond — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40 4142434445464748494a4b4c4d4e4f50 5152535455565758595a5b5c5d5e5f60 6162636465666768696a6b6c6d6e6f70 7172737475767778797a7b7c7d7e7f80 8182838485868788898a8b8c8d8e8f90 9192939495969798999a9b9c9d9e9fa0 a1a2a3a4a5a6a7a8a9aaabacadaeafb0 b1b2b3b4b5b6b7b8b9babbbcbdbebfc0 c1c2c3c4c5c6c7c8c9cacbcccdcecfd0 d1d2d3d4d5d6d7d8d9dadbdcdddedfe0 e1e2e3e4e5e6e7e8e9eaebecedeeeff0 f1f2f3f4f5f6f7f8f9fafbfcfdfeff00` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `171510131211141f1e1d181b1a191c17` |

---

[← All algorithms](../README.md)
