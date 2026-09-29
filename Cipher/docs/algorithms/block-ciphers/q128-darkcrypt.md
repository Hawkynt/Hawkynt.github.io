# Q128 (DarkCrypt)

> Q128, an obscure 128-bit block cipher bundled with the DarkCrypt Total Commander plugin. No public specification is known. 16-round Feistel-like network over four 32-bit words using a 1024-entry lookup table and 10-bit rotations.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Unknown (DarkCrypt/Zarya project, attributed to Alexander Myasnikov) |
| Year | 2010 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-q128.js`](../../../algorithms/block/darkcrypt-q128.js) |

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
| Unanalyzed proprietary design | No public cryptanalysis exists for this cipher; origin and security rationale are undocumented. | Use AES or another vetted, publicly analyzed cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Q128 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `062b7499f141d7880fb43ea4d36f4156` |

**Vector 2** — [DarkCrypt Q128 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `9f42f61c9744ad7c408564c1ffa24a89` |

**Vector 3** — [DarkCrypt Q128 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `9664169f7049a446552416636eef877e` |

---

[← All algorithms](../README.md)
