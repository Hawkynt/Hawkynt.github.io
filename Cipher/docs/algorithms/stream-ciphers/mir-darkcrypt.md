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

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

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

**Vector 3** — [DarkCrypt Mir — non-zero key and IV, 64-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136` |
| `iv` | `073c71a6db10457a` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956 7390adcae704213e5b7895b2cfec0926` |
| `expected` | `58296e532629cee10d4b22d0fc8d128a 7acf2737aa101af6b8e0a117c0a9de1c 178e23af20880990375d8f559de7874c ff32dcacd493b2cb875f146dc681579d` |

---

[← All algorithms](../README.md)
