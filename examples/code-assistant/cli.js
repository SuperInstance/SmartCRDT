/**
 * CLI Interface for Code Assistant
 *
 * Command-line interface for analyzing, detecting bugs,
 * and generating code.
 */

const CodeAssistant = require('./src/index');
const fs = require('fs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const filePath = args[1];

  if (!command) {
    console.log('LSI Code Assistant');
    console.log('Usage: node cli.js <command> [arguments]');
    console.log('\nCommands:');
    console.log('  analyze <file>          - Analyze code structure');
    console.log('  detect <file>           - Detect bugs and issues');
    console.log('  refactor <file>         - Suggest refactorings');
    console.log('  explain <file>          - Explain what code does');
    console.log('  generate <description>  - Generate code from description');
    console.log('\nExamples:');
    console.log('  node cli.js analyze example.js');
    console.log('  node cli.js generate "Create an async function"');
    process.exit(1);
  }

  const assistant = new CodeAssistant();
  await assistant.initialize();

  switch (command) {
    case 'analyze':
      await analyzeFile(assistant, filePath);
      break;

    case 'detect':
      await detectBugs(assistant, filePath);
      break;

    case 'refactor':
      await suggestRefactorings(assistant, filePath);
      break;

    case 'explain':
      await explainCode(assistant, filePath);
      break;

    case 'generate':
      await generateCode(assistant, args.slice(1).join(' '));
      break;

    default:
      console.error('Unknown command:', command);
      process.exit(1);
  }
}

/**
 * Analyze a file
 */
async function analyzeFile(assistant, filePath) {
  if (!filePath) {
    console.error('File path required');
    process.exit(1);
  }

  const code = fs.readFileSync(filePath, 'utf-8');
  const ext = path.extname(filePath).slice(1);
  const language = ext === 'ts' ? 'typescript' : ext;

  const result = await assistant.fullAnalysis(code, language);
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Detect bugs in a file
 */
async function detectBugs(assistant, filePath) {
  if (!filePath) {
    console.error('File path required');
    process.exit(1);
  }

  const code = fs.readFileSync(filePath, 'utf-8');
  const bugs = await assistant.detectBugs(code);

  if (bugs.length === 0) {
    console.log('✓ No issues detected!');
  } else {
    console.log(`Found ${bugs.length} issues:\n`);
    bugs.forEach(bug => {
      console.log(`${bug.severity.toUpperCase()}: ${bug.message}`);
      console.log(`  Line ${bug.line}: ${bug.suggestion}\n`);
    });
  }
}

/**
 * Suggest refactorings
 */
async function suggestRefactorings(assistant, filePath) {
  if (!filePath) {
    console.error('File path required');
    process.exit(1);
  }

  const code = fs.readFileSync(filePath, 'utf-8');
  const suggestions = await assistant.suggestRefactorings(code);

  if (suggestions.length === 0) {
    console.log('✓ No refactorings suggested!');
  } else {
    console.log(`Found ${suggestions.length} refactoring opportunities:\n`);
    suggestions.forEach(s => {
      console.log(`• ${s.suggestion}`);
      console.log(`  Line ${s.line}\n`);
    });
  }
}

/**
 * Explain code
 */
async function explainCode(assistant, filePath) {
  if (!filePath) {
    console.error('File path required');
    process.exit(1);
  }

  const code = fs.readFileSync(filePath, 'utf-8');
  const explanation = await assistant.explain(code);
  console.log(explanation);
}

/**
 * Generate code
 */
async function generateCode(assistant, description) {
  if (!description) {
    console.error('Description required');
    process.exit(1);
  }

  const result = await assistant.generate(description);
  console.log(result.code);
  console.log('\n' + result.explanation);
}

main().catch(console.error);
