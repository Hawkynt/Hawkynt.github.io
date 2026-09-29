# SC2000 (DarkCrypt)

> SC2000 variant from the DarkCrypt Total Commander plugin: always runs 6.5 rounds (56 round-key words) regardless of key size, whereas the published CRYPTREC/NESSIE spec calls for 7.5 rounds with 256-bit keys. 128-bit block, 256-bit key only.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Takeshi Shimoyama, Hirotaka Yanami, et al. (Fujitsu Labs, base algorithm); DarkCrypt variant by Alexander Myasnikov |
| Year | 2000 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-sc2000.js`](../../../algorithms/block/darkcrypt-sc2000.js) |

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
| Non-standard variant / round-count deviation | Always runs 6.5 rounds with a 256-bit key (spec calls for 7.5); unanalyzed at this round count and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [The Block Cipher SC2000 (FSE 2001, base algorithm)](https://link.springer.com/chapter/10.1007/3-540-45473-X_26)

## References

- [Security Analysis of the Block Cipher SC2000 (CRYPTREC)](https://www.cryptrec.go.jp/exreport/cryptrec-ex-2202-2012p3.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Sc2000 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `a3bae4fac0c472bba5a4b96032abb2c4` |

**Vector 2** — [DarkCrypt Sc2000 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `8d53448d8ec85ce6eae7e9092035b267` |

**Vector 3** — [DarkCrypt Sc2000 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `f9bccd4158dfae69184d14098d7bb939` |

---

[← All algorithms](../README.md)
