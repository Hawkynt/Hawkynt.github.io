# Yamb (DarkCrypt)

> T-function-based eSTREAM Phase 1 candidate by LAN Crypto, combining Galois-style word LFSRs (state OLZ, feedback 0x091B17C9) with a 256-byte nonlinear substitution table mixed via a 12-step byte network. The DarkCrypt implementation fixes the key to 256 bits and the IV to 128 bits (reference supports 80-256 bit keys, 32-128 bit IVs).

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | LAN Crypto (Anatoly Lebedev, Sergey Starodubtzev, Alexey Volchkov) |
| Year | 2005 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/stream/darkcrypt-yamb.js`](../../../algorithms/stream/darkcrypt-yamb.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Distinguishing Attack | Hongjun Wu and Bart Preneel published a distinguishing attack against the Yamb output; the cipher was archived after eSTREAM Phase 1. | Use a vetted modern stream cipher such as ChaCha20. |

## Documentation

- [eSTREAM Yamb page (archived)](https://www.ecrypt.eu.org/stream/yamb.html)
- [Yamb specification (LAN Crypto eSTREAM submission)](https://www.ecrypt.eu.org/stream/ciphers/yamb/yamb.pdf)
- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)

## References

- [Yamb reference C implementation (eSTREAM submission package)](https://www.ecrypt.eu.org/stream/ciphers/yamb/yambsource.zip)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [eSTREAM Yamb reference algorithm — key repeats the eSTREAM 128-bit test key to 256 bits, IV extends the eSTREAM 32-bit test IV with zero bytes to 128 bits (verified against the official yamb.c reference)](https://www.ecrypt.eu.org/stream/ciphers/yamb/yambsource.zip)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f000102030405060708090a0b0c0d0e0f` |
| `iv` | `20212223000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `0f94b44a299f77f9f11f448247813b1f d9f71e8a4e60d40b950f64ff49d6ff65 c7b7aa7ecaf85dde6c81c1d56ac649c3 755e25b5442e4e06f9f24d80bb920afc` |

**Vector 2** — [DarkCrypt Yamb — keystream (256-bit incrementing key, zero IV, zero input)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `ae5f58527e8a046ba09c11bcca824afb ac617b8555e084e64552f718d0adcc50 98fc8bd5e656529bcaaf4da24319e86f 0c789e003a3650b94ebced8aac7bea69 ead427b76f3b04fe3382d829e3f890c3 f0e2fa45d8f1843e0cc5f77947a205e5 f0915f7f51e3e8a1b867d346f8af8940 b3d8746d086bd0975181f08a3c6f49ab` |

**Vector 3** — [DarkCrypt Yamb — encryption (256-bit incrementing key, zero IV, incrementing plaintext)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `ae5e5a517a8f026ca8951bb7c68f44f4 bc70699641f592f15d4bed03ccb0d24f b8dda9f6c27374bce28667896f34c640 3c49ac330e03668e7685d7b19046d456` |

---

[← All algorithms](../README.md)
