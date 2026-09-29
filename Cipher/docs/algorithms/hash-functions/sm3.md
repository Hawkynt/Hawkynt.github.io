# SM3

> Chinese national cryptographic hash standard producing 256-bit digests. Part of the ShangMi (Commercial Cryptography) suite used in China's cryptographic infrastructure.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Merkle-Damgård Hash |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Xiaoyun Wang, et al. |
| Year | 2010 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/hash/sm3.js`](../../../algorithms/hash/sm3.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Hash sizes | 32 bytes (256 bits) |

## Security

**Status:** not classified — treat as unverified.

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| No known practical attacks | SM3 is considered secure for current cryptographic use | — |

## Documentation

- [SM3 Hash Function Specification](https://tools.ietf.org/html/draft-shen-sm3-hash)
- [GmSSL Project](http://gmssl.org/)
- [Chinese Cryptography Standards](http://www.oscca.gov.cn/)

## References

- [Crypto++ SM3 Implementation](https://github.com/weidai11/cryptopp/blob/master/sm3.cpp)
- [GmSSL Reference Implementation](https://github.com/guanzhi/GmSSL)
- [SM3 Test Vectors](https://github.com/weidai11/cryptopp/blob/master/TestVectors/sm3.txt)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SM3: Empty message (Crypto++ generated)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/sm3.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `1ab21d8355cfa17f8e61194831e81a8f22bec8c728fefb747ed035eb5082aa2b` |

**Vector 2** — [SM3: 'abc' (draft-shen-sm3-hash Appendix B)](https://tools.ietf.org/html/draft-shen-sm3-hash)

| Field | Value |
| --- | --- |
| `input` | `616263` |
| `expected` | `66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0` |

**Vector 3** — [SM3: 16 x 'abcd' (draft-shen-sm3-hash Appendix B)](https://tools.ietf.org/html/draft-shen-sm3-hash)

| Field | Value |
| --- | --- |
| `input` | `61626364616263646162636461626364 61626364616263646162636461626364 61626364616263646162636461626364 61626364616263646162636461626364` |
| `expected` | `debe9ff92275b8a138604889c18e5a4d6fdb70e5387e5765293dcba39c0c5732` |

**Vector 4** — [SM3: 1 word 'abcd' (Crypto++ generated)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/sm3.txt)

| Field | Value |
| --- | --- |
| `input` | `61626364` |
| `expected` | `82ec580fe6d36ae4f81cae3c73f4a5b3b5a09c943172dc9053c69fd8e18dca1e` |

**Vector 5** — [SM3: 2 words (Crypto++ generated)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/sm3.txt)

| Field | Value |
| --- | --- |
| `input` | `6162636461626364` |
| `expected` | `b58b85b795b34879c354428f7c78cd1486c4ef25ea4c5d68e611ff41c15731ef` |

**Vector 6** — [SM3: 8 words (Crypto++ generated)](https://github.com/weidai11/cryptopp/blob/master/TestVectors/sm3.txt)

| Field | Value |
| --- | --- |
| `input` | `6162636461626364616263646162636461626364616263646162636461626364` |
| `expected` | `73edef5c9d3710f14dbaf892f50ce9dfab48e462d837d93ec0f9422c5f2a4007` |

---

[← All algorithms](../README.md)
