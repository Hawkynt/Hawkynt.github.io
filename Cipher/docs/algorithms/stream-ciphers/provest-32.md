# ProVEST-32

> ProVEST-32, the Phase 1 VEST-32 root cipher in its eSTREAM API version: the VEST-32 structure with earlier counters, permutations and output taps, cyclic key loading and sealing constants in bit 0 of the counters. DarkCrypt ships it as Vest32-Pro with 256-bit keys and IVs. BROKEN - superseded by the Phase 2 VEST-32.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | NLFSR Stream Cipher |
| Security status | ❌ Broken |
| Complexity | Expert |
| Inventor | Sean O'Neil, Benjamin Gittins, Howard Landman |
| Year | 2005 |
| Origin | 🌐 International |
| Source | [`algorithms/stream/vest.js`](../../../algorithms/stream/vest.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 2 bytes (16 bits) to 64 bytes (512 bits) |
| Nonce sizes | 0 bytes (0 bits) to 64 bytes (512 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Chosen-IV Inner Collisions](https://www.ecrypt.eu.org/stream/papersdir/2007/021.pdf) | Joux and Reinhard, "Overtaking VEST" (FSE 2007): counter collisions during IV setup combined with a collision in the linear counter diffusor recover 53 bits of the keyed state with about 2^22 to 2^29 IV setups, cutting exhaustive key search by 53 bits; the same collisions forge VEST MACs | DO NOT USE - the designers' later fix is not part of this specification |

## Documentation

- [eSTREAM VEST page (Phase 2)](https://www.ecrypt.eu.org/stream/vestp2.html)
- [VEST ciphers, Phase 2 specification](https://www.ecrypt.eu.org/stream/p2ciphers/vest/vest_p2.pdf)
- [VEST ciphers, Phase 1 specification](https://www.ecrypt.eu.org/stream/ciphers/vest/vest.pdf)
- [Wikipedia: VEST](https://en.wikipedia.org/wiki/VEST)

## References

- [VEST Phase 2 submission source and test vectors](https://www.ecrypt.eu.org/stream/p2ciphers/vest/vest_p2source.zip)
- [ProVEST eSTREAM API sources and test vectors (eSTREAM SVN)](https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/vest/)
- [Archived copy of the eSTREAM VEST page](https://web.archive.org/web/2022/https://www.ecrypt.eu.org/stream/vestp2.html)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ProVEST-32 eSTREAM set 1, vector 0: stream[0..63]](https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/vest/provest-32/unverified.test-vectors?rev=210)

| Field | Value |
| --- | --- |
| `key` | `80000000000000000000000000000000` |
| `iv` | `0000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `035f0f42b1d8a93ec22dd00a5e46840d 093159d99a97049cedf0a2511ea7f920 ca7793603625d772072d2cb0b0595ee6 196a3fbe808c3adf8582581fb0d72ed4` |

**Vector 2** — [ProVEST-32 eSTREAM set 3, vector 0: stream[0..63]](https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/vest/provest-32/unverified.test-vectors?rev=210)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f` |
| `iv` | `0000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `9118cf64a92266e55f3d68137d2a60b3 9ae200765036d0c06a40f77142a7310f 3958cc9d82e350d4215063cc2b841adc 05f8beaebace4ee8eec1c719cb7ad93f` |

**Vector 3** — [ProVEST-32 eSTREAM set 6, vector 0: stream[0..63]](https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/vest/provest-32/unverified.test-vectors?rev=210)

| Field | Value |
| --- | --- |
| `key` | `0053a6f94c9ff24598eb3e91e4378add` |
| `iv` | `0d74db42a91077de` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `1adb4077926109a4d1c25eb0fb283c36 3f7f5f4cb7941590e3596c3555ba5367 74250669f6a54376fff7f25bb0631f45 b062159b2685c70b1c0bd541d098c789` |

**Vector 4** — [ProVEST-32 eSTREAM set 9, vector 0: encryption](https://www.ecrypt.eu.org/stream/svn/viewcvs.cgi/ecrypt/trunk/submissions/vest/provest-32/unverified.test-vectors?rev=210)

| Field | Value |
| --- | --- |
| `key` | `0053a6f94c9ff24598eb3e91e4378add` |
| `iv` | `0d74db42a91077de` |
| `input` | `6dce2f90f152b31475d63798f95abb1c7dde3fa00162c32485e647a8096acb2c` |
| `expected` | `77156fe76333bab0a41469280272872a42a160ecb6f6d6b466bf2b9d5cd0984b` |

**Vector 5** — [DarkCrypt Vest32-Pro, 256-bit key and IV, 1-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `ac643e2c1397b00cbcb2e5bacebe4c32a2decc2193408eccef781f2e04284d18` |
| `iv` | `7b48d886824e4cf1df0a552c8abd5e1c9104330b27fc0d386564f77aff6f1532` |
| `input` | `d8` |
| `expected` | `db` |

**Vector 6** — [DarkCrypt Vest32-Pro, 256-bit key and IV, 44-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `b13ea7ded907d0328f861dfebb1e4643fd2eb8faa5c115e6bb062bc397230c05` |
| `iv` | `f71dbde6db5a7dc751f901507d104053dac79e7580a53db0fb396a0bdbf22c19` |
| `input` | `4a0404992fcff9295795f8d20afb7116 5d961cbfe6ddc2b051b0c505231fdfcb 106c382ce6ec66b9d4d39b15` |
| `expected` | `94b9935bb9610fa2608f882c7d5995c4 38f5ed41802f7f3cf5c1e53b5067a4d9 2839e9e67c6c2bb39896b36d` |

**Vector 7** — [DarkCrypt Vest32-Pro, 256-bit key and IV, 150-byte message (verified against the DarkCrypt implementation)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `bfdff22e378c5fceb9f220319d70e16e1006659804e769542a66c3f3487b517e` |
| `iv` | `3605d37a97da9af4157b820b53c12bd6c93c0b3b3980321426ce5ad1314ce7f7` |
| `input` | `15a1c3f5321768dd66ffd651bd20d2a8 8263033b5cebf03ec087066a2e8610ab 6076ee9682ce495e4b68486fe06e65b4 d8e6be0a44ed361a0130efc9d4751c7e ba184d3b1b33bf2481f43e386857284b 03b82f00a8069c2bd7c2f1cccd6b0764 33d7ed321135caabf68722289cfd5b1b b156d6aba2c7dfa088fc1a6de7f5e421 9d565b207dcbc3373fa8fcbbf1b0e9e8 281e0772b6ab` |
| `expected` | `ec3bb6a53bf539b1c36bebd264797744 407ee54ed95766f4394d3de70212281e cc205fa87b40affa71edc2caa9cb4b02 1e7e030337d69d55bc8a2f17fbdd5a15 e7b95c3231ed61684a85514049bbd861 b834451d8ef35e268cc02b8fe11d02f3 a4c9b722459f40ebf52b0de349025a71 8e52a376b968a43a03b649ba93697b39 f34ec1a8b89c8235e76f547632d4c8b1 280791e6131f` |

---

[← All algorithms](../README.md)
