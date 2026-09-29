# WAKE-OFB-LE

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
| `isBigEndian` | No |

## Security

**Status:** ❌ Broken

No vulnerabilities are recorded for this implementation.

## Documentation

- [Wheeler: A Bulk Data Encryption Algorithm](https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-249.pdf)

## References

- [Crypto++ WAKE Implementation (from Wheeler's original paper)](https://github.com/weidai11/cryptopp/blob/master/wake.cpp)

## Test vectors

1 vector ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Crypto++ WAKE-OFB-LE Test Vector](https://github.com/weidai11/cryptopp/blob/master/TestVectors/wake.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 01010101010101010101010101010101 01010101010101010101010101010101 01010101010101010101010101010101 01010101010101010101010101010101 01010101010101010101010101010101` |
| `expected` | `ffeeddccdf42b9d4939c351568ab4888 bd9264ca66cf7f7885141f6934f3f390 f1987b8609b733919dc5f73f7bed93ec dcd4f35ff32828553b8afad113dda656 5932553d9143aa886ae859167327f3c2 60434e6c90a0895fd33e6b6412526521 fa0b12f4ecee3e8f4f96dcf70907aafb 5e29c40fc10eb70a4970736e98df98c6 15ac844a46fb8e4aebbbf599df7b7393 0b94776c6c8757be51b34e71e9b514ae` |

---

[← All algorithms](../README.md)
