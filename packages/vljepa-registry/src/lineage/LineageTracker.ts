/**
 * @fileoverview Model lineage tracking
 * @description Tracks model ancestry, training data, and relationships
 */

import type {
  ModelLineage,
  ParentModel,
  ChildModel,
  TrainingInfo,
  DataInfo,
  DataSource,
  LineageGraph,
  LineageNode,
  LineageEdge,
} from "../types.js";

/**
 * Lineage tracker for model ancestry and data provenance
 */
export class LineageTracker {
  private lineageMap: Map<string, ModelLineage>;

  constructor() {
    this.lineageMap = new Map();
  }

  /**
   * Create lineage for a new model version
   * @param modelId Model ID
   * @param version Model version
   * @param training Training information
   * @param data Data information
   * @param parents Parent models (if fine-tuned)
   * @returns Created lineage
   */
  createLineage(
    modelId: string,
    version: string,
    training: TrainingInfo,
    data: DataInfo,
    parents: ParentModel[] = []
  ): ModelLineage {
    const lineage: ModelLineage = {
      modelId,
      version,
      parents,
      children: [],
      training,
      data,
      graph: this.buildInitialGraph(modelId, version, training, data, parents),
    };

    const key = this.getLineageKey(modelId, version);
    this.lineageMap.set(key, lineage);

    // Update parent lineages
    for (const parent of parents) {
      const parentKey = this.getLineageKey(parent.id, parent.version);
      const parentLineage = this.lineageMap.get(parentKey);
      if (parentLineage) {
        const child: ChildModel = {
          id: modelId,
          version,
          method: "fine_tuned",
          timestamp: Date.now(),
        };
        parentLineage.children.push(child);
      }
    }

    return lineage;
  }

  /**
   * Get lineage for a model version
   * @param modelId Model ID
   * @param version Model version
   * @returns Lineage or undefined
   */
  getLineage(modelId: string, version: string): ModelLineage | undefined {
    const key = this.getLineageKey(modelId, version);
    return this.lineageMap.get(key);
  }

  /**
   * Get complete lineage chain (all ancestors)
   * @param modelId Model ID
   * @param version Model version
   * @returns Ancestry chain
   */
  getAncestryChain(modelId: string, version: string): AncestryChain {
    const chain: AncestryNode[] = [];
    const visited = new Set<string>();

    const traverse = (
      currentModelId: string,
      currentVersion: string,
      depth = 0
    ): void => {
      const key = this.getLineageKey(currentModelId, currentVersion);
      if (visited.has(key)) {
        return;
      }
      visited.add(key);

      const lineage = this.lineageMap.get(key);
      if (!lineage) {
        return;
      }

      chain.push({
        modelId: currentModelId,
        version: currentVersion,
        depth,
        training: lineage.training,
        data: lineage.data,
      });

      for (const parent of lineage.parents) {
        traverse(parent.id, parent.version, depth + 1);
      }
    };

    traverse(modelId, version);

    return { chain, depth: Math.max(...chain.map(n => n.depth)) };
  }

  /**
   * Get all descendant models
   * @param modelId Model ID
   * @param version Model version
   * @returns All descendant models
   */
  getDescendants(modelId: string, version: string): ChildModel[] {
    const descendants: ChildModel[] = [];
    const visited = new Set<string>();

    const traverse = (currentModelId: string, currentVersion: string): void => {
      const key = this.getLineageKey(currentModelId, currentVersion);
      if (visited.has(key)) {
        return;
      }
      visited.add(key);

      const lineage = this.lineageMap.get(key);
      if (!lineage) {
        return;
      }

      for (const child of lineage.children) {
        descendants.push(child);
        traverse(child.id, child.version);
      }
    };

    traverse(modelId, version);

    return descendants;
  }

  /**
   * Get common ancestor between two models
   * @param modelA First model
   * @param modelB Second model
   * @returns Common ancestor or undefined
   */
  getCommonAncestor(
    modelA: { id: string; version: string },
    modelB: { id: string; version: string }
  ): { modelId: string; version: string } | undefined {
    const ancestryA = this.getAncestryChain(modelA.id, modelA.version);
    const ancestryB = this.getAncestryChain(modelB.id, modelB.version);

    const setA = new Set(
      ancestryA.chain.map(n => this.getLineageKey(n.modelId, n.version))
    );

    for (const node of ancestryB.chain) {
      const key = this.getLineageKey(node.modelId, node.version);
      if (setA.has(key)) {
        return { modelId: node.modelId, version: node.version };
      }
    }

    return undefined;
  }

  /**
   * Get training data provenance
   * @param modelId Model ID
   * @param version Model version
   * @returns Data provenance information
   */
  getDataProvenance(modelId: string, version: string): DataProvenance {
    const lineage = this.getLineage(modelId, version);
    if (!lineage) {
      return {
        directData: [],
        inheritedData: [],
        totalSamples: 0,
      };
    }

    const directData: DataSource[] = [...lineage.data.sources];
    const inheritedData: DataSource[] = [];
    let totalSamples = lineage.data.samples;

    // Collect data from parent models
    const ancestry = this.getAncestryChain(modelId, version);
    for (const node of ancestry.chain.slice(1)) {
      // Skip root (current model)
      const nodeLineage = this.getLineage(node.modelId, node.version);
      if (nodeLineage) {
        inheritedData.push(...nodeLineage.data.sources);
        totalSamples += nodeLineage.data.samples;
      }
    }

    return {
      directData,
      inheritedData,
      totalSamples,
    };
  }

