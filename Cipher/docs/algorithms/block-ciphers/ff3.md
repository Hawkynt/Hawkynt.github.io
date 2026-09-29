# FF3

> Format-Preserving Encryption from NIST SP 800-38G (March 2016). DEPRECATED due to security vulnerabilities discovered after publication. Educational implementation for historical reference only.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Format-Preserving Encryption |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | NIST |
| Year | 2016 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/ff.js`](../../../algorithms/block/ff.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Block sizes | 2 bytes (16 bits) to 56 bytes (448 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| FF3 Algorithm Deprecated | FF3 was deprecated by NIST in 2017 due to discovered security vulnerabilities | Use FF1 instead of FF3, or modern encryption algorithms like AES |
| Practical distinguishing attacks | FF3 is vulnerable to practical attacks that can distinguish it from a random permutation | FF3 should never be used in production - algorithm is fundamentally broken |

## Documentation

- [NIST Special Publication 800-38G](https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-38g.pdf)
- [FF3 Security Vulnerabilities](https://eprint.iacr.org/2017/521.pdf)
- [NIST Withdrawal of FF3-1](https://csrc.nist.gov/News/2017/Update-to-SP-800-38G)

## References

- [FF3 Security Analysis](https://eprint.iacr.org/2017/521.pdf)
- [Format-Preserving Encryption Vulnerabilities](https://blog.cryptographyengineering.com/2016/08/13/format-preserving-encryption-ff1-and/)
- [NIST SP 800-38G Rev 1](https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-38g.pdf)

## Test vectors

15 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST FF3 Sample #1 AES-128 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a94` |
| `tweak` | `d8e7920afa330a73` |
| `radix` | `10` |
| `input` | `383930313231323334353637383930303030` |
| `expected` | `373530393138383134303538363534363037` |

**Vector 2** — [NIST FF3 Sample #2 AES-128 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a94` |
| `tweak` | `9a768a92f60e12d8` |
| `radix` | `10` |
| `input` | `383930313231323334353637383930303030` |
| `expected` | `303138393839383339313839333935333834` |

**Vector 3** — [NIST FF3 Sample #3 AES-128 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a94` |
| `tweak` | `d8e7920afa330a73` |
| `radix` | `10` |
| `input` | `3839303132313233343536373839303030303030373839303030303030` |
| `expected` | `3438353938333637313632323532353639363239333937343136323236` |

**Vector 4** — [NIST FF3 Sample #4 AES-128 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a94` |
| `tweak` | `0000000000000000` |
| `radix` | `10` |
| `input` | `3839303132313233343536373839303030303030373839303030303030` |
| `expected` | `3334363935323234383231373334353335313232363133373031343334` |

**Vector 5** — [NIST FF3 Sample #5 AES-128 radix 26](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a94` |
| `tweak` | `9a768a92f60e12d8` |
| `radix` | `26` |
| `input` | `30313233343536373839616263646566676869` |
| `expected` | `6732706b343069393932666e3230636a616b62` |

**Vector 6** — [NIST FF3 Sample #6 AES-192 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a942b7e151628aed2a6` |
| `tweak` | `d8e7920afa330a73` |
| `radix` | `10` |
| `input` | `383930313231323334353637383930303030` |
| `expected` | `363436393635333933383735303238373535` |

**Vector 7** — [NIST FF3 Sample #7 AES-192 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a942b7e151628aed2a6` |
| `tweak` | `9a768a92f60e12d8` |
| `radix` | `10` |
| `input` | `383930313231323334353637383930303030` |
| `expected` | `393631363130353134343931343234343436` |

**Vector 8** — [NIST FF3 Sample #8 AES-192 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a942b7e151628aed2a6` |
| `tweak` | `d8e7920afa330a73` |
| `radix` | `10` |
| `input` | `3839303132313233343536373839303030303030373839303030303030` |
| `expected` | `3533303438383834303635333530323034353431373836333830383037` |

**Vector 9** — [NIST FF3 Sample #9 AES-192 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a942b7e151628aed2a6` |
| `tweak` | `0000000000000000` |
| `radix` | `10` |
| `input` | `3839303132313233343536373839303030303030373839303030303030` |
| `expected` | `3938303833383032363738383230333839323935303431343833353132` |

**Vector 10** — [NIST FF3 Sample #10 AES-192 radix 26](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a942b7e151628aed2a6` |
| `tweak` | `9a768a92f60e12d8` |
| `radix` | `26` |
| `input` | `30313233343536373839616263646566676869` |
| `expected` | `6930696865326a666a3761396f706639703838` |

**Vector 11** — [NIST FF3 Sample #11 AES-256 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a942b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `d8e7920afa330a73` |
| `radix` | `10` |
| `input` | `383930313231323334353637383930303030` |
| `expected` | `393232303131323035353632373737343935` |

**Vector 12** — [NIST FF3 Sample #12 AES-256 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a942b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `9a768a92f60e12d8` |
| `radix` | `10` |
| `input` | `383930313231323334353637383930303030` |
| `expected` | `353034313439383635353738303536313430` |

**Vector 13** — [NIST FF3 Sample #13 AES-256 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a942b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `d8e7920afa330a73` |
| `radix` | `10` |
| `input` | `3839303132313233343536373839303030303030373839303030303030` |
| `expected` | `3034333434333433323335373932353939313635373334363232363939` |

**Vector 14** — [NIST FF3 Sample #14 AES-256 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a942b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `0000000000000000` |
| `radix` | `10` |
| `input` | `3839303132313233343536373839303030303030373839303030303030` |
| `expected` | `3330383539323339393939333734303533383732333635353535383232` |

**Vector 15** — [NIST FF3 Sample #15 AES-256 radix 26](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF3samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `ef4359d8d580aa4f7f036d6f04fc6a942b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `9a768a92f60e12d8` |
| `radix` | `26` |
| `input` | `30313233343536373839616263646566676869` |
| `expected` | `70306232676f64666a613962686237626b3338` |

---

[← All algorithms](../README.md)
