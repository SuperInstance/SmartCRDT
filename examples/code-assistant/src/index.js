/**
 * Code Assistant
 *
 * Main interface for the AI-powered coding assistant that combines
 * code analysis, bug detection, refactoring suggestions, and code generation.
 */

const { LSIClient } = require('@lsi/sdk');
const CodeAnalyzer = require('./analyzer');
const CodeGenerator = require('./generators');
const BugDetector = require('./detectors');
const RefactoringSuggester = require('./suggester');

class CodeAssistant {
  constructor(options = {}) {
    this.lsi = new LSIClient({
      modelPath: options.modelPath || './models',
      cacheSize: options.cacheSize || 2000
    });

    this.analyzer = new CodeAnalyzer(this.lsi);
    this.generator = new CodeGenerator(this.lsi, this.analyzer);
    this.detector = new BugDetector(this.lsi, this.analyzer);
    this.suggester = new RefactoringSuggester(this.lsi, this.analyzer);
  }

  /**
   * Initialize the assistant
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.lsi.initialize();
    console.log('✓ Code Assistant initialized');
  }

  /**
   * Analyze code
   * @param {string} code - Source code
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Analysis results
   */
  async analyze(code, language) {
    const detectedLanguage = language || this.analyzer.detectLanguage(code);
    const features = await this.analyzer.extractFeatures(code, detectedLanguage);
    const embedding = await this.analyzer.embedCode(code, features);

    return {
      language: detectedLanguage,
      features,
      embedding,
      summary: this.summarizeFeatures(features)
    };
  }

  /**
   * Generate code from description
   * @param {string} description - Natural language description
   * @param {string} language - Target programming language
   * @returns {Promise<Object>} Generated code
   */
  async generate(description, language = 'javascript') {
    return await this.generator.generateFromDescription(description, language);
  }

  /**
   * Detect bugs in code
   * @param {string} code - Source code
   * @param {string} language - Programming language
   * @returns {Promise<Array>} Detected bugs
   */
  async detectBugs(code, language) {
    const detectedLanguage = language || this.analyzer.detectLanguage(code);
    return await this.detector.detectIssues(code, detectedLanguage);
  }

  /**
   * Suggest refactorings
   * @param {string} code - Source code
   * @param {string} language - Programming language
   * @returns {Promise<Array>} Refactoring suggestions
   */
  async suggestRefactorings(code, language) {
    const detectedLanguage = language || this.analyzer.detectLanguage(code);
    return await this.suggester.suggestRefactorings(code, detectedLanguage);
  }

  /**
   * Explain code
   * @param {string} code - Source code
   * @param {string} language - Programming language
   * @returns {Promise<string>} Code explanation
   */
  async explain(code, language) {
    const analysis = await this.analyze(code, language);
    const explanation = [];

    explanation.push(`This is ${analysis.language} code.`);
    explanation.push(`It contains ${analysis.features.functions.length} functions and ${analysis.features.classes.length} classes.`);
    explanation.push(`The complexity is ${analysis.features.complexity}.`);

    if (analysis.features.functions.length > 0) {
      explanation.push('\nFunctions:');
      analysis.features.functions.forEach(f => {
        explanation.push(`- ${f.name}() with ${f.params.length} parameters`);
      });
    }

    return explanation.join('\n');
  }

  /**
   * Perform full code analysis
   * @param {string} code - Source code
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Complete analysis
   */
  async fullAnalysis(code, language) {
    const [
      analysis,
      bugs,
      refactorings
    ] = await Promise.all([
      this.analyze(code, language),
      this.detectBugs(code, language),
      this.suggestRefactorings(code, language)
    ]);

    return {
      analysis,
      bugs: bugs.filter(b => b.severity !== 'info'),
      refactorings,
      explanation: await this.explain(code, language),
      overallScore: this.calculateScore(analysis, bugs, refactorings)
    };
  }

  /**
   * Calculate code quality score
   * @param {Object} analysis - Code analysis
   * @param {Array} bugs - Detected bugs
   * @param {Array} refactorings - Refactoring suggestions
   * @returns {number} Quality score (0-100)
   */
  calculateScore(analysis, bugs, refactorings) {
    let score = 100;

    // Deduct for bugs
    bugs.forEach(bug => {
      const deductions = { critical: 20, error: 10, warning: 5 };
      score -= deductions[bug.severity] || 2;
    });

    // Deduct for high complexity
    if (analysis.features.complexity > 10) {
      score -= 10;
    }

    // Deduct for refactorings needed
    score -= Math.min(refactorings.length * 2, 20);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Summarize code features
   * @param {Object} features - Code features
   * @returns {Object} Summary
   */
  summarizeFeatures(features) {
    return {
      functions: features.functions.length,
      classes: features.classes.length,
      complexity: features.complexity,
      lines: features.linesOfCode
    };
  }
}

module.exports = CodeAssistant;
