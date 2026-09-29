# DES-X

> DES with key whitening by Ron Rivest (1984). Uses 64-bit pre/post-whitening keys with standard DES to increase resistance to brute-force attacks. Educational implementation showing key whitening techniques.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Intermediate |
| Inventor | Ronald L. Rivest |
| Year | 1984 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/block/des-x.js`](../../../algorithms/block/des-x.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 24 bytes (192 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Based on DES | DES-X inherits all weaknesses of DES including small key size and susceptibility to differential cryptanalysis | Use modern block ciphers like AES instead of DES-X |
| Key whitening limitations | While key whitening increases security, it doesn't address fundamental DES weaknesses | DES-X is obsolete - use AES or other modern ciphers |

## Documentation

- [DES-X Original Specification](https://people.csail.mit.edu/rivest/pubs.html#Rivest84)
- [RSA BSAFE DES-X Documentation](https://web.archive.org/web/20050404121715/http://www.rsasecurity.com/rsalabs/node.asp?id=2229)
- [Applied Cryptography - DES-X](https://www.schneier.com/books/applied-cryptography/)

## References

- [Crypto++ DES-X Implementation](https://github.com/weidai11/cryptopp)
- [Key Whitening in Block Ciphers](https://eprint.iacr.org/)
- [DES-X Security Analysis](https://link.springer.com/chapter/10.1007/BFb0052332)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DES-X all-zero key and block (degenerates to the DES all-zero known answer)](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/DES-ECB.pdf)

| Field | Value |
| --- | --- |
| `key` | `000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `8ca64de9c1b123a7` |

**Vector 2** — [OpenSSL DES_xcbc_encrypt known answer, block 1](https://github.com/openssl/openssl/blob/master/test/destest.c)

| Field | Value |
| --- | --- |
| `key` | `f1e0d3c2b5a497860123456789abcdeffedcba9876543210` |
| `input` | `c9ea8fac45660330` |
| `expected` | `846b2914851e9a29` |

**Vector 3** — [OpenSSL DES_xcbc_encrypt known answer, block 2](https://github.com/openssl/openssl/blob/master/test/destest.c)

| Field | Value |
| --- | --- |
| `key` | `f1e0d3c2b5a497860123456789abcdeffedcba9876543210` |
| `input` | `ca045e34ec6dba5d` |
| `expected` | `54732f8aa0a611c1` |

**Vector 4** — [OpenSSL DES_xcbc_encrypt known answer, block 3](https://github.com/openssl/openssl/blob/master/test/destest.c)

| Field | Value |
| --- | --- |
| `key` | `f1e0d3c2b5a497860123456789abcdeffedcba9876543210` |
| `input` | `3c160ffec9cb74e1` |
| `expected` | `15cdc2d7951b1053` |

**Vector 5** — [OpenSSL DES_xcbc_encrypt known answer, block 4](https://github.com/openssl/openssl/blob/master/test/destest.c)

| Field | Value |
| --- | --- |
| `key` | `f1e0d3c2b5a497860123456789abcdeffedcba9876543210` |
| `input` | `73a2b0f7951b1053` |
| `expected` | `a63c5e03b21aa3c4` |

---

[← All algorithms](../README.md)
