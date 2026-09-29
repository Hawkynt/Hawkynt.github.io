# CIPHERUNICORN-A (DarkCrypt)

> CIPHERUNICORN-A block cipher (NEC Corporation, 2000, CRYPTREC-evaluated), 256-bit key variant, as implemented in the DarkCrypt Total Commander plugin. 16-round Feistel network with a dual main-stream/temporary-key-generation round function.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | NEC Corporation; DarkCrypt port by Alexander Myasnikov |
| Year | 2000 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/block/darkcrypt-unicorn-a.js`](../../../algorithms/block/darkcrypt-unicorn-a.js) |

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
| Known key-schedule weakness | Published cryptanalysis identifies key-schedule-related key equivalences; not relevant to functional correctness here. | Use AES or another vetted, actively maintained cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [CIPHERUNICORN-A specification (CRYPTREC / NEC Corporation)](https://www.cryptrec.go.jp/en/cryptrec_03_spec_cypherlist_files/PDF/07_02espec.pdf)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Unicorn-a — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `350518d17ee209c39280abd6da976069` |

**Vector 2** — [DarkCrypt Unicorn-a — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `c6b097ac88291b7d9e3a0b081cadb1f0` |

**Vector 3** — [DarkCrypt Unicorn-a — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `051bb0914cdcfd4b7c7cc5d9ba9c2330` |

---

[← All algorithms](../README.md)
