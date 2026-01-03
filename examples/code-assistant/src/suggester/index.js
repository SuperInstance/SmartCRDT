/**
 * Refactoring Suggester
 *
 * Suggests code refactorings to improve maintainability,
 * readability, and overall code quality.
 */

class RefactoringSuggester {
  constructor(lsiClient, analyzer) {
    this.lsi = lsiClient;
    this.analyzer = analyzer;
    this.refactorings = this.loadRefactorings();
  }

  /**
   * Load refactoring patterns
   * @returns {Object} Refactoring definitions
   */
  loadRefactorings() {
    return {
      extractMethod: {
        description: 'Extract repeated code into a method',
        trigger: 'repeated code blocks',
        benefit: 'Improves maintainability and reusability'
      },
      inlineMethod: {
        description: 'Inline simple methods',
        trigger: 'simple one-line methods',
        benefit: 'Reduces indirection'
      },
      renameVariable: {
        description: 'Rename variables to be more descriptive',
        trigger: 'short or unclear variable names',
        benefit: 'Improves code readability'
      },
      introduceParameterObject: {
        description: 'Group related parameters into an object',
        trigger: 'too many parameters (>4)',
        benefit: 'Simplifies function signatures'
      },
      replaceMagicNumber: {
        description: 'Replace magic numbers with named constants',
        trigger: 'numeric literals in code',
        benefit: 'Makes code more maintainable'
      }
    };
  }

  /**
   * Suggest refactorings for code
   * @param {string} code - Source code
   * @param {string} language - Programming language
   * @returns {Promise<Array>} Array of suggestions
   */
  async suggestRefactorings(code, language) {
    const suggestions = [];
    const features = await this.analyzer.extractFeatures(code, language);

    // Check for too many parameters
    features.functions.forEach(func => {
      if (func.params.length > 4) {
        suggestions.push({
          type: 'introduceParameterObject',
          function: func.name,
          line: func.line,
          suggestion: `Function ${func.name} has ${func.params.length} parameters. Consider using a parameter object.`,
          example: this.generateExample('introduceParameterObject', func)
        });
      }
    });

    // Check for magic numbers
    const magicNumbers = code.matchAll(/\b\d{2,}\b/g);
    for (const match of magicNumbers) {
      const line = code.substring(0, match.index).split('\n').length;
      suggestions.push({
        type: 'replaceMagicNumber',
        value: match[0],
        line,
        suggestion: `Consider replacing magic number ${match[0]} with a named constant`,
        example: `const MAX_SIZE = ${match[0]};`
      });
    }

    // Check for poorly named variables
    features.variables.forEach(variable => {
      if (variable.name.length < 3) {
        suggestions.push({
          type: 'renameVariable',
          variable: variable.name,
          line: variable.line,
          suggestion: `Variable "${variable.name}" has a short name. Consider a more descriptive name.`,
          example: `Rename "${variable.name}" to something like "${this.suggestName(variable.kind)}"`
        });
      }
    });

    return suggestions;
  }

  /**
   * Suggest better variable name
   * @param {string} kind - Variable kind (const, let, var)
   * @returns {string} Suggested name
   */
  suggestName(kind) {
    const suggestions = {
      const: ['configuration', 'settings', 'options', 'config'],
      let: ['counter', 'index', 'total', 'result'],
      var: ['data', 'response', 'output', 'value']
    };
    const options = suggestions[kind] || suggestions.const;
    return options[Math.floor(Math.random() * options.length)];
  }

  /**
   * Generate example refactoring
   * @param {string} type - Refactoring type
   * @param {Object} context - Context information
   * @returns {string} Example code
   */
  generateExample(type, context) {
    switch (type) {
      case 'introduceParameterObject':
        return `// Before
function ${context.name}(${context.params.join(', ')}) { }

// After
function ${context.name}({ ${context.params.join(', ')} }) { }`;

      case 'extractMethod':
        return `// Extract repeated logic into a named function`;

      default:
        return '// Apply refactoring';
    }
  }
}

module.exports = RefactoringSuggester;
