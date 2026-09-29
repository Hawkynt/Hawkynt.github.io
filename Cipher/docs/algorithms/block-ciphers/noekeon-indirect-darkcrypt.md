# Noekeon-indirect (DarkCrypt)

> NOEKEON block cipher run in indirect-key mode: the Working Key is derived by running the full 16-round cipher on the Cipher Key with an all-zero round key before the normal rounds run. 128-bit block, 128-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Joan Daemen, Michaël Peeters, Gilles Van Assche, Vincent Rijmen (base NOEKEON); DarkCrypt indirect-mode packaging by Alexander Myasnikov |
| Year | 2000 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-noekeon-indirect.js`](../../../algorithms/block/darkcrypt-noekeon-indirect.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Educational implementation | Non-standard variant packaging of NOEKEON; unanalyzed for this specific mode, not recommended for real use. | Use AES or another vetted, standardized cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [NOEKEON Specification](https://gro.noekeon.org/Noekeon-spec.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NESSIE submission test vectors for NOEKEON in indirect-key mode, set 1 vector 0](https://www.cosic.esat.kuleuven.be/nessie/workshop/submissions/noekeon.zip)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `98fe359a01cd3f66f8d662b746f825d7` |

**Vector 2** — [DarkCrypt Noekeon-indirect — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `ba6933819299c71699a99f08f678178b` |

**Vector 3** — [DarkCrypt Noekeon-indirect — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `6fff9f6ac54c6ea21d72b895f3fd8776` |

**Vector 4** — [DarkCrypt Noekeon-indirect — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `4e2dde0990661763199db6895a6e7332` |

---

[← All algorithms](../README.md)
