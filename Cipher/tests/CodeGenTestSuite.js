#!/usr/bin/env node

/**
 * Comprehensive Transpiler Test Suite
 *
 * Tests ALL aspects of the transpiler system:
 * - JavaScript AST node coverage
 * - Transformer method completeness
 * - Type inference accuracy
 * - Missing unwrapping detection
 * - Syntax construct support
 * - All language/dialect configurations
 * - Edge cases and error handling
 *
 * Usage:
 *   node TestSuite.js                    # Run all tests
 *   node TestSuite.js --language=python  # Test specific language
 *   node TestSuite.js --verbose          # Verbose output
 *   node TestSuite.js --coverage         # Show coverage report
 *   node TestSuite.js --quick            # Quick smoke test only
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI colors
const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', white: '\x1b[37m'
};

// Parse command line arguments
const args = {
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  coverage: process.argv.includes('--coverage'),
  quick: process.argv.includes('--quick'),
  language: process.argv.find(a => a.startsWith('--language='))?.split('=')[1],
  fix: process.argv.includes('--fix')
};

// ============================================================================
// ALL JAVASCRIPT AST NODE TYPES (ESTree standard + ES2022+)
// ============================================================================
const ALL_JS_NODE_TYPES = {
  // Statements
  statements: [
    'BlockStatement', 'ExpressionStatement', 'EmptyStatement', 'DebuggerStatement',
    'ReturnStatement', 'BreakStatement', 'ContinueStatement', 'ThrowStatement',
    'IfStatement', 'SwitchStatement', 'WhileStatement', 'DoWhileStatement',
    'ForStatement', 'ForInStatement', 'ForOfStatement', 'TryStatement',
    'WithStatement', 'LabeledStatement', 'VariableDeclaration', 'FunctionDeclaration',
    'ClassDeclaration', 'ImportDeclaration', 'ExportNamedDeclaration',
    'ExportDefaultDeclaration', 'ExportAllDeclaration'
  ],
  // Expressions
  expressions: [
    'Identifier', 'Literal', 'ThisExpression', 'Super', 'ArrayExpression',
    'ObjectExpression', 'FunctionExpression', 'ArrowFunctionExpression',
    'ClassExpression', 'TaggedTemplateExpression', 'TemplateLiteral',
    'SequenceExpression', 'UnaryExpression', 'BinaryExpression',
    'AssignmentExpression', 'UpdateExpression', 'LogicalExpression',
    'ConditionalExpression', 'CallExpression', 'NewExpression',
    'MemberExpression', 'YieldExpression', 'AwaitExpression',
    'ImportExpression', 'ChainExpression', 'MetaProperty', 'SpreadElement'
  ],
  // Patterns
  patterns: [
    'ObjectPattern', 'ArrayPattern', 'RestElement', 'AssignmentPattern'
  ],
  // Classes
  classes: [
    'MethodDefinition', 'PropertyDefinition', 'StaticBlock', 'PrivateIdentifier'
  ],
  // Modern features
  modern: [
    'BigIntLiteral', 'OptionalMemberExpression', 'OptionalCallExpression',
    'NullishCoalescingExpression', 'LogicalAssignmentExpression'
  ]
};

// ============================================================================
// COMPREHENSIVE TEST AST CASES - ALL EXPRESSION TYPES
// ============================================================================
const TEST_CASES = {
  // ==================== BASIC EXPRESSIONS ====================

  // Identifier expression
  identifier: {
    name: 'Identifier',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testIdentifier' },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: { type: 'Identifier', name: 'someVariable' }
          }]
        }
      }]
    }
  },

  // Literal expressions (string, number, boolean, null)
  literals: {
    name: 'Literals',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testLiterals' },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'str' }, init: { type: 'Literal', value: 'hello' } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'num' }, init: { type: 'Literal', value: 42 } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'float' }, init: { type: 'Literal', value: 3.14159 } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'bool' }, init: { type: 'Literal', value: true } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'nul' }, init: { type: 'Literal', value: null } }
            ]},
            { type: 'ReturnStatement', argument: { type: 'Identifier', name: 'num' } }
          ]
        }
      }]
    }
  },

  // ThisExpression
  thisExpression: {
    name: 'ThisExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'ClassDeclaration',
        id: { type: 'Identifier', name: 'TestThis' },
        body: {
          type: 'ClassBody',
          body: [{
            type: 'MethodDefinition',
            key: { type: 'Identifier', name: 'getThis' },
            value: {
              type: 'FunctionExpression',
              params: [],
              body: {
                type: 'BlockStatement',
                body: [{ type: 'ReturnStatement', argument: { type: 'ThisExpression' } }]
              }
            },
            kind: 'method'
          }]
        }
      }]
    }
  },

  // Super expression
  superExpression: {
    name: 'Super',
    ast: {
      type: 'Program',
      body: [{
        type: 'ClassDeclaration',
        id: { type: 'Identifier', name: 'Child' },
        superClass: { type: 'Identifier', name: 'Parent' },
        body: {
          type: 'ClassBody',
          body: [{
            type: 'MethodDefinition',
            key: { type: 'Identifier', name: 'constructor' },
            value: {
              type: 'FunctionExpression',
              params: [],
              body: {
                type: 'BlockStatement',
                body: [{
                  type: 'ExpressionStatement',
                  expression: {
                    type: 'CallExpression',
                    callee: { type: 'Super' },
                    arguments: []
                  }
                }]
              }
            },
            kind: 'constructor'
          }]
        }
      }]
    }
  },

  // ArrayExpression
  arrayExpression: {
    name: 'ArrayExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testArray' },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: {
              type: 'ArrayExpression',
              elements: [
                { type: 'Literal', value: 1 },
                { type: 'Literal', value: 2 },
                { type: 'Literal', value: 3 },
                { type: 'Identifier', name: 'x' }
              ]
            }
          }]
        }
      }]
    }
  },

  // ObjectExpression
  objectExpression: {
    name: 'ObjectExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testObject' },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: {
              type: 'ObjectExpression',
              properties: [
                { type: 'Property', key: { type: 'Identifier', name: 'a' }, value: { type: 'Literal', value: 1 }, kind: 'init' },
                { type: 'Property', key: { type: 'Literal', value: 'b' }, value: { type: 'Literal', value: 2 }, kind: 'init' },
                { type: 'Property', key: { type: 'Identifier', name: 'c' }, value: { type: 'Identifier', name: 'c' }, kind: 'init', shorthand: true }
              ]
            }
          }]
        }
      }]
    }
  },

  // FunctionExpression
  functionExpression: {
    name: 'FunctionExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: [{
          type: 'VariableDeclarator',
          id: { type: 'Identifier', name: 'fn' },
          init: {
            type: 'FunctionExpression',
            id: null,
            params: [{ type: 'Identifier', name: 'x' }],
            body: {
              type: 'BlockStatement',
              body: [{ type: 'ReturnStatement', argument: { type: 'Identifier', name: 'x' } }]
            }
          }
        }]
      }]
    }
  },

  // ArrowFunctionExpression
  arrowFunction: {
    name: 'ArrowFunctionExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'VariableDeclaration',
        kind: 'const',
        declarations: [{
          type: 'VariableDeclarator',
          id: { type: 'Identifier', name: 'arrow' },
          init: {
            type: 'ArrowFunctionExpression',
            params: [{ type: 'Identifier', name: 'x' }, { type: 'Identifier', name: 'y' }],
            body: {
              type: 'BinaryExpression',
              operator: '+',
              left: { type: 'Identifier', name: 'x' },
              right: { type: 'Identifier', name: 'y' }
            },
            expression: true
          }
        }]
      }]
    }
  },

  // ==================== OPERATORS ====================

  // UnaryExpression (all operators)
  unaryExpression: {
    name: 'UnaryExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testUnary' },
        params: [{ type: 'Identifier', name: 'x' }],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'neg' },
                init: { type: 'UnaryExpression', operator: '-', prefix: true, argument: { type: 'Identifier', name: 'x' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'pos' },
                init: { type: 'UnaryExpression', operator: '+', prefix: true, argument: { type: 'Identifier', name: 'x' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'not' },
                init: { type: 'UnaryExpression', operator: '!', prefix: true, argument: { type: 'Identifier', name: 'x' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'bitnot' },
                init: { type: 'UnaryExpression', operator: '~', prefix: true, argument: { type: 'Identifier', name: 'x' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'typ' },
                init: { type: 'UnaryExpression', operator: 'typeof', prefix: true, argument: { type: 'Identifier', name: 'x' } } }
            ]},
            { type: 'ReturnStatement', argument: { type: 'Identifier', name: 'neg' } }
          ]
        }
      }]
    }
  },

  // BinaryExpression (arithmetic)
  binaryArithmetic: {
    name: 'BinaryExpression Arithmetic',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testArithmetic' },
        params: [{ type: 'Identifier', name: 'a' }, { type: 'Identifier', name: 'b' }],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'add' },
                init: { type: 'BinaryExpression', operator: '+', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'sub' },
                init: { type: 'BinaryExpression', operator: '-', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'mul' },
                init: { type: 'BinaryExpression', operator: '*', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'div' },
                init: { type: 'BinaryExpression', operator: '/', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'mod' },
                init: { type: 'BinaryExpression', operator: '%', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'exp' },
                init: { type: 'BinaryExpression', operator: '**', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'ReturnStatement', argument: { type: 'Identifier', name: 'add' } }
          ]
        }
      }]
    }
  },

  // BinaryExpression (bitwise)
  binaryBitwise: {
    name: 'BinaryExpression Bitwise',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testBitwise' },
        params: [{ type: 'Identifier', name: 'a' }, { type: 'Identifier', name: 'b' }],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'and' },
                init: { type: 'BinaryExpression', operator: '&', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'or' },
                init: { type: 'BinaryExpression', operator: '|', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'xor' },
                init: { type: 'BinaryExpression', operator: '^', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'shl' },
                init: { type: 'BinaryExpression', operator: '<<', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'shr' },
                init: { type: 'BinaryExpression', operator: '>>', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'ushr' },
                init: { type: 'BinaryExpression', operator: '>>>', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'ReturnStatement', argument: { type: 'Identifier', name: 'and' } }
          ]
        }
      }]
    }
  },

  // BinaryExpression (comparison)
  binaryComparison: {
    name: 'BinaryExpression Comparison',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testComparison' },
        params: [{ type: 'Identifier', name: 'a' }, { type: 'Identifier', name: 'b' }],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'eq' },
                init: { type: 'BinaryExpression', operator: '==', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'neq' },
                init: { type: 'BinaryExpression', operator: '!=', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'seq' },
                init: { type: 'BinaryExpression', operator: '===', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'sneq' },
                init: { type: 'BinaryExpression', operator: '!==', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'lt' },
                init: { type: 'BinaryExpression', operator: '<', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'lte' },
                init: { type: 'BinaryExpression', operator: '<=', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'gt' },
                init: { type: 'BinaryExpression', operator: '>', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'gte' },
                init: { type: 'BinaryExpression', operator: '>=', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'ReturnStatement', argument: { type: 'Identifier', name: 'eq' } }
          ]
        }
      }]
    }
  },

  // LogicalExpression
  logicalExpression: {
    name: 'LogicalExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testLogical' },
        params: [{ type: 'Identifier', name: 'a' }, { type: 'Identifier', name: 'b' }],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'and' },
                init: { type: 'LogicalExpression', operator: '&&', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'or' },
                init: { type: 'LogicalExpression', operator: '||', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'nullish' },
                init: { type: 'LogicalExpression', operator: '??', left: { type: 'Identifier', name: 'a' }, right: { type: 'Identifier', name: 'b' } } }
            ]},
            { type: 'ReturnStatement', argument: { type: 'Identifier', name: 'and' } }
          ]
        }
      }]
    }
  },

  // AssignmentExpression (all operators)
  assignmentExpression: {
    name: 'AssignmentExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testAssignment' },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'x' }, init: { type: 'Literal', value: 10 } }
            ]},
            { type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '=',
              left: { type: 'Identifier', name: 'x' }, right: { type: 'Literal', value: 5 } } },
            { type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '+=',
              left: { type: 'Identifier', name: 'x' }, right: { type: 'Literal', value: 3 } } },
            { type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '-=',
              left: { type: 'Identifier', name: 'x' }, right: { type: 'Literal', value: 2 } } },
            { type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '*=',
              left: { type: 'Identifier', name: 'x' }, right: { type: 'Literal', value: 4 } } },
            { type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '/=',
              left: { type: 'Identifier', name: 'x' }, right: { type: 'Literal', value: 2 } } },
            { type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '%=',
              left: { type: 'Identifier', name: 'x' }, right: { type: 'Literal', value: 3 } } },
            { type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '&=',
              left: { type: 'Identifier', name: 'x' }, right: { type: 'Literal', value: 0xFF } } },
            { type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '|=',
              left: { type: 'Identifier', name: 'x' }, right: { type: 'Literal', value: 0x0F } } },
            { type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '^=',
              left: { type: 'Identifier', name: 'x' }, right: { type: 'Literal', value: 0xAA } } },
            { type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '<<=',
              left: { type: 'Identifier', name: 'x' }, right: { type: 'Literal', value: 2 } } },
            { type: 'ExpressionStatement', expression: { type: 'AssignmentExpression', operator: '>>=',
              left: { type: 'Identifier', name: 'x' }, right: { type: 'Literal', value: 1 } } },
            { type: 'ReturnStatement', argument: { type: 'Identifier', name: 'x' } }
          ]
        }
      }]
    }
  },

  // UpdateExpression
  updateExpression: {
    name: 'UpdateExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testUpdate' },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'x' }, init: { type: 'Literal', value: 0 } }
            ]},
            { type: 'ExpressionStatement', expression: { type: 'UpdateExpression', operator: '++', prefix: true, argument: { type: 'Identifier', name: 'x' } } },
            { type: 'ExpressionStatement', expression: { type: 'UpdateExpression', operator: '++', prefix: false, argument: { type: 'Identifier', name: 'x' } } },
            { type: 'ExpressionStatement', expression: { type: 'UpdateExpression', operator: '--', prefix: true, argument: { type: 'Identifier', name: 'x' } } },
            { type: 'ExpressionStatement', expression: { type: 'UpdateExpression', operator: '--', prefix: false, argument: { type: 'Identifier', name: 'x' } } },
            { type: 'ReturnStatement', argument: { type: 'Identifier', name: 'x' } }
          ]
        }
      }]
    }
  },

  // ConditionalExpression (ternary)
  conditionalExpression: {
    name: 'ConditionalExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testTernary' },
        params: [{ type: 'Identifier', name: 'cond' }],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: {
              type: 'ConditionalExpression',
              test: { type: 'Identifier', name: 'cond' },
              consequent: { type: 'Literal', value: 'yes' },
              alternate: { type: 'Literal', value: 'no' }
            }
          }]
        }
      }]
    }
  },

  // ==================== CALL AND MEMBER EXPRESSIONS ====================

  // CallExpression
  callExpression: {
    name: 'CallExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testCall' },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'ExpressionStatement', expression: {
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'someFunction' },
              arguments: [{ type: 'Literal', value: 1 }, { type: 'Literal', value: 2 }]
            }},
            { type: 'ReturnStatement', argument: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: 'Math' },
                property: { type: 'Identifier', name: 'max' },
                computed: false
              },
              arguments: [{ type: 'Literal', value: 10 }, { type: 'Literal', value: 20 }]
            }}
          ]
        }
      }]
    }
  },

  // NewExpression
  newExpression: {
    name: 'NewExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testNew' },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: {
              type: 'NewExpression',
              callee: { type: 'Identifier', name: 'SomeClass' },
              arguments: [{ type: 'Literal', value: 'arg1' }, { type: 'Literal', value: 42 }]
            }
          }]
        }
      }]
    }
  },

  // MemberExpression (dot and bracket)
  memberExpression: {
    name: 'MemberExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testMember' },
        params: [{ type: 'Identifier', name: 'obj' }],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'dot' },
                init: { type: 'MemberExpression', object: { type: 'Identifier', name: 'obj' },
                  property: { type: 'Identifier', name: 'property' }, computed: false } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'bracket' },
                init: { type: 'MemberExpression', object: { type: 'Identifier', name: 'obj' },
                  property: { type: 'Literal', value: 'key' }, computed: true } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'index' },
                init: { type: 'MemberExpression', object: { type: 'Identifier', name: 'obj' },
                  property: { type: 'Literal', value: 0 }, computed: true } }
            ]},
            { type: 'ReturnStatement', argument: { type: 'Identifier', name: 'dot' } }
          ]
        }
      }]
    }
  },

  // SequenceExpression
  sequenceExpression: {
    name: 'SequenceExpression',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testSequence' },
        params: [],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: {
              type: 'SequenceExpression',
              expressions: [
                { type: 'Literal', value: 1 },
                { type: 'Literal', value: 2 },
                { type: 'Literal', value: 3 }
              ]
            }
          }]
        }
      }]
    }
  },

  // ==================== MODERN FEATURES ====================

  // Basic function with all common constructs
  basicFunction: {
    name: 'Basic Function',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testFunction' },
        params: [{ type: 'Identifier', name: 'input' }],
        body: {
          type: 'BlockStatement',
          body: [
            {
              type: 'VariableDeclaration',
              declarations: [{
                type: 'VariableDeclarator',
                id: { type: 'Identifier', name: 'result' },
                init: { type: 'BinaryExpression', operator: '+',
                  left: { type: 'Identifier', name: 'input' },
                  right: { type: 'Literal', value: 42 }
                }
              }],
              kind: 'const'
            },
            { type: 'ReturnStatement', argument: { type: 'Identifier', name: 'result' } }
          ]
        }
      }]
    }
  },

  // Class with static block and private fields
  classWithModernFeatures: {
    name: 'Class with Modern Features',
    ast: {
      type: 'Program',
      body: [{
        type: 'ClassDeclaration',
        id: { type: 'Identifier', name: 'TestClass' },
        superClass: null,
        body: {
          type: 'ClassBody',
          body: [
            {
              type: 'PropertyDefinition',
              key: { type: 'PrivateIdentifier', name: 'privateField' },
              value: { type: 'Literal', value: 0 },
              static: false
            },
            {
              type: 'StaticBlock',
              body: [{
                type: 'ExpressionStatement',
                expression: {
                  type: 'AssignmentExpression',
                  operator: '=',
                  left: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: 'TestClass' },
                    property: { type: 'Identifier', name: 'initialized' },
                    computed: false
                  },
                  right: { type: 'Literal', value: true }
                }
              }]
            },
            {
              type: 'MethodDefinition',
              key: { type: 'Identifier', name: 'getValue' },
              value: {
                type: 'FunctionExpression',
                params: [],
                body: {
                  type: 'BlockStatement',
                  body: [{
                    type: 'ReturnStatement',
                    argument: {
                      type: 'MemberExpression',
                      object: { type: 'ThisExpression' },
                      property: { type: 'PrivateIdentifier', name: 'privateField' },
                      computed: false
                    }
                  }]
                }
              },
              kind: 'method',
              static: false
            }
          ]
        }
      }]
    }
  },

  // Generator function with yield
  generatorFunction: {
    name: 'Generator Function',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'generator' },
        params: [{ type: 'Identifier', name: 'max' }],
        generator: true,
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ForStatement',
            init: {
              type: 'VariableDeclaration',
              declarations: [{
                type: 'VariableDeclarator',
                id: { type: 'Identifier', name: 'i' },
                init: { type: 'Literal', value: 0 }
              }],
              kind: 'let'
            },
            test: {
              type: 'BinaryExpression',
              operator: '<',
              left: { type: 'Identifier', name: 'i' },
              right: { type: 'Identifier', name: 'max' }
            },
            update: {
              type: 'UpdateExpression',
              operator: '++',
              argument: { type: 'Identifier', name: 'i' },
              prefix: true
            },
            body: {
              type: 'BlockStatement',
              body: [{
                type: 'ExpressionStatement',
                expression: {
                  type: 'YieldExpression',
                  argument: { type: 'Identifier', name: 'i' },
                  delegate: false
                }
              }]
            }
          }]
        }
      }]
    }
  },

  // Optional chaining
  optionalChaining: {
    name: 'Optional Chaining',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'safeAccess' },
        params: [{ type: 'Identifier', name: 'obj' }],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: {
              type: 'ChainExpression',
              expression: {
                type: 'MemberExpression',
                object: {
                  type: 'MemberExpression',
                  object: { type: 'Identifier', name: 'obj' },
                  property: { type: 'Identifier', name: 'nested' },
                  computed: false,
                  optional: true
                },
                property: { type: 'Identifier', name: 'value' },
                computed: false,
                optional: true
              }
            }
          }]
        }
      }]
    }
  },

  // Class expression
  classExpression: {
    name: 'Class Expression',
    ast: {
      type: 'Program',
      body: [{
        type: 'VariableDeclaration',
        declarations: [{
          type: 'VariableDeclarator',
          id: { type: 'Identifier', name: 'MyClass' },
          init: {
            type: 'ClassExpression',
            id: null,
            superClass: null,
            body: {
              type: 'ClassBody',
              body: [{
                type: 'MethodDefinition',
                key: { type: 'Identifier', name: 'constructor' },
                value: {
                  type: 'FunctionExpression',
                  params: [{ type: 'Identifier', name: 'value' }],
                  body: {
                    type: 'BlockStatement',
                    body: [{
                      type: 'ExpressionStatement',
                      expression: {
                        type: 'AssignmentExpression',
                        operator: '=',
                        left: {
                          type: 'MemberExpression',
                          object: { type: 'ThisExpression' },
                          property: { type: 'Identifier', name: 'value' },
                          computed: false
                        },
                        right: { type: 'Identifier', name: 'value' }
                      }
                    }]
                  }
                },
                kind: 'constructor',
                static: false
              }]
            }
          }
        }],
        kind: 'const'
      }]
    }
  },

  // Control flow constructs
  controlFlow: {
    name: 'Control Flow',
    ast: {
      type: 'Program',
      body: [
        {
          type: 'FunctionDeclaration',
          id: { type: 'Identifier', name: 'controlFlow' },
          params: [{ type: 'Identifier', name: 'x' }],
          body: {
            type: 'BlockStatement',
            body: [
              // If statement
              {
                type: 'IfStatement',
                test: {
                  type: 'BinaryExpression', operator: '>',
                  left: { type: 'Identifier', name: 'x' },
                  right: { type: 'Literal', value: 0 }
                },
                consequent: {
                  type: 'ReturnStatement',
                  argument: { type: 'Literal', value: 'positive' }
                },
                alternate: {
                  type: 'IfStatement',
                  test: {
                    type: 'BinaryExpression', operator: '<',
                    left: { type: 'Identifier', name: 'x' },
                    right: { type: 'Literal', value: 0 }
                  },
                  consequent: {
                    type: 'ReturnStatement',
                    argument: { type: 'Literal', value: 'negative' }
                  },
                  alternate: {
                    type: 'ReturnStatement',
                    argument: { type: 'Literal', value: 'zero' }
                  }
                }
              }
            ]
          }
        }
      ]
    }
  },

  // Loops
  loops: {
    name: 'All Loop Types',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testLoops' },
        params: [{ type: 'Identifier', name: 'arr' }],
        body: {
          type: 'BlockStatement',
          body: [
            // While loop
            {
              type: 'WhileStatement',
              test: { type: 'Literal', value: false },
              body: { type: 'BlockStatement', body: [] }
            },
            // Do-while loop
            {
              type: 'DoWhileStatement',
              test: { type: 'Literal', value: false },
              body: { type: 'BlockStatement', body: [] }
            },
            // For-of loop
            {
              type: 'ForOfStatement',
              left: {
                type: 'VariableDeclaration',
                declarations: [{
                  type: 'VariableDeclarator',
                  id: { type: 'Identifier', name: 'item' },
                  init: null
                }],
                kind: 'const'
              },
              right: { type: 'Identifier', name: 'arr' },
              body: { type: 'BlockStatement', body: [] },
              await: false
            }
          ]
        }
      }]
    }
  },

  // Try-catch-finally
  errorHandling: {
    name: 'Error Handling',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'safeExecute' },
        params: [{ type: 'Identifier', name: 'fn' }],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'TryStatement',
            block: {
              type: 'BlockStatement',
              body: [{
                type: 'ReturnStatement',
                argument: {
                  type: 'CallExpression',
                  callee: { type: 'Identifier', name: 'fn' },
                  arguments: []
                }
              }]
            },
            handler: {
              type: 'CatchClause',
              param: { type: 'Identifier', name: 'error' },
              body: {
                type: 'BlockStatement',
                body: [{
                  type: 'ReturnStatement',
                  argument: { type: 'Literal', value: null }
                }]
              }
            },
            finalizer: null
          }]
        }
      }]
    }
  },

  // Template literals
  templateLiterals: {
    name: 'Template Literals',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'greet' },
        params: [{ type: 'Identifier', name: 'name' }],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: {
              type: 'TemplateLiteral',
              quasis: [
                { type: 'TemplateElement', value: { raw: 'Hello, ', cooked: 'Hello, ' }, tail: false },
                { type: 'TemplateElement', value: { raw: '!', cooked: '!' }, tail: true }
              ],
              expressions: [{ type: 'Identifier', name: 'name' }]
            }
          }]
        }
      }]
    }
  },

  // Spread and rest
  spreadRest: {
    name: 'Spread and Rest',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'merge' },
        params: [
          { type: 'Identifier', name: 'first' },
          { type: 'RestElement', argument: { type: 'Identifier', name: 'rest' } }
        ],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: {
              type: 'ArrayExpression',
              elements: [
                { type: 'Identifier', name: 'first' },
                { type: 'SpreadElement', argument: { type: 'Identifier', name: 'rest' } }
              ]
            }
          }]
        }
      }]
    }
  },

  // Switch statement
  switchStatement: {
    name: 'Switch Statement',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'handleCase' },
        params: [{ type: 'Identifier', name: 'value' }],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'SwitchStatement',
            discriminant: { type: 'Identifier', name: 'value' },
            cases: [
              {
                type: 'SwitchCase',
                test: { type: 'Literal', value: 1 },
                consequent: [{ type: 'ReturnStatement', argument: { type: 'Literal', value: 'one' } }]
              },
              {
                type: 'SwitchCase',
                test: { type: 'Literal', value: 2 },
                consequent: [{ type: 'ReturnStatement', argument: { type: 'Literal', value: 'two' } }]
              },
              {
                type: 'SwitchCase',
                test: null,
                consequent: [{ type: 'ReturnStatement', argument: { type: 'Literal', value: 'other' } }]
              }
            ]
          }]
        }
      }]
    }
  },

  // Ternary and logical expressions
  ternaryLogical: {
    name: 'Ternary and Logical',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'conditional' },
        params: [
          { type: 'Identifier', name: 'a' },
          { type: 'Identifier', name: 'b' }
        ],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: {
              type: 'ConditionalExpression',
              test: {
                type: 'LogicalExpression',
                operator: '&&',
                left: { type: 'Identifier', name: 'a' },
                right: { type: 'Identifier', name: 'b' }
              },
              consequent: { type: 'Identifier', name: 'a' },
              alternate: {
                type: 'LogicalExpression',
                operator: '||',
                left: { type: 'Identifier', name: 'b' },
                right: { type: 'Literal', value: 0 }
              }
            }
          }]
        }
      }]
    }
  },

  // ==================== 64-BIT ULONG FUSION TESTS ====================

  // 64-bit integer from high/low pair (ulong fusion pattern)
  ulong64FromPair: {
    name: '64-bit ULong from High/Low Pair',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'makeUlong64' },
        params: [
          { type: 'Identifier', name: 'high' },
          { type: 'Identifier', name: 'low' }
        ],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: {
              type: 'ArrayExpression',
              elements: [
                { type: 'Identifier', name: 'low' },
                { type: 'Identifier', name: 'high' }
              ]
            }
          }]
        }
      }]
    }
  },

  // 64-bit addition (add with carry)
  ulong64Add: {
    name: '64-bit ULong Addition',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'addUlong64' },
        params: [
          { type: 'Identifier', name: 'aLow' },
          { type: 'Identifier', name: 'aHigh' },
          { type: 'Identifier', name: 'bLow' },
          { type: 'Identifier', name: 'bHigh' }
        ],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'sumLow' },
                init: { type: 'BinaryExpression', operator: '+',
                  left: { type: 'Identifier', name: 'aLow' },
                  right: { type: 'Identifier', name: 'bLow' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'carry' },
                init: { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'sumLow' },
                  right: { type: 'Literal', value: 32 } } }
            ]},
            { type: 'VariableDeclaration', kind: 'let', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'sumHigh' },
                init: { type: 'BinaryExpression', operator: '+',
                  left: { type: 'BinaryExpression', operator: '+',
                    left: { type: 'Identifier', name: 'aHigh' },
                    right: { type: 'Identifier', name: 'bHigh' } },
                  right: { type: 'Identifier', name: 'carry' } } }
            ]},
            { type: 'ReturnStatement', argument: {
              type: 'ArrayExpression',
              elements: [
                { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'sumLow' },
                  right: { type: 'Literal', value: 0 } },
                { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'sumHigh' },
                  right: { type: 'Literal', value: 0 } }
              ]
            }}
          ]
        }
      }]
    }
  },

  // 64-bit XOR operation
  ulong64Xor: {
    name: '64-bit ULong XOR',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'xorUlong64' },
        params: [
          { type: 'Identifier', name: 'aLow' },
          { type: 'Identifier', name: 'aHigh' },
          { type: 'Identifier', name: 'bLow' },
          { type: 'Identifier', name: 'bHigh' }
        ],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: {
              type: 'ArrayExpression',
              elements: [
                { type: 'BinaryExpression', operator: '^',
                  left: { type: 'Identifier', name: 'aLow' },
                  right: { type: 'Identifier', name: 'bLow' } },
                { type: 'BinaryExpression', operator: '^',
                  left: { type: 'Identifier', name: 'aHigh' },
                  right: { type: 'Identifier', name: 'bHigh' } }
              ]
            }
          }]
        }
      }]
    }
  },

  // 64-bit left shift
  ulong64Shl: {
    name: '64-bit ULong Left Shift',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'shlUlong64' },
        params: [
          { type: 'Identifier', name: 'low' },
          { type: 'Identifier', name: 'high' },
          { type: 'Identifier', name: 'shift' }
        ],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'IfStatement',
              test: { type: 'BinaryExpression', operator: '>=',
                left: { type: 'Identifier', name: 'shift' },
                right: { type: 'Literal', value: 32 } },
              consequent: {
                type: 'BlockStatement',
                body: [{
                  type: 'ReturnStatement',
                  argument: {
                    type: 'ArrayExpression',
                    elements: [
                      { type: 'Literal', value: 0 },
                      { type: 'BinaryExpression', operator: '<<',
                        left: { type: 'Identifier', name: 'low' },
                        right: { type: 'BinaryExpression', operator: '-',
                          left: { type: 'Identifier', name: 'shift' },
                          right: { type: 'Literal', value: 32 } } }
                    ]
                  }
                }]
              },
              alternate: null
            },
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'newHigh' },
                init: { type: 'BinaryExpression', operator: '|',
                  left: { type: 'BinaryExpression', operator: '<<',
                    left: { type: 'Identifier', name: 'high' },
                    right: { type: 'Identifier', name: 'shift' } },
                  right: { type: 'BinaryExpression', operator: '>>>',
                    left: { type: 'Identifier', name: 'low' },
                    right: { type: 'BinaryExpression', operator: '-',
                      left: { type: 'Literal', value: 32 },
                      right: { type: 'Identifier', name: 'shift' } } } } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'newLow' },
                init: { type: 'BinaryExpression', operator: '<<',
                  left: { type: 'Identifier', name: 'low' },
                  right: { type: 'Identifier', name: 'shift' } } }
            ]},
            { type: 'ReturnStatement', argument: {
              type: 'ArrayExpression',
              elements: [
                { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'newLow' },
                  right: { type: 'Literal', value: 0 } },
                { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'newHigh' },
                  right: { type: 'Literal', value: 0 } }
              ]
            }}
          ]
        }
      }]
    }
  },

  // 64-bit right shift (logical)
  ulong64Shr: {
    name: '64-bit ULong Right Shift',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'shrUlong64' },
        params: [
          { type: 'Identifier', name: 'low' },
          { type: 'Identifier', name: 'high' },
          { type: 'Identifier', name: 'shift' }
        ],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'IfStatement',
              test: { type: 'BinaryExpression', operator: '>=',
                left: { type: 'Identifier', name: 'shift' },
                right: { type: 'Literal', value: 32 } },
              consequent: {
                type: 'BlockStatement',
                body: [{
                  type: 'ReturnStatement',
                  argument: {
                    type: 'ArrayExpression',
                    elements: [
                      { type: 'BinaryExpression', operator: '>>>',
                        left: { type: 'Identifier', name: 'high' },
                        right: { type: 'BinaryExpression', operator: '-',
                          left: { type: 'Identifier', name: 'shift' },
                          right: { type: 'Literal', value: 32 } } },
                      { type: 'Literal', value: 0 }
                    ]
                  }
                }]
              },
              alternate: null
            },
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'newLow' },
                init: { type: 'BinaryExpression', operator: '|',
                  left: { type: 'BinaryExpression', operator: '>>>',
                    left: { type: 'Identifier', name: 'low' },
                    right: { type: 'Identifier', name: 'shift' } },
                  right: { type: 'BinaryExpression', operator: '<<',
                    left: { type: 'Identifier', name: 'high' },
                    right: { type: 'BinaryExpression', operator: '-',
                      left: { type: 'Literal', value: 32 },
                      right: { type: 'Identifier', name: 'shift' } } } } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'newHigh' },
                init: { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'high' },
                  right: { type: 'Identifier', name: 'shift' } } }
            ]},
            { type: 'ReturnStatement', argument: {
              type: 'ArrayExpression',
              elements: [
                { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'newLow' },
                  right: { type: 'Literal', value: 0 } },
                { type: 'Identifier', name: 'newHigh' }
              ]
            }}
          ]
        }
      }]
    }
  },

  // 64-bit rotation left
  ulong64RotL: {
    name: '64-bit ULong Rotate Left',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'rotlUlong64' },
        params: [
          { type: 'Identifier', name: 'low' },
          { type: 'Identifier', name: 'high' },
          { type: 'Identifier', name: 'n' }
        ],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'shift' },
                init: { type: 'BinaryExpression', operator: '&',
                  left: { type: 'Identifier', name: 'n' },
                  right: { type: 'Literal', value: 63 } } }
            ]},
            { type: 'IfStatement',
              test: { type: 'BinaryExpression', operator: '===',
                left: { type: 'Identifier', name: 'shift' },
                right: { type: 'Literal', value: 0 } },
              consequent: {
                type: 'BlockStatement',
                body: [{
                  type: 'ReturnStatement',
                  argument: {
                    type: 'ArrayExpression',
                    elements: [
                      { type: 'Identifier', name: 'low' },
                      { type: 'Identifier', name: 'high' }
                    ]
                  }
                }]
              },
              alternate: null
            },
            { type: 'ReturnStatement', argument: {
              type: 'ArrayExpression',
              elements: [
                { type: 'Literal', value: 0 },
                { type: 'Literal', value: 0 }
              ]
            }}
          ]
        }
      }]
    }
  },

  // 64-bit multiplication (low 32 bits)
  ulong64Mul: {
    name: '64-bit ULong Multiplication',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'mulUlong64' },
        params: [
          { type: 'Identifier', name: 'aLow' },
          { type: 'Identifier', name: 'aHigh' },
          { type: 'Identifier', name: 'bLow' },
          { type: 'Identifier', name: 'bHigh' }
        ],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'a0' },
                init: { type: 'BinaryExpression', operator: '&',
                  left: { type: 'Identifier', name: 'aLow' },
                  right: { type: 'Literal', value: 0xFFFF } } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'a1' },
                init: { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'aLow' },
                  right: { type: 'Literal', value: 16 } } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'b0' },
                init: { type: 'BinaryExpression', operator: '&',
                  left: { type: 'Identifier', name: 'bLow' },
                  right: { type: 'Literal', value: 0xFFFF } } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'b1' },
                init: { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'bLow' },
                  right: { type: 'Literal', value: 16 } } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'c0' },
                init: { type: 'BinaryExpression', operator: '*',
                  left: { type: 'Identifier', name: 'a0' },
                  right: { type: 'Identifier', name: 'b0' } } }
            ]},
            { type: 'ReturnStatement', argument: {
              type: 'ArrayExpression',
              elements: [
                { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'c0' },
                  right: { type: 'Literal', value: 0 } },
                { type: 'Literal', value: 0 }
              ]
            }}
          ]
        }
      }]
    }
  },

  // 64-bit AND/OR/NOT operations
  ulong64Bitwise: {
    name: '64-bit ULong Bitwise AND/OR/NOT',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'bitwiseUlong64' },
        params: [
          { type: 'Identifier', name: 'aLow' },
          { type: 'Identifier', name: 'aHigh' },
          { type: 'Identifier', name: 'bLow' },
          { type: 'Identifier', name: 'bHigh' }
        ],
        body: {
          type: 'BlockStatement',
          body: [
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'andLow' },
                init: { type: 'BinaryExpression', operator: '&',
                  left: { type: 'Identifier', name: 'aLow' },
                  right: { type: 'Identifier', name: 'bLow' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'andHigh' },
                init: { type: 'BinaryExpression', operator: '&',
                  left: { type: 'Identifier', name: 'aHigh' },
                  right: { type: 'Identifier', name: 'bHigh' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'orLow' },
                init: { type: 'BinaryExpression', operator: '|',
                  left: { type: 'Identifier', name: 'aLow' },
                  right: { type: 'Identifier', name: 'bLow' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'orHigh' },
                init: { type: 'BinaryExpression', operator: '|',
                  left: { type: 'Identifier', name: 'aHigh' },
                  right: { type: 'Identifier', name: 'bHigh' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'notLow' },
                init: { type: 'UnaryExpression', operator: '~', prefix: true,
                  argument: { type: 'Identifier', name: 'aLow' } } }
            ]},
            { type: 'VariableDeclaration', kind: 'const', declarations: [
              { type: 'VariableDeclarator', id: { type: 'Identifier', name: 'notHigh' },
                init: { type: 'UnaryExpression', operator: '~', prefix: true,
                  argument: { type: 'Identifier', name: 'aHigh' } } }
            ]},
            { type: 'ReturnStatement', argument: {
              type: 'ArrayExpression',
              elements: [
                { type: 'Identifier', name: 'andLow' },
                { type: 'Identifier', name: 'andHigh' },
                { type: 'Identifier', name: 'orLow' },
                { type: 'Identifier', name: 'orHigh' },
                { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'notLow' },
                  right: { type: 'Literal', value: 0 } },
                { type: 'BinaryExpression', operator: '>>>',
                  left: { type: 'Identifier', name: 'notHigh' },
                  right: { type: 'Literal', value: 0 } }
              ]
            }}
          ]
        }
      }]
    }
  },

  // ==================== PATTERNS ====================

  // ObjectPattern (destructuring)
  objectPattern: {
    name: 'ObjectPattern',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testDestructure' },
        params: [{
          type: 'ObjectPattern',
          properties: [
            { type: 'Property', key: { type: 'Identifier', name: 'a' }, value: { type: 'Identifier', name: 'a' }, shorthand: true, kind: 'init' },
            { type: 'Property', key: { type: 'Identifier', name: 'b' }, value: { type: 'Identifier', name: 'b' }, shorthand: true, kind: 'init' }
          ]
        }],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: { type: 'BinaryExpression', operator: '+',
              left: { type: 'Identifier', name: 'a' },
              right: { type: 'Identifier', name: 'b' } }
          }]
        }
      }]
    }
  },

  // ArrayPattern (destructuring)
  arrayPattern: {
    name: 'ArrayPattern',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testArrayDestructure' },
        params: [{
          type: 'ArrayPattern',
          elements: [
            { type: 'Identifier', name: 'first' },
            { type: 'Identifier', name: 'second' },
            { type: 'RestElement', argument: { type: 'Identifier', name: 'rest' } }
          ]
        }],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: { type: 'Identifier', name: 'first' }
          }]
        }
      }]
    }
  },

  // AssignmentPattern (default values)
  assignmentPattern: {
    name: 'AssignmentPattern',
    ast: {
      type: 'Program',
      body: [{
        type: 'FunctionDeclaration',
        id: { type: 'Identifier', name: 'testDefault' },
        params: [{
          type: 'AssignmentPattern',
          left: { type: 'Identifier', name: 'x' },
          right: { type: 'Literal', value: 10 }
        }],
        body: {
          type: 'BlockStatement',
          body: [{
            type: 'ReturnStatement',
            argument: { type: 'Identifier', name: 'x' }
          }]
        }
      }]
    }
  }
};

// ============================================================================
// LANGUAGE CONFIGURATIONS WITH ALL DIALECTS AND PARAMETER OPTIONS
// ============================================================================
const LANGUAGES = {
  // TypeScript with different configurations
  typescript: {
    file: 'typescript.js', ext: 'ts', transformer: 'TypeScriptTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'strict', options: { strictNullChecks: true } }
    ]
  },

  // JavaScript (ES5, ES6+, etc.)
  javascript: {
    file: 'javascript.js', ext: 'js', transformer: 'JavaScriptTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'es5', options: { targetVersion: 'es5' } },
      { name: 'es2020', options: { targetVersion: 'es2020' } }
    ]
  },

  // Java with different package configurations
  java: {
    file: 'java.js', ext: 'java', transformer: 'JavaTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'custom-package', options: { packageName: 'org.test', className: 'TestClass' } }
    ]
  },

  // C# with namespace configurations
  csharp: {
    file: 'csharp.js', ext: 'cs', transformer: 'CSharpTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'custom-namespace', options: { namespace: 'TestNamespace', className: 'TestClass' } }
    ]
  },

  // C++ with namespace configurations
  cpp: {
    file: 'cpp.js', ext: 'cpp', transformer: 'CppTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'custom-namespace', options: { namespace: 'test', className: 'TestClass' } }
    ]
  },

  // C with different standards (C89, C99, C11, C17, C23)
  c: {
    file: 'c.js', ext: 'c', transformer: 'CTransformer.js',
    dialects: [
      { name: 'c11', options: { standard: 'c11' } },
      { name: 'c89', options: { standard: 'c89' } },
      { name: 'c99', options: { standard: 'c99' } },
      { name: 'c17', options: { standard: 'c17' } },
      { name: 'c23', options: { standard: 'c23' } },
      { name: 'no-headers', options: { standard: 'c11', addHeaders: false } },
      { name: 'no-comments', options: { standard: 'c11', addComments: false } }
    ]
  },

  // Go with different configurations
  go: {
    file: 'go.js', ext: 'go', transformer: 'GoTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'strict-types', options: { useStrictTypes: true } },
      { name: 'generics', options: { useStrictTypes: true, useGenerics: true } },
      { name: 'error-handling', options: { errorHandling: true } },
      { name: 'with-context', options: { useContext: true } },
      { name: 'crypto', options: { useCrypto: true } },
      { name: 'custom-package', options: { packageName: 'testpkg' } }
    ]
  },

  // Rust with different editions
  rust: {
    file: 'rust.js', ext: 'rs', transformer: 'RustTransformer.js',
    dialects: [
      { name: '2021', options: { edition: '2021' } },
      { name: '2018', options: { edition: '2018' } },
      { name: '2015', options: { edition: '2015' } },
      { name: 'no-std', options: { edition: '2021', noStd: true } },
      { name: 'zero-copy', options: { edition: '2021', useZeroCopy: true } }
    ]
  },

  // Python with type hints options
  python: {
    file: 'python.js', ext: 'py', transformer: 'PythonTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'no-type-hints', options: { addTypeHints: false } },
      { name: 'no-docstrings', options: { addDocstrings: false } },
      { name: 'strict-types', options: { strictTypes: true } },
      { name: 'minimal', options: { addTypeHints: false, addDocstrings: false } }
    ]
  },

  // Ruby with frozen string and symbol options
  ruby: {
    file: 'ruby.js', ext: 'rb', transformer: 'RubyTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'no-frozen-strings', options: { useFrozenStringLiteral: false } },
      { name: 'string-keys', options: { useSymbolKeys: false } },
      { name: 'no-comments', options: { addComments: false } }
    ]
  },

  // PHP with strict types and arrow functions
  php: {
    file: 'php.js', ext: 'php', transformer: 'PhpTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'no-strict', options: { strictTypes: false } },
      { name: 'with-namespace', options: { namespace: 'App\\Test' } },
      { name: 'no-docblocks', options: { addDocBlocks: false } },
      { name: 'no-arrow-functions', options: { useArrowFunctions: false } }
    ]
  },

  // Perl with modern features
  perl: {
    file: 'perl.js', ext: 'pl', transformer: 'PerlTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'no-strict', options: { useStrict: false } },
      { name: 'no-warnings', options: { useWarnings: false } },
      { name: 'with-signatures', options: { addSignatures: true } },
      { name: 'modern-class', options: { useModernClass: true } },
      { name: 'experimental', options: { useExperimentalFeatures: true } },
      { name: 'custom-package', options: { packageName: 'TestPackage' } }
    ]
  },

  // Kotlin with package options
  kotlin: {
    file: 'kotlin.js', ext: 'kt', transformer: 'KotlinTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'custom-package', options: { packageName: 'com.test.crypto' } }
    ]
  },

  // Delphi with unit name options
  delphi: {
    file: 'delphi.js', ext: 'pas', transformer: 'DelphiTransformer.js',
    dialects: [
      { name: 'default', options: {} },
      { name: 'custom-unit', options: { unitName: 'TestUnit' } }
    ]
  },

  // BASIC dialects (FreeBASIC, VB.NET, VB6, VB, VBA, VBScript, Gambas, Xojo)
  basic: {
    file: 'basic.js', ext: 'bas', transformer: 'BasicTransformer.js',
    dialects: [
      { name: 'freebasic', options: { variant: 'FREEBASIC' } },
      { name: 'vbnet', options: { variant: 'VBNET' } },
      { name: 'vb6', options: { variant: 'VB6' } },
      { name: 'vb', options: { variant: 'VB' } },
      { name: 'vba', options: { variant: 'VBA' } },
      { name: 'vbscript', options: { variant: 'VBSCRIPT' } },
      { name: 'gambas', options: { variant: 'GAMBAS' } },
      { name: 'xojo', options: { variant: 'XOJO' } },
      { name: 'no-classes', options: { variant: 'FREEBASIC', useClasses: false } }
    ]
  }
};

// ============================================================================
// TEST SUITE CLASS
// ============================================================================
class ComprehensiveTestSuite {
  constructor() {
    this.results = {
      languages: {},
      coverage: { supported: [], unsupported: [], partial: [] },
      issues: [],
      warnings: [],
      stats: { total: 0, passed: 0, failed: 0, skipped: 0 }
    };
    this.pluginDir = path.join(__dirname, '..', 'codingplugins');
  }

  log(msg, color = 'reset') {
    console.log(`${C[color]}${msg}${C.reset}`);
  }

  // Check if a transformer has a specific method
  hasMethod(transformer, methodName) {
    return typeof transformer[methodName] === 'function';
  }

  // Get all transform methods in a transformer
  getTransformMethods(transformer) {
    const methods = [];
    let proto = Object.getPrototypeOf(transformer);
    while (proto && proto.constructor.name !== 'Object') {
      const ownMethods = Object.getOwnPropertyNames(proto)
        .filter(m => m.startsWith('transform') && typeof proto[m] === 'function');
      methods.push(...ownMethods);
      proto = Object.getPrototypeOf(proto);
    }
    return [...new Set(methods)];
  }

  // Extract supported node types from transformer's transformExpression/transformStatement
  analyzeTransformerCoverage(transformerPath) {
    try {
      const content = fs.readFileSync(transformerPath, 'utf8');
      const coverage = {
        expressions: [],
        statements: [],
        methods: []
      };

      // Find all case statements in transformExpression
      const exprMatches = content.matchAll(/case\s+['"](\w+)['"]\s*:/g);
      for (const match of exprMatches)
        coverage.expressions.push(match[1]);

      // Find all transform methods
      const methodMatches = content.matchAll(/transform(\w+)\s*\(/g);
      for (const match of methodMatches)
        coverage.methods.push('transform' + match[1]);

      return coverage;
    } catch (e) {
      return null;
    }
  }

  // Test a single AST transformation with options
  testTransformation(plugin, testCase, langName, options = {}) {
    const result = { name: testCase.name, success: false, error: null, code: null, warnings: [] };

    try {
      const output = plugin.GenerateFromAST(testCase.ast, options);

      if (output && output.success) {
        result.success = true;
        result.code = output.code;
        if (output.warnings)
          result.warnings = output.warnings;
      } else {
        result.error = output?.error || 'Unknown transformation error';
      }
    } catch (e) {
      result.error = e.message;
    }

    return result;
  }

  // Analyze code for issues
  analyzeGeneratedCode(code, language) {
    const issues = [];

    if (!code || typeof code !== 'string')
      return [{ type: 'critical', message: 'No code generated' }];

    // Check for unhandled placeholders
    const placeholders = code.match(/\/\*\s*(unknown|unhandled|unsupported)[^*]*\*\//gi);
    if (placeholders) {
      placeholders.forEach(p => {
        issues.push({ type: 'unsupported', message: `Placeholder found: ${p.substring(0, 50)}...` });
      });
    }

    // Check for raw AST leakage
    if (code.includes('[object Object]'))
      issues.push({ type: 'critical', message: 'Raw object leaked into output' });

    // Check for undefined/null literals that shouldn't be there
    if (code.match(/\bundefined\b/) && !['javascript', 'typescript'].includes(language))
      issues.push({ type: 'warning', message: 'JavaScript "undefined" in non-JS output' });

    // Check balanced brackets
    const brackets = { '(': 0, '[': 0, '{': 0 };
    const closers = { ')': '(', ']': '[', '}': '{' };
    for (const char of code) {
      if (brackets[char] !== undefined) brackets[char]++;
      if (closers[char]) brackets[closers[char]]--;
    }
    for (const [bracket, count] of Object.entries(brackets)) {
      if (count !== 0)
        issues.push({ type: 'syntax', message: `Unbalanced '${bracket}': ${count > 0 ? 'unclosed' : 'extra closing'}` });
    }

    return issues;
  }

  // Test a complete language with all its dialects
  async testLanguage(langName, langConfig) {
    const langResult = {
      name: langName,
      loaded: false,
      registered: false,
      transformerLoaded: false,
      tests: {},
      dialects: {},
      coverage: null,
      issues: [],
      methods: []
    };

    this.log(`\n${'='.repeat(60)}`, 'cyan');
    this.log(`Testing: ${langName.toUpperCase()}`, 'bright');
    this.log('='.repeat(60), 'cyan');

    try {
      // Load plugin framework
      const languagePluginPath = path.join(this.pluginDir, 'LanguagePlugin.js');
      delete require.cache[require.resolve(languagePluginPath)];
      const { LanguagePlugins } = require(languagePluginPath);
      LanguagePlugins.Clear();

      // Load language plugin
      const pluginPath = path.join(this.pluginDir, langConfig.file);
      delete require.cache[require.resolve(pluginPath)];
      require(pluginPath);
      langResult.loaded = true;

      const plugins = LanguagePlugins.GetAll();
      if (plugins.length === 0) {
        langResult.issues.push({ type: 'critical', message: 'Plugin did not register' });
        return langResult;
      }

      langResult.registered = true;
      const plugin = plugins[0];

      // Load and analyze transformer
      const transformerPath = path.join(this.pluginDir, langConfig.transformer);
      if (fs.existsSync(transformerPath)) {
        langResult.transformerLoaded = true;
        langResult.coverage = this.analyzeTransformerCoverage(transformerPath);

        // Get transformer methods
        try {
          delete require.cache[require.resolve(transformerPath)];
          const transformerModule = require(transformerPath);
          const TransformerClass = Object.values(transformerModule).find(v =>
            typeof v === 'function' && v.name.includes('Transformer')
          );
          if (TransformerClass) {
            const instance = new TransformerClass();
            langResult.methods = this.getTransformMethods(instance);
          }
        } catch (e) {
          langResult.issues.push({ type: 'warning', message: `Transformer analysis error: ${e.message}` });
        }
      }

      // Get dialects to test (default to single default dialect if none specified)
      const dialects = langConfig.dialects || [{ name: 'default', options: {} }];
      const dialectCount = dialects.length;

      // Test each dialect
      for (const dialect of dialects) {
        const dialectKey = `${langName}:${dialect.name}`;
        langResult.dialects[dialect.name] = { passed: 0, failed: 0, tests: {} };

        // Only show dialect header if multiple dialects
        if (dialectCount > 1) {
          this.log(`\n  [${dialect.name}]`, 'magenta');
        }

        // Run all test cases for this dialect
        for (const [testId, testCase] of Object.entries(TEST_CASES)) {
          if (args.quick && !['basicFunction', 'classWithModernFeatures'].includes(testId))
            continue;

          const testKey = `${testId}:${dialect.name}`;
          this.log(`  Testing: ${testCase.name}${dialectCount > 1 ? '' : ''}...`, 'blue');
          const testResult = this.testTransformation(plugin, testCase, langName, dialect.options);
          langResult.dialects[dialect.name].tests[testId] = testResult;

          // Store in combined tests for backward compatibility
          if (!langResult.tests[testId]) {
            langResult.tests[testId] = testResult;
          }

          if (testResult.success) {
            // Analyze generated code
            const codeIssues = this.analyzeGeneratedCode(testResult.code, langName);
            testResult.codeIssues = codeIssues;

            if (codeIssues.length === 0) {
              this.log(`    OK`, 'green');
              this.results.stats.passed++;
              langResult.dialects[dialect.name].passed++;
            } else {
              const criticals = codeIssues.filter(i => i.type === 'critical');
              if (criticals.length > 0) {
                this.log(`    ISSUES: ${criticals.map(i => i.message).join(', ')}`, 'red');
                this.results.stats.failed++;
                langResult.dialects[dialect.name].failed++;
              } else {
                this.log(`    OK (with warnings)`, 'yellow');
                this.results.stats.passed++;
                langResult.dialects[dialect.name].passed++;
              }
            }
          } else {
            this.log(`    FAILED: ${testResult.error}`, 'red');
            this.results.stats.failed++;
            langResult.dialects[dialect.name].failed++;
          }
          this.results.stats.total++;
        }
      }

      // Check coverage of modern features
      if (langResult.coverage) {
        const modernTypes = ['StaticBlock', 'ChainExpression', 'ClassExpression', 'YieldExpression', 'PrivateIdentifier'];
        const supported = modernTypes.filter(t => langResult.coverage.expressions.includes(t));
        const unsupported = modernTypes.filter(t => !langResult.coverage.expressions.includes(t));

        if (unsupported.length > 0)
          langResult.issues.push({ type: 'coverage', message: `Missing modern features: ${unsupported.join(', ')}` });

        this.log(`\n  Coverage: ${supported.length}/${modernTypes.length} modern features`, 'magenta');
        this.log(`  Dialects tested: ${dialectCount}`, 'magenta');
      }

    } catch (e) {
      langResult.issues.push({ type: 'critical', message: `Load error: ${e.message}` });
      this.log(`  LOAD ERROR: ${e.message}`, 'red');
    }

    this.results.languages[langName] = langResult;
    return langResult;
  }

  // Generate coverage report
  generateCoverageReport() {
    this.log('\n' + '='.repeat(80), 'bright');
    this.log('COMPREHENSIVE TRANSPILER COVERAGE REPORT', 'bright');
    this.log('='.repeat(80), 'bright');

    // Count total dialects
    let totalDialects = 0;
    for (const [, langConfig] of Object.entries(LANGUAGES)) {
      totalDialects += (langConfig.dialects || [{ name: 'default' }]).length;
    }

    // Statistics
    this.log(`\nOverall Statistics:`, 'cyan');
    this.log(`  Total tests: ${this.results.stats.total}`);
    this.log(`  Passed: ${C.green}${this.results.stats.passed}${C.reset}`);
    this.log(`  Failed: ${C.red}${this.results.stats.failed}${C.reset}`);
    this.log(`  Success rate: ${Math.round((this.results.stats.passed / this.results.stats.total) * 100)}%`);
    this.log(`  Languages: ${Object.keys(LANGUAGES).length}`);
    this.log(`  Dialects/Configurations: ${totalDialects}`);

    // Per-language summary
    this.log(`\nLanguage Summary:`, 'cyan');
    this.log('-'.repeat(85));
    this.log(`${'Language'.padEnd(12)} | ${'Loaded'.padEnd(8)} | ${'Dialects'.padEnd(10)} | ${'Tests'.padEnd(12)} | ${'Issues'.padEnd(8)} | Status`);
    this.log('-'.repeat(85));

    for (const [lang, result] of Object.entries(this.results.languages)) {
      const dialectCount = Object.keys(result.dialects || {}).length || 1;
      let totalPassed = 0;
      let totalTests = 0;
      for (const dialectResult of Object.values(result.dialects || {})) {
        totalPassed += dialectResult.passed;
        totalTests += dialectResult.passed + dialectResult.failed;
      }
      // Fallback for non-dialect aware results
      if (totalTests === 0) {
        totalTests = Object.keys(result.tests).length;
        totalPassed = Object.values(result.tests).filter(t => t.success).length;
      }

      const issueCount = result.issues.length;
      const status = !result.loaded ? 'LOAD FAIL' :
                     issueCount > 0 ? 'ISSUES' :
                     totalPassed === totalTests ? 'OK' : 'PARTIAL';

      const statusColor = status === 'OK' ? C.green :
                         status === 'PARTIAL' ? C.yellow : C.red;

      this.log(`${lang.padEnd(12)} | ${(result.loaded ? 'Yes' : 'No').padEnd(8)} | ${String(dialectCount).padEnd(10)} | ${`${totalPassed}/${totalTests}`.padEnd(12)} | ${String(issueCount).padEnd(8)} | ${statusColor}${status}${C.reset}`);
    }

    // Dialect breakdown
    this.log(`\nDialect/Configuration Details:`, 'cyan');
    this.log('-'.repeat(85));
    for (const [lang, result] of Object.entries(this.results.languages)) {
      if (Object.keys(result.dialects || {}).length > 1) {
        this.log(`  ${lang}:`, 'bright');
        for (const [dialectName, dialectResult] of Object.entries(result.dialects)) {
          const total = dialectResult.passed + dialectResult.failed;
          const statusIcon = dialectResult.failed === 0 ? C.green + '✓' : C.red + '✗';
          this.log(`    ${dialectName.padEnd(20)} ${statusIcon} ${dialectResult.passed}/${total}${C.reset}`);
        }
      }
    }

    // Modern features coverage
    this.log(`\nModern JavaScript Features Support:`, 'cyan');
    const modernFeatures = ['StaticBlock', 'ChainExpression', 'ClassExpression', 'YieldExpression', 'PrivateIdentifier'];

    for (const feature of modernFeatures) {
      const supporting = [];
      const notSupporting = [];

      for (const [lang, result] of Object.entries(this.results.languages)) {
        if (result.coverage?.expressions?.includes(feature))
          supporting.push(lang);
        else
          notSupporting.push(lang);
      }

      const coverage = supporting.length > 0 ? `${supporting.length}/15` : '0/15';
      const color = supporting.length === 15 ? 'green' : supporting.length > 10 ? 'yellow' : 'red';
      this.log(`  ${feature.padEnd(20)}: ${C[color]}${coverage}${C.reset}`);
    }

    // Issues summary
    const allIssues = [];
    for (const [lang, result] of Object.entries(this.results.languages)) {
      for (const issue of result.issues) {
        allIssues.push({ language: lang, ...issue });
      }
      for (const [testId, test] of Object.entries(result.tests)) {
        if (test.codeIssues) {
          for (const issue of test.codeIssues) {
            allIssues.push({ language: lang, test: testId, ...issue });
          }
        }
      }
    }

    if (allIssues.length > 0) {
      this.log(`\nIssues Found (${allIssues.length}):`, 'red');
      const criticals = allIssues.filter(i => i.type === 'critical');
      const warnings = allIssues.filter(i => i.type !== 'critical');

      if (criticals.length > 0) {
        this.log(`  Critical (${criticals.length}):`, 'red');
        criticals.slice(0, 10).forEach(i => {
          this.log(`    - [${i.language}${i.test ? '/' + i.test : ''}] ${i.message}`, 'red');
        });
        if (criticals.length > 10)
          this.log(`    ... and ${criticals.length - 10} more`, 'dim');
      }

      if (warnings.length > 0 && args.verbose) {
        this.log(`  Warnings (${warnings.length}):`, 'yellow');
        warnings.slice(0, 10).forEach(i => {
          this.log(`    - [${i.language}${i.test ? '/' + i.test : ''}] ${i.message}`, 'yellow');
        });
      }
    }

    this.log('\n' + '='.repeat(80), 'bright');
  }

  // Main run method
  async run() {
    this.log('\nComprehensive Transpiler Test Suite', 'bright');
    this.log(`Mode: ${args.quick ? 'Quick' : 'Full'} | Verbose: ${args.verbose ? 'Yes' : 'No'}\n`, 'dim');

    const languagesToTest = args.language
      ? { [args.language]: LANGUAGES[args.language] }
      : LANGUAGES;

    if (args.language && !LANGUAGES[args.language]) {
      this.log(`Unknown language: ${args.language}`, 'red');
      this.log(`Available: ${Object.keys(LANGUAGES).join(', ')}`, 'yellow');
      process.exit(1);
    }

    for (const [langName, langConfig] of Object.entries(languagesToTest)) {
      await this.testLanguage(langName, langConfig);
    }

    this.generateCoverageReport();

    const exitCode = this.results.stats.failed > 0 ? 1 : 0;
    this.log(`\nTest suite completed with exit code: ${exitCode}`, exitCode === 0 ? 'green' : 'red');
    process.exit(exitCode);
  }
}

// Run
if (require.main === module) {
  const suite = new ComprehensiveTestSuite();
  suite.run().catch(e => {
    console.error(`Test suite crashed: ${e.message}`);
    console.error(e.stack);
    process.exit(2);
  });
}

module.exports = ComprehensiveTestSuite;
