# ZUC

> Word-oriented stream cipher with 16-stage LFSR over GF(2^31-1). Core of 3GPP LTE/4G confidentiality (128-EEA3) and integrity (128-EIA3) algorithms for mobile communications.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | 3GPP Stream Cipher |
| Security status | 🛡️ Secure |
| Complexity | Expert |
| Inventor | DACAS (Data Assurance and Communication Security Research Center) |
| Year | 2010 |
| Origin | 🇨🇳 China |
| Source | [`algorithms/stream/zuc.js`](../../../algorithms/stream/zuc.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Nonce sizes | 16 bytes (128 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [3GPP TS 35.221 - ZUC Specification](https://www.3gpp.org/ftp/Specs/archive/35_series/35.221/)
- [ZUC Algorithm Specification](http://www.is.cas.cn/ztzl2016/zouchongzhi/201801/W020180626623159589087.pdf)
- [3GPP Security Algorithms](https://www.3gpp.org/technologies/keywords-acronyms/100-the-3gpp-security-algorithms)

## References

- [GmSSL C Reference Implementation (ZUC/128-EEA3/128-EIA3)](https://github.com/guanzhi/GmSSL)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [GSMA ZUC Test Vector 1 - All zeros key and IV](https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000` |
| `iv` | `00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `27bede74018082da87d4e5b69f18bf66 32070e0f39b7b692b4673edc3184a48e 27636f4414510d62cc15cfe194ec4f6d 4b8c8fcc630648badf41b6f9d16a36ca` |

**Vector 2** — [GSMA ZUC Test Vector 2 - All ones key and IV](https://www.gsma.com/aboutus/wp-content/uploads/2014/12/eea3eia3zucv16.pdf)

| Field | Value |
| --- | --- |
| `key` | `ffffffffffffffffffffffffffffffff` |
| `iv` | `ffffffffffffffffffffffffffffffff` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `0657cfa07096398b734b6cb4883eedf4 257a76eb97595208d884adcdb1cbffb8 e0f9d15846a0eed015328503351138f7 40d079af17296c232c4f022d6e4acac6` |

---

[← All algorithms](../README.md)
