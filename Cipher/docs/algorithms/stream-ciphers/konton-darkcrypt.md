# Konton (DarkCrypt)

> 512-bit-key table-driven ARX stream cipher from the DarkCrypt Total Commander plugin. A 32-word table is derived from the key, then walked once per keystream step with data-dependent rotations and an additive accumulator carrying self-synchronizing plaintext feedback.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov ("Zarya" project) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-konton.js`](../../../algorithms/stream/darkcrypt-konton.js) |

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
| Unanalyzed construction | Custom, unpublished ARX stream cipher with no public cryptanalysis; not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Konton — keystream from incrementing key, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `ed614f35b2ddde567d95866172815adf ba2f3570e61050217724813effb578a2 3c29ce5c8359c7f649882b5eedfd3369 4fc0423bffb930c4b04484789eb203b3 cd98b3492d3691d8805ddc0251bac134 e1e72e98b3037aab296b8be130f1204d 542073d0b80d43bafadefc6e150159e9 663ed853cbf0b5e300a08ca480cc8ac7` |

**Vector 2** — [DarkCrypt Konton — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `ed604be3f76e28959ef8361a20fcbbe0 ecc3d436c600f2c070620c1035ed15e2 6f6c4ff21a3cfd5b6039e5afa6f76fce 47557730b5a8298395fe083915e8000b` |

---

[← All algorithms](../README.md)