  /**
   * Compare two model lineages
   * @param modelA First model
   * @param modelB Second model
   * @returns Lineage comparison
   */
  compareLineages(
    modelA: { id: string; version: string },
    modelB: { id: string; version: string }
  ): LineageComparison {
    const lineageA = this.getLineage(modelA.id, modelA.version);
    const lineageB = this.getLineage(modelB.id, modelB.version);

    if (!lineageA || !lineageB) {
      throw new Error("One or both lineages not found");
    }

    const commonAncestor = this.getCommonAncestor(modelA, modelB);
    const ancestryA = this.getAncestryChain(modelA.id, modelA.version);
    const ancestryB = this.getAncestryChain(modelB.id, modelB.version);

    return {
      modelA: modelA,
      modelB: modelB,
      commonAncestor,
      depthA: ancestryA.depth,
      depthB: ancestryB.depth,
      sharedGenerations: commonAncestor
        ? this.getGenerationDepth(ancestryA, commonAncestor)
        : 0,
      trainingDifference: this.compareTraining(
        lineageA.training,
        lineageB.training
      ),
      dataDifference: this.compareData(lineageA.data, lineageB.data),
    };
  }

  /**
   * Get generation depth to common ancestor
   * @param ancestry Ancestry chain
   * @param ancestor Common ancestor
   * @returns Generation depth
   */
  private getGenerationDepth(
    ancestry: AncestryChain,
    ancestor: { modelId: string; version: string }
  ): number {
    const key = this.getLineageKey(ancestor.modelId, ancestor.version);
    const node = ancestry.chain.find(
      n => this.getLineageKey(n.modelId, n.version) === key
    );
    return node?.depth ?? 0;
  }

  /**
   * Compare training configurations
   * @param trainingA First training config
   * @param trainingB Second training config
   * @returns Training differences
   */
  private compareTraining(
    trainingA: TrainingInfo,
    trainingB: TrainingInfo
  ): TrainingDifference {
    const differences: string[] = [];

    if (trainingA.algorithm !== trainingB.algorithm) {
      differences.push(
        `algorithm: ${trainingA.algorithm} vs ${trainingB.algorithm}`
      );
    }

    if (trainingA.epochs !== trainingB.epochs) {
      differences.push(`epochs: ${trainingA.epochs} vs ${trainingB.epochs}`);
    }

    const hyperParamsA = Object.keys(trainingA.hyperparameters);
    const hyperParamsB = Object.keys(trainingB.hyperparameters);
    const allHyperParams = new Set([...hyperParamsA, ...hyperParamsB]);

    for (const param of allHyperParams) {
      const valA = trainingA.hyperparameters[param];
      const valB = trainingB.hyperparameters[param];
      if (JSON.stringify(valA) !== JSON.stringify(valB)) {
        differences.push(
          `hyperparameter.${param}: ${JSON.stringify(valA)} vs ${JSON.stringify(valB)}`
        );
      }
    }

    return {
      differences,
      similarity: 1 - differences.length / (allHyperParams.size + 2),
    };
  }

  /**
   * Compare data configurations
   * @param dataA First data config
   * @param dataB Second data config
   * @returns Data differences
   */
  private compareData(dataA: DataInfo, dataB: DataInfo): DataDifference {
    const differences: string[] = [];

    if (dataA.dataset !== dataB.dataset) {
      differences.push(`dataset: ${dataA.dataset} vs ${dataB.dataset}`);
    }

    if (dataA.split !== dataB.split) {
      differences.push(`split: ${dataA.split} vs ${dataB.split}`);
    }

    const preprocessingA = dataA.preprocessing.map(p => p.name);
    const preprocessingB = dataB.preprocessing.map(p => p.name);
    const allPreprocessing = new Set([...preprocessingA, ...preprocessingB]);

    for (const step of allPreprocessing) {
      const inA = preprocessingA.includes(step);
      const inB = preprocessingB.includes(step);
      if (inA !== inB) {
        differences.push(
          `preprocessing.${step}: ${inA ? "present" : "missing"} vs ${inB ? "present" : "missing"}`
        );
      }
    }

    return {
      differences,
      similarity: 1 - differences.length / (allPreprocessing.size + 2),
    };
  }

  /**
   * Build initial lineage graph
   * @param modelId Model ID
   * @param version Model version
   * @param training Training info
   * @param data Data info
   * @param parents Parent models
   * @returns Lineage graph
   */
  private buildInitialGraph(
    modelId: string,
    version: string,
    training: TrainingInfo,
    data: DataInfo,
    parents: ParentModel[]
  ): LineageGraph {
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];

