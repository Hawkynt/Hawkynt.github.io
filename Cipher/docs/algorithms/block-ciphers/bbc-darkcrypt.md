# BBC (DarkCrypt)

> BBC keystream/permutation cipher from the DarkCrypt Total Commander plugin. Exposed through the block interface with a 256 KiB block, but internally three additive lagged-Fibonacci generators (seeded from 3 key bytes) build sixteen key-dependent S-boxes for two chained substitution passes plus a full-block involution shuffle.

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
| Source | [`algorithms/block/darkcrypt-bbc.js`](../../../algorithms/block/darkcrypt-bbc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 12 bytes (96 bits) |
| Block sizes | 262144 bytes (2097152 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Tiny effective key | Only the first 3 of the 12 key bytes influence the output, giving at most a 24-bit effective key space that is trivially brute-forced. | Do not use for confidentiality; use AES or another vetted cipher. |
| Non-standard construction | Ad-hoc lagged-Fibonacci keystream with key-derived S-boxes; unanalyzed and not recommended for real use. | Use a vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Bbc — zero key, all-zero 256 KiB plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (262144 bytes; the full value is in the source) |
| `expected` | `0dc1a6bce4a38eb7f824a3af534d5916 5fce0f92df67ac6ebfff147190ef38d1 40e9906aedc24aaa2fbdeb06dc040bf1 35d8dc38ba4772c512ed60780fddfb53 …` (262144 bytes; the full value is in the source) |

**Vector 2** — [DarkCrypt Bbc — incrementing key, counting-pattern 256 KiB plaintext (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (262144 bytes; the full value is in the source) |
| `expected` | `5f83b36e1d7565b7a552c55d715a6aec 4089908fa2bf9ff541ec3cefad664935 b63e9764776107d5a703df117bd078fe 241df11854881c85885a877ab5910347 …` (262144 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
