# Curupira-2 (DarkCrypt)

> Curupira-2 block cipher (Simplicio, Barreto, Carvalho, Margi, Naslund, 2007) as implemented in the DarkCrypt Total Commander plugin: shares Curupira-1's involutional round function (S-box, row permutation, GF(2^8) MDS diffusion, key XOR) over a 3x4 byte state, but replaces the key schedule with a GF(2^(48t)) Galois-LFSR-style evolution. 96-bit block, 96/144/192-bit key. Only the 192-bit key path was vector-validated against the DarkCrypt implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Marcos A. Simplicio Jr., Paulo S. L. M. Barreto, Tereza C. M. B. Carvalho, Cintia B. Margi, Mats Naslund (base cipher); DarkCrypt port by Alexander Myasnikov |
| Year | 2007 |
| Origin | 🇧🇷 Brazil |
| Source | [`algorithms/block/darkcrypt-curupira2.js`](../../../algorithms/block/darkcrypt-curupira2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 12 bytes (96 bits) to 24 bytes (192 bits) in steps of 6 bytes |
| Block sizes | 12 bytes (96 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unanalyzed variant | Round count and key-schedule details calibrated against a single DarkCrypt build rather than the original academic specification; not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [The Curupira-2 Block Cipher for Constrained Platforms: Specification and Benchmarking](https://ceur-ws.org/Vol-397/paper8.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Curupira2 — zero key/plaintext (192-bit key)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `000000000000000000000000` |
| `expected` | `d97d2c29506cb633b5aa2a43` |

**Vector 2** — [DarkCrypt Curupira2 — incrementing key/plaintext (192-bit key)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `000102030405060708090a0b` |
| `expected` | `77ba02249f52ad21bed4794f` |

**Vector 3** — [DarkCrypt Curupira2 — shifted incrementing key/plaintext (192-bit key)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718` |
| `input` | `101112131415161718191a1b` |
| `expected` | `dcc0d63e13095c6187a165e3` |

---

[← All algorithms](../README.md)
