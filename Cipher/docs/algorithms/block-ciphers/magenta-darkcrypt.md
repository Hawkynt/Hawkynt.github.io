# MAGENTA (DarkCrypt)

> MAGENTA block cipher as implemented in the DarkCrypt Total Commander plugin: 8-round unbalanced Feistel network with palindromic subkey schedule K1-K2-K3-K4-K4-K3-K2-K1, always operating on a 256-bit key. 128-bit block.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Michael Jacobson Jr., Klaus Huber (base MAGENTA); DarkCrypt build by Alexander Myasnikov |
| Year | 1998 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-magenta.js`](../../../algorithms/block/darkcrypt-magenta.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Structural weakness | MAGENTA has well-documented structural weaknesses (Biham et al.) allowing key-recovery attacks far faster than brute force; not recommended for any real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [MAGENTA AES Submission](https://csrc.nist.gov/archive/aes/round1/conf1/papers/jacobson.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST AES round-1 MAGENTA KAT ecb_vk.txt, KEYSIZE=256, I=1](https://web.archive.org/web/20070109105056if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/magenta-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `8000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `9a199e39c2df1f1c17cea243f8e5147e` |

**Vector 2** — [DarkCrypt Magenta — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `f0f66c085c77ca9433c95e0300c71891` |

**Vector 3** — [DarkCrypt Magenta — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `11345de72c2e1159bd4b80712c7b6a65` |

**Vector 4** — [DarkCrypt Magenta — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `c476434c32b0768576a291359fe766cd` |

---

[← All algorithms](../README.md)
