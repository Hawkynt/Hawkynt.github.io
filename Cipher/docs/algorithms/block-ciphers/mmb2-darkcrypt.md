# MMB2 (DarkCrypt)

> MMB2 (revision of Daemen's MMB) as implemented in the DarkCrypt Total Commander plugin: 128-bit block/key, 6 rounds of key mixing plus theta diffusion, plus a final whitening stage. This implementation carries a quirk where the intended modular multiplication step is computed but discarded (a no-op in practice).

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Joan Daemen (base MMB/MMB2 lineage); DarkCrypt variant by Alexander Myasnikov |
| Year | 1997 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-mmb2.js`](../../../algorithms/block/darkcrypt-mmb2.js) |

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
| Multiplication step is a no-op in this implementation | The DarkCrypt implementation computes the intended modular multiplication but discards the result before returning, so this variant provides only key-XOR and linear (theta) diffusion — materially weaker than the intended MMB2 design. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [MMB (Daemen, 1993) — base lineage](https://en.wikipedia.org/wiki/MMB_(cipher))

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Mmb2 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `9a490200ecc3010000000000ecc30100` |

**Vector 2** — [DarkCrypt Mmb2 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `9e4d0604e0cf0d0c04040404e0cf0d0c` |

**Vector 3** — [DarkCrypt Mmb2 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `25f4bd21f1dc1c0b1517151bf1dc1c0b` |

---

[← All algorithms](../README.md)
