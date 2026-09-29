# SHARK-E (DarkCrypt)

> SHARK-E variant from the DarkCrypt Total Commander plugin: structurally the classic SHARK cipher (5 C-box rounds + S-box-only final round, 64-bit block, 128-bit key) with a plain CFB round-key schedule (no rejection sampling) and blocks processed byte-reversed relative to the Crypto++ reference.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Vincent Rijmen, Joan Daemen, Bart Preneel, Anton Bosselaers, Erik De Win (base SHARK); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-shark-e.js`](../../../algorithms/block/darkcrypt-shark-e.js) |

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
| Non-standard key schedule | Custom CFB-style key schedule with no published analysis; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [SHARK (base algorithm)](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/shark.zip)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Sharke — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `0a4216774ecf4b21` |

**Vector 2** — [DarkCrypt Sharke — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `cc87f651b3b69721` |

**Vector 3** — [DarkCrypt Sharke — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `cd4bc46cab812950` |

---

[← All algorithms](../README.md)
