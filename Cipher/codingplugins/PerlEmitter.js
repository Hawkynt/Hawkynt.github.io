/**
 * PerlEmitter.js - Perl Code Generator from Perl AST
 * Generates properly formatted Perl source code from PerlAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Perl AST -> Perl Emitter -> Perl Source
 */

(function(global) {
  'use strict';

  // Load PerlAST if available
  let PerlAST;
  if (typeof require !== 'undefined') {
    PerlAST = require('./PerlAST.js');
  } else if (global.PerlAST) {
    PerlAST = global.PerlAST;
  }

  /**
   * Perl Code Emitter
   * Generates formatted Perl code from a Perl AST
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - newline/lineEnding: string - Line ending character (default: '\n')
   * - useStrict: boolean - Add 'use strict'. Default: true
   * - useWarnings: boolean - Add 'use warnings'. Default: true
   */
  // Framework base classes that need stub definitions
  const FRAMEWORK_BASE_CLASSES = new Set([
    'Algorithm', 'IAlgorithmInstance',
    'BlockCipherAlgorithm', 'IBlockCipherInstance',
    'StreamCipherAlgorithm', 'IStreamCipherInstance',
    'HashFunctionAlgorithm', 'IHashFunctionInstance',
    'MacAlgorithm', 'IMacInstance',
    'KdfAlgorithm', 'IKdfInstance',
    'AeadAlgorithm', 'IAeadInstance',
    'CompressionAlgorithm', 'ICompressionInstance',
    'ErrorCorrectionAlgorithm', 'IErrorCorrectionInstance',
    'RandomGenerationAlgorithm', 'IRandomGeneratorInstance',
    'EncodingAlgorithm', 'IEncodingInstance',
    'PaddingAlgorithm', 'IPaddingInstance',
    'CipherModeAlgorithm', 'ICipherModeInstance',
    'AsymmetricCipherAlgorithm', 'IAsymmetricCipherInstance',
    'SymmetricCipherAlgorithm', 'CryptoAlgorithm'
  ]);

  // Framework helper classes (like LinkItem, TestCase, etc.)
  const FRAMEWORK_HELPER_CLASSES = new Set([
    'LinkItem', 'Vulnerability', 'TestCase', 'KeySize', 'AuthResult'
  ]);

  class PerlEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
      this.emittedBaseClassStubs = new Set(); // Track which stubs we've already emitted
      this.skipHelperStubs = options.skipHelperStubs || false; // Skip emitting LinkItem, TestCase, etc.
      this.skipBaseStubs = options.skipBaseStubs || false; // Skip emitting base algorithm class stubs
    }

    /**
     * Emit Perl code from a Perl AST node
     * @param {PerlNode} node - The AST node to emit
     * @returns {string} Generated Perl code
     */
    emit(node) {
      if (!node) return '';

      if (typeof node === 'string') return node;

      // Handle arrays of nodes (e.g., from transformLetStatement)
      if (Array.isArray(node)) {
        return node.map(n => this.emit(n)).filter(s => s).join('');
      }

      // Duck typing fallback for nodes with missing nodeType
      if (!node.nodeType) {
        if (node.statements !== undefined) return this.emitBlock(node);
        if (node.target && node.value && node.operator !== undefined) return this.emitAssignment(node);
        if (node.name && typeof node.name === 'string') return this.emitIdentifier(node);
        // Skip known control objects from transformer (not AST nodes)
        if (node.isMethod !== undefined || node.initStatement !== undefined) return '';
        // Show more debug info for unknown nodes
        const keys = Object.keys(node).slice(0, 5).join(', ');
        console.error(`No emitter for node type: ${node.nodeType} (keys: ${keys})`);
        return '';
      }

      const emitterMethod = `emit${node.nodeType}`;
      if (typeof this[emitterMethod] === 'function') {
        return this[emitterMethod](node);
      }

      console.error(`No emitter for node type: ${node.nodeType}`);
      return `# Unknown node type: ${node.nodeType}`;
    }

    // ========================[ HELPERS ]========================

    indent() {
      return this.indentString.repeat(this.indentLevel);
    }

    line(content = '') {
      return content ? `${this.indent()}${content}${this.newline}` : this.newline;
    }

    /**
     * Generate stub base class package for framework classes
     * @param {string} className - The base class name to stub
     * @returns {string} Perl code defining the stub package
     */
    emitFrameworkBaseClassStub(className) {
      if (this.skipBaseStubs) {
        return ''; // Skip when test harness provides stubs
      }
      if (this.emittedBaseClassStubs.has(className)) {
        return ''; // Already emitted
      }
      this.emittedBaseClassStubs.add(className);

      let code = '';
      code += this.line(`package ${className};`);
      code += this.line('use strict;');
      code += this.line('use warnings;');
      code += this.newline;
      code += this.line('sub new {');
      this.indentLevel++;
      code += this.line('my $class = shift;');
      code += this.line('my $self = { @_ };');
      code += this.line('bless $self, $class;');
      code += this.line('return $self;');
      this.indentLevel--;
      code += this.line('}');
      code += this.newline;
      code += this.line('1;');
      code += this.newline;

      return code;
    }

    /**
     * Emit all framework helper class stubs (LinkItem, TestCase, etc.)
     * These are simple data classes used by algorithm metadata
     * @returns {string} Perl code for all helper class stubs
     */
    emitAllFrameworkHelperStubs() {
      if (this.skipHelperStubs) {
        return ''; // Skip when test harness provides stubs
      }

      let code = '';

      for (const className of FRAMEWORK_HELPER_CLASSES) {
        if (this.emittedBaseClassStubs.has(className)) {
          continue; // Already emitted
        }
        this.emittedBaseClassStubs.add(className);

        code += this.line(`package ${className};`);
        code += this.line('use strict;');
        code += this.line('use warnings;');
        code += this.newline;
        code += this.line('sub new {');
        this.indentLevel++;
        code += this.line('my $class = shift;');
        code += this.line('my $self = { @_ };');
        code += this.line('bless $self, $class;');
        code += this.line('return $self;');
        this.indentLevel--;
        code += this.line('}');
        code += this.newline;
        code += this.line('1;');
        code += this.newline;
      }

      return code;
    }

    // ========================[ MODULE ]========================

    emitModule(node) {
      let code = '';

      // Package declaration
      if (node.packageName && node.packageName !== 'main') {
        code += this.line(`package ${node.packageName};`);
        code += this.newline;
      }

      // Pragmas
      for (const pragma of node.pragmas) {
        code += this.line(`${pragma};`);
      }
      if (node.pragmas.length > 0) {
        code += this.newline;
      }

      // Use declarations
      for (const use of node.uses) {
        code += this.emit(use);
      }
      if (node.uses.length > 0) {
        code += this.newline;
      }

      // Emit framework helper class stubs at the start of the module
      // These are needed by generated code that instantiates framework types
      code += this.emitAllFrameworkHelperStubs();

      // Reorder statements: emit declarations in order that respects dependencies
      // Perl doesn't hoist, so class definitions must come before code that instantiates them
      const simpleVarDecls = [];   // Variables without class constructor calls
      const classInstVarDecls = []; // Variables that call class constructors (e.g., Foo->new())
      const classDefs = [];
      const subDefs = [];
      const otherStmts = [];

      // Helper to check if a node contains a class constructor call (->new())
      const containsConstructorCall = (node) => {
        if (!node) return false;
        // Check for MemberAccess with ->new() call pattern
        // e.g., { nodeType: 'MemberAccess', member: { nodeType: 'Call', callee: { name: 'new' } } }
        if (node.nodeType === 'MemberAccess' && node.member) {
          if (node.member.nodeType === 'Call' && node.member.callee?.name === 'new') return true;
          // Recursively check member
          if (containsConstructorCall(node.member)) return true;
        }
        // Check for direct method call pattern
        if (node.nodeType === 'MethodCall' && node.method === 'new') return true;
        if (node.nodeType === 'Call' && node.callee) {
          // Check for Foo->new() pattern which shows as method call on identifier
          if (node.callee.name === 'new') return true;
          if (node.callee.nodeType === 'MemberAccess' && node.callee.member === 'new') return true;
        }
        // Check initializer for constructor calls
        if (node.initializer) return containsConstructorCall(node.initializer);
        // Check object and arguments
        if (node.object) return containsConstructorCall(node.object);
        if (node.arguments) return node.arguments.some(a => containsConstructorCall(a));
        if (node.args) return node.args.some(a => containsConstructorCall(a));
        if (node.callee) return containsConstructorCall(node.callee);
        return false;
      };

      for (const stmt of node.statements) {
        if (stmt.nodeType === 'VarDeclaration') {
          // Check if the variable initialization involves a class constructor
          if (containsConstructorCall(stmt)) {
            classInstVarDecls.push(stmt);
          } else {
            simpleVarDecls.push(stmt);
          }
        } else if (stmt.nodeType === 'Class')
          classDefs.push(stmt);
        else if (stmt.nodeType === 'Sub')
          subDefs.push(stmt);
        else
          otherStmts.push(stmt);
      }

      // Emit in order:
      // 1. Simple variables (no class constructor calls)
      // 2. Subs (functions)
      // 3. Classes (must be before code that instantiates them)
      // 4. Variables with class constructor calls (after classes are defined)
      // 5. Other statements
      for (const stmt of simpleVarDecls) {
        code += this.emit(stmt);
        code += this.newline;
      }

      for (const stmt of subDefs) {
        code += this.emit(stmt);
        code += this.newline;
      }

      for (const stmt of classDefs) {
        code += this.emit(stmt);
        code += this.newline;
      }

      // After classes, switch back to main package for remaining statements
      // This is needed because Perl packages have implicit scope until the next package declaration
      if (classDefs.length > 0 && (classInstVarDecls.length > 0 || otherStmts.length > 0)) {
        code += this.line('package main;');
        code += this.newline;
      }

      for (const stmt of classInstVarDecls) {
        code += this.emit(stmt);
        code += this.newline;
      }

      for (const stmt of otherStmts) {
        code += this.emit(stmt);
        code += this.newline;
      }

      // End with 1; for modules
      if (node.packageName && node.packageName !== 'main') {
        code += this.newline + this.line('1;');
      }

      return code;
    }

    emitUse(node) {
      let code = node.isRequire ? 'require ' : 'use ';
      code += node.module;

      if (node.version) {
        code += ' ' + node.version;
      }

      if (node.imports && Array.isArray(node.imports)) {
        code += ' qw(' + node.imports.join(' ') + ')';
      }

      return this.line(code + ';');
    }

    // ========================[ PACKAGE/CLASS ]========================

    emitPackage(node) {
      let code = this.line(`package ${node.name};`);
      code += this.newline;

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }

      code += this.newline + this.line('1;');

      return code;
    }

    emitClass(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      if (node.useModernClass) {
        // Emit stub base class if needed (for framework classes)
        if (node.baseClass && FRAMEWORK_BASE_CLASSES.has(node.baseClass)) {
          code += this.emitFrameworkBaseClassStub(node.baseClass);
        }

        // Modern Perl 5.38+ class syntax
        code += this.line(`class ${node.name}`);
        if (node.baseClass) {
          code += ' :isa(' + node.baseClass + ')';
        }
        code += ' {' + this.newline;

        this.indentLevel++;

        // Fields
        for (const field of node.fields) {
          code += this.emit(field);
        }

        if (node.fields.length > 0 && node.methods.length > 0) {
          code += this.newline;
        }

        // Methods
        for (const method of node.methods) {
          code += this.emit(method);
          code += this.newline;
        }

        this.indentLevel--;
        code += this.line('}');
      } else {
        // Blessed hashref OO (zero external dependencies)

        // Emit stub base class if needed (for framework classes)
        if (node.baseClass && FRAMEWORK_BASE_CLASSES.has(node.baseClass)) {
          code += this.emitFrameworkBaseClassStub(node.baseClass);
        }

        code += this.line(`package ${node.name};`);
        code += this.line('use strict;');
        code += this.line('use warnings;');

        if (node.baseClass) {
          // Always use @ISA for inheritance - all classes are defined in same file
          // (use parent tries to load .pm file from @INC which doesn't exist)
          code += this.line(`our @ISA = qw(${node.baseClass});`);
        }

        code += this.newline;

        // Find existing constructor in methods
        const hasConstructor = node.methods.some(m => m.name === 'new');

        // Generate default constructor if none exists
        if (!hasConstructor) {
          code += this.line('sub new {');
          this.indentLevel++;
          code += this.line('my $class = shift;');

          if (node.baseClass) {
            // Call parent constructor
            code += this.line('my $self = $class->SUPER::new(@_);');
          } else {
            // Create new hashref
            code += this.line('my $self = { @_ };');
            code += this.line('bless $self, $class;');
          }

          // Set field defaults
          for (const field of node.fields) {
            if (field.defaultValue) {
              const emittedDefault = this.emit(field.defaultValue);
              code += this.line(`$self->{${field.name}} //= ${emittedDefault};`);
            }
          }

          code += this.line('return $self;');
          this.indentLevel--;
          code += this.line('}');
          code += this.newline;
        }

        // Generate accessors for fields
        for (const field of node.fields) {
          code += this.emitFieldAsAccessor(field);
        }

        if (node.fields.length > 0 && node.methods.length > 0) {
          code += this.newline;
        }

        // Methods
        for (const method of node.methods) {
          code += this.emit(method);
          code += this.newline;
        }

        code += this.line('1;');
      }

      return code;
    }

    emitField(node) {
      // For modern class keyword
      let code = this.indent() + 'field $' + node.name;

      if (node.defaultValue) {
        code += ' = ' + this.emit(node.defaultValue);
      }

      return code + ';' + this.newline;
    }

    emitFieldAsMoo(node) {
      // For Moo/Moose (deprecated - use emitFieldAsAccessor instead)
      let code = this.line(`has ${node.name} => (`);
      this.indentLevel++;

      code += this.line('is => ' + (node.isReadOnly ? '"ro"' : '"rw"') + ',');

      if (node.type) {
        code += this.line(`isa => ${node.type.toString()},`);
      }

      if (node.defaultValue) {
        const emittedDefault = this.emit(node.defaultValue);
        // If default references $self, wrap in sub { } since $self doesn't exist at definition time
        if (/\$self\b/.test(emittedDefault)) {
          // Replace $self with shift-> for the closure
          const closureDefault = emittedDefault.replace(/\$self->/g, 'shift->');
          code += this.line('default => sub { ' + closureDefault + ' },');
        } else {
          code += this.line('default => ' + emittedDefault + ',');
        }
      }

      if (node.isRequired) {
        code += this.line('required => 1,');
      }

      this.indentLevel--;
      code += this.line(');');

      return code;
    }

    emitFieldAsAccessor(node) {
      // Blessed hashref accessor (zero dependencies)
      let code = '';

      if (node.isReadOnly) {
        // Read-only accessor
        code += this.line(`sub ${node.name} {`);
        this.indentLevel++;
        code += this.line('my $self = shift;');
        code += this.line(`return $self->{${node.name}};`);
        this.indentLevel--;
        code += this.line('}');
      } else {
        // Read-write accessor
        code += this.line(`sub ${node.name} {`);
        this.indentLevel++;
        code += this.line('my $self = shift;');
        code += this.line(`if (@_) { $self->{${node.name}} = shift; }`);
        code += this.line(`return $self->{${node.name}};`);
        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    // ========================[ SUBROUTINES ]========================

    emitSub(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      // Subroutine declaration
      let decl = 'sub ' + node.name;

      if (node.useSignatures && node.parameters.length > 0) {
        // Modern Perl signatures
        const params = node.parameters.map(p => this.emitParameterSignature(p));
        decl += ' (' + params.join(', ') + ')';
      }

      code += this.line(decl + ' {');

      this.indentLevel++;

      // Traditional parameter extraction if not using signatures
      if (!node.useSignatures && node.parameters.length > 0) {
        const params = node.parameters.map((p, i) => {
          return `my ${p.sigil}${p.name} = $_[${i}];`;
        });
        code += this.line(params.join(' '));
        code += this.newline;
      }

      // Body
      if (node.body) {
        code += this.emitBlockContents(node.body);
      }

      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitParameterSignature(node) {
      let param = node.sigil + node.name;

      if (node.defaultValue) {
        param += ' = ' + this.emit(node.defaultValue);
      }

      return param;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      let code = this.line('{');
      this.indentLevel++;
      code += this.emitBlockContents(node);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitBlockContents(node) {
      let code = '';

      if (!node || !node.statements) {
        return code;
      }

      for (const stmt of node.statements) {
        // Handle arrays of statements (e.g., from transformLetStatement)
        if (Array.isArray(stmt)) {
          for (const s of stmt) {
            code += this.emit(s);
          }
        } else {
          code += this.emit(stmt);
        }
      }

      return code;
    }

    emitVarDeclaration(node) {
      // For 'our' declarations with initializers, split into declaration + assignment
      // This ensures the variable is visible inside closures within the initializer
      // (Perl doesn't make 'our $x' visible in 'our $x = sub { $x }' initializer)
      if (node.declarator === 'our' && node.initializer) {
        let code = this.line(node.declarator + ' ' + node.sigil + node.name + ';');
        code += this.line(node.sigil + node.name + ' = ' + this.emit(node.initializer) + ';');
        return code;
      }

      let code = node.declarator + ' ' + node.sigil + node.name;

      if (node.initializer) {
        code += ' = ' + this.emit(node.initializer);
      }

      return this.line(code + ';');
    }

    emitExpressionStatement(node) {
      return this.line(this.emit(node.expression) + ';');
    }

    emitReturn(node) {
      if (node.expression) {
        return this.line('return ' + this.emit(node.expression) + ';');
      }
      return this.line('return;');
    }

    emitIf(node) {
      const keyword = node.isUnless ? 'unless' : 'if';
      let code = this.line(keyword + ' (' + this.emit(node.condition) + ') {');

      this.indentLevel++;
      code += this.emitBlockContents(node.thenBranch);
      this.indentLevel--;
      code += this.line('}');

      // elsif branches (array format)
      if (node.elsifBranches) {
        for (const elsif of node.elsifBranches) {
          code = code.trimEnd();
          code += ' elsif (' + this.emit(elsif.condition) + ') {' + this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(elsif.body);
          this.indentLevel--;
          code += this.line('}');
        }
      }

      // else branch - can be a PerlBlock or another PerlIf (for switch chains)
      if (node.elseBranch) {
        // Check if elseBranch is another PerlIf node (from switch statement transform)
        if (node.elseBranch.nodeType === 'If') {
          // Emit as elsif, then recurse for remaining chain
          code = code.trimEnd();
          code += ' elsif (' + this.emit(node.elseBranch.condition) + ') {' + this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(node.elseBranch.thenBranch);
          this.indentLevel--;
          code += this.line('}');
          // Recursively handle the rest of the chain
          if (node.elseBranch.elseBranch) {
            // Create a temporary node to handle the remaining chain
            const remainingChain = node.elseBranch;
            while (remainingChain.elseBranch) {
              if (remainingChain.elseBranch.nodeType === 'If') {
                code = code.trimEnd();
                code += ' elsif (' + this.emit(remainingChain.elseBranch.condition) + ') {' + this.newline;
                this.indentLevel++;
                code += this.emitBlockContents(remainingChain.elseBranch.thenBranch);
                this.indentLevel--;
                code += this.line('}');
                remainingChain.elseBranch = remainingChain.elseBranch.elseBranch;
              } else {
                // Final else block
                code = code.trimEnd();
                code += ' else {' + this.newline;
                this.indentLevel++;
                code += this.emitBlockContents(remainingChain.elseBranch);
                this.indentLevel--;
                code += this.line('}');
                break;
              }
            }
          }
        } else {
          // Regular else block (PerlBlock)
          code = code.trimEnd();
          code += ' else {' + this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(node.elseBranch);
          this.indentLevel--;
          code += this.line('}');
        }
      }

      return code;
    }

    emitFor(node) {
      if (node.isCStyle) {
        // C-style for loop
        let code = 'for (';
        if (node.init) {
          // Handle multiple variable declarations in for init
          // JavaScript: for (let r = 0, k = 0; ...) -> Perl: for (my ($r, $k) = (0, 0); ...)
          if (Array.isArray(node.init) && node.init.length > 1) {
            // Multiple declarations - combine into single my (...) = (...)
            const names = node.init.map(n => '$' + n.name);
            const values = node.init.map(n => n.initializer ? this.emit(n.initializer) : 'undef');
            code += `my (${names.join(', ')}) = (${values.join(', ')})`;
          } else {
            // Single declaration or expression - emit normally
            let initCode = this.emit(node.init).trim();
            // Strip trailing semicolons to avoid double semicolons in for-loop syntax
            code += initCode.replace(/;+\s*$/, '');
          }
        }
        code += '; ';
        if (node.condition) code += this.emit(node.condition);
        code += '; ';
        if (node.increment) code += this.emit(node.increment);
        code += ') {';
        code = this.line(code);
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line('}');

        return code;
      }

      // foreach loop
      let iterableCode = this.emit(node.iterable).trim();
      // If iterable is a simple scalar (starts with $, doesn't contain function/block syntax),
      // wrap in @{ } for dereferencing
      // This converts: foreach my $byte ($data) -> foreach my $byte (@{$data})
      let foreachIterable = iterableCode;
      // Only wrap if it's a simple scalar or hash access - not complex expressions like map {...}
      const isSimpleScalar = iterableCode.startsWith('$') && !iterableCode.includes('{');
      const isHashAccess = iterableCode.startsWith('$') && /^\$[a-zA-Z_][a-zA-Z0-9_]*->\{/.test(iterableCode);
      if ((isSimpleScalar || isHashAccess) && !iterableCode.startsWith('@{')) {
        // Scalar variable or hash reference - needs dereferencing for list context
        foreachIterable = `@{${iterableCode}}`;
      }

      let code = this.line('foreach my ' + node.variable + ' (' + foreachIterable + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhile(node) {
      const keyword = node.isUntil ? 'until' : 'while';

      if (node.isDoWhile) {
        let code = this.line('do {');
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line('} ' + keyword + ' (' + this.emit(node.condition) + ');');
        return code;
      }

      let code = this.line(keyword + ' (' + this.emit(node.condition) + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitLast(node) {
      let code = 'last';
      if (node.label) {
        code += ' ' + node.label;
      }
      return this.line(code + ';');
    }

    emitNext(node) {
      let code = 'next';
      if (node.label) {
        code += ' ' + node.label;
      }
      return this.line(code + ';');
    }

    emitRedo(node) {
      let code = 'redo';
      if (node.label) {
        code += ' ' + node.label;
      }
      return this.line(code + ';');
    }

    emitDie(node) {
      return this.line('die ' + this.emit(node.message) + ';');
    }

    emitTry(node) {
      // Use eval-based error handling for maximum Perl compatibility
      // This works on all Perl versions without requiring modules or features
      let code = this.line('eval {');
      this.indentLevel++;
      code += this.emitBlockContents(node.tryBlock);
      this.indentLevel--;
      code += this.line('};');

      if (node.catchBlock) {
        code += this.line('if ($@) {');
        this.indentLevel++;
        // Capture the error in the catch variable
        const catchVar = node.catchVariable || '$_error';
        code += this.line(`my ${catchVar} = $@;`);
        code += this.emitBlockContents(node.catchBlock);
        this.indentLevel--;
        code += this.line('}');
      }

      // Note: Perl's eval doesn't have finally, but we can simulate by always running
      if (node.finallyBlock) {
        code += this.emitBlockContents(node.finallyBlock);
      }

      return code;
    }


    emitGiven(node) {
      let code = this.line('given (' + this.emit(node.expression) + ') {');
      this.indentLevel++;

      for (const whenClause of node.whenClauses) {
        code += this.emit(whenClause);
      }

      if (node.defaultClause) {
        code += this.line('default {');
        this.indentLevel++;
        code += this.emitBlockContents(node.defaultClause);
        this.indentLevel--;
        code += this.line('}');
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhen(node) {
      let code = this.line('when (' + this.emit(node.condition) + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'undef') {
        return 'undef';
      }

      if (node.literalType === 'number') {
        return String(node.value);
      }

      if (node.literalType === 'hex') {
        return '0x' + node.value.toString(16).toUpperCase();
      }

      if (node.literalType === 'string') {
        let delimiter = node.stringDelimiter || "'";
        let escaped = String(node.value);

        if (delimiter === '"') {
          // Double-quoted string - escape special chars
          escaped = escaped
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/\$/g, '\\$')
            .replace(/@/g, '\\@');
        } else {
          // Single-quoted string - Perl only allows \\ and \' at end of string
          // If string contains single quotes, switch to double quotes
          if (escaped.includes("'")) {
            delimiter = '"';
            escaped = escaped
              .replace(/\\/g, '\\\\')
              .replace(/"/g, '\\"')
              .replace(/\$/g, '\\$')
              .replace(/@/g, '\\@');
          } else {
            escaped = escaped.replace(/\\/g, '\\\\');
          }
        }

        return delimiter + escaped + delimiter;
      }

      return String(node.value);
    }

    emitGrouped(node) {
      const inner = this.emit(node.expression);
      return `(${inner})`;
    }

    emitIdentifier(node) {
      return node.sigil + node.name;
    }

    // Operator precedence for Perl (higher number = higher precedence)
    // Based on Perl precedence: https://perldoc.perl.org/perlop
    getOperatorPrecedence(op) {
      const precedence = {
        // Assignment (lowest)
        '=': 1, '+=': 1, '-=': 1, '*=': 1, '/=': 1, '|=': 1, '&=': 1, '^=': 1, '<<=': 1, '>>=': 1,
        // Ternary
        '?:': 2,
        // Logical or
        '||': 3, '//': 3,
        // Logical and
        '&&': 4,
        // Bitwise or
        '|': 5,
        // Bitwise xor
        '^': 6,
        // Bitwise and
        '&': 7,
        // Equality
        '==': 8, '!=': 8, 'eq': 8, 'ne': 8, '<=>': 8, 'cmp': 8,
        // Comparison
        '<': 9, '>': 9, '<=': 9, '>=': 9, 'lt': 9, 'gt': 9, 'le': 9, 'ge': 9,
        // Shift
        '<<': 10, '>>': 10,
        // Addition
        '+': 11, '-': 11, '.': 11,
        // Multiplication
        '*': 12, '/': 12, '%': 12, 'x': 12,
        // Exponentiation
        '**': 13,
        // Unary (highest)
        '~': 14, '!': 14
      };
      return precedence[op] || 0;
    }

    emitBinaryExpression(node) {
      const parentPrecedence = this.getOperatorPrecedence(node.operator);

      // Wrap left operand if it has lower precedence
      let left = this.emit(node.left);
      if (node.left && node.left.nodeType === 'BinaryExpression') {
        const leftPrecedence = this.getOperatorPrecedence(node.left.operator);
        if (leftPrecedence < parentPrecedence)
          left = `(${left})`;
      }

      // Wrap right operand if it has lower or equal precedence (for right-associativity safety)
      let right = this.emit(node.right);
      if (node.right && node.right.nodeType === 'BinaryExpression') {
        const rightPrecedence = this.getOperatorPrecedence(node.right.operator);
        if (rightPrecedence <= parentPrecedence)
          right = `(${right})`;
      }

      return `${left} ${node.operator} ${right}`;
    }

    emitUnaryExpression(node) {
      const operand = this.emit(node.operand);

      if (node.isPrefix) {
        // For @ and % operators (array/hash dereference), we need special handling
        if (node.operator === '@' || node.operator === '%') {
          // Anonymous array/hash refs need wrapping: @[1,2,3] -> @{[1,2,3]}
          if (operand.startsWith('[') || operand.startsWith('{')) {
            return `${node.operator}{${operand}}`;
          }
          // Block-style function calls (map/grep/sort/do) need parentheses to disambiguate
          // @{do{...}} is ambiguous and resolved to @do{...} (hash slice) even with space
          // Use @{(do {...})} to force correct parsing
          // IMPORTANT: Check this BEFORE -> check, because do{} blocks may contain -> inside them
          if (/^(map|grep|sort|reverse|do)\b/.test(operand)) {
            return `${node.operator}{(${operand})}`;
          }
          // Complex expressions need wrapping: @$arr->[$i] -> @{$arr->[$i]}
          // Check if operand contains -> (subscript/method access)
          if (operand.includes('->')) {
            return `${node.operator}{${operand}}`;
          }
          // Function calls need wrapping: @Hp(...) -> @{Hp(...)}
          if (/^[A-Za-z_][A-Za-z0-9_]*\(/.test(operand)) {
            return `${node.operator}{${operand}}`;
          }
          // Simple scalar variable: @$arr is fine
          return `${node.operator}${operand}`;
        }
        return `${node.operator}${operand}`;
      } else {
        return `${operand}${node.operator}`;
      }
    }

    emitAssignment(node) {
      return `${this.emit(node.target)} ${node.operator} ${this.emit(node.value)}`;
    }

    emitMemberAccess(node) {
      const object = this.emit(node.object);
      let member;

      if (typeof node.member === 'string') {
        member = node.member;
      } else {
        member = this.emit(node.member);
      }

      if (node.accessType === '::') {
        // Package namespace access: List::Util::min
        return `${object}::${member}`;
      } else if (node.accessType === '->') {
        return `${object}->${member}`;
      } else if (node.accessType === '{key}') {
        // Hash reference access: $self->{key} not $self{key}
        return `${object}->{${member}}`;
      } else if (node.accessType === '[index]') {
        // Array reference access: $self->[index]
        return `${object}->[${member}]`;
      }

      return `${object}->${member}`;
    }

    emitSubscript(node) {
      let object = this.emit(node.object);
      const index = this.emit(node.index).replace(/[\n\r\t]/g, '').trim();

      // In Perl, when accessing a single element:
      // - %hash{key} should be $hash{key} (scalar context, no arrow)
      // - @array[0] should be $array[0] (scalar context, no arrow)
      // Change sigil for simple identifiers (these don't need arrows)
      let wasSimpleAggregate = false;
      if (/^[%@][a-zA-Z_][a-zA-Z0-9_]*$/.test(object)) {
        object = '$' + object.slice(1);
        wasSimpleAggregate = true;  // Track this to avoid adding arrow
      }

      // Determine if we need -> before the subscript
      // In Perl, after a method call, hash access, or array access, we need ->
      let needsArrow = node.isRefDeref;

      if (!needsArrow && !wasSimpleAggregate) {
        const lastChar = object.slice(-1);
        // If object ends with ) ] or }, it's a call/subscript result - needs ->
        if (lastChar === ')' || lastChar === ']' || lastChar === '}')
          needsArrow = true;
        // If object starts with $, it's likely an arrayref
        else if (/^\$[a-zA-Z_]/.test(object))
          needsArrow = true;
      }

      const accessor = needsArrow ? '->' : '';

      // Debug: check if isRefDeref is being set correctly
      // console.log(`emitSubscript: ${object}${accessor}[${index}], isRefDeref=${node.isRefDeref}, subscriptType=${node.subscriptType}`);

      if (node.subscriptType === 'array')
        return `${object}${accessor}[${index}]`;
      else
        return `${object}${accessor}{${index}}`;
    }

    emitCall(node) {
      // Handle null callee - used for IIFE patterns like (sub {...})->()
      if (node.callee === null || node.callee === undefined) {
        const args = node.args.map(a => this.emit(a));
        return `(${args.join(', ')})`;
      }

      // Handle IIFE: when callee is an anonymous sub, use (sub { ... })->(args) syntax
      if (node.callee && node.callee.nodeType === 'AnonSub') {
        const subCode = this.emit(node.callee);
        const args = node.args.map(a => this.emit(a));
        return `(${subCode})->(${args.join(', ')})`;
      }

      const callee = typeof node.callee === 'string' ? node.callee : this.emit(node.callee);

      // Handle List::Util block-style functions (any, all, first, none, notall, reduce)
      // Syntax: List::Util::any { block } @array  (NOT with parentheses and commas)
      const listUtilBlockFuncs = ['List::Util::any', 'List::Util::all', 'List::Util::first', 'List::Util::none', 'List::Util::notall'];
      if (listUtilBlockFuncs.includes(callee) && node.args.length >= 2) {
        const blockArg = node.args[0];
        const arrayArg = node.args[1];

        // Emit the block - if it's a PerlBlock, emit its contents inside { }
        let blockStr;
        if (blockArg && blockArg.nodeType === 'Block') {
          const stmts = blockArg.statements.map(s => this.emit(s)).join(' ');
          blockStr = `{ ${stmts} }`;
        } else {
          // Fallback - emit as-is
          blockStr = `{ ${this.emit(blockArg)} }`;
        }

        // Emit the array argument
        const arrayStr = this.emit(arrayArg);

        return `${callee} ${blockStr} ${arrayStr}`;
      }

      // Handle List::Util::reduce which has special syntax: reduce { block } @array or reduce { block } initialValue, @array
      if (callee === 'List::Util::reduce' && node.args.length >= 2) {
        const blockArg = node.args[0];
        const restArgs = node.args.slice(1).map(a => this.emit(a));

        let blockStr;
        if (blockArg && blockArg.nodeType === 'Block') {
          const stmts = blockArg.statements.map(s => this.emit(s)).join(' ');
          blockStr = `{ ${stmts} }`;
        } else {
          blockStr = `{ ${this.emit(blockArg)} }`;
        }

        return `${callee} ${blockStr} ${restArgs.join(', ')}`;
      }

      // Handle map and grep with block syntax: map { BLOCK } @array
      // Perl's map/grep use $_ for the current element, not named parameters
      if ((callee === 'map' || callee === 'grep') && node.args.length >= 2) {
        const blockArg = node.args[0];
        const arrayArg = node.args[1];

        // Emit the array argument
        const arrayStr = this.emit(arrayArg);

        // If the callback is an AnonSub, convert to block with $_ substitution
        if (blockArg && blockArg.nodeType === 'AnonSub') {
          const paramName = blockArg.parameters?.[0]?.name;
          const blockStr = this.emitMapGrepBlock(blockArg.body, paramName);
          return `${callee} ${blockStr} ${arrayStr}`;
        }

        // If it's a Block, emit directly
        if (blockArg && blockArg.nodeType === 'Block') {
          const stmts = blockArg.statements.map(s => this.emit(s)).join(' ');
          return `${callee} { ${stmts} } ${arrayStr}`;
        }

        // Fallback - emit as function call
        const blockStr = `{ ${this.emit(blockArg)} }`;
        return `${callee} ${blockStr} ${arrayStr}`;
      }

      // Handle do { block } - special Perl syntax without parentheses
      // do executes a block and returns the last expression's value
      if (callee === 'do' && node.args.length === 1 && node.args[0].nodeType === 'Block') {
        const block = node.args[0];
        const stmts = [];
        for (let i = 0; i < block.statements.length; ++i) {
          const stmt = block.statements[i];
          let code = this.emit(stmt);
          // Ensure each statement in the do block ends with a semicolon
          // The emitter already adds semicolons for most statements, but not for bare identifiers
          if (stmt.nodeType === 'Identifier' || (stmt.nodeType === 'Call' && i === block.statements.length - 1)) {
            if (!code.trim().endsWith(';')) {
              code = code.trim() + ';';
            }
          }
          stmts.push(code.trim());
        }
        return `do { ${stmts.join(' ')} }`;
      }

      const args = node.args.map(a => this.emit(a));

      if (node.isMethodCall) {
        return `${callee}(${args.join(', ')})`;
      }

      // Handle Perl builtins that require arrays (not array refs) as first argument
      const arrayBuiltins = ['push', 'pop', 'shift', 'unshift', 'splice'];
      if (arrayBuiltins.includes(callee) && args.length > 0) {
        // Dereference the first arg if it's a scalar (array reference)
        // $arr -> @{$arr}, $self->{buffer} -> @{$self->{buffer}}
        // Skip if already dereferenced (@arr or @{...})
        const firstArg = args[0];
        if (!firstArg.startsWith('@') && (firstArg.startsWith('$') || firstArg.includes('->{'))) {
          args[0] = `@{${firstArg}}`;
        }
      }

      // Handle code references (variables holding function refs)
      // In Perl, $coderef->() is the syntax for calling a code reference
      // Detect if callee is a scalar variable (starts with $) that could hold a code ref
      if (callee.startsWith('$') && !arrayBuiltins.includes(callee.slice(1))) {
        return `${callee}->(${args.join(', ')})`;
      }

      return `${callee}(${args.join(', ')})`;
    }

    /**
     * Emit a map/grep block with $_ substitution for the element parameter
     * @param {PerlBlock} body - The body of the callback
     * @param {string} paramName - The parameter name to replace with $_
     * @returns {string} Perl block code string
     */
    emitMapGrepBlock(body, paramName) {
      if (!body || !body.statements || body.statements.length === 0)
        return '{ }';

      // For map/grep, we need to emit the expression (not a return statement)
      // and replace references to paramName with $_
      const stmts = [];
      for (const stmt of body.statements) {
        // If it's a Return statement, just emit the expression
        if (stmt.nodeType === 'Return' && stmt.expression) {
          const expr = this.emitWithSubstitution(stmt.expression, paramName, '$_');
          stmts.push(expr);
        } else {
          // Emit the statement with substitution
          const code = this.emitWithSubstitution(stmt, paramName, '$_');
          stmts.push(code);
        }
      }

      return `{ ${stmts.join('; ')} }`;
    }

    /**
     * Emit a node with variable name substitution
     * @param {PerlNode} node - The node to emit
     * @param {string} oldName - Variable name to replace
     * @param {string} newName - Replacement (e.g., '$_')
     * @returns {string} Emitted code with substitution
     */
    emitWithSubstitution(node, oldName, newName) {
      if (!node) return '';

      // Handle identifier - replace if it matches the param name
      if (node.nodeType === 'Identifier') {
        if (node.name === oldName)
          return newName;
        return this.emit(node);
      }

      // For expressions, emit normally and do string replacement
      // This is a simple approach - could be made more robust with AST rewriting
      let emitted = this.emit(node);

      // Replace $paramName with $_ (handle both $b and $b-> patterns)
      if (oldName) {
        // Match $paramName at word boundary or followed by ->
        const pattern = new RegExp(`\\$${oldName}(?![a-zA-Z0-9_])`, 'g');
        emitted = emitted.replace(pattern, newName);
      }

      return emitted;
    }

    /**
     * Emit a reduce block - inline do block for array reduction
     * Generates: do { my $acc = init; for my $x (@{$array}) { $acc = expr } $acc }
     */
    emitReduceBlock(node) {
      const initValue = this.emit(node.initialValue);
      const bodyExpr = this.emit(node.bodyExpr);
      let arrayExpr = this.emit(node.array);

      // Dereference array if it's a scalar reference
      if (arrayExpr.startsWith('$') || arrayExpr.includes('->{') || arrayExpr.includes('->[')) {
        arrayExpr = `@{${arrayExpr}}`;
      }

      // Generate inline do block
      return `do { my $acc = ${initValue}; for my $x (${arrayExpr}) { $acc = ${bodyExpr} } $acc }`;
    }

    emitArray(node) {
      const elements = node.elements.map(e => {
        const emitted = this.emit(e);
        // Handle spread elements: [...$arr] should become @$arr or @{$arr}
        // Check if this element has a spread flag or if it's a variable that needs dereferencing
        if (e.spread || e.isSpread) {
          // Explicitly marked as spread - dereference to flatten into parent array
          // This handles: [...$arr], [...[a,b,c]], [...func()], etc.
          if (emitted.startsWith('[') && emitted.endsWith(']')) {
            // Array literal - wrap and dereference to flatten
            return `@{${emitted}}`;
          }
          if (emitted.startsWith('$') || emitted.includes('->')) {
            // Scalar/reference - dereference to flatten
            return `@{${emitted}}`;
          }
        }
        return emitted;
      });
      // Use [] for array references (JavaScript arrays are always references)
      return `[${elements.join(', ')}]`;
    }

    emitHash(node) {
      const pairs = node.pairs.map(p => {
        let key;
        if (typeof p.key === 'string') {
          // Check if key needs quoting (contains special chars like hyphens, spaces, etc.)
          if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p.key)) {
            key = p.key;  // Safe bareword
          } else if (p.key.includes("'")) {
            // Contains single quote - use double quotes with proper escaping
            const escaped = p.key
              .replace(/\\/g, '\\\\')
              .replace(/"/g, '\\"')
              .replace(/\$/g, '\\$')
              .replace(/@/g, '\\@');
            key = `"${escaped}"`;
          } else {
            key = `'${p.key}'`;  // Safe for single quotes
          }
        } else {
          key = this.emit(p.key);
        }
        const value = this.emit(p.value);
        return `${key} => ${value}`;
      });
      // Use {} for hash references (JavaScript objects are always references)
      return `{${pairs.join(', ')}}`;
    }

    emitArraySlice(node) {
      const arrayStr = this.emit(node.array);
      let sliceArray;
      let needsWrapping = false;

      // For array slicing, we need @ context
      // In JS/this codebase, arrays are ALWAYS stored as references (arrayrefs)
      // So $arr holds [...] and needs @{$arr} to dereference, NOT @arr
      if (arrayStr.startsWith('$') || arrayStr.includes('->{') || arrayStr.includes('->[')) {
        // All scalar variables are arrayrefs - use block dereference @{...}
        sliceArray = `@{${arrayStr}}`;
      } else if (arrayStr.startsWith('@')) {
        // Already an array (unlikely in our context) - use as-is
        sliceArray = arrayStr;
      } else if (arrayStr.startsWith('[')) {
        // Anonymous array literal - need to dereference it: @{[...]}[slice]
        // And wrap result in [] to create arrayref
        sliceArray = `@{${arrayStr}}`;
        needsWrapping = true;
      } else if (/^[A-Za-z_][A-Za-z0-9_]*\(/.test(arrayStr) || arrayStr.includes('(')) {
        // Function call returning an array reference - wrap in @{...}
        // e.g., func(...)[0..5] -> @{func(...)}[0..5]
        sliceArray = `@{${arrayStr}}`;
        needsWrapping = true;
      } else {
        sliceArray = arrayStr;
      }

      const start = this.emit(node.start);
      if (node.end === null) {
        // For last index, use $#{$ref} for arrayrefs
        let lastIndex;
        if (arrayStr.startsWith('$') || arrayStr.includes('->{') || arrayStr.includes('->[')) {
          // Arrayref - use $#{$ref}
          lastIndex = `$#{${arrayStr}}`;
        } else if (arrayStr.startsWith('@')) {
          const baseArray = arrayStr.slice(1);
          lastIndex = `$#${baseArray}`;
        } else if (arrayStr.startsWith('[')) {
          lastIndex = `$#{${arrayStr}}`;
        } else {
          lastIndex = `$#{${arrayStr}}`;
        }
        const result = `${sliceArray}[${start} .. ${lastIndex}]`;
        return needsWrapping ? `[${result}]` : result;
      }
      const end = this.emit(node.end);
      const result = `${sliceArray}[${start} .. ${end}]`;
      return needsWrapping ? `[${result}]` : result;
    }

    emitAnonSub(node) {
      let code = 'sub';

      if (node.parameters && node.parameters.length > 0) {
        const params = node.parameters.map(p => p.sigil + p.name);
        code += ' (' + params.join(', ') + ')';
      }

      code += ' {' + this.newline;
      this.indentLevel++;

      if (node.body) {
        code += this.emitBlockContents(node.body);
      }

      this.indentLevel--;
      code += this.indent() + '}';

      return code;
    }

    emitBless(node) {
      return `bless ${this.emit(node.reference)}, '${node.className}'`;
    }

    emitConditional(node) {
      return `${this.emit(node.condition)} ? ${this.emit(node.consequent)} : ${this.emit(node.alternate)}`;
    }

    emitList(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `(${elements.join(', ')})`;
    }

    emitQw(node) {
      return `qw(${node.words.join(' ')})`;
    }

    emitRegex(node) {
      return `/${node.pattern}/${node.modifiers}`;
    }

    emitStringInterpolation(node) {
      let result = '"';
      for (const part of node.parts) {
        if (typeof part === 'string') {
          // String literal part
          result += part
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\$/g, '\\$')
            .replace(/@/g, '\\@');
        } else {
          // Expression part - handle based on type
          const emitted = this.emit(part);
          if (part.type === 'Identifier' && emitted.startsWith('$')) {
            // Simple variable: just use $varname directly
            result += emitted;
          } else {
            // Complex expression: use @{[expr]} for interpolation
            result += '@{[' + emitted + ']}';
          }
        }
      }
      result += '"';
      return result;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ DOCUMENTATION ]========================

    emitPOD(node) {
      let code = this.line('=' + node.podType);
      code += this.newline;
      code += this.line(node.content);
      code += this.newline;
      code += this.line('=cut');
      return code;
    }

    emitComment(node) {
      return this.line('# ' + node.text);
    }

    emitRawCode(node) {
      // Return raw code as-is without adding indentation or newlines
      // This is used for inline expressions that are embedded in other code
      return node.code;
    }
  }

  // Export
  const exports = { PerlEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PerlEmitter = PerlEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
