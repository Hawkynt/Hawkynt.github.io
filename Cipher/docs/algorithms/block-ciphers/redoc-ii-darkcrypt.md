# REDOC II (DarkCrypt)

> The genuine REDOC II cipher (Michael Wood, 1985) as implemented in the DarkCrypt Total Commander plugin: 80-bit blocks, 160-bit keys, 10 rounds of key- and data-dependent permutations, substitutions and enclave operations.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Michael Wood (Cryptech Inc); DarkCrypt port by Alexander Myasnikov |
| Year | 1985 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-redoc2.js`](../../../algorithms/block/darkcrypt-redoc2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) |
| Block sizes | 10 bytes (80 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Differential cryptanalysis | Biham and Shamir demonstrated a differential attack recovering masks for reduced-round REDOC II; the full cipher is unanalyzed by modern standards. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Cusick, Wood - "The REDOC II Cryptosystem", CRYPTO '90](https://link.springer.com/chapter/10.1007/3-540-38424-3_38)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Redoc2 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000` |
| `input` | `00000000000000000000` |
| `expected` | `b9b2dc11796e8df016ff` |

**Vector 2** — [DarkCrypt Redoc2 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f10111213` |
| `input` | `00010203040506070809` |
| `expected` | `7db36c42fdaf58a43778` |

**Vector 3** — [DarkCrypt Redoc2 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f1011121314` |
| `input` | `10111213141516171819` |
| `expected` | `66a4676a026633d2842d` |

---

[← All algorithms](../README.md)
