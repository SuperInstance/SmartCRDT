#!/usr/bin/env node

/**
 * LangGraph Example - LSI
 *
 * Simplified agent orchestration demonstration with simulated LangGraph patterns.
 */

interface AgentState {
  messages: string[];
  currentStep: number;
  agents: string[];
  results: Record<string, any>;
}

interface AgentNode {
  name: string;
  description: string;
  execute: (state: AgentState) => Promise<Partial<AgentState>>;
}

class SimpleLangGraphDemo {
  private agents: AgentNode[] = [
    {
      name: 'Researcher',
      description: 'Gathers information about the topic',
      async execute(state: AgentState): Promise<Partial<AgentState>> {
        const topic = state.messages[state.messages.length - 1];
        const research = `Researching: "${topic}" - Found 12 relevant sources`;

        return {
          results: {
            ...state.results,
            research: research
          },
          messages: [...state.messages, research]
        };
      }
    },
    {
      name: 'Analyzer',
      description: 'Analyzes the research findings',
      async execute(state: AgentState): Promise<Partial<AgentState>> {
        const research = state.results.research;
        const analysis = `Analysis: Processed research data - 3 key insights identified`;

        return {
          results: {
            ...state.results,
            analysis: analysis
          },
          messages: [...state.messages, analysis]
        };
      }
    },
    {
      name: 'Writer',
      description: 'Creates the final output',
      async execute(state: AgentState): Promise<Partial<AgentState>> {
        const analysis = state.results.analysis;
        const output = `Final Report: Generated comprehensive document based on analysis`;

        return {
          results: {
            ...state.results,
            output: output
          },
          messages: [...state.messages, output]
        };
      }
    },
    {
      name: 'Reviewer',
      description: 'Reviews and validates the output',
      async execute(state: AgentState): Promise<Partial<AgentState>> {
        const output = state.results.output;
        const review = `Review: Quality assessment passed - 95% confidence score`;

        return {
          results: {
            ...state.results,
            review: review
          },
          messages: [...state.messages, review]
        };
      }
    }
  ];

  private graph = new Map<string, AgentNode[]>();

  constructor() {
    // Define graph connections
    this.graph.set('start', [this.agents[0]]); // Researcher
    this.graph.set('research', [this.agents[1]]); // Analyzer
    this.graph.set('analysis', [this.agents[2]]); // Writer
    this.graph.set('output', [this.agents[3]]); // Reviewer
    this.graph.set('review', []); // End
  }

