# HAWK

> Lattice-based hash-and-sign signature over rank-2 module lattices, the round-two submission to the NIST additional signatures process. The secret key is a basis of the lattice, the public key its Gram matrix; signing samples a discrete Gaussian around a hashed target and verifying measures the result in the public quadratic form. Keys, signing and verification follow the reference exactly, including its fixed-point NTRU solver. Withdrawn in 2026 after a lattice-reduction attack; kept for its construction and its published test vectors.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Lattice Digital Signature |
| Security status | ❌ Broken |
| Complexity | Expert |
| Inventor | Joppe W. Bos, Olivier Bronchain, Leo Ducas, Serge Fehr, Yu-Hsuan Huang, Thomas Pornin, Eamonn W. Postlethwaite, Thomas Prest, Ludo N. Pulles, Wessel van Woerden |
| Year | 2022 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/hawk.js`](../../../algorithms/asymmetric/hawk.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 96 bytes (768 bits); 184 bytes (1472 bits); 360 bytes (2880 bits) |

## Parameter sets

- HAWK-256
- HAWK-512
- HAWK-1024

## Security

**Status:** ❌ Broken

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Withdrawn after a lattice-reduction attack](https://hawk-sign.info/) | In July 2026 HAWK was withdrawn from the NIST process after an attack that roughly halves the block size lattice reduction needs to recover an equivalent secret key, well below the claimed security levels; the designers found no competitive repair | Use a standardised signature such as ML-DSA (FIPS 204) or SLH-DSA (FIPS 205) |
| [HAWK-256 is a challenge parameter set](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/spec-files/hawk-spec-round2-web.pdf) | HAWK-256 was never meant to reach a NIST security level and may fail to sign with a probability of about 2^-39.5 per signature | Do not use HAWK-256 for anything but study |
| [Published demonstration keys](https://hawk-sign.info/) | The secret keys in the test vectors are printed in this file, come from published Known Answer Tests and confer no secrecy whatever | Nothing here is usable as a key |

## Documentation

- [HAWK round-two specification](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/spec-files/hawk-spec-round2-web.pdf)
- [HAWK project site](https://hawk-sign.info/)
- [NIST PQC additional digital signature schemes](https://csrc.nist.gov/projects/pqc-dig-sig)
- [Ducas, Postlethwaite, Pulles, van Woerden - Hawk: Module LIP makes Lattice Signatures Fast, Compact and Simple (ASIACRYPT 2022)](https://eprint.iacr.org/2022/1155)

## References

- [HAWK round-two submission package, reference code and KAT files](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)
- [HAWK development repository](https://github.com/hawk-sign/dev)
- [FIPS 202 - SHA-3 and the SHAKE functions](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf)

## Test vectors

27 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [HAWK-256 PQCsignKAT_96.rsp count 0: signing with the secret key replays the published signed message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `key` | `33a8e1741166e78e8d3c4d6938aac623 3d3b4e2958dde1a0ee2cab58be6511d8 31835b6de57933e313bec50b097816c9 dd3307bcc85b27afa7a748bd475fef22 07f746c683aa62c8df3360e6804a19ac b7a1db8058cc2a4c867e0db36709f463` |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c88757e24de80ba8581980f966d55c89 0642a34d0adf7dff6f46b00005d1a3d7 …` (282 bytes; the full value is in the source) |

