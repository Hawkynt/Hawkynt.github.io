# NOEKEON

> NESSIE 128-bit block cipher designed by Joan Daemen, Michaël Peeters, Gilles Van Assche and Vincent Rijmen. Direct Key Mode implementation for efficiency.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Joan Daemen, Michaël Peeters, Gilles Van Assche, Vincent Rijmen |
| Year | 2000 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/block/noekeon.js`](../../../algorithms/block/noekeon.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NOEKEON Specification](https://gro.noekeon.org/)
- [NESSIE Project](https://www.cosic.esat.kuleuven.be/nessie/)

## References

- [Original NOEKEON Paper](https://gro.noekeon.org/Noekeon-spec.pdf)
- [NESSIE Final Report](https://www.cosic.esat.kuleuven.be/nessie/)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Noekeon-direct vector 1/zero](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `b1656851699e29fa24b70148503d2dfc` |

**Vector 2** — [DarkCrypt Noekeon-direct vector 2/incr](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `22c082f55d7f6d861b11c36911be694f` |

**Vector 3** — [DarkCrypt Noekeon-direct vector 3/incr2](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `430da53ef5a353427d3b42f75880f41e` |

**Vector 4** — [Official NoekeonTestVectors.txt - Direct-Key Mode, all-zero key and block](https://gro.noekeon.org/Noekeon_ref.zip)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `b1656851699e29fa24b70148503d2dfc` |

**Vector 5** — [Official NoekeonTestVectors.txt - Direct-Key Mode, all-ones key and block](https://gro.noekeon.org/Noekeon_ref.zip)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `input` | `ffffffffffffffffffffffffffffffff` |
| `expected` | `2a78421b87c7d0924f26113f1d1349b2` |

**Vector 6** — [Official NoekeonTestVectors.txt - Direct-Key Mode, chained third vector](https://gro.noekeon.org/Noekeon_ref.zip)

| Field | Value |
| --- | --- |
| `key` | `b1656851699e29fa24b70148503d2dfc` |
| `input` | `2a78421b87c7d0924f26113f1d1349b2` |
| `expected` | `e2f687e07b75660ffc372233bc47532c` |

---

[← All algorithms](../README.md)
