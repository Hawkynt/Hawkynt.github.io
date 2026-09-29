# Lake Keyak

> CAESAR competition finalist using Keccak-p[1600,12] in the Motorist mode with a single Piston. Primary recommended variant of the Keyak family with balanced security and performance.

## Properties

| Property | Value |
| --- | --- |
| Category | Authenticated Encryption |
| Sub-category | Authenticated Encryption |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Guido Bertoni, Joan Daemen, Michaël Peeters, Gilles Van Assche, Ronny Van Keer |
| Year | 2016 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/aead/keyak.js`](../../../algorithms/aead/keyak.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 16 bytes (128 bits) to 32 bytes (256 bits) in steps of 8 bytes |
| Tag sizes | 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `SupportsDetached` | No |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [Keyak Specification](https://keccak.team/keyak.html)
- [Keyak v2 Document](https://keccak.team/files/Keyakv2-doc2.2.pdf)
- [CAESAR Competition](https://competitions.cr.yp.to/caesar-submissions.html)

## References

- [Keyak Python Implementation](https://github.com/samvartaka/keyak-python)
- [Keccak Team](https://keccak.team/)
- [Sponges and Engines Paper](https://eprint.iacr.org/2016/028)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Lake Keyak: 3-byte message with metadata, empty nonce](https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt)

| Field | Value |
| --- | --- |
| `key` | `322b241d160f0801faf3ece5ded7d0c9` |
| `nonce` | _(empty)_ |
| `aad` | `414243` |
| `input` | `444546` |
| `expected` | `b60b8e873cfb3393a2b01180bb493b24b53516` |

**Vector 2** — [Lake Keyak: 3-byte message with metadata and 1-byte nonce](https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt)

| Field | Value |
| --- | --- |
| `key` | `332c251e17100902fbf4ede6dfd8d1ca` |
| `nonce` | `f7` |
| `aad` | `414243` |
| `input` | `444546` |
| `expected` | `96c21e0e7ebc5630c61c626624f00f6bbe745d` |

**Vector 3** — [Lake Keyak: 3-byte message with metadata and 2-byte nonce](https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt)

| Field | Value |
| --- | --- |
| `key` | `342d261f18110a03fcf5eee7e0d9d2cb` |
| `nonce` | `995a` |
| `aad` | `414243` |
| `input` | `444546` |
| `expected` | `5058e692a71dae88d4e80116f9e9167071c124` |

**Vector 4** — [Lake Keyak: 169-byte message spanning two blocks, 150-byte nonce, no metadata](https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt)

| Field | Value |
| --- | --- |
| `key` | `dccdbeafa09182736455463728190afb` |
| `nonce` | `55d656d757d858d959da5adb5bdc5cdd 5dde5edf5fe060e161e262e363e464e5 65e666e767e868e969ea6aeb6bec6ced 6dee6eef6ff070f171f272f373f474f5 75f676f777f878f979fa7afb7bfc7cfd 7dfe7eff7f0080018102820383048405 8506860787088809890a8a0b8b0c8c0d 8d0e8e0f8f1090119112921393149415 9516961797189819991a9a1b9b1c9c1d 9d1e9e1f9f20` |
| `aad` | _(empty)_ |
| `input` | `bfb0a192837465564738291a0bfcedde cebfb0a192837465564738291a0bfced ddcebfb0a192837465564738291a0bfc ecddcebfb0a192837465564738291a0b fbecddcebfb0a192837465564738291a 0afbecddcebfb0a19283746556473829 190afbecddcebfb0a192837465564738 28190afbecddcebfb0a1928374655647 3728190afbecddcebfb0a19283746556 463728190afbecddcebfb0a192837465 55463728190afbecdd` |
| `expected` | `cce31783d03068c70a4625663f5f9f70 3d718b32d81f4d2334ee83d3695c8665 b07ae40082fd44ea28dbfe0bde36fc33 68780de260f38d6157920d807fb5d145 1b4d19318266765b3a45c1a52250694a bf4d6a307e2e735aad4d87b20ee48fea 37e2bbb5949dd0baaad734501412f433 c75d11defaed36071ec0beec1e4c4676 f8b043c99fa6baa4dafc5ad4386bf192 5b1e05ca7f3af7d393f3a0f1f688f888 505e8b08456331182364f176345ba37b 07828da7898e9ccb81` |

**Vector 5** — [Lake Keyak: empty message with 193-byte metadata spanning two blocks](https://github.com/samvartaka/keyak-python/blob/master/TestVectors/LakeKeyak.txt)

| Field | Value |
| --- | --- |
| `key` | `05e6c7a8896a4b2c0cedceaf90715233` |
| `nonce` | `5c1dde9f5f20e1a26223e4a56526e7a8 6829eaab6b2cedae6e2ff0b17132f3b4 7435f6b77738f9ba7a3bfcbd7d3effc0 804102c3834405c6864708c9894a0bcc 8c4d0ecf8f5011d2925314d5955617d8 98591adb9b5c1dde9e5f20e1a16223e4 a46526e7a76829eaaa6b2cedad6e2ff0 b07132f3b37435f6b67738f9b97a3bfc bc7d3effbf804102c2834405c5864708 c8894a0bcb8c` |
| `aad` | `2304e5c6a788694a2a0beccdae8f7051 3112f3d4b59677583819fadbbc9d7e5f 3f2001e2c3a48566462708e9caab8c6d 4d2e0ff0d1b29374543516f7d8b99a7b 5b3c1dfedfc0a18262432405e6c7a889 694a2b0cedceaf9070513213f4d5b697 7758391afbdcbd9e7e5f402102e3c4a5 8566472809eacbac8c6d4e2f10f1d2b3 9374553617f8d9ba9a7b5c3d1effe0c1 a18263442506e7c8a8896a4b2c0deecf af9071523314f5d6b69778593a1bfcdd bd9e7f60412203e4c4a5866748290aeb cb` |
| `input` | _(empty)_ |
| `expected` | `a8652fdc09a7d4036ccf04658db6b83f` |

---

[← All algorithms](../README.md)
