/**
 * Curriculum Builder
 *
 * Helper utility for building curriculum configurations
 */

import type {
  CurriculumStage,
  StageConfig,
  StageDifficulty,
  StageType,
} from "../types.js";

import { Stage1Basic } from "../stages/Stage1Basic.js";
import { Stage2Components } from "../stages/Stage2Components.js";
import { Stage3Layouts } from "../stages/Stage3Layouts.js";
import { Stage4Applications } from "../stages/Stage4Applications.js";

export class CurriculumBuilder {
  private stages: CurriculumStage[] = [];

  /**
   * Add Stage 1 (Basic Concepts)
   */
  addStage1(config?: Partial<StageConfig>): CurriculumBuilder {
    const stage1 = new Stage1Basic(config);
    this.stages.push({
      id: "stage1_basic",
      name: "Stage 1: Basic Concepts",
      type: "basic" as StageType,
      difficulty: "very_easy" as StageDifficulty,
      config: stage1.getConfig(),
      dataGenerator: stage1,
      evaluator: stage1,
    });
    return this;
  }

  /**
   * Add Stage 2 (Components)
   */
  addStage2(config?: Partial<StageConfig>): CurriculumBuilder {
    const stage2 = new Stage2Components(config);
    this.stages.push({
      id: "stage2_components",
      name: "Stage 2: Components",
      type: "components" as StageType,
      difficulty: "easy" as StageDifficulty,
      config: stage2.getConfig(),
      dataGenerator: stage2,
      evaluator: stage2,
    });
    return this;
  }

  /**
   * Add Stage 3 (Layouts)
   */
  addStage3(config?: Partial<StageConfig>): CurriculumBuilder {
    const stage3 = new Stage3Layouts(config);
    this.stages.push({
      id: "stage3_layouts",
      name: "Stage 3: Layouts",
      type: "layouts" as StageType,
      difficulty: "medium" as StageDifficulty,
      config: stage3.getConfig(),
      dataGenerator: stage3,
      evaluator: stage3,
    });
    return this;
  }

  /**
   * Add Stage 4 (Applications)
   */
  addStage4(config?: Partial<StageConfig>): CurriculumBuilder {
    const stage4 = new Stage4Applications(config);
    this.stages.push({
      id: "stage4_applications",
      name: "Stage 4: Applications",
      type: "applications" as StageType,
      difficulty: "hard" as StageDifficulty,
      config: stage4.getConfig(),
      dataGenerator: stage4,
      evaluator: stage4,
    });
    return this;
  }

  /**
   * Build the curriculum
   */
  build(): CurriculumStage[] {
    return [...this.stages];
  }

  /**
   * Build default 4-stage curriculum
   */
  static buildDefault(): CurriculumStage[] {
    return new CurriculumBuilder()
      .addStage1()
      .addStage2()
      .addStage3()
      .addStage4()
      .build();
  }

  /**
   * Build fast curriculum (fewer examples)
   */
  static buildFast(): CurriculumStage[] {
    return new CurriculumBuilder()
      .addStage1({ examples: 1000, epochs: 5 })
      .addStage2({ examples: 3000, epochs: 8 })
      .addStage3({ examples: 5000, epochs: 10 })
      .addStage4({ examples: 2000, epochs: 15 })
      .build();
  }

  /**
   * Build comprehensive curriculum (more examples)
   */
  static buildComprehensive(): CurriculumStage[] {
    return new CurriculumBuilder()
      .addStage1({ examples: 10000, epochs: 15 })
      .addStage2({ examples: 30000, epochs: 20 })
      .addStage3({ examples: 40000, epochs: 25 })
      .addStage4({ examples: 20000, epochs: 40 })
      .build();
  }

  /**
   * Reset builder
   */
  reset(): CurriculumBuilder {
    this.stages = [];
    return this;
  }

  /**
   * Get current stages count
   */
  getStageCount(): number {
    return this.stages.length;
  }
}
