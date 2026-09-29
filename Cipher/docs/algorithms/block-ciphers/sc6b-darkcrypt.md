# SC6B (DarkCrypt)

> Non-standard 128-bit block cipher from the DarkCrypt Total Commander plugin. 320-bit key expanded by a nonlinear feedback shift register into round constants and whitening words; 8 rounds of a keyed multiply/rotate mixing function wrapped by nonlinear multiplexer substitution layers.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Alexander Myasnikov (DarkCrypt/Zarya project) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-sc6b.js`](../../../algorithms/block/darkcrypt-sc6b.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 40 bytes (320 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard, unanalyzed design | Ad-hoc NLFSR key schedule and bespoke round function with no public cryptanalysis or security proof. | Use AES or another vetted cipher for real applications. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Sc6b — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 0000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `30f26746fb9474a5d5baa162df6dd787` |

**Vector 2** — [DarkCrypt Sc6b — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 2021222324252627` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `dd134a99433c5d912d6ce2e860703b42` |

**Vector 3** — [DarkCrypt Sc6b — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `0dadbc81e665001ffc24bf83e79e7b33` |

---

[← All algorithms](../README.md)
