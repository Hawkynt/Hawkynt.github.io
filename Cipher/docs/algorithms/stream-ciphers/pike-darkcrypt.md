# Pike (DarkCrypt)

> Lagged-Fibonacci stream cipher with three add-with-carry registers of lengths 55, 57 and 58 words; each step, registers whose carry bit matches the majority of all three clock and output the sum of two lag-separated words, and the three outputs are XORed into one keystream word. From the DarkCrypt Total Commander plugin build.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Ross Anderson |
| Year | 1994 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/stream/darkcrypt-pike.js`](../../../algorithms/stream/darkcrypt-pike.js) |

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
| Unanalyzed construction | Lagged-Fibonacci design with weaker public cryptanalysis than mainstream stream ciphers of similar age; not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [FISH and Pike stream ciphers (background and history)](https://en.wikipedia.org/wiki/FISH_(cipher))

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Pike - 64-byte key keystream](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `35d6782712939f32ec285eb4bb2d69ca 9b40f741c877ada8dcc7f3621c46f25c 41ff7dae6fee4983a225f7007beb26fd 038138499fbef54e310d899ccbe82193 f1cba7645c56cf82fc582a3527662d08 5d269059929eb783f1953d7dad93ad70 3e77943c37cb50be8a4aeb3cfacb3365 c10e4f6ffe45b7d9ef09aaf4b45ab7da` |

**Vector 2** — [DarkCrypt Pike - incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `35d77a2416969935e42154bfb72067c5 8b51e552dc62bbbfc4dee979005bec43 61de5f8d4bcb6fa48a0cdd2b57c608d2 33b00a7aab8bc3790934b3a7f7d51fac` |

---

[← All algorithms](../README.md)
