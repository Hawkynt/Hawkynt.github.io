# 3NewDE (DarkCrypt)

> DarkCrypt Total Commander plugin cipher: 16 rounds of the standard DES Feistel round function (real DES S-boxes/E/P) without the DES initial/final permutation. Declared 192-bit key but only the high nibble of each of the first 16 key bytes (64 bits) is effective; the remaining declared key material has no effect on the output. 64-bit block. As implemented in the DarkCrypt Total Commander plugin.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Alexander Myasnikov (DarkCrypt/"Zarya" project) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-3newde.js`](../../../algorithms/block/darkcrypt-3newde.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 24 bytes (192 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Reduced effective key | The declared 192-bit key collapses to 64 bits of real entropy (only 16 nibbles are used); the round function additionally omits DES's IP/FP. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [DES (base round function/S-boxes)](https://csrc.nist.gov/csrc/media/publications/fips/46/3/archive/1999-10-25/documents/fips46-3.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt 3newde — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `1c2087fcbbea0dc2` |

**Vector 2** — [DarkCrypt 3newde — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f1011121314151617` |
| `input` | `0001020304050607` |
| `expected` | `fe73f3967b3a7d6f` |

**Vector 3** — [DarkCrypt 3newde — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718` |
| `input` | `1011121314151617` |
| `expected` | `b7361e976d0f6e00` |

---

[← All algorithms](../README.md)
