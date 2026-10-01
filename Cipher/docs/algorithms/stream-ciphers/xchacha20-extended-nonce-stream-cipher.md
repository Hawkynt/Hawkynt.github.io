# XChaCha20 Extended-Nonce Stream Cipher

> Extended-nonce variant of ChaCha20 providing 192-bit nonces instead of 96-bit. HChaCha20 derives a subkey from the key and the first 16 nonce bytes; ChaCha20 then runs under that subkey with the remaining 8 nonce bytes, so nonces can be chosen at random.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Daniel J. Bernstein (ChaCha20), Frank Denis (XChaCha20) |
| Year | 2018 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/stream/xchacha20.js`](../../../algorithms/stream/xchacha20.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |

## Security

**Status:** not classified — treat as unverified.

Random 192-bit nonces are safe under a single key (a collision is expected only after about 2^96 messages). Provides no integrity on its own: pair it with a MAC, as XChaCha20-Poly1305 does.

No vulnerabilities are recorded for this implementation.

## Documentation

- [draft-irtf-cfrg-xchacha-03: XChaCha](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03)
- [RFC 8439: ChaCha20 and Poly1305 for IETF Protocols](https://www.rfc-editor.org/rfc/rfc8439)

## References

- [libsodium XChaCha20 Implementation](https://github.com/jedisct1/libsodium/blob/master/src/libsodium/crypto_stream/xchacha20/stream_xchacha20.c)
- [libsodium XChaCha20 Test Vectors](https://github.com/jedisct1/libsodium/blob/master/test/default/xchacha20.c)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [draft-irtf-cfrg-xchacha-03 A.3.2.1 XChaCha20 (block counter 0)](https://datatracker.ietf.org/doc/html/draft-irtf-cfrg-xchacha-03#appendix-A.3.2.1)

| Field | Value |
| --- | --- |
| `key` | `808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f` |
| `nonce` | `404142434445464748494a4b4c4d4e4f5051525354555658` |
| `input` | `5468652064686f6c65202870726f6e6f 756e6365642022646f6c652229206973 20616c736f206b6e6f776e2061732074 686520417369617469632077696c6420 …` (304 bytes; the full value is in the source) |
| `expected` | `4559abba4e48c16102e8bb2c05e6947f 50a786de162f9b0b7e592a9b53d0d4e9 8d8d6410d540a1a6375b26d80dace4fa b52384c731acbf16a5923c0c48d3575d …` (304 bytes; the full value is in the source) |

**Vector 2** — [libsodium tv_stream_xchacha20 #1 (29 bytes)](https://github.com/jedisct1/libsodium/blob/master/test/default/xchacha20.c)

| Field | Value |
| --- | --- |
| `key` | `79c99798ac67300bbb2704c95c341e3245f3dcb21761b98e52ff45b24f304fc4` |
| `nonce` | `b33ffd3096479bcfbc9aee49417688a0a2554f8d95389419` |
| `input` | `0000000000000000000000000000000000000000000000000000000000` |
| `expected` | `c6e9758160083ac604ef90e712ce6e75d7797590744e0cf060f013739c` |

**Vector 3** — [libsodium tv_stream_xchacha20 #3 (22 bytes)](https://github.com/jedisct1/libsodium/blob/master/test/default/xchacha20.c)

| Field | Value |
| --- | --- |
| `key` | `3d12800e7b014e88d68a73f0a95b04b435719936feba60473f02a9e61ae60682` |
| `nonce` | `56bed2599eac99fb27ebf4ffcb770a64772dec4d5849ea2d` |
| `input` | `00000000000000000000000000000000000000000000` |
| `expected` | `a2c3c1406f33c054a92760a8e0666b84f84fa3a618f0` |

**Vector 4** — [libsodium tv_stream_xchacha20 #8 (76 bytes, two blocks)](https://github.com/jedisct1/libsodium/blob/master/test/default/xchacha20.c)

| Field | Value |
| --- | --- |
| `key` | `d45e56368ebc7ba9be7c55cfd2da0feb633c1d86cab67cd5627514fd20c2b391` |
| `nonce` | `fd37da2db31e0c738754463edadc7dafb0833bd45da497fc` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 000000000000000000000000` |
| `expected` | `47950efa8217e3dec437454bd6b6a80a 287e2570f0a48b3fa1ea3eb868be3d48 6f6516606d85e5643becc473b370871a b9ef8e2a728f73b92bd98e6e26ea7c8f f96ec5a9e8de95e1eee9300c` |

**Vector 5** — [libsodium tv_stream_xchacha20 #10 (91 bytes, two blocks)](https://github.com/jedisct1/libsodium/blob/master/test/default/xchacha20.c)

| Field | Value |
| --- | --- |
| `key` | `9d23bd4149cb979ccf3c5c94dd217e9808cb0e50cd0f67812235eaaf601d6232` |
| `nonce` | `c047548266b7c370d33566a2425cbf30d82d1eaf5294109e` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 0000000000000000000000` |
| `expected` | `a21209096594de8c5667b1d13ad93f74 4106d054df210e4782cd396fec692d35 15a20bf351eec011a92c367888bc464c 32f0807acd6c203a247e0db854148468 e9f96bee4cf718d68d5f637cbd5a3764 57788e6fae90fc31097cfc` |

---

[← All algorithms](../README.md)
