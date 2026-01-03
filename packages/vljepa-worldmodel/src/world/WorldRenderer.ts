/**
 * World Renderer for VL-JEPA World Model
 * Renders world state in various formats (JSON, Graphviz, HTML, Canvas)
 */

import type {
  WorldRendererConfig,
  RenderedWorld,
  RenderedState,
  RenderedObject,
  RenderedRelation,
  RenderedPrediction,
  RenderedChain,
  WorldState,
  MotionPrediction,
  CausalRelationship,
} from "../types.js";

export class WorldRenderer {
  private config: WorldRendererConfig;

  constructor(config?: Partial<WorldRendererConfig>) {
    this.config = {
      format: "json",
      showPredictions: true,
      showCausality: true,
      showUncertainty: true,
      detailLevel: "standard",
      ...config,
    };
  }

  /**
   * Render a world state
   */
  render(
    state: WorldState,
    predictions?: MotionPrediction[],
    causalChains?: CausalRelationship[]
  ): RenderedWorld {
    const renderedState = this.renderState(state);

    const renderedPredictions: RenderedPrediction[] = [];
    if (this.config.showPredictions && predictions) {
      for (const prediction of predictions) {
        renderedPredictions.push(this.renderPrediction(prediction));
      }
    }

    const renderedChains: RenderedChain[] = [];
    if (this.config.showCausality && causalChains) {
      for (const chain of causalChains) {
        renderedChains.push(this.renderCausalChain(chain));
      }
    }

    return {
      currentState: renderedState,
      predictions: renderedPredictions,
      causalChains: renderedChains,
      metadata: {
        version: "1.0.0",
        timestamp: Date.now(),
        confidence: state.confidence,
        source: "vljepa-worldmodel",
      },
    };
  }

  /**
   * Render a single state
   */
  private renderState(state: WorldState): RenderedState {
    return {
      objects: state.objects.map(obj => this.renderObject(obj)),
      relations: state.relations.map(rel => this.renderRelation(rel)),
      timestamp: state.timestamp,
    };
  }

  /**
   * Render an object
   */
  private renderObject(obj: any): RenderedObject {
    const rendered: RenderedObject = {
      id: obj.id,
      type: obj.type,
      position: obj.position,
      properties: obj.properties || {},
    };

    if (this.config.showUncertainty && obj.uncertainty !== undefined) {
      rendered.uncertainty = obj.uncertainty;
    }

    if (this.config.detailLevel === "detailed") {
      rendered.properties.rotation = obj.rotation;
      rendered.properties.visible = obj.visible;
      rendered.properties.occluded = obj.occluded;
    }

    return rendered;
  }

  /**
   * Render a spatial relation
   */
  private renderRelation(rel: any): RenderedRelation {
    return {
      subject: rel.subject,
      object: rel.object,
      relation: rel.relation,
      confidence: rel.confidence || 1.0,
    };
  }

  /**
   * Render a motion prediction
   */
  private renderPrediction(prediction: MotionPrediction): RenderedPrediction {
    const state: RenderedState = {
      objects: prediction.positions.map((pos, i) => ({
        id: `${prediction.objectId}-t${i}`,
        type: "predicted",
        position: pos,
        properties: {},
      })),
      relations: [],
      timestamp: prediction.timestamps[prediction.timestamps.length - 1],
    };

    return {
      timestamp: state.timestamp,
      state,
      probability: prediction.confidence,
    };
  }

  /**
   * Render a causal chain
   */
  private renderCausalChain(chain: CausalRelationship): RenderedChain {
    return {
      cause: chain.cause,
      effect: chain.effect,
      path: [chain.cause, chain.effect],
      strength: chain.strength,
    };
  }

  /**
   * Format rendered world as string
   */
  format(rendered: RenderedWorld): string {
    switch (this.config.format) {
      case "json":
        return this.formatAsJSON(rendered);
      case "graphviz":
        return this.formatAsGraphviz(rendered);
      case "html":
        return this.formatAsHTML(rendered);
      case "canvas":
        return this.formatAsCanvas(rendered);
      default:
        return this.formatAsJSON(rendered);
    }
  }

  /**
   * Format as JSON
   */
  private formatAsJSON(rendered: RenderedWorld): string {
    return JSON.stringify(rendered, null, 2);
  }

  /**
   * Format as Graphviz DOT
   */
  private formatAsGraphviz(rendered: RenderedWorld): string {
    let dot = "digraph WorldState {\n";
    dot += "  rankdir=TB;\n";
    dot += "  node [shape=box];\n\n";

    // Add objects as nodes
    for (const obj of rendered.currentState.objects) {
      const label =
        this.config.detailLevel === "minimal"
          ? obj.id
          : `${obj.id}\\n(${obj.position.x.toFixed(1)}, ${obj.position.y.toFixed(1)})`;

      dot += `  "${obj.id}" [label="${label}"];\n`;
    }

    dot += "\n";

    // Add relations as edges
    for (const rel of rendered.currentState.relations) {
      const label = `${rel.relation} (${(rel.confidence * 100).toFixed(0)}%)`;
      dot += `  "${rel.subject}" -> "${rel.object}" [label="${label}"];\n`;
    }

    // Add causal chains
    if (rendered.causalChains.length > 0) {
      dot += "\n  // Causal chains\n";
      for (const chain of rendered.causalChains) {
        const style = " [style=dashed, color=red]";
        dot += `  "${chain.cause}" -> "${chain.effect}"${style}`;
        dot += ` [label="${(chain.strength * 100).toFixed(0)}%"];\n`;
      }
    }

    dot += "}";

    return dot;
  }

