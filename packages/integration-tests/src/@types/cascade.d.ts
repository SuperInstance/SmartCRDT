declare module '@lsi/cascade' {
  import { ModelCapabilities } from '@lsi/protocol';

  export class CascadeRouter {
    constructor(config: any);
    async route(query: string, context?: any): Promise<any>;
    async getAvailableCapabilities(): Promise<ModelCapabilities>;
  }

  export interface IntentRouter {
    route: (query: string, intent: string) => Promise<any>;
    removeAdapter: (name: string) => void;
    listAdapters: () => string[];
    addAdapter: (adapter: any) => void;
    capabilities: ModelCapabilities;
  }
}