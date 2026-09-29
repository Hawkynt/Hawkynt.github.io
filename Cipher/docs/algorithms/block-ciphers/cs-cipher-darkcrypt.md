# CS-Cipher (DarkCrypt)

> CS-Cipher as implemented in the DarkCrypt Total Commander plugin: 64-bit block, 128-bit key, 12 elementary rounds. Matches the published Stern/Vaudenay S-box and e-digit round constants.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Jacques Stern, Serge Vaudenay (base CS-Cipher); DarkCrypt variant by Alexander Myasnikov |
| Year | 1998 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/block/darkcrypt-cscipher.js`](../../../algorithms/block/darkcrypt-cscipher.js) |

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
| Not selected for NESSIE | Submitted to the NESSIE project but not selected; later cryptanalysis found weaknesses in reduced-round variants. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [CS-Cipher (Stern, Vaudenay, FSE 1998)](https://link.springer.com/chapter/10.1007/3-540-69710-1_13)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NESSIE submission test vectors for CS-Cipher, 128-bit key, set 1 vector 0](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/cs-cipher.zip)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `b3ceaa7e54954091` |

**Vector 2** — [DarkCrypt Cscipher — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `e7557c23ea2074bb` |

**Vector 3** — [DarkCrypt Cscipher — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `0001020304050607` |
| `expected` | `434a4eaec4abf667` |

**Vector 4** — [DarkCrypt Cscipher — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `1011121314151617` |
| `expected` | `3b99b12ffcb158e4` |

---

[← All algorithms](../README.md)
