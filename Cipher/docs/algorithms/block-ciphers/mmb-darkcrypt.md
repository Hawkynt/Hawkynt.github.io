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

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MMB from published specification, zero key/plaintext (spec-derived, not a published KAT)](https://link.springer.com/chapter/10.1007/978-3-642-05445-7_15)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `cc5469e1985fa4e66fe523c35bbfdb88` |

**Vector 2** — [MMB from published specification, incrementing key/plaintext (spec-derived, not a published KAT)](https://link.springer.com/chapter/10.1007/978-3-642-05445-7_15)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `afd4006bd8a0b7ab8d66b73c2d930c13` |

**Vector 3** — [MMB from published specification, shifted incrementing key/plaintext (spec-derived, not a published KAT)](https://link.springer.com/chapter/10.1007/978-3-642-05445-7_15)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `99429481d771c67317b14514b804184b` |

---

[← All algorithms](../README.md)
