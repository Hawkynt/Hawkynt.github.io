# PES (DarkCrypt)

> PES (Proposed Encryption Standard, Lai/Massey 1990), the direct historical predecessor of IDEA, as implemented in the DarkCrypt Total Commander plugin. Same Lai-Massey structure and multiplication-mod-65537 arithmetic as IDEA over four 16-bit sub-blocks, but with a simpler bit-rotating round-key derivation lacking IDEA's stronger key mixing. 8 full rounds plus a final half-round.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Xuejia Lai, James L. Massey |
| Year | 1990 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/block/darkcrypt-pes.js`](../../../algorithms/block/darkcrypt-pes.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Weak key schedule | PES's simpler round-key derivation (relative to its IDEA successor) was shown to be cryptanalytically weak, which is precisely why IDEA replaced it. | Use IDEA, AES, or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [IDEA (successor to PES)](https://en.wikipedia.org/wiki/International_Data_Encryption_Algorithm)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Pes — incrementing key, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0000000000000000` |
| `expected` | `e8f608b37a36627a` |

**Vector 2** — [DarkCrypt Pes — incrementing key, incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `722ddbe59d2ad932` |

**Vector 3** — [DarkCrypt Pes — random key/plaintext (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `9171a8c51545e90a32f8680f716e4cc7` |
| `input` | `fc0d3cc6a6b8e6aa` |
| `expected` | `5d8831507b5ba3b7` |

---

[← All algorithms](../README.md)
