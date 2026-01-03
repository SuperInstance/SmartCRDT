export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
    this.stack = originalError?.stack;
  }
}

export class VectorSearchError extends DatabaseError {
  constructor(message: string, originalError?: Error) {
    super(message, 'VECTOR_SEARCH_ERROR', originalError);
    this.name = 'VectorSearchError';
  }
}

export class EntryNotFoundError extends DatabaseError {
  constructor(id: string) {
    super(`Entry with id ${id} not found`, 'ENTRY_NOT_FOUND');
    this.name = 'EntryNotFoundError';
  }
}