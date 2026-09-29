# Sinople (DarkCrypt)

> 128-bit block, 128-bit key cipher from the DarkCrypt Total Commander plugin. 4-branch generalized Feistel network, 64 rounds alternating two S-box-based round functions (F, G) in blocks of 16.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov (DarkCrypt "Zarya" project) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-sinople.js`](../../../algorithms/block/darkcrypt-sinople.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unanalyzed proprietary design | Custom cipher bundled with a closed-source plugin; no public cryptanalysis exists. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Sinople — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `af42853eb08e593fe31ac3b2c69c762b` |

**Vector 2** — [DarkCrypt Sinople — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `c98474b5908773ba772b3cece5700eeb` |

**Vector 3** — [DarkCrypt Sinople — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `552ed4407de60e0c9d9f16e18a546f21` |

---

[← All algorithms](../README.md)
