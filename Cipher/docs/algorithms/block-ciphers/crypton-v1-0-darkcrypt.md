# Crypton v1.0 (DarkCrypt)

> CRYPTON v1.0 as implemented by the DarkCrypt Total Commander plugin's table-optimized "-OPT" build. Uses its own precomputed mix/substitution tables and key-diffusion constants rather than the NIST IR 6391 reference construction. 128-bit block, fixed 256-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Chae Hoon Lim (CRYPTON v1.0); DarkCrypt "-OPT" table build |
| Year | 1999 |
| Origin | 🇰🇷 South Korea |
| Source | [`algorithms/block/darkcrypt-crypton.js`](../../../algorithms/block/darkcrypt-crypton.js) |

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
| Non-standard variant | Table-optimized DarkCrypt build with its own mix/substitution tables and key-diffusion constants; does not match the published CRYPTON v1.0 reference vectors and is unanalyzed as a distinct construction. | Use AES or another vetted, standardized cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [NIST IR 6391 - CRYPTON Block Cipher](https://nvlpubs.nist.gov/nistpubs/Legacy/IR/nistir6391.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Cryptonv1-256 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `eb195fb347aef6beb7542c635e7421fc` |

**Vector 2** — [DarkCrypt Cryptonv1-256 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `11c5088c50f36307386e6b76bd127c67` |

**Vector 3** — [DarkCrypt Cryptonv1-256 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `6cb522538e44fd52fd3d22970e774091` |

---

[← All algorithms](../README.md)
