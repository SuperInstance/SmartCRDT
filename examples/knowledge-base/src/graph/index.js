/**
 * Knowledge Graph
 *
 * Manages entities, relationships, and connections between documents.
 */

class KnowledgeGraph {
  constructor(storage) {
    this.storage = storage;
    this.nodes = new Map(); // nodeId -> {id, type, data, connections}
    this.edges = new Map(); // edgeId -> {id, from, to, type, weight}
  }

  /**
   * Add node to graph
   * @param {string} id - Node ID
   * @param {string} type - Node type
   * @param {Object} data - Node data
   * @returns {Object} Created node
   */
  addNode(id, type, data = {}) {
    const node = {
      id,
      type,
      data,
      createdAt: Date.now(),
      connections: { in: 0, out: 0 }
    };

    this.nodes.set(id, node);
    return node;
  }

  /**
   * Add edge between nodes
   * @param {string} fromId - Source node ID
   * @param {string} toId - Target node ID
   * @param {string} type - Edge type
   * @param {number} weight - Edge weight
   * @returns {Object} Created edge
   */
  addEdge(fromId, toId, type, weight = 1.0) {
    const edgeId = `${fromId}->${toId}`;
    const edge = {
      id: edgeId,
      from: fromId,
      to: toId,
      type,
      weight,
      createdAt: Date.now()
    };

    this.edges.set(edgeId, edge);

    // Update node connection counts
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);

    if (fromNode) fromNode.connections.out++;
    if (toNode) toNode.connections.in++;

    return edge;
  }

  /**
   * Extract entities and build relationships from document
   * @param {Object} document - Document object
   * @param {Object} lsiClient - LSI client
   * @returns {Promise<Array>} Extracted entities
   */
  async buildFromDocument(document, lsiClient) {
    const entities = await this.extractEntities(document.content, lsiClient);

    // Create entity nodes
    for (const entity of entities) {
      const nodeId = `entity:${entity.text.toLowerCase()}`;

      if (!this.nodes.has(nodeId)) {
        this.addNode(nodeId, entity.type, {
          text: entity.text,
          frequency: 1,
          documents: [document.id]
        });
      } else {
        // Update existing entity
        const node = this.nodes.get(nodeId);
        node.data.frequency++;
        node.data.documents.push(document.id);
      }
    }

    // Create relationships between entities
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const fromId = `entity:${entities[i].text.toLowerCase()}`;
        const toId = `entity:${entities[j].text.toLowerCase()}`;

        // Check if entities appear in same context
        if (entities[i].context === entities[j].context) {
          const edgeId = `${fromId}->${toId}`;

          if (this.edges.has(edgeId)) {
            this.edges.get(edgeId).weight++;
          } else {
            this.addEdge(fromId, toId, 'co_occurs', 1);
          }
        }
      }
    }

    // Connect document to entities
    for (const entity of entities) {
      const docNodeId = `document:${document.id}`;
      const entityNodeId = `entity:${entity.text.toLowerCase()}`;

      this.addEdge(docNodeId, entityNodeId, 'contains', 1);
    }

    return entities;
  }

  /**
   * Extract entities from text
   * @param {string} text - Text content
   * @param {Object} lsiClient - LSI client
   * @returns {Promise<Array>} Extracted entities
   */
  async extractEntities(text, lsiClient) {
    const entities = [];
    const sentences = text.split(/[.!?]+/);

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);

      // Extract capitalized words as potential entities
      for (const word of words) {
        if (/^[A-Z][a-z]+$/.test(word)) {
          const type = this.guessEntityType(word);
          entities.push({
            text: word,
            type,
            context: sentence.trim()
          });
        }

        // Multi-word entities
        const twoWordPattern = /^([A-Z][a-z]+ [A-Z][a-z]+)$/;
        const match = sentence.match(twoWordPattern);
        if (match) {
          entities.push({
            text: match[1],
            type: 'CONCEPT',
            context: sentence.trim()
          });
        }
      }
    }

    // Deduplicate
    const seen = new Set();
    return entities.filter(e => {
      const key = e.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Guess entity type
   * @param {string} entity - Entity text
   * @returns {string} Entity type
   */
  guessEntityType(entity) {
    const patterns = {
      PERSON: /^(Dr|Mr|Mrs|Ms|Prof)\s/i,
      ORGANIZATION: /(Inc|Corp|LLC|Ltd|Company|University)/i,
      LOCATION: /(City|State|Country|River|Mountain)/i,
      DATE: /\d{4}/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(entity)) {
        return type;
      }
    }

    return 'ENTITY';
  }

  /**
   * Find related nodes
   * @param {string} nodeId - Starting node ID
   * @param {number} maxDepth - Maximum traversal depth
   * @returns {Array} Related nodes
   */
  findRelated(nodeId, maxDepth = 2) {
    const related = new Set();
    const visited = new Set();
    const queue = [[nodeId, 0]];

    while (queue.length > 0) {
      const [currentId, depth] = queue.shift();

      if (depth >= maxDepth || visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);

      // Find outgoing edges
      for (const [edgeId, edge] of this.edges) {
        if (edge.from === currentId && !visited.has(edge.to)) {
          related.add(edge.to);
          queue.push([edge.to, depth + 1]);
        }

        if (edge.to === currentId && !visited.has(edge.from)) {
          related.add(edge.from);
          queue.push([edge.from, depth + 1]);
        }
      }
    }

    return Array.from(related).map(id => this.nodes.get(id)).filter(Boolean);
  }

  /**
   * Find shortest path between nodes
   * @param {string} fromId - Source node ID
   * @param {string} toId - Target node ID
   * @returns {Array|null} Path as array of node IDs
   */
  findPath(fromId, toId) {
    const visited = new Set();
    const queue = [[fromId, []];

    while (queue.length > 0) {
      const [currentId, path] = queue.shift();

      if (currentId === toId) {
        return [...path, currentId];
      }

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Explore neighbors
      for (const [edgeId, edge] of this.edges) {
        if (edge.from === currentId && !visited.has(edge.to)) {
          queue.push([edge.to, [...path, currentId]]);
        }
      }
    }

    return null; // No path found
  }

  /**
   * Get graph statistics
   * @returns {Object} Graph stats
   */
  getStats() {
    return {
      nodes: this.nodes.size,
      edges: this.edges.size,
      avgConnections: Array.from(this.nodes.values())
        .reduce((sum, node) => sum + node.connections.in + node.connections.out, 0) / this.nodes.size
    };
  }

  /**
   * Export graph as JSON
   * @returns {Object} Graph data
   */
  export() {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values())
    };
  }
}

module.exports = KnowledgeGraph;
