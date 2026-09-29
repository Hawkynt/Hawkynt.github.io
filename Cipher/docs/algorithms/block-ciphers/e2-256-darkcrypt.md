# E2-256 (DarkCrypt)

> Standard NTT E2 block cipher (256-bit key variant), a 12-round Feistel cipher with initial/final modular-multiplication transforms and an s-box/P-function round structure, submitted to the AES competition in 1998. The DarkCrypt Total Commander plugin implements this unmodified (matches NTT's own published test vector).

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Masayuki Kanda, Shiho Moriai, Kazumaro Aoki, Hiroki Ueda, Youichi Takashima, Kazuo Ohta, Tsutomu Matsumoto (NTT) |
| Year | 1998 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/darkcrypt-e2.js`](../../../algorithms/block/darkcrypt-e2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not selected for AES | E2 was a first-round AES candidate not advanced past round 1; while not broken, it received far less cryptanalytic scrutiny than AES/Rijndael. | Use AES or another vetted, standardized cipher. |

## Documentation

- [Specification of E2 - a 128-bit Block Cipher (NTT, 1998)](https://web.archive.org/web/20050131035056/http://info.isl.ntt.co.jp:80/e2/E2spec.pdf)
- [E2 (cipher) - Wikipedia](https://en.wikipedia.org/wiki/E2_(cipher))
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST AES round-1 E2 KAT ecb_vk.txt, KEYSIZE=256, I=1](https://web.archive.org/web/20070109110059if_/http://csrc.nist.gov/CryptoToolkit/aes/round1/testvals/e2-vals.zip)

| Field | Value |
| --- | --- |
| `key` | `8000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `1afeb356ae10f7bb2c3221223fb6bd8a` |

**Vector 2** — [DarkCrypt E2 — zero key/plaintext (matches NTT spec Appendix A, Case 3)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `5002cb8cd878f26fbab9f52e6c96501e` |

**Vector 3** — [DarkCrypt E2 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `dff330c9ebbd520262ee310b1feed4dd` |

**Vector 4** — [DarkCrypt E2 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `8ac3a298e0dd7e5e4d5a858c0a213e10` |

---

[← All algorithms](../README.md)
