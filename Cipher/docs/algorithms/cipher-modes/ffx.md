# FFX

> FFX (Format-Preserving Encryption) is a Feistel-based construction that preserves the format of input data during encryption. It can handle arbitrary alphabets and string lengths, making it suitable for encrypting credit card numbers, SSNs, and other structured data while maintaining their original format. Input is restricted to the configured alphabet: for radix 2-36 the canonical base-N digits '0'-'9' then lowercase 'a'-'z', for radix 37-255 byte values below the radix, and for radix 256 any byte. At least two symbols are required. Anything else is rejected rather than reduced into range, because folding a byte modulo the radix is not reversible.

## Properties

| Property | Value |
| --- | --- |
| Category | Cipher Modes |
| Sub-category | Format-Preserving Encryption |
| Security status | 🧪 Experimental |
| Complexity | Research |
| Inventor | Mihir Bellare, Phillip Rogaway, Thomas Spies |
| Year | 2010 |
| Origin | 🇺🇸 United States |
| Restricted input domain | strings over the configured radix alphabet, at least two symbols long |
| Source | [`algorithms/modes/ffx.js`](../../../algorithms/modes/ffx.js) |

## Capabilities

| Flag | Value |
| --- | --- |
| `RequiresIV` | No |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Alphabet Size Limitation | FFX security depends on alphabet size and message length. Small alphabets or short messages may provide insufficient security. | — |
| Side Channel Analysis | Implementation must protect against timing attacks and other side-channel vulnerabilities during Feistel round computations. | — |

## Documentation

- [NIST SP 800-38G](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-38G.pdf)
- [FFX Original Paper](https://eprint.iacr.org/2010/042.pdf)
- [Format-Preserving Encryption Survey](https://web.cs.ucdavis.edu/~rogaway/papers/fpe.pdf)

## References

- [Python FPE Library](https://github.com/mysto/python-fpe)
- [Java FF1 Implementation](https://github.com/privacylogistics/java-fpe)
- [NIST FF1/FF3 Reference](https://github.com/capitalone/fpe)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST FF1 sample 1 - AES-128, radix 10, empty tweak](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | _(empty)_ |
| `radix` | `10` |
| `input` | `30313233343536373839` |
| `expected` | `32343333343737343834` |

**Vector 2** — [NIST FF1 sample 2 - AES-128, radix 10, 10-byte tweak](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `39383736353433323130` |
| `radix` | `10` |
| `input` | `30313233343536373839` |
| `expected` | `36313234323030373733` |

**Vector 3** — [NIST FF1 sample 3 - AES-128, radix 36, 11-byte tweak](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3c` |
| `tweak` | `3737373770717273373737` |
| `radix` | `36` |
| `input` | `30313233343536373839616263646566676869` |
| `expected` | `6139747634306d6c6c396b647535303965756d` |

**Vector 4** — [NIST FF1 sample 5 - AES-192, radix 10, 10-byte tweak](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f` |
| `tweak` | `39383736353433323130` |
| `radix` | `10` |
| `input` | `30313233343536373839` |
| `expected` | `32343936363535353439` |

**Vector 5** — [NIST FF1 sample 9 - AES-256, radix 36, 11-byte tweak](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/example-values)

| Field | Value |
| --- | --- |
| `cipher` | AES |
| `key` | `2b7e151628aed2a6abf7158809cf4f3cef4359d8d580aa4f7f036d6f04fc6a94` |
| `tweak` | `3737373770717273373737` |
| `radix` | `36` |
| `input` | `30313233343536373839616263646566676869` |
| `expected` | `7873386130617a6832617679616c797a757764` |

---

[← All algorithms](../README.md)
