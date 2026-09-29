# MD5-Karn (DarkCrypt)

> MD5-Karn as implemented in the DarkCrypt Total Commander plugin: a 3-round unbalanced Feistel-like network over two 128-bit halves, using full standard MD5 compressions (with Davies-Meyer feedback) as the round function. 256-bit block, 768-bit key.

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
| Source | [`algorithms/block/darkcrypt-mdckarn.js`](../../../algorithms/block/darkcrypt-mdckarn.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 96 bytes (768 bits) |
| Block sizes | 32 bytes (256 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [RFC 1321: The MD5 Message-Digest Algorithm](https://www.ietf.org/rfc/rfc1321.txt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt MD5-Karn - all-zero key and plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `452acc3a076ef6fd75da6abbfc31a513d85b25d31090fa2fb34475086902748b` |

**Vector 2** — [DarkCrypt MD5-Karn - incrementing key and plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `0606ccc436fabe0f4bf8c063af689e809ef6381e01659ec52da0972954f94f2c` |

**Vector 3** — [DarkCrypt MD5-Karn - shifted incrementing key and plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40 4142434445464748494a4b4c4d4e4f50 5152535455565758595a5b5c5d5e5f60` |
| `input` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `expected` | `91e968de04795d5eb92b3bcb32cb57550f5dc79886427010fea8633b037feffa` |

---

[← All algorithms](../README.md)
