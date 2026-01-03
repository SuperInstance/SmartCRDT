declare module '@lsi/privacy' {
  export class PrivacyClassifier {
    classify(query: string): any;
  }

  export interface RedactionAdditionProtocol {
    redact(query: string): Promise<string>;
    hydrate(redacted: string, context: any): Promise<string>;
  }

  export class SemanticPIIRedactor {
    constructor(config: any);
  }

  export class PrivacyFirewall {
    constructor(config: any);
  }

  export { IntentEncoder } from './intention';
}