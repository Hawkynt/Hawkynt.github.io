# BitPerm - Bit Permutation Code Generator

![License](https://img.shields.io/github/license/Hawkynt/Hawkynt.github.io)
![Language](https://img.shields.io/github/languages/top/Hawkynt/Hawkynt.github.io?color=purple)
[![Last Commit](https://img.shields.io/github/last-commit/Hawkynt/Hawkynt.github.io?branch=main)![Activity](https://img.shields.io/github/commit-activity/y/Hawkynt/Hawkynt.github.io?branch=main)](https://github.com/Hawkynt/Hawkynt.github.io/commits/main)
[![GitHub release](https://img.shields.io/github/v/release/Hawkynt/Hawkynt.github.io)](https://github.com/Hawkynt/Hawkynt.github.io/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Hawkynt/Hawkynt.github.io/total)](https://github.com/Hawkynt/Hawkynt.github.io/releases)

> A visual tool for designing bit permutations and generating optimized code for various CPU architectures.

## What It Does

BitPerm helps you create efficient code for rearranging bits within a register. Given a desired bit-to-bit mapping (e.g., "move bit 3 to position 7, bit 0 to position 15"), it generates optimized code using:

- **Shifts** (`<<`, `>>`) - moving bits left or right
- **Rotates** (`rol`, `ror`) - circular bit movement
- **Multiplications** - spreading bits to multiple positions simultaneously
- **BMI2 instructions** (`pext`, `pdep`) - hardware scatter/gather on modern x86
- **SIMD shuffles** (`pshufb`) - byte-level permutations

## Why It Exists

Bit permutations appear frequently in:

- **Cryptographic algorithms** - S-boxes, P-boxes, key scheduling
- **Data compression** - bit interleaving, Morton codes
- **Graphics** - pixel format conversion, texture swizzling
- **Networking** - protocol bit reordering, checksum calculations
- **Embedded systems** - GPIO pin remapping, register packing

Hand-optimizing these operations is tedious and error-prone. BitPerm automates the process while targeting specific CPU capabilities.

## How It Works

### 1. Define Your Mapping

The interface shows two rows of bit positions:

- **Source (Input)**: Original bit positions 0..N-1
- **Target (Output)**: Where each bit should end up

Click a source bit, then click target positions to route it. You can also:

- Force bits to constant 0 or 1
- Mark bits as "don't care" for optimization opportunities
- Invert bits (logical NOT) during routing

### 2. Select Target CPU

Choose from presets organized by category:

**Modern x86/x64:**
- Modern x64 (Haswell+) - full BMI2, SIMD support
- AMD Zen (Ryzen) - fast PSHUFB
- Intel Core 2 / Nehalem - no BMI2, has SSSE3
- Intel Atom - in-order execution

**Legacy x86:**
- Intel Pentium 4 - slow shifts
- Intel Pentium 1 (P5)
- AMD Athlon / Duron
- Intel 486/386/8086

**ARM:**
- ARM Cortex A64 (NEON)
- ARM Cortex M4 - embedded, 32-bit

**Retro 8-bit:**
- Zilog Z80 - no hardware multiply
- MOS 6502 - 8-bit only

**Game Consoles:**
- Sony PlayStation 1 (R3000)
- Nintendo 64 (VR4300)
- Sony PlayStation 3 (Cell) - with SIMD
- Sony PlayStation 5 (Zen 2) - full BMI2

Each preset configures available instructions and their cycle costs. Click the gear icon to fine-tune costs or create a custom preset.

### 3. Generate Code

The solver produces multiple solutions ranked by estimated cycle count:

- **Composite (Greedy)**: Fast heuristic-based solver using shifts, rotates, and multiplies
- **Composite (Exhaustive)**: Optimal tree-search solver using Dijkstra's algorithm (shown when search completes within limits)
- **BMI2 (PEXT/PDEP)**: Two-instruction solution on supporting CPUs
- **PSHUFB**: Byte-level shuffle for aligned permutations
- **LUT**: Lookup table for small bit widths (8/16-bit)

### The Solver Algorithms

#### Greedy Solver

The greedy solver works by iteratively finding the locally best operation:

1. **Shift Analysis**: For each shift amount 0..width-1, count how many remaining bits would be correctly positioned. Differentiate between pure shifts (bits don't wrap) and rotates (bits wrap around).

2. **Multiplication Analysis**: For patterns like "spread one bit to multiple positions" or "gather bits from regular intervals", multiplication can route multiple bits in one operation. The solver computes valid multiplier constants ensuring no bit collisions.

3. **Masking**: After each operation, mask out correctly-routed bits to prevent interference with subsequent operations.

4. **Cost Optimization**: Score each candidate operation by `(bits_routed * 10) - cycle_cost` and pick the best.

#### Exhaustive Solver

The exhaustive solver uses Dijkstra's algorithm to explore all possible operation sequences:

1. **State Space**: Each state is defined by the remaining bits to route.

2. **Operation Generation**: At each state, generate all valid shifts, rotates, and multiplications.

3. **Priority Queue**: States are explored in order of total accumulated cost (cycle count).

4. **Optimal Path**: Finds the truly optimal solution with minimum total cycles.

**Limits**: To prevent exponential blowup, the exhaustive search has hard limits:
- Maximum 10,000 states explored
- Maximum operations = number of bits to route (any more would be suboptimal)
- 5-second timeout

When limits are exceeded, the exhaustive solution is simply not shown (like PEXT on CPUs without BMI2).

## Supported Bit Widths

- 8-bit (byte)
- 16-bit (word)
- 32-bit (dword)
- 64-bit (qword)
- 128-bit (for SIMD contexts)

Available widths depend on the selected CPU preset.

## Output Format

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

## Live Demo

Open [`index.html`](index.html) in any modern browser - no build step required.

## License

Part of the »SynthelicZ« project collection. See repository root for license.