**Vector 2** — [HAWK-256 PQCsignKAT_96.rsp count 1: key generation from the harness seed, then signing, replays the published signed message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | HAWK-256 |
| `drbgSeed` | `64335bf29e5de62842c941766ba129b0 643b5e7121ca26cfc190ec7dc3543830 557fdd5c03cf123a456d48efea43c868` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (315 bytes; the full value is in the source) |

**Vector 3** — [HAWK-256 PQCsignKAT_96.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `1aa4e965f7fa0ece029050e324ccff5b 64a81a062fd5f2005647d02359294179 ac371a426fa4f1a413501405c191ef20 57051788e5831a02a74053b0a2920143 …` (450 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c88757e24de80ba8581980f966d55c89 0642a34d0adf7dff6f46b00005d1a3d7 …` (282 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 4** — [HAWK-256 PQCsignKAT_96.rsp count 1: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8efafce862ede469e14d54c53226f6c5 44402d92f65c925556a0446fb39a5d76 9085db30e1ba0e48272034b7ca7a68a1 a1028286a6b910bdff04480e4ef818c9 …` (450 bytes; the full value is in the source) |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (315 bytes; the full value is in the source) |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |

**Vector 5** — [HAWK-256 PQCsignKAT_96.rsp count 1: the published signed message opens under the public key rebuilt from the secret key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `key` | `1afd5d58947429edb0f4bef8d99e48ec 4bf0de0d51bc9e83c599eb6c882ec92f a9eebbe84aa989445cc71d9e9baf99b5 2c6ea86bbe32e4a434c8978f91c48362 9f2ac8d601e033364dd4f16f07da449e 36e86f39f0324d23259f50471419f45d` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (315 bytes; the full value is in the source) |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |

**Vector 6** — [HAWK-256 PQCsignKAT_96.rsp count 0: the verdict on the published signed message is acceptance](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `1aa4e965f7fa0ece029050e324ccff5b 64a81a062fd5f2005647d02359294179 ac371a426fa4f1a413501405c191ef20 57051788e5831a02a74053b0a2920143 …` (450 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c88757e24de80ba8581980f966d55c89 0642a34d0adf7dff6f46b00005d1a3d7 …` (282 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 7** — [HAWK-256 PQCsignKAT_96.rsp count 0: the signature must not verify for a message with its first octet changed](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `1aa4e965f7fa0ece029050e324ccff5b 64a81a062fd5f2005647d02359294179 ac371a426fa4f1a413501405c191ef20 57051788e5831a02a74053b0a2920143 …` (450 bytes; the full value is in the source) |
| `message` | `271c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `271c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c88757e24de80ba8581980f966d55c89 0642a34d0adf7dff6f46b00005d1a3d7 …` (282 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 8** — [HAWK-256 PQCsignKAT_96.rsp count 0: a signature with one octet of s1 changed must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `1aa4e965f7fa0ece029050e324ccff5b 64a81a062fd5f2005647d02359294179 ac371a426fa4f1a413501405c191ef20 57051788e5831a02a74053b0a2920143 …` (450 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c88757e24de80ba8581980f966d55c89 0642a34d0adf7d006f46b00005d1a3d7 …` (282 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 9** — [HAWK-256 PQCsignKAT_96.rsp count 0: the signed message must not verify under count 1's public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `8efafce862ede469e14d54c53226f6c5 44402d92f65c925556a0446fb39a5d76 9085db30e1ba0e48272034b7ca7a68a1 a1028286a6b910bdff04480e4ef818c9 …` (450 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c88757e24de80ba8581980f966d55c89 0642a34d0adf7dff6f46b00005d1a3d7 …` (282 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 10** — [HAWK-512 PQCsignKAT_184.rsp count 0: signing with the secret key replays the published signed message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `key` | `0a1315c8585d6afe83cd259ea7ba63ab 84178ef93f45eb4cd8cd503fdb67e704 15b5da5d4c9c84c453d6c3bc4b0585e2 071841a97898b724eb5153a918eb3ae8 ac36f32216474f2cee3ee9cb07e2c4a1 263510153116b416fc23b41541d7daf7 6fb8097bd846583c81a6a89c7e3afa87 1081bfad4474befa790c5545de2d064f 3bbf2d5a651672444760566f67dc92f4 9ab7cb604a746f6bdff976d6fe3b346d 51c51b91a47666351f1cb691ebf58994 3b8a3202a69462a8` |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8cd1d53990f1e3b05ee8ff67dd99574 333561db26f5b19cb94f4dcb1bb4882f …` (588 bytes; the full value is in the source) |

**Vector 11** — [HAWK-512 PQCsignKAT_184.rsp count 1: key generation from the harness seed, then signing, replays the published signed message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | HAWK-512 |
| `drbgSeed` | `64335bf29e5de62842c941766ba129b0 643b5e7121ca26cfc190ec7dc3543830 557fdd5c03cf123a456d48efea43c868` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (621 bytes; the full value is in the source) |

**Vector 12** — [HAWK-512 PQCsignKAT_184.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `b69f8c532d716e830c1165b52138c699 5f4ee35849dd92f7f5c32d1a709e044f f00d80e9188704f289070448dd3e3ba8 97ca09527f700e391cb4174dd27344e5 …` (1024 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8cd1d53990f1e3b05ee8ff67dd99574 333561db26f5b19cb94f4dcb1bb4882f …` (588 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 13** — [HAWK-512 PQCsignKAT_184.rsp count 1: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `50999e765cd8567e1f2a72ca0a530f00 8a4f838a4b27591f61e6a57da862a7bc f05b93e187cfb789a14185be8271f7c3 48270de008dee34832d600e180e2eb13 …` (1024 bytes; the full value is in the source) |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (621 bytes; the full value is in the source) |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |

**Vector 14** — [HAWK-512 PQCsignKAT_184.rsp count 1: the published signed message opens under the public key rebuilt from the secret key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `key` | `c0f8f8308409d690c5a01316a9b077dd 6bbe9adf2cd732c9fa6fe65d87da8b96 779302961528f96217822c1bd5959cc7 8f4f53f6b845a6d5b22fa17325dcadd8 31edf0f918780415d45e5c455dbb909e 4c0d99672e4f148a9c73ce41dbee190c 7ffe6891ea6b6d769570121cad9c6cb0 33d19ec2b79d4411b87e80dd63ee2573 728a535068a7b8f0b674d077932c71af de752420f06ce581c1eed21150630057 d7ff230011dc212bf609fc4b8b505f0b 11990e0598de6d41` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (621 bytes; the full value is in the source) |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |

**Vector 15** — [HAWK-512 PQCsignKAT_184.rsp count 0: the verdict on the published signed message is acceptance](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `b69f8c532d716e830c1165b52138c699 5f4ee35849dd92f7f5c32d1a709e044f f00d80e9188704f289070448dd3e3ba8 97ca09527f700e391cb4174dd27344e5 …` (1024 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8cd1d53990f1e3b05ee8ff67dd99574 333561db26f5b19cb94f4dcb1bb4882f …` (588 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 16** — [HAWK-512 PQCsignKAT_184.rsp count 0: the signature must not verify for a message with its first octet changed](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `b69f8c532d716e830c1165b52138c699 5f4ee35849dd92f7f5c32d1a709e044f f00d80e9188704f289070448dd3e3ba8 97ca09527f700e391cb4174dd27344e5 …` (1024 bytes; the full value is in the source) |
| `message` | `271c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `271c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8cd1d53990f1e3b05ee8ff67dd99574 333561db26f5b19cb94f4dcb1bb4882f …` (588 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 17** — [HAWK-512 PQCsignKAT_184.rsp count 0: a signature with one octet of s1 changed must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `b69f8c532d716e830c1165b52138c699 5f4ee35849dd92f7f5c32d1a709e044f f00d80e9188704f289070448dd3e3ba8 97ca09527f700e391cb4174dd27344e5 …` (1024 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8cd1d53990f1e3b05ee8ff67dd99574 333561db26f5b19cb94f4dcb1bb4882f …` (588 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 18** — [HAWK-512 PQCsignKAT_184.rsp count 0: the signed message must not verify under count 1's public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `50999e765cd8567e1f2a72ca0a530f00 8a4f838a4b27591f61e6a57da862a7bc f05b93e187cfb789a14185be8271f7c3 48270de008dee34832d600e180e2eb13 …` (1024 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8cd1d53990f1e3b05ee8ff67dd99574 333561db26f5b19cb94f4dcb1bb4882f …` (588 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 19** — [HAWK-1024 PQCsignKAT_360.rsp count 0: signing with the secret key replays the published signed message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `key` | `61ee7ec28a59914a778d0592ea722329 b7736a285e9426c14ffe5d3a3947df2f 795cd46045990685227d2e025da989f1 be618ca878f462eb58b916ae35c237e0 …` (360 bytes; the full value is in the source) |
| `drbgSeed` | `061550234d158c5ec95595fe04ef7a25 767f2e24cc2bc479d09d86dc9abcfde7 056a8c266f9ef97ed08541dbd2e1ffa1` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c87a7551d10eda23430ae3896a0002c1 2bc7e2156c7fc2d0efbd37d6a9a33378 …` (1254 bytes; the full value is in the source) |

**Vector 20** — [HAWK-1024 PQCsignKAT_360.rsp count 1: key generation from the harness seed, then signing, replays the published signed message](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `parameterSet` | HAWK-1024 |
| `drbgSeed` | `64335bf29e5de62842c941766ba129b0 643b5e7121ca26cfc190ec7dc3543830 557fdd5c03cf123a456d48efea43c868` |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (1287 bytes; the full value is in the source) |

**Vector 21** — [HAWK-1024 PQCsignKAT_360.rsp count 0: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `d4645c050d7a7c2d5b9452354e9b961a a40d9b1bcb09ebbf52a64fada7106f72 068fd7854a8d84c7c8a3b3a755afd8f2 7e4941c9dd882562f36361a6e73df8f1 …` (2440 bytes; the full value is in the source) |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c87a7551d10eda23430ae3896a0002c1 2bc7e2156c7fc2d0efbd37d6a9a33378 …` (1254 bytes; the full value is in the source) |
| `expected` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |

**Vector 22** — [HAWK-1024 PQCsignKAT_360.rsp count 1: the published signed message opens under the published public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `605253c86e7785b8c8e0cd90a5a38529 24b546b6d8dd6b63a9cb3795f01a5e38 e9e354b3b8cc36721642f4002023b9ac e0d7f588d64a0cb46f2e518da826d9f5 …` (2440 bytes; the full value is in the source) |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (1287 bytes; the full value is in the source) |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |

**Vector 23** — [HAWK-1024 PQCsignKAT_360.rsp count 1: the published signed message opens under the public key rebuilt from the secret key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `key` | `8cbe9660a20e8a7b8d370d52a3f2219f 202045ebbf5f9dff7f2f4b3e6c64771b 3420dd08615ed93c343feefc66eff297 50f21e308803f7c4352327efa601d1bd …` (360 bytes; the full value is in the source) |
| `input` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d …` (1287 bytes; the full value is in the source) |
| `expected` | `225d5ce2ceac61930a07503fb59f7c2f 936a3e075481da3ca299a80f8c5df922 3a073e7b90e02ebf98ca2227eba38c1a b2568209e46dba961869c6f83983b17d cd49` |

**Vector 24** — [HAWK-1024 PQCsignKAT_360.rsp count 0: the verdict on the published signed message is acceptance](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `d4645c050d7a7c2d5b9452354e9b961a a40d9b1bcb09ebbf52a64fada7106f72 068fd7854a8d84c7c8a3b3a755afd8f2 7e4941c9dd882562f36361a6e73df8f1 …` (2440 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c87a7551d10eda23430ae3896a0002c1 2bc7e2156c7fc2d0efbd37d6a9a33378 …` (1254 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 25** — [HAWK-1024 PQCsignKAT_360.rsp count 0: the signature must not verify for a message with its first octet changed](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `d4645c050d7a7c2d5b9452354e9b961a a40d9b1bcb09ebbf52a64fada7106f72 068fd7854a8d84c7c8a3b3a755afd8f2 7e4941c9dd882562f36361a6e73df8f1 …` (2440 bytes; the full value is in the source) |
| `message` | `271c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `271c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c87a7551d10eda23430ae3896a0002c1 2bc7e2156c7fc2d0efbd37d6a9a33378 …` (1254 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 26** — [HAWK-1024 PQCsignKAT_360.rsp count 0: a signature with one octet of s1 changed must not verify](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `d4645c050d7a7c2d5b9452354e9b961a a40d9b1bcb09ebbf52a64fada7106f72 068fd7854a8d84c7c8a3b3a755afd8f2 7e4941c9dd882562f36361a6e73df8f1 …` (2440 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c87a7551d10eda23430ae3896a0002c1 2bc7e2156c7fc2d0efbd37d6a9a33378 …` (1254 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 27** — [HAWK-1024 PQCsignKAT_360.rsp count 0: the signed message must not verify under count 1's public key](https://csrc.nist.gov/csrc/media/Projects/pqc-dig-sig/documents/round-2/submission-pkg/hawk-submission-round2.zip)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `publicKey` | `605253c86e7785b8c8e0cd90a5a38529 24b546b6d8dd6b63a9cb3795f01a5e38 e9e354b3b8cc36721642f4002023b9ac e0d7f588d64a0cb46f2e518da826d9f5 …` (2440 bytes; the full value is in the source) |
| `message` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c8` |
| `input` | `d81c4d8d734fcbfbeade3d3f8a039faa 2a2c9957e835ad55b22e75bf57bb556a c87a7551d10eda23430ae3896a0002c1 2bc7e2156c7fc2d0efbd37d6a9a33378 …` (1254 bytes; the full value is in the source) |
| `expected` | `00` |

---

[← All algorithms](../README.md)
