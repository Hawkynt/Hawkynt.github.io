# FF1

> Format-Preserving Encryption from NIST SP 800-38G.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Format-Preserving Encryption |
| Security status | Not classified |
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

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST Special Publication 800-38G](https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-38g.pdf)
- [FF1 and FF3 Format-Preserving Encryption Algorithms](https://csrc.nist.gov/publications/detail/sp/800-38g/final)

## References

- [BouncyCastle FF1 Implementation](https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/fpe/SP80038G.java)
- [BouncyCastle FF1 Test Vectors](https://github.com/bcgit/bc-csharp/blob/master/crypto/test/src/crypto/test/SP80038GTest.cs)
- [Python FF1 Implementation](https://github.com/mysto/python-fpe)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST FF1 Sample #1 AES-128 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF1samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | _(empty)_ |
| `radix` | `10` |
| `input` | `30313233343536373839` |
| `expected` | `32343333343737343834` |

**Vector 2** — [NIST FF1 Sample #2 AES-128 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF1samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `39383736353433323130` |
| `radix` | `10` |
| `input` | `30313233343536373839` |
| `expected` | `36313234323030373733` |

**Vector 3** — [NIST FF1 Sample #3 AES-128 radix 36](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF1samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `3737373770717273373737` |
| `radix` | `36` |
| `input` | `30313233343536373839616263646566676869` |
| `expected` | `6139747634306d6c6c396b647535303965756d` |

**Vector 4** — [NIST FF1 Sample #4 AES-192 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF1samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f` |
| `tweak` | _(empty)_ |
| `radix` | `10` |
| `input` | `30313233343536373839` |
| `expected` | `32383330363638313332` |

**Vector 5** — [NIST FF1 Sample #5 AES-192 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF1samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f` |
| `tweak` | `39383736353433323130` |
| `radix` | `10` |
| `input` | `30313233343536373839` |
| `expected` | `32343936363535353439` |

**Vector 6** — [NIST FF1 Sample #6 AES-192 radix 36](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF1samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f` |
| `tweak` | `3737373770717273373737` |
| `radix` | `36` |
| `input` | `30313233343536373839616263646566676869` |
| `expected` | `78626a336b7633356a72617778763332797372` |

**Vector 7** — [NIST FF1 Sample #7 AES-256 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF1samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f7f036d6f04fc6a94` |
| `tweak` | _(empty)_ |
| `radix` | `10` |
| `input` | `30313233343536373839` |
| `expected` | `36363537363637303039` |

**Vector 8** — [NIST FF1 Sample #8 AES-256 radix 10](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF1samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f7f036d6f04fc6a94` |
| `tweak` | `39383736353433323130` |
| `radix` | `10` |
| `input` | `30313233343536373839` |
| `expected` | `31303031363233343633` |

**Vector 9** — [NIST FF1 Sample #9 AES-256 radix 36](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/FF1samples.pdf)

| Field | Value |
| --- | --- |
| `key` | `2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f7f036d6f04fc6a94` |
| `tweak` | `3737373770717273373737` |
| `radix` | `36` |
| `input` | `30313233343536373839616263646566676869` |
| `expected` | `7873386130617a6832617679616c797a757764` |

---

[← All algorithms](../README.md)