    // Add model node
    const modelNodeId = `${modelId}:${version}`;
    nodes.push({
      id: modelNodeId,
      modelId,
      version,
      type: "model",
      metadata: {
        algorithm: training.algorithm,
        epochs: training.epochs,
        dataset: data.dataset,
        samples: data.samples,
      },
    });

    // Add data node
    const dataNodeId = `data:${data.dataset}:${data.version}`;
    nodes.push({
      id: dataNodeId,
      modelId: data.dataset,
      version: data.version,
      type: "data",
      metadata: {
        samples: data.samples,
        split: data.split,
      },
    });

    // Add edge from data to model
    edges.push({
      id: `edge:${dataNodeId}:${modelNodeId}`,
      from: dataNodeId,
      to: modelNodeId,
      type: "trained_on",
    });

    // Add parent nodes and edges
    for (const parent of parents) {
      const parentNodeId = `${parent.id}:${parent.version}`;
      nodes.push({
        id: parentNodeId,
        modelId: parent.id,
        version: parent.version,
        type: "model",
        metadata: {},
      });

      edges.push({
        id: `edge:${parentNodeId}:${modelNodeId}`,
        from: parentNodeId,
        to: modelNodeId,
        type: "fine_tuned",
        weight: 1,
      });
    }

    return { nodes, edges };
  }

  /**
   * Get lineage key for storage
   * @param modelId Model ID
   * @param version Model version
   * @returns Storage key
   */
  private getLineageKey(modelId: string, version: string): string {
    return `${modelId}:${version}`;
  }

  /**
   * Export lineage for a model
   * @param modelId Model ID
   * @param version Model version
   * @param format Export format
   * @returns Exported lineage
   */
  exportLineage(
    modelId: string,
    version: string,
    format: "json" | "dot" = "json"
  ): string {
    const lineage = this.getLineage(modelId, version);
    if (!lineage) {
      throw new Error(`Lineage not found for ${modelId}:${version}`);
    }

    if (format === "json") {
      return JSON.stringify(lineage, null, 2);
    }

    // DOT format for graph visualization
    return this.lineageToDot(lineage);
  }

  /**
   * Convert lineage to DOT format
   * @param lineage Model lineage
   * @returns DOT format string
   */
  private lineageToDot(lineage: ModelLineage): string {
    const lines: string[] = ["digraph ModelLineage {"];

    for (const node of lineage.graph.nodes) {
      const label =
        node.type === "model"
          ? `${node.modelId}\\n${node.version}`
          : `${node.modelId}\\n${node.version}`;
      lines.push(
        `  "${node.id}" [label="${label}", shape=${node.type === "model" ? "box" : "ellipse"}];`
      );
    }

    for (const edge of lineage.graph.edges) {
      lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.type}"];`);
    }

    lines.push("}");
    return lines.join("\n");
  }

  /**
   * Import lineage from data
   * @param data Lineage data
   */
  importLineage(data: ModelLineage): void {
    const key = this.getLineageKey(data.modelId, data.version);
    this.lineageMap.set(key, data);
  }

  /**
   * Clear all lineage data
   */
  clear(): void {
    this.lineageMap.clear();
  }

  /**
   * Get statistics
   * @returns Lineage statistics
   */
  getStatistics(): LineageStatistics {
    const totalLineages = this.lineageMap.size;
    const modelsWithParents = Array.from(this.lineageMap.values()).filter(
      l => l.parents.length > 0
    ).length;
    const modelsWithChildren = Array.from(this.lineageMap.values()).filter(
      l => l.children.length > 0
    ).length;

    const allDatasets = new Set<string>();
    const allAlgorithms = new Set<string>();

    for (const lineage of this.lineageMap.values()) {
      allDatasets.add(lineage.data.dataset);
      allAlgorithms.add(lineage.training.algorithm);
    }

    return {
      totalLineages,
      modelsWithParents,
      modelsWithChildren,
      uniqueDatasets: allDatasets.size,
      uniqueAlgorithms: allAlgorithms.size,
    };
  }
}

/**
 * Ancestry chain
 */
export interface AncestryChain {
  chain: AncestryNode[];
  depth: number;
}

/**
 * Ancestry node
 */
export interface AncestryNode {
  modelId: string;
  version: string;
  depth: number;
  training: TrainingInfo;
  data: DataInfo;
}

/**
 * Data provenance
 */
export interface DataProvenance {
  directData: DataSource[];
  inheritedData: DataSource[];
  totalSamples: number;
}

/**
 * Lineage comparison
 */
export interface LineageComparison {
  modelA: { id: string; version: string };
  modelB: { id: string; version: string };
  commonAncestor?: { modelId: string; version: string };
  depthA: number;
  depthB: number;
  sharedGenerations: number;
  trainingDifference: TrainingDifference;
  dataDifference: DataDifference;
}

/**
 * Training difference
 */
export interface TrainingDifference {
  differences: string[];
  similarity: number;
}

/**
 * Data difference
 */
export interface DataDifference {
  differences: string[];
  similarity: number;
}

/**
 * Lineage statistics
 */
export interface LineageStatistics {
  totalLineages: number;
  modelsWithParents: number;
  modelsWithChildren: number;
  uniqueDatasets: number;
  uniqueAlgorithms: number;
}
