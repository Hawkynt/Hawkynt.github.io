# CIPHERUNICORN-E (DarkCrypt)

> NEC's CIPHERUNICORN-E block cipher as implemented in the DarkCrypt Total Commander plugin: 16-round modified Feistel network, 64-bit block, 128-bit key, with a key-dependent linear mixing step between rounds. Matches the ISO/IEC9979-0019 reference structure except for the byte-combination step in the S-box mixing primitive, which the DarkCrypt implementation performs with subtraction instead of the reference's plain XOR.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | NEC Corporation; DarkCrypt implementation by Alexander Myasnikov |
| Year | 1998 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-unicorn-e.js`](../../../algorithms/block/darkcrypt-unicorn-e.js) |

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
| Non-standard variant | The DarkCrypt implementation deviates from the published ISO/IEC9979-0019 reference in the S-box mixing primitive's combination step; unanalyzed as a distinct construction and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [ISO/IEC9979-0019 Register Entry (CIPHERUNICORN-E reference source)](http://www.chrismitchell.net/ISO-register/0019.pdf)
- [CIPHERUNICORN-E (Wikipedia)](https://en.wikipedia.org/wiki/CIPHERUNICORN-E)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Unicorn — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `3eaeb1f9f6963069` |

**Vector 2** — [DarkCrypt Unicorn — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `13d188da49e897f6` |

**Vector 3** — [DarkCrypt Unicorn — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `97a13f60a1481219` |

---

[← All algorithms](../README.md)
