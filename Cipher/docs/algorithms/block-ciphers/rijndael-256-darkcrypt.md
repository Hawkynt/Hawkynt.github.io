# Rijndael-256 (DarkCrypt)

> Original Rijndael specification generalized to an 8-column state: 256-bit block, 256-bit key, 14 rounds, ShiftRow offsets {0,1,3,4} (per the original Rijndael proposal, not AES's fixed {0,1,2,3}). As implemented in the DarkCrypt Total Commander plugin.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Joan Daemen, Vincent Rijmen |
| Year | 1998 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/block/darkcrypt-rijndael256.js`](../../../algorithms/block/darkcrypt-rijndael256.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 32 bytes (256 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard block size | 256-bit-block Rijndael was not selected as AES and has seen far less cryptanalytic scrutiny than the standardized 128-bit-block variant. | Use standard AES for interoperable, well-analyzed deployments. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [AES overview (Wikipedia)](https://en.wikipedia.org/wiki/Advanced_Encryption_Standard)
- [Rijndael submission to the AES competition](https://csrc.nist.gov/projects/block-cipher-techniques/aes-development)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Extended Rijndael KAT (Gladman), ecbvk88.txt: 256-bit block, 256-bit key, variable-key test 1](https://web.archive.org/web/20110817073104if_/http://gladman.plushost.co.uk/oldsite/cryptography_technology/rijndael/rijn.tv.ecbvk.zip)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `c6227e7740b7e53b5cb77865278eab0726f62366d9aabad908936123a1fc8af3` |

**Vector 2** — [DarkCrypt Rijndael256 — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `expected` | `c6227e7740b7e53b5cb77865278eab0726f62366d9aabad908936123a1fc8af3` |

**Vector 3** — [DarkCrypt Rijndael256 — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `expected` | `623d2bd4ca3796dc3d02ecf2f37fb637fd3da58509cebb67ab9265b04db51e7d` |

**Vector 4** — [DarkCrypt Rijndael256 — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f` |
| `expected` | `97601be3b33cf4e6c9babb4601e25b0495026f30a0485dedb25169fed35933d9` |

---

[← All algorithms](../README.md)
