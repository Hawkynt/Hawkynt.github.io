# GOST-28147-89 (EDE) (DarkCrypt)

> Triple GOST 28147-89 in Encrypt-Decrypt-Encrypt composition, from the DarkCrypt Total Commander plugin. The 768-bit key splits into three independent 256-bit GOST subkeys K1/K2/K3; crypt(block) = Encrypt(Decrypt(Encrypt(block,K1),K2),K3). Inner core identical to GOST-28147-89 (DarkCrypt): textbook 32-round Feistel schedule with DarkCrypt's non-standard S-boxes. 64-bit block, 768-bit key.

## Properties

| Property | Value |
| --- | --- |
| Category | Block Ciphers |
| Sub-category | Block Cipher |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Soviet Union cryptographers (base GOST 28147-89); DarkCrypt EDE variant by Alexander Myasnikov |
| Year | 1989 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/block/darkcrypt-gost-ede.js`](../../../algorithms/block/darkcrypt-gost-ede.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 96 bytes (768 bits) |
| Block sizes | 8 bytes (64 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Non-standard S-box | Inner GOST core uses a hardcoded S-box set where one of the four substitution tables is not a bijection; unanalyzed and not recommended for real use. | Use AES or another vetted cipher. |
| Meet-in-the-middle | Triple-EDE constructions built from a 64-bit-block cipher offer materially less than 3x the effective key strength against meet-in-the-middle attacks. | Prefer a modern wide-block cipher such as AES-256. |

## Documentation

- [DarkCrypt plugin (Total Commander PlugRing)](https://totalcmd.net/plugring/darkcrypttc.html)
- [GOST 28147-89 (base algorithm)](https://en.wikipedia.org/wiki/GOST_(block_cipher))
- [EDE (Encrypt-Decrypt-Encrypt) composition](https://en.wikipedia.org/wiki/Triple_DES)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [DarkCrypt Gost-ede — zero key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `input` | `0000000000000000` |
| `expected` | `0b07331dd419cc0d` |

**Vector 2** — [DarkCrypt Gost-ede — incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f` |
| `input` | `0001020304050607` |
| `expected` | `62ca7399b8ce5c4d` |

**Vector 3** — [DarkCrypt Gost-ede — shifted incrementing key/plaintext](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `0102030405060708090a0b0c0d0e0f10 1112131415161718191a1b1c1d1e1f20 2122232425262728292a2b2c2d2e2f30 3132333435363738393a3b3c3d3e3f40 4142434445464748494a4b4c4d4e4f50 5152535455565758595a5b5c5d5e5f60` |
| `input` | `1011121314151617` |
| `expected` | `f43bd1d464fa4345` |

---

[← All algorithms](../README.md)
