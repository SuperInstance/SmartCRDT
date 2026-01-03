export * from './database/SQLitePersistence';
export * from './database/DatabaseMigrations';
export * from './types/KnowledgeEntry';
export * from './types/SearchResult';
export * from './utils/VectorUtils';
export * from './utils/DatabaseError';

// Re-export protocol types
export { type KnowledgeEntry as KnowledgeEntry, type SearchResult as SearchResult } from '@lsi/protocol';