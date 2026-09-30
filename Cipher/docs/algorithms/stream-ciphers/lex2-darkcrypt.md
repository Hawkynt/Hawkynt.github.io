# LEX2 (DarkCrypt)

> AES-128-based keystream leak-extraction stream cipher from the DarkCrypt Total Commander plugin, related to Alex Biryukov's eSTREAM candidate LEX. Every round of a 10-round AES-like permutation (with MixColumns applied even in round 10, unlike textbook AES) leaks 4 bytes formed by interleaving two of the round's output words; the round function's own output becomes the next state.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Alex Biryukov (LEX design); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-lex2.js`](../../../algorithms/stream/darkcrypt-lex2.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard, unanalyzed variant | Leaks bytes from an all-MixColumns 10-round AES-like permutation using a DarkCrypt-specific interleave rule, not the original LEX construction; unanalyzed and not recommended for real use. | Use a vetted stream cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Biryukov, "A New 128-bit Key Stream Cipher LEX" (eSTREAM submission)](https://www.ecrypt.eu.org/stream/lex.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Lex — keystream from incrementing key, zero IV, zero input](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `d26a438ab2f4a578214c98cd71d1b691 02228f79d01e689cd448b77b408a343e f3b095c51e2eba96efddd22162526a77 f1736dfdbd7d1656e67902a734adf76c 97cb739967800db31181f0c20885ea05 eae040e7d9c579745ffea0dbb5c10d34 8c67336cc691cfb0c37bfded8b14402f 377f8d91ed353c817c537b519303dbbb` |

**Vector 2** — [DarkCrypt Lex — incrementing key, zero IV, incrementing plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `d26b4189b6f1a37f294592c67ddcb89e 12339d6ac40b7e8bcc51ad605c972a21 d391b7e63a0b9cb1c7f4f80a4e7f4458 c1425fce89482061de40389c0890c953` |

**Vector 3** — [DarkCrypt Lex — non-zero key and IV, 48-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0b30557a9fc4e90e33587da2c7ec1136` |
| `iv` | `073c71a6db10457aafe4194e83b8ed22` |
| `input` | `03203d5a7794b1ceeb0825425f7c99b6 d3f00d2a4764819ebbd8f5122f4c6986 a3c0ddfa1734516e8ba8c5e2ff1c3956` |
| `expected` | `e83589883910ea1b5b93415b9d3d50bf 5649590240763c482d21093d931ea6ab fb327c2194061391d3a6cf73003a8780` |

---

[← All algorithms](../README.md)
