# IDEA (DarkCrypt)

> Standard International Data Encryption Algorithm (Lai/Massey) as implemented in the DarkCrypt Total Commander plugin: textbook 8.5-round Lai-Massey structure, big-endian 16-bit words. 64-bit block, 128-bit key. Validated against the DarkCrypt implementation and the classic published IDEA test vector.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Xuejia Lai, James L. Massey |
| Year | 1991 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/block/darkcrypt-idea.js`](../../../algorithms/block/darkcrypt-idea.js) |

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
| Weak keys | IDEA has a small class of weak keys detectable in known-plaintext scenarios. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [IDEA (base algorithm)](https://en.wikipedia.org/wiki/International_Data_Encryption_Algorithm)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Published IDEA known-answer test (Botan idea.vec, first vector)](https://github.com/randombit/botan/blob/master/src/tests/data/block/idea.vec)

| Field | Value |
| --- | --- |
| `key` | `ed1bcc9e9267925f3132ba3a8cf9b764` |
| `input` | `7409000000000000` |
| `expected` | `e18315c171b83765` |

**Vector 2** — [DarkCrypt Idea — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `0001000100000000` |

**Vector 3** — [DarkCrypt Idea — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `864c9d7d208a0e65` |

**Vector 4** — [DarkCrypt Idea — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `f9698f89bb4969fe` |

---

[← All algorithms](../README.md)
