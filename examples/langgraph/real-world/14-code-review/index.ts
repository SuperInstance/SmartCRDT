/**
 * Example 14: Automated Code Review Workflow
 *
 * A multi-agent system for automated code review with security analysis,
 * style checking, and best practices validation.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { MockCodeReviewGenerator, createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('CodeReviewExample');

interface CodeReviewState {
  pullRequestId: string;
  codeFiles: string[];
  securityAnalysis?: any;
  styleCheck?: any;
  bestPractices?: any;
  overallScore?: number;
  reviewSummary?: string;
  metadata?: Record<string, unknown>;
}

const CodeReviewStateAnnotation = Annotation.Root({
  pullRequestId: Annotation<string>(),
  codeFiles: Annotation<string[]>({
    default: () => [],
  }),
  securityAnalysis: Annotation<any>(),
  styleCheck: Annotation<any>(),
  bestPractices: Annotation<any>(),
  overallScore: Annotation<number>(),
  reviewSummary: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

// Security Analyzer: Check for vulnerabilities
async function securityAnalyzer(state: CodeReviewState): Promise<Partial<CodeReviewState>> {
  logger.log('Security analyzer running');
  await delay(150);

  const issues = Math.floor(Math.random() * 3);
  const securityAnalysis = {
    scanned: state.codeFiles.length,
    critical: 0,
    high: issues > 1 ? 1 : 0,
    medium: issues,
    low: Math.floor(Math.random() * 5),
    findings: issues === 0 ? ['No security issues found'] : [
      'Consider input validation',
      'Review dependency versions',
      'Check for SQL injection points'
    ].slice(0, issues),
    score: Math.max(70, 100 - issues * 10)
  };

  return {
    securityAnalysis,
    metadata: { securityAnalysisComplete: true }
  };
}

// Style Checker: Validate code style
async function styleChecker(state: CodeReviewState): Promise<Partial<CodeReviewState>> {
  logger.log('Style checker running');
  await delay(120);

  const violations = Math.floor(Math.random() * 10);
  const styleCheck = {
    checked: state.codeFiles.length,
    violations: [
      'Line length exceeds 100 characters',
      'Missing JSDoc comments',
      'Inconsistent naming convention',
      'Unused imports detected'
    ].slice(0, Math.min(violations, 4)),
    score: Math.max(75, 100 - violations * 2.5)
  };

  return {
    styleCheck,
    metadata: { styleCheckComplete: true }
  };
}

// Best Practices Validator: Check against patterns
async function bestPracticesValidator(state: CodeReviewState): Promise<Partial<CodeReviewState>> {
  logger.log('Best practices validator running');
  await delay(130);

  const suggestions = Math.floor(Math.random() * 5);
  const bestPractices = {
    validated: state.codeFiles.length,
    patterns: ['SOLID principles', 'DRY principle', 'Error handling', 'Testing'],
    followed: Math.floor(Math.random() * 2) + 2,
    suggestions: [
      'Extract magic numbers to constants',
      'Add unit tests for new functions',
      'Consider using async/await instead of promises',
      'Implement proper error boundaries'
    ].slice(0, suggestions),
    score: Math.max(70, 100 - suggestions * 5)
  };

  return {
    bestPractices,
    metadata: { bestPracticesComplete: true }
  };
}

// Review Aggregator: Combine all results
async function reviewAggregator(state: CodeReviewState): Promise<Partial<CodeReviewState>> {
  logger.log('Review aggregator combining results');
  await delay(100);

  const securityScore = state.securityAnalysis?.score || 0;
  const styleScore = state.styleCheck?.score || 0;
  const practicesScore = state.bestPractices?.score || 0;
  const overallScore = Math.round((securityScore + styleScore + practicesScore) / 3);

  let status = 'APPROVED';
  if (overallScore < 80) status = 'CHANGES_REQUESTED';
  if (overallScore < 70) status = 'NEEDS_WORK';

  const reviewSummary = `Code Review Summary for PR #${state.pullRequestId}\n\n` +
    `📊 Overall Score: ${overallScore}/100\n` +
    `Status: ${status}\n\n` +
    `🔒 Security: ${securityScore}/100\n` +
    `   - Critical/High: ${state.securityAnalysis?.critical || 0}/${state.securityAnalysis?.high || 0}\n` +
    `   - Medium: ${state.securityAnalysis?.medium || 0}\n\n` +
    `🎨 Style: ${styleScore}/100\n` +
    `   - Violations: ${state.styleCheck?.violations?.length || 0}\n\n` +
    `✨ Best Practices: ${practicesScore}/100\n` +
    `   - Patterns Followed: ${state.bestPractices?.followed || 0}/${state.bestPractices?.patterns?.length || 0}\n\n` +
    `${status === 'APPROVED' ? '✅ Ready to merge!' : '⚠️ Please address the review comments.'}`;

  return {
    overallScore,
    reviewSummary,
    metadata: {
      reviewComplete: true,
      status,
      timestamp: Date.now()
    }
  };
}

export function createCodeReviewGraph() {
  const graph = new StateGraph(CodeReviewStateAnnotation);
  graph.addNode('security', securityAnalyzer);
  graph.addNode('style', styleChecker);
  graph.addNode('practices', bestPracticesValidator);
  graph.addNode('aggregator', reviewAggregator);

  graph.setEntryPoint('security');

  // Parallel execution of style and practices after security
  graph.addEdge('security', 'style');
  graph.addEdge('security', 'practices');
  graph.addEdge('style', 'aggregator');
  graph.addEdge('practices', 'aggregator');
  graph.setFinishPoint('aggregator');

  return graph.compile();
}

export async function runCodeReviewExample(codeFiles: string[]) {
  const pullRequestId = Math.floor(Math.random() * 1000).toString();
  logger.log('Starting code review', { pullRequestId, fileCount: codeFiles.length });

  const graph = createCodeReviewGraph();
  const result = await graph.invoke({ pullRequestId, codeFiles });

  logger.log('Code review complete', { score: result.overallScore });
  return result;
}

export async function main() {
  const examples = [
    { pr: '123', files: ['src/auth/login.ts', 'src/auth/middleware.ts'] },
    { pr: '456', files: ['src/utils/helpers.ts', 'src/utils/validators.ts', 'src/api/routes.ts'] },
    { pr: '789', files: ['src/components/Button.tsx'] },
  ];

  for (const example of examples) {
    console.log('\n' + '='.repeat(70));
    console.log(`Pull Request #${example.pr}`);
    console.log(`Files: ${example.files.join(', ')}`);
    console.log('='.repeat(70));

    const result = await runCodeReviewExample(example.files);

    console.log(`\n${result.reviewSummary}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
