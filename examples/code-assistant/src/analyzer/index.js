/**
 * Code Analyzer
 *
 * Analyzes source code to extract features like functions,
 * classes, variables, and complexity metrics using AST parsing.
 */

const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const t = require('@babel/types');

class CodeAnalyzer {
  constructor(lsiClient) {
    this.lsi = lsiClient;
    this.languageSupport = {
      javascript: true,
      typescript: true,
      python: true,
      java: true,
      go: true
    };
  }

  /**
   * Detect programming language from code
   * @param {string} code - Source code
   * @returns {string} Detected language
   */
  detectLanguage(code) {
    const patterns = {
      typescript: /:\s*(string|number|boolean|interface|type|enum)/,
      javascript: /const|let|var|function|=>/,
      python: /def |class |import |from |print\(/,
      java: /public\s+(class|interface|enum)/,
      go: /func\s+\w+\(|package\s+main|import\s+\(/
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(code)) {
        return lang;
      }
    }
    return 'javascript'; // Default
  }

  /**
   * Parse code into AST
   * @param {string} code - Source code
   * @param {string} language - Programming language
   * @returns {Object|null} AST or null if parsing fails
   */
  parseAST(code, language = 'javascript') {
    try {
      if (language === 'typescript') {
        return parser.parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });
      }

      return parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
      });
    } catch (error) {
      console.error('Parse error:', error.message);
      return null;
    }
  }

  /**
   * Extract code features
   * @param {string} code - Source code
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Extracted features
   */
  async extractFeatures(code, language) {
    const features = {
      language,
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      complexity: 0,
      linesOfCode: code.split('\n').length
    };

    const ast = this.parseAST(code, language);
    if (!ast) return features;

    traverse(ast, {
      // Extract function declarations
      FunctionDeclaration: (path) => {
        features.functions.push({
          name: path.node.id.name,
          params: path.node.params.map(p => p.name),
          async: path.node.async,
          generator: path.node.generator,
          line: path.node.loc.start.line
        });
        features.complexity += this.calculateComplexity(path.node);
      },

      // Extract arrow functions
      ArrowFunctionExpression: (path) => {
        const parent = path.parent;
        if (t.isVariableDeclarator(parent)) {
          features.functions.push({
            name: parent.id.name,
            params: path.node.params.map(p => p.name),
            async: path.node.async,
            anonymous: true,
            line: path.node.loc.start.line
          });
        }
        features.complexity += this.calculateComplexity(path.node);
      },

      // Extract class declarations
      ClassDeclaration: (path) => {
        features.classes.push({
          name: path.node.id.name,
          methods: [],
          line: path.node.loc.start.line
        });

        // Extract methods
        path.node.body.body.forEach(node => {
          if (t.isClassMethod(node) && node.key) {
            features.classes[features.classes.length - 1].methods.push({
              name: node.key.name,
              kind: node.kind,
              async: node.async
            });
          }
        });
      },

      // Extract variable declarations
      VariableDeclarator: (path) => {
        if (t.isIdentifier(path.node.id)) {
          features.variables.push({
            name: path.node.id.name,
            kind: path.parent.kind,
            line: path.node.loc.start.line
          });
        }
      },

      // Extract imports
      ImportDeclaration: (path) => {
        features.imports.push({
          source: path.node.source.value,
          specifiers: path.node.specifiers.map(s => s.local.name)
        });
      }
    });

    return features;
  }

  /**
   * Calculate cyclomatic complexity
   * @param {Object} node - AST node
   * @returns {number} Complexity score
   */
  calculateComplexity(node) {
    let complexity = 1; // Base complexity

    traverse(node, {
      IfStatement() { complexity++; },
      WhileStatement() { complexity++; },
      ForStatement() { complexity++; },
      SwitchCase() { complexity++; },
      ConditionalExpression() { complexity++; },
      LogicalExpression(path) {
        if (path.node.operator === '&&' || path.node.operator === '||') {
          complexity++;
        }
      }
    });

    return complexity;
  }

  /**
   * Generate semantic embedding of code
   * @param {string} code - Source code
   * @param {Object} features - Extracted features
   * @returns {Promise<Array>} Vector embedding
   */
  async embedCode(code, features) {
    const semanticDescription = this.describeCode(features);
    return await this.lsi.embed(semanticDescription);
  }

  /**
   * Create semantic description of code
   * @param {Object} features - Code features
   * @returns {string} Semantic description
   */
  describeCode(features) {
    const parts = [];

    if (features.functions.length > 0) {
      parts.push(`Code contains ${features.functions.length} functions`);
      features.functions.forEach(f => {
        parts.push(`Function ${f.name} with ${f.params.length} parameters`);
      });
    }

    if (features.classes.length > 0) {
      parts.push(`Code defines ${features.classes.length} classes`);
      features.classes.forEach(c => {
        parts.push(`Class ${c.name} with ${c.methods.length} methods`);
      });
    }

    parts.push(`Complexity: ${features.complexity}`);
    parts.push(`Lines of code: ${features.linesOfCode}`);

    return parts.join('. ');
  }
}

module.exports = CodeAnalyzer;
