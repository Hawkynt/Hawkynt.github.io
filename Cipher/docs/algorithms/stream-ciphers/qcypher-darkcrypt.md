# QCypher (DarkCrypt)

> Autokey byte-feedback stream cipher from the DarkCrypt Total Commander plugin. A 256-entry table plus three running indices are updated on every byte using an S-box-driven transform in which the plaintext byte itself indexes the table, so encryption is not a plain independent-keystream XOR.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-qcypher.js`](../../../algorithms/stream/darkcrypt-qcypher.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard, unanalyzed construction | Ad-hoc autokey S-box transform with no public design rationale or cryptanalysis; not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Qcypher — keystream from incrementing key, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `bfc942b0682ded41418464d6357e8dba 86af59fb971424fcd25b5827fe74dd43 7d12caa54d09e4d0c2a3d4db2b16f6c1 fece08767dcbe78442036d83b7d3acb9 2b57e4543371e0caca4810784571a8fe 7599cbaffe3c7e3e1a7810d3bd5a2330 972af0bda7ab74edb6e12b6a81557704 c01d8af10a9cf6cde1c016f5313e78ef` |

**Vector 2** — [DarkCrypt Qcypher — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `bf3502c4af056921ca34a9b99e94c4eb 3872e9bf05d36fcc8d04bd78800e9b81 7d2984e03ba9c5f58f022631ef4111dd bd859b5fa4673acc7f9b7a6ebb0e589e` |

**Vector 3** — [DarkCrypt Qcypher — all-zero key, zero plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `f234bc5b14597fb310906d97aff87900` |

---

[← All algorithms](../README.md)
