# Lja1 (DarkCrypt)

> Byte-oriented block cipher from the DarkCrypt Total Commander plugin. The 256-byte key becomes a substitution table; 16 cycles rewrite each of the 16 block bytes by folding a nonlinear accumulator over the other 15 bytes and XORing in a running counter. 128-bit block, 2048-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Alexander Myasnikov (DarkCrypt / Zarya) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-lja1.js`](../../../algorithms/block/darkcrypt-lja1.js) |

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
| Low-entropy keys degenerate toward the identity | The 256-byte key is used verbatim as the substitution table, so what the cipher can do is bounded by how many distinct byte values the key contains. All 256 constant-byte keys make the cipher the exact identity, and keys built from only a few distinct values fall in with them: measured over 300 keys each, the all-zero block was returned unencrypted for 169 of 300 keys over 2 distinct byte values, 107 of 300 over 4, 51 of 300 over 8 and 8 of 300 over 16. A key derived from a short passphrase is in that range. | Only ever supply 256 bytes of full-entropy key material; prefer a vetted cipher such as AES. |
| Non-standard hobbyist design | Unanalyzed proprietary construction with a purely XOR-based per-byte update; not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Lja1 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `ee0fd0b112737435b65778b9da8bb469` |

**Vector 2** — [DarkCrypt Lja1 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40 4142434445464748494a4b4c4d4e4f50 5152535455565758595a5b5c5d5e5f60 6162636465666768696a6b6c6d6e6f70 7172737475767778797a7b7c7d7e7f80 8182838485868788898a8b8c8d8e8f90 9192939495969798999a9b9c9d9e9fa0 a1a2a3a4a5a6a7a8a9aaabacadaeafb0 b1b2b3b4b5b6b7b8b9babbbcbdbebfc0 c1c2c3c4c5c6c7c8c9cacbcccdcecfd0 d1d2d3d4d5d6d7d8d9dadbdcdddedfe0 e1e2e3e4e5e6e7e8e9eaebecedeeeff0 f1f2f3f4f5f6f7f8f9fafbfcfdfeff00` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `fe5fc0c1e243048546e748c95ab38067` |

**Vector 3** — [DarkCrypt Lja1 — incrementing key, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `79a5f935c1dd81dd89d5e995914d914f` |

**Vector 4** — [DarkCrypt Lja1 — incrementing key, all-ones plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `90905070d05090d05090d0a0f8d49201` |

**Vector 5** — [DarkCrypt Lja1 — all-zero key is the identity, shown on a non-zero block](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `000102030405060708090a0b0c0d0e0f` |

**Vector 6** — [DarkCrypt Lja1 — all-0xFF key is likewise the identity](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff` |
| `input` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |
| `expected` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |

---

[← All algorithms](../README.md)
