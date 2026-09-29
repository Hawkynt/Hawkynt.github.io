# CROSS

> Codes and Restricted Objects Signature Scheme: a zero-knowledge identification over the restricted syndrome decoding problem, made non-interactive with Fiat-Shamir and compressed with seed and Merkle trees. Round-two candidate of the NIST call for additional signatures, all eighteen parameter sets (RSDP and RSDP(G), categories 1, 3 and 5, fast, balanced and small), reproducing the submission's Known Answer Tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Code-based Digital Signature |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Marco Baldi, Alessandro Barenghi, Sebastian Bitzer, Patrick Karl, Felice Manganiello, Alessio Pavoni, Gerardo Pelosi, Paolo Santini, Jonas Schupp, Freeman Slaughter, Antonia Wachter-Zeh, Violetta Weger |
| Year | 2023 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/cross.js`](../../../algorithms/asymmetric/cross.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits); 48 bytes (384 bits); 64 bytes (512 bits) |

## Parameter sets

- CROSS-RSDP-128-fast
- CROSS-RSDP-128-balanced
- CROSS-RSDP-128-small
- CROSS-RSDP-192-fast
- CROSS-RSDP-192-balanced
- CROSS-RSDP-192-small
- CROSS-RSDP-256-fast
- CROSS-RSDP-256-balanced
- CROSS-RSDP-256-small
- CROSS-RSDPG-128-fast
- CROSS-RSDPG-128-balanced
- CROSS-RSDPG-128-small
- CROSS-RSDPG-192-fast
- CROSS-RSDPG-192-balanced
- CROSS-RSDPG-192-small
- CROSS-RSDPG-256-fast
- CROSS-RSDPG-256-balanced
- CROSS-RSDPG-256-small

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Under evaluation, not standardised](https://csrc.nist.gov/projects/pqc-dig-sig) | CROSS is a candidate of the NIST additional-signatures process. Its parameters have already changed between rounds and the later reference releases produce different Known Answer Tests from the round-two package this file follows | Treat it as experimental and pin the version when interoperating |
| [Deterministic signing here](https://www.cross-crypto.com/) | Without katCount this file derives the root seed and salt from the secret key and the message instead of drawing them at random. That keeps distinct messages on distinct salts, but it is not the randomised signing the specification prescribes and it gives up any fault-attack resistance randomness would add | Use a reviewed implementation with a real random source for anything beyond study |
| [Published demonstration keys](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip) | The secret keys in the test vectors come from the published KAT generator and confer no secrecy | Generate a key-pair seed from a proper random source for any use beyond demonstration |

## Documentation

- [CROSS round-two specification (version 2.0)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/spec-files/cross-spec-round2-web.pdf)
- [CROSS round-two submission package](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)
- [CROSS project site](https://www.cross-crypto.com/)
- [NIST PQC additional digital signature schemes](https://csrc.nist.gov/projects/pqc-dig-sig)

## References

- [CROSS reference and optimised implementations](https://github.com/CROSS-signature/CROSS-implementation)
- [Baldi et al., Zero knowledge protocols and signatures from the restricted syndrome decoding problem (PKC 2024)](https://eprint.iacr.org/2023/1541)
- [FIPS 202 - SHA-3 and the SHAKE functions](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf)

## Test vectors

30 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [CROSS-RSDP-128-fast count 0: crypto_sign reproduces the signed message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_77_18432.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | CROSS-RSDP-128-fast |
| `katCount` | `0` |
| `key` | `08b491d9c18b8b33bb3cb17ac74574543152a6c140b79648873b84d5a742c70e` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (18465 bytes; the full value is in the source) |

**Vector 2** — [CROSS-RSDP-128-fast count 0: crypto_sign_open under the published public key yields the message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_77_18432.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDP-128-fast |
| `publicKey` | `843a0cca82d1b761ec4af1acb0473a18 de5fd2143a6a7520e61bb703b4270b2d 2271cb06d9766ab1ec9d1632222d5eed 6048010002e0de320143c82070894d2d c2251c44670a6f81ce22e74e01` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (18465 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 3** — [CROSS-RSDP-128-balanced count 0: crypto_sign reproduces the signed message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_77_13152.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | CROSS-RSDP-128-balanced |
| `katCount` | `0` |
| `key` | `08b491d9c18b8b33bb3cb17ac74574543152a6c140b79648873b84d5a742c70e` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (13185 bytes; the full value is in the source) |

**Vector 4** — [CROSS-RSDP-128-balanced count 0: crypto_sign_open under the published public key yields the message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_77_13152.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDP-128-balanced |
| `publicKey` | `4390c28abc4e13d1e9ded0aa28feb731 419d32482902951f96c5e20e6653f77e 98956956b00cef6b0146202d55e5fc44 47cb3758f24b6cbaed0f783f227062a9 66f26a5bbeb566af07a97be00e` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (13185 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 5** — [CROSS-RSDP-128-small count 0: crypto_sign reproduces the signed message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_77_12432.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | CROSS-RSDP-128-small |
| `katCount` | `0` |
| `key` | `08b491d9c18b8b33bb3cb17ac74574543152a6c140b79648873b84d5a742c70e` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (12465 bytes; the full value is in the source) |

**Vector 6** — [CROSS-RSDP-128-small count 0: key generation from the harness stream, then signing (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_77_12432.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | CROSS-RSDP-128-small |
| `katCount` | `0` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (12465 bytes; the full value is in the source) |

**Vector 7** — [CROSS-RSDP-128-small count 0: crypto_sign_open under the published public key yields the message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_77_12432.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDP-128-small |
| `publicKey` | `6bb2b7eb6676eb4781ceb3eb1cad7d26 230efca6528fdab15f4d76ff61db8079 196978cbb196a8a2ad4456bb002deb06 2a8e14b59389264d51bb93c8aae43a23 e315b20c4225b70690de42e70c` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (12465 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 8** — [CROSS-RSDP-128-small count 0: the verdict under the public key derived from the secret key is acceptance](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDP-128-small |
| `key` | `08b491d9c18b8b33bb3cb17ac74574543152a6c140b79648873b84d5a742c70e` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (12465 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 9** — [CROSS-RSDP-128-small count 0: a modified message must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDP-128-small |
| `publicKey` | `6bb2b7eb6676eb4781ceb3eb1cad7d26 230efca6528fdab15f4d76ff61db8079 196978cbb196a8a2ad4456bb002deb06 2a8e14b59389264d51bb93c8aae43a23 e315b20c4225b70690de42e70c` |
| `message` | `d91c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d91c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (12465 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 10** — [CROSS-RSDP-128-small count 0: a genuine signed message does not vouch for a different message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDP-128-small |
| `publicKey` | `6bb2b7eb6676eb4781ceb3eb1cad7d26 230efca6528fdab15f4d76ff61db8079 196978cbb196a8a2ad4456bb002deb06 2a8e14b59389264d51bb93c8aae43a23 e315b20c4225b70690de42e70c` |
| `message` | `d91c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (12465 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 11** — [CROSS-RSDP-128-small count 0: a modified signature (one bit of the first response) must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDP-128-small |
| `publicKey` | `6bb2b7eb6676eb4781ceb3eb1cad7d26 230efca6528fdab15f4d76ff61db8079 196978cbb196a8a2ad4456bb002deb06 2a8e14b59389264d51bb93c8aae43a23 e315b20c4225b70690de42e70c` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (12465 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 12** — [CROSS-RSDP-128-small count 0: a modified signature (one bit of the salt) must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDP-128-small |
| `publicKey` | `6bb2b7eb6676eb4781ceb3eb1cad7d26 230efca6528fdab15f4d76ff61db8079 196978cbb196a8a2ad4456bb002deb06 2a8e14b59389264d51bb93c8aae43a23 e315b20c4225b70690de42e70c` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c869f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (12465 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 13** — [CROSS-RSDP-128-small count 0: the signature must not verify under another record's public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDP-128-small |
| `publicKey` | `8af918c08898cb3159cb2433a4aee4ea b1d5e532c15234ac3bd482a7fd844fda 07f110697ce1f307b198cd0abdb434b7 c3a548305b5631a1e640beecfbc6c8b1 5f66435435f1fd213c9232fe08` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (12465 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 14** — [CROSS-RSDPG-128-fast count 0: crypto_sign reproduces the signed message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_54_11980.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | CROSS-RSDPG-128-fast |
| `katCount` | `0` |
| `key` | `08b491d9c18b8b33bb3cb17ac74574543152a6c140b79648873b84d5a742c70e` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (12013 bytes; the full value is in the source) |

**Vector 15** — [CROSS-RSDPG-128-fast count 0: crypto_sign_open under the published public key yields the message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_54_11980.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDPG-128-fast |
| `publicKey` | `451eeac52604474bb5281f3b5cfd9143 6ff8b94ac65abfddd0da3cca66ae7390 1d5048bd4e4897b4733ae4c069eceac9 8ba1e8260006` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (12013 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 16** — [CROSS-RSDPG-128-balanced count 0: crypto_sign reproduces the signed message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_54_9120.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | CROSS-RSDPG-128-balanced |
| `katCount` | `0` |
| `key` | `08b491d9c18b8b33bb3cb17ac74574543152a6c140b79648873b84d5a742c70e` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (9153 bytes; the full value is in the source) |

**Vector 17** — [CROSS-RSDPG-128-balanced count 0: crypto_sign_open under the published public key yields the message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_54_9120.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDPG-128-balanced |
| `publicKey` | `4390c28abc4e13d1e9ded0aa28feb731 419d32482902951f96c5e20e6653f77e d69054c2c0ef0c5ee2e6250f0b60cb82 e5c7aa19df01` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (9153 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 18** — [CROSS-RSDPG-128-small count 0: crypto_sign reproduces the signed message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_54_8960.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | CROSS-RSDPG-128-small |
| `katCount` | `0` |
| `key` | `08b491d9c18b8b33bb3cb17ac74574543152a6c140b79648873b84d5a742c70e` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (8993 bytes; the full value is in the source) |

**Vector 19** — [CROSS-RSDPG-128-small count 0: crypto_sign_open under the published public key yields the message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_54_8960.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDPG-128-small |
| `publicKey` | `bf045fff4fcb0a9de8f2470df666d355 fed55fcf0c6de0fcd8295dd1875f51e9 f7e7df370e629ee5509a6110ffdb055b fc97c32d1b01` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (8993 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 20** — [CROSS-RSDPG-128-small count 0: the verdict under the public key derived from the secret key is acceptance](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDPG-128-small |
| `key` | `08b491d9c18b8b33bb3cb17ac74574543152a6c140b79648873b84d5a742c70e` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (8993 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 21** — [CROSS-RSDPG-128-small count 0: a modified message must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDPG-128-small |
| `publicKey` | `bf045fff4fcb0a9de8f2470df666d355 fed55fcf0c6de0fcd8295dd1875f51e9 f7e7df370e629ee5509a6110ffdb055b fc97c32d1b01` |
| `message` | `d91c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d91c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (8993 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 22** — [CROSS-RSDPG-128-small count 0: a genuine signed message does not vouch for a different message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDPG-128-small |
| `publicKey` | `bf045fff4fcb0a9de8f2470df666d355 fed55fcf0c6de0fcd8295dd1875f51e9 f7e7df370e629ee5509a6110ffdb055b fc97c32d1b01` |
| `message` | `d91c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (8993 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 23** — [CROSS-RSDPG-128-small count 0: a modified signature (one bit of the first response) must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDPG-128-small |
| `publicKey` | `bf045fff4fcb0a9de8f2470df666d355 fed55fcf0c6de0fcd8295dd1875f51e9 f7e7df370e629ee5509a6110ffdb055b fc97c32d1b01` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (8993 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 24** — [CROSS-RSDPG-128-small count 0: a modified signature (one bit of the salt) must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDPG-128-small |
| `publicKey` | `bf045fff4fcb0a9de8f2470df666d355 fed55fcf0c6de0fcd8295dd1875f51e9 f7e7df370e629ee5509a6110ffdb055b fc97c32d1b01` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c869f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (8993 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 25** — [CROSS-RSDPG-128-small count 0: the signature must not verify under another record's public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDPG-128-small |
| `publicKey` | `59082419dc5ceec427af8c1959e0dc5f 86e6a04ef445a2aab07df0e5640fa592 ae2e9b4dce0c59e23d4ea36130c8ccc3 26ba2e290800` |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c868f468c0122c00ae15f7ab0410bef0 8f932d20f2b2fc7e907b3c091dcee7a5 …` (8993 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 26** — [CROSS-RSDPG-128-small count 1: crypto_sign reproduces the signed message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_54_8960.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | CROSS-RSDPG-128-small |
| `katCount` | `1` |
| `key` | `0f238a0238dc0fe23d24e60e8dd9434b08adff5a312e9ff8261fe26983a0c4df` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (9026 bytes; the full value is in the source) |

**Vector 27** — [CROSS-RSDPG-128-small count 1: key generation from the harness stream, then signing (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_54_8960.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | CROSS-RSDPG-128-small |
| `katCount` | `1` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (9026 bytes; the full value is in the source) |

**Vector 28** — [CROSS-RSDPG-128-small count 1: crypto_sign_open under the published public key yields the message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_54_8960.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDPG-128-small |
| `publicKey` | `59082419dc5ceec427af8c1959e0dc5f 86e6a04ef445a2aab07df0e5640fa592 ae2e9b4dce0c59e23d4ea36130c8ccc3 26ba2e290800` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (9026 bytes; the full value is in the source) |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |

**Vector 29** — [CROSS-RSDPG-256-small count 0: crypto_sign reproduces the signed message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_106_36454.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | CROSS-RSDPG-256-small |
| `katCount` | `0` |
| `key` | `72c91341f2c9c1840bc341b6fa3c0da7 a9002121e041766f921ae42a212330c0 6cc05ee53e805ae7053205d1f41f9029 b5614f11e8517915b4ee048f0699bb2d` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8b6ac2461a7e8fdad811d9f4dfffe26 725b179f7bea3ec399c3168c6307207c …` (36487 bytes; the full value is in the source) |

**Vector 30** — [CROSS-RSDPG-256-small count 0: crypto_sign_open under the published public key yields the message (round-two KAT record rebuilt from the package generator; the whole response file PQCsignKAT_106_36454.rsp reproduces its published SHA-512)](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/cross-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `parameterSet` | CROSS-RSDPG-256-small |
| `publicKey` | `5b7e438cff2c1d097b82dfe5369c0f99 e83daecc0b8fbcf98ebe3f596360b862 21b61729ba29310dc32dba0db1530fb4 4b2d36c6fb8a8ca7b7de0c616aa4ba13 46d2e1b17649ad3668283d92b6b24e9e 670daeed44d3b4c5573aeaae2a06e044 1fb526d59bc68706721a` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8b6ac2461a7e8fdad811d9f4dfffe26 725b179f7bea3ec399c3168c6307207c …` (36487 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

---

[← All algorithms](../README.md)
