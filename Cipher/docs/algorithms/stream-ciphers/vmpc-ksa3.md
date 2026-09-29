# VMPC-KSA3

> Enhanced VMPC variant with modified Key Scheduling Algorithm using three 768-round mixing phases (key-IV-key). Provides increased security margin through additional key scrambling after IV initialization.

## Properties

| Property | Value |
| --- | --- |
| Category | Stream Ciphers |
| Sub-category | Stream Cipher |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Bartosz Zoltak |
| Year | 2006 |
| Origin | Not specified |
| Source | [`algorithms/stream/vmpcksa3.js`](../../../algorithms/stream/vmpcksa3.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 1 byte (8 bits) to 256 bytes (2048 bits) |
| Nonce sizes | 1 byte (8 bits) to 768 bytes (6144 bits) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Cryptanalysis | VMPC-KSA3 has received less cryptanalytic attention compared to established stream ciphers | Use only after thorough security review for your specific use case |

## Documentation

- [VMPC Specification](http://www.vmpcfunction.com/vmpc.pdf)
- [eSTREAM Project](https://www.ecrypt.eu.org/stream/)

## References

- [BouncyCastle VMPCKSA3Engine.java Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/VMPCKSA3Engine.java)
- [Author's Own C/Pascal/Assembler Implementations](http://www.vmpcfunction.com/cipher.htm)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BouncyCastle VMPC-KSA3 Test Vector - First 4 keystream bytes](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCKSA3Test.java)

| Field | Value |
| --- | --- |
| `key` | `9661410ab797d8a9eb767c21172df6c7` |
| `iv` | `4b5c2f003e67f39557a8d26f3da2b155` |
| `input` | `00000000` |
| `expected` | `b6ebaefe` |

**Vector 2** — [BouncyCastle VMPC-KSA3 Test Vector - First 256 bytes (positions 252-255)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCKSA3Test.java)

| Field | Value |
| --- | --- |
| `key` | `9661410ab797d8a9eb767c21172df6c7` |
| `iv` | `4b5c2f003e67f39557a8d26f3da2b155` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `b6ebaefeb990f26462d3df13612699d6 9852ea06c806bdc238715e73b4aa1bec efefa17343a5005b032a1fe8dd057875 14008df74d7d66408c452c696bba2256 1d8384e6b2e221cb910bd4994a9b15f7 a673b94a2a314c85a56a1bf50c611254 dfb6d3554ee08e90aa543e396e3ca64c 190a2435299f5c6fc8d88ea656a13d89 6f1735bd2be91225ff3b85618623a99e e520fd8d5ddbfc5724bcab3f131d5563 1cdce9ef4f5099ee0116e3ccf4987468 7dfa3d4bb13b1cf4f63ad1e94abc562c 1f5a6d5b1bacf9416add318b0b3b3592 1aa101eb4d40772cb4c9ea0d20205b3c 6154b3b5c7cf48d3c80d9e3501e6ee2b e8d74bb4d6a9388d0e32123048172473` |

**Vector 3** — [BouncyCastle VMPC-KSA3 Test Vector - First 1024 bytes (positions 1020-1023)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/VMPCKSA3Test.java)

| Field | Value |
| --- | --- |
| `key` | `9661410ab797d8a9eb767c21172df6c7` |
| `iv` | `4b5c2f003e67f39557a8d26f3da2b155` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (1024 bytes; the full value is in the source) |
| `expected` | `b6ebaefeb990f26462d3df13612699d6 9852ea06c806bdc238715e73b4aa1bec efefa17343a5005b032a1fe8dd057875 14008df74d7d66408c452c696bba2256 …` (1024 bytes; the full value is in the source) |

**Vector 4** — [DarkCrypt Vmpcksa3 - 128-byte keystream (key=00..3F, IV=00)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `iv` | `00` |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `c3797e46d1b54a9707eee65f959e3dbe 9e7ddcb58fe52cc08b499ce32827b337 53b92509203fc78da3639ff47e3ea746 12981d425acb95408f907696b5b17247 946099f1182c64615ca2cff19700af9e bc8da907047b650e864edf5d24bf7fcf 5f650e2df707046a574f9be149152233 c1daf7b5f6e1fa817d375ee1d1049d26` |

**Vector 5** — [DarkCrypt Vmpcksa3 - enc of 00..3F (key=00..3F, IV=00)](https://totalcmd.net/plugring/darkcrypttc.html)

| Field | Value |
| --- | --- |
| `key` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `iv` | `00` |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f` |
| `expected` | `c3787c45d5b04c900fe7ec54999333b1 8e6ccea69bf03ad7935086f8343aad28 7398072a041ae1aa8b4ab5df52138969 22a92f716efea377b7a94cad898c4c78` |

---

[← All algorithms](../README.md)
