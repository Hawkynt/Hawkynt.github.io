# Mir (DarkCrypt)

> Mir stream cipher from the DarkCrypt Total Commander plugin. Six 64-bit state words mixed with 64-bit modular multiplications, a T-function term and a key-dependent AES-S-box substitution. 128-bit key, 64-bit IV. As implemented in the DarkCrypt Total Commander plugin.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Alexander Myasnikov (DarkCrypt) |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-mir.js`](../../../algorithms/stream/darkcrypt-mir.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Unanalyzed proprietary cipher | Obscure design with no public cryptanalysis; not recommended for real use. | Use a vetted stream cipher such as ChaCha20. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Mir — incrementing plaintext 00..3F](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `e830032e6a759bbb7483a4d2c105ba2e e96d42ccb708815fb8e52d97712b1690 29c0ac178aa654c83dba6651b0967859 7c9e5c51cb2ef0008b85365a8f051142` |

**Vector 2** — [DarkCrypt Mir — zero plaintext (raw keystream)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `e831012d6e709dbc7c8aaed9cd08b421 f97c50dfa31d9748a0fc378c6d36088f 09e18e34ae8372ef15934c7a9cbb5676 4caf6e62ff1bc637b3bc0c61b3382f7d` |

---

[← All algorithms](../README.md)
