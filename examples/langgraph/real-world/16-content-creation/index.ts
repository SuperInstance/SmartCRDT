/**
 * Example 16: Content Creation Pipeline
 *
 * A multi-stage content creation workflow with ideation, drafting,
 * review, optimization, and publishing capabilities.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { MockContentGenerator, createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('ContentCreationExample');

interface ContentCreationState {
  topic: string;
  contentType: string;
  ideas?: any;
  draft?: string;
  reviewed?: boolean;
  optimized?: string;
  published?: boolean;
  output?: string;
  metadata?: Record<string, unknown>;
}

const ContentCreationStateAnnotation = Annotation.Root({
  topic: Annotation<string>(),
  contentType: Annotation<string>(),
  ideas: Annotation<any>(),
  draft: Annotation<string>(),
  reviewed: Annotation<boolean>({
    default: () => false,
  }),
  optimized: Annotation<string>(),
  published: Annotation<boolean>({
    default: () => false,
  }),
  output: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

// Ideation Agent: Generate content ideas
async function ideationAgent(state: ContentCreationState): Promise<Partial<ContentCreationState>> {
  logger.log('Ideation agent brainstorming');
  await delay(120);

  const ideas = {
    angles: [
      `Beginner's guide to ${state.topic}`,
      `Advanced techniques for ${state.topic}`,
      `Common mistakes in ${state.topic}`,
      `Future trends in ${state.topic}`
    ],
    keywords: [state.topic, 'tutorial', 'best practices', 'tips', 'guide'],
    targetAudience: 'developers and technical professionals',
    tone: 'informative and engaging',
    estimatedLength: '1500-2000 words'
  };

  return {
    ideas,
    metadata: { ideasGenerated: true }
  };
}

// Drafting Agent: Create initial content
async function draftingAgent(state: ContentCreationState): Promise<Partial<ContentCreationState>> {
  logger.log('Drafting agent writing content');
  await delay(200);

  const angle = state.ideas?.angles?.[0] || state.topic;
  const draft = `# ${angle}\n\n` +
    `## Introduction\n\n` +
    `In this comprehensive guide, we'll explore ${state.topic} ` +
    `in depth. Whether you're a beginner or an experienced professional, ` +
    `this article will provide valuable insights and practical knowledge.\n\n` +
    `## Key Concepts\n\n` +
    `Before diving into the details, let's establish a foundation. ` +
    `${state.topic} is a critical area that impacts many aspects of modern development.\n\n` +
    `## Main Content\n\n` +
    `### Understanding the Basics\n\n` +
    `The fundamental concepts of ${state.topic} include:\n` +
    `- Core principles and architecture\n` +
    `- Best practices and patterns\n` +
    `- Common pitfalls to avoid\n` +
    `- Real-world applications\n\n` +
    `### Advanced Techniques\n\n` +
    `Once you've mastered the basics, you can explore more advanced topics ` +
    `such as optimization, scaling, and integration with other systems.\n\n` +
    `## Conclusion\n\n` +
    `${state.topic} is a continually evolving field. Stay curious, keep learning, ` +
    `and don't hesitate to experiment with new approaches.\n\n` +
    `*This draft is ready for review and optimization.*`;

  return {
    draft,
    metadata: { draftCreated: true, wordCount: draft.split(/\s+/).length }
  };
}

// Review Agent: Quality assessment
async function reviewAgent(state: ContentCreationState): Promise<Partial<ContentCreationState>> {
  logger.log('Review agent assessing quality');
  await delay(150);

  const review = {
    grammarScore: 85 + Math.floor(Math.random() * 15),
    readabilityScore: 80 + Math.floor(Math.random() * 20),
    seoScore: 75 + Math.floor(Math.random() * 25),
    suggestions: [
      'Add more specific examples',
      'Include code snippets for technical readers',
      'Consider adding a FAQ section',
      'Optimize heading structure'
    ].slice(0, Math.floor(Math.random() * 3) + 1),
    approved: Math.random() > 0.3
  };

  return {
    reviewed: review.approved,
    metadata: {
      reviewed: true,
      reviewScores: review,
      suggestions: review.suggestions
    }
  };
}

// Optimization Agent: Enhance content
async function optimizationAgent(state: ContentCreationState): Promise<Partial<ContentCreationState>> {
  logger.log('Optimization agent enhancing content');
  await delay(150);

  const optimized = `${state.draft}\n\n` +
    `---\n\n` +
    `## Additional Resources\n\n` +
    `- Official Documentation\n` +
    `- Community Forums\n` +
    `- Related Tutorials\n\n` +
    `## About the Author\n\n` +
    `This content was created with the assistance of AI agents specializing ` +
    `in ideation, drafting, and optimization.\n\n` +
    `*Last updated: ${new Date().toISOString()}*`;

  return {
    optimized,
    metadata: { optimizationComplete: true }
  };
}

// Publishing Agent: Format and publish
async function publishingAgent(state: ContentCreationState): Promise<Partial<ContentCreationState>> {
  logger.log('Publishing agent finalizing content');
  await delay(100);

  const output = `Content Published Successfully!\n\n` +
    `📝 Title: ${state.ideas?.angles?.[0] || state.topic}\n` +
    `📊 Type: ${state.contentType}\n` +
    `✅ Reviewed: ${state.reviewed ? 'Yes' : 'Pending'}\n` +
    `🚀 Optimized: ${state.optimized ? 'Yes' : 'No'}\n` +
    `🌐 Published: Yes\n\n` +
    `Content Stats:\n` +
    `- Word Count: ${(state.optimized || state.draft || '').split(/\s+/).length}\n` +
    `- Sections: 5+\n` +
    `- Readability: High\n\n` +
    `The content has been created, reviewed, optimized, and published ` +
    `successfully using the multi-agent content creation pipeline.`;

  return {
    published: true,
    output,
    metadata: {
      published: true,
      publishedAt: new Date().toISOString(),
      platform: 'blog'
    }
  };
}

export function createContentCreationGraph() {
  const graph = new StateGraph(ContentCreationStateAnnotation);
  graph.addNode('ideation', ideationAgent);
  graph.addNode('drafting', draftingAgent);
  graph.addNode('review', reviewAgent);
  graph.addNode('optimization', optimizationAgent);
  graph.addNode('publishing', publishingAgent);

  graph.setEntryPoint('ideation');
  graph.addEdge('ideation', 'drafting');
  graph.addEdge('drafting', 'review');
  graph.addEdge('review', 'optimization');
  graph.addEdge('optimization', 'publishing');
  graph.setFinishPoint('publishing');

  return graph.compile();
}

export async function runContentCreationExample(topic: string, contentType = 'blog-post') {
  logger.log('Starting content creation', { topic, contentType });
  const graph = createContentCreationGraph();
  const result = await graph.invoke({ topic, contentType });
  logger.log('Content creation complete', { published: result.published });
  return result;
}

export async function main() {
  const examples = [
    { topic: 'Getting Started with TypeScript', type: 'tutorial' },
    { topic: 'Advanced React Patterns', type: 'blog-post' },
    { topic: 'Building REST APIs with Node.js', type: 'guide' },
  ];

  for (const example of examples) {
    console.log('\n' + '='.repeat(70));
    console.log(`Topic: "${example.topic}"`);
    console.log(`Type: ${example.type}`);
    console.log('='.repeat(70));

    const result = await runContentCreationExample(example.topic, example.type);

    if (result.ideas) {
      console.log('\n💡 Generated Ideas:');
      result.ideas.angles?.slice(0, 3).forEach((angle: string, i: number) => {
        console.log(`   ${i + 1}. ${angle}`);
      });
    }

    if (result.draft) {
      console.log(`\n📄 Draft Preview (${result.draft.slice(0, 100)}...)`);
    }

    console.log(`\n${result.output}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
