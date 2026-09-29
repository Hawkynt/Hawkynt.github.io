# Mercy-6 (DarkCrypt)

> Wide-block (4096-bit / 512-byte) 6-round Feistel cipher from the DarkCrypt Total Commander plugin, in the spirit of Crowley and Lucks' Mercy disk-sector cipher. A modified RC4 stream derives a key-dependent 32-bit T-box, tweak-schedule constants and whitening keys; key[16..31] is a fixed tweak.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | ❌ Broken |
| Complexity | Advanced |
| Inventor | Paul Crowley, Stefan Lucks (base Mercy); Tom St Denis (state-machine core); DarkCrypt variant by Alexander Myasnikov |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-mercy.js`](../../../algorithms/block/darkcrypt-mercy.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 32 bytes (256 bits) |
| Block sizes | 512 bytes (4096 bits) |

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Differential Cryptanalysis | The base Mercy design was broken by Scott Fluhrer at FSE 2001 across all six rounds; this non-standard plugin variant is unanalyzed. | Use AES-XTS or another vetted sector cipher. |
| Non-standard variant | Modified RC4 key schedule and DarkCrypt-specific structure; not recommended for real use. | Educational only. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [Mercy: A Fast Large Block Cipher for Disk Sector Encryption (FSE 2000)](https://www.ciphergoth.org/crypto/mercy/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Mercy - zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0000000000000000000000000000000000000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (512 bytes; the full value is in the source) |
| `expected` | `83c9ceaede3dbe73aae4423eebb42efe 268f3033d5d45a7fcd9b308532e7fe0c fc66a401f35755fee980d6669835da96 62169d5423947a488d11735099c6568f …` (512 bytes; the full value is in the source) |

**Vector 2** — [DarkCrypt Mercy - incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f …` (512 bytes; the full value is in the source) |
| `expected` | `7f06feb5db0790abc131d40d5f1be295 3e080cfcd7d09317abff3ada8bf753e4 f716ea9be2a39258489818a288f9d5e0 97d04e86a7f97424c87be629e970c75f …` (512 bytes; the full value is in the source) |

**Vector 3** — [DarkCrypt Mercy - shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20` |
| `input` | `101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f …` (512 bytes; the full value is in the source) |
| `expected` | `546cf3cfdac444e440cb54741ce79be3 f972c330dd2ecbe0c44fbcde08eb99ae ff9a80d6b1ed52b57473a7e56b1e1b77 f1c1db8f158973aee7e1b899d4f3e150 …` (512 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