  /**
   * Format as HTML
   */
  private formatAsHTML(rendered: RenderedWorld): string {
    let html = "<!DOCTYPE html>\n<html>\n<head>\n";
    html += "<style>\n";
    html += "  body { font-family: Arial, sans-serif; margin: 20px; }\n";
    html +=
      "  .object { border: 1px solid #ccc; margin: 10px; padding: 10px; }\n";
    html += "  .prediction { background: #f0f0f0; }\n";
    html += "  .causal { color: red; }\n";
    html += "</style>\n";
    html += "</head>\n<body>\n";

    html += "<h1>World State</h1>\n";

    // Objects
    html += "<h2>Objects</h2>\n";
    for (const obj of rendered.currentState.objects) {
      html += `<div class="object">\n`;
      html += `  <strong>${obj.id}</strong> (${obj.type})<br>\n`;
      html += `  Position: (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})<br>\n`;
      if (obj.uncertainty !== undefined) {
        html += `  Uncertainty: ${(obj.uncertainty * 100).toFixed(1)}%<br>\n`;
      }
      html += "</div>\n";
    }

    // Relations
    if (rendered.currentState.relations.length > 0) {
      html += "<h2>Relations</h2>\n<ul>\n";
      for (const rel of rendered.currentState.relations) {
        html += `  <li>${rel.subject} ${rel.relation} ${rel.object} (${(rel.confidence * 100).toFixed(0)}%)</li>\n`;
      }
      html += "</ul>\n";
    }

    // Predictions
    if (rendered.predictions.length > 0) {
      html += "<h2>Predictions</h2>\n";
      for (const pred of rendered.predictions) {
        html += `<div class="object prediction">\n`;
        html += `  At t=${pred.timestamp}: `;
        html += `Probability: ${(pred.probability * 100).toFixed(1)}%<br>\n`;
        html += "</div>\n";
      }
    }

    // Causal chains
    if (rendered.causalChains.length > 0) {
      html += "<h2>Causal Chains</h2>\n<ul>\n";
      for (const chain of rendered.causalChains) {
        html += `  <li class="causal">${chain.cause} → ${chain.effect} `;
        html += `(${(chain.strength * 100).toFixed(0)}%)</li>\n`;
      }
      html += "</ul>\n";
    }

    html += "</body>\n</html>";

    return html;
  }

  /**
   * Format as Canvas (JavaScript code)
   */
  private formatAsCanvas(rendered: RenderedWorld): string {
    let js = "// Canvas rendering code\n";
    js += 'const canvas = document.createElement("canvas");\n';
    js += 'const ctx = canvas.getContext("2d");\n';
    js += "canvas.width = 800;\n";
    js += "canvas.height = 600;\n\n";

    // Clear canvas
    js += 'ctx.fillStyle = "#ffffff";\n';
    js += "ctx.fillRect(0, 0, canvas.width, canvas.height);\n\n";

    // Draw objects
    js += "// Draw objects\n";
    for (const obj of rendered.currentState.objects) {
      const x = obj.position.x + 400; // Center at 400
      const y = 300 - obj.position.y; // Invert Y
      const size = 20;

      js += `ctx.fillStyle = "#0066cc";\n`;
      js += `ctx.fillRect(${x - size / 2}, ${y - size / 2}, ${size}, ${size});\n`;
      js += `ctx.fillStyle = "#000000";\n`;
      js += `ctx.fillText("${obj.id}", ${x + size / 2 + 5}, ${y});\n\n`;
    }

    // Draw relations
    if (rendered.currentState.relations.length > 0) {
      js += "\n// Draw relations\n";
      for (const rel of rendered.currentState.relations) {
        const subject = rendered.currentState.objects.find(
          o => o.id === rel.subject
        );
        const object = rendered.currentState.objects.find(
          o => o.id === rel.object
        );

        if (subject && object) {
          const x1 = subject.position.x + 400;
          const y1 = 300 - subject.position.y;
          const x2 = object.position.x + 400;
          const y2 = 300 - object.position.y;

          js += `ctx.strokeStyle = "#666666";\n`;
          js += `ctx.beginPath();\n`;
          js += `ctx.moveTo(${x1}, ${y1});\n`;
          js += `ctx.lineTo(${x2}, ${y2});\n`;
          js += `ctx.stroke();\n\n`;
        }
      }
    }

    js += "\ndocument.body.appendChild(canvas);\n";

    return js;
  }

  /**
   * Render world state to string
   */
  renderToString(
    state: WorldState,
    predictions?: MotionPrediction[],
    causalChains?: CausalRelationship[]
  ): string {
    const rendered = this.render(state, predictions, causalChains);
    return this.format(rendered);
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<WorldRendererConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): WorldRendererConfig {
    return { ...this.config };
  }

  /**
   * Create a simple world state for testing
   */
  createTestState(): WorldState {
    return {
      objects: [
        {
          id: "obj1",
          type: "box",
          position: { x: 0, y: 1, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          properties: { color: "red" },
          visible: true,
          occluded: false,
        },
        {
          id: "obj2",
          type: "sphere",
          position: { x: 2, y: 0.5, z: 0 },
          rotation: { x: 0, y: 0, z: 0, w: 1 },
          properties: { color: "blue" },
          visible: true,
          occluded: false,
        },
      ],
      relations: [
        {
          id: "rel1",
          subject: "obj1",
          object: "obj2",
          relation: "above",
          confidence: 0.9,
        },
      ],
      events: [],
      timestamp: Date.now(),
      confidence: 0.8,
    };
  }
}
