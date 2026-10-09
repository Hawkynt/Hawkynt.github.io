# Cipher Coding Plugins - Multi-Language Code Generation Engine

> Transform cryptographic algorithm implementations from JavaScript into **15 programming languages** through a powerful AST-based transformation pipeline with type inference.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [The Two-Phase Parser](#the-two-phase-parser)
- [Plugin Architecture](#plugin-architecture)
- [AST Pipeline Deep Dive](#ast-pipeline-deep-dive)
- [JavaScript Pattern Handling](#javascript-pattern-handling)
- [File Structure](#file-structure)
- [Creating a New AST Pipeline Plugin](#creating-a-new-ast-pipeline-plugin)
- [Testing](#testing)
- [Supported Languages](#supported-languages)

---

## Architecture Overview

The code generation system uses a **six-stage pipeline** that parses JavaScript source code, builds an intermediate representation with types, and transforms it into target language code.

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE CODE GENERATION PIPELINE                               │
├───────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│  JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer          │
│                                                    ↓                                   │
│                              Language Source ← Language Emitter ← Language AST         │
│                                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │    JS    │  │  JS AST  │  │  IL AST  │  │ Language │  │ Language │  │ Language │   │
│  │  Source  │─>│ (Plain)  │─>│ (Typed)  │─>│   AST    │─>│  Source  │─>│   Code   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       │             │             │             │             │             │          │
│       ▼             ▼             ▼             ▼             ▼             ▼          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │  Parser  │  │    IL    │  │ Language │  │ Language │  │  Final   │                 │
│  │          │  │Transformer│  │Transformer│  │ Emitter  │  │  Output  │                 │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘                 │
│                                                                                        │
│  ══════════════════════════════════════════════════════════════════════════════════   │
│   STAGE 1      STAGE 2        STAGE 3         STAGE 4         STAGE 5      STAGE 6    │
│   Parsing    JS AST Build   IL Transform   Lang Transform   Lang Emission   Output    │
│                                                                                        │
│  └─────────────────────────────────────┘  └────────────────────────────────────────┘  │
│         Global Options Applied               Language Options Applied                  │
│                                                                                        │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Terminology

- **JS AST** - Plain JavaScript Abstract Syntax Tree (direct parse of JS syntax)
- **IL AST** - Intermediate Language AST (type-inferred, language-agnostic - no JS-specific constructs like UMD, IIFE, Math.*, Object.*, etc.)
- **Language AST** - Language-specific AST (Rust, Go, Java, etc.) with constructs native to the target language
- **Global Options** - Applied during IL transformation (affect all languages)
- **Language Options** - Applied during Language Transformer and Language Emitter (language-specific)

### What Plugins Receive: The IL AST

Language plugins receive the **IL AST**, not the raw JS AST. The IL AST has:

- **Type annotations** on expressions, variables, parameters, and return values
- **Flattened method definitions** (prototype assignments, object methods → unified format)
- **Unwrapped module patterns** (IIFE, UMD, CommonJS wrappers removed)
- **Resolved constants** (IIFE-computed values extracted)

---

## The Two-Phase Parser

The `TypeAwareJSASTParser` in `type-aware-transpiler.js` performs two distinct phases:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     TypeAwareJSASTParser: TWO-PHASE PROCESS                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  PHASE 1: JavaScript Parsing (JS AST)                                           │
│  ════════════════════════════════════                                           │
│                                                                                  │
│  Input: Raw JavaScript source code                                              │
│  Output: Plain JS AST (syntax tree only, no type information)                   │
│                                                                                  │
│  Steps:                                                                          │
│  1. Tokenization - Break source into tokens (identifiers, operators, etc.)      │
│  2. Parsing - Build syntax tree from tokens                                     │
│  3. Comment extraction - Capture JSDoc comments for Phase 2                     │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  JavaScript Source                    JS AST (Plain)                    │    │
│  │  ──────────────────                   ──────────────                    │    │
│  │                                                                          │    │
│  │  class AES {                          {                                 │    │
│  │    encrypt(data) {                      type: "ClassDeclaration",       │    │
│  │      return data;         ────────>     id: { name: "AES" },            │    │
│  │    }                                    body: { body: [...] }           │    │
│  │  }                                    }                                 │    │
│  │                                       (no type information yet)         │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                        │                                        │
│                                        ▼                                        │
│  PHASE 2: IL Building (IL AST)                                                  │
│  ═════════════════════════════                                                  │
│                                                                                  │
│  Input: JS AST + JSDoc comments + source context                                │
│  Output: IL AST (with types and flattened structures)                           │
│                                                                                  │
│  Steps:                                                                          │
│  1. Type inference - Add typeAnnotation to all typed nodes                      │
│  2. Syntax flattening - Normalize different method definition styles            │
│  3. Module unwrapping - Extract content from IIFE/UMD wrappers                  │
│  4. Constant resolution - Evaluate IIFE-computed constants                      │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  JS AST (Plain)                       IL AST (Typed + Flattened)        │    │
│  │  ──────────────                       ─────────────────────────         │    │
│  │                                                                          │    │
│  │  {                                    {                                 │    │
│  │    type: "ClassDeclaration",            type: "ClassDeclaration",       │    │
│  │    id: { name: "AES" },                 id: { name: "AES" },            │    │
│  │    body: {                  ────────>   body: {                         │    │
│  │      body: [{                             body: [{                      │    │
│  │        type: "MethodDefinition",            type: "MethodDefinition",   │    │
│  │        key: { name: "encrypt" },            key: { name: "encrypt" },   │    │
│  │        value: {                             value: {                    │    │
│  │          params: [{ name: "data" }]           params: [{                │    │
│  │        }                                        name: "data",           │    │
│  │      }]                                         typeAnnotation: {       │    │
│  │    }                                              name: "byte[]"        │    │
│  │  }                                              }                       │    │
│  │                                               }],                       │    │
│  │  (no types)                                   returnType: {             │    │
│  │                                                 name: "byte[]"          │    │
│  │                                               }                         │    │
│  │                                             }                           │    │
│  │                                           }]                            │    │
│  │                                         }                               │    │
│  │                                       }                                 │    │
│  │                                       (with types!)                     │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Phase 2: IL Building Details

Type information is inferred from multiple sources:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          TYPE INFERENCE SOURCES                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ 1. JSDoc Comments (Highest Priority)                                    │    │
│  ├─────────────────────────────────────────────────────────────────────────┤    │
│  │                                                                          │    │
│  │   /** @param {byte[]} key - The encryption key */                       │    │
│  │   /** @returns {dword} - Packed 32-bit value */                         │    │
│  │   /** @type {uint32} */                                                 │    │
│  │                                                                          │    │
│  │   Recognized types: byte, word, dword, qword, sbyte, short, int, long,  │    │
│  │                     float, double, uint8, uint16, uint32, uint64,       │    │
│  │                     byte[], dword[], string, boolean, void              │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ 2. OpCodes Library Signatures                                           │    │
│  ├─────────────────────────────────────────────────────────────────────────┤    │
│  │                                                                          │    │
│  │   OpCodes.RotL32(value, bits)  → returns dword                          │    │
│  │   OpCodes.Pack32BE(b0,b1,b2,b3) → returns dword                         │    │
│  │   OpCodes.Hex8ToBytes(hex)     → returns byte[]                         │    │
│  │                                                                          │    │
│  │   Signatures loaded from OpCodes.js JSDoc at initialization             │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ 3. Variable Name Patterns                                               │    │
│  ├─────────────────────────────────────────────────────────────────────────┤    │
│  │                                                                          │    │
│  │   Pattern                    Inferred Type                              │    │
│  │   ─────────────────────────  ─────────────────                          │    │
│  │   key, Key                   byte[]                                     │    │
│  │   iv, IV, nonce              byte[]                                     │    │
│  │   block, Block, data         byte[]                                     │    │
│  │   state, State               dword[]                                    │    │
│  │   sbox, SBox                 byte[]                                     │    │
│  │   index, length, size        int                                        │    │
│  │   byte, b0, b1               byte                                       │    │
│  │   word, w0, w1               word                                       │    │
│  │   temp, mask                 dword                                      │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ 4. TypedArray Constructors                                              │    │
│  ├─────────────────────────────────────────────────────────────────────────┤    │
│  │                                                                          │    │
│  │   new Uint8Array(...)   → byte[]                                        │    │
│  │   new Uint16Array(...)  → word[]                                        │    │
│  │   new Uint32Array(...)  → dword[]                                       │    │
│  │   new Int8Array(...)    → sbyte[]                                       │    │
│  │   new Int32Array(...)   → int[]                                         │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ 5. Literal Value Analysis                                               │    │
│  ├─────────────────────────────────────────────────────────────────────────┤    │
│  │                                                                          │    │
│  │   0-255           → byte                                                │    │
│  │   0-65535         → word                                                │    │
│  │   0-4294967295    → dword                                               │    │
│  │   0x prefix       → appropriate unsigned type based on value            │    │
│  │   true/false      → boolean                                             │    │
│  │   "string"        → string                                              │    │
│  │                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Syntax Flattening in IL AST

JavaScript has multiple ways to define the same thing. The IL AST normalizes these:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SYNTAX FLATTENING EXAMPLES                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Different JS Syntaxes                    Unified IL AST Representation          │
│  ────────────────────                     ─────────────────────────────          │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ METHOD DEFINITIONS                                                        │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │  class Foo {                                                              │  │
│  │    method1() { }              ─┐                                          │  │
│  │  }                             │      All become:                         │  │
│  │                                │      {                                   │  │
│  │  Foo.prototype.method2 =       ├───>    type: "MethodDefinition",         │  │
│  │    function() { }              │        key: { name: "methodN" },         │  │
│  │                                │        value: { body: {...} }            │  │
│  │  const obj = {                 │      }                                   │  │
│  │    method3: function() { }    ─┘                                          │  │
│  │  }                                                                        │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ CONSTANT DEFINITIONS                                                      │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │  const SBOX = [1, 2, 3];      ─┐                                          │  │
│  │                                │      Both become:                        │  │
│  │  const SBOX = (function() {    │      {                                   │  │
│  │    const arr = [];             ├───>    type: "VariableDeclaration",      │  │
│  │    // compute values           │        declarations: [{                  │  │
│  │    return arr;                 │          id: { name: "SBOX" },           │  │
│  │  })();                        ─┘          init: { /* resolved value */ }  │  │
│  │                                         }]                                │  │
│  │                                       }                                   │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ MODULE PATTERNS                                                           │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │  (function(global) {                                                      │  │
│  │    'use strict';                       Wrapper removed, inner content     │  │
│  │    class Algorithm { ... }    ────>    extracted directly:                │  │
│  │    module.exports = Algorithm;         { type: "ClassDeclaration", ... }  │  │
│  │  })(globalThis);                                                          │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## From IL AST to Language Source

### Stage 4: Transformation (Language-Specific)

The transformer converts the **IL AST** to a **language-specific Language AST**:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     TRANSFORMER RESPONSIBILITIES                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  The transformer handles SEMANTIC conversions:                                  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. IL Type → Target Type Mapping                                          │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │   IL AST Type         Rust          Go          Java         C#           │  │
│  │   ───────────         ────          ──          ────         ──           │  │
│  │   byte                u8            uint8       byte         byte         │  │
│  │   word                u16           uint16      short        ushort       │  │
│  │   dword               u32           uint32      int          uint         │  │
│  │   qword               u64           uint64      long         ulong        │  │
│  │   byte[]              Vec<u8>       []uint8     byte[]       byte[]       │  │
│  │   dword[]             Vec<u32>      []uint32    int[]        uint[]       │  │
│  │   boolean             bool          bool        boolean      bool         │  │
│  │   string              String        string      String       string       │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ 2. Name Convention Conversion                                             │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │   IL AST Name        Rust               Go              Python            │  │
│  │   ───────────        ────               ──              ──────            │  │
│  │   encryptBlock       encrypt_block      EncryptBlock    encrypt_block     │  │
│  │   AES                Aes                AES             AES               │  │
│  │   SBOX               SBOX               SBOX            SBOX              │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ 3. Semantic Mapping (IL Class → Language Constructs)                      │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                            │  │
│  │   IL AST Class                   Target Language                          │  │
│  │   ────────────                   ───────────────                          │  │
│  │   ClassDeclaration "AES"                                                  │  │
│  │           │                                                               │  │
│  │           ├──► Rust:   struct Aes { } + impl Aes { }                     │  │
│  │           ├──► Go:     type Aes struct { } + func (a *Aes) Method() { }  │  │
│  │           ├──► Java:   public class AES { }                               │  │
│  │           ├──► Python: class AES: ...                                     │  │
│  │           └──► C++:    class AES { };                                     │  │
│  │                                                                            │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Stage 5: Emission (Language-Specific)

The emitter converts the **Language AST** to the final Language Source code:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        EMITTER RESPONSIBILITIES                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  The emitter handles SYNTACTIC concerns:                                        │
│                                                                                  │
│  • Keyword generation (fn, func, def, void, etc.)                              │
│  • Operator syntax (+, +=, ++, etc.)                                           │
│  • Delimiter placement ({ }, begin/end, indentation)                           │
│  • Doc comment formatting (///, /**, #, ''')                                   │
│  • Import/use statement generation                                             │
│  • Operator precedence and parenthesization                                    │
│  • Language-specific idioms (derives, decorators, annotations)                 │
│                                                                                  │
│  Does NOT care about: JavaScript semantics, type inference                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Plugin Architecture

All 15 language plugins use the full AST pipeline architecture:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         AST PIPELINE ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  4 files per language:                                                          │
│  ├── XXX.js           Plugin entry point, coordinates pipeline                  │
│  ├── XXXAST.js        Language-specific AST node definitions                    │
│  ├── XXXTransformer.js IL AST → Language AST                                    │
│  └── XXXEmitter.js    Language AST → Language Source                            │
│                                                                                  │
│  All 15 Languages:                                                              │
│  Basic, C, C++, C#, Delphi, Go, Java, JavaScript, Kotlin,                      │
│  Perl, PHP, Python, Ruby, Rust, TypeScript                                      │
│                                                                                  │
│  ✅ Full type preservation through pipeline                                     │
│  ✅ Handles all 16 statement types, 19 expression types                        │
│  ✅ 100% transformer coverage across all languages                              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## AST Pipeline Deep Dive

### The Four Files Per Language

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        COMPONENT ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐                                                            │
│  │   RustAST.js    │  AST Node Definitions                                      │
│  ├─────────────────┤  ────────────────────                                      │
│  │                 │                                                            │
│  │  • RustModule   │  Root node containing all code                             │
│  │  • RustStruct   │  Struct definitions                                        │
│  │  • RustImpl     │  Implementation blocks                                     │
│  │  • RustFunction │  Function/method definitions                               │
│  │  • RustType     │  Type representations (u8, Vec<T>, etc.)                   │
│  │  • RustBlock    │  Code blocks { ... }                                       │
│  │  • RustLiteral  │  Literal values (numbers, strings)                         │
│  │  • RustConst    │  Constant declarations                                     │
│  │  • ...          │  Statements, expressions, etc.                             │
│  │                 │                                                            │
│  └────────┬────────┘                                                            │
│           │                                                                      │
│           │ uses                                                                 │
│           ▼                                                                      │
│  ┌─────────────────┐                                                            │
│  │ RustTransformer │  IL AST → Rust AST (Language AST)                          │
│  ├─────────────────┤  ──────────────────────────────                            │
│  │                 │                                                            │
│  │  transform()    │  Entry point - transforms entire program                   │
│  │  ├─ transformClassDeclaration()   → RustStruct + RustImpl                    │
│  │  ├─ transformMethodDefinition()   → RustFunction                             │
│  │  ├─ transformVariableDeclaration()→ RustLet / RustConst                      │
│  │  ├─ transformStatement()          → Various statement nodes                  │
│  │  ├─ transformExpression()         → Various expression nodes                 │
│  │  ├─ mapType()                     → IL type → RustType                       │
│  │  └─ inferTypeFromValue()          → Literal → RustType                       │
│  │                 │                                                            │
│  │  Uses typeAnnotation from IL AST nodes                                      │
│  │                 │                                                            │
│  └────────┬────────┘                                                            │
│           │                                                                      │
│           │ produces                                                             │
│           ▼                                                                      │
│  ┌─────────────────┐                                                            │
│  │  RustEmitter    │  Rust AST → Rust Code                                      │
│  ├─────────────────┤  ────────────────────                                      │
│  │                 │                                                            │
│  │  emit()         │  Dispatches to specific emitter by nodeType                │
│  │  ├─ emitModule()     → file header, uses, items                              │
│  │  ├─ emitStruct()     → struct Name { fields }                                │
│  │  ├─ emitImpl()       → impl Name { methods }                                 │
│  │  ├─ emitFunction()   → fn name(params) -> Type { body }                      │
│  │  ├─ emitBlock()      → { statements }                                        │
│  │  └─ emitExpression() → formatted expressions                                 │
│  │                 │                                                            │
│  └────────┬────────┘                                                            │
│           │                                                                      │
│           │ used by                                                              │
│           ▼                                                                      │
│  ┌─────────────────┐                                                            │
│  │    rust.js      │  Plugin Entry Point                                        │
│  ├─────────────────┤  ──────────────────                                        │
│  │                 │                                                            │
│  │  Extends LanguagePlugin                                                      │
│  │  • name = "Rust"                                                             │
│  │  • extension = "rs"                                                          │
│  │  • icon = "🦀"                                                               │
│  │                 │                                                            │
│  │  GenerateFromAST(ilAst, options) {                                           │
│  │    // ilAst is the IL AST with typeAnnotation on nodes                       │
│  │    transformer = new RustTransformer(options)                                │
│  │    rustAst = transformer.transform(ilAst) // Language AST                    │
│  │    emitter = new RustEmitter(options)                                        │
│  │    return emitter.emit(rustAst)                                              │
│  │  }                                                                           │
│  │                 │                                                            │
│  └─────────────────┘                                                            │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Complete Data Flow Example

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE DATA FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Input: JavaScript with JSDoc                                                   │
│  ────────────────────────────                                                   │
│                                                                                  │
│  /**                                                                            │
│   * @param {byte[]} data - Input data                                          │
│   * @returns {byte[]} - Encrypted data                                         │
│   */                                                                            │
│  class MyAlgo {                                                                  │
│    constructor() {                                                               │
│      this.key = new Uint8Array(16);                                             │
│    }                                                                             │
│    encrypt(data) {                                                               │
│      return data.map(b => b ^ this.key[0]);                                     │
│    }                                                                             │
│  }                                                                               │
│         │                                                                        │
│         │ TypeAwareJSASTParser (Phase 1 + Phase 2)                               │
│         ▼                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  IL AST (Intermediate Language AST with Types)                          │    │
│  │                                                                          │    │
│  │  {                                                                       │    │
│  │    type: "ClassDeclaration",                                            │    │
│  │    id: { name: "MyAlgo" },                                              │    │
│  │    body: {                                                               │    │
│  │      body: [                                                             │    │
│  │        {                                                                 │    │
│  │          type: "MethodDefinition",                                      │    │
│  │          kind: "constructor",                                            │    │
│  │          value: {                                                        │    │
│  │            body: {                                                       │    │
│  │              body: [{                                                    │    │
│  │                // this.key = new Uint8Array(16)                         │    │
│  │                right: {                                                  │    │
│  │                  typeAnnotation: { name: "byte[]" }  ◄── TYPE ADDED    │    │
│  │                }                                                         │    │
│  │              }]                                                          │    │
│  │            }                                                             │    │
│  │          }                                                               │    │
│  │        },                                                                │    │
│  │        {                                                                 │    │
│  │          type: "MethodDefinition",                                      │    │
│  │          key: { name: "encrypt" },                                      │    │
│  │          value: {                                                        │    │
│  │            params: [{                                                    │    │
│  │              name: "data",                                               │    │
│  │              typeAnnotation: { name: "byte[]" }  ◄── FROM JSDOC        │    │
│  │            }],                                                           │    │
│  │            returnType: { name: "byte[]" }  ◄── FROM JSDOC              │    │
│  │          }                                                               │    │
│  │        }                                                                 │    │
│  │      ]                                                                   │    │
│  │    }                                                                     │    │
│  │  }                                                                       │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│         │                                                                        │
│         │ RustTransformer.transform()                                            │
│         ▼                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  Language AST: Rust AST (RustModule)                                    │    │
│  │                                                                          │    │
│  │  RustModule {                                                            │    │
│  │    items: [                                                              │    │
│  │      RustStruct {                                                        │    │
│  │        name: "MyAlgo",                                                   │    │
│  │        fields: [                                                         │    │
│  │          RustStructField { name: "key", type: RustType.Vec(U8) }        │    │
│  │        ]                                                                 │    │
│  │      },                                                                  │    │
│  │      RustImpl {                                                          │    │
│  │        structName: "MyAlgo",                                             │    │
│  │        methods: [                                                        │    │
│  │          RustFunction {                                                  │    │
│  │            name: "new",                                                  │    │
│  │            returnType: RustType.SelfType(),                              │    │
│  │            body: RustBlock { ... }                                       │    │
│  │          },                                                              │    │
│  │          RustFunction {                                                  │    │
│  │            name: "encrypt",                                              │    │
│  │            params: [                                                     │    │
│  │              RustParameter { name: "data", type: RustType.Slice(U8) }   │    │
│  │            ],                                                            │    │
│  │            returnType: RustType.Vec(U8),                                 │    │
│  │            body: RustBlock { ... }                                       │    │
│  │          }                                                               │    │
│  │        ]                                                                 │    │
│  │      }                                                                   │    │
│  │    ]                                                                     │    │
│  │  }                                                                       │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│         │                                                                        │
│         │ RustEmitter.emit()                                                     │
│         ▼                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │  Generated Rust Code                                                    │    │
│  │                                                                          │    │
│  │  #[derive(Debug, Clone)]                                                 │    │
│  │  pub struct MyAlgo {                                                     │    │
│  │      key: Vec<u8>,                                                       │    │
│  │  }                                                                       │    │
│  │                                                                          │    │
│  │  impl MyAlgo {                                                           │    │
│  │      pub fn new() -> Self {                                              │    │
│  │          Self {                                                          │    │
│  │              key: vec![0u8; 16],                                         │    │
│  │          }                                                               │    │
│  │      }                                                                   │    │
│  │                                                                          │    │
│  │      pub fn encrypt(&self, data: &[u8]) -> Vec<u8> {                     │    │
│  │          data.iter().map(|b| b ^ self.key[0]).collect()                  │    │
│  │      }                                                                   │    │
│  │  }                                                                       │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## JavaScript Pattern Handling

The transformers recognize and convert common JavaScript patterns:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      JAVASCRIPT PATTERN TRANSFORMATIONS                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  JavaScript Pattern              Target Language Equivalents                     │
│  ──────────────────              ───────────────────────────                     │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ new Uint8Array([1, 2, 3])                                                 │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │ Rust:   vec![1u8, 2u8, 3u8]                                              │  │
│  │ Go:     []uint8{1, 2, 3}                                                  │  │
│  │ Java:   new byte[] { 1, 2, 3 }                                            │  │
│  │ C#:     new byte[] { 1, 2, 3 }                                            │  │
│  │ Python: bytes([1, 2, 3])                                                  │  │
│  │ C++:    std::vector<uint8_t>{1, 2, 3}                                    │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ new Uint8Array(16)  (sized allocation)                                    │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │ Rust:   vec![0u8; 16]                                                    │  │
│  │ Go:     make([]uint8, 16)                                                 │  │
│  │ Java:   new byte[16]                                                      │  │
│  │ C#:     new byte[16]                                                      │  │
│  │ Python: bytearray(16)                                                     │  │
│  │ C++:    std::vector<uint8_t>(16, 0)                                      │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ Object.freeze(obj)                                                        │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │ Rust:   obj  (Rust has immutability by default)                          │  │
│  │ Go:     obj  (no-op, use convention)                                      │  │
│  │ Java:   Collections.unmodifiableMap(obj)                                  │  │
│  │ C#:     obj.AsReadOnly() or ImmutableDictionary                          │  │
│  │ Python: types.MappingProxyType(obj)                                       │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ Object.keys(obj) / Object.values(obj) / Object.entries(obj)              │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │ Rust:   obj.keys() / obj.values() / obj.iter()                           │  │
│  │ Go:     maps.Keys(obj) / maps.Values(obj)                                 │  │
│  │ Java:   obj.keySet() / obj.values() / obj.entrySet()                      │  │
│  │ Python: list(obj.keys()) / list(obj.values()) / list(obj.items())        │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ const SBOX = (function() { ... return result; })();  (IIFE)              │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │ All languages: Extract the return value as a constant                    │  │
│  │                                                                           │  │
│  │ Rust:   const SBOX: [u8; N] = [...];                                     │  │
│  │ Go:     var SBOX = [...]uint8{...}                                        │  │
│  │ Java:   static final byte[] SBOX = {...};                                 │  │
│  │ C#:     static readonly byte[] SBOX = {...};                              │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ const { A, B } = require('./module')  (Destructuring Import)             │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │ All:    Skipped (framework imports, not algorithm code)                  │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ class Foo extends Bar { }                                                 │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │ Rust:   struct Foo { } + impl Bar for Foo { }  (trait)                   │  │
│  │ Go:     type Foo struct { Bar }  (embedding)                              │  │
│  │ Java:   class Foo extends Bar { }                                         │  │
│  │ C#:     class Foo : Bar { }                                               │  │
│  │ Python: class Foo(Bar): ...                                               │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ UMD/CommonJS Module Pattern (IIFE wrapper)                                │  │
│  ├───────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                           │  │
│  │ (function(global) {                                                       │  │
│  │   'use strict';                                                           │  │
│  │   class Algorithm { ... }        ──►  Extract inner content               │  │
│  │   module.exports = Algorithm;                                             │  │
│  │ })(globalThis);                                                           │  │
│  │                                                                           │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
codingplugins/
├── LanguagePlugin.js              # Base plugin class and registry
├── ReadMe.md                      # This documentation
│
└── [All 15 Languages - 4 files each]
    │
    ├── [Basic]
    │   ├── basic.js               # Plugin entry point
    │   ├── BasicAST.js            # Basic AST node definitions
    │   ├── BasicTransformer.js    # IL AST → Basic AST
    │   └── BasicEmitter.js        # Basic AST → Basic source code
    │
    ├── [C]
    │   ├── c.js
    │   ├── CAST.js
    │   ├── CTransformer.js
    │   └── CEmitter.js
    │
    ├── [C++]
    │   ├── cpp.js
    │   ├── CppAST.js
    │   ├── CppTransformer.js
    │   └── CppEmitter.js
    │
    ├── [C#]
    │   ├── csharp.js
    │   ├── CSharpAST.js
    │   ├── CSharpTransformer.js
    │   └── CSharpEmitter.js
    │
    ├── [Delphi]
    │   ├── delphi.js
    │   ├── DelphiAST.js
    │   ├── DelphiTransformer.js
    │   └── DelphiEmitter.js
    │
    ├── [Go]
    │   ├── go.js
    │   ├── GoAST.js
    │   ├── GoTransformer.js
    │   └── GoEmitter.js
    │
    ├── [Java]
    │   ├── java.js              (plugin and the Java runtime it emits)
    │   ├── JavaAST.js           (the typed JVM IR, shared with Kotlin)
    │   ├── JavaTransformer.js   (IL to JVM IR, shared with Kotlin)
    │   └── JavaEmitter.js
    │
    ├── [JavaScript]
    │   ├── javascript.js
    │   ├── JavaScriptAST.js
    │   ├── JavaScriptTransformer.js
    │   └── JavaScriptEmitter.js
    │
    ├── [Kotlin]
    │   ├── kotlin.js            (plugin and the Kotlin runtime it emits)
    │   ├── KotlinAST.js         (the JVM IR of JavaAST.js)
    │   ├── KotlinTransformer.js (the JavaTransformer)
    │   └── KotlinEmitter.js     (JVM IR to Kotlin, conversions spelled out)
    │
    ├── [Perl]
    │   ├── perl.js
    │   ├── PerlAST.js
    │   ├── PerlTransformer.js
    │   └── PerlEmitter.js
    │
    ├── [PHP]
    │   ├── php.js
    │   ├── PhpAST.js
    │   ├── PhpTransformer.js
    │   └── PhpEmitter.js
    │
    ├── [Python]
    │   ├── python.js
    │   ├── PythonAST.js
    │   ├── PythonTransformer.js
    │   └── PythonEmitter.js
    │
    ├── [Ruby]
    │   ├── ruby.js
    │   ├── RubyAST.js
    │   ├── RubyTransformer.js
    │   └── RubyEmitter.js
    │
    ├── [Rust]
    │   ├── rust.js
    │   ├── RustAST.js
    │   ├── RustTransformer.js
    │   └── RustEmitter.js
    │
    └── [TypeScript]
        ├── typescript.js
        ├── TypeScriptAST.js
        ├── TypeScriptTransformer.js
        └── TypeScriptEmitter.js
```

---

## Creating a New AST Pipeline Plugin

### Step 1: Define the AST (MyLangAST.js)

```javascript
(function(global) {
  'use strict';

  // Base node class
  class MyLangNode {
    constructor(nodeType) {
      this.nodeType = nodeType;
    }
  }

  // Type system - maps to language's type system
  class MyLangType extends MyLangNode {
    constructor(name) {
      super('Type');
      this.name = name;
    }

    // Factory methods for common types
    static Byte() { return new MyLangType('byte'); }
    static Int() { return new MyLangType('int'); }
    static String() { return new MyLangType('string'); }
    static Array(elementType) {
      const t = new MyLangType('array');
      t.elementType = elementType;
      return t;
    }
  }

  // Module/File level
  class MyLangModule extends MyLangNode {
    constructor() {
      super('Module');
      this.imports = [];
      this.classes = [];
      this.functions = [];
    }
  }

  // Class definition
  class MyLangClass extends MyLangNode {
    constructor(name) {
      super('Class');
      this.name = name;
      this.fields = [];
      this.methods = [];
    }
  }

  // ... more nodes for all language constructs

  const MyLangAST = {
    MyLangNode, MyLangType, MyLangModule, MyLangClass
    // Export all node types
  };

  if (typeof module !== 'undefined') module.exports = MyLangAST;
  if (typeof global !== 'undefined') global.MyLangAST = MyLangAST;
})(globalThis);
```

### Step 2: Create the Transformer (MyLangTransformer.js)

```javascript
(function(global) {
  'use strict';

  // Load AST definitions
  let MyLangAST;
  if (typeof require !== 'undefined') {
    MyLangAST = require('./MyLangAST.js');
  } else {
    MyLangAST = global.MyLangAST;
  }

  const { MyLangModule, MyLangClass, MyLangType } = MyLangAST;

  // Type mapping from intermediate types to target language
  const TYPE_MAP = {
    'byte': 'byte', 'word': 'ushort', 'dword': 'uint', 'qword': 'ulong',
    'sbyte': 'sbyte', 'short': 'short', 'int': 'int', 'long': 'long',
    'float': 'float', 'double': 'double',
    'boolean': 'bool', 'string': 'string', 'void': 'void'
  };

  class MyLangTransformer {
    constructor(options = {}) {
      this.options = options;
      this.variableTypes = new Map();
    }

    // Map intermediate type to target type
    mapType(typeName) {
      if (!typeName) return MyLangType.Int(); // Default

      // Handle arrays
      if (typeName.endsWith('[]')) {
        const elementType = this.mapType(typeName.slice(0, -2));
        return MyLangType.Array(elementType);
      }

      const mapped = TYPE_MAP[typeName];
      return mapped ? new MyLangType(mapped) : new MyLangType(typeName);
    }

    // Entry point
    transform(jsAst) {
      const module = new MyLangModule();

      if (jsAst.type === 'Program') {
        for (const node of jsAst.body) {
          this.transformTopLevel(node, module);
        }
      }

      return module;
    }

    transformTopLevel(node, module) {
      switch (node.type) {
        case 'ClassDeclaration':
          module.classes.push(this.transformClassDeclaration(node));
          break;
        case 'FunctionDeclaration':
          module.functions.push(this.transformFunctionDeclaration(node));
          break;
        case 'VariableDeclaration':
          this.transformVariableDeclaration(node, module);
          break;
        case 'ExpressionStatement':
          // Handle IIFE wrappers
          this.transformExpressionStatement(node, module);
          break;
      }
    }

    transformClassDeclaration(node) {
      const myClass = new MyLangClass(node.id.name);

      for (const member of node.body.body) {
        if (member.type === 'MethodDefinition') {
          // Use typeAnnotation if present
          const method = this.transformMethod(member);
          myClass.methods.push(method);
        } else if (member.type === 'PropertyDefinition') {
          // Extract field with type from typeAnnotation
          const field = this.transformProperty(member);
          myClass.fields.push(field);
        }
      }

      return myClass;
    }

    transformMethod(node) {
      // Get return type from node.value.returnType (added by type inference)
      const returnType = node.value.returnType
        ? this.mapType(node.value.returnType.name)
        : MyLangType.Void();

      // Get parameter types from typeAnnotation on each param
      const params = node.value.params.map(p => ({
        name: p.name,
        type: p.typeAnnotation
          ? this.mapType(p.typeAnnotation.name)
          : this.inferTypeFromName(p.name)
      }));

      // ... transform body
    }

    // Handle all 16 statement types
    transformStatement(node) {
      switch (node.type) {
        case 'BlockStatement':
          return this.transformBlockStatement(node);
        case 'ReturnStatement':
          return this.transformReturnStatement(node);
        case 'IfStatement':
          return this.transformIfStatement(node);
        case 'ForStatement':
          return this.transformForStatement(node);
        case 'ForOfStatement':
          return this.transformForOfStatement(node);
        case 'ForInStatement':
          return this.transformForInStatement(node);
        case 'WhileStatement':
          return this.transformWhileStatement(node);
        case 'DoWhileStatement':
          return this.transformDoWhileStatement(node);
        case 'SwitchStatement':
          return this.transformSwitchStatement(node);
        case 'TryStatement':
          return this.transformTryStatement(node);
        case 'ThrowStatement':
          return this.transformThrowStatement(node);
        case 'BreakStatement':
          return this.transformBreakStatement(node);
        case 'ContinueStatement':
          return this.transformContinueStatement(node);
        case 'VariableDeclaration':
          return this.transformVariableDeclaration(node);
        case 'ExpressionStatement':
          return this.transformExpressionStatement(node);
        case 'ClassDeclaration':
          return this.transformClassDeclaration(node);
        case 'FunctionDeclaration':
          return this.transformFunctionDeclaration(node);
        default:
          return this.transformNode(node);
      }
    }

    // Handle all 19 expression types
    transformExpression(node) {
      switch (node.type) {
        case 'Literal':
          return this.transformLiteral(node);
        case 'Identifier':
          return this.transformIdentifier(node);
        case 'BinaryExpression':
          return this.transformBinaryExpression(node);
        case 'UnaryExpression':
          return this.transformUnaryExpression(node);
        case 'UpdateExpression':
          return this.transformUpdateExpression(node);
        case 'AssignmentExpression':
          return this.transformAssignmentExpression(node);
        case 'LogicalExpression':
          return this.transformLogicalExpression(node);
        case 'MemberExpression':
          return this.transformMemberExpression(node);
        case 'CallExpression':
          return this.transformCallExpression(node);
        case 'NewExpression':
          return this.transformNewExpression(node);
        case 'ArrayExpression':
          return this.transformArrayExpression(node);
        case 'ObjectExpression':
          return this.transformObjectExpression(node);
        case 'ConditionalExpression':
          return this.transformConditionalExpression(node);
        case 'ArrowFunctionExpression':
          return this.transformArrowFunctionExpression(node);
        case 'FunctionExpression':
          return this.transformFunctionExpression(node);
        case 'ThisExpression':
          return this.transformThisExpression(node);
        case 'SpreadElement':
          return this.transformSpreadElement(node);
        case 'SequenceExpression':
          return this.transformSequenceExpression(node);
        case 'TemplateLiteral':
          return this.transformTemplateLiteral(node);
        default:
          return this.transformNode(node);
      }
    }

    // Type inference from variable name patterns
    inferTypeFromName(name) {
      const lower = name.toLowerCase();
      if (lower.includes('byte') || lower === 'b') return MyLangType.Byte();
      if (lower.includes('key') || lower.includes('data')) return MyLangType.Array(MyLangType.Byte());
      if (lower.includes('index') || lower.includes('length')) return MyLangType.Int();
      return MyLangType.Int(); // Default
    }
  }

  if (typeof module !== 'undefined') module.exports = { MyLangTransformer };
  if (typeof global !== 'undefined') global.MyLangTransformer = MyLangTransformer;
})(globalThis);
```

### Step 3: Create the Emitter (MyLangEmitter.js)

```javascript
(function(global) {
  'use strict';

  class MyLangEmitter {
    constructor(options = {}) {
      this.indentStr = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.lineEnding || '\n';
    }

    // Entry point - dispatches by nodeType
    emit(node) {
      if (!node) return '';

      const emitter = `emit${node.nodeType}`;
      if (typeof this[emitter] === 'function') {
        return this[emitter](node);
      }

      console.warn(`No emitter for: ${node.nodeType}`);
      return '';
    }

    // Helpers
    indent() {
      return this.indentStr.repeat(this.indentLevel);
    }

    line(content = '') {
      return content ? `${this.indent()}${content}${this.newline}` : this.newline;
    }

    // Emitters for each node type...
    emitModule(node) { /* ... */ }
    emitClass(node) { /* ... */ }
    emitMethod(node) { /* ... */ }
    emitType(node) { /* ... */ }
    // ... emitters for all node types
  }

  if (typeof module !== 'undefined') module.exports = { MyLangEmitter };
  if (typeof global !== 'undefined') global.MyLangEmitter = MyLangEmitter;
})(globalThis);
```

### Step 4: Create the Plugin (mylang.js)

```javascript
(function(global) {
  'use strict';

  let LanguagePlugin, LanguagePlugins, MyLangTransformer, MyLangEmitter;

  if (typeof require !== 'undefined') {
    const lp = require('./LanguagePlugin.js');
    LanguagePlugin = lp.LanguagePlugin;
    LanguagePlugins = lp.LanguagePlugins;
    MyLangTransformer = require('./MyLangTransformer.js').MyLangTransformer;
    MyLangEmitter = require('./MyLangEmitter.js').MyLangEmitter;
  }

  class MyLangPlugin extends LanguagePlugin {
    constructor() {
      super();
      this.name = 'MyLang';
      this.extension = 'ml';
      this.icon = '🔷';
      this.description = 'MyLang code generator';
    }

    GenerateFromAST(ast, options = {}) {
      try {
        // ast already has typeAnnotation properties from TypeAwareJSASTParser

        // Stage 3: Transform to language-specific AST
        const transformer = new MyLangTransformer(options);
        const myLangAst = transformer.transform(ast);

        // Stage 4: Emit to source code
        const emitter = new MyLangEmitter(options);
        const code = emitter.emit(myLangAst);

        return this.CreateSuccessResult(code, [], transformer.warnings || []);
      } catch (error) {
        return this.CreateErrorResult(error.message);
      }
    }
  }

  // Register the plugin
  LanguagePlugins.Add(new MyLangPlugin());

  if (typeof module !== 'undefined') module.exports = { MyLangPlugin };
})(globalThis);
```

---

## Testing

### Running the Coverage Test

```bash
node tests/TransformerCoverageTest.js
```

### Expected Output (AST Pipeline Languages)

```
================================================================================
TRANSFORMER COVERAGE TEST
================================================================================

1. ANALYZING ALGORITHM AST USAGE
----------------------------------------
Scanned 710 algorithm files
Statement types used: 18
Expression types used: 22

2. TRANSFORMER COVERAGE ANALYSIS
----------------------------------------

RustTransformer.js:
  Statement coverage: 100% (16/16)
  Expression coverage: 100% (19/19)

GoTransformer.js:
  Statement coverage: 100% (16/16)
  Expression coverage: 100% (19/19)

... (all AST pipeline transformers at 100%)

3. CODE GENERATION QUALITY TEST
----------------------------------------

Language       Success     Functional     Issues
--------------------------------------------------------------------------------
Rust           100%        100%           None
Go             100%        100%           None
Java           100%        100%           None
... (all at 100%)
```

### Coverage Requirements

| Metric | Requirement |
|--------|-------------|
| Statement Coverage | 100% (16/16 types) |
| Expression Coverage | 100% (19/19 types) |
| Code Generation Success | 100% on all test algorithms |

### Critical Statement Types (16)

```
BlockStatement, BreakStatement, ClassDeclaration, ContinueStatement,
DoWhileStatement, ExpressionStatement, ForInStatement, ForOfStatement,
ForStatement, FunctionDeclaration, IfStatement, ReturnStatement,
SwitchStatement, ThrowStatement, TryStatement, WhileStatement
```

### Critical Expression Types (19)

```
ArrayExpression, ArrowFunctionExpression, AssignmentExpression,
BinaryExpression, CallExpression, ConditionalExpression, FunctionExpression,
Identifier, Literal, LogicalExpression, MemberExpression, NewExpression,
ObjectExpression, SequenceExpression, SpreadElement, TemplateLiteral,
ThisExpression, UnaryExpression, UpdateExpression
```

---

## Supported Languages

| Language | Icon | Extension | Architecture | Status |
|----------|------|-----------|--------------|--------|
| Basic | 📟 | `.bas` | AST Pipeline | ✅ 100% |
| C | 🔧 | `.c` | AST Pipeline | ✅ 100% |
| C++ | ⚙️ | `.cpp` | AST Pipeline | ✅ 100% |
| C# | 🎯 | `.cs` | AST Pipeline | ✅ 100% |
| Delphi | 🏛️ | `.pas` | AST Pipeline | ✅ 100% |
| Go | 🐹 | `.go` | AST Pipeline | ✅ 100% |
| Java | ☕ | `.java` | AST Pipeline | ✅ 100% |
| JavaScript | 🟨 | `.js` | AST Pipeline | ✅ 100% |
| Kotlin | 🎨 | `.kt` | AST Pipeline | ✅ 100% |
| Perl | 🐪 | `.pl` | AST Pipeline | ✅ 100% |
| PHP | 🐘 | `.php` | AST Pipeline | ✅ 100% |
| Python | 🐍 | `.py` | AST Pipeline | ✅ 100% |
| Ruby | 💎 | `.rb` | AST Pipeline | ✅ 100% |
| Rust | 🦀 | `.rs` | AST Pipeline | ✅ 100% |
| TypeScript | 🔷 | `.ts` | AST Pipeline | ✅ 100% |

---

## Design Principles

1. **Type Preservation** - Types inferred from JSDoc flow through the entire pipeline
2. **Separation of Concerns** - Parser, type inference, transformation, and emission are separate stages
3. **Language-Specific AST** - Each language has typed nodes matching its constructs
4. **Extensibility** - Add new languages without modifying existing code
5. **Testability** - Each component can be tested independently
6. **Idiomatic Output** - Generated code follows target language conventions

---

## License

Part of the SynthelicZ Cipher Tools project.
