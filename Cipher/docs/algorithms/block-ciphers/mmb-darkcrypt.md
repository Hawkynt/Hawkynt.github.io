# MMB (DarkCrypt)

> MMB (Modular Multiplication-based Block cipher) as implemented in the DarkCrypt Total Commander plugin: 128-bit block/key, 6 rounds combining modular multiplication (mod 2^32-1) with an XOR diffusion layer.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Joan Daemen (base MMB); DarkCrypt variant by Alexander Myasnikov |
| Year | 1993 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-mmb.js`](../../../algorithms/block/darkcrypt-mmb.js) |

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
| Weak-key differential attack | Biham demonstrated a weak-key class and differential attack against MMB shortly after publication. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [MMB (Daemen, 1993)](https://en.wikipedia.org/wiki/MMB_(cipher))

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt MMB — incrementing key/plaintext (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `13d3b3fe7bc02c0dc56dc648a5ae9d32` |

**Vector 2** — [DarkCrypt MMB — shifted incrementing key/plaintext (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `eaf8b8248e6a72f072dbc17e40a95c13` |

**Vector 3** — [DarkCrypt MMB — zero key, single set bit (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000001` |
| `expected` | `1ee0920041dfb7cb05c6fbcd5ba51eec` |

**Vector 4** — [DarkCrypt MMB — random key/plaintext (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `b92c2757b9edb9024541662e8ebf42d1` |
| `input` | `049005731fad4901eb411879d4f5a4ac` |
| `expected` | `916279fa86fa981886f9f4065efcde05` |

---

[← All algorithms](../README.md)