  async executeAgent(agentName: string, state: AgentState): Promise<AgentState> {
    const agent = this.agents.find(a => a.name === agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

    console.log(`🤖 ${agent.name} (${agent.description})`);
    console.log('━'.repeat(50));

    const result = await agent.execute(state);

    const newState: AgentState = {
      ...state,
      ...result,
      currentStep: state.currentStep + 1,
      agents: [...state.agents, agent.name]
    };

    console.log(`✅ Result: ${result.messages[result.messages.length - 1]}\n`);

    return newState;
  }

  async runSequentialDemo(): Promise<void> {
    console.log('🕸️  LangGraph Sequential Demo');
    console.log('============================\n');

    const initialState: AgentState = {
      messages: ['Start research on "AI trends"'],
      currentStep: 0,
      agents: [],
      results: {}
    };

    console.log('📝 Initial request:', initialState.messages[0]);
    console.log('\n🔄 Sequential execution:\n');

    let currentState = initialState;

    // Execute agents in sequence
    for (const agent of this.agents) {
      currentState = await this.executeAgent(agent.name, currentState);
    }

    // Show summary
    console.log('📊 Execution Summary:');
    console.log('─'.repeat(40));
    console.log(`Total Steps: ${currentState.currentStep}`);
    console.log(`Agents Used: ${currentState.agents.join(' → ')}`);
    console.log(`Final Output: ${currentState.results.output}`);
    console.log(`Review Status: ${currentState.results.review}`);
  }

  async runParallelDemo(): Promise<void> {
    console.log('\n⚡ LangGraph Parallel Demo');
    console.log('==========================\n');

    const initialState: AgentState = {
      messages: ['Process "market research"'],
      currentStep: 0,
      agents: [],
      results: {}
    };

    console.log('📝 Initial request:', initialState.messages[0]);
    console.log('\n🔄 Parallel execution:\n');

    // Simulate parallel execution
    const promises = [
      this.executeAgent('Researcher', initialState),
      this.executeAgent('Analyzer', initialState),
      this.executeAgent('Writer', initialState),
      this.executeAgent('Reviewer', initialState)
    ];

    const results = await Promise.all(promises);

    // Combine results
    const finalState = results.reduce((acc, result) => ({
      messages: [...acc.messages, ...result.messages.slice(1)],
      currentStep: Math.max(acc.currentStep, result.currentStep),
      agents: [...acc.agents, ...result.agents],
      results: { ...acc.results, ...result.results }
    }), initialState);

    // Show summary
    console.log('📊 Parallel Execution Summary:');
    console.log('─'.repeat(40));
    console.log(`Total Steps: ${finalState.currentStep}`);
    console.log(`Agents Used: ${finalState.agents.length}`);
    console.log(`Unique Agents: ${new Set(finalState.agents).size}`);
    console.log(`Results Generated: ${Object.keys(finalState.results).length}`);
  }

  async runConditionalDemo(): Promise<void> {
    console.log('\n🔀 LangGraph Conditional Demo');
    console.log('============================\n');

    const initialState: AgentState = {
      messages: ['Create "urgent report"'],
      currentStep: 0,
      agents: [],
      results: {}
    };

    console.log('📝 Initial request:', initialState.messages[0]);
    console.log('\n🔄 Conditional execution:\n');

    let currentState = initialState;
    const executedAgents: string[] = [];

    // Conditional routing logic
    const routingLogic = (state: AgentState): string[] => {
      if (state.messages[0].includes('urgent')) {
        return ['Researcher', 'Writer', 'Reviewer']; // Skip analyzer for urgent
      }
      return ['Researcher', 'Analyzer', 'Writer', 'Reviewer']; // Full pipeline
    };

    const agentsToExecute = routingLogic(currentState);

    for (const agentName of agentsToExecute) {
      currentState = await this.executeAgent(agentName, currentState);
      executedAgents.push(agentName);
    }

    // Show summary
    console.log('📊 Conditional Execution Summary:');
    console.log('─'.repeat(40));
    console.log(`Request Type: ${currentState.messages[0]}`);
    console.log(`Agents Executed: ${executedAgents.join(' → ')}`);
    console.log(`Path Taken: ${executedAgents.length} agents`);
    console.log(`Final Result: ${currentState.results.output}`);
  }

  async run(): Promise<void> {
    await this.runSequentialDemo();
    await this.runParallelDemo();
    await this.runConditionalDemo();

    console.log('\n🎯 LangGraph Key Insights:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Agents can execute sequentially for complex tasks');
    console.log('✅ Parallel execution for independent operations');
    console.log('✅ Conditional routing based on request characteristics');
    console.log('✅ State management across agent transitions');
    console.log('✅ Result aggregation and final output generation');
    console.log('\n💡 In production, use LangGraph for complex orchestration');
    console.log('   with built-in persistence, checkpointing, and');
    console.log('   advanced routing capabilities.');

    console.log('\n🎯 Try it yourself:');
    console.log('   1. Define your own agents with specific roles');
    console.log('   2. Configure graph connections and routing logic');
    console.log('   3. Execute with different patterns (sequential, parallel, conditional)');
    console.log('   4. Monitor state transitions and results');
    console.log('   5. Handle errors and retries in the workflow');
  }
}

// Run demo
async function runDemo() {
  const demo = new SimpleLangGraphDemo();
  await demo.run();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { runDemo };
export default runDemo;