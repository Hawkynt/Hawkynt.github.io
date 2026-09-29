# MD4-512 (DarkCrypt)

> MD4-512 as implemented in the DarkCrypt Total Commander plugin: the standard MD4 compression function used as an unkeyed-IV, non-feedback block permutation, with the 512-bit key supplying the message schedule directly. 128-bit block, 512-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Alexander Myasnikov (DarkCrypt plugin) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-md4.js`](../../../algorithms/block/darkcrypt-md4.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [RFC 1320: The MD4 Message-Digest Algorithm](https://www.ietf.org/rfc/rfc1320.txt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt MD4-512 - all-zero key and plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `3648c833d15291c1dfd962e7bd2700a2` |

**Vector 2** — [DarkCrypt MD4-512 - incrementing key and plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `23ee5ffec80aaacca3a67d2eb23ade94` |

**Vector 3** — [DarkCrypt MD4-512 - shifted incrementing key and plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `b41ec8731d7562c1bfb558a06022d20a` |

---

[← All algorithms](../README.md)
