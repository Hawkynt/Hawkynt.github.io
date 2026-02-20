/**
 * CppEmitter.js - C++ Code Generator from C++ AST
 * Generates properly formatted C++ source code from CppAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> C++ AST -> C++ Emitter -> C++ Source
 */

(function(global) {
  'use strict';

  // Load CppAST if available
  let CppAST;
  if (typeof require !== 'undefined') {
    CppAST = require('./CppAST.js');
  } else if (global.CppAST) {
    CppAST = global.CppAST;
  }

  /**
   * C++ Code Emitter
   * Generates formatted C++ code from a C++ AST
   */
  class CppEmitter {
    constructor(options = {}) {
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || '\n';
      this.braceStyle = options.braceStyle || 'knr'; // 'knr' (K&R) or 'allman'
      this.namingConvention = options.namingConvention || 'snake_case'; // 'snake_case' or 'camelCase'
    }

    /**
     * Emit C++ code from a C++ AST node
     * @param {CppNode} node - The AST node to emit
     * @returns {string} Generated C++ code
     */
    emit(node) {
      if (!node) return '';

      if (typeof node === 'string') return node;

      // Handle arrays
      if (Array.isArray(node)) {
        return node.map(n => this.emit(n)).filter(s => s).join('');
      }

      // Duck typing fallback for nodes with missing nodeType
      if (!node.nodeType) {
        if (node.statements !== undefined) return this.emitBlock(node);
        if (node.target && node.value && node.operator !== undefined) return this.emitAssignment(node);
        if (node.name && typeof node.name === 'string') return this.emitIdentifier(node);
        console.error(`No emitter for node type: ${node.nodeType}`);
        return '';
      }

      const emitterMethod = `emit${node.nodeType}`;
      if (typeof this[emitterMethod] === 'function') {
        return this[emitterMethod](node);
      }

      console.error(`No emitter for node type: ${node.nodeType}`);
      return `/* Unknown node type: ${node.nodeType} */`;
    }

    // ========================[ HELPERS ]========================

    indent() {
      return this.indentString.repeat(this.indentLevel);
    }

    line(content = '') {
      return content ? `${this.indent()}${content}${this.newline}` : this.newline;
    }

    openBrace() {
      if (this.braceStyle === 'allman') {
        return `${this.newline}${this.indent()}{${this.newline}`;
      }
      return ` {${this.newline}`;
    }

    closeBrace(semicolon = false) {
      return `${this.indent()}}${semicolon ? ';' : ''}${this.newline}`;
    }

    // ========================[ COMPILATION UNIT ]========================

    emitCompilationUnit(node) {
      let code = '';

      // Pragma directives
      for (const pragma of node.pragmas) {
        code += this.emit(pragma);
      }

      // Include directives
      for (const include of node.includes) {
        code += this.emit(include);
      }
      if (node.includes.length > 0) {
        code += this.newline;
      }

      // Add crypto helper functions
      code += this.emitCryptoHelpers();
      code += this.newline;

      // Add framework stubs for standalone compilation
      code += this.emitFrameworkStubs();
      code += this.newline;

      // Namespaces
      for (const ns of node.namespaces) {
        code += this.emit(ns);
      }

      // Top-level types (rare)
      for (const type of node.types) {
        code += this.emit(type);
      }

      return code;
    }

    emitIncludeDirective(node) {
      if (node.isSystem) {
        return this.line(`#include <${node.header}>`);
      }
      return this.line(`#include "${node.header}"`);
    }

    /**
     * Emit crypto helper functions for C++
     */
    emitCryptoHelpers() {
      return `// Crypto helper functions and utilities
namespace crypto {

constexpr uint32_t to_uint32(uint64_t x) { return static_cast<uint32_t>(x); }
constexpr uint64_t to_uint64(uint64_t x) { return x; }

constexpr uint32_t xor_n(uint32_t a, uint32_t b) { return a ^ b; }
constexpr uint64_t xor_n(uint64_t a, uint64_t b) { return a ^ b; }

constexpr uint32_t shl32(uint32_t x, int n) { return x << n; }
constexpr uint32_t shr32(uint32_t x, int n) { return x >> n; }
constexpr uint64_t shl64(uint64_t x, int n) { return x << (n & 63); }
constexpr uint64_t shr64(uint64_t x, int n) { return x >> (n & 63); }

constexpr uint32_t rotl32(uint32_t x, int n) { return (x << (n & 31)) | (x >> (32 - (n & 31))); }
constexpr uint32_t rotr32(uint32_t x, int n) { return (x >> (n & 31)) | (x << (32 - (n & 31))); }
constexpr uint64_t rotl64(uint64_t x, int n) { return (x << (n & 63)) | (x >> (64 - (n & 63))); }
constexpr uint64_t rotr64(uint64_t x, int n) { return (x >> (n & 63)) | (x << (64 - (n & 63))); }

inline uint32_t pack32_be(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3) {
    return (static_cast<uint32_t>(b0) << 24) | (static_cast<uint32_t>(b1) << 16) |
           (static_cast<uint32_t>(b2) << 8) | static_cast<uint32_t>(b3);
}

inline uint32_t pack32_le(uint8_t b0, uint8_t b1, uint8_t b2, uint8_t b3) {
    return static_cast<uint32_t>(b0) | (static_cast<uint32_t>(b1) << 8) |
           (static_cast<uint32_t>(b2) << 16) | (static_cast<uint32_t>(b3) << 24);
}

inline std::array<uint8_t, 4> unpack32_be(uint32_t w) {
    return { static_cast<uint8_t>(w >> 24), static_cast<uint8_t>(w >> 16),
             static_cast<uint8_t>(w >> 8), static_cast<uint8_t>(w) };
}

inline std::array<uint8_t, 4> unpack32_le(uint32_t w) {
    return { static_cast<uint8_t>(w), static_cast<uint8_t>(w >> 8),
             static_cast<uint8_t>(w >> 16), static_cast<uint8_t>(w >> 24) };
}

template<typename T>
inline void xor_arrays(std::vector<T>& dst, const std::vector<T>& src) {
    for (size_t i = 0; i < std::min(dst.size(), src.size()); ++i) dst[i] ^= src[i];
}

template<typename T>
inline std::vector<T> concat_arrays(const std::vector<T>& a, const std::vector<T>& b) {
    std::vector<T> result = a;
    result.insert(result.end(), b.begin(), b.end());
    return result;
}

// Array map helper: transform_array(arr, func) -> new vector with transformed elements
template<typename T, typename Func>
inline auto transform_array(const std::vector<T>& arr, Func func) {
    using ResultType = decltype(func(arr[0]));
    std::vector<ResultType> result;
    result.reserve(arr.size());
    std::transform(arr.begin(), arr.end(), std::back_inserter(result), func);
    return result;
}

// Array filter helper: filter_array(arr, pred) -> new vector with filtered elements
template<typename T, typename Pred>
inline std::vector<T> filter_array(const std::vector<T>& arr, Pred pred) {
    std::vector<T> result;
    std::copy_if(arr.begin(), arr.end(), std::back_inserter(result), pred);
    return result;
}

// String transformation helpers
inline std::string to_upper_case(const std::string& s) {
    std::string result = s;
    std::transform(result.begin(), result.end(), result.begin(), ::toupper);
    return result;
}

inline std::string to_lower_case(const std::string& s) {
    std::string result = s;
    std::transform(result.begin(), result.end(), result.begin(), ::tolower);
    return result;
}

inline std::string trim_left(const std::string& s) {
    auto it = std::find_if(s.begin(), s.end(), [](unsigned char c) { return !std::isspace(c); });
    return std::string(it, s.end());
}

inline std::string trim_right(const std::string& s) {
    auto it = std::find_if(s.rbegin(), s.rend(), [](unsigned char c) { return !std::isspace(c); });
    return std::string(s.begin(), it.base());
}

inline std::string trim(const std::string& s) {
    return trim_left(trim_right(s));
}

}  // namespace crypto

using namespace crypto;
`;
    }

    /**
     * Emit framework stubs for standalone compilation
     * These provide base classes and enums that the generated code inherits from
     */
    emitFrameworkStubs() {
      return `
// ============================================================================
// Framework Stubs for Standalone Compilation
// ============================================================================

// Enums
enum class CategoryType { CHECKSUM, BLOCK, STREAM, HASH, MAC, KDF, AEAD, ASYMMETRIC, COMPRESSION, ENCODING, CLASSICAL, ECC, RANDOM, MODES, CRYPTO, SPECIAL, PADDING };
enum class SecurityStatus { SECURE, EDUCATIONAL, DEPRECATED, BROKEN, EXPERIMENTAL, OBSOLETE, INSECURE, ACTIVE };
enum class CountryCode { US, DE, JP, FR, GB, CN, RU, BE, KR, IL, CH, AU, NL, AT, FI, SE, NO, DK, IT, ES, CA, OTHER, INTL, INTERNATIONAL, INT, MULTI, SG, SINGAPORE, UA, PL, TR, IN, UNKNOWN, AUSTRIA, FRANCE };
enum class ComplexityType { BEGINNER, INTERMEDIATE, ADVANCED, EXPERT, RESEARCH, BASIC, SIMPLE, LOW, HIGH, TRIVIAL, MEDIUM, ELEMENTARY };

// Support types
struct LinkItem {
    std::string title;
    std::string url;
    LinkItem(const std::string& t, const std::string& u) : title(t), url(u) {}
};

struct Vulnerability {
    std::string name;
    std::string url;
    std::string description;
    std::string mitigation;
    Vulnerability(const std::string& n, const std::string& u, const std::string& d, const std::string& m) : name(n), url(u), description(d), mitigation(m) {}
    Vulnerability(const std::string& n, const std::string& d, const std::string& m) : name(n), description(d), mitigation(m) {}
    Vulnerability(const std::string& n, const std::string& m) : name(n), mitigation(m) {}
};

struct TestCase {
    std::vector<uint8_t> input;
    std::vector<uint8_t> key;
    std::vector<uint8_t> expected;
    std::string description;
    std::string source;
    // 5-arg constructor: description, source, input, key, expected
    TestCase(const std::string& d, const std::string& s, const std::vector<uint8_t>& i, const std::vector<uint8_t>& k, const std::vector<uint8_t>& e)
        : input(i), key(k), expected(e), description(d), source(s) {}
    // 4-arg constructor: input, expected, description, source
    TestCase(const std::vector<uint8_t>& i, const std::vector<uint8_t>& e, const std::string& d, const std::string& s)
        : input(i), expected(e), description(d), source(s) {}
};

struct KeySize {
    int minSize;
    int maxSize;
    int step;
    KeySize(int min, int max, int s) : minSize(min), maxSize(max), step(s) {}
};

// Dynamic config structure for algorithm-specific settings
struct DynamicConfig {
    std::string description;
    uint32_t sum_bits = 0;
    uint32_t modulo = 0;
    uint32_t base = 1;
    uint32_t result_bytes = 4;
    ComplexityType complexity = ComplexityType::BEGINNER;
    std::vector<TestCase> tests;
};

// Base class for all algorithms
class Algorithm {
public:
    std::string name;
    std::string description;
    std::string inventor;
    uint32_t year = 0;
    CategoryType category = CategoryType::CHECKSUM;
    std::string subCategory;
    std::string sub_category;  // Alias for snake_case access
    SecurityStatus securityStatus = SecurityStatus::EDUCATIONAL;
    SecurityStatus security_status = SecurityStatus::EDUCATIONAL;  // Alias
    ComplexityType complexity = ComplexityType::BEGINNER;
    CountryCode country = CountryCode::US;
    std::vector<LinkItem> documentation;
    std::vector<LinkItem> references;
    std::vector<Vulnerability> knownVulnerabilities;
    std::vector<Vulnerability> known_vulnerabilities;  // Alias
    std::vector<TestCase> tests;
    DynamicConfig config;  // Dynamic algorithm configuration

    Algorithm() = default;
    virtual ~Algorithm() = default;
    virtual std::optional<void*> createInstance(bool isInverse = false) { return std::nullopt; }
    virtual std::optional<void*> create_instance(bool is_inverse = false) { return createInstance(is_inverse); }

    // Helper to get variant config (override in derived classes)
    virtual DynamicConfig get_variant_config(const std::string& variant) { return config; }
    template<typename T>
    DynamicConfig get_variant_config(T variant) { return config; }
};

// Specialized algorithm base classes
class BlockCipherAlgorithm : public Algorithm {
public:
    std::vector<KeySize> supported_key_sizes;
    std::vector<KeySize> supported_block_sizes;
    BlockCipherAlgorithm() = default;
};

class StreamCipherAlgorithm : public Algorithm {
public:
    std::vector<KeySize> supported_key_sizes;
    std::vector<KeySize> supported_nonce_sizes;
    StreamCipherAlgorithm() = default;
};

class HashFunctionAlgorithm : public Algorithm {
public:
    std::vector<KeySize> supported_output_sizes;
    HashFunctionAlgorithm() = default;
};

class MacAlgorithm : public Algorithm {
public:
    std::vector<KeySize> supported_key_sizes;
    MacAlgorithm() = default;
};

class AEADAlgorithm : public Algorithm {
public:
    std::vector<KeySize> supported_key_sizes;
    std::vector<KeySize> supported_nonce_sizes;
    AEADAlgorithm() = default;
};

class KDFAlgorithm : public Algorithm {
public:
    KDFAlgorithm() = default;
};

class CompressionAlgorithm : public Algorithm {
public:
    CompressionAlgorithm() = default;
};

class RandomAlgorithm : public Algorithm {
public:
    RandomAlgorithm() = default;
};

class ChecksumAlgorithm : public Algorithm {
public:
    uint32_t checksum_size = 4;
    ChecksumAlgorithm() = default;
};

class EncodingAlgorithm : public Algorithm {
public:
    EncodingAlgorithm() = default;
};

class ECCAlgorithm : public Algorithm {
public:
    ECCAlgorithm() = default;
};

class AsymmetricAlgorithm : public Algorithm {
public:
    AsymmetricAlgorithm() = default;
};

class ClassicalAlgorithm : public Algorithm {
public:
    ClassicalAlgorithm() = default;
};

// Base class for algorithm instances
class IAlgorithmInstance {
protected:
    Algorithm* algorithm;
public:
    DynamicConfig config;  // Instance-specific config
    uint64_t a = 0;        // General-purpose accumulator
    uint64_t b = 0;        // General-purpose accumulator

    IAlgorithmInstance(Algorithm* algo) : algorithm(algo) {}
    template<typename T>
    IAlgorithmInstance(T algo) : algorithm(nullptr) {}
    template<typename A, typename C>
    IAlgorithmInstance(A algo, C cfg) : algorithm(nullptr), config(cfg) {}
    virtual ~IAlgorithmInstance() = default;
    virtual void feed(const std::vector<uint8_t>& data) {}
    virtual std::vector<uint8_t> result() { return {}; }
};

// Specialized instance base classes
class IBlockCipherInstance : public IAlgorithmInstance {
public:
    std::vector<uint8_t> key;
    std::vector<uint8_t> iv;
    std::vector<uint8_t> input_buffer;
    bool is_inverse = false;
    uint32_t block_size = 0;
    uint32_t key_size = 0;
    IBlockCipherInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

class IStreamCipherInstance : public IAlgorithmInstance {
public:
    std::vector<uint8_t> key;
    std::vector<uint8_t> iv;
    std::vector<uint8_t> nonce;
    IStreamCipherInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

class IHashFunctionInstance : public IAlgorithmInstance {
public:
    int outputSize = 0;
    IHashFunctionInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

class IMACInstance : public IAlgorithmInstance {
public:
    std::vector<uint8_t> key;
    IMACInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

class IAEADInstance : public IAlgorithmInstance {
public:
    std::vector<uint8_t> key;
    std::vector<uint8_t> nonce;
    std::vector<uint8_t> associatedData;
    IAEADInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

class IKDFInstance : public IAlgorithmInstance {
public:
    std::vector<uint8_t> salt;
    int iterations = 0;
    int outputLength = 0;
    IKDFInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

class ICompressionInstance : public IAlgorithmInstance {
public:
    ICompressionInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

class IRandomInstance : public IAlgorithmInstance {
public:
    std::vector<uint8_t> seed;
    IRandomInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

class IChecksumInstance : public IAlgorithmInstance {
public:
    IChecksumInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

class IECCInstance : public IAlgorithmInstance {
public:
    IECCInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

class IAsymmetricInstance : public IAlgorithmInstance {
public:
    IAsymmetricInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

class IClassicalInstance : public IAlgorithmInstance {
public:
    IClassicalInstance(Algorithm* algo) : IAlgorithmInstance(algo) {}
};

// Helper functions for byte packing/unpacking
inline std::vector<uint8_t> unpack_16BE(uint32_t v) {
    return { static_cast<uint8_t>(v >> 8), static_cast<uint8_t>(v) };
}

inline std::vector<uint8_t> unpack_32BE(uint32_t v) {
    return { static_cast<uint8_t>(v >> 24), static_cast<uint8_t>(v >> 16),
             static_cast<uint8_t>(v >> 8), static_cast<uint8_t>(v) };
}

inline std::vector<uint8_t> unpack_32LE(uint32_t v) {
    return { static_cast<uint8_t>(v), static_cast<uint8_t>(v >> 8),
             static_cast<uint8_t>(v >> 16), static_cast<uint8_t>(v >> 24) };
}

// Array helper namespace (for Array.isArray pattern)
struct array {
    template<typename T>
    static bool is_array(const std::vector<T>&) { return true; }
    template<typename T>
    static bool is_array(const T&) { return false; }
};

// Helper for converting string to bytes
inline std::vector<uint8_t> string_to_bytes(const std::string& s) {
    return std::vector<uint8_t>(s.begin(), s.end());
}

// Hex string to bytes conversion
inline std::vector<uint8_t> hex_to_bytes(const std::string& hex) {
    std::vector<uint8_t> bytes;
    for (size_t i = 0; i < hex.length(); i += 2) {
        std::string byteString = hex.substr(i, 2);
        bytes.push_back(static_cast<uint8_t>(std::stoul(byteString, nullptr, 16)));
    }
    return bytes;
}

// Overload for empty hex (used when no data)
inline std::vector<uint8_t> hex_to_bytes() {
    return {};
}

// Pack bytes to 32-bit big-endian (alternate naming)
inline uint32_t pack_32BE(const std::vector<uint8_t>& bytes) {
    if (bytes.size() < 4) return 0;
    return (static_cast<uint32_t>(bytes[0]) << 24) | (static_cast<uint32_t>(bytes[1]) << 16) |
           (static_cast<uint32_t>(bytes[2]) << 8) | static_cast<uint32_t>(bytes[3]);
}

inline uint32_t pack_32LE(const std::vector<uint8_t>& bytes) {
    if (bytes.size() < 4) return 0;
    return static_cast<uint32_t>(bytes[0]) | (static_cast<uint32_t>(bytes[1]) << 8) |
           (static_cast<uint32_t>(bytes[2]) << 16) | (static_cast<uint32_t>(bytes[3]) << 24);
}

`;
    }

    emitNamespace(node) {
      let code = this.line(`namespace ${node.name} {`);
      this.indentLevel++;

      // Functions
      for (const func of node.functions) {
        code += this.emit(func);
        code += this.newline;
      }

      // Types
      for (const type of node.types) {
        code += this.emit(type);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line(`}  // namespace ${node.name}`);
      return code;
    }

    // ========================[ TYPE DECLARATIONS ]========================

    emitClass(node) {
      let code = '';

      // Doxygen documentation
      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      // Declaration line
      let decl = `class ${node.name}`;

      // Base classes
      if (node.baseClasses.length > 0) {
        const bases = node.baseClasses.map(b => `public ${b.toString()}`);
        decl += ` : ${bases.join(', ')}`;
      }

      code += this.line(decl + ' {');

      // Collect nested class names for forward declarations
      const nestedClassNames = new Set();
      for (const member of node.publicMembers) {
        if (member.nodeType === 'Class') {
          nestedClassNames.add(member.name);
        }
      }

      // Emit forward declarations for nested classes (if any methods reference them before definition)
      if (nestedClassNames.size > 0) {
        code += this.line('public:');
        this.indentLevel++;
        for (const className of nestedClassNames) {
          code += this.line(`class ${className};`);
        }
        code += this.newline;
        this.indentLevel--;
      }

      // Separate nested classes from other members
      const nestedClasses = node.publicMembers.filter(m => m.nodeType === 'Class');
      const otherPublicMembers = node.publicMembers.filter(m => m.nodeType !== 'Class');

      // Nested classes first (after forward declarations) - needed for static members that use them
      for (const nestedClass of nestedClasses) {
        code += this.emit(nestedClass);
        code += this.newline;
      }

      // Other public members (methods, fields, static members) after nested classes are defined
      if (otherPublicMembers.length > 0) {
        code += this.line('public:');
        this.indentLevel++;
        for (const member of otherPublicMembers) {
          code += this.emit(member);
          code += this.newline;
        }
        this.indentLevel--;
      }

      // Private section
      if (node.privateMembers.length > 0) {
        code += this.line('private:');
        this.indentLevel++;
        for (const member of node.privateMembers) {
          code += this.emit(member);
          code += this.newline;
        }
        this.indentLevel--;
      }

      // Protected section
      if (node.protectedMembers.length > 0) {
        code += this.line('protected:');
        this.indentLevel++;
        for (const member of node.protectedMembers) {
          code += this.emit(member);
          code += this.newline;
        }
        this.indentLevel--;
      }

      code += this.line('};');
      return code;
    }

    emitStruct(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      code += this.line(`struct ${node.name} {`);
      this.indentLevel++;

      for (const member of node.members) {
        code += this.emit(member);
        code += this.newline;
      }

      this.indentLevel--;
      code += this.line('};');
      return code;
    }

    // ========================[ MEMBERS ]========================

    emitField(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      let decl = '';
      // For static fields with initializers that are non-trivial types,
      // we need 'inline static' for in-class initialization (C++17+)
      if (node.isStatic && node.initializer && !node.isConstexpr) {
        decl += 'inline static ';
      } else if (node.isStatic) {
        decl += 'static ';
      }
      if (node.isConstexpr) decl += 'constexpr ';
      else if (node.isConst) decl += 'const ';
      if (node.isMutable) decl += 'mutable ';

      decl += `${node.type.toString()} ${node.name}`;

      if (node.initializer) {
        decl += ` = ${this.emit(node.initializer)}`;
      }

      code += this.line(`${decl};`);
      return code;
    }

    emitMethod(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      let decl = '';
      if (node.isStatic) decl += 'static ';
      if (node.isVirtual) decl += 'virtual ';
      if (node.isInline) decl += 'inline ';
      if (node.isConstexpr) decl += 'constexpr ';

      decl += `${node.returnType.toString()} ${node.name}`;

      // Parameters
      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      if (node.isConst) {
        decl += ' const';
      }

      if (node.isOverride) {
        decl += ' override';
      }

      if (!node.body) {
        code += this.line(`${decl};`);
      } else {
        code += this.line(decl);
        code += this.emit(node.body);
      }

      return code;
    }

    emitConstructor(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      let decl = '';
      if (node.isExplicit) decl += 'explicit ';
      decl += node.className;

      const params = node.parameters.map(p => this.emitParameterDecl(p));
      decl += `(${params.join(', ')})`;

      // Initializer list
      if (node.initializerList.length > 0) {
        const inits = node.initializerList.map(init =>
          `${init.member}(${this.emit(init.value)})`
        );
        decl += ` : ${inits.join(', ')}`;
      }

      if (node.isDefault) {
        code += this.line(`${decl} = default;`);
      } else if (node.isDelete) {
        code += this.line(`${decl} = delete;`);
      } else {
        code += this.line(decl);
        if (node.body) {
          code += this.emit(node.body);
        } else {
          code += this.line('{');
          code += this.line('}');
        }
      }

      return code;
    }

    emitDestructor(node) {
      let code = '';
      let decl = '';
      if (node.isVirtual) decl += 'virtual ';
      decl += `~${node.className}()`;

      if (node.isDefault) {
        code += this.line(`${decl} = default;`);
      } else if (node.isDelete) {
        code += this.line(`${decl} = delete;`);
      } else {
        code += this.line(decl);
        if (node.body) {
          code += this.emit(node.body);
        } else {
          code += this.line('{');
          code += this.line('}');
        }
      }

      return code;
    }

    emitParameterDecl(node) {
      let decl = `${node.type.toString()} ${node.name}`;
      if (node.defaultValue) {
        decl += ` = ${this.emit(node.defaultValue)}`;
      }
      return decl;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      let code = this.line('{');
      this.indentLevel++;

      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitVariableDeclaration(node) {
      let code = '';
      if (node.isStatic) code += 'static ';
      if (node.isConstexpr) code += 'constexpr ';
      else if (node.isConst) code += 'const ';

      code += `${node.type.toString()} ${node.name}`;

      if (node.initializer) {
        code += ` = ${this.emit(node.initializer)}`;
      }

      return this.line(`${code};`);
    }

    emitExpressionStatement(node) {
      // Skip no-op statements
      if (node.expression && node.expression.isNoop) {
        return '';
      }
      return this.line(`${this.emit(node.expression)};`);
    }

    emitReturn(node) {
      if (node.expression) {
        return this.line(`return ${this.emit(node.expression)};`);
      }
      return this.line('return;');
    }

    emitIf(node) {
      let code = this.line(`if (${this.emit(node.condition)})`);

      if (node.thenBranch?.nodeType === 'Block') {
        code += this.emit(node.thenBranch);
      } else if (node.thenBranch) {
        this.indentLevel++;
        code += this.emit(node.thenBranch);
        this.indentLevel--;
      }

      if (node.elseBranch) {
        if (node.elseBranch.nodeType === 'If') {
          // else if
          code = code.trimEnd() + this.newline;
          code += this.indent() + 'else ';
          const elseIfCode = this.emit(node.elseBranch);
          code += elseIfCode.replace(/^\s*/, '');
        } else {
          code += this.line('else');
          if (node.elseBranch.nodeType === 'Block') {
            code += this.emit(node.elseBranch);
          } else {
            this.indentLevel++;
            code += this.emit(node.elseBranch);
            this.indentLevel--;
          }
        }
      }

      return code;
    }

    emitFor(node) {
      let init = '';
      if (node.initializer) {
        if (node.initializer.nodeType === 'VariableDeclaration') {
          init = `${node.initializer.type.toString()} ${node.initializer.name}`;
          if (node.initializer.initializer) {
            init += ` = ${this.emit(node.initializer.initializer)}`;
          }
        } else {
          init = this.emit(node.initializer);
        }
      }

      const cond = node.condition ? this.emit(node.condition) : '';
      const incr = node.incrementor ? this.emit(node.incrementor) : '';

      let code = this.line(`for (${init}; ${cond}; ${incr})`);
      code += this.emit(node.body);
      return code;
    }

    emitRangeFor(node) {
      let code = this.line(
        `for (${node.variableType.toString()} ${node.variableName} : ${this.emit(node.collection)})`
      );
      code += this.emit(node.body);
      return code;
    }

    emitWhile(node) {
      let code = this.line(`while (${this.emit(node.condition)})`);
      code += this.emit(node.body);
      return code;
    }

    emitDoWhile(node) {
      let code = this.line('do');
      code += this.emit(node.body);
      code = code.trimEnd();
      code += ` while (${this.emit(node.condition)});${this.newline}`;
      return code;
    }

    emitSwitch(node) {
      let code = this.line(`switch (${this.emit(node.expression)})`);
      code += this.line('{');
      this.indentLevel++;

      for (const caseNode of node.cases) {
        code += this.emit(caseNode);
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitSwitchCase(node) {
      let code = '';
      if (node.isDefault) {
        code += this.line('default:');
      } else {
        code += this.line(`case ${this.emit(node.label)}:`);
      }

      // Check if any statements are variable declarations - if so, we need braces
      const hasDeclarations = node.statements.some(stmt =>
        stmt.nodeType === 'VariableDeclaration' ||
        (stmt.nodeType === 'ExpressionStatement' && stmt.expression?.nodeType === 'VariableDeclaration')
      );

      if (hasDeclarations && node.statements.length > 0) {
        // Wrap in braces to create a new scope for variable declarations
        code += this.line('{');
        this.indentLevel++;
        for (const stmt of node.statements) {
          code += this.emit(stmt);
        }
        this.indentLevel--;
        code += this.line('}');
      } else {
        this.indentLevel++;
        for (const stmt of node.statements) {
          code += this.emit(stmt);
        }
        this.indentLevel--;
      }

      return code;
    }

    emitBreak(node) {
      return this.line('break;');
    }

    emitContinue(node) {
      return this.line('continue;');
    }

    emitThrow(node) {
      return this.line(`throw ${this.emit(node.expression)};`);
    }

    emitTryCatch(node) {
      let code = this.line('try');
      code += this.emit(node.tryBlock);

      for (const catchClause of node.catchClauses) {
        code += this.emit(catchClause);
      }

      return code;
    }

    emitCatchClause(node) {
      let code = '';
      if (node.exceptionType) {
        code += this.line(`catch (${node.exceptionType.toString()} ${node.variableName})`);
      } else {
        code += this.line('catch (...)');
      }
      code += this.emit(node.body);
      return code;
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'nullptr') return 'nullptr';
      if (node.literalType === 'bool') return node.value ? 'true' : 'false';
      if (node.literalType === 'string') {
        // Escape string and wrap in quotes
        const escaped = String(node.value)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `"${escaped}"`;
      }
      if (node.literalType === 'char') {
        // Escape char and wrap in single quotes
        const ch = String(node.value);
        const escaped = ch
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `'${escaped}'`;
      }

      // Numeric literal
      let result;
      if (node.isHex) {
        result = `0x${node.value.toString(16).toUpperCase()}`;
      } else {
        result = String(node.value);
      }

      if (node.suffix) {
        result += node.suffix;
      }

      return result;
    }

    emitIdentifier(node) {
      return node.name;
    }

    emitBinaryExpression(node) {
      let left = this.emit(node.left);
      let right = this.emit(node.right);

      // Add parentheses if needed for correct precedence
      if (node.leftNeedsParens) {
        left = `(${left})`;
      }
      if (node.rightNeedsParens) {
        right = `(${right})`;
      }

      return `${left} ${node.operator} ${right}`;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);

      const needsParens = node.operand?.nodeType === 'BinaryExpression' ||
                          node.operand?.nodeType === 'Conditional';

      // Operators that need space before operand
      const needsSpace = ['new', 'delete', 'sizeof', 'alignof', 'typeid'].includes(node.operator);

      if (node.isPrefix) {
        if (needsSpace) {
          return needsParens ? `${node.operator} (${operand})` : `${node.operator} ${operand}`;
        }
        return needsParens ? `${node.operator}(${operand})` : `${node.operator}${operand}`;
      }
      return `${operand}${node.operator}`;
    }

    emitAssignment(node) {
      const target = this.emit(node.target);
      // Handle initializer list assignment - C++11 allows brace init but may need type hint
      if (node.value && node.value.nodeType === 'InitializerList') {
        const init = this.emitInitializerList(node.value);
        // In C++20, use decltype for type-safe brace init
        return `${target} ${node.operator} (decltype(${target}))${init}`;
      }
      return `${target} ${node.operator} ${this.emit(node.value)}`;
    }

    emitMemberAccess(node) {
      const op = node.isPointer ? '->' : '.';
      return `${this.emit(node.target)}${op}${node.member}`;
    }

    emitElementAccess(node) {
      const index = this.emit(node.index).replace(/[\r\n\t]/g, '').replace(/\s+/g, ' ').trim();
      return `${this.emit(node.target)}[${index}]`;
    }

    emitFunctionCall(node) {
      let code = '';
      if (node.target) {
        const op = node.isPointer ? '->' : '.';
        code += `${this.emit(node.target)}${op}`;
      }
      code += node.functionName;

      if (node.templateArgs && node.templateArgs.length > 0) {
        code += `<${node.templateArgs.map(t => t.toString()).join(', ')}>`;
      }

      const args = node.arguments.map(a => this.emit(a));
      code += `(${args.join(', ')})`;
      return code;
    }

    emitObjectCreation(node) {
      let code = `${node.type.toString()}`;

      if (node.arguments.length > 0) {
        const args = node.arguments.map(a => this.emit(a));
        code += `(${args.join(', ')})`;
      } else {
        code += '()';
      }

      return code;
    }

    emitArrayCreation(node) {
      if (node.size) {
        // std::vector<T>(size)
        return `std::vector<${node.elementType.toString()}>(${this.emit(node.size)})`;
      } else if (node.initializer) {
        // For empty initializers, use bare {} to let C++ deduce from target type
        if (node.initializer.length === 0) {
          return `{  }`;
        }
        // For assignments, use explicit type if known and concrete, otherwise let C++ deduce from target
        const elemTypeStr = node.elementType?.toString();
        // Skip auto, void, and DynamicConfig (fallback for unknown types) - let C++ deduce from assignment target
        const skipTypes = ['auto', 'void', 'DynamicConfig'];
        if (elemTypeStr && !skipTypes.includes(elemTypeStr)) {
          return `std::vector<${elemTypeStr}>{ ${node.initializer.map(e => this.emit(e)).join(', ')} }`;
        }
        // Bare initializer - relies on target type for deduction
        return `{ ${node.initializer.map(e => this.emit(e)).join(', ')} }`;
      } else {
        return `std::vector<${node.elementType.toString()}>()`;
      }
    }

    emitInitializerList(node) {
      return `{ ${node.elements.map(e => this.emit(e)).join(', ')} }`;
    }

    emitMapInitializer(node) {
      // Emit as std::map initializer: { {"key1", val1}, {"key2", val2} }
      const pairs = node.pairs.map(p => this.emitInitializerList(p));
      return `{ ${pairs.join(', ')} }`;
    }

    emitCast(node) {
      if (node.castType === 'c-style') {
        return `(${node.type.toString()})(${this.emit(node.expression)})`;
      }
      // Use C++ style casts: static_cast, dynamic_cast, etc.
      return `${node.castType}_cast<${node.type.toString()}>(${this.emit(node.expression)})`;
    }

    emitConditional(node) {
      return `${this.emit(node.condition)} ? ${this.emit(node.trueExpression)} : ${this.emit(node.falseExpression)}`;
    }

    emitLambda(node) {
      let captures = '[]';
      if (node.captures.length > 0) {
        captures = `[${node.captures.join(', ')}]`;
      }

      let params = '';
      if (node.parameters.length > 0) {
        params = `(${node.parameters.map(p => this.emitParameterDecl(p)).join(', ')})`;
      } else {
        params = '()';
      }

      let returnTypeDecl = '';
      if (node.returnType) {
        returnTypeDecl = ` -> ${node.returnType.toString()}`;
      }

      let body;
      if (node.body.nodeType === 'Block') {
        body = this.emit(node.body).trim();
      } else {
        body = `{ return ${this.emit(node.body)}; }`;
      }

      return `${captures}${params}${returnTypeDecl} ${body}`;
    }

    emitThis(node) {
      return 'this';
    }

    emitSizeof(node) {
      return `sizeof(${node.type.toString()})`;
    }

    emitParenthesized(node) {
      return `(${this.emit(node.expression)})`;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ DOCUMENTATION ]========================

    emitDocComment(node) {
      let code = '';

      if (node.brief) {
        code += this.line('/**');
        code += this.line(` * @brief ${node.brief}`);
        if (node.details) {
          code += this.line(' *');
          for (const line of node.details.split('\n')) {
            code += this.line(` * ${line.trim()}`);
          }
        }
      }

      for (const param of node.parameters) {
        code += this.line(` * @param ${param.name} ${param.description}`);
      }

      if (node.returns) {
        code += this.line(` * @return ${node.returns}`);
      }

      if (node.brief) {
        code += this.line(' */');
      }

      return code;
    }
  }

  // Export
  const exports = { CppEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.CppEmitter = CppEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
