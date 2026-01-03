declare module '@lsi/cascade' {
  export { CascadeRouter } from './CascadeRouter';

  export interface IntentRouter {
    route: (query: string, intent: string) => Promise<any>;
    removeAdapter: (name: string) => void;
    listAdapters: () => string[];
    addAdapter: (adapter: any) => void;
  }
}