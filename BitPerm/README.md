# 🔀 BitPerm - Bit Permutation Code Generator

![License](https://img.shields.io/github/license/Hawkynt/Hawkynt.github.io)
![Language](https://img.shields.io/github/languages/top/Hawkynt/Hawkynt.github.io?color=purple)
[![Last Commit](https://img.shields.io/github/last-commit/Hawkynt/Hawkynt.github.io?branch=main)![Activity](https://img.shields.io/github/commit-activity/y/Hawkynt/Hawkynt.github.io?branch=main)](https://github.com/Hawkynt/Hawkynt.github.io/commits/main)
[![GitHub release](https://img.shields.io/github/v/release/Hawkynt/Hawkynt.github.io)](https://github.com/Hawkynt/Hawkynt.github.io/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Hawkynt/Hawkynt.github.io/total)](https://github.com/Hawkynt/Hawkynt.github.io/releases)

> A visual tool for designing bit permutations and generating optimized code for various CPU architectures.

## ⚡ What It Does

BitPerm helps you create efficient code for rearranging bits within a register. Given a desired bit-to-bit mapping (e.g., "move bit 3 to position 7, bit 0 to position 15"), it generates optimized code using:

- ↔️ **Shifts** (`<<`, `>>`) - moving bits left or right
- 🔄 **Rotates** (`rol`, `ror`) - circular bit movement
- ✖️ **Multiplications** - spreading bits to multiple positions simultaneously
- 🎯 **BMI2 instructions** (`pext`, `pdep`) - hardware scatter/gather on modern x86
- 📦 **SIMD shuffles** (`pshufb`) - byte-level permutations

## 🤔 Why It Exists

Bit permutations appear frequently in:

- 🔐 **Cryptographic algorithms** - S-boxes, P-boxes, key scheduling
- 📊 **Data compression** - bit interleaving, Morton codes
- 🎨 **Graphics** - pixel format conversion, texture swizzling
- 🌐 **Networking** - protocol bit reordering, checksum calculations
- 🔧 **Embedded systems** - GPIO pin remapping, register packing

Hand-optimizing these operations is tedious and error-prone. BitPerm automates the process while targeting specific CPU capabilities.

## 🛠️ How It Works

### 1️⃣ Define Your Mapping

The interface shows two rows of bit positions:

- **Source (Input)**: Original bit positions 0..N-1
- **Target (Output)**: Where each bit should end up

Click a source bit, then click target positions to route it. You can also:

- 0️⃣ Force bits to constant 0 or 1
- ❓ Mark bits as "don't care" for optimization opportunities
- 🔃 Invert bits (logical NOT) during routing

### 2️⃣ Select Target CPU

Choose from presets organized by category:

**🖥️ Modern x86/x64:**
- Intel Haswell+ (i5/i7/i9) - full BMI2, SIMD support
- AMD Zen1/2 (Ryzen 1000-2000) - microcoded PEXT/PDEP (~18 cycles)
- AMD Zen3+ (Ryzen 3000+) - native BMI2 (3 cycles)
- Intel Core 2 / Nehalem - no BMI2, has SSSE3
- Intel Atom - in-order execution

**🏛️ Legacy x86:**
- Intel Pentium 4 - slow shifts (no barrel shifter)
- Intel Pentium 1 (P5)
- AMD Athlon / Duron
- Intel 486/386/8086

**📱 ARM & Apple Silicon:**
- ARM Cortex A64 (NEON) - with TBL shuffle, BFI/UBFX, RBIT
- ARM Cortex M4 - embedded, single-cycle multiply
- Apple M1/M2/M3 - ARM64 with NEON

**⚙️ RISC:**
- RISC-V (B extension) - emerging standard with bit manipulation

**🏠 Classic Home Computers:**
- Motorola 68000 (Amiga/Atari ST) - variable shift cost, 70-cycle MUL
- Zilog Z80 - no hardware multiply
- MOS 6502 - 8-bit only

**🎮 Classic Consoles:**
- GameCube/Wii (PowerPC 750) - RLWINM rotate+mask
- Dreamcast (SH-4) - 2-way dual-issue
- Xbox 360 (Xenon) - VMX-128 SIMD

**👾 Retro Consoles:**
- Sony PlayStation 1 (R3000)
- Nintendo 64 (VR4300)
- Sony PlayStation 3 (Cell) - with SIMD

Each preset configures available instructions and their cycle costs. Click the ⚙️ gear icon to fine-tune costs or create a custom preset.

### 3️⃣ Generate Code

The solver produces multiple solutions ranked by estimated cycle count:

- 🚀 **Composite (Greedy)**: Fast heuristic-based solver using shifts, rotates, and multiplies
- 🎯 **Composite (Exhaustive)**: Optimal tree-search solver using Dijkstra's algorithm (shown when search completes within limits)
- ⚡ **BMI2 (PEXT/PDEP)**: Two-instruction solution on supporting CPUs
- 📦 **PSHUFB**: Byte-level shuffle for aligned permutations
- 📋 **LUT**: Lookup table for small bit widths (8/16-bit)

### 🧠 The Solver Algorithms

#### 🏃 Greedy Solver

The greedy solver works by iteratively finding the locally best operation:

1. **Shift Analysis**: For each shift amount 0..width-1, count how many remaining bits would be correctly positioned. Differentiate between pure shifts (bits don't wrap) and rotates (bits wrap around).

2. **Multiplication Analysis**: For patterns like "spread one bit to multiple positions" or "gather bits from regular intervals", multiplication can route multiple bits in one operation. The solver computes valid multiplier constants ensuring no bit collisions.

3. **Masking**: After each operation, mask out correctly-routed bits to prevent interference with subsequent operations.

4. **Cost Optimization**: Score each candidate operation by `(bits_routed * 10) - cycle_cost` and pick the best.

#### 🔍 Exhaustive Solver

The exhaustive solver uses Dijkstra's algorithm to explore all possible operation sequences:

1. **State Space**: Each state is defined by the remaining bits to route.

2. **Operation Generation**: At each state, generate all valid shifts, rotates, and multiplications.

3. **Priority Queue**: States are explored in order of total accumulated cost (cycle count).

4. **Optimal Path**: Finds the truly optimal solution with minimum total cycles.

**⚠️ Limits**: To prevent exponential blowup, the exhaustive search has hard limits:
- Maximum 10,000 states explored
- Maximum operations = number of bits to route (any more would be suboptimal)
- 5-second timeout

When limits are exceeded, the exhaustive solution is simply not shown (like PEXT on CPUs without BMI2).

### 🧱 Building Blocks Library

The solver is built on a modular **Building Blocks Library** - a self-contained collection of bit manipulation primitives. Each block defines:

- ▶️ **apply**: Execute the operation on a bit mask
- ✅ **canRoute**: Check if a source→destination routing is possible
- 🔎 **findRoutings**: Analyze remaining bits and propose valid operations
- 💻 **genCode**: Generate code for the operation

Available building blocks:

| Block | Description | Platforms |
|-------|-------------|-----------|
| `shl` | ⬅️ Logical shift left | All |
| `shr` | ➡️ Logical shift right | All |
| `rol` | 🔄 Rotate left | All with rotate |
| `ror` | 🔃 Rotate right | All with rotate |
| `mul` | ✖️ Integer multiply (bit spreading) | All with multiply |
| `bmi2` | 🎯 PEXT+PDEP combination | Intel Haswell+, AMD Zen+ |
| `pshufb` | 📦 Byte shuffle (SIMD) | SSSE3, AVX, NEON |
| `rlwinm` | 🔁 Rotate + mask (PowerPC) | GameCube, Xbox 360, PS3 |
| `rev` | 🔀 Byte reversal (BSWAP) | 486+, ARM |
| `rbit` | 🪞 Bit reversal | ARM |

Each block includes collision detection, carry-risk analysis, and side-effect tracking for multiply operations.

## 📐 Supported Bit Widths

- 8-bit (byte)
- 16-bit (word)
- 32-bit (dword)
- 64-bit (qword)
- 128-bit (for SIMD contexts)

Available widths depend on the selected CPU preset.

## 📝 Output Format

Generated code uses C-style syntax with helper functions:

```c
// Rotate left
uint32_t result = rol32(x, 5);

// BMI2 extract/deposit
uint64_t temp = pext(x, 0x00FF00FF00FF00FFULL);
return pdep(temp, 0xFF00FF00FF00FF00ULL);

// Composite solution
uint32_t temp = 0;
temp |= (x & 0x0000FF00U) << 8;
temp |= rol32(x & 0x000000FFU, 16);
return temp | 0x80000000U;
```

## 🌐 Live Demo

Open [`index.html`](index.html) in any modern browser - no build step required.

## 🧪 Testing

BitPerm includes a comprehensive test suite for validating the building blocks and solvers. Run tests from the browser console:

```javascript
runBuildingBlockTests()
```

### 📊 Test Coverage

The test suite includes 51 tests across 10 sections:

| Section | Tests | Description |
|---------|-------|-------------|
| ⚙️ Basic Operations | 6 | `shl`, `shr`, `rol`, `ror` apply functions |
| 🎯 Bit Movement Tracking | 4 | Verifies bits land at expected positions |
| 💥 Collision Detection | 4 | Detects multiple sources landing on same destination |
| 🔍 Side Effect Detection | 2 | Identifies unintended bit movements |
| ✅ findRoutings Verification | 5 | Confirms routing reports match actual behavior |
| 📦 Byte-Level Operations | 5 | `pshufb`, `rev`, `rbit` |
| 🔗 Integration | 2 | `generateAllOperations` uses building blocks |
| 🧠 Solver Tests | 5 | `solveExhaustive` for shifts, rotations, swaps |
| 🔀 Complex Permutations | 6 | Swap, identity, duplicate, mixed operations |
| ✖️ Multiply Patterns | 12 | Sparse masks, collision/carry detection |

### 🔧 Helper Functions

Available in the browser console for debugging:

```javascript
// 🔍 Analyze where bits actually land after an operation
analyzeBitMovement(BUILDING_BLOCKS.mul.apply, [0, 1], 8, 5n)
// Returns: { movements: [...], collisions: [...], landingSources: {...} }

// ✅ Verify a block's routing claims match reality
verifyOperationReport(BUILDING_BLOCKS.shl, routeMap, remainingMask, 8, costs)

// 🧱 Access building blocks directly
BUILDING_BLOCKS.mul.apply(0x0Fn, 8, 5n)  // Multiply 0x0F by 5
```

## 📄 License

Part of the »SynthelicZ« project collection. See repository root for license.
