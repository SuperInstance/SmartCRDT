/**
 * Configuration management for Chat Assistant app
 */

import fs from 'fs/promises';
import path from 'path';

export interface ChatAssistantConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  cache_enabled: boolean;
  cache_ttl: number;
  rag_enabled: boolean;
  knowledge_base_path: string;
  privacy_enabled: boolean;
  context_window: number;
  router: {
    complexity_threshold: number;
    local_model: string;
    cloud_model: string;
  };
  cache: {
    size_mb: number;
    similarity_threshold: number;
    ttl_seconds: number;
  };
  embeddings: {
    model: string;
    dimensions: number;
    batch_size: number;
  };
  rag: {
    chunk_size: number;
    chunk_overlap: number;
    top_k: number;
  };
  server: {
    port: number;
    host: string;
  };
}

export class ConfigManager {
  private config: ChatAssistantConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config', 'default.json');
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): ChatAssistantConfig {
    return {
      model: process.env.MODEL || 'llama3.2',
      temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
      max_tokens: parseInt(process.env.MAX_TOKENS || '2000'),
      cache_enabled: process.env.CACHE_ENABLED !== 'false',
      cache_ttl: parseInt(process.env.CACHE_TTL || '3600'),
      rag_enabled: process.env.RAG_ENABLED !== 'false',
      knowledge_base_path: process.env.KNOWLEDGE_BASE_PATH || './knowledge',
      privacy_enabled: process.env.PRIVACY_ENABLED === 'true',
      context_window: parseInt(process.env.CONTEXT_WINDOW || '10'),
      router: {
        complexity_threshold: parseFloat(process.env.COMPLEXITY_THRESHOLD || '0.7'),
        local_model: process.env.LOCAL_MODEL || 'llama3.2',
        cloud_model: process.env.CLOUD_MODEL || 'gpt-4',
      },
      cache: {
        size_mb: parseInt(process.env.CACHE_SIZE_MB || '100'),
        similarity_threshold: parseFloat(process.env.SIMILARITY_THRESHOLD || '0.9'),
        ttl_seconds: parseInt(process.env.CACHE_TTL_SECONDS || '3600'),
      },
      embeddings: {
        model: process.env.EMBEDDINGS_MODEL || 'text-embedding-3-small',
        dimensions: parseInt(process.env.EMBEDDINGS_DIMENSIONS || '1536'),
        batch_size: parseInt(process.env.EMBEDDINGS_BATCH_SIZE || '100'),
      },
      rag: {
        chunk_size: parseInt(process.env.CHUNK_SIZE || '512'),
        chunk_overlap: parseInt(process.env.CHUNK_OVERLAP || '50'),
        top_k: parseInt(process.env.TOP_K || '5'),
      },
      server: {
        port: parseInt(process.env.PORT || '3000'),
        host: process.env.HOST || '0.0.0.0',
      },
    };
  }

  async load(): Promise<void> {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(configContent);
      this.config = { ...this.config, ...loadedConfig };
    } catch (error) {
      console.warn(`Failed to load config from ${this.configPath}, using defaults`);
    }
  }

  get(): ChatAssistantConfig {
    return this.config;
  }

  get<K extends keyof ChatAssistantConfig>(key: K): ChatAssistantConfig[K] {
    return this.config[key];
  }

  set<K extends keyof ChatAssistantConfig>(key: K, value: ChatAssistantConfig[K]): void {
    this.config[key] = value;
  }

  async save(configPath?: string): Promise<void> {
    const savePath = configPath || this.configPath;
    await fs.writeFile(savePath, JSON.stringify(this.config, null, 2));
  }
}
