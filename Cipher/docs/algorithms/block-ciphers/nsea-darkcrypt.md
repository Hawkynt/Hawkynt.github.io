# NSEA (DarkCrypt)

> Nonpatented Simple Encryption Algorithm by Peter Gutmann (1992) as implemented in the DarkCrypt Total Commander plugin: 128-bit block, 288-bit key, two-round key-dependent S-box Feistel-like network. DarkCrypt uses only 32 of the 36 key bytes as key material, with the last 4 bytes as an S-box permutation salt.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Peter Gutmann; DarkCrypt port by Alexander Myasnikov |
| Year | 1992 |
| Origin | 🌐 International |
| Source | [`algorithms/block/darkcrypt-nsea.js`](../../../algorithms/block/darkcrypt-nsea.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 36 bytes (288 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unanalyzed key setup truncation | The DarkCrypt port silently discards 4 of the 36 key bytes (used only as an S-box permutation salt) rather than mixing all key material into the schedule; not independently cryptanalyzed. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [NSEA.C, Peter Gutmann's public-domain reference implementation](https://github.com/ab300819/applied-cryptography/blob/master/NSEA/NSEA.C)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Nsea — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `9d6833213a0ba3b4d42f2f6147997c3f` |

**Vector 2** — [DarkCrypt Nsea — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 20212223` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `77408d242bb7b14433700eb68b0e94a4` |

**Vector 3** — [DarkCrypt Nsea — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 21222324` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `723203dcc20ed097448a4e3382a33d90` |

---

[← All algorithms](../README.md)
