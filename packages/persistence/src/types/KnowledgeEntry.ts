import { KnowledgeEntry as ProtocolKnowledgeEntry } from '@lsi/protocol';

export interface KnowledgeEntry extends ProtocolKnowledgeEntry {
  id: string;
  content: string;
  embedding: Float32Array;
  domain?: string;
  source?: string;
  created_at: number;
  updated_at: number;
}

export interface SearchResult {
  id: string;
  content: string;
  domain?: string;
  source?: string;
  similarity: number;
  created_at: number;
}