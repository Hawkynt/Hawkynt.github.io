# Simplicity (DarkCrypt)

> Undocumented 128-bit block cipher from the DarkCrypt Total Commander plugin: a 12-group substitution-diffusion network over a 256-bit key, built from two fixed 256-byte tables and one fixed 14336-byte seed table, all mixed into per-key BigSbox and CTable schedules via an order-dependent, self-referential two-pass self-encryption process. No public specification is known.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov (DarkCrypt / "Zarya" project) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-simplicity.js`](../../../algorithms/block/darkcrypt-simplicity.js) |

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
| Undocumented/unanalyzed design | No public cryptanalysis exists for this cipher. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Simplicity — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `4aa8a7ff572b388dff666e0880ba0135` |

**Vector 2** — [DarkCrypt Simplicity — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `ee06860f73db54933d7f45f8a1613fba` |

**Vector 3** — [DarkCrypt Simplicity — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `bf48b1145594a258096b5008e83cf856` |

---

[← All algorithms](../README.md)
