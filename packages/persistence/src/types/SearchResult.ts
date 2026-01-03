export interface SearchResult {
  id: string;
  content: string;
  domain?: string;
  source?: string;
  similarity: number;
  created_at: number;
}