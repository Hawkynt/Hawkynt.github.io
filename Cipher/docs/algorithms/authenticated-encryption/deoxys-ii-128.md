# Deoxys-II-128

> CAESAR in-depth security portfolio winner with nonce-misuse resistance. Uses 128-bit keys with Deoxys-BC-256 tweakable block cipher based on AES rounds.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Jérémy Jean, Ivica Nikolić, Thomas Peyrin, Yannick Seurin |
| Year | 2016 |
| Origin | 🌐 International |
| Source | [`algorithms/aead/deoxys-ii.js`](../../../algorithms/aead/deoxys-ii.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Deoxys Official Website](https://sites.google.com/view/deoxyscipher)
- [The Deoxys AEAD Family (Journal of Cryptology 2021)](https://link.springer.com/article/10.1007/s00145-021-09397-w)
- [CAESAR Submission v1.43](https://competitions.cr.yp.to/round3/deoxysv141.pdf)

## References

- [Deoxys-II Reference Implementation (Oasis Protocol, Go)](https://github.com/oasisprotocol/deoxysii)
- [Deoxys-II JavaScript Implementation (Oasis Protocol)](https://github.com/oasisprotocol/deoxysii-js)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Deoxys-II-128: Empty plaintext, empty AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `97d951f2fd129001483e831f2a6821e9` |

**Vector 2** — [Deoxys-II-128: Empty plaintext, 32-byte AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | _(empty)_ |
| `expected` | `3c197ca5317af5a2b95b178a60553132` |

**Vector 3** — [Deoxys-II-128: Empty plaintext, 33-byte AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | `a754f3387be992ffee5bee80e18b1519 00c6d69ec59786fb12d2eadb0750f82c f5` |
| `input` | _(empty)_ |
| `expected` | `0a989ed78fa16776cd6c691ea734d874` |

**Vector 4** — [Deoxys-II-128: 32-byte plaintext, empty AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `fa22f8eb84ee6d2388bdb16150232e85 6cd5fa3508bc589dad16d284208048c9 a381b06ef16db99df089e738c3b4064a` |

**Vector 5** — [Deoxys-II-128: 33-byte plaintext, empty AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | _(empty)_ |
| `input` | `06ac1756eccece62bd743fa80c299f7b aa3872b556130f52265919494bdc136d b3` |
| `expected` | `82bf241958b324ed053555d23315d3cc 20935527fc970ff34a9f521a95e30213 6d0eadc8612d5208c491e93005195e97 69` |

**Vector 6** — [Deoxys-II-128: 32-byte plaintext, 16-byte AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `9cdb554dfc03bff4feeb94df77360383 61a76532b6b5a9c0bdb64a74dee983ff bc1a7b5b8e961e65ceff6877ef9e4a98` |

**Vector 7** — [Deoxys-II-128: 33-byte plaintext, 17-byte AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_128.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | `000102030405060708090a0b0c0d0e0f10` |
| `input` | `039ca0907aa315a0d5ba020c84378840 023d4ad3ba639787d3f6f46cb446bd63 dc` |
| `expected` | `801f1b81878faca562c8c6c0859b166c 2669fbc54b1784be637827b4905729bd f9fe4e9bcd26b96647350eda1e550cc9 94` |

---

[← All algorithms](../README.md)
