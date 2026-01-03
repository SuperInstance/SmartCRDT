/**
 * Example 15: Data Analysis and Visualization
 *
 * A comprehensive data analysis pipeline with data ingestion,
 * processing, analysis, and visualization generation.
 */

import { StateGraph, Annotation } from '@langchain/langgraph';
import { MockAnalysisDataGenerator, createLogger, delay } from '../../../utils/index.js';

const logger = createLogger('DataAnalysisExample');

interface DataAnalysisState {
  query: string;
  rawData?: any;
  processedData?: any;
  insights?: any;
  visualizations?: any;
  report?: string;
  metadata?: Record<string, unknown>;
}

const DataAnalysisStateAnnotation = Annotation.Root({
  query: Annotation<string>(),
  rawData: Annotation<any>(),
  processedData: Annotation<any>(),
  insights: Annotation<any>(),
  visualizations: Annotation<any>(),
  report: Annotation<string>(),
  metadata: Annotation<Record<string, unknown>>({
    default: () => ({}),
  }),
});

// Data Ingestion: Load and validate data
async function dataIngestion(state: DataAnalysisState): Promise<Partial<DataAnalysisState>> {
  logger.log('Data ingestion agent loading data');
  await delay(100);

  const dataset = MockAnalysisDataGenerator.generateDataset(1000);
  const rawData = {
    source: 'database',
    rows: dataset.data.length,
    columns: dataset.columns,
    size: `${(Math.random() * 5 + 1).toFixed(1)}MB`,
    loadedAt: new Date().toISOString()
  };

  return {
    rawData,
    metadata: { dataIngested: true, rowCount: rawData.rows }
  };
}

// Data Processing: Clean and transform
async function dataProcessing(state: DataAnalysisState): Promise<Partial<DataAnalysisState>> {
  logger.log('Data processing agent transforming data');
  await delay(150);

  const processedData = {
    cleaned: true,
    missingValuesHandled: Math.floor(Math.random() * 50),
    outliersDetected: Math.floor(Math.random() * 20),
    normalized: true,
    features: state.rawData?.columns || 5,
    readyForAnalysis: true
  };

  return {
    processedData,
    metadata: { dataProcessed: true }
  };
}

// Analysis Engine: Generate insights
async function analysisEngine(state: DataAnalysisState): Promise<Partial<DataAnalysisState>> {
  logger.log('Analysis engine generating insights');
  await delay(200);

  const insights = {
    summary: MockAnalysisDataGenerator.generateAnalysisResult(),
    patterns: [
      'Upward trend detected in Q4',
      'Seasonal variation observed',
      'Correlation between variables X and Y'
    ],
    anomalies: Math.floor(Math.random() * 5),
    confidence: 0.87 + Math.random() * 0.1
  };

  return {
    insights,
    metadata: { insightsGenerated: true }
  };
}

// Visualization Generator: Create charts
async function visualizationGenerator(state: DataAnalysisState): Promise<Partial<DataAnalysisState>> {
  logger.log('Visualization generator creating charts');
  await delay(150);

  const visualizations = {
    charts: [
      { type: 'line', title: 'Trend Analysis', dataPoints: 100 },
      { type: 'bar', title: 'Category Comparison', dataPoints: 12 },
      { type: 'pie', title: 'Distribution', dataPoints: 5 },
      { type: 'scatter', title: 'Correlation Matrix', dataPoints: 200 }
    ],
    total: 4,
    format: 'interactive',
    exportFormats: ['png', 'svg', 'pdf']
  };

  return {
    visualizations,
    metadata: { visualizationsCreated: true }
  };
}

// Report Builder: Compile final report
async function reportBuilder(state: DataAnalysisState): Promise<Partial<DataAnalysisState>> {
  logger.log('Report builder compiling analysis');
  await delay(100);

  const report = `Data Analysis Report\n\n` +
    `📊 Query: ${state.query}\n\n` +
    `📥 Data Ingestion:\n` +
    `   - Rows: ${state.rawData?.rows?.toLocaleString()}\n` +
    `   - Columns: ${state.rawData?.columns}\n` +
    `   - Size: ${state.rawData?.size}\n\n` +
    `🔧 Processing:\n` +
    `   - Cleaned: ${state.processedData?.cleaned ? 'Yes' : 'No'}\n` +
    `   - Missing Values: ${state.processedData?.missingValuesHandled}\n` +
    `   - Outliers: ${state.processedData?.outliersDetected}\n\n` +
    `💡 Insights:\n` +
    `   - Patterns: ${state.insights?.patterns?.length}\n` +
    `   - Anomalies: ${state.insights?.anomalies}\n` +
    `   - Confidence: ${(state.insights?.confidence * 100).toFixed(1)}%\n\n` +
    `📈 Visualizations:\n` +
    `   - Charts: ${state.visualizations?.charts?.length}\n` +
    `   - Types: ${state.visualizations?.charts?.map((c: any) => c.type).join(', ')}\n\n` +
    `✨ Analysis complete. Ready for presentation.`;

  return {
    report,
    metadata: {
      reportGenerated: true,
      timestamp: Date.now()
    }
  };
}

export function createDataAnalysisGraph() {
  const graph = new StateGraph(DataAnalysisStateAnnotation);
  graph.addNode('ingestion', dataIngestion);
  graph.addNode('processing', dataProcessing);
  graph.addNode('analysis', analysisEngine);
  graph.addNode('visualization', visualizationGenerator);
  graph.addNode('report', reportBuilder);

  graph.setEntryPoint('ingestion');
  graph.addEdge('ingestion', 'processing');
  graph.addEdge('processing', 'analysis');
  graph.addEdge('analysis', 'visualization');
  graph.addEdge('visualization', 'report');
  graph.setFinishPoint('report');

  return graph.compile();
}

export async function runDataAnalysisExample(query: string) {
  logger.log('Starting data analysis', { query });
  const graph = createDataAnalysisGraph();
  const result = await graph.invoke({ query });
  logger.log('Data analysis complete');
  return result;
}

export async function main() {
  const examples = [
    'Analyze sales performance for Q4 2024',
    'Generate customer segmentation report',
    'Compare website traffic by channel',
  ];

  for (const example of examples) {
    console.log('\n' + '='.repeat(70));
    console.log(`Analysis Query: "${example}"`);
    console.log('='.repeat(70));

    const result = await runDataAnalysisExample(example);
    console.log(`\n${result.report}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
