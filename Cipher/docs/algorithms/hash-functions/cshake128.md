# cSHAKE128

> cSHAKE128 is a customizable extendable-output function based on SHAKE128 from NIST SP 800-185. Supports function name and customization string parameters for domain separation.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Extendable-Output Function |
| Variant | 128 |
| Security status | 🛡️ Secure |
| Complexity | Advanced |
| Inventor | NIST |
| Year | 2016 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/hash/cshake.js`](../../../algorithms/hash/cshake.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 1 byte (8 bits) to 1024 bytes (8192 bits) |

## Security

**Status:** 🛡️ Secure

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST SP 800-185](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf)
- [Keccak Team](https://keccak.team/)

## References

- [BouncyCastle Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/CSHAKEDigest.java)
- [NIST Examples](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [cSHAKE128: 00010203, S='Email Signature', 32 bytes (NIST)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf)

| Field | Value |
| --- | --- |
| `customization` | `456d61696c205369676e6174757265` |
| `outputSize` | `32` |
| `input` | `00010203` |
| `expected` | `c1c36925b6409a04f1b504fcbca9d82b4017277cb5ed2b2065fc1d3814d5aaf5` |

**Vector 2** — [cSHAKE128: 200 bytes, S='Email Signature', 32 bytes (NIST)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf)

| Field | Value |
| --- | --- |
| `customization` | `456d61696c205369676e6174757265` |
| `outputSize` | `32` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7` |
| `expected` | `c5221d50e4f822d96a2e8881a961420f294b7b24fe3d2094baed2c6524cc166b` |

**Vector 3** — [cSHAKE128: NIST ACVP tc25 - N='KMAC', 5-byte message, 39-byte output](https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/cSHAKE-128-1.0/internalProjection.json)

| Field | Value |
| --- | --- |
| `functionName` | `4b4d4143` |
| `customization` | `606b6945466026492929375d7971303f 2a734b612071295b6a506034523d296c 565f3974797654246b4162482429317d 705d2e6262656f6d622e` |
| `outputSize` | `39` |
| `input` | `ca88f708fa` |
| `expected` | `bebb534ccfccd300f731d2911fb4351d 5fcc95ac2509e9abae8f9dc51106e28d 7f25ae11738334` |

**Vector 4** — [cSHAKE128: NIST ACVP tc27 - N='KMAC', empty message, 34-byte output](https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/cSHAKE-128-1.0/internalProjection.json)

| Field | Value |
| --- | --- |
| `functionName` | `4b4d4143` |
| `customization` | `60503b757c2a606a4b40357e65243655 787662453829426f2a7e2e4466732f7a 64583e26406d2a4e626e733c487d3572 3c6b49447a6526572e4b6b7d7b3b2457 313a3b2c6431362b6d3463483427462b 693a297a496a207d5265767421` |
| `outputSize` | `34` |
| `input` | _(empty)_ |
| `expected` | `1e5ca2a14cc46de9a6510003516cddcf 4fd6f3dc073f64633bfe5c43172e97c7 d63a` |

---

[← All algorithms](../README.md)
