# TTMAC

> Two-Track MAC using dual RIPEMD-160 compression functions. Provides 160-bit authentication tags with 160-bit keys. Based on NESSIE submission.

## Properties

| Property | Value |
| --- | --- |
| Category | Message Authentication |
| Sub-category | Iterated MAC |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Kevin Springle |
| Year | 2000 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/mac/ttmac.js`](../../../algorithms/mac/ttmac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 20 bytes (160 bits) |
| MAC sizes | 20 bytes (160 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `NeedsKey` | Yes |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [TTMAC Specification](http://www.weidai.com/scan-mirror/mac.html#TTMAC)
- [NESSIE](https://www.cosic.esat.kuleuven.be/nessie/)

## References

- [Crypto++ TTMAC](https://github.com/weidai11/cryptopp/blob/master/ttmac.cpp)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [TTMAC: Empty message (NESSIE)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff01234567` |
| `input` | _(empty)_ |
| `expected` | `2dec8ed4a0fd712ed9fbf2ab466ec2df21215e4a` |

**Vector 2** — [TTMAC: 'a' (NESSIE)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff01234567` |
| `input` | `61` |
| `expected` | `5893e3e6e306704dd77ad6e6ed432cde321a7756` |

**Vector 3** — [TTMAC: 'abc' (NESSIE)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff01234567` |
| `input` | `616263` |
| `expected` | `70bfd1029797a5c16da5b557a1f0b2779b78497e` |

**Vector 4** — [TTMAC: 'message digest' (NESSIE)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff01234567` |
| `input` | `6d65737361676520646967657374` |
| `expected` | `8289f4f19ffe4f2af737de4bd71c829d93a972fa` |

**Vector 5** — [TTMAC: alphabet, 26 bytes (NESSIE)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff01234567` |
| `input` | `6162636465666768696a6b6c6d6e6f707172737475767778797a` |
| `expected` | `2186ca09c5533198b7371f245273504ca92bae60` |

**Vector 6** — [TTMAC: 56 bytes, padding spills into a second block (NESSIE)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff01234567` |
| `input` | `61626364626364656364656664656667 65666768666768696768696a68696a6b 696a6b6c6a6b6c6d6b6c6d6e6c6d6e6f 6d6e6f706e6f7071` |
| `expected` | `8a7bf77aef62a2578497a27c0d6518a429e7c14d` |

**Vector 7** — [TTMAC: 62 bytes, padding spills into a second block (NESSIE)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff01234567` |
| `input` | `4142434445464748494a4b4c4d4e4f50 5152535455565758595a616263646566 6768696a6b6c6d6e6f70717273747576 7778797a30313233343536373839` |
| `expected` | `54bac392a886806d169556fcbb6789b54fb364fb` |

**Vector 8** — [TTMAC: 8 x '1234567890', 80 bytes over two blocks (NESSIE)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/ttmac.txt)

| Field | Value |
| --- | --- |
| `key` | `00112233445566778899aabbccddeeff01234567` |
| `input` | `31323334353637383930313233343536 37383930313233343536373839303132 33343536373839303132333435363738 39303132333435363738393031323334 35363738393031323334353637383930` |
| `expected` | `0ced2c9f8f0d9d03981ab5c8184bac43dd54c484` |

---

[← All algorithms](../README.md)
