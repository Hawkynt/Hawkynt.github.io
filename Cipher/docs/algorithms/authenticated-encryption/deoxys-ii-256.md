# Deoxys-II-256

> CAESAR in-depth security portfolio winner with nonce-misuse resistance. Uses 256-bit keys with Deoxys-BC-384 tweakable block cipher based on AES rounds.

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
| Key sizes | 32 bytes (256 bits) |
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

**Vector 1** — [Deoxys-II-256: Empty plaintext, empty AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | _(empty)_ |
| `input` | _(empty)_ |
| `expected` | `2b97bd77712f0cde975309959dfe1d7c` |

**Vector 2** — [Deoxys-II-256: Empty plaintext, 32-byte AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | _(empty)_ |
| `expected` | `54708ae5565a71f147bdb94d7ba3aed7` |

**Vector 3** — [Deoxys-II-256: Empty plaintext, 33-byte AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | `f495c9c03d29989695d98ff5d4306501 25805c1e0576d06f26cbda42b1f82238 b8` |
| `input` | _(empty)_ |
| `expected` | `3277689dc4208cc1ff59d15434a1baf1` |

**Vector 4** — [Deoxys-II-256: 32-byte plaintext, empty AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | _(empty)_ |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `9da20db1c2781f6669257d87e2a4d9be 1970f7581bef2c995e1149331e5e8cc1 92ce3aec3a4b72ff9eab71c2a93492fa` |

**Vector 5** — [Deoxys-II-256: 33-byte plaintext, empty AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | _(empty)_ |
| `input` | `15cd77732f9d0c4c6e581ef400876ad9 188c5b8850ebd38224da95d7cdc99f7a cc` |
| `expected` | `e5ffd2abc5b459a73667756eda6443ed e86c0883fc51dd75d22bb14992c68461 8c5fa78d57308f19d0252072ee39df5e cc` |

**Vector 6** — [Deoxys-II-256: 32-byte plaintext, 16-byte AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | `000102030405060708090a0b0c0d0e0f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `109f8a168b36dfade02628a9e129d525 7f03cc7912aefa79729b67b186a2b08f 6549f9bf10acba0a451dbb2484a60d90` |

**Vector 7** — [Deoxys-II-256: 33-byte plaintext, 17-byte AAD](https://github.com/RustCrypto/AEADs/blob/master/deoxys/tests/deoxys_ii_256.rs)

| Field | Value |
| --- | --- |
| `key` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `nonce` | `202122232425262728292a2b2c2d2e` |
| `aad` | `000102030405060708090a0b0c0d0e0f10` |
| `input` | `422857fb165af0a35c03199fb895604d ca9cea6d788954962c419e0d5c225c03 27` |
| `expected` | `7d772203fa38be296d8d20d805163130 c69aba8cb16ed845c2296c61a8f34b39 4e0b3f10e3933c78190b24b33008bf80 e9` |

---

[← All algorithms](../README.md)
