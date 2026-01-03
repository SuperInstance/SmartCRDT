/**
 * Bug Detector
 *
 * Detects common code issues and bugs using pattern matching
 * and semantic analysis.
 */

class BugDetector {
  constructor(lsiClient, analyzer) {
    this.lsi = lsiClient;
    this.analyzer = analyzer;
    this.rules = this.loadRules();
  }

  /**
   * Load bug detection rules
   * @returns {Object} Detection rules
   */
  loadRules() {
    return {
      // Common anti-patterns
      unusedVariables: {
        pattern: /const\s+(\w+)\s*=/,
        severity: 'warning',
        message: 'Variable may be unused'
      },

      // Missing error handling
      missingErrorHandling: {
        pattern: /await\s+[\w.]+\([^)]*\)(?!\s+\.catch|[\s\S]*?catch)/,
        severity: 'error',
        message: 'Promise without error handling'
      },

      // Console statements in production
      consoleStatements: {
        pattern: /console\.(log|warn|error|debug)/,
        severity: 'warning',
        message: 'Console statement should be removed'
      },

      // Hardcoded secrets
      hardcodedSecrets: {
        pattern: /(password|secret|api_key|token)\s*[=:]\s*['"][^'"]+['"]/i,
        severity: 'critical',
        message: 'Hardcoded sensitive data detected'
      },

      // Missing return statement
      missingReturn: {
        pattern: /function\s+\w+\([^)]*\)\s*{[^}]*}(?!\s*return)/,
        severity: 'error',
        message: 'Function may be missing return statement'
      }
    };
  }

  /**
   * Detect issues in code
   * @param {string} code - Source code
   * @param {string} language - Programming language
   * @returns {Promise<Array>} Array of detected issues
   */
  async detectIssues(code, language) {
    const issues = [];
    const features = await this.analyzer.extractFeatures(code, language);

    // Check against rules
    for (const [ruleName, rule] of Object.entries(this.rules)) {
      const matches = code.matchAll(new RegExp(rule.pattern, 'gi'));
      for (const match of matches) {
        const line = code.substring(0, match.index).split('\n').length;
        issues.push({
          rule: ruleName,
          severity: rule.severity,
          message: rule.message,
          line,
          column: match.index,
          suggestion: this.getSuggestion(ruleName)
        });
      }
    }

    // Semantic analysis using LSI
    const semanticIssues = await this.semanticAnalysis(code, features);
    issues.push(...semanticIssues);

    // Complexity analysis
    if (features.complexity > 10) {
      issues.push({
        rule: 'highComplexity',
        severity: 'warning',
        message: `High cyclomatic complexity: ${features.complexity}`,
        suggestion: 'Consider refactoring into smaller functions'
      });
    }

    return issues;
  }

  /**
   * Semantic analysis using embeddings
   * @param {string} code - Source code
   * @param {Object} features - Code features
   * @returns {Promise<Array>} Semantic issues
   */
  async semanticAnalysis(code, features) {
    const issues = [];

    // Check for potential race conditions
    const raceConditionPatterns = [
      /let\s+\w+\s*=\s*0/,
      /\+\+|\+=/,
      /await/
    ];

    if (raceConditionPatterns.every(p => p.test(code))) {
      issues.push({
        rule: 'potentialRaceCondition',
        severity: 'warning',
        message: 'Potential race condition detected',
        suggestion: 'Use atomic operations or proper synchronization'
      });
    }

    return issues;
  }

  /**
   * Get fix suggestion for rule
   * @param {string} ruleName - Rule name
   * @returns {string} Suggestion
   */
  getSuggestion(ruleName) {
    const suggestions = {
      unusedVariables: 'Remove unused variables or use them',
      missingErrorHandling: 'Add try-catch or .catch() for error handling',
      consoleStatements: 'Replace with proper logging framework',
      hardcodedSecrets: 'Use environment variables or secret management',
      missingReturn: 'Add return statement or explicitly return void'
    };

    return suggestions[ruleName] || 'Review and fix the issue';
  }

  /**
   * Generate fix for issue
   * @param {string} code - Source code
   * @param {Object} issue - Issue to fix
   * @returns {Promise<string>} Fixed code
   */
  async generateFix(code, issue) {
    const lines = code.split('\n');
    const lineIndex = issue.line - 1;
    const originalLine = lines[lineIndex];

    let fixedLine;
    switch (issue.rule) {
      case 'consoleStatements':
        fixedLine = originalLine.replace(/console\.(log|warn|error|debug)\(([^)]*)\)/,
          'logger.$1($2)');
        break;

      case 'missingErrorHandling':
        // Wrap with try-catch
        lines[lineIndex] = 'try {\n    ' + originalLine;
        lines.splice(lineIndex + 1, 0, '  } catch (error) {\n    console.error(error);\n  }');
        return lines.join('\n');

      default:
        fixedLine = originalLine; // No automatic fix
    }

    lines[lineIndex] = fixedLine;
    return lines.join('\n');
  }
}

module.exports = BugDetector;
