/**
 * OpCodesInliner.js - Dynamic OpCodes method extraction for standalone code generation
 *
 * This module parses OpCodes.js at runtime to extract method implementations,
 * then transforms them to the target language using the existing AST pipeline.
 * This ensures inlined code always matches the actual OpCodes implementation.
 */

(function(global) {
  'use strict';

  let _opCodesAst = null;
  let _methodCache = new Map();

  /**
   * Load OpCodes.js and extract method source code using regex
   * @returns {Map<string, Object>} Map of method name to source info
   */
  function _loadOpCodesAST() {
    if (_opCodesAst)
      return _opCodesAst;

    _opCodesAst = new Map();

    try {
      // Get the OpCodes source
      let opCodesSource;

      if (typeof require !== 'undefined') {
        // Node.js - read from file
        const fs = require('fs');
        const path = require('path');
        const opCodesPath = path.join(__dirname, '..', 'OpCodes.js');
        opCodesSource = fs.readFileSync(opCodesPath, 'utf8');
      } else if (typeof window !== 'undefined' && window.OpCodesSource) {
        // Browser - use pre-loaded source
        opCodesSource = window.OpCodesSource;
      } else {
        console.warn('OpCodesInliner: Cannot load OpCodes.js source');
        return _opCodesAst;
      }

      // Extract methods using regex-based parsing
      _extractMethodsFromSource(opCodesSource, _opCodesAst);

    } catch (error) {
      console.error('OpCodesInliner: Failed to load OpCodes.js:', error.message);
    }

    return _opCodesAst;
  }

  /**
   * Extract method definitions from OpCodes source using regex
   * Looks for pattern: MethodName: function(params) { body }
   */
  function _extractMethodsFromSource(source, methodMap) {
    // Match method definitions: name: function(params) { body }
    // Uses a state machine to handle nested braces
    // Preserves relative indentation within method bodies
    const lines = source.split('\n');
    let currentMethod = null;
    let methodSource = [];
    let braceDepth = 0;
    let inMethod = false;
    let baseIndent = 0; // Track the base indentation of the method

    for (let i = 0; i < lines.length; ++i) {
      const line = lines[i];

      // Check for method start: "    MethodName: function(params) {"
      const methodStart = line.match(/^(\s{4})(\w+):\s*function\s*\(([^)]*)\)\s*\{?\s*$/);
      if (methodStart && !inMethod) {
        baseIndent = methodStart[1].length; // Usually 4 spaces
        currentMethod = methodStart[2];
        const params = methodStart[3];
        // Store first line without base indent but keep method signature format
        methodSource = [line.substring(baseIndent)];
        braceDepth = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        inMethod = braceDepth > 0 || !line.includes('{');

        // Check if it's a one-liner
        if (braceDepth === 0 && line.includes('{') && line.includes('}')) {
          methodMap.set(currentMethod, {
            name: currentMethod,
            params: params.split(',').map(p => p.trim()).filter(p => p),
            source: methodSource.join('\n')
          });
          currentMethod = null;
          inMethod = false;
        }
        continue;
      }

      if (inMethod) {
        // Remove base indentation but preserve relative indentation within method
        const dedentedLine = line.length > baseIndent ? line.substring(baseIndent) : line.trimStart();
        methodSource.push(dedentedLine);
        braceDepth += (line.match(/\{/g) || []).length;
        braceDepth -= (line.match(/\}/g) || []).length;

        // Method ends when we're back to brace depth 0
        if (braceDepth <= 0) {
          // Remove trailing comma if present
          const fullSource = methodSource.join('\n').replace(/,\s*$/, '');

          methodMap.set(currentMethod, {
            name: currentMethod,
            params: _extractParams(methodSource[0]),
            source: fullSource
          });

          currentMethod = null;
          methodSource = [];
          inMethod = false;
        }
      }
    }
  }

  /**
   * Extract parameter names from function signature
   */
  function _extractParams(signature) {
    const match = signature.match(/function\s*\(([^)]*)\)/);
    if (!match) return [];
    return match[1].split(',').map(p => p.trim()).filter(p => p);
  }

  // ============== Simple JavaScript Parser for OpCodes Methods ==============
  // Parses a limited subset of JavaScript into ESTree-compatible AST

  /**
   * Tokenize JavaScript source into tokens
   */
  function _tokenize(source) {
    const tokens = [];
    let i = 0;

    while (i < source.length) {
      // Skip whitespace
      if (/\s/.test(source[i])) {
        ++i;
        continue;
      }

      // Skip comments
      if (source[i] === '/' && source[i + 1] === '/') {
        while (i < source.length && source[i] !== '\n') ++i;
        continue;
      }
      if (source[i] === '/' && source[i + 1] === '*') {
        i += 2;
        while (i < source.length - 1 && !(source[i] === '*' && source[i + 1] === '/')) ++i;
        i += 2;
        continue;
      }

      // Multi-character operators
      const threeChar = source.substring(i, i + 3);
      if (['>>>', '===', '!=='].includes(threeChar)) {
        tokens.push({ type: 'Operator', value: threeChar });
        i += 3;
        continue;
      }

      const twoChar = source.substring(i, i + 2);
      if (['++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^='].includes(twoChar)) {
        tokens.push({ type: 'Operator', value: twoChar });
        i += 2;
        continue;
      }

      // Single character operators and punctuation
      if ('+-*/%&|^~!<>=(){}[];:,?.'.includes(source[i])) {
        tokens.push({ type: 'Punctuator', value: source[i] });
        ++i;
        continue;
      }

      // Numbers (including hex)
      if (/\d/.test(source[i]) || (source[i] === '0' && source[i + 1] === 'x')) {
        let num = '';
        if (source[i] === '0' && source[i + 1] === 'x') {
          num = '0x';
          i += 2;
          while (/[0-9a-fA-F]/.test(source[i])) num += source[i++];
        } else {
          while (/[\d.]/.test(source[i])) num += source[i++];
        }
        tokens.push({ type: 'Number', value: num });
        continue;
      }

      // Strings
      if (source[i] === '"' || source[i] === "'") {
        const quote = source[i++];
        let str = '';
        while (i < source.length && source[i] !== quote) {
          if (source[i] === '\\') str += source[i++];
          str += source[i++];
        }
        ++i; // closing quote
        tokens.push({ type: 'String', value: str });
        continue;
      }

      // Identifiers and keywords
      if (/[a-zA-Z_$]/.test(source[i])) {
        let id = '';
        while (/[a-zA-Z0-9_$]/.test(source[i])) id += source[i++];
        const keywords = ['function', 'return', 'var', 'let', 'const', 'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'true', 'false', 'null', 'undefined', 'new', 'typeof'];
        tokens.push({ type: keywords.includes(id) ? 'Keyword' : 'Identifier', value: id });
        continue;
      }

      // Unknown character - skip
      ++i;
    }

    return tokens;
  }

  /**
   * Simple recursive descent parser for OpCodes methods
   */
  class SimpleJSParser {
    constructor(tokens) {
      this.tokens = tokens;
      this.pos = 0;
    }

    peek(offset = 0) { return this.tokens[this.pos + offset]; }
    consume() { return this.tokens[this.pos++]; }
    match(value) { return this.peek()?.value === value; }
    expect(value) {
      if (!this.match(value))
        throw new Error(`Expected '${value}' but got '${this.peek()?.value}'`);
      return this.consume();
    }

    parseProgram() {
      const body = [];
      while (this.pos < this.tokens.length)
        body.push(this.parseStatement());
      return { type: 'Program', body };
    }

    parseStatement() {
      const token = this.peek();
      if (!token) return null;

      if (token.value === 'function') return this.parseFunctionDeclaration();
      if (token.value === 'return') return this.parseReturnStatement();
      if (token.value === 'if') return this.parseIfStatement();
      if (token.value === 'for') return this.parseForStatement();
      if (token.value === 'while') return this.parseWhileStatement();
      if (token.value === '{') return this.parseBlockStatement();
      if (['var', 'let', 'const'].includes(token.value)) return this.parseVariableDeclaration();

      // Expression statement
      const expr = this.parseExpression();
      if (this.match(';')) this.consume();
      return { type: 'ExpressionStatement', expression: expr };
    }

    parseFunctionDeclaration() {
      this.expect('function');
      const id = this.parseIdentifier();
      this.expect('(');
      const params = [];
      while (!this.match(')')) {
        params.push(this.parseIdentifier());
        if (this.match(',')) this.consume();
      }
      this.expect(')');
      const body = this.parseBlockStatement();
      return { type: 'FunctionDeclaration', id, params, body, generator: false, async: false };
    }

    parseBlockStatement() {
      this.expect('{');
      const body = [];
      while (!this.match('}') && this.pos < this.tokens.length)
        body.push(this.parseStatement());
      this.expect('}');
      return { type: 'BlockStatement', body };
    }

    parseReturnStatement() {
      this.expect('return');
      let argument = null;
      if (!this.match(';') && !this.match('}'))
        argument = this.parseExpression();
      if (this.match(';')) this.consume();
      return { type: 'ReturnStatement', argument };
    }

    parseIfStatement() {
      this.expect('if');
      this.expect('(');
      const test = this.parseExpression();
      this.expect(')');
      const consequent = this.parseStatement();
      let alternate = null;
      if (this.match('else')) {
        this.consume();
        alternate = this.parseStatement();
      }
      return { type: 'IfStatement', test, consequent, alternate };
    }

    parseForStatement() {
      this.expect('for');
      this.expect('(');
      let init = null;
      if (!this.match(';')) {
        if (['var', 'let', 'const'].includes(this.peek()?.value))
          init = this.parseVariableDeclaration(true);
        else
          init = this.parseExpression();
      }
      if (this.match(';')) this.consume();
      let test = null;
      if (!this.match(';')) test = this.parseExpression();
      this.expect(';');
      let update = null;
      if (!this.match(')')) update = this.parseExpression();
      this.expect(')');
      const body = this.parseStatement();
      return { type: 'ForStatement', init, test, update, body };
    }

    parseWhileStatement() {
      this.expect('while');
      this.expect('(');
      const test = this.parseExpression();
      this.expect(')');
      const body = this.parseStatement();
      return { type: 'WhileStatement', test, body };
    }

    parseVariableDeclaration(noSemicolon = false) {
      const kind = this.consume().value;
      const declarations = [];
      do {
        const id = this.parseIdentifier();
        let init = null;
        if (this.match('=')) {
          this.consume();
          init = this.parseExpression();
        }
        declarations.push({ type: 'VariableDeclarator', id, init });
      } while (this.match(',') && this.consume());
      if (!noSemicolon && this.match(';')) this.consume();
      return { type: 'VariableDeclaration', kind, declarations };
    }

    parseExpression() { return this.parseAssignment(); }

    parseAssignment() {
      const left = this.parseTernary();
      if (['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^='].includes(this.peek()?.value)) {
        const operator = this.consume().value;
        const right = this.parseAssignment();
        return { type: 'AssignmentExpression', operator, left, right };
      }
      return left;
    }

    parseTernary() {
      let test = this.parseLogicalOr();
      if (this.match('?')) {
        this.consume();
        const consequent = this.parseExpression();
        this.expect(':');
        const alternate = this.parseTernary();
        return { type: 'ConditionalExpression', test, consequent, alternate };
      }
      return test;
    }

    parseLogicalOr() {
      let left = this.parseLogicalAnd();
      while (this.match('||')) {
        const operator = this.consume().value;
        const right = this.parseLogicalAnd();
        left = { type: 'LogicalExpression', operator, left, right };
      }
      return left;
    }

    parseLogicalAnd() {
      let left = this.parseBitwiseOr();
      while (this.match('&&')) {
        const operator = this.consume().value;
        const right = this.parseBitwiseOr();
        left = { type: 'LogicalExpression', operator, left, right };
      }
      return left;
    }

    parseBitwiseOr() {
      let left = this.parseBitwiseXor();
      while (this.match('|') && this.peek(1)?.value !== '|') {
        const operator = this.consume().value;
        const right = this.parseBitwiseXor();
        left = { type: 'BinaryExpression', operator, left, right };
      }
      return left;
    }

    parseBitwiseXor() {
      let left = this.parseBitwiseAnd();
      while (this.match('^')) {
        const operator = this.consume().value;
        const right = this.parseBitwiseAnd();
        left = { type: 'BinaryExpression', operator, left, right };
      }
      return left;
    }

    parseBitwiseAnd() {
      let left = this.parseEquality();
      while (this.match('&') && this.peek(1)?.value !== '&') {
        const operator = this.consume().value;
        const right = this.parseEquality();
        left = { type: 'BinaryExpression', operator, left, right };
      }
      return left;
    }

    parseEquality() {
      let left = this.parseComparison();
      while (['==', '!=', '===', '!=='].includes(this.peek()?.value)) {
        const operator = this.consume().value;
        const right = this.parseComparison();
        left = { type: 'BinaryExpression', operator, left, right };
      }
      return left;
    }

    parseComparison() {
      let left = this.parseShift();
      while (['<', '>', '<=', '>='].includes(this.peek()?.value)) {
        const operator = this.consume().value;
        const right = this.parseShift();
        left = { type: 'BinaryExpression', operator, left, right };
      }
      return left;
    }

    parseShift() {
      let left = this.parseAdditive();
      while (['<<', '>>', '>>>'].includes(this.peek()?.value)) {
        const operator = this.consume().value;
        const right = this.parseAdditive();
        left = { type: 'BinaryExpression', operator, left, right };
      }
      return left;
    }

    parseAdditive() {
      let left = this.parseMultiplicative();
      while (['+', '-'].includes(this.peek()?.value) && !['++', '--'].includes(this.peek()?.value)) {
        const operator = this.consume().value;
        const right = this.parseMultiplicative();
        left = { type: 'BinaryExpression', operator, left, right };
      }
      return left;
    }

    parseMultiplicative() {
      let left = this.parseUnary();
      while (['*', '/', '%'].includes(this.peek()?.value)) {
        const operator = this.consume().value;
        const right = this.parseUnary();
        left = { type: 'BinaryExpression', operator, left, right };
      }
      return left;
    }

    parseUnary() {
      if (['!', '~', '-', '+', 'typeof'].includes(this.peek()?.value)) {
        const operator = this.consume().value;
        const argument = this.parseUnary();
        return { type: 'UnaryExpression', operator, prefix: true, argument };
      }
      if (['++', '--'].includes(this.peek()?.value)) {
        const operator = this.consume().value;
        const argument = this.parseUnary();
        return { type: 'UpdateExpression', operator, prefix: true, argument };
      }
      return this.parsePostfix();
    }

    parsePostfix() {
      let expr = this.parsePrimary();
      while (true) {
        if (['++', '--'].includes(this.peek()?.value)) {
          const operator = this.consume().value;
          expr = { type: 'UpdateExpression', operator, prefix: false, argument: expr };
        } else if (this.match('[')) {
          this.consume();
          const property = this.parseExpression();
          this.expect(']');
          expr = { type: 'MemberExpression', object: expr, property, computed: true };
        } else if (this.match('.')) {
          this.consume();
          const property = this.parseIdentifier();
          expr = { type: 'MemberExpression', object: expr, property, computed: false };
        } else if (this.match('(')) {
          this.consume();
          const args = [];
          while (!this.match(')')) {
            args.push(this.parseExpression());
            if (this.match(',')) this.consume();
          }
          this.expect(')');
          expr = { type: 'CallExpression', callee: expr, arguments: args };
        } else {
          break;
        }
      }
      return expr;
    }

    parsePrimary() {
      const token = this.peek();
      if (!token) throw new Error('Unexpected end of input');

      // Parenthesized expression
      if (token.value === '(') {
        this.consume();
        const expr = this.parseExpression();
        this.expect(')');
        return expr;
      }

      // Array literal
      if (token.value === '[') {
        this.consume();
        const elements = [];
        while (!this.match(']')) {
          elements.push(this.parseExpression());
          if (this.match(',')) this.consume();
        }
        this.expect(']');
        return { type: 'ArrayExpression', elements };
      }

      // Object literal
      if (token.value === '{') {
        this.consume();
        const properties = [];
        while (!this.match('}')) {
          const key = this.parseIdentifier();
          this.expect(':');
          const value = this.parseExpression();
          properties.push({ type: 'Property', key, value, kind: 'init', computed: false, shorthand: false });
          if (this.match(',')) this.consume();
        }
        this.expect('}');
        return { type: 'ObjectExpression', properties };
      }

      // New expression
      if (token.value === 'new') {
        this.consume();
        const callee = this.parsePrimary();
        let args = [];
        if (this.match('(')) {
          this.consume();
          while (!this.match(')')) {
            args.push(this.parseExpression());
            if (this.match(',')) this.consume();
          }
          this.expect(')');
        }
        return { type: 'NewExpression', callee, arguments: args };
      }

      // Literals
      if (token.type === 'Number') {
        this.consume();
        const value = token.value.startsWith('0x') ? parseInt(token.value, 16) : parseFloat(token.value);
        return { type: 'Literal', value, raw: token.value };
      }
      if (token.type === 'String') {
        this.consume();
        return { type: 'Literal', value: token.value, raw: `"${token.value}"` };
      }
      if (token.value === 'true' || token.value === 'false') {
        this.consume();
        return { type: 'Literal', value: token.value === 'true', raw: token.value };
      }
      if (token.value === 'null') {
        this.consume();
        return { type: 'Literal', value: null, raw: 'null' };
      }
      if (token.value === 'undefined') {
        this.consume();
        return { type: 'Identifier', name: 'undefined' };
      }

      // Identifier
      if (token.type === 'Identifier') {
        return this.parseIdentifier();
      }

      throw new Error(`Unexpected token: ${token.value}`);
    }

    parseIdentifier() {
      const token = this.consume();
      if (token.type !== 'Identifier' && token.type !== 'Keyword')
        throw new Error(`Expected identifier but got ${token.value}`);
      return { type: 'Identifier', name: token.value };
    }
  }

  /**
   * Parse JavaScript source code into ESTree-compatible AST
   */
  function _parseJS(source) {
    const tokens = _tokenize(source);
    const parser = new SimpleJSParser(tokens);
    return parser.parseProgram();
  }

  /**
   * Parse an OpCodes method source into ESTree AST
   */
  function _parseMethodToAST(methodInfo) {
    // Convert method definition to standalone function
    // "MethodName: function(params) { body }" -> "function MethodName(params) { body }"
    const funcSource = methodInfo.source.replace(
      /^(\w+):\s*function\s*\(([^)]*)\)/,
      'function $1($2)'
    );

    try {
      const ast = _parseJS(funcSource);
      if (ast.body && ast.body[0] && ast.body[0].type === 'FunctionDeclaration')
        return ast.body[0];
      return null;
    } catch (e) {
      console.warn(`OpCodesInliner: Failed to parse ${methodInfo.name}:`, e.message);
      return null;
    }
  }

  /**
   * Get the AST for a specific OpCodes method
   * @param {string} methodName - Name of the OpCodes method
   * @returns {Object|null} Method AST or null if not found
   */
  function getMethodAST(methodName) {
    const methods = _loadOpCodesAST();
    return methods.get(methodName) || null;
  }

  /**
   * Get all available OpCodes method names
   * @returns {string[]} Array of method names
   */
  function getAvailableMethods() {
    const methods = _loadOpCodesAST();
    return Array.from(methods.keys());
  }

  /**
   * Check if a method exists in OpCodes
   * @param {string} methodName - Method name to check
   * @returns {boolean} True if method exists
   */
  function hasMethod(methodName) {
    const methods = _loadOpCodesAST();
    return methods.has(methodName);
  }

  /**
   * Get parsed ESTree AST for specific OpCodes methods
   * These can be directly added to a JS AST before transformation
   * @param {string[]} methodNames - Array of OpCodes method names
   * @returns {Object[]} Array of FunctionDeclaration AST nodes
   */
  function getMethodsAsAST(methodNames) {
    const methods = _loadOpCodesAST();
    const astNodes = [];

    for (const methodName of methodNames) {
      const methodInfo = methods.get(methodName);
      if (!methodInfo)
        continue;

      // Check cache first
      const cacheKey = `${methodName}_ast`;
      if (_methodCache.has(cacheKey)) {
        astNodes.push(_methodCache.get(cacheKey));
        continue;
      }

      const funcAst = _createStandaloneFunctionAST(methodName, methodInfo);
      if (funcAst) {
        _methodCache.set(cacheKey, funcAst);
        astNodes.push(funcAst);
      }
    }

    return astNodes;
  }

  /**
   * Get inline implementations for specific OpCodes methods in a target language
   * @param {string[]} methodNames - Array of OpCodes method names to inline
   * @param {string} languageExt - Target language file extension (e.g., 'js', 'py', 'cs')
   * @param {Object} options - Additional options for transformation
   * @returns {string} Generated code for the methods
   */
  function getInlineImplementations(methodNames, languageExt, options = {}) {
    const methods = _loadOpCodesAST();
    const implementations = [];

    // Get the appropriate transformer and emitter for the target language
    const { transformer, emitter } = _getLanguagePipeline(languageExt);
    if (!transformer || !emitter) {
      console.warn(`OpCodesInliner: No pipeline available for ${languageExt}`);
      return '';
    }

    for (const methodName of methodNames) {
      const methodInfo = methods.get(methodName);
      if (!methodInfo)
        continue;

      // Check cache first
      const cacheKey = `${methodName}_${languageExt}`;
      if (_methodCache.has(cacheKey)) {
        implementations.push(_methodCache.get(cacheKey));
        continue;
      }

      try {
        // Create a standalone function AST from the method
        const funcAst = _createStandaloneFunctionAST(methodName, methodInfo);

        // Transform to target language AST
        const targetAst = transformer.transformFunction ?
          transformer.transformFunction(funcAst) :
          transformer.transform({ type: 'Program', body: [funcAst] });

        // Emit target language code
        const code = emitter.emit ? emitter.emit(targetAst) : emitter.emitFunction(targetAst);

        _methodCache.set(cacheKey, code);
        implementations.push(code);
      } catch (error) {
        console.warn(`OpCodesInliner: Failed to transform ${methodName}:`, error.message);
      }
    }

    return implementations.join('\n\n');
  }

  /**
   * Create a standalone function AST from an OpCodes method
   * Parses the JavaScript source into a proper ESTree AST
   */
  function _createStandaloneFunctionAST(name, methodInfo) {
    // Use the parser to get a proper AST from the source
    const parsed = _parseMethodToAST(methodInfo);
    if (parsed)
      return parsed;

    // Fallback: return a minimal AST with params only (body will need handling)
    return {
      type: 'FunctionDeclaration',
      id: { type: 'Identifier', name: name },
      params: methodInfo.params.map(p => ({ type: 'Identifier', name: p })),
      body: { type: 'BlockStatement', body: [] },
      generator: false,
      async: false
    };
  }

  /**
   * Get transformer and emitter for target language
   */
  function _getLanguagePipeline(languageExt) {
    const pipelines = {
      'js': { transformerName: 'JavaScriptTransformer', emitterName: 'JavaScriptEmitter' },
      'ts': { transformerName: 'TypeScriptTransformer', emitterName: 'TypeScriptEmitter' },
      'py': { transformerName: 'PythonTransformer', emitterName: 'PythonEmitter' },
      'java': { transformerName: 'JavaTransformer', emitterName: 'JavaEmitter' },
      'cs': { transformerName: 'CSharpTransformer', emitterName: 'CSharpEmitter' },
      'cpp': { transformerName: 'CppTransformer', emitterName: 'CppEmitter' },
      'c': { transformerName: 'CTransformer', emitterName: 'CEmitter' },
      'go': { transformerName: 'GoTransformer', emitterName: 'GoEmitter' },
      'rs': { transformerName: 'RustTransformer', emitterName: 'RustEmitter' },
      'kt': { transformerName: 'KotlinTransformer', emitterName: 'KotlinEmitter' },
      'php': { transformerName: 'PhpTransformer', emitterName: 'PhpEmitter' },
      'rb': { transformerName: 'RubyTransformer', emitterName: 'RubyEmitter' },
      'pl': { transformerName: 'PerlTransformer', emitterName: 'PerlEmitter' },
      'pas': { transformerName: 'DelphiTransformer', emitterName: 'DelphiEmitter' },
      'bas': { transformerName: 'BasicTransformer', emitterName: 'BasicEmitter' }
    };

    const config = pipelines[languageExt];
    if (!config)
      return { transformer: null, emitter: null };

    let transformer = null;
    let emitter = null;

    // Try to load transformer and emitter
    if (typeof require !== 'undefined') {
      try {
        const transformerModule = require(`./${config.transformerName}.js`);
        transformer = new (transformerModule[config.transformerName] || transformerModule)({});
      } catch (e) {
        // Transformer not available
      }

      try {
        const emitterModule = require(`./${config.emitterName}.js`);
        emitter = new (emitterModule[config.emitterName] || emitterModule)({});
      } catch (e) {
        // Emitter not available
      }
    } else if (typeof window !== 'undefined') {
      if (window[config.transformerName])
        transformer = new window[config.transformerName]({});
      if (window[config.emitterName])
        emitter = new window[config.emitterName]({});
    }

    return { transformer, emitter };
  }

  /**
   * Get the raw JavaScript source for specific OpCodes methods
   * Returns the method source directly from OpCodes.js
   * @param {string[]} methodNames - Array of OpCodes method names
   * @param {string} indent - Indentation to use (default: '  ')
   * @returns {string} JavaScript source code for the methods (as object properties)
   */
  function getJavaScriptSource(methodNames, indent = '  ') {
    const methods = _loadOpCodesAST();
    const sources = [];

    for (const methodName of methodNames) {
      const methodInfo = methods.get(methodName);
      if (!methodInfo)
        continue;

      // Properly indent the source - add indent to each line
      const lines = methodInfo.source.split('\n');
      const indentedLines = lines.map((line, i) => {
        // First line already has method name, just add base indent
        if (i === 0)
          return indent + line;
        // Other lines need additional indentation for method body
        return indent + line;
      });

      sources.push(indentedLines.join('\n'));
    }

    return sources.join(',\n\n');
  }

  /**
   * Clear the method cache (useful for testing or when OpCodes changes)
   */
  function clearCache() {
    _methodCache.clear();
    _opCodesAst = null;
  }

  // Export
  const OpCodesInliner = {
    getMethodAST,
    getMethodsAsAST,
    getAvailableMethods,
    hasMethod,
    getInlineImplementations,
    getJavaScriptSource,
    clearCache
  };

  if (typeof module !== 'undefined' && module.exports)
    module.exports = OpCodesInliner;

  if (typeof window !== 'undefined')
    window.OpCodesInliner = OpCodesInliner;

  if (typeof global !== 'undefined')
    global.OpCodesInliner = OpCodesInliner;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : global);
