# Grain-128

> Hardware-oriented stream cipher using LFSR and NFSR designed for restricted hardware environments. Selected for eSTREAM Portfolio Profile 2. Uses 128-bit keys, 96-bit IVs, and 256-bit total state.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | Martin Hell, Thomas Johansson, and Willi Meier |
| Year | 2006 |
| Origin | 🇸🇪 Sweden |
| Source | [`algorithms/stream/grain.js`](../../../algorithms/stream/grain.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 12 bytes (96 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [eSTREAM Grain-128 Specification](https://www.ecrypt.eu.org/stream/grainpf.html)
- [Grain-128 - A New Stream Cipher](https://www.eit.lth.se/fileadmin/eit/courses/eit060f/Grain128.pdf)
- [Bouncy Castle Reference Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/Grain128Engine.java)

## References

- [CryptoStreams Grain-128 Implementation](https://github.com/crocs-muni/CryptoStreams/blob/master/streams/stream_ciphers/estream/grain/grain-128.cpp)
- [Grain-128AEAD Designer Team Site](https://grain-128aead.github.io/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Bouncy Castle Test Vector #1 - All zeros](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/Grain128Test.java)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `f09b7bf7d7f6b5c2de2ffc73ac21397f` |

**Vector 2** — [Bouncy Castle Test Vector #2 - Pattern key and IV](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/Grain128Test.java)

| Field | Value |
| --- | --- |
| `key` | `0123456789abcdef123456789abcdef0` |
| `iv` | `0123456789abcdef12345678` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `afb5babfa8de896b4b9c6acaf7c4fbfd` |

**Vector 3** — [DarkCrypt Grain - 128-byte keystream (key=00..0F, IV=0)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `969eae24e41b22689ea73c99e83b78ec d9d37afeb4c2ab9ff760f75865b971d0 d5d096bc45717cf6087ad03125823dc9 c9e4225cfe6ccb648a04b13062503e2b bc0fbb260a7d7e25a8638b20cca55007 79b0597d61339f693ddb29c970d43c03 fe48a4e1f1ef2c43466a7189713981bf 510c7c113c58752076ae9f15323a589a` |

**Vector 4** — [DarkCrypt Grain - enc of 00..3F (key=00..0F, IV=0)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `969fac27e01e246f96ae3692e43676e3 c9c268eda0d7bd88ef79ed4379a46fcf f5f1b49f61545ad12053fa1a09af13e6 f9d5106fca59fd53b23d8b0b5e6d0014` |

---

[← All algorithms](../README.md)
