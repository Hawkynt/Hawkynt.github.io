# Webino (DarkCrypt)

> Block cipher from the DarkCrypt Total Commander plugin built directly on the MD5 compression function (RFC 1321 F/G/H/I, rotate amounts and T-constants unmodified): 64 rounds keyed by 64 independent S-box-derived round words (replacing MD5's reused message schedule) with additive input / XOR output whitening. 128-bit block, 512-bit key. No public specification exists.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Ronald Rivest (MD5 compression function); DarkCrypt keying by Alexander Myasnikov ("Zarya" project) |
| Year | 2009 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-webino.js`](../../../algorithms/block/darkcrypt-webino.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 64 bytes (512 bits) |
| Block sizes | 16 bytes (128 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard, unanalyzed construction | Repurposes the MD5 compression function as a keyed block-cipher round function; this construction has no public cryptanalysis and MD5 itself is broken as a hash. Not recommended for real use. | Use AES or another vetted cipher. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [RFC 1321: The MD5 Message-Digest Algorithm](https://www.rfc-editor.org/rfc/rfc1321)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Webino — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `00000000000000000000000000000000` |
| `expected` | `5508f336d544c3269b7fca2e54b858e2` |

**Vector 2** — [DarkCrypt Webino — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `input` | `000102030405060708090a0b0c0d0e0f` |
| `expected` | `d80cd7e3ab47bab627e71791bdc76f43` |

**Vector 3** — [DarkCrypt Webino — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40` |
| `input` | `101112131415161718191a1b1c1d1e1f` |
| `expected` | `edf6153e42a3c1eb3edaa3676708cb64` |

---

[← All algorithms](../README.md)
