# WAKE-OFB-BE

> Table-driven stream cipher designed by David Wheeler using 32-bit word operations with auto-key generation. Operates in OFB mode with cascaded M() mixing functions. Known to be vulnerable to chosen plaintext attacks.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | David Wheeler |
| Year | 1993 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/stream/wake.js`](../../../algorithms/stream/wake.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 1 byte (8 bits) to 65536 bytes (524288 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `isBigEndian` | Yes |

## Security

**Status:** ❌ Broken

No vulnerabilities are recorded for this implementation.

## Documentation

- [Wheeler: A Bulk Data Encryption Algorithm](https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-249.pdf)

## References

- [Crypto++ WAKE Implementation (from Wheeler's original paper)](https://github.com/weidai11/cryptopp/blob/master/wake.cpp)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Crypto++ WAKE-OFB-BE Test Vector](https://github.com/weidai11/cryptopp/blob/master/TestVectors/wake.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 01010101010101010101010101010101 01010101010101010101010101010101 01010101010101010101010101010101 01010101010101010101010101010101 01010101010101010101010101010101` |
| `expected` | `ccddeeffd4b942df15359c938848ab68 ca6492bd787fcf66691f148590f3f334 867b98f19133b7093ff7c59dec93ed7b 5ff3d4dc552828f3d1fa8a3b56a6dd13 3d55325988aa43911659e86ac2f32773 6c4e43605f89a090646b3ed321655212 f4120bfa8f3eeeecf7dc964ffbaa0709 0fc4295e0ab70ec16e737049c698df98 4a84ac154a8efb4699f5bbeb93737bdf 6c77940bbe57876c714eb351ae14b5e9` |

---

[← All algorithms](../README.md)
